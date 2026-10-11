// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * ALAMAT YANG DIMINTA PORTAL HARUS DILAYANI BOT
 * ============================================================================
 *
 * Portal tidak pernah menyentuh SIPP sendiri. Hampir seluruh fitur e-Court -
 * jadwal sidang, status perkara, penunjukan, analisis, e-Audit, penarikan -
 * berjalan lewat gatewayFetch ke satu alamat di bot.
 *
 * Bila alamat itu tidak dilayani bot, yang kembali 404. Dan inilah yang
 * membuatnya mahal: gatewayFetch memperlakukan seluruh kegagalan sama, dan
 * layarnya berbunyi
 *
 *     "ALETA Bot belum dapat dihubungi."
 *
 * Bunyi yang PERSIS SAMA dengan botnya benar-benar mati. Dua keadaan yang
 * sangat berbeda - yang satu menuntut kode diperbaiki, yang lain menuntut
 * container dinyalakan - dengan satu kalimat yang sama. Petugas menunggu
 * botnya hidup; botnya sudah hidup sejak tadi.
 *
 * Selisih seperti itu lahir dari hal-hal kecil: satu rute diganti namanya di
 * bot, satu jalur salah ketik di portal, satu berkas rute dipecah. Tidak ada
 * satu pun yang menggagalkan pembangunan, dan tidak ada satu pun yang terlihat
 * sampai seseorang menekan tombolnya.
 *
 * Penjaga ini mengadu keduanya secara langsung: 83 alamat diminta portal, dan
 * seluruhnya harus punya yang melayaninya.
 */

const akar = path.resolve(process.cwd(), "..");

const klien = () =>
  readFileSync(
    path.join(akar, "manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts"),
    "utf8"
  );

/**
 * Bot melayani dari DUA tempat, dan itu memang begitu adanya: sebagian besar
 * di berkas rute, tetapi sambungan WhatsApp dilayani langsung di app.js
 * karena ia menyentuh keadaan sesi peramban yang hidup di sana.
 */
const SUMBER_PELAYAN = ["aleta_bot/routes/internalGatewayRoutes.js", "aleta_bot/app.js"];

