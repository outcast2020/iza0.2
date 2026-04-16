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
  "https://script.google.com/macros/s/AKfycby3eZEp55rzljLpfsHO-Lbq2v6HJeL0uSo8C3zSinZV_PK9zKQwUuRidaT8OuOekQa_/exec";
const APP_VARIANT = "iza0.2";

const MIN_INSPIRED_ROUNDS = 7;
const GIFT_LOOKUP_TIMEOUT_MS = 45000;

// -------------------- STATE --------------------
const state = {
  name: "",
  email: "",
  municipio: "",
  estadoUF: "", // "BA", "MG", ... ou "INTERNACIONAL"
  origem: "", // "Oficina Cordel 2.0" | "Particular"
  participantId: "",
  checkinUserId: "",
  checkinMatchStatus: "",
  checkinMatchMethod: "",
  teacherGroup: "",
  checkinLookupStatus: "idle", // idle|loading|matched|unmatched|ambiguous|error
  checkinLookupMessage: "",

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
  centerType: null, // "pergunta"|"afirmação"|"ferida"|"desejo"|"livre"
  centerSemanticTail: "",
  journeyRubric: null,
  doneChecklist: null,

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
    IZA_ENGINE.lastRuleName = saved.IZA_ENGINE.lastRuleName || "";
    IZA_ENGINE.lineHistory = saved.IZA_ENGINE.lineHistory || Object.create(null);
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
    .replaceAll("&", "&")
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
      stepKey: meta.stepKey || currentTrackStepKey(),
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

function presenceOptionName(key) {
  const names = {
    A: "Discreta",
    B: "Calorosa",
    C: "Firme",
    D: "Minimalista",
    H: "Híbrida"
  };
  return names[key] || "IZA";
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
    if (!r) return `Conversa aberta · mínimo ${MIN_INSPIRED_ROUNDS} rodadas`;
    if (r < MIN_INSPIRED_ROUNDS) {
      return `Rodada ${r} de ${MIN_INSPIRED_ROUNDS}`;
    }
    return `Rodada ${r} · já dá para encerrar se fizer sentido`;
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
      return "Escreva mais um pouco. Se o fio já amadureceu, digite 'encerrar'.";
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
  renderFromHistory(); // agora vai renderizar "ao vivo" com canSend/canContinue true
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
    closings: ["", "Se fizer sentido, segue daqui.", "Leva isso mais um passo."]
  },
  B: {
    key: "B",
    name: "IZA Calorosa",
    mirror: "short",
    maxQuestions: 1,
    softeners: ["Entendi.", "Estou com você.", "Certo.", "Obrigada por trazer isso."],
    closings: ["", "Pode ir no seu ritmo.", "Se quiser, seguimos daqui."]
  },
  C: {
    key: "C",
    name: "IZA Firme",
    mirror: "medium",
    maxQuestions: 2,
    softeners: ["Vamos focar.", "Certo.", "Ok. Vamos organizar."],
    closings: ["", "Agora vai ao ponto.", "Sustente isso em uma frase."]
  },
  D: {
    key: "D",
    name: "IZA Minimalista",
    mirror: "tiny",
    maxQuestions: 1,
    softeners: [""],
    closings: [""]
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
      .map(([k, v]) => `${presenceOptionName(k)}: ${Math.round(v * 100)}%`)
      .join(" · ");
    return `Hoje sua IZA será híbrida (${parts}). Ela alterna acolhimento, recorte e silêncio conforme o modo como sua escrita pede companhia.`;
  }

  const base = {
    A: "Vou aparecer de leve, abrindo espaço para você perceber o que seu próprio texto já sabe.",
    B: "Vou seguir perto, com calor e escuta, acolhendo o que aparecer sem tomar o lugar da sua escrita.",
    C: "Vou entrar com recorte, precisão e contraste, para a ideia ganhar forma e sustento.",
    D: "Vou quase sumir: mínimo ruído, quase nenhum comentário, mais campo para você escrever e decidir."
  };
  return (base[p.key] || "") + " Se quiser, dá para recalibrar isso depois.";
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
      softeners: [""],
      closings: ["", "Se fizer sentido, segue daqui.", "Leva isso mais um passo.", "Veja se isso pede um detalhe a mais."]
    },
    B: {
      softeners: [""],
      closings: ["", "Pode ir no seu ritmo.", "Se quiser, seguimos daqui.", "Eu fico por perto."]
    },
    C: {
      softeners: [""],
      closings: ["", "Agora vai ao ponto.", "Sustente isso em uma frase.", "Recorte o essencial."]
    },
    D: {
      softeners: [""],
      closings: [""]
    }
  };
}

function replyLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function lastReplyLine(text) {
  const lines = replyLines(text);
  return lines.length ? lines[lines.length - 1] : "";
}

function hasStepTransition(text) {
  return /(?:^|\n)(?:Passo|Etapa)\s+\d+|(?:^|\n)Agora\b|(?:^|\n)Se fosse nomear\b|(?:^|\n)Fechamos\b/i.test(
    String(text || "")
  );
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

  const lines = replyLines(coreText);
  const multiline = lines.length >= 2;
  const endsWithQuestion = /\?$/.test(lastReplyLine(coreText));
  const carriesNextStep = hasStepTransition(coreText);

  if (multiline) {
    soft = "";
  }
  if (multiline || carriesNextStep || endsWithQuestion) close = "";

  const prefix = soft ? soft + " " : "";
  const suffix = close ? "\n" + close : "";
  return (prefix + coreText + suffix).trim();
}

// -------------------- ELIZA ENGINE --------------------
const IZA_ENGINE = {
  memory: [],
  usedRecently: [],
  lastRuleName: "",
  lineHistory: Object.create(null)
};

function ensureLineHistory() {
  if (!IZA_ENGINE.lineHistory || typeof IZA_ENGINE.lineHistory !== "object") {
    IZA_ENGINE.lineHistory = Object.create(null);
  }
  return IZA_ENGINE.lineHistory;
}

function pickVariedLine(bucket, variants, maxRecent = 4) {
  const items = (variants || [])
    .map((variant, index) => {
      if (!variant) return null;
      if (typeof variant === "string") {
        return { key: `${bucket}_${index}_${variant}`, text: variant };
      }
      const text = String(variant.text || "").trim();
      if (!text) return null;
      return {
        key: String(variant.key || `${bucket}_${index}`),
        text
      };
    })
    .filter(Boolean);

  if (!items.length) return "";

  const history = ensureLineHistory();
  const recent = Array.isArray(history[bucket]) ? history[bucket] : [];
  const pool = items.filter((item) => !recent.includes(item.key));
  const chosen = pick(pool.length ? pool : items);
  if (!chosen) return "";

  history[bucket] = [chosen.key]
    .concat(recent.filter((key) => key !== chosen.key))
    .slice(0, maxRecent);

  return chosen.text;
}

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


function applyReasmb(template, match) {
  let out = template;
  for (let i = 1; i < match.length; i++) {
    const chunk = swapPronouns((match[i] || "").trim());
    out = out.replaceAll(`{${i}}`, chunk);
  }
  return out;
}


