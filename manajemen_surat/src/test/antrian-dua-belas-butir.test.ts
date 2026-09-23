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
    expect(PENGGUNA).toContain('className="space-y-4 p-4 pt-1 sm:p-5 sm:pt-1"');
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
    expect(pakai.length).toBe(11);
    expect(LAYAR).toContain('kunci="sidang-durasi"');
  });

  it("kuncinya BERAWALAN sidang- supaya tidak menabrak layar Status Perkara", () => {
    // kunciCiut() memaku satu awalan untuk seluruh pemakai. Dua layar yang
    // memakai kunci sama akan saling menutup bagian, dan tidak ada yang tahu
    // kenapa.
    const KUNCI = [
      "sidang-majelis",
      "sidang-pihak",
      "sidang-relaas-ini",
      "sidang-relaas-riwayat",
      "sidang-jadwal",
      "sidang-putusan",
      "sidang-kesiapan",
      "sidang-ecourt",
      "sidang-berkas-sipp",
    ];
    for (const kunci of KUNCI) {
      expect(LAYAR, `kunci ${kunci} hilang`).toContain(`kunci="${kunci}"`);
    }
  });

  it("tidak ada yang diciutkan secara bawaan", () => {
    // Yang diminta KEMAMPUAN menciutkan, bukan layar yang tiba-tiba
    // menyembunyikan isinya.
    const i = LAYAR.indexOf('kunci="sidang-majelis"');
    const blokSembilan = LAYAR.slice(i, LAYAR.indexOf('kunci="sidang-berkas-sipp"') + 200);
    expect(blokSembilan).not.toContain("ciutBawaan");
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
