// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bandingDrafA1 } from "@/lib/banding-draf-a1";
import { susunDrafPutusanA1, type MasukanDrafA1, type PemeriksaRak, type SaksiA1 } from "@/lib/draf-putusan-a1";
import type { Dalil, MatriksDalil } from "@/lib/matriks-dalil";
import {
  AMBANG_POLA,
  BATAS_TEKS_MEMORI,
  koreksiDariBanding,
  koreksiTersering,
  pisahNaskahPutusan,
  polaBerulang,
  polaTersamar,
  ringkasBulanan,
  skorKecocokan,
  teksMemori,
  usulanMemori,
  type BarisUkur,
  type Koreksi,
} from "@/lib/pengukur-draf";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_PENGUKUR_DRAF } from "@/server/db/schema";
import {
  bacaUsulan,
  detakPengukurDraf,
  jalankanPengukur,
  pasangPelabuhanMemori,
  segarkanUsulan,
  susunLaporan,
  teruskanUsulan,
  tolakUsulan,
  ukurPerkara,
  type DepsPengukur,
  type PelabuhanMemoriProyek,
  type PutusanBot,
} from "@/server/modules/aleta-ecourt/pengukur-draf";

/**
 * P3 (1 Nov 2026) - pengukur draf putusan A1 vs putusan akhir. Aturan murni, tanpa AI.
 *
 * Diukur di luar uji ini (skrip D:/Aplikasi/aleta/tmp/p3-ukur/ukur-p3.ts atas sipp_2810 lokal): 20 putusan cerai yang sudah putus
 * (3 ketua majelis) vs draf A1 yang disusun ulang. Hasil: amar 96,2% (sama persis 94,9%), dasar hukum 69,1% (terverifikasi 24,2%),
 * bagian pertimbangan 92,4%, huruf alasan 78,9%; koreksi tersering: bagian kaidah fikih ditambah hakim 16/20, Pasal 119 KHI
 * dibuang hakim 10/20, Pasal 7 KHI ditambah 8/20. Uji ini memakai bahan sintetis (tanpa nama pihak sungguhan).
 */

// ── Bahan sintetis (meniru bentuk 601/Pdt.G/2026, nama dikarang) ─────────────
function dalil(nomor: string, teks: string, huruf: string[] = []): Dalil {
  return {
    id: `G-${nomor.padStart(10, "0")}`,
    sumber: "gugatan",
    pihak: "0046",
    sebutan: "Penggugat",
    bagian: "pokok",
    nomor,
    urut: Number(nomor) || 0,
    induk: null,
    lanjutan: null,
    teks,
    ringkas: teks.slice(0, 60),
    jenis: "posita-fakta",
    huruf,
    tanggapan: { status: "belum-dijawab", ragu: false, rincian: [] },
    pembuktian: null,
    asal: "sipp",
    dokumen: "posita SIPP",
    diunggah: "",
    ocr: false,
    berkas: -1,
  };
}

const MATRIKS: MatriksDalil = (() => {
  const d = [
    dalil("1", "1. Bahwa pada tanggal 04 April 2021, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat Pegawai Pencatat Nikah;"),
    dalil("4", "4. Bahwa sejak bulan Oktober 2024 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan Tergugat kurang memnuhi nafkah;", ["F"]),
    dalil("5", "5. Bahwa puncak keretakan terjadi pada Januri 2025, Tergugat pergi meninggalkan kediaman bersama dan sejak itu Penggugat dan Tergugat berpisah tempat tinggal hingga sekarang;", ["B", "F"]),
  ];
  return { versi: 1, sumberGugatan: "sipp", dalil: d, dokumen: [], ringkas: { jumlah: d.length, perSumber: {}, perJenis: {}, tanggapan: {}, ragu: 0, huruf: ["B", "F"] }, catatan: [], ms: 1 };
})();

const SAKSI: SaksiA1[] = [1, 2].map((ke) => ({
  pihak: "P",
  ke,
  tanyaJawab: [
    { tanya: "Bagaimana rumah tangga?", jawab: "Sejak Oktober 2024 sering terjadi perselisihan dan pertengkaran karena Tergugat kurang memberi nafkah;" },
    { tanya: "Apakah masih serumah?", jawab: "Sudah berpisah tempat tinggal sejak Januari 2025, Tergugat pergi meninggalkan kediaman bersama;" },
  ],
}));

const PETITUM =
  "<ol><li>Mengabulkan Gugatan Penggugat;</li><li>Menjatuhkan talak satu ba'in shughra Tergugat (Budi bin Ali) terhadap Penggugat (Sari binti Umar);</li><li>Membebankan biaya perkara ini sesuai peraturan yang berlaku;</li></ol>";

const RAK_TIRUAN: PemeriksaRak = (t) =>
  /Undang-Undang Nomor 1 Tahun 1974|Peraturan Pemerintah Nomor 9 Tahun 1975|Kompilasi Hukum Islam|KUHPerdata/.test(t)
    ? { boleh: true, sebab: "" }
    : { boleh: false, sebab: "belum dicocokkan dengan naskah resmi" };

