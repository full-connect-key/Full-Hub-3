"use client";

import Link from "next/link";
import { useState } from "react";

import { CartaoDeNumero } from "@/components/shared/cartao-de-numero";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { ROTULOS_DE_ESTADO, ROTULOS_DE_TIPO, TOM_DO_ESTADO } from "@/lib/dominio/academy";
import { semAcento } from "@/lib/dominio/academy";
import type { LinhaDoAcompanhamento } from "@/lib/dados/academy";
import { montarCSV } from "@/lib/dominio/csv";
import { cn } from "@/lib/utils";

/**
 * O ACOMPANHAMENTO: pessoa × item obrigatório.
 *
 * **É A ABA QUE FAZ O MÓDULO EXISTIR**, e o cabeçalho da 0096 diz por quê:
 * trilha obrigatória sem quem confira é recado, não trilha.
 *
 * **O QUE ELA NÃO MOSTRA, e é a regra do módulo:** nota, ranking, comparação
 * entre pessoas. A tabela diz quem fez e quem não fez um item OBRIGATÓRIO —
 * um fato sobre o combinado, não uma medida sobre a pessoa. O que a pessoa leu
 * por conta própria não entra aqui, e a anotação dela não existe nesta tela
 * nem na consulta que a alimenta: ela mora em tabela própria porque policy não
 * limita coluna.
 *
 * **O VENCIDO É `--warning` E NUNCA `--danger`.** Uma leitura atrasada é uma
 * cobrança, não um erro — e vermelho numa tela que se abre uma vez por semana
 * treina o hábito de ignorar vermelho.
 */
export function PainelDaGestao({ linhas }: { linhas: LinhaDoAcompanhamento[] }) {
  const [termo, setTermo] = useState("");
  const [so, setSo] = useState<"tudo" | "pendentes" | "vencidos">("tudo");

  const alvo = semAcento(termo.trim());
  const visiveis = linhas.filter((l) => {
    if (so === "pendentes" && l.estado === "concluido") return false;
    if (so === "vencidos" && !l.vencido) return false;
    if (!alvo) return true;
    return semAcento(l.pessoa).includes(alvo) || semAcento(l.item).includes(alvo);
  });

  const pendentes = linhas.filter((l) => l.estado !== "concluido").length;
  const vencidos = linhas.filter((l) => l.vencido).length;
  const pessoas = new Set(linhas.map((l) => l.user_id)).size;

  function baixar() {
    const csv = montarCSV(
      ["Pessoa", "Função", "Item", "Formato", "Situação", "Prazo", "Fora do prazo"],
      visiveis.map((l) => [
        l.pessoa,
        l.funcao ?? "",
        l.item,
        ROTULOS_DE_TIPO[l.tipo],
        ROTULOS_DE_ESTADO[l.estado],
        l.prazo ?? "",
        l.vencido ? "sim" : "não",
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "acompanhamento-da-formacao.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhum item obrigatório ainda"
        description="Enquanto nada for marcado como obrigatório, não há o que acompanhar. A obrigatoriedade se define na página de cada item do acervo."
        className="bg-card rounded-card shadow-cartao border-solid"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoDeNumero rotulo="Pessoas com obrigatório" valor={pessoas} />
        <CartaoDeNumero
          rotulo="Leituras pendentes"
          valor={pendentes}
          tom={pendentes > 0 ? "atencao" : "neutro"}
        />
        <CartaoDeNumero
          rotulo="Fora do prazo"
          valor={vencidos}
          tom={vencidos > 0 ? "atencao" : "neutro"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Buscar por pessoa ou item"
          aria-label="Buscar no acompanhamento"
          className="min-w-55 flex-1"
        />

        {(["tudo", "pendentes", "vencidos"] as const).map((chave) => (
          <button
            key={chave}
            type="button"
            onClick={() => setSo(chave)}
            aria-pressed={so === chave}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              so === chave
                ? "bg-action-soft text-action-text"
                : "bg-card text-text-secondary hover:text-text-primary border",
            )}
          >
            {chave === "tudo" ? "Tudo" : chave === "pendentes" ? "Pendentes" : "Fora do prazo"}
          </button>
        ))}

        <button
          type="button"
          onClick={baixar}
          className="bg-card text-text-secondary hover:text-text-primary rounded-full border px-3 py-1.5 text-xs font-medium"
        >
          Baixar CSV
        </button>
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          title="Nada neste recorte"
          description="Troque o filtro ou o termo acima."
          className="bg-card rounded-card shadow-cartao border-solid"
        />
      ) : (
        <div className="bg-card rounded-card shadow-cartao overflow-x-auto border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted border-b text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Pessoa</th>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visiveis.map((l) => (
                <tr key={`${l.user_id}-${l.item_id}`}>
                  <td className="px-4 py-2.5">
                    <span className="text-text-primary font-medium">{l.pessoa}</span>
                    {l.funcao ? (
                      <span className="text-text-muted block text-xs">{l.funcao}</span>
                    ) : null}
                  </td>
                  <td className="text-text-secondary px-4 py-2.5">
                    {l.item}
                    <span className="text-text-muted block text-xs">
                      {ROTULOS_DE_TIPO[l.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        TOM_DO_ESTADO[l.estado] === "sucesso" && "bg-success-soft text-success",
                        TOM_DO_ESTADO[l.estado] === "atencao" && "bg-warning-soft text-warning",
                        TOM_DO_ESTADO[l.estado] === "acao" && "bg-action-soft text-action-text",
                        TOM_DO_ESTADO[l.estado] === "neutro" && "bg-neutral-soft text-neutral",
                      )}
                    >
                      {ROTULOS_DE_ESTADO[l.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">
                    {l.prazo ? (
                      <span className={l.vencido ? "text-warning font-medium" : "text-text-muted"}>
                        {l.prazo.split("-").reverse().join("/")}
                        {l.vencido ? " · fora do prazo" : ""}
                      </span>
                    ) : (
                      <span className="text-text-muted">sem prazo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-text-muted text-xs">
        A tabela conta só o que é <strong>obrigatório</strong>. O que cada pessoa leu por
        conta própria não aparece aqui — e a anotação dela não é lida por ninguém, nem
        pelo sócio.
      </p>

      {/* O LINK SAIU DE DENTRO DO PARÁGRAFO, e quem cobrou foi o axe:
          `link-in-text-block` é `serious`, e a razão é que ali a COR é a única
          coisa que separa o link do texto em volta. Todo link do produto é
          `hover:underline` e nenhum outro foi acusado — porque nenhum outro
          morava dentro de uma frase. É a mesma regra que o pedido concluído do
          portal já pagou uma vez, e ela aparece aqui porque esta seção passou a
          dividir a tela com o acompanhamento dos tours. */}
      <Link
        href="/painel/academy"
        className="text-accent-strong block text-xs hover:underline"
      >
        Voltar ao acervo
      </Link>
    </div>
  );
}
