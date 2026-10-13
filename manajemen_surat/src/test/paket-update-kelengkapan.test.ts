/**
 * 13 Okt 2026: paket update (scripts/aleta-make-update.sh) tidak pernah membawa aleta_bot/kamus-deteksi,
 * helpers/, whatsapp.js, mis.js, select.js, bot_db_config.js, db_config4/5.js, penyandingan/ dan Dockerfile
 * portal - server menjalankan salinan lama atau tidak punya sama sekali (Set pertanyaan ALETA kosong).
 *
 * Penjaga: setiap require relatif dan path.join(__dirname, "...") berliteral di kode bot harus jatuh di
 * dalam daftar salin skrip paket, kecuali folder/berkas yang DITULIS saat berjalan (sengaja tidak ikut).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const AKAR = path.resolve(__dirname, "..", "..", "..");
const SKRIP = readFileSync(path.join(AKAR, "scripts", "aleta-make-update.sh"), "utf8");
const RUNTIME = ["data", "temp", "reports", ".wwebjs_auth", "config/aleta-runtime.json", "config/kamus-deteksi-lapis.json"];

function daftarSalin(): string[] {
  const blok = SKRIP.slice(SKRIP.indexOf("for item in \\"), SKRIP.indexOf("\ndo\n", SKRIP.indexOf("for item in \\")));
  return blok
    .split("\n")
    .slice(1)
    .map((b) => b.replace(/\\\s*$/, "").trim())
    .filter(Boolean);
}

function semuaJs(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "archive_unused", ".wwebjs_auth", "temp", "data", "reports"].includes(n.name)) continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) out.push(...semuaJs(p));
    else if (/\.(c?js|mjs)$/.test(n.name)) out.push(p);
  }
  return out;
}

function ada(p: string) {
  return [p, `${p}.js`, `${p}.json`, path.join(p, "index.js")].some((c) => existsSync(c));
}

describe("paket update membawa semua yang dipakai bot", () => {
  const salin = daftarSalin();
  const tercakup = (relRepo: string) => salin.some((s) => relRepo === s || relRepo.startsWith(`${s}/`));

  it("daftar salin memuat kode & data baca yang dulu tertinggal", () => {
    for (const p of [
      "aleta_bot/kamus-deteksi",
      "aleta_bot/helpers",
      "aleta_bot/penyandingan",
      "aleta_bot/whatsapp.js",
      "aleta_bot/mis.js",
      "aleta_bot/select.js",
      "aleta_bot/bot_db_config.js",
      "aleta_bot/db_config4.js",
      "aleta_bot/db_config5.js",
      "manajemen_surat/Dockerfile",
    ]) {
      expect(salin, p).toContain(p);
    }
    expect(salin).not.toContain("aleta_bot/data");
  });

  it("berkas yang ditulis bot saat berjalan dibuang dari paket", () => {
    expect(SKRIP).toContain('rm -f "$PACKAGE_ROOT/aleta_bot/config/aleta-runtime.json"');
    expect(SKRIP).toContain('"$PACKAGE_ROOT/aleta_bot/config/kamus-deteksi-lapis.json"');
  });

  it("setiap require relatif kode bot (yang ikut paket) jatuh di dalam daftar salin", () => {
    const bot = path.join(AKAR, "aleta_bot");
    const tertinggal: string[] = [];
    for (const f of semuaJs(bot)) {
      const relF = path.relative(AKAR, f).split(path.sep).join("/");
      if (!tercakup(relF)) continue; // berkas ini sendiri tidak dipaketkan (mis. skrip lepas di akar bot)
      const teks = readFileSync(f, "utf8");
      const sasaran: string[] = [];
      for (const m of teks.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) sasaran.push(m[1]);
      for (const m of teks.matchAll(/path\.(?:join|resolve)\(\s*__dirname\s*((?:,\s*["'][^"']+["']\s*)+)\)/g)) {
        sasaran.push([...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]).join("/"));
      }
      for (const rel of sasaran) {
        const abs = path.resolve(path.dirname(f), rel);
        const relBot = path.relative(bot, abs).split(path.sep).join("/");
        if (relBot === "") continue; // folder bot itu sendiri (path.join(__dirname, ".."))
        if (relBot.startsWith("..")) continue; // di luar aleta_bot (portal/ekstensi) - bukan isi image bot
        if (RUNTIME.some((r) => relBot === r || relBot.startsWith(`${r}/`))) continue;
        if (!ada(abs)) continue; // jalur yang dibuat saat berjalan
        const kandidat = [abs, `${abs}.js`, `${abs}.json`].find((c) => existsSync(c)) || abs;
        const relRepo = path.relative(AKAR, kandidat).split(path.sep).join("/");
        if (!tercakup(relRepo)) tertinggal.push(`${relF} -> ${rel}`);
      }
    }
    expect(tertinggal).toEqual([]);
  });
});
