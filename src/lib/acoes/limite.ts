import "server-only";

import { headers } from "next/headers";

import { criarClienteAdmin, servicoConfigurado } from "@/lib/supabase/admin";

import { ErroDeAcao } from "./resultado";

/**
 * O limite de tentativas (Sprint 16, Parte E).
 *
 * Três portas aceitavam repetição sem nada contando: o login, a recuperação
 * de senha e o campo de comentário. As duas primeiras ficam na internet
 * aberta, ANTES de qualquer sessão — quem tiver a lista de e-mails da agência
 * podia tentar senha a noite inteira.
 *
 * ---------------------------------------------------------------------------
 * A CONTA MORA NO POSTGRES, e não num `Map` aqui dentro.
 *
 * Um contador em memória do processo parece a solução óbvia e tem dois furos
 * que não aparecem em teste nenhum: ele **zera a cada deploy** — e o deploy é
 * um `pm2 reload`, que é justamente o que alguém faz quando o site está sob
 * carga —, e ele não existe para o segundo processo no dia em que houver dois.
 * Um limite que some sozinho é um limite que ninguém percebe ter sumido.
 * ---------------------------------------------------------------------------
 *
 * **Quem chama é a CHAVE DE SERVIÇO**, pelo `criarClienteAdmin()`. Não é
 * conveniência: o login acontece antes de existir sessão, então não há
 * cliente do usuário para usar — e a alternativa seria abrir a função para
 * `anon`, o que entregaria a arma junto com a trava (veja o cabeçalho da
 * 0056).
 */

/** O que cada porta tolera. Os três são números desta agência, não do mundo. */
export const LIMITES = {
  /**
   * Login por IP. Dez em quinze minutos é muito acima de quem erra a senha
   * e muito abaixo de quem está adivinhando.
   */
  loginPorIp: { max: 10, janelaSegundos: 15 * 60 },
  /**
   * Login por e-mail, e este é MAIS FOLGADO de propósito.
   *
   * **Trancar por e-mail é uma arma de dois gumes**, e fica escrito: o e-mail
   * de quem trabalha aqui está no site da agência, então um teto apertado
   * daria a qualquer pessoa o poder de trancar o sócio para fora gastando a
   * cota dele de fora. Vinte em meia hora barra a máquina e não alcança a
   * pessoa — quem digita errado não chega a cinco.
   */
  loginPorEmail: { max: 20, janelaSegundos: 30 * 60 },
  /**
   * Recuperação de senha, por e-mail. O que isto impede é usar o Full Hub
   * para encher a caixa de entrada de alguém: cada tentativa manda uma
   * mensagem de verdade para uma pessoa de verdade.
   */
  recuperacaoPorEmail: { max: 5, janelaSegundos: 60 * 60 },
  /** Recuperação por IP, para quem varre uma lista de e-mails. */
  recuperacaoPorIp: { max: 15, janelaSegundos: 60 * 60 },
  /**
   * Comentário, por pessoa. Isto NÃO é trava de segurança e não finge ser:
   * quem comenta já entrou e já é da agência ou cliente dela. É guarda de
   * enxurrada — o clique repetido, a aba que reenvia, o laço que alguém
   * deixou rodando. Vinte por minuto não alcança ninguém digitando.
   */
  comentario: { max: 20, janelaSegundos: 60 },
} as const;

export type Limite = {
  permitido: boolean;
  /** Quanto falta para a janela virar. Vira a frase que a pessoa lê. */
  espereSegundos: number;
};

const LIBERADO: Limite = { permitido: true, espereSegundos: 0 };

let avisouQueEstaDesligado = false;

/**
 * O endereço de quem está chamando.
 *
 * ---------------------------------------------------------------------------
 * **`x-real-ip` PRIMEIRO, e `x-forwarded-for` só pela ÚLTIMA entrada.**
 *
 * É a linha que separa um limite de um enfeite. O nginx da VPS escreve
 * `X-Real-IP $remote_addr` — o endereço do soquete, que o cliente não
 * escolhe — e `X-Forwarded-For $proxy_add_x_forwarded_for`, que **acrescenta**
 * o `$remote_addr` ao que o cliente mandou. Quer dizer que o começo daquela
 * lista é texto que a pessoa do outro lado escreveu.
 *
 * O trecho que aparece em todo lugar — `x-forwarded-for.split(",")[0]` — lê
 * exatamente essa parte. Com ele, um cabeçalho diferente a cada requisição dá
 * uma chave nova a cada requisição, e o contador nunca chega a dois. A trava
 * continuaria lá, verde, contando nada.
 *
 * **Se um dia entrar um CDN na frente** (Cloudflare, por exemplo), a última
 * entrada passa a ser o endereço do CDN e não o de quem chamou: aí o valor
 * certo é o cabeçalho que ele assina, e esta função é o único lugar a mexer.
 * ---------------------------------------------------------------------------
 *
 * Devolve `null` quando não dá para saber, e aí o limite por IP **não é
 * aplicado** — em vez de todo mundo cair no mesmo balde. Um proxy mal
 * configurado tem que degradar para "conta só por e-mail", nunca para
 * "tranca a agência inteira junto".
 */
