import { Layers } from "lucide-react";

export default function LayoutAutenticacao({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-brand-contraste">
            <Layers aria-hidden className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Full Hub</h1>
            <p className="text-sm text-texto-suave">Painel interno da agencia</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
