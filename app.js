// ==========================================
// IZA no Cordel 2.0 — app.js (FULL FIX + QUALITY JUMP + UX PATCHES + REGISTRO EM 3 ETAPAS)
//
// Registro em Planilha (Apps Script):
// - stage "init": DATA/HORA + ESCRITOR/A + EMAIL + MUNICÍPIO + ESTADO (+ origem junto)
// - stage "choice": atualiza TRILHA + PERSONALIDADE DO BOT
// - stage "final": grava REGISTRO DOS ESCRITOS (transcript)
//
// Regras de coleta:
// - Município: campo aberto (texto)
// - Estado: UF do Brasil (AC..TO) + opção "INTERNACIONAL"
// - Origem: "Oficina Cordel 2.0" ou "Particular" (enviado como `origem` e pode ser guardado junto ao estado pelo script)
//
// UX PATCHES (AGORA):
// - Cabeçalho mostra nome humano (IZA Calorosa / IZA Firme / etc) + nome do participante
// - Barra de progresso (iniciante/intermediaria) + indicador na inspirada
// - Navegação Voltar/Avançar para REVER o prompt anterior (sem mostrar texto do usuário)
// - Transição com micro-delay + fade (menos instantâneo)
//
// OBS (pedido do Carlos):
// - Voltar NÃO permite editar nem ver o texto do usuário; é só para rever a última tela/prompt.
// ==========================================

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbx2CDkA7TVIFNu8dsnMgEg2_WjYq8-Yntu_NoV89UE8rVdioFJZbT6cjbGCDNP7brrk/exec";

const MIN_INSPIRED_ROUNDS = 7;

// -------------------- STATE --------------------
const state = {
  name: "",
  email: "",
  municipio: "",
  estadoUF: "", // "BA", "MG", ... ou "INTERNACIONAL"
  origem: "", // "Oficina Cordel 2.0" | "Particular"

  presenceKey: null, // "A"|"B"|"C"|"D"|"H"
  presence: null,
  presenceMix: null, // {A,B,C,D} se híbrido
  trackKey: null,
  stepIndex: 0,
  inspiredRounds: 0,

  // envio final
  sent: false,
  sessionId: null,
  startedAtISO: null,
  pageURL: "",
  turns: [],
  centerType: null, // "pergunta"|"afirmacao"|"ferida"|"desejo"|"livre"

  // para tela final
  finalDraft: "",
  registerStatus: "idle", // idle|sending|sent|failed
  registerError: "",

  // registro em 3 etapas
  registerInitDone: false,
  registerChoiceDone: false,
  registerFinalDone: false,

  // UX: histórico de telas (para voltar/avançar só para VER)
  viewHistory: [], // [{type:'prompt'|'iza'|'final'|'presence'|'welcome'|'presence_test', payload:{...}}]
  viewIndex: -1,
  viewMode: false,
  stepLocked: false,
  transitionMs: 220
};

