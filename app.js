// ==========================================
// IZA no Cordel 2.0 — app.js (Motor de Compreensão Linguística)
// Foco: Reconhecimento de Funções Verbais, Substantivas e Adjetivas
// ==========================================

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx2CDkA7TVIFNu8dsnMgEg2_WjYq8-Yntu_NoV89UE8rVdioFJZbT6cjbGCDNP7brrk/exec";
const MIN_INSPIRED_ROUNDS = 7;

const state = {
  name: "", email: "", presenceKey: null, presence: null, trackKey: null,
  stepIndex: 0, inspiredRounds: 0, sent: false, sessionId: null,
  startedAtISO: null, pageURL: "", lastIzaText: "", turns: []
};

// --- CONFIGURAÇÃO DE PRESENÇAS ---
const PRESENCES = {
  A: { key: "A", name: "IZA Discreta", vibra: "leve", confirmation: (f) => `“${f}...” Parece um ponto de partida honesto. Podemos seguir por aqui? (s/n)` },
  B: { key: "B", name: "IZA Calorosa", vibra: "acolhedora", confirmation: (f) => `Ao ler “${f}...”, sinto que você toca em algo essencial. Faz sentido continuar nessa direção? (s/n)` },
  C: { key: "C", name: "IZA Firme", vibra: "direta", confirmation: (f) => `Você definiu: “${f}...”. Este é o centro do rascunho? (s/n)` },
  D: { key: "D", name: "IZA Minimalista", vibra: "ausente", confirmation: (f) => `“${f}...” Segue? (s/n)` }
};

// --- MOTOR DE LINGUAGEM ELIZA-LIKE ---

function swapPronouns(text) {
  const map = {
    "eu": "você", "meu": "seu", "minha": "sua", "meus": "seus", "minhas": "suas",
    "comigo": "com você", "estou": "está", "sou": "é", "me": "te", "fui": "foi",
    "tenho": "tem", "você": "eu", "seu": "meu", "sua": "minha"
  };
  return text.toLowerCase().split(/\s+/).map(w => map[w] || w).join(" ");
}

function getFragment(text, words = 6) {
  return swapPronouns(text.split(' ').slice(0, words).join(' '));
}

