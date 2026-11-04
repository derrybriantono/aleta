// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * SINKRON REKENING DAN BANK PEMBAYAR DARI e-COURT (4 Nov 2026)
 * ============================================================================
 *
 * Yang dijaga (SEMUA data REKAAN - bukan rekening, nama, atau perkara sungguhan):
 *   1. catatan cek per perkara: terbaca / tanpa rekening / e-Court tak mencatat / gagal;
 *   2. rekening DISANDIKAN di basis data bot, dibaca kembali utuh, perubahan terhitung "berubah";
 *   3. tanpa kunci penyandian rekening tidak disimpan sama sekali dan sebabnya tampil;
 *   4. pemilihan sasaran: belum dicek lebih dulu, lalu jatuh tempo; yang segar dilewati; batas laju;
 *   5. satu putaran sinkron: berhenti pada sesi habis dan gagal beruntun; tidak ada nomor rekening di log;
 *   6. argumen jembatan (--hanya-rekening) dan baris lama yang polos disandikan;
 *   7. rute portal: hanya Super Admin dan Admin; tanpa nomor rekening di jawaban maupun jejak audit.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const REKENING = "9900112233";
const REKENING_BARU = "7700445566";

type Baris = Record<string, unknown>;
const pembayaran = new Map<string, Baris>();
const cek = new Map<string, Baris>();
const putaran: Baris[] = [];

let jam = Date.UTC(2026, 10, 4, 3, 0, 0);

