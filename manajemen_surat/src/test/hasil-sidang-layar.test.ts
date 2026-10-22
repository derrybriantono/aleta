/**
 * ============================================================================
 * LAYAR HASIL SIDANG - SEPULUH PERBAIKAN YANG DIMINTA SATKER
 * ============================================================================
 *
 * Cetak birunya `antrian/php/_fungsi.php` dan `antrian/php/menu.sidang.php` di
 * peladen - dibaca, bukan dikira-kira. Tampilannya sengaja TIDAK ditiru; yang
 * ditiru ALURNYA, sebab alur itulah yang menentukan apa yang tertulis ke SIPP.
 *
 * Yang dijaga berkas ini bukan susunan kotak di layar, melainkan keputusan
 * yang tiap-tiapnya pernah salah sekali dan salahnya tidak berbunyi apa pun:
 *
 *    1  jalan ke status perkara yang hilang tanpa pesan galat
 *    2  rincian yang terpotong di layar sempit
 *    3  alasan penundaan yang harus diketik dari nol tiap kali
 *    4  tanggal dan jam sidang berikutnya yang harus dihitung sendiri
 *    5  akun SIPP yang boleh diketik - dan karenanya boleh keliru
 *    6  tanggal putusan yang kosong pada borang yang dibuka hari putusnya
 *    7  jenis putusan yang harus dipilih padahal 89% memilih yang sama
 *    8  amar dan pertimbangan yang menahan pencatatan sampai naskahnya jadi
 *    9  tunda dan putus yang dapat terisi berdua
 *   10  bentuk tulisannya sendiri - amar "BELUM DIINPUT", sumber hukum tetap
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layar = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");
const antrian = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const layanan = baca("aleta_bot/services/sidangHasilService.js");
const halaman = baca("manajemen_surat/src/app/(portal)/sidang-tunda/[jadwalId]/page.tsx");

/** Kode saja - supaya tuntutan tidak lulus atas keterangannya sendiri. */
const kodeLayanan = layanan
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
  .join("\n");

describe("1. jalan ke status perkara dikembalikan", () => {
  it("tombolnya berdiri sendiri di bawah Rincian", () => {
    // Kotak nomor perkara kini membuka layar hasil sidang. Jalan ke status
    // perkara karena itu HILANG - dan hilangnya diam: tombolnya masih ada,
    // hanya membuka tempat yang berbeda.
    //
    // Dicari SESUDAH tombol Rincian, bukan dari awal berkas: "Buka status
    // perkara" muncul juga pada cabang lama di kotak nomor perkara, dan
    // pencarian dari awal akan menemukan yang itu lalu lulus tanpa tombol
    // barunya pernah ada.
    const iRincian = antrian.indexOf("aria-expanded={dibuka === kunci}");
    expect(iRincian).toBeGreaterThan(-1);
    const iStatus = antrian.indexOf("Buka status perkara ${baris.nomorPerkara}", iRincian);
    expect(iStatus).toBeGreaterThan(iRincian);
    expect(antrian.indexOf("Status\n                              </button>", iRincian)).toBeGreaterThan(
      iStatus
    );
  });

  it("keduanya tetap ada - yang satu tidak menggantikan yang lain", () => {
    expect(antrian).toContain("onBukaTunda({ nomorPerkara: baris.nomorPerkara, sidangId: baris.sidangId })");
    expect(antrian).toContain("onClick={() => onBukaStatus(baris.nomorPerkara)}");
  });
});

