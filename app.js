// ===========================
// IZA no Cordel 2.0 — app.js
// Refactor total: 3 trilhas × 4 presenças (12 modos)
// Inspirada: motor ELIZA-like focado em autoria
// Registro: Google Apps Script Web App via fetch
// PATCH 1: trocar 2 chamadas p/ showEndScreenWithHistory
// PATCH 2: feedback "Salvando..." no final
// PATCH 3: upgrade showPromptInput (foco, ctrl+enter, anti-duplo-clique)
// ===========================

// 1) URL /exec do seu Web App (Apps Script)
const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbx2CDkA7TVIFNu8dsnMgEg2_WjYq8-Yntu_NoV89UE8rVdioFJZbT6cjbGCDNP7brrk/exec";

// 2) Config
const MIN_INSPIRED_ROUNDS = 7;

// 3) Estado
const state = {
  name: "",
  email: "",
  presenceKey: null, // "A" | "B" | "C" | "D"
  presence: null, // objeto de configuração
  trackKey: null, // "iniciante" | "intermediaria" | "inspirada"
  stepIndex: 0,
  inspiredRounds: 0,
  sent: false,
  sessionId: null,
  startedAtISO: null,
  pageURL: "",
  lastIzaText: "",
  turns: [] // {role:"user"|"iza", text, meta:{track, step, presence, t}}
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

// 4) Presenças (A/B/C/D)
const PRESENCES = {
  A: {
    key: "A",
    name: "IZA Discreta",
    vibe: "leve",
    mirror: "short",
    maxQuestions: 1,
    softeners: ["", "Se fizer sentido,", "Talvez,"],
    closings: ["", "Pode seguir.", "Quando quiser, continue."],
    directiveLevel: 0
  },
  B: {
    key: "B",
    name: "IZA Calorosa",
    vibe: "próxima",
    mirror: "short",
    maxQuestions: 1,
    softeners: ["Entendi.", "Tô com você.", "Certo."],
    closings: ["Se quiser, a gente ajusta.", "Pode seguir."],
    directiveLevel: 1
  },
  C: {
    key: "C",
    name: "IZA Firme",
    vibe: "estruturadora",
    mirror: "medium",
    maxQuestions: 2,
    softeners: ["Vamos focar.", "Certo."],
    closings: ["Responda direto.", "Vamos para a próxima."],
    directiveLevel: 2
  },
  D: {
    key: "D",
    name: "IZA Minimalista",
    vibe: "quase invisível",
    mirror: "tiny",
    maxQuestions: 1,
    softeners: [""],
    closings: ["Continue.", "Siga.", ""],
    directiveLevel: 0
  }
};

function presenceMessage(p) {
  if (!p) return "";
  const base = {
    A: "Vou te acompanhar de forma leve, com poucas interferências. Podemos ajustar isso a qualquer momento.",
    B: "Vou te acompanhar com proximidade e acolhimento, sem te tirar do seu texto. Podemos ajustar isso a qualquer momento.",
    C: "Vou te acompanhar com estrutura e direção clara para organizar suas ideias. Podemos ajustar isso a qualquer momento.",
    D: "Vou ficar quase invisível: pouco ruído e mais espaço pra você escrever. Podemos ajustar isso a qualquer momento."
  };
  return base[p.key] || "Podemos ajustar isso a qualquer momento.";
}

// 5) UI helpers
function el(id) {
  return document.getElementById(id);
}

function render(nodeOrHtml) {
  const app = el("app");
  app.innerHTML = "";
  if (typeof nodeOrHtml === "string") {
    app.innerHTML = nodeOrHtml;
  } else {
    app.appendChild(nodeOrHtml);
  }
}

function card(html) {
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = html;
  return d;
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
      track: state.trackKey,
      step: state.stepIndex,
      presence: state.presenceKey,
      t: nowISO(),
      ...meta
    }
  });
}

