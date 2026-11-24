"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/core";
import {
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
import { EditorRico } from "@/components/shared/editor-rico";
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
import { camposDoRoteiro, respostasQueFaltam } from "@/lib/dominio/solicitacoes";
import type { RequestType } from "@/lib/supabase/database.types";

import { subirAnexoDoPedido } from "./subir-anexo";

/** O teto é do banco; a tela conta para não oferecer um caminho sem saída. */
const TETO_DE_ARQUIVOS = 10;

/**
 * Os ícones dos tipos de trabalho, pelo nome gravado em `request_types.icone`.
 *
 * **`Megaphone` entrou com a 0148**, que é o ícone do tipo "Campanha" — e ele
 * é o mesmo que a fileira de frentes usava para aquela palavra, de propósito:
 * o cartão é o mesmo gesto com outro nome em cima.
 *
 * **E `Video` FICA, num tipo que o cliente não vê.** A 0148 desativou "Vídeo"
 * — *"videos tbm são peças para rede"* —, e desativar não é apagar
 * (`skills.ativa`): a gestão o reativa sem deploy, e um mapa sem o ícone dele
 * faria o cartão nascer com o `CircleHelp` do "Outro" no dia em que ela
 * reativasse.
 */
const ICONES = { Share2, Megaphone, Printer, Video, CircleHelp } as const;

/**
 * O formulário de um pedido novo.
 *
 * ---------------------------------------------------------------------------
 * **A ORDEM É DE QUEM PEDE, e não da fila que recebe.**
 *
 * Ele começava pela CLASSIFICAÇÃO — empresa, vertente, Social ou Campanha,
 * tipo de trabalho — e só no sexto campo perguntava o que a pessoa quer. Essa
 * é a ordem da AGÊNCIA: são as perguntas de que a fila precisa para encaminhar
 * o pedido. A ordem de quem PEDE é a inversa: ela abriu o portal porque
 * precisa de uma coisa, e a primeira tela do pedido tem de ser sobre essa
 * coisa.
 *
 * São cinco seções numeradas, cada uma com uma pergunta:
 *
 *   1. **O que você precisa** — o nome, a empresa e o BRIEFING
 *   2. **Que tipo de trabalho é** — o cartão, a campanha e o roteiro
 *   3. **Referências** — os anexos
 *   4. **Para quando** — a data desejada, com o que ela significa
 *   5. **Quantos materiais de cada tipo** — só na frente Campanha (0138)
 *
 * **E são numeradas pela razão escrita em `SecaoDoFormulario`:** o número dá à
 * conversa um jeito de apontar ("faltou a 3") sem descrever onde o campo está
 * na tela — e aqui a conversa com o Atendimento acontece na tela ao lado.
 * ---------------------------------------------------------------------------
 *
 * **O BRIEFING É O MESMO EDITOR DA AGÊNCIA (0148)** — decisão do usuário, em
 * duas frases: *"quero que quando o cliente pede algo, no portal do cliente,
 * ele tenha espaço para escrever o briefing igual o atendimento da agência.
 * com tabelas, grifando. e no lugar de conte com suas palavras, esteja escrito
 * briefing msm"* e *"toda caixa de texto deve ser igual o do briefing interno
 * da agencia, com aquelas funcionalidades"*.
 *
 * Era um `<Textarea>` chamado *"Conte com as suas palavras"*. Hoje é o
 * `EditorRico` — o mesmo componente dos três editores de briefing do lado de
 * dentro —, com a caixa, a tabela e a paleta nomeada que a 0127 mediu.
 *
 * **"ONDE ISSO ENTRA" SAIU** — decisão do usuário: *"Nas solicitações do
 * portal do cliente, pode tirar o onde isso entra. quero que mude o que tipo
 * de trabalho é, para permitir campanhas tbm"*. Era a seção da classificação,
 * e cada campo dela foi para onde ele decide alguma coisa:
 *
 *   - **a empresa** subiu para a seção 1. Ela não podia sair: `client_id` é
 *     `not null`, e é ela que decide a pasta do anexo e a policy do envio. E
 *     continua só aparecendo com mais de uma, pela razão de sempre;
 *   - **a frente** deixou de ser perguntada: ela vem do TIPO escolhido
 *     (`request_types.frente`), e os dois tipos sem frente — "Material
 *     impresso" e "Outro" — são o que antes era o cartão *"Não sei dizer"*;
 *   - **a campanha** desceu para a seção 2, embaixo dos cartões: ela só existe
 *     na frente Campanha, e agora a frente é o cartão logo acima dela.
 *
 * ***E A VERTENTE SAIU DESTA TELA, que é o custo e é dito em vez de
 * escondido:*** ela era o único campo daquela seção sem outra casa, e
 * perguntá-la na seção 1 seria devolver a classificação ao lugar de onde ela
 * acabou de sair. O que não se perde é a classificação do TRABALHO —
 * `tasks.vertente_id` existe desde a 0118, e quem a escolhe é o Atendimento na
 * tela da demanda, que é onde ela decide o board, a Biblioteca e o relatório.
 *
 * **AS REFERÊNCIAS VÊM DEPOIS DO BRIEFING** — decisão do usuário:
 * *"referencias devem vir só depois do briefing"*. Elas eram o terceiro bloco
 * da seção 1, ao lado do nome e do texto; hoje são a seção 3, depois do
 * briefing e do roteiro. A ordem é a da leitura de quem pede: primeiro o que
 * eu quero, depois o que eu mando para explicar.
 *
 * **NADA DE CATEGORIA É OBRIGATÓRIO, e isso continua sendo a 0137** — *"o
 * cliente deve poder especificar o que ele quer sem colocar em alguma
 * categoria, podendo escrever caso ele queira"*. O tipo não vem
 * pré-selecionado, clicar no escolhido o desfaz, e um pedido sem tipo nenhum é
 * um pedido com briefing e mais nada.
 *
 * ***O que isso custa, e é dito em vez de escondido:*** sem um tipo escolhido
 * não há roteiro de briefing, e o argumento da 0068 — *"um campo de texto
 * livre chamado 'descreva o que você precisa' devolve 'uma arte pro insta'"* —
 * continua verdadeiro. Ele continua valendo para quem escolhe um tipo: as
 * perguntas aparecem no instante da escolha. O que o produto deixou de fazer é
 * COBRAR aquelas respostas de quem não quis classificar nada.
 *
 * **As perguntas vêm do banco** (`request_types.campos_json`) e não daqui: a
 * gestão edita o roteiro sem deploy, que é a mesma razão pela qual a frente
 * virou coluna daquela tabela em vez de um de-para escrito nesta tela.
 */
export function FormularioDePedido({
  empresas,
  tipos,
  campanhas,
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

  /**
   * O TIPO CUJA FRENTE É CAMPANHA, e ele é lido duas vezes.
   *
   * Quem nasce dentro de uma campanha já tem a resposta dada, e depois da 0148
   * a frente vem do TIPO: o cartão de campanha é que precisa nascer escolhido,
   * e não um estado de frente que não existe mais.
   *
   * ***E se o catálogo não tiver um tipo de campanha, a campanha simplesmente
   * não é enviada*** — a tela degrada e nunca recusa: o pedido nasce com o
   * briefing, e o Atendimento o liga à campanha pela fila, que é o caminho que
   * `classificarSolicitacao` existe para cobrir.
   */
  const tipoDeCampanha = tipos.find((t) => t.frente === "campanha")?.id ?? "";

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
   *
   * **Menos quando o pedido nasce DENTRO de uma campanha:** ali a resposta já
   * está dada, e `client_requests_classificacao` recusaria qualquer outra
   * frente — inclusive a ausência, porque o ramo 3 compara com
   * `is distinct from`.
   */
  const [tipoId, setTipoId] = useState<string>(
    campanhaInicial ? tipoDeCampanha : "",
  );
  const [campanhaId, setCampanhaId] = useState<string>(campanhaInicial ?? "");
  const [titulo, setTitulo] = useState("");
  /**
   * O BRIEFING MORA NUM `ref`, e é a forma dos editores do lado de dentro.
   *
   * O `onChange` do TipTap dispara a cada tecla, e pô-lo num `useState`
   * re-renderizaria o formulário inteiro — com o roteiro, a lista de arquivos
   * e o editor de composição dentro — a cada letra digitada. Nada na tela
   * depende do que está escrito, então nada precisa de estado: o briefing é
   * opcional, como o texto livre que ele substitui.
   *
   * **E as DUAS colunas andam juntas**, que é o par de todo editor deste
   * produto: o `jsonb` que a tela desenha e o texto que a busca lê. Quem
   * decide se há briefing é o TEXTO — um documento do TipTap sem nada dentro
   * ainda é um parágrafo vazio.
   */
  const briefing = useRef<{ json: JSONContent | null; texto: string }>({
    json: null,
    texto: "",
  });
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
   * ficam no estado mesmo quando a seção sai da tela — quem escolheu o tipo de
   * campanha, preencheu, e trocou de tipo para conferir não perde o que
   * escreveu; quem TROCA de verdade é que perde, e aí o `enviar` não os manda.
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

  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const campos = camposDoRoteiro(tipo?.campos_json);

  /**
   * A FRENTE VEM DO TIPO, e não de um campo (0148).
   *
   * Era uma fileira de três cartões — Social, Campanha, "Não sei dizer" —
   * logo abaixo dos cartões de tipo de trabalho, e as duas respondiam a mesma
   * pergunta: *que trabalho é este*. Duas perguntas para a mesma resposta é
   * uma pergunta a mais, e era a de baixo que podia contradizer a de cima —
   * "Material impresso" marcado como Social.
   *
   * **E ela é NULA nos dois tipos sem lado**, que é o que antes era o terceiro
   * cartão: o enum tem dois valores, e a ausência de um deles é a ausência.
   */
  const frente = tipo?.frente ?? null;

  /**
   * A FRENTE CAMPANHA DESENHA DUAS SEÇÕES A MAIS (0138).
   *
   * Uma pergunta só, lida em quatro lugares — as duas seções, o período e a
   * composição no envio: duas comparações com `"campanha"` seriam duas
   * verdades sobre quando a tela é a de abrir campanha, e a que divergiria é
   * a do ENVIO, que não aparece em imagem nenhuma.
   */
  const ehCampanha = frente === "campanha";

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
   * A CAMPANHA SÓ EXISTE NA FRENTE CAMPANHA, e trocar de tipo a apaga.
   *
   * Sem a limpeza, quem escolhe uma campanha e troca para um tipo de outra
   * frente manda a linha que o trigger recusa — *"Este pedido está numa
   * campanha, então a frente é Campanha"* —, e a recusa chegaria no clique de
   * enviar, sobre um campo que a tela já tinha escondido.
   */
  const campanhaValida = ehCampanha ? campanhaEscolhida : "";

  /**
   * O QUE FALTA, e a frente NÃO está nesta lista (0137).
   *
   * **E o título está.** Ele era cobrado pelo `disabled` do botão —
   * `titulo.trim().length < 3` —, e o próprio arquivo escrevia o argumento
   * contra isso: *um botão desligado não tem como dizer por que está
   * desligado, e clicar nele é justamente o momento em que a pessoa pede para
   * saber o que falta*. Hoje o botão fica ligado e a frase nomeia o que falta,
   * que é a decisão da recusa da 0023.
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
    const texto = briefing.current.texto.trim();
    comecar(async () => {
      const r = await chamarEMostrar(() =>
        abrirSolicitacao({
          client_id: clienteId,
          request_type_id: tipoId || null,
          campaign_id: campanhaValida || null,
          // A FRENTE VIAJA COMO NULO no tipo que não tem lado, e ela não é
          // mais uma escolha desta tela: ela é o `frente` do tipo escolhido.
          frente,
          // A VERTENTE SAIU DA TELA e o campo continua no esquema: quem
          // classifica o trabalho é o Atendimento, na demanda (0118).
          vertente_id: null,
          titulo,
          // AS DUAS COLUNAS ANDAM JUNTAS, e o TEXTO decide se há briefing: um
          // documento vazio do TipTap ainda é um parágrafo, e guardá-lo é
          // guardar o formato do nada.
          descricao: texto || null,
          briefing_rico: texto ? briefing.current.json : null,
          respostas,
          data_desejada: quando,
          // OS TRÊS SÓ VIAJAM NA FRENTE CAMPANHA, e a pergunta é a mesma que
          // desenha as duas seções: quem trocou de tipo depois de preencher
          // não manda ao banco um período que a tela não mostra mais — o ramo
          // 5 do gatilho recusaria, e a recusa chegaria depois do clique
          // falando de uma seção que não está à vista.
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
      // banco, e o Atendimento já foi avisado: descartar o briefing que a
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
          frente de produção — e o briefing aqui é o *"podendo escrever caso
          ele queira"* da 0137: ele é o caminho principal, e sozinho já é um
          pedido inteiro.
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

        {/* O SELETOR DE EMPRESA SÓ APARECE COM MAIS DE UMA. Com uma, ele é um
            campo com uma opção — a pessoa lê, pensa, e escolhe a única.

            **E ele subiu para a seção 1 com a saída de "Onde isso entra"**:
            `client_id` é `not null`, e é ele que decide a pasta do anexo e a
            policy do envio — ele não tinha como sair com a seção. */}
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

        {/* ---------------------------------------------------------------
            O BRIEFING — e o rótulo é a palavra que o usuário pediu.

            Ele era *"Conte com as suas palavras"* num `<Textarea rows={5}>`.
            Hoje é **"Briefing"**, no mesmo `EditorRico` que o Atendimento usa
            nos três briefings do lado de dentro: um segundo editor de
            briefing no produto seria o que divergiria, e o que divergiria é
            este — a tela que a equipe nunca abre.
            --------------------------------------------------------------- */}
        <div className="space-y-1.5">
          <Label htmlFor="pedido-briefing">Briefing</Label>
          {/* O `id` fica no invólucro e o `<Label>` aponta para ele: o campo
              de verdade é o `contenteditable` do TipTap, que não é um
              elemento de formulário — um `htmlFor` para ele não nomeia nada.
              Quem nomeia é o `aria-label` que o editor desenha dentro. */}
          <div id="pedido-briefing">
            <EditorRico
              onChange={({ json, texto }) => {
                briefing.current = { json, texto };
              }}
              placeholder="O que é, para que serve, onde vai ser usado, o que não pode faltar. Dá para usar tabela, destaque e caixa."
            />
          </div>
        </div>
      </SecaoDoFormulario>

      {/* ==================================================================
          2. QUE TIPO DE TRABALHO É — e ela é OPCIONAL.

          **OS CARTÕES PERDERAM A LINHA DE BAIXO** — decisão do usuário:
          *"tire o texto abaixo que de que tipo de trabalho é, esses textinhos
          parecem indiretas não são legais"*. Eram as frases de
          `request_types.descricao`, da 0068, e uma delas era literalmente
          isso: *"Não se encaixa nos anteriores — conte o que você precisa"*. A
          coluna fica gravada, sem leitor, carimbada pela 0137.

          **E NENHUM VEM MARCADO**, que é a outra metade da 0137 — menos
          quando o pedido nasce dentro de uma campanha, onde a resposta já
          está dada.

          **E A CAMPANHA VIROU UM TIPO (0148)** — *"quero que mude o que tipo
          de trabalho é, para permitir campanhas tbm"*. Com ela aqui, a frente
          deixou de ser uma segunda pergunta: ela vem do tipo escolhido.
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
                onClick={() => {
                  const proximo = escolhido ? "" : t.id;
                  setTipoId(proximo);
                  // SAIR DA FRENTE CAMPANHA APAGA A CAMPANHA, senão o envio
                  // carregaria uma campanha num pedido que diz outra coisa —
                  // a contradição que o ramo 3 do gatilho recusa, e que
                  // alcança também a frente em branco.
                  const frenteNova =
                    tipos.find((x) => x.id === proximo)?.frente ?? null;
                  if (frenteNova !== "campanha") setCampanhaId("");
                }}
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
            A CAMPANHA SÓ EXISTE NA FRENTE CAMPANHA (0124): nos outros tipos
            não há campanha para escolher, e o trigger recusa a linha que tem
            as duas coisas.

            **E ELA DESCEU PARA CÁ COM A SAÍDA DE "Onde isso entra"**: a
            frente é o cartão logo acima, então a campanha ficou encostada na
            resposta que a faz existir.

            **E O CAMPO SÓ EXISTE QUANDO HÁ CAMPANHA ABERTA.** Um seletor com a
            única opção "Nenhuma" é um campo que a pessoa lê, pensa e deixa como
            está. Quando o tipo é Campanha e a conta não tem nenhuma aberta, o
            que aparece é a FRASE abaixo — o pedido chega antes de a campanha
            existir, que é o caso comum de quem pede uma ação nova.
            ---------------------------------------------------------------- */}
        {ehCampanha && daEmpresa.length === 0 ? (
          <p className="text-text-muted text-sm">
            Esta empresa não tem campanha aberta no momento — a gente organiza
            isso por aqui depois de ler o seu pedido.
          </p>
        ) : null}

        {ehCampanha && daEmpresa.length > 0 ? (
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
                <SelectItem value="nenhuma">
                  Nenhuma, é uma campanha nova
                </SelectItem>
                {daEmpresa.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* ----------------------------------------------------------------
            O ROTEIRO DE BRIEFING (0068), e o título dele mudou.

            Ele era *"Para a gente não precisar perguntar depois"* — decisão do
            usuário: *"Mude a frase"*. Aquele título explicava por que a
            AGÊNCIA queria as respostas, o que é problema da agência, e lido do
            lado de fora soava como cobrança. O que ficou no lugar diz o que a
            seção é, e nada mais.

            **E ele só existe com um tipo escolhido CUJO roteiro tem campo**,
            que é o que torna seguro esvaziar o roteiro de um tipo pela tela da
            gestão: o tipo continua existindo, e a seção simplesmente não
            nasce.
            ---------------------------------------------------------------- */}
        {campos.length > 0 ? (
          <section className="bg-card space-y-4 rounded-lg border p-4">
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
          3. REFERÊNCIAS — decisão do usuário: *"referencias devem vir só
          depois do briefing"*.

          **ELAS ERAM O TERCEIRO BLOCO DA SEÇÃO 1**, ao lado do nome e do
          texto, com o argumento escrito de que *"a referência é parte do que a
          pessoa quer, e não um apêndice do fim do formulário"*. Aquilo
          continua certo sobre o fim do formulário e errado sobre a ordem: o
          que se manda para EXPLICAR vem depois do que se escreveu — e com o
          briefing virando um editor de verdade, o bloco de arquivos ficava
          entre a caixa de texto e o resto, partindo a seção em duas.

          **Os arquivos ficam em memória até o envio**, porque o caminho no
          bucket leva o id do pedido e ele ainda não existe. Por isso esta
          lista é uma lista de escolhas, e não de anexos: ninguém subiu nada
          ainda, e a tela não pode afirmar que subiu.
          ================================================================== */}
      <SecaoDoFormulario numero={3} titulo="Referências">
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
          4. PARA QUANDO — e a frase embaixo FICA.

          Ela não é do grupo que saiu: *"É a data que ajudaria você — não é o
          prazo combinado"* não descreve uma categoria nem cobra nada, ela
          impede um mal-entendido caro. Um campo de data sem essa linha é lido
          como prazo acordado, e quem digita precisa saber disso ANTES de
          digitar — não no dia em que a peça não chegar.
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
          nasce e some: pondo-a antes de "Para quando", escolher o tipo
          Campanha renumeraria a seção que a pessoa acabou de ler. E ela é a
          mais detalhada das cinco, que é onde ela pertence numa lista que vai
          do que a pessoa quer até como isso se divide.

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
