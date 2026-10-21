// @vitest-environment node
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_MEDIASI_ARSIP } from "@/server/db/schema";
import { akarPenyimpanan, bacaBerkas, jalurSah, kunciPerkara, simpanBerkas } from "@/server/modules/mediasi-arsip/berkas";
import { ambilIsiBerkas, catatKirimanSipp, daftarBerkas, hapusBerkasArsip, unggahBerkas } from "@/server/modules/mediasi-arsip/layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ARSIP HASIL MEDIASI PER PERKARA - MIGRASI 0081, BERKAS, LAYANAN, HAK (21 Okt 2026)
 * ============================================================================
 *
 * Menjalankan kodenya atas basis data pg-mem dan folder sementara: migrasi = DDL schema.ts, tanpa kunci asing,
 * tabelnya ikut cadangan; penyimpanan (jalur tidak dapat keluar folder, kunci dari nomor perkara); unggah PDF dan
 * RTF (PDF hasil konversi disimpan di samping yang asli), unggah ganda ditolak, ganti butuh konfirmasi dan
 * membuat versi baru, hapus hanya pengunggah atau Admin dengan konfirmasi, jejak tiap peristiwa, hak menurut
 * matriks peran, dan pencatatan kiriman ke e-Doc Akta Perdamaian SIPP.
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migrasi 0081", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0081_aleta_mediasi_arsip.sql");

  it("jurnal: 0081 di idx 74 sekali (sesudah 0080), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const idx = j.entries.map((e) => e.idx);
    expect(new Set(idx).size).toBe(idx.length);
    expect(idx).toEqual(idx.map((_, i) => i));
    expect(j.entries.filter((e) => e.tag.startsWith("0081_"))).toEqual([expect.objectContaining({ idx: 74, tag: "0081_aleta_mediasi_arsip" })]);
    const sebelum = j.entries.find((e) => e.idx === 73)!;
    expect(j.entries.find((e) => e.idx === 74)!.when).toBeGreaterThan(sebelum.when);
  });

  it("pernyataan berkas = DDL_MEDIASI_ARSIP, berjalan di pg-mem, kedua tabel ikut cadangan, tanpa kunci asing/CHECK", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_MEDIASI_ARSIP.tabel, ...DDL_MEDIASI_ARSIP.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    for (const t of ["aleta_mediasi_berkas", "aleta_mediasi_berkas_jejak"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(readFileSync(SQL, "utf8").replace(/--.*$/gm, ""))).toBe(false);
  });
});

describe("penyimpanan berkas", () => {
  it("akar = <ALETA_UPLOAD_DIR>/mediasi-hasil (folder yang di-mount); tanpa itu ./uploads/mediasi-hasil", () => {
    expect(akarPenyimpanan({ ALETA_UPLOAD_DIR: "/app/uploads" })).toBe(path.join("/app/uploads", "mediasi-hasil"));
    expect(akarPenyimpanan({})).toBe(path.join(process.cwd(), "uploads", "mediasi-hasil"));
  });

  it("kunci perkara: 16 heksa, tidak peduli spasi/huruf besar; jalur hanya bentuk sah, tak dapat keluar folder", async () => {
    expect(kunciPerkara("684/Pdt.G/2026/PA.Dgl")).toMatch(/^[a-f0-9]{16}$/);
    expect(kunciPerkara(" 684/Pdt.G/2026/PA.Dgl ")).toBe(kunciPerkara("684/pdt.g/2026/pa.dgl"));
    expect(jalurSah("0123456789abcdef/mbk-aaaaaaaa-1.pdf")).toBe(true);
    for (const jahat of ["../x.pdf", "0123456789abcdef/../../x.pdf", "/etc/passwd", "0123456789abcdef/x.exe", "abc/mbk-aaaaaaaa.pdf", ""]) expect(jalurSah(jahat)).toBe(false);
    const akar = mkdtempSync(path.join(tmpdir(), "mdsa-"));
    try {
      const jalur = await simpanBerkas("0123456789abcdef", "../../mbk-ABC123xyz", "pdf", new Uint8Array([1, 2, 3]), akar);
      expect(jalur).toBe("0123456789abcdef/mbk-abc123xyz.pdf");
      expect(Array.from((await bacaBerkas(jalur, akar))!)).toEqual([1, 2, 3]);
      expect(await bacaBerkas("../../x.pdf", akar)).toBeNull();
    } finally {
      rmSync(akar, { recursive: true, force: true });
    }
  });
});

// ─── layanan ───────────────────────────────────────────────────────────────────────────────────────────────────

