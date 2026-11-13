"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CircleDashed,
  CircleHelp,
  Megaphone,
  Paperclip,
  Printer,
  Share2,
  Video,
  X,
} from "lucide-react";

import { abrirSolicitacao } from "@/app/(cliente)/portal/_actions/solicitacoes";
import { EditorDaComposicao } from "@/components/shared/editor-da-composicao";
import type { LinhaDaComposicao } from "@/lib/dominio/campanhas";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import { Button } from "@/components/ui/button";
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
import type { CampanhaParaEscolher } from "@/lib/dados/campanhas";
import {
  EXPLICACAO_DA_FRENTE,
  FRENTES_DA_SOLICITACAO,
  OPCAO_SEM_FRENTE,
  ROTULOS_DE_FRENTE,
  camposDoRoteiro,
  respostasQueFaltam,
} from "@/lib/dominio/solicitacoes";
import { vertentesParaEscolher, type Vertente } from "@/lib/dominio/vertentes";
import type {
  RequestType,
  SolicitacaoFrente,
} from "@/lib/supabase/database.types";

import { subirAnexoDoPedido } from "./subir-anexo";

/** O teto é do banco; a tela conta para não oferecer um caminho sem saída. */
const TETO_DE_ARQUIVOS = 10;

/** Os ícones que os tipos iniciais da 0068 pedem, pelo nome gravado. */
const ICONES = { Share2, Printer, Video, CircleHelp } as const;

/**
 * A ESCOLHA DE FRENTE TEM TRÊS VALORES E UM QUARTO ESTADO, e a diferença entre
 * os dois últimos é o que faz o terceiro cartão existir.
 *
 * `"social"` e `"campanha"` são o enum do banco. `"nenhuma"` é o terceiro
 * cartão — a pessoa DIZ que não é nem um nem outro —, e `null` é não ter
 * tocado em nada. **Os dois viajam como nulo**, então para o banco eles são a
 * mesma linha; para a TELA não são: com um estado só, o terceiro cartão
 * nasceria marcado, e *a opção pré-marcada é a que ninguém lê*. Um cartão que
 * já vem escolhido não diz nada sobre quem o escolheu.
 */
type EscolhaDeFrente = SolicitacaoFrente | "nenhuma";

/**
 * As três opções, na ordem em que elas aparecem.
 *
 * **O tipo é escrito e não inferido**, porque `[...FRENTES_DA_SOLICITACAO,
 * "nenhuma"]` infere `string[]` — e aí o terceiro deixaria de ser
 * distinguível de um valor de enum torto, que é o que a tupla do domínio
 * existe para travar. Com a anotação, acrescentar um valor ao enum do banco
 * acrescenta um cartão aqui sem uma linha de mudança, e um valor inventado não
 * compila.
 */
const OPCOES_DE_FRENTE: EscolhaDeFrente[] = [
  ...FRENTES_DA_SOLICITACAO,
  "nenhuma",
];

/**
 * O formulário de um pedido novo.
 *
 * ---------------------------------------------------------------------------
 * **A ORDEM É O QUE MAIS MUDOU, e ela é a resposta a *"gere um novo layout de
 * nova solicitação, de maneira que faça sentido e que fique o mais completo
 * possível"*.**
 *
 * Ele começava pela CLASSIFICAÇÃO — empresa, vertente, Social ou Campanha,
 * tipo de trabalho — e só no sexto campo perguntava o que a pessoa quer. Essa
 * é a ordem da AGÊNCIA: são as quatro perguntas de que a fila precisa para
 * encaminhar o pedido. A ordem de quem PEDE é a inversa: ela abriu o portal
 * porque precisa de uma coisa, e a primeira tela do pedido tem de ser sobre
 * essa coisa.
 *
 * São quatro seções numeradas, cada uma com uma pergunta:
 *
 *   1. **O que você precisa** — o nome, o texto livre e os anexos
 *   2. **Que tipo de trabalho é** — opcional, e é ela que acrescenta o roteiro
 *   3. **Onde isso entra** — empresa, vertente, Social/Campanha, campanha
 *   4. **Para quando** — a data desejada, com o que ela significa
 *
 * **E são numeradas pela razão escrita em `SecaoDoFormulario`:** o número dá à
 * conversa um jeito de apontar ("faltou a 3") sem descrever onde o campo está
 * na tela — e aqui a conversa com o Atendimento acontece na tela ao lado.
 * ---------------------------------------------------------------------------
 *
 * **NADA DE CATEGORIA É OBRIGATÓRIO, e isso é a reversão da 0124** — decisão
 * do usuário: *"não precisa ser social ou campanha necessariamente, o cliente
 * deve poder especificar o que ele quer sem colocar em alguma categoria,
 * podendo escrever caso ele queira"*. A frente ganhou um terceiro cartão, *Não
 * sei dizer*, que viaja como nulo; e o TIPO deixou de vir pré-selecionado.
 *
 * ***O que isso custa, e é dito em vez de escondido:*** sem um tipo escolhido
 * não há roteiro de briefing, e o argumento da 0068 — *"um campo de texto
 * livre chamado 'descreva o que você precisa' devolve 'uma arte pro insta', e
 * a primeira mensagem da conversa é sempre a mesma pergunta"* — continua
 * verdadeiro. Ele continua valendo para quem escolhe um tipo: as perguntas
 * aparecem no instante da escolha. O que o produto deixou de fazer é COBRAR
 * aquelas respostas de quem não quis classificar nada.
 *
 * **As perguntas vêm do banco** (`request_types.campos_json`) e não daqui: a
 * gestão edita o roteiro sem deploy, que é a mesma razão pela qual a
 * capacidade da equipe é coluna e não constante.
 */
