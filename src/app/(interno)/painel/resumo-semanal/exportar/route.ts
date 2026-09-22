import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { historicoParaExportar } from "@/lib/dados/resumo-semanal";
import { ROTULOS_DE_HUMOR, type Humor } from "@/lib/dominio/skills";

/**
 * O Resumo Semanal inteiro, em um arquivo.
 *
 * TEXTO PURO, e não PDF: o que a pessoa faz com isso é colar num documento,
 * mandar num chat ou guardar. Texto serve para os três e não depende de nada
 * instalado — e o arquivo continua legível daqui a dez anos.
 *
 * Só o registro de quem está pedindo. Não existe parâmetro de usuário nesta
 * rota de propósito: a RLS de `weekly_entries` e `weekly_notes` já fecha em
 * `auth.uid()`, mas aceitar um id na URL seria convidar alguém a tentar, e uma
 * rota que tenta buscar o diário de outra pessoa é um erro de desenho mesmo
 * quando o banco recusa.
 */
export async function GET() {
  const sessao = await exigirAcessoARota("/painel/resumo-semanal");
  const semanas = await historicoParaExportar();

  const linhas: string[] = [
    "RESUMO SEMANAL",
    sessao.profile.nome,
    `Exportado em ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`,
    "",
  ];

  if (semanas.length === 0) {
    linhas.push("Nenhum registro ainda.");
  }

  for (const semana of semanas) {
    const inicio = parseISO(semana.semana);
    linhas.push("=".repeat(60));
    linhas.push(
      `Semana de ${format(inicio, "dd/MM/yyyy", { locale: ptBR })}`,
    );
    linhas.push("=".repeat(60));
    linhas.push("");

    if (semana.entregas.length > 0) {
      linhas.push("Entregas");
      for (const entrega of semana.entregas) {
        linhas.push(
          `  - ${format(parseISO(entrega.data), "EEE dd/MM", { locale: ptBR })}: ${entrega.descricao}`,
        );
      }
      linhas.push("");
    }

    if (semana.nota) {
      linhas.push("Como foi a semana");
      if (semana.humor) {
        linhas.push(`  (${ROTULOS_DE_HUMOR[semana.humor as Humor] ?? semana.humor})`);
      }
      for (const paragrafo of semana.nota.split("\n")) {
        linhas.push(`  ${paragrafo}`);
      }
      linhas.push("");
    }
  }

  const arquivo = `resumo-semanal-${format(new Date(), "yyyy-MM-dd")}.txt`;

  return new Response(linhas.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // `attachment` em vez de deixar o navegador abrir: o registro é privado,
      // e uma aba aberta com ele fica no histórico de quem passar pela mesa.
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