describe("2. rincian tidak lagi terpotong", () => {
  it("lebarnya mengikuti yang TERLIHAT, bukan lebar tabelnya", () => {
    // Tabelnya 980px di dalam kotak bergulir mendatar. Rincian yang melebar
    // mengikuti tabel berada separuh di luar layar pada layar sempit.
    expect(antrian).toContain("const [lebarTampak, setLebarTampak] = useState(0);");
    expect(antrian).toContain("new ResizeObserver(ukur)");
    expect(antrian).toContain(
      'className="sticky left-0 overflow-x-auto border-l-4 border-l-primary px-4 py-4"'
    );
  });

  it("isi yang lebih lebar MENGGULIR di dalam wadahnya, bukan menarik halaman", () => {
    // Diminta pengguna dua kali - "kenapa ketika di klik rincian tiba-tiba dia
    // melebar ke samping kanan" lalu "ini sangat mengganggu". Mengunci
    // lebarnya saja tidak cukup: tanpa overflow-x-auto isi yang lebih lebar
    // tetap mendorong selnya, dan seluruh tabel ikut melar.
    expect(antrian).toContain("overflow-x-auto border-l-4 border-l-primary");
  });

  it("lebar yang belum terukur jatuh ke perilaku lama, bukan ke nol", () => {
    // Peladen menggambar halaman ini sebelum ada yang dapat diukur.
    const i = antrian.indexOf("className=\"sticky left-0 overflow-x-auto border-l-4 border-l-primary");
    expect(i, "pembungkus rincian tidak ditemukan").toBeGreaterThan(-1);
    const blok = antrian.slice(i, i + 400);
    expect(blok).toContain("lebarTampak > 0");
    expect(blok).toContain(": undefined");

    // maxWidth dan minWidth: 0 IKUT DIJAGA. width saja tidak mengikat sel
    // tabel - <td> melebar mengikuti isinya walau lebar anaknya sudah
    // disebut, dan minWidth otomatis pada kotak bergulir menolak menyusut.
    // Ketiganya harus ada bersama; yang satu tanpa yang lain mengembalikan
    // tarikan ke samping tanpa satu pun tanda.
    expect(blok).toContain("width: `${lebarTampak}px`");
    expect(blok).toContain("maxWidth: `${lebarTampak}px`");
    expect(blok).toContain("minWidth: 0");
  });

  it("tidak ada pembatasan tinggi sama sekali - tidak ada gulir bersarang", () => {
    // Dahulu 70vh dilepas hanya selama rincian terbuka. Sejak 28 Sep 2026
    // batas itu dibuang seluruhnya ("ada yang terlewat di bawah footer"):
    // tabel setinggi isinya dan halamanlah yang menggulung.
    const i = antrian.indexOf("ref={kotakTabel}");
    expect(i, "wadah tabel tidak ditemukan").toBeGreaterThan(-1);
    const wadah = antrian.slice(i, antrian.indexOf(">", antrian.indexOf("className=", i)));
    expect(wadah).not.toMatch(/max-h-|overflow-auto|overflow-y-/);
  });
});

describe("3. alasan penundaan ditawarkan", () => {
  it("daftarnya ada, dan tetap boleh diketik sendiri", () => {
    expect(layar).toContain("const ALASAN_LAZIM = [");
    expect(layar).toContain('"Para pihak tidak hadir"');
    // datalist, bukan select: daftar tertutup memaksa panitera sidang memilih
    // alasan yang bukan alasannya, dan alasan keliru pada berkas perkara lebih
    // buruk daripada alasan yang diketik panjang.
    expect(layar).toContain('list="alasan-lazim"');
    expect(layar).toContain('<datalist id="alasan-lazim">');
  });
});

