"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { PanoramaDeSkills, SkillDoCatalogo } from "@/lib/dados/skills";
import {
  EXPLICACAO_DA_DEPENDENCIA,
  NIVEIS,
  OPACIDADE_DO_NIVEL,
  PESO_DO_NIVEL,
  ROTULOS_DE_NIVEL,
  dependenciaDaSkill,
} from "@/lib/dominio/skills";
import type { SkillNivel } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  aprovarSkill,
  arquivarSkill,
  salvarSkillDoCatalogo,
} from "../meu-desenvolvimento/acoes";

const TODAS = "__todas__";

/**
 * As skills da agência, para a gestão.
 *
 * A BUSCA VEM PRIMEIRO, e isso não é ordem de leitura — é o que o sprint
 * chamou de "a função mais usada na prática". A pergunta real do dia a dia é
 * "quem sabe fazer isso?", feita quando uma demanda chega e alguém precisa
 * decidir para quem mandar. A matriz responde a mesma coisa em grade, e é boa
 * para planejar; a busca é boa para agora.
 *
 * As lacunas são a mesma pergunta ao contrário — "o que ninguém sabe fazer?"
 * —, e o caso que mais passa batido não é o zero: é o UM. A skill existe, o
 * trabalho sai, e no dia em que aquela pessoa tira férias ninguém tinha
 * percebido que era ela sozinha.
 */
