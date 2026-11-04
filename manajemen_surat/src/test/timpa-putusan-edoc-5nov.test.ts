// @vitest-environment node
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { nilaiPraperiksa, type FaktaPraperiksa, type UsulanPutusan } from "@/lib/praperiksa-putusan";
import { bersihkanPilihanForm, bersihkanTimpa, ringkasPilihanForm, timpaSesuaiLangkah, witaKeMs } from "@/lib/putusan-terjadwal";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import type { BarisButir } from "@/server/modules/putusan-terjadwal/dasar";
import { jalankanEdocButir, type DepsPelaksana } from "@/server/modules/putusan-terjadwal/pelaksana";

import { NOMOR, barisPutusan, rtf } from "./putusan-terjadwal-bahan";

/**
 * ============================================================================
 * MENIMPA - Putusan Akhir, e-Doc putusan, e-Doc anonimisasi (5 Nov 2026)
 * ============================================================================
 *
 * Permintaan hakim: yang sudah terisi (oleh petugas di SIPP maupun oleh ALETA) tetap dapat dicentang dan
 * dijalankan lagi, dan hasilnya MENIMPA tanpa langkah hapus lebih dulu - seperti SIPP saat petugas
 * menyimpan ulang. Aturan yang dijaga di sini dengan MENJALANKAN kodenya:
 *
 *   A. bot (putusanUnggahService.unggahPutusan, basis data SIPP tiruan yang mencatat tiap kueri):
 *      tanpa tanda timpa per slot -> "sudah_ada" dan TIDAK ADA tulisan sama sekali; dengan tanda ->
 *      bentuk tulisan sama dengan unggah biasa (UPDATE kolom dokumen + audit UNGGAH), baris Direktori
 *      Putusan diperbarui seperti REPLACE SIPP (flag_sync dan link_dirput dikosongkan, "Publikasi"
 *      dipertahankan), tidak ada DELETE, berkas lama tidak dihapus; keadaan lama gagal dibaca = berhenti;
 *   B. rute bot: hanya `true` yang menimpa;
 *   C. lib: pilihan.timpa bersih, disaring menurut langkah yang dipilih; praperiksa "sudah putus" tidak
 *      menahan hanya bila petugas mencentang;
 *   D. pelaksana server (jalankanEdocButir): jadwal lama / tanpa tanda tetap melewati, bertanda menimpa
 *      per slot, pemeriksaan isi / hak / kunci tetap berlaku;
 *   E. layanan jadwal (pg-mem): tanda tersimpan pada barisnya dan disaring menurut langkah;
 *   F. modul e-Doc di ekstensi (putusan-edoc-sekaligus.js sungguhan di jsdom): tanda per slot, laporan
 *      "diganti" terpisah, tanda ikut dititipkan bila halaman dimuat ulang.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const AKAR_EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");

// ============================================================================
// A. putusanUnggahService dengan basis data SIPP tiruan
// ============================================================================
type Kueri = { sql: string; params: unknown[] };
const folderUji: string[] = [];

type KeadaanSipp = {
  /** Isi kolom amar_putusan_dok / amar_putusan_anonimisasi_dok sebelum unggah ("" = belum ada). */
  dokPutusan?: string;
  dokAnonim?: string;
  /** Baris dirput_dokumen lama (id, published); tanpa = tidak ada. */
  dirput?: { id: number; published: number };
  gagalBacaPutusan?: boolean;
  gagalBacaDirput?: boolean;
  tanpaKolomDirput?: boolean;
  /** Akun basis data bot tidak punya hak DELETE: REPLACE ditolak dengan galat akses 1142. */
  tolakDelete?: boolean;
  /** REPLACE gagal karena sebab lain (bukan hak). */
  replaceGagalLain?: boolean;
  /** Tabel dirput_dokumen tiruan menurut kunci utama, untuk membuktikan REPLACE tidak menggandakan. */
  tabelDirput?: Map<string, { id: number; published: number }>;
};

function muatLayanan(k: KeadaanSipp = {}) {
  const Module = require_("module") as unknown as new (id: string) => { filename: string; loaded: boolean; exports: unknown };
  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };
  const kueri: Kueri[] = [];
  const akar = fs.mkdtempSync(path.join(process.env.TMP || process.env.TEMP || os.tmpdir(), "aleta-uji-timpa-"));
  folderUji.push(akar);
  let konversi = 0;

  pasang(require_.resolve(path.join(akarBot, "db_config")), {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      const s = String(sql);
      kueri.push({ sql: s, params });
      if (s.includes("SELECT tanggal_putusan")) {
        if (k.gagalBacaPutusan) return balik(new Error("koneksi putus"), null);
        return balik(null, [{ tanggal_putusan: "2026-09-01", amar_putusan_dok: k.dokPutusan ?? "", amar_putusan_anonimisasi_dok: k.dokAnonim ?? "" }]);
      }
      if (s.includes("dirput_dokumen_ref")) return balik(null, [{ ref: 89 }]);
      if (s.includes("SELECT id, published FROM dirput_dokumen")) {
        if (k.gagalBacaDirput) return balik(new Error("tabel terkunci"), null);
        return balik(null, k.dirput ? [k.dirput] : []);
      }
      if (s.includes("SELECT id FROM dirput_dokumen")) return balik(null, k.dirput ? [{ id: k.dirput.id }] : []);
      if (s.startsWith("SELECT")) return balik(null, []);
      if (/^\s*REPLACE\s+INTO\s+dirput_dokumen/i.test(s)) {
        if (k.tolakDelete) return balik(Object.assign(new Error("DELETE command denied to user for table dirput_dokumen"), { code: "ER_TABLEACCESS_DENIED_ERROR", errno: 1142 }), null);
        if (k.replaceGagalLain) return balik(Object.assign(new Error("Lock wait timeout exceeded"), { code: "ER_LOCK_WAIT_TIMEOUT", errno: 1205 }), null);
        // Meniru MariaDB: kunci utama (perkara_id, general_id, dokumen_ref_id, pihak_detil_id, pengajuan_id) - yang bentrok dibuang, id baru.
        if (k.tabelDirput) {
          const kunci = `${params[0]}|0|${params[1]}|0|1`;
          k.tabelDirput.set(kunci, { id: Math.max(0, ...[...k.tabelDirput.values()].map((x) => x.id)) + 1, published: Number(params[6]) });
        }
      }
      return balik(null, { affectedRows: 1 });
    },
  });
  pasang(require_.resolve(path.join(akarBot, "services/sippSkemaService")), {
    tabelAda: async () => true,
    kolomAda: async () => !k.tanpaKolomDirput,
  });
  pasang(require_.resolve(path.join(akarBot, "services/dokumenPenetapanService")), {
    periksaAkarSipp: () => ({ dapatDitulis: true, akar }),
    samakanPemilikSipp: () => undefined,
  });
  const cetakAsli = require_(path.join(akarBot, "services/abtCetakService")) as { kenaliDokumen: (b: Buffer) => string };
  pasang(require_.resolve(path.join(akarBot, "services/abtCetakService")), {
    kenaliDokumen: cetakAsli.kenaliDokumen,
    dokumenKePdf: async () => {
      konversi += 1;
      return { ok: true, pdf: Buffer.from("%PDF-1.4 hasil konversi tiruan") };
    },
  });
  const jalurLayanan = require_.resolve(path.join(akarBot, "services/putusanUnggahService"));
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const layanan = require_(jalurLayanan) as {
    unggahPutusan: (m: Record<string, unknown>) => Promise<{
      ok: boolean;
      antrean: boolean;
      alasan: string;
      pesan?: string;
      berkas: Array<{ jenis: string; ok: boolean; alasan?: string; pesan?: string; ditimpa?: boolean; jalur?: string; published?: number; jalurLama?: string; tulisDirput?: string }>;
    }>;
  };
  delete (require_.cache as Record<string, unknown>)[require_.resolve(path.join(akarBot, "services/abtCetakService"))];
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const jejak: Array<Record<string, unknown>> = [];
  const asli = layanan.unggahPutusan;
  layanan.unggahPutusan = (m) =>
    asli({
      catatJejak: async (j: Record<string, unknown>) => {
        jejak.push(j);
        return true;
      },
      ...m,
    });
  return { layanan, kueri, jejak, akar, konversi: () => konversi };
}

