import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  KUNCI_SIMPANAN_TAMPILAN,
  SAKLAR_TAMPILAN,
  SAKLAR_WAJIB,
  bacaTampilan,
  jumlahDimatikan,
  kelompokTampilan,
  tampil,
  tampilanBawaan,
  tampilanSemuaMati,
} from "@/lib/tampilan-antrian-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

/**
 * Saklar yang BOLEH mati sejak awal - disebut satu per satu, dengan sengaja.
 *
 * Keduanya diminta pengguna 22 September 2026, dan keduanya punya sifat yang
 * sama: yang hilang bukan FAKTA tentang perkara, melainkan kalimat yang
 * menerangkan cara ALETA menghitung. Kolom Siap pun kosong sampai tombol
 * Hitung skor ditekan.
 *
 * Daftarnya dikunci di sini supaya "bawaanMati" tidak menjadi jalan pintas
 * yang dipakai lagi pada perapian berikutnya. Bawaan yang mematikan penanda
 * menghilangkan sesuatu dari layar orang yang tidak pernah meminta apa pun -
 * dan hilangnya tidak berbunyi.
 */
// "ciutkan-selesai" (6 Okt 2026, butir 8): pengguna sendiri meminta "jangan jadikan default".
const BOLEH_MATI_SEJAK_AWAL = ["kolom-siap", "catatan-cara-hitung", "ciutkan-selesai"];

