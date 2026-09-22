"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
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
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { MinhaSkill } from "@/lib/dados/skills";
import { NIVEIS, PESO_DO_NIVEL, ROTULOS_DE_NIVEL } from "@/lib/dominio/skills";
import type { Skill } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { removerMinhaSkill, salvarMinhaSkill, sugerirSkill } from "./acoes";
import { SeletorDeNivel } from "./seletor-de-nivel";

const NOVA = "__nova__";

/**
 * O perfil de habilidades da própria pessoa.
 *
 * **Salva sozinho.** Um perfil de skills é mexido aos poucos — sobe um nível
 * aqui, marca uma estrela ali —, e um botão "Salvar" no fim de uma lista de
 * vinte linhas é o jeito mais seguro de a pessoa perder o que ajustou. O
 * indicador no topo diz quando gravou.
 *
 * A gravação é adiada por um instante depois do último toque: sem isso,
 * arrastar o nível de Iniciante até Especialista dispararia quatro gravações,
 * e a terceira poderia chegar depois da quarta.
 */
export function MinhasSkills({
  minhas,
  catalogo,
  categorias,
}: {
  minhas: MinhaSkill[];
  catalogo: Skill[];
  categorias: string[];
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  // A lista vive em estado para a tela responder na hora; o servidor confirma
  // depois. Sem isso, cada clique no nível esperaria a ida ao banco para
  // pintar — e a pessoa clicaria de novo achando que não pegou.
  const [lista, setLista] = useState(minhas);
  const [gravadoEm, setGravadoEm] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

  // Não há efeito sincronizando `lista` com `minhas`. Depois que a tela abre,
  // quem manda é o estado local: cada alteração já é aplicada aqui e gravada
  // em seguida, e as ações que mexem na lista (remover, adicionar) atualizam
  // as duas coisas. Um efeito copiando a prop por cima do estado desfaria, no
  // instante seguinte ao refresh do servidor, o clique que a pessoa acabou de
  // dar — e o compilador do React reclama dele com razão.

  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const gravar = useCallback(
    (skill: MinhaSkill) => {
      const anterior = pendentes.current.get(skill.skillId);
      if (anterior) clearTimeout(anterior);

      pendentes.current.set(
        skill.skillId,
        setTimeout(async () => {
          pendentes.current.delete(skill.skillId);
          const resultado = await chamarAcao(() =>
            salvarMinhaSkill({
              skill_id: skill.skillId,
              nivel: skill.nivel,
              quer_desenvolver: skill.querDesenvolver,
              anos_experiencia: skill.anosExperiencia,
              observacao: skill.observacao,
            }),
          );
          if (!resultado.ok) toast.error(resultado.error);
          else {
            setGravadoEm(
              new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            );
          }
        }, 700),
      );
    },
    [],
  );

  // Gravações pendentes não podem morrer com a tela: sair da página logo depois
  // de mexer no nível perderia a última alteração, que é sempre a que a pessoa
  // lembra de ter feito.
  useEffect(() => {
    const emAndamento = pendentes.current;
    return () => {
      for (const timer of emAndamento.values()) clearTimeout(timer);
    };
  }, []);

  function mudar(skillId: string, campos: Partial<MinhaSkill>) {
    setLista((atual) => {
      const nova = atual.map((s) => (s.skillId === skillId ? { ...s, ...campos } : s));
      const mexida = nova.find((s) => s.skillId === skillId);
      if (mexida) gravar(mexida);
      return nova;
    });
  }

  function remover(skill: MinhaSkill) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => removerMinhaSkill(skill.skillId));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setLista((atual) => atual.filter((s) => s.skillId !== skill.skillId));
        router.refresh();
      }
    });
  }

  const porCategoria = agrupar(lista);
  const totalQuerDesenvolver = lista.filter((s) => s.querDesenvolver).length;

  const jaTenho = new Set(lista.map((s) => s.skillId));
  const disponiveis = catalogo.filter((s) => !jaTenho.has(s.id));

  return (
    <div className="space-y-6">
      <Resumo
        lista={lista}
        querDesenvolver={totalQuerDesenvolver}
        gravadoEm={gravadoEm}
        aoAdicionar={() => setAdicionando(true)}
      />

      {lista.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Seu perfil ainda está vazio"
          description="Some as suas habilidades e diga o nível de cada uma. É o que faz a agência saber a quem recorrer — e é a base da sua conversa de desenvolvimento."
        />
      ) : (
        <div className="space-y-6">
          {[...porCategoria.entries()].map(([categoria, skills]) => (
            <section key={categoria} className="space-y-2">
              <h2 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
                {categoria}
              </h2>

              <ul className="bg-surface-card rounded-card divide-y border">
                {skills.map((skill) => (
                  <li key={skill.skillId} className="p-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="min-w-40 flex-1 text-sm font-medium">{skill.nome}</span>

                      <SeletorDeNivel
                        valor={skill.nivel}
                        rotulo={skill.nome}
                        aoEscolher={(nivel) => mudar(skill.skillId, { nivel })}
                      />

                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          step={0.5}
                          aria-label={`Anos de experiência em ${skill.nome}`}
                          value={skill.anosExperiencia ?? ""}
                          onChange={(evento) =>
                            mudar(skill.skillId, {
                              anosExperiencia:
                                evento.target.value === "" ? null : Number(evento.target.value),
                            })
                          }
                          className="h-8 w-16"
                          placeholder="—"
                        />
                        <span className="text-text-muted text-xs">anos</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-pressed={skill.querDesenvolver}
                        aria-label={
                          skill.querDesenvolver
                            ? `Deixar de querer desenvolver ${skill.nome}`
                            : `Quero desenvolver ${skill.nome}`
                        }
                        onClick={() =>
                          mudar(skill.skillId, { querDesenvolver: !skill.querDesenvolver })
                        }
                      >
                        <Star
                          aria-hidden
                          className={cn(
                            "size-4",
                            skill.querDesenvolver && "fill-current text-warning",
                          )}
                        />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        // Largura fixa porque "Observação" é mais larga que
                        // "Anotar": sem ela, a linha que já tem anotação puxa
                        // toda a fileira de controles alguns pixels para a
                        // esquerda, e a coluna de níveis deixa de ser coluna.
                        className="w-24 text-xs"
                        onClick={() =>
                          setExpandida(expandida === skill.skillId ? null : skill.skillId)
                        }
                      >
                        {skill.observacao ? "Observação" : "Anotar"}
                      </Button>

                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover ${skill.nome} do meu perfil`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        }
                        title={`Tirar ${skill.nome} do seu perfil?`}
                        description="Ela continua no catálogo da agência — sai só do seu perfil."
                        confirmLabel="Remover"
                        destructive
                        onConfirm={() => remover(skill)}
                      />
                    </div>

                    {expandida === skill.skillId ? (
                      <Textarea
                        autoFocus
                        rows={2}
                        className="mt-2"
                        placeholder="Onde você usou, o que quer aprofundar…"
                        value={skill.observacao ?? ""}
                        onChange={(evento) =>
                          mudar(skill.skillId, { observacao: evento.target.value })
                        }
                      />
                    ) : skill.observacao ? (
                      <p className="text-text-muted mt-1 text-xs">{skill.observacao}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <DialogoDeAdicionar
        aberto={adicionando}
        aoFechar={() => setAdicionando(false)}
        disponiveis={disponiveis}
        categorias={categorias}
        salvando={salvando}
        aoEscolher={(skill) => {
          const nova: MinhaSkill = {
            id: `novo-${skill.id}`,
            skillId: skill.id,
            nome: skill.nome,
            categoria: skill.categoria?.trim() || "Outras",
            descricao: skill.descricao,
            nivel: "iniciante",
            querDesenvolver: false,
            anosExperiencia: null,
            observacao: null,
          };
          setLista((atual) => [...atual, nova]);
          gravar(nova);
          setAdicionando(false);
          toast.success(`${skill.nome} entrou no seu perfil.`);
        }}
        aoSugerir={(nome, categoria) =>
          iniciar(async () => {
            const resultado = await chamarAcao(() => sugerirSkill(nome, categoria));
            if (!resultado.ok) toast.error(resultado.error);
            else {
              toast.success(resultado.mensagem);
              setAdicionando(false);
            }
          })
        }
      />
    </div>
  );
}

function agrupar(lista: MinhaSkill[]): Map<string, MinhaSkill[]> {
  const mapa = new Map<string, MinhaSkill[]>();
  for (const skill of lista) {
    const atual = mapa.get(skill.categoria) ?? [];
    atual.push(skill);
    mapa.set(skill.categoria, atual);
  }
  for (const skills of mapa.values()) {
    skills.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  return new Map([...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")));
}

function Resumo({
  lista,
  querDesenvolver,
  gravadoEm,
  aoAdicionar,
}: {
  lista: MinhaSkill[];
  querDesenvolver: number;
  gravadoEm: string | null;
  aoAdicionar: () => void;
}) {
  const porNivel = NIVEIS.map((nivel) => ({
    nivel,
    quantas: lista.filter((s) => s.nivel === nivel).length,
  }));
  const maior = Math.max(1, ...porNivel.map((n) => n.quantas));

  return (
    <section className="bg-surface-card rounded-card flex flex-wrap items-end gap-6 border p-4">
      <div>
        <p className="text-text-muted text-xs font-medium tracking-wide uppercase">Skills</p>
        <p className="text-text-primary text-2xl font-semibold tabular-nums">{lista.length}</p>
      </div>

      <div className="min-w-48 flex-1">
        <p className="text-text-muted mb-1.5 text-xs font-medium tracking-wide uppercase">
          Por nível
        </p>
        <ul className="flex items-end gap-2">
          {porNivel.map(({ nivel, quantas }) => (
            <li key={nivel} className="flex-1">
              <div
                className="bg-accent-strong rounded-sm"
                style={{
                  height: `${Math.max(3, (quantas / maior) * 28)}px`,
                  opacity: 0.3 + PESO_DO_NIVEL[nivel] * 0.175,
                }}
                role="img"
                aria-label={`${quantas} em ${ROTULOS_DE_NIVEL[nivel]}`}
              />
              <p className="text-text-muted mt-1 truncate text-[10px]">
                {ROTULOS_DE_NIVEL[nivel]}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
          Quero desenvolver
        </p>
        <p className="text-text-primary text-2xl font-semibold tabular-nums">{querDesenvolver}</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {gravadoEm ? (
          <span className="text-text-muted inline-flex items-center gap-1 text-xs">
            <Check aria-hidden className="size-3.5" />
            salvo às {gravadoEm}
          </span>
        ) : null}
        <Button size="sm" onClick={aoAdicionar}>
          <Plus aria-hidden />
          Adicionar skill
        </Button>
      </div>
    </section>
  );
}

function DialogoDeAdicionar({
  aberto,
  aoFechar,
  disponiveis,
  categorias,
  salvando,
  aoEscolher,
  aoSugerir,
}: {
  aberto: boolean;
  aoFechar: () => void;
  disponiveis: Skill[];
  categorias: string[];
  salvando: boolean;
  aoEscolher: (skill: Skill) => void;
  aoSugerir: (nome: string, categoria: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(categorias[0] ?? "");

  const termo = busca.trim().toLowerCase();
  const encontradas = termo
    ? disponiveis.filter((s) => s.nome.toLowerCase().includes(termo))
    : disponiveis;

  // Só oferece sugerir quando a busca não achou nada. Oferecer sempre convida
  // a criar "Photoshop " com espaço no fim ao lado do "Photoshop" que já
  // existe — e é assim que um catálogo compartilhado deixa de ser compartilhado.
  const podeSugerir = termo.length >= 2 && encontradas.length === 0;

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar skill</DialogTitle>
          <DialogDescription>
            O catálogo é compartilhado: escolher daqui é o que faz a agência conseguir responder
            “quem sabe fazer isso?”.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar no catálogo"
          aria-label="Buscar skill no catálogo"
        />

        {encontradas.length > 0 ? (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {encontradas.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(skill)}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                >
                  <span className="flex-1">{skill.nome}</span>
                  {skill.categoria ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {skill.categoria}
                    </Badge>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : podeSugerir ? (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <p className="text-text-secondary text-sm">
              Nada no catálogo com “{busca.trim()}”. Dá para sugerir: a gestão aprova e ela passa a
              valer para todo mundo.
            </p>
            <div className="space-y-2">
              <Label htmlFor="nova-categoria">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger id="nova-categoria" className="w-full">
                  <SelectValue placeholder="Escolher" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={NOVA}>Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={salvando}
              onClick={() => aoSugerir(busca, categoria === NOVA ? "" : categoria)}
            >
              {salvando ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />}
              Sugerir “{busca.trim()}”
            </Button>
          </div>
        ) : (
          <p className="text-text-muted py-6 text-center text-sm">
            {disponiveis.length === 0
              ? "Você já tem todas as skills do catálogo."
              : "Escreva pelo menos duas letras."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
