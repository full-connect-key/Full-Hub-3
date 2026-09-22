import { BarraSuperior } from "@/components/barra-superior";
import { NavegacaoLateral } from "@/components/navegacao-lateral";
import { exigirSessao, nomeDeExibicao } from "@/lib/auth/dal";

export default async function LayoutDoDashboard({ children }: LayoutProps<"/">) {
  // Segunda barreira: o proxy ja filtrou, mas a pagina confere por conta
  // propria. Se um dia o matcher do proxy mudar, isto continua protegendo.
  const { usuario, perfil } = await exigirSessao();

  return (
    <div className="flex min-h-dvh">
      <NavegacaoLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior
          nome={nomeDeExibicao(perfil, usuario.email)}
          email={usuario.email ?? ""}
        />
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
