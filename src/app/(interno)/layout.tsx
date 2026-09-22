import { exigirEquipe } from "@/lib/auth/dal";

/**
 * Guarda da área interna.
 *
 * O visual fica no layout de /painel; aqui só barramos quem não é da equipe,
 * para qualquer rota futura deste grupo já nascer protegida. A consulta não se
 * repete: exigirEquipe() é memorizada por requisição.
 */
export default async function LayoutInterno({ children }: LayoutProps<"/">) {
  await exigirEquipe();
  return children;
}
