# Despliegue de Profesionales Vigna’s

Proyecto: `vigna-plomeros`  
Rama fuente: `agent/profesionales-vigna-mvp`

La configuración publica únicamente el paquete aislado `hosting-profesionales` y las reglas de Firestore/Storage de este repositorio. No fusiona ni modifica `main`.

El workflow de GitHub solo puede iniciarse manualmente. Un `push` no despliega Firebase Hosting, Firestore ni Storage.

## Verificación previa

```bash
npm run check
npm run build:profesionales
```

## Publicación completa

Con una cuenta que tenga permisos sobre el proyecto Firebase:

```bash
npm install
npm run firebase:login
npm run deploy:firebase
```

También se puede publicar por partes:

```bash
npm run deploy:firebase:rules
npm run deploy:firebase:hosting
```

Los scripts fijan Firebase CLI 15.26.0, lo ejecutan mediante Node para evitar el selector de archivos `.js` de Windows y limitan el despliegue al proyecto `vigna-plomeros`.