// 6) Teste de presença
const testQuestions = [
  {
    title: "Pergunta 1",
    question: "Quando você escreve, o que ajuda mais?",
    options: [
      { value: "A", text: "Perguntas suaves que me deixem pensar" },
      { value: "B", text: "Um tom próximo e acolhedor" },
      { value: "C", text: "Direcionamento claro" },
      { value: "D", text: "Poucas interferências" }
    ]
  },
  {
    title: "Pergunta 2",
    question: "Se seu texto estiver confuso, você prefere:",
    options: [
      { value: "A", text: "Uma pergunta aberta" },
      { value: "B", text: "Um convite para desenrolar" },
      { value: "C", text: "Um pedido direto de clareza" },
      { value: "D", text: "Silêncio e espaço" }
    ]
  },
  {
    title: "Pergunta 3",
    question: "O ritmo ideal de conversa é:",
    options: [
      { value: "A", text: "Calmo e leve" },
      { value: "B", text: "Conversado" },
      { value: "C", text: "Objetivo" },
      { value: "D", text: "Quase silencioso" }
    ]
  },
  {
    title: "Pergunta 4",
    question: "Você está escrevendo hoje mais para:",
    options: [
      { value: "A", text: "Explorar ideias" },
      { value: "B", text: "Expressar algo pessoal" },
      { value: "C", text: "Organizar pensamento" },
      { value: "D", text: "Só colocar no papel" }
    ]
  },
  {
    title: "Pergunta 5",
    question: "Como você quer que a IZA apareça?",
    options: [
      { value: "A", text: "Discreta" },
      { value: "B", text: "Próxima" },
      { value: "C", text: "Estruturadora" },
      { value: "D", text: "Quase invisível" }
    ]
  }
];

function classifyPresence(answers) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  answers.forEach((a) => {
    if (counts[a] !== undefined) counts[a]++;
  });

  const max = Math.max(counts.A, counts.B, counts.C, counts.D);
  const tied = Object.keys(counts).filter((k) => counts[k] === max);
  let key;

  if (tied.length === 1) key = tied[0];
  else if (tied.length === 2) {
    const combo = tied.slice().sort().join("");
    const tieMap = { AB: "A", BC: "B", CD: "C", AD: "D" };
    key = tieMap[combo] || tied[0];
  } else key = "A";

  return PRESENCES[key];
}

// 7) Motor ELIZA-like (foco em autoria, com memória e presença)
const IZA_ENGINE = {
  memory: [],
  usedRecently: []
};

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

function shortMirrorByPresence(presence, userText) {
  const t = (userText || "").trim();
  if (!t) return presence.key === "D" ? "Continue." : "Pode seguir.";
  const words = t.split(/\s+/);

  if (presence.mirror === "tiny") {
    const w = words.slice(0, 6).join(" ");
    return `“${swapPronouns(w)}…”`;
  }
  if (presence.mirror === "short") {
    const w = words.slice(0, 10).join(" ");
    return `Você está escrevendo: “${swapPronouns(w)}…”.`;
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

const IZA_SCRIPT = [
  {
    key: /(sarau|inclus[aã]o|diversidade|libras|teatro|declama[cç][aã]o|ancestralidade|audiovisual)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Qual imagem concreta do sarau você quer que o leitor veja primeiro?",
          "Qual é o centro: inclusão, arte, ou ancestralidade?",
          "Que verso você quer que fique como assinatura desse encontro?"
        ],
        memory: [
          "Você falou de diversidade. Qual detalhe não pode faltar?",
          "Volta numa cena do sarau: onde exatamente acontece?"
        ]
      }
    ]
  },
  {
    key: /(discriminad|n[aã]o era lugar|n[aã]o deixaram|resist|lutou|palco)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Onde isso aparece numa cena: gesto, fala, ou regra do lugar?",
          "Qual foi o ponto de virada: quando ela decide ficar, ou quando tentam expulsar?",
          "O que você quer deixar explícito — e o que prefere deixar implícito?"
        ],
        memory: ["Volte no ponto de virada. O que muda depois dele?"]
      }
    ]
  },
  {
    key: /(ningu[eé]m apoia|n[aã]o acredita|preso|guardado|n[aã]o d[aá] pra expressar)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Se isso virasse uma cena curta, onde estaria esse “preso”?",
          "Escreve a frase que você ainda não disse — do jeito mais simples.",
          "O que o leitor precisa entender sem você explicar?"
        ],
        memory: ["Qual imagem carregaria isso sem explicar demais?"]
      }
    ]
  },
  {
    key: /(palafit|raiz|onde est[aá] minha raiz|cresci)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Qual detalhe da palafita vira símbolo aqui (som, cheiro, água, madeira)?",
          "Quando você pergunta “onde está minha raiz?”, o que falta agora: lugar, tempo, ou gente?",
          "Desenha o contraste entre ‘fui feliz’ e ‘hoje’ em 2 linhas."
        ],
        memory: ["Qual detalhe você não quer perder dessa origem?"]
      }
    ]
  },
  {
    key: /(progresso|coragem|suor|gente dedicada)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Qual exemplo concreto prova isso (uma ação, um dia, um trabalho)?",
          "Se o progresso não se compra, como se constrói: em etapas ou num salto?",
          "Qual é a frase-martelo que você quer que fique?"
        ],
        memory: ["Dá um exemplo curto que sustente essa frase."]
      }
    ]
  },
  {
    key: /(mulher|laje|grupo|todes|encontrar|coletivo)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Como começa a cena: quem chama, onde sentam, o que aparece primeiro?",
          "O que muda quando ‘uns poucos homens’ se juntam? Clima, fala, ou regra?",
          "Que aprendizado você quer que o público leve desse coletivo?"
        ],
        memory: ["Volte no começo: qual imagem abre essa história?"]
      }
    ]
  },
  {
    key: /\b(meu|minha|meus|minhas)\b/i,
    decomps: [
      {
        re: /(.*)\b(meu|minha|meus|minhas)\b(.*)/i,
        reasmb: [
          "Você falou de algo muito seu: {3}. O que você quer revelar — e o que quer proteger?",
          "Quando {3} aparece, o que está em jogo no texto?",
          "Isso quer soar como confissão, denúncia, ou celebração?"
        ],
        memory: ["Voltando em {3}: qual detalhe você quer desenvolver agora?"]
      }
    ]
  },
  {
    key: /(.*)/i,
    decomps: [
      {
        re: /(.*)/i,
        reasmb: [
          "Pode continuar.",
          "Onde isso aparece concretamente?",
          "Qual é o centro disso em 1–2 frases?",
          "O que aqui ainda está implícito?"
        ],
        memory: ["Volte no centro: qual frase você quer que fique?"]
      }
    ]
  }
];

