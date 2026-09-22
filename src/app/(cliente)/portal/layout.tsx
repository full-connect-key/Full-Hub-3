/**
 * Repasse.
 *
 * A guarda NÃO mora aqui, e isso é deliberado. Abaixo de /portal existem duas
 * entradas com donos diferentes:
 *
 *   (meu)/   — o portal da pessoa cliente, guardado por exigirCliente()
 *   [slug]/  — a visualização administrativa, guardada por gestão
 *
 * Uma guarda única neste nível teria que aceitar as duas, e aceitar as duas é
 * não guardar nenhuma. Cada uma tem o seu layout logo abaixo, e é lá que o 403
 * acontece.
 */
export default function LayoutDoPortal({ children }: LayoutProps<"/portal">) {
  return children;
}
