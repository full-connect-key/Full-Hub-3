import { forbidden } from "next/navigation";

/**
 * Rota que existe SO dentro da copia de prototipo, para a tela de acesso
 * negado poder ser fotografada. Ela nao vai para o app publicado.
 */
export default async function TelaDeAcessoNegadoParaPrototipo() {
  forbidden();
}
