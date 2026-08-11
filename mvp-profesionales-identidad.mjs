export function normalizarPerfilPropio(documento, uid) {
  const propietario = String(uid || "").trim();
  if (!propietario || !documento || String(documento.id || "") !== propietario) return null;
  const datos = typeof documento.data === "function" ? documento.data() : (documento.data || documento);
  return { ...(datos || {}), id: propietario, uid: propietario };
}

export function seleccionarPerfilProfesional(profesionales, rol, uid) {
  if (rol !== "profesional" || !uid || !Array.isArray(profesionales)) return null;
  return profesionales.find((item) =>
    String(item?.id || "") === String(uid) &&
    String(item?.uid || uid) === String(uid)
  ) || null;
}

export function normalizarPlanPropio(plan, uid) {
  const propietario = String(uid || "").trim();
  if (!propietario || !plan || String(plan.id || "") !== propietario) return null;
  if (plan.uid && String(plan.uid) !== propietario) return null;
  if (plan.profesionalUid && String(plan.profesionalUid) !== propietario) return null;
  return { ...plan, id: propietario, uid: propietario, profesionalUid: propietario };
}

export function perfilProfesionalIncompleto(rol, uid, perfil) {
  return rol === "profesional" && Boolean(uid) && !perfil;
}
