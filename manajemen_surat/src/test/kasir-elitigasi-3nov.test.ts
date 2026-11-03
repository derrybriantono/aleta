// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { tentukanBeracaraElektronik } from "@/lib/beracara-elektronik";

/**
 * ============================================================================
 * KASIR 3 NOV 2026 (22.15): TERGUGAT E-LITIGASI - PANGGILAN ULANG TANPA BIAYA
 * ============================================================================
 *
 * Pertanyaan Derry: Tergugat yang punya email dan setuju beracara elektronik,
 * lalu tidak hadir, dipanggil lewat e-Court/e-litigasi - Kasir tidak boleh
 * mengusulkan (mencentang) Biaya Panggilan Tergugat.
 *
 *   status    aturan tunggal keputusan 144 (padanan bot beracaraElektronik.js =
 *             lib/beracara-elektronik.ts, kasus fixture yang sama)
 *   sejak     sidang PERTAMA yang dihadiri Tergugat (persetujuan diberikan saat
 *             hadir; e-Court tidak menyimpan tanggalnya) - panggilan sebelumnya Pos
 *   menang    relaas Pos/RRI yang tercatat tetap berbiaya
 *   tak terbaca  perilaku lama (berbiaya, dicentang bila sidangnya belum lewat)
 *
 * Data REKAAN (tanpa nama, email, atau nomor pihak sungguhan).
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const otomatis = requireBot(path.join(AKAR, "aleta_bot/services/kasirOtomatisService.js"));
const beracara = requireBot(path.join(AKAR, "aleta_bot/services/beracaraElektronik.js"));
const KASUS = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/fixtures/beracara-elektronik-kasus.json"), "utf8"));

type Baris = Record<string, any>;
const P = 501;
const T = 502;

const JENIS: Array<[number, string, number, number, number]> = [
  [1, "Panjar Biaya Perkara", 1, 1, 0],
  [14, "Biaya Panggilan Tergugat/Terlawan/Pelawan/Iklan/Radio/Pengumuman", 4, -1, 0],
  [29, "Biaya Pemberitahuan/Penyampaian Putusan/Iklan", 6, -1, 0],
  [61, "Biaya Pendaftaran/PNBP", 11, -1, 30000],
  [151, "Pengembalian Sisa Panjar", 2, -1, 0],
  [152, "Meterai", 8, -1, 10000],
  [155, "Biaya Pemberkasan/ATK", 12, -1, 100000],
  [157, "Redaksi", 13, -1, 10000],
  [236, "PNBP Relaas Panggilan Pertama Kepada Penggugat/Pelawan/Pembantah", 11, -1, 10000],
  [237, "PNBP Relaas Panggilan Pertama Kepada Tergugat/Terlawan/Pelawan", 11, -1, 10000],
];
const jenisBiaya = Object.fromEntries(JENIS.map(([id, nama, kategoriId, jenisTransaksi, jumlahBawaan]) => [id, { id, nama, kategoriId, kategori: "", jenisTransaksi, jumlahBawaan }]));
const jb = (id: number) => JENIS.find((x) => x[0] === id)!;
const baris = (id: number, j: number, tanggal: string, uraian: string, jumlah: number, pihakKe: number | null, pihakId: number | null, urutan = 0) => ({
  id, jenisBiayaId: j, kategoriId: jb(j)[2], jenisTransaksi: jb(j)[3], pihakId, pihakKe, urutan, tanggal, uraian, jumlah, keterangan: "", pembiayaan: 1,
});

const ELIT = { eCourt: true, ecourtTerbaca: true, tergugat: [{ nama: "Tergugat Rekaan", email: "ada", wa: "ada", setujuElektronik: true }] };

/** Sidang 1 semua hadir (Tergugat hadir & menyetujui), sidang 2 Tergugat tidak hadir, sidang 3 mendatang. */
function keadaan(opsi: { beracara?: unknown; sidang?: Baris[]; relaas?: Baris[]; hariIni?: string; putusan?: Baris | null } = {}): Baris {
  return {
    perkara: { perkaraId: 9001, nomorPerkara: "901/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, jenisPerkaraNama: "Cerai Gugat", tanggalDaftar: "2026-09-15", penetapanHariSidang: "2026-09-16" },
    hariIni: opsi.hariIni || "2026-11-03",
    pembiayaan: 1,
    jurnal: [
      baris(1, 1, "2026-09-15", "Panjar Biaya Perkara", 500000, null, null, 1),
      baris(2, 61, "2026-09-15", "Biaya Pendaftaran/PNBP", 30000, null, null, 2),
      baris(3, 155, "2026-09-15", "Biaya Pemberkasan/ATK", 100000, null, null, 3),
      baris(4, 236, "2026-09-22", "PNBP Relaas Panggilan Pertama Kepada Penggugat", 10000, 1, P),
      baris(5, 14, "2026-09-22", "Biaya Panggilan Tergugat/P2609190001111", 29500, 2, T),
      baris(6, 237, "2026-09-22", "PNBP Relaas Panggilan Pertama Kepada Tergugat", 10000, 2, T),
    ],
    pihak: [
      { id: 1, ke: 1, urutan: 1, pihakId: P, nama: "Penggugat Rekaan", kecamatan: "72.03.01", kabupaten: "72.03" },
      { id: 2, ke: 2, urutan: 1, pihakId: T, nama: "Tergugat Rekaan", kecamatan: "72.03.01", kabupaten: "72.03" },
    ],
    jurusita: [{ jurusitaId: 7, nama: "Juru Sita Rekaan" }],
    sidang: opsi.sidang || [
      { id: 11, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 1, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
      { id: 12, urutan: 2, tanggal: "2026-10-15", dihadiriOleh: 2, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
      { id: 13, urutan: 3, tanggal: "2026-11-05", dihadiriOleh: null, ikrar: false, ditunda: false, hasil: "", agenda: "" },
    ],
    relaas: opsi.relaas || [
      { id: 21, sidangId: 11, pihakId: P, ket: "E", resi: "", tanggalRelaas: "2026-09-18", tanggalJursitPos: "" },
      { id: 22, sidangId: 11, pihakId: T, ket: "S", resi: "P2609190001111", tanggalRelaas: "2026-09-23", tanggalJursitPos: "2026-09-19" },
    ],
    putusan: opsi.putusan === undefined ? null : opsi.putusan,
    pemberitahuan: [],
    ikrar: null,
    jenisBiaya,
    tarif: { kecamatan: { "72.03.01": 29500 }, kabupaten: { "72.03": 29500 }, rri: 200000, lazim: {}, nomorPemohon: null },
    ...(opsi.beracara === undefined ? {} : { beracara: opsi.beracara }),
  };
}

const panggilanSidang = (h: Baris, tanggal: string) =>
  h.usulan.filter((u: Baris) => u.jenisBiayaId === 14 && String(u.peristiwa).includes(`(sidang ${tanggal})`));

describe("padanan bot = portal (keputusan 144), kasus fixture yang sama", () => {
  it("tiap kasus fixture: jenis bot sama dengan fixture dan dengan tentukanBeracaraElektronik portal", () => {
    expect(KASUS.kasus.length).toBeGreaterThan(5);
    for (const k of KASUS.kasus) {
      const bot = beracara.tentukanBeracara(k.masukan);
      expect(bot ? bot.jenis : null, k.nama).toBe(k.jenis);
      const portal = tentukanBeracaraElektronik(k.masukan);
      expect(bot ? bot.alasan : null, k.nama).toBe(portal ? portal.alasan : null);
    }
  });

  it("masukanDariKontakPara: tanpa nilai kontak (hanya 'ada'), Tergugat = pihak kedua jenis pihak, tak dikenali -> null", () => {
    const data = {
      ok: true, ada: true, lewatEcourt: true, ecourtTerbaca: true,
      orang: [
        { jenis: "pihak", pihakKe: 1, nama: "P", email: { nilai: "p@contoh.id" }, hp: { nilai: "0811", bisaWhatsApp: true }, elitigasi: { status: "ya" } },
        { jenis: "pihak", pihakKe: 2, nama: "T", email: { nilai: "t@contoh.id" }, hp: { nilai: "0812", bisaWhatsApp: true }, elitigasi: { status: "ya" } },
        { jenis: "kuasa", pihakKe: 2, nama: "K", email: { nilai: "k@contoh.id" }, hp: { nilai: "", bisaWhatsApp: false }, elitigasi: { status: "tidak-berlaku" } },
      ],
    };
    const m = beracara.masukanDariKontakPara(data);
    expect(m).toEqual({ eCourt: true, ecourtTerbaca: true, tergugat: [{ nama: "T", email: "ada", wa: "ada", setujuElektronik: true }] });
    expect(JSON.stringify(m)).not.toMatch(/@|0812/);
    expect(beracara.masukanDariKontakPara(null)).toBeNull();
    expect(beracara.masukanDariKontakPara({ ok: true, ada: false, orang: [] })).toBeNull();
  });
});

describe("Kasir per perkara: Biaya Panggilan Tergugat sesudah Tergugat menyetujui e-litigasi", () => {
  it("perilaku lama (data e-litigasi tak terbaca): panggilan sidang mendatang diusulkan DAN dicentang", () => {
    const h = kasir.susunUsulan(keadaan());
    const [u] = panggilanSidang(h, "2026-11-05");
    expect(u.pilih).toBe(true);
    expect(u.yakin).toBe("sedang");
    expect(u.dasar).toMatch(/tidak hadir - relaas belum tercatat/);
  });

  it("e-litigasi (email + WA + setuju, pernah hadir 1 Okt), tidak hadir 15 Okt -> TIDAK dicentang, dasar jelas", () => {
    const h = kasir.susunUsulan(keadaan({ beracara: ELIT }));
    const [u] = panggilanSidang(h, "2026-11-05");
    expect(u.pilih).toBe(false);
    expect(u.yakin).toBe("rendah");
    expect(u.dasar).toContain("Tergugat beracara elektronik sejak 01/10/2026 - panggilan lewat e-Court tanpa biaya");
    expect(h.catatan.join(" ")).toContain("Tergugat beracara elektronik (E-Litigasi) sejak 01/10/2026");
    // Panggilan PERTAMA (Pos, sebelum persetujuan) tetap tertutup jurnalnya - tidak ada usulan lain berubah.
    expect(h.usulan.filter((u2: Baris) => u2.pilih && u2.jenisBiayaId === 14)).toEqual([]);
    // Lini kejadian menyebut sebabnya.
    const kj = kasir.susunKejadian(keadaan({ beracara: ELIT }));
    const tunda = kj.kejadian.find((e: Baris) => e.kunci === "tunda:12");
    expect(tunda.keterangan).toContain("beracara elektronik sejak 01/10/2026 - panggilan lewat e-Court tanpa biaya");
  });

  it("panggilan SEBELUM persetujuan tetap berbiaya; sesudahnya tanpa biaya", () => {
    const sidang = [
      { id: 11, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
      { id: 12, urutan: 2, tanggal: "2026-11-04", dihadiriOleh: null, ikrar: false, ditunda: false, hasil: "", agenda: "" },
    ];
    // Tergugat belum pernah hadir: bukan e-litigasi (keputusan 144) -> berbiaya walau kontak lengkap.
    const belum = panggilanSidang(kasir.susunUsulan(keadaan({ beracara: ELIT, sidang })), "2026-11-04");
    expect(belum[0].pilih).toBe(true);
    expect(belum[0].dasar).not.toMatch(/beracara elektronik/);

    // Tidak hadir 1 Okt, HADIR 8 Okt (menyetujui), tidak hadir 15 Okt, sidang 5 Nov.
    const empat = [
      { id: 11, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
      { id: 12, urutan: 2, tanggal: "2026-10-08", dihadiriOleh: 1, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
      { id: 13, urutan: 3, tanggal: "2026-10-15", dihadiriOleh: 2, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
      { id: 14, urutan: 4, tanggal: "2026-11-05", dihadiriOleh: null, ikrar: false, ditunda: false, hasil: "", agenda: "" },
    ];
    const h = kasir.susunUsulan(keadaan({ beracara: ELIT, sidang: empat, hariIni: "2026-10-02" }));
    const keDua = panggilanSidang(h, "2026-10-08")[0];
    expect(keDua.pilih).toBe(true); // diterbitkan sesudah 1 Okt, sebelum Tergugat hadir -> Pos
    expect(keDua.dasar).not.toMatch(/beracara elektronik/);
    const keEmpat = panggilanSidang(h, "2026-11-05")[0];
    expect(keEmpat.pilih).toBe(false);
    expect(keEmpat.dasar).toContain("beracara elektronik sejak 08/10/2026");
  });

  it("hybrid (WA belum ada / tidak setuju / belum menyetujui / persetujuan tak terbaca) -> tetap berbiaya", () => {
    const varian = [
      { ...ELIT, tergugat: [{ ...ELIT.tergugat[0], wa: null }] },
      { ...ELIT, tergugat: [{ ...ELIT.tergugat[0], setujuElektronik: false }] },
      { ...ELIT, tergugat: [{ ...ELIT.tergugat[0], setujuElektronik: null }] },
      { ...ELIT, ecourtTerbaca: false, tergugat: [{ ...ELIT.tergugat[0], setujuElektronik: null }] },
      { ...ELIT, eCourt: false },
      { ...ELIT, tergugat: [] },
    ];
    for (const b of varian) {
      const [u] = panggilanSidang(kasir.susunUsulan(keadaan({ beracara: b })), "2026-11-05");
      expect(u.pilih, JSON.stringify(b)).toBe(true);
      expect(u.dasar).not.toMatch(/beracara elektronik/);
    }
  });

  it("relaas Pos (S) yang SUDAH tercatat untuk sidang itu tetap berbiaya dan dicentang", () => {
    const k = keadaan({ beracara: ELIT });
    k.relaas.push({ id: 23, sidangId: 13, pihakId: T, ket: "S", resi: "P2610200002222", tanggalRelaas: "2026-10-22", tanggalJursitPos: "2026-10-20" });
    const [u] = panggilanSidang(kasir.susunUsulan(k), "2026-11-05");
    expect(u.pilih).toBe(true);
    expect(u.yakin).toBe("tinggi");
    expect(u.uraian).toBe("Biaya Panggilan Tergugat/P2610200002222");
  });

  it("verstek: bukan e-litigasi walau kontak lengkap", () => {
    const k = keadaan({ beracara: ELIT, putusan: { tanggal: "2026-11-05", statusId: 62, statusNama: "Dikabulkan", verstek: "Y" } });
    expect(kasir.elitigasiTergugat(k, k.sidang)).toBeNull();
    expect(kasir.elitigasiTergugat(keadaan({ beracara: ELIT }), keadaan().sidang)).toEqual({ sejak: "2026-10-01", alasan: "Email ada, WA ada, setuju" });
    expect(kasir.elitigasiTergugat(keadaan(), keadaan().sidang)).toBeNull();
  });

  it("Turut Tergugat (pihak keempat) tidak dinilai aturan ini - tetap berbiaya", () => {
    const k = keadaan({ beracara: ELIT });
    k.pihak.push({ id: 3, ke: 4, urutan: 1, pihakId: 503, nama: "Turut Tergugat Rekaan", kecamatan: "72.03.01", kabupaten: "72.03" });
    const h = kasir.susunUsulan(k);
    const turut = h.usulan.find((u: Baris) => u.jenisBiayaId === 14 && u.pihakId === 503 && String(u.peristiwa).includes("2026-11-05"));
    expect(turut.pilih).toBe(true);
  });

  it("bacaKeadaan mengisi beracara dari kontakParaPihak tanpa nilai kontak; galat -> null (perilaku lama)", async () => {
    const kueri = async (s: string) => {
      if (/DATE_FORMAT\(NOW\(\)/.test(s)) return [{ saat: "2026-11-03 10:00:00" }];
      if (/FROM perkara p LEFT JOIN perkara_penetapan/.test(s)) return [{ perkaraId: 5, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, tanggalDaftar: "2026-09-01" }];
      return [];
    };
    const diminta: string[] = [];
    const layanan = kasir.buatLayanan({
      kueri,
      tabelAda: async () => true,
      kontakParaPihak: async (nomor: string) => {
        diminta.push(nomor);
        return {
          ok: true, ada: true, lewatEcourt: true, ecourtTerbaca: true,
          orang: [{ jenis: "pihak", pihakKe: 2, nama: "T", email: { nilai: "t@contoh.id" }, hp: { nilai: "0812", bisaWhatsApp: true }, elitigasi: { status: "ya" } }],
        };
      },
    });
    const b = await layanan.bacaKeadaan(5);
    expect(diminta).toEqual(["5/Pdt.G/2026/PA.Dgl"]);
    expect(b.keadaan.beracara).toEqual({ eCourt: true, ecourtTerbaca: true, tergugat: [{ nama: "T", email: "ada", wa: "ada", setujuElektronik: true }] });
    expect(JSON.stringify(b.keadaan)).not.toContain("t@contoh.id");

    const gagal = kasir.buatLayanan({ kueri, tabelAda: async () => true, kontakParaPihak: async () => { throw new Error("putus"); } });
    expect((await gagal.bacaKeadaan(5)).keadaan.beracara).toBeNull();
    // Uji lama (deps.kueri tanpa kontakParaPihak): tidak menyentuh basis data sungguhan.
    expect((await kasir.buatLayanan({ kueri, tabelAda: async () => true }).bacaKeadaan(5)).keadaan.beracara).toBeNull();
  });
});

describe("Kasir otomatis memakai aturan yang sama (susunUsulan)", () => {
  /** Putus hari ini (3 Nov) di sidang ke-3; Tergugat hadir 1 Okt, tidak hadir 15 Okt, hadir lagi 3 Nov; relaas 3 Nov belum tercatat. */
  const putusHariIni = (beracaraNilai?: unknown) =>
    keadaan({
      beracara: beracaraNilai,
      sidang: [
        { id: 11, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 1, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
        { id: 12, urutan: 2, tanggal: "2026-10-15", dihadiriOleh: 2, ikrar: false, ditunda: true, hasil: "ditunda", agenda: "" },
        { id: 13, urutan: 3, tanggal: "2026-11-03", dihadiriOleh: 1, ikrar: false, ditunda: false, hasil: "putus dikabulkan", agenda: "" },
      ],
      putusan: { tanggal: "2026-11-03", statusId: 62, statusNama: "Dikabulkan", verstek: "T" },
    });
  const psp = (r: Baris) => r.butir.find((b: Baris) => b.kunci === "psp").baris.find((x: Baris) => x.status !== "sudah");

  it("lama: Biaya Panggilan tercentang menahan Pengembalian Sisa Panjar; e-litigasi: tidak menahan, tanpa Biaya Panggilan di kiriman", () => {
    const lama = otomatis.rencanaOtomatis(putusHariIni(undefined), { hari: "2026-11-03" });
    expect(psp(lama).status).toBe("dilewati");
    expect(psp(lama).alasan).toMatch(/Biaya Panggilan Tergugat/);

    const baru = otomatis.rencanaOtomatis(putusHariIni(ELIT), { hari: "2026-11-03" });
    expect(baru.kirim.some((u: Baris) => u.jenisBiayaId === 14)).toBe(false);
    expect(psp(baru).alasan).not.toMatch(/Biaya Panggilan/);
    expect(psp(baru).status).toBe("akan");
  });
});
