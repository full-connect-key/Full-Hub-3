"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FolderPlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

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
import { FaixaDeDisponibilidade } from "@/components/shared/faixa-de-disponibilidade";
import { SecaoDoFormulario } from "@/components/shared/secao-do-formulario";
import { SeletorDeRedes } from "@/components/shared/seletor-de-redes";
import { chamarAcao } from "@/lib/acoes/cliente";
import { ROTULOS_DE_FUNCAO } from "@/lib/dominio/equipe";
import {
  ROTULO_DA_PLATAFORMA,
  nomeDaPastaDoMes,
  rotuloDoDiaDaEtapa,
} from "@/lib/dominio/posts";
import {
  funcoesDoFluxo,
  periodosSugeridosDoFluxo,
  type PeriodoSugerido as Periodo,
  type FluxoDeSocial,
} from "@/lib/dominio/social-flows";

import { abrirMesDeSocial, criarPastaDoMesDeSocial } from "./acoes";
import { buscarDisponibilidade } from "../gestao-tasks/acoes-de-itens";

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

/**
 * Os períodos sugeridos de uma corrente, a partir do mês.
 *
 * **ELES SÃO DERIVADOS DA SEQUÊNCIA (0089)**, e não mais de dois números
 * guardados em cada elo do fluxo — decisão do usuário: o fluxo é a sequência de
 * ações, e a data é do mês. A conta mora em `lib/dominio/social-flows.ts`, num
 * lugar só: ela é chamada aqui no estado inicial e de novo ao trocar o mês, e
 * duas cópias divergiriam na primeira vez que alguém mexesse numa.
 */
/**
 * O DIA SUGERIDO DE CADA ETAPA — e a ENTREGA nasce em branco.
 *
 * Decisão do usuário: *"quero que a data de final fique sempre em branco, pois
 * na maioria dos casos a task dura apenas um dia. E caso a pessoa vá ter mais
 * de um dia para fazer, o atendimento pode preencher a data de entrega
 * também"*.
 *
 * **O BLOCO CONTINUA SENDO CALCULADO, e é dele que sai o dia.**
 * `periodosSugeridosDoFluxo()` divide a janela de trinta dias que antecede o
 * mês pelos elos da corrente (0089), e o INÍCIO de cada bloco já é o que esta
 * tela precisa: N dias espalhados pela janela, em ordem, um por etapa. Tirar a
 * conta de lá para refazê-la aqui seriam duas respostas para a mesma pergunta —
 * e a de lá é a que o fluxo de três elos e o de dez já atendem.
 *
 * **A ENTREGA EM BRANCO QUER DIZER "UM DIA", e a tela diz isso por extenso.**
 * Ela não fica nula no banco: `disponibilidade_bruta()` (0081) filtra
 * `prazo is not null`, então uma fase sem prazo **sai da carga de todo mundo** e
 * não tem prazo em Minhas Tasks — seria desfazer a outra metade do que ele
 * pediu, que é a carga aparecer. O que viaja é `fim = inicio`, que é a verdade
 * de uma etapa de um dia: ela começa e vence no mesmo dia.
 */
function diasSugeridos(mes: string, etapas: { nome: string }[]) {
  return Object.fromEntries(
    Object.entries(periodosSugeridosDoFluxo(mes, etapas)).map(([nome, periodo]) => [
      nome,
      { inicio: periodo.inicio, fim: "" },
    ]),
  ) as Record<string, Periodo>;
}

const TETO = 60;

