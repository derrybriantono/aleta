// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { kelasTulisanPutusan, warnaStatusPutusan } from "@/lib/warna-putusan";

/**
 * Susunan bagian pada layar Status Perkara.
 *
 * ============================================================================
 * URUTANNYA ADALAH KETERANGAN, BUKAN KEBETULAN
 * ============================================================================
 *
 * Layar ini dibaca dari atas ke bawah oleh orang yang belum tahu apa-apa
 * tentang perkaranya. Urutannya karena itu harus mengikuti jalan perkara:
 *
 *   SIAPA        para pihak dan majelisnya - pertanyaan pertama, dan seluruh
 *                bagian di bawah menyebut nama-nama ini
 *   JALANNYA     tahapan, sidang, mediasi, saksi - berurut menurut waktu
 *   HASIL        putusan beserta ikrar dan upaya hukumnya
 *   SESUDAHNYA   e-Court, arsip, delegasi, berkas, biaya
 *   KESIMPULAN   penilaian - datang SESUDAH buktinya, bukan menyela
 *   ALAT         analisa dan penyusun perintah
 *
 * Sebelumnya urutannya terputus di tiga tempat, dan ketiganya diperbaiki:
 *
 *   1. "Keterangan putusan" berdiri di urutan 5 sementara "Putusan dan tindak
 *      lanjutnya" di urutan 15 - sepuluh bagian di antaranya, untuk satu
 *      subjek yang sama;
 *   2. "Majelis dan petugas" serta "Para pihak" di urutan 12-13, padahal
 *      seluruh bagian sebelumnya sudah menyebut nama tanpa memperkenalkannya;
 *   3. dua bagian penilaian menyela di tengah, memisahkan riwayat perkara
 *      dari hasilnya.
 *
 * Uji ini menjaga ketiganya tidak kembali diam-diam. Susunan tidak
 * menghasilkan galat apa pun ketika tergeser - hanya layar yang lebih sulit
 * dibaca, dan tidak ada yang menyadarinya sampai ada yang mengeluh.
 */

const berkas = path.resolve(
  process.cwd(),
  "src/components/portal/aleta-ecourt-status-perkara.tsx"
);

/** Kunci tiap bagian, urut sesuai kemunculannya di berkas. */
function urutanBagian(): string[] {
  const isi = readFileSync(berkas, "utf8");
  const kunci: string[] = [];
  for (const baris of isi.split("\n")) {
    const cocok = /kunci="([a-zA-Z-]+)"/.exec(baris);
    if (!cocok) continue;
    // Satu bagian dapat menyebut kuncinya dua kali - sekali pada <Bagian> dan
    // sekali pada elemen di dalamnya. Yang kedua diabaikan.
    if (kunci[kunci.length - 1] === cocok[1]) continue;
    kunci.push(cocok[1]);
  }
  return kunci;
}

describe("susunan bagian mengikuti jalan perkara", () => {
  const URUT = [
    // siapa
    "majelis",
    "pihak",
    // jalannya
    "tahapan",
    "sidang",
    // Kalender menggambar sidang yang sama pada satu bulan; relaas menjawab
    // bagaimana para pihak dipanggil untuk sidang-sidang itu. Keduanya hanya
    // berarti SESUDAH daftar sidangnya dibaca, dan karena itu berdiri persis
    // di belakangnya.
    "kalender",
    "relaas",
    "mediasi",
    "saksi",
    // hasil
    "putusan-lengkap",
    "putusan",
    "ikrar",
    "upaya",
    // sesudahnya
    "putusanEcourt",
    // Aksi e-Court (1 Okt 2026, E9-E11): e-litigasi, verifikasi, TTE - tepat
    // sesudah keadaan putusan e-Court yang menjadi alasannya.
    "ecourtAksi",
    "arsip",
    "delegasi",
    "berkas",
    "biaya",
    // kesimpulan
    "rubrik",
    "sk",
    // alat
    "analisa-lanjut",
    // Perbandingan adalah pertanyaan yang muncul SESUDAH satu perkara selesai
    // dibaca - "kok yang ini lebih lama dari yang itu?" - bukan pertanyaan
    // pembuka. Karena itu ia berdiri sesudah analisis, bukan di antara fakta.
    "banding-perkara",
    "prompt-putusan",
    "analisa",
  ];

  it("seluruh bagian ada, dan urutannya persis", () => {
    expect(urutanBagian()).toEqual(URUT);
  });

  it("dua bagian putusan berdampingan", () => {
    // Sepuluh bagian di antaranya memaksa pembaca mengingat isi yang pertama
    // sampai tiba di yang kedua.
    const urut = urutanBagian();
    expect(urut.indexOf("putusan") - urut.indexOf("putusan-lengkap")).toBe(1);
  });

  it("siapa-nya lebih dulu daripada apa pun yang menyebut nama", () => {
    const urut = urutanBagian();
    expect(urut.indexOf("majelis")).toBeLessThan(urut.indexOf("tahapan"));
    expect(urut.indexOf("pihak")).toBeLessThan(urut.indexOf("sidang"));
  });

  it("penilaian datang sesudah seluruh buktinya", () => {
    // Kesimpulan yang berdiri sebelum buktinya menuntut pembacanya percaya
    // lebih dulu, lalu memeriksa belakangan - dan yang percaya lebih dulu
    // jarang kembali memeriksa.
    const urut = urutanBagian();
    for (const bukti of ["tahapan", "sidang", "putusan", "berkas", "biaya"]) {
      expect(urut.indexOf(bukti), bukti).toBeLessThan(urut.indexOf("rubrik"));
    }
    expect(urut.indexOf("rubrik")).toBeLessThan(urut.indexOf("analisa"));
  });
});

