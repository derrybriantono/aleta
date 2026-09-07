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
    "mediasi",
    "saksi",
    // hasil
    "putusan-lengkap",
    "putusan",
    "ikrar",
    "upaya",
    // sesudahnya
    "putusanEcourt",
    "arsip",
    "delegasi",
    "berkas",
    "biaya",
    // kesimpulan
    "rubrik",
    "sk",
    // alat
    "analisa-lanjut",
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
    expect(isi).toContain("Hari sejak pendaftaran pada tiap sidang");
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
    expect(warnaStatusPutusan("Dikabulkan")).toBe("success");
    expect(warnaStatusPutusan("Dikabulkan Sebagian")).toBe("success");
    expect(warnaStatusPutusan("Perdamaian")).toBe("success");
    expect(warnaStatusPutusan("Ditolak")).toBe("danger");
    expect(warnaStatusPutusan("Digugurkan")).toBe("warning");
    expect(warnaStatusPutusan("Gugur")).toBe("warning");
    expect(warnaStatusPutusan("Dicabut")).toBe("muted");
    expect(warnaStatusPutusan("Dicoret dari Register")).toBe("muted");
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
