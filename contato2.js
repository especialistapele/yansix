/* ==========================================================
   contato2.js
   Lógica da página de contato (contato2.html):
   - Validação dos campos obrigatórios do formulário
   - Envio dos dados (com estrutura pronta para backend real)
   - Tratamento de erros e mensagens de sucesso
   - Acordeão de perguntas frequentes (FAQ)
   ========================================================== */
(function () {
  'use strict';

  /* ============================================================
     1) INTEGRAÇÃO COM BACKEND
     ------------------------------------------------------------
     MOCK_MODE = true  -> simula uma resposta do servidor
                          (útil para testar o front-end sem
                          um backend real disponível).
     MOCK_MODE = false -> envia de fato para ENDPOINT_URL via
                          fetch (POST + JSON).

     Quando o backend estiver pronto:
       1. Troque MOCK_MODE para false.
       2. Ajuste ENDPOINT_URL para a URL real da API.
       3. Garanta que o endpoint responda JSON e um status
          HTTP de sucesso (200–299) quando tudo der certo.
     ============================================================ */
  var MOCK_MODE = true;
  var ENDPOINT_URL = 'https://api.yansix.com.br/contato'; // TODO: apontar para o endpoint real

  document.addEventListener('DOMContentLoaded', function () {
    initContactForm();
    initFaqAccordion();
  });

  /* ============================================================
     FORMULÁRIO DE CONTATO
     ============================================================ */
  function initContactForm() {
    var form = document.getElementById('formContato2');
    if (!form) return;

    var waitMsg = document.getElementById('c2WaitMsg');
    var resultBox = document.getElementById('formMensagem');
    var submitBtn = document.getElementById('c2SubmitBtn');
    var submitBtnDefaultHTML = submitBtn.innerHTML;

    var fields = {
      nome: {
        el: document.getElementById('c2nome'),
        validate: validateRequired,
        errorMessage: 'Digite seu nome.'
      },
      empresa: {
        el: document.getElementById('c2empresa'),
        validate: validateRequired,
        errorMessage: 'Digite o nome da empresa.'
      },
      email: {
        el: document.getElementById('c2email'),
        validate: validateEmail,
        errorMessage: 'Digite um e-mail válido.'
      },
      whatsapp: {
        el: document.getElementById('c2whatsapp'),
        validate: validatePhone,
        errorMessage: 'Digite um telefone válido, com DDD.'
      },
      assunto: {
        el: document.getElementById('c2assunto'),
        validate: validateRequired,
        errorMessage: 'Selecione uma opção.'
      },
      mensagem: {
        el: document.getElementById('c2mensagem'),
        validate: validateMessage,
        errorMessage: 'Conte um pouco mais sobre seu desafio (mínimo de 10 caracteres).'
      }
    };

    // Remove o erro do campo assim que o usuário começa a corrigi-lo
    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      if (!field.el) return;
      field.el.addEventListener('input', function () {
        clearFieldError(field.el);
      });
      field.el.addEventListener('change', function () {
        clearFieldError(field.el);
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearResultMessage(resultBox);

      var isValid = validateAllFields(fields);
      if (!isValid) {
        showResultMessage(resultBox, 'error', 'Verifique os campos destacados e tente novamente.');
        focusFirstInvalidField(fields);
        return;
      }

      var payload = buildPayload(fields);
      setLoadingState(true, { waitMsg: waitMsg, submitBtn: submitBtn, defaultHTML: submitBtnDefaultHTML });

      sendContactData(payload)
        .then(function () {
          setLoadingState(false, { waitMsg: waitMsg, submitBtn: submitBtn, defaultHTML: submitBtnDefaultHTML });
          showResultMessage(
            resultBox,
            'success',
            '✅ Mensagem enviada com sucesso! Nosso time entrará em contato em breve.'
          );
          form.reset();
        })
        .catch(function (error) {
          setLoadingState(false, { waitMsg: waitMsg, submitBtn: submitBtn, defaultHTML: submitBtnDefaultHTML });
          showResultMessage(
            resultBox,
            'error',
            '⚠️ Não foi possível enviar sua mensagem agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.'
          );
          // Mantém o registro do erro real para diagnóstico técnico,
          // sem expor detalhes sensíveis ao usuário final.
          if (window.console && console.error) {
            console.error('Erro ao enviar formulário de contato:', error);
          }
        });
    });

    // -------------------- Validadores --------------------

    function validateRequired(value) {
      return value.trim().length > 0;
    }

    function validateEmail(value) {
      var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(value.trim());
    }

    function validatePhone(value) {
      var digits = value.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 13;
    }

    function validateMessage(value) {
      return value.trim().length >= 10;
    }

    // -------------------- Validação geral --------------------

    function validateAllFields(fieldsMap) {
      var allValid = true;

      Object.keys(fieldsMap).forEach(function (key) {
        var field = fieldsMap[key];
        if (!field.el) return;

        var value = field.el.value || '';
        if (!field.validate(value)) {
          allValid = false;
          setFieldError(field.el, field.errorMessage);
        }
      });

      return allValid;
    }

    function focusFirstInvalidField(fieldsMap) {
      var keys = Object.keys(fieldsMap);
      for (var i = 0; i < keys.length; i++) {
        var el = fieldsMap[keys[i]].el;
        if (el && el.closest('.form-field').classList.contains('has-error')) {
          el.focus();
          break;
        }
      }
    }

    // -------------------- Erros por campo --------------------

    function setFieldError(inputEl, message) {
      var wrap = inputEl.closest('.form-field');
      if (!wrap) return;

      clearFieldError(inputEl);
      wrap.classList.add('has-error');

      var errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      errorEl.textContent = message;
      wrap.appendChild(errorEl);
    }

    function clearFieldError(inputEl) {
      var wrap = inputEl.closest('.form-field');
      if (!wrap) return;

      wrap.classList.remove('has-error');
      var existingError = wrap.querySelector('.field-error');
      if (existingError) existingError.remove();
    }

    // -------------------- Mensagens de resultado --------------------

    function showResultMessage(box, type, message) {
      if (!box) return;
      box.className = 'form-message ' + type;
      box.textContent = message;
    }

    function clearResultMessage(box) {
      if (!box) return;
      box.className = '';
      box.textContent = '';
    }

    // -------------------- Estado de carregamento --------------------

    function setLoadingState(isLoading, refs) {
      if (isLoading) {
        refs.waitMsg.classList.add('is-visible');
        refs.submitBtn.disabled = true;
        refs.submitBtn.classList.add('is-loading');
        refs.submitBtn.innerHTML = 'Enviando...';
      } else {
        refs.waitMsg.classList.remove('is-visible');
        refs.submitBtn.disabled = false;
        refs.submitBtn.classList.remove('is-loading');
        refs.submitBtn.innerHTML = refs.defaultHTML;
      }
    }

    // -------------------- Payload --------------------

    function buildPayload(fieldsMap) {
      return {
        nome: fieldsMap.nome.el.value.trim(),
        empresa: fieldsMap.empresa.el.value.trim(),
        email: fieldsMap.email.el.value.trim(),
        whatsapp: fieldsMap.whatsapp.el.value.trim(),
        assunto: fieldsMap.assunto.el.value,
        mensagem: fieldsMap.mensagem.el.value.trim(),
        origem: 'contato2',
        pagina: window.location.href,
        enviadoEm: new Date().toISOString()
      };
    }

    // -------------------- Envio (mock ou real) --------------------

    function sendContactData(payload) {
      if (MOCK_MODE) {
        return mockSendContactData(payload);
      }
      return sendContactDataReal(payload);
    }

    // Simulação de resposta de servidor (usada enquanto MOCK_MODE = true)
    function mockSendContactData(payload) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ ok: true, payload: payload });
        }, 1200);
      });
    }

    // Implementação real, pronta para uso assim que o backend existir
    function sendContactDataReal(payload) {
      return fetch(ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) {
          throw new Error('Falha ao enviar formulário. Código HTTP: ' + response.status);
        }
        return response.json().catch(function () {
          return {};
        });
      });
    }
  }

  /* ============================================================
     ACORDEÃO DE PERGUNTAS FREQUENTES
     ============================================================ */
  function initFaqAccordion() {
    var items = document.querySelectorAll('#faqList .faq-item');
    if (!items.length) return;

    items.forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) return;

      question.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');

        items.forEach(function (otherItem) {
          if (otherItem !== item) {
            otherItem.classList.remove('is-open');
          }
        });

        item.classList.toggle('is-open', !isOpen);
      });
    });
  }
})();
