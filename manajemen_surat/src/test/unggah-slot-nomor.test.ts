// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bakuNomorPerkara,
  isiMenunjukPerkara,
  kenaliNaskahBukanPutusan,
  nomorPerkaraDariIsi,
  samaNomorPerkara,
} from "@/lib/naskah-putusan-resmi";

/**
 * ============================================================================
 * UNGGAH PUTUSAN: NOMOR DARI ISI, NASKAH YANG BUKAN PUTUSAN, DAN SLOT ANONIM
 * ============================================================================
 *
 * Tiga pemeriksaan yang dijalankan SEBELUM apa pun ditulis:
 *
 *   1. nomor perkara dibaca dari ISI naskah (nomor ber-"Pdt." terbanyak) dan
 *      harus sama dengan nomor yang dituju - 197 dari 197 naskah sungguhan
 *      menyebut nomornya sendiri paling sering;
 *   2. Berita Acara, Penetapan Hari Sidang, dan Relaas ditolak dengan namanya;
 *   3. slot anonimisasi tidak boleh memuat nama inti pihak dari SIPP - putusan
 *      asli di slot anonim tertangkap 39 dari 39 pada berkas sungguhan.
 *
 * Uji di sini MENJALANKAN kodenya: fungsi murni dipanggil langsung, dan kedua
 * rute dipanggil lewat POST dengan gerbang bot ditiru. Nama pihak di bawah
 * karangan; tidak ada NIK atau alamat.
 */

// ============================================================================
// GERBANG, BASIS DATA, DAN SIMPAN DRAF DITIRU
// ============================================================================
const keadaan = vi.hoisted(() => ({
  status: null as unknown,
  konteks: null as unknown,
  jawabUnggah: null as unknown,
  unggah: [] as Array<Record<string, unknown>>,
  draf: [] as unknown[],
  panggilStatus: 0,
  panggilKonteks: 0,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", () => ({
  // Hak unggah putusan (9 Okt 2026) diuji di hak-unggah-putusan-9okt.test.ts.
  pastikanBolehUnggahPutusan: async () => ({ actor: { name: "Penguji" }, peran: "hakim" }),
  bolehUnggahPutusan: () => true,
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  // Galat yang ditelan menjadi 500 membuat uji gagal tanpa menyebut sebabnya.
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayStatusPerkara: async () => {
    keadaan.panggilStatus += 1;
    return keadaan.status;
  },
  getGatewaySippKonteks: async () => {
    keadaan.panggilKonteks += 1;
    return keadaan.konteks;
  },
  gatewayUnggahPutusanSipp: async (muatan: Record<string, unknown>) => {
    keadaan.unggah.push(muatan);
    return keadaan.jawabUnggah;
  },
}));
vi.mock("@/server/modules/aleta-ecourt/perakit-putusan", () => ({
  simpanDraf: async (...argumen: unknown[]) => {
    keadaan.draf.push(argumen);
    return { ok: true, drafId: "drf_uji", versi: 1 };
  },
}));

const NOMOR = "12/Pdt.G/2026/PA.Dgl";
const PENGGUGAT = "Wulandari binti Kartasasmita";
const TERGUGAT = "Hendrawan bin Sulaiman";

/** RTF sederhana: tiap butir satu paragraf. */
function rtf(baris: string[]): Uint8Array {
  return new TextEncoder().encode(`{\\rtf1\\ansi ${baris.join("\\par ")}}`);
}

/** Kerangka putusan berbentuk templat satker. anonim = nama diganti sebutan. */
function barisPutusan(nomor = NOMOR, { anonim = false }: { anonim?: boolean } = {}): string[] {
  const p = anonim ? "Penggugat" : PENGGUGAT;
  const t = anonim ? "Tergugat" : TERGUGAT;
  return [
    "SALINAN",
    "PUTUSAN",
    `Nomor ${nomor}`,
    "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA",
    "PENGADILAN AGAMA DONGGALA",
    "Memeriksa dan mengadili perkara tertentu pada tingkat pertama telah menjatuhkan putusan dalam perkara Cerai Gugat antara:",
    `${p}, sebagai Penggugat;`,
    "melawan",
    `${t}, sebagai Tergugat;`,
    "DUDUK PERKARA",
    `Bahwa Penggugat dengan surat gugatannya yang terdaftar dalam register Nomor ${nomor} mengemukakan hal-hal berikut;`,
    "PERTIMBANGAN HUKUM",
    "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
    "MENGADILI:",
    "1. Mengabulkan gugatan Penggugat secara verstek;",
    `2. Menjatuhkan talak satu ba'in sughra Tergugat (${t}) terhadap Penggugat (${p});`,
    "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Selasa tanggal 1 September 2026;",
    `Putusan Nomor ${nomor}`,
  ];
}

