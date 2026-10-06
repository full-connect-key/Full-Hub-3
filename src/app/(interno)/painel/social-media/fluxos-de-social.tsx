"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { FUNCOES, ROTULOS_DE_FUNCAO } from "@/lib/dominio/equipe";
import {
  CAMPOS_DA_ETAPA,
  EXPLICACAO_DO_PAPEL,
  MOLDE_DO_FLUXO,
  PAPEIS_DO_FLUXO,
  ROTULOS_DE_PAPEL,
  oQueFaltaNoFluxo,
  type EtapaDoFluxo,
  type FluxoDeSocial,
} from "@/lib/dominio/social-flows";
import type { SocialFlowPapel, TeamFuncao } from "@/lib/supabase/database.types";

import { mudarEstadoDoFluxo, salvarFluxoDeSocial } from "./acoes-de-fluxos";

const SEM_CAMPO = "__sem__";

/** Um elo em edição. O `id` é de tela: a lista reordena, e `key` por índice
 *  faria o React reaproveitar o campo errado — quem digitou na segunda linha
 *  veria o texto pular para a terceira ao mover a primeira. */
type EloEmEdicao = Omit<EtapaDoFluxo, "ordem"> & { id: number };

/**
 * A aba FLUXOS de Social Media (migration 0087).
 *
 * Decisão do usuário: *"algumas contas possuem um fluxo de aprovação
 * diferentes (…) Preciso poder montar fluxos de Social diferentes, para serem
 * aplicados em determinados socials, de meses de determinadas contas"*.
 *
 * ---------------------------------------------------------------------------
 * **ELA MORA NO SOCIAL MEDIA, e não em Gestão de Tasks ao lado dos
 * workflows.** A proximidade é tentadora — um workflow de task e um fluxo de
 * social são os dois uma cadeia de etapas que uma demanda percorre —, e desde
 * a 0088 ela é mais tentadora ainda, porque os dois materializam a MESMA
 * tabela: o fluxo virou uma etapa de `subtasks` por fase do mês, com
 * responsável, período e cronômetro, como um workflow faz numa demanda.
 *
 * **O que os separa não é a tabela, é a UNIDADE DE TRABALHO.** O workflow
 * materializa uma etapa por trabalho; o fluxo materializa uma etapa por FASE
 * de um mês que tem dezoito peças, e cada fase guarda uma caixinha por peça
 * — `post_etapa_progresso`, que nenhum workflow tem. O `prazo_offset_dias` do
 * workflow (0008) é a outra metade: ele existe porque uma demanda começa em
 * qualquer data, e o mês de social tem calendário próprio, que foi o que a
 * 0083 decidiu. Quem monta um fluxo de social está no Social Media, abrindo o
 * mês, e é ali que ele faz falta.
 *
 * **E SÓ A GESTÃO VÊ A ABA**, pela razão do PASSO 8 da 0087: abrir o mês é
 * trabalho do dia e é do Atendimento (0046); desenhar a corrente que toda
 * conta vai percorrer é configuração do produto. Quem não é gestão não recebe
 * a seção — e quem digitar `?aba=fluxos` leva a lista de leitura, porque
 * `social_flow_steps_select` é `is_staff()`: ver a corrente é do trabalho dela.
 * ---------------------------------------------------------------------------
 */
