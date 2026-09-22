# Pruebas

Esta guía explica cómo ejecutar y escribir pruebas en Memsystems. Está pensada tanto para personas como para agentes de IA: sigue estos pasos para no repetir errores ya conocidos.

## Puerta de calidad

El orden es siempre `lint` -> `typecheck` -> `test`:

```bash
pnpm run lint        # oxlint (frontend) + ESLint (backend)
pnpm run typecheck   # tsc --noEmit en ambos paquetes
pnpm run test        # Vitest en frontend y backend
```

`pnpm run test` ejecuta **ambos paquetes** mediante Turborepo. No es solo backend.

Para un paquete concreto:

```bash
pnpm --filter frontend run test
pnpm --filter backend run test
```

## Pruebas del frontend

- Motor: Vitest con entorno `jsdom`.
- Configuración: `frontend/vitest.config.ts`.
- Setup global: `frontend/src/test/setup.ts`.
- Archivos de prueba: `frontend/src/**/*.test.{ts,tsx}`.

```bash
pnpm --filter frontend run test         # una vez
pnpm --filter frontend run test:watch   # modo observación
```

### i18n: la trampa principal

Las traducciones se cargan **bajo demanda**. `frontend/src/shared/i18n/i18n.ts` solo precarga el namespace `common`; el resto se descarga cuando un componente lo declara con `useTranslation`. Eso produce dos fallos que parecen misteriosos:

1. **DOM vacío.** Mientras el namespace carga, `useTranslation` suspende y el componente no renderiza nada. Una consulta sincrónica como `screen.getByText("...")` ve `<body><div /></div>` y falla, aunque el componente esté bien.
2. **Claves crudas.** Las funciones que llaman a `i18n.t(...)` directamente (por ejemplo `source-processing.ts`, `chat-error.ts`, `use-generation-store.ts`) devuelven la clave sin traducir, como `errors.generic.title` o `toasts.startFailed`, si el namespace todavía no está cargado.

Por eso `frontend/src/test/setup.ts` precarga **todos** los namespaces antes de cada prueba. La lista se deduce de los archivos en `frontend/src/shared/i18n/locales/en/*.json`, así que un namespace nuevo se detecta solo. No elimines esta precarga.

Reglas prácticas:

- Si escribes una prueba nueva, asume que las traducciones ya están cargadas y usa consultas sincrónicas con tranquilidad.
- Si una prueba cambia de idioma (por ejemplo a `es`), debe cargar ese idioma explícitamente, porque la precarga es para `en`:
  ```ts
  await i18n.changeLanguage("es");
  await i18n.loadNamespaces(["common", "sources"]);
  ```
- Si un flujo depende de datos asíncronos (red, `fetch`, timers), prefiere `await screen.findBy...` o `waitFor`.
- Si ves `<body><div /></div>` en el error, sospecha primero de un namespace sin cargar.

## Pruebas del backend

- Motor: Vitest en entorno `node`, con `pool: "forks"` y sin paralelismo entre archivos.
- Configuración: `backend/vitest.config.ts` (carga `backend/.env.test`).
- Setup global: `backend/tests/setup.ts`.
- Archivos de prueba: `backend/tests/**/*.test.ts`.

Las pruebas **necesitan una base PostgreSQL propia con la extensión `pgvector`**. No usan la base de desarrollo: `tests/setup.ts` trunca tablas antes de cada prueba, así que apuntar `.env.test` a la base de desarrollo borraría tus datos.

### Preparación la primera vez

Copia `backend/.env.test.example` a `backend/.env.test`. Por defecto apunta a:

```text
postgresql://postgres:postgres@localhost:5499/memsystems_test
```

Luego sigue este orden exacto:

```bash
# 1. Levantar una base de pruebas desechable (pgvector ya trae la extensión)
docker run -d --name memsystems-test-db -p 5499:5432 \
  -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg17

# 2. Aplicar las migraciones sobre la base de pruebas
DATABASE_URL='postgresql://postgres:postgres@localhost:5499/memsystems_test' \
  pnpm --filter backend run db:migrate

# 3. Crear la base si no existe y ajustar el esquema
pnpm --filter backend run test:db:setup

# 4. Ejecutar las pruebas
pnpm --filter backend run test
```

El paso 2 es obligatorio. `backend/tests/ensure-test-db.ts` supone que el esquema ya existe (hace `ALTER TABLE` y crea tablas auxiliares), por lo que en una base vacía `test:db:setup` falla con:

```text
error: relation "app_settings" does not exist
```

Si ves ese error, aplica las migraciones primero.

### Uso diario

Si el contenedor sigue existiendo, basta con:

```bash
docker start memsystems-test-db   # solo si estaba detenido
pnpm --filter backend run test
pnpm --filter backend run test:watch   # modo observación
```

El contenedor **no forma parte de Compose y no se reinicia solo** al reiniciar la máquina. Para eliminarlo:

```bash
docker rm -f memsystems-test-db
```

## Evaluación de recuperación

El gate de recuperación se ejecuta como una prueba más del backend:

```bash
pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts
```

No necesita claves de proveedor: usa un embedder léxico determinista en lugar de Voyage y un reescritor determinista en lugar del modelo del gateway. Siembra el corpus dorado en la base de pruebas, pasa cada consulta etiquetada por el pipeline real y compara recall, ranking, precisión de contexto, citas, rechazos, fidelidad, latencia y costo contra `backend/tests/eval/baseline.json`.

Tras un cambio intencional en recuperación, actualiza la línea base y revisa el diff antes de confirmarlo:

```bash
RETRIEVAL_EVAL_UPDATE=1 pnpm --filter backend exec vitest run tests/retrieval-eval.test.ts
```

Para agregar consultas etiquetadas y entender cada métrica, consulta [retrieval-evaluation.md](retrieval-evaluation.md).

## Errores comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `connect ECONNREFUSED 127.0.0.1:5499` y cientos de pruebas "skipped" | La base de pruebas no está levantada | `docker start memsystems-test-db` |
| `relation "app_settings" does not exist` al preparar la base | Faltan las migraciones en la base de pruebas | Ejecutar `db:migrate` con el `DATABASE_URL` de `.env.test` |
| DOM vacío (`<body><div /></div>`) en una prueba | El namespace de i18n no está cargado | Revisar la precarga de `frontend/src/test/setup.ts` |
| Se esperaba texto en inglés y llegó una clave (`errors.generic.title`) | Igual que el anterior, pero en una función que usa `i18n.t()` | Igual que el anterior |
| Todos los archivos del backend fallan con "skipped" | `beforeAll` de `tests/setup.ts` falló (casi siempre la base) | Leer el primer error de conexión del reporte |

## Reglas para agentes de IA

- Ejecuta la puerta de calidad después de modificar código: `lint` -> `typecheck` -> `test`.
- No apuntes nunca `backend/.env.test` a la base de desarrollo.
- No elimines la precarga de namespaces de `frontend/src/test/setup.ts`; es lo que mantiene las pruebas sincrónicas.
- Si agregas un idioma, agrega también sus namespaces a la precarga de pruebas (la detección automática cubre `en`).
- Si una prueba falla por un namespace, no cambies el componente: arregla la carga de i18n en la prueba o en el setup.