const BARIS_BAS = [
  "BERITA ACARA SIDANG",
  `Nomor ${NOMOR}`,
  "Sidang Pertama",
  "Pengadilan Agama Donggala yang memeriksa dan mengadili perkara Cerai Gugat pada tingkat pertama;",
  `${PENGGUGAT}, sebagai Penggugat;`,
];

const BARIS_PHS = [
  "PENETAPAN",
  `Nomor ${NOMOR}`,
  `Ketua Majelis Pengadilan Agama Donggala membaca Penetapan Majelis Hakim Nomor ${NOMOR};`,
  `${PENGGUGAT}, sebagai Penggugat;`,
  "Lawan",
  `${TERGUGAT}, sebagai Tergugat;`,
  "Menimbang, bahwa untuk memeriksa dan memutus perkara tersebut perlu ditetapkan hari sidang;",
  "Mengingat Pasal 145 R.Bg., dan peraturan perundang-undangan terkait.",
  "MENETAPKAN",
  "1. Menetapkan hari sidang pertama pada hari Selasa tanggal 8 September 2026;",
];

const BARIS_RELAAS = [
  "MAHKAMAH AGUNG REPUBLIK INDONESIA",
  "PENGADILAN AGAMA DONGGALA",
  "Jalan Poros Palu - Donggala",
  "RELAAS PANGGILAN",
  `Nomor ${NOMOR}`,
  "Pada hari ini ............ tanggal ............",
  "TELAH MEMANGGIL",
];

beforeEach(() => {
  keadaan.status = { ok: true, data: { identitas: { perkaraId: "901" } } };
  keadaan.konteks = {
    ok: true,
    data: {
      nomorPihak: [
        { nama: PENGGUGAT, pihakKe: 1, jenis: "pihak" },
        { nama: TERGUGAT, pihakKe: 2, jenis: "pihak" },
        // Kuasa TIDAK dipakai sebagai penanda - nama advokat lazim tetap
        // tertulis pada putusan anonimisasi.
        { nama: "Bambang Setiawan, S.H.", pihakKe: 1, jenis: "kuasa" },
      ],
    },
  };
  keadaan.jawabUnggah = {
    ok: true,
    data: { ok: true, antrean: true, berkas: [{ jenis: "putusan", ok: true, jalur: "resources/file/doc/x.rtf" }] },
  };
  keadaan.unggah = [];
  keadaan.draf = [];
  keadaan.panggilStatus = 0;
  keadaan.panggilKonteks = 0;
});

