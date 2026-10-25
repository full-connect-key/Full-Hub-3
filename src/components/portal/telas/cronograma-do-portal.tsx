import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  classesDoChipDeStatus,
  rotuloDoStatus,
} from "@/components/shared/status-badge";
import { cronogramaDoMes } from "@/lib/dados/cronograma";
import { prazosDoPortal } from "@/lib/dados/portal";
import {
  contarPorFrente,
  ehFrenteDoCronograma,
  FRENTES_DO_CRONOGRAMA,
  porDiaDoCronograma,
  ROTULO_DA_FRENTE,
  SENTIDO_DA_DATA,
  type FrenteDoCronograma,
  type ItemDoCronograma,
} from "@/lib/dominio/cronograma";
import { deslocarMes, gradeDoMes, mesDe } from "@/lib/dominio/posts";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";
import { cn } from "@/lib/utils";

const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Quantos chips cabem numa célula antes do "+N". */
const CABEM_NA_CELULA = 3;

/**
 * O CRONOGRAMA — o que acontece quando, nas três frentes da conta.
 *
 * Ele é **só leitura e só link**: nada nasce aqui, e cada chip leva ao módulo
 * onde aquilo se decide. A razão de ele existir — e por que isso não
 * contradiz a 0105, que fechou o calendário da agência — está escrita em
 * `lib/dominio/cronograma.ts`.
 *
 * **Mês, frente e dia aberto moram na URL**, como em toda listagem do
 * produto: "olha o dia 15" precisa ser um link, e é isso que permite a tela
 * inteira ser componente de servidor.
 *
 * **As três datas não querem dizer a mesma coisa**, e a legenda diz as duas
 * palavras: o post carrega o dia em que ele VAI AO AR, a peça de campanha e o
 * material de uma demanda carregam o dia em que VENCEM. O rótulo acessível de
 * cada chip leva a palavra junto, porque quem usa leitor de tela não tem a
 * legenda à vista quando chega no chip.
 */
