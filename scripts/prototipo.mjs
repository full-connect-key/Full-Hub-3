#!/usr/bin/env node
/**
 * Gera imagens das telas para validacao visual, sem precisar de Supabase,
 * sem login e sem subir nada:
 *
 *   npm run prototipo
 *
 * As imagens saem em prototipos/.
 *
 * COMO FUNCIONA
 *   O projeto e copiado para .prototipo/. So nessa copia, alguns modulos sao
 *   trocados por versoes de exemplo (scripts/prototipo/) usando apelidos de
 *   caminho do TypeScript, e o proxy vira um que deixa tudo passar. Nenhum
 *   arquivo de src/ e alterado, e a copia e apagada no fim.
 *
 *   Por isso o codigo que pula o login NAO existe no app publicado: ele vive
 *   apenas dentro da copia temporaria.
 *
 *   O perfil vem de PROTOTIPO_ROLE, entao o mesmo build mostra o painel como
 *   colaborador, desenvolvedor ou socio -- o servidor e reiniciado a cada
 *   perfil.
 *
 * A CADA SPRINT
 *   1. acrescente os dados ficticios em scripts/prototipo/dados-exemplo.ts
 *   2. acrescente a tela nova na lista TELAS logo abaixo
 *   3. se a tela so existe para o prototipo (como a de 403), crie a rota em
 *      scripts/prototipo/extras/ -- ela e copiada para dentro de src/app/ da
 *      copia e nunca vai para o app publicado
 */

