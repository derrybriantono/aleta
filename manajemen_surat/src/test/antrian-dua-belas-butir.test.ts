import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { KELOMPOK_KEADAAN } from "@/lib/keadaan-sidang";
import { peranLihatSemua, saringPerkaraSendiri } from "@/lib/perkara-sendiri";

/**
 * ============================================================================
 * DUA BELAS PERMINTAAN LAYAR ANTRIAN SIDANG - YANG BELUM DIJAGA SIAPA PUN
 * ============================================================================
 *
 * Berkas ini lahir dari satu pemeriksaan silang: delapan agen membaca kode dan
 * mencoba menjatuhkan klaim "sudah selesai" atas kedua belas butir. Yang
 * mereka temukan bukan hanya tiga butir yang belum utuh, melainkan juga tiga
 * butir yang SUDAH benar tetapi tidak dijaga satu uji pun - butir 5, 6, dan 8.
 *
 * Perbedaan keduanya penting. Butir yang salah akan ketahuan hari itu juga;
 * butir yang benar tanpa penjaga akan diam-diam dipulangkan bulan depan oleh
 * orang yang menyusun ulang layarnya, dan tidak ada yang berbunyi.
 *
 * Yang dijaga di sini SIFATNYA, bukan bentuknya - urutan bagian, adanya
 * saklar, terbacanya peran tambahan - supaya penataan ulang yang wajar tidak
 * dipaksa merah tanpa sebab.
 */

const AKAR = process.cwd();
const LAYAR = fs.readFileSync(
  path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"),
  "utf8"
);
const PENGGUNA = fs.readFileSync(
  path.join(AKAR, "src/components/portal/aleta-ecourt-pengguna.tsx"),
  "utf8"
);

describe("butir 2 - kolom PUTUSAN tidak lagi berbantah dengan hasil sidangnya", () => {
  /**
   * Keluhan aslinya: 491/Pdt.G/2026 memajang kotak hijau "Hasil sidang - putus
   * DIKABULKAN (verstek)" sementara kolom PUTUSAN baris yang sama berbunyi
   * "putusan belum tercatat". Dua sumber yang tidak sepakat.
   */
  it("menyebut perkaranya SUDAH putus, bukan hanya bahwa pencatatannya belum", () => {
    const i = LAYAR.indexOf("putus (hasil sidang)");
    expect(i, "kolom PUTUSAN tidak menyebut bahwa perkaranya sudah putus").toBeGreaterThan(-1);
  });

  it("keterangan tunggakan pencatatannya TIDAK dihapus", () => {
    // Ia menagih pekerjaan yang memang belum dikerjakan; menghapusnya membuat
    // tunggakan itu tidak terlihat oleh siapa pun.
    expect(LAYAR).toContain("belum tercatat di SIPP");
  });

  it("faktanya DIDAHULUKAN, tunggakannya menyusul", () => {
    // Urutannya yang menentukan bagaimana kolom itu dibaca sekilas.
    const iPutus = LAYAR.indexOf("putus (hasil sidang)");
    const iBelum = LAYAR.indexOf("belum tercatat di SIPP");
    expect(iBelum).toBeGreaterThan(iPutus);
  });

  it("kalimat lama yang berdiri sendirian sudah tidak ada", () => {
    expect(LAYAR).not.toContain(">\n                              putusan belum tercatat\n");
  });
});

describe("butir 3 - tiap kelompok penanda punya saklarnya sendiri", () => {
  it("keempat kelompoknya memang empat yang disebut permintaannya", () => {
    expect(KELOMPOK_KEADAAN.map((k) => k.kunci)).toEqual([
      "panggilan",
      "sidang",
      "putusan",
      "antrian",
    ]);
  });

  it("ada keadaan ciut PER KELOMPOK, bukan satu saklar untuk semuanya", () => {
    expect(LAYAR).toContain("const [kelompokCiut, setKelompokCiut] = useState<string[]>([]);");
    expect(LAYAR).toContain("alihkanKelompokPenanda");
  });

  it("tombol induk tetap ada dan mengatur keempatnya sekaligus", () => {
    // Menghapusnya berarti yang hanya ingin memanjangkan daftar sidang harus
    // menekan empat kali.
    expect(LAYAR).toContain("const alihkanSeluruhPenanda = () => {");
    expect(LAYAR).toContain("setKelompokCiut(ciut ? KELOMPOK_KEADAAN.map((k) => k.kunci) : []);");
  });

  it("kelompok yang seluruh isinya tersembunyi TETAP digambar", () => {
    // Jebakan yang mudah sekali dibuat: membuang kelompok kosong ikut membuang
    // SAKLARNYA, dan kelompok itu tidak akan pernah dapat dibentangkan lagi.
    const i = LAYAR.indexOf("kelompokKeadaanTampak(jumlahKeadaan, keadaanTerpilih)");
    expect(i).toBeGreaterThan(-1);
    const blok = LAYAR.slice(i, i + 900);
    expect(blok).not.toContain(".filter((kelompok) => kelompok.anggota.length > 0)");
    // Jumlah yang disembunyikan dihitung dari anggota SEBELUM diciutkan.
    expect(blok).toContain("const tersembunyi = kelompok.anggota.length - tampak.length;");
  });

  it("yang sedang MENYALA tetap tampak walau kelompoknya diciutkan", () => {
    // Saringan aktif yang hilang dari layar tidak dapat dimatikan lagi.
    expect(LAYAR).toContain(
      "? kelompok.anggota.filter((k) => keadaanTerpilih.includes(k.kunci))"
    );
  });
});