describe("4. tanggal dan jam sidang berikutnya terisi sendiri", () => {
  it("dua pekan sesudah sidang ini", () => {
    expect(layar).toContain("setTanggalBerikut(tambahHari(tgl, 14));");
    expect(kodeLayanan).toContain("function tanggalDuaPekan(tanggalSidang)");
    expect(kodeLayanan).toContain("d.setDate(d.getDate() + 14);");
  });

  it("jam 09:00, kecuali jawab-menjawab dan kesimpulan jam 15:00", () => {
    // Aturannya sama persis di dua tempat, dan memang harus: layar mengusulkan,
    // layanan memeriksa. Yang berbeda diam-diam akan menulis jam yang tidak
    // pernah dilihat panitera sidang.
    //
    // 2 Okt 2026 malam: aturan layar pindah ke SATU fungsi bersama,
    // jamSidangBerikut di @/lib/bawaan-tunda (dipakai Jadwal Sidang DAN Hasil
    // Sidang - dijaga perbaikan-2okt-malam-jadwal-sidang.test.ts). Layar tidak
    // boleh lagi memegang salinannya; layanan bot tetap memegang rumus lamanya.
    expect(layar).not.toContain("const AGENDA_SORE");
    expect(layar).toContain("jamSidangBerikut,");
    const lib = baca("manajemen_surat/src/lib/bawaan-tunda.ts");
    expect(lib).toContain('new Set<TahapAcara>(["jawaban", "replik", "duplik", "kesimpulan"])');
    expect(lib).toContain("? JAM_SORE : JAM_PAGI");
    expect(kodeLayanan).toContain('const AGENDA_SORE = ["jawaban", "replik", "duplik", "kesimpulan", "jawab"];');
    expect(kodeLayanan).toContain('? "15:00" : "09:00"');
  });

  it("tanggal sidang dipulangkan sebagai tulisan, bukan obyek Date", () => {
    // JSON.stringify menuliskan Date dalam UTC: sidang 2026-09-18 00:00 WITA
    // terkirim sebagai "2026-09-17T16:00:00.000Z". Layar yang mengambil sepuluh
    // huruf pertamanya - cara yang paling wajar - membaca sidangnya SEHARI
    // LEBIH AWAL, lalu menghitung usulan sidang berikutnya dari tanggal yang
    // salah itu. Tidak ada galat yang berbunyi.
    expect(kodeLayanan).toContain("satu.tanggalSidang = penetapan.tanggalIso(satu.tanggalSidang);");
  });

  it("tanggalDuaPekan memakai tanggalIso, bukan potong sepuluh huruf", () => {
    // String(Date) berbunyi "Fri Sep 18 2026 ..." - sepuluh huruf pertamanya
    // "Fri Sep 18", yang gagal cocok-pola dan memulangkan kosong pada tanggal
    // yang sebenarnya ada. Terjadi, dan ketahuan hanya karena dijalankan atas
    // jadwal sungguhan.
    expect(kodeLayanan).toContain("const iso = penetapan.tanggalIso(tanggalSidang);");
    expect(kodeLayanan).not.toContain('const iso = String(tanggalSidang || "").slice(0, 10);');
  });

  it("jam yang sudah disetel tangan tidak ditimpa usulan", () => {
    // Mengetik agenda sesudah memilih jam tidak boleh menarik kembali pilihan
    // orangnya - itu cara tercepat membuat orang berhenti memercayai borang.
    expect(layar).toContain("if (jamDisetelTangan) return;");
  });
});

describe("5. akun SIPP tidak ditanyakan pada jalur mana pun", () => {
  it("tidak ada isiannya di layar", () => {
    expect(layar).not.toMatch(/olehUsername/);
  });

  it("putusan atas nama hakim perkaranya, penundaan atas nama panitera sidangnya", () => {
    expect(kodeLayanan).toContain("FROM perkara_hakim_pn a");
    expect(kodeLayanan).toContain("FROM perkara_panitera_pn c");
  });

  it("hakim yang tidak ketemu disebutkan, bukan diam-diam diganti", () => {
    expect(layanan).toContain("Hakim perkara ini tidak ketemu di SIPP");
    expect(layar).toContain("(hasil.andaian ?? []).map");
  });
});

describe("6-7. bawaan yang menghemat ketukan tanpa menyesatkan", () => {
  it("tanggal putusan bawaannya hari ini - disetel di peramban, bukan di server", () => {
    // Peladen berjam UTC, peramban petugas berjam WITA: antara 00:00 dan 08:00
    // WITA keduanya menyebut HARI YANG BERBEDA, dan React memakai tanggal
    // peladen - yaitu kemarin.
    expect(layar).toContain("setTanggalPutus((lama) => lama || hariIni());");
    expect(layar).not.toContain("useState(hariIni())");
  });

  it("jenis putusan bawaannya Dikabulkan - dan daftarnya tetap dari data", () => {
    expect(layar).toContain('const dikabulkan = isi.daftar.find((s) => /dikabulkan/i.test(s.nama));');
    expect(layar).toContain("if (dikabulkan) setStatusId(String(dikabulkan.id));");
    // Daftarnya TIDAK disalin ke dalam kode - lihat putusan-tulis-bentuk-sipp.
    expect(layar).toContain('/api/aleta-ecourt/sidang-putus');
  });
});

describe("8. amar, pertimbangan, sumber hukum, catatan tidak ditanyakan", () => {
  it("tidak ada satu pun isiannya di layar", () => {
    // Panitera sidang mencatat FAKTA bahwa perkaranya diputus. Naskahnya
    // ditulis hakim beberapa hari kemudian lewat SIPP. Borang yang menuntut
    // amar menahan pencatatan sampai naskahnya jadi - padahal papan antrian,
    // laporan harian, dan akta cerai membutuhkan faktanya hari ini.
    for (const nama of ["amarPutusan", "pertimbanganHukum", "sumberHukumId", "catatanPutusan"]) {
      expect(layar).not.toContain(nama);
    }
  });

  it("layar menerangkan kenapa, bukan sekadar menghilangkannya", () => {
    expect(layar).toContain("BELUM DIINPUT");
    expect(layar).toContain("ditulis hakim");
  });
});

