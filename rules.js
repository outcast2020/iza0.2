// rules.js - IZA rules with BASE + personality OVERRIDES
// Keeps compatibility with app.js:
// - window.IZA_RULES (array)
// - window.getIZARulesFor(presenceKey, presenceMix)
(function () {
  const RULES_BASE = [
    {
      name: "nao_consigo",
      pattern: /\bn[aã]o\s+consigo\s+(.+)/i,
      responses: [
        "Voce escreveu: nao consigo {0}. O que acontece logo antes dessa trava?",
        "Quando vem nao consigo {0}, o que voce tenta acertar de primeira?",
        "O que deixaria {0} 10% mais possivel hoje?",
        "Se pudesse comecar torto, como comecaria {0} em uma linha?"
      ]
    },
    {
      name: "travado",
      pattern: /\b(trav(ad[oa])|empac(ad[oa])|emperr(ad[oa])|bloque(ad[oa]))\b/i,
      responses: [
        "Voce disse que esta {0}. Onde exatamente: primeira frase, ideia central ou final?",
        "Quando voce fica {0}, o que quer proteger no texto?",
        "Se eu pedisse so uma frase agora, qual seria mesmo assim?"
      ]
    },
    {
      name: "eu_sinto",
      pattern: /\beu\s+(?:me\s+)?sinto\s+(.+)/i,
      responses: [
        "Voce se sente {0}. Onde isso aparece mais forte no que quer escrever?",
        "Se {0} virasse uma cena, o que veriamos primeiro?",
        "Esse {0} te aproxima do texto ou te afasta?"
      ]
    },
    {
      name: "medo",
      pattern: /\b(medo|inseguran[cç]a|vergonha|ansiedade|receio)\b(.+)?/i,
      responses: [
        "Voce mencionou {0}. Reacao de quem pesa mais aqui: leitor, voce ou tema?",
        "Quando aparece {0}, o que voce tenta controlar no texto?",
        "Qual parte voce consegue dizer com coragem em uma linha?"
      ]
    },
    {
      name: "eu_quero",
      pattern: /\beu\s+quero\s+(.+)/i,
      responses: [
        "Voce quer {0}. Como isso fica em uma frase simples?",
        "Qual sinal concreto mostraria que voce alcancou {0}?",
        "Em {0}, o que e essencial e o que e enfeite?"
      ]
    },
    {
      name: "preciso_tenho",
      pattern: /\b(eu\s+preciso|tenho\s+que|devo|precisaria)\s+(.+)/i,
      responses: [
        "Voce disse {0} {1}. Isso vem de voce ou de exigencia externa?",
        "O que acontece se voce nao {1} agora?",
        "Qual parte de {1} e negociavel e qual e inegociavel?"
      ]
    },
    {
      name: "nao_sei",
      pattern: /\b(n[aã]o\s+sei|talvez|acho\s+que|quem\s+sabe|pode\s+ser)\b([\s\S]*)?/i,
      responses: [
        "Voce esta oscilando. Entre quais duas direcoes voce esta dividido(a)?",
        "O que voce sabe com certeza aqui, mesmo que seja pouco?",
        "Qual pergunta, se respondida, destrava essa duvida?"
      ]
    },
    {
      name: "contraste",
      pattern: /\b(mas|por[eé]m|s[oó]\s+que)\b\s*([\s\S]+)/i,
      responses: [
        "Voce abriu um contraste com {0}. O que bate de frente com o que?",
        "Depois do {0}, o que muda de sentido?",
        "Qual lado desse contraste voce quer defender mais?"
      ]
    },
    {
      name: "porque",
      pattern: /\bporque\b([\s\S]+)/i,
      responses: [
        "Voce trouxe um porque. Qual e o nucleo disso em 6 a 10 palavras?",
        "Esse porque explica ou justifica? Qual dos dois?",
        "Que evidencia concreta sustenta esse porque?"
      ]
    },
    {
      name: "definicao",
      pattern: /\b(significa|quer\s+dizer|se\s+trata|[ée]\s+quando|[ée]\s+tipo)\b\s*([\s\S]+)/i,
      responses: [
        "Voce esta definindo algo. Para quem voce esta explicando isso?",
        "Qual exemplo curto prova essa definicao?",
        "Se deixasse em uma frase, qual seria?"
      ]
    },
    {
      name: "pergunta",
      pattern: /\?+\s*$/i,
      responses: [
        "Vou te devolver uma pergunta menor: o que voce quer decidir aqui?",
        "O que torna essa pergunta importante agora?",
        "Qual pergunta mais honesta esta por tras dela?"
      ]
    },
    {
      name: "comparacao",
      pattern: /\b(como|igual|diferente|parece|semelhante|comparar)\b([\s\S]+)/i,
      responses: [
        "Voce comparou coisas. O que essa comparacao precisa revelar?",
        "O que e parecido na superficie e diferente por dentro?",
        "Se tirar a comparacao, qual ideia principal sobra?"
      ]
    },
    {
      name: "tempo",
      pattern: /\b(hoje|amanh[aã]|prazo|correria|r[aá]pido|urgente|semana|m[eê]s|agora)\b([\s\S]*)?/i,
      responses: [
        "Entendi que o tempo pesa. Qual e o minimo aceitavel de texto para hoje?",
        "Se tivesse 12 minutos, o que escreveria primeiro?",
        "O que pode ficar imperfeito agora para voce conseguir andar?"
      ]
    },
    {
      name: "estrutura_texto",
      pattern: /\b(introdu[cç][aã]o|conclus[aã]o|par[aá]grafo|tese|resumo|artigo|cap[ií]tulo|metodologia|resultados)\b([\s\S]*)?/i,
      responses: [
        "Voce citou estrutura ({0}). Qual funcao ela precisa cumprir: situar, provar ou fechar?",
        "Se seu {0} tivesse 3 frases, quais seriam?",
        "Qual ideia nao pode faltar no {0}?"
      ]
    },
    {
      name: "cena_imagem",
      pattern: /\b(cena|imagem|met[aá]fora|s[ií]mbolo|po[eé]tico|descrever|mostrar)\b([\s\S]*)?/i,
      responses: [
        "Se isso virasse uma cena curta, onde acontece e quem aparece primeiro?",
        "Qual objeto simples carrega o sentido do que voce quer dizer?",
        "Em vez de explicar, o que voce pode mostrar em uma acao?"
      ]
    },
    {
      name: "voz",
      pattern: /\b(eu|n[oó]s|a\s+gente|eles|elas|algu[eé]m)\b([\s\S]*)/i,
      responses: [
        "Quem fala aqui e quem fica sem voz? Isso e intencional?",
        "Voce quer falar como eu, nos ou observador? Por que?",
        "Se trocasse o narrador, o que mudaria no sentido?"
      ]
    },
    {
      name: "excesso",
      pattern: /\b(confuso|embolado|muito|demais|exagerado|longo|bagun[cç]ado|perdido)\b([\s\S]*)?/i,
      responses: [
        "Voce percebeu excesso. O que da para cortar sem perder o nucleo?",
        "Se deixasse so 2 frases, quais ficariam?",
        "O que aqui e explicacao e o que e essencial?"
      ]
    },
    {
      name: "absolutos",
      pattern: /\b(sempre|nunca|todo\s+mundo|ningu[eé]m|tudo|nada)\b([\s\S]*)?/i,
      responses: [
        "Voce usou um absoluto ({0}). Isso e literal ou forca de estilo?",
        "Qual excecao voce aceitaria sem destruir sua ideia?",
        "Que exemplo real sustenta esse {0}?"
      ]
    },
    {
      name: "cuidado_diversidade",
      pattern: /\b(negro|preto|branco|racismo|afro|quilomb|ind[ií]gena|lgbt|lgbtqia|gay|l[eé]sbica|trans|travesti|religi[aã]o|candombl[eé]|umbanda|evang[eé]lic|cat[oó]lic|ateu)\b([\s\S]*)?/i,
      responses: [
        "Voce tocou um tema sensivel ({0}). Quer revisar a linguagem com mais precisao e cuidado?",
        "Esse trecho pode ser lido de modos diferentes. Como escrever com menos estigma?",
        "O que voce quer afirmar sem apagar a dignidade de ninguem?"
      ]
    },
    {
      name: "default",
      pattern: /([\s\S]+)/i,
      responses: [
        "Entendi: {0}. Qual e a parte mais viva disso para voce?",
        "Se eu recortar o que voce disse em uma palavra-chave, qual seria?",
        "O que voce quer que fique na cabeca do leitor depois disso?",
        "Qual e o proximo passo: explicar melhor, dar exemplo ou assumir uma tese?"
      ]
    }
  ];

  // Only key responses are overridden; base remains intact.
  const RULE_OVERRIDES = {
    A: {
      default: [
        "Qual palavra-chave desse trecho voce quer sustentar?"
      ],
      nao_sei: [
        "Sem pressa: qual parte voce ja sabe com certeza?"
      ]
    },
    B: {
      eu_sinto: [
        "Obrigado por dividir isso. Quando vem {0}, o que esse tema te pede com mais cuidado?"
      ],
      medo: [
        "To com voce nisso. Se o {0} baixasse um pouco, o que voce conseguiria dizer agora?"
      ],
      default: [
        "Entendi voce. Qual parte desse trecho voce quer cuidar melhor agora?"
      ]
    },
    C: {
      estrutura_texto: [
        "Direto: qual funcao exata do {0} no texto: abrir, provar ou fechar?"
      ],
      porque: [
        "Direto: qual prova concreta sustenta esse porque em uma linha?"
      ],
      default: [
        "Direto: formule sua tese em uma frase objetiva."
      ]
    },
    D: {
      default: [
        "Qual e o nucleo disso?"
      ],
      excesso: [
        "Corte para duas frases. Quais ficam?"
      ],
      pergunta: [
        "O que essa pergunta quer decidir?"
      ]
    },
    H: {
      default: [
        "Tem um nucleo vivo aqui. Qual parte voce quer ampliar primeiro?"
      ],
      nao_consigo: [
        "Voce trouxe uma trava em {0}. Quer acolher o ponto sensivel e definir um proximo passo concreto?"
      ],
      eu_sinto: [
        "Isso tem carga emocional ({0}). O que te acolhe e ao mesmo tempo te move no texto?"
      ],
      contraste: [
        "Ha um contraste aqui. Qual lado pede cuidado e qual lado pede decisao?"
      ],
      estrutura_texto: [
        "Vamos equilibrar forma e verdade: qual funcao o {0} precisa cumprir agora?"
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

  function compileRulesForPersona(personaKey) {
    const ovr = RULE_OVERRIDES[personaKey] || {};
    return RULES_BASE.map((rule) => {
      const overrideResponses = ovr[rule.name] || [];
      const responses = uniqueMerge(overrideResponses, rule.responses, 8);
      return { ...rule, responses };
    });
  }

  function compileRulesForHybrid(presenceMix) {
    const dominant = dominantFromMix(presenceMix);
    const dominantOvr = RULE_OVERRIDES[dominant] || {};
    const hybridOvr = RULE_OVERRIDES.H || {};

    return RULES_BASE.map((rule) => {
      const responses = uniqueMerge(
        hybridOvr[rule.name] || [],
        uniqueMerge(dominantOvr[rule.name] || [], rule.responses, 8),
        8
      );
      return { ...rule, responses };
    });
  }

  function getIZARulesFor(presenceKey, presenceMix) {
    if (presenceKey === "H") {
      return compileRulesForHybrid(presenceMix);
    }
    const persona = resolvePersonaKey(presenceKey, presenceMix);
    return compileRulesForPersona(persona);
  }

  // Compatibility with existing app.js: default is persona A.
  window.IZA_RULES = compileRulesForPersona("A");
  window.IZA_RULES_BASE = RULES_BASE;
  window.IZA_RULE_OVERRIDES = RULE_OVERRIDES;
  window.getIZARulesFor = getIZARulesFor;
})();
