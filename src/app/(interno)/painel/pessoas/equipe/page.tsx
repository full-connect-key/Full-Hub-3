import { redirect } from "next/navigation";

/** Ver `clientes/page.tsx` ao lado: apagar o id do fim da URL é como se volta. */
export default function EquipeVaiParaAAba() {
  redirect("/painel/pessoas?aba=equipe");
}