import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, openSync, statSync, readSync, closeSync, rmSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Telas capturadas.
//   role  -> perfil usado (padrao: socio). Telas do portal ignoram.
//   env   -> variaveis de ambiente do servidor desta tela. Ela sobe um
//            servidor so para si -- use apenas quando o estado nao der para
//            alcancar pela rota, como um feed vazio.
//   tema  -> "escuro" para capturar no modo escuro.
//   menu  -> "recolhido" para capturar com o menu lateral fechado.
//   semRolagem -> captura so a janela. Necessario para lista suspensa aberta:
//                 `fullPage` rola a pagina, e o Select do Radix fecha ao rolar.
// ---------------------------------------------------------------------------
const TELAS = [
  { nome: "01-login", rota: "/login", largura: 1280, altura: 800 },
  { nome: "01b-login-375", rota: "/login", largura: 375, altura: 900 },
  { nome: "02-login-escuro", rota: "/login", largura: 1280, altura: 800, tema: "escuro" },
  { nome: "03-login-sessao-expirada", rota: "/login?motivo=inatividade", largura: 1280, altura: 800 },
  { nome: "04-esqueci-senha", rota: "/esqueci-senha", largura: 1280, altura: 800 },

  { nome: "05-painel-socio", rota: "/painel", largura: 1440, altura: 860, role: "socio" },
  { nome: "06-painel-socio-escuro", rota: "/painel", largura: 1440, altura: 860, role: "socio", tema: "escuro" },
  { nome: "07-painel-menu-recolhido", rota: "/painel", largura: 1440, altura: 860, role: "socio", menu: "recolhido" },
  { nome: "08-painel-colaborador", rota: "/painel", largura: 1440, altura: 860, role: "colaborador" },
  { nome: "09-painel-desenvolvedor", rota: "/painel", largura: 1440, altura: 860, role: "desenvolvedor" },

  // GESTÃO DE PESSOAS: as duas listas que eram dois módulos, agora em abas.
  // As duas imagens da lista existem para a barra de abas ser conferida nas
  // duas — com uma só, ninguém repara que a aba ativa não trocou.
  { nome: "10-clientes-lista", rota: "/painel/pessoas?aba=clientes", largura: 1440, altura: 900, role: "socio" },
  { nome: "10b-clientes-novo", rota: "/painel/pessoas?aba=clientes", largura: 1440, altura: 1000, role: "socio", clicar: 'button:has-text("Novo cliente")' },
  { nome: "10c-cliente-dados", rota: "/painel/pessoas/clientes/c0000000-0000-0000-0000-00000000000a", largura: 1440, altura: 1000, role: "socio" },
  { nome: "10d-cliente-usuarios", rota: "/painel/pessoas/clientes/c0000000-0000-0000-0000-00000000000a", largura: 1440, altura: 800, role: "socio", clicar: 'button:has-text("Usuários com acesso")' },
  { nome: "10e-equipe-lista", rota: "/painel/pessoas?aba=equipe", largura: 1440, altura: 900, role: "socio" },
  { nome: "10f-colaborador-dados", rota: "/painel/pessoas/equipe/a0000000-0000-0000-0000-000000000003", largura: 1440, altura: 1400, role: "socio" },
  { nome: "10g-desligamento", rota: "/painel/pessoas/equipe/a0000000-0000-0000-0000-000000000003", largura: 1440, altura: 1000, role: "socio", clicar: 'button:has-text("Desligar da equipe")' },
  { nome: "10j-colaborador-desativar", rota: "/painel/pessoas/equipe/a0000000-0000-0000-0000-000000000003", largura: 1440, altura: 900, role: "desenvolvedor", clicar: 'button:has-text("Desativar acesso")' },
  { nome: "10k-cliente-exclusao-barrada", rota: "/painel/pessoas/clientes/c0000000-0000-0000-0000-00000000000a", largura: 1440, altura: 900, role: "socio", clicar: 'button:has-text("Excluir definitivamente")' },
  { nome: "10h-meu-perfil", rota: "/painel/perfil", largura: 1440, altura: 1000, role: "socio" },
  { nome: "10i-equipe-desenvolvedor", rota: "/painel/pessoas?aba=equipe", largura: 1440, altura: 900, role: "desenvolvedor", clicar: 'button:has-text("Adicionar colaborador")' },

  { nome: "20-tasks-board", rota: "/painel/gestao-tasks", largura: 1600, altura: 1000, role: "socio" },
  { nome: "21-tasks-board-escuro", rota: "/painel/gestao-tasks", largura: 1600, altura: 1000, role: "socio", tema: "escuro" },
  { nome: "22-tasks-lista", rota: "/painel/gestao-tasks?visao=lista", largura: 1600, altura: 900, role: "socio" },
  { nome: "23-tasks-calendario", rota: "/painel/gestao-tasks?visao=calendario", largura: 1600, altura: 1100, role: "socio" },
  { nome: "24-tasks-nova", rota: "/painel/gestao-tasks", largura: 1400, altura: 2100, role: "socio", clicar: 'button:has-text("Nova task")' },
  { nome: "24b-tasks-nova-com-etapa", rota: "/painel/gestao-tasks", largura: 1400, altura: 2300, role: "socio", clicar: ['button:has-text("Nova task")', 'button:has-text("Subtarefa")'] },
  { nome: "25-task-detalhe", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 1400, role: "socio" },
  // O seletor ABERTO. Os sete status com os calculados desligados so se veem
  // com a lista aberta -- fechada, a tela mostra um campo e nada prova que
  // os outros cinco estao la.
  { nome: "25b-task-status-aberto", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 1100, role: "socio", clicar: '[aria-label="Status da demanda"]', semRolagem: true },
  { nome: "26-tasks-so-atrasadas", rota: "/painel/gestao-tasks?visao=lista&atrasadas=1", largura: 1600, altura: 800, role: "socio" },
  { nome: "30-minhas-tasks-lista", rota: "/painel/minhas-tasks", largura: 1600, altura: 1200, role: "socio" },
  { nome: "31-minhas-tasks-board", rota: "/painel/minhas-tasks?visao=board", largura: 1600, altura: 1100, role: "socio" },
  { nome: "32-minhas-tasks-calendario", rota: "/painel/minhas-tasks?visao=calendario", largura: 1600, altura: 1300, role: "socio" },
  { nome: "33-minhas-tasks-atrasadas", rota: "/painel/minhas-tasks?foco=atrasadas", largura: 1600, altura: 1000, role: "socio" },
  { nome: "34-minhas-tasks-escuro", rota: "/painel/minhas-tasks", largura: 1600, altura: 1200, role: "socio", tema: "escuro" },
  { nome: "35-minhas-tasks-detalhe", rota: "/painel/minhas-tasks", largura: 1600, altura: 1200, role: "socio", clicar: 'button:has-text("Revisar o manual")' },
  { nome: "36-minhas-tasks-atendimento", rota: "/painel/minhas-tasks", largura: 1600, altura: 900, role: "colaborador" },
  { nome: "37-minhas-tasks-sem-criar", rota: "/painel/minhas-tasks", largura: 1600, altura: 900, role: "colaborador-social" },
  { nome: "38-concluir-pede-tempo", rota: "/painel/minhas-tasks", largura: 1400, altura: 900, role: "socio", clicar: 'button:has-text("Concluir")' },

  { nome: "40-aprovacoes-internas", rota: "/painel/aprovacoes-internas", largura: 1440, altura: 1000, role: "desenvolvedor" },
  { nome: "41-aprovacoes-internas-socio", rota: "/painel/aprovacoes-internas", largura: 1440, altura: 1000, role: "socio" },
  { nome: "42-aprovacoes-ajustes", rota: "/painel/aprovacoes-internas", largura: 1200, altura: 800, role: "socio", clicar: 'button:has-text("Solicitar ajustes")' },
  { nome: "43-workflows", rota: "/painel/workflows", largura: 1440, altura: 1000, role: "socio" },
  { nome: "45-workflow-editor", rota: "/painel/workflows", largura: 1440, altura: 1300, role: "socio", clicar: 'button:has-text("Novo workflow")' },
  { nome: "50-social-lista", rota: "/painel/social-media?post=p1", largura: 1440, altura: 1100, role: "socio" },
  { nome: "51-social-calendario", rota: "/painel/social-media?visao=calendario&post=p1", largura: 1600, altura: 1100, role: "socio" },
  // O COLABORADOR: o botao de enviar sai desligado com a razao escrita, e a
  // lista abre no grupo dele. E o que prova que a mesma tela serve aos tres.
  { nome: "52-social-colaborador", rota: "/painel/social-media?post=p1", largura: 1440, altura: 1100, role: "colaborador-social" },
  { nome: "53-social-375", rota: "/painel/social-media?post=p1", largura: 375, altura: 1900, role: "socio" },
  // A CORRENTE (0045) E A FAIXA SEM DATA (0044).
  // O calendario e onde as duas convivem: a grade do mes em cima e os posts que
  // ninguem datou embaixo. Em 375px e onde se ve se a lista da faixa rola em
  // vez de estourar a largura -- foi assim que o calendario do Full Days saiu
  // errado na primeira imagem.
  { nome: "54-social-sem-data", rota: "/painel/social-media?visao=calendario&post=p1", largura: 1440, altura: 1500, role: "socio" },
  { nome: "55-social-sem-data-375", rota: "/painel/social-media?visao=calendario", largura: 375, altura: 1600, role: "socio" },
  { nome: "56-abrir-o-mes", rota: "/painel/social-media", largura: 1440, altura: 1200, role: "socio", clicar: 'button:has-text("Abrir o mês")' },
  { nome: "57-abrir-o-mes-375", rota: "/painel/social-media", largura: 375, altura: 1500, role: "socio", clicar: 'button:has-text("Abrir o mês")' },
  // O CARROSSEL NAVEGÁVEL (0048): a imagem precisa mostrar o slide 2, e não o
  // primeiro — é o clique na seta que prova que ele anda, e uma imagem do
  // estado inicial pareceria igual à tira antiga.
  { nome: "59-carrossel", rota: "/painel/social-media?post=p1", largura: 1440, altura: 1300, role: "socio", clicar: 'button[aria-label="Próximo slide"]' },
  { nome: "60-carrossel-375", rota: "/painel/social-media?post=p1", largura: 375, altura: 1900, role: "socio" },
  { nome: "58-corrente-escuro", rota: "/painel/social-media?post=p1", largura: 1440, altura: 1300, role: "socio", tema: "escuro" },

  { nome: "44-recorrencias", rota: "/painel/workflows?aba=recorrencias", largura: 1440, altura: 1000, role: "socio" },
  { nome: "44b-recorrencia-editor", rota: "/painel/workflows?aba=recorrencias&regra=nova", largura: 1440, altura: 1400, role: "socio" },
  // 375px: a previa vai para BAIXO do formulario no celular, e a grade de
  // chips das variaveis e o que primeiro estoura a largura.
  { nome: "44c-recorrencia-375", rota: "/painel/workflows?aba=recorrencias&regra=nova", largura: 375, altura: 1600, role: "socio" },
  { nome: "48-enviar-aprovacao", rota: "/painel/minhas-tasks", largura: 1400, altura: 900, role: "colaborador-social", clicar: 'button:has-text("Enviar para aprovação")' },
  { nome: "49-aprovacao-propria", rota: "/painel/aprovacoes-internas", largura: 1440, altura: 900, role: "desenvolvedor" },
  { nome: "46-subtarefa-painel", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 1300, role: "socio", clicar: 'button:has-text("Criar KV")' },
  { nome: "47-task-historico", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 900, role: "socio", clicar: '[role="tab"]:has-text("Histórico")' },

  // --- Sprint 3C: identidade, tela inicial e portais de clientes ---------
  { nome: "50-inicio-socio", rota: "/painel", largura: 1600, altura: 1100, role: "socio" },
  { nome: "51-inicio-colaborador", rota: "/painel", largura: 1600, altura: 900, role: "colaborador" },
  { nome: "52-inicio-escuro", rota: "/painel", largura: 1600, altura: 1100, role: "socio", tema: "escuro" },
  { nome: "53-inicio-celular", rota: "/painel", largura: 390, altura: 1100, role: "socio" },
  { nome: "54-sino", rota: "/painel", largura: 1600, altura: 900, role: "socio", clicar: 'button[aria-label^="Notificações"]' },
  { nome: "57-notas-fiscais", rota: "/painel/notas-fiscais", largura: 1440, altura: 700, role: "colaborador" },
  { nome: "59-portal-do-cliente-pela-equipe", rota: "/portal/mundo-verde", largura: 1400, altura: 1200, role: "socio-no-portal" },
  { nome: "59b-portal-escolha-pela-equipe", rota: "/portal", largura: 1400, altura: 700, role: "socio-no-portal" },
  { nome: "59c-portal-itens-pela-equipe", rota: "/portal/mundo-verde/itens", largura: 1400, altura: 1100, role: "socio-no-portal" },
  { nome: "59d-portal-configuracoes-pela-equipe", rota: "/portal/mundo-verde/configuracoes", largura: 1400, altura: 900, role: "socio-no-portal" },

  // --- Sprint 6: Full Days -----------------------------------------------
  { nome: "60-full-days-solicitar", rota: "/painel/full-days", largura: 1600, altura: 1200, role: "socio" },
  { nome: "61-full-days-matriz", rota: "/painel/full-days?aba=matriz", largura: 1700, altura: 900, role: "socio" },
  { nome: "62-full-days-relatorio", rota: "/painel/full-days?aba=relatorio", largura: 1600, altura: 1300, role: "socio" },
  { nome: "63-full-days-aprovacoes", rota: "/painel/full-days?aba=aprovacoes", largura: 1500, altura: 900, role: "socio" },
  { nome: "64-full-days-remarcar", rota: "/painel/full-days?aba=aprovacoes", largura: 1200, altura: 800, role: "socio", clicar: 'button:has-text("Preciso remarcar")' },
  { nome: "65-full-days-colaborador", rota: "/painel/full-days", largura: 1600, altura: 1200, role: "colaborador" },
  // A PROVA DO AJUSTE 03, e não uma tela bonita: clicar em 28/10, alcançar
  // novembro e clicar em 03/11. O Playwright rola sozinho para chegar no
  // segundo dia, que é o gesto exato que perdia a seleção quando o mês vivia
  // na URL e entrava no `key` do Suspense. Se a seleção não sobreviver, a
  // imagem sai com um dia só pintado — dá para ver.
  { nome: "65b-full-days-selecao-atravessa-mes", rota: "/painel/full-days", largura: 1600, altura: 1100, role: "colaborador",
    clicar: ['[data-dia="2026-10-28"]', '[data-dia="2026-11-03"]'] },
  { nome: "65c-full-days-375", rota: "/painel/full-days", largura: 375, altura: 1500, role: "colaborador",
    clicar: ['[data-dia="2026-10-28"]', '[data-dia="2026-11-03"]'] },
  { nome: "66-full-days-matriz-escuro", rota: "/painel/full-days?aba=matriz", largura: 1700, altura: 900, role: "socio", tema: "escuro" },
  // A aba de registrar periodo, e a PROVA de que ela e da gestao: a mesma
  // rota como colaborador tem que devolver 403. Uma imagem so mostraria a
  // tela existindo; sao as duas juntas que mostram quem a alcanca.
  { nome: "67a-full-days-registrar-periodo", rota: "/painel/full-days?aba=lancamentos", largura: 1600, altura: 1300, role: "socio" },
  { nome: "67b-full-days-registrar-403", rota: "/painel/full-days?aba=lancamentos", largura: 1200, altura: 700, role: "colaborador" },


  // --- Sprint 8: Financeiro ----------------------------------------------
  { nome: "72-financeiro-visao-geral", rota: "/painel/financeiro", largura: 1700, altura: 1500, role: "socio" },
  { nome: "73-financeiro-lancamentos", rota: "/painel/financeiro?aba=lancamentos", largura: 1700, altura: 1100, role: "socio" },
  { nome: "74-financeiro-novo-lancamento", rota: "/painel/financeiro?aba=lancamentos", largura: 1300, altura: 1100, role: "socio", clicar: 'button:has-text("Novo lançamento")' },
  { nome: "75-financeiro-contratos", rota: "/painel/financeiro?aba=contratos", largura: 1700, altura: 800, role: "socio" },
  { nome: "76-financeiro-relatorios", rota: "/painel/financeiro?aba=relatorios", largura: 1700, altura: 1400, role: "socio" },
  { nome: "77-financeiro-visao-geral-escuro", rota: "/painel/financeiro", largura: 1700, altura: 1500, role: "socio", tema: "escuro" },

  // --- Sprint 9: Academy e Recomendacoes ---------------------------------
  // A troca obrigatoria do primeiro acesso. Mora em (auth), entao nao passa
  // pelo login do prototipo -- e por isso e uma tela avulsa na lista.
  { nome: "05b-primeiro-acesso", rota: "/trocar-senha", largura: 900, altura: 700, role: "colaborador-primeiro-acesso" },

  { nome: "80-academy", rota: "/painel/academy", largura: 1600, altura: 1300, role: "socio" },
  { nome: "81-academy-colaborador", rota: "/painel/academy", largura: 1600, altura: 1200, role: "colaborador" },
  { nome: "82-academy-trilha", rota: "/painel/academy/t1", largura: 1500, altura: 1200, role: "colaborador" },
  // DUAS capturas para o material aberto, e nao uma com dois cliques: a lista
  // e sanfona de um so aberto por vez, entao o segundo clique fecha o
  // primeiro -- foi o que a imagem mostrou. Cada caminho tem a sua:
  //   83  -- video, que incorpora o player, e ja vem com anotacao escrita
  //          (campo vazio nao mostra que a anotacao e por material);
  //   83b -- artigo, o unico que cai no "Abrir em nova aba".
  { nome: "83-academy-material-aberto", rota: "/painel/academy/t1", largura: 1500, altura: 1500, role: "colaborador", clicar: 'button:has-text("Boas-vindas da Ana")' },
  { nome: "83b-academy-material-link", rota: "/painel/academy/t1", largura: 1500, altura: 1200, role: "colaborador", clicar: 'button:has-text("O caminho de uma demanda")' },
  { nome: "84-academy-gestao", rota: "/painel/academy?aba=gestao", largura: 1700, altura: 1400, role: "socio" },
  { nome: "85-academy-escuro", rota: "/painel/academy", largura: 1600, altura: 1300, role: "socio", tema: "escuro" },

  // O CALENDARIO FULL. A grade do mes e a Linha do Tempo sao o par que prova
  // o `diaNaGrade()`: a MESMA campanha de trinta dias aparece num dia so na
  // primeira e como barra longa na segunda. Uma imagem so nao mostraria isso.
  { nome: "90-calendario-mes", rota: "/painel/calendario", largura: 1600, altura: 1400, role: "socio" },
  { nome: "90b-calendario-mes-375", rota: "/painel/calendario", largura: 375, altura: 1500, role: "socio" },
  { nome: "91-calendario-linha", rota: "/painel/calendario?visao=linha", largura: 1700, altura: 1000, role: "socio" },
  { nome: "92-calendario-semana", rota: "/painel/calendario?visao=semana", largura: 1600, altura: 900, role: "socio" },
  { nome: "93-calendario-lista", rota: "/painel/calendario?visao=lista", largura: 1400, altura: 1300, role: "socio" },
  { nome: "94-calendario-evento", rota: "/painel/calendario?evento=ev-convencao", largura: 1600, altura: 1000, role: "socio" },
  { nome: "95-calendario-novo-evento", rota: "/painel/calendario", largura: 1500, altura: 1400, role: "socio",
    clicar: 'button:has-text("Novo evento")' },
  // O COLABORADOR FORA DO ATENDIMENTO nao tem "Novo evento": a imagem e o que
  // prova que a tela some com o botao em vez de oferecer um que o banco
  // recusa. Bruno e Design no prototipo.
  { nome: "96-calendario-colaborador", rota: "/painel/calendario", largura: 1500, altura: 900, role: "colaborador-social" },

  { nome: "97-metricas-producao", rota: "/painel/metricas", largura: 1500, altura: 1000, role: "socio" },
  { nome: "97b-metricas-producao-cliente", rota: "/painel/metricas?cliente=c0000000-0000-0000-0000-00000000000a&periodo=trimestre", largura: 1500, altura: 1000, role: "socio" },
  { nome: "98-metricas-tempo", rota: "/painel/metricas?aba=tempo", largura: 1500, altura: 1300, role: "socio" },
  { nome: "99-metricas-equipe", rota: "/painel/metricas?aba=equipe", largura: 1400, altura: 800, role: "socio" },
  { nome: "99b-metricas-qualidade", rota: "/painel/metricas?aba=qualidade", largura: 1400, altura: 700, role: "socio" },
  // A RENTABILIDADE E DO SOCIO. As duas imagens sao o par que prova a regra:
  // ele ve a aba, e o desenvolvedor abre a mesma rota e nao tem a aba na
  // barra. Uma so provaria que a tela desenha, nao que ela separa.
  { nome: "99c-metricas-rentabilidade", rota: "/painel/metricas?aba=rentabilidade&periodo=ano", largura: 1400, altura: 700, role: "socio" },
  { nome: "99d-metricas-desenvolvedor", rota: "/painel/metricas", largura: 1400, altura: 900, role: "desenvolvedor" },

  // A AUDITORIA, E ELA VEM EM PAR -- como as telas de perfil do Sprint 9.
  //
  // A primeira prova que a trilha aparece para o socio; a segunda prova que ela
  // NAO aparece no menu do desenvolvedor. So a primeira passaria numa tela que
  // parou de mostrar o item para todo mundo, e so a segunda passaria numa tela
  // que nunca existiu. O criterio e de mao dupla.
  { nome: "99e-auditoria-socio", rota: "/painel/auditoria", largura: 1500, altura: 1000, role: "socio" },
  { nome: "99f-painel-desenvolvedor-sem-auditoria", rota: "/painel", largura: 1440, altura: 900, role: "desenvolvedor" },
  { nome: "99e-metricas-375", rota: "/painel/metricas?aba=tempo", largura: 375, altura: 1600, role: "socio" },

  { nome: "99f-resumo-agencia", rota: "/painel/resumo-agencia", largura: 1500, altura: 1700, role: "socio" },
  { nome: "99g-resumo-agencia-375", rota: "/painel/resumo-agencia", largura: 375, altura: 2000, role: "socio" },

  { nome: "86-recomendacoes", rota: "/painel/recomendacoes", largura: 1600, altura: 1500, role: "socio" },
  // 375px: a grade de tres colunas vira UMA, e e a unica imagem que prova
  // isso -- no 1600 as tres colunas escondem o que acontece no celular, que
  // e onde a maior parte do feed e lida.
  { nome: "86b-recomendacoes-375", rota: "/painel/recomendacoes", largura: 375, altura: 1900, role: "socio" },
  // O PAINEL LATERAL, que e o que substituiu a pagina de detalhe. So clicando
  // se ve que o cartao inteiro abre o post com arte grande, comentarios e
  // thread -- a grade sozinha nao mostra onde a conversa foi parar.
  { nome: "86c-recomendacoes-painel", rota: "/painel/recomendacoes", largura: 1600, altura: 1300, role: "socio", clicar: 'button:has-text("Figma Slides")' },
  // OS DOIS VAZIOS, que sao telas diferentes e nao uma so: com filtro a saida
  // e "Limpar os filtros", sem filtro e o convite para postar. Um vazio que
  // manda limpar um filtro que ninguem pos e uma tela dando uma instrucao
  // impossivel.
  { nome: "86d-recomendacoes-sem-resultado", rota: "/painel/recomendacoes?busca=motion", largura: 1500, altura: 900, role: "socio" },
  { nome: "86e-recomendacoes-vazio", rota: "/painel/recomendacoes", largura: 1500, altura: 900, role: "socio", env: { PROTOTIPO_FEED_VAZIO: "1" } },
  { nome: "87-recomendacoes-postar", rota: "/painel/recomendacoes", largura: 1500, altura: 1200, role: "colaborador", clicar: 'button:has-text("O que você recomenda hoje?")' },
  { nome: "88-recomendacoes-curtidas", rota: "/painel/recomendacoes?ordem=curtidas", largura: 1600, altura: 1200, role: "colaborador" },
  // DOIS CLIQUES, e o primeiro nao e enfeite: "Remover" so existe DENTRO do
  // painel do post -- o cartao fechado mostra curtir e mais nada. Com um
  // clique so, esta tela saia ha sprints como o feed fechado, avisando "sem o
  // clique" no fim de uma rodada de noventa telas que ninguem le inteira.
  { nome: "88b-recomendacoes-remover", rota: "/painel/recomendacoes", largura: 1500, altura: 1100, role: "socio",
    clicar: ['button:has-text("Figma Slides")', 'button:has-text("Remover")'] },
  { nome: "89-recomendacoes-escuro", rota: "/painel/recomendacoes", largura: 1600, altura: 1500, role: "colaborador", tema: "escuro" },

  { nome: "11-componentes", rota: "/painel/dev/componentes", largura: 1440, altura: 1200, role: "socio" },
  { nome: "12-componentes-escuro", rota: "/painel/dev/componentes", largura: 1440, altura: 1200, role: "socio", tema: "escuro" },

  { nome: "13-acesso-negado-403", rota: "/403-exemplo", largura: 900, altura: 700 },
  { nome: "14-status-da-conexao", rota: "/status", largura: 1000, altura: 1000 },

  { nome: "15-portal", rota: "/portal", largura: 1280, altura: 1100 },
  { nome: "15b-portal-itens", rota: "/portal/itens", largura: 1280, altura: 1300 },
  { nome: "15c-portal-itens-urgente", rota: "/portal/itens?prazo=urgente", largura: 1280, altura: 900 },
  { nome: "15d-portal-configuracoes", rota: "/portal/configuracoes", largura: 1280, altura: 1500 },
  { nome: "16-portal-social-media", rota: "/portal/social-media", largura: 1360, altura: 1300 },
  { nome: "16d-portal-social-lista", rota: "/portal/social-media?visao=lista", largura: 1280, altura: 1200 },
  { nome: "16e-portal-post", rota: "/portal/social-media/p1", largura: 1280, altura: 2100 },
  { nome: "16f-portal-post-aprovado", rota: "/portal/social-media/p5", largura: 1280, altura: 1500 },
  { nome: "16g-portal-social-375", rota: "/portal/social-media", largura: 375, altura: 1400 },
  { nome: "16h-portal-post-375", rota: "/portal/social-media/p1", largura: 375, altura: 2000 },
  { nome: "20-portal-campanhas", rota: "/portal/campanhas", largura: 1280, altura: 900 },
  { nome: "20b-portal-campanha", rota: "/portal/campanhas/camp-wave", largura: 1280, altura: 1700 },
  { nome: "20c-portal-entregavel", rota: "/portal/campanhas/camp-wave/d-kv", largura: 1280, altura: 2000 },
  { nome: "20d-portal-campanhas-375", rota: "/portal/campanhas", largura: 375, altura: 1200 },
  { nome: "20e-portal-campanha-375", rota: "/portal/campanhas/camp-wave", largura: 375, altura: 2000 },
  { nome: "20f-nova-campanha", rota: "/painel/aprovacoes/campanhas/nova", largura: 1280, altura: 1500, role: "socio" },
  // COM A ARVORE POVOADA: a secao 4 vazia nao mostra o que este sprint muda
  // -- o responsavel e o prazo de cada peca, que e o que faz a campanha virar
  // uma demanda com etapas. Tres cliques em "Entregavel" e um em "Sub-item".
  { nome: "20k-nova-campanha-arvore", rota: "/painel/aprovacoes/campanhas/nova", largura: 1280, altura: 1900, role: "socio",
    clicar: ['button:has-text("Entregável")', 'button:has-text("Entregável")', 'button:has-text("Entregável")', 'button:has-text("Sub-item") >> nth=0'] },
  { nome: "20j-nova-campanha-375", rota: "/painel/aprovacoes/campanhas/nova", largura: 375, altura: 1900, role: "socio",
    clicar: ['button:has-text("Entregável")', 'button:has-text("Sub-item") >> nth=0'] },
  // A LISTA DA AGÊNCIA não tinha imagem, e foi onde o bug morava: "Nenhuma
  // campanha aberta" com campanha criada. A tela que o usuário olhou é
  // justamente esta, e sem ela no protótipo a correção ficava sem prova.
  { nome: "20g-aprovacoes-campanhas", rota: "/painel/aprovacoes", largura: 1280, altura: 900, role: "socio" },
  // A TELA DE PRODUCAO, com uma peca aberta: e onde a equipe sobe arquivo,
  // escreve a justificativa e manda ao cliente. Sem o clique, a imagem mostra
  // so a arvore fechada -- que e justamente o que ja existia.
  { nome: "20l-campanha-producao", rota: "/painel/aprovacoes/campanhas/camp-wave", largura: 1280, altura: 1300, role: "socio" },
  // COMO O COLABORADOR VE (0054): o modulo aparece para ele, o botao de abrir
  // campanha nao. E a imagem e a unica prova disso -- o build nao sabe quem
  // esta logado.
  { nome: "20n-campanhas-colaborador", rota: "/painel/aprovacoes", largura: 1280, altura: 900, role: "colaborador-social" },
  { nome: "20m-campanha-peca-aberta", rota: "/painel/aprovacoes/campanhas/camp-wave", largura: 1280, altura: 1700, role: "socio", clicar: 'button:has-text("KV")' },
  { nome: "20h-aprovacoes-campanhas-375", rota: "/painel/aprovacoes", largura: 375, altura: 1400, role: "socio" },
  // O DIALOGO DE APAGAR, aberto: a contagem do que vai junto e o campo que
  // exige o nome digitado so aparecem na imagem -- e e o que faz alguem parar.
  { nome: "20i-apagar-campanha", rota: "/painel/aprovacoes", largura: 1280, altura: 900, role: "socio", clicar: 'button:has-text("Apagar")' },
  { nome: "16b-portal-aprovacoes", rota: "/portal/aprovacoes", largura: 1280, altura: 1000 },
  { nome: "16c-portal-pedir-ajustes", rota: "/portal/aprovacoes", largura: 1100, altura: 800, clicar: 'button:has-text("Solicitar ajustes")' },
  { nome: "17-portal-escuro", rota: "/portal", largura: 1280, altura: 800, tema: "escuro" },

  { nome: "18-painel-celular", rota: "/painel", largura: 390, altura: 844, role: "socio" },
  { nome: "19-portal-celular", rota: "/portal", largura: 390, altura: 900 },
  { nome: "19b-portal-itens-375", rota: "/portal/itens", largura: 375, altura: 1100 },
];