/** Tiruan basis data bot: hanya pernyataan yang dipakai layanan rekening. */
function pasangBasisData() {
  const botPath = require_.resolve(path.join(AKAR_BOT, "services/botDbService.js"));
  const asli = require_(path.join(AKAR_BOT, "services/botDbService.js"));
  require_.cache[botPath]!.exports = {
    ensureSchema: async () => true,
    addColumnIfMissing: async () => true,
    addIndexIfMissing: async () => true,
    toMysqlDate: asli.toMysqlDate,
    fromMysqlDate: asli.fromMysqlDate,
    getDbStatus: () => ({ ready: true }),
    query: async (sql: string, p: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (/^(CREATE|ALTER|SHOW)/i.test(s)) return [];
      if (/^INSERT INTO aleta_bot_ecourt_pembayaran/i.test(s)) {
        const [nomor, dari, sandi, atasNama, bank, , , panjar, status] = p as string[];
        const lama = pembayaran.get(nomor) ?? { nomor_perkara: nomor, diterima_dari: "", nomor_rekening: "", nomor_rekening_sandi: "", atas_nama: "", bank: "", status: "", panjar: null, skum_json: null };
        pembayaran.set(nomor, {
          ...lama,
          diterima_dari: dari || lama.diterima_dari,
          nomor_rekening: sandi ? "" : lama.nomor_rekening,
          nomor_rekening_sandi: sandi || lama.nomor_rekening_sandi,
          atas_nama: atasNama || lama.atas_nama,
          bank: bank || lama.bank,
          status: status || lama.status,
          panjar: panjar ?? lama.panjar,
        });
        return [];
      }
      if (/^SELECT diterima_dari, nomor_rekening, nomor_rekening_sandi, bank FROM aleta_bot_ecourt_pembayaran/i.test(s)) {
        const r = pembayaran.get(String(p[0]));
        return r ? [r] : [];
      }
      if (/^SELECT \* FROM aleta_bot_ecourt_pembayaran WHERE nomor_perkara IN/i.test(s)) {
        return (p as string[]).map((n) => pembayaran.get(n)).filter(Boolean);
      }
      if (/^SELECT nomor_perkara, nomor_rekening FROM aleta_bot_ecourt_pembayaran WHERE nomor_rekening <> ''/i.test(s)) {
        return [...pembayaran.values()].filter((r) => r.nomor_rekening).map((r) => ({ nomor_perkara: r.nomor_perkara, nomor_rekening: r.nomor_rekening }));
      }
      if (/^UPDATE aleta_bot_ecourt_pembayaran SET nomor_rekening_sandi/i.test(s)) {
        const r = pembayaran.get(String(p[1]));
        if (r) pembayaran.set(String(p[1]), { ...r, nomor_rekening_sandi: p[0], nomor_rekening: "" });
        return [];
      }
      if (/^INSERT INTO aleta_bot_ecourt_rekening_cek/i.test(s)) {
        const [nomor, hasil, sebab, dicek, ulang, berubahPada, , flag] = p as string[];
        const lama = cek.get(nomor);
        cek.set(nomor, {
          nomor_perkara: nomor,
          hasil,
          sebab,
          dicek_pada: dicek,
          ulang_pada: ulang,
          berubah_pada: Number(flag) === 1 ? dicek : (lama?.berubah_pada ?? berubahPada ?? null),
        });
        return [];
      }
      if (/^SELECT nomor_perkara, ulang_pada FROM aleta_bot_ecourt_rekening_cek/i.test(s)) {
        return (p as string[]).map((n) => cek.get(n)).filter(Boolean);
      }
      if (/^SELECT nomor_perkara, hasil, sebab, dicek_pada FROM aleta_bot_ecourt_rekening_cek/i.test(s)) {
        return (p as string[]).map((n) => cek.get(n)).filter(Boolean);
      }
      if (/^SELECT nomor_perkara, hasil FROM aleta_bot_ecourt_rekening_cek/i.test(s)) {
        return (p as string[]).map((n) => cek.get(n)).filter(Boolean);
      }
      if (/^SELECT hasil, COUNT\(\*\) AS n FROM aleta_bot_ecourt_rekening_cek GROUP BY hasil/i.test(s)) {
        const h = new Map<string, number>();
        for (const r of cek.values()) h.set(String(r.hasil), (h.get(String(r.hasil)) ?? 0) + 1);
        return [...h].map(([hasil, n]) => ({ hasil, n }));
      }
      if (/^SELECT sebab, COUNT\(\*\) AS n FROM aleta_bot_ecourt_rekening_cek WHERE hasil = 'gagal'/i.test(s)) {
        const h = new Map<string, number>();
        for (const r of cek.values()) if (r.hasil === "gagal") h.set(String(r.sebab), (h.get(String(r.sebab)) ?? 0) + 1);
        return [...h].map(([sebab, n]) => ({ sebab, n }));
      }
      if (/^SELECT MAX\(dicek_pada\) AS t FROM aleta_bot_ecourt_rekening_cek/i.test(s)) {
        const semua = [...cek.values()].map((r) => String(r.dicek_pada)).sort();
        return [{ t: semua[semua.length - 1] ?? null }];
      }
      if (/^SELECT \* FROM aleta_bot_ecourt_rekening_putaran ORDER BY id DESC/i.test(s)) return [...putaran].reverse().slice(0, 5);
      if (/^SELECT COUNT\(\*\) AS n, SUM/i.test(s)) {
        const semua = [...pembayaran.values()];
        return [{ n: semua.length, dengan_rekening: semua.filter((r) => r.nomor_rekening_sandi || r.nomor_rekening).length }];
      }
      if (/^INSERT INTO aleta_bot_ecourt_rekening_putaran/i.test(s)) {
        const [sumber, status, sebab, mulai, selesai, sasaran, terbaca, tanpa, tidakAda, gagal, berubah] = p as unknown[];
        putaran.push({ sumber, status, sebab, dimulai_pada: mulai, selesai_pada: selesai, sasaran, terbaca, tanpa_rekening: tanpa, tidak_ada: tidakAda, gagal, berubah });
        return [];
      }
      return [];
    },
  };
}

type Layanan = {
  aturAlat: (a: Record<string, unknown>) => void;
  lupakan: () => void;
  catatBaca: (n: string, o: Record<string, unknown>) => Promise<{ hasil: string; berubah: boolean; baru: boolean }>;
  catatGagal: (n: string, s: string) => Promise<void>;
  bacaCek: (n: string[]) => Promise<Record<string, { hasil: string; sebab: string; dicekPada: string }>>;
  pilihSasaran: (u: string[], m: number) => Promise<{ sasaran: string[]; belum: number; jatuhTempo: number; segar: number }>;
  sinkronkan: (o: Record<string, unknown>) => Promise<Record<string, unknown> & { status: string; sebab: string; terbaca: number; gagal: number }>;
  ringkasStatus: (o: { nomorCakupan: string[] | null }) => Promise<Record<string, any>>;
  sandikanBarisLama: () => Promise<{ disandikan: number }>;
  jedaUlangMs: (h: string, s?: string) => number;
};
type Toko = { bacaPembayaranEcourt: (n: string[]) => Promise<Record<string, { nomorRekening: string; bank: string }>> };