// ---------------------------------------------------------------------------
// GRAFIK PADA STATUS PERKARA
// ---------------------------------------------------------------------------

const berkasSajian = path.resolve(
  process.cwd(),
  "src/components/portal/bentuk-sajian.tsx"
);

describe("grafik memakai penggambar yang sudah ada", () => {
  it("tidak ada penggambar kedua yang ditulis di layar ini", () => {
    // Dua penggambar untuk bentuk yang sama akan sama-sama bekerja, lalu pada
    // suatu hari menggambar angka yang sama dengan bentuk yang berbeda - dan
    // yang membacanya tidak punya cara tahu mana yang benar.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain('from "@/components/portal/bentuk-sajian"');
    // Layar ini tidak boleh menggambar SVG-nya sendiri.
    expect(isi).not.toContain("<svg viewBox");
  });

  it("ketiga grafik baru terpasang di bagian yang datanya berada", () => {
    // Grafik yang berdiri jauh dari datanya memaksa pembacanya mengingat
    // angka sambil menggulir - dan yang mengingat sambil menggulir keliru.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain("Jeda antara peristiwa dan penginputannya");
    // Sejak 24 Sep 2026 judulnya "Umur perkara": sumbu tegaknya hari yang
    // DIHITUNG (hari pendaftaran hari ke-1, mediasi dikeluarkan), bukan lagi
    // hari kalender sejak pendaftaran. Grafiknya tetap di bagian yang sama.
    expect(isi).toContain('judul="Umur perkara pada tiap sidang"');
    const iSidang = isi.indexOf('kunci="sidang"');
    const iGrafik = isi.indexOf('judul="Umur perkara pada tiap sidang"');
    expect(iGrafik).toBeGreaterThan(iSidang);
    expect(iGrafik).toBeLessThan(isi.indexOf('kunci="kalender"'));
    expect(isi).toContain("Komposisi pengeluaran");
    expect(isi).toContain("Poin yang diperoleh tiap aspek");
  });

  it("garis ambang membawa dasar hukumnya", () => {
    // Ambang tanpa dasar hanya angka yang harus dipercaya; ambang yang
    // menyebut dasarnya dapat dibantah.
    expect(readFileSync(berkas, "utf8")).toContain('label: "5 bulan - SEMA 2/2014"');
  });

  it("pai hanya menggambar pengeluaran", () => {
    // Mencampur penerimaan dan pengeluaran dalam satu pai berarti
    // menjumlahkan uang masuk dengan uang keluar seolah keduanya bagian dari
    // satu keseluruhan - padahal yang satu justru sumber yang satunya.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain('x.jenis === "keluar" && x.jumlah > 0');
  });

  it("unsur yang belum terbaca tidak dihitung nol", () => {
    // Menghitungnya nol menuduh pengadilan atas data yang justru belum dapat
    // dibaca ALETA.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain("x.terbaca && x.poin !== null");
    expect(isi).toContain("bukan dihitung");
  });
});

describe("umur perkara pada tiap sidang dihitung seperti kepala layarnya", () => {
  /**
   * Diminta 24 Sep 2026: grafik lama "terlalu datar dan tidak memberi
   * informasi". Begitu pita 90/120/150 hari digambar, pita itu menjadi
   * PENILAIAN - dan penilaiannya harus memakai hari yang sama dengan "Lama
   * perkara" di kepala layar: terukur 94 dari 1.977 perkara putus bersidang
   * tiga kali atau lebih jatuh pada pita yang berbeda bila grafiknya memakai
   * hari kalender. Hitungannya sendiri diuji perjalanan-sidang.test.ts.
   */
  const isi = () => readFileSync(berkas, "utf8");

  it("potongan mediasinya angka yang SAMA dengan Lama perkara, bukan hitungan sendiri", () => {
    const teks = isi();
    expect(teks).toContain("susunPerjalananSidang({");
    expect(teks).toContain("hariMediasi: status.umur.hariMediasi,");
  });

  it("sidang sesudah putusan tidak dinilai terhadap ambang", () => {
    expect(isi()).toContain(
      'tanggalPutusan: status.putusan && status.putusan.sudahPutus ? status.putusan.tanggalPutusan : ""'
    );
  });

  it("ketiga pita membawa dasarnya, dan batas lima bulan dari satu sumber", () => {
    const teks = isi();
    expect(teks).toContain('label: "3 bulan - SK Dirjen Badilag 048/2024"');
    expect(teks).toContain('label: "4 bulan - SK Dirjen Badilag 048/2024"');
    expect(teks).toContain("sampai: AMBANG_HARI_SEMA");
  });

  it("warna pita hijau, kuning, oranye - lalu merah di atas 150 - urut menurut batasnya", () => {
    // Sebutan yang sama dengan pita waktu putus (lib/pita-waktu-putus.ts);
    // tipenya dipinjam di bentuk-sajian, jadi sebutan lain tidak lolos tsc.
    const teks = isi();
    const i90 = teks.indexOf('{ sampai: 90, singkat: "3 bln"');
    const i120 = teks.indexOf('{ sampai: 120, singkat: "4 bln"');
    const i150 = teks.indexOf('{ sampai: AMBANG_HARI_SEMA, singkat: "5 bln"');
    expect(i90).toBeGreaterThan(-1);
    expect(i120).toBeGreaterThan(i90);
    expect(i150).toBeGreaterThan(i120);
    expect(teks.slice(i90, teks.indexOf("}", i90))).toContain('nada: "hijau"');
    expect(teks.slice(i120, teks.indexOf("}", i120))).toContain('nada: "kuning"');
    expect(teks.slice(i150, teks.indexOf("}", i150))).toContain('nada: "oranye"');
  });

  it("grafik hari kalender yang lama tidak kembali", () => {
    expect(isi()).not.toContain("<DiagramGaris");
  });

  it('"hari ini" menurut jam peramban, bukan tanggal UTC', () => {
    // toISOString() memberi tanggal UTC: pukul 00.00-08.00 WITA lencana
    // "Sidang berikut" masih menyebut sidang kemarin sementara grafiknya sudah
    // menggambar sidang hari ini berongga.
    const teks = isi();
    expect(teks).not.toContain("new Date().toISOString().slice(0, 10)");
    expect(teks).toContain("hariIni: hariIniIso(),");
    expect(teks).toContain("const sidangBerikut = status.jadwal.find((x) => x.tanggalSidang >= hariIniIso());");
  });
});