function masukan(ubah: Partial<MasukanDrafA1> = {}): MasukanDrafA1 {
  return {
    jenisPerkara: "Cerai Gugat",
    nomorPerkara: "601/Pdt.G/2026/PA.Dgl",
    arah: "dikabulkan",
    verstek: true,
    sebutan: { P: "Penggugat", T: "Tergugat" },
    namaPihak1: ["Sari binti Umar"],
    namaPihak2: ["Budi bin Ali"],
    satker: "Donggala",
    biaya: 258500,
    petitum: PETITUM,
    matriks: MATRIKS,
    saksi: SAKSI,
    bukti: { P: ["P.1 Fotokopi Kartu Tanda Penduduk atas nama Penggugat"], T: [] },
    lamaPisah: "1 (satu) tahun 7 (tujuh) bulan",
    lewatEcourt: true,
    periksaRak: RAK_TIRUAN,
    ...ubah,
  };
}

// Putusan akhir: biaya beda (angka nyata), satu butir amar baru (nama anak), pertimbangan menambah Pasal 7 KHI + kaidah fikih,
// tidak memakai Pasal 116 KHI (hanya huruf E di Pasal 19 PP 9/1975).
const AMAR_AKHIR =
  "<ol><li>Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;</li><li>Mengabulkan gugatan Penggugat secara verstek;</li><li>Menjatuhkan talak satu ba&#39;in shughra Tergugat (Budi bin Ali) terhadap Penggugat (Sari binti Umar);</li><li>Menetapkan anak Penggugat dan Tergugat yang bernama Ukkasyah Muhammad Azmi bin Budi, umur 3 tahun, berada di bawah hadhanah Penggugat;</li><li>Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp184.500,00 (seratus delapan puluh empat ribu lima ratus rupiah).</li></ol>";
const PERT_AKHIR =
  "<p>Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;</p><p>Menimbang, bahwa Penggugat mendasarkan gugatannya pada Pasal 19 huruf e Peraturan Pemerintah Nomor 9 Tahun 1975;</p><p>Menimbang, bahwa berdasarkan Pasal 7 Kompilasi Hukum Islam perkawinan dibuktikan dengan akta nikah;</p><p>Artinya : Al-Qur'an surat Ar-Rum ayat 21 kaidah fikih ...</p>";

const NAMA_RAHASIA = ["Budi", "Sari", "Ukkasyah", "Azmi"];

describe("pembanding: nominal amar tidak mengganggu", () => {
  it("biaya perkara kosong di draf vs angka nyata di putusan = butir amar SAMA (bukan hilang + lebih)", () => {
    const d = susunDrafPutusanA1(masukan({ biaya: null }));
    const b = bandingDrafA1(d, { amarHtml: AMAR_AKHIR, pertimbanganHtml: PERT_AKHIR });
    expect(b.amar.hilang.join(" ")).not.toMatch(/biaya perkara/);
    expect(b.amar.lebih.join(" ")).not.toMatch(/biaya perkara/);
  });
});

describe("koreksi dari satu perbandingan (tersamar)", () => {
  const d = susunDrafPutusanA1(masukan());
  const b = bandingDrafA1(d, { amarHtml: AMAR_AKHIR, pertimbanganHtml: PERT_AKHIR });
  const koreksi = koreksiDariBanding(b, d.namaSamaran);

  it("skor: pembilang dan penyebut", () => {
    const s = skorKecocokan(b);
    expect(s.amarAkhir).toBe(5);
    expect(s.amarCocok).toBeGreaterThanOrEqual(4);
    expect(s.amarCocok).toBeLessThan(5);
    expect(s.dasarAkhir).toBe(b.dasar.akhir.length);
    expect(s.bagianCocok).toBe(b.bagian.akhir.length - b.bagian.hilang.length);
    expect(s.hurufSama).toBe(0); // draf F, putusan akhir E
  });

  it("pola koreksi hakim: pasal ditambah, bagian kaidah ditambah, butir amar ditambah, huruf diganti", () => {
    const peta = new Map(koreksi.map((k) => [`${k.jenis}|${k.kunci}`, k]));
    expect(peta.has("pasal-ditambah|KHI|7")).toBe(true);
    expect(peta.get("pasal-ditambah|KHI|7")?.ringkas).toBe("Pasal 7 Kompilasi Hukum Islam");
    expect(peta.has("bagian-ditambah|kaidah")).toBe(true);
    expect(peta.has("huruf-ditambah|E")).toBe(true);
    expect(peta.has("huruf-dibuang|F")).toBe(true);
    const amar = koreksi.find((k) => k.jenis === "amar-ditambah");
    expect(amar?.ringkas).toMatch(/^Menetapkan anak Penggugat dan Tergugat yang bernama <nama>/);
  });

  it("TERSAMAR: tak satu pun nama pihak/anak, angka, atau nominal tersisa di koreksi", () => {
    const semua = JSON.stringify(koreksi);
    for (const n of NAMA_RAHASIA) expect(semua).not.toContain(n);
    expect(koreksi.filter((k) => k.jenis.startsWith("amar") || k.jenis === "kalimat-diganti").every((k) => !/\d{2,}/.test(k.ringkas))).toBe(true);
  });

  it("INPRES-1-1991 = KHI; pasal yang hanya beda sebutan bukan koreksi", () => {
    const hasil = koreksiDariBanding({ ...b, dasar: { ...b.dasar, hilang: ["INPRES-1-1991|116"], lebih: ["KHI|116"], sama: [], samaBertanda: [], akhir: [] } }, []);
    expect(hasil.filter((k) => k.jenis.startsWith("pasal"))).toEqual([]);
    const hanyaTambah = koreksiDariBanding({ ...b, dasar: { ...b.dasar, hilang: ["INPRES-1-1991|119"], lebih: [], sama: [], samaBertanda: [], akhir: [] } }, []);
    expect(hanyaTambah.find((k) => k.jenis === "pasal-ditambah")).toMatchObject({ kunci: "KHI|119", ringkas: "Pasal 119 Kompilasi Hukum Islam" });
  });
});