let rek: Layanan;
let toko: Toko;
let kunciAda = true;

function muat() {
  for (const berkas of ["ecourtRekeningService.js", "ecourtStoreService.js"]) {
    delete require_.cache[require_.resolve(path.join(AKAR_BOT, "services", berkas))];
  }
  rek = require_(path.join(AKAR_BOT, "services/ecourtRekeningService.js"));
  toko = require_(path.join(AKAR_BOT, "services/ecourtStoreService.js"));
  rek.lupakan();
  rek.aturAlat({
    sekarang: () => jam,
    tidur: async () => undefined,
    kredensial: () => ({
      sandikan: (t: string) => {
        if (!kunciAda) throw new Error("kunci_tidak_tersedia");
        return `AAA.${Buffer.from(String(t)).toString("base64")}.ZZZ`;
      },
      bukaSandi: (t: string) => {
        const b = String(t).split(".");
        return b.length === 3 ? Buffer.from(b[1], "base64").toString("utf8") : "";
      },
    }),
  });
}

const bayar = (rekening = REKENING, bank = "BNI") => ({
  diterimaDari: "Budi Santoso",
  nomorRekening: rekening,
  atasNama: "Budi Santoso",
  bank,
  nomorPendaftaranOnline: "PA.DGL-0001",
  nomorPembayaran: "123",
  panjar: 355000,
  status: "Sudah Dibayar",
  tanggal: "2026-11-01",
  jam: "09:10",
});

beforeEach(() => {
  pembayaran.clear();
  cek.clear();
  putaran.length = 0;
  jam = Date.UTC(2026, 10, 4, 3, 0, 0);
  kunciAda = true;
  pasangBasisData();
  muat();
});

describe("1-3. catatan cek, penyandian, perubahan", () => {
  it("rekening terbaca: tersimpan TERSANDI, dibaca utuh, cek 'terbaca'", async () => {
    const h = await rek.catatBaca("101/Pdt.G/2026/PA.Dgl", { pembayaran: bayar(), skum: null });
    expect(h).toMatchObject({ hasil: "terbaca", berubah: false, baru: true });
    const mentah = pembayaran.get("101/Pdt.G/2026/PA.Dgl")!;
    expect(JSON.stringify(mentah)).not.toContain(REKENING);
    expect(mentah.nomor_rekening).toBe("");
    const dibaca = await toko.bacaPembayaranEcourt(["101/Pdt.G/2026/PA.Dgl"]);
    expect(dibaca["101/Pdt.G/2026/PA.Dgl"].nomorRekening).toBe(REKENING);
    expect(dibaca["101/Pdt.G/2026/PA.Dgl"].bank).toBe("BNI");
    const c = await rek.bacaCek(["101/Pdt.G/2026/PA.Dgl"]);
    expect(c["101/Pdt.G/2026/PA.Dgl"].hasil).toBe("terbaca");
    expect(c["101/Pdt.G/2026/PA.Dgl"].dicekPada).toMatch(/^2026-11-04T03:00:00/);
  });

  it("rekening berubah di e-Court ikut diperbarui dan terhitung 'berubah'; yang sama tidak", async () => {
    const n = "102/Pdt.G/2026/PA.Dgl";
    await rek.catatBaca(n, { pembayaran: bayar() });
    expect((await rek.catatBaca(n, { pembayaran: bayar() })).berubah).toBe(false);
    const h = await rek.catatBaca(n, { pembayaran: bayar(REKENING_BARU, "BRI") });
    expect(h.berubah).toBe(true);
    const dibaca = await toko.bacaPembayaranEcourt([n]);
    expect(dibaca[n]).toMatchObject({ nomorRekening: REKENING_BARU, bank: "BRI" });
  });

  it("kunjungan tanpa rekening tidak menghapus rekening yang sudah terbaca", async () => {
    const n = "103/Pdt.G/2026/PA.Dgl";
    await rek.catatBaca(n, { pembayaran: bayar() });
    await rek.catatBaca(n, { pembayaran: { ...bayar(""), bank: "" } });
    expect((await toko.bacaPembayaranEcourt([n]))[n].nomorRekening).toBe(REKENING);
    expect((await rek.bacaCek([n]))[n].hasil).toBe("tanpa_rekening");
  });

  it("halaman tanpa bagian pembayaran = 'tidak_ada' (bukan belum dicek), tanpa baris pembayaran", async () => {
    const n = "104/Pdt.G/2026/PA.Dgl";
    expect((await rek.catatBaca(n, { pembayaran: null, skum: null })).hasil).toBe("tidak_ada");
    expect(pembayaran.has(n)).toBe(false);
    expect((await rek.bacaCek([n]))[n].hasil).toBe("tidak_ada");
  });

  it("tanpa kunci penyandian rekening TIDAK disimpan polos; hasil gagal dengan sebab yang jelas", async () => {
    kunciAda = false;
    const n = "105/Pdt.G/2026/PA.Dgl";
    const h = await rek.catatBaca(n, { pembayaran: bayar() });
    expect(h.hasil).toBe("gagal");
    expect(JSON.stringify(pembayaran.get(n) ?? {})).not.toContain(REKENING);
    expect((await rek.bacaCek([n]))[n].sebab).toBe("kunci_penyandian_tidak_tersedia");
    expect((await toko.bacaPembayaranEcourt([n]))[n].nomorRekening).toBe("");
  });

  it("baris lama yang polos disandikan sekali, nilainya tetap terbaca", async () => {
    const n = "106/Pdt.G/2026/PA.Dgl";
    pembayaran.set(n, { nomor_perkara: n, diterima_dari: "Siti Aminah", nomor_rekening: REKENING, nomor_rekening_sandi: "", bank: "BNI", atas_nama: "", status: "", panjar: null, skum_json: null });
    expect((await toko.bacaPembayaranEcourt([n]))[n].nomorRekening).toBe(REKENING);
    expect((await rek.sandikanBarisLama()).disandikan).toBe(1);
    expect(pembayaran.get(n)!.nomor_rekening).toBe("");
    expect(JSON.stringify(pembayaran.get(n))).not.toContain(REKENING);
    expect((await toko.bacaPembayaranEcourt([n]))[n].nomorRekening).toBe(REKENING);
  });
});

