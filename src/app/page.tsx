import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { PlanFeature } from "@prisma/client";
import { I, type IconName } from "@/components/Icon";
import { Badge, ProductBrand } from "@/components/ui-system";
import { getActor, homePath } from "@/lib/auth";
import { SIGNUP_PLAN } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import s from "./home.module.css";

export const metadata: Metadata = {
  title: "S.I.G.T.E · Control de acceso vehicular para organizaciones",
  description:
    "Registra entradas y salidas, controla los cupos de cada estacionamiento y gestiona infracciones desde un solo panel.",
};

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "barrier", title: "Registro de accesos", text: "Los guardias marcan cada entrada y salida por patente o QR. Todo queda en la bitácora." },
  { icon: "parking", title: "Cupos por estacionamiento", text: "Cada bloque muestra en tiempo real cuántos cupos le quedan." },
  { icon: "qr", title: "QR de acceso", text: "Cada conductor genera un código para sus vehículos y lo muestra al llegar." },
  { icon: "shieldAlert", title: "Infracciones", text: "Registra infracciones, avisa al conductor y sigue cada caso hasta cerrarlo." },
  { icon: "chart", title: "Reportes", text: "Uso por hora y por día, vehículos frecuentes y exportación de la bitácora." },
  { icon: "users", title: "Roles y auditoría", text: "Administración, guardias y conductores con permisos distintos. Los cambios quedan registrados." },
];

const STEPS = [
  { title: "Crea la cuenta", text: "Escribe el nombre de tu organización y tus datos. Quedas como administrador." },
  { title: "Configura", text: "Agrega tus bloques de estacionamiento y las cuentas de tus guardias." },
  { title: "Invita", text: "Comparte el enlace de tu organización para que cada conductor cree su cuenta." },
];

const LIMITS = [
  { key: "maxUsers", one: "usuario", many: "usuarios" },
  { key: "maxGuards", one: "guardia", many: "guardias" },
  { key: "maxBlocks", one: "bloque de estacionamiento", many: "bloques de estacionamiento" },
  { key: "maxVehicles", one: "vehículo", many: "vehículos" },
] as const;

const PLAN_FEATURES: { key: PlanFeature; label: string }[] = [
  { key: "QR", label: "Acceso con QR" },
  { key: "INFRACTIONS", label: "Infracciones" },
  { key: "REPORTS", label: "Reportes y exportación" },
];

function limitText(max: number | null, one: string, many: string) {
  if (max === null) return `${many[0].toUpperCase()}${many.slice(1)} sin límite`;
  return `Hasta ${max.toLocaleString("es-CL")} ${max === 1 ? one : many}`;
}

export default async function Home() {
  const actor = await getActor();
  if (actor) redirect(homePath(actor.role));

  const plans = await prisma.plan.findMany({
    orderBy: { maxUsers: { sort: "asc", nulls: "last" } },
    select: {
      code: true,
      name: true,
      maxUsers: true,
      maxGuards: true,
      maxBlocks: true,
      maxVehicles: true,
      features: true,
    },
  });
  const startPlan = plans.find((p) => p.code === SIGNUP_PLAN);

  return (
    <div className={s.page}>
      <header className={s.top}>
        <div className={s.topIn}>
          <Link href="/" aria-label="S.I.G.T.E, inicio" style={{ display: "flex" }}>
            <ProductBrand />
          </Link>
          <nav className={s.nav}>
            <a href="#funciones" className={s.navLink}>Funciones</a>
            <a href="#planes" className={s.navLink}>Planes</a>
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/crear-organizacion" className={`btn primary ${s.topCta}`}>
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={s.hero}>
          <div className={s.eyebrow}>Control de acceso vehicular</div>
          <h1>
            Entradas, salidas y estacionamientos, <span className={s.accent}>en un solo lugar</span>.
          </h1>
          <p className={s.lead}>
            S.I.G.T.E registra cada acceso, muestra los cupos libres de cada estacionamiento y deja todo en una bitácora.
            Sirve para universidades, empresas, clínicas y condominios.
          </p>
          <div className={s.actions}>
            <Link href="/crear-organizacion" className="btn primary lg">
              Crear cuenta para mi organización <I name="arrowRight" size={18} />
            </Link>
            <Link href="/login" className="btn secondary lg">
              Ya tengo cuenta
            </Link>
          </div>
          {startPlan && (
            <p className={s.note}>La cuenta queda lista en un paso y parte en el plan {startPlan.name}.</p>
          )}
        </section>

        <div className={s.wrap}>
          <section id="funciones" className={s.section}>
            <h2 className={s.sectionTitle}>Qué incluye</h2>
            <div className={s.features}>
              {FEATURES.map((f) => (
                <div className={s.feat} key={f.title}>
                  <span className={s.featIcon}>
                    <I name={f.icon} size={20} stroke={1.9} />
                  </span>
                  <div>
                    <b>{f.title}</b>
                    <span>{f.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={s.section}>
            <h2 className={s.sectionTitle}>Cómo empezar</h2>
            <ol className={s.steps}>
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <div className={s.stepNum}>{i + 1}</div>
                  <b>{step.title}</b>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </section>

          {plans.length > 0 && (
            <section id="planes" className={s.section}>
              <h2 className={s.sectionTitle}>Planes</h2>
              <p className={s.sectionLead}>
                Toda cuenta nueva parte en el plan {startPlan?.name ?? "inicial"}. Para cambiar de plan, contacta a
                VanillaSoft.
              </p>
              <div className={s.plans}>
                {plans.map((p) => (
                  <article key={p.code} className={`${s.plan} ${p.code === SIGNUP_PLAN ? s.planStart : ""}`}>
                    <div className={s.planHead}>
                      <h3>{p.name}</h3>
                      {p.code === SIGNUP_PLAN && <Badge kind="info">Plan inicial</Badge>}
                    </div>
                    <ul className={s.planList}>
                      {LIMITS.map((l) => (
                        <li key={l.key}>
                          <I name="check" size={16} style={{ color: "var(--accent)" }} />
                          {limitText(p[l.key], l.one, l.many)}
                        </li>
                      ))}
                    </ul>
                    <hr className={s.planRule} />
                    <ul className={s.planList}>
                      {PLAN_FEATURES.map((f) => {
                        const included = p.features.includes(f.key);
                        return (
                          <li key={f.key} className={included ? s.yes : s.no}>
                            <I name={included ? "check" : "x"} size={16} />
                            {included ? f.label : `Sin ${f.label.toLowerCase()}`}
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className={s.section}>
            <div className={s.band}>
              <div>
                <h2>¿Tu organización ya usa S.I.G.T.E?</h2>
                <p>Entra con tu cuenta, o crea tu cuenta de conductor con el código de tu organización.</p>
              </div>
              <div className={s.bandActions}>
                <Link href="/login" className="btn secondary">
                  <I name="login" size={17} /> Iniciar sesión
                </Link>
                <Link href="/register" className="btn ghost">
                  <I name="search" size={17} /> Buscar mi organización
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className={s.footer}>
        <div className={s.footerIn}>
          <b>S.I.G.T.E</b> · Sistema Inteligente de Gestión de Tránsito y Estacionamiento. Un producto de VanillaSoft.
        </div>
      </footer>
    </div>
  );
}
