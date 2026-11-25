"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { chamarAcao, chamarEMostrar } from "@/lib/acoes/cliente";
import type { Resultado } from "@/lib/acoes/resultado";
import {
  COR_DO_NIVEL_DO_ESCOPO,
  competenciasParaLancar,
  nivelDoEscopo,
  percentualUsado,
  quantoSobra,
  rotuloDaCompetencia,
  type LinhaDoEscopo,
} from "@/lib/dominio/escopo";
import { cn } from "@/lib/utils";

import {
  alternarItemDoEscopo,
  buscarEscopoDoMes,
  criarItemDoEscopo,
  editarItemDoEscopo,
  lancarConsumoDoEscopo,
} from "./acoes-do-escopo";

/**
 * O escopo do contrato mensal de uma conta (migration 0149).
 *
 * Decisão do usuário: *"as quantidades devem ser preenchidas pela agência na
 * parte interna, onde visualiza a conta cliente a cliente"*.
 *
 * ---------------------------------------------------------------------------
 * **É UMA ABA PRÓPRIA**, pela razão escrita em `vertentes.tsx`: "Configurações
 * do fluxo" responde quem aprova o quê nesta conta e com que prazo, e o escopo
 * é o que foi CONTRATADO — dentro da outra ele ficaria enterrado sob um título
 * que fala de aprovação.
 *
 * ---------------------------------------------------------------------------
 * **SÃO DUAS COISAS NA MESMA TELA, e a ordem é a da digitação:** o contrato,
 * que se digita UMA VEZ, e o consumo do mês, que se digita todo mês. Em duas
 * abas, lançar o consumo exigiria abrir a outra para lembrar o que foi
 * contratado — e é a comparação entre os dois números que a linha mostra.
 *
 * ---------------------------------------------------------------------------
 * **O MÊS É LOCAL E A LEITURA É UMA ACTION**, e não `?mes=` na URL: as abas
 * da ficha são `defaultValue` e não estado na URL, então navegar devolveria a
 * pessoa para a aba Dados — o mesmo argumento do seletor de visão, que usa
 * `router.replace` por ser a tela inteira. É a forma de
 * `FaixaDeDisponibilidade`, que também lê por action para trocar de mês sem
 * recarregar a página.
 *
 * ---------------------------------------------------------------------------
 * **NÃO HÁ APAGAR nem REORDENAR**, e as duas ausências são decisão. Apagar um
 * item levaria o consumo de todo mês que aponta para ele, e a tabela nasce sem
 * policy de DELETE: o caminho é desativar. A ordem é a coluna `ordem` com o
 * item novo entrando no fim, que é a decisão da Biblioteca (0139) — quem
 * quiser outra ordem renomeia, e o par de setas é decisão própria.
 */
