// ==========================================
// IZA no Cordel 2.0 — app.js
// (com Enquete + Perfil HÍBRIDO + Motor ELIZA-like)
// ==========================================

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbx2CDkA7TVIFNu8dsnMgEg2_WjYq8-Yntu_NoV89UE8rVdioFJZbT6cjbGCDNP7brrk/exec";

const MIN_INSPIRED_ROUNDS = 7;

// -------------------- STATE --------------------
const state = {
  name: "",
  email: "",
  presenceKey: null, // "H" (híbrida) ou "A"/"B"/"C"/"D"
  presence: null, // objeto de presença ativo (pode ser híbrido)
  presenceMix: null, // {A:0.2,B:0.6,C:0.2,D:0} (se híbrido)
  trackKey: null,
  stepIndex: 0,
  inspiredRounds: 0,
  sent: false,
  sessionId: null,
  startedAtISO: null,
  pageURL: "",
  lastIzaText: "",
  turns: []
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

// -------------------- BASE PRESENCES --------------------
const PRESENCES = {
  A: {
    key: "A",
    name: "IZA Discreta",
    vibe: "leve",
    mirror: "short", // tiny|short|medium
    maxQuestions: 1,
    directiveLevel: 0,
    softeners: ["", "Se fizer sentido,", "Talvez,", "Ok,"],
    closings: ["", "Pode seguir.", "Quando quiser, continue."]
  },
  B: {
    key: "B",
    name: "IZA Calorosa",
    vibe: "acolhedora",
    mirror: "short",
    maxQuestions: 1,
    directiveLevel: 1,
    softeners: ["Entendi.", "Tô com você.", "Certo.", "Obrigado por dizer isso."],
    closings: ["Se quiser, a gente ajusta.", "Pode seguir.", "Estou aqui com você."]
  },
  C: {
    key: "C",
    name: "IZA Firme",
    vibe: "direta",
    mirror: "medium",
    maxQuestions: 2,
    directiveLevel: 2,
    softeners: ["Vamos focar.", "Certo.", "Ok. Vamos organizar."],
    closings: ["Responda direto.", "Vamos para a próxima.", "Siga com clareza."]
  },
  D: {
    key: "D",
    name: "IZA Minimalista",
    vibe: "quase ausente",
    mirror: "tiny",
    maxQuestions: 1,
    directiveLevel: 0,
    softeners: [""],
    closings: ["Continue.", "Siga.", ""]
  }
};

// Mensagem de presença (inclui híbrida)
function presenceMessage(p) {
  if (!p) return "";
  if (p.key === "H") {
    const mix = state.presenceMix || {};
    const parts = Object.entries(mix)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
      .join(" · ");
    return `Hoje sua IZA vai ser híbrida (${parts}). Um equilíbrio entre acolhimento, estrutura e silêncio — conforme seu jeito de escrever.`;
  }
  const base = {
    A: "Vou te acompanhar de forma leve, com poucas interferências.",
    B: "Vou te acompanhar com proximidade e acolhimento, sem te tirar do seu texto.",
    C: "Vou te acompanhar com estrutura e direção clara para organizar suas ideias.",
    D: "Vou ficar quase invisível: pouco ruído e mais espaço pra você escrever."
  };
  return (base[p.key] || "") + " Podemos ajustar isso quando quiser.";
}

// -------------------- HYBRID PRESENCE BUILDER --------------------
function normalizeMix(counts) {
  const sum = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const k of ["A", "B", "C", "D"]) out[k] = (counts[k] || 0) / sum;
  return out;
}

