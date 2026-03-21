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
  "https://script.google.com/macros/s/AKfycbyl0Py3Vt7fzW6pt0BESZZCsGlqh9A1Dkt4iu9zTAN1QQV6j4_xnfmXmoPkZWh-AoV4/exec";

const MIN_INSPIRED_ROUNDS = 7;
const GIFT_LOOKUP_TIMEOUT_MS = 20000;

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
  finalClosure: null,
  registerStatus: "idle", // idle|sending|sent|failed
  registerError: "",

  // registro em 3 etapas
  registerInitDone: false,
  registerChoiceDone: false,
  registerFinalDone: false,
  registerGiftDone: false,

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

// -------------------- AUTO-SAVE PERSISTENCE --------------------
function saveStateToLocal() {
  try {
    const data = { state, IZA_ENGINE };
    localStorage.setItem("izaState", JSON.stringify(data));
  } catch (e) { }
}
function clearStateFromLocal() {
  try {
    localStorage.removeItem("izaState");
  } catch (e) { }
}
function loadStateFromLocal() {
  try {
    const saved = localStorage.getItem("izaState");
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}
function loadAndResumeSession() {
  const saved = loadStateFromLocal();
  if (!saved || !saved.state || !saved.state.sessionId) return false;

  if (saved.state.registerFinalDone) {
    clearStateFromLocal();
    return false;
  }

  const canAskNativeConfirm = (() => {
    try {
      return window.self === window.top;
    } catch (_) {
      return false;
    }
  })();

  const wantResume = canAskNativeConfirm
    ? confirm("Há uma jornada de escrita em andamento. Quer retomar do ponto em que parou?")
    : true;
  if (!wantResume) {
    clearStateFromLocal();
    return false;
  }

  Object.assign(state, saved.state);
  if (saved.IZA_ENGINE) {
    IZA_ENGINE.memory = saved.IZA_ENGINE.memory || [];
    IZA_ENGINE.usedRecently = saved.IZA_ENGINE.usedRecently || [];
  }

  // Restore the UI using the view history
  if (state.viewHistory && state.viewHistory.length > 0) {
    exitViewMode();
    return true;
  }
  return false;
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
  return;
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
    if (!r) return `Conversa aberta · minimo ${MIN_INSPIRED_ROUNDS} rodadas`;
    if (r < MIN_INSPIRED_ROUNDS) {
      return `Rodada ${r} de ${MIN_INSPIRED_ROUNDS}`;
    }
    return `Rodada ${r} · ja da para encerrar se fizer sentido`;
  }
  const total = trackTotalSteps(trackKey);
  return `Passo ${Math.min(total, stepIndex + 1)} de ${total}`;
}

function inspiredCanClose() {
  return (state.inspiredRounds || 0) >= MIN_INSPIRED_ROUNDS;
}

function inspiredRoundsRemaining() {
  return Math.max(0, MIN_INSPIRED_ROUNDS - (state.inspiredRounds || 0));
}

function resolveStepPrompt(track, step) {
  if (state.trackKey === "inspirada" && step?.key === "loop") {
    if (inspiredCanClose()) {
      return "Escreva mais um pouco. Se o fio ja amadureceu, digite 'encerrar'.";
    }
    const remaining = inspiredRoundsRemaining();
    return `Escreva mais um pouco. Ainda faltam ${remaining} rodada${remaining === 1 ? "" : "s"} antes do fechamento.`;
  }
  return step?.prompt || "";
}