describe("4. pemilihan sasaran dan batas laju", () => {
  it("belum dicek lebih dulu, lalu jatuh tempo; yang segar dilewati; dipotong batas", async () => {
    const daftar = ["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl", "4/Pdt.G/2026/PA.Dgl", "5/Pdt.G/2026/PA.Dgl"];
    await rek.catatBaca(daftar[0], { pembayaran: bayar() }); // terbaca final: ulang 14 hari
    await rek.catatGagal(daftar[1], "galat_peramban"); // ulang 6 jam
    jam += 7 * 3600 * 1000; // 7 jam kemudian: yang gagal jatuh tempo, yang terbaca masih segar
    const p = await rek.pilihSasaran(daftar, 10);
    expect(p.sasaran).toEqual([daftar[2], daftar[3], daftar[4], daftar[1]]);
    expect(p).toMatchObject({ belum: 3, jatuhTempo: 1, segar: 1 });
    expect((await rek.pilihSasaran(daftar, 2)).sasaran).toEqual([daftar[2], daftar[3]]);
  });

  it("selang ulang: gagal 6 jam, tak ada 2 hari, tak ketemu 3 hari, tanpa rekening 7 hari, terbaca final 14 hari, belum final 2 hari", () => {
    const j = 3600 * 1000;
    expect(rek.jedaUlangMs("gagal")).toBe(6 * j);
    expect(rek.jedaUlangMs("tidak_ada")).toBe(48 * j);
    expect(rek.jedaUlangMs("tidak_ketemu")).toBe(72 * j);
    expect(rek.jedaUlangMs("tanpa_rekening")).toBe(168 * j);
    expect(rek.jedaUlangMs("terbaca", "Sudah Dibayar")).toBe(14 * 24 * j);
    expect(rek.jedaUlangMs("terbaca", "Belum Dibayar")).toBe(48 * j);
  });
});

