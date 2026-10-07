"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Eraser, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { chamarAcao } from "@/lib/acoes/cliente";

import {
  apagarMesDeSocial,
  arquivarMesDeSocial,
  limparPostsDoMes,
  oQueVaiComOMes,
} from "./acoes";

type Contagem = {
  posts: number;
  enviados: number;
  aprovados: number;
  versoes: number;
  etapas: number;
  marcacoes: number;
  comentarios: number;
};

/**
 * Encerrar o mês de social: arquivar, limpar os posts, ou apagar tudo.
 *
 * ---------------------------------------------------------------------------
 * **AS QUATRO AÇÕES EXISTIAM E NINGUÉM AS CHAMAVA.**
 *
 * `apagar_mes_de_social()`, `limpar_posts_do_mes()`, `o_que_vai_com_o_mes()` e
 * o carimbo `tasks.arquivada_em` nasceram todos na migration 0086, por decisão
 * do usuário — *"gostaria que desse pra deletar tudo que eu montei do mês,
 * caso tenha errado"*. As quatro Server Actions foram escritas no mesmo dia, e
 * o cabeçalho daquela migration afirma em quantas palavras que existem **duas
 * portas** para o mesmo estrago: *"o botão do Social Media e o 'Excluir task'
 * do board"*.
 *
 * **A primeira nunca existiu.** Só o diálogo do board foi construído, e a
 * frase dele até aponta para cá — *"a contagem exata fica no diálogo do Social
 * Media"*. Quem abria o mês para desfazer uma montagem errada não encontrava
 * botão nenhum, e o caminho que sobrava era apagar post a post, que é
 * exatamente o que o pedido existia para resolver.
 *
 * **É a décima segunda ponte construída e não atravessada deste produto**, e a
 * mais caríssima delas até aqui: as outras onze eram colunas esperando uma
 * tela; esta era uma tela esperando um botão, com a tela e a regra inteiras
 * prontas. Nenhuma varredura pega isto — `check:tipos` liga a migration ao
 * tipo, `check:fronteira` liga servidor a cliente, e nenhum dos dois pergunta
 * se uma action exportada tem chamador.
 * ---------------------------------------------------------------------------
 *
 * **ELA MORA NO FIM DA TELA, e não na barra ao lado de "+ Novo post".** É a
 * decisão do detalhe da Task, palavra por palavra: *"excluir não é
 * propriedade, é ação sobre a demanda — vai para o fim da página, que é onde
 * se procura o que encerra alguma coisa"*. Na barra, um botão que apaga
 * dezoito peças dividiria a linha com o botão que cria uma, na faixa onde a
 * pessoa clica sem olhar.
 *
 * **E SÃO TRÊS SAÍDAS porque a recusa do banco oferece três.** Quando alguma
 * peça já foi ao cliente, `tasks_apaga_o_social` recusa e a dica nomeia as
 * outras duas — arquivar, ou limpar só os posts. Uma tela com um botão só
 * mandaria a pessoa ler a recusa e procurar sozinha onde fazer o que ela
 * acabou de sugerir.
 *
 * | A saída | Para quem | Desfaz? |
 * | --- | --- | --- |
 * | Arquivar | o mês acabou e polui a navegação | sim, é carimbo |
 * | Limpar os posts | errou a grade, acertou os responsáveis e as datas | não |
 * | Apagar o mês | errou a montagem inteira | não |
 */
