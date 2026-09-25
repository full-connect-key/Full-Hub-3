"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import type { LinhaDoAcompanhamento, TrilhaDaGrade } from "@/lib/dados/academy";
import { cn } from "@/lib/utils";

import { salvarTrilha } from "./acoes";

/**
 * A gestão da Academy.
 *
 * O ACOMPANHAMENTO COMEÇA PELAS OBRIGATÓRIAS, e dentro delas por quem está
 * mais atrás. É a única ordenação que responde à pergunta que faz a aba
 * existir: "quem ainda não fez?". Ordenar por nome deixaria isso espalhado por
 * três telas de rolagem.
 *
 * A tabela lê da view `academy_progresso_da_equipe`, que NÃO tem a coluna de
 * anotações — a anotação de cada pessoa é dela. Veja `lib/dados/academy.ts`.
 */
export function PainelDaGestao({
  trilhas,
  acompanhamento,
}: {
  trilhas: TrilhaDaGrade[];
  acompanhamento: LinhaDoAcompanhamento[];
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [criando, setCriando] = useState(false);
  const [soObrigatorias, setSoObrigatorias] = useState(true);

  const visiveis = soObrigatorias
    ? acompanhamento.filter((l) => l.obrigatoria)
    : acompanhamento;

  function exportar() {
    const csv = montarCSV(
      ["Pessoa", "Trilha", "Obrigatória", "Concluídos", "Total", "%", "Concluída em"],
      visiveis.map((l) => [
        l.nome,
        l.trilha,
        l.obrigatoria ? "sim" : "não",
        l.concluidos,
        l.total,
        l.percentual,
        l.concluidaEm ? format(parseISO(l.concluidaEm), "dd/MM/yyyy") : "",
      ]),
    );

    baixarCSV(csv, `academy-acompanhamento-${format(new Date(), "yyyy-MM-dd")}.csv`);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-text-primary text-sm font-semibold">Trilhas</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCriando(true)}>
            <Plus aria-hidden />
            Nova trilha
          </Button>
        </div>

        {criando ? (
          <FormularioDeTrilha
            executando={executando}
            aoFechar={() => setCriando(false)}
            aoSalvar={(dados) =>
              iniciar(async () => {
                const r = await chamarAcao(() => salvarTrilha(null, dados));
                if (r.ok) {
                  toast.success(r.mensagem ?? "Criada.");
                  setCriando(false);
                  router.refresh();
                  if (r.dados) router.push(`/painel/academy/${r.dados}`);
                } else {
                  toast.error(r.error ?? "Não foi possível.");
                }
              })
            }
          />
        ) : null}

        {trilhas.length === 0 ? (
          <EmptyState
            title="Nenhuma trilha ainda"
            description="Comece por uma: “Onboarding da casa”, “Como a agência escreve briefing”."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {trilhas.map((trilha) => (
              <li key={trilha.id}>
                <Link
                  href={`/painel/academy/${trilha.id}`}
                  className="rounded-card bg-surface-card flex items-center justify-between gap-3 border p-3 hover:shadow-sm"
                >
                  <span className="min-w-0">
                    <span className="text-text-primary block truncate text-sm font-medium">
                      {trilha.titulo}
                    </span>
                    <span className="text-text-muted text-xs">
                      {trilha.quantosMateriais}{" "}
                      {trilha.quantosMateriais === 1 ? "material" : "materiais"}
                      {trilha.area ? ` · ${trilha.area}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {trilha.obrigatoria ? (
                      <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 text-[11px]">
                        Obrigatória
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        trilha.publicada
                          ? "bg-success-soft text-success"
                          : "bg-neutral-soft text-neutral",
                      )}
                    >
                      {trilha.publicada ? "Publicada" : "Rascunho"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-text-primary text-sm font-semibold">Acompanhamento</h2>
            <p className="text-text-muted text-xs">
              Quem concluiu o quê. A anotação pessoal de cada material não aparece aqui —
              ela é de quem a escreveu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-text-secondary flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-brand size-4"
                checked={soObrigatorias}
                onChange={(e) => setSoObrigatorias(e.target.checked)}
              />
              Só as obrigatórias
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={exportar}
              disabled={visiveis.length === 0}
            >
              <Download aria-hidden />
              Exportar CSV
            </Button>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <EmptyState
            title={soObrigatorias ? "Nenhuma trilha obrigatória publicada" : "Nada a acompanhar"}
            description={
              soObrigatorias
                ? "Marque uma trilha como obrigatória para acompanhar quem já fez."
                : "Publique uma trilha com materiais e o acompanhamento começa a existir."
            }
          />
        ) : (
          <div className="rounded-card overflow-x-auto border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Trilha</TableHead>
                  <TableHead className="w-48">Progresso</TableHead>
                  <TableHead className="text-right">Concluída em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((linha) => (
                  <TableRow key={`${linha.usuarioId}-${linha.trilhaId}`}>
                    <TableCell className="font-medium">{linha.nome}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {linha.trilha}
                        {linha.obrigatoria ? (
                          <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 text-[11px]">
                            Obrigatória
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <BarraDeProgresso
                        valor={linha.concluidos}
                        total={linha.total}
                        tom={linha.concluidos >= linha.total ? "sucesso" : "marca"}
                        rotulo={`${linha.concluidos} de ${linha.total}`}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {/* Data de conclusão é registro do que ACONTECEU, e por
                          isso sai com date-fns e não com DateBadge — o badge
                          pinta o passado de vermelho como se fosse atraso. */}
                      {linha.concluidaEm
                        ? format(parseISO(linha.concluidaEm), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function FormularioDeTrilha({
  aoFechar,
  aoSalvar,
  executando,
}: {
  aoFechar: () => void;
  aoSalvar: (dados: Record<string, unknown>) => void;
  executando: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState("");
  const [obrigatoria, setObrigatoria] = useState(false);

  return (
    <div className="rounded-card bg-surface-card space-y-3 border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="trilha-titulo">Nome da trilha *</Label>
          <Input
            id="trilha-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Onboarding da casa"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trilha-area">Área</Label>
          <Input
            id="trilha-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Processos, Design, Atendimento…"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="trilha-descricao">Descrição</Label>
          <Textarea
            id="trilha-descricao"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
      </div>

      <label className="text-text-secondary flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-brand size-4"
          checked={obrigatoria}
          onChange={(e) => setObrigatoria(e.target.checked)}
        />
        Obrigatória para toda a equipe
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={aoFechar} disabled={executando}>
          Cancelar
        </Button>
        <Button
          disabled={executando}
          onClick={() =>
            // Nasce SEM publicar, sempre. Uma trilha vazia que já aparece para
            // a equipe é um convite a abrir e não encontrar nada.
            aoSalvar({ titulo, descricao, area, obrigatoria, publicada: false })
          }
        >
          {executando ? <Loader2 className="animate-spin" /> : null}
          Criar e montar os materiais
        </Button>
      </div>
    </div>
  );
}
