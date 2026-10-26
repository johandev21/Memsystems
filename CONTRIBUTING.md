# Cómo contribuir

Gracias por tu interés en mejorar Memsystems. Los cambios pequeños y bien explicados son más fáciles de revisar y mantener.

## Antes de empezar

- Busca en los issues existentes para evitar duplicados.
- Para un cambio grande o que afecte el comportamiento del producto, abre primero un issue para conversar sobre el alcance.
- No incluyas claves, tokens, datos personales ni contenido privado de notebooks en issues, pull requests, capturas o registros.

## Preparar el entorno

Consulta el [README](README.md) para instalar dependencias y configurar la aplicación. El proyecto usa `pnpm` desde la raíz. Para trabajar en backend, configura la base de datos de desarrollo según las instrucciones del README.

## Cambios de código

- Mantén el alcance de cada pull request acotado y explica el problema que resuelve.
- Sigue las convenciones de la zona que modificas. Revisa las instrucciones locales en `frontend/AGENTS.md` o `backend/AGENTS.md` cuando corresponda.
- Actualiza la documentación relacionada cuando cambie el comportamiento o la configuración.
- No agregues dependencias sin explicar por qué son necesarias.

Antes de abrir el pull request, ejecuta desde la raíz:

```bash
pnpm run lint
pnpm run typecheck
```

Ejecuta también las pruebas de Vitest pertinentes a los archivos modificados. Para backend, usa la base de datos desechable de pruebas descrita en [docs/testing.md](docs/testing.md); nunca apuntes las pruebas a una base con datos que quieras conservar. El workflow de GitHub ejecuta la suite completa.

## Pull requests

- Describe el problema y la solución; incluye pasos de verificación y capturas si hay cambios visuales.
- Señala cualquier cambio de configuración o migración de base de datos.
- Mantén los cambios de formato dentro de los archivos relacionados con tu trabajo.
- Confirma que no incluyes secretos, datos de usuario ni archivos generados que no deban versionarse.

Un pull request puede revisarse cuando la integración continua está aprobada y las preguntas pendientes están resueltas. La revisión puede solicitar cambios antes de integrar.