function weightedPick(listA, listB, listC, listD, mix) {
  // cria um “pool” proporcional sem ficar enorme
  const pool = [];
  const add = (arr, w) => {
    const n = Math.max(0, Math.round(w * 10));
    for (let i = 0; i < n; i++) pool.push(...arr);
  };
  add(listA || [], mix.A || 0);
  add(listB || [], mix.B || 0);
  add(listC || [], mix.C || 0);
  add(listD || [], mix.D || 0);
  if (pool.length === 0) return "";
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildHybridPresence(mix) {
  // Escolhe mirror e maxQuestions por “votação ponderada”
  const mirror =
    (mix.C || 0) >= 0.35 ? "medium" : (mix.D || 0) >= 0.35 ? "tiny" : "short";

  const maxQuestions = (mix.C || 0) >= 0.35 ? 2 : 1;

  const directiveLevel =
    (mix.C || 0) >= 0.45 ? 2 : (mix.B || 0) >= 0.35 ? 1 : 0;

  const softeners = [
    ...PRESENCES.A.softeners,
    ...PRESENCES.B.softeners,
    ...PRESENCES.C.softeners
  ];

  const closings = [
    ...PRESENCES.A.closings,
    ...PRESENCES.B.closings,
    ...PRESENCES.C.closings,
    ...PRESENCES.D.closings
  ];

  return {
    key: "H",
    name: "IZA Híbrida",
    vibe: "adaptativa",
    mirror,
    maxQuestions,
    directiveLevel,
    // pools (a seleção final é ponderada dentro do wrapper)
    softeners,
    closings
  };
}

function presenceWrap(p, coreText) {
  // híbrida usa mix para escolher suavizador/fechamento de forma ponderada
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
    soft = (p.softeners || [""])[Math.floor(Math.random() * (p.softeners || [""]).length)];
    close = (p.closings || [""])[Math.floor(Math.random() * (p.closings || [""]).length)];
  }

  if ((p.key === "D") || ((p.key === "H") && (state.presenceMix?.D || 0) > 0.55)) {
    // mais minimalista: quase sem wrapper
    return coreText.trim();
  }

  const prefix = soft ? soft + " " : "";
  const suffix = close ? "\n" + close : "";
  return (prefix + coreText + suffix).trim();
}

// -------------------- ELIZA ENGINE --------------------
const IZA_ENGINE = {
  memory: [],
  usedRecently: []
};

// pronome swap seguro (evita troca dupla)
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