describe("polaTersamar", () => {
  it("membuang isi kurung, bin/binti, nama pihak, nama berhuruf besar di tengah kalimat, angka, nominal, tanggal", () => {
    const t = polaTersamar("Menghukum Penggugat (Sari binti Umar) membayar nafkah Iddah Rp3.000.000,00 kepada Fatimah Azzahra pada 12 Maret 2026 selama 3 bulan", ["Sari binti Umar"]);
    expect(t).not.toMatch(/Sari|Umar|Fatimah|Azzahra|3\.000|12 Maret|\b3\b/);
    expect(t).toContain("Rp N");
    expect(t).toContain("nafkah Iddah");
    expect(t).toContain("<tanggal>");
  });
  it("nama tanpa bin/binti pun hilang (calon nama anak/saksi)", () => {
    expect(polaTersamar("Menetapkan anak yang bernama Ukkasyah Muhammad berada di bawah asuhan Penggugat")).toBe("Menetapkan anak yang bernama <nama> berada di bawah asuhan Penggugat");
  });
});

describe("ringkasan bulanan, pola berulang, usulan memori", () => {
  const koreksiA = (jenis: Koreksi["jenis"], kunci: string, ringkas: string): Koreksi => ({ jenis, kunci, ringkas });
  const skor = (amarAkhir: number, amarCocok: number, dasarAkhir: number, dasarCocok: number, hurufSama: -1 | 0 | 1 = 1) => ({
    amarAkhir,
    amarCocok,
    amarPersis: amarCocok,
    dasarAkhir,
    dasarCocok,
    dasarTerverifikasi: 0,
    bagianAkhir: 4,
    bagianCocok: 3,
    hurufSama,
  });
  const H1 = "Hakim Satu, S.H.";
  const H2 = "Hakim Dua, S.H.";
  const baris: BarisUkur[] = [
    ...[1, 2, 3, 4].map((i) => ({ perkaraId: `a${i}`, hakim: H1, bulan: "2026-10", skor: skor(4, 4, 10, 6), koreksi: [koreksiA("bagian-ditambah", "kaidah", "kaidah fikih, dalil Al-Qur'an, atau hadis"), ...(i <= 3 ? [koreksiA("pasal-dibuang", "KHI|119", "Pasal 119 Kompilasi Hukum Islam")] : [])] })),
    ...[1, 2, 3, 4, 5].map((i) => ({ perkaraId: `b${i}`, hakim: H2, bulan: "2026-09", skor: skor(2, 1, 10, 2, i % 2 ? 1 : 0), koreksi: i <= 2 ? [koreksiA("pasal-ditambah", "KHI|7", "Pasal 7 Kompilasi Hukum Islam")] : [] })),
  ];

  it("bulanan = jumlah pembilang / jumlah penyebut (bukan rata-rata persen)", () => {
    const b = ringkasBulanan(baris);
    expect(b.map((x) => x.bulan)).toEqual(["2026-10", "2026-09"]);
    expect(b[0]).toMatchObject({ perkara: 4, amar: 100, dasar: 60, bagian: 75, huruf: 100 });
    expect(b[1]).toMatchObject({ perkara: 5, amar: 50, dasar: 20, huruf: 60 });
  });

  it("hurufSama -1 tidak dihitung", () => {
    const b = ringkasBulanan([{ perkaraId: "x", hakim: H1, bulan: "2026-10", skor: skor(1, 1, 1, 1, -1), koreksi: [] }]);
    expect(b[0].huruf).toBeNull();
  });

  it("pola berulang: ambang 3 perkara dan 40%, per hakim dan semua hakim; hakim lain tidak bocor ke kelompok hakim", () => {
    const p = polaBerulang(baris);
    const semua = p.filter((x) => x.lingkup === "semua");
    expect(semua.map((x) => `${x.jenis}|${x.kunci}|${x.perkara}/${x.dari}`)).toEqual(["bagian-ditambah|kaidah|4/9"]); // Pasal 119: 3/9 = 33% < 40%
    const h1 = p.filter((x) => x.hakim === H1);
    expect(h1.map((x) => `${x.kunci}|${x.perkara}/${x.dari}|${x.persen}`)).toEqual(["kaidah|4/4|100", "KHI|119|3/4|75"]);
    expect(p.filter((x) => x.hakim === H2)).toEqual([]); // 2 dari 5 = 40% tetapi hanya 2 perkara (< 3)
    expect(AMBANG_POLA).toEqual({ minPerkara: 3, minPersen: 40, teratas: 6 });
  });

  it("kelompok kurang dari 3 perkara tidak menghasilkan pola; paling banyak 6 pola per kelompok", () => {
    expect(polaBerulang(baris.slice(0, 2))).toEqual([]);
    const banyak: BarisUkur[] = [1, 2, 3].map((i) => ({ perkaraId: `c${i}`, hakim: H1, bulan: "2026-10", skor: skor(1, 1, 1, 1), koreksi: Array.from({ length: 9 }, (_, n) => koreksiA("pasal-ditambah", `KHI|${n + 1}`, `Pasal ${n + 1}`)) }));
    expect(polaBerulang(banyak).filter((x) => x.lingkup === "hakim")).toHaveLength(6);
  });

  it("koreksi tersering: hanya yang terjadi pada >= 2 perkara", () => {
    const t = koreksiTersering(baris, 5);
    expect(t[0]).toMatchObject({ kunci: "kaidah", perkara: 4 });
    expect(t.every((x) => x.perkara >= 2)).toBe(true);
  });

  it("usulan memori: id stabil, panjang aman, tanpa nama pihak; lingkup hakim menyebut ketua majelis, lingkup semua tidak", () => {
    const u = usulanMemori(polaBerulang(baris));
    expect(u).toHaveLength(3);
    expect(usulanMemori(polaBerulang(baris)).map((x) => x.id)).toEqual(u.map((x) => x.id));
    expect(new Set(u.map((x) => x.id)).size).toBe(3);
    for (const x of u) {
      expect(x.teks.length).toBeLessThanOrEqual(BATAS_TEKS_MEMORI);
      expect(x.teks.length).toBeGreaterThan(8);
      expect(x.teks).not.toMatch(/aleta/i);
    }
    expect(u.find((x) => x.lingkup === "hakim")?.teks).toContain(`majelis yang diketuai ${H1}`);
    expect(u.find((x) => x.lingkup === "semua")?.teks).toContain("para hakim");
  });

  it("teksMemori tiap jenis menyebut ringkasnya dan angka kejadian", () => {
    const jenis = ["pasal-ditambah", "pasal-dibuang", "bagian-ditambah", "amar-ditambah", "amar-dibuang", "kalimat-diganti", "huruf-ditambah", "huruf-dibuang"] as const;
    for (const j of jenis) {
      const t = teksMemori({ lingkup: "semua", hakim: "", jenis: j, kunci: "k", ringkas: "RINGKAS-X", perkara: 5, dari: 8, persen: 62.5 });
      expect(t).toContain("RINGKAS-X");
      expect(t).toContain("5 dari 8");
    }
  });
});