export async function CronogramaDoPortal({
  base,
  clienteId,
  mes: mesPedido,
  frente: frentePedida,
  diaAberto,
}: {
  base: string;
  clienteId: string | null;
  mes: string | null;
  frente: string | null;
  diaAberto: string | null;
}) {
  const { hoje } = prazosDoPortal();
  const mes = mesPedido ?? mesDe(hoje);
  // FRENTE TORTA VIRA NULO, nunca um recorte vazio: é a decisão de
  // `ehFaseDoMaterial` e de `PLATAFORMAS` — um `?frente=site` digitado à mão
  // abre a grade inteira em vez de uma tela em branco que parece defeito.
  const frente = ehFrenteDoCronograma(frentePedida) ? frentePedida : null;

  const todos = await cronogramaDoMes(mes, base, clienteId ?? undefined);

  // AS CONTAGENS SAEM DO MÊS INTEIRO, nunca do que sobrou do recorte: com o
  // filtro aplicado antes, escolher "Social" zeraria as outras duas abas e a
  // pessoa perderia o caminho de volta. É o contador das abas de Pedidos pela
  // quarta vez — o recorte acontece na tela, e o número vem da lista inteira.
  const conta = contarPorFrente(todos);
  const itens = frente ? todos.filter((i) => i.frente === frente) : todos;

  const dias = gradeDoMes(mes);
  const mapa = porDiaDoCronograma(itens);
  const doDiaAberto = diaAberto ? (mapa.get(diaAberto) ?? []) : [];

  const comFrente = (valor: FrenteDoCronograma | null) => {
    const parametros = new URLSearchParams({ mes });
    if (valor) parametros.set("frente", valor);
    return `?${parametros.toString()}`;
  };

  const comMes = (outro: string) => {
    const parametros = new URLSearchParams({ mes: outro });
    if (frente) parametros.set("frente", frente);
    return `?${parametros.toString()}`;
  };

  return (
    <div className="space-y-5">
      {/* O MÊS É LINK e não botão com estado, como na navegação do Social: ele
          mora na URL, então a seta funciona antes de qualquer JavaScript
          carregar. **A frente VIAJA junto e o dia aberto NÃO**: trocar de mês
          mantendo `?dia=` deixaria a seção de baixo mostrando um dia que não
          está mais na grade. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" aria-label="Mês anterior" asChild>
          <Link href={comMes(deslocarMes(mes, -1))}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>

        <p className="text-text-primary min-w-40 text-center text-sm font-semibold first-letter:uppercase">
          {format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>

        <Button variant="outline" size="icon" aria-label="Próximo mês" asChild>
          <Link href={comMes(deslocarMes(mes, 1))}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>

        {/* "Hoje" some quando já se está nele: um botão que não faz nada é um
            botão que ensina a desconfiar dos outros. */}
        {mes !== mesDe(hoje) ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={comMes(mesDe(hoje))}>Hoje</Link>
          </Button>
        ) : null}
      </div>

      {/* ------------------------------------------------------- as abas -- */}
      <div className="flex flex-wrap items-center gap-2">
        <ChipDeFrente
          href={comFrente(null)}
          ativo={!frente}
          total={todos.length}
        >
          Tudo
        </ChipDeFrente>
        {FRENTES_DO_CRONOGRAMA.map((valor) => (
          <ChipDeFrente
            key={valor}
            href={comFrente(valor)}
            ativo={frente === valor}
            total={conta[valor]}
          >
            {ROTULO_DA_FRENTE[valor]}
          </ChipDeFrente>
        ))}
      </div>

      {/* A ÂNCORA DO TOUR ENVOLVE AS DUAS FORMAS, a grade e a lista por dia:
          em 375px a grade não existe, e um `data-tour` só nela deixaria o
          passo sem elemento exatamente no tamanho em que o portal é mais
          usado — que é o caso que a bandeira `opcional` existe para tolerar e
          não para esconder. */}
      <div {...ancora(ANCORAS.portalCronograma)} className="space-y-5">
        {todos.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Nada marcado neste mês"
            description="Quando houver material com data, ele aparece aqui — o que vai ao ar e o que tem prazo."
            className="bg-card rounded-card shadow-cartao border-solid"
          />
        ) : (
          <>
            {/* ------------------------------------------------------ grade -- */}
            <div className="hidden sm:block">
              <div className="text-text-muted grid grid-cols-7 gap-px pb-2 text-center text-xs font-medium">
                {DIAS_DA_SEMANA.map((dia) => (
                  <div key={dia}>{dia}</div>
                ))}
              </div>

              <div className="bg-border grid grid-cols-7 gap-px overflow-hidden rounded-xl border">
                {dias.map((dia) => {
                  const doDia = mapa.get(dia) ?? [];
                  const foraDoMes = mesDe(dia) !== mes;

                  return (
                    <div
                      key={dia}
                      className={cn(
                        // `min-w-0` É O QUE IMPEDE A GRADE DE TRANSBORDAR, e
                        // sem ele a imagem saiu com a coluna de domingo cortada
                        // pela borda da página: um item de grade nasce com
                        // `min-width: auto`, ou seja, ele se recusa a ficar
                        // menor que o conteúdo — e aí sete colunas com um
                        // título longo dentro empurram a tela inteira para o
                        // lado. É a mesma linha que o board e a matriz do Day
                        // Off já pagaram.
                        "bg-surface-card min-h-28 min-w-0 p-1.5",
                        // O dia de outro mês recua pelo TOM e não por
                        // opacidade, e some não é opção: a semana precisa dele
                        // para não quebrar.
                        foraDoMes && "bg-surface-page",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center rounded text-xs tabular-nums",
                            foraDoMes ? "text-text-muted" : "text-text-primary",
                            dia === hoje &&
                              "bg-blue-soft text-text-primary font-semibold",
                          )}
                        >
                          {Number(dia.slice(8))}
                        </span>

                        {doDia.length > CABEM_NA_CELULA ? (
                          <Link
                            href={`${comFrente(frente)}&dia=${dia}`}
                            scroll={false}
                            className="text-accent-strong text-[0.65rem] hover:underline"
                          >
                            +{doDia.length - CABEM_NA_CELULA}
                          </Link>
                        ) : null}
                      </div>

                      <div className="mt-1 space-y-1">
                        {doDia.slice(0, CABEM_NA_CELULA).map((item) => (
                          <Chip key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------- no celular --
              Sete colunas em 375px dão 50px por dia, e 50px não cabem o
              título de nada. A troca é por CSS e não por medir a janela: medir
              faria o servidor desenhar uma das duas e o navegador trocar
              depois, com o salto na tela. */}
            <div className="space-y-4 sm:hidden">
              {dias
                .filter(
                  (dia) =>
                    mesDe(dia) === mes && (mapa.get(dia)?.length ?? 0) > 0,
                )
                .map((dia) => (
                  <section key={dia} className="space-y-2">
                    <h3
                      className={cn(
                        "text-sm font-medium first-letter:uppercase",
                        dia === hoje && "text-accent-strong",
                      )}
                    >
                      {format(parseISO(dia), "EEEE, d 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </h3>
                    <div className="space-y-1">
                      {(mapa.get(dia) ?? []).map((item) => (
                        <Chip key={item.id} item={item} larga />
                      ))}
                    </div>
                  </section>
                ))}
            </div>

            {/* ---------------------------------------------- o dia aberto --
              O "+N" abre o dia AQUI e não numa janela flutuante: a janela
              que o roteiro pede teria dentro dela um link por item e mais
              nada, e aí ela é um clique a mais para chegar onde o chip já
              chega. Em baixo da grade ela é uma seção, que o link da URL
              sabe reabrir. */}
            {diaAberto && doDiaAberto.length > 0 ? (
              <section className="bg-surface-card rounded-card shadow-cartao space-y-2 border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold first-letter:uppercase">
                    {format(parseISO(diaAberto), "EEEE, d 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </h3>
                  <Link
                    href={comFrente(frente)}
                    scroll={false}
                    className="text-text-muted hover:text-foreground text-xs transition-colors"
                  >
                    Fechar
                  </Link>
                </div>
                <div className="space-y-1">
                  {doDiaAberto.map((item) => (
                    <Chip key={item.id} item={item} larga />
                  ))}
                </div>
              </section>
            ) : null}

            {/* ----------------------------------------------------- legenda --
              ELA DIZ AS DUAS PALAVRAS, que é a única coisa que a cor não
              consegue dizer: o chip do Social marca o dia em que a peça VAI
              AO AR, e os outros dois marcam PRAZO. Sem a frase, a grade
              junta "sai" com "vence" e quem lê escolhe um dos dois sentidos
              para tudo. */}
            <p className="text-text-muted text-xs">
              A cor de cada item é o estado dele. O Social Media marca o dia em
              que a peça vai ao ar; Campanhas e Demandas marcam o prazo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ChipDeFrente({
  href,
  ativo,
  total,
  children,
}: {
  href: string;
  ativo: boolean;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ativo ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        ativo
          ? "bg-action-soft text-action-text border-transparent font-semibold"
          : "text-text-secondary hover:bg-neutral-soft",
      )}
    >
      {children}
      {/* O ZERO APARECE, como na faixa de áreas de Minhas Tasks: aqui a linha
          RESPONDE o que existe no mês, e "nenhum" é resposta. O selo que some
          no zero é o que COBRA uma ação, que não é o caso. */}
      <span className="text-xs tabular-nums opacity-100">{total}</span>
    </Link>
  );
}

function Chip({
  item,
  larga = false,
}: {
  item: ItemDoCronograma;
  larga?: boolean;
}) {
  const sentido = SENTIDO_DA_DATA[item.frente];
  const descricao = `${ROTULO_DA_FRENTE[item.frente]} · ${sentido} · ${rotuloDoStatus(item.status)}${
    item.contexto ? ` · ${item.contexto}` : ""
  }`;

  const conteudo = (
    <>
      {item.titulo}
      <span className="sr-only"> — {descricao}</span>
    </>
  );

  // O `truncate` VAI NO ELEMENTO DE BLOCO, e não num `<span>` por dentro:
  // num elemento inline as três propriedades não recortam nada, e o título
  // sai cortado pela borda da célula SEM as reticências — que é a diferença
  // entre "está truncado" e "está quebrado". O produto já pagou essa uma vez,
  // na lista de itens do detalhe da demanda.
  const classes = cn(
    "block truncate rounded border border-transparent px-1.5 py-1 text-[0.7rem] leading-tight font-medium",
    classesDoChipDeStatus(item.status),
    larga && "text-sm",
  );

  // SEM CAMINHO O CHIP NÃO É LINK, e não um link para lugar nenhum: um alvo
  // que não leva a nada é um clique que a pessoa repete mais forte.
  if (!item.caminho) {
    return (
      <span className={classes} title={`${item.titulo} — ${descricao}`}>
        {conteudo}
      </span>
    );
  }

  return (
    <Link
      href={item.caminho}
      title={`${item.titulo} — ${descricao}`}
      className={cn(classes, "hover:underline")}
    >
      {conteudo}
    </Link>
  );
}
