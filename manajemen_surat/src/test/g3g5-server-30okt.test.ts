// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { berlakuUntuk, bersihkanKalimat, kunciJenisPerkara, urutkanKalimat, type BarisKalimat } from "@/lib/kalimat-pribadi";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_CETAK_TERAKHIR, DDL_KALIMAT_PRIBADI } from "@/server/db/schema";
import { bacaCetakTerakhir, kunciBerkasCetak, simpanCetakTerakhir } from "@/server/modules/aleta-ecourt/cetak-terakhir";
import { createRequire } from "node:module";
import { daftarSalinanBht, lupakanSinkronSalinanBht, sinkronSalinanBht, tutupSalinanBht, type PerkaraBht } from "@/server/modules/aleta-ecourt/salinan-bht";
import { hapusKalimat, kalimatMilik, kalimatUntuk, pakaiKalimat, simpanKalimat } from "@/server/modules/aleta-ecourt/kalimat-pribadi";

/**
 * ============================================================================
 * 3.3 CETAKAN TERAKHIR, 3.4 PUSTAKA KALIMAT PRIBADI, 5.2 SALINAN BHT - sisi server (30 Okt 2026, migrasi 0120 dan 0121)
 * ============================================================================
 * Basis data sungguhan (pg-mem) lewat modul yang sama dengan rute; tidak ada yang ditulis ke SIPP/ABT.
 */

const AKAR = path.resolve(process.cwd());
const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0120 dan 0121 - tiga tempat pendaftaran", () => {
  it("jurnal: idx 106 dan 107 tepat sekali, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.filter((e) => e.tag.startsWith("0120_"))).toEqual([expect.objectContaining({ idx: 106, tag: "0120_aleta_cetak_terakhir_salinan_bht" })]);
    expect(j.entries.filter((e) => e.tag.startsWith("0121_"))).toEqual([expect.objectContaining({ idx: 107, tag: "0121_aleta_kalimat_pribadi" })]);
    expect(new Set(j.entries.map((e) => e.idx)).size).toBe(j.entries.length);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
  });

  it("pernyataan berkas = DDL di schema.ts, berjalan di pg-mem, tabel ikut cadangan, tanpa kunci asing", () => {
    for (const [berkas, ddl, tabel] of [
      ["0120_aleta_cetak_terakhir_salinan_bht.sql", DDL_CETAK_TERAKHIR, ["aleta_cetak_terakhir", "aleta_salinan_bht"]],
      ["0121_aleta_kalimat_pribadi.sql", DDL_KALIMAT_PRIBADI, ["aleta_kalimat_pribadi"]],
    ] as const) {
      const sql = readFileSync(path.join(AKAR, "drizzle", berkas), "utf8");
      expect(pernyataan(sql).sort()).toEqual([...ddl.tabel, ...ddl.indeks].map((s) => pernyataan(s)[0]).sort());
      const kosong = newDb();
      kosong.public.none(sql);
      for (const t of tabel) {
        expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
        expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
      }
      expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(sql.replace(/--.*$/gm, ""))).toBe(false);
      expect(/aleta/i.test(sql.replace(/aleta_[a-z_]+/g, "").replace(/--.*$/gm, ""))).toBe(false); // kata Aleta hanya sebagai nama tabel internal ALETA
    }
  });
});