function applyPresenceWrap(presence, coreText) {
  const soft = pick(presence.softeners);
  const close = pick(presence.closings);

  if (presence.key === "D") return coreText.replace(/\n{2,}/g, "\n");

  if (presence.key === "A") {
    const prefix = soft ? soft + " " : "";
    const suffix = close ? "\n" + close : "";
    return (prefix + coreText + suffix).trim();
  }

  if (presence.key === "B") {
    const prefix = soft ? soft + " " : "Certo. ";
    const suffix = close ? "\n" + close : "\nPodemos seguir.";
    return (prefix + coreText + suffix).trim();
  }

  if (presence.key === "C") {
    const prefix = soft ? soft + " " : "";
    return (prefix + coreText).trim();
  }

  return coreText;
}

function izaReply(userText) {
  const presence = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t) return presence.key === "D" ? "Continue." : "Pode seguir.";

  const memChance =
    presence.key === "C"
      ? 0.35
      : presence.key === "B"
      ? 0.30
      : presence.key === "A"
      ? 0.20
      : 0.10;

  if (IZA_ENGINE.memory.length > 0 && Math.random() < memChance) {
    const mirror = shortMirrorByPresence(presence, t);
    const mem = IZA_ENGINE.memory.shift();
    return applyPresenceWrap(presence, [mirror, mem].filter(Boolean).join("\n"));
  }

  for (const rule of IZA_SCRIPT) {
    if (!rule.key.test(t)) continue;

    for (const d of rule.decomps) {
      const m = t.match(d.re);
      if (!m) continue;

      const mirror = shortMirrorByPresence(presence, t);

      const q1 = pick(d.reasmb);
      let qText = applyReasmb(q1, m);

      if (presence.key === "C" && presence.maxQuestions >= 2 && Math.random() < 0.30) {
        const extraPool =
          d.reasmb.length > 1
            ? d.reasmb.filter((x) => x !== q1)
            : IZA_SCRIPT[IZA_SCRIPT.length - 1].decomps[0].reasmb;

        const q2 = pick(extraPool);
        qText = qText + "\n" + applyReasmb(q2, m);
      }

      if (d.memory && d.memory.length) {
        const memT = pick(d.memory);
        IZA_ENGINE.memory.push(applyReasmb(memT, m));
        if (IZA_ENGINE.memory.length > 8) IZA_ENGINE.memory.shift();
      }

      let core;
      if (presence.key === "D" && Math.random() < 0.55) core = qText;
      else core = [mirror, qText].join("\n");

      return applyPresenceWrap(presence, core);
    }
  }

  return applyPresenceWrap(presence, "Pode continuar.");
}