const RTF_PUTUSAN = Buffer.from("{\\rtf1\\ansi PUTUSAN BARU\\par Nomor 12/Pdt.G/2026/PA.Dgl}", "latin1");
const RTF_ANONIM = Buffer.from("{\\rtf1\\ansi PUTUSAN anonim BARU\\par Nomor 12/Pdt.G/2026/PA.Dgl}", "latin1");
const MASUKAN = { perkaraId: "901", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", olehUsername: "petugas uji", ip: "192.168.9.121" };
const LAMA_PUTUSAN = "resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.rtf";
const LAMA_ANONIM = "resources/file/anonimisasi/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_anonimisasi.rtf";

const tulis = (kueri: Kueri[]) => kueri.filter((q) => /^(INSERT|UPDATE|REPLACE|DELETE)\b/i.test(q.sql.trim()));
const tabelDan = (kueri: Kueri[]) =>
  tulis(kueri)
    .filter((q) => !q.sql.includes("sys_audittrail"))
    .map((q) => {
      const c = /^(INSERT\s+INTO|UPDATE|REPLACE\s+INTO|DELETE\s+FROM)\s+([a-z_]+)/i.exec(q.sql.trim());
      return [c?.[2] ?? "?", (c?.[1] ?? "?").split(/\s+/)[0].toUpperCase()];
    });
const auditDari = (kueri: Kueri[]) =>
  kueri
    .filter((q) => q.sql.includes("INSERT INTO sys_audittrail"))
    .map((q) => {
      const [datetime, ipaddress, username, tablename, formname, action, title, description] = q.params as string[];
      return { datetime, ipaddress, username, tablename, formname, action, title, description };
    });

afterAll(() => {
  for (const f of folderUji) fs.rmSync(f, { recursive: true, force: true });
});

describe("A. bot: menimpa hanya atas tanda eksplisit per slot", () => {
  it("TANPA tanda: kedua slot sudah ada -> 'sudah_ada', tidak satu tulisan pun ke SIPP, tidak ada konversi, tidak ada antrean", async () => {
    const { layanan, kueri, konversi, jejak } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dokAnonim: LAMA_ANONIM });
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    expect(h.ok).toBe(false);
    expect(h.berkas.map((b) => [b.jenis, b.ok, b.alasan])).toEqual([
      ["putusan", false, "sudah_ada"],
      ["anonimisasi", false, "sudah_ada"],
    ]);
    expect(h.berkas[0].pesan).toContain("Centang untuk mengganti");
    expect(tulis(kueri)).toEqual([]);
    expect(konversi()).toBe(0);
    expect(h.antrean).toBe(false);
    expect(jejak[0]).toMatchObject({ berhasil: false, alasan: "sudah_ada" });
  });

  it("timpa per slot BERDIRI SENDIRI: hanya anonimisasi bertanda -> putusan tetap tidak disentuh, anonimisasi ditimpa", async () => {
    const { layanan, kueri } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dokAnonim: LAMA_ANONIM, dirput: { id: 78, published: 1 } });
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM, timpa: { putusan: false, anonimisasi: true } });
    expect(h.ok).toBe(true);
    expect(h.berkas.map((b) => [b.jenis, b.ok, b.alasan ?? "", b.ditimpa ?? null])).toEqual([
      ["putusan", false, "sudah_ada", null],
      ["anonimisasi", true, "", true],
    ]);
    const audit = auditDari(kueri);
    expect(audit).toHaveLength(1);
    expect(audit[0].description).toContain("amar_putusan_anonimisasi_dok");
    // Seperti SIPP: anonimisasi sendirian TIDAK menambah antrean (insert_antrian_upload hanya di cabang putusan).
    expect(h.antrean).toBe(false);
    expect(tabelDan(kueri)).toEqual([
      ["perkara_putusan", "UPDATE"],
      ["dirput_dokumen", "REPLACE"],
    ]);
    // Slot putusan tidak menyentuh kolomnya sama sekali.
    expect(kueri.some((q) => q.sql.includes("SET amar_putusan_dok"))).toBe(false);
  });

  it("MENIMPA putusan: bentuk tulisan sama dengan unggah biasa (UPDATE kolom dokumen + audit UNGGAH), baris Direktori Putusan diperbarui seperti REPLACE SIPP, 'Publikasi' dipertahankan, TIDAK ADA DELETE/REPLACE/pengosongan", async () => {
    const { layanan, kueri } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 1 } });
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(h.ok).toBe(true);
    expect(h.berkas[0]).toMatchObject({ jenis: "putusan", ok: true, ditimpa: true, jalur: LAMA_PUTUSAN, jalurLama: LAMA_PUTUSAN });

    // Persis rangkaian SIPP: kolom dokumen -> audit UNGGAH -> REPLACE baris Direktori Putusan -> antrean.
    expect(tabelDan(kueri)).toEqual([
      ["perkara_putusan", "UPDATE"],
      ["dirput_dokumen", "REPLACE"],
      ["dirput_antrian", "INSERT"],
    ]);
    const ubahKolom = kueri.find((q) => q.sql.startsWith("UPDATE perkara_putusan"))!;
    expect(ubahKolom.sql).toBe("UPDATE perkara_putusan SET amar_putusan_dok = ? WHERE perkara_id = ?");
    expect(ubahKolom.params).toEqual([LAMA_PUTUSAN, 901]);
    const audit = auditDari(kueri);
    expect(audit.map((a) => [a.tablename, a.formname, a.action, a.title])).toEqual([
      ["perkara_putusan", "UPLOAD E-DOCS PUTUSAN AKHIR", "UNGGAH", "Unggah Dokumen Putusan Akhir <br />dengan perkara_id [id=901]"],
    ]);
    expect(audit[0].username).toBe("petugas uji");
    expect(audit[0].description).toContain(`<tr><td>amar_putusan_dok</td><td>${LAMA_PUTUSAN}</td></tr>`);

    // Meniru dirput_model::convert_insert (REPLACE dengan id NULL): kolom yang tidak ditulis SIPP dikosongkan,
    // created_date hari ini, "Publikasi" mengikuti baris lama (borang SIPP terpilih sesuai baris lama).
    // dirput_model::convert_insert: $this->db->replace('dirput_dokumen', id NULL, ...). Kolom yang tidak ditulis SIPP
    // (flag_sync, link_dirput, general_id, pihak_detil_id) tidak disebut - kembali ke bawaan tabel (NULL / 0).
    const dirput = kueri.find((q) => /^\s*REPLACE INTO dirput_dokumen/i.test(q.sql))!;
    expect(dirput.sql).toMatch(/VALUES \(NULL,\?,\?,\?,\?, 'SYSTEM', \?, 'SYSTEM', \?, NULL, 1, \?\)/);
    expect(dirput.sql).not.toMatch(/flag_sync|link_dirput/);
    expect(dirput.params).toEqual([
      901,
      89,
      "PA.Dgl_2026_Pdt.G_12_putusan_akhir.pdf",
      "resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.pdf",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      1,
    ]);
    expect(h.berkas[0].tulisDirput).toBe("REPLACE");
    // Putusan tidak dibatalkan: tidak ada DELETE terpisah, tidak ada UPDATE dirput, kolom dokumen tidak pernah dikosongkan.
    expect(kueri.some((q) => /^\s*DELETE\b/i.test(q.sql))).toBe(false);
    expect(kueri.some((q) => q.sql.includes("UPDATE dirput_dokumen"))).toBe(false);
    expect(kueri.some((q) => /perkara_putusan SET .*= (NULL|'')/i.test(q.sql))).toBe(false);
    expect(ubahKolom.params[0]).not.toBe("");
  });

  it("'Publikasi' putusan yang tadinya 0 tetap 0 saat ditimpa; anonimisasi selalu 1", async () => {
    const { layanan, kueri } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dokAnonim: LAMA_ANONIM, dirput: { id: 77, published: 0 } });
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM, timpa: { putusan: true, anonimisasi: true } });
    const ubah = kueri.filter((q) => /^\s*REPLACE INTO dirput_dokumen/i.test(q.sql));
    expect(ubah.map((q) => q.params[6])).toEqual([0, 1]);
  });

  it("berkas LAMA tidak dihapus (seperti SIPP): ekstensi lain tetap ada; nama yang sama tertimpa isinya", async () => {
    const { layanan, akar } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 0 } });
    const lamaPdf = path.join(akar, "resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.pdf");
    const lamaRtf = path.join(akar, LAMA_PUTUSAN);
    fs.mkdirSync(path.dirname(lamaRtf), { recursive: true });
    fs.writeFileSync(lamaRtf, "ISI LAMA RTF");
    const doc = path.join(akar, "resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.doc");
    fs.writeFileSync(doc, "SISA .doc LAMA");
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(fs.readFileSync(lamaRtf, "latin1")).toContain("PUTUSAN BARU");
    expect(fs.existsSync(lamaPdf)).toBe(true);
    expect(fs.readFileSync(doc, "utf8")).toBe("SISA .doc LAMA");
  });

  it("slot bertanda timpa yang BELUM ada ditulis sebagai biasa (INSERT, bukan ditimpa)", async () => {
    const { layanan, kueri } = muatLayanan({});
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(h.ok).toBe(true);
    expect(h.berkas[0].ditimpa).toBe(false);
    expect(tabelDan(kueri)).toContainEqual(["dirput_dokumen", "INSERT"]);
    expect(kueri.some((q) => q.sql.includes("UPDATE dirput_dokumen") || /^\s*REPLACE/i.test(q.sql))).toBe(false);
  });

  it("tanpa tanda dan belum ada: perilaku lama utuh (ditulis, tanpa 'ditimpa')", async () => {
    const { layanan } = muatLayanan({});
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    expect(h.ok).toBe(true);
    expect(h.berkas.map((b) => [b.ok, b.ditimpa])).toEqual([[true, false], [true, false]]);
  });

  it("baris Direktori Putusan lama gagal dibaca saat menimpa: slot itu BERHENTI sebelum menulis apa pun (tidak menimpa membabi buta)", async () => {
    const { layanan, kueri } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 1 }, gagalBacaDirput: true });
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(h.ok).toBe(false);
    expect(h.berkas[0]).toMatchObject({ ok: false, alasan: "keadaan_lama_tidak_terbaca" });
    expect(tulis(kueri)).toEqual([]);
  });

  it("keadaan putusan di SIPP gagal dibaca: berhenti seluruhnya, tidak diperlakukan 'belum ada'", async () => {
    const { layanan, kueri } = muatLayanan({ gagalBacaPutusan: true });
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(h.ok).toBe(false);
    expect(h.alasan).toBe("keadaan_tidak_terbaca");
    expect(tulis(kueri)).toEqual([]);
  });

  it("REPLACE tidak menggandakan: kunci yang sama diganti, id baru, jumlah baris tetap (meniru kunci utama SIPP)", async () => {
    const tabelDirput = new Map([["901|0|89|0|1", { id: 77, published: 1 }], ["902|0|89|0|1", { id: 78, published: 0 }]]);
    const { layanan } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 1 }, tabelDirput });
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(tabelDirput.size).toBe(2);
    expect(tabelDirput.get("901|0|89|0|1")).toEqual({ id: 79, published: 1 });
    expect(tabelDirput.get("902|0|89|0|1")).toEqual({ id: 78, published: 0 });
  });

  it("hak DELETE ditolak (galat akses 1142): jatuh ke UPDATE yang sama hasilnya, DICATAT di jejak - tidak gagal diam-diam", async () => {
    const { layanan, kueri, jejak } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 1 }, tolakDelete: true });
    const h = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    expect(h.ok).toBe(true);
    const upd = kueri.find((q) => q.sql.includes("UPDATE dirput_dokumen"))!;
    expect(upd.sql).toContain("flag_sync = NULL");
    expect(upd.sql).toContain("link_dirput = NULL");
    expect(upd.params[4]).toBe(1);
    expect(h.berkas[0].tulisDirput).toMatch(/^UPDATE \(REPLACE ditolak hak akses/);
    const langkah = (jejak[0] as { langkah: Array<{ tabel: string; aksi: string; keterangan: string }> }).langkah;
    const dirput = langkah.find((l) => l.tabel === "dirput_dokumen")!;
    expect(dirput.aksi).toBe("TULIS");
    expect(dirput.keterangan).toContain("REPLACE ditolak hak akses");
  });

  it("REPLACE sukses dicatat REPLACE di jejak", async () => {
    const { layanan, jejak } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 0 } });
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    const langkah = (jejak[0] as { langkah: Array<{ tabel: string; aksi: string }> }).langkah;
    expect(langkah.find((l) => l.tabel === "dirput_dokumen")!.aksi).toBe("REPLACE");
  });

  it("REPLACE gagal karena sebab LAIN (bukan hak): galat dilempar, tidak ditelan menjadi UPDATE", async () => {
    const { layanan } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 0 }, replaceGagalLain: true });
    await expect(layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } })).rejects.toThrow(/Lock wait timeout/);
  });

  it("kolom flag_sync/link_dirput tidak ada di SIPP satker: UPDATE cadangan tidak menyebutnya", async () => {
    const { layanan, kueri } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dirput: { id: 77, published: 0 }, tanpaKolomDirput: true, tolakDelete: true });
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, timpa: { putusan: true } });
    const dirput = kueri.find((q) => q.sql.includes("UPDATE dirput_dokumen"))!;
    expect(dirput.sql).not.toMatch(/flag_sync|link_dirput|keterangan/);
  });

  it("antrean Direktori Putusan: hanya unggah PUTUSAN yang mengantre (seperti SIPP); anonimisasi sendirian tidak", async () => {
    const a = muatLayanan({});
    const putusan = await a.layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN });
    expect(putusan.antrean).toBe(true);
    const b = muatLayanan({});
    const anonim = await b.layanan.unggahPutusan({ ...MASUKAN, pdfAnonimisasi: RTF_ANONIM });
    expect(anonim.ok).toBe(true);
    expect(anonim.antrean).toBe(false);
  });

  it("audit anonimisasi berbentuk SIPP: formname dan judul sama dengan putusan (fileupload_m.php:277-279,713), kolom anonimisasi di deskripsi", async () => {
    const { layanan, kueri } = muatLayanan({ dokAnonim: LAMA_ANONIM, dirput: { id: 78, published: 1 } });
    await layanan.unggahPutusan({ ...MASUKAN, pdfAnonimisasi: RTF_ANONIM, timpa: { anonimisasi: true } });
    const [a] = auditDari(kueri);
    expect([a.tablename, a.formname, a.action, a.title]).toEqual(["perkara_putusan", "UPLOAD E-DOCS PUTUSAN AKHIR", "UNGGAH", "Unggah Dokumen Putusan Akhir <br />dengan perkara_id [id=901]"]);
    expect(a.description).toBe(
      '<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1"><tr><th>Nama Kolom</th><th>Nilai</th></tr>' +
        `<tr><td>amar_putusan_anonimisasi_dok</td><td>${LAMA_ANONIM}</td></tr></table>`
    );
  });

  it("tak satu kata ALETA pun pada tulisan ke SIPP saat menimpa (SQL, parameter, audit)", async () => {
    const { layanan, kueri } = muatLayanan({ dokPutusan: LAMA_PUTUSAN, dokAnonim: LAMA_ANONIM, dirput: { id: 77, published: 1 } });
    await layanan.unggahPutusan({ ...MASUKAN, operator: "Pengguna Uji", pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM, timpa: { putusan: true, anonimisasi: true } });
    const t = tulis(kueri);
    expect(t.length).toBeGreaterThan(0);
    for (const q of t) {
      expect(/aleta/i.test(q.sql), q.sql).toBe(false);
      expect(/aleta/i.test(JSON.stringify(q.params)), q.sql).toBe(false);
    }
  });
});

