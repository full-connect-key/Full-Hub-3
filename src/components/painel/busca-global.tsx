"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CircleDashed,
  GraduationCap,
  Inbox,
  ListChecks,
  Loader2,
  Search,
  Users,
} from "lucide-react";

import { ICONE_DA_AREA } from "@/app/(interno)/painel/minhas-tasks/linhas";
import { buscarNoPainel } from "@/app/(interno)/painel/_actions/busca";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  MINIMO_PARA_BUSCAR,
  totalNaPaleta,
  type GrupoDaBusca,
  type TipoDaBusca,
} from "@/lib/dominio/busca";
import { cn } from "@/lib/utils";

/**
 * A busca da plataforma.
 *
 * Ela foi uma CASCA desde o Sprint 1: um botão com cara de campo que abria um
 * toast dizendo que a busca não estava pronta. A escolha de não aceitar texto
 * estava certa para aquele dia — um campo que engole o que a pessoa digita e
 * não faz nada é pior que um botão honesto —, e é ela que sai agora.
 *
 * ---------------------------------------------------------------------------
 * **QUEM DECIDE O QUE CADA UM ACHA É A RLS, e não esta tela.**
 *
 * `busca_global()` (0073) não é `security definer`, então ela roda com o
 * `auth.uid()` de quem pediu. O que chega aqui já passou pelas policies das
 * nove tabelas. Esta paleta não filtra nada, não esconde nada por perfil e não
 * sabe quem está logado — e é assim que ela não pode divergir do banco.
 * ---------------------------------------------------------------------------
 *
 * **NADA MORA NA URL, ao contrário de todo filtro de listagem.** A convenção
 * existe porque "olha o dia 15" precisa ser um link; a paleta não é uma
 * visualização de dados, é um CAMINHO até uma tela — e o link que interessa é o
 * do destino, que é exatamente onde ela leva. Pior: com o termo na URL, voltar
 * da tela escolhida reabriria a paleta em cima dela.
 *
 * **⌘K / Ctrl+K, e não `/`.** O `/` já é a busca de demandas dentro da Gestão
 * de Tasks, e o atalho de lá começa com `if (metaKey || ctrlKey || altKey)
 * return` — então os dois não colidem por construção, e não por sorte.
 *
 * **O ÍCONE DAS TRÊS ÁREAS VEM DE `ICONE_DA_AREA`**, e este é o motivo:
 * demanda, campanha e Social Media já têm um desenho ao lado do nome delas em
 * Minhas Tasks, e aquele mapa nasceu de TRÊS cópias das quais DUAS já tinham
 * divergido. Uma quarta aqui poria o Social com um ícone na paleta e outro na
 * lista, a dois cliques de distância. Os outros seis tipos não são áreas e têm
 * ícone próprio.
 */

/** O desenho de cada tipo. Os três primeiros não são escolha desta tela. */
const ICONE_DO_TIPO: Record<TipoDaBusca, typeof Search> = {
  demanda: ICONE_DA_AREA.demandas,
  campanha: ICONE_DA_AREA.campanhas,
  post: ICONE_DA_AREA.social,
  etapa: ListChecks,
  cliente: Boxes,
  pessoa: Users,
  equipamento: CircleDashed,
  pedido: Inbox,
  trilha: GraduationCap,
};

/** A pausa de digitação. É a mesma do salvamento automático da tela de task. */
const PAUSA_MS = 300;

