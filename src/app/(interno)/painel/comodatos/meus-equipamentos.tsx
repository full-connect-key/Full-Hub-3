"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, FileText, Loader2, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { MeuComodato } from "@/lib/dados/comodatos";
import {
  ICONE_DO_TIPO,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_TIPO,
  TOM_DA_DEVOLUCAO,
  situacaoDaDevolucao,
} from "@/lib/dominio/comodatos";
import { cn } from "@/lib/utils";

import { confirmarRecebimento, reportarProblema } from "./acoes";

/**
 * O que está comigo.
 *
 * ---------------------------------------------------------------------------
 * **O ACEITE PENDENTE ABRE A LISTA, e é a única coisa que pede ação dele.**
 *
 * Ele fica em destaque com o termo à mão, porque é o que a pessoa está
 * aceitando: confirmar recebimento sem ter onde ler o que vem junto é assinar
 * um papel em branco. A lista de acessórios e o termo ficam ACIMA do botão,
 * pela mesma razão que o Sprint 12 pôs a arte antes dos botões no portal.
 * ---------------------------------------------------------------------------
 *
 * **E as duas ações dele são estas duas.** Ele não edita, não empresta e não
 * devolve — quem faz isso é a gestão, e o banco recusa o resto: não existe
 * policy de UPDATE para ele em `asset_loans`.
 */
