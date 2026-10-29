/**
 * Recebe os acessos do Instagram enviados no onboarding do cliente (/bem-vindo/...)
 * e grava uma linha na aba "Acessos" desta planilha.
 *
 * Como usar: na planilha do Google, Extensões → Apps Script, cole este código,
 * Implantar → Nova implantação → App da Web (Executar como: eu; Quem pode acessar: qualquer pessoa)
 * e cadastre a URL gerada no segredo INOVA_ACCESS_SHEET_URL do Supabase.
 */
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName('Acessos') || book.insertSheet('Acessos');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Recebido em', 'Cliente', 'Instagram', 'Senha', 'E-mail/celular do código',
      'Responsável pelo celular', 'WhatsApp do responsável', 'Ligação marcada', 'Observações']);
    sheet.setFrozenRows(1);
  }
  // Apóstrofo na frente: senha ou telefone começando com =, + ou - não vira fórmula
  var text = function (v) { return "'" + String(v || ''); };
  sheet.appendRow([new Date(), text(d.cliente), text('@' + d.instagram), text(d.senha), text(d.contato_codigo),
    text(d.responsavel), text(d.whatsapp), text(d.ligacao), text(d.observacoes)]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