describe("9. ditunda dan diputus saling meniadakan", () => {
  it("satu pilihan, bukan dua blangko terbuka bersamaan", () => {
    expect(layar).toContain('const [jalan, setJalan] = useState<"" | "tunda" | "putus">("");');
    expect(layar).toContain('{jalan === "tunda" ? (');
  });

  it("alamat yang dituju ditentukan pilihannya, bukan dua permintaan sekaligus", () => {
    expect(layar).toContain(
      'const alamat = jalan === "tunda" ? "/api/aleta-ecourt/sidang-tunda" : "/api/aleta-ecourt/sidang-putus";'
    );
  });

  it("putus menandai sidangnya SELESAI, bukan ditunda", () => {
    // ditunda = 'T' pada putus, bukan 'Y'. Sidang itu tidak ditunda; ia selesai.
    expect(kodeLayanan).toContain('ditunda: "T",');
    expect(kodeLayanan).toContain('alasan_ditunda: `putus ${namaStatus}');
  });

  it("halamannya menyebut keduanya, dan menyebut alamatnya tidak berubah", () => {
    expect(halaman).toContain("HasilSidang");
    expect(halaman).toContain("Alamatnya tetap /sidang-tunda");
  });
});

describe("10. bentuk tulisannya sama dengan aplikasi antrian", () => {
  it("amar diisi harfiah BELUM DIINPUT", () => {
    expect(kodeLayanan).toContain('const AMAR_BELUM = "<b> B E L U M  &nbsp; D I I N P U T</b>";');
    expect(kodeLayanan).toContain("amar_putusan: AMAR_BELUM,");
  });

  it("sumber hukum tetap 8,11 - tidak ditanyakan", () => {
    expect(kodeLayanan).toContain('const SUMBER_HUKUM_TETAP = "8,11";');
    expect(kodeLayanan).toContain("sumber_hukum_id: SUMBER_HUKUM_TETAP,");
  });

  it("digugurkan mengisi tanggal_gugur, dicabut mengisi tanggal_cabut", () => {
    expect(kodeLayanan).toContain("const STATUS_DIGUGURKAN = 65;");
    expect(kodeLayanan).toContain("const STATUS_DICABUT = 67;");
    expect(kodeLayanan).toContain("tanggal_cabut: statusId === STATUS_DICABUT ? tanggalPutus : null,");
    expect(kodeLayanan).toContain("tanggal_gugur: statusId === STATUS_DIGUGURKAN ? tanggalPutus : null,");
  });

  it("jamnya ditanyakan kepada basis data, bukan kepada container", () => {
    // Node di dalam container jatuh ke UTC bila env TZ tidak diset, dan tidak
    // ada satu pun galat yang muncul. Terukur pada peladen satker: basis data
    // menjawab 13:15 WITA sementara Node menjawab 05:15 - selisih delapan jam,
    // persis jarak WITA ke UTC.
    //
    // Akibatnya seluruh baris sys_audittrail ALETA tercatat delapan jam sebelum
    // kejadiannya, berselisih dengan baris SIPP di tabel yang sama yang jamnya
    // benar. Penulis penetapan sudah memakai jam basis data sejak lama; penulis
    // hasil sidang tertinggal, dan tertinggalnya tidak berbunyi apa pun.
    expect(kodeLayanan).not.toContain("penetapan.waktuMysql()");
    // 13 Okt 2026: jam yang DITULIS = jam SIPP (WIB) - SIPP menulis jamnya
    // dengan PHP Asia/Jakarta, NOW() basis data WITA. Keduanya tetap dari basis
    // data, bukan dari container.
    expect(kodeLayanan).toContain("const saat = await penetapan.waktuSipp();");
    expect(kodeLayanan).toContain("const saatSetempat = await penetapan.waktuBasisData();");
    expect(kodeLayanan).toContain("const tanggalSekarang = (await penetapan.waktuBasisData()).slice(0, 10);");
  });

  it("sampai_jam ditulis sebagai JAM, bukan cap waktu utuh dan bukan kosong", () => {
    // Kolomnya TIME. Cap waktu utuh "2026-09-18 05:15:21" dibaca MySQL sebagai
    // bentuk 'D HH:MM:SS' - hasilnya bukan jam yang dimaksud, dan pada
    // pengaturan ketat ia ditolak sama sekali. Tulisan kosong lebih buruk lagi:
    // ia masuk sebagai 00:00:00 tanpa satu pun galat berbunyi.
    expect(kodeLayanan).toContain("function jamDariCap(cap)");
    // Jam sidang SETEMPAT (WITA), dalam bentuk jam borang SIPP (HH:mm, detik 00) -
    // audit pola 18 Okt 2026; perilakunya diuji di audit-pola-sipp-18okt.test.ts.
    expect(kodeLayanan).toContain("sampai_jam: jamSelesaiBorang(");
    expect(kodeLayanan).toContain("bersih(keadaan.sampaiJam) || jamDariCap(saatSetempat)");
    expect(kodeLayanan).not.toContain("sampai_jam: saat,");
  });

  it("memutus ulang memperbarui, tidak gagal", () => {
    expect(kodeLayanan).toContain("ON DUPLICATE KEY UPDATE");
  });

  it("tahapan terakhir perkaranya menjadi Putusan", () => {
    // Daftar SIPP membaca perkara.tahapan_terakhir_*, bukan tabel putusannya.
    expect(kodeLayanan).toContain("const TAHAPAN_PUTUSAN = 15;");
    expect(kodeLayanan).toContain("const PROSES_PUTUSAN = 210;");
  });
});

