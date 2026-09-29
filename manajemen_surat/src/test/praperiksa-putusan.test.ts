// @vitest-environment node
/**
 * Tahap 2 rencana agen: praperiksa putusan - agen yang membaca dan BERHENTI.
 *
 * ============================================================================
 * YANG DIJAGA: TINGKAT HENTIKAN HANYA UNTUK YANG DIBUKTIKAN
 * ============================================================================
 *
 * Agen yang terlalu sering menahan akan dilewati pada hari ketiga, dan sejak
 * itu ia tidak menahan apa pun. Karena itu tiap uji di sini memeriksa dua
 * arah sekaligus: pertentangan yang dibuktikan dari SIPP MENAHAN, dan hal
 * yang tidak dapat dipastikan mesin TIDAK menahan - ia perhatian.
 *
 * Angka pada aturannya diukur atas 1.643 putusan 2025-2026 di sipp_donggala
 * setempat (D:/aleta-dev/kerja/ukur-aturan-praperiksa.js): tanggal putusan
 * selalu hari sidang (1.643/1.643), kata kerja amar berpadanan dengan status
 * (1.642/1.643 - yang satu memang keliru), verstek disebut amar hanya pada
 * 871/936 (maka verstek tidak pernah menahan).
 *
 * Nama orang di sini karangan.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  bakukanNomor,
  namaOrangDalam,
  nilaiPraperiksa,
  nomorPerkaraDalam,
  pecahButirBernomor,
  raporTanpaFakta,
  samakanNama,
  tanggalIso,
  type FaktaPraperiksa,
  type Tingkat,
  type UsulanPutusan,
} from "@/lib/praperiksa-putusan";

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const svc = require_(path.join(AKAR, "aleta_bot/services/praperiksaPutusanService.js"));

// ── Fakta karangan yang meniru bentuk jawaban bot ───────────────────────────
const NOMOR = "123/Pdt.G/2026/PA.Dgl";

function fakta(ubahan: Partial<FaktaPraperiksa> = {}): FaktaPraperiksa {
  return {
    nomorPerkara: NOMOR,
    perkaraId: 10001,
    jenisPerkara: "Cerai Gugat",
    petitum:
      "<div>Primer</div><div>1. Mengabulkan gugatan Penggugat;</div>" +
      "<div>2. Menjatuhkan talak satu ba&#39;in shughra Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah);</div>" +
      "<div>3. Membebankan biaya perkara menurut hukum;</div>" +
      "<div>Subsidair</div><div>Mohon putusan yang seadil-adilnya.</div>",
    pihak: [
      { nama: "Nurhayati binti Abdullah", pihakKe: 1, peran: "penggugat" },
      { nama: "Rahmat bin Sulaiman", pihakKe: 2, peran: "tergugat" },
    ],
    anak: ["Aisyah binti Rahmat"],
    majelis: [
      { nama: "Hasanuddin, S.H.I., M.H.", jabatan: "Hakim Ketua", urutan: 1 },
      { nama: "Rusli Amin, S.H.", jabatan: "Hakim Anggota", urutan: 2 },
      { nama: "Marwah, S.H.I.", jabatan: "Hakim Anggota", urutan: 3 },
    ],
    panitera: ["Munir, S.H."],
    jadwal: [
      { tanggalSidang: "2026-08-26", agenda: "Sidang Pertama", ditunda: true, urutan: 1 },
      { tanggalSidang: "2026-09-09", agenda: "Panggil Tergugat", ditunda: false, urutan: 2 },
    ],
    putusan: { ada: false, tanggalPutusan: "", statusPutusan: "", verstek: "" },
    ecourt: { terdaftar: true, pihak: [] },
    libur: null,
    hariIni: "2026-09-14",
    tidakTerbaca: [],
    ...ubahan,
  };
}

const AMAR_KABUL =
  "MENGADILI\n" +
  "1. Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;\n" +
  "2. Mengabulkan gugatan Penggugat secara verstek;\n" +
  "3. Menjatuhkan talak satu ba'in shughra Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah);\n" +
  "4. Membebankan kepada Penggugat untuk membayar biaya perkara sejumlah Rp385.000,00;";

const NASKAH_LENGKAP =
  `PUTUSAN\nNomor ${NOMOR}\n\nDEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA\n\n` +
  `AMAR\n${AMAR_KABUL}\n\nPENUTUP\n` +
  "Demikian diputuskan dalam musyawarah Majelis Hakim pada hari Rabu, 9 September 2026,\n" +
  "oleh Hasanuddin, S.H.I., M.H. sebagai Ketua Majelis, Rusli Amin, S.H. dan Marwah, S.H.I. masing-masing sebagai Hakim Anggota,\n" +
  "dengan didampingi Munir, S.H. sebagai Panitera Sidang.";

function usulan(ubahan: Partial<UsulanPutusan> = {}): UsulanPutusan {
  return {
    nomorPerkara: NOMOR,
    tanggalPutusan: "09/09/2026",
    statusPutusan: "Dikabulkan",
    verstek: "Y",
    amar: AMAR_KABUL,
    naskah: NASKAH_LENGKAP,
    ...ubahan,
  };
}

const kode = (rapor: ReturnType<typeof nilaiPraperiksa>, tingkat?: string) =>
  rapor.temuan.filter((t) => !tingkat || t.tingkat === tingkat).map((t) => t.kode);

// ============================================================================
describe("pembantu murni", () => {
  it("tanggal blangko dd/mm/yyyy dan ISO dibaca sama; yang tidak sah kosong, bukan ditebak", () => {
    expect(tanggalIso("09/09/2026")).toBe("2026-09-09");
    expect(tanggalIso("9-9-2026")).toBe("2026-09-09");
    expect(tanggalIso("2026-09-09")).toBe("2026-09-09");
    expect(tanggalIso("2026-09-09T16:00:00.000Z")).toBe("2026-09-09");
    expect(tanggalIso("31/02/2026")).toBe("");
    expect(tanggalIso("kemarin")).toBe("");
    expect(tanggalIso("")).toBe("");
  });

  it("butir bernomor dipecah; kepala daftar 'Primer'/'Subsidair'/'MENGADILI' bukan butir; baris tanpa nomor menyambung", () => {
    const butir = pecahButirBernomor("Primer\n1. Mengabulkan gugatan;\n2. Menjatuhkan talak\nsatu ba'in shughra;\n3. Biaya menurut hukum.\nSubsidair\nMohon putusan yang seadil-adilnya.");
    expect(butir.map((b) => b.nomor)).toEqual([1, 2, 3, 4]);
    expect(butir[1].teks).toBe("Menjatuhkan talak satu ba'in shughra;");
    // Baris tanpa nomor sesudah "Subsidair" adalah tuntutannya sendiri, bukan
    // sambungan butir primer terakhir.
    expect(butir[2].teks).toBe("Biaya menurut hukum.");
    expect(butir[3].teks).toBe("Mohon putusan yang seadil-adilnya.");
    expect(pecahButirBernomor("MENGADILI\n1) A\n(2) B")).toHaveLength(2);
  });

  it("nama dibandingkan tanpa gelar dan tanda baca - SIPP dan naskah mengeja gelarnya berbeda", () => {
    expect(samakanNama("Sudarmin H.I.M. Tang, S.H.I.,M.H")).toBe(samakanNama("Sudarmin H.I.M. Tang, S.H.I., M.H."));
    expect(samakanNama("Drs. H. Rusli Amin, S.H.")).toBe("rusli amin");
  });

  it("nama orang dikenali dari bin/binti; sebutan pihak di depannya dibuang; kalimat sebelumnya tidak tersapu", () => {
    const nama = namaOrangDalam(
      "Menjatuhkan talak satu ba'in shughra Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah);"
    );
    expect(nama).toEqual(["Rahmat bin Sulaiman", "Nurhayati binti Abdullah"]);
    // Amar yang SELURUHNYA KAPITAL: kata kerja dan kata sambung di sekitar
    // nama dibuang, sehingga yang tersisa namanya.
    expect(namaOrangDalam("MENETAPKAN ANAK BERNAMA AISYAH BINTI RAHMAT DALAM ASUHAN PENGGUGAT")).toEqual(["AISYAH BINTI RAHMAT"]);
    expect(namaOrangDalam("tidak ada nama di sini")).toEqual([]);
  });

  it("nomor perkara yang disebut teks dibakukan", () => {
    expect(nomorPerkaraDalam("pencabutan perkara Nomor 539/Pdt.G/2026/PA.Dgl dan 12/Pdt.P/2025/PA.Dgl")).toEqual([
      "539/pdt.g/2026/pa.dgl",
      "12/pdt.p/2025/pa.dgl",
    ]);
    expect(bakukanNomor(" 539 / Pdt.G / 2026 / PA.Dgl ")).toBe("539/pdt.g/2026/pa.dgl");
  });
});

// ============================================================================
describe("rapor yang selaras tidak menahan - dan menyebut apa yang diperiksanya", () => {
  it("draf yang cocok dengan SIPP: nol hentikan, pemeriksaan pasti seluruhnya dijalankan", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan());
    expect(rapor.hentikan).toBe(false);
    expect(kode(rapor, "hentikan")).toEqual([]);
    for (const nama of ["sudah-putus", "tanggal-putusan", "status-vs-amar", "verstek", "amar-vs-petitum", "nama-vs-pihak", "nomor-perkara", "majelis"]) {
      expect(rapor.diperiksa).toContain(nama);
    }
    expect(kode(rapor)).toContain("amar-petitum-cocok");
    expect(kode(rapor)).toContain("majelis-cocok");
    // Empat petitum: tiga primer, satu subsidair yang tidak bernomor - dan
    // pernyataan verstek pada amar 1 adalah amar baku, bukan ultra petita.
    expect(rapor.aduan).toEqual({ jumlahPetitum: 4, jumlahAmar: 4, belumTerjawab: 0, amarTanpaPetitum: 0 });
    expect(rapor.ringkas).toMatch(/^Tidak ada yang menahan/);
  });

  it("yang menahan diurutkan paling atas, lalu perhatian, lalu catatan", () => {
    const rapor = nilaiPraperiksa(fakta({ putusan: { ada: true, tanggalPutusan: "2026-09-09", statusPutusan: "Dikabulkan", verstek: "Y" } }), usulan({ verstek: "T" }));
    const tingkat = rapor.temuan.map((t) => t.tingkat);
    const posisi = (x: Tingkat) => tingkat.indexOf(x);
    expect(posisi("hentikan")).toBeLessThan(posisi("perhatian"));
    expect(posisi("perhatian")).toBeLessThan(posisi("catatan"));
  });
});

// ============================================================================
describe("yang dibuktikan dari SIPP MENAHAN", () => {
  it("perkara yang sudah putus", () => {
    const rapor = nilaiPraperiksa(fakta({ putusan: { ada: true, tanggalPutusan: "2026-09-09", statusPutusan: "Dikabulkan", verstek: "Y" } }), usulan());
    expect(kode(rapor, "hentikan")).toContain("sudah-putus");
  });

  it("tanggal putusan yang bukan hari sidang perkara itu (1.643/1.643 putusan bertanggal hari sidang)", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan({ tanggalPutusan: "10/09/2026" }));
    expect(kode(rapor, "hentikan")).toContain("tanggal-tanpa-sidang");
    expect(rapor.temuan.find((t) => t.kode === "tanggal-tanpa-sidang")?.rincian).toContain("09-09-2026");
  });

  it("tanggal putusan di masa depan", () => {
    const rapor = nilaiPraperiksa(fakta({ jadwal: [{ tanggalSidang: "2026-09-30", agenda: "Putusan", ditunda: false }] }), usulan({ tanggalPutusan: "30/09/2026" }));
    expect(kode(rapor, "hentikan")).toContain("tanggal-masa-depan");
  });

  it("status Dikabulkan dengan amar yang menolak; status Gugur dengan amar pencabutan - yang terakhir kasus sungguhan", () => {
    const menolak = nilaiPraperiksa(fakta(), usulan({ amar: "1. Menolak gugatan Penggugat seluruhnya;\n2. Membebankan biaya perkara kepada Penggugat;", verstek: "T" }));
    expect(kode(menolak, "hentikan")).toContain("status-vs-amar");

    const gugur = nilaiPraperiksa(
      fakta(),
      usulan({
        statusPutusan: "Gugur",
        amar: `1. Mengabulkan permohonan Pemohon untuk mencabut perkaranya;\n2. Menyatakan perkara Nomor ${NOMOR} dicabut;`,
        verstek: "T",
      })
    );
    expect(kode(gugur, "hentikan")).toContain("status-vs-amar");

    const cabut = nilaiPraperiksa(fakta(), usulan({ statusPutusan: "Dicabut", amar: `1. Mengabulkan permohonan pencabutan perkara Nomor ${NOMOR};`, verstek: "T" }));
    expect(kode(cabut, "hentikan")).not.toContain("status-vs-amar");
  });

  it("status Dikabulkan tetapi amar 'tidak dapat diterima' tanpa satu pun 'mengabulkan'", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan({ amar: "1. Menyatakan gugatan Penggugat tidak dapat diterima;\n2. Membebankan biaya perkara;", verstek: "T" }));
    expect(kode(rapor, "hentikan")).toContain("status-vs-amar");
  });

  it("tidak satu pun nama di amar adalah pihak perkara ini - drafnya milik perkara lain", () => {
    const rapor = nilaiPraperiksa(
      fakta(),
      usulan({ amar: "1. Mengabulkan gugatan Penggugat;\n2. Menjatuhkan talak satu Tergugat (Burhan bin Kadir) terhadap Penggugat (Salma binti Yusuf);" })
    );
    expect(kode(rapor, "hentikan")).toContain("amar-bukan-perkara-ini");
  });

  it("naskah menyebut nomor perkara LAIN saja", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan({ naskah: "PUTUSAN Nomor 999/Pdt.G/2026/PA.Dgl\nAMAR\n" + AMAR_KABUL }));
    expect(kode(rapor, "hentikan")).toContain("nomor-berbeda");
  });

  it("naskah menyebut majelis, tetapi bukan majelis yang tercatat di SIPP", () => {
    const rapor = nilaiPraperiksa(
      fakta({ majelis: [{ nama: "Zainal Abidin, S.H.I.", jabatan: "Hakim Ketua" }, { nama: "Rusli Amin, S.H.", jabatan: "Hakim Anggota" }] }),
      usulan()
    );
    expect(kode(rapor, "hentikan")).toContain("majelis-berbeda");
    expect(rapor.temuan.find((t) => t.kode === "majelis-berbeda")?.rincian).toContain("Zainal Abidin");
    expect(rapor.temuan.find((t) => t.kode === "majelis-berbeda")?.rincian).not.toContain("Rusli Amin");
  });
});

// ============================================================================
describe("yang tidak dapat dipastikan mesin TIDAK menahan - ia perhatian atau catatan", () => {
  it("verstek yang tidak disebut amar hanya perhatian (871 dari 936 menyebutnya)", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan({ amar: "1. Mengabulkan gugatan Penggugat;\n2. Menjatuhkan talak satu Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah);" }));
    expect(rapor.hentikan).toBe(false);
    expect(kode(rapor, "perhatian")).toContain("verstek-vs-amar");
  });

  it("sebagian nama di amar bukan pihak - dapat saksi atau anak yang belum dicatat; anak yang ayahnya pihak dikenali sebagai kerabat", () => {
    const rapor = nilaiPraperiksa(
      fakta(),
      usulan({ amar: AMAR_KABUL + "\n5. Menetapkan anak bernama Aisyah binti Rahmat dan Fatimah binti Rahmat serta saksi Herman bin Zulkifli;" })
    );
    expect(rapor.hentikan).toBe(false);
    const temuan = rapor.temuan.find((t) => t.kode === "nama-bukan-pihak");
    expect(temuan?.tingkat).toBe("perhatian");
    expect(temuan?.rincian).toContain("Herman bin Zulkifli");
    // Fatimah binti Rahmat tidak tercatat di perkara_anak_pihak, tetapi ayahnya
    // adalah Tergugat - kerabat, bukan orang asing. Diukur: tiga salah tangkap
    // dispensasi kawin pada 200 putusan sungguhan seluruhnya keadaan ini.
    expect(temuan?.rincian).not.toContain("Fatimah");
    expect(temuan?.rincian).not.toContain("Aisyah");
  });

  it("dispensasi kawin (Pdt.P): amar menyebut anak dan calon - tidak satu pun pihak - hanya perhatian", () => {
    const rapor = nilaiPraperiksa(
      fakta({ nomorPerkara: "190/Pdt.P/2026/PA.Dgl", jenisPerkara: "Dispensasi Kawin", pihak: [{ nama: "Selamet bin Toimin", pihakKe: 1 }, { nama: "Eni Mursidah binti Suwarno", pihakKe: 1 }], anak: [] }),
      usulan({
        nomorPerkara: "190/Pdt.P/2026/PA.Dgl",
        statusPutusan: "Dikabulkan",
        verstek: "",
        amar: "1. Mengabulkan permohonan Pemohon;\n2. Memberikan dispensasi kepada Wahid Kurniawan bin Muksin untuk menikah dengan Rina binti Karto;",
        naskah: "",
      })
    );
    expect(rapor.hentikan).toBe(false);
    expect(rapor.temuan.find((t) => t.kode === "amar-bukan-perkara-ini")?.tingkat).toBe("perhatian");
  });

  it("status pencabutan/gugur/ditolak: aduan amar-petitum tidak berlaku, dan tidak menghasilkan perhatian palsu", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan({ statusPutusan: "Dicabut", verstek: "T", amar: `1. Mengabulkan permohonan pencabutan perkara Nomor ${NOMOR} dari Penggugat;\n2. Memerintahkan Panitera mencatat pencabutan dalam register;\n3. Membebankan biaya perkara kepada Penggugat;` }));
    expect(rapor.hentikan).toBe(false);
    expect(kode(rapor, "perhatian")).not.toContain("petitum-belum-terjawab");
    expect(kode(rapor, "perhatian")).not.toContain("amar-tanpa-petitum");
    expect(kode(rapor, "catatan")).toContain("aduan-tidak-berlaku");
    expect(rapor.diperiksa).not.toContain("amar-vs-petitum");
  });

  it("petitum itsbat yang panjang berpadanan dengan amar pendek lewat pandangan kedua; amar <li> tanpa angka tetap terbaca", () => {
    const rapor = nilaiPraperiksa(
      fakta({
        nomorPerkara: "213/Pdt.P/2026/PA.Dgl",
        petitum:
          "<p>1. Mengabulkan permohonan Pemohon I dan Pemohon II;</p>" +
          "<p>2. Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan hari Kamis, 21 November 1996 di Desa Lero Kecamatan Sindue Kabupaten Donggala;</p>" +
          "<p>3. Membebankan biaya perkara menurut hukum;</p>",
        pihak: [{ nama: "Ferry Fadly bin Djumari", pihakKe: 1 }, { nama: "Siti Nurhayati binti Karim", pihakKe: 1 }],
      }),
      usulan({
        nomorPerkara: "213/Pdt.P/2026/PA.Dgl",
        verstek: "",
        amar:
          "<ol><li>Mengabulkan permohonan Pemohon I dan Pemohon II;</li>" +
          "<li>Menyatakan sah pernikahan antara Pemohon I (Ferry Fadly bin Djumari) dengan Pemohon II (Siti Nurhayati binti Karim);</li>" +
          "<li>Membebankan biaya perkara kepada Pemohon sejumlah Rp200.000,00;</li></ol>",
        naskah: "",
      })
    );
    expect(rapor.aduan?.jumlahAmar).toBe(3);
    expect(kode(rapor, "perhatian")).not.toContain("petitum-belum-terjawab");
    expect(kode(rapor, "perhatian")).not.toContain("amar-tanpa-petitum");
    expect(kode(rapor)).toContain("amar-petitum-cocok");
  });

  it("petitum yang tampak belum terjawab dan amar tanpa petitum hanya perhatian", () => {
    const rapor = nilaiPraperiksa(
      fakta({ petitum: "<p>1. Mengabulkan gugatan Penggugat;</p><p>2. Menghukum Tergugat membayar nafkah iddah dan mut'ah sejumlah Rp10.000.000;</p>" }),
      usulan({ amar: "1. Mengabulkan gugatan Penggugat secara verstek;\n2. Menetapkan hak asuh anak Aisyah binti Rahmat kepada Penggugat;\n3. Membebankan biaya perkara;" })
    );
    expect(rapor.hentikan).toBe(false);
    expect(kode(rapor, "perhatian")).toContain("petitum-belum-terjawab");
    expect(kode(rapor, "perhatian")).toContain("amar-tanpa-petitum");
    expect(rapor.aduan?.belumTerjawab).toBe(1);
  });

  it("nomor perkara lain di samping nomornya sendiri hanya catatan (142 dari 144 amar bernomor menyebut nomornya)", () => {
    const rapor = nilaiPraperiksa(fakta(), usulan({ amar: AMAR_KABUL + `\n5. Menyatakan perkara Nomor 77/Pdt.G/2026/PA.Dgl tidak berkaitan;` }));
    expect(kode(rapor, "hentikan")).not.toContain("nomor-berbeda");
    expect(kode(rapor, "catatan")).toContain("nomor-lain-disebut");
  });

  it("sidang ditunda, akhir pekan, hari libur, dan sidang yang lebih baru - perhatian", () => {
    const rapor = nilaiPraperiksa(
      fakta({
        jadwal: [
          { tanggalSidang: "2026-09-05", agenda: "Sidang Pertama", ditunda: true },
          { tanggalSidang: "2026-09-09", agenda: "Panggil Tergugat", ditunda: false },
        ],
        libur: { tanggal: "2026-09-05", nama: "Cuti bersama (karangan)" },
      }),
      usulan({ tanggalPutusan: "05/09/2026" })
    );
    expect(rapor.hentikan).toBe(false);
    for (const k of ["sidang-ditunda", "tanggal-akhir-pekan", "tanggal-libur", "tanggal-bukan-sidang-terakhir"]) {
      expect(kode(rapor, "perhatian")).toContain(k);
    }
  });

  it("pihak e-Court yang ejaannya lain: perhatian; e-Court tidak terbaca: catatan", () => {
    const beda = nilaiPraperiksa(fakta({ ecourt: { terdaftar: true, pihak: [{ nama: "NURHAYATI BINTI ABDULLAH", peran: "Penggugat" }, { nama: "Orang Lain bin Siapa", peran: "Tergugat" }] } }), usulan());
    expect(beda.hentikan).toBe(false);
    expect(beda.temuan.find((t) => t.kode === "pihak-ecourt-berbeda")?.rincian).toContain("Orang Lain");
    expect(beda.temuan.find((t) => t.kode === "pihak-ecourt-berbeda")?.rincian).not.toContain("NURHAYATI");

    const takTerbaca = nilaiPraperiksa(fakta({ ecourt: { terdaftar: null, pihak: [] } }), usulan());
    expect(kode(takTerbaca, "catatan")).toContain("ecourt-tidak-terbaca");
  });

  it("yang tidak dapat diperiksa DISEBUT - tanggal kosong, majelis tidak disebut naskah, pihak tidak terbaca", () => {
    const rapor = nilaiPraperiksa(fakta({ pihak: [], anak: [], tidakTerbaca: ["pihak: view tidak ada"] }), usulan({ tanggalPutusan: "", naskah: "AMAR\n" + AMAR_KABUL }));
    expect(rapor.hentikan).toBe(false);
    expect(rapor.diperiksa).not.toContain("tanggal-putusan");
    expect(rapor.diperiksa).not.toContain("majelis");
    for (const k of ["tanggal-tidak-terbaca", "naskah-tanpa-majelis", "pihak-tidak-terbaca", "fakta-tidak-terbaca"]) {
      expect(kode(rapor, "catatan")).toContain(k);
    }
  });

  it("bot mati: rapor berbunyi 'TIDAK dijalankan' dan tidak menahan - bukan rapor kosong", () => {
    const rapor = raporTanpaFakta("ALETA Bot belum dapat dihubungi.");
    expect(rapor.hentikan).toBe(false);
    expect(rapor.diperiksa).toEqual([]);
    expect(rapor.temuan).toHaveLength(1);
    expect(rapor.temuan[0].kode).toBe("tidak-diperiksa");
    expect(rapor.temuan[0].tingkat).toBe("perhatian");
    expect(rapor.temuan[0].rincian).toContain("bukan tanda lolos");
  });
});

// ============================================================================
describe("pendapat AI tidak pernah menahan", () => {
  it("pertentangan yang ditemukan model menjadi perhatian; jalur yang belum disetel menjadi catatan", () => {
    const ada = nilaiPraperiksa(fakta(), usulan(), {
      pendapat: { ok: true, temuan: [{ judul: "Petitum 2 melampaui amar", rincian: "..." }], catatan: ["Amar 4 baku."], provider: "openai", model: "llama-3.1-8b" },
    });
    expect(ada.hentikan).toBe(false);
    expect(ada.temuan.find((t) => t.kode === "ai-bertentangan")?.tingkat).toBe("perhatian");
    expect(ada.diperiksa).toContain("pendapat-ai");

    const lewat = nilaiPraperiksa(fakta(), usulan(), { pendapat: { ok: false, alasan: "Jalur 'perkara' belum disetel penyedianya." } });
    expect(lewat.temuan.find((t) => t.kode === "ai-dilewati")?.tingkat).toBe("catatan");
    expect(lewat.diperiksa).not.toContain("pendapat-ai");
  });
});

// ============================================================================
describe("layanan bot: pembaca fakta yang gagal sebagian, dan pendapat yang disamarkan", () => {
  const barisPerkara = { perkaraId: 10001, nomorPerkara: NOMOR, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", tanggalDaftar: new Date(2026, 7, 1), petitum: "<p>1. A</p>" };

  function kueriPalsu(gagalPada: string[] = []) {
    return vi.fn(async (sql: string) => {
      const s = sql.replace(/\s+/g, " ");
      if (s.includes("FROM perkara p WHERE p.nomor_perkara")) return [barisPerkara];
      if (s.includes("v_pihak_perkara")) {
        if (gagalPada.includes("pihak")) throw new Error("Table 'v_pihak_perkara' doesn't exist");
        return [{ nama: "Nurhayati binti Abdullah", pihakKe: 1 }, { nama: "Rahmat bin Sulaiman", pihakKe: 2 }, { nama: "Saksi Satu", pihakKe: 5 }];
      }
      if (s.includes("perkara_anak_pihak")) return [{ nama: "Aisyah binti Rahmat" }];
      if (s.includes("perkara_hakim_pn")) return [{ nama: "Hasanuddin, S.H.I., M.H.", jabatan: "Hakim Ketua", urutan: 1 }];
      if (s.includes("perkara_panitera_pn")) return [{ nama: "Munir, S.H." }];
      if (s.includes("perkara_jadwal_sidang")) return [{ tanggalSidang: new Date(2026, 8, 9), agenda: "Panggil Tergugat", ditunda: "T", urutan: 2 }];
      if (s.includes("perkara_putusan")) return [];
      if (s.includes("perkara_efiling_id")) return [{ ada: 1 }];
      throw new Error(`kueri tak dikenal: ${s.slice(0, 60)}`);
    });
  }

  it("fakta dipetakan; tanggal MySQL menjadi YYYY-MM-DD menurut zona server; peran dari pihak_ke", async () => {
    const f = await svc.bacaFakta(` ${NOMOR} `, { tanggal: "2026-09-09", kueri: kueriPalsu() });
    expect(f.ok).toBe(true);
    expect(f.perkaraId).toBe(10001);
    expect(f.pihak.map((x: { peran: string }) => x.peran)).toEqual(["penggugat", "tergugat", "saksi"]);
    expect(f.anak).toEqual(["Aisyah binti Rahmat"]);
    expect(f.jadwal[0].tanggalSidang).toBe("2026-09-09");
    expect(f.jadwal[0].ditunda).toBe(false);
    expect(f.putusan.ada).toBe(false);
    expect(f.ecourt.terdaftar).toBe(true);
    expect(f.hariIni).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("satu fakta yang gagal tidak menghilangkan yang lain - dan gagalnya DISEBUT", async () => {
    const f = await svc.bacaFakta(NOMOR, { kueri: kueriPalsu(["pihak"]) });
    expect(f.ok).toBe(true);
    expect(f.pihak).toEqual([]);
    expect(f.majelis).toHaveLength(1);
    expect(f.tidakTerbaca.join(" ")).toContain("pihak");
  });

  it("nomor kosong dan perkara yang tidak ada dijawab tegas", async () => {
    expect((await svc.bacaFakta("")).ok).toBe(false);
    const kosong = vi.fn(async () => []);
    const f = await svc.bacaFakta("1/Pdt.G/2026/PA.Dgl", { kueri: kosong });
    expect(f.ok).toBe(false);
    expect(f.alasan).toBe("perkara_tidak_ditemukan");
  });

  it("muatan AI: nama pihak dan anak tersamar, kedua bagian ada, satu bukti untuk satu pengiriman", () => {
    const muatan = svc.susunMuatanAi({
      nomorPerkara: NOMOR,
      petitum: "1. Menjatuhkan talak Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah);",
      amar: "1. Menetapkan anak Aisyah binti Rahmat dalam asuhan Nurhayati binti Abdullah;",
      pihak: [{ nama: "Nurhayati binti Abdullah", pihakKe: 1 }, { nama: "Rahmat bin Sulaiman", pihakKe: 2 }],
      anak: ["Aisyah binti Rahmat"],
    });
    expect(muatan.teks).toContain(svc.PEMISAH_PETITUM);
    expect(muatan.teks).toContain(svc.PEMISAH_AMAR);
    expect(muatan.teks).not.toContain("Nurhayati");
    expect(muatan.teks).not.toContain("Sulaiman");
    expect(muatan.teks).not.toContain("Aisyah");
    expect(muatan.teks).toContain("[PENGGUGAT]");
    expect(muatan.teks).toContain("[ANAK-1]");
    expect(muatan.bukti.diterapkan).toBe(true);
    expect(muatan.bukti.bersih).toBe(true);
  });

  it("sisa nama yang tidak dikenal kamus MENAHAN pengiriman - penyedia tidak pernah dipanggil", async () => {
    const adapter = { completeJson: vi.fn() };
    const hasil = await svc.pendapatAi(
      { nomorPerkara: NOMOR, petitum: "1. A", amar: "1. Menetapkan saksi BUDI KALESU hadir;", pihak: [{ nama: "Nurhayati binti Abdullah", pihakKe: 1 }], anak: [] },
      { adapter }
    );
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toMatch(/sisa/);
    expect(adapter.completeJson).not.toHaveBeenCalled();
  });

  it("dikirim lewat jalur 'perkara' dengan bukti penyamaran; penyedia yang gagal pulang ok:false, bukan melempar", async () => {
    const berhasil = { completeJson: vi.fn(async () => ({ json: { bertentangan: [{ judul: "Petitum 2", rincian: "tidak dijawab" }], catatan: ["ok"] }, provider: "openai", model: "x", durationMs: 12 })) };
    const masukan = { nomorPerkara: NOMOR, petitum: "1. Mengabulkan gugatan Penggugat;", amar: "1. Mengabulkan gugatan Penggugat;", pihak: [{ nama: "Nurhayati binti Abdullah", pihakKe: 1 }], anak: [] };
    const hasil = await svc.pendapatAi(masukan, { adapter: berhasil });
    expect(hasil.ok).toBe(true);
    expect(hasil.temuan).toEqual([{ judul: "Petitum 2", rincian: "tidak dijawab" }]);
    const panggilan = (berhasil.completeJson.mock.calls[0] as unknown as [Record<string, unknown>])[0] as {
      jalur: string;
      penyamaran: { diterapkan: boolean };
      temperature: number;
    };
    expect(panggilan.jalur).toBe("perkara");
    expect(panggilan.penyamaran.diterapkan).toBe(true);
    expect(panggilan.temperature).toBe(0);

    const gagal = { completeJson: vi.fn(async () => { throw new Error("Jalur 'perkara' belum disetel penyedianya di runtime AI ALETA Bot."); }) };
    const jawab = await svc.pendapatAi(masukan, { adapter: gagal });
    expect(jawab.ok).toBe(false);
    expect(jawab.alasan).toContain("belum disetel");
  });
});

// ============================================================================
describe("sambungan: rute portal, gerbang bot, dan ekstensi", () => {
  const konten = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8");
  const css = readFileSync(path.join(AKAR, "ekstensi-sipp/panel.css"), "utf8");
  const klien = readFileSync(path.join(AKAR, "manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts"), "utf8");
  const router = readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
  const rute = path.join(AKAR, "manajemen_surat/src/app/api/aleta-ecourt/putusan/praperiksa/route.ts");

  it("ekstensi memakai rute portal yang memang ada", () => {
    expect(konten).toContain('const ALETA_API_PRAPERIKSA_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/praperiksa"');
    expect(existsSync(rute)).toBe(true);
    const isi = readFileSync(rute, "utf8");
    expect(isi).toContain("export async function POST");
    expect(isi).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    // Pendapat AI hanya diminta bila tidak ada yang menahan, dan dapat dimatikan.
    expect(isi).toContain("if (badan?.mintaAi !== false && !rapor.hentikan)");
  });

  it("dua alamat yang diminta portal dilayani bot", () => {
    for (const jalur of ["/sipp/praperiksa-putusan/fakta", "/sipp/praperiksa-putusan/pendapat"]) {
      expect(klien).toContain(`/internal/aleta-bot${jalur}`);
      expect(router).toMatch(new RegExp(`router\\.(get|post)\\("${jalur.replace(/\//g, "\\/")}", requireInternalToken`));
    }
  });

  // Sampai 26 September 2026 praperiksa berjalan SEBELUM medan diisi - dan
  // karena itu membaca Status Putusan yang masih "Pilih Status Putusan":
  // status yang kemudian dipilih antrean sendiri tidak pernah diadu dengan
  // amar. Kini ia berjalan sesudah pilihan dan naskah diisi, sebelum Simpan.
  // Perilakunya dijaga ekstensi-massal-ujung-ke-ujung.test.ts (praperiksa
  // sungguhan atas status yang dipilih antrean); di sini letaknya.
  it("antrean massal: praperiksa berjalan SESUDAH pilihan blangko diisi dan SEBELUM Simpan", () => {
    const badan = konten.slice(konten.indexOf("async function jalankanSatuAntreanSipp("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    const letakPraperiksa = fungsi.indexOf("await praperiksaSebelumMengisi(butir.nomor, kabar)");
    const letakPilihan = fungsi.indexOf("// 3a. Medan PILIHAN borang");
    const letakTahanPilihan = fungsi.indexOf("// 3b'. Pilihan wajib");
    const letakSimpan = fungsi.indexOf("await simpanPutusanLaluBuka(butir.nomor, kabar)");
    expect(letakPilihan).toBeGreaterThan(0);
    expect(letakPraperiksa).toBeGreaterThan(letakTahanPilihan);
    expect(letakPraperiksa).toBeLessThan(letakSimpan);
    expect(fungsi.split("await praperiksaSebelumMengisi(").length - 1).toBe(1);
    expect(fungsi).toContain('butir.keadaan = "tertahan";');
    expect(konten).toContain('praperiksa: "ditahan praperiksa"');
  });

  it("panel tunggal: Isikan mati saat ditahan; tetap mengisi harus dinyatakan; Simpan tidak ditekan sendiri", () => {
    const badan = konten.slice(konten.indexOf("function bagianIsiPutusan("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain("raporAgen = await jalankanPraperiksaPanel(nomorPerkara, wadah);");
    expect(fungsi).toContain("if (raporAgen && raporAgen.hentikan) {\n      terap.disabled = true;");
    expect(fungsi).toContain("Simpan TIDAK akan ditekan sendiri");
    // Gerbang sebelum simpanPutusanLaluBuka, bukan sesudahnya.
    const letakGerbang = fungsi.indexOf("Simpan TIDAK ditekan: praperiksa menahan");
    const letakSimpan = fungsi.indexOf("const hasilSimpan = await simpanPutusanLaluBuka(nomorPerkara, hasilTerap);");
    expect(letakGerbang).toBeGreaterThan(0);
    expect(letakGerbang).toBeLessThan(letakSimpan);
  });

  it("isian blangko dibaca dari medan SIPP yang sesungguhnya - #tgl_putusan, status_putusan, verstek Y/T", () => {
    expect(konten).toContain('"#tgl_putusan"');
    expect(konten).toContain(`await terpilih('select[name="status_putusan"]')`);
    expect(konten).toContain('verstek.nilai === "Y" || verstek.nilai === "T"');
  });

  it("yang menahan bernada lewat, perhatian bernada mendesak - dan seluruhnya token, tanpa warna mati", () => {
    const henti = css.slice(css.indexOf(".aleta-praperiksa-henti {"), css.indexOf("}", css.indexOf(".aleta-praperiksa-henti {")));
    expect(henti).toContain("var(--aleta-lewat)");
    expect(henti).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(css).toContain(".aleta-praperiksa-tetap {");
  });
});
