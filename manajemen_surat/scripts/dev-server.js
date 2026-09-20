const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

/**
 * ============================================================================
 * PELADEN PENGEMBANGAN - DAN KENAPA IA SEMPAT MEMAKAN DUA GIGABITA
 * ============================================================================
 *
 * Terukur pada mesin pengembang 20 September 2026: satu proses `next dev`
 * memegang 2.040 MB dan 177 detik CPU. Tiga hal di berkas ini saling
 * memperberat, dan dua di antaranya saling bertentangan:
 *
 *   1. `--webpack` DIPAKSA, padahal Next 16 memakai Turbopack sebagai
 *      bawaannya. Webpack menyusun ulang seluruh berkas di dalam satu proses
 *      Node; Turbopack menyusunnya di luar heap V8.
 *
 *   2. Cache Turbopack DIHAPUS pada tiap start, dengan keterangan "to keep
 *      dev startup lighter" - padahal menghapus cache justru membuat start
 *      BERAT: seluruh route disusun dari nol. Keterangan itu benar hanya
 *      selama Turbopack tidak dipakai, dan itulah yang terjadi.
 *
 *   3. Artefak `.next/dev/server` dihapus pada tiap start untuk menghindari
 *      manifest yang rusak. Ongkosnya kompilasi ulang seluruh route tiap kali
 *      peladen dinyalakan.
 *
 * ============================================================================
 * YANG DIUBAH, DAN JALAN KEMBALINYA
 * ============================================================================
 *
 * Bundler kini DAPAT DIPILIH dan bawaannya Turbopack. Pemaksaan webpack tidak
 * dihapus begitu saja - tidak ada catatan mengapa ia dipasang dahulu, dan
 * menghapus pengaman yang tidak dipahami sebabnya adalah cara memunculkan
 * kembali bug yang sudah pernah dibayar orang:
 *
 *   ALETA_DEV_BUNDLER=webpack npm run dev
 *
 * Pembersihan cache dan artefak mengikuti bundler yang dipakai. Pada webpack
 * keduanya tetap dijalankan persis seperti semula. Pada Turbopack cache-nya
 * dipertahankan - itu justru gunanya - dan keduanya masih dapat dipaksa:
 *
 *   ALETA_DEV_BERSIHKAN=1 npm run dev
 */

const projectRoot = process.cwd();
const nextBin = require.resolve("next/dist/bin/next");
const turboCacheDir = path.join(projectRoot, ".next", "dev", "cache", "turbopack");
const devServerArtifactsDir = path.join(projectRoot, ".next", "dev", "server");
const passthroughArgs = process.argv.slice(2);

const env = { ...process.env };

/** "turbopack" (bawaan) atau "webpack". */
const bundler = String(env.ALETA_DEV_BUNDLER || "turbopack").toLowerCase() === "webpack"
  ? "webpack"
  : "turbopack";

// Dipaksa bersih bila diminta; selain itu hanya webpack yang membersihkan,
// sebab cache Turbopack yang dibuang berarti seluruh route disusun dari nol.
const bersihkan = env.ALETA_DEV_BERSIHKAN === "1" || bundler === "webpack";

function buang(target, sebut) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    process.stdout.write(`[dev] ${sebut} dibersihkan.\n`);
  } catch (error) {
    process.stdout.write(`[dev] Lewati pembersihan ${sebut}: ${error.message}\n`);
  }
}

if (bersihkan) {
  buang(turboCacheDir, "Cache Turbopack lama");
  buang(devServerArtifactsDir, "Artefak peladen dev");
} else {
  process.stdout.write(
    "[dev] Cache Turbopack dipertahankan - membuangnya membuat start berat, bukan ringan. " +
      "Paksa dengan ALETA_DEV_BERSIHKAN=1 bila manifestnya rusak.\n"
  );
}

if (!env.NODE_OPTIONS || !env.NODE_OPTIONS.includes("--max-old-space-size")) {
  // Batas heap, bukan pemakaiannya. Dibiarkan lapang: menurunkannya tidak
  // menghemat memori, ia hanya memaksa V8 mengumpulkan sampah lebih sering -
  // yang dibayar dengan CPU, padahal CPU justru yang sedang dikeluhkan.
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

  // Turbopack bawaan Next 16 - benderanya tidak perlu disebut. Yang perlu
  // disebut justru webpack, sebab ia bukan lagi bawaannya.
  const benderaBundler = bundler === "webpack" ? ["--webpack"] : [];

  process.stdout.write(
    `[dev] Menyalakan peladen dev Next.js dengan ${bundler} dan NODE_OPTIONS="${env.NODE_OPTIONS}".\n`
  );

  const child = spawn(process.execPath, [nextBin, "dev", ...benderaBundler, ...passthroughArgs], {
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
    process.stderr.write(`[dev] Gagal menyalakan peladen dev Next.js: ${error.message}\n`);
    process.exit(1);
  });
})();