const PORTA = 3100;
const RAIZ = path.resolve(import.meta.dirname, "..");
const SAIDA = path.join(RAIZ, "prototipos");

// O HTML renderizado de cada tela, ao lado das imagens. E o que
// `scripts/verificar-9.mjs` le: a imagem prova o layout, o HTML prova o TEXTO
// -- e criterio que diz "esta palavra nao aparece na tela" precisa de texto.
const SAIDA_HTML = path.join(SAIDA, "html");

/**
 * O MOTOR DA VARREDURA DE ACESSIBILIDADE (Sprint 16, Parte F).
 *
 * `axe-core` e dependencia DIRETA de desenvolvimento, e isso foi de proposito:
 * ele ja estava em `node_modules` como dependencia transitiva do
 * `eslint-plugin-jsx-a11y`, e uma checagem cujo motor chega por tabela de
 * outro pacote some no dia em que o `eslint-config-next` subir de versao --
 * sem erro, porque a checagem simplesmente nao encontra o arquivo.
 *
 * Por isso ela FALHA quando nao acha, em vez de pular. Uma varredura que nao
 * encontra o que rodar e termina verde afirma sobre telas que ninguem olhou --
 * a mesma regra do `verificar-9.mjs` sem os dumps.
 */
const AXE = path.join(RAIZ, "node_modules", "axe-core", "axe.min.js");

