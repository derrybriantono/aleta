// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kunci penetapan per perkara (bot) dan "bongkar hanya atas perintah" (20 Okt
 * 2026, agen P1). Kunci diuji atas basis data ALETA tiruan yang meniru
 * semantik SQL-nya (PRIMARY KEY perkara_id, kedaluwarsa menurut jam tiruan).
 */
const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

function basisTiruan() {
  const baris = new Map<number, { token: string; pemilik: string; tujuan: string; sampai: number }>();
  const jam = { sekarang: 1_000_000 };
  const query = async (sql: string, p: unknown[] = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^CREATE TABLE/i.test(s)) return {};
    if (/^UPDATE .* SET sampai = DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL \? SECOND\) WHERE perkara_id = \? AND token = \? AND sampai >= UTC_TIMESTAMP\(\)/i.test(s)) {
      const [ttl, id, token] = p as [number, number, string];
      const b = baris.get(id);
      if (b && b.token === token && b.sampai >= jam.sekarang) {
        b.sampai = jam.sekarang + ttl;
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (/^DELETE FROM .* WHERE perkara_id = \? AND sampai < UTC_TIMESTAMP\(\)/i.test(s)) {
      const id = p[0] as number;
      const b = baris.get(id);
      if (b && b.sampai < jam.sekarang) baris.delete(id);
      return { affectedRows: 1 };
    }
    if (/^INSERT IGNORE INTO/i.test(s)) {
      const [id, token, pemilik, tujuan, ttl] = p as [number, string, string, string, number];
      if (baris.has(id)) return { affectedRows: 0 };
      baris.set(id, { token, pemilik, tujuan, sampai: jam.sekarang + ttl });
      return { affectedRows: 1 };
    }
    if (/^DELETE FROM .* WHERE perkara_id = \? AND token = \?/i.test(s)) {
      const [id, token] = p as [number, string];
      const b = baris.get(id);
      if (b && b.token === token) {
        baris.delete(id);
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (/^SELECT perkara_id, token/i.test(s)) {
      const b = baris.get(p[0] as number);
      return b ? [{ perkara_id: p[0], token: b.token, pemilik: b.pemilik, tujuan: b.tujuan, diambil: "x", sampai: `s${b.sampai}`, hidup: b.sampai >= jam.sekarang ? 1 : 0 }] : [];
    }
    throw new Error(`SQL tak dikenal: ${s.slice(0, 80)}`);
  };
  return { db: { query }, jam, baris };
}

const muatKunci = (db: unknown) => (require_(path.join(AKAR, "aleta_bot/services/penetapanKunciService.js")) as any).buatLayanan({ db });

describe("kunci penetapan per perkara", () => {
  let k: any;
  let t: ReturnType<typeof basisTiruan>;
  beforeEach(() => {
    t = basisTiruan();
    k = muatKunci(t.db);
  });

  it("yang pertama dapat, yang kedua ditolak dengan nama pemegangnya", async () => {
    const a = await k.ambil({ perkaraId: 10260, pemilik: "Derry", tujuan: "kerjakan" });
    const b = await k.ambil({ perkaraId: 10260, pemilik: "Tab kedua", tujuan: "kerjakan" });
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: false, alasan: "sedang_dikerjakan", oleh: "Derry" });
  });

  it("perkara lain tidak terhalang", async () => {
    await k.ambil({ perkaraId: 1, pemilik: "A" });
    expect((await k.ambil({ perkaraId: 2, pemilik: "B" })).ok).toBe(true);
  });

  it("empat pengambil bersamaan: tepat satu menang", async () => {
    const hasil = await Promise.all([1, 2, 3, 4].map((n) => k.ambil({ perkaraId: 5, pemilik: `P${n}` })));
    expect(hasil.filter((x: any) => x.ok)).toHaveLength(1);
  });

  it("token pemegang memperpanjang (tidak ditolak oleh dirinya sendiri); token asing tidak", async () => {
    const a = await k.ambil({ perkaraId: 7, pemilik: "A", ttlDetik: 30 });
    const lagi = await k.ambil({ perkaraId: 7, pemilik: "A", tokenLama: a.token, ttlDetik: 30 });
    expect(lagi).toMatchObject({ ok: true, diperpanjang: true, token: a.token });
    expect((await k.ambil({ perkaraId: 7, pemilik: "B", tokenLama: "palsu" })).ok).toBe(false);
  });

  it("kunci yang kedaluwarsa tidak menghalangi selamanya", async () => {
    await k.ambil({ perkaraId: 9, pemilik: "tab ditutup", ttlDetik: 10 });
    expect((await k.ambil({ perkaraId: 9, pemilik: "B" })).ok).toBe(false);
    t.jam.sekarang += 11;
    expect((await k.ambil({ perkaraId: 9, pemilik: "B" })).ok).toBe(true);
  });

  it("hanya pemegang token yang dapat melepas", async () => {
    const a = await k.ambil({ perkaraId: 3, pemilik: "A" });
    expect((await k.lepas({ perkaraId: 3, token: "orangLain" })).dilepas).toBe(false);
    expect((await k.ambil({ perkaraId: 3, pemilik: "B" })).ok).toBe(false);
    expect((await k.lepas({ perkaraId: 3, token: a.token })).dilepas).toBe(true);
    expect((await k.ambil({ perkaraId: 3, pemilik: "B" })).ok).toBe(true);
  });

  it("dengan(): kerja dijalankan di bawah kunci lalu kunci dilepas, juga bila kerja melempar", async () => {
    let dalam = false;
    const r = await k.dengan({ perkaraId: 11, pemilik: "A" }, async () => {
      dalam = (await k.lihat(11)).aktif;
      return 42;
    });
    expect(r).toMatchObject({ dikunci: true, hasil: 42 });
    expect(dalam).toBe(true);
    await expect(
      k.dengan({ perkaraId: 12, pemilik: "A" }, async () => {
        throw new Error("x");
      })
    ).rejects.toThrow("x");
    expect((await k.lihat(12)).aktif).toBe(false);
  });

  it("dengan(): kunci tidak didapat -> kerja TIDAK dijalankan", async () => {
    await k.ambil({ perkaraId: 13, pemilik: "A" });
    const kerja = vi.fn();
    const r = await k.dengan({ perkaraId: 13, pemilik: "B" }, kerja);
    expect(r.dikunci).toBe(false);
    expect(kerja).not.toHaveBeenCalled();
  });

  it("gagal tertutup: basis data ALETA mati = kunci_tidak_tersedia, bukan lolos", async () => {
    const mati = muatKunci({ query: async () => Promise.reject(new Error("mati")) });
    expect(await mati.ambil({ perkaraId: 1, pemilik: "A" })).toMatchObject({ ok: false, alasan: "kunci_tidak_tersedia" });
  });

  it("perkara tidak sah ditolak; token tidak pernah ikut keadaan (lihat)", async () => {
    expect((await k.ambil({ perkaraId: 0, pemilik: "A" })).ok).toBe(false);
    await k.ambil({ perkaraId: 21, pemilik: "A" });
    expect(Object.keys(await k.lihat(21)).sort()).toEqual(["aktif", "oleh", "sampai", "tujuan"]);
  });
});

