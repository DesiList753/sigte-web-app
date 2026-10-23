# S.I.G.T.E

Sistema Inteligente de Gestión de Tránsito y Estacionamiento. Es una plataforma web de VanillaSoft para que cada organización controle el acceso de vehículos, los cupos de sus estacionamientos y las infracciones.

Funciona para varias organizaciones a la vez (por ejemplo, USM Sede Viña del Mar y USM Campus Valparaíso). Cada una ve solo sus propios datos.

---

## Cómo funciona

### Organizaciones

Cada organización tiene sus usuarios, vehículos, bloques de estacionamiento, accesos e infracciones. Ningún usuario puede ver ni cambiar datos de otra organización.

Cada organización tiene además:
- Un **código** que forma su enlace: `/o/[código]`.
- Su **marca**: nombre visible, logo y color. El admin la cambia en **Configuración**.
- Sus **reglas de registro**: formulario básico o académico, registro abierto o cerrado y dominios de correo permitidos.

### Personas y organizaciones

Cada persona tiene una sola cuenta, identificada por su correo. Esa cuenta puede pertenecer a varias organizaciones, con un rol distinto en cada una. Por ejemplo, un docente puede ser conductor en Viña y guardia en Valparaíso.

- Si una persona ya tiene cuenta y se registra en otra organización, se une usando el mismo correo y la misma contraseña.
- Desde el panel puede cambiar de organización sin cerrar sesión. Al entrar, vuelve a la última que usó.
- Cuando el admin quita a alguien de su organización, la cuenta de esa persona no se borra.
- El rol, la credencial y los datos académicos son propios de cada organización. El nombre, el teléfono y el RUT son de la persona.

### Roles

| Rol | Qué hace | Panel |
|-----|----------|-------|
| VanillaSoft (`SUPER_ADMIN`) | Crea, edita y suspende organizaciones. Asigna planes. Ve la auditoría de todas. | `/platform` |
| Administración (`ADMIN`) | Administra su organización: usuarios, guardias, bloques, vehículos, infracciones y configuración. | `/admin` |
| Guardia (`GUARD`) | Registra entradas y salidas, y ve la ocupación en vivo. | `/guard` |
| Conductor (`USER`) | Registra sus vehículos, genera su QR y ve sus accesos. | `/user` |

### Planes

Cada plan define límites de usuarios, guardias, bloques y vehículos, y qué funciones incluye (QR, infracciones, reportes). VanillaSoft asigna los planes a mano: no hay cobro en línea. Toda organización nueva parte en el plan **Básico**.

### Páginas públicas

| Ruta | Para qué |
|------|----------|
| `/` | Portada del producto y planes. |
| `/crear-organizacion` | Crea una organización y su administrador en un paso. |
| `/o/[código]` | Página de la organización. |
| `/o/[código]/registro` | Registro de conductores de esa organización. |
| `/o/[código]/login` | Inicio de sesión con la marca de la organización. |
| `/register` | Busca la organización por su código. |
| `/login` | Inicio de sesión general. |

### Auditoría

Los cambios importantes quedan registrados con quién los hizo y cuándo. Cada organización ve los suyos en `/admin/audit`, y VanillaSoft ve todos en `/platform/audit`.

---

## Desarrollo local

Requisitos: Node.js 20, pnpm y PostgreSQL 16.

Base de datos local con Docker:

```bash
docker run -d --name sigte-pg -e POSTGRES_USER=sigte -e POSTGRES_PASSWORD=sigte -e POSTGRES_DB=sigte -p 5544:5432 postgres:16-alpine
```

Puesta en marcha:

```bash
pnpm install
cp .env.example .env    # DATABASE_URL="postgresql://sigte:sigte@localhost:5544/sigte"
pnpm migrate            # aplica las migraciones
pnpm seed               # planes, VanillaSoft, USM Viña y USM Campus Valparaíso
pnpm dev
```

### Cuentas de ejemplo

Las crea `pnpm seed`. Solo sirven en desarrollo; el seed no corre en producción. Para cambiar todas las contraseñas usa `SEED_PASSWORD`.

| Organización | Rol | Correo | Contraseña |
|--------------|-----|--------|------------|
| VanillaSoft | Plataforma | `superadmin@vanillasoft.test` | `super123` |
| USM Sede Viña del Mar | Administración | `admin@usm.cl` | `admin123` |
| USM Sede Viña del Mar | Guardia | `guardia@usm.cl` | `guard123` |
| USM Sede Viña del Mar | Conductor | `user@usm.cl` | `user123` |
| USM Campus Valparaíso | Administración | `admin.valparaiso@usm.cl` | `admin123` |
| USM Campus Valparaíso | Guardia | `guardia.valparaiso@usm.cl` | `guard123` |
| USM Campus Valparaíso | Conductor | `alumna.valparaiso@sansano.usm.cl` | `user123` |
| Viña y Valparaíso | Docente en las dos sedes | `fernando@usm.cl` | `user123` |

Las dos sedes USM solo aceptan registros con correo `usm.cl` (incluye subdominios como `sansano.usm.cl`).

---

## Producción

1. Variables de entorno: `DATABASE_URL` y `JWT_SECRET` son obligatorias. Las demás están en `.env.example`.
2. Antes de publicar una versión nueva, aplica las migraciones:

   ```bash
   pnpm migrate
   ```

3. Crea o actualiza la cuenta de VanillaSoft (contraseña de 12 caracteres o más):

   ```bash
   SUPER_ADMIN_EMAIL="correo@dominio.cl" SUPER_ADMIN_PASSWORD="contraseña-larga" pnpm platform:admin
   ```

---

## Próximas ideas

- **Registro común:** crear una cuenta de S.I.G.T.E sin organización y unirse a organizaciones después.
- **Vehículos de la persona:** la persona registra sus vehículos una vez y autoriza a cada organización a verlos. Cada organización decide qué vehículos tienen permiso de ingreso. La base de producción ya tiene las columnas de "permiso" que trajo la PR #5 de S.I.G.T.E-WEB.
- **Versiones /v1, /v2 y /v3:** mostrar la evolución del sistema con planes ocultos y organizaciones de ejemplo.
- **Correos de recuperación:** configurar `RESEND_FROM_EMAIL` con un dominio verificado en Resend.

---

## Pruebas

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

Cada endpoint de la API tiene pruebas que verifican que un usuario no puede leer ni cambiar datos de otra organización. GitHub Actions corre estas cuatro revisiones en cada push.

---

## Seguridad

- **Sesión:** cookie `httpOnly` con un JWT firmado. En cada petición se revisa en la base que el usuario siga activo, que su organización esté activa y que su rol no haya cambiado.
- **Contraseñas:** `bcrypt`, 8 caracteres o más. Tras 5 intentos fallidos, la cuenta se bloquea 15 minutos.
- **Recuperar contraseña:** enlace de un solo uso que vence en 30 minutos, enviado con Resend.
- **Validación:** `zod` en todas las entradas de la API.
- **Planes:** los límites y las funciones se validan en el servidor, no solo en la pantalla.
- **Encabezados HTTP:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS.

---

## Tecnología

| Parte | Herramienta |
|-------|-------------|
| Aplicación | Next.js 16 (App Router), React 19, TypeScript |
| Datos | PostgreSQL, Prisma 6 |
| Sesión | JWT (`jose`) en cookie |
| Validación | Zod |
| Gráficos | Recharts |
| Correo | Resend |
| Pruebas | Vitest |
| Despliegue | Vercel |
