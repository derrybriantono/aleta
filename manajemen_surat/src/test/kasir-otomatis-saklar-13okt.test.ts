// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * KASIR OTOMATIS - SAKLAR HARI PUTUS (13 Okt 2026, butir 10) + RUPA KASIR (butir 3)
 * ============================================================================
 *
 *   MESIN       rencanaOtomatis atas perkara SUNGGUHAN satker (kasir-keadaan-
 *               nyata.json): verstek dan dicabut = baris yang ditulis kasir
 *               (jenis, jumlah, urutan, sisa panjar terakhir); butir yang
 *               dimatikan tidak ditulis dan menahan sisa panjar; yang yakinnya
 *               sedang dilewati beralasan.
 *   TULIS       jalankanPerkara atas SIPP tiruan di memori (tabel perkara_biaya
 *               + audit): saklar mati = nol tulisan; menyala = butir terpilih
 *               saja; dicabut = PNBP cabut; idempoten (jalan kedua dan baris
 *               yang ditambah tangan di sela itu tidak menggandakan); sisa
 *               panjar terakhir dan saldo habis.
 *   HAK         rute portal: panitera membaca (200, bolehUbah false), POST
 *               setelan/jalankan 403 tanpa memanggil bot; kasir boleh.
 *   EKSTENSI    bagian Kasir otomatis di jsdom: mati = tanpa POST; panitera =
 *               saklar mati kendalinya; menyala = jalan sendiri; tag peran
 *               "Kasir" (butir 3) terdaftar.
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const otomatis = requireBot(path.join(AKAR, "aleta_bot/services/kasirOtomatisService.js"));
const NYATA = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/kasir-keadaan-nyata.json"), "utf8"));

const salin = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const keadaan = (kunci: string) => salin(NYATA.contoh[kunci][0].keadaan);
const harap = (kunci: string) => NYATA.contoh[kunci][0].harap as Array<{ jenisBiayaId: number; jumlah: number }>;

type Baris = Record<string, any>;

