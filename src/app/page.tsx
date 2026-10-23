import Link from "next/link";
import { I } from "@/components/Icon";
import { getActor, homePath } from "@/lib/auth";
import { redirect } from "next/navigation";
import s from "./home.module.css";

const FUNCIONES = [
  ["barrier", "Control de acceso", "Cada entrada y salida del pórtico queda registrada en la bitácora."],
  ["parking", "Ocupación por sector", "Los cupos de cada estacionamiento se calculan en tiempo real."],
  ["qr", "QR de acceso", "Cada conductor genera un código de acceso para sus vehículos."],
  ["file", "Infracciones", "Registro de infracciones con seguimiento y aviso al conductor."],
] as const;

export default async function Home() {
  const actor = await getActor();
  if (actor) redirect(homePath(actor.role));

  return (
    <div className={s.page}>
      <header className={s.top}>
        <div className={s.topIn}>
          <span className={s.topName}>S.I.G.T.E</span>
          <span className={s.topTag}>UTFSM · Sede Viña del Mar</span>
          <Link href="/login" className={s.topCta}>
            Iniciar sesión <I name="arrowRight" size={15} />
          </Link>
        </div>
      </header>

      <main>
      <section className={s.hero}>
        <div className={s.eyebrow}>Tránsito y estacionamiento del campus</div>
        <h1>
          Control de acceso vehicular, <span className="accent">en un solo lugar</span>.
        </h1>
        <p className={s.lead}>
          Sistema Inteligente de Gestión de Tránsito y Estacionamiento — Universidad Técnica Federico Santa María.
        </p>
        <div className={s.actions}>
          <Link href="/login" className="btn primary lg">
            <I name="login" size={18} /> Acceder al sistema
          </Link>
          <Link href="/register" className="btn secondary lg">
            Crear cuenta
          </Link>
        </div>
      </section>

      <div className={s.wrap}>
        <section className={s.section}>
          <div className={s.sectionTitle}>Qué hace el sistema</div>
          <div className={s.features}>
            {FUNCIONES.map(([icon, titulo, texto]) => (
              <div className={s.feat} key={titulo}>
                <span className={s.featIcon}>
                  <I name={icon} size={20} stroke={1.9} />
                </span>
                <div>
                  <b>{titulo}</b>
                  <span>{texto}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      </main>

      <footer className={s.footer}>
        <div className={s.footerIn}>
          <b>S.I.G.T.E</b> · Universidad Técnica Federico Santa María, Sede Viña del Mar.
          <br />
          Acceso con cuenta institucional @usm.cl. El uso del escudo institucional debe ser autorizado por la Dirección
          General de Comunicaciones.
        </div>
      </footer>
    </div>
  );
}
