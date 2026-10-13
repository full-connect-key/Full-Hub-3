"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EditorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import { ROTULOS_DE_AULA, TIPOS_DE_AULA } from "@/lib/dominio/academy";
import { FUNCOES, rotuloDaFuncao } from "@/lib/dominio/equipe";
import type { ItemAberto } from "@/lib/dados/academy";
import type { AcademyAulaTipo } from "@/lib/supabase/database.types";

import {
  excluirAula,
  excluirItem,
  publicarItem,
  publicarVersao,
  salvarAula,
  salvarItem,
  salvarModulo,
  tirarObrigatoriedade,
  tornarObrigatorio,
} from "../acoes";

/**
 * O QUE A GESTÃO FAZ COM UM ITEM, no fim da página dele.
 *
 * **NO FIM E NÃO NO TOPO**, que é a decisão do detalhe da Task palavra por
 * palavra: *excluir não é propriedade, é ação sobre a demanda — vai para o fim
 * da página, que é onde se procura o que encerra alguma coisa*. Quem abre um
 * playbook quase sempre abre para LER; montar é o caso raro, e ele não pode
 * dividir a primeira dobra com o conteúdo.
 *
 * **E ELE SÓ É DESENHADO PARA A GESTÃO.** Não porque esconder seja a proteção
 * — quem recusa é a policy de escrita de cada tabela —, mas porque oferecer a
 * quem vai ser recusado é ensinar a clicar e levar erro.
 */
export function MontarOItem({ aberto }: { aberto: ItemAberto }) {
  const { item, playbook, curso } = aberto;

  return (
    <section className="space-y-4 border-t pt-6">
      <h3 className="text-text-primary text-sm font-semibold">Montar este item</h3>

      <Propriedades item={item} />
      {playbook ? <NovaVersao itemId={item.id} proxima={(playbook.versaoCorrente?.numero_versao ?? 0) + 1} /> : null}
      {curso ? <MontarCurso itemId={item.id} curso={curso} /> : null}
      <Obrigatoriedade itemId={item.id} />
      <Publicacao item={item} />
    </section>
  );
}

function Propriedades({ item }: { item: ItemAberto["item"] }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [titulo, setTitulo] = useState(item.titulo);
  const [resumo, setResumo] = useState(item.resumo ?? "");
  const [categoria, setCategoria] = useState(item.categoria ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));

  function salvar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarItem(item.id, {
          tipo: item.tipo,
          titulo,
          resumo: resumo || null,
          categoria: categoria || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">Título e organização</h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="m-titulo">Título</Label>
          <Input id="m-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="m-resumo">Resumo</Label>
          <Textarea
            id="m-resumo"
            rows={2}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-categoria">Categoria</Label>
          <Input
            id="m-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-tags">Etiquetas</Label>
          <Input id="m-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
      </div>

      <Button size="sm" onClick={salvar} disabled={enviando}>
        Salvar
      </Button>

      {/* O ENDEREÇO NÃO MUDA COM O TÍTULO, e a tela diz: um link colado numa
          conversa continua abrindo depois de alguém renomear o playbook. */}
      <p className="text-text-muted text-xs">
        O endereço continua <code>/painel/academy/{item.slug}</code> mesmo trocando o
        título — é ele que sobrevive num link que alguém já colou.
      </p>
    </div>
  );
}

/**
 * A publicação de uma versão nova do playbook.
 *
 * **A CAIXA DE RELEITURA É A DECISÃO QUE MAIS PESA DESTA TELA**, e por isso o
 * padrão é desmarcada: marcar devolve a pendência a todo mundo que já leu, e
 * um padrão ligado faria toda vírgula trocada virar um aviso — na terceira vez
 * ninguém mais leria nenhum.
 *
 * **AS NOTAS DO QUE MUDOU VÊM ANTES DO BOTÃO**, e não depois: escritas depois,
 * elas descreveriam uma versão já gravada. É a decisão da justificativa da
 * versão de campanha.
 */