// ============================================================================
// 1. MESIN - FUNGSI MURNI
// ============================================================================
describe("1. rencanaOtomatis - saringan atas mesin usulan yang sama", () => {
  it("bawaan: saklar MATI, seluruh butir terpilih; butir dikenal", () => {
    expect(otomatis.BUTIR_OTOMATIS.map((b: { kunci: string }) => b.kunci)).toEqual(["redaksi", "meterai", "pnbp-cabut", "pnbp-pbt", "biaya-pbt", "psp"]);
    expect(otomatis.butirSah(undefined)).toEqual(otomatis.BUTIR_BAWAAN);
    expect(otomatis.butirSah(["psp", "x", "redaksi"])).toEqual(["redaksi", "psp"]);
  });

  it("verstek: baris = yang ditulis kasir (157>152>29>389>151), sisa panjar terakhir menghabiskan saldo", () => {
    const k = keadaan("verstek");
    const r = otomatis.rencanaOtomatis(k, {});
    expect(r.putusHariIni).toBe(true);
    expect(r.kirim.map((u: Baris) => [u.jenisBiayaId, u.jumlah])).toEqual(harap("verstek").map((h) => [h.jenisBiayaId, h.jumlah]));
    expect(r.kirim[r.kirim.length - 1].jenisBiayaId).toBe(151);
    const saldo = r.kirim.reduce((s: number, u: Baris) => s - Number(u.jumlah), r.saldo);
    expect(saldo).toBe(0);
    expect(r.butir.find((b: Baris) => b.kunci === "pnbp-cabut").status).toBe("tidak-berlaku");
  });

  it("dicabut: Redaksi, Meterai, PNBP Surat Permohonan Pencabutan Perkara Rp10.000, lalu sisa panjar (pola hasil ukur)", () => {
    const r = otomatis.rencanaOtomatis(keadaan("cabut"), {});
    expect(r.kirim.map((u: Baris) => u.jenisBiayaId)).toEqual([157, 152, 404, 151]);
    const cabut = r.kirim.find((u: Baris) => u.jenisBiayaId === 404);
    expect(cabut).toMatchObject({ uraian: "PNBP Surat Permohonan Pencabutan Perkara", jumlah: 10000 });
    expect(r.kirim.map((u: Baris) => [u.jenisBiayaId, u.jumlah])).toEqual(harap("cabut").map((h) => [h.jenisBiayaId, h.jumlah]));
    expect(r.butir.find((b: Baris) => b.kunci === "pnbp-pbt").alasan).toMatch(/dicabut/);
  });

  it("butir terpilih saja: Redaksi + Meterai - sisa panjar DITAHAN karena biaya lain belum dijurnal", () => {
    const r = otomatis.rencanaOtomatis(keadaan("verstek"), { butir: ["redaksi", "meterai", "psp"] });
    expect(r.kirim.map((u: Baris) => u.jenisBiayaId)).toEqual([157, 152]);
    const psp = r.butir.find((b: Baris) => b.kunci === "psp");
    expect(psp.status).toBe("dilewati");
    expect(psp.baris[0].alasan).toMatch(/belum dijurnal/);
    expect(r.butir.find((b: Baris) => b.kunci === "biaya-pbt").baris[0].alasan).toBe("Butir ini dimatikan kasir.");
  });

  it("yakin sedang dilewati beralasan (gugur: PNBP PBT Penggugat), dan sisa panjar menunggunya", () => {
    const r = otomatis.rencanaOtomatis(keadaan("gugur"), {});
    expect(r.kirim.map((u: Baris) => u.jenisBiayaId)).toEqual([157, 152]);
    const pbt = r.butir.find((b: Baris) => b.kunci === "pnbp-pbt");
    expect(pbt.status).toBe("dilewati");
    expect(pbt.baris.find((x: Baris) => x.status === "dilewati").alasan).toMatch(/Yakin sedang/);
    expect(r.butir.find((b: Baris) => b.kunci === "psp").status).toBe("dilewati");
  });

  it("bukan putus hari ini / prodeo / saldo kurang: tidak ada yang dikirim", () => {
    const k = keadaan("verstek");
    expect(otomatis.rencanaOtomatis(k, { hari: "2026-09-30" }).kirim).toEqual([]);
    expect(otomatis.rencanaOtomatis({ ...keadaan("verstek"), pembiayaan: 2 }, {}).kirim).toEqual([]);
    const kurang = keadaan("verstek");
    kurang.jurnal = kurang.jurnal.map((b: Baris) => (b.jenisBiayaId === 1 ? { ...b, jumlah: Number(b.jumlah) - 120000 - 60000 } : b));
    const r = otomatis.rencanaOtomatis(kurang, {});
    expect(r.kirim).toEqual([]);
    expect(r.butir.find((b: Baris) => b.kunci === "redaksi").baris[0].alasan).toMatch(/Tambahan Panjar/);
  });

  it("jurnal yang sudah lengkap: semua butir 'sudah tercatat', tidak ada yang dikirim", () => {
    const k = keadaan("cabut");
    let id = 900000;
    for (const h of harap("cabut")) {
      k.jurnal.push({ id: (id += 1), jenisBiayaId: h.jenisBiayaId, jenisTransaksi: -1, jumlah: h.jumlah, tanggal: k.hariIni, pihakId: k.pihak[0].pihakId, pihakKe: 1, uraian: "x", urutan: 0, pembiayaan: 1 });
    }
    const r = otomatis.rencanaOtomatis(k, {});
    expect(r.kirim).toEqual([]);
    expect(r.butir.filter((b: Baris) => b.status === "sudah").map((b: Baris) => b.kunci)).toEqual(["redaksi", "meterai", "pnbp-cabut", "psp"]);
  });
});

