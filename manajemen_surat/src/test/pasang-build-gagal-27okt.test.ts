// @vitest-environment node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUILD GAGAL TIDAK BOLEH DILAPORKAN "UPDATE ALETA BERHASIL"
 * ============================================================================
 *
 * 27 Oktober 2026, pemasangan 1.205.41: `npm ci` di build bot gagal, tetapi
 * build dan up dibungkus `if ! ( ... )` - di dalam syarat `if` bash mematikan
 * `set -e`, jadi kegagalan build ditelan oleh `up -d` yang berhasil
 * menyalakan kontainer LAMA. Migrasi lalu jalan di kontainer lama dan versi
 * baru tercatat terpasang.
 *
 * Penjaga teks saja tidak cukup (penyapu teks selalu hijau), jadi skripnya
 * DIJALANKAN di sini dengan `docker` palsu: build gagal, up yang tidak membuat
 * ulang kontainer, dan jalur berhasil.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const skripUpdate = baca("scripts/aleta-update.sh");
const skripRollback = baca("scripts/aleta-rollback.sh");

function cariBash(): string | null {
  if (process.platform !== "win32") return "bash";
  // C:\Windows\System32\bash.exe adalah WSL - bukan yang dicari.
  for (const calon of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]) {
    if (existsSync(calon)) return calon;
  }
  return null;
}
const bash = cariBash();

// tar GNU membaca "C:/..." sebagai host:jalur; bentuk /c/... dipakai di Windows.
const posix = (p: string) =>
  process.platform === "win32" ? p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`) : p;

const DOCKER_PALSU = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_DIR/docker.log"
if [ "$1" = "compose" ]; then
  shift
  case "$1" in
    version) exit 0 ;;
    build)
      sisa=$(cat "$FAKE_DIR/build-gagal" 2>/dev/null || echo 0)
      if [ "$sisa" -gt 0 ]; then
        echo $((sisa - 1)) > "$FAKE_DIR/build-gagal"
        echo "npm error code EUSAGE" >&2
        echo "failed to solve: process did not complete successfully: exit code: 1" >&2
        exit 17
      fi
      echo "sha256:baru" > "$FAKE_DIR/image-terbaru"
      exit 0 ;;
    up)
      if [ ! -f "$FAKE_DIR/up-tidak-buat-ulang" ]; then cp "$FAKE_DIR/image-terbaru" "$FAKE_DIR/image-kontainer"; fi
      exit 0 ;;
    ps) echo "cid-$3"; exit 0 ;;
    *) exit 0 ;;
  esac
fi
if [ "$1" = "inspect" ]; then
  case "$3" in
    *Running*) echo true ;;
    *Restarting*) echo false ;;
    *Config.Image*) echo "aleta-img" ;;
    *Image*) cat "$FAKE_DIR/image-kontainer" ;;
  esac
  exit 0
fi
if [ "$1" = "image" ] && [ "$2" = "inspect" ]; then cat "$FAKE_DIR/image-terbaru"; exit 0; fi
exit 0
`;

type Keadaan = { buildGagal?: number; upTidakBuatUlang?: boolean };

const sampah: string[] = [];
afterEach(() => {
  while (sampah.length) rmSync(sampah.pop()!, { recursive: true, force: true });
});

function tulis(file: string, isi: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, isi);
}

