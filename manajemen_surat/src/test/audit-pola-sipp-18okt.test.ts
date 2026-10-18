/**
 * ============================================================================
 * AUDIT POLA SIPP 18 OKT 2026 - PERILAKU, BUKAN TEKS KODE
 * ============================================================================
 *
 * Tiap uji di sini MENJALANKAN layanan bot (dengan basis data tiruan) dan
 * memeriksa nilai yang akan ditulis ke SIPP. Angka acuan diukur atas
 * sipp_donggala (petugas, 2026) - lihat docs/audit/AUDIT-POLA-SIPP-18okt.md.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { JEDA_ANTAR_PERKARA_MS, lamaJedaAntarPerkara } from "@/lib/kasir-otomatis";

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const jalurBot = (r: string) => require_.resolve(path.join(akarBot, r));

type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = jalurBot(relatif);
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
const SEGAR = [
  "services/penetapanTulisService.js",
  "services/sidangHasilService.js",
  "services/ikrarTalakService.js",
  "services/dokumenPenetapanService.js",
];
function muatSegar<T>(relatif: string): T {
  for (const r of SEGAR) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
  return require_(jalurBot(relatif)) as T;
}
afterEach(() => {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
  for (const r of SEGAR) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
});

type Balik = (g: unknown, h: unknown) => void;
type Jawab = (sql: string, params: unknown[]) => unknown;
function dbTiruan(jawab: Jawab) {
  const kueri: Array<{ sql: string; params: unknown[] }> = [];
  pasang("db_config.js", {
    query: (sql: string, params: unknown, balik?: Balik) => {
      const cb = (typeof params === "function" ? params : balik) as Balik;
      const p = Array.isArray(params) ? params : [];
      kueri.push({ sql: String(sql), params: p });
      const h = jawab(String(sql), p);
      cb(null, h === undefined ? [] : h);
    },
  });
  return kueri;
}

const det = (s: string) => Date.parse(`${s.replace(" ", "T")}Z`) / 1000;

// ============================================================================
// 1. Penetapan: jam rangkaian tidak pernah meregang melintasi hari
// ============================================================================
describe("jam rangkaian penetapan (jamRangkaianManusia)", () => {
  type Hasil = { jam: Record<string, string>; jeda: number[]; catatan: string[] };
  const muat = () => {
    dbTiruan(() => []);
    return muatSegar<{ jamRangkaianManusia: (p: Record<string, unknown>) => Hasil }>(
      "services/penetapanTulisService.js"
    ).jamRangkaianManusia;
  };

  it("ditekan 05.02 atas perkara yang kejadian terakhirnya Jumat: keempatnya tetap HARI INI, urut, berjeda wajar", () => {
    const f = muat();
    for (let i = 0; i < 300; i += 1) {
      const r = f({ urutan: ["pmh", "ppp", "pjs", "phs"], sekarang: "2026-10-19 05:02:00", lantai: "2026-10-16 09:20:00" });
      const t = ["pmh", "ppp", "pjs", "phs"].map((x) => r.jam[x]);
      for (const j of t) expect(j.slice(0, 10)).toBe("2026-10-19");
      const d = t.map(det);
      expect(d[0]).toBeLessThan(d[1]);
      expect(d[1]).toBeLessThan(d[2]);
      expect(d[2]).toBeLessThan(d[3]);
      expect(d[3]).toBeLessThanOrEqual(det("2026-10-19 05:02:00"));
      // PPP -> PJS orang yang sama: petugas p95 47 dtk; rentang mesin 5-45 dtk.
      expect(d[2] - d[1]).toBeLessThanOrEqual(45);
      expect(d[1] - d[0]).toBeLessThanOrEqual(1800);
    }
  });

  it("ditekan 00.05: tidak mundur ke kemarin walau kejadian terakhirnya kemarin sore", () => {
    const f = muat();
    for (let i = 0; i < 200; i += 1) {
      const r = f({ urutan: ["pmh", "ppp", "pjs", "phs"], sekarang: "2026-10-20 00:05:00", lantai: "2026-10-19 15:00:00" });
      for (const x of ["pmh", "ppp", "pjs", "phs"]) expect(r.jam[x].slice(0, 10)).toBe("2026-10-20");
    }
  });

  it("jam kerja biasa: jeda asli tidak diubah (median PMH>PPP menit-an, bukan jam-an)", () => {
    const f = muat();
    const pmhPpp: number[] = [];
    for (let i = 0; i < 400; i += 1) {
      const r = f({ urutan: ["pmh", "ppp", "pjs", "phs"], sekarang: "2026-10-19 10:00:00", lantai: "2026-10-16 09:20:00" });
      pmhPpp.push(det(r.jam.ppp) - det(r.jam.pmh));
      expect(r.catatan).not.toContain("jeda_dirapatkan");
    }
    pmhPpp.sort((a, b) => a - b);
    expect(pmhPpp[pmhPpp.length - 1]).toBeLessThanOrEqual(1800);
    expect(pmhPpp[0]).toBeGreaterThanOrEqual(90);
  });
});

// ============================================================================
// 2. Tunda/Putus: jam borang dan bentuk "EDIT JADWAL SIDANG"
// ============================================================================
const KEADAAN = {
  jadwalId: 20400,
  perkaraId: 10300,
  tanggalSidang: "2026-10-19",
  jamSidang: "09:00:00",
  sampaiJam: null,
  agenda: "Pembuktian",
  urutan: 3,
  ditunda: "T",
  alasanDitunda: null,
  ruanganId: 1,
  ruangan: "Ruang Sidang Utama",
  sidangKeliling: "T",
  sifatSidang: null,
  dihadiriOleh: 2,
  verzet: "T",
  keberatan: "T",
  ikrarTalak: "T",
  keterangan: null,
  nomorPerkara: "700/Pdt.G/2026/PA.Dgl",
  alurPerkaraId: 15,
  jenisPerkaraId: 347,
  jenisPerkara: "Cerai Gugat",
  tanggalPutusan: null,
  tanggalBht: null,
  tanggalPenetapanSidangIkrar: null,
};

function pasangSidang(keadaan: Record<string, unknown>, { jamMasuk = "09:12:47", utc = "2026-10-19 03:40:10" } = {}) {
  const kueri = dbTiruan((sql) => {
    if (sql.includes("JOIN perkara p ON p.perkara_id = j.perkara_id") && sql.includes("j.id = ?")) return [keadaan];
    if (sql.includes("FROM perkara_panitera_pn c"))
      return [{ panitera_id: 7, panitera_nama: "Unun F", tanggal_penetapan: "2026-09-01", username: "Unun", fullname: "Unun F", block: 0 }];
    if (sql.includes("FROM status_putusan")) return [{ id: 62, nama: "DIKABULKAN" }];
    if (sql.includes("FROM proses_alur_perkara"))
      return [{ tahapanId: 14, tahapanNama: "Persidangan", prosesId: 200, prosesNama: "Persidangan" }];
    if (sql.includes("UTC_TIMESTAMP()")) return [{ utc }];
    if (sql.includes("DATE_FORMAT(NOW()")) return [{ saat: "2026-10-19 11:40:10" }];
    if (sql.includes("COUNT(*) AS n FROM perkara_jadwal_sidang")) return [{ n: 0 }];
    return [];
  });
  pasang("services/externalDbService.js", {
    query: async () => [
      { id: keadaan.jadwalId, perkara_id: keadaan.perkaraId, tanggal_sidang: "2026-10-19", ruangan_id: 1, disidang: 1, jam_sidang: jamMasuk, pihak_1: 1, pihak_2: null },
    ],
  });
  return kueri;
}

type Langkah = { tabel: string; aksi: string; sql: string; params: unknown[] };
type Rencana = { ok: boolean; alasan?: string; langkah: Langkah[]; andaian: string[]; batas?: string };

describe("putus sidang: nama halaman borang EDIT JADWAL SIDANG", () => {
  it("satu baris audit jadwal bernama halaman EDIT JADWAL SIDANG, atas akun PP, jam SIPP; tidak menulis putusan maupun tahapan", async () => {
    pasangSidang(KEADAAN);
    const s = muatSegar<{ susunRencanaPutus: (m: Record<string, unknown>) => Promise<Rencana> }>("services/sidangHasilService.js");
    const r = await s.susunRencanaPutus({ jadwalId: 20400, statusPutusanId: 62, verstek: "Y", ip: "192.168.9.82", operator: "uji" });
    expect(r.ok).toBe(true);
    const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
    expect(audit.map((l) => [l.params[3], l.params[4], l.params[5]])).toEqual([
      ["perkara_jadwal_sidang", "EDIT JADWAL SIDANG", "UPDATE"],
    ]);
    expect(audit[0].params[0]).toBe("2026-10-19 10:40:10");
    expect(audit[0].params[2]).toBe("Unun");
    // Keputusan 30 Sep butir 12: bukan perkara_putusan, bukan tahapan perkara.
    expect(r.langkah.map((l) => l.tabel)).toEqual(["perkara_jadwal_sidang", "sys_audittrail"]);
  });

  it("jam_sidang dan sampai_jam berbentuk jam borang (detik 00); jam selesai > jam mulai", async () => {
    pasangSidang(KEADAAN);
    const s = muatSegar<{ susunRencanaPutus: (m: Record<string, unknown>) => Promise<Rencana> }>("services/sidangHasilService.js");
    const r = await s.susunRencanaPutus({ jadwalId: 20400, statusPutusanId: 62, verstek: "T", ip: "192.168.9.82" });
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang" && l.aksi === "UPDATE");
    expect(jadwal?.params[0]).toBe("11:40:00"); // sampai_jam (WITA setempat), detik 00
    expect(jadwal?.params[2]).toBe("09:12:00"); // jam_sidang = jam masuk ruang 09:12:47 -> 09:12
  });

  it("ditekan pada menit yang sama dengan jam masuk ruang: jam selesai menit berikutnya (validateEdit menolak sama)", async () => {
    pasangSidang(KEADAAN, { jamMasuk: "11:40:02" });
    const s = muatSegar<{ susunRencanaPutus: (m: Record<string, unknown>) => Promise<Rencana> }>("services/sidangHasilService.js");
    const r = await s.susunRencanaPutus({ jadwalId: 20400, statusPutusanId: 62, verstek: "T", ip: "192.168.9.82" });
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang" && l.aksi === "UPDATE");
    expect(jadwal?.params[2]).toBe("11:40:00");
    expect(jadwal?.params[0]).toBe("11:41:00");
  });
});

describe("tunda sidang: jam borang", () => {
  it("baris hari ini: jam_sidang & sampai_jam detik 00; formulir tetap PENUNDAAN JADWAL SIDANG", async () => {
    pasangSidang(KEADAAN);
    const s = muatSegar<{ susunRencanaTunda: (m: Record<string, unknown>) => Promise<Rencana> }>("services/sidangHasilService.js");
    const r = await s.susunRencanaTunda({
      jadwalId: 20400,
      alasanTunda: "Tergugat tidak hadir",
      tanggalBerikut: "2026-10-26",
      jamBerikut: "09:00",
      agendaBerikut: "Pembuktian Penggugat",
      ip: "192.168.9.82",
    });
    expect(r.ok).toBe(true);
    const ubah = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang" && l.aksi === "UPDATE");
    const nilai = ubah?.params ?? [];
    expect(nilai).toContain("09:12:00");
    expect(nilai).toContain("11:40:00");
    expect(nilai.some((v) => typeof v === "string" && /^\d{2}:\d{2}:(?!00)\d{2}$/.test(v))).toBe(false);
    const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
    expect(audit.every((a) => a.params[4] === "PENUNDAAN JADWAL SIDANG")).toBe(true);
  });
});

// ============================================================================
// 3. Ikrar talak: tenggat 6 bulan sejak penetapan hari sidang ikrar (no. 91)
// ============================================================================
describe("tenggat 6 bulan ikrar (bot)", () => {
  const muatIkrar = () => {
    dbTiruan(() => []);
    return muatSegar<{
      batasEnamBulanIkrar: (b: Record<string, unknown>) => string;
      keteranganBatasIkrar: (b: Record<string, unknown>) => string;
    }>("services/ikrarTalakService.js");
  };

  it("PHS ikrar + 6 bulan kalender; akhir bulan jatuh ke hari terakhir bulan tujuan", () => {
    const i = muatIkrar();
    expect(i.batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-09-22" })).toBe("2027-03-22");
    expect(i.batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-08-31" })).toBe("2027-02-28");
    expect(i.batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2027-08-31" })).toBe("2028-02-29");
  });

  it("BHT tidak lagi dipakai sebagai dasar: tanpa PHS ikrar tenggat belum berjalan", () => {
    const i = muatIkrar();
    expect(i.batasEnamBulanIkrar({ tanggalBht: "2026-09-01" })).toBe("");
    expect(i.batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-10-05", tanggalBht: "2026-09-01" })).toBe("2027-04-05");
    expect(i.keteranganBatasIkrar({ tanggalBht: "2026-09-01" })).toContain("belum ditetapkan hari sidang ikrar");
  });

  it("tunda sidang ikrar melewati tenggat DITOLAK; pada tanggal batasnya sendiri masih boleh", async () => {
    const ikrar = { ...KEADAAN, ikrarTalak: "Y", tanggalPenetapanSidangIkrar: "2026-10-05", tanggalBht: "2026-09-01" };
    const minta = {
      jadwalId: 20400,
      alasanTunda: "Pemohon tidak hadir Ikrar Talak",
      jamBerikut: "09:00",
      agendaBerikut: "SIDANG IKRAR TALAK",
      ip: "192.168.9.82",
    };
    pasangSidang(ikrar);
    let s = muatSegar<{ susunRencanaTunda: (m: Record<string, unknown>) => Promise<Rencana> }>("services/sidangHasilService.js");
    const lewat = await s.susunRencanaTunda({ ...minta, tanggalBerikut: "2027-04-06" });
    expect(lewat.ok).toBe(false);
    expect(lewat.alasan).toBe("tanggal_ikrar_melewati_batas_6_bulan");
    expect(lewat.batas).toBe("2027-04-05");

    pasangSidang(ikrar);
    s = muatSegar<{ susunRencanaTunda: (m: Record<string, unknown>) => Promise<Rencana> }>("services/sidangHasilService.js");
    const tepat = await s.susunRencanaTunda({ ...minta, tanggalBerikut: "2027-04-05" });
    expect(tepat.alasan).not.toBe("tanggal_ikrar_melewati_batas_6_bulan");
  });
});

// ============================================================================
// 4. e-Doc penetapan: diinput_tanggal berjam dua belas
// ============================================================================
describe("perkara_dokumen_penetapan.diinput_tanggal (jamDuaBelas)", () => {
  it("13:05:07 -> 01:05:07; 12 tetap 12; 00 menjadi 12; pagi tidak berubah", () => {
    dbTiruan(() => []);
    const d = muatSegar<{ jamDuaBelas: (s: string) => string }>("services/dokumenPenetapanService.js");
    expect(d.jamDuaBelas("2026-10-19 13:05:07")).toBe("2026-10-19 01:05:07");
    expect(d.jamDuaBelas("2026-10-19 12:30:00")).toBe("2026-10-19 12:30:00");
    expect(d.jamDuaBelas("2026-10-19 00:10:00")).toBe("2026-10-19 12:10:00");
    expect(d.jamDuaBelas("2026-10-19 09:41:33")).toBe("2026-10-19 09:41:33");
  });
});

// ============================================================================
// 5. Kasir otomatis: jarak antarperkara seperti kasir sungguhan
// ============================================================================
describe("jeda antarperkara Kasir otomatis", () => {
  it("20-150 detik, log-seragam: ujung rentang dan tengahnya", () => {
    expect(lamaJedaAntarPerkara(() => 0)).toBe(JEDA_ANTAR_PERKARA_MS.min);
    expect(lamaJedaAntarPerkara(() => 1)).toBe(JEDA_ANTAR_PERKARA_MS.maks);
    const tengah = lamaJedaAntarPerkara(() => 0.5);
    expect(tengah).toBeGreaterThan(50_000);
    expect(tengah).toBeLessThan(60_000);
  });

  it("tidak pernah di bawah 20 detik (petugas: <=5 dtk hanya 0,4%)", () => {
    for (let i = 0; i < 500; i += 1) expect(lamaJedaAntarPerkara()).toBeGreaterThanOrEqual(20_000);
  });
});
