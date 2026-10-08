"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { NotaDaEquipe } from "@/lib/dados/notas-fiscais";
import {
  CORES_DE_NF,
  EXPLICACAO_DE_NF,
  ROTULOS_DE_NF,
  emReais,
  interpretarValor,
  mesDaCompetencia,
  mesPorExtenso,
  recusadasPendentes,
  semRecusadasResolvidas,
} from "@/lib/dominio/notas-fiscais";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { apagarNota, enviarNota } from "./acoes";

const BUCKET = "notas-fiscais";

/**
 * As minhas notas, e o envio da do mês.
 *
 * ---------------------------------------------------------------------------
 * **A RECUSADA ABRE A LISTA, com o motivo por extenso.**
 *
 * Ela não é mais uma linha com um selo vermelho: é a única da tela que pede
 * uma ação da pessoa, e o motivo é a informação que decide o que ela faz em
 * seguida. Escondido atrás de um `title`, o motivo não existe para quem usa
 * toque nem para quem varre a tela com o olho — a mesma lição da célula do
 * calendário do Full Days.
 * ---------------------------------------------------------------------------
 *
 * **O arquivo sobe pela sessão de quem está clicando**, como a capa do cliente
 * e a arte do post: o binário não atravessa o servidor do Next, e a policy do
 * bucket continua valendo. Para a action vai só o caminho.
 *
 * **E o caminho começa pela pasta da PESSOA** — a policy compara
 * `(storage.foldername(name))[1]` com quem está pedindo. Um arquivo na raiz
 * não é lido por ninguém, nem por quem o subiu.
 */