export function FormularioDePedido({
  empresas,
  tipos,
  campanhas,
  vertentes,
  campanhaInicial,
  aoConcluir,
}: {
  empresas: { id: string; nome_empresa: string }[];
  tipos: RequestType[];
  /**
   * As campanhas abertas das empresas desta pessoa (0112).
   *
   * Elas chegam TODAS e a tela filtra pela empresa escolhida, em vez de uma
   * consulta por troca de empresa: quem responde por duas contas tem duas
   * listas curtas, e uma ida ao banco a cada clique no seletor de empresa
   * seria latência no meio de um formulário.
   */
  campanhas: CampanhaParaEscolher[];
  /**
   * As vertentes das empresas desta pessoa (0124, sobre a 0118).
   *
   * Chegam TODAS e a tela filtra pela empresa escolhida, pela razão das
   * campanhas: uma consulta por troca de empresa seria latência no meio de um
   * formulário. **E a desativada vem junto** — quem decide o que o seletor
   * oferece é `vertentesParaEscolher()`, do lado do domínio.
   */
  vertentes: Vertente[];
  /** A campanha que já vem escolhida, quando o pedido nasce de dentro de uma. */
  campanhaInicial?: string;
  /**
   * O que fazer depois de o pedido nascer.
   *
   * Sem ela o formulário leva para a tela do pedido recém-criado, que era o
   * certo quando ele morava numa ROTA própria: a pessoa saía de uma tela e
   * precisava chegar em alguma. Dentro do painel lateral ela não saiu de
   * lugar nenhum — a lista está atrás, com o pedido novo no topo —, e levá-la
   * para outra tela desfaria a razão de o painel existir.
   */
  aoConcluir?: (id: string) => void;
}) {
  const router = useRouter();
  const [executando, comecar] = useTransition();

  const [clienteId, setClienteId] = useState(empresas[0]?.id ?? "");
  /**
   * O TIPO NASCE VAZIO, e isso é a 0137.
   *
   * Ele era `tipos[0]?.id` — "Peça para redes" vinha marcado —, e com ele
   * vinham as duas perguntas obrigatórias daquele roteiro. Quer dizer que todo
   * pedido nascia classificado como peça para redes **sem ninguém ter
   * escolhido**, e que quem queria outra coisa tinha de desfazer uma escolha
   * que não fez. É a regra desta casa pela enésima vez: *a opção pré-marcada é
   * a que ninguém lê*.
   */
  const [tipoId, setTipoId] = useState<string>("");
  const [campanhaId, setCampanhaId] = useState<string>(campanhaInicial ?? "");
  /**
   * A FRENTE NASCE VAZIA, e o vazio agora é uma OPÇÃO e não uma lacuna.
   *
   * Na 0124 ela nascia assim porque a opção pré-marcada é a que ninguém lê, e
   * era obrigatória no envio. Depois da 0137 ela continua nascendo vazia pela
   * mesma razão, e o vazio deixou de ser cobrado.
   *
   * **E `null` NÃO é o terceiro cartão**, que foi o que a imagem pegou: com um
   * estado só, *Não sei dizer* nascia marcado — ou seja, era o padrão, que é
   * exatamente o que este comentário diz para não fazer. São dois estados
   * diferentes que viajam como o mesmo nulo: `null` é *não mexi nisso* e
   * `"nenhuma"` é *não é nem um nem outro*.
   *
   * **Menos quando o pedido nasce DENTRO de uma campanha:** ali a resposta já
   * está dada, e `client_requests_classificacao` recusaria qualquer outra —
   * inclusive a ausência, porque o ramo 3 compara com `is distinct from`.
   */
  const [frente, setFrente] = useState<EscolhaDeFrente | null>(
    campanhaInicial ? "campanha" : null,
  );
  const [vertenteId, setVertenteId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState("");
  /**
   * O PERÍODO E OS MATERIAIS DA CAMPANHA (0138).
   *
   * Decisão do usuário: *"pode deixar o cliente com a mesma visualização de
   * abrir campanha que o atendimento, para que ele envie para gente para
   * editarmos e abrirmos a task"*.
   *
   * **Os três só são desenhados na frente Campanha**, e é o ramo 5 de
   * `client_requests_classificacao` que recusa o contrário no banco. Eles
   * ficam no estado mesmo quando a seção sai da tela — quem marcou Campanha,
   * preencheu, e voltou para conferir o tipo de trabalho não perde o que
   * escreveu; quem TROCA de frente é que perde, e aí o `enviar` não os manda.
   */
  const [campanhaInicio, setCampanhaInicio] = useState("");
  const [campanhaFim, setCampanhaFim] = useState("");
  const [composicao, setComposicao] = useState<LinhaDaComposicao[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [arquivos, setArquivos] = useState<File[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  /**
   * A FRASE DO QUE FALTA SÓ APARECE DEPOIS DE ALGUÉM TENTAR ENVIAR.
   *
   * Sem isto ela nasce na tela: o formulário abre com os obrigatórios vazios,
   * e a primeira coisa que a pessoa lê é uma cobrança por não ter feito nada
   * ainda. É a mesma razão pela qual o alerta que está sempre aceso deixa de
   * ser alerta.
   */
  const [tentou, setTentou] = useState(false);

  /**
   * SÓ AS CAMPANHAS DA EMPRESA ESCOLHIDA, e a escolha se desfaz ao trocar.
   *
   * A 0112 recusa a campanha de outra empresa, então oferecê-la seria oferecer
   * um caminho que termina em recusa. E guardar a escolha anterior ao trocar de
   * empresa é pior que apagá-la: o `<Select>` ficaria com um valor que não está
   * mais na lista, mostrando o placeholder e enviando a campanha antiga.
   */
  const daEmpresa = campanhas.filter((c) => c.clientId === clienteId);
  const campanhaEscolhida = daEmpresa.some((c) => c.id === campanhaId)
    ? campanhaId
    : "";

  /**
   * AS VERTENTES DA EMPRESA ESCOLHIDA, e a escolha se desfaz ao trocar.
   *
   * É a mesma mecânica das campanhas, e pela mesma razão do banco: o trigger
   * da 0124 recusa a vertente de outra conta — "Institucional" existe em duas
   * empresas com ids diferentes, e guardar a escolha ao trocar de empresa
   * deixaria o `<Select>` com um valor fora da lista, mostrando o placeholder
   * e enviando a vertente antiga.
   */
  const vertentesDaEmpresa = vertentesParaEscolher(
    vertentes.filter((v) => v.client_id === clienteId),
    vertenteId,
  );
  const vertenteEscolhida = vertentesDaEmpresa.some((v) => v.id === vertenteId)
    ? vertenteId
    : "";

  /**
   * A CAMPANHA SÓ EXISTE NA FRENTE CAMPANHA, e trocar de lado a apaga.
   *
   * Sem a limpeza, quem escolhe uma campanha e volta para "Social" manda a
   * linha que o trigger recusa — *"Este pedido está numa campanha, então a
   * frente é Campanha"* —, e a recusa chegaria no clique de enviar, sobre um
   * campo que a tela já tinha escondido.
   */
  const campanhaValida = frente === "campanha" ? campanhaEscolhida : "";

  /**
   * A FRENTE CAMPANHA DESENHA DUAS SEÇÕES A MAIS (0138).
   *
   * Uma pergunta só, lida em quatro lugares — as duas seções, o período e a
   * composição no envio: duas comparações com `"campanha"` seriam duas
   * verdades sobre quando a tela é a de abrir campanha, e a que divergiria é
   * a do ENVIO, que não aparece em imagem nenhuma.
   */
  const ehCampanha = frente === "campanha";

  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const campos = camposDoRoteiro(tipo?.campos_json);
  /**
   * O QUE FALTA, e a frente NÃO está mais nesta lista (0137).
   *
   * **E o título entrou nela.** Ele era cobrado pelo `disabled` do botão —
   * `titulo.trim().length < 3` —, e o próprio arquivo escrevia o argumento
   * contra isso duas telas acima: *um botão desligado não tem como dizer por
   * que está desligado, e clicar nele é justamente o momento em que a pessoa
   * pede para saber o que falta*. Hoje o botão fica ligado e a frase nomeia o
   * que falta, que é a decisão da recusa da 0023.
   */
  const faltando = [
    ...(titulo.trim().length < 3 ? ["o nome do pedido"] : []),
    ...respostasQueFaltam(campos, respostas),
  ];

  function responder(chave: string, valor: string) {
    setRespostas((atual) => ({ ...atual, [chave]: valor }));
  }

  function enviar() {
    if (faltando.length > 0) {
      setTentou(true);
      return;
    }
    comecar(async () => {
      const r = await chamarEMostrar(() =>
        abrirSolicitacao({
          client_id: clienteId,
          request_type_id: tipoId || null,
          campaign_id: campanhaValida || null,
          // A FRENTE VIAJA COMO NULO nos DOIS estados sem lado — quem não
          // mexeu e quem disse "não sei". O enum tem dois valores, e a
          // terceira opção da tela é a ausência de um deles.
          frente: frente === "nenhuma" || frente === null ? null : frente,
          vertente_id: vertenteEscolhida || null,
          titulo,
          descricao,
          respostas,
          data_desejada: quando,
          // OS TRÊS SÓ VIAJAM NA FRENTE CAMPANHA, e a pergunta é a mesma que
          // desenha as duas seções: quem trocou de frente depois de
          // preencher não manda ao banco um período que a tela não mostra
          // mais — o ramo 5 do gatilho recusaria, e a recusa chegaria depois
          // do clique falando de uma seção que não está à vista.
          campanha_inicio: ehCampanha ? campanhaInicio : null,
          campanha_fim: ehCampanha ? campanhaFim : null,
          composicao: ehCampanha ? composicao : null,
        }),
      );
      if (!r.ok || !r.dados) return;

      // -----------------------------------------------------------------
      // O PEDIDO NASCE PRIMEIRO, E OS ARQUIVOS SOBEM DEPOIS.
      //
      // Não é escolha de estilo: o caminho no bucket leva o id do pedido, e
      // a policy do Storage confere a pasta da empresa — não há onde pôr o
      // arquivo antes de a linha existir. Guardá-los em memória até aqui é o
      // que permite o anexo na abertura, que é o pedido do usuário.
      //
      // **E uma falha de upload NÃO derruba o pedido.** Ele já está no
      // banco, e o Atendimento já foi avisado: descartar o texto que a
      // pessoa escreveu por causa de um arquivo que não subiu seria trocar
      // uma falha parcial por uma total. O que o aviso faz é NOMEAR o
      // arquivo que ficou de fora, e a tela do pedido — que abre no
      // instante seguinte — é onde ele entra.
      // -----------------------------------------------------------------
      for (const arquivo of arquivos) {
        const anexo = await subirAnexoDoPedido({
          clientId: clienteId,
          pedidoId: r.dados,
          arquivo,
        });
        if (!anexo.ok) {
          toast.error(
            `O pedido foi enviado, mas "${arquivo.name}" não subiu: ${
              anexo.erro ?? "tente anexar de novo na tela do pedido."
            }`,
          );
        }
      }

      // QUEM DECIDE O DESFECHO É QUEM ABRIU O FORMULÁRIO. No painel lateral
      // ele fecha e a lista atrás ganha a linha nova no topo; sem `aoConcluir`
      // — se um dia ele voltar a morar numa rota — o caminho é a tela do
      // pedido, que é onde se anexa mais arquivo e se conversa.
      if (aoConcluir) {
        aoConcluir(r.dados);
        return;
      }
      router.push(`/portal/solicitacoes/${r.dados}`);
    });
  }

  return (
    <div className="space-y-8">
      {/* ==================================================================
          1. O QUE VOCÊ PRECISA

          A PRIMEIRA SEÇÃO É SOBRE A COISA, e não sobre a classificação dela.
          Quem abre o portal para pedir uma arte tem a arte na cabeça, não a
          frente de produção — e o texto livre aqui é o *"podendo escrever
          caso ele queira"* do pedido: ele é o caminho principal, e sozinho já
          é um pedido inteiro.
          ================================================================== */}
      <SecaoDoFormulario numero={1} titulo="O que você precisa">
        <div className="space-y-1.5">
          <Label htmlFor="pedido-titulo">Em uma linha, o que é *</Label>
          <Input
            id="pedido-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Arte para o Dia das Mães"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pedido-descricao">Conte com as suas palavras</Label>
          {/* ROWS 5 E NÃO 3, e o rótulo deixou de ser "Mais alguma coisa".
              Aquele nome fazia dele um campo de sobra — o lugar do detalhe que
              não caiu em nenhuma pergunta. Com a classificação deixando de ser
              obrigatória, ele é o campo onde o pedido inteiro pode morar, e o
              tamanho da caixa é o que diz isso sem uma frase de ajuda. */}
          <Textarea
            id="pedido-descricao"
            rows={5}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que é, para que serve, onde vai ser usado, o que não pode faltar."
          />
        </div>

        {/* ---------------------------------------------------------------
            O ANEXO NA ABERTURA — decisão do usuário.

            **Ele existia só na tela do pedido JÁ CRIADO**, e a linha do pé
            deste formulário dizia isso em voz alta: "depois de enviar você pode
            anexar arquivos". Quem abre um pedido está com a referência na mão —
            o print, a foto do material, a arte do ano passado —, e mandá-la num
            segundo passo é mandá-la num passo que metade das pessoas não dá.

            **Os arquivos ficam em memória até o envio**, porque o caminho no
            bucket leva o id do pedido e ele ainda não existe. Por isso esta
            lista é uma lista de escolhas, e não de anexos: ninguém subiu nada
            ainda, e a tela não pode afirmar que subiu.

            **E ele mora na seção 1**, junto do texto: a referência é parte do
            que a pessoa quer, e não um apêndice do fim do formulário.
            --------------------------------------------------------------- */}
        <div className="space-y-2">
          <Label htmlFor="pedido-arquivos">Imagens e arquivos</Label>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={arquivos.length >= TETO_DE_ARQUIVOS}
              onClick={() => campo.current?.click()}
            >
              <Paperclip aria-hidden />
              Escolher arquivos
            </Button>

            <input
              ref={campo}
              id="pedido-arquivos"
              type="file"
              multiple
              // `sr-only` esconde da vista e NÃO da árvore de acessibilidade —
              // por isso o `aria-label`: sem ele o campo é anunciado como
              // "editar" e mais nada.
              aria-label="Escolher imagens e arquivos para anexar"
              className="sr-only"
              onChange={(e) => {
                const escolhidos = Array.from(e.target.files ?? []);
                // O CORTE AVISA, em vez de descartar calado: cada arquivo foi
                // escolhido por uma pessoa, e sumir com o décimo primeiro faria
                // ela achar que mandou o que não chegou. É a decisão do teto de
                // anexos do banco, que recusa em vez de cortar.
                const cabem = TETO_DE_ARQUIVOS - arquivos.length;
                if (escolhidos.length > cabem) {
                  toast.error(
                    `São até ${TETO_DE_ARQUIVOS} arquivos por pedido. Entraram os ${cabem} primeiros.`,
                  );
                }
                setArquivos((atual) => [...atual, ...escolhidos.slice(0, cabem)]);
                e.target.value = "";
              }}
            />

            <span className="text-muted-foreground text-xs">
              {arquivos.length} de {TETO_DE_ARQUIVOS}
            </span>
          </div>

          {arquivos.length > 0 ? (
            <ul className="space-y-1">
              {arquivos.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="bg-neutral-soft flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                >
                  <Paperclip
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <button
                    type="button"
                    aria-label={`Tirar ${a.name} da lista`}
                    className="text-muted-foreground hover:text-danger transition-colors"
                    onClick={() =>
                      setArquivos((atual) => atual.filter((_, j) => j !== i))
                    }
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            // A FRASE DEIXOU DE DIZER PARA QUE SERVE O ANEXO. Ela era "o que
            // ajudar a gente a entender o que você quer", e é o caso que o
            // usuário nomeou: *"esses textinhos parecem indiretas"*. O que
            // sobra é a lista das coisas que cabem ali.
            <p className="text-muted-foreground text-xs">
              Print, foto, a arte de referência, um PDF.
            </p>
          )}
        </div>
      </SecaoDoFormulario>

      {/* ==================================================================
          2. QUE TIPO DE TRABALHO É — e ela é OPCIONAL.

          **OS CARTÕES PERDERAM A LINHA DE BAIXO** — decisão do usuário:
          *"tire o texto abaixo que de que tipo de trabalho é, esses textinhos
          parecem indiretas não são legais"*. Eram as quatro frases de
          `request_types.descricao`, da 0068, e a quarta era literalmente isso:
          *"Não se encaixa nos anteriores — conte o que você precisa"*. A
          coluna fica gravada, sem leitor, carimbada pela 0137.

          **E NENHUM VEM MARCADO**, que é a outra metade da 0137: o tipo
          decide quais perguntas aparecem, e um tipo pré-marcado fazia o
          formulário cobrar as respostas de um trabalho que ninguém escolheu.
          ================================================================== */}
      <SecaoDoFormulario numero={2} titulo="Que tipo de trabalho é">
        {/* `role="radiogroup"` no invólucro porque os cartões são
            `role="radio"`: um radio sem o grupo por perto é um papel sem pai,
            e o leitor de tela anuncia "opção 1 de 1" em cada um deles. */}
        <div
          role="radiogroup"
          aria-label="Tipo de pedido"
          className="grid grid-cols-2 gap-2"
        >
          {tipos.map((t) => {
            const Icone = ICONES[t.icone as keyof typeof ICONES] ?? CircleHelp;
            const escolhido = t.id === tipoId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={escolhido}
                // CLICAR NO CARTÃO ESCOLHIDO O DESFAZ, e é o que faz o tipo
                // ser de verdade opcional: sem isso, quem clica por engano não
                // tem como voltar ao estado sem tipo — e volta a ser cobrado
                // pelas perguntas de um trabalho que não é o dele.
                onClick={() => setTipoId(escolhido ? "" : t.id)}
                className={
                  escolhido
                    ? "border-accent-strong bg-accent rounded-lg border p-3 text-left"
                    : "hover:bg-accent rounded-lg border p-3 text-left transition-colors"
                }
              >
                <Icone aria-hidden className="text-accent-strong mb-1 size-5" />
                <p className="text-sm font-medium">{t.nome}</p>
              </button>
            );
          })}
        </div>

        {/* ----------------------------------------------------------------
            O ROTEIRO DE BRIEFING (0068), e o título dele mudou.

            Ele era *"Para a gente não precisar perguntar depois"* — decisão do
            usuário: *"Mude a frase"*. Aquele título explicava por que a
            AGÊNCIA queria as respostas, o que é problema da agência, e lido do
            lado de fora soava como cobrança. O que ficou no lugar diz o que a
            seção é, e nada mais.

            **E ele só existe com um tipo escolhido**, o que depois da 0137 é
            uma escolha e não o padrão.
            ---------------------------------------------------------------- */}
        {campos.length > 0 ? (
          <section className="space-y-4 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Sobre este material</h3>

            {campos.map((c) => {
              const id = `roteiro-${c.chave}`;
              const valor = respostas[c.chave] ?? "";

              return (
                <div key={c.chave} className="space-y-1.5">
                  <Label htmlFor={id}>
                    {c.rotulo}
                    {c.obrigatorio ? " *" : ""}
                  </Label>

                  {c.tipo === "escolha" && c.opcoes?.length ? (
                    <Select
                      value={valor}
                      onValueChange={(v) => responder(c.chave, v)}
                    >
                      <SelectTrigger
                        aria-label={c.rotulo}
                        id={id}
                        className="w-full"
                      >
                        <SelectValue placeholder="Escolha" />
                      </SelectTrigger>
                      <SelectContent>
                        {c.opcoes.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : c.tipo === "texto_longo" ? (
                    <Textarea
                      id={id}
                      rows={3}
                      value={valor}
                      onChange={(e) => responder(c.chave, e.target.value)}
                    />
                  ) : (
                    <Input
                      id={id}
                      type={c.tipo === "data" ? "date" : "text"}
                      value={valor}
                      onChange={(e) => responder(c.chave, e.target.value)}
                    />
                  )}

                  {/* A AJUDA DE CADA CAMPO FICA, e a diferença com as frases
                      que saíram é o que ela faz: "Folder A5, banner de 2x1,
                      cartão de visita…" é um EXEMPLO do que cabe no campo, e
                      sem ele a pessoa não sabe em que forma responder. O que
                      saiu descrevia a categoria, que o nome do cartão já diz. */}
                  {c.ajuda ? (
                    <p className="text-muted-foreground text-xs">{c.ajuda}</p>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}
      </SecaoDoFormulario>

      {/* ==================================================================
          3. ONDE ISSO ENTRA — a classificação, agora toda opcional.
          ================================================================== */}
      <SecaoDoFormulario numero={3} titulo="Onde isso entra">
        {/* O SELETOR DE EMPRESA SÓ APARECE COM MAIS DE UMA. Com uma, ele é um
            campo com uma opção — a pessoa lê, pensa, e escolhe a única. */}
        {empresas.length > 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor="pedido-empresa">Para qual empresa</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger
                aria-label="Empresa"
                id="pedido-empresa"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* ----------------------------------------------------------------
            A VERTENTE VEM DEPOIS DA EMPRESA, e é a ordem da decisão: de qual
            conta, e de qual parte dela. Acima da empresa ela perguntaria sobre
            uma conta que ainda não foi escolhida — a mesma ordem do seletor da
            tela de task (0118).

            **E O CAMPO SÓ EXISTE QUANDO A CONTA TEM VERTENTE**, que é a
            maioria ao contrário: quase nenhuma tem. Um seletor
            permanentemente vazio pede uma escolha que não existe.
            ---------------------------------------------------------------- */}
        {vertentesDaEmpresa.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="pedido-vertente">De que parte da sua conta é</Label>
            <Select
              value={vertenteEscolhida || "nenhuma"}
              onValueChange={(v) => setVertenteId(v === "nenhuma" ? "" : v)}
            >
              <SelectTrigger
                aria-label="Vertente"
                id="pedido-vertente"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* "SEM VERTENTE" FICA COMO OPÇÃO, e não é indecisão: a reunião
                    mensal e o material institucional não pertencem a nenhuma
                    frente, e obrigar a escolha faria a pessoa marcar a primeira
                    da lista — que é pior que não classificar, porque o relatório
                    passaria a contá-la onde ela não está. É a decisão da 0118,
                    palavra por palavra. */}
                <SelectItem value="nenhuma">Não é de nenhuma em especial</SelectItem>
                {vertentesDaEmpresa.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                    {v.ativa ? "" : " (desativada)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* ----------------------------------------------------------------
            A CLASSIFICAÇÃO — e ela deixou de ser obrigatória (0137).

            **SÃO TRÊS CARTÕES E DOIS VALORES DE ENUM.** O terceiro,
            `OPCAO_SEM_FRENTE`, viaja como nulo: um valor "nenhuma" no enum
            poria no relatório da agência uma terceira categoria onde o que
            existe é a ausência de categoria.

            **E ELE É UM CARTÃO E NÃO UM CAMPO QUE SE PULA**, que é a decisão
            de *"Não é de nenhuma em especial"* no seletor de vertente: um
            formulário em que a classificação simplesmente não é cobrada deixa
            quem abre sem saber se esqueceu alguma coisa.

            **E SÃO CARTÕES e não um `<Select>`**, pela razão do seletor de
            redes do social: a frase que explica cada lado é o que faz a
            escolha não ser palpite, e num `<Select>` ela ficaria escondida
            atrás de um clique — justamente o clique da decisão. Eles empilham
            em vez de ficar lado a lado: no painel de 540px, três colunas
            dariam 150px para um ícone, um título e uma frase.
            ---------------------------------------------------------------- */}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">É para o quê</legend>
          <div
            role="radiogroup"
            aria-label="Social, Campanha, ou nenhum dos dois"
            className="grid gap-2"
          >
            {OPCOES_DE_FRENTE.map((f) => {
              // O ÍCONE DO TERCEIRO É UM CÍRCULO TRACEJADO, e não o
              // `CircleHelp` do tipo "Outro": o mesmo desenho para duas coisas
              // diferentes no mesmo formulário é o que faz alguém ler um pelo
              // outro. Tracejado é a forma de "ainda não definido".
              const Icone =
                f === "social"
                  ? Share2
                  : f === "campanha"
                    ? Megaphone
                    : CircleDashed;
              const rotulo =
                f === "nenhuma" ? OPCAO_SEM_FRENTE.rotulo : ROTULOS_DE_FRENTE[f];
              const explicacao =
                f === "nenhuma"
                  ? OPCAO_SEM_FRENTE.explicacao
                  : EXPLICACAO_DA_FRENTE[f];
              const escolhido = f === frente;
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={escolhido}
                  onClick={() => {
                    setFrente(f);
                    // SAIR DE CAMPANHA APAGA A CAMPANHA, senão o envio
                    // carregaria uma campanha num pedido que diz outra coisa —
                    // a contradição que o ramo 3 do gatilho recusa, e que
                    // depois da 0137 alcança também a frente em branco.
                    if (f !== "campanha") setCampanhaId("");
                  }}
                  className={
                    escolhido
                      ? "border-accent-strong bg-accent flex items-start gap-3 rounded-lg border p-3 text-left"
                      : "hover:bg-accent flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
                  }
                >
                  <Icone
                    aria-hidden
                    className="text-accent-strong mt-0.5 size-5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{rotulo}</span>
                    <span className="text-muted-foreground block text-xs">
                      {explicacao}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* ----------------------------------------------------------------
            A CAMPANHA SÓ EXISTE NA FRENTE CAMPANHA (0124): na frente Social
            não há campanha para escolher, e o trigger recusa a linha que tem
            as duas coisas.

            **E O CAMPO SÓ EXISTE QUANDO HÁ CAMPANHA ABERTA.** Um seletor com a
            única opção "Nenhuma" é um campo que a pessoa lê, pensa e deixa como
            está — a mesma razão pela qual o seletor de empresa só aparece com
            mais de uma. Quando a frente é Campanha e a conta não tem nenhuma
            aberta, o que aparece é a FRASE abaixo — o pedido chega antes de a
            campanha existir, que é o caso comum de quem pede uma ação nova.
            ---------------------------------------------------------------- */}
        {frente === "campanha" && daEmpresa.length === 0 ? (
          <p className="text-text-muted text-sm">
            Esta empresa não tem campanha aberta no momento — a gente organiza
            isso por aqui depois de ler o seu pedido.
          </p>
        ) : null}

        {frente === "campanha" && daEmpresa.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="pedido-campanha">De que campanha é</Label>
            <Select
              value={campanhaEscolhida || "nenhuma"}
              onValueChange={(v) => setCampanhaId(v === "nenhuma" ? "" : v)}
            >
              <SelectTrigger
                aria-label="Campanha"
                id="pedido-campanha"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* O VALOR VAZIO NÃO É ACEITO PELO `<Select>` do shadcn — ele
                    trata `""` como "sem valor" e volta ao placeholder. Então o
                    "nenhuma" é uma opção de verdade, traduzida para nulo no
                    envio: é o que permite DESFAZER a escolha, que um placeholder
                    não permite. */}
                <SelectItem value="nenhuma">Nenhuma, é um pedido solto</SelectItem>
                {daEmpresa.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </SecaoDoFormulario>

      {/* ==================================================================
          4. PARA QUANDO — e a frase embaixo FICA.

          Ela não é do grupo que saiu: *"É a data que ajudaria você — não é o
          prazo combinado"* não descreve uma categoria nem cobra nada, ela
          impede um mal-entendido caro. Um campo de data sem essa linha é lido
          como prazo acordado, e quem digita precisa saber disso ANTES de
          digitar — não no dia em que a peça não chegar.

          **E ela é uma SEÇÃO e não o último campo da terceira**, porque a
          pergunta é outra: as três de cima são sobre o trabalho, esta é sobre
          o calendário. Numerada, ela ganha o peso do campo do formulário que
          mais se interpreta errado.
          ================================================================== */}
      <SecaoDoFormulario numero={4} titulo="Para quando">
        {/* NA CAMPANHA A PERGUNTA É O PERÍODO, e não uma data (0138).

            As duas respondem a mesma coisa — quando isso tem de estar
            pronto —, e uma campanha tem começo e fim: é o que a abertura de
            campanha pergunta do outro lado. Desenhar as duas daria dois
            campos para o mesmo fato, e `data_desejada` é justamente a que o
            briefing lê como "o cliente gostaria para X". */}
        {ehCampanha ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pedido-campanha-inicio">
                  A campanha começa
                </Label>
                <Input
                  id="pedido-campanha-inicio"
                  type="date"
                  value={campanhaInicio}
                  onChange={(e) => setCampanhaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pedido-campanha-fim">e encerra</Label>
                <Input
                  id="pedido-campanha-fim"
                  type="date"
                  value={campanhaFim}
                  onChange={(e) => setCampanhaFim(e.target.value)}
                />
              </div>
            </div>
            {/* O PERÍODO INVERTIDO APARECE ANTES DO CLIQUE, e o `check` do
                banco é quem vale: é quase sempre um número trocado, e a
                recusa que chega depois do envio manda a pessoa procurar qual
                dos dois campos está errado. */}
            {campanhaInicio && campanhaFim && campanhaFim < campanhaInicio ? (
              <p className="text-warning text-sm" role="status">
                O encerramento está antes do início.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Não é o prazo combinado. A gente olha o pedido e responde por
              aqui com as datas que dá para assumir.
            </p>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="pedido-quando">A data que ajudaria você</Label>
            <Input
              id="pedido-quando"
              type="date"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className="w-full sm:w-52"
            />
            <p className="text-muted-foreground text-xs">
              Não é o prazo combinado. A gente olha o pedido e responde por
              aqui com a data que dá para assumir.
            </p>
          </div>
        )}
      </SecaoDoFormulario>

      {/* ==================================================================
          5. QUANTOS MATERIAIS DE CADA TIPO — só na frente Campanha (0138).

          **A SEÇÃO APARECE NO FIM e não no meio**, porque ela é a única que
          nasce e some: pondo-a antes de "Para quando", marcar Campanha
          renumeraria a seção que a pessoa acabou de ler. E ela é a mais
          detalhada das cinco, que é onde ela pertence numa lista que vai do
          que a pessoa quer até como isso se divide.

          **É O MESMO `EditorDaComposicao` DA ABERTURA DE CAMPANHA**, e o que
          não vem com ele é o rodapé: lá a lista MONTA A ÁRVORE, e a árvore é
          a distribuição de trabalho da agência — literalmente o que o cliente
          manda a gente fazer.
          ================================================================== */}
      {ehCampanha ? (
        <EditorDaComposicao
          numero={5}
          valor={composicao}
          onChange={setComposicao}
          explicacao="Se você já sabe, diga quantos de cada tipo a campanha precisa — dez estáticos, quinze stories. Dá para deixar em branco e combinar com a gente na conversa."
        />
      ) : null}

      {/* A FRASE NOMEIA O QUE FALTA, e não diz "preencha os obrigatórios".
          É a decisão da recusa da 0023, que conta quantas faltam e diz QUAIS:
          dizer o nome é a diferença entre um aviso e uma instrução. */}
      {tentou && faltando.length > 0 ? (
        <p className="text-warning text-sm" role="status">
          Falta preencher: {faltando.join(", ")}.
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={executando}
        >
          Cancelar
        </Button>
        <Button onClick={enviar} disabled={executando || !clienteId}>
          {/* O BOTÃO DIZ QUE ESTÁ ENVIANDO, e não só fica desabilitado.
              Com anexo, o envio é o pedido mais uma ida ao bucket por
              arquivo — tempo suficiente para quem clicou achar que o clique
              não pegou e clicar de novo. */}
          {executando ? "Enviando…" : "Enviar solicitação"}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Depois de enviar você pode anexar mais arquivos e conversar com a gente
        na tela do pedido.
      </p>
    </div>
  );
}
