/**
 * ============================================================================
 * ANTREAN JAM KERJA TULISAN SIPP (keputusan 104/106/108, 18 Okt 2026)
 * ============================================================================
 *
 * PERILAKU, bukan teks kode: jamKerjaService, antreanTulisSippService (dengan
 * basis data ALETA tiruan di memori), gerbang manual, Kasir otomatis yang
 * mengantrekan di luar jam kerja, dan jeda antarbaris kasir.
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
  "services/antreanTulisSippService.js",
  "services/kasirOtomatisService.js",
  "services/jamKerjaService.js",
  "services/hariLiburService.js",
];
function muat<T>(relatif: string): T {
  for (const r of SEGAR) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
  return require_(jalurBot(relatif)) as T;
}
afterEach(() => {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
  for (const r of SEGAR) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
});

type JamKerja = {
  hariKerja: (t: string, o?: { libur?: (t: string) => unknown }) => boolean;
  dalamJamKerja: (w: string, o?: { libur?: (t: string) => unknown }) => boolean;
  jamKerjaBerikutnya: (w: string, o?: { libur?: (t: string) => unknown }) => string;
  sebutWaktu: (w: string) => string;
  kalimatDiantrekan: (w: string) => string;
};

// ============================================================================
// Basis data ALETA tiruan - cukup untuk pernyataan antreanTulisSippService
// ============================================================================
type Baris = {
  id: number;
  kunci: string;
  jenis: string;
  muatan: string;
  keterangan: string;
  asal: string;
  dibuat: string;
  jadwal: string;
  status: string;
  percobaan: number;
  hasil: string | null;
};
function dbTiruan(simpan: Baris[] = []) {
  let urut = simpan.reduce((m, b) => Math.max(m, b.id), 0);
  return {
    baris: simpan,
    async query(sql: string, p: unknown[] = []) {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.startsWith("CREATE TABLE")) return [];
      if (s.startsWith("INSERT INTO aleta_bot_antrean_tulis_sipp")) {
        const ada = simpan.find((b) => b.kunci === p[0]);
        if (ada) return { affectedRows: 0, insertId: ada.id };
        urut += 1;
        simpan.push({
          id: urut,
          kunci: String(p[0]),
          jenis: String(p[1]),
          muatan: String(p[2]),
          keterangan: String(p[3]),
          asal: String(p[4]),
          dibuat: String(p[5]),
          jadwal: String(p[6]),
          status: "menunggu",
          percobaan: 0,
          hasil: null,
        });
        return { affectedRows: 1, insertId: urut };
      }
      if (s.startsWith("SELECT DATE_FORMAT(jadwal_satker")) {
        const b = simpan.find((x) => x.id === Number(p[0]));
        return b ? [{ jadwal: b.jadwal, status: b.status }] : [];
      }
      if (s.startsWith("SELECT id, kunci, jenis")) {
        return simpan
          .filter((b) => b.status === "menunggu" || b.status === "jalan")
          .map((b) => ({ id: b.id, kunci: b.kunci, jenis: b.jenis, keterangan: b.keterangan, asal: b.asal, status: b.status, percobaan: b.percobaan, jadwal: b.jadwal }));
      }
      if (s.includes("SET status = 'menunggu' WHERE status = 'jalan'")) {
        let n = 0;
        for (const b of simpan) if (b.status === "jalan") ((b.status = "menunggu"), (n += 1));
        return { affectedRows: n };
      }
      if (s.startsWith("SELECT id, jenis, muatan")) {
        const c = simpan
          .filter((b) => b.status === "menunggu" && b.jadwal <= String(p[0]))
          .sort((a, b) => a.jadwal.localeCompare(b.jadwal) || a.id - b.id)[0];
        return c ? [{ id: c.id, jenis: c.jenis, muatan: c.muatan }] : [];
      }
      if (s.includes("SET status = 'jalan'")) {
        const b = simpan.find((x) => x.id === Number(p[1]) && x.status === "menunggu");
        if (!b) return { affectedRows: 0 };
        b.status = "jalan";
        b.percobaan += 1;
        return { affectedRows: 1 };
      }
      if (s.startsWith("SELECT percobaan")) {
        const b = simpan.find((x) => x.id === Number(p[0]));
        return b ? [{ percobaan: b.percobaan }] : [];
      }
      if (s.includes("SET status = ?, selesai_satker")) {
        const b = simpan.find((x) => x.id === Number(p[5]));
        if (b) {
          b.status = String(p[0]);
          b.hasil = String(p[2]);
          if (p[3] === "menunggu") b.jadwal = String(p[4]);
        }
        return { affectedRows: b ? 1 : 0 };
      }
      throw new Error(`kueri tiruan tidak dikenal: ${s.slice(0, 80)}`);
    },
  };
}

type Antrean = {
  antrekan: (m: Record<string, unknown>) => Promise<{ ok: boolean; baru: boolean; dikerjakanPada: string; kalimat: string }>;
  kerjakanSatu: () => Promise<{ dikerjakan: boolean; sebab?: string; ok?: boolean; status?: string }>;
  pulihkan: () => Promise<number>;
  daftarkanPelaksana: (j: string, f: (m: Record<string, unknown>) => unknown) => void;
  gerbangManual: (m: Record<string, unknown>) => Promise<null | { status: number; body: Record<string, unknown> }>;
  jedaSesudah: (j: string) => number;
};
function antreanDengan(db: ReturnType<typeof dbTiruan>, jam: { kini: string }, opsi: Record<string, unknown> = {}) {
  const m = muat<{ buatLayanan: (o: Record<string, unknown>) => Antrean }>("services/antreanTulisSippService.js");
  return m.buatLayanan({ db, sekarang: () => jam.kini, aktif: () => true, ...opsi });
}

// ============================================================================
// 1. Jam kerja (WITA)
// ============================================================================
describe("jamKerjaService - jam kerja satker WITA", () => {
  const jk = () => muat<JamKerja>("services/jamKerjaService.js");
  const tanpaLibur = { libur: () => false };

  it("Selasa 03.00 -> Selasa 07.30; Selasa 10.00 tetap (sudah jam kerja)", () => {
    expect(jk().jamKerjaBerikutnya("2026-10-20 03:00:00", tanpaLibur)).toBe("2026-10-20 07:30:00");
    expect(jk().jamKerjaBerikutnya("2026-10-20 10:00:00", tanpaLibur)).toBe("2026-10-20 10:00:00");
  });

  it("Jumat 17.00 -> Senin 07.30; Jumat 16.15 masih jam kerja; Kamis 16.10 -> Jumat 07.30", () => {
    expect(jk().jamKerjaBerikutnya("2026-10-23 17:00:00", tanpaLibur)).toBe("2026-10-26 07:30:00");
    expect(jk().dalamJamKerja("2026-10-23 16:15:00", tanpaLibur)).toBe(true);
    expect(jk().dalamJamKerja("2026-10-22 16:15:00", tanpaLibur)).toBe(false);
    expect(jk().jamKerjaBerikutnya("2026-10-22 16:10:00", tanpaLibur)).toBe("2026-10-23 07:30:00");
  });

  it("hari libur dilewati (penyedia libur disuntikkan, bukan daftar kedua)", () => {
    const libur = (t: string) => t === "2026-10-26" || t === "2026-10-27";
    expect(jk().jamKerjaBerikutnya("2026-10-23 17:00:00", { libur })).toBe("2026-10-28 07:30:00");
    expect(jk().hariKerja("2026-10-26", { libur })).toBe(false);
    expect(jk().hariKerja("2026-10-24", { libur: () => false })).toBe(false); // Sabtu
  });

  it("kalimat awam tanpa kode", () => {
    expect(jk().kalimatDiantrekan("2026-10-26 07:42:00")).toBe(
      "Di luar jam kerja - diantrekan, dikerjakan Senin, 26 Oktober 2026 pukul 07.42 WITA."
    );
  });
});

// ============================================================================
// 2. Antrean: otomatis jam 03.00, tanggal peristiwa, tahan restart, tidak dobel
// ============================================================================
describe("antreanTulisSippService", () => {
  it("tulisan otomatis pukul 03.00 diantrekan dan baru dikerjakan pada jam kerja hari itu; muatannya utuh", async () => {
    const db = dbTiruan();
    const jam = { kini: "2026-10-20 03:00:00" };
    const a = antreanDengan(db, jam, { libur: () => false });
    const dikerjakan: Record<string, unknown>[] = [];
    a.daftarkanPelaksana("kasir-otomatis", (m) => (dikerjakan.push(m), { ok: true }));
    const muatan = { perkaraId: 10300, baris: [{ jenisBiayaId: 157, tanggal: "2026-10-19", jumlah: 10000 }] };
    const r = await a.antrekan({ jenis: "kasir-otomatis", kunci: "kasir-otomatis:10300:2026-10-19", muatan });
    expect(r.ok).toBe(true);
    expect(r.dikerjakanPada >= "2026-10-20 07:35:00" && r.dikerjakanPada <= "2026-10-20 08:15:00").toBe(true);
    expect(r.kalimat).toContain("Selasa, 20 Oktober 2026");

    expect((await a.kerjakanSatu()).sebab).toBe("di_luar_jam_kerja");
    jam.kini = "2026-10-20 07:31:00";
    expect((await a.kerjakanSatu()).dikerjakan).toBe(false); // belum jatuh tempo
    jam.kini = "2026-10-20 08:20:00";
    const h = await a.kerjakanSatu();
    expect(h).toMatchObject({ dikerjakan: true, ok: true, status: "selesai" });
    // Tanggal peristiwa (tanggal transaksi) TIDAK berubah.
    expect(dikerjakan).toEqual([muatan]);
  });

  it("Jumat 17.00 dikerjakan Senin; libur Senin dilewati ke Selasa", async () => {
    const jam = { kini: "2026-10-23 17:00:00" };
    const r1 = await antreanDengan(dbTiruan(), jam, { libur: () => false }).antrekan({ jenis: "x", kunci: "x:1", muatan: {} });
    expect(r1.dikerjakanPada.slice(0, 10)).toBe("2026-10-26");
    const r2 = await antreanDengan(dbTiruan(), jam, { libur: (t: string) => t === "2026-10-26" }).antrekan({ jenis: "x", kunci: "x:1", muatan: {} });
    expect(r2.dikerjakanPada.slice(0, 10)).toBe("2026-10-27");
  });

  it("tidak dobel: kunci yang sama sekali saja, termasuk sesudah restart di tengah pengerjaan", async () => {
    const db = dbTiruan();
    const jam = { kini: "2026-10-20 03:00:00" };
    const a = antreanDengan(db, jam, { libur: () => false });
    await a.antrekan({ jenis: "kasir-otomatis", kunci: "k:1", muatan: { n: 1 } });
    const lagi = await a.antrekan({ jenis: "kasir-otomatis", kunci: "k:1", muatan: { n: 1 } });
    expect(lagi.baru).toBe(false);
    expect(db.baris).toHaveLength(1);

    // Proses mati saat baris berstatus "jalan".
    db.baris[0].status = "jalan";
    jam.kini = "2026-10-20 09:00:00";
    const b = antreanDengan(db, jam, { libur: () => false });
    let kali = 0;
    b.daftarkanPelaksana("kasir-otomatis", () => ((kali += 1), { ok: true }));
    expect(await b.pulihkan()).toBe(1);
    expect((await b.kerjakanSatu()).dikerjakan).toBe(true);
    expect((await b.kerjakanSatu()).sebab).toBe("kosong");
    expect(kali).toBe(1);
    // Antrean ulang kunci yang sudah selesai tidak melahirkan baris baru.
    await b.antrekan({ jenis: "kasir-otomatis", kunci: "k:1", muatan: { n: 1 } });
    expect(db.baris).toHaveLength(1);
  });

  it("berurutan: dua baris jatuh tempo dikerjakan satu per satu; jeda Kasir 20-150 dtk", async () => {
    const db = dbTiruan();
    const jam = { kini: "2026-10-20 03:00:00" };
    const a = antreanDengan(db, jam, { libur: () => false });
    const urut: number[] = [];
    a.daftarkanPelaksana("kasir-otomatis", (m) => (urut.push(Number(m.n)), { ok: true }));
    await a.antrekan({ jenis: "kasir-otomatis", kunci: "a", muatan: { n: 1 } });
    await a.antrekan({ jenis: "kasir-otomatis", kunci: "b", muatan: { n: 2 } });
    jam.kini = "2026-10-20 09:00:00";
    await a.kerjakanSatu();
    expect(urut).toHaveLength(1);
    await a.kerjakanSatu();
    expect(urut.sort()).toEqual([1, 2]);
    for (let i = 0; i < 100; i += 1) {
      const ms = a.jedaSesudah("kasir-otomatis");
      expect(ms).toBeGreaterThanOrEqual(20_000);
      expect(ms).toBeLessThanOrEqual(150_000);
    }
  });

  it("pelaksana gagal: dicoba lagi 30 menit kemudian, berhenti 'gagal' sesudah 3 kali", async () => {
    const db = dbTiruan();
    const jam = { kini: "2026-10-20 09:00:00" };
    const a = antreanDengan(db, jam, { libur: () => false });
    a.daftarkanPelaksana("x", () => ({ ok: false, alasan: "sipp_menolak" }));
    await a.antrekan({ jenis: "x", kunci: "x", muatan: {} });
    db.baris[0].jadwal = "2026-10-20 08:00:00";
    expect((await a.kerjakanSatu()).status).toBe("menunggu");
    expect(db.baris[0].jadwal).toBe("2026-10-20 09:30:00");
    jam.kini = "2026-10-20 09:31:00";
    await a.kerjakanSatu();
    jam.kini = "2026-10-20 10:02:00";
    expect((await a.kerjakanSatu()).status).toBe("gagal");
  });
});

// ============================================================================
// 3. Tulisan MANUAL di luar jam kerja: peringatan + pilihan, tidak diblok diam-diam
// ============================================================================
describe("gerbang manual", () => {
  const dasar = { kering: false, tanyaJamKerja: true, jadwalId: 20400 };

  it("di luar jam kerja: ditanyakan, Antrekan bawaan + Tulis sekarang; kalimat awam menyebut harinya", async () => {
    const jam = { kini: "2026-10-23 19:00:00" };
    const g = await antreanDengan(dbTiruan(), jam, { libur: () => false }).gerbangManual({
      badan: dasar,
      jenis: "sidang-tunda",
      kunci: "sidang-tunda:20400",
      muatan: { badan: dasar },
    });
    expect(g?.status).toBe(200);
    expect(g?.body).toMatchObject({ ok: false, alasan: "di_luar_jam_kerja", kode: "di_luar_jam_kerja", perluPilihan: true });
    expect(g?.body.pilihan).toEqual([
      { nilai: "antrekan", label: "Antrekan", bawaan: true },
      { nilai: "sekarang", label: "Tulis sekarang" },
    ]);
    expect(String(g?.body.pesan)).toContain("Senin, 26 Oktober 2026 mulai pukul 07.30 WITA");
    expect(String(g?.body.pesan)).not.toMatch(/_/);
  });

  it("pilihan Antrekan: masuk antrean; Tulis sekarang / dalam jam kerja / mode kering / klien lama: lanjut menulis", async () => {
    const db = dbTiruan();
    const jam = { kini: "2026-10-23 19:00:00" };
    const a = antreanDengan(db, jam, { libur: () => false });
    const antre = await a.gerbangManual({ badan: { ...dasar, jamKerja: "antrekan" }, jenis: "sidang-tunda", kunci: "sidang-tunda:20400", muatan: { badan: dasar } });
    expect(antre?.body).toMatchObject({ ok: true, diantrekan: true });
    expect(db.baris).toHaveLength(1);
    expect(JSON.parse(db.baris[0].muatan)).toMatchObject({ badan: dasar, jamKerja: "sekarang" });
    expect(await a.gerbangManual({ badan: { ...dasar, jamKerja: "sekarang" }, jenis: "j", kunci: "k", muatan: {} })).toBeNull();
    expect(await a.gerbangManual({ badan: { kering: false }, jenis: "j", kunci: "k", muatan: {} })).toBeNull();
    expect(await a.gerbangManual({ badan: { ...dasar, kering: true }, jenis: "j", kunci: "k", muatan: {} })).toBeNull();
    jam.kini = "2026-10-23 10:00:00";
    expect(await a.gerbangManual({ badan: dasar, jenis: "j", kunci: "k", muatan: {} })).toBeNull();
  });

  it("manualJamKerja: rute dibungkus - pertanyaan dikirim, penangan aslinya tidak dipanggil", async () => {
    pasang("services/botDbService.js", dbTiruan());
    process.env.ALETA_ANTREAN_TULIS_SIPP_AKTIF = "1";
    try {
      const m = muat<{ manualJamKerja: (j: string, k: (b: Record<string, unknown>) => string, f: unknown) => (req: unknown, res: unknown) => Promise<void> }>(
        "services/antreanTulisSippService.js"
      );
      let dipanggil = 0;
      const bungkus = m.manualJamKerja("uji", (b) => String(b.jadwalId), async (_req: unknown, res: { json: (x: unknown) => void }) => {
        dipanggil += 1;
        res.json({ ok: true });
      });
      const jawab: { kode: number; isi: Record<string, unknown> | null } = { kode: 0, isi: null };
      const res = {
        status(n: number) {
          jawab.kode = n;
          return res;
        },
        json(x: Record<string, unknown>) {
          jawab.isi = x;
          return res;
        },
      };
      const jk = muat<JamKerja>("services/jamKerjaService.js");
      const malam = !jk.dalamJamKerja(require_(jalurBot("services/jamKerjaService.js")).sekarangSatker());
      await bungkus({ body: { ...dasar } }, res);
      if (malam) {
        expect(dipanggil).toBe(0);
        expect(jawab.isi).toMatchObject({ perluPilihan: true });
      } else {
        expect(dipanggil).toBe(1);
      }
    } finally {
      delete process.env.ALETA_ANTREAN_TULIS_SIPP_AKTIF;
    }
  });
});

// ============================================================================
// 4. Kasir otomatis di luar jam kerja: diantrekan, tanggal transaksi utuh
// ============================================================================
describe("Kasir otomatis di luar jam kerja", () => {
  it("pukul 21.00 tidak menulis - diantrekan dengan kunci per perkara per hari, baris apa adanya", async () => {
    pasang("db_config.js", { query: (_s: string, _p: unknown, cb: (g: unknown, h: unknown) => void) => cb(null, []) });
    const k = muat<{ buatLayanan: (d: Record<string, unknown>) => { jalankanPerkara: (m: Record<string, unknown>) => Promise<Record<string, unknown>> } }>(
      "services/kasirOtomatisService.js"
    );
    const diantrekan: Record<string, unknown>[] = [];
    let ditulis = 0;
    const layanan = k.buatLayanan({
      kueri: async () => [],
      kueriAleta: async (sql: string) => (/SELECT nyala/.test(sql) ? [{ nyala: 1, butir: "null" }] : []),
      jurnal: {
        bacaKeadaan: async () => ({ ok: true, keadaan: { hariIni: "2026-10-20" } }),
        susunRencana: async () => ((ditulis += 1), { ok: false }),
      },
      rencanaOtomatis: () => ({ putusHariIni: true, kirim: [{ jenisBiayaId: 157, tanggal: "2026-10-20", jumlah: 10000, uraian: "Redaksi" }] }),
      sekarang: () => "2026-10-20 21:00:00",
      antrean: {
        antrekan: async (m: Record<string, unknown>) => {
          diantrekan.push(m);
          return { ok: true, dikerjakanPada: "2026-10-21 07:44:00", kalimat: "Di luar jam kerja - diantrekan, dikerjakan Rabu, 21 Oktober 2026 pukul 07.44 WITA." };
        },
      },
    });
    const r = await layanan.jalankanPerkara({ perkaraId: 10300, operator: "uji", akunSipp: "kasir", kering: false });
    expect(r).toMatchObject({ ok: true, diantrekan: true, dikerjakanPada: "2026-10-21 07:44:00" });
    expect(String(r.pesan)).toContain("Rabu, 21 Oktober 2026");
    expect(ditulis).toBe(0);
    expect(diantrekan).toHaveLength(1);
    expect(diantrekan[0]).toMatchObject({ jenis: "kasir-otomatis", kunci: "kasir-otomatis:10300:2026-10-20" });
    const baris = (diantrekan[0].muatan as { baris: Array<Record<string, unknown>> }).baris;
    expect(baris[0]).toMatchObject({ tanggal: "2026-10-20" });
  });
});

// ============================================================================
// 5. Jeda antarbaris kasir dalam satu perkara (108)
// ============================================================================
describe("jeda antarbaris kasir (hitungBarisKasir)", () => {
  it("30% di bawah 1 dtk, 70% 5-25 dtk; median ~11 dtk", () => {
    const j = muat<{ hitungBarisKasir: (a: () => number) => number }>("services/jedaManusiaService.js");
    expect(j.hitungBarisKasir(() => 0)).toBe(0);
    expect(j.hitungBarisKasir(() => 0.29)).toBeLessThan(900);
    expect(j.hitungBarisKasir(() => 0.3)).toBe(5000);
    expect(j.hitungBarisKasir(() => 1)).toBe(25000);
    const tengah = j.hitungBarisKasir(() => 0.65);
    expect(tengah).toBeGreaterThan(10_000);
    expect(tengah).toBeLessThan(12_000);
  });
});

// ============================================================================
// Libur dari Pengaturan portal ikut menunda antrean (sambungan 1.205.9)
// ============================================================================
describe("libur Pengaturan portal dan antrean jam kerja", () => {
  it("tanggal libur tambahan dari Pengaturan dilewati antrean; tanpa tambahan hari itu hari kerja", async () => {
    const jam = { kini: "2026-10-23 17:00:00" }; // Jumat sore
    const a0 = antreanDengan(dbTiruan(), jam);
    const jk = require_(jalurBot("services/jamKerjaService.js")) as { sambungkanLiburPengaturan: () => void };
    const hl = require_(jalurBot("services/hariLiburService.js")) as {
      pasangTambahan: (d: unknown[], o?: { simpan?: boolean }) => number;
    };
    jk.sambungkanLiburPengaturan();
    hl.pasangTambahan([], { simpan: false });
    const r0 = await a0.antrekan({ jenis: "x", kunci: "x:libur0", muatan: {} });
    expect(r0.dikerjakanPada.slice(0, 10)).toBe("2026-10-26");

    // Super Admin menambah libur daerah Senin 26 Okt 2026 di Pengaturan.
    hl.pasangTambahan([{ tanggal: "2026-10-26", nama: "Libur daerah", jenis: "daerah", aksi: "tambah" }], { simpan: false });
    const r1 = await antreanDengan(dbTiruan(), jam).antrekan({ jenis: "x", kunci: "x:libur1", muatan: {} });
    expect(r1.dikerjakanPada.slice(0, 10)).toBe("2026-10-27");
    hl.pasangTambahan([], { simpan: false });
  });
});
