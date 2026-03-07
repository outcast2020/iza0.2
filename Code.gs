/**
 * Script para registrar dados do App IZA (3 estágios: init/choice/final)
 * - Mantém 8 colunas (headers originais)
 * - Estado: UF do Brasil (AC..TO) ou INTERNACIONAL
 * - Origem: "Oficina Cordel 2.0" ou "Particular" (armazenado junto no campo ESTADO: "BA | Oficina Cordel 2.0")
 */

function setup() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = [
    "DATA/HORA",
    "ESCRITOR/A",
    "EMAIL",
    "MUNICÍPIO",
    "ESTADO",
    "TRILHA",
    "PERSONALIDADE DO BOT",
    "REGISTRO DOS ESCRITOS"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    var sessionId = String(data.sessionId || "").trim();
    var stage = String(data.stage || "").trim().toLowerCase(); // init | choice | final

    // --------- normalização de campos ---------
    var escritor = data.escritor || data.name || "";
    var email = data.email || "";
    var municipio = data.municipio || data.city || "";

    // estado pode vir em data.estado / data.state / data.stateUF
    var estadoRaw = data.estado || data.state || data.stateUF || "";
    var origemRaw = data.origem || data.source || ""; // "Oficina Cordel 2.0" | "Particular"

    var trilha = data.trilha || data.trackKey || "";
    var personalidade = data.personalidade || data.presenceName || data.presenceKey || "";

    // escritos/transcript
    var escritos =
      data.escritos ||
      data.transcript ||
      (Array.isArray(data.turns)
        ? data.turns
          .map(function (t) {
            var who = t.role === "user" ? "VOCÊ" : "IZA";
            return who + ":\n" + (t.text || "");
          })
          .join("\n\n")
        : "");

    // --------- helpers ---------
    var UFS = [
      "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
      "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    ];

    function normalizeUFOrInternational(x) {
      var s = String(x || "").trim().toUpperCase();
      if (!s) return "";

      // aceita várias formas e normaliza
      if (s === "INTERNACIONAL" || s === "INTERNATIONAl".toUpperCase() || s === "INT" || s === "INTL") {
        return "INTERNACIONAL";
      }
      if (s.indexOf("INTERNAC") !== -1) return "INTERNACIONAL";
      if (s.indexOf("INTERNAT") !== -1) return "INTERNACIONAL";

      // pega 2 primeiras letras se veio "BA - Bahia" etc
      var two = s.replace(/[^A-Z]/g, "").slice(0, 2);
      if (UFS.indexOf(two) !== -1) return two;

      // se não reconheceu, tenta comparar com lista direta
      if (UFS.indexOf(s) !== -1) return s;

      // fallback: se não for UF, marca como INTERNACIONAL
      return "INTERNACIONAL";
    }

    function normalizeOrigem(x) {
      var s = String(x || "").trim().toLowerCase();
      if (!s) return "";
      if (s.indexOf("oficina") !== -1) return "Oficina Cordel 2.0";
      if (s.indexOf("cordel") !== -1) return "Oficina Cordel 2.0";
      if (s.indexOf("part") !== -1) return "Particular";
      if (s.indexOf("priv") !== -1) return "Particular";
      // fallback: se veio qualquer coisa, tenta título
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function composeEstadoWithOrigem(estado, origem) {
      var eNorm = normalizeUFOrInternational(estado);
      var oNorm = normalizeOrigem(origem);

      // guarda origem junto do estado, sem mudar cabeçalho/colunas
      // ex: "BA | Oficina Cordel 2.0" ou "INTERNACIONAL | Particular"
      if (eNorm && oNorm) return eNorm + " | " + oNorm;
      if (eNorm) return eNorm;
      if (oNorm) return "INTERNACIONAL | " + oNorm;
      return "";
    }

    function findRowBySessionId(id) {
      if (!id) return -1;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return -1; // só cabeçalho
      var col = sheet.getRange(2, 8, lastRow - 1, 1).getValues(); // coluna 8
      for (var i = 0; i < col.length; i++) {
        var cell = String(col[i][0] || "");
        if (cell.indexOf("SESSION_ID:" + id) !== -1) return i + 2;
      }
      return -1;
    }

    function safeSet(row, colIndex1Based, value) {
      if (!row || row < 2) return;
      sheet.getRange(row, colIndex1Based).setValue(value);
    }

    // estado + origem no mesmo campo (col 5)
    var estadoComOrigem = composeEstadoWithOrigem(estadoRaw, origemRaw);

    // --------- lógica por estágio ---------
    if (stage === "init") {
      // cria linha inicial com dados básicos e marca sessionId no "escritos"
      var seed = "SESSION_ID:" + sessionId + "\n(Registro iniciado)";
      sheet.appendRow([new Date(), escritor, email, municipio, estadoComOrigem, "", "", seed]);

      return ContentService
        .createTextOutput("OK:init")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // choice/final: achar linha
    var row = findRowBySessionId(sessionId);

    // fallback se não achou
    if (row === -1) {
      var seed2 = "SESSION_ID:" + sessionId + "\n(Fallback: linha criada)";
      sheet.appendRow([new Date(), escritor, email, municipio, estadoComOrigem, "", "", seed2]);
      row = findRowBySessionId(sessionId);
    }

    if (stage === "choice") {
      // atualiza trilha/personalidade
      if (trilha) safeSet(row, 6, trilha);
      if (personalidade) safeSet(row, 7, personalidade);

      // atualiza básicos se vierem
      if (escritor) safeSet(row, 2, escritor);
      if (email) safeSet(row, 3, email);
      if (municipio) safeSet(row, 4, municipio);
      if (estadoComOrigem) safeSet(row, 5, estadoComOrigem);

      return ContentService
        .createTextOutput("OK:choice")
        .setMimeType(ContentService.MimeType.TEXT);
    }

    if (stage === "final") {
      if (trilha) safeSet(row, 6, trilha);
      if (personalidade) safeSet(row, 7, personalidade);

      var finalText =
        "SESSION_ID:" + sessionId +
        "\n" + (escritos || "(sem escritos)") +
        "\n\n(Fim do registro)";

      safeSet(row, 8, finalText);

      // ------- LOGICA DE ENVIO DE EMAIL -------
      var emailSentStatus = "";
      if (email && email.indexOf("@") !== -1) {
        try {
          var subject = "Seu registro - IZA no Cordel 2.0";
          var bodyTxt = "Olá " + (escritor || "Participante") + ",\n\n" +
            "Agradecemos sua participação. Segue abaixo o laudo resumo da sua escrita na trilha " + trilha + ".\n\n" +
            "Seu Texto Final / Escritos:\n" +
            (escritos || "") + "\n\n" +
            "Equipe Cordel 2.0";

          var bodyHtml =
            "<div style='font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eaeaea; padding: 20px; border-radius: 10px; background-color: #fdfdfd;'>" +
            "<div style='text-align: center; margin-bottom: 20px;'>" +
            "  <img src='https://raw.githubusercontent.com/outcast2020/iza/main/logo_cordel_positivo.png' alt='Logo Cordel 2.0' style='max-width: 150px;' />" +
            "  <h2 style='margin-top: 15px;'>Seu registro - IZA no Cordel 2.0</h2>" +
            "</div>" +
            "<p>Olá <strong>" + (escritor || "Participante") + "</strong>,</p>" +
            "<p>Agradecemos sua participação. Segue abaixo o resumo da sua interação guiada por IZA na <strong>" + trilha + "</strong>.</p>" +
            "<div style='background: #f4f4f4; padding: 15px; border-radius: 8px; white-space: pre-wrap; margin-bottom: 20px; border-left: 4px solid #a0896a; font-family: monospace;'>" +
            (escritos || "(sem escritos)") +
            "</div>" +
            "<p style='color: #666;'>Obrigado por escrever com a gente.<br><strong>Equipe Cordel 2.0</strong></p>" +
            "</div>";

          // Usando GmailApp (ou MailApp)
          GmailApp.sendEmail(email, subject, bodyTxt, {
            htmlBody: bodyHtml,
            name: "IZA no Cordel 2.0",
            replyTo: "contato@cordel2pontozero.com"
          });
          emailSentStatus = "OK:final_and_emailed";
        } catch (mailError) {
          // Se falhar o envio de e-mail por limite ou erro
          emailSentStatus = "OK:final_but_email_failed";
        }
      } else {
        emailSentStatus = "OK:final_no_email";
      }

      return ContentService
        .createTextOutput(emailSentStatus)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService
      .createTextOutput("OK:noop")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService
      .createTextOutput("Erro: " + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
