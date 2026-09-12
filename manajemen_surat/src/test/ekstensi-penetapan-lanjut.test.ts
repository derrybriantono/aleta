// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Penetapan massal yang berhenti di perkara pertama.
 *
 * Satu laporan, tiga sebab yang bertumpuk - dan dua di antaranya saling
 * menyembunyikan:
 *
 *   1. SUMBER YANG BERBEDA. Panel membaca perkara_dokumen_penetapan (berkas
 *      PDF), rantai penetapan membaca perkara_penetapan (tanggalnya). Perkara
 *      564/Pdt.G/2026 punya PMH bertanggal 10 September tetapi NOL dokumen -
 *      panel menawarkannya, rantai menolaknya.
 *
 *   2. RANTAI YANG PUTUS. "pmh_sudah_ada" memutus rantai, sehingga PPP, PJS,
 *      dan PHS tidak pernah dikerjakan - dan pada penetapan massal, satu
 *      perkara semacam itu menghentikan seluruh halaman.
 *
 *   3. ALASAN YANG HILANG. Rute portal meneruskan pembungkus gerbang, bukan
 *      jawaban bot. Setiap penolakan karena itu tampil sebagai satu kata
 *      "ditolak", dan dua sebab di atas tidak dapat ditelusuri sama sekali.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");
const ruteTulis = readFileSync(
  path.join(akar, "manajemen_surat/src/app/api/aleta-bot/penunjukan/tulis/route.ts"),
  "utf8"
);
const sippKonteks = readFileSync(path.join(akar, "aleta_bot/services/sippKonteksService.js"), "utf8");
const tulisService = readFileSync(
  path.join(akar, "aleta_bot/services/penetapanTulisService.js"),
  "utf8"
);

function potongFungsi(isi: string, nama: string): string {
  const mulai = isi.indexOf(`function ${nama}(`);
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  const selesai = isi.indexOf("\nfunction ", mulai + 10);
  return isi.slice(mulai, selesai < 0 ? undefined : selesai);
}

describe("satu sumber untuk satu pertanyaan", () => {
  it("keadaan penetapan dibaca dari perkara_penetapan, bukan dari dokumennya", () => {
    // Dua pihak yang membaca tabel berbeda untuk pertanyaan yang sama pasti
    // berselisih suatu saat - dan mereka berselisih tepat di perkara yang
    // penetapannya ada tetapi PDF-nya belum pernah dicetak.
    expect(sippKonteks).toContain("FROM perkara_penetapan");
    expect(sippKonteks).toContain("penetapan_majelis_hakim AS pmh");
    expect(sippKonteks).toContain("penetapan_panitera_pengganti AS ppp");
    expect(sippKonteks).toContain("penetapan_jurusita AS pjs");
    expect(sippKonteks).toContain("penetapan_hari_sidang AS phs");
  });

  it("tabel dokumen TIDAK lagi dipakai menilai keadaan penetapan", () => {
    const blok = sippKonteks.slice(sippKonteks.indexOf("PENETAPAN YANG SUDAH ADA"));
    expect(blok.slice(0, 2000)).not.toContain("FROM perkara_dokumen_penetapan");
  });

  it("sumbernya sama persis dengan yang dipakai bot memutuskan _sudah_ada", () => {
    // penetapanTulisService membaca keempat kolom itu dari perkara_penetapan
    // lewat keadaanPerkara, lalu memutuskan pmh_sudah_ada dan kawan-kawannya.
    expect(tulisService).toContain("pen.penetapan_majelis_hakim AS pmh");
    expect(tulisService).toContain('alasan: "pmh_sudah_ada"');
  });
});

describe("rantai tidak berhenti pada langkah yang sudah ada", () => {
  const badan = potongFungsi(konten, "rantaiPenetapan");

  it("yang sudah ada dilewati, dan rantainya berjalan terus", () => {
    // Tanpa ini, perkara yang PMH-nya sudah ditetapkan tetapi PPP, PJS, dan
    // PHS-nya belum tidak pernah dapat dilanjutkan.
    expect(badan).toContain("if (/_sudah_ada$/.test(kode)) {");
    expect(badan).toContain("continue;");
  });

  it("yang sudah ada tetap masuk rantaiSebelum - ia memang sungguh ada", () => {
    // Langkah berikutnya menuntutnya. Melompatinya tanpa mencatat membuat PPP
    // ditolak "pmh_belum_ada" pada perkara yang PMH-nya jelas-jelas ada.
    const potong = badan.slice(badan.indexOf("if (/_sudah_ada$/.test(kode))"));
    expect(potong.slice(0, 200)).toContain("rantaiSebelum.push(jenis);");
  });

  it("yang benar-benar gagal TETAP memutus rantai", () => {
    // Menulis PHS di atas PMH yang gagal menghasilkan penetapan cacat.
    expect(badan).toContain("break;");
    expect(badan).not.toContain("if (!berhasil) break;");
  });
});

describe("alasan penolakan sampai ke petugas", () => {
  it("rute portal meneruskan jawaban bot, bukan pembungkus gerbangnya", () => {
    expect(ruteTulis).toContain('alasan: respons.error ?? "ditolak"');
    expect(ruteTulis).toContain("const badanBot = (respons?.data ?? {})");
    // Pembungkusnya tidak boleh diteruskan mentah-mentah lagi.
    expect(ruteTulis).not.toContain("return Response.json(respons, {");
  });

  it("bot menyebutkan akun yang ditolaknya", () => {
    // "akun pejabat tidak ketemu" tanpa menyebut akun mana tidak memberi satu
    // pun petunjuk - padahal yang dicari datang dari pemetaan jabatan ALETA.
    expect(tulisService).toContain('username: String(minta.olehUsername || "")');
  });

  it("kodenya diterjemahkan menjadi kalimat yang menyebut jalan keluarnya", () => {
    expect(konten).toContain("function kalimatAlasan(kode, akun)");
    expect(konten).toContain("Perbaiki pemetaan jabatan di ALETA");
    expect(konten).toContain("harus NAMA AKUN SIPP");
  });

  it("kodenya TETAP dibawa apa adanya - penjaga _sudah_ada mencocokkannya", () => {
    const badan = potongFungsi(konten, "rantaiPenetapan");
    expect(badan).toContain("alasan: kode,");
    expect(badan).toContain("bunyi:");
  });

  it("kode yang belum punya terjemahan dibiarkan apa adanya", () => {
    // Kode asing masih dapat dicari; kalimat karangan tidak.
    const badan = potongFungsi(konten, "kalimatAlasan");
    expect(badan).toContain("return teks;");
  });

  it("yang DIBACA orang bunyinya, bukan kodenya", () => {
    expect(konten).toContain("satu.bunyi || satu.alasan");
    expect(konten).toContain("const bunyiGagal = gagal[0].bunyi || gagal[0].alasan;");
  });
});
