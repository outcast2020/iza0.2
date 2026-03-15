var RECORD_HEADERS = [
  "DATA/HORA",
  "ESCRITOR/A",
  "EMAIL",
  "MUNICIPIO",
  "ESTADO",
  "TRILHA",
  "PERSONALIDADE DO BOT",
  "REGISTRO DOS ESCRITOS",
  "SINTESE DA JORNADA",
  "PALAVRAS-CHAVE",
  "PRESENTE LITERARIO",
  "CREDITO DO PRESENTE",
  "LOG FECHAMENTO"
];

var QUERY_STOPWORDS = {
  a: true, ao: true, aos: true, aquela: true, aquele: true, aqueles: true, as: true, ate: true,
  com: true, como: true, da: true, das: true, de: true, dela: true, dele: true, deles: true,
  depois: true, do: true, dos: true, e: true, ela: true, ele: true, eles: true, em: true,
  entre: true, era: true, essa: true, esse: true, esta: true, estao: true, estar: true,
  este: true, eu: true, foi: true, ha: true, isso: true, isto: true, ja: true, la: true,
  mais: true, mas: true, me: true, meu: true, minha: true, muito: true, na: true, nas: true,
  nem: true, no: true, nos: true, nossa: true, nosso: true, num: true, numa: true, o: true,
  os: true, ou: true, para: true, pela: true, pelas: true, pelo: true, pelos: true, por: true,
  porque: true, pra: true, que: true, quem: true, se: true, sem: true, ser: true, seu: true,
  sua: true, tambem: true, te: true, tem: true, tinha: true, to: true, tu: true, um: true,
  uma: true, voce: true, voces: true, texto: true, escrita: true, coisa: true, aqui: true,
  agora: true, hoje: true, ontem: true, amanha: true, gente: true, tipo: true, sobre: true,
  fazer: true, feito: true, tenho: true, tava: true, estou: true, quero: true, queria: true,
  vai: true, vou: true, fica: true, ficou: true, so: true, mim: true
};

var POEM_INDEX_HEADERS = [
  "NORM_TITLE",
  "NORM_CONTENT",
  "NOUNS",
  "VERBS",
  "ADJECTIVES",
  "BIGRAMS"
];

var AUXILIARY_VERBS = {
  ser: true, estar: true, ter: true, haver: true, ir: true, fazer: true
};

var LITERARY_GIFT_MIN_SCORE = 7;
var SURPRISE_THRESHOLD = 0.85;

function setup() {
  var sheet = getRecordsSheet_();
  ensureRecordHeaders_(sheet);
  sheet.setFrozenRows(1);
}

