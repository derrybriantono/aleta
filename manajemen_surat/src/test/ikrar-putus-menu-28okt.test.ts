/**
 * ============================================================================
 * TOMBOL PUTUS SIDANG IKRAR TALAK - TIGA STATUS, AKUN PETUGAS (28 Okt 2026)
 * ============================================================================
 *
 * Rencana D:/aleta-dev/kerja/rencana-ikrar-putus-28okt.md, keputusan pengguna
 * P1-P10. Uji PERILAKU: layanan bot dijalankan dengan basis data tiruan dan
 * nilai yang akan ditulis ke SIPP diperiksa. Nama pihak samaran.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
  "services/sidangHasilAlur.js",
];
function muatSegar<T>(relatif: string): T {
  for (const r of SEGAR) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
  return require_(jalurBot(relatif)) as T;
}
afterEach(() => {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
  for (const r of SEGAR) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
});

type Baris = Record<string, unknown>;
type Balik = (g: unknown, h: unknown) => void;
type Jawab = (sql: string, params: unknown[]) => unknown;
type Kueri = { sql: string; params: unknown[] };

/** db_config tiruan; `sambungan` meniru getConnection (transaksi) dengan penjawab yang sama. */
function dbTiruan(jawab: Jawab) {
  const kueri: Kueri[] = [];
  const query = (sql: string, params: unknown, balik?: Balik) => {
    const cb = (typeof params === "function" ? params : balik) as Balik;
    const p = Array.isArray(params) ? params : [];
    kueri.push({ sql: String(sql), params: p });
    const h = jawab(String(sql), p);
    cb(null, h === undefined ? [] : h);
  };
  pasang("db_config.js", {
    query,
    getConnection: (cb: (g: unknown, s: unknown) => void) => cb(null, { query, release: () => undefined }),
  });
  return kueri;
}

// Jadwal sidang ikrar (perkara 9988 samaran): PP pemeriksaan "Unun", PP ikrar "Rahma".
const JADWAL = {
  jadwalId: 500,
  perkaraId: 9988,
  tanggalSidang: "2026-10-28",
  jamSidang: "09:00:00",
  sampaiJam: null,
  agenda: "SIDANG IKRAR TALAK",
  urutan: 6,
  ditunda: "T",
  alasanDitunda: "0",
  alasanDitundaAsli: "0",
  ruanganId: 1,
  ruangan: "Ruang Sidang 1",
  sidangKeliling: "T",
  sifatSidang: null,
  dihadiriOleh: 1,
  verzet: "T",
  keberatan: "T",
  ikrarTalak: "Y",
  keterangan: null,
  nomorPerkara: "474/Pdt.G/2026/PA.Dgl",
  alurPerkaraId: 15,
  jenisPerkaraId: 346,
  jenisPerkara: "Cerai Talak",
  tanggalPutusan: "2026-09-01",
  tanggalBht: "2026-09-15",
  tanggalPenetapanSidangIkrar: "2026-10-14",
};
const IKRAR = {
  jadwalId: 500,
  perkaraId: 9988,
  tanggalSidang: "2026-10-28",
  ikrarTalak: "Y",
  ditunda: "T",
  alasanDitunda: "0",
  keterangan: null,
  dihadiriOleh: 1,
  nomorPerkara: "474/Pdt.G/2026/PA.Dgl",
  pihak1: "Ahmad bin Samaran",
  pihak2: "Siti binti Samaran",
  tanggalPutusan: "2026-09-01",
  tanggalBht: "2026-09-15",
  adaBarisIkrar: 9988,
  tglIkrar: null,
  statusIkrar: null,
  amarIkrar: null,
  tanggalPenetapanSidang: "2026-10-14",
  penetapanJurusita: "2026-10-14",
  penetapanPp: "2026-10-14",
  penetapanMajelis: "2026-10-14",
  adaAkta: null,
  keadaanIstri: null,
};

type Opsi = {
  jadwal?: Baris;
  ikrar?: Baris;
  ppIkrar?: Baris[];
  ppAktif?: Baris[];
  hakimIkrar?: Baris[];
  majelisIkrar?: string | null;
  utc?: string;
  setempat?: string;
  lantai?: string;
  jamMasuk?: string;
  ulang?: (sql: string) => unknown;
};

function pasangIkrar(o: Opsi = {}) {
  const jadwal = { ...JADWAL, ...(o.jadwal || {}) };
  const ikrar = { ...IKRAR, ...(o.ikrar || {}) };
  const kueri = dbTiruan((sql) => {
    if (o.ulang) {
      const u = o.ulang(sql);
      if (u !== undefined) return u;
    }
    if (sql.includes("AS adaBarisIkrar")) return [ikrar];
    if (sql.includes("JOIN perkara p ON p.perkara_id = j.perkara_id") && sql.includes("j.id = ?")) return [jadwal];
    if (sql.includes("FROM perkara_ikrar_talak it") && sql.includes("v_users"))
      return o.ppIkrar ?? [{ panitera_id: 9, panitera_nama: "Rahma P", tanggal_penetapan: "2026-10-14", username: "rahma", fullname: "Rahma P", block: 0 }];
    if (sql.includes("FROM perkara_panitera_pn c"))
      return o.ppAktif ?? [{ panitera_id: 7, panitera_nama: "Unun F", tanggal_penetapan: "2026-06-01", tahapan_id: 10, username: "Unun", fullname: "Unun F", block: 0 }];
    if (sql.includes("FROM perkara_hakim_pn")) return o.hakimIkrar ?? [{ hakimId: 32, jabatanId: 1 }, { hakimId: 26, jabatanId: 2 }];
    if (sql.includes("SELECT majelis_hakim_id AS majelis")) return [{ majelis: o.majelisIkrar ?? null }];
    if (sql.includes("FROM user_hakim uh JOIN sys_users su"))
      return [{ userid: 51, username: "fahri", fullname: "Fahri, S.H.I.", block: 0, kedaluwarsa: null }];
    if (sql.includes("FROM sys_users WHERE username = ?"))
      return [{ userid: 51, username: "fahri", fullname: "Fahri, S.H.I.", block: 0, kedaluwarsa: null }];
    if (sql.includes("UNION ALL SELECT 'panitera'")) return [{ jabatan: "hakim", id: 32 }];
    if (sql.includes("FROM sys_config WHERE name = 'NamaPN'")) return [{ value: "PENGADILAN AGAMA DONGGALA" }];
    if (sql.includes("GREATEST(")) return [{ lantai: o.lantai ?? "2026-10-27 15:00:00" }];
    if (sql.includes("UTC_TIMESTAMP()")) return [{ utc: o.utc ?? "2026-10-28 03:40:10" }];
    if (sql.includes("DATE_FORMAT(NOW()")) return [{ saat: o.setempat ?? "2026-10-28 11:40:10" }];
    if (sql.includes("COUNT(*) AS n FROM perkara_jadwal_sidang")) return [{ n: 0 }];
    return [];
  });
  pasang("services/externalDbService.js", {
    query: async () => [
      { id: 500, perkara_id: 9988, tanggal_sidang: "2026-10-28", ruangan_id: 1, disidang: 1, jam_sidang: o.jamMasuk ?? "09:12:47", pihak_1: 1, pihak_2: 1 },
    ],
  });
  return kueri;
}