// A copia fica DENTRO do projeto, e nao em /tmp, por um motivo pratico: assim
// o Node acha node_modules subindo um nivel, do jeito que ele sempre resolve
// dependencias. Um link simbolico apontando para fora da raiz e recusado pelo
// compilador. A pasta e apagada no fim, e esta no .gitignore.
const COPIA = path.join(RAIZ, ".prototipo");

// O erro do servidor, acumulado. Fica FORA da copia, que e apagada no fim --
// o log de uma tela que quebrou e justamente o que se quer ler depois.
const LOG_DO_SERVIDOR = path.join(RAIZ, "prototipos", "servidor.log");

// Modulos reais -> versoes de exemplo, aplicados so na copia temporaria.
const SUBSTITUICOES = {
  "@/lib/auth/dal": ["./scripts/prototipo/dal.ts"],
  "@/lib/auth/portal-administrativo": ["./scripts/prototipo/portal-administrativo.ts"],
  "@/lib/supabase/diagnostico": ["./scripts/prototipo/diagnostico.ts"],
  "@/lib/dados/clientes": ["./scripts/prototipo/clientes.ts"],
  "@/lib/dados/equipe": ["./scripts/prototipo/equipe.ts"],
  "@/lib/dados/acessos": ["./scripts/prototipo/acessos.ts"],
  "@/lib/dados/tasks": ["./scripts/prototipo/tasks.ts"],
  "@/lib/dados/minhas-tasks": ["./scripts/prototipo/minhas-tasks.ts"],
  "@/lib/dados/workflows": ["./scripts/prototipo/workflows.ts"],
  "@/lib/dados/recorrencias": ["./scripts/prototipo/recorrencias.ts"],
  "@/lib/dados/aprovacoes": ["./scripts/prototipo/aprovacoes.ts"],
  "@/lib/dados/portal-aprovacoes": ["./scripts/prototipo/portal-aprovacoes.ts"],
  "@/lib/dados/portal": ["./scripts/prototipo/portal.ts"],
  "@/lib/dados/posts": ["./scripts/prototipo/posts.ts"],
  "@/lib/dados/social-media": ["./scripts/prototipo/social-media.ts"],
  "@/lib/dados/conteudo": ["./scripts/prototipo/conteudo.ts"],
  "@/lib/dados/campanhas": ["./scripts/prototipo/campanhas.ts"],
  "@/lib/dados/calendario": ["./scripts/prototipo/calendario.ts"],
  "@/lib/dados/notificacoes": ["./scripts/prototipo/notificacoes.ts"],
  "@/lib/dados/portais-de-clientes": ["./scripts/prototipo/portais-de-clientes.ts"],
  "@/lib/dados/home": ["./scripts/prototipo/home.ts"],
  "@/lib/dados/metricas": ["./scripts/prototipo/metricas.ts"],
  "@/lib/dados/auditoria": ["./scripts/prototipo/auditoria.ts"],
  "@/components/shared/atualizacao-ao-vivo": ["./scripts/prototipo/atualizacao-ao-vivo.tsx"],
  "@/lib/reports/weekly": ["./scripts/prototipo/weekly.ts"],
  "@/lib/dados/full-days": ["./scripts/prototipo/full-days.ts"],
  "@/lib/dados/financeiro": ["./scripts/prototipo/financeiro.ts"],
  "@/lib/dados/academy": ["./scripts/prototipo/academy.ts"],
  "@/lib/dados/recomendacoes": ["./scripts/prototipo/recomendacoes.ts"],
};

