"use client";

import { registrarAnexo } from "@/app/(cliente)/portal/_actions/solicitacoes";
import { BUCKET_DOS_PEDIDOS } from "@/lib/dominio/solicitacoes";
import { criarClienteNavegador } from "@/lib/supabase/client";

/**
 * Sobe um anexo de pedido e grava a linha dele.
 *
 * ---------------------------------------------------------------------------
 * **UM LUGAR SÓ, porque são DUAS telas que anexam.**
 *
 * A do pedido já criado anexa o arquivo que a pessoa esqueceu; a de abrir o
 * pedido anexa as referências junto com o texto (decisão do usuário). As duas
 * montam o mesmo caminho e chamam a mesma ação — e o caminho é a parte que não
 * pode divergir: a policy do Storage confere a PASTA DA EMPRESA com
 * `(storage.foldername(name))[1]`, então um caminho montado de outro jeito é
 * recusado pelo bucket, não pela tela. Duas cópias dariam uma recusa que
 * aparece numa das duas telas e numa delas só.
 *
 * **`"use client"` e não um módulo sem diretiva**, ao contrário de
 * `lib/dominio/`: ele usa `criarClienteNavegador()`, que é valor de arquivo
 * cliente, e um módulo sem diretiva que o importa é exatamente o que
 * `check:fronteira` reprova — foi ele quem apontou, na primeira rodada. A
 * Server Action continua chamável daqui, que é o desenho delas.
 * ---------------------------------------------------------------------------
 */
export async function subirAnexoDoPedido({
  clientId,
  pedidoId,
  arquivo,
}: {
  clientId: string;
  pedidoId: string;
  arquivo: File;
}): Promise<{ ok: boolean; erro?: string }> {
  const supabase = criarClienteNavegador();
  const extensao = arquivo.name.split(".").pop() ?? "bin";

  // O `Math.random` entra ao lado do instante porque dois arquivos escolhidos
  // na mesma leva sobem no mesmo milissegundo: só com `Date.now()` o segundo
  // sobrescreveria o primeiro, e a tela mostraria dois nomes apontando para a
  // mesma imagem.
  const unico = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const caminho = `${clientId}/${pedidoId}/${unico}.${extensao}`;

  const { error } = await supabase.storage
    .from(BUCKET_DOS_PEDIDOS)
    .upload(caminho, arquivo, { contentType: arquivo.type });

  if (error) return { ok: false, erro: error.message };

  const r = await registrarAnexo(pedidoId, {
    caminho,
    nome: arquivo.name,
    tipo: arquivo.type,
    tamanho: arquivo.size,
  });

  return r.ok ? { ok: true } : { ok: false, erro: r.error };
}