function doGet(e) {
  var action = String((e && e.parameter && e.parameter.action) || "").trim().toLowerCase();
  if (action === "gift") {
    return handleGiftLookup_(e);
  }

  return ContentService
    .createTextOutput("IZA webapp ok")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var sheet = getRecordsSheet_();
  var headerMap = ensureRecordHeaders_(sheet);

  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    var sessionId = String(data.sessionId || "").trim();
    var stage = String(data.stage || "").trim().toLowerCase();

    var escritor = data.escritor || data.name || "";
    var email = data.email || "";
    var municipio = data.municipio || data.city || "";
    var estadoRaw = data.estado || data.state || data.stateUF || "";
    var origemRaw = data.origem || data.source || "";
    var trilha = data.trilha || data.trackKey || "";
    var personalidade = data.personalidade || data.presenceName || data.presenceKey || "";

    var escritos =
      data.escritos ||
      data.transcript ||
      (Array.isArray(data.turns) ? buildTranscriptFromTurns_(data.turns) : "");

    var journeySummary = data.journeySummary || data.summary || data.synthesis || "";
    var keywordsText = Array.isArray(data.keywords)
      ? data.keywords.join(", ")
      : String(data.keywordText || data.keywords || "");

    var literaryGift = data.literaryGift || data.literaryGiftText || "";
    var literaryGiftTitle = data.literaryGiftTitle || "";
    var literaryGiftAuthor = data.literaryGiftAuthor || "";
    var literaryGiftIntro = data.literaryGiftIntro || "";
    var literaryGiftSource = data.literaryGiftSource || "";
    var literaryGiftSeed = data.literaryGiftSeed || "";
    var literaryGiftMatched = Array.isArray(data.literaryGiftMatched)
      ? data.literaryGiftMatched.join(", ")
      : String(data.literaryGiftMatched || "");

    var estadoComOrigem = composeEstadoWithOrigem_(estadoRaw, origemRaw);
    var row = -1;

    if (stage === "init") {
      appendInitRow_(sheet, headerMap, {
        sessionId: sessionId,
        escritor: escritor,
        email: email,
        municipio: municipio,
        estadoComOrigem: estadoComOrigem
      });

      return textResponse_("OK:init");
    }

    row = findRowBySessionId_(sheet, headerMap, sessionId);
    if (row === -1) {
      appendInitRow_(sheet, headerMap, {
        sessionId: sessionId,
        escritor: escritor,
        email: email,
        municipio: municipio,
        estadoComOrigem: estadoComOrigem,
        fallback: true
      });
      row = findRowBySessionId_(sheet, headerMap, sessionId);
    }

    updateCommonRowFields_(sheet, headerMap, row, {
      escritor: escritor,
      email: email,
      municipio: municipio,
      estadoComOrigem: estadoComOrigem,
      trilha: trilha,
      personalidade: personalidade
    });

    if (stage === "choice") {
      writeLog_(sheet, headerMap, row, buildClosingLog_(stage, {
        journeySummary: journeySummary,
        keywordsText: keywordsText
      }));
      return textResponse_("OK:choice");
    }

    if (stage === "final" || stage === "final_gift") {
      if (escritos) safeSetByHeader_(sheet, row, headerMap, "REGISTRO DOS ESCRITOS", "SESSION_ID:" + sessionId + "\n" + escritos);
      if (journeySummary) safeSetByHeader_(sheet, row, headerMap, "SINTESE DA JORNADA", journeySummary);
      if (keywordsText) safeSetByHeader_(sheet, row, headerMap, "PALAVRAS-CHAVE", keywordsText);

      if (literaryGift) {
        var giftBlock = literaryGift;
        if (literaryGiftIntro) {
          giftBlock = literaryGiftIntro + "\n\n" + literaryGift;
        }
        safeSetByHeader_(sheet, row, headerMap, "PRESENTE LITERARIO", giftBlock);
      }

      var credit = [literaryGiftAuthor, literaryGiftTitle].filter(Boolean).join(" - ");
      if (credit) safeSetByHeader_(sheet, row, headerMap, "CREDITO DO PRESENTE", credit);

      writeLog_(sheet, headerMap, row, buildClosingLog_(stage, {
        journeySummary: journeySummary,
        keywordsText: keywordsText,
        literaryGiftSource: literaryGiftSource,
        literaryGiftSeed: literaryGiftSeed,
        literaryGiftMatched: literaryGiftMatched
      }));

      if (stage === "final_gift") {
        var emailStatus = sendFinalEmailBestEffort_({
          email: email,
          escritor: escritor,
          trilha: trilha,
          journeySummary: journeySummary,
          keywordsText: keywordsText,
          literaryGift: literaryGift,
          literaryGiftAuthor: literaryGiftAuthor,
          literaryGiftTitle: literaryGiftTitle,
          transcript: escritos
        });

        if (emailStatus !== "skipped") {
          writeLog_(sheet, headerMap, row, buildClosingLog_(stage, {
            journeySummary: journeySummary,
            keywordsText: keywordsText,
            literaryGiftSource: literaryGiftSource,
            literaryGiftSeed: literaryGiftSeed,
            literaryGiftMatched: literaryGiftMatched,
            emailStatus: emailStatus
          }));
        }

        return textResponse_("OK:" + emailStatus);
      }

      return textResponse_("OK:final");
    }

    return textResponse_("OK:noop");
  } catch (error) {
    return textResponse_("Erro: " + error.message);
  }
}

function handleGiftLookup_(e) {
  var callback = sanitizeJsonpCallback_((e && e.parameter && e.parameter.callback) || "");
  var keywords = parseKeywordParam_((e && e.parameter && e.parameter.keywords) || "");
  var summary = (e && e.parameter && e.parameter.summary) || "";
  var seedText = (e && e.parameter && e.parameter.seedText) || "";
  var userData = analyzeUserQuery_(keywords, summary, seedText);
  var query = {
    keywords: keywords,
    userData: userData,
    summary: summary,
    seedText: seedText,
    trackKey: (e && e.parameter && e.parameter.trackKey) || "",
    presenceKey: (e && e.parameter && e.parameter.presenceKey) || ""
  };

  var gift = findLiteraryGift_(query);
  var payload = JSON.stringify({
    ok: true,
    gift: gift
  });

  return ContentService
    .createTextOutput(callback + "(" + payload + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function syncPoemsAnnotations_() {
  var sheet = getPoemsSheet_();
  if (!sheet) throw new Error("Planilha de poemas nao encontrada.");

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) throw new Error("Base de poemas vazia.");

  var headerMap = ensurePoemIndexHeaders_(sheet, values[0]);
  var titleIndex = findHeaderIndex_(headerMap, ["TITLE", "TITULO"]);
  var contentIndex = findHeaderIndex_(headerMap, ["CONTENT", "CONTEUDO", "POEM", "TEXTO"]);
  var normTitleIndex = findHeaderIndex_(headerMap, ["NORM_TITLE"]);
  var normContentIndex = findHeaderIndex_(headerMap, ["NORM_CONTENT"]);
  var nounsIndex = findHeaderIndex_(headerMap, ["NOUNS"]);
  var verbsIndex = findHeaderIndex_(headerMap, ["VERBS"]);
  var adjectivesIndex = findHeaderIndex_(headerMap, ["ADJECTIVES"]);
  var bigramsIndex = findHeaderIndex_(headerMap, ["BIGRAMS"]);

  if (!contentIndex) throw new Error("Coluna de conteudo nao encontrada.");

  var output = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var title = titleIndex ? String(row[titleIndex - 1] || "") : "";
    var content = String(row[contentIndex - 1] || "");
    var analysis = analyzeTextForIndex_(title + "\n" + content);

    output.push([
      normalizeText_(title),
      normalizeText_(content),
      analysis.nouns.join("|"),
      analysis.verbs.join("|"),
      analysis.adjectives.join("|"),
      analysis.bigrams.join("|")
    ]);
  }

  if (output.length) {
    sheet.getRange(2, normTitleIndex, output.length, 6).setValues(output);
  }

  return "OK:poems_annotations_synced";
}

function getRecordsSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty("IZA_RECORDS_SPREADSHEET_ID") || "").trim();
  var sheetName = String(props.getProperty("IZA_RECORDS_SHEET_NAME") || "").trim();
  var ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (sheetName) {
    return ss.getSheetByName(sheetName) || ss.getActiveSheet();
  }
  return ss.getActiveSheet();
}

function getPoemsSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty("IZA_POEMS_SPREADSHEET_ID") || "").trim();
  var sheetName = String(props.getProperty("IZA_POEMS_SHEET_NAME") || "POEMS").trim();
  var ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();

  return (
    ss.getSheetByName(sheetName) ||
    ss.getSheetByName("POEMS") ||
    ss.getSheetByName("Poems") ||
    ss.getSheetByName("poems")
  );
}

function ensureRecordHeaders_(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
  var currentHeaders = headerRange.getValues()[0];
  var existingMap = buildHeaderMapFromRow_(currentHeaders);
  var changed = false;

  for (var i = 0; i < RECORD_HEADERS.length; i++) {
    var header = RECORD_HEADERS[i];
    var key = normalizeHeaderKey_(header);
    if (!existingMap[key]) {
      currentHeaders[i] = header;
      existingMap[key] = i + 1;
      changed = true;
    } else if (!currentHeaders[existingMap[key] - 1]) {
      currentHeaders[existingMap[key] - 1] = header;
      changed = true;
    }
  }

  var width = Math.max(currentHeaders.length, RECORD_HEADERS.length);
  while (currentHeaders.length < width) currentHeaders.push("");

  if (changed || sheet.getLastRow() === 0 || !String(currentHeaders[0] || "").trim()) {
    sheet.getRange(1, 1, 1, width).setValues([currentHeaders]);
  }

  sheet.setFrozenRows(1);
  return buildHeaderMapFromRow_(sheet.getRange(1, 1, 1, width).getValues()[0]);
}

function appendInitRow_(sheet, headerMap, data) {
  var width = Math.max(sheet.getLastColumn(), RECORD_HEADERS.length);
  var row = buildBlankRow_(width);
  setRowValue_(row, headerMap, "DATA/HORA", new Date());
  setRowValue_(row, headerMap, "ESCRITOR/A", data.escritor || "");
  setRowValue_(row, headerMap, "EMAIL", data.email || "");
  setRowValue_(row, headerMap, "MUNICIPIO", data.municipio || "");
  setRowValue_(row, headerMap, "ESTADO", data.estadoComOrigem || "");
  setRowValue_(
    row,
    headerMap,
    "REGISTRO DOS ESCRITOS",
    "SESSION_ID:" + (data.sessionId || "") + "\n" + (data.fallback ? "(Linha de fallback criada)" : "(Registro iniciado)")
  );
  sheet.appendRow(row);
}

function updateCommonRowFields_(sheet, headerMap, row, data) {
  if (data.escritor) safeSetByHeader_(sheet, row, headerMap, "ESCRITOR/A", data.escritor);
  if (data.email) safeSetByHeader_(sheet, row, headerMap, "EMAIL", data.email);
  if (data.municipio) safeSetByHeader_(sheet, row, headerMap, "MUNICIPIO", data.municipio);
  if (data.estadoComOrigem) safeSetByHeader_(sheet, row, headerMap, "ESTADO", data.estadoComOrigem);
  if (data.trilha) safeSetByHeader_(sheet, row, headerMap, "TRILHA", data.trilha);
  if (data.personalidade) safeSetByHeader_(sheet, row, headerMap, "PERSONALIDADE DO BOT", data.personalidade);
}

function findRowBySessionId_(sheet, headerMap, sessionId) {
  if (!sessionId) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var registroIndex = headerMap[normalizeHeaderKey_("REGISTRO DOS ESCRITOS")];
  if (!registroIndex) return -1;

  var values = sheet.getRange(2, registroIndex, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var cell = String(values[i][0] || "");
    if (cell.indexOf("SESSION_ID:" + sessionId) !== -1) return i + 2;
  }
  return -1;
}