function pick(arr) {
  if (!arr || arr.length === 0) return "";
  for (let tries = 0; tries < 6; tries++) {
    const candidate = arr[Math.floor(Math.random() * arr.length)];
    if (!IZA_ENGINE.usedRecently.includes(candidate)) {
      IZA_ENGINE.usedRecently.push(candidate);
      if (IZA_ENGINE.usedRecently.length > 6) IZA_ENGINE.usedRecently.shift();
      return candidate;
    }
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

function shortMirror(presence, userText) {
  const t = (userText || "").trim();
  if (!t) return presence.key === "D" ? "Continue." : "Pode seguir.";
  const words = t.split(/\s+/);

  if (presence.mirror === "tiny") {
    const w = words.slice(0, 6).join(" ");
    return `“${swapPronouns(w)}…”`;
  }
  if (presence.mirror === "short") {
    const w = words.slice(0, 10).join(" ");
    return `Você está dizendo: “${swapPronouns(w)}…”.`;
  }
  const w = words.slice(0, 16).join(" ");
  return `Você parece estar dizendo: “${swapPronouns(w)}…”.`;
}

function applyReasmb(template, match) {
  let out = template;
  for (let i = 1; i < match.length; i++) {
    const chunk = swapPronouns((match[i] || "").trim());
    out = out.replaceAll(`{${i}}`, chunk);
  }
  return out;
}

// -------------------- IZA_SCRIPT (12 regras + fallback) --------------------
const IZA_SCRIPT = [
  // 1) AÇÕES
  {
    key: /\b(fazer|fiz|tentei|criei|escrevi|busco|quero)\b/i,
    decomps: [
      {
        re: /.*\b(?:fiz|tentei|criei|escrevi|busco|quero)\b\s+(.*)$/i,
        reasmb: [
          "O que motivou esse seu agir sobre “{1}”?",
          "Ao buscar “{1}”, qual imagem surgiu primeiro?",
          "Como essa ação — “{1}” — pode virar forma (verso, cena, confissão)?"
        ],
        memory: [
          "Voltando em “{1}”: qual foi o primeiro passo concreto?",
          "O que você ganhou — e o que você arriscou — ao fazer “{1}”?"
        ]
      }
    ]
  },

  // 2) ESTADOS
  {
    key: /\b(triste|feliz|difícil|confuso|importante|belo|feio)\b/i,
    decomps: [
      {
        re: /.*\b(triste|feliz|difícil|confuso|importante|belo|feio)\b(?:\s+(?:porque|pois)\s+)?(.*)$/i,
        reasmb: [
          "O que torna “{2}” algo tão “{1}”?",
          "Se “{2}” deixasse de ser “{1}”, o que sobraria?",
          "Como esse estado de ser “{1}” aparece na sua escrita — em imagem ou ritmo?"
        ],
        memory: [
          "Dá um exemplo pequeno que mostre “{1}” sem explicar.",
          "Qual palavra substituiria “{1}” sem perder a verdade?"
        ]
      }
    ]
  },

  // 3) TEMAS
  {
    key: /\b(família|casa|trabalho|rua|mundo|tempo|vida)\b/i,
    decomps: [
      {
        re: /.*\b(família|casa|trabalho|rua|mundo|tempo|vida)\b(.*)$/i,
        reasmb: [
          "Qual detalhe concreto de “{1}” você quer salvar no texto?",
          "Como “{1}” muda o ritmo do que você escreve?",
          "O que em “{1}” ainda está guardado e não foi dito?"
        ],
        memory: ["Volta em “{1}”: onde exatamente isso acontece (lugar/horário/pessoa)?"]
      }
    ]
  },

  // 4) AFETOS
  {
    key: /\b(sinto|sentir|sentimento|dor|alegria)\b/i,
    decomps: [
      {
        re: /.*\b(?:sinto|sentir)\b\s+(.*)$/i,
        reasmb: [
          "Onde esse sentir — “{1}” — se localiza na sua história?",
          "Essa emoção sobre “{1}” ajuda ou trava sua autoria?",
          "Consegue descrever “{1}” sem usar o nome do sentimento?"
        ],
        memory: ["Qual imagem carregaria “{1}” sem dizer o nome dela?"]
      }
    ]
  },

  // 5) IMPEDIMENTOS
  {
    key: /\b(não posso|não consigo|limite|bloqueio)\b/i,
    decomps: [
      {
        re: /.*\b(?:não consigo|não posso)\b\s+(.*)$/i,
        reasmb: [
          "Esse limite em “{1}” é uma barreira real — ou uma precaução sua?",
          "O que mudaria no texto se você pudesse “{1}”?",
          "Vamos olhar o outro lado de “{1}”: o que é possível hoje, do jeito mínimo?"
        ],
        memory: ["Se fosse só 1% possível, como seria “{1}”?"]
      }
    ]
  },

  // 6) GENERALIZAÇÕES
  {
    key: /\b(sempre|nunca|todo|ninguém|todos)\b/i,
    decomps: [
      {
        re: /.*\b(sempre|nunca|ninguém|todos)\b(.*)$/i,
        reasmb: [
          "O que faz “{1}” soar tão absoluto pra você aqui?",
          "Pensa numa exceção para “{1}{2}”. Como ela soaria?",
          "Onde esse “{1}” aparece hoje, agora, de modo concreto?"
        ],
        memory: ["Qual exceção pequena te faria respirar um pouco?"]
      }
    ]
  },

  // 7) INCERTEZA
  {
    key: /\b(talvez|acho|parece|quem sabe)\b/i,
    decomps: [
      {
        re: /.*\b(?:talvez|acho|parece|quem sabe)\b\s+(.*)$/i,
        reasmb: [
          "Se você tivesse certeza sobre “{1}”, o texto seria o mesmo?",
          "O que sustenta essa dúvida sobre “{1}”?",
          "A incerteza sobre “{1}” pode virar lugar de criação?"
        ],
        memory: ["Qual parte de “{1}” você mais quer testar em palavras?"]
      }
    ]
  },

  // 8) SOBRE A IZA
  {
    key: /\b(você|iza|máquina|computador)\b/i,
    decomps: [
      {
        re: /.*\b(?:você|iza|máquina|computador)\b\s*(.*)$/i,
        reasmb: [
          "Eu estou aqui para espelhar seu pensamento. O que “{1}” revela sobre você?",
          "O que muda no seu texto quando você me usa como espelho?",
          "Como eu posso te ajudar a deixar “{1}” mais claro em 1 frase?"
        ],
        memory: ["Você quer mais silêncio ou mais perguntas agora?"]
      }
    ]
  },

  // 9) EXPLICAÇÃO
  {
    key: /\b(porque|pois|por causa)\b/i,
    decomps: [
      {
        re: /.*\b(?:porque|pois|por causa(?:\s+de)?)\b\s+(.*)$/i,
        reasmb: [
          "Essa razão — “{1}” — é a única possível?",
          "Se não fosse por “{1}”, que outra causa existiria?",
          "Como essa explicação muda sua voz no papel?"
        ],
        memory: ["Você prefere explicar “{1}” ou mostrar em cena?"]
      }
    ]
  },

  // 10) PROJEÇÃO
  {
    key: /\b(sonho|desejo|imagino|futuro)\b/i,
    decomps: [
      {
        re: /.*\b(?:sonho|desejo|imagino)\b\s+(.*)$/i,
        reasmb: [
          "Qual é a cor, som ou textura desse “{1}”?",
          "Como “{1}” projeta quem você é hoje?",
          "O que “{1}” traz de novo para sua escrita?"
        ],
        memory: ["Qual micro-ação hoje aproxima “{1}”?"]
      }
    ]
  },

  // 11) TENSÃO
  {
    key: /\b(atrito|luta|conflito|problema)\b/i,
    decomps: [
      {
        re: /.*\b(?:atrito|luta|conflito|problema)\b\s*(.*)$/i,
        reasmb: [
          "Qual é o coração desse “{1}”?",
          "Esse conflito em “{1}” gera movimento ou estagnação?",
          "O que está em risco quando você encara “{1}”?"
        ],
        memory: ["Qual é o ponto de virada dentro de “{1}”?"]
      }
    ]
  },

  // 12) FALLBACK
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

function izaReply(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t) return p.key === "D" ? "Continue." : "Pode seguir.";

  // chance de usar memória (híbrida puxa mais memória se tiver B/C no mix)
  const mix = state.presenceMix || { A: 1, B: 0, C: 0, D: 0 };
  const memChance = Math.min(
    0.45,
    0.15 + 0.25 * (mix.B || 0) + 0.25 * (mix.C || 0) - 0.10 * (mix.D || 0)
  );

  if (IZA_ENGINE.memory.length > 0 && Math.random() < memChance) {
    const mirror = shortMirror(p, t);
    const mem = IZA_ENGINE.memory.shift();
    return presenceWrap(p, [mirror, mem].filter(Boolean).join("\n"));
  }

  for (const rule of IZA_SCRIPT) {
    if (!rule.key.test(t)) continue;

    for (const d of rule.decomps) {
      const m = t.match(d.re);
      if (!m) continue;

      const mirror = shortMirror(p, t);

      const q1 = pick(d.reasmb);
      let qText = applyReasmb(q1, m);

      // pergunta extra ocasional: depende do “C” na mistura (ou presença firme)
      const extraChance =
        p.maxQuestions >= 2 ? 0.20 + 0.40 * (mix.C || 0) : 0.0;

      if (p.maxQuestions >= 2 && Math.random() < extraChance) {
        const pool = d.reasmb.length > 1 ? d.reasmb.filter((x) => x !== q1) : [];
        const q2 = pick(pool.length ? pool : IZA_SCRIPT[IZA_SCRIPT.length - 1].decomps[0].reasmb);
        qText += "\n" + applyReasmb(q2, m);
      }

      // memória
      if (d.memory && d.memory.length) {
        IZA_ENGINE.memory.push(applyReasmb(pick(d.memory), m));
        if (IZA_ENGINE.memory.length > 8) IZA_ENGINE.memory.shift();
      }

      // minimalismo ocasional: se D alto no mix, às vezes sem “espelho”
      const minimalistNow = (mix.D || 0) > 0.45 && Math.random() < (mix.D || 0);

      const core = minimalistNow ? qText : [mirror, qText].join("\n");
      return presenceWrap(p, core);
    }
  }

  return presenceWrap(p, "Pode continuar.");
}

// -------------------- TRACKS --------------------
const TRACKS = {
  iniciante: {
    name: "Trilha Iniciante (4 etapas)",
    steps: [
      {
        key: "nucleo",
        prompt: "Etapa 1 — Núcleo\nEscreva livremente sobre seu tema.",
        onUser: (t) => izaReply(t) + "\n\nEm 1 frase: qual é o centro da sua ideia?"
      },
      {
        key: "centro",
        prompt: "Qual é o centro da sua ideia (1 frase)?",
        onUser: (t) => {
          const p = state.presence || PRESENCES.A;
          const frag = t.split(/\s+/).slice(0, 8).join(" ");
          const conf =
            p.key === "C"
              ? `Você definiu: “${swapPronouns(frag)}...”. Isso é o centro? (s/n)`
              : p.key === "B"
              ? `Ao ler “${swapPronouns(frag)}...”, sinto que você tocou no essencial. Seguimos por aí? (s/n)`
              : p.key === "D"
              ? `“${swapPronouns(frag)}...” (s/n)`
              : `“${swapPronouns(frag)}...”. Podemos seguir por aqui? (s/n)`;
          return conf;
        }
      },
      {
        key: "confirmacao",
        prompt: "Podemos seguir por aí? (s/n)",
        onUser: (t) => {
          const ans = (t || "").trim().toLowerCase();
          if (ans.startsWith("n")) {
            state.stepIndex = 0;
            return "Tudo bem. Reescreva o Núcleo de novo: o que você quer dizer, bem simples?";
          }
          return "Etapa 2 — Atrito\nO que está em jogo aqui (conflito, desejo, risco, dúvida)?";
        }
      },
      {
        key: "atrito",
        prompt: "Etapa 2 — Atrito\nO que está em jogo aqui?",
        onUser: (t) => izaReply(t) + "\n\nEtapa 3 — Cena\nTraga uma cena concreta (lugar + alguém + um gesto)."
      },
      {
        key: "cena",
        prompt: "Etapa 3 — Cena\nTraga uma cena concreta (lugar + alguém + um gesto).",
        onUser: (t) => izaReply(t) + "\n\nEtapa 4 — Frase que fica\nEscreva o verso/frase que não pode faltar."
      },
      {
        key: "frase_final",
        prompt: "Etapa 4 — Frase que fica\nEscreva o verso/frase que não pode faltar.",
        onUser: (t) => izaReply(t) + "\n\nQuer ajustar (a) ou encerrar e salvar (e)?"
      },
      {
        key: "fim",
        prompt: "Ajustar (a) ou Encerrar (e)?",
        onUser: (t) => {
          const ans = (t || "").trim().toLowerCase();
          if (ans.startsWith("a")) {
            state.stepIndex = 0;
            state.turns = [];
            return "Ok. Vamos ajustar.\n\nEtapa 1 — Núcleo\nEscreva livremente sobre seu tema.";
          }
          finish();
          return "Encerrando e salvando seu registro…";
        },
        endScreen: true
      }
    ]
  }
};

// -------------------- FLOW --------------------
function startTrack(key) {
  state.trackKey = key;
  state.stepIndex = 0;
  state.inspiredRounds = 0;
  state.turns = [];
  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];
  showStep();
}

function showStep() {
  if (state.trackKey === "inspirada") return showInspiredTurn(true);

  const track = TRACKS[state.trackKey];
  const step = track.steps[state.stepIndex];

  showPrompt(track.name, step.prompt, (text) => {
    pushTurn("user", text);
    const reply = step.onUser(text);
    pushTurn("iza", reply);

    showIza(reply, () => {
      if (step.endScreen) return;
      state.stepIndex++;
      showStep();
    });
  });
}

function showInspiredTurn(isFirst = false) {
  const p = state.presence || PRESENCES.A;

  if (!isFirst && state.inspiredRounds >= MIN_INSPIRED_ROUNDS) {
    render(`
      <div class="card">
        <h2>IZA</h2>
        <div class="message">Quer encerrar e salvar ou seguir no fluxo?</div>
        <button class="button" onclick="finish()">Encerrar e salvar</button>
        <button class="button" onclick="startTrack('inspirada')">Seguir</button>
      </div>
    `);
    return;
  }

  const prompt = isFirst ? "Sobre o que você quer escrever hoje?" : (p.key === "D" ? "Continue." : "Escreva mais um pouco.");
  showPrompt("Trilha Inspirada (conversa aberta)", prompt, (text) => {
    pushTurn("user", text, { round: state.inspiredRounds + 1 });
    const reply = izaReply(text);
    pushTurn("iza", reply, { round: state.inspiredRounds + 1 });
    state.inspiredRounds++;

    showIza(reply, () => showInspiredTurn(false));
  });
}

function showPrompt(title, question, cb) {
  render(`
    <div class="card">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(question).replace(/\n/g, "<br>")}</p>
      <textarea id="txt" class="input-area" rows="5"></textarea>
      <button id="btn" class="button">Enviar</button>
    </div>
  `);
  el("btn").onclick = () => cb(el("txt").value.trim());
}

function showIza(text, next) {
  render(`
    <div class="card">
      <h2>IZA</h2>
      <div class="message">${escapeHtml(text).replace(/\n/g, "<br>")}</div>
      <button class="button" onclick="izaNext()">Continuar</button>
    </div>
  `);
  window.izaNext = next;
}

// -------------------- REGISTER --------------------
async function safeRegister() {
  if (state.sent) return;
  state.sent = true;

  const payload = {
    sessionId: state.sessionId,
    startedAtISO: state.startedAtISO,
    endedAtISO: nowISO(),
    page: state.pageURL,
    name: state.name,
    email: state.email,
    presenceKey: state.presenceKey,
    presenceName: state.presence?.name || "",
    presenceMix: state.presenceMix || null,
    trackKey: state.trackKey,
    turns: state.turns
  };

  try {
    await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Falha ao enviar registro:", e);
  }
}

function finish() {
  safeRegister();
  render(`
    <div class="card">
      <h2>Fim do Percurso</h2>
      <p>Registro enviado para <strong>${escapeHtml(state.email)}</strong>.</p>
      <button class="button" onclick="location.reload()">Novo Texto</button>
    </div>
  `);
}

// -------------------- ENQUETE + PERFIL HÍBRIDO --------------------
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

function showPresenceTest() {
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

  render(`
    <div class="card">
      <h2>Teste rápido de presença da IZA</h2>
      <p style="opacity:.85">
        Responda 5 perguntas. A IZA vai virar um perfil <strong>híbrido</strong> (mistura do seu estilo).
      </p>

      ${blocks}

      <button class="button" id="btnDone" disabled>Concluir</button>
      <button class="button" style="background:#a0896a;margin-top:10px;" onclick="showWelcome()">Voltar</button>
    </div>
  `);

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

    // cria presença híbrida
    state.presenceKey = "H";
    state.presenceMix = mix;
    state.presence = buildHybridPresence(mix);

    showPresenceResult();
  };
}

