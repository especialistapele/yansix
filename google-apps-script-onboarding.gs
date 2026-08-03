/**
 * ==========================================================
 * YANSIX — Onboarding do Cliente
 * Google Apps Script implantado (referência).
 *
 * Grava um resumo de cada envio na aba "CADASTROS" e cria uma
 * aba individual por cliente com todas as respostas completas
 * do formulário onboarding.html.
 *
 * URL implantada:
 * https://script.google.com/macros/s/AKfycbzCdV_D4QB5hKJs3Z2IU39XfC-A7fmSm97TZYcpJusoI9xzNfdrPJNqaVV1jk3MtT8Zgg/exec
 * (já configurada em js/onboarding.js)
 * ==========================================================
 */

const CADASTROS_SHEET_NAME = 'CADASTROS';
const CADASTROS_HEADERS = [
  'Data e hora do envio',
  'Nome completo do cliente',
  'E-mail',
  'Telefone',
  'Nome Fantasia',
  'Segmento de atuação'
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    appendToCadastros_(ss, data);
    const tabName = writeClientTab_(ss, data);

    return jsonResponse_({ ok: true, aba: tabName });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/** Garante que a aba CADASTROS existe (com cabeçalho) e adiciona a linha resumo. */
function appendToCadastros_(ss, data) {
  let sheet = ss.getSheetByName(CADASTROS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CADASTROS_SHEET_NAME, 0);
    sheet.appendRow(CADASTROS_HEADERS);
    sheet.getRange(1, 1, 1, CADASTROS_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(),
    data.nomeCompleto || '',
    data.email || '',
    data.telefone || '',
    data.nomeFantasia || '',
    data.segmentoAtuacao || ''
  ]);
}

/**
 * Cria uma aba individual nova para este envio (nunca sobrescreve uma
 * existente) e grava todas as respostas do formulário nela.
 */
function writeClientTab_(ss, data) {
  const baseName = sanitizeSheetName_(data.nomeCompleto || 'Cliente sem nome');
  const tabName = uniqueSheetName_(ss, baseName);

  const sheet = ss.insertSheet(tabName);
  sheet.appendRow(['Campo', 'Resposta']);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setFrozenRows(1);

  const resumo = [
    ['Data e hora do envio', formatDate_(new Date())],
    ['Nome completo', data.nomeCompleto || ''],
    ['E-mail', data.email || ''],
    ['Telefone', data.telefone || ''],
    ['Nome Fantasia', data.nomeFantasia || ''],
    ['Segmento de atuação', data.segmentoAtuacao || '']
  ];
  resumo.forEach(row => sheet.appendRow(row));

  const respostas = Array.isArray(data.respostas) ? data.respostas : [];
  respostas.forEach(item => {
    sheet.appendRow([item.campo || '', item.resposta || '']);
  });

  sheet.autoResizeColumn(1);
  sheet.setColumnWidth(2, 480);
  sheet.getRange(1, 1, sheet.getLastRow(), 2).setWrap(true);

  return tabName;
}

/** Remove caracteres não permitidos pelo Google Sheets em nomes de aba. */
function sanitizeSheetName_(name) {
  let clean = String(name).replace(/[\[\]\*\/\\\?:]/g, '').trim();
  if (!clean) clean = 'Cliente sem nome';
  if (clean.length > 90) clean = clean.substring(0, 90); // deixa espaço para sufixo "(N)"
  return clean;
}

/** Garante nome de aba único, adicionando " (2)", " (3)", etc. sem nunca sobrescrever. */
function uniqueSheetName_(ss, baseName) {
  let candidate = baseName;
  let n = 2;
  while (ss.getSheetByName(candidate)) {
    candidate = `${baseName} (${n})`;
    n++;
  }
  return candidate;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'GMT-3', 'dd/MM/yyyy HH:mm:ss');
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Função utilitária opcional para testar o script direto no editor do Apps Script. */
function testDoPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        nomeCompleto: 'João da Silva (teste)',
        email: 'joao@teste.com',
        telefone: '(22) 99999-9999',
        nomeFantasia: 'Empresa XYZ',
        segmentoAtuacao: 'Alimentação',
        respostas: [
          { campo: 'Razão social', resposta: 'Empresa XYZ LTDA' },
          { campo: 'Qual é o principal objetivo deste projeto?', resposta: 'Gerar mais vendas' }
        ]
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