type Langkah = { tabel: string; aksi: string; sql: string; params: unknown[]; keterangan?: string };
type Rencana = Baris & { ok: boolean; alasan?: string; langkah: Langkah[]; andaian: string[] };
type Layanan = {
  susunRencanaPutusIkrar: (m: Baris) => Promise<Rencana>;
  susunRencanaPutus: (m: Baris) => Promise<Rencana>;
  jalankanRencanaUtuh: (r: unknown, o: Baris) => Promise<Baris>;
  paniteraSidangIkrar: (id: number, t: string) => Promise<Baris>;
};
const muatLayanan = () => muatSegar<Layanan>("services/sidangHasilService.js");
const biaya = async () => ({ angka: "14.500", terbilang: "empat belas ribu lima ratus", jumlah: 14500 });
const det = (s: string) => Date.parse(`${s.replace(" ", "T")}Z`) / 1000;

/** Kolom deskripsi audit (urutan) dari tabel HTML SIPP. */
function kolomAudit(deskripsi: unknown): Array<[string, string]> {
  return [...String(deskripsi).matchAll(/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((m) => [m[1], m[2]]);
}
const KOLOM_BORANG_EDIT = [
  "tanggal_sidang",
  "jam_sidang",
  "sampai_jam",
  "agenda",
  "dihadiri_oleh",
  "alasan_ditunda",
  "sifat_sidang",
  "keterangan",
  "diperbaharui_oleh",
  "diperbaharui_tanggal",
  "ruangan_id",
  "ruangan",
  "sidang_keliling",
];

// ============================================================================
// P3a: deskripsi audit 13 kolom borang EDIT JADWAL SIDANG - juga Putus biasa
// ============================================================================
describe("audit EDIT JADWAL SIDANG 13 kolom (P3a)", () => {
  it("Putus biasa: 13 kolom urutan borang, tanpa ditunda, jam HH:mm; sifat sidang kosong diisi bawaan borang", async () => {
    pasangIkrar({
      jadwal: { ikrarTalak: "T", jenisPerkaraId: 347, agenda: "Pembuktian" },
      ulang: (sql) => (sql.includes("FROM status_putusan") ? [{ id: 62, nama: "DIKABULKAN" }] : undefined),
    });
    const r = await muatLayanan().susunRencanaPutus({ jadwalId: 500, statusPutusanId: 62, verstek: "T", ip: "192.168.9.82" });
    expect(r.ok).toBe(true);
    const audit = r.langkah.find((l) => l.tabel === "sys_audittrail")!;
    const kolom = kolomAudit(audit.params[7]);
    expect(kolom.map((k) => k[0])).toEqual(KOLOM_BORANG_EDIT);
    const nilai = Object.fromEntries(kolom);
    expect(nilai.jam_sidang).toBe("09:12");
    expect(nilai.sampai_jam).toMatch(/^\d{2}:\d{2}$/);
    expect(nilai.alasan_ditunda).toBe("putus DIKABULKAN");
    expect(nilai.sifat_sidang).toBe("T"); // cerai gugat 347: Tertutup
    expect(nilai.ruangan).toBe("Ruang Sidang 1");
    expect(nilai.sidang_keliling).toBe("T");
    // Nilai di basis data sama dengan yang diaudit: sifat sidang ikut ditulis.
    const ubah = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
    expect(ubah.sql).toContain("sifat_sidang = ?");
    expect(ubah.params).toContain("T");
    // Posisi param lama tidak bergeser (sampai_jam, alasan, jam_sidang, ditunda).
    expect(ubah.params[2]).toBe("09:12:00");
  });
});

// ============================================================================
// T1: jalur status 1 - PP ikrar, ketua majelis, jam dua akun, idempoten
// ============================================================================
describe("putus ikrar status 1 (Diikrarkan)", () => {
  it("keterangan atas akun PP IKRAR (bukan PP pemeriksaan); form atas ketua majelis ikrar", async () => {
    pasangIkrar();
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ip: "192.168.9.82", ambilBiaya: biaya });
    expect(r.ok).toBe(true);
    const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
    expect(audit.map((a) => [a.params[2], a.params[4]])).toEqual([
      ["rahma", "EDIT JADWAL SIDANG"],
      ["fahri", "add/edit ikrar talak/akta cerai"],
    ]);
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
    expect(jadwal.params).toContain("telah ikrar talak");
    expect(jadwal.params).toContain("Ikrar Telah Dilaksanakan");
    expect(kolomAudit(audit[0].params[7]).map((k) => k[0])).toEqual(KOLOM_BORANG_EDIT);
    expect((r.atasNama as Baris).username).toBe("rahma");
    expect(((r.formIkrar as Baris).atasNama as Baris).username).toBe("fahri");
    const form = r.langkah.find((l) => l.tabel === "perkara_ikrar_talak")!;
    expect(form.params[1]).toBe(1);
    expect(String(form.params[2])).toContain("talak satu raj&#39;i");
    expect(String(form.params[2])).not.toMatch(/MENETAPKAN/); // P9
  });

  it("P10: penetapan 3-30 menit SESUDAH keterangan sidang; keduanya <= jam SIPP; keterangan tidak mendahului jam masuk ruang", async () => {
    for (let i = 0; i < 60; i += 1) {
      pasangIkrar();
      const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
      const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
      const tJadwal = det(String(audit[0].params[0]));
      const tForm = det(String(audit[1].params[0]));
      const selisih = tForm - tJadwal;
      expect(selisih).toBeGreaterThanOrEqual(1);
      expect(selisih).toBeLessThanOrEqual(1800);
      expect(tForm).toBeLessThanOrEqual(det("2026-10-28 10:40:10")); // jam SIPP (UTC+7)
      // jam masuk 09:12:47 WITA = 08:12:47 WIB.
      expect(tJadwal).toBeGreaterThanOrEqual(det("2026-10-28 08:12:47"));
      // diperbaharui_tanggal jadwal = jam audit jadwal; proses 295 = jam audit form.
      const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
      expect(jadwal.params).toContain(audit[0].params[0]);
      const proses = r.langkah.find((l) => l.tabel === "perkara_proses")!;
      expect(proses.params[8]).toBe(audit[1].params[0]);
      expect(proses.params[7]).toBe("fahri");
    }
  });

  it("jam kerja biasa dengan ruang longgar: jeda asli 180-1800 detik (tidak dirapatkan)", async () => {
    pasangIkrar({ jamMasuk: "08:05:00", utc: "2026-10-28 05:00:00", setempat: "2026-10-28 13:00:00" });
    const s = muatLayanan();
    for (let i = 0; i < 40; i += 1) {
      const r = await s.susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
      const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
      const d = det(String(audit[1].params[0])) - det(String(audit[0].params[0]));
      expect(d).toBeGreaterThanOrEqual(180);
      expect(d).toBeLessThanOrEqual(1800);
    }
  });

  it("sampai_jam = jam setempat langkah keterangan (bukan jam tombol); detik 00", async () => {
    pasangIkrar();
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    const audit = r.langkah.find((l) => l.tabel === "sys_audittrail")!;
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
    const setempat = new Date((det(String(audit.params[0])) + 3600) * 1000).toISOString().slice(11, 16);
    expect(jadwal.params[0]).toBe(`${setempat}:00`);
  });

  it("P8: tanpa baris majelis tahapan 18 -> id pertama majelis_hakim_id ikrar; baris ada tanpa ketua tetap ditolak", async () => {
    pasangIkrar({ hakimIkrar: [], majelisIkrar: "32,26,40" });
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    expect(((r.formIkrar as Baris).atasNama as Baris).username).toBe("fahri");

    pasangIkrar({ hakimIkrar: [{ hakimId: 26, jabatanId: 2 }], majelisIkrar: "32,26,40" });
    const tanpa = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    expect((tanpa.formIkrar as Baris).ok).toBe(false);
    expect((tanpa.formIkrar as Baris).alasan).toBe("ketua_majelis_ikrar_tidak_ada");
  });

  it("PP ikrar belum ditetapkan: PP tahapan 18, lalu PP pemeriksaan tunggal; PP pemeriksaan ganda ditolak", async () => {
    pasangIkrar({
      ppIkrar: [],
      ppAktif: [
        { panitera_id: 7, panitera_nama: "Unun F", tahapan_id: 10, username: "Unun", fullname: "Unun F", block: 0 },
        { panitera_id: 9, panitera_nama: "Rahma P", tahapan_id: 18, username: "rahma", fullname: "Rahma P", block: 0 },
      ],
    });
    let pp = await muatLayanan().paniteraSidangIkrar(9988, "2026-10-28");
    expect((pp.akun as Baris).username).toBe("rahma");
    expect(pp.sumber).toBe("pp_tahapan_ikrar");

    pasangIkrar({ ppIkrar: [] });
    pp = await muatLayanan().paniteraSidangIkrar(9988, "2026-10-28");
    expect((pp.akun as Baris).username).toBe("Unun");
    expect(pp.sumber).toBe("pp_pemeriksaan");

    pasangIkrar({
      ppIkrar: [],
      ppAktif: [
        { panitera_id: 7, panitera_nama: "Unun F", tahapan_id: 10, username: "Unun", block: 0 },
        { panitera_id: 8, panitera_nama: "Lain", tahapan_id: 10, username: "lain", block: 0 },
      ],
    });
    pp = await muatLayanan().paniteraSidangIkrar(9988, "2026-10-28");
    expect(pp.ok).toBe(false);
    expect(pp.alasan).toBe("panitera_sidang_ikrar_tidak_pasti");

    // PP ikrar berakun ganda: ditolak dengan namanya (P6), tidak jatuh ke PP lain.
    pasangIkrar({
      ppIkrar: [
        { panitera_id: 29, panitera_nama: "Ganda", username: "ganda1", block: 0 },
        { panitera_id: 29, panitera_nama: "Ganda", username: "ganda2", block: 0 },
      ],
    });
    pp = await muatLayanan().paniteraSidangIkrar(9988, "2026-10-28");
    expect(pp.alasan).toBe("akun_sipp_pp_ganda");
    expect(pp.nama).toEqual(["Ganda"]);
  });

  it("idempoten: jadwal sudah 'telah ikrar talak' -> tanpa langkah jadwal & tanpa audit jadwal baru", async () => {
    pasangIkrar({ jadwal: { alasanDitunda: "telah ikrar talak", alasanDitundaAsli: "telah ikrar talak" } });
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    expect(r.ok).toBe(true);
    expect(r.jadwalSudahTercatat).toBe(true);
    expect(r.langkah.some((l) => l.tabel === "perkara_jadwal_sidang")).toBe(false);
    expect(r.langkah.filter((l) => l.tabel === "sys_audittrail").map((a) => a.params[3])).toEqual(["perkara_ikrar_talak"]);
  });

  it("idempoten: form sudah status 1 + tanggal sama -> form dilewati (sudahTerisi), e-Doc tetap jalan", async () => {
    pasangIkrar({
      jadwal: { alasanDitunda: "telah ikrar talak", alasanDitundaAsli: "telah ikrar talak" },
      ikrar: { tglIkrar: "2026-10-28", statusIkrar: "1", amarIkrar: "<ol><li>Menyatakan perkawinan ... putus karena perceraian dengan talak satu raj'i;</li></ol>" },
    });
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    expect(r.ok).toBe(true);
    expect(r.langkah).toHaveLength(0);
    expect(r.formIkrar).toMatchObject({ ok: true, sudahTerisi: true });
  });

  it("form berstatus LAIN atau tanggal lain: ditolak UTUH (jadwal juga tidak ditulis)", async () => {
    pasangIkrar({ ikrar: { tglIkrar: "2026-10-28", statusIkrar: "3", amarIkrar: "x".repeat(60) } });
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    expect(r.ok).toBe(false);
    expect(r.alasan).toBe("status_ikrar_lain_sudah_tercatat");
    expect(r.tercatat).toBe("Rukun Kembali");

    pasangIkrar({ ikrar: { tglIkrar: "2026-10-14", statusIkrar: null } });
    const lain = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    expect(lain.alasan).toBe("tanggal_ikrar_lain_sudah_tercatat");
  });

  it("Pemohon tidak hadir (3/4) tidak dapat Diikrarkan", async () => {
    pasangIkrar();
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, dihadiriOleh: 3, ambilBiaya: biaya });
    expect(r.alasan).toBe("pemohon_tidak_hadir_tidak_dapat_diikrarkan");
  });

  it("tanpa konfirmasi ditolak; status tak dikenal ditolak", async () => {
    pasangIkrar();
    const s = muatLayanan();
    expect((await s.susunRencanaPutusIkrar({ jadwalId: 500 })).alasan).toBe("ikrar_belum_dikonfirmasi");
    expect((await s.susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 2 })).alasan).toBe("ikrar_belum_dikonfirmasi");
    expect((await s.susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 7, konfirmasiStatus: true })).alasan).toBe(
      "status_ikrar_tidak_dikenal"
    );
  });
});