// 12 Regras de Decomposição (Foco em Ações, Temas e Estados)
const IZA_SCRIPT = [
  { key: /\b(fazer|fiz|tentei|criei|escrevi|busco|quero)\b/i, // FUNÇÃO VERBAL (AÇÃO)
    decomps: [{ re: /.*(?:fiz|tentei|criei|escrevi|quero) (.*)/i, reasmb: ["O que motivou esse seu agir sobre '{1}'?", "Ao buscar '{1}', qual imagem surgiu primeiro?", "Como essa ação de '{1}' se transforma em verso?"] }] },
  { key: /\b(triste|feliz|difícil|confuso|importante|belo|feio)\b/i, // FUNÇÃO ADJETIVA (ESTADO)
    decomps: [{ re: /.* (triste|feliz|difícil|confuso|importante|belo|feio) (?:porque|pois)? (.*)/i, reasmb: ["O que torna '{2}' algo tão '{1}'?", "Se '{2}' deixasse de ser '{1}', o que sobraria?", "Como esse estado de ser '{1}' aparece na sua escrita?"] }] },
  { key: /\b(família|casa|trabalho|rua|mundo|tempo|vida)\b/i, // FUNÇÃO SUBSTANTIVA (TEMA)
    decomps: [{ re: /.*(família|casa|trabalho|rua|mundo|tempo|vida)(.*)/i, reasmb: ["Qual detalhe concreto de '{1}' você quer salvar no texto?", "Como '{1}' influencia o ritmo do que você escreve?", "O que em '{1}' ainda está guardado e não foi dito?"] }] },
  { key: /\b(sinto|sentir|sentimento|dor|alegria)\b/i, // AFETOS
    decomps: [{ re: /.*(?:sinto|sentir) (.*)/i, reasmb: ["Onde esse sentir '{1}' se localiza na sua história?", "Essa emoção sobre '{1}' ajuda ou trava sua autoria?", "Consegue descrever '{1}' sem usar o nome do sentimento?"] }] },
  { key: /\b(não posso|não consigo|limite|bloqueio)\b/i, // IMPEDIMENTOS
    decomps: [{ re: /.*(?:não consigo|não posso) (.*)/i, reasmb: ["Esse limite de '{1}' é real ou uma precaução sua?", "O que mudaria no texto se você pudesse '{1}'?", "Vamos olhar para o outro lado de '{1}': o que é possível?"] }] },
  { key: /\b(sempre|nunca|todo|ninguém|todos)\b/i, // GENERALIZAÇÕES
    decomps: [{ re: /.*(sempre|nunca|ninguém)(.*)/i, reasmb: ["O que faz de '{1}' algo tão absoluto para você?", "Pense em uma exceção para '{1} {2}'. Como ela soaria?", "Onde esse '{1}' se manifesta hoje, agora?"] }] },
  { key: /\b(talvez|acho|parece|quem sabe)\b/i, // INCERTEZA
    decomps: [{ re: /.*(?:talvez|acho|parece) (.*)/i, reasmb: ["Se você tivesse certeza sobre '{1}', o texto seria o mesmo?", "O que sustenta essa dúvida sobre '{1}'?", "A incerteza sobre '{1}' pode ser um lugar de criação?"] }] },
  { key: /\b(você|iza|máquina|computador)\b/i, // SOBRE A IZA
    decomps: [{ re: /.*você (.*)/i, reasmb: ["Meu papel é espelhar seu pensamento. O que '{1}' revela sobre você?", "Por que você se preocupa se eu '{1}'?", "Eu estou aqui para a sua autoria. Como isso ajuda em '{1}'?"] }] },
  { key: /\b(porque|pois|por causa)\b/i, // EXPLICAÇÃO
    decomps: [{ re: /.*porque (.*)/i, reasmb: ["Essa razão — '{1}' — é a única possível?", "Se não fosse por '{1}', que outra causa existiria?", "Como essa explicação fortalece sua voz no papel?"] }] },
  { key: /\b(sonho|desejo|imagino|futuro)\b/i, // PROJEÇÃO
    decomps: [{ re: /.*(?:sonho|imagino) (.*)/i, reasmb: ["Qual é a cor ou o som desse '{1}'?", "Como esse '{1}' projeta quem você é hoje?", "O que '{1}' traz de novo para sua poesia?"] }] },
  { key: /\b(atrito|luta|conflito|problema)\b/i, // TENSÃO
    decomps: [{ re: /.*(?:problema|conflito) (.*)/i, reasmb: ["Qual é o coração desse '{1}'?", "O conflito em '{1}' gera movimento ou estagnação?", "O que está em risco quando você encara '{1}'?"] }] },
  { key: /(.*)/i, // FALLBACK
    decomps: [{ re: /(.*)/i, reasmb: ["Pode desenvolver mais essa ideia?", "Onde isso aparece concretamente?", "O que aqui ainda está implícito?", "Como isso soaria se fosse uma confissão?"] }] }
];

function izaReply(userText) {
  const p = state.presence || PRESENCES.A;
  const t = (userText || "").trim();
  if (!t) return p.confirmation("O silêncio também escreve");

  for (const rule of IZA_SCRIPT) {
    if (rule.key.test(t)) {
      const d = rule.decomps[0];
      const match = t.match(d.re);
      if (match) {
        const fragment = swapPronouns(match[1] || match[0]);
        let reply = d.reasmb[Math.floor(Math.random() * d.reasmb.length)].replace("{1}", fragment).replace("{2}", match[2] ? swapPronouns(match[2]) : "");
        return reply.trim();
      }
    }
  }
}

// --- TRILHAS E UI ---

