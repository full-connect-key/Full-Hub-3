"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Inbox, Loader2, Paperclip, Wallet, X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { NotaDaEquipe } from "@/lib/dados/notas-fiscais";
import {
  COLUNAS_DA_FILA,
  emReais,
  mesDaCompetencia,
  mesPorExtenso,
  porColunaDaFila,
  semRecusadasResolvidas,
} from "@/lib/dominio/notas-fiscais";

import { decidirNota } from "./acoes";

/**
 * A fila do sócio: conferir, recusar e pagar — em QUATRO COLUNAS.
 *
 * ---------------------------------------------------------------------------
 * **ERAM TRÊS LISTAS EMPILHADAS, e a do meio juntava dois fatos opostos.**
 * "Encerradas" tinha a nota paga e a nota recusada na mesma caixa: o pagamento
 * que já saiu e o material que a pessoa precisa mandar de novo. Decisão do
 * usuário: *"separar por status: recusado, aguardando pagamento, pago (tipo
 * kanban)"*.
 *
 * O que a divisão antiga acertava continua inteiro, e está escrito em
 * `COLUNAS_DA_FILA`: a ordem é por QUEM ESTÁ ESPERANDO O QUÊ, não pelo ciclo
 * de vida. As duas primeiras colunas são trabalho do sócio — uma leitura e uma
 * transferência —, a terceira espera a pessoa mandar outra, e a quarta não
 * espera ninguém.
 *
 * **O CARD NÃO ARRASTA**, e a ausência é mecânica: recusar exige o motivo e
 * pagar exige a data digitada, que o arrasto não carrega; paga e recusada não
 * mudam mais de estado. A coluna é leitura, o botão é a ação — a decisão do
 * board de demandas e da Linha do Tempo.
 * ---------------------------------------------------------------------------
 *
 * **OS DOIS FILTROS MORAM NA URL**, como em toda listagem do produto: "olha as
 * notas de setembro da Carla" precisa ser um link, e o recorte precisa
 * sobreviver a um `router.refresh()` depois de cada decisão — em estado do
 * componente, aprovar uma nota devolveria a fila inteira para quem estava
 * olhando um mês só.
 *
 * **E as opções dos dois seletores saem da fila INTEIRA**, nunca do que sobrou
 * do outro filtro: escolhendo a Carla, setembro continua na lista de meses. Sem
 * isso, dois filtros se estreitam um ao outro e a pessoa fica sem caminho de
 * volta — a decisão das abas de Pedidos.
 *
 * **O TOTAL A PAGAR FICA NO CABEÇALHO da coluna**, porque é a pergunta que se
 * faz antes de abrir o banco: quanto sai hoje. Somar de cabeça oito linhas é o
 * tipo de conta que a tela existe para não pedir. **E ele segue o filtro**, que
 * é o certo: quem filtrou por setembro quer saber quanto sai de setembro.
 */