const log = (msg) => console.log(`  ${msg}`);

function executar(comando, args, opcoes = {}) {
  return new Promise((ok, falhou) => {
    const p = spawn(comando, args, { stdio: "pipe", ...opcoes });
    let saida = "";
    p.stdout?.on("data", (d) => (saida += d));
    p.stderr?.on("data", (d) => (saida += d));
    p.on("close", (codigo) =>
      codigo === 0 ? ok(saida) : falhou(new Error(`${comando} falhou:\n${saida.slice(-2500)}`)),
    );
  });
}

async function esperarNoAr(url, tentativas = 60, servidor) {
  for (let i = 0; i < tentativas; i++) {
    // Se o processo nem chegou a subir, esperar sessenta segundos so atrasa a
    // noticia. O motivo real esta aqui, e e ele que precisa aparecer.
    if (servidor?.falhouAoSubir) {
      throw new Error(`O servidor nao subiu: ${servidor.falhouAoSubir.message}`);
    }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.status < 500) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`O servidor nao respondeu em ${url}`);
}

/**
 * Acha o Chromium. O launch() padrao do Playwright resolve na maioria das
 * maquinas; em ambientes com PLAYWRIGHT_BROWSERS_PATH proprio, procuramos o
 * executavel na mao.
 */
async function abrirNavegador(chromium) {
  // O `locale: "pt-BR"` do newPage NAO alcanca o <input type="date">: o campo
  // e pintado pelo proprio Chromium, que le o formato do ambiente do processo,
  // nao da pagina. Sem isto a data sai 09/22/2026 nas imagens -- formato
  // americano numa tela que o usuario revisa para aprovar, o que faz parecer
  // bug do produto quando e so da captura. No navegador de quem usa, no
  // Brasil, o campo ja sai 22/09/2026.
  const ambiente = { ...process.env, LANG: "pt_BR.UTF-8", LC_ALL: "pt_BR.UTF-8" };

  try {
    return await chromium.launch({ env: ambiente });
  } catch (erro) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (base && existsSync(base)) {
      for (const pasta of readdirSync(base)) {
        const candidato = path.join(base, pasta, "chrome-linux", "chrome");
        if (existsSync(candidato)) {
          return chromium.launch({ executablePath: candidato, env: ambiente });
        }
      }
    }
    throw new Error(
      `Nao foi possivel abrir o Chromium. Instale com: npx playwright install chromium\n\n${erro.message}`,
    );
  }
}

/**
 * Perfis usados nas capturas.
 *
 * `funcao` existe porque perfil de acesso e funcao na agencia sao coisas
 * separadas, e o produto depende disso: um colaborador do Atendimento cria
 * task, um de Social Media nao. Sem os dois, nao daria para mostrar a
 * diferenca em imagem.
 */
const PERFIS = {
  socio: { role: "socio" },
  desenvolvedor: { role: "desenvolvedor" },
  colaborador: { role: "colaborador", funcao: "Atendimento" },
  "colaborador-social": { role: "colaborador", funcao: "Social Media" },
  // Quem acabou de ser cadastrado e ainda nao trocou a senha provisoria. E um
  // PERFIL e nao um parametro de tela porque o gerador ja sobe um servidor por
  // perfil -- assim nao inventa um mecanismo novo para uma tela so.
  "colaborador-primeiro-acesso": {
    role: "colaborador",
    funcao: "Atendimento",
    senhaProvisoria: true,
  },
  // A gestao abrindo /portal: ve a escolha de qual portal abrir, e nao o
  // portal do proprio cliente. Entra como PERFIL pela mesma razao do primeiro
  // acesso -- o gerador ja sobe um servidor por perfil.
  "socio-no-portal": { role: "socio", portalComoEquipe: true },
};

function subirServidor(perfil, extra = {}) {
  const { role, funcao, senhaProvisoria, portalComoEquipe } =
    PERFIS[perfil] ?? PERFIS.socio;

  // O binario pelo caminho, e nao `npx`: numa rodada de noventa telas, com o
  // Chromium e o servidor disputando memoria, o `spawn("npx", ...)` falhou com
  // ENOENT no quinto reinicio -- o npx precisa se resolver no PATH toda vez, e
  // sob pressao isso nao e garantido.
  //
  // O binario mora no node_modules do PROJETO, nao no da copia: a copia nao
  // instala nada, e resolve subindo um nivel (ela vive dentro da raiz, e e por
  // isso que funciona). Procurar dentro dela deixava esta busca sempre vazia e
  // o `npx` de volta -- um conserto que nao consertava nada.
  const daRaiz = path.join(RAIZ, "node_modules", ".bin", "next");
  const daCopia = path.join(COPIA, "node_modules", ".bin", "next");
  const binario = existsSync(daCopia) ? daCopia : existsSync(daRaiz) ? daRaiz : "npx";
  const argumentos =
    binario === "npx"
      ? ["next", "start", "--port", String(PORTA)]
      : ["start", "--port", String(PORTA)];

  const filho = spawn(binario, argumentos, {
    cwd: COPIA,
    // O ERRO DO SERVIDOR VAI PARA UM ARQUIVO, e nao para /dev/null.
    //
    // Com "ignore", uma pagina que estoura no servidor vira uma imagem da
    // tela "This page couldn't load" e mais nada -- a rodada termina verde,
    // a imagem sai, e o rastro que diria QUAL linha quebrou foi jogado fora.
    // Foi exatamente o que aconteceu com Gestao de Pessoas: o usuario levou
    // o 500 na producao e a imagem daqui mostrava o mesmo erro, sem causa.
    //
    // O `capturar` le a ponta deste arquivo quando a pagina volta 500, e o
    // resumo do fim imprime junto com o nome da tela.
    stdio: ["ignore", "ignore", openSync(LOG_DO_SERVIDOR, "a")],
    detached: true,
    env: {
      ...process.env,
      // O `extra` da tela vem DEPOIS do ambiente herdado, e e o que permite
      // uma tela pedir um estado que os dados de prototipo nao mostram por
      // conta propria -- o feed vazio das Recomendacoes e o primeiro caso.
      ...extra,
      PROTOTIPO_ROLE: role,
      PROTOTIPO_FUNCAO: funcao ?? "",
      PROTOTIPO_SENHA_PROVISORIA: senhaProvisoria ? "1" : "",
      PROTOTIPO_PORTAL_EQUIPE: portalComoEquipe ? "1" : "",
    },
  });

  // SEM ISTO, um `spawn` que falha derruba a rodada inteira por um caminho que
  // nenhum try alcanca: o 'error' de um ChildProcess sem tratador vira excecao
  // nao capturada e mata o processo -- o `finally` nao roda, a copia temporaria
  // fica para tras e as telas que faltavam se perdem sem o resumo dizer quais.
  // Foi exatamente o que aconteceu. Com o tratador, a falha vira um erro comum
  // que `esperarNoAr` reporta com o motivo.
  filho.on("error", (erro) => {
    filho.falhouAoSubir = erro;
  });

  return filho;
}