describe("nomor sidang di Status Perkara", () => {
  /**
   * Diminta 24 Sep 2026 (butir 12 dan 13): tiap daftar sidang bernomor di
   * tepi kiri dan urut menurut nomornya - nomor SIPP perkara_jadwal_sidang.
   * urutan, sama dengan panel Rincian di Antrian Sidang. Court Calendar
   * bernomor rencana 1..N seperti kolom "No" pada cetak SIPP-nya.
   */
  const isi = () => readFileSync(berkas, "utf8");

  it("tidak ada lagi daftar sidang yang digambar menurut urutan kiriman bot", () => {
    expect(isi()).not.toContain("{status.jadwal.map((sidang) => (");
    expect(isi()).toContain("const jadwalUrut = useMemo(() => urutkanMenurutNomorSidang(status.jadwal), [status.jadwal]);");
  });

  it("Perjalanan sidang dan BAS di Berkas sama-sama bernomor", () => {
    const teks = isi();
    expect(teks.split("<NomorSidang urutan={sidang.urutanSidang} />").length - 1).toBe(2);
    // Keduanya di dalam bagian masing-masing, bukan di tempat lain.
    const iSidang = teks.indexOf('kunci="sidang"');
    const iNomor1 = teks.indexOf("<NomorSidang urutan={sidang.urutanSidang} />");
    expect(iNomor1).toBeGreaterThan(iSidang);
    expect(iNomor1).toBeLessThan(teks.indexOf('kunci="kalender"'));
    const iBas = teks.indexOf("--- Berita acara sidang ---");
    const iNomor2 = teks.indexOf("<NomorSidang urutan={sidang.urutanSidang} />", iNomor1 + 1);
    expect(iNomor2).toBeGreaterThan(iBas);
  });

  it("komponennya DIIMPOR dari Antrian Sidang, bukan disalin", () => {
    // Dua salinan akan berselisih lebar atau warnanya pada suntingan
    // berikutnya, dan nomor yang sama tampak berbeda di dua layar.
    const teks = isi();
    expect(teks).toMatch(
      /import \{[^}]*\bNomorSidang\b[^}]*\} from "@\/components\/portal\/aleta-ecourt-sidang"/
    );
    expect(teks).not.toContain("function NomorSidang(");
  });

  it("nomor Court Calendar dihitung SESUDAH diurutkan, dan bukan nomor sidang", () => {
    const teks = isi();
    const blok = teks.slice(teks.indexOf("function CourtCalendarSipp("), teks.indexOf("function bunyiAlasanKepatutan("));
    const iNomor = blok.indexOf('<NomorSidang urutan={ke + 1} sebutan="Rencana" />');
    expect(iNomor).toBeGreaterThan(-1);
    expect(iNomor).toBeGreaterThan(blok.indexOf(".sort("));
    // Keterangan "sidang ke-N" pada rencana memakai aturan satu-sidang-sehari.
    expect(blok).toContain("return nomor.length === 1 ? nomor[0] : 0;");
  });

  it("relaas bernomor menurut sidangId-nya, bukan menurut urutan kelompok", () => {
    const teks = isi();
    expect(teks).not.toContain("Sidang ke-{urutan + 1}");
    const blok = teks.slice(teks.indexOf("export function RelaasPanggilan("));
    expect(blok).toContain("petaNomorSidang(status.jadwal)");
    expect(blok).toContain('.map((r) => nomorSidangPer.get(String(r.sidangId || "")))');
  });
});