// ============================================================================
// 1. NOMOR DARI ISI
// ============================================================================
describe("nomorPerkaraDariIsi - nomor ber-'Pdt.' terbanyak di isi naskah", () => {
  it("memilih nomor perkara yang paling sering disebut", () => {
    const hasil = nomorPerkaraDariIsi(barisPutusan().join("\n"));
    expect(hasil.nomor).toBe(NOMOR);
    expect(hasil.kali).toBe(3);
  });

  it("nomor akta cerai yang lebih sering disebut TIDAK dipilih - polanya dibatasi 'Pdt.'", () => {
    // Pola umum meleset pada 1 dari 197 naskah sungguhan dengan cara ini.
    const akta = Array.from({ length: 5 }, () => "Akta Cerai Nomor 453/AC/2026/PA.Dgl").join("\n");
    expect(nomorPerkaraDariIsi(`${barisPutusan().join("\n")}\n${akta}`).nomor).toBe(NOMOR);
  });

  it("isi tanpa nomor ber-'Pdt.' memulangkan kosong, bukan tebakan", () => {
    expect(nomorPerkaraDariIsi("Catatan tanpa nomor perkara.")).toEqual({
      nomor: "",
      kali: 0,
      kepala: "",
      terbanyak: "",
      calon: [],
    });
  });

  it("nol di depan, besar-kecil huruf, spasi, dan 'PA Buk' tidak membedakan nomor", () => {
    expect(samaNomorPerkara("0002/Pdt.G/2016/PA.Buk", "2/Pdt.G/2016/PA.Buk")).toBe(true);
    expect(samaNomorPerkara("0002/Pdt.G/2016/PA Buk", "2/Pdt.G/2016/PA.Buk")).toBe(true);
    expect(samaNomorPerkara("12/PDT.G/2026/PA.DGL", NOMOR)).toBe(true);
    expect(samaNomorPerkara("12/Pdt.G/2026/PA.Dgl ", NOMOR)).toBe(true);
    expect(samaNomorPerkara("121/Pdt.G/2026/PA.Dgl", NOMOR)).toBe(false);
    expect(samaNomorPerkara("12/Pdt.P/2026/PA.Dgl", NOMOR)).toBe(false);
    expect(samaNomorPerkara("", "")).toBe(false);
    expect(bakuNomorPerkara(" 007/Pdt.G/2026/PA.Dgl")).toBe("7/pdtg/2026/padgl");
  });

  it("templat lama menulis 'PA Buk' (spasi): nomornya tetap terbaca", () => {
    // 0002/Pdt.G/2016 dan 274/Pdt.P/2018 PA Bungku - pola ketat membacanya kosong.
    const hasil = nomorPerkaraDariIsi("P U T U S A N\nNomor 0002/Pdt.G/2016/PA Buk\nDEMI KEADILAN");
    expect(hasil.nomor).toBe("0002/Pdt.G/2016/PA Buk");
    expect(isiMenunjukPerkara(hasil, "0002/Pdt.G/2016/PA.Buk")).toBe(true);
    expect(nomorPerkaraDariIsi("Nomor 5 / Pdt. G / 2026 / PA. Dgl").nomor).toBe("5/Pdt. G/2026/PA. Dgl");
    expect(nomorPerkaraDariIsi("Nomor 7/Pdt.G.S/2026/PA.Dgl").nomor).toBe("7/Pdt.G.S/2026/PA.Dgl");
  });

  it("nomor KEPALA lebih dulu daripada nomor terbanyak", () => {
    // Bentuk 153/Pdt.G/2018/PA.Buk: kepalanya nomor sendiri, tetapi nomor
    // perkara lain disebut tiga kali di duduk perkara.
    const teks = [
      "PUTUSAN",
      "Nomor 153/Pdt.G/2018/PA.Buk",
      "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA",
      ...Array.from({ length: 3 }, () => "sebagaimana putusan Nomor 1/Pdt.G/2018/PA.Buk;"),
      "Putusan Nomor 153/Pdt.G/2018/PA.Buk",
    ].join("\n");
    const hasil = nomorPerkaraDariIsi(teks);
    expect(hasil).toMatchObject({
      nomor: "153/Pdt.G/2018/PA.Buk",
      kali: 2,
      kepala: "153/Pdt.G/2018/PA.Buk",
      terbanyak: "1/Pdt.G/2018/PA.Buk",
    });
    expect(isiMenunjukPerkara(hasil, "153/Pdt.G/2018/PA.Buk")).toBe(true);
  });

  it("naskah perkara lain - kepala DAN nomor terbanyak berbeda - tidak menunjuk perkara ini", () => {
    // Bentuk e-Doc 491/Pdt.G/2021/PA.Buk yang berisi putusan 423/Pdt.G/2021.
    const hasil = nomorPerkaraDariIsi("PUTUSAN\nNomor 423/Pdt.G/2021/PA.Buk\nPutusan Nomor 423/Pdt.G/2021/PA.Buk");
    expect(isiMenunjukPerkara(hasil, "491/Pdt.G/2021/PA.Buk")).toBe(false);
    expect(isiMenunjukPerkara(hasil, "423/Pdt.G/2021/PA.Buk")).toBe(true);
  });

  it("dua ejaan satu nomor dihitung sebagai satu nomor", () => {
    const teks = ["Nomor 0012/Pdt.G/2026/PA.Dgl", "Nomor 12/Pdt.G/2026/PA.Dgl", "Nomor 13/Pdt.G/2026/PA.Dgl"].join("\n");
    const hasil = nomorPerkaraDariIsi(teks);
    expect(hasil.kali).toBe(2);
    expect(samaNomorPerkara(hasil.nomor, NOMOR)).toBe(true);
  });
});

