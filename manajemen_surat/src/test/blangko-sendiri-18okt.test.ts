// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  bagianDariParagraf,
  bagianDariTeksBebas,
  bagianTerlarang,
  bangunRtf,
  bolehBuatBlangkoSendiri,
  daftarIsianPaket,
  deteksiIsian,
  gabungBarisPdf,
  namaBerkasAman,
  ringkasPemetaan,
  superAdminKah,
  susunDaftarIsianTxt,
  terapkanKeputusan,
  terapkanPemetaan,
  terimaUsulanYakin,
  usulkanPemetaan,
  type KatalogVariabel,
} from "@/lib/blangko-sendiri";
import { buatDocx } from "@/lib/docx";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_BLANGKO_PRIBADI } from "@/server/db/schema";
import { FITUR_BLANGKO_SAYA_SEMUA_PERAN } from "@/lib/fitur-satker";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

vi.mock("@/server/modules/pengaturan-abt/service", () => ({
  cariPerkaraContoh: vi.fn(async (nomor: string) => ({ perkara: { perkaraId: 7, nomor, jenis: "Cerai Gugat" } })),
}));

vi.mock("@/server/modules/aleta-ecourt/penyelesai", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-ecourt/penyelesai")>();
  return {
    ...modul,
    selesaikanPenanda: vi.fn(async () => ({
      ok: true,
      nilai: new Map([["0046", { noVar: "0046", nilai: "NAMA REKAAN", asal: "uji" }]]),
      gagal: [],
      lingkaran: [],
      takDikenal: [],
      jumlahKueri: 0,
    })),
    lengkapiDariAbt: vi.fn(async () => ({ kosong: [] })),
  };
});

import {
  ajukanPaket,
  ambilBlangko,
  bacaBerkasBlangko,
  buatDariBerkas,
  buatDariTeks,
  daftarBlangko,
  eksporKePutusanMandiri,
  eksporUntukAbt,
  hapusBlangko,
  pratinjauBlangko,
  putuskanPaket,
  simpanIsi,
  simpanKeputusan,
  tarikPaket,
  unduhPaket,
  type AktorBlangko,
} from "@/server/modules/aleta-ecourt/blangko-sendiri";

