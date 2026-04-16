// rules.js — IZA rules with BASE + personality OVERRIDES + TRACK OVERRIDES
// Compatibility:
// - window.IZA_RULES (array)
// - window.getIZARulesFor(presenceKey, presenceMix)
// Optional context:
// - window.IZA_TRACK_KEY = "iniciante" | "intermediaria" | "inspirada"
(function () {
  const ION_SOCRATIC_MARKERS = [
    {
      key: "linguagem_mundo",
      label: "linguagem e mundo",
      markers: ["linguagem", "palavra", "idioma", "discurso", "nome", "mundo", "unidade", "coexistencia", "comum"]
    },
    {
      key: "saber_interpretar",
      label: "saber e interpretação",
      markers: ["compreender", "entender", "saber", "conhecer", "interpretar", "explicar", "sentido", "significado", "verdade"]
    },
    {
      key: "arte_tecnica",
      label: "arte, técnica e juízo",
      markers: ["arte", "tecnica", "oficio", "metodo", "criterio", "julgar", "julgamento", "pratica", "escuta", "interprete"]
    },
    {
      key: "poesia_inspiracao",
      label: "poesia e inspiracao",
      markers: ["poeta", "poesia", "verso", "rapsodo", "homero", "musa", "inspiracao", "entusiasmo", "dom"]
    },
    {
      key: "alteridade",
      label: "alteridade e singularidade",
      markers: ["outro", "alteridade", "singularidade", "convivencia", "presenca", "limite"]
    },
    {
      key: "totalidade_regra",
      label: "todo, parte e regra",
      markers: ["cada", "todo", "todos", "toda", "regra", "geral", "caso", "particular", "unidade"]
    },
    {
      key: "conflito_distincao",
      label: "conflito e distinção",
      markers: ["conflito", "atrito", "tensao", "opostos", "distincao", "diferenca", "contradicao", "paradoxo", "logica"]
    },
    {
      key: "misterio_limite",
      label: "mistério e limite",
      markers: ["misterio", "porta", "entrada", "limite", "furo", "abismo", "silencio", "calar"]
    }
  ];

  const RULES_BASE = [
    {
      name: "socratic_linguagem_mundo",
      pattern: /\b(?:linguagem|palavra|idioma|discurso)\b[\s\S]{0,90}\b(?:mundo|unidade|coexist[eê]ncia|co-exist[eê]ncia|comum|particularidade|paradoxo|contradic|logica)\b/i,
      responses: [
        "Se cada linguagem abre um mundo, o que ainda permanece comum entre esses mundos?",
        "Quando você fala em linguagem, está pensando numa ponte ou num limite?",
        "A unidade que você busca está nas palavras, ou no uso que fazemos delas?"
      ],
      memory: [
        "Se isso vale para toda linguagem, vale também para o silêncio?"
      ],
      styleFamily: "socratic",
      markerKeys: ["linguagem_mundo", "totalidade_regra"],
      responseMode: "direct",
      priority: 3.35
    },
    {
      name: "socratic_saber_interpretar",
      pattern: /\b(?:compreender|entender|saber|conhecer|interpretar|explicar)\b[\s\S]{0,80}\b(?:mist[eé]rio|linguagem|arte|poesia|singularidade|alteridade|verdade|mundo|tema)\b/i,
      responses: [
        "Você diria que compreender isso é o mesmo que saber explicá-lo?",
        "Falar bem disso prova conhecimento, ou apenas familiaridade?",
        "O que aqui é interpretação, e o que aqui seria conhecimento?"
      ],
      styleFamily: "socratic",
      markerKeys: ["saber_interpretar"],
      responseMode: "direct",
      priority: 3.15
    },
    {
      name: "socratic_paradoxo",
      pattern: /\b(?:paradoxo|paradoxos|contradic|logica|logicas|particularidade)\b/i,
      responses: [
        "O que faz disso uma contradição real, e não apenas dois pontos de vista?",
        "Você está descrevendo a coisa, ou a dificuldade de pensá-la?",
        "Essas logicas convivem no mesmo plano, ou cada uma vale em um contexto?"
      ],
      styleFamily: "socratic",
      markerKeys: ["conflito_distincao", "linguagem_mundo"],
      responseMode: "direct",
      priority: 3.11
    },
    {
      name: "socratic_arte_tecnica",
      pattern: /\b(?:arte|tecnica|t[eé]cnica|of[ií]cio|dom|inspira[cç][aã]o|entusiasmo)\b/i,
      responses: [
        "Isso lhe parece arte, técnica ou impulso?",
        "Quem julgaria melhor isso: quem prática, quem interpreta ou quem escuta?",
        "Se isso é uma técnica, por que não aparece do mesmo modo em todos os casos?"
      ],
      styleFamily: "socratic",
      markerKeys: ["arte_tecnica", "poesia_inspiracao"],
      responseMode: "direct",
      priority: 3.05
    },
    {
      name: "socratic_alteridade",
      pattern: /\b(?:alteridade|outro|singularidade|coexist[eê]ncia|conviv[eê]ncia|limita)\b/i,
      responses: [
        "O outro limita sua singularidade, ou a torna visivel?",
        "Sem o outro, sua singularidade seria menos ameaçada ou menos nítida?",
        "Você quer proteger sua singularidade, ou compreendê-la melhor diante do outro?"
      ],
      memory: [
        "Se o outro desaparecesse, o conflito desapareceria junto?"
      ],
      styleFamily: "socratic",
      markerKeys: ["alteridade", "conflito_distincao"],
      responseMode: "direct",
      priority: 3.12
    },
    {
      name: "socratic_totalidade",
      pattern: /\b(?:cada|todo|toda|todos|todas)\b[\s\S]{0,80}\b(?:linguagem|mundo|arte|ser|palavra|vers[aã]o|unidade)\b/i,
      responses: [
        "Se isso vale para cada caso, vale também para o todo?",
        "O que muda quando você passa do caso particular para a regra geral?",
        "Essa afirmação vale sempre, ou apenas deste ponto de vista?"
      ],
      styleFamily: "socratic",
      markerKeys: ["totalidade_regra", "linguagem_mundo"],
      responseMode: "direct",
      priority: 3.08
    },
    {
      name: "socratic_conflito",
      pattern: /\b(?:conflito|atrito|impasse|choque|tens[aã]o)\b/i,
      responses: [
        "Esse conflito opoe duas ideias, dois desejos ou dois modos de nomear a mesma coisa?",
        "Se você tivesse de separar os dois polos do conflito, quais seriam?",
        "O conflito está no objeto, ou no modo como você se coloca diante dele?"
      ],
      styleFamily: "socratic",
      markerKeys: ["conflito_distincao", "alteridade"],
      responseMode: "direct",
      priority: 3.06
    },
    {
      name: "socratic_misterio",
      pattern: /\b(?:mist[eé]rio|porta\s+de\s+entrada|entrada)\b/i,
      responses: [
        "Você quer dissolver o mistério, ou apenas encontrar uma entrada justa para ele?",
        "Se o mistério permanecesse, isso invalidaria a busca?",
        "Você quer explicar esse mistério, ou aprender a se orientar dentro dele?"
      ],
      styleFamily: "socratic",
      markerKeys: ["misterio_limite", "saber_interpretar"],
      responseMode: "direct",
      priority: 3.1
    },
    {
      name: "socratic_silencio",
      pattern: /\b(?:calar|sil[eê]ncio|calar-se)\b/i,
      responses: [
        "Calar resolve o conflito, ou apenas impede que ele apareca?",
        "Se você cala, o problema desaparece ou apenas muda de forma?",
        "O silêncio aqui protege algo, ou renuncia a algo?"
      ],
      styleFamily: "socratic",
      markerKeys: ["misterio_limite", "conflito_distincao"],
      responseMode: "direct",
      priority: 3.07
    },
    {
      name: "generalizacao_grupo",
      pattern: /\b(?:homens?|mulheres?|pessoas?|men|women|people)\b[\s\S]{0,40}\b(?:s[aã]o|are)\b[\s\S]{0,30}\b(?:todos?\s+iguais|iguais|all alike|the same)\b/i,
      responses: [
        "Em que sentido?",
        "De que maneira?"
      ],
      responseMode: "direct",
      priority: 3.4
    },
    {
      name: "exemplo_especifico",
      pattern: /\b(?:sempre|always)\b[\s\S]{0,80}\b(?:alguma\s+coisa|algo|something|coisa)\b/i,
      responses: [
        "Você consegue pensar em um exemplo específico?",
        "Que exemplo concreto vem a sua mente?"
      ],
      responseMode: "direct",
      priority: 3.1
    },
    {
      name: "parceiro_trouxe_aqui",
      pattern: /\b(?:meu|minha|my)\s+(namorad[oa]|companheir[oa]|boyfriend|girlfriend)\b[\s\S]{0,40}\b(?:me\s+fez|me\s+mandou|me\s+trouxe|made me|brought me|made me come)\b[\s\S]{0,20}\b(?:vir|aqui|here)?/i,
      responses: [
        "Essa pessoa fez você vir aqui?",
        "Seu companheiro fez você vir aqui?"
      ],
      memory: [
        "Essa relação parece importante. O que mais ela move em você?"
      ],
      responseMode: "direct",
      priority: 3.15
    },
    {
      name: "estado_depressivo",
      pattern: /\b(deprimid[oa]|depressed|trist[ea]|unhappy|infeliz)\b(?:[\s\S]{0,24}\b(?:boa\s+parte\s+do\s+tempo|much\s+of\s+the\s+time|o\s+tempo\s+todo)\b)?/i,
      responses: [
        "Sinto muito em saber disso.",
        "Você acha que vir aqui pode ajudar você a se sentir diferente?"
      ],
      responseMode: "direct",
      priority: 2.85
    },
    {
      name: "pedido_ajuda",
      pattern: /\b(?:preciso|need)\b[\s\S]{0,20}\b(?:ajuda|help)\b/i,
      responses: [
        "O que significaria para você conseguir alguma ajuda?",
        "Se você recebesse ajuda, o que mudaria primeiro?"
      ],
      memory: [
        "Como seria, para você, ter ajuda de um jeito que realmente importasse?"
      ],
      responseMode: "direct",
      priority: 3.05
    },
    {
      name: "familia_geral",
      pattern: /\b(?:fam[ií]lia|family)\b/i,
      responses: [
        "Fale mais sobre a sua família.",
        "Quem na sua família parece mais presente nisso?"
      ],
      memory: [
        "Quem mais, na sua família, aparece quando você pensa nisso?"
      ],
      responseMode: "direct",
      priority: 2.95
    },
    {
      name: "parentesco_geral",
      pattern: /\b(?:m[aã]e|pai|mother|father|irma[oa]|brother|sister)\b/i,
      responses: [
        "Fale mais sobre a sua família.",
        "Quem mais da sua família entra nisso?"
      ],
      responseMode: "direct",
      priority: 2.7
    },
    {
      name: "mae_cuida",
      pattern: /\b(?:minha|my)\s+(?:m[aã]e|mother)\b[\s\S]{0,40}\b(?:cuida|toma\s+conta|takes\s+care)\b[\s\S]{0,20}\b(?:de\s+mim|de\s+me|of\s+me|me)\b/i,
      responses: [
        "Quem mais na sua família cuida de você?"
      ],
      memory: [
        "Fale mais sobre a sua família."
      ],
      responseMode: "direct",
      priority: 3.2
    },
    {
      name: "pai_curto",
      pattern: /^(?:meu|minha|my)?\s*(pai|father)\.?$/i,
      responses: [
        "Seu pai?"
      ],
      responseMode: "direct",
      priority: 3.35
    },
    {
      name: "comparacao_com_pai",
      pattern: /\b(?:voc[eê]|iza|you)\b[\s\S]{0,30}\b(?:como|igual|parece|like)\b[\s\S]{0,20}\b(?:meu|minha|my)\s+(pai|m[aã]e|father|mother)\b/i,
      responses: [
        "Que semelhança você percebe?",
        "O que em mim lembra essa figura para você?"
      ],
      responseMode: "direct",
      priority: 3.25
    },
    {
      name: "iza_nao_agressiva",
      pattern: /\b(?:voc[eê]|iza|you)\b[\s\S]{0,20}\b(?:n[aã]o|not)\b[\s\S]{0,30}\b(?:agressiv[oa]|aggressive)\b/i,
      responses: [
        "O que faz você pensar que eu não sou agressiva?",
        "O que em mim te dá essa impressão?"
      ],
      responseMode: "direct",
      priority: 3.1
    },
    {
      name: "iza_nao_discute",
      pattern: /\b(?:voc[eê]|iza|you)\b[\s\S]{0,20}\b(?:n[aã]o|not|don't|do\s+not)\b[\s\S]{0,28}\b(?:discute|argumenta|argue)\b[\s\S]{0,20}\b(?:comigo|with\s+me)?/i,
      responses: [
        "Por que você acha que eu não discuto com você?",
        "O que te faz notar isso agora?"
      ],
      responseMode: "direct",
      priority: 3.2
    },
    {
      name: "iza_com_medo",
      pattern: /\b(?:voc[eê]|iza|you)\b[\s\S]{0,16}\b(?:tem\s+medo|est[aá]\s+com\s+medo|is\s+afraid|afraid)\b[\s\S]{0,16}\b(?:de\s+mim|of\s+me)\b/i,
      responses: [
        "Te agrada pensar que eu tenho medo de você?",
        "O que isso significaria para você?"
      ],
      responseMode: "direct",
      priority: 3.25
    },
    {
      name: "pai_com_medo",
      pattern: /\b(?:meu|minha|my)\s+(pai|father)\b[\s\S]{0,30}\b(?:tem\s+medo|is\s+afraid|afraid)\b/i,
      responses: [
        "O que mais vem a sua mente quando você pensa no seu pai?"
      ],
      responseMode: "direct",
      priority: 3.05
    },
    {
      name: "nao_consigo",
      pattern: /\bn[aã]o\s+consigo\s+([^.!?\n\r]+)/i,
      responses: [
        "Quando você diz que não consegue {0}, onde isso emperra primeiro?",
        "O que costuma acontecer logo antes de você travar em {0}?",
        "O que deixaria {0} 10% mais possível hoje?",
        "Se pudesse começar torto, como começaria {0} em uma linha?"
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
        "Você disse '{0} {1}'. Isso vem de você ou de exigência externa?",
        "O que acontece se você não {1} agora?",
        "Qual parte de '{1}' e negociável e qual é inegociável?"
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
        "Você abriu um contraste. O que bate de frente com o que, exatamente?",
        "Depois de '{0}', o que muda de sentido?",
        "Qual lado desse contraste você quer sustentar mais?"
      ]
    },
    {
      name: "porque",
      pattern: /\bporque\b\s*([\s\S]+)/i,
      responses: [
        "Você trouxe um 'porque'. Qual é o núcleo disso em 6 a 10 palavras?",
        "Esse 'porque' explica ou justifica? Qual dos dois?",
        "Que evidencia concreta sustenta esse 'porque'?"
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
        "Em vez de explicar, o que você pode mostrar numa ação?"
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
        "O que aqui é explicação e o que é essencial?"
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
      default: ["Qual parte desse trecho você quer sustentar?"],
      nao_sei: ["Sem pressa: o que você já sabe com certeza?"]
    },
    B: {
      eu_sinto: ["Obrigada por dividir isso. Quando vem {0}, o que esse tema te pede com mais cuidado?"],
      medo: ["Tô com você nisso. Se o {0} baixasse um pouco, o que já daria para dizer?"],
      default: ["Entendi. Qual parte desse trecho você quer cuidar melhor agora?"]
    },
    C: {
      estrutura_texto: ["Qual função exata do {0} no texto: abrir, sustentar ou fechar?"],
      porque: ["Qual prova concreta sustenta esse 'porque' em uma linha?"],
      excesso: ["Corta para 2 frases. Quais ficam?"],
      default: ["Formula sua tese em uma frase objetiva."]
    },
    D: {
      default: ["Qual é o núcleo disso?"],
      excesso: ["Corte para duas frases. Quais ficam?"],
      pergunta: ["O que essa pergunta quer decidir?"]
    },
    H: {
      default: ["Tem um núcleo vivo aqui. Qual parte você quer ampliar primeiro?"],
      nao_consigo: ["Tem uma trava em '{0}'. O que pede cuidado e o que pede decisão?"],
      eu_sinto: ["Isso tem carga emocional ({0}). O que te acolhe e, ao mesmo tempo, te move no texto?"],
      contraste: ["Há um contraste aqui. Qual lado pede cuidado e qual lado pede decisão?"],
      estrutura_texto: ["Vamos equilibrar forma e verdade: qual função o {0} precisa cumprir agora?"]
    }
  };

  // TRACK overrides: injeta “microcomandos” por trilha (sem esmagar o BASE)
  const RULE_TRACK_OVERRIDES = {
    iniciante: {
      default: [
        "Se puder, me mostra isso num detalhe concreto: lugar, alguem e um gesto.",
        "Se isso virasse uma cena bem curta, o que apareceria primeiro?"
      ],
      cena_imagem: [
        "Me dá uma cena curta: onde você está, quem aparece e o que acontece?",
        "Escolhe um objeto simples e deixa ele carregar o sentido."
      ],
      travado: [
        "Se travou, começa só pela imagem: um lugar, um corpo, um gesto."
      ],
      porque: [
        "Em vez de explicar mais, me mostra isso num exemplo pequeno."
      ]
    },
    intermediaria: {
      default: [
        "Tenta me dar uma frase de ideia central e, logo depois, uma prova.",
        "Qual afirmação você quer sustentar e com que exemplo?"
      ],
      estrutura_texto: [
        "Que função esse {0} precisa cumprir no texto: abrir, sustentar ou fechar?",
        "Se o {0} tivesse 3 frases, quais seriam: contexto, tese e prova?"
      ],
      porque: [
        "Transforma esse 'porque' em evidencia: dado, citacao ou exemplo curto."
      ],
      excesso: [
        "Faz um corte de 2 frases: ideia e prova."
      ]
    },
    inspirada: {
      default: [
        "Segue no fluxo. Escreve mais um pouco antes de julgar.",
        "Deixa uma frase curta puxar a próxima."
      ],
      eu_sinto: [
        "Deixa {0} virar imagem, sem explicar. O que aparece?",
        "Que som, cor ou textura combina com {0}?"
      ],
      comparacao: [
        "Se essa comparação virasse metáfora, qual imagem seguraria o sentido?"
      ],
      estrutura_texto: [
        "Sem formatar demais agora. Guarda o eixo e segue."
      ]
    }
  };

  const ROGERIAN_RULE_REFRESH = {
    travado: [
      "Quando isso trava, em que parte a escrita para primeiro: começo, meio ou fecho?",
      "Quando você fica {0}, o que está tentando proteger no texto?",
      "Se eu te pedisse só uma frase possível agora, qual viria?"
    ],
    eu_sinto: [
      "Tem algo de {0} no que você trouxe. Onde isso pega mais forte no texto?",
      "Se esse {0} virasse cena, o que apareceria primeiro?",
      "Esse {0} te aproxima do texto ou faz você recuar?"
    ],
    medo: [
      "Você nomeou {0}. Reação de quem pesa mais aqui: leitor, você ou tema?",
      "Quando entra {0}, o que você tenta manter sob controle no texto?",
      "Se o {0} baixasse um pouco, o que já daria para dizer?",
      "Se for '{0} de {1}', qual é o menor risco que ainda vale assumir hoje?"
    ],
    nao_sei: [
      "Tem uma oscilação aqui. Entre quais duas direções você está?",
      "Mesmo na dúvida, o que você já sabe com certeza?",
      "Qual pergunta, se ganhasse resposta, soltaria essa parte do texto?"
    ],
    default: [
      "O que está mais vivo nisso agora?",
      "Qual parte desse trecho você quer sustentar melhor?",
      "O que você quer que continue ecoando no leitor depois disso?",
      "Daqui, o próximo passo é nomear melhor, mostrar uma cena ou sustentar a ideia?"
    ]
  };

  function refreshBaseRuleResponses() {
    RULES_BASE.forEach((rule) => {
      if (!rule || !ROGERIAN_RULE_REFRESH[rule.name]) return;
      rule.responses = ROGERIAN_RULE_REFRESH[rule.name].slice();
    });
  }

  function refinePersonalityOverrides() {
    RULE_OVERRIDES.A.default = [
      "Qual parte desse trecho você quer sustentar?",
      "O que aqui pede mais escuta antes de seguir?"
    ];
    RULE_OVERRIDES.A.nao_sei = [
      "Sem pressa: o que você já sabe com certeza?",
      "Se você não decidir tudo agora, qual pequena certeza fica?"
    ];

    RULE_OVERRIDES.B.eu_sinto = [
      "Obrigada por dividir isso. Quando vem {0}, o que esse tema te pede com mais cuidado?",
      "Fico com {0} no que você disse. Onde isso pede mais delicadeza?"
    ];
    RULE_OVERRIDES.B.medo = [
      "Tô com você nisso. Se o {0} baixasse um pouco, o que já daria para dizer?",
      "Vamos chegar perto disso sem forcar. O que o {0} ainda deixa dizer?"
    ];
    RULE_OVERRIDES.B.default = [
      "Entendi. Qual parte desse trecho você quer cuidar melhor agora?",
      "Do que você disse, qual ponto merece mais escuta antes de seguir?"
    ];

    RULE_OVERRIDES.C.estrutura_texto = [
      "Qual função exata do {0} no texto: abrir, sustentar ou fechar?",
      "Recorta: o {0} existe para situar, provar ou concluir?"
    ];
    RULE_OVERRIDES.C.porque = [
      "Qual prova concreta sustenta esse 'porque' em uma linha?",
      "Se esse 'porque' fosse testado agora, qual evidencia ficaria de pe?"
    ];
    RULE_OVERRIDES.C.excesso = [
      "Corta para 2 frases. Quais ficam?",
      "O que sai sem derrubar a ideia?"
    ];
    RULE_OVERRIDES.C.default = [
      "Formula sua tese em uma frase objetiva.",
      "Recorta o ponto central em uma frase."
    ];

    RULE_OVERRIDES.D.default = ["Qual é o núcleo disso?", "Diga o centro em uma frase."];
    RULE_OVERRIDES.D.excesso = ["Corte para duas frases. Quais ficam?", "O que fica se você reduzir?"];
    RULE_OVERRIDES.D.pergunta = ["O que essa pergunta quer decidir?", "Qual é o ponto da pergunta?"];

    RULE_OVERRIDES.H.default = [
      "Tem um núcleo vivo aqui. Qual parte você quer ampliar primeiro?",
      "Aqui há ao mesmo tempo escuta e recorte. Qual lado pede mais trabalho agora?"
    ];
    RULE_OVERRIDES.H.nao_consigo = [
      "Tem uma trava em '{0}'. O que pede cuidado e o que pede decisão?",
      "Quer acolher o ponto sensível e definir um próximo passo concreto?"
    ];
    RULE_OVERRIDES.H.eu_sinto = [
      "Isso tem carga emocional ({0}). O que te acolhe e, ao mesmo tempo, te move no texto?",
      "O que em {0} pede escuta e o que em {0} pede forma?"
    ];
    RULE_OVERRIDES.H.contraste = [
      "Há um contraste aqui. Qual lado pede cuidado e qual lado pede decisão?",
      "Onde esse contraste te divide e onde ele te esclarece?"
    ];
    RULE_OVERRIDES.H.estrutura_texto = [
      "Vamos equilibrar forma e verdade: qual função o {0} precisa cumprir agora?",
      "Sem perder a escuta: que forma ajuda esse {0} a respirar melhor?"
    ];
  }

  refreshBaseRuleResponses();
  refinePersonalityOverrides();

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
  window.IZA_ION_MARKERS = ION_SOCRATIC_MARKERS;
  window.IZA_RULES_BASE = RULES_BASE;
  window.IZA_RULE_OVERRIDES = RULE_OVERRIDES;
  window.IZA_RULE_TRACK_OVERRIDES = RULE_TRACK_OVERRIDES;
  window.getIZARulesFor = getIZARulesFor;
})();
