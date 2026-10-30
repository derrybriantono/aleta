// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { afterAll, describe, expect, it } from "vitest";

import { bangunPeta, pernyataanTingkatAtas } from "../../scripts/k11-peta.mjs";

/**
 * ============================================================================
 * K11 (26 Okt 2026) - PETA FITUR: SKRIP DIPECAH, TIDAK ADA FITUR YANG HILANG
 * ============================================================================
 *
 * Fixture k11-peta-fitur-sebelum.json adalah inventaris ekstensi 1.205.39 SEBELUM K11
 * (scripts/k11-peta.mjs). Uji ini membangun peta yang sama dari ekstensi sekarang dan
 * menyatakan:
 *
 *   1. konten.js dipecah menjadi inti + 3 modul, dan SEMUA pernyataan tingkat atasnya
 *      masih ada, persis (sidik per pernyataan), tidak lebih tidak kurang selain lem
 *      yang disebut (penunggu modul dan penanda selesai). Tiga baris penjaga yang
 *      ditambahkan di tiga fungsi ditandai K11-GUARD / K11-PRA dan dibuang dulu.
 *   2. inti hanya merujuk ke satu nama per modul (susunPanel, susunPanelDaftar) - pintu
 *      yang dijaga penunggu; modul tidak saling merujuk ke atas (bersama tidak ke
 *      perkara/daftar; perkara dan daftar tidak saling).
 *   3. tiap berkas manifest lama tetap ada di kelompoknya, atau terdaftar sebagai modul
 *      malas (dan modul malas tidak ganda di manifest).
 *   4. semua nama tingkat atas dan ekspor global berkas lama masih didefinisikan.
 *   5. pemuat (modul-malas.js) memuat berurutan, tak menyuntik dua kali, dan gagal
 *      dengan jujur.
 *
 * Perilaku di halaman sungguhan dijaga scripts/k11-e2e.mjs (Chromium + ekstensi).
 */

const AKAR = path.resolve(process.cwd(), "..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");

const sebelum = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/fixtures/k11-peta-fitur-sebelum.json"), "utf8")) as ReturnType<typeof bangunPeta>;

const PECAHAN = ["konten.js", "konten-kontak.js", "konten-panel-bersama.js", "konten-panel-perkara.js", "konten-panel-daftar.js"];
const SEBELUM_ENV = process.env.ALETA_KONTEN_MENTAH;

// pembacaan mentah: konten.js yang dibaca di sini adalah INTI, bukan gabungan (lihat k11-konten-gabungan.ts).
// Diset di tingkat modul karena badan describe() sudah membaca berkas saat pengumpulan uji.
process.env.ALETA_KONTEN_MENTAH = "1";
afterAll(() => {
  if (SEBELUM_ENV === undefined) delete process.env.ALETA_KONTEN_MENTAH;
  else process.env.ALETA_KONTEN_MENTAH = SEBELUM_ENV;
});

