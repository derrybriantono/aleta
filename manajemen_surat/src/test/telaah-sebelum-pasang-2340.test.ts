// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * LIMA CACAT YANG DITEMUKAN TELAAH SEBELUM 2.34.0 DIPASANG
 * ============================================================================
 *
 * Seluruhnya lolos rangkaian uji yang sudah hijau, dan tiga di antaranya gagal
 * TANPA BERBUNYI - yang membuatnya berbahaya bukan besarnya, melainkan
 * diamnya. Penjaga ini ada supaya kelimanya tidak kembali.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const penetapan = baca("aleta_bot/services/dokumenPenetapanService.js");
const unggah = baca("aleta_bot/services/putusanUnggahService.js");
const integritas = baca("aleta_bot/services/berkasIntegritasService.js");
const audit = baca("aleta_bot/services/ecourtAuditArsipService.js");
const kelengkapan = baca("aleta_bot/services/kelengkapanDataService.js");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const rutePublik = baca("manajemen_surat/src/app/api/antrian-tampil/route.ts");

describe("izin tulis diperiksa pada FOLDER TUJUAN, bukan pada akar SIPP", () => {
  /**
   * Akar SIPP memang tetap hanya-baca, dan memang seharusnya begitu - yang
   * dibuka untuk ditulis hanya dua folder putusan di bawahnya. Memeriksa W_OK
   * pada akarnya karena itu SELALU gagal, dan unggah putusan akan berhenti
   * pada "hanya baca" selamanya.
   *
   * Dibuktikan di container peladen:
   *   [ -w /usr/src/app/SIPP ]                    -> HANYA BACA
   *   [ -w /usr/src/app/SIPP/resources/file/doc ] -> inilah yang menentukan
   */
  it("periksaAkarSipp menerima folder tujuannya", () => {
    expect(penetapan).toContain('function periksaAkarSipp(runtimeConfig = readRuntimeConfig(), { relatif = "" } = {})');
  });

  it("yang diuji leluhur terdekat yang SUDAH ada, bukan jalur penuhnya", () => {
    // Folder tahun dan bulan memang belum ada sebelum berkas pertama ditulis,
    // dan ketiadaannya bukan keadaan yang salah - ia dibuat mkdirSync.
    expect(penetapan).toContain("while (leluhur && leluhur !== path.dirname(leluhur) && !fs.existsSync(leluhur))");
    expect(penetapan).toContain("fs.accessSync(leluhur, fs.constants.W_OK)");
    expect(penetapan, "akar tidak boleh diuji langsung").not.toContain("fs.accessSync(akar, fs.constants.W_OK)");
  });

  it("unggah putusan menyebut folder tujuannya, dan berbeda per jenis", () => {
    expect(unggah).toContain('relatif: `resources/file/${FOLDER[jenis] || "doc"}`');
  });

  it("pemilik berkas ditiru dari FOLDER yang memuatnya", () => {
    // Akar dan resources/file dapat berbeda pemilik pada pemasangan yang
    // folder putusannya dipasang terpisah - dan justru begitulah peladen ini.
    expect(penetapan).toContain("fs.statSync(path.dirname(jalurPenuh))");
    expect(penetapan, "izin tidak dikunci ke satu angka tetap").not.toContain("fs.chmodSync(jalurPenuh, 0o640)");
  });
});

describe("potongan awalan bukan berkas utuh", () => {
  /**
   * Pemeriksa arsip membaca 1 KB pertama saja untuk berkas yang sangat besar.
   * Ambang ukuran (5.120 byte) dan ekor %%EOF keduanya menuntut berkas UTUH,
   * jadi menerapkannya pada potongan menandai SELURUH berkas besar sebagai
   * rusak - dan penjadwal arsip memakai tanda itu.
   */
  it("periksaIsi mengenal masukan yang hanya potongan", () => {
    expect(integritas).toContain('function periksaIsi(isi, { format = "pdf", potongan = false } = {})');
  });

  it("ambang ukuran dan ekor PDF dilewati untuk potongan", () => {
    expect(integritas).toContain("if (!potongan && isi.length < batasUkuran)");
    expect(integritas).toContain('if (!potongan && String(format) !== "word"');
  });

  it("pemeriksa arsip menyebutnya potongan", () => {
    expect(audit).toContain("periksaIsi(awalan, { format, potongan: true })");
  });
});

