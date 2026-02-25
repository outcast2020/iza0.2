// ==========================================
// IZA no Cordel 2.0 — app.js
// 3 trilhas + 4 presenças + híbrido (enquete)
// Confirmação com "Opção A" (A/B/C/D) em todas as trilhas
// Motor ELIZA-like (12 regras) + registro Apps Script
// ==========================================

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbx2CDkA7TVIFNu8dsnMgEg2_WjYq8-Yntu_NoV89UE8rVdioFJZbT6cjbGCDNP7brrk/exec";

const MIN_INSPIRED_ROUNDS = 7;

// -------------------- STATE --------------------
const state = {
  name: "",
  email: "",
  presenceKey: null, // "A"|"B"|"C"|"D"|"H"
  presence: null, // objeto de presença
  presenceMix: null, // {A:0.2,B:0.6,C:0.2,D:0}
  trackKey: null, // "iniciante"|"intermediaria"|"inspirada"
  stepIndex: 0,
  inspiredRounds: 0,
  sent: false,
  sessionId: null,
  startedAtISO: null,
  pageURL: "",
  lastIzaText: "",
  turns: [],
  // memoriza a classificação do "centro" em cada trilha
  centerType: null // "pergunta"|"afirmacao"|"ferida"|"desejo"|"livre"
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

// -------------------- PRESENCES --------------------
const PRESENCES = {
  A: {
    key: "A",
    name: "IZA Discreta",
    vibe: "leve",
    mirror: "short",
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
    softeners,
    closings
  };
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

function pick(arr) {
  if (!arr || !arr.length) return "";
  for (let tries = 0; tries < 6; tries++) {
    const cand = arr[Math.floor(Math.random() * arr.length)];
    if (!IZA_ENGINE.usedRecently.includes(cand)) {
      IZA_ENGINE.usedRecently.push(cand);
      if (IZA_ENGINE.usedRecently.length > 6) IZA_ENGINE.usedRecently.shift();
      return cand;
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

// -------------------- 12 RULES --------------------
const IZA_SCRIPT = [
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

  const mix = state.presenceMix || { A: p.key === "A" ? 1 : 0, B: p.key === "B" ? 1 : 0, C: p.key === "C" ? 1 : 0, D: p.key === "D" ? 1 : 0 };
  const memChance = Math.min(
    0.45,
    0.12 + 0.22 * (mix.B || 0) + 0.22 * (mix.C || 0) - 0.08 * (mix.D || 0)
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

      const minimalistNow = (mix.D || 0) > 0.50 && Math.random() < (mix.D || 0);
      const core = minimalistNow ? qText : [mirror, qText].join("\n");
      return presenceWrap(p, core);
    }
  }

  return presenceWrap(p, "Pode continuar.");
}

// -------------------- "OPÇÃO A" (A/B/C/D) PARA CONFIRMAR O CENTRO --------------------
function centerChoicePrompt(fragment) {
  const p = state.presence || PRESENCES.A;
  const frag = swapPronouns((fragment || "").trim());

  // quatro variações por presença (mantém graça/voz)
  if (p.key === "D") {
    return `“${frag}…”\nA) pergunta  B) afirmação  C) ferida  D) desejo\n(A/B/C/D ou escreva do seu jeito)`;
  }
  if (p.key === "C") {
    return `Você disse: “${frag}…”. Classifique o núcleo:\nA) pergunta\nB) afirmação\nC) ferida\nD) desejo\nResponda A/B/C/D (ou escreva do seu jeito).`;
  }
  if (p.key === "B") {
    return `Ao ler “${frag}…”, eu sinto um núcleo aí.\nIsso está mais perto de:\nA) uma pergunta\nB) uma afirmação\nC) uma ferida\nD) um desejo\nResponda A/B/C/D (ou escreva do seu jeito).`;
  }
  // A (discreta)
  return `Quando você diz “${frag}…”, isso está mais perto de:\nA) uma pergunta\nB) uma afirmação\nC) uma ferida\nD) um desejo\nResponda A/B/C/D (ou escreva do seu jeito).`;
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
        onUser: (t) => {
          // responde no estilo ELIZA + pede centro
          return izaReply(t) + "\n\nAgora, em 1 frase: qual é o centro disso?";
        }
      },
      {
        key: "centro",
        prompt: "Em 1 frase: qual é o centro disso?",
        onUser: (t) => {
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          // pede classificação (Opção A)
          return centerChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "A/B/C/D (ou escreva do seu jeito)",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;

          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D"
              ? `Ok: ${parsed.label}.`
              : p.key === "C"
              ? `Registrado: ${parsed.label}.`
              : p.key === "B"
              ? `Certo — vamos tratar o centro como ${parsed.label}.`
              : `Ok — vamos tratar o centro como ${parsed.label}.`;

          return `${lead}\n\nEtapa 2 — Atrito\nO que está em jogo aqui (conflito, dúvida, desejo, risco)?`;
        }
      },
      {
        key: "atrito",
        prompt: "Etapa 2 — Atrito\nO que está em jogo aqui?",
        onUser: (t) => {
          const hint =
            state.centerType === "pergunta"
              ? "Qual parte da pergunta dói mais?"
              : state.centerType === "afirmacao"
              ? "O que ameaça essa afirmação?"
              : state.centerType === "ferida"
              ? "O que encosta nessa ferida?"
              : state.centerType === "desejo"
              ? "O que atrapalha esse desejo?"
              : "Qual é a tensão aqui?";

          return izaReply(t) + `\n\nEtapa 3 — Cena\nTraga uma cena concreta (lugar + alguém + um gesto). (${hint})`;
        }
      },
      {
        key: "cena",
        prompt: "Etapa 3 — Cena\nTraga uma cena concreta (lugar + alguém + um gesto).",
        onUser: (t) => {
          return izaReply(t) + "\n\nEtapa 4 — Frase que fica\nEscreva o verso/frase que não pode faltar.";
        }
      },
      {
        key: "frase_final",
        prompt: "Etapa 4 — Frase que fica\nEscreva o verso/frase que não pode faltar.",
        onUser: (t) => {
          return izaReply(t) + "\n\nQuer ajustar (a) ou encerrar e salvar (e)?";
        }
      },
      {
        key: "fim",
        prompt: "Ajustar (a) ou Encerrar (e)?",
        onUser: (t) => {
          const ans = (t || "").trim().toLowerCase();
          if (ans.startsWith("a")) {
            state.stepIndex = 0;
            state.turns = [];
            state.centerType = null;
            return "Ok. Vamos ajustar.\n\nEtapa 1 — Núcleo\nEscreva livremente sobre seu tema.";
          }
          finish();
          return "Encerrando e salvando seu registro…";
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
        onUser: (t) => {
          return izaReply(t) + "\n\nEtapa 2 — Pergunta-motriz\nQue pergunta move esse texto?";
        }
      },
      {
        key: "pergunta_motriz",
        prompt: "Etapa 2 — Pergunta-motriz\nQue pergunta move esse texto?",
        onUser: (t) => {
          // aqui usamos o "Opção A" para classificar a MOTRIZ (centro conceitual)
          state.centerType = null;
          const frag = t.split(/\s+/).slice(0, 14).join(" ");
          return centerChoicePrompt(frag);
        }
      },
      {
        key: "tipo_centro",
        prompt: "A/B/C/D (ou escreva do seu jeito)",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;

          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D"
              ? `Ok: ${parsed.label}.`
              : p.key === "C"
              ? `Registrado: ${parsed.label}.`
              : p.key === "B"
              ? `Certo — tratemos isso como ${parsed.label}.`
              : `Ok — tratemos isso como ${parsed.label}.`;

          return `${lead}\n\nEtapa 3 — Atrito\nO que está em jogo aqui (conflito, regra, risco, desejo)?`;
        }
      },
      {
        key: "atrito",
        prompt: "Etapa 3 — Atrito\nO que está em jogo aqui?",
        onUser: (t) => {
          return izaReply(t) + "\n\nEtapa 4 — Concreto\nOnde isso aparece de forma concreta (cena, fala, gesto, lugar)?";
        }
      },
      {
        key: "concreto",
        prompt: "Etapa 4 — Concreto\nOnde isso aparece de forma concreta?",
        onUser: (t) => {
          return izaReply(t) + "\n\nEtapa 5 — Meta-compreensão\nO que você começa a entender sobre isso?";
        }
      },
      {
        key: "meta",
        prompt: "Etapa 5 — Meta-compreensão\nO que você começa a entender sobre isso?",
        onUser: (t) => {
          const hinge =
            state.centerType === "pergunta"
              ? "Se a pergunta fosse respondida, o que mudaria?"
              : state.centerType === "afirmacao"
              ? "O que sustenta essa afirmação?"
              : state.centerType === "ferida"
              ? "O que pede cuidado aqui?"
              : state.centerType === "desejo"
              ? "O que faz esse desejo insistir?"
              : "Qual é a chave aqui?";

          return izaReply(t) + `\n\nEtapa 6 — Síntese\nReúna tudo em 3 linhas. (${hinge})`;
        }
      },
      {
        key: "sintese",
        prompt: "Etapa 6 — Síntese\nReúna tudo em 3 linhas.",
        onUser: (t) => {
          return izaReply(t) + "\n\nEtapa 7 — Forma final\nEscreva a versão que você levaria adiante.";
        }
      },
      {
        key: "forma_final",
        prompt: "Etapa 7 — Forma final\nEscreva a versão final.",
        onUser: (t) => {
          return izaReply(t) + "\n\nQuer ajustar (a) ou encerrar e salvar (e)?";
        }
      },
      {
        key: "fim",
        prompt: "Ajustar (a) ou Encerrar (e)?",
        onUser: (t) => {
          const ans = (t || "").trim().toLowerCase();
          if (ans.startsWith("a")) {
            state.stepIndex = 0;
            state.turns = [];
            state.centerType = null;
            return "Ok. Vamos ajustar.\n\nEtapa 1 — Tema\nEm poucas palavras, qual é o tema?";
          }
          finish();
          return "Encerrando e salvando seu registro…";
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
        onUser: (t) => {
          // primeiro turno: ELIZA + pede 1 frase centro
          return izaReply(t) + "\n\nSe tivesse que dizer em 1 frase: qual é o centro disso?";
        }
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
        prompt: "A/B/C/D (ou escreva do seu jeito)",
        onUser: (t) => {
          const parsed = interpretCenterChoice(t);
          state.centerType = parsed.type;

          const p = state.presence || PRESENCES.A;
          const lead =
            p.key === "D"
              ? `Ok: ${parsed.label}.`
              : p.key === "C"
              ? `Registrado: ${parsed.label}.`
              : p.key === "B"
              ? `Certo — vamos caminhar com ${parsed.label}.`
              : `Ok — vamos caminhar com ${parsed.label}.`;

          return `${lead}\n\nAgora segue no fluxo: escreva mais um pouco (sem se vigiar).`;
        }
      },
      // a partir daqui: loop “aberto” (contagem de rounds)
      {
        key: "loop",
        prompt: "Escreva mais um pouco (quando quiser, pode encerrar).",
        onUser: (t) => {
          state.inspiredRounds += 1;
          const reply = izaReply(t);

          // checkpoint de encerramento após N rounds (sem quebrar fluxo)
          if (state.inspiredRounds >= MIN_INSPIRED_ROUNDS) {
            return (
              reply +
              "\n\nSe quiser, já dá pra encerrar e salvar. Ou seguimos mais uma rodada.\n" +
              "Digite: encerrar  |  ou apenas continue escrevendo."
            );
          }
          return reply;
        }
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
  state.centerType = null;
  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];
  showStep();
}

function showStep() {
  const track = TRACKS[state.trackKey];
  const step = track.steps[state.stepIndex];

  showPrompt(track.name, step.prompt, (text) => {
    const userText = (text || "").trim();
    if (!userText) return;

    // comando especial na trilha inspirada
    if (state.trackKey === "inspirada" && userText.toLowerCase().startsWith("encerrar")) {
      finish();
      return;
    }

    pushTurn("user", userText);
    const reply = step.onUser(userText);
    pushTurn("iza", reply);

    showIza(reply, () => {
      // loop especial: "loop" não termina a trilha
      if (state.trackKey === "inspirada" && track.steps[state.stepIndex].key === "loop") {
        // fica no loop
        showStep();
        return;
      }

      // avança
      state.stepIndex++;

      // se terminou a lista (não deveria), volta ao início
      if (state.stepIndex >= track.steps.length) {
        finish();
        return;
      }
      showStep();
    });
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

// -------------------- TESTE + ESCOLHA DE PRESENÇA --------------------
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
      <h2>Presença da IZA</h2>
      <p style="opacity:.85">
        Você pode escolher uma presença fixa (A/B/C/D) ou fazer o teste e gerar um perfil <strong>híbrido</strong>.
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
      <button class="button" onclick="startTrack('iniciante')">Trilha Iniciante</button>
      <button class="button" onclick="startTrack('intermediaria')">Trilha Intermediária</button>
      <button class="button" onclick="startTrack('inspirada')">Trilha Inspirada</button>

      <br>
      <button class="button" style="background:#a0896a;margin-top:10px;" onclick="showPresenceTest()">Ajustar presença</button>
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
  state.centerType = null;

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
        Você pode seguir uma trilha (iniciante ou intermediária) ou entrar numa conversa aberta no modo inspirado.
      </p>

      <p style="opacity:.85">
        Antes de começar, ajuste a presença da IZA (fixa A/B/C/D ou híbrida via teste rápido).
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
