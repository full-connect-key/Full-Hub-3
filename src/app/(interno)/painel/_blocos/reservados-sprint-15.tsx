import { CalendarOff, Gauge, HandHelping, Sun } from "lucide-react";

/**
 * Os quatro blocos que o Sprint 15 vai preencher.
 *
 * Eles existem agora, VAZIOS e sem nenhuma consulta ao banco, por dois
 * motivos. O primeiro é que a tela inicial tem uma ordem, e descobrir a ordem
 * depois de construir os blocos costuma significar refazer o layout. O segundo
 * é que uma tela inicial que carrega devagar é pior que uma tela inicial
 * incompleta: é a primeira coisa que todo mundo abre, todo dia.
 *
 * Cada um diz, no comentário, o que o Sprint 15 liga nele. Nenhum busca dado:
 * a única forma de a tela inicial continuar instantânea é não pedir nada que
 * ainda não sabe mostrar.
 */

function BlocoReservado({
  titulo,
  icone: Icone,
  frase,
}: {
  titulo: string;
  icone: typeof Gauge;
  frase: string;
}) {
  return (
    <section className="bg-surface-card rounded-card border border-dashed p-5">
      <div className="flex items-center gap-2">
        <Icone aria-hidden className="text-text-muted size-4" />
        <h2 className="text-text-secondary text-sm font-medium">{titulo}</h2>
      </div>
      <p className="text-text-muted mt-1 text-sm">{frase}</p>
    </section>
  );
}

/**
 * Sprint 15: as subtarefas de hoje da pessoa, com concluir em um clique — a
 * mesma consulta que Minhas Tasks já faz (`meuDia` em lib/dados/minhas-tasks).
 */
export function MeuDiaBlock() {
  return (
    <BlocoReservado
      titulo="Meu dia"
      icone={Sun}
      frase="O que vence hoje no seu nome. Entra no Sprint 15."
    />
  );
}

/**
 * Sprint 15: o que está parado esperando esta pessoa — subtarefa bloqueada por
 * dependência dela, rodada de aprovação na fila, comentário sem resposta.
 */
export function PrecisaDeMimBlock() {
  return (
    <BlocoReservado
      titulo="Precisa de mim"
      icone={HandHelping}
      frase="O que está parado esperando você. Entra no Sprint 15."
    />
  );
}

/**
 * Sprint 15, só para gestão: o panorama da agência — tasks atrasadas por
 * cliente, aprovações represadas, carga por pessoa.
 */
export function PulsoAgenciaBlock() {
  return (
    <BlocoReservado
      titulo="Pulso da agência"
      icone={Gauge}
      frase="Atrasos, aprovações represadas e carga por pessoa. Entra no Sprint 15."
    />
  );
}

/**
 * Sprint 15: quem está de Full Day hoje, na tela inicial.
 *
 * O módulo Full Days já existe (Sprint 6) e a matriz já responde a pergunta;
 * o que falta é o recorte de hoje aqui, sem sair da tela inicial.
 */
export function QuemEstaForaHojeBlock() {
  return (
    <BlocoReservado
      titulo="Quem está fora hoje"
      icone={CalendarOff}
      frase="Quem está de férias, licença ou ausente hoje, sem sair daqui. Entra no Sprint 15 — por ora, a matriz do Full Days responde."
    />
  );
}
