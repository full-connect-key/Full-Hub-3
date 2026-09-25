import type { Metadata } from "next";

import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { obterMinhaFicha } from "@/lib/dados/equipe";
import { resumoDaHome } from "@/lib/dados/home";
import { meuDia, prazosDeHoje } from "@/lib/dados/minhas-tasks";
import { listarPortaisDeClientes } from "@/lib/dados/portais-de-clientes";

import { MeuDia } from "./minhas-tasks/meu-dia";
import { AcessoRapido } from "./_blocos/acesso-rapido";
import { BoasVindas } from "./_blocos/boas-vindas";
import { ClientesEmAtencao } from "./_blocos/clientes-em-atencao";
import { PortaisDeClientes } from "./_blocos/portais-de-clientes";
import { PrecisaDeMim } from "./_blocos/precisa-de-mim";
import { PulsoDaAgencia } from "./_blocos/pulso-da-agencia";
import { QuemEstaForaHoje } from "./_blocos/quem-esta-fora-hoje";
import { RascunhosAExpirar } from "./_blocos/rascunhos-a-expirar";

export const metadata: Metadata = { title: "Início" };

/**
 * A tela inicial do Painel Interno.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM É A DO DIA DA PESSOA, e ela não muda por perfil — o que muda é
 * quantos blocos existem.
 *
 * Quem sou eu → o que eu entrego hoje → o que está parado me esperando → quem
 * não está aqui → para onde eu vou. E só então, para a gestão, o panorama da
 * agência: quem abre esta tela abre para trabalhar, não para conferir número.
 * Pôr o painel de indicadores no topo faria a gestão rolar todo dia por cima
 * dele para achar as próprias entregas.
 *
 * **Os blocos de exceção somem quando não têm nada a dizer** — rascunho a
 * expirar, o que precisa de mim, quem está fora, cliente parado. Uma caixa
 * fixa dizendo "nada aqui" ocupa todo dia, na primeira tela de todo mundo, o
 * lugar de uma informação que interessa em alguns dias. O Pulso é a exceção da
 * exceção, e está explicado lá: zero atrasada é a resposta boa.
 * ---------------------------------------------------------------------------
 *
 * **SÃO DUAS IDAS AO BANCO PARA OS NÚMEROS, e não uma.** `home_summary()`
 * (0049) traz os sete blocos de contagem numa chamada só; `meuDia()` traz a
 * lista de etapas com o que cada botão pode fazer — máquina de estados,
 * cronômetro, dependência em aberto. Aquilo não cabe num contador, e a
 * alternativa era desenhar aqui uma segunda lista parecida com a de Minhas
 * Tasks. Duas listas parecidas divergem no pior lugar: o botão que muda o
 * status de uma etapa. É o MESMO componente, alimentado pela MESMA função.
 *
 * **E as duas vão em paralelo.** Em série seriam duas viagens de rede somadas
 * na primeira tela que todo mundo abre, todo dia.
 */
export default async function PaginaInicialDoPainel() {
  const { profile, usuarioId } = await exigirAcessoARota("/painel");
  const gestao = ehGestor(profile.role);

  const [ficha, resumo, itensDoDia, portais] = await Promise.all([
    obterMinhaFicha(),
    resumoDaHome(),
    meuDia(usuarioId, prazosDeHoje()),
    // Só a gestão enxerga a seção. A rota /portal/{slug} recusa colaborador no
    // servidor de qualquer forma — não buscar aqui é economia, não é a trava.
    gestao ? listarPortaisDeClientes() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <RascunhosAExpirar />

      <BoasVindas
        primeiroNome={primeiroNome(profile.nome)}
        role={profile.role}
        cargo={ficha?.cargo ?? null}
      />

      <MeuDia
        itens={itensDoDia}
        primeiroNome={primeiroNome(profile.nome)}
        usuarioId={usuarioId}
        souGestor={gestao}
        estaSemana={resumo.meu_dia?.semana ?? 0}
      />

      <PrecisaDeMim dados={resumo.precisa_de_mim} />

      <QuemEstaForaHoje pessoas={resumo.fora_hoje} />

      <AcessoRapido />

      {gestao ? (
        <>
          <PulsoDaAgencia dados={resumo.pulso} />
          <ClientesEmAtencao clientes={resumo.clientes_em_atencao} />
          <PortaisDeClientes clientes={portais} />
        </>
      ) : null}
    </div>
  );
}
