// @vitest-environment node
/**
 * ============================================================================
 * BAS MASSAL TANPA KEHADIRAN TERCATAT - KEPUTUSAN PENGGUNA 9 OKT 2026
 * ============================================================================
 *
 * "boleh tanpa kehadiran tercatat, tapi beri tanda untuk yang belum hadir,
 * untuk perkara yang sudah sampai jam 2 tidak ada kehadirannya maka mengikuti
 * format apakah putus gugur atau ditunda panggil para pihak".
 *
 * Yang dijaga:
 *   - tanpa kehadiran (SIPP kosong, tidak mengambil nomor antrian) sebelum
 *     14.00 WITA -> usulan PERKIRAAN + tanda "belum hadir";
 *   - antrian = hadir: sisi yang mengambil nomor dibaca hadir;
 *   - lewat 14.00 (atau hari sidang sudah lewat) -> format gugur ATAU tunda
 *     panggil para pihak menurut keadaan perkara; ragu -> tunda, tidak pernah
 *     gugur;
 *   - kehadiran yang tercatat di SIPP: perilaku lama tidak berubah;
 *   - Pemetaan blangko > BAS berkunci "gugur"/"tunda-panggil" menang;
 *   - basmassal.js (dijalankan di jsdom) menampilkan tandanya dari jawaban
 *     server yang disusun susun.ts sungguhan, tanpa satu pun permintaan
 *     non-GET.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import {
  FOLDER_BAS_FORMAT,
  folderFormatDibutuhkan,
  kehadiranDariAntrian,
  lewatBatasKehadiran,
  susunBarisBasMassal,
  tentukanFormatTanpaHadir,
  type BarisSidangBas,
  type KatalogFolder,
} from "@/app/api/aleta-ecourt/bas-massal/susun";
import { KUNCI_BAKU, nilaiKunciBas, uraiKunciBas } from "@/lib/pemetaan-blangko";

const VERSTEK = "derry_briantono/- BAS VERSTEK PERCERAIAN -";
const CONTRA = "derry_briantono/- BAS CONTRA PERCERAIAN -";
const [PUTUS_STANDAR, PERTAMA_STANDAR] = FOLDER_BAS_FORMAT;

/** Nama berkas SAMA dengan katalog server 9 Okt 2026 (basKe/keadaan diurai seperti bot). */
function item(berkas: string) {
  const sisa = berkas.replace(/\.rtf$/i, "").replace(/\[[^\]]*\]/g, "").replace(/\(e-?court\)/i, "").replace(/\s{2,}/g, " ").trim();
  const m = sisa.match(/^BAS\s+(\d+)([a-z]?)\s+/i);
  const setelah = m ? sisa.slice(m[0].length).trim() : sisa;
  const i = setelah.indexOf(" - ");
  return {
    berkas,
    basKe: m ? Number(m[1]) : 0,
    keadaan: i >= 0 ? setelah.slice(0, i).trim() : setelah,
    tindakan: i >= 0 ? setelah.slice(i + 3).trim() : "",
    judul: sisa,
  };
}

const KATALOG: Record<string, KatalogFolder> = {
  [VERSTEK]: {
    terbaca: true,
    sebab: "",
    blangko: [
      "[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
      "[01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf",
      "[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (3 Saksi).rtf",
      "[99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau Luar Batas Antar.rtf",
      "[99] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf",
      "[99] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T.rtf",
    ].map(item),
  },
  [CONTRA]: {
    terbaca: true,
    sebab: "",
    blangko: [
      "[02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputusan Dirjen 1465.rtf",
      "[02] BAS 2 P & T Hadir Laporan Mediasi dan Pemeriksaan Pokok Perkara PERMA 7 2022 & Keputusan Dirjen 1465.rtf",
      "[99] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf",
      "[99] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T.rtf",
    ].map(item),
  },
  [PUTUS_STANDAR]: {
    terbaca: true,
    sebab: "",
    blangko: [
      "34-a. BAS Putus P _ T Tidak Hadir (Gugur).rtf",
      "34-b. BAS Putus P  Tidak Hadir _ T Hadir (Gugur).rtf",
      "40-h. BAS Putus IN PELAYANAN TERPADU (Gugur).PA.Mj.rtf",
    ].map(item),
  },
  [PERTAMA_STANDAR]: {
    terbaca: true,
    sebab: "",
    blangko: [
      "02-a. BAS Pertama P _ T Tidak Hadir - Tunda Panggil P dan T.PA.Mj.rtf",
      "04-a. BAS Pertama P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
    ].map(item),
  },
};

