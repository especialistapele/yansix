/* ==========================================================
   YANSIX — RASTREAMENTO DO FUNIL DE DIAGNÓSTICO
   GA4: G-7DQJ6C4J1H
   ========================================================== */

(function () {
    "use strict";

    function registrarCliqueDiagnostico() {
        if (typeof window.gtag !== "function") {
            return;
        }

        const links = document.querySelectorAll(
            'a[href*="diagnostico.html"]'
        );

        links.forEach(function (link) {
            if (link.dataset.yansixTracking === "diagnostico") {
                return;
            }

            link.dataset.yansixTracking = "diagnostico";

            link.addEventListener("click", function () {
                const texto = (link.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim();

                window.gtag("event", "diagnostico_clique", {
                    origem_pagina:
                        window.location.pathname.split("/").pop() ||
                        "index.html",
                    texto_link: texto,
                    destino: "diagnostico.html"
                });
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            registrarCliqueDiagnostico
        );
    } else {
        registrarCliqueDiagnostico();
    }
})();

/**
 * YANSIX — Diagnóstico / GA4
 * Eventos complementares do funil.
 * Mantém os eventos existentes e adiciona rastreamento de progresso.
 */
(function () {
  function sendEvent(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
      return true;
    }
    return false;
  }

  window.yansixDiagnosticoTrack = window.yansixDiagnosticoTrack || {
    questionView: function (questionNumber, totalQuestions) {
      return sendEvent("diagnostico_question_view", {
        numero_pergunta: Number(questionNumber) || 0,
        total_perguntas: Number(totalQuestions) || 0,
        progresso_percentual: totalQuestions
          ? Math.round((Number(questionNumber) / Number(totalQuestions)) * 100)
          : 0
      });
    },

    questionAnswer: function (questionNumber, totalQuestions) {
      return sendEvent("diagnostico_question_answer", {
        numero_pergunta: Number(questionNumber) || 0,
        total_perguntas: Number(totalQuestions) || 0,
        progresso_percentual: totalQuestions
          ? Math.round((Number(questionNumber) / Number(totalQuestions)) * 100)
          : 0
      });
    },

    contactStart: function () {
      return sendEvent("diagnostico_contato_inicio", {});
    }
  };
})();

