// @vitest-environment node
/**
 * ============================================================================
 * TETAP SINKRON DENGAN ABT (5 Nov 2026, Tahap 9, migrasi 0136) - SIMULASI KEADAAN SINKRON, DATA REKAAN
 * ============================================================================
 *   1. migrasi 0136 = DDL schema.ts = urutan penyimpanan; jurnal idx 118 sesudah 0135; tanpa kunci asing;
 *   2. aturan jadwal: bawaan mati, tidak pada jam kerja tanpa izin, sekali per tanggal, 409 tidak mencatat tanggal;
 *   3. tambalan: hasil penerapan = isi baru persis (acak, sisip murni, hapus murni, besar);
 *   4. belum disunting berubah di ABT -> diambil, isi lama tersimpan sebagai versi (dengan batas);
 *   5. sudah disunting berubah di ABT -> bentrok dicatat, isi ALETA ABT utuh, isi ABT tersimpan terbatas jumlahnya;
 *   6. hilang di ABT -> hanya ditandai, tidak dihapus; kembali -> ditandai aktif lagi;
 *   7. beda dan pilihan: tetap pakai ALETA ABT / ambil dari ABT; sidik usang ditolak 409;
 *   8. ekspor paket: isi benar (tambalan -> md5 baru), tanpa kata nama aplikasi, yang belum siap disebut sebabnya, tidak dipasang.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  KUNCI_SETELAN_SINKRON_ABT,
  SETELAN_SINKRON_ABT_BAWAAN,
  bersihkanSetelanSinkron,
  hitungNamaAplikasi,
  hitungTambalan,
  keputusanDetak,
  sebabSetelanDitolak,
  terapkanTambalan,
} from "@/lib/aleta-abt-sinkron";
import { DDL_ALETA_ABT_BANDING } from "@/server/db/schema";
import { bukaBlangko, simpanSuntingan, terbitkanVersi } from "@/server/modules/aleta-abt-penyunting/service";
import { bitaIsi, jalankanSinkron, type BerkasPotret, type PotretAbt } from "@/server/modules/aleta-abt-pustaka/service";
import {
  bukaBeda,
  buatPaketEkspor,
  daftarEkspor,
  detakSinkronAbt,
  putuskanBeda,
  ringkasanBeda,
  simpanSetelanSinkronAbt,
} from "@/server/modules/aleta-abt-sinkron/service";
import { TAMBAL_RTF_PY } from "@/server/modules/aleta-abt-sinkron/tambal-rtf-py";
import { ApiError } from "@/server/shared/errors";

const M = process.cwd();
const BACA = (p: string) => readFileSync(path.join(M, p), "utf8");
const SQL_0133 = BACA("drizzle/0133_aleta_abt_pustaka.sql");
const SQL_0135 = BACA("drizzle/0135_aleta_abt_penyunting.sql");
const SQL_0136 = BACA("drizzle/0136_aleta_abt_banding.sql");
const JURNAL = JSON.parse(BACA("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; when: number; tag: string }> };
const KLIEN = BACA("src/server/db/client.ts");
const rapat = (s: string) => s.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

describe("migrasi 0136", () => {
  it("SQL = DDL schema.ts; jurnal idx 118 sesudah 0135; terdaftar di urutan penyimpanan; tanpa kunci asing", () => {
    expect(DDL_ALETA_ABT_BANDING.tabel.map(rapat)).toEqual(SQL_0136.match(/CREATE TABLE IF NOT EXISTS [^;]+/g)!.map(rapat));
    expect(DDL_ALETA_ABT_BANDING.indeks.map(rapat)).toEqual(SQL_0136.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS [^;]+/g)!.map(rapat));
    const e = JURNAL.entries;
    const i = e.findIndex((x) => x.tag === "0136_aleta_abt_banding");
    expect(e[i]).toMatchObject({ idx: 118 });
    expect(e[i - 1].tag).toBe("0135_aleta_abt_penyunting");
    expect(e[i].when).toBeGreaterThan(e[i - 1].when);
    expect(new Set(e.map((x) => x.idx)).size).toBe(e.length);
    expect(KLIEN).toContain('"aleta_abt_berkas_banding"');
    expect(SQL_0136).not.toMatch(/REFERENCES|FOREIGN KEY/i);
  });
});

describe("aturan jadwal", () => {
  it("bawaan mati; jam sah; jam kerja sidang ditolak tanpa izin", () => {
    expect(SETELAN_SINKRON_ABT_BAWAAN).toMatchObject({ jadwal: false, jam: "23:00", izinJamKerja: false });
    expect(bersihkanSetelanSinkron({ jadwal: "ya", jam: "25:99", izinJamKerja: 1 })).toMatchObject({ jadwal: false, jam: "23:00", izinJamKerja: false });
    expect(bersihkanSetelanSinkron({ jadwal: true, jam: "2.30" })).toMatchObject({ jadwal: true, jam: "02:30" });
    expect(sebabSetelanDitolak({ ...SETELAN_SINKRON_ABT_BAWAAN, jadwal: true, jam: "09:00" })).toMatch(/jam kerja sidang/);
    expect(sebabSetelanDitolak({ ...SETELAN_SINKRON_ABT_BAWAAN, jadwal: true, jam: "09:00", izinJamKerja: true })).toBe("");
    expect(sebabSetelanDitolak({ ...SETELAN_SINKRON_ABT_BAWAAN, jadwal: true, jam: "17:00" })).toBe("");
    expect(sebabSetelanDitolak({ ...SETELAN_SINKRON_ABT_BAWAAN, jadwal: true, jam: "06:59" })).toBe("");
    expect(sebabSetelanDitolak({ ...SETELAN_SINKRON_ABT_BAWAAN, jadwal: false, jam: "09:00" })).toBe("");
  });

  it("keputusan detak: mati, belum, jam kerja, sudah hari ini, jalan", () => {
    const hidup = { ...SETELAN_SINKRON_ABT_BAWAAN, jadwal: true };
    expect(keputusanDetak(SETELAN_SINKRON_ABT_BAWAAN, "2026-11-05", "23:30:00", null)).toBe("mati");
    expect(keputusanDetak(hidup, "2026-11-05", "22:59:59", null)).toBe("belum");
    expect(keputusanDetak(hidup, "2026-11-05", "23:00:00", null)).toBe("jalan");
    expect(keputusanDetak(hidup, "2026-11-05", "23:40:00", { tanggal: "2026-11-05", pada: "x" })).toBe("sudah");
    expect(keputusanDetak(hidup, "2026-11-06", "23:40:00", { tanggal: "2026-11-05", pada: "x" })).toBe("jalan");
    // Jam pemicu dini hari tetapi server baru menyala pagi: tidak jalan di jam kerja sidang.
    const dini = { ...hidup, jam: "00:30" };
    expect(keputusanDetak(dini, "2026-11-06", "08:10:00", null)).toBe("jam-kerja");
    expect(keputusanDetak({ ...dini, izinJamKerja: true }, "2026-11-06", "08:10:00", null)).toBe("jalan");
    expect(keputusanDetak(dini, "2026-11-06", "17:00:00", null)).toBe("jalan");
  });
});

describe("tambalan", () => {
  const acak = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  it("penerapan selalu menghasilkan isi baru persis: acak, sisip murni, hapus murni, tanpa beda, besar", () => {
    const r = acak(7);
    const dasar = Buffer.from(Array.from({ length: 4000 }, () => 97 + Math.floor(r() * 5)));
    const kasus: Buffer[] = [];
    for (let k = 0; k < 40; k += 1) {
      const b = Buffer.from(dasar);
      for (let n = 0; n < 1 + Math.floor(r() * 6); n += 1) {
        const at = Math.floor(r() * b.length);
        const jenis = r();
        if (jenis < 0.6) b[at] = 65 + Math.floor(r() * 20);
      }
      let hasil: Buffer = b;
      const sisip = Math.floor(r() * hasil.length);
      hasil = Buffer.concat([hasil.subarray(0, sisip), Buffer.from("SISIP-REKAAN"), hasil.subarray(sisip)]);
      const hapus = Math.floor(r() * (hasil.length - 30));
      hasil = Buffer.concat([hasil.subarray(0, hapus), hasil.subarray(hapus + Math.floor(r() * 25))]);
      kasus.push(hasil);
    }
    kasus.push(Buffer.concat([dasar, Buffer.from(" ekor")]), Buffer.concat([Buffer.from("kepala "), dasar]), dasar.subarray(10, 3990), Buffer.alloc(0));
    for (const baru of kasus) {
      const t = hitungTambalan(dasar, baru);
      if (baru.equals(dasar)) {
        expect(t).toEqual([]);
        continue;
      }
      const jadi = terapkanTambalan(dasar, t);
      expect(jadi && jadi.equals(baru)).toBe(true);
      for (const p of t) expect(p.offset).toBeGreaterThanOrEqual(0);
    }
  });

  it("tambalan yang meleset ditolak (isi dasar lain), nama aplikasi dihitung tanpa peduli huruf", () => {
    const lama = Buffer.from("satu dua tiga empat lima enam tujuh");
    const t = hitungTambalan(lama, Buffer.from("satu dua TIGA empat lima enam tujuh"));
    expect(t).toHaveLength(1);
    expect(terapkanTambalan(Buffer.from("satu dua xxxx empat lima enam tujuh"), t)).toBeNull();
    expect(hitungNamaAplikasi("Aleta dan ALETA dan aLeTa")).toBe(3);
    expect(hitungNamaAplikasi(Buffer.from("tanpa itu"))).toBe(0);
  });
});

// ─── pg-mem ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL_0133);
  mem.public.none(SQL_0135);
  mem.public.none(SQL_0136);
  mem.public.none("CREATE TABLE IF NOT EXISTS aleta_ekstensi_setelan (pengguna_id TEXT NOT NULL, kunci TEXT NOT NULL, nilai TEXT NOT NULL, diubah_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, kunci))");
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  const baca = async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>>;
  return { db: db as never, dbUji: db, baca };
}

const md5 = (t: string | Buffer) => createHash("md5").update(typeof t === "string" ? Buffer.from(t, "latin1") : t).digest("hex");
const KEPALA = "{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff1{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fswiss\\fcharset0 Calibri;}}{\\colortbl;}\r\n";
/** Blangko rekaan: judul, satu kalimat isian (paragraf 1), penutup. */
const rtf = (kalimat: string, penutup = "Terakhir.") => `${KEPALA}\\pard\\qc\\b PUTUSAN\\b0\\par\r\n\\pard\\qj ${kalimat}\\par\r\n\\pard ${penutup}\\par}`;
const SEHARI = 86_400_000;

