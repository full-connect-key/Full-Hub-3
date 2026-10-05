"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, FolderPlus, Loader2, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeletorDeRedes } from "@/components/shared/seletor-de-redes";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  ETAPAS_DA_CORRENTE,
  ETAPAS_DA_FUNCAO,
  FUNCOES_DA_CORRENTE,
  ROTULO_DA_PLATAFORMA,
  diaSugeridoDaEtapa,
  nomeDaPastaDoMes,
  rotuloDoDiaDaEtapa,
} from "@/lib/dominio/posts";

import { abrirMesDeSocial, criarPastaDoMesDeSocial } from "./acoes";

import type { PlataformaSocial } from "@/lib/supabase/database.types";

const SEM_VALOR = "__sem__";

/**
 * Uma linha de combinação do diálogo: N posts nestas redes (0082).
 *
 * O `id` existe porque a lista se reordena ao apagar uma linha do meio, e uma
 * `key` por índice faria o React reaproveitar o campo errado — quem digitou 12
 * na segunda linha veria o 12 pular para a terceira ao apagar a primeira.
 */
type Linha = {
  id: number;
  redes: PlataformaSocial[];
  quantidade: string;
};
const TETO = 60;

/**
 * Abrir o mês inteiro de um cliente — sem datas.
 *
 * Decisão do usuário: "mais de dez clientes, todos com social; queria abrir o
 * social de um mês sem definir datas e deixar que a social media e o conteúdo
 * definam o resto". Doze posts abertos um a um é a gestão inventando doze
 * datas que quem produz vai refazer.
 *
 * **A QUANTIDADE É POR REDE**, e é assim que um contrato de social é escrito:
 * "doze no Instagram, quatro no LinkedIn". Um número só obrigaria a dividir de
 * cabeça, e o resultado seria dezesseis posts todos do Instagram.
 *
 * **E A CONTA APARECE ENQUANTO SE DIGITA.** É a mesma razão da prévia das cinco
 * próximas na recorrência: esta é a segunda coisa do produto que cria trabalho
 * em lote, e quem a configura não tem outro jeito de conferir antes de salvar.
 * Sem o total, um zero a mais só aparece quando alguém abre o calendário e vê
 * cento e vinte posts.
 */
