import { execSync } from "node:child_process";

function run(command) {
  execSync(command, { stdio: "inherit" });
}

if (process.env.VERCEL_ENV === "production") run("prisma migrate deploy");
run("next build --webpack");