describe("butir 5 - jarak kepala halaman ke judul jadwal", () => {
  it("padding atasnya dipangkas di kedua tempat yang menyusunnya", () => {
    // Tidak ada penjaga sama sekali sebelumnya - siapa pun dapat
    // memulangkannya ke p-4 sm:p-5 tanpa ada yang berbunyi.
    // Sejak 28 Sep 2026 padding SAMPING-nya ikut dibuang supaya menu dan
    // kartu jadwal sejajar tepi kepala dan kaki halaman; atasnya tetap pt-1.
    expect(PENGGUNA).toContain('className="space-y-4 px-0 pb-4 pt-1 sm:pb-5"');
  });
});

describe("butir 6 - tombol ciut tiap bagian di panel Rincian", () => {
  it("tiap bagian memakai komponen Bagian bersama, tidak ada yang dibuat sendiri", () => {
    expect(LAYAR).toContain('from "@/components/portal/bagian-ciut"');
    const pakai = LAYAR.match(/<Bagian\s/g) ?? [];

    // Angkanya dikunci, BUKAN dilonggarkan jadi "lebih dari nol". Yang dijaga
    // di sini bukan banyaknya bagian - itu boleh bertambah - melainkan bahwa
    // tiap bagian baru ikut memakai komponen bersamanya. Penjaga yang hanya
    // menuntut "ada" akan tetap hijau ketika seseorang menambah bagian
    // kesebelas dengan kotak ciut buatan sendiri, dan dua mekanisme ciut yang
    // berdampingan akan saling menyangkal keadaan terbuka/tertutupnya.
    //
    // Bertambah ke 10 pada 2.29.0: bagian "Putusan belum tercatat di SIPP",
    // untuk perkara yang diputus di ruang sidang tetapi baris putusannya
    // belum ada - 12 perkara di SIPP setempat yang sebelumnya membuka rincian
    // yang diam.
    //
    // Bertambah ke 11 pada 2.34.0: bagian "Rincian waktu perkara" - berapa
    // hari sejak didaftarkan, berapa hari mediasi yang dikeluarkan beserta
    // tanggal dan hasilnya, dan berapa sisa sampai batas lima bulan. Angka
    // tunggal tidak dapat dibantah maupun dibuktikan; rinciannya dapat
    // keduanya.
    //
    // TETAP 11 pada 24 September 2026: Rincian waktu perkara DIPINDAH ke
    // paling bawah panel, bukan ditambah; kuncinya kini berakhiran -v2.
    expect(pakai.length).toBe(11);
    expect(LAYAR).toContain('kunci="sidang-durasi-v2"');
  });

  it("kuncinya BERAWALAN sidang- supaya tidak menabrak layar Status Perkara", () => {
    // kunciCiut() memaku satu awalan untuk seluruh pemakai. Dua layar yang
    // memakai kunci sama akan saling menutup bagian, dan tidak ada yang tahu
    // kenapa.
    //
    // Enam kunci berakhiran -v2 sejak 24 September 2026 - lihat "garis batas"
    // di bawah. Daftarnya kini sebelas, bukan sembilan: lebih ketat.
    const KUNCI = [
      "sidang-majelis",
      "sidang-pihak",
      "sidang-relaas-ini",
      "sidang-relaas-riwayat",
      "sidang-jadwal",
      "sidang-putusan-v2",
      "sidang-putus-belum-tercatat-v2",
      "sidang-kesiapan-v2",
      "sidang-ecourt-v2",
      "sidang-berkas-sipp-v2",
      "sidang-durasi-v2",
    ];
    for (const kunci of KUNCI) {
      expect(LAYAR, `kunci ${kunci} hilang`).toContain(`kunci="${kunci}"`);
    }
  });

  // ==========================================================================
  // GARIS BATAS - DIMINTA PENGGUNA 24 SEPTEMBER 2026
  // ==========================================================================
  //
  // Penjaga lama berbunyi "tidak ada yang diciutkan secara bawaan", dan
  // sesudah kuncinya berganti ia justru menjadi HIJAU KOSONG: indexOf kunci
  // lama bernilai -1, irisannya kosong, dan not.toContain atas string kosong
  // selalu lulus. Diganti dengan dua sisi garisnya, masing-masing diukur dari
  // tag - bukan dari kunci yang dapat berganti nama.
  it("yang DI ATAS Seluruh jadwal - dan jadwalnya sendiri - tidak terciut sebagai bawaan", () => {
    // Yang diminta semula KEMAMPUAN menciutkan. Permintaan 24 September 2026
    // mengubahnya HANYA untuk yang di bawah Seluruh jadwal.
    const i = LAYAR.indexOf('kunci="sidang-majelis"');
    const j = LAYAR.indexOf('<Bagian judul="Seluruh jadwal sidang perkara ini"');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(LAYAR.slice(i, j)).not.toContain("ciutBawaan");
    expect(LAYAR).toContain('<Bagian judul="Seluruh jadwal sidang perkara ini" kunci="sidang-jadwal">');
  });

  it("SELURUH bagian sesudah Seluruh jadwal terciut sebagai bawaan", () => {
    // Dihitung dari tag, bukan dari daftar judul: bagian baru di bawah jadwal
    // tanpa ciutBawaan langsung memerahkan ini. RincianSidang fungsi terakhir
    // berkas, jadi irisan sampai akhir berkas hanya memuat panel Rincian.
    const j = LAYAR.indexOf('judul="Seluruh jadwal sidang perkara ini"');
    expect(j).toBeGreaterThan(-1);
    const tag = LAYAR.slice(j).match(/<Bagian\s[^>]*>/g) ?? [];
    expect(tag.length).toBe(6);
    for (const t of tag) expect(t, t).toContain("ciutBawaan");
  });

  it("kunci lama keenam bagian itu tidak kembali", () => {
    // Nama lama menghidupkan lagi simpanan "0" di peramban pemakai lama - dan
    // bawaan barunya diam-diam tidak berlaku bagi mereka.
    for (const lama of [
      "sidang-putusan",
      "sidang-putus-belum-tercatat",
      "sidang-kesiapan",
      "sidang-ecourt",
      "sidang-berkas-sipp",
      "sidang-durasi",
    ]) {
      expect(LAYAR, `kunci lama ${lama} kembali`).not.toContain(`kunci="${lama}"`);
    }
  });

  it("bagian yang terciut menyebut ringkasan isinya di kepalanya", () => {
    // Kesiapan yang terciut tidak boleh menyembunyikan penghambat BERAT tanpa
    // tanda apa pun di kepalanya.
    expect(LAYAR).toMatch(/kunci="sidang-kesiapan-v2" ciutBawaan keterangan=\{keteranganKesiapan\}/);
    expect(LAYAR).toMatch(/kunci="sidang-durasi-v2" ciutBawaan keterangan=\{keteranganWaktu\}/);
  });
});

