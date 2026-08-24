// ==========================================================
// YANSIX
// CONTATO2 — ENVIO DIRETO PARA O CRM / SUPABASE
// ==========================================================

const CONTATO2_CRM_URL =
  "https://zxeupenncextzrqgthqx.supabase.co/functions/v1/website-lead";

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

  const faqItems = document.querySelectorAll("#faqList .faq-item");

  faqItems.forEach(function (item) {
    const question = item.querySelector(".faq-question");

    if (!question) return;

    question.addEventListener("click", function () {
      const isOpen = item.classList.contains("open");

      faqItems.forEach(function (i) {
        i.classList.remove("open");
      });

      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });
});

function pegarValorContato2(id) {
  const campo = document.getElementById(id);
  return campo ? campo.value.trim() : "";
}

function mostrarMensagemContato2(texto, tipo) {
  const mensagem = document.getElementById("formMensagem");

  if (!mensagem) return;

  mensagem.className = tipo || "";
  mensagem.textContent = texto;
}

async function enviarContato2() {
  const botao = document.getElementById("c2SubmitBtn");
  const waitMsg = document.getElementById("c2WaitMsg");
  const form = document.getElementById("formContato2");

  if (!form) return;

  const nome = pegarValorContato2("c2nome");
  const empresa = pegarValorContato2("c2empresa");
  const email = pegarValorContato2("c2email");
  const whatsapp = pegarValorContato2("c2whatsapp");
  const assuntoValor = pegarValorContato2("c2assunto");
  const mensagemTexto = pegarValorContato2("c2mensagem");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const assuntoLabel =
    CONTATO2_ASSUNTO_LABELS[assuntoValor] || assuntoValor;

  if (botao) {
    botao.disabled = true;
    botao.classList.add("is-loading");
    botao.textContent = "Enviando...";
  }

  if (waitMsg) {
    waitMsg.classList.add("is-visible");
  }

  mostrarMensagemContato2("", "");

  const payload = {
    data: {
      nome: nome,
      empresa: empresa,
      email: email,
      whatsapp: whatsapp,
      contato: whatsapp,
      assunto: assuntoLabel,
      mensagem: mensagemTexto,
      origem: "Site"
    }
  };

  try {
    const response = await fetch(CONTATO2_CRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let retorno = null;

    try {
      retorno = await response.json();
    } catch (_) {
      retorno = null;
    }

    if (!response.ok || !retorno || retorno.ok !== true) {
      console.error("Erro CRM YANSIX:", retorno);

      throw new Error(
        retorno && retorno.error
          ? retorno.error
          : "Não foi possível registrar o lead."
      );
    }

    sucessoContato2();

  } catch (erro) {
    console.error("Erro envio contato2:", erro);
    erroContato2(erro && erro.message);
  }
}

function sucessoContato2() {
  const waitMsg = document.getElementById("c2WaitMsg");
  const botao = document.getElementById("c2SubmitBtn");
  const form = document.getElementById("formContato2");

  if (waitMsg) {
    waitMsg.classList.remove("is-visible");
  }

  mostrarMensagemContato2(
    "✅ Mensagem enviada com sucesso. Nosso time entrará em contato em breve.",
    "success"
  );

  if (form) {
    form.reset();
  }

  if (botao) {
    botao.disabled = false;
    botao.classList.remove("is-loading");
    botao.innerHTML =
      "Enviar mensagem <span>&rarr;</span>";
  }
}

function erroContato2(detalhe) {
  const waitMsg = document.getElementById("c2WaitMsg");
  const botao = document.getElementById("c2SubmitBtn");

  if (waitMsg) {
    waitMsg.classList.remove("is-visible");
  }

  mostrarMensagemContato2(
    detalhe
      ? "❌ Não foi possível enviar sua mensagem: " + detalhe
      : "❌ Não foi possível enviar sua mensagem. Tente novamente.",
    "error"
  );

  if (botao) {
    botao.disabled = false;
    botao.classList.remove("is-loading");
    botao.innerHTML =
      "Enviar mensagem <span>&rarr;</span>";
  }
}