describe("kehadiran pihak - angkanya milik SIPP, bukan urutan daftar", () => {
  /**
   * Daftar yang bermula dari nol - yang wajar bagi penulis kode dan salah bagi
   * SIPP - menuliskan "semua hadir" ketika yang dipilih "tidak hadir", dan
   * salahnya tidak berbunyi apa pun: kolomnya menerima angka berapa saja.
   *
   * Dibaca dari `antrian/php/menu.sidang.php`:
   *   1 SEMUA HADIR   2 PIHAK PERTAMA SAJA   3 PIHAK KEDUA SAJA   4 TIDAK HADIR
   */
  it("keempat angkanya persis milik SIPP", () => {
    expect(layar).toContain('{ nilai: 4, label: "Pihak tidak hadir"');
    expect(layar).toContain('{ nilai: 1, label: "Semua hadir"');
    expect(layar).not.toContain("{ nilai: 0,");
  });

  it("cadangan layanan 4, bukan 1", () => {
    // Cadangan 1 menuliskan "semua hadir" pada sidang yang mungkin tidak
    // dihadiri siapa pun - pernyataan yang terbaca sebagai fakta persidangan.
    // 7 Okt 2026: kehadiran dari antrian sidang (1/2/3, tidak pernah 4 karena
    // kosong-kosong = tidak diketahui) disisipkan sebelum yang tercatat.
    expect(kodeLayanan.replace(/\s+/g, " ")).toContain(
      "dihadiri_oleh: Number(minta.dihadiriOleh) || (antrian && antrian.dihadiriOleh) || Number(keadaan.dihadiriOleh) || 4,"
    );
  });

  it("pihak pertama/kedua hanya pada perkara gugatan", () => {
    expect(layar).toContain("function perkaraGugatan(nomorPerkara: string)");
    expect(layar).toContain("hanyaGugatan");
  });

  it("angka di luar 1..4 tidak menyentuh kolomnya sama sekali", () => {
    expect(kodeLayanan).toContain("dihadiri >= 1 && dihadiri <= 4");
  });
});

describe("sidang yang sudah dicatat tidak ditawari blangko - dan yang belum, ditawari", () => {
  /**
   * `ditunda = 'T'` dipakai DUA keadaan yang berlawanan: sidang yang sudah
   * diputus, dan sidang yang belum disentuh sama sekali ('T' nilai bawaannya).
   * Menutup borang atas benderanya saja menutupnya bagi hampir setiap sidang
   * yang justru datang ke sini untuk dicatat.
   */
  it("aturannya dipakai ulang, tidak ditulis lagi", () => {
    expect(layar).toContain('import { adaHasilSidang, hasilSidangPutusan } from "@/lib/hasil-sidang";');
    expect(layar).toContain("const sudahPutus = adaHasilSidang(");
  });

  it("alasan tunda ikut dibaca layanan - tanpanya pemisahnya tidak ada", () => {
    expect(kodeLayanan).toContain('${sqlAlasanHasil("j")} AS alasanDitunda,');
  });
});