describe("24 Sep butir 7 - Rincian waktu perkara di paling bawah panel", () => {
  it("adalah bagian PALING BAWAH panel Rincian", () => {
    const iWaktu = LAYAR.indexOf('<Bagian judul="Rincian waktu perkara"');
    expect(iWaktu).toBeGreaterThan(-1);
    expect(iWaktu).toBeGreaterThan(LAYAR.indexOf('judul="Kesiapan sidang dan panggilan para pihak"'));
    expect(iWaktu).toBeGreaterThan(LAYAR.indexOf('judul="Berkas tersimpan di SIPP"'));
    // Tidak ada bagian sesudahnya.
    expect(LAYAR.lastIndexOf("<Bagian ")).toBe(iWaktu);
  });

  it("dan tidak lagi di antara Riwayat panggilan dan Seluruh jadwal", () => {
    const iRiwayat = LAYAR.indexOf('judul="Riwayat panggilan sebelumnya"');
    const iJadwal = LAYAR.indexOf('judul="Seluruh jadwal sidang perkara ini"');
    expect(iRiwayat).toBeGreaterThan(-1);
    expect(LAYAR.slice(iRiwayat, iJadwal)).not.toContain('judul="Rincian waktu perkara"');
  });
});

describe("butir 8 - urutan bagian di panel Rincian", () => {
  it("Seluruh jadwal sidang berada DI BAWAH Riwayat panggilan sebelumnya", () => {
    // Tidak dijaga satu uji pun sebelumnya; siapa pun yang menyusun ulang
    // panel Rincian dapat memindahkannya kembali tanpa ada yang berbunyi.
    const iRiwayat = LAYAR.indexOf('judul="Riwayat panggilan sebelumnya"');
    const iJadwal = LAYAR.indexOf('judul="Seluruh jadwal sidang perkara ini"');
    expect(iRiwayat).toBeGreaterThan(-1);
    expect(iJadwal).toBeGreaterThan(iRiwayat);
  });

  it("dan tetap DI ATAS Putusan dan tindak lanjutnya", () => {
    const iJadwal = LAYAR.indexOf('judul="Seluruh jadwal sidang perkara ini"');
    const iPutusan = LAYAR.indexOf('judul="Putusan dan tindak lanjutnya"');
    expect(iPutusan).toBeGreaterThan(iJadwal);
  });
});