// ============================================================================
// B. rute bot /sipp/putusan-unggah
// ============================================================================
function muatPenangan(hasil: Record<string, unknown> = { ok: true, berkas: [] }) {
  const isi = readFileSync(path.resolve(akarBot, "routes/internalGatewayRoutes.js"), "utf8");
  const awal = isi.indexOf('router.post("/sipp/putusan-unggah"');
  const akhir = isi.indexOf('router.get("/sipp/status-perkara"', awal);
  if (!(awal > 0 && akhir > awal)) throw new Error("Potongan rute tidak ditemukan.");
  const argumen: Array<Record<string, any>> = [];
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    Buffer,
    requireInternalToken: () => undefined,
    hakUnggahPutusanService: require_(path.resolve(akarBot, "services/hakUnggahPutusanService.js")),
    putusanUnggahService: {
      unggahPutusan: async (x: Record<string, any>) => {
        argumen.push(x);
        return { ...hasil };
      },
    },
    router: {
      post: (j: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[j] = f),
      get: (j: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[`GET ${j}`] = f),
    },
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#putusan-unggah" });
  const jalankan = async (body: unknown) => {
    let status = 200;
    let badan: any = null;
    const res = {
      status(s: number) {
        status = s;
        return res;
      },
      json(b: unknown) {
        badan = b;
        return res;
      },
    };
    await rute["/sipp/putusan-unggah"]({ body }, res);
    return { status, badan };
  };
  return { jalankan, argumen };
}
const BADAN_RUTE = { perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", putusanBase64: "eA==", anonimisasiBase64: "eA==", olehUsername: "x", peranPenekan: "hakim" };

describe("B. rute bot: hanya tanda `true` per slot yang menimpa", () => {
  it("tanpa tanda: kedua slot tidak menimpa", async () => {
    const { jalankan, argumen } = muatPenangan();
    await jalankan(BADAN_RUTE);
    expect(argumen[0].timpa).toEqual({ putusan: false, anonimisasi: false });
  });

  it("satu tanda hanya membuka satu slot", async () => {
    const { jalankan, argumen } = muatPenangan();
    await jalankan({ ...BADAN_RUTE, timpaAnonim: true });
    await jalankan({ ...BADAN_RUTE, timpaPutusan: true });
    expect(argumen.map((a) => a.timpa)).toEqual([
      { putusan: false, anonimisasi: true },
      { putusan: true, anonimisasi: false },
    ]);
  });

  it("nilai yang bukan boolean true ('1', 1, 'true', 'ya') TIDAK menimpa - menimpa tidak pernah bawaan", async () => {
    const { jalankan, argumen } = muatPenangan();
    for (const v of ["1", 1, "true", "ya", [true], {}]) await jalankan({ ...BADAN_RUTE, timpaPutusan: v, timpaAnonim: v });
    expect(argumen.every((a) => a.timpa.putusan === false && a.timpa.anonimisasi === false)).toBe(true);
  });

  it("penolakan seluruhnya ('sudah_ada') membawa kalimat per slot ke gerbang (error) dan status 400", async () => {
    const { jalankan } = muatPenangan({ ok: false, alasan: "sudah_ada", berkas: [{ jenis: "putusan", ok: false, alasan: "sudah_ada", pesan: "e-Doc putusan sudah ada di SIPP dan tidak diganti." }] });
    const { status, badan } = await jalankan(BADAN_RUTE);
    expect(status).toBe(400);
    expect(badan.error).toBe("e-Doc putusan sudah ada di SIPP dan tidak diganti.");
    expect(badan.berkas).toHaveLength(1);
  });

  it("hak peran tetap diperiksa lebih dulu: peran PP + tanda timpa tetap 403, layanan tidak dipanggil", async () => {
    const { jalankan, argumen } = muatPenangan();
    const { status } = await jalankan({ ...BADAN_RUTE, peranPenekan: "panitera-pengganti", timpaPutusan: true });
    expect(status).toBe(403);
    expect(argumen).toHaveLength(0);
  });
});

// ============================================================================
// C. lib: pilihan.timpa dan praperiksa
// ============================================================================
describe("C. lib: tanda timpa pada pilihan jadwal", () => {
  it("bersihkanTimpa: hanya `true` yang lolos; sampah dibuang", () => {
    expect(bersihkanTimpa({ form: true, putusan: "1", anonim: 1 })).toEqual({ form: true });
    expect(bersihkanTimpa(null)).toEqual({});
    expect(bersihkanTimpa("x")).toEqual({});
    expect(bersihkanTimpa({ form: true, putusan: true, anonim: true })).toEqual({ form: true, putusan: true, anonim: true });
  });

  it("jadwal LAMA (tanpa timpa) menghasilkan pilihan tanpa timpa - tidak pernah menimpa", () => {
    expect(bersihkanPilihanForm({ statusPutusan: "Dikabulkan", verstek: "Y" })).toEqual({ statusPutusan: "Dikabulkan", verstek: "Y" });
    expect(bersihkanPilihanForm({})).toEqual({});
    expect(bersihkanPilihanForm({ timpa: { form: "ya" } })).toEqual({});
  });

  it("ringkasan form TIDAK berubah tanpa tanda; dengan tanda menyebut apa yang diganti", () => {
    expect(ringkasPilihanForm({})).toBe("Status putusan: dipilih ALETA dari bunyi amar · Verstek: dipilih ALETA dari kehadiran para pihak");
    expect(ringkasPilihanForm({ timpa: { form: true, anonim: true } })).toContain("Mengganti yang sudah ada: Putusan Akhir, e-Doc anonimisasi");
  });

  it("tanda hanya berlaku untuk langkah yang dipilih pada butir itu", () => {
    const p = bersihkanPilihanForm({ verstek: "Y", timpa: { form: true, putusan: true, anonim: true } });
    expect(timpaSesuaiLangkah(p, { isi: true, putusan: false, anonim: false })).toEqual({ verstek: "Y", timpa: { form: true } });
    expect(timpaSesuaiLangkah(p, { isi: false, putusan: false, anonim: true })).toEqual({ verstek: "Y", timpa: { anonim: true } });
    expect(timpaSesuaiLangkah(p, { isi: false, putusan: false, anonim: false })).toEqual({ verstek: "Y" });
  });
});

const fakta = (ekstra: Partial<FaktaPraperiksa> = {}): FaktaPraperiksa =>
  ({
    nomorPerkara: NOMOR,
    jenisPerkara: "Cerai Gugat",
    petitum: "",
    jadwal: [{ tanggalSidang: "2026-09-09", agenda: "Putusan", ditunda: false }],
    majelis: [],
    pihak: [],
    anak: [],
    putusan: { ada: true, tanggalPutusan: "2026-09-09", statusPutusan: "Dikabulkan", verstek: "Y" },
    ecourt: { terdaftar: null, pihak: [] },
    hariIni: "2026-10-01",
    ...ekstra,
  }) as unknown as FaktaPraperiksa;
const usulan = (): UsulanPutusan => ({ nomorPerkara: NOMOR, tanggalPutusan: "2026-09-09", statusPutusan: "Dikabulkan", verstek: "Y", amar: "1. Mengabulkan gugatan Penggugat;", naskah: "" });

describe("C. praperiksa: 'sudah putus' menahan KECUALI petugas mencentang mengganti", () => {
  const kode = (r: ReturnType<typeof nilaiPraperiksa>, tingkat: string) => r.temuan.filter((t) => t.tingkat === tingkat).map((t) => t.kode);

  it("tanpa tanda timpa: menahan seperti semula", () => {
    const r = nilaiPraperiksa(fakta(), usulan());
    expect(kode(r, "hentikan")).toContain("sudah-putus");
    expect(r.hentikan).toBe(true);
  });

  it("timpa true: hanya catatan - tidak menahan; temuan tetap disebut", () => {
    const r = nilaiPraperiksa(fakta(), usulan(), { timpa: true });
    expect(kode(r, "hentikan")).not.toContain("sudah-putus");
    expect(kode(r, "catatan")).toContain("sudah-putus");
    expect(r.temuan.find((t) => t.kode === "sudah-putus")!.judul).toContain("sengaja menimpa");
  });

  it("timpa true TIDAK melonggarkan pemeriksaan lain: amar yang bertentangan tetap menahan", () => {
    const r = nilaiPraperiksa(fakta(), { ...usulan(), amar: "1. Menolak gugatan Penggugat seluruhnya;", statusPutusan: "Dikabulkan" }, { timpa: true });
    expect(r.hentikan).toBe(true);
    expect(kode(r, "hentikan")).not.toContain("sudah-putus");
  });

  it("nilai selain `true` pada opsi tidak melonggarkan", () => {
    const r = nilaiPraperiksa(fakta(), usulan(), { timpa: "ya" as unknown as boolean });
    expect(kode(r, "hentikan")).toContain("sudah-putus");
  });
});

// ============================================================================
// D. pelaksana server: jalankanEdocButir
// ============================================================================
const NOMOR_BUTIR = "12/Pdt.G/2026/PA.Dgl";

function baris(ekstra: Partial<BarisButir> = {}): BarisButir {
  return {
    id: "ptb-1",
    jadwal_id: "ptj-1",
    urut: 1,
    perkara_id: "9012",
    nomor_perkara: NOMOR_BUTIR,
    jenis_perkara: "Cerai Gugat",
    pemilik_id: "usr-hakim",
    akun_sipp: "hakim.satu",
    nama_sipp: "",
    peran: "hakim",
    ip: "192.168.9.97",
    waktu_rencana: "2026-10-21T00:00:00.000Z",
    langkah_isi: 0,
    langkah_putusan: 1,
    langkah_anonim: 1,
    status_isi: "tidak",
    status_putusan: "jalan",
    status_anonim: "jalan",
    catatan_isi: "",
    catatan_putusan: "",
    catatan_anonim: "",
    status: "jalan",
    pilihan_json: "{}",
    berkas_id: "ptf-1",
    berkas_nama: "putusan.rtf",
    berkas_bentuk: "rtf",
    berkas_ukuran: 100,
    berkas_sha256: "",
    berkas_jalur: "ptj/1.rtf",
    berkas_hapus_pada: "",
    percobaan: 0,
    klaim_oleh: "pelaksana",
    klaim_sampai: "",
    tunggu_sampai: "",
    edoc_sesudah: "",
    mulai_pada: "",
    selesai_pada: "",
    dilihat_pada: "",
    dibuat_pada: "",
    diubah_pada: "",
    ...ekstra,
  } as BarisButir;
}

type Dunia = {
  ada?: { putusan: boolean; anonim: boolean };
  /** Bita naskah di penyimpanan. */
  naskah?: Uint8Array;
  cekGagal?: boolean;
  peran?: string;
  sisa?: Array<{ jenis: string; kata: string; konteks: string }>;
  ditimpaBot?: boolean;
  kunciSibuk?: boolean;
};
function dunia(o: Dunia = {}) {
  const unggah: Array<Record<string, unknown>> = [];
  const urut: string[] = [];
  const naskah = o.naskah ?? rtf(barisPutusan(NOMOR_BUTIR));
  const keadaan = { putusan: o.ada?.putusan ?? false, anonim: o.ada?.anonim ?? false };
  const deps: DepsPelaksana = {
    sekarang: () => new Date(witaKeMs("2026-10-21 09:00")),
    acak: () => 0.5,
    bacaBerkas: async () => naskah,
    hapusBerkas: async () => true,
    muatPengguna: async (_db, id) => ({ id, name: "Hakim Satu", roleId: o.peran ?? "hakim", isActive: true }),
    periksaMilik: async () => undefined,
    ambilKunci: async () => {
      urut.push("kunci");
      return o.kunciSibuk ? { ok: false, alasan: "sedang_dikerjakan", oleh: "Panitera" } : { ok: true, token: "t" };
    },
    lepasKunci: async () => void urut.push("lepas"),
    cekSlot: async () => {
      urut.push("cek");
      if (o.cekGagal) return { ok: false, sebab: "SIPP belum dapat dibaca." };
      return { ok: true, adaBaris: true, adaPutusan: keadaan.putusan, adaAnonim: keadaan.anonim };
    },
    konteksPihak: async () => ({ namaPihak: ["Wulandari binti Kartasasmita", "Hendrawan bin Sulaiman"], sebab: "" }),
    ubahKeRtf: async () => ({ ok: true, bita: naskah }),
    anonimkan: async (_r, nomor) => ({ ok: true, bita: rtf(barisPutusan(nomor, { anonim: true })), sisa: o.sisa ?? [] }),
    unggah: async (m) => {
      urut.push("unggah");
      unggah.push(m as unknown as Record<string, unknown>);
      const berkas: Array<{ jenis: string; ok: boolean; ditimpa?: boolean }> = [];
      if (m.putusan) keadaan.putusan = true;
      if (m.anonimisasi) keadaan.anonim = true;
      if (m.putusan) berkas.push({ jenis: "putusan", ok: true, ...(o.ditimpaBot !== false && m.timpaPutusan ? { ditimpa: true } : {}) });
      if (m.anonimisasi) berkas.push({ jenis: "anonimisasi", ok: true, ...(o.ditimpaBot !== false && m.timpaAnonim ? { ditimpa: true } : {}) });
      return { ok: true, berkas };
    },
    muatLibur: async () => () => false,
  };
  return { deps, unggah, urut };
}
const jalan = (d: ReturnType<typeof dunia>, b: BarisButir) => jalankanEdocButir({} as AletaDatabase, d.deps, b);

describe("D. pelaksana server: menimpa hanya bila butir bertanda, per slot", () => {
  it("JADWAL LAMA (pilihan kosong) / tanpa tanda: yang sudah ada tetap DILEWATI dan tidak ada yang dikirim", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true } });
    const h = await jalan(d, baris({ pilihan_json: "{}" }));
    expect(h.putusan).toMatchObject({ status: "dilewati" });
    expect(h.anonim).toMatchObject({ status: "dilewati" });
    expect(d.unggah).toHaveLength(0);
  });

  it("jadwal lama dengan pilihan form saja (tanpa timpa) juga tidak menimpa", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true } });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ statusPutusan: "Dikabulkan", verstek: "Y" }) }));
    expect(h.putusan?.status).toBe("dilewati");
    expect(d.unggah).toHaveLength(0);
  });

  it("kedua slot bertanda: SATU kiriman dengan tanda per slot; dilaporkan 'Ditimpa' (bukan 'Terunggah')", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true } });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(d.unggah).toHaveLength(1);
    expect(d.unggah[0]).toMatchObject({ timpaPutusan: true, timpaAnonim: true, perkaraId: "9012", olehUsername: "hakim.satu", peranPenekan: "hakim" });
    expect(h.putusan).toMatchObject({ status: "selesai" });
    expect(h.putusan?.catatan).toMatch(/^Ditimpa/);
    expect(h.anonim?.catatan).toMatch(/^Ditimpa/);
  });

  it("hanya anonimisasi bertanda: putusan dilewati dan TIDAK ikut dikirim; tanda hanya untuk anonimisasi", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true } });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { anonim: true } }) }));
    expect(h.putusan?.status).toBe("dilewati");
    expect(d.unggah).toHaveLength(1);
    expect(d.unggah[0].putusan).toBeUndefined();
    expect(d.unggah[0].anonimisasi).toBeInstanceOf(Uint8Array);
    expect(d.unggah[0].timpaAnonim).toBe(true);
    expect(d.unggah[0]).not.toHaveProperty("timpaPutusan");
    expect(h.anonim?.catatan).toMatch(/^Ditimpa/);
  });

  it("tanda timpa tetapi slot BELUM ada di SIPP: ditulis biasa tanpa tanda, dilaporkan 'Terunggah'", async () => {
    const d = dunia({ ada: { putusan: false, anonim: false } });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(d.unggah[0]).not.toHaveProperty("timpaPutusan");
    expect(d.unggah[0]).not.toHaveProperty("timpaAnonim");
    expect(h.putusan?.catatan).toMatch(/^Terunggah/);
  });

  it("tanda timpa pada langkah yang TIDAK dipilih butir diabaikan", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true } });
    const h = await jalan(d, baris({ langkah_putusan: 0, status_putusan: "tidak", pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(h.putusan).toBeUndefined();
    expect(d.unggah[0]).not.toHaveProperty("timpaPutusan");
    expect(d.unggah[0].putusan).toBeUndefined();
  });

  it("cek SIPP gagal walau bertanda timpa: ditunda, TIDAK ada yang diunggah (jangan menimpa membabi buta)", async () => {
    const d = dunia({ cekGagal: true });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(h.tunda).toBeTruthy();
    expect(d.unggah).toHaveLength(0);
  });

  it("pemeriksaan isi tetap berlaku saat menimpa: naskah milik perkara lain ditolak, tidak dikirim", async () => {
    const d = dunia({ ada: { putusan: true, anonim: false }, naskah: rtf(barisPutusan("99/Pdt.G/2026/PA.Dgl")) });
    const h = await jalan(d, baris({ langkah_anonim: 0, status_anonim: "tidak", pilihan_json: JSON.stringify({ timpa: { putusan: true } }) }));
    expect(h.putusan?.status).toBe("gagal");
    expect(d.unggah).toHaveLength(0);
  });

  it("anonimisasi yang masih memuat data pribadi TERTAHAN saat menimpa - e-Doc anonimisasi lama tidak disentuh, putusan yang bertanda tetap ditimpa", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true }, sisa: [{ jenis: "NIK", kata: "7271010101010001", konteks: "NIK 7271010101010001" }] });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(h.anonim?.status).toBe("tertahan");
    expect(d.unggah).toHaveLength(1);
    expect(d.unggah[0].anonimisasi).toBeUndefined();
    expect(d.unggah[0]).not.toHaveProperty("timpaAnonim");
    expect(d.unggah[0].timpaPutusan).toBe(true);
  });

  it("hak peran tetap diperiksa: akun yang tidak berhak (panitera) + tanda timpa -> semua gagal, tidak ada kunci, tidak ada unggahan", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true }, peran: "panitera-pengganti" });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(h.putusan?.status).toBe("gagal");
    expect(d.unggah).toHaveLength(0);
    expect(d.urut).not.toContain("kunci");
  });

  it("perkara sedang dikerjakan pekerjaan lain: ditunda; tanda timpa tidak menerobos kunci", async () => {
    const d = dunia({ ada: { putusan: true, anonim: true }, kunciSibuk: true });
    const h = await jalan(d, baris({ pilihan_json: JSON.stringify({ timpa: { putusan: true, anonim: true } }) }));
    expect(h.tunda).toBeTruthy();
    expect(d.unggah).toHaveLength(0);
  });
});