function ensureMeaningfulTemplateText(text, userText) {
  let out = String(text || "").trim();
  if (!out) return "";

  const anchor = fallbackUserAnchor(userText);

  out = out
    .replace(/"\s*—/g, `"${anchor}—`)
    .replace(/"\s*—/g, `"${anchor}—`)
    .replace(/\?\s*—/g, `"${anchor}—`)
    .replace(/''/g, `"${anchor}—`)
    .replace(/""/g, `"${anchor}—`);

  const onlyPunctuation = /^[\s.,;:!?()[\]{}'"`´—-]+$/;
  if (onlyPunctuation.test(out)) {
    return `Falando em "${anchor}—", o que você quer aprofundar agora?`;
  }

  return out;
}

function clipWords(text, maxWords = 14) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean
    .split(/\s+/)
    .slice(0, Math.max(1, maxWords))
    .join(" ")
    .replace(/[\s,;:.-]+$/, "")
    .trim();
}

function extractReflectiveAnchor(userText) {
  const raw = String(userText || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  const sentenceCandidates = raw
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const clauseCandidates = raw
    .split(/[;,:]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = sentenceCandidates.concat(clauseCandidates);
  if (!candidates.length) return "";

  const scored = candidates
    .map((candidate) => {
      const clean = candidate.replace(/^["'""]+|["'""]+$/g, "").trim();
      const words = clean.split(/\s+/).filter(Boolean);
      const lexicalScore = (clean.match(/\b(?:porque|quando|ainda|quase|coragem|medo|desejo|ferida|duvida|amor|vida|texto|caminho|imagem|cena)\b/gi) || []).length;
      const punctuationPenalty = /(?:[A-Z]{4,}|[a-z][A-Z])/.test(clean) ? 2 : 0;
      const score =
        Math.min(8, words.length) +
        lexicalScore * 2 -
        Math.max(0, words.length - 16) * 0.4 -
        punctuationPenalty;
      return { clean, words: words.length, score };
    })
    .filter((item) => item.clean.length >= 8)
    .sort((a, b) => b.score - a.score || a.words - b.words);

  const chosen = scored[0] || { clean: raw.split(/\s+/).slice(0, 10).join(" ") };
  return clipWords(swapPronouns(chosen.clean).replace(/\s+/g, " ").trim(), 14);
}


function fallbackUserAnchor(userText) {
  const anchor = extractReflectiveAnchor(userText);
  if (anchor) return anchor;
  const t = (userText || "").trim();
  if (!t) return "isso que você trouxe";
  return clipWords(swapPronouns(t), 10);
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

function resolveReplyBucket(p, mix) {
  if (!p) return "A";
  if (p.key !== "H") return p.key;
  const tone = toneByPresence(p, mix);
  if (tone === "minimalista") return "D";
  if (tone === "firme") return "C";
  if (tone === "calorosa") return "B";
  return "A";
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
    return /^(Foco|Direto|Seja|Objetivo|Vamos ao ponto|Recorte):/i.test(base) || /\?$/.test(base)
      ? base
      : `Vamos ao ponto: ${base}`;
  }
  if (tone === "calorosa") {
    const prefix = pick(["Entendi. ", "Estou com você. ", "Obrigada por trazer isso. "]);
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

function normalizeRuleReplyOptions(rule) {
  const mode = String(rule?.responseMode || "").toLowerCase();
  const base = {
    standalone: false,
    suppressMirror: false,
    suppressLead: false,
    suppressBridge: false,
    suppressClosing: false,
    skipPresenceWrap: false,
    skipToneAdaptation: false
  };

  if (mode === "direct" || mode === "classic" || mode === "standalone") {
    return {
      ...base,
      standalone: true,
      suppressMirror: true,
      suppressLead: true,
      suppressBridge: true,
      suppressClosing: true,
      skipPresenceWrap: true,
      skipToneAdaptation: true
    };
  }

  if (mode === "lean") {
    return {
      ...base,
      suppressLead: true,
      suppressBridge: true,
      suppressClosing: true
    };
  }

  return {
    ...base,
    standalone: !!rule?.standalone,
    suppressMirror: !!rule?.suppressMirror,
    suppressLead: !!rule?.suppressLead,
    suppressBridge: !!rule?.suppressBridge,
    suppressClosing: !!rule?.suppressClosing,
    skipPresenceWrap: !!rule?.skipPresenceWrap,
    skipToneAdaptation: !!rule?.skipToneAdaptation
  };
}

function queueRuleMemory(rule, match, userText) {
  const pool = Array.isArray(rule?.memory) ? rule.memory.filter(Boolean) : [];
  if (!pool.length) return;

  const raw = pick(pool);
  if (!raw) return;

  const rendered = ensureMeaningfulTemplateText(
    interpolateRuleTemplate(raw, match, userText),
    userText
  );
  if (!rendered) return;

  IZA_ENGINE.memory = [rendered]
    .concat((IZA_ENGINE.memory || []).filter((item) => item !== rendered))
    .slice(0, 8);
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

const SOCRATIC_TRACK_BIAS = {
  iniciante: 0.95,
  intermediaria: 1.08,
  inspirada: 1.18
};

const SOCRATIC_STEP_BIAS = {
  iniciante: {
    nucleo: 1.08,
    centro: 1.04,
    tipo_centro: 0.92,
    atrito: 1.12,
    cena: 0.42,
    frase_final: 0.24
  },
  intermediaria: {
    tema: 0.96,
    centro: 1.05,
    tipo_centro: 0.94,
    atrito: 1.12,
    concreto: 0.72,
    contraste: 1.08,
    sintese: 0.78,
    forma_final: 0.38
  },
  inspirada: {
    abertura: 1.08,
    centro: 1.02,
    tipo_centro: 0.96,
    loop: 1.18
  }
};

function currentTrackStepKey() {
  const track = TRACKS[state.trackKey];
  const step = track && Array.isArray(track.steps) ? track.steps[state.stepIndex] : null;
  return step && step.key ? step.key : "";
}

function getIonMarkers() {
  return Array.isArray(window.IZA_ION_MARKERS) ? window.IZA_ION_MARKERS : [];
}

function getIonMarkerLookup() {
  if (window.__IZA_ION_MARKER_LOOKUP) return window.__IZA_ION_MARKER_LOOKUP;

  const lookup = Object.create(null);
  getIonMarkers().forEach((bucket) => {
    const key = String(bucket?.key || "").trim();
    if (!key) return;
    lookup[key] = (bucket.markers || [])
      .map((marker) => normalizeSearchText(marker))
      .filter(Boolean);
  });

  window.__IZA_ION_MARKER_LOOKUP = lookup;
  return lookup;
}

function countRuleMarkerHits(rule, userText) {
  const markerKeys = Array.isArray(rule?.markerKeys) ? rule.markerKeys.filter(Boolean) : [];
  if (!markerKeys.length) return { hits: 0, buckets: 0 };

  const normalized = normalizeSearchText(userText).replace(/[^a-z0-9\s]/g, " ");
  const lookup = getIonMarkerLookup();
  let hits = 0;
  let buckets = 0;

  markerKeys.forEach((key) => {
    const markers = lookup[key] || [];
    const bucketHits = markers.filter((marker) => marker && normalized.includes(marker)).length;
    if (!bucketHits) return;
    buckets += 1;
    hits += bucketHits;
  });

  return { hits, buckets };
}

function ruleSemanticWeight(rule, userText) {
  if (!rule) return 1;

  const { hits, buckets } = countRuleMarkerHits(rule, userText);
  if (!Array.isArray(rule.markerKeys) || !rule.markerKeys.length) return 1;

  if (!buckets) {
    return rule.styleFamily === "socratic" ? 0.42 : 0.85;
  }

  return Math.min(1.95, 1 + buckets * 0.28 + Math.min(4, hits) * 0.07);
}

function ruleTrackStageWeight(rule) {
  if (!rule) return 1;

  let weight = 1;
  const trackKey = state.trackKey;
  const stepKey = currentTrackStepKey();

  if (Array.isArray(rule.allowInTracks) && trackKey && !rule.allowInTracks.includes(trackKey)) {
    return 0.01;
  }

  if (rule.trackBias && trackKey && Number.isFinite(rule.trackBias[trackKey])) {
    weight *= Number(rule.trackBias[trackKey]);
  }

  if (
    rule.stepBias &&
    trackKey &&
    rule.stepBias[trackKey] &&
    Number.isFinite(rule.stepBias[trackKey][stepKey])
  ) {
    weight *= Number(rule.stepBias[trackKey][stepKey]);
  }

  if (rule.styleFamily === "socratic") {
    weight *= SOCRATIC_TRACK_BIAS[trackKey] || 1;
    if (stepKey && SOCRATIC_STEP_BIAS[trackKey] && Number.isFinite(SOCRATIC_STEP_BIAS[trackKey][stepKey])) {
      weight *= SOCRATIC_STEP_BIAS[trackKey][stepKey];
    }
  }

  return weight;
}

function getRuleWeight(ruleName, p, mix, trackKey) {
  const byTrack = (TRACK_RULE_WEIGHTS[trackKey] && TRACK_RULE_WEIGHTS[trackKey][ruleName]) || 1;
  const byPresence = presenceRuleWeight(ruleName, p, mix);
  return Math.max(0.01, byTrack * byPresence);
}

function pickWeightedRule(candidates, p, mix, userText) {
  const weighted = candidates
    .map((item) => {
      const priority = Math.max(0.05, Number(item.rule?.priority || 1));
      const fallbackPenalty =
        item.rule?.name === "default" && candidates.length > 1 ? 0.08 : 1;
      const semanticWeight = ruleSemanticWeight(item.rule, userText);
      const trackStageWeight = ruleTrackStageWeight(item.rule);
      const w =
        getRuleWeight(item.rule?.name, p, mix, state.trackKey) *
        priority *
        fallbackPenalty *
        semanticWeight *
        trackStageWeight;
      return { ...item, weight: w };
    })
    .filter((item) => item.weight > 0);

  if (!weighted.length) return null;

  const sorted = weighted.sort((a, b) => b.weight - a.weight);
  const topWeight = sorted[0].weight;
  const finalists = sorted.filter((item) => item.weight >= topWeight * 0.97);
  return pick(finalists);
}

function runExternalRules(userText, p, mix) {
  const externalRules = getExternalRulesForPresence(p, mix);
  if (!externalRules.length) return null;

  const candidates = [];
  for (const rule of externalRules) {
    if (!rule || !(rule.pattern instanceof RegExp)) continue;
    const m = userText.match(rule.pattern);
    if (!m) continue;
    candidates.push({ rule, match: m });
  }

  const chosen = pickWeightedRule(candidates, p, mix, userText);
  if (!chosen) return null;

  const raw = pickRuleResponse(chosen.rule.responses);
  if (!raw) return null;

  const replyOptions = normalizeRuleReplyOptions(chosen.rule);
  let qText = interpolateRuleTemplate(raw, chosen.match, userText);
  if (!replyOptions.skipToneAdaptation) {
    qText = adaptRuleByTrack(qText);
    qText = adaptRuleByPresence(qText, p, mix);
  } else if (chosen.rule?.styleFamily === "socratic") {
    qText = adaptRuleByTrack(qText);
  }

  qText = ensureMeaningfulTemplateText(qText, userText);
  if (!qText) return null;

  queueRuleMemory(chosen.rule, chosen.match, userText);
  IZA_ENGINE.lastRuleName = chosen.rule?.name || "";

  return {
    text: qText,
    options: replyOptions,
    ruleName: chosen.rule?.name || ""
  };
}

// -------------------- 12 RULES --------------------
const IZA_SCRIPT = [
  {
    key: /\b(fazer|fiz|tentei|criei|escrevi|busco|quero)\b/i,
    decomps: [
      {
        re: /.*\b(?:fiz|tentei|criei|escrevi|busco|quero)\b\s+(.*)$/i,
        reasmb: [
          "O que motivou esse seu agir sobre \"{1}\"?",
          "Ao buscar \"{1}\", qual imagem surgiu primeiro?",
          "Como essa ação sobre \"{1}\" pode virar forma (verso, cena, confissão)?"
        ],
        memory: [
          "Voltando em \"{1}\": qual foi o primeiro passo concreto?",
          "O que você ganhou e o que você arriscou ao fazer \"{1}\"?"
        ]
      }
    ]
  },
  {
    key: /\b(triste|feliz|dificil|confuso|importante|belo|feio)\b/i,
    decomps: [
      {
        re: /.*\b(triste|feliz|dificil|confuso|importante|belo|feio)\b(?:\s+(?:porque|pois)\s+)?(.*)$/i,
        reasmb: [
          "O que torna \"{2}\" algo tao \"{1}\"?",
          "Se \"{2}\" deixasse de ser \"{1}\", o que sobraria?",
          "Como esse estado de ser \"{1}\" aparece na sua escrita, em imagem ou ritmo?"
        ],
        memory: [
          "Da um exemplo pequeno que mostre \"{1}\" sem explicar.",
          "Qual palavra substituiria \"{1}\" sem perder a verdade?"
        ]
      }
    ]
  },
  {
    key: /\b(familia|casa|trabalho|rua|mundo|tempo|vida)\b/i,
    decomps: [
      {
        re: /.*\b(familia|casa|trabalho|rua|mundo|tempo|vida)\b(.*)$/i,
        reasmb: [
          "Qual detalhe concreto de \"{1}\" você quer salvar no texto?",
          "Como \"{1}\" muda o ritmo do que você escreve?",
          "O que em \"{1}\" ainda está guardado e não foi dito?"
        ],
        memory: ["Volta em \"{1}\": onde exatamente isso acontece (lugar, horario, pessoa)?"]
      }
    ]
  },
  {
    key: /\b(sinto|sentir|sentimento|dor|alegria)\b/i,
    decomps: [
      {
        re: /.*\b(?:sinto|sentir)\b\s+(.*)$/i,
        reasmb: [
          "Onde esse sentir, \"{1}\", se localiza na sua historia?",
          "Essa emoção sobre \"{1}\" ajuda ou trava sua autoria?",
          "Consegue descrever \"{1}\" sem usar o nome do sentimento?"
        ],
        memory: ["Qual imagem carregaria \"{1}\" sem dizer o nome dela?"]
      }
    ]
  },
  {
    key: /\b(nao posso|nao consigo|limite|bloqueio)\b/i,
    decomps: [
      {
        re: /.*\b(?:nao consigo|nao posso)\b\s+(.*)$/i,
        reasmb: [
          "Esse limite em \"{1}\" e uma barreira real ou uma precaução sua?",
          "O que mudaria no texto se você pudesse \"{1}\"?",
          "Vamos olhar o outro lado de \"{1}\": o que é possível hoje, do jeito mínimo?"
        ],
        memory: ["Se fosse só 1% possível, como seria \"{1}\"?"]
      }
    ]
  },
  {
    key: /\b(sempre|nunca|todo|ninguem|todos)\b/i,
    decomps: [
      {
        re: /.*\b(sempre|nunca|ninguem|todos)\b(.*)$/i,
        reasmb: [
          "O que faz \"{1}\" soar tao absoluto pra você aqui?",
          "Pensa numa excecao para \"{1}{2}\". Como ela soaria?",
          "Onde esse \"{1}\" aparece hoje, agora, de modo concreto?"
        ],
        memory: ["Qual excecao pequena te faria respirar um pouco?"]
      }
    ]
  },
  {
    key: /\b(talvez|acho|parece|quem sabe)\b/i,
    decomps: [
      {
        re: /.*\b(?:talvez|acho|parece|quem sabe)\b\s+(.*)$/i,
        reasmb: [
          "Se você tivesse certeza sobre \"{1}\", o texto seria o mesmo?",
          "O que sustenta essa dúvida sobre \"{1}\"?",
          "A incerteza sobre \"{1}\" pode virar lugar de criacao?"
        ],
        memory: ["Qual parte de \"{1}\" você mais quer testar em palavras?"]
      }
    ]
  },
  {
    key: /\b(voce|iza|maquina|computador)\b/i,
    decomps: [
      {
        re: /.*\b(?:voce|iza|maquina|computador)\b\s*(.*)$/i,
        reasmb: [
          "Eu estou aqui para espelhar seu pensamento. O que \"{1}\" revela sobre você?",
          "O que muda no seu texto quando você me usa como espelho?",
          "Como eu posso te ajudar a deixar \"{1}\" mais claro em 1 frase?"
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
          "Essa razão, \"{1}\", e a única possível?",
          "Se não fosse por \"{1}\", que outra causa existiria?",
          "Como essa explicação muda sua voz no papel?"
        ],
        memory: ["Você prefere explicar \"{1}\" ou mostrar em cena?"]
      }
    ]
  },
  {
    key: /\b(sonho|desejo|imagino|futuro)\b/i,
    decomps: [
      {
        re: /.*\b(?:sonho|desejo|imagino)\b\s+(.*)$/i,
        reasmb: [
          "Qual é a cor, som ou textura desse \"{1}\"?",
          "Como \"{1}\" projeta quem você é hoje?",
          "O que \"{1}\" traz de novo para sua escrita?"
        ],
        memory: ["Qual micro-ação hoje aproxima \"{1}\"?"]
      }
    ]
  },
  {
    key: /\b(atrito|luta|conflito|problema)\b/i,
    decomps: [
      {
        re: /.*\b(?:atrito|luta|conflito|problema)\b\s*(.*)$/i,
        reasmb: [
          "Qual é o coracao desse \"{1}\"?",
          "Esse conflito em \"{1}\" gera movimento ou estagnacao?",
          "O que está em risco quando você encara \"{1}\"?"
        ],
        memory: ["Qual é o ponto de virada dentro de \"{1}\"?"]
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

  const k = p.key === "H"
    ? ((state.presenceMix?.C || 0) > 0.4
      ? "C"
      : (state.presenceMix?.B || 0) > 0.35
        ? "B"
        : (state.presenceMix?.D || 0) > 0.5
          ? "D"
          : "A")
    : p.key;
  const arr = (lines[ct] && (lines[ct][k] || lines[ct].A)) || [""];
  return pick(arr);
}




function fixEmptyQuestion(qText) {
  const normalized = String(qText || "").trim();
  const hasEmptyQuotes =
    normalized.includes("\"\u2014") ||
    normalized.includes('""') ||
    normalized.includes("''") ||
    /\?\s*\u2014/.test(normalized) ||
    /"\s*\u2014/.test(normalized) ||
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

function recentTurnsByRole(role, limit = 1) {
  return (state.turns || [])
    .filter((turn) => turn && turn.role === role)
    .slice(-Math.max(1, limit));
}

function recentIzaTexts(limit = 1) {
  return recentTurnsByRole("iza", limit)
    .map((turn) => String(turn.text || "").trim())
    .filter(Boolean);
}

function isMirrorishText(text) {
  const normalized = normalizeSearchText(text).replace(/\s+/g, " ").trim();
  return /(?:fico com esta parte|tem um ponto importante aqui|talvez o centro esteja em|tem algo sensivel aqui|isso pede escuta|o ponto central esta em|o eixo passa por|o centro do que voce trouxe passa por|talvez a frase mais viva esteja em)/.test(normalized);
}

function isSocraticPrompt(text) {
  const normalized = normalizeSearchText(text).replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/^(quem|que|qual|como|por que|quando voce diz|voce diria|isso vale|se )/.test(normalized)) {
    return true;
  }
  return /(?:quem julga|ponte ou limite|o que permanece comum|compreender isso e o mesmo|arte tecnica ou impulso|o outro limita|o que ainda permanece comum|o que torna possivel|dissolver o misterio|caso particular para a regra geral)/.test(normalized);
}

function shouldIncludeMirrorLine(p, questionText, options = {}) {
  if (options.suppressMirror || options.standalone || options.skipPresenceWrap) return false;
  if (isSocraticPrompt(questionText)) return false;
  if (p.key === "C") return false;
  if (recentIzaTexts(1).some(isMirrorishText)) return false;
  if (state.trackKey === "iniciante" && state.stepIndex >= 1) return false;
  if (hasStepTransition(questionText)) return false;
  if (p.key === "H" && (state.presenceMix?.C || 0) > 0.4 && state.trackKey !== "inspirada") {
    return false;
  }
  return true;
}

function shortMirror(presence, userText) {
  const t = (userText || "").trim();
  if (!t) return presence.key === "D" ? "Continue." : "Pode seguir.";
  const anchor =
    extractReflectiveAnchor(t) ||
    swapPronouns(t.split(/\s+/).slice(0, 10).join(" "));

  if (presence.mirror === "tiny") {
    return "";
  }
  if (presence.mirror === "short") {
    if (presence.key === "B") {
      return pickVariedLine("mirror_short_b", [
        { key: "fico", text: `Fico com esta parte: "${anchor}".` },
        { key: "sensivel", text: `Tem algo sensível aqui: "${anchor}".` },
        { key: "escuta", text: `Isso pede escuta: "${anchor}".` }
      ]);
    }
    return pickVariedLine("mirror_short_default", [
      { key: "fico", text: `Fico com esta parte: "${anchor}".` },
      { key: "ponto", text: `Tem um ponto importante aqui: "${anchor}".` },
      { key: "centro", text: `Talvez o centro estejá em "${anchor}".` }
    ]);
  }
  if (presence.key === "C") {
    return pickVariedLine("mirror_medium_c", [
      { key: "centro", text: `O ponto central está em "${anchor}".` },
      { key: "recorte", text: `Recorto assim: "${anchor}".` },
      { key: "eixo", text: `O eixo passa por "${anchor}".` }
    ]);
  }
  return pickVariedLine("mirror_medium_default", [
    { key: "peso", text: `O que mais pesa aqui e "${anchor}".` },
    { key: "centro", text: `O centro do que você trouxe passa por "${anchor}".` },
    { key: "frase", text: `Talvez a frase mais viva estejá em "${anchor}".` }
  ]);
}

function adaptRuleByTrack(text) {
  const base = String(text || "").trim();
  if (!base) return base;
  const stepKey = currentTrackStepKey();

  if (state.trackKey === "iniciante") {
    if (stepKey === "cena") {
      if (/detalhe|cena|concreto|gesto|lugar|alguem/i.test(base)) return base;
      return base + " Amarre isso numa cena: lugar, alguem e um gesto.";
    }
    if (stepKey === "frase_final") {
      if (/frase|linha|sintese|versao|formule/i.test(base)) return base;
      return base + " Responda com uma única frase que você sustentaria no final.";
    }
    if (/detalhe|cena|concreto|gesto|lugar/i.test(base)) return base;
    if (isSocraticPrompt(base)) return base;
    if (/\?$/.test(base) && base.length >= 42) return base;
    return base + " " + pickVariedLine("track_iniciante_suffix", [
      { key: "caso", text: "Se puder, traz isso num caso pequeno." },
      { key: "detalhe", text: "Se fizer sentido, me mostra um detalhe concreto." },
      { key: "cena", text: "Se ajudar, testa isso numa cena breve." }
    ]);
  }
  if (state.trackKey === "intermediaria") {
    if (stepKey === "concreto") {
      if (/cena|fala|gesto|lugar|concreto/i.test(base)) return base;
      return base + " Leve isso para uma cena, fala, gesto ou lugar.";
    }
    if (stepKey === "sintese") {
      if (/3 linhas|tres linhas|sintese|reuna/i.test(base)) return base;
      return base + " Reúna a resposta em até 3 linhas.";
    }
    if (stepKey === "forma_final") {
      if (/versao|frase|sustenta|sintese/i.test(base)) return base;
      return base + " Feche isso na versão mais nítida que você sustentaria.";
    }
    if (/objetiv|1-2 frases|1 frase|duas frases/i.test(base)) return base;
    if (isSocraticPrompt(base)) return base;
    return base + " " + pickVariedLine("track_intermediaria_suffix", [
      { key: "objetiva", text: "Se der, responde em 1 ou 2 frases." },
      { key: "tese", text: "Se puder, formula a tese em uma frase." },
      { key: "prova", text: "Tenta nomear a ideia e a prova logo depois." }
    ]);
  }
  if (state.trackKey === "inspirada") {
    if (stepKey === "centro") {
      if (/1 frase|uma frase|centro/i.test(base)) return base;
      return base + " Tente dizer isso em uma frase-eixo.";
    }
    if (/fluxo|livre|imagem|cena/i.test(base)) return base;
    if (isSocraticPrompt(base)) return base;
    if (/\?$/.test(base) && base.length >= 42) return base;
    return base + " " + pickVariedLine("track_inspirada_suffix", [
      { key: "fluxo", text: "Pode responder no fluxo." },
      { key: "imagem", text: "Se vier uma imagem, vai por ela." },
      { key: "frase", text: "Deixa a próxima frase aparecer sem forcar." }
    ]);
  }
  return base;
}

function refinedPresenceClosing(p) {
  const banks = {
    A: [
      "Se fizer sentido, segue daqui.",
      "Veja se isso se sustenta num caso pequeno.",
      "Leva isso mais um passo."
    ],
    B: [
      "Pode ir no seu ritmo.",
      "Se quiser, eu sigo com você.",
      "Ainda tem algo aqui que pode amadurecer."
    ],
    C: [
      "Agora diga isso em uma frase.",
      "Teste a consequencia disso.",
      "Recorte o essencial."
    ],
    D: [""]
  };

  if (p.key === "H" && state.presenceMix) {
    const bucket =
      (state.presenceMix.D || 0) > 0.5 ? "D" :
      (state.presenceMix.C || 0) > 0.4 ? "C" :
      (state.presenceMix.B || 0) > 0.35 ? "B" : "A";
    return pickVariedLine(`closing_${bucket}`, banks[bucket]);
  }

  const bucket = banks[p.key] ? p.key : "A";
  return pickVariedLine(`closing_${bucket}`, banks[bucket]);
}

function refinedLeadLine(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t || p.key === "D") return "";

  if (p.key === "H" && state.presenceMix) {
    const mix = state.presenceMix;
    if ((mix.D || 0) > 0.55) return "";
    if ((mix.C || 0) > 0.45) {
      return pickVariedLine("lead_h_c", [
        { key: "nucleo", text: "Vamos ao ponto." },
        { key: "delimite", text: "Delimite o ponto central." },
        { key: "recorte", text: "Recorte melhor o que apareceu." }
      ]);
    }
    if ((mix.B || 0) > 0.35) {
      return pickVariedLine("lead_h_b", [
        { key: "com", text: "Estou com você." },
        { key: "importa", text: "Isso importa." },
        { key: "escutar", text: "Vamos escutar melhor esse ponto." }
      ]);
    }
    return pickVariedLine("lead_h_a", [
      { key: "entendi", text: "Entendi." },
      { key: "certo", text: "Certo." },
      { key: "olhar", text: "Vamos olhar isso melhor." }
    ]);
  }

  if (p.key === "A") {
    return pickVariedLine("lead_a", [
      { key: "entendi", text: "Entendi." },
      { key: "certo", text: "Certo." },
      { key: "pista", text: "Tem uma pista aqui." },
      { key: "partes", text: "Vamos por partes." }
    ]);
  }

  if (p.key === "B") {
    const ct = state.centerType;
    const bank = [
      { key: "confiar", text: "Obrigada por trazer isso." },
      { key: "sem_pressa", text: "Estou com você, sem pressa." },
      { key: "escuta", text: "Isso pede escuta." },
      { key: "ouvir", text: "Vamos ouvir melhor o que apareceu aqui." },
      ct === "ferida" ? { key: "ferida", text: "Isso toca num ponto sensível." } : null,
      ct === "desejo" ? { key: "desejo", text: "Isso tem pulsacao." } : null,
      ct === "pergunta" ? { key: "pergunta", text: "Essa pergunta está viva." } : null,
      ct === "afirmacao" ? { key: "afirmacao", text: "Isso afirma algo importante." } : null
    ].filter(Boolean);
    return pickVariedLine("lead_b", bank);
  }

  if (p.key === "C") {
    return pickVariedLine("lead_c", [
      { key: "nucleo", text: "Vamos ao ponto." },
      { key: "preciso", text: "Recorte o essencial." },
      { key: "delimite", text: "Delimite o que está em jogo." },
      { key: "recorte", text: "Recorte o ponto central." }
    ]);
  }

  return "";
}

function chooseReplyPrelude(p, lead, mirror, bridge, lens, includeMirror, questionText) {
  const bucket = resolveReplyBucket(p, state.presenceMix || null);
  const mirrorLine = includeMirror ? mirror : "";
  const structuredQuestion = hasStepTransition(questionText) || replyLines(questionText).length >= 2;

  if (bucket === "D") return "";
  if (bucket === "C") return lead || lens || bridge || "";
  if (bucket === "B") return lens || mirrorLine || lead || bridge || "";
  if (structuredQuestion) return mirrorLine || lead || "";
  return bridge || mirrorLine || lead || (Math.random() < 0.35 ? lens : "");
}

function composeReply(p, userText, mirror, qText, minimalistNow, replyOptions = {}) {
  const options = {
    standalone: false,
    suppressMirror: false,
    suppressLead: false,
    suppressBridge: false,
    suppressClosing: false,
    ...replyOptions
  };
  const lead = refinedLeadLine(userText);
  const lens = centerLensLine();
  const closing = refinedPresenceClosing(p);
  const safeQuestion = ensureMeaningfulTemplateText(fixEmptyQuestion(qText), userText);
  const safeMirror = ensureMeaningfulTemplateText(mirror, userText);
  const includeMirror = shouldIncludeMirrorLine(p, safeQuestion, options);
  const anchor = extractReflectiveAnchor(userText);
  const bridge =
    !anchor || p.key === "D"
      ? ""
      : p.key === "B"
        ? pick([
          `Tem algo de vivo em "${anchor}".`,
          `Parece que "${anchor}" está pedindo mais espaço no texto.`
        ])
        : p.key === "A"
          ? (Math.random() < 0.5 ? `Talvez o ponto mais nítido estejá em "${anchor}".` : "")
          : p.key === "H" && state.presenceMix && (state.presenceMix.B || 0) > 0.32
            ? pick([
              `Tem uma pista importante em "${anchor}".`,
              `Acho que "${anchor}" merece mais escuta.`
            ])
            : "";

  if (options.standalone) {
    return safeQuestion || `Falando em "${fallbackUserAnchor(userText)}", pode continuar?`;
  }

  if (minimalistNow || p.key === "D") {
    return safeQuestion || `Falando em "${fallbackUserAnchor(userText)}", pode continuar?`;
  }

  const parts = [];
  const prelude = chooseReplyPrelude(
    p,
    !options.suppressLead ? lead : "",
    safeMirror,
    !options.suppressBridge ? bridge : "",
    lens,
    includeMirror,
    safeQuestion
  );
  if (prelude) parts.push(prelude);

  parts.push(safeQuestion || `Falando em "${fallbackUserAnchor(userText)}", o que aparece agora?`);

  const canClose =
    !options.suppressClosing &&
    closing &&
    replyLines(safeQuestion).length === 1 &&
    !hasStepTransition(safeQuestion) &&
    !/\?$/.test(lastReplyLine(safeQuestion));

  if (canClose && !(p.key === "B" && Math.random() < 0.55)) {
    parts.push(closing);
  }

  return dedupeResponseLines(parts).join("\n").trim();
}

function dedupeResponseLines(lines) {
  const seen = new Set();
  return (lines || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .filter((line) => {
      const key = normalizeSearchText(line).replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
            "Tente em 7 palavras com lugar ou gesto: o que você quer dizer?";

  const hook = userText && countMeaningfulWords(userText) >= 4 ? "Vamos condensar um pouco. " : "";
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

  const externalReply = runExternalRules(t, p, mix);
  if (externalReply && externalReply.text) {
    const mirror = shortMirror(p, t);
    const minimalistNow = shouldBeMinimalNow(p, mix);
    const composed = composeReply(
      p,
      t,
      mirror,
      externalReply.text,
      minimalistNow,
      externalReply.options
    );
    return externalReply.options?.skipPresenceWrap ? composed : presenceWrap(p, composed);
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

  const fallbackQ = `Falando em "${fallbackUserAnchor(t)}", o que aqui pede um nome mais preciso?`;
  return presenceWrap(p, composeReply(p, t, shortMirror(p, t), fallbackQ, false));
}

// -------------------- OPÇÃO A (centro) --------------------
function centerChoicePrompt(fragment) {
  const p = state.presence || PRESENCES.A;
  const frag = swapPronouns((fragment || "").trim());

  if (p.key === "D") {
    return `"${frag}—"\nIsso está mais perto de pergunta, afirmação, ferida ou desejo?\nSe preferir, escreva do seu jeito.`;
  }
  if (p.key === "C") {
    return `Você disse: "${frag}—". Classifique o núcleo com precisão: pergunta, afirmação, ferida ou desejo.\nSe preferir, escreva do seu jeito.`;
  }
  if (p.key === "B") {
    return `Ao ler "${frag}—", eu sinto um núcleo aí.\nIsso está mais perto de uma pergunta, uma afirmação, uma ferida ou um desejo?\nSe preferir, escreva do seu jeito.`;
  }
  return `Quando você diz "${frag}—", isso está mais perto de uma pergunta, uma afirmação, uma ferida ou um desejo?\nSe preferir, escreva do seu jeito.`;
}

function interpretCenterChoice(text) {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let choice = null;

  if (/^\s*a\s*$/.test(normalized)) choice = "pergunta";
  else if (/^\s*b\s*$/.test(normalized)) choice = "afirmacao";
  else if (/^\s*c\s*$/.test(normalized)) choice = "ferida";
  else if (/^\s*d\s*$/.test(normalized)) choice = "desejo";
  else if (/\bpergunta\b/.test(normalized)) choice = "pergunta";
  else if (/\bafirmac/.test(normalized)) choice = "afirmacao";
  else if (/\bferida\b/.test(normalized)) choice = "ferida";
  else if (/\bdesej/.test(normalized)) choice = "desejo";

  if (!choice) return { type: "livre", label: "o seu próprio modo de dizer" };
  const labelMap = {
    pergunta: "uma pergunta",
    afirmacao: "uma afirmação",
    ferida: "uma ferida",
    desejo: "um desejo"
  };
  return { type: choice, label: labelMap[choice] || "o seu próprio modo de dizer" };
}

function parseCenterChoice(text) {
  const base = interpretCenterChoice(text);
  const raw = String(text || "").trim();
  const labelMap = {
    pergunta: "uma pergunta",
    afirmacao: "uma afirmação",
    ferida: "uma ferida",
    desejo: "um desejo",
    livre: "o seu próprio modo de dizer"
  };
  const patternsByChoice = {
    pergunta: [/^\s*a\s*[-:.,;)]*\s*/i, /^\s*(?:uma?\s+)?pergunta\b\s*[-:.,;)]*\s*/i],
    afirmacao: [/^\s*b\s*[-:.,;)]*\s*/i, /^\s*(?:uma?\s+)?afirmac[a-z]*\b\s*[-:.,;)]*\s*/i],
    ferida: [/^\s*c\s*[-:.,;)]*\s*/i, /^\s*(?:uma?\s+)?ferida\b\s*[-:.,;)]*\s*/i],
    desejo: [/^\s*d\s*[-:.,;)]*\s*/i, /^\s*(?:um\s+|uma?\s+)?desej[a-z]*\b\s*[-:.,;)]*\s*/i]
  };

  let semanticTail = raw;
  if (base.type && patternsByChoice[base.type]) {
    semanticTail = patternsByChoice[base.type].reduce(
      (acc, pattern) => acc.replace(pattern, ""),
      semanticTail
    );
  }

  semanticTail = semanticTail
    .replace(/^\s*(?:e|eh|sao|mais perto de|parece)\s+/i, "")
    .replace(/^[\s,.;:()\-]+/, "")
    .trim();

  return {
    ...base,
    label: labelMap[base.type] || labelMap.livre,
    raw,
    semanticTail: base.type === "livre" ? raw : semanticTail
  };
}

function countMeaningfulWords(text) {
  return normalizeInlineText(text).split(/\s+/).filter(Boolean).length;
}

function countTextLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function detectSceneSignals(text) {
  const normalized = normalizeSearchText(text);
  const raw = String(text || "");
  const wordCount = countMeaningfulWords(text);
  const hasPlace = /\b(?:na|no|numa|num|em|entre|diante|sob|sobre|perto|longe|rua|casa|quarto|sala|cozinha|janela|porta|escola|cidade|bairro|praca|ponte|praia|rio|bar|mercado|onibus|hospital|trabalho|floresta|quintal|fazenda|igreja|corredor|mesa|amazonia|antartida)\b/.test(normalized);
  const hasAgent = /\b(?:eu|voce|ele|ela|nos|alguem|ninguem|homem|mulher|menino|menina|mae|pai|filho|filha|amigo|amiga|professor|professora|pesquisador|pesquisadora|cientista|vizinho|vizinha|namorado|namorada|artista|medico|medica|agricultor|agricultora|corpo|rosto|mao|olhos)\b/.test(normalized) || /(?:^|\s)[A-Z][a-z]{2,}/.test(raw);
  const hasGesture = /\b(?:olha|olhou|olhando|ve|viu|vendo|anda|andou|entrou|saiu|ficou|parou|segura|segurou|abre|abriu|fecha|fechou|disse|fala|falou|grita|gritou|cala|calou|respira|respirou|escreve|escreveu|le|leu|toca|tocou|encosta|encostou|corre|correu|senta|sentou|levanta|levantou|chora|chorou|ri|riu|corta|cortou|empurra|empurrou|puxa|puxou|atravessa|atravessou|espera|esperou|treme|tremendo|tremia)\b/.test(normalized);
  const hasSpeech = /["""']/.test(raw) || /\b(?:disse|fala|falou|gritou|perguntou|respondeu)\b/.test(normalized);
  const hasConcreteAnchor = /\b(?:rua|casa|quarto|sala|cozinha|janela|porta|escola|cidade|bairro|praca|ponte|praia|rio|bar|mercado|onibus|hospital|floresta|quintal|fazenda|igreja|corredor|mesa|amazonia|antartida|laje|favela|periferia|viela|muro|paredao|calcada|fogao|corpo|rosto|mao|olhos|varal)\b/.test(normalized);
  const hasSymbolicAnchor = /\b(?:espelho|orixa|orixas|altar|vela|sombra|retrato|portaretrato|foto|fotografia|quadro|janela|olho|olhos|olhar|rosto|boca|voz|corpo|rio|fogo|pedra|luz)\b/.test(normalized);
  const hasImageAnchor = hasConcreteAnchor || hasSymbolicAnchor;
  const hasAbstractLabel = /\b(?:conflito|desejo|risco|duvida|tensao|afirmacao|ferida|ideia|pensamento|sentimento|emocao)\b/.test(normalized);
  const isSymbolicImage = hasSymbolicAnchor && !hasAbstractLabel && wordCount >= 4 && wordCount <= 14;
  return {
    hasPlace,
    hasAgent,
    hasGesture,
    hasSpeech,
    hasConcreteAnchor,
    hasSymbolicAnchor,
    hasImageAnchor,
    isSymbolicImage,
    wordCount,
    score: [hasPlace, hasAgent, hasGesture, hasSymbolicAnchor].filter(Boolean).length
  };
}

function detectContrastSignals(text) {
  const normalized = normalizeSearchText(text);
  const clean = normalizeInlineText(text);
  return {
    wordCount: countMeaningfulWords(text),
    hasExplicitPair: /\b(?:x|vs|versus)\b/.test(normalized),
    hasDualFrame: /\b(?:entre|de um lado|de outro|ao mesmo tempo|mas|contra|tensao|conflito)\b/.test(normalized),
    hasBetweenFrame: /\bentre\b.+\b(?:e|ou)\b.+/.test(normalized),
    hasOppositionFrame: /\b(?:de um lado|do outro|por outro lado|ao mesmo tempo|contra|mas|porem|versus|vs)\b/.test(normalized) || /\sx\s/.test(` ${normalized} `),
    hasTensionLabel: /\b(?:conflito|desejo|risco|duvida|tensao)\b/.test(normalized),
    isSingleLabelOnly: /^(?:conflito|desejo|risco|duvida|dúvida|tensao|tensão)\s*$/i.test(clean)
  };
}

function isCompactCenterLine(text) {
  const words = countMeaningfulWords(text);
  const lines = countTextLines(text);
  return words >= 3 && words <= 28 && lines <= 2;
}

function isCompactSynthesisText(text) {
  const words = countMeaningfulWords(text);
  const lines = countTextLines(text);
  return words >= 8 && words <= 60 && lines <= 3;
}

function isStrongFinalLine(text) {
  const normalized = normalizeInlineText(text);
  const words = countMeaningfulWords(normalized);
  const lines = countTextLines(normalized);
  const sentenceCount = normalized.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean).length;
  const opensDebate = /^(?:por que|porque|como|qual|quais|quando|sera|seria|o que|se )/i.test(normalized);
  const hasHedging = /\b(?:acho|talvez|parece|quem sabe)\b/i.test(normalized) || /ainda estou pensando|explica melhor/i.test(normalized);
  const weakAdverbs = (normalized.match(/\b(?:principalmente|certamente|sobretudo|geralmente)\b/gi) || []).length;
  const genericWhoFrame = /^quem\b/i.test(normalized) && words >= 10;
  const imperativeFrame = /^(?:escreva|diga|nomeie|veja|olhe|pense|pergunte|escolha|traga|condense|reuna|de a isso|de a frase)\b/i.test(normalized);
  const metaWritingFrame = /\b(?:frase que merece permanecer|frase-nucleo|agora escreva|a frase que sobreviveria|escreva apenas a frase)\b/i.test(normalized);
  return !!normalized && words >= 5 && words <= 30 && lines <= 2 && sentenceCount <= 2 && !opensDebate && !hasHedging && weakAdverbs < 2 && !genericWhoFrame && !imperativeFrame && !metaWritingFrame && !/\?$/.test(normalized);
}

function resolveLatestAcceptedStepText(stepKeys) {
  const latest = userTurnsByStepKeys(stepKeys)
    .filter((turn) => turn.meta?.validation !== "repair_needed")
    .map((turn) => normalizeInlineText(turn.text))
    .filter(Boolean)
    .slice(-1)[0];
  return latest || "";
}

function buildFinalLineReferenceTexts() {
  const refs = [];
  const firstText = normalizeInlineText(userTurnsOnly()[0]?.text);
  const center = normalizeInlineText(state.centerSemanticTail);
  const tension = resolveLatestAcceptedStepText(["atrito", "contraste"]);
  const scene = normalizeInlineText(resolveConcreteSceneAnchorText());

  if (firstText) refs.push(firstText);
  if (center && normalizeSearchText(center) !== normalizeSearchText(firstText)) refs.push(center);
  if (tension) refs.push(tension);
  if (scene) refs.push(scene);

  return refs;
}

function countJourneyRootOverlap(text, references = buildFinalLineReferenceTexts()) {
  const referenceRoots = new Set();
  (references || []).forEach((entry) => {
    tokenizeForKeywords(entry).forEach((token) => referenceRoots.add(keywordRoot(token)));
  });
  if (!referenceRoots.size) return 0;

  const seen = new Set();
  return tokenizeForKeywords(text).filter((token) => {
    const root = keywordRoot(token);
    if (seen.has(root)) return false;
    seen.add(root);
    return referenceRoots.has(root);
  }).length;
}

function buildFinalLineReminder() {
  const firstText = clipWords(normalizeInlineText(userTurnsOnly()[0]?.text), 10);
  const center = clipWords(state.centerSemanticTail, 10);
  const scene = clipWords(resolveConcreteSceneAnchorText(), 12);
  const reminders = [];

  if (firstText) reminders.push(`ao primeiro impulso "${firstText}"`);
  if (center && normalizeSearchText(center) !== normalizeSearchText(firstText)) reminders.push(`ao núcleo "${center}"`);
  if (scene) reminders.push(`a imagem "${scene}"`);

  if (reminders.length) {
    return `Volte ${listToNaturalLanguage(reminders)}. Agora afine isso numa frase forte de escrita.`;
  }
  return "Volte ao que apareceu antes e afine isso numa frase forte de escrita.";
}

function validateStepInput(stepKey, text) {
  const clean = normalizeInlineText(text);
  if (!clean) return { ok: false, reason: "empty" };

  if (stepKey === "centro") {
    return isCompactCenterLine(clean)
      ? { ok: true }
      : { ok: false, reason: "center_compact" };
  }

  if (stepKey === "tipo_centro") {
    const parsed = parseCenterChoice(text);
    if (parsed.type !== "livre") return { ok: true, parsed };
    return countMeaningfulWords(parsed.semanticTail || parsed.raw || clean) >= 3
      ? { ok: true, parsed }
      : { ok: false, reason: "center_name" };
  }

  if (stepKey === "atrito") {
    const contrast = detectContrastSignals(text);
    const detailedTension =
      contrast.hasExplicitPair ||
      contrast.hasBetweenFrame ||
      contrast.hasOppositionFrame;
    return (contrast.wordCount >= 4 && detailedTension && !contrast.isSingleLabelOnly)
      ? { ok: true, contrast }
      : { ok: false, reason: "atrito", contrast };
  }

  if (stepKey === "cena" || stepKey === "concreto") {
    const scene = detectSceneSignals(text);
    const sceneOk =
      scene.wordCount >= 6 &&
      scene.hasConcreteAnchor &&
      (scene.hasGesture || scene.hasSpeech) &&
      (scene.score >= 2 || (scene.hasAgent && scene.hasSpeech));
    const symbolicSceneOk =
      scene.isSymbolicImage &&
      scene.hasImageAnchor &&
      scene.wordCount >= 4;
    return sceneOk
      || symbolicSceneOk
      ? { ok: true, scene }
      : { ok: false, reason: "scene", scene };
  }

  if (stepKey === "contraste") {
    const contrast = detectContrastSignals(text);
    return (contrast.wordCount >= 4 && (contrast.hasExplicitPair || contrast.hasDualFrame))
      ? { ok: true, contrast }
      : { ok: false, reason: "contrast", contrast };
  }

  if (stepKey === "sintese") {
    return isCompactSynthesisText(text)
      ? { ok: true }
      : { ok: false, reason: "synthesis" };
  }

  if (stepKey === "frase_final" || stepKey === "forma_final") {
    const anchoredEnough = countJourneyRootOverlap(text) >= 1 || !buildFinalLineReferenceTexts().length;
    return isStrongFinalLine(text) && anchoredEnough
      ? { ok: true }
      : { ok: false, reason: "final_line", anchoredEnough };
  }

  return { ok: true };
}

const MAX_STEP_REPAIRS = 1;

function countRepairAttemptsForStep(stepKey) {
  return userTurnsByStepKeys([stepKey])
    .filter((turn) => turn.meta?.validation === "repair_needed")
    .length;
}

function resolveAttritoHint() {
  return state.centerType === "pergunta" ? "Qual parte da pergunta doi mais?" :
    state.centerType === "afirmacao" ? "O que ameaça essa afirmação?" :
      state.centerType === "ferida" ? "O que encosta nessa ferida?" :
        state.centerType === "desejo" ? "O que atrapalha esse desejo?" :
          "Qual é a tensão aqui?";
}

function resolveSoftAdvanceNextPrompt(stepKey) {
  if (state.trackKey === "iniciante") {
    if (stepKey === "atrito") {
      return `Passo 3 — Cena\nTraga uma cena concreta: lugar, alguem e um gesto. ${resolveAttritoHint()}`;
    }
    if (stepKey === "cena") {
      return "Passo 4 — Frase que fica\nEscreva a frase que merece permanecer.";
    }
  }

  if (state.trackKey === "intermediaria") {
    if (stepKey === "atrito") {
      return "Passo 4 — Concreto\nMostre onde isso aparece: cena, fala, gesto ou lugar.";
    }
    if (stepKey === "concreto") {
      return "Passo 5 — Contraste\nNomeie duas forças em tensão (ex.: medo x vontade).";
    }
    if (stepKey === "contraste") {
      return "Passo 6 — Síntese\nReúna tudo em 3 linhas.";
    }
    if (stepKey === "sintese") {
      return "Passo 7 — Forma final\nEscreva a versão que vale levar adiante.";
    }
  }

  return "";
}

function buildRotatingOppositionExample(stepKey) {
  const variants = stepKey === "contraste"
    ? [
      { key: "medo_vontade", text: "medo x vontade" },
      { key: "fala_silencio", text: "fala x silêncio" },
      { key: "permanencia_fuga", text: "permanencia x fuga" }
    ]
    : [
      { key: "prazer_obrigacao", text: "prazer x obrigacao" },
      { key: "orgulho_vergonha", text: "orgulho x vergonha" },
      { key: "impulso_recuo", text: "impulso x recuo" }
    ];
  return pickVariedLine(`repair_example_${stepKey}`, variants);
}

function buildSoftAdvanceMirror(stepKey, userText) {
  const anchor = stepKey === "cena" || stepKey === "concreto"
    ? extractConcreteSceneAnchor(userText)
    : extractReflectiveAnchor(userText) || clipWords(userText, 12);
  if (!anchor) return "";

  const leads = {
    centro: "Fico com este eixo provisório",
    tipo_centro: "Fico com este nome provisório",
    atrito: "Fico com esta tensão",
    cena: "Fico com esta imagem",
    concreto: "Fico com este recorte",
    contraste: "Fico com este contraste",
    sintese: "Fico com esta linha",
    frase_final: "Fico com esta linha",
    forma_final: "Fico com esta versão"
  };
  return `${leads[stepKey] || "Fico com isto"}: "${anchor}".`;
}

function buildSceneRepairCore(stepKey, userText) {
  const scene = detectSceneSignals(userText);
  if (scene.hasImageAnchor && !scene.hasPlace && !scene.hasGesture && !scene.hasSpeech) {
    return "A imagem já apareceu. Agora me diga onde isso acontece ou que gesto faz isso respirar.";
  }
  if ((scene.hasPlace || scene.hasImageAnchor) && !scene.hasGesture && !scene.hasSpeech) {
    return "O lugar ou a imagem já apareceram. Agora me mostra o gesto, a fala ou o corpo.";
  }
  if (scene.hasAgent && !scene.hasPlace && !scene.hasImageAnchor) {
    return stepKey === "concreto"
      ? "Já apareceu uma presença. Agora leve isso para um lugar, uma fala, um gesto ou uma cena."
      : "Já apareceu uma presença. Agora me dá lugar e gesto para isso virar cena.";
  }
  return stepKey === "concreto"
    ? "Quero ver isso no mundo. Mostre uma cena, uma fala, um gesto ou um lugar."
    : "Ainda está abstrato. Traga uma cena pequena: diga onde isso acontece, quem está ali e qual gesto ou fala aparece.";
}

function buildSoftAdvanceReply(step, userText) {
  const stepKey = step?.key || "";
  const mirror = buildSoftAdvanceMirror(stepKey, userText);
  const leads = {
    centro: "Ainda está aberto, mas já apareceu um eixo para seguir.",
    tipo_centro: "Ainda não fechou num nome exato, mas já deu para sentir o centro.",
    atrito: "Ainda não saiu inteiro em duas pontas, mas a pressão principal já apareceu.",
    cena: "A cena ainda pode ganhar mais corpo, mas já temos fio suficiente para seguir.",
    concreto: "Ainda cabe mais concretude, mas já apareceu um rastro no mundo.",
    contraste: "O contraste ainda pode ficar mais nítido, mas o eixo da tensão apareceu.",
    sintese: "Ainda cabia condensar mais, mas já temos material para seguir.",
    frase_final: "Ainda dava para lapidar mais, mas essa linha já pode fechar esta volta.",
    forma_final: "Ainda dava para lapidar mais, mas essa versão já pode seguir."
  };
  const lead = leads[stepKey] || "Ainda cabia lapidar mais, mas já temos material para seguir.";
  const mirroredLead = mirror ? `${mirror}\n${lead}` : lead;

  if (stepKey === "frase_final" || stepKey === "forma_final") {
    state.finalDraft = (userText || "").trim();
    return `${mirroredLead}\n\n${finalClosureLine()}`;
  }

  if (stepKey === "centro" || stepKey === "tipo_centro") {
    return `${mirroredLead}\n\n${step.onUser(userText)}`;
  }

  const nextPrompt = resolveSoftAdvanceNextPrompt(stepKey);
  if (nextPrompt) {
    return `${mirroredLead}\n\n${nextPrompt}`;
  }

  return `${mirroredLead}\n\n${step.onUser(userText)}`;
}

function buildStepValidationReply(stepKey, userText = "") {
  const p = state.presence || PRESENCES.A;
  const prefix =
    p.key === "D" ? "" :
      p.key === "C" ? "Ainda não." :
        p.key === "B" ? "Quero te acompanhar melhor aqui." :
          "Vamos ajustar isso um pouco.";

  const coreByStep = {
    centro: "Condense isso em 1 frase-eixo.",
    tipo_centro: "Se quiser, nomeie como pergunta, afirmação, ferida ou desejo. Se não, diga em poucas palavras como esse centro se apresenta.",
    atrito: `Não fique só no rótulo. Nomeie a tensão em duas pontas. Ex.: ${buildRotatingOppositionExample("atrito")}.`,
    cena: buildSceneRepairCore("cena", userText),
    concreto: buildSceneRepairCore("concreto", userText),
    contraste: `Nomeie claramente as duas forças em tensão. Ex.: ${buildRotatingOppositionExample("contraste")}.`,
    sintese: "Reúna isso em até 3 linhas, sem abrir um novo debate.",
    frase_final: `${buildFinalLineReminder()} Em vez de explicar, afine isso numa única frase.`,
    forma_final: `${buildFinalLineReminder()} Feche em 1 frase ou 2 no máximo, na versão mais nítida que você sustentaria.`
  };

  const core = coreByStep[stepKey] || "Tente responder de forma mais nítida.";
  return prefix ? `${prefix}\n\n${core}` : core;
}

function buildCenterChoiceFragment(text) {
  const raw = normalizeInlineText(text);
  if (!raw) return "";

  let cleaned = raw;
  const framePatterns = [
    /^(?:o centro disso(?:\s+e(?:\s+este)?)?|centro|a frase que merece permanecer(?:\s+e)?|frase-nucleo|frase nucleo)\s*[:\-]?\s*/i,
    /^(?:pra mim|para mim|eu sinto que|quero dizer que)\s*[:,]?\s*/i
  ];

  for (let i = 0; i < 2; i += 1) {
    framePatterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, "").trim();
    });
  }

  const sentenceCandidates = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chosen =
    sentenceCandidates.find((item) => countMeaningfulWords(item) >= 6) ||
    cleaned ||
    raw;

  const clipped = chosen.split(/\s+/).slice(0, 18).join(" ").replace(/[\s,;:.-]+$/, "").trim();
  return clipWords(clipped || raw, 14);
}

function extractConcreteSceneAnchor(text) {
  const raw = normalizeInlineText(text);
  if (!raw) return "";

  const sentenceCandidates = raw
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chosen =
    sentenceCandidates.find((item) => detectSceneSignals(item).score >= 2 || detectSceneSignals(item).hasSpeech) ||
    sentenceCandidates[0] ||
    raw;

  return clipWords(chosen, 16);
}

function buildConcreteStepReply(text, nextPrompt) {
  const p = state.presence || PRESENCES.A;
  const anchor = extractConcreteSceneAnchor(text);
  const scene = detectSceneSignals(text);
  const lead =
    p.key === "D" ? (anchor ? `Fico com esta imagem: "${anchor}".` : "Isso já tem corpo.") :
    p.key === "C" ? (anchor ? `Isso já tem corpo: "${anchor}".` : "Isso já tem corpo.") :
    p.key === "B" ? (anchor ? `Isso ganhou corpo nesta imagem: "${anchor}".` : "Isso ganhou corpo.") :
    (anchor ? `Há uma cena viva aqui: "${anchor}".` : "Há uma cena viva aqui.");

  const gestureNudge = scene.hasGesture || scene.hasSpeech
    ? ""
    : " Se puder, mantenha o gesto no centro.";

  return `${lead}${gestureNudge}\n\n${nextPrompt}`;
}

function finalClosureLine() {
  return state.trackKey === "intermediaria"
    ? "Fechamos esta travessia. Vou preparar o seu registro."
    : "Fechamos esta volta. Vou preparar o seu registro.";
}

function buildFinalStepReply(text) {
  state.finalDraft = (text || "").trim();
  const p = state.presence || PRESENCES.A;
  const lead =
    p.key === "D" ? "Essa linha se sustenta." :
    p.key === "C" ? "Essa linha se sustenta." :
    p.key === "B" ? "Essa linha já se sustenta." :
    "Essa linha se sustenta.";

  return `${lead}\n\n${finalClosureLine()}`;
}

function refinedCenterChoicePrompt(fragment) {
  const p = state.presence || PRESENCES.A;
  const frag = buildCenterChoiceFragment(fragment);

  if (p.key === "D") {
    return `"${frag}"
Isso te soa mais como pergunta, afirmação, ferida ou desejo?
Se preferir, nomeie do seu jeito.`;
  }
  if (p.key === "C") {
    return `Em "${frag}", o núcleo parece mais pergunta, afirmação, ferida ou desejo?
Se quiser, nomeie com suas palavras.`;
  }
  if (p.key === "B") {
    return `Lendo "${frag}", eu sinto um núcleo vivo aqui.
Isso te soa mais como pergunta, afirmação, ferida ou desejo?
Se preferir, nomeie do seu jeito.`;
  }
  return `Quando você lê "${frag}", isso soa mais como pergunta, afirmação, ferida ou desejo?
Se preferir, nomeie do seu jeito.`;
}

// -------------------- TRACKS --------------------
const TRACKS = {
  iniciante: {
    name: "Jornada Iniciante (4 passos)",
    steps: [
      {
        key: "nucleo",
        prompt: "Passo 1 — Núcleo\nEscreva livremente sobre o que quer trabalhar hoje.",
        onUser: (t) => izaReply(t) + "\n\nAgora nomeie o centro disso em 1 frase."
      },
      {
        key: "centro",
        prompt: "Em 1 frase, qual é o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          state.centerSemanticTail = "";
          const frag = buildCenterChoiceFragment(t);
          return refinedCenterChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escolha um caminho ou nomeie com suas palavras.",
        onUser: (t) => {
          const parsed = parseCenterChoice(t);
          state.centerType = parsed.type;
          state.centerSemanticTail = parsed.semanticTail || "";
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
              p.key === "C" ? `Registrado: ${parsed.label}.` :
                p.key === "B" ? `Certo — vamos tratar o centro como ${parsed.label}.` :
                  `Ok — vamos tratar o centro como ${parsed.label}.`;
          return `${lead}\n\nPasso 2 — Atrito\nO que está em jogo aqui: conflito, desejo, risco ou dúvida?`;
        }
      },
      {
        key: "atrito",
        prompt: "Passo 2 — Atrito\nO que está em jogo aqui?",
        onUser: (t) => {
          const hint =
            state.centerType === "pergunta" ? "Qual parte da pergunta dói mais?" :
              state.centerType === "afirmacao" ? "O que ameaça essa afirmação?" :
                state.centerType === "ferida" ? "O que encosta nessa ferida?" :
                  state.centerType === "desejo" ? "O que atrapalha esse desejo?" :
                    "Qual é a tensão aqui?";
          return izaReply(t) + `\n\nPasso 3 — Cena\nTraga uma cena concreta: lugar, alguém e um gesto. ${hint}`;
        }
      },
      {
        key: "cena",
        prompt: "Passo 3 — Cena\nTraga uma cena concreta: lugar, alguém e um gesto.",
        onUser: (t) => buildConcreteStepReply(t, "Passo 4 — Frase que fica\nEscreva a frase que merece permanecer.")
      },
      {
        key: "frase_final",
        prompt: "Passo 4 — Frase que fica\nEscreva a frase que merece permanecer.",
        onUser: (t) => buildFinalStepReply(t),
        endScreen: true
      }
    ]
  },

  intermediaria: {
    name: "Jornada Intermediária (7 passos)",
    steps: [
      {
        key: "tema",
        prompt: "Passo 1 — Tema\nEm poucas palavras, qual é o tema?",
        onUser: (t) => izaReply(t) + "\n\nPasso 2 — Centro\nDiga o centro disso em 1 frase."
      },
      {
        key: "centro",
        prompt: "Passo 2 — Centro\nDiga o centro disso em 1 frase.",
        onUser: (t) => {
          state.centerType = null;
          state.centerSemanticTail = "";
          const frag = buildCenterChoiceFragment(t);
          return refinedCenterChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escolha um caminho ou formule do seu jeito.",
        onUser: (t) => {
          const parsed = parseCenterChoice(t);
          state.centerType = parsed.type;
          state.centerSemanticTail = parsed.semanticTail || "";
          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D" ? `Ok: ${parsed.label}.` :
              p.key === "C" ? `Registrado: ${parsed.label}.` :
                p.key === "B" ? `Certo — tratemos o centro como ${parsed.label}.` :
                  `Ok — tratemos o centro como ${parsed.label}.`;
          return `${lead}\n\nPasso 3 — Atrito\nO que está em jogo: conflito, regra, risco ou desejo?`;
        }
      },
      {
        key: "atrito",
        prompt: "Passo 3 — Atrito\nO que está em jogo?",
        onUser: (t) => izaReply(t) + "\n\nPasso 4 — Concreto\nMostre onde isso aparece: cena, fala, gesto ou lugar."
      },
      {
        key: "concreto",
        prompt: "Passo 4 — Concreto\nOnde isso aparece de forma concreta?",
        onUser: (t) => buildConcreteStepReply(t, "Passo 5 — Contraste\nNomeie duas forças em tensão (ex.: medo x vontade).")
      },
      {
        key: "contraste",
        prompt: "Passo 5 — Contraste\nDuas forças em tensão:",
        onUser: (t) => izaReply(t) + "\n\nPasso 6 — Síntese\nReúna tudo em 3 linhas."
      },
      {
        key: "sintese",
        prompt: "Passo 6 — Síntese\nReúna tudo em 3 linhas.",
        onUser: (t) => izaReply(t) + "\n\nPasso 7 — Forma final\nEscreva a versão que vale levar adiante."
      },
      {
        key: "forma_final",
        prompt: "Passo 7 — Forma final\nEscreva a versão que você quer sustentar.",
        onUser: (t) => buildFinalStepReply(t),
        endScreen: true
      }
    ]
  },

  inspirada: {
    name: "Jornada Inspirada (conversa aberta)",
    steps: [
      {
        key: "abertura",
        prompt: "Sobre o que você quer escrever hoje?",
        onUser: (t) => izaReply(t) + "\n\nSe fosse nomear o centro em 1 frase, como diria?"
      },
      {
        key: "centro",
        prompt: "Em 1 frase, qual é o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          state.centerSemanticTail = "";
          const frag = buildCenterChoiceFragment(t);
          return refinedCenterChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "Escolha um caminho ou diga do seu jeito.",
        onUser: (t) => {
          const parsed = parseCenterChoice(t);
          state.centerType = parsed.type;
          state.centerSemanticTail = parsed.semanticTail || "";
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
  state.centerSemanticTail = "";
  state.finalDraft = "";
  state.finalClosure = null;
  state.journeyRubric = null;
  state.doneChecklist = null;
  state.sent = false;

  state.registerStatus = "idle";
  state.registerError = "";

  state.registerFinalDone = false;
  state.registerGiftDone = false;

  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];
  IZA_ENGINE.lastRuleName = "";
  IZA_ENGINE.lineHistory = Object.create(null);

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

    const validation = validateStepInput(step.key, userText);
    pushTurn("user", userText, {
      stepKey: step.key,
      validation: validation.ok ? "ok" : "repair_needed"
    });

    const repairAttempts = countRepairAttemptsForStep(step.key);
    if (!validation.ok && repairAttempts <= MAX_STEP_REPAIRS) {
      const repairReply = buildStepValidationReply(step.key, userText);
      pushTurn("iza", repairReply, {
        stepKey: step.key,
        validation: "repair"
      });
      showIza(repairReply, () => showStep());
      return;
    }

    const acceptedValidation = validation.ok ? "accepted" : "soft_accept";
    if (!validation.ok) {
      state.turns[state.turns.length - 1].meta.validation = acceptedValidation;
    }

    const reply = validation.ok ? step.onUser(userText) : buildSoftAdvanceReply(step, userText);
    pushTurn("iza", reply, {
      stepKey: step.key,
      validation: acceptedValidation
    });

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

      <textarea id="txt" class="input-area" rows="5" ${canSend ? "" : "disabled"} placeholder="${canSend ? "" : "Esta resposta já foi registrada."}"></textarea>

      ${canSend
        ? `<button id="btnSend" class="button">Registrar resposta</button>`
        : `<div class="iza-hint">Você está revendo uma etapa anterior. O texto enviado fica guardado no registro.</div>`
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
        : `<div class="iza-hint">Você está revendo uma fala anterior da IZA.</div>`
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

  // salva o payload COMPLETO (não "capado")
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
  const trackLabel = (TRACKS[state.trackKey]?.name || state.trackKey || "")
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim();
  const header =
    `IZA no Cordel 2.0 - Registro\n` +
    `Nome: ${state.name}\nEmail: ${state.email}\n` +
    `Município: ${state.municipio || ""}\nEstado: ${state.estadoUF || ""}\nOrigem: ${state.origem || ""}\n` +
    `Trilha: ${trackLabel}\nPresença: ${state.presence?.name || state.presenceKey}\n` +
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
  "voces", "texto", "escrita", "coisa", "aqui", "agora", "hoje", "ontem", "amanha", "gente", "quando",
  "tipo", "sobre", "fazer", "feito", "tenho", "tava", "estou", "quero", "queria", "vai",
  "vou", "fica", "ficou", "so", "mim", "meus", "minhas", "dele", "dela", "principalmente",
  "certamente", "proprio", "propria", "proprios", "proprias", "jeito", "modo", "passo", "frase",
  "linha", "linhas", "sintese", "versao", "forma", "registro", "trilha", "jornada", "nucleo",
  "centro", "pergunta", "afirmacao", "ferida", "desejo", "questionamento", "resposta", "detalhe",
  "detalhes", "coisas", "algo", "alguma", "algumas", "algum", "alguns", "melhor", "ainda",
  "quanto", "quantos", "quanta", "quantas", "todo", "todos", "toda", "todas",
  "tentar", "tento", "parece", "parecer", "deixa", "deixar", "certo", "certa", "certos", "certas",
  "reflexao", "reflexoes"
]);

const JOURNEY_WEAK_TOKENS = new Set([
  "acha", "achar", "acho", "amo", "amar", "apenas", "certa", "certo", "certamente",
  "deixa", "deixar", "deve", "dever", "deveria", "gosta", "gostar", "mundo",
  "parece", "parecer", "pode", "poder", "poderia", "podia", "precisa", "precisar",
  "principalmente", "quer", "querer", "quanto", "quando", "resto", "sabe", "saber",
  "tento", "tentar", "todo", "verdade", "anos", "ano"
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

const SCENE_PRIORITY_TOKENS = new Set([
  "amazonia", "antartida", "bairro", "barro", "calcada", "cozinha", "corpo", "favela",
  "fogao", "gas", "irma", "irmao", "janela", "justica", "laje", "mao", "mercado",
  "muro", "olhar", "olhos", "paredao", "periferia", "porta", "praia", "praca",
  "quarto", "quintal", "rio", "rosto", "rua", "sala", "silencio", "tecnica",
  "territorio", "varal", "viela", "voz", "ausencia"
]);

function scoreKeywordToken(token, contextWeight = 1) {
  const lengthBonus = Math.min(2, Math.max(0, token.length - 5) * 0.2);
  const symbolicBonus = /(?:dade|mento|cao|coes|gem|ario|arios|eiro|eira|ismo|ista|istas|ura|ez|al|or|orio)$/.test(token)
    ? 0.8
    : 0;
  const sceneBonus = SCENE_PRIORITY_TOKENS.has(token) ? 1.15 : 0;
  return contextWeight + lengthBonus + symbolicBonus + sceneBonus;
}

function tokenizeForKeywords(text) {
  return normalizeSearchText(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !JOURNEY_STOPWORDS.has(token) && !JOURNEY_WEAK_TOKENS.has(token));
}

function keywordDisplayKey(token) {
  return normalizeSearchText(token).replace(/[^a-z0-9]/g, "");
}

function buildJourneyKeywordDisplayMap(texts) {
  const map = Object.create(null);
  (texts || []).forEach((text) => {
    const matches = String(text || "").match(/[A-Za-zÀ-ÿ0-9]+/g) || [];
    matches.forEach((raw) => {
      const clean = String(raw || "").trim();
      const key = keywordDisplayKey(clean);
      if (!key || JOURNEY_STOPWORDS.has(key) || JOURNEY_WEAK_TOKENS.has(key)) return;
      if (!map[key] || clean.length > map[key].length) map[key] = clean;
    });
  });
  return map;
}

function extractJourneyKeywordData(limit = 12) {
  const counts = Object.create(null);
  const seenRoots = new Set();
  const sources = resolveKeywordSources();
  const displayMap = buildJourneyKeywordDisplayMap(sources.map(({ text }) => text));

  sources.forEach(({ text, weight }) => {
    tokenizeForKeywords(text).forEach((token) => {
      counts[token] = (counts[token] || 0) + scoreKeywordToken(token, weight);
    });
  });

  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .filter(([token]) => {
      const root = keywordRoot(token);
      if (seenRoots.has(root)) return false;
      seenRoots.add(root);
      return true;
    })
    .slice(0, Math.max(1, limit));

  const maxScore = ranked[0]?.[1] || 1;
  const minScore = ranked[ranked.length - 1]?.[1] || maxScore;
  const spread = Math.max(0.01, maxScore - minScore);

  return ranked.map(([token, score], index) => {
    const ratio = (score - minScore) / spread;
    return {
      token,
      text: displayMap[token] || token,
      score: Number(score.toFixed(2)),
      size: Number((0.92 + ratio * 0.8).toFixed(2)),
      tone: index % 4
    };
  });
}

function listToNaturalLanguage(items) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} e ${values[values.length - 1]}`;
}

function userTurnsWithMeta() {
  return userTurnsOnly().map((turn) => ({ ...turn, meta: turn.meta || {} }));
}

function userTurnsByStepKeys(stepKeys) {
  const wanted = Array.isArray(stepKeys) ? stepKeys : [stepKeys];
  const lookup = new Set(wanted.filter(Boolean));
  return userTurnsWithMeta().filter((turn) => lookup.has(turn.meta?.stepKey));
}

function scoreJourneyTurnWeight(turn, index, total) {
  const stepKey = turn.meta?.stepKey || "";
  let weight = 1.15;

  if (turn.meta?.validation === "repair_needed") weight *= 0.35;
  if (stepKey === "cena" || stepKey === "concreto") weight += 1.7;
  else if (stepKey === "sintese") weight += 1.25;
  else if (stepKey === "frase_final" || stepKey === "forma_final") weight += isStrongFinalLine(turn.text) ? 1.45 : 0.55;
  else if (stepKey === "centro") weight += 0.9;
  else if (stepKey === "atrito" || stepKey === "contraste") weight += 0.65;
  else if (stepKey === "tipo_centro") weight *= 0.35;

  if (index >= Math.max(0, total - 3)) weight += 0.35;
  return Math.max(0.2, weight);
}

function resolveConcreteSceneAnchorText() {
  const concreteTurns = userTurnsByStepKeys(["cena", "concreto"])
    .filter((turn) => turn.meta?.validation !== "repair_needed")
    .map((turn) => normalizeInlineText(turn.text))
    .filter(Boolean);

  const bestConcrete = concreteTurns
    .map((text) => ({ text, scene: detectSceneSignals(text) }))
    .sort((a, b) => b.scene.score - a.scene.score || b.scene.wordCount - a.scene.wordCount)[0];

  if (bestConcrete?.text) {
    return extractConcreteSceneAnchor(bestConcrete.text);
  }

  const finalAnchor = normalizeInlineText(resolveFinalAnchorText());
  if (detectSceneSignals(finalAnchor).score >= 2) {
    return extractConcreteSceneAnchor(finalAnchor);
  }

  return "";
}

function resolveKeywordSources() {
  const turns = userTurnsWithMeta();
  const total = turns.length || 1;
  const sources = turns
    .map((turn, index) => ({
      text: normalizeInlineText(turn.text),
      weight: scoreJourneyTurnWeight(turn, index, total)
    }))
    .filter((entry) => entry.text);

  if (state.centerSemanticTail) {
    sources.push({ text: normalizeInlineText(state.centerSemanticTail), weight: 4.2 });
  }

  const concreteAnchor = resolveConcreteSceneAnchorText();
  if (concreteAnchor) {
    sources.push({ text: concreteAnchor, weight: 3.8 });
  }

  const finalAnchor = resolveFinalAnchorText();
  if (finalAnchor) {
    sources.push({
      text: finalAnchor,
      weight: isStrongFinalLine(finalAnchor) ? 3.3 : 2.2
    });
  }

  const emergent = extractEmergentPhrase();
  if (emergent) {
    sources.push({ text: emergent, weight: 2.5 });
  }

  return sources;
}

function extractJourneyKeywords() {
  return extractJourneyKeywordData(6).map((item) => item.text);
}

function buildJourneySynthesis(summary, keywords) {
  const trackName = (TRACKS[state.trackKey]?.name || "jornada").replace(/\s*\([^)]*\)\s*/g, "").trim();
  const focus = listToNaturalLanguage((keywords || []).slice(0, 3));
  const sceneAnchor = clipText(summary.sceneAnchor || resolveConcreteSceneAnchorText(), 120);
  const centerMap = {
    pergunta: "uma pergunta que pediu desdobramento",
    afirmacao: "uma afirmação que pediu sustento",
    ferida: "uma ferida que pediu nome e contorno",
    desejo: "um desejo que buscou forma",
    livre: "um núcleo ainda aberto"
  };

  const lines = [];
  lines.push(
    focus
      ? `Na ${trackName.toLowerCase()}, o seu texto foi girando em torno de ${focus}.`
    : `Na ${trackName.toLowerCase()}, o seu texto foi encontrando um eixo próprio.`
  );

  if (state.centerSemanticTail) {
    lines.push(`Logo cedo, uma linha pediu retorno: "${clipText(state.centerSemanticTail, 110)}".`);
  } else if (state.centerType) {
    lines.push(`No percurso, apareceu ${centerMap[state.centerType] || "um núcleo que foi se revelando melhor"}.`);
  } else if (
    summary.firstText &&
    summary.lastText &&
    normalizeInlineText(summary.firstText) !== normalizeInlineText(summary.lastText)
  ) {
    lines.push("Do primeiro impulso ao fecho, a escrita foi ganhando nitidez, corpo e direcao.");
  } else {
    lines.push("Ao longo da conversa, a ideia foi aparecendo com mais clareza.");
  }

  if (sceneAnchor) {
    lines.push(`Em certo ponto, o texto ganhou corpo nesta cena: "${sceneAnchor}".`);
  }

  if (summary.emergentPhrase) {
    lines.push(`E, quando tudo foi afinando, esta linha ficou vibrando por baixo das outras: "${clipText(summary.emergentPhrase, 120)}".`);
  } else if (summary.lastText) {
    lines.push(`No fim, o que mais ficou aceso foi isto: "${clipText(summary.lastText, 120)}".`);
  }

  const synthesis = lines.join(" ").replace(/\s+/g, " ").trim();
  return synthesis.length > 420 ? synthesis.slice(0, 417).trim() + "..." : synthesis;
}

function buildContinuationInvitation(summary, keywordCloud) {
  const strongWords = (keywordCloud || []).map((item) => item.text).filter(Boolean);
  const seed = strongWords[0] || summary?.keywords?.[0] || "palavra";
  const companion = strongWords[1] || summary?.keywords?.[1] || "frase";
  const sceneAnchor = clipText(summary?.sceneAnchor || resolveConcreteSceneAnchorText(), 96);
  const finalLine = clipText(summary?.lastText || resolveFinalAnchorText(), 110);

  if (sceneAnchor && finalLine) {
    return `Se essa linha voltar, recomeça por esta imagem: "${sceneAnchor}". Escreve mais três linhas sem se vigiar. Às vezes o texto só estava pedindo intervalo.`;
  }

  if (finalLine) {
    return `Se essa linha voltar mais tarde, continua escrevendo a partir dela por mais três linhas, sem se vigiar. O texto pode ter fechado por hoje, mas ainda não terminou de nascer.`;
  }

  return `Se ${seed} ou ${companion} voltarem depois, anota antes que esfriem e segue escrevendo. Nem toda palavra pede ponto final na primeira aparicao.`;
}

function collectSemanticAnchorTokens() {
  const tokens = [];
  const pushTokens = (text) => {
    tokenizeForKeywords(text).forEach((token) => tokens.push(token));
  };

  pushTokens(state.centerSemanticTail || "");
  pushTokens(resolveFinalAnchorText() || "");

  userTurnsByStepKeys(["centro", "atrito", "cena", "concreto", "sintese", "frase_final", "forma_final"])
    .filter((turn) => turn.meta?.validation !== "repair_needed")
    .forEach((turn) => pushTokens(turn.text));

  return Array.from(new Set(tokens));
}

function keywordOverlapCount(text, referenceTokens) {
  const lookup = new Set(Array.isArray(referenceTokens) ? referenceTokens : tokenizeForKeywords(referenceTokens));
  if (!lookup.size) return 0;

  const seen = new Set();
  return tokenizeForKeywords(text).filter((token) => {
    if (seen.has(token)) return false;
    seen.add(token);
    return lookup.has(token);
  }).length;
}

function lexicalDensity(text) {
  const words = countMeaningfulWords(text);
  if (!words) return 0;
  return tokenizeForKeywords(text).length / words;
}

function buildJourneyRubric(summary) {
  const anchors = collectSemanticAnchorTokens();
  const sceneScores = userTurnsByStepKeys(["cena", "concreto"]).map((turn) => detectSceneSignals(turn.text).score);
  const bestSceneScore = sceneScores.length ? Math.max(...sceneScores) : 0;
  const repairCount = userTurnsWithMeta().filter((turn) => turn.meta?.validation === "repair_needed").length;
  const summaryText = [summary.journeySynthesis || "", (summary.keywords || []).join(" "), summary.lastText || ""].join(" ");
  const semanticOverlap = keywordOverlapCount(summaryText, anchors);
  const socraticCount = (state.turns || []).filter((turn) => turn.role === "iza" && isSocraticPrompt(turn.text)).length;
  const mirrorCount = (state.turns || []).filter((turn) => turn.role === "iza" && isMirrorishText(turn.text)).length;
  const lastIza = recentIzaTexts(1)[0] || "";
  const closingWords = countMeaningfulWords(lastIza);
  const closingLines = countTextLines(lastIza);

  const items = {
    fidelidadeAoPasso: {
      score: repairCount === 0 ? 2 : repairCount <= 2 ? 1 : 0,
      max: 2,
      note: repairCount === 0 ? "A trilha avancou sem pular tarefa." : repairCount <= 2 ? "Houve alguns reparos de passo." : "A conversa ainda precisou de muitos reparos para se manter na trilha."
    },
    concretude: {
      score: bestSceneScore >= 3 ? 2 : bestSceneScore >= 2 ? 1 : 0,
      max: 2,
      note: bestSceneScore >= 3 ? "A conversa chegou a cena concreta." : bestSceneScore >= 2 ? "Há algum lastro concreto, mas ainda pode fechar melhor." : "Ainda falta corpo concreto na cena."
    },
    retencaoSemantica: {
      score: semanticOverlap >= 3 ? 2 : semanticOverlap >= 1 ? 1 : 0,
      max: 2,
      note: semanticOverlap >= 3 ? "A síntese reteve os eixos semânticos centrais." : semanticOverlap >= 1 ? "Parte do campo semântico foi preservada." : "A síntese ainda se afasta demais do vocabulário vivo do usuário."
    },
    qualidadeDaPergunta: {
      score: socraticCount >= 2 && mirrorCount <= 1 ? 2 : socraticCount >= 1 ? 1 : 0,
      max: 2,
      note: socraticCount >= 2 && mirrorCount <= 1 ? "As perguntas socráticas puxaram a conversa sem repetir demais." : socraticCount >= 1 ? "Há boas perguntas, mas o encadeamento ainda pode ficar mais firme." : "A conversa ainda pergunta pouco ou pergunta de modo pouco distintivo."
    },
    qualidadeDoFechamento: {
      score: closingWords > 0 && closingWords <= 24 && closingLines <= 2 ? 2 : closingWords <= 40 && closingLines <= 3 ? 1 : 0,
      max: 2,
      note: closingWords > 0 && closingWords <= 24 && closingLines <= 2 ? "O fechamento foi enxuto e orientado." : closingWords <= 40 && closingLines <= 3 ? "O fechamento funciona, mas ainda carrega instrucao demais." : "O fechamento ainda dispersa em vez de fechar."
    },
    qualidadeDaSinteseFinal: {
      score: (summary.keywords || []).length >= 3 && semanticOverlap >= 3 ? 2 : (summary.keywords || []).length >= 2 && semanticOverlap >= 1 ? 1 : 0,
      max: 2,
      note: (summary.keywords || []).length >= 3 && semanticOverlap >= 3 ? "A síntese final está ancorada no tema real do texto." : (summary.keywords || []).length >= 2 && semanticOverlap >= 1 ? "A síntese final já indica o tema, mas ainda pode ficar mais fiel." : "A síntese final ainda esta vulneravel a resíduos de formulação."
    }
  };

  const total = Object.values(items).reduce((sum, item) => sum + item.score, 0);
  return {
    total,
    max: Object.values(items).reduce((sum, item) => sum + item.max, 0),
    items
  };
}

function buildDoneChecklist(summary, rubric) {
  const finalText = resolveFinalAnchorText() || summary.lastText || "";
  const finalAccepted = userTurnsByStepKeys(["frase_final", "forma_final"])
    .some((turn) => turn.meta?.validation === "ok" && normalizeInlineText(turn.text) === normalizeInlineText(finalText));
  const finalOverlap = keywordOverlapCount(finalText, collectSemanticAnchorTokens());

  return {
    fraseFinalMaisForte: {
      ok: isStrongFinalLine(finalText) && (finalAccepted || finalOverlap >= 1),
      note: isStrongFinalLine(finalText) && (finalAccepted || finalOverlap >= 1)
        ? "O fechamento está compacto o bastante para funcionar como frase que fica."
        : isStrongFinalLine(finalText)
          ? "A linha final ficou compacta, mas ainda precisa se ligar melhor ao percurso anterior."
        : "A linha final ainda pede mais lapidacao para ficar mais forte que a resposta espontanea anterior."
    },
    naoAbandonouPasso: {
      ok: rubric.items.fidelidadeAoPasso.score >= 2 && (state.trackKey !== "iniciante" || rubric.items.concretude.score >= 1),
      note: rubric.items.fidelidadeAoPasso.score >= 2
        ? "A conversa conseguiu ficar dentro da tarefa de cada passo."
        : "Ainda houve momentos em que a conversa saiu do objetivo do passo."
    },
    sinteseRefleteTema: {
      ok: rubric.items.retencaoSemantica.score >= 1 && rubric.items.qualidadeDaSinteseFinal.score >= 1,
      note: rubric.items.retencaoSemantica.score >= 1 && rubric.items.qualidadeDaSinteseFinal.score >= 1
        ? "A síntese final está razoavelmente ancorada nos temas reais do texto."
        : "A síntese final ainda precisa se prender mais ao tema real e menos ao resíduo metadiscursivo."
    }
  };
}

function formatRubricForTranscript(rubric) {
  if (!rubric?.items) return "";
  return Object.entries(rubric.items)
    .map(([key, item]) => `- ${key}: ${item.score}/${item.max} - ${item.note}`)
    .join("\n");
}

function formatDoneChecklistForTranscript(doneChecklist) {
  if (!doneChecklist) return "";
  return Object.entries(doneChecklist)
    .map(([key, item]) => `- ${key}: ${item.ok ? "SIM" : "NÃO"} - ${item.note}`)
    .join("\n");
}

function buildFallbackLiteraryGift(payloadOrKeywords) {
  const payload = Array.isArray(payloadOrKeywords)
    ? { keywords: payloadOrKeywords }
    : (payloadOrKeywords || {});
  const keywords = payload.keywords || [];
  const seed = keywords[0] || "palavra";
  const companion = keywords[1] || "eco";
  const sceneAnchor = clipText(payload.sceneAnchor || resolveConcreteSceneAnchorText(), 110);
  const finalAnchor = clipText(payload.lastText || resolveFinalAnchorText(), 110);
  let fragment = `Guarde ${seed}. Quando a trilha parece terminar, ela ainda conversa com ${companion}. O que ficou vivo aqui talvez seja o começo de outra frase.`;

  if (sceneAnchor && finalAnchor && sceneAnchor !== finalAnchor) {
    fragment = `Guarde esta imagem: "${sceneAnchor}". E guarde também esta linha: "${finalAnchor}". Entre ${seed} e ${companion}, ainda há uma frase pedindo continuidade.`;
  } else if (sceneAnchor) {
    fragment = `Guarde esta imagem: "${sceneAnchor}". Entre ${seed} e ${companion}, ela ainda pede outra frase.`;
  } else if (finalAnchor) {
    fragment = `Guarde esta linha: "${finalAnchor}". Entre ${seed} e ${companion}, ela ainda pede outra frase.`;
  }
  return {
    source: "fallback",
    seed,
    intro: "As suas palavras ficaram acesas aqui. A biblioteca não me abriu um verso com nome, mas alguma ressonância continuou viva.",
    fragment: `Guarde ${seed}. Quando a trilha parece terminar, ela ainda conversa com ${companion}. O que ficou vivo aqui talvez seja o começo de outra frase.`,
    fragment,
    author: "IZA",
    title: "Eco que ficou",
    matchedKeywords: [seed, companion].filter(Boolean)
  };
}

function enrichFallbackLiteraryGift(gift, payload) {
  const base = { ...(gift || {}) };
  const sceneAnchor = clipText(payload?.sceneAnchor || resolveConcreteSceneAnchorText(), 110);
  const finalAnchor = clipText(payload?.lastText || resolveFinalAnchorText(), 110);
  const seed = base.seed || payload?.keywords?.[0] || "palavra";
  const companion = payload?.keywords?.[1] || (base.matchedKeywords || [])[1] || "eco";

  if (sceneAnchor && finalAnchor && sceneAnchor !== finalAnchor) {
    base.fragment = `Guarde esta imagem: "${sceneAnchor}". E guarde também esta linha: "${finalAnchor}". Entre ${seed} e ${companion}, ainda há uma frase pedindo continuidade.`;
  } else if (sceneAnchor) {
    base.fragment = `Guarde esta imagem: "${sceneAnchor}". Entre ${seed} e ${companion}, ela ainda pede outra frase.`;
  } else if (finalAnchor) {
    base.fragment = `Guarde esta linha: "${finalAnchor}". Entre ${seed} e ${companion}, ela ainda pede outra frase.`;
  }

  return base;
}

function normalizeGiftResponse(rawGift, payload) {
  if (!rawGift || !rawGift.fragment) {
    return enrichFallbackLiteraryGift(buildFallbackLiteraryGift(payload.keywords || []), payload);
  }

  const fragment = clipMultilineText(rawGift.fragment, 320);
  if (!fragment) return enrichFallbackLiteraryGift(buildFallbackLiteraryGift(payload.keywords || []), payload);

  return {
    source: rawGift.source || "poems_sheet",
    seed: rawGift.seed || payload.keywords?.[0] || "",
    intro:
      rawGift.intro ||
      "As suas palavras me lembraram uma poesia que li há tempo. Guardei este fragmento para te devolver.",
    fragment,
    author: rawGift.author || "Autor desconhecido",
    title: rawGift.title || "Trecho sem título",
    matchedKeywords: Array.isArray(rawGift.matchedKeywords)
      ? rawGift.matchedKeywords.filter(Boolean).slice(0, 5)
      : (payload.keywords || []).slice(0, 3)
  };
}

function buildGiftLookupFallback(payload, response) {
  const gift = enrichFallbackLiteraryGift(buildFallbackLiteraryGift(payload.keywords || []), payload);
  const reason = response?.error || "gift_lookup_unavailable";
  return {
    ...gift,
    source: "fallback_local",
    intro:
      reason === "timeout"
        ? "A biblioteca poética demorou mais do que devia para responder. Ainda assim, ficou um eco vivo por aqui."
        : reason === "rpc_timeout"
          ? "A biblioteca poética demorou mais do que devia para responder neste ambiente. Ainda assim, ficou um eco vivo por aqui."
        : reason === "network"
          ? "A ligação com a biblioteca poética falhou neste momento. Ainda assim, alguma ressonância ficou viva aqui."
          : reason === "rpc_failure"
            ? "A ligação interna com a biblioteca poética falhou neste momento. Ainda assim, alguma ressonância ficou viva aqui."
            : reason === "query_too_long"
              ? "O pedido a biblioteca poética ficou maior do que o canal suportou. Ainda assim, alguma ressonância ficou viva aqui."
              : reason === "dom_unavailable"
                ? "Não consegui abrir o canal do presente literário nesta tela. Ainda assim, alguma ressonância ficou viva aqui."
          : "A biblioteca poética encontrou um desvio na busca. Ainda assim, alguma ressonância ficou viva aqui."
  };
}

function renderGiftLead(source) {
  if (source === "associated_poem") {
    return "As suas palavras me lembraram uma poesia que li há tempo. Não era o mesmo espelho, mas havia uma vizinhança de imagens entre os dois textos.";
  }
  if (source === "iza_blessing" || source === "fallback") {
    return "Nem todo eco chega por um livro já aberto. Às vezes ele nasce do que continuou vibrando no seu texto.";
  }
  return "As suas palavras me lembraram uma poesia que li há tempo. Separei este fragmento para devolver vida ao que ainda está se movendo no seu texto.";
}

function resolveFinalAnchorText() {
  const finalTurns = userTurnsByStepKeys(["frase_final", "forma_final"])
    .map((turn) => normalizeInlineText(turn.text))
    .filter(Boolean);
  const validatedFinal = finalTurns.find((text) => isStrongFinalLine(text));
  if (validatedFinal) return validatedFinal;

  const draft = normalizeInlineText(state.finalDraft);
  if (isStrongFinalLine(draft)) return draft;

  const synthesisTurn = userTurnsByStepKeys(["sintese"])
    .map((turn) => normalizeInlineText(turn.text))
    .filter(Boolean)
    .slice(-1)[0];
  if (synthesisTurn) return synthesisTurn;

  const centerTail = normalizeInlineText(state.centerSemanticTail);
  if (centerTail) return centerTail;

  const concreteTurn = userTurnsByStepKeys(["cena", "concreto"])
    .map((turn) => normalizeInlineText(turn.text))
    .filter(Boolean)
    .slice(-1)[0];
  if (concreteTurn) return concreteTurn;

  return (
    normalizeInlineText(userTurnsOnly().slice(-1)[0]?.text) ||
    normalizeInlineText(userTurnsOnly()[0]?.text)
  );
}

function extractEmergentPhrase() {
  const source = resolveFinalAnchorText();
  if (!source) return "";

  const sentences = source.match(/[^.!?]+[.!?]?/g) || [source];
  const best =
    sentences.map((sentence) => normalizeInlineText(sentence)).find((sentence) => sentence.length >= 24) ||
    normalizeInlineText(sentences[0]);

  return best.length > 180 ? best.slice(0, 177).trim() + "..." : best;
}

function buildFinalSummary() {
  const userTurns = userTurnsOnly();
  const base = {
    firstText: normalizeInlineText(userTurns[0]?.text),
    lastText: resolveFinalAnchorText(),
    emergentPhrase: extractEmergentPhrase(),
    centerSemanticTail: normalizeInlineText(state.centerSemanticTail),
    sceneAnchor: resolveConcreteSceneAnchorText()
  };
  const keywordCloud = extractJourneyKeywordData(12);
  const keywords = keywordCloud.slice(0, 6).map((item) => item.text);
  const journeySynthesis = buildJourneySynthesis(base, keywords);
  const continuationInvitation = buildContinuationInvitation({ ...base, keywords }, keywordCloud);
  const summary = {
    ...base,
    keywords,
    keywordCloud,
    continuationInvitation,
    journeySynthesis
  };
  const rubric = buildJourneyRubric(summary);
  const doneChecklist = buildDoneChecklist(summary, rubric);

  state.journeyRubric = rubric;
  state.doneChecklist = doneChecklist;

  return {
    ...summary,
    rubric,
    doneChecklist
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
    parts.push(`\n---\nSINTESE DA JORNADA:\n${payload.journeySynthesis}\n`);
  }

  if (payload.keywords?.length) {
    parts.push(`\nPALAVRAS-CHAVE:\n${payload.keywords.join(", ")}\n`);
  }

  if (payload.keywordCloud?.length) {
    parts.push(`\nCONSTELACAO DE PALAVRAS:\n${payload.keywordCloud.slice(0, 12).map((item) => item.text).join(" · ")}\n`);
  }

  if (payload.continuationInvitation) {
    parts.push(`\nCHAMADO PARA CONTINUAR:\n${payload.continuationInvitation}\n`);
  }

  if (payload.literaryGift?.fragment) {
    const searchInvitation = buildGiftSearchInvitation(payload.literaryGift);
    parts.push(
      `\nRESSONÂNCIA POÉTICA:\n${payload.literaryGift.intro ? payload.literaryGift.intro + "\n\n" : ""}${payload.literaryGift.fragment}\n` +
      `${searchInvitation ? searchInvitation + "\n" : ""}` +
      `Referencia: ${payload.literaryGift.author || "IZA"}${payload.literaryGift.title ? " - " + payload.literaryGift.title : ""}\n`
    );
  }

  return parts.join("").replace(/ Â· /g, " | ");
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

function renderKeywordCloud(keywordCloud) {
  const values = (keywordCloud || []).filter((item) => item?.text);
  if (!values.length) return "";
  return `
    <div class="iza-word-cloud" aria-label="Constelação de palavras">
      ${values.map((item) => `
        <span class="iza-word-cloud__item iza-word-cloud__item--${item.tone}" style="font-size:${item.size}rem">
          ${escapeHtml(item.text)}
        </span>
      `).join("")}
    </div>
  `;
}

function buildGiftSearchInvitation(gift) {
  if (!gift?.author || gift?.author === "IZA") {
    return "Se esse eco voltar depois, continua escrevendo a partir dele.";
  }
  const reference = gift?.title
    ? `"${gift.title}", de ${gift.author}`
    : gift.author;
  return `Esqueci o restante, mas, se tiver curiosidade, procure depois por ${reference}.`;
}

function renderLiteraryGift(payload) {
  const activeKeywords = payload.literaryGift?.matchedKeywords?.length
    ? payload.literaryGift.matchedKeywords
    : (payload.keywords || []);
  const keywordsHtml = renderKeywordTags(activeKeywords);
  const cloudHtml = renderKeywordCloud(payload.keywordCloud || []);

  if (payload.literaryGiftStatus === "loading") {
    return `
      <div class="iza-gift">
        <p class="iza-section-title"><strong>Ressonância poética</strong></p>
        <p class="iza-copy">As suas palavras ainda estao acesas aqui. Estou ouvindo o que nelas pede continuidade.</p>
        <p class="iza-copy iza-copy--soft">Enquanto procuro um fragmento para devolver, deixo esta constelação respirar um pouco.</p>
        ${cloudHtml}
        ${keywordsHtml}
        <div class="message">IZA está procurando um eco poético para essas pistas...</div>
      </div>
    `;
  }

  const gift = payload.literaryGift || enrichFallbackLiteraryGift(buildFallbackLiteraryGift(payload.keywords || []), payload);
  const credit = [gift.author, gift.title].filter(Boolean).join(" - ");
  const searchInvitation = buildGiftSearchInvitation(gift);

  return `
    <div class="iza-gift">
      <p class="iza-section-title"><strong>Ressonância poética</strong></p>
      <p class="iza-copy">${escapeHtml(renderGiftLead(gift.source))}</p>
      <p class="iza-copy iza-copy--soft">${escapeHtml(gift.intro || "")}</p>
      ${cloudHtml}
      ${keywordsHtml}
      <div class="message">${escapeHtml(gift.fragment || "").replace(/\n/g, "<br>")}</div>
      <p class="iza-copy iza-copy--soft">${escapeHtml(searchInvitation)}</p>
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

function buildGiftJourneyContext(payload) {
  const userTexts = userTurnsOnly().map((turn) => normalizeInlineText(turn.text)).filter(Boolean);
  const middleStart = Math.max(0, Math.floor(userTexts.length / 2) - 2);
  const sections = [
    state.finalDraft || "",
    state.centerSemanticTail || "",
    payload.sceneAnchor || "",
    payload.emergentPhrase || "",
    userTexts.slice(0, Math.min(3, userTexts.length)).join(" || "),
    userTexts.slice(middleStart, middleStart + 4).join(" || "),
    userTexts.slice(-Math.min(6, userTexts.length)).join(" || "),
    userTexts.join(" || ")
  ];

  const unique = [];
  sections.forEach((section) => {
    const clean = normalizeInlineText(section);
    if (!clean) return;
    if (unique.includes(clean)) return;
    unique.push(clean);
  });

  return clipText(unique.join(" || "), 1600);
}

function buildGiftLookupRequestData(payload, compact = false) {
  const maxKeywords = compact ? 5 : 8;
  const maxSummary = compact ? 180 : 280;
  const maxSeedText = compact ? 240 : 520;
  const maxJourneyText = compact ? 720 : 1600;

  return {
    keywords: (payload.keywords || []).slice(0, maxKeywords),
    summary: clipText(payload.journeySynthesis, maxSummary),
    seedText: clipText(
      [payload.emergentPhrase, payload.lastText, state.finalDraft].filter(Boolean).join(" || "),
      maxSeedText
    ),
    journeyText: clipText(buildGiftJourneyContext(payload), maxJourneyText),
    trackKey: state.trackKey || "",
    presenceKey: state.presenceKey || ""
  };
}

function canUseAppsScriptGiftLookup() {
  return !!(
    window.google &&
    window.google.script &&
    window.google.script.run &&
    typeof window.google.script.run.withSuccessHandler === "function" &&
    typeof window.google.script.run.withFailureHandler === "function"
  );
}

function requestLiteraryGiftViaAppsScript(requestData) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = window.setTimeout(() => {
      finish({ ok: false, error: "rpc_timeout" });
    }, GIFT_LOOKUP_TIMEOUT_MS);

    const onDone = (result) => {
      window.clearTimeout(timer);
      finish(result || { ok: false, error: "empty_response" });
    };

    const onFail = (error) => {
      window.clearTimeout(timer);
      finish({
        ok: false,
        error: "rpc_failure",
        message: String(error?.message || error || "rpc_failure")
      });
    };

    try {
      window.google.script.run
        .withSuccessHandler(onDone)
        .withFailureHandler(onFail)
        .lookupLiteraryGift(requestData);
    } catch (error) {
      onFail(error);
    }
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function clearResolvedCheckinIdentity(nextEmail = "") {
  state.email = String(nextEmail || "").trim();
  state.name = "";
  state.municipio = "";
  state.estadoUF = "";
  state.origem = "";
  state.participantId = "";
  state.checkinUserId = "";
  state.checkinMatchStatus = "";
  state.checkinMatchMethod = "";
  state.teacherGroup = "";
  state.checkinLookupStatus = "idle";
  state.checkinLookupMessage = "";
}

function applyResolvedCheckinIdentity(identity) {
  state.name = String(identity?.name || "").trim();
  state.email = String(identity?.email || state.email || "").trim();
  state.municipio = String(identity?.municipio || "").trim();
  state.estadoUF = normalizeUFOrInternational(identity?.estado || "");
  state.origem = normalizeOrigem(identity?.origem || "");
  state.participantId = String(identity?.participantId || "").trim();
  state.checkinUserId = String(identity?.checkinUserId || "").trim();
  state.checkinMatchStatus = String(identity?.status || "matched").trim() || "matched";
  state.checkinMatchMethod = String(identity?.matchMethod || "email").trim() || "email";
  state.teacherGroup = String(identity?.teacherGroup || "").trim();
  state.checkinLookupStatus = "matched";
  state.checkinLookupMessage = "";
}

function renderWelcomeIdentityStatus() {
  const status = String(state.checkinLookupStatus || "idle");

  if (status === "loading") {
    return `<div class="message iza-message">Verificando seu e-mail no check-in...</div>`;
  }

  if (status === "matched") {
    const details = [
      state.municipio ? `Município: ${escapeHtml(state.municipio)}` : "",
      state.estadoUF ? `Estado: ${escapeHtml(state.estadoUF)}` : "",
      state.teacherGroup ? `Turma/oficina: ${escapeHtml(state.teacherGroup)}` : ""
    ].filter(Boolean);

    return `
      <div class="message iza-message">
        <strong>Cadastro confirmado.</strong><br>
        ${escapeHtml(state.name || "Participante")}<br>
        <span class="iza-copy iza-copy--soft">${escapeHtml(state.email)}</span>
        ${details.length ? `<div class="iza-copy iza-copy--soft">${details.join(" · ")}</div>` : ""}
      </div>
    `;
  }

  if (status === "unmatched") {
    return `
      <div class="message">
        Não encontrei esse e-mail no check-in. Nesta fase, o acesso ao IZA 0.2 está liberado apenas para e-mails já registrados.
      </div>
    `;
  }

  if (status === "ambiguous") {
    return `
      <div class="message">
        Encontrei mais de um cadastro com esse e-mail no check-in. Vale revisar esse registro antes de seguir.
      </div>
    `;
  }

  if (status === "error") {
    return `
      <div class="message">
        Não consegui consultar o check-in agora. ${escapeHtml(state.checkinLookupMessage || "Tente novamente em instantes.")}
      </div>
    `;
  }

  return `
    <div class="iza-copy iza-copy--soft">
      Digite o e-mail usado no check-in para liberar a jornada e trazer seu nome automaticamente.
    </div>
  `;
}

function updateWelcomeIdentityUI() {
  const identityNode = el("welcomeIdentity");
  if (identityNode) identityNode.innerHTML = renderWelcomeIdentityStatus();

  const verifyBtn = el("verifyCheckinBtn");
  if (verifyBtn) {
    verifyBtn.disabled = state.checkinLookupStatus === "loading" || !isValidEmail(el("userEmail")?.value || "");
    verifyBtn.textContent = state.checkinLookupStatus === "loading" ? "Verificando..." : "Verificar e-mail";
  }

  const startBtn = el("startJourneyBtn");
  if (startBtn) {
    startBtn.disabled = !(state.checkinLookupStatus === "matched" && state.name && state.participantId && state.checkinUserId);
  }
}

function requestCheckinIdentityViaJsonp(email) {
  return new Promise((resolve) => {
    const callbackName =
      "__izaCheckinCb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    const params = new URLSearchParams({
      action: "checkin_lookup",
      callback: callbackName,
      email: String(email || "").trim()
    });
    const script = document.createElement("script");
    const mountNode = document.body || document.head || document.documentElement;
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
      resolve(data || { ok: false, status: "error", error: "empty_response" });
    };

    script.onerror = () => {
      cleanup();
      resolve({ ok: false, status: "error", error: "network" });
    };

    timer = setTimeout(() => {
      cleanup();
      resolve({ ok: false, status: "error", error: "timeout" });
    }, 15000);

    script.src = `${WEBAPP_URL}?${params.toString()}`;
    mountNode.appendChild(script);
  });
}

function requestLiteraryGiftViaJsonp(requestData) {
  return new Promise((resolve) => {
    const callbackName =
      "__izaGiftCb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    const params = new URLSearchParams({
      action: "gift",
      callback: callbackName,
      keywords: (requestData.keywords || []).join("|"),
      summary: requestData.summary || "",
      seedText: requestData.seedText || "",
      journeyText: requestData.journeyText || "",
      trackKey: requestData.trackKey || "",
      presenceKey: requestData.presenceKey || ""
    });
    const src = `${WEBAPP_URL}?${params.toString()}`;

    if (src.length > 1900) {
      resolve({
        ok: false,
        error: "query_too_long",
        diagnostics: { transport: "jsonp", urlLength: src.length }
      });
      return;
    }

    const script = document.createElement("script");
    const mountNode = document.body || document.head || document.documentElement;
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
      resolve({ ok: false, error: "timeout", diagnostics: { transport: "jsonp" } });
    }, GIFT_LOOKUP_TIMEOUT_MS);

    script.src = src;
    script.async = true;
    script.onerror = () => {
      cleanup();
      resolve({ ok: false, error: "network", diagnostics: { transport: "jsonp" } });
    };

    if (!mountNode) {
      cleanup();
      resolve({ ok: false, error: "dom_unavailable", diagnostics: { transport: "jsonp" } });
      return;
    }

    mountNode.appendChild(script);
  });
}

async function requestLiteraryGift(payload) {
  const primaryRequest = buildGiftLookupRequestData(payload, false);

  if (canUseAppsScriptGiftLookup()) {
    const rpcResponse = await requestLiteraryGiftViaAppsScript(primaryRequest);
    if (rpcResponse?.ok !== false) {
      return {
        ...rpcResponse,
        diagnostics: {
          ...(rpcResponse?.diagnostics || {}),
          transport: "apps_script_rpc"
        }
      };
    }
  }

  let jsonpResponse = await requestLiteraryGiftViaJsonp(primaryRequest);
  if (jsonpResponse?.ok !== false) {
    return jsonpResponse;
  }

  if (["network", "timeout", "empty_response", "query_too_long", "dom_unavailable", "rpc_failure", "rpc_timeout"].includes(jsonpResponse?.error)) {
    const compactRequest = buildGiftLookupRequestData(payload, true);
    const compactResponse = await requestLiteraryGiftViaJsonp(compactRequest);
    if (compactResponse?.ok !== false) {
      return {
        ...compactResponse,
        diagnostics: {
          ...(compactResponse?.diagnostics || {}),
          retry: "compact_jsonp"
        }
      };
    }
    return compactResponse;
  }

  return jsonpResponse;
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
    return "Registro guardado. Se você informou um e-mail válido, a síntese e o presente literário seguem sendo enviados sem travar o encerramento.";
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

  const continuationHtml = payload.continuationInvitation
    ? `
      <div class="iza-gift iza-gift--continuation">
        <p class="iza-section-title"><strong>Para seguir escrevendo</strong></p>
        <div class="message">${escapeHtml(payload.continuationInvitation)}</div>
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
      ${continuationHtml}

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
        Seu percurso ficou guardado com síntese, constelação de palavras e um eco final da IZA para quando você quiser voltar.
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
    appVariant: APP_VARIANT,
    sessionId: state.sessionId,
    stage, // "init" | "choice" | "final"
    participantId: state.participantId || "",
    checkinUserId: state.checkinUserId || "",
    checkinMatchStatus: state.checkinMatchStatus || "",
    checkinMatchMethod: state.checkinMatchMethod || "",
    escritor: state.name,
    name: state.name,
    email: state.email,
    municipio: state.municipio,
    city: state.municipio,
    estado: state.estadoUF,
    stateUF: state.estadoUF,
    origem: state.origem,
    source: state.origem,
    teacherGroup: state.teacherGroup || "",
    cohort: state.teacherGroup || "",
    workshop: state.teacherGroup || "",

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
      mode: "no-cors", // Crucial for Google Apps Script tô avoid CORS errors
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    // In no-cors mode, the response is opaque, só we can't check r.ok
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
    centerSemanticTail: state.centerSemanticTail || "",
    journeySummary: finalPayload?.journeySynthesis || "",
    summary: finalPayload?.journeySynthesis || "",
    keywords: finalPayload?.keywords || [],
    keywordText: (finalPayload?.keywords || []).join(", "),
    escritos: finalPayload?.transcript || buildTranscript() + buildFinalDraftBlock(),
    transcript: finalPayload?.transcript || buildTranscript() + buildFinalDraftBlock(),
    turns: state.turns,
    journeyRubric: finalPayload?.rubric || null,
    doneChecklist: finalPayload?.doneChecklist || null
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
    // falhá externa não interrompe o encerramento
  });
}

// -------------------- TESTE + PRESENÇA --------------------
const testQuestions = [
  {
    title: "Pista 1",
    q: "Quando você escreve, o que ajuda a pensar melhor?",
    opts: [
      ["A", "Perguntas leves que me deixem pensar"],
      ["B", "Um tom próximo e acolhedor"],
      ["C", "Recorte claro do que importa"],
      ["D", "Pouquíssima interferência"]
    ]
  },
  {
    title: "Pista 2",
    q: "Quando o texto embaralha, o que te ajuda a reencontrar o fio?",
    opts: [
      ["A", "Uma pergunta aberta"],
      ["B", "Um convite para desenrolar"],
      ["C", "Um pedido direto de clareza"],
      ["D", "Silêncio e espaço"]
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
    q: "Hoje você escreve mais para:",
    opts: [
      ["A", "Explorar ideias"],
      ["B", "Expressar algo pessoal"],
      ["C", "Organizar pensamento"],
      ["D", "Só colocar no papel"]
    ]
  },
  {
    title: "Pista 5",
    q: "Como você quer sentir a presença da IZA?",
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
        Se quiser, escolha uma presença fixa. Ou responda ao teste rápido para compor uma IZA <strong>híbrida</strong>.
      </p>

      <div class="iza-actions iza-actions--compact">
        <button class="button" onclick="setPresenceFixed('A')">IZA Discreta</button>
        <button class="button" onclick="setPresenceFixed('B')">IZA Calorosa</button>
        <button class="button" onclick="setPresenceFixed('C')">IZA Firme</button>
        <button class="button" onclick="setPresenceFixed('D')">IZA Minimalista</button>
      </div>

      <hr class="iza-divider">

      <h3 class="iza-kicker">Teste rápido para compor a presença</h3>
      ${blocks}

      <div class="iza-actions">
        <button class="button" id="btnDone" disabled>Ver minha presença</button>
        <button class="button ritual" onclick="showWelcome()">Voltar ao início</button>
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
        <button class="button" onclick="startTrack('iniciante')">Seguir na trilha iniciante</button>
        <button class="button" onclick="startTrack('intermediaria')">Ir para a trilha intermediária</button>
        <button class="button" onclick="startTrack('inspirada')">Abrir a conversa livre</button>
      </div>

      <div class="iza-actions iza-actions--compact">
        <button class="button ritual" onclick="showPresenceTest()">Rever presença</button>
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
        IZA é uma ancestral de escrita: ela não escreve por você;
        ela faz perguntas para te ajudar a <strong>pensar, organizar e aprofundar</strong> o que seu texto ainda está pedindo.
      </p>

      <p class="iza-copy iza-copy--soft">
        Nesta fase, a entrada do IZA 0.2 está liberada apenas para e-mails já registrados no check-in.
      </p>

      <div id="welcomeError"></div>

      <input type="email" id="userEmail" class="input-area" placeholder="Seu e-mail" value="${escapeHtml(state.email)}">

      <div class="iza-actions iza-actions--compact">
        <button class="button" id="verifyCheckinBtn" onclick="verifyCheckinEmail()">Verificar e-mail</button>
      </div>

      <div id="welcomeIdentity"></div>

      <button class="button" id="startJourneyBtn" onclick="validateStart()" disabled>Começar jornada</button>

      ${renderHistoryNav("")}
    `)
  );

  const emailInput = document.getElementById("userEmail");
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      const typedEmail = emailInput.value.trim();
      if (normalizeEmail(typedEmail) !== normalizeEmail(state.email)) {
        clearResolvedCheckinIdentity(typedEmail);
        saveStateToLocal();
      }
      setWelcomeError("");
      updateWelcomeIdentityUI();
    });

    emailInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        verifyCheckinEmail();
      }
    });
  }

  mountFadeIn();
  bindHistoryNavHandlers();
  updateWelcomeIdentityUI();
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
  state.email = el("userEmail")?.value.trim() || "";

  if (!isValidEmail(state.email)) {
    setWelcomeError("Digite um e-mail válido para consultar o check-in.");
    updateWelcomeIdentityUI();
    return;
  }

  if (state.checkinLookupStatus !== "matched" || !state.name || !state.participantId || !state.checkinUserId) {
    setWelcomeError("Verifique um e-mail já registrado no check-in antes de começar.");
    updateWelcomeIdentityUI();
    return;
  }

  setWelcomeError("");
  safeRegisterInit();
  showPresenceTest();
};

window.verifyCheckinEmail = async function () {
  const typedEmail = el("userEmail")?.value.trim() || "";

  if (!isValidEmail(typedEmail)) {
    setWelcomeError("Digite um e-mail válido para consultar o check-in.");
    clearResolvedCheckinIdentity(typedEmail);
    updateWelcomeIdentityUI();
    return;
  }

  clearResolvedCheckinIdentity(typedEmail);
  state.checkinLookupStatus = "loading";
  state.checkinLookupMessage = "";
  setWelcomeError("");
  updateWelcomeIdentityUI();

  const response = await requestCheckinIdentityViaJsonp(typedEmail);

  if (response?.ok && response?.status === "matched") {
    applyResolvedCheckinIdentity(response);
    saveStateToLocal();
    updateWelcomeIdentityUI();
    const startBtn = el("startJourneyBtn");
    if (startBtn) startBtn.focus();
    return;
  }

  clearResolvedCheckinIdentity(typedEmail);
  state.checkinLookupStatus =
    response?.status === "ambiguous"
      ? "ambiguous"
      : response?.status === "unmatched"
        ? "unmatched"
        : "error";
  state.checkinLookupMessage = String(response?.error || "");
  saveStateToLocal();
  updateWelcomeIdentityUI();
};

function buildFallbackLiteraryGift(payloadOrKeywords) {
  const payload = Array.isArray(payloadOrKeywords)
    ? { keywords: payloadOrKeywords }
    : (payloadOrKeywords || {});
  const keywords = payload.keywords || [];
  const seed = keywords[0] || "palavra";
  const companion = keywords[1] || "eco";
  const sceneAnchor = clipText(payload.sceneAnchor || resolveConcreteSceneAnchorText(), 110);
  const finalAnchor = clipText(payload.lastText || resolveFinalAnchorText(), 110);
  let fragment = `Guarde ${seed}. Quando a trilha parece terminar, ela ainda conversa com ${companion}. O que ficou vivo aqui talvez seja o começo de outra frase.`;

  if (sceneAnchor && finalAnchor && sceneAnchor !== finalAnchor) {
    fragment = `Guarde esta imagem: "${sceneAnchor}". E guarde também esta linha: "${finalAnchor}". Entre ${seed} e ${companion}, ainda há uma frase pedindo continuidade.`;
  } else if (sceneAnchor) {
    fragment = `Guarde esta imagem: "${sceneAnchor}". Entre ${seed} e ${companion}, ela ainda pede outra frase.`;
  } else if (finalAnchor) {
    fragment = `Guarde esta linha: "${finalAnchor}". Entre ${seed} e ${companion}, ela ainda pede outra frase.`;
  }

  return {
    source: "fallback",
    seed,
    intro: "As suas palavras ficaram acesas aqui. A biblioteca não me abriu um verso com nome, mas alguma ressonância continuou viva.",
    fragment,
    author: "IZA",
    title: "Eco que ficou",
    matchedKeywords: [seed, companion].filter(Boolean)
  };
}

function buildFinalRecordTranscript(payload) {
  const parts = [payload.baseTranscript || buildTranscript() + buildFinalDraftBlock()];

  if (payload.journeySynthesis) {
    parts.push(`\n---\nSINTESE DA JORNADA:\n${payload.journeySynthesis}\n`);
  }

  if (payload.keywords?.length) {
    parts.push(`\nPALAVRAS-CHAVE:\n${payload.keywords.join(", ")}\n`);
  }

  if (payload.keywordCloud?.length) {
    parts.push(`\nCONSTELACAO DE PALAVRAS:\n${payload.keywordCloud.slice(0, 12).map((item) => item.text).join(" | ")}\n`);
  }

  if (payload.continuationInvitation) {
    parts.push(`\nCHAMADO PARA CONTINUAR:\n${payload.continuationInvitation}\n`);
  }

  if (payload.literaryGift?.fragment) {
    const searchInvitation = buildGiftSearchInvitation(payload.literaryGift);
    parts.push(
      `\nRESSONÂNCIA POÉTICA:\n${payload.literaryGift.intro ? payload.literaryGift.intro + "\n\n" : ""}${payload.literaryGift.fragment}\n` +
      `${searchInvitation ? searchInvitation + "\n" : ""}` +
      `Referencia: ${payload.literaryGift.author || "IZA"}${payload.literaryGift.title ? " - " + payload.literaryGift.title : ""}\n`
    );
  }

  return parts.join("");
}

// init
document.addEventListener("DOMContentLoaded", () => {
  ensureBaseStyles();
  if (!loadAndResumeSession()) {
    showWelcome();
  }
});