export function FilaDoSocio({ notas }: { notas: NotaDaEquipe[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const [decidindo, decidir] = useTransition();
  const [recusando, setRecusando] = useState<NotaDaEquipe | null>(null);
  const [pagando, setPagando] = useState<NotaDaEquipe | null>(null);
  const [motivo, setMotivo] = useState("");
  const [dataDoPagamento, setDataDoPagamento] = useState("");

  const mes = parametros.get("mes") ?? SEM_FILTRO;
  const pessoa = parametros.get("pessoa") ?? SEM_FILTRO;

  function navegar(mudancas: Record<string, string>) {
    const proximos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (!valor || valor === SEM_FILTRO) proximos.delete(chave);
      else proximos.set(chave, valor);
    }
    // `replace` e não `push`: filtrar não é navegar. Com `push`, o botão voltar
    // desfaz filtro por filtro em vez de sair da tela.
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  // AS OPÇÕES SAEM DA FILA INTEIRA, e só os valores que ela tem. Um mês sem
  // nota nenhuma no seletor não é uma resposta, é ruído — a mesma decisão das
  // redes do mês na faixa de filtros do portal.
  /**
   * A RECUSADA DE UM MÊS JÁ ACEITO SAI DA FILA TAMBÉM.
   *
   * Decisão do usuário: *"após a nota ser aprovada, somente a nota aceita
   * fique aparente"*. Ela foi escrita sobre a tela de quem envia, e vale
   * igual aqui — **a coluna "Recusadas" existe para o sócio ver o que espera
   * uma nota nova**, e uma recusada cujo mês já foi aprovado não espera nada.
   * Sem isso ela seria a única coluna das quatro que só cresce, que é o
   * problema que ela nasceu para resolver.
   *
   * É o MESMO corte da tela da pessoa, pela mesma função: duas respostas para
   * "esta recusada ainda interessa?" divergiriam no dia em que alguém mexesse
   * numa — e os dois lados olham a mesma linha.
   *
   * **Ele vem ANTES dos seletores**, então o mês e a pessoa de uma recusada
   * resolvida não entram nas opções por causa dela. Na prática não muda nada:
   * o mês tem a nota aceita e a pessoa a enviou. O que a ordem garante é que
   * a lista de opções e as colunas respondam sobre o mesmo conjunto.
   */
  const visiveis = semRecusadasResolvidas(notas);

  const { meses, pessoas } = useMemo(() => {
    const porMes = new Set<string>();
    const porPessoa = new Map<string, string>();
    for (const nota of visiveis) {
      porMes.add(mesDaCompetencia(nota.competencia));
      if (nota.pessoa) porPessoa.set(nota.pessoa.id, nota.pessoa.nome);
    }
    return {
      meses: [...porMes].sort().reverse(),
      pessoas: [...porPessoa].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    };
  }, [visiveis]);

  const filtradas = visiveis.filter(
    (nota) =>
      (mes === SEM_FILTRO || mesDaCompetencia(nota.competencia) === mes) &&
      (pessoa === SEM_FILTRO || nota.pessoa?.id === pessoa),
  );
  const colunas = porColunaDaFila(filtradas);

  function aprovar(nota: NotaDaEquipe) {
    decidir(async () => {
      const r = await chamarEMostrar(() => decidirNota({ id: nota.id, decisao: "aprovada" }));
      if (r?.ok) router.refresh();
    });
  }

  function confirmarRecusa() {
    if (!recusando) return;
    decidir(async () => {
      const r = await chamarEMostrar(() =>
        decidirNota({ id: recusando.id, decisao: "recusada", motivo }),
      );
      if (r?.ok) {
        setRecusando(null);
        setMotivo("");
        router.refresh();
      }
    });
  }

  function confirmarPagamento() {
    if (!pagando) return;
    decidir(async () => {
      const r = await chamarEMostrar(() =>
        decidirNota({ id: pagando.id, decisao: "paga", pagamento: dataDoPagamento }),
      );
      if (r?.ok) {
        setPagando(null);
        router.refresh();
      }
    });
  }

  /**
   * O card de uma nota.
   *
   * **A PESSOA VEM PRIMEIRO, e o estado não aparece aqui**: o cabeçalho da
   * coluna já o disse, e repeti-lo em cada card é a mesma informação a um
   * centímetro de distância — a decisão do selo de status dentro do grupo da
   * Lista. Fora da coluna (na busca, num resumo) o selo volta; aqui ele seria
   * quatro palavras iguais empilhadas.
   */
  function Card({ nota, acoes }: { nota: NotaDaEquipe; acoes?: React.ReactNode }) {
    return (
      <li className="bg-card rounded-card shadow-cartao space-y-2 border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {nota.pessoa ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <UserAvatar name={nota.pessoa.nome} src={nota.pessoa.avatar_url} size="sm" />
              <span className="truncate text-sm font-medium">{nota.pessoa.nome}</span>
            </span>
          ) : (
            <span className="text-text-muted text-sm">sem nome</span>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-semibold tabular-nums">{emReais(nota.valor)}</p>
          <p className="text-text-secondary text-xs">{mesPorExtenso(nota.competencia)}</p>
          {nota.numero ? <p className="text-text-muted text-xs">NF {nota.numero}</p> : null}
        </div>

        {nota.observacoes ? (
          <p className="text-text-secondary text-xs">{nota.observacoes}</p>
        ) : null}
        {nota.motivo_recusa ? (
          <p className="text-danger text-xs">Recusada: {nota.motivo_recusa}</p>
        ) : null}
        {nota.pagamento ? (
          <p className="text-text-muted text-xs">
            Pago em {nota.pagamento.split("-").reverse().join("/")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {/* O PDF ANTES DOS BOTÕES, e é a mesma razão pela qual o portal põe a
              arte antes do "Aprovar": um botão numa linha sem nada para abrir
              convida a decidir sem olhar. */}
          {nota.arquivoAssinado ? (
            <Button asChild variant="outline" size="sm">
              <a href={nota.arquivoAssinado} target="_blank" rel="noreferrer">
                <Paperclip aria-hidden />
                Ver PDF
              </a>
            </Button>
          ) : null}
          {acoes}
        </div>
      </li>
    );
  }

  function acoesDe(nota: NotaDaEquipe) {
    if (nota.status === "enviada") {
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={decidindo}
            onClick={() => {
              setRecusando(nota);
              setMotivo("");
            }}
          >
            <X aria-hidden />
            Recusar
          </Button>
          <Button size="sm" disabled={decidindo} onClick={() => aprovar(nota)}>
            {decidindo ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
            Aprovar
          </Button>
        </>
      );
    }
    if (nota.status === "aprovada") {
      return (
        <Button
          size="sm"
          disabled={decidindo}
          onClick={() => {
            setPagando(nota);
            setDataDoPagamento("");
          }}
        >
          <Wallet aria-hidden />
          Marcar paga
        </Button>
      );
    }
    // Paga e recusada não mudam mais de estado, nem pelo sócio — e um botão que
    // o banco recusa ensina a desconfiar do botão.
    return null;
  }

  return (
    <div className="space-y-4">
      <FilterBar
        selects={[
          {
            id: "nf-mes",
            label: "Mês",
            value: mes,
            allLabel: "Todos os meses",
            options: meses.map((m) => ({ value: m, label: mesPorExtenso(`${m}-01`) })),
            onChange: (valor) => navegar({ mes: valor }),
          },
          {
            id: "nf-pessoa",
            label: "Pessoa",
            value: pessoa,
            allLabel: "Toda a equipe",
            options: pessoas.map(([id, nome]) => ({ value: id, label: nome })),
            onChange: (valor) => navegar({ pessoa: valor }),
          },
        ]}
        onClear={() => navegar({ mes: "", pessoa: "" })}
      />

      {visiveis.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma nota esperando"
          description="Quando alguém enviar a nota do mês, ela aparece aqui e você recebe um aviso."
        />
      ) : filtradas.length === 0 ? (
        /* O VAZIO DO FILTRO É OUTRO VAZIO, e por isso a frase é outra: as quatro
           colunas em branco fariam o sócio concluir que a agência não tem nota
           nenhuma, quando ele acabou de escolher um recorte. O "Limpar filtros"
           da barra acima é a saída. */
        <p className="text-muted-foreground rounded-card border border-dashed px-4 py-8 text-center text-sm">
          Nenhuma nota neste recorte.
        </p>
      ) : (
        /* AS QUATRO COLUNAS SÃO GRADE, e não a faixa rolável dos outros
           boards do produto.

           O board de demandas tem sete colunas e o de etapas tem seis: nessas
           larguras não há como não rolar, e a faixa com `overflow-x-auto` é a
           resposta certa. Quatro CABEM — e com largura fixa elas cabiam por
           pouco: a imagem saiu com a coluna "Pagas" cortada pela borda do
           invólucro, uns vinte pixels além. Um board de sete que rola é um
           board; um de quatro que rola por vinte pixels parece defeito.

           Na grade a coluna se mede pelo espaço que existe, qualquer que seja
           ele, e abaixo de `xl` ela quebra em duas e depois em uma — que é
           como as três listas antigas já se liam no celular, e é melhor que
           rolar de lado para achar a terceira. */
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {COLUNAS_DA_FILA.map((coluna) => {
            const daColuna = colunas[coluna.status];
            // O TOTAL SÓ APARECE ONDE ELE DECIDE ALGO: na coluna do que vai
            // sair do caixa. Somar o que já foi pago é um número histórico, e
            // somar o que foi recusado é somar o que não vai ser pago.
            const total =
              coluna.status === "aprovada"
                ? daColuna.reduce((soma, n) => soma + n.valor, 0)
                : null;

            return (
              <section
                key={coluna.status}
                aria-labelledby={`coluna-${coluna.status}`}
                /* `min-w-0` porque uma célula de grade não encolhe abaixo do
                   conteúdo dela por padrão: sem isso, um nome comprido num
                   card empurra a coluna e desalinha as outras três. */
                className="flex min-w-0 flex-col"
              >
                <header className="flex items-baseline justify-between gap-2 px-1.5 pb-2.5">
                  <h3
                    id={`coluna-${coluna.status}`}
                    className="text-text-secondary text-[11px] font-bold tracking-wider uppercase"
                  >
                    {coluna.titulo}
                  </h3>
                  <span className="text-text-muted text-xs font-bold tabular-nums">
                    {daColuna.length}
                  </span>
                </header>

                {/* O TOTAL FICA EMBAIXO DO CABEÇALHO, e não dentro dele.
                    Ao lado do título ele comia a linha inteira — "AGUARDANDO
                    PAGAMENTO" mais um valor em reais não cabem em 272px —, e
                    tirava dos outros três a contagem, que é o que um board diz
                    no cabeçalho. Numa linha própria ele continua respondendo a
                    pergunta que se faz antes de abrir o banco: quanto sai. */}
                {total !== null && total > 0 ? (
                  <p className="text-text-secondary px-1.5 pb-2.5 text-xs font-semibold tabular-nums">
                    {emReais(total)} no total
                  </p>
                ) : null}

                <ul className="flex flex-col gap-2.5 px-0.5 pb-1">
                  {daColuna.length === 0 ? (
                    <li className="text-text-muted rounded-card border border-dashed px-1 py-5 text-center text-xs font-semibold">
                      {coluna.vazio}
                    </li>
                  ) : (
                    daColuna.map((nota) => (
                      <Card key={nota.id} nota={nota} acoes={acoesDe(nota)} />
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={recusando !== null} onOpenChange={(a) => !a && setRecusando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar a nota</DialogTitle>
            <DialogDescription>
              {recusando?.pessoa?.nome} recebe o motivo e envia outra para o mesmo mês.
              Esta nota fica no histórico com o que você escrever.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="nf-motivo">O que está errado</Label>
            <Textarea
              id="nf-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O CNPJ está o da empresa antiga."
              className="mt-1.5"
              rows={3}
            />
            {/* A EXIGÊNCIA É DO BANCO — o check `team_invoices_recusa_com_motivo`
                recusa a recusa sem motivo. Esta frase só chega antes. */}
            <p className="text-muted-foreground mt-1 text-xs">
              Sem isto a pessoa manda a mesma nota de novo.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarRecusa} disabled={decidindo}>
              {decidindo ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pagando !== null} onOpenChange={(a) => !a && setPagando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como paga</DialogTitle>
            <DialogDescription>
              {pagando ? `${emReais(pagando.valor)} para ${pagando.pessoa?.nome ?? "a pessoa"}.` : null}{" "}
              Isto lança a despesa no Financeiro da agência, na competência da nota.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="nf-pagamento">Dia em que o pagamento saiu</Label>
            <Input
              id="nf-pagamento"
              type="date"
              value={dataDoPagamento}
              onChange={(e) => setDataDoPagamento(e.target.value)}
              className="mt-1.5"
            />
            {/* A DATA É DIGITADA E NÃO A DE HOJE: o sócio marca no dia em que
                lembra, e a transferência saiu no dia em que saiu. Gravar o dia
                do clique poria no relatório de caixa um dia que não aconteceu
                — é a mesma razão de o Financeiro ter três datas. */}
            <p className="text-muted-foreground mt-1 text-xs">
              É esta data que vai para o caixa, não a de hoje.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagando(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPagamento} disabled={decidindo || !dataDoPagamento}>
              {decidindo ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
