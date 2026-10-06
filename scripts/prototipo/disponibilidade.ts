import type { DiaDeDisponibilidade } from "@/lib/dominio/disponibilidade";

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
 * cheios, dias com folga, dias sem etapa e uma semana inteira de descanso.
 * Uma grade só com folga provaria apenas que a cor sabe existir.
 */
export async function disponibilidadeDe(
  _userId: string,
  inicio: string,
  fim: string,
): Promise<DiaDeDisponibilidade[]> {
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

const CARGA = [0, 192, 420, 480, 192, 720, 96];

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
