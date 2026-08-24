// ==========================================================
// YANSIX
// CONTATO2 — ENVIO DIRETO PARA O SUPABASE / YANSIX CRM
// ==========================================================
// Este arquivo não utiliza mais Google Sheets.
// O lead é enviado diretamente para a Edge Function
// "website-lead", que grava na tabela public.clientes.
//
// Fluxo:
//
// FORMULÁRIO DO SITE
//        ↓
// Edge Function: website-lead
//        ↓
// Supabase PostgreSQL
//        ↓
// public.clientes
//
// ==========================================================


// ==========================================================
// CONFIGURAÇÃO
// ==========================================================

const CONTATO2_CRM_URL =
  "https://zxeupenncextzrqgthqx.supabase.co/functions/v1/website-lead";


// ==========================================================
// RÓTULOS DOS ASSUNTOS
// ==========================================================

const CONTATO2_ASSUNTO_LABELS = {
  websites: "Websites",
  ia: "Inteligência Artificial",
  branding: "Branding",
  sistemas: "Sistemas e Plataformas",
  automacao: "Automação",
  seo: "SEO e Performance",
  outro: "Outro assunto",
};


// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {

  const form = document.getElementById("formContato2");

  if (form) {

    form.addEventListener("submit", function (e) {

      e.preventDefault();

      enviarContato2();

    });

  }


  // ========================================================
  // ACORDEÃO DO FAQ
  // ========================================================

  const faqItems =
    document.querySelectorAll("#faqList .faq-item");


  faqItems.forEach(function (item) {

    const question =
      item.querySelector(".faq-question");


    if (!question) return;


    question.addEventListener("click", function () {

      const isOpen =
        item.classList.contains("open");


      faqItems.forEach(function (i) {

        i.classList.remove("open");

      });


      if (!isOpen) {

        item.classList.add("open");

      }

    });

  });

});


// ==========================================================
// PEGAR VALOR DOS CAMPOS
// ==========================================================

function pegarValorContato2(id) {

  const campo =
    document.getElementById(id);


  return campo
    ? campo.value.trim()
    : "";

}


// ==========================================================
// ENVIO DO FORMULÁRIO
// ==========================================================

async function enviarContato2() {

  const botao =
    document.getElementById("c2SubmitBtn");

  const waitMsg =
    document.getElementById("c2WaitMsg");

  const mensagem =
    document.getElementById("formMensagem");


  // ========================================================
  // EVITA DUPLO ENVIO
  // ========================================================

  if (botao && botao.disabled) {

    return;

  }


  // ========================================================
  // BLOQUEIA BOTÃO
  // ========================================================

  if (botao) {

    botao.disabled = true;

    botao.classList.add("is-loading");

    botao.innerHTML =
      "Enviando...";

  }


  if (waitMsg) {

    waitMsg.classList.add("is-visible");

  }


  if (mensagem) {

    mensagem.className = "";

    mensagem.innerHTML = "";

  }


  // ========================================================
  // PEGAR DADOS
  // ========================================================

  const nome =
    pegarValorContato2("c2nome");

  const empresa =
    pegarValorContato2("c2empresa");

  const email =
    pegarValorContato2("c2email");

  const whatsapp =
    pegarValorContato2("c2whatsapp");

  const assuntoValor =
    pegarValorContato2("c2assunto");

  const assuntoLabel =
    CONTATO2_ASSUNTO_LABELS[assuntoValor]
    || assuntoValor;

  const mensagemTexto =
    pegarValorContato2("c2mensagem");


  // ========================================================
  // VALIDAÇÃO
  // ========================================================

  if (
    !nome ||
    !empresa ||
    !email ||
    !whatsapp ||
    !assuntoValor ||
    !mensagemTexto
  ) {

    erroContato2(
      "Preencha todos os campos obrigatórios."
    );

    return;

  }


  // ========================================================
  // VALIDAÇÃO SIMPLES DE E-MAIL
  // ========================================================

  const emailValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);


  if (!emailValido) {

    erroContato2(
      "Digite um e-mail válido."
    );

    return;

  }


  // ========================================================
  // PAYLOAD
  // ========================================================
  //
  // A Edge Function "website-lead" aceita:
  //
  // {
  //   data: {
  //      nome,
  //      empresa,
  //      email,
  //      whatsapp,
  //      contato,
  //      assunto,
  //      mensagem,
  //      origem
  //   }
  // }
  //
  // ========================================================

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


  // ========================================================
  // ENVIO DIRETO PARA SUPABASE
  // ========================================================

  try {

    const response =
      await fetch(
        CONTATO2_CRM_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );


    // ======================================================
    // TENTA LER RESPOSTA JSON
    // ======================================================

    let retorno = null;


    try {

      retorno =
        await response.json();

    } catch (jsonError) {

      console.error(
        "Resposta não-JSON da Edge Function:",
        jsonError
      );

    }


    // ======================================================
    // VERIFICA RESPOSTA
    // ======================================================

    if (
      !response.ok ||
      !retorno ||
      retorno.ok !== true
    ) {

      console.error(
        "Erro retornado pelo CRM:",
        retorno
      );


      const erro =
        retorno &&
        retorno.error
          ? retorno.error
          : "Não foi possível registrar sua mensagem no CRM.";


      throw new Error(erro);

    }


    // ======================================================
    // SUCESSO
    // ======================================================

    console.log(
      "Lead registrado no YANSIX CRM:",
      retorno.data
    );


    sucessoContato2();


  } catch (erro) {

    console.error(
      "Erro envio contato2 para Supabase:",
      erro
    );


    erroContato2(
      "Não foi possível enviar sua mensagem. Tente novamente."
    );

  }

}


// ==========================================================
// SUCESSO
// ==========================================================

function sucessoContato2() {

  const waitMsg =
    document.getElementById("c2WaitMsg");

  const mensagem =
    document.getElementById("formMensagem");

  const botao =
    document.getElementById("c2SubmitBtn");

  const form =
    document.getElementById("formContato2");


  if (waitMsg) {

    waitMsg.classList.remove("is-visible");

  }


  if (mensagem) {

    mensagem.className =
      "success";

    mensagem.innerHTML =
      "✅ Mensagem enviada com sucesso. " +
      "Nosso time entrará em contato em breve.";

  }


  if (form) {

    form.reset();

  }


  if (botao) {

    botao.disabled = false;

    botao.classList.remove("is-loading");

    botao.innerHTML =
      "Enviar mensagem &rarr;";

  }

}


// ==========================================================
// ERRO
// ==========================================================

function erroContato2(
  texto
) {

  const waitMsg =
    document.getElementById("c2WaitMsg");

  const mensagem =
    document.getElementById("formMensagem");

  const botao =
    document.getElementById("c2SubmitBtn");


  if (waitMsg) {

    waitMsg.classList.remove("is-visible");

  }


  if (mensagem) {

    mensagem.className =
      "error";

    mensagem.innerHTML =
      "❌ " +
      (
        texto ||
        "Não foi possível enviar sua mensagem. Tente novamente."
      );

  }


  if (botao) {

    botao.disabled = false;

    botao.classList.remove("is-loading");

    botao.innerHTML =
      "Enviar mensagem &rarr;";

  }

}
