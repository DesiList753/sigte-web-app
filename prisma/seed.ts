import {
  PrismaClient,
  type AccessMethod,
  type InfractionStatus,
  type InfractionType,
  type PlanFeature,
  type Prisma,
  type RegistrationForm,
  type Role,
  type UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type BlockDef = { name: string; capacity: number; description: string };

type UserDef = {
  email: string;
  password: string;
  name: string;
  role: Role;
  credentialId?: string;
  userType?: UserType;
  phone?: string;
  position?: string;
  department?: string;
  rut?: string;
  academicDepartment?: string;
  career?: string;
};

type VehicleDef = {
  plate: string;
  make: string;
  model: string;
  color: string;
  owner: string;
  authorized: boolean;
  block: string | null;
};

type InfractionDef = {
  plate: string;
  guard: string;
  type: InfractionType;
  description: string;
  status: InfractionStatus;
  daysAgo: number;
};

type NotificationDef = {
  email: string;
  title: string;
  message: string;
  read: boolean;
  at: [number, number, number];
};

type OrgDef = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  brandColor: string | null;
  plan: string;
  registrationForm: RegistrationForm;
  allowedEmailDomains: string[];
  defaultBlock: BlockDef;
  blocks: BlockDef[];
  users: UserDef[];
  vehicles: VehicleDef[];
  infractions: InfractionDef[];
  notifications: NotificationDef[];
  activityDays: number;
};

const PLANS: {
  code: string;
  name: string;
  maxUsers: number | null;
  maxGuards: number | null;
  maxBlocks: number | null;
  maxVehicles: number | null;
  features: PlanFeature[];
}[] = [
  { code: "basico", name: "Básico", maxUsers: 100, maxGuards: 2, maxBlocks: 3, maxVehicles: 150, features: ["QR"] },
  { code: "profesional", name: "Profesional", maxUsers: 1000, maxGuards: 10, maxBlocks: 10, maxVehicles: 1500, features: ["QR", "INFRACTIONS"] },
  { code: "institucional", name: "Institucional", maxUsers: null, maxGuards: null, maxBlocks: null, maxVehicles: null, features: ["QR", "INFRACTIONS", "REPORTS"] },
];

const SUPER_ADMIN: UserDef = {
  email: "superadmin@vanillasoft.test",
  password: "super123",
  name: "Equipo VanillaSoft",
  role: "SUPER_ADMIN",
};

const DEFAULT_BLOCK_DESCRIPTION = "Bloque por defecto — asignar luego";
const INFO = "Depto. de Informática";
const WELCOME = "Tu cuenta fue creada exitosamente. Puedes generar tu QR de acceso desde el panel.";
const WELCOME_NEW = "Tu cuenta fue creada. Registra tu vehículo para obtener tu código QR de acceso.";