const JA = "1 Perceraian CG/[01] A belum disunting.rtf";
const JB = "1 Perceraian CG/[02] B disunting.rtf";
const JC = "2 Itsbat Nikah/[01] C akan hilang.rtf";
const JD = "2 Itsbat Nikah/[02] D disunting aman.rtf";
const JE = "2 Itsbat Nikah/[03] E sebut nama aplikasi.rtf";
const AKTOR = { id: "usr-derry", name: "Derry" };

async function dunia() {
  const { db, dbUji, baca } = await siapkan();
  const abt = new Map<string, string>([
    [JA, rtf("Kalimat A versi satu.")],
    [JB, rtf("Nomor #0001# antara #0098# melawan #0102#.")],
    [JC, rtf("Kalimat C.")],
    [JD, rtf("Kalimat D asli.")],
    [JE, rtf("Kalimat E asli.")],
  ]);
  let n = 0;
  const kini = () => `2026-11-05T10:${String(10 + Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}.000Z`;
  const potret = (): PotretAbt & { berkas: Array<BerkasPotret & { isiTeks: string }> } => ({
    server: "PA.Dgl",
    berkas: [...abt.entries()].map(([jalur, isi]) => {
      const bagian = jalur.split("/");
      return { jalur, folder: bagian[0], nama: bagian[1], arsip: false, md5: md5(isi), ukuran: Buffer.byteLength(isi, "latin1"), waktu: "2026-11-02T10:00:00.000Z", penanda: [...isi.matchAll(/#(\d{4})#/g)].map((m) => m[1]), isiTeks: isi };
    }),
    variabel: [],
    menu: [],
  });
  const deps = () => ({
    ambilPotret: async () => potret(),
    ambilIsi: async (jalur: string[]) => ({
      berkas: jalur.map((j) => ({ jalur: j, md5: md5(abt.get(j)!), ukuran: Buffer.byteLength(abt.get(j)!, "latin1"), isi: Buffer.from(abt.get(j)!, "latin1").toString("base64") })),
      ditolak: [],
      lewat: [],
    }),
    transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db),
    kini: () => kini(),
  });
  const sinkron = async () => {
    n += 1;
    const id = `s${n}`;
    await dbUji.run("INSERT INTO aleta_abt_sinkron (id, status, oleh, mulai_at) VALUES (?, 'jalan', 'Uji', ?)", [id, kini()]);
    return jalankanSinkron(db, id, deps() as never);
  };
  const o = { transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db), kini: () => kini() };
  /** Sunting + terbitkan di ALETA ABT lewat penyunting sungguhan (paragraf 1 diganti). */
  const sunting = async (jalur: string, kalimat: string) => {
    const b = await bukaBlangko(db, jalur);
    const h = await simpanSuntingan(db, AKTOR, { id: jalur, dasarNomor: b.terakhir, suntingan: [{ i: 1, teks: kalimat }] }, o as never);
    await terbitkanVersi(db, AKTOR, { id: jalur, nomor: h.nomor }, o as never);
    return h;
  };
  const isiAleta = async (jalur: string) => {
    const r = (await baca("SELECT isi, pengkodean FROM aleta_abt_berkas WHERE id = ?", [jalur]))[0];
    return bitaIsi(String(r.isi), String(r.pengkodean)).toString("latin1");
  };
  return { db, dbUji, baca, abt, sinkron, sunting, isiAleta, o, kini };
}

describe("simulasi keadaan sinkron: belum disunting berubah di ABT diambil, versi lama tersimpan", () => {
  it("diambil otomatis; isi lama = versi 1 (lama), isi baru = versi terbit; tanpa pembanding; berulang tidak menulis", async () => {
    const w = await dunia();
    await w.sinkron();
    const v1 = w.abt.get(JA)!;
    const v2 = rtf("Kalimat A versi dua yang diperbaiki di ABT.");
    w.abt.set(JA, v2);
    const hasil = await w.sinkron();
    expect(hasil.berkas).toMatchObject({ berubah: 1, bentrok: 0, gagal: 0 });
    expect(await w.isiAleta(JA)).toBe(v2);
    const b = (await w.baca("SELECT md5, md5_asal, diubah, bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JA]))[0];
    expect(b).toMatchObject({ md5: md5(v2), md5_asal: md5(v2), diubah: 0, bentrok_md5: "" });
    const versi = await w.baca("SELECT nomor, jenis, status, md5, catatan, dari_nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ? ORDER BY nomor", [JA]);
    expect(versi).toEqual([
      { nomor: 1, jenis: "asal", status: "lama", md5: md5(v1), catatan: "Salinan dari ABT (sebelum diperbarui dari ABT)", dari_nomor: 0 },
      { nomor: 2, jenis: "asal", status: "terbit", md5: md5(v2), catatan: "Diambil dari ABT (sinkron)", dari_nomor: 0 },
    ]);
    // Isi versi lama dapat dibaca persis (bita sama) lewat penyunting.
    const lama = await bukaBlangko(w.db, JA, 1);
    expect(lama.versi).toMatchObject({ nomor: 1, status: "lama", md5: md5(v1) });
    expect(lama.terakhir).toBe(2);
    expect((await w.baca("SELECT isi FROM aleta_abt_berkas_versi WHERE berkas_id = ? AND nomor = 1", [JA]))[0].isi).toBe(v1);
    expect(await w.baca("SELECT id FROM aleta_abt_berkas_banding")).toEqual([]);
    // Dijalankan ulang tanpa perubahan: tidak ada versi baru.
    const lagi = await w.sinkron();
    expect(lagi.berkas.berubah).toBe(0);
    expect(await w.baca("SELECT nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ?", [JA])).toHaveLength(2);
    // Perubahan berikutnya: versi terbit lama menjadi 'lama', yang baru terbit.
    const v3 = rtf("Kalimat A versi tiga.");
    w.abt.set(JA, v3);
    await w.sinkron();
    const urut = await w.baca("SELECT nomor, status FROM aleta_abt_berkas_versi WHERE berkas_id = ? ORDER BY nomor", [JA]);
    expect(urut).toEqual([
      { nomor: 1, status: "lama" },
      { nomor: 2, status: "lama" },
      { nomor: 3, status: "terbit" },
    ]);
  });

  it("versi hasil ambil-otomatis dibatasi (disk); versi 1 tidak pernah dibuang", async () => {
    const w = await dunia();
    await w.sinkron();
    for (let k = 0; k < 14; k += 1) {
      w.abt.set(JA, rtf(`Kalimat A perubahan ke-${k}.`));
      await w.sinkron();
    }
    const versi = await w.baca("SELECT nomor, catatan FROM aleta_abt_berkas_versi WHERE berkas_id = ? ORDER BY nomor", [JA]);
    const otomatis = versi.filter((v) => String(v.catatan).startsWith("Diambil dari ABT"));
    expect(otomatis).toHaveLength(8);
    expect(versi[0]).toMatchObject({ nomor: 1, catatan: "Salinan dari ABT (sebelum diperbarui dari ABT)" });
    expect(versi[versi.length - 1].nomor).toBe(15);
    expect(await w.isiAleta(JA)).toBe(rtf("Kalimat A perubahan ke-13."));
  });
});

describe("simulasi keadaan sinkron: sudah disunting berubah di ABT dicatat sebagai beda, ubahan tidak ditimpa", () => {
  it("isi ALETA ABT utuh; isi ABT terbaru tersimpan di samping; jumlah pembanding dibatasi; kembali sama -> beres", async () => {
    const w = await dunia();
    await w.sinkron();
    const dasarB = w.abt.get(JB)!;
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102# (ubahan ALETA).");
    const isiSunting = await w.isiAleta(JB);
    expect(isiSunting).toContain("ubahan ALETA");
    const v2 = rtf("Nomor #0001# antara #0098# melawan #0102# (diperbaiki di ABT).");
    w.abt.set(JB, v2);
    const hasil = await w.sinkron();
    expect(hasil.berkas).toMatchObject({ bentrok: 1, berubah: 0, gagal: 0 });
    expect(await w.isiAleta(JB)).toBe(isiSunting);
    const b = (await w.baca("SELECT diubah, md5_asal, bentrok_md5, bentrok_at FROM aleta_abt_berkas WHERE id = ?", [JB]))[0];
    expect(b).toMatchObject({ diubah: 1, md5_asal: md5(dasarB), bentrok_md5: md5(v2) });
    const banding = await w.baca("SELECT id, peran, isi, md5, ukuran FROM aleta_abt_berkas_banding");
    expect(banding).toEqual([{ id: `${JB}|${md5(v2)}`, peran: "beda", isi: v2, md5: md5(v2), ukuran: Buffer.byteLength(v2, "latin1") }]);
    // Hanya blangko yang berbeda yang disimpan: blangko lain tidak punya pembanding.
    expect(banding.map((x) => String(x.id).split("|")[0])).toEqual([JB]);
    const r = await ringkasanBeda(w.db, new Date(Date.parse(String(b.bentrok_at)) + 9 * SEHARI));
    expect(r.menunggu).toBe(1);
    expect(r.tertuaHari).toBe(9);
    expect(r.daftar[0]).toMatchObject({ id: JB, nama: "[02] B disunting", folderLabel: "1 Perceraian CG", hari: 9 });
    expect(r.daftar[0].ukuranAbt).toBe(Buffer.byteLength(v2, "latin1"));

    // Diulang tanpa perubahan: tidak ada tulisan baru.
    expect((await w.sinkron()).tulis).toBe(0);

    // ABT berubah berkali-kali: pembanding dibatasi 3, yang terbaru selalu ada.
    for (let k = 0; k < 5; k += 1) {
      w.abt.set(JB, rtf(`Nomor #0001# perubahan ABT ke-${k}.`));
      await w.sinkron();
    }
    const akhir = w.abt.get(JB)!;
    const sisa = await w.baca("SELECT md5 FROM aleta_abt_berkas_banding WHERE berkas_id = ? AND peran = 'beda'", [JB]);
    expect(sisa).toHaveLength(3);
    expect(sisa.map((x) => x.md5)).toContain(md5(akhir));
    expect((await w.baca("SELECT bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JB]))[0].bentrok_md5).toBe(md5(akhir));
    expect(await w.isiAleta(JB)).toBe(isiSunting);

    // ABT kembali persis seperti dasar ubahan: tidak ada beda lagi, pembanding dibuang.
    w.abt.set(JB, dasarB);
    await w.sinkron();
    expect((await w.baca("SELECT bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JB]))[0].bentrok_md5).toBe("");
    expect(await w.baca("SELECT id FROM aleta_abt_berkas_banding")).toEqual([]);
    expect(await w.isiAleta(JB)).toBe(isiSunting);
  });

  it("ABT berubah menjadi sama dengan isi ALETA ABT: bukan beda sungguhan, tidak ada yang disimpan", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102#.");
    w.abt.set(JB, await w.isiAleta(JB));
    const hasil = await w.sinkron();
    expect(hasil.berkas.bentrok).toBe(1);
    const b = (await w.baca("SELECT md5, md5_asal, bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JB]))[0];
    expect(b.bentrok_md5).toBe("");
    expect(b.md5_asal).toBe(b.md5);
    expect(await w.baca("SELECT id FROM aleta_abt_berkas_banding")).toEqual([]);
    expect((await ringkasanBeda(w.db)).menunggu).toBe(0);
  });

  it("disunting sementara sinkron berjalan: isi ALETA ABT tidak ditimpa, dicatat sebagai beda", async () => {
    const w = await dunia();
    await w.sinkron();
    w.abt.set(JA, rtf("Kalimat A diubah di ABT."));
    // Di tengah sinkron (sesudah rencana, sebelum menulis) blangko ditandai disunting.
    await w.dbUji.run("INSERT INTO aleta_abt_sinkron (id, status, oleh, mulai_at) VALUES ('tengah', 'jalan', 'Uji', '2026-11-05T12:00:00.000Z')");
    const jalan = jalankanSinkron(w.db, "tengah", {
      ambilPotret: async () => {
        const p = { server: "PA.Dgl", variabel: [], menu: [], berkas: [...w.abt.entries()].map(([jalur, isi]) => ({ jalur, folder: jalur.split("/")[0], nama: jalur.split("/")[1], arsip: false, md5: md5(isi), ukuran: isi.length, waktu: "", penanda: [] })) };
        return p as PotretAbt;
      },
      ambilIsi: async (jalur: string[]) => {
        await w.dbUji.run("UPDATE aleta_abt_berkas SET diubah = 1 WHERE id = ?", [JA]);
        return { berkas: jalur.map((j) => ({ jalur: j, md5: md5(w.abt.get(j)!), ukuran: 1, isi: Buffer.from(w.abt.get(j)!, "latin1").toString("base64") })) };
      },
      transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(w.db),
      kini: () => "2026-11-05T12:00:00.000Z",
    } as never);
    await jalan;
    const b = (await w.baca("SELECT diubah, isi, bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JA]))[0];
    expect(b.diubah).toBe(1);
    expect(String(b.isi)).toBe(rtf("Kalimat A versi satu."));
    expect(b.bentrok_md5).toBe(md5(rtf("Kalimat A diubah di ABT.")));
    expect((await w.baca("SELECT id FROM aleta_abt_berkas_banding")).map((x) => x.id)).toEqual([`${JA}|${md5(rtf("Kalimat A diubah di ABT."))}`]);
  });
});

describe("simulasi keadaan sinkron: hilang di ABT hanya ditandai", () => {
  it("tidak dihapus (juga yang disunting); kembali di ABT -> aktif lagi; muncul di daftar hilang", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JD, "Kalimat D disunting.");
    const sebelumC = await w.isiAleta(JC);
    const sebelumD = await w.isiAleta(JD);
    const cabut = (j: string) => w.abt.delete(j);
    const simpan = new Map([[JC, w.abt.get(JC)!], [JD, w.abt.get(JD)!]]);
    cabut(JC);
    cabut(JD);
    const hasil = await w.sinkron();
    expect(hasil.berkas.hilang).toBe(2);
    const baris = await w.baca("SELECT id, status, hilang_at, diubah FROM aleta_abt_berkas WHERE id IN (?, ?) ORDER BY id", [JC, JD]);
    expect(baris.map((x) => x.status)).toEqual(["hilang", "hilang"]);
    expect(await w.baca("SELECT id FROM aleta_abt_berkas")).toHaveLength(5);
    expect(await w.isiAleta(JC)).toBe(sebelumC);
    expect(await w.isiAleta(JD)).toBe(sebelumD);
    const r = await ringkasanBeda(w.db);
    expect(r.hilang).toBe(2);
    expect(r.daftarHilang.map((h) => h.id).sort()).toEqual([JC, JD]);
    expect(r.menunggu).toBe(0);
    // Diulang: tidak ditandai dua kali.
    expect((await w.sinkron()).berkas.hilang).toBe(0);
    // Kembali di ABT.
    w.abt.set(JC, simpan.get(JC)!);
    w.abt.set(JD, simpan.get(JD)!);
    const balik = await w.sinkron();
    expect(balik.berkas.kembali).toBe(2);
    expect((await w.baca("SELECT status FROM aleta_abt_berkas WHERE id = ?", [JD]))[0].status).toBe("aktif");
    expect(await w.isiAleta(JD)).toBe(sebelumD);
  });
});

describe("beda dengan ABT: lihat, tetap pakai ALETA ABT, atau ambil dari ABT", () => {
  it("lihat beda memakai pembanding Tahap 3 (isi ALETA ABT melawan isi ABT)", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102#.");
    const v2 = rtf("Nomor #0001# antara #0098# serta #0102#.");
    w.abt.set(JB, v2);
    await w.sinkron();
    const buka = await bukaBeda(w.db, JB);
    expect(buka).toMatchObject({ id: JB, md5Abt: md5(v2), md5Aleta: md5(await w.isiAleta(JB)), dapatDiambil: true, adaDraf: false });
    expect(buka.beda).not.toBeNull();
    expect(buka.beda!.samaBita).toBe(false);
    expect(buka.beda!.ringkas.ubah).toBe(1);
    const ubah = buka.beda!.baris.find((x) => x.k === "ubah") as { a: Array<{ t: string; d?: string }>; b: Array<{ t: string; d?: string }> };
    expect(ubah.a.some((p) => p.d === "hapus" && p.t.includes("dan"))).toBe(true);
    expect(ubah.b.some((p) => p.d === "tambah" && p.t.includes("serta"))).toBe(true);
    await expect(bukaBeda(w.db, JA)).rejects.toMatchObject({ status: 404 });
    await expect(bukaBeda(w.db, "tidak/ada.rtf")).rejects.toMatchObject({ status: 404 });
  });

  it("isi ABT belum tersimpan: tidak dapat diambil; sidik usang ditolak 409", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102#.");
    w.abt.set(JB, rtf("Nomor #0001# beda."));
    await w.sinkron();
    const buka = await bukaBeda(w.db, JB);
    await w.dbUji.run("DELETE FROM aleta_abt_berkas_banding");
    const tanpa = await bukaBeda(w.db, JB);
    expect(tanpa).toMatchObject({ beda: null, dapatDiambil: false });
    expect(tanpa.sebabTanpaBeda).toMatch(/Sinkron dari ABT/);
    await expect(putuskanBeda(w.db, AKTOR, { id: JB, pilihan: "ambil", md5Abt: buka.md5Abt, md5Aleta: buka.md5Aleta }, w.o as never)).rejects.toMatchObject({ status: 409 });
    // Sinkron lagi mengambil isi ABT kembali (banding hilang tetapi bentrok masih tercatat).
    await w.sinkron();
    expect(await w.baca("SELECT id FROM aleta_abt_berkas_banding")).toHaveLength(1);
    await expect(putuskanBeda(w.db, AKTOR, { id: JB, pilihan: "tetap", md5Abt: "usang", md5Aleta: buka.md5Aleta }, w.o as never)).rejects.toMatchObject({ status: 409 });
    await expect(putuskanBeda(w.db, AKTOR, { id: JB, pilihan: "tetap", md5Abt: buka.md5Abt, md5Aleta: "usang" }, w.o as never)).rejects.toMatchObject({ status: 409 });
    await expect(putuskanBeda(w.db, AKTOR, { id: JA, pilihan: "tetap", md5Abt: "x", md5Aleta: "y" }, w.o as never)).rejects.toMatchObject({ status: 409 });
    expect((await w.baca("SELECT bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JB]))[0].bentrok_md5).toBe(buka.md5Abt);
  });

  it("tetap pakai ALETA ABT: isi utuh, beda hilang dari daftar, ABT dicatat sebagai dasar; ABT berubah lagi -> muncul lagi", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102#.");
    const isiAleta = await w.isiAleta(JB);
    const v2 = rtf("Nomor #0001# versi ABT dua.");
    w.abt.set(JB, v2);
    await w.sinkron();
    const buka = await bukaBeda(w.db, JB);
    const h = await putuskanBeda(w.db, AKTOR, { id: JB, pilihan: "tetap", md5Abt: buka.md5Abt, md5Aleta: buka.md5Aleta }, w.o as never);
    expect(h).toMatchObject({ pilihan: "tetap" });
    expect(await w.isiAleta(JB)).toBe(isiAleta);
    const b = (await w.baca("SELECT diubah, md5_asal, bentrok_md5 FROM aleta_abt_berkas WHERE id = ?", [JB]))[0];
    expect(b).toMatchObject({ diubah: 1, md5_asal: md5(v2), bentrok_md5: "" });
    expect(await w.baca("SELECT peran, md5 FROM aleta_abt_berkas_banding")).toEqual([{ peran: "dasar", md5: md5(v2) }]);
    expect((await ringkasanBeda(w.db)).menunggu).toBe(0);
    // Sinkron berikutnya: ABT sama dengan dasar -> tidak muncul lagi.
    const lagi = await w.sinkron();
    expect(lagi.berkas.bentrok).toBe(0);
    expect((await ringkasanBeda(w.db)).menunggu).toBe(0);
    // ABT berubah lagi -> beda baru; dasar tetap disimpan.
    const v3 = rtf("Nomor #0001# versi ABT tiga.");
    w.abt.set(JB, v3);
    await w.sinkron();
    expect((await ringkasanBeda(w.db)).menunggu).toBe(1);
    expect((await w.baca("SELECT peran FROM aleta_abt_berkas_banding ORDER BY peran")).map((x) => x.peran)).toEqual(["beda", "dasar"]);
    expect(await w.isiAleta(JB)).toBe(isiAleta);
  });

  it("ambil dari ABT: isi ABT menjadi versi terbit, isi ALETA ABT tersimpan sebagai versi lama, blangko kembali ikut ABT otomatis", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102#.");
    const isiAleta = await w.isiAleta(JB);
    const v2 = rtf("Nomor #0001# antara #0098# #0102# versi ABT.");
    w.abt.set(JB, v2);
    await w.sinkron();
    const buka = await bukaBeda(w.db, JB);
    const h = await putuskanBeda(w.db, AKTOR, { id: JB, pilihan: "ambil", md5Abt: buka.md5Abt, md5Aleta: buka.md5Aleta }, w.o as never);
    expect(h).toMatchObject({ pilihan: "ambil", nomor: 3 });
    expect(await w.isiAleta(JB)).toBe(v2);
    const b = (await w.baca("SELECT diubah, md5, md5_asal, bentrok_md5, penanda_asal FROM aleta_abt_berkas WHERE id = ?", [JB]))[0];
    expect(b).toMatchObject({ diubah: 0, md5: md5(v2), md5_asal: md5(v2), bentrok_md5: "" });
    expect(JSON.parse(String(b.penanda_asal))).toEqual(["0001", "0098", "0102"]);
    const versi = await w.baca("SELECT nomor, status, jenis, md5, catatan FROM aleta_abt_berkas_versi WHERE berkas_id = ? ORDER BY nomor", [JB]);
    expect(versi.map((v) => [v.nomor, v.status, v.jenis])).toEqual([
      [1, "lama", "asal"],
      [2, "lama", "sunting"],
      [3, "terbit", "asal"],
    ]);
    expect(versi[1].md5).toBe(md5(isiAleta));
    expect(String(versi[2].catatan)).toBe("Dipilih dari ABT oleh Derry");
    expect(await w.baca("SELECT id FROM aleta_abt_berkas_banding")).toEqual([]);
    expect((await ringkasanBeda(w.db)).menunggu).toBe(0);
    // Isi ALETA ABT yang lama dapat dikembalikan lewat penyunting (bita persis).
    const lamaAleta = await bukaBlangko(w.db, JB, 2);
    expect(lamaAleta.versi.md5).toBe(md5(isiAleta));
    // Berubah di ABT lagi: kini diambil otomatis (belum disunting).
    const v3 = rtf("Nomor #0001# versi ABT tiga.");
    w.abt.set(JB, v3);
    const hasil = await w.sinkron();
    expect(hasil.berkas).toMatchObject({ berubah: 1, bentrok: 0 });
    expect(await w.isiAleta(JB)).toBe(v3);
  });
});

// ─── pembaca ZIP terpisah dari penulisnya ──────────────────────────────────────────────────────────────────────
function bacaZip(zip: Buffer): Map<string, Buffer> {
  const hasil = new Map<string, Buffer>();
  let akhir = zip.length - 22;
  while (akhir >= 0 && zip.readUInt32LE(akhir) !== 0x06054b50) akhir -= 1;
  expect(akhir).toBeGreaterThanOrEqual(0);
  const jumlah = zip.readUInt16LE(akhir + 10);
  let p = zip.readUInt32LE(akhir + 16);
  for (let i = 0; i < jumlah; i += 1) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const metode = zip.readUInt16LE(p + 10);
    const csize = zip.readUInt32LE(p + 20);
    const usize = zip.readUInt32LE(p + 24);
    const pn = zip.readUInt16LE(p + 28);
    const px = zip.readUInt16LE(p + 30);
    const pk = zip.readUInt16LE(p + 32);
    const lokal = zip.readUInt32LE(p + 42);
    const nama = zip.subarray(p + 46, p + 46 + pn).toString("utf8");
    expect(zip.readUInt32LE(lokal)).toBe(0x04034b50);
    const mulai = lokal + 30 + zip.readUInt16LE(lokal + 26) + zip.readUInt16LE(lokal + 28);
    const data = zip.subarray(mulai, mulai + csize);
    const isi = metode === 8 ? inflateRawSync(data) : Buffer.from(data);
    expect(isi.length).toBe(usize);
    hasil.set(nama, isi);
    p += 46 + pn + px + pk;
  }
  return hasil;
}

describe("ekspor ubahan sebagai paket ABT", () => {
  it("isi paket benar: tambalan atas isi dasar ABT menghasilkan isi ALETA ABT persis; sidik cocok; tanpa nama aplikasi", async () => {
    const w = await dunia();
    await w.sinkron();
    const dasarD = w.abt.get(JD)!;
    await w.sunting(JD, "Kalimat D disunting oleh Super Admin dengan tambahan yang cukup panjang.");
    const baruD = await w.isiAleta(JD);
    const daftar = await daftarEkspor(w.db);
    expect(daftar.siap.map((s) => s.id)).toEqual([JD]);
    expect(daftar.siap[0]).toMatchObject({ nama: "[02] D disunting aman", folder: "2 Itsbat Nikah" });
    expect(daftar.tidakSiap).toEqual([]);

    const kini = new Date("2026-11-06T02:00:00.000Z");
    const paket = await buatPaketEkspor(w.db, undefined, kini);
    expect(paket.nama).toBe("abt-ubahan-20261106");
    expect(paket).toMatchObject({ berkas: 1, tidakSiap: [] });
    const f = bacaZip(paket.zip);
    expect([...f.keys()].sort()).toEqual(
      [
        "abt-ubahan-20261106/PASANG.md",
        "abt-ubahan-20261106/paket-satker/MD5SUMS.txt",
        "abt-ubahan-20261106/paket-satker/daftar-tambal.tsv",
        "abt-ubahan-20261106/paket-satker/pasang-satker.sh",
        "abt-ubahan-20261106/paket-satker/pulih-satker.sh",
        "abt-ubahan-20261106/paket-satker/tambal.tsv",
        "abt-ubahan-20261106/paket-satker/tambal_rtf.py",
      ].sort()
    );
    const di = (n: string) => f.get(`abt-ubahan-20261106/${n}`)!;
    // MD5SUMS cocok dengan isi tiap berkas.
    for (const baris of di("paket-satker/MD5SUMS.txt").toString("utf8").trim().split("\n")) {
      const [sidik, nama] = baris.split(" *");
      expect(md5(di(`paket-satker/${nama}`)), nama).toBe(sidik);
    }
    // daftar-tambal: berkas, md5 lama = dasar ABT, md5 baru = isi ALETA ABT.
    const barisDaftar = di("paket-satker/daftar-tambal.tsv").toString("utf8").trim().split("\n").filter((l) => !l.startsWith("#"));
    expect(barisDaftar).toHaveLength(1);
    const [kode, berkas, md5Lama, md5Baru, jumlah] = barisDaftar[0].split("\t");
    expect([kode, berkas, md5Lama, md5Baru]).toEqual(["U0001", `derry_briantono/${JD}`, md5(dasarD), md5(baruD)]);
    // tambal.tsv diterapkan kembali (cara yang sama dengan tambal_rtf.py) -> isi baru persis.
    const potongan = di("paket-satker/tambal.tsv")
      .toString("ascii")
      .trim()
      .split("\n")
      .filter((l) => !l.startsWith("#"))
      .map((l) => {
        const [k, off, lama, baru] = l.split("\t");
        expect(k).toBe("U0001");
        return { offset: Number(off), lama: Buffer.from(lama, "base64"), baru: Buffer.from(baru, "base64") };
      });
    expect(potongan).toHaveLength(Number(jumlah));
    const hasil = terapkanTambalan(Buffer.from(dasarD, "latin1"), potongan);
    expect(hasil && hasil.toString("latin1")).toBe(baruD);
    expect(md5(hasil!)).toBe(md5Baru);
    // Tambalan yang sama pada isi lain (ABT berbeda dari dasar) tertolak: penjaga pemasangan.
    expect(terapkanTambalan(Buffer.from(rtf("Kalimat D digeser di ABT."), "latin1"), potongan)).toBeNull();
    // Pemasang = salinan persis berkas paket yang sudah dipakai.
    expect(di("paket-satker/tambal_rtf.py").toString("utf8")).toBe(TAMBAL_RTF_PY);
    // Skrip dan petunjuk: LF, tanpa nama aplikasi (semua berkas teks kecuali base64 tambal.tsv).
    for (const [nama, isi] of f) {
      if (nama.endsWith("/tambal.tsv")) continue;
      expect(isi.toString("utf8"), nama).not.toMatch(/aleta/i);
      expect(isi.includes(13), `${nama} CRLF`).toBe(false);
    }
    expect(di("PASANG.md").toString("utf8")).toMatch(/HANYA BERKAS\. Belum dipasang/);
    expect(di("paket-satker/pasang-satker.sh").toString("utf8")).toContain("N=abt-ubahan-20261106");
    expect(di("paket-satker/pasang-satker.sh").toString("utf8")).toContain('tr -d \'\\r\'');
    // Tidak ada yang berubah di pustaka karena ekspor.
    expect(await w.isiAleta(JD)).toBe(baruD);
    expect((await w.baca("SELECT diubah FROM aleta_abt_berkas WHERE id = ?", [JD]))[0].diubah).toBe(1);
  });

  it("yang belum siap disebut sebabnya: beda belum dipilih, memuat nama aplikasi, hilang di ABT, dasar tidak tersimpan; kosong -> 409", async () => {
    const w = await dunia();
    await w.sinkron();
    await expect(buatPaketEkspor(w.db)).rejects.toMatchObject({ status: 409 });
    await w.sunting(JD, "Kalimat D disunting.");
    await w.sunting(JE, "Kalimat E menyebut nama Aleta di dalam isi.");
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102#.");
    await w.sunting(JC, "Kalimat C disunting lalu hilang.");
    w.abt.set(JB, rtf("Nomor #0001# beda di ABT."));
    w.abt.delete(JC);
    await w.sinkron();
    const d = await daftarEkspor(w.db);
    expect(d.siap.map((s) => s.id)).toEqual([JD]);
    const sebab = new Map(d.tidakSiap.map((t) => [t.id, t.sebab]));
    expect(sebab.get(JB)).toMatch(/Beda dengan ABT/);
    expect(sebab.get(JE)).toMatch(/nama aplikasi/);
    expect(sebab.get(JC)).toMatch(/tidak ada lagi di ABT/);
    // Paket hanya memuat yang siap.
    const paket = await buatPaketEkspor(w.db, undefined, new Date("2026-11-06T02:00:00.000Z"));
    expect(paket.berkas).toBe(1);
    expect(paket.tidakSiap).toHaveLength(3);
    const daftarTsv = bacaZip(paket.zip).get("abt-ubahan-20261106/paket-satker/daftar-tambal.tsv")!.toString("utf8");
    expect(daftarTsv).toContain(JD);
    expect(daftarTsv).not.toContain(JE);
    expect(daftarTsv).not.toContain(JB);
    // Satu blangko saja yang diminta tetapi belum siap: 409.
    await expect(buatPaketEkspor(w.db, [JE])).rejects.toBeInstanceOf(ApiError);
  });

  it("sesudah memilih tetap pakai ALETA ABT, blangko yang tadinya beda ikut paket dengan ABT terbaru sebagai dasar; dasar hilang -> tidak siap", async () => {
    const w = await dunia();
    await w.sinkron();
    await w.sunting(JB, "Nomor #0001# antara #0098# dan #0102# (ubahan).");
    const baruB = await w.isiAleta(JB);
    const v2 = rtf("Nomor #0001# antara #0098# melawan #0102#. Tambahan di ABT.");
    w.abt.set(JB, v2);
    await w.sinkron();
    const buka = await bukaBeda(w.db, JB);
    await putuskanBeda(w.db, AKTOR, { id: JB, pilihan: "tetap", md5Abt: buka.md5Abt, md5Aleta: buka.md5Aleta }, w.o as never);
    const d = await daftarEkspor(w.db);
    expect(d.siap.map((s) => s.id)).toEqual([JB]);
    const paket = await buatPaketEkspor(w.db, [JB], new Date("2026-11-06T02:00:00.000Z"));
    const f = bacaZip(paket.zip);
    const baris = f.get("abt-ubahan-20261106/paket-satker/daftar-tambal.tsv")!.toString("utf8").trim().split("\n").filter((l) => !l.startsWith("#"))[0].split("\t");
    expect(baris[2]).toBe(md5(v2));
    expect(baris[3]).toBe(md5(baruB));
    const potongan = f
      .get("abt-ubahan-20261106/paket-satker/tambal.tsv")!
      .toString("ascii")
      .trim()
      .split("\n")
      .filter((l) => !l.startsWith("#"))
      .map((l) => {
        const [, off, lama, baru] = l.split("\t");
        return { offset: Number(off), lama: Buffer.from(lama, "base64"), baru: Buffer.from(baru, "base64") };
      });
    expect(terapkanTambalan(Buffer.from(v2, "latin1"), potongan)!.toString("latin1")).toBe(baruB);
    // Dasar ABT yang dipertahankan hilang dari pembanding: tidak ditebak.
    await w.dbUji.run("DELETE FROM aleta_abt_berkas_banding");
    const lagi = await daftarEkspor(w.db);
    expect(lagi.siap).toEqual([]);
    expect(lagi.tidakSiap[0].sebab).toMatch(/dasar ubahan ini tidak tersimpan/);
  });

  it("pemasang di paket sama persis dengan berkas paket ABT yang sudah dipakai (tidak melenceng)", () => {
    const asli = readFileSync(path.join(M, "..", "abt-paket", "audit-ejaan-4nov", "paket-satker", "tambal_rtf.py"), "utf8");
    expect(TAMBAL_RTF_PY).toBe(asli);
  });
});

describe("sinkron terjadwal (detak 5 menit, sekali per tanggal)", () => {
  // 2026-11-05 23:10 WITA = 15:10 UTC; 08:10 WITA = 00:10 UTC; 09:00 WITA = 01:00 UTC
  const WITA = (tanggal: string, jam: string) => new Date(`${tanggal}T${jam}:00+08:00`);

  it("bawaan mati: detak tidak membaca ABT sama sekali", async () => {
    const { db } = await siapkan();
    const mulai: string[] = [];
    const h = await detakSinkronAbt(db, { kini: WITA("2026-11-05", "23:30"), env: {}, mulai: async (_d, oleh) => void mulai.push(oleh) });
    expect(h).toBe("mati");
    expect(mulai).toEqual([]);
  });

  it("menyala: belum jam -> belum; sesudah jam -> jalan sekali; detak berikutnya hari yang sama -> sudah; hari berikutnya -> jalan lagi", async () => {
    const { db, baca } = await siapkan();
    const mulai: string[] = [];
    const opsi = (jam: string, tanggal = "2026-11-05") => ({ kini: WITA(tanggal, jam), env: {}, mulai: async (_d: unknown, oleh: string) => void mulai.push(oleh) });
    await simpanSetelanSinkronAbt(db, AKTOR, { jadwal: true }, { kini: () => "2026-11-05T01:00:00.000Z" });
    expect(await detakSinkronAbt(db, opsi("22:00"))).toBe("belum");
    expect(await detakSinkronAbt(db, opsi("23:05"))).toBe("jalan");
    expect(mulai).toEqual(["Jadwal otomatis"]);
    expect(await detakSinkronAbt(db, opsi("23:10"))).toBe("sudah");
    expect(await detakSinkronAbt(db, opsi("23:55"))).toBe("sudah");
    expect(mulai).toHaveLength(1);
    expect(await detakSinkronAbt(db, opsi("23:05", "2026-11-06"))).toBe("jalan");
    expect(mulai).toHaveLength(2);
    expect(JSON.parse(String((await baca("SELECT nilai FROM aleta_ekstensi_setelan WHERE kunci = ?", [KUNCI_SETELAN_SINKRON_ABT]))[0].nilai))).toMatchObject({ jadwal: true, jam: "23:00", izinJamKerja: false, diubahOleh: "Derry" });
  });

  it("tidak jalan pada jam kerja sidang tanpa izin; jam kerja ditolak saat menyimpan; dengan izin boleh", async () => {
    const { db } = await siapkan();
    const mulai: string[] = [];
    const opsi = (jam: string, tanggal = "2026-11-06") => ({ kini: WITA(tanggal, jam), env: {}, mulai: async (_d: unknown, oleh: string) => void mulai.push(oleh) });
    await expect(simpanSetelanSinkronAbt(db, AKTOR, { jadwal: true, jam: "09:00" })).rejects.toMatchObject({ status: 422 });
    await simpanSetelanSinkronAbt(db, AKTOR, { jadwal: true, jam: "00:30" });
    // Server baru menyala pagi: lewat jam 00:30 tetapi di jam kerja sidang -> menunggu malam.
    expect(await detakSinkronAbt(db, opsi("08:10"))).toBe("jam-kerja");
    expect(mulai).toEqual([]);
    expect(await detakSinkronAbt(db, opsi("17:05"))).toBe("jalan");
    const kedua = await siapkan();
    await simpanSetelanSinkronAbt(kedua.db, AKTOR, { jadwal: true, jam: "09:00", izinJamKerja: true });
    expect(await detakSinkronAbt(kedua.db, { kini: WITA("2026-11-06", "09:05"), env: {}, mulai: async () => undefined })).toBe("jalan");
  });

  it("sedang berjalan (409): dicoba lagi pada detak berikutnya tanpa mencatat tanggal; gagal lain dicatat sekali; env mematikan", async () => {
    const { db } = await siapkan();
    await simpanSetelanSinkronAbt(db, AKTOR, { jadwal: true });
    let panggil = 0;
    const sibuk = async () => {
      panggil += 1;
      throw new ApiError(409, "Sinkron dari ABT sedang berjalan.");
    };
    expect(await detakSinkronAbt(db, { kini: WITA("2026-11-05", "23:05"), env: {}, mulai: sibuk })).toBe("sibuk");
    expect(await detakSinkronAbt(db, { kini: WITA("2026-11-05", "23:10"), env: {}, mulai: sibuk })).toBe("sibuk");
    expect(panggil).toBe(2);
    const rusak = async () => {
      panggil += 1;
      throw new Error("bot mati");
    };
    expect(await detakSinkronAbt(db, { kini: WITA("2026-11-05", "23:15"), env: {}, mulai: rusak })).toBe("gagal");
    expect(await detakSinkronAbt(db, { kini: WITA("2026-11-05", "23:20"), env: {}, mulai: rusak })).toBe("sudah");
    expect(panggil).toBe(3);
    expect(await detakSinkronAbt(db, { kini: WITA("2026-11-06", "23:20"), env: { ALETA_ABT_SINKRON: "0" }, mulai: rusak })).toBe("dimatikan");
    expect(panggil).toBe(3);
  });
});