const GUGUR = "34-a. BAS Putus P _ T Tidak Hadir (Gugur).rtf";
const TUNDA_1 = "[99] BAS 1 P & T Tidak Hadir - Tunda Panggil P & T.rtf";
const TUNDA_2 = "[99] BAS 2 P & T Tidak Hadir - Tunda Panggil P & T.rtf";
const TUNDA_UMUM = "02-a. BAS Pertama P _ T Tidak Hadir - Tunda Panggil P dan T.PA.Mj.rtf";

/** Panggilan patut untuk penggugat - bentuk jawaban bot sungguhan. */
const PANGGILAN_PATUT = {
  hadirSebelumnya: null,
  tergugatPernahHadir: false,
  penggugatPernahHadir: false,
  wajibDipanggil: [1, 2],
  sisiPihakAda: [1, 2],
  relaasTanpaKedudukan: 0,
  belumDipanggil: 0,
  sisiBelumDipanggil: [],
  retur: 0,
  tenggangMepet: false,
  tenggangTersempit: { sisi: 2, dinilai: true, patut: true, selisih: 12, alasan: "" },
  aman: true,
};

function sidang(id: number, tambahan: Partial<BarisSidangBas> & Record<string, unknown> = {}): BarisSidangBas {
  return {
    sidangId: String(900 + id),
    perkaraId: String(id),
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    tanggalSidang: "2026-10-12",
    jamSidang: "09:00",
    agenda: "Sidang Pertama",
    urutanSidang: 1,
    dihadiriOleh: null,
    adaBas: false,
    paniteraNama: "Siti Aminah, S.H.",
    sidangIkrarTalak: false,
    sudahPutus: false,
    panggilan: { ...PANGGILAN_PATUT },
    ...tambahan,
  } as BarisSidangBas;
}

/** Antrian hari 12 Okt terbaca; perkara yang tidak disebut = tidak mengambil nomor. */
const antrianHari = (peta: Record<string, { pihak1?: string; pihak2?: string }> = {}) => ({
  terbaca: true,
  tanggal: ["2026-10-12"],
  peta: Object.fromEntries(Object.entries(peta).map(([k, v]) => [k, { tanggalSidang: "2026-10-12", pihak1: "", pihak2: "", ...v }])),
});

const PAGI = { tanggal: "2026-10-12", jam: "09:30:00" };
const SIANG = { tanggal: "2026-10-12", jam: "14:00:00" };

function susun(daftar: BarisSidangBas[], opsi: Partial<Parameters<typeof susunBarisBasMassal>[1]> = {}) {
  return susunBarisBasMassal(daftar, {
    namaAkun: "Siti Aminah",
    saringan: "semua",
    katalog: KATALOG,
    lembar: {},
    antrian: antrianHari(),
    saat: PAGI,
    ...opsi,
  }).baris;
}

// ===========================================================================

describe("batas 14.00 WITA dan antrian", () => {
  it("lewat batas: hari ini pukul 14.00:00 ke atas, atau hari sidang sudah lewat; saat kosong tidak pernah", () => {
    expect(lewatBatasKehadiran("2026-10-12", { tanggal: "2026-10-12", jam: "13:59:59" })).toBe(false);
    expect(lewatBatasKehadiran("2026-10-12", SIANG)).toBe(true);
    expect(lewatBatasKehadiran("2026-10-12", { tanggal: "2026-10-13", jam: "08:00:00" })).toBe(true);
    expect(lewatBatasKehadiran("2026-10-13", SIANG)).toBe(false);
    expect(lewatBatasKehadiran("2026-10-12", null)).toBe(false);
  });

  it("antrian: mengambil nomor = hadir; tidak di peta padahal hari itu terbaca = tidak mengambil; hari lain / tidak terbaca = null", () => {
    const a = antrianHari({ "7": { pihak1: "08:10" } });
    expect(kehadiranDariAntrian(a, "7", "2026-10-12")).toEqual({ p: true, t: false });
    expect(kehadiranDariAntrian(a, "8", "2026-10-12")).toEqual({ p: false, t: false });
    expect(kehadiranDariAntrian(a, "7", "2026-10-13")).toBeNull();
    expect(kehadiranDariAntrian({ terbaca: false, tanggal: [], peta: {} }, "7", "2026-10-12")).toBeNull();
    expect(kehadiranDariAntrian(null, "7", "2026-10-12")).toBeNull();
  });
});