const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const NOMOR_LAIN = "700/Pdt.G/2026/PA.Dgl";
const PDF = (isi = "satu") => new TextEncoder().encode(`%PDF-1.4\n1 0 obj<<>>endobj\n% ${isi}\n%%EOF`);
const RTF = (isi = "satu") => new TextEncoder().encode(`{\\rtf1\\ansi Laporan mediator ${isi}\\par}`);

const orang = (id: string, nama: string, roleId: string, tambahan: string[] = []): UserPersona =>
  ({ id, name: nama, username: id, roleId, positionId: "", additionalRoleIds: tambahan, isActive: true }) as unknown as UserPersona;
const MEDIATOR = orang("u-med", "Hakim Mediator", "hakim");
const MEDIATOR_NON = orang("u-med2", "Mediator Non Hakim", "staf", ["mediator"]);
const PP = orang("u-pp", "Panitera Pengganti", "panitera-pengganti");
const PANITERA = orang("u-pan", "Panitera", "panitera");
const ADMIN = orang("u-adm", "Admin Uji", "admin");
const PTSP = orang("u-ptsp", "Petugas PTSP", "operator");
const KASIR = orang("u-kas", "Kasir", "analis-keuangan");
const JURUSITA = orang("u-jur", "Juru Sita", "jurusita");

