import { CascaDeAutenticacao } from "@/components/auth/casca-de-autenticacao";

export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return <CascaDeAutenticacao>{children}</CascaDeAutenticacao>;
}
