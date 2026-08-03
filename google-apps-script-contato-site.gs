/**
 * ==========================================================
 * YANSIX — Contato Site
 * Google Apps Script: recebe o POST do formulário contato2.html
 * e grava os dados em uma única aba chamada "Contato Site".
 * ==========================================================
 *
 * COMO IMPLANTAR:
 * 1. Abra (ou crie) uma planilha Google Sheets.
 * 2. Menu Extensões > Apps Script.
 * 3. Apague o conteúdo padrão e cole todo este arquivo.
 * 4. Clique em "Implantar" > "Nova implantação".
 * 5. Tipo: "Aplicativo da Web".
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL gerada (termina em /exec).
 * 7. Cole essa URL na constante CONTATO2_SHEETS_URL,
 *    no arquivo js/contato2.js do site.
 * 8. A aba "Contato Site" é criada automaticamente no
 *    primeiro envio, com o cabeçalho já formatado.
 */

const NOME_ABA = "Contato Site";

const CABECALHO = [
  "Data/Hora",
  "Nome",
  "Empresa",
  "E-mail",
  "WhatsApp",
  "Assunto",
  "Mensagem",
  "Origem",
];

function doPost(e) {
  try {
    const planilha = SpreadsheetApp.getActiveSpreadsheet();
    const aba = obterOuCriarAba(planilha);

    const dados = JSON.parse(e.postData.contents);

    aba.appendRow([
      dados.data || new Date().toLocaleString("pt-BR"),
      dados.nome || "",
      dados.empresa || "",
      dados.email || "",
      dados.whatsapp || "",
      dados.assunto || "",
      dados.mensagem || "",
      dados.origem || "Contato Site",
    ]);

    return respostaJson({ status: "ok" });
  } catch (erro) {
    return respostaJson({ status: "erro", mensagem: erro.message });
  }
}

function obterOuCriarAba(planilha) {
  let aba = planilha.getSheetByName(NOME_ABA);

  if (!aba) {
    aba = planilha.insertSheet(NOME_ABA);
    aba.appendRow(CABECALHO);
    aba.getRange(1, 1, 1, CABECALHO.length)
      .setFontWeight("bold")
      .setBackground("#1a1533")
      .setFontColor("#ffffff");
    aba.setFrozenRows(1);
    aba.autoResizeColumns(1, CABECALHO.length);
  }

  return aba;
}

function respostaJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Função de teste opcional — pode ser executada manualmente
 * no editor do Apps Script para validar a criação da aba.
 */
function testeManual() {
  const evento = {
    postData: {
      contents: JSON.stringify({
        nome: "Teste YANSIX",
        empresa: "Empresa Teste",
        email: "teste@yansix.com.br",
        whatsapp: "(41) 90000-0000",
        assunto: "Websites",
        mensagem: "Mensagem de teste do formulário.",
        origem: "Contato Site",
        data: new Date().toLocaleString("pt-BR"),
      }),
    },
  };
  doPost(evento);
}
