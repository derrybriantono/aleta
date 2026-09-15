/**
 * Papan penunjukan - tujuh perbaikan dari layar sungguhan pada perkara
 * 567/Pdt.G/2026/PA.Dgl.
 *
 * Yang dijaga di sini MAKSUDNYA, bukan bentuk tulisannya: tiap penjaga
 * menyebut apa yang rusak kalau baris itu hilang.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { type Ruangan, ruanganTerurut, urutPemakaian } from "@/lib/ruangan-sidang";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const konten = baca("ekstensi-sipp/konten.js");
const kontenTanpaKomentar = tanpaKomentar(konten);
const tulisLayanan = baca("aleta_bot/services/penetapanTulisService.js");

/**
 * Komentar dibuang sebelum penjaga MENYANGKAL sesuatu.
 *
 * Komentar yang menerangkan pencabutan kotak itu menyebut namanya - sehingga
 * penjaga yang melarang keberadaannya justru tersandung pada kalimat yang
 * menerangkan pelarangannya.
 */
function tanpaKomentar(sumber: string) {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((baris) => !baris.trim().startsWith("//"))
    .join("\n");
}

describe("butir 1 - kalender tidak lagi mengunci tanggal", () => {
  it("batas bawahnya HARI INI, bukan tanggal usulan", () => {
    // Batas lama membuat seluruh tanggal sebelum usulan - termasuk hari ini -
    // tampil kelabu dan tidak dapat ditekan.
    expect(konten).toContain('kalender.min = new Date().toISOString().slice(0, 10);');
    expect(kontenTanpaKomentar).not.toContain("if (phs.usulan) kalender.min = phs.usulan;");
  });

  it("jeda minimalnya BERBUNYI, sebab ia tidak lagi dikunci", () => {
    // Melepas kunci tanpa menggantinya dengan peringatan berarti memperpendek
    // jeda panggilan menjadi semudah satu klik, tanpa satu pun tanda.
    expect(konten).toContain("dipilihBebas && phs.usulan && dipilihBebas < phs.usulan");
    expect(konten).toContain("memperpendek jeda tersebut");
  });
});

describe("butir 2 - sidang keliling dapat ditetapkan di mode otomatis", () => {
  it("saklarnya digambar ketika mode otomatis", () => {
    expect(konten).toContain("if (!manual && (phs.calon || []).length > 0) {");
    expect(konten).toContain("Sidang keliling - pilih hari dan tempatnya");
  });

  it("tempat dan hari terbuka oleh manual ATAU oleh saklar itu", () => {
    expect(konten).toContain("const bukaTempat = manual || Boolean(pilihanManual.sidkel);");
  });

  it("mematikan saklarnya MELEPAS hari dan ruangan yang telanjur dipilih", () => {
    // Saklar mati yang penetapannya tetap tertulis di luar gedung adalah
    // saklar yang berbohong tentang apa yang akan terjadi.
    const potong = konten.slice(konten.indexOf("pilihanManual.sidkel = kotakKeliling.checked;"));
    expect(potong.slice(0, 400)).toContain('pilihanManual.ruangan = "";');
    expect(potong.slice(0, 400)).toContain('pilihanManual.phs = "";');
  });
});

describe("butir 3 - usulan PMH tidak digambar di mode manual", () => {
  it("ketiganya berada di dalam cabang bukan-manual", () => {
    const mulai = konten.indexOf("  if (!manual) {");
    expect(mulai).toBeGreaterThan(0);
    const potong = konten.slice(mulai, mulai + 2200);
    expect(potong).toContain('"Hakim tunggal"');
    expect(potong).toContain('"Penetapan Majelis Hakim"');
    expect(potong).toContain("pmh.hitungan.map");
  });
});

describe("butir 4 - kotak ringkasan penetap dicabut", () => {
  it("tidak ada lagi kotak Akan tercatat di SIPP atas nama", () => {
    // Ia membaca pilihan BAWAAN mesin sementara "Pejabat yang menetapkan" di
    // bawahnya membiarkan pilihan itu diganti - ringkasan yang dapat berbeda
    // dari yang akan ditulis.
    expect(kontenTanpaKomentar).not.toContain("Akan tercatat di SIPP atas nama");
    expect(kontenTanpaKomentar).not.toContain('buatElemen("div", "aleta-tetap-atasnama")');
  });

  it("pilihan pejabatnya tetap ada - yang dicabut hanya ringkasannya", () => {
    expect(konten).toContain('"Pejabat yang menetapkan"');
  });
});

describe("butir 5 - keterangan penetap mengikuti yang dipilih", () => {
  it("penetapUntuk membaca pejabat pilihan petugas lebih dahulu", () => {
    expect(konten).toContain("const dipilih = data && data.pejabatDipilih && data.pejabatDipilih[jenis];");
    expect(konten).toContain("const akun = calonDipilih || (langkah ? langkah.akun : null);");
  });

  it("papannya digambar ulang saat pejabatnya diganti", () => {
    // Tanpa ini pilihan tersimpan diam-diam dan tidak satu pun yang terlihat
    // berubah - satu-satunya cara mengetahuinya adalah mempercayainya.
    const potong = konten.slice(konten.indexOf("data.pejabatDipilih[langkah.jenis] = pilih.value;"));
    expect(potong.slice(0, 1400)).toContain("gambarPenunjukan(isi, data);");
  });
});

