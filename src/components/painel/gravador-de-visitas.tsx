"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { registrarVisita } from "@/app/(interno)/painel/_actions/visitas";

/**
 * ANOTA QUAL MÓDULO ESTA PESSOA ABRIU, para o Acesso Rápido aprender (0142).
 *
 * ---------------------------------------------------------------------------
 * **ELE MORA NO LAYOUT, e é por isso que existe um componente para isto.** A
 * alternativa é uma chamada por página, e aí a vigésima primeira — a que
 * alguém criar depois — nasceria sem registrar nada, **sem nada quebrar**: o
 * cartão simplesmente nunca ofereceria aquele módulo, e ninguém ligaria uma
 * coisa à outra. É a razão escrita de `ConviteDeMicroTour` e de
 * `AtualizacaoAoVivo` morarem aqui: o que não é específico de tela não se
 * escreve por tela.
 * ---------------------------------------------------------------------------
 *
 * **É CLIENTE E NÃO SERVIDOR, e a razão é mecânica.** O layout do App Router
 * **não** é remontado ao navegar entre as telas dele — um registro feito no
 * corpo do layout gravaria a primeira rota da sessão e mais nenhuma. Quem
 * sabe que a rota mudou é `usePathname`.
 *
 * **E ELE NÃO DESENHA NADA**, de propósito: uma visita anotada não é um fato
 * que a pessoa precise ver, e um sinal na tela diria que o produto está
 * medindo o que ela faz — o que ele está, e quem explica isso é a tela do
 * Acesso Rápido, onde a ordem muda. O que ele devolve é `null`.
 *
 * **O RESULTADO É DESCARTADO, e é a exceção declarada à regra de "nada falha
 * em silêncio".** Aquela regra é sobre ESCRITA que alguém pediu: um toast
 * vermelho dizendo que a visita não foi anotada apareceria em cima de uma tela
 * que abriu normalmente, sobre uma coisa que ninguém clicou. O erro vai para o
 * log do servidor pelo `executarAcao`, que é onde ele é procurado — e o preço
 * de uma visita perdida é um peso que não subiu.
 *
 * **E ELE NÃO REGISTRA A MESMA ROTA DUAS VEZES NA MESMA MONTAGEM.** O efeito
 * roda em todo render, e o `ref` é o que separa "a rota mudou" de "o React
 * renderizou de novo" — sem ele, um render a mais viraria uma ida ao servidor.
 * Repetir não inflaria o peso (o respiro de dez minutos da 0142 cuida disso),
 * mas custaria uma requisição por render.
 */
export function GravadorDeVisitas() {
  const caminho = usePathname();
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    if (!caminho || ultima.current === caminho) return;
    ultima.current = caminho;
    // SEM `chamarAcao`: aquele embrulho existe para transformar a rejeição em
    // mensagem de tela, e aqui não há tela que a mostre. O `catch` é o que
    // impede uma promessa rejeitada de subir para o console como erro não
    // tratado numa navegação que deu certo.
    void registrarVisita(caminho).catch(() => {});
  }, [caminho]);

  return null;
}