/** Daftar modul malas dari modul-malas.js yang dijalankan sungguh (bukan ditebak dari teks). */
function bacaDaftarModul(): Record<string, { pra: string[]; berkas: string[] }> {
  const ctx: Record<string, unknown> = { chrome: { runtime: { sendMessage: async () => ({ ok: true }) } } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(baca("modul-malas.js"), ctx);
  return JSON.parse(JSON.stringify((ctx.AletaModul as { daftar: unknown }).daftar));
}

function berkasModulMalas(): string[] {
  return [...new Set(Object.values(bacaDaftarModul()).flatMap((d) => d.berkas))];
}

const tanpaGuard = (teks: string) =>
  teks
    .split("\n")
    .filter((b) => !/K11-GUARD|K11-PRA/.test(b))
    .join("\n");

describe("peta fitur K11: pernyataan konten.js", () => {
  it("setiap pernyataan tingkat atas konten.js lama masih ada persis; hanya lem K11 yang bertambah", () => {
    const lama = new Map<string, number>();
    for (const h of sebelum.berkas["konten.js"].pernyataan!) lama.set(h, (lama.get(h) || 0) + 1);

    const baru = new Map<string, number>();
    const lem: string[] = [];
    for (const nama of PECAHAN) {
      for (const s of pernyataanTingkatAtas(tanpaGuard(baca(nama)))) {
        if (s.direktif) continue;
        if (s.jenis === "FunctionDeclaration" && ["modulPanelSiap", "pastikanModulPanel"].includes(s.nama[0])) {
          lem.push(s.nama[0]);
          continue;
        }
        if (s.jenis === "ExpressionStatement" && s.teks.includes("__aletaModulSelesai")) {
          lem.push("selesai");
          continue;
        }
        const kunci = sidikPendek(s.teks);
        baru.set(kunci, (baru.get(kunci) || 0) + 1);
      }
    }
    // lem: dua fungsi penunggu + satu penanda selesai per modul (4)
    expect(lem.sort()).toEqual(["modulPanelSiap", "pastikanModulPanel", "selesai", "selesai", "selesai", "selesai"]);
    const hilang: string[] = [];
    const tambah: string[] = [];
    for (const [k, n] of lama) if ((baru.get(k) || 0) !== n) hilang.push(k);
    for (const [k, n] of baru) if ((lama.get(k) || 0) !== n) tambah.push(k);
    expect({ hilang, tambah }).toEqual({ hilang: [], tambah: [] });
  });

  it("empat berkas tidak mendefinisikan nama yang sama dua kali", () => {
    const sudah = new Map<string, string>();
    const ganda: string[] = [];
    for (const nama of PECAHAN) {
      for (const s of pernyataanTingkatAtas(baca(nama))) for (const n of s.nama) {
        if (sudah.has(n)) ganda.push(`${n}: ${sudah.get(n)} & ${nama}`);
        else sudah.set(n, nama);
      }
    }
    expect(ganda).toEqual([]);
  });
});

describe("peta fitur K11: pintu antar-modul", () => {
  const require = createRequire(import.meta.url);
  const acorn = require("acorn");
  const escope = require("eslint-scope");

  function analisa(nama: string) {
    const sumber = baca(nama);
    const ast = acorn.parse(sumber, { ecmaVersion: "latest", sourceType: "script", ranges: true, locations: true });
    const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: "script" });
    const didefinisikan = new Set<string>();
    for (const v of sm.globalScope.variables) if (v.defs.length) didefinisikan.add(v.name);
    const dirujuk = new Set<string>(sm.globalScope.through.map((r: { identifier: { name: string } }) => r.identifier.name));
    return { didefinisikan, dirujuk };
  }
  const a = Object.fromEntries(PECAHAN.map((n) => [n, analisa(n)]));
  const rujukan = (dari: string, ke: string) => [...a[dari].dirujuk].filter((n) => a[ke].didefinisikan.has(n)).sort();

  it("inti hanya merujuk susunPanel dan susunPanelDaftar ke modul", () => {
    expect(rujukan("konten.js", "konten-panel-bersama.js")).toEqual([]);
    expect(rujukan("konten.js", "konten-kontak.js")).toEqual([]);
    expect(rujukan("konten.js", "konten-panel-perkara.js")).toEqual(["susunPanel"]);
    expect(rujukan("konten.js", "konten-panel-daftar.js")).toEqual(["susunPanelDaftar"]);
  });

  it("modul tidak merujuk ke atas: bersama tidak ke perkara/daftar; perkara dan daftar tidak saling", () => {
    expect(rujukan("konten-panel-bersama.js", "konten-panel-perkara.js")).toEqual([]);
    expect(rujukan("konten-panel-bersama.js", "konten-panel-daftar.js")).toEqual([]);
    expect(rujukan("konten-panel-perkara.js", "konten-panel-daftar.js")).toEqual([]);
    expect(rujukan("konten-panel-daftar.js", "konten-panel-perkara.js")).toEqual([]);
  });

  it("tiap pemanggilan susunPanel / susunPanelDaftar di inti didahului penunggu modulnya", () => {
    const baris = baca("konten.js").split("\n");
    const panggil = (nama: string, modul: string) => {
      const pola = new RegExp(`\\b${nama}\\(`);
      const hasil: number[] = [];
      baris.forEach((b, i) => {
        if (b.trim().startsWith("//") || b.trim().startsWith("*")) return;
        if (pola.test(b)) hasil.push(i);
      });
      expect(hasil.length, `pemanggilan ${nama}`).toBeGreaterThan(0);
      for (const i of hasil) {
        const sebelumnya = baris.slice(Math.max(0, i - 2), i).join("\n");
        expect(sebelumnya, `${nama} di baris ${i + 1}`).toMatch(new RegExp(`pastikanModulPanel\\("${modul}"\\)[^\\n]*K11-GUARD`));
      }
      return hasil.length;
    };
    // tiga pemanggil susunPanel (segarkan, gambarDariSimpanan, gambarUlangKonteks), satu susunPanelDaftar
    expect(panggil("susunPanel", "panel-perkara")).toBe(3);
    expect(panggil("susunPanelDaftar", "panel-daftar")).toBe(1);
  });
});

describe("peta fitur K11: kelompok manifest dan modul malas", () => {
  const modul = bacaDaftarModul();
  const berkasModul = berkasModulMalas();
  const sesudah = bangunPeta(EKS, { tambahan: berkasModul });

  it("izin baru hanya 'scripting' (penyuntikan modul malas), tanpa peringatan pasang", () => {
    expect(sesudah.permissions.filter((p) => !sebelum.permissions.includes(p))).toEqual(["scripting"]);
    expect(sebelum.permissions.filter((p) => !sesudah.permissions.includes(p))).toEqual([]);
  });

  it("tidak ada skrip yang lepas dari kelompoknya kecuali terdaftar sebagai modul malas", () => {
    expect(sesudah.kelompok.length).toBeGreaterThanOrEqual(sebelum.kelompok.length);
    for (const k of sebelum.kelompok) {
      const sama = sesudah.kelompok.filter((x) => JSON.stringify([x.matches, x.run_at, x.world]) === JSON.stringify([k.matches, k.run_at, k.world]));
      expect(sama.length, `kelompok ${k.i} (${k.matches[0]})`).toBeGreaterThan(0);
      const adaSesudah = new Set(sama.flatMap((x) => x.js));
      const hilang = k.js.filter((j) => !adaSesudah.has(j) && !berkasModul.includes(j));
      expect(hilang, `kelompok ${k.i}`).toEqual([]);
      // urutan relatif berkas lama dipertahankan
      const urut = sama.flatMap((x) => x.js).filter((j) => k.js.includes(j));
      expect(urut.filter((j) => k.js.includes(j))).toEqual(k.js.filter((j) => urut.includes(j)));
    }
  });

  it("berkas yang baru di manifest hanya modul-malas.js, dan css tidak berubah", () => {
    const lama = new Set(sebelum.kelompok.flatMap((k) => k.js));
    const baru = sesudah.kelompok.flatMap((k) => k.js).filter((j) => !lama.has(j));
    // 26 Okt 2026: blangko-derry-berkas.js = layar kerja Sampul/Daftar Isi (berkas baru yang SENGAJA ditambahkan di luar K11).
    // 27 Okt 2026: sidang-terjadwal.js = Jadwalkan BAS / Tunda (berkas baru yang SENGAJA ditambahkan di luar K11).
    // 28 Okt 2026: tampilan-sipp.js = tampilan ALETA di SIPP per peran/pengguna, kelompok document_start SIPP SENDIRI (di luar K11).
    // 30 Okt 2026 (malam): edoc-seret.js = unggah e-Doc dengan seret-lepas di semua tombol e-Doc SIPP (berkas baru di luar K11).
    // 30 Okt 2026: bas-word-pdf.js = BAS Word ke PDF bertanda tangan di jendela e-Doc BAS SIPP (berkas baru di luar K11).
    // 30 Okt 2026 (G1): blangko-derry-periksa.js = Periksa sebelum cetak di Blangko Derry (berkas baru di luar K11).
    // 30 Okt 2026 (G2a): blangko-derry-draf-saksi.js = draf tanya jawab saksi otomatis, blangko-derry-draf-bas.js = BAS H-1 (pembantu murni Blangko Derry, di luar K11).
    // 30 Okt 2026: blangko-derry-beda-cetak.js = "N bagian berubah sejak cetakan terakhir"; blangko-derry-pustaka.js = pustaka kalimat pribadi (berkas baru di luar K11).
    // 30 Okt 2026: blangko-derry-pulih.js = tampilan Derry tetap di tempat saat halaman dimuat ulang (berkas baru di luar K11).
    // 30 Okt 2026 (G4): temuan-perkara.js = usul pembetulan kehadiran SIPP + putusan SIPP vs dokumen di panel cetak Blangko Derry;
    // sinkron-isian-sipp.js = aturan isian dari SIPP yang ikut diperbarui saat data SIPP berubah (keduanya di luar K11).
    expect([...new Set(baru)].sort()).toEqual(["tampilan-sipp.js", "modul-malas.js", "bas-word-pdf.js", "sidang-terjadwal.js", "blangko-derry-pulih.js", "blangko-derry-berkas.js", "blangko-derry-draf-saksi.js", "blangko-derry-draf-bas.js", "blangko-derry-periksa.js", "blangko-derry-beda-cetak.js", "blangko-derry-pustaka.js", "sinkron-isian-sipp.js", "temuan-perkara.js", "edoc-seret.js", "amar-petitum-sipp.js"].sort());
    const tanpaTampilan = sesudah.kelompok.filter((k) => !(k.js.length === 1 && k.js[0] === "tampilan-sipp.js"));
    expect(tanpaTampilan.map((k) => k.css.filter((c: string) => c !== "sidang-terjadwal.css"))).toEqual(sebelum.kelompok.map((k) => k.css));
  });

  it("modul malas tidak ganda di manifest dan semua berkasnya ada", () => {
    // kelompok SIPP (yang memuat konten.js): modul malas tidak boleh juga dimuat manifest (const ganda); ABT boleh memuat jurusita.js sendiri
    const dimanifest = new Set(sesudah.kelompok.find((k) => k.js.includes("konten.js"))!.js);
    for (const b of berkasModul) {
      expect(dimanifest.has(b), `${b} jangan dimuat manifest SIPP dan modul malas sekaligus`).toBe(false);
      expect(() => baca(b)).not.toThrow();
    }
  });

  it("prasyarat modul malas terdaftar dan tidak melingkar", () => {
    for (const [id, d] of Object.entries(modul)) {
      for (const p of d.pra) expect(modul[p], `${id} -> ${p}`).toBeTruthy();
    }
    const lihat = (id: string, jalur: string[]): void => {
      expect(jalur.includes(id), `lingkaran ${[...jalur, id].join(" > ")}`).toBe(false);
      for (const p of modul[id].pra) lihat(p, [...jalur, id]);
    };
    for (const id of Object.keys(modul)) lihat(id, []);
  });

  it("pekerja latar hanya menyuntik berkas yang terdaftar, dan penyusun menanamnya", () => {
    const latar = baca("latar.js");
    const daftar = /const BERKAS_MODUL_MALAS = new Set\(\[([^\]]*)\]\)/.exec(latar);
    expect(daftar).toBeTruthy();
    const diLatar = [...daftar![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(diLatar).toEqual([...berkasModul].sort());
    const susun = readFileSync(path.join(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    for (const b of [...berkasModul, "modul-malas.js"]) expect(susun, b).toContain(`"${b}",`);
  });

  it("tiap nama tingkat atas dan ekspor berkas lama masih didefinisikan di berkas yang sama atau di modul malas", () => {
    const semuaNama = new Set<string>();
    const semuaEkspor = new Set<string>();
    for (const b of Object.values(sesudah.berkas)) {
      for (const n of b.nama || []) semuaNama.add(n);
      for (const n of b.ekspor || []) semuaEkspor.add(n);
    }
    const hilang: string[] = [];
    for (const [berkas, info] of Object.entries(sebelum.berkas)) {
      for (const n of info.nama || []) if (!semuaNama.has(n)) hilang.push(`${berkas}:${n}`);
      for (const n of info.ekspor || []) if (!semuaEkspor.has(n)) hilang.push(`${berkas}:globalThis.${n}`);
    }
    expect(hilang).toEqual([]);
  });

  it("berkas lain yang tidak disentuh K11 identik byte demi byte dengan sebelumnya", () => {
    // blangko-derry-isian.js: 26 Okt 2026 hanya MENAMBAH pengait layar kerja Sampul/Daftar Isi (blangko-derry-berkas.js); nama tingkat atas lama dijaga uji di bawah.
    // panel-alat.js: 30 Okt 2026 menambah rute bas/word-ke-pdf dan edoc/baca-pdf ke daftar "hanya menghitung" mode coba/latihan.
    // deteksi-sisa-blangko.js: 30 Okt 2026 (malam) menambah jenis pemeriksaan relaas/umum dan jenis temuan "sesuai" untuk seret-lepas e-Doc (salinan TS = salinan JS, diadu uji deteksi-sisa-blangko-17okt dan edoc-seret-30okt).
    // blangko-derry-saksi-tampil.js: 30 Okt 2026 (G2a) MENAMBAH asal jawaban "contoh"; blangko-derry-saksi.js MENAMBAH hurufBesarAwal; saksi-susun.js menyaring pertanyaan wali; blangko-derry.js MENAMBAH api.bukaTautan + draf "h1"; ekspor lama tetap.
    const diubah = new Set(["konten.js", "abt.js", "manifest.json", "latar.js", "blangko-derry-isian.js", "blangko-derry-saksi-tampil.js", "blangko-derry-saksi.js", "saksi-susun.js", "blangko-derry.js", "deteksi-sisa-blangko.js", "panel-alat.js"]);
    for (const [nama, info] of Object.entries(sebelum.berkas)) {
      if (diubah.has(nama) || !sesudah.berkas[nama]) continue;
      // berkas yang sengaja disentuh didaftarkan di KEMBALI_DISENTUH
      if (KEMBALI_DISENTUH.includes(nama)) continue;
      expect(sesudah.berkas[nama].sidik, nama).toBe(info.sidik);
    }
  });

  it("berkas lama yang jadi modul malas hanya bertambah SATU baris penanda selesai di ujungnya", () => {
    for (const nama of KEMBALI_DISENTUH) {
      const baris = baca(nama).split("\n");
      expect(baris[baris.length - 1], nama).toBe("");
      const penanda = baris[baris.length - 2];
      expect(penanda, nama).toBe(`(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("${nama}"); // K11-SELESAI`);
      const tanpa = baris.slice(0, -2).join("\n") + "\n";
      expect(sidikPenuh(tanpa), nama).toBe(sebelum.berkas[nama].sidik);
    }
  });
});

/** Berkas lama yang SENGAJA diubah K11 (tahap berikutnya menambah di sini; uji di atas lalu memeriksa nama/ekspornya saja). */
const KEMBALI_DISENTUH: string[] = ["jurusita.js", "saksiscan.js", "pihak-lengkap.js", "penetapan-borang.js", "tarik-satu-perkara.js"];

function sidikPenuh(teks: string): string {
  return createRequire(import.meta.url)("node:crypto").createHash("sha1").update(teks).digest("hex").slice(0, 40);
}

function sidikPendek(teks: string): string {
  // sama dengan scripts/k11-peta.mjs: sha1 (12 heks) dari teks pernyataan
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return createRequire(import.meta.url)("node:crypto").createHash("sha1").update(teks).digest("hex").slice(0, 12);
}

describe("pemuat modul malas (modul-malas.js)", () => {
  function buatLingkungan(opsi: { gagal?: boolean; tunda?: number } = {}) {
    const ctx: Record<string, unknown> = { setTimeout, clearTimeout };
    ctx.globalThis = ctx;
    const disuntik: string[] = [];
    ctx.chrome = {
      runtime: {
        sendMessage: async (pesan: { berkas: string[] }) => {
          if (opsi.tunda) await new Promise((r) => setTimeout(r, opsi.tunda));
          if (opsi.gagal) return { ok: false };
          for (const b of pesan.berkas) {
            disuntik.push(b);
            // meniru berkas modul: menutup dirinya dengan penanda selesai
            vm.runInContext(`(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add(${JSON.stringify(b)});`, ctx as vm.Context);
          }
          return { ok: true };
        },
      },
    };
    vm.createContext(ctx);
    vm.runInContext(baca("modul-malas.js"), ctx);
    return { ctx, disuntik, pemuat: ctx.AletaModul as { siap(id: string): boolean; pastikan(id: string): Promise<boolean> } };
  }

  it("memuat prasyarat lebih dulu, berurutan, dan menandai siap", async () => {
    const { pemuat, disuntik } = buatLingkungan();
    expect(pemuat.siap("panel-perkara")).toBe(false);
    expect(await pemuat.pastikan("panel-perkara")).toBe(true);
    expect(disuntik).toEqual(["konten-panel-bersama.js", "jurusita.js", "saksiscan.js", "konten-panel-perkara.js"]);
    expect(pemuat.siap("panel-perkara")).toBe(true);
    expect(pemuat.siap("panel-bersama")).toBe(true);
    expect(pemuat.siap("panel-daftar")).toBe(false);
  });

  it("tidak menyuntik dua kali walau diminta serentak dan berulang", async () => {
    const { pemuat, disuntik } = buatLingkungan({ tunda: 20 });
    const hasil = await Promise.all([pemuat.pastikan("panel-perkara"), pemuat.pastikan("panel-daftar"), pemuat.pastikan("panel-perkara"), pemuat.pastikan("panel-bersama")]);
    expect(hasil).toEqual([true, true, true, true]);
    expect(await pemuat.pastikan("panel-perkara")).toBe(true);
    expect([...disuntik].sort()).toEqual(["jurusita.js", "konten-panel-bersama.js", "konten-panel-daftar.js", "konten-panel-perkara.js", "saksiscan.js"]);
    expect(new Set(disuntik).size).toBe(disuntik.length);
  });

  it("gagal dengan jujur: false, tidak melempar, dan menunggu sebentar sebelum mencoba lagi", async () => {
    const { pemuat, disuntik } = buatLingkungan({ gagal: true });
    expect(await pemuat.pastikan("panel-daftar")).toBe(false);
    expect(pemuat.siap("panel-daftar")).toBe(false);
    expect(await pemuat.pastikan("panel-daftar")).toBe(false); // masih masa tunggu: tidak bertanya lagi
    expect(disuntik).toEqual([]);
    expect(await pemuat.pastikan("tidak-ada")).toBe(false);
  });

  it("jawaban ok tetapi berkas tidak menutup dirinya dianggap gagal (galat sintaks di berkas)", async () => {
    const ctx: Record<string, unknown> = { setTimeout, clearTimeout };
    ctx.globalThis = ctx;
    ctx.chrome = { runtime: { sendMessage: async () => ({ ok: true }) } }; // tidak ada penanda
    vm.createContext(ctx);
    vm.runInContext(baca("modul-malas.js"), ctx);
    const pemuat = ctx.AletaModul as { pastikan(id: string): Promise<boolean> };
    expect(await pemuat.pastikan("panel-perkara")).toBe(false);
  });

  it("tanpa chrome.runtime (jsdom) pemuat tidak dipasang, dan inti menganggap semua kode sudah ada", () => {
    const ctx: Record<string, unknown> = {};
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(baca("modul-malas.js"), ctx);
    expect(ctx.AletaModul).toBeUndefined();
  });
});
