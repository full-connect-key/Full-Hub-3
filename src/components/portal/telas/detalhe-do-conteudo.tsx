import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { AndamentoDoMaterial } from "@/components/portal/andamento-do-material";
import { DecisoesDoConteudo } from "@/components/portal/decisoes-do-conteudo";
import { HistoricoDeVersoes } from "@/components/portal/historico-de-versoes";
import { TextoDoConteudo } from "@/components/portal/texto-do-conteudo";
import { ThreadDeComentarios } from "@/components/portal/thread-de-comentarios";
import { VisualizadorDeArte } from "@/components/portal/visualizador-de-arte";
import { StatusBadge } from "@/components/shared/status-badge";
import type {
  ComentarioDoConteudo,
  VersaoDoConteudo,
} from "@/lib/dados/conteudo";
import type { Conteudo } from "@/lib/aprovacoes/conteudo";
import type { ContentStatus } from "@/lib/supabase/database.types";

/**
 * A tela em que o cliente decide sobre UM material.
 *
 * **É uma só, e serve o post e o entregável de campanha.** A razão é a de
 * sempre neste produto: duas telas que fazem a mesma coisa divergem na
 * primeira mudança, e aqui a divergência apareceria no lugar mais caro, que é
 * o botão de aprovar.
 *
 * **O que é compartilhado é a CASCA; o que muda é o modelo.** Cada módulo lê
 * as tabelas dele — post e `posts`, entregável e `deliverables` — e monta este
 * objeto. Tentar compartilhar também a leitura levaria a um `if tipo ===` no
 * meio de cada consulta, que é a duplicação de volta com outro nome.
 *
 * A ordem é a ordem da decisão: arte grande, propriedades, texto, e só então
 * os botões. Botão antes da arte convida a aprovar sem olhar — e o material
 * que volta "aprovado sem ninguém ter visto" é o retrabalho mais caro.
 */
export type ModeloDoConteudo = {
  conteudo: Conteudo;
  titulo: string;
  /** A linha embaixo do título: data e hora, ou a linhagem na campanha. */
  linhaDeContexto: string | null;
  status: ContentStatus;
  /** Um selo antes do status — a rede social, no caso do post. */
  selo?: React.ReactNode;
  propriedades: { rotulo: string; valor: string }[];
  /**
   * "Legenda" no post, "Descrição" no entregável.
   *
   * `titulo` é o cabeçalho da seção e o rótulo do histórico de versões;
   * `rotulo` é a mesma palavra em minúscula, que entra no meio das frases
   * ("Copiar legenda", "Ler a descrição inteira").
   */
  texto: { titulo: string; rotulo: string; corpo: string | null };
  /**
   * O texto fica AO LADO da arte, e não abaixo dela (decisão do usuário:
   * *"quero que na visualização do cliente, a legenda apareça ao lado da
   * imagem, para deixar o mais próximo do instagram possível"*).
   *
   * **É uma bandeira do modelo e não o padrão da casca**, porque a razão dela
   * é do POST e não do material em geral: um post é uma arte quadrada com uma
   * legenda ao lado, que é exatamente o arranjo que o cliente vai ver quando
   * a peça for ao ar — e conferir a legenda contra a arte é a decisão que ele
   * veio tomar. O entregável de campanha é um PDF de impressão ou um AI
   * aberto, e a descrição dele é uma instrução de produção: espremê-la numa
   * coluna de 340px ao lado de uma lâmina A5 deitada tira largura da peça
   * para dar a um texto que não se lê em paralelo com ela.
   */
  textoAoLado?: boolean;
  /**
   * O aviso acima do material, quando o que saiu NÃO é o material pronto.
   *
   * ------------------------------------------------------------------------
   * Ele nasceu com o portão do meio da corrente do social (migration 0076):
   * numa conta que aprova a pauta, o primeiro material que chega ao cliente é
   * um parágrafo de texto, semanas antes de existir arte. Sem esta linha a tela
   * abriria igual à de sempre — moldura de arte, legenda, dois botões — e a
   * pessoa aprovaria sem saber o que estava aprovando.
   *
   * **E ele decide se a moldura de arte aparece:** com aviso e sem arte, o
   * quadro é omitido. Aquele quadro diz *"este material ainda não tem arte
   * anexada"*, que é verdade e lê como defeito — e ocupa a primeira dobra
   * inteira para dizer que não há nada ali. Sem o aviso, a moldura fica: aí a
   * ausência de arte É uma falta, e esconder o quadro esconderia a falta.
   * ------------------------------------------------------------------------
   */
  aviso?: string | null;
  /**
   * UM FATO BOM SOBRE A PEÇA, ao lado do status (migration 0111).
   *
   * ------------------------------------------------------------------------
   * Hoje há um: o post já programado na rede. Ele NÃO cabe em `aviso` por
   * duas razões, e as duas são mecânicas antes de serem de tom: `aviso` é
   * `--warning`, que diz "falta um passo" — e aqui não falta nenhum —, e é
   * ele que decide se a moldura de arte aparece, então um aviso numa peça sem
   * arte esconderia a moldura que diz que a arte está faltando.
   *
   * **E ele vem DEPOIS do status, não antes.** Os dois não se repetem: o
   * status é o ciclo com o cliente ("Aprovado" — ele decidiu), e este é o que
   * a agência fez depois da decisão. Lido antes, ele pareceria o estado da
   * peça, e aí a tela teria dois.
   *
   * **O entregável de campanha não preenche este campo**, e a ausência é
   * decisão: a peça de campanha não é agendada em rede nenhuma — ela vai para
   * a gráfica ou para o cliente. É `React.ReactNode` e não `string` pela razão de
   * `selo`: quem sabe desenhar o fato é quem o tem.
   * ------------------------------------------------------------------------
   */
  confirmacao?: React.ReactNode;
  /** A peça, em ordem. Um entregável tem uma; um carrossel tem as que o
   *  cliente vai percorrer antes de decidir — e decidir sobre a primeira,
   *  quando há cinco, é decidir sobre um quinto do material. */
  artes: string[];
  versaoAtual: number;
  rodadaPendenteId: string | null;
  decididoPor: string | null;
  decididoEm: string | null;
  /**
   * QUANDO O MATERIAL CHEGOU PARA O CLIENTE — `enviado_em`.
   *
   * **Ele data o primeiro passo da escada de andamento**, e é o único instante
   * desta tela que não vem de uma rodada. Cada módulo o lê da tabela dele:
   * `posts.enviado_em` e `deliverables.enviado_em` — a casca não sabe de qual
   * das duas, que é a razão de ele ser campo do modelo e não parâmetro.
   *
   * Nulo é possível e não é defeito: o material pode ter sido carimbado antes
   * de a coluna existir. O passo aparece cumprido, sem hora — porque tudo o
   * que o cliente enxerga foi enviado (as duas policies exigem `enviado_em`).
   */
  recebidoEm: string | null;
  /**
   * Quando a decisão desta rodada foi pedida — `approval_rounds.solicitado_em`.
   *
   * **Pendente ou decidida**: é ela que data o passo "Enviado para a sua
   * decisão", e numa peça já aprovada esse passo é justamente o que alguém
   * volta aqui para conferir — quanto tempo a decisão levou.
   */
  decisaoPedidaEm: string | null;
  /**
   * O arquivo para baixar, quando existe um.
   *
   * **A escolha de resolução não está aqui, e não é esquecimento** — ela é de
   * outro momento do produto. O que existe hoje é o arquivo como ele foi
   * enviado, que é o que resolve o caso mais comum: a pessoa quer mandar a
   * arte para alguém que não tem acesso ao portal.
   */
  download: { href: string; nome: string } | null;
  voltar: { href: string; rotulo: string };
  vizinhos: { anterior: string | null; proximo: string | null };
  /** O rótulo acessível da navegação entre irmãos. */
  rotuloDosVizinhos: string;
};

