"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

import {
  formatarCronometro,
  segundosMedidos,
  type Cronometro as DadosDoCronometro,
} from "@/lib/dominio/tempo";

/**
 * O relógio correndo, na tela.
 *
 * Quem mede é o banco (migration 0021). Este componente só mostra, e existe
 * por uma razão: um cronômetro que a pessoa não vê é um número que aparece
 * pronto no diálogo de conclusão, grande, sem ninguém ter como saber de onde
 * veio. Vendo-o correr, ela repara que esqueceu a etapa aberta — que é o único
 * jeito de a medição continuar valendo alguma coisa.
 *
 * O `agora` inicial vem do servidor, e o navegador continua dali. Se o
 * primeiro número saísse do relógio do navegador, o HTML do servidor e o da
 * hidratação discordariam — é a mesma regra do `tempoRelativo()` nas
 * Recomendações.
 */
export function Cronometro({
  dados,
  agoraDoServidor,
  rotulo = "Tempo medido nesta etapa",
}: {
  dados: DadosDoCronometro;
  /** O instante que o servidor mediu, em milissegundos. */
  agoraDoServidor: number;
  rotulo?: string;
}) {
  const desde = dados.andando_desde;
  const fechados = dados.tempo_medido_segundos;
  const correndo = !!desde;

  // O primeiro número sai do relógio do SERVIDOR, e é o que o HTML entregue
  // carrega — por isso a hidratação bate. Do segundo em diante quem conta é o
  // navegador, um segundo por vez.
  const [segundos, setSegundos] = useState(() => segundosMedidos(dados, agoraDoServidor));

  useEffect(() => {
    // Parado não precisa de intervalo: o número não muda mais, e um relógio
    // por subtarefa numa lista de trinta seria trabalho para nada. O valor
    // inicial já está certo, porque sem passagem aberta ele é só o acumulado.
    if (!correndo) return;

    // As dependências são valores simples e não o objeto `dados`: ele é
    // remontado a cada render, e o intervalo seria desmontado e recriado
    // junto — um relógio que recomeça a contar do nada a cada renderização.
    const id = setInterval(
      () => setSegundos(segundosMedidos({ tempo_medido_segundos: fechados, andando_desde: desde }, Date.now())),
      1000,
    );
    return () => clearInterval(id);
  }, [desde, fechados, correndo]);

  if (!correndo && segundos === 0) return null;

  return (
    <span
      className={
        correndo
          // Par NOMEADO e já medido (`--accent-foreground` sobre `--accent`,
          // o azul claro), nunca `bg-info/10`: opacidade sobre um fundo
          // qualquer dá uma cor que ninguém mediu, e outra no tema escuro.
          ? "bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums"
          // Parado é `--text-secondary` e não `--text-muted`: o discreto só
          // está medido para texto GRANDE, e este relógio é de 12px.
          : "text-text-secondary inline-flex items-center gap-1 font-mono text-xs tabular-nums"
      }
      title={
        correndo
          ? `${rotulo}. O relógio corre enquanto a etapa está em andamento e para quando ela é enviada para aprovação ou concluída.`
          : `${rotulo}, já parado.`
      }
    >
      <Timer aria-hidden className="size-3" />
      <span className="sr-only">{rotulo}: </span>
      {formatarCronometro(segundos)}
    </span>
  );
}
