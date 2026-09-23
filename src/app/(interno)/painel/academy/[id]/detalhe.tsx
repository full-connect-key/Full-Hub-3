"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutTemplate,
  Loader2,
  Newspaper,
  PartyPopper,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  ROTULOS_DE_MATERIAL,
  TIPOS_DE_MATERIAL,
  enderecoDeIncorporacao,
  modoDeAbrir,
} from "@/lib/dominio/academy";
import { formatarMinutos } from "@/lib/dominio/tempo";
import type { MaterialComProgresso, TrilhaCompleta } from "@/lib/dados/academy";
import type { MaterialTipo } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  excluirMaterial,
  marcarMaterial,
  publicarTrilha,
  reordenarMateriais,
  salvarAnotacao,
  salvarMaterial,
} from "../acoes";

const SEM_SKILL = "__nenhuma__";

const ICONE: Record<MaterialTipo, typeof Play> = {
  video: Play,
  artigo: Newspaper,
  pdf: FileText,
  curso_externo: GraduationCap,
  template: LayoutTemplate,
  aula_interna: BookOpen,
};

/**
 * O detalhe da trilha: a lista de materiais e o que cada pessoa faz com eles.
 *
 * O MATERIAL ABRE NA PRÓPRIA TELA quando dá — vídeo do YouTube ou Vimeo — e
 * FORA quando não dá. Curso e artigo são sites de terceiros: prender num
 * iframe quebra login, cookie e o botão de voltar, então eles abrem em aba
 * nova e a tela diz isso antes de a pessoa clicar.
 *
 * A ANOTAÇÃO É PRIVADA, e a tela afirma isso por escrito. Não é enfeite: é o
 * que permite escrever "não entendi a parte do briefing" sem receio, e uma
 * anotação que a gestão pudesse ler não seria escrita. A RLS fecha em
 * `auth.uid()` e a gestão lê o progresso por uma view que não tem essa coluna.
 */