describe("butir 7 - penandanya merah, dan tetap bertanda tanya", () => {
  it("merah, sesuai permintaan", () => {
    const i = LAYAR.indexOf("diterima pihak lawan?");
    expect(i).toBeGreaterThan(-1);
    const sebelum = LAYAR.slice(Math.max(0, i - 700), i);
    expect(sebelum).toContain("bg-red-600");
    expect(sebelum).not.toContain("bg-amber-100");
  });

  it("tanda tanyanya tetap - warnanya boleh menuntut, kalimatnya tidak menuduh", () => {
    expect(LAYAR).toContain("diterima pihak lawan?");
  });
});

describe("butir 10 - konseptor sementara DI BAWAH status", () => {
  it("tombolnya dirender sesudah cabang status, bukan sebelumnya", () => {
    // Permintaannya "tombol di bawah status". Semula ia terpasang di puncak
    // sel, sehingga tunjukan tangan mendahului fakta yang datang dari SIPP.
    const iStatus = LAYAR.indexOf('<span className="text-muted-foreground">belum putus</span>');
    const iTombol = LAYAR.indexOf("<SelKonseptorSementara");
    expect(iStatus, "cabang status tidak ketemu").toBeGreaterThan(-1);
    expect(iTombol, "tombol konseptor ada DI ATAS status").toBeGreaterThan(iStatus);
  });

  it("hanya satu tempat yang merendernya", () => {
    expect((LAYAR.match(/<SelKonseptorSementara/g) ?? []).length).toBe(1);
  });
});

describe("butir 11 - operator/penjaga sidang adalah peran TAMBAHAN", () => {
  /**
   * Cacat nyata yang kegagalannya diam. mock-data.ts menyebut operator harfiah
   * sebagai "penjaga sidang yang mengoperasikan SIPP dari ruang sidang" dan
   * menegaskan ia "dipasang lewat peran tambahan pada akun, bukan menggantikan
   * perannya".
   *
   * Penyaring yang hanya membaca peran UTAMA karena itu menyaring justru orang
   * yang diminta melihat semuanya - dan hasilnya hanya tampak sebagai daftar
   * yang lebih pendek.
   */
  it("peran tambahan operator membuka seluruh daftar", () => {
    expect(peranLihatSemua("staf", ["operator"])).toBe(true);
    expect(peranLihatSemua("panitera-pengganti", ["operator"])).toBe(true);
  });

  it("peran utama pun tetap berlaku", () => {
    expect(peranLihatSemua("super-admin", [])).toBe(true);
    expect(peranLihatSemua("admin", null)).toBe(true);
    expect(peranLihatSemua("operator", [])).toBe(true);
  });

  it("peran biasa tetap tersaring", () => {
    expect(peranLihatSemua("hakim", ["pelaksana"])).toBe(false);
    expect(peranLihatSemua("jurusita", [])).toBe(false);
  });

  it("penyaringnya sungguh memakainya - bukan hanya fungsinya yang ada", () => {
    const DAFTAR = [
      { majelisNama: "Mazidah, S.Ag., M.H.", paniteraNama: "", jurusitaNama: "" },
      { majelisNama: "Drs. M. Tang, M.H.", paniteraNama: "", jurusitaNama: "" },
    ];
    const hasil = saringPerkaraSendiri(
      DAFTAR,
      { nama: "Mazidah", peran: "staf", peranTambahan: ["operator"] },
      true
    );
    expect(hasil.baris.length, "penjaga sidang justru ikut tersaring").toBe(2);
    expect(hasil.berlaku).toBe(false);
  });

  it("layar meneruskan additionalRoleIds, bukan hanya roleId", () => {
    expect(LAYAR).toContain("peranTambahan: currentUser.additionalRoleIds ?? []");
  });
});