// ============================================================================
// 2. NASKAH YANG BUKAN PUTUSAN
// ============================================================================
describe("kenaliNaskahBukanPutusan", () => {
  it("Berita Acara dikenali dari judulnya", () => {
    expect(kenaliNaskahBukanPutusan(BARIS_BAS.join("\n"))).toMatchObject({
      jenis: "berita-acara",
      judul: "BERITA ACARA SIDANG",
    });
  });

  it("Relaas dikenali walau didahului kop surat", () => {
    expect(kenaliNaskahBukanPutusan(BARIS_RELAAS.join("\n"))).toMatchObject({
      jenis: "relaas",
      judul: "RELAAS PANGGILAN",
    });
  });

  it("Penetapan Hari Sidang: berjudul PENETAPAN, tanpa irah-irah, tanpa duduk perkara/pertimbangan", () => {
    expect(kenaliNaskahBukanPutusan(BARIS_PHS.join("\n"))).toMatchObject({
      jenis: "penetapan-hari-sidang",
      nama: "Penetapan Hari Sidang",
      judul: "PENETAPAN",
    });
  });

  it("penetapan majelis tanpa kata 'hari sidang' disebut penetapan pengelolaan", () => {
    const pmh = BARIS_PHS.map((b) =>
      b
        .replace("perlu ditetapkan hari sidang", "perlu ditetapkan Majelis Hakim")
        .replace("Menetapkan hari sidang pertama pada hari Selasa tanggal 8 September 2026", "Fulan, S.H.I. sebagai Ketua Majelis")
    );
    expect(kenaliNaskahBukanPutusan(pmh.join("\n"))?.jenis).toBe("penetapan-pengelolaan");
  });

  it("putusan dan penetapan AKHIR tidak pernah dikenali sebagai bukan-putusan", () => {
    expect(kenaliNaskahBukanPutusan(barisPutusan().join("\n"))).toBeNull();
    const penetapanAkhir = barisPutusan()
      .map((b) => (b === "PUTUSAN" ? "PENETAPAN" : b === "MENGADILI:" ? "MENETAPKAN" : b));
    expect(kenaliNaskahBukanPutusan(penetapanAkhir.join("\n"))).toBeNull();
    // Penetapan akhir yang pendek (tanpa judul duduk perkara) tetap memuat
    // irah-irah - dan itu cukup untuk tidak ditahan.
    const penetapanPendek = ["PENETAPAN", `Nomor ${NOMOR}`, "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA", "MENETAPKAN", "1. Mengabulkan pencabutan;"];
    expect(kenaliNaskahBukanPutusan(penetapanPendek.join("\n"))).toBeNull();
  });

  it("penetapan TANPA diktum MENETAPKAN tidak ditahan, walau menyebut 'hari sidang'", () => {
    // Bentuk catatan pencabutan sungguhan (0149/Pdt.G/2018/PA.Kng) dengan nama
    // diganti sebutan: berjudul PENETAPAN, tanpa irah-irah, menyebut "hari
    // sidang" - tetapi tidak menetapkan apa pun, jadi bukan PHS.
    const pencabutan = [
      "PENETAPAN",
      "Nomor 0149/Pdt.G/2018/PA.Kng.",
      "Ketua Majelis membaca surat permohonan yang terdaftar sebagai perkara nomor 0149/Pdt.G/2018/PA.Kng.;",
      "Pemohon, umur xxx tahun, sebagai Pemohon;",
      "M e l a w a n",
      "Termohon, umur xxx tahun, sebagai Termohon;",
      "Menimbang, bahwa sebelum hari sidang ditetapkan, Pemohon menyatakan secara tertulis mencabut permohonannya;",
      "Ditetapkan di : xxx",
      "Ketua Majelis,",
    ];
    expect(kenaliNaskahBukanPutusan(pencabutan.join("\n"))).toBeNull();
    // Diktumnya dipasang: kini memang penetapan hari sidang.
    const denganDiktum = [...pencabutan.slice(0, 7), "MENETAPKAN", "Hari sidang pertama pada xxx;", ...pencabutan.slice(7)];
    expect(kenaliNaskahBukanPutusan(denganDiktum.join("\n"))?.jenis).toBe("penetapan-hari-sidang");
  });

  it("kata 'berita acara' di TENGAH putusan tidak menjadikannya berita acara", () => {
    const naskah = barisPutusan();
    naskah.splice(10, 0, "BERITA ACARA SIDANG tanggal 1 September 2026 dianggap termuat dalam putusan ini;");
    expect(kenaliNaskahBukanPutusan(naskah.join("\n"))).toBeNull();
  });
});