export function SkillsDaAgencia({
  panorama,
  catalogo,
}: {
  panorama: PanoramaDeSkills;
  catalogo: SkillDoCatalogo[];
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(TODAS);
  const [area, setArea] = useState(TODAS);
  const [nivelMinimo, setNivelMinimo] = useState<SkillNivel | typeof TODAS>(TODAS);

  const termo = busca.trim().toLowerCase();

  const encontradas = useMemo(() => {
    if (termo.length < 2) return [];
    return panorama.skills
      .filter((s) => s.nome.toLowerCase().includes(termo))
      .slice(0, 6);
  }, [termo, panorama.skills]);

  const skillsVisiveis = useMemo(() => {
    let lista = panorama.skills;
    if (categoria !== TODAS) lista = lista.filter((s) => s.categoria === categoria);
    if (nivelMinimo !== TODAS) {
      lista = lista.filter((s) =>
        s.pessoas.some((p) => PESO_DO_NIVEL[p.nivel] >= PESO_DO_NIVEL[nivelMinimo]),
      );
    }
    // Skill que ninguém tem não entra na matriz: seria uma coluna inteira
    // vazia, e a informação "ninguém sabe isso" já está nas lacunas, dita por
    // extenso.
    return lista.filter((s) => s.pessoas.length > 0);
  }, [panorama.skills, categoria, nivelMinimo]);

  const pessoasVisiveis = useMemo(
    () => (area === TODAS ? panorama.pessoas : panorama.pessoas.filter((p) => p.area === area)),
    [panorama.pessoas, area],
  );

  const lacunas = useMemo(
    () =>
      panorama.skills
        .map((s) => ({ ...s, dependencia: dependenciaDaSkill(s.quantosSeniores) }))
        .filter((s) => s.dependencia !== "coberta")
        // Skill que ninguém tem em nível nenhum não é lacuna da agência: é
        // uma linha do catálogo que ninguém usa. Lacuna é onde o trabalho
        // acontece e depende de pouca gente.
        .filter((s) => s.pessoas.length > 0)
        .sort((a, b) => a.quantosSeniores - b.quantosSeniores),
    [panorama.skills],
  );

  return (
    <div className="space-y-8">
      <BuscaDeQuemSabe termo={termo} busca={busca} setBusca={setBusca} encontradas={encontradas} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
            Matriz de skills
          </h2>

          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="ml-auto w-44" size="sm" aria-label="Filtrar por categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as categorias</SelectItem>
              {panorama.categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-40" size="sm" aria-label="Filtrar por área">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as áreas</SelectItem>
              {panorama.areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={nivelMinimo}
            onValueChange={(v) => setNivelMinimo(v as SkillNivel | typeof TODAS)}
          >
            <SelectTrigger className="w-40" size="sm" aria-label="Nível mínimo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Qualquer nível</SelectItem>
              {NIVEIS.map((n) => (
                <SelectItem key={n} value={n}>
                  {ROTULOS_DE_NIVEL[n]} ou mais
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Matriz pessoas={pessoasVisiveis} skills={skillsVisiveis} />
      </section>

      <Lacunas lacunas={lacunas} />

      <Interesses interesses={panorama.interesses} />

      <Catalogo catalogo={catalogo} categorias={panorama.categorias} />
    </div>
  );
}

function BuscaDeQuemSabe({
  termo,
  busca,
  setBusca,
  encontradas,
}: {
  termo: string;
  busca: string;
  setBusca: (valor: string) => void;
  encontradas: PanoramaDeSkills["skills"];
}) {
  return (
    <section className="bg-surface-card rounded-card space-y-3 border p-4">
      <div>
        <h2 className="text-text-primary text-sm font-semibold">Quem sabe fazer…?</h2>
        <p className="text-text-secondary text-sm">
          Escreva uma skill e veja quem da casa tem, do mais avançado para o menos.
        </p>
      </div>

      <div className="relative">
        <Search
          aria-hidden
          className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="After Effects, SEO, Copywriting…"
          aria-label="Buscar quem sabe uma skill"
          className="pl-9"
        />
      </div>

      {termo.length >= 2 ? (
        encontradas.length === 0 ? (
          <p className="text-text-muted text-sm">Nenhuma skill do catálogo com “{busca.trim()}”.</p>
        ) : (
          <ul className="space-y-3">
            {encontradas.map((skill) => (
              <li key={skill.id}>
                <p className="mb-1.5 text-sm font-medium">
                  {skill.nome}
                  <span className="text-text-muted ml-2 text-xs font-normal">
                    {skill.pessoas.length === 0
                      ? "ninguém ainda"
                      : `${skill.pessoas.length} pessoa${skill.pessoas.length === 1 ? "" : "s"}`}
                  </span>
                </p>

                {skill.pessoas.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {skill.pessoas.map((pessoa) => (
                      <li
                        key={pessoa.id}
                        className="bg-neutral-soft inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1"
                      >
                        <UserAvatar name={pessoa.nome} src={pessoa.avatarUrl} size="sm" />
                        <span className="text-sm">{pessoa.nome}</span>
                        <span className="text-text-muted text-xs">
                          {ROTULOS_DE_NIVEL[pessoa.nivel]}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function Matriz({
  pessoas,
  skills,
}: {
  pessoas: PanoramaDeSkills["pessoas"];
  skills: PanoramaDeSkills["skills"];
}) {
  if (pessoas.length === 0 || skills.length === 0) {
    return (
      <p className="text-text-secondary rounded-card border border-dashed p-6 text-center text-sm">
        Nada para cruzar com esses filtros.
      </p>
    );
  }

  return (
    <div className="rounded-card overflow-x-auto border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="bg-surface-card text-text-muted sticky left-0 z-20 border-r border-b px-3 py-2 text-left text-xs font-medium">
              Pessoa
            </th>
            {skills.map((skill) => (
              <th
                key={skill.id}
                scope="col"
                className="text-text-muted h-28 border-b p-0 text-xs font-medium"
              >
                {/* Vertical: com vinte skills na horizontal, o cabeçalho
                    deitado faria a tabela ter três metros de largura. */}
                <span className="block h-28 w-8 [writing-mode:vertical-rl] [text-orientation:mixed]">
                  <span className="inline-block truncate py-2">{skill.nome}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {pessoas.map((pessoa) => (
            <tr key={pessoa.id}>
              <th
                scope="row"
                className="bg-surface-card sticky left-0 z-10 border-r border-b px-3 py-1.5 text-left font-normal"
              >
                <span className="block truncate text-sm">{pessoa.nome}</span>
                <span className="text-text-muted block truncate text-[11px]">{pessoa.area}</span>
              </th>

              {skills.map((skill) => {
                const nivel = pessoa.niveis.get(skill.id);
                return (
                  <td key={skill.id} className="border-b p-0 text-center">
                    {nivel ? (
                      <span
                        title={`${pessoa.nome} — ${skill.nome}: ${ROTULOS_DE_NIVEL[nivel]}`}
                        aria-label={`${pessoa.nome}, ${skill.nome}: ${ROTULOS_DE_NIVEL[nivel]}`}
                        className="bg-accent-strong mx-auto block size-5 rounded-sm"
                        style={{ opacity: OPACIDADE_DO_NIVEL[nivel] }}
                      />
                    ) : (
                      <span className="sr-only">
                        {pessoa.nome} não tem {skill.nome}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Lacunas({
  lacunas,
}: {
  lacunas: (PanoramaDeSkills["skills"][number] & {
    dependencia: ReturnType<typeof dependenciaDaSkill>;
  })[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Lacunas da agência
        </h2>
        <p className="text-text-secondary text-sm">
          Skills que o trabalho usa e que dependem de pouca gente. O caso que mais passa batido não
          é o zero — é o um.
        </p>
      </div>

      {lacunas.length === 0 ? (
        <p className="bg-success-soft text-success rounded-card border border-transparent p-4 text-sm">
          Nenhuma skill em uso depende de uma pessoa só.
        </p>
      ) : (
        <ul className="space-y-2">
          {lacunas.map((skill) => (
            <li
              key={skill.id}
              className={cn(
                "rounded-card flex flex-wrap items-center gap-3 border p-3",
                skill.dependencia === "sem_ninguem"
                  ? "bg-danger-soft border-transparent"
                  : "bg-warning-soft border-transparent",
              )}
            >
              <TriangleAlert
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  skill.dependencia === "sem_ninguem" ? "text-danger" : "text-warning",
                )}
              />
              <span className="text-sm font-medium">{skill.nome}</span>
              <Badge variant="outline">{skill.categoria}</Badge>
              <span className="text-text-secondary text-sm">
                {EXPLICACAO_DA_DEPENDENCIA[skill.dependencia]}
              </span>
              {skill.pessoas.length > 0 ? (
                <span className="text-text-muted ml-auto text-xs">
                  {skill.pessoas
                    .slice(0, 3)
                    .map((p) => `${p.nome} (${ROTULOS_DE_NIVEL[p.nivel].toLowerCase()})`)
                    .join(", ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Interesses({ interesses }: { interesses: PanoramaDeSkills["interesses"] }) {
  if (interesses.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          O que as pessoas querem desenvolver
        </h2>
        <p className="text-text-secondary text-sm">
          Marcado por elas mesmas. É o insumo do Full Academy — e o jeito mais barato de saber o
          que vale ensinar.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {interesses.map((interesse) => (
          <li
            key={interesse.skillId}
            className="bg-surface-card rounded-card flex items-center gap-2 border px-3 py-2"
          >
            <Star aria-hidden className="text-warning size-3.5 fill-current" />
            <span className="text-sm font-medium">{interesse.nome}</span>
            <span className="text-text-muted text-xs">
              {interesse.pessoas.map((p) => p.nome.split(" ")[0]).join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Catalogo({
  catalogo,
  categorias,
}: {
  catalogo: SkillDoCatalogo[];
  categorias: string[];
}) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [editando, setEditando] = useState<SkillDoCatalogo | "nova" | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");

  const pendentes = catalogo.filter((s) => s.sugerida_por !== null);
  const ativas = catalogo.filter((s) => s.ativa);
  const arquivadas = catalogo.filter((s) => !s.ativa && s.sugerida_por === null);

  function responder(resultado: { ok: boolean; mensagem?: string; error?: string }) {
    if (!resultado.ok) toast.error(resultado.error ?? "Não deu certo.");
    else {
      toast.success(resultado.mensagem ?? "Pronto.");
      setEditando(null);
      router.refresh();
    }
  }

  function abrir(alvo: SkillDoCatalogo | "nova") {
    setEditando(alvo);
    setNome(alvo === "nova" ? "" : alvo.nome);
    setCategoria(alvo === "nova" ? "" : (alvo.categoria ?? ""));
    setDescricao(alvo === "nova" ? "" : (alvo.descricao ?? ""));
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
            Catálogo
          </h2>
          <p className="text-text-secondary text-sm">
            O nome é compartilhado: é o que faz “quem sabe fazer X?” ter resposta.
          </p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => abrir("nova")}>
          <Plus aria-hidden />
          Nova skill
        </Button>
      </div>

      {pendentes.length > 0 ? (
        <div className="bg-accent rounded-card space-y-2 border p-3">
          <p className="text-accent-foreground text-sm font-medium">
            {pendentes.length} sugestão(ões) da equipe esperando você
          </p>
          <ul className="space-y-1.5">
            {pendentes.map((skill) => (
              <li key={skill.id} className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{skill.nome}</span>
                {skill.categoria ? <Badge variant="outline">{skill.categoria}</Badge> : null}
                <span className="text-text-muted text-xs">
                  sugerida por {skill.sugeridaPor?.nome ?? "—"}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    disabled={executando}
                    onClick={() =>
                      iniciar(async () => responder(await chamarAcao(() => aprovarSkill(skill.id))))
                    }
                  >
                    {executando ? <Loader2 className="animate-spin" /> : <Check aria-hidden />}
                    Aprovar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => abrir(skill)}>
                    Ajustar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="bg-surface-card rounded-card divide-y border">
        {[...ativas, ...arquivadas].map((skill) => (
          <li
            key={skill.id}
            className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !skill.ativa && "opacity-60")}
          >
            <span className="text-sm font-medium">{skill.nome}</span>
            {skill.categoria ? <Badge variant="secondary">{skill.categoria}</Badge> : null}
            {!skill.ativa ? <Badge variant="outline">Arquivada</Badge> : null}
            <span className="text-text-muted text-xs">
              {skill.quantasPessoas === 0
                ? "ninguém tem"
                : `${skill.quantasPessoas} pessoa${skill.quantasPessoas === 1 ? "" : "s"}`}
            </span>

            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${skill.nome}`}
                onClick={() => abrir(skill)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={skill.ativa ? `Arquivar ${skill.nome}` : `Reativar ${skill.nome}`}
                disabled={executando}
                onClick={() =>
                  iniciar(async () =>
                    responder(await chamarAcao(() => arquivarSkill(skill.id, !skill.ativa))),
                  )
                }
              >
                {skill.ativa ? <Archive aria-hidden /> : <RotateCcw aria-hidden />}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando === "nova" ? "Nova skill" : "Editar skill"}</DialogTitle>
            <DialogDescription>
              O nome entra no perfil de todo mundo que escolher essa skill. Prefira o nome que a
              equipe já usa falando.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-nome">Nome</Label>
              <Input
                id="skill-nome"
                autoFocus
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="After Effects"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-categoria">Categoria</Label>
              <Input
                id="skill-categoria"
                list="categorias-de-skill"
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                placeholder="Ferramenta"
              />
              <datalist id="categorias-de-skill">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-descricao">Descrição (opcional)</Label>
              <Input
                id="skill-descricao"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="O que essa skill cobre"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={executando || nome.trim().length < 2}
              onClick={() =>
                iniciar(async () =>
                  responder(
                    await chamarAcao(() =>
                      salvarSkillDoCatalogo(
                        editando === "nova" || editando === null ? null : editando.id,
                        { nome, categoria, descricao },
                      ),
                    ),
                  ),
                )
              }
            >
              {executando ? <Loader2 className="animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
