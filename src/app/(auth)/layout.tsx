import { Logo } from "@/components/shared/logo";

export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return (
    <main className="from-muted/60 via-background to-muted/40 flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo tamanho="lg" className="flex-col gap-3" />
          <p className="text-muted-foreground text-sm">Plataforma interna da Full Connect Key</p>
        </div>
        {children}
      </div>
    </main>
  );
}
