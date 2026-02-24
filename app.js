// Aplicativo IZA

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxOcpjQuBeCsOPWQ5M07OOSJVzvSYOl32lfjhRqWU1vHDxa8CGmly0ykIuY8R7qLg4m/exec";

// Estado global
let state = {
  name: '',
  email: '',
  profile: null,
  track: null,
  trackStep: 0,
  trackData: {},
  conversation: [],
  sent: false,
  lastIZA: "" // <- guarda última fala da IZA para prompts vazios
};

// Perguntas do teste de presença
const testQuestions = [ /* (igual ao seu) */ 
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

// Determinação de perfil e mensagens
function classifyProfile(answers) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  answers.forEach(a => { if (counts[a] !== undefined) counts[a]++; });
  const max = Math.max(counts.A, counts.B, counts.C, counts.D);
  const tied = Object.keys(counts).filter(k => counts[k] === max);
  let profileKey;

  if (tied.length === 1) {
    profileKey = tied[0];
  } else if (tied.length === 2) {
    const combo = tied.sort().join("");
    const tieMap = { "AB": "A", "BC": "B", "CD": "C", "AD": "D" };
    profileKey = tieMap[combo] || tied.sort((a,b) => "ABCD".indexOf(a) - "ABCD".indexOf(b))[0];
  } else {
    profileKey = "A";
  }

  const profiles = {
    A: { name: "IZA Discreta", message: "Vou te acompanhar de forma leve, com perguntas suaves quando fizer sentido. Podemos ajustar isso a qualquer momento." },
    B: { name: "IZA Calorosa", message: "Vou te acompanhar de um jeito próximo e acolhedor, te ajudando a desenrolar as ideias. Podemos ajustar isso a qualquer momento." },
    C: { name: "IZA Firme", message: "Vou te acompanhar com direção clara e estrutura, pra organizar seu texto com objetividade. Podemos ajustar isso a qualquer momento." },
    D: { name: "IZA Minimalista", message: "Vou ficar quase invisível: pouco ruído, mais espaço pra você escrever. Podemos ajustar isso a qualquer momento." }
  };

  return profiles[profileKey];
}

function render(content) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (typeof content === 'string') app.innerHTML = content;
  else app.appendChild(content);
}

// Início: tela de boas-vindas
function showWelcome() {
  state.profile = null;
  state.track = null;
  state.trackStep = 0;
  state.trackData = {};
  state.conversation = [];
  state.sent = false;
  state.lastIZA = "";

  const container = document.createElement('div');
  container.className = 'card';
  container.innerHTML = `
    <h2>Bem-vindo(a) ao Projeto IZA</h2>
    <p>Este aplicativo é inspirado no clássico chatbot ELIZA de 1966 e foi criado para te ajudar a refletir e estruturar suas ideias durante o processo de escrita.</p>
    <p>Antes de começarmos, informe seu nome e e-mail para que possamos enviar o registro da sua escrita.</p>
    <label for="userName"><strong>Seu nome</strong></label><br>
    <input type="text" id="userName" class="input-area" placeholder="Digite seu nome" /><br><br>
    <label for="userEmail"><strong>Seu email</strong></label><br>
    <input type="email" id="userEmail" class="input-area" placeholder="Digite seu email" /><br>
    <button class="button" id="startTest">Fazer teste rápido</button>
  `;

  container.querySelector('#startTest').addEventListener('click', () => {
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    if (!name || !email) {
      alert('Por favor, preencha seu nome e e-mail antes de continuar.');
      return;
    }
    state.name = name;
    state.email = email;
    showTest();
  });

  render(container);
}