/**
 * Abrir o mês inteiro de um cliente — sem datas.
 *
 * ---------------------------------------------------------------------------
 * **ELA É UMA TELA E NÃO MAIS UM DIÁLOGO**, por decisão do usuário: *"quando
 * vou abrir uma task do social, gostaria que a visualização de abertura seja
 * igual a do rascunho de quando vou abrir uma task comum, mas com todas as
 * informações que ele já me pede para preencher atualmente"*.
 *
 * **O DIÁLOGO COBRAVA DOS DOIS LADOS, e os dois pioraram com o tempo.** Ele
 * nasceu com quatro campos na 0044 e chegou aqui com seis seções — cliente e
 * mês, pasta, as combinações de rede, o fluxo, as funções a distribuir e o
 * período de cada etapa —, numa coluna de 512px que rola dentro de si mesma:
 * quem está no período da quinta etapa não vê mais o mês que ele escolheu na
 * primeira, e é o mês que decide as cinco datas. E a largura não dava para a
 * faixa de disponibilidade, que é a outra metade do pedido.
 *
 * **AS SEÇÕES SÃO NUMERADAS, e é o mesmo `SecaoDoFormulario` do Day Off** —
 * "formulário longo vai em seções numeradas", a regra que nasceu no Nova Task
 * e virou compartilhada. O número dá à conversa um jeito de apontar ("faltou a
 * 5") sem descrever onde o campo fica.
 *
 * **O QUE NÃO MUDOU É O QUE A TELA PEDE.** Nenhum campo saiu, nenhum entrou, e
 * nenhuma ordem trocou: a ordem das seis é a ordem da decisão, e o fluxo
 * continua vindo antes das funções e dos períodos porque é ele que decide
 * QUAIS funções a tela pede e QUAIS campos de data existem.
 * ---------------------------------------------------------------------------
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
  fluxos,
  driveLigado = false,
}: {
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
  /**
   * Os fluxos ATIVOS, com a corrente de cada um (0087).
   *
   * **Eles vêm de cima e não de uma consulta aqui**, pela razão de
   * `driveLigado`: `lib/dados/social-flows.ts` é `server-only`. E a corrente
   * inteira viaja, não só o nome — é dela que saem os campos de período, as
   * funções a distribuir e os portões que a tela anuncia.
   */
  fluxos: FluxoDeSocial[];
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
  /**
   * QUAL FAIXA DE DISPONIBILIDADE ESTÁ ABERTA, e só uma por vez.
   *
   * Decisão do usuário: *"quero que o calendário da pessoa que vai fazer cada
   * etapa, mostre também a carga de tasks que a pessoa já está, igual é feito
   * atualmente"*. É a MESMA faixa do painel da etapa em Gestão de Tasks —
   * `nivelDaCarga()` e `COR_DO_NIVEL` de `lib/dominio/calendario.ts` —, e não
   * uma segunda escala: duas seriam descobertas pela pessoa no dia em que uma
   * tela pintasse de verde o dia que a outra pintou de âmbar.
   *
   * **Ela nasce FECHADA, e abre uma por vez.** Cinco grades de mês abertas
   * ocupariam a tela inteira e disputariam com os campos que elas existem para
   * preencher — e a faixa é consulta, não o trabalho. Uma por vez e não um
   * conjunto aberto porque a pergunta é sobre UMA pessoa num dia: duas grades
   * lado a lado convidam a comparar duas pessoas, que é outra tela.
   */
  const [faixaAberta, setFaixaAberta] = useState<string | null>(null);

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
  /**
   * O PERÍODO de cada etapa (0084), e não mais só o dia de vencer.
   *
   * Decisão do usuário: *"quero que coloque data de início e final da task,
   * que deve se repetir em todos os posts"*. É a 0027 um nível abaixo — a
   * etapa de demanda ganhou período pelo mesmo argumento, e aqui a falta doía
   * mais: a Pauta do mês inteiro é um bloco de trabalho, e com só o fim ela
   * aparecia inteira num dia e zero nos outros na carga de quem produz.
   */
  /**
   * QUAL FLUXO ESTE MÊS VAI PERCORRER (0087).
   *
   * **Vazio quer dizer "o padrão da conta"**, e é o valor com que o diálogo
   * abre: quem já combinou o fluxo da Mundo Verde na ficha dela não deve
   * escolhê-lo de novo todo mês — é a decisão de a lista ser da CONTA desde a
   * 0076. Quem escolhe aqui está dizendo "este mês é diferente", que é a frase
   * do usuário: *"aplicados em determinados socials, de meses de determinadas
   * contas"*.
   */
  const [fluxoId, setFluxoId] = useState("");

  /**
   * A corrente que a tela desenha: a do fluxo escolhido, senão a do primeiro
   * da lista.
   *
   * **O FALLBACK É UMA ESCOLHA DE DESENHO E NÃO A REGRA**: quem decide de
   * verdade é `fluxo_do_mes()` no banco — conta, depois casa —, e a tela não
   * sabe o padrão da conta sem uma ida a mais. Desenhar os campos do primeiro
   * fluxo é melhor que desenhar nenhum: sem corrente, a seção de períodos
   * aparece vazia e parece quebrada. E a frase embaixo do seletor diz que a
   * conta pode mandar outra coisa, em vez de a tela afirmar o que não sabe.
   */
  const etapasDoFluxo = useMemo(() => {
    const escolhido = fluxos.find((f) => f.id === fluxoId);
    return (escolhido ?? fluxos[0])?.etapas ?? [];
  }, [fluxos, fluxoId]);

  /**
   * AS ETAPAS DE CADA FUNÇÃO, e quantas são.
   *
   * **A PESSOA É POR FUNÇÃO, e isso não mudou com a junção das duas seções.**
   * `abrir_mes_de_social` recebe `p_responsaveis` por FUNÇÃO desde a 0046, e é
   * assim que a agência trabalha: são as mesmas pessoas todo mês. O que mudou é
   * onde o seletor aparece — ele desceu para a linha da etapa, por decisão do
   * usuário: *"quero que junte a parte de escolher a pessoa que vai fazer a
   * etapa com a data que a etapa tem que ser feita"*.
   *
   * **E QUANDO UMA FUNÇÃO CARREGA DUAS ETAPAS, A LINHA DIZ ISSO.** Pauta e
   * Programar são as duas de Social Media (é o exemplo que a 0059 já usava para
   * explicar por que o PRAZO é por nome de etapa e não por função), então os
   * dois seletores mostram a mesma pessoa e mexer num muda o outro. Sem a
   * frase, quem escolhe a Marina na Pauta vê o Programar trocar sozinho e
   * conclui que a tela tem um defeito. É o mesmo cuidado do campo que a tela
   * esconde e o formulário manda: um estado compartilhado que não se anuncia é
   * um estado que parece bug.
   */
  const porFuncao = useMemo(() => {
    const mapa: Record<string, { etapas: string; quantas: number }> = {};
    for (const { funcao, etapas } of funcoesDoFluxo(etapasDoFluxo)) {
      mapa[funcao] = {
        etapas,
        quantas: etapasDoFluxo.filter((e) => e.funcao === funcao).length,
      };
    }
    return mapa;
  }, [etapasDoFluxo]);

  const [prazos, setPrazos] = useState<Record<string, Periodo>>(() =>
    diasSugeridos(mes, fluxos[0]?.etapas ?? []),
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
    const antes = diasSugeridos(mes, etapasDoFluxo);
    const depois = diasSugeridos(novo, etapasDoFluxo);
    setPrazos((atual) =>
      Object.fromEntries(
        etapasDoFluxo.map((e) => {
          const meu = atual[e.nome] ?? { inicio: "", fim: "" };
          // SÓ O DIA É REFEITO, e a entrega fica como está.
          //
          // O dia tem sugestão, então "quem mexeu mandou" se mede comparando
          // com ela — a ordem de `coalesce(etapa, padrão)` da 0041, aqui no
          // navegador. A ENTREGA NÃO TEM SUGESTÃO NENHUMA: toda data que
          // estiver ali foi digitada por alguém, e reescrevê-la apagaria a
          // única escolha da linha.
          //
          // *O custo está dito:* quem digitou a entrega em novembro e trocou
          // para janeiro fica com uma entrega antes do dia da etapa — e isso
          // APARECE, em vermelho, com o botão desligado. Apagar calado seria
          // pior: ela veria o campo que preencheu voltar a vazio sem nada
          // dizendo por quê.
          return [
            e.nome,
            {
              inicio:
                meu.inicio === antes[e.nome]?.inicio ? depois[e.nome]?.inicio : meu.inicio,
              fim: meu.fim,
            },
          ];
        }),
      ),
    );
    setMes(novo);
  }

  /**
   * TROCAR O FLUXO REFAZ A CORRENTE INTEIRA, e aqui não há o que preservar.
   *
   * Ao contrário de trocar o mês — onde quem já mexeu num campo mandou (0041) —,
   * um fluxo diferente tem OUTRAS etapas: os períodos antigos são de nomes que
   * a corrente nova não tem, e `abrir_mes_de_social` recusaria o mês dizendo
   * que o fluxo não tem etapa chamada "Pauta". Guardar o que a pessoa digitou
   * seria guardar valores sem onde cair.
   */
  function trocarFluxo(novo: string) {
    const escolhido = fluxos.find((f) => f.id === novo);
    setFluxoId(novo);
    setPrazos(diasSugeridos(mes, (escolhido ?? fluxos[0])?.etapas ?? []));
  }

  const excede = total > TETO;
  // A PASTA ENTRA NA CONDIÇÃO, e é o que muda desde a 0061: o mês deixou de
  // ser N posts soltos e virou uma DEMANDA com um post em cada etapa — e
  // `tasks_exige_pasta_de_entrega` recusa demanda nova sem pasta desde a 0015.
  //
  // A tela cobra antes para a recusa não chegar depois de sete campos
  // preenchidos; quem vale é o banco, e é ele que pega quem chamar a RPC
  // direto.
  // UMA ETAPA INVERTIDA DESLIGA O BOTÃO, e não deixa a recusa chegar depois de
  // dez campos preenchidos. Quem recusa de verdade é a função — e, para quem
  // montar a chamada à mão, o `check` `subtasks_periodo` da tabela (0027),
  // porque desde a 0088 a etapa do mês é uma subtarefa como qualquer outra.
  const periodoInvertido = etapasDoFluxo.some((e) => {
    const p = prazos[e.nome];
    return !!p && p.inicio !== "" && p.fim !== "" && p.inicio > p.fim;
  });

  const podeAbrir =
    !!cliente &&
    total > 0 &&
    !excede &&
    !linhaSemRede &&
    !periodoInvertido &&
    pasta.trim().length > 0;

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
          // NULO E NÃO "" QUANDO NINGUÉM ESCOLHEU: a função lê nulo como "o
          // padrão da conta, senão o da casa", e o uuid vazio seria um valor
          // inválido num campo que a validação recusaria.
          flow_id: fluxoId || null,
          quantidades: combinacoes,
          responsaveis: Object.fromEntries(
            Object.entries(responsaveis).map(([f, v]) => [f, v === SEM_VALOR ? null : v]),
          ),
          link_entrega: pasta.trim(),
          // A ETAPA SEM PONTA NENHUMA NÃO VIAJA, pela mesma razão dos
          // responsáveis: mandar `{"Layout": {}}` faria o banco gravar nulo por
          // cima de nada, e o mapa passaria a dizer que alguém escolheu "sem
          // dia". Com UMA das duas preenchidas ela vai — os dois são opcionais
          // no banco desde a 0084, pela decisão da 0027.
          // SEM ENTREGA, A ETAPA DURA UM DIA — e é aqui que isso vira dado.
          //
          // O campo fica em branco na tela, como o usuário pediu, e o que
          // viaja é `fim = inicio`. Mandar o fim nulo pareceria mais fiel ao
          // campo e desfaria o resto: `disponibilidade_bruta()` filtra
          // `prazo is not null` (0081), então a fase sairia da carga de quem
          // produz — e é a carga que ele pediu para ver na linha de cima.
          //
          // A ETAPA SEM PONTA NENHUMA NÃO VIAJA, pela mesma razão dos
          // responsáveis: mandar `{"Layout": {}}` faria o banco gravar nulo por
          // cima de nada, e o mapa passaria a dizer que alguém escolheu "sem
          // dia".
          prazos: Object.fromEntries(
            Object.entries(prazos)
              .map(([etapa, v]) => {
                const inicio = v.inicio.trim();
                const fim = v.fim.trim();
                return [etapa, { inicio, fim: fim || inicio }] as const;
              })
              .filter(([, v]) => v.inicio.length > 0 || v.fim.length > 0),
          ),
        }),
      );

      if (!r.ok) {
        toast.error(r.error);
        return;
      }

      toast.success(r.mensagem);
      // A TELA LEVA AO MÊS QUE ACABOU DE NASCER, e não de volta ao índice: quem
      // abriu doze posts quer vê-los. O par `?cliente=&mes=` é o endereço
      // canônico do mês aberto, o mesmo que o cartão da conta usa — não há uma
      // segunda forma de chegar lá que possa divergir.
      //
      // E NÃO HÁ RESET DE CAMPO NENHUM, ao contrário do diálogo: a tela sai de
      // cena. Limpar o que a pessoa digitou um instante antes de navegar é
      // trabalho que ninguém vê, e faria a página piscar o formulário vazio no
      // caminho.
      router.push(`/painel/social-media?cliente=${cliente}&mes=${mes}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* O CABEÇALHO GRANDE DA TELA, como em toda página do redesenho: o nome
          do módulo aparece uma vez só, e aqui essa vez é este título — a rota
          não tem barra de contexto, porque menos de duas seções não vira
          barra. */}
      <header className="space-y-1">
        <h1 className="text-text-primary text-[2.125rem] leading-tight font-semibold tracking-tight">
          Abrir o mês de social
        </h1>
        <p className="text-text-secondary text-sm">
          Os posts nascem sem data e sem tema definitivo. Quem produz escolhe o
          dia e escreve o resto.
        </p>
      </header>

      <SecaoDoFormulario numero={1} titulo="A conta e o mês">
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
      </SecaoDoFormulario>

      {/*
        A PASTA DE ENTREGA DO MÊS.

        Ela vem logo depois de cliente e mês porque é deles que o nome dela sai
        — e porque é o campo que decide se o botão do fim funciona. No fim da
        tela ela seria a surpresa depois de cinco seções preenchidas.
      */}
      <SecaoDoFormulario numero={2} titulo="A pasta de entrega do mês">
        <div className="space-y-1.5">
          <Label htmlFor="mes-pasta">Endereço da pasta</Label>
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
      </SecaoDoFormulario>

      <SecaoDoFormulario
        numero={3}
        titulo="Quantos posts, e em que redes"
        acao={
          <span className={cnTotal(excede)} aria-live="polite">
            {total === 0 ? "nenhum ainda" : total === 1 ? "1 post" : `${total} posts`}
          </span>
        }
      >
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
      </SecaoDoFormulario>

      {/* ------------------------------------------------- o fluxo --
          QUAL CORRENTE ESTE MÊS PERCORRE (0087), decisão do usuário:
          *"preciso poder montar fluxos de Social diferentes, para serem
          aplicados em determinados socials, de meses de determinadas
          contas"*.

          ELE VEM ANTES DA SEÇÃO DAS ETAPAS, e a ordem é a razão: o fluxo
          decide QUAIS etapas a tela pede, de QUAIS funções, e com quantos
          campos de data. Embaixo, a pessoa escolheria pessoas e datas e veria
          a seção trocar debaixo dela. */}
      <SecaoDoFormulario numero={4} titulo="O fluxo deste mês">
        <Select
          value={fluxoId || SEM_VALOR}
          onValueChange={(v) => trocarFluxo(v === SEM_VALOR ? "" : v)}
        >
          <SelectTrigger aria-label="Fluxo de social deste mês" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_VALOR}>O padrão desta conta</SelectItem>
            {fluxos.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* A FRASE DIZ A CORRENTE INTEIRA, com os portões marcados, e não
            só o nome do fluxo: "Três avaliações do cliente" não conta a
            quem está abrindo o mês que a Pauta vai parar e esperar alguém
            de fora da agência. É a mesma razão pela qual a prévia das cinco
            próximas existe na recorrência — quem configura trabalho em lote
            não tem outro jeito de conferir antes de salvar. */}
        <p className="text-text-secondary text-xs">
          {etapasDoFluxo.length > 0 ? (
            <>
              {etapasDoFluxo.map((e, i) => (
                <span key={e.nome}>
                  {i > 0 ? " → " : ""}
                  <span
                    className={e.aprovacao_cliente ? "text-warning font-medium" : undefined}
                  >
                    {e.nome}
                  </span>
                </span>
              ))}
              {etapasDoFluxo.some((e) => e.aprovacao_cliente)
                ? " — em âmbar, o que espera o aval do cliente antes de seguir."
                : null}
            </>
          ) : (
            "Nenhum fluxo montado ainda. Monte um na aba Fluxos antes de abrir o mês."
          )}
        </p>
        {!fluxoId ? (
          <p className="text-text-muted text-xs">
            Sem escolher, vale o fluxo combinado na ficha desta conta — e, se
            ela não tem nenhum, o padrão da casa.
          </p>
        ) : null}
      </SecaoDoFormulario>

      {/*
        QUEM FAZ CADA ETAPA, E QUANDO — UMA SEÇÃO SÓ.

        ERAM DUAS, e juntá-las é decisão do usuário: *"quero que junte a parte
        de escolher a pessoa que vai fazer a etapa, com a data que a etapa tem
        que ser feita"*. Ele está certo, e o argumento é o da faixa de
        disponibilidade: **as duas perguntas são uma decisão só.** Quem data a
        Pauta está escolhendo um dia DAQUELA pessoa — e com as listas
        separadas, a função aparecia numa seção, a etapa que ela carrega
        aparecia como texto cinza ao lado, e a data da mesma etapa aparecia
        quarenta pixels abaixo, em outra lista, ordenada igual. A pessoa lia
        duas vezes a mesma sequência para juntar de cabeça o que a tela tinha
        separado.

        **E ERA A SEPARAÇÃO QUE DEIXAVA A CARGA SEM LUGAR.** A faixa é o
        calendário de UMA pessoa; na lista de datas ela não tinha a quem
        pertencer sem a pessoa na mesma linha.

        A ordem dentro de cada bloco é a da decisão: quem faz, que dia, e só
        então os dias dessa pessoa — porque a faixa só existe depois de haver
        uma pessoa escolhida.
      */}
      <SecaoDoFormulario numero={5} titulo="Quem faz cada etapa, e quando">
        {etapasDoFluxo.length === 0 ? (
          <p className="text-text-secondary text-sm">
            Escolha um fluxo acima para a corrente aparecer aqui.
          </p>
        ) : null}

        <ul className="space-y-3">
          {etapasDoFluxo.map((etapa) => {
            const periodo = prazos[etapa.nome] ?? { inicio: "", fim: "" };
            const invertido =
              periodo.inicio !== "" && periodo.fim !== "" && periodo.inicio > periodo.fim;
            // QUEM VAI FAZER ESTA ETAPA. A escolha é por FUNÇÃO (é o que
            // `p_responsaveis` recebe desde a 0046), então duas etapas da
            // mesma função mostram a mesma pessoa — e a linha embaixo do
            // seletor diz isso quando é o caso.
            const quem = responsaveis[etapa.funcao] ?? SEM_VALOR;
            const pessoa =
              quem !== SEM_VALOR ? equipe.find((p) => p.id === quem) : undefined;
            const funcao = porFuncao[etapa.funcao];
            const faixaVisivel = faixaAberta === etapa.nome;
            return (
              // CADA ETAPA É UM BLOCO COM BORDA, como as linhas de combinação
              // da seção 3. Com três campos e uma grade de mês dentro, uma
              // etapa solta na página se mistura com a de baixo — e a faixa
              // aberta deixaria de ter dono visível, que é justamente o que
              // ela precisa dizer: de quem é aquele calendário.
              <li
                key={etapa.nome}
                className="border-border bg-surface-card space-y-3 rounded-lg border p-3"
              >
                <h4 className="text-text-primary text-sm font-semibold">{etapa.nome}</h4>

                {/* EM 375px OS TRÊS CAMPOS EMPILHAM, e no desktop ficam numa
                    linha. Com os três lado a lado num celular sobravam uns
                    110px cada, e o `<input type="date">` corta o ANO antes de
                    cortar qualquer outra coisa: "01/10/202" lê como data
                    válida e não é — foi a imagem de 375px que mostrou, como no
                    calendário do Day Off. */}
                <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`resp-${etapa.nome}`}>
                      {/* O RÓTULO E NÃO A CHAVE DO ENUM: `team_funcao` guarda
                          "Gestao" e "Trafego" sem acento, e a corrente fixa das
                          três nunca mostrou isso porque nenhuma delas tinha
                          acento. Com o fluxo editável qualquer função pode
                          aparecer aqui, e `check:cores` não pegaria — ele
                          procura as formas ACENTUADAS, e o que sairia na tela é
                          a sem. É a ausência que o Calendário Full já pagou com
                          `ferias`. */}
                      Quem faz ({ROTULOS_DE_FUNCAO[etapa.funcao]})
                    </Label>
                    <Select
                      value={quem}
                      onValueChange={(v) =>
                        setResponsaveis((atual) => ({ ...atual, [etapa.funcao]: v }))
                      }
                    >
                      <SelectTrigger
                        aria-label={`Quem faz ${etapa.nome}`}
                        id={`resp-${etapa.nome}`}
                        className="w-full"
                      >
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
                    {/* A FRASE DA FUNÇÃO COMPARTILHADA. Sem ela, quem escolhe a
                        pessoa na Pauta vê o Programar trocar sozinho e conclui
                        que a tela tem um defeito. */}
                    {funcao && funcao.quantas > 1 ? (
                      <p className="text-text-muted text-xs">
                        A mesma pessoa faz {funcao.etapas} — é a pessoa de{" "}
                        {ROTULOS_DE_FUNCAO[etapa.funcao]} do mês.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`inicio-${etapa.nome}`}>Dia</Label>
                    <Input
                      id={`inicio-${etapa.nome}`}
                      type="date"
                      className="w-full"
                      value={periodo.inicio}
                      onChange={(e) =>
                        setPrazos((atual) => ({
                          ...atual,
                          [etapa.nome]: { ...periodo, inicio: e.target.value },
                        }))
                      }
                    />
                    <p className="text-text-secondary text-xs">
                      {rotuloDoDiaDaEtapa(periodo.inicio)}
                    </p>
                  </div>

                  {/*
                    A ENTREGA NASCE EM BRANCO, e é decisão do usuário: *"na
                    maioria dos casos a task dura apenas um dia. E caso a pessoa
                    vá ter mais de um dia para fazer, o atendimento pode
                    preencher a data de entrega também"*.

                    O RÓTULO DIZ QUE ELA É OPCIONAL e a linha embaixo diz o que
                    o vazio significa — "Entrega" sozinho, num campo em branco,
                    lê como campo que ninguém preencheu, e quem abre o mês teria
                    de adivinhar se a etapa ficou sem prazo.
                  */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`fim-${etapa.nome}`}>Entrega (opcional)</Label>
                    <Input
                      id={`fim-${etapa.nome}`}
                      type="date"
                      aria-invalid={invertido}
                      className="w-full"
                      value={periodo.fim}
                      onChange={(e) =>
                        setPrazos((atual) => ({
                          ...atual,
                          [etapa.nome]: { ...periodo, fim: e.target.value },
                        }))
                      }
                    />
                    <p className="text-text-secondary text-xs">
                      {invertido ? (
                        <span className="text-danger">
                          A entrega é antes do dia da etapa.
                        </span>
                      ) : periodo.fim === "" ? (
                        "Em branco: a etapa dura um dia."
                      ) : (
                        rotuloDoDiaDaEtapa(periodo.fim)
                      )}
                    </p>
                  </div>
                </div>

                {/* A CARGA DE QUEM VAI FAZER, atrás de um clique.

                    Decisão do usuário: *"quero que o calendário da pessoa que
                    vai fazer cada etapa, mostre também a carga de tasks que a
                    pessoa já está, igual é feito atualmente"*. É a MESMA
                    `FaixaDeDisponibilidade` do painel da etapa em Gestão de
                    Tasks, com a mesma escala de quatro degraus de
                    `lib/dominio/calendario.ts` — a pergunta aqui é a de lá,
                    feita cinco vezes de uma vez. Duas escalas para a mesma
                    pergunta seriam descobertas pela pessoa no dia em que uma
                    tela pintasse de verde o dia que a outra pintou de âmbar.

                    O CLIQUE NO DIA ESCREVE O DIA DA ETAPA, e não a entrega: é o
                    campo que sempre existe, e é dele que a etapa de um dia tira
                    as duas pontas. Escrever as duas pela grade exigiria arrastar
                    de um dia a outro, que é o que fica em aberto na faixa do
                    painel da etapa também.

                    E AQUI ELA NÃO É O SALVAMENTO, ao contrário de lá: aquele
                    painel grava campo a campo e o clique no dia É a escrita;
                    esta tela tem um botão no fim, e o clique preenche o campo
                    que a pessoa vai confirmar. */}
                {pessoa ? (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-expanded={faixaVisivel}
                      onClick={() => setFaixaAberta(faixaVisivel ? null : etapa.nome)}
                    >
                      <CalendarDays aria-hidden className="size-4" />
                      {faixaVisivel
                        ? `Esconder os dias de ${primeiroNome(pessoa.nome)}`
                        : `Ver os dias de ${primeiroNome(pessoa.nome)}`}
                    </Button>

                    {faixaVisivel ? (
                      <FaixaDeDisponibilidade
                        userId={pessoa.id}
                        nome={pessoa.nome}
                        inicio={periodo.inicio || null}
                        fim={periodo.fim || null}
                        /*
                         * AQUI O CLIQUE SOLTO NÃO PREENCHE A ENTREGA, e é a
                         * decisão da 0089 palavra por palavra: *"quero que a
                         * data de final fique sempre em branco, pois na
                         * maioria dos casos a task dura apenas um dia"*. O
                         * branco QUER DIZER um dia nesta tela — a frase
                         * embaixo do campo explica isso —, e preenchê-lo
                         * sozinho desfaria o que ele pediu.
                         *
                         * Um período escolhido de verdade, com as duas
                         * pontas, escreve as duas: aí a pessoa disse que a
                         * etapa dura mais de um dia.
                         */
                        aoEscolher={(de, ate) =>
                          setPrazos((atual) => ({
                            ...atual,
                            [etapa.nome]: {
                              ...periodo,
                              inicio: de,
                              fim: ate ?? periodo.fim,
                            },
                          }))
                        }
                        buscar={buscarDisponibilidade}
                        rotuloDoClique="Clique num dia para o dia da etapa, e noutro se ela durar mais de um."
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </SecaoDoFormulario>

      {/* AS AÇÕES NO FIM DA PÁGINA, que é onde se procura o que encerra
          alguma coisa — a decisão do detalhe da demanda. E "Cancelar" é LINK
          e não botão: ele navega, e um botão que navega esconde o destino de
          quem passa o mouse. */}
      <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" asChild>
          <Link href="/painel/social-media">Cancelar</Link>
        </Button>
        <Button onClick={enviarFormulario} disabled={!podeAbrir || enviando}>
          {enviando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {total > 0 && !excede ? `Abrir ${total} posts` : "Abrir o mês"}
        </Button>
      </div>
    </div>
  );
}

/**
 * O primeiro nome, para o rótulo do botão da faixa.
 *
 * "Ver os dias de Marina Albuquerque Costa" não cabe num botão de uma linha em
 * 375px, e o nome inteiro continua dentro da faixa — que é quem fala com leitor
 * de tela sobre a pessoa.
 */
function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function cnTotal(excede: boolean) {
  return excede
    ? "text-danger text-xs font-medium tabular-nums"
    : "text-text-secondary text-xs tabular-nums";
}
