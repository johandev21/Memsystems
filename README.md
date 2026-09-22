# Memsystems-AI

Memsystems es una aplicación para organizar notebooks, consultar fuentes y generar materiales de estudio con modelos de inteligencia artificial.

El proyecto está organizado como un monorepo con:

- `frontend/`: interfaz web desarrollada con React, Vite y TanStack Router.
- `backend/`: API desarrollada con NestJS, PostgreSQL con `pgvector`, Drizzle ORM y la Vercel AI Gateway.

## Funcionalidades

### Biblioteca y notebooks

La biblioteca es la pantalla de inicio. Organiza los notebooks en carpetas y muestra una carpeta a la vez con breadcrumbs. Permite:

- Crear, renombrar, mover y eliminar carpetas y notebooks.
- Ordenar por nombre, fecha de actualización o fecha de creación, con las carpetas primero.
- Arrastrar y soltar, bloqueando el movimiento de una carpeta dentro de sí misma.
- Editar el nombre en línea, confirmando con Enter o Cmd/Ctrl+Enter y cancelando con Escape.

Cada notebook es el espacio principal de trabajo e incluye:

- Título, descripción e icono personalizados.
- Imagen de banner con configuración del punto focal.
- Fuentes de información y materiales de estudio relacionados.

### Fuentes de información

Las fuentes se mantienen asociadas al notebook para que el usuario pueda estudiar y conversar sobre el mismo contexto. La aplicación permite:

- Añadir texto directamente.
- Importar contenido desde una URL.
- Subir archivos para extraer y normalizar su contenido.
- Consultar fuentes mediante búsqueda web.
- Seleccionar resultados de búsqueda e importarlos al notebook.
- Reindexar una fuente individual o todas las fuentes del notebook.
- Consultar el contenido procesado, descargar archivos y eliminar fuentes.

### Chat contextual

Cada notebook cuenta con un chat persistente para interactuar con sus fuentes y materiales. El chat permite:

- Enviar preguntas y recibir respuestas generadas por IA a partir de las fuentes del notebook.
- Mantener el historial de mensajes por notebook.
- Recibir respuestas en streaming mientras se generan.
- Mostrar texto y razonamiento cuando el modelo lo proporciona.
- Mostrar citas que enlazan a la evidencia de las fuentes utilizadas.
- Elegir el modelo utilizado para la conversación.
- Limpiar el historial del chat.

### Materiales de estudio

Los materiales pueden crearse manualmente o generarse a partir del contenido del notebook. Actualmente se admiten:

- Cuestionarios.
- Tarjetas de estudio.
- Rutas de aprendizaje.
- Mapas mentales.
- Presentaciones.
- Guías de estudio.
- Problemas de práctica.
- Casos de estudio.

Estos materiales pueden editarse, moverse entre carpetas, visualizarse y filtrarse por tipo. Los cuestionarios también pueden barajarse para variar el orden de las preguntas, y las presentaciones pueden exportarse a PPTX.

### Organización

Los materiales se pueden organizar en carpetas dentro de cada notebook. El árbol del estudio permite:

- Crear, renombrar, duplicar, mover y eliminar materiales y carpetas.
- Arrastrar y soltar, con expansión automática de las carpetas al pasar por encima.
- Navegar con el teclado mediante flechas, Inicio, Fin, Enter y F2.

### Proveedores y modelos de IA

La aplicación integra varios proveedores a través de la Vercel AI Gateway y permite consultar los modelos disponibles desde la interfaz. Los proveedores configurados actualmente son:

- OpenAI.
- DeepSeek.
- Anthropic.
- Google Gemini.
- Kimi.

La clave global de AI Gateway puede configurarse mediante una variable de entorno o desde los ajustes de la aplicación. La conexión y disponibilidad se comprueban antes de utilizar los modelos. La indexación y la búsqueda semántica usan Voyage AI para generar los embeddings, con una conexión propia que también se configura desde los ajustes.

### Modo local y almacenamiento

- Aplicación local de usuario único, sin autenticación ni separación por cuenta.
- Configuración global de las claves de AI Gateway y Voyage AI desde los ajustes.
- Almacenamiento local para desarrollo.
- Compatibilidad con almacenamiento S3, R2 o MinIO mediante una interfaz compatible con S3.
- Persistencia de notebooks, fuentes, chats, materiales y configuraciones en PostgreSQL.

## Requisitos

- Node.js
- pnpm `12.5.1` o compatible
- PostgreSQL con la extensión `pgvector`
- Una clave de AI Gateway para las funciones de IA y una de Voyage AI para la indexación, salvo que se configuren desde la aplicación

## Instalación

Desde la raíz del repositorio:

```bash
pnpm install
```

Copia `backend/.env.example` a `backend/.env.local` y completa los valores necesarios. Como mínimo, configura:

- `DATABASE_URL`: conexión a PostgreSQL.

Para guardar una clave de AI Gateway o de Voyage desde la aplicación, configura también `CREDENTIALS_ENCRYPTION_KEY`.

Para el desarrollo local se puede usar el almacenamiento en disco incluido en el proyecto. La configuración correspondiente está en `backend/.env.example`.

El frontend no necesita un `.env.local`: sus únicas variables (`VITE_HOST`, `NESTJS_BACKEND_URL`, `VITE_USE_POLLING`, `VITE_POLLING_INTERVAL`) son opcionales y se leen del entorno del proceso, no de los archivos `.env` de Vite. Están documentadas en `frontend/.env.example`.

## Desarrollo

Para iniciar el frontend y el backend en paralelo:

```bash
pnpm run dev
```

Las aplicaciones estarán disponibles en:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- API: `http://localhost:4000/api`