function pasang(keadaan: Keadaan) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "aleta-pasang-uji-"));
  sampah.push(dir);
  const app = path.join(dir, "app");
  const fake = path.join(dir, "fake");
  const bin = path.join(dir, "bin");
  const paket = path.join(dir, "paket", "aleta-update-2.0.0");

  // Aplikasi terpasang versi 1.0.0 - cadangan wajib >= 100 entri.
  tulis(path.join(app, "docker-compose.yml"), "services: {}\n");
  tulis(path.join(app, "manajemen_surat/src/lib/patch-notes.ts"), 'export const APP_VERSION = "1.0.0";\n');
  tulis(path.join(app, "manajemen_surat/src/penanda.txt"), "LAMA\n");
  for (let i = 0; i < 120; i += 1) tulis(path.join(app, `manajemen_surat/src/lama/b${i}.ts`), `export const b${i} = ${i};\n`);
  tulis(path.join(app, "aleta_bot/index.js"), "// lama\n");
  tulis(path.join(app, "scripts/aleta-rollback.sh"), "# rollback lama\n");

  // Paket 2.0.0 membawa skrip yang sedang diuji.
  tulis(path.join(paket, "aleta-update.json"), '{"version":"2.0.0"}\n');
  tulis(path.join(paket, "docker-compose.yml"), "services: {}\n");
  tulis(path.join(paket, "manajemen_surat/src/lib/patch-notes.ts"), 'export const APP_VERSION = "2.0.0";\n');
  tulis(path.join(paket, "manajemen_surat/src/penanda.txt"), "BARU\n");
  tulis(path.join(paket, "manajemen_surat/src/baru-saja.ts"), "export {};\n");
  tulis(path.join(paket, "aleta_bot/index.js"), "// baru\n");
  mkdirSync(path.join(paket, "scripts"), { recursive: true });
  copyFileSync(path.join(akar, "scripts/aleta-update.sh"), path.join(paket, "scripts/aleta-update.sh"));
  copyFileSync(path.join(akar, "scripts/aleta-rollback.sh"), path.join(paket, "scripts/aleta-rollback.sh"));
  copyFileSync(path.join(akar, "scripts/aleta-update.sh"), path.join(app, "scripts/aleta-update.sh"));

  tulis(path.join(bin, "docker"), DOCKER_PALSU);
  tulis(path.join(fake, "image-kontainer"), "sha256:lama\n");
  tulis(path.join(fake, "image-terbaru"), "sha256:lama\n");
  tulis(path.join(fake, "build-gagal"), `${keadaan.buildGagal ?? 0}\n`);
  if (keadaan.upTidakBuatUlang) tulis(path.join(fake, "up-tidak-buat-ulang"), "1\n");

  const env = {
    ...process.env,
    FAKE_DIR: posix(fake),
    FAKE_BIN: posix(bin),
    ALETA_APP_DIR: posix(app),
    ALETA_REPORT_DIR: posix(path.join(dir, "reports")),
    ALETA_BACKUP_ROOT: posix(path.join(dir, "backups")),
    ALETA_RUN_DB_MIGRATIONS: "1",
    ALETA_UPDATE_TUNGGU_DETIK: "0",
    PAKET_DIR: posix(path.join(dir, "paket")),
  };
  delete (env as Record<string, string | undefined>).ALETA_UPDATE_DARI_SALINAN;

  const hasil = spawnSync(
    bash!,
    [
      "-c",
      [
        'chmod +x "$FAKE_BIN/docker"',
        'export PATH="$FAKE_BIN:$PATH"',
        'cd "$PAKET_DIR" && tar -czf aleta-update-2.0.0.tar.gz aleta-update-2.0.0',
        'cd "$ALETA_APP_DIR" && bash scripts/aleta-update.sh "$PAKET_DIR/aleta-update-2.0.0.tar.gz"',
      ].join(" && "),
    ],
    { env, encoding: "utf8", timeout: 90_000 },
  );

  const keluaran = `${hasil.stdout}\n${hasil.stderr}`;
  const dockerLog = existsSync(path.join(fake, "docker.log")) ? readFileSync(path.join(fake, "docker.log"), "utf8") : "";
  const stateFile = path.join(dir, "reports/aleta-update-state.json");
  const state = existsSync(stateFile) ? readFileSync(stateFile, "utf8") : "";
  const historyFile = path.join(dir, "reports/updates/history.jsonl");
  const history = existsSync(historyFile) ? readFileSync(historyFile, "utf8") : "";
  const penanda = readFileSync(path.join(app, "manajemen_surat/src/penanda.txt"), "utf8").trim();
  const adaBerkasBaru = existsSync(path.join(app, "manajemen_surat/src/baru-saja.ts"));
  return { kode: hasil.status, keluaran, dockerLog, state, history, penanda, adaBerkasBaru };
}