function renderCardShell(innerHtml) {
  return `<section class="card iza-panel-shell iza-fade" id="izaView">${innerHtml}</section>`;
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
  saveStateToLocal();
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
      <div class="iza-nav__status">${replayTag}</div>
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
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
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
    softeners: ["", "Se fizer sentido,", "Talvez,", "Pode ser que,"],
    closings: ["", "Se quiser, siga.", "Continue quando fizer sentido."]
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

function presenceMessageText(p) {
  if (!p) return "";
  if (p.key === "H") {
    const mix = state.presenceMix || {};
    const parts = Object.entries(mix)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
      .join(" · ");
    return `Hoje sua IZA sera hibrida (${parts}). Ela alterna acolhimento, recorte e silencio conforme o modo como sua escrita pede companhia.`;
  }

  const base = {
    A: "Vou aparecer de leve, abrindo espaco para voce escutar melhor o proprio texto.",
    B: "Vou seguir perto, com calor e escuta, sem tomar o lugar da sua escrita.",
    C: "Vou entrar com recorte e perguntas de precisao, para fazer a ideia se sustentar melhor.",
    D: "Vou quase sumir: pouco ruido, quase nenhum comentario, mais campo para voce escrever."
  };
  return (base[p.key] || "") + " Se quiser, da para recalibrar isso depois.";
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

function presencePhraseSets() {
  return {
    A: {
      softeners: ["", "Se fizer sentido,", "Talvez,", "Pode ser que,"],
      closings: ["", "Se quiser, siga.", "Continue quando fizer sentido."]
    },
    B: {
      softeners: ["Entendi.", "Estou com voce.", "Obrigada por dividir isso.", "Vamos por partes."],
      closings: ["Se quiser, eu sigo com voce.", "Pode ir no seu ritmo.", "Vamos com calma."]
    },
    C: {
      softeners: ["Vamos ao nucleo.", "Certo. Vamos delimitar.", "Foco no ponto central."],
      closings: ["Responda em uma frase.", "Agora sustente isso.", "Siga com precisao."]
    },
    D: {
      softeners: [""],
      closings: ["Continue.", "Mais.", ""]
    }
  };
}

function presenceWrap(p, coreText) {
  const mix = state.presenceMix;
  const sets = presencePhraseSets();
  let soft = "";
  let close = "";

  if (p.key === "H" && mix) {
    soft =
      weightedPick(
        sets.A.softeners,
        sets.B.softeners,
        sets.C.softeners,
        sets.D.softeners,
        mix
      ) || "";
    close =
      weightedPick(
        sets.A.closings,
        sets.B.closings,
        sets.C.closings,
        sets.D.closings,
        mix
      ) || "";
  } else {
    const current = sets[p.key] || sets.A;
    soft = pick(current.softeners || [""]);
    close = pick(current.closings || [""]);
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

function refinedPresenceClosing(p) {
  const base = {
    A: ["", "Se quiser, siga.", "Vale cavar mais um pouco.", "Continue quando a proxima frase aparecer."],
    B: ["", "Pode ir no seu ritmo.", "Se quiser, eu sigo com voce.", "Ha algo ai que ainda pode florescer."],
    C: ["", "Responda em uma frase.", "Nomeie melhor o ponto.", "Agora sustente isso."],
    D: ["", "Siga."]
  };

  if (p.key === "H" && state.presenceMix) {
    const mix = state.presenceMix;
    const pickFrom =
      (mix.D || 0) > 0.5 ? base.D :
        (mix.C || 0) > 0.4 ? base.C :
          (mix.B || 0) > 0.35 ? base.B : base.A;
    return pick(pickFrom);
  }

  return pick(base[p.key] || base.A);
}

function refinedLeadLine(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t || p.key === "D") return "";

  if (p.key === "H" && state.presenceMix) {
    const mix = state.presenceMix;
    if ((mix.D || 0) > 0.55) return "";
    if ((mix.C || 0) > 0.45) return pick(["Vamos ao nucleo.", "Delimite o ponto central.", "Recorte melhor o que apareceu."]);
    if ((mix.B || 0) > 0.35) return pick(["Estou com voce.", "Isso importa.", "Obrigada por trazer isso."]);
    return pick(["Entendi.", "Certo.", "Vamos olhar isso melhor."]);
  }

  if (p.key === "A") return pick(["Entendi.", "Certo.", "Vamos deixar isso respirar."]);

  if (p.key === "B") {
    const ct = state.centerType;
    const bank = [
      "Obrigada por confiar isso ao texto.",
      "Estou com voce, sem pressa.",
      "Entendi. Isso pede escuta.",
      ct === "ferida" ? "Isso toca num ponto sensivel." : "",
      ct === "desejo" ? "Isso tem pulsacao." : "",
      ct === "pergunta" ? "Essa pergunta esta viva." : "",
      ct === "afirmacao" ? "Isso afirma algo importante." : ""
    ].filter(Boolean);
    return pick(bank);
  }

  if (p.key === "C") return pick(["Vamos ao nucleo.", "Seja preciso.", "Delimite o que esta em jogo."]);

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
  const lead = refinedLeadLine(userText);
  const lens = centerLensLine();
  const closing = refinedPresenceClosing(p);
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
    ct === "ferida" ? "Tente em 7 palavras: o que, de fato, encosta nessa ferida?" :
      ct === "desejo" ? "Tente em 7 palavras: o que segura esse desejo agora?" :
        ct === "pergunta" ? "Tente em 7 palavras: qual parte da pergunta pesa mais?" :
          ct === "afirmacao" ? "Tente em 7 palavras: que prova sustenta isso?" :
            "Tente em 7 palavras com lugar ou gesto: o que voce quer dizer?";

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

  const fallbackQ = `Falando em “${fallbackUserAnchor(t)}”, o que aqui pede um nome mais preciso?`;
  return presenceWrap(p, composeReply(p, t, shortMirror(p, t), fallbackQ, false));
}

// -------------------- OPÇÃO A (centro) --------------------
function centerChoicePrompt(fragment) {
  const p = state.presence || PRESENCES.A;
  const frag = swapPronouns((fragment || "").trim());

  if (p.key === "D") {
    return `“${frag}—”\nIsso está mais perto de pergunta, afirmação, ferida ou desejo?\nSe preferir, escreva do seu jeito.`;
  }
  if (p.key === "C") {
    return `Você disse: “${frag}—”. Classifique o núcleo com precisão: pergunta, afirmação, ferida ou desejo.\nSe preferir, escreva do seu jeito.`;
  }
  if (p.key === "B") {
    return `Ao ler “${frag}—”, eu sinto um núcleo aí.\nIsso está mais perto de uma pergunta, uma afirmação, uma ferida ou um desejo?\nSe preferir, escreva do seu jeito.`;
  }
  return `Quando você diz “${frag}—”, isso está mais perto de uma pergunta, uma afirmação, uma ferida ou um desejo?\nSe preferir, escreva do seu jeito.`;
}

function interpretCenterChoice(text) {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const map = { a: "pergunta", b: "afirmacao", c: "ferida", d: "desejo" };
  let choice = map[t[0]] || null;

  if (!choice) {
    if (/\bpergunta\b/.test(normalized)) choice = "pergunta";
    else if (/\bafirmac/.test(normalized)) choice = "afirmacao";
    else if (/\bferida\b/.test(normalized)) choice = "ferida";
    else if (/\bdesej/.test(normalized)) choice = "desejo";
  }

  if (!choice) return { type: "livre", label: "o seu próprio modo de dizer" };
  const labelMap = {
    pergunta: "uma pergunta",
    afirmacao: "uma afirmação",
    ferida: "uma ferida",
    desejo: "um desejo"
  };
  return { type: choice, label: labelMap[choice] || "o seu próprio modo de dizer" };
}

function refinedCenterChoicePrompt(fragment) {
  const p = state.presence || PRESENCES.A;
  const frag = swapPronouns((fragment || "").trim());

  if (p.key === "D") {
    return `"${frag}"\nIsso está mais perto de pergunta, afirmação, ferida ou desejo?\nSe preferir, escreva do seu jeito.`;
  }
  if (p.key === "C") {
    return `Você disse: "${frag}". Classifique o núcleo com precisão: pergunta, afirmação, ferida ou desejo.\nSe preferir, nomeie do seu jeito.`;
  }
  if (p.key === "B") {
    return `Ao ler "${frag}", eu sinto um núcleo vivo aqui.\nO que nomeia melhor isso: uma pergunta, uma afirmação, uma ferida ou um desejo?\nSe preferir, escreva do seu jeito.`;
  }
  return `Quando você diz "${frag}", qual nome sustenta melhor esse núcleo: pergunta, afirmação, ferida ou desejo?\nSe preferir, escreva do seu jeito.`;
}

// -------------------- TRACKS --------------------
const TRACKS = {
  iniciante: {
    name: "Jornada Iniciante (4 passos)",
    steps: [
      {
        key: "nucleo",
        prompt: "Passo 1 — Nucleo\nEscreva livremente sobre o que quer trabalhar hoje.",
        onUser: (t) => izaReply(t) + "\n\nAgora nomeie o centro disso em 1 frase."
      },
      {
        key: "centro",
        prompt: "Em 1 frase, qual e o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return refinedCenterChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escolha um caminho ou nomeie com suas palavras.",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
              p.key === "C" ? `Registrado: ${parsed.label}.` :
                p.key === "B" ? `Certo — vamos tratar o centro como ${parsed.label}.` :
                  `Ok — vamos tratar o centro como ${parsed.label}.`;
          return `${lead}\n\nPasso 2 — Atrito\nO que esta em jogo aqui: conflito, desejo, risco ou duvida?`;
        }
      },
      {
        key: "atrito",
        prompt: "Passo 2 — Atrito\nO que esta em jogo aqui?",
        onUser: (t) => {
          const hint =
            state.centerType === "pergunta" ? "Qual parte da pergunta dói mais?" :
              state.centerType === "afirmacao" ? "O que ameaça essa afirmação?" :
                state.centerType === "ferida" ? "O que encosta nessa ferida?" :
                  state.centerType === "desejo" ? "O que atrapalha esse desejo?" :
                    "Qual é a tensão aqui?";
          return izaReply(t) + `\n\nPasso 3 — Cena\nTraga uma cena concreta: lugar, alguem e um gesto. ${hint}`;
        }
      },
      {
        key: "cena",
        prompt: "Passo 3 — Cena\nTraga uma cena concreta: lugar, alguem e um gesto.",
        onUser: (t) => izaReply(t) + "\n\nPasso 4 — Frase que fica\nEscreva a frase que merece permanecer."
      },
      {
        key: "frase_final",
        prompt: "Passo 4 — Frase que fica\nEscreva a frase que merece permanecer.",
        onUser: (t) => {
          state.finalDraft = (t || "").trim();
          return izaReply(t) + "\n\nFechamos esta volta. Vou preparar o seu registro.";
        },
        endScreen: true
      }
    ]
  },

  intermediaria: {
    name: "Jornada Intermediaria (7 passos)",
    steps: [
      {
        key: "tema",
        prompt: "Passo 1 — Tema\nEm poucas palavras, qual e o tema?",
        onUser: (t) => izaReply(t) + "\n\nPasso 2 — Centro\nDiga o centro disso em 1 frase."
      },
      {
        key: "centro",
        prompt: "Passo 2 — Centro\nDiga o centro disso em 1 frase.",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return refinedCenterChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escolha um caminho ou formule do seu jeito.",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
              p.key === "C" ? `Registrado: ${parsed.label}.` :
                p.key === "B" ? `Certo — tratemos o centro como ${parsed.label}.` :
                  `Ok — tratemos o centro como ${parsed.label}.`;
          return `${lead}\n\nPasso 3 — Atrito\nO que esta em jogo: conflito, regra, risco ou desejo?`;
        }
      },
      {
        key: "atrito",
        prompt: "Passo 3 — Atrito\nO que esta em jogo?",
        onUser: (t) => izaReply(t) + "\n\nPasso 4 — Concreto\nMostre onde isso aparece: cena, fala, gesto ou lugar."
      },
      {
        key: "concreto",
        prompt: "Passo 4 — Concreto\nOnde isso aparece de forma concreta?",
        onUser: (t) => izaReply(t) + "\n\nPasso 5 — Contraste\nNomeie duas forcas em tensao (ex.: medo x vontade)."
      },
      {
        key: "contraste",
        prompt: "Passo 5 — Contraste\nDuas forcas em tensao:",
        onUser: (t) => izaReply(t) + "\n\nPasso 6 — Sintese\nReuna tudo em 3 linhas."
      },
      {
        key: "sintese",
        prompt: "Passo 6 — Sintese\nReuna tudo em 3 linhas.",
        onUser: (t) => izaReply(t) + "\n\nPasso 7 — Forma final\nEscreva a versao que vale levar adiante."
      },
      {
        key: "forma_final",
        prompt: "Passo 7 — Forma final\nEscreva a versao que voce quer sustentar.",
        onUser: (t) => {
          state.finalDraft = (t || "").trim();
          return izaReply(t) + "\n\nFechamos esta travessia. Vou preparar o seu registro.";
        },
        endScreen: true
      }
    ]
  },

  inspirada: {
    name: "Jornada Inspirada (conversa aberta)",
    steps: [
      {
        key: "abertura",
        prompt: "Sobre o que voce quer escrever hoje?",
        onUser: (t) => izaReply(t) + "\n\nSe fosse nomear o centro em 1 frase, como diria?"
      },
      {
        key: "centro",
        prompt: "Em 1 frase, qual e o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return refinedCenterChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escolha um caminho ou diga do seu jeito.",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
              p.key === "C" ? `Registrado: ${parsed.label}.` :
                p.key === "B" ? `Certo — vamos caminhar com ${parsed.label}.` :
                  `Ok — vamos caminhar com ${parsed.label}.`;
          return `${lead}\n\nAgora siga no fluxo: escreva mais um pouco, sem vigiar demais a primeira resposta.`;
        }
      },
      {
        key: "loop",
        prompt: "Escreva mais um pouco.",
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
  state.finalClosure = null;
  state.sent = false;

  state.registerStatus = "idle";
  state.registerError = "";

  state.registerFinalDone = false;
  state.registerGiftDone = false;

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
  const prompt = resolveStepPrompt(track, step);

  showPrompt(track.name, prompt, (text) => {
    const userText = (text || "").trim();
    if (!userText) return;

    if (state.trackKey === "inspirada" && userText.toLowerCase().startsWith("encerrar")) {
      if (inspiredCanClose()) {
        showFinalizeScreen();
        return;
      }

      const remaining = inspiredRoundsRemaining();
      showIza(
        `Ainda não vou fechar. Quero te ouvir por pelo menos ${MIN_INSPIRED_ROUNDS} rodadas nessa trilha.\n\nFaltam ${remaining} rodada${remaining === 1 ? "" : "s"}. Segue mais um pouco no fluxo.`,
        () => showStep()
      );
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
        <div class="iza-top__main">
          <h2 class="iza-title">${escapeHtml(title)}</h2>
          ${progHtml}
        </div>
        <div class="iza-top__side">
          <div class="iza-user">${escapeHtml(userDisplayName())}</div>
          <div class="iza-sub">${escapeHtml(izaDisplayName())}</div>
        </div>
      </div>

      <p class="iza-question">${escapeHtml(question).replace(/\n/g, "<br>")}</p>

      <textarea id="txt" class="input-area" rows="5" ${canSend ? "" : "disabled"} placeholder="${canSend ? "" : "Esta resposta ja foi registrada."}"></textarea>

      ${canSend
        ? `<button id="btnSend" class="button">Registrar resposta</button>`
        : `<div class="iza-hint">Voce esta revendo uma etapa anterior. O texto enviado fica guardado no registro.</div>`
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
        <div class="iza-top__main">
          <h2 class="iza-title">${escapeHtml(izaDisplayName())}</h2>
          ${progHtml}
        </div>
        <div class="iza-top__side">
          <div class="iza-user">${escapeHtml(userDisplayName())}</div>
          <div class="iza-sub">em diálogo</div>
        </div>
      </div>

      <div class="message iza-message">
        ${escapeHtml(text).replace(/\n/g, "<br>")}
      </div>

      ${canContinue
        ? `<button class="button" id="btnNext">Seguir</button>`
        : `<div class="iza-hint">Voce esta revendo uma fala anterior da IZA.</div>`
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
    `IZA no Cordel 2.0 - Registro\n` +
    `Nome: ${state.name}\nEmail: ${state.email}\n` +
    `Municipio: ${state.municipio || ""}\nEstado: ${state.estadoUF || ""}\nOrigem: ${state.origem || ""}\n` +
    `Trilha: ${state.trackKey}\nPresenca: ${state.presence?.name || state.presenceKey}\n` +
    `Inicio: ${state.startedAtISO}\nFim: ${nowISO()}\n` +
    `---\n\n`;

  const body = state.turns
    .map((t) => {
      const who = t.role === "user" ? "VOCE" : "IZA";
      return `${who}:\n${t.text}\n`;
    })
    .join("\n");

  return header + body;
}

function userTurnsOnly() {
  return state.turns.filter((t) => t.role === "user" && String(t.text || "").trim());
}

function normalizeInlineText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

const JOURNEY_STOPWORDS = new Set([
  "a", "ao", "aos", "aquela", "aquele", "aqueles", "as", "ate", "com", "como", "da", "das",
  "de", "dela", "dele", "deles", "depois", "do", "dos", "e", "ela", "ele", "eles", "em",
  "entre", "era", "essa", "esse", "esta", "estao", "estar", "este", "eu", "foi", "ha",
  "isso", "isto", "ja", "la", "mais", "mas", "me", "mesmo", "meu", "minha", "muito", "na",
  "nas", "nem", "no", "nos", "nossa", "nosso", "num", "numa", "o", "os", "ou", "para",
  "pela", "pelas", "pelo", "pelos", "por", "porque", "pra", "que", "quem", "se", "sem",
  "ser", "seu", "seus", "sua", "suas", "tambem", "te", "tem", "tinha", "to", "tu", "um", "uma", "voce",
  "voces", "texto", "escrita", "coisa", "aqui", "agora", "hoje", "ontem", "amanha", "gente",
  "tipo", "sobre", "fazer", "feito", "tenho", "tava", "estou", "quero", "queria", "vai",
  "vou", "fica", "ficou", "so", "mim", "meus", "minhas", "dele", "dela"
]);

function clipText(text, max = 160) {
  const value = normalizeInlineText(text);
  if (!value) return "";
  return value.length > max ? value.slice(0, max - 3).trim() + "..." : value;
}

function clipMultilineText(text, max = 320) {
  const value = String(text || "").replace(/\r/g, "").trim();
  if (!value) return "";
  return value.length > max ? value.slice(0, max - 3).trim() + "..." : value;
}

function normalizeSearchText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function keywordRoot(token) {
  return token.length <= 5 ? token : token.slice(0, 5);
}

function scoreKeywordToken(token, contextWeight = 1) {
  const lengthBonus = Math.min(2, Math.max(0, token.length - 5) * 0.2);
  const symbolicBonus = /(?:dade|mento|cao|coes|gem|ario|arios|eiro|eira|ismo|ura|ez|al|or|orio)$/.test(token)
    ? 0.8
    : 0;
  return contextWeight + lengthBonus + symbolicBonus;
}

function tokenizeForKeywords(text) {
  return normalizeSearchText(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !JOURNEY_STOPWORDS.has(token));
}

function listToNaturalLanguage(items) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} e ${values[values.length - 1]}`;
}

function extractJourneyKeywords() {
  const counts = Object.create(null);
  const seenRoots = new Set();
  const userTexts = userTurnsOnly().map((t) => normalizeInlineText(t.text)).filter(Boolean);
  const weightedSources = [
    { text: state.finalDraft || "", weight: 4 },
    { text: extractEmergentPhrase(), weight: 3 },
    { text: userTexts.slice(-Math.min(6, userTexts.length)).join(" "), weight: state.trackKey === "inspirada" ? 3 : 2 },
    { text: userTexts.join(" "), weight: 2 },
    { text: userTexts.slice(0, Math.min(3, userTexts.length)).join(" "), weight: 1.5 }
  ];

  weightedSources.forEach(({ text, weight }) => {
    tokenizeForKeywords(text).forEach((token) => {
      counts[token] = (counts[token] || 0) + scoreKeywordToken(token, weight);
    });
  });

  if (state.centerType && !["", "livre"].includes(state.centerType)) {
    counts[state.centerType] = (counts[state.centerType] || 0) + 2;
  }

  userTexts.forEach((text, index) => {
    const emphasisWeight = index >= userTexts.length - 4 ? 1.25 : 0.7;
    tokenizeForKeywords(text).forEach((token) => {
      counts[token] = (counts[token] || 0) + scoreKeywordToken(token, emphasisWeight);
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .filter((token) => {
      const root = keywordRoot(token);
      if (seenRoots.has(root)) return false;
      seenRoots.add(root);
      return true;
    })
    .slice(0, 6);
}

function buildJourneySynthesis(summary, keywords) {
  const trackName = (TRACKS[state.trackKey]?.name || "jornada").replace(/\s*\([^)]*\)\s*/g, "").trim();
  const focus = listToNaturalLanguage((keywords || []).slice(0, 3));
  const centerMap = {
    pergunta: "uma pergunta que pedia desdobramento",
    afirmacao: "uma afirmacao que precisava sustento",
    ferida: "uma ferida que pediu nome e contorno",
    desejo: "um desejo que buscou forma",
    livre: "um nucleo ainda aberto"
  };

  const lines = [];
  lines.push(
    focus
      ? `Na ${trackName.toLowerCase()}, seu texto foi abrindo caminho em torno de ${focus}.`
      : `Na ${trackName.toLowerCase()}, seu texto foi abrindo caminho e encontrando um eixo proprio.`
  );

  if (state.centerType) {
    lines.push(`No percurso, apareceu ${centerMap[state.centerType] || "um nucleo que foi se revelando melhor"}.`);
  } else if (
    summary.firstText &&
    summary.lastText &&
    normalizeInlineText(summary.firstText) !== normalizeInlineText(summary.lastText)
  ) {
    lines.push("Do primeiro impulso ao fechamento, a escrita ganhou mais nitidez e recorte.");
  } else {
    lines.push("Ao longo da conversa, a ideia foi se deixando ver com mais clareza.");
  }

  if (summary.emergentPhrase) {
    lines.push(`Ficou ecoando esta linha: "${clipText(summary.emergentPhrase, 120)}".`);
  } else if (summary.lastText) {
    lines.push(`No fim, ficou mais visivel isto: "${clipText(summary.lastText, 120)}".`);
  }

  const synthesis = lines.join(" ").replace(/\s+/g, " ").trim();
  return synthesis.length > 420 ? synthesis.slice(0, 417).trim() + "..." : synthesis;
}

function buildFallbackLiteraryGift(keywords) {
  const seed = keywords[0] || "palavra";
  const companion = keywords[1] || "eco";
  return {
    source: "fallback",
    seed,
    intro: "Não encontrei um eco direto na biblioteca agora, mas IZA não te deixa sair de mãos vazias.",
    fragment: `Guarde ${seed}. Quando a trilha parece terminar, ela ainda conversa com ${companion}. O que ficou vivo aqui talvez seja o começo de outra frase.`,
    author: "IZA",
    title: "Eco de encerramento",
    matchedKeywords: [seed, companion].filter(Boolean)
  };
}

function normalizeGiftResponse(rawGift, payload) {
  if (!rawGift || !rawGift.fragment) {
    return buildFallbackLiteraryGift(payload.keywords || []);
  }

  const fragment = clipMultilineText(rawGift.fragment, 320);
  if (!fragment) return buildFallbackLiteraryGift(payload.keywords || []);

  return {
    source: rawGift.source || "poems_sheet",
    seed: rawGift.seed || payload.keywords?.[0] || "",
    intro:
      rawGift.intro ||
      "Antes de encerrar, recolhi alguns rastros do que você deixou pelo caminho e encontrei este eco.",
    fragment,
    author: rawGift.author || "Autor desconhecido",
    title: rawGift.title || "Trecho sem título",
    matchedKeywords: Array.isArray(rawGift.matchedKeywords)
      ? rawGift.matchedKeywords.filter(Boolean).slice(0, 5)
      : (payload.keywords || []).slice(0, 3)
  };
}

function buildGiftLookupFallback(payload, response) {
  const gift = buildFallbackLiteraryGift(payload.keywords || []);
  const reason = response?.error || "gift_lookup_unavailable";
  return {
    ...gift,
    source: "fallback_local",
    intro:
      reason === "timeout"
        ? "A biblioteca poética demorou além do esperado para responder. IZA guardou o seu fechamento e te deixa este presente por agora."
        : reason === "network"
          ? "A ligação com a biblioteca poética falhou neste momento. IZA guardou o seu percurso e te entrega este fecho por agora."
          : "A biblioteca poética encontrou um problema ao buscar o presente. IZA guardou o seu percurso e te entrega este fecho por agora."
  };
}

function renderGiftLead(source) {
  if (source === "associated_poem") {
    return "Nem sempre o encontro vem por espelho exato. Às vezes ele aparece por vizinhança de imagens e linguagem.";
  }
  if (source === "iza_blessing" || source === "fallback") {
    return "Nem todo eco chega por um livro já aberto. Às vezes ele nasce do que ficou vibrando no seu texto.";
  }
  return "Nem sempre a trilha termina onde acaba. Às vezes ela ecoa em outro verso.";
}

function extractEmergentPhrase() {
  const source =
    normalizeInlineText(state.finalDraft) ||
    normalizeInlineText(userTurnsOnly().slice(-1)[0]?.text) ||
    normalizeInlineText(userTurnsOnly()[0]?.text);

  if (!source) return "";

  const sentences = source.match(/[^.!?]+[.!?]?/g) || [source];
  const best =
    sentences.map((s) => normalizeInlineText(s)).find((s) => s.length >= 24) ||
    normalizeInlineText(sentences[0]);

  return best.length > 180 ? best.slice(0, 177).trim() + "..." : best;
}

function buildFinalSummary() {
  const userTurns = userTurnsOnly();
  const base = {
    firstText: normalizeInlineText(userTurns[0]?.text),
    lastText:
      normalizeInlineText(state.finalDraft) ||
      normalizeInlineText(userTurns.slice(-1)[0]?.text),
    emergentPhrase: extractEmergentPhrase()
  };
  const keywords = extractJourneyKeywords();
  return {
    ...base,
    keywords,
    journeySynthesis: buildJourneySynthesis(base, keywords)
  };
}

function buildFinalDraftBlock() {
  const draft = (state.finalDraft || "").trim();
  if (!draft) return "";
  return `\n\n---\nTEXTO FINAL (rascunho):\n${draft}\n`;
}

function buildFinalRecordTranscript(payload) {
  const parts = [payload.baseTranscript || buildTranscript() + buildFinalDraftBlock()];

  if (payload.journeySynthesis) {
    parts.push(`\n---\nSÍNTESE DA JORNADA:\n${payload.journeySynthesis}\n`);
  }

  if (payload.keywords?.length) {
    parts.push(`\nPALAVRAS-CHAVE:\n${payload.keywords.join(", ")}\n`);
  }

  if (payload.literaryGift?.fragment) {
    parts.push(
      `\nPRESENTE LITERÁRIO DA IZA:\n${payload.literaryGift.intro ? payload.literaryGift.intro + "\n\n" : ""}${payload.literaryGift.fragment}\n` +
      `Crédito: ${payload.literaryGift.author || "IZA"} - ${payload.literaryGift.title || "Presente"}\n`
    );
  }

  return parts.join("");
}

function renderKeywordTags(keywords) {
  const values = (keywords || []).filter(Boolean);
  if (!values.length) return "";
  return `
    <div class="iza-keywords">
      ${values.map((keyword) => `<span class="iza-keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>
  `;
}

function renderLiteraryGift(payload) {
  const activeKeywords = payload.literaryGift?.matchedKeywords?.length
    ? payload.literaryGift.matchedKeywords
    : (payload.keywords || []);
  const keywordsHtml = renderKeywordTags(activeKeywords);

  if (payload.literaryGiftStatus === "loading") {
    return `
      <div class="iza-gift">
        <p class="iza-section-title"><strong>Presente literário da IZA</strong></p>
        <p class="iza-copy">Antes de encerrar, recolhi alguns rastros do que você deixou pelo caminho.</p>
        <p class="iza-copy iza-copy--soft">Separei palavras que insistiram em permanecer acesas.</p>
        ${keywordsHtml}
        <div class="message">IZA está procurando um eco poético para essas pistas...</div>
      </div>
    `;
  }

  const gift = payload.literaryGift || buildFallbackLiteraryGift(payload.keywords || []);
  const credit = [gift.author, gift.title].filter(Boolean).join(" - ");

  return `
    <div class="iza-gift">
      <p class="iza-section-title"><strong>Presente literário da IZA</strong></p>
      <p class="iza-copy">${escapeHtml(renderGiftLead(gift.source))}</p>
      <p class="iza-copy iza-copy--soft">${escapeHtml(gift.intro || "")}</p>
      ${keywordsHtml}
      <div class="message">${escapeHtml(gift.fragment || "").replace(/\n/g, "<br>")}</div>
      <p class="iza-gift__meta">${escapeHtml(credit)}</p>
    </div>
  `;
}

function updateLatestFinalViewPayload(patch) {
  for (let i = state.viewHistory.length - 1; i >= 0; i--) {
    if (state.viewHistory[i].type !== "final") continue;
    state.viewHistory[i].payload = { ...state.viewHistory[i].payload, ...patch };
    break;
  }
  saveStateToLocal();
}

function updateFinalClosureUI() {
  if (!state.finalClosure) return;

  const giftNode = document.getElementById("giftPanel");
  if (giftNode) giftNode.innerHTML = renderLiteraryGift(state.finalClosure);

  const outNode = document.getElementById("out");
  if (outNode) outNode.value = state.finalClosure.transcript || "";
}

function requestLiteraryGift(payload) {
  return new Promise((resolve) => {
    const journeyText = userTurnsOnly()
      .slice(-Math.min(8, userTurnsOnly().length))
      .map((turn) => normalizeInlineText(turn.text))
      .filter(Boolean)
      .join(" || ");
    const callbackName =
      "__izaGiftCb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    const params = new URLSearchParams({
      action: "gift",
      callback: callbackName,
      keywords: (payload.keywords || []).slice(0, 8).join("|"),
      summary: clipText(payload.journeySynthesis, 280),
      seedText: clipText(
        [payload.emergentPhrase, payload.lastText, state.finalDraft].filter(Boolean).join(" || "),
        520
      ),
      journeyText: clipText(journeyText, 900),
      trackKey: state.trackKey || "",
      presenceKey: state.presenceKey || ""
    });

    const script = document.createElement("script");
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data || { ok: false, error: "empty_response" });
    };

    timer = window.setTimeout(() => {
      cleanup();
      resolve({ ok: false, error: "timeout" });
    }, GIFT_LOOKUP_TIMEOUT_MS);

    script.src = `${WEBAPP_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      resolve({ ok: false, error: "network" });
    };

    document.body.appendChild(script);
  });
}

function syncLiteraryGiftForFinal() {
  const payload = state.finalClosure;
  if (!payload || payload.literaryGiftStatus !== "loading") return;

  requestLiteraryGift(payload)
    .then((response) => {
      const gift = response?.ok === false
        ? buildGiftLookupFallback(payload, response)
        : normalizeGiftResponse(response?.gift, payload);
      state.finalClosure = {
        ...state.finalClosure,
        literaryGift: gift,
        literaryGiftStatus: gift.source === "fallback" || gift.source === "fallback_local" ? "fallback" : "ready",
        literaryGiftDiagnostics: response?.diagnostics || null
      };
      state.finalClosure.transcript = buildFinalRecordTranscript(state.finalClosure);
      updateLatestFinalViewPayload(state.finalClosure);
      updateFinalClosureUI();
      safeRegisterFinalGift(state.finalClosure);
    })
    .catch((error) => {
      const gift = buildGiftLookupFallback(payload, {
        ok: false,
        error: String(error?.message || error || "network")
      });
      state.finalClosure = {
        ...state.finalClosure,
        literaryGift: gift,
        literaryGiftStatus: "fallback"
      };
      state.finalClosure.transcript = buildFinalRecordTranscript(state.finalClosure);
      updateLatestFinalViewPayload(state.finalClosure);
      updateFinalClosureUI();
      safeRegisterFinalGift(state.finalClosure);
    });
}

function renderSendStatus() {
  if (state.registerStatus === "sending") return "IZA está guardando sua síntese e seu registro...";

  if (state.registerStatus === "sent") {
    return "Registro guardado. Se você informou um e-mail válido, a síntese e o presente literário seguem em envio sem travar o encerramento.";
  }

  if (state.registerStatus === "failed") {
    return `Não consegui registrar automaticamente (${state.registerError || "erro de rede"}). Seu fechamento ficou aqui na tela: copie o registro abaixo se quiser preservar tudo agora.`;
  }

  return "Preparando o encerramento...";
}

function updateSendStatusUI() {
  const node = document.getElementById("sendStatus");
  if (node) node.innerHTML = renderSendStatus();
}

function renderFinalScreen(payload, fromHistory = false) {
  const summaryBlocks = [
    payload.firstText
      ? `
        <div class="iza-summary-item">
          <p class="iza-section-title"><strong>Primeira escrita</strong></p>
          <div class="message">${escapeHtml(payload.firstText)}</div>
        </div>`
      : "",
    payload.lastText
      ? `
        <div class="iza-summary-item">
          <p class="iza-section-title"><strong>Última versão</strong></p>
          <div class="message">${escapeHtml(payload.lastText)}</div>
        </div>`
      : "",
    payload.emergentPhrase
      ? `
        <div class="iza-summary-item">
          <p class="iza-section-title"><strong>Frase emergente</strong></p>
          <div class="message">${escapeHtml(payload.emergentPhrase)}</div>
        </div>`
      : ""
  ].filter(Boolean).join("");

  const synthesisHtml = payload.journeySynthesis
    ? `
      <div class="iza-gift">
        <p class="iza-section-title"><strong>Síntese da jornada</strong></p>
        <div class="message">${escapeHtml(payload.journeySynthesis)}</div>
      </div>
    `
    : "";

  render(
    renderCardShell(`
      <div class="iza-top">
        <div class="iza-top__main">
          <h2 class="iza-title">Encerramento da jornada</h2>
          <div class="iza-sub">${escapeHtml(userDisplayName())} - ${escapeHtml(izaDisplayName())}</div>
        </div>
        <div class="iza-top__side">
          <div class="iza-chip">Final</div>
        </div>
      </div>

      <p id="sendStatus" class="iza-status iza-status--soft">
        ${renderSendStatus()}
      </p>

      ${summaryBlocks ? `<div class="iza-summary-grid">${summaryBlocks}</div>` : ""}
      ${synthesisHtml}

      <div id="giftPanel">
        ${renderLiteraryGift(payload)}
      </div>

      <p class="iza-section-title"><strong>Registro completo</strong></p>
      <textarea id="out" class="input-area" rows="14">${escapeHtml(payload.transcript)}</textarea>

      <div class="iza-actions">
        <button class="button" onclick="copyOut()">Copiar registro</button>
        <button class="button" onclick="downloadTxt()">Baixar .txt</button>
        <button class="button ritual" onclick="location.reload()">Começar outro texto</button>
      </div>

      <p class="iza-copy iza-copy--quiet">
        Seu percurso ficou guardado com síntese, palavras-chave e um eco final da IZA.
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
        alert("Registro copiado.");
      } catch (e) {
        el("out").select();
        document.execCommand("copy");
        alert("Registro copiado.");
      }
  };

  window.downloadTxt = function () {
    const txt = el("out").value;
    const blob = new Blob(["\uFEFF", txt], { type: "text/plain;charset=utf-8" });
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
  const summary = buildFinalSummary();
  const payload = {
    ...summary,
    baseTranscript: buildTranscript() + buildFinalDraftBlock(),
    literaryGift: null,
    literaryGiftStatus: "loading"
  };

  payload.transcript = buildFinalRecordTranscript(payload);
  state.finalClosure = payload;

  safeRegisterFinal(payload);
  pushView({ type: "final", payload: state.finalClosure });
  renderFinalScreen(state.finalClosure, false);
  syncLiteraryGiftForFinal();
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
    await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "no-cors", // Crucial for Google Apps Script to avoid CORS errors
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    // In no-cors mode, the response is opaque, so we can't check r.ok
    // We assume success if the network request didn't throw an error.
    return true;
  } catch (e1) {
    try {
      await fetch(WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload)
      });
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

async function safeRegisterFinal(finalPayload) {
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
    journeySummary: finalPayload?.journeySynthesis || "",
    summary: finalPayload?.journeySynthesis || "",
    keywords: finalPayload?.keywords || [],
    keywordText: (finalPayload?.keywords || []).join(", "),
    escritos: finalPayload?.transcript || buildTranscript() + buildFinalDraftBlock(),
    transcript: finalPayload?.transcript || buildTranscript() + buildFinalDraftBlock(),
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

function safeRegisterFinalGift(finalPayload) {
  if (state.registerGiftDone) return;
  if (!finalPayload?.literaryGift) return;

  state.registerGiftDone = true;

  const gift = finalPayload.literaryGift;
  const payload = {
    ...buildRegisterBasePayload("final_gift"),
    startedAtISO: state.startedAtISO,
    endedAtISO: nowISO(),
    page: state.pageURL,
    finalDraft: state.finalDraft || "",
    journeySummary: finalPayload.journeySynthesis || "",
    summary: finalPayload.journeySynthesis || "",
    keywords: finalPayload.keywords || [],
    keywordText: (finalPayload.keywords || []).join(", "),
    transcript: finalPayload.transcript || "",
    literaryGift: gift.fragment || "",
    literaryGiftText: gift.fragment || "",
    literaryGiftTitle: gift.title || "",
    literaryGiftAuthor: gift.author || "",
    literaryGiftIntro: gift.intro || "",
    literaryGiftSource: gift.source || "",
    literaryGiftSeed: gift.seed || "",
    literaryGiftMatched: gift.matchedKeywords || []
  };

  postJsonRobust(payload).catch(() => {
    // falha externa nao interrompe o encerramento
  });
}

// -------------------- TESTE + PRESENÇA --------------------
const testQuestions = [
  {
    title: "Pista 1",
    q: "Quando voce escreve, o que ajuda a pensar melhor?",
    opts: [
      ["A", "Perguntas leves que me deixem pensar"],
      ["B", "Um tom proximo e acolhedor"],
      ["C", "Recorte claro do que importa"],
      ["D", "Pouquissima interferencia"]
    ]
  },
  {
    title: "Pista 2",
    q: "Quando o texto embaralha, o que te ajuda a reencontrar o fio?",
    opts: [
      ["A", "Uma pergunta aberta"],
      ["B", "Um convite para desenrolar"],
      ["C", "Um pedido direto de clareza"],
      ["D", "Silencio e espaco"]
    ]
  },
  {
    title: "Pista 3",
    q: "Que ritmo de conversa te serve melhor hoje?",
    opts: [
      ["A", "Calmo e leve"],
      ["B", "Conversado"],
      ["C", "Objetivo"],
      ["D", "Quase silencioso"]
    ]
  },
  {
    title: "Pista 4",
    q: "Hoje voce escreve mais para:",
    opts: [
      ["A", "Explorar ideias"],
      ["B", "Expressar algo pessoal"],
      ["C", "Organizar pensamento"],
      ["D", "So colocar no papel"]
    ]
  },
  {
    title: "Pista 5",
    q: "Como voce quer sentir a presenca da IZA?",
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
        <label class="iza-test-option">
          <input type="radio" name="q${i}" value="${val}"> ${escapeHtml(label)}
        </label>`
        )
        .join("");
      return `
      <div class="iza-test-block">
        <div class="iza-test-title">${escapeHtml(q.title)}</div>
        <div class="iza-test-question">${escapeHtml(q.q)}</div>
        ${opts}
      </div>`;
    })
    .join("");

  render(
    renderCardShell(`
      <div class="iza-top">
        <div class="iza-top__main">
          <h2 class="iza-title">Presença da IZA</h2>
          <div class="iza-sub">${escapeHtml(userDisplayName())}</div>
        </div>
        <div class="iza-top__side">
          <div class="iza-chip">Ajuste</div>
        </div>
      </div>

      <p class="iza-copy iza-copy--soft">
        Se quiser, escolha uma presenca fixa. Ou responda ao teste rapido para compor uma IZA <strong>hibrida</strong>.
      </p>

      <div class="iza-actions iza-actions--compact">
        <button class="button" onclick="setPresenceFixed('A')">A · Discreta</button>
        <button class="button" onclick="setPresenceFixed('B')">B · Calorosa</button>
        <button class="button" onclick="setPresenceFixed('C')">C · Firme</button>
        <button class="button" onclick="setPresenceFixed('D')">D · Minimalista</button>
      </div>

      <hr class="iza-divider">

      <h3 class="iza-kicker">Teste rapido para compor a presenca</h3>
      ${blocks}

      <div class="iza-actions">
        <button class="button" id="btnDone" disabled>Ver minha presenca</button>
        <button class="button ritual" onclick="showWelcome()">Voltar ao inicio</button>
      </div>

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
        <div class="iza-top__main">
          <h2 class="iza-title">${escapeHtml(p.name)}</h2>
          <div class="iza-sub">${escapeHtml(userDisplayName())} · presença definida</div>
          <div class="iza-sub">
            ${escapeHtml(state.municipio || "")}${state.municipio ? " · " : ""}${escapeHtml(state.estadoUF || "")}${(state.origem ? " · " + escapeHtml(state.origem) : "")}
          </div>
        </div>
        <div class="iza-top__side">
          <div class="iza-chip">${escapeHtml(p.key === "H" ? "Híbrida" : "Fixa")}</div>
        </div>
      </div>

      <div class="message iza-message">${escapeHtml(presenceMessageText(p))}</div>

      <p class="iza-section-title"><strong>Escolha o caminho da escrita</strong></p>
      <div class="iza-copy iza-copy--soft">Cada trilha acende um jeito diferente de cavar o texto.</div>
      <div class="iza-actions">
        <button class="button" onclick="startTrack('iniciante')">Seguir na iniciante</button>
        <button class="button" onclick="startTrack('intermediaria')">Ir para a intermediaria (7 passos)</button>
        <button class="button" onclick="startTrack('inspirada')">Abrir conversa livre</button>
      </div>

      <div class="iza-actions iza-actions--compact">
        <button class="button ritual" onclick="showPresenceTest()">Rever presenca</button>
      </div>

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
function setWelcomeError(message) {
  const node = document.getElementById("welcomeError");
  if (node) node.textContent = message || "";
}

function renderWelcomeScreen(payload, fromHistory = false) {
  const ufOptions = [
    `<option value="">Selecione…</option>`,
    ...BR_UFS.map((uf) => `<option value="${uf}">${uf}</option>`),
    `<option value="INTERNACIONAL">INTERNACIONAL</option>`
  ].join("");

  render(
    renderCardShell(`
      <div class="iza-top">
        <div class="iza-top__main">
          <h2 class="iza-title">IZA no Cordel 2.0</h2>
          <div class="iza-sub">Perguntar para pensar.</div>
        </div>
        <div class="iza-top__side">
          <div class="iza-chip">Início</div>
        </div>
      </div>

      <p class="iza-copy">
        IZA e uma ancestral de escrita: ela nao escreve por voce;
        ela faz perguntas para te ajudar a <strong>pensar, organizar e aprofundar</strong> o que seu texto ainda esta pedindo.
      </p>

      <p class="iza-copy iza-copy--soft">
        Antes da jornada, deixe seus dados e diga de onde voce chega.
      </p>

      <div id="welcomeError"></div>

      <input type="text" id="userName" class="input-area" placeholder="Seu nome" value="${escapeHtml(state.name)}">
      <input type="email" id="userEmail" class="input-area" placeholder="Seu e-mail" value="${escapeHtml(state.email)}">

      <input type="text" id="userMunicipio" class="input-area" placeholder="Município (ex.: Salvador)" value="${escapeHtml(state.municipio)}">

      <select id="userEstado" class="iza-field">
        ${ufOptions}
      </select>

      <div class="iza-label-group">
        <div class="iza-label-group__title">De onde voce vem</div>
        <div class="iza-radio">
          <label><input type="radio" name="origem" value="Oficina Cordel 2.0"> Oficina Cordel 2.0</label>
          <label><input type="radio" name="origem" value="Particular"> Particular</label>
        </div>
      </div>

      <button class="button" onclick="validateStart()">Comecar jornada</button>

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

  const missing = [];
  if (!state.name) missing.push("nome");
  if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) missing.push("e-mail valido");
  if (!state.municipio) missing.push("municipio");
  if (!state.estadoUF) missing.push("estado");
  if (!state.origem) missing.push("origem");

  if (missing.length) {
    setWelcomeError(`Falta preencher: ${missing.join(", ")}.`);
    return;
  }

  setWelcomeError("");

  // registro init (não trava)
  safeRegisterInit();

  showPresenceTest();
};

// init
document.addEventListener("DOMContentLoaded", () => {
  ensureBaseStyles();
  if (!loadAndResumeSession()) {
    showWelcome();
  }
});
