// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * 21 Okt 2026 (x11) - pembersih otomatis baris kalimat penutup saksi TERSIMPAN (bot). Kolam MySQL ditiru: ABT (abt_keterangan_saksi) dan SIPP
 * (perkara, perkara_proses). Yang dijaga: hanya perkara BELUM minutasi disentuh, hanya jawaban SELURUHNYA penutup (ikut pertanyaan),
 * cadangan lengkap ditulis lebih dulu dan dapat dipulihkan persis, mode kering tidak menulis apa pun.
 */
const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const svc = require_(path.join(AKAR, "aleta_bot/services/bersihPenutupSaksiService.js")) as {
  bersihkanPenutupTersimpan: (o: Record<string, unknown>) => Promise<{ kandidat: number; perkara: number; dihapus: number; gagal: number; cadangan: string; kering: boolean; perPerkara: Record<string, number> }>;
  pulihkanPenutupTersimpan: (o: Record<string, unknown>) => Promise<{ tercadang: number; dipulihkan: number; sudahAda: number }>;
};

type Baris = { id: number; perkara_id: number; saksi_id: number; urutan: number; tanya: string; jawab: string };
const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toUpperCase();
const md5 = (s: string) => require_("node:crypto").createHash("md5").update(Buffer.from(s, "latin1")).digest("hex");

function tiruan(awal: Baris[], minutasi: number[], sipp: number[]) {
  const tabel = new Map<number, Baris>(awal.map((b) => [b.id, { ...b }]));
  const abt = {
    pernyataan: [] as string[],
    query(sql: string, params: unknown[], cb: (e: Error | null, r?: unknown) => void) {
      this.pernyataan.push(sql);
      if (/^SELECT .* FROM abt_keterangan_saksi/i.test(sql)) {
        const pid = /perkara_id = \?/.test(sql) ? Number(params[params.length - 1]) : 0;
        const r = [...tabel.values()]
          .filter((b) => !pid || b.perkara_id === pid)
          .filter((b) => b.jawab.length > 0 && b.jawab.length <= 400 && /cukup|sekian|tidak ada|sampai di sini|demikian|terima kasih|sanggup|kuat|mampu|hanya itu|itu saja/i.test(b.jawab))
          .map((b) => ({ id: b.id, perkara_id: b.perkara_id, sidang_id: 1, penanya_id: "1", saksi_id: b.saksi_id, urutan_pertanyaan: b.urutan, pertanyaan_hex: hex(b.tanya), jawaban_hex: hex(b.jawab), md5_jawaban: md5(b.jawab), diinput_oleh: "x", diinput_tanggal: "2026-10-01 08:00:00", diperbaharui_oleh: null, diperbaharui_tanggal: null }));
        return cb(null, r);
      }
      if (/^DELETE FROM abt_keterangan_saksi/i.test(sql)) {
        const b = tabel.get(Number(params[0]));
        if (b && md5(b.jawab) === params[1]) {
          tabel.delete(b.id);
          return cb(null, { affectedRows: 1 });
        }
        return cb(null, { affectedRows: 0 });
      }
      if (/^INSERT IGNORE INTO abt_keterangan_saksi/i.test(sql)) {
        const [id, perkara_id, , , saksi_id, urutan, tanyaHex, jawabHex] = params as [number, number, unknown, unknown, number, number, string, string];
        if (tabel.has(id)) return cb(null, { affectedRows: 0 });
        tabel.set(id, { id, perkara_id, saksi_id, urutan, tanya: Buffer.from(tanyaHex, "hex").toString("latin1"), jawab: Buffer.from(jawabHex, "hex").toString("latin1") });
        return cb(null, { affectedRows: 1 });
      }
      return cb(new Error("pernyataan tak dikenal: " + sql.slice(0, 40)));
    },
  };
  const sippPool = {
    query(sql: string, params: unknown[], cb: (e: Error | null, r?: unknown) => void) {
      expect(sql).toContain("NOT EXISTS (SELECT 1 FROM perkara_proses pp WHERE pp.perkara_id = p.perkara_id AND pp.proses_id = ?)");
      expect(params[1]).toBe(220);
      const ids = (params[0] as number[]).map(String);
      cb(null, sipp.filter((p) => !minutasi.includes(p) && ids.includes(String(p))).map((p) => ({ perkara_id: p })));
    },
  };
  return { abt, sipp: sippPool, tabel };
}