export function AcoesDoMes({
  taskId,
  rotulo,
  arquivadaEm,
}: {
  taskId: string;
  /** "Social · Outubro de 2026 de Mundo Verde" — o que a confirmação nomeia. */
  rotulo: string;
  arquivadaEm: string | null;
}) {
  const router = useRouter();
  const arquivado = Boolean(arquivadaEm);

  return (
    <section
      className="border-border mt-8 space-y-3 border-t pt-6"
      aria-labelledby="encerrar-o-mes"
    >
      <div>
        <h2 id="encerrar-o-mes" className="text-text-primary text-sm font-semibold">
          Encerrar o mês
        </h2>
        <p className="text-text-muted mt-0.5 text-xs">
          {arquivado
            ? "Este mês está fora da navegação padrão. Nada foi apagado."
            : "Arquivar tira o mês da navegação e não apaga nada. As outras duas não têm volta."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* ARQUIVAR É O ÚNICO QUE SE DESFAZ, e por isso ele não é
            `destructive` nem pede o nome digitado: tratar de igual para igual
            um carimbo reversível e o apagamento de sessenta peças é o que
            ensina a clicar em "Confirmar" sem ler. */}
        <ConfirmDialog
          title={arquivado ? "Trazer este mês de volta?" : "Arquivar este mês?"}
          description={
            arquivado
              ? "Ele volta a aparecer no índice do Social, junto com os meses em produção."
              : "Ele sai do índice do Social e continua inteiro — os posts, as artes e as aprovações ficam onde estão. Dá para trazer de volta depois."
          }
          confirmLabel={arquivado ? "Trazer de volta" : "Arquivar"}
          onConfirm={async () => {
            const resultado = await chamarAcao(() =>
              arquivarMesDeSocial(taskId, !arquivado),
            );
            if (!resultado.ok) toast.error(resultado.error);
            else {
              toast.success(resultado.mensagem);
              router.refresh();
            }
          }}
          trigger={
            <Button variant="outline" size="sm">
              {arquivado ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {arquivado ? "Trazer o mês de volta" : "Arquivar o mês"}
            </Button>
          }
        />

        <DialogoDeApagar modo="posts" taskId={taskId} rotulo={rotulo} />
        <DialogoDeApagar modo="tudo" taskId={taskId} rotulo={rotulo} />
      </div>
    </section>
  );
}

/**
 * O diálogo que CONTA antes, nos dois modos.
 *
 * **A CONTAGEM É BUSCADA NA ABERTURA, e não quando a tela monta.** É o
 * argumento que o diálogo do board escreveu para não trazê-la: buscá-la ao
 * montar custaria uma consulta em toda abertura do mês de social — que é a
 * tela mais aberta do módulo — para uma frase que quase nenhuma delas mostra.
 * Aqui ela é o conteúdo do diálogo, então ela chega quando ele abre.
 *
 * **E ela CONTA em vez de perguntar "tem certeza?"**, que é a decisão do
 * diálogo de apagar campanha: *"'Apagar esta campanha?' não informa nada; a
 * contagem é a única coisa que faz alguém parar"*. Por isso ela nomeia as
 * peças já aprovadas pelo cliente à parte, em âmbar — é esse número que
 * decide se a pessoa continua, e é ele que o banco vai usar para recusar.
 *
 * **O NOME DIGITADO É SÓ DO MODO "TUDO".** Limpar os posts preserva a demanda,
 * as fases, os responsáveis e as datas — é o desfazer de quem errou a grade,
 * e cobrar a digitação dele seria cobrar do caso mais provável a cerimônia do
 * mais raro. Apagar o mês inteiro leva tudo, e é a mesma trava do diálogo de
 * campanha.
 */
function DialogoDeApagar({
  modo,
  taskId,
  rotulo,
}: {
  modo: "tudo" | "posts";
  taskId: string;
  rotulo: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [digitado, setDigitado] = useState("");
  const [executando, setExecutando] = useState(false);

  const ehTudo = modo === "tudo";
  const liberado = !ehTudo || digitado.trim() === rotulo;

  async function abrir(proximo: boolean) {
    setAberto(proximo);
    if (!proximo) {
      setDigitado("");
      setErro(null);
      return;
    }

    setContagem(null);
    setErro(null);
    const resultado = await chamarAcao(() => oQueVaiComOMes(taskId));
    if (!resultado.ok) setErro(resultado.error);
    else setContagem(resultado.dados ?? null);
  }

  async function confirmar() {
    if (!liberado || executando) return;
    setExecutando(true);
    try {
      const resultado = await chamarAcao(() =>
        ehTudo ? apagarMesDeSocial(taskId) : limparPostsDoMes(taskId),
      );
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.mensagem);
      setAberto(false);
      setDigitado("");
      // APAGADO O MÊS INTEIRO, ESTA TELA DEIXOU DE EXISTIR: a demanda sumiu e
      // `?mes=` aponta para nada. Ela volta para o índice, que é o estado sem
      // `mes` nem `cliente` — ficar aqui deixaria a pessoa olhando uma lista
      // vazia sem nada dizendo que foi ela quem a esvaziou.
      if (ehTudo) router.push("/painel/social-media?aba=social");
      else router.refresh();
    } finally {
      setExecutando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      {/* `DialogTrigger` e não um `<Button onClick>` solto: com o `open`
          controlado as duas formas abrem, e só esta carrega o
          `aria-haspopup`/`aria-expanded` que o leitor de tela usa para dizer
          que o botão abre um diálogo. O `onOpenChange` é quem busca a
          contagem, então o clique não precisa fazer nada além de abrir. */}
      <DialogTrigger asChild>
        <Button
          variant={ehTudo ? "ghost" : "outline"}
          size="sm"
          className={ehTudo ? "text-destructive" : undefined}
        >
          {ehTudo ? <Trash2 aria-hidden /> : <Eraser aria-hidden />}
          {ehTudo ? "Apagar o mês inteiro" : "Apagar só os posts"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {ehTudo ? "Apagar este mês de social?" : "Apagar os posts deste mês?"}
          </DialogTitle>
          <DialogDescription>
            {ehTudo
              ? "A demanda do mês vai junto, com as fases e tudo o que foi distribuído. Não dá para desfazer."
              : "A demanda, as fases, os responsáveis e as datas ficam de pé — só as peças somem. É o caminho de quem errou a grade e acertou o resto."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {erro ? (
            <p className="text-destructive">{erro}</p>
          ) : !contagem ? (
            <p className="text-text-muted flex items-center gap-2">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Contando o que sai junto…
            </p>
          ) : contagem.posts === 0 ? (
            <p className="text-text-muted">
              Este mês não tem nenhuma peça.{" "}
              {ehTudo
                ? "O que sai é a demanda dele e as fases que você distribuiu."
                : "Não há o que limpar."}
            </p>
          ) : (
            <>
              <p className="text-text-primary">
                Saem <strong>{contagem.posts}</strong>{" "}
                {contagem.posts === 1 ? "peça" : "peças"}, com{" "}
                {contagem.versoes} {contagem.versoes === 1 ? "versão" : "versões"} e as
                artes {contagem.versoes === 1 ? "dela" : "delas"},{" "}
                {contagem.comentarios}{" "}
                {contagem.comentarios === 1 ? "comentário" : "comentários"} e{" "}
                {contagem.marcacoes}{" "}
                {contagem.marcacoes === 1 ? "marcação" : "marcações"} de progresso.
                {ehTudo ? (
                  <>
                    {" "}
                    A demanda do mês e{" "}
                    {contagem.etapas === 1 ? "a fase dela" : `as ${contagem.etapas} fases dela`}{" "}
                    {contagem.etapas === 1 ? "vai" : "vão"} junto.
                  </>
                ) : (
                  <>
                    {" "}
                    {contagem.etapas === 1 ? "A fase do mês fica" : `As ${contagem.etapas} fases do mês ficam`}{" "}
                    de pé, com o responsável e as datas de cada uma.
                  </>
                )}
              </p>

              {/* ESTE NÚMERO É O QUE O BANCO VAI USAR PARA RECUSAR, e por isso
                  ele é uma linha própria em vez de um item da frase acima: o
                  trigger recusa quando alguma peça já foi ao cliente, e quem
                  lê "18 peças" sem este destaque clica e leva uma recusa que
                  parece um defeito da tela.

                  `--warning` e nunca `--danger`: material que o cliente viu
                  não é um erro, é o estado normal de um mês em andamento. */}
              {contagem.enviados > 0 ? (
                <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-xs">
                  <strong>{contagem.enviados}</strong>{" "}
                  {contagem.enviados === 1 ? "peça já foi" : "peças já foram"} ao cliente
                  {contagem.aprovados > 0 ? (
                    <>
                      , e {contagem.aprovados}{" "}
                      {contagem.aprovados === 1 ? "foi aprovada" : "foram aprovadas"} por
                      ele
                    </>
                  ) : null}
                  . O banco recusa apagar um mês nesse estado — arquive, para tirá-lo da
                  navegação sem destruir nada.
                </p>
              ) : null}
            </>
          )}

          {/* O NOME SÓ É PEDIDO QUANDO HÁ O QUE PERDER. Num mês sem peça
              nenhuma — o caso de quem abriu errado e desfez em seguida — a
              digitação cobraria cerimônia por uma linha vazia. */}
          {ehTudo && contagem && contagem.posts > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="confirmar-apagar-o-mes">
                Digite <span className="font-mono font-semibold">{rotulo}</span> para
                confirmar
              </Label>
              <Input
                id="confirmar-apagar-o-mes"
                value={digitado}
                onChange={(evento) => setDigitado(evento.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => abrir(false)} disabled={executando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={
              !contagem ||
              executando ||
              (!ehTudo && contagem.posts === 0) ||
              (ehTudo && contagem.posts > 0 && !liberado)
            }
          >
            {executando ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {ehTudo ? "Apagar o mês" : "Apagar os posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
