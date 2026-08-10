# Despliegue de Profesionales Vigna’s

Proyecto: `vigna-plomeros`  
Rama fuente: `agent/profesionales-vigna-mvp`

La configuración publica únicamente el paquete aislado `hosting-profesionales` y las reglas de Firestore/Storage de este repositorio. No fusiona ni modifica `main`.

## Verificación previa

```bash
npm run check
npm run build:profesionales
```

## Publicación completa

Con una cuenta que tenga permisos sobre el proyecto Firebase:

```bash
npx --yes firebase-tools@15.26.0 login
npm run deploy:firebase
```

También se puede publicar por partes:

```bash
npm run deploy:firebase:rules
npm run deploy:firebase:hosting
```

Los scripts fijan Firebase CLI 15.26.0, el proyecto `vigna-plomeros` y los destinos exactos para evitar desplegar otro proyecto por accidente.