// ============================================================================
// 2. TULIS ATAS SIPP TIRUAN
// ============================================================================
function sippTiruan(kunci: string) {
  const dasar = keadaan(kunci);
  const hari = dasar.hariIni;
  const biaya: Baris[] = salin(dasar.jurnal);
  const tulisan: Array<{ tabel: string; params: unknown[] }> = [];
  const KOLOM = kasir.KOLOM_BIAYA as string[];
  const keBaris = (b: Baris) => ({ ...b, tanggal: String(b.tanggal).slice(0, 10), jumlah: Number(b.jumlah) });
  const kueri = async (sql: string, params: any[] = []) => {
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: `${hari} 10:00:00`, hari }];
    if (/FROM sys_users WHERE username/.test(sql)) return params[0] === "kasir" ? [{ username: "kasir", fullname: "Kasir Satu", block: "0" }] : [];
    if (/COALESCE\(SUM\(jenis_transaksi \* jumlah\)/.test(sql)) return [{ saldo: biaya.reduce((s, b) => s + Number(b.jenisTransaksi) * Number(b.jumlah), 0) }];
    if (/COALESCE\(MAX\(id\), 0\) \+ 1/.test(sql)) return [{ maxid: Math.max(0, ...biaya.map((b) => Number(b.id))) + 1 }];
    if (/^SELECT id FROM perkara_biaya WHERE perkara_id/.test(sql.trim())) {
      const [, , jenis, pihak] = params;
      const ada = biaya.find((b) => Number(b.jenisBiayaId) === Number(jenis) && (params.length < 4 || Number(b.pihakId) === Number(pihak)) && (params.length < 5 || (b.tanggal === params[4] && Number(b.jumlah) === Number(params[5]) && b.uraian === params[6])));
      return ada ? [{ id: ada.id }] : [];
    }
    if (/^INSERT INTO perkara_biaya/.test(sql.trim())) {
      const n: Baris = Object.fromEntries(KOLOM.map((k, i) => [k, params[i]]));
      biaya.push({
        id: n.id,
        pembiayaan: n.id_pembiayaan,
        kategoriId: n.kategori_id,
        jenisBiayaId: n.jenis_biaya_id,
        pihakId: n.pihak_id,
        pihakKe: n.pihak_ke,
        urutan: n.urutan,
        jenisTransaksi: n.jenis_transaksi,
        tanggal: n.tanggal_transaksi,
        uraian: n.uraian,
        jumlah: n.jumlah,
        keterangan: n.keterangan,
        diinputOleh: n.diinput_oleh,
      });
      tulisan.push({ tabel: "perkara_biaya", params });
      return { affectedRows: 1 };
    }
    if (/^INSERT INTO sys_audittrail/.test(sql.trim())) {
      tulisan.push({ tabel: "sys_audittrail", params });
      return { affectedRows: 1 };
    }
    if (/^(DELETE FROM|REPLACE INTO) perkara_biaya_jurusita/.test(sql.trim())) return { affectedRows: 1 };
    if (/FROM perkara_biaya pb/.test(sql)) return biaya.map((b) => ({ ...b, diinputTanggal: "", namaPihak: "", jurusita: "" }));
    throw new Error(`kueri SIPP tak terduga: ${sql.slice(0, 80)}`);
  };
  // Keadaan yang dibaca = fixture + baris yang sudah tertulis (basi bila `basi`).
  let basi: Baris[] | null = null;
  const bacaKeadaan = async () => ({ ok: true, keadaan: { ...salin(dasar), jurnal: salin((basi || biaya).map(keBaris)) } });
  const jurnal = kasir.buatLayanan({ kueri, tabelAda: async () => true, jeda: async () => {}, bacaKeadaan });
  // Setelan di basis data ALETA bot tiruan.
  let setelan: Baris | null = null;
  const kueriAleta = async (sql: string, params: any[] = []) => {
    if (/CREATE TABLE IF NOT EXISTS/.test(sql)) return {};
    if (/^SELECT nyala/.test(sql.trim())) return setelan ? [setelan] : [];
    if (/^INSERT INTO aleta_bot_kasir_otomatis/.test(sql.trim())) {
      setelan = { nyala: params[0], butir: params[1], diubahOleh: params[2], diubah: `${hari} 09:00:00` };
      return {};
    }
    throw new Error(`kueri ALETA tak terduga: ${sql.slice(0, 60)}`);
  };
  const layanan = otomatis.buatLayanan({ jurnal: { ...jurnal, bacaKeadaan }, kueri, kueriAleta });
  return {
    layanan,
    biaya,
    tulisan,
    dasar,
    jalan: (tambahan: Baris = {}) =>
      layanan.jalankanPerkara({ perkaraId: dasar.perkara.perkaraId, akunSipp: "kasir", operator: "Kasir Satu", ip: "10.0.0.9", kering: false, ...tambahan }),
    basikan: () => (basi = salin(biaya)),
    segarkan: () => (basi = null),
  };
}