function newSessionId() {
  return (
    "iza-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}
function nowISO() {
  return new Date().toISOString();
}

// -------------------- UI HELPERS --------------------
function el(id) {
  return document.getElementById(id);
}
function render(html) {
  el("app").innerHTML = html;
}
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function pushTurn(role, text, meta = {}) {
  state.turns.push({
    role,
    text,
    meta: {
      t: nowISO(),
      track: state.trackKey,
      step: state.stepIndex,
      presence: state.presenceKey,
      ...meta
    }
  });
}

// -------------------- UX PATCH HELPERS --------------------
function ensureBaseStyles() {
  if (document.getElementById("izaUxStyles")) return;
  const style = document.createElement("style");
  style.id = "izaUxStyles";
  style.textContent = `
    .iza-fade { opacity: 0; transform: translateY(2px); transition: opacity .18s ease, transform .18s ease; }
    .iza-fade.is-in { opacity: 1; transform: translateY(0); }
    .iza-top { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .iza-sub { opacity:.75; font-size:.92rem; margin-top:.15rem; }
    .iza-progress { height:8px; background: rgba(0,0,0,.08); border-radius:999px; overflow:hidden; margin:.65rem 0 0 0; }
    .iza-progress > div { height:100%; width:0%; background: rgba(0,0,0,.35); border-radius:999px; transition: width .22s ease; }
    .iza-nav { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.75rem; }
    .button.secondary { background: rgba(0,0,0,.10); color: inherit; }
    .button:disabled { opacity:.55; cursor:not-allowed; }
    .iza-hint { opacity:.7; font-size:.9rem; margin-top:.5rem; }
    .iza-chip { display:inline-block; padding:.15rem .5rem; border-radius:999px; background: rgba(0,0,0,.08); font-size:.82rem; opacity:.9; }
    .iza-row { display:flex; gap:.5rem; flex-wrap:wrap; }
    .iza-field { width:100%; padding:10px; margin-top:8px; margin-bottom:8px; border:1px solid #ccc; border-radius:8px; font-size:14px; background:#fff; }
    .iza-radio { display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.25rem; }
    .iza-radio label { display:flex; align-items:center; gap:.35rem; padding:.35rem .55rem; border:1px solid rgba(0,0,0,.12); border-radius:999px; cursor:pointer; }
  `;
  document.head.appendChild(style);
}

function firstName(full) {
  const t = String(full || "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}

function izaDisplayName() {
  if (state.presence?.name) return state.presence.name; // "IZA Calorosa" etc.
  return "IZA";
}

function userDisplayName() {
  const fn = firstName(state.name);
  return fn ? fn : "Você";
}

function trackTotalSteps(trackKey) {
  const t = TRACKS[trackKey];
  if (!t) return 1;
  return (t.steps || []).length;
}

function progressPct(trackKey, stepIndex) {
  if (trackKey === "inspirada") return null; // conversa aberta
  const total = trackTotalSteps(trackKey);
  const current = Math.min(total, Math.max(1, stepIndex + 1));
  return Math.round((current / total) * 100);
}

function progressLabel(trackKey, stepIndex) {
  if (trackKey === "inspirada") {
    const r = Math.max(0, state.inspiredRounds || 0);
    return r ? `Rodada ${r}` : "Conversa aberta";
  }
  const total = trackTotalSteps(trackKey);
  return `Etapa ${Math.min(total, stepIndex + 1)} de ${total}`;
}

function renderCardShell(innerHtml) {
  return `<div class="card iza-fade" id="izaView">${innerHtml}</div>`;
}

function mountFadeIn() {
  const node = document.getElementById("izaView");
  if (!node) return;
  requestAnimationFrame(() => node.classList.add("is-in"));
}

function safeTransition(nextFn) {
  if (state.stepLocked) return;
  state.stepLocked = true;

  const node = document.getElementById("izaView");
  if (node) node.classList.remove("is-in");

  setTimeout(() => {
    try {
      nextFn();
    } finally {
      state.stepLocked = false;
      setTimeout(mountFadeIn, 0);
    }
  }, state.transitionMs);
}

// ---------- VIEW HISTORY (Voltar/Avançar para VER) ----------
function pushView(entry) {
  if (state.viewIndex < state.viewHistory.length - 1) {
    state.viewHistory = state.viewHistory.slice(0, state.viewIndex + 1);
  }
  state.viewHistory.push(entry);
  state.viewIndex = state.viewHistory.length - 1;
}

function enterViewMode() {
  state.viewMode = true;
}

function exitViewMode() {
  state.viewMode = false;
  state.viewIndex = state.viewHistory.length - 1;
  renderFromHistory(); // agora vai renderizar “ao vivo” com canSend/canContinue true
}

function canGoBack() {
  return state.viewHistory.length > 0 && state.viewIndex > 0;
}

function canGoForward() {
  return state.viewHistory.length > 0 && state.viewIndex < state.viewHistory.length - 1;
}

function goBackView() {
  if (!canGoBack()) return;
  enterViewMode();
  state.viewIndex -= 1;
  renderFromHistory();
}

function goForwardView() {
  if (!canGoForward()) return;
  state.viewIndex += 1;
  if (state.viewIndex === state.viewHistory.length - 1) state.viewMode = false;
  renderFromHistory();
}

function renderHistoryNav(extraHtml = "") {
  const backDisabled = canGoBack() ? "" : "disabled";
  const fwdDisabled = canGoForward() ? "" : "disabled";
  const replayTag = state.viewMode ? `<span class="iza-chip">Revisão</span>` : "";
  return `
    <div class="iza-nav">
      <button class="button secondary" id="btnHistBack" ${backDisabled}>Voltar</button>
      <button class="button secondary" id="btnHistFwd" ${fwdDisabled}>Avançar</button>
      ${state.viewMode ? `<button class="button" id="btnHistLive">Retomar</button>` : ""}
      ${extraHtml || ""}
      <div style="margin-left:auto;align-self:center;">${replayTag}</div>
    </div>
  `;
}

function bindHistoryNavHandlers() {
  const b1 = document.getElementById("btnHistBack");
  const b2 = document.getElementById("btnHistFwd");
  const b3 = document.getElementById("btnHistLive");

  if (b1) b1.onclick = () => safeTransition(goBackView);
  if (b2) b2.onclick = () => safeTransition(goForwardView);
  if (b3) b3.onclick = () => safeTransition(exitViewMode);
}

function renderFromHistory() {
  const entry = state.viewHistory[state.viewIndex];
  if (!entry) return;

  const isLive = !state.viewMode && state.viewIndex === state.viewHistory.length - 1;

  if (entry.type === "prompt") {
    const payload = { ...entry.payload, canSend: isLive };
    return renderPromptScreen(payload, true);
  }

  if (entry.type === "iza") {
    const payload = { ...entry.payload, canContinue: isLive };
    return renderIzaScreen(payload, true);
  }

  if (entry.type === "presence") return renderPresenceResultScreen(entry.payload, true);
  if (entry.type === "presence_test") return renderPresenceTestScreen(entry.payload, true);
  if (entry.type === "welcome") return renderWelcomeScreen(entry.payload, true);
  if (entry.type === "final") return renderFinalScreen(entry.payload, true);
}

// -------------------- BR UF LIST --------------------
const BR_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

function normalizeUFOrInternational(x) {
  const s = String(x || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "INTERNACIONAL" || s === "INT" || s === "INTL") return "INTERNACIONAL";
  if (s.indexOf("INTERNAC") !== -1 || s.indexOf("INTERNAT") !== -1) return "INTERNACIONAL";
  const two = s.replace(/[^A-Z]/g, "").slice(0, 2);
  if (BR_UFS.includes(two)) return two;
  if (BR_UFS.includes(s)) return s;
  return "INTERNACIONAL";
}

function normalizeOrigem(x) {
  const s = String(x || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("oficina") || s.includes("cordel")) return "Oficina Cordel 2.0";
  if (s.includes("part")) return "Particular";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -------------------- PRESENCES --------------------
const PRESENCES = {
  A: {
    key: "A",
    name: "IZA Discreta",
    mirror: "short",
    maxQuestions: 1,
    softeners: ["", "Se fizer sentido,", "Talvez,", "Ok,"],
    closings: ["", "Pode seguir.", "Quando quiser, continue."]
  },
  B: {
    key: "B",
    name: "IZA Calorosa",
    mirror: "short",
    maxQuestions: 1,
    softeners: ["Entendi.", "Tô com você.", "Certo.", "Obrigado por dizer isso."],
    closings: ["Se quiser, a gente ajusta.", "Pode seguir.", "Estou aqui com você."]
  },
  C: {
    key: "C",
    name: "IZA Firme",
    mirror: "medium",
    maxQuestions: 2,
    softeners: ["Vamos focar.", "Certo.", "Ok. Vamos organizar."],
    closings: ["Responda direto.", "Vamos para a próxima.", "Siga com clareza."]
  },
  D: {
    key: "D",
    name: "IZA Minimalista",
    mirror: "tiny",
    maxQuestions: 1,
    softeners: [""],
    closings: ["Continue.", "Siga.", ""]
  }
};

function presenceMessage(p) {
  if (!p) return "";
  if (p.key === "H") {
    const mix = state.presenceMix || {};
    const parts = Object.entries(mix)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
      .join(" · ");
    return `Hoje sua IZA será híbrida (${parts}). Um equilíbrio entre acolhimento, estrutura e silêncio — conforme seu jeito de escrever.`;
  }
  const base = {
    A: "Vou te acompanhar de forma leve, com poucas interferências.",
    B: "Vou te acompanhar com proximidade e acolhimento, sem te tirar do seu texto.",
    C: "Vou te acompanhar com estrutura e direção clara para organizar suas ideias.",
    D: "Vou ficar quase invisível: pouco ruído e mais espaço pra você escrever."
  };
  return (base[p.key] || "") + " Podemos ajustar isso quando quiser.";
}

// -------------------- HYBRID PRESENCE --------------------
function normalizeMix(counts) {
  const sum = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const k of ["A", "B", "C", "D"]) out[k] = (counts[k] || 0) / sum;
  return out;
}

function weightedPick(arrA, arrB, arrC, arrD, mix) {
  const pool = [];
  const add = (arr, w) => {
    const n = Math.max(0, Math.round(w * 10));
    for (let i = 0; i < n; i++) pool.push(...arr);
  };
  add(arrA || [], mix.A || 0);
  add(arrB || [], mix.B || 0);
  add(arrC || [], mix.C || 0);
  add(arrD || [], mix.D || 0);
  if (!pool.length) return "";
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildHybridPresence(mix) {
  const mirror =
    (mix.C || 0) >= 0.35 ? "medium" : (mix.D || 0) >= 0.45 ? "tiny" : "short";
  const maxQuestions = (mix.C || 0) >= 0.35 ? 2 : 1;

  return {
    key: "H",
    name: "IZA Híbrida",
    mirror,
    maxQuestions,
    softeners: [
      ...PRESENCES.A.softeners,
      ...PRESENCES.B.softeners,
      ...PRESENCES.C.softeners
    ],
    closings: [
      ...PRESENCES.A.closings,
      ...PRESENCES.B.closings,
      ...PRESENCES.C.closings,
      ...PRESENCES.D.closings
    ]
  };
}

function pick(arr) {
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function presenceWrap(p, coreText) {
  const mix = state.presenceMix;
  let soft = "";
  let close = "";

  if (p.key === "H" && mix) {
    soft =
      weightedPick(
        PRESENCES.A.softeners,
        PRESENCES.B.softeners,
        PRESENCES.C.softeners,
        PRESENCES.D.softeners,
        mix
      ) || "";
    close =
      weightedPick(
        PRESENCES.A.closings,
        PRESENCES.B.closings,
        PRESENCES.C.closings,
        PRESENCES.D.closings,
        mix
      ) || "";
  } else {
    soft = pick(p.softeners || [""]);
    close = pick(p.closings || [""]);
  }

  const minimalNow =
    p.key === "D" || (p.key === "H" && (state.presenceMix?.D || 0) > 0.60);

  if (minimalNow) return coreText.trim();

  const prefix = soft ? soft + " " : "";
  const suffix = close ? "\n" + close : "";
  return (prefix + coreText + suffix).trim();
}

// -------------------- ELIZA ENGINE --------------------
const IZA_ENGINE = { memory: [], usedRecently: [] };

const pronounPairs = [
  [/\beu\b/gi, "você"],
  [/\bmim\b/gi, "você"],
  [/\bmeu\b/gi, "seu"],
  [/\bminha\b/gi, "sua"],
  [/\bmeus\b/gi, "seus"],
  [/\bminhas\b/gi, "suas"],
  [/\bcomigo\b/gi, "com você"],
  [/\bvocê\b/gi, "eu"],
  [/\bseu\b/gi, "meu"],
  [/\bsua\b/gi, "minha"],
  [/\bseus\b/gi, "meus"],
  [/\bsuas\b/gi, "minhas"]
];

function swapPronouns(text) {
  let out = String(text || "");
  const reps = pronounPairs.map((p) => p[1]);
  pronounPairs.forEach(([re], i) => {
    out = out.replace(re, `__P${i}__`);
  });
  reps.forEach((rep, i) => {
    out = out.replaceAll(`__P${i}__`, rep);
  });
  return out;
}

function shortMirror(presence, userText) {
  const t = (userText || "").trim();
  if (!t) return presence.key === "D" ? "Continue." : "Pode seguir.";
  const words = t.split(/\s+/);

  if (presence.mirror === "tiny") {
    const w = words.slice(0, 6).join(" ");
    return `“${swapPronouns(w)}—”`;
  }
  if (presence.mirror === "short") {
    const w = words.slice(0, 10).join(" ");
    return `Você está dizendo: “${swapPronouns(w)}—”.`;
  }
  const w = words.slice(0, 16).join(" ");
  return `Você parece estar dizendo: “${swapPronouns(w)}—”.`;
}

function applyReasmb(template, match) {
  let out = template;
  for (let i = 1; i < match.length; i++) {
    const chunk = swapPronouns((match[i] || "").trim());
    out = out.replaceAll(`{${i}}`, chunk);
  }
  return out;
}

function fallbackUserAnchor(userText) {
  const t = (userText || "").trim();
  if (!t) return "isso que você trouxe";
  const slice = t.split(/\s+/).slice(0, 10).join(" ");
  return swapPronouns(slice);
}

function ensureMeaningfulTemplateText(text, userText) {
  let out = String(text || "").trim();
  if (!out) return "";

  const anchor = fallbackUserAnchor(userText);

  out = out
    .replace(/“\s*—/g, `“${anchor}—`)
    .replace(/"\s*—/g, `“${anchor}—`)
    .replace(/\?\s*—/g, `“${anchor}—`)
    .replace(/''/g, `“${anchor}—`)
    .replace(/""/g, `“${anchor}—`);

  const onlyPunctuation = /^[\s.,;:!?()[\]{}'"`´—-]+$/;
  if (onlyPunctuation.test(out)) {
    return `Falando em “${anchor}—”, o que você quer aprofundar agora?`;
  }

  return out;
}

const EXTERNAL_RULES = Array.isArray(window.IZA_RULES) ? window.IZA_RULES : [];

function getExternalRulesForPresence(p, mix) {
  if (typeof window.getIZARulesFor === "function") {
    const rules = window.getIZARulesFor(p?.key, mix || null);
    if (Array.isArray(rules) && rules.length) return rules;
  }
  return EXTERNAL_RULES;
}

function stripMd(text) {
  return String(text || "").replace(/\*\*(.*?)\*\*/g, "$1").trim();
}

function interpolateRuleTemplate(template, match, userText) {
  let out = stripMd(template);
  const captures = Array.isArray(match) ? match.slice(1) : [];
  const primary =
    captures.find((c) => String(c || "").trim()) ||
    (match && match[0]) ||
    fallbackUserAnchor(userText);

  out = out.replaceAll(
    "{0}",
    swapPronouns(String(primary || "").trim() || fallbackUserAnchor(userText))
  );
  for (let i = 1; i < 10; i++) {
    const cap = swapPronouns(
      String(
        captures[i] ||
          captures[i - 1] ||
          primary ||
          fallbackUserAnchor(userText)
      ).trim()
    );
    out = out.replaceAll(`{${i}}`, cap);
  }
  return ensureMeaningfulTemplateText(out, userText);
}

function chooseHybridTone(mix) {
  if (!mix) return "discreta";
  if ((mix.D || 0) > 0.55) return "minimalista";
  if ((mix.C || 0) > 0.42) return "firme";
  if ((mix.B || 0) > 0.34) return "calorosa";
  return "discreta";
}

function toneByPresence(p, mix) {
  if (!p) return "discreta";
  if (p.key === "H") return chooseHybridTone(mix);
  if (p.key === "D") return "minimalista";
  if (p.key === "C") return "firme";
  if (p.key === "B") return "calorosa";
  return "discreta";
}

function adaptRuleByTrack(text) {
  const base = String(text || "").trim();
  if (!base) return base;

  if (state.trackKey === "iniciante") {
    if (/detalhe|cena|concreto|gesto/i.test(base)) return base;
    return base + " Traga um detalhe concreto (lugar + gesto).";
  }
  if (state.trackKey === "intermediaria") {
    if (/objetiv|1-2 frases|1 frase|duas frases/i.test(base)) return base;
    return base + " Responda de forma objetiva em 1-2 frases.";
  }
  if (state.trackKey === "inspirada") {
    if (/fluxo|livre|imagem|cena/i.test(base)) return base;
    return base + " Responda no fluxo, com imagem ou cena.";
  }
  return base;
}

function adaptRuleByPresence(text, p, mix) {
  const base = String(text || "").trim();
  if (!base) return base;

  const tone = toneByPresence(p, mix);
  if (tone === "minimalista") {
    const short = base.split(/[.!?]/)[0].trim();
    return (short || base).replace(/\s{2,}/g, " ") + "?";
  }
  if (tone === "firme") {
    return /^(Foco|Direto|Seja|Objetivo):/i.test(base) ? base : `Direto: ${base}`;
  }
  if (tone === "calorosa") {
    const prefix = pick(["Entendi. ", "Tô com você. ", "Obrigado por dividir isso. "]);
    return prefix + base;
  }
  return base;
}

function pickRuleResponse(responses) {
  const arr = Array.isArray(responses) ? responses.filter(Boolean) : [];
  if (!arr.length) return "";

  const recent = IZA_ENGINE.usedRecently || [];
  const pool = arr.filter((r) => !recent.includes(r));
  const chosen = pick(pool.length ? pool : arr);

  IZA_ENGINE.usedRecently.push(chosen);
  if (IZA_ENGINE.usedRecently.length > 12) IZA_ENGINE.usedRecently.shift();

  return chosen;
}

function shouldBeMinimalNow(p, mix) {
  return (
    p.key === "D" ||
    (p.key === "H" && (mix.D || 0) > 0.55 && Math.random() < (mix.D || 0)) ||
    ((mix.D || 0) > 0.5 && Math.random() < (mix.D || 0))
  );
}

const TRACK_RULE_WEIGHTS = {
  iniciante: {
    cena_imagem: 1.5,
    eu_sinto: 1.25,
    travado: 1.2,
    nao_consigo: 1.2,
    excesso: 1.1,
    estrutura_texto: 0.75,
    default: 0.55
  },
  intermediaria: {
    estrutura_texto: 1.55,
    definicao: 1.35,
    porque: 1.3,
    contraste: 1.25,
    excesso: 1.2,
    tempo: 1.15,
    cena_imagem: 0.85,
    default: 0.5
  },
  inspirada: {
    cena_imagem: 1.6,
    voz: 1.3,
    eu_sinto: 1.3,
    comparacao: 1.2,
    pergunta: 1.15,
    estrutura_texto: 0.7,
    default: 0.5
  }
};

const HYBRID_RULE_BIAS = {
  A: {
    boost: ["cena_imagem", "comparacao", "pergunta", "default"],
    down: ["estrutura_texto", "definicao"]
  },
  B: {
    boost: ["eu_sinto", "medo", "voz", "cuidado_diversidade", "nao_consigo", "travado"],
    down: ["estrutura_texto", "definicao"]
  },
  C: {
    boost: ["estrutura_texto", "definicao", "porque", "contraste", "excesso", "tempo"],
    down: ["default"]
  },
  D: {
    boost: ["excesso", "pergunta", "estrutura_texto"],
    down: ["default", "cena_imagem"]
  }
};

function hybridMixRuleWeight(ruleName, mix) {
  if (!mix || typeof mix !== "object") return 1;
  const safeMix = {
    A: Number(mix.A || 0),
    B: Number(mix.B || 0),
    C: Number(mix.C || 0),
    D: Number(mix.D || 0)
  };

  let multiplier = 1;
  for (const key of ["A", "B", "C", "D"]) {
    const w = safeMix[key];
    if (!w) continue;
    const bias = HYBRID_RULE_BIAS[key];
    if (!bias) continue;
    if (bias.boost.includes(ruleName)) multiplier += 0.45 * w;
    if (bias.down.includes(ruleName)) multiplier -= 0.35 * w;
  }

  return Math.max(0.35, Math.min(1.9, multiplier));
}

function presenceRuleWeight(ruleName, p, mix) {
  if (p && p.key === "H") {
    const tone = toneByPresence(p, mix);
    let base = 1;
    if (tone === "minimalista") {
      if (ruleName === "default") base = 0.45;
      else if (ruleName === "estrutura_texto") base = 0.9;
    } else if (tone === "firme") {
      if (["estrutura_texto", "definicao", "porque", "contraste", "excesso", "tempo"].includes(ruleName)) base = 1.2;
      else if (ruleName === "default") base = 0.45;
    } else if (tone === "calorosa") {
      if (["eu_sinto", "medo", "voz", "cuidado_diversidade", "nao_consigo", "travado"].includes(ruleName)) base = 1.2;
      else if (ruleName === "default") base = 0.55;
    } else if (ruleName === "default") {
      base = 0.65;
    }
    return Math.max(0.2, base * hybridMixRuleWeight(ruleName, mix));
  }

  const tone = toneByPresence(p, mix);
  if (tone === "minimalista") {
    if (ruleName === "default") return 0.45;
    if (ruleName === "estrutura_texto") return 0.85;
    return 1;
  }
  if (tone === "firme") {
    if (["estrutura_texto", "definicao", "porque", "contraste", "excesso", "tempo"].includes(ruleName)) return 1.3;
    if (ruleName === "default") return 0.4;
    return 1;
  }
  if (tone === "calorosa") {
    if (["eu_sinto", "medo", "voz", "cuidado_diversidade", "nao_consigo", "travado"].includes(ruleName)) return 1.3;
    if (ruleName === "default") return 0.5;
    return 1;
  }
  if (ruleName === "default") return 0.6;
  return 1;
}

function getRuleWeight(ruleName, p, mix, trackKey) {
  const byTrack = (TRACK_RULE_WEIGHTS[trackKey] && TRACK_RULE_WEIGHTS[trackKey][ruleName]) || 1;
  const byPresence = presenceRuleWeight(ruleName, p, mix);
  return Math.max(0.01, byTrack * byPresence);
}

function pickWeightedRule(candidates, p, mix) {
  const weighted = candidates
    .map((item) => {
      const w = getRuleWeight(item.rule?.name, p, mix, state.trackKey);
      return { ...item, weight: w };
    })
    .filter((item) => item.weight > 0);

  if (!weighted.length) return null;

  const total = weighted.reduce((acc, item) => acc + item.weight, 0);
  let r = Math.random() * total;
  for (const item of weighted) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return weighted[weighted.length - 1];
}

function runExternalRules(userText, p, mix) {
  const externalRules = getExternalRulesForPresence(p, mix);
  if (!externalRules.length) return "";

  const candidates = [];
  for (const rule of externalRules) {
    if (!rule || !(rule.pattern instanceof RegExp)) continue;
    const m = userText.match(rule.pattern);
    if (!m) continue;
    candidates.push({ rule, match: m });
  }

  const chosen = pickWeightedRule(candidates, p, mix);
  if (!chosen) return "";

  const raw = pickRuleResponse(chosen.rule.responses);
  if (!raw) return "";

  let qText = interpolateRuleTemplate(raw, chosen.match, userText);
  qText = adaptRuleByTrack(qText);
  qText = adaptRuleByPresence(qText, p, mix);
  return ensureMeaningfulTemplateText(qText, userText);
}

// -------------------- 12 RULES --------------------
const IZA_SCRIPT = [
  {
    key: /\b(fazer|fiz|tentei|criei|escrevi|busco|quero)\b/i,
    decomps: [
      {
        re: /.*\b(?:fiz|tentei|criei|escrevi|busco|quero)\b\s+(.*)$/i,
        reasmb: [
          "O que motivou esse seu agir sobre “{1}—”?",
          "Ao buscar “{1}—”, qual imagem surgiu primeiro?",
          "Como essa ação — “{1}—” — pode virar forma (verso, cena, confissão)?"
        ],
        memory: [
          "Voltando em “{1}—”: qual foi o primeiro passo concreto?",
          "O que você ganhou — e o que você arriscou — ao fazer “{1}—”?"
        ]
      }
    ]
  },
  {
    key: /\b(triste|feliz|difícil|confuso|importante|belo|feio)\b/i,
    decomps: [
      {
        re: /.*\b(triste|feliz|difícil|confuso|importante|belo|feio)\b(?:\s+(?:porque|pois)\s+)?(.*)$/i,
        reasmb: [
          "O que torna “{2}—” algo tão “{1}—”?",
          "Se “{2}—” deixasse de ser “{1}—”, o que sobraria?",
          "Como esse estado de ser “{1}—” aparece na sua escrita — em imagem ou ritmo?"
        ],
        memory: [
          "Dá um exemplo pequeno que mostre “{1}—” sem explicar.",
          "Qual palavra substituiria “{1}—” sem perder a verdade?"
        ]
      }
    ]
  },
  {
    key: /\b(família|casa|trabalho|rua|mundo|tempo|vida)\b/i,
    decomps: [
      {
        re: /.*\b(família|casa|trabalho|rua|mundo|tempo|vida)\b(.*)$/i,
        reasmb: [
          "Qual detalhe concreto de “{1}—” você quer salvar no texto?",
          "Como “{1}—” muda o ritmo do que você escreve?",
          "O que em “{1}—” ainda está guardado e não foi dito?"
        ],
        memory: ["Volta em “{1}—”: onde exatamente isso acontece (lugar/horário/pessoa)?"]
      }
    ]
  },
  {
    key: /\b(sinto|sentir|sentimento|dor|alegria)\b/i,
    decomps: [
      {
        re: /.*\b(?:sinto|sentir)\b\s+(.*)$/i,
        reasmb: [
          "Onde esse sentir — “{1}—” — se localiza na sua história?",
          "Essa emoção sobre “{1}—” ajuda ou trava sua autoria?",
          "Consegue descrever “{1}—” sem usar o nome do sentimento?"
        ],
        memory: ["Qual imagem carregaria “{1}—” sem dizer o nome dela?"]
      }
    ]
  },
  {
    key: /\b(não posso|não consigo|limite|bloqueio)\b/i,
    decomps: [
      {
        re: /.*\b(?:não consigo|não posso)\b\s+(.*)$/i,
        reasmb: [
          "Esse limite em “{1}—” é uma barreira real — ou uma precaução sua?",
          "O que mudaria no texto se você pudesse “{1}—”?",
          "Vamos olhar o outro lado de “{1}—”: o que é possível hoje, do jeito mínimo?"
        ],
        memory: ["Se fosse só 1% possível, como seria “{1}—” ?"]
      }
    ]
  },
  {
    key: /\b(sempre|nunca|todo|ninguém|todos)\b/i,
    decomps: [
      {
        re: /.*\b(sempre|nunca|ninguém|todos)\b(.*)$/i,
        reasmb: [
          "O que faz “{1}—” soar tão absoluto pra você aqui?",
          "Pensa numa exceção para “{1}{2}—”. Como ela soaria?",
          "Onde esse “{1}—” aparece hoje, agora, de modo concreto?"
        ],
        memory: ["Qual exceção pequena te faria respirar um pouco?"]
      }
    ]
  },
  {
    key: /\b(talvez|acho|parece|quem sabe)\b/i,
    decomps: [
      {
        re: /.*\b(?:talvez|acho|parece|quem sabe)\b\s+(.*)$/i,
        reasmb: [
          "Se você tivesse certeza sobre “{1}—”, o texto seria o mesmo?",
          "O que sustenta essa dúvida sobre “{1}—”?",
          "A incerteza sobre “{1}—” pode virar lugar de criação?"
        ],
        memory: ["Qual parte de “{1}—” você mais quer testar em palavras?"]
      }
    ]
  },
  {
    key: /\b(você|iza|máquina|computador)\b/i,
    decomps: [
      {
        re: /.*\b(?:você|iza|máquina|computador)\b\s*(.*)$/i,
        reasmb: [
          "Eu estou aqui para espelhar seu pensamento. O que “{1}—” revela sobre você?",
          "O que muda no seu texto quando você me usa como espelho?",
          "Como eu posso te ajudar a deixar “{1}—” mais claro em 1 frase?"
        ],
        memory: ["Você quer mais silêncio ou mais perguntas agora?"]
      }
    ]
  },
  {
    key: /\b(porque|pois|por causa)\b/i,
    decomps: [
      {
        re: /.*\b(?:porque|pois|por causa(?:\s+de)?)\b\s+(.*)$/i,
        reasmb: [
          "Essa razão — “{1}—” — é a única possível?",
          "Se não fosse por “{1}—”, que outra causa existiria?",
          "Como essa explicação muda sua voz no papel?"
        ],
        memory: ["Você prefere explicar “{1}—” ou mostrar em cena?"]
      }
    ]
  },
  {
    key: /\b(sonho|desejo|imagino|futuro)\b/i,
    decomps: [
      {
        re: /.*\b(?:sonho|desejo|imagino)\b\s+(.*)$/i,
        reasmb: [
          "Qual é a cor, som ou textura desse “{1}—”?",
          "Como “{1}—” projeta quem você é hoje?",
          "O que “{1}—” traz de novo para sua escrita?"
        ],
        memory: ["Qual micro-ação hoje aproxima “{1}—” ?"]
      }
    ]
  },
  {
    key: /\b(atrito|luta|conflito|problema)\b/i,
    decomps: [
      {
        re: /.*\b(?:atrito|luta|conflito|problema)\b\s*(.*)$/i,
        reasmb: [
          "Qual é o coração desse “{1}—”?",
          "Esse conflito em “{1}—” gera movimento ou estagnação?",
          "O que está em risco quando você encara “{1}—”?"
        ],
        memory: ["Qual é o ponto de virada dentro de “{1}—” ?"]
      }
    ]
  },
  {
    key: /(.*)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Pode desenvolver mais essa ideia?",
          "Onde isso aparece concretamente?",
          "O que aqui ainda está implícito?",
          "Como isso soaria se fosse uma confissão?"
        ],
        memory: ["Volte no centro: qual frase você quer que fique?"]
      }
    ]
  }
];

// ============================
// PATCH: Empatia real + fio do centro + presença-aware
// ============================

function presenceClosing(p) {
  const base = {
    A: ["", "Se quiser, continue.", ""],
    B: ["", "Estou aqui.", "Pode seguir no seu ritmo.", ""],
    C: ["", "Próxima.", "Siga.", ""],
    D: ["", ""]
  };
  if (p.key === "H" && state.presenceMix) {
    const mix = state.presenceMix;
    const pickFrom =
      (mix.D || 0) > 0.5 ? base.D :
      (mix.C || 0) > 0.4 ? base.C :
      (mix.B || 0) > 0.35 ? base.B : base.A;
    return pick(pickFrom);
  }
  return pick(base[p.key] || [""]);
}

function centerLensLine() {
  const p = state.presence || PRESENCES.A;
  const ct = state.centerType;
  if (!ct || ct === "livre") return "";

  const lines = {
    pergunta: {
      A: ["Segure a pergunta como eixo.", "Vamos manter a pergunta viva."],
      B: ["Essa pergunta tem vida própria. Vamos escutar o que ela pede.", "Vamos cuidar dessa pergunta sem apressar resposta."],
      C: ["Trate isso como pergunta-motriz.", "A pergunta é o eixo. Não fuja dela."],
      D: [""]
    },
    afirmacao: {
      A: ["Sustente a afirmação com imagem.", "Deixe a afirmação ganhar corpo."],
      B: ["Isso afirma algo importante. Vamos dar carne pra isso com uma cena.", "Vamos sustentar isso com delicadeza — e com prova concreta."],
      C: ["Afirmação registrada. Agora prove em cena.", "Ok: agora sustente com fato/gesto."],
      D: [""]
    },
    ferida: {
      A: ["Há uma ferida aí. Vamos nomear sem dramatizar.", "Trate essa ferida com precisão."],
      B: ["Isso toca num ponto sensível. Vamos cuidar sem anestesiar a verdade.", "Essa ferida pode virar verso — com delicadeza e precisão."],
      C: ["Ferida registrada. Agora localize onde dói (cena).", "Ok. Delimite o gatilho e o impacto."],
      D: [""]
    },
    desejo: {
      A: ["Siga o desejo como bússola.", "Deixe o desejo guiar a forma."],
      B: ["Isso tem pulsação. Vamos seguir o desejo sem pressa.", "Vamos caminhar com esse desejo e ver onde ele encosta."],
      C: ["Desejo registrado. Agora identifique o obstáculo.", "Ok. Defina alvo e impedimento."],
      D: [""]
    }
  };

  const k = p.key === "H" ? "B" : p.key;
  const arr = (lines[ct] && (lines[ct][k] || lines[ct].A)) || [""];
  return pick(arr);
}

function leadLine(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t) return "";

  if (p.key === "D") return "";

  if (p.key === "H" && state.presenceMix) {
    const mix = state.presenceMix;
    if ((mix.D || 0) > 0.55) return "";
    if ((mix.C || 0) > 0.45) return pick(["Ok.", "Certo.", "Registrado."]);
    if ((mix.B || 0) > 0.35) return pick([
      "Eu tô aqui com você.",
      "Obrigado por dizer isso.",
      "Entendi — isso importa."
    ]);
    return pick(["Ok.", "Entendi."]);
  }

  if (p.key === "A") return pick(["Ok.", "Entendi.", "Certo."]);

  if (p.key === "B") {
    const ct = state.centerType;
    const bank = [
      "Obrigado por confiar isso ao texto.",
      "Eu tô aqui com você, sem pressa.",
      "Entendi — isso tem peso.",
      ct === "ferida" ? "Isso toca num ponto sensível." : "",
      ct === "desejo" ? "Isso tem pulsação." : "",
      ct === "pergunta" ? "Essa pergunta tem força." : "",
      ct === "afirmacao" ? "Isso afirma algo importante." : ""
    ].filter(Boolean);
    return pick(bank);
  }

  if (p.key === "C") return pick(["Vamos focar.", "Ok. Seja específico.", "Certo. Vamos delimitar."]);

  return "";
}

function fixEmptyQuestion(qText) {
  const normalized = String(qText || "").trim();
  const hasEmptyQuotes =
    normalized.includes("“—") ||
    normalized.includes('""') ||
    normalized.includes("''") ||
    /\?\s*—/.test(normalized) ||
    /“\s*—/.test(normalized) ||
    /"\s*"/.test(normalized);

  if (!hasEmptyQuotes) return normalized;

  const p = state.presence || PRESENCES.A;
  const ct = state.centerType;

  const byCenter = {
    ferida: "O que exatamente encosta nessa ferida, hoje?",
    desejo: "O que impede esse desejo de respirar agora?",
    pergunta: "Qual parte dessa pergunta te puxa mais?",
    afirmacao: "O que sustenta essa afirmação, concretamente?",
    livre: "Pode dizer isso com um detalhe concreto (lugar, corpo, gesto)?"
  };

  const base = byCenter[ct] || byCenter.livre;

  if (p.key === "C") return base.replace("hoje?", "agora?").replace("respirar", "avançar");
  if (p.key === "D") return base.replace(/\?$/, "").trim() + "?";
  return base;
}

function composeReply(p, userText, mirror, qText, minimalistNow) {
  const lead = leadLine(userText);
  const lens = centerLensLine();
  const closing = presenceClosing(p);
  const safeQuestion = ensureMeaningfulTemplateText(fixEmptyQuestion(qText), userText);
  const safeMirror = ensureMeaningfulTemplateText(mirror, userText);

  if (minimalistNow || p.key === "D") {
    return safeQuestion || `Falando em “${fallbackUserAnchor(userText)}”, pode continuar?`;
  }

  const parts = [];
  if (safeMirror) parts.push(safeMirror);
  if (lead) parts.push(lead);

  if (lens) {
    if (p.key === "A") {
      if (Math.random() < 0.45) parts.push(lens);
    } else {
      parts.push(lens);
    }
  }

  parts.push(safeQuestion || `Falando em “${fallbackUserAnchor(userText)}”, o que aparece agora?`);

  if (closing && !(p.key === "B" && Math.random() < 0.55)) {
    parts.push(closing);
  }

  return parts.filter(Boolean).join("\n").trim();
}

// ============================
// PATCH: SALTO DE QUALIDADE (C força 7 palavras quando resposta é curta)
// ============================
function isTooShort(userText) {
  const t = (userText || "").trim();
  if (!t) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 2;
}

function firmNeedsExpansion(p) {
  if (!p) return false;
  if (p.key === "C") return true;
  if (p.key === "H" && state.presenceMix) return (state.presenceMix.C || 0) >= 0.45;
  return false;
}

function askSevenWordsPrompt(userText) {
  const ct = state.centerType;
  const base =
    ct === "ferida" ? "Complete em 7 palavras: o que encosta nessa ferida?" :
    ct === "desejo" ? "Complete em 7 palavras: o que impede esse desejo?" :
    ct === "pergunta" ? "Complete em 7 palavras: qual parte da pergunta pesa?" :
    ct === "afirmacao" ? "Complete em 7 palavras: que prova sustenta isso?" :
    "Complete em 7 palavras com lugar/gesto: o que você quer dizer?";

  const hook = userText ? `Você disse: “${swapPronouns(userText)}—”. ` : "";
  return hook + base;
}

function izaReply(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t) return p.key === "D" ? "Continue." : "Pode seguir.";

  const mix =
    state.presenceMix ||
    {
      A: p.key === "A" ? 1 : 0,
      B: p.key === "B" ? 1 : 0,
      C: p.key === "C" ? 1 : 0,
      D: p.key === "D" ? 1 : 0
    };

  if (firmNeedsExpansion(p) && isTooShort(t)) {
    const mirror = shortMirror(p, t);
    const qText = askSevenWordsPrompt(t);
    const minimalistNow = (mix.D || 0) > 0.55 && Math.random() < (mix.D || 0);
    const composed = composeReply(p, t, mirror, qText, minimalistNow);
    return presenceWrap(p, composed);
  }

  const externalQ = runExternalRules(t, p, mix);
  if (externalQ) {
    const mirror = shortMirror(p, t);
    const minimalistNow = shouldBeMinimalNow(p, mix);
    const composed = composeReply(p, t, mirror, externalQ, minimalistNow);
    return presenceWrap(p, composed);
  }

  const memChance = Math.min(
    0.45,
    0.12 + 0.22 * (mix.B || 0) + 0.22 * (mix.C || 0) - 0.08 * (mix.D || 0)
  );

  if (IZA_ENGINE.memory.length > 0 && Math.random() < memChance) {
    const mirror = shortMirror(p, t);
    const mem = IZA_ENGINE.memory.shift();
    const composed = composeReply(p, t, mirror, mem, false);
    return presenceWrap(p, composed);
  }

  for (const rule of IZA_SCRIPT) {
    if (!rule.key.test(t)) continue;

    for (const d of rule.decomps) {
      const m = t.match(d.re);
      if (!m) continue;

      const mirror = shortMirror(p, t);
      const q1 = pick(d.reasmb);
      let qText = applyReasmb(q1, m);

      const extraChance = p.maxQuestions >= 2 ? 0.22 + 0.38 * (mix.C || 0) : 0;

      if (p.maxQuestions >= 2 && Math.random() < extraChance) {
        const pool = d.reasmb.length > 1 ? d.reasmb.filter((x) => x !== q1) : [];
        const q2 = pick(pool.length ? pool : IZA_SCRIPT[IZA_SCRIPT.length - 1].decomps[0].reasmb);
        qText += "\n" + applyReasmb(q2, m);
      }

      if (d.memory && d.memory.length) {
        IZA_ENGINE.memory.push(applyReasmb(pick(d.memory), m));
        if (IZA_ENGINE.memory.length > 8) IZA_ENGINE.memory.shift();
      }

      const minimalistNow = shouldBeMinimalNow(p, mix);

      const composed = composeReply(p, t, mirror, qText, minimalistNow);
      return presenceWrap(p, composed);
    }
  }

  const fallbackQ = `Falando em “${fallbackUserAnchor(t)}”, qual parte pede mais clareza agora?`;
  return presenceWrap(p, composeReply(p, t, shortMirror(p, t), fallbackQ, false));
}

// -------------------- OPÇÃO A (centro) --------------------
function centerChoicePrompt(fragment) {
  const p = state.presence || PRESENCES.A;
  const frag = swapPronouns((fragment || "").trim());

  if (p.key === "D") {
    return `“${frag}—”\nA) pergunta  B) afirmação  C) ferida  D) desejo\n(A/B/C/D ou escreva do seu jeito)`;
  }
  if (p.key === "C") {
    return `Você disse: “${frag}—”. Classifique o núcleo:\nA) pergunta\nB) afirmação\nC) ferida\nD) desejo\nResponda Escreva do seu jeito.`;
  }
  if (p.key === "B") {
    return `Ao ler “${frag}—”, eu sinto um núcleo aí.\nIsso está mais perto de:\nA) uma pergunta\nB) uma afirmação\nC) uma ferida\nD) um desejo\nResponda Escreva do seu jeito..`;
  }
  return `Quando você diz “${frag}—”, isso está mais perto de:\nA) uma pergunta\nB) uma afirmação\nC) uma ferida\nD) um desejo\nResponda Escreva do seu jeito..`;
}

function interpretCenterChoice(text) {
  const t = (text || "").trim().toLowerCase();
  const map = { a: "pergunta", b: "afirmacao", c: "ferida", d: "desejo" };
  const choice = map[t[0]] || null;
  if (!choice) return { type: "livre", label: "o seu próprio modo de dizer" };
  const labelMap = {
    pergunta: "uma pergunta",
    afirmacao: "uma afirmação",
    ferida: "uma ferida",
    desejo: "um desejo"
  };
  return { type: choice, label: labelMap[choice] || "o seu próprio modo de dizer" };
}

// -------------------- TRACKS --------------------
const TRACKS = {
  iniciante: {
    name: "Trilha Iniciante (4 etapas)",
    steps: [
      {
        key: "nucleo",
        prompt: "Etapa 1 — Núcleo\nEscreva livremente sobre seu tema.",
        onUser: (t) => izaReply(t) + "\n\nAgora, em 1 frase: qual é o centro disso?"
      },
      {
        key: "centro",
        prompt: "Em 1 frase: qual é o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return centerChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escreva do seu jeito.",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
            p.key === "C" ? `Registrado: ${parsed.label}.` :
            p.key === "B" ? `Certo — vamos tratar o centro como ${parsed.label}.` :
            `Ok — vamos tratar o centro como ${parsed.label}.`;
          return `${lead}\n\nEtapa 2 — Atrito\nO que está em jogo aqui (conflito, dúvida, desejo, risco)?`;
        }
      },
      {
        key: "atrito",
        prompt: "Etapa 2 — Atrito\nO que está em jogo aqui?",
        onUser: (t) => {
          const hint =
            state.centerType === "pergunta" ? "Qual parte da pergunta dói mais?" :
            state.centerType === "afirmacao" ? "O que ameaça essa afirmação?" :
            state.centerType === "ferida" ? "O que encosta nessa ferida?" :
            state.centerType === "desejo" ? "O que atrapalha esse desejo?" :
            "Qual é a tensão aqui?";
          return izaReply(t) + `\n\nEtapa 3 — Cena\nTraga uma cena concreta (lugar + alguém + um gesto). (${hint})`;
        }
      },
      {
        key: "cena",
        prompt: "Etapa 3 — Cena\nTraga uma cena concreta (lugar + alguém + um gesto).",
        onUser: (t) => izaReply(t) + "\n\nEtapa 4 — Frase que fica\nEscreva o verso/frase que não pode faltar."
      },
      {
        key: "frase_final",
        prompt: "Etapa 4 — Frase que fica\nEscreva o verso/frase que não pode faltar.",
        onUser: (t) => {
          state.finalDraft = (t || "").trim();
          return izaReply(t) + "\n\nFechamos. Vou preparar seu registro.";
        },
        endScreen: true
      }
    ]
  },

  intermediaria: {
    name: "Trilha Intermediária (7 etapas)",
    steps: [
      {
        key: "tema",
        prompt: "Etapa 1 — Tema\nEm poucas palavras, qual é o tema?",
        onUser: (t) => izaReply(t) + "\n\nEtapa 2 — Centro (1 frase)\nQual é o centro disso em 1 frase?"
      },
      {
        key: "centro",
        prompt: "Etapa 2 — Centro (1 frase)\nQual é o centro disso em 1 frase?",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return centerChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escreva do seu jeito.",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
            p.key === "C" ? `Registrado: ${parsed.label}.` :
            p.key === "B" ? `Certo — tratemos o centro como ${parsed.label}.` :
            `Ok — tratemos o centro como ${parsed.label}.`;
          return `${lead}\n\nEtapa 3 — Atrito\nO que está em jogo (conflito, regra, risco, desejo)?`;
        }
      },
      {
        key: "atrito",
        prompt: "Etapa 3 — Atrito\nO que está em jogo?",
        onUser: (t) => izaReply(t) + "\n\nEtapa 4 — Concreto\nTraga uma cena/fala/gesto/lugar onde isso aparece."
      },
      {
        key: "concreto",
        prompt: "Etapa 4 — Concreto\nOnde isso aparece de forma concreta?",
        onUser: (t) => izaReply(t) + "\n\nEtapa 5 — Contraste\nDiga duas forças em oposição (ex.: medo × vontade)."
      },
      {
        key: "contraste",
        prompt: "Etapa 5 — Contraste\nDuas forças em oposição:",
        onUser: (t) => izaReply(t) + "\n\nEtapa 6 — Síntese (3 linhas)\nResuma tudo em 3 linhas."
      },
      {
        key: "sintese",
        prompt: "Etapa 6 — Síntese (3 linhas)\nResuma tudo em 3 linhas.",
        onUser: (t) => izaReply(t) + "\n\nEtapa 7 — Forma final\nEscreva a versão que você levaria adiante."
      },
      {
        key: "forma_final",
        prompt: "Etapa 7 — Forma final\nEscreva a versão final.",
        onUser: (t) => {
          state.finalDraft = (t || "").trim();
          return izaReply(t) + "\n\nFechamos. Vou preparar seu registro.";
        },
        endScreen: true
      }
    ]
  },

  inspirada: {
    name: "Trilha Inspirada (conversa aberta)",
    steps: [
      {
        key: "abertura",
        prompt: "Sobre o que você quer escrever hoje?",
        onUser: (t) => izaReply(t) + "\n\nSe tivesse que dizer em 1 frase: qual é o centro disso?"
      },
      {
        key: "centro",
        prompt: "Em 1 frase: qual é o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return centerChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escreva do seu jeito.",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
            p.key === "C" ? `Registrado: ${parsed.label}.` :
            p.key === "B" ? `Certo — vamos caminhar com ${parsed.label}.` :
            `Ok — vamos caminhar com ${parsed.label}.`;
          return `${lead}\n\nAgora segue no fluxo: escreva mais um pouco (sem se vigiar).`;
        }
      },
      {
        key: "loop",
        prompt: "Escreva mais um pouco. (Digite 'encerrar' quando quiser.)",
        onUser: (t) => {
          state.inspiredRounds += 1;
          return izaReply(t);
        },
        loop: true
      }
    ]
  }
};