// ============================================================================
// T2: status 2 (Pemohon Tidak Hadir) dan 3 (Rukun Kembali)
// ============================================================================
describe("putus ikrar status 2 dan 3", () => {
  // PHS ikrar 2026-04-30 -> batas 2026-10-30; sidang 2026-10-28 >= batas-14 hari (2026-10-16).
  const GUGUR = { tanggalPenetapanSidangIkrar: "2026-04-30" };
  const GUGUR_IKRAR = { tanggalPenetapanSidang: "2026-04-30", penetapanJurusita: "2026-04-30", penetapanPp: "2026-04-30", penetapanMajelis: "2026-04-30" };

  it("status 2: kehadiran 3/4 + sidang terakhir yang mungkin -> status 2, amar gugur, teks hasil sidang tetap", async () => {
    pasangIkrar({ jadwal: GUGUR, ikrar: GUGUR_IKRAR });
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 2, konfirmasiStatus: true, dihadiriOleh: 4, ambilBiaya: biaya });
    expect(r.ok).toBe(true);
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
    expect(jadwal.params).toContain("Pemohon tidak hadir, ikrar talak gugur");
    expect(jadwal.params).toContain("Ikrar Talak Gugur");
    const form = r.langkah.find((l) => l.tabel === "perkara_ikrar_talak")!;
    expect(form.params[1]).toBe(2);
    const amar = String(form.params[2]);
    expect(amar).toContain("Menyatakan Putusan Nomor 474/Pdt.G/2026/PA.Dgl tanggal 1 September 2026 tidak mempunyai kekuatan hukum");
    expect(amar).toContain("masih terikat dalam perkawinan yang sah");
    expect(amar).toContain("Rp14.500,-");
    expect(amar).not.toMatch(/MENETAPKAN/); // P9: tanpa judul
    // Proses 295 sama dengan status 1.
    expect(r.langkah.find((l) => l.tabel === "perkara_proses")!.params[3]).toBe("295");
  });

  it("status 2 ditolak: Pemohon hadir; sidang belum dekat batas; PHS ikrar belum ada", async () => {
    pasangIkrar({ jadwal: GUGUR, ikrar: GUGUR_IKRAR });
    let r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 2, konfirmasiStatus: true, dihadiriOleh: 2, ambilBiaya: biaya });
    expect(r.alasan).toBe("gugur_hanya_bila_pemohon_tidak_hadir");
    expect(r.langkah).toBeUndefined();

    pasangIkrar();
    r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 2, konfirmasiStatus: true, dihadiriOleh: 4, ambilBiaya: biaya });
    expect(r.alasan).toBe("gugur_belum_sidang_terakhir");
    expect(r.batas).toBe("2027-04-14");
    expect(r.awal).toBe("2027-03-31");

    pasangIkrar({ ikrar: { tanggalPenetapanSidang: null } });
    r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 2, konfirmasiStatus: true, dihadiriOleh: 4, ambilBiaya: biaya });
    expect(r.alasan).toBe("gugur_tenggat_belum_berjalan");
  });

  it("status 3: Pemohon hadir -> amar rukun kembali menyebut Panitera satker (huruf judul) dan nomor perkara", async () => {
    pasangIkrar();
    const r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 3, konfirmasiStatus: true, dihadiriOleh: 2, ambilBiaya: biaya });
    expect(r.ok).toBe(true);
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
    expect(jadwal.params).toContain("Pemohon dan Termohon rukun kembali");
    const form = r.langkah.find((l) => l.tabel === "perkara_ikrar_talak")!;
    expect(form.params[1]).toBe(3);
    const amar = String(form.params[2]);
    expect(amar).toContain("tidak menjatuhkan ikrar talak terhadap Termohon");
    expect(amar).toContain("Nomor 474/Pdt.G/2026/PA.Dgl tidak dapat dilanjutkan");
    expect(amar).toContain("Memerintahkan Panitera Pengadilan Agama Donggala untuk mencoret perkara Nomor 474/Pdt.G/2026/PA.Dgl");
    expect(amar).not.toMatch(/aleta/i);
  });

  it("status 3 ditolak bila Pemohon tidak hadir; jadwal 'telah ikrar talak' (bawaan antrian) diganti teks status 3", async () => {
    pasangIkrar();
    let r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 3, konfirmasiStatus: true, dihadiriOleh: 3, ambilBiaya: biaya });
    expect(r.alasan).toBe("rukun_kembali_pemohon_tidak_hadir");

    pasangIkrar({ jadwal: { alasanDitunda: "telah ikrar talak", alasanDitundaAsli: "telah ikrar talak", keterangan: "Ikrar Telah Dilaksanakan" } });
    r = await muatLayanan().susunRencanaPutusIkrar({ jadwalId: 500, statusIkrar: 3, konfirmasiStatus: true, dihadiriOleh: 2, ambilBiaya: biaya });
    expect(r.ok).toBe(true);
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_sidang")!;
    expect(jadwal.params).toContain("Pemohon dan Termohon rukun kembali");
    // Keterangan baku status lain DIGANTI, bukan disambung.
    expect(jadwal.params).toContain("Rukun Kembali, Ikrar Talak Tidak Dijatuhkan");
    expect(r.andaian.join(" ")).toContain("diganti");
  });

  it("teks status 2/3 tidak pernah terbaca sebagai ikrar terlaksana (pemicu isi form status 1 dan ekstensi)", () => {
    dbTiruan(() => []);
    const i = muatSegar<{
      STATUS_IKRAR: Record<number, { hasil: string; keterangan: string }>;
      ikrarTerlaksanaMenurutTeks: (t: string) => boolean;
      statusIkrarMenurutTeks: (t: string) => number;
    }>("services/ikrarTalakService.js");
    for (const s of [2, 3]) {
      expect(i.ikrarTerlaksanaMenurutTeks(i.STATUS_IKRAR[s].hasil)).toBe(false);
      expect(i.ikrarTerlaksanaMenurutTeks(i.STATUS_IKRAR[s].keterangan)).toBe(false);
      expect(i.statusIkrarMenurutTeks(i.STATUS_IKRAR[s].hasil)).toBe(s);
      expect(i.statusIkrarMenurutTeks(i.STATUS_IKRAR[s].keterangan)).toBe(s);
    }
    expect(i.statusIkrarMenurutTeks("telah ikrar talak")).toBe(1);
    expect(i.statusIkrarMenurutTeks("tunda 6 bulan")).toBe(0);
    for (const s of [1, 2, 3]) expect(`${i.STATUS_IKRAR[s].hasil} ${i.STATUS_IKRAR[s].keterangan}`).not.toMatch(/aleta/i);
  });
});