function showPresenceResult() {
  const p = state.presence || PRESENCES.A;

  render(`
    <div class="card">
      <h2>${escapeHtml(p.name)}</h2>
      <div class="message">${escapeHtml(presenceMessage(p))}</div>

      <p><strong>Escolha uma trilha:</strong></p>
      <button class="button" onclick="startTrack('iniciante')">Trilha Iniciante (4 etapas)</button>
      <button class="button" onclick="startTrack('inspirada')">Trilha Inspirada (conversa aberta)</button>

      <br>
      <button class="button" style="background:#a0896a;margin-top:10px;" onclick="showPresenceTest()">Refazer teste</button>
    </div>
  `);
}

// -------------------- WELCOME --------------------
function showWelcome() {
  state.sessionId = newSessionId();
  state.startedAtISO = nowISO();
  state.pageURL = window.location.href;

  state.presenceKey = null;
  state.presence = null;
  state.presenceMix = null;
  state.trackKey = null;
  state.stepIndex = 0;
  state.inspiredRounds = 0;
  state.sent = false;
  state.lastIzaText = "";
  state.turns = [];
  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];

  render(`
    <div class="card">
      <h2>IZA no Cordel 2.0</h2>

      <p>
        IZA é uma “ancestral” de escrita: ela não escreve por você —
        ela te ajuda a <strong>pensar, organizar e aprofundar</strong> o que você já está tentando dizer.
      </p>

      <p>
        Você pode seguir uma trilha curta (rascunho → centro → atrito → cena → frase que fica)
        ou entrar numa conversa aberta no modo inspirado.
      </p>

      <p style="opacity:.85">
        Antes de começar, vamos ajustar a presença da IZA com um teste rápido (ela pode ficar mais acolhedora,
        mais firme, mais discreta ou quase silenciosa — e também pode virar um perfil híbrido).
      </p>

      <input type="text" id="userName" class="input-area" placeholder="Seu nome">
      <input type="email" id="userEmail" class="input-area" placeholder="Seu e-mail">

      <button class="button" onclick="validateStart()">Começar</button>
    </div>
  `);
}

window.validateStart = function () {
  state.name = el("userName").value.trim();
  state.email = el("userEmail").value.trim();
  if (!state.name || !state.email) return;
  showPresenceTest();
};

// init
document.addEventListener("DOMContentLoaded", showWelcome);