// 8) Trilhas
const TRACKS = {
  iniciante: {
    name: "Trilha Iniciante (4 etapas)",
    steps: [
      {
        key: "nucleo",
        prompt:
          "Etapa 1 — Núcleo\nEscreva livremente sobre seu tema. (Pode ser verso, prosa, rascunho.)",
        onUser: (text) => {
          const reply = izaReply(text);
          return reply + "\n\nEm 1–2 frases: qual é o centro disso?";
        }
      },
      {
        key: "centro",
        prompt: "Escreva em 1–2 frases qual é o centro disso.",
        onUser: () => "É por aqui? Responda: s (sim) ou n (não)."
      },
      {
        key: "confirmacao",
        prompt: "É por aqui? (s/n)",
        onUser: (text) => {
          const t = text.trim().toLowerCase();
          if (t.startsWith("n")) {
            state.stepIndex = 1;
            return "Tudo bem. Reescreva o centro em 1–2 frases, do jeito mais simples possível.";
          }
          return "Etapa 2 — Atrito\nO que está em jogo aqui? (conflito, dúvida, desejo, risco)";
        }
      },
      {
        key: "atrito",
        prompt: "Etapa 2 — Atrito\nO que está em jogo aqui?",
        onUser: () => "Onde isso se torna mais claro? Traga um detalhe concreto."
      },
      {
        key: "atrito_detalhe",
        prompt: "Onde isso se torna mais claro? (detalhe concreto)",
        onUser: () =>
          "Etapa 3 — Exemplo\nTraga uma situação concreta (uma cena, pessoa, lugar, acontecimento)."
      },
      {
        key: "exemplo",
        prompt: "Etapa 3 — Exemplo\nTraga uma situação concreta.",
        onUser: () => "Esse exemplo mostra o quê? O que ele revela sobre sua ideia?"
      },
      {
        key: "exemplo_revelacao",
        prompt: "O que esse exemplo revela sobre sua ideia?",
        onUser: () =>
          "Etapa 4 — Frase que fica\nEscreva uma frase/verso que você quer que fique."
      },
      {
        key: "frase_final",
        prompt: "Etapa 4 — Frase que fica\nEscreva uma frase/verso final.",
        onUser: () => "Quer ajustar (a) ou encerrar (e)?"
      },
      {
        key: "encerrar_ou_ajustar",
        prompt: "Quer ajustar (a) ou encerrar (e)?",
        onUser: (text) => {
          const t = text.trim().toLowerCase();
          if (t.startsWith("a")) {
            state.stepIndex = 0;
            state.turns = [];
            return "Vamos ajustar. Etapa 1 — Núcleo\nEscreva novamente sobre seu tema.";
          }
          safeRegister();
          // PATCH 2: feedback de salvamento
          return "Encerrado. Salvando seu registro… (1–2s)\n\nObrigado por escrever com a IZA.";
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
        onUser: () => "Etapa 2 — Pergunta\nQue pergunta move esse texto?"
      },
      {
        key: "pergunta",
        prompt: "Etapa 2 — Pergunta\nQue pergunta move esse texto?",
        onUser: () => "Etapa 3 — Atrito\nO que está em jogo aqui?"
      },
      {
        key: "atrito",
        prompt: "Etapa 3 — Atrito\nO que está em jogo aqui?",
        onUser: () => "Onde isso aparece de forma concreta? (uma cena, lugar, fala)"
      },
      {
        key: "concreto",
        prompt: "Onde isso aparece de forma concreta?",
        onUser: () =>
          "Etapa 4 — Meta-compreensão\nO que você começa a pensar sobre isso?"
      },
      {
        key: "meta",
        prompt: "Etapa 4 — Meta-compreensão\nO que você começa a pensar sobre isso?",
        onUser: () => {
          if (state.presenceKey === "C")
            return "Etapa 5 — Exemplo\nTraga um exemplo específico que sustente isso.";
          if (state.presenceKey === "D") return "Exemplo.";
          return "Etapa 5 — Exemplo\nTraga um exemplo que sustente isso.";
        }
      },
      {
        key: "exemplo",
        prompt: "Etapa 5 — Exemplo\nTraga um exemplo.",
        onUser: () => "Ele confirma ou complica sua ideia? (1–2 frases)"
      },
      {
        key: "confirma_ou_complica",
        prompt: "Ele confirma ou complica sua ideia?",
        onUser: () => "Etapa 6 — Síntese\nReúna tudo em 3 linhas."
      },
      {
        key: "sintese",
        prompt: "Etapa 6 — Síntese\nReúna tudo em 3 linhas.",
        onUser: () => "O que precisa ficar? (a frase/verso que você não abre mão)"
      },
      {
        key: "o_que_fica",
        prompt: "O que precisa ficar?",
        onUser: () =>
          "Etapa 7 — Forma final\nEscreva a versão que você levaria adiante."
      },
      {
        key: "forma_final",
        prompt: "Etapa 7 — Forma final\nEscreva a versão final.",
        onUser: () => "Quer continuar (c) ou encerrar (e)?"
      },
      {
        key: "encerrar_ou_continuar",
        prompt: "Quer continuar (c) ou encerrar (e)?",
        onUser: (text) => {
          const t = text.trim().toLowerCase();
          if (t.startsWith("c")) {
            state.stepIndex = 0;
            state.turns = [];
            return "Vamos recomeçar.\n\nEtapa 1 — Tema\nEm poucas palavras, qual é o tema?";
          }
          safeRegister();
          // PATCH 2: feedback de salvamento
          return "Encerrado. Salvando seu registro… (1–2s)\n\nObrigado por escrever com a IZA.";
        },
        endScreen: true
      }
    ]
  },

  inspirada: {
    name: "Trilha Inspirado/a (conversa aberta)",
    steps: []
  }
};

// 9) Registro (Apps Script Web App)
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

// 10) Navegação principal

function showWelcome() {
  state.sessionId = newSessionId();
  state.startedAtISO = nowISO();
  state.pageURL = window.location.href;

  state.presenceKey = null;
  state.presence = null;
  state.trackKey = null;
  state.stepIndex = 0;
  state.inspiredRounds = 0;
  state.sent = false;
  state.lastIzaText = "";
  state.turns = [];
  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];

  const d = card(`
    <h2>Bem-vindo(a) ao Projeto IZA</h2>
    <p>IZA simula o espírito do chatbot ELIZA (1966), não para terapia, mas para fortalecer <strong>autoria</strong> durante a escrita.</p>
    <p>Antes de começar, informe seu nome e e-mail para receber o registro da sua escrita.</p>

    <label><strong>Seu nome</strong></label><br>
    <input type="text" id="userName" class="input-area" placeholder="Digite seu nome"><br><br>

    <label><strong>Seu e-mail</strong></label><br>
    <input type="email" id="userEmail" class="input-area" placeholder="Digite seu e-mail"><br><br>

    <button class="button" id="startTest">Fazer teste rápido (15–25s)</button>
  `);

  d.querySelector("#startTest").addEventListener("click", () => {
    const name = d.querySelector("#userName").value.trim();
    const email = d.querySelector("#userEmail").value.trim();
    if (!name || !email) {
      alert("Por favor, preencha seu nome e e-mail antes de continuar.");
      return;
    }
    state.name = name;
    state.email = email;
    showPresenceTest();
  });

  render(d);
}