// ============================================================================
// Klik ganda: kunci FOR UPDATE + baca ulang di dalam transaksi
// ============================================================================
describe("pengaman klik ganda (FOR UPDATE + baca ulang)", () => {
  it("keadaan jadwal berubah sesudah rencana disusun: ROLLBACK, tidak ada UPDATE/INSERT", async () => {
    let tertulis = false;
    const kueri = pasangIkrar({
      ulang: (sql) => {
        if (sql.startsWith("SELECT ditunda, alasan_ditunda, keterangan FROM perkara_jadwal_sidang"))
          return [{ ditunda: "T", alasan_ditunda: "telah ikrar talak", keterangan: "Ikrar Telah Dilaksanakan" }];
        if (/^\s*(UPDATE|INSERT|CALL)/.test(sql)) tertulis = true;
        return undefined;
      },
    });
    const s = muatLayanan();
    const r = await s.susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    const h = await s.jalankanRencanaUtuh(r, { kering: false });
    expect(h.ok).toBe(false);
    expect(h.alasan).toBe("jadwal_berubah_sebelum_ditulis");
    expect(h.dipulihkan).toBe(true);
    expect(tertulis).toBe(false);
    const urut = kueri.map((k) => k.sql.trim().split(/\s+/).slice(0, 3).join(" "));
    const awal = urut.indexOf("START TRANSACTION");
    expect(urut[awal + 1]).toBe("SELECT perkara_id FROM");
    expect(kueri[awal + 1].sql).toContain("FOR UPDATE");
    expect(urut).toContain("ROLLBACK");
  });

  it("keadaan sama: lanjut menulis jadwal, audit, form, proses dalam satu transaksi lalu COMMIT", async () => {
    const kueri = pasangIkrar({
      ulang: (sql) => {
        if (sql.startsWith("SELECT ditunda, alasan_ditunda, keterangan FROM perkara_jadwal_sidang"))
          return [{ ditunda: "T", alasan_ditunda: "0", keterangan: null }];
        if (sql.includes("SELECT DATE_FORMAT(tgl_ikrar_talak")) return [{ tgl: null, status: null }];
        return undefined;
      },
    });
    pasang("services/bebanPenetapanService.js", { lupakanSimpanan: () => undefined });
    const s = muatLayanan();
    const r = await s.susunRencanaPutusIkrar({ jadwalId: 500, ikrarDilaksanakan: true, ambilBiaya: biaya });
    const h = await s.jalankanRencanaUtuh(r, { kering: false });
    expect(h.ok).toBe(true);
    const tulis = kueri.map((k) => k.sql.trim()).filter((q) => /^(UPDATE|INSERT|CALL|COMMIT)/.test(q));
    expect(tulis.map((q) => q.split(/\s+/).slice(0, 2).join(" "))).toEqual([
      "UPDATE perkara_jadwal_sidang",
      "INSERT INTO",
      "UPDATE perkara_ikrar_talak",
      "INSERT INTO",
      "CALL perkara_proses_update(?,?,?,?,?,?,?,?,?)",
      "CALL perkara_update_status(?)",
      "COMMIT",
    ]);
  });
});