// ============================================================================
// E. layanan jadwal + sisi peramban atas basis data pg-mem
// ============================================================================
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-ecourt/hak-putusan")>();
  return { ...mod, pastikanMajelisPutusan: vi.fn(async () => undefined) };
});

import { buatJadwal, type Pelaku } from "@/server/modules/putusan-terjadwal/layanan";
import { giliranPeramban, klaimPeramban, laporPeramban } from "@/server/modules/putusan-terjadwal/peramban";

const HAKIM = { actor: { id: "usr-timpa-hakim", name: "Hakim Timpa", roleId: "hakim", isActive: true }, peran: "hakim" } as unknown as Pelaku;
const wita = (t: string) => new Date(witaKeMs(t));

describe("E. jadwal: tanda timpa tersimpan pada barisnya dan sampai ke ekstensi", () => {
  let db: AletaDatabase;
  const baca = async (id: string) => (await db.queryAll<Record<string, unknown>>("SELECT * FROM aleta_putusan_jadwal_butir WHERE id = ?", [id]))[0];

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
    const peran = await db.queryOne<{ id: string }>("SELECT id FROM roles LIMIT 1");
    const jabatan = await db.queryOne<{ id: string }>("SELECT id FROM positions LIMIT 1");
    const kini = new Date().toISOString();
    await db.run(
      "INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, ?, ?, ?)",
      [HAKIM.actor.id, HAKIM.actor.id, HAKIM.actor.name, `${HAKIM.actor.id}@uji.lokal`, peran?.id ?? "", jabatan?.id ?? "", kini, kini]
    );
  }, 180000);
  afterAll(async () => {
    await db?.close();
  });

  const deps = { sekarang: () => wita("2026-10-21 06:00"), muatLibur: async () => (_iso: string) => false, akunSipp: async () => ({ ok: true as const, username: "hakim.satu" }) };
  const jadwalkan = async (nomor: string, pilihan: unknown, langkah = { isi: true }) =>
    (await buatJadwal(db, HAKIM, "192.168.9.97", { mulai: "2026-10-21 08:00", jedaMin: 120, lintasHari: true, butir: [{ perkaraId: String(40000 + Number(nomor.split("/")[0])), nomorPerkara: nomor, jenisPerkara: "Cerai Gugat", langkah, pilihan }] }, deps)).butir[0];

  it("tanda timpa.form tersimpan di pilihan_json dan tampil di ringkasan jadwal; yang tidak dipilih langkahnya DIBUANG", async () => {
    const r = await jadwalkan("501/Pdt.G/2026/PA.Dgl", { verstek: "Y", timpa: { form: true, putusan: true, anonim: true } });
    const b = await baca(r.id);
    expect(JSON.parse(String(b.pilihan_json))).toEqual({ verstek: "Y", timpa: { form: true } });
    expect(r.ringkasForm).toContain("Mengganti yang sudah ada: Putusan Akhir");
    expect(r.ringkasForm).not.toContain("e-Doc");
  });

  it("jadwal TANPA tanda tidak menyimpan timpa sama sekali (perilaku lama)", async () => {
    const r = await jadwalkan("502/Pdt.G/2026/PA.Dgl", { verstek: "T" });
    expect(JSON.parse(String((await baca(r.id)).pilihan_json))).toEqual({ verstek: "T" });
    expect(r.ringkasForm).not.toContain("Mengganti");
  });

  it("nilai tanda yang bukan boolean true ditolak di pintu masuk (string '1', 'ya')", async () => {
    const r = await jadwalkan("503/Pdt.G/2026/PA.Dgl", { timpa: { form: "1" } });
    expect(JSON.parse(String((await baca(r.id)).pilihan_json))).toEqual({});
  });

  it("giliran ke ekstensi membawa pilihan.timpa apa adanya; laporan 'selesai' tanpa catatan menyebut menimpa", async () => {
    const r = await jadwalkan("504/Pdt.G/2026/PA.Dgl", { timpa: { form: true } });
    const depsP = { sekarang: () => wita("2026-10-21 09:00"), muatLibur: async () => (_iso: string) => false, tautan: async () => ({ alamat: "http://192.168.10.10/SIPP/x", alasan: "" }), acak: () => 0.5 };
    // Butir lain dari uji sebelumnya ikut mengantre; ambil yang milik uji ini.
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'dibatalkan', status_isi = 'batal' WHERE id <> ?", [r.id]);
    const g = await giliranPeramban(db, HAKIM, { akunSipp: "hakim.satu" }, depsP);
    expect(g.ada).toBe(true);
    if (g.ada) expect(g.butir.pilihan.timpa).toEqual({ form: true });
    const k = await klaimPeramban(db, HAKIM, { id: r.id, akunSipp: "hakim.satu" }, depsP);
    expect(k.ok).toBe(true);
    await laporPeramban(db, HAKIM, { id: r.id, hasil: "selesai" }, depsP);
    expect(String((await baca(r.id)).catatan_isi)).toBe("Putusan Akhir disimpan ulang di SIPP (menimpa isi lama).");
  });

  it("laporan 'selesai' pada butir TANPA tanda tetap berbunyi lama", async () => {
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'dibatalkan', status_isi = 'batal' WHERE status = 'menunggu'");
    const r = await jadwalkan("505/Pdt.G/2026/PA.Dgl", {});
    const depsP = { sekarang: () => wita("2026-10-21 11:00"), muatLibur: async () => (_iso: string) => false, tautan: async () => ({ alamat: "x", alasan: "" }), acak: () => 0.5 };
    const k = await klaimPeramban(db, HAKIM, { id: r.id, akunSipp: "hakim.satu" }, depsP);
    expect(k.ok).toBe(true);
    await laporPeramban(db, HAKIM, { id: r.id, hasil: "selesai" }, depsP);
    expect(String((await baca(r.id)).catatan_isi)).toBe("Putusan Akhir tersimpan di SIPP.");
  });
});