// -------------------- FLOW --------------------
function resetConversationRuntime() {
  state.stepIndex = 0;
  state.inspiredRounds = 0;
  state.turns = [];
  state.centerType = null;
  state.finalDraft = "";
  state.sent = false;

  state.registerStatus = "idle";
  state.registerError = "";

  state.registerFinalDone = false;

  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];

  state.viewHistory = [];
  state.viewIndex = -1;
  state.viewMode = false;
}

function startTrack(key) {
  state.trackKey = key;

  // expõe trilha para rules.js (track-aware)
  window.IZA_TRACK_KEY = key;

  // ao escolher trilha, registrar "choice" (1x)
  safeRegisterChoice();

  resetConversationRuntime();
  showStep();
}

function showStep() {
  const track = TRACKS[state.trackKey];
  const step = track.steps[state.stepIndex];

  showPrompt(track.name, step.prompt, (text) => {
    const userText = (text || "").trim();
    if (!userText) return;

    if (state.trackKey === "inspirada" && userText.toLowerCase().startsWith("encerrar")) {
      showFinalizeScreen();
      return;
    }

    pushTurn("user", userText);
    const reply = step.onUser(userText);
    pushTurn("iza", reply);

    showIza(reply, () => {
      if (step.endScreen) {
        showFinalizeScreen();
        return;
      }

      if (step.loop) {
        showStep();
        return;
      }

      state.stepIndex++;
      if (state.stepIndex >= track.steps.length) {
        showFinalizeScreen();
        return;
      }
      showStep();
    });
  });
}