export function FluxosDeSocial({
  fluxos,
  podeEditar,
}: {
  fluxos: FluxoDeSocial[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | "novo" | null>(null);

  if (fluxos.length === 0 && !podeEditar) {
    return (
      <EmptyState
        title="Nenhum fluxo montado ainda"
        description="O fluxo é a corrente de etapas que os posts de um mês percorrem. Quem monta é o desenvolvedor ou o sócio."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* O QUE UM FLUXO É, ANTES DA LISTA. Esta é a primeira tela do produto em
          que a palavra "fluxo" significa uma coisa configurável, e quem abre
          precisa saber o que vai mexer antes de clicar em Novo — é a decisão da
          página "sobre o feedback", que diz o que a coisa é antes de oferecer
          o que fazer com ela. */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">O que é um fluxo de social</p>
        <p className="text-text-secondary mt-1 text-xs">
          A corrente de etapas que todo post de um mês percorre, na ordem: o
          trabalho que acontece antes de enviar, a entrega ao cliente, e o que
          vem depois da decisão dele. Cada conta combina o fluxo dela na ficha
          do cliente, e quem abre o mês pode escolher outro naquele mês.
        </p>
      </div>

      {podeEditar && editando !== "novo" ? (
        <div className="flex justify-end">
          <Button onClick={() => setEditando("novo")}>
            <Plus aria-hidden />
            Novo fluxo
          </Button>
        </div>
      ) : null}

      {editando === "novo" ? (
        <EditorDoFluxo fluxo={null} aoFechar={() => setEditando(null)} />
      ) : null}

      <ul className="space-y-3">
        {fluxos.map((fluxo) =>
          editando === fluxo.id ? (
            <li key={fluxo.id}>
              <EditorDoFluxo fluxo={fluxo} aoFechar={() => setEditando(null)} />
            </li>
          ) : (
            <li key={fluxo.id}>
              <CartaoDoFluxo
                fluxo={fluxo}
                podeEditar={podeEditar}
                aoEditar={() => setEditando(fluxo.id)}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function CartaoDoFluxo({
  fluxo,
  podeEditar,
  aoEditar,
}: {
  fluxo: FluxoDeSocial;
  podeEditar: boolean;
  aoEditar: () => void;
}) {
  const router = useRouter();
  const [salvando, salvar] = useTransition();

  function trocarEstado() {
    salvar(async () => {
      const r = await chamarEMostrar(() =>
        mudarEstadoDoFluxo({ flow_id: fluxo.id, ativo: !fluxo.ativo }),
      );
      if (r?.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {fluxo.nome}
            {/* "ATIVO" NÃO VIRA SELO, e a ausência é a resposta: quase todo
                fluxo está ativo, e um selo verde em oito linhas de nove não
                informa nada. É a decisão da matriz do Full Days, que pinta só a
                exceção. */}
            {!fluxo.ativo ? <Badge variant="outline">Desativado</Badge> : null}
          </p>
          {fluxo.descricao ? (
            <p className="text-text-secondary mt-1 text-xs">{fluxo.descricao}</p>
          ) : null}
        </div>

        {podeEditar ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={aoEditar} disabled={salvando}>
              <Pencil aria-hidden />
              Editar
            </Button>
            {/* NÃO HÁ APAGAR, e a ausência é a regra: um fluxo que não serve
                mais se desativa. Apagar levaria o nome que os meses já abertos
                apontam, e ninguém mais saberia com que corrente aquele mês
                nasceu. */}
            <Button variant="outline" size="sm" onClick={trocarEstado} disabled={salvando}>
              {salvando ? <Loader2 aria-hidden className="animate-spin" /> : <Power aria-hidden />}
              {fluxo.ativo ? "Desativar" : "Reativar"}
            </Button>
          </div>
        ) : null}
      </div>

      <Corrente etapas={fluxo.etapas} />
    </div>
  );
}

/**
 * A corrente desenhada, com os portões em âmbar.
 *
 * **O MESMO DESENHO APARECE EM TRÊS TELAS** — aqui, no diálogo que abre o mês e
 * na ficha do cliente — e as três passam por este componente de propósito: a
 * frase que importa é "nos elos em âmbar o trabalho para e espera alguém de
 * fora da agência", e três versões dela divergiriam na primeira mudança de
 * texto. Âmbar e nunca `--danger`: material esperando decisão é o estado normal
 * do mês, não um erro — é a regra do alerta de 7 dias das campanhas.
 */
export function Corrente({ etapas }: { etapas: { nome: string; aprovacao_cliente: boolean; papel: SocialFlowPapel }[] }) {
  if (etapas.length === 0) {
    return (
      <p className="text-warning bg-warning-soft mt-3 rounded-lg px-3 py-2 text-xs">
        Este fluxo não tem etapa nenhuma, então não abre mês nenhum. Monte a
        corrente dele.
      </p>
    );
  }

  return (
    <>
      <p className="mt-3 text-xs">
        {etapas.map((e, i) => (
          <span key={e.nome}>
            {i > 0 ? <span className="text-text-muted"> → </span> : null}
            <span
              className={
                e.aprovacao_cliente
                  ? "text-warning font-medium"
                  : e.papel === "entrega"
                    ? "text-text-primary font-medium"
                    : "text-text-secondary"
              }
            >
              {e.nome}
            </span>
          </span>
        ))}
      </p>
      {etapas.some((e) => e.aprovacao_cliente) ? (
        <p className="text-warning mt-2 inline-flex items-start gap-1 text-xs">
          <UserCheck aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span>
            Nos elos em âmbar a corrente para e espera o cliente aprovar. O
            texto de cada um passa a aparecer no portal dele.
          </span>
        </p>
      ) : (
        <p className="text-text-muted mt-2 text-xs">
          Só a entrega do material pronto passa pelo cliente.
        </p>
      )}
    </>
  );
}

let proximoId = 1;

function paraEdicao(fluxo: FluxoDeSocial | null): EloEmEdicao[] {
  const base = fluxo ? fluxo.etapas : MOLDE_DO_FLUXO;
  return base.map((e) => ({
    id: proximoId++,
    nome: e.nome,
    funcao: e.funcao,
    papel: e.papel,
    aprovacao_cliente: e.aprovacao_cliente,
    campo: e.campo,
    comeca_dias_antes: e.comeca_dias_antes,
    termina_dias_antes: e.termina_dias_antes,
  }));
}

/**
 * O editor de um fluxo.
 *
 * **ELE ABRE COM O MOLDE DA CASA quando o fluxo é novo**, e não em branco: um
 * editor vazio pede seis decisões antes de qualquer coisa aparecer, e a
 * resposta certa para quase toda conta é a corrente de sempre com um portão a
 * mais. É "modelo é ponto de partida, não contrato" (0033).
 *
 * **E O BOTÃO SALVAR DESLIGA COM A RAZÃO ESCRITA**, em vez de sumir: um botão
 * que some ensina que não existe; um desligado que diz *"falta a etapa de
 * entrega ao cliente"* ensina a regra — e a regra é do banco
 * (`conferir_fluxo_de_social`). É a decisão do "Enviar ao cliente" do Social
 * Media.
 */
function EditorDoFluxo({
  fluxo,
  aoFechar,
}: {
  fluxo: FluxoDeSocial | null;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [salvando, salvar] = useTransition();

  const [nome, setNome] = useState(fluxo?.nome ?? "");
  const [descricao, setDescricao] = useState(fluxo?.descricao ?? "");
  const [elos, setElos] = useState<EloEmEdicao[]>(() => paraEdicao(fluxo));

  const falta = oQueFaltaNoFluxo(elos);
  const podeSalvar = nome.trim().length >= 2 && falta === null;

  function mexer(id: number, troca: Partial<EloEmEdicao>) {
    setElos((atual) => atual.map((e) => (e.id === id ? { ...e, ...troca } : e)));
  }

  function mover(indice: number, direcao: -1 | 1) {
    setElos((atual) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  function enviar() {
    salvar(async () => {
      const r = await chamarEMostrar(() =>
        salvarFluxoDeSocial({
          flow_id: fluxo?.id ?? null,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          ativo: fluxo?.ativo ?? true,
          // A ORDEM VIAJA NA LISTA, e o número sai da posição: quem numera é
          // `salvar_fluxo_de_social`, com folga de dez (0045). Mandar a ordem
          // daqui seria a tela decidindo uma coisa que o banco já decide — e no
          // dia em que a folga mudasse, mudaria num lugar só.
          etapas: elos.map((e) => ({
            nome: e.nome.trim(),
            funcao: e.funcao,
            papel: e.papel,
            campo: e.campo,
            aprovacao_cliente: e.aprovacao_cliente,
            comeca_dias_antes: e.comeca_dias_antes,
            termina_dias_antes: e.termina_dias_antes,
          })),
        }),
      );
      if (r?.ok) {
        aoFechar();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fluxo-nome">Nome do fluxo</Label>
          <Input
            id="fluxo-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Três avaliações do cliente"
            disabled={salvando}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fluxo-descricao">Para quê (opcional)</Label>
          <Input
            id="fluxo-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="A conta valida a pauta e o texto antes da arte."
            disabled={salvando}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">A corrente, na ordem</p>
        <ul className="space-y-2">
          {elos.map((elo, i) => (
            <li key={elo.id} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`elo-nome-${elo.id}`} className="text-xs">
                      Nome
                    </Label>
                    <Input
                      id={`elo-nome-${elo.id}`}
                      value={elo.nome}
                      onChange={(e) => mexer(elo.id, { nome: e.target.value })}
                      disabled={salvando}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`elo-funcao-${elo.id}`} className="text-xs">
                      Quem faz
                    </Label>
                    <Select
                      value={elo.funcao}
                      onValueChange={(v) => mexer(elo.id, { funcao: v as TeamFuncao })}
                      disabled={salvando}
                    >
                      <SelectTrigger
                        id={`elo-funcao-${elo.id}`}
                        aria-label="Função desta etapa"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNCOES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {ROTULOS_DE_FUNCAO[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`elo-papel-${elo.id}`} className="text-xs">
                      O que é
                    </Label>
                    <Select
                      value={elo.papel}
                      onValueChange={(v) =>
                        mexer(elo.id, {
                          papel: v as SocialFlowPapel,
                          // O PORTÃO CAI JUNTO quando o papel deixa de ser
                          // produção, e não é zelo: o `check` do banco recusa a
                          // marca fora dela, e a recusa chegaria depois de a
                          // pessoa ter preenchido o resto. Desligar aqui é a
                          // tela escrevendo a mesma regra antes.
                          ...(v === "producao" ? {} : { aprovacao_cliente: false }),
                        })
                      }
                      disabled={salvando}
                    >
                      <SelectTrigger
                        id={`elo-papel-${elo.id}`}
                        aria-label="Papel desta etapa"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPEIS_DO_FLUXO.map((p) => (
                          <SelectItem key={p} value={p}>
                            {ROTULOS_DE_PAPEL[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* OS TRÊS BOTÕES EM LINHA, e não empilhados: a imagem do
                    protótipo mostrou uma coluna de três ícones ao lado de uma
                    linha de três campos, com um vão de duas alturas embaixo
                    deles. Em linha eles ficam na altura dos campos. */}
                <div className="flex items-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover ${elo.nome || "a etapa"} para cima`}
                    onClick={() => mover(i, -1)}
                    disabled={salvando || i === 0}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover ${elo.nome || "a etapa"} para baixo`}
                    onClick={() => mover(i, 1)}
                    disabled={salvando || i === elos.length - 1}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${elo.nome || "a etapa"}`}
                    onClick={() => setElos((atual) => atual.filter((e) => e.id !== elo.id))}
                    disabled={salvando}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>

              <p className="text-text-muted text-xs">{EXPLICACAO_DO_PAPEL[elo.papel]}</p>

              {/* O PORTÃO DO CLIENTE SÓ APARECE EM ELO DE PRODUÇÃO, e o campo
                  do card também. Desenhá-los desligados nos outros dois seria
                  oferecer uma escolha que o banco recusa — e a entrega já É o
                  portão, então um interruptor nela leria como "dá para
                  desligar o envio ao cliente", que não dá. */}
              {elo.papel === "producao" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-2">
                    {/* `flex-col items-start` NO PRÓPRIO LABEL: o do shadcn é
                        `flex items-center gap-2`, então um `block` no filho não
                        o tira do fluxo flex — a frase saía NA MESMA LINHA do
                        rótulo, e foi a imagem do protótipo que mostrou. */}
                    <Label
                      htmlFor={`elo-portao-${elo.id}`}
                      className="cursor-pointer flex-col items-start gap-0.5 text-xs"
                    >
                      O cliente aprova esta etapa
                      <span className="text-text-muted font-normal">
                        {elo.aprovacao_cliente
                          ? "a corrente para aqui e espera ele"
                          : "segue direto para a etapa seguinte"}
                      </span>
                    </Label>
                    <Switch
                      id={`elo-portao-${elo.id}`}
                      checked={elo.aprovacao_cliente}
                      disabled={salvando}
                      onCheckedChange={(marcado) =>
                        mexer(elo.id, { aprovacao_cliente: marcado })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`elo-campo-${elo.id}`} className="text-xs">
                      O que ela preenche no post
                    </Label>
                    <Select
                      value={elo.campo ?? SEM_CAMPO}
                      onValueChange={(v) =>
                        mexer(elo.id, { campo: v === SEM_CAMPO ? null : v })
                      }
                      disabled={salvando}
                    >
                      <SelectTrigger
                        id={`elo-campo-${elo.id}`}
                        aria-label="Campo do post que esta etapa preenche"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_CAMPO}>Nada — a arte, ou outra coisa</SelectItem>
                        {CAMPOS_DA_ETAPA.map((c) => (
                          <SelectItem key={c.valor} value={c.valor}>
                            {c.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {/* OS DOIS DIAS SÃO SUGESTÃO, contados do dia 1 do mês (0083 e
                  0084) — quem abre o mês ajusta cada um. Eles vivem aqui e não
                  na tela de abrir o mês porque a corrente é editável: uma lista
                  fixa em TypeScript não sabe sugerir nada para uma etapa que
                  alguém acrescentou, e dez campos de data vazios fariam quem
                  abre o mês inventar dez datas na hora. */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`elo-comeca-${elo.id}`} className="text-xs">
                    Começa quantos dias antes do mês
                  </Label>
                  <Input
                    id={`elo-comeca-${elo.id}`}
                    type="number"
                    inputMode="numeric"
                    value={elo.comeca_dias_antes ?? ""}
                    onChange={(e) =>
                      mexer(elo.id, {
                        comeca_dias_antes: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    disabled={salvando}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`elo-termina-${elo.id}`} className="text-xs">
                    Termina quantos dias antes do mês
                  </Label>
                  <Input
                    id={`elo-termina-${elo.id}`}
                    type="number"
                    inputMode="numeric"
                    value={elo.termina_dias_antes ?? ""}
                    onChange={(e) =>
                      mexer(elo.id, {
                        termina_dias_antes: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    disabled={salvando}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setElos((atual) => [
              ...atual,
              {
                id: proximoId++,
                nome: "",
                funcao: "Design" as TeamFuncao,
                papel: "producao" as SocialFlowPapel,
                aprovacao_cliente: false,
                campo: null,
                comeca_dias_antes: null,
                termina_dias_antes: null,
              },
            ])
          }
          disabled={salvando}
        >
          <Plus aria-hidden />
          Acrescentar etapa
        </Button>
      </div>

      {/* A PRÉVIA DA CORRENTE, embaixo do editor e não em cima: ela é o
          resultado do que a pessoa acabou de montar, e é o que ela confere
          antes de salvar — como as cinco próximas ocorrências da recorrência. */}
      <div className="rounded-lg border p-3">
        <p className="text-text-secondary text-xs font-medium">Como ela vai ficar</p>
        <Corrente etapas={elos} />
      </div>

      {falta ? (
        <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-xs">{falta}</p>
      ) : null}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={aoFechar} disabled={salvando}>
          <X aria-hidden />
          Cancelar
        </Button>
        <Button onClick={enviar} disabled={!podeSalvar || salvando}>
          {salvando ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          {fluxo ? "Salvar o fluxo" : "Criar o fluxo"}
        </Button>
      </div>
    </div>
  );
}