export function MinhasNotas({
  notas,
  usuarioId,
  mesesDisponiveis,
}: {
  notas: NotaDaEquipe[];
  usuarioId: string;
  mesesDisponiveis: { valor: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, salvar] = useTransition();
  const [subindo, setSubindo] = useState(false);

  const [mes, setMes] = useState(mesesDisponiveis[0]?.valor ?? "");
  const [valor, setValor] = useState("");
  const [numero, setNumero] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<{ caminho: string; nome: string } | null>(null);

  const mesesVivos = new Set(
    notas.filter((n) => n.status !== "recusada").map((n) => mesDaCompetencia(n.competencia)),
  );
  const oferecidos = mesesDisponiveis.filter((m) => !mesesVivos.has(m.valor));

  // A RECUSADA CUJO MÊS JÁ TEM NOTA NOVA NÃO ENTRA AQUI, e isto é um conserto.
  //
  // A linha era `notas.filter((n) => n.status === "recusada")`, e o bloco
  // vermelho ficava na tela para sempre: a pessoa corrigia, mandava a nota
  // nova, e continuava lendo "Uma nota precisa ser reenviada" — na mesma tela
  // onde ela acabara de mandar. Relato do usuário.
  //
  // A conta já existia, certa, em `minhasNotasRecusadas()`, que é o que faz o
  // aviso sair da Home — e o conjunto dos meses vivos já estava calculado na
  // linha acima, para decidir o que o seletor oferece. Eram duas metades na
  // mesma função que não se encontravam. Hoje a pergunta tem um lugar só, em
  // `lib/dominio/`, e os dois lados a fazem.
  const recusadas = recusadasPendentes(
    notas.filter((n) => n.status === "recusada"),
    mesesVivos,
  );

  // E A RECUSADA DE UM MÊS QUE O SELETOR NÃO OFERECE NÃO GANHA O BOTÃO: fora
  // dos doze meses, abrir o diálogo deixaria o campo de mês em branco — um
  // formulário que pede uma escolha que ele não tem. Uma nota recusada há mais
  // de um ano é conversa com a contabilidade, que é a regra de
  // `mesesParaEmitir`.
  const reenviaveis = new Set(
    recusadas
      .map((n) => mesDaCompetencia(n.competencia))
      .filter((mesDaNota) => oferecidos.some((m) => m.valor === mesDaNota)),
  );

  /**
   * Abre o envio JÁ NO MÊS da nota recusada.
   *
   * Decisão do usuário: *"não tem como substituir ou reenviar dentro do envio
   * já feito"*. O caminho existia — "Enviar nota" e escolher o mês na lista —,
   * e de dentro da linha recusada não havia nada dizendo isso: quem olhava o
   * motivo tinha de voltar ao topo, abrir o diálogo e lembrar de qual mês era.
   *
   * **É O MESMO DIÁLOGO, com o mês escolhido**, e não um segundo formulário
   * chamado "substituir": a nota nova nasce ao lado da recusada — o índice
   * único do banco é parcial justamente para isso —, e quando o sócio aceita,
   * a antiga sai da lista. Do lado de quem envia isso É substituir, e é por
   * isso que o botão passou a se chamar assim; o que não existe é uma segunda
   * tela, que divergiria desta na primeira mudança.
   */
  function abrirPara(mesDaNota: string) {
    setMes(mesDaNota);
    setAberto(true);
  }

  const recusadaDoMesEscolhido =
    recusadas.find((n) => mesDaCompetencia(n.competencia) === mes) ?? null;

  /**
   * A LISTA ESCONDE A RECUSADA DE UM MÊS JÁ ACEITO.
   *
   * Decisão do usuário: *"após a nota ser aprovada, somente a nota aceita
   * fique aparente, excluindo as notas recusadas"*.
   *
   * **O recorte é na TELA e não na consulta**, que é a decisão das abas de
   * Pedidos e dos contadores de Minhas Tasks: `minhasNotas()` continua
   * trazendo o histórico inteiro, e é ele que decide o que o seletor oferece
   * (`mesesVivos`) e o que o bloco vermelho cobra (`recusadas`). Com o
   * `where` no banco, as duas contas passariam a enxergar menos do que
   * existe — e a primeira delas é a que impede uma segunda nota do mesmo mês.
   *
   * Ela esconde e não apaga: a linha fica no banco com o motivo, e é ela que
   * o índice único parcial e a trilha de auditoria usam.
   */
  const visiveis = semRecusadasResolvidas(notas);

  async function subir(escolhido: File | undefined) {
    if (!escolhido) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const extensao = escolhido.name.split(".").pop() ?? "pdf";
      const caminho = `${usuarioId}/${mes || "sem-mes"}-${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, escolhido, { contentType: escolhido.type });

      if (error) {
        toast.error(`Não foi possível anexar: ${error.message}`);
        return;
      }
      setArquivo({ caminho, nome: escolhido.name });
    } finally {
      setSubindo(false);
    }
  }

  function enviar() {
    const centavos = interpretarValor(valor);
    if (centavos === null) {
      toast.error("Confira o valor: escreva algo como 4.250,00.");
      return;
    }
    if (!arquivo) {
      toast.error("Anexe o PDF da nota.");
      return;
    }

    salvar(async () => {
      const resultado = await chamarEMostrar(() =>
        enviarNota({
          mes,
          valor: centavos,
          numero: numero || null,
          arquivo_url: arquivo.caminho,
          observacoes: observacoes || null,
        }),
      );
      if (resultado?.ok) {
        setAberto(false);
        setValor("");
        setNumero("");
        setObservacoes("");
        setArquivo(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* O QUE PEDE AÇÃO VEM PRIMEIRO, e só quando existe. Um bloco fixo
          dizendo "nenhuma nota recusada" ocuparia todo mês o lugar de uma
          informação que interessa em alguns meses — a mesma regra dos blocos
          de exceção da Home. */}
      {recusadas.length > 0 ? (
        <section className="bg-danger-soft rounded-xl p-4" aria-labelledby="notas-recusadas">
          <h2 id="notas-recusadas" className="text-danger flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert aria-hidden className="size-4" />
            {recusadas.length === 1
              ? "Uma nota precisa ser reenviada"
              : `${recusadas.length} notas precisam ser reenviadas`}
          </h2>
          <ul className="mt-2 space-y-2">
            {recusadas.map((nota) => (
              <li key={nota.id} className="text-sm">
                <span className="font-medium">{mesPorExtenso(nota.competencia)}</span>
                {" — "}
                <span className="text-text-secondary">{nota.motivo_recusa}</span>
              </li>
            ))}
          </ul>
          {/* A FRASE DIZ ONDE CLICAR, e não só o que fazer. Ela mandava
              "corrija e envie uma nota nova para o mesmo mês" sem dizer por
              onde — é a diferença entre uma instrução e uma descrição, a mesma
              lição da recusa que nomeia cada etapa sem aprovação. */}
          <p className="text-text-secondary mt-2 text-xs">
            Cada uma tem um botão <strong>Substituir</strong> na lista abaixo. Até a
            nova ser aprovada, a recusada fica aqui com o motivo — é ele que diz o
            que corrigir.
          </p>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {visiveis.length === 0
            ? "Nenhuma nota enviada ainda."
            : `${visiveis.length} nota${visiveis.length === 1 ? "" : "s"} no histórico.`}
        </p>
        <Button onClick={() => setAberto(true)} disabled={oferecidos.length === 0}>
          <Plus aria-hidden />
          Enviar nota
        </Button>
      </div>

      {oferecidos.length === 0 && visiveis.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Os doze últimos meses já têm nota enviada.
        </p>
      ) : null}

      {visiveis.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Você ainda não enviou nenhuma nota"
          description="Todo mês, anexe o PDF da sua nota fiscal aqui. O sócio confere, e você acompanha o pagamento por esta tela."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {visiveis.map((nota) => (
            <li key={nota.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-[10rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{mesPorExtenso(nota.competencia)}</p>
                  <span
                    title={EXPLICACAO_DE_NF[nota.status]}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs font-medium",
                      CORES_DE_NF[nota.status],
                    )}
                  >
                    {ROTULOS_DE_NF[nota.status]}
                  </span>
                  {nota.numero ? (
                    <Badge variant="secondary">NF {nota.numero}</Badge>
                  ) : null}
                </div>

                <p className="text-text-secondary mt-1 text-sm tabular-nums">
                  {emReais(nota.valor)}
                </p>

                {nota.status === "recusada" && nota.motivo_recusa ? (
                  <p className="text-danger mt-1 text-xs">{nota.motivo_recusa}</p>
                ) : null}
                {nota.status === "paga" && nota.pagamento ? (
                  <p className="text-text-muted mt-1 text-xs">
                    Pagamento em {nota.pagamento.split("-").reverse().join("/")}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {nota.arquivoAssinado ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={nota.arquivoAssinado} target="_blank" rel="noreferrer">
                      <Paperclip aria-hidden />
                      Ver PDF
                    </a>
                  </Button>
                ) : null}

                {/* "SUBSTITUIR" MORA NA LINHA DA RECUSADA, que é onde a
                    pessoa está quando lê o motivo — e é o que o usuário não
                    encontrava. Ele abre o mesmo diálogo com o mês escolhido.

                    **O RÓTULO É "SUBSTITUIR" E A MECÂNICA NÃO MUDOU**, e as
                    duas coisas são compatíveis desde que a recusada deixou de
                    ficar na tela depois de resolvida: a nota nova nasce ao
                    lado — o índice único de `team_invoices` é parcial
                    (`where status <> 'recusada'`) exatamente para isso —, e
                    quando o sócio aceita, a antiga sai da lista. Do lado de
                    quem envia, isso É substituir; o banco é que continua
                    guardando as duas, com o motivo.

                    Some quando o mês já tem nota viva: aí não há o que
                    substituir, e o botão prometeria uma segunda nota que o
                    índice único recusa. */}
                {nota.status === "recusada" &&
                reenviaveis.has(mesDaCompetencia(nota.competencia)) ? (
                  <Button
                    size="sm"
                    onClick={() => abrirPara(mesDaCompetencia(nota.competencia))}
                  >
                    <RotateCcw aria-hidden />
                    Substituir
                  </Button>
                ) : null}

                {/* APAGAR SÓ ENQUANTO NINGUÉM CONFERIU, e o botão some depois:
                    o banco recusa de qualquer jeito, e oferecer o que ele
                    recusa ensina a desconfiar do botão. */}
                {nota.status === "enviada" ? (
                  <ConfirmDialog
                    title="Apagar esta nota?"
                    description={`A nota de ${mesPorExtenso(nota.competencia)} sai daqui e você pode enviar outra para o mesmo mês.`}
                    confirmLabel="Apagar"
                    destructive
                    onConfirm={async () => {
                      const r = await chamarEMostrar(() => apagarNota(nota.id));
                      if (r?.ok) router.refresh();
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Apagar a nota de ${mesPorExtenso(nota.competencia)}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar nota fiscal</DialogTitle>
            <DialogDescription>
              O sócio é avisado assim que ela chega, e você acompanha o pagamento por aqui.
              {/* QUANDO O MÊS ESCOLHIDO TEM UMA RECUSADA, o diálogo diz o que
                  vai acontecer com ela. Derivado do mês escolhido, nunca um
                  segundo estado: trocar o mês no seletor troca a frase. */}
              {recusadaDoMesEscolhido ? (
                <>
                  {" "}
                  A recusada de {mesPorExtenso(recusadaDoMesEscolhido.competencia)} continua
                  visível com o motivo até esta ser aprovada — aí ela sai da lista.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nf-mes">Mês a que a nota se refere</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger
                  id="nf-mes"
                  aria-label="Mês a que a nota se refere"
                  className="mt-1.5 w-full"
                >
                  <SelectValue placeholder="Escolha o mês" />
                </SelectTrigger>
                <SelectContent>
                  {oferecidos.map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* A COMPETÊNCIA NÃO É A DATA DE EMISSÃO, e a frase existe porque
                  a nota de setembro costuma ser emitida em outubro. */}
              <p className="text-muted-foreground mt-1 text-xs">
                O mês do trabalho, não o dia em que a nota foi emitida.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nf-valor">Valor</Label>
                <Input
                  id="nf-valor"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="4.250,00"
                  inputMode="decimal"
                  className="mt-1.5 tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="nf-numero">Número da nota</Label>
                <Input
                  id="nf-numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="opcional"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nf-arquivo">Arquivo da nota</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="nf-arquivo"
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={subindo || !mes}
                  onChange={(e) => subir(e.target.files?.[0])}
                />
                {subindo ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              </div>
              {arquivo ? (
                <p className="text-success mt-1 text-xs">Anexado: {arquivo.nome}</p>
              ) : (
                <p className="text-muted-foreground mt-1 text-xs">
                  PDF ou imagem. Só você e o sócio conseguem abrir.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="nf-obs">Observações</Label>
              <Textarea
                id="nf-obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Algo que o sócio precise saber para conferir."
                className="mt-1.5"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={salvando || subindo || !mes}>
              {salvando ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