/**
 * ============================================================================
 * BUAT BLANGKO SENDIRI (18 Okt 2026)
 * ============================================================================
 *
 * Semua berkas dan data di sini REKAAN - tidak ada data perkara asli.
 *
 *   1. migrasi 0073 (idx 68): berkas = schema.ts, jurnal tanpa lubang;
 *   2. deteksi isian dan usulan pemetaan (katalog rekaan);
 *   3. RTF/daftar isian tanpa kata nama aplikasi, tanpa properti berkas, tanpa contoh data;
 *   4. pembacaan RTF/DOCX; berkas lain ditolak;
 *   5. hak: peran pembuat, pemilik vs orang lain vs Super Admin;
 *   6. alur penuh: unggah -> putuskan -> pratinjau -> Putusan Mandiri -> paket.
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const KATALOG: KatalogVariabel[] = [
  { noVar: "0001", judul: "Nomor Perkara" },
  { noVar: "0046", judul: "Nama Penggugat/Pemohon" },
  { noVar: "0047", judul: "Nama Tergugat/Termohon" },
  { noVar: "0101", judul: "Tanggal Sidang" },
  { noVar: "0102", judul: "Tanggal Putusan" },
  { noVar: "0500", judul: "Nama Ketua Majelis" },
];

const NASKAH = [
  "PUTUSAN",
  "Nomor 123/Pdt.G/2026/PA.Xyz",
  "Penggugat bernama SITI CONTOH binti BUDI CONTOH, umur 35 tahun, bertempat tinggal di Desa Contoh, Kecamatan Fiktif;",
  "Nama Tergugat : ..................",
  "Sidang dilaksanakan pada hari Senin, 3 Agustus 2026 di ruang sidang;",
  "Diputus pada [tanggal putusan] oleh Ketua Majelis [nama ketua majelis];",
  "Penggugat #0046# hadir, nomor #9999# tidak dikenal;",
  'Firman Allah "dan ... mereka berkata" tetap utuh.',
];

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0073 - berkas = DDL schema.ts, jurnal tanpa lubang", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0073_aleta_blangko_pribadi.sql");

  it("jurnal: 0073 di idx 68 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0073_"))).toEqual([
      expect.objectContaining({ idx: 68, tag: "0073_aleta_blangko_pribadi" }),
    ]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_BLANGKO_PRIBADI, berjalan di pg-mem, ikut cadangan mode ingatan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual(
      [...DDL_BLANGKO_PRIBADI.tabel, ...DDL_BLANGKO_PRIBADI.indeks].map((s) => pernyataan(s)[0])
    );
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT id FROM aleta_blangko_pribadi")).toEqual([]);
    expect(kosong.public.many("SELECT id FROM aleta_blangko_pribadi_riwayat")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_blangko_pribadi");
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_blangko_pribadi_riwayat");
  });
});

// ─── 2. Deteksi & pemetaan ───────────────────────────────────────────────────

describe("deteksi isian dan usulan pemetaan", () => {
  const { bagian } = bagianDariParagraf(NASKAH);
  const isian = deteksiIsian(bagian);
  const pemetaan = usulkanPemetaan(bagian, isian, KATALOG);
  const cari = (jenis: string, asli: RegExp) => pemetaan.find((b) => b.jenis === jenis && asli.test(b.asli));

  it("judul dikenali tebal dan tengah; paragraf kosong dibuang", () => {
    expect(bagian[0]).toMatchObject({ teks: "PUTUSAN", rata: "tengah", tebal: true });
    expect(bagianDariParagraf(["", "  ", "isi"]).bagian).toHaveLength(1);
  });

  it("mengenali nomor perkara, nama, umur, alamat, tanggal, titik-titik, kurung, penanda", () => {
    const jenis = new Set(isian.map((i) => i.jenis));
    for (const j of ["nomor-perkara", "nama", "umur", "alamat", "tanggal", "titik", "kurung", "variabel"]) {
      expect(jenis.has(j as never), j).toBe(true);
    }
  });

  it("tiga titik di dalam kutipan tidak dianggap isian", () => {
    const kutipan = isian.filter((i) => i.bagian === bagian.length);
    expect(kutipan).toEqual([]);
  });

  it("rentang isian tepat pada teks asal (tidak saling tumpang)", () => {
    for (const i of isian) expect(bagian[i.bagian - 1].teks.slice(i.awal, i.akhir)).toBe(i.asli);
    const per = new Map<number, Array<[number, number]>>();
    for (const i of isian) per.set(i.bagian, [...(per.get(i.bagian) ?? []), [i.awal, i.akhir]]);
    for (const r of per.values()) {
      const urut = [...r].sort((a, b) => a[0] - b[0]);
      for (let n = 1; n < urut.length; n += 1) expect(urut[n][0]).toBeGreaterThanOrEqual(urut[n - 1][1]);
    }
  });

  it("nomor perkara diusulkan ke isian Nomor Perkara", () => {
    const b = cari("nomor-perkara", /123/);
    expect(b?.sasaran).toMatchObject({ tipe: "variabel", noVar: "0001" });
    expect(b?.status).toBe("usulan");
  });

  it("titik-titik setelah 'Nama Tergugat' diusulkan ke Tergugat, bukan Penggugat", () => {
    const b = cari("titik", /\.{5,}/);
    expect(b?.sasaran.noVar).toBe("0047");
    expect(b?.yakin).toBeGreaterThan(0.5);
  });

  it("nama penggugat diusulkan ke isian Penggugat; kurung tanggal putusan ke Tanggal Putusan", () => {
    expect(cari("nama", /SITI CONTOH/)?.sasaran.noVar).toBe("0046");
    expect(cari("kurung", /tanggal putusan/)?.sasaran.noVar).toBe("0102");
    expect(cari("kurung", /ketua majelis/)?.sasaran.noVar).toBe("0500");
  });

  it("tanggal sidang diusulkan ke Tanggal Sidang", () => {
    expect(cari("tanggal", /Agustus/)?.sasaran.noVar).toBe("0101");
  });

  it("penanda yang dikenal katalog terkonfirmasi; yang tidak dikenal tetap perlu ditinjau", () => {
    expect(cari("variabel", /0046/)).toMatchObject({ status: "dikonfirmasi", yakin: 1 });
    const asing = cari("variabel", /9999/);
    expect(asing?.status).toBe("usulan");
    expect(asing?.yakin).toBeLessThan(0.5);
  });

  it("tanpa padanan di katalog: diusulkan sebagai isian BARU, tidak dibuat", () => {
    const tanpaKatalog = usulkanPemetaan(bagian, isian, KATALOG.filter((k) => k.noVar !== "0500"));
    const b = tanpaKatalog.find((x) => x.jenis === "kurung" && /ketua majelis/.test(x.asli));
    expect(b?.sasaran).toMatchObject({ tipe: "baru", kunciData: "ketua_majelis" });
    expect(b?.status).toBe("usulan");
  });

  it("tidak ada petunjuk sama sekali -> dibiarkan, keyakinan rendah", () => {
    const { bagian: b2 } = bagianDariParagraf(["Hal ini ..................... begitulah."]);
    const p = usulkanPemetaan(b2, deteksiIsian(b2), KATALOG);
    expect(p[0]).toMatchObject({ status: "usulan" });
    expect(p[0].sasaran.tipe).toBe("tetap");
    expect(p[0].yakin).toBeLessThanOrEqual(0.2);
  });

  it("keputusan: nomor tidak sah ditolak; 'terima yakin' hanya yang tinggi dan bertipe isian ABT", () => {
    const sasaranRusak = () =>
      terapkanKeputusan(pemetaan, [{ id: pemetaan[0].id, status: "dikonfirmasi", sasaran: { tipe: "variabel", noVar: "12" } }]);
    expect(sasaranRusak).toThrow(/3 sampai 5 angka/);
    const hasil = terimaUsulanYakin(pemetaan, 0.8);
    for (const b of hasil.pemetaan) if (b.status === "dikonfirmasi") expect(b.sasaran.tipe).not.toBe("baru");
    expect(hasil.diterima).toBe(hasil.pemetaan.filter((b, n) => b.status === "dikonfirmasi" && pemetaan[n].status === "usulan").length);
  });
});

// ─── 3. RTF, daftar, kata terlarang ──────────────────────────────────────────

describe("RTF dan daftar isian untuk ABT", () => {
  const { bagian } = bagianDariParagraf(NASKAH);
  const isian = deteksiIsian(bagian);
  let pemetaan = usulkanPemetaan(bagian, isian, KATALOG);
  pemetaan = terapkanKeputusan(
    pemetaan,
    pemetaan.map((b) =>
      b.sasaran.tipe === "tetap" || b.jenis === "variabel"
        ? { id: b.id, status: "diabaikan" as const }
        : { id: b.id, status: "dikonfirmasi" as const, sasaran: b.sasaran }
    )
  );

  it("isian terkonfirmasi menjadi penanda; yang baru menjadi '...'", () => {
    const t = terapkanPemetaan(bagian, pemetaan);
    expect(t[1].teks).toBe("Nomor #0001#");
    expect(t.map((x) => x.teks).join("\n")).not.toContain("SITI CONTOH");
    const tanpaPadanan = usulkanPemetaan(bagian, isian, []);
    const semua = terapkanKeputusan(tanpaPadanan, tanpaPadanan.filter((b) => b.sasaran.tipe === "baru").map((b) => ({ id: b.id, status: "dikonfirmasi" as const, sasaran: b.sasaran })));
    expect(terapkanPemetaan(bagian, semua).map((x) => x.teks).join("\n")).toContain("...");
  });

  it("RTF polos: tanpa kelompok info, tanpa kata nama aplikasi, penanda utuh", () => {
    const rtf = bangunRtf(terapkanPemetaan(bagian, pemetaan));
    expect(rtf.startsWith("{\\rtf1")).toBe(true);
    expect(rtf).not.toMatch(/\\info|\\author|\\company|\\title/);
    expect(rtf).not.toMatch(/aleta/i);
    expect(rtf).toContain("#0001#");
    expect(rtf).toContain("\\par");
  });

  it("karakter khusus di-escape dan huruf non-ASCII menjadi \\uN", () => {
    const rtf = bangunRtf([{ urutan: 1, teks: "a{b}\\c é", rata: "kiri", tebal: true }]);
    expect(rtf).toContain("a\\{b\\}\\\\c \\u233?");
    expect(rtf).toContain("\\b ");
  });

  it("kata terlarang di isi terdeteksi; nama berkas dibersihkan", () => {
    const { bagian: b } = bagianDariParagraf(["aman", "Dicetak oleh ALETA hari ini", "aleta lagi"]);
    expect(bagianTerlarang(b)).toEqual([2, 3]);
    expect(namaBerkasAman("ALETA Putusan Verstek (Cerai).rtf")).toBe("putusan-verstek-cerai.rtf");
    expect(namaBerkasAman("aleta", "txt")).toBe("blangko.txt");
    expect(namaBerkasAman("Blangko Aleta Dgl.docx")).not.toMatch(/aleta/i);
  });

  it("daftar paket tanpa contoh data dari berkas asal dan tanpa kata nama aplikasi", () => {
    const daftar = daftarIsianPaket(pemetaan, KATALOG);
    expect(daftar.dipakai.map((d) => d.noVar)).toEqual(expect.arrayContaining(["0001", "0046", "0047", "0101", "0102", "0500"]));
    const txt = susunDaftarIsianTxt(daftar, { nama: "putusan rekaan", jenis: "putusan" });
    expect(txt).not.toMatch(/aleta/i);
    expect(txt).not.toContain("SITI CONTOH");
    expect(txt).toContain("#0001#");
    expect(ringkasPemetaan(pemetaan).belumDiputus).toBe(0);
  });

  it("baris cetak PDF disambung; perabot halaman dibuang", () => {
    expect(gabungBarisPdf(["Menimbang bahwa penggugat", "mendalilkan sesuatu.", "1 dari 3 Halaman", "7", "Mengadili:"])).toEqual([
      "Menimbang bahwa penggugat mendalilkan sesuatu.",
      "Mengadili:",
    ]);
    expect(bagianDariTeksBebas("satu\n\ndua\r\ntiga").bagian.map((b) => b.teks)).toEqual(["satu", "dua", "tiga"]);
  });
});

// ─── 4. Pembacaan berkas ─────────────────────────────────────────────────────

describe("membaca berkas blangko", () => {
  const enc = new TextEncoder();

  it("RTF: batas paragraf asli, tanpa tabel huruf", async () => {
    const rtf = bangunRtf(bagianDariParagraf(["Paragraf satu.", "Paragraf dua dengan [isian]."]).bagian);
    const h = await bacaBerkasBlangko(enc.encode(rtf), "uji.rtf");
    expect(h.asal).toBe("rtf");
    expect(h.bagian.map((b) => b.teks)).toEqual(["Paragraf satu.", "Paragraf dua dengan [isian]."]);
    expect(h.peringatan).toEqual([]);
  });

  it("DOCX: paragraf dibaca dari dokumen", async () => {
    const docx = buatDocx({ alinea: [{ teks: "Alinea pertama" }, { teks: "Alinea kedua ......" }] });
    const h = await bacaBerkasBlangko(new Uint8Array(docx), "uji.docx");
    expect(h.asal).toBe("docx");
    expect(h.bagian.map((b) => b.teks)).toEqual(["Alinea pertama", "Alinea kedua ......"]);
  });

  it("dikenali dari isi, bukan dari nama; DOC lama, kosong, dan terlalu besar ditolak", async () => {
    await expect(bacaBerkasBlangko(enc.encode("teks biasa"), "x.rtf")).rejects.toMatchObject({ status: 400 });
    await expect(bacaBerkasBlangko(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), "x.doc")).rejects.toMatchObject({ status: 422 });
    await expect(bacaBerkasBlangko(new Uint8Array(0), "x.rtf")).rejects.toMatchObject({ status: 400 });
    await expect(bacaBerkasBlangko(new Uint8Array(9 * 1024 * 1024), "x.rtf")).rejects.toMatchObject({ status: 413 });
  });
});

// ─── 5. Hak ──────────────────────────────────────────────────────────────────

describe("hak peran", () => {
  it("hanya hakim, panitera/panmud/PP, Admin, dan Super Admin yang membuat blangko sendiri", () => {
    for (const r of ["super-admin", "admin", "hakim", "ketua", "wakil-ketua", "panitera", "panitera-muda", "panitera-pengganti"]) {
      expect(bolehBuatBlangkoSendiri(r), r).toBe(true);
    }
    for (const r of ["jurusita", "pelaksana", "kasubag", "operator", "staf", "", null, undefined]) {
      expect(bolehBuatBlangkoSendiri(r as string), String(r)).toBe(false);
    }
    expect(superAdminKah("super-admin")).toBe(true);
    expect(superAdminKah("admin")).toBe(false);
  });
});

// ─── 6. Alur penuh (pg-mem) ──────────────────────────────────────────────────

describe("alur penuh: unggah, putuskan, pratinjau, putusan mandiri, paket", () => {
  let db: AletaDatabase;
  const hakimA: AktorBlangko = { id: "usr-hakim-a", name: "Hakim Rekaan A", roleId: "hakim" };
  const hakimB: AktorBlangko = { id: "usr-hakim-b", name: "Hakim Rekaan B", roleId: "hakim" };
  const superAdmin: AktorBlangko = { id: "usr-super", name: "Super Rekaan", roleId: "super-admin" };
  const jurusita: AktorBlangko = { id: "usr-js", name: "Jurusita Rekaan", roleId: "jurusita" };
  const enc = new TextEncoder();

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    const sekarang = new Date().toISOString();
    for (const k of KATALOG) {
      await db.run(
        `INSERT INTO aleta_kamus_variabel (no_var, nama, jenis, kelas, dibuat_at, diubah_at) VALUES (?, ?, 'data_sql', 'A', ?, ?)`,
        [k.noVar, k.judul, sekarang, sekarang]
      );
    }
  }, 120000);
  afterAll(async () => {
    await db?.close();
  });

  const rtfRekaan = () => enc.encode(bangunRtf(bagianDariParagraf(NASKAH).bagian));

  it("TAHAP AWAL (18 Okt, butir 10): saklar Fitur Satker mati -> hanya Super Admin; dibuka -> peran berhak lain ikut", async () => {
    // Bawaan katalog: mati. Hakim yang berhak menurut peran pun ditolak sampai Super Admin membuka saklarnya.
    await expect(buatDariTeks(db, hakimA, { nama: "x", teks: "isi" })).rejects.toMatchObject({ status: 403 });
    await expect(daftarBlangko(db, hakimA)).rejects.toMatchObject({ status: 403 });
    const punyaSuper = await buatDariTeks(db, superAdmin, { nama: "Milik super", teks: "Isi blangko super admin" });
    expect(punyaSuper.milikSaya).toBe(true);
    expect((await daftarBlangko(db, superAdmin)).length).toBe(1);
    await hapusBlangko(db, superAdmin, punyaSuper.id);
    // Saklar dibuka (seperti simpanPengaturanFitur): tanpa perubahan kode, hakim langsung boleh.
    await tulisSetelanSistem(db, KUNCI_FITUR_SATKER, { fitur: { [FITUR_BLANGKO_SAYA_SEMUA_PERAN]: "stabil" }, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());
    expect((await daftarBlangko(db, hakimA)).length).toBe(0);
  });

  it("peran lain ditolak 403; unggah menghasilkan blangko pribadi dengan usulan", async () => {
    await expect(buatDariTeks(db, jurusita, { nama: "x", teks: "isi" })).rejects.toMatchObject({ status: 403 });
    const b = await buatDariBerkas(db, hakimA, { bita: rtfRekaan(), namaBerkas: "Putusan Rekaan.rtf", jenis: "putusan" });
    expect(b).toMatchObject({ nama: "Putusan Rekaan", jenis: "putusan", asal: "rtf", milikSaya: true, keadaan: "draf" });
    expect(b.pemetaan.length).toBeGreaterThan(5);
    expect(b.ringkasPemetaan.belumDiputus).toBeGreaterThan(0);
    (globalThis as { __id?: string }).__id = b.id;
  });

  it("orang lain tidak melihat; Super Admin melihat tetapi tidak mengubah; pemilik mengubah", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    expect((await daftarBlangko(db, hakimB)).length).toBe(0);
    await expect(ambilBlangko(db, hakimB, id)).rejects.toMatchObject({ status: 404 });
    await expect(simpanIsi(db, hakimB, id, { nama: "curian" })).rejects.toMatchObject({ status: 404 });
    expect((await ambilBlangko(db, superAdmin, id)).hak).toEqual({ ubah: false, putuskanPaket: true });
    await expect(simpanIsi(db, superAdmin, id, { nama: "ubah orang" })).rejects.toMatchObject({ status: 403 });
    await expect(simpanKeputusan(db, superAdmin, id, { terimaYakin: 0.8 })).rejects.toMatchObject({ status: 403 });
    expect((await daftarBlangko(db, superAdmin)).length).toBe(0);
    expect((await daftarBlangko(db, superAdmin, { semua: true })).length).toBe(1);
    expect((await daftarBlangko(db, hakimA, { semua: true })).length).toBe(1);
    expect((await simpanIsi(db, hakimA, id, { nama: "Putusan Rekaan Baru" })).nama).toBe("Putusan Rekaan Baru");
  });

  it("belum semua diputuskan: ekspor ABT, putusan mandiri, dan paket ditolak 409", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    await expect(eksporUntukAbt(db, hakimA, id)).rejects.toMatchObject({ status: 409 });
    await expect(eksporKePutusanMandiri(db, hakimA, id)).rejects.toMatchObject({ status: 409 });
    await expect(ajukanPaket(db, hakimA, id)).rejects.toMatchObject({ status: 409 });
  });

  it("memutuskan semua isian lalu pratinjau terisi untuk satu perkara rekaan", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    const awal = await ambilBlangko(db, hakimA, id);
    const hasil = await simpanKeputusan(db, hakimA, id, {
      terimaYakin: 0.5,
      keputusan: awal.pemetaan.map((b) =>
        b.sasaran.tipe === "variabel" && b.yakin >= 0.5
          ? { id: b.id, status: "dikonfirmasi" as const, sasaran: b.sasaran }
          : { id: b.id, status: "diabaikan" as const }
      ),
    });
    expect(hasil.ringkasPemetaan.belumDiputus).toBe(0);

    const p = await pratinjauBlangko(db, hakimA, id, { nomor: "999/Pdt.G/2026/PA.Xyz", docx: true });
    expect(p.nomorPerkara).toBe("999/Pdt.G/2026/PA.Xyz");
    expect(p.alinea.length).toBeGreaterThan(5);
    expect(p.alinea.map((a) => a.teks).join("\n")).toContain("NAMA REKAAN");
    expect(p.docxBase64.length).toBeGreaterThan(100);
    await expect(pratinjauBlangko(db, hakimB, id, { nomor: "1/Pdt.G/2026/PA.Xyz" })).rejects.toMatchObject({ status: 404 });
  });

  it("Putusan Mandiri: pemilik saja; hasil berbentuk bagian pustaka", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    await expect(eksporKePutusanMandiri(db, superAdmin, id)).rejects.toMatchObject({ status: 403 });
    const h = await eksporKePutusanMandiri(db, hakimA, id);
    expect(h.jumlahBagian).toBe(NASKAH.length);
    expect(h.bagian[1]).toMatchObject({ selalu: true, urutan: 2 });
    const rincian = await ambilBlangko(db, hakimA, id);
    expect(rincian).toMatchObject({ untukPutusanMandiri: true, keadaan: "siap" });
  });

  it("ABT: RTF dan daftar bersih; blangko memuat kata terlarang ditolak 422", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    const berkas = await eksporUntukAbt(db, hakimA, id);
    expect(berkas.namaBerkas).toBe("putusan-rekaan-baru.rtf");
    expect(berkas.rtf).not.toMatch(/aleta/i);
    expect(berkas.daftarTxt).not.toMatch(/aleta/i);
    expect(berkas.rtf).not.toContain("SITI CONTOH");

    const kotor = await buatDariTeks(db, hakimA, { nama: "Kotor", jenis: "lain", teks: "Dicetak oleh aleta sistem" });
    expect(kotor.peringatan.join(" ")).toMatch(/kata nama aplikasi/);
    const keputusan = kotor.pemetaan.map((b) => ({ id: b.id, status: "diabaikan" as const }));
    await simpanKeputusan(db, hakimA, kotor.id, { keputusan });
    await expect(eksporUntukAbt(db, hakimA, kotor.id)).rejects.toMatchObject({ status: 422 });
    await hapusBlangko(db, hakimA, kotor.id);
  });

  it("paket: diajukan pemilik, diputus Super Admin saja; mengubah isi membatalkan paket", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    const aju = await ajukanPaket(db, hakimA, id);
    expect(aju.paket.status).toBe("menunggu");
    await expect(ajukanPaket(db, hakimA, id)).rejects.toMatchObject({ status: 409 });
    await expect(putuskanPaket(db, hakimA, id, { setuju: true })).rejects.toMatchObject({ status: 403 });
    await expect(putuskanPaket(db, hakimB, id, { setuju: true })).rejects.toMatchObject({ status: 403 });
    await expect(putuskanPaket(db, superAdmin, id, { setuju: false })).rejects.toMatchObject({ status: 400 });
    const paket = await unduhPaket(db, superAdmin, id);
    expect(paket.rtf.startsWith("{\\rtf1")).toBe(true);
    expect(paket.rtf).not.toMatch(/aleta/i);
    await expect(unduhPaket(db, hakimB, id)).rejects.toMatchObject({ status: 404 });
    const setuju = await putuskanPaket(db, superAdmin, id, { setuju: true, catatan: "dipasang manual" });
    expect(setuju.paket).toMatchObject({ status: "disetujui", diputuskanOleh: "Super Rekaan", catatan: "dipasang manual" });
    await expect(tarikPaket(db, hakimA, id)).rejects.toMatchObject({ status: 409 });

    const sunting = await simpanIsi(db, hakimA, id, { teks: `${NASKAH.join("\n")}\nParagraf tambahan` });
    expect(sunting.paket.status).toBe("tidak");
    expect(sunting.untukPutusanMandiri).toBe(false);
    expect(sunting.ringkasPemetaan.belumDiputus).toBe(0);
    await expect(unduhPaket(db, hakimA, id)).rejects.toMatchObject({ status: 404 });
  });

  it("hapus: pemilik atau Super Admin; orang lain 404", async () => {
    const id = (globalThis as { __id?: string }).__id as string;
    await expect(hapusBlangko(db, hakimB, id)).rejects.toMatchObject({ status: 404 });
    await hapusBlangko(db, superAdmin, id);
    expect((await daftarBlangko(db, hakimA)).length).toBe(0);
  });
});