// ============================================================================
// 3. PEMERIKSAAN SLOT - FUNGSI MURNI
// ============================================================================
describe("periksaBerkasUnggahSipp dan namaIntiDalamNaskah", () => {
  const muat = async () => import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
  const NAMA = [PENGGUGAT, TERGUGAT];

  it("nama inti = sebelum bin/binti/alias, dicari berbatas kata", async () => {
    const { namaIntiDalamNaskah, namaIntiPihak } = await muat();
    expect(namaIntiPihak("Wulandari binti Kartasasmita alias Wulan")).toBe("Wulandari");
    expect(namaIntiPihak("Hendrawan  bin  Sulaiman")).toBe("Hendrawan");
    expect(namaIntiDalamNaskah("KTP-el atas nama Wulandari (Penggugat)", NAMA)).toEqual(["Wulandari"]);
    // Berbatas kata: nama di dalam kata lain bukan temuan.
    expect(namaIntiDalamNaskah("Marina dan Hendrawanto", ["Rina binti X", "Hendrawan bin Y"])).toEqual([]);
    expect(namaIntiDalamNaskah("tidak ada keuntungan", ["Untung bin Z"])).toEqual([]);
    // Nama inti di bawah empat huruf diabaikan.
    expect(namaIntiDalamNaskah("Ali pergi", ["Ali bin Umar"])).toEqual([]);
    // Tanda baca dalam nama tidak merusak pencarian.
    expect(namaIntiDalamNaskah("oleh Moh. Rizal (Tergugat)", ["Moh. Rizal bin X"])).toEqual(["Moh. Rizal"]);
    expect(namaIntiDalamNaskah("oleh Moh Rizal", ["Moh. Rizal bin X"])).toEqual([]);
  });

  it("putusan ASLI di slot anonimisasi ditolak dengan nama yang ditemukan", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [{ slot: "anonimisasi", bita: rtf(barisPutusan()) }],
      namaPihak: NAMA,
    });
    expect(hasil.tolak).toMatchObject({ alasan: "slot_anonim_memuat_nama", slot: "anonimisasi" });
    expect(hasil.tolak?.nama).toEqual(["Wulandari", "Hendrawan"]);
    expect(hasil.tolak?.sebab).toContain("Wulandari");
  });

  it("anonimisasi sungguhan lolos; putusan asli di slot putusan lolos", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [
        { slot: "putusan", bita: rtf(barisPutusan()) },
        { slot: "anonimisasi", bita: rtf(barisPutusan(NOMOR, { anonim: true })) },
      ],
      namaPihak: NAMA,
    });
    expect(hasil.tolak).toBeNull();
    expect(hasil.peringatan).toEqual([]);
    expect(hasil.diperiksa).toEqual(["putusan", "anonimisasi"]);
    expect(hasil.nomorIsi).toEqual({ putusan: NOMOR, anonimisasi: NOMOR });
  });

  it("slot putusan yang tidak memuat satu nama pun hanya DIPERINGATKAN", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [{ slot: "putusan", bita: rtf(barisPutusan(NOMOR, { anonim: true })) }],
      namaPihak: NAMA,
    });
    expect(hasil.tolak).toBeNull();
    expect(hasil.peringatan.join(" ")).toContain("tidak memuat satu pun nama pihak");
  });

  it("PDF dan DOCX tidak dibaca: hanya peringatan, tidak ditolak", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [
        { slot: "putusan", bita: new TextEncoder().encode("%PDF-1.7 isi") },
        { slot: "anonimisasi", bita: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]) },
      ],
      namaPihak: NAMA,
    });
    expect(hasil.tolak).toBeNull();
    expect(hasil.diperiksa).toEqual([]);
    expect(hasil.peringatan).toHaveLength(2);
    expect(hasil.peringatan[0]).toContain("PDF");
    expect(hasil.peringatan[1]).toContain("DOCX");
    expect(hasil.peringatan[1]).toContain("nama pihak");
  });

  it("nama pihak tidak terbaca: slot tidak diperiksa, dan itu DIKATAKAN", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    for (const namaPihak of [null, [] as string[], ["Ali bin Umar"]]) {
      const hasil = periksaBerkasUnggahSipp({
        nomorPerkara: NOMOR,
        berkas: [{ slot: "anonimisasi", bita: rtf(barisPutusan()) }],
        namaPihak,
        sebabPihak: "bot mati",
      });
      expect(hasil.tolak).toBeNull();
      expect(hasil.peringatan.join(" ")).toContain("Nama pihak tidak terbaca dari SIPP");
    }
  });

  it("BAS, PHS, dan relaas ditolak dengan namanya - di slot mana pun", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    for (const [baris, jenisNama] of [
      [BARIS_BAS, "Berita Acara"],
      [BARIS_PHS, "Penetapan Hari Sidang"],
      [BARIS_RELAAS, "Relaas"],
    ] as const) {
      const hasil = periksaBerkasUnggahSipp({
        nomorPerkara: NOMOR,
        berkas: [{ slot: "putusan", bita: rtf([...baris]) }],
        namaPihak: NAMA,
      });
      expect(hasil.tolak?.alasan).toBe("bukan_putusan");
      expect(hasil.tolak?.sebab).toContain(jenisNama);
    }
  });

  it("nomor isi berbeda dan nomor isi yang tidak ada ditolak", async () => {
    const { periksaBerkasUnggahSipp } = await muat();
    const beda = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [{ slot: "putusan", bita: rtf(barisPutusan("13/Pdt.G/2026/PA.Dgl")) }],
      namaPihak: NAMA,
    });
    expect(beda.tolak).toMatchObject({ alasan: "nomor_isi_berbeda", nomorIsi: "13/Pdt.G/2026/PA.Dgl" });
    const tanpa = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [{ slot: "anonimisasi", bita: rtf(barisPutusan("-", { anonim: true })) }],
      namaPihak: NAMA,
    });
    expect(tanpa.tolak?.alasan).toBe("nomor_isi_tidak_ada");
  });
});