export function AbrirOMes({
  clientes,
  equipe,
  driveLigado = false,
}: {
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
  /**
   * A integração com o Drive está configurada?
   *
   * Vem de cima porque `lib/drive/config.ts` é `server-only` — e o botão
   * some quando ela está desligada, em vez de aparecer e responder "não
   * configurado": um botão que ensina a não clicar nele é pior que um botão
   * a menos. É a mesma decisão de "Criar no Drive" no detalhe da demanda.
   */
  driveLigado?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, enviar] = useTransition();

  const [cliente, setCliente] = useState("");
  const [mes, setMes] = useState(() => {
    // O MÊS QUE VEM, e não este: quem abre o mês de social está planejando, e
    // no dia 20 de outubro o mês que se abre é novembro. Abrir em outubro
    // criaria doze posts com vinte dias de atraso no nascimento.
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 7);
  });
  /**
   * AS LINHAS DE COMBINAÇÃO (0082), e não um número por rede.
   *
   * Decisão do usuário: *"permita juntar duas redes sociais, já que tudo que
   * postamos no Instagram postamos no Facebook"*. Uma grade com sete campos
   * não sabe dizer isso — ela pede UM número POR rede, e doze no Instagram
   * mais doze no Facebook são vinte e quatro peças, vinte e quatro decisões
   * do cliente e vinte e quatro correntes de cinco etapas para um trabalho
   * que aconteceu doze vezes.
   *
   * Cada linha é "N posts nestas redes". A quantidade é TEXTO e não número,
   * como era antes: apagar o campo precisa deixá-lo vazio em vez de virar
   * zero.
   *
   * **Nasce com uma linha**, e não com zero: a tela abre mostrando o que ela
   * pede, em vez de um botão "adicionar" acima de nada.
   */
  const [linhas, setLinhas] = useState<Linha[]>(() => [
    { id: 1, redes: ["instagram"], quantidade: "" },
  ]);
  const proximoId = useRef(2);
  const [pasta, setPasta] = useState("");
  const [criandoPasta, criarPasta] = useTransition();
  const [responsaveis, setResponsaveis] = useState<Record<string, string>>({});

  // O TOTAL CONTA POSTS, e nunca posts vezes redes — é a conta inteira desta
  // mudança, e a mesma que `abrir_mes_de_social()` faz do outro lado. Se as
  // duas discordarem, o diálogo promete um número e o banco abre outro.
  const total = useMemo(
    () =>
      linhas.reduce((soma, l) => {
        const n = Number.parseInt(l.quantidade, 10);
        return soma + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [linhas],
  );

  // UMA LINHA COM NÚMERO E SEM REDE é recusada pelo banco, e a tela desliga o
  // botão antes em vez de deixar a recusa chegar depois de tudo preenchido.
  const linhaSemRede = linhas.some(
    (l) => Number.parseInt(l.quantidade, 10) > 0 && l.redes.length === 0,
  );

  /**
   * O dia de cada etapa, em dias relativos à publicação.
   *
   * **Começa PREENCHIDO com a sugestão da corrente**, e é a mesma escolha do
   * modelo de campanha: ponto de partida, não contrato. Cinco campos vazios
   * fariam quem abre o mês inventar cinco números — e inventar data é o que a
   * 0044 evita ao abrir o mês em branco.
   *
   * Guardado como TEXTO e não como número, como as quantidades logo acima:
   * apagar o campo precisa deixá-lo vazio em vez de virar zero, e zero aqui
   * quer dizer "no dia da publicação", que é uma escolha de verdade.
   */
  const [prazos, setPrazos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ETAPAS_DA_CORRENTE.map((e) => [e.nome, diaSugeridoDaEtapa(mes, e.diasAntesDoMes)]),
    ),
  );

  /**
   * TROCAR O MÊS REFAZ AS CINCO DATAS, e isto é o que o offset dava de graça.
   *
   * Com número, "10 dias antes" valia para qualquer mês; com data, abrir o
   * diálogo em novembro e trocar para janeiro deixaria as cinco em outubro —
   * a corrente inteira três meses antes do mês que ela produz, sem nada na
   * tela dizendo. A recusa do banco não pegaria: datas em outubro para o mês
   * de janeiro são uma corrente perfeitamente ordenada.
   *
   * **Só reescreve o que ainda é a sugestão.** Quem já mexeu num campo mandou,
   * e refazer tudo apagaria a escolha de quem trocou o mês depois de ajustar —
   * é a ordem de `coalesce(etapa, padrão)` da 0041, aqui no navegador.
   */
  function trocarMes(novo: string) {
    setPrazos((atual) =>
      Object.fromEntries(
        ETAPAS_DA_CORRENTE.map((e) => [
          e.nome,
          atual[e.nome] === diaSugeridoDaEtapa(mes, e.diasAntesDoMes)
            ? diaSugeridoDaEtapa(novo, e.diasAntesDoMes)
            : (atual[e.nome] ?? ""),
        ]),
      ),
    );
    setMes(novo);
  }

  const excede = total > TETO;
  // A PASTA ENTRA NA CONDIÇÃO, e é o que muda desde a 0061: o mês deixou de
  // ser N posts soltos e virou uma DEMANDA com um post em cada etapa — e
  // `tasks_exige_pasta_de_entrega` recusa demanda nova sem pasta desde a 0015.
  //
  // A tela cobra antes para a recusa não chegar depois de sete campos
  // preenchidos; quem vale é o banco, e é ele que pega quem chamar a RPC
  // direto.
  const podeAbrir =
    !!cliente && total > 0 && !excede && !linhaSemRede && pasta.trim().length > 0;

  function criarNoDrive() {
    criarPasta(async () => {
      const r = await chamarAcao(() => criarPastaDoMesDeSocial(cliente, mes));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setPasta(r.dados ?? "");
      toast.success(r.mensagem);
    });
  }

  function enviarFormulario() {
    // A LINHA ZERADA NÃO VIAJA: ela é só uma linha que ninguém preencheu, e
    // mandá-la faria o banco recusar falando de rede quando o que falta é
    // número.
    const combinacoes = linhas
      .map((l) => ({ redes: l.redes, quantidade: Number.parseInt(l.quantidade, 10) }))
      .filter((l) => Number.isFinite(l.quantidade) && l.quantidade > 0);

    enviar(async () => {
      const r = await chamarAcao(() =>
        abrirMesDeSocial({
          client_id: cliente,
          mes,
          quantidades: combinacoes,
          responsaveis: Object.fromEntries(
            Object.entries(responsaveis).map(([f, v]) => [f, v === SEM_VALOR ? null : v]),
          ),
          link_entrega: pasta.trim(),
          // A ETAPA SEM DIA NÃO VIAJA, pela mesma razão dos responsáveis:
          // mandar `{"Layout": null}` faria o banco gravar nulo por cima de
          // nada, e o mapa passaria a dizer que alguém escolheu "sem dia".
          prazos: Object.fromEntries(
            Object.entries(prazos).filter(([, v]) => v.trim().length > 0),
          ),
        }),
      );

      if (!r.ok) {
        toast.error(r.error);
        return;
      }

      toast.success(r.mensagem);
      setAberto(false);
      setLinhas([{ id: proximoId.current++, redes: ["instagram"], quantidade: "" }]);
      setPasta("");
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlus aria-hidden className="size-4" />
          Abrir o mês
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Abrir o mês de social</DialogTitle>
          <DialogDescription>
            Os posts nascem sem data e sem tema definitivo. Quem produz escolhe o
            dia e escreve o resto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mes-cliente">Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                {/* `w-full`: o SelectTrigger nasce `w-fit` e num grid vira um
                    botão só com a setinha. */}
                <SelectTrigger aria-label="Cliente" id="mes-cliente" className="w-full">
                  <SelectValue placeholder="Escolha a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mes-mes">Mês</Label>
              <Input
                id="mes-mes"
                type="month"
                value={mes}
                onChange={(e) => trocarMes(e.target.value)}
              />
            </div>
          </div>

          {/*
            A PASTA DE ENTREGA DO MÊS.

            Ela aparece aqui, logo abaixo de cliente e mês, porque é deles que
            o nome dela sai — e porque é o campo que decide se o botão do fim
            funciona. No fim da tela ela seria a surpresa depois de sete campos
            preenchidos.
          */}
          <div className="space-y-1.5">
            <Label htmlFor="mes-pasta">Pasta de entrega do mês</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="mes-pasta"
                type="url"
                inputMode="url"
                className="min-w-48 flex-1"
                placeholder="https://drive.google.com/..."
                value={pasta}
                onChange={(e) => setPasta(e.target.value)}
              />
              {/* O BOTÃO SOME QUANDO JÁ HÁ ENDEREÇO, como no detalhe da
                  demanda: "Criar no Drive" ao lado de um campo preenchido
                  convida a criar a segunda pasta do mesmo mês — e o Drive
                  aceita duas irmãs homônimas sem reclamar, o que espalha o
                  material entre as duas. */}
              {driveLigado && pasta.trim().length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={criarNoDrive}
                  disabled={!cliente || criandoPasta}
                >
                  {criandoPasta ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <FolderPlus aria-hidden className="size-4" />
                  )}
                  Criar no Drive
                </Button>
              ) : null}
            </div>
            <p className="text-text-secondary text-xs">
              O mês inteiro é uma demanda só — “{nomeDaPastaDoMes(mes)}” —, com um
              post em cada etapa. Toda demanda precisa da pasta onde o material
              final vai ficar.
            </p>
          </div>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-text-primary text-sm font-semibold">
                Quantos posts, e em que redes
              </h3>
              <span
                className={cnTotal(excede)}
                aria-live="polite"
              >
                {total === 0
                  ? "nenhum ainda"
                  : total === 1
                    ? "1 post"
                    : `${total} posts`}
              </span>
            </div>

            <ul className="space-y-3">
              {linhas.map((linha, i) => (
                <li
                  key={linha.id}
                  className="border-border space-y-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`qtd-${linha.id}`} className="text-xs">
                      Quantos
                    </Label>
                    <Input
                      id={`qtd-${linha.id}`}
                      type="number"
                      min={0}
                      max={TETO}
                      inputMode="numeric"
                      placeholder="0"
                      className="w-20"
                      value={linha.quantidade}
                      onChange={(e) =>
                        setLinhas((atual) =>
                          atual.map((l) =>
                            l.id === linha.id ? { ...l, quantidade: e.target.value } : l,
                          ),
                        )
                      }
                    />
                    <span className="text-text-muted text-xs">em</span>

                    {/* A LINHA SÓ SE APAGA QUANDO HÁ MAIS DE UMA: com uma só,
                        o botão esvaziaria a seção e deixaria a pessoa olhando
                        para um "adicionar" acima de nada. */}
                    {linhas.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover a linha ${i + 1}`}
                        className="ml-auto"
                        onClick={() =>
                          setLinhas((atual) => atual.filter((l) => l.id !== linha.id))
                        }
                      >
                        <X aria-hidden className="size-4" />
                      </Button>
                    ) : null}
                  </div>

                  <SeletorDeRedes
                    valor={linha.redes}
                    rotulo={`Redes da linha ${i + 1}`}
                    aoMudar={(redes) =>
                      setLinhas((atual) =>
                        atual.map((l) => (l.id === linha.id ? { ...l, redes } : l)),
                      )
                    }
                  />

                  {/* A FRASE DIZ A CONTA, porque ela é o ponto inteiro: quem
                      marca duas redes precisa ler, antes de salvar, que são
                      quatro peças e não oito. */}
                  <p className="text-text-muted text-xs">
                    {linha.redes.length === 0
                      ? "Escolha ao menos uma rede."
                      : linha.redes.length === 1
                        ? `${ROTULO_DA_PLATAFORMA[linha.redes[0]]}.`
                        : `A mesma peça sai em ${linha.redes
                            .map((r) => ROTULO_DA_PLATAFORMA[r])
                            .join(" e ")} — uma arte, uma aprovação do cliente.`}
                  </p>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLinhas((atual) => [
                  ...atual,
                  { id: proximoId.current++, redes: [], quantidade: "" },
                ])
              }
            >
              <Plus aria-hidden className="size-4" />
              Outra combinação
            </Button>

            {/* O TETO AVISA ANTES DE O BANCO RECUSAR, e diz o que fazer no
                lugar — é a mesma frase do `hint` do Postgres. Descobrir o
                limite pela recusa depois de preencher sete campos é descobrir
                tarde. */}
            {linhaSemRede ? (
              <p className="text-danger text-xs">
                Há uma linha com quantidade e sem rede nenhuma. Escolha a rede ou
                zere o número.
              </p>
            ) : null}

            {excede ? (
              <p className="text-danger text-xs">
                São {total} posts de uma vez, e o limite é {TETO}. Se o número está
                certo, abra em duas vezes — assim um zero a mais não vira sessenta
                posts para apagar.
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              Quem faz cada parte
            </h3>
            {/* UMA PESSOA POR FUNÇÃO e não uma por post: são as mesmas pessoas
                todo mês, e perguntar doze vezes seria perguntar doze vezes a
                mesma coisa. Cada linha diz quais etapas aquela função carrega,
                senão "Design" não conta a quem escolhe que essa pessoa pega
                também os ajustes que o cliente pedir. */}
            <div className="space-y-2">
              {FUNCOES_DA_CORRENTE.map((funcao) => (
                <div key={funcao} className="grid gap-1.5 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                  <Label htmlFor={`resp-${funcao}`} className="block">
                    <span className="text-text-primary text-sm">{funcao}</span>
                    <span className="text-text-muted block text-xs">
                      {ETAPAS_DA_FUNCAO[funcao]}
                    </span>
                  </Label>
                  <Select
                    value={responsaveis[funcao] ?? SEM_VALOR}
                    onValueChange={(v) =>
                      setResponsaveis((atual) => ({ ...atual, [funcao]: v }))
                    }
                  >
                    <SelectTrigger aria-label="Responsável da etapa" id={`resp-${funcao}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VALOR}>Decidir depois</SelectItem>
                      {equipe.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          {/*
            QUANDO CADA ETAPA VENCE.
            
            Esta seção é o que faz o mês aberto entrar no calendário das
            pessoas: sem ela as cinco etapas nascem sem dia nenhum, e uma etapa
            sem data não aparece no Calendário Full de ninguém — existe na
            tabela e não existe na tela, que é o pior dos dois estados.
          */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Quando cada etapa vence</h3>
              {/* A FRASE NÃO CARREGA O TOTAL, e a primeira versão carregava:
                  com a seção de quantidades ainda vazia ela dizia "a Pauta dos
                  N posts", que é a tela pedindo à pessoa que leia uma letra no
                  lugar de um número. O que importa aqui é a REGRA, e ela não
                  depende de quantos são. */}
              <p className="text-text-secondary text-xs">
                Um dia para cada etapa, valendo para o mês inteiro: a Pauta de
                todos os posts é feita num dia só, o Conteúdo noutro. O dia não
                muda quando um post troca de data de publicação.
              </p>
            </div>

            <div className="grid gap-2">
              {ETAPAS_DA_CORRENTE.map((etapa) => {
                const bruto = prazos[etapa.nome] ?? "";
                return (
                  // GRADE DE TRÊS COLUNAS, e não `flex-wrap`: em 375px a
                  // frase do Programar ("no dia da publicação") é mais longa
                  // que as outras quatro, quebrava para a linha de baixo e
                  // ficava órfã embaixo do campo, sem alinhamento com nada. Foi
                  // a imagem de 375px que mostrou. Com a grade, ela quebra
                  // DENTRO da própria coluna e continua ao lado do número a que
                  // se refere.
                  <div
                    key={etapa.nome}
                    className="grid grid-cols-[minmax(4.5rem,auto)_9.5rem_1fr] items-center gap-2"
                  >
                    <Label
                      htmlFor={`prazo-${etapa.nome}`}
                      className="text-sm font-medium"
                    >
                      {etapa.nome}
                    </Label>
                    <Input
                      id={`prazo-${etapa.nome}`}
                      type="date"
                      className="w-full"
                      value={bruto}
                      onChange={(e) =>
                        setPrazos((atual) => ({ ...atual, [etapa.nome]: e.target.value }))
                      }
                    />
                    {/*
                      A FRASE AO LADO DO NÚMERO, porque `-3` não é português.
                      O campo aceita o número, que é o que se digita rápido; a
                      frase é o que se confere. É a mesma razão da prévia das
                      cinco próximas ocorrências da recorrência: quem configura
                      trabalho em lote não tem outro jeito de ver o que escolheu.
                    */}
                    {/*
                      O DIA DA SEMANA AO LADO DA DATA, e não a data repetida: o
                      campo já mostra 05/10, e o que ele não diz é que 05/10 é
                      uma terça. Marcar a pauta do mês num sábado é o erro que
                      só essa palavra pega — é a razão pela qual a frase existia
                      na 0059 ("3 dias antes", porque `-3` não é português),
                      aplicada ao que o campo passou a aceitar.
                    */}
                    <span className="text-text-secondary text-xs">
                      {rotuloDoDiaDaEtapa(bruto)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviarFormulario} disabled={!podeAbrir || enviando}>
            {enviando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {total > 0 && !excede ? `Abrir ${total} posts` : "Abrir o mês"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnTotal(excede: boolean) {
  return excede
    ? "text-danger text-xs font-medium tabular-nums"
    : "text-text-secondary text-xs tabular-nums";
}