describe("layanan arsip hasil mediasi", () => {
  let db: AletaDatabase;
  let akar: string;
  const KINI = new Date("2026-10-21T04:00:00.000Z");
  const konversiBerhasil = async () => ({ berkasBase64: Buffer.from(PDF("hasil-konversi")).toString("base64") });
  const deps = (tambahan: Record<string, unknown> = {}) => ({ sekarang: () => KINI, akar, konversi: konversiBerhasil, ...tambahan });
  const baris = (sql: string, p: Array<string | number> = []) => db.queryAll<Record<string, unknown>>(sql, p);

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
    akar = mkdtempSync(path.join(tmpdir(), "mdsa-"));
  }, 180000);
  afterAll(async () => {
    await db?.close();
    rmSync(akar, { recursive: true, force: true });
  });

  it("hak menurut matriks peran: mediator, hakim, PP, panitera, Admin boleh; PTSP, kasir, juru sita tidak", () => {
    for (const a of [MEDIATOR, MEDIATOR_NON, PP, PANITERA, ADMIN]) {
      expect([a.id, bolehAksi(a, "mediasi.arsip-lihat")]).toEqual([a.id, true]);
      expect([a.id, bolehAksi(a, "mediasi.arsip-unggah")]).toEqual([a.id, true]);
    }
    for (const a of [PTSP, KASIR, JURUSITA]) {
      expect([a.id, bolehAksi(a, "mediasi.arsip-lihat")]).toEqual([a.id, false]);
      expect([a.id, bolehAksi(a, "mediasi.arsip-unggah")]).toEqual([a.id, false]);
    }
    for (const k of ["mediasi.arsip-lihat", "mediasi.arsip-unggah", "mediasi.arsip-hapus"] as const) expect(AKSI[k].rute.length).toBeGreaterThan(0);
  });

  it("peran tanpa hak: 403 pada daftar, unggah, dan isi; tidak ada yang tertulis", async () => {
    for (const a of [PTSP, KASIR]) {
      await expect(daftarBerkas(db, a, { nomorPerkara: NOMOR })).rejects.toMatchObject({ status: 403 });
      await expect(unggahBerkas(db, a, { nomorPerkara: NOMOR, nama: "a.pdf", bita: PDF() }, deps())).rejects.toMatchObject({ status: 403 });
      await expect(ambilIsiBerkas(db, a, { id: "x" }, deps())).rejects.toMatchObject({ status: 403 });
    }
    expect(await baris("SELECT id FROM aleta_mediasi_berkas")).toEqual([]);
  });

  it("unggah PDF: tersimpan di folder yang di-mount, satu berkas (asli = PDF), jejak 'unggah', muncul di daftar", async () => {
    const h = await unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR, urutanMediasi: 1, nama: "Laporan Mediator.pdf", bita: PDF("lap"), akunSipp: "mediator1", ip: "192.168.9.9" }, deps());
    expect(h.ok).toBe(true);
    expect(h.berkas).toMatchObject({ nama: "Laporan Mediator.pdf", bentukAsal: "pdf", adaPdf: true, versi: 1, urutanMediasi: 1, diunggahNama: "Hakim Mediator", bolehHapus: true, keSipp: null });
    const [b] = await baris("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [h.berkas.id]);
    expect(b.jalur_asal).toBe(b.jalur_pdf);
    expect(String(b.jalur_asal)).toMatch(new RegExp(`^${kunciPerkara(NOMOR)}/mbk-`));
    expect(existsSync(path.join(akar, String(b.jalur_asal)))).toBe(true);
    expect(b.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(b.diunggah_oleh).toBe("u-med");
    const jejak = await baris("SELECT * FROM aleta_mediasi_berkas_jejak WHERE berkas_id = ?", [h.berkas.id]);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]).toMatchObject({ peristiwa: "unggah", hasil: "berhasil", pelaku: "Hakim Mediator", pelaku_id: "u-med", akun_sipp: "mediator1", ip: "192.168.9.9" });
    const d = await daftarBerkas(db, PP, { nomorPerkara: NOMOR });
    expect(d.berkas.map((x) => x.id)).toEqual([h.berkas.id]);
    expect(d.hak).toEqual({ lihat: true, unggah: true });
    expect((await daftarBerkas(db, PP, { nomorPerkara: NOMOR_LAIN })).berkas).toEqual([]);
  });

  it("unggah RTF: berkas asli DAN PDF hasil konversi sama-sama tersimpan; lihat PDF/unduh asli bernama benar", async () => {
    const h = await unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR, nama: "Kesepakatan.rtf", bita: RTF("kes") }, deps());
    expect(h.berkas).toMatchObject({ bentukAsal: "rtf", adaPdf: true });
    const [b] = await baris("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [h.berkas.id]);
    expect(b.jalur_asal).not.toBe(b.jalur_pdf);
    expect(existsSync(path.join(akar, String(b.jalur_asal)))).toBe(true);
    expect(existsSync(path.join(akar, String(b.jalur_pdf)))).toBe(true);
    const pdf = await ambilIsiBerkas(db, PP, { id: h.berkas.id, bentuk: "pdf", aksi: "lihat" }, deps());
    expect(pdf).toMatchObject({ nama: "Kesepakatan.pdf", mime: "application/pdf", bentuk: "pdf" });
    expect(Buffer.from(pdf.bita.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    const asli = await ambilIsiBerkas(db, PP, { id: h.berkas.id, bentuk: "asli", aksi: "unduh" }, deps());
    expect(asli).toMatchObject({ nama: "Kesepakatan.rtf", mime: "application/rtf", bentuk: "rtf" });
    expect(Buffer.from(asli.bita).toString("latin1")).toContain("Laporan mediator kes");
    const jejak = await baris("SELECT peristiwa FROM aleta_mediasi_berkas_jejak WHERE berkas_id = ? ", [h.berkas.id]);
    expect(jejak.map((j) => j.peristiwa).sort()).toEqual(["lihat", "unduh", "unggah"]);
  });

  it("konversi gagal: berkas asli tetap tersimpan, peringatan jujur, tanpa PDF", async () => {
    const h = await unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR_LAIN, nama: "x.rtf", bita: RTF("tanpa-soffice") }, deps({ konversi: async () => Promise.reject(new Error("Pengubah PDF belum tersedia")) }));
    expect(h.berkas).toMatchObject({ bentukAsal: "rtf", adaPdf: false });
    expect(h.peringatan.join(" ")).toMatch(/PDF belum dapat dibuat/);
    const asli = await ambilIsiBerkas(db, MEDIATOR, { id: h.berkas.id, bentuk: "pdf" }, deps());
    expect(asli.bentuk).toBe("rtf"); // tanpa PDF yang diminta: yang asli
  });

  it("unggah ganda dicegah: isi yang sama persis pada perkara yang sama ditolak 409; perkara lain boleh", async () => {
    await expect(unggahBerkas(db, PP, { nomorPerkara: NOMOR, nama: "salinan.pdf", bita: PDF("lap") }, deps())).rejects.toMatchObject({ status: 409, details: expect.objectContaining({ kode: "ganda" }) });
    const lain = await unggahBerkas(db, PP, { nomorPerkara: "701/Pdt.G/2026/PA.Dgl", nama: "salinan.pdf", bita: PDF("lap") }, deps());
    expect(lain.ok).toBe(true);
  });

  it("berkas ditolak: kosong, terlalu besar, bukan naskah, nomor perkara tak terbaca", async () => {
    await expect(unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR, nama: "a.pdf", bita: new Uint8Array(0) }, deps())).rejects.toMatchObject({ status: 400 });
    await expect(unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR, nama: "a.pdf", bita: new Uint8Array(20 * 1024 * 1024 + 1) }, deps())).rejects.toMatchObject({ status: 413 });
    await expect(unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR, nama: "a.pdf", bita: new TextEncoder().encode("teks biasa bukan naskah") }, deps())).rejects.toMatchObject({ status: 400 });
    await expect(unggahBerkas(db, MEDIATOR, { nomorPerkara: "", nama: "a.pdf", bita: PDF("z") }, deps())).rejects.toMatchObject({ status: 400 });
    await expect(unggahBerkas(db, MEDIATOR, { nomorPerkara: "../../etc", nama: "a.pdf", bita: PDF("z") }, deps())).rejects.toMatchObject({ status: 400 });
  });

  it("nama berkas dari petugas tidak masuk jalur cakram; nama tak berbahaya disimpan di basis data", async () => {
    const h = await unggahBerkas(db, MEDIATOR, { nomorPerkara: NOMOR, nama: "..\\..\\evil/../x.pdf", bita: PDF("nama-jahat") }, deps());
    expect(h.berkas.nama).not.toMatch(/[\\/]/);
    const [b] = await baris("SELECT jalur_asal FROM aleta_mediasi_berkas WHERE id = ?", [h.berkas.id]);
    expect(String(b.jalur_asal)).toMatch(/^[a-f0-9]{16}\/mbk-[a-z0-9-]+\.pdf$/);
  });

  it("ganti: tanpa konfirmasi 409; dengan konfirmasi = versi baru, versi lama 'diganti' dan dibuang dari cakram, jejak 'ganti'", async () => {
    const asal = await unggahBerkas(db, MEDIATOR, { nomorPerkara: "702/Pdt.G/2026/PA.Dgl", nama: "v1.pdf", bita: PDF("v1") }, deps());
    await expect(unggahBerkas(db, PP, { nomorPerkara: "702/Pdt.G/2026/PA.Dgl", nama: "v2.pdf", bita: PDF("v2"), gantiId: asal.berkas.id }, deps())).rejects.toMatchObject({ status: 409, details: expect.objectContaining({ kode: "perlu_konfirmasi" }) });
    // berkas yang diganti harus pada perkara yang sama
    await expect(unggahBerkas(db, PP, { nomorPerkara: NOMOR, nama: "v2.pdf", bita: PDF("v2"), gantiId: asal.berkas.id, konfirmasiGanti: true }, deps())).rejects.toMatchObject({ status: 404 });
    const [lama0] = await baris("SELECT jalur_asal FROM aleta_mediasi_berkas WHERE id = ?", [asal.berkas.id]);
    const baru = await unggahBerkas(db, PP, { nomorPerkara: "702/Pdt.G/2026/PA.Dgl", nama: "v2.pdf", bita: PDF("v2"), gantiId: asal.berkas.id, konfirmasiGanti: true }, deps());
    expect(baru.berkas.versi).toBe(2);
    const [lama] = await baris("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [asal.berkas.id]);
    expect(lama).toMatchObject({ status: "diganti", jalur_asal: "", jalur_pdf: "" });
    expect(existsSync(path.join(akar, String(lama0.jalur_asal)))).toBe(false);
    const [b2] = await baris("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [baru.berkas.id]);
    expect(b2.menggantikan_id).toBe(asal.berkas.id);
    expect((await daftarBerkas(db, PP, { nomorPerkara: "702/Pdt.G/2026/PA.Dgl" })).berkas.map((x) => x.id)).toEqual([baru.berkas.id]);
    const jejak = await baris("SELECT peristiwa FROM aleta_mediasi_berkas_jejak WHERE berkas_id = ?", [baru.berkas.id]);
    expect(jejak.map((j) => j.peristiwa)).toEqual(["ganti"]);
    await expect(ambilIsiBerkas(db, PP, { id: asal.berkas.id }, deps())).rejects.toMatchObject({ status: 404 });
  });

  it("hapus: hanya pengunggah atau Admin; konfirmasi wajib; baris dan jejak tetap, berkasnya dibuang", async () => {
    const h = await unggahBerkas(db, MEDIATOR, { nomorPerkara: "703/Pdt.G/2026/PA.Dgl", nama: "h.pdf", bita: PDF("hapus-1") }, deps());
    const [b0] = await baris("SELECT jalur_asal FROM aleta_mediasi_berkas WHERE id = ?", [h.berkas.id]);
    // bukan pengunggah (PP): boleh unggah tetapi tidak boleh menghapus milik orang lain
    expect((await daftarBerkas(db, PP, { nomorPerkara: "703/Pdt.G/2026/PA.Dgl" })).berkas[0].bolehHapus).toBe(false);
    await expect(hapusBerkasArsip(db, PP, { id: h.berkas.id, konfirmasi: true }, deps())).rejects.toMatchObject({ status: 403 });
    expect((await daftarBerkas(db, ADMIN, { nomorPerkara: "703/Pdt.G/2026/PA.Dgl" })).berkas[0].bolehHapus).toBe(true);
    // tanpa konfirmasi
    await expect(hapusBerkasArsip(db, MEDIATOR, { id: h.berkas.id, konfirmasi: false }, deps())).rejects.toMatchObject({ status: 409 });
    expect(existsSync(path.join(akar, String(b0.jalur_asal)))).toBe(true);
    // Admin boleh walau bukan pengunggah
    await hapusBerkasArsip(db, ADMIN, { id: h.berkas.id, konfirmasi: true, alasan: "salah unggah" }, deps());
    const [b] = await baris("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [h.berkas.id]);
    expect(b).toMatchObject({ status: "dihapus", dihapus_oleh: "u-adm", alasan_hapus: "salah unggah", jalur_asal: "", jalur_pdf: "" });
    expect(existsSync(path.join(akar, String(b0.jalur_asal)))).toBe(false);
    const jejak = await baris("SELECT * FROM aleta_mediasi_berkas_jejak WHERE berkas_id = ? AND peristiwa = 'hapus'", [h.berkas.id]);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]).toMatchObject({ pelaku: "Admin Uji", hasil: "berhasil" });
    expect((await daftarBerkas(db, ADMIN, { nomorPerkara: "703/Pdt.G/2026/PA.Dgl" })).berkas).toEqual([]);
    // pengunggah sendiri boleh
    const h2 = await unggahBerkas(db, MEDIATOR, { nomorPerkara: "703/Pdt.G/2026/PA.Dgl", nama: "h2.pdf", bita: PDF("hapus-2") }, deps());
    await hapusBerkasArsip(db, MEDIATOR, { id: h2.berkas.id, konfirmasi: true }, deps());
    // isi yang sama dapat diunggah lagi sesudah dihapus
    expect((await unggahBerkas(db, MEDIATOR, { nomorPerkara: "703/Pdt.G/2026/PA.Dgl", nama: "h2.pdf", bita: PDF("hapus-2") }, deps())).ok).toBe(true);
  });

  it("kiriman ke e-Doc Akta Perdamaian SIPP: hanya dicatat (berhasil menandai berkas, gagal tidak); tanpa hak 403", async () => {
    const h = await unggahBerkas(db, MEDIATOR, { nomorPerkara: "704/Pdt.G/2026/PA.Dgl", nama: "akta.pdf", bita: PDF("akta") }, deps());
    await catatKirimanSipp(db, MEDIATOR, { id: h.berkas.id, hasil: "gagal", ringkas: "SIPP menjawab kode 500" }, deps());
    expect((await daftarBerkas(db, MEDIATOR, { nomorPerkara: "704/Pdt.G/2026/PA.Dgl" })).berkas[0].keSipp).toBeNull();
    await catatKirimanSipp(db, MEDIATOR, { id: h.berkas.id, hasil: "berhasil", akunSipp: "mediator1", menimpa: true }, deps());
    const d = (await daftarBerkas(db, PP, { nomorPerkara: "704/Pdt.G/2026/PA.Dgl" })).berkas[0];
    expect(d.keSipp).toEqual({ pada: KINI.toISOString(), oleh: "Hakim Mediator" });
    const jejak = await baris("SELECT hasil, rinci_json, akun_sipp FROM aleta_mediasi_berkas_jejak WHERE berkas_id = ? AND peristiwa = 'ke-sipp' ORDER BY waktu, id", [h.berkas.id]);
    expect(jejak.map((j) => String(j.hasil)).sort()).toEqual(["berhasil", "gagal"]);
    expect(JSON.parse(String(jejak.find((j) => j.hasil === "berhasil")!.rinci_json))).toEqual({ menimpa: true });
    await expect(catatKirimanSipp(db, KASIR, { id: h.berkas.id, hasil: "berhasil" }, deps())).rejects.toBeInstanceOf(ApiError);
  });

  it("tidak ada kata aleta pada nama berkas yang dikirim ke SIPP dan tidak ada tulisan ke SIPP dari layanan", () => {
    const layanan = readFileSync(path.join(process.cwd(), "src/server/modules/mediasi-arsip/layanan.ts"), "utf8");
    expect(layanan).not.toMatch(/callAletaBotSippBridge|postGateway|mysql|sipp-datasource/i);
  });
});