export function EscopoDoContrato({
  clienteId,
  nomeDaEmpresa,
  competencia,
  linhas: linhasIniciais,
}: {
  clienteId: string;
  nomeDaEmpresa: string;
  /** O mês que o servidor já leu — o corrente. */
  competencia: string;
  linhas: LinhaDoEscopo[];
}) {
  const [salvando, iniciar] = useTransition();
  const [mes, setMes] = useState(competencia);
  /**
   * A ÚLTIMA LEITURA QUE VOLTOU, com o mês dela.
   *
   * **O que a tela mostra é DERIVADO disto, nunca copiado para um estado por
   * efeito:** `setState` no corpo de um `useEffect` dispara renderização em
   * cascata, e o `react-hooks/set-state-in-effect` do projeto reprova — é a
   * linha que a faixa de disponibilidade e o editor de post já pagaram, uma
   * derivando e o outro remontando por `key`.
   */
  const [buscado, setBuscado] = useState<{
    mes: string;
    linhas: LinhaDoEscopo[];
  } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const meses = competenciasParaLancar();
  // A RESPOSTA DO SERVIDOR GANHA DEPOIS DA PRIMEIRA LEITURA, e é por isso que
  // toda escrita relê: sem a releitura, salvar um consumo deixaria a tela
  // dizendo "Salvo." com o número de antes na frente.
  const linhas = buscado ? buscado.linhas : linhasIniciais;
  const ativos = linhas.filter((l) => l.item.ativo).length;

  // **AS LINHAS DE ANTES FICAM NA TELA ENQUANTO A LEITURA CORRE**, dimmed, e
  // os campos ficam inertes junto: elas são do mês que acabou de sair do
  // seletor, e deixá-los editáveis permitiria salvar o número de um mês na
  // competência do outro. Esvaziar a lista seria pior — ela é por ITEM, e o
  // vazio se lê como "esta conta não tem contrato".
  const ocupado = salvando || lendo;

  async function recarregar(destino: string) {
    setLendo(true);
    const r = await chamarAcao(() => buscarEscopoDoMes(clienteId, destino));
    setLendo(false);
    if (r?.ok && r.dados) setBuscado({ mes: destino, linhas: r.dados });
  }

  function acao(fn: () => Promise<Resultado>) {
    iniciar(async () => {
      const r = await chamarEMostrar(fn);
      if (r?.ok) await recarregar(mes);
    });
  }

  function trocarMes(destino: string) {
    setMes(destino);
    void recarregar(destino);
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-5 border p-5">
      <div>
        <h2 className="text-sm font-semibold">Escopo do contrato</h2>
        {/* A FRASE DIZ O QUE ISTO FAZ FORA DESTA TELA, porque é fora dela que
            decide algo: quem digita aqui precisa saber que o cliente lê o
            número no portal dele. */}
        <p className="text-text-muted mt-1 text-xs">
          O que {nomeDaEmpresa} contratou por mês, e quanto já usou. O cliente
          vê esta lista na tela inicial do portal dele — com a porcentagem do
          mês corrente e quanto ainda tem em aberto.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2 border-t pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const dados = new FormData(form);
          acao(async () => {
            const r = await criarItemDoEscopo({
              client_id: clienteId,
              descricao: dados.get("descricao"),
              quantidade: dados.get("quantidade"),
              unidade: dados.get("unidade"),
            });
            if (r.ok) form.reset();
            return r;
          });
        }}
      >
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor="escopo-descricao">Item do contrato</Label>
          <Input
            id="escopo-descricao"
            name="descricao"
            maxLength={80}
            required
            placeholder="Posts no feed, Stories, Relatório…"
          />
        </div>
        <div className="w-24 space-y-1.5">
          <Label htmlFor="escopo-quantidade">Por mês</Label>
          <Input
            id="escopo-quantidade"
            name="quantidade"
            type="number"
            min={1}
            required
            defaultValue={1}
          />
        </div>
        <div className="w-28 space-y-1.5">
          <Label htmlFor="escopo-unidade">Unidade</Label>
          {/* OPCIONAL, e o `placeholder` diz para quê: a maioria dos itens se
              conta em unidades, e "12 posts" não precisa da palavra. */}
          <Input
            id="escopo-unidade"
            name="unidade"
            maxLength={20}
            placeholder="horas, GB…"
          />
        </div>
        <Button type="submit" disabled={ocupado}>
          {ocupado ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Plus aria-hidden />
          )}
          Acrescentar
        </Button>
      </form>

      {linhas.length === 0 ? (
        /* O VAZIO DIZ O QUE ACONTECE SEM O ESCOPO: conta sem contrato
           cadastrado é o estado da maioria hoje, e o bloco simplesmente não é
           desenhado no portal dela — nada muda para o cliente. */
        <EmptyState
          icon={Plus}
          title="Esta conta ainda não tem escopo cadastrado"
          description="Sem nenhum item, o portal desta conta não mostra bloco nenhum de escopo. Acrescente o primeiro acima."
          className="border-0"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-5">
            <div className="w-56 space-y-1.5">
              <Label htmlFor="escopo-mes">Lançar o consumo de</Label>
              <Select value={mes} onValueChange={trocarMes} disabled={ocupado}>
                <SelectTrigger
                  id="escopo-mes"
                  aria-label="Mês do consumo"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {rotuloDaCompetencia(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* O QUE O CLIENTE VÊ, dito onde se escolhe o mês: sem a frase,
                quem lança novembro em dezembro conclui que trocou o que o
                cliente está vendo. */}
            <p className="text-text-muted max-w-xs text-xs">
              {mes === competencia
                ? "É o mês que o cliente está vendo agora no portal."
                : "O portal do cliente mostra sempre o mês corrente — este aqui é correção de histórico."}
            </p>
          </div>

          <ul className={cn("divide-y border-t", lendo && "opacity-60")}>
            {linhas.map((linha) => (
              <LinhaDoItem
                key={linha.item.id}
                linha={linha}
                mes={mes}
                salvando={ocupado}
                editando={editando === linha.item.id}
                abrirEdicao={() => setEditando(linha.item.id)}
                fecharEdicao={() => setEditando(null)}
                acao={acao}
              />
            ))}
          </ul>

          <p className="text-text-muted border-t pt-3 text-xs">
            {ativos === 0
              ? "Com todos os itens desativados, o portal desta conta não mostra bloco nenhum de escopo."
              : `${ativos} ${ativos === 1 ? "item ativo" : "itens ativos"}.`}{" "}
            Desativar tira do portal e não apaga o consumo já lançado — por isso
            os itens não se apagam. O usado pode passar do contratado: é assim
            que o mês de extras aprovados aparece.
          </p>
        </>
      )}
    </div>
  );
}

