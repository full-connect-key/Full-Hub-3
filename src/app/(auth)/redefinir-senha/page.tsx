import type { Metadata } from "next";

import { FormularioDeNovaSenha } from "./formulario";

export const metadata: Metadata = { title: "Nova senha" };

export default function PaginaDeNovaSenha() {
  return <FormularioDeNovaSenha />;
}
