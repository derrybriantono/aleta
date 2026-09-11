import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pita identitas, ukuran huruf, bahasa tombol, dan dua otomasi ABT baru.
 *
 * Yang dipaku di sini adalah bentuk sumbernya, bukan perilakunya di peramban:
 * ekstensi tidak punya runtime uji, dan yang paling sering rusak justru hal
 * yang tampak sepele - kaki yang berbeda dari kepala pada satu panel, atau
 * satu tombol yang kembali berbunyi "8503".
 */
const baca = (nama: string) => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/" + nama), "utf8");
const konten = () => baca("konten.js");
const abt = () => baca("abt.js");
const gaya = () => baca("panel.css");
const rute = () =>
  readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-bot/abt/usulan/route.ts"), "utf8");

describe("pita identitas: satu bentuk di kepala dan di kaki, pada setiap panel", () => {
  it("satu fungsi menggambar pita, dan keempat panel memasangnya di kepala DAN kaki", () => {
    const isi = konten();
    expect(isi).toContain("function pitaIdentitas(opsi) {");
    expect(isi).toContain("function kakiPanel(opsi) {");
    // Panel perkara.
    expect(isi).toContain("kepala.appendChild(pitaIdentitas(jatiPita(konteks)));");
    expect(isi).toContain("panel.appendChild(kakiPanel(jatiPita(konteks)));");
    // Panel ditolak dan panel ajakan masuk - nomornya dibaca dari halaman.
    expect(isi.split("kepala.appendChild(pitaIdentitas({ nomorPerkara: cariNomorPerkara() }));").length - 1).toBe(2);
    expect(isi.split("panel.appendChild(kakiPanel({ nomorPerkara: cariNomorPerkara() }));").length - 1).toBe(2);
    // Panel daftar perkara - tanpa nomor.
    expect(isi).toContain("kepala.appendChild(pitaIdentitas({}));");
    expect(isi).toContain("panel.appendChild(kakiPanel({}));");
  });

  it("pita memuat kelima keterangan: akun ALETA, akun SIPP, nomor, jenis, seri", () => {
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function pitaIdentitas(opsi) {"), isi.indexOf("function kakiPanel(opsi) {"));
    expect(potong).toContain('"aleta-id-akun aleta-id-aleta", "ALETA"');
    expect(potong).toContain('buatElemen("span", "aleta-akun-sipp", akunSipp)');
    expect(potong).toContain('tambah("aleta-id-nomor"');
    expect(potong).toContain('tambah("aleta-id-jenis"');
    expect(potong).toContain("chrome.runtime.getManifest().version");
    // Yang tidak terbaca tidak ditulis - bukan "tidak diketahui".
    expect(potong).not.toContain("tidak diketahui");
  });

  it("kaki lama - teks dan seri yang terpisah dari kepala - sudah tidak ada", () => {
    const isi = konten();
    expect(isi).not.toContain('buatElemen("span", "aleta-kaki-teks", "Keterangan dari ALETA. SIPP tidak diubah.")');
    expect(isi).not.toContain('buatElemen("span", "aleta-kaki-versi", `v${seri}`)');
  });

  it("panel ABT memakai pita yang sama, di kepala dan kaki, dan meminta nama ALETA ke portal", () => {
    const isi = abt();
    expect(isi).toContain("function pitaIdentitasAbt(pengguna) {");
    expect(isi).toContain("let pitaKepala = pitaIdentitasAbt(penggunaAletaAbt);");
    expect(isi).toContain("let pitaKaki = pitaIdentitasAbt(penggunaAletaAbt);");
    expect(isi).toContain('sumber: "siapa"');
    expect(isi).not.toContain('buatElemen("span", "aleta-kaki-teks"');
  });

  it("satu kelas CSS mengatur keduanya; kepala membungkus barisnya", () => {
    const css = gaya();
    expect(css).toContain(".aleta-identitas-panel {");
    expect(css).toContain(".aleta-kepala { flex-wrap: wrap; }");
    expect(css).toContain(".aleta-kepala .aleta-identitas-panel { order: 10; }");
  });
});

describe("huruf panel dibesarkan", () => {
  it("tidak ada lagi ukuran di bawah 11.5px, dasar panel 14px, dan panelnya 380px", () => {
    const css = gaya();
    const ukuran = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(ukuran.length).toBeGreaterThan(50);
    expect(Math.min(...ukuran)).toBeGreaterThanOrEqual(11.5);
    expect(css).toContain("font-size: 14px;");
    expect(css).toContain("width: 380px;");
  });
});

describe("bahasa hukum yang resmi, bukan singkatan SIPP", () => {
  it("panel SIPP menyebut penetapan dan penunjukan dengan namanya", () => {
    const isi = konten();
    for (const lama of [
      '"PMH",',
      '"PPP",',
      '"PJS",',
      '"PHS",',
      '"Menunggu PMH"',
      '"Tetapkan lewat ALETA"',
      '"Tulis ke SIPP sekarang"',
      "Penunjukan PMH, PPP, PJS, PHS",
    ]) {
      expect(isi, lama).not.toContain(lama);
    }
    expect(isi).toContain('"Penetapan Majelis Hakim",');
    expect(isi).toContain('"Penunjukan Panitera Pengganti",');
    expect(isi).toContain('"Penunjukan Juru Sita",');
    expect(isi).toContain('"Penetapan Hari Sidang",');
    expect(isi).toContain('"Menunggu Penetapan Majelis"');
    expect(isi).toContain('"Tetapkan dan tuliskan ke SIPP"');
    expect(isi).toContain('"Tuliskan ke SIPP"');
  });

  it("tombol ABT tidak menyebut kode variabel", () => {
    const isi = abt();
    for (const lama of [
      '"Tarik 5 dari SIPP"',
      '"Isi dari Keterangan Saksi"',
      '"Tulis 8503"',
      '"8503 — huruf alasan perceraian"',
      "Variabel 2021 dan 2022 masih kosong",
    ]) {
      expect(isi, lama).not.toContain(lama);
    }
    expect(isi).toContain('"Ambil data dari SIPP"');
    expect(isi).toContain('"Susun dari keterangan saksi"');
    expect(isi).toContain('"Isi dari posita permohonan"');
    expect(isi).toContain('"Susun keterangan dua saksi"');
    expect(isi).toContain('"Tuliskan huruf alasan"');
  });
});

describe("itsbat nikah dan keterangan dua saksi", () => {
  it("tombolnya hanya digambar bila blangkonya memuat variabel sasarannya", () => {
    const isi = abt();
    expect(isi).toContain('tombolItsbat.hidden = !(petaAwal.has("5197") || petaAwal.has("8087"));');
    expect(isi).toContain("tombolSdg.hidden = !petaAwal.has(VAR_SAKSI_1);");
  });

  it("templat diambil lewat halaman penyunting ABT (load_template), bukan dari basis datanya", () => {
    const isi = abt();
    expect(isi).toContain('badan.set("load_template", kodeTemplat);');
    expect(isi).toContain("async function daftarTemplatAbt(urutan) {");
    expect(isi).toContain("async function kirimTanyaJawab(kodeVariabel, urutan, baris) {");
    // Menyimpan menghapus lalu menulis ulang; sidang yang akan ditimpa
    // disebut SEBELUM tombolnya ditekan.
    expect(isi).toContain("Menyimpan akan MENIMPANYA");
  });

  it("kutipan dari posita diberi label Posita, bukan SIPP", () => {
    const isi = abt();
    expect(isi).toContain('s.asal === "posita" ? "Posita"');
    expect(isi).toContain("usulan dari posita permohonan");
  });

  it("rute portal meneruskan sumber itsbat dan saksi-sdg, dan menjawab siapa yang masuk", () => {
    const isi = rute();
    expect(isi).toContain('["sipp", "saksi", "itsbat", "saksi-sdg"]');
    expect(isi).toContain('if (sumberMinta === "siapa") {');
    expect(isi).toContain("pengguna,");
    // Templat adalah masukan dari peramban: dibatasi, bukan dipercaya.
    expect(isi).toContain(".slice(0, 60)");
  });
});