function buildClosingLog_(stage, info) {
  var parts = ["stage=" + stage];
  if (info.journeySummary) parts.push("summary=ok");
  if (info.keywordsText) parts.push("keywords=ok");
  if (info.literaryGiftSource) parts.push("gift=" + info.literaryGiftSource);
  if (info.literaryGiftSeed) parts.push("seed=" + info.literaryGiftSeed);
  if (info.literaryGiftMatched) parts.push("matched=" + info.literaryGiftMatched);
  if (info.emailStatus) parts.push("email=" + info.emailStatus);
  return parts.join(" | ");
}

function writeLog_(sheet, headerMap, row, message) {
  if (!message) return;
  safeSetByHeader_(sheet, row, headerMap, "LOG FECHAMENTO", message);
}

function sendFinalEmailBestEffort_(payload) {
  if (!payload.email || payload.email.indexOf("@") === -1) return "skipped";

  try {
    var subject = "Seu encerramento - IZA no Cordel 2.0";
    var summaryBlock = payload.journeySummary || "(sem sintese)";
    var keywordsBlock = payload.keywordsText || "(sem palavras-chave)";
    var giftCredit = [payload.literaryGiftAuthor, payload.literaryGiftTitle].filter(Boolean).join(" - ");
    var giftBlock = payload.literaryGift || "(sem presente literario)";

    var bodyTxt =
      "Ola " + (payload.escritor || "Participante") + ",\n\n" +
      "Segue o encerramento da sua jornada com IZA na trilha " + (payload.trilha || "selecionada") + ".\n\n" +
      "Sintese da jornada:\n" + summaryBlock + "\n\n" +
      "Palavras-chave:\n" + keywordsBlock + "\n\n" +
      "Presente literario da IZA:\n" + giftBlock + "\n" +
      (giftCredit ? "Credito: " + giftCredit + "\n\n" : "\n") +
      "Registro completo:\n" + (payload.transcript || "") + "\n\n" +
      "Cordel 2.0";

    var bodyHtml =
      "<div style='font-family: Georgia, serif; max-width: 720px; margin: 0 auto; color: #2A1913;'>" +
      "<h2 style='margin-bottom: 8px;'>Encerramento da sua jornada com IZA</h2>" +
      "<p style='margin-top: 0;'>Trilha: <strong>" + escapeHtml_(payload.trilha || "") + "</strong></p>" +
      "<div style='background:#F3E4C7; border:1px solid #D39A32; border-radius:12px; padding:16px; margin:16px 0;'>" +
      "<strong>Sintese da jornada</strong>" +
      "<p style='margin:8px 0 0;'>" + escapeHtml_(summaryBlock) + "</p>" +
      "</div>" +
      "<p><strong>Palavras-chave:</strong> " + escapeHtml_(keywordsBlock) + "</p>" +
      "<div style='background:#FFF8EC; border-left:4px solid #B85C1E; padding:16px; border-radius:10px; margin:16px 0;'>" +
      "<strong>Presente literario da IZA</strong>" +
      "<p style='white-space:pre-wrap; margin:8px 0 0;'>" + escapeHtml_(giftBlock) + "</p>" +
      (giftCredit ? "<p style='margin:10px 0 0; color:#5A3422;'><strong>" + escapeHtml_(giftCredit) + "</strong></p>" : "") +
      "</div>" +
      "<p><strong>Registro completo</strong></p>" +
      "<div style='white-space:pre-wrap; background:#f7f1e4; border:1px solid #d9c3a0; border-radius:10px; padding:16px;'>" +
      escapeHtml_(payload.transcript || "") +
      "</div>" +
      "</div>";

    GmailApp.sendEmail(payload.email, subject, bodyTxt, {
      htmlBody: bodyHtml,
      name: "IZA no Cordel 2.0",
      replyTo: "contato@cordel2pontozero.com"
    });

    return "sent";
  } catch (error) {
    return "failed";
  }
}

function buildTranscriptFromTurns_(turns) {
  return turns
    .map(function (turn) {
      var who = turn.role === "user" ? "VOCE" : "IZA";
      return who + ":\n" + String(turn.text || "");
    })
    .join("\n\n");
}

function composeEstadoWithOrigem_(estado, origem) {
  var estadoNorm = normalizeUFOrInternational_(estado);
  var origemNorm = normalizeOrigem_(origem);

  if (estadoNorm && origemNorm) return estadoNorm + " | " + origemNorm;
  if (estadoNorm) return estadoNorm;
  if (origemNorm) return "INTERNACIONAL | " + origemNorm;
  return "";
}

function normalizeUFOrInternational_(value) {
  var ufs = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  var text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (text.indexOf("INTERNAC") !== -1 || text === "INT" || text === "INTL") return "INTERNACIONAL";

  var letters = text.replace(/[^A-Z]/g, "").slice(0, 2);
  if (ufs.indexOf(letters) !== -1) return letters;
  if (ufs.indexOf(text) !== -1) return text;
  return "INTERNACIONAL";
}

function normalizeOrigem_(value) {
  var text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.indexOf("oficina") !== -1 || text.indexOf("cordel") !== -1) return "Oficina Cordel 2.0";
  if (text.indexOf("part") !== -1 || text.indexOf("priv") !== -1) return "Particular";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sanitizeJsonpCallback_(callback) {
  var clean = String(callback || "").trim();
  if (!/^[A-Za-z0-9_.$]+$/.test(clean)) {
    throw new Error("Callback invalido");
  }
  return clean;
}

