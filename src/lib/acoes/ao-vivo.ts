import "server-only";

import { after } from "next/server";

import { CANAL_DA_EQUIPE, type MotivoDoAviso } from "@/lib/dominio/ao-vivo";
import {
  criarClienteAdmin,
  servicoConfigurado,
  SUPABASE_SERVICE_ROLE_KEY,
} from "@/lib/supabase/admin";

/**
 * O aviso de que alguma coisa mudou (Sprint 16, Parte A).
 *
 * ---------------------------------------------------------------------------
 * O QUE VIAJA É O SINAL, NUNCA A LINHA. E essa é a decisão inteira.
 *
 * O caminho óbvio do Supabase para isto é `postgres_changes`: a tabela entra
 * na publicação e o servidor de Realtime empurra **a linha inteira** para
 * cada navegador inscrito. Num produto em que o Painel e o Portal do Cliente
 * leem as mesmas tabelas, isso põe a correção de um filtro do outro lado de
 * um serviço que nenhuma bateria daqui alcança — e o modo de falha é o mesmo
 * do `security_invoker` da view `calendar_events`: **num banco com um cliente
 * só, vazar tudo e mostrar o certo têm exatamente a mesma cara.**
 *
 * Aqui o que vai no fio é `{ motivo }` — uma palavra. Quem recebe não lê nada
 * da mensagem: ele chama `router.refresh()`, e a tela é remontada **no
 * servidor**, onde o RLS vale como em qualquer outra visita. O sinal diz
 * "olhe de novo"; quem decide o que a pessoa vê continua sendo o Postgres.
 *
 * O custo, dito: não há atualização otimista nem diff. A tela inteira
 * recarrega do servidor. Para nove pessoas num board é troca boa; para um
 * cursor compartilhado não seria.
 * ---------------------------------------------------------------------------
 *
 * **Quem envia é o SERVIDOR, com a chave de serviço, por HTTP.** `httpSend()`
 * é um POST — não precisa de websocket aberto no servidor, que seria uma
 * conexão pendurada por processo. E enviar daqui em vez de do navegador de
 * quem clicou tem duas consequências que importam: o aviso sai mesmo quando a
 * ação foi disparada de um lugar sem tela, e **nenhum navegador consegue
 * forjar um aviso**, porque ninguém mais escreve no canal.
 */

/**
 * O NOME DO CANAL E OS MOTIVOS MORAM EM `lib/dominio/ao-vivo.ts`, e não aqui.
 *
 * Este arquivo é `server-only` — tem a chave de serviço dentro —, e o
 * componente que ouve é `"use client"`. Os dois precisam do mesmo nome, e um
 * valor exportado daqui não compila lá. É a convenção do projeto para valor
 * que atravessa a fronteira, e o motivo está escrito no módulo de destino.
 */
export { CANAL_DA_EQUIPE } from "@/lib/dominio/ao-vivo";
export type { MotivoDoAviso } from "@/lib/dominio/ao-vivo";

/**
 * Anuncia a mudança, DEPOIS da resposta.
 *
 * `after()` do Next existe exatamente para isto: o POST do aviso não pode
 * entrar no caminho crítico de quem clicou. Sem ele, cada "Concluir" ficaria
 * esperando uma ida ao Realtime antes de a tela responder — e um Realtime
 * lento viraria um produto lento.
 *
 * **Não é `await` de propósito, e não é fogo-e-esquece:** `after()` garante a
 * execução depois da resposta, inclusive quando a ação termina em `redirect()`
 * ou em erro. Um `void promessa` solto dependeria de o processo continuar vivo
 * por acaso.
 *
 * **NUNCA derruba a ação.** O aviso é conforto; a escrita é o trabalho. Se o
 * Realtime estiver fora, a pessoa que clicou vê o resultado normalmente e as
 * outras veem na próxima navegação — que é exatamente o produto de antes deste
 * sprint. O erro vai inteiro para o log, porque um aviso que parou de sair não
 * muda nada na tela de quem envia.
 */
export function anunciar(motivo: MotivoDoAviso, canal: string = CANAL_DA_EQUIPE): void {
  if (!servicoConfigurado()) return;

  after(async () => {
    try {
      const admin = criarClienteAdmin();

      // A chave de serviço vira o token do canal. Sem isto o POST sai só com
      // o `apikey` e o canal privado recusa — o Realtime decide pelo papel
      // que vem no Bearer.
      await admin.realtime.setAuth(SUPABASE_SERVICE_ROLE_KEY);

      const canalDoAviso = admin.channel(canal, { config: { private: true } });
      await canalDoAviso.httpSend("mudou", { motivo });
    } catch (erro) {
      console.error(`[ao-vivo:${canal}] não deu para anunciar "${motivo}":`, erro);
    }
  });
}