function LinhaDoItem({
  linha,
  mes,
  salvando,
  editando,
  abrirEdicao,
  fecharEdicao,
  acao,
}: {
  linha: LinhaDoEscopo;
  mes: string;
  salvando: boolean;
  editando: boolean;
  abrirEdicao: () => void;
  fecharEdicao: () => void;
  acao: (fn: () => Promise<Resultado>) => void;
}) {
  const { item } = linha;
  const pct = percentualUsado(linha);
  const nivel = nivelDoEscopo(linha);
  const medida = item.unidade?.trim() ? ` ${item.unidade.trim()}` : "";

  if (editando) {
    return (
      <li className="py-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const dados = new FormData(e.currentTarget);
            acao(async () => {
              const r = await editarItemDoEscopo({
                id: item.id,
                descricao: dados.get("descricao"),
                quantidade: dados.get("quantidade"),
                unidade: dados.get("unidade"),
              });
              if (r.ok) fecharEdicao();
              return r;
            });
          }}
        >
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor={`d-${item.id}`}>Item</Label>
            <Input
              id={`d-${item.id}`}
              name="descricao"
              defaultValue={item.descricao}
              maxLength={80}
              required
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor={`q-${item.id}`}>Por mês</Label>
            <Input
              id={`q-${item.id}`}
              name="quantidade"
              type="number"
              min={1}
              defaultValue={item.quantidade}
              required
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label htmlFor={`u-${item.id}`}>Unidade</Label>
            <Input
              id={`u-${item.id}`}
              name="unidade"
              defaultValue={item.unidade ?? ""}
              maxLength={20}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            aria-label="Salvar o item"
            disabled={salvando}
          >
            <Check aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancelar"
            onClick={fecharEdicao}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </form>
        {/* O QUE TROCAR A QUANTIDADE FAZ, dito onde se troca: o consumo aponta
            para a LINHA, então a porcentagem de TODOS os meses muda junto. */}
        <p className="text-text-muted mt-2 text-xs">
          Trocar a quantidade muda a porcentagem de todos os meses deste item,
          inclusive os fechados. Contrato renegociado é item novo, com o antigo
          desativado.
        </p>
      </li>
    );
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            // A DESATIVADA RECUA PELO TOM, nunca por opacidade — a regra que o
            // `DateBadge` já pagou uma vez.
            item.ativo ? "font-medium" : "text-text-muted",
          )}
        >
          {item.descricao}
        </span>
        {!item.ativo ? <Badge variant="outline">Desativado</Badge> : null}
        <span className="text-text-muted shrink-0 text-xs tabular-nums">
          {linha.usado} de {item.quantidade}
          {medida} · {pct}%
          {linha.usado > item.quantidade
            ? ` · ${linha.usado - item.quantidade} além`
            : ` · ${quantoSobra(linha)} em aberto`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={salvando}
          onClick={abrirEdicao}
        >
          <Pencil aria-hidden className="size-4" />
          Editar
        </Button>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id={`ativo-${item.id}`}
            checked={item.ativo}
            disabled={salvando}
            onCheckedChange={(v) =>
              acao(() => alternarItemDoEscopo({ id: item.id, ativo: v }))
            }
          />
          <Label
            htmlFor={`ativo-${item.id}`}
            className="text-text-muted text-xs"
          >
            Ativo
          </Label>
        </div>
      </div>

      {/* A BARRA PASSA DE 100 E PARA DE CRESCER: o número ao lado já diz
          quanto além, e uma barra mais larga que a caixa estouraria a linha. */}
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", COR_DO_NIVEL_DO_ESCOPO[nivel])}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      {/* O ITEM DESATIVADO NÃO RECEBE LANÇAMENTO, e a ausência é decisão: ele
          saiu do contrato e o portal não o desenha mais, então o número
          lançado aqui seria um número que ninguém lê — a ponte construída e
          nunca atravessada pelo avesso. O que ficou lançado continua na linha
          acima, porque desativar não apaga nada. */}
      {!item.ativo ? null : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const dados = new FormData(e.currentTarget);
            acao(() =>
              lancarConsumoDoEscopo({
                item_id: item.id,
                competencia: mes,
                usado: dados.get("usado"),
                observacao: dados.get("observacao"),
              }),
            );
          }}
        >
          <div className="w-28 space-y-1.5">
            <Label htmlFor={`usado-${item.id}`} className="text-xs">
              Usado no mês
            </Label>
            {/* A CHAVE LEVA O MÊS, e é mecânico: o `defaultValue` é lido na
              montagem, então sem ela trocar de mês deixaria o campo com o
              número do mês anterior. */}
            <Input
              key={`${item.id}-${mes}`}
              id={`usado-${item.id}`}
              name="usado"
              type="number"
              min={0}
              defaultValue={linha.usado}
            />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor={`obs-${item.id}`} className="text-xs">
              Observação do mês{" "}
              <span className="text-text-muted">(o cliente lê)</span>
            </Label>
            <Input
              key={`obs-${item.id}-${mes}`}
              id={`obs-${item.id}`}
              name="observacao"
              maxLength={280}
              defaultValue={linha.observacao ?? ""}
              placeholder="3 extras aprovados por e-mail…"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={salvando}>
            {linha.lancado ? "Salvar" : "Lançar"}
          </Button>
        </form>
      )}
    </li>
  );
}
