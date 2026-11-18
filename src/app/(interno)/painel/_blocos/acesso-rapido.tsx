import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { canAccess, findMenuItem, type MenuItem } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * OS TRÊS ATALHOS DE SEMPRE — e eles continuam existindo como FALLBACK.
 *
 * ---------------------------------------------------------------------------
 * Eram a lista inteira até a 0142. Hoje a ordem vem da frequência de uso de
 * cada pessoa, e estes três são o que o cartão mostra **antes de haver
 * frequência**: no primeiro dia de alguém, numa conta nova, e quando a leitura
 * de `route_visits` falha.
 *
 * **O cartão nunca fica vazio**, e é por isso que eles não foram apagados: um
 * "Acesso rápido" sem nenhuma linha, na primeira tela que a pessoa abre no
 * primeiro dia, é uma seção que ensina que o produto não funciona.
 * ---------------------------------------------------------------------------
 *
 * O terceiro é sempre uma tarefa PESSOAL e recorrente — daquelas que se
 * lembram ao chegar e se esquecem depois. É o critério, e é por ele que o
 * ocupante mudou quando o anterior saiu do produto.
 */
const PADRAO = ["/painel/minhas-tasks", "/painel/notas-fiscais", "/painel/perfil"];

/**
 * A FRASE DE CADA MÓDULO, e ela é POR ROTA e não do `MenuItem`.
 *
 * ---------------------------------------------------------------------------
 * **O `MENU` não tem onde guardá-la, e pôr uma lá seria pior.** `MenuItem`
 * carrega `label`, `href`, `icon`, `roles`, a seção e duas bandeiras — tudo o
 * que a BARRA LATERAL desenha, e a barra não tem segunda linha. Uma `frase` no
 * tipo seria um campo que dezenove das vinte telas do menu não usam, e que a
 * vigésima primeira nasceria sem — com o cartão mostrando o rótulo sozinho e
 * ninguém ligando uma coisa à outra.
 *
 * **E a ausência é desenhada, não é defeito:** o módulo sem frase sai com o
 * rótulo só, que é o que a barra lateral mostra de qualquer forma. O que não
 * se faz é inventar uma — "Gestão de Tasks: gestão de tasks" é a mesma palavra
 * duas vezes, que é a decisão do rótulo do chip do calendário.
 * ---------------------------------------------------------------------------
 */
const FRASES: Record<string, string> = {
  "/painel/minhas-tasks": "Tarefas em andamento",
  "/painel/notas-fiscais": "Envio e pagamento",
  "/painel/perfil": "Foto e dados pessoais",
  "/painel/gestao-tasks": "Demandas da agência",
  "/painel/social-media": "O mês de cada conta",
  "/painel/aprovacoes": "Campanhas em produção",
  "/painel/solicitacoes": "Pedidos dos clientes",
  "/painel/full-days": "Day off e ausências",
  "/painel/calendario": "A agenda da casa",
  "/painel/pessoas": "Equipe e clientes",
  "/painel/portais": "O que cada cliente vê",
  "/painel/academy": "Playbooks e cursos",
  "/painel/recomendacoes": "O que vale o tempo",
  "/painel/comodatos": "Equipamento com quem",
  "/painel/financeiro": "Notas e gastos da casa",
  "/painel/metricas": "Os números da agência",
  "/painel/resumo-agencia": "A semana da agência",
  "/painel/auditoria": "Quem mexeu em quê",
};

/**
 * **A LISTA É VERTICAL, e não três cartões lado a lado.** Ela mudou de lugar
 * com a composição do desenho aprovado: era uma faixa na largura inteira da
 * página, e virou o último cartão da coluna de 306px. Em três colunas ali cada
 * atalho ficava com noventa e poucos pixels, e o rótulo e a frase embaixo dele
 * saíam truncados os dois — "Notas Fisc…" acima de "Envio e paga…".
 *
 * ---------------------------------------------------------------------------
 * **A ORDEM É APRENDIDA (0142)**, por decisão do usuário: *"o Acesso Rápido
 * deve ser baseado na frequência de uso de cada pessoa, e não uma lista
 * fixa"*. O peso decai com meia-vida de 30 dias, então a rota largada cai
 * sozinha — a conta inteira está no cabeçalho da migration.
 *
 * **SÃO TRÊS LINHAS E NÃO CINCO**, e o número não mudou de propósito: o cartão
 * é o último da coluna de 306px, e a altura dele é a que sobra abaixo do
 * cronômetro e dos contadores. Cinco atalhos empurrariam o rodapé da coluna
 * para baixo da dobra numa janela de notebook, e um atalho que só existe
 * depois de rolar é um atalho que ninguém usa — a conta do board de etapas.
 *
 * **E O FILTRO DE PERFIL É NA LEITURA, por `canAccess()`.** A escrita não
 * pergunta perfil nenhum (a razão está na action, e é a 0060), então uma rota
 * pode estar na tabela de alguém que deixou de alcançá-la — perfil muda, e
 * `exigeAtendimento` muda com a função na agência. Sem o filtro, o cartão
 * ofereceria um atalho que termina em 403, que é o chip de "Demandas" de
 * Minhas Tasks pela segunda vez.
 * ---------------------------------------------------------------------------
 */