export function DetalheDoConteudo({
  modelo,
  versoes,
  comentarios,
  artes,
  agora,
  nomeDaEmpresa,
  comoEquipe,
}: {
  modelo: ModeloDoConteudo;
  versoes: VersaoDoConteudo[];
  comentarios: ComentarioDoConteudo[];
  /** Endereços já assinados, por caminho. */
  artes: Record<string, string>;
  agora: string;
  nomeDaEmpresa: string;
  comoEquipe: boolean;
}) {
  /**
   * HÁ ALGO PARA MOSTRAR NO LUGAR DA PEÇA?
   *
   * A regra é a do campo `aviso`, e ela não muda: com aviso e sem arte, a
   * moldura é omitida — ela diz *"este material ainda não tem arte anexada"*,
   * que é verdade e lê como defeito, e ocuparia a primeira dobra inteira para
   * informar que não há nada ali. Sem o aviso a moldura fica: aí a ausência de
   * arte É uma falta, e esconder o quadro esconderia a falta.
   */
  const temPreview = modelo.artes.length > 0 || !modelo.aviso;

  /**
   * O TEXTO APARECE UMA VEZ SÓ, e em um de três lugares — o que decide é o que
   * ele É naquele material: a legenda ao lado da arte (post), a peça inteira
   * quando não há arte (o portão do meio), ou uma instrução de produção em
   * largura inteira (entregável de campanha).
   */
  const textoNaColunaEstreita = modelo.textoAoLado === true && temPreview;

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------- cabeçalho -- */}
      <div className="space-y-4">
        <Link
          href={modelo.voltar.href}
          className="text-text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {modelo.voltar.rotulo}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {modelo.selo}
              <StatusBadge status={modelo.status} />
              {modelo.confirmacao}
            </div>
            <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">{modelo.titulo}</h1>
            {modelo.linhaDeContexto ? (
              <p className="text-text-muted text-sm">
                {modelo.linhaDeContexto}
              </p>
            ) : null}
          </div>

          {/* NAVEGAÇÃO ENTRE IRMÃOS: quem entra para aprovar raramente aprova
              um só. Voltar à lista a cada peça é o atrito que faz a pessoa
              deixar os outros para depois. */}
          <nav aria-label={modelo.rotuloDosVizinhos} className="flex gap-2">
            <Vizinho href={modelo.vizinhos.anterior} rotulo="Material anterior">
              <ChevronLeft aria-hidden className="size-4" />
            </Vizinho>
            <Vizinho href={modelo.vizinhos.proximo} rotulo="Próximo material">
              <ChevronRight aria-hidden className="size-4" />
            </Vizinho>
          </nav>
        </div>
      </div>

      {/* ---------------------------------------------- a peça e o andamento --
          DUAS COLUNAS, e a estreita fica à DIREITA — que é a regra escrita do
          produto: a coluna de 340px vai à direita quando ela é um RESUMO, e à
          esquerda quando ela é um ÍNDICE. Aqui ela acompanha o que a pessoa
          veio fazer (em que pé está, qual o prazo, de que campanha é), e quem
          decide é a peça: ela fica na coluna larga, que é onde a decisão
          acontece.

          **E A SEÇÃO "Informações" DEIXOU DE EXISTIR como faixa própria.** As
          cinco linhas dela — campanha, frente, arquivo, versão, prazo —
          moraram numa faixa de largura inteira abaixo da arte, e quem está
          decidindo consulta aquilo JUNTO com o andamento: "esperando desde o
          dia 12" e "prazo dia 14" são a mesma pergunta partida em dois
          lugares da página. Elas são a metade de baixo do cartão de
          andamento.

          A LEGENDA CONTINUA AO LADO DA ARTE no post, e é a decisão do usuário
          que não se desfaz aqui: *"quero que na visualização do cliente, a
          legenda apareça ao lado da imagem, para deixar o mais próximo do
          instagram possível"*. Ela é o primeiro cartão da coluna estreita,
          acima do andamento — a conferência que a pessoa veio fazer é o texto
          contra a arte, e o andamento é consulta. A explicação inteira está em
          `textoAoLado`, lá em cima. */}
      {/* O AVISO VEM ANTES DO MATERIAL, e não entre ele e os botões: é a
          frase que diz o que está sendo decidido, e ela só serve se for lida
          ANTES. `--warning` e nunca `--danger` — não há erro nenhum aqui, há
          um passo do caminho. */}
      {modelo.aviso ? (
        <p className="bg-warning-soft text-warning rounded-lg px-3.5 py-2.5 text-sm font-semibold">
          {modelo.aviso}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {temPreview ? (
            <section
              aria-labelledby="previa-do-material"
              className="bg-surface-card rounded-card shadow-cartao space-y-3.5 border p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id="previa-do-material"
                  className="text-text-secondary text-[11px] font-semibold tracking-wide uppercase"
                >
                  Prévia
                </h2>
                {/* "DE N" SÓ QUANDO O TOTAL FECHA COM O NÚMERO DA VERSÃO.
                    `versaoAtual` é um contador da linha e `versoes` é o que o
                    cliente consegue LER — e os dois divergem: a peça pode ter
                    sido reenviada sem versão nova, e a imagem do protótipo
                    saiu dizendo "versão 3 de 2", que é uma contagem que
                    ninguém consegue conferir. Sem o total, "versão 3" continua
                    verdadeiro e não promete um histórico que a tela não tem —
                    e quem quer o histórico tem o botão logo abaixo, com a
                    contagem dele. */}
                {versoes.length >= modelo.versaoAtual ? (
                  <p className="text-text-muted text-xs tabular-nums">
                    versão {modelo.versaoAtual} de {versoes.length}
                  </p>
                ) : versoes.length > 0 ? (
                  <p className="text-text-muted text-xs tabular-nums">
                    versão {modelo.versaoAtual}
                  </p>
                ) : null}
              </div>

              <VisualizadorDeArte
                imagens={modelo.artes}
                alt={`Arte de ${modelo.titulo}`}
              />
            </section>
          ) : (
            /* SEM PREVIEW, O TEXTO É A PEÇA. É o portão do meio da corrente
               (0076): numa conta que aprova a pauta, o que chegou ao cliente é
               um parágrafo, e ele ocupa a coluna da decisão porque ele É o que
               está sendo decidido. */
            <Texto texto={modelo.texto} />
          )}

          {/* OS BOTÕES VÊM DEPOIS DA PEÇA, sempre — botão antes da arte
              convida a aprovar sem olhar, e o material que volta "aprovado sem
              ninguém ter visto" é o retrabalho mais caro. Eles ficam FORA do
              cartão da prévia: um cartão dentro de outro faz quem lê encontrar
              a caixa antes da ação. */}
          <DecisoesDoConteudo
            rodadaPendenteId={modelo.rodadaPendenteId}
            somenteLeitura={comoEquipe}
          />

          {modelo.download ? (
            <a
              href={modelo.download.href}
              download={modelo.download.nome}
              className="hover:bg-accent inline-flex min-h-9 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors"
            >
              <Download aria-hidden className="size-4" />
              Baixar arquivo
            </a>
          ) : null}
        </div>

        <div className="space-y-4">
          {textoNaColunaEstreita ? <Texto texto={modelo.texto} /> : null}

          <AndamentoDoMaterial
            status={modelo.status}
            recebidoEm={modelo.recebidoEm}
            decisaoPedidaEm={modelo.decisaoPedidaEm}
            decididoEm={modelo.decididoEm}
            decididoPor={modelo.decididoPor}
            propriedades={modelo.propriedades}
            agora={agora}
          />
        </div>
      </div>

      {/* A DESCRIÇÃO DO ENTREGÁVEL FICA EM LARGURA INTEIRA, e não na coluna de
          340px: ela é uma instrução de produção — a medida da lâmina, o papel,
          o que vai no verso —, e não uma legenda que se lê em paralelo com a
          arte. Espremê-la numa coluna estreita a quebra a cada três palavras. */}
      {!textoNaColunaEstreita && temPreview ? (
        <Texto texto={modelo.texto} />
      ) : null}

      <HistoricoDeVersoes
        versoes={versoes}
        artes={artes}
        versaoAtual={modelo.versaoAtual}
        rotuloDoTexto={modelo.texto.titulo}
      />

      <ThreadDeComentarios
        conteudo={modelo.conteudo}
        comentarios={comentarios}
        agora={agora}
        nomeDaEmpresa={nomeDaEmpresa}
        somenteLeitura={comoEquipe}
      />
    </div>
  );
}

