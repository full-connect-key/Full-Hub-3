"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const CHAVE = "full-hub:social:ultimo-mes";

/**
 * A ÚLTIMA ESCOLHA, lembrada — e SÓ quando a URL não diz nada.
 *
 * ---------------------------------------------------------------------------
 * **ELE EXISTE PORQUE QUEM VIVE NUMA CONTA ABRE ESTE MÓDULO VÁRIAS VEZES POR
 * DIA**, e o padrão dele é "todas as contas, mês corrente" — então a primeira
 * coisa que a social media de uma conta faz, toda vez, é escolher de novo a
 * mesma conta e o mesmo mês.
 *
 * **E ELE É A COISA MAIS PERTO DE UMA SEGUNDA FONTE DE VERDADE QUE ESTE
 * PRODUTO TEM**, o que fica dito em vez de escondido. A regra das camadas do
 * Calendário Full é explícita: *"com as duas fontes, a tela abriria com a
 * camada que o link diz e trocaria sozinha um instante depois para a que o
 * navegador lembrava"*. O que torna isto diferente — e a única razão pela qual
 * ele pode existir — é a condição: **ele só age quando a URL não tem `mes`,
 * nem `cliente`, nem `post`.** Não havendo nada no link, não há nada para o
 * navegador contradizer.
 *
 * *O custo, dito em voz alta:* `/painel/social-media` sem parâmetro nenhum
 * passa a abrir diferente para duas pessoas. Em troca, o recorte aparece na
 * URL e nos filtros da tela — então quem chegou ali VÊ onde está, e um clique
 * em "Limpar filtros" desfaz. É a diferença entre lembrar e esconder, que é a
 * mesma do `GrupoDobravel`: o que está recolhido continua dizendo o que tem
 * dentro.
 *
 * **E UM LINK COM PARÂMETRO NUNCA É TOCADO.** "Olha o social de outubro da
 * Óptica" mandado no WhatsApp abre exatamente nele, para qualquer pessoa.
 * ---------------------------------------------------------------------------
 *
 * O `try/catch` em toda leitura e escrita é a regra do `localStorage`: ele
 * estoura em aba privada, com dados do site bloqueados, e no gerador de
 * protótipo. Sem memória nenhuma a tela abre no padrão, que é o certo.
 */
export function ContaLembrada() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const mes = parametros.get("mes");
  const cliente = parametros.get("cliente");
  const post = parametros.get("post");

  useEffect(() => {
    // GRAVA QUANDO OS DOIS ESTÃO NA URL, e nunca um só: metade do recorte
    // lembrada abriria a tela num mês de todas as contas, ou numa conta do mês
    // corrente — nenhuma das duas é a escolha que a pessoa fez.
    if (mes && cliente) {
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify({ mes, cliente }));
      } catch {
        // Sem memória, a tela abre no padrão. Não há o que avisar.
      }
      return;
    }

    // O `post` CONTA COMO PARÂMETRO, e é a parte fácil de esquecer: um link
    // direto para um post abre o editor dele, e redirecionar dali fecharia o
    // painel que a pessoa veio ver.
    if (mes || cliente || post) return;

    let lembrado: { mes?: string; cliente?: string } | null = null;
    try {
      const cru = window.localStorage.getItem(CHAVE);
      lembrado = cru ? JSON.parse(cru) : null;
    } catch {
      lembrado = null;
    }

    if (!lembrado?.mes || !lembrado.cliente) return;

    const proximos = new URLSearchParams(parametros.toString());
    proximos.set("mes", lembrado.mes);
    proximos.set("cliente", lembrado.cliente);
    // `replace` E NÃO `push`: com `push`, voltar no histórico devolveria a
    // pessoa para a URL vazia, que este efeito reescreveria na hora — o botão
    // de voltar deixaria de funcionar nesta tela.
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }, [mes, cliente, post, parametros, pathname, router]);

  return null;
}