export async function enderecoDeQuemChama(): Promise<string | null> {
  const h = await headers();

  const real = h.get("x-real-ip")?.trim();
  if (real) return real;

  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) {
    const partes = encaminhado
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const ultima = partes[partes.length - 1];
    if (ultima) return ultima;
  }

  return null;
}

/**
 * Gasta uma tentativa.
 *
 * ---------------------------------------------------------------------------
 * **FALHA PARA O LADO ABERTO, e com barulho.**
 *
 * Se o Postgres não responder, ou a chave de serviço não estiver
 * configurada, esta função LIBERA. É decisão, e tem um lado ruim dito: o
 * limite pode passar semanas desligado sem ninguém notar.
 *
 * O outro lado seria pior. Um limitador quebrado que recusa tranca a agência
 * inteira para fora do próprio sistema — inclusive o sócio, inclusive a
 * pessoa que iria consertar —, e ele quebra justamente quando o banco está
 * com problema, que é quando ninguém tem paciência para diagnosticar um
 * segundo problema. Bloquear o trabalho de nove pessoas para talvez atrapalhar
 * um ataque que talvez esteja acontecendo é a troca errada.
 *
 * O que sobra é não deixar silencioso: o erro inteiro vai para o log do
 * servidor, e a falta da chave de serviço é avisada UMA vez (repetir a cada
 * tentativa esconderia o aviso dentro do próprio ruído).
 * ---------------------------------------------------------------------------
 */
export async function consumirTentativa(
  chave: string,
  limite: { max: number; janelaSegundos: number },
): Promise<Limite> {
  if (!servicoConfigurado()) {
    if (!avisouQueEstaDesligado) {
      avisouQueEstaDesligado = true;
      console.error(
        "[limite] SUPABASE_SERVICE_ROLE_KEY não configurada: o limite de " +
          "tentativas está DESLIGADO. Login e recuperação de senha aceitam " +
          "repetição sem contar.",
      );
    }
    return LIBERADO;
  }

  try {
    const admin = criarClienteAdmin();
    const { data, error } = await admin.rpc("consumir_tentativa", {
      p_chave: chave,
      p_max: limite.max,
      p_janela: `${limite.janelaSegundos} seconds`,
    });

    if (error) {
      console.error(`[limite:${chave}] o contador recusou:`, error);
      return LIBERADO;
    }

    const linha = data?.[0];
    if (!linha) {
      console.error(`[limite:${chave}] o contador não devolveu linha nenhuma.`);
      return LIBERADO;
    }

    return {
      permitido: linha.permitido,
      espereSegundos: linha.espere_segundos,
    };
  } catch (erro) {
    console.error(`[limite:${chave}] o contador falhou:`, erro);
    return LIBERADO;
  }
}

/**
 * Devolve a cota de uma chave.
 *
 * O login que DÁ CERTO chama isto, e é o que separa "contar tentativa" de
 * "contar erro": quem entra e sai cinco vezes num dia de trabalho não pode
 * gastar a mesma cota de quem está adivinhando senha.
 */
export async function perdoarTentativas(chave: string): Promise<void> {
  if (!servicoConfigurado()) return;

  try {
    const admin = criarClienteAdmin();
    const { error } = await admin.rpc("perdoar_tentativas", { p_chave: chave });
    if (error) console.error(`[limite:${chave}] não deu para perdoar:`, error);
  } catch (erro) {
    console.error(`[limite:${chave}] não deu para perdoar:`, erro);
  }
}

/**
 * A frase da recusa.
 *
 * "Tente mais tarde" manda a pessoa adivinhar e insistir — e insistir é
 * exatamente o que gasta o resto da janela. Dizer quanto falta é o que
 * transforma a recusa em instrução, como a dica que o Postgres manda junto
 * das travas de task.
 */
export function esperePor(segundos: number): string {
  if (segundos <= 60) return "alguns instantes";
  const minutos = Math.ceil(segundos / 60);
  if (minutos === 1) return "1 minuto";
  if (minutos < 60) return `${minutos} minutos`;
  const horas = Math.ceil(minutos / 60);
  return horas === 1 ? "1 hora" : `${horas} horas`;
}

/**
 * A cota de quem está comentando.
 *
 * **Uma linha em cada action, e a frase num lugar só.** São três telas que
 * comentam — a demanda, o feed de Recomendações e o material no Portal —, e
 * três cópias das mesmas cinco linhas acabariam com três tetos diferentes no
 * dia em que alguém mexesse num.
 *
 * Lança `ErroDeAcao`, que o `executarAcao()` em volta transforma em
 * `{ ok: false, error }` com a mensagem inteira. Action nunca lança erro cru:
 * exceção dentro de action chega ao navegador como promise rejeitada e a tela
 * não muda.
 */
export async function exigirCotaDeComentario(usuarioId: string): Promise<void> {
  const cota = await consumirTentativa(`comentario:${usuarioId}`, LIMITES.comentario);
  if (cota.permitido) return;

  throw new ErroDeAcao(
    `Muitos comentários seguidos. Aguarde ${esperePor(cota.espereSegundos)}.`,
  );
}
