"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { PreferenciasDeAviso } from "@/lib/dados/portal";
import { cn } from "@/lib/utils";

import { salvarPreferenciasDeAviso } from "../../_actions/preferencias";

/**
 * As preferências de aviso.
 *
 * **Salva no clique, sem botão.** Três alternadores e uma escolha de
 * frequência não são um formulário — são quatro decisões independentes, e um
 * "Salvar" no fim faria a pessoa desligar um aviso, sair da tela e continuar
 * recebendo. O estado local muda na hora e volta sozinho se o banco recusar.
 *
 * ---------------------------------------------------------------------------
 * **DUAS OPÇÕES AINDA NÃO PRODUZEM E-MAIL, E A TELA DIZ ISSO NELAS.**
 *
 * A caixa continua ligável e a escolha continua gravada — ela vale no dia em
 * que a rotina existir, e desligar a opção agora faria a pessoa ter que
 * lembrar de religá-la. O que não pode é a tela oferecer em silêncio: escolher
 * "uma vez por dia" e não receber nada é, para quem escolheu, exatamente
 * igual a ter escolhido "nunca".
 *
 * A frase fica em `--warning` e junto de cada opção, não num aviso geral no
 * topo: um aviso no topo vale para a tela inteira, e aqui **uma** das três
 * caixas e **uma** das três frequências funcionam normalmente.
 * ---------------------------------------------------------------------------
 */

const AVISOS: {
  chave: keyof Omit<PreferenciasDeAviso, "frequencia">;
  rotulo: string;
  ajuda: string;
  /** A frase que aparece quando a opção ainda não produz e-mail nenhum. */
  aindaNao?: string;
}[] = [
  {
    chave: "novo_conteudo",
    rotulo: "Novo material para aprovar",
    ajuda: "Quando a Full enviar algo que depende da sua decisão.",
  },
  {
    chave: "novo_comentario",
    rotulo: "Novo comentário ou resposta",
    ajuda: "Quando alguém responder em um material seu.",
  },
  {
    chave: "lembrete_pendencias",
    rotulo: "Lembretes do que está parado",
    ajuda: "Um empurrão quando algo estiver esperando você há dias.",
    // O LEMBRETE É UMA VARREDURA DIÁRIA, e não a consequência de alguém ter
    // clicado — não há evento nenhum para pendurá-lo. A rotina que o rodaria
    // saiu do produto junto com a máquina que a hospedava; o porquê está no
    // CLAUDE.md, fora daqui, porque este arquivo é varrido por check:cores.
    aindaNao: "Ainda não enviamos este. Ele depende de uma rotina diária que não está no ar.",
  },
];

const FREQUENCIAS: {
  valor: PreferenciasDeAviso["frequencia"];
  rotulo: string;
  ajuda: string;
}[] = [
  {
    valor: "imediato",
    rotulo: "Na hora",
    ajuda: "Cada aviso assim que acontece.",
  },
  {
    valor: "diario",
    rotulo: "Uma vez por dia",
    // A MESMA AUSÊNCIA, e ela precisa estar escrita AQUI e não só no rodapé:
    // escolher "uma vez por dia" e não receber nada é indistinguível de
    // escolher "nunca". Dizer no botão é a diferença entre uma escolha e um
    // silêncio.
    ajuda: "Um resumo com tudo do dia — ainda não está no ar; por enquanto não enviamos nada.",
  },
  {
    valor: "nunca",
    rotulo: "Nunca",
    ajuda: "Você confere quando entrar no portal.",
  },
];

export function Preferencias({ iniciais }: { iniciais: PreferenciasDeAviso }) {
  const [valores, setValores] = useState(iniciais);
  const [salvando, iniciar] = useTransition();

  function salvar(proximos: PreferenciasDeAviso) {
    const anteriores = valores;
    setValores(proximos);

    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        salvarPreferenciasDeAviso(proximos),
      );
      if (!resultado.ok) {
        setValores(anteriores);
        toast.error(resultado.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-card divide-y rounded-xl border">
        {AVISOS.map(({ chave, rotulo, ajuda, aindaNao }) => (
          <div
            key={chave}
            className="flex items-start justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <Label htmlFor={chave} className="text-sm font-medium">
                {rotulo}
              </Label>
              <p className="text-text-muted mt-0.5 text-sm">{ajuda}</p>
              {aindaNao ? (
                <p className="text-warning mt-1 text-sm">{aindaNao}</p>
              ) : null}
            </div>
            <Switch
              id={chave}
              checked={valores[chave]}
              disabled={salvando}
              onCheckedChange={(ligado) =>
                salvar({ ...valores, [chave]: ligado })
              }
            />
          </div>
        ))}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Com que frequência</legend>
        <p className="text-text-muted text-sm">
          Vale para todos os avisos acima.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {FREQUENCIAS.map(({ valor, rotulo, ajuda }) => (
            <button
              key={valor}
              type="button"
              disabled={salvando}
              aria-pressed={valores.frequencia === valor}
              onClick={() => salvar({ ...valores, frequencia: valor })}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                valores.frequencia === valor
                  ? "border-accent-strong bg-accent"
                  : "bg-surface-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-medium">{rotulo}</span>
              {/*
                `--text-secondary` E NAO `--text-muted`, e o motivo e o fundo:
                o cartao escolhido troca para `bg-accent`, e o par medido do
                muted e contra a pagina e contra o cartao. A varredura de
                acessibilidade do protótipo pegou este, em `serious`.
              */}
              <span className="text-text-secondary mt-0.5 block text-xs">
                {ajuda}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