function parseKeywordParam_(value) {
  return String(value || "")
    .split("|")
    .map(function (item) { return String(item || "").trim(); })
    .filter(Boolean);
}

function tokenizeQueryText_(text) {
  return normalizeText_(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (token) {
      return token.length >= 4 && !QUERY_STOPWORDS[token];
    });
}

function normalizeText_(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stemToken_(token) {
  return String(token || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(function (part) {
      return part.length <= 5 ? part : part.slice(0, 5);
    })
    .join(" ");
}

function analyzeUserQuery_(keywords, summary, seedText) {
  var sourceTexts = [
    { text: (keywords || []).join(" "), weight: 4 },
    { text: seedText || "", weight: 3 },
    { text: summary || "", weight: 2 }
  ];
  var weighted = {
    nouns: {},
    verbs: {},
    adjectives: {},
    bigrams: {},
    allTokens: {}
  };

  sourceTexts.forEach(function (entry) {
    if (!entry.text) return;
    var analysis = analyzeTextForIndex_(entry.text);
    mergeWeightedTokenCounts_(weighted.nouns, analysis.nouns, entry.weight);
    mergeWeightedTokenCounts_(weighted.verbs, analysis.verbs, entry.weight);
    mergeWeightedTokenCounts_(weighted.adjectives, analysis.adjectives, entry.weight);
    mergeWeightedTokenCounts_(weighted.bigrams, analysis.bigrams, entry.weight + 1);
    mergeWeightedTokenCounts_(weighted.allTokens, analysis.allTokens, entry.weight);
  });

  (keywords || []).forEach(function (token) {
    var clean = normalizeText_(token).replace(/[^a-z0-9]/g, "");
    if (!clean || QUERY_STOPWORDS[clean]) return;
    weighted.allTokens[clean] = (weighted.allTokens[clean] || 0) + 4;
    if (isLikelyVerb_(clean)) {
      weighted.verbs[clean] = (weighted.verbs[clean] || 0) + 4;
    } else if (isLikelyAdjective_(clean)) {
      weighted.adjectives[clean] = (weighted.adjectives[clean] || 0) + 3;
    } else {
      weighted.nouns[clean] = (weighted.nouns[clean] || 0) + 4;
    }
  });

  return {
    nouns: rankWeightedTokens_(weighted.nouns, 8),
    verbs: rankWeightedTokens_(weighted.verbs, 8),
    adjectives: rankWeightedTokens_(weighted.adjectives, 6),
    bigrams: rankWeightedTokens_(weighted.bigrams, 8),
    allTokens: rankWeightedTokens_(weighted.allTokens, 20)
  };
}

function findLiteraryGift_(query) {
  var sheet = getPoemsSheet_();
  if (!sheet) return null;

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return null;

  var headerMap = buildHeaderMapFromRow_(values[0]);
  var authorIndex = findHeaderIndex_(headerMap, ["AUTHOR", "AUTOR"]);
  var titleIndex = findHeaderIndex_(headerMap, ["TITLE", "TITULO"]);
  var contentIndex = findHeaderIndex_(headerMap, ["CONTENT", "CONTEUDO", "POEM", "TEXTO"]);
  var viewsIndex = findHeaderIndex_(headerMap, ["VIEWS", "VISUALIZACOES", "VISUALIZACOES"]);
  var normTitleIndex = findHeaderIndex_(headerMap, ["NORM_TITLE"]);
  var normContentIndex = findHeaderIndex_(headerMap, ["NORM_CONTENT"]);
  var nounsIndex = findHeaderIndex_(headerMap, ["NOUNS"]);
  var verbsIndex = findHeaderIndex_(headerMap, ["VERBS"]);
  var adjectivesIndex = findHeaderIndex_(headerMap, ["ADJECTIVES"]);
  var bigramsIndex = findHeaderIndex_(headerMap, ["BIGRAMS"]);

  if (!contentIndex) return null;

  var userData = query.userData || analyzeUserQuery_(query.keywords || [], query.summary || "", query.seedText || "");
  if (!userData.allTokens.length) return null;

  var candidates = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var content = String(row[contentIndex - 1] || "").trim();
    if (!content) continue;

    var author = authorIndex ? String(row[authorIndex - 1] || "").trim() : "";
    var title = titleIndex ? String(row[titleIndex - 1] || "").trim() : "";
    var views = viewsIndex ? Number(String(row[viewsIndex - 1] || "0").replace(/[^\d]/g, "")) : 0;
    var poemData = buildPoemDataFromRow_({
      row: row,
      title: title,
      content: content,
      normTitleIndex: normTitleIndex,
      normContentIndex: normContentIndex,
      nounsIndex: nounsIndex,
      verbsIndex: verbsIndex,
      adjectivesIndex: adjectivesIndex,
      bigramsIndex: bigramsIndex
    });

    if (!hasFastMatch_(userData, poemData)) continue;

    var titleData = analyzeTextForIndex_(title);
    var scoreData = scorePoemMatchV2_(userData, poemData, {
      titleData: titleData,
      views: views
    });
    if (scoreData.score < LITERARY_GIFT_MIN_SCORE) continue;

    candidates.push({
      author: author,
      title: title,
      content: content,
      views: views,
      score: scoreData.score,
      matchedKeywords: scoreData.matchedKeywords,
      classDiversity: scoreData.classDiversity,
      tieData: scoreData.tieData,
      seed: scoreData.seed,
      fragment: selectBestExcerpt_(content, userData)
    });
  }

  if (!candidates.length) return null;

  candidates.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.tieData.nounMatches !== a.tieData.nounMatches) return b.tieData.nounMatches - a.tieData.nounMatches;
    if (b.tieData.bigramMatches !== a.tieData.bigramMatches) return b.tieData.bigramMatches - a.tieData.bigramMatches;
    if (b.tieData.totalMatches !== a.tieData.totalMatches) return b.tieData.totalMatches - a.tieData.totalMatches;
    return (b.views || 0) - (a.views || 0);
  });

  var selected = pickSurprisingCandidate_(candidates);
  return {
    source: "poems_sheet",
    intro: buildGiftExplanation_(selected.matchedKeywords),
    fragment: selected.fragment,
    author: selected.author || "Autor/a nao identificado/a",
    title: selected.title || "Trecho sem titulo",
    matchedKeywords: flattenMatchedKeywords_(selected.matchedKeywords),
    seed: selected.seed
  };
}

