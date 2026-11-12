"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  PackageOpen,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import { hojeNaAgencia } from "@/lib/dominio/datas";
import type {
  IndicadoresDoInventario,
  ItemDoInventario,
  PessoaComEquipamento,
} from "@/lib/dados/comodatos";
import {
  CAMPOS_DA_FICHA,
  ICONE_DO_TIPO,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  TOM_DO_STATUS,
} from "@/lib/dominio/comodatos";
import { cn } from "@/lib/utils";

import {
  DialogoDeEquipamento,
  DialogoDeEmprestimo,
  AcoesDoItem,
} from "./acoes-do-equipamento";
import type { VisaoDaGestao } from "./vocabulario";

/**
 * O inventário inteiro, e quem está com o quê.
 *
 * ---------------------------------------------------------------------------
 * **DUAS FORMAS DE OLHAR A MESMA LISTA, e não duas consultas.**
 *
 * "Por equipamento" responde "onde está este item"; "Por pessoa" responde
 * "quem está com o quê", que é a pergunta de quem vai desligar alguém ou
 * comprar mais um notebook. As duas montam do MESMO array — uma segunda
 * consulta daria dois totais para o mesmo inventário.
 * ---------------------------------------------------------------------------
 *
 * **O alerta de pessoa desligada fica ACIMA de tudo**, e é o único em
 * `--danger` desta tela: é o caso que custa dinheiro. Devolução atrasada é
 * cobrança; equipamento com quem saiu da agência é prejuízo.
 */