function showPresenceTest() {
  const form = document.createElement("div");
  form.className = "card";
  form.innerHTML = `<h2>Como você prefere que a IZA te acompanhe hoje?</h2>`;

  testQuestions.forEach((q, idx) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<p><strong>${q.title}:</strong> ${q.question}</p>`;

    const opts = document.createElement("div");
    opts.className = "options";

    q.options.forEach((opt) => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="q${idx}" value="${opt.value}"> ${opt.text}`;
      opts.appendChild(label);
    });

    block.appendChild(opts);
    form.appendChild(block);
  });

  const btn = document.createElement("button");
  btn.className = "button";
  btn.textContent = "Concluir";
  btn.disabled = true;

  form.addEventListener("change", () => {
    const ok = testQuestions.every((_, i) =>
      form.querySelector(`input[name="q${i}"]:checked`)
    );
    btn.disabled = !ok;
  });

  btn.addEventListener("click", () => {
    const answers = [];
    for (let i = 0; i < testQuestions.length; i++) {
      const sel = form.querySelector(`input[name="q${i}"]:checked`);
      answers.push(sel.value);
    }
    const pres = classifyPresence(answers);
    state.presenceKey = pres.key;
    state.presence = pres;
    showPresenceResult();
  });

  form.appendChild(btn);
  render(form);
}

