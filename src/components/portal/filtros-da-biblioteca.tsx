"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEM_VERTENTE, type FiltrosDaBiblioteca } from "@/lib/dominio/biblioteca";
import {
  ROTULO_DA_FRENTE,
  type FrenteDoCronograma,
} from "@/lib/dominio/cronograma";
import type { Vertente } from "@/lib/dominio/vertentes";
import { cn } from "@/lib/utils";

/**
 * A NAVEGAÇÃO E OS FILTROS DA BIBLIOTECA.
 *
 * ---------------------------------------------------------------------------
 * **Ela se chamava `BuscaDaBiblioteca` e carregava um controle.** Com quatro,
 * um nome que descreve um deles manda quem vier depois procurar os outros em
 * outro arquivo — é `pessoasDaLinhaDoTempo` de novo. O ARIA do campo não
 * mudou: `aria-label="Buscar material"` é o seletor de clique do protótipo, e
 * trocá-lo deixaria a imagem da busca saindo em repouso sem nada reclamar.
 *
 * **Um componente só escreve na URL, e é este.** Dois componentes montando o
 * mesmo `URLSearchParams` é a divergência esperando acontecer: o segundo
 * apagaria o parâmetro do primeiro no dia em que alguém esquecesse de
 * carregá-lo adiante.
 *
 * **Tudo mora na URL**, como toda listagem do produto: "manda o link do que a
 * gente aprovou de Lojas Próprias" precisa ser um link, e é isso que permite a
 * grade inteira ser componente de servidor.
 *
 * **`replace` e não `push`**, pela razão do seletor de visão: cada tecla
 * viraria uma entrada no histórico, e o "voltar" do navegador andaria letra
 * por letra em vez de sair da tela.
 * ---------------------------------------------------------------------------
 * **SÃO DUAS FILEIRAS, e elas fazem trabalhos diferentes.**
 *
 * A de cima é a **navegação por vertente** — o que o pedido chama de
 * *"navegação por vertente dentro da Biblioteca"* —, com "Todos os materiais"
 * na primeira posição. A de baixo são os **filtros**: a busca, a frente e o
 * mês. Numa fileira só, dez chips de duas dimensões se leem como dez chips
 * soltos, que é o que a faixa do Social já pagou uma vez.
 * ---------------------------------------------------------------------------
 */
