// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * DATA UMUM DARI BERKAS e-COURT YANG SUDAH ADA DI ARSIP
 * ============================================================================
 *
 * Rute /penunjukan/berkas sudah lama memetik Data Umum dari berkas gugatan -
 * tetapi berkas itu harus DICARI dan DIPILIH petugas dari cakramnya sendiri,
 * padahal berkas yang sama sudah ditarik ALETA dari e-Court sejak hari perkara
 * itu didaftarkan, dan daftarnya tergambar di panel yang sama.
 *
 * Yang dijaga di sini KEPUTUSANNYA, bukan tampilannya:
 *
 *   - pemilih berkas manual TIDAK dibuang - perkara lama banyak yang berkasnya
 *     belum pernah ditarik, dan bagi mereka jalan itu satu-satunya,
 *   - berkas arsip tidak disalin ke mana pun, sama dengan yang diunggah,
 *   - posita yang kosong di SIPP boleh dibaca dari berkas, TETAPI asalnya
 *     selalu disebutkan.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = () => readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");
const rute = () =>
  readFileSync(
    path.resolve(process.cwd(), "src/app/api/aleta-bot/penunjukan/berkas-arsip/route.ts"),
    "utf8"
  );

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.replace(/\r\n/g, "\n").split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

describe("membaca berkas gugatan dari arsip ALETA", () => {
  it("jalan yang lebih pendek digambar, jalan manualnya tetap ada", () => {
    // Perkara yang berkasnya belum pernah ditarik - dan perkara lama banyak
    // yang begitu - tetap perlu pemilih berkas manual.
    const badan = potongFungsi(konten(), "bagianDataUmum");
    expect(badan).toContain("dokumenGugatan(konteks)");
    expect(badan).toContain('pemilih.type = "file";');
    expect(badan).toContain('pemilih.accept = ".docx,.doc,.rtf,.pdf,.txt";');
  });

  it("daftar arsipnya dibatasi, dan tidak pernah kosong tanpa sebab", () => {
    // Judul dokumen e-Court tidak selalu menyebut kata gugatan; daftar kosong
    // terbaca sebagai ALETA yang tidak punya berkasnya padahal berkasnya ada.
    const badan = potongFungsi(konten(), "dokumenGugatan");
    expect(badan).toContain("POLA_BERKAS_GUGATAN.test(sebutanDokumen(d))");
    expect(badan).toContain("cocok.length > 0 ? cocok : semua");
    expect(badan).toContain(".slice(0, 6)");
  });

  it("yang dikirim hanya kuncinya - berkasnya tidak melewati peramban", () => {
    const badan = potongFungsi(konten(), "bacaBerkasArsip");
    expect(badan).toContain("JSON.stringify({ documentKey, format:");
    expect(badan).toContain("await alatAmbil(");
  });

  it("rutenya tidak menyimpan salinan berkas di mana pun", () => {
    const isi = rute();
    expect(isi).toContain("Buffer.from(await respons.arrayBuffer())");
    expect(isi).not.toContain("writeFile");
    expect(isi).not.toContain("createWriteStream");
  });

  it("rutenya hanya menerima dua bentuk yang dikenal arsipnya", () => {
    // Meneruskan apa pun yang dikirim peramban berarti meneruskannya ke kueri
    // bot.
    expect(rute()).toContain('String(badan.format ?? "pdf") === "word" ? "word" : "pdf"');
  });

  it("nama berkasnya dibaca dari Content-Disposition", () => {
    // Tanpa nama, .docx dan .pdf tidak dapat dibedakan cara membacanya.
    const isi = rute();
    expect(isi).toContain("content-disposition");
    expect(isi).toContain("decodeURIComponent(nama)");
    expect(isi).toContain("jenisDariNama(nama)");
  });

  it("batas ukuran dan kewenangannya sama dengan rute unggahan", () => {
    const isi = rute();
    expect(isi).toContain("BATAS_UKURAN_BERKAS");
    expect(isi).toContain('pastikanKapabilitas(db, actorUserId, "penunjukan")');
  });

  it("berkas yang belum ada di arsip dijawab dengan jalan keluarnya", () => {
    // "404" bukan jawaban; yang membacanya perlu tahu apa yang harus dikerjakan.
    expect(rute()).toContain("Tarik dahulu dari e-Court, atau pilih berkasnya sendiri.");
  });
});

describe("posita kosong di SIPP dibaca dari berkas gugatan", () => {
  it("cadangannya berkas arsip, bukan berkas yang harus dicari petugas", () => {
    const badan = potongFungsi(konten(), "bagianIsiAlasanPerkara");
    expect(badan).toContain("if (!posita.trim()) {");
    expect(badan).toContain("dokumenGugatan(konteksTerakhir)");
    expect(badan).toContain("await bacaBerkasArsip(");
  });

  it("asal positanya SELALU disebutkan", () => {
    // Usulan yang disusun dari berkas, lalu dibaca seolah-olah disusun dari
    // layar, membuat orang mencari kalimat yang memang tidak ada di layarnya.
    const badan = potongFungsi(konten(), "bagianIsiAlasanPerkara");
    expect(badan).toContain('let asalPosita = "posita di layar ini";');
    expect(badan).toContain("asalPosita = `berkas ${hasil.nama} di arsip ALETA`;");
    expect(badan).toContain("huruf ${asalPosita} dan petitum");
  });

  it("arsip yang tidak terbaca tidak menggagalkan menunya", () => {
    // Kalau arsipnya pun kosong, menu ini menyerah seperti dahulu - dan itu
    // jawaban yang jujur, bukan galat.
    const badan = potongFungsi(konten(), "bagianIsiAlasanPerkara");
    expect(badan).toContain("/* arsipnya tidak terbaca - menu ini menyerah seperti dahulu */");
  });

  it("asalnya ikut tercatat di sisi server", () => {
    // Ketepatan usulan yang disusun dari berkas belum tentu sama dengan yang
    // disusun dari layar, dan keduanya harus dapat diukur terpisah.
    expect(potongFungsi(konten(), "bagianIsiAlasanPerkara")).toContain("asalPosita,");
    const ruteAlasan = readFileSync(
      path.resolve(process.cwd(), "src/app/api/aleta-ecourt/alasan-perkara/route.ts"),
      "utf8"
    );
    expect(ruteAlasan).toContain("asalPosita?: string;");
    expect(ruteAlasan).toContain("asalPosita: String(badan?.asalPosita");
  });
});
