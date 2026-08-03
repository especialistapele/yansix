// ==========================================================
// YANSIX
// CONTATO2 — ENVIO GOOGLE SHEETS (ABA ÚNICA: "Contato Site")
// ==========================================================

// Substitua pela URL gerada ao publicar o Google Apps Script
// (ver arquivo google-apps-script-contato-site.gs para o código do lado do Sheets)
const CONTATO2_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbybtAe0LQVap8jwJa3eVlHxzp9HcfnFcGlLOXUlXPATeQeaOi9GtPz0E-9bu4ylw8bSZQ/exec";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("formContato2");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      enviarContato2();
    });
  }

  // Acordeão do FAQ
  const faqItems = document.querySelectorAll("#faqList .faq-item");
  faqItems.forEach(function (item) {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", function () {
      const isOpen = item.classList.contains("open");
      faqItems.forEach(function (i) {
        i.classList.remove("open");
      });
      if (!isOpen) item.classList.add("open");
    });
  });
});

function pegarValorContato2(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : "";
}

function enviarContato2() {
  const botao = document.getElementById("c2SubmitBtn");
  const waitMsg = document.getElementById("c2WaitMsg");
  const mensagem = document.getElementById("formMensagem");

  // Trava o botão e mostra aguarde
  if (botao) {
    botao.disabled = true;
    botao.innerHTML = "Enviando...";
  }
  if (waitMsg) waitMsg.classList.add("show");
  if (mensagem) mensagem.innerHTML = "";

  const lead = {
    origem: "Contato Site",
    data: new Date().toLocaleString("pt-BR"),
    nome: pegarValorContato2("c2nome"),
    empresa: pegarValorContato2("c2empresa"),
    email: pegarValorContato2("c2email"),
    whatsapp: pegarValorContato2("c2whatsapp"),
    assunto: pegarValorContato2("c2assunto"),
    mensagem: pegarValorContato2("c2mensagem"),
  };

  fetch(CONTATO2_SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(lead),
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (retorno) {
      if (retorno && retorno.status === "ok") {
        sucessoContato2();
      } else {
        erroContato2();
      }
    })
    .catch(function (erro) {
      console.error("Erro envio contato2:", erro);
      erroContato2();
    });
}

function sucessoContato2() {
  const waitMsg = document.getElementById("c2WaitMsg");
  const mensagem = document.getElementById("formMensagem");
  const botao = document.getElementById("c2SubmitBtn");
  const form = document.getElementById("formContato2");

  if (waitMsg) waitMsg.classList.remove("show");
  if (mensagem) {
    mensagem.innerHTML =
      '<div class="success-message">✅ Mensagem enviada com sucesso. Nosso time entrará em contato em breve.</div>';
  }
  if (form) form.reset();
  if (botao) {
    botao.disabled = false;
    botao.innerHTML = "Enviar mensagem &rarr;";
  }
}

function erroContato2() {
  const waitMsg = document.getElementById("c2WaitMsg");
  const mensagem = document.getElementById("formMensagem");
  const botao = document.getElementById("c2SubmitBtn");

  if (waitMsg) waitMsg.classList.remove("show");
  if (mensagem) {
    mensagem.innerHTML =
      '<div class="error-message">❌ Não foi possível enviar sua mensagem. Tente novamente.</div>';
  }
  if (botao) {
    botao.disabled = false;
    botao.innerHTML = "Enviar mensagem &rarr;";
  }
}