const jenisTertulis = (s: ReturnType<typeof sippTiruan>) => s.tulisan.filter((t) => t.tabel === "perkara_biaya").map((t) => Number(t.params[6]));

describe("2. jalankanPerkara - tulis ke SIPP (tiruan) atas akun petugas", () => {
  it("saklar MATI (bawaan, belum pernah disimpan): tidak ada satu pun tulisan", async () => {
    const s = sippTiruan("verstek");
    expect((await s.layanan.bacaSetelan()).nyala).toBe(false);
    const h = await s.jalan();
    expect(h).toMatchObject({ ok: false, alasan: "saklar_mati" });
    expect(s.tulisan).toEqual([]);
  });

  it("menyala, seluruh butir: verstek ditulis 157>152>29>389>151 atas akun kasir, sisa panjar terakhir, saldo habis, berjejak audit", async () => {
    const s = sippTiruan("verstek");
    await s.layanan.simpanSetelan({ nyala: true, operator: "Kasir Satu" });
    const h = await s.jalan();
    expect(h.ok).toBe(true);
    expect(jenisTertulis(s)).toEqual([157, 152, 29, 389, 151]);
    expect(s.tulisan.filter((t) => t.tabel === "sys_audittrail").length).toBe(5);
    expect(s.tulisan.filter((t) => t.tabel === "perkara_biaya").every((t) => t.params[16] === "kasir")).toBe(true);
    expect(s.biaya.reduce((x, b) => x + Number(b.jenisTransaksi) * Number(b.jumlah), 0)).toBe(0);
    expect(h.ringkas).toMatchObject({ tersimpan: 5, gagal: 0 });
  });

  it("idempoten: jalan kedua tidak menulis apa pun", async () => {
    const s = sippTiruan("verstek");
    await s.layanan.simpanSetelan({ nyala: true, operator: "Kasir Satu" });
    await s.jalan();
    const n = s.tulisan.length;
    const h2 = await s.jalan();
    expect(h2.kosong).toBe(true);
    expect(s.tulisan.length).toBe(n);
  });

  it("idempoten saat tulis: baris yang ditambah tangan di sela baca-tulis tidak digandakan, dan sisa panjar ditahan bila saldonya berubah", async () => {
    const s = sippTiruan("verstek");
    await s.layanan.simpanSetelan({ nyala: true, operator: "Kasir Satu" });
    s.basikan(); // keadaan yang dibaca = sebelum kasir menambah Redaksi di tab SIPP lain
    s.biaya.push({ id: 999999, pembiayaan: 1, kategoriId: 13, jenisBiayaId: 157, pihakId: 1, pihakKe: 1, urutan: 0, jenisTransaksi: -1, tanggal: s.dasar.hariIni, uraian: "Redaksi", jumlah: 15000, keterangan: "" });
    const h = await s.jalan();
    expect(jenisTertulis(s)).toEqual([152, 29, 389]);
    expect(s.biaya.filter((b) => b.jenisBiayaId === 157).length).toBe(1);
    const sisa = h.hasil[h.hasil.length - 1];
    expect(sisa.keadaan).toBe("dilewati");
    expect(sisa.pesan).toMatch(/saldo jurnal SIPP sekarang/);
  });

  it("menyala, butir Redaksi + Meterai saja: hanya dua baris itu, sisa panjar tidak ditulis", async () => {
    const s = sippTiruan("verstek");
    await s.layanan.simpanSetelan({ nyala: true, butir: ["redaksi", "meterai", "psp"], operator: "Kasir Satu" });
    await s.jalan();
    expect(jenisTertulis(s)).toEqual([157, 152]);
  });

  it("dicabut: PNBP Surat Permohonan Pencabutan Perkara ditulis sebelum sisa panjar", async () => {
    const s = sippTiruan("cabut");
    await s.layanan.simpanSetelan({ nyala: true, operator: "Kasir Satu" });
    await s.jalan();
    expect(jenisTertulis(s)).toEqual([157, 152, 404, 151]);
    const cabut = s.biaya.find((b) => b.jenisBiayaId === 404);
    expect(cabut).toMatchObject({ uraian: "PNBP Surat Permohonan Pencabutan Perkara", jumlah: 10000, tanggal: s.dasar.hariIni });
    expect(s.biaya.reduce((x, b) => x + Number(b.jenisTransaksi) * Number(b.jumlah), 0)).toBe(0);
  });

  it("mode kering (bawaan bila kering tidak disebut false): tanpa tulisan", async () => {
    const s = sippTiruan("verstek");
    await s.layanan.simpanSetelan({ nyala: true, operator: "Kasir Satu" });
    const h = await s.jalan({ kering: undefined });
    expect(h.kering).toBe(true);
    expect(s.tulisan).toEqual([]);
  });

  it("daftar hari itu: perkara putus beserta keadaan tiap butir (sudah/akan/dilewati), setelan ikut", async () => {
    const s = sippTiruan("verstek");
    const layanan = otomatis.buatLayanan({
      jurnal: { bacaKeadaan: async () => ({ ok: true, keadaan: keadaan("verstek") }) },
      kueri: async (sql: string) => {
        if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ hari: s.dasar.hariIni }];
        if (/FROM perkara_putusan WHERE tanggal_putusan/.test(sql)) return [{ perkaraId: s.dasar.perkara.perkaraId }];
        throw new Error(sql);
      },
      kueriAleta: async (sql: string) => (/^SELECT/.test(sql.trim()) ? [] : {}),
    });
    const d = await layanan.daftar("");
    expect(d.tanggal).toBe(s.dasar.hariIni);
    expect(d.setelan.nyala).toBe(false);
    expect(d.perkara.length).toBe(1);
    expect(d.perkara[0].butir.map((b: Baris) => [b.kunci, b.status])).toEqual([
      ["redaksi", "akan"],
      ["meterai", "akan"],
      ["pnbp-cabut", "tidak-berlaku"],
      ["pnbp-pbt", "akan"],
      ["biaya-pbt", "akan"],
      ["psp", "akan"],
    ]);
    expect(d.ringkas).toMatchObject({ perkara: 1, akanDiisi: 1, baris: 5 });
  });
});

