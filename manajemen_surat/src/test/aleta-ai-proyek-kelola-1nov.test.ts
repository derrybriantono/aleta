// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PENGANTAR_TANPA_BAWAAN, susunPermintaan, type PermintaanAi } from "@/lib/aleta-ai/penyusun";
import {
  BATAS_BERKAS_UTUH_KARAKTER,
  pecahBagian,
  pilihPengetahuan,
  pisahUsulanMemori,
  rakitBlokPengetahuan,
  type BerkasPengetahuan,
} from "@/lib/aleta-ai/proyek-kelola";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI_PROYEK_KELOLA } from "@/server/db/schema";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { ekstrakTeksBerkas } from "@/server/modules/aleta-ai/ekstrak-teks";
import { suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { simpanKurs } from "@/server/modules/aleta-ai/kurs";
import { ringkasAi } from "@/server/modules/aleta-ai/layanan";
import { kirimPesan, ulangiBatasLaju, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { ambilPercakapan, buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import * as kelola from "@/server/modules/aleta-ai/proyek-kelola";
import { terapkanMutasi } from "@/server/modules/aleta-ai/saldo";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { susunZip } from "@/server/shared/zip";

/**
 * ALETA Ai: proyek kelolaan Super Admin (migrasi 0122, 1 Nov 2026; keputusan 72 beserta ralatnya).
 *
 * Yang diuji adalah PERILAKU: hanya Super Admin yang menulis dan membaca isi; pengguna lain hanya memilih
 * proyek yang diizinkan; pengetahuan dipilih menurut pertanyaan; prompt tetap berawalan sama (cache);
 * usulan memori menunggu persetujuan; impor ZIP berformat V4.5; data pengguna tidak bocor ke pengguna lain.
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, pelaku: null as unknown }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "uji" }));
vi.mock("@/server/modules/aleta-ai/akses", async (asli) => {
  const nyata = await asli<typeof import("@/server/modules/aleta-ai/akses")>();
  return {
    ...nyata,
    pelakuAi: async () => ctx.pelaku,
    pelakuSuperAi: async () => {
      nyata.wajibSuperAdmin(ctx.pelaku as PelakuAi);
      return ctx.pelaku;
    },
  };
});

const hakim: PelakuAi = { id: "usr-hakim", nama: "Hakim Rekaan", peranId: "hakim", superAdmin: false };
const pp: PelakuAi = { id: "usr-pp", nama: "PP Rekaan", peranId: "panitera-pengganti", superAdmin: false };
const jurusita: PelakuAi = { id: "usr-js", nama: "Jurusita Rekaan", peranId: "jurusita", superAdmin: false, peranTambahan: ["hakim"] };
const superAdmin: PelakuAi = { id: "usr-super", nama: "Super Rekaan", peranId: "super-admin", superAdmin: true };

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── Fixture ────────────────────────────────────────────────────────────────

const CORE_BAWAAN = "# CORE PROMPT BAWAAN SATKER\nPedoman bawaan rekaan. " + "Kalimat pengisi pedoman. ".repeat(30);
const MENU_MD = `# ALETA_05 — TRIGGER MENU
## KELOMPOK I — UTILITAS
| Trigger | Output |
|---|---|
| help / bantuan / ? | Menu ini |
`;

function zipProyek(ekstra: Array<{ nama: string; isi: string | Buffer }> = [], awalan = "") {
  const dasar: Array<{ nama: string; isi: string | Buffer }> = [
    { nama: "ALETA_AI_PA_CLAUDE_Core_Prompt.md", isi: "# CORE PROYEK CLAUDE\nAnda asisten hukum proyek CLAUDE rekaan. " + "Pengisi. ".repeat(40) },
    { nama: "ALETA_05_Trigger_Menu.md", isi: MENU_MD },
    { nama: "ALETA_04_Kalkulator.md", isi: "# ALETA_04 — KALKULATOR\nNafkah iddah dihitung tiga bulan. Mut'ah sesuai kemampuan suami." },
    { nama: "ALETA_13_Sidang.md", isi: "# ALETA_13 — SIDANG\nPanduan persiapan sidang pembuktian saksi." },
    { nama: "Gambar.png", isi: "bukan-teks" },
    { nama: "alat/skrip.py", isi: "print('x')" },
    ...ekstra,
  ];
  return susunZip(dasar.map((e) => ({ nama: `${awalan}${e.nama}`, isi: Buffer.isBuffer(e.isi) ? e.isi : Buffer.from(e.isi, "utf8") })));
}

function docxDari(paragraf: string[]): Buffer {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${paragraf.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`;
  return susunZip([{ nama: "word/document.xml", isi: Buffer.from(xml, "utf8") }]);
}

async function pdfDari(baris: string[]): Promise<Buffer> {
  const dok = await PDFDocument.create();
  const huruf = await dok.embedFont(StandardFonts.Helvetica);
  const hal = dok.addPage([595, 842]);
  baris.forEach((b, i) => hal.drawText(b, { x: 40, y: 780 - i * 20, size: 12, font: huruf }));
  return Buffer.from(await dok.save());
}

// ─── Klien Claude tiruan ────────────────────────────────────────────────────

class KlienTiruan implements KlienAi {
  panggilan: PermintaanAi[] = [];
  jawaban: string[] = ["Jawaban rekaan."];
  async alirkan(p: PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    this.panggilan.push(p);
    const pengklasifikasi = p.system[0]?.text.startsWith("Anda pengklasifikasi") ?? false;
    const teks = pengklasifikasi ? '{"kelompok":"cepat-bantuan","yakin":0.9}' : (this.jawaban.shift() ?? "Jawaban rekaan.");
    if (!pengklasifikasi) opsi.onTeks?.(teks);
    return {
      teks,
      berhenti: "selesai",
      model: p.model,
      penggunaan: { masuk: pengklasifikasi ? 300 : 1000, keluar: pengklasifikasi ? 40 : 500, cacheTulis: 0, cacheBaca: 0 },
      iterasi: [],
      kategoriTolak: "",
      dialihkan: false,
    };
  }
  async hitungToken(): Promise<number> {
    return 4000;
  }
  get jawabanKe() {
    return this.panggilan.filter((p) => !p.system[0]?.text.startsWith("Anda pengklasifikasi"));
  }
}

async function kumpulkan(g: AsyncGenerator<EventAi, void, void>): Promise<EventAi[]> {
  const hasil: EventAi[] = [];
  for await (const e of g) hasil.push(e);
  return hasil;
}

const teksSistem = (p: PermintaanAi) => p.system.map((b) => b.text).join("\n=====\n");

// ─── 1. Migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0122 - tiga tempat pendaftaran", () => {
  const AKAR = process.cwd();
  it("jurnal idx 106 tepat sekali dan berurutan; berkas = DDL; berjalan di pg-mem; tabel ikut cadangan; tanpa kunci asing", () => {
    const j = JSON.parse(readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.filter((e) => e.tag.startsWith("0122_"))).toEqual([expect.objectContaining({ idx: 106, tag: "0122_aleta_ai_proyek_kelola" })]);
    expect(new Set(j.entries.map((e) => e.idx)).size).toBe(j.entries.length);
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);

    const sql = readFileSync(path.join(AKAR, "drizzle/0122_aleta_ai_proyek_kelola.sql"), "utf8");
    expect(pernyataan(sql).sort()).toEqual([...DDL_ALETA_AI_PROYEK_KELOLA.tabel, ...DDL_ALETA_AI_PROYEK_KELOLA.indeks].map((s) => pernyataan(s)[0]).sort());
    const kosong = newDb();
    kosong.public.none(sql);
    for (const t of ["aleta_ai_proyek_kelola", "aleta_ai_pengetahuan", "aleta_ai_memori_proyek", "aleta_ai_proyek_catatan", "aleta_ai_proyek_pilihan"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(sql.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. Bagian murni ────────────────────────────────────────────────────────

describe("pemilihan pengetahuan, usulan memori (murni)", () => {
  const berkas = (id: string, nama: string, teks: string, selalu = false): BerkasPengetahuan => ({ id, nama, teks, selalu });
  const gudang = [
    berkas("a", "nafkah-iddah.md", "Nafkah iddah dan mut'ah dihitung dari kemampuan suami. Nafkah madliyah dapat dituntut."),
    berkas("b", "sidang-saksi.md", "Pemeriksaan saksi dilakukan di persidangan dengan sumpah."),
    berkas("c", "aturan-inti.md", "Aturan inti proyek: selalu sebut dasar hukum.", true),
    berkas("d", "waris.md", "Pembagian waris menurut faraid, ashabul furudh."),
  ];

  it("hanya berkas yang cocok dengan pertanyaan + berkas 'selalu'; urutan tetap menurut nama (cache stabil)", () => {
    const a = pilihPengetahuan({ berkas: gudang, teks: "Hitung nafkah iddah untuk perkara cerai talak", anggaran: 10_000 });
    expect(a.map((x) => x.nama)).toEqual(["aturan-inti.md", "nafkah-iddah.md"]);
    // Pertanyaan lain -> himpunan lain; tanpa kata cocok hanya yang 'selalu'.
    expect(pilihPengetahuan({ berkas: gudang, teks: "halo apa kabar", anggaran: 10_000 }).map((x) => x.nama)).toEqual(["aturan-inti.md"]);
    // Pertanyaan yang sama dua kali = teks sama persis.
    const b = pilihPengetahuan({ berkas: [...gudang].reverse(), teks: "Hitung nafkah iddah untuk perkara cerai talak", anggaran: 10_000 });
    expect(rakitBlokPengetahuan(b)).toBe(rakitBlokPengetahuan(a));
  });

  it("nama berkas yang disebut utuh mengalahkan kata kunci isi; anggaran dihormati; skor 0 tidak pernah masuk", () => {
    const x = pilihPengetahuan({ berkas: gudang, teks: "ringkas isi waris untuk saya", anggaran: 10_000 });
    expect(x.map((y) => y.nama)).toContain("waris.md");
    const sempit = pilihPengetahuan({ berkas: gudang, teks: "nafkah iddah saksi waris", anggaran: 90 });
    expect(sempit.reduce((n, y) => n + y.teks.length, 0)).toBeLessThanOrEqual(90);
    expect(pilihPengetahuan({ berkas: gudang, teks: "zzzz qqqq", anggaran: 10_000 }).map((y) => y.nama)).toEqual(["aturan-inti.md"]);
  });

  it("huruf besar/kecil dan aksen tidak menghalangi kecocokan", () => {
    const x = pilihPengetahuan({ berkas: gudang, teks: "PÉMERIKSAAN Saksi di sidang", anggaran: 10_000 });
    expect(x.map((y) => y.nama)).toContain("sidang-saksi.md");
  });

  it("berkas panjang dipecah dan hanya bagian relevan yang dikirim", () => {
    const paragraf = Array.from({ length: 80 }, (_, i) => `Paragraf nomor ${i}: ${"isi umum tanpa makna khusus ".repeat(12)}`).join("\n\n");
    const panjang = `${paragraf}\n\nBagian khusus tentang harta bersama gono-gini yang dibahas rinci.\n\n${paragraf}`;
    expect(panjang.length).toBeGreaterThan(BATAS_BERKAS_UTUH_KARAKTER * 3);
    const bagian = pecahBagian(panjang);
    expect(bagian.length).toBeGreaterThan(3);
    bagian.forEach((b) => expect(b.length).toBeLessThan(10_000));
    const dipilih = pilihPengetahuan({ berkas: [berkas("p", "buku.md", panjang)], teks: "bagaimana harta bersama gono-gini dibagi", anggaran: 8000 });
    expect(dipilih.length).toBe(1);
    expect(dipilih[0]?.teks).toContain("harta bersama gono-gini");
    expect(dipilih[0]?.dari).toBeGreaterThan(1);
    expect(rakitBlokPengetahuan(dipilih)).toMatch(/\(bagian \d+\/\d+\)/);
  });

  it("baris USUL-MEMORI dilepas dari jawaban; usulan yang memuat kode samaran dibuang", () => {
    const r = pisahUsulanMemori("Jawaban utama.\n\nUSUL-MEMORI: Satker memakai format putusan ringkas\nUSUL-MEMORI: Pemohon [NAMA-1] tinggal di Palu\nUSUL-MEMORI: pendek");
    expect(r.teks).toBe("Jawaban utama.");
    expect(r.usulan).toEqual(["Satker memakai format putusan ringkas"]);
    expect(pisahUsulanMemori("tanpa usulan").usulan).toEqual([]);
  });
});

// ─── 3. Ekstraksi teks ──────────────────────────────────────────────────────

describe("ekstraksi teks berkas pengetahuan", () => {
  it("Markdown dan teks (termasuk Windows-1252), RTF, DOCX, dan PDF terbaca; jenis ditebak dari isi", async () => {
    expect((await ekstrakTeksBerkas("catatan.md", Buffer.from("﻿# Judul\n\nIsi markdown.", "utf8"))).teks).toBe("# Judul\n\nIsi markdown.");
    expect((await ekstrakTeksBerkas("a.txt", Buffer.from("Café nafkah", "latin1"))).teks).toBe("Café nafkah");

    const rtf = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\pard Bahwa nafkah iddah tiga bulan.\par Kalimat kedua \'e9.\par}`;
    const hr = await ekstrakTeksBerkas("putusan.rtf", Buffer.from(rtf, "latin1"));
    expect(hr.jenis).toBe("rtf");
    expect(hr.teks).toContain("Bahwa nafkah iddah tiga bulan.");
    expect(hr.teks).not.toContain("Times New Roman");

    const hd = await ekstrakTeksBerkas("a.docx", docxDari(["Paragraf pertama.", "Paragraf kedua &amp; ketiga."]));
    expect(hd.teks).toBe("Paragraf pertama.\nParagraf kedua & ketiga.");

    const hp = await ekstrakTeksBerkas("buku.pdf", await pdfDari(["Pedoman nafkah iddah", "Baris kedua pedoman"]));
    expect(hp.jenis).toBe("pdf");
    expect(hp.teks).toContain("Pedoman nafkah iddah");
    expect(hp.teks).toContain("Baris kedua pedoman");

    // PDF yang diberi nama .txt tetap dikenali dari kepala berkasnya.
    expect((await ekstrakTeksBerkas("salah-nama.txt", await pdfDari(["Isi sebenarnya PDF"]))).jenis).toBe("pdf");
  }, 60000);

  it("jenis tak didukung, berkas kosong, dan berkas tanpa teks ditolak dengan sebab yang jelas", async () => {
    await expect(ekstrakTeksBerkas("gambar.png", Buffer.from("x"))).rejects.toMatchObject({ status: 400 });
    await expect(ekstrakTeksBerkas("kosong.md", Buffer.alloc(0))).rejects.toMatchObject({ status: 400 });
    await expect(ekstrakTeksBerkas("spasi.txt", Buffer.from("   \n  "))).rejects.toMatchObject({ status: 400 });
    await expect(ekstrakTeksBerkas("rusak.pdf", Buffer.from("%PDF-bukan-pdf-sungguhan"))).rejects.toMatchObject({ status: 400 });
    await expect(ekstrakTeksBerkas("besar.md", Buffer.alloc(16 * 1024 * 1024, 65))).rejects.toMatchObject({ status: 413 });
  });
});

// ─── 4. Bagian berbasis data ────────────────────────────────────────────────

describe("proyek kelolaan: hak, berkas, memori, impor, penyusun, mesin, rute (pg-mem)", () => {
  let db: AletaDatabase;

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, superAdmin.id, {
      bita: susunZip([
        { nama: "Core_Prompt.md", isi: Buffer.from(CORE_BAWAAN, "utf8") },
        { nama: "ALETA_05_Trigger_Menu.md", isi: Buffer.from(MENU_MD, "utf8") },
        { nama: "ALETA_06_Bantuan.md", isi: Buffer.from("# ALETA_06 — BANTUAN\nIsi modul bantuan bawaan rekaan.", "utf8") },
      ]),
      namaBerkas: "bawaan.zip",
    });
  }, 180000);

  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });

  afterEach(() => {
    ulangiBatasLaju();
    kelola.kosongkanCacheProyekKelola();
  });

  const bekali = (p: PelakuAi) => terapkanMutasi(db, { penggunaId: p.id, jenis: "isi", jumlahRp: 500_000, catatan: "uji" });
  const buatSA = (nama: string, lebih: Record<string, unknown> = {}) => kelola.buatProyekKelola(db, superAdmin, { nama, ...lebih });
  const md = (nama: string, isi: string) => ({ nama, bita: Buffer.from(isi, "utf8") });

  // ── Hak ──
  it("HAK: setiap tulis dan setiap baca isi ditolak 403 untuk selain Super Admin (hakim, PP, peran tambahan pun)", async () => {
    const p = await buatSA("Proyek Hak", { instruksi: "RAHASIA-INSTRUKSI" });
    const b = await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("rahasia.md", "RAHASIA-ISI-BERKAS pengetahuan"));
    const m = await kelola.tambahMemoriProyek(db, superAdmin, p.id, "RAHASIA-MEMORI satker");
    const zip = zipProyek();
    for (const pelaku of [hakim, pp, jurusita]) {
      const tolak = (janji: Promise<unknown>) => expect(janji).rejects.toMatchObject({ status: 403 });
      await tolak(kelola.daftarProyekKelola(db, pelaku));
      await tolak(kelola.rincianProyekKelola(db, pelaku, p.id));
      await tolak(kelola.buatProyekKelola(db, pelaku, { nama: "Penyusup" }));
      await tolak(kelola.ubahProyekKelola(db, pelaku, p.id, { instruksi: "ubah" }));
      await tolak(kelola.hapusProyekKelola(db, pelaku, p.id));
      await tolak(kelola.tambahBerkasPengetahuan(db, pelaku, p.id, md("x.md", "isi")));
      await tolak(kelola.bacaBerkasPengetahuan(db, pelaku, p.id, b.berkas.id));
      await tolak(kelola.ubahBerkasPengetahuan(db, pelaku, p.id, b.berkas.id, { teks: "ubah" }));
      await tolak(kelola.hapusBerkasPengetahuan(db, pelaku, p.id, b.berkas.id));
      await tolak(kelola.imporZipProyek(db, pelaku, { bita: zip, namaBerkas: "x.zip" }));
      await tolak(kelola.daftarMemoriProyek(db, pelaku, p.id));
      await tolak(kelola.tambahMemoriProyek(db, pelaku, p.id, "memori penyusup"));
      await tolak(kelola.ubahMemoriProyek(db, pelaku, p.id, m.id, "ubah memori"));
      await tolak(kelola.putuskanUsulanMemori(db, pelaku, p.id, m.id, true));
      await tolak(kelola.hapusMemoriProyek(db, pelaku, p.id, m.id));
    }
    // Tidak ada yang berubah.
    const r = await kelola.rincianProyekKelola(db, superAdmin, p.id);
    expect(r.instruksi).toBe("RAHASIA-INSTRUKSI");
    expect(r.berkas).toHaveLength(1);
    expect(r.memori).toHaveLength(1);
    // Daftar pilihan untuk pengguna biasa: hanya id, nama, deskripsi.
    const pilihan = await kelola.daftarPilihanProyek(db, hakim);
    const sendiri = pilihan.find((x) => x.id === p.id);
    expect(sendiri && Object.keys(sendiri).sort()).toEqual(["deskripsi", "id", "nama"]);
    expect(JSON.stringify(pilihan)).not.toContain("RAHASIA");
  });

  it("CRUD proyek: nama wajib dan unik, ubah menaikkan versi, hapus membersihkan berkas, memori, dan pilihan percakapan", async () => {
    const p = await buatSA("Proyek CRUD", { deskripsi: "Untuk uji" });
    await expect(buatSA("proyek crud")).rejects.toMatchObject({ status: 409 });
    await expect(buatSA("   ")).rejects.toMatchObject({ status: 400 });
    await expect(kelola.ubahProyekKelola(db, superAdmin, p.id, { nama: "x".repeat(81) })).rejects.toMatchObject({ status: 400 });
    await expect(kelola.rincianProyekKelola(db, superAdmin, "aipk-tidak-ada")).rejects.toMatchObject({ status: 404 });
    const u = await kelola.ubahProyekKelola(db, superAdmin, p.id, { nama: "Proyek CRUD 2", instruksi: "Instruksi baru", memoriAktif: false });
    expect(u).toMatchObject({ nama: "Proyek CRUD 2", memoriAktif: false, sertakanBawaan: true, versi: 2 });
    expect((await kelola.rincianProyekKelola(db, superAdmin, p.id)).instruksi).toBe("Instruksi baru");

    await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("a.md", "isi a"));
    await kelola.tambahMemoriProyek(db, superAdmin, p.id, "memori satu");
    const perc = (await buatPercakapan(db, superAdmin.id)).id;
    await kelola.setPilihanPercakapan(db, superAdmin, perc, p.id);
    expect(await kelola.bacaPilihanPercakapan(db, perc)).toBe(p.id);
    await kelola.hapusProyekKelola(db, superAdmin, p.id);
    for (const t of ["aleta_ai_pengetahuan", "aleta_ai_memori_proyek", "aleta_ai_proyek_pilihan"]) {
      const sisa = await db.queryAll(`SELECT * FROM ${t} WHERE ${t === "aleta_ai_proyek_pilihan" ? "percakapan_id" : "proyek_id"} = ?`, [t === "aleta_ai_proyek_pilihan" ? perc : p.id]);
      expect(sisa).toEqual([]);
    }
    expect(await kelola.bacaPilihanPercakapan(db, perc)).toBe("");
    expect((await db.queryAll<{ aksi: string }>(`SELECT aksi FROM aleta_ai_proyek_catatan WHERE proyek_id = ? ORDER BY waktu, id`, [p.id])).map((x) => x.aksi)).toContain("hapus");
  });

  // ── Berkas ──
  it("BERKAS: unggah satu per satu, nama sama menggantikan, sunting teks, tanda 'selalu', hapus; batas jumlah", async () => {
    const p = await buatSA("Proyek Berkas");
    const a = await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, { nama: "Panduan.docx", bita: docxDari(["Panduan satu.", "Panduan dua."]) });
    expect(a).toMatchObject({ diganti: false, berkas: { nama: "Panduan.docx", jenis: "docx", selalu: false } });
    const b = await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, { nama: "Buku.pdf", bita: await pdfDari(["Isi buku pdf"]), selalu: true });
    expect(b.berkas).toMatchObject({ jenis: "pdf", selalu: true });
    await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("Catatan.md", "# Catatan\nlama"));
    const ganti = await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("catatan.MD", "# Catatan\nbaru"));
    expect(ganti.diganti).toBe(true);
    expect((await kelola.rincianProyekKelola(db, superAdmin, p.id)).berkas.map((x) => x.nama).sort()).toEqual(["Buku.pdf", "Catatan.md", "Panduan.docx"]);
    expect((await kelola.bacaBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id)).teks).toBe("# Catatan\nbaru");

    await kelola.ubahBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id, { teks: "Disunting manusia", nama: "Catatan 2.md", selalu: true });
    const s = await kelola.bacaBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id);
    expect(s).toMatchObject({ nama: "Catatan 2.md", teks: "Disunting manusia", selalu: true });
    await expect(kelola.ubahBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id, { nama: "buku.PDF" })).rejects.toMatchObject({ status: 409 });
    await expect(kelola.ubahBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id, { teks: "  " })).rejects.toMatchObject({ status: 400 });

    await kelola.hapusBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id);
    await expect(kelola.bacaBerkasPengetahuan(db, superAdmin, p.id, ganti.berkas.id)).rejects.toMatchObject({ status: 404 });
    // Berkas milik proyek lain tidak terbaca lewat id proyek yang salah.
    const q = await buatSA("Proyek Lain");
    await expect(kelola.bacaBerkasPengetahuan(db, superAdmin, q.id, a.berkas.id)).rejects.toMatchObject({ status: 404 });

    // Batas jumlah berkas per proyek.
    await db.run(`DELETE FROM aleta_ai_pengetahuan WHERE proyek_id = ?`, [q.id]);
    for (let i = 0; i < kelola.BATAS_BERKAS_PER_PROYEK; i += 1) {
      await db.run(`INSERT INTO aleta_ai_pengetahuan (id, proyek_id, nama, jenis, ukuran, karakter, teks, selalu, dibuat_at, diubah_at) VALUES (?, ?, ?, 'md', 1, 1, 'x', 0, 'a', 'a')`, [`pk-${i}`, q.id, `b${i}.md`]);
    }
    await expect(kelola.tambahBerkasPengetahuan(db, superAdmin, q.id, md("lebih.md", "satu lagi"))).rejects.toMatchObject({ status: 400 });
    await kelola.tambahBerkasPengetahuan(db, superAdmin, q.id, md("b0.md", "ganti yang ada tetap boleh"));
  }, 60000);

  // ── Memori ──
  it("MEMORI: tambah/ubah/hapus oleh Super Admin; usulan AI menunggu, baru ikut prompt setelah disetujui; tolak = hilang; saklar usulan", async () => {
    const p = await buatSA("Proyek Memori");
    await kelola.tambahMemoriProyek(db, superAdmin, p.id, "Satker memakai kop surat resmi");
    await expect(kelola.tambahMemoriProyek(db, superAdmin, p.id, "ab")).rejects.toMatchObject({ status: 400 });
    await expect(kelola.tambahMemoriProyek(db, superAdmin, p.id, "x".repeat(1001))).rejects.toMatchObject({ status: 400 });

    expect(await kelola.simpanUsulanMemori(db, p.id, ["Hakim ketua menyukai format ringkas", "Satker memakai kop surat resmi", "Usulan kedua yang berbeda"])).toBe(2);
    expect(await kelola.simpanUsulanMemori(db, p.id, ["hakim ketua  menyukai FORMAT ringkas"])).toBe(0); // kembar
    const semua = await kelola.daftarMemoriProyek(db, superAdmin, p.id);
    const usulan = semua.filter((x) => x.status === "usulan");
    expect(usulan.map((x) => x.sumber)).toEqual(["usulan-ai", "usulan-ai"]);
    // Belum ikut prompt.
    const awal = await kelola.proyekUntukPrompt(db, superAdmin, p.id);
    expect(awal.memori.map((x) => x.isi)).toEqual(["Satker memakai kop surat resmi"]);

    await kelola.putuskanUsulanMemori(db, superAdmin, p.id, usulan[0].id, true);
    await kelola.putuskanUsulanMemori(db, superAdmin, p.id, usulan[1].id, false);
    await expect(kelola.putuskanUsulanMemori(db, superAdmin, p.id, usulan[0].id, true)).rejects.toMatchObject({ status: 409 });
    expect((await kelola.proyekUntukPrompt(db, superAdmin, p.id)).memori.map((x) => x.isi)).toEqual(["Satker memakai kop surat resmi", "Hakim ketua menyukai format ringkas"]);
    expect((await kelola.daftarMemoriProyek(db, superAdmin, p.id)).some((x) => x.id === usulan[1].id)).toBe(false);

    const ubah = await kelola.ubahMemoriProyek(db, superAdmin, p.id, usulan[0].id, "Hakim ketua menyukai format ringkas dan padat");
    expect(ubah.isi).toBe("Hakim ketua menyukai format ringkas dan padat");
    await kelola.hapusMemoriProyek(db, superAdmin, p.id, usulan[0].id);
    expect((await kelola.proyekUntukPrompt(db, superAdmin, p.id)).memori).toHaveLength(1);

    await kelola.ubahProyekKelola(db, superAdmin, p.id, { memoriAktif: false });
    expect(await kelola.simpanUsulanMemori(db, p.id, ["Tidak boleh masuk karena saklar mati"])).toBe(0);
  });

  // ── Akses ──
  it("AKSES: semua / per peran (termasuk peran tambahan) / per pengguna / nonaktif; yang tak berhak dijawab 'tidak ditemukan'", async () => {
    const semua = await buatSA("Akses Semua");
    const peran = await buatSA("Akses Peran", { akses: "peran", aksesPeran: ["hakim"] });
    const orang = await buatSA("Akses Orang", { akses: "pengguna", aksesPengguna: [pp.id] });
    const mati = await buatSA("Akses Mati");
    await kelola.ubahProyekKelola(db, superAdmin, mati.id, { aktif: false });

    const ids = async (pl: PelakuAi) => (await kelola.daftarPilihanProyek(db, pl)).map((x) => x.id);
    expect(await ids(hakim)).toEqual(expect.arrayContaining([semua.id, peran.id]));
    expect(await ids(hakim)).not.toContain(orang.id);
    expect(await ids(hakim)).not.toContain(mati.id);
    expect(await ids(pp)).toEqual(expect.arrayContaining([semua.id, orang.id]));
    expect(await ids(pp)).not.toContain(peran.id);
    // Peran tambahan "hakim" cukup.
    expect(await ids(jurusita)).toContain(peran.id);
    // Super Admin melihat semuanya (termasuk yang nonaktif) untuk mencoba.
    expect(await ids(superAdmin)).toEqual(expect.arrayContaining([semua.id, peran.id, orang.id, mati.id]));

    const perc = (await buatPercakapan(db, hakim.id)).id;
    await expect(kelola.setPilihanPercakapan(db, hakim, perc, orang.id)).rejects.toMatchObject({ status: 404 });
    await expect(kelola.setPilihanPercakapan(db, hakim, perc, "aipk-tidak-ada")).rejects.toMatchObject({ status: 404 });
    await expect(kelola.proyekUntukPrompt(db, hakim, orang.id)).rejects.toMatchObject({ status: 404 });
    await kelola.setPilihanPercakapan(db, hakim, perc, peran.id);
    expect(await kelola.bacaPilihanPercakapan(db, perc)).toBe(peran.id);
    expect((await kelola.setPilihanPercakapan(db, hakim, perc, "")).proyekId).toBe("");
    expect(await kelola.bacaPilihanPercakapan(db, perc)).toBe("");
  });

  // ── Impor ZIP ──
  it("IMPOR: ZIP berformat V4.5 menjadi proyek mandiri (Core Prompt = instruksi, modul = berkas); berkas tak terbaca dilewati dan disebut; folder induk dilepas", async () => {
    const hasil = await kelola.imporZipProyek(db, superAdmin, { bita: zipProyek([], "ALETA AI PA CLAUDE/"), namaBerkas: "ALETA_AI_PA_CLAUDE.zip", nama: "ALETA AI PA CLAUDE" });
    expect(hasil.proyek).toMatchObject({ nama: "ALETA AI PA CLAUDE", sertakanBawaan: false, jumlahBerkas: 3 });
    const r = await kelola.rincianProyekKelola(db, superAdmin, hasil.proyek.id);
    expect(r.instruksi).toContain("CORE PROYEK CLAUDE");
    expect(r.berkas.map((x) => x.nama).sort()).toEqual(["ALETA_04_Kalkulator.md", "ALETA_05_Trigger_Menu.md", "ALETA_13_Sidang.md"]);
    expect(hasil.dilewati.join("|")).toMatch(/Gambar\.png/);
    expect(hasil.dilewati.join("|")).toMatch(/skrip\.py/);
    // Nama sama sudah ada -> bernomor, bukan menimpa.
    const lagi = await kelola.imporZipProyek(db, superAdmin, { bita: zipProyek(), namaBerkas: "x.zip", nama: "ALETA AI PA CLAUDE" });
    expect(lagi.proyek.nama).toBe("ALETA AI PA CLAUDE (2)");
    // ZIP tanpa Core Prompt ditolak untuk proyek baru.
    await expect(kelola.imporZipProyek(db, superAdmin, { bita: susunZip([{ nama: "a.md", isi: Buffer.from("isi", "utf8") }]), namaBerkas: "y.zip" })).rejects.toMatchObject({ status: 400 });
    await expect(kelola.imporZipProyek(db, superAdmin, { bita: Buffer.from("bukan zip"), namaBerkas: "z.zip" })).rejects.toMatchObject({ status: 400 });
  });

  it("IMPOR ke proyek yang ada: berkas ditambahkan, instruksi yang sudah terisi tidak ditimpa; DOCX dan PDF di dalam ZIP ikut terbaca", async () => {
    const p = await buatSA("Proyek Impor Tambah", { instruksi: "Instruksi asli saya" });
    const zip = zipProyek([
      { nama: "Panduan.docx", isi: docxDari(["Isi panduan docx dalam zip"]) },
      { nama: "Buku.pdf", isi: await pdfDari(["Isi buku pdf dalam zip"]) },
    ]);
    const h = await kelola.imporZipProyek(db, superAdmin, { bita: zip, namaBerkas: "tambah.zip", proyekId: p.id });
    const r = await kelola.rincianProyekKelola(db, superAdmin, p.id);
    expect(r.instruksi).toBe("Instruksi asli saya");
    expect(r.berkas.map((x) => x.nama)).toEqual(expect.arrayContaining(["Panduan.docx", "Buku.pdf", "ALETA_AI_PA_CLAUDE_Core_Prompt.md"]));
    expect(h.peringatan.join("|")).toMatch(/tidak menimpanya/);
    expect((await kelola.bacaBerkasPengetahuan(db, superAdmin, p.id, r.berkas.find((x) => x.nama === "Buku.pdf")!.id)).teks).toContain("Isi buku pdf dalam zip");
  }, 60000);

  // ── Penyusun prompt ──
  it("PENYUSUN: tanpa proyek = perilaku lama; dengan proyek + bawaan = core V4.5 lalu instruksi, memori, pengetahuan; tanpa bawaan = instruksi menggantikan core", () => {
    const rute = { kelompok: "teliti-sidang", label: "Teliti", model: "claude-sonnet-5-5", effort: "high" as const, maxTokens: 8000, perkiraanKeluaran: 3000, peranBoleh: [] };
    const dasar = { rute: rute as never, corePrompt: CORE_BAWAAN, modul: [{ kode: "ALETA_06", judul: "Bantuan", isi: "ISI-MODUL-6", pemicu: [] }], riwayat: [], teksPengguna: "tanya", fallback: false };
    const lama = susunPermintaan(dasar);
    expect(lama.system.map((b) => b.text.slice(0, 12))).toHaveLength(2);
    expect(teksSistem(lama)).not.toContain("INSTRUKSI PROYEK");

    const proyek = {
      nama: "P",
      instruksi: "INSTRUKSI-P",
      sertakanBawaan: true,
      memori: [{ id: "m", isi: "MEMORI-P" }],
      pengetahuan: [{ berkasId: "b", nama: "k.md", bagian: 1, dari: 1, teks: "ISI-PENGETAHUAN" }],
      usulMemori: true,
    };
    const gabung = susunPermintaan({ ...dasar, proyek });
    expect(gabung.system[0]?.text).toContain("CORE PROMPT BAWAAN SATKER");
    expect(gabung.system[1]?.text).toContain("ISI-MODUL-6");
    expect(gabung.system[2]?.text).toContain("INSTRUKSI-P");
    expect(gabung.system[2]?.text).toContain("MEMORI-P");
    expect(gabung.system[2]?.text).toContain("USUL-MEMORI");
    expect(gabung.system[3]?.text).toContain("ISI-PENGETAHUAN");
    // Blok yang berubah per pertanyaan tidak diberi titik cache; blok tetap diberi.
    expect(gabung.system[2]?.cache_control).toBeTruthy();
    expect(gabung.system[3]?.cache_control).toBeUndefined();
    const titik = gabung.system.filter((b) => b.cache_control).length + gabung.messages.filter((m) => Array.isArray(m.content)).length;
    expect(titik).toBeLessThanOrEqual(4);

    const mandiri = susunPermintaan({ ...dasar, proyek: { ...proyek, sertakanBawaan: false } });
    expect(mandiri.system[0]?.text).toContain("INSTRUKSI-P");
    expect(mandiri.system[0]?.text).toContain(PENGANTAR_TANPA_BAWAAN);
    expect(mandiri.system[0]?.text).not.toContain("CORE PROMPT BAWAAN SATKER");
    expect(teksSistem(mandiri)).not.toContain("ISI-MODUL-6");
    expect(mandiri.system[1]?.text).toContain("MEMORI-P");
  });

  // ── Mesin ──
  it("MESIN: pengetahuan relevan saja, awalan cache stabil, samaran tetap berlaku, usulan memori disimpan dan dibuang dari jawaban", async () => {
    const p = await buatSA("Proyek Mesin", { instruksi: "INSTRUKSI-MESIN-RAHASIA", akses: "peran", aksesPeran: ["hakim"] });
    await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("nafkah.md", "Pedoman nafkah iddah: tiga bulan, dihitung dari kemampuan suami."));
    await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("waris.md", "Pedoman waris faraid: bagian ashabul furudh."));
    await kelola.tambahMemoriProyek(db, superAdmin, p.id, "MEMORI-MESIN satker memakai kop resmi");

    const klien = new KlienTiruan();
    suntikKlienAi(klien);
    const pelaku: PelakuAi = { ...hakim, id: "usr-mesin-1" };
    await bekali(pelaku);

    // (a) Tanpa pilihan: perilaku lama.
    const id0 = (await buatPercakapan(db, pelaku.id)).id;
    await kumpulkan(kirimPesan(db, pelaku, id0, { teks: "Hitung nafkah iddah" }));
    expect(klien.jawabanKe).toHaveLength(1);
    expect(teksSistem(klien.jawabanKe[0]!)).not.toContain("INSTRUKSI-MESIN-RAHASIA");
    expect(teksSistem(klien.jawabanKe[0]!)).toContain("CORE PROMPT BAWAAN SATKER");

    // (b) Proyek dipilih: instruksi + memori + HANYA pengetahuan yang cocok.
    klien.panggilan.length = 0;
    const id = (await buatPercakapan(db, pelaku.id)).id;
    await kelola.setPilihanPercakapan(db, pelaku, id, p.id);
    klien.jawaban = ["Penjelasan nafkah.\n\nUSUL-MEMORI: Hakim ketua menyukai uraian nafkah yang ringkas\nUSUL-MEMORI: Pemohon [NAMA-1] bertempat tinggal di Palu"];
    const e1 = await kumpulkan(kirimPesan(db, pelaku, id, { teks: "Hitung nafkah iddah. NIK 7203010101900001 pemohon." }));
    expect(e1.at(-1)).toMatchObject({ jenis: "selesai" });
    const s1 = teksSistem(klien.jawabanKe[0]!);
    expect(s1).toContain("CORE PROMPT BAWAAN SATKER");
    expect(s1).toContain("INSTRUKSI-MESIN-RAHASIA");
    expect(s1).toContain("MEMORI-MESIN");
    expect(s1).toContain("Pedoman nafkah iddah");
    expect(s1).not.toContain("Pedoman waris faraid");
    // Samaran data perkara tetap berlaku: NIK tidak keluar.
    const terakhir = klien.jawabanKe[0]!.messages.at(-1)!;
    expect(JSON.stringify(terakhir)).not.toContain("7203010101900001");
    expect(JSON.stringify(terakhir)).toMatch(/\[NIK-\d+\]/);

    // Usulan: satu masuk sebagai usulan (yang memuat kode samaran dibuang); marker tidak ada di jawaban tersimpan.
    const usulan = (await kelola.daftarMemoriProyek(db, superAdmin, p.id)).filter((m) => m.status === "usulan");
    expect(usulan.map((m) => m.isi)).toEqual(["Hakim ketua menyukai uraian nafkah yang ringkas"]);
    const rincian = await ambilPercakapan(db, pelaku.id, id);
    expect(rincian.proyekId).toBe(p.id);
    const jawabTersimpan = rincian.pesan.find((m) => m.peran === "ai")!.isi;
    expect(jawabTersimpan).toBe("Penjelasan nafkah.");
    expect(jawabTersimpan).not.toContain("USUL-MEMORI");

    // (c) Giliran kedua, pertanyaan lain: awalan cache (core, modul, instruksi+memori) sama persis.
    klien.jawaban = ["Jawaban dua."];
    await kumpulkan(kirimPesan(db, pelaku, id, { teks: "Bagaimana pembagian waris faraid?" }));
    const [g1, g2] = klien.jawabanKe;
    expect(g2!.system[0]?.text).toBe(g1!.system[0]?.text);
    const tetap = (g: PermintaanAi) => g.system.find((b) => b.text.includes("INSTRUKSI-MESIN-RAHASIA"))!.text;
    expect(tetap(g2!)).toBe(tetap(g1!));
    expect(teksSistem(g2!)).toContain("Pedoman waris faraid");
    expect(teksSistem(g2!)).not.toContain("Pedoman nafkah iddah: tiga bulan");

    // (d) Hak dicabut di tengah percakapan: giliran ditolak dengan pesan jelas, tidak jatuh ke proyek lain.
    await kelola.ubahProyekKelola(db, superAdmin, p.id, { aksesPeran: ["panitera-pengganti"] });
    const e3 = await kumpulkan(kirimPesan(db, pelaku, id, { teks: "lanjut" }));
    expect(e3).toEqual([{ jenis: "gagal", pesan: expect.stringContaining("tidak lagi tersedia") }]);
    // Kembali ke proyek bawaan: berjalan lagi.
    await kelola.setPilihanPercakapan(db, pelaku, id, "");
    klien.jawaban = ["ok"];
    expect((await kumpulkan(kirimPesan(db, pelaku, id, { teks: "lanjut" }))).at(-1)).toMatchObject({ jenis: "selesai" });
  }, 60000);

  it("MESIN: proyek tanpa bawaan memakai instruksinya sebagai Core Prompt dan tidak mengirim modul V4.5", async () => {
    const impor = await kelola.imporZipProyek(db, superAdmin, { bita: zipProyek(), namaBerkas: "c.zip", nama: "Mandiri Uji" });
    const klien = new KlienTiruan();
    suntikKlienAi(klien);
    const pelaku: PelakuAi = { ...hakim, id: "usr-mesin-2" };
    await bekali(pelaku);
    const id = (await buatPercakapan(db, pelaku.id)).id;
    await kelola.setPilihanPercakapan(db, pelaku, id, impor.proyek.id);
    await kumpulkan(kirimPesan(db, pelaku, id, { teks: "bantuan nafkah iddah kalkulator" }));
    const s = teksSistem(klien.jawabanKe[0]!);
    expect(s).toContain("CORE PROYEK CLAUDE");
    expect(s).not.toContain("CORE PROMPT BAWAAN SATKER");
    expect(s).not.toContain("Isi modul bantuan bawaan rekaan");
    expect(s).toContain("Nafkah iddah dihitung tiga bulan"); // pengetahuan relevan
  }, 60000);

  // ── Layar tanya & rute ──
  it("RINGKAS: pengguna biasa hanya menerima id, nama, deskripsi proyek yang boleh dipakainya", async () => {
    const p = await buatSA("Terlihat Hakim", { deskripsi: "Deskripsi publik", instruksi: "INSTRUKSI-TAK-BOLEH-BOCOR", akses: "peran", aksesPeran: ["hakim"] });
    await kelola.tambahBerkasPengetahuan(db, superAdmin, p.id, md("x.md", "ISI-TAK-BOLEH-BOCOR"));
    const r = await ringkasAi(db, hakim);
    expect(r.proyekPilihan.find((x) => x.id === p.id)).toEqual({ id: p.id, nama: "Terlihat Hakim", deskripsi: "Deskripsi publik" });
    expect(JSON.stringify(r)).not.toContain("TAK-BOLEH-BOCOR");
    expect((await ringkasAi(db, pp)).proyekPilihan.some((x) => x.id === p.id)).toBe(false);
  });

  describe("rute HTTP", () => {
    const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
    const json = (url: string, metode: string, badan?: unknown) =>
      req(url, { method: metode, headers: { "content-type": "application/json" }, body: badan === undefined ? undefined : JSON.stringify(badan) });
    const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

    it("non-Super Admin: SEMUA rute pengelolaan menjawab 403 (baca isi maupun tulis); Super Admin lolos", async () => {
      const kel = await import("@/app/api/aleta-ai/proyek/kelola/route");
      const det = await import("@/app/api/aleta-ai/proyek/kelola/[id]/route");
      const ber = await import("@/app/api/aleta-ai/proyek/kelola/[id]/berkas/route");
      const berId = await import("@/app/api/aleta-ai/proyek/kelola/[id]/berkas/[berkasId]/route");
      const mem = await import("@/app/api/aleta-ai/proyek/kelola/[id]/memori/route");
      const memId = await import("@/app/api/aleta-ai/proyek/kelola/[id]/memori/[memoriId]/route");

      ctx.pelaku = superAdmin;
      const buat = (await (await kel.POST(json("/api/aleta-ai/proyek/kelola", "POST", { nama: "Lewat Rute", instruksi: "RAHASIA-RUTE" }))).json()) as { data: { id: string } };
      const id = buat.data.id;
      const formulir = new FormData();
      formulir.append("berkas", new File(["Isi pengetahuan satu RAHASIA-BERKAS"], "satu.md"));
      formulir.append("berkas", new File([new Uint8Array(docxDari(["Isi dua"]))], "dua.docx"));
      const unggah = await ber.POST(req(`/api/aleta-ai/proyek/kelola/${id}/berkas`, { method: "POST", body: formulir }), params({ id }));
      expect(unggah.status).toBe(201);
      const hu = (await unggah.json()) as { data: { hasil: Array<{ nama: string; berkas?: { id: string }; galat?: string }> } };
      expect(hu.data.hasil.map((h) => h.galat)).toEqual([undefined, undefined]);
      const berkasId = hu.data.hasil[0]!.berkas!.id;
      const mm = (await (await mem.POST(json(`/api/aleta-ai/proyek/kelola/${id}/memori`, "POST", { isi: "Memori lewat rute" }), params({ id }))).json()) as { data: { id: string } };

      // Super Admin: rincian TIDAK memuat isi berkas (hanya daftar), isi dibuka per berkas.
      const rincian = await (await det.GET(req(`/api/aleta-ai/proyek/kelola/${id}`), params({ id }))).json();
      expect(JSON.stringify(rincian)).not.toContain("RAHASIA-BERKAS");
      expect(JSON.stringify(rincian)).toContain("RAHASIA-RUTE");
      expect(await (await berId.GET(req("/x"), params({ id, berkasId }))).json()).toMatchObject({ data: { teks: "Isi pengetahuan satu RAHASIA-BERKAS" } });

      for (const pelaku of [hakim, pp]) {
        ctx.pelaku = pelaku;
        const panggilan: Array<Promise<Response>> = [
          Promise.resolve(kel.GET(req("/api/aleta-ai/proyek/kelola"))),
          Promise.resolve(kel.POST(json("/api/aleta-ai/proyek/kelola", "POST", { nama: "Penyusup" }))),
          Promise.resolve(det.GET(req("/x"), params({ id }))),
          Promise.resolve(det.PUT(json("/x", "PUT", { instruksi: "ubah" }), params({ id }))),
          Promise.resolve(det.DELETE(req("/x", { method: "DELETE" }), params({ id }))),
          Promise.resolve(ber.POST(req("/x", { method: "POST", body: formulir }), params({ id }))),
          Promise.resolve(berId.GET(req("/x"), params({ id, berkasId }))),
          Promise.resolve(berId.PUT(json("/x", "PUT", { teks: "ubah" }), params({ id, berkasId }))),
          Promise.resolve(berId.DELETE(req("/x", { method: "DELETE" }), params({ id, berkasId }))),
          Promise.resolve(mem.GET(req("/x"), params({ id }))),
          Promise.resolve(mem.POST(json("/x", "POST", { isi: "memori penyusup" }), params({ id }))),
          Promise.resolve(memId.PUT(json("/x", "PUT", { isi: "ubah memori" }), params({ id, memoriId: mm.data.id }))),
          Promise.resolve(memId.PUT(json("/x", "PUT", { putusan: "setuju" }), params({ id, memoriId: mm.data.id }))),
          Promise.resolve(memId.DELETE(req("/x", { method: "DELETE" }), params({ id, memoriId: mm.data.id }))),
        ];
        const hasil = await Promise.all(panggilan);
        expect(hasil.map((h) => h.status)).toEqual(Array(panggilan.length).fill(403));
        for (const h of hasil) expect(JSON.stringify(await h.json())).not.toContain("RAHASIA");
      }
      // Tidak ada yang berubah.
      ctx.pelaku = superAdmin;
      const sesudah = await kelola.rincianProyekKelola(db, superAdmin, id);
      expect(sesudah.instruksi).toBe("RAHASIA-RUTE");
      expect(sesudah.berkas).toHaveLength(2);
      expect(sesudah.memori).toHaveLength(1);
      expect((await berId.PUT(json("/x", "PUT", { teks: "Disunting lewat rute" }), params({ id, berkasId }))).status).toBe(200);
      expect((await memId.PUT(json("/x", "PUT", { putusan: "tolak" }), params({ id, memoriId: mm.data.id }))).status).toBe(409);
    }, 60000);

    it("memilih proyek: pemilik percakapan dengan proyek yang diizinkan saja; percakapan orang lain dan proyek terlarang = 404", async () => {
      const percakapan = await import("@/app/api/aleta-ai/percakapan/route");
      const satu = await import("@/app/api/aleta-ai/percakapan/[id]/route");
      const bolehHakim = await buatSA("Rute Hakim", { akses: "peran", aksesPeran: ["hakim"] });
      const bolehPp = await buatSA("Rute PP", { akses: "peran", aksesPeran: ["panitera-pengganti"] });

      ctx.pelaku = hakim;
      // Dibuat langsung dengan proyek yang boleh.
      const buat = await percakapan.POST(json("/api/aleta-ai/percakapan", "POST", { judul: "T", proyekId: bolehHakim.id }));
      expect(buat.status).toBe(201);
      const idPerc = ((await buat.json()) as { data: { id: string } }).data.id;
      expect(await kelola.bacaPilihanPercakapan(db, idPerc)).toBe(bolehHakim.id);
      const rinci = (await (await satu.GET(req("/x"), params({ id: idPerc }))).json()) as { data: { proyekId: string } };
      expect(rinci.data.proyekId).toBe(bolehHakim.id);

      // Proyek terlarang: percakapan TIDAK tercipta setengah jadi.
      const sebelum = (await db.queryAll(`SELECT id FROM aleta_ai_obrolan WHERE pemilik_id = ?`, [hakim.id])).length;
      const tolak = await percakapan.POST(json("/api/aleta-ai/percakapan", "POST", { judul: "T2", proyekId: bolehPp.id }));
      expect(tolak.status).toBe(404);
      expect((await db.queryAll(`SELECT id FROM aleta_ai_obrolan WHERE pemilik_id = ?`, [hakim.id])).length).toBe(sebelum);
      expect((await satu.PATCH(json("/x", "PATCH", { proyekId: bolehPp.id }), params({ id: idPerc }))).status).toBe(404);
      expect(await kelola.bacaPilihanPercakapan(db, idPerc)).toBe(bolehHakim.id);

      // Ganti ke bawaan.
      expect((await satu.PATCH(json("/x", "PATCH", { proyekId: "" }), params({ id: idPerc }))).status).toBe(200);
      expect(await kelola.bacaPilihanPercakapan(db, idPerc)).toBe("");

      // Pengguna lain tidak dapat mengubah pilihan pada percakapan orang lain (404, bukan bocor).
      ctx.pelaku = pp;
      expect((await satu.PATCH(json("/x", "PATCH", { proyekId: bolehPp.id }), params({ id: idPerc }))).status).toBe(404);
      expect(await kelola.bacaPilihanPercakapan(db, idPerc)).toBe("");
      // Super Admin pun tidak membuka percakapan orang lain.
      ctx.pelaku = superAdmin;
      expect((await satu.GET(req("/x"), params({ id: idPerc }))).status).toBe(404);
    }, 60000);
  });
});