export function BuscaGlobal() {
  const [aberta, setAberta] = useState(false);

  // ⌘K NO DOCUMENTO INTEIRO, e ele não é ignorado dentro de campo de texto —
  // ao contrário do N e do `/` da Gestão de Tasks. É de propósito: quem está
  // escrevendo um comentário e lembra de uma demanda quer chegar nela, e
  // nenhum campo do produto usa ⌘K para outra coisa.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (
        (evento.metaKey || evento.ctrlKey) &&
        evento.key.toLowerCase() === "k"
      ) {
        evento.preventDefault();
        setAberta((antes) => !antes);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="text-text-muted hover:text-text-secondary bg-surface-card/70 border-border/50 focus-visible:ring-ring/50 hidden h-10 w-full max-w-[330px] items-center gap-2.5 rounded-full border px-4 text-sm font-semibold backdrop-blur-lg transition-colors focus-visible:ring-[3px] focus-visible:outline-none md:flex"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="truncate">Buscar na plataforma…</span>
        {/*
          A DICA DO ATALHO FICA À VISTA, e não num `title`: tooltip não existe
          para quem usa toque nem para quem varre a tela com o olho, e um
          atalho que ninguém descobre é um atalho que não existe. Ela é
          `aria-hidden` porque o leitor de tela já ouviu o nome do botão, e
          "barra K" no meio dele viraria ruído.
        */}
        <kbd
          aria-hidden
          className="text-text-muted border-input ml-auto hidden rounded border px-1 font-sans text-[10px] leading-4 xl:inline"
        >
          ⌘K
        </kbd>
      </button>

      {/*
        NO CELULAR O CAMPO NÃO CABE, e o que cabe é o ícone. É o MESMO
        componente e o MESMO diálogo — duas buscas parecidas divergiriam, e a
        divergência apareceria no lugar mais caro: o que cada uma alcança.
      */}
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label="Buscar na plataforma"
        className="text-text-secondary hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none md:hidden"
      >
        <Search aria-hidden className="size-5" />
      </button>

      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent
          // ALTA NA TELA E NÃO NO CENTRO: a lista cresce para baixo, e
          // centrada ela pularia a cada tecla conforme o número de linhas.
          className="top-[8vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Buscar na plataforma</DialogTitle>
          <DialogDescription className="sr-only">
            Digite para achar demandas, etapas, clientes, pessoas, campanhas,
            posts, equipamentos, pedidos e trilhas. Use as setas para escolher e
            Enter para abrir.
          </DialogDescription>
          {aberta ? <Paleta aoEscolher={() => setAberta(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Paleta({ aoEscolher }: { aoEscolher: () => void }) {
  const router = useRouter();
  const idDaLista = useId();

  const [termo, setTermo] = useState("");
  const [escolhido, setEscolhido] = useState(0);
  /**
   * A RESPOSTA É GUARDADA COM O TERMO QUE A PRODUZIU, e esse par faz três
   * trabalhos de uma vez:
   *
   * - **a guarda de corrida.** Digitando rápido, a resposta de "mun" pode
   *   chegar depois da de "mundo verde"; comparar o termo guardado com o do
   *   campo descarta a atrasada sem contador nenhum;
   * - **o estado "buscando"**, que passa a ser DERIVADO em vez de armazenado —
   *   é "o campo tem termo e a resposta não é dele ainda";
   * - **o vazio honesto.** Sem o par, "nada com esse nome" apareceria no
   *   intervalo entre a tecla e a resposta, dizendo que não achou uma coisa que
   *   ainda não foi procurada.
   *
   * E é o que permite o efeito abaixo não chamar `setState` no corpo dele: o
   * `lint` do projeto reprova isso, pela mesma razão que o editor de post virou
   * `key` em vez de efeito — `setState` síncrono num efeito dispara
   * renderização em cascata.
   */
  const [resposta, setResposta] = useState<{
    termo: string;
    grupos: GrupoDaBusca[];
  } | null>(null);
  const [erro, setErro] = useState<{ termo: string; mensagem: string } | null>(
    null,
  );

  const limpo = termo.trim();
  const curto = limpo.length < MINIMO_PARA_BUSCAR;
  const daVez = resposta?.termo === limpo ? resposta : null;
  const erroDaVez = erro?.termo === limpo ? erro : null;
  const grupos = daVez?.grupos ?? [];
  const buscando = !curto && !daVez && !erroDaVez;

  // SEM `useMemo`: `grupos` sai de um `??` e troca de identidade a cada
  // renderização, então o memo nunca acertaria — e a lista tem no máximo
  // cinquenta e quatro linhas.
  const linhas = grupos.flatMap((g) => g.itens);
  const quantas = totalNaPaleta(grupos);
  // O ÍNDICE É GRAMPEADO NA LEITURA, e não corrigido por efeito: a lista
  // encolhe a cada tecla, e um `setEscolhido` para caber seria outro `setState`
  // em cascata. Grampear responde a mesma pergunta sem guardar nada.
  const ativo =
    linhas.length === 0 ? -1 : Math.min(escolhido, linhas.length - 1);

  useEffect(() => {
    const alvo = termo.trim();
    if (alvo.length < MINIMO_PARA_BUSCAR) return;

    let vivo = true;
    const relogio = setTimeout(async () => {
      const r = await chamarAcao(() => buscarNoPainel(alvo));
      if (!vivo) return;

      // A RECUSA APARECE, e nunca vira lista vazia: aqui "não achei" é a
      // resposta normal, então uma falha silenciosa seria INDISTINGUÍVEL da
      // verdade — a pessoa concluiria que a demanda não existe. É a razão de
      // `ouFalha()` na camada de dados, e não é `chamarEMostrar` porque um toast
      // por tecla empilharia avisos: o erro mora dentro da paleta.
      if (!r.ok) {
        setErro({ termo: alvo, mensagem: r.error });
        return;
      }

      // `dados` é opcional no contrato de `Resultado`, e o `??` aqui não é
      // cerimônia: com um `!` a paleta prometeria um objeto que o contrato não
      // garante.
      setResposta({
        termo: r.dados?.termo ?? alvo,
        grupos: r.dados?.grupos ?? [],
      });
      setEscolhido(0);
    }, PAUSA_MS);

    return () => {
      vivo = false;
      clearTimeout(relogio);
    };
  }, [termo]);

  const abrir = useCallback(
    (caminho: string) => {
      aoEscolher();
      router.push(caminho);
    },
    [aoEscolher, router],
  );

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (linhas.length === 0) return;

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setEscolhido((ativo + 1) % linhas.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setEscolhido((ativo - 1 + linhas.length) % linhas.length);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const alvo = linhas[ativo];
      if (alvo) abrir(alvo.caminho);
    }
  }

  const idDoEscolhido = linhas[ativo] ? `${idDaLista}-${ativo}` : undefined;

  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
        {buscando ? (
          <Loader2
            aria-hidden
            className="text-text-muted size-4 shrink-0 animate-spin"
          />
        ) : (
          <Search aria-hidden className="text-text-muted size-4 shrink-0" />
        )}
        {/* O FOCO AUTOMÁTICO É O PONTO da paleta: ela abre para ser digitada, e
            sem ele a pessoa teria que clicar no campo que acabou de pedir. */}
        <input
          autoFocus
          type="text"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder="Demanda, cliente, pessoa, equipamento…"
          // `aria-label` E NÃO UM `<label for>`: o campo tem `role="combobox"`,
          // e o único rótulo visível aqui seria o placeholder — que desaparece
          // na primeira tecla.
          aria-label="Buscar na plataforma"
          role="combobox"
          aria-expanded={linhas.length > 0}
          aria-controls={idDaLista}
          aria-activedescendant={idDoEscolhido}
          aria-autocomplete="list"
          className="placeholder:text-text-muted flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {/* A CONTAGEM É ANUNCIADA, e não só desenhada: quem não vê a lista
          precisa saber que ela mudou de tamanho a cada tecla. */}
      <p aria-live="polite" className="sr-only">
        {curto
          ? ""
          : buscando
            ? "Buscando…"
            : `${quantas} ${quantas === 1 ? "resultado" : "resultados"}.`}
      </p>

      {/*
        O `role="listbox"` SO EXISTE QUANDO HA OPCAO, e o axe encontrou isto na
        primeira imagem: `aria-required-children` — um listbox sem nenhum
        `role="option"` dentro e ARIA invalido, e os dois estados vazios
        (termo curto e nada encontrado) tinham so um paragrafo la dentro. O
        leitor de tela anunciava uma caixa de seleção sem seleção nenhuma.

        O `id` fica nos dois casos, porque `aria-controls` do campo aponta para
        ele; o que some e a promessa de que ali dentro ha o que escolher — e
        `aria-expanded` ja diz `false` no mesmo instante.
      */}
      <div
        id={idDaLista}
        role={linhas.length > 0 ? "listbox" : undefined}
        aria-label={linhas.length > 0 ? "Resultados da busca" : undefined}
        className="max-h-[60vh] overflow-y-auto p-2"
      >
        {erroDaVez ? (
          <p className="text-danger bg-danger-soft m-1 rounded-md px-3 py-2 text-sm">
            {erroDaVez.mensagem}
          </p>
        ) : curto ? (
          <p className="text-text-secondary px-3 py-6 text-center text-sm">
            Digite ao menos {MINIMO_PARA_BUSCAR} letras.
          </p>
        ) : quantas === 0 && !buscando ? (
          <p className="text-text-secondary px-3 py-6 text-center text-sm">
            Nada com esse nome.
            <span className="text-text-muted mt-1 block text-xs">
              A busca olha o nome, não o briefing nem a legenda.
            </span>
          </p>
        ) : (
          grupos.map((grupo) => (
            <Grupo
              key={grupo.tipo}
              grupo={grupo}
              idDaLista={idDaLista}
              linhas={linhas}
              escolhido={ativo}
              aoPassar={setEscolhido}
              aoAbrir={abrir}
              termo={daVez?.termo ?? limpo}
            />
          ))
        )}
      </div>

      <div className="text-text-muted flex items-center justify-between border-t px-4 py-2 text-xs">
        <span>↑ ↓ para escolher · Enter para abrir · Esc para fechar</span>
        <span className="hidden sm:inline">⌘K abre de qualquer tela</span>
      </div>
    </>
  );
}

function Grupo({
  grupo,
  idDaLista,
  linhas,
  escolhido,
  aoPassar,
  aoAbrir,
  termo,
}: {
  grupo: GrupoDaBusca;
  idDaLista: string;
  linhas: GrupoDaBusca["itens"];
  escolhido: number;
  aoPassar: (i: number) => void;
  aoAbrir: (caminho: string) => void;
  termo: string;
}) {
  const Icone = ICONE_DO_TIPO[grupo.tipo];
  const idDoTitulo = `${idDaLista}-${grupo.tipo}`;

  return (
    <div role="group" aria-labelledby={idDoTitulo} className="mb-1">
      <p
        id={idDoTitulo}
        className="text-text-muted flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-medium"
      >
        <Icone aria-hidden className="size-3.5" />
        {grupo.rotulo}
      </p>

      {grupo.itens.map((item) => {
        const indice = linhas.indexOf(item);
        const ativo = indice === escolhido;
        return (
          <button
            key={`${grupo.tipo}-${item.id}`}
            id={`${idDaLista}-${indice}`}
            type="button"
            role="option"
            aria-selected={ativo}
            onMouseEnter={() => aoPassar(indice)}
            onClick={() => aoAbrir(item.caminho)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
              ativo ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            )}
          >
            <span className="min-w-0 flex-1">
              {/*
                O TITULO E `font-normal` PARA O REALCE TER PARA ONDE SUBIR.
                Ele era `font-medium`, e contra o `font-semibold` do trecho que
                casou isso e um degrau de 500 para 600 -- invisivel a 14px na
                imagem do protótipo. Com 400 contra 600 o realce se le, e o
                titulo continua sendo a linha principal porque o contexto
                embaixo dele e menor e mais claro.
              */}
              <span className="block truncate">
                <Realce texto={item.titulo} termo={termo} />
              </span>
              {item.contexto ? (
                <span className="text-text-secondary block truncate text-xs">
                  {item.contexto}
                </span>
              ) : null}
            </span>
            {item.selo ? (
              // PAR NOMEADO, nunca opacidade: um selo com `bg-warning/10` dá uma
              // cor que ninguém mediu, e no tema escuro dá outra.
              <span className="bg-warning-soft text-warning shrink-0 rounded px-1.5 py-0.5 text-[11px]">
                {item.selo}
              </span>
            ) : null}
          </button>
        );
      })}

      {/* O CORTE DIZ QUANTOS SOBRARAM, e é a regra do Resumo da Agência:
          cortar calado faz a pessoa concluir que aquilo é tudo. */}
      {grupo.sobraram > 0 ? (
        <p className="text-text-muted px-3 pt-0.5 pb-1 text-xs">
          e mais {grupo.sobraram} — escreva mais para estreitar.
        </p>
      ) : null}
    </div>
  );
}

