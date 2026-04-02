var RECORD_HEADERS = [
  "DATA/HORA",
  "APP_VARIANT",
  "SESSION_ID",
  "PARTICIPANT_ID",
  "CHECKIN_USER_ID",
  "CHECKIN_MATCH_STATUS",
  "CHECKIN_MATCH_METHOD",
  "ESCRITOR/A",
  "EMAIL",
  "MUNICIPIO",
  "ESTADO",
  "ORIGEM",
  "TEACHER_GROUP",
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
  este: true, estes: true, estas: true, esses: true, essas: true, eu: true, foi: true, ha: true, isso: true, isto: true, ja: true, la: true,
  mais: true, mas: true, me: true, meu: true, minha: true, muito: true, na: true, nas: true,
  nem: true, no: true, nos: true, nossa: true, nosso: true, num: true, numa: true, o: true,
  os: true, ou: true, para: true, pela: true, pelas: true, pelo: true, pelos: true, por: true,
  porque: true, pra: true, que: true, quem: true, se: true, sem: true, ser: true, seu: true,
  seus: true, sua: true, suas: true, tambem: true, te: true, tem: true, tinha: true, to: true, tu: true, um: true,
  uma: true, voce: true, voces: true, texto: true, escrita: true, coisa: true, aqui: true,
  agora: true, hoje: true, ontem: true, amanha: true, gente: true, tipo: true, sobre: true,
  fazer: true, feito: true, tenho: true, tava: true, estou: true, quero: true, queria: true,
  vai: true, vou: true, fica: true, ficou: true, so: true, mim: true, meus: true, minhas: true,
  assim: true, todo: true, toda: true, todos: true, todas: true, cada: true,
  quanto: true, quantos: true, quanta: true, quantas: true, teu: true, tua: true, teus: true, tuas: true,
  quando: true, principalmente: true, certamente: true,
  proprio: true, propria: true, proprios: true, proprias: true,
  jeito: true, modo: true, passo: true, frase: true, linha: true, linhas: true,
  sintese: true, versao: true, forma: true, registro: true, trilha: true, jornada: true,
  nucleo: true, centro: true, pergunta: true, afirmacao: true, ferida: true, desejo: true,
  questionamento: true, resposta: true, detalhe: true, detalhes: true,
  coisas: true, algo: true, alguma: true, algumas: true, algum: true, alguns: true,
  melhor: true, ainda: true
};

var GIFT_DISPLAY_WEAK_TOKENS = {
  quando: true, quanto: true, quantos: true, quanta: true, quantas: true,
  certo: true, certa: true, certos: true, certas: true,
  deixa: true, deixar: true, tento: true, tentar: true,
  parece: true, parecer: true, verdade: true,
  todo: true, toda: true, todos: true, todas: true,
  mundo: true, texto: true, escrita: true
};

var POEM_INDEX_HEADERS = [
  "NORM_TITLE",
  "NORM_CONTENT",
  "NOUNS",
  "VERBS",
  "ADJECTIVES",
  "BIGRAMS",
  "ALL_TOKENS",
  "THEMES"
];

var AUXILIARY_VERBS = {
  ser: true, estar: true, ter: true, haver: true, ir: true, fazer: true
};

var THEME_LEXICON = {
  memoria: ["memori", "lembr", "record", "saudad", "passad", "esquec"],
  tempo: ["temp", "futur", "presen", "agora", "instan", "amanh", "ontem"],
  sonho: ["sonh", "visit", "assombr", "fantasm", "espectr", "devan"],
  sombra: ["sombr", "escur", "noit", "nevo", "brum", "abism"],
  corpo: ["corp", "mao", "olh", "rost", "boc", "peit", "sang", "cora"],
  territorio: ["territ", "terra", "chao", "rua", "cidade", "mapa", "pais"],
  linguagem: ["linguag", "palavr", "poesi", "vers", "escrit", "fala", "voz"],
  politica: ["polit", "povo", "poder", "histori", "luta", "colet", "social"],
  alegria: ["alegr", "carnav", "fest", "riso", "danc", "cant"],
  ferida: ["ferid", "dor", "cort", "sangr", "machuc", "traum"],
  desejo: ["desej", "vontad", "ansi", "quer", "fome"],
  vazio: ["vazi", "nada", "falt", "silenc", "ausenc"],
  agua: ["agu", "chuva", "mar", "rio", "ond", "lag", "fonte"],
  infancia: ["crianc", "menin", "brinqu", "infanc", "escola"],
  real: ["real", "vida", "mund", "exist", "ser"],
  linguagem_popular: ["cordel", "cantoria", "folhet", "repent", "xilo"],
  travessia: ["limiar", "ponte", "porta", "passag", "travess", "beira"]
};

var LITERARY_GIFT_MIN_SCORE = 5;
var ASSOCIATED_GIFT_MIN_SCORE = 3.2;
var SURPRISE_THRESHOLD = 0.85;
var POEM_SHARD_COUNT = 5;
var PREFERRED_VIEWS_FRACTION = 0.67;
var EXCERPT_SCORE_MARGIN = 3;
var DEFAULT_RECORDS_SPREADSHEET_ID = "1w13EVysAWLuF5RgMLUcUHEL0cJcuD9fryJbX3glZ8Ac";
var DEFAULT_POEMS_SPREADSHEET_ID = "1ZWLSI39VuXrmUoRIojdchlqZUdV5pvdqzqhzoGmRds0";
var DEFAULT_POEMS_SHEET_NAME = "POEMS";
var DEFAULT_CHECKIN_SPREADSHEET_ID = "130CvfT6mwv0gzYQgmrylg4Q0T5xRI918dms8A4yzqO8";
var DEFAULT_CHECKIN_SHEET_NAME = "USERS";
var DEFAULT_PROJECT_VARIANT = "iza0.2";

function claimPoemShardContext_() {
  var props = PropertiesService.getScriptProperties();
  var raw = String(props.getProperty("IZA_POEMS_NEXT_SHARD") || "0").trim();
  var anchor = Number(raw);
  if (!isFinite(anchor) || anchor < 0) anchor = 0;
  anchor = anchor % POEM_SHARD_COUNT;
  props.setProperty("IZA_POEMS_NEXT_SHARD", String((anchor + 1) % POEM_SHARD_COUNT));
  return {
    anchor: anchor,
    count: POEM_SHARD_COUNT
  };
}