const USM: OrgDef = {
  id: "org_usm_vina",
  slug: "usm-vina",
  name: "Universidad Técnica Federico Santa María, Sede Viña del Mar",
  displayName: "USM Sede Viña del Mar",
  logoUrl: "/escudo-usm.png",
  brandColor: "#004B85",
  plan: "institucional",
  registrationForm: "ACADEMIC",
  allowedEmailDomains: ["usm.cl"],
  defaultBlock: { name: "No definido", capacity: 200, description: DEFAULT_BLOCK_DESCRIPTION },
  blocks: [
    { name: "Estacionamiento 1", capacity: 63, description: "Inferior Sector A · 63 autos + 9 motos" },
    { name: "Estacionamiento 2", capacity: 83, description: "Inferior Sector B · 83 autos, 7 no usables" },
    { name: "Estacionamiento 3", capacity: 16, description: "Central · 16 autos (2 discapacitados) + 4 motos" },
    { name: "Estacionamiento 4", capacity: 50, description: "Superior (en tierra) · capacidad por definir" },
    { name: "Estacionamiento 5", capacity: 50, description: "Superior (en tierra) · capacidad por definir" },
  ],
  users: [
    { email: "admin@usm.cl", password: "admin123", name: "Alejandro Vera Espinoza", role: "ADMIN", credentialId: "ADM-0001", phone: "+56 9 8000 0001" },
    { email: "guardia@usm.cl", password: "guard123", name: "Carlos Guardia Soto", role: "GUARD", credentialId: "GRD-0001", phone: "+56 9 8000 0002" },
    { email: "guardia2@usm.cl", password: "guard123", name: "María Vigía Rojas", role: "GUARD", credentialId: "GRD-0002", phone: "+56 9 8000 0003" },
    { email: "pedro@usm.cl", password: "user123", name: "Pedro Fernández Araya", role: "USER", credentialId: "FUN-0002", userType: "STAFF", phone: "+56 9 7111 2002", position: "Docente", department: INFO },
    { email: "jose@usm.cl", password: "user123", name: "José Hidalgo Palacios", role: "USER", credentialId: "FUN-0003", userType: "STAFF", phone: "+56 9 7111 2003", position: "Administrativo", department: "Bienestar Estudiantil" },
    { email: "fernando@usm.cl", password: "user123", name: "Fernando Ortega Campos", role: "USER", credentialId: "FUN-0013", userType: "STAFF", phone: "+56 9 7111 2013", position: "Jefe de Carrera", department: INFO },
    { email: "user@usm.cl", password: "user123", name: "Juan Pablo González Astudillo", role: "USER", credentialId: "USR-0001", userType: "STUDENT", phone: "+56 9 6222 3001", rut: "20.123.456-7", academicDepartment: INFO, career: "Ingeniería Civil Informática" },
    { email: "nicolas@usm.cl", password: "user123", name: "Nicolás Sepúlveda Cabello", role: "USER", credentialId: "USR-0004", userType: "STUDENT", phone: "+56 9 6222 3004", rut: "20.234.567-8", academicDepartment: INFO, career: "Ingeniería Civil Telemática" },
    { email: "ismael@usm.cl", password: "user123", name: "Ismael Galindo Acuña", role: "USER", credentialId: "USR-0005", userType: "STUDENT", phone: "+56 9 6222 3005", rut: "20.345.678-9", academicDepartment: "Depto. de Industrias", career: "Ingeniería Civil Industrial" },
    { email: "andrea@usm.cl", password: "user123", name: "Andrea López Contreras", role: "USER", credentialId: "USR-0006", userType: "STUDENT", phone: "+56 9 6222 3006", rut: "21.111.222-3", academicDepartment: "Depto. de Química", career: "Ingeniería Civil en Biotecnología" },
    { email: "diego@usm.cl", password: "user123", name: "Diego Muñoz Reyes", role: "USER", credentialId: "USR-0007", userType: "STUDENT", phone: "+56 9 6222 3007", rut: "21.222.333-4", academicDepartment: INFO, career: "Ingeniería en Ejecución en Informática" },
    { email: "camila@usm.cl", password: "user123", name: "Camila Torres Vidal", role: "USER", credentialId: "USR-0008", userType: "STUDENT", phone: "+56 9 6222 3008", rut: "21.333.444-5", academicDepartment: "Depto. de Matemática", career: "Ingeniería Civil Matemática" },
    { email: "rodrigo@usm.cl", password: "user123", name: "Rodrigo Salinas Pino", role: "USER", credentialId: "USR-0009", userType: "STUDENT", phone: "+56 9 6222 3009", rut: "21.444.555-6", academicDepartment: "Depto. de Obras Civiles", career: "Ingeniería Civil" },
    { email: "valentina@usm.cl", password: "user123", name: "Valentina Rivas Moreno", role: "USER", credentialId: "USR-0010", userType: "STUDENT", phone: "+56 9 6222 3010", rut: "22.555.666-7", academicDepartment: "Depto. de Electrónica", career: "Ingeniería Civil Electrónica" },
    { email: "matias@usm.cl", password: "user123", name: "Matías Pérez Fuentes", role: "USER", credentialId: "USR-0011", userType: "STUDENT", phone: "+56 9 6222 3011", rut: "22.666.777-8", academicDepartment: INFO, career: "Ingeniería Civil Informática" },
    { email: "barbara@usm.cl", password: "user123", name: "Bárbara Castro Herrera", role: "USER", credentialId: "USR-0012", userType: "STUDENT", phone: "+56 9 6222 3012", rut: "22.777.888-9", academicDepartment: "Depto. de Mecánica", career: "Ingeniería Civil Mecánica" },
  ],
  vehicles: [
    { plate: "AABB12", make: "Toyota", model: "Yaris", color: "Rojo", owner: "user@usm.cl", authorized: true, block: "Estacionamiento 3" },
    { plate: "CCDD34", make: "Chevrolet", model: "Sail", color: "Azul", owner: "user@usm.cl", authorized: true, block: null },
    { plate: "EEFF56", make: "Nissan", model: "Versa", color: "Blanco", owner: "pedro@usm.cl", authorized: true, block: "Estacionamiento 1" },
    { plate: "GGHH78", make: "Hyundai", model: "Accent", color: "Negro", owner: "jose@usm.cl", authorized: true, block: "Estacionamiento 2" },
    { plate: "JJKK90", make: "Kia", model: "Rio", color: "Gris", owner: "nicolas@usm.cl", authorized: true, block: "Estacionamiento 3" },
    { plate: "LLMM21", make: "Suzuki", model: "Baleno", color: "Blanco", owner: "ismael@usm.cl", authorized: true, block: "Estacionamiento 1" },
    { plate: "NNPP43", make: "Mazda", model: "Mazda 2", color: "Rojo", owner: "andrea@usm.cl", authorized: true, block: "Estacionamiento 3" },
    { plate: "QQRR65", make: "Fiat", model: "Cronos", color: "Negro", owner: "diego@usm.cl", authorized: true, block: "Estacionamiento 2" },
    { plate: "SSTT87", make: "Renault", model: "Kwid", color: "Blanco", owner: "camila@usm.cl", authorized: true, block: "Estacionamiento 4" },
    { plate: "UUVV09", make: "Volkswagen", model: "Gol", color: "Plateado", owner: "rodrigo@usm.cl", authorized: true, block: "Estacionamiento 1" },
    { plate: "WWXX31", make: "Chevrolet", model: "Aveo", color: "Azul", owner: "valentina@usm.cl", authorized: true, block: "Estacionamiento 3" },
    { plate: "YYZZ53", make: "Honda", model: "Fit", color: "Plateado", owner: "matias@usm.cl", authorized: true, block: "Estacionamiento 4" },
    { plate: "BBCC75", make: "Kia", model: "Morning", color: "Blanco", owner: "barbara@usm.cl", authorized: true, block: "Estacionamiento 2" },
    { plate: "DDEE97", make: "Toyota", model: "Corolla", color: "Gris", owner: "fernando@usm.cl", authorized: true, block: "Estacionamiento 3" },
    { plate: "FFGG19", make: "Mitsubishi", model: "Lancer", color: "Verde", owner: "diego@usm.cl", authorized: false, block: null },
    { plate: "HHII41", make: "Peugeot", model: "208", color: "Blanco", owner: "jose@usm.cl", authorized: true, block: "Estacionamiento 4" },
  ],
  infractions: [
    { plate: "AABB12", guard: "guardia@usm.cl", type: "DOUBLE_PARKING", description: "Vehículo estacionado en doble fila frente al Estacionamiento 1, bloqueando salida", status: "OPEN", daysAgo: 0 },
    { plate: "GGHH78", guard: "guardia2@usm.cl", type: "WRONG_BLOCK", description: "Vehículo estacionado en sector de funcionarios sin autorización", status: "ACKNOWLEDGED", daysAgo: 2 },
    { plate: "FFGG19", guard: "guardia@usm.cl", type: "UNAUTHORIZED_ENTRY", description: "Intento de ingreso con patente no registrada en el sistema", status: "RESOLVED", daysAgo: 5 },
    { plate: "QQRR65", guard: "guardia@usm.cl", type: "BLOCKING_ACCESS", description: "Vehículo bloqueando rampa de acceso peatonal en Estacionamiento 2", status: "OPEN", daysAgo: 1 },
    { plate: "CCDD34", guard: "guardia2@usm.cl", type: "EXPIRED_PERMIT", description: "Permiso vehicular vencido desde hace 15 días — notificar al propietario", status: "ACKNOWLEDGED", daysAgo: 4 },
    { plate: "WWXX31", guard: "guardia@usm.cl", type: "SPEEDING", description: "Vehículo circulando a velocidad excesiva en zona de peatones frente a biblioteca", status: "RESOLVED", daysAgo: 8 },
    { plate: "NNPP43", guard: "guardia2@usm.cl", type: "WRONG_BLOCK", description: "Vehículo ocupando lugar reservado sin credencial de acceso correspondiente", status: "DISMISSED", daysAgo: 12 },
    { plate: "EEFF56", guard: "guardia@usm.cl", type: "OTHER", description: "Vehículo con alarma activada por más de 20 minutos — se notificó al dueño", status: "RESOLVED", daysAgo: 15 },
  ],
  notifications: [
    { email: "user@usm.cl", title: "Infracción registrada", message: "Se registró una infracción (Doble fila) para tu vehículo AABB12. Por favor comunícate con Seguridad.", read: false, at: [3, 9, 15] },
    { email: "user@usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME, read: true, at: [28, 8, 30] },
    { email: "pedro@usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME, read: true, at: [25, 9, 10] },
    { email: "jose@usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME, read: true, at: [23, 14, 45] },
    { email: "nicolas@usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME_NEW, read: false, at: [6, 11, 20] },
    { email: "ismael@usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME_NEW, read: false, at: [5, 16, 5] },
    { email: "andrea@usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME, read: true, at: [19, 10, 0] },
    { email: "diego@usm.cl", title: "Vehículo no autorizado", message: "Se detectó un intento de ingreso con tu vehículo FFGG19 que no tiene autorización activa.", read: false, at: [2, 18, 40] },
    { email: "jose@usm.cl", title: "Infracción — Bloque incorrecto", message: "Tu vehículo GGHH78 fue registrado en sector no autorizado. Estado: Notificado.", read: false, at: [4, 13, 25] },
    { email: "user@usm.cl", title: "Permiso próximo a vencer", message: "El permiso de tu vehículo CCDD34 está próximo a vencer. Renuévalo en Administración.", read: false, at: [7, 10, 5] },
  ],
  activityDays: 29,
};

const VALPARAISO: OrgDef = {
  id: "org_usm_valparaiso",
  slug: "usm-valparaiso",
  name: "Universidad Técnica Federico Santa María, Campus Casa Central Valparaíso",
  displayName: "USM Campus Valparaíso",
  logoUrl: "/escudo-usm.png",
  brandColor: "#004B85",
  plan: "profesional",
  registrationForm: "ACADEMIC",
  allowedEmailDomains: ["usm.cl"],
  defaultBlock: { name: "No definido", capacity: 80, description: DEFAULT_BLOCK_DESCRIPTION },
  blocks: [
    { name: "Estacionamiento Principal", capacity: 40, description: "Acceso principal" },
    { name: "Estacionamiento Visitas", capacity: 12, description: "Reservado para visitas" },
  ],
  users: [
    { email: "admin.valparaiso@usm.cl", password: "admin123", name: "Daniela Fuentes Morales", role: "ADMIN", credentialId: "ADM-1001", phone: "+56 9 5100 0001" },
    { email: "guardia.valparaiso@usm.cl", password: "guard123", name: "Roberto Muñoz Silva", role: "GUARD", credentialId: "GRD-1001", phone: "+56 9 5100 0002" },
    { email: "docente.valparaiso@usm.cl", password: "user123", name: "Gonzalo Tapia Reyes", role: "USER", credentialId: "FUN-1001", userType: "STAFF", phone: "+56 9 5100 0003", position: "Docente", department: "Depto. de Matemática" },
    { email: "alumna.valparaiso@sansano.usm.cl", password: "user123", name: "Fernanda Díaz Castro", role: "USER", credentialId: "USR-1001", userType: "STUDENT", phone: "+56 9 5100 0004", rut: "21.456.788-1", academicDepartment: INFO, career: "Ingeniería Civil Informática" },
    { email: "alumno.valparaiso@sansano.usm.cl", password: "user123", name: "Tomás Herrera Lagos", role: "USER", credentialId: "USR-1002", userType: "STUDENT", phone: "+56 9 5100 0005", rut: "20.987.651-5", academicDepartment: "Depto. de Electrónica", career: "Ingeniería Civil Electrónica" },
    { email: "fernando@usm.cl", password: "user123", name: "Fernando Ortega Campos", role: "USER", credentialId: "FUN-1013", userType: "STAFF", phone: "+56 9 7111 2013", position: "Docente", department: INFO },
  ],
  vehicles: [
    { plate: "RRSS11", make: "Toyota", model: "Yaris", color: "Blanco", owner: "alumna.valparaiso@sansano.usm.cl", authorized: true, block: "Estacionamiento Principal" },
    { plate: "TTUU22", make: "Hyundai", model: "Accent", color: "Gris", owner: "alumno.valparaiso@sansano.usm.cl", authorized: true, block: null },
    { plate: "VVWW33", make: "Kia", model: "Rio", color: "Azul", owner: "docente.valparaiso@usm.cl", authorized: true, block: "Estacionamiento Principal" },
    { plate: "XXYY44", make: "Chevrolet", model: "Spark", color: "Rojo", owner: "alumno.valparaiso@sansano.usm.cl", authorized: false, block: null },
  ],
  infractions: [
    { plate: "TTUU22", guard: "guardia.valparaiso@usm.cl", type: "DOUBLE_PARKING", description: "Vehículo en doble fila frente al acceso principal", status: "OPEN", daysAgo: 1 },
    { plate: "XXYY44", guard: "guardia.valparaiso@usm.cl", type: "UNAUTHORIZED_ENTRY", description: "Intento de ingreso con un vehículo sin autorización", status: "RESOLVED", daysAgo: 3 },
  ],
  notifications: [
    { email: "alumna.valparaiso@sansano.usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME, read: true, at: [10, 9, 0] },
    { email: "alumno.valparaiso@sansano.usm.cl", title: "Bienvenido a S.I.G.T.E.", message: WELCOME_NEW, read: false, at: [2, 11, 30] },
  ],
  activityDays: 14,
};

const METHODS: AccessMethod[] = ["PLATE", "PLATE", "PLATE", "QR", "QR", "CARD", "MANUAL"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ago(days: number, h: number, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d;
}

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

async function hash(password: string) {
  return bcrypt.hash(process.env.SEED_PASSWORD ?? password, 10);
}

function person(u: UserDef) {
  return { name: u.name, phone: u.phone ?? null, rut: u.rut ?? null };
}

function membershipOf(u: UserDef) {
  return {
    role: u.role,
    active: true,
    credentialId: u.credentialId ?? null,
    userType: u.userType ?? null,
    position: u.position ?? null,
    department: u.department ?? null,
    academicDepartment: u.academicDepartment ?? null,
    career: u.career ?? null,
  };
}

async function seedPlans() {
  const ids: Record<string, string> = {};
  for (const p of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: p,
      create: { id: `plan_${p.code}`, ...p },
    });
    ids[p.code] = plan.id;
  }
  return ids;
}

async function seedSuperAdmin() {
  const data = { ...person(SUPER_ADMIN), passwordHash: await hash(SUPER_ADMIN.password), platformAdmin: true };
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN.email },
    update: data,
    create: { email: SUPER_ADMIN.email, ...data },
  });
}

async function seedOrganization(def: OrgDef, planIds: Record<string, string>) {
  const orgData = {
    name: def.name,
    displayName: def.displayName,
    logoUrl: def.logoUrl,
    brandColor: def.brandColor,
    status: "ACTIVE" as const,
    planId: planIds[def.plan],
    registrationForm: def.registrationForm,
    allowedEmailDomains: def.allowedEmailDomains,
  };
  const org = await prisma.organization.upsert({
    where: { slug: def.slug },
    update: orgData,
    create: { id: def.id, slug: def.slug, ...orgData },
  });

  const blockIds: Record<string, string> = {};
  for (const b of [def.defaultBlock, ...def.blocks]) {
    const block = await prisma.parkingBlock.upsert({
      where: { organizationId_name: { organizationId: org.id, name: b.name } },
      update: { capacity: b.capacity, description: b.description },
      create: { organizationId: org.id, name: b.name, capacity: b.capacity, description: b.description },
    });
    blockIds[b.name] = block.id;
  }
  await prisma.organization.update({
    where: { id: org.id },
    data: { defaultBlockId: blockIds[def.defaultBlock.name] },
  });

  const userIds: Record<string, string> = {};
  for (const u of def.users) {
    const data = { ...person(u), passwordHash: await hash(u.password) };
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: data,
      create: { email: u.email, ...data, lastOrganizationId: org.id },
    });
    const membership = membershipOf(u);
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: membership,
      create: { userId: user.id, organizationId: org.id, ...membership },
    });
    userIds[u.email] = user.id;
  }

  const vehicles: { id: string; plate: string; ownerId: string; blockId: string | null; authorized: boolean }[] = [];
  for (const v of def.vehicles) {
    const blockId = v.block ? blockIds[v.block] : null;
    const data = {
      make: v.make,
      model: v.model,
      color: v.color,
      ownerId: userIds[v.owner],
      authorized: v.authorized,
      currentBlockId: blockId,
    };
    const vehicle = await prisma.vehicle.upsert({
      where: { organizationId_plate: { organizationId: org.id, plate: v.plate } },
      update: data,
      create: { organizationId: org.id, plate: v.plate, ...data },
    });
    vehicles.push({ id: vehicle.id, plate: v.plate, ownerId: vehicle.ownerId, blockId, authorized: v.authorized });
  }

  await prisma.accessLog.deleteMany({ where: { organizationId: org.id } });
  await prisma.infraction.deleteMany({ where: { organizationId: org.id } });
  await prisma.notification.deleteMany({ where: { organizationId: org.id } });

  const guardIds = def.users.filter((u) => u.role === "GUARD").map((u) => userIds[u.email]);
  const fallbackBlockId = blockIds[def.blocks[0].name];
  const logs: Prisma.AccessLogCreateManyInput[] = [];
  const log = (
    v: (typeof vehicles)[number],
    direction: "IN" | "OUT",
    timestamp: Date,
    method: AccessMethod = pick(METHODS),
    authorized = true,
    note?: string,
  ) =>
    logs.push({
      organizationId: org.id,
      vehicleId: v.id,
      userId: v.ownerId,
      guardId: pick(guardIds),
      blockId: v.blockId ?? fallbackBlockId,
      method,
      direction,
      timestamp,
      authorized,
      note,
    });

  for (const v of vehicles) {
    if (!v.authorized) {
      for (let i = 0; i < 12; i++) {
        log(v, "IN", ago(Math.floor(Math.random() * 14) + 1, pick([8, 9, 10, 14, 15, 16]), pick([0, 15, 30, 45])), pick(["PLATE", "MANUAL"] as const), false, "Vehículo no autorizado — acceso denegado");
      }
      continue;
    }
    for (let day = def.activityDays; day >= 1; day--) {
      if (Math.random() > (day <= 7 ? 0.98 : 0.8)) continue;
      log(v, "IN", ago(day, pick([7, 8, 8, 9]), pick([0, 10, 15, 20, 25, 30, 35, 40, 45, 50])));
      if (Math.random() < 0.5) log(v, "IN", ago(day, pick([12, 13, 14]), pick([0, 15, 30, 45])));
      log(v, "OUT", ago(day, pick([16, 17, 17, 18, 18, 19]), pick([0, 10, 15, 20, 30, 40, 45, 50])));
    }
    if (v.blockId) log(v, "IN", minutesAgo(10 + Math.floor(Math.random() * 170)));
  }

  const active = vehicles.filter((v) => v.authorized);
  for (let day = Math.min(7, def.activityDays); day >= 1; day--) {
    const extra = pick([3, 4, 5, 6]);
    for (let e = 0; e < extra; e++) {
      log(pick(active), "IN", ago(day, pick([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]), pick([0, 15, 30, 45])));
    }
  }
  await prisma.accessLog.createMany({ data: logs });

  const byPlate = Object.fromEntries(vehicles.map((v) => [v.plate, v]));
  await prisma.infraction.createMany({
    data: def.infractions.map((inf) => {
      const at = ago(inf.daysAgo, 10, 30);
      return {
        organizationId: org.id,
        vehicleId: byPlate[inf.plate].id,
        userId: byPlate[inf.plate].ownerId,
        guardId: userIds[inf.guard],
        type: inf.type,
        description: inf.description,
        status: inf.status,
        createdAt: at,
        updatedAt: at,
      };
    }),
  });

  await prisma.notification.createMany({
    data: def.notifications.map((n) => ({
      organizationId: org.id,
      userId: userIds[n.email],
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: ago(...n.at),
    })),
  });

  console.log(
    `  ${def.displayName}: ${def.blocks.length + 1} bloques | ${def.users.length} usuarios | ${def.vehicles.length} vehículos | ${logs.length} accesos | ${def.infractions.length} infracciones | ${def.notifications.length} notificaciones`,
  );
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error(
      "Seed bloqueado en producción. Las credenciales demo son públicas; " +
        "sembrarlas expondría la app. Si de verdad lo necesitas, exporta ALLOW_PROD_SEED=true.",
    );
  }

  console.log("Seeding S.I.G.T.E. demo data...");
  const planIds = await seedPlans();
  await seedSuperAdmin();
  await seedOrganization(USM, planIds);
  await seedOrganization(VALPARAISO, planIds);
  console.log("Seed finalizado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