// ============================================================================
// 3. HAK - RUTE PORTAL
// ============================================================================
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({ panggilBotJadwalSidang: vi.fn() }));
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-panitera";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const { panggilBotJadwalSidang } = await import("@/server/modules/aleta-ecourt/jadwal-sidang-gateway");
const bot = vi.mocked(panggilBotJadwalSidang);

describe("3. rute /kasir/otomatis: kasir menjalankan, panitera hanya melihat", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    bot.mockReset();
    bot.mockResolvedValue({ ok: true, data: { ok: true, tanggal: "2026-10-13", hariIni: "2026-10-13", setelan: { nyala: true, butir: [] }, perkara: [] } } as never);
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("panitera: GET 200 (bolehUbah false, pengawas true); POST setelan dan jalankan 403 tanpa memanggil bot", async () => {
    const { GET, POST } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    aktor = "usr-panitera";
    const baca = await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis?tanggal=2026-10-13"));
    expect(baca.status).toBe(200);
    const isi = (await baca.json()) as { data: Baris };
    expect(isi.data).toMatchObject({ bolehUbah: false, pengawas: true });
    bot.mockClear();
    for (const badan of [{ aksi: "setelan", nyala: true }, { aksi: "jalankan", perkaraId: "1", kering: false }]) {
      const r = await POST(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis", { method: "POST", body: JSON.stringify(badan) }));
      expect(r.status).toBe(403);
    }
    expect(bot).not.toHaveBeenCalled();
  });

  it("kasir/keuangan: POST setelan diteruskan ke bot dengan operator; aksi tak dikenal 400", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    aktor = "usr-analiskeu";
    const r = await POST(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis", { method: "POST", body: JSON.stringify({ aksi: "setelan", nyala: true, butir: ["redaksi"] }) }));
    expect(r.status).toBe(200);
    expect(bot).toHaveBeenCalledWith("/kasir/otomatis/setelan", expect.objectContaining({ method: "POST", body: expect.objectContaining({ nyala: true, butir: ["redaksi"] }) }));
    const salah = await POST(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis", { method: "POST", body: JSON.stringify({ aksi: "hapus" }) }));
    expect(salah.status).toBe(400);
  });

  it("hakim: GET pun ditolak 403", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/sidang/kasir/otomatis/route");
    aktor = "usr-hakim";
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/sidang/kasir/otomatis"));
    expect(r.status).toBe(403);
  });
});