function resolvePoemShardWindow_(sheet, shardContext, offset) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return null;

  var dataRows = lastRow - 1;
  var count = (shardContext && shardContext.count) || POEM_SHARD_COUNT;
  var anchor = (shardContext && shardContext.anchor) || 0;
  var shard = ((anchor + (offset || 0)) % count + count) % count;

  var startIndex = Math.floor((dataRows * shard) / count);
  var endIndex = Math.floor((dataRows * (shard + 1)) / count) - 1;
  var numRows = Math.max(0, endIndex - startIndex + 1);
  if (!numRows) return null;

  return {
    shard: shard,
    startRow: startIndex + 2,
    numRows: numRows,
    lastColumn: lastColumn
  };
}

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
  if (action === "checkin_lookup") {
    return handleCheckinLookup_(e);
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
    var appVariant = String(data.appVariant || DEFAULT_PROJECT_VARIANT).trim() || DEFAULT_PROJECT_VARIANT;

    var escritorRaw = String(data.escritor || data.name || "").trim();
    var email = String(data.email || "").trim();
    var municipioRaw = String(data.municipio || data.city || "").trim();
    var estadoRaw = data.estado || data.state || data.stateUF || "";
    var origemRaw = data.origem || data.source || "";
    var teacherGroup = String(data.teacherGroup || data.cohort || data.workshop || "").trim();
    var trilha = String(data.trilha || data.trackKey || "").trim();
    var personalidade = String(data.personalidade || data.presenceName || data.presenceKey || "").trim();

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

    var checkinMatch = resolveCheckinMatch_({
      name: escritorRaw,
      email: email,
      municipio: municipioRaw,
      estado: estadoRaw,
      origem: origemRaw,
      cohort: teacherGroup
    });

    var escritor = String(escritorRaw || checkinMatch.name || "").trim();
    email = String(email || checkinMatch.email || "").trim();
    var municipio = String(municipioRaw || checkinMatch.city || "").trim();
    var estadoNorm = normalizeUFOrInternational_(estadoRaw || checkinMatch.estado || "");
    var origemNorm = normalizeOrigem_(origemRaw || checkinMatch.origem || "");
    teacherGroup = String(teacherGroup || checkinMatch.teacherGroup || "").trim();
    var participantMatch = {
      status: String(data.checkinMatchStatus || checkinMatch.status || "unmatched").trim() || "unmatched",
      method: String(data.checkinMatchMethod || checkinMatch.method || "none").trim() || "none",
      checkinUserId: String(data.checkinUserId || checkinMatch.checkinUserId || "").trim()
    };
    var participantId = String(data.participantId || buildParticipantId_({
      name: escritor,
      email: email,
      municipio: municipio,
      estado: estadoNorm,
      origem: origemNorm,
      checkinMatch: participantMatch
    })).trim();

    var recordsBase = {
      appVariant: appVariant,
      sessionId: sessionId,
      participantId: participantId,
      checkinUserId: participantMatch.checkinUserId,
      matchStatus: participantMatch.status,
      matchMethod: participantMatch.method,
      escritor: escritor,
      email: email,
      municipio: municipio,
      estado: estadoNorm,
      origem: origemNorm,
      teacherGroup: teacherGroup,
      trilha: trilha,
      personalidade: personalidade
    };

    var row = -1;

    if (stage === "init") {
      appendInitRow_(sheet, headerMap, recordsBase);
      return textResponse_("OK:init");
    }

    row = findRowBySessionId_(sheet, headerMap, sessionId);
    if (row === -1) {
      var fallbackBase = {};
      for (var baseKey in recordsBase) fallbackBase[baseKey] = recordsBase[baseKey];
      fallbackBase.fallback = true;
      appendInitRow_(sheet, headerMap, fallbackBase);
      row = findRowBySessionId_(sheet, headerMap, sessionId);
    }

    updateCommonRowFields_(sheet, headerMap, row, recordsBase);

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
        var emailStatus = sendFinalEmailBestEffortV2_({
          email: email,
          escritor: escritor,
          trilha: trilha,
          journeySummary: journeySummary,
          keywordsText: keywordsText,
          literaryGift: literaryGift,
          literaryGiftIntro: literaryGiftIntro,
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

function lookupLiteraryGift(payload) {
  return buildGiftLookupResult_({
    keywords: payload && payload.keywords,
    summary: payload && payload.summary,
    seedText: payload && payload.seedText,
    journeyText: payload && payload.journeyText,
    trackKey: payload && payload.trackKey,
    presenceKey: payload && payload.presenceKey
  });
}

function handleGiftLookup_(e) {
  var callback = sanitizeJsonpCallback_((e && e.parameter && e.parameter.callback) || "");
  var payload = JSON.stringify(buildGiftLookupResult_({
    keywords: parseKeywordParam_((e && e.parameter && e.parameter.keywords) || ""),
    summary: (e && e.parameter && e.parameter.summary) || "",
    seedText: (e && e.parameter && e.parameter.seedText) || "",
    journeyText: (e && e.parameter && e.parameter.journeyText) || "",
    trackKey: (e && e.parameter && e.parameter.trackKey) || "",
    presenceKey: (e && e.parameter && e.parameter.presenceKey) || ""
  }));

  return ContentService
    .createTextOutput(callback + "(" + payload + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handleCheckinLookup_(e) {
  var callback = sanitizeJsonpCallback_((e && e.parameter && e.parameter.callback) || "");
  var payload = JSON.stringify(buildCheckinLookupResult_({
    email: (e && e.parameter && e.parameter.email) || ""
  }));

  return ContentService
    .createTextOutput(callback + "(" + payload + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function buildCheckinLookupResult_(input) {
  var email = normalizeEmail_(input && input.email);
  if (!email || email.indexOf("@") === -1) {
    return {
      ok: false,
      status: "error",
      error: "invalid_email"
    };
  }

  var match = resolveCheckinMatch_({ email: email });
  if (match.status !== "matched") {
    return {
      ok: false,
      status: match.status || "unmatched",
      error: match.status === "ambiguous" ? "ambiguous_email" : "email_not_found"
    };
  }

  return {
    ok: true,
    status: "matched",
    email: match.email || email,
    name: match.name || "",
    municipio: match.city || "",
    estado: match.estado || "",
    origem: normalizeOrigem_(match.origem || ""),
    teacherGroup: match.teacherGroup || "",
    checkinUserId: match.checkinUserId || "",
    matchMethod: match.method || "email",
    participantId: buildParticipantId_({
      email: match.email || email,
      name: match.name || "",
      municipio: match.city || "",
      estado: match.estado || "",
      origem: match.origem || "",
      checkinMatch: match
    })
  };
}

function buildGiftLookupResult_(input) {
  var shardContext = null;

  try {
    var keywords = normalizeGiftKeywords_(input && input.keywords);
    var summary = String((input && input.summary) || "");
    var seedText = String((input && input.seedText) || "");
    var journeyText = String((input && input.journeyText) || "");

    shardContext = claimPoemShardContext_();
    var userData = analyzeUserQuery_(keywords, summary, seedText, journeyText);
    var query = {
      keywords: keywords,
      userData: userData,
      summary: summary,
      seedText: seedText,
      journeyText: journeyText,
      shardContext: shardContext,
      trackKey: String((input && input.trackKey) || ""),
      presenceKey: String((input && input.presenceKey) || "")
    };

    return {
      ok: true,
      gift: findLiteraryGiftWithFallbackPass_(query),
      diagnostics: buildGiftDiagnostics_(shardContext)
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error && error.message) || error || "gift_lookup_error"),
      gift: null,
      diagnostics: buildGiftDiagnostics_(shardContext)
    };
  }
}

function normalizeGiftKeywords_(keywords) {
  if (Array.isArray(keywords)) {
    return keywords
      .map(function (item) { return String(item || "").trim(); })
      .filter(Boolean);
  }
  return parseKeywordParam_(keywords || "");
}

function buildGiftDiagnostics_(shardContext) {
  var out = {
    recordsSpreadsheetId: DEFAULT_RECORDS_SPREADSHEET_ID,
    poemsSpreadsheetId: DEFAULT_POEMS_SPREADSHEET_ID,
    poemsSheetName: DEFAULT_POEMS_SHEET_NAME,
    poemsSheetFound: false,
    poemsRows: 0,
    poemsColumns: 0,
    shardAnchor: shardContext && typeof shardContext.anchor === "number" ? shardContext.anchor : null
  };

  try {
    var sheet = getPoemsSheet_();
    if (!sheet) return out;
    out.poemsSheetFound = true;
    out.poemsSheetName = sheet.getName();
    out.poemsRows = sheet.getLastRow();
    out.poemsColumns = sheet.getLastColumn();
    return out;
  } catch (error) {
    out.error = String((error && error.message) || error || "diagnostics_error");
    return out;
  }
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
  var allTokensIndex = findHeaderIndex_(headerMap, ["ALL_TOKENS"]);
  var themesIndex = findHeaderIndex_(headerMap, ["THEMES"]);
  var themesIndex = findHeaderIndex_(headerMap, ["THEMES"]);

  if (!contentIndex) throw new Error("Coluna de conteudo nao encontrada.");
  if (!normTitleIndex || !normContentIndex || !nounsIndex || !verbsIndex || !adjectivesIndex || !bigramsIndex || !allTokensIndex || !themesIndex) {
    throw new Error("Colunas auxiliares de indexacao nao encontradas.");
  }

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
      analysis.bigrams.join("|"),
      analysis.allTokens.join("|"),
      analysis.themes.join("|")
    ]);
  }

  if (output.length) {
    sheet.getRange(2, normTitleIndex, output.length, 8).setValues(output);
  }

  return "OK:poems_annotations_synced";
}

function getRecordsSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty("IZA_RECORDS_SPREADSHEET_ID") || DEFAULT_RECORDS_SPREADSHEET_ID).trim();
  var sheetName = String(props.getProperty("IZA_RECORDS_SHEET_NAME") || "").trim();
  var ss = openSpreadsheetSafely_(spreadsheetId) || SpreadsheetApp.getActiveSpreadsheet();
  if (sheetName) {
    return ss.getSheetByName(sheetName) || ss.getActiveSheet();
  }
  return ss.getActiveSheet();
}

function getCheckinSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty("IZA_CHECKIN_SPREADSHEET_ID") || DEFAULT_CHECKIN_SPREADSHEET_ID).trim();
  var sheetName = String(props.getProperty("IZA_CHECKIN_SHEET_NAME") || DEFAULT_CHECKIN_SHEET_NAME).trim();
  var ss = openSpreadsheetSafely_(spreadsheetId);
  if (!ss) return null;

  if (sheetName) {
    return (
      ss.getSheetByName(sheetName) ||
      ss.getSheetByName("USERS") ||
      ss.getSheetByName("Users") ||
      ss.getSheetByName("users") ||
      ss.getSheets()[0]
    );
  }

  return (
    ss.getSheetByName("USERS") ||
    ss.getSheetByName("Users") ||
    ss.getSheetByName("users") ||
    ss.getSheets()[0]
  );
}

function getPoemsSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty("IZA_POEMS_SPREADSHEET_ID") || DEFAULT_POEMS_SPREADSHEET_ID).trim();
  var sheetName = String(props.getProperty("IZA_POEMS_SHEET_NAME") || DEFAULT_POEMS_SHEET_NAME).trim();
  var ss = openSpreadsheetSafely_(spreadsheetId) || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = (
    ss.getSheetByName(sheetName) ||
    ss.getSheetByName("POEMS") ||
    ss.getSheetByName("Poems") ||
    ss.getSheetByName("poems")
  );
  return sheet || ss.getActiveSheet();
}