// ============================================================================
// 4. RUTE unggah-sipp DIJALANKAN
// ============================================================================
function permintaanUnggah(
  berkas: Partial<Record<"putusan" | "anonimisasi", Uint8Array>>,
  kepala: Record<string, string> = {},
  lain: Record<string, string> = {}
) {
  const borang = new FormData();
  borang.append("nomorPerkara", lain.nomorPerkara ?? NOMOR);
  borang.append("olehUsername", "petugas uji");
  if (lain.perkaraId) borang.append("perkaraId", lain.perkaraId);
  for (const [slot, bita] of Object.entries(berkas)) {
    // Salinan ber-ArrayBuffer: BlobPart tidak menerima Uint8Array<ArrayBufferLike>.
    if (bita) borang.append(slot, new File([new Uint8Array(bita)], `${slot}.rtf`));
  }
  return new Request("http://uji.local/aleta/api/aleta-ecourt/putusan/unggah-sipp", {
    method: "POST",
    body: borang,
    headers: kepala,
  });
}

async function jalankanUnggahSipp(permintaan: Request) {
  const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route");
  const jawaban = await mod.POST(permintaan as unknown as Parameters<typeof mod.POST>[0]);
  return { status: jawaban.status, badan: (await jawaban.json()) as Record<string, unknown> };
}