describe("sebelum 14.00 tanpa kehadiran -> usulan perkiraan + tanda belum hadir", () => {
  it("sidang pertama cerai gugat: diusulkan BAS 1 'P Hadir & T Tidak Hadir - Tunda Panggil T' (verstek lebih dulu), bertanda", () => {
    const [b] = susun([sidang(1)]);
    expect(b.tandaKehadiran.keadaan).toBe("belum-hadir");
    expect(b.tandaKehadiran.teks).toBe("belum hadir - kehadiran belum tercatat");
    expect(b.formatTanpaHadir).toBeNull();
    expect(b.blangko.usulan?.berkas).toBe("[01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf");
    expect(b.blangko.usulan?.perkiraan).toBe(true);
    expect(b.blangko.sebab).toMatch(/Kehadiran belum tercatat - usulan menurut urutan sidang/);
    // Pilihan lain tetap ada - petugas dapat mengganti.
    expect(b.blangko.pilihan.length).toBeGreaterThan(1);
  });

  it("tergugat pernah hadir: set contra lebih dulu - BAS 2 'P & T Hadir Laporan Mediasi'", () => {
    const [b] = susun([
      sidang(2, { urutanSidang: 2, agenda: "Laporan mediasi", panggilan: { ...PANGGILAN_PATUT, tergugatPernahHadir: true } }),
    ]);
    expect(b.blangko.usulan?.setId).toBe("bas-contra");
    expect(b.blangko.usulan?.berkas).toMatch(/BAS 2 P & T Hadir Laporan Mediasi/);
    expect(b.blangko.usulan?.perkiraan).toBe(true);
  });

  it("agenda pembuktian memilah di antara jenjang yang sama (mode perkiraan saja)", () => {
    const [b] = susun([sidang(3, { urutanSidang: 2, agenda: "Pembuktian saksi" })]);
    expect(b.blangko.usulan?.berkas).toBe("[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (3 Saksi).rtf");
  });

  it("antrian: kedua pihak mengambil nomor -> kehadiran dari antrian, usulan cocok (bukan perkiraan)", () => {
    const [b] = susun([sidang(4, { urutanSidang: 2, agenda: "Laporan mediasi" })], {
      antrian: antrianHari({ "4": { pihak1: "08:00", pihak2: "08:20" } }),
    });
    expect(b.tandaKehadiran.keadaan).toBe("antrian");
    expect(b.tandaKehadiran.teks).toBe("menurut antrian: P hadir, T hadir - belum dicatat di SIPP");
    expect(b.blangko.usulan?.setId).toBe("bas-contra");
    expect(b.blangko.usulan?.perkiraan).toBeUndefined();
  });

  it("antrian: hanya penggugat datang, pagi -> T 'belum datang', usulan tidak bertentangan dengan P hadir", () => {
    const [b] = susun([sidang(5)], { antrian: antrianHari({ "5": { pihak1: "08:00" } }) });
    expect(b.tandaKehadiran.teks).toBe("menurut antrian: P hadir, T belum datang - belum dicatat di SIPP");
    expect(b.blangko.usulan?.berkas).toMatch(/P Hadir & T Tidak Hadir - Tunda Panggil T/);
  });
});