/** O tamanho atual do log, para ler so o que vier depois. */
function tamanhoDoLog() {
  try {
    return statSync(LOG_DO_SERVIDOR).size;
  } catch {
    return 0;
  }
}

/** As primeiras linhas uteis escritas no log a partir de `desde`. */
function rastroDesde(desde) {
  let texto = "";
  try {
    const fd = openSync(LOG_DO_SERVIDOR, "r");
    const tamanho = Math.max(0, tamanhoDoLog() - desde);
    const buffer = Buffer.alloc(tamanho);
    readSync(fd, buffer, 0, tamanho, desde);
    closeSync(fd);
    texto = buffer.toString("utf8");
  } catch {
    return "(sem log)";
  }

  // As linhas que interessam sao as do erro, nao o cabecalho do Next nem as
  // de requisicao. A primeira linha com "Error" ancora o resto.
  const linhas = texto.split("\n").filter((l) => l.trim());
  const inicio = linhas.findIndex((l) => /Error|error:|\bat\s/.test(l));
  return (inicio >= 0 ? linhas.slice(inicio) : linhas).slice(0, 12).join("\n      ");
}

function encerrar(servidor) {
  if (!servidor?.pid) return;
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ja encerrou */
  }
}

// ---------------------------------------------------------------------------

let servidor;