describe("dokumen putusan -> pertimbangan + amar", () => {
  const DOK = [
    "P U T U S A N",
    "Nomor 601/Pdt.G/2026/PA.Dgl",
    "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
    "Menimbang, bahwa berdasarkan Pasal 7 Kompilasi Hukum Islam ...;",
    "M E N G A D I L I",
    "1. Mengabulkan gugatan Penggugat secara verstek;",
    "2. Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp184.500,00;",
    "Demikian diputuskan dalam rapat permusyawaratan Majelis Hakim pada hari Selasa,",
  ].join("\n");
  it("dipisah di MENGADILI dan DEMIKIAN DIPUTUSKAN", () => {
    const r = pisahNaskahPutusan(DOK)!;
    expect(r.pertimbanganHtml).toContain("Pasal 7 Kompilasi");
    expect(r.pertimbanganHtml).not.toContain("Mengabulkan");
    expect(r.amarHtml).toContain("Mengabulkan gugatan");
    expect(r.amarHtml).not.toContain("Demikian");
  });
  it("tanpa MENGADILI atau tanpa Menimbang = null", () => {
    expect(pisahNaskahPutusan("Menimbang, bahwa ...")).toBeNull();
    expect(pisahNaskahPutusan("M E N G A D I L I\n1. Mengabulkan;")).toBeNull();
  });
});

// ── Server: basis data, tiruan bot ──────────────────────────────────────────
const HARI_INI = new Date("2026-10-28T03:00:00Z"); // 11.00 WITA
const draf = susunDrafPutusanA1(masukan());
const drafTolak = susunDrafPutusanA1(masukan({ arah: "ditolak", verstek: false }));

async function simpanDraf(db: AletaDatabase, perkaraId: string, tanggalSidang: string, opsi: { tolak?: boolean; majelis?: string } = {}) {
  const h7 = {
    perkaraId,
    nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    tanggalSidang,
    majelis: opsi.majelis ?? "Hakim Satu, S.H.",
    putusan: draf,
    varian: opsi.tolak ? [{ status: "ditolak", putusan: drafTolak }] : [],
  };
  await db.run(
    `INSERT INTO aleta_agen_h7_draf (perkara_id, tanggal_sidang, nomor_perkara, jenis_perkara, draf_json, dibuat_pada, diperbarui_pada) VALUES (?, ?, ?, 'Cerai Gugat', ?, '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z')`,
    [perkaraId, tanggalSidang, h7.nomorPerkara, JSON.stringify(h7)]
  );
}

function putusan(id: number, ubah: Partial<PutusanBot> = {}): PutusanBot {
  return {
    perkaraId: id,
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    tanggalPutusan: "2026-10-27",
    statusPutusanId: 62,
    verstek: true,
    amarPutusan: AMAR_AKHIR,
    pertimbanganHukum: PERT_AKHIR,
    adaBerkas: true,
    hakimKetua: "Hakim Satu, S.H.",
    majelis: ["Hakim Satu, S.H.", "Hakim Dua, S.H."],
    ...ubah,
  };
}

function depsUji(peta: Record<string, PutusanBot>, o: { dokumen?: string | null } = {}) {
  const hitung = { bahan: 0, perkara: 0, dokumen: 0 };
  const deps: DepsPengukur = {
    bahan: async (ids) => {
      hitung.bahan += 1;
      hitung.perkara += ids.length;
      return { ok: true, perkara: ids.map((i) => peta[i]).filter(Boolean) };
    },
    dokumen: async () => {
      hitung.dokumen += 1;
      return o.dokumen ?? null;
    },
    kini: () => HARI_INI,
  };
  return { deps, hitung };
}

