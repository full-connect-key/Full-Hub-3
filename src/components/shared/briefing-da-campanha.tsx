"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMPOS_DO_BRIEFING,
  CANAIS_SUGERIDOS,
  TONS_SUGERIDOS,
  canaisNormalizados,
  type BriefingDaCampanha,
} from "@/lib/dominio/campanhas";

/**
 * Os sete campos do briefing de uma campanha (0125), num componente só.
 *
 * **SÃO DOIS CHAMADORES, e é por isso que ele é compartilhado:** o formulário
 * de abertura e a seção do painel da campanha. Duas telas desenhando os mesmos
 * sete campos divergiriam na primeira mudança, e a que divergiria é a do
 * painel — ela é a que se relê menos. É a decisão de `CampoDaPorta` e de
 * `FaixaDeDisponibilidade`: o que se centraliza é o desenho e o mecanismo.
 *
 * **O QUE ELE NÃO DECIDE É QUANDO SALVAR.** O formulário de abertura tem um
 * botão no fim e grava tudo de uma vez; o painel da campanha grava a seção
 * inteira num Salvar próprio. Ele avisa a mudança e mais nada — quem grava
 * resolve, que é a assimetria escrita de `FaixaDeDisponibilidade`.
 *
 * **E ele não tem as OBSERVAÇÕES nem os ANEXOS**, e a ausência é decisão: as
 * observações são o briefing em prosa da DEMANDA (`tasks.briefing_rico`), que
 * toda demanda deste produto já tem, e os anexos são `task_referencias` dela
 * — a 0051 escreveu por quê, e uma segunda caixa de texto com o mesmo papel
 * em outra tabela é onde as duas versões do briefing divergem.
 */
export function BriefingDaCampanhaCampos({
  briefing,
  onChange,
  desabilitado = false,
}: {
  briefing: BriefingDaCampanha;
  onChange: (briefing: BriefingDaCampanha) => void;
  desabilitado?: boolean;
}) {
  const trocar = <C extends keyof BriefingDaCampanha>(
    chave: C,
    valor: BriefingDaCampanha[C],
  ) => onChange({ ...briefing, [chave]: valor });

  return (
    <div className="space-y-5">
      {CAMPOS_DO_BRIEFING.map((campo) => (
        <div key={campo.chave} className="space-y-1.5">
          <Label htmlFor={`briefing-${campo.chave}`}>{campo.rotulo}</Label>
          <Textarea
            id={`briefing-${campo.chave}`}
            rows={campo.linhas}
            disabled={desabilitado}
            value={(briefing[campo.chave] as string) ?? ""}
            onChange={(e) => trocar(campo.chave, e.target.value as never)}
            aria-describedby={`ajuda-${campo.chave}`}
          />
          {/* A PERGUNTA É AJUDA E NÃO PLACEHOLDER, porque placeholder
              desaparece no primeiro caractere — some exatamente quando a
              pessoa está escrevendo a resposta, que é quando ela precisa
              reler o que foi perguntado. */}
          <p id={`ajuda-${campo.chave}`} className="text-text-muted text-xs">
            {campo.pergunta}
          </p>

          {campo.chave === "tomDeVoz" ? (
            <Sugestoes
              opcoes={TONS_SUGERIDOS}
              desabilitado={desabilitado}
              aoEscolher={(tom) => trocar("tomDeVoz", tom)}
              rotulo="Tons sugeridos"
            />
          ) : null}
        </div>
      ))}

      <ChipsDeCanal
        canais={briefing.canais}
        desabilitado={desabilitado}
        onChange={(canais) => trocar("canais", canais)}
      />
    </div>
  );
}

/** Os tons sugeridos: um clique PREENCHE o campo, não acrescenta a uma lista. */
function Sugestoes({
  opcoes,
  aoEscolher,
  rotulo,
  desabilitado,
}: {
  opcoes: readonly string[];
  aoEscolher: (valor: string) => void;
  rotulo: string;
  desabilitado: boolean;
}) {
  if (desabilitado) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-text-muted text-xs">{rotulo}:</span>
      {opcoes.map((opcao) => (
        <button
          key={opcao}
          type="button"
          onClick={() => aoEscolher(opcao)}
          className="text-text-secondary hover:bg-neutral-soft rounded-full border px-2 py-0.5 text-xs transition-colors"
        >
          {opcao}
        </button>
      ))}
    </div>
  );
}

/**
 * Os canais, em CHIPS.
 *
 * **Chips e não um `<select multiple>`**, pela razão do seletor de redes do
 * social: no celular, marcar o segundo item desmarca o primeiro em metade dos
 * navegadores.
 *
 * **E a lista é ABERTA**, ao contrário daquele seletor: `canais` é texto livre
 * no banco pela razão de `posts.formato` (0032) — esses nomes mudam a cada
 * temporada de produto das plataformas —, então os doze sugeridos são atalho e
 * o campo aceita "Feira do Varejo 2027".
 *
 * **O componente mora AQUI e não em `components/shared/`**, e é a decisão de
 * `listar()` na action: ele tem um chamador, e um controle compartilhado com
 * um dono só é o que alguém reaproveita três sprints depois achando que ele
 * decide alguma coisa.
 */
function ChipsDeCanal({
  canais,
  onChange,
  desabilitado,
}: {
  canais: string[];
  onChange: (canais: string[]) => void;
  desabilitado: boolean;
}) {
  const [digitado, setDigitado] = useState("");

  // A NORMALIZAÇÃO É A MESMA DA ACTION, e sai do mesmo lugar: sem ela o chip
  // "instagram" entraria ao lado de "Instagram" e o banco gravaria os dois —
  // a tela mostrando duas vezes o mesmo canal.
  const acrescentar = (bruto: string) => {
    const limpos = canaisNormalizados([...canais, bruto]);
    if (limpos.length > 20) return;
    onChange(limpos);
    setDigitado("");
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="briefing-canais">Canais</Label>

      {canais.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {canais.map((canal) => (
            <li key={canal}>
              <Badge variant="secondary" className="gap-1 pe-1">
                {canal}
                {desabilitado ? null : (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(canais.filter((c) => c !== canal))
                    }
                    aria-label={`Tirar ${canal}`}
                    className="hover:bg-neutral-soft rounded-full p-0.5"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {desabilitado ? null : (
        <>
          <div className="flex gap-2">
            <Input
              id="briefing-canais"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              // ENTER ACRESCENTA, e o `preventDefault` é obrigatório: dentro
              // de um formulário, Enter num campo de texto SUBMETE — e aqui
              // isso criaria a campanha no meio de quem está listando canais.
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (digitado.trim()) acrescentar(digitado);
              }}
              placeholder="Instagram, feira, e-mail…"
              aria-describedby="ajuda-canais"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => digitado.trim() && acrescentar(digitado)}
              disabled={!digitado.trim()}
            >
              Acrescentar
            </Button>
          </div>
          <p id="ajuda-canais" className="text-text-muted text-xs">
            Onde a campanha vai ao ar. Clique numa sugestão ou escreva a sua.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {CANAIS_SUGERIDOS.filter(
              (c) =>
                !canais.some(
                  (j) =>
                    j.toLocaleLowerCase("pt-BR") ===
                    c.toLocaleLowerCase("pt-BR"),
                ),
            ).map((canal) => (
              <button
                key={canal}
                type="button"
                onClick={() => acrescentar(canal)}
                className="text-text-secondary hover:bg-neutral-soft rounded-full border px-2 py-0.5 text-xs transition-colors"
              >
                {canal}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