describe("3.3 cetakan terakhir per perkara", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db.close();
  });
  const bagian = (n: number) => Array.from({ length: n }, (_, i) => ({ h: (0xabc000 + i).toString(16), t: `paragraf ${i}` }));

  it("menyimpan, membaca, menimpa; kunci blangko tidak peka .rtf dan huruf besar", async () => {
    expect(await bacaCetakTerakhir(db, "10154", "[01] Putusan.rtf")).toEqual({ ada: false });
    await simpanCetakTerakhir(db, { id: "u1", name: "Hakim Satu" }, { perkaraId: "10154", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", berkas: "[01] Putusan.rtf", bagian: bagian(3) });
    const a = await bacaCetakTerakhir(db, "10154", "[01] putusan");
    expect(a).toMatchObject({ ada: true, dicetakOleh: "Hakim Satu" });
    expect((a as { bagian: unknown[] }).bagian).toHaveLength(3);
    await simpanCetakTerakhir(db, { id: "u2", name: "PP Satu" }, { perkaraId: "10154", berkas: "[01] Putusan", bagian: bagian(5) });
    const b = await bacaCetakTerakhir(db, "10154", "[01] Putusan.rtf");
    expect((b as { bagian: unknown[] }).bagian).toHaveLength(5);
    expect(b).toMatchObject({ dicetakOleh: "PP Satu" });
    const baris = await db.queryAll(`SELECT * FROM aleta_cetak_terakhir`);
    expect(baris).toHaveLength(1);
    expect(kunciBerkasCetak("  [01]   Putusan.RTF ")).toBe("[01] putusan");
  });

  it("menolak masukan rusak dan tidak pernah menyimpan dokumen utuh (paragraf dipotong 160 huruf, paling banyak 600 bagian)", async () => {
    await expect(simpanCetakTerakhir(db, { id: "u1" }, { perkaraId: "abc", berkas: "x", bagian: bagian(2) })).rejects.toThrow();
    await expect(simpanCetakTerakhir(db, { id: "u1" }, { perkaraId: "1", berkas: "", bagian: bagian(2) })).rejects.toThrow();
    await expect(simpanCetakTerakhir(db, { id: "u1" }, { perkaraId: "1", berkas: "x", bagian: [] })).rejects.toThrow();
    await expect(simpanCetakTerakhir(db, { id: "u1" }, { perkaraId: "1", berkas: "x", bagian: [{ h: "bukan-hex!", t: "x" }] })).rejects.toThrow();
    await simpanCetakTerakhir(db, { id: "u1" }, { perkaraId: "1", berkas: "x", bagian: [{ h: "abcdef01", t: "a".repeat(900) }, ...bagian(700)] });
    const r = (await bacaCetakTerakhir(db, "1", "x")) as { bagian: Array<{ t: string }> };
    expect(r.bagian).toHaveLength(600);
    expect(r.bagian[0].t).toHaveLength(160);
  });

  it("baris lebih tua dari 400 hari dibuang saat menyimpan", async () => {
    await db.run(`INSERT INTO aleta_cetak_terakhir (perkara_id, berkas_kunci, bagian, jumlah_bagian, dicetak_pada) VALUES ('9', 'lama', '[]', 0, ?)`, [new Date(Date.now() - 500 * 86400000).toISOString()]);
    await simpanCetakTerakhir(db, { id: "u1" }, { perkaraId: "1", berkas: "baru", bagian: bagian(1) });
    expect((await db.queryAll(`SELECT perkara_id FROM aleta_cetak_terakhir`)).map((x) => (x as { perkara_id: string }).perkara_id)).toEqual(["1"]);
  });
});