function scorePoemMatchV2_(userData, poemData, poemMeta) {
  var titleData = poemMeta.titleData || { nouns: [], verbs: [], adjectives: [], bigrams: [] };
  var score = 0;
  var matchedKeywords = {
    nouns: intersection_(userData.nouns, poemData.nouns),
    verbs: intersection_(userData.verbs, poemData.verbs),
    adjectives: intersection_(userData.adjectives, poemData.adjectives),
    bigrams: intersection_(userData.bigrams, poemData.bigrams)
  };
  var partial = {
    nouns: stemIntersection_(userData.nouns, poemData.nouns, matchedKeywords.nouns),
    verbs: stemIntersection_(userData.verbs, poemData.verbs, matchedKeywords.verbs),
    adjectives: stemIntersection_(userData.adjectives, poemData.adjectives, matchedKeywords.adjectives),
    bigrams: stemIntersection_(userData.bigrams, poemData.bigrams, matchedKeywords.bigrams)
  };

  score += matchedKeywords.nouns.length * 3;
  score += matchedKeywords.verbs.length * 2;
  score += matchedKeywords.adjectives.length * 1;
  score += matchedKeywords.bigrams.length * 5;
  score += partial.nouns.length * 1.5;
  score += partial.verbs.length * 1;
  score += partial.adjectives.length * 0.5;
  score += partial.bigrams.length * 2;

  if (matchedKeywords.nouns.length >= 1 && matchedKeywords.verbs.length >= 1) score += 4;
  if (matchedKeywords.nouns.length >= 2) score += 2;

  var classDiversity = 0;
  if (matchedKeywords.nouns.length) classDiversity++;
  if (matchedKeywords.verbs.length) classDiversity++;
  if (matchedKeywords.adjectives.length) classDiversity++;
  if (matchedKeywords.bigrams.length) classDiversity++;
  score += classDiversity;

  score += intersection_(userData.nouns, titleData.nouns).length * 2;
  score += intersection_(userData.bigrams, titleData.bigrams).length * 3;
  if (poemMeta.views > 0) score += Math.min(3, Math.log(poemMeta.views + 1));

  return {
    score: score,
    matchedKeywords: matchedKeywords,
    classDiversity: classDiversity,
    tieData: {
      nounMatches: matchedKeywords.nouns.length,
      verbMatches: matchedKeywords.verbs.length,
      adjectiveMatches: matchedKeywords.adjectives.length,
      bigramMatches: matchedKeywords.bigrams.length,
      totalMatches:
        matchedKeywords.nouns.length +
        matchedKeywords.verbs.length +
        matchedKeywords.adjectives.length +
        matchedKeywords.bigrams.length
    },
    seed:
      matchedKeywords.nouns[0] ||
      matchedKeywords.bigrams[0] ||
      matchedKeywords.verbs[0] ||
      matchedKeywords.adjectives[0] ||
      userData.nouns[0] ||
      userData.allTokens[0] ||
      ""
  };
}

