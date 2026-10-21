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

  it("pita memuat kedua akun saja: ALETA dan SIPP - nomor, jenis, seri di tempat lain", () => {
    // Dulu lima. Seri pindah ke baris kaki (1.118.0); nomor dan jenis
    // turun ke baris pertama badan (1.119.0), tempat chip identitasnya memang
    // sudah berdiri - di pita keduanya mengulang baris itu satu jengkal di
    // atasnya.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function pitaIdentitas(opsi) {"), isi.indexOf("function kakiPanel(opsi) {"));
    expect(potong).toContain('"aleta-id-akun aleta-id-aleta", "ALETA"');
    expect(potong).toContain('buatElemen("span", "aleta-akun-sipp", akunSipp)');
    expect(potong).not.toContain('"aleta-id-nomor"');
    expect(potong).not.toContain("aleta-id-jenis");
    expect(potong).not.toContain("chrome.runtime.getManifest().version");
    // Yang tidak terbaca tidak ditulis - bukan "tidak diketahui".
    expect(potong).not.toContain("tidak diketahui");
  });

  it("seri ekstensi ada TEPAT SATU tempat di panel SIPP: baris kaki", () => {
    // Kaki lama - teks dan seri yang terpisah dari kepala - pernah dibuang
    // karena mengulang kepala. Seri kini kembali ke kaki dengan sengaja,
    // tetapi sebagai SATU-SATUNYA tempatnya: pita tidak lagi memuatnya.
    // Yang dijaga bukan letaknya, melainkan bahwa ia tidak pernah dua kali.
    const isi = konten();
    expect(isi).not.toContain('buatElemen("span", "aleta-kaki-teks", "Keterangan dari ALETA. SIPP tidak diubah.")');
    const kaki = isi.slice(isi.indexOf("function kakiPanel(opsi) {"));
    const kakiSaja = kaki.slice(0, kaki.indexOf("\nfunction ", 10));
    expect(kakiSaja).toContain('buatElemen("span", "aleta-kaki-versi", `v${seri}`)');
    expect(isi.split("chrome.runtime.getManifest().version").length - 1).toBeGreaterThanOrEqual(1);
    // Kaki tidak lagi mengulang pita kepala.
    expect(kakiSaja).not.toContain("kaki.appendChild(pitaIdentitas(opsi))");
  });

  it("panel ABT memakai pita yang sama di kepala - kaki tidak mengulangnya - dan meminta nama ALETA ke portal", () => {
    // Sejak 1.118.0 pita hanya di kepala pada ketiga panel; kaki memuat
    // baris ringkas (segarkan, seri). Penggantian pita saat pengguna termuat
    // karena itu hanya menyentuh yang di kepala.
    const isi = abt();
    expect(isi).toContain("function pitaIdentitasAbt(pengguna) {");
    expect(isi).toContain("let pitaKepala = pitaIdentitasAbt(penggunaAletaAbt);");
    expect(isi).not.toContain("let pitaKaki = pitaIdentitasAbt(penggunaAletaAbt);");
    expect(isi).not.toContain("pitaKaki.replaceWith(");
    expect(isi).toContain('buatElemen("div", "aleta-kaki-baris")');
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
    // Sejak ukuran huruf panel dapat diskalakan petugas, tiap font-size
    // ditulis calc(Npx * var(--aleta-skala-huruf, 1)). Yang dijaga di sini
    // tetap N - ukuran DASAR sebelum dikali - sebab pengalinya bawaannya 1,
    // dan N itulah yang dilihat orang yang tidak pernah menyentuh setelannya.
    const css = gaya();
    const ukuran = [...css.matchAll(/font-size:\s*calc\((\d+(?:\.\d+)?)px \* var\(/g)].map((m) =>
      Number(m[1])
    );
    expect(ukuran.length).toBeGreaterThan(50);
    expect(Math.min(...ukuran)).toBeGreaterThanOrEqual(11.5);
    expect(css).toContain("font-size: calc(14px * var(--aleta-skala-huruf, 1));");
    // 460px sejak panel memuat kotak sunting naskah - pada 380px tiap baris
    // pertimbangan patah tiga kali, dan naskah yang patah tiga kali tidak
    // dapat dibaca untuk diperiksa.
    expect(css).toContain("width: 460px;");
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
      '"Ambil data dari SIPP"',
      '"Susun dari keterangan saksi"',
      '"Susun keterangan dua saksi"',
      '"Riwayat perubahan"',
    ]) {
      expect(isi, lama).not.toContain(lama);
    }
    // Tulisan tombol menyebut PEKERJAANNYA beserta objeknya. Yang diganti
    // pada 1.141.0: "Susun dari keterangan saksi" tidak pernah menyebut apa
    // yang disusun, dan "Riwayat perubahan" adalah kata benda - ia tidak
    // mengaku sebagai tombol.
    expect(isi).toContain('"Isi blangko dari SIPP"');
    // Diganti lagi pada 1.154.0 atas permintaan pengguna: "Input ke ABT".
    // Tombol ini memang tidak lagi menyebut objeknya - dan itu keputusan
    // orang yang memakainya setiap hari, yang di layarnya berdiri di antara
    // tombol-tombol lain yang semuanya menyusun, sehingga yang perlu
    // dibedakan justru KE MANA hasilnya pergi.
    expect(isi).toContain('"Input ke ABT"');
    expect(isi).toContain('"Isi dari posita permohonan"');
    expect(isi).toContain('"Susun keterangan saksi 1 & 2"');
    expect(isi).toContain('"Lihat riwayat perubahan"');
    expect(isi).toContain('"Rapikan posita & keterangan saksi"');
    // Pintasan kaki mencocokkan TULISAN tombolnya - kalau tulisannya berubah
    // tanpa pencocoknya ikut, Alt+Enter diam tanpa sebab yang terlihat.
    expect(isi).toContain("/susun keterangan saksi 1 & 2/i");
  });
});

