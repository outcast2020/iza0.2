// rules.js — IZA rules with BASE + personality OVERRIDES + TRACK OVERRIDES
// Compatibility:
// - window.IZA_RULES (array)
// - window.getIZARulesFor(presenceKey, presenceMix)
// Optional context:
// - window.IZA_TRACK_KEY = "iniciante" | "intermediaria" | "inspirada"
(function () {
  const RULES_BASE = [
    {
      name: "nao_consigo",
      pattern: /\bn[aã]o\s+consigo\s+([^.!?\n\r]+)/i,
      responses: [
        "Você escreveu: “não consigo {0}”. O que acontece logo antes dessa trava?",
        "Quando vem “não consigo {0}”, o que você tenta acertar de primeira?",
        "O que deixaria “{0}” 10% mais possível hoje?",
        "Se pudesse começar torto, como começaria “{0}” em uma linha?"
      ]
    },
    {
      name: "travado",
      pattern: /\b(trav(ad[oa])|empac(ad[oa])|emperr(ad[oa])|bloque(ad[oa]))\b/i,
      responses: [
        "Você disse que está {0}. Onde exatamente: primeira frase, ideia central ou final?",
        "Quando você fica {0}, o que você quer proteger no texto?",
        "Se eu pedisse só uma frase agora, qual seria mesmo assim?"
      ]
    },
    {
      name: "eu_sinto",
      pattern: /\beu\s+(?:me\s+)?sinto\s+([^.!?\n\r]+)/i,
      responses: [
        "Você se sente {0}. Onde isso aparece mais forte no que quer escrever?",
        "Se {0} virasse uma cena, o que veríamos primeiro?",
        "Esse {0} te aproxima do texto ou te afasta?"
      ]
    },
    {
      name: "medo",
      pattern: /\b(medo|inseguran[cç]a|vergonha|ansiedade|receio)\b(?:\s+de\s+([^.!?\n\r]+))?/i,
      responses: [
        "Você mencionou {0}. Reação de quem pesa mais aqui: leitor, você ou tema?",
        "Quando aparece {0}, o que você tenta controlar no texto?",
        "Se o {0} baixasse um pouco, o que você conseguiria dizer agora?",
        "Se for “{0} de {1}”, qual é o menor risco aceitável para escrever hoje?"
      ]
    },
    {
      name: "eu_quero",
      pattern: /\beu\s+quero\s+([^.!?\n\r]+)/i,
      responses: [
        "Você quer {0}. Como isso fica em uma frase simples?",
        "Qual sinal concreto mostraria que você alcançou {0}?",
        "Em {0}, o que é essencial e o que é enfeite?"
      ]
    },
    {
      name: "preciso_tenho",
      pattern: /\b(eu\s+preciso|tenho\s+que|devo|precisaria)\s+([^.!?\n\r]+)/i,
      responses: [
        "Você disse “{0} {1}”. Isso vem de você ou de exigência externa?",
        "O que acontece se você não {1} agora?",
        "Qual parte de “{1}” é negociável e qual é inegociável?"
      ]
    },
    {
      name: "nao_sei",
      pattern: /\b(n[aã]o\s+sei|talvez|acho\s+que|quem\s+sabe|pode\s+ser)\b([\s\S]*)?/i,
      responses: [
        "Você está oscilando. Entre quais duas direções você está dividido(a)?",
        "O que você sabe com certeza aqui, mesmo que seja pouco?",
        "Qual pergunta, se respondida, destrava essa dúvida?"
      ]
    },
    {
      name: "contraste",
      pattern: /\b(?:mas|por[eé]m|s[oó]\s+que)\b\s*([\s\S]+)/i,
      responses: [
        "Você abriu um contraste. O que bate de frente com o quê, exatamente?",
        "Depois do contraste (“{0}”), o que muda de sentido?",
        "Qual lado desse contraste você quer defender mais?"
      ]
    },
    {
      name: "porque",
      pattern: /\bporque\b\s*([\s\S]+)/i,
      responses: [
        "Você trouxe um “porque”. Qual é o núcleo disso em 6 a 10 palavras?",
        "Esse “porque” explica ou justifica? Qual dos dois?",
        "Que evidência concreta sustenta esse “porque”?"
      ]
    },
    {
      name: "definicao",
      pattern: /\b(significa|quer\s+dizer|se\s+trata|[ée]\s+quando|[ée]\s+tipo)\b\s*([\s\S]+)/i,
      responses: [
        "Você está definindo algo. Para quem você está explicando isso?",
        "Qual exemplo curto prova essa definição?",
        "Se deixasse em uma frase, qual seria?"
      ]
    },
    {
      name: "pergunta",
      pattern: /\?+\s*$/i,
      responses: [
        "Vou te devolver uma pergunta menor: o que você quer decidir aqui?",
        "O que torna essa pergunta importante agora?",
        "Qual pergunta mais honesta está por trás dela?"
      ]
    },
    {
      name: "comparacao",
      pattern: /\b(como|igual|diferente|parece|semelhante|comparar)\b([\s\S]+)/i,
      responses: [
        "Você comparou coisas. O que essa comparação precisa revelar?",
        "O que é parecido na superfície e diferente por dentro?",
        "Se tirar a comparação, qual ideia principal sobra?"
      ]
    },
    {
      name: "tempo",
      pattern: /\b(hoje|amanh[aã]|prazo|correria|r[aá]pido|urgente|semana|m[eê]s|agora)\b([\s\S]*)?/i,
      responses: [
        "Entendi que o tempo pesa. Qual é o mínimo aceitável de texto para hoje?",
        "Se tivesse 12 minutos, o que escreveria primeiro?",
        "O que pode ficar imperfeito agora para você conseguir andar?"
      ]
    },
    {
      name: "estrutura_texto",
      pattern: /\b(introdu[cç][aã]o|conclus[aã]o|par[aá]grafo|tese|resumo|artigo|cap[ií]tulo|metodologia|resultados)\b([\s\S]*)?/i,
      responses: [
        "Você citou estrutura ({0}). Qual função ela precisa cumprir: situar, provar ou fechar?",
        "Se seu {0} tivesse 3 frases, quais seriam?",
        "Qual ideia não pode faltar no {0}?"
      ]
    },
    {
      name: "cena_imagem",
      pattern: /\b(cena|imagem|met[aá]fora|s[ií]mbolo|po[eé]tico|descrever|mostrar)\b([\s\S]*)?/i,
      responses: [
        "Se isso virasse uma cena curta, onde acontece e quem aparece primeiro?",
        "Qual objeto simples carrega o sentido do que você quer dizer?",
        "Em vez de explicar, o que você pode mostrar em uma ação?"
      ]
    },
    {
      name: "voz",
      pattern: /\b(voz|narrador|narrativa|ponto\s+de\s+vista|1ª\s+pessoa|3ª\s+pessoa|tom\s+do\s+texto)\b([\s\S]*)?/i,
      responses: [
        "Qual voz você quer: confessional, analítica ou testemunhal?",
        "Se mudar o narrador, o que muda no sentido?",
        "Quem está falando aqui — e quem fica sem voz?"
      ]
    },
    {
      name: "excesso",
      pattern: /\b(confuso|embolado|muito|demais|exagerado|longo|bagun[cç]ado|perdido)\b([\s\S]*)?/i,
      responses: [
        "Você percebeu excesso. O que dá para cortar sem perder o núcleo?",
        "Se deixasse só 2 frases, quais ficariam?",
        "O que aqui é explicação — e o que é essencial?"
      ]
    },
    {
      name: "absolutos",
      pattern: /\b(sempre|nunca|todo\s+mundo|ningu[eé]m|tudo|nada)\b([\s\S]*)?/i,
      responses: [
        "Você usou um absoluto ({0}). Isso é literal ou força de estilo?",
        "Qual exceção você aceitaria sem destruir sua ideia?",
        "Que exemplo real sustenta esse {0}?"
      ]
    },
    {
      name: "cuidado_diversidade",
      pattern: /\b(negro|preto|branco|racismo|afro|quilomb|ind[ií]gena|lgbt|lgbtqia|gay|l[eé]sbica|trans|travesti|religi[aã]o|candombl[eé]|umbanda|evang[eé]lic|cat[oó]lic|ateu)\b([\s\S]*)?/i,
      responses: [
        "Você tocou um tema sensível ({0}). Quer revisar a linguagem com mais precisão (sem generalizar)?",
        "Esse trecho pode ser lido de modos diferentes. Como escrever com menos estigma e mais clareza?",
        "O que você quer afirmar sem apagar a dignidade de ninguém?"
      ]
    },
    {
      name: "default",
      pattern: /([\s\S]+)/i,
      responses: [
        "Entendi: {0}. Qual é a parte mais viva disso para você?",
        "Se eu recortar o que você disse em uma palavra-chave, qual seria?",
        "O que você quer que fique na cabeça do leitor depois disso?",
        "Qual é o próximo passo: explicar melhor, dar exemplo ou assumir uma tese?"
      ]
    }
  ];

  // Personality overrides (como você já tinha)
  const RULE_OVERRIDES = {
    A: {
      default: ["Qual palavra-chave desse trecho você quer sustentar?"],
      nao_sei: ["Sem pressa: qual parte você já sabe com certeza?"]
    },
    B: {
      eu_sinto: ["Obrigado por dividir isso. Quando vem {0}, o que esse tema te pede com mais cuidado?"],
      medo: ["Tô com você nisso. Se o {0} baixasse um pouco, o que você conseguiria dizer agora?"],
      default: ["Entendi você. Qual parte desse trecho você quer cuidar melhor agora?"]
    },
    C: {
      estrutura_texto: ["Direto: qual função exata do {0} no texto: abrir, provar ou fechar?"],
      porque: ["Direto: qual prova concreta sustenta esse “porque” em uma linha?"],
      excesso: ["Direto: corte para 2 frases. Quais ficam?"],
      default: ["Direto: formule sua tese em uma frase objetiva."]
    },
    D: {
      default: ["Qual é o núcleo disso?"],
      excesso: ["Corte para duas frases. Quais ficam?"],
      pergunta: ["O que essa pergunta quer decidir?"]
    },
    H: {
      default: ["Tem um núcleo vivo aqui. Qual parte você quer ampliar primeiro?"],
      nao_consigo: ["Você trouxe uma trava em “{0}”. Quer acolher o ponto sensível e definir um próximo passo concreto?"],
      eu_sinto: ["Isso tem carga emocional ({0}). O que te acolhe e, ao mesmo tempo, te move no texto?"],
      contraste: ["Há um contraste aqui. Qual lado pede cuidado e qual lado pede decisão?"],
      estrutura_texto: ["Vamos equilibrar forma e verdade: qual função o {0} precisa cumprir agora?"]
    }
  };

  // TRACK overrides: injeta “microcomandos” por trilha (sem esmagar o BASE)
  const RULE_TRACK_OVERRIDES = {
    iniciante: {
      default: [
        "Traga um detalhe concreto: lugar + alguém + um gesto.",
        "Se fosse uma cena de 8 segundos, o que aparece?"
      ],
      cena_imagem: [
        "Cena curta: onde você está, quem está com você, e qual gesto acontece?",
        "Escolha um objeto simples e deixe ele carregar o sentido."
      ],
      travado: [
        "Se estiver travado, escreva só a imagem: um lugar + um gesto."
      ],
      porque: [
        "Em vez de explicar, mostre em 1 exemplo pequeno."
      ]
    },
    intermediaria: {
      default: [
        "Escreva 1 frase de tese. Depois, 1 evidência concreta.",
        "Qual é a afirmação central — e qual prova sustenta?"
      ],
      estrutura_texto: [
        "Defina função + conteúdo: o que entra e o que sai do {0}?",
        "Se o {0} tiver 3 frases: contexto → tese → prova. Quais são?"
      ],
      porque: [
        "Transforme o “porque” em evidência: dado, citação ou exemplo (1 linha)."
      ],
      excesso: [
        "Regra de corte: 2 frases (tese + prova)."
      ]
    },
    inspirada: {
      default: [
        "Segue no fluxo: escreve mais um pouco sem se vigiar.",
        "Coloque ritmo: uma frase curta, outra longa."
      ],
      eu_sinto: [
        "Deixe {0} virar imagem (não explique). O que você vê?",
        "Qual som/cheiro/cor combina com {0}?"
      ],
      comparacao: [
        "A comparação pode virar metáfora: qual imagem segura o sentido?"
      ],
      estrutura_texto: [
        "Sem formatar demais: guarda o eixo e segue no fluxo."
      ]
    }
  };

  function uniqueMerge(primary, secondary, maxLen) {
    const out = [];
    for (const item of (primary || []).concat(secondary || [])) {
      const v = String(item || "").trim();
      if (!v || out.includes(v)) continue;
      out.push(v);
      if (out.length >= maxLen) break;
    }
    return out;
  }

  function dominantFromMix(mix) {
    if (!mix || typeof mix !== "object") return "A";
    const keys = ["A", "B", "C", "D"];
    let best = "A";
    let bestV = -1;
    for (const k of keys) {
      const v = Number(mix[k] || 0);
      if (v > bestV) {
        best = k;
        bestV = v;
      }
    }
    return best;
  }

  function resolvePersonaKey(presenceKey, presenceMix) {
    if (presenceKey === "H") return dominantFromMix(presenceMix);
    return ["A", "B", "C", "D"].includes(presenceKey) ? presenceKey : "A";
  }

  function resolveTrackKey() {
    const t = (window.IZA_TRACK_KEY || "").toLowerCase();
    if (t === "iniciante" || t === "intermediaria" || t === "inspirada") return t;
    return null;
  }

  function compileRules(personaKey, trackKey) {
    const ovr = RULE_OVERRIDES[personaKey] || {};
    const tov = (trackKey && RULE_TRACK_OVERRIDES[trackKey]) || {};

    return RULES_BASE.map((rule) => {
      // ordem: TRACK -> PERSONA -> BASE (pra trilha “puxar” o estilo sem perder compat)
      const responses = uniqueMerge(
        tov[rule.name] || [],
        uniqueMerge(ovr[rule.name] || [], rule.responses, 8),
        8
      );
      return { ...rule, responses };
    });
  }

  function compileRulesForHybrid(presenceMix, trackKey) {
    const dominant = dominantFromMix(presenceMix);
    const dominantOvr = RULE_OVERRIDES[dominant] || {};
    const hybridOvr = RULE_OVERRIDES.H || {};
    const tov = (trackKey && RULE_TRACK_OVERRIDES[trackKey]) || {};

    return RULES_BASE.map((rule) => {
      const responses = uniqueMerge(
        // TRACK primeiro, depois H, depois dominante, depois base
        tov[rule.name] || [],
        uniqueMerge(
          hybridOvr[rule.name] || [],
          uniqueMerge(dominantOvr[rule.name] || [], rule.responses, 8),
          8
        ),
        8
      );
      return { ...rule, responses };
    });
  }

  function getIZARulesFor(presenceKey, presenceMix) {
    const trackKey = resolveTrackKey();

    if (presenceKey === "H") {
      return compileRulesForHybrid(presenceMix, trackKey);
    }
    const persona = resolvePersonaKey(presenceKey, presenceMix);
    return compileRules(persona, trackKey);
  }

  // Default (compat): A sem trilha
  window.IZA_RULES = compileRules("A", null);
  window.IZA_RULES_BASE = RULES_BASE;
  window.IZA_RULE_OVERRIDES = RULE_OVERRIDES;
  window.IZA_RULE_TRACK_OVERRIDES = RULE_TRACK_OVERRIDES;
  window.getIZARulesFor = getIZARulesFor;
})();
