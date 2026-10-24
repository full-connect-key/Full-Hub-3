import { permanentRedirect } from "next/navigation";

/**
 * O endereço antigo de abrir pedido.
 *
 * Abrir uma solicitação deixou de ser uma TELA e virou o painel lateral da
 * lista, com o estado na URL. Esta rota fica, e redireciona: ela está em
 * favorito de quem usa o portal e, mais que isso, em link que `notificar()`
 * já gravou em linhas do banco — é a razão pela qual as duas rotas que viraram
 * abas de Gestão de Tasks também viraram 308 em vez de sumir.
 *
 * `permanentRedirect` manda 308: o navegador guarda, e o link antigo passa a
 * chegar ao painel aberto em vez de a um 404.
 */
export default function Pagina() {
  permanentRedirect("/portal/solicitacoes?novo=1");
}