const TANYA_TUTUP = "Apakah masih ada yang ingin Saudara sampaikan ?";
const TANYA_DAMAI = "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?";
const data: Baris[] = [
  { id: 1, perkara_id: 100, saksi_id: 1, urutan: 1, tanya: "Apakah saksi kenal Penggugat?", jawab: "Saya kenal Penggugat;" },
  { id: 2, perkara_id: 100, saksi_id: 1, urutan: 2, tanya: TANYA_DAMAI, jawab: "Saya tidak sanggup lagi;" }, // jawaban perkara
  { id: 3, perkara_id: 100, saksi_id: 1, urutan: 3, tanya: TANYA_TUTUP, jawab: "Sudah cukup;" }, // penutup, belum minutasi
  { id: 4, perkara_id: 100, saksi_id: 2, urutan: 1, tanya: TANYA_TUTUP, jawab: "Tidak ada, sudah cukup." },
  { id: 5, perkara_id: 200, saksi_id: 1, urutan: 3, tanya: TANYA_TUTUP, jawab: "Sudah cukup;" }, // sudah minutasi: tak disentuh
  { id: 6, perkara_id: 100, saksi_id: 3, urutan: 1, tanya: "Apa penyebab?", jawab: "Nafkah yang diberikan tidak cukup;" }, // kata cukup tetapi keterangan perkara
  { id: 7, perkara_id: 100, saksi_id: 3, urutan: 2, tanya: TANYA_TUTUP, jawab: "Saya tidak sanggup lagi;" }, // ambigu + pertanyaan penutup = penutup
  { id: 8, perkara_id: 300, saksi_id: 1, urutan: 2, tanya: TANYA_TUTUP, jawab: "Cukup sekian;" }, // perkara tak ada di SIPP: tak disentuh
];

