const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const projectRoot = process.cwd();
const nextBin = require.resolve("next/dist/bin/next");
const turboCacheDir = path.join(projectRoot, ".next", "dev", "cache", "turbopack");
const devServerArtifactsDir = path.join(projectRoot, ".next", "dev", "server");
const passthroughArgs = process.argv.slice(2);

try {
  fs.rmSync(turboCacheDir, { recursive: true, force: true });
  process.stdout.write("[dev] Cleared legacy Turbopack cache to keep dev startup lighter.\n");
} catch (error) {
  process.stdout.write(`[dev] Skip cache cleanup: ${error.message}\n`);
}

try {
  fs.rmSync(devServerArtifactsDir, { recursive: true, force: true });
  process.stdout.write("[dev] Cleared stale Next dev server artifacts to avoid manifest corruption.\n");
} catch (error) {
  process.stdout.write(`[dev] Skip dev artifact cleanup: ${error.message}\n`);
}

const env = { ...process.env };
if (!env.NODE_OPTIONS || !env.NODE_OPTIONS.includes("--max-old-space-size")) {
  const maxOldSpaceSizeMb = env.ALETA_DEV_MAX_OLD_SPACE_SIZE_MB || "4096";
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--max-old-space-size=${maxOldSpaceSizeMb}`].filter(Boolean).join(" ");
}

function readPostgresTarget() {
  const databaseUrl = env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/aleta";

  try {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    return null;
  }
}

function checkPortReachable(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1200);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

(async () => {
  const postgresTarget = readPostgresTarget();

  if (postgresTarget) {
    const reachable = await checkPortReachable(postgresTarget.host, postgresTarget.port);
    if (reachable) {
      process.stdout.write(
        `[dev] PostgreSQL permanen terdeteksi di ${postgresTarget.host}:${postgresTarget.port}/${postgresTarget.database}. ALETA akan memakai Drizzle + better-auth ke database permanen.\n`
      );
    } else {
      process.stdout.write(
        `[dev] PostgreSQL belum terjangkau di ${postgresTarget.host}:${postgresTarget.port}/${postgresTarget.database}. Jika backend gagal konek, ALETA akan jatuh ke fallback in-memory khusus development.\n`
      );
    }
  } else {
    process.stdout.write("[dev] DATABASE_URL tidak valid. ALETA akan mencoba fallback development bila koneksi PostgreSQL gagal.\n");
  }

  process.stdout.write(`[dev] Starting Next.js dev server with Webpack and NODE_OPTIONS="${env.NODE_OPTIONS}".\n`);

  const child = spawn(process.execPath, [nextBin, "dev", "--webpack", ...passthroughArgs], {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    process.stderr.write(`[dev] Failed to start Next.js dev server: ${error.message}\n`);
    process.exit(1);
  });
})();