export function VisaoGeral({
  itens,
  indicadores,
  pessoas,
  equipe,
  visao,
  aoTrocarVisao,
}: {
  itens: ItemDoInventario[];
  indicadores: IndicadoresDoInventario;
  pessoas: PessoaComEquipamento[];
  equipe: { id: string; nome: string; funcao: string | null }[];
  visao: VisaoDaGestao;
  aoTrocarVisao: (v: VisaoDaGestao) => void;
}) {
  const [cadastrando, setCadastrando] = useState(false);
  const [emprestando, setEmprestando] = useState(false);

  const desligados = itens.filter(
    (i) => i.comodato && !i.comodato.pessoa_ativa,
  );
  const disponiveis = itens.filter((i) => i.status === "disponivel");
  const baixados = itens.filter((i) => i.status === "baixado").length;

  return (
    <div className="space-y-5">
      {desligados.length > 0 ? (
        <Alert className="border-danger bg-danger-soft">
          <AlertTriangle aria-hidden className="size-4" />
          <AlertDescription className="text-text-primary">
            <strong>
              {desligados.length === 1
                ? "Um equipamento está com alguém que saiu da agência"
                : `${desligados.length} equipamentos estão com pessoas que saíram da agência`}
              :
            </strong>{" "}
            {desligados
              .map((i) => `${i.nome} (${i.comodato?.pessoa})`)
              .join(", ")}
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CartaoDeNumero
          rotulo="Equipamentos"
          valor={indicadores.total}
          apoio={
            baixados === 0
              ? "no inventário"
              : `no inventário · ${baixados} ${baixados === 1 ? "baixado" : "baixados"} na lista`
          }
        />
        <CartaoDeNumero
          rotulo="Emprestados"
          valor={indicadores.emprestados}
          apoio="com alguém"
        />
        <CartaoDeNumero
          rotulo="Disponíveis"
          valor={indicadores.disponiveis}
          apoio="na prateleira"
        />
        <CartaoDeNumero
          rotulo="Em manutenção"
          valor={indicadores.manutencao}
          apoio="fora de uso"
          tom={indicadores.manutencao > 0 ? "atencao" : "neutro"}
        />
        <CartaoDeNumero
          rotulo="Devolução atrasada"
          valor={indicadores.atrasados}
          apoio={
            indicadores.atrasados === 0
              ? "nenhuma passou do prazo"
              : "passaram da data combinada"
          }
          tom={indicadores.atrasados > 0 ? "alerta" : "bom"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted/60 inline-flex rounded-lg border p-0.5">
          {(
            [
              ["equipamento", "Por equipamento", PackageOpen],
              ["pessoa", "Por pessoa", UserRound],
            ] as const
          ).map(([chave, rotulo, Icone]) => (
            <button
              key={chave}
              type="button"
              onClick={() => aoTrocarVisao(chave)}
              aria-pressed={visao === chave}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                visao === chave
                  ? "bg-surface-card text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Icone aria-hidden className="size-4" />
              {rotulo}
            </button>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => baixarInventario(itens)}
          >
            <Download aria-hidden />
            Inventário
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => baixarEmAberto(itens)}
          >
            <Download aria-hidden />
            Em aberto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmprestando(true)}
          >
            Emprestar
          </Button>
          <Button size="sm" onClick={() => setCadastrando(true)}>
            <Plus aria-hidden />
            Cadastrar
          </Button>
        </div>
      </div>

      {visao === "equipamento" ? (
        <PorEquipamento itens={itens} />
      ) : (
        <PorPessoa pessoas={pessoas} />
      )}

      <DialogoDeEquipamento
        aberto={cadastrando}
        aoFechar={() => setCadastrando(false)}
      />
      <DialogoDeEmprestimo
        aberto={emprestando}
        aoFechar={() => setEmprestando(false)}
        disponiveis={disponiveis}
        equipe={equipe}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AS TRÊS PEÇAS DA LINHA, e elas são das DUAS visões
// ---------------------------------------------------------------------------

/**
 * A identidade do equipamento: a foto (ou o ícone do tipo), o nome, e o
 * `código · tipo · série` embaixo.
 *
 * ---------------------------------------------------------------------------
 * **ELAS SÃO COMPONENTES PORQUE SÃO DUAS VISÕES, e não por tamanho.** Decisão
 * do usuário: *"pode deixar a visualização por pessoa, igual a por
 * equipamento dentro do comodato"*.
 *
 * "Por equipamento" é uma `DataTable`, e cada célula dela era uma função
 * dentro de `columns`; "Por pessoa" era uma lista de `<details>` com o nome,
 * o código e a data de entrega soltos numa linha — **sem foto, sem a pílula
 * de situação, sem o estado, sem as ações e sem busca**. Escrever a anatomia
 * de novo dentro da lista daria a segunda cópia, e a que divergiria é a da
 * lista: ela é a visão que se abre menos. É a história das sete cópias de
 * `abas.tsx`, e a de `ICONE_DA_AREA`, que tinha três cópias e duas já
 * divergidas.
 * ---------------------------------------------------------------------------
 *
 * **E nenhuma consulta mudou:** `PessoaComEquipamento` já carrega `avatar` e
 * `itens: ItemDoInventario[]` inteiros — com `status`, `estado`, `foto` e o
 * `comodato` de cada um — desde a 0069. É a ponte construída e nunca
 * atravessada: a lista tinha os dados e desenhava três campos.
 */
function IdentidadeDoEquipamento({ item }: { item: ItemDoInventario }) {
  const Icone = ICONE_DO_TIPO[item.tipo];
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {item.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.foto}
          alt=""
          className="bg-muted size-9 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="bg-muted text-text-muted grid size-9 shrink-0 place-items-center rounded">
          <Icone aria-hidden className="size-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="text-text-primary block truncate text-sm">
          {item.nome}
        </span>
        <span className="text-text-muted block truncate text-xs tabular-nums">
          {[item.codigo, ROTULOS_DE_TIPO[item.tipo], item.numero_serie]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </span>
  );
}

function PilulaDaSituacao({ status }: { status: ItemDoInventario["status"] }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        TOM_DO_STATUS[status],
      )}
    >
      {ROTULOS_DE_STATUS[status]}
    </span>
  );
}

/**
 * Quando a peça saiu, e o que falta nela: a confirmação de quem recebeu, e a
 * devolução que passou da data.
 *
 * **O ATRASO PASSOU A APARECER NA LINHA, e isso é um buraco que as duas
 * visões tinham.** O cartão do topo conta *"Devolução atrasada: 2"* desde a
 * 0069 e **nenhuma das duas telas dizia QUAIS** — é o cartão de "11
 * entregues" com sete na lista embaixo, que o Resumo da Agência já pagou uma
 * vez. A conta é a mesma do cartão (`data_prevista_devolucao < hoje`), e ela
 * mora aqui para as duas lerem a mesma.
 *
 * **E ele é `--warning`, nunca `--danger`**, que é a regra escrita desta
 * tela: *"o alerta de pessoa desligada é o único em `--danger`, porque é o
 * caso que custa dinheiro; devolução atrasada é cobrança"*.
 *
 * **O `hoje` vem de `hojeNaAgencia()`** e não de `new Date()`: a função é
 * pura e fixa o fuso, então o navegador e o servidor respondem a mesma coisa
 * — e das 21h à meia-noite um `toISOString()` daria atraso a toda peça que
 * vence hoje.
 */
function LinhaDaEntrega({
  comodato,
  hoje,
}: {
  comodato: NonNullable<ItemDoInventario["comodato"]> | null;
  hoje: string;
}) {
  if (!comodato) return <span className="text-text-muted text-xs">—</span>;

  const atrasado =
    comodato.data_prevista_devolucao !== null &&
    comodato.data_prevista_devolucao < hoje;

  return (
    <span className="text-text-muted block text-xs tabular-nums">
      desde{" "}
      {format(parseISO(comodato.data_entrega), "dd/MM/yy", { locale: ptBR })}
      {comodato.aceito_em === null ? " · sem confirmação" : ""}
      {atrasado ? (
        <span className="text-warning font-medium">
          {" · devolução atrasada desde "}
          {format(parseISO(comodato.data_prevista_devolucao!), "dd/MM/yy", {
            locale: ptBR,
          })}
        </span>
      ) : null}
    </span>
  );
}

function textoDoEquipamento(item: ItemDoInventario) {
  return [item.codigo, item.nome, item.marca, item.modelo, item.numero_serie]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function contarAtrasados(itens: ItemDoInventario[], hoje: string) {
  return itens.filter(
    (i) =>
      i.comodato !== null &&
      i.comodato.data_prevista_devolucao !== null &&
      i.comodato.data_prevista_devolucao < hoje,
  ).length;
}

function PorEquipamento({ itens }: { itens: ItemDoInventario[] }) {
  const hoje = hojeNaAgencia();

  const colunas = useMemo<Column<ItemDoInventario>[]>(
    () => [
      {
        id: "equipamento",
        header: "Equipamento",
        sortValue: (i) => i.nome,
        searchValue: (i) => textoDoEquipamento(i),
        cell: (i) => <IdentidadeDoEquipamento item={i} />,
      },
      {
        id: "status",
        header: "Situação",
        sortValue: (i) => i.status,
        cell: (i) => <PilulaDaSituacao status={i.status} />,
      },
      {
        id: "quem",
        header: "Com quem",
        sortValue: (i) => i.comodato?.pessoa ?? null,
        searchValue: (i) => i.comodato?.pessoa ?? "",
        cell: (i) =>
          i.comodato ? (
            <span className="block">
              <span
                className={cn(
                  "block truncate text-sm",
                  i.comodato.pessoa_ativa ? "text-text-primary" : "text-danger",
                )}
              >
                {i.comodato.pessoa}
                {!i.comodato.pessoa_ativa ? " · saiu da agência" : ""}
              </span>
              <LinhaDaEntrega comodato={i.comodato} hoje={hoje} />
            </span>
          ) : (
            <span className="text-text-muted text-xs">—</span>
          ),
      },
      {
        id: "estado",
        header: "Estado",
        sortValue: (i) => i.estado,
        cell: (i) => (
          <span className="text-text-secondary text-xs">
            {ROTULOS_DE_ESTADO[i.estado]}
          </span>
        ),
      },
      {
        id: "acoes",
        header: "",
        align: "right",
        cell: (i) => <AcoesDoItem item={i} />,
      },
    ],
    [hoje],
  );

  return (
    <DataTable
      data={itens}
      columns={colunas}
      getRowId={(i) => i.id}
      searchPlaceholder="Buscar por código, nome, série ou pessoa…"
      initialSort={{ colunaId: "equipamento", direcao: "asc" }}
      emptyIcon={PackageOpen}
      emptyTitle="Nenhum equipamento cadastrado"
      emptyDescription="Cadastre o primeiro para começar a registrar quem está com o quê."
    />
  );
}

/**
 * Por pessoa, e QUEM NÃO TEM NADA APARECE — recolhido, no fim.
 *
 * Ler "a Marina não está na lista" como "ela não tem equipamento" é uma
 * conclusão que a tela deixaria a pessoa tirar sozinha, e a outra leitura
 * possível é "a lista está filtrada". Dizer zero é dizer.
 *
 * ---------------------------------------------------------------------------
 * **E A BUSCA DESFAZ ESSA REGRA DE PROPÓSITO.** Quem digitou alguma coisa tem
 * outro modelo na cabeça: a ausência passa a querer dizer *"não casou"*, e
 * não *"não tem nada"*. Então com termo escrito a pessoa sem item que case
 * sai da lista, e sem termo ela fica — é a decisão dos chips da Biblioteca,
 * onde o zero de uma frente cadastrada é resposta e o de uma aposentada não é.
 *
 * **Ela casa com os MESMOS campos da outra visão** (código, nome, marca,
 * modelo, série) mais o nome da pessoa, que lá é coluna e aqui é cabeçalho —
 * `textoDoEquipamento()` é o lugar único disso. Duas listas de campos seriam
 * duas buscas, e a que divergiria é esta.
 *
 * **E quando a PESSOA casa, os itens dela vêm todos**: quem digita um nome
 * está perguntando o que aquela pessoa tem, e filtrar os itens por aquele
 * mesmo termo devolveria a lista vazia na linha de quem casou.
 * ---------------------------------------------------------------------------
 *
 * **O `<details>` troca de `key` com o termo**, e é mecânico: o `open` é prop,
 * então depois de alguém abrir ou fechar à mão o React não o reimpõe — sem a
 * chave, buscar não abriria as linhas que casaram.
 *
 * **E o atraso aparece no cabeçalho da pessoa, só quando existe** — pinta-se
 * a exceção, que é a decisão da matriz do Day Off: *"2 atrasados"* em toda
 * linha de uma lista em que quase ninguém deve devolução é a mesma linha com
 * um número a mais.
 */
function PorPessoa({ pessoas }: { pessoas: PessoaComEquipamento[] }) {
  const [busca, setBusca] = useState("");
  const hoje = hojeNaAgencia();
  const termo = busca.trim().toLowerCase();

  const lista = useMemo(() => {
    if (!termo) return pessoas;
    return pessoas
      .map((p) => {
        const casaAPessoa = p.nome.toLowerCase().includes(termo);
        return {
          ...p,
          itens: casaAPessoa
            ? p.itens
            : p.itens.filter((i) => textoDoEquipamento(i).includes(termo)),
          casaAPessoa,
        };
      })
      .filter((p) => p.casaAPessoa || p.itens.length > 0);
  }, [pessoas, termo]);

  if (pessoas.length === 0) {
    return <EmptyState icon={UserRound} title="Ninguém na equipe ainda" />;
  }

  return (
    <div className="space-y-3">
      <div className="relative min-w-52 sm:max-w-xs">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por pessoa, código, nome ou série…"
          aria-label="Buscar por pessoa, código, nome ou série"
          className="h-8 pl-8"
        />
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Nada com esse nome"
          description="Nenhuma pessoa e nenhum equipamento casam com o que você digitou."
        />
      ) : (
        <ul className="divide-border divide-y rounded-xl border">
          {lista.map((p) => {
            const atrasados = contarAtrasados(p.itens, hoje);
            return (
              <li key={p.user_id}>
                <details
                  key={termo}
                  open={p.itens.length > 0}
                  className="group"
                >
                  <summary className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <ChevronDown
                      aria-hidden
                      className="text-text-muted size-4 shrink-0 transition-transform group-open:rotate-180"
                    />
                    <UserAvatar
                      name={p.nome}
                      src={p.avatar}
                      size="sm"
                      tooltip={false}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          p.ativo ? "text-text-primary" : "text-danger",
                        )}
                      >
                        {p.nome}
                        {!p.ativo ? " · saiu da agência" : ""}
                      </span>
                    </span>
                    {atrasados > 0 ? (
                      <span className="text-warning shrink-0 text-xs font-medium tabular-nums">
                        {atrasados === 1
                          ? "1 atrasado"
                          : `${atrasados} atrasados`}
                      </span>
                    ) : null}
                    <span className="text-text-muted shrink-0 text-xs tabular-nums">
                      {p.itens.length === 0
                        ? "nenhum equipamento"
                        : p.itens.length === 1
                          ? "1 equipamento"
                          : `${p.itens.length} equipamentos`}
                    </span>
                  </summary>

                  {p.itens.length > 0 ? (
                    // A GRADE É O QUE ALINHA UMA LINHA COM A DE BAIXO, e é a
                    // decisão da faixa de meses do cartão da conta: em `flex`
                    // cada peça fica do tamanho do próprio texto, e a pílula
                    // de situação de duas linhas da mesma pessoa sai em duas
                    // posições — que é justamente o que uma tabela dá e uma
                    // lista não dava. `contents` faz o `<li>` sumir da caixa e
                    // deixar as cinco peças virarem células; o `role` fica
                    // escrito porque `display: contents` já tirou item de
                    // lista da árvore de acessibilidade em navegador antigo.
                    //
                    // Abaixo de `sm` ela volta a ser `flex-wrap`: ali não há
                    // duas colunas para alinhar, e o que importa é a linha
                    // quebrar sem o título ser o primeiro a encolher.
                    <ul className="border-border ms-7 space-y-1.5 border-s ps-3 pb-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center sm:gap-x-3 sm:gap-y-1.5 sm:space-y-0">
                      {p.itens.map((i) => (
                        <li
                          key={i.id}
                          role="listitem"
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 sm:contents"
                        >
                          <span className="min-w-56 flex-1 sm:min-w-0">
                            <IdentidadeDoEquipamento item={i} />
                          </span>
                          <PilulaDaSituacao status={i.status} />
                          <span className="min-w-0">
                            <LinhaDaEntrega comodato={i.comodato} hoje={hoje} />
                          </span>
                          <span className="text-text-secondary shrink-0 text-xs">
                            {ROTULOS_DE_ESTADO[i.estado]}
                          </span>
                          <AcoesDoItem item={i} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OS DOIS CSV
// ---------------------------------------------------------------------------

function baixarInventario(itens: ItemDoInventario[]) {
  baixarCSV(
    montarCSV(
      // A FICHA TÉCNICA ENTRA NO CSV (0070), e as quatro colunas ficam vazias
      // na maior parte das linhas de propósito: é uma planilha de inventário,
      // e "quais máquinas precisam de upgrade" é a pergunta que faz alguém
      // anotar a RAM. Sem elas, o CSV responde tudo menos isso.
      [
        "Código",
        "Tipo",
        "Nome",
        "Marca",
        "Modelo",
        "Série",
        "Situação",
        "Estado",
        "Valor",
        "Com quem",
        ...CAMPOS_DA_FICHA.map((c) => c.rotulo),
      ],
      itens.map((i) => [
        i.codigo,
        ROTULOS_DE_TIPO[i.tipo],
        i.nome,
        i.marca,
        i.modelo,
        i.numero_serie,
        ROTULOS_DE_STATUS[i.status],
        ROTULOS_DE_ESTADO[i.estado],
        i.valor_aquisicao,
        i.comodato?.pessoa ?? null,
        ...CAMPOS_DA_FICHA.map((c) => i[c.chave]),
      ]),
    ),
    "inventario-comodatos.csv",
  );
}

/**
 * Os em aberto, com o VALOR IMOBILIZADO POR PESSOA.
 *
 * O total por pessoa é a pergunta do seguro e a do desligamento, e somá-lo na
 * planilha à mão é a conta que ninguém refaz. Uma linha por pessoa no fim, e
 * não uma coluna repetida em cada item: a coluna repetida convida a somar duas
 * vezes quem tem três equipamentos.
 */
function baixarEmAberto(itens: ItemDoInventario[]) {
  const abertos = itens.filter((i) => i.comodato);

  const porPessoa = new Map<string, number>();
  for (const i of abertos) {
    const nome = i.comodato!.pessoa;
    porPessoa.set(nome, (porPessoa.get(nome) ?? 0) + (i.valor_aquisicao ?? 0));
  }

  const linhas: (string | number | null)[][] = abertos.map((i) => [
    i.comodato!.pessoa,
    i.codigo,
    i.nome,
    i.comodato!.data_entrega,
    i.comodato!.data_prevista_devolucao,
    i.comodato!.aceito_em ? "sim" : "não",
    i.valor_aquisicao,
  ]);

  linhas.push([]);
  for (const [nome, total] of [...porPessoa].sort((a, b) => b[1] - a[1])) {
    linhas.push(["TOTAL", nome, null, null, null, null, total]);
  }

  baixarCSV(
    montarCSV(
      [
        "Pessoa",
        "Código",
        "Equipamento",
        "Entrega",
        "Previsão",
        "Confirmado",
        "Valor",
      ],
      linhas,
    ),
    "comodatos-em-aberto.csv",
  );
}