describe("rute unggah-sipp - satu atau dua slot, isi diperiksa, IP diteruskan", () => {
  it("putusan SAJA diterima; anonimisasiBase64 tidak dikirim sama sekali", async () => {
    const { status, badan } = await jalankanUnggahSipp(permintaanUnggah({ putusan: rtf(barisPutusan()) }));
    expect(status).toBe(200);
    expect(badan.ok).toBe(true);
    expect(keadaan.unggah).toHaveLength(1);
    const muatan = keadaan.unggah[0];
    expect(Buffer.from(String(muatan.putusanBase64), "base64").toString("latin1").startsWith("{\\rtf1")).toBe(true);
    expect("anonimisasiBase64" in muatan).toBe(false);
    expect(muatan.perkaraId).toBe("901");
    expect((badan.data as { nomorIsi: unknown }).nomorIsi).toEqual({ putusan: NOMOR });
  });

  it("akun ALETA penekan diteruskan sebagai operator jejak ALETA (uji rilis U1, 9 Okt 2026)", async () => {
    // Server satker 9 Okt: baris aleta_bot_jejak_penetapan "unggah edoc_putusan"
    // (533 & 561/Pdt.G/2026) berkolom operator KOSONG - rute ini tidak
    // meneruskannya. Operatornya dari sesi (pastikanKapabilitas), bukan badan.
    const { status } = await jalankanUnggahSipp(permintaanUnggah({ putusan: rtf(barisPutusan()) }));
    expect(status).toBe(200);
    expect(keadaan.unggah).toHaveLength(1);
    expect(keadaan.unggah[0].operator).toBe("Penguji");
    // Akun SIPP yang membuka halaman tetap pelaku di SIPP - bukan akun ALETA.
    expect(keadaan.unggah[0].olehUsername).toBe("petugas uji");
  });

  it("anonimisasi SAJA diterima", async () => {
    const { status } = await jalankanUnggahSipp(
      permintaanUnggah({ anonimisasi: rtf(barisPutusan(NOMOR, { anonim: true })) })
    );
    expect(status).toBe(200);
    expect(keadaan.unggah).toHaveLength(1);
    expect("putusanBase64" in keadaan.unggah[0]).toBe(false);
    expect(String(keadaan.unggah[0].anonimisasiBase64).length).toBeGreaterThan(0);
  });

  it("slot anonimisasi yang memuat nama pihak: 409 dengan pesan, dan TIDAK ada yang dikirim ke bot", async () => {
    const { status, badan } = await jalankanUnggahSipp(
      permintaanUnggah({ putusan: rtf(barisPutusan()), anonimisasi: rtf(barisPutusan()) })
    );
    expect(status).toBe(409);
    expect(badan.ok).toBe(false);
    const data = badan.data as { alasan: string; sebab: string; nama: string[] };
    expect(data.alasan).toBe("slot_anonim_memuat_nama");
    expect(data.nama).toEqual(["Wulandari", "Hendrawan"]);
    expect((badan.error as { message: string }).message).toBe(data.sebab);
    expect(keadaan.unggah).toHaveLength(0);
  });

  it("nama kuasa hukum di anonimisasi TIDAK menahan unggahan", async () => {
    const anonimBerkuasa = [...barisPutusan(NOMOR, { anonim: true }), "Kuasa hukum Bambang Setiawan, S.H."];
    const { status } = await jalankanUnggahSipp(permintaanUnggah({ anonimisasi: rtf(anonimBerkuasa) }));
    expect(status).toBe(200);
  });

  it("RTF bernomor lain: 409 nomor_isi_berbeda", async () => {
    const { status, badan } = await jalankanUnggahSipp(
      permintaanUnggah({ putusan: rtf(barisPutusan("99/Pdt.G/2026/PA.Dgl")) })
    );
    expect(status).toBe(409);
    expect((badan.data as { alasan: string }).alasan).toBe("nomor_isi_berbeda");
    expect(keadaan.unggah).toHaveLength(0);
  });

  it("PDF di slot anonimisasi: diteruskan dengan peringatan, bukan ditolak", async () => {
    const { status, badan } = await jalankanUnggahSipp(
      permintaanUnggah({ putusan: rtf(barisPutusan()), anonimisasi: new TextEncoder().encode("%PDF-1.7 anonim") })
    );
    expect(status).toBe(200);
    expect(keadaan.unggah).toHaveLength(1);
    expect((badan.data as { peringatan: string[] }).peringatan.join(" ")).toContain("PDF");
  });

  it("nama pihak tidak terbaca: tetap diteruskan, dengan peringatan", async () => {
    keadaan.konteks = { ok: false, error: "aleta_bot tidak merespons" };
    const { status, badan } = await jalankanUnggahSipp(permintaanUnggah({ anonimisasi: rtf(barisPutusan()) }));
    expect(status).toBe(200);
    expect((badan.data as { peringatan: string[] }).peringatan.join(" ")).toContain("aleta_bot tidak merespons");
  });

  it("hanya PDF: nama pihak tidak ditanyakan sama sekali", async () => {
    await jalankanUnggahSipp(permintaanUnggah({ putusan: new TextEncoder().encode("%PDF-1.7 x") }));
    expect(keadaan.panggilKonteks).toBe(0);
    expect(keadaan.unggah).toHaveLength(1);
  });

  it("IP peramban diteruskan: entri TERAKHIR X-Forwarded-For, lalu X-Real-IP", async () => {
    await jalankanUnggahSipp(
      permintaanUnggah({ putusan: rtf(barisPutusan()) }, { "x-forwarded-for": "203.0.113.9, 192.168.9.121" })
    );
    // Entri pertama dapat dikarang peramban; yang ditulis Apache entri terakhir.
    expect(keadaan.unggah[0].ip).toBe("192.168.9.121");

    await jalankanUnggahSipp(permintaanUnggah({ putusan: rtf(barisPutusan()) }, { "x-real-ip": "192.168.9.44" }));
    expect(keadaan.unggah[1].ip).toBe("192.168.9.44");

    await jalankanUnggahSipp(permintaanUnggah({ putusan: rtf(barisPutusan()) }));
    expect(keadaan.unggah[2].ip).toBe("");
  });

  it("status perkara dan nama pihak ditanyakan BERSAMAAN, lalu perkara yang tidak ada tetap ditolak", async () => {
    keadaan.status = { ok: true, data: { identitas: {} } };
    const { status, badan } = await jalankanUnggahSipp(permintaanUnggah({ putusan: rtf(barisPutusan()) }));
    expect(status).toBe(200);
    expect(String((badan.data as { sebab: string }).sebab)).toContain("tidak ditemukan di SIPP");
    expect(keadaan.panggilStatus).toBe(1);
    expect(keadaan.unggah).toHaveLength(0);
  });
});