const TRACKS = {
  iniciante: { name: "Trilha Iniciante (4 etapas)", steps: [
    { key: "nucleo", prompt: "Etapa 1 — Núcleo: Escreva livremente sobre seu tema.", 
      onUser: t => izaReply(t) + "\n\nDiante disso, qual é o centro da sua ideia em 1 frase?" },
    { key: "confirmacao", prompt: "Qual o centro?", onUser: t => state.presence.confirmation(getFragment(t)) },
    { key: "atrito", prompt: "Etapa 2 — Atrito: O que está em jogo (conflito ou desejo)?", onUser: t => `Onde esse “${getFragment(t)}” se torna mais visível?` },
    { key: "exemplo", prompt: "Traga uma cena concreta.", onUser: t => `O que esse detalhe de “${getFragment(t)}” revela sobre seu tema?` },
    { key: "frase_final", prompt: "Escreva o verso ou frase que não pode faltar.", onUser: () => "Quer ajustar (a) ou encerrar (e)?" },
    { key: "fim", prompt: "Ajustar ou Encerrar?", onUser: t => t.toLowerCase().startsWith('e') ? finish() : startTrack('iniciante'), endScreen: true }
  ]}
};

// Navegação (Funções auxiliares simplificadas para o exemplo)
function el(id) { return document.getElementById(id); }
function render(html) { el("app").innerHTML = html; }

function showWelcome() {
  state.sessionId = "iza-" + Date.now().toString(36);
  render(`
    <div class="card">
      <h2>IZA no Cordel 2.0</h2>
      <p>Uma ancestral que ajuda a fortalecer sua <strong>autoria</strong>[cite: 41, 46].</p>
      <input type="text" id="userName" class="input-area" placeholder="Seu nome">
      <input type="email" id="userEmail" class="input-area" placeholder="Seu e-mail">
      <button class="button" onclick="validateStart()">Começar</button>
    </div>
  `);
}

window.validateStart = function() {
  state.name = el("userName").value.trim();
  state.email = el("userEmail").value.trim();
  if (state.name && state.email) showPresenceTest();
};

function showPresenceTest() {
  render(`
    <div class="card">
      <h2>Como quer ser acompanhado?</h2>
      <button class="button" onclick="setPresence('B')">IZA Calorosa (Acolhedora)</button>
      <button class="button" onclick="setPresence('C')">IZA Firme (Direta)</button>
    </div>
  `);
}

window.setPresence = function(key) {
  state.presenceKey = key; state.presence = PRESENCES[key];
  startTrack('iniciante');
};

function startTrack(key) {
  state.trackKey = key; state.stepIndex = 0; state.turns = [];
  showStep();
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

function showPrompt(title, question, cb) {
  render(`<div class="card"><h2>${title}</h2><p>${question.replace(/\n/g, '<br>')}</p><textarea id="txt" class="input-area" rows="5"></textarea><button id="btn" class="button">Enviar</button></div>`);
  el("btn").onclick = () => cb(el("txt").value.trim());
}

function showIza(text, next) {
  render(`<div class="card"><h2>IZA</h2><div class="message">${text.replace(/\n/g, '<br>')}</div><button class="button" onclick="izaNext()">Continuar</button></div>`);
  window.izaNext = next;
}

function pushTurn(role, text) {
  state.turns.push({ role, text, meta: { t: new Date().toISOString() } });
}

function finish() {
  safeRegister();
  render(`<div class="card"><h2>Fim do Percurso</h2><p>Registro enviado para ${state.email}[cite: 19].</p><button class="button" onclick="location.reload()">Novo Texto</button></div>`);
}

async function safeRegister() {
  if (state.sent) return; state.sent = true;
  const payload = { sessionId: state.sessionId, name: state.name, email: state.email, turns: state.turns };
  try { await fetch(WEBAPP_URL, { method: "POST", body: JSON.stringify(payload) }); } catch (e) { console.error(e); }
}

document.addEventListener("DOMContentLoaded", showWelcome);
