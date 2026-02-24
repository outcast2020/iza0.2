/**
 * Apps Script para gravar o registro de jogadas da IZA em uma planilha e enviar e-mails.
 * Vincule este script a uma planilha do Google com ID especificado em SHEET_ID.
 */

const SHEET_ID = '1TIblPPpKQAHUejfFh4chV7DGGuqkUKP3lEe7aq9rtMo';
// Atualize com o e‑mail do professor que deve receber cópias das jogadas
const PROFESSOR_EMAIL = 'professor@example.com';

/**
 * Função chamada pela interface web via google.script.run
 * @param {Object} payload Objeto contendo name, email, profile, track, conversation
 * conversation: array de objetos { prompt, user }
 */
function saveGameLog(payload) {
  if (!payload) {
    throw new Error('Nenhum dado recebido.');
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Registro');
  if (!sheet) {
    sheet = ss.insertSheet('Registro');
    // cabeçalho
    sheet.appendRow(['Timestamp','Nome','Email','Perfil','Trilha','Conversação']);
  }
  const timestamp = new Date();
  // Concatena prompt e resposta em uma string única
  const convLines = payload.conversation.map(item => {
    return item.prompt.replace(/\n/g, ' ') + ' || ' + item.user;
  }).join('\n');
  sheet.appendRow([timestamp, payload.name, payload.email, payload.profile, payload.track, convLines]);
  // Monta corpo do email
  const subject = 'Registro da sua escrita com IZA';
  let body = 'Olá ' + payload.name + ',\n\n';
  body += 'Obrigado por usar a IZA no Cordel 2.0!\n';
  body += 'Perfil: ' + payload.profile + '\n';
  body += 'Trilha: ' + payload.track + '\n\n';
  body += 'Histórico da sua conversa:\n';
  body += convLines + '\n\n';
  body += 'Este é um registro para você acompanhar o desenvolvimento da sua escrita.\n\n';
  body += 'Atenciosamente,\nProjeto IZA';
  // Envia email ao jogador
  GmailApp.sendEmail(payload.email, subject, body);
  // E-mail ao professor
  GmailApp.sendEmail(PROFESSOR_EMAIL, 'Registro de escrita de ' + payload.name, body);
  return { ok: true };
}