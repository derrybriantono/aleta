// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PHS PADA UJI KERING - PAGAR YANG MEMAGARI DIRINYA SENDIRI
 * ============================================================================
 *
 * Hari sidang ditetapkan ketua majelis, jadi PHS menuntut PMH sudah tersimpan.
 * Pagar itu benar. Tetapi uji kering dijalankan SEBELUM satu baris pun ditulis,
 * sehingga pada perkara yang baru didaftarkan PMH memang belum ada - dan tidak
 * akan pernah ada selama uji keringnya sendiri yang menghalangi.
 *
 * Akibatnya, atas perkara yang justru paling lazim: PMH, PPP, dan PJS lulus,
 * PHS ditolak "pmh_belum_ada", panel menyimpulkan rencananya belum siap, dan
 * tombol "Tuliskan ke SIPP" tidak pernah menyala. TIDAK ADA SATU PUN penetapan
 * yang tertulis, dan sebabnya tidak menunjuk ke situ sama sekali.
 *
 * Dibuktikan atas perkara sungguhan 562/Pdt.G/2026/PA.Dgl yang PMH dan PHS-nya
 * sama-sama kosong:
 *
 *   uji kering, tanpa rantai      ok=false  pmh_belum_ada
 *   uji kering, PMH di rantai     ok=true   8 langkah, 1 andaian
 *   penulisan sungguhan           ok=false  pmh_belum_ada   <- pagarnya utuh
 */

const AKAR_BOT = path.resolve(process.cwd(), "..", "aleta_bot");
const AKAR_EKSTENSI = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const bacaBot = (...bagian: string[]) => readFileSync(path.join(AKAR_BOT, ...bagian), "utf8");

describe("bot melonggarkan PHS hanya pada uji kering", () => {
  const layanan = bacaBot("services", "penetapanTulisService.js");
  const bagian = layanan.slice(layanan.indexOf('if (jenis === "phs") {'));

  it("kelonggaran menuntut uji kering DAN pernyataan bahwa PMH mendahului", () => {
    // Dua syarat sekaligus. Salah satu saja yang hilang membuat penulisan
    // sungguhan ikut longgar, dan PHS dapat tertulis atas perkara yang
    // majelisnya benar-benar belum ada.
    expect(bagian).toContain("minta.kering === true");
    expect(bagian).toContain('.includes("pmh")');
  });

  it("penolakannya tetap ada - yang berubah hanya syaratnya", () => {
    expect(bagian).toContain('return { ok: false, alasan: "pmh_belum_ada" };');
    expect(bagian).toMatch(/if\s*\(!perkara\.pmh\s*&&\s*!pmhMenyusul\)/);
  });

  it("andaian yang dipakai dikatakan, bukan didiamkan", () => {
    // Rencana yang dinilai atas keadaan yang BELUM ada harus mengatakannya.
    // Diamnya membuat petugas menyangka PMH sudah tersimpan.
    expect(bagian).toContain("andaian.push(");
    expect(layanan).toContain("const andaian = [];");
    expect(layanan).toMatch(/langkah,\s*\n\s*andaian,/);
  });

  it("kelonggaran ini TIDAK menyentuh pagar lain", () => {
    // phs_sudah_ada, tanggal sidang, dan ruangan tetap diperiksa seperti
    // semula - yang dilonggarkan hanya urutan terhadap PMH.
    expect(bagian).toContain('alasan: "phs_sudah_ada"');
    expect(bagian).toContain('alasan: "tanggal_sidang_tidak_sah"');
    expect(bagian).toContain('alasan: "ruangan_tidak_ketemu"');
  });
});

describe("rantainya diteruskan utuh dari peramban sampai bot", () => {
  it("ekstensi menyusun rantai dari langkah yang SUDAH lulus, bukan dari daftar tetap", () => {
    const konten = readFileSync(path.join(AKAR_EKSTENSI, "konten.js"), "utf8");
    const bagian = konten.slice(
      konten.indexOf("async function tetapkanLewatAleta("),
      konten.indexOf("function gambarHasilTulis(")
    );
    expect(bagian).toContain("const rantaiSebelum = [];");
    expect(bagian).toContain("rantaiSebelum: rantaiSebelum.slice()");
    // Didorong SESUDAH berhasil dan sesudah penjagaan berhenti-pada-gagal.
    // Kalau ia didorong lebih dulu, langkah yang gagal tetap dilaporkan
    // mendahului - dan PHS dinilai dengan andaian yang tidak terjadi.
    const posDorong = bagian.indexOf("rantaiSebelum.push(jenis);");
    const posBerhenti = bagian.indexOf("if (!berhasil) break;");
    expect(posDorong).toBeGreaterThan(-1);
    expect(posBerhenti).toBeGreaterThan(-1);
    expect(posBerhenti).toBeLessThan(posDorong);
  });

  it("rute portal menyaringnya ke daftar tertutup - ia datang dari peramban", () => {
    const rute = readFileSync(
      path.resolve(process.cwd(), "src/app/api/aleta-bot/penunjukan/tulis/route.ts"),
      "utf8"
    );
    expect(rute).toContain("badan.rantaiSebelum");
    expect(rute).toContain("Object.prototype.hasOwnProperty.call(JENIS_BAKU, x)");
    expect(rute).toContain("rantaiSebelum,");
  });

  it("rute bot meneruskan kering DAN rantai ke penyusun rencana", () => {
    const rute = bacaBot("routes", "internalGatewayRoutes.js");
    const bagian = rute.slice(
      rute.indexOf('router.post("/penetapan/tulis"'),
      rute.indexOf('router.get("/agenda/pengaturan"')
    );
    expect(bagian).toContain("kering,");
    expect(bagian).toContain("rantaiSebelum: Array.isArray(badan.rantaiSebelum)");
    // Dulu kering dihitung SESUDAH rencana disusun, jadi penyusunnya tidak
    // pernah tahu ini uji kering atau bukan.
    const posKering = bagian.indexOf("const kering = badan.kering !== false;");
    const posSusun = bagian.indexOf("susunRencanaTulis({");
    expect(posKering).toBeLessThan(posSusun);
  });

  it("panel memperlihatkan andaiannya kepada petugas", () => {
    const konten = readFileSync(path.join(AKAR_EKSTENSI, "konten.js"), "utf8");
    expect(konten).toContain("satu.andaian || []");
    expect(konten).toContain("`Andaian: ${satuAndaian}`");
  });
});