// ============================================================================
// 4. EKSTENSI
// ============================================================================
const EKS = path.join(AKAR, "ekstensi-sipp");
const SUMBER = ["panel-alat.js", "basmassal.js"].map((b) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaHarian(p: { nyala: boolean; bolehUbah: boolean }) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru", modeKering: false };
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.199.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: {
      local: { get: async (k?: string | string[] | null) => Object.fromEntries((k == null ? Object.keys(simpanan) : [k].flat()).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const r = otomatis.rencanaOtomatis(keadaan("cabut"), {});
  const hari = keadaan("cabut").hariIni;
  const minta: Array<{ url: string; cara: string; badan: any }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi?.body ? JSON.parse(opsi.body) : null });
    if (/\/kasir\/otomatis\?tanggal=/.test(url)) {
      return Response.json({
        ok: true,
        data: {
          available: true,
          ok: true,
          tanggal: hari,
          hariIni: hari,
          bolehUbah: p.bolehUbah,
          pengawas: !p.bolehUbah,
          setelan: { nyala: p.nyala, butir: otomatis.BUTIR_BAWAAN, diubahOleh: "Kasir Satu", diubah: `${hari} 08:00:00` },
          butirDaftar: otomatis.BUTIR_OTOMATIS,
          perkara: [r],
          gagal: [],
          ringkas: { perkara: 1, akanDiisi: 1, baris: r.kirim.length },
          akun: p.bolehUbah ? { ok: true, username: "kasir" } : null,
        },
      });
    }
    if (/\/kasir\/otomatis$/.test(url) && cara === "POST") {
      return Response.json({ ok: true, data: { available: true, ok: true, ringkas: { tersimpan: 4 }, hasil: [], ditolak: [], dilewati: [] } });
    }
    if (/\/kasir\/pengingat/.test(url)) return Response.json({ ok: true, data: { available: true, ok: true, hariIni: hari, butir: [], ringkas: {} } });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false;`);
  return { w, minta, wadah: w.document.getElementById("wadah") as HTMLElement };
}

describe("4. ekstensi - bagian Kasir otomatis (basmassal.js)", () => {
  it("MATI: daftar butir per perkara tampil (akan diisi / tidak berlaku), tidak ada POST jalankan", async () => {
    const h = bukaHarian({ nyala: false, bolehUbah: true });
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    expect(await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" })).toBe(true);
    const bagian = await sampai(() => h.wadah.querySelector('details[data-kasir-bagian="otomatis"]'), "bagian otomatis");
    await sampai(() => bagian.querySelector('tr[data-butir="pnbp-cabut"]'), "baris butir");
    expect(bagian.querySelector('tr[data-butir="pnbp-cabut"]')!.getAttribute("data-status")).toBe("akan");
    expect(bagian.querySelector('tr[data-butir="pnbp-pbt"]')!.getAttribute("data-status")).toBe("tidak-berlaku");
    const saklar = bagian.querySelector(".aleta-kasir-saklar") as HTMLButtonElement;
    expect(saklar.getAttribute("aria-checked")).toBe("false");
    expect(saklar.disabled).toBe(false);
    await tunggu(30);
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
    // Menyalakan butuh dua tekanan; tekanan pertama tidak mengirim apa pun.
    saklar.click();
    await tunggu(10);
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
    saklar.click();
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST setelan");
    expect(h.minta.find((m) => m.cara === "POST")!.badan).toEqual({ aksi: "setelan", nyala: true });
  });

  it("panitera (bolehUbah false): saklar dan butir mati kendalinya, tanpa tombol jalankan, tanpa POST", async () => {
    const h = bukaHarian({ nyala: true, bolehUbah: false });
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" });
    const bagian = await sampai(() => h.wadah.querySelector('details[data-kasir-bagian="otomatis"]'), "bagian otomatis");
    await sampai(() => bagian.querySelector('tr[data-butir="redaksi"]'), "baris butir");
    expect((bagian.querySelector(".aleta-kasir-saklar") as HTMLButtonElement).disabled).toBe(true);
    expect(Array.from(bagian.querySelectorAll("input[data-butir]")).every((c) => (c as HTMLInputElement).disabled)).toBe(true);
    expect(bagian.textContent).toContain("Panitera hanya melihat");
    expect(Array.from(bagian.querySelectorAll("button")).some((b) => /Jalankan sekarang/.test(b.textContent || ""))).toBe(false);
    await tunggu(40);
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
  });

  it("MENYALA + kasir + hari ini: perkara yang punya baris 'akan diisi' ditulis sendiri (POST aksi jalankan)", async () => {
    const h = bukaHarian({ nyala: true, bolehUbah: true });
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" });
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST jalankan sendiri");
    const post = h.minta.filter((m) => m.cara === "POST");
    expect(post.length).toBe(1);
    expect(post[0].badan).toMatchObject({ aksi: "jalankan", perkaraId: String(keadaan("cabut").perkara.perkaraId), akunSipp: "kasir", kering: false });
    expect(JSON.stringify(post[0].badan)).not.toMatch(/aleta/i);
  });

  it("butir 3: bagian Kasir berkepala bulat seperti hakim/panitera - tag peran Kasir terdaftar, Kasir per perkara jadi bagian berkepala", () => {
    const konten = readFileSync(path.join(EKS, "konten.js"), "utf8");
    expect(konten).toMatch(/"kasir-harian": "Kasir"/);
    expect(konten).toMatch(/kasirPerkara: "Kasir"/);
    expect(konten).toMatch(/bagian\("Jurnal keuangan perkara", "kasirPerkara", false\)/);
    const css = readFileSync(path.join(EKS, "panel.css"), "utf8");
    expect(css).toMatch(/\.aleta-kasir-harian > details\.aleta-kasir-bagian \{[^}]*border-radius: 8px/);
  });
});