describe("3.4 pustaka kalimat pribadi", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db.close();
  });
  const hakim = { id: "h1", name: "Hakim Satu", roleId: "hakim", additionalRoleIds: [] as string[] };
  const hakim2 = { id: "h2", name: "Hakim Dua", roleId: "hakim", additionalRoleIds: [] as string[] };
  const pp = { id: "p1", name: "PP Satu", roleId: "panitera-pengganti", additionalRoleIds: [] as string[] };

  it("masukan dibersihkan: terlalu pendek/panjang ditolak, kode harus angka, golongan berbagi disaring, judul bawaan dari teks", () => {
    expect(bersihkanKalimat({ teks: "ab" }).ok).toBe(false);
    expect(bersihkanKalimat({ teks: "x".repeat(6001) }).ok).toBe(false);
    expect(bersihkanKalimat({ teks: "kalimat sah", kode: "abc" }).ok).toBe(false);
    const h = bersihkanKalimat({ teks: "Menimbang bahwa Tergugat tidak hadir\r\nlagi", jenisPerkara: "Cerai  Gugat", status: "Verstek!", kode: "8503", dibagikan: ["pp", "kasir", "pp"] });
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.nilai).toMatchObject({ jenisPerkara: "cerai gugat", status: "verstek", kode: "8503", dibagikan: ["pp"], judul: "Menimbang bahwa Tergugat tidak hadir lagi" });
  });

  it("simpan, ubah, kembar tidak ganda; hanya pemilik yang mengubah atau menghapus; milik saya terdaftar", async () => {
    const a = await simpanKalimat(db, hakim, { jenisPerkara: "Cerai Gugat", status: "verstek", kode: "8503", teks: "Tergugat telah dipanggil secara sah dan patut." });
    const kembar = await simpanKalimat(db, hakim, { jenisPerkara: "Cerai Gugat", status: "verstek", kode: "8503", teks: "Tergugat telah dipanggil secara sah dan patut.", judul: "Panggilan sah" });
    expect(kembar.id).toBe(a.id);
    expect(kembar.judul).toBe("Panggilan sah");
    expect(await kalimatMilik(db, hakim)).toHaveLength(1);
    const diubah = await simpanKalimat(db, hakim, { id: a.id, jenisPerkara: "Cerai Gugat", status: "verstek", kode: "8503", teks: "Tergugat dipanggil secara sah dan patut (diubah)." });
    expect(diubah.teks).toContain("diubah");
    await expect(simpanKalimat(db, hakim2, { id: a.id, teks: "mencoba menimpa kalimat orang lain" })).rejects.toThrow(/milik akun lain/);
    await expect(hapusKalimat(db, hakim2, a.id)).rejects.toThrow(/milik akun lain/);
    expect(await hapusKalimat(db, hakim, a.id)).toBe(true);
    expect(await kalimatMilik(db, hakim)).toEqual([]);
  });

  it("untuk konteks: yang cocok saja; lebih spesifik dan lebih sering dipakai di atas; kalimat orang lain tidak terlihat kecuali dibagikan kepada golongannya", async () => {
    const umum = await simpanKalimat(db, hakim, { teks: "Kalimat umum untuk semua isian teks." });
    const khusus = await simpanKalimat(db, hakim, { jenisPerkara: "Cerai Gugat", status: "verstek", kode: "8503", teks: "Kalimat khusus verstek untuk isian 8503." });
    const jenisLain = await simpanKalimat(db, hakim, { jenisPerkara: "Itsbat Nikah", teks: "Kalimat khusus itsbat nikah." });
    const dibagi = await simpanKalimat(db, hakim2, { jenisPerkara: "Cerai Gugat", kode: "8503", teks: "Kalimat hakim dua dibagikan ke panitera pengganti.", dibagikan: ["pp"] });
    const pribadi = await simpanKalimat(db, hakim2, { jenisPerkara: "Cerai Gugat", kode: "8503", teks: "Kalimat pribadi hakim dua, tidak dibagikan." });

    const konteks = { jenisPerkara: "Cerai Gugat", status: "verstek", kode: "8503" };
    const milikH1 = (await kalimatUntuk(db, hakim, konteks)).map((k) => k.id);
    expect(milikH1).toEqual([khusus.id, umum.id]); // khusus (isian+jenis+status) mengalahkan umum; itsbat tidak cocok; kalimat hakim dua tidak terlihat
    expect(milikH1).not.toContain(jenisLain.id);
    expect((await kalimatUntuk(db, pp, konteks)).map((k) => k.id)).toEqual([dibagi.id]); // PP: hanya yang dibagikan kepada golongan PP
    expect(await kalimatUntuk(db, pp, konteks)).not.toContainEqual(expect.objectContaining({ id: pribadi.id }));
    // jenis lain / tanpa konteks: kalimat bertuju khusus tidak ikut
    expect((await kalimatUntuk(db, hakim, { jenisPerkara: "Itsbat Nikah", kode: "9999" })).map((k) => k.id)).toEqual([jenisLain.id, umum.id]);
    expect((await kalimatUntuk(db, hakim, {})).map((k) => k.id)).toEqual([umum.id]);
  });

  it("pemakaian dihitung dan menentukan urutan; hanya kalimat yang terlihat yang dapat dicatat pemakaiannya", async () => {
    const a = await simpanKalimat(db, hakim, { jenisPerkara: "Cerai Gugat", kode: "8503", teks: "Kalimat A untuk isian 8503 cerai gugat." });
    const b = await simpanKalimat(db, hakim, { jenisPerkara: "Cerai Gugat", kode: "8503", teks: "Kalimat B untuk isian 8503 cerai gugat." });
    const konteks = { jenisPerkara: "Cerai Gugat", kode: "8503" };
    expect(await pakaiKalimat(db, hakim, b.id)).toBe(true);
    expect(await pakaiKalimat(db, hakim, b.id)).toBe(true);
    expect(await pakaiKalimat(db, hakim, a.id)).toBe(true);
    const urut = await kalimatUntuk(db, hakim, konteks);
    expect(urut.map((k) => [k.id, k.dipakai])).toEqual([[b.id, 2], [a.id, 1]]);
    expect(await pakaiKalimat(db, pp, a.id)).toBe(false); // PP tidak melihatnya
    expect(await pakaiKalimat(db, hakim, "tidak-ada")).toBe(false);
  });

  it("batas jumlah per pemilik dijaga", async () => {
    for (let i = 0; i < 300; i += 1) await db.run(`INSERT INTO aleta_kalimat_pribadi (id, pemilik_id, teks, dibuat_pada, diubah_pada) VALUES (?, 'h1', ?, 'x', 'x')`, [`id-${i}-xxxxxxxx`, `kalimat ${i}`]);
    await expect(simpanKalimat(db, hakim, { teks: "kalimat ke tiga ratus satu" })).rejects.toThrow(/Pustaka penuh/);
  });
});

