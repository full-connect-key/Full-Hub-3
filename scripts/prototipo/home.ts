/**
 * Versao de prototipo de src/lib/dados/home.ts.
 *
 * ---------------------------------------------------------------------------
 * ELE IMITA O QUE A `home_summary()` FAZ POR PERFIL, e nao devolve tudo para
 * todo mundo.
 *
 * No banco, quem tira `pulso` e `clientes_em_atencao` da resposta do
 * colaborador e um `return` no meio da funcao; e quem zera `aprovacoes` e
 * `pedidos_rh` para ele e a RLS, que nao devolve as linhas. Um stub que
 * entregasse os sete blocos a todo mundo faria a imagem do colaborador provar
 * exatamente nada -- foi o erro que a versao anterior do stub do calendario
 * cometeu ao ignorar os filtros.
 * ---------------------------------------------------------------------------
 */
// O caminho é RELATIVO e não o apelido: na cópia do protótipo, `@/lib/dados/home`
// É este arquivo, e o import viraria uma definição circular do próprio tipo.
// Mesmo padrão dos outros stubs que reexportam os tipos do módulo que imitam.
import type { ResumoDaHome } from "../../src/lib/dados/home";

import { CLIENTES_EXEMPLO } from "./dados-exemplo";

function ehGestao(): boolean {
  const role = process.env["PROTOTIPO_ROLE"] ?? "socio";
  return role === "socio" || role === "desenvolvedor";
}

function ehSocio(): boolean {
  return (process.env["PROTOTIPO_ROLE"] ?? "socio") === "socio";
}

export type { ResumoDaHome };

export async function resumoDaHome(): Promise<ResumoDaHome> {
  const gestao = ehGestao();

  const base: ResumoDaHome = {
    meu_dia: { atrasadas: 1, hoje: 2, semana: 4 },
    precisa_de_mim: {
      aprovacoes: gestao ? 3 : 0,
      comentarios: gestao ? 2 : 0,
      pedidos_rh: ehSocio() ? 1 : 0,
    },
    fora_hoje: [
      { nome: "Marina Alves", estado: "ferias" },
      { nome: "Bruno Camargo", estado: "ausente" },
    ],
  };

  if (!gestao) return base;

  return {
    ...base,
    pulso: {
      etapas_abertas: 38,
      atrasadas: 5,
      concluidas_semana: 17,
      posts_com_cliente: 6,
      campanhas_ativas: 3,
    },
    clientes_em_atencao: [
      {
        cliente: CLIENTES_EXEMPLO[0]?.nome_empresa ?? "Mundo Verde",
        cliente_id: CLIENTES_EXEMPLO[0]?.id ?? "aaaaaaaa-0000-0000-0000-000000000001",
        paradas: 3,
        dias: 9,
      },
      {
        cliente: CLIENTES_EXEMPLO[1]?.nome_empresa ?? "Óptica Visão",
        cliente_id: CLIENTES_EXEMPLO[1]?.id ?? "aaaaaaaa-0000-0000-0000-000000000002",
        paradas: 1,
        dias: 4,
      },
    ],
  };
}