describe("sebutan pihak pada pesan WhatsApp memakai nomor, bukan kata", () => {
  /**
   * 81 perkara satker bernama "Istbat Nikah" beralur GUGATAN. Tanpa
   * alur_perkara_id, pencocokan kata menyapa mereka "Pemohon" padahal
   * Penggugat - lewat pesan ke nomor WhatsApp orangnya.
   */
  it("kueri perkara membawa alur dan jenis perkara", () => {
    expect(kelengkapan).toContain("p.alur_perkara_id               AS alurPerkaraId");
    expect(kelengkapan).toContain("p.jenis_perkara_id              AS jenisPerkaraId");
  });

  it("keduanya sampai ke penurun sebutan, pada KEDUA pemanggilnya", () => {
    const pakai = kelengkapan.match(/alurPerkaraId: (?:perkara|satu)\.alurPerkaraId/g) ?? [];
    expect(pakai.length).toBe(2);
  });
});

describe("penanda tenggang mepet tampil pada sidang yang panggilannya lengkap", () => {
  /**
   * aman = tidak ada yang belum dipanggil DAN tidak ada retur. Tenggang mepet
   * justru paling sering terjadi pada sidang yang panggilannya LENGKAP -
   * seluruh pihak dipanggil, hanya terlambat. Keluar lebih awal karena "aman"
   * menyembunyikan penandanya persis pada perkara yang menjadi sebab fitur itu
   * ada.
   */
  it("aman saja tidak lagi cukup untuk diam", () => {
    expect(layar).toContain("if (panggilan.aman && !panggilan.tenggangMepet) return null;");
    expect(layar, "keluar hanya karena aman").not.toContain("if (!panggilan || panggilan.aman) return null;");
  });
});

describe("layar antrian tanpa login hanya menampilkan hari ini", () => {
  /**
   * Tabel antrian milik aplikasi ruang tunggu berkunci perkara_id, bukan
   * tanggal, dan TERBUKTI memuat baris hari lain - perkara 216/Pdt.P/2026
   * bertanggal 7 September ikut tergambar pada jadwal 8 September sampai
   * penjaga antrianUntuk() dipasang.
   *
   * Di rute tanpa login akibatnya nomor perkara dan nama para pihak dari hari
   * lain terbaca siapa pun.
   */
  it("baris disaring menurut tanggal hari ini", () => {
    expect(rutePublik).toContain(
      '.filter(([, baris]) => String(baris.tanggalSidang || "").slice(0, 10) === hariIni)'
    );
  });

  it("gagal-tertutup: tanggal yang tidak terbaca DIBUANG", () => {
    // Perbandingan kesamaan dengan hari ini sudah menolak yang kosong -
    // yang dijaga di sini: tidak ada cabang yang meloloskannya.
    const i = rutePublik.indexOf("const semua = Object.entries");
    const blok = rutePublik.slice(i, i + 400);
    expect(blok).not.toMatch(/!baris\.tanggalSidang\s*\|\|/);
  });
});

const panggilan = baca("aleta_bot/services/ecourtPanggilanService.js");
const jadwal = baca("aleta_bot/services/sippJadwalSidangService.js");
const antrian = baca("aleta_bot/services/antrianSidangService.js");
const panelPublik = baca("manajemen_surat/src/components/portal/aleta-antrian-publik-pengaturan.tsx");
const halamanPublik = baca("manajemen_surat/src/app/antrian-tampil/page.tsx");
const skema = baca("manajemen_surat/src/server/db/schema.ts");

describe("dua kosakata jalur panggilan tidak boleh bertemu tanpa terjemahan", () => {
  /**
   * bacaRelaas memulangkan "pos"; ambangJalur hanya mengenal "surat_tercatat"
   * dan memulangkan JALUR.biasa untuk apa pun yang tidak dikenalinya - TANPA
   * BERBUNYI. Akibatnya surat tercatat dinilai dengan Pasal 122 HIR (3 hari
   * KERJA) alih-alih SK KMA 363 (6 hari kalender dan wajib terbukti
   * diterima). Sandi S dipakai pada 3.104 dari 14.495 relaas (21%).
   */
  it("terjemahannya berdiri sendiri dan diekspor", () => {
    expect(panggilan).toContain("function jalurAturan(jalurRelaas)");
    expect(panggilan).toContain("pos: \"surat_tercatat\"");
    expect(panggilan).toContain("  jalurAturan,");
  });

  it("penghitung tenggang memakainya, bukan jalur mentah", () => {
    expect(jadwal).toContain("jalur: ecourtPanggilanService.jalurAturan(dibaca.jalur)");
    expect(jadwal, "jalur mentah tidak boleh dipakai langsung").not.toContain(
      'jalur: dibaca.jalur || "biasa"'
    );
  });
});

