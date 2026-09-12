const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
const searchForm = document.querySelector(".search-box");
const searchInput = document.querySelector("#searchInput");
const categoryButtons = document.querySelectorAll("[data-category]");
const emptyState = document.querySelector(".empty-state");

menuButton?.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

mainNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    showCatalogMessage(
      "Preparando el catálogo Marketplace",
      "Aquí aparecerán los productos aprobados de los vendedores VIGNA."
    );
    return;
  }

  showCatalogMessage(
    `Resultados para “${searchTerm}”`,
    "El buscador quedará conectado a los productos aprobados de Firestore."
  );

  document.querySelector("#productos")?.scrollIntoView({
    behavior: "smooth"
  });
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;

    showCatalogMessage(
      category,
      `Aquí aparecerán los productos aprobados de la categoría ${category}.`
    );

    document.querySelector("#productos")?.scrollIntoView({
      behavior: "smooth"
    });
  });
});

function showCatalogMessage(title, description) {
  if (!emptyState) return;

  const heading = emptyState.querySelector("h3");
  const paragraph = emptyState.querySelector("p");

  if (heading) heading.textContent = title;
  if (paragraph) paragraph.textContent = description;
}
