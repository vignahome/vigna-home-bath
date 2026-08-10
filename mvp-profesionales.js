(function () {
  "use strict";

  const STORAGE_KEY = "vigna_profesionales_mvp_v1";
  const profesiones = [
    "Plomería", "Gasfitería", "Instalación de productos VIGNA", "Electricidad",
    "Albañilería", "Drywall", "Pintura", "Enchapado", "Porcelanato", "Herrería",
    "Soldadura", "Carpintería metálica", "Carpintería de madera", "Melamina",
    "Vidriería", "Aluminio y mamparas", "Maestro de obra", "Arquitectura",
    "Ingeniería civil", "Ingeniería sanitaria", "Ingeniería eléctrica", "Topografía",
    "Diseño de interiores", "Remodelación de baños", "Remodelación de cocinas",
    "Construcción general"
  ];

  const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const hoy = () => new Date().toLocaleDateString("es-PE", { dateStyle: "medium" });
  const nowIso = () => new Date().toISOString();
  const escapar = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const dinero = (value) => `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const enmascararDocumento = (value = "") => {
    const documentNumber = String(value || "").trim();
    if (!documentNumber) return "Sin número";
    if (documentNumber.includes("*")) return documentNumber;
    const visibleCharacters = Math.min(3, documentNumber.length);
    return `${"*".repeat(Math.max(3, documentNumber.length - visibleCharacters))}${documentNumber.slice(-visibleCharacters)}`;
  };
  const htmlSeguro = (value) => ({ __htmlSeguro: String(value) });

  function seedData() {
    return {
      version: 1,
      profesionales: [
        {
          id: "PV-DEMO-001", nombres: "Carlos", apellidos: "Ramírez", correo: "carlos@demo.pe",
          whatsapp: "999999999", tipoDocumento: "DNI", documento: "***456", departamento: "Lima",
          provincia: "Lima", distrito: "Surco", profesiones: ["Plomería", "Gasfitería", "Instalación de productos VIGNA"],
          profesionPrincipal: "Plomería", experiencia: 9, coberturaTipo: "Local",
          coberturaDetalle: "Lima: Surco, Miraflores, San Borja y La Molina", distancia: "25 km",
          recargo: "S/ 25 fuera de zona", descripcion: "Especialista en instalaciones sanitarias, griferías y remodelación de baños con enfoque en acabados premium.",
          estado: "Aprobado", plan: "Anual", calificacion: 4.9, trabajos: 28, fotoIniciales: "CR", creadoEn: nowIso(), documentosDeclarados: 3,
          portafolio: []
        },
        {
          id: "PV-DEMO-002", nombres: "Miguel", apellidos: "Torres", correo: "miguel@demo.pe",
          whatsapp: "988888888", tipoDocumento: "DNI", documento: "***902", departamento: "Lima",
          provincia: "Lima", distrito: "Miraflores", profesiones: ["Electricidad", "Instalación de productos VIGNA"],
          profesionPrincipal: "Electricidad", experiencia: 7, coberturaTipo: "Departamentos",
          coberturaDetalle: "Lima y Callao", distancia: "40 km", recargo: "Según distancia",
          descripcion: "Electricista para instalaciones domiciliarias, luminarias y espejos LED. Trabajo documentado y ordenado.",
          estado: "Aprobado", plan: "Semestral", calificacion: 4.7, trabajos: 16, fotoIniciales: "MT", creadoEn: nowIso(), documentosDeclarados: 3,
          portafolio: []
        },
        {
          id: "PV-DEMO-003", nombres: "Ana", apellidos: "Flores", correo: "ana@demo.pe",
          whatsapp: "977777777", tipoDocumento: "DNI", documento: "***115", departamento: "Lima",
          provincia: "Lima", distrito: "San Miguel", profesiones: ["Melamina", "Carpintería de madera", "Diseño de interiores"],
          profesionPrincipal: "Melamina", experiencia: 11, coberturaTipo: "Nacional",
          coberturaDetalle: "Todo el Perú, previa coordinación", distancia: "Nacional", recargo: "Cotización de traslado",
          descripcion: "Diseño y fabricación de muebles de melamina para baños, cocinas y dormitorios. Modelado previo y control de medidas.",
          estado: "Aprobado", plan: "Anual", calificacion: 5, trabajos: 34, fotoIniciales: "AF", creadoEn: nowIso(), documentosDeclarados: 3,
          portafolio: []
        }
      ],
      clientes: [
        { id: "CL-DEMO-001", nombres: "Jorge", apellidos: "Cliente Demo", correo: "cliente@demo.pe", whatsapp: "966666666", tipoDocumento: "DNI", documento: "***001", departamento: "Lima", provincia: "Lima", distrito: "Surco", direccion: "Dirección privada de demostración", estado: "Verificado", creadoEn: nowIso() }
      ],
      solicitudes: [], cotizaciones: [], contratos: [], hitos: [], pagosDeclarados: [], ordenesCambio: [], auditoria: [
        { id: uid("AU"), fecha: nowIso(), accion: "Sistema MVP inicializado", detalle: "Se crearon datos de demostración.", actor: "Sistema" }
      ]
    };
  }

  let data = cargar();
  let panelProfesionalId = data.profesionales[0]?.id || "";

  function cargar() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === 1) return saved;
    } catch (error) {
      console.warn("No se pudo cargar el MVP guardado.", error);
    }
    const initial = seedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  function guardar(accion, detalle, actor = "Usuario MVP") {
    if (accion) data.auditoria.unshift({ id: uid("AU"), fecha: nowIso(), accion, detalle, actor });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    renderAll();
  }

  function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => element.classList.remove("show"), 3200);
  }

  function setView(name) {
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
    document.getElementById("mainNav").classList.remove("open");
    document.getElementById("menuButton").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "panel") renderPanel();
    if (name === "admin") renderAdmin();
  }

  function estadoClase(estado) {
    return ["Aprobado", "Verificado", "Firmado", "En ejecución", "Finalizado", "Cerrado"].includes(estado) ? "approved" : estado === "Rechazado" ? "rejected" : "pending";
  }

  function nombreCompleto(persona) { return `${persona?.nombres || ""} ${persona?.apellidos || ""}`.trim() || "Sin nombre"; }

  function valoracionProfesional(profesionalId, respaldo = {}) {
    const resenas = (data.resenas || []).filter((item) => item.profesionalUid === profesionalId);
    if (!resenas.length) return {
      calificacion: Number(respaldo.calificacion || 0),
      trabajos: Number(respaldo.trabajos || 0)
    };
    return {
      calificacion: resenas.reduce((total, item) => total + Number(item.calificacion || 0), 0) / resenas.length,
      trabajos: resenas.length
    };
  }

  function profesionesAprobadas(perfil) {
    const independientes = Array.isArray(perfil.especialidades) ? perfil.especialidades : [];
    const aprobadas = independientes.filter((item) => item.estado === "Aprobada").map((item) => item.profesion);
    return independientes.length ? aprobadas : (perfil.profesiones || []);
  }

  function planVigente(perfil) {
    if (["Mensual", "Semestral", "Anual"].includes(perfil.plan) && !perfil.planEstado) return true;
    if (perfil.planEstado !== "Activo") return false;
    const vencimiento = Date.parse(perfil.planVenceEn || "");
    return !Number.isFinite(vencimiento) || vencimiento > Date.now();
  }

  function puntajeRanking(perfil) {
    const valoracion = valoracionProfesional(perfil.uid || perfil.id, perfil);
    const contratos = (data.contratos || []).filter((item) => item.profesionalId === perfil.id || item.profesionalUid === (perfil.uid || perfil.id));
    const cerrados = contratos.filter((item) => item.estado === "Cerrado").length;
    const cumplimiento = contratos.length ? cerrados / contratos.length : 0;
    const especialidades = Array.isArray(perfil.especialidades) ? perfil.especialidades : [];
    const verificacion = especialidades.length ? especialidades.filter((item) => item.estado === "Aprobada").length / especialidades.length : (perfil.estado === "Aprobado" ? 1 : 0);
    const cotizaciones = (data.cotizaciones || []).filter((item) => item.profesionalId === perfil.id || item.profesionalUid === (perfil.uid || perfil.id)).length;
    const respuesta = Math.min(1, cotizaciones / Math.max(1, (data.solicitudes || []).filter((item) => !item.profesionalId || item.profesionalId === perfil.id).length));
    const experiencia = Math.min(1, Number(perfil.experiencia || 0) / 10);
    return Math.round((((Number(valoracion.calificacion || 0) / 5) * .30) + (cumplimiento * .25) + (verificacion * .20) + (respuesta * .15) + (experiencia * .10)) * 100);
  }

  function perfilPublicable(perfil) {
    return perfil.estado === "Aprobado" && profesionesAprobadas(perfil).length > 0 && planVigente(perfil);
  }

  function initSelectors() {
    const filter = document.getElementById("filtroProfesion");
    const request = document.getElementById("solicitudProfesion");
    filter.innerHTML = '<option value="">Todas las profesiones</option>' + profesiones.map((p) => `<option>${escapar(p)}</option>`).join("");
    request.innerHTML = '<option value="">Selecciona una profesión</option>' + profesiones.map((p) => `<option>${escapar(p)}</option>`).join("");
    document.getElementById("selectorProfesiones").innerHTML = profesiones.map((p) => `<label><input type="checkbox" name="profesiones" value="${escapar(p)}"> ${escapar(p)}</label>`).join("");
  }

  function syncPrincipal() {
    const selected = [...document.querySelectorAll('#selectorProfesiones input:checked')].map((input) => input.value);
    const select = document.getElementById("profesionPrincipal");
    const previous = select.value;
    select.innerHTML = selected.length ? selected.map((p) => `<option>${escapar(p)}</option>`).join("") : '<option value="">Primero selecciona profesiones</option>';
    if (selected.includes(previous)) select.value = previous;
  }

  function renderMarketplace() {
    const profession = document.getElementById("filtroProfesion")?.value || "";
    const department = document.getElementById("filtroDepartamento")?.value || "";
    const zone = (document.getElementById("filtroZona")?.value || "").toLowerCase();
    const state = document.getElementById("filtroEstado")?.value || "";
    const departments = [...new Set(data.profesionales.map((p) => p.departamento).filter(Boolean))].sort();
    const departmentSelect = document.getElementById("filtroDepartamento");
    const current = departmentSelect.value;
    departmentSelect.innerHTML = '<option value="">Todo el Perú</option>' + departments.map((d) => `<option>${escapar(d)}</option>`).join("");
    departmentSelect.value = departments.includes(current) ? current : "";

    data.profesionales.forEach((p) => Object.assign(p, valoracionProfesional(p.uid || p.id, p), { rankingPuntaje: puntajeRanking(p) }));
    const results = data.profesionales.filter((p) => {
      const cobertura = p.cobertura || {};
      const coverage = `${p.departamento} ${p.provincia} ${p.distrito} ${p.coberturaDetalle} ${(cobertura.departamentos || []).join(" ")} ${(cobertura.provincias || []).join(" ")} ${(cobertura.distritos || []).join(" ")}`.toLowerCase();
      const especialidades = profesionesAprobadas(p);
      const cubreDepartamento = !department || p.coberturaTipo === "Nacional" || (cobertura.departamentos || []).includes(department) || p.departamento === department;
      return perfilPublicable(p) && (!profession || especialidades.includes(profession)) && cubreDepartamento && (!zone || coverage.includes(zone)) && (!state || p.estado === state);
    }).sort((a, b) => (b.rankingPuntaje || 0) - (a.rankingPuntaje || 0));

    document.getElementById("heroTotalProfesionales").textContent = data.profesionales.length;
    document.getElementById("contadorResultados").textContent = `${results.length} resultado${results.length === 1 ? "" : "s"}`;
    const container = document.getElementById("listaProfesionales");
    if (!results.length) {
      container.innerHTML = '<div class="empty-state"><h3>No encontramos coincidencias</h3><p>Prueba con otra profesión o zona.</p></div>';
      return;
    }
    container.innerHTML = results.map((p) => `
      <article class="professional-card">
        <div class="card-top"><div class="professional-avatar">${escapar(p.fotoIniciales || nombreCompleto(p).split(" ").map((x) => x[0]).join("").slice(0, 2))}</div><span class="status-chip ${estadoClase(p.estado)}">${escapar(p.estado)}</span></div>
        <h3>${escapar(nombreCompleto(p))}</h3><div class="primary-profession">${escapar(p.profesionPrincipal)}</div>
        <div class="chip-list">${profesionesAprobadas(p).map((prof) => `<span class="profession-chip ${prof === p.profesionPrincipal ? "primary" : ""}">${escapar(prof)} · verificada</span>`).join("")}</div>
        <div class="card-meta"><span class="rating">★★★★★ ${Number(p.calificacion || 0).toFixed(1)}</span><span>Ranking VIGNA ${Number(p.rankingPuntaje || 0)}/100</span><span>✓ ${Number(p.trabajos || 0)} servicios registrados</span><span>⌖ ${escapar(p.coberturaDetalle)}</span><span>◷ ${Number(p.experiencia || 0)} años de experiencia</span></div>
        <div class="card-actions"><button class="secondary-button" data-profile="${p.id}">Ver perfil</button><button class="gold-button" data-request="${p.id}">Solicitar servicio</button></div>
      </article>`).join("");
  }

  function renderPeopleSelectors() {
    const clientOptions = data.clientes.map((c) => `<option value="${c.id}">${escapar(nombreCompleto(c))}</option>`).join("");
    document.getElementById("solicitudCliente").innerHTML = clientOptions || '<option value="">Registra un cliente primero</option>';
    document.getElementById("solicitudProfesional").innerHTML = '<option value="">Cualquiera compatible</option>' + data.profesionales.filter((p) => p.estado === "Aprobado").map((p) => `<option value="${p.id}">${escapar(nombreCompleto(p))} - ${escapar(p.profesionPrincipal)}</option>`).join("");
    const professionalOptions = data.profesionales.map((p) => `<option value="${p.id}">${escapar(nombreCompleto(p))}</option>`).join("");
    document.getElementById("panelProfesional").innerHTML = professionalOptions || '<option value="">Sin profesionales</option>';
    if (data.profesionales.some((p) => p.id === panelProfesionalId)) document.getElementById("panelProfesional").value = panelProfesionalId;
  }

  function renderRequests() {
    const container = document.getElementById("listaSolicitudes");
    if (!data.solicitudes.length) {
      container.innerHTML = '<div class="empty-state"><h3>Todavía no existen solicitudes</h3><p>Completa el formulario para probar el flujo.</p></div>';
    } else {
      container.innerHTML = data.solicitudes.map((s) => {
        const client = data.clientes.find((c) => c.id === s.clienteId);
        const professional = data.profesionales.find((p) => p.id === s.profesionalId);
        return `<article class="list-item" data-solicitud-id="${escapar(s.id)}" tabindex="-1"><div><h3>${escapar(s.id)} - ${escapar(s.profesion)}</h3><p>${escapar(s.descripcion)}</p><p>${escapar(nombreCompleto(client))} · ${escapar(s.departamento)}, ${escapar(s.distrito)} · ${escapar(s.presupuesto)}</p><p>Profesional: ${professional ? escapar(nombreCompleto(professional)) : "Por asignar"} · Archivos: ${Number(s.archivosCantidad) || 0}</p></div><span class="status-chip ${estadoClase(s.estado)}">${escapar(s.estado)}</span></article>`;
      }).join("");
    }
    const requestOptions = data.solicitudes.map((s) => `<option value="${s.id}">${escapar(s.id)} - ${escapar(s.profesion)} - ${escapar(s.distrito)}</option>`).join("");
    document.getElementById("cotizacionSolicitud").innerHTML = requestOptions || '<option value="">Crea una solicitud primero</option>';
  }

  function renderPanel() {
    const panel = document.getElementById("view-panel");
    const titulo = panel.querySelector(".page-intro h1");
    const descripcion = panel.querySelector(".page-intro > p:last-child");
    const selector = panel.querySelector(".dashboard-selector");
    const herramientas = panel.querySelector(".dashboard-grid");
    const listadoTitulo = panel.querySelector(".dashboard-card.full h2");

    if (data.rol === "cliente") {
      titulo.textContent = "Panel del cliente";
      descripcion.textContent = "Revisa tus solicitudes, cotizaciones recibidas y contratos.";
      selector.hidden = true;
      herramientas.hidden = true;
      document.getElementById("professionalPlanCard").hidden = true;
      document.getElementById("professionalSpecialtiesCard").hidden = true;
      listadoTitulo.textContent = "Cotizaciones y contratos";
      document.getElementById("panelMetricas").innerHTML = [
        ["Solicitudes", data.solicitudes.length],
        ["Cotizaciones recibidas", data.cotizaciones.length],
        ["Contratos", data.contratos.length],
        ["Pendientes de revisar", data.cotizaciones.filter((q) => q.estado === "Enviada").length]
      ].map(([label, value]) => `<div class="metric"><small>${label}</small><strong>${value}</strong></div>`).join("");
      renderQuotes();
      return;
    }

    titulo.textContent = "Panel del profesional";
    descripcion.textContent = "Administra portafolio, cotizaciones y contratos del MVP.";
    selector.hidden = false;
    herramientas.hidden = false;
    document.getElementById("professionalPlanCard").hidden = false;
    document.getElementById("professionalSpecialtiesCard").hidden = false;
    listadoTitulo.textContent = "Cotizaciones y contratos";

    const p = data.profesionales.find((item) => item.id === panelProfesionalId) || data.profesionales[0];
    if (!p) return;
    panelProfesionalId = p.id;
    document.getElementById("panelProfesional").value = p.id;
    document.getElementById("panelEstado").innerHTML = `<span class="status-chip ${estadoClase(p.estado)}">${escapar(p.estado)}</span>`;
    const quotes = data.cotizaciones.filter((q) => q.profesionalId === p.id);
    const contracts = data.contratos.filter((c) => c.profesionalId === p.id);
    const requests = data.solicitudes.filter((s) => !s.profesionalId || s.profesionalId === p.id || p.profesiones.includes(s.profesion));
    document.getElementById("panelMetricas").innerHTML = [
      ["Profesiones", p.profesiones.length], ["Solicitudes compatibles", requests.length], ["Cotizaciones", quotes.length], ["Contratos", contracts.length]
    ].map(([label, value]) => `<div class="metric"><small>${label}</small><strong>${value}</strong></div>`).join("");
    const portfolio = p.portafolio || [];
    document.getElementById("listaPortafolio").innerHTML = portfolio.length ? portfolio.map((item) => `<article class="portfolio-card"><div class="before-after"><figure><img src="${item.antes}" alt="Antes"><figcaption>ANTES</figcaption></figure><figure><img src="${item.despues}" alt="Después"><figcaption>DESPUÉS</figcaption></figure></div><div class="portfolio-copy"><div class="table-actions"><span class="status-chip ${estadoClase(item.estado)}">${escapar(item.estado || "Pendiente")}</span><small>${escapar(item.categoria || "Proyecto")}</small></div><h3>${escapar(item.titulo)}</h3><p><strong>Reto:</strong> ${escapar(item.reto || item.descripcion || "")}</p><p><strong>Solución:</strong> ${escapar(item.solucion || "")}</p><small>${escapar(item.ubicacion || "")} ${item.duracion ? `· ${escapar(item.duracion)}` : ""} · ${item.videoNombre ? `Video: ${escapar(item.videoNombre)}` : `${Number(item.proceso?.length || 0)} fotos de proceso`}</small>${item.observacion ? `<p class="private-note">Observación: ${escapar(item.observacion)}</p>` : ""}</div></article>`).join("") : '<div class="empty-state"><p>Agrega tu primer proyecto verificable.</p></div>';
    const plan = p.planRegistro || {};
    document.getElementById("professionalPlanStatus").innerHTML = `<div class="plan-current"><span class="status-chip ${planVigente(p) ? "approved" : "pending"}">${escapar(p.planEstado || plan.estado || "Sin plan")}</span><strong>${escapar(p.plan || plan.tipo || "Sin plan")}</strong><small>${p.planVenceEn ? `Vence ${escapar(new Date(p.planVenceEn).toLocaleDateString("es-PE"))}` : "Solicita un plan para activar la publicación."}</small></div>`;
    const especialidades = p.especialidades || [];
    document.getElementById("professionalSpecialties").innerHTML = especialidades.length ? especialidades.map((item) => `<form class="specialty-editor" data-specialty-form="${escapar(item.id)}"><div class="execution-card-head"><h3>${escapar(item.profesion)}</h3><span class="status-chip ${estadoClase(item.estado)}">${escapar(item.estado)}</span></div><label><input name="principal" type="checkbox" ${item.principal ? "checked" : ""}> Profesión principal</label><label>Años de experiencia<input name="experiencia" type="number" min="0" max="80" value="${Number(item.experiencia || 0)}"></label><label>Experiencia específica<textarea name="descripcion" maxlength="1500" rows="3">${escapar(item.descripcion || "")}</textarea></label><label>Certificados o constancias (máximo 6)<input name="evidencias" type="file" accept="image/*,application/pdf" multiple></label><div class="specialty-evidence-list">${(item.evidencias || []).map((evidencia) => `<button class="execution-file" type="button" data-open-specialty-file="${escapar(item.id)}" data-file-path="${escapar(evidencia.ruta)}">${escapar(evidencia.nombre)}</button>`).join("")}</div>${item.observacion ? `<p class="private-note">Observación: ${escapar(item.observacion)}</p>` : ""}<button class="gold-button" type="submit">Guardar especialidad</button></form>`).join("") : '<div class="empty-state"><p>No hay especialidades registradas.</p></div>';
    renderQuotes();
  }

  function renderQuotes() {
    const p = data.profesionales.find((item) => item.id === panelProfesionalId);
    const quotes = data.cotizaciones.filter((q) => !p || q.profesionalId === p.id);
    const container = document.getElementById("listaCotizaciones");
    if (!quotes.length) {
      container.innerHTML = '<div class="empty-state"><p>Todavía no existen cotizaciones.</p></div>';
      return;
    }
    container.innerHTML = quotes.map((q) => {
      const request = data.solicitudes.find((s) => s.id === q.solicitudId);
      const existingContract = data.contratos.find((c) => c.cotizacionId === q.id);
      return `<article class="list-item"><div><h3>${escapar(q.id)} · ${escapar(request?.profesion || "Servicio")}</h3><p>Económica ${dinero(q.opciones[0].precio)} · Recomendada ${dinero(q.opciones[1].precio)} · Premium ${dinero(q.opciones[2].precio)}</p><p>${escapar(q.condiciones)} · Versión ${q.version}${q.reemplazaA ? ` · Reemplaza ${escapar(q.reemplazaA)}` : ""}</p><small>Válida hasta ${escapar(q.validaHasta || "sin fecha")} · ${escapar(q.disponibilidadEstimada || "disponibilidad por coordinar")}</small></div><div class="table-actions"><span class="status-chip ${estadoClase(q.estado)}">${escapar(q.estado)}</span><button class="gold-button" data-open-quote="${q.id}">${existingContract ? "Ver contrato" : "Revisar y contratar"}</button></div></article>`;
    }).join("");
  }

  function renderAdmin() {
    const pending = data.profesionales.filter((p) => p.estado === "Pendiente").length;
    const cotizadas = new Set(data.cotizaciones.map((item) => item.solicitudId)).size;
    const cerrados = data.contratos.filter((item) => item.estado === "Cerrado").length;
    const promedio = data.resenas.length ? data.resenas.reduce((suma, item) => suma + Number(item.calificacion || 0), 0) / data.resenas.length : 0;
    const planesActivos = (data.planesProfesionales || []).filter((item) => item.estado === "Activo").length;
    const conversion = data.solicitudes.length ? Math.round((data.contratos.length / data.solicitudes.length) * 100) : 0;
    const rolAdmin = data.adminRol || "superadmin";
    const badge = document.getElementById("adminRoleBadge");
    if (badge) badge.textContent = `Rol: ${rolAdmin}`;
    document.getElementById("adminMetricas").innerHTML = [
      ["Perfiles pendientes", pending], ["Profesionales", data.profesionales.length], ["Solicitudes", data.solicitudes.length],
      ["Solicitudes cotizadas", cotizadas], ["Contratos", data.contratos.length], ["Conversión", `${conversion}%`],
      ["Servicios cerrados", cerrados], ["Calificación", promedio ? promedio.toFixed(2) : "—"], ["Planes activos", planesActivos]
    ].map(([label, value]) => `<div class="metric"><small>${label}</small><strong>${value}</strong></div>`).join("");

    document.getElementById("admin-profesionales").innerHTML = tableHtml(["ID", "Profesional", "Profesión principal", "Cobertura", "Documentos", "Estado", "Acciones"], data.profesionales.map((p) => [
      p.id, nombreCompleto(p), p.profesionPrincipal, p.coberturaDetalle, `${p.documentosDeclarados || 0} declarados`, htmlSeguro(`<span class="status-chip ${estadoClase(p.estado)}">${escapar(p.estado)}</span>`),
      htmlSeguro(`<div class="specialty-review">${(p.especialidades || []).map((item) => `<span>${escapar(item.profesion)}: ${escapar(item.estado)} ${(item.evidencias || []).map((evidencia) => `<button class="tiny-button" data-open-specialty-file="${escapar(item.id)}" data-file-path="${escapar(evidencia.ruta)}">Ver ${escapar(evidencia.nombre)}</button>`).join("")} <button class="tiny-button approve" data-admin-specialty="${escapar(item.id)}" data-state="Aprobada">✓</button><button class="tiny-button reject" data-admin-specialty="${escapar(item.id)}" data-state="Rechazada">×</button></span>`).join("")}${(p.portafolio || []).filter((item) => item.estado !== "Aprobado" || data.rol === "admin").map((item) => `<span>Portafolio ${escapar(item.titulo)}: ${escapar(item.estado || "Pendiente")} <button class="tiny-button approve" data-admin-portfolio="${escapar(item.id)}" data-state="Aprobado">Publicar</button><button class="tiny-button reject" data-admin-portfolio="${escapar(item.id)}" data-state="Rechazado">Rechazar</button></span>`).join("")}</div><div class="table-actions"><button class="tiny-button approve" data-admin-professional="${p.id}" data-state="Aprobado">Aprobar perfil</button><button class="tiny-button" data-review-professional="${p.id}">Revisar documentos</button><button class="tiny-button" data-admin-activate-plan="${p.id}" data-plan-type="${escapar(p.planRegistro?.tipo || "Mensual")}">Activar plan</button><button class="tiny-button reject" data-admin-professional="${p.id}" data-state="Rechazado">Rechazar</button></div>`)
    ]));
    document.getElementById("admin-clientes").innerHTML = tableHtml(["ID", "Cliente", "Documento", "Ubicación", "Archivos", "Estado", "Acciones"], data.clientes.map((c) => [c.id, nombreCompleto(c), `${c.tipoDocumento} ${c.documento}`, `${c.departamento} - ${c.provincia} - ${c.distrito} · ${c.zona || "Sin zona"}`, `${c.documentosDeclarados || 0} declarados`, c.estado, htmlSeguro(`<button class="tiny-button" data-review-client="${c.id}">Revisar documentos</button>`)]));
    document.getElementById("admin-solicitudes").innerHTML = tableHtml(["ID", "Profesión", "Lugar", "Presupuesto", "Estado"], data.solicitudes.map((s) => [s.id, s.profesion, `${s.departamento} - ${s.distrito}`, s.presupuesto, s.estado]));
    document.querySelectorAll("#admin-solicitudes tbody tr").forEach((fila, indice) => {
      fila.dataset.solicitudId = data.solicitudes[indice]?.id || "";
      fila.tabIndex = -1;
    });
    document.getElementById("admin-contratos").innerHTML = tableHtml(["ID", "Solicitud", "Profesional", "Total", "Estado", "Archivo", "Acciones"], data.contratos.map((c) => {
      const p = data.profesionales.find((x) => x.id === c.profesionalId);
      const acciones = [`<button class="tiny-button" data-open-contract="${escapar(c.id)}">Ver contrato</button>`];
      if (c.archivoFirmado) acciones.push(`<button class="tiny-button" data-open-signed-contract="${escapar(c.id)}">Abrir firmado</button>`);
      if (c.anexoPlanTrabajoNombre) acciones.push(`<button class="tiny-button" data-open-work-plan="${escapar(c.id)}">Abrir plan Excel</button>`);
      return [c.id, c.solicitudId, nombreCompleto(p), dinero(c.total), c.estado, c.archivoFirmado || "Pendiente", htmlSeguro(`<div class="table-actions">${acciones.join("")}</div>`)];
    }));
    document.getElementById("admin-auditoria").innerHTML = data.auditoria.map((a) => `<div class="audit-line"><strong>${escapar(a.accion)}</strong> · ${escapar(a.actor)}<small>${new Date(a.fecha).toLocaleString("es-PE")} · ${escapar(a.detalle)}</small></div>`).join("");
  }

  function tableHtml(headers, rows) {
    if (!rows.length) return '<div class="empty-state"><p>No existen registros.</p></div>';
    return `<table class="data-table"><thead><tr>${headers.map((h) => `<th>${escapar(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${value && typeof value === "object" && value.__htmlSeguro ? value.__htmlSeguro : escapar(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function descargarAdministracion(tipo) {
    if (data.rol !== "admin") return toast("Solo administración puede exportar estos datos.");
    const fecha = new Date().toISOString().slice(0, 10);
    let contenido;
    let nombre;
    let mime;
    if (tipo === "json") {
      contenido = JSON.stringify({ generadoEn: nowIso(), auditoria: data.auditoria }, null, 2);
      nombre = `vigna-auditoria-${fecha}.json`;
      mime = "application/json";
    } else {
      const escaparCsv = (valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`;
      const filas = [["tipo", "id", "estado", "referencia", "monto", "fecha"]];
      data.profesionales.forEach((item) => filas.push(["profesional", item.id, item.estado, item.profesionPrincipal, item.plan || "", item.creadoEn || ""]));
      data.solicitudes.forEach((item) => filas.push(["solicitud", item.id, item.estado, `${item.profesion} - ${item.distrito}`, item.presupuesto, item.creadoEn || ""]));
      data.contratos.forEach((item) => filas.push(["contrato", item.id, item.estado, item.solicitudId, item.total, item.creadoEn || ""]));
      contenido = `\ufeff${filas.map((fila) => fila.map(escaparCsv).join(",")).join("\n")}`;
      nombre = `vigna-resumen-operativo-${fecha}.csv`;
      mime = "text/csv;charset=utf-8";
    }
    const url = URL.createObjectURL(new Blob([contenido], { type: mime }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    guardar("Exportación administrativa", nombre, data.adminRol || "admin");
    toast(`${nombre} descargado.`);
  }

  function renderAll() {
    renderPeopleSelectors(); renderMarketplace(); renderRequests(); renderPanel(); renderAdmin();
  }

  async function imageData(file) {
    if (!file) return "";
    const image = await createImageBitmap(file);
    const max = 900;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", .78);
  }

  function fechaResena(resena) {
    const fecha = resena?.creadoEn;
    if (fecha && typeof fecha.toMillis === "function") return fecha.toMillis();
    if (fecha && Number.isFinite(fecha.seconds)) return fecha.seconds * 1000;
    const parsed = Date.parse(fecha || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function showProfile(id) {
    const p = data.profesionales.find((item) => item.id === id); if (!p) return;
    const profesionalUid = p.uid || p.id;
    Object.assign(p, valoracionProfesional(profesionalUid, p));
    const resenasProfesional = (data.resenas || [])
      .filter((resena) => resena.profesionalUid === profesionalUid && Number(resena.calificacion) >= 1)
      .slice()
      .sort((a, b) => fechaResena(b) - fechaResena(a));
    const opinionesHtml = resenasProfesional.length
      ? `<section class="profile-reviews" aria-label="Opiniones verificadas"><div class="profile-reviews-heading"><h3>Opiniones verificadas</h3><span>${resenasProfesional.length}</span></div><div class="profile-reviews-list">${resenasProfesional.slice(0, 5).map((resena) => {
          const score = Math.max(1, Math.min(5, Math.round(Number(resena.calificacion) || 0)));
          const comentario = String(resena.comentario || "").trim();
          return `<article class="verified-review"><div class="verified-review-top"><span class="verified-review-stars" aria-label="${score} de 5 estrellas">${"★".repeat(score)}${"☆".repeat(5 - score)}</span><span class="verified-review-client">Cliente verificado</span></div>${comentario ? `<p>${escapar(comentario)}</p>` : `<p class="verified-review-empty">Calificación verificada sin comentario.</p>`}</article>`;
        }).join("")}</div></section>`
      : "";
    const content = document.getElementById("profileDialogContent");
    content.innerHTML = `<div class="profile-hero"><div class="professional-avatar">${escapar(p.fotoIniciales)}</div><div><p class="eyebrow">${escapar(p.estado)} · Ranking ${Number(p.rankingPuntaje || puntajeRanking(p))}/100</p><h1>${escapar(p.nombrePublico || nombreCompleto(p))}</h1><p class="primary-profession">${escapar(p.profesionPrincipal)}</p><p class="rating">★★★★★ ${Number(p.calificacion || 0).toFixed(1)} · ${p.trabajos || 0} servicios</p></div></div><div class="chip-list">${profesionesAprobadas(p).map((x) => `<span class="profession-chip ${x === p.profesionPrincipal ? "primary" : ""}">${escapar(x)} · verificada</span>`).join("")}</div><p>${escapar(p.descripcion)}</p><div class="profile-detail-grid"><div class="detail-box"><h3>Cobertura</h3><p>${escapar(p.coberturaDetalle)}</p><p>${escapar(p.distancia || "")}</p></div><div class="detail-box"><h3>Disponibilidad</h3><p>${escapar(p.disponibilidad || "Previa coordinación")}</p><p>Idiomas: ${escapar((p.idiomas || []).join?.(", ") || p.idiomas || "Español")}</p></div><div class="detail-box"><h3>Experiencia</h3><p>${p.experiencia} años</p><p>Plan vigente: ${escapar(p.plan || "Sin plan")}</p></div></div>${opinionesHtml}<div class="form-actions no-print"><button class="gold-button" data-request="${p.id}">Solicitar servicio</button></div>`;
    document.getElementById("profileDialog").showModal();
  }

  function openQuote(id) {
    const quote = data.cotizaciones.find((q) => q.id === id); if (!quote) return;
    const existing = data.contratos.find((c) => c.cotizacionId === id);
    if (existing) return openContract(existing.id);
    const request = data.solicitudes.find((s) => s.id === quote.solicitudId);
    const professional = data.profesionales.find((p) => p.id === quote.profesionalId);
    document.getElementById("contractDialogContent").innerHTML = `<div class="contract-sheet"><div class="contract-brand"><img src="images/logo/ChatGPT Image 26 may 2026, 11_05_03 p.m..png" alt="VIGNA Home & Bath"><strong>Profesionales Vigna’s</strong></div><p class="eyebrow">COTIZACIÓN ${escapar(quote.id)} · VERSIÓN ${quote.version}</p><h1>${escapar(request?.profesion || "Servicio profesional")}</h1><p>Profesional: ${escapar(nombreCompleto(professional))}</p><p>Válida hasta: ${escapar(quote.validaHasta || "No indicada")} · Disponibilidad: ${escapar(quote.disponibilidadEstimada || "Por coordinar")}</p><div class="contract-options">${quote.opciones.map((option, index) => `<div class="contract-option ${index === 1 ? "selected" : ""}"><h2>${escapar(option.nombre)}</h2><strong>${dinero(option.precio)}</strong><p>${escapar(option.detalle || "Según alcance")}</p><small>Materiales ${dinero(option.materiales || 0)} · Mano de obra ${dinero(option.manoObra || 0)} · ${escapar(option.duracion || "Duración por coordinar")}</small><button class="gold-button no-print" data-contract-quote="${quote.id}" data-option="${index}">Elegir esta opción</button></div>`).join("")}</div><h2>Materiales y exclusiones</h2><p>Responsable: ${escapar(quote.responsableMateriales || "Por definir")}.</p><p>${escapar(quote.exclusiones || "Sin exclusiones declaradas.")}</p><h2>Garantía</h2><p>${quote.garantiaDias ? `${Number(quote.garantiaDias)} días desde el cierre conforme del servicio.` : "Plazo no estructurado en esta cotización."}</p><h2>Condiciones</h2><p>${escapar(quote.condiciones)}</p></div>`;
    document.getElementById("contractDialog").showModal();
  }

  function createContract(quoteId, optionIndex) {
    const quote = data.cotizaciones.find((q) => q.id === quoteId); if (!quote) return;
    const request = data.solicitudes.find((s) => s.id === quote.solicitudId); const option = quote.opciones[optionIndex];
    const contract = { id: uid("CT"), solicitudId: quote.solicitudId, cotizacionId: quote.id, profesionalId: quote.profesionalId, clienteId: request.clienteId, opcion: option.nombre, total: option.precio, detalle: option.detalle, garantiaDias: Number(quote.garantiaDias || 0), garantiaInicioEn: "", garantiaVenceEn: "", condiciones: quote.condiciones, version: 1, estado: "Pendiente de firma", creadoEn: nowIso(), archivoFirmado: "", anexoPlanTrabajoNombre: "", anexoPlanTrabajoRuta: "", anexoPlanTrabajoActualizadoEn: "" };
    data.contratos.push(contract); quote.estado = "Aceptada"; request.estado = "Contratada";
    guardar("Contrato generado", `${contract.id} desde ${quote.id}.`, "Cliente MVP"); toast("Contrato generado. Ya puedes imprimirlo y subirlo firmado."); openContract(contract.id);
  }

  function openContract(id) {
    const contract = data.contratos.find((c) => c.id === id); if (!contract) return;
    const request = data.solicitudes.find((s) => s.id === contract.solicitudId);
    const client = data.clientes.find((c) => c.id === contract.clienteId);
    const professional = data.profesionales.find((p) => p.id === contract.profesionalId);
    const clientDocument = contract.clienteDocumento || client?.documento || "";
    const professionalDocument = contract.profesionalDocumento || professional?.documento || "";
    const documentValue = (value) => `<span class="document-screen">${escapar(enmascararDocumento(value))}</span><span class="document-print">${escapar(value)}</span>`;
    const estados = ["Firmado", "En ejecución", "Finalizado", "Cerrado"];
    const indiceEstado = estados.indexOf(contract.estado);
    const timeline = ["Pendiente de firma", "Pendiente de confirmación"].includes(contract.estado) ? "" : `<div class="service-timeline no-print">${estados.map((estado, index) => `<span class="service-step ${index <= indiceEstado ? "done" : ""}">${escapar(estado)}</span>`).join("")}</div>`;
    const evidencias = Array.isArray(contract.evidenciasFinalizacion) ? contract.evidenciasFinalizacion : [];
    const evidenceHtml = evidencias.length ? `<div class="service-evidence no-print"><h2>Evidencias de finalización</h2><div class="evidence-list">${evidencias.map((item, index) => `<button class="secondary-button" type="button" data-open-service-evidence="${contract.id}" data-evidence-path="${escapar(item.ruta)}">Abrir evidencia ${index + 1}: ${escapar(item.nombre)}</button>`).join("")}</div>${contract.notaFinalizacion ? `<p><b>Informe profesional:</b> ${escapar(contract.notaFinalizacion)}</p>` : ""}</div>` : "";
    const hitos = (data.hitos || []).filter((item) => item.contratoId === contract.id);
    const pagos = (data.pagosDeclarados || []).filter((item) => item.contratoId === contract.id);
    const ordenes = (data.ordenesCambio || []).filter((item) => item.contratoId === contract.id);
    const mensajes = (data.mensajesContrato || []).filter((item) => item.contratoId === contract.id).sort((a, b) => String(a.creadoEn).localeCompare(String(b.creadoEn)));
    const actuaciones = (data.actuacionesContrato || []).filter((item) => item.contratoId === contract.id).sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
    const archivosHito = (hito) => (hito.evidencias || []).map((item, index) => `<button class="execution-file" type="button" data-open-execution-file="${contract.id}" data-execution-type="hito" data-record-id="${hito.id}" data-file-path="${escapar(item.ruta)}">Evidencia ${index + 1}: ${escapar(item.nombre)}</button>`).join("");
    const hitosHtml = hitos.length ? hitos.map((hito) => `<article class="execution-card" data-execution-record="${hito.id}"><div class="execution-card-head"><div><span class="execution-kicker">Hito</span><h3>${escapar(hito.titulo)}</h3></div><span class="execution-status status-${escapar(hito.estado).toLowerCase().replace(/\s+/g, "-")}">${escapar(hito.estado)}</span></div><p>${escapar(hito.detalle)}</p>${hito.fechaObjetivo ? `<small>Objetivo: ${escapar(hito.fechaObjetivo)}</small>` : ""}${hito.notaProfesional ? `<p><b>Avance:</b> ${escapar(hito.notaProfesional)}</p>` : ""}<div class="execution-files">${archivosHito(hito)}</div>${hito.comentarioCliente ? `<p class="execution-response"><b>Cliente:</b> ${escapar(hito.comentarioCliente)}</p>` : ""}${data.rol === "profesional" && ["Pendiente", "Observado"].includes(hito.estado) && contract.estado === "En ejecución" ? `<div class="execution-inline-form"><label>Nota del avance<textarea data-hito-note rows="3" maxlength="1000" required></textarea></label><label>Evidencias<input data-hito-files type="file" accept="image/*,video/*,application/pdf" multiple required></label><button class="gold-button" type="button" data-submit-milestone="${hito.id}" data-contract-id="${contract.id}">Enviar a revisión</button></div>` : ""}${data.rol === "cliente" && hito.estado === "En revisión" ? `<div class="execution-inline-form"><label>Comentario<textarea data-hito-response rows="2" maxlength="1000" placeholder="Opcional al aprobar; obligatorio si observas."></textarea></label><div class="execution-actions"><button class="gold-button" type="button" data-review-milestone="${hito.id}" data-contract-id="${contract.id}" data-decision="Aprobado">Aprobar</button><button class="secondary-button" type="button" data-review-milestone="${hito.id}" data-contract-id="${contract.id}" data-decision="Observado">Observar</button></div></div>` : ""}</article>`).join("") : `<p class="execution-empty">Aún no hay hitos registrados.</p>`;
    const pagosHtml = pagos.length ? pagos.map((pago) => `<article class="execution-card" data-execution-record="${pago.id}"><div class="execution-card-head"><div><span class="execution-kicker">Pago declarado</span><h3>${dinero(pago.monto)}</h3></div><span class="execution-status status-${escapar(pago.estado).toLowerCase()}">${escapar(pago.estado)}</span></div><p>${escapar(pago.metodo)}${pago.referencia ? ` · Ref. ${escapar(pago.referencia)}` : ""}${pago.fechaPago ? ` · ${escapar(pago.fechaPago)}` : ""}</p>${pago.nota ? `<p>${escapar(pago.nota)}</p>` : ""}${pago.comprobante ? `<button class="execution-file" type="button" data-open-execution-file="${contract.id}" data-execution-type="pago" data-record-id="${pago.id}" data-file-path="${escapar(pago.comprobante.ruta)}">Abrir comprobante: ${escapar(pago.comprobante.nombre)}</button>` : ""}${pago.comentarioProfesional ? `<p class="execution-response"><b>Profesional:</b> ${escapar(pago.comentarioProfesional)}</p>` : ""}${data.rol === "profesional" && pago.estado === "Declarado" ? `<div class="execution-inline-form"><label>Comentario<textarea data-payment-response rows="2" maxlength="500"></textarea></label><div class="execution-actions"><button class="gold-button" type="button" data-review-payment="${pago.id}" data-contract-id="${contract.id}" data-decision="Confirmado">Confirmar</button><button class="secondary-button" type="button" data-review-payment="${pago.id}" data-contract-id="${contract.id}" data-decision="Rechazado">Rechazar</button></div></div>` : ""}</article>`).join("") : `<p class="execution-empty">Aún no hay pagos declarados.</p>`;
    const ordenesHtml = ordenes.length ? ordenes.map((orden) => `<article class="execution-card" data-execution-record="${orden.id}"><div class="execution-card-head"><div><span class="execution-kicker">Cambio propuesto por ${escapar(orden.proponenteRol)}</span><h3>${orden.impactoMonto ? `${orden.impactoMonto > 0 ? "+" : ""}${dinero(orden.impactoMonto)}` : "Sin impacto económico"}</h3></div><span class="execution-status status-${escapar(orden.estado).toLowerCase()}">${escapar(orden.estado)}</span></div><p>${escapar(orden.descripcion)}</p><small>${escapar(orden.motivo)} · Impacto de plazo: ${Number(orden.impactoDias || 0)} día(s)</small>${orden.respuesta ? `<p class="execution-response"><b>Respuesta:</b> ${escapar(orden.respuesta)}</p>` : ""}${orden.estado === "Propuesta" && orden.proponenteRol !== data.rol ? `<div class="execution-inline-form"><label>Respuesta<textarea data-change-response rows="2" maxlength="500"></textarea></label><div class="execution-actions"><button class="gold-button" type="button" data-review-change="${orden.id}" data-contract-id="${contract.id}" data-decision="Aceptada">Aceptar</button><button class="secondary-button" type="button" data-review-change="${orden.id}" data-contract-id="${contract.id}" data-decision="Rechazada">Rechazar</button></div></div>` : ""}</article>`).join("") : `<p class="execution-empty">Aún no hay órdenes de cambio.</p>`;
    const executionForms = contract.estado === "En ejecución" ? `<div class="execution-create-grid">${data.rol === "profesional" ? `<form id="milestoneForm" class="execution-create"><h3>Nuevo hito</h3><label>Título<input name="titulo" maxlength="120" required></label><label>Resultado esperado<textarea name="detalle" rows="3" maxlength="1000" required></textarea></label><label>Fecha objetivo<input name="fechaObjetivo" type="date"></label><button class="gold-button" type="submit" data-create-milestone="${contract.id}">Crear hito</button></form>` : ""}${data.rol === "cliente" ? `<form id="paymentDeclarationForm" class="execution-create"><h3>Declarar pago</h3><div class="execution-form-row"><label>Monto S/<input name="monto" type="number" min="0.01" step="0.01" required></label><label>Método<input name="metodo" maxlength="80" required></label></div><div class="execution-form-row"><label>Referencia<input name="referencia" maxlength="120"></label><label>Fecha<input name="fechaPago" type="date"></label></div><label>Nota<textarea name="nota" rows="2" maxlength="500"></textarea></label><label>Comprobante opcional<input name="comprobante" type="file" accept="image/*,application/pdf"></label><button class="gold-button" type="submit" data-declare-payment="${contract.id}">Registrar pago declarado</button></form>` : ""}<form id="changeOrderForm" class="execution-create"><h3>Proponer cambio</h3><label>Descripción<textarea name="descripcion" rows="3" maxlength="1000" required></textarea></label><label>Motivo<textarea name="motivo" rows="2" maxlength="500" required></textarea></label><div class="execution-form-row"><label>Impacto S/<input name="impactoMonto" type="number" step="0.01" value="0"></label><label>Días adicionales<input name="impactoDias" type="number" step="1" value="0"></label></div><button class="secondary-button" type="submit" data-propose-change="${contract.id}">Enviar orden de cambio</button></form></div>` : "";
    const executionHtml = ["Pendiente de firma", "Pendiente de confirmación"].includes(contract.estado) ? "" : `<section class="contract-execution no-print"><div class="execution-heading"><div><span class="execution-kicker">Seguimiento privado</span><h2>Ejecución del contrato</h2></div><p>Los registros no modifican el contrato firmado y conservan su historial verificable.</p></div><details open><summary>Hitos y evidencias <span>${hitos.length}</span></summary><div class="execution-list">${hitosHtml}</div></details><details><summary>Pagos declarados <span>${pagos.length}</span></summary><div class="execution-list">${pagosHtml}</div></details><details><summary>Órdenes de cambio <span>${ordenes.length}</span></summary><div class="execution-list">${ordenesHtml}</div></details>${executionForms}</section>`;
    const mensajesHtml = mensajes.length ? mensajes.map((item) => `<article class="contract-message ${item.autorRol === data.rol ? "own" : ""}"><div><b>${escapar(item.autorRol)}</b><small>${escapar(new Date(item.creadoEn).toLocaleString("es-PE"))}</small></div><p>${escapar(item.mensaje)}</p>${item.adjunto ? `<button class="execution-file" type="button" data-open-message-file="${escapar(item.id)}" data-contract-id="${contract.id}">${escapar(item.adjunto.nombre)}</button>` : ""}</article>`).join("") : '<p class="execution-empty">Aún no hay mensajes.</p>';
    const actuacionesHtml = actuaciones.length ? actuaciones.map((item) => `<article class="execution-card"><div class="execution-card-head"><div><span class="execution-kicker">${escapar(item.tipo)}</span><h3>${escapar(item.solicitanteRol)}</h3></div><span class="execution-status status-${escapar(item.estado).toLowerCase()}">${escapar(item.estado)}</span></div><p>${escapar(item.motivo)}</p>${item.resolucion ? `<p class="execution-response"><b>Resolución:</b> ${escapar(item.resolucion)}</p>` : ""}${data.rol === "admin" && item.estado === "Solicitada" ? `<div class="execution-inline-form"><label>Resolución<textarea data-actuation-resolution rows="2" maxlength="1500" required></textarea></label><div class="execution-actions"><button class="gold-button" type="button" data-resolve-actuation="${item.id}" data-decision="Aceptada">Aceptar</button><button class="secondary-button" type="button" data-resolve-actuation="${item.id}" data-decision="Rechazada">Rechazar</button></div></div>` : ""}</article>`).join("") : '<p class="execution-empty">No existen solicitudes de pausa o cancelación.</p>';
    const comunicacionHtml = contract.estado === "Pendiente de firma" ? "" : `<section class="contract-operations no-print"><div class="execution-heading"><div><span class="execution-kicker">Canal contractual</span><h2>Mensajes y actuaciones</h2></div><p>Este registro forma parte del expediente privado y sus eventos generan notificaciones.</p></div><div class="contract-messages">${mensajesHtml}</div><form id="contractMessageForm" class="execution-create"><label>Mensaje<textarea name="mensaje" rows="3" maxlength="2000" required></textarea></label><label>Adjunto opcional<input name="adjunto" type="file" accept="image/*,video/*,application/pdf"></label><button class="gold-button" type="submit" data-send-contract-message="${contract.id}">Enviar mensaje</button></form><details><summary>Pausa, reanudación o cancelación <span>${actuaciones.length}</span></summary><div class="execution-list">${actuacionesHtml}</div>${data.rol !== "admin" && !["Cerrado", "Cancelado"].includes(contract.estado) ? `<form id="contractActuationForm" class="execution-create"><label>Solicitud<select name="tipo"><option>Pausa</option>${contract.estado === "Pausado" ? "<option>Reanudación</option>" : ""}<option>Cancelación</option></select></label><label>Motivo<textarea name="motivo" rows="3" minlength="10" maxlength="1500" required></textarea></label><button class="secondary-button" type="submit" data-request-actuation="${contract.id}">Registrar solicitud formal</button></form>` : ""}</details></section>`;
    let actions = `<button class="secondary-button" type="button" onclick="window.print()">Imprimir contrato</button><a class="secondary-button button-link" href="plantillas/plantilla-productos-paso-a-paso-vigna.xlsx" download>Descargar plantilla Excel</a>`;
    if (contract.anexoPlanTrabajoNombre) {
      actions += `<button class="secondary-button" type="button" data-open-work-plan="${contract.id}">Abrir plan Excel adjunto</button>`;
    }
    if (data.rol === "profesional" && contract.estado !== "Cerrado") {
      actions += `<div class="contract-annex-action"><h2>Productos y ejecución paso a paso <small>Opcional</small></h2><p>Completa la plantilla y adjúntala para que el cliente y administración conozcan los materiales y la secuencia del trabajo.</p><label>Hoja Excel o CSV<input id="workPlanFile" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"></label><button class="gold-button" type="button" data-upload-work-plan="${contract.id}">${contract.anexoPlanTrabajoNombre ? "Reemplazar plan adjunto" : "Adjuntar plan al contrato"}</button></div>`;
    }
    if (!contract.archivoFirmado) {
      actions += `<label>Subir contrato firmado<input id="signedContractFile" type="file" accept=".pdf,image/*"></label><button class="gold-button" data-upload-contract="${contract.id}">Registrar documento firmado</button>`;
    } else {
      actions += `<button class="secondary-button" type="button" data-open-signed-contract="${contract.id}">Abrir contrato firmado</button>`;
      const confirmaciones = contract.confirmacionesFirma || {};
      actions += `<div class="signature-verification"><h2>Confirmación bilateral</h2><p>Cliente: <b>${confirmaciones.cliente ? "Confirmado" : "Pendiente"}</b> · Profesional: <b>${confirmaciones.profesional ? "Confirmado" : "Pendiente"}</b></p><p>Huella SHA-256: <code>${escapar(contract.documentoHashSha256 || "Documento anterior sin huella")}</code></p>${contract.estado === "Pendiente de confirmación" && ((data.rol === "cliente" && !confirmaciones.cliente) || (data.rol === "profesional" && !confirmaciones.profesional)) ? `<label class="acceptance-check"><input id="contractHashAcceptance" type="checkbox" required> Abrí el archivo, verifiqué su contenido y confirmo esta versión.</label><button class="gold-button" type="button" data-confirm-signed-contract="${contract.id}">Confirmar documento</button>` : ""}</div>`;
    }
    if (data.rol === "profesional" && contract.estado === "Firmado") {
      actions += `<div class="service-action"><h2>Inicio del servicio</h2><p>Confirma únicamente cuando el trabajo haya comenzado.</p><button class="gold-button" type="button" data-start-service="${contract.id}">Iniciar servicio</button></div>`;
    }
    if (data.rol === "profesional" && contract.estado === "En ejecución") {
      actions += `<div class="service-action"><h2>Finalizar servicio</h2><label>Informe final<textarea id="serviceCompletionNote" rows="4" maxlength="1000" placeholder="Describe el trabajo realizado, pruebas y recomendaciones." required></textarea></label><label>Evidencias (1 a 6 fotos o videos)<input id="serviceEvidenceFiles" type="file" accept="image/*,video/*" multiple required></label><button class="gold-button" type="button" data-finish-service="${contract.id}">Enviar evidencias y finalizar</button></div>`;
    }
    if (data.rol === "cliente" && contract.estado === "Finalizado") {
      actions += `<div class="service-action"><h2>Conformidad del cliente</h2><label>Calificación<select id="serviceRating"><option value="5">5 - Excelente</option><option value="4">4 - Muy bueno</option><option value="3">3 - Bueno</option><option value="2">2 - Regular</option><option value="1">1 - Deficiente</option></select></label><label>Comentario<textarea id="serviceReview" rows="4" maxlength="1000" placeholder="Cuenta cómo fue tu experiencia." required></textarea></label><label class="acceptance-check"><input id="serviceAcceptance" type="checkbox" required> Declaro que revisé la entrega y sus evidencias, y acepto el acta de conformidad.</label><button class="gold-button" type="button" data-close-service="${contract.id}">Aceptar acta, calificar y cerrar</button></div>`;
    }
    const acta = contract.actaConformidad || null;
    const reviewHtml = contract.estado === "Cerrado" ? `<div class="service-review handover-certificate"><p class="eyebrow">ACTA DE ENTREGA Y CONFORMIDAD</p><h2>Servicio recibido conforme</h2>${acta ? `<p><b>Folio:</b> ${escapar(acta.folio)} · <b>Versión:</b> ${Number(acta.version || 1)}</p><p>${escapar(acta.declaracion)}</p><div class="handover-grid"><p><b>Aceptada:</b><br>${escapar(new Date(acta.aceptadaEn).toLocaleString("es-PE"))}</p><p><b>Evidencias finales:</b><br>${Number(acta.evidenciasFinales || 0)}</p><p><b>Total del contrato:</b><br>${dinero(acta.totalContrato)}</p><p><b>Garantía:</b><br>${Number(contract.garantiaDias || 0)} días</p></div>` : `<p>Contrato cerrado antes de la activación del acta estructurada.</p>`}<p><b>Calificación:</b> ${"★".repeat(Number(contract.calificacion) || 0)}${"☆".repeat(Math.max(0, 5 - (Number(contract.calificacion) || 0)))} ${escapar(contract.calificacion || "")}/5</p><p>${escapar(contract.comentarioCliente || "Sin comentario.")}</p><button class="secondary-button no-print" type="button" data-print-handover>Imprimir acta</button></div>` : "";
    const garantiaHtml = contract.garantiaDias
      ? `<p><b>Vigencia:</b> ${Number(contract.garantiaDias)} días desde el cierre conforme.${contract.garantiaVenceEn ? ` · <b>Vence:</b> ${escapar(new Date(contract.garantiaVenceEn).toLocaleDateString("es-PE", { dateStyle: "long" }))}` : ""}</p>`
      : "<p>Este contrato anterior no tiene un plazo de garantía estructurado.</p>";
    const anexoHtml = contract.anexoPlanTrabajoNombre
      ? `<p><b>Anexo adjunto:</b> ${escapar(contract.anexoPlanTrabajoNombre)}${contract.anexoPlanTrabajoActualizadoEn ? ` · Actualizado: ${escapar(new Date(contract.anexoPlanTrabajoActualizadoEn).toLocaleString("es-PE"))}` : ""}</p>`
      : "<p>No se adjuntó una hoja de productos y pasos. Este anexo es opcional.</p>";
    document.getElementById("contractDialogContent").innerHTML = `<div class="contract-sheet"><div class="contract-brand"><img src="images/logo/ChatGPT Image 26 may 2026, 11_05_03 p.m..png" alt="VIGNA Home & Bath"><strong>Profesionales Vigna’s</strong></div><p class="eyebrow">CONTRATO ${escapar(contract.id)} · VERSIÓN ${contract.version}</p><h1>Contrato de prestación de servicios</h1><p><b>Cliente:</b> ${escapar(contract.clienteNombre || nombreCompleto(client))} · ${escapar(contract.clienteTipoDocumento || client?.tipoDocumento)} ${documentValue(clientDocument)}</p><p><b>Profesional:</b> ${escapar(contract.profesionalNombre || nombreCompleto(professional))} · ${escapar(contract.profesionalTipoDocumento || professional?.tipoDocumento)} ${documentValue(professionalDocument)}</p><h2>Objeto y alcance</h2><p>${escapar(request?.descripcion || "Servicio acordado")}</p><p><b>Opción:</b> ${escapar(contract.opcion)} · <b>Total:</b> ${dinero(contract.total)}</p><p>${escapar(contract.detalle)}</p><h2>Lugar y plazo</h2><p>${escapar(request?.departamento)}, ${escapar(request?.provincia)}, ${escapar(request?.distrito)} · Fecha preferida: ${escapar(request?.fecha)}</p><h2>Garantía estructurada</h2>${garantiaHtml}<h2>Condiciones, pagos, garantía y exclusiones</h2><p>${escapar(contract.condiciones)}</p><h2>Plan de productos y ejecución paso a paso (opcional)</h2>${anexoHtml}<div class="contract-signatures"><div><span></span><b>Firma del cliente</b><small>${escapar(contract.clienteNombre || nombreCompleto(client))} · ${escapar(contract.clienteTipoDocumento || client?.tipoDocumento)} ${documentValue(clientDocument)}</small></div><div><span></span><b>Firma del profesional</b><small>${escapar(contract.profesionalNombre || nombreCompleto(professional))} · ${escapar(contract.profesionalTipoDocumento || professional?.tipoDocumento)} ${documentValue(professionalDocument)}</small></div></div><h2>Estado</h2><p>${escapar(contract.estado)}${contract.archivoFirmado ? ` · Archivo: ${escapar(contract.archivoFirmado)}` : ""}</p>${timeline}${executionHtml}${comunicacionHtml}${evidenceHtml}${reviewHtml}<div class="signed-upload no-print">${actions}</div></div>`;
    const dialog = document.getElementById("contractDialog"); if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#adminExportCsv")) return descargarAdministracion("csv");
    if (event.target.closest("#adminExportJson")) return descargarAdministracion("json");
    const nav = event.target.closest("[data-view]"); if (nav) return setView(nav.dataset.view);
    if (event.target.closest("[data-close-dialog]")) event.target.closest("dialog").close();
    const profile = event.target.closest("[data-profile]"); if (profile) showProfile(profile.dataset.profile);
    const request = event.target.closest("[data-request]"); if (request) { document.getElementById("solicitudProfesional").value = request.dataset.request; setView("solicitud"); }
    const open = event.target.closest("[data-open-quote]"); if (open) openQuote(open.dataset.openQuote);
    const openContractButton = event.target.closest("[data-open-contract]"); if (openContractButton) openContract(openContractButton.dataset.openContract);
    const choose = event.target.closest("[data-contract-quote]"); if (choose) createContract(choose.dataset.contractQuote, Number(choose.dataset.option));
    const adminAction = event.target.closest("[data-admin-professional]"); if (adminAction) { const p = data.profesionales.find((x) => x.id === adminAction.dataset.adminProfessional); if (p) { p.estado = adminAction.dataset.state; guardar("Estado profesional actualizado", `${p.id}: ${p.estado}`, "Administrador MVP"); toast(`Perfil ${p.estado.toLowerCase()}.`); } }
    const adminTab = event.target.closest("[data-admin-tab]"); if (adminTab) { document.querySelectorAll("[data-admin-tab]").forEach((b) => b.classList.toggle("active", b === adminTab)); document.querySelectorAll(".admin-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `admin-${adminTab.dataset.adminTab}`)); }
    const upload = event.target.closest("[data-upload-contract]"); if (upload) { const file = document.getElementById("signedContractFile")?.files[0]; if (!file) return toast("Selecciona el contrato firmado."); const contract = data.contratos.find((c) => c.id === upload.dataset.uploadContract); contract.archivoFirmado = file.name; contract.estado = "Firmado"; guardar("Contrato firmado registrado", `${contract.id}: ${file.name}`, "Usuario MVP"); toast("Documento firmado registrado."); openContract(contract.id); }
    const uploadWorkPlan = event.target.closest("[data-upload-work-plan]"); if (uploadWorkPlan) { const file = document.getElementById("workPlanFile")?.files[0]; if (!file) return toast("Selecciona la hoja Excel o CSV."); const contract = data.contratos.find((c) => c.id === uploadWorkPlan.dataset.uploadWorkPlan); contract.anexoPlanTrabajoNombre = file.name; contract.anexoPlanTrabajoRuta = `demo/${file.name}`; contract.anexoPlanTrabajoActualizadoEn = nowIso(); guardar("Anexo Excel del contrato adjuntado", `${contract.id}: ${file.name}`, "Profesional MVP"); toast("Plan opcional adjuntado al contrato."); openContract(contract.id); }
    const openWorkPlan = event.target.closest("[data-open-work-plan]"); if (openWorkPlan) { window.open("plantillas/plantilla-productos-paso-a-paso-vigna.xlsx", "_blank", "noopener"); toast("Plan de trabajo abierto en modo demostración."); }
  });

  document.getElementById("menuButton").addEventListener("click", (event) => { const nav = document.getElementById("mainNav"); nav.classList.toggle("open"); event.currentTarget.setAttribute("aria-expanded", String(nav.classList.contains("open"))); });
  document.getElementById("buscarProfesionales").addEventListener("click", renderMarketplace);
  ["filtroProfesion", "filtroDepartamento", "filtroEstado"].forEach((id) => document.getElementById(id).addEventListener("change", renderMarketplace));
  document.getElementById("filtroZona").addEventListener("input", renderMarketplace);
  document.getElementById("selectorProfesiones").addEventListener("change", syncPrincipal);
  document.getElementById("panelProfesional").addEventListener("change", (event) => { panelProfesionalId = event.target.value; renderPanel(); });

  document.getElementById("formProfesional").addEventListener("submit", (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const selected = form.getAll("profesiones");
    if (!selected.length) return toast("Selecciona al menos una profesión.");
    const p = { id: uid("PV"), nombres: form.get("nombres"), apellidos: form.get("apellidos"), fechaNacimiento: form.get("fechaNacimiento"), correo: form.get("correo"), whatsapp: form.get("whatsapp"), modalidad: form.get("modalidad"), tipoDocumento: form.get("tipoDocumento"), documento: form.get("documento"), paisEmisor: form.get("paisEmisor"), departamento: form.get("departamento"), provincia: form.get("provincia"), distrito: form.get("distrito"), direccionPrivada: form.get("direccion"), referencia: form.get("referencia"), profesiones: selected, profesionPrincipal: form.get("profesionPrincipal"), experiencia: Number(form.get("experiencia")), coberturaTipo: form.get("coberturaTipo"), coberturaDetalle: form.get("coberturaDetalle"), distancia: form.get("distancia"), recargo: form.get("recargo"), descripcion: form.get("descripcion"), estado: "Pendiente", plan: "Sin plan", calificacion: 5, trabajos: 0, fotoIniciales: `${String(form.get("nombres"))[0] || ""}${String(form.get("apellidos"))[0] || ""}`.toUpperCase(), documentosDeclarados: [form.get("documentoFrente"), form.get("documentoReverso"), form.get("selfie")].filter((f) => f && f.name).length, creadoEn: nowIso(), portafolio: [] };
    data.profesionales.push(p); panelProfesionalId = p.id; guardar("Profesional registrado", `${p.id} pendiente de revisión.`, nombreCompleto(p)); event.currentTarget.reset(); syncPrincipal(); toast("Perfil creado y enviado a revisión."); setView("panel");
  });

  document.getElementById("formCliente").addEventListener("submit", (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const c = { id: uid("CL"), nombres: form.get("nombres"), apellidos: form.get("apellidos"), fechaNacimiento: form.get("fechaNacimiento"), correo: form.get("correo"), whatsapp: form.get("whatsapp"), tipoDocumento: form.get("tipoDocumento"), documento: form.get("documento"), departamento: form.get("departamento"), provincia: form.get("provincia"), distrito: form.get("distrito"), zona: form.get("zona"), direccion: form.get("direccion"), referencia: form.get("referencia"), paisEmisor: form.get("paisEmisor"), documentosDeclarados: [form.get("documentoFrente"), form.get("documentoReverso"), form.get("selfie")].filter((f) => f && f.name).length, estado: "Pendiente", creadoEn: nowIso() };
    data.clientes.push(c); guardar("Cliente registrado", c.id, nombreCompleto(c)); event.currentTarget.reset(); toast("Cuenta de cliente creada."); setView("solicitud");
  });

  document.getElementById("formSolicitud").addEventListener("submit", (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const s = { id: uid("SV"), clienteId: form.get("clienteId"), profesionalId: form.get("profesionalId"), profesion: form.get("profesion"), origen: form.get("origen"), tipoNecesidad: form.get("tipoNecesidad"), subcategoria: form.get("subcategoria"), departamento: form.get("departamento"), provincia: form.get("provincia"), distrito: form.get("distrito"), presupuesto: form.get("presupuesto"), fecha: form.get("fecha"), fechaFin: form.get("fechaFin"), modalidadFecha: form.get("modalidadFecha"), urgencia: form.get("urgencia"), responsableMateriales: form.get("responsableMateriales"), situacionActual: form.get("situacionActual"), resultadoEsperado: form.get("resultadoEsperado"), restricciones: form.get("restricciones"), descripcion: form.get("descripcion"), archivosCantidad: form.getAll("archivos").filter((f) => f?.name).length, autorizacion: form.get("autorizacion") === "on", estado: "Enviada", creadoEn: nowIso() };
    data.solicitudes.unshift(s); guardar("Solicitud creada", `${s.id}: ${s.profesion}`, "Cliente MVP"); event.currentTarget.reset(); toast("Solicitud registrada.");
  });

  document.getElementById("formPortafolio").addEventListener("submit", async (event) => {
    event.preventDefault(); const p = data.profesionales.find((item) => item.id === panelProfesionalId); if (!p) return;
    const form = new FormData(event.currentTarget); try { const project = { id: uid("PF"), titulo: form.get("titulo"), categoria: form.get("categoria"), ubicacion: form.get("ubicacion"), duracion: form.get("duracion"), etiquetas: String(form.get("etiquetas") || "").split(",").map((item) => item.trim()).filter(Boolean), reto: form.get("reto"), solucion: form.get("solucion"), productos: form.get("productos"), antes: await imageData(form.get("antes")), despues: await imageData(form.get("despues")), proceso: form.getAll("proceso").filter((file) => file?.name).map((file) => file.name), videoNombre: form.get("video")?.name || "", consentimientoPublicacion: form.get("consentimientoPublicacion") === "on", creadoEn: nowIso(), estado: "Pendiente" }; p.portafolio = p.portafolio || []; p.portafolio.unshift(project); guardar("Proyecto de portafolio agregado", `${p.id}: ${project.titulo}`, nombreCompleto(p)); event.currentTarget.reset(); toast("Proyecto enviado a revisión."); } catch (error) { console.error(error); toast("No se pudo procesar una de las imágenes."); }
  });

  document.getElementById("formCotizacion").addEventListener("submit", (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); if (!form.get("solicitudId")) return toast("Crea o selecciona una solicitud.");
    const anteriores = data.cotizaciones.filter((item) => item.solicitudId === form.get("solicitudId") && item.profesionalId === panelProfesionalId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0)); const anterior = anteriores[0]; const nuevaId = uid("CO"); const opcion = (prefijo, nombre) => ({ nombre, precio: Number(form.get(`${prefijo}Precio`)), detalle: form.get(`${prefijo}Detalle`), materiales: Number(form.get(`${prefijo}Materiales`) || 0), manoObra: Number(form.get(`${prefijo}ManoObra`) || 0), duracion: form.get(`${prefijo}Duracion`) });
    const q = { id: nuevaId, solicitudId: form.get("solicitudId"), profesionalId: panelProfesionalId, opciones: [opcion("economica", "Económica"), opcion("recomendada", "Recomendada"), opcion("premium", "Premium")], garantiaDias: Number(form.get("garantiaDias") || 0), validaHasta: form.get("validaHasta"), disponibilidadEstimada: form.get("disponibilidadEstimada"), responsableMateriales: form.get("responsableMateriales"), exclusiones: form.get("exclusiones"), condiciones: form.get("condiciones"), cotizacionRaizId: anterior?.cotizacionRaizId || anterior?.id || nuevaId, reemplazaA: anterior?.id || "", version: Number(anterior?.version || 0) + 1, estado: "Enviada", creadoEn: nowIso() };
    data.cotizaciones.unshift(q); const s = data.solicitudes.find((item) => item.id === q.solicitudId); if (s) { s.estado = "Cotizada"; if (!s.profesionalId) s.profesionalId = panelProfesionalId; }
    guardar("Cotización enviada", `${q.id} para ${q.solicitudId}`, nombreCompleto(data.profesionales.find((p) => p.id === panelProfesionalId))); event.currentTarget.reset(); toast("Cotización con tres opciones enviada.");
  });

  function enfocarSolicitud(id) {
    const solicitud = data.solicitudes.find((item) => item.id === id);
    if (!solicitud) return false;
    let destino = null;
    if (data.rol === "admin") {
      setView("admin");
      document.querySelector('[data-admin-tab="solicitudes"]')?.click();
      destino = [...document.querySelectorAll("#admin-solicitudes [data-solicitud-id]")]
        .find((elemento) => elemento.dataset.solicitudId === id);
    } else if (data.rol === "profesional") {
      setView("panel");
      const selector = document.getElementById("cotizacionSolicitud");
      if (selector && [...selector.options].some((opcion) => opcion.value === id)) selector.value = id;
      destino = document.getElementById("formCotizacion");
    } else {
      setView("solicitud");
      destino = [...document.querySelectorAll("#listaSolicitudes [data-solicitud-id]")]
        .find((elemento) => elemento.dataset.solicitudId === id);
    }
    if (!destino) return false;
    destino.classList.add("direct-target");
    requestAnimationFrame(() => {
      destino.scrollIntoView({ behavior: "smooth", block: "center" });
      destino.focus?.({ preventScroll: true });
    });
    return true;
  }

  initSelectors(); syncPrincipal(); renderAll();
  window.VignaProfesionalesMVP = {
    getData: () => structuredClone(data),
    abrirContrato: (id) => openContract(id),
    abrirCotizacion: (id) => openQuote(id),
    enfocarSolicitud: (id) => enfocarSolicitud(id),
    mostrarVista: (vista) => setView(vista),
    setData: (nuevo) => {
      if (!nuevo || typeof nuevo !== "object") return;
      data = { ...seedData(), ...nuevo, version: 1 };
      panelProfesionalId = data.profesionales.some((item) => item.id === panelProfesionalId)
        ? panelProfesionalId
        : (data.profesionales[0]?.id || "");
      renderAll();
    },
    reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };
  window.dispatchEvent(new CustomEvent("vigna-mvp-ready"));
})();