describe("pustaka: aturan murni", () => {
  const k = (p: Partial<BarisKalimat>): BarisKalimat => ({ id: "x", pemilikId: "a", pemilikNama: "", jenisPerkara: "", status: "", kode: "", judul: "", teks: "t", dibagikan: [], dipakai: 0, dipakaiTerakhir: "", diubahPada: "", ...p });
  it("berlakuUntuk: ruas kosong berlaku untuk semuanya; ruas terisi menuntut konteks yang sama", () => {
    expect(berlakuUntuk(k({}), {})).toBe(true);
    expect(berlakuUntuk(k({ jenisPerkara: "cerai gugat" }), {})).toBe(false);
    expect(berlakuUntuk(k({ jenisPerkara: "cerai gugat" }), { jenisPerkara: "Cerai Gugat" })).toBe(true);
    expect(berlakuUntuk(k({ status: "verstek" }), { status: "hadir" })).toBe(false);
    expect(berlakuUntuk(k({ kode: "8503" }), { kode: "8503" })).toBe(true);
    expect(kunciJenisPerkara("  Cerai   GUGAT ")).toBe("cerai gugat");
  });
  it("urutan stabil: kecocokan, pemakaian, lalu yang terbaru", () => {
    const hasil = urutkanKalimat([k({ id: "1", dipakai: 5 }), k({ id: "2", kode: "8503" }), k({ id: "3", dipakai: 9, dipakaiTerakhir: "2026-10-30" }), k({ id: "4", dipakai: 5, dipakaiTerakhir: "2026-10-29" })], "a");
    expect(hasil.map((x) => x.id)).toEqual(["2", "3", "4", "1"]);
  });
});