// ============================================================================
// P7: status 2/3 hanya Super Admin, Ketua, Wakil Ketua, Hakim (portal)
// ============================================================================
describe("hak status ikrar 2/3 (P7)", () => {
  const aktor = (roleId: string, tambahan: string[] = []) => ({ id: `usr-${roleId}`, name: roleId, email: `${roleId}@uji`, roleId, additionalRoleIds: tambahan });

  it("boleh: super-admin, ketua, wakil-ketua, hakim; ditolak: admin, PP, panitera, peran tambahan hakim", async () => {
    const { bolehStatusIkrarBerat, statusIkrarDiminta } = await import("@/server/modules/aleta-ecourt/hak-putusan");
    for (const r of ["super-admin", "ketua", "wakil-ketua", "hakim"]) expect(bolehStatusIkrarBerat(aktor(r) as never), r).toBe(true);
    for (const r of ["admin", "panitera-pengganti", "panitera", "jurusita", "operator", "staf"]) {
      expect(bolehStatusIkrarBerat(aktor(r) as never), r).toBe(false);
    }
    expect(bolehStatusIkrarBerat(aktor("panitera-pengganti", ["hakim"]) as never)).toBe(false);
    expect(statusIkrarDiminta("2")).toBe(2);
    expect(statusIkrarDiminta(9)).toBe(0);
    expect(statusIkrarDiminta(undefined)).toBe(0);
  });

  it("rute sidang-putus memeriksa P7 SESUDAH hak tunda/putus dan meneruskan status + konfirmasi ke bot", async () => {
    const { readFileSync } = await import("node:fs");
    const rute = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/sidang-putus/route.ts"), "utf8");
    const a = rute.indexOf('pastikanAksi(db, actorUserId, "sidang.tunda-putus")');
    const b = rute.indexOf("pastikanBolehStatusIkrar(db, actorUserId, statusIkrar)");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(rute).toContain("statusIkrar: statusIkrar || undefined");
    expect(rute).toContain("konfirmasiStatus: badan.konfirmasiStatus === true");
  });
});