export function DetalheDaTrilha({
  trilha,
  podeEditar,
  skills,
}: {
  trilha: TrilhaCompleta;
  podeEditar: boolean;
  skills: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [aberto, setAberto] = useState<string | null>(null);
  const [editandoMaterial, setEditandoMaterial] = useState(false);

  const concluida = trilha.quantosMateriais > 0 && trilha.quantosConcluidos >= trilha.quantosMateriais;

  function responder(resultado: { ok: boolean; mensagem?: string; error?: string }) {
    if (resultado.ok) {
      toast.success(resultado.mensagem ?? "Pronto.");
      router.refresh();
    } else {
      toast.error(resultado.error ?? "Não foi possível.");
    }
  }

  function alternar(material: MaterialComProgresso) {
    iniciar(async () =>
      responder(
        await chamarAcao(() => marcarMaterial(material.id, !material.concluido, trilha.id)),
      ),
    );
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= trilha.materiais.length) return;

    const ordem = trilha.materiais.map((m) => m.id);
    [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];

    iniciar(async () =>
      responder(await chamarAcao(() => reordenarMateriais(trilha.id, ordem))),
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-text-primary text-xl font-semibold">{trilha.titulo}</h1>
              {trilha.obrigatoria ? (
                <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 text-[11px] font-medium">
                  Obrigatória
                </span>
              ) : null}
              {!trilha.publicada ? (
                <span className="bg-neutral-soft text-neutral rounded-full px-2 py-0.5 text-[11px] font-medium">
                  Rascunho — só a gestão vê
                </span>
              ) : null}
            </div>
            {trilha.area ? <p className="text-text-muted text-sm">{trilha.area}</p> : null}
            {trilha.descricao ? (
              <p className="text-text-secondary max-w-2xl text-sm leading-relaxed">
                {trilha.descricao}
              </p>
            ) : null}
          </div>

          {podeEditar ? (
            <Button
              variant="outline"
              size="sm"
              disabled={executando}
              onClick={() =>
                iniciar(async () =>
                  responder(
                    await chamarAcao(() => publicarTrilha(trilha.id, !trilha.publicada)),
                  ),
                )
              }
            >
              {trilha.publicada ? "Voltar a rascunho" : "Publicar"}
            </Button>
          ) : null}
        </div>

        <BarraDeProgresso
          className="max-w-md"
          valor={trilha.quantosConcluidos}
          total={trilha.quantosMateriais}
          tom={concluida ? "sucesso" : "marca"}
          rotulo={`${trilha.quantosConcluidos} de ${trilha.quantosMateriais} concluídos${
            trilha.duracaoMinutos !== null ? ` · ${formatarMinutos(trilha.duracaoMinutos)}` : ""
          }`}
        />
      </header>

      {/* A confirmação de trilha concluída aparece NA TELA, e não como toast:
          o toast some em cinco segundos, e quem acabou uma trilha obrigatória
          precisa poder mostrar que acabou. */}
      {concluida ? (
        <div className="bg-success-soft rounded-card flex items-start gap-2 border p-4">
          <PartyPopper aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-success text-sm font-semibold">Trilha concluída</p>
            <p className="text-text-secondary text-sm">
              Você viu os {trilha.quantosMateriais} materiais desta trilha. A data de
              conclusão ficou registrada.
            </p>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-text-primary text-sm font-semibold">Materiais</h2>
          {podeEditar ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditandoMaterial(true)}
              disabled={executando}
            >
              <Plus aria-hidden />
              Material
            </Button>
          ) : null}
        </div>

        {trilha.materiais.length === 0 ? (
          <p className="text-text-muted rounded-card border border-dashed px-4 py-8 text-center text-sm">
            Nenhum material ainda.
            {podeEditar
              ? " Acrescente o primeiro — a trilha só começa a existir quando tem conteúdo."
              : " Quando a gestão acrescentar, ele aparece aqui."}
          </p>
        ) : (
          <ol className="space-y-2">
            {trilha.materiais.map((material, indice) => (
              <li key={material.id}>
                <LinhaDoMaterial
                  material={material}
                  indice={indice}
                  total={trilha.materiais.length}
                  trilhaId={trilha.id}
                  aberto={aberto === material.id}
                  podeEditar={podeEditar}
                  executando={executando}
                  onAbrir={() => setAberto(aberto === material.id ? null : material.id)}
                  onAlternar={() => alternar(material)}
                  onMover={(direcao) => mover(indice, direcao)}
                  onExcluir={() =>
                    iniciar(async () =>
                      responder(
                        await chamarAcao(() => excluirMaterial(material.id, trilha.id)),
                      ),
                    )
                  }
                  onSalvarAnotacao={(texto) =>
                    iniciar(async () =>
                      responder(
                        await chamarAcao(() =>
                          salvarAnotacao(material.id, texto, trilha.id),
                        ),
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {editandoMaterial ? (
        <FormularioDeMaterial
          trilhaId={trilha.id}
          skills={skills}
          aoFechar={() => setEditandoMaterial(false)}
          aoSalvar={(dados) =>
            iniciar(async () => {
              const r = await chamarAcao(() => salvarMaterial(null, dados));
              responder(r);
              if (r.ok) setEditandoMaterial(false);
            })
          }
          executando={executando}
        />
      ) : null}

    </div>
  );
}

function LinhaDoMaterial({
  material,
  indice,
  total,
  aberto,
  podeEditar,
  executando,
  onAbrir,
  onAlternar,
  onMover,
  onExcluir,
  onSalvarAnotacao,
}: {
  material: MaterialComProgresso;
  indice: number;
  total: number;
  trilhaId: string;
  aberto: boolean;
  podeEditar: boolean;
  executando: boolean;
  onAbrir: () => void;
  onAlternar: () => void;
  onMover: (direcao: -1 | 1) => void;
  onExcluir: () => void;
  onSalvarAnotacao: (texto: string) => void;
}) {
  const [anotacao, setAnotacao] = useState(material.anotacoes ?? "");
  const Icone = ICONE[material.tipo];
  const endereco = material.url ?? material.arquivo_url;
  const modo = modoDeAbrir(material.tipo, material.url);
  const incorporacao =
    modo === "embutido" && material.url ? enderecoDeIncorporacao(material.url) : null;

  return (
    <div className="rounded-card bg-surface-card border">
      <div className="flex items-start gap-3 p-3">
        {/* Checkbox nativo, como no resto do produto: o Radix traria uma
            dependência inteira para um controle que o navegador já faz bem, e
            `accent-brand` já o pinta com a cor da marca. */}
        <input
          type="checkbox"
          className="accent-brand mt-1 size-4 shrink-0"
          checked={material.concluido}
          onChange={onAlternar}
          disabled={executando}
          aria-label={`Marcar “${material.titulo}” como concluído`}
        />

        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={aberto}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            <Icone aria-hidden className="text-text-muted size-4 shrink-0" />
            <span
              className={cn(
                "text-text-primary text-sm font-medium",
                material.concluido && "text-text-muted line-through",
              )}
            >
              {material.titulo}
            </span>
            <span className="text-text-muted text-xs">
              {ROTULOS_DE_MATERIAL[material.tipo]}
            </span>
            {material.duracao_minutos ? (
              <span className="text-text-muted text-xs tabular-nums">
                {formatarMinutos(material.duracao_minutos)}
              </span>
            ) : null}
            {material.skillNome ? (
              <span className="bg-blue-soft text-accent-strong rounded-full px-2 py-0.5 text-[11px]">
                {material.skillNome}
              </span>
            ) : null}
          </span>
          {material.descricao ? (
            <span className="text-text-secondary mt-1 block text-xs leading-relaxed">
              {material.descricao}
            </span>
          ) : null}
        </button>

        {podeEditar ? (
          <div className="flex shrink-0 gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Subir"
              disabled={indice === 0 || executando}
              onClick={() => onMover(-1)}
            >
              <ChevronUp aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Descer"
              disabled={indice === total - 1 || executando}
              onClick={() => onMover(1)}
            >
              <ChevronDown aria-hidden />
            </Button>
            {/* O ConfirmDialog deste projeto é acionado por um trigger, e
                não controlado por estado: o botão É o gatilho. Remover um
                material some com o progresso de quem já o concluiu, e isso
                não pode acontecer por clique distraído. */}
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Remover material"
                  disabled={executando}
                >
                  <Trash2 aria-hidden />
                </Button>
              }
              title={`Remover “${material.titulo}”?`}
              description="O material sai da trilha para todo mundo, e o progresso de quem já o concluiu some junto."
              confirmLabel="Remover"
              destructive
              onConfirm={onExcluir}
            />
          </div>
        ) : null}
      </div>

      {aberto ? (
        <div className="space-y-3 border-t p-3">
          {incorporacao ? (
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-md border">
              <iframe
                src={incorporacao}
                title={material.titulo}
                allowFullScreen
                className="size-full"
              />
            </div>
          ) : endereco ? (
            <a
              href={endereco}
              target="_blank"
              rel="noreferrer"
              className="text-accent-strong inline-flex items-center gap-1.5 text-sm hover:underline"
            >
              <ExternalLink aria-hidden className="size-4" />
              {/* A tela diz que abre fora ANTES do clique: um link que rouba a
                  aba sem avisar faz a pessoa perder onde estava. */}
              Abrir em nova aba
            </a>
          ) : (
            <p className="text-text-muted text-sm">
              Este material não tem endereço — é a descrição de um padrão a reproduzir.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`anotacao-${material.id}`} className="text-xs">
              Minhas anotações
            </Label>
            <Textarea
              id={`anotacao-${material.id}`}
              rows={3}
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
              placeholder="O que você quer lembrar disto depois."
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-text-muted text-xs">
                Só você lê isto. Nem a gestão — ela acompanha a conclusão, não o que
                você escreveu.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={executando || anotacao === (material.anotacoes ?? "")}
                onClick={() => onSalvarAnotacao(anotacao)}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormularioDeMaterial({
  trilhaId,
  skills,
  aoFechar,
  aoSalvar,
  executando,
}: {
  trilhaId: string;
  skills: { id: string; nome: string }[];
  aoFechar: () => void;
  aoSalvar: (dados: Record<string, unknown>) => void;
  executando: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<MaterialTipo>("video");
  const [url, setUrl] = useState("");
  const [duracao, setDuracao] = useState("");
  const [skill, setSkill] = useState(SEM_SKILL);

  return (
    <section className="rounded-card bg-surface-card space-y-4 border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-text-primary text-sm font-semibold">Novo material</h3>
          <p className="text-text-muted text-xs">
            Vincular a uma skill é o que faz esta trilha aparecer em “Recomendadas para
            você” de quem quer desenvolvê-la.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Fechar" onClick={aoFechar}>
          <X aria-hidden />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="material-titulo">Título *</Label>
          <Input
            id="material-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Como a agência escreve um briefing"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-tipo">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as MaterialTipo)}>
            <SelectTrigger id="material-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DE_MATERIAL.map((t) => (
                <SelectItem key={t} value={t}>
                  {ROTULOS_DE_MATERIAL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-duracao">Duração (minutos)</Label>
          <Input
            id="material-duracao"
            inputMode="numeric"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))}
            placeholder="12"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="material-url">Link</Label>
          <Input
            id="material-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=… ou https://…"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="material-skill">Skill que este material desenvolve</Label>
          <Select value={skill} onValueChange={setSkill}>
            <SelectTrigger id="material-skill" className="w-full">
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_SKILL}>Nenhuma</SelectItem>
              {skills.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="material-descricao">Descrição</Label>
          <Textarea
            id="material-descricao"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={aoFechar} disabled={executando}>
          Cancelar
        </Button>
        <Button
          disabled={executando}
          onClick={() =>
            aoSalvar({
              track_id: trilhaId,
              titulo,
              descricao,
              tipo,
              url,
              duracao_minutos: duracao ? Number(duracao) : null,
              skill_id: skill === SEM_SKILL ? null : skill,
            })
          }
        >
          {executando ? <Loader2 className="animate-spin" /> : null}
          Adicionar
        </Button>
      </div>
    </section>
  );
}