describe("5.2 salinan putusan perkara yang baru BHT - penunjuk", () => {
  let db: AletaDatabase;
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    lupakanSinkronSalinanBht();
  });
  afterEach(async () => {
    await db.close();
  });
  const P = (id: string, bht: string, adaPutusan = true): PerkaraBht => ({ perkaraId: id, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, tanggalPutusan: "2026-10-10", tanggalBht: bht, adaPutusan });

  it("mencatat yang baru BHT (berkas putusan ada), tidak ganda pada sinkron berikutnya; yang gagal dibaca tidak mengubah apa pun", async () => {
    expect(await sinkronSalinanBht(db, async () => [P("1", "2026-10-29"), P("2", "2026-10-28"), P("3", "2026-10-27", false), P("x", "2026-10-27")])).toBe(2);
    expect(await sinkronSalinanBht(db, async () => [P("1", "2026-10-29"), P("2", "2026-10-28"), P("4", "2026-10-30")])).toBe(1);
    expect(await sinkronSalinanBht(db, async () => null)).toBeNull();
    const d = await daftarSalinanBht(db, { sinkron: false });
    expect(d.perkara.map((x) => x.perkaraId)).toEqual(["4", "1", "2"]); // terbaru BHT dulu
    expect(d.perkara.every((x) => x.status === "menunggu")).toBe(true);
  });

  it("menutup yang sudah dicetak (satu kali), mengabaikan nomor rusak; yang ditutup tidak tampil dan tidak muncul lagi walau SIPP masih memuatnya", async () => {
    await sinkronSalinanBht(db, async () => [P("1", "2026-10-29"), P("2", "2026-10-28")]);
    expect(await tutupSalinanBht(db, { id: "u1", name: "Hakim Satu" }, ["1", "bukan", "999"])).toBe(1);
    expect(await tutupSalinanBht(db, { id: "u1" }, ["1"])).toBe(0);
    await sinkronSalinanBht(db, async () => [P("1", "2026-10-29"), P("2", "2026-10-28")]);
    expect((await daftarSalinanBht(db, { sinkron: false })).perkara.map((x) => x.perkaraId)).toEqual(["2"]);
    const baris = await db.queryOne<{ selesai_oleh: string }>(`SELECT selesai_oleh FROM aleta_salinan_bht WHERE perkara_id = '1'`);
    expect(baris!.selesai_oleh).toBe("Hakim Satu");
  });

  it("daftar menyegarkan dari SIPP sendiri (malas-sinkron) sekali dalam 10 menit", async () => {
    let panggilan = 0;
    const ambil = async () => {
      panggilan += 1;
      return [P("7", "2026-10-30")];
    };
    const a = await daftarSalinanBht(db, { ambil });
    const b = await daftarSalinanBht(db, { ambil });
    expect(panggilan).toBe(1);
    expect(a.disegarkan).toBe(true);
    expect(b.disegarkan).toBe(false);
    expect(b.perkara.map((x) => x.perkaraId)).toEqual(["7"]);
  });

  it("bot: hanya SELECT, batas hari dijepit, hasil dipetakan; galat dijawab jujur", async () => {
    const bot = createRequire(import.meta.url)(path.join(AKAR, "..", "aleta_bot/services/salinanBhtService.js")) as { daftarBht: (p: unknown, d: unknown) => Promise<any> };
    const sql: string[] = [];
    const param: unknown[] = [];
    const r = await bot.daftarBht(
      { sejakHari: 999 },
      {
        kueri: async (t: string, p: unknown[]) => {
          sql.push(t);
          param.push(...p);
          return [
            { perkara_id: 5, nomor_perkara: "5/Pdt.G/2026/PA.Dgl", tanggal_putusan: new Date(2026, 9, 10), tanggal_bht: "2026-10-29", amar_putusan_dok: "resources/file/doc/x.pdf" },
            { perkara_id: 6, nomor_perkara: "6/Pdt.G/2026/PA.Dgl", tanggal_putusan: "2026-10-11", tanggal_bht: "2026-10-28", amar_putusan_dok: "" },
            { perkara_id: 7, nomor_perkara: "", tanggal_putusan: "", tanggal_bht: "2026-10-28", amar_putusan_dok: "x" },
          ];
        },
      }
    );
    expect(sql.every((t) => /^\s*SELECT/i.test(t))).toBe(true);
    expect(param).toEqual([60]);
    expect(r).toMatchObject({ ok: true, sejakHari: 60 });
    expect(r.perkara).toEqual([
      { perkaraId: "5", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", tanggalPutusan: "2026-10-10", tanggalBht: "2026-10-29", adaPutusan: true },
      { perkaraId: "6", nomorPerkara: "6/Pdt.G/2026/PA.Dgl", tanggalPutusan: "2026-10-11", tanggalBht: "2026-10-28", adaPutusan: false },
    ]);
    expect(await bot.daftarBht({}, { kueri: async () => { throw new Error("x"); } })).toMatchObject({ ok: false });
  });
});