describe("x11 - pembersih otomatis penutup saksi tersimpan", () => {
  it("menghapus hanya baris penutup utuh di perkara belum minutasi; cadangan lengkap ditulis lebih dulu", async () => {
    const t = tiruan(data, [200], [100, 200]);
    const folder = mkdtempSync(path.join(process.env.TMP || process.cwd(), "bersih-x11-"));
    const h = await svc.bersihkanPenutupTersimpan({ abt: t.abt, sipp: t.sipp, folder });
    expect(h.kandidat).toBe(3);
    expect(h.dihapus).toBe(3);
    expect(h.perkara).toBe(1);
    expect(h.perPerkara).toEqual({ "100": 3 });
    expect([...t.tabel.keys()].sort((a, b) => a - b)).toEqual([1, 2, 5, 6, 8]);
    // cadangan: kepala + 3 baris, teks sebagai hex byte-asli
    const berkas = readdirSync(folder);
    expect(berkas).toHaveLength(1);
    const baris = readFileSync(path.join(folder, berkas[0]), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect(baris[0]).toMatchObject({ jenis: "kepala", jumlah: 3 });
    expect(baris.slice(1).map((b: { id: number }) => b.id)).toEqual([3, 4, 7]);
    expect(Buffer.from(baris[1].jawaban_hex, "hex").toString("latin1")).toBe("Sudah cukup;");
    expect(h.cadangan).toBe(path.join(folder, berkas[0]));
  });

  it("pulih mengembalikan persis; yang sudah ada tidak ditimpa", async () => {
    const t = tiruan(data, [200], [100, 200]);
    const folder = mkdtempSync(path.join(process.env.TMP || process.cwd(), "bersih-x11-"));
    const h = await svc.bersihkanPenutupTersimpan({ abt: t.abt, sipp: t.sipp, folder });
    t.tabel.set(4, { id: 4, perkara_id: 100, saksi_id: 2, urutan: 1, tanya: "BARU", jawab: "diisi ulang orang" });
    const p = await svc.pulihkanPenutupTersimpan({ abt: t.abt, berkas: h.cadangan });
    expect(p).toMatchObject({ tercadang: 3, dipulihkan: 2, sudahAda: 1 });
    expect(t.tabel.get(3)).toMatchObject({ tanya: TANYA_TUTUP, jawab: "Sudah cukup;" });
    expect(t.tabel.get(4)?.jawab).toBe("diisi ulang orang");
    expect(t.tabel.get(7)?.jawab).toBe("Saya tidak sanggup lagi;");
  });

  it("mode kering tidak menulis dan tidak menghapus; berjalan lagi tidak menemukan apa pun", async () => {
    const t = tiruan(data, [200], [100, 200]);
    const folder = mkdtempSync(path.join(process.env.TMP || process.cwd(), "bersih-x11-"));
    const k = await svc.bersihkanPenutupTersimpan({ abt: t.abt, sipp: t.sipp, folder, kering: true });
    expect(k).toMatchObject({ kandidat: 3, dihapus: 0, kering: true, cadangan: "" });
    expect(t.tabel.size).toBe(8);
    expect(readdirSync(folder)).toHaveLength(0);
    await svc.bersihkanPenutupTersimpan({ abt: t.abt, sipp: t.sipp, folder });
    const lagi = await svc.bersihkanPenutupTersimpan({ abt: t.abt, sipp: t.sipp, folder });
    expect(lagi).toMatchObject({ kandidat: 0, dihapus: 0 });
  });

  it("baris yang isinya berubah sejak dibaca tidak dihapus; satu perkara dapat dipilih", async () => {
    const t = tiruan(data, [200], [100, 200]);
    const folder = mkdtempSync(path.join(process.env.TMP || process.cwd(), "bersih-x11-"));
    const asli = t.abt.query.bind(t.abt);
    t.abt.query = (sql: string, params: unknown[], cb: (e: Error | null, r?: unknown) => void) => {
      if (/^DELETE/i.test(sql) && params[0] === 3) t.tabel.get(3)!.jawab = "Sudah cukup lama berpisah;"; // diubah petugas di sela
      return asli(sql, params, cb);
    };
    const h = await svc.bersihkanPenutupTersimpan({ abt: t.abt, sipp: t.sipp, folder, perkaraId: 100 });
    expect(h.dihapus).toBe(2);
    expect(h.gagal).toBe(1);
    expect(t.tabel.get(3)?.jawab).toBe("Sudah cukup lama berpisah;");
  });

  it("terpasang: cron harian, rute internal, daftar jalur tulis; sasaran DELETE hanya abt_keterangan_saksi", () => {
    const app = readFileSync(path.join(AKAR, "aleta_bot/app.js"), "utf8");
    expect(app).toContain('cron.schedule("40 05 * * *"');
    expect(app).toContain("bersihkanPenutupTersimpan");
    expect(app).toContain("ALETA_BERSIH_PENUTUP_OTOMATIS");
    const rute = readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    expect(rute).toContain('router.post("/abt/bersih-penutup-saksi", requireInternalToken');
    expect(rute).toContain('router.post("/abt/pulih-penutup-saksi", requireInternalToken');
    const g = require_(path.join(AKAR, "aleta_bot/services/penjagaTandaSipp.js")) as { JALUR_TULIS_SIPP: { berkas: string; penjaga: string[] }[] };
    expect(g.JALUR_TULIS_SIPP.map((x) => x.berkas)).toContain("services/bersihPenutupSaksiService.js");
    const kode = readFileSync(path.join(AKAR, "aleta_bot/services/bersihPenutupSaksiService.js"), "utf8");
    expect([...kode.matchAll(/DELETE FROM (\w+)/g)].map((m) => m[1])).toEqual(["abt_keterangan_saksi"]);
    expect(kode.toLowerCase().replace(/aleta[-_]\w+/g, "")).not.toContain("aleta");
  });
});
