import type { Metadata } from "next";

import { FormularioDeLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaDeLogin({ searchParams }: PageProps<"/login">) {
  const { redirecionar, motivo } = await searchParams;

  return (
    <FormularioDeLogin
      destino={typeof redirecionar === "string" ? redirecionar : ""}
      saiuPorInatividade={motivo === "inatividade"}
    />
  );
}