function openSpreadsheetSafely_(spreadsheetId) {
  if (!spreadsheetId) return null;
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    return null;
  }
}

function debugCheckinSheetInfo() {
  var sheet = getCheckinSheet_();
  if (!sheet) {
    var missingOutput = JSON.stringify({ ok: false, error: "checkin_sheet_not_found" }, null, 2);
    Logger.log(missingOutput);
    return missingOutput;
  }
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var output = JSON.stringify({
    ok: true,
    spreadsheetId: sheet.getParent().getId(),
    sheetName: sheet.getName(),
    headers: headers
  }, null, 2);
  Logger.log(output);
  return output;
}

function debugCheckinLookupByEmail() {
  var email = String(PropertiesService.getScriptProperties().getProperty("IZA_DEBUG_CHECKIN_EMAIL") || "").trim();
  var output = JSON.stringify({
    ok: !!email,
    email: email,
    result: email ? buildCheckinLookupResult_({ email: email }) : { ok: false, error: "missing_IZA_DEBUG_CHECKIN_EMAIL" }
  }, null, 2);
  Logger.log(output);
  return output;
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
  setRowValue_(row, headerMap, "APP_VARIANT", data.appVariant || DEFAULT_PROJECT_VARIANT);
  setRowValue_(row, headerMap, "SESSION_ID", data.sessionId || "");
  setRowValue_(row, headerMap, "PARTICIPANT_ID", data.participantId || "");
  setRowValue_(row, headerMap, "CHECKIN_USER_ID", data.checkinUserId || "");
  setRowValue_(row, headerMap, "CHECKIN_MATCH_STATUS", data.matchStatus || "unmatched");
  setRowValue_(row, headerMap, "CHECKIN_MATCH_METHOD", data.matchMethod || "none");
  setRowValue_(row, headerMap, "ESCRITOR/A", data.escritor || "");
  setRowValue_(row, headerMap, "EMAIL", data.email || "");
  setRowValue_(row, headerMap, "MUNICIPIO", data.municipio || "");
  setRowValue_(row, headerMap, "ESTADO", data.estado || "");
  setRowValue_(row, headerMap, "ORIGEM", data.origem || "");
  setRowValue_(row, headerMap, "TEACHER_GROUP", data.teacherGroup || "");
  setRowValue_(
    row,
    headerMap,
    "REGISTRO DOS ESCRITOS",
    "SESSION_ID:" + (data.sessionId || "") + "\n" + (data.fallback ? "(Linha de fallback criada)" : "(Registro iniciado)")
  );
  sheet.appendRow(row);
}

function updateCommonRowFields_(sheet, headerMap, row, data) {
  if (data.appVariant) safeSetByHeader_(sheet, row, headerMap, "APP_VARIANT", data.appVariant);
  if (data.sessionId) safeSetByHeader_(sheet, row, headerMap, "SESSION_ID", data.sessionId);
  if (data.participantId) safeSetByHeader_(sheet, row, headerMap, "PARTICIPANT_ID", data.participantId);
  if (typeof data.checkinUserId !== "undefined") safeSetByHeader_(sheet, row, headerMap, "CHECKIN_USER_ID", data.checkinUserId || "");
  if (data.matchStatus) safeSetByHeader_(sheet, row, headerMap, "CHECKIN_MATCH_STATUS", data.matchStatus);
  if (data.matchMethod) safeSetByHeader_(sheet, row, headerMap, "CHECKIN_MATCH_METHOD", data.matchMethod);
  if (data.escritor) safeSetByHeader_(sheet, row, headerMap, "ESCRITOR/A", data.escritor);
  if (data.email) safeSetByHeader_(sheet, row, headerMap, "EMAIL", data.email);
  if (data.municipio) safeSetByHeader_(sheet, row, headerMap, "MUNICIPIO", data.municipio);
  if (data.estado) safeSetByHeader_(sheet, row, headerMap, "ESTADO", data.estado);
  if (data.origem) safeSetByHeader_(sheet, row, headerMap, "ORIGEM", data.origem);
  if (data.teacherGroup) safeSetByHeader_(sheet, row, headerMap, "TEACHER_GROUP", data.teacherGroup);
  if (data.trilha) safeSetByHeader_(sheet, row, headerMap, "TRILHA", data.trilha);
  if (data.personalidade) safeSetByHeader_(sheet, row, headerMap, "PERSONALIDADE DO BOT", data.personalidade);
}

function findRowBySessionId_(sheet, headerMap, sessionId) {
  if (!sessionId) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var sessionIndex = findHeaderIndex_(headerMap, ["SESSION_ID"]);
  if (sessionIndex) {
    var sessionValues = sheet.getRange(2, sessionIndex, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < sessionValues.length; i++) {
      if (String(sessionValues[i][0] || "").trim() === String(sessionId)) return i + 2;
    }
  }

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

function resolveCheckinMatch_(input) {
  var sheet = getCheckinSheet_();
  if (!sheet) {
    return { status: "unmatched", method: "none", checkinUserId: "", rowNumber: 0 };
  }

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) {
    return { status: "unmatched", method: "none", checkinUserId: "", rowNumber: 0 };
  }

  var headerMap = buildHeaderMapFromRow_(values[0]);
  var emailNorm = normalizeEmail_(input && input.email);
  var nameNorm = normalizePersonName_(input && input.name);
  var cityNorm = normalizeLooseText_(input && input.municipio);
  var cohortNorm = normalizeLooseText_(input && input.cohort);
  var records = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var record = extractCheckinRecord_(headerMap, row, i + 1);
    if (record.emailNorm || record.nameNorm) records.push(record);
  }

  if (emailNorm) {
    var emailMatches = records.filter(function (record) {
      return record.emailNorm && record.emailNorm === emailNorm;
    });
    var emailResult = buildCheckinMatchResult_(emailMatches, "email");
    if (emailResult.status !== "unmatched") return emailResult;
  }

  if (nameNorm && cohortNorm) {
    var cohortMatches = records.filter(function (record) {
      return record.nameNorm === nameNorm && record.cohortNorm && record.cohortNorm === cohortNorm;
    });
    var cohortResult = buildCheckinMatchResult_(cohortMatches, "name_cohort");
    if (cohortResult.status !== "unmatched") return cohortResult;
  }

  if (nameNorm && cityNorm) {
    var cityMatches = records.filter(function (record) {
      return record.nameNorm === nameNorm && record.cityNorm && record.cityNorm === cityNorm;
    });
    var cityResult = buildCheckinMatchResult_(cityMatches, "name_city");
    if (cityResult.status !== "unmatched") return cityResult;
  }

  return { status: "unmatched", method: "none", checkinUserId: "", rowNumber: 0 };
}

function extractCheckinRecord_(headerMap, row, rowNumber) {
  var email = readRowValueByHeaders_(headerMap, row, ["EMAIL", "E-MAIL", "MAIL"]);
  var name = readRowValueByHeaders_(headerMap, row, ["NOME", "NOME COMPLETO", "NOME DO ALUNO", "ESCRITOR/A"]);
  var city = readRowValueByHeaders_(headerMap, row, ["MUNICIPIO", "CIDADE", "CITY"]);
  var cohort = readRowValueByHeaders_(headerMap, row, ["OFICINAS_CORDEL", "COORTE", "COHORT", "TURMA", "OFICINA", "WORKSHOP", "GRUPO"]);
  var estado = readRowValueByHeaders_(headerMap, row, ["ESTADO", "UF", "STATE"]);
  var origem = readRowValueByHeaders_(headerMap, row, ["ORIGEM", "FONTE", "SOURCE", "TIPO"]);
  var rawId = readRowValueByHeaders_(headerMap, row, ["USER_ID", "CHECKIN_USER_ID", "ID", "IDENTIFICADOR", "INSCRICAO", "MATRICULA"]);

  return {
    rowNumber: rowNumber,
    checkinUserId: String(rawId || "").trim() || ("row-" + rowNumber),
    email: email,
    emailNorm: normalizeEmail_(email),
    name: name,
    nameNorm: normalizePersonName_(name),
    city: city,
    cityNorm: normalizeLooseText_(city),
    cohort: cohort,
    cohortNorm: normalizeLooseText_(cohort),
    estado: estado,
    origem: origem,
    teacherGroup: cohort
  };
}

function buildCheckinMatchResult_(matches, method) {
  if (!matches || !matches.length) {
    return { status: "unmatched", method: "none", checkinUserId: "", rowNumber: 0 };
  }
  if (matches.length > 1) {
    return { status: "ambiguous", method: method, checkinUserId: "", rowNumber: 0 };
  }
  return {
    status: "matched",
    method: method,
    checkinUserId: matches[0].checkinUserId,
    rowNumber: matches[0].rowNumber,
    name: matches[0].name || "",
    email: matches[0].email || "",
    city: matches[0].city || "",
    estado: matches[0].estado || "",
    origem: matches[0].origem || "",
    teacherGroup: matches[0].teacherGroup || ""
  };
}