// ============================================================================
// T3: e-Doc per status + PDF bertanda tangan (P4a/P5b)
// ============================================================================
describe("e-Doc penetapan ikrar per status, PDF ber-TTD + cap", () => {
  type Edoc = {
    pilihBlangkoIkrar: (h: unknown, s?: unknown) => Baris;
    isiTanggalTitik: (rtf: string, t: string) => { rtf: string; diisi: boolean };
    buatLayanan: (deps: Baris) => { unggahPenetapanIkrar: (p: Baris) => Promise<Baris> };
  };
  const muatEdoc = () => {
    dbTiruan(() => []);
    return muatSegar<Edoc>("services/ikrarEdocService.js");
  };
  const RTF = "{\\rtf1\\ansi Penetapan Nomor 474/Pdt.G/2026/PA.Dgl Pada tanggal ............................\\par Ketua Majelis,\\par Fahri\\par}";
  function bangun(o: { baris?: Baris; pdf?: boolean; ttdSah?: boolean } = {}) {
    const catat: { tulis: Array<{ penuh: string; isi: Buffer }>; kueri: Kueri[]; bubuh: Baris[] } = { tulis: [], kueri: [], bubuh: [] };
    const baris = {
      jadwal_id: 500,
      perkara_id: 9988,
      tanggal: "2026-10-28",
      ikrar_talak: "Y",
      dihadiri_oleh: 2,
      ditunda: "T",
      alasan_ditunda: "Pemohon dan Termohon rukun kembali",
      keterangan: "Rukun Kembali, Ikrar Talak Tidak Dijatuhkan",
      nomor_perkara: "474/Pdt.G/2026/PA.Dgl",
      tanggal_daftar: "2026-07-14",
      ada_baris: 9988,
      status_ikrar: "3",
      amar: "x".repeat(80),
      tgl_ikrar: "2026-10-28",
      dok: null,
      ...(o.baris || {}),
    };
    const deps = {
      kueri: async (sql: string, params: unknown[]) => {
        catat.kueri.push({ sql, params });
        if (/^\s*SELECT j\.id/i.test(sql)) return [baris];
        if (/^\s*UPDATE perkara_ikrar_talak/i.test(sql)) return { affectedRows: 1 };
        return [];
      },
      kolomAda: async () => true,
      kenaliDokumen: (b: Buffer) => (b.subarray(0, 5).toString("latin1").startsWith("{\\rtf") ? "rtf" : "lain"),
      isiBlangko: async (p: Baris) => ({ ok: true, kosong: [], rtfBase64: Buffer.from(RTF, "latin1").toString("base64"), dipakai: p }),
      ketuaMajelis: async () => ({ ok: true, username: "fahri", fullname: "Fahri" }),
      periksaAkar: () => ({ dapatDitulis: true, akar: "D:/Aplikasi/aleta/tmp/w114-akar-uji" }),
      tulisBerkas: async (penuh: string, isi: Buffer) => void catat.tulis.push({ penuh, isi }),
      pindahBerkas: async () => true,
      hapusBerkas: () => undefined,
      samakanPemilik: () => undefined,
      catatJejak: async () => true,
      sekarang: () => new Date("2026-10-28T03:00:00Z"),
      capWaktu: () => 1793000000,
      bubuhkan: async (p: Baris) => {
        catat.bubuh.push(p);
        return o.ttdSah === false
          ? { ok: true, rtf: p.rtf, tandaTangan: null, peringatan: [{ kode: "tanda_tangan_tidak_ditemukan" }] }
          : { ok: true, rtf: p.rtf, tandaTangan: { id: 3, namaPejabat: "Fahri" }, cap: { id: "c1" }, penandaTangan: { nama: "Fahri" }, peringatan: [] };
      },
      ttd: () => ({
        daftar: async () => ({ baris: [{ id: 3, namaPejabat: "Fahri" }] }),
        gambar: async () => ({ isi: Buffer.from([1]) }),
        bakuNama: (n: string) => n,
      }),
      rtfKePdf: async () => (o.pdf === false ? { ok: false, alasan: "soffice_mati" } : { ok: true, pdf: Buffer.from("%PDF-1.4 uji") }),
    };
    return { deps, catat };
  }

  it("blangko per status: 1 [90]/[90a], 2 [91] (Ketua), 3 [92]/[92a] (Ketua Majelis); rukun tanpa Pemohon ditolak", () => {
    const e = muatEdoc();
    expect(e.pilihBlangkoIkrar(1, 1).berkas).toContain("[90a]");
    expect(e.pilihBlangkoIkrar(2).berkas).toContain("[90]");
    expect(e.pilihBlangkoIkrar(4, 2)).toMatchObject({ berkas: expect.stringContaining("[91]"), penandatangan: "ketua" });
    expect(e.pilihBlangkoIkrar(2, 3)).toMatchObject({ berkas: expect.stringContaining("[92] [Ikrar Rukun]"), penandatangan: "ketua_majelis" });
    expect(e.pilihBlangkoIkrar(1, 3).berkas).toContain("[92a] [Ikrar Rukun]");
    expect(e.pilihBlangkoIkrar(3, 3).alasan).toBe("rukun_kembali_pemohon_tidak_hadir");
    expect(e.isiTanggalTitik("Pada tanggal .......... x", "28 Oktober 2026")).toEqual({ rtf: "Pada tanggal 28 Oktober 2026 x", diisi: true });
  });

  it("status 3 + TTD sah: PDF bertanda tangan + cap dari portal, nama berkas .pdf, blangko [92]", async () => {
    const e = muatEdoc();
    const { deps, catat } = bangun();
    const h = await e.buatLayanan(deps).unggahPenetapanIkrar({
      jadwalId: 500,
      statusIkrar: 3,
      kering: false,
      cap: { id: "c1", nama: "Cap", jenis: "png", isiBase64: Buffer.from("cap").toString("base64") },
    });
    expect(h.ok).toBe(true);
    expect(h.bentuk).toBe("pdf");
    expect(String(h.nama)).toMatch(/^PADgl_2026_PdtG_474_penetapan_ikrar_1793000000\.pdf$/);
    expect((h.blangko as Baris).berkas).toContain("[92]");
    expect(catat.tulis[0].isi.toString("latin1")).toContain("%PDF");
    expect(catat.bubuh[0]).toMatchObject({ jenis: "ikrar", atur: expect.objectContaining({ penandatangan: "ketua_majelis", pakaiCap: true }) });
    expect(((catat.bubuh[0].cap as Baris).isi as Buffer).toString()).toBe("cap");
    const ubah = catat.kueri.find((k) => /^UPDATE perkara_ikrar_talak/.test(k.sql))!;
    expect(String(ubah.params[0])).toMatch(/\.pdf$/);
  });

  it("TTD belum disahkan atau PDF gagal: RTF CADANGAN, sebabnya dilaporkan", async () => {
    const e = muatEdoc();
    for (const o of [{ ttdSah: false }, { pdf: false }]) {
      const { deps, catat } = bangun(o);
      const h = await e.buatLayanan(deps).unggahPenetapanIkrar({ jadwalId: 500, statusIkrar: 3, kering: false });
      expect(h.ok).toBe(true);
      expect(h.bentuk).toBe("rtf");
      expect(String(h.nama)).toMatch(/\.rtf$/);
      expect((h.peringatan as string[]).some((x) => x.startsWith("rtf_cadangan:"))).toBe(true);
      expect(catat.tulis[0].isi.toString("latin1").startsWith("{\\rtf")).toBe(true);
    }
  });

  it("status 2: [91] dengan 'Pada tanggal ......' diisi tanggal penetapan; form harus berstatus 2", async () => {
    const e = muatEdoc();
    const gugur = {
      dihadiri_oleh: 4,
      alasan_ditunda: "Pemohon tidak hadir, ikrar talak gugur",
      keterangan: "Ikrar Talak Gugur",
      status_ikrar: "2",
    };
    const { deps, catat } = bangun({ baris: gugur, ttdSah: false });
    const h = await e.buatLayanan(deps).unggahPenetapanIkrar({ jadwalId: 500, statusIkrar: 2, kering: false });
    expect(h.ok).toBe(true);
    expect((h.blangko as Baris).berkas).toContain("[91]");
    expect(catat.tulis[0].isi.toString("latin1")).toContain("Pada tanggal 28 Oktober 2026");
    expect(catat.bubuh[0].atur).toMatchObject({ penandatangan: "ketua" });

    // Form masih status 1 padahal diminta 2: ditolak, tidak ada berkas.
    const salah = bangun({ baris: { ...gugur, status_ikrar: "1" } });
    const t = await e.buatLayanan(salah.deps).unggahPenetapanIkrar({ jadwalId: 500, statusIkrar: 2, kering: false });
    expect(t.alasan).toBe("form_ikrar_belum_terisi");
    expect(salah.catat.tulis).toHaveLength(0);
  });

  it("tanpa status diminta (tombol Isi form ikrar): status form yang tercatat dipakai", async () => {
    const e = muatEdoc();
    const { deps } = bangun();
    const h = await e.buatLayanan(deps).unggahPenetapanIkrar({ jadwalId: 500, kering: true });
    expect(h).toMatchObject({ ok: true, kering: true, statusIkrar: 3 });
  });
});

