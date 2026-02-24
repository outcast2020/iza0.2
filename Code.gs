/**
 * IZA no Cordel 2.0 — Registro de sessões
 * Recebe payload JSON do app (fetch POST):
 * {
 *  sessionId, startedAtISO, endedAtISO, page,
 *  name, email,
 *  presenceKey, presenceName,
 *  trackKey,
 *  turns: [{role, text, meta:{track, step, presence, t, round?}}]
 * }
 */

const SHEET_ID = "1a5v9VI8GUACSJ5pxUMhCBnzQzLtBmK6gAMx28GqQEGo";

// Troque pelo e-mail do professor responsável:
const PROFESSOR_EMAIL = "contato@cordel2pontozero.com";

// Nome das abas (o script cria se não existir)
const SHEET_SESSOES = "Sessoes";
const SHEET_TURNOS  = "Turnos";

function doGet() {
  return jsonOut({
    ok: true,
    message: "WebApp ativo. Use POST (JSON) para registrar sessões."
  });
}

function doPost(e) {
  // Proteção: rodar manualmente no editor dá e undefined
  if (!e || !e.postData || !e.postData.contents) {
    return jsonOut({
      ok: false,
      error: "Sem postData. doPost só funciona via requisição HTTP POST."
    });
  }

  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: "JSON inválido", details: String(err) });
  }

  // Validações mínimas
  const sessionId = safeStr(data.sessionId) || ("iza-" + Date.now());
  const name = safeStr(data.name);
  const email = safeStr(data.email);
  const presenceKey = safeStr(data.presenceKey);
  const presenceName = safeStr(data.presenceName);
  const trackKey = safeStr(data.trackKey);
  const startedAt = safeStr(data.startedAtISO);
  const endedAt = safeStr(data.endedAtISO);
  const page = safeStr(data.page);

  const turns = Array.isArray(data.turns) ? data.turns : [];

  // Abre planilha e prepara abas
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const shSessions = ensureSheet_(ss, SHEET_SESSOES, [
    "sessionId",
    "timestamp_start",
    "timestamp_end",
    "nome",
    "email",
    "presenca_key",
    "presenca_nome",
    "trilha",
    "page",
    "turns_count",
    "historico_texto"
  ]);

  const shTurns = ensureSheet_(ss, SHEET_TURNOS, [
    "sessionId",
    "turn_index",
    "role",
    "texto",
    "t",
    "track",
    "step",
    "presence",
    "round"
  ]);

  // Monta texto “bonito” do histórico
  const pretty = formatPrettyHistory_(sessionId, name, email, presenceName, trackKey, startedAt, endedAt, turns);

  // 1) Salva uma linha por sessão
  shSessions.appendRow([
    sessionId,
    startedAt || "",
    endedAt || "",
    name || "",
    email || "",
    presenceKey || "",
    presenceName || "",
    trackKey || "",
    page || "",
    turns.length,
    pretty
  ]);

  // 2) Salva uma linha por turno
  turns.forEach((turn, idx) => {
    const role = safeStr(turn.role);
    const texto = safeStr(turn.text);
    const meta = (turn && turn.meta) ? turn.meta : {};
    shTurns.appendRow([
      sessionId,
      idx + 1,
      role,
      texto,
      safeStr(meta.t),
      safeStr(meta.track),
      safeStr(meta.step),
      safeStr(meta.presence),
      safeStr(meta.round)
    ]);
  });

  // 3) Envio de e-mails
  // assunto e corpo
  const subjectUser = "Seu registro de escrita com IZA (Cordel 2.0)";
  const subjectProf = `Registro IZA — ${name || "sem nome"} (${presenceName || "IZA"})`;

  // Só envia se tiver email válido
  if (isValidEmail_(email)) {
    MailApp.sendEmail(email, subjectUser, pretty);
  }
  if (isValidEmail_(PROFESSOR_EMAIL)) {
    MailApp.sendEmail(PROFESSOR_EMAIL, subjectProf, pretty);
  }

  return jsonOut({ ok: true, sessionId });
}

// ---------- Helpers ----------

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isValidEmail_(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function ensureSheet_(ss, name, headerRow) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headerRow);
    sh.setFrozenRows(1);
  } else {
    // garante cabeçalho se estiver vazio
    if (sh.getLastRow() === 0) {
      sh.appendRow(headerRow);
      sh.setFrozenRows(1);
    } else if (sh.getLastRow() === 1) {
      const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      // se primeira célula não bate com header, não sobrescreve automaticamente (pra não quebrar planilha existente)
      // mas você pode limpar a aba e deixar o script recriar.
    }
  }
  return sh;
}

function formatPrettyHistory_(sessionId, name, email, presenceName, trackKey, startedAt, endedAt, turns) {
  const lines = [];

  lines.push("IZA no Cordel 2.0 — Registro de escrita");
  lines.push("---------------------------------------");
  lines.push(`Sessão: ${sessionId}`);
  if (startedAt) lines.push(`Início: ${startedAt}`);
  if (endedAt) lines.push(`Fim: ${endedAt}`);
  if (name) lines.push(`Nome: ${name}`);
  if (email) lines.push(`Email: ${email}`);
  if (presenceName) lines.push(`Presença: ${presenceName}`);
  if (trackKey) lines.push(`Trilha: ${trackKey}`);
  lines.push("");

  // Histórico em estilo “chat”
  turns.forEach((turn, i) => {
    const role = safeStr(turn.role).toLowerCase();
    const text = safeStr(turn.text).trim();
    const meta = (turn && turn.meta) ? turn.meta : {};
    const t = safeStr(meta.t);

    const who = role === "iza" ? "IZA" : "Você";
    const stamp = t ? ` (${t})` : "";
    lines.push(`${i + 1}. ${who}${stamp}:`);
    lines.push(text ? text : "[vazio]");
    lines.push("");
  });

  // Resumo simples: primeira e última fala do usuário
  const userTexts = turns.filter(t => safeStr(t.role).toLowerCase() === "user").map(t => safeStr(t.text).trim()).filter(Boolean);
  if (userTexts.length) {
    lines.push("Resumo:");
    lines.push(`- Primeira escrita: ${truncate_(userTexts[0], 260)}`);
    lines.push(`- Última versão: ${truncate_(userTexts[userTexts.length - 1], 260)}`);
  }

  lines.push("");
  lines.push("— Projeto IZA / Cordel 2.0");
  return lines.join("\n");
}

function truncate_(s, max) {
  const t = safeStr(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
function authMailOnce() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Teste IZA", "Autorização MailApp ok.");
