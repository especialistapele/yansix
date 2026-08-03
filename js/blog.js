// ==========================================================
// YANSIX
// BLOG — FILTRO DE CATEGORIA E BUSCA (VISUAL)
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {
  const pills = document.querySelectorAll("#blogCategories .pill");
  const cards = document.querySelectorAll("#blogGrid .blog-card");
  const searchInput = document.getElementById("blogSearchInput");
  const emptyState = document.getElementById("blogEmptyState");

  let activeCategory = "todos";

  function applyFilters() {
    const term = (searchInput.value || "").trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(function (card) {
      const matchesCategory =
        activeCategory === "todos" || card.dataset.cat === activeCategory;
      const matchesSearch =
        term === "" || (card.dataset.title || "").includes(term);

      const visible = matchesCategory && matchesSearch;
      card.style.display = visible ? "" : "none";
      if (visible) visibleCount++;
    });

    emptyState.style.display = visibleCount === 0 ? "block" : "none";
  }

  pills.forEach(function (pill) {
    pill.addEventListener("click", function () {
      pills.forEach(function (p) {
        p.classList.remove("active");
      });
      pill.classList.add("active");
      activeCategory = pill.dataset.cat;
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
});
