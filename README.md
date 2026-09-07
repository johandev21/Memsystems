# Memsystems-AI

Memsystems es una aplicación para organizar notebooks, consultar fuentes y generar materiales de estudio con modelos de inteligencia artificial.

El proyecto está organizado como un monorepo con:

- `frontend/`: interfaz web desarrollada con React, Vite y TanStack Router.
- `backend/`: API desarrollada con NestJS, PostgreSQL y Drizzle ORM.

## Funcionalidades

### Notebooks

Los notebooks son el espacio principal de trabajo. Cada uno puede incluir:

- Título, descripción e icono personalizados.
- Imagen de banner con configuración del punto focal.
- Fuentes de información y materiales de estudio relacionados.
- Búsqueda y listado de notebooks del usuario.

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

- Enviar preguntas y recibir respuestas generadas por IA.
- Mantener el historial de mensajes por notebook.
- Recibir respuestas en streaming mientras se generan.
- Mostrar texto y razonamiento cuando el modelo lo proporciona.
- Elegir el modelo utilizado para la conversación.
- Limpiar el historial del chat.

### Materiales de estudio

Los materiales pueden crearse manualmente o generarse a partir del contenido del notebook. Actualmente se admiten:

- Cuestionarios.
- Tarjetas de estudio.
- Rutas de aprendizaje.
- Mapas mentales.

Estos materiales pueden editarse, moverse entre carpetas, visualizarse y filtrarse por tipo. Los cuestionarios también pueden barajarse para variar el orden de las preguntas.

### Organización y papelera

Los materiales se pueden organizar en carpetas dentro de cada notebook. La aplicación incluye una papelera para:

- Recuperar materiales y carpetas eliminados.
- Revisar los elementos enviados a la papelera.
- Eliminar elementos de forma permanente cuando sea necesario.

### Proveedores y modelos de IA

La aplicación integra varios proveedores y permite consultar los modelos disponibles desde la interfaz. Los proveedores configurados actualmente son:

- OpenAI.
- DeepSeek.
- Anthropic.
- Google Gemini.
- Kimi.

La clave global de AI Gateway puede configurarse mediante una variable de entorno o desde los ajustes de la aplicación. La conexión y disponibilidad se comprueban antes de utilizar los modelos. Algunos modelos también admiten búsqueda web.

### Modo local y almacenamiento

- Aplicación local de usuario único, sin autenticación ni separación por cuenta.
- Configuración global de la clave de AI Gateway.
- Almacenamiento local para desarrollo.
- Compatibilidad con almacenamiento S3, R2 o MinIO mediante una interfaz compatible con S3.
- Persistencia de notebooks, fuentes, chats, materiales y configuraciones en PostgreSQL.

## Requisitos

- Node.js
- pnpm `11.17.0` o compatible
- PostgreSQL
- Una clave de proveedor de IA para usar las funciones de generación, salvo que se configure una clave desde la aplicación

## Instalación

Desde la raíz del repositorio:

```bash
pnpm install
```

Copia `backend/.env.example` a `backend/.env.local` y `frontend/.env.example` a `frontend/.env.local` y completa los valores necesarios. Como mínimo, configura:

- `DATABASE_URL`: conexión a PostgreSQL.

Para guardar una clave de AI Gateway desde la aplicación, configura también `CREDENTIALS_ENCRYPTION_KEY`.

Para el desarrollo local se puede usar el almacenamiento en disco incluido en el proyecto. La configuración correspondiente está en `backend/.env.example`.

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

Memsystems utiliza PostgreSQL con Drizzle ORM. Después de configurar `DATABASE_URL`, aplica el esquema con:

```bash
pnpm exec drizzle-kit push
```

Consulta [docs/database.md](docs/database.md) para conocer el esquema y la configuración de la conexión.

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
- PostgreSQL para herramientas locales: `localhost:5432`

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
pnpm run build       # compilar frontend y backend
pnpm run lint        # revisar el código
pnpm run typecheck   # comprobar los tipos de TypeScript
pnpm run test        # ejecutar las pruebas del backend
pnpm run format      # formatear el código configurado
```

El backend también permite ejecutar las pruebas en modo observación:

```bash
pnpm --filter backend run test:watch
```

Las pruebas utilizan una base de datos PostgreSQL independiente. Revisa [docs/testing.md](docs/testing.md) antes de ejecutarlas.

## Estructura del proyecto

```text
frontend/   Aplicación web y componentes de interfaz
backend/    API, autenticación, fuentes, IA y persistencia
docs/       Documentación técnica del proyecto
```

La arquitectura detallada está disponible en [docs/architecture.md](docs/architecture.md).

## Documentación

- [Arquitectura](docs/architecture.md)
- [Base de datos](docs/database.md)
- [Pruebas](docs/testing.md)
- [Arquitectura Frontend](docs/frontend-architecture.md)

## Estado del proyecto

El proyecto se encuentra en desarrollo. Algunas funciones y configuraciones pueden cambiar mientras evoluciona la aplicación.