describe("relaas tanpa kedudukan dikreditkan, seperti penghitung di sebelahnya", () => {
  /**
   * keadaanPanggilanSidang sengaja mengkreditkannya ke sisi yang belum
   * tertutup. Penghitung tenggang dulu tidak, sehingga dua ruas pada baris
   * yang SAMA saling membantah: belumDipanggil = 0 dan aman = true, sementara
   * tenggangMepet = true beralasan "belum dipanggil". Terukur: 435 dari
   * 14.496 relaas tanpa kedudukan, dan 60 sidang yang seluruh relaasnya
   * begitu.
   */
  it("kredit tanpa-kedudukan ikut diperhitungkan", () => {
    expect(jadwal).toContain("const tanpaKedudukan = terakhirPerSisi.has(0) ? 1 : 0;");
    expect(jadwal).toContain("if (kreditTersisa > 0)");
  });
});

describe("menit menunggu tidak dihitung dari baris hari lain", () => {
  /**
   * Tabel antrian menyimpan satu baris untuk tiap tanggal sidang dan tidak
   * pernah dibersihkan. Baris kemarin yang tidak pernah ditandai dipanggil
   * akan terus dihitung - "menunggu 1.500 menit" - dan penandanya menyala
   * untuk perkara yang tidak ada orangnya di ruang tunggu.
   */
  it("baris hari lain memulangkan null", () => {
    const i = antrian.indexOf("function menitMenungguBaris(");
    const blok = antrian.slice(i, antrian.indexOf("\n}", i));
    expect(blok).toContain("if (hari && hari !== isoTanggal(new Date())) return null;");
  });
});

describe("panel admin tidak menimpa pengaturan yang belum terbaca", () => {
  /**
   * Keadaan awal komponen adalah BAWAAN - seluruh ruas menyala. Bila
   * pembacaan gagal, admin melihat semua kotak tercentang, dan satu tekanan
   * Simpan yang ia kira tidak mengubah apa-apa akan MENYALAKAN kembali ruas
   * peka yang sudah ia matikan.
   */
  it("Simpan dikunci sampai pembacaannya berhasil", () => {
    expect(panelPublik).toContain("const [terbaca, setTerbaca] = useState(false);");
    expect(panelPublik).toContain("setTerbaca(true);");
    expect(panelPublik).toContain("disabled={!bolehUbah || memuat || menyimpan || !terbaca}");
  });

  it("dan sebabnya dikatakan, bukan hanya tombol yang mati", () => {
    expect(panelPublik).toContain("Pengaturannya belum terbaca");
  });
});

describe("mesin antrian mati bukan 'belum ada yang mengambil nomor'", () => {
  /**
   * Bot menelan kegagalan sambungan dan tetap menjawab available:true dengan
   * daftar kosong, hanya terbaca:false. Kalimat "belum ada yang mengambil
   * nomor" menenangkan, dan salah: orangnya sudah mengambil nomor, hanya
   * mesinnya yang tidak terbaca - dan mereka akan menunggu giliran yang tidak
   * pernah tergambar.
   */
  it("terbaca:false dibedakan dari daftar yang memang kosong", () => {
    expect(halamanPublik).toContain("} else if (hasil.terbaca === false) {");
    expect(halamanPublik).toContain("tanyakan giliran Anda kepada petugas");
  });
});

describe("migrasi dan skema pemasangan tidak boleh berbeda", () => {
  /**
   * Pemasangan baru dibangun dari schema.ts, pemasangan lama dari migrasi.
   * Yang berbeda di antara keduanya menghasilkan dua pemasangan bernomor
   * versi sama yang berlainan perilakunya - dan di sini bawaannya berlawanan
   * dengan yang diminta.
   */
  it("baris tunggal dan kunci asingnya ada di KEDUANYA", () => {
    const migrasi = baca("manajemen_surat/drizzle/0049_antrian_publik.sql");
    for (const potongan of [
      "INSERT INTO aleta_antrian_publik",
      "fk_aleta_antrian_publik_oleh",
      "ON CONFLICT (id) DO NOTHING",
    ]) {
      expect(migrasi, `migrasi: ${potongan}`).toContain(potongan);
      expect(skema, `schema.ts: ${potongan}`).toContain(potongan);
    }
  });
});