describe("5. satu putaran sinkron", () => {
  const acuan = (jumlah: number) => {
    const perkara = new Map<string, Record<string, string>>();
    const petaAlamat = new Map<string, string>();
    for (let i = 1; i <= jumlah; i += 1) {
      perkara.set(`k${i}`, { nomorPerkara: `${i}/Pdt.G/2026/PA.Dgl`, nomorRegister: `REG${i}` });
      if (i !== 3) petaAlamat.set(`REG${i}`, `https://ecourt.test/perkara/${i}`);
    }
    return { aktif: true, perkara, petaAlamat };
  };

  it("membaca sasaran, mencatat hitungan, tanpa nomor rekening di log maupun di catatan putaran", async () => {
    const log: string[] = [];
    const hasil = await rek.sinkronkan({
      acuan: acuan(4),
      maks: 10,
      log: (t: string) => log.push(t),
      bacaSatu: async (url: string) => ({ status: "ok", detail: { nomorPerkara: url, pembayaran: url.endsWith("/2") ? null : bayar(), skum: null } }),
    });
    expect(hasil).toMatchObject({ status: "selesai", terbaca: 2, tidakAda: 1, gagal: 0 });
    expect(hasil.sasaran).toBe(3);
    // Perkara tanpa alamat di daftar e-Court dicatat 'tidak_ketemu' sekali, bukan dibiarkan 'belum dicek'.
    expect((await rek.bacaCek(["3/Pdt.G/2026/PA.Dgl"]))["3/Pdt.G/2026/PA.Dgl"].hasil).toBe("tidak_ketemu");
    expect(putaran).toHaveLength(1);
    expect(JSON.stringify([log, putaran])).not.toContain(REKENING);
  });

  it("batas laju: tidak lebih dari 'maks' perkara per putaran", async () => {
    let dibuka = 0;
    await rek.sinkronkan({
      acuan: acuan(8),
      maks: 3,
      bacaSatu: async (url: string) => {
        dibuka += 1;
        return { status: "ok", detail: { nomorPerkara: url, pembayaran: bayar(), skum: null } };
      },
    });
    expect(dibuka).toBe(3);
  });

  it("sesi habis: berhenti seketika dan dikatakan, bukan diam", async () => {
    let dibuka = 0;
    const hasil = await rek.sinkronkan({
      acuan: acuan(6),
      maks: 10,
      bacaSatu: async () => {
        dibuka += 1;
        return dibuka === 2 ? { status: "sesi_habis" } : { status: "ok", detail: { nomorPerkara: "x", pembayaran: bayar(), skum: null } };
      },
    });
    expect(hasil.status).toBe("sesi_habis");
    expect(dibuka).toBe(2);
    expect(putaran[0]).toMatchObject({ status: "sesi_habis", terbaca: 1 });
  });

  it("lima gagal beruntun menghentikan putaran (tidak menghantam e-Court terus) dan sebabnya tercatat per perkara", async () => {
    let dibuka = 0;
    const hasil = await rek.sinkronkan({
      acuan: acuan(12),
      maks: 12,
      bacaSatu: async () => {
        dibuka += 1;
        return { status: "gagal", sebab: "galat_peramban: waktu habis" };
      },
    });
    expect(dibuka).toBe(5);
    expect(hasil).toMatchObject({ status: "dihentikan", sebab: "gagal_beruntun", gagal: 5 });
    const status = await rek.ringkasStatus({ nomorCakupan: null });
    expect(status.jumlah.gagal).toBe(5);
    expect(status.sebabGagal[0]).toMatchObject({ jumlah: 5 });
  });

  it("daftar e-Court tidak terbaca = gagal dengan sebab, bukan selesai kosong", async () => {
    const a = acuan(3);
    a.petaAlamat.clear();
    const hasil = await rek.sinkronkan({ acuan: a, bacaSatu: async () => ({ status: "ok" }) });
    expect(hasil).toMatchObject({ status: "gagal", sebab: "daftar_perkara_ecourt_tidak_terbaca" });
  });

  it("ringkasan status: cakupan terhadap daftar SIPP, tanpa nomor rekening", async () => {
    await rek.catatBaca("1/Pdt.G/2026/PA.Dgl", { pembayaran: bayar() });
    await rek.catatBaca("2/Pdt.G/2026/PA.Dgl", { pembayaran: null });
    const s = await rek.ringkasStatus({ nomorCakupan: ["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"] });
    expect(s.cakupan).toEqual({ total: 3, sudahDicek: 2, belumDicek: 1, denganRekening: 1 });
    expect(s.tersimpan).toEqual({ perkara: 1, denganRekening: 1 });
    expect(s.terakhirCek).toMatch(/^2026-11-04T03:00:00/);
    expect(JSON.stringify(s)).not.toContain(REKENING);
  });
});