// Teste de ajuste de presença
function showTest() {
  state.profile = null;
  const form = document.createElement('div');
  form.className = 'card';
  form.innerHTML = '<h2>Teste de Ajuste de Presença</h2>';

  testQuestions.forEach((q, idx) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'question-block';
    qDiv.innerHTML = `<p><strong>${q.title}:</strong> ${q.question}</p>`;

    const optsDiv = document.createElement('div');
    optsDiv.className = 'options';

    q.options.forEach(opt => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="q${idx}" value="${opt.value}"> ${opt.text}`;
      optsDiv.appendChild(label);
    });

    qDiv.appendChild(optsDiv);
    form.appendChild(qDiv);
  });

  const btn = document.createElement('button');
  btn.className = 'button';
  btn.textContent = 'Concluir';
  btn.disabled = true;

  btn.addEventListener('click', () => {
    const answers = [];
    for (let i=0; i<testQuestions.length; i++) {
      const selected = form.querySelector(`input[name="q${i}"]:checked`);
      answers.push(selected.value);
    }
    const result = classifyProfile(answers);
    state.profile = result.name;
    showProfile(result);
  });

  form.addEventListener('change', () => {
    const allAnswered = testQuestions.every((_, i) => form.querySelector(`input[name="q${i}"]:checked`));
    btn.disabled = !allAnswered;
  });

  form.appendChild(btn);
  render(form);
}

// Mostrar resultado do teste e escolher trilha
function showProfile(profile) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <h2>Resultado</h2>
    <div class="message"><strong>${profile.name}</strong><br>${profile.message}</div>
    <p>Agora escolha a trilha:</p>
    <button class="button" id="trilha1">Trilha Iniciante (4 etapas)</button>
    <button class="button" id="trilha2">Trilha Intermediária (7 etapas)</button>
    <button class="button" id="trilha3">Trilha Inspirado/a (conversa aberta)</button>
    <br><button class="button" id="restartTest" style="background:#a0896a;margin-top:10px;">Refazer teste</button>
  `;

  div.querySelector('#trilha1').addEventListener('click', () => startTrack('iniciante'));
  div.querySelector('#trilha2').addEventListener('click', () => startTrack('intermediaria'));
  div.querySelector('#trilha3').addEventListener('click', () => startTrack('inspirada'));
  div.querySelector('#restartTest').addEventListener('click', showTest);
  render(div);
}

// Iniciar uma trilha
function startTrack(name) {
  state.track = name;
  state.trackStep = 0;
  state.trackData = {};
  state.conversation = [];
  state.sent = false;
  state.lastIZA = "";

  if (name === 'inspirada') {
    state.trackData.entries = [];
  }
  runStep();
}

// Função de espelhamento simples
function mirror(text) {
  const words = text.trim().split(/\s+/);
  const last = words.slice(-5).join(' ');
  return 'Você parece estar falando sobre ' + last + '.';
}

// Perguntas e lógicas das trilhas
const tracks = {
  iniciante: [
    {
      prompt: 'Etapa 1 — Núcleo\nEscreva livremente sobre seu tema.',
      response: (input) => {
        state.trackData.inicio = input;
        return mirror(input) + '\nEm 1–2 frases, qual é o centro disso?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.centro = input;
        return 'É por aqui? (s/n)';
      }
    },
    {
      prompt: '',
      response: (input) => {
        const t = (input || '').trim().toLowerCase();
        if (t.startsWith('n')) {
          // volta para reescrever o centro
          state.trackStep = 1; // mantém no passo do "centro"
          return 'Tudo bem. Reescreva em 1–2 frases qual é o centro disso.';
        }
        return 'Ok, vamos para a próxima etapa. O que está em jogo aqui?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.atrito = input;
        return 'Onde isso se torna mais claro?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.atritoEx = input;
        return 'Traz uma situação concreta.';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.exemplo = input;
        return 'Esse exemplo mostra o quê? O que ele revela sobre sua ideia?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.exemploReflexao = input;
        return 'Escreva uma frase que você quer que fique.';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.fraseFinal = input;
        const summary = 'Início: ' + state.trackData.inicio + '\nFrase final: ' + input;
        return summary + '\nQuer ajustar (a) ou encerrar (e)?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        if (/a/i.test((input||'').trim())) {
          state.trackStep = 0;
          state.trackData = {};
          return 'Vamos ajustar. Recomeçando na etapa 1 — Núcleo.\nEscreva livremente sobre seu tema.';
        } else {
          registerAndFinish();
          return 'Obrigado por usar a IZA. Você pode reiniciar ou escolher outra trilha na tela inicial.';
        }
      }
    }
  ],
  intermediaria: [
    {
      prompt: 'Etapa 1 — Tema\nEm poucas palavras qual é o tema?',
      response: (input) => {
        state.trackData.tema = input;
        return mirror(input) + '\nQue pergunta move esse texto?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.pergunta = input;
        return 'O que está em jogo aqui?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.atrito = input;
        return 'Onde isso aparece de forma concreta?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.atritoEx = input;
        return 'O que você começa a pensar sobre isso?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.meta = input;
        return mirror(input) + '\nTraz um exemplo que sustente isso.';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.exemplo = input;
        return 'Ele confirma ou complica sua ideia?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.exemploReflexao = input;
        return 'Reúna tudo em 3 linhas.';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.sintese = input;
        return 'O que precisa ficar?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.sinteseReflexao = input;
        return 'Escreve a versão que você levaria adiante.';
      }
    },
    {
      prompt: '',
      response: (input) => {
        state.trackData.formaFinal = input;
        const summary = 'Tema: ' + state.trackData.tema + '\nPergunta: ' + state.trackData.pergunta + '\nForma final: ' + input;
        return summary + '\nQuer continuar (c) ou encerrar (e)?';
      }
    },
    {
      prompt: '',
      response: (input) => {
        if (/c/i.test((input||'').trim())) {
          state.trackStep = 0;
          state.trackData = {};
          return 'Vamos recomeçar. Etapa 1 — Tema.\nEm poucas palavras qual é o tema?';
        } else {
          registerAndFinish();
          return 'Obrigado por usar a IZA. Você pode reiniciar ou escolher outra trilha na tela inicial.';
        }
      }
    }
  ],
  inspirada: []
};

// Run step of the current track
function runStep() {
  if (state.track === 'inspirada') {
    showInspired();
    return;
  }
  const steps = tracks[state.track];
  if (state.trackStep >= steps.length) {
    showCompletion();
    return;
  }
  const step = steps[state.trackStep];
  showInteraction(step.prompt, step.response);
}

// Generic interaction handler
function showInteraction(promptText, responseFn) {
  // Se prompt vier vazio, usa a última fala da IZA
  const effectivePrompt = (promptText && promptText.trim())
    ? promptText
    : (state.lastIZA || "Continue.");

  const div = document.createElement('div');
  div.className = 'card';

  const promptP = document.createElement('p');
  promptP.innerHTML = effectivePrompt.replace(/\n/g,'<br>');
  div.appendChild(promptP);

  const textarea = document.createElement('textarea');
  textarea.className = 'input-area';
  textarea.rows = 4;
  div.appendChild(textarea);

  const submit = document.createElement('button');
  submit.className = 'button';
  submit.textContent = 'Enviar';
  submit.addEventListener('click', () => {
    const input = textarea.value.trim();
    if (!input) return;

    state.conversation.push({ prompt: effectivePrompt, user: input });

    const reply = responseFn(input);
    state.lastIZA = reply; // guarda a fala para o próximo prompt vazio

    state.trackStep += 1;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'card';
    msgDiv.innerHTML = '<div class="message">' + reply.replace(/\n/g,'<br>') + '</div>';
    render(msgDiv);

    setTimeout(runStep, 100);
  });

  div.appendChild(submit);
  render(div);
}

// Show completion message
function showCompletion() {
  registerAndFinish();
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = '<h2>Trilha encerrada</h2><p>Você concluiu a trilha. Obrigado por escrever com a IZA!</p><button class="button" id="restart">Voltar ao início</button>';
  div.querySelector('#restart').addEventListener('click', showWelcome);
  render(div);
}

// Trilha inspirada (conversa aberta)
function showInspired() {
  const rounds = state.trackData.rounds || 0;

  if (rounds >= 7) {
    const first = state.trackData.entries[0] || '';
    const last = state.trackData.entries[state.trackData.entries.length-1] || '';

    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = '<h2>Modo Inspirado encerrado</h2><p>Parece que uma ideia está se formando.</p><p>Primeira escrita:<br><em>' + first + '</em></p><p>Última versão:<br><em>' + last + '</em></p><p>Isso pode ser um ponto de partida, quer salvar? (escreva sim ou não)</p>';

    const textarea = document.createElement('textarea');
    textarea.className = 'input-area';
    textarea.rows = 2;
    div.appendChild(textarea);

    const btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = 'Responder';
    btn.addEventListener('click', () => {
      registerAndFinish();
      render('<div class="card"><div class="message">Obrigado por sua resposta. Você pode reiniciar ou escolher outra trilha na tela inicial.</div></div>');
      setTimeout(showWelcome, 2000);
    });

    div.appendChild(btn);
    render(div);
    return;
  }

  const questions = [
    'O que disso você quer desenvolver?',
    'Onde isso aparece concretamente?',
    'O que ainda está implícito?'
  ];

  const question = questions[rounds % questions.length];

  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = '<p>Escreva seu texto livremente:</p>';

  const textarea = document.createElement('textarea');
  textarea.className = 'input-area';
  textarea.rows = 4;
  div.appendChild(textarea);

  const btn = document.createElement('button');
  btn.className = 'button';
  btn.textContent = 'Enviar';
  btn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) return;

    if (!state.trackData.entries) state.trackData.entries = [];
    state.trackData.entries.push(text);

    const reply = mirror(text) + '\n' + question;
    state.lastIZA = reply;

    state.trackData.rounds = (state.trackData.rounds || 0) + 1;

    const replyDiv = document.createElement('div');
    replyDiv.className = 'card';
    replyDiv.innerHTML = '<div class="message">' + reply.replace(/\n/g,'<br>') + '</div>';
    render(replyDiv);

    setTimeout(showInspired, 100);
  });

  div.appendChild(btn);
  render(div);
}

// Envio para Web App via fetch
async function registerAndFinish() {
  if (state.sent) return;
  state.sent = true;

  const log = {
    name: state.name,
    email: state.email,
    profile: state.profile,
    track: state.track,
    conversation: state.conversation,
    ts: new Date().toISOString(),
    page: window.location.href
  };

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log)
    });

    const txt = await res.text();
    console.log("WebApp respondeu:", txt);
  } catch (err) {
    console.error("Falha ao enviar registro:", err);
  }
}

// Inicializa o app
document.addEventListener('DOMContentLoaded', showWelcome);