function NovaVersao({ itemId, proxima }: { itemId: string; proxima: number }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [conteudo, setConteudo] = useState<{ json: JSONContent; texto: string } | null>(null);
  const [notas, setNotas] = useState("");
  const [releitura, setReleitura] = useState(false);

  function publicar() {
    if (!conteudo) {
      toast.error("Escreva o conteúdo antes de publicar.");
      return;
    }
    começar(async () => {
      const r = await chamarAcao(() =>
        publicarVersao({
          item_id: itemId,
          conteudo_rico: conteudo.json,
          conteudo_texto: conteudo.texto,
          notas_mudanca: notas || null,
          exige_releitura: releitura,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setConteudo(null);
        setNotas("");
        setReleitura(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">
        Publicar a versão {proxima}
      </h4>

      <div className="rounded-lg border">
        <EditorRico
          conteudo={null}
          onChange={setConteudo}
          placeholder="O jeito Full de fazer isto…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="v-notas">O que mudou</Label>
        <Textarea
          id="v-notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Quem já leu a versão anterior lê isto antes de reler."
        />
      </div>

      <label className="flex items-start gap-2.5">
        <Switch
          checked={releitura}
          onCheckedChange={setReleitura}
          aria-label="Exigir que quem já leu leia de novo"
        />
        <span className="text-sm">
          <span className="text-text-primary font-medium">Exigir releitura</span>
          <span className="text-text-muted block text-xs">
            Devolve a pendência a todo mundo que já tinha confirmado. Deixe desmarcado
            para correção de texto — senão o aviso vira ruído e ninguém mais o lê.
          </span>
        </span>
      </label>

      <Button size="sm" onClick={publicar} disabled={enviando}>
        Publicar versão {proxima}
      </Button>
    </div>
  );
}

function MontarCurso({
  itemId,
  curso,
}: {
  itemId: string;
  curso: NonNullable<ItemAberto["curso"]>;
}) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [nomeDoModulo, setNomeDoModulo] = useState("");

  function criarModulo() {
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarModulo(null, {
          item_id: itemId,
          titulo: nomeDoModulo,
          ordem: curso.modulos.length * 10,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setNomeDoModulo("");
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-4 border p-4">
      <h4 className="text-text-primary text-sm font-medium">Módulos e aulas</h4>

      {curso.modulos.map((modulo) => (
        <NovaAula key={modulo.id} moduloId={modulo.id} titulo={modulo.titulo} aulas={modulo.aulas} />
      ))}

      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="min-w-50 flex-1 space-y-1.5">
          <Label htmlFor="novo-modulo">Novo módulo</Label>
          <Input
            id="novo-modulo"
            value={nomeDoModulo}
            onChange={(e) => setNomeDoModulo(e.target.value)}
            placeholder="O começo"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={criarModulo}
          disabled={enviando || nomeDoModulo.trim().length < 2}
        >
          <Plus aria-hidden className="size-4" />
          Acrescentar
        </Button>
      </div>
    </div>
  );
}

function NovaAula({
  moduloId,
  titulo,
  aulas,
}: {
  moduloId: string;
  titulo: string;
  aulas: NonNullable<ItemAberto["curso"]>["modulos"][number]["aulas"];
}) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<AcademyAulaTipo>("video");
  const [url, setUrl] = useState("");

  function criar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarAula(null, {
          modulo_id: moduloId,
          titulo: nome,
          tipo,
          url: url || null,
          ordem: aulas.length * 10,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setNome("");
        setUrl("");
        router.refresh();
      }
    });
  }

  function apagar(id: string) {
    começar(async () => {
      const r = await chamarAcao(() => excluirAula(id));
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-text-primary text-sm font-medium">{titulo}</p>

      <ul className="divide-border divide-y text-sm">
        {aulas.map((aula) => (
          <li key={aula.id} className="flex items-center gap-2 py-1.5">
            <span className="text-text-secondary min-w-0 flex-1">{aula.titulo}</span>
            <span className="text-text-muted text-[11px]">{ROTULOS_DE_AULA[aula.tipo]}</span>
            <button
              type="button"
              onClick={() => apagar(aula.id)}
              disabled={enviando}
              aria-label={`Excluir a aula ${aula.titulo}`}
              className="text-text-muted hover:text-danger"
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor={`aula-${moduloId}`}>Nova aula</Label>
          <Input
            id={`aula-${moduloId}`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Por que medir antes de anunciar"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tipo-${moduloId}`}>Formato</Label>
          <select
            id={`tipo-${moduloId}`}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as AcademyAulaTipo)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            {TIPOS_DE_AULA.map((t) => (
              <option key={t} value={t}>
                {ROTULOS_DE_AULA[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor={`url-${moduloId}`}>Endereço</Label>
          <Input
            id={`url-${moduloId}`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <Button size="sm" variant="outline" onClick={criar} disabled={enviando || nome.trim().length < 2}>
          <Plus aria-hidden className="size-4" />
          Acrescentar
        </Button>
      </div>
    </div>
  );
}

/**
 * A obrigatoriedade.
 *
 * **FUNÇÃO VAZIA QUER DIZER "PARA A AGÊNCIA INTEIRA"**, e é o caso de
 * "Primeiros 30 dias na Full". **Prazo vazio é "sem prazo"**: o item é
 * obrigatório e não vence — sem o vazio, todo obrigatório pediria um número
 * inventado, e prazo inventado é prazo que vence sem ninguém entender por quê.
 */
function Obrigatoriedade({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [funcao, setFuncao] = useState("");
  const [dias, setDias] = useState("");

  function tornar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        tornarObrigatorio({
          item_id: itemId,
          funcao: funcao || null,
          prazo_dias_apos_admissao: dias ? Number(dias) : null,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">Tornar obrigatório</h4>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="o-funcao">Para quem</Label>
          <select
            id="o-funcao"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">A agência inteira</option>
            {FUNCOES.map((f) => (
              <option key={f} value={f}>
                {rotuloDaFuncao(f)}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40 space-y-1.5">
          <Label htmlFor="o-dias">Prazo (dias de casa)</Label>
          <Input
            id="o-dias"
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="sem prazo"
          />
        </div>

        <Button size="sm" variant="outline" onClick={tornar} disabled={enviando}>
          Marcar
        </Button>
      </div>

      <p className="text-text-muted text-xs">
        O prazo conta a partir da data de admissão da pessoa — quem entrou ontem tem o
        prazo inteiro, e quem está há dois anos já está fora dele se nunca leu. Em
        branco, o item é obrigatório e não vence.
      </p>

      <RegraAtual itemId={itemId} />
    </div>
  );
}

/**
 * Tirar a obrigatoriedade.
 *
 * Esta tela não LISTA as regras existentes, e é dito em vez de escondido: a
 * leitura que alimenta esta página traz o item e o conteúdo dele, não as
 * regras de obrigatoriedade — e trazer uma consulta a mais em toda abertura de
 * playbook, para uma seção que quase ninguém abre, é a conta que o diálogo do
 * board já recusou uma vez. Quem quer ver todas as regras vê o efeito delas na
 * aba Acompanhamento, que é onde a pergunta é feita.
 */
function RegraAtual({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [id, setId] = useState("");

  return (
    <details className="text-xs">
      <summary className="text-text-secondary cursor-pointer">
        Tirar uma regra de obrigatoriedade
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-50 flex-1 space-y-1.5">
          <Label htmlFor="o-id">Identificador da regra</Label>
          <Input
            id="o-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="o uuid que aparece no acompanhamento"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={enviando || id.length < 10}
          onClick={() =>
            começar(async () => {
              const r = await chamarAcao(() => tirarObrigatoriedade(id));
              if (!r.ok) toast.error(r.error);
              else {
                toast.success(r.mensagem);
                setId("");
                router.refresh();
              }
            })
          }
        >
          Tirar
        </Button>
      </div>
      <p className="text-text-muted mt-1">
        Este item é do acervo {itemId.slice(0, 8)}…
      </p>
    </details>
  );
}

function Publicacao({ item }: { item: ItemAberto["item"] }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant={item.publicado ? "outline" : "default"}
        disabled={enviando}
        onClick={() =>
          começar(async () => {
            const r = await chamarAcao(() => publicarItem(item.id, !item.publicado));
            if (!r.ok) toast.error(r.error);
            else {
              toast.success(r.mensagem);
              router.refresh();
            }
          })
        }
      >
        {item.publicado ? "Voltar a rascunho" : "Publicar no acervo"}
      </Button>

      <ConfirmDialog
        title={`Excluir "${item.titulo}"?`}
        description="O conteúdo, as versões e o progresso de todo mundo saem junto. Não tem volta."
        confirmLabel="Excluir item"
        destructive
        onConfirm={async () => {
          const r = await chamarAcao(() => excluirItem(item.id));
          if (!r.ok) toast.error(r.error);
          else {
            toast.success(r.mensagem);
            router.push("/painel/academy");
          }
        }}
        trigger={
          <Button size="sm" variant="ghost" className="text-danger">
            Excluir
          </Button>
        }
      />
    </div>
  );
}