function Chip({
  ativo,
  children,
  aoClicar,
}: {
  ativo: boolean;
  children: React.ReactNode;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        // min-h-9 é o alvo mínimo confortável para o polegar.
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
        ativo
          ? "border-accent-strong bg-accent text-accent-foreground font-medium"
          : "hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/**
 * "2026-10" → "outubro de 2026".
 *
 * **Local e não exportada**: `export` de arquivo `"use client"` chega ao
 * servidor como referência de cliente, e `rotuloDoMes(...)` lá estoura com
 * "is not a function" — sem o `build` reclamar. Quem precisar dela no servidor
 * a tira para `lib/dominio/`.
 */
function rotuloDoMes(mes: string): string {
  return format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

export function FiltrosDaBiblioteca({
  filtros,
  encontrados,
  temAlgum,
  vertentes,
  porVertente,
  frentes,
  meses,
  formatos,
}: {
  filtros: FiltrosDaBiblioteca;
  encontrados: number;
  /** Sem nada guardado a barra some: filtrar zero é um controle que não decide nada. */
  temAlgum: boolean;
  /**
   * As vertentes CADASTRADAS na conta, quando o acervo é de uma empresa só.
   *
   * Vazia quando a conta não tem vertente nenhuma — que é o caso comum — ou
   * quando o acervo mistura duas contas: a razão está em
   * `ArquivoDaBiblioteca.clienteId`.
   */
  vertentes: Vertente[];
  /**
   * Quantos materiais caem em cada vertente, e em `SEM_VERTENTE`.
   *
   * **`Record` e não `Map`**: ele atravessa a fronteira servidor → cliente, e
   * um tipo que depende do serializador para sobreviver é um tipo que falha
   * num lugar onde o `build` não reclama.
   */
  porVertente: Record<string, number>;
  /** As frentes que o acervo TEM, na ordem do cronograma. */
  frentes: FrenteDoCronograma[];
  /** Os meses que o acervo TEM, do mais novo para o mais antigo. */
  meses: string[];
  /**
   * OS FORMATOS que o acervo TEM — "JPG", "PDF", "MP4" —, em ordem.
   *
   * **Vazia é o caso normal de um acervo sem arquivo nenhum**, e aí o seletor
   * não é desenhado: é essa ausência que faz este filtro poder existir sem a
   * ressalva que o deixou de fora da 0119 — *"metade da grade não tem arquivo
   * nenhum"*. Um seletor de três formatos num acervo onde nenhum material cai
   * em nenhum deles é a aba "Site" do cronograma outra vez.
   */
  formatos: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function navegar(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") proximos.delete(chave);
      else proximos.set(chave, valor);
    }
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  if (!temAlgum) return null;

  const algumAtivo =
    filtros.busca !== "" ||
    filtros.vertente !== null ||
    filtros.frente !== null ||
    filtros.mes !== null;

  // O CHIP "SEM VERTENTE" SÓ APARECE QUANDO HÁ MATERIAL NELE, ao contrário dos
  // chips de vertente cadastrada. A diferença é o que cada um afirma: um chip
  // de frente cadastrada e vazia diz "esta frente existe e ainda não tem
  // material", que é informação; um chip "Sem vertente" com zero diz que
  // existe uma categoria que não existe.
  const semVertente = porVertente[SEM_VERTENTE] ?? 0;

  // A DESATIVADA SÓ APARECE QUANDO TEM MATERIAL, e foi a imagem que mandou:
  // "Feiras e eventos (desativada) 0" ocupa uma linha inteira do celular para
  // dizer que uma frente aposentada nunca teve nada.
  //
  // **E isso aperta a regra do zero em vez de desfazê-la.** Uma vertente ATIVA
  // com zero diz "esta frente existe e ainda não tem material", que é
  // informação — é a faixa de áreas de Minhas Tasks, onde o zero é resposta.
  // Uma aposentada com zero não diz nada: ela não vai receber material nunca
  // mais. O único motivo de ela continuar na fileira é o material que ela já
  // tem, que sem o chip cairia em "Sem vertente" — uma afirmação falsa.
  const naFileira = vertentes.filter(
    (v) => v.ativa || (porVertente[v.id] ?? 0) > 0,
  );

  return (
    <div className="space-y-4">
      {naFileira.length > 0 ? (
        <nav aria-label="Vertentes da conta" className="flex flex-wrap gap-2">
          <Chip
            ativo={filtros.vertente === null}
            aoClicar={() => navegar({ vertente: null })}
          >
            Todos os materiais
          </Chip>

          {naFileira.map((v) => (
            <Chip
              key={v.id}
              ativo={filtros.vertente === v.id}
              aoClicar={() =>
                navegar({ vertente: filtros.vertente === v.id ? null : v.id })
              }
            >
              {/* A DESATIVADA CONTINUA NA FILEIRA, e diz que está. O material
                  dela não deixa de ser daquela frente quando a agência a
                  aposenta, e some-la poria aquele material em "Sem vertente" —
                  uma afirmação falsa. É a decisão do seletor da demanda, que
                  mostra a desativada já escolhida. */}
              {v.ativa ? v.nome : `${v.nome} (desativada)`}
              <span className="text-text-muted tabular-nums">
                {porVertente[v.id] ?? 0}
              </span>
            </Chip>
          ))}

          {/* ELE FICA QUANDO ESTÁ ESCOLHIDO, mesmo zerado pelos outros
              filtros: um chip ativo que some é a tela negando o que a URL diz,
              e aí não há onde clicar para desfazer. */}
          {semVertente > 0 || filtros.vertente === SEM_VERTENTE ? (
            <Chip
              ativo={filtros.vertente === SEM_VERTENTE}
              aoClicar={() =>
                navegar({
                  vertente:
                    filtros.vertente === SEM_VERTENTE ? null : SEM_VERTENTE,
                })
              }
            >
              Sem vertente
              <span className="text-text-muted tabular-nums">
                {semVertente}
              </span>
            </Chip>
          ) : null}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {/* A BUSCA OCUPA A LINHA INTEIRA NO CELULAR, e isso foi a imagem de
            375px: com `flex-1 min-w-0` ela dividia a linha com os chips de
            frente e a contagem, e o `min-w-0` deixava o campo encolher até
            virar um DISCO de 40px — o ícone da lupa e nada mais, sem onde
            digitar. Um campo que some num tamanho de tela é pior que um campo
            a menos, porque o controle continua ali parecendo um botão.

            `basis-full` até `sm`, e aí ele volta a dividir a linha. */}
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:basis-auto sm:max-w-xs">
          <Search
            aria-hidden
            className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            // `defaultValue` E NÃO `value`: com o valor controlado por uma
            // navegação de servidor, o cursor pula para o fim a cada tecla.
            defaultValue={filtros.busca}
            onChange={(evento) => navegar({ busca: evento.target.value })}
            placeholder="Buscar por nome, campanha ou demanda"
            aria-label="Buscar material"
            className="rounded-full pl-9"
          />
        </div>

        {/* A FRENTE EM CHIPS e o MÊS EM SELETOR, e a diferença é quantos são.
            A frente tem três valores e não cresce; o mês cresce com a conta, e
            vinte e quatro chips são a fileira de catorze pílulas que a faixa do
            Social desfez. O argumento do portal contra o `<select>` é sobre
            escolher "entre três coisas" — ele vale para a frente e é o
            contrário para o mês, onde a roda nativa é melhor que a rolagem. */}
        {frentes.length > 1
          ? frentes.map((frente) => (
              <Chip
                key={frente}
                ativo={filtros.frente === frente}
                aoClicar={() =>
                  navegar({
                    frente: filtros.frente === frente ? null : frente,
                  })
                }
              >
                {ROTULO_DA_FRENTE[frente]}
              </Chip>
            ))
          : null}

        {/* O FORMATO VEM DEPOIS DA FRENTE E ANTES DO MÊS, que é a ordem do
            que a pessoa procura: a frente diz de que módulo o material é, o
            formato diz o que ele É, e o mês é o recorte de tempo — o último
            porque é o que ela afrouxa quando não acha. */}
        {formatos.length > 1 ? (
          <Select
            value={filtros.formato ?? "todos"}
            onValueChange={(valor) =>
              navegar({ formato: valor === "todos" ? null : valor })
            }
          >
            <SelectTrigger
              className="w-auto min-w-36 rounded-full"
              aria-label="Filtrar por formato de arquivo"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer formato</SelectItem>
              {formatos.map((formato) => (
                <SelectItem key={formato} value={formato}>
                  {formato}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {meses.length > 1 ? (
          <Select
            value={filtros.mes ?? "todos"}
            onValueChange={(valor) =>
              navegar({ mes: valor === "todos" ? null : valor })
            }
          >
            <SelectTrigger
              className="w-auto min-w-40 rounded-full"
              aria-label="Filtrar por mês"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer data</SelectItem>
              {meses.map((mes) => (
                <SelectItem key={mes} value={mes}>
                  {rotuloDoMes(mes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <p className="text-text-muted text-sm">
          {/* A CONTAGEM É A DO RECORTE, e não a do acervo inteiro: ela está ao
              lado dos controles que acabaram de produzi-la, e um número que não
              muda quando se filtra é um número sobre outra coisa. */}
          {encontrados} {encontrados === 1 ? "material" : "materiais"}
        </p>

        {algumAtivo ? (
          <button
            type="button"
            onClick={() =>
              navegar({ busca: null, vertente: null, frente: null, mes: null })
            }
            className="text-text-muted hover:text-foreground inline-flex items-center gap-1 text-sm underline underline-offset-4"
          >
            <X aria-hidden className="size-3.5" />
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}