function selectBestExcerpt_(content, userData) {
  var stanzas = splitIntoStanzas_(content);
  if (!stanzas.length) return "";

  var best = { score: -1, classDiversity: -1, text: stanzas[0] };
  for (var i = 0; i < stanzas.length; i++) {
    var stanza = stanzas[i];
    var stanzaData = analyzeTextForIndex_(stanza);
    var stanzaScore = scorePoemMatchV2_(userData, stanzaData, {
      titleData: { nouns: [], verbs: [], adjectives: [], bigrams: [] },
      views: 0
    });

    if (
      stanzaScore.score > best.score ||
      (stanzaScore.score === best.score && stanzaScore.classDiversity > best.classDiversity) ||
      (stanzaScore.score === best.score &&
        stanzaScore.classDiversity === best.classDiversity &&
        stanza.length < best.text.length)
    ) {
      best = {
        score: stanzaScore.score,
        classDiversity: stanzaScore.classDiversity,
        text: stanza
      };
    }
  }

  var fragment = String(best.text || "").trim();
  return fragment.length > 320 ? fragment.slice(0, 317).trim() + "..." : fragment;
}

function analyzeTextForIndex_(text) {
  var normalized = normalizeText_(text);
  var tokens = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (token) {
      return token.length >= 3 && !QUERY_STOPWORDS[token];
    });

  var classes = extractHeuristicPos_(tokens);
  return {
    nouns: uniqueByFrequency_(classes.nouns),
    verbs: uniqueByFrequency_(classes.verbs),
    adjectives: uniqueByFrequency_(classes.adjectives),
    bigrams: uniqueByFrequency_(extractRelevantBigrams_(tokens)),
    allTokens: uniqueByFrequency_(tokens)
  };
}

function extractHeuristicPos_(tokens) {
  var out = { nouns: [], verbs: [], adjectives: [] };
  (tokens || []).forEach(function (token) {
    if (isLikelyVerb_(token)) {
      out.verbs.push(token);
    } else if (isLikelyAdjective_(token)) {
      out.adjectives.push(token);
    } else if (isLikelyNoun_(token)) {
      out.nouns.push(token);
    }
  });
  return out;
}

function isLikelyVerb_(token) {
  if (!token || token.length < 3) return false;
  if (AUXILIARY_VERBS[token]) return false;
  return /(?:ar|er|ir|ando|endo|indo|ado|ido|ou|ava|iam|ia|am|em)$/.test(token);
}

function isLikelyAdjective_(token) {
  if (!token || token.length < 4) return false;
  return /(?:oso|osa|vel|veis|nte|antes|ente|ado|ada|ido|ida|al|ivo|iva|ico|ica|ento|enta)$/.test(token);
}

function isLikelyNoun_(token) {
  return !!token && token.length >= 4 && !QUERY_STOPWORDS[token];
}

function extractRelevantBigrams_(tokens) {
  var bigrams = [];
  for (var i = 0; i < tokens.length - 1; i++) {
    var first = tokens[i];
    var second = tokens[i + 1];
    if (!first || !second) continue;
    if (QUERY_STOPWORDS[first] || QUERY_STOPWORDS[second]) continue;
    if (first.length < 4 || second.length < 4) continue;
    bigrams.push(first + " " + second);
  }
  return bigrams;
}

function hasFastMatch_(userData, poemData) {
  if (intersection_(userData.nouns, poemData.nouns).length) return true;
  if (intersection_(userData.verbs, poemData.verbs).length) return true;
  if (intersection_(userData.bigrams, poemData.bigrams).length) return true;
  if (stemIntersection_(userData.nouns, poemData.nouns, []).length) return true;
  if (stemIntersection_(userData.verbs, poemData.verbs, []).length) return true;
  return false;
}

function buildPoemDataFromRow_(data) {
  var row = data.row;
  var nouns = splitPipeTokens_(data.nounsIndex ? row[data.nounsIndex - 1] : "");
  var verbs = splitPipeTokens_(data.verbsIndex ? row[data.verbsIndex - 1] : "");
  var adjectives = splitPipeTokens_(data.adjectivesIndex ? row[data.adjectivesIndex - 1] : "");
  var bigrams = splitPipeTokens_(data.bigramsIndex ? row[data.bigramsIndex - 1] : "");

  if (nouns.length || verbs.length || adjectives.length || bigrams.length) {
    return {
      normTitle: data.normTitleIndex ? String(row[data.normTitleIndex - 1] || "") : normalizeText_(data.title),
      normContent: data.normContentIndex ? String(row[data.normContentIndex - 1] || "") : normalizeText_(data.content),
      nouns: nouns,
      verbs: verbs,
      adjectives: adjectives,
      bigrams: bigrams
    };
  }

  var analysis = analyzeTextForIndex_(data.title + "\n" + data.content);
  return {
    normTitle: normalizeText_(data.title),
    normContent: normalizeText_(data.content),
    nouns: analysis.nouns,
    verbs: analysis.verbs,
    adjectives: analysis.adjectives,
    bigrams: analysis.bigrams
  };
}

function buildGiftExplanation_(matchedKeywords) {
  var matched = flattenMatchedKeywords_(matchedKeywords || {});
  var lead = matched.slice(0, 4).join(", ");
  if (!lead) return "Com elas, encontrei um pequeno presente literario para voce.";
  return "Recolhi algumas palavras que insistiram no seu percurso: " + lead + ". Com elas, encontrei este presente literario.";
}