// ============================================================================
// T3: paket ABT [92] Rukun Kembali + sidangKe e-Doc ikrar
// ============================================================================
describe("paket ABT blangko-ikrar-92-28okt", () => {
  it("dua blangko baru sesuai daftar-rtf (md5), amar = amar SIPP status 3, tanpa sisa teks ikrar diucapkan / kata aplikasi", async () => {
    const { readFileSync } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    const akar = path.resolve(process.cwd(), "../abt-paket/blangko-ikrar-92-28okt/paket-satker");
    const daftar = readFileSync(path.join(akar, "daftar-rtf.tsv"), "utf8").split("\n").filter((b) => b && !b.startsWith("#")).map((b) => b.split("\t"));
    expect(daftar.map((d) => d[1])).toEqual([
      "[92] [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf",
      "[92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf",
    ]);
    for (const [folder, berkas, md5] of daftar) {
      const isi = readFileSync(path.join(akar, "rtf", folder, berkas));
      expect(createHash("md5").update(isi).digest("hex"), berkas).toBe(md5);
      const teks = isi.toString("latin1");
      expect(teks).toContain("Mengabulkan permohonan #0046# untuk tidak menjatuhkan ikrar talak terhadap #0047#;");
      expect(teks).toContain("Menyatakan perkara Nomor #0001# tidak dapat dilanjutkan;");
      expect(teks).toContain("Memerintahkan Panitera #8008# untuk mencoret perkara Nomor #0001# dari register perkara;");
      for (const sisa of ["#9215#", "#9219#", "#9220#", "Bismillah", "putus karena perceraian"]) expect(teks, `${berkas} ${sisa}`).not.toContain(sisa);
      expect(teks).not.toMatch(/aleta/i);
    }
    expect(readFileSync(path.join(akar, "abt-blangko-ikrar-92-28okt-PRASYARAT.sql"), "utf8")).toMatch(/SELECT COUNT\(DISTINCT no_var\) FROM abt_variabel WHERE no_var IN \(([0-9]+,){26}[0-9]+\);/);
    expect(readFileSync(path.join(akar, "pasang-satker.sh"), "utf8")).toContain("HARAP='27'");
  });

  it("e-Doc ikrar mengisi blangko pada SIDANG IKRAR itu (sidangKe = urutan), bukan sidang pertama", async () => {
    const { readFileSync } = await import("node:fs");
    const sumber = readFileSync(path.join(akarBot, "services/ikrarEdocService.js"), "utf8");
    expect(sumber).toContain("j.keterangan, j.urutan,");
    expect(sumber).toContain("sidangKe: Number(r.urutan) || 0");
    expect(sumber).not.toContain("perkaraId: pid, sidangKe: 0 }");
  });
});