try {
  const { chromium } = await import("playwright");

  log("preparando a copia temporaria do projeto...");
  // O log comeca vazio: um rastro da rodada passada leria como desta.
  rmSync(LOG_DO_SERVIDOR, { force: true });
  await rm(COPIA, { recursive: true, force: true });
  await mkdir(COPIA, { recursive: true });
  await mkdir(SAIDA_HTML, { recursive: true });

  for (const item of ["src", "public", "scripts", "next.config.ts", "postcss.config.mjs", "package.json"]) {
    await cp(path.join(RAIZ, item), path.join(COPIA, item), { recursive: true });
  }

  // Rotas que existem so no prototipo, como a que dispara a tela de 403.
  await cp(path.join(RAIZ, "scripts", "prototipo", "extras"), path.join(COPIA, "src", "app"), {
    recursive: true,
  });

  // O proxy e carregado pelo Next por caminho fixo, e nao por apelido, entao a
  // substituicao dele e uma copia por cima. Sem isso /login redirecionaria
  // para /painel e as telas publicas nao dariam para fotografar.
  await cp(
    path.join(RAIZ, "scripts", "prototipo", "proxy-raiz.ts"),
    path.join(COPIA, "src", "proxy.ts"),
  );

  const tsconfig = JSON.parse(await readFile(path.join(RAIZ, "tsconfig.json"), "utf8"));
  tsconfig.compilerOptions.paths = { ...SUBSTITUICOES, ...tsconfig.compilerOptions.paths };
  await writeFile(path.join(COPIA, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  // O dominio .invalid nunca resolve, e de proposito: as poucas consultas que
  // escapam das substituicoes falham na hora, em vez de segurar a captura
  // esperando um servidor que nao existe.
  //
  // AS TRES DO DRIVE SAO DE MENTIRA E PRECISAM ESTAR AQUI. O botao "Criar no
  // Drive" so aparece quando `driveConfigurado()` responde sim, e ele nao
  // olha o conteudo -- so se as tres existem. Sem elas, a imagem do detalhe
  // da demanda sairia sem o botao e a conferencia visual seria de uma tela
  // que ninguem vai ver.
  //
  // Nada aqui chega ao Google: o clique nao e exercitado, e a chave nao e uma
  // chave. A de e-mail fica DE FORA de proposito -- `RESEND_API_KEY`
  // preenchida faria o envio ser tentado de verdade, e a trava que impede
  // isso e a do proximo bloco, nao esta.
  await writeFile(
    path.join(COPIA, ".env.local"),
    'NEXT_PUBLIC_SUPABASE_URL="https://exemplo.invalid"\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY="chave-de-exemplo"\n' +
      'GOOGLE_SERVICE_ACCOUNT_EMAIL="exemplo@exemplo.invalid"\n' +
      'GOOGLE_PRIVATE_KEY="nao-e-uma-chave"\n' +
      'GOOGLE_DRIVE_ID="pasta-de-exemplo"\n',
  );

  log("compilando...");
  await executar("npx", ["next", "build"], { cwd: COPIA });

  // Com filtro, a pasta e preservada: apagar levaria junto as telas que nao
  // foram pedidas, e o filtro existe justamente para nao regerar aquelas.
  if (!process.env.PROTOTIPO_SO) {
    await rm(SAIDA, { recursive: true, force: true });
  }
  let navegador = await abrirNavegador(chromium);

  // PROTOTIPO_SO=45,64 regera so as telas cujo nome contem um desses pedacos.
  //
  // Existe porque um seletor que morreu custa uma rodada inteira para ser
  // reconferido: dez minutos para ver duas imagens. Sem o filtro, a saida
  // barata e nao reconferir -- e foi assim que um seletor obsoleto sobreviveu
  // um sprint.
  //
  // A SAIDA NAO E APAGADA quando o filtro esta ligado: o `rm` de
  // `prototipos/` levaria junto as oitenta e poucas que nao foram pedidas.
  const filtro = (process.env.PROTOTIPO_SO ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const TELAS_A_TIRAR = filtro.length
    ? TELAS.filter((t) => filtro.some((p) => t.nome.includes(p)))
    : TELAS;

  if (filtro.length) {
    if (TELAS_A_TIRAR.length === 0) {
      throw new Error(`PROTOTIPO_SO=${filtro.join(",")} nao casou com nenhuma tela.`);
    }
    log(`so ${TELAS_A_TIRAR.length} tela(s): ${TELAS_A_TIRAR.map((t) => t.nome).join(", ")}`);
  }

  // Agrupa por perfil E PELO AMBIENTE PEDIDO, para reiniciar o servidor o
  // mínimo possível. O ambiente entra na chave porque ele muda o que o
  // servidor serve: duas telas do mesmo perfil com `env` diferente precisam
  // de dois servidores, e uma chave só de perfil daria a segunda imagem com
  // os dados da primeira -- sem erro nenhum.
  const chaveDo = (tela) =>
    `${tela.role ?? "socio"}|${JSON.stringify(tela.env ?? {})}`;
  const grupos = [...new Set(TELAS_A_TIRAR.map(chaveDo))];

  // Telas que nao sairam. A rodada segue mesmo assim -- e o resumo no fim diz
  // quais faltaram, para ninguem achar que `prototipos/` esta completo.
  const perdidas = [];

  // Telas que sairam, mas sem o clique que deveriam mostrar. Nao e falha da
  // rodada -- a imagem existe --, e por isso mesmo some no meio de noventa
  // linhas de log. Repetido no fim, vira uma lista curta que da para conferir.
  const semClique = [];

  // Telas que responderam 500. A imagem sai, e e a da pagina de erro -- por
  // isso elas viram lista propria, com o rastro do servidor junto.
  const quebradas = [];

  // ------------------------------------------------------------------------
  // VIOLACAO DE CSP, e ela e a razao de esta captura existir.
  //
  // Um Content-Security-Policy errado NAO derruba o build, nao aparece no
  // lint e nao quebra a pagina de um jeito obvio: ele bloqueia um recurso, o
  // navegador escreve uma linha no console, e a tela sai sem a fonte, sem o
  // estilo ou sem o websocket do Realtime. A imagem parece certa para quem
  // nao sabe o que deveria estar ali.
  //
  // E o mesmo modo de falha da classe de cor que o Tailwind nao conhece. A
  // diferenca e que aquela o `check:cores` pega lendo o codigo, e esta so
  // existe com um navegador de verdade carregando a pagina de verdade -- que
  // e exatamente o que este gerador ja faz noventa vezes por rodada.
  // ------------------------------------------------------------------------
  const violacoes = [];

  // ------------------------------------------------------------------------
  // ACESSIBILIDADE (Sprint 16, Parte F).
  //
  // O `eslint-plugin-jsx-a11y` ja roda no lint, e ele le JSX: pega o `img`
  // sem `alt` e o `onClick` numa `div`. O que ele NAO ve e a arvore montada --
  // dois elementos com o mesmo `id` vindos de componentes diferentes, um campo
  // cujo `label` aponta para um `id` que a renderizacao mudou, um botao que so
  // tem icone porque o texto ficou em `hidden`.
  //
  // Isso so existe com a pagina de pe, e a pagina de pe e exatamente o que
  // este gerador ja tem -- noventa vezes por rodada, nos cinco perfis.
  // ------------------------------------------------------------------------
  const acessibilidade = [];

  for (const grupo of grupos) {
    const doGrupo = TELAS_A_TIRAR.filter((t) => chaveDo(t) === grupo);
    const perfil = doGrupo[0].role ?? "socio";
    const extra = doGrupo[0].env ?? {};
    const comEnv = Object.keys(extra).length
      ? ` (${Object.keys(extra).join(", ")})`
      : "";

    log(`subindo o servidor como ${perfil}${comEnv}...`);
    servidor = subirServidor(perfil, extra);
    await esperarNoAr(`http://localhost:${PORTA}/login`, 60, servidor);

    for (const tela of doGrupo) {
      // Uma tela que estoura NAO derruba a rodada inteira, pela mesma razao
      // que um seletor que nao casa nao derruba: a rodada leva dez minutos, e
      // perde-la na tela 78 de 90 joga fora as 77 que ja tinham saido. O que
      // falhou vai para `perdidas` e aparece no resumo do fim, com codigo de
      // saida diferente de zero -- falta em silencio seria pior que a queda.
      try {
        await capturar(tela);
      } catch (erro) {
        perdidas.push(`${tela.nome}: ${erro.message.split("\n")[0]}`);
        log(`  ${tela.nome}.png  NAO SAIU (${erro.message.split("\n")[0]})`);
        // "Target page, context or browser has been closed" e o Chromium
        // morrendo (memoria, quase sempre). Sem reabrir, todas as telas
        // seguintes falhariam pelo mesmo motivo e o resumo culparia as
        // erradas.
        if (!navegador.isConnected()) {
          log("  o Chromium caiu; reabrindo...");
          navegador = await abrirNavegador(chromium);
        }
      }
    }

    encerrar(servidor);
    servidor = undefined;

    async function capturar(tela) {
      const pagina = await navegador.newPage({
        viewport: { width: tela.largura, height: tela.altura },
        deviceScaleFactor: 2,
        colorScheme: tela.tema === "escuro" ? "dark" : "light",
        locale: "pt-BR",
      });

      if (tela.menu) {
        await pagina.addInitScript(
          (estado) => localStorage.setItem("full-hub:menu", estado),
          tela.menu,
        );
      }

      // O console do navegador, so o que interessa. `pageerror` pega excecao
      // que escapou; `console` com type "error" pega a linha que o Chromium
      // escreve quando o CSP bloqueia alguma coisa.
      const doConsole = (texto) => {
        if (/Content Security Policy|Refused to (load|connect|execute|apply)/i.test(texto)) {
          violacoes.push({ tela: tela.nome, linha: texto.split("\n")[0].slice(0, 200) });
        }
      };
      pagina.on("console", (m) => {
        if (m.type() === "error") doConsole(m.text());
      });
      pagina.on("pageerror", (e) => doConsole(String(e.message ?? e)));

      const antesDoLog = tamanhoDoLog();
      const resposta = await pagina.goto(`http://localhost:${PORTA}${tela.rota}`, {
        waitUntil: "networkidle",
      });

      // UMA TELA QUE ESTOURA NO SERVIDOR NAO PODE SAIR VERDE. Ela vira uma
      // imagem da pagina "This page couldn't load", e sem esta checagem a
      // rodada termina dizendo "Pronto" -- com noventa imagens, ninguem abre
      // a que quebrou. O rastro sai do log do servidor, so a parte escrita
      // DEPOIS deste goto: o arquivo acumula a rodada inteira.
      if ((resposta?.status() ?? 200) >= 500) {
        quebradas.push({ nome: tela.nome, rastro: rastroDesde(antesDoLog) });
      }

      // Algumas telas só aparecem depois de um clique -- uma aba, um diálogo.
      // O app roda de verdade aqui, então o Radix responde normalmente.
      let faltou = null;
      if (tela.clicar) {
        // Uma lista de seletores quando a tela precisa de mais de um clique --
        // abrir a aba antes do dialogo, por exemplo.
        //
        // Um seletor que nao casa NAO derruba a geracao inteira: ele avisa e a
        // tela sai sem o clique. Uma rodada completa leva dez minutos, e
        // perde-la por causa de um nome de botao que mudou custa caro demais.
        //
        // DUAS TENTATIVAS, E ORCAMENTO LARGO. Com 8 segundos e uma tentativa
        // so, duas rodadas seguidas falhavam em telas DIFERENTES -- sinal de
        // que o limite era a maquina, nao o seletor. O servidor serve a rota
        // pela primeira vez enquanto o Chromium tira um screenshot em escala
        // 2, e a hidratacao chega depois do prazo. Um aviso que as vezes
        // aparece e pior que nenhum: ensina a ignorar todos, e foi assim que
        // um seletor morto de verdade (a aba "Financeiro Pessoal" de Meu
        // Perfil) sobreviveu um sprint inteiro.
        for (const passo of Array.isArray(tela.clicar) ? tela.clicar : [tela.clicar]) {
          let deu = false;
          for (const tentativa of [1, 2]) {
            try {
              await pagina.click(passo, { timeout: 15000 });
              await pagina.waitForTimeout(250);
              deu = true;
              break;
            } catch {
              // Entre as duas, deixa a pagina assentar: o que costuma faltar e
              // hidratacao, e ela chega sozinha.
              if (tentativa === 1) await pagina.waitForTimeout(1500);
            }
          }
          if (!deu) {
            faltou = passo;
            break;
          }
        }
        await pagina.waitForTimeout(400);
      }

      try {
        // `semRolagem` captura SO a janela, sem costurar a pagina inteira.
        //
        // POR QUE ISSO PRECISA EXISTIR: `fullPage` ROLA a pagina para montar a
        // imagem, e o Select do Radix FECHA AO ROLAR. O clique acontecia, a
        // lista abria, a rolagem fechava, e a imagem saia com o campo fechado
        // -- sem aviso nenhum, porque o clique tinha dado certo. Toda tela de
        // lista suspensa aberta era impossivel de conferir, e dava para olhar
        // a imagem e concluir que o componente estava quebrado.
        //
        // Dialogo nao sofre disso (nao fecha ao rolar), e por isso so as telas
        // de lista suspensa precisam da marca.
        await pagina.screenshot({
          path: path.join(SAIDA, `${tela.nome}.png`),
          fullPage: !tela.semRolagem,
        });

        // O HTML SAI JUNTO, e nao e sobra de depuracao.
        //
        // A imagem prova o layout e nada mais: ninguem le noventa PNGs atras
        // de uma palavra. Metade dos criterios do Sprint 9 diz o que a tela
        // NAO pode mostrar -- quiz, certificado, pontuacao --, e criterio que
        // diz "nao existe" so vale se alguem conferir toda vez.
        //
        // Com o HTML no disco, `scripts/verificar-9.mjs` varre o TEXTO
        // RENDERIZADO, nos dois perfis, sem subir servidor nenhum. E ele le o
        // que a pessoa ve: um `DateBadge` no codigo nao vira "badge" na tela,
        // e uma varredura de fonte acusaria o nome do componente.
        await writeFile(
          path.join(SAIDA_HTML, `${tela.nome}.html`),
          await pagina.content(),
          "utf8",
        );

        // ------------------------------------------------------------------
        // A VARREDURA, na pagina viva e DEPOIS do clique.
        //
        // Depois e o ponto: metade das telas so mostra o que interessa com um
        // dialogo aberto ou uma aba trocada, e e justamente em dialogo que os
        // problemas de foco e de rotulo aparecem. Varrer antes do clique seria
        // conferir a tela fechada e dizer que o dialogo esta bem.
        //
        // SO `serious` E `critical`. O corte existe para a lista ser lida: com
        // `moderate` junto, uma rodada traz dezenas de avisos de ordem de
        // titulo e a pessoa aprende a passar o olho -- e aprender a ignorar
        // esta lista e perder o `critical` que vier junto no mes que vem.
        // ------------------------------------------------------------------
        await pagina.addScriptTag({ content: await readFile(AXE, "utf8") });
        const achados = await pagina.evaluate(async () => {
          const r = await window.axe.run(document, {
            resultTypes: ["violations"],
            // O `region` reclama de todo conteudo fora de uma landmark, e o
            // que ele pega aqui e o portal do Radix -- o dialogo vive num
            // `div` no fim do `body`, por desenho da biblioteca. Um aviso que
            // a gente nao pode consertar e um aviso que ensina a ignorar.
            rules: { region: { enabled: false } },
          });
          return r.violations.flatMap((v) =>
            // UM ACHADO POR NÓ, até três por regra e por tela. Com um nó só,
            // duas causas na mesma tela viravam uma — e a segunda só aparecia
            // depois de a primeira ser consertada, numa rodada seguinte.
            v.nodes.slice(0, 3).map((n) => ({
              id: v.id,
              impacto: v.impact,
              descricao: v.help,
              quantos: v.nodes.length,
              exemplo: n.html?.slice(0, 120) ?? "",
            })),
          );
        });

        for (const a of achados) {
          if (a.impacto === "serious" || a.impacto === "critical") {
            acessibilidade.push({ tela: tela.nome, ...a });
          }
        }
      } finally {
        // Fecha mesmo quando o screenshot estoura. Sem isso, cada falha deixa
        // uma aba viva -- e memoria e justamente o que costuma derrubar o
        // Chromium no meio de uma rodada de noventa telas.
        await pagina.close().catch(() => {});
      }
      if (faltou) semClique.push(`${tela.nome}: ${faltou}`);
      log(faltou ? `  ${tela.nome}.png  (sem o clique: ${faltou})` : `  ${tela.nome}.png`);
    }
  }

  await navegador.close();

  if (semClique.length > 0) {
    console.error(`\n  ${semClique.length} tela(s) sairam SEM o clique:`);
    for (const linha of semClique) console.error(`    ${linha}`);
    console.error(
      "\n  Se o mesmo seletor falha em duas rodadas seguidas, ele morreu --\n  a tela mudou e a lista TELAS nao acompanhou.",
    );
  }

  // ------------------------------------------------------------------------
  // O RESULTADO DA ACESSIBILIDADE, agrupado por REGRA e não por tela.
  //
  // É a mesma razão do agrupamento das violações de CSP: um rótulo que falta
  // num componente compartilhado falta nas noventa telas, e noventa linhas
  // iguais escondem a nonagésima primeira — que é outra coisa.
  // ------------------------------------------------------------------------
  if (acessibilidade.length > 0) {
    const porRegra = new Map();
    for (const a of acessibilidade) {
      if (!porRegra.has(a.id)) porRegra.set(a.id, { ...a, telas: [], exemplos: new Set() });
      const r = porRegra.get(a.id);
      r.telas.push(a.tela);
      // ATÉ TRÊS EXEMPLOS DISTINTOS, e não um. Uma regra só pode ter várias
      // causas diferentes -- `color-contrast` acusou primeiro a assinatura da
      // barra lateral e, depois de consertada, uma frase da tela de login com
      // outro par de cores. Com um exemplo só, a segunda causa fica escondida
      // atrás da primeira e a pessoa conserta uma achando que acabou.
      if (a.exemplo) r.exemplos.add(a.exemplo);
    }

    console.error(`\n  ${porRegra.size} problema(s) de acessibilidade:`);
    for (const [id, a] of porRegra) {
      console.error(`    [${a.impacto}] ${id} — ${a.descricao}`);
      console.error(`      ${a.telas.length} tela(s): ${a.telas.slice(0, 6).join(", ")}${a.telas.length > 6 ? ", …" : ""}`);
      for (const ex of [...a.exemplos].slice(0, 3)) console.error(`      ex.: ${ex}`);
      if (a.exemplos.size > 3) console.error(`      (e mais ${a.exemplos.size - 3} trecho(s) diferentes)`);
    }
    console.error(
      "\n  Só `serious` e `critical` entram nesta lista. O corte existe para\n" +
        "  ela ser lida: com os avisos leves junto, ninguém lê nenhum.",
    );
    process.exitCode = 1;
  }

  if (violacoes.length > 0) {
    // AGRUPA POR LINHA, e nao por tela: um CSP que bloqueia a fonte bloqueia
    // em todas as noventa, e noventa linhas iguais escondem a nonagesima
    // primeira, que e outra coisa.
    const porLinha = new Map();
    for (const v of violacoes) {
      if (!porLinha.has(v.linha)) porLinha.set(v.linha, []);
      porLinha.get(v.linha).push(v.tela);
    }
    console.error(`\n  ${porLinha.size} violacao(oes) de CSP no navegador:`);
    for (const [linha, telas] of porLinha) {
      console.error(`    ${linha}`);
      console.error(`      em ${telas.length} tela(s): ${telas.slice(0, 3).join(", ")}${telas.length > 3 ? "..." : ""}`);
    }
    console.error(
      "\n  O CSP vive em next.config.ts. Uma diretiva faltando nao quebra o\n  build -- ela apaga um recurso da tela e escreve isto no console.",
    );
    process.exitCode = 1;
  }

  if (quebradas.length > 0) {
    console.error(`\n  ${quebradas.length} tela(s) responderam 500 -- a imagem e da pagina de erro:`);
    for (const q of quebradas) console.error(`    ${q.nome}\n      ${q.rastro}`);
    console.error(`\n  Log completo: ${path.relative(RAIZ, LOG_DO_SERVIDOR)}`);
    process.exitCode = 1;
  }

  if (perdidas.length > 0) {
    console.error(`\n  ${perdidas.length} tela(s) nao sairam:`);
    for (const linha of perdidas) console.error(`    ${linha}`);
    console.error("\n  As demais estao em prototipos/.\n");
    process.exitCode = 1;
  } else {
    console.log(`\n  Pronto. As imagens estao em prototipos/\n`);
  }

  // ------------------------------------------------------------------------
  // A VERIFICACAO DO SPRINT 9 RODA AQUI, e so na rodada COMPLETA.
  //
  // Ela le o HTML que acabou de sair, entao este e o unico instante em que os
  // dumps existem e estao frescos. Deixa-la como comando separado seria
  // deixa-la para quem lembrar -- e criterio que diz "esta palavra nao
  // aparece" so vale se alguem conferir toda vez.
  //
  // Numa rodada parcial (PROTOTIPO_SO) os dumps das outras telas sao de
  // antes, e a checagem estouraria por uma tela que ninguem pediu. Ela sabe
  // recusar isso; o que nao pode e virar aviso que a pessoa aprende a ignorar.
  // ------------------------------------------------------------------------
  if (!process.env.PROTOTIPO_SO) {
    const verificacao = spawn(process.execPath, [path.join(RAIZ, "scripts", "verificar-9.mjs")], {
      stdio: "inherit",
    });
    const codigo = await new Promise((resolve) => verificacao.on("close", resolve));
    if (codigo !== 0) process.exitCode = 1;
  }
} catch (erro) {
  console.error(`\n  Falhou: ${erro.message}\n`);
  process.exitCode = 1;
} finally {
  encerrar(servidor);
  // PROTOTIPO_MANTER_COPIA=1 preserva .prototipo/ para capturar o HTML das
  // telas (e montar a versao clicavel). Fora disso a copia sempre some.
  if (!process.env.PROTOTIPO_MANTER_COPIA) {
    await rm(COPIA, { recursive: true, force: true });
  } else {
    console.log(`  Copia preservada em ${COPIA} (PROTOTIPO_MANTER_COPIA).`);
  }
}
