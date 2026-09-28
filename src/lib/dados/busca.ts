import "server-only";

import { ouFalha } from "./consulta";

import {
  POR_GRUPO,
  MINIMO_PARA_BUSCAR,
  TIPOS_DA_BUSCA,
  agruparBusca,
  type GrupoDaBusca,
  type ResultadoDaBusca,
  type TipoDaBusca,
} from "@/lib/dominio/busca";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * A busca da topbar.
 *
 * **ELA NÃO REPETE FILTRO DE PERMISSÃO NENHUM, e essa é a decisão inteira.**
 * `busca_global()` não é `security definer` (0073), então ela roda com o
 * `auth.uid()` de quem pediu e a RLS das nove tabelas decide o que volta —
 * exatamente como decidiria numa consulta de tela. Repetir o filtro aqui
 * criaria o segundo lugar onde a regra pode divergir, e seria o pior segundo
 * lugar do produto: uma consulta só que lê `clients`, `assets` e
 * `client_requests` de uma vez.
 *
 * `criarClienteServidor()` e nunca o cliente de serviço — com ele a RLS não
 * valeria, e a busca devolveria a agência inteira para qualquer colaborador.
 */
export async function buscarNaPlataforma(termo: string): Promise<GrupoDaBusca[]> {
  const limpo = termo.trim();
  // A MESMA CONTA QUE O BANCO FAZ, pelo mesmo número: `MINIMO_PARA_BUSCAR` mora
  // em `lib/dominio/` justamente porque os dois lados perguntam. Sem este
  // `return`, cada tecla viraria uma ida ao banco para receber vazio.
  if (limpo.length < MINIMO_PARA_BUSCAR) return [];

  const supabase = await criarClienteServidor();

  // `ouFalha()` E NÃO `const { data }`: aqui ele vale mais que de costume.
  // Lista vazia é a resposta normal desta consulta — "não achei" —, então uma
  // recusa da RPC seria **indistinguível da verdade**, e a paleta diria
  // "nenhum resultado" para um termo que casa com meia agência. É o mesmo modo
  // de falha que trouxe `ouFalha` para o produto, no lugar onde ele é mais
  // difícil de notar.
  const linhas = ouFalha(
    "a busca na plataforma",
    await supabase.rpc("busca_global", { p_termo: limpo, p_limite: POR_GRUPO }),
  );

  // O TIPO QUE A TELA NÃO CONHECE É DESCARTADO AQUI, e com registro no log.
  // `agruparBusca` já o descartaria em silêncio ao percorrer a ordem dos
  // grupos; o que esta linha acrescenta é alguém contando que aconteceu — senão
  // um ramo novo no `union all` da 0073 sem o par em `lib/dominio/busca.ts`
  // seria uma busca que não acha uma coisa que existe.
  const conhecidos: ResultadoDaBusca[] = [];
  for (const linha of linhas) {
    if (!(TIPOS_DA_BUSCA as readonly string[]).includes(linha.tipo)) {
      console.error(
        `[consulta:a busca na plataforma] tipo desconhecido "${linha.tipo}" — ` +
          "a 0073 devolve um ramo que lib/dominio/busca.ts não declara.",
      );
      continue;
    }
    conhecidos.push({ ...linha, tipo: linha.tipo as TipoDaBusca });
  }

  return agruparBusca(conhecidos);
}