describe("pengukur: penyimpanan & lintasan", () => {
  let db: AletaDatabase | null = null;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    pasangPelabuhanMemori(null);
  });
  afterEach(async () => {
    await db?.close();
    db = null;
    pasangPelabuhanMemori(null);
  });

  it("satu panggilan bot untuk banyak perkara (tanpa N+1); hasil tersimpan; kedua kali = tidak diukur ulang", async () => {
    for (const i of [701, 702, 703]) await simpanDraf(db!, String(i), "2026-10-27");
    const { deps, hitung } = depsUji({ "701": putusan(701), "702": putusan(702), "703": putusan(703) });
    const a = await jalankanPengukur(db!, deps, "malam");
    expect(a).toMatchObject({ calon: 3, diukur: 3, sama: 0, gagal: 0 });
    expect(hitung).toMatchObject({ bahan: 1, perkara: 3 });
    const baris = await db!.queryAll<Record<string, unknown>>("SELECT * FROM aleta_pengukur_draf ORDER BY perkara_id");
    expect(baris).toHaveLength(3);
    expect(baris[0]).toMatchObject({ perkara_id: "701", hakim: "Hakim Satu, S.H.", bulan: "2026-10", varian: "dikabulkan", sumber: "sipp", tanggal_sidang_draf: "2026-10-27", huruf_draf: "F", huruf_akhir: "E", huruf_sama: 0 });
    expect(Number(baris[0].amar_akhir)).toBe(5);
    expect(String(baris[0].koreksi_json)).toContain("KHI|7");
    for (const n of NAMA_RAHASIA) expect(String(baris[0].koreksi_json)).not.toContain(n);
    const diukurPada = baris[0].diukur_pada;
    const b = await jalankanPengukur(db!, deps, "malam");
    expect(b).toMatchObject({ diukur: 0, sama: 3 });
    expect((await db!.queryAll<Record<string, unknown>>("SELECT diukur_pada FROM aleta_pengukur_draf WHERE perkara_id = '701'"))[0].diukur_pada).toBe(diukurPada);
  });

  it("putusan disunting sesudah diukur = diukur ulang (sidik berubah), satu baris per perkara", async () => {
    await simpanDraf(db!, "710", "2026-10-27");
    const peta = { "710": putusan(710) };
    const { deps } = depsUji(peta);
    await jalankanPengukur(db!, deps, "malam");
    peta["710"] = putusan(710, { pertimbanganHukum: PERT_AKHIR + "<p>Menimbang, bahwa Pasal 3 Kompilasi Hukum Islam ...</p>" });
    const r = await jalankanPengukur(db!, deps, "malam");
    expect(r).toMatchObject({ diukur: 1, sama: 0 });
    const baris = await db!.queryAll<Record<string, unknown>>("SELECT koreksi_json FROM aleta_pengukur_draf");
    expect(baris).toHaveLength(1);
    expect(String(baris[0].koreksi_json)).toContain("KHI|3");
  });

  it("pemicu peristiwa tidak menanyakan lagi perkara yang sudah terukur (bot tidak dipanggil)", async () => {
    await simpanDraf(db!, "720", "2026-10-27");
    const { deps, hitung } = depsUji({ "720": putusan(720) });
    await jalankanPengukur(db!, deps, "peristiwa");
    expect(hitung.bahan).toBe(1);
    const r = await jalankanPengukur(db!, deps, "peristiwa");
    expect(r).toMatchObject({ calon: 0, diukur: 0 });
    expect(hitung.bahan).toBe(1);
  });

  it("dilewati dengan jujur: tanpa draf, belum putus, hasil bukan dikabulkan/ditolak, tanpa varian ditolak, tanpa naskah", async () => {
    await simpanDraf(db!, "731", "2026-10-27");
    await simpanDraf(db!, "732", "2026-10-27");
    await simpanDraf(db!, "733", "2026-10-27");
    await simpanDraf(db!, "734", "2026-10-28"); // Hari Putusan SESUDAH tanggal putusan -> bukan draf perkara ini
    const { deps } = depsUji({});
    expect((await ukurPerkara(db!, putusan(730), deps)).status).toBe("tanpa-draf");
    expect((await ukurPerkara(db!, putusan(731, { tanggalPutusan: "" }), deps)).status).toBe("belum-putus");
    expect((await ukurPerkara(db!, putusan(732, { statusPutusanId: 64 }), deps)).status).toBe("tanpa-varian");
    expect((await ukurPerkara(db!, putusan(733, { statusPutusanId: 63 }), deps)).status).toBe("tanpa-draf"); // draf tidak punya varian ditolak
    expect((await ukurPerkara(db!, putusan(734), deps)).status).toBe("tanpa-draf");
    expect((await ukurPerkara(db!, putusan(731, { amarPutusan: "", pertimbanganHukum: "", adaBerkas: false }), deps)).status).toBe("tanpa-naskah");
    expect(await db!.queryAll("SELECT perkara_id FROM aleta_pengukur_draf")).toEqual([]);
  });

  it("varian ditolak dipakai bila putusan menolak", async () => {
    await simpanDraf(db!, "740", "2026-10-27", { tolak: true });
    const { deps } = depsUji({});
    const r = await ukurPerkara(db!, putusan(740, { statusPutusanId: 63, amarPutusan: "<ol><li>Menolak gugatan Penggugat;</li></ol>" }), deps);
    expect(r.status).toBe("diukur");
    expect((await db!.queryAll<Record<string, unknown>>("SELECT varian FROM aleta_pengukur_draf WHERE perkara_id = '740'"))[0].varian).toBe("ditolak");
  });

  it("pertimbangan SIPP kosong: dokumen putusan yang diunggah menjadi sumber; tanpa dokumen, amar saja", async () => {
    await simpanDraf(db!, "750", "2026-10-27");
    await simpanDraf(db!, "751", "2026-10-27");
    const dok = ["Menimbang, bahwa maksud dan tujuan gugatan Penggugat ...;", "Menimbang, bahwa Pasal 7 Kompilasi Hukum Islam ...;", "M E N G A D I L I", "1. Mengabulkan gugatan Penggugat secara verstek;", "Demikian diputuskan pada hari Selasa"].join("\n");
    const { deps, hitung } = depsUji({}, { dokumen: dok });
    const a = await ukurPerkara(db!, putusan(750, { pertimbanganHukum: "", amarPutusan: "" }), deps);
    expect(a.status).toBe("diukur");
    expect(hitung.dokumen).toBe(1);
    expect((await db!.queryAll<Record<string, unknown>>("SELECT sumber, amar_akhir FROM aleta_pengukur_draf WHERE perkara_id = '750'"))[0]).toMatchObject({ sumber: "dokumen" });
    const sipp = await ukurPerkara(db!, putusan(751), deps);
    expect(sipp.status).toBe("diukur");
    expect(hitung.dokumen).toBe(1); // pertimbangan SIPP ada: dokumen tidak dibaca (ringan)
  });

  it("bot tidak terjangkau: galat dicatat, tidak ada yang disimpan", async () => {
    await simpanDraf(db!, "760", "2026-10-27");
    const deps: DepsPengukur = { bahan: async () => ({ ok: false, error: "ALETA Bot tidak menjawab." }), kini: () => HARI_INI };
    const r = await jalankanPengukur(db!, deps, "malam");
    expect(r).toMatchObject({ calon: 1, diukur: 0, galat: "ALETA Bot tidak menjawab." });
  });

  it("lintasan ganda berbarengan: yang kedua langsung ditolak (tidak menumpuk)", async () => {
    await simpanDraf(db!, "770", "2026-10-27");
    let lepas: () => void = () => {};
    const tahan = new Promise<void>((r) => (lepas = r));
    const deps: DepsPengukur = {
      bahan: async () => {
        await tahan;
        return { ok: true, perkara: [putusan(770)] };
      },
      kini: () => HARI_INI,
    };
    const pertama = jalankanPengukur(db!, deps, "tangan");
    const kedua = await jalankanPengukur(db!, deps, "tangan");
    expect(kedua).toBeNull();
    lepas();
    expect(await pertama).toMatchObject({ diukur: 1 });
  });
});