describe("lewat 14.00 tanpa kehadiran -> gugur atau tunda panggil para pihak", () => {
  it("GUGUR: gugatan, sidang pertama, relaas penggugat patut, tidak mengambil nomor antrian -> 34-a (Gugur)", () => {
    const [b] = susun([sidang(10)], { saat: SIANG });
    expect(b.tandaKehadiran.keadaan).toBe("lewat-batas");
    expect(b.tandaKehadiran.teks).toBe("lewat 14.00 tanpa kehadiran - usulan: gugur");
    expect(b.formatTanpaHadir).toMatchObject({ jenis: "gugur", ragu: false });
    expect(b.formatTanpaHadir?.alasan).toMatch(/Pasal 148 RBg\.$/);
    expect(b.blangko.usulan).toMatchObject({ folder: PUTUS_STANDAR, berkas: GUGUR, format: "gugur" });
    // Format lainnya tetap di pilihan untuk ditukar petugas.
    expect(b.blangko.pilihan.map((p) => p.berkas)).toContain(TUNDA_1);
  });

  it("GUGUR di sidang lanjutan bila penggugat BELUM PERNAH hadir (1:4 lalu sidang ke-2)", () => {
    const [b] = susun([sidang(11, { urutanSidang: 2, agenda: "Panggil P & T", panggilan: { ...PANGGILAN_PATUT, hadirSebelumnya: 4 } })], {
      saat: SIANG,
    });
    expect(b.formatTanpaHadir?.jenis).toBe("gugur");
  });

  it("TUNDA: penggugat pernah hadir sebelumnya -> tunda panggil para pihak, BAS 2 'Tunda Panggil P & T', tidak ragu", () => {
    const [b] = susun(
      [sidang(12, { urutanSidang: 2, agenda: "Pembuktian", panggilan: { ...PANGGILAN_PATUT, hadirSebelumnya: 2, penggugatPernahHadir: true, wajibDipanggil: [2] } })],
      { saat: SIANG }
    );
    expect(b.formatTanpaHadir).toMatchObject({ jenis: "tunda-panggil", ragu: false });
    expect(b.tandaKehadiran.teks).toBe("lewat 14.00 tanpa kehadiran - usulan: tunda panggil para pihak");
    expect(b.blangko.usulan).toMatchObject({ folder: VERSTEK, berkas: TUNDA_2, format: "tunda-panggil" });
  });

  it("TUNDA: relaas penggugat belum ada (sisi 1 belum dipanggil)", () => {
    const [b] = susun([sidang(13, { panggilan: { ...PANGGILAN_PATUT, belumDipanggil: 1, sisiBelumDipanggil: [1] } })], { saat: SIANG });
    expect(b.formatTanpaHadir).toMatchObject({ jenis: "tunda-panggil", ragu: false });
    expect(b.formatTanpaHadir?.alasan).toMatch(/Relaas panggilan penggugat untuk sidang ini belum ada/);
    expect(b.blangko.usulan?.berkas).toBe(TUNDA_1);
  });

  it("TUNDA: tenggang tidak patut / mepet", () => {
    const tidakPatut = tentukanFormatTanpaHadir(
      sidang(14, { panggilan: { ...PANGGILAN_PATUT, tenggangTersempit: { dinilai: true, patut: false, alasan: "tenggang_kurang_dari_ambang" } } }),
      { antrianTerbaca: true }
    );
    expect(tidakPatut).toMatchObject({ jenis: "tunda-panggil", ragu: false });
    const mepet = tentukanFormatTanpaHadir(sidang(15, { panggilan: { ...PANGGILAN_PATUT, tenggangMepet: true } }), { antrianTerbaca: true });
    expect(mepet.jenis).toBe("tunda-panggil");
  });

  it("TUNDA: perkara permohonan (Pdt.P) tidak digugurkan; blangko umum 02-a untuk sidang pertama", () => {
    const [b] = susun(
      [sidang(16, { nomorPerkara: "16/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" })],
      { saat: SIANG, katalog: { ...KATALOG, "derry_briantono/- BAS ITSTBAT NIKAH -": { terbaca: true, sebab: "", blangko: [item("[01a] BAS 1 IN - Kabul.rtf")] } } }
    );
    expect(b.formatTanpaHadir).toMatchObject({ jenis: "tunda-panggil", ragu: false });
    expect(b.formatTanpaHadir?.alasan).toMatch(/permohonan/);
    expect(b.blangko.usulan).toMatchObject({ folder: PERTAMA_STANDAR, berkas: TUNDA_UMUM });
  });

  it("TUNDA: sidang ikrar talak dan perkara sudah putus", () => {
    expect(tentukanFormatTanpaHadir(sidang(17, { sidangIkrarTalak: true }), { antrianTerbaca: true }).jenis).toBe("tunda-panggil");
    expect(tentukanFormatTanpaHadir(sidang(18, { sudahPutus: true }), { antrianTerbaca: true }).jenis).toBe("tunda-panggil");
  });

  it("RAGU -> selalu tunda, tidak pernah gugur", () => {
    const ragu = (s: BarisSidangBas, antrianTerbaca = true) => tentukanFormatTanpaHadir(s, { antrianTerbaca });
    const kasus = [
      // kehadiran sidang sebelumnya ada yang kosong
      ragu(sidang(20, { urutanSidang: 2, panggilan: { ...PANGGILAN_PATUT, penggugatPernahHadir: null } })),
      // bot lama (tanpa penggugatPernahHadir), sidang lanjutan, sebelumnya kosong
      ragu(sidang(21, { urutanSidang: 3, panggilan: { ...PANGGILAN_PATUT, penggugatPernahHadir: undefined, hadirSebelumnya: null } })),
      // retur
      ragu(sidang(22, { panggilan: { ...PANGGILAN_PATUT, retur: 1 } })),
      // relaas tanpa kedudukan pihak
      ragu(sidang(23, { panggilan: { ...PANGGILAN_PATUT, relaasTanpaKedudukan: 1 } })),
      // kepatutan belum dapat dinilai (surat tercatat belum terbukti diterima)
      ragu(sidang(24, { panggilan: { ...PANGGILAN_PATUT, tenggangTersempit: { dinilai: false, patut: null } } })),
      // keadaan panggilan tidak terbaca
      ragu(sidang(25, { panggilan: null })),
      // antrian hari itu tidak terbaca - ketidakhadiran hanya dari SIPP yang kosong
      ragu(sidang(26), false),
      // alur tidak terbaca
      ragu(sidang(27, { alurPerkaraId: 0, nomorPerkara: "27/2026/PA.Dgl" })),
    ];
    for (const f of kasus) expect(f).toMatchObject({ jenis: "tunda-panggil", ragu: true });
  });

  it("antrian tidak terbaca pada sidang yang lewat batas -> tanda '(ragu)'", () => {
    const [b] = susun([sidang(28)], { saat: SIANG, antrian: { terbaca: false, tanggal: [], peta: {} } });
    expect(b.tandaKehadiran.teks).toBe("lewat 14.00 tanpa kehadiran - usulan: tunda panggil para pihak (ragu)");
    expect(b.blangko.usulan?.berkas).toBe(TUNDA_1);
  });

  it("pihak yang mengambil nomor antrian bukan 'tanpa kehadiran' - lewat 14.00 dibaca P hadir, T tidak hadir", () => {
    const [b] = susun([sidang(29)], { saat: SIANG, antrian: antrianHari({ "29": { pihak1: "08:00" } }) });
    expect(b.formatTanpaHadir).toBeNull();
    expect(b.tandaKehadiran.teks).toBe("menurut antrian: P hadir, T tidak hadir - belum dicatat di SIPP");
    expect(b.blangko.usulan?.berkas).toMatch(/BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T/);
    expect(b.blangko.usulan?.perkiraan).toBeUndefined();
  });

  it("blangko tunda lanjutan untuk perkara selain perceraian tidak ada -> usulan kosong, nama blangko yang dibutuhkan disebut", () => {
    const [b] = susun(
      [sidang(30, { nomorPerkara: "30/Pdt.G/2026/PA.Dgl", jenisPerkara: "Kewarisan", urutanSidang: 3, panggilan: { ...PANGGILAN_PATUT, penggugatPernahHadir: true, hadirSebelumnya: 1, wajibDipanggil: [] } })],
      { saat: SIANG }
    );
    expect(b.formatTanpaHadir?.jenis).toBe("tunda-panggil");
    expect(b.blangko.usulan).toBeNull();
    expect(b.blangko.sebab).toMatch(/BAS P & T Tidak Hadir - Tunda Panggil P & T" untuk sidang lanjutan belum ada di katalog/);
    // Gugur (34-a) tetap ditawarkan sebagai pilihan.
    expect(b.blangko.pilihan.map((p) => p.berkas)).toContain(GUGUR);
  });

  it("folder ABT umum hanya diminta bila ada sidang lewat batas tanpa kehadiran", () => {
    expect(folderFormatDibutuhkan([sidang(31)], antrianHari(), PAGI)).toEqual([]);
    expect(folderFormatDibutuhkan([sidang(31, { dihadiriOleh: 2 })], antrianHari(), SIANG)).toEqual([]);
    expect(folderFormatDibutuhkan([sidang(31)], antrianHari({ "31": { pihak2: "09:00" } }), SIANG)).toEqual([]);
    expect(folderFormatDibutuhkan([sidang(31)], antrianHari(), SIANG)).toEqual(FOLDER_BAS_FORMAT);
  });
});

describe("perilaku lama tidak berubah bila kehadiran tercatat di SIPP", () => {
  it("dihadiri_oleh 2 (P saja) sesudah 14.00: usulan cocok seperti dulu, tanpa format dan tanpa perkiraan", () => {
    const [b] = susun([sidang(40, { urutanSidang: 2, agenda: "Pembuktian", dihadiriOleh: 2 })], { saat: SIANG });
    expect(b.tandaKehadiran).toMatchObject({ keadaan: "tercatat", teks: "hanya pihak pertama hadir" });
    expect(b.formatTanpaHadir).toBeNull();
    // Urutan lama: nama berkas, bukan agenda - [01b] tetap di depan.
    expect(b.blangko.usulan?.berkas).toBe("[01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf");
    expect(b.blangko.usulan?.perkiraan).toBeUndefined();
  });

  it("dihadiri_oleh 1 tetapi jenjang tanpa blangko cocok: usulan tetap kosong dan sebab lama", () => {
    const [b] = susun([sidang(41, { urutanSidang: 1, dihadiriOleh: 3 })]);
    expect(b.blangko.usulan).toBeNull();
    expect(b.blangko.sebab).toBe("Tidak ada blangko yang keadaannya jelas cocok dengan kehadiran - pilih blangkonya sendiri.");
  });
});

describe("Pemetaan blangko > BAS: kunci format", () => {
  it("kunci '<jenis>|gugur|*' dan '|tunda-panggil|' dikenali, tidak tertukar dengan 'lanjutan', hanya bagi sidang berformat", () => {
    expect(uraiKunciBas("Cerai Gugat|gugur|*")).toMatchObject({ sidang: "gugur", dikenal: true });
    expect(uraiKunciBas("Cerai Gugat|tunda panggil|*")).toMatchObject({ sidang: "tunda-panggil", dikenal: true });
    expect(uraiKunciBas("Cerai Gugat|tunda|*").sidang).toBe("lanjutan");
    const s = { jenisPerkara: "Cerai Gugat", urutanSidang: 1, dihadiriOleh: null };
    expect(nilaiKunciBas("Cerai Gugat|gugur|*", s)).toBe(-1);
    expect(nilaiKunciBas("Cerai Gugat|gugur|*", { ...s, format: "gugur" })).toBe(24);
    expect(nilaiKunciBas("Cerai Gugat|1|*", { ...s, format: "gugur" })).toBe(-1);
    expect(KUNCI_BAKU.bas.some((k) => k.kunci === "Cerai Gugat|gugur|*")).toBe(true);
  });

  it("pemetaan format menang atas pencarian nama", () => {
    const [b] = susun([sidang(50)], {
      saat: SIANG,
      petaBas: { "Cerai Gugat|gugur|*": "34-b. BAS Putus P  Tidak Hadir _ T Hadir (Gugur).rtf", "Cerai Gugat|1|*": TUNDA_1 },
    });
    expect(b.blangko.usulan).toMatchObject({ berkas: "34-b. BAS Putus P  Tidak Hadir _ T Hadir (Gugur).rtf", dariPemetaan: "Cerai Gugat|gugur|*" });
  });
});

// ===========================================================================
// Ekstensi: basmassal.js sungguhan di jsdom, diberi jawaban susun.ts sungguhan.
// ===========================================================================

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const ASAL = "http://192.168.10.10";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 8000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(10);
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaPanel(sidangJawaban: unknown[]) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="wadah"></div></body></html>`, {
    url: `${ASAL}/SIPP/list_perkara`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.188.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      lastError: undefined,
      sendMessage: (_m: unknown, balik?: (x: unknown) => void) => setTimeout(() => balik && balik({ ok: true }), 0),
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase() });
    const jalur = url.replace(/\?.*$/, "");
    if (jalur.endsWith("/ekstensi/siapa")) {
      return Response.json({ ok: true, data: { nama: "Siti Aminah", peran: "Panitera Pengganti", roleId: "panitera-pengganti", peranTambahan: [] } });
    }
    if (jalur.endsWith("/aleta-ecourt/bas-massal")) {
      const data = { tanggal: "2026-10-12", saringan: "saya", lihatSemua: false, jumlahSemua: sidangJawaban.length, jumlahSaya: sidangJawaban.length, sidang: sidangJawaban };
      return Response.json({ ok: true, data: polos(data) });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.eval(`${baca("panel-alat.js")}\n;\n${baca("basmassal.js")}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  return { w, minta, wadah: w.document.getElementById("wadah") as HTMLElement };
}