// -------------------- SCREENS (render + history) --------------------
function renderPromptScreen(payload, fromHistory = false) {
  const { title, question, canSend } = payload;

  const pct = progressPct(state.trackKey, state.stepIndex);
  const progHtml =
    pct === null
      ? `<div class="iza-sub">${escapeHtml(progressLabel(state.trackKey, state.stepIndex))}</div>`
      : `
        <div class="iza-sub">${escapeHtml(progressLabel(state.trackKey, state.stepIndex))}</div>
        <div class="iza-progress" aria-label="Progresso">
          <div style="width:${pct}%"></div>
        </div>
      `;

  render(
    renderCardShell(`
      <div class="iza-top">
        <div>
          <h2 style="margin:0;">${escapeHtml(title)}</h2>
          ${progHtml}
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;">${escapeHtml(userDisplayName())}</div>
          <div class="iza-sub">${escapeHtml(izaDisplayName())}</div>
        </div>
      </div>

      <p style="margin-top:1rem;">${escapeHtml(question).replace(/\n/g, "<br>")}</p>

      <textarea id="txt" class="input-area" rows="5" ${canSend ? "" : "disabled"} placeholder="${canSend ? "" : "Resposta já enviada (não exibida)"}"></textarea>

      ${
        canSend
          ? `<button id="btnSend" class="button">Enviar</button>`
          : `<div class="iza-hint">Você está revisando uma etapa anterior. O texto que foi enviado não aparece aqui.</div>`
      }

      ${renderHistoryNav("")}
    `)
  );

  mountFadeIn();
  bindHistoryNavHandlers();

  if (canSend) {
    el("btnSend").onclick = () => payload.onSend && payload.onSend(el("txt").value.trim());
  }
}