describe("itsbat nikah dan keterangan dua saksi", () => {
  it("tombolnya hanya digambar bila blangkonya memuat variabel sasarannya", () => {
    const isi = abt();
    expect(isi).toContain('tombolItsbat.hidden = !(petaAwal.has("5197") || petaAwal.has("8087"));');
    // 1.184.0 (butir 23): juga blangko BAS (5058 TanyaJwb Saksi) - perilakunya diuji
    // di pemetaan-blangko-2okt ("Susun keterangan saksi tersedia di halaman perkara").
    expect(isi).toContain("tombolSdg.hidden = !a3BlangkoMemuatSaksi(petaAwal);");
  });

  it("templat diambil lewat halaman penyunting ABT (load_template), bukan dari basis datanya", () => {
    const isi = abt();
    expect(isi).toContain('badan.set("load_template", kodeTemplat);');
    expect(isi).toContain("async function daftarTemplatAbt(urutan) {");
    // 21 Okt 2026 (penutup saksi): kirimTanyaJawab menyaring baris penutup lebih dulu - tetap menulis lewat
    // halaman tanya-jawab ABT (alamatTanyaJawab), bukan ke basis datanya.
    expect(isi).toContain("async function kirimTanyaJawab(kodeVariabel, urutan, barisMasuk) {");
    expect(isi).toContain("const saring = saringBarisPenutup(barisMasuk);");
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
    // "posita-lain" (perkara lain dari posita permohonan) ditambah 26 Sep 2026.
    // "alasan-posita" ditambah 6 Okt 2026 (butir 12: centang sesuai posita).
    expect(isi).toContain('["sipp", "saksi", "itsbat", "saksi-sdg", "posita-lain", "alasan-posita", "pertanyaan-saksi", "isi-jawaban"]');
    expect(isi).toContain('if (sumberMinta === "siapa") {');
    expect(isi).toContain("pengguna,");
    // Templat adalah masukan dari peramban: dibatasi, bukan dipercaya.
    expect(isi).toContain(".slice(0, 60)");
  });
});