describe("ekstensi BAS massal menampilkan tanda kehadiran", () => {
  it("belum hadir / lewat 14.00 gugur / tunda (ragu) / tercatat - tanda, usulan terpilih, ringkasan, tanpa non-GET", async () => {
    const pagi = susun([sidang(61)]);
    const siang = susun(
      [
        sidang(62),
        sidang(63, { panggilan: { ...PANGGILAN_PATUT, retur: 1 } }),
        sidang(64, { urutanSidang: 2, agenda: "Pembuktian", dihadiriOleh: 2 }),
      ],
      { saat: SIANG }
    );
    const h = bukaPanel([...pagi, ...siang]);
    await sampai(() => h.w.__uji.mode() === "baru", "mode baru");
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "sipp" })).toBe(true);
    const barisDom = (id: number) => h.wadah.querySelector(`.aleta-basmassal-baris[data-nomor="${id}/Pdt.G/2026/PA.Dgl"]`) as HTMLElement;
    await sampai(() => barisDom(64), "empat baris");

    const kabar = (h.wadah.querySelector(".aleta-basmassal-kabar") as HTMLElement).textContent || "";
    expect(kabar).toContain("4 blangko terusul");
    expect(kabar).toContain("1 belum hadir");
    expect(kabar).toContain("2 lewat 14.00 tanpa kehadiran");

    expect(barisDom(61).textContent).toContain("belum hadir - kehadiran belum tercatat");
    expect(barisDom(61).textContent).toContain("usulan perkiraan");
    expect(barisDom(62).textContent).toContain("lewat 14.00 tanpa kehadiran - usulan: gugur");
    expect(barisDom(62).textContent).toContain("usulan: putus gugur");
    expect(barisDom(63).textContent).toContain("lewat 14.00 tanpa kehadiran - usulan: tunda panggil para pihak (ragu)");
    expect(barisDom(64).textContent).toContain("hanya pihak pertama hadir");
    expect(barisDom(64).textContent).not.toMatch(/belum hadir|lewat 14\.00|perkiraan/);

    // Usulan terpilih di daftar blangko - dan tetap dapat diganti.
    const pilih = (id: number) => barisDom(id).querySelector("select.aleta-basmassal-blangko") as HTMLSelectElement;
    expect(pilih(62).selectedOptions[0].title).toBe(GUGUR);
    expect(pilih(62).disabled).toBe(false);
    expect(Array.from(pilih(62).options).some((o) => o.title === TUNDA_1)).toBe(true);
    expect(pilih(63).selectedOptions[0].title).toBe(TUNDA_1);

    // BAS massal tetap tanpa tulis.
    expect(h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD")).toEqual([]);
  });
});