describe("laporan, usulan memori, dan titik sambung", () => {
  let db: AletaDatabase | null = null;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    pasangPelabuhanMemori(null);
    // 3 perkara majelis Satu + 3 majelis Dua, semuanya dengan koreksi yang sama.
    const peta: Record<string, PutusanBot> = {};
    for (const i of [801, 802, 803]) {
      await simpanDraf(db, String(i), "2026-10-27");
      peta[String(i)] = putusan(i);
    }
    for (const i of [811, 812, 813]) {
      await simpanDraf(db, String(i), "2026-10-27", { majelis: "Hakim Dua, S.H." });
      peta[String(i)] = putusan(i, { hakimKetua: "Hakim Dua, S.H.", majelis: ["Hakim Dua, S.H."] });
    }
    await jalankanPengukur(db, depsUji(peta).deps, "malam");
  });
  afterEach(async () => {
    await db?.close();
    db = null;
    pasangPelabuhanMemori(null);
  });

  const pencocok = (nama: string) => (hakim: string, majelis: string) => hakim.includes(nama) || majelis.includes(nama);

  it("laporan: Super Admin melihat semua hakim; hakim hanya perkara majelisnya", async () => {
    const semua = await susunLaporan(db!, { lihatSemua: true, hariIni: "2026-10-28" });
    expect(semua).toMatchObject({ lingkup: "semua", jumlahPerkara: 6 });
    expect(semua.perHakim.map((h) => `${h.hakim}:${h.perkara}`)).toEqual(["Hakim Dua, S.H.:3", "Hakim Satu, S.H.:3"]);
    expect(semua.bulanan[0]).toMatchObject({ bulan: "2026-10", perkara: 6 });
    expect(semua.bulanan[0].amar).toBeGreaterThan(70);
    const saya = await susunLaporan(db!, { lihatSemua: false, milikSaya: pencocok("Hakim Satu"), hariIni: "2026-10-28" });
    expect(saya).toMatchObject({ lingkup: "saya", jumlahPerkara: 3, perHakim: [] });
    expect(saya.pola.every((p) => p.lingkup === "semua" || p.hakim === "Hakim Satu, S.H.")).toBe(true);
    const tanpa = await susunLaporan(db!, { lihatSemua: false, hariIni: "2026-10-28" });
    expect(tanpa.jumlahPerkara).toBe(0);
  });

  it("usulan memori tersimpan, tersamar, dan stabil saat dihitung ulang", async () => {
    const u = await bacaUsulan(db!);
    expect(u.length).toBeGreaterThan(0);
    expect(u.every((x) => x.status === "baru")).toBe(true);
    const semuaTeks = u.map((x) => x.teks).join("\n");
    for (const n of NAMA_RAHASIA) expect(semuaTeks).not.toContain(n);
    expect(semuaTeks).toContain("kaidah fikih");
    const ids = u.map((x) => x.id).sort();
    const ulang = await segarkanUsulan(db!);
    expect(ulang.baru).toBe(0);
    expect((await bacaUsulan(db!)).map((x) => x.id).sort()).toEqual(ids);
  });

  it("tanpa modul proyek: penerusan ditolak dengan pesan jelas dan usulan tetap baru", async () => {
    const u = await bacaUsulan(db!);
    const r = await teruskanUsulan(db!, { proyekId: "p1", ids: [u[0].id], oleh: "Super Admin" });
    expect(r.ok).toBe(false);
    expect(r.pesan).toMatch(/belum tersedia/);
    expect((await bacaUsulan(db!)).find((x) => x.id === u[0].id)?.status).toBe("baru");
  });

  it("titik sambung (tiruan): usulan terpilih diteruskan sekali, status berubah, tidak diusulkan ulang; tolak tidak diteruskan", async () => {
    const diterima: string[][] = [];
    const tiruan: PelabuhanMemoriProyek = {
      daftarProyek: async () => [
        { id: "p1", nama: "Proyek Putusan", memoriAktif: true },
        { id: "p2", nama: "Proyek Mati", memoriAktif: false },
      ],
      simpanUsulan: async (_db, proyekId, daftar) => {
        expect(proyekId).toBe("p1");
        diterima.push([...daftar]);
        return daftar.length;
      },
    };
    pasangPelabuhanMemori(tiruan);
    const u = await bacaUsulan(db!);
    const [a, b] = [u[0], u[1]];
    expect((await teruskanUsulan(db!, { proyekId: "p2", ids: [a.id], oleh: "SA" })).pesan).toMatch(/dimatikan/);
    expect((await teruskanUsulan(db!, { proyekId: "tidak-ada", ids: [a.id], oleh: "SA" })).pesan).toMatch(/tidak ditemukan/);
    expect((await teruskanUsulan(db!, { proyekId: "p1", ids: [], oleh: "SA" })).ok).toBe(false);
    const r = await teruskanUsulan(db!, { proyekId: "p1", ids: [a.id, "ngawur"], oleh: "SA", kini: HARI_INI });
    expect(r).toMatchObject({ ok: true, diteruskan: 1, baruDiProyek: 1 });
    expect(diterima).toEqual([[a.teks]]);
    const sesudah = await bacaUsulan(db!);
    expect(sesudah.find((x) => x.id === a.id)).toMatchObject({ status: "diteruskan", proyekId: "p1" });
    // diteruskan dua kali = tidak ada kiriman kedua
    expect((await teruskanUsulan(db!, { proyekId: "p1", ids: [a.id], oleh: "SA" })).ok).toBe(false);
    expect(diterima).toHaveLength(1);
    // tolak
    expect(await tolakUsulan(db!, b.id, "SA", HARI_INI)).toBe(true);
    expect(await tolakUsulan(db!, b.id, "SA", HARI_INI)).toBe(false);
    // hitung ulang tidak menghidupkan lagi yang sudah diputuskan
    await segarkanUsulan(db!);
    const akhir = await bacaUsulan(db!);
    expect(akhir.find((x) => x.id === a.id)?.status).toBe("diteruskan");
    expect(akhir.find((x) => x.id === b.id)?.status).toBe("ditolak");
  });

  it("usulan yang tak lagi memenuhi ambang dihapus saat dihitung ulang", async () => {
    // Hapus dua dari tiga perkara majelis Satu: pola majelis itu (3 perkara) gugur.
    await db!.run("DELETE FROM aleta_pengukur_draf WHERE perkara_id IN ('801','802')");
    await segarkanUsulan(db!);
    const u = await bacaUsulan(db!);
    expect(u.filter((x) => x.hakim === "Hakim Satu, S.H.")).toEqual([]);
  });
});