También puedes iniciar cada paquete por separado:

```bash
pnpm run dev:frontend
pnpm run dev:backend
```

## Base de datos

Memsystems utiliza PostgreSQL con la extensión `pgvector` y Drizzle ORM. Después de configurar `DATABASE_URL`, aplica las migraciones con:

```bash
pnpm --filter backend run db:migrate
```

Las migraciones viven en `backend/drizzle/` y la configuración de Drizzle en `backend/drizzle.config.ts`. La migración crea la extensión `pgvector` si falta.

## Docker

Docker ofrece dos flujos aislados. Cada uno tiene sus propios contenedores, base de datos y archivos subidos.

### Desarrollo con recarga automática

El modo de desarrollo ejecuta Vite y NestJS dentro de Docker. Los cambios en `frontend/src` activan HMR y los cambios en `backend/src` reinician el backend automáticamente. El sondeo de archivos está habilitado para que funcione de forma fiable con Docker Desktop en Windows.

```bash
pnpm docker:dev
```

No requiere configuración inicial: si `.env.docker.dev` no existe, se usan los valores desechables de `.env.docker.dev.example`. Para personalizar puertos, proveedores o secretos locales:

```powershell
Copy-Item .env.docker.dev.example .env.docker.dev
```

Servicios expuestos:

- Aplicación: `http://localhost:3000`
- Backend para depuración: `http://localhost:4000/api`
- PostgreSQL para herramientas locales: `localhost:5433` (definido por `DB_PORT`)

Los puertos se pueden cambiar con `APP_PORT`, `API_PORT` y `DB_PORT`. Si cambias `APP_PORT`, actualiza también `APP_ORIGIN` para que ambos señalen al mismo origen público.

### Stack local similar a producción

El modo de producción local compila TypeScript, genera los assets de Vite, sirve el frontend con nginx y ejecuta el backend compilado. Solo expone el frontend; nginx envía `/api` al backend dentro de Docker.

Primero crea su archivo privado de configuración:

```powershell
Copy-Item .env.docker.prod.example .env.docker.prod
```

Genera tres valores independientes ejecutando este comando tres veces:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Usa los tres valores como `POSTGRES_PASSWORD`, `DEV_STORAGE_TOKEN_SECRET` y `CREDENTIALS_ENCRYPTION_KEY`. Los valores hexadecimales son seguros dentro del `DATABASE_URL` que construye Compose. Para uso local puedes conservar `APP_PORT=3000` y `APP_ORIGIN=http://localhost:3000`; en un despliegue, `APP_ORIGIN` debe ser el origen HTTPS exacto que abre el navegador, sin barra final.

Después ejecuta:

```bash
pnpm docker:prod
```

La aplicación queda disponible en `APP_ORIGIN` (`http://localhost:3000` por defecto). Este stack sirve para validación local y como base de imágenes desplegables; no incluye TLS, backups ni gestión de secretos para Internet.

### Comandos Docker

| Desarrollo | Producción local | Propósito |
|-------------|------------------|-----------|
| `pnpm docker:dev` | `pnpm docker:prod` | Construir e iniciar el stack. Desarrollo muestra los logs; producción queda en segundo plano. |
| `pnpm docker:dev:logs` | `pnpm docker:prod:logs` | Seguir los logs. |
| `pnpm docker:dev:ps` | `pnpm docker:prod:ps` | Mostrar el estado de los servicios. |
| `pnpm docker:dev:migrate` | `pnpm docker:prod:migrate` | Ejecutar las migraciones manualmente. |
| `pnpm docker:dev:down` | `pnpm docker:prod:down` | Detener el stack conservando sus datos. |
| `pnpm docker:dev:reset` | `pnpm docker:prod:reset` | Eliminar el stack, su base de datos y sus archivos subidos. |

### Configuración

El backend recibe un único `APP_ORIGIN`, que Compose utiliza para `CLIENT_URL` y `DEV_STORAGE_PUBLIC_URL`. Así, las imágenes y descargas siempre usan el mismo origen que abre el navegador. Las direcciones internas continúan usando los nombres de servicio `backend` y `db`.

Los comandos Docker cargan explícitamente `.env.docker.dev` o `.env.docker.prod`; el `.env` antiguo de la raíz ya no configura Docker. El desarrollo nativo continúa usando `backend/.env.local`.

## Comandos principales

Ejecuta estos comandos desde la raíz:

```bash
pnpm run build        # compilar frontend y backend
pnpm run lint         # revisar el código
pnpm run typecheck    # comprobar los tipos de TypeScript
pnpm run test         # ejecutar las pruebas del frontend y del backend
pnpm run format       # formatear el código configurado
pnpm run format:check # comprobar el formato sin escribir cambios
```

Cada paquete también permite ejecutar sus pruebas en modo observación:

```bash
pnpm --filter frontend run test:watch
pnpm --filter backend run test:watch
```

Las pruebas del backend utilizan una base de datos PostgreSQL independiente con `pgvector`. Copia `backend/.env.test.example` a `backend/.env.test` y sigue [docs/testing.md](docs/testing.md), que explica el orden de preparación (levantar la base, migrar y recién después ejecutar las pruebas) y los errores comunes.

## Estructura del proyecto

```text
frontend/   Aplicación web y componentes de interfaz
backend/    API, fuentes, IA, generación y persistencia
docs/       Documentación técnica del proyecto
```

## Documentación

- [Arquitectura y comportamiento](docs/ARCHITECTURE.md)
- [Glosario](CONTEXT.md)
- [Pruebas](docs/testing.md)

## Estado del proyecto

El proyecto se encuentra en desarrollo. Algunas funciones y configuraciones pueden cambiar mientras evoluciona la aplicación.
