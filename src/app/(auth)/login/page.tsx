import type { Metadata } from "next";

import { FormularioDeLogin } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaDeLogin({ searchParams }: PageProps<"/login">) {
  const { redirecionar } = await searchParams;
  const destino = typeof redirecionar === "string" ? redirecionar : "/dashboard";

  return <FormularioDeLogin destino={destino} />;
}