describe("saklar tampilan", () => {
  it("bawaannya menyala, kecuali dua yang disebut pengguna", () => {
    const bawaan = tampilanBawaan();
    for (const saklar of SAKLAR_TAMPILAN) {
      expect(
        bawaan[saklar.kunci],
        `saklar ${saklar.kunci} berubah bawaannya tanpa disebut`
      ).toBe(!BOLEH_MATI_SEJAK_AWAL.includes(saklar.kunci));
    }
  });

  it("yang boleh mati sejak awal hanya dua itu - tidak boleh bertambah diam-diam", () => {
    const mati = SAKLAR_TAMPILAN.filter((x) => x.bawaanMati).map((x) => x.kunci);
    expect([...mati].sort()).toEqual([...BOLEH_MATI_SEJAK_AWAL].sort());
  });

  it("yang wajib tidak boleh sekaligus bawaanMati", () => {
    // Saklar wajib selalu dipaksa menyala oleh tampil(); menandainya
    // bawaanMati membuat tampilanBawaan() dan tampil() menjawab berbeda untuk
    // kunci yang sama, dan yang membaca salah satunya akan keliru.
    for (const saklar of SAKLAR_TAMPILAN) {
      if (saklar.wajib) expect(saklar.bawaanMati ?? false).toBe(false);
    }
  });

  it("kuncinya tidak ada yang kembar", () => {
    // Kunci kembar membuat dua saklar berbeda menulis ke ruas simpanan yang
    // sama, dan yang kedua diam-diam mengendalikan keduanya.
    const kunci = SAKLAR_TAMPILAN.map((x) => x.kunci);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("tiap saklar punya keterangan yang sungguh menerangkan", () => {
    for (const saklar of SAKLAR_TAMPILAN) {
      expect(saklar.label.length).toBeGreaterThan(2);
      expect(saklar.keterangan.length).toBeGreaterThan(20);
    }
  });

  it("tiap saklar duduk di kelompok yang sungguh ada", () => {
    const kelompok = kelompokTampilan();
    const jumlah = kelompok.reduce((n, k) => n + k.anggota.length, 0);
    expect(jumlah).toBe(SAKLAR_TAMPILAN.length);
    for (const k of kelompok) expect(k.anggota.length).toBeGreaterThan(0);
  });
});

describe("yang mendesak tidak dapat dimatikan", () => {
  // Keempat pertama disebut pengguna satu per satu. Penjaga ini ada supaya
  // semuanya tidak berpindah ke daftar yang dapat dimatikan pada suatu
  // perapian di kemudian hari - dan hilangnya tidak akan berbunyi apa pun
  // sampai satu sidang batal atau satu berkas tidak pernah dijahit.
  //
  // Menjadi ENAM pada 24 September 2026:
  //   tenggang-mepet           kotak merah sejak 2.34.0 yang lupa didaftarkan
  //                            - panel saklar diam tentangnya satu rilis penuh
  //   belum-tunda-lewat-batas  diminta pengguna: sidang yang lewat 15:00 WITA
  //                            dan hasilnya belum dicatat
  // Tetap dikunci toEqual - daftar persis, bukan "sekurangnya".
  const WAJIB = [
    "retur",
    "belum-dipanggil",
    "tenggang-mepet",
    "belum-minutasi",
    "belum-unggah-putusan",
    "belum-tunda-lewat-batas",
    // 6 Okt 2026 (butir 21): kotak merah Court Calendar tidak sinkron.
    "cc-tidak-sinkron",
  ];

  it("ketujuhnya bertanda wajib", () => {
    for (const kunci of WAJIB) {
      const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(saklar, `saklar ${kunci} hilang dari daftar`).toBeDefined();
      expect(saklar?.wajib, `saklar ${kunci} tidak lagi wajib`).toBe(true);
    }
    expect([...SAKLAR_WAJIB].sort()).toEqual([...WAJIB].sort());
  });

  it("tampil() menyalakannya walau simpanannya berkata false", () => {
    // Simpanan peramban dapat disunting lewat DevTools. Sebuah nilai false di
    // sana tidak boleh cukup untuk memadamkan penanda retur.
    const jahat = Object.fromEntries(WAJIB.map((k) => [k, false]));
    for (const kunci of WAJIB) {
      expect(tampil(jahat, kunci)).toBe(true);
    }
  });

  it("bacaTampilan menolak mematikannya dari simpanan", () => {
    const hasil = bacaTampilan(JSON.stringify({ retur: false, "belum-minutasi": false }));
    expect(hasil.retur).toBe(true);
    expect(hasil["belum-minutasi"]).toBe(true);
  });

  it("tidak ikut terhitung pada angka 'berapa yang dimatikan'", () => {
    const jahat = Object.fromEntries(SAKLAR_TAMPILAN.map((x) => [x.kunci, false]));
    // Yang wajib tidak pernah benar-benar mati, jadi menghitungnya akan
    // memajang angka yang tidak sesuai dengan apa yang hilang dari layar.
    //
    // Yang bawaannya memang mati juga tidak dihitung, dan sebabnya sejenis:
    // angka itu berbunyi "ada yang Anda sembunyikan". Menyalakannya pada layar
    // yang belum pernah disetel siapa pun membuatnya berbunyi tanpa sebab -
    // dan lencana yang selalu menyala berhenti dibaca.
    expect(jumlahDimatikan(jahat)).toBe(
      SAKLAR_TAMPILAN.length - SAKLAR_WAJIB.length - BOLEH_MATI_SEJAK_AWAL.length
    );
  });

  it("yang bawaannya mati TETAP dapat dinyalakan dan dihitung sesudahnya", () => {
    // Kalau menyalakannya tidak berpengaruh, saklarnya hanya hiasan.
    for (const kunci of BOLEH_MATI_SEJAK_AWAL) {
      expect(tampil({ [kunci]: true }, kunci), `${kunci} tidak dapat dinyalakan`).toBe(true);
      expect(tampil({}, kunci), `${kunci} menyala padahal bawaannya mati`).toBe(false);
    }
  });

  it("saklarnya TETAP digambar - tidak dibuang dari daftar", () => {
    // Menghilangkannya membuat orang mengira penandanya sudah tidak ada lagi,
    // lalu mencarinya di tempat yang salah.
    const semua = kelompokTampilan().flatMap((k) => k.anggota.map((x) => x.kunci));
    for (const kunci of WAJIB) expect(semua).toContain(kunci);
  });
});

describe("tampil()", () => {
  it("tanpa pilihan sama sekali - semuanya menyala", () => {
    expect(tampil(undefined, "saksi")).toBe(true);
  });

  it("saklar yang BARU ditambahkan menyala walau simpanannya lama", () => {
    // Simpanan yang ditulis versi sebelumnya tidak memuat kunci baru. Yang
    // tidak terbaca harus menyala; kalau tidak, tiap penanda baru lahir dalam
    // keadaan padam bagi seluruh pemakai lama.
    expect(tampil({ saksi: false }, "kuasa")).toBe(true);
  });

  it("yang dimatikan sungguh mati", () => {
    expect(tampil({ saksi: false }, "saksi")).toBe(false);
  });
});

describe("bacaTampilan", () => {
  it("simpanan kosong memakai bawaan", () => {
    expect(bacaTampilan(null)).toEqual(tampilanBawaan());
  });

  it("JSON rusak tidak melempar - memakai bawaan", () => {
    // Simpanan yang rusak tidak boleh membuat layarnya gagal digambar sama
    // sekali. Yang hilang cukup pilihannya.
    expect(bacaTampilan("{bukan json")).toEqual(tampilanBawaan());
    expect(bacaTampilan("[1,2,3]")).toEqual(tampilanBawaan());
    expect(bacaTampilan("null")).toEqual(tampilanBawaan());
  });

  it("ruas asing dibuang, bukan dipercaya", () => {
    const hasil = bacaTampilan(JSON.stringify({ saksi: false, "entah-apa": false }));
    expect(hasil.saksi).toBe(false);
    expect(hasil["entah-apa"]).toBeUndefined();
  });

  it("nilai yang bukan boolean diabaikan", () => {
    const hasil = bacaTampilan(JSON.stringify({ saksi: "tidak", kuasa: 0 }));
    expect(hasil.saksi).toBe(true);
    expect(hasil.kuasa).toBe(true);
  });
});

describe("24 Sep - saklar untuk yang baru, dan Sembunyikan semua", () => {
  const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

  it("tiap kotak keadaan MERAH di layar punya saklar wajib yang sekunci", () => {
    // Wajib mengikuti warna, bukan ingatan. Tenggang mepet pernah lolos
    // karena daftar ini ditulis tangan.
    const awal = layar.indexOf("const KEADAAN_DASAR: KeadaanSidang[] = [");
    const akhir = layar.indexOf("const KEADAAN_MENUNTUT_TINDAKAN");
    expect(awal).toBeGreaterThan(-1);
    expect(akhir).toBeGreaterThan(awal);
    const pola = /kunci: "([a-z-]+)",\s*label: "[^"]+",\s*(?:labelPendek: "[^"]+",\s*)?nada: "([a-z]+)"/g;
    let merah = [...layar.slice(awal, akhir).matchAll(pola)]
      .filter((m) => m[2] === "bahaya")
      .map((m) => m[1]);
    // Putusan e-Court tertulis merah tetapi dimatikan keras; begitu
    // dinyalakan, pengecualian ini gugur sendiri.
    if (layar.includes("const TAMPILKAN_PUTUSAN_ECOURT = false;")) {
      merah = merah.filter((k) => k !== "putusan-ecourt");
    }
    expect(merah.length, "pola tidak menangkap kotak").toBeGreaterThanOrEqual(5);
    for (const k of merah) expect(SAKLAR_WAJIB, `kotak merah ${k} tanpa saklar wajib`).toContain(k);
  });

  it("anggota berjam Perlu diperiksa juga wajib, dan TIDAK dipakai menggambar", () => {
    // Tanda merah Belum ditunda hanya hidup sesudah 15:00 pada hari sidangnya;
    // saklar mati yang tersimpan akan membuatnya bisu tepat pada saat itu.
    expect(SAKLAR_WAJIB).toContain("belum-tunda-lewat-batas");
    expect(layar).not.toContain('tampil(tampilan, "belum-tunda-lewat-batas")');
    expect(layar).toContain("{belumTundaLewatBatas(baris, saat) ? (");
  });

  it("Perlu diperiksa sendiri TIDAK punya saklar - ia daftar pekerjaan hari itu", () => {
    expect(SAKLAR_TAMPILAN.find((x) => x.kunci === "perlu-diperiksa")).toBeUndefined();
  });

  it("saklar untuk penanda dan tombol yang baru ada", () => {
    for (const kunci of [
      "agenda-elitigasi",
      "umur-perkara",
      "menunggu-lama",
      "urutan-sidang",
      "hasil-tundaan",
      "rincian-antrian",
      "tombol-tunda-putus",
      "tombol-mediator",
      "ambil-antrian",
      "tunjuk-konseptor",
      "keterangan-perkara",
    ]) {
      const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(saklar, `saklar ${kunci} hilang`).toBeDefined();
      expect(saklar?.wajib ?? false, kunci).toBe(false);
      expect(saklar?.bawaanMati ?? false, kunci).toBe(false);
    }
    // 20 sebelum 24 September 2026 (dihitung dari HEAD 8489ebf, bukan
    // dikira); 20 + 2 wajib + 11 yang dapat dimatikan. 34 sejak 2 Okt 2026
    // sore: + "tanda-antrian-online" (butir 4, dijaga
    // jadwal-sidang-antrian-online.test.ts). 35 sejak 6 Okt 2026: +
    // "saring-ruang" (butir 5, dijaga jadwal-sidang-6okt.test.ts). 40 sejak
    // butir 10 6 Okt 2026: + verifikasi-majelis, penanda-mediasi, hasil-mediasi,
    // pembebanan-ikrar, court-calendar. 41: + cc-tidak-sinkron (butir 21).
    // 42: + penanda-jawaban (butir 4 6 Okt 2026, eksepsi & rekonvensi;
    // dijaga penanda-jawaban.test.ts).
    // 45 sejak 6 Okt 2026 sore: + ciutkan-selesai (butir 8, bawaan mati),
    // tombol-penetapan-kembali, tombol-kasir (butir 9).
    // 46 sejak 7 Okt 2026: + tarik-belum-upload (penanda belum upload dapat
    // ditekan; dijaga jadwal-sidang-belum-upload-tarik.test.tsx).
    // 47 sejak 1.189.x (10 Okt 2026): + tombol-kasir-harian (Kasir massal,
    // rekap, pengingat; dijaga kasir-otomatis.test.ts).
    // 53 sejak 12 Okt 2026: + penanda-perkara, penanda-pekerjaan, kumulasi-perkara,
    // mediator-majelis, panggil-saksi, kartu-ruang (antrian sidang butir 1-7).
    // 60 sejak agen C (12 Okt 2026, butir 7 - audit fitur tanpa saklar): + penanda-verzet,
    // lencana-putusan-ecourt, pihak-turut-intervensi, tombol-status-perkara,
    // tombol-ruang-sidang, tombol-selesai-sidang, tombol-cetak-relaas (7 saklar,
    // dijaga jadwal-sidang-12okt-agen-c.test.tsx). Hitungan 53 + 7: BELUM memuat
    // tambahan agen A/B bila ada saklar baru dari mereka - jumlahkan saat menggabung.
    // 61 sejak agen H (12 Okt 2026, butir 18): + pihak-hadir (nama pihak hijau + "(hadir)",
    // dijaga pihak-hadir-12okt.test.tsx). Angka ini hanya menambah satu atas 60; saklar
    // agen A/B yang baru, bila ada, dijumlahkan saat menggabung.
    // 62 sejak agen L (12 Okt 2026, butir 25): + pernah-diskors (dijaga pernah-diskors-12okt.test.tsx).
    // 63 sejak agen K (12 Okt 2026, butir 22-24): + penanda-sita (lencana Sita di kolom
    // Agenda + bagian sita & eksekusi di rincian/Status Perkara, dijaga penanda-sita-12okt.test.ts).
    // 64 sejak agen N (12 Okt sore, keputusan 5): + penanda-eksekusi (bagian Eksekusi di rincian &
    // Status Perkara dipisah dari penanda-sita yang kini hanya Sita; dijaga penanda-sita-12okt.test.ts).
    // 65 sejak F3.2 (17 Okt 2026): + kehadiran-rinci (dijaga kehadiran-rinci-f32.test.tsx).
    // 74 sejak 18 Okt 2026 (audit fitur tanpa saklar, permintaan hakim): + 9 yang sudah tampil tetapi belum
    // punya baris di panel: pertanyaan-saksi, tombol-isi-ikrar, ikrar-selesai, kesiapan-putusan,
    // draf-putusan-agen, checklist-konseptor, sedang-berjalan, ringkasan-ruang, tombol-layar-penuh
    // (dijaga checklist-tampilan-18okt.test.ts, yang juga menjaga bahwa tiap fitur di layar punya baris).
    // 75 sejak 19 Okt 2026 (JADWAL-3 butir 4): + saksi-lipat (nama saksi terlipat bawaan).
    // 76 sejak 19 Okt 2026 (JADWAL-3 tambahan B): + tombol-blangko.
    // 92 sejak 22 Okt 2026 (W57): + 16 unsur yang sudah tampil tetapi belum punya saklar
    // (tautan-jadwal, tombol-tunda-otomatis, tombol-perkara-saya, identitas-pembuka,
    // tombol-kalender-sidang, kalender-libur, tanggal-dan-jumlah, tanda-diperbarui,
    // pencarian-lanjutan, menu-per-panitera, menu-pengingat-kasir, saklar-sidang-keliling,
    // pilih-hakim-baris, status-putusan, warna-baris, jam-dipanggil) - dijaga
    // saklar-tampilan-lengkap-22okt.test.tsx.
    expect(SAKLAR_TAMPILAN.length).toBe(92);
  });

  it("saklar yang hanya hidup di satu mode MENYEBUT modenya", () => {
    // Saklar yang tidak mengubah apa pun di mode yang sedang dipakai tampak
    // rusak - "petugas" pernah diam soal itu.
    for (const kunci of ["belum-bas", "tidak-dipanggil", "petugas"]) {
      expect(SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)?.keterangan, kunci).toContain("mode Ringkas");
    }
    for (const kunci of ["kolom-siap", "tunjuk-konseptor", "keterangan-perkara"]) {
      expect(SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)?.keterangan, kunci).toContain("mode Lengkap");
    }
  });

  it("yang KOSONG disembunyikan, isinya tidak", () => {
    // Tunjukan dan keterangan yang sudah ditulis untuk orang berikutnya tidak
    // boleh hilang oleh saklar orang sebelumnya di komputer bersama.
    const iK = layar.indexOf("function SelKonseptorSementara(");
    const blokK = layar.slice(iK, layar.indexOf("function BorangKonseptorSementara(", iK));
    const pulang = blokK.indexOf("if (!terbuka && !tunjukan?.nama && !tampilKosong) return null;");
    expect(pulang).toBeGreaterThan(-1);
    // Sesudah seluruh hook - urutan hook tidak boleh berubah antar gambar.
    expect(pulang).toBeGreaterThan(blokK.lastIndexOf("useState("));
    const iT = layar.indexOf("function SelKeteranganPerkara(");
    const blokT = layar.slice(iT, layar.indexOf("function BorangKeteranganPerkara(", iT));
    expect(blokT).toContain("if (!terbuka && !adaIsi && !tampilKosong) return null;");
  });

  it("Sembunyikan semua mematikan yang dapat dimatikan, yang wajib tetap menyala", () => {
    const mati = tampilanSemuaMati();
    for (const saklar of SAKLAR_TAMPILAN) {
      expect(tampil(mati, saklar.kunci), saklar.kunci).toBe(Boolean(saklar.wajib));
    }
    expect(jumlahDimatikan(mati)).toBe(
      SAKLAR_TAMPILAN.length - SAKLAR_WAJIB.length - BOLEH_MATI_SEJAK_AWAL.length
    );
    expect(layar).toContain("Sembunyikan semua");
    expect(layar).toContain("const baru = tampilanSemuaMati();");
  });

  it("jumlah yang wajib tidak ditulis tangan di panel", () => {
    expect(layar).not.toMatch(/Mengapa (empat|lima|enam|tujuh) penanda/);
    expect(layar).toContain("SAKLAR_TAMPILAN.filter((x) => x.wajib)");
  });
});