function renderIzaScreen(payload, fromHistory = false) {
  const { text, canContinue, onContinue } = payload;

  const pct = progressPct(state.trackKey, state.stepIndex);
  const progHtml =
    pct === null
      ? `<div class="iza-sub">${escapeHtml(progressLabel(state.trackKey, state.stepIndex))}</div>`
      : `
        <div class="iza-sub">${escapeHtml(progressLabel(state.trackKey, state.stepIndex))}</div>
        <div class="iza-progress" aria-label="Progresso">
          <div style="width:${pct}%"></div>
        </div>
      `;

  render(
    renderCardShell(`
      <div class="iza-top">
        <div>
          <h2 style="margin:0;">${escapeHtml(izaDisplayName())}</h2>
          ${progHtml}
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;">${escapeHtml(userDisplayName())}</div>
          <div class="iza-sub">em diálogo</div>
        </div>
      </div>

      <div class="message" style="margin-top:1rem;">
        ${escapeHtml(text).replace(/\n/g, "<br>")}
      </div>

      ${
        canContinue
          ? `<button class="button" id="btnNext">Continuar</button>`
          : `<div class="iza-hint">Você está revisando uma fala anterior.</div>`
      }

      ${renderHistoryNav("")}
    `)
  );

  mountFadeIn();
  bindHistoryNavHandlers();

  if (canContinue) {
    el("btnNext").onclick = () => safeTransition(onContinue);
  }
}

