# S.I.G.T.E. — Sistema Inteligente de Gestión del Tránsito y Estacionamiento

S.I.G.T.E. es una plataforma web integral para la administración de estacionamientos universitarios. Permite el control de acceso de vehículos, la gestión de infracciones, la asignación de bloques de estacionamiento y la generación de reportes en tiempo real, todo con roles diferenciados para usuarios, guardias de seguridad y administradores.

---

## Arquitectura del Sistema

Imagina que S.I.G.T.E. es **el cerebro digital de un estacionamiento universitario**. No es una app monolítica aburrida: es un ecosistema donde conviven una **web app**, una **app móvil**, una **base de datos en la nube** y un **sistema de roles** que decide quién ve qué, todo orquestado desde un solo lugar.

### El Panorama General

```
[Browser / Expo App]
        │
        ▼
┌───────────────────────────────┐
│     Next.js 15 (App Router)   │  ← El "cerebro" (frontend + backend juntos)
│                               │
│  ┌─────────────────────────┐  │
│  │  Páginas (React 19)     │  │  ← La interfaz que ves
│  │  - Admin Dashboard      │  │
│  │  - Control de Acceso    │  │
│  │  - Mis Vehículos / QR   │  │
│  │  - Gestión de usuarios  │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │  API Routes (REST)      │  │  ← El "backend" (rutas /api/*)
│  │  - /api/auth/*          │  │
│  │  - /api/access/*        │  │
│  │  - /api/vehicles/*      │  │
│  │  - /api/parking/*       │  │
│  └─────────────────────────┘  │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────┐
│   Prisma ORM          │  ← El "traductor" entre código y DB
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  PostgreSQL (Neon)    │  ← La "memoria" en la nube
│  ☁️ AWS us-east-1    │
└───────────────────────┘
```

---

## 1. Full-Stack Sin Separación

Aquí no hay un backend separado. No existe un "servidor Node.js" por un lado y un "frontend React" por otro. Todo vive dentro de **Next.js con App Router**.

Next.js tiene **Route Handlers**: archivos como `src/app/api/access/route.ts` que se comportan como APIs REST. Cuando el frontend necesita datos, hace `fetch("/api/access")` y Next.js lo resuelve internamente, sin necesidad de un servidor aparte. Esto se llama **arquitectura monorepo full-stack** y se despliega como una sola unidad en **Vercel**.

> **Analogía:** Piensa en un restaurante donde el mismo chef que toma tu orden también cocina. No hay un mesero que lleve la orden a la cocina y otro que la traiga — todo es más rápido porque no hay redundancia.

---

## 2. El Flujo de una Petición Típica

Supongamos que un guardia de seguridad quiere registrar la entrada de un auto:

```
1. El guardia abre /guard (panel de control de acceso)
2. Ingresa la placa y hace clic en "Registrar Entrada"
3. El navegador hace: POST /api/access  { plate: "ABC-123", direction: "IN" }
4. Next.js recibe la petición en el servidor
5. El middleware de autenticación (withAuth) verifica:
   - ¿Tiene cookie de sesión? → sí
   - ¿El JWT es válido? → sí
   - ¿Tiene rol GUARD o ADMIN? → sí
6. El handler busca el vehículo por placa en la base de datos
7. Crea un registro en AccessLog con método, fecha, bloque, etc.
8. Responde con JSON { success: true, accessLog: {...} }
9. El frontend recibe la respuesta y muestra un toast verde
```

### Autenticación con JWT

El **JWT** funciona como un **carnet digital**:

- Cuando inicias sesión, el servidor firma un token con tu `id`, `email`, `rol` y `nombre`.
- Lo guarda en una **cookie httpOnly** (el navegador lo almacena pero JavaScript no puede leerlo — seguridad contra robos de sesión).
- En cada petición, el navegador envía esa cookie automáticamente.
- El servidor verifica la firma con la librería `jose` y, si es válida, sabe quién eres.
- El token expira en **7 días**.

---

## 3. Base de Datos: PostgreSQL en la Nube con Prisma

### ¿Dónde están los datos?

En **Neon**, un servicio de PostgreSQL serverless alojado en AWS (us-east-1).

### ¿Cómo se conecta el código?

Usamos **Prisma ORM** — un "mapeador objeto-relacional" que te permite escribir consultas en TypeScript:

```typescript
// En vez de SQL crudo:
const users = await prisma.user.findMany({
  where: { role: "ADMIN" },
  include: { vehicles: true }
})
```

Prisma genera automáticamente tipos TypeScript a partir del esquema, así que si escribes `user.emial` (mal escrito), TypeScript te lo reclama antes de ejecutar.

### El esquema de datos (6 modelos):

```
User ──1:N──▶ Vehicle
 │              │
 │              currentBlock ──N:1──▶ ParkingBlock
 │              │
 │              ▼
 └──1:N──▶ AccessLog     (cada entrada/salida)
 └──1:N──▶ Infraction    (multas / incidentes)
 └──1:N──▶ Notification  (alertas al usuario)
```

**Detalle inteligente:** La ocupación de cada bloque NO se almacena como un número fijo — se **calcula dinámicamente** contando cuántos vehículos tienen `currentBlockId` apuntando a ese bloque. Esto evita inconsistencias en los datos.

---

## 4. Los Tres Roles: USER, GUARD, ADMIN

Cada rol tiene **su propio layout** y **sus propias rutas protegidas**:

| Rol | ¿Qué puede hacer? |
|-----|-------------------|
| **USER** | Ver su dashboard, registrar vehículos, generar QR de acceso, ver infracciones y notificaciones |
| **GUARD** | Control de acceso (validar placas/QR/tarjetas), ver ocupación en vivo, registrar infracciones |
| **ADMIN** | Todo lo anterior + CRUD de usuarios, gestión de bloques, historial completo, KPIs y gráficas |

### ¿Cómo se protegen las rutas?

1. **Middleware global** (`middleware.ts`): intercepta cada request. Si alguien sin rol ADMIN intenta acceder a `/admin/*`, lo redirige al login.
2. **Layouts por rol**: cada layout (`admin/layout.tsx`, `guard/layout.tsx`) verifica la sesión del lado del servidor antes de renderizar.
3. **API con guardia**: cada ruta API usa `withAuth(handler, { roles: ["ADMIN"] })` que verifica el JWT y el rol antes de ejecutar cualquier lógica.

---

## 5. Frontend: Componentes que Hablan con la API

### Patrón de cada página

```typescript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch("/api/dashboard")
    .then(r => r.json())
    .then(setData)
    .finally(() => setLoading(false))
}, [])

async function handleCreate() {
  await fetch("/api/vehicles", { method: "POST", body: JSON.stringify(...) })
  loadData()  // refetch inmediato tras mutar
}
```

No se usa Redux, Zustand ni ninguna librería de estado global. Cada página es autónoma con su propio fetching.

### Librerías que dan vida a la UI

| Librería | Propósito |
|----------|-----------|
| **Tailwind CSS** | Estilos utilitarios — todo con clases, sin escribir CSS |
| **shadcn/ui** (Radix UI) | Componentes accesibles (tablas, modales, selects, tabs) |
| **Recharts** | Gráficos: líneas (tendencias), barras (ocupación), pastel (métodos de acceso) |
| **Lucide** | Iconos modernos |
| **Sonner** | Notificaciones toast |
| **next-themes** | Modo oscuro por defecto (porque los dashboards siempre se ven mejor en dark mode) |

---

## 6. Conexión con la App Móvil (Expo)

El proyecto está diseñado para tener un **compañero móvil** hecho con Expo (React Native):

```
App Expo ──HTTP──▶ api.sigte.vercel.app/api/*
                     │
                     ├── CORS habilitado para cualquier origen
                     ├── Autenticación por Bearer token (no cookies)
                     └── Mismos endpoints, misma lógica de negocio
```

Cuando un usuario inicia sesión desde el móvil, el servidor responde con un `token` en el cuerpo JSON que la app guarda localmente. En cada petición, la app envía `Authorization: Bearer <token>`. La función `getSessionFromRequest()` detecta automáticamente si la autenticación viene por cookie o por Bearer token.

---

## 7. Despliegue

| Componente | Servicio | ¿Por qué? |
|------------|----------|-----------|
| Aplicación | **Vercel** | Despliegue automático desde GitHub, serverless, integración nativa con Next.js |
| Base de datos | **Neon** | PostgreSQL serverless, scaling automático, conexiones pooling, tier gratuito generoso |

El flujo de actualización:
```
Git push → Vercel detecta cambios → Build → Deploy a producción (~30 segundos)
```

---

## 8. Seguridad: Capas y Más Capas

1. **Passwords**: `bcryptjs` con 10 rondas de salt, mínimo 8 caracteres al registrarse.
2. **JWT**: firmados con HS256, con issuer/audience específicos para evitar falsificación.
3. **Cookies**: `httpOnly` + `sameSite: lax` — el JavaScript del cliente no puede robarlas.
4. **Validación**: `zod` en cada endpoint — tipos y formatos validados antes de tocar la base de datos.
5. **Role-based access**: desde el middleware hasta la API, todo verifica permisos.
6. **SSL/TLS**: conexión a PostgreSQL con `sslmode=require`.
7. **Bloqueo por fuerza bruta**: 5 intentos fallidos de login bloquean la cuenta 15 minutos (`src/lib/loginPolicy.ts`).
8. **Recuperación de contraseña**: token de un solo uso con expiración de 30 min (hash guardado, nunca el valor crudo), enviado por email vía Resend; limitado a 3 reenvíos cada 15 min por cuenta.
9. **Headers HTTP**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS en todas las rutas (`next.config.ts`).

---

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript 5 |
| Frontend | React 19, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Next.js Route Handlers (API REST) |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL (Neon) |
| Autenticación | JWT (HS256) + bcryptjs |
| Validación | Zod |
| Email | Resend (recuperación de contraseña) |
| Tests | Vitest |
| CI | GitHub Actions (typecheck + lint + tests + build) |
| Despliegue | Vercel |

---

## Requisitos

- Node.js 18+
- pnpm (recomendado) o npm

## Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correspondientes

# Aplicar las migraciones a la base
pnpm migrate

# Sembrar datos de prueba (organización demo, USM Viña, planes y un SUPER_ADMIN)
pnpm seed

# Iniciar servidor de desarrollo
pnpm dev

# Correr los tests
pnpm test
```

---

> S.I.G.T.E. es un **monolito moderno**: un solo proyecto Next.js que sirve frontend, backend y API, con PostgreSQL en la nube, JWT para sesiones, tres roles de usuario, integración móvil, y un panel administrativo con gráficos en tiempo real — todo TypeScript, todo tipado, desplegado en Vercel.
