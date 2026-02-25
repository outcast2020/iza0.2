// ==========================================
// IZA no Cordel 2.0 — app.js (Motor ELIZA-Refactored)
// Foco: Autoria em texto geral e poesia.
// ==========================================

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx2CDkA7TVIFNu8dsnMgEg2_WjYq8-Yntu_NoV89UE8rVdioFJZbT6cjbGCDNP7brrk/exec";
const MIN_INSPIRED_ROUNDS = 7;

const state = {
  name: "", email: "", presenceKey: null, presence: null, trackKey: null,
  stepIndex: 0, inspiredRounds: 0, sent: false, sessionId: null,
  startedAtISO: null, pageURL: "", lastIzaText: "", turns: []
};

// --- CONFIGURAÇÃO DE PRESENÇAS --- [cite: 185, 186]
const PRESENCES = {
  A: { key: "A", name: "IZA Discreta", vibra: "leve", mirror: "short", softeners: ["", "Se fizer sentido,"], closings: ["Pode seguir."], directive: 0 },
  B: { key: "B", name: "IZA Calorosa", vibra: "acolhedora", mirror: "short", softeners: ["Entendi.", "Tô com você."], closings: ["Se quiser, ajuste.", "Siga."], directive: 1 },
  C: { key: "C", name: "IZA Firme", vibra: "direta", mirror: "medium", softeners: ["Vamos focar.", "Certo."], closings: ["Responda direto.", "Próxima etapa."], directive: 2 },
  D: { key: "D", name: "IZA Minimalista", vibra: "ausente", mirror: "tiny", softeners: [""], closings: ["Continue.", "Siga."], directive: 0 }
};

// --- MOTOR ELIZA (DECOMPOSIÇÃO E REMONTAGEM) --- [cite: 45, 142]

function swapPronouns(text) {
  const map = {
    "eu": "você", "meu": "seu", "minha": "sua", "meus": "seus", "minhas": "suas",
    "comigo": "com você", "estou": "está", "sou": "é", "me": "te", "fui": "foi",
    "tenho": "tem", "meus": "seus", "minhas": "suas", "você": "eu", "seu": "meu", "sua": "minha"
  };
  return text.toLowerCase().split(/\s+/).map(w => map[w] || w).join(" ");
}

const IZA_SCRIPT = [
  { key: /\b(escrever|texto|rascunho|poema|verso|papel)\b/i, // 1. Escrita Geral [cite: 74]
    decomps: [{ re: /.*(?:escrever|texto|rascunho|poema|verso) (.*)/i, reasmb: ["O que em '{1}' mais te desafia agora?", "Se simplificasse '{1}', o que sobraria?", "Como '{1}' se conecta à sua ideia central?"] }] },
  { key: /\b(sinto|sentir|sentimento|emoção|triste|feliz)\b/i, // 2. Sentimentos [cite: 164, 167]
    decomps: [{ re: /.*(?:sinto|sentir|sentimento) (.*)/i, reasmb: ["Onde esse sentir '{1}' aparece no texto?", "Essa sensação de '{1}' ajuda ou atrapalha a autoria?", "Consegue transformar esse '{1}' em uma imagem concreta?"] }] },
  { key: /\b(fiz|tentei|faço|criei|consegui)\b/i, // 3. Agência Pessoal [cite: 46]
    decomps: [{ re: /.*(?:fiz|tentei|faço|criei) (.*)/i, reasmb: ["O que motivou você a '{1}'?", "Ao tentar '{1}', qual foi a primeira descoberta?", "Como você se sente após ter '{1}'?"] }] },
  { key: /\b(talvez|acho|dúvida|não sei|confuso)\b/i, // 4. Incerteza [cite: 87, 109]
    decomps: [{ re: /.*(?:talvez|acho|não sei) (.*)/i, reasmb: ["O que sustenta esse seu '{1}'?", "Se não houvesse dúvida, como seria esse '{1}'?", "Vamos olhar para o centro desse '{1}': o que é essencial?"] }] },
  { key: /\b(mãe|pai|raiz|casa|família|origem)\b/i, // 5. Origem/Família [cite: 230, 236]
    decomps: [{ re: /.*(?:raiz|casa|família|origem) (.*)/i, reasmb: ["Qual detalhe de '{1}' você não quer perder?", "Como '{1}' molda a forma como você escreve hoje?", "O que em '{1}' ainda precisa ser dito?"] }] },
  { key: /\b(não posso|não consigo|difícil|impossível)\b/i, // 6. Bloqueios [cite: 155]
    decomps: [{ re: /.*(?:não consigo|difícil) (.*)/i, reasmb: ["O que aconteceria se você pudesse '{1}'?", "Qual é o primeiro passo para destravar esse '{1}'?", "Isso é um limite real ou um receio sobre '{1}'?"] }] },
  { key: /\b(quero|desejo|sonho|pretendo)\b/i, // 7. Desejo [cite: 87]
    decomps: [{ re: /.*(?:quero|pretendo) (.*)/i, reasmb: ["O que te impede de '{1}' agora?", "Quem mais se beneficiaria se você pudesse '{1}'?", "Como esse '{1}' vira cena no seu texto?"] }] },
  { key: /\b(pessoas|todo mundo|ninguém|eles|elas)\b/i, // 8. Outros/Coletivo [cite: 239]
    decomps: [{ re: /.*(?:pessoas|ninguém) (.*)/i, reasmb: ["Pense em alguém específico ao falar de '{1}'.", "De que forma '{1}' afeta sua voz no texto?", "O que o leitor precisa entender sobre '{1}' sem explicação?"] }] },
  { key: /\b(sempre|nunca|todo tempo|jamais)\b/i, // 9. Generalizações [cite: 241, 350]
    decomps: [{ re: /.*(?:sempre|nunca) (.*)/i, reasmb: ["Consegue lembrar de uma exceção a esse '{1}'?", "O que torna esse '{1}' tão definitivo?", "Como esse '{1}' se manifesta hoje?"] }] },
  { key: /\b(atrito|conflito|problema|luta)\b/i, // 10. Conflito [cite: 85, 108]
    decomps: [{ re: /.*(?:atrito|conflito|problema) (.*)/i, reasmb: ["Qual é o centro desse '{1}'?", "Como esse '{1}' gera movimento no texto?", "O que está em risco nesse '{1}'?"] }] },
  { key: /\b(se eu|caso|quem sabe)\b/i, // 11. Condicional [cite: 223, 424]
    decomps: [{ re: /.*se eu (.*)/i, reasmb: ["O que te impede de agir sobre '{1}'?", "Essa hipótese de '{1}' é um caminho real?", "Como seria o texto se '{1}' já fosse verdade?"] }] },
  { key: /(.*)/i, // 12. Fallback Geral [cite: 224, 425]
    decomps: [{ re: /(.*)/i, reasmb: ["Pode continuar.", "Onde isso aparece concretamente?", "O que aqui ainda está implícito?", "Como isso soaria se fosse uma confissão?"] }] }
];