describe("membongkar hanya atas perintah pengguna", () => {
  const bot = baca("aleta_bot/routes/internalGatewayRoutes.js");
  it("bot menolak bongkar sungguhan tanpa perintahPengguna (satu dan semua)", () => {
    expect(bot.match(/perintahPengguna \|\| ""\) !== "bongkar"/g) || []).toHaveLength(2);
    expect(bot).toContain('alasan: "bongkar_tanpa_perintah"');
  });
  it("hanya tombol Bongkar di ekstensi yang mengirim tanda itu; penetapan-kerja tidak", () => {
    const konten = baca("ekstensi-sipp/konten.js");
    expect(konten.match(/perintahPengguna: kering \? "" : "bongkar"/g) || []).toHaveLength(2);
    expect(baca("ekstensi-sipp/penetapan-kerja.js")).not.toMatch(/perintahPengguna|penunjukan\/hapus/);
    expect(baca("manajemen_surat/src/server/modules/aleta-ecourt/kerjakan-penetapan.ts")).not.toMatch(/Hapus|hapus|bongkar\(/);
  });
  it("rute portal hapus & hapus-semua meminta perintah itu", () => {
    for (const r of ["hapus", "hapus-semua"]) {
      const s = baca(`manajemen_surat/src/app/api/aleta-bot/penunjukan/${r}/route.ts`);
      expect(s).toContain('"bongkar_tanpa_perintah"');
      expect(s).toContain("perintahPengguna,");
    }
  });
  it("semua jalan tulis penetapan di bot melewati kunci perkara", () => {
    expect(bot).toContain("denganKunciPerkara(");
    expect(bot).toContain("tujuan: `penetapan-${String(badan.jenis).toLowerCase()}`");
    const tulisan = baca("aleta_bot/services/penetapanTulisService.js");
    expect(tulisan).toContain("FROM perkara WHERE perkara_id = ? FOR UPDATE");
    expect(tulisan).toContain("penetapanKeadaanService.keadaanSatu");
  });
  it("penanda baris daftar dan usulan papan memakai sumber keadaan yang sama", () => {
    expect(baca("aleta_bot/services/sippKonteksService.js")).toContain("penetapanKeadaanService");
    expect(baca("aleta_bot/services/penunjukanService.js")).toContain("penetapanKeadaanService");
  });
});
