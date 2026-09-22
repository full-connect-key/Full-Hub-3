/**
 * Monta a pagina unica do prototipo clicavel.
 *
 *   node scripts/prototipo-clicavel/gerar.mjs \
 *     <pacote.json> <saida.html> <abas.json> <dialogos.json> <opcoes.json>
 *
 * ATENCAO: o <script> desta pagina vive dentro de um template literal, entao
 * uma barra invertida se perde antes de chegar ao navegador. Nada de expressao
 * regular no script da pagina -- foi assim que /\\s+/ virou /s+/ uma vez.
 */
import { readFileSync, writeFileSync } from "node:fs";

const { css, blocoEscuro, telasHtml, modulos, visoes } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const abas = JSON.parse(readFileSync(process.argv[4], "utf8"));
const dialogos = JSON.parse(readFileSync(process.argv[5], "utf8"));
const opcoesDeSelect = JSON.parse(readFileSync(process.argv[6], "utf8"));

const pagina = `<title>Protótipo Full Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap">

<style>
/* ===== CSS compilado do app, exatamente como ele serve em produção ===== */
${css}

/* ===== Fontes: no app vêm do next/font; aqui, do Google Fonts ===== */
:root {
  --font-geist-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-geist-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ===== Tema: os mesmos tokens do app, nos três estados do visualizador ===== */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not(.tema-claro) { ${blocoEscuro} }
}
:root[data-theme="dark"] { ${blocoEscuro} }
:root.tema-escuro { ${blocoEscuro} }

html, body { background: var(--background); color: var(--foreground); }
body { margin: 0; font-family: var(--font-geist-sans); }

/* ===== Moldura do protótipo (não faz parte do app) ===== */
:root {
  --pv-bg: #0f1216;
  --pv-fg: #e9ecf2;
  --pv-muted: #98a1b0;
  --pv-line: #242a33;
  --pv-chip: #1a1f27;
  --pv-chip-ativo: #2b3341;
  --pv-accent: #6fb3c4;
  --pv-altura: 92px;
}

.tela[hidden] { display: none !important; }

/* A barra do protótipo é fixa no rodapé. Sem esta folga, o fim de uma
   página longa fica embaixo dela e não dá para clicar. */
body { padding-bottom: var(--pv-altura); }

.tela .min-h-dvh { min-height: calc(100dvh - var(--pv-altura)); }
/* O menu lateral ocupa a altura da janela. Sem descontar a barra, o botão de
   recolher fica embaixo dela e não dá para clicar. */
.tela .h-dvh { height: calc(100dvh - var(--pv-altura)); }

.moldura {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
  background: var(--pv-bg); color: var(--pv-fg);
  border-top: 1px solid var(--pv-line);
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  font-family: var(--font-geist-sans); font-size: 13px; line-height: 1.4;
}
.moldura-conteudo {
  margin: 0 auto; max-width: 1200px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
}
.moldura-marca {
  display: inline-flex; align-items: center; gap: 7px;
  font-weight: 600; letter-spacing: 0.02em; white-space: nowrap;
}
.moldura-marca::before {
  content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--pv-accent);
}
.moldura-nota { color: var(--pv-muted); }
.moldura-grupo { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.moldura-rotulo { color: var(--pv-muted); white-space: nowrap; }

.pv-botao {
  appearance: none; border: 1px solid var(--pv-line); background: var(--pv-chip);
  color: var(--pv-fg); border-radius: 7px; padding: 5px 10px; font: inherit;
  cursor: pointer; white-space: nowrap;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.pv-botao:hover { background: var(--pv-chip-ativo); }
.pv-botao:focus-visible { outline: 2px solid var(--pv-accent); outline-offset: 2px; }
.pv-direita { margin-left: auto; display: inline-flex; gap: 6px; }

@media (max-width: 720px) {
  :root { --pv-altura: 132px; }
  .moldura-nota { display: none; }
  .pv-direita { margin-left: 0; }
}

/* ===== Menu do avatar e gaveta: no app são Radix, que precisa do React ===== */
.pv-menu {
  position: fixed; z-index: 70; min-width: 220px;
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: 0 12px 34px rgb(0 0 0 / 0.18); padding: 4px;
}
.pv-menu button {
  display: flex; width: 100%; align-items: center; gap: 8px;
  background: none; border: 0; border-radius: calc(var(--radius) - 4px);
  padding: 7px 9px; font: inherit; font-size: 14px; color: inherit;
  cursor: pointer; text-align: left;
}
.pv-menu button:hover { background: var(--accent); color: var(--accent-foreground); }
.pv-menu hr { border: 0; border-top: 1px solid var(--border); margin: 4px -4px; }
.pv-menu .pv-cabecalho { padding: 8px 9px; font-size: 13px; }
.pv-menu .pv-cabecalho small { display: block; color: var(--muted-foreground); font-size: 12px; }

.pv-gaveta {
  position: fixed; inset: 0; z-index: 65; display: flex;
}
.pv-gaveta-fundo { position: absolute; inset: 0; background: rgb(0 0 0 / 0.45); border: 0; }
.pv-gaveta-painel {
  position: relative; width: 17rem; max-width: 85vw; height: 100%;
  background: var(--card); border-right: 1px solid var(--border);
  padding: 16px 12px; overflow-y: auto;
}

.pv-aviso {
  position: fixed; top: max(16px, env(safe-area-inset-top, 0px));
  left: 50%; transform: translateX(-50%); z-index: 70;
  width: min(360px, calc(100vw - 32px));
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.18); padding: 12px 14px; font-size: 13px;
}
.pv-aviso strong { display: block; margin-bottom: 3px; font-size: 14px; }
.pv-aviso span { color: var(--muted-foreground); }
@media (prefers-reduced-motion: no-preference) {
  .pv-aviso { animation: pv-entrar 180ms ease-out; }
  @keyframes pv-entrar { from { opacity: 0; transform: translate(-50%, -8px); } }
}
</style>

<div id="telas">
${telasHtml}
</div>

<div class="moldura">
  <div class="moldura-conteudo">
    <span class="moldura-marca">Protótipo</span>
    <span class="moldura-nota" id="pv-nota">Sprint 1 — telas reais, dados de exemplo.</span>

    <span class="moldura-grupo" id="pv-grupo-entrar">
      <span class="moldura-rotulo">Ver como</span>
      <button type="button" class="pv-botao" data-entrar="socio">Sócio</button>
      <button type="button" class="pv-botao" data-entrar="desenvolvedor">Desenvolvedor</button>
      <button type="button" class="pv-botao" data-entrar="colaborador">Colaborador</button>
      <button type="button" class="pv-botao" data-entrar="cliente">Cliente</button>
    </span>

    <span class="moldura-grupo" id="pv-grupo-logado" hidden>
      <button type="button" class="pv-botao" id="pv-outra-area">Tentar a outra área</button>
      <button type="button" class="pv-botao" id="pv-componentes">Vitrine de componentes</button>
      <button type="button" class="pv-botao" id="pv-inatividade">Simular 28 min parado</button>
    </span>

    <span class="pv-direita">
      <button type="button" class="pv-botao" id="pv-status">Status da conexão</button>
      <button type="button" class="pv-botao" id="pv-reiniciar">Reiniciar</button>
    </span>
  </div>
</div>

<script>
(function () {
  "use strict";

  var MODULOS = ${JSON.stringify(modulos)};

  // As abas do Radix desmontam o conteúdo inativo, então cada uma foi
  // capturada à parte, com clique de verdade no app rodando.
  var ABAS = ${JSON.stringify(abas)};

  // Board / Lista / Calendário: trocadas por botão, e não por link.
  var VISOES = ${JSON.stringify(visoes)};

  // O Radix só monta um diálogo quando ele abre; cada um foi capturado com
  // clique de verdade no app rodando, junto das opções de cada select.
  var DIALOGOS = ${JSON.stringify(dialogos)};
  var OPCOES_DE_SELECT = ${JSON.stringify(opcoesDeSelect)};

  var ROTULOS = {
    "/painel": "Home",
    "/painel/minhas-tasks": "Minhas Tasks",
    "/painel/gestao-tasks": "Gestão de Tasks",
    "/painel/calendario": "Calendário",
    "/painel/aprovacoes": "Aprovações e Conteúdo",
    "/painel/clientes": "Clientes",
    "/painel/equipe": "Equipe e Skills",
    "/painel/full-days": "Full Days",
    "/painel/financeiro": "Financeiro e NFs",
    "/painel/minhas-skills": "Minhas Skills",
    "/painel/diario": "Diário",
    "/painel/academy": "Academy",
    "/painel/recomendacoes": "Recomendações",
    "/painel/financeiro-pessoal": "Financeiro Pessoal",
    "/painel/perfil": "Meu perfil",
    "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111": "Gestão de Tasks",
    "/painel/clientes/c0000000-0000-0000-0000-00000000000a": "Clientes",
    "/painel/equipe/a0000000-0000-0000-0000-000000000003": "Equipe e Skills",
    "/painel/dev/componentes": "Componentes"
  };

  var USUARIOS = {
    socio:         { nome: "Ana Souza",   email: "socia@fullconnectkey.com.br", papel: "Sócio",         tela: "painel-socio" },
    desenvolvedor: { nome: "Diego Reis",  email: "dev@fullconnectkey.com.br",   papel: "Desenvolvedor", tela: "painel-desenvolvedor" },
    colaborador:   { nome: "Carla Nunes", email: "colab@fullconnectkey.com.br", papel: "Colaborador",   tela: "painel-colaborador" },
    cliente:       { nome: "Caio Alves",  email: "contato@clientealfa.com.br",  papel: "Cliente",       tela: "portal" }
  };
  var SENHA = "FullHub@2026";

  var CLASSES_ATIVAS = ["bg-brand/10", "text-brand", "font-medium"];
  var CLASSES_INATIVAS = ["text-muted-foreground", "hover:bg-accent", "hover:text-accent-foreground"];

  // O rótulo visível de um botão, sem a dica de atalho: "Nova task" e não
  // "Nova taskN", que é o que textContent devolve por causa do <kbd>N</kbd>.
  function rotuloDoBotao(botao) {
    var copia = botao.cloneNode(true);
    var dicas = copia.querySelectorAll("kbd");
    for (var i = 0; i < dicas.length; i++) dicas[i].remove();
    return copia.textContent.trim();
  }

  var telas = {};
  document.querySelectorAll(".tela").forEach(function (el) { telas[el.dataset.tela] = el; });

  var estado = { tela: "login", perfil: null, rota: "/painel" };

  // --- tema ---------------------------------------------------------------
  function alternarTema() {
    var raiz = document.documentElement;
    var escuro =
      raiz.classList.contains("tema-escuro") ||
      (!raiz.classList.contains("tema-claro") &&
        (raiz.getAttribute("data-theme") === "dark" ||
          (!raiz.hasAttribute("data-theme") &&
            window.matchMedia("(prefers-color-scheme: dark)").matches)));
    raiz.classList.toggle("tema-escuro", !escuro);
    raiz.classList.toggle("tema-claro", escuro);
  }

  // --- navegação ----------------------------------------------------------
  function mostrar(nome) {
    Object.keys(telas).forEach(function (n) { telas[n].hidden = n !== nome; });
    estado.tela = nome;
    fecharMenus();
    window.scrollTo(0, 0);
    atualizarMoldura();
  }

  function atualizarMoldura() {
    var logado = estado.perfil !== null;
    // "Entrar como" fica sempre visível: trocar de perfil é o que mais se faz
    // aqui, e escondê-lo obrigaria a sair e entrar de novo a cada troca.
    document.getElementById("pv-grupo-logado").hidden = !logado;
    document.getElementById("pv-nota").textContent = logado
      ? "Você está como " + USUARIOS[estado.perfil].papel + ". Dados de exemplo."
      : "Sprint 1 — telas reais, dados de exemplo.";
  }

  function telaDoPainel() {
    return estado.perfil && estado.perfil !== "cliente" ? telas[USUARIOS[estado.perfil].tela] : null;
  }

  function navegarNoPainel(href) {
    var painel = telaDoPainel();
    if (!painel || !MODULOS[href]) return;

    var principal = painel.querySelector("main");
    if (principal) principal.innerHTML = MODULOS[href];
    estado.rota = href;

    // Numa sub-rota (/painel/clientes/<id>) quem fica ativo no menu é o módulo
    // pai, como no app.
    var hrefDoMenu = href;
    Object.keys(MODULOS).forEach(function (rota) {
      if (rota !== "/painel" && href.indexOf(rota + "/") === 0 && rota.length < href.length) {
        hrefDoMenu = rota;
      }
    });

    painel.querySelectorAll('nav[aria-label="Módulos do painel"] a[href]').forEach(function (link) {
      var ativo = link.getAttribute("href") === hrefDoMenu;
      CLASSES_ATIVAS.forEach(function (c) { link.classList.toggle(c, ativo); });
      CLASSES_INATIVAS.forEach(function (c) { link.classList.toggle(c, !ativo); });
      if (ativo) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    var trilha = painel.querySelector('nav[aria-label="Trilha de navegação"] ol');
    if (trilha) {
      trilha.innerHTML =
        hrefDoMenu === "/painel"
          ? '<li class="shrink-0"><span class="font-medium">Painel</span></li>'
          : '<li class="shrink-0"><a href="/painel" class="text-muted-foreground hover:text-foreground transition-colors">Painel</a></li>' +
            '<li aria-hidden class="text-muted-foreground/60 shrink-0">›</li>' +
            '<li class="truncate font-medium">' + (ROTULOS[hrefDoMenu] || "") + "</li>";
    }

    fecharMenus();
    window.scrollTo(0, 0);
  }

  function entrar(perfil) {
    estado.perfil = perfil;
    if (perfil === "cliente") { mostrar("portal"); return; }
    mostrar(USUARIOS[perfil].tela);
    navegarNoPainel("/painel");
  }

  function sair(porInatividade) {
    estado.perfil = null;
    limparAvisos();
    limparAlertas();
    mostrar(porInatividade ? "login-expirado" : "login");
  }

  // --- alertas e avisos ---------------------------------------------------
  function clonarAlerta(variante, texto) {
    var base = telas["login-expirado"].querySelector('[data-slot="alert"]');
    if (!base) return null;
    var clone = base.cloneNode(true);
    clone.dataset.pvInjetado = "1";
    ["text-warning", "bg-warning/5", "border-warning/20"].forEach(function (c) {
      clone.classList.remove(c);
    });
    if (variante === "erro") clone.classList.add("text-destructive", "bg-destructive/5", "border-destructive/20");
    else clone.classList.add("text-success", "bg-success/5", "border-success/20");
    var descricao = clone.querySelector('[data-slot="alert-description"]');
    if (descricao) descricao.textContent = texto;
    return clone;
  }

  function limparAlertas() {
    document.querySelectorAll('[data-pv-injetado="1"]').forEach(function (el) { el.remove(); });
  }

  function mostrarAlerta(formulario, variante, texto) {
    limparAlertas();
    var alerta = clonarAlerta(variante, texto);
    if (alerta) formulario.insertBefore(alerta, formulario.firstChild);
  }

  function limparAvisos() {
    document.querySelectorAll(".pv-aviso").forEach(function (el) { el.remove(); });
  }

  function avisarInatividade() {
    limparAvisos();
    var caixa = document.createElement("div");
    caixa.className = "pv-aviso";
    caixa.setAttribute("role", "status");
    caixa.innerHTML =
      "<strong>Sua sessão vai expirar</strong><span>Por segurança, você sai automaticamente em 2 minutos sem uso. Mexa o mouse para continuar.</span>";
    document.body.appendChild(caixa);
  }

  // --- menus próprios (no app são Radix, que exige React) -----------------
  function fecharMenus() {
    document.querySelectorAll(".pv-menu, .pv-gaveta").forEach(function (el) { el.remove(); });
  }

  function abrirMenuDoUsuario(botao) {
    if (document.querySelector(".pv-menu")) { fecharMenus(); return; }
    var usuario = USUARIOS[estado.perfil] || USUARIOS.socio;
    var caixa = document.createElement("div");
    caixa.className = "pv-menu";
    caixa.innerHTML =
      '<div class="pv-cabecalho"><strong>' + usuario.nome + "</strong><small>" + usuario.email +
      "</small><small>" + usuario.papel + "</small></div><hr>" +
      (estado.perfil === "cliente"
        ? '<button type="button" data-acao="perfil-cliente">Meus dados</button>'
        : '<button type="button" data-acao="perfil">Meu perfil</button>') +
      '<button type="button" data-acao="tema">Alternar tema</button><hr>' +
      '<button type="button" data-acao="sair">Sair</button>';

    var caixaBotao = botao.getBoundingClientRect();
    document.body.appendChild(caixa);
    caixa.style.top = caixaBotao.bottom + 6 + "px";
    caixa.style.left = Math.max(8, caixaBotao.right - caixa.offsetWidth) + "px";

    caixa.addEventListener("click", function (evento) {
      var alvo = evento.target.closest("button[data-acao]");
      if (!alvo) return;
      var acao = alvo.dataset.acao;
      if (acao === "tema") { alternarTema(); return; }
      fecharMenus();
      if (acao === "perfil") navegarNoPainel("/painel/meu-perfil");
      if (acao === "perfil-cliente") mostrar("portal-configuracoes");
      if (acao === "sair") sair(false);
    });
  }

  function abrirGaveta() {
    var painel = telaDoPainel();
    if (!painel) return;
    fecharMenus();
    var gaveta = document.createElement("div");
    gaveta.className = "pv-gaveta";
    var fundo = document.createElement("button");
    fundo.className = "pv-gaveta-fundo";
    fundo.setAttribute("aria-label", "Fechar menu");
    var caixa = document.createElement("div");
    caixa.className = "pv-gaveta-painel";
    var nav = painel.querySelector('nav[aria-label="Módulos do painel"]');
    if (nav) caixa.appendChild(nav.cloneNode(true));
    gaveta.appendChild(fundo);
    gaveta.appendChild(caixa);
    document.body.appendChild(gaveta);
    fundo.addEventListener("click", fecharMenus);
  }

  // --- formulários --------------------------------------------------------
  function ligarLogin(tela) {
    var formulario = tela.querySelector("form");
    if (!formulario) return;
    formulario.addEventListener("submit", function (evento) {
      evento.preventDefault();
      var campos = formulario.querySelectorAll("input");
      var email = (campos[0] ? campos[0].value : "").trim().toLowerCase();
      var senha = campos[1] ? campos[1].value : "";
      var perfil = Object.keys(USUARIOS).find(function (p) { return USUARIOS[p].email === email; });

      if (!email || !senha) { mostrarAlerta(formulario, "erro", "Preencha e-mail e senha."); return; }
      if (!perfil || senha !== SENHA) { mostrarAlerta(formulario, "erro", "E-mail ou senha incorretos."); return; }
      limparAlertas();
      entrar(perfil);
    });
  }
  ligarLogin(telas["login"]);
  ligarLogin(telas["login-expirado"]);

  var formEsqueci = telas["esqueci"].querySelector("form");
  if (formEsqueci) {
    formEsqueci.addEventListener("submit", function (evento) {
      evento.preventDefault();
      var campo = formEsqueci.querySelector("input");
      if (!campo || !campo.value.trim()) { mostrarAlerta(formEsqueci, "erro", "Informe seu e-mail."); return; }
      mostrarAlerta(formEsqueci, "sucesso", "Se houver uma conta com esse e-mail, o link de redefinição chega em instantes.");
    });
  }

  var formRedefinir = telas["redefinir"].querySelector("form");
  if (formRedefinir) {
    formRedefinir.addEventListener("submit", function (evento) {
      evento.preventDefault();
      var campos = formRedefinir.querySelectorAll("input");
      var a = campos[0] ? campos[0].value : "";
      var b = campos[1] ? campos[1].value : "";
      if (a.length < 8) { mostrarAlerta(formRedefinir, "erro", "A senha precisa ter pelo menos 8 caracteres."); return; }
      if (a !== b) { mostrarAlerta(formRedefinir, "erro", "As duas senhas não são iguais."); return; }
      limparAlertas();
      entrar(estado.perfil || "socio");
    });
  }

  // --- cliques vindos da marcação do app ----------------------------------
  var DESTINOS = {
    "/login": "login",
    "/esqueci-senha": "esqueci",
    "/redefinir-senha": "redefinir",
    "/status": "status",
    "/portal": "portal",
    "/portal/social-media": "portal-social-media",
    "/portal/campanhas": "portal-campanhas",
    "/portal/configuracoes": "portal-configuracoes"
  };

  document.getElementById("telas").addEventListener("click", function (evento) {
    var link = evento.target.closest("a[href]");
    if (link) {
      evento.preventDefault();
      var href = link.getAttribute("href");
      if (MODULOS[href] && estado.perfil && estado.perfil !== "cliente") { navegarNoPainel(href); return; }
      if (DESTINOS[href]) mostrar(DESTINOS[href]);
      else if (href === "/" && estado.perfil) entrar(estado.perfil);
      return;
    }

    var aba = evento.target.closest('[role="tab"]');
    if (aba) {
      evento.preventDefault();
      var conteudoDaAba = (ABAS[estado.rota] || {})[aba.textContent.trim()];
      if (conteudoDaAba) {
        var principalDaAba = telaDoPainel() && telaDoPainel().querySelector("main");
        if (principalDaAba) {
          principalDaAba.innerHTML = conteudoDaAba;
          window.scrollTo(0, 0);
        }
      }
      return;
    }

    var botao = evento.target.closest("button");
    if (!botao) return;

    var textoDoBotao = rotuloDoBotao(botao);

    var rotuloAria = botao.getAttribute("aria-label") || "";
    for (var g = 0; g < GATILHOS.length; g++) {
      var gatilho = GATILHOS[g];
      if (gatilho.rota !== estado.rota) continue;

      var casou =
        (gatilho.texto && gatilho.texto === textoDoBotao) ||
        (gatilho.aria && rotuloAria.indexOf(gatilho.aria) === 0);

      if (casou) {
        evento.preventDefault();
        abrirDialogo(gatilho.dialogo);
        return;
      }
    }

    var visoesDaRota = VISOES[estado.rota];
    if (visoesDaRota && visoesDaRota[textoDoBotao]) {
      evento.preventDefault();
      var principalDaVisao = telaDoPainel() && telaDoPainel().querySelector("main");
      if (principalDaVisao) {
        principalDaVisao.innerHTML = visoesDaRota[textoDoBotao];
        window.scrollTo(0, 0);
      }
      return;
    }

    var rotulo = botao.getAttribute("aria-label") || botao.getAttribute("title") || "";

    if (rotulo === "Menu do usuário") { evento.preventDefault(); abrirMenuDoUsuario(botao); return; }
    if (rotulo === "Abrir menu") { evento.preventDefault(); abrirGaveta(); return; }
    if (rotulo === "Alternar entre tema claro e escuro") { evento.preventDefault(); alternarTema(); return; }
    if (rotulo === "Notificações") { evento.preventDefault(); return; }
    if (botao.textContent.indexOf("Recolher menu") !== -1) {
      evento.preventDefault();
      var raiz = document.documentElement;
      var proximo = raiz.dataset.menu === "recolhido" ? "expandido" : "recolhido";
      raiz.dataset.menu = proximo;
      try { localStorage.setItem("full-hub:menu", proximo); } catch (e) {}
      return;
    }
    var formulario = botao.closest("form");
    if (botao.type === "submit" && formulario && !formulario.querySelector("input")) {
      evento.preventDefault();
      sair(false);
    }
  });

  // Cliques na gaveta e nos menus, que vivem fora de #telas.
  document.body.addEventListener("click", function (evento) {
    var naGaveta = evento.target.closest(".pv-gaveta a[href]");
    if (naGaveta) {
      evento.preventDefault();
      var href = naGaveta.getAttribute("href");
      fecharMenus();
      if (MODULOS[href]) navegarNoPainel(href);
    }
  });

  // --- moldura ------------------------------------------------------------
  document.querySelectorAll("[data-entrar]").forEach(function (botao) {
    botao.addEventListener("click", function () { entrar(botao.dataset.entrar); });
  });
  document.getElementById("pv-outra-area").addEventListener("click", function () { mostrar("negado"); });
  document.getElementById("pv-inatividade").addEventListener("click", function () {
    avisarInatividade();
    window.setTimeout(function () { if (estado.perfil) sair(true); }, 6000);
  });
  document.getElementById("pv-componentes").addEventListener("click", function () {
    // A vitrine fica fora do menu de propósito (é página de desenvolvimento),
    // então o atalho para ela mora aqui na moldura.
    if (estado.perfil === "cliente" || !estado.perfil) return;
    if (estado.perfil === "colaborador") { mostrar("negado"); return; }
    navegarNoPainel("/painel/dev/componentes");
  });
  document.getElementById("pv-status").addEventListener("click", function () { mostrar("status"); });
  document.getElementById("pv-reiniciar").addEventListener("click", function () {
    estado.perfil = null;
    limparAvisos();
    limparAlertas();
    document.documentElement.classList.remove("tema-escuro", "tema-claro");
    document.documentElement.dataset.menu = "expandido";
    mostrar("login");
  });

  telas["negado"].addEventListener("click", function (evento) {
    if (evento.target.closest("a")) {
      evento.preventDefault();
      if (estado.perfil) entrar(estado.perfil);
      else mostrar("login");
    }
  });

  // Estado inicial do menu, como no app.
  try {
    document.documentElement.dataset.menu =
      localStorage.getItem("full-hub:menu") === "recolhido" ? "recolhido" : "expandido";
  } catch (e) {
    document.documentElement.dataset.menu = "expandido";
  }

  // =======================================================================
  // DIÁLOGOS
  //
  // O Radix só monta o conteúdo de um diálogo quando ele abre, então o HTML
  // de cada um foi capturado à parte, com clique de verdade no app rodando.
  // Aqui eles são reinseridos e ligados: abrir, fechar, escolher em select,
  // validar o mínimo e mostrar o resultado da ação na lista.
  //
  // Nada disso grava em lugar nenhum -- o protótipo não tem banco. A linha
  // nova existe só enquanto a página estiver aberta. Serve para conferir o
  // caminho e os textos, não o funcionamento.
  // =======================================================================

  var CLIENTE_EXEMPLO = "/painel/clientes/c0000000-0000-0000-0000-00000000000a";
  var PESSOA_EXEMPLO = "/painel/equipe/a0000000-0000-0000-0000-000000000003";
  var TASK_EXEMPLO = "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111";
  var VITRINE_EXEMPLO = "/painel/gestao-tasks/77777777-7777-7777-7777-777777777777";

  var GATILHOS = [
    { rota: "/painel/equipe",      texto: "Adicionar colaborador",   dialogo: "colaborador-novo" },
    { rota: "/painel/clientes",    texto: "Novo cliente",            dialogo: "cliente-novo" },
    { rota: CLIENTE_EXEMPLO,       texto: "Editar",                  dialogo: "cliente-editar" },
    { rota: CLIENTE_EXEMPLO,       texto: "Desativar cliente",       dialogo: "cliente-desativar" },
    { rota: CLIENTE_EXEMPLO,       texto: "Excluir definitivamente", dialogo: "cliente-excluir" },
    { rota: CLIENTE_EXEMPLO,       texto: "Convidar usuário",        dialogo: "usuario-convidar" },
    { rota: PESSOA_EXEMPLO,        texto: "Desativar acesso",        dialogo: "pessoa-desativar" },
    { rota: PESSOA_EXEMPLO,        texto: "Desligar da equipe",      dialogo: "pessoa-desligar" },
    { rota: "/painel/gestao-tasks", texto: "Nova task",              dialogo: "task-nova" },
    { rota: "/painel/minhas-tasks", texto: "Nova task",              dialogo: "task-nova" },
    // Na lista o botao de concluir e so icone: casa pelo aria-label.
    { rota: "/painel/minhas-tasks", texto: "Concluir",               dialogo: "concluir-com-tempo" },
    { rota: "/painel/minhas-tasks", aria: "Concluir",                dialogo: "concluir-com-tempo" },
    { rota: "/painel/minhas-tasks", texto: "Enviar para aprovação",  dialogo: "enviar-aprovacao" },
    { rota: VITRINE_EXEMPLO,       texto: "Enviar para aprovação",  dialogo: "enviar-aprovacao" },
    { rota: TASK_EXEMPLO,          texto: "Criar KV",                dialogo: "subtarefa-painel" },
    { rota: "/painel/aprovacoes-internas", texto: "Solicitar ajustes", dialogo: "aprovacao-ajustes" },
    { rota: "/painel/workflows",   texto: "Novo tipo de tarefa",     dialogo: "tipo-novo" },
    { rota: "/portal/aprovacoes",  texto: "Solicitar ajustes",       dialogo: "cliente-pedir-ajustes" }
  ];

  var camadaDeDialogo = document.createElement("div");
  camadaDeDialogo.id = "pv-dialogos";
  camadaDeDialogo.hidden = true;
  document.body.appendChild(camadaDeDialogo);

  var dialogoAtual = null;
  var menuDeSelect = null;

  function fecharMenuDeSelect() {
    if (menuDeSelect) { menuDeSelect.remove(); menuDeSelect = null; }
  }

  function abrirDialogo(nome) {
    if (!DIALOGOS[nome]) return false;
    camadaDeDialogo.innerHTML =
      '<div class="fixed inset-0 z-50 bg-black/50" data-pv-fundo="1"></div>' + DIALOGOS[nome];
    camadaDeDialogo.hidden = false;
    dialogoAtual = nome;
    atualizarTravas();
    var primeiro = camadaDeDialogo.querySelector("input:not([type=hidden]):not([readonly])");
    if (primeiro) { try { primeiro.focus(); } catch (e) {} }
    return true;
  }

  function fecharDialogo() {
    fecharMenuDeSelect();
    camadaDeDialogo.hidden = true;
    camadaDeDialogo.innerHTML = "";
    dialogoAtual = null;
  }

  // --- avisos (o toast do app) --------------------------------------------
  function avisar(tipo, texto) {
    var pilha = document.getElementById("pv-toasts");
    if (!pilha) {
      pilha = document.createElement("div");
      pilha.id = "pv-toasts";
      pilha.style.cssText =
        "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;" +
        "display:flex;flex-direction:column;gap:8px;width:min(400px,calc(100vw - 32px));";
      document.body.appendChild(pilha);
    }
    var aviso = document.createElement("div");
    aviso.className = "rounded-lg px-4 py-3 text-sm shadow-lg";
    aviso.style.cssText =
      tipo === "erro"
        ? "background:var(--destructive);color:#fff;"
        : "background:var(--success);color:#fff;";
    aviso.textContent = texto;
    pilha.appendChild(aviso);
    window.setTimeout(function () { aviso.remove(); }, 4500);
  }

  // --- leitura dos campos --------------------------------------------------
  function valorDe(seletor) {
    var campo = camadaDeDialogo.querySelector(seletor);
    return campo ? String(campo.value || "").trim() : "";
  }

  function escolhaDe(seletor) {
    var gatilho = camadaDeDialogo.querySelector(seletor);
    if (!gatilho) return "";
    if (gatilho.dataset.pvValor) return gatilho.dataset.pvValor;
    if (gatilho.hasAttribute("data-placeholder")) return "";
    return gatilho.textContent.trim();
  }

  // Sem expressão regular de propósito: este script é montado dentro de um
  // template literal, e uma barra invertida se perde no caminho -- foi assim
  // que /\s+/ virou /s+/ e a inicial do avatar saiu com uma letra só.
  function pareceEmail(texto) {
    var arroba = texto.indexOf("@");
    if (arroba < 1) return false;
    if (texto.indexOf("@", arroba + 1) !== -1) return false;
    if (texto.indexOf(" ") !== -1) return false;
    var ponto = texto.lastIndexOf(".");
    return ponto > arroba + 1 && ponto < texto.length - 1;
  }

  function iniciais(nome) {
    var partes = nome.replace(/ /g, " ").trim().split(" ").filter(Boolean);
    var texto = (partes[0] || "").charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : "");
    return texto.toUpperCase();
  }

  function principal() {
    var tela = telaDoPainel();
    return tela ? tela.querySelector("main") : null;
  }

  // --- inserir a linha nova na lista --------------------------------------
  function clonarUltimaLinha() {
    var raiz = principal();
    var corpo = raiz && raiz.querySelector("tbody");
    if (!corpo || !corpo.lastElementChild) return null;
    var linha = corpo.lastElementChild.cloneNode(true);
    corpo.appendChild(linha);
    linha.scrollIntoView({ block: "center" });
    return linha;
  }

  function escreverNaCelula(linha, indice, texto) {
    var celula = linha.children[indice];
    if (celula) celula.textContent = texto || "—";
  }

  function acrescentarNaEquipe(pessoa) {
    var linha = clonarUltimaLinha();
    if (!linha) return;
    var avatar = linha.querySelector('[data-slot="avatar-fallback"]');
    if (avatar) avatar.textContent = iniciais(pessoa.nome);
    var link = linha.querySelector("a");
    if (link) { link.textContent = pessoa.nome; link.removeAttribute("href"); }
    var email = linha.querySelector("a + p");
    if (email) email.textContent = pessoa.email;
    escreverNaCelula(linha, 1, pessoa.cargo);
    escreverNaCelula(linha, 2, pessoa.area);
    escreverNaCelula(linha, 3, pessoa.funcao);
    var acesso = linha.children[4] && linha.children[4].querySelector('[data-slot="badge"]');
    if (acesso) acesso.textContent = pessoa.role;
    escreverNaCelula(linha, 5, "—");
  }

  function acrescentarNosClientes(empresa) {
    var linha = clonarUltimaLinha();
    if (!linha) return;
    var link = linha.querySelector("a");
    if (link) { link.textContent = empresa.nome; link.removeAttribute("href"); }
    var contatos = linha.children[1] ? linha.children[1].querySelectorAll("p") : [];
    if (contatos[0]) contatos[0].textContent = empresa.contato || "—";
    if (contatos[1]) contatos[1].textContent = empresa.email || "—";
    escreverNaCelula(linha, 2, empresa.telefone);
    escreverNaCelula(linha, 3, empresa.responsavel);
    var quantos = linha.children[4] && linha.children[4].querySelector("span");
    if (quantos) quantos.textContent = "0";
  }

  function acrescentarUsuarioDoCliente(pessoa) {
    var raiz = principal();
    var lista = raiz && raiz.querySelector("ul");
    if (!lista || !lista.lastElementChild) return;
    var item = lista.lastElementChild.cloneNode(true);
    var avatar = item.querySelector('[data-slot="avatar-fallback"]');
    if (avatar) avatar.textContent = iniciais(pessoa.nome);
    var textos = item.querySelectorAll("p");
    if (textos[0]) textos[0].textContent = pessoa.nome;
    if (textos[1]) textos[1].textContent = pessoa.email;
    if (textos[2]) textos[2].textContent = "Nunca acessou";
    lista.appendChild(item);
    item.scrollIntoView({ block: "center" });
  }

  function trocarSituacao(texto) {
    var raiz = principal();
    var cabecalho = raiz && raiz.querySelector('[data-slot="badge"]');
    if (cabecalho) cabecalho.textContent = texto;
  }

  // --- o que cada confirmação faz -----------------------------------------
  var ACOES = {
    "enviar-aprovacao": function () {
      return { ok: "Enviada para aprovação — rodada 1. A gestão foi avisada." };
    },
    "aprovacao-ajustes": function () {
      var motivo = textoDaArea();
      if (!motivo) return { erro: "Diga o que precisa ser ajustado." };
      return { ok: "Ajustes solicitados. O responsável foi avisado." };
    },
    "cliente-pedir-ajustes": function () {
      var motivo = textoDaArea();
      if (!motivo) return { erro: "Diga o que precisa mudar." };
      return { ok: "Pedido de ajustes enviado." };
    },
    "tipo-novo": function () {
      var nome = valorDe("#tipo-nome");
      if (nome.length < 2) return { erro: "Dê um nome ao tipo de tarefa." };
      return { ok: 'Tipo "' + nome + '" criado. Já dá para escolher ao abrir uma task.' };
    },
    "colaborador-novo": function () {
      var nome = valorDe("#colab-nome");
      var email = valorDe("#colab-email");
      var funcao = escolhaDe("#colab-funcao");
      if (nome.length < 2) return { erro: "Informe o nome completo." };
      if (!pareceEmail(email)) return { erro: "Esse e-mail não parece válido." };
      if (!funcao) return { erro: "Escolha a função da pessoa na agência." };
      acrescentarNaEquipe({
        nome: nome, email: email,
        cargo: valorDe("#colab-cargo"),
        area: escolhaDe("#colab-area"),
        funcao: funcao,
        role: escolhaDe("#colab-role") || "Colaborador"
      });
      return { ok: nome + " foi criada e recebeu o e-mail para definir a senha." };
    },
    "cliente-novo": function () {
      var nome = valorDe("#nome_empresa");
      if (nome.length < 2) return { erro: "Informe o nome da empresa." };
      var responsavel = escolhaDe("#responsavel");
      acrescentarNosClientes({
        nome: nome,
        contato: valorDe("#nome_contato"),
        email: valorDe("#email_contato"),
        telefone: valorDe("#telefone"),
        responsavel: responsavel === "Sem responsável definido" ? "—" : responsavel
      });
      return { ok: "Cliente cadastrado." };
    },
    "cliente-editar": function () {
      if (valorDe("#nome_empresa").length < 2) return { erro: "Informe o nome da empresa." };
      return { ok: "Cliente atualizado." };
    },
    "cliente-desativar": function () {
      trocarSituacao("Inativo");
      return { ok: "Mundo Verde foi desativada. Ela sai das listas e dos seletores, e nada foi apagado." };
    },
    "usuario-convidar": function () {
      var nome = valorDe("#convite-nome");
      var email = valorDe("#convite-email");
      if (nome.length < 2) return { erro: "Informe o nome de quem vai acessar." };
      if (!pareceEmail(email)) return { erro: "Esse e-mail não parece válido." };
      acrescentarUsuarioDoCliente({ nome: nome, email: email });
      return { ok: nome + " foi convidada e recebeu o e-mail para definir a senha." };
    },
    "pessoa-desativar": function () {
      trocarSituacao("Desligado");
      return { ok: "Carla Nunes foi desativada e não consegue mais entrar. O histórico dela continua." };
    },
    "pessoa-desligar": function () {
      if (!escolhaDe("#destino-da-transferencia")) {
        return { erro: "Há 3 tasks em aberto. Escolha para quem transferir antes de continuar." };
      }
      return { proximo: "pessoa-desligar-2" };
    },
    "pessoa-desligar-2": function () {
      var digitado = valorDe("#confirmacao-do-nome");
      if (digitado !== "Carla Nunes") {
        return { erro: "O nome digitado não confere com o cadastro." };
      }
      trocarSituacao("Desligado");
      return { ok: "Carla Nunes foi desligada. O histórico continua com o nome dela." };
    },
    "task-nova": function () {
      if (valorDe("#task-titulo").length < 2) return { erro: "Dê um título para a task." };
      return { ok: "Task criada." };
    },
    "concluir-com-tempo": function () {
      return { ok: "Feito. Menos uma para hoje." };
    }
  };

  // Dois botões nascem travados no app, e a trava é parte da regra que
  // interessa validar: "Continuar" só libera depois de escolher para quem
  // transferir, e o desligamento só libera com o nome completo digitado.
  var TRAVAS = {
    "pessoa-desligar": function () { return !!escolhaDe("#destino-da-transferencia"); },
    "pessoa-desligar-2": function () { return valorDe("#confirmacao-do-nome") === "Carla Nunes"; },
    // Pedir ajustes sem dizer o que ajustar nao ajuda ninguem -- e o banco
    // recusa a rodada sem comentario. A trava aqui reproduz a regra.
    "aprovacao-ajustes": function () { return textoDaArea().length > 0; },
    "cliente-pedir-ajustes": function () { return textoDaArea().length > 0; }
  };

  function textoDaArea() {
    var area = camadaDeDialogo.querySelector("textarea");
    return area ? area.value.trim() : "";
  }

  function atualizarTravas() {
    var trava = TRAVAS[dialogoAtual];
    var botoes = camadaDeDialogo.querySelectorAll("button[disabled], button[data-pv-travado]");
    for (var i = 0; i < botoes.length; i++) {
      var botao = botoes[i];
      if (CONFIRMACOES.indexOf(rotuloDoBotao(botao)) === -1) continue;
      botao.dataset.pvTravado = "1";
      if (!trava || trava()) botao.removeAttribute("disabled");
      else botao.setAttribute("disabled", "");
    }
  }

  var CONFIRMACOES = [
    "Criar e enviar convite", "Cadastrar cliente", "Salvar alterações", "Desativar",
    "Reativar", "Enviar convite", "Continuar", "Criar task", "Desligar Carla Nunes",
    "Concluir", "Pular",
    // Sprint 3B
    "Enviar", "Enviar ao cliente", "Solicitar ajustes", "Esta etapa não gera arquivo",
    "Salvar tipo de tarefa", "Salvar", "Enviar pedido", "Aprovar"
  ];

  // --- cliques dentro da camada de diálogo ---------------------------------
  camadaDeDialogo.addEventListener("click", function (evento) {
    if (evento.target.closest("[data-pv-fundo]")) { fecharDialogo(); return; }

    var gatilhoDeSelect = evento.target.closest('[data-slot="select-trigger"]');
    if (gatilhoDeSelect) {
      evento.preventDefault();
      if (menuDeSelect && menuDeSelect.dataset.de === gatilhoDeSelect.id) { fecharMenuDeSelect(); return; }
      abrirMenuDeSelect(gatilhoDeSelect);
      return;
    }
    fecharMenuDeSelect();

    var botao = evento.target.closest("button");
    if (!botao) return;
    evento.preventDefault();

    var texto = rotuloDoBotao(botao);
    if (texto === "Cancelar" || texto === "Fechar" || texto === "Voltar" || texto === "") {
      fecharDialogo();
      return;
    }

    if (CONFIRMACOES.indexOf(texto) === -1) return;

    var acao = ACOES[dialogoAtual];
    var resultado = acao ? acao() : { ok: "Pronto." };

    if (resultado.erro) { avisar("erro", resultado.erro); return; }
    if (resultado.proximo) { abrirDialogo(resultado.proximo); return; }

    fecharDialogo();
    avisar("ok", resultado.ok);
  });

  function abrirMenuDeSelect(gatilho) {
    fecharMenuDeSelect();
    var opcoes = (OPCOES_DE_SELECT[dialogoAtual] || {})[gatilho.id] || [];
    if (!opcoes.length) return;

    var caixa = document.createElement("div");
    caixa.dataset.de = gatilho.id;
    caixa.className = "bg-popover text-popover-foreground rounded-md border shadow-md";
    caixa.style.cssText = "position:fixed;z-index:70;max-height:16rem;overflow-y:auto;padding:4px;";
    var area = gatilho.getBoundingClientRect();
    caixa.style.left = Math.round(area.left) + "px";
    caixa.style.top = Math.round(Math.min(area.bottom + 4, window.innerHeight - 200)) + "px";
    caixa.style.minWidth = Math.round(area.width) + "px";

    opcoes.forEach(function (rotulo) {
      var item = document.createElement("div");
      item.className =
        "hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-pointer " +
        "items-center rounded-sm py-1.5 pr-8 pl-2 text-sm select-none";
      item.textContent = rotulo;
      item.addEventListener("click", function (evento) {
        evento.stopPropagation();
        var alvo = gatilho.querySelector('[data-slot="select-value"]') || gatilho.querySelector("span");
        if (alvo) alvo.textContent = rotulo;
        gatilho.removeAttribute("data-placeholder");
        gatilho.dataset.pvValor = rotulo;
        fecharMenuDeSelect();
        atualizarTravas();
      });
      caixa.appendChild(item);
    });

    document.body.appendChild(caixa);
    menuDeSelect = caixa;
  }

  camadaDeDialogo.addEventListener("input", atualizarTravas);

  document.addEventListener("keydown", function (evento) {
    if (evento.key !== "Escape") return;
    if (menuDeSelect) { fecharMenuDeSelect(); return; }
    if (dialogoAtual) fecharDialogo();
  });

  mostrar("login");
})();
</script>`;

writeFileSync(process.argv[3], pagina);
console.log("pagina:", (pagina.length / 1024).toFixed(0), "KB");