describe("teks skrip: setiap langkah diperiksa sendiri", () => {
  it("build dan up tidak lagi di dalam syarat `if ! ( ... )` yang mematikan set -e", () => {
    expect(skripUpdate).not.toMatch(/if ! \(\s*\n\s*cd "\$APP_DIR"[\s\S]{0,4000}compose build/);
    expect(skripUpdate).toContain('|| gagal_pasang "build"');
    expect(skripUpdate).toContain('|| gagal_pasang "up"');
    expect(skripUpdate).toContain("periksa_kontainer_baru || gagal_pasang");
  });

  it("kegagalan memakai aleta-rollback.sh yang ada, dari salinan", () => {
    expect(skripUpdate).toContain('cat "$APP_DIR/scripts/aleta-rollback.sh" > "$salinan_rollback"');
    expect(skripUpdate).toContain("ALETA_ROLLBACK_ASSUME_YES=1");
    expect(skripUpdate).toContain('echo "Update ALETA GAGAL: $tahap"');
  });

  it("rollback mengosongkan folder yang dikelola paket sebelum memulihkan", () => {
    expect(skripRollback).toContain("for managed_path in manajemen_surat/src manajemen_surat/drizzle; do");
    expect(skripRollback).toContain('grep -q -- "^${managed_path}/" <<<"$BACKUP_LIST"');
  });
});

describe.skipIf(!bash)("skrip dijalankan dengan docker palsu", () => {
  it("build gagal: keluar bukan nol, GAGAL: build, tanpa migrasi, versi tidak naik, sumber dipulihkan", () => {
    const r = pasang({ buildGagal: 1 });
    expect(r.kode, r.keluaran).not.toBe(0);
    expect(r.keluaran).toContain("Update ALETA GAGAL: build");
    expect(r.keluaran).not.toContain("Update ALETA berhasil");
    expect(r.keluaran).not.toContain("Versi sekarang   : 2.0.0");
    expect(r.dockerLog).not.toContain("db:migrate");
    // up pertama hanya boleh datang dari rollback, sesudah build kedua.
    const baris = r.dockerLog.split("\n");
    const buildPertama = baris.findIndex((b) => b.startsWith("compose build"));
    const upPertama = baris.findIndex((b) => b.startsWith("compose up"));
    const buildKedua = baris.findIndex((b, i) => i > buildPertama && b.startsWith("compose build"));
    expect(buildKedua, r.dockerLog).toBeGreaterThan(buildPertama);
    expect(upPertama === -1 || upPertama > buildKedua, r.dockerLog).toBe(true);
    expect(r.state).not.toContain('"currentVersion": "2.0.0"');
    expect(r.history).toContain('"status":"failed"');
    expect(r.history).not.toContain('"status":"success"');
    expect(r.penanda).toBe("LAMA");
    expect(r.adaBerkasBaru, "berkas yang dibawa paket tidak boleh tertinggal").toBe(false);
  }, 120_000);

  it("up tidak membuat ulang kontainer: dianggap gagal, tanpa migrasi, sumber dipulihkan", () => {
    const r = pasang({ upTidakBuatUlang: true });
    expect(r.kode, r.keluaran).not.toBe(0);
    expect(r.keluaran).toContain("Update ALETA GAGAL: kontainer tidak dibuat ulang dari image baru");
    expect(r.keluaran).toContain("masih memakai image lama");
    expect(r.keluaran).not.toContain("Update ALETA berhasil");
    expect(r.dockerLog).not.toContain("db:migrate");
    expect(r.state).not.toContain('"currentVersion": "2.0.0"');
    expect(r.penanda).toBe("LAMA");
  }, 120_000);

  it("build dan up berhasil: migrasi jalan dan versi baru ditulis", () => {
    const r = pasang({});
    expect(r.kode, r.keluaran).toBe(0);
    expect(r.keluaran).toContain("berjalan dari image baru sha256:baru");
    expect(r.keluaran).toContain("Update ALETA berhasil.");
    expect(r.dockerLog).toContain("compose exec -T portal npm run db:migrate");
    expect(r.state).toContain('"currentVersion": "2.0.0"');
    expect(r.penanda).toBe("BARU");
  }, 120_000);
});
