import { redirect } from "next/navigation";

/** A raiz nao tem conteudo proprio: quem chega vai para o dashboard. */
export default function Home() {
  redirect("/dashboard");
}