describe("butir 7 - angkanya bobot, bukan jumlah perkara", () => {
  it("dibulatkan DAN namanya diluruskan menjadi beban", () => {
    // Membulatkan saja hanya menyembunyikan desimalnya; yang menyesatkan
    // bukan koma lima itu melainkan kata "perkara" di belakangnya.
    expect(konten).toContain("function sebutBeban(nilai) {");
    expect(konten).toContain("return `beban ${Math.round(angka)}`;");
  });

  it("tidak ada lagi label yang menyebut angka bobot sebagai perkara", () => {
    expect(kontenTanpaKomentar).not.toContain("— ${x.jumlah} perkara");
    expect(kontenTanpaKomentar).not.toContain("— ${x.perkara} perkara");
  });

  it("bobotnya diterangkan, bukan hanya dibulatkan", () => {
    expect(konten).toContain("function keteranganBeban() {");
    expect(konten).toContain("harta bersama/waris/wasiat/ekonomi syariah 2");
  });
});

describe("butir 8 - tempat sidang keliling menurut yang sering dipakai", () => {
  it("bot membaca pemakaian ruangan dan KUA wilayahnya", () => {
    expect(tulisLayanan).toContain("async function pemakaianRuangan()");
    expect(tulisLayanan).toContain("async function kuaUntukRuangan(");
    expect(tulisLayanan).toContain("function wilayahRuangan(");
  });

  it("nama KUA disusun dari nama ruangan, bukan dari kiriman peramban", () => {
    // ref_kua memuat 5.936 KUA se-Indonesia; yang ditanyakan hanya segelintir,
    // lewat isian bernomor.
    expect(tulisLayanan).toContain("wilayah.map((x) => `KUA ${x}`)");
    expect(tulisLayanan).toContain("const isian = wilayah.map(() => \"?\").join(\",\");");
  });

  it("panel menyebut seberapa sering dipakai, termasuk yang belum pernah", () => {
    expect(konten).toContain("sidang 2 tahun terakhir");
    expect(konten).toContain("belum pernah dipakai");
  });

  it("KUA-nya ditampilkan hanya bila berpasangan - alamat tidak ditebak", () => {
    expect(konten).toContain("if (tempatTerpilih && tempatTerpilih.kua) {");
  });

  it("saat sidkel menyala, keliling dan terpadu naik ke atas daftar", () => {
    expect(konten).toContain("const urutTempat = Boolean(pilihanManual.sidkel)");
  });

  it("yang di dalam gedung TIDAK dibuang dari daftar", () => {
    // Sidang keliling yang batal dan dipindahkan ke kantor terjadi; daftar
    // yang menyembunyikannya memaksa petugas mematikan saklar lalu kehilangan
    // tanggal yang sudah dipilih.
    const potong = konten.slice(konten.indexOf("const urutTempat = Boolean"));
    expect(potong.slice(0, 500)).toContain(".sort(");
    expect(potong.slice(0, 500)).not.toContain(".filter(");
  });
});

describe("urutan ruangan - dihitung, bukan abjad", () => {
  const buat = (nama: string, dipakai: number, bendera: boolean | null = null): Ruangan => ({
    id: nama.length,
    kode: "",
    nama,
    benderaKeliling: bendera,
    aktif: true,
    dipakai,
  });

  it("yang lebih sering dipakai lebih dahulu", () => {
    const daftar = [buat("Sidang Keliling Labuan", 0, true), buat("Sidang Keliling Sigi Biromaru", 128, true)];
    const urut = [...daftar].sort(urutPemakaian);
    expect(urut[0].nama).toContain("Sigi Biromaru");
  });

  it("yang belum pernah dipakai turun ke bawah, TIDAK dibuang", () => {
    // Ruang sidang keliling baru selalu bermula dari nol; membuangnya berarti
    // ia tidak akan pernah dapat dipakai pertama kali.
    const daftar = [buat("Sidang Keliling Labuan", 0, true), buat("Sidang Keliling Rio Pakava", 40, true)];
    const urut = ruanganTerurut(daftar, "keliling");
    expect(urut).toHaveLength(2);
    expect(urut[1].nama).toContain("Labuan");
  });

  it("sifat yang didahulukan naik ke atas seluruh yang lain", () => {
    const daftar = [
      buat("Ruang Sidang 1 Dalam Gedung", 1366),
      buat("Sidang Keliling Sigi Biromaru", 128, true),
    ];
    const urut = ruanganTerurut(daftar, "keliling");
    // Dalam gedung dipakai sepuluh kali lebih sering, tetapi yang dicari
    // petugas saat itu sidang keliling.
    expect(urut[0].nama).toContain("Sigi Biromaru");
  });

  it("tanpa yang didahulukan, dalam gedung tetap di atas", () => {
    const daftar = [
      buat("Sidang Keliling Sigi Biromaru", 128, true),
      buat("Ruang Sidang 1 Dalam Gedung", 1366),
    ];
    const urut = ruanganTerurut(daftar);
    expect(urut[0].nama).toContain("Ruang Sidang 1");
  });

  it("yang tidak aktif tidak pernah ditawarkan", () => {
    const mati = { ...buat("Sidang Keliling Sirenja", 14, true), aktif: false };
    expect(ruanganTerurut([mati])).toHaveLength(0);
  });
});