function izaReply(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t) return p.key === "D" ? "Continue." : "Pode seguir.";

  for (const rule of IZA_SCRIPT) {
    if (rule.key.test(t)) {
      const d = rule.decomps[0];
      const match = t.match(d.re);
      if (match) {
        const fragment = swapPronouns(match[1] || match[0]);
        let reply = d.reasmb[Math.floor(Math.random() * d.reasmb.length)].replace("{1}", fragment);
        
        // Aplica o "Wrap" de presença [cite: 156, 162, 169, 177]
        const soft = p.softeners[Math.floor(Math.random() * p.softeners.length)];
        const close = p.closings[Math.floor(Math.random() * p.closings.length)];
        return (p.key === "D") ? reply : `${soft} ${reply} ${close}`.trim();
      }
    }
  }
}

// --- TRILHAS E ETAPAS --- [cite: 58, 75, 103, 128]

const TRACKS = {
  iniciante: { name: "Trilha Iniciante (4 etapas)", steps: [
    { key: "nucleo", prompt: "Etapa 1 — Núcleo: Escreva livremente sobre seu tema.", onUser: t => izaReply(t) + "\n\nEm 1–2 frases: qual é o centro disso?" },
    { key: "centro", prompt: "Qual é o centro disso?", onUser: () => "É por aqui? (s/n)" },
    { key: "atrito", prompt: "Etapa 2 — Atrito: O que está em jogo aqui? (conflito, desejo, risco)", onUser: () => "Etapa 3 — Exemplo: Traga uma situação ou cena concreta." },
    { key: "exemplo", prompt: "Traga uma cena concreta.", onUser: () => "Etapa 4 — Frase Final: Escreva o verso ou frase que precisa ficar." },
    { key: "fim", prompt: "Quer ajustar (a) ou encerrar (e)?", onUser: (t) => t.toLowerCase().startsWith('e') ? finish() : resetTrack(), endScreen: true }
  ]},
  intermediaria: { name: "Trilha Intermediária (7 etapas)", steps: [
    { key: "tema", prompt: "Etapa 1 — Tema: Qual o tema em poucas palavras?", onUser: () => "Etapa 2 — Pergunta: Que pergunta move este texto?" },
    { key: "pergunta", prompt: "Que pergunta move este texto?", onUser: () => "Etapa 3 — Atrito: O que está em jogo?" },
    { key: "atrito", prompt: "O que está em jogo?", onUser: () => "Etapa 4 — Meta-compreensão: O que você começa a pensar sobre isso?" },
    { key: "meta", prompt: "O que você começa a pensar sobre isso?", onUser: () => "Etapa 5 — Exemplo: Traga um exemplo ou imagem que sustente isso." },
    { key: "exemplo", prompt: "Traga um exemplo sustentador.", onUser: () => "Etapa 6 — Síntese: Reúna tudo em 3 linhas." },
    { key: "sintese", prompt: "Reúna em 3 linhas.", onUser: () => "Etapa 7 — Forma Final: Escreva a versão que levaria adiante." },
    { key: "fim", prompt: "Encerrar (e) ou Continuar (c)?", onUser: (t) => t.toLowerCase().startsWith('e') ? finish() : resetTrack(), endScreen: true }
  ]},
  inspirada: { name: "Trilha Inspirado/a (Fluxo Livre)", steps: [] }
};

