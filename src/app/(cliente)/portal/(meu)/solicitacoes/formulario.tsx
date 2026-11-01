"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
 * O formulário de um pedido novo.
 *
 * ---------------------------------------------------------------------------
 * **O TIPO VEM PRIMEIRO, E ELE MUDA O RESTO DA TELA.**
 *
 * Escolher "Peça para redes" acrescenta as perguntas daquele trabalho — onde
 * vai ao ar, que formato, o que precisa dizer. É o roteiro de briefing, e ele
 * existe porque um campo de texto livre chamado "descreva o que você precisa"
 * devolve "uma arte pro insta", e a primeira mensagem da conversa é sempre a
 * mesma pergunta.
 *
 * As perguntas vêm do banco (`request_types.campos_json`) e não daqui: a
 * gestão edita o roteiro sem deploy, que é a mesma razão pela qual a
 * capacidade da equipe é coluna e não constante.
 * ---------------------------------------------------------------------------
 *
 * **"Para quando você gostaria" diz o que significa, embaixo do campo.** Um
 * campo de data sem essa frase é lido como prazo combinado — e ele não é: o
 * prazo é o que a agência assume depois de olhar o pedido. Quem digita a data
 * precisa saber disso ANTES de digitar, não quando a peça não chegar no dia.
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
  const [tipoId, setTipoId] = useState<string>(tipos[0]?.id ?? "");
  const [campanhaId, setCampanhaId] = useState<string>(campanhaInicial ?? "");
  /**
   * A FRENTE NASCE VAZIA, e não em "Social".
   *
   * Um padrão aqui desfaz o pedido: *exigir a classificação* quer dizer que
   * alguém escolhe, e a opção pré-marcada é a que ninguém lê — o relatório
   * passaria a somar o padrão em vez da resposta. É a mesma razão pela qual o
   * status não se escolhe no rascunho da demanda.
   *
   * **Menos quando o pedido nasce DENTRO de uma campanha:** ali a resposta já
   * está dada, e `client_requests_classificacao` recusaria qualquer outra.
   */
  const [frente, setFrente] = useState<SolicitacaoFrente | "">(
    campanhaInicial ? "campanha" : "",
  );
  const [vertenteId, setVertenteId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState("");
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
   *
   * **E o botão fica LIGADO**, com o título preenchido: um botão desligado não
   * tem como dizer por que está desligado, e clicar nele é justamente o
   * momento em que a pessoa pede para saber o que falta.
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

  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const campos = camposDoRoteiro(tipo?.campos_json);
  const faltando = [
    // A FRENTE VEM PRIMEIRO NA FRASE porque ela é a primeira pergunta da
    // tela: listá-la depois das respostas do roteiro mandaria a pessoa rolar
    // para baixo para achar o que está mais em cima.
    ...(frente === "" ? ["Social ou Campanha"] : []),
    ...respostasQueFaltam(campos, respostas),
  ];

  function responder(chave: string, valor: string) {
    setRespostas((atual) => ({ ...atual, [chave]: valor }));
  }

  function enviar() {
    if (faltando.length > 0 || frente === "") {
      setTentou(true);
      return;
    }
    comecar(async () => {
      const r = await chamarEMostrar(() =>
        abrirSolicitacao({
          client_id: clienteId,
          request_type_id: tipoId || null,
          campaign_id: campanhaValida || null,
          frente,
          vertente_id: vertenteEscolhida || null,
          titulo,
          descricao,
          respostas,
          data_desejada: quando,
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
    <div className="space-y-6">
      {/* O SELETOR DE EMPRESA SÓ APARECE COM MAIS DE UMA. Com uma, ele é um
          campo com uma opção — a pessoa lê, pensa, e escolhe a única. */}
      {empresas.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="pedido-empresa">Para qual empresa</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger
              aria-label="Empresa"
              id="pedido-empresa"
              className="w-full sm:w-80"
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

      {/* ------------------------------------------------------------------
          A VERTENTE VEM DEPOIS DA EMPRESA, e é a ordem da decisão: de qual
          conta, de qual parte dela, e só então de que frente. Acima da
          empresa ela perguntaria sobre uma conta que ainda não foi escolhida
          — a mesma ordem do seletor da tela de task (0118).

          **E O CAMPO SÓ EXISTE QUANDO A CONTA TEM VERTENTE**, que é a maioria
          ao contrário: quase nenhuma tem. Um seletor permanentemente vazio
          pede uma escolha que não existe.
          ------------------------------------------------------------------ */}
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
              className="w-full sm:w-80"
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

      {/* ------------------------------------------------------------------
          A CLASSIFICAÇÃO — decisão do usuário: *"exigir a classificação como
          Social ou Campanha"*.

          **ELA VEM ANTES DO TIPO DE TRABALHO**, e as duas perguntas não são a
          mesma: o tipo é o roteiro de briefing — o que é a peça —, e a frente
          é quem produz. Uma peça para redes nasce das duas, e é essa a conta
          que o relatório da agência separa.

          **E SÃO DOIS CARTÕES e não um `<Select>`**, pela razão do seletor de
          redes do social: a frase que explica cada lado é o que faz a escolha
          não ser palpite, e num `<Select>` ela não cabe — ficaria escondida
          atrás de um clique, que é justamente o clique da decisão.
          ------------------------------------------------------------------ */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">É para o quê *</legend>
        <div
          role="radiogroup"
          aria-label="Social ou Campanha"
          className="grid gap-2 sm:grid-cols-2"
        >
          {FRENTES_DA_SOLICITACAO.map((f) => {
            const Icone = f === "social" ? Share2 : Megaphone;
            const escolhido = f === frente;
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={escolhido}
                onClick={() => {
                  setFrente(f);
                  // TROCAR PARA SOCIAL APAGA A CAMPANHA, senão o envio
                  // carregaria uma campanha num pedido que diz social — a
                  // contradição que o trigger da 0124 recusa.
                  if (f === "social") setCampanhaId("");
                }}
                className={
                  escolhido
                    ? "border-accent-strong bg-accent rounded-lg border p-3 text-left"
                    : "hover:bg-accent rounded-lg border p-3 text-left transition-colors"
                }
              >
                <Icone aria-hidden className="text-accent-strong mb-1 size-5" />
                <p className="text-sm font-medium">{ROTULOS_DE_FRENTE[f]}</p>
                <p className="text-muted-foreground text-xs">
                  {EXPLICACAO_DA_FRENTE[f]}
                </p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          Que tipo de trabalho é
        </legend>
        {/* `role="radiogroup"` no invólucro porque os cartões são
            `role="radio"`: um radio sem o grupo por perto é um papel sem pai,
            e o leitor de tela anuncia "opção 1 de 1" em cada um deles. */}
        <div
          role="radiogroup"
          aria-label="Tipo de pedido"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
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
                onClick={() => setTipoId(t.id)}
                className={
                  escolhido
                    ? "border-accent-strong bg-accent rounded-lg border p-3 text-left"
                    : "hover:bg-accent rounded-lg border p-3 text-left transition-colors"
                }
              >
                <Icone aria-hidden className="text-accent-strong mb-1 size-5" />
                <p className="text-sm font-medium">{t.nome}</p>
                {t.descricao ? (
                  <p className="text-muted-foreground text-xs">{t.descricao}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ------------------------------------------------------------------
          A CAMPANHA VEM DEPOIS DO TIPO E ANTES DO TÍTULO, e a ordem é a da
          decisão: que trabalho é, de que campanha ele faz parte, e só então
          como ele se chama. Depois do título ela leria como um detalhe de
          classificação, quando ela é contexto do pedido inteiro.

          **E O CAMPO SÓ EXISTE QUANDO HÁ CAMPANHA ABERTA.** Um seletor com a
          única opção "Nenhuma" é um campo que a pessoa lê, pensa e deixa como
          está — a mesma razão pela qual o seletor de empresa só aparece com
          mais de uma.

          **E SÓ NA FRENTE CAMPANHA** (0124): na frente Social não há campanha
          para escolher, e o trigger recusa a linha que tem as duas coisas.
          Quando a frente é Campanha e a conta não tem nenhuma aberta, o que
          aparece é a FRASE abaixo — o pedido chega antes de a campanha
          existir, que é o caso comum de quem pede uma ação nova.
          ------------------------------------------------------------------ */}
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
              className="w-full sm:w-80"
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
          <p className="text-text-muted text-sm">
            Assim este pedido aparece junto do resto da campanha.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="pedido-titulo">Em uma linha, o que é *</Label>
        <Input
          id="pedido-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Arte para o Dia das Mães"
        />
      </div>

      {campos.length > 0 ? (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">
            Para a gente não precisar perguntar depois
          </h2>

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
                      className="w-full sm:w-80"
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

                {c.ajuda ? (
                  <p className="text-muted-foreground text-xs">{c.ajuda}</p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="pedido-descricao">Mais alguma coisa</Label>
        <Textarea
          id="pedido-descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Qualquer detalhe que ajude."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pedido-quando">Para quando você gostaria</Label>
        <Input
          id="pedido-quando"
          type="date"
          value={quando}
          onChange={(e) => setQuando(e.target.value)}
          className="w-full sm:w-52"
        />
        <p className="text-muted-foreground text-xs">
          É a data que ajudaria você — não é o prazo combinado. A gente olha o
          pedido e responde por aqui com a data que dá para assumir.
        </p>
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
          <p className="text-muted-foreground text-xs">
            Print, foto, a arte de referência — o que ajudar a gente a entender
            o que você quer.
          </p>
        )}
      </div>

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
        <Button
          onClick={enviar}
          disabled={executando || titulo.trim().length < 3 || !clienteId}
        >
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