// ============================================================================
// 5. unggah-naskah: nomorIsi, nomor berbeda, dan naskah yang bukan putusan
// ============================================================================
describe("unggahNaskahPutusan dan rute unggah-naskah", () => {
  const muat = async () => import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
  const unggah = async (baris: string[], nomorPerkara = NOMOR) =>
    (await muat()).unggahNaskahPutusan({} as never, "usr_uji", {
      bita: rtf(baris),
      namaBerkas: "naskah.rtf",
      perkaraId: "",
      nomorPerkara,
    });

  it("naskah yang diterima memulangkan nomorIsi", async () => {
    const hasil = await unggah(barisPutusan());
    expect(hasil).toMatchObject({ ok: true, nomorIsi: NOMOR, drafId: "drf_uji" });
    expect(keadaan.draf).toHaveLength(1);
  });

  it("nomor isi berbeda ditolak 'nomor_isi_berbeda' SEBELUM gerbang ditanya", async () => {
    const hasil = await unggah(barisPutusan("13/Pdt.G/2026/PA.Dgl"));
    expect(hasil).toMatchObject({ ok: false, alasan: "nomor_isi_berbeda", nomorIsi: "13/Pdt.G/2026/PA.Dgl" });
    expect(hasil.sebab).toContain("13/Pdt.G/2026/PA.Dgl");
    expect(keadaan.panggilStatus).toBe(0);
    expect(keadaan.draf).toHaveLength(0);
  });

  it("PHS dahulu menjadi draf dengan amar 'Menetapkan hari sidang'; kini ditolak", async () => {
    const hasil = await unggah(BARIS_PHS);
    expect(hasil).toMatchObject({ ok: false, alasan: "bukan_putusan" });
    expect(hasil.sebab).toContain("Penetapan Hari Sidang");
    expect(keadaan.draf).toHaveLength(0);
  });

  it("BAS dan relaas ditolak dengan namanya", async () => {
    expect((await unggah(BARIS_BAS)).sebab).toContain("Berita Acara");
    expect((await unggah(BARIS_RELAAS)).sebab).toContain("Relaas");
    expect(keadaan.draf).toHaveLength(0);
  });

  it("naskah tempelan tanpa nomor ber-'Pdt.' tetap diterima dengan nomorIsi kosong", async () => {
    const tanpaNomor = barisPutusan().filter((b) => !b.includes(NOMOR));
    const hasil = await unggah(tanpaNomor);
    expect(hasil).toMatchObject({ ok: true, nomorIsi: "" });
  });

  it("rute unggah-naskah meneruskan nomorIsi ke ekstensi", async () => {
    const borang = new FormData();
    borang.append("nomorPerkara", NOMOR);
    borang.append("berkas", new File([new Uint8Array(rtf(barisPutusan()))], "naskah.rtf"));
    const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-naskah/route");
    const jawaban = await mod.POST(
      new Request("http://uji.local/x", { method: "POST", body: borang }) as unknown as Parameters<typeof mod.POST>[0]
    );
    const badan = (await jawaban.json()) as { data: { ok: boolean; nomorIsi: string } };
    expect(badan.data).toMatchObject({ ok: true, nomorIsi: NOMOR });
  });
});
