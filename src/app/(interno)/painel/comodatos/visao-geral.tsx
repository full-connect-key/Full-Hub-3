"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ChevronDown, Download, PackageOpen, Plus, UserRound } from "lucide-react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import type { IndicadoresDoInventario, ItemDoInventario, PessoaComEquipamento } from "@/lib/dados/comodatos";
import {
  ICONE_DO_TIPO,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  TOM_DO_STATUS,
} from "@/lib/dominio/comodatos";
import { cn } from "@/lib/utils";

import { DialogoDeEquipamento, DialogoDeEmprestimo, AcoesDoItem } from "./acoes-do-equipamento";
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

  const desligados = itens.filter((i) => i.comodato && !i.comodato.pessoa_ativa);
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
        <CartaoDeNumero rotulo="Emprestados" valor={indicadores.emprestados} apoio="com alguém" />
        <CartaoDeNumero rotulo="Disponíveis" valor={indicadores.disponiveis} apoio="na prateleira" />
        <CartaoDeNumero
          rotulo="Em manutenção"
          valor={indicadores.manutencao}
          apoio="fora de uso"
          tom={indicadores.manutencao > 0 ? "atencao" : "neutro"}
        />
        <CartaoDeNumero
          rotulo="Devolução atrasada"
          valor={indicadores.atrasados}
          apoio={indicadores.atrasados === 0 ? "nenhuma passou do prazo" : "passaram da data combinada"}
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
          <Button variant="outline" size="sm" onClick={() => baixarInventario(itens)}>
            <Download aria-hidden />
            Inventário
          </Button>
          <Button variant="outline" size="sm" onClick={() => baixarEmAberto(itens)}>
            <Download aria-hidden />
            Em aberto
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmprestando(true)}>
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

      <DialogoDeEquipamento aberto={cadastrando} aoFechar={() => setCadastrando(false)} />
      <DialogoDeEmprestimo
        aberto={emprestando}
        aoFechar={() => setEmprestando(false)}
        disponiveis={disponiveis}
        equipe={equipe}
      />
    </div>
  );
}

function PorEquipamento({ itens }: { itens: ItemDoInventario[] }) {
  const colunas = useMemo<Column<ItemDoInventario>[]>(
    () => [
      {
        id: "equipamento",
        header: "Equipamento",
        sortValue: (i) => i.nome,
        searchValue: (i) =>
          [i.codigo, i.nome, i.marca, i.modelo, i.numero_serie].filter(Boolean).join(" "),
        cell: (i) => {
          const Icone = ICONE_DO_TIPO[i.tipo];
          return (
            <span className="flex items-center gap-2.5">
              {i.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.foto} alt="" className="bg-muted size-9 shrink-0 rounded object-cover" />
              ) : (
                <span className="bg-muted text-text-muted grid size-9 shrink-0 place-items-center rounded">
                  <Icone aria-hidden className="size-4" />
                </span>
              )}
              <span className="min-w-0">
                <span className="text-text-primary block truncate text-sm">{i.nome}</span>
                <span className="text-text-muted block truncate text-xs tabular-nums">
                  {[i.codigo, ROTULOS_DE_TIPO[i.tipo], i.numero_serie].filter(Boolean).join(" · ")}
                </span>
              </span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Situação",
        sortValue: (i) => i.status,
        cell: (i) => (
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              TOM_DO_STATUS[i.status],
            )}
          >
            {ROTULOS_DE_STATUS[i.status]}
          </span>
        ),
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
              <span className="text-text-muted block text-xs tabular-nums">
                desde {format(parseISO(i.comodato.data_entrega), "dd/MM/yy", { locale: ptBR })}
                {i.comodato.aceito_em === null ? " · sem confirmação" : ""}
              </span>
            </span>
          ) : (
            <span className="text-text-muted text-xs">—</span>
          ),
      },
      {
        id: "estado",
        header: "Estado",
        sortValue: (i) => i.estado,
        cell: (i) => <span className="text-text-secondary text-xs">{ROTULOS_DE_ESTADO[i.estado]}</span>,
      },
      {
        id: "acoes",
        header: "",
        align: "right",
        cell: (i) => <AcoesDoItem item={i} />,
      },
    ],
    [],
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
 */
function PorPessoa({ pessoas }: { pessoas: PessoaComEquipamento[] }) {
  if (pessoas.length === 0) {
    return <EmptyState icon={UserRound} title="Ninguém na equipe ainda" />;
  }

  return (
    <ul className="divide-border divide-y rounded-xl border">
      {pessoas.map((p) => (
        <li key={p.user_id}>
          <details open={p.itens.length > 0} className="group">
            <summary className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
              <ChevronDown
                aria-hidden
                className="text-text-muted size-4 shrink-0 transition-transform group-open:rotate-180"
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
              <span className="text-text-muted text-xs tabular-nums">
                {p.itens.length === 0
                  ? "nenhum equipamento"
                  : p.itens.length === 1
                    ? "1 equipamento"
                    : `${p.itens.length} equipamentos`}
              </span>
            </summary>

            {p.itens.length > 0 ? (
              <ul className="border-border ms-7 border-s ps-3 pb-2.5">
                {p.itens.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                    <span className="text-text-primary min-w-0 flex-1 truncate text-sm">
                      {i.nome}
                    </span>
                    <span className="text-text-muted text-xs tabular-nums">{i.codigo}</span>
                    <span className="text-text-secondary text-xs tabular-nums">
                      desde{" "}
                      {i.comodato
                        ? format(parseISO(i.comodato.data_entrega), "dd/MM/yy", { locale: ptBR })
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// OS DOIS CSV
// ---------------------------------------------------------------------------

function baixarInventario(itens: ItemDoInventario[]) {
  baixarCSV(
    montarCSV(
      ["Código", "Tipo", "Nome", "Marca", "Modelo", "Série", "Situação", "Estado", "Valor", "Com quem"],
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
      ["Pessoa", "Código", "Equipamento", "Entrega", "Previsão", "Confirmado", "Valor"],
      linhas,
    ),
    "comodatos-em-aberto.csv",
  );
}
