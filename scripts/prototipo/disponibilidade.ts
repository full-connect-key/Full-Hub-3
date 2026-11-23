import type { DiaDeDisponibilidade } from "@/lib/dominio/disponibilidade";

import { cargaDaEquipeNaSemana } from "./pauta-da-equipe";

/**
 * Os dias de quem vai receber o trabalho, para o protótipo.
 *
 * **ELE GERA O MÊS, em vez de trazer uma lista escrita à mão**, e é o único
 * stub deste gerador que faz isso. A razão é a imagem: a faixa navega entre
 * meses, e um mês literal deixaria todos os outros vazios — quem clicar na
 * seta veria uma grade sem carga nenhuma e concluiria que a tela está
 * quebrada. A forma é determinística (sai do dia do mês), então a imagem sai
 * igual em toda rodada.
 *
 * O PADRÃO NÃO É ALEATÓRIO, e sim escolhido para a imagem mostrar os quatro
 * degraus da legenda ao mesmo tempo: um dia acima da capacidade, dois quase
 * cheios, dias com folga, dias sem etapa e uma semana inteira de day off.
 * Uma grade só com folga provaria apenas que a cor sabe existir.
 */
export async function disponibilidadeDe(
  userId: string,
  inicio: string,
  fim: string,
  _projetando = true,
): Promise<DiaDeDisponibilidade[]> {
  // UM DIA SÓ, DE ALGUÉM DA GRADE: é a pauta da equipe perguntando o que
  // ocupa aquele dia, e a resposta sai da MESMA grade que desenhou o número.
  //
  // Sem isto a imagem mostraria a célula dizendo "8h" e o painel logo abaixo
  // dizendo outra coisa — que é exatamente o bug que a entrega existe para não
  // ter, fotografado como se fosse o produto. É a lição da duplicata do
  // Cronograma: um ambiente de exemplo que mostra o produto num estado que ele
  // não tem esconde uma classe inteira de bug.
  //
  // A faixa de disponibilidade nunca cai aqui: ela pede o MÊS (a união do mês
  // visível com a seleção), então `inicio` e `fim` são diferentes.
  if (inicio === fim) {
    const doDiaDaGrade = await diaDaPautaDaEquipe(userId, inicio);
    if (doDiaDaGrade) return [doDiaDaGrade];
  }

  const dias: DiaDeDisponibilidade[] = [];
  const de = new Date(`${inicio}T12:00:00`);
  const ate = new Date(`${fim}T12:00:00`);

  for (const d = new Date(de); d <= ate; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const numero = d.getDate();
    const semana = d.getDay();
    const fimDeSemana = semana === 0 || semana === 6;

    // A TERCEIRA SEMANA É DE DESCANSO: é o caso que a grade precisa mostrar
    // apagado, e o único em que o aviso fala de ausência e não de carga.
    const emDescanso = numero >= 15 && numero <= 19;

    if (fimDeSemana || emDescanso) {
      dias.push({
        data: iso,
        diaUtil: !fimDeSemana,
        capacidadeMinutos: 0,
        indisponivelMotivo: fimDeSemana ? "fim_de_semana" : "ferias",
        cargaMinutos: 0,
        etapas: 0,
        entregas: 0,
        entregasMinutos: 0,
        ocupacaoPct: null,
        evento: null,
        itens: [],
      });
      continue;
    }

    const minutos = CARGA[numero % 7];
    dias.push({
      data: iso,
      diaUtil: true,
      capacidadeMinutos: 540,
      indisponivelMotivo: null,
      cargaMinutos: minutos,
      etapas: minutos === 0 ? 0 : Math.min(4, Math.ceil(minutos / 180)),
      entregas: minutos > 400 ? 1 : 0,
      entregasMinutos: minutos > 400 ? 480 : 0,
      ocupacaoPct: Math.round((minutos * 100) / 540),
      evento: null,
      itens: minutos === 0 ? [] : ITENS.slice(0, Math.min(3, Math.ceil(minutos / 180))),
    });
  }

  return dias;
}

/**
 * O DIA DE UMA PESSOA DA GRADE, com os minutos que a grade já mostrou.
 *
 * Devolve nulo quando o par (pessoa, dia) não está na semana corrente — aí o
 * caminho é o mês gerado acima, que é o que a faixa de disponibilidade pede.
 *
 * **OS ITENS SOMAM OS MINUTOS DA CÉLULA**, e a última fatia leva a sobra: dois
 * números que não fecham no mesmo painel seriam a imagem provando que a conta
 * está errada. E são no máximo três títulos num dia de quatro etapas, o que é
 * de propósito — é assim que a linha *"e mais N etapas"* sai em imagem, e ela
 * é a única coisa deste painel que nenhuma outra tela desenha.
 *
 * **E AS FATIAS SÃO DESIGUAIS, nunca o total dividido em partes iguais.** A
 * coluna de minutos é `tabular-nums` com largura mínima, e é ela que alinha
 * "5h30" com "2h12"; com três fatias idênticas a imagem provaria que a coluna
 * existe e não que ela ALINHA — é a razão do evento de cada par da legenda do
 * calendário. No produto a fatia sai da janela de cada etapa, que nunca é a
 * mesma para três delas.
 */
async function diaDaPautaDaEquipe(
  userId: string,
  data: string,
): Promise<DiaDeDisponibilidade | null> {
  const carga = await cargaDaEquipeNaSemana();
  const pessoa = carga?.pessoas.find((p) => p.id === userId);
  const dia = pessoa?.dias.find((d) => d.dia === data);
  if (!pessoa || !dia) return null;

  const quantos = Math.min(3, dia.etapas);
  const pesos = PESOS.slice(0, quantos);
  const total = pesos.reduce((soma, peso) => soma + peso, 0);
  let gasto = 0;
  const itens = ITENS.slice(0, quantos).map((item, i) => {
    const fatia =
      i === quantos - 1
        ? dia.minutos - gasto
        : Math.round((dia.minutos * pesos[i]) / total);
    gasto += fatia;
    return { ...item, minutos: fatia };
  });

  return {
    data,
    diaUtil: true,
    capacidadeMinutos: dia.ausente ? 0 : pessoa.capacidadeMinutos,
    indisponivelMotivo: dia.ausente ? "ferias" : null,
    cargaMinutos: dia.minutos,
    etapas: dia.etapas,
    entregas: 0,
    entregasMinutos: 0,
    ocupacaoPct: dia.ausente
      ? null
      : Math.round((dia.minutos * 100) / pessoa.capacidadeMinutos),
    evento: null,
    itens,
  };
}

const CARGA = [0, 192, 420, 480, 192, 720, 96];

/** O peso de cada fatia do dia da grade — ver `diaDaPautaDaEquipe`. */
const PESOS = [5, 3, 2];

const ITENS = [
  {
    id: "d1500000-0000-0000-0000-0000000000a1",
    titulo: "Adaptações para feed",
    cliente: "Mundo Verde",
    minutos: 192,
    prazo: null,
  },
  {
    id: "d1500000-0000-0000-0000-0000000000a2",
    titulo: "Lâmina A5 — revisão",
    cliente: "Óptica Visão",
    minutos: 120,
    prazo: null,
  },
  {
    id: "d1500000-0000-0000-0000-0000000000a3",
    titulo: "Layout do mês",
    cliente: "Casa Bela",
    minutos: 96,
    prazo: null,
  },
];