/**
 * O trecho que casou em negrito.
 *
 * Ele existe porque a busca dobra acento e caixa: procurando "midia", a linha
 * que volta diz "mídia", e sem o realce quem lê não tem como ver POR QUE ela
 * apareceu. `sem_acento()` do banco e esta função respondem a mesma pergunta em
 * dois lados — como `situacaoDoLancamento()` no Financeiro —, e é por isso que o
 * mapa de acentos é o mesmo. Divergindo, o negrito cairia no lugar errado.
 */
const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN";

function dobrar(texto: string): string {
  let saida = "";
  for (const letra of texto) {
    const i = COM_ACENTO.indexOf(letra);
    saida += i >= 0 ? SEM_ACENTO[i] : letra;
  }
  return saida.toLowerCase();
}

function Realce({ texto, termo }: { texto: string; termo: string }) {
  const limpo = termo.trim();
  if (limpo.length < MINIMO_PARA_BUSCAR) return <>{texto}</>;

  // O ÍNDICE É MEDIDO NA FORMA DOBRADA E APLICADO NA ORIGINAL, que é o que faz
  // o negrito cair em cima do acento em vez de ao lado dele. Só funciona porque
  // `dobrar()` troca letra por letra e não muda o comprimento da string.
  const onde = dobrar(texto).indexOf(dobrar(limpo));
  if (onde < 0) return <>{texto}</>;

  return (
    <>
      {texto.slice(0, onde)}
      <mark className="bg-transparent font-semibold text-inherit">
        {texto.slice(onde, onde + limpo.length)}
      </mark>
      {texto.slice(onde + limpo.length)}
    </>
  );
}