export function MeusEquipamentos({ comodatos, hoje }: { comodatos: MeuComodato[]; hoje: string }) {
  const comigo = comodatos.filter((c) => !c.devolvido);
  const devolvidos = comodatos.filter((c) => c.devolvido);

  if (comodatos.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nenhum equipamento com você"
        description="Quando a agência te entregar algo, ele aparece aqui para você confirmar o recebimento."
      />
    );
  }

  return (
    <div className="space-y-6">
      {comigo.length > 0 ? (
        <section className="space-y-3" aria-labelledby="comigo-titulo">
          <h2 id="comigo-titulo" className="text-text-primary text-sm font-semibold">
            Com você{" "}
            <span className="text-text-muted font-normal tabular-nums">{comigo.length}</span>
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {comigo.map((c) => (
              <li key={c.loan_id}>
                <Cartao comodato={c} hoje={hoje} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* O HISTÓRICO SERVE PARA A PRÓPRIA PESSOA SE DEFENDER: "devolvi em
          março" é uma frase que precisa de onde ser conferida, e sem esta
          lista ela fica na memória de duas pessoas que lembram diferente. */}
      {devolvidos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="devolvidos-titulo">
          <h2 id="devolvidos-titulo" className="text-text-primary text-sm font-semibold">
            Já devolvidos{" "}
            <span className="text-text-muted font-normal tabular-nums">{devolvidos.length}</span>
          </h2>
          <ul className="divide-border divide-y rounded-xl border">
            {devolvidos.map((c) => (
              <li key={c.loan_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                {/* O CÓDIGO É ITEM PRÓPRIO DA LINHA, e não um trecho dentro do
                    nome: juntos num só `truncate`, o nome come a largura e o
                    patrimônio some — foi o que a imagem de 375px mostrou,
                    "Tripé Manfr…" sem o FCK-0004. E o patrimônio é justamente
                    o que identifica a peça na frase que esta lista existe para
                    sustentar.

                    O `min-w` é a mesma correção de "Meu dia": sem um piso, o
                    nome é o único a ceder largura e a linha cabe em qualquer
                    tela encolhendo-o; com ele, o resto quebra para a linha de
                    baixo, que é o que o `flex-wrap` está aqui para fazer. */}
                <span className="text-text-primary min-w-[10rem] flex-1 truncate text-sm">
                  {c.nome}
                </span>
                {c.codigo ? (
                  <span className="text-text-muted text-xs tabular-nums">{c.codigo}</span>
                ) : null}
                <span className="text-text-secondary text-xs tabular-nums">
                  {format(parseISO(c.data_entrega), "dd/MM/yy", { locale: ptBR })} —{" "}
                  {c.data_devolucao
                    ? format(parseISO(c.data_devolucao), "dd/MM/yy", { locale: ptBR })
                    : "—"}
                </span>
                {c.estado_devolucao ? (
                  <span className="text-text-muted text-xs">
                    devolvido {ROTULOS_DE_ESTADO[c.estado_devolucao].toLowerCase()}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Cartao({ comodato: c, hoje }: { comodato: MeuComodato; hoje: string }) {
  const router = useRouter();
  const [confirmando, confirmar] = useTransition();
  const [relato, setRelato] = useState("");
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const Icone = ICONE_DO_TIPO[c.tipo];
  const situacao = situacaoDaDevolucao(c, hoje);
  const precisaAceitar = c.aceito_em === null;

  function aceitar() {
    confirmar(async () => {
      const r = await chamarEMostrar(() => confirmarRecebimento(c.loan_id));
      if (r.ok) router.refresh();
    });
  }

  async function relatar() {
    setEnviando(true);
    const r = await chamarEMostrar(() => reportarProblema(c.loan_id, relato));
    setEnviando(false);
    if (r.ok) {
      setAberto(false);
      setRelato("");
      router.refresh();
    }
  }

  return (
    <article
      className={cn(
        "bg-surface-card flex h-full flex-col gap-3 rounded-xl border p-4",
        precisaAceitar && "border-warning",
      )}
    >
      <div className="flex items-start gap-3">
        {c.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.foto}
            alt=""
            className="bg-muted size-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          /* O ÍCONE É POR TIPO, e não um genérico: equipamento recém-cadastrado
             não tem foto, e um quadrado igual em todos é a mesma coisa que
             nenhuma imagem. */
          <span className="bg-muted text-text-muted grid size-16 shrink-0 place-items-center rounded-lg">
            <Icone aria-hidden className="size-7" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-text-primary truncate text-sm font-medium">{c.nome}</h3>
          <p className="text-text-secondary truncate text-xs">
            {[ROTULOS_DE_TIPO[c.tipo], c.marca, c.modelo].filter(Boolean).join(" · ")}
          </p>
          <p className="text-text-muted truncate text-xs tabular-nums">
            {[c.codigo, c.numero_serie && `série ${c.numero_serie}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">Com você desde</dt>
          <dd className="text-text-primary tabular-nums">
            {format(parseISO(c.data_entrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Devolução</dt>
          <dd className={cn("tabular-nums", TOM_DA_DEVOLUCAO[situacao])}>
            {c.data_prevista_devolucao
              ? format(parseISO(c.data_prevista_devolucao), "dd/MM/yyyy", { locale: ptBR })
              : "sem data combinada"}
            {situacao === "atrasada" ? " · passou" : null}
            {situacao === "perto" ? " · logo" : null}
          </dd>
        </div>
        {c.acessorios ? (
          <div className="sm:col-span-2">
            <dt className="text-text-muted">Veio junto</dt>
            <dd className="text-text-primary">{c.acessorios}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-text-muted">Estado na entrega</dt>
          <dd className="text-text-primary">{ROTULOS_DE_ESTADO[c.estado_entrega]}</dd>
        </div>
      </dl>

      {precisaAceitar ? (
        <Alert className="border-warning bg-warning-soft">
          <AlertTriangle aria-hidden className="size-4" />
          <AlertDescription className="text-text-primary">
            Confirme que você recebeu este equipamento. Leia o termo e confira os acessórios
            antes — é o que você está aceitando.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-text-muted text-xs">
          Recebimento confirmado em{" "}
          {format(new Date(c.aceito_em!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/painel/comodatos/${c.loan_id}/termo`} target="_blank" rel="noreferrer">
            <FileText aria-hidden />
            Baixar termo
          </a>
        </Button>

        {precisaAceitar ? (
          <Button size="sm" onClick={aceitar} disabled={confirmando}>
            {confirmando ? <Loader2 className="animate-spin" /> : <CheckCircle2 aria-hidden />}
            Confirmar recebimento
          </Button>
        ) : null}

        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          <TriangleAlert aria-hidden />
          Reportar problema
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar um problema em {c.nome}</DialogTitle>
            <DialogDescription>
              A gestão é avisada e o relato fica no histórico do equipamento. Nada muda de
              situação por causa disto — quem avalia é ela.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            placeholder="A tampa está soltando, a bateria não segura carga…"
            aria-label="O que aconteceu"
            rows={4}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={relatar} disabled={enviando || relato.trim() === ""}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Enviar para a gestão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