export function AcessoRapido({
  role,
  ehAtendimento,
  maisUsadas = [],
}: {
  role: UserRole;
  /**
   * A MESMA RESPOSTA QUE O MENU USA, e ela desce de quem já a tem: a tela
   * Início não pergunta de novo. É `souDoAtendimento()`, do banco — perfil de
   * acesso e função na agência são coisas diferentes desde a 0006.
   */
  ehAtendimento: boolean;
  /**
   * A ORDEM APRENDIDA: as rotas da mais usada para a menos. Vazia no primeiro
   * dia de alguém e quando a leitura falha, e nos dois casos o cartão cai no
   * fallback — que é a lista fixa que ele sempre teve.
   *
   * **São `string[]` e não as linhas**, pela razão escrita em `lib/dados/`: o
   * peso é como a ordem é calculada, e a ordem é a informação. O cartão não
   * desenha o número, então carregá-lo seria o molde errado.
   */
  maisUsadas?: string[];
}) {
  // A ORDEM APRENDIDA PRIMEIRO, O PADRÃO ATRÁS — e sem repetir: quem já usa
  // Minhas Tasks todo dia a tem na frequência, e sem o `Set` ela apareceria
  // duas vezes no mesmo cartão.
  const vistos = new Set<string>();
  const escolhidos: MenuItem[] = [];

  for (const href of [...maisUsadas, ...PADRAO]) {
    if (escolhidos.length === 3) break;
    if (vistos.has(href)) continue;
    vistos.add(href);

    const item = findMenuItem(href);
    // TRÊS PERGUNTAS, E AS TRÊS SÃO DO `MENU`: a rota existe, este perfil a
    // alcança, e — quando ela é do Atendimento — esta pessoa é. A terceira é
    // a que `canAccess` não responde: `exigeAtendimento` não é perfil.
    if (!item) continue;
    if (!canAccess(role, item.href)) continue;
    if (item.exigeAtendimento && !ehAtendimento) continue;

    escolhidos.push(item);
  }

  return (
    <section className="bg-surface-card rounded-card space-y-2.5 border p-4">
      <h2 className="text-text-secondary text-xs font-bold tracking-wider uppercase">
        Acesso rápido
      </h2>

      <ul className="flex flex-col gap-1">
        {escolhidos.map((item) => {
          // O ÍCONE É O DO `MENU`, e é o que faz o atalho e o item da barra
          // lateral serem a mesma coisa para quem olha — sem um segundo mapa
          // de ícone, que é a história de `ICONE_DA_AREA` em miniatura: ele
          // tinha três cópias, e duas já tinham divergido.
          const Icone = item.icon;
          const frase = FRASES[item.href];

          return (
            <li key={item.href}>
              {/* O CARTÃO INTEIRO É CLICÁVEL, não só a seta: alvo pequeno em
                  tela de celular é erro de clique, e a seta aqui é indicação
                  de direção, não botão. */}
              <Link
                href={item.href}
                className="hover:bg-accent/50 focus-visible:ring-ring/50 group -mx-1.5 flex h-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
                >
                  <Icone className="size-4" />
                </span>

                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="text-text-primary truncate text-sm font-semibold">
                    {item.label}
                  </span>
                  {/* A FRASE SOME QUANDO NÃO HÁ, em vez de virar um travessão:
                      o rótulo sozinho é exatamente o que a barra lateral
                      mostra, e um "—" embaixo dele afirmaria que falta algo. */}
                  {frase ? (
                    <span className="text-text-muted truncate text-xs">{frase}</span>
                  ) : null}
                </span>

                <ArrowRight
                  aria-hidden
                  className="text-text-muted group-hover:text-accent-strong ml-auto size-4 shrink-0 transition-colors"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