// ============================================================================
// F. modul e-Doc ekstensi (putusan-edoc-sekaligus.js sungguhan di jsdom)
// ============================================================================
const MODUL = readFileSync(path.join(AKAR_EKSTENSI, "putusan-edoc-sekaligus.js"), "utf8").replace(/\r\n/g, "\n");
const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

function bukaModul(o: { cek?: Record<string, unknown> | "gagal"; unggahDitimpa?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    storage: {
      local: {
        get: async (k: string | string[]) => Object.fromEntries([k].flat().filter((n) => n in simpanan).map((n) => [n, polos(simpanan[n])])),
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
      },
    },
  };
  const unggahan: Array<{ putusan: string | null; anonimisasi: string | null; timpaPutusan: unknown; timpaAnonim: unknown }> = [];
  const jawab = (isi: unknown, status = 200) => {
    const r: any = { ok: status < 300, status, json: async () => polos(isi), clone: () => r };
    return r;
  };
  w.alatAmbil = async (url: string) => {
    const u = String(url);
    if (u.includes("/unggah-massal/cek")) {
      if (o.cek === "gagal") throw new Error("Failed to fetch");
      return jawab({ ok: true, data: { adaBaris: true, adaPutusan: false, adaAnonim: false, ...(o.cek || {}) } });
    }
    if (u.includes("/putusan/anonim-mandiri")) return jawab({ ok: true, data: { ok: true, rtfBase64: btoa("{\\rtf1 anonim}"), sisa: [] } });
    throw new Error(`url tak dikenal: ${u}`);
  };
  w.a30PerkaraIdUntukAbt = async () => "10260";
  w.alatBolehUnggahPutusanKini = () => true;
  w.pesanGagalUnggah = (b: { alasan?: string }) => `alasan ${b.alasan}`;
  w.a30UnggahEdoc = async (p: { putusan: File | null; anonimisasi: File | null; timpaPutusan?: unknown; timpaAnonim?: unknown }) => {
    unggahan.push({ putusan: p.putusan ? p.putusan.name : null, anonimisasi: p.anonimisasi ? p.anonimisasi.name : null, timpaPutusan: p.timpaPutusan, timpaAnonim: p.timpaAnonim });
    const berkas: Array<Record<string, unknown>> = [];
    if (p.putusan) berkas.push({ jenis: "putusan", ok: true, jalur: "Putusan/684.rtf", ...(o.unggahDitimpa !== false && p.timpaPutusan ? { ditimpa: true } : {}) });
    if (p.anonimisasi) berkas.push({ jenis: "anonimisasi", ok: true, jalur: "Anonim/684.rtf", ...(o.unggahDitimpa !== false && p.timpaAnonim ? { ditimpa: true } : {}) });
    return { ok: true, berkas, bunyi: "x" };
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(MODUL, ctx, { filename: "putusan-edoc-sekaligus.js" });
  return { w, modul: w.aletaPutusanEdoc, unggahan, simpanan };
}
const NOMOR_EDOC = "684/Pdt.G/2026/PA.Dgl";
const berkasPilihan = (h: ReturnType<typeof bukaModul>) => new h.w.File(["{\\rtf1 pilihan}"], "684 putusan.rtf");
const langkahDari = (hasil: { langkah: Array<{ kunci: string; teks: string; nada: string; ditimpa?: boolean }> }, kunci: string) => hasil.langkah.find((l) => l.kunci === kunci)!;

describe("F. modul e-Doc ekstensi: tanda timpa per slot", () => {
  it("TANPA tanda: yang sudah ada dilewati ('tidak diganti'), tidak ada kiriman", async () => {
    const h = bukaModul({ cek: { adaPutusan: true, adaAnonim: true } });
    const r = await h.modul.jalankan({ nomorPerkara: NOMOR_EDOC, putusan: berkasPilihan(h) });
    expect(h.unggahan).toHaveLength(0);
    expect(r.langkah.map((l: any) => [l.kunci, l.nada])).toEqual([["putusan", "lewat"], ["anonimisasi", "lewat"]]);
    expect(langkahDari(r, "putusan").teks).toMatch(/dilewati - tidak diganti/);
  });

  it("timpaPutusan + e-Doc putusan sudah ada: dikirim dengan tanda; dilaporkan 'diganti' (ditimpa) terpisah dari 'terunggah'; anonimisasi yang tidak bertanda tetap dilewati", async () => {
    const h = bukaModul({ cek: { adaPutusan: true, adaAnonim: true } });
    const r = await h.modul.jalankan({ nomorPerkara: NOMOR_EDOC, putusan: berkasPilihan(h), timpaPutusan: true });
    expect(h.unggahan).toHaveLength(1);
    expect(h.unggahan[0]).toMatchObject({ putusan: "684 putusan.rtf", anonimisasi: null, timpaPutusan: true, timpaAnonim: false });
    const lp = langkahDari(r, "putusan");
    expect(lp.nada).toBe("ok");
    expect(lp.ditimpa).toBe(true);
    expect(lp.teks).toMatch(/^diganti \(menimpa e-Doc lama\)/);
    expect(langkahDari(r, "anonimisasi").nada).toBe("lewat");
  });

  it("timpaAnonim saja: putusan dilewati dan tidak dikirim; anonimisasi dibuat ulang dan ditimpa", async () => {
    const h = bukaModul({ cek: { adaPutusan: true, adaAnonim: true } });
    const r = await h.modul.jalankan({ nomorPerkara: NOMOR_EDOC, putusan: berkasPilihan(h), timpaAnonim: true });
    expect(h.unggahan).toHaveLength(1);
    expect(h.unggahan[0]).toMatchObject({ putusan: null, timpaPutusan: false, timpaAnonim: true });
    expect(h.unggahan[0].anonimisasi).toContain("anonim");
    expect(langkahDari(r, "putusan").nada).toBe("lewat");
    expect(langkahDari(r, "anonimisasi")).toMatchObject({ nada: "ok", ditimpa: true });
  });

  it("tanda untuk slot yang BELUM ada: ditulis biasa, tanpa tanda, dilaporkan 'terunggah'", async () => {
    const h = bukaModul({ cek: { adaPutusan: false, adaAnonim: false } });
    const r = await h.modul.jalankan({ nomorPerkara: NOMOR_EDOC, putusan: berkasPilihan(h), timpaPutusan: true, timpaAnonim: true });
    expect(h.unggahan[0]).toMatchObject({ timpaPutusan: false, timpaAnonim: false });
    expect(langkahDari(r, "putusan").teks).toMatch(/^terunggah/);
    expect(langkahDari(r, "putusan").ditimpa).toBeUndefined();
  });

  it("nilai bukan boolean true ('1', 1) tidak menimpa", async () => {
    const h = bukaModul({ cek: { adaPutusan: true, adaAnonim: true } });
    await h.modul.jalankan({ nomorPerkara: NOMOR_EDOC, putusan: berkasPilihan(h), timpaPutusan: "1", timpaAnonim: 1 });
    expect(h.unggahan).toHaveLength(0);
  });

  it("cek e-Doc yang sudah ada gagal terbaca: TIDAK mengunggah walau bertanda timpa", async () => {
    const h = bukaModul({ cek: "gagal" });
    const r = await h.modul.jalankan({ nomorPerkara: NOMOR_EDOC, putusan: berkasPilihan(h), timpaPutusan: true, timpaAnonim: true });
    expect(h.unggahan).toHaveLength(0);
    expect(r.ok).toBe(false);
    expect(langkahDari(r, "putusan").teks).toContain("tidak ada yang diunggah supaya tidak menimpa");
  });

  it("tanda ikut dititipkan bila halaman dimuat ulang sesudah Putusan Akhir tersimpan: e-Doc yang dilanjutkan tetap MENIMPA (bukan diam-diam dilewati)", async () => {
    const h = bukaModul({ cek: { adaPutusan: true, adaAnonim: true } });
    const tersimpan = await h.modul.catatTertunda({ nomorPerkara: NOMOR_EDOC, perkaraId: "10260", denganPutusan: true, denganAnonim: true, timpaPutusan: true, timpaAnonim: false, putusan: berkasPilihan(h) });
    expect(tersimpan).toBe(true);
    const r = await h.modul.lanjutkanTertunda({ nomorPerkara: NOMOR_EDOC, jedaKunciMs: 0 });
    expect(r.ada).toBe(true);
    expect(h.unggahan).toHaveLength(1);
    expect(h.unggahan[0]).toMatchObject({ putusan: "684 putusan.rtf", timpaPutusan: true, timpaAnonim: false });
    expect(langkahDari(r, "putusan").ditimpa).toBe(true);
    expect(langkahDari(r, "anonimisasi").nada).toBe("lewat");
  });

  it("catatan tertunda TANPA tanda (versi lama / tanpa centang) tetap melewati yang sudah ada", async () => {
    const h = bukaModul({ cek: { adaPutusan: true, adaAnonim: true } });
    await h.modul.catatTertunda({ nomorPerkara: NOMOR_EDOC, perkaraId: "10260", denganPutusan: true, denganAnonim: true, putusan: berkasPilihan(h) });
    await h.modul.lanjutkanTertunda({ nomorPerkara: NOMOR_EDOC, jedaKunciMs: 0 });
    expect(h.unggahan).toHaveLength(0);
  });

  it("langkahDariUnggah: ditimpa dari bot -> 'diganti'; tanpa -> 'terunggah'", () => {
    const h = bukaModul();
    const l = h.modul.langkahDariUnggah({ ok: true, berkas: [{ jenis: "putusan", ok: true, ditimpa: true, jalur: "a.rtf" }, { jenis: "anonimisasi", ok: true, jalur: "b.rtf" }] }, { putusan: true, anonimisasi: true });
    expect(l[0]).toMatchObject({ kunci: "putusan", nada: "ok", ditimpa: true });
    expect(l[0].teks).toContain("diganti");
    expect(l[1].teks).toMatch(/^terunggah/);
    expect(l[1].ditimpa).toBeUndefined();
  });

  it("sudah_ada dari rute (kiriman tanpa tanda) dilaporkan gagal beserta kalimat bot, bukan dianggap berhasil", () => {
    const h = bukaModul();
    h.w.pesanGagalUnggah = (b: { alasan?: string; pesan?: string }) => `${b.alasan}: ${b.pesan}`;
    const l = h.modul.langkahDariUnggah({ ok: false, berkas: [{ jenis: "putusan", ok: false, alasan: "sudah_ada", pesan: "sudah ada" }] }, { putusan: true, anonimisasi: false });
    expect(l[0].nada).toBe("salah");
    expect(l[0].teks).toContain("sudah_ada");
  });
});

// ============================================================================
// G. kabel yang tidak dapat dijalankan di sini (ditandai terus terang)
// ============================================================================
describe("G. kabel formulir unggah ekstensi (pemeriksaan teks; perilakunya dijalankan di berkas uji tiap jalur)", () => {
  const baca = (b: string) => readFileSync(path.join(AKAR_EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
  it("a30UnggahEdoc mengirim timpaPutusan/timpaAnonim hanya untuk slot yang dikirim dan bertanda true", () => {
    const k = baca("konten-panel-bersama.js");
    expect(k).toContain('if (p.putusan && p.timpaPutusan === true) badan.append("timpaPutusan", "1");');
    expect(k).toContain('if (p.anonimisasi && p.timpaAnonim === true) badan.append("timpaAnonim", "1");');
  });
  it("tidak ada jalur yang mengirim tanda timpa secara TETAP: semuanya bersyarat pada keadaan yang dibaca dan disetujui", () => {
    expect(baca("abt-panel-bersama.js")).toContain('if (siap.timpa && siap.timpa.putusan === true) badan.append("timpaPutusan", "1");');
    expect(baca("blangko-derry-isian.js")).toContain('if (timpa && timpa.putusan === true) badan.append("timpaPutusan", "1");');
    const p = baca("konten-panel-perkara.js");
    expect(p).toContain('if (putusan && tanya.timpa.putusan) badan.append("timpaPutusan", "1");');
    expect(p).toContain('if (jenis === "anonimisasi" ? bendera.anonim : bendera.putusan)');
    // F41 (unggah massal ABT): tanda hanya untuk slot yang sudah ada dan dicentang Ganti per slot.
    expect(baca("abt.js")).toContain('if (k.putusan && !kosong.putusan && s.timpa && s.timpa.putusan) badan.append("timpaPutusan", "1");');
  });
  it("panel satu perkara (naskah dipilih petugas, sudah dikonfirmasi) membawa tanda ke e-Doc seperti semula; antrean massal membawa tanda dari butirnya saja", () => {
    const b = baca("konten-panel-bersama.js");
    const awal = b.indexOf("async function a30OpsiSimpanPutusan(p) {");
    const akhir = b.indexOf("EDOC PADA PUTUSAN MASSAL", awal);
    const fungsi = b.slice(awal, akhir);
    expect(fungsi).toContain("p.timpaEdoc === true || p.timpaPutusan === true");
    expect(fungsi.match(/\.\.\.tandaTimpa/g)).toHaveLength(4);
    const perkara = baca("konten-panel-perkara.js");
    expect(perkara.match(/timpaEdoc: true,/g)).toHaveLength(2);
    const massal = b.slice(b.indexOf("async function a30OpsiEdocMassal(p)"));
    expect(massal.slice(0, massal.indexOf("a30OpsiSimpanPutusan({") + 500)).not.toContain("timpaEdoc");
    expect(b).toContain("timpaPutusan: Boolean(butir.timpa && butir.timpa.putusan === true),");
  });
});