function pickSurprisingCandidate_(candidates) {
  if (!candidates.length) return null;
  var bestScore = candidates[0].score || 0;
  var threshold = bestScore * SURPRISE_THRESHOLD;
  var top = candidates.filter(function (candidate) {
    return candidate.score >= threshold;
  }).slice(0, 3);

  if (top.length <= 1) return top[0] || candidates[0];

  var weights = [60, 25, 15];
  var total = 0;
  for (var i = 0; i < top.length; i++) total += weights[i];

  var ticket = Math.random() * total;
  var cursor = 0;
  for (var j = 0; j < top.length; j++) {
    cursor += weights[j];
    if (ticket <= cursor) return top[j];
  }

  return top[0];
}

function splitIntoStanzas_(content) {
  var text = String(content || "").replace(/\r/g, "").trim();
  if (!text) return [];

  var chunks = text
    .split(/\n\s*\n+/)
    .map(function (chunk) { return String(chunk || "").trim(); })
    .filter(Boolean);
  if (chunks.length) return chunks;

  var lines = text
    .split(/\n/)
    .map(function (line) { return String(line || "").trim(); })
    .filter(Boolean);

  var grouped = [];
  for (var i = 0; i < lines.length; i += 4) {
    grouped.push(lines.slice(i, i + 4).join("\n"));
  }
  return grouped;
}

function mergeWeightedTokenCounts_(bucket, items, weight) {
  (items || []).forEach(function (token) {
    if (!token) return;
    bucket[token] = (bucket[token] || 0) + weight;
  });
}

function rankWeightedTokens_(bucket, limit) {
  return Object.keys(bucket || {})
    .sort(function (a, b) {
      return bucket[b] - bucket[a] || b.length - a.length;
    })
    .slice(0, limit || 10);
}

function uniqueByFrequency_(items) {
  var counts = {};
  (items || []).forEach(function (token) {
    if (!token) return;
    counts[token] = (counts[token] || 0) + 1;
  });
  return Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a] || b.length - a.length;
  });
}

function splitPipeTokens_(value) {
  return String(value || "")
    .split("|")
    .map(function (token) { return String(token || "").trim(); })
    .filter(Boolean);
}

function intersection_(listA, listB) {
  var setB = {};
  (listB || []).forEach(function (token) {
    setB[token] = true;
  });
  return (listA || []).filter(function (token, index, array) {
    return setB[token] && array.indexOf(token) === index;
  });
}

function stemIntersection_(listA, listB, exactMatches) {
  var exact = {};
  (exactMatches || []).forEach(function (token) {
    exact[token] = true;
  });
  var stemsB = {};
  (listB || []).forEach(function (token) {
    stemsB[stemToken_(token)] = true;
  });
  return (listA || []).filter(function (token, index, array) {
    if (exact[token]) return false;
    return stemsB[stemToken_(token)] && array.indexOf(token) === index;
  });
}

function flattenMatchedKeywords_(matched) {
  if (!matched) return [];
  var seen = {};
  var out = [];
  ["nouns", "verbs", "adjectives", "bigrams"].forEach(function (group) {
    (matched[group] || []).forEach(function (token) {
      if (seen[token]) return;
      seen[token] = true;
      out.push(token);
    });
  });
  return out;
}

function ensurePoemIndexHeaders_(sheet, currentHeaders) {
  var headers = (currentHeaders || []).slice();
  var map = buildHeaderMapFromRow_(headers);
  var changed = false;

  POEM_INDEX_HEADERS.forEach(function (header) {
    var key = normalizeHeaderKey_(header);
    if (!map[key]) {
      headers.push(header);
      map[key] = headers.length;
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return buildHeaderMapFromRow_(sheet.getRange(1, 1, 1, headers.length).getValues()[0]);
}

function containsWholeWord_(text, token) {
  var regex = new RegExp("(^|[^a-z0-9])" + escapeRegex_(token) + "([^a-z0-9]|$)", "i");
  return regex.test(text);
}

function escapeRegex_(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeaderMapFromRow_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var key = normalizeHeaderKey_(headers[i]);
    if (key) map[key] = i + 1;
  }
  return map;
}

function findHeaderIndex_(headerMap, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var key = normalizeHeaderKey_(candidates[i]);
    if (headerMap[key]) return headerMap[key];
  }
  return 0;
}

function normalizeHeaderKey_(value) {
  return normalizeText_(value).replace(/[^a-z0-9]+/g, " ").trim().toUpperCase();
}

function buildBlankRow_(width) {
  var row = [];
  for (var i = 0; i < width; i++) row.push("");
  return row;
}

function setRowValue_(row, headerMap, header, value) {
  var index = headerMap[normalizeHeaderKey_(header)];
  if (!index) return;
  row[index - 1] = value;
}

function safeSetByHeader_(sheet, row, headerMap, header, value) {
  if (!row || row < 2) return;
  var index = headerMap[normalizeHeaderKey_(header)];
  if (!index) return;
  sheet.getRange(row, index).setValue(value);
}

function textResponse_(text) {
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.TEXT);
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