/** Alamat yang diminta portal, dibaca dari tiap panggilan gatewayFetch. */
function alamatDiminta(): string[] {
  const isi = klien();
  const hasil = new Set<string>();

  // Bagian TETAP dari alamatnya. Yang sesudah "?" adalah kueri, dan yang
  // sesudah "${" adalah nilai yang disisipkan - keduanya bukan jalur, dan
  // membawanya ikut akan menuduh rute yang sehat.
  for (const m of isi.matchAll(/gatewayFetch\s*(?:<[\s\S]*?>)?\s*\(\s*["'`]([^"'`?$]+)/g)) {
    hasil.add(m[1].replace(/\/+$/, ""));
  }

  return [...hasil].filter((x) => x.startsWith("/internal"));
}

/** Alamat yang dilayani bot, dari router maupun app langsung. */
function alamatDilayani(): string[] {
  const hasil = new Set<string>();

  for (const berkas of SUMBER_PELAYAN) {
    const isi = readFileSync(path.join(akar, berkas), "utf8");
    // router.get("/jalur"  dan  app.post("/internal/aleta-bot/jalur"
    for (const m of isi.matchAll(
      /\b(?:router|app)\.(?:get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g
    )) {
      hasil.add(m[1].replace(/\/+$/, ""));
    }
  }

  return [...hasil];
}

/**
 * Apakah satu alamat yang diminta punya yang melayaninya?
 *
 * Router dipasang di bawah awalan, jadi jalur di berkas rute ditulis tanpa
 * awalan itu. Dan jalur bot dapat memuat parameter - /messages/progress/:id
 * melayani /messages/progress/17.
 */
function adaYangMelayani(diminta: string, dilayani: string[]): boolean {
  const AWALAN = ["/internal/aleta-bot", "/internal", ""];

  for (const awal of AWALAN) {
    const sisa = awal && diminta.startsWith(awal) ? diminta.slice(awal.length) : diminta;
    if (dilayani.includes(sisa)) return true;

    for (const d of dilayani) {
      if (!d.includes(":")) continue;

      // Jalur berparameter cocok dengan alamat lengkapnya - /messages/progress/17
      // dilayani /messages/progress/:id.
      const pola = new RegExp(`^${d.replace(/:[^/]+/g, "[^/]+")}$`);
      if (pola.test(sisa)) return true;

      // Dan cocok pula dengan bagian TETAPNYA saja. Portal menyusun alamatnya
      // sebagai teks bersisipan, sehingga yang terbaca penyapu ini hanya
      // bagian sebelum sisipannya - /messages/progress, tanpa nomornya.
      const tetap = d.replace(/(?:\/:[^/]+)+$/, "");
      if (tetap && tetap === sisa) return true;
    }
  }

  return false;
}

describe("portal dan bot menyebut alamat yang sama", () => {
  it("tiap alamat yang diminta portal ada yang melayaninya", () => {
    const diminta = alamatDiminta();
    const dilayani = alamatDilayani();

    // Angkanya ikut dijaga: penyapu yang tiba-tiba menemukan nol alamat akan
    // lulus tanpa memeriksa apa pun, dan itu penjaga yang berbohong.
    expect(diminta.length).toBeGreaterThan(50);
    expect(dilayani.length).toBeGreaterThan(50);

    const hilang = diminta.filter((x) => !adaYangMelayani(x, dilayani));
    const laporan = hilang.map((x) => `  ${x} - tidak ada yang melayaninya di bot`).join("\n");

    expect(laporan, laporan || "seluruhnya selaras").toBe("");
  });

  it("penyapunya menemukan alamat yang benar-benar tidak dilayani", () => {
    // Penjaga yang tidak dapat gagal bukan penjaga.
    const dilayani = alamatDilayani();
    expect(adaYangMelayani("/internal/aleta-bot/jalur-yang-tidak-pernah-ada", dilayani)).toBe(false);
  });

  it("parameter jalur dikenali, bukan dilaporkan hilang", () => {
    // /messages/progress/:id melayani /messages/progress/17. Penyapu yang
    // tidak mengerti ini akan menuduh rute yang sehat, dan penjaga yang
    // menuduh yang sehat lebih cepat dimatikan orang daripada diperbaiki.
    const dilayani = alamatDilayani();
    expect(adaYangMelayani("/internal/aleta-bot/messages/progress", dilayani)).toBe(true);
  });
});

/**
 * ============================================================================
 * MATA RANTAI KEDUA - EKSTENSI KE PORTAL
 * ============================================================================
 *
 * Rantainya tiga: ekstensi di halaman SIPP memanggil portal, portal memanggil
 * bot, bot membaca SIPP. Mata rantai pertama sudah dijaga di atas; yang ini
 * mata rantai keduanya.
 *
 * Ekstensi paling rawan dari ketiganya. Alamatnya ditulis sebagai teks di
 * dalam berkas yang TIDAK ikut dibangun bersama portal - tidak ada
 * TypeScript, tidak ada pemeriksaan apa pun - dan ia berjalan di halaman
 * milik aplikasi lain, tempat kegagalan memang sengaja dibuat diam supaya
 * SIPP tidak terganggu.
 *
 * Rute portal yang berpindah nama karena itu tidak menghasilkan galat di mana
 * pun. Yang terjadi hanya satu tombol di panel SIPP yang berhenti bekerja,
 * dan tidak ada yang tahu sejak kapan.
 */
describe("ekstensi memanggil rute portal yang benar-benar ada", () => {
  const BERKAS_EKSTENSI = ["konten.js", "abt.js", "panel-alat.js", "popup.js", "tema-awal.js", "checklist.js"];

  /** Alamat portal yang disebut ekstensi, apa adanya dari sumbernya. */
  function alamatEkstensi(): string[] {
    const hasil = new Set<string>();
    for (const nama of BERKAS_EKSTENSI) {
      const p = path.join(akar, "ekstensi-sipp", nama);
      if (!existsSync(p)) continue;
      const isi = readFileSync(p, "utf8");
      for (const m of isi.matchAll(/["'`](\/aleta\/api\/[A-Za-z0-9\-_/]+)/g)) {
        hasil.add(m[1].replace(/\/+$/, ""));
      }
    }
    return [...hasil];
  }

  /** Rute yang ada: tiap folder di src/app/api yang punya route.ts. */
  function rutePortal(dir: string, awalan = ""): string[] {
    const hasil: string[] = [];
    for (const nama of readdirSync(dir)) {
      const p = path.join(dir, nama);
      if (statSync(p).isDirectory()) hasil.push(...rutePortal(p, `${awalan}/${nama}`));
      else if (nama === "route.ts" || nama === "route.tsx") hasil.push(`/aleta/api${awalan}`);
    }
    return hasil;
  }

  function ada(jalur: string, rute: string[]): boolean {
    if (rute.includes(jalur)) return true;
    // Rute dinamis Next.js: [id] satu ruas; [...all] / [[...all]] tangkap-semua
    // (mis. Better Auth /api/auth/[...all] yang melayani sign-in/sipp-sesi).
    return rute.some((r) => {
      if (!r.includes("[")) return false;
      const pola = r.replace(/\[\[?\.\.\.[^\]]+\]\]?/g, "\u0000").replace(/\[[^\]]+\]/g, "[^/]+").replace(/\u0000/g, ".+");
      return new RegExp(`^${pola}$`).test(jalur);
    });
  }

  it("tiap alamat yang disebut ekstensi punya rutenya", () => {
    const disebut = alamatEkstensi();
    const rute = rutePortal(path.join(akar, "manajemen_surat/src/app/api"));

    expect(disebut.length).toBeGreaterThan(10);
    expect(rute.length).toBeGreaterThan(100);

    const hilang = disebut.filter((x) => !ada(x, rute));
    const laporan = hilang.map((x) => `  ${x} - rutenya tidak ada di portal`).join("\n");
    expect(laporan, laporan || "seluruhnya selaras").toBe("");
  });

  it("penyapunya menemukan alamat yang rutenya memang tidak ada", () => {
    const rute = rutePortal(path.join(akar, "manajemen_surat/src/app/api"));
    expect(ada("/aleta/api/jalur-yang-tidak-pernah-ada", rute)).toBe(false);
  });
});
