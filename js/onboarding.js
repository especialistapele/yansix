// ==========================================================
// YANSIX
// ONBOARDING DO CLIENTE — ENVIO GOOGLE SHEETS
// Envia { nomeCompleto, email, telefone, nomeFantasia,
// segmentoAtuacao, respostas: [{campo, resposta}, ...] }
// para bater com o Apps Script implantado (aba CADASTROS +
// aba individual por cliente). Ver google-apps-script-onboarding.gs
// ==========================================================

// URL gerada ao publicar o Google Apps Script
// (ver arquivo google-apps-script-onboarding.gs)
const ONBOARDING_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbzCdV_D4QB5hKJs3Z2IU39XfC-A7fmSm97TZYcpJusoI9xzNfdrPJNqaVV1jk3MtT8Zgg/exec";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("formOnboarding");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      enviarOnboarding();
    });
  }
});

function coletarDadosOnboarding() {
  const respostas = [];

  // Percorre todos os campos na ordem em que aparecem no documento
  document
    .querySelectorAll("[data-field], [data-field-radio], [data-field-checkbox]")
    .forEach(function (campo) {
      if (campo.hasAttribute("data-field")) {
        const chave = campo.getAttribute("data-field");
        const valor = campo.value ? campo.value.trim() : "";
        respostas.push({ campo: chave, resposta: valor });
      }
    });

  // Grupos de rádio (escolha única) — evita duplicar por causa de vários inputs com a mesma chave
  const chavesRadio = [];
  document.querySelectorAll("[data-field-radio]").forEach(function (campo) {
    const chave = campo.getAttribute("data-field-radio");
    if (chavesRadio.indexOf(chave) === -1) chavesRadio.push(chave);
  });
  chavesRadio.forEach(function (chave) {
    const selecionado = document.querySelector(
      '[data-field-radio="' + chave + '"]:checked'
    );
    respostas.push({ campo: chave, resposta: selecionado ? selecionado.value : "" });
  });

  // Grupos de checkbox (múltipla escolha, valores separados por vírgula)
  const chavesCheckbox = [];
  document.querySelectorAll("[data-field-checkbox]").forEach(function (campo) {
    const chave = campo.getAttribute("data-field-checkbox");
    if (chavesCheckbox.indexOf(chave) === -1) chavesCheckbox.push(chave);
  });
  chavesCheckbox.forEach(function (chave) {
    const marcados = document.querySelectorAll(
      '[data-field-checkbox="' + chave + '"]:checked'
    );
    const valor = Array.prototype.map
      .call(marcados, function (c) {
        return c.value;
      })
      .join(", ");
    respostas.push({ campo: chave, resposta: valor });
  });

  // Campos-resumo exigidos pelo Apps Script (aba CADASTROS + nome da aba individual)
  function valorDoCampo(nomeCampo) {
    const el = document.querySelector('[data-field="' + nomeCampo + '"]');
    return el && el.value ? el.value.trim() : "";
  }

  const telefone =
    valorDoCampo("Telefone do Responsável") ||
    valorDoCampo("WhatsApp do Responsável") ||
    "";

  return {
    nomeCompleto: valorDoCampo("Nome do Responsável"),
    email: valorDoCampo("E-mail do Responsável"),
    telefone: telefone,
    nomeFantasia: valorDoCampo("Nome Fantasia"),
    segmentoAtuacao: valorDoCampo("Segmento de Atuação"),
    respostas: respostas,
  };
}

function enviarOnboarding() {
  const botao = document.getElementById("obSubmitBtn");
  const waitMsg = document.getElementById("obWaitMsg");
  const mensagem = document.getElementById("obMensagem");

  if (botao) {
    botao.disabled = true;
    botao.innerHTML = "Enviando...";
  }
  if (waitMsg) waitMsg.classList.add("show");
  if (mensagem) mensagem.innerHTML = "";

  const dados = coletarDadosOnboarding();

  fetch(ONBOARDING_SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(dados),
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (retorno) {
      if (retorno && retorno.ok === true) {
        sucessoOnboarding();
      } else {
        erroOnboarding();
      }
    })
    .catch(function (erro) {
      console.error("Erro envio onboarding:", erro);
      erroOnboarding();
    });
}

function sucessoOnboarding() {
  const waitMsg = document.getElementById("obWaitMsg");
  const mensagem = document.getElementById("obMensagem");
  const botao = document.getElementById("obSubmitBtn");
  const form = document.getElementById("formOnboarding");

  if (waitMsg) waitMsg.classList.remove("show");
  if (mensagem) {
    mensagem.innerHTML =
      '<div class="success-message">✅ Onboarding enviado com sucesso. Obrigado por dedicar seu tempo — nossa equipe vai analisar as respostas com atenção.</div>';
  }
  if (form) form.reset();
  if (botao) {
    botao.disabled = false;
    botao.innerHTML = "Enviar Onboarding &rarr;";
  }
  if (mensagem) mensagem.scrollIntoView({ behavior: "smooth", block: "center" });
}

function erroOnboarding() {
  const waitMsg = document.getElementById("obWaitMsg");
  const mensagem = document.getElementById("obMensagem");
  const botao = document.getElementById("obSubmitBtn");

  if (waitMsg) waitMsg.classList.remove("show");
  if (mensagem) {
    mensagem.innerHTML =
      '<div class="error-message">❌ Não foi possível enviar suas respostas. Tente novamente.</div>';
  }
  if (botao) {
    botao.disabled = false;
    botao.innerHTML = "Enviar Onboarding &rarr;";
  }
}
