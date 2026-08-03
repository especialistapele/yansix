// ==========================================================
// YANSIX
// PÁGINAS DE SOLUÇÃO — ACORDEÃO DE FAQ
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {
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
