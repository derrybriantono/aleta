import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * VERSI DAN KELENGKAPAN EKSTENSI YANG DITANAM
 * ============================================================================
 *
 * Isi ekstensi ditanam ke dalam kode portal karena folder ekstensi-sipp tidak
 * ikut ke dalam container. Uji di aleta-ecourt-zip.test.ts sudah menjaga isi
 * tertanam sama dengan berkas aslinya. Yang TIDAK dijaganya dua hal, dan
 * keduanya gagal tanpa satu pun galat di layar:
 *
 *   1. Berkas yang ada di folder tetapi tidak didaftarkan penyusunnya. Ia
 *      tidak ikut tertanam, tidak ikut ke dalam ZIP, dan gejalanya bukan galat
 *      melainkan fitur yang "tidak muncul".
 *
 *   2. Isi berubah tetapi versinya tidak dinaikkan. Chrome memperbarui
 *      ekstensi dengan membandingkan NOMOR VERSI, bukan isinya - jadi
 *      ekstensi yang sudah terpasang tidak akan pernah diperbarui, dan popup
 *      tidak akan pernah berkata "perlu diperbarui". Sesi pengembangan yang
 *      menaikkan versi dengan tangan enam kali berturut-turut membuat ini
 *      bukan kemungkinan yang jauh.
 *
 * Keduanya dijaga di scripts/susun-ekstensi.mjs, dan uji di sini memastikan
 * penjagaannya benar-benar ada - bukan sekadar tertulis di komentar.
 */
const akarRepo = path.resolve(process.cwd(), "..");
const folderEkstensi = path.join(akarRepo, "ekstensi-sipp");
const penyusun = path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs");

/** Seluruh berkas di dalam folder ekstensi, relatif terhadap akarnya. */
function sapuFolder(akar: string, awalan = ""): string[] {
  const hasil: string[] = [];
  for (const butir of fs.readdirSync(path.join(akar, awalan), { withFileTypes: true })) {
    const relatif = awalan ? `${awalan}/${butir.name}` : butir.name;
    if (butir.isDirectory()) hasil.push(...sapuFolder(akar, relatif));
    else hasil.push(relatif);
  }
  return hasil;
}

describe("versi ekstensi tidak dapat berselisih dengan yang tertanam", () => {
  it("EKSTENSI_VERSI sama dengan version di manifest yang tertanam", async () => {
    const { EKSTENSI_BERKAS, EKSTENSI_VERSI } = await import("@/server/shared/ekstensi-berkas");
    const manifest = JSON.parse(EKSTENSI_BERKAS["manifest.json"] as string);
    expect(EKSTENSI_VERSI).toBe(manifest.version);
  });

  it("dan sama dengan version di berkas manifest aslinya", async () => {
    // Bila keduanya berbeda, portal menyajikan isi yang berbeda dari yang ada
    // di folder - dan nomor versinya pun bukan nomor yang sedang dikembangkan.
    //
    // Dibaca lewat modulnya, bukan diurai dari teks berkasnya: yang dipakai
    // portal memang modulnya, dan mengurai teks menuntut regex yang rapuh
    // terhadap bentuk keluaran penyusunnya.
    if (!fs.existsSync(folderEkstensi)) return;
    const { EKSTENSI_BERKAS } = await import("@/server/shared/ekstensi-berkas");
    const asli = JSON.parse(fs.readFileSync(path.join(folderEkstensi, "manifest.json"), "utf8"));
    const tertanam = JSON.parse(EKSTENSI_BERKAS["manifest.json"] as string);
    expect(tertanam.version, "jalankan node scripts/susun-ekstensi.mjs").toBe(asli.version);
  });
  it("portal membaca versinya dari SATU tempat", async () => {
    // versiEkstensi() dipakai updates.xml, paket.crx, dan halaman pengguna.
    // Tiga tempat yang membaca manifest sendiri-sendiri adalah tiga tempat
    // yang dapat berselisih.
    const paket = fs.readFileSync(
      path.resolve(process.cwd(), "src/server/shared/ekstensi-paket.ts"),
      "utf8"
    );
    expect(paket).toContain("EKSTENSI_BERKAS");
    for (const berkas of [
      "src/app/api/aleta-ecourt/ekstensi/updates.xml/route.ts",
      "src/app/api/aleta-ecourt/ekstensi/paket.crx/route.ts",
    ]) {
      const isi = fs.readFileSync(path.resolve(process.cwd(), berkas), "utf8");
      expect(isi, berkas).toContain("versiEkstensi");
    }
  });
});

describe("sidik isi menjaga versi ikut dinaikkan", () => {
  /**
   * Rumus sidik, SAMA persis dengan hitungSidik di susun-ekstensi.mjs.
   *
   * Pemisahnya String.fromCharCode(10), bukan huruf di dalam template -
   * sebabnya nyata: alat penyuntingan sempat menukar spasi di dalam template
   * literal penyusunnya dengan bita NUL tanpa satu pun gejala, dan sidik yang
   * dihitung penyusunnya lalu berbeda dari yang dihitung di sini. Dua angka
   * yang seharusnya mustahil beda, beda - dan uji inilah yang menemukannya.
   */
  const hitungSidik = (teks: Record<string, string>, biner: Record<string, string>) => {
    const cerna = crypto.createHash("sha256");
    const pisah = String.fromCharCode(10);
    const suap = (nama: string, isi: string) => {
      cerna.update(nama);
      cerna.update(pisah);
      cerna.update(isi);
      cerna.update(pisah);
    };
    for (const [nama, isi] of Object.entries(teks)) {
      if (nama === "manifest.json") {
        const tanpaVersi = JSON.parse(isi);
        tanpaVersi.version = "";
        suap(nama, JSON.stringify(tanpaVersi));
      } else {
        suap(nama, isi);
      }
    }
    for (const [nama, isi] of Object.entries(biner)) suap(nama, isi);
    return cerna.digest("hex");
  };

  it("EKSTENSI_SIDIK cocok dengan isi yang benar-benar tertanam", async () => {
    // Dihitung ulang dari yang tertanam, bukan dari folder: yang dijaga di
    // sini keutuhan hasil tanamnya sendiri. Kesamaan dengan folder dijaga uji
    // lain, dan keduanya memang menjawab pertanyaan yang berbeda.
    const { EKSTENSI_BERKAS, EKSTENSI_BINER, EKSTENSI_SIDIK } = await import(
      "@/server/shared/ekstensi-berkas"
    );
    expect(
      hitungSidik(EKSTENSI_BERKAS, EKSTENSI_BINER),
      "jalankan node scripts/susun-ekstensi.mjs"
    ).toBe(EKSTENSI_SIDIK);
  });
  it("sidiknya TIDAK berubah ketika hanya versinya yang berubah", async () => {
    // Sifat yang menentukan: kalau menaikkan versi ikut mengubah sidik,
    // penjaga di penyusunnya akan menuntut versi dinaikkan setiap kali versi
    // dinaikkan - selamanya, dan orang akan mematikannya.
    const { EKSTENSI_BERKAS, EKSTENSI_BINER } = await import("@/server/shared/ekstensi-berkas");

    const dengan = (versi: string) => {
      const manifest = JSON.parse(EKSTENSI_BERKAS["manifest.json"] as string);
      manifest.version = versi;
      return hitungSidik(
        { ...EKSTENSI_BERKAS, "manifest.json": JSON.stringify(manifest) },
        EKSTENSI_BINER
      );
    };

    expect(dengan("1.0.0")).toBe(dengan("99.99.99"));
  });
});

describe("tidak ada berkas ekstensi yang lolos tanpa keputusan", () => {
  it("setiap berkas di folder ekstensi ditanam atau dikecualikan", () => {
    // Berkas baru yang lupa didaftarkan tidak ikut ke dalam ZIP. Chrome
    // memasang ekstensi tanpanya, dan tidak ada satu pun pesan di mana pun -
    // yang terlihat hanya fitur yang tidak bekerja.
    if (!fs.existsSync(folderEkstensi)) return;

    const penyusunIsi = fs.readFileSync(penyusun, "utf8");
    // Awalan folder yang sengaja tidak dikirim (sumber data yang dilebur ke berkas lain).
    const bagianAwalan = /DIKECUALIKAN_AWALAN = \[([\s\S]*?)\];/.exec(penyusunIsi);
    const awalanKecuali = bagianAwalan
      ? [...bagianAwalan[1].replace(/\/\/[^\n]*/g, "").matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : [];
    // Folder yang daftarnya disapu penyusun sendiri (K10: saksi-katalog-jenis/): tiap berkas jenis ikut tertanam tanpa disebut satu per satu.
    const bagianDinamis = /BERKAS_FOLDER_DINAMIS = \[([\s\S]*?)\];/.exec(penyusunIsi);
    const awalanDinamis = bagianDinamis ? [...bagianDinamis[1].replace(/\/\/[^\n]*/g, "").matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    const adaDiFolder = sapuFolder(folderEkstensi).filter((n) => !awalanKecuali.some((aw) => n.startsWith(aw)) && !awalanDinamis.some((aw) => n.startsWith(aw)));

    for (const nama of adaDiFolder) {
      expect(
        penyusunIsi.includes(JSON.stringify(nama)),
        `${nama} ada di folder ekstensi tetapi tidak disebut di susun-ekstensi.mjs — ` +
          "tambahkan ke BERKAS/BERKAS_BINER, atau ke DIKECUALIKAN beserta sebabnya"
      ).toBe(true);
    }
  });

  it("penyusunnya menyapu folder, bukan hanya membaca daftar", () => {
    const isi = fs.readFileSync(penyusun, "utf8");
    expect(isi).toContain("function sapuFolder(");
    expect(isi).toContain("tanpaKeputusan");
    expect(isi).toContain("const DIKECUALIKAN");
  });

  it("penyusunnya menolak isi baru dengan nomor versi lama", () => {
    const isi = fs.readFileSync(penyusun, "utf8");
    expect(isi).toContain("EKSTENSI_SIDIK");
    expect(isi).toContain("Isi ekstensi berubah, tetapi versinya masih");
    // Jalan keluar yang disengaja - menanam ulang tanpa perubahan isi tetap
    // mungkin, tetapi harus diminta terang-terangan.
    expect(isi).toContain("ALETA_TANAM_PAKSA");
  });
});

describe("penyusunnya benar-benar berjalan, bukan hanya terbaca", () => {
  it("menanam ulang menghasilkan berkas yang sama persis", () => {
    // Uji yang paling menentukan dari semuanya: kalau hasil tanam di repo
    // berbeda dari yang dihasilkan penyusunnya hari ini, salah satu dari
    // keduanya tertinggal - dan yang tertinggal biasanya hasil tanamnya.
    if (!fs.existsSync(folderEkstensi)) return;

    const tujuan = path.resolve(process.cwd(), "src/server/shared/ekstensi-berkas.ts");
    const sebelum = fs.readFileSync(tujuan, "utf8");

    // ALETA_TANAM_PAKSA supaya penjaga versi tidak menghentikannya: yang
    // diuji di sini kesamaan hasilnya, bukan penjaganya.
    //
    // NODE_OPTIONS DIBUANG dari lingkungan anaknya. vitest menyetelnya untuk
    // dirinya sendiri - pemuat modul dan sejenisnya - dan node biasa yang
    // mewarisinya gagal berjalan sama sekali. Gejalanya hanya "Command
    // failed" tanpa sebab, sementara skripnya berjalan mulus bila dipanggil
    // dari baris perintah.
    const { NODE_OPTIONS, NODE_V8_COVERAGE, ...lingkungan } = process.env;
    void NODE_OPTIONS;
    void NODE_V8_COVERAGE;

    try {
      execFileSync(process.execPath, [penyusun], {
        cwd: process.cwd(),
        env: { ...lingkungan, ALETA_TANAM_PAKSA: "1" },
        stdio: "pipe",
      });
    } catch (galat) {
      // Sebabnya ditampilkan. Penyusun yang gagal tanpa keterangan menuntut
      // orang menjalankannya sendiri untuk tahu apa yang salah.
      const g = galat as { stderr?: Buffer; stdout?: Buffer };
      throw new Error(
        `susun-ekstensi.mjs gagal:
${String(g.stderr || "")}
${String(g.stdout || "")}`
      );
    }

    const sesudah = fs.readFileSync(tujuan, "utf8");
    expect(sesudah, "hasil tanam tertinggal — jalankan node scripts/susun-ekstensi.mjs").toBe(
      sebelum
    );
  });
});
