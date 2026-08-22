// ==========================================================
// YANSIX
// CONTATO2 — ENVIO DUPLO: YANSIX CRM + PLANILHA "Contato Site"
// ==========================================================
// As duas requisições são disparadas em paralelo. O envio é
// considerado bem-sucedido se PELO MENOS UMA das duas planilhas
// receber o lead (para não travar o usuário por falha de uma
// integração enquanto a outra funciona normalmente).

// URL do Apps Script do YANSIX CRM (mesma usada em js/config.js -> CONFIG.SHEETS_API_URL)
// O lead cai na aba CLIENTES do CRM com status "lead".
const CONTATO2_CRM_URL =
  "https://script.google.com/macros/s/AKfycbwf9aeLdH2bkmjKUxHzON-7PXLWS3RTYvL5F-G-j-rSmxgkBkK8irrSC0prsbcFelHkMw/exec";

// URL do Apps Script antigo, que grava na planilha separada "Contato Site"
const CONTATO2_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbybtAe0LQVap8jwJa3eVlHxzp9HcfnFcGlLOXUlXPATeQeaOi9GtPz0E-9bu4ylw8bSZQ/exec";

// Rótulos das opções do <select id="c2assunto"> — usados só para deixar
// o texto do assunto legível dentro de "observacoes" no CRM.
const CONTATO2_ASSUNTO_LABELS = {
  websites: "Websites",
  ia: "Inteligência Artificial",
  branding: "Branding",
  sistemas: "Sistemas e Plataformas",
  automacao: "Automação",
  seo: "SEO e Performance",
  outro: "Outro assunto",
};

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

  const nome = pegarValorContato2("c2nome");
  const empresa = pegarValorContato2("c2empresa");
  const email = pegarValorContato2("c2email");
  const whatsapp = pegarValorContato2("c2whatsapp");
  const assuntoValor = pegarValorContato2("c2assunto");
  const assuntoLabel = CONTATO2_ASSUNTO_LABELS[assuntoValor] || assuntoValor;
  const mensagemTexto = pegarValorContato2("c2mensagem");

  // Payload no formato exigido pelo doPost do Yansix CRM (Code.gs, ação "lead")
  const payloadCRM = {
    action: "lead",
    data: {
      nome: nome,
      email: email,
      contato: whatsapp,
      whatsapp: whatsapp,
      empresa: empresa,
      origem: "Site",
      observacoes: assuntoLabel
        ? "Assunto: " + assuntoLabel + "\n\n" + mensagemTexto
        : mensagemTexto,
    },
  };

  // Payload no formato original, aceito pelo script da planilha "Contato Site"
  const payloadSheets = {
    origem: "Contato Site",
    data: new Date().toLocaleString("pt-BR"),
    nome: nome,
    empresa: empresa,
    email: email,
    whatsapp: whatsapp,
    assunto: assuntoValor,
    mensagem: mensagemTexto,
  };

  const enviarCRM = fetch(CONTATO2_CRM_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payloadCRM),
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (retorno) {
      // O CRM responde { ok: true, data: {...} } em caso de sucesso
      return !!(retorno && retorno.ok === true);
    })
    .catch(function (erro) {
      console.error("Erro envio contato2 (CRM):", erro);
      return false;
    });

  const enviarSheets = fetch(CONTATO2_SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payloadSheets),
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (retorno) {
      // Este script responde { status: "ok" } em caso de sucesso
      return !!(retorno && retorno.status === "ok");
    })
    .catch(function (erro) {
      console.error("Erro envio contato2 (Contato Site):", erro);
      return false;
    });

  Promise.all([enviarCRM, enviarSheets]).then(function (resultados) {
    const sucessoCRM = resultados[0];
    const sucessoSheets = resultados[1];

    // Sucesso se pelo menos uma das duas planilhas recebeu o lead
    if (sucessoCRM || sucessoSheets) {
      sucessoContato2();
    } else {
      erroContato2();
    }
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