describe("6. jembatan e-Court dan penjadwal", () => {
  it("--hanya-rekening dikenali jembatan; argumen proses tanpa --perkara dan --maks-perkara", () => {
    const run = require_(path.join(AKAR_BOT, "tools/ecourt-bridge/run.js"));
    expect(run.parseArgs(["--terjadwal", "--hanya-rekening", "--tanpa-unduh"])).toMatchObject({ hanyaRekening: true, tanpaUnduh: true, terjadwal: true });
    expect(run.parseArgs(["--terjadwal"]).hanyaRekening).toBe(false);
    const penjadwal = require_(path.join(AKAR_BOT, "services/ecourtSchedulerService.js"));
    const a = penjadwal.susunArgumenJembatan({ hanyaRekening: true, tanpaUnduh: true, slotAkun: "utama", nomorPerkara: "x", batas: 25 }).slice(1);
    expect(a).toEqual(["--terjadwal", "--akun", "utama", "--tanpa-unduh", "--hanya-rekening"]);
    // Putaran biasa tidak berubah.
    expect(penjadwal.susunArgumenJembatan({ batas: 25 }).slice(1)).toEqual(["--terjadwal", "--maks-perkara", "25"]);
    expect(penjadwal.susunArgumenJembatan({ nomorPerkara: "7/Pdt.G/2026/PA.Dgl" }).slice(1)).toEqual(["--terjadwal", "--perkara", "7/Pdt.G/2026/PA.Dgl"]);
  });

  it("sinkron otomatis dapat dimatikan dengan ALETA_ECOURT_REKENING_OTOMATIS=0", () => {
    const awal = process.env.ALETA_ECOURT_REKENING_OTOMATIS;
    try {
      delete process.env.ALETA_ECOURT_REKENING_OTOMATIS;
      expect((rek as unknown as { otomatisAktif: () => boolean }).otomatisAktif()).toBe(true);
      process.env.ALETA_ECOURT_REKENING_OTOMATIS = "0";
      expect((rek as unknown as { otomatisAktif: () => boolean }).otomatisAktif()).toBe(false);
    } finally {
      if (awal === undefined) delete process.env.ALETA_ECOURT_REKENING_OTOMATIS;
      else process.env.ALETA_ECOURT_REKENING_OTOMATIS = awal;
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Rute portal
// ---------------------------------------------------------------------------
const ruteKeadaan = vi.hoisted(() => ({
  admin: true,
  mulaiHasil: { ok: true, data: { ok: true } } as { ok: boolean; data?: Record<string, unknown>; error?: string },
  audit: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryOne: async () => null, queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, entri: Record<string, unknown>) => {
    ruteKeadaan.audit.push(entri);
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => ({ id: "usr_uji", name: "Petugas Uji", role: ruteKeadaan.admin ? "admin" : "panitera" }),
}));
vi.mock("@/lib/permissions", () => ({ isPrivilegedAdmin: (a: { role?: string }) => a.role === "admin" || a.role === "super_admin" }));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayRekeningStatus: async () => ({
    ok: true,
    data: {
      ok: true,
      status: { otomatis: true, perPutaran: 30, maksManual: 120, terakhirCek: "", jumlah: {}, sebabGagal: [], tersimpan: { perkara: 0, denganRekening: 0 }, cakupan: null, putaranTerakhir: [] },
      penjadwal: { aktif: true, sedangJalan: false, sedangSinkronRekening: false, sumber: "", dalamJamKerja: true, berikutnya: null, terakhirKode: null, terakhirCatatan: "", adaPenarikanLain: false },
    },
  }),
  mulaiGatewayRekeningSinkron: async () => ruteKeadaan.mulaiHasil,
}));

describe("7. rute rekening-sinkron: hanya Super Admin dan Admin", () => {
  afterEach(() => {
    ruteKeadaan.audit.length = 0;
    ruteKeadaan.admin = true;
    ruteKeadaan.mulaiHasil = { ok: true, data: { ok: true } };
  });

  it("admin: GET keadaan dan POST memulai; jejak audit hanya berisi alasan, tanpa rekening", async () => {
    const { GET, POST } = await import("@/app/api/aleta-ecourt/rekening-sinkron/route");
    const g = await GET(new NextRequest("http://localhost/api/aleta-ecourt/rekening-sinkron"));
    expect(g.status).toBe(200);
    expect(((await g.json()) as { data: { available: boolean } }).data.available).toBe(true);
    const p = await POST(new NextRequest("http://localhost/api/aleta-ecourt/rekening-sinkron", { method: "POST", body: "{}" }));
    const isi = (await p.json()) as { data: { ok: boolean; message: string } };
    expect(isi.data.ok).toBe(true);
    expect(isi.data.message).toContain("Sinkron rekening dimulai");
    expect(ruteKeadaan.audit[0]).toMatchObject({ action: "ECOURT_REKENING_SINKRON_DIMULAI" });
    expect(JSON.stringify(ruteKeadaan.audit)).not.toMatch(/\d{8,}/);
  });

  it("penarikan lain berjalan: sebabnya disampaikan dengan kalimat petugas, tercatat 'ditolak'", async () => {
    ruteKeadaan.mulaiHasil = { ok: true, data: { ok: false, alasan: "penarikan_sedang_berjalan" } };
    const { POST } = await import("@/app/api/aleta-ecourt/rekening-sinkron/route");
    const p = await POST(new NextRequest("http://localhost/api/aleta-ecourt/rekening-sinkron", { method: "POST", body: "{}" }));
    const isi = (await p.json()) as { data: { ok: boolean; message: string } };
    expect(isi.data.ok).toBe(false);
    expect(isi.data.message).toContain("Penarikan e-Court lain sedang berjalan");
    expect(isi.data.message).not.toContain("penarikan_sedang_berjalan");
    expect(ruteKeadaan.audit[0]).toMatchObject({ action: "ECOURT_REKENING_SINKRON_DITOLAK" });
  });

  it("peran lain (panitera) 403 pada GET dan POST; bot tidak dipanggil", async () => {
    ruteKeadaan.admin = false;
    const { GET, POST } = await import("@/app/api/aleta-ecourt/rekening-sinkron/route");
    expect((await GET(new NextRequest("http://localhost/api/aleta-ecourt/rekening-sinkron"))).status).toBe(403);
    expect((await POST(new NextRequest("http://localhost/api/aleta-ecourt/rekening-sinkron", { method: "POST", body: "{}" }))).status).toBe(403);
    expect(ruteKeadaan.audit).toHaveLength(0);
  });
});

describe("8. teks layar tanpa kode teknis", () => {
  it("sebab gagal dan status putaran diterjemahkan; kode tak dikenal tidak bocor", async () => {
    const { sebabRekeningTeks, statusPutaranTeks, sumberPutaranTeks } = await import("@/lib/rekening-sinkron");
    expect(sebabRekeningTeks("kunci_penyandian_tidak_tersedia")).toContain("kunci penyimpanan aman");
    expect(sebabRekeningTeks("galat_peramban: waktu habis")).toBe("halaman e-Court gagal dibuka");
    expect(sebabRekeningTeks("sesi e-Court habis")).toContain("masuk ulang");
    expect(sebabRekeningTeks("zzz_kode_baru")).not.toContain("zzz_kode_baru");
    expect(statusPutaranTeks("sesi_habis")).toBe("Sesi e-Court habis");
    expect(sumberPutaranTeks("portal-rekening")).toBe("Tombol Sinkron rekening");
    expect(sumberPutaranTeks("jadwal")).toContain("Otomatis");
  });

  it("keterangan rekening belum ada menurut hasil cek", async () => {
    const { keteranganRekeningBelumAda } = await import("@/lib/pembayaran-ecourt");
    expect(keteranganRekeningBelumAda(null)).toContain("dibaca otomatis");
    expect(keteranganRekeningBelumAda({ hasil: "tanpa_rekening", dicekPada: "" })).toContain("tidak mencatat nomor rekening");
    expect(keteranganRekeningBelumAda({ hasil: "gagal", dicekPada: "" })).toContain("dicoba lagi otomatis");
    expect(keteranganRekeningBelumAda(null, false)).toBe("rekening belum ada");
  });
});