/**
 * A legenda, a descrição, ou a pauta — num cartão.
 *
 * **Escrito uma vez e posicionado três**, porque as três posições são o MESMO
 * conteúdo em papéis diferentes. Três cópias do bloco divergiriam na primeira
 * mudança, e a que divergiria é a do portão do meio: a que aparece só nas
 * contas que aprovam a pauta antes da produção.
 */
function Texto({ texto }: { texto: ModeloDoConteudo["texto"] }) {
  return (
    <section className="bg-surface-card rounded-card shadow-cartao min-w-0 space-y-3 border p-4">
      <h2 className="text-text-secondary text-[11px] font-semibold tracking-wide uppercase">
        {texto.titulo}
      </h2>
      <TextoDoConteudo texto={texto.corpo} rotulo={texto.rotulo} />
    </section>
  );
}

function Vizinho({
  href,
  rotulo,
  children,
}: {
  href: string | null;
  rotulo: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      // RECUA PELO TOM E NÃO POR OPACIDADE: opacidade em texto dá uma cor
      // que ninguém mediu, e no tema escuro dá outra — a regra que o
      // `opacity-80` do `DateBadge` e as células do mês vizinho da faixa de
      // disponibilidade já pagaram duas vezes. `--text-muted` sobre `--muted`
      // está medido.
      <span
        aria-hidden
        className="bg-muted text-text-muted inline-flex size-9 items-center justify-center rounded-md border"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={rotulo}
      className="hover:bg-accent inline-flex size-9 items-center justify-center rounded-md border transition-colors"
    >
      {children}
    </Link>
  );
}

/** Formata uma data ISO para a linha de contexto, ou devolve o traço. */
export function dataLonga(iso: string | null): string {
  if (!iso) return "—";
  return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}
