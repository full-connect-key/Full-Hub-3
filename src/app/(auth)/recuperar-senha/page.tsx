import type { Metadata } from "next";

import { FormularioDeRecuperacao } from "./formulario";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function PaginaDeRecuperacao() {
  return <FormularioDeRecuperacao />;
}
