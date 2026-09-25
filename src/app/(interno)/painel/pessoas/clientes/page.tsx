import { redirect } from "next/navigation";

/**
 * `/painel/pessoas/clientes` não é uma tela — é o pai das fichas.
 *
 * Sem este arquivo o caminho devolveria 404, e ele é fácil de alcançar: basta
 * apagar o id do fim da URL da ficha de um cliente, que é o que as pessoas
 * fazem para "voltar para a lista". Redirecionar é o que elas esperavam.
 */
export default function ClientesVaiParaAAba() {
  redirect("/painel/pessoas?aba=clientes");
}