function showPrompt(title, question, cb) {
  const payload = {
    title,
    question,
    canSend: true, // ao vivo
    onSend: (text) => {
      const userText = (text || "").trim();
      if (!userText) return;
      safeTransition(() => cb(userText));
    }
  };

  // salva o payload COMPLETO (não “capado”)
  pushView({ type: "prompt", payload });

  renderPromptScreen(payload, false);
}

function showIza(text, next) {
  const payload = {
    text,
    canContinue: true, // ao vivo
    onContinue: () => next()
  };

  pushView({ type: "iza", payload });

  renderIzaScreen(payload, false);
}

// -------------------- FINALIZE SCREEN (COPY / DOWNLOAD / SEND STATUS) --------------------
function buildTranscript() {
  const header =
    `IZA no Cordel 2.0 — Registro\n` +
    `Nome: ${state.name}\nEmail: ${state.email}\n` +
    `Município: ${state.municipio || ""}\nEstado: ${state.estadoUF || ""}\nOrigem: ${state.origem || ""}\n` +
    `Trilha: ${state.trackKey}\nPresença: ${state.presence?.name || state.presenceKey}\n` +
    `Início: ${state.startedAtISO}\nFim: ${nowISO()}\n` +
    `---\n\n`;

  const body = state.turns
    .map((t) => {
      const who = t.role === "user" ? "VOCÊ" : "IZA";
      return `${who}:\n${t.text}\n`;
    })
    .join("\n");

  return header + body;
}