describe("layarnya sungguh memakai saklarnya", () => {
  const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

  it("tiap saklar yang dapat dimatikan sungguh dipakai menggambar", () => {
    // Penjaga terpenting berkas ini. Saklar yang ada di daftar tetapi tidak
    // pernah dipanggil akan tergambar di panel, dapat ditekan, tersimpan - dan
    // tidak mengubah apa pun. Itu lebih buruk daripada tidak ada saklarnya:
    // orangnya menyangka sudah mematikan sesuatu.
    for (const saklar of SAKLAR_TAMPILAN) {
      if (saklar.wajib) continue;
      expect(
        layar.includes(`tampil(tampilan, "${saklar.kunci}")`),
        `saklar ${saklar.kunci} tidak dipakai di layar`
      ).toBe(true);
    }
  });

  it("yang WAJIB tidak pernah dipakai menggambar", () => {
    // Kebalikannya, dan sama pentingnya: memanggil tampil() untuk yang wajib
    // berarti seseorang menyiapkan jalan untuk mematikannya.
    for (const kunci of SAKLAR_WAJIB) {
      expect(
        layar.includes(`tampil(tampilan, "${kunci}")`),
        `saklar wajib ${kunci} dipakai menggambar - ia tidak boleh dapat dimatikan`
      ).toBe(false);
    }
  });

  it("kunci simpanannya dipakai apa adanya, bukan diketik ulang", () => {
    expect(layar).toContain("KUNCI_SIMPANAN_TAMPILAN");
    expect(layar).not.toContain(`"${KUNCI_SIMPANAN_TAMPILAN}"`);
  });

  it("panelnya punya jalan kembali ke keadaan semula", () => {
    // Tanpa ini, orang yang mematikan sepuluh saklar harus mengingat yang mana
    // saja untuk mengembalikannya.
    expect(layar).toContain("setelUlangTampilan");
    expect(layar).toContain("Nyalakan semua");
  });
});