describe("penjadwal: peristiwa jam kerja, malam sekali sehari, saklar", () => {
  let db: AletaDatabase | null = null;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await simpanDraf(db, "901", "2026-10-27");
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  const di = (iso: string) => new Date(iso);

  it("jam kerja: paling sering tiap 30 menit; luar jam kerja dan sebelum 22.30 tidak jalan", async () => {
    const peta = { "901": putusan(901) };
    const { deps, hitung } = depsUji(peta);
    const keadaan = { terakhirPeristiwa: 0 };
    const a = await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-28T03:00:00Z") }, keadaan, {}); // 11.00 WITA
    expect(a?.pemicu).toBe("peristiwa");
    expect(hitung.bahan).toBe(1);
    const b = await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-28T03:15:00Z") }, keadaan, {});
    expect(b).toBeNull();
    const c = await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-28T03:40:00Z") }, keadaan, {});
    expect(c?.pemicu).toBe("peristiwa");
    expect(await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-27T20:00:00Z") }, { terakhirPeristiwa: 0 }, {})).toBeNull(); // 04.00 WITA
    expect(await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-28T14:00:00Z") }, { terakhirPeristiwa: 0 }, {})).toBeNull(); // 22.00 WITA: lewat jam kerja, belum malam
  });

  it("malam: sekali sehari sesudah 22.30 WITA, ditandai hanya bila bot terjangkau", async () => {
    const peta = { "901": putusan(901) };
    const { deps, hitung } = depsUji(peta);
    const malam = { ...deps, kini: () => di("2026-10-28T15:00:00Z") }; // 23.00 WITA
    const a = await detakPengukurDraf(db!, malam, { terakhirPeristiwa: 0 }, {});
    expect(a?.pemicu).toBe("malam");
    expect(await detakPengukurDraf(db!, malam, { terakhirPeristiwa: 0 }, {})).toBeNull();
    expect(hitung.bahan).toBe(1);
    // bot mati: tidak ditandai, detak berikutnya mencoba lagi
    const mati: DepsPengukur = { bahan: async () => ({ ok: false, error: "mati" }), kini: () => di("2026-10-29T15:00:00Z") };
    const g = await detakPengukurDraf(db!, mati, { terakhirPeristiwa: 0 }, {});
    expect(g?.galat).toBe("mati");
    const lagi = await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-29T15:30:00Z") }, { terakhirPeristiwa: 0 }, {});
    expect(lagi?.pemicu).toBe("malam");
  });

  it("saklar ALETA_PENGUKUR_DRAF=0 mematikan seluruhnya", async () => {
    const { deps, hitung } = depsUji({ "901": putusan(901) });
    expect(await detakPengukurDraf(db!, { ...deps, kini: () => di("2026-10-28T03:00:00Z") }, { terakhirPeristiwa: 0 }, { ALETA_PENGUKUR_DRAF: "0" })).toBeNull();
    expect(hitung.bahan).toBe(0);
  });
});

// ── Bot (hanya SELECT, satu kueri putusan + satu kueri majelis) ─────────────
describe("bot: bahanPengukur", () => {
  const AKAR = path.resolve(process.cwd(), "..");
  const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
  const { buatLayanan } = muat(path.join(AKAR, "aleta_bot/services/putusanDokumenService.js")) as any;

  it("dua kueri untuk banyak perkara; ketua dari jabatan 1; hanya yang sudah diputus; id ngawur dibuang; maksimum 40", async () => {
    const kueri: Array<{ sql: string; params: unknown[] }> = [];
    const layanan = buatLayanan({
      kueri: async (sql: string, params: unknown[] = []) => {
        kueri.push({ sql, params });
        if (/FROM perkara p/.test(sql))
          return [
            { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalPutusan: new Date(2026, 9, 27), statusPutusanId: 62, verstek: "Y", amarPutusan: "<p>1. Mengabulkan</p>", berkas: "x/y/putusan.pdf", pertimbanganHukum: "<p>Menimbang</p>" },
            { perkaraId: 2, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", tanggalPutusan: "2026-10-26", statusPutusanId: 63, verstek: "T", amarPutusan: "", berkas: "", pertimbanganHukum: null },
          ];
        return [
          { perkaraId: 1, nama: "Hakim Anggota", urutan: 2, jabatan: 2 },
          { perkaraId: 1, nama: "Hakim Ketua", urutan: 1, jabatan: 1 },
          { perkaraId: 2, nama: "Hakim Tunggal", urutan: 1, jabatan: 1 },
        ];
      },
    });
    const h = await layanan.bahanPengukur("1,2,abc,-5,2");
    expect(kueri).toHaveLength(2);
    expect(kueri.every((k) => /^\s*SELECT/i.test(k.sql))).toBe(true);
    expect(kueri[0].params).toEqual([1, 2]);
    expect(h.ok).toBe(true);
    expect(h.perkara).toHaveLength(2);
    expect(h.perkara[0]).toMatchObject({ perkaraId: 1, tanggalPutusan: "2026-10-27", statusPutusanId: 62, verstek: true, hakimKetua: "Hakim Ketua", majelis: ["Hakim Anggota", "Hakim Ketua"], adaBerkas: true, pertimbanganHukum: "<p>Menimbang</p>" });
    expect(h.perkara[1]).toMatchObject({ perkaraId: 2, pertimbanganHukum: "", adaBerkas: false, hakimKetua: "Hakim Tunggal" });
    const banyak = Array.from({ length: 60 }, (_, i) => i + 1).join(",");
    const k2: unknown[][] = [];
    await buatLayanan({ kueri: async (_s: string, p: unknown[] = []) => (k2.push(p), []) }).bahanPengukur(banyak);
    expect(k2[0]).toHaveLength(40);
    expect((await layanan.bahanPengukur("abc")).ok).toBe(false);
  });
});

// ── Migrasi ────────────────────────────────────────────────────────────────
describe("migrasi 0130", () => {
  it("DDL = cermin schema.ts; terdaftar di jurnal (idx 113, when sesudah 0129) dan urutan simpan pg-mem", () => {
    const M = path.resolve(process.cwd());
    const sql = readFileSync(path.join(M, "drizzle/0130_aleta_pengukur_draf.sql"), "utf8");
    const rapat = (t: string) => t.replace(/--.*$/gm, "").replace(/;/g, " ").replace(/\s+/g, " ").trim();
    expect(rapat(sql)).toBe(rapat([...DDL_PENGUKUR_DRAF.tabel, ...DDL_PENGUKUR_DRAF.indeks].join(" ")));
    const jurnal = JSON.parse(readFileSync(path.join(M, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const ini = jurnal.entries.filter((e) => e.tag === "0130_aleta_pengukur_draf");
    expect(ini.map((e) => e.idx)).toEqual([113]);
    expect(ini[0]!.when).toBeGreaterThan(1792344600001); // sesudah 0129 (N3) - when terbesar cabang lain
    expect(jurnal.entries.some((e) => e.tag.startsWith("0128_"))).toBe(false);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toEqual(expect.arrayContaining(["aleta_pengukur_draf", "aleta_pengukur_usulan"]));
  });
});