function showPresenceResult() {
  const p = state.presence || PRESENCES.A;

  const d = card(`
    <h2>IZA: ${escapeHtml(p.name)}</h2>
    <div class="message">${escapeHtml(presenceMessage(p))}</div>

    <p><strong>Escolha uma trilha:</strong></p>
    <button class="button" id="t1">Trilha Iniciante (4 etapas)</button>
    <button class="button" id="t2">Trilha Intermediária (7 etapas)</button>
    <button class="button" id="t3">Trilha Inspirado/a (conversa aberta)</button>

    <br><button class="button" id="redo" style="background:#a0896a;margin-top:10px;">Refazer teste</button>
  `);

  d.querySelector("#t1").addEventListener("click", () => startTrack("iniciante"));
  d.querySelector("#t2").addEventListener("click", () => startTrack("intermediaria"));
  d.querySelector("#t3").addEventListener("click", () => startTrack("inspirada"));
  d.querySelector("#redo").addEventListener("click", showPresenceTest);

  render(d);
}

function startTrack(key) {
  state.trackKey = key;
  state.stepIndex = 0;
  state.inspiredRounds = 0;
  state.sent = false;
  state.lastIzaText = "";
  state.turns = [];
  IZA_ENGINE.memory = [];
  IZA_ENGINE.usedRecently = [];

  if (key === "inspirada") showInspiredTurn(true);
  else showStructuredStep();
}

// Trilhas estruturadas
function showStructuredStep() {
  const track = TRACKS[state.trackKey];
  if (!track) return showPresenceResult();

  const steps = track.steps;
  const step = steps[state.stepIndex];

  if (!step) {
    safeRegister();
    return showEndScreenWithHistory("Trilha encerrada", "Obrigado por escrever com a IZA.");
  }

  showPromptInput({
    title: track.name,
    prompt: step.prompt,
    placeholder: "Escreva aqui…",
    button: "Enviar",
    onSubmit: (userText) => {
      const beforeIndex = state.stepIndex; // robusto

      pushTurn("user", userText);

      const izaText = step.onUser(userText);
      state.lastIzaText = izaText;
      pushTurn("iza", izaText);

      showIzaMessage(izaText, () => {
        // Se o step.onUser NÃO mexeu no stepIndex, avança
        if (state.stepIndex === beforeIndex) state.stepIndex += 1;

        // PATCH 1: usar tela final com histórico
        if (step.endScreen) {
          return showEndScreenWithHistory("Encerrado", izaText);
        }

        showStructuredStep();
      });
    }
  });
}

// Trilha inspirada
function showInspiredTurn(isFirst = false) {
  const p = state.presence || PRESENCES.A;

  if (!isFirst && state.inspiredRounds >= MIN_INSPIRED_ROUNDS) {
    const d = card(`
      <h2>IZA</h2>
      <div class="message">Parece que uma ideia está se formando. Quer encerrar ou seguir?</div>
      <button class="button" id="end">Encerrar e salvar</button>
      <button class="button" id="cont">Seguir no fluxo</button>
    `);

    d.querySelector("#end").addEventListener("click", () => {
      safeRegister();
      // PATCH 1: usar tela final com histórico
      showEndScreenWithHistory(
        "Registro pronto",
        // PATCH 2: feedback
        "Salvando seu registro… (1–2s)\n\nVocê e o professor receberão uma cópia por e-mail."
      );
    });

    d.querySelector("#cont").addEventListener("click", () => showInspiredTurn(true));
    return render(d);
  }

  const prompt = isFirst
    ? "Sobre o que você quer escrever hoje?"
    : p.key === "D"
    ? "Continue."
    : "Escreva mais um pouco.";

  showPromptInput({
    title: TRACKS.inspirada.name,
    prompt,
    placeholder: "Escreva aqui…",
    button: "Enviar",
    onSubmit: (userText) => {
      pushTurn("user", userText, { round: state.inspiredRounds + 1 });

      const reply = izaReply(userText);
      state.lastIzaText = reply;
      pushTurn("iza", reply, { round: state.inspiredRounds + 1 });

      state.inspiredRounds += 1;

      showIzaMessage(reply, () => showInspiredTurn(false));
    }
  });
}