// ============================================================================
// T4: menu status di layar, pratinjau atas nama, laporan, hak
// ============================================================================
describe("layar Putus sidang ikrar (T4)", () => {
  it("pilihan status: 1 selalu; 3 bila peran boleh + Pemohon hadir; 2 bila peran boleh + Pemohon tidak hadir + sidang >= batas-14", async () => {
    const { pilihanStatusIkrar } = await import("@/lib/ikrar-talak");
    const dasar = { tanggalSidang: "2026-10-28", tanggalPenetapanSidangIkrar: "2026-04-30" }; // batas 2026-10-30
    expect(pilihanStatusIkrar({ ...dasar, bolehStatusBerat: false, dihadiriOleh: 4 }).status).toEqual([1]);
    expect(pilihanStatusIkrar({ ...dasar, bolehStatusBerat: true, dihadiriOleh: 2 }).status).toEqual([1, 3]);
    const gugur = pilihanStatusIkrar({ ...dasar, bolehStatusBerat: true, dihadiriOleh: 4 });
    expect(gugur).toEqual({ status: [1, 2], batas: "2026-10-30", awalGugur: "2026-10-16" });
    expect(pilihanStatusIkrar({ ...dasar, tanggalSidang: "2026-10-15", bolehStatusBerat: true, dihadiriOleh: 3 }).status).toEqual([1]);
    expect(pilihanStatusIkrar({ tanggalSidang: "2026-10-28", bolehStatusBerat: true, dihadiriOleh: 4 }).status).toEqual([1]);
  });

  it("teks hasil sidang per status sama persis di portal dan bot (cermin)", async () => {
    const { STATUS_IKRAR, ikrarTerlaksanaMenurutTeks } = await import("@/lib/ikrar-talak");
    dbTiruan(() => []);
    const bot = muatSegar<{ STATUS_IKRAR: Record<number, { nama: string; hasil: string }> }>("services/ikrarTalakService.js");
    for (const s of [1, 2, 3] as const) {
      expect(STATUS_IKRAR[s].hasil).toBe(bot.STATUS_IKRAR[s].hasil);
      expect(STATUS_IKRAR[s].nama).toBe(bot.STATUS_IKRAR[s].nama);
    }
    expect(ikrarTerlaksanaMenurutTeks(STATUS_IKRAR[2].hasil)).toBe(false);
    expect(ikrarTerlaksanaMenurutTeks(STATUS_IKRAR[3].hasil)).toBe(false);
  });

  it("baris jadwal sesudah tulis: status 1 = ikrar tercatat; status 2/3 = hasil sidangnya, BUKAN ikrar tercatat", async () => {
    const { terapkanHasilTulis } = await import("@/lib/jadwal-ringan");
    const awal = [{ sidangId: "500", alasanDitunda: "" }];
    const satu = terapkanHasilTulis(awal, "500", { jalan: "putus", tertulis: true, ikrarDilaksanakan: true, tanggalPutus: "2026-10-28" });
    expect(satu[0]).toMatchObject({ ikrarTercatat: true, sudahPutus: true });
    const tiga = terapkanHasilTulis(awal, "500", {
      jalan: "putus",
      tertulis: true,
      ikrarDilaksanakan: false,
      hasilSidangIkrar: "Pemohon dan Termohon rukun kembali",
      tanggalPutus: "2026-10-28",
    });
    expect(tiga[0]).toMatchObject({ alasanDitunda: "Pemohon dan Termohon rukun kembali", sudahPutus: true });
    expect((tiga[0] as Record<string, unknown>).ikrarTercatat).toBeUndefined();
  });

  it("layar: menu status, pratinjau atas nama PP ikrar + ketua majelis, laporan tiga baris; GET menyebut hak P7", async () => {
    const { readFileSync } = await import("node:fs");
    const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/hasil-sidang.tsx"), "utf8");
    expect(layar).toContain('data-status-ikrar=""');
    expect(layar).toContain("pilihanStatusIkrar({");
    expect(layar).toContain('data-pratinjau-ikrar=""');
    expect(layar).toContain("(ketua majelis ikrar)");
    expect(layar).toContain('data-laporan-ikrar=""');
    expect(layar).toContain("konfirmasiStatus: statusDipakai !== 1");
    expect(layar).not.toMatch(/bg-popover/);
    const get = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/sidang-tunda/route.ts"), "utf8");
    expect(get).toContain("bolehStatusIkrarBerat: bolehStatusIkrarBeratAktor");
    // Jadwal: status 2/3 tidak dihitung "ikrar tercatat" (bot).
    const jadwal = readFileSync(path.join(akarBot, "services/sippJadwalSidangService.js"), "utf8");
    expect(jadwal).toContain('if (["2", "3"].includes(String(b.statusIkrar ?? "").trim())) continue;');
  });
});