describe("palet irisan pai - hasil pengukuran, bukan selera", () => {
  /**
   * Angka di bawah datang dari pemeriksa palet, dijalankan terhadap permukaan
   * ALETA yang sebenarnya (#f8fafc terang, #121b26 gelap):
   *
   *   palet lama, slot 1 #155375   GAGAL pita terang  (L 0,421 < 0,43)
   *                                GAGAL lantai kroma (0,083 < 0,1 - abu-abu)
   *   palet acuan 6 slot           LULUS SELURUHNYA pada kedua mode
   *   palet acuan 8 slot           GAGAL - dan tidak ada palet delapan warna
   *                                yang lulus pemeriksaan seluruh pasangan
   */
  it("warna utama aplikasi TIDAK dipakai sebagai irisan", () => {
    // Ia warna tindakan - dipilih untuk kontras terhadap tulisan, bukan untuk
    // dibedakan dari lima warna lain di dalam satu lingkaran.
    const isi = readFileSync(berkasSajian, "utf8");
    const blok = isi.slice(isi.indexOf("const WARNA_IRISAN"), isi.indexOf("export function DiagramPai"));
    expect(blok).not.toContain("fill-primary");
  });

  it("enam warna, tiap mode punya langkahnya sendiri", () => {
    // Mode gelap bukan pembalikan otomatis - ia langkah tersendiri dari ramp
    // yang sama, diperiksa terhadap permukaan gelapnya.
    const isi = readFileSync(berkasSajian, "utf8");
    const blok = isi.slice(isi.indexOf("const WARNA_IRISAN"), isi.indexOf("export function DiagramPai"));
    const warna = blok.match(/fill-\[#[0-9a-f]{6}\] dark:fill-\[#[0-9a-f]{6}\]/g) || [];
    expect(warna).toHaveLength(6);
  });

  it("jumlah irisan dibatasi sebanyak warna yang lulus", () => {
    // Warna yang diputar berarti irisan ketujuh memakai warna irisan pertama,
    // dan dua irisan berwarna sama di dalam satu lingkaran adalah kekeliruan
    // yang tidak dapat dijelaskan keterangan apa pun.
    expect(readFileSync(berkasSajian, "utf8")).toContain("maksIrisan = 6");
  });
});

// ---------------------------------------------------------------------------
// WARNA PUTUSAN - SATU ATURAN, DIPAKAI DUA LAYAR
// ---------------------------------------------------------------------------

describe("warna status putusan", () => {
  it("tujuh status yang benar-benar dipakai PA Donggala", () => {
    // Dari tabel status_putusan SIPP, bukan daftar yang dikarang.
    //
    // Sejak 2.32.0 warnanya lebih bervariasi atas permintaan pengguna: Gugur
    // dan Digugurkan tidak lagi berbagi kuning dengan Tidak Dapat Diterima,
    // dan Dicabut tidak lagi berbagi kelabu dengan lencana yang kosong.
    expect(warnaStatusPutusan("Dikabulkan")).toBe("success");
    expect(warnaStatusPutusan("Dikabulkan Sebagian")).toBe("success");
    expect(warnaStatusPutusan("Perdamaian")).toBe("success");
    expect(warnaStatusPutusan("Ditolak")).toBe("danger");
    expect(warnaStatusPutusan("Gugur")).toBe("warning");
    expect(warnaStatusPutusan("Digugurkan")).toBe("netral");
    expect(warnaStatusPutusan("Dicabut")).toBe("info");
    expect(warnaStatusPutusan("Dicoret dari Register")).toBe("info");
  });

  it("hanya SATU yang merah - dan itu memang satu-satunya kekalahan pokok", () => {
    // Inilah yang sesungguhnya dijaga, dan ia bertahan walau warnanya diganti.
    // Merah pada status yang bukan kekalahan membuat pihak yang membacanya
    // menyimpulkan perkaranya habis, padahal boleh diajukan kembali.
    const merah = [
      "Dikabulkan",
      "Dikabulkan Sebagian",
      "Perdamaian",
      "Tidak Dapat Diterima",
      "Gugur",
      "Digugurkan",
      "Dicabut",
      "Dicoret dari Register",
    ].filter((s) => warnaStatusPutusan(s) === "danger");
    expect(merah, `status bukan-kekalahan berwarna merah: ${merah.join(", ")}`).toEqual([]);
    expect(warnaStatusPutusan("Ditolak")).toBe("danger");
  });

  it("yang artinya BERBEDA tidak berbagi satu warna", () => {
    // Sebelum 2.32.0 empat status berbagi kuning, dan warnanya berhenti
    // memberi tahu apa pun - itulah sebab pengguna memintanya bervariasi.
    //
    // Yang dijaga KEBERBEDAANNYA, bukan warna tertentu, supaya paletnya
    // boleh disetel lagi tanpa diam-diam mengembalikan tabrakannya.
    //
    // "Gugur" dan "Tidak Dapat Diterima" SENGAJA tetap sewarna: keduanya satu
    // keluarga - perkaranya berhenti tanpa pokoknya diperiksa dan boleh
    // diajukan kembali. Memisahkannya hanya demi keberagaman warna akan
    // memberi tahu sesuatu yang tidak benar.
    const keluargaKuning = warnaStatusPutusan("Gugur");
    expect(warnaStatusPutusan("Tidak Dapat Diterima")).toBe(keluargaKuning);

    // Ketiga inilah yang artinya berlainan, dan ketiganya harus berlainan pula.
    const berbeda = [
      keluargaKuning,
      warnaStatusPutusan("Digugurkan"), // dijatuhkan majelis
      warnaStatusPutusan("Dicabut"), // ditarik pemohonnya sendiri
      warnaStatusPutusan("Ditolak"), // pokoknya diperiksa, tidak berdasar
      warnaStatusPutusan("Dikabulkan"),
    ];
    expect(new Set(berbeda).size, `warnanya bertabrakan: ${berbeda.join(", ")}`).toBe(
      berbeda.length
    );
  });

  it("Tidak Dapat Diterima kuning, BUKAN merah", () => {
    // Ia bukan kekalahan: syarat formalnya belum terpenuhi dan perkaranya
    // boleh diajukan kembali. Ditolak berarti pokoknya sudah diperiksa dan
    // mengajukannya lagi menabrak nebis in idem - dua keadaan yang akibatnya
    // berlawanan bagi pihak yang membacanya.
    expect(warnaStatusPutusan("Tidak Dapat Diterima")).toBe("warning");
    expect(warnaStatusPutusan("Tidak Dapat Diterima")).not.toBe("danger");
  });

  it("Perdamaian sederajat dengan dikabulkan", () => {
    // PERMA 1/2016 menempatkannya sebagai hasil yang paling dikehendaki.
    expect(warnaStatusPutusan("Perdamaian")).toBe(warnaStatusPutusan("Dikabulkan"));
  });

  it("status yang tidak dikenali tetap tampil, tidak dipaksa berwarna", () => {
    // Nama status ditentukan operator SIPP dan dapat bertambah kapan saja.
    expect(warnaStatusPutusan("Mengabulkan Eksepsi")).toBe("outline");
  });

  it("kosong netral, bukan hijau", () => {
    expect(warnaStatusPutusan("")).toBe("muted");
  });

  it("kelas tulisan diturunkan dari aturan yang SAMA", () => {
    // Lencana dan tulisan tidak boleh menyebut arti berbeda untuk status yang
    // sama - itu terjadi begitu keduanya punya daftar warnanya sendiri.
    expect(kelasTulisanPutusan("Ditolak")).toContain("rose");
    expect(kelasTulisanPutusan("Dikabulkan")).toContain("emerald");
    expect(kelasTulisanPutusan("Tidak Dapat Diterima")).toContain("amber");
  });
});

describe("aturan warna tidak disalin ke layar mana pun", () => {
  it("kedua layar mengimpor dari satu berkas", () => {
    const sidang = readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    const perkara = readFileSync(berkas, "utf8");
    for (const [nama, isi] of [
      ["jadwal sidang", sidang],
      ["status perkara", perkara],
    ] as const) {
      expect(isi, nama).toContain('from "@/lib/warna-putusan"');
      // Tidak ada salinan lokalnya. Dua salinan akan sama-sama bekerja, lalu
      // pada suatu hari satu layar menghijaukan status yang dimerahkan layar
      // lain untuk perkara yang persis sama.
      expect(isi, nama).not.toContain("function warnaStatusPutusan");
    }
  });
});

describe("para pihak dipisah menurut kedudukan", () => {
  it("empat kelompok, dan saksi tidak lagi disebut pihak", () => {
    // Saksi bukan pihak: ia tidak dipanggil sebagai pihak, tidak menanggung
    // biaya, dan tidak terikat putusan.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain('judul="Penggugat / Pemohon"');
    expect(isi).toContain('judul="Tergugat / Termohon"');
    expect(isi).toContain('judul="Saksi penggugat"');
    expect(isi).toContain('judul="Saksi tergugat"');
  });

  it("sisi saksi dibaca dari SIPP, bukan ditebak", () => {
    // Daftar pihak tidak menyimpan sisinya - di sana saksi hanya berkedudukan
    // lima tanpa keterangan sisi. Yang menyimpannya saksiRinci.diajukanOleh.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain("const sisiSaksi = new Map<string, string>()");
    expect(isi).toContain("saksi.diajukanOleh");
  });

  it("saksi yang sisinya tidak terbaca disebut apa adanya", () => {
    // Menaruhnya pada sisi yang salah membalik siapa yang menghadirkannya -
    // keterangan yang dipersoalkan saat kesaksiannya dinilai.
    expect(readFileSync(berkas, "utf8")).toContain('judul="Saksi - sisi belum tercatat"');
  });

  it("kuasa menempel pada pihak yang diwakilinya", () => {
    // Kuasa tidak berdiri sendiri di persidangan - ia hadir UNTUK seseorang.
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain("kuasa={kuasaSisi(1)}");
    expect(isi).toContain("kuasa={kuasaSisi(2)}");
  });
});

// ---------------------------------------------------------------------------
// RELAAS PANGGILAN DAN KALENDER PERKARA
// ---------------------------------------------------------------------------

describe("relaas panggilan berdiri sendiri dan runut per sidang", () => {
  const isi = () => readFileSync(berkas, "utf8");

  it("kedelapan ruas yang sudah dikirim bot ikut dideklarasikan tipenya", () => {
    // relaasSidang di bot memulangkan keenam belas ruas ini sejak lama;
    // tipenya di layar hanya menyebut delapan, sehingga separuh jawaban yang
    // sudah melintasi jaringan berhenti tanpa satu galat pun - dan yang
    // membaca layar menyimpulkan SIPP-nya yang kosong.
    const teks = isi();
    for (const ruas of [
      "tanggalKirimPos",
      "statusPos",
      "retur",
      "ketHasilRelaas",
      "bertemu",
      "noResiPos",
      "jurusitaNama",
      "pihakKe",
    ]) {
      expect(teks, ruas).toContain(`${ruas}:`);
    }
  });

  it("dikelompokkan per SIDANG, bukan per pihak, dan menaik", () => {
    // Perkara yang bersidang enam kali mencatat dua nama yang sama dua belas
    // kali. Yang ditanyakan majelis tiap kali sidang dibuka bukan "siapa saja
    // yang pernah dipanggil", melainkan "untuk sidang ini, siapa yang sudah".
    const teks = isi();
    expect(teks).toContain("const kunci = baris.tanggalSidang");
    expect(teks).toMatch(/tanggalUrut[\s\S]{0,200}\.sort\(\(a, b\) => \(a < b \? -1/);
  });

  it("relaas tanpa tautan sidang DISEBUT, bukan dibuang dari daftar", () => {
    // sidang_id kosong adalah keadaan yang perlu diperbaiki di SIPP. Relaas
    // yang hilang dari layar karena itu membuat orang menyangka panggilannya
    // memang belum pernah dibuat.
    const teks = isi();
    expect(teks).toContain("relaas tanpa tautan sidang");
    expect(teks).toContain("tidak dapat dipastikan untuk sidang yang mana");
  });

  it("jarak hari relaas ke sidang dihitung - itulah yang menentukan kepatutan", () => {
    const teks = isi();
    expect(teks).toContain("hari sebelum sidang");
    // Relaas yang dilaksanakan SESUDAH sidangnya bukan sekadar angka negatif.
    expect(teks).toContain("hari SESUDAH sidang");
  });

  it("kepatutan berbunyi kalimat, bukan kode alasan", () => {
    const teks = isi();
    expect(teks).toContain("function bunyiAlasanKepatutan");
    expect(teks).toContain("dikirim setelah hari sidang");
    expect(teks).toContain("penerimaannya belum terbukti");
    // Penilaian ini alat bantu - kalimat itu harus ikut sampai ke layar.
    expect(teks).toContain("bukan penetapan sah tidaknya panggilan");
  });

  it("daftar relaas tidak digambar dua kali", () => {
    // Dua daftar untuk satu data akan berselisih pada suntingan berikutnya,
    // dan tidak ada yang tahu mana yang usang. Bagian Berkas menyisakan
    // hitungannya saja beserta penunjuk ke bagian yang memuat rinciannya.
    const teks = isi();
    expect(teks.split("jenis=relaas&id=").length - 1).toBe(1);
    expect(teks).toContain("Rincian dan unduhannya ada di bagian");
  });
});

describe("kalender perkara dihitung dari muatan yang sudah ada", () => {
  const isi = () => readFileSync(berkas, "utf8");

  it("tidak ada satu pun panggilan baru untuk menggambarnya", () => {
    // Tiap tanggalnya sudah berada di layar ini, tersebar di enam bagian.
    // Menambah rute hanya untuk mengumpulkannya berarti menunda jawabannya
    // demi jawaban yang sama, dan menambah satu tempat lagi yang dapat gagal.
    const teks = isi();
    const badan = teks.slice(teks.indexOf("function susunPeristiwa("), teks.indexOf("function RelaasPanggilan("));
    expect(badan).not.toContain("fetch(");
    expect(badan).not.toContain("apiPath(");
  });

  it("seluruh peristiwa perkara ikut, bukan sidangnya saja", () => {
    const teks = isi();
    const badan = teks.slice(teks.indexOf("function susunPeristiwa("), teks.indexOf("function KalenderPerkara("));
    for (const jenis of ["daftar", "penetapan", "relaas", "mediasi", "sidang", "putusan", "minutasi", "bht", "akta", "ikrar"]) {
      expect(badan, jenis).toContain(`jenis: "${jenis}"`);
    }
  });

  it("pendaftaran tidak dihitung dua kali", () => {
    // Ia disebut identitas DAN tahapan; tanpa penjaga ini satu hari tampak
    // memuat dua peristiwa yang sebenarnya satu.
    const teks = isi();
    expect(teks).toContain('if (tahap.kunci === "daftar" || tahap.kunci === "pendaftaran") continue;');
  });

  it("bulan yang dibuka bukan bulan ini, melainkan bulan peristiwa terdekat", () => {
    // Perkara yang putus setahun lalu tidak punya apa pun pada bulan ini, dan
    // kalender yang terbuka kosong terbaca seperti kalender yang rusak.
    const teks = isi();
    expect(teks).toContain("const berikut = peristiwa.find((x) => x.tanggal >= hariIni);");
    expect(teks).toContain("peristiwa[peristiwa.length - 1]");
  });

  it("berpindah perkara menyetel ulang bulannya", () => {
    // Komponennya tidak dibongkar saat perkara lain dibuka - hanya muatannya
    // berganti. Tanpa ini kalender tetap berdiri di bulan perkara sebelumnya.
    //
    // Sejak 24 Sep 2026 disetel saat menggambar, bukan di useEffect (eslint
    // react-hooks/set-state-in-effect menolak bentuk lama). Kuncinya tetap
    // nomor perkara DAN bulan awal - keduanya, seperti dependensi efek dulu -
    // dan perilakunya kini diuji digambar di status-perkara-relaas-kalender.
    const teks = isi();
    expect(teks).toContain("const kunciBulanAwal = `${status.identitas.nomorPerkara}|${bulanAwal}`;");
    const i = teks.indexOf("if (kunciTerakhir !== kunciBulanAwal) {");
    expect(i).toBeGreaterThan(-1);
    const blok = teks.slice(i, teks.indexOf("}", i));
    expect(blok).toContain("setKunciTerakhir(kunciBulanAwal);");
    expect(blok).toContain("setBulan(bulanAwal);");
    expect(blok).toContain('setDipilih("");');
  });

  it("keterangan warna hanya memuat jenis yang ada pada bulan itu", () => {
    const teks = isi();
    expect(teks).toContain("jenisBulanIni.has(jenis)");
  });

  it("tanpa satu pun tanggal, kalender mengatakannya - bukan menggambar bulan kosong", () => {
    const teks = isi();
    expect(teks).toContain("kalender tidak dapat disusun");
  });

  it("warna tiap jenis punya pasangan mode gelap", () => {
    // Teks berwarna tanpa pasangan gelap menjadi tidak terbaca pada tema
    // gelap - dan yang membacanya menyangka layarnya rusak.
    const teks = isi();
    const blok = teks.slice(teks.indexOf("const JENIS_PERISTIWA = {"), teks.indexOf("type JenisPeristiwa"));
    const baris = blok.split("\n").filter((x) => x.includes("teks:"));
    expect(baris.length).toBeGreaterThanOrEqual(10);
    for (const satu of baris) expect(satu, satu.trim()).toContain("dark:");
  });
});

describe("jalan ke layar penilaian yang berdiri sendiri", () => {
  /**
   * ==========================================================================
   * KENAPA TAUTANNYA DIJAGA, PADAHAL HANYA TAUTAN
   * ==========================================================================
   *
   * Beban Kinerja Konseptor dan Peta Perkara TIDAK muncul di beranda - hanya
   * di menu samping - dan Beban Kinerja Konseptor bahkan hanya untuk pimpinan
   * serta kepaniteraan. Petugas yang membaca nama konseptor pada layar ini
   * karena itu wajar menyimpulkan penilaiannya tidak ada; itu memang yang
   * dilaporkan satker.
   *
   * Tautan yang hilang tidak akan berbunyi apa pun - layarnya tetap benar,
   * hanya jalannya lenyap. Karena itu keberadaannya dituntut di sini.
   */
  const isi = () => readFileSync(berkas, "utf8");

  it("ada di sebelah kolom Konseptor", () => {
    const teks = isi();
    // Ukuran hurufnya sengaja TIDAK dikunci di sini: yang dijaga uji ini
            // adalah tautannya, dan mengunci kelasnya membuat penataan huruf
            // mematahkan penjaga yang sama sekali bukan urusannya. Hierarki
            // ukuran dijaga tersendiri di bawah.
    const iKonseptor = teks.search(/<dt className="[^"]*">Konseptor<\/dt>/);
    expect(iKonseptor).toBeGreaterThan(-1);
    const iTautan = teks.indexOf("Lihat beban kinerja konseptor", iKonseptor);
    expect(iTautan).toBeGreaterThan(iKonseptor);
    // Masih di dalam blok kolom yang sama - bukan terlempar jauh ke bawah.
    expect(iTautan - iKonseptor).toBeLessThan(3000);
  });

  it("ada juga di kepala Analisis lanjutan", () => {
    const teks = isi();
    const iBagian = teks.indexOf('kunci="analisa-lanjut"');
    const iAnalisa = teks.indexOf("<AletaAnalisaPerkara", iBagian);
    const iKonseptor = teks.indexOf("Beban Kinerja Konseptor", iBagian);
    const iPeta = teks.indexOf("Peta Perkara —", iBagian);
    expect(iBagian).toBeGreaterThan(-1);
    // Di KEPALA bagian, yaitu sebelum daftar tiga puluh satu tombolnya.
    expect(iKonseptor).toBeGreaterThan(iBagian);
    expect(iKonseptor).toBeLessThan(iAnalisa);
    expect(iPeta).toBeGreaterThan(iBagian);
    expect(iPeta).toBeLessThan(iAnalisa);
  });

  it("haknya ditanyakan ke sumber yang sama dengan menu samping", () => {
    // Daftar peran yang DISALIN ke layar ini akan menyimpang diam-diam begitu
    // satker mengubah Akses Menu - dan yang menyimpang justru tautan yang
    // berujung penolakan.
    const teks = isi();
    // Boleh membawa ruas lain (currentUser untuk panduan saksi) - yang dijaga: haknya dari accessibleModules.
    expect(teks).toMatch(/const \{ accessibleModules[^}]*\} = usePortal\(\);/);
    expect(teks).toContain('accessibleModules.some((m) => m.id === "beban-konseptor")');
    expect(teks).not.toMatch(/roleIds\s*[:=]/);
  });

  it("tautan konseptor tidak digambar bagi yang tidak berhak", () => {
    const teks = isi();
    expect(teks).toContain("{bolehBebanKonseptor ? (");
  });
});

describe("warna terang selalu punya pasangan mode gelap", () => {
  /**
   * ==========================================================================
   * PORTAL INI BERTEMA GELAP SECARA BAWAAN
   * ==========================================================================
   *
   * `layout.tsx` menaruh kelas `dark` pada <html> SEBELUM halaman digambar,
   * dan `prefers-color-scheme` tidak pernah ditanyakan. Warna Tailwind
   * berangka besar - 700, 800, 900 - dibuat untuk latar TERANG.
   *
   * Terukur pada berkas ini sebelum diperbaiki: 19 atribut kelas memakai amber
   * tanpa satu pun pasangan `dark:`. Di layar petugas itu tulisan cokelat tua
   * di atas latar hampir hitam, dan `bg-amber-50` menjadi kotak nyaris putih
   * di tengah halaman gelap.
   *
   * Tidak ada galat yang berbunyi: halamannya tergambar, hanya tidak terbaca.
   * Karena itu ia dijaga di sini, bukan diserahkan kepada mata yang kebetulan
   * membuka layar itu dalam tema gelap.
   */
  const WARNA_TERANG =
    /\b(?:text|bg|border)-(?:amber|emerald|rose|red|blue|teal|slate|violet|sky)-(?:50|100|200|700|800|900)\b/;

  it("tidak ada atribut kelas berwarna terang tanpa pasangan gelap", () => {
    const isi = readFileSync(berkas, "utf8");
    const pelanggar: string[] = [];

    // Diperiksa per ATRIBUT, bukan per baris: satu className kerap memanjang
    // beberapa baris, dan pasangan gelapnya berada di baris yang lain.
    for (const cocok of isi.matchAll(/className="([^"]*)"/g)) {
      const kelas = cocok[1];
      if (!WARNA_TERANG.test(kelas)) continue;
      if (!kelas.includes("dark:")) pelanggar.push(kelas.slice(0, 90));
    }
    // Rangkaian ternary di dalam cn() ikut diperiksa lewat potongan teksnya.
    for (const cocok of isi.matchAll(/"((?:bg|text|border)-[^"]*)"/g)) {
      const kelas = cocok[1];
      if (!WARNA_TERANG.test(kelas)) continue;
      if (!kelas.includes("dark:")) pelanggar.push(kelas.slice(0, 90));
    }

    expect(pelanggar, `tanpa pasangan gelap:\n${pelanggar.join("\n")}`).toEqual([]);
  });
});

describe("hierarki ukuran huruf - label, nilai, dan keterangan", () => {
  /**
   * ==========================================================================
   * KENAPA LAYARNYA TERASA PADAT - DAN INI TERUKUR
   * ==========================================================================
   *
   * Disisir sebelum disentuh:
   *
   *     text-sm    249 pemakaian
   *     text-xs     13
   *     text-lg      2
   *
   * Hampir seluruhnya SATU ukuran. Yang membuat layar terasa padat bukan
   * banyaknya isi - dua puluh tujuh bagian memang banyak - melainkan tidak
   * adanya apa pun yang memberi tahu mata mana yang label dan mana yang nilai.
   * Keduanya sama besar, sama beratnya, dan berjejer.
   *
   * Yang dikecilkan hanya yang PERANNYA sekunder, dan perannya dikenali dari
   * bentuknya: <dt> adalah nama medan, <thead> adalah kepala tabel. Dua ratus
   * sisanya - yang memuat NILAINYA - tidak disentuh: layar yang seluruhnya
   * kecil sama tidak berhierarkinya dengan layar yang seluruhnya sedang.
   *
   * Dijaga di sini sebab kemunduran ini tidak berbunyi apa pun. Satu <dt> baru
   * yang ditulis dengan text-sm hanya akan tampak sedikit lebih besar dari
   * tetangganya, dan tidak ada yang memeriksanya.
   */
  const isi = () => readFileSync(berkas, "utf8");

  it("nama medan <dt> selalu lebih kecil daripada nilainya", () => {
    const pelanggar = [...isi().matchAll(/<dt className="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((k) => k.includes("text-sm"));
    expect(pelanggar, `<dt> yang masih sebesar nilainya:\n${pelanggar.join("\n")}`).toEqual([]);
  });

  it("kepala tabel lebih kecil daripada isinya", () => {
    const pelanggar = [...isi().matchAll(/<thead className="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((k) => k.includes("text-sm"));
    expect(pelanggar, `<thead> sebesar isinya:\n${pelanggar.join("\n")}`).toEqual([]);
  });

  it("ketiga tingkatnya sungguh dipakai - bukan satu ukuran untuk semua", () => {
    const teks = isi();
    const hitung = (p: RegExp) => (teks.match(p) || []).length;
    const kecil = hitung(/\btext-xs\b/g);
    const sedang = hitung(/\btext-sm\b/g);
    // Bukan angka pas - yang dijaga PERBANDINGANNYA. Sebelum disunting,
    // text-xs hanya 13 dari 262; sesudahnya 60 dari 262.
    expect(kecil, "keterangan sekunder").toBeGreaterThan(40);
    expect(sedang, "nilai").toBeGreaterThan(150);
  });
});