function buildFinalDraftBlock() {
  const draft = (state.finalDraft || "").trim();
  if (!draft) return "";
  return `\n\n---\nTEXTO FINAL (rascunho):\n${draft}\n`;
}

function renderSendStatus() {
  if (state.registerStatus === "sending") return "Enviando registro…";
  if (state.registerStatus === "sent") return "Registro enviado com sucesso.";
  if (state.registerStatus === "failed")
    return `Falha ao enviar registro. (${state.registerError || "ver console"})`;
  return "Preparando envio…";
}

function updateSendStatusUI() {
  const node = document.getElementById("sendStatus");
  if (node) node.textContent = renderSendStatus();
}

function renderFinalScreen(payload, fromHistory = false) {
  render(
    renderCardShell(`
      <div class="iza-top">
        <div>
          <h2 style="margin:0;">Seu registro</h2>
          <div class="iza-sub">${escapeHtml(userDisplayName())} · ${escapeHtml(izaDisplayName())}</div>
        </div>
        <div style="text-align:right;">
          <div class="iza-chip">Final</div>
        </div>
      </div>

      <p id="sendStatus" style="opacity:.85;margin-top:1rem;">
        ${renderSendStatus()}
      </p>

      <p><strong>Texto para copiar/colar</strong></p>
      <textarea id="out" class="input-area" rows="12">${escapeHtml(payload.transcript)}</textarea>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem;">
        <button class="button" onclick="copyOut()">Copiar</button>
        <button class="button" onclick="downloadTxt()">Baixar .txt</button>
        <button class="button" style="background:#a0896a;" onclick="location.reload()">Novo texto</button>
      </div>

      <p style="opacity:.7;margin-top:1rem;">
        Você já tem tudo aqui para salvar.
      </p>

      ${renderHistoryNav("")}
    `)
  );

  mountFadeIn();
  bindHistoryNavHandlers();

  window.copyOut = async function () {
    const txt = el("out").value;
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copiado!");
    } catch (e) {
      el("out").select();
      document.execCommand("copy");
      alert("Copiado!");
    }
  };

  window.downloadTxt = function () {
    const txt = el("out").value;
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IZA_${state.trackKey}_${state.sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
}

function showFinalizeScreen() {
  safeRegisterFinal();

  const transcript = buildTranscript() + buildFinalDraftBlock();

  pushView({ type: "final", payload: { transcript } });
  renderFinalScreen({ transcript }, false);
}

// -------------------- REGISTER (3 etapas) --------------------
function buildRegisterBasePayload(stage) {
  return {
    sessionId: state.sessionId,
    stage, // "init" | "choice" | "final"
    escritor: state.name,
    name: state.name,
    email: state.email,
    municipio: state.municipio,
    city: state.municipio,
    estado: state.estadoUF,
    stateUF: state.estadoUF,
    origem: state.origem,
    source: state.origem,

    trilha: state.trackKey || "",
    trackKey: state.trackKey || "",
    personalidade: state.presence?.name || state.presenceKey || "",
    presenceName: state.presence?.name || "",
    presenceKey: state.presenceKey || "",
    presenceMix: state.presenceMix || null
  };
}

async function postJsonRobust(payload) {
  try {
    const r = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return true;
  } catch (e1) {
    try {
      const r2 = await fetch(WEBAPP_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!r2.ok) throw new Error("HTTP " + r2.status);
      return true;
    } catch (e2) {
      console.error("Falha ao enviar:", e1, e2, payload);
      throw e2;
    }
  }
}

async function safeRegisterInit() {
  if (state.registerInitDone) return;
  if (!state.sessionId) return;

  const payload = buildRegisterBasePayload("init");
  try {
    await postJsonRobust(payload);
    state.registerInitDone = true;
  } catch (_) {
    // não trava a UX
  }
}

async function safeRegisterChoice() {
  if (state.registerChoiceDone) return;
  if (!state.sessionId) return;
  if (!state.presenceKey) return; // precisa ter presença definida
  if (!state.trackKey) return; // precisa ter trilha escolhida

  const payload = buildRegisterBasePayload("choice");
  try {
    await postJsonRobust(payload);
    state.registerChoiceDone = true;
  } catch (_) {
    // não trava a UX
  }
}

async function safeRegisterFinal() {
  if (state.registerFinalDone) return;
  state.registerFinalDone = true;

  state.registerStatus = "sending";
  updateSendStatusUI();

  const payload = {
    ...buildRegisterBasePayload("final"),
    startedAtISO: state.startedAtISO,
    endedAtISO: nowISO(),
    page: state.pageURL,
    finalDraft: state.finalDraft || "",
    escritos: buildTranscript() + buildFinalDraftBlock(),
    transcript: buildTranscript() + buildFinalDraftBlock(),
    turns: state.turns
  };

  try {
    await postJsonRobust(payload);
    state.registerStatus = "sent";
    updateSendStatusUI();
  } catch (e) {
    state.registerStatus = "failed";
    state.registerError = String(e?.message || e || "erro");
    updateSendStatusUI();
  }
}

// -------------------- TESTE + PRESENÇA --------------------
const testQuestions = [
  {
    title: "Pergunta 1",
    q: "Quando você escreve, o que ajuda mais?",
    opts: [
      ["A", "Perguntas suaves que me deixem pensar"],
      ["B", "Um tom próximo e acolhedor"],
      ["C", "Direcionamento claro"],
      ["D", "Poucas interferências"]
    ]
  },
  {
    title: "Pergunta 2",
    q: "Se seu texto estiver confuso, você prefere:",
    opts: [
      ["A", "Uma pergunta aberta"],
      ["B", "Um convite para desenrolar"],
      ["C", "Um pedido direto de clareza"],
      ["D", "Silêncio e espaço"]
    ]
  },
  {
    title: "Pergunta 3",
    q: "O ritmo ideal de conversa é:",
    opts: [
      ["A", "Calmo e leve"],
      ["B", "Conversado"],
      ["C", "Objetivo"],
      ["D", "Quase silencioso"]
    ]
  },
  {
    title: "Pergunta 4",
    q: "Hoje você está escrevendo mais para:",
    opts: [
      ["A", "Explorar ideias"],
      ["B", "Expressar algo pessoal"],
      ["C", "Organizar pensamento"],
      ["D", "Só colocar no papel"]
    ]
  },
  {
    title: "Pergunta 5",
    q: "Como você quer que a IZA apareça?",
    opts: [
      ["A", "Discreta"],
      ["B", "Calorosa"],
      ["C", "Firme"],
      ["D", "Minimalista"]
    ]
  }
];

function setPresenceFixed(key) {
  state.presenceKey = key;
  state.presence = PRESENCES[key];
  state.presenceMix = null;
  showPresenceResult();
}

function renderPresenceTestScreen(payload, fromHistory = false) {
  const blocks = testQuestions
    .map((q, i) => {
      const opts = q.opts
        .map(
          ([val, label]) => `
        <label style="display:block;margin:.25rem 0;">
          <input type="radio" name="q${i}" value="${val}"> ${escapeHtml(label)}
        </label>`
        )
        .join("");
      return `
      <div style="margin:1rem 0;">
        <div style="font-weight:700;">${escapeHtml(q.title)}</div>
        <div style="margin:.35rem 0 .5rem 0;">${escapeHtml(q.q)}</div>
        ${opts}
      </div>`;
    })
    .join("");

  render(
    renderCardShell(`
      <div class="iza-top">
        <div>
          <h2 style="margin:0;">Presença da IZA</h2>
          <div class="iza-sub">${escapeHtml(userDisplayName())}</div>
        </div>
        <div style="text-align:right;">
          <div class="iza-chip">Ajuste</div>
        </div>
      </div>

      <p style="opacity:.85;margin-top:1rem">
        Escolha uma presença fixa (A/B/C/D) ou faça o teste e gere um perfil <strong>híbrido</strong>.
      </p>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0 1rem 0;">
        <button class="button" onclick="setPresenceFixed('A')">A · Discreta</button>
        <button class="button" onclick="setPresenceFixed('B')">B · Calorosa</button>
        <button class="button" onclick="setPresenceFixed('C')">C · Firme</button>
        <button class="button" onclick="setPresenceFixed('D')">D · Minimalista</button>
      </div>

      <hr style="opacity:.2;margin:1rem 0;">

      <h3 style="margin:.25rem 0;">Teste rápido (gera híbrida)</h3>
      ${blocks}

      <button class="button" id="btnDone" disabled>Concluir teste</button>
      <button class="button" style="background:#a0896a;margin-top:10px;" onclick="showWelcome()">Voltar</button>

      ${renderHistoryNav("")}
    `)
  );

  mountFadeIn();
  bindHistoryNavHandlers();

  const btn = el("btnDone");

  const check = () => {
    const ok = testQuestions.every((_, i) =>
      document.querySelector(`input[name="q${i}"]:checked`)
    );
    btn.disabled = !ok;
  };

  document
    .querySelectorAll("input[type=radio]")
    .forEach((r) => r.addEventListener("change", check));

  btn.onclick = () => {
    const answers = testQuestions.map(
      (_, i) => document.querySelector(`input[name="q${i}"]:checked`).value
    );

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    answers.forEach((a) => counts[a]++);
    const mix = normalizeMix(counts);

    state.presenceKey = "H";
    state.presenceMix = mix;
    state.presence = buildHybridPresence(mix);

    showPresenceResult();
  };
}

function showPresenceTest() {
  pushView({ type: "presence_test", payload: {} });
  renderPresenceTestScreen({}, false);
}

function renderPresenceResultScreen(payload, fromHistory = false) {
  const p = state.presence || PRESENCES.A;

  render(
    renderCardShell(`
      <div class="iza-top">
        <div>
          <h2 style="margin:0;">${escapeHtml(p.name)}</h2>
          <div class="iza-sub">${escapeHtml(userDisplayName())} · presença definida</div>
          <div class="iza-sub" style="margin-top:.35rem;">
            ${escapeHtml(state.municipio || "")}${state.municipio ? " · " : ""}${escapeHtml(state.estadoUF || "")}${(state.origem ? " · " + escapeHtml(state.origem) : "")}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="iza-chip">${escapeHtml(p.key === "H" ? "Híbrida" : "Fixa")}</div>
        </div>
      </div>

      <div class="message" style="margin-top:1rem;">${escapeHtml(presenceMessage(p))}</div>

      <p style="margin-top:1rem;"><strong>Escolha uma trilha:</strong></p>
      <button class="button" onclick="startTrack('iniciante')">Trilha Iniciante</button>
      <button class="button" onclick="startTrack('intermediaria')">Trilha Intermediária (7 etapas)</button>
      <button class="button" onclick="startTrack('inspirada')">Trilha Inspirada</button>

      <br>
      <button class="button" style="background:#a0896a;margin-top:10px;" onclick="showPresenceTest()">Ajustar presença</button>

      ${renderHistoryNav("")}
    `)
  );

  mountFadeIn();
  bindHistoryNavHandlers();
}

function showPresenceResult() {
  pushView({ type: "presence", payload: {} });
  renderPresenceResultScreen({}, false);
}

// -------------------- WELCOME --------------------
function renderWelcomeScreen(payload, fromHistory = false) {
  const ufOptions = [
    `<option value="">Selecione…</option>`,
    ...BR_UFS.map((uf) => `<option value="${uf}">${uf}</option>`),
    `<option value="INTERNACIONAL">INTERNACIONAL</option>`
  ].join("");

  render(
    renderCardShell(`
      <div class="iza-top">
        <div>
          <h2 style="margin:0;">IZA no Cordel 2.0</h2>
          <div class="iza-sub">Uma ancestral que te ajuda a pensar durante o processo de escrita.</div>
        </div>
        <div style="text-align:right;">
          <div class="iza-chip">Início</div>
        </div>
      </div>

      <p style="margin-top:1rem;">
        IZA é uma ancestral — de escrita: ela não escreve por você;
        ela te ajuda a <strong>pensar, organizar e aprofundar</strong> o que você já está tentando dizer.
      </p>

      <p style="opacity:.85">
        Antes de começar, preencha seus dados e escolha a origem.
      </p>

      <input type="text" id="userName" class="input-area" placeholder="Seu nome" value="${escapeHtml(state.name)}">
      <input type="email" id="userEmail" class="input-area" placeholder="Seu e-mail" value="${escapeHtml(state.email)}">

      <input type="text" id="userMunicipio" class="input-area" placeholder="Município (ex.: Salvador)" value="${escapeHtml(state.municipio)}">

      <select id="userEstado" class="iza-field">
        ${ufOptions}
      </select>

      <div style="margin-top:.25rem;">
        <div style="font-weight:700;margin:.25rem 0;">Origem</div>
        <div class="iza-radio">
          <label><input type="radio" name="origem" value="Oficina Cordel 2.0"> Oficina Cordel 2.0</label>
          <label><input type="radio" name="origem" value="Particular"> Particular</label>
        </div>
      </div>

      <button class="button" onclick="validateStart()">Começar</button>

      ${renderHistoryNav("")}
    `)
  );

  // set estado + origem com estado atual
  const sel = document.getElementById("userEstado");
  if (sel) sel.value = state.estadoUF || "";

  const radios = document.querySelectorAll('input[name="origem"]');
  radios.forEach((r) => {
    if (String(r.value) === String(state.origem)) r.checked = true;
  });

  mountFadeIn();
  bindHistoryNavHandlers();
}

function showWelcome() {
  state.sessionId = newSessionId();
  state.startedAtISO = nowISO();
  state.pageURL = window.location.href;

  state.presenceKey = null;
  state.presence = null;
  state.presenceMix = null;
  state.trackKey = null;

  state.registerInitDone = false;
  state.registerChoiceDone = false;
  state.registerFinalDone = false;

  resetConversationRuntime();

  pushView({ type: "welcome", payload: {} });
  renderWelcomeScreen({}, false);
}

window.validateStart = function () {
  state.name = el("userName").value.trim();
  state.email = el("userEmail").value.trim();

  state.municipio = (el("userMunicipio")?.value || "").trim();
  state.estadoUF = normalizeUFOrInternational(el("userEstado")?.value || "");
  const origemPicked = document.querySelector('input[name="origem"]:checked')?.value || "";
  state.origem = normalizeOrigem(origemPicked);

  if (!state.name || !state.email) return;

  // registro init (não trava)
  safeRegisterInit();

  showPresenceTest();
};

// init
document.addEventListener("DOMContentLoaded", () => {
  ensureBaseStyles();
  showWelcome();
});