function buildParticipantId_(input) {
  var match = input && input.checkinMatch;
  if (match && match.status === "matched" && match.checkinUserId) {
    return buildStableId_("participant", ["checkin", match.checkinUserId]);
  }

  var emailNorm = normalizeEmail_(input && input.email);
  if (emailNorm) {
    return buildStableId_("participant", ["email", emailNorm]);
  }

  return buildStableId_("participant", [
    "name",
    normalizePersonName_(input && input.name),
    normalizeLooseText_(input && input.municipio),
    normalizeLooseText_(input && input.estado),
    normalizeLooseText_(input && input.origem)
  ]);
}

function sendFinalEmailBestEffort_(payload) {
  if (!payload.email || payload.email.indexOf("@") === -1) return "skipped";

  try {
    var subject = "Seu encerramento - IZA no Cordel 2.0";
    var summaryBlock = payload.journeySummary || "(sem síntese)";
    var keywordsBlock = payload.keywordsText || "(sem palavras-chave)";
    var giftCredit = [payload.literaryGiftAuthor, payload.literaryGiftTitle].filter(Boolean).join(" - ");
    var giftBlock = payload.literaryGift || "(sem presente literário)";

    var bodyTxt =
      "Olá " + (payload.escritor || "Participante") + ",\n\n" +
      "Segue o encerramento da sua jornada com IZA na trilha " + (payload.trilha || "selecionada") + ".\n\n" +
      "Síntese da jornada:\n" + summaryBlock + "\n\n" +
      "Palavras-chave:\n" + keywordsBlock + "\n\n" +
      "Presente literário da IZA:\n" + giftBlock + "\n" +
      (giftCredit ? "Crédito: " + giftCredit + "\n\n" : "\n") +
      "Registro completo:\n" + (payload.transcript || "") + "\n\n" +
      "Cordel 2.0";

    var bodyHtml =
      "<div style='font-family: Georgia, serif; max-width: 720px; margin: 0 auto; color: #2A1913;'>" +
      "<h2 style='margin-bottom: 8px;'>Encerramento da sua jornada com IZA</h2>" +
      "<p style='margin-top: 0;'>Trilha: <strong>" + escapeHtml_(payload.trilha || "") + "</strong></p>" +
      "<div style='background:#F3E4C7; border:1px solid #D39A32; border-radius:12px; padding:16px; margin:16px 0;'>" +
      "<strong>Síntese da jornada</strong>" +
      "<p style='margin:8px 0 0;'>" + escapeHtml_(summaryBlock) + "</p>" +
      "</div>" +
      "<p><strong>Palavras-chave:</strong> " + escapeHtml_(keywordsBlock) + "</p>" +
      "<div style='background:#FFF8EC; border-left:4px solid #B85C1E; padding:16px; border-radius:10px; margin:16px 0;'>" +
      "<strong>Presente literário da IZA</strong>" +
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

function sendFinalEmailBestEffortV2_(payload) {
  if (!payload.email || payload.email.indexOf("@") === -1) return "skipped";

  try {
    var subject = "Seu encerramento - IZA no Cordel 2.0";
    var summaryBlock = payload.journeySummary || "(sem síntese)";
    var keywordsBlock = payload.keywordsText || "(sem palavras-chave)";
    var giftCredit = [payload.literaryGiftAuthor, payload.literaryGiftTitle].filter(Boolean).join(" - ");
    var giftIntro = payload.literaryGiftIntro || "";
    var giftBlock = payload.literaryGift || "(sem presente literario)";
    var shareCaption = buildShareSuggestion_(payload);

    var bodyTxt =
      "Ola " + (payload.escritor || "Participante") + ",\n\n" +
      "Segue o encerramento da sua jornada com IZA na trilha " + (payload.trilha || "selecionada") + ".\n\n" +
      "Síntese da jornada:\n" + summaryBlock + "\n\n" +
      "Palavras-chave:\n" + keywordsBlock + "\n\n" +
      "Presente literário da IZA:\n" + (giftIntro ? giftIntro + "\n\n" : "") + giftBlock + "\n" +
      (giftCredit ? "Crédito: " + giftCredit + "\n\n" : "\n") +
      "Texto sugerido por IZA para compartilhar:\n" + shareCaption + "\n\n" +
      "Registro completo:\n" + (payload.transcript || "") + "\n\n" +
      "Cordel 2.0";

    var bodyHtml =
      "<div style='font-family: Georgia, serif; max-width: 720px; margin: 0 auto; color: #2A1913;'>" +
      "<h2 style='margin-bottom: 8px;'>Encerramento da sua jornada com IZA</h2>" +
      "<p style='margin-top: 0;'>Trilha: <strong>" + escapeHtml_(payload.trilha || "") + "</strong></p>" +
      "<div style='background:#F3E4C7; border:1px solid #D39A32; border-radius:12px; padding:16px; margin:16px 0;'>" +
      "<strong>Síntese da jornada</strong>" +
      "<p style='margin:8px 0 0;'>" + escapeHtml_(summaryBlock) + "</p>" +
      "</div>" +
      "<p><strong>Palavras-chave:</strong> " + escapeHtml_(keywordsBlock) + "</p>" +
      "<div style='background:#FFF8EC; border-left:4px solid #B85C1E; padding:16px; border-radius:10px; margin:16px 0;'>" +
      "<strong>Presente literário da IZA</strong>" +
      (giftIntro ? "<p style='margin:8px 0 0;'>" + escapeHtml_(giftIntro) + "</p>" : "") +
      "<p style='white-space:pre-wrap; margin:8px 0 0;'>" + escapeHtml_(giftBlock) + "</p>" +
      (giftCredit ? "<p style='margin:10px 0 0; color:#5A3422;'><strong>" + escapeHtml_(giftCredit) + "</strong></p>" : "") +
      "</div>" +
      "<div style='background:#f7efe3; border:1px solid #d9c3a0; border-radius:12px; padding:16px; margin:16px 0;'>" +
      "<strong>Texto sugerido por IZA para compartilhar</strong>" +
      "<p style='white-space:pre-wrap; margin:8px 0 0;'>" + escapeHtml_(shareCaption) + "</p>" +
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

function buildShareSuggestion_(payload) {
  var summary = clipPlainText_(payload.journeySummary || "", 170);
  var credit = [payload.literaryGiftAuthor, payload.literaryGiftTitle].filter(Boolean).join(" - ");
  var keywords = String(payload.keywordsText || "")
    .split(/\s*,\s*/)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  var parts = [];
  parts.push("Hoje fechei uma jornada com IZA no Laboratório de Versos.");
  if (summary) parts.push(summary);
  if (keywords) parts.push("Ficaram comigo: " + keywords + ".");
  if (credit) parts.push("O presente poético veio de " + credit + ".");
  return clipPlainText_(parts.join(" "), 320);
}

function buildShareCardAttachment_(payload, shareCaption, giftCredit) {
  var fragment = clipPlainText_(payload.literaryGift || "", 380);
  var caption = clipPlainText_(shareCaption || "", 320);
  if (!fragment && !caption) return null;

  var lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">');
  lines.push('<rect width="1080" height="1350" fill="#2C1B1B"/>');
  lines.push('<rect x="54" y="54" width="972" height="1242" rx="34" fill="#F3E4C7" stroke="#D39A32" stroke-width="6"/>');
  lines.push('<rect x="114" y="104" width="852" height="122" rx="24" fill="#E8C38A" stroke="#6E4025" stroke-width="4"/>');
  lines.push(svgTextLine_(540, 152, "LOGO CORDEL 2.0", 30, "#5A3422", "700", "middle"));
  lines.push(svgTextLine_(540, 192, "Presente literário da IZA", 42, "#2A1913", "700", "middle"));
  lines.push('<rect x="114" y="274" width="852" height="474" rx="28" fill="#FFF8EC" stroke="#B85C1E" stroke-width="3"/>');
  lines.push(svgTextBlock_(150, 336, 780, 54, fragment || "O eco poético da sua jornada chega aqui.", 38, "#2A1913", "700"));
  if (giftCredit) {
    lines.push(svgTextBlock_(150, 694, 780, 40, giftCredit, 24, "#5A3422", "600"));
  }
  lines.push('<rect x="114" y="790" width="852" height="298" rx="28" fill="#F7EFE3" stroke="#6E4025" stroke-width="3"/>');
  lines.push(svgTextLine_(150, 850, "Texto sugerido por IZA", 28, "#5A3422", "700", "start"));
  lines.push(svgTextBlock_(150, 900, 780, 38, caption, 26, "#2A1913", "500"));
  lines.push('<rect x="114" y="1128" width="852" height="108" rx="24" fill="#B85C1E"/>');
  lines.push(svgTextLine_(540, 1176, "Visite o Laboratório de Versos", 28, "#FFF4DF", "700", "middle"));
  lines.push(svgTextLine_(540, 1214, "www.cordel2pontozero.com  |  @cordel2pontozero", 22, "#FFF4DF", "500", "middle"));
  lines.push('</svg>');

  return Utilities.newBlob(lines.join(""), "image/svg+xml", "iza-card-social.svg");
}

function svgTextLine_(x, y, text, size, fill, weight, anchor) {
  return '<text x="' + x + '" y="' + y + '" font-family="Georgia, serif" font-size="' + size + '" font-weight="' + (weight || "400") + '" text-anchor="' + (anchor || "start") + '" fill="' + fill + '">' + escapeXml_(text) + '</text>';
}

function svgTextBlock_(x, y, width, lineHeight, text, size, fill, weight) {
  var safe = escapeXml_(text || "");
  var words = safe.split(/\s+/);
  var lines = [];
  var current = "";
  var maxChars = Math.max(16, Math.floor(width / Math.max(12, size * 0.58)));

  for (var i = 0; i < words.length; i++) {
    var next = current ? current + " " + words[i] : words[i];
    if (next.length > maxChars && current) {
      lines.push(current);
      current = words[i];
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  lines = lines.slice(0, 10);
  var out = [
    '<text x="' + x + '" y="' + y + '" font-family="Georgia, serif" font-size="' + size + '" font-weight="' + (weight || "400") + '" fill="' + fill + '">'
  ];
  for (var j = 0; j < lines.length; j++) {
    out.push('<tspan x="' + x + '" dy="' + (j === 0 ? 0 : lineHeight) + '">' + lines[j] + '</tspan>');
  }
  out.push('</text>');
  return out.join("");
}

function clipPlainText_(text, maxLength) {
  var clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (!maxLength || clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 3).trim() + "...";
}

function escapeXml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function isIgnoredQueryToken_(token) {
  var clean = normalizeText_(token).replace(/[^a-z0-9]/g, "");
  return !clean || clean.length < 4 || QUERY_STOPWORDS[clean];
}

function isWeakGiftDisplayToken_(token) {
  var clean = normalizeText_(token).replace(/[^a-z0-9]/g, "");
  return !clean || clean.length < 4 || QUERY_STOPWORDS[clean] || GIFT_DISPLAY_WEAK_TOKENS[clean];
}

function tokenizeQueryText_(text) {
  return normalizeText_(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (token) {
      return !isIgnoredQueryToken_(token);
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

function scoreQueryToken_(token, baseWeight) {
  var lengthBonus = Math.min(2, Math.max(0, String(token || "").length - 5) * 0.2);
  var symbolicBonus = /(?:dade|mento|cao|coes|gem|ario|arios|eiro|eira|ismo|ura|ez|or|orio|al)$/.test(token)
    ? 0.8
    : 0;
  return baseWeight + lengthBonus + symbolicBonus;
}

function getQueryRuntimeCache_(query) {
  if (!query._runtimeCache) {
    query._runtimeCache = {
      shardData: {}
    };
  }
  return query._runtimeCache;
}

function getPoemShardData_(query, shardOffset) {
  var cache = getQueryRuntimeCache_(query);
  var key = String(shardOffset || 0);
  if (cache.shardData[key]) return cache.shardData[key];

  var sheet = getPoemsSheet_();
  if (!sheet) return null;

  var shardWindow = resolvePoemShardWindow_(sheet, query.shardContext, shardOffset || 0);
  if (!shardWindow) return null;
  var headerRow = sheet.getRange(1, 1, 1, shardWindow.lastColumn).getDisplayValues()[0];
  var dataRows = sheet.getRange(shardWindow.startRow, 1, shardWindow.numRows, shardWindow.lastColumn).getDisplayValues();
  var values = [headerRow].concat(dataRows);
  if (!values || values.length < 2) return null;

  var headerMap = buildHeaderMapFromRow_(values[0]);
  cache.shardData[key] = {
    values: values,
    headerMap: headerMap,
    authorIndex: findHeaderIndex_(headerMap, ["AUTHOR", "AUTOR"]),
    titleIndex: findHeaderIndex_(headerMap, ["TITLE", "TITULO"]),
    contentIndex: findHeaderIndex_(headerMap, ["CONTENT", "CONTEUDO", "POEM", "TEXTO"]),
    viewsIndex: findHeaderIndex_(headerMap, ["VIEWS", "VISUALIZACOES", "VISUALIZACOES"]),
    normTitleIndex: findHeaderIndex_(headerMap, ["NORM_TITLE"]),
    normContentIndex: findHeaderIndex_(headerMap, ["NORM_CONTENT"]),
    nounsIndex: findHeaderIndex_(headerMap, ["NOUNS"]),
    verbsIndex: findHeaderIndex_(headerMap, ["VERBS"]),
    adjectivesIndex: findHeaderIndex_(headerMap, ["ADJECTIVES"]),
    bigramsIndex: findHeaderIndex_(headerMap, ["BIGRAMS"]),
    allTokensIndex: findHeaderIndex_(headerMap, ["ALL_TOKENS"]),
    themesIndex: findHeaderIndex_(headerMap, ["THEMES"]),
    shardOffset: shardOffset || 0
  };

  return cache.shardData[key];
}

function analyzeUserQuery_(keywords, summary, seedText, journeyText) {
  var sourceTexts = [
    { text: (keywords || []).join(" "), weight: 4 },
    { text: seedText || "", weight: 4.2 },
    { text: summary || "", weight: 2 },
    { text: journeyText || "", weight: 3.4 }
  ];
  var weighted = {
    nouns: {},
    verbs: {},
    adjectives: {},
    bigrams: {},
    allTokens: {},
    themes: {}
  };

  sourceTexts.forEach(function (entry) {
    if (!entry.text) return;
    var analysis = analyzeTextForIndex_(entry.text);
    mergeWeightedTokenCounts_(weighted.nouns, analysis.nouns, entry.weight);
    mergeWeightedTokenCounts_(weighted.verbs, analysis.verbs, entry.weight);
    mergeWeightedTokenCounts_(weighted.adjectives, analysis.adjectives, entry.weight);
    mergeWeightedTokenCounts_(weighted.bigrams, analysis.bigrams, entry.weight + 1);
    mergeWeightedTokenCounts_(weighted.allTokens, analysis.allTokens, entry.weight);
    mergeWeightedTokenCounts_(weighted.themes, analysis.themes, entry.weight + 1.2);
  });

  tokenizeQueryText_(journeyText || "").forEach(function (token) {
    var bonus = scoreQueryToken_(token, 1.2);
    weighted.allTokens[token] = (weighted.allTokens[token] || 0) + bonus;
    if (isLikelyVerb_(token)) {
      weighted.verbs[token] = (weighted.verbs[token] || 0) + bonus;
    } else if (isLikelyAdjective_(token)) {
      weighted.adjectives[token] = (weighted.adjectives[token] || 0) + Math.max(0.6, bonus - 0.4);
    } else {
      weighted.nouns[token] = (weighted.nouns[token] || 0) + bonus;
    }
  });

  (keywords || []).forEach(function (token) {
    var clean = normalizeText_(token).replace(/[^a-z0-9]/g, "");
    if (isIgnoredQueryToken_(clean)) return;
    weighted.allTokens[clean] = (weighted.allTokens[clean] || 0) + scoreQueryToken_(clean, 4);
    if (isLikelyVerb_(clean)) {
      weighted.verbs[clean] = (weighted.verbs[clean] || 0) + scoreQueryToken_(clean, 4);
    } else if (isLikelyAdjective_(clean)) {
      weighted.adjectives[clean] = (weighted.adjectives[clean] || 0) + scoreQueryToken_(clean, 3);
    } else {
      weighted.nouns[clean] = (weighted.nouns[clean] || 0) + scoreQueryToken_(clean, 4);
    }
  });

  return {
    nouns: rankWeightedTokens_(weighted.nouns, 8),
    verbs: rankWeightedTokens_(weighted.verbs, 8),
    adjectives: rankWeightedTokens_(weighted.adjectives, 6),
    bigrams: rankWeightedTokens_(weighted.bigrams, 8),
    allTokens: rankWeightedTokens_(weighted.allTokens, 20),
    themes: rankWeightedTokens_(weighted.themes, 6)
  };
}

function findLiteraryGift_(query, options) {
  options = options || {};
  var shardData = getPoemShardData_(query, options.shardOffset || 0);
  if (!shardData || !shardData.contentIndex) return null;

  var userData = query.userData || analyzeUserQuery_(query.keywords || [], query.summary || "", query.seedText || "", query.journeyText || "");
  if (!userData.allTokens.length) return null;
  var minScore = typeof options.minScore === "number" ? options.minScore : LITERARY_GIFT_MIN_SCORE;
  var mode = options.mode || "direct";

  var candidates = [];
  for (var i = 1; i < shardData.values.length; i++) {
    var row = shardData.values[i];
    var content = String(row[shardData.contentIndex - 1] || "").trim();
    if (!content) continue;

    var author = shardData.authorIndex ? String(row[shardData.authorIndex - 1] || "").trim() : "";
    var title = shardData.titleIndex ? String(row[shardData.titleIndex - 1] || "").trim() : "";
    var views = shardData.viewsIndex ? Number(String(row[shardData.viewsIndex - 1] || "0").replace(/[^\d]/g, "")) : 0;
    var poemData = buildPoemDataFromRow_({
      row: row,
      title: title,
      content: content,
      normTitleIndex: shardData.normTitleIndex,
      normContentIndex: shardData.normContentIndex,
      nounsIndex: shardData.nounsIndex,
      verbsIndex: shardData.verbsIndex,
      adjectivesIndex: shardData.adjectivesIndex,
      bigramsIndex: shardData.bigramsIndex,
      allTokensIndex: shardData.allTokensIndex,
      themesIndex: shardData.themesIndex
    });

    if (!hasFastMatch_(userData, poemData)) continue;

    var titleData = analyzeTextForIndex_(title);
    var scoreData = scorePoemMatchV2_(userData, poemData, {
      titleData: titleData,
      views: views
    });
    if (scoreData.score + EXCERPT_SCORE_MARGIN < minScore) continue;

    var excerptData = selectBestExcerptData_(content, userData, title);
    if (!excerptData || excerptData.discard || !excerptData.fragment) continue;

    candidates.push({
      author: author,
      title: title,
      content: content,
      views: views,
      score: scoreData.score + excerptData.qualityDelta,
      matchedKeywords: scoreData.matchedKeywords,
      classDiversity: scoreData.classDiversity,
      tieData: scoreData.tieData,
      seed: scoreData.seed,
      fragment: excerptData.fragment
    });
  }

  if (!candidates.length) return null;

  candidates = preferMostViewedCandidates_(candidates);
  candidates.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.tieData.lexicalMatches !== a.tieData.lexicalMatches) return b.tieData.lexicalMatches - a.tieData.lexicalMatches;
    if (b.tieData.nounMatches !== a.tieData.nounMatches) return b.tieData.nounMatches - a.tieData.nounMatches;
    if (b.tieData.bigramMatches !== a.tieData.bigramMatches) return b.tieData.bigramMatches - a.tieData.bigramMatches;
    if (b.tieData.totalMatches !== a.tieData.totalMatches) return b.tieData.totalMatches - a.tieData.totalMatches;
    return (b.views || 0) - (a.views || 0);
  });

  var eligible = candidates.filter(function (candidate) {
    return candidate.score >= minScore;
  });
  if (!eligible.length) return null;

  var selected = pickSurprisingCandidate_(eligible);
  return {
    source: mode === "associated" ? "associated_poem" : "poems_sheet",
    intro: buildGiftExplanation_(selected.matchedKeywords, mode),
    fragment: selected.fragment,
    author: selected.author || "Autor/a não identificado/a",
    title: selected.title || "Trecho sem título",
    matchedKeywords: flattenMatchedKeywords_(selected.matchedKeywords),
    seed: selected.seed
  };
}

function findFirstLiteraryGiftAcrossOffsets_(query, options, offsets) {
  var selectedOffsets = offsets && offsets.length ? offsets : [0];
  for (var i = 0; i < selectedOffsets.length; i++) {
    var found = findLiteraryGift_(query, {
      mode: options.mode,
      minScore: options.minScore,
      shardOffset: selectedOffsets[i]
    });
    if (found) return found;
  }
  return null;
}

function findLiteraryGiftWithFallbackPass_(query) {
  var primary = findFirstLiteraryGiftAcrossOffsets_(query, {
    mode: "direct",
    minScore: LITERARY_GIFT_MIN_SCORE
  }, [0, 1]);
  if (primary) return primary;

  var relaxedUserData = analyzeUserQuery_(
    (query.keywords || []).concat(tokenizeQueryText_(query.summary || "").slice(0, 4)),
    [query.summary || "", query.seedText || "", query.journeyText || ""].join(" "),
    query.seedText || "",
    query.journeyText || ""
  );

  var relaxedQuery = {
    keywords: query.keywords || [],
    userData: relaxedUserData,
    summary: query.summary || "",
    seedText: query.seedText || "",
    journeyText: query.journeyText || "",
    shardContext: query.shardContext || null,
    trackKey: query.trackKey || "",
    presenceKey: query.presenceKey || "",
    _runtimeCache: query._runtimeCache || null
  };

  var relaxed = findFirstLiteraryGiftAcrossOffsets_(relaxedQuery, {
    mode: "direct",
    minScore: LITERARY_GIFT_MIN_SCORE
  }, [2]);
  if (relaxed) return relaxed;

  var associated = findFirstLiteraryGiftAcrossOffsets_(relaxedQuery, {
    mode: "associated",
    minScore: ASSOCIATED_GIFT_MIN_SCORE
  }, [3]);
  if (associated) return associated;

  var lexical = findLiteraryGiftLexicalFallback_(relaxedQuery, [4]);
  if (lexical) return lexical;

  return buildFallbackGift_(query, relaxedUserData);
}

function findLiteraryGiftLexicalFallback_(query, offsets) {
  var selectedOffsets = offsets && offsets.length ? offsets : [2];
  var userData = query.userData || analyzeUserQuery_(query.keywords || [], query.summary || "", query.seedText || "", query.journeyText || "");
  for (var offsetIndex = 0; offsetIndex < selectedOffsets.length; offsetIndex++) {
    var shardData = getPoemShardData_(query, selectedOffsets[offsetIndex]);
    if (!shardData || !shardData.contentIndex) continue;
    var candidates = [];

    for (var i = 1; i < shardData.values.length; i++) {
      var row = shardData.values[i];
      var author = shardData.authorIndex ? String(row[shardData.authorIndex - 1] || "").trim() : "";
      var title = shardData.titleIndex ? String(row[shardData.titleIndex - 1] || "").trim() : "";
      var content = String(row[shardData.contentIndex - 1] || "").trim();
      if (!content) continue;

      var text = normalizeText_(title + " " + content);
    var score = 0;
    var matched = [];

    (userData.allTokens || []).slice(0, 12).forEach(function (token) {
      if (!token) return;
      if (containsWholeWord_(text, token)) {
        score += 2;
        matched.push(token);
      } else if (text.indexOf(stemToken_(token)) !== -1) {
        score += 1;
      }
    });

    if (score < 4) continue;

    var excerptData = selectBestExcerptData_(content, userData, title);
    if (!excerptData || excerptData.discard || !excerptData.fragment) continue;

    candidates.push({
      source: "associated_poem",
      intro: buildGiftExplanation_({ nouns: matched, verbs: [], adjectives: [], bigrams: [] }, "associated"),
      fragment: excerptData.fragment,
      author: author || "Autor/a não identificado/a",
      title: title || "Trecho sem título",
      matchedKeywords: matched,
      seed: matched[0] || userData.allTokens[0] || "",
      score: score + excerptData.qualityDelta,
      views: shardData.viewsIndex ? Number(String(row[shardData.viewsIndex - 1] || "0").replace(/[^\d]/g, "")) : 0
    });
  }

    if (!candidates.length) continue;

    candidates = preferMostViewedCandidates_(candidates);
    candidates.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (b.views || 0) - (a.views || 0);
    });

    return candidates[0];
  }

  return null;
}

function buildFallbackGift_(query, userData) {
  var data = userData || analyzeUserQuery_(query.keywords || [], query.summary || "", query.seedText || "", query.journeyText || "");
  var displayMap = buildDisplayTokenMap_([query.seedText || "", query.summary || "", query.journeyText || "", (query.keywords || []).join(" ")]);
  var selected = pickFallbackTokens_(data, displayMap);
  var blessing = composeFallbackBlessing_(selected, query);

  return {
    source: "iza_blessing",
    intro: blessing.intro,
    fragment: blessing.fragment,
    author: "IZA",
    title: "Eco de encerramento",
    matchedKeywords: selected.matched,
    seed: selected.seed
  };
}

function scorePoemMatchV2_(userData, poemData, poemMeta) {
  var titleData = poemMeta.titleData || { nouns: [], verbs: [], adjectives: [], bigrams: [], allTokens: [] };
  var score = 0;
  var matchedKeywords = {
    nouns: intersection_(userData.nouns, poemData.nouns),
    verbs: intersection_(userData.verbs, poemData.verbs),
    adjectives: intersection_(userData.adjectives, poemData.adjectives),
    bigrams: intersection_(userData.bigrams, poemData.bigrams),
    themes: intersection_(userData.themes || [], poemData.themes || [])
  };
  var lexicalMatches = intersection_(userData.allTokens, poemData.allTokens || []);
  var titleLexicalMatches = intersection_(userData.allTokens, titleData.allTokens || []);
  var partial = {
    nouns: stemIntersection_(userData.nouns, poemData.nouns, matchedKeywords.nouns),
    verbs: stemIntersection_(userData.verbs, poemData.verbs, matchedKeywords.verbs),
    adjectives: stemIntersection_(userData.adjectives, poemData.adjectives, matchedKeywords.adjectives),
    bigrams: stemIntersection_(userData.bigrams, poemData.bigrams, matchedKeywords.bigrams),
    lexical: stemIntersection_(userData.allTokens, poemData.allTokens || [], lexicalMatches),
    titleLexical: stemIntersection_(userData.allTokens, titleData.allTokens || [], titleLexicalMatches)
  };

  score += matchedKeywords.nouns.length * 2.2;
  score += matchedKeywords.verbs.length * 1.6;
  score += matchedKeywords.adjectives.length * 0.6;
  score += matchedKeywords.bigrams.length * 4.5;
  score += matchedKeywords.themes.length * 3.4;
  score += lexicalMatches.length * 2.8;
  score += titleLexicalMatches.length * 4;
  score += partial.nouns.length * 0.9;
  score += partial.verbs.length * 0.7;
  score += partial.adjectives.length * 0.25;
  score += partial.bigrams.length * 1.5;
  score += partial.lexical.length * 1.2;
  score += partial.titleLexical.length * 1.6;

  if (matchedKeywords.nouns.length >= 1 && matchedKeywords.verbs.length >= 1) score += 4;
  if (matchedKeywords.nouns.length >= 2) score += 2;
  if (matchedKeywords.themes.length >= 1 && lexicalMatches.length >= 1) score += 2.2;
  if (lexicalMatches.length >= 3) score += 2.5;
  if (lexicalMatches.length >= 5) score += 2.5;

  var classDiversity = 0;
  if (matchedKeywords.nouns.length) classDiversity++;
  if (matchedKeywords.verbs.length) classDiversity++;
  if (matchedKeywords.adjectives.length) classDiversity++;
  if (matchedKeywords.bigrams.length) classDiversity++;
  if (matchedKeywords.themes.length) classDiversity++;
  score += classDiversity * 0.75;

  score += intersection_(userData.nouns, titleData.nouns).length * 1.4;
  score += intersection_(userData.bigrams, titleData.bigrams).length * 2.5;
  if (poemMeta.views > 0) score += Math.min(5.2, Math.log(poemMeta.views + 1) * 0.5);
  if (poemMeta.views >= 100000) score += 0.9;
  if (poemMeta.views >= 500000) score += 1.2;
  if (poemMeta.views >= 1000000) score += 1.2;

  return {
    score: score,
    matchedKeywords: matchedKeywords,
    classDiversity: classDiversity,
    tieData: {
      nounMatches: matchedKeywords.nouns.length,
        verbMatches: matchedKeywords.verbs.length,
        adjectiveMatches: matchedKeywords.adjectives.length,
        bigramMatches: matchedKeywords.bigrams.length,
        themeMatches: matchedKeywords.themes.length,
        lexicalMatches: lexicalMatches.length + titleLexicalMatches.length,
        totalMatches:
          matchedKeywords.nouns.length +
          matchedKeywords.verbs.length +
          matchedKeywords.adjectives.length +
          matchedKeywords.bigrams.length +
          matchedKeywords.themes.length +
          lexicalMatches.length +
          titleLexicalMatches.length
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
  return selectBestExcerptData_(content, userData, "").fragment;
}

function selectBestExcerptData_(content, userData, title) {
  var stanzas = splitIntoStanzas_(content);
  var contentQuality = assessExcerptQuality_(content, title);
  if (!stanzas.length) {
    return {
      fragment: "",
      qualityDelta: contentQuality.qualityDelta,
      discard: contentQuality.discard
    };
  }

  var best = { score: -1, classDiversity: -1, qualityDelta: -999, text: stanzas[0] };
  for (var i = 0; i < stanzas.length; i++) {
    var stanza = stanzas[i];
    var stanzaData = analyzeTextForIndex_(stanza);
    var stanzaScore = scorePoemMatchV2_(userData, stanzaData, {
      titleData: { nouns: [], verbs: [], adjectives: [], bigrams: [] },
      views: 0
    });
    var stanzaQuality = assessExcerptQuality_(stanza, title);
    var effectiveScore = stanzaScore.score + stanzaQuality.qualityDelta;

    if (
      effectiveScore > best.score ||
      (effectiveScore === best.score && stanzaQuality.qualityDelta > best.qualityDelta) ||
      (effectiveScore === best.score && stanzaScore.classDiversity > best.classDiversity) ||
      (effectiveScore === best.score &&
        stanzaScore.classDiversity === best.classDiversity &&
        stanza.length < best.text.length)
    ) {
      best = {
        score: effectiveScore,
        classDiversity: stanzaScore.classDiversity,
        qualityDelta: stanzaQuality.qualityDelta,
        text: stanza
      };
    }
  }

  var fragment = String(best.text || "").trim();
  return {
    fragment: fragment.length > 320 ? fragment.slice(0, 317).trim() + "..." : fragment,
    qualityDelta: contentQuality.qualityDelta + Math.max(0, best.qualityDelta),
    discard: contentQuality.discard || best.qualityDelta <= -4
  };
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
    allTokens: uniqueByFrequency_(tokens),
    themes: uniqueByFrequency_(extractThemes_(tokens))
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

function extractThemes_(tokens) {
  var themes = [];
  var stems = (tokens || []).map(function (token) {
    return stemToken_(token);
  });

  Object.keys(THEME_LEXICON).forEach(function (theme) {
    var roots = THEME_LEXICON[theme] || [];
    for (var i = 0; i < stems.length; i++) {
      for (var j = 0; j < roots.length; j++) {
        if (stems[i].indexOf(roots[j]) !== -1 || roots[j].indexOf(stems[i]) !== -1) {
          themes.push(theme);
          return;
        }
      }
    }
  });

  return themes;
}

function hasFastMatch_(userData, poemData) {
  if (intersection_(userData.nouns, poemData.nouns).length) return true;
  if (intersection_(userData.verbs, poemData.verbs).length) return true;
  if (intersection_(userData.bigrams, poemData.bigrams).length) return true;
  if (intersection_(userData.themes || [], poemData.themes || []).length) return true;
  if (intersection_(userData.allTokens, poemData.allTokens || []).length) return true;
  if (intersection_(userData.allTokens, poemData.allTokens || []).length >= 2) return true;
  if (stemIntersection_(userData.nouns, poemData.nouns, []).length) return true;
  if (stemIntersection_(userData.verbs, poemData.verbs, []).length) return true;
  if (stemIntersection_(userData.allTokens, poemData.allTokens || [], []).length) return true;
  if (stemIntersection_(userData.allTokens, poemData.allTokens || [], []).length >= 2) return true;
  return false;
}

function buildPoemDataFromRow_(data) {
  var row = data.row;
  var nouns = splitPipeTokens_(data.nounsIndex ? row[data.nounsIndex - 1] : "");
  var verbs = splitPipeTokens_(data.verbsIndex ? row[data.verbsIndex - 1] : "");
  var adjectives = splitPipeTokens_(data.adjectivesIndex ? row[data.adjectivesIndex - 1] : "");
  var bigrams = splitPipeTokens_(data.bigramsIndex ? row[data.bigramsIndex - 1] : "");
  var allTokens = splitPipeTokens_(data.allTokensIndex ? row[data.allTokensIndex - 1] : "");
  var themes = splitPipeTokens_(data.themesIndex ? row[data.themesIndex - 1] : "");

  if (nouns.length || verbs.length || adjectives.length || bigrams.length || allTokens.length || themes.length) {
    return {
      normTitle: data.normTitleIndex ? String(row[data.normTitleIndex - 1] || "") : normalizeText_(data.title),
      normContent: data.normContentIndex ? String(row[data.normContentIndex - 1] || "") : normalizeText_(data.content),
      nouns: nouns,
      verbs: verbs,
      adjectives: adjectives,
      bigrams: bigrams,
      themes: themes.length ? themes : extractThemes_(allTokens.length ? allTokens : nouns.concat(verbs).concat(adjectives)),
      allTokens: allTokens.length
        ? allTokens
        : uniqueByFrequency_(
          nouns
            .concat(verbs)
            .concat(adjectives)
            .concat(
              bigrams
                .join(" ")
                .split(/\s+/)
                .filter(Boolean)
            )
        )
    };
  }

  var analysis = analyzeTextForIndex_(data.title + "\n" + data.content);
  return {
    normTitle: normalizeText_(data.title),
    normContent: normalizeText_(data.content),
    nouns: analysis.nouns,
    verbs: analysis.verbs,
    adjectives: analysis.adjectives,
    bigrams: analysis.bigrams,
    allTokens: analysis.allTokens,
    themes: analysis.themes
  };
}

function buildGiftExplanation_(matchedKeywords, mode) {
  var matched = flattenMatchedKeywords_(matchedKeywords || {}).filter(function (token) {
    return !isWeakGiftDisplayToken_(token);
  });
  var lead = matched.slice(0, 4).join(", ");
  if (mode === "associated") {
    if (!lead) return "Não encontrei um espelho exato, mas seu texto tocou este poema por vizinhança de imagens e vocabulário.";
    return "Não encontrei um espelho exato, mas seu texto tocou este poema por vizinhança de imagens: " + lead + ".";
  }
  if (!lead) return "Com elas, encontrei um pequeno presente literário para você.";
  return "Recolhi algumas palavras que insistiram no seu percurso: " + lead + ". Com elas, encontrei este presente literário.";
}

function buildDisplayTokenMap_(texts) {
  var map = {};
  (texts || []).forEach(function (text) {
    var matches = String(text || "").match(/[A-Za-zÀ-ÿ0-9]+/g) || [];
    matches.forEach(function (raw) {
      var clean = String(raw || "").trim();
      if (!clean) return;
      var normalized = normalizeText_(clean).replace(/[^a-z0-9]/g, "");
      if (!normalized || isWeakGiftDisplayToken_(normalized) || map[normalized]) return;
      map[normalized] = clean;
    });
  });
  return map;
}

function pickFallbackTokens_(userData, displayMap) {
  var nouns = formatDisplayTokens_(userData.nouns || [], displayMap, 3);
  var verbs = formatDisplayTokens_(userData.verbs || [], displayMap, 2);
  var adjectives = formatDisplayTokens_(userData.adjectives || [], displayMap, 2);
  var bigrams = formatDisplayTokens_(userData.bigrams || [], displayMap, 2);
  var allTokens = formatDisplayTokens_(userData.allTokens || [], displayMap, 5);
  var matched = uniqueByFrequency_(nouns.concat(verbs).concat(adjectives).concat(allTokens)).slice(0, 6);
  var seed = nouns[0] || verbs[0] || allTokens[0] || "palavra";

  return {
    nouns: nouns,
    verbs: verbs,
    adjectives: adjectives,
    bigrams: bigrams,
    allTokens: allTokens,
    matched: matched,
    seed: seed
  };
}

function formatDisplayTokens_(tokens, displayMap, limit) {
  var out = [];
  (tokens || []).forEach(function (token) {
    if (!token) return;
    var clean = normalizeText_(token).replace(/[^a-z0-9]/g, "");
    if (isWeakGiftDisplayToken_(clean)) return;
    var display = displayMap[clean] || token;
    if (out.indexOf(display) !== -1) return;
    out.push(display);
  });
  return out.slice(0, limit || out.length);
}

function composeFallbackBlessing_(selected, query) {
  var seed = selected.seed || "palavra";
  var second = selected.nouns[1] || selected.allTokens[1] || "eco";
  var third = selected.nouns[2] || selected.adjectives[0] || selected.allTokens[2] || "fresta";
  var verb = selected.verbs[0] || "seguir";
  var adverbial = selected.adjectives[0] || "vivo";
  var bigram = selected.bigrams[0] || [seed, second].join(" ");
  var signature = [seed, second, verb, query.trackKey || "", query.presenceKey || ""].join("|");
  var matchedLead = selected.matched.slice(0, 4).join(", ") || "alguns rastros do seu percurso";

  var introOptions = [
    "Antes de fechar a trilha, recolhi o que continuou aceso no seu caminho: " + matchedLead + ".",
    "Nem todo eco chega por um livro já aberto. Às vezes ele nasce do que você deixou vibrando: " + matchedLead + ".",
    "Do que você disse, algumas palavras resolveram permanecer comigo: " + matchedLead + "."
  ];

  var line1Options = [
    "Que " + seed + " não se apague quando a página pedir mais coragem.",
    "Guarde " + seed + " como quem guarda brasa debaixo do papel.",
    "Deixe " + seed + " repousar onde a escrita ainda procura forma."
  ];
  var line2Options = [
    "Se " + second + " voltar, deixe que ele encontre outro modo de " + verb + ".",
    "Quando " + second + " insistir, experimente ouvir o que ele quer " + verb + ".",
    "Se " + second + " abrir caminho, acompanhe sem apressar o verbo " + verb + "."
  ];
  var line3Options = [
    "Há um " + bigram + " pedindo nome mais nítido dentro do seu texto.",
    "O que hoje parece " + adverbial + " ainda pode ganhar contorno mais preciso.",
    "Entre " + seed + " e " + third + ", alguma forma nova já começou a respirar."
  ];
  var line4Options = [
    "Leve isto consigo: nem toda resposta encerra; algumas apenas começam.",
    "Fique com esta dobra: o que não fechou inteiro talvez seja o que merece voltar.",
    "A trilha termina aqui, mas o verso certo pode estar apenas mudando de lugar."
  ];

  return {
    intro: pickVariantBySignature_(signature + "|intro", introOptions),
    fragment: [
      pickVariantBySignature_(signature + "|l1", line1Options),
      pickVariantBySignature_(signature + "|l2", line2Options),
      pickVariantBySignature_(signature + "|l3", line3Options),
      pickVariantBySignature_(signature + "|l4", line4Options)
    ].join("\n")
  };
}

function pickVariantBySignature_(signature, options) {
  if (!options || !options.length) return "";
  var hash = hashString_(signature || "");
  return options[Math.abs(hash) % options.length];
}

function hashString_(text) {
  var hash = 0;
  var source = String(text || "");
  for (var i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return hash;
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

function preferMostViewedCandidates_(candidates) {
  if (!candidates || !candidates.length) return [];
  if (candidates.length <= 3) return candidates.slice();

  var byViews = candidates.slice().sort(function (a, b) {
    if ((b.views || 0) !== (a.views || 0)) return (b.views || 0) - (a.views || 0);
    return (b.score || 0) - (a.score || 0);
  });

  var keepCount = Math.max(3, Math.ceil(byViews.length * PREFERRED_VIEWS_FRACTION));
  return byViews.slice(0, keepCount);
}

function assessExcerptQuality_(text, title) {
  var raw = String(text || "").replace(/\r/g, "").trim();
  var normalized = normalizeText_(title + "\n" + raw);
  var letters = raw.match(/[A-Za-zÀ-ÿ]/g) || [];
  var upper = raw.match(/[A-ZÀ-Ý]/g) || [];
  var lines = raw.split(/\n/).map(function (line) { return String(line || "").trim(); }).filter(Boolean);
  var uppercaseRatio = letters.length ? upper.length / letters.length : 0;
  var fusedTransitions = raw.match(/[a-zà-ÿ][A-ZÀ-Ý]/g) || [];
  var longUpperRuns = raw.match(/[A-ZÀ-Ý]{4,}/g) || [];
  var punctuationCount = (raw.match(/[,.!?;:]/g) || []).length;
  var didacticHits = 0;
  [
    "cartilha", "vogais", "consoantes", "silabas", "alfabeto", "maiuscula",
    "minuscula", "letra", "letras", "tabuada", "licao", "exercicio"
  ].forEach(function (term) {
    if (normalized.indexOf(term) !== -1) didacticHits++;
  });

  var qualityDelta = 0;
  if (lines.length >= 2 && lines.length <= 10) qualityDelta += 1.2;
  if (punctuationCount >= 2) qualityDelta += 0.6;
  if (raw.length >= 40 && raw.length <= 420) qualityDelta += 0.6;

  if (uppercaseRatio > 0.32 && letters.length >= 40) qualityDelta -= 3.8;
  if (fusedTransitions.length >= 2) qualityDelta -= 3.2;
  if (longUpperRuns.length >= 2) qualityDelta -= 2.6;
  if (didacticHits >= 2) qualityDelta -= 5.5;
  if (normalized.indexOf("vogais") !== -1 && normalized.indexOf("consoantes") !== -1) qualityDelta -= 6;

  return {
    qualityDelta: qualityDelta,
    discard: qualityDelta <= -4.5
  };
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
  if (Array.isArray(matched)) {
    var seenArray = {};
    return matched.filter(function (token) {
      if (!token || seenArray[token]) return false;
      seenArray[token] = true;
      return true;
    });
  }
  var seen = {};
  var out = [];
  ["nouns", "verbs", "adjectives", "bigrams", "themes"].forEach(function (group) {
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

function readRowValueByHeaders_(headerMap, row, headers) {
  var index = findHeaderIndex_(headerMap, headers);
  if (!index) return "";
  return String(row[index - 1] || "").trim();
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePersonName_(value) {
  return normalizeLooseText_(value).replace(/\s+/g, " ").trim();
}

function normalizeLooseText_(value) {
  return normalizeText_(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function buildStableId_(prefix, parts) {
  var source = (parts || []).map(function (part) {
    return String(part || "").trim().toLowerCase();
  }).join("|");
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source);
  return String(prefix || "id") + "_" + bytesToHex_(bytes).slice(0, 16);
}

function bytesToHex_(bytes) {
  return (bytes || []).map(function (value) {
    var hex = (value < 0 ? value + 256 : value).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
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
