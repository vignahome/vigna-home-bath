import "./mvp-profesionales-cloud-ui.js?v=21";
await import("./mvp-profesionales.js?v=14");

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .catch((error) => console.warn("No se pudo activar el modo instalable.", error));
  }, { once: true });
}