// PATCH 3 — UI: prompt + textarea (upgrade)
function showPromptInput({ title, prompt, placeholder, button, onSubmit }) {
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(prompt).replace(/\n/g, "<br>")}</p>
    <textarea id="txt" class="input-area" rows="4" placeholder="${escapeHtml(placeholder)}"></textarea>
    <button class="button" id="send">${escapeHtml(button)}</button>
  `;

  const ta = d.querySelector("#txt");
  const btn = d.querySelector("#send");

  // foco automático
  setTimeout(() => ta.focus(), 0);

  // submit seguro (evita clique duplo)
  const submitOnce = () => {
    const text = ta.value.trim();
    if (!text) return;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    onSubmit(text);
  };

  btn.addEventListener("click", submitOnce);

  // Ctrl+Enter / Cmd+Enter para enviar
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submitOnce();
    }
  });

  render(d);
}

// UI: mostrar fala da IZA e botão continuar
function showIzaMessage(text, onContinue) {
  const p = state.presence || PRESENCES.A;
  const header = p.key === "D" ? "" : "<h2>IZA</h2>";

  const d = card(`
    ${header}
    <div class="message">${escapeHtml(text).replace(/\n/g, "<br>")}</div>
    <button class="button" id="next">${p.key === "D" ? "Siga" : "Continuar"}</button>
  `);

  d.querySelector("#next").addEventListener("click", onContinue);
  render(d);
}

// UI: tela final simples (mantida, mas agora quase não usada)
function showEndScreen(title, message) {
  const d = card(`
    <h2>${escapeHtml(title)}</h2>
    <div class="message">${escapeHtml(message).replace(/\n/g, "<br>")}</div>
    <button class="button" id="home">Voltar ao início</button>
  `);

  d.querySelector("#home").addEventListener("click", showWelcome);
  render(d);
}

// Histórico
function buildPrettyHistoryText() {
  const lines = [];
  lines.push("IZA no Cordel 2.0 — Percurso de escrita");
  lines.push("----------------------------------------");
  lines.push(`Nome: ${state.name}`);
  lines.push(`Email: ${state.email}`);
  lines.push(`Presença: ${state.presence?.name || ""}`);
  lines.push(`Trilha: ${state.trackKey || ""}`);
  lines.push("");

  state.turns.forEach((t, i) => {
    const who = t.role === "iza" ? "IZA" : "Você";
    lines.push(`${i + 1}. ${who}:`);
    lines.push((t.text || "").trim() || "[vazio]");
    lines.push("");
  });

  const userTexts = state.turns
    .filter((x) => x.role === "user")
    .map((x) => (x.text || "").trim())
    .filter(Boolean);

  if (userTexts.length) {
    lines.push("Resumo:");
    lines.push(
      `- Primeira escrita: ${userTexts[0].slice(0, 260)}${
        userTexts[0].length > 260 ? "…" : ""
      }`
    );
    lines.push(
      `- Última versão: ${userTexts[userTexts.length - 1].slice(0, 260)}${
        userTexts[userTexts.length - 1].length > 260 ? "…" : ""
      }`
    );
  }

  return lines.join("\n");
}

function showEndScreenWithHistory(title, message) {
  const history = buildPrettyHistoryText();
  const d = card(`
    <h2>${escapeHtml(title)}</h2>
    <div class="message">${escapeHtml(message).replace(/\n/g, "<br>")}</div>

    <p><strong>Percurso de escrita</strong></p>
    <textarea class="input-area" rows="12" style="white-space:pre-wrap;">${escapeHtml(history)}</textarea>

    <button class="button" id="copy">Copiar percurso</button>
    <button class="button" id="home">Voltar ao início</button>
  `);

  d.querySelector("#copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(history);
      alert("Percurso copiado!");
    } catch {
      alert("Não consegui copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  });

  d.querySelector("#home").addEventListener("click", showWelcome);
  render(d);
}

// init
document.addEventListener("DOMContentLoaded", showWelcome);