// --- NAVEGAÇÃO E UI ---

function el(id) { return document.getElementById(id); }
function render(html) { el("app").innerHTML = typeof html === 'string' ? html : ""; if(typeof html !== 'string') el("app").appendChild(html); }

function showWelcome() {
  state.sessionId = "iza-" + Date.now().toString(36);
  state.startedAtISO = new Date().toISOString();
  render(`
    <div class="card">
      <h2>Bem-vindo ao Projeto IZA</h2>
      <p>Uma ancestral digital para fortalecer sua <strong>autoria</strong>.</p>
      <input type="text" id="userName" class="input-area" placeholder="Seu nome">
      <input type="email" id="userEmail" class="input-area" placeholder="Seu e-mail">
      <button class="button" onclick="validateStart()">Começar Teste de Presença</button>
    </div>
  `);
}

window.validateStart = function() {
  state.name = el("userName").value.trim();
  state.email = el("userEmail").value.trim();
  if (!state.name || !state.email) return alert("Preencha nome e e-mail.");
  showPresenceTest();
};

function showPresenceTest() {
  // Simplificado para economia de espaço, segue lógica do .docx [cite: 188]
  render(`<div class="card"><h2>Como quer ser acompanhado hoje?</h2><p>Processando estado de ânimo da IZA...</p><button class="button" onclick="setPresence('B')">Acolhedor</button> <button class="button" onclick="setPresence('C')">Direto</button></div>`);
}

window.setPresence = function(key) {
  state.presenceKey = key; state.presence = PRESENCES[key];
  render(`<div class="card"><h2>IZA: ${state.presence.name}</h2><p>Vou te acompanhar hoje de forma ${state.presence.vibra}.</p><button class="button" onclick="startTrack('iniciante')">4 Etapas</button><button class="button" onclick="startTrack('intermediaria')">7 Etapas</button><button class="button" onclick="startTrack('inspirada')">Fluxo Livre</button></div>`);
};

function startTrack(key) {
  state.trackKey = key; state.stepIndex = 0; state.turns = [];
  if (key === "inspirada") showInspired(); else showStep();
}

function showStep() {
  const track = TRACKS[state.trackKey];
  const step = track.steps[state.stepIndex];
  showPrompt(track.name, step.prompt, (text) => {
    const reply = step.onUser(text);
    pushTurn("user", text); pushTurn("iza", reply);
    showIza(reply, () => {
      if (step.endScreen) return;
      state.stepIndex++; showStep();
    });
  });
}

function showInspired() {
  const prompt = state.inspiredRounds === 0 ? "Sobre o que quer escrever hoje?" : "Continue seu fluxo...";
  showPrompt("Fluxo Livre", prompt, (text) => {
    const reply = izaReply(text);
    state.inspiredRounds++;
    pushTurn("user", text); pushTurn("iza", reply);
    showIza(reply, () => {
      if (state.inspiredRounds >= MIN_INSPIRED_ROUNDS) {
        render(`<div class="card"><h2>IZA</h2><p>Uma ideia parece ter se formado. Quer salvar?</p><button class="button" onclick="finish()">Encerrar e Salvar</button><button class="button" onclick="showInspired()">Continuar</button></div>`);
      } else showInspired();
    });
  });
}

function showPrompt(title, question, cb) {
  render(`<div class="card"><h2>${title}</h2><p>${question.replace(/\n/g, '<br>')}</p><textarea id="txt" class="input-area" rows="5"></textarea><button id="btn" class="button">Enviar</button></div>`);
  const btn = el("btn");
  btn.onclick = () => {
    const val = el("txt").value.trim();
    if(!val) return;
    btn.disabled = true; btn.textContent = "Processando...";
    cb(val);
  };
}

function showIza(text, next) {
  render(`<div class="card"><h2>IZA</h2><div class="message">${text.replace(/\n/g, '<br>')}</div><button class="button" onclick="window.izaNext()">Continuar</button></div>`);
  window.izaNext = next;
}

function pushTurn(role, text) {
  state.turns.push({ role, text, meta: { step: state.stepIndex, t: new Date().toISOString() } });
}

function finish() {
  safeRegister();
  const history = state.turns.map(t => `${t.role === 'iza' ? 'IZA' : 'VOCÊ'}: ${t.text}`).join('\n\n');
  render(`<div class="card"><h2>Percurso Finalizado</h2><p>Registro enviado para ${state.email}.</p><textarea class="input-area" rows="10" readonly>${history}</textarea><button class="button" onclick="location.reload()">Recomeçar</button></div>`);
}

async function safeRegister() {
  if (state.sent) return; state.sent = true;
  const payload = { sessionId: state.sessionId, name: state.name, email: state.email, trackKey: state.trackKey, presenceKey: state.presenceKey, turns: state.turns };
  try { await fetch(WEBAPP_URL, { method: "POST", body: JSON.stringify(payload) }); } catch (e) { console.error(e); }
}

document.addEventListener("DOMContentLoaded", showWelcome);
