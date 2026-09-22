import type { Metadata } from "next";

import { FormularioDeRecuperacao } from "./formulario";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaDeRecuperacao() {
  return <FormularioDeRecuperacao />;
}
