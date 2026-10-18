// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import zlib from "node:zlib";

import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buatDocx } from "@/lib/docx";
import { buatPdf } from "@/lib/cetak-pdf";
import { bangunRtf } from "@/lib/blangko-sendiri";
import { naskahKeRtf } from "@/lib/hasil-mediasi-rtf";
import { drafKeRtf } from "@/lib/putusan-advance-draf";
import { menyebutAleta } from "@/lib/tanda-aleta";
import { susunNaskahEvidenSkp } from "@/lib/eviden-skp-cetak";
import { teksKeRtf } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { gambarPdfEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-pdf";
import { gambarXlsxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-xlsx";
import { createXlsxWorkbook } from "@/server/shared/xlsx";

import { INSTANSI_CONTOH, dokumenRekapContoh, paketContoh } from "./eviden-skp-contoh";

/**
 * ============================================================================
 * AUDIT JEJAK SIPP 18 OKT 2026 - PENJAGA PERILAKU
 * ============================================================================
 *
 * Perintah pengguna (hakim, 18 Okt ±21.15): "Untuk SIPP ingat jangan sampai
 * terdeteksi tulisan ALETA sama sekali ... database SIPP itu bisa dilihat pusat."
 *
 * Setiap uji di sini MENJALANKAN kode sungguhan (bukan menyisir teks sumbernya):
 *   A. kolam MySQL ke SIPP/ABT/antrian menolak STRUKTUR ber-nama ALETA (tabel,
 *      kolom, indeks, pemicu) SEBELUM menyentuh basis data;
 *   B. jaring nilai mengenali tulisan di dalam multipleStatements;
 *   C. kolom ipaddress sys_audittrail hanya IPv4 peramban;
 *   D. pemindai berkas (RTF/DOCX/XLSX/PDF termasuk aliran termampat & ObjStm)
 *      dibuktikan menangkap contoh yang sengaja salah, lalu dipakai atas
 *      keluaran pembangkit berkas sungguhan.
 */
const AKAR = path.resolve(process.cwd(), "..");
const botReq = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const g: Apa = botReq(path.join(AKAR, "aleta_bot/services/penjagaTandaSipp.js"));

afterEach(() => vi.restoreAllMocks());

// ============================================================================
// A. STRUKTUR BER-NAMA ALETA DI BASIS DATA SIPP/ABT
// ============================================================================
describe("A - struktur ber-nama ALETA di basis data SIPP/ABT ditolak", () => {
  const DITOLAK = [
    "CREATE TABLE IF NOT EXISTS aleta_bot_message_logs (id INT)",
    "INSERT INTO aleta_bot_settings (k, v) VALUES (?, ?)",
    "REPLACE INTO `ALETA_cache` VALUES (1)",
    "UPDATE `SIPP`.`aleta_x` SET a = 1",
    "START TRANSACTION; INSERT INTO aleta_bot_x (a) VALUES (1); COMMIT",
    "ALTER TABLE perkara ADD COLUMN aleta_flag INT",
    "CREATE INDEX idx_aleta ON perkara (perkara_id)",
    "CREATE TRIGGER trg_x BEFORE INSERT ON perkara FOR EACH ROW INSERT INTO aleta_bot.log VALUES (1)",
    "CREATE DEFINER=`aleta`@`%` VIEW v_x AS SELECT 1",
    "CREATE FUNCTION aleta_rtf_butir(x TEXT) RETURNS TEXT RETURN x",
    "INSERT INTO aps_badilag.aleta_rtf_cache (a) VALUES (1)",
  ];
  const DITERIMA = [
    "UPDATE perkara SET posita = ? WHERE perkara_id = ?",
    "INSERT INTO perkara_proses (keterangan) VALUES ('lewat aleta')", // NILAI: urusan penjaga per-jalur
    "INSERT INTO aleta_bot.aleta_bot_ktp_pihak (a) VALUES (1)", // basis data milik ALETA
    "CREATE OR REPLACE VIEW aleta_bot.v_ringkas AS SELECT * FROM SIPP.perkara",
    "DROP TABLE IF EXISTS aleta_bot_x", // membersihkan sisa lama boleh
    "DELETE FROM aleta_bot_x WHERE 1",
    "SELECT * FROM aleta_bot_settings",
    "INSERT INTO x (a) VALUES (1) ON DUPLICATE KEY UPDATE a = VALUES(a)",
    "CREATE DATABASE IF NOT EXISTS aleta_bot",
  ];

  it("strukturAletaDiSipp: contoh yang harus ditolak dan yang harus diterima", () => {
    for (const s of DITOLAK) expect(g.strukturAletaDiSipp(s), s).not.toBe("");
    for (const s of DITERIMA) expect(g.strukturAletaDiSipp(s), s).toBe("");
  });

  it("db_config.js (kolam SIPP): ditolak lewat callback dengan kode struktur, tanpa sambungan ke MySQL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db: Apa = botReq(path.join(AKAR, "aleta_bot/db_config.js"));
    const galat: Apa = await new Promise((selesai) => db.query("CREATE TABLE IF NOT EXISTS aleta_bot_x (id INT)", [], (e: unknown) => selesai(e)));
    expect(galat?.code).toBe(g.KODE_STRUKTUR);
    // tanpa callback: dilempar seketika
    expect(() => db.query("INSERT INTO aleta_bot_settings (a) VALUES (1)")).toThrow(/ALETA/);
  });

  it("db_config5.js (ABT) dan db_config4.js (antrian) memasang jaring yang sama", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const berkas of ["db_config5.js", "db_config4.js"]) {
      const db: Apa = botReq(path.join(AKAR, "aleta_bot", berkas));
      const galat: Apa = await new Promise((selesai) => db.query("ALTER TABLE abt_variabel ADD COLUMN aleta_x INT", (e: unknown) => selesai(e)));
      expect(galat?.code, berkas).toBe(g.KODE_STRUKTUR);
    }
  });

  it("externalDbService (kolam registri SIPP/ABT): ditolak sebelum kueri; kolam basis data ALETA tidak dijaring", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ext: Apa = botReq(path.join(AKAR, "aleta_bot/services/externalDbService.js"));
    await expect(ext.query("aps_badilag", "INSERT INTO aleta_rtf_cache (a) VALUES (?)", [1])).rejects.toMatchObject({ code: g.KODE_STRUKTUR });
    await expect(ext.query("sipp_primary", "CREATE TABLE aleta_jejak (id INT)", [])).rejects.toMatchObject({ code: g.KODE_STRUKTUR });
  });

  it("pasangJaring: struktur ditolak, tulisan bersih diteruskan, tulisan bernilai ALETA dicatat (tidak ditolak), idempoten", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const diteruskan: string[] = [];
    const kolam = { query: (sql: string, _p: unknown, cb: (e: unknown, r: unknown) => void) => (diteruskan.push(sql), cb(null, [])) };
    expect(g.pasangJaring(kolam, "abt")).toBe(true);
    expect(g.pasangJaring(kolam, "abt")).toBe(false);
    const jalan = (sql: string, p: unknown[] = []) => new Promise((ok) => kolam.query(sql, p, (e: unknown) => ok(e)));
    expect(await jalan("CREATE TABLE aleta_x (a INT)")).toMatchObject({ code: g.KODE_STRUKTUR });
    expect(diteruskan).toEqual([]);
    expect(await jalan("UPDATE abt_variabel SET nama = ? WHERE no_var = ?", ["Alamat", 1])).toBeNull();
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("PERINGATAN"));
    expect(await jalan("UPDATE abt_variabel SET nama = ? WHERE no_var = ?", ["dirapikan ALETA", 1])).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("PERINGATAN: tulisan ke abt"));
    expect(diteruskan).toHaveLength(2);
  });
});

// ============================================================================
// B. JARING NILAI: multipleStatements
// ============================================================================
describe("B - tulisanBocor membaca tiap pernyataan, bukan hanya awal teks", () => {
  it("INSERT di belakang START TRANSACTION dikenali; bacaan dan literal ber-';' tidak mengecoh", () => {
    expect(g.tulisanBocor("START TRANSACTION; INSERT INTO perkara_proses (k) VALUES (?); COMMIT", ["lewat ALETA"])).toBe(true);
    expect(g.tulisanBocor("SELECT 1; SELECT ?", ["aleta"])).toBe(false);
    expect(g.tulisanBocor("UPDATE perkara SET a = 'x;y' WHERE b = ?", ["Aleta"])).toBe(true);
    expect(g.tulisanBocor("START TRANSACTION; INSERT INTO perkara_proses (k) VALUES (?)", ["bersih"])).toBe(false);
  });
});

// ============================================================================
// C. ipaddress sys_audittrail
// ============================================================================
describe("C - kolom ipaddress audit SIPP hanya IPv4 peramban", () => {
  it("ipAuditSipp", () => {
    expect(g.ipAuditSipp("192.168.9.82")).toBe("192.168.9.82");
    expect(g.ipAuditSipp("::ffff:10.0.0.7")).toBe("10.0.0.7");
    for (const x of ["aleta-portal", "aleta_bot", "2001:db8::1", "999.1.1.1", "", null, undefined]) expect(g.ipAuditSipp(x), String(x)).toBe("");
  });

  it("penetapan (Data Umum): baris sys_audittrail memakai ipAuditSipp - alamat bukan IPv4 menjadi kosong, bukan dipotong", async () => {
    const pasang = (berkas: string, exports: unknown) => {
      const jalur = botReq.resolve(path.join(AKAR, "aleta_bot", berkas));
      botReq.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
    };
    const jawab = (sql: string, p: unknown[]) => {
      if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-18 01:00:00" }];
      if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-18 09:00:00" }];
      if (/FROM perkara p\b/.test(sql) && /LEFT JOIN perkara_penetapan/.test(sql)) {
        return [{ perkaraId: 10229, nomorPerkara: "660/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, tanggalDaftar: "2026-10-13" }];
      }
      if (/FROM perkara p WHERE/.test(sql)) return [{ tanggalSurat: null, nomorSurat: null }];
      if (/FROM sys_users WHERE username = \?/.test(sql)) return String(p[0]) === "meja1g" ? [{ userid: 25, username: "meja1g", fullname: "Tiffany RS", block: 0 }] : [];
      return [];
    };
    pasang("db_config.js", { query: (sql: string, p: unknown, cb: (e: unknown, h: unknown) => void) => cb(null, jawab(String(sql), Array.isArray(p) ? p : [])) });
    const jalurSkema = botReq.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
    delete botReq.cache[jalurSkema];
    const skema = botReq(jalurSkema) as Record<string, unknown>;
    pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true });
    const jalur = botReq.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"));
    delete botReq.cache[jalur];
    const l: Apa = botReq(jalur);
    try {
      for (const [ip, harap] of [
        ["aleta-portal-1", ""],
        ["192.168.9.82", "192.168.9.82"],
      ]) {
        const r = await l.susunRencanaTulis({
          jenis: "dataUmum",
          perkaraId: 10229,
          tanggalPenetapan: "2026-10-18",
          olehUsername: "meja1g",
          operator: "UJI",
          ip,
          dataUmum: { nomorSurat: "01/X/2026", tanggalMenikah: "2020-01-02", nomorAktaNikah: "123/45/I/2020" },
        });
        expect(r.ok, JSON.stringify(r)).toBe(true);
        const audit = (r.langkah as Array<{ sql: string; params: unknown[] }>).filter((x) => /INSERT INTO sys_audittrail/.test(x.sql));
        expect(audit.length).toBeGreaterThan(0);
        for (const a of audit) expect(a.params[1], ip).toBe(harap);
        expect(JSON.stringify(r.langkah)).not.toMatch(/aleta/i);
      }
    } finally {
      for (const b of ["db_config.js", "services/sippSkemaService.js", "services/penetapanTulisService.js"]) {
        delete botReq.cache[botReq.resolve(path.join(AKAR, "aleta_bot", b))];
      }
    }
  });

  it("ketiga penulis sys_audittrail lain tidak lagi memotong ip mentah (pola lama tidak kembali)", () => {
    const POLA_LAMA = /(?:String\(ip \|\| ""\)|bersih\(ip\)|bersih\(minta\.ip\))\.slice\(0, 15\)/;
    // pola terbukti menangkap bentuk lama
    expect(POLA_LAMA.test('      String(ip || "").slice(0, 15),')).toBe(true);
    for (const b of ["penetapanTulisService.js", "mediatorTulisService.js", "kasirJurnalService.js"]) {
      const s = readFileSync(path.join(AKAR, "aleta_bot/services", b), "utf8");
      expect(POLA_LAMA.test(s), b).toBe(false);
      expect(s, b).toContain("penjagaTandaSipp.ipAuditSipp(");
    }
  });
});

// ============================================================================
// D. PEMINDAI BERKAS + PEMBANGKIT SUNGGUHAN
// ============================================================================

/** Isi ZIP (DOCX/XLSX): { nama: teks }. Dibaca terpisah dari kode yang diuji. */
function bacaZip(isi: Buffer): Record<string, string> {
  let akhir = -1;
  for (let i = isi.length - 22; i >= 0; i -= 1) {
    if (isi.readUInt32LE(i) === 0x06054b50) {
      akhir = i;
      break;
    }
  }
  if (akhir < 0) return {};
  const n = isi.readUInt16LE(akhir + 10);
  let p = isi.readUInt32LE(akhir + 16);
  const hasil: Record<string, string> = {};
  for (let k = 0; k < n; k += 1) {
    const metode = isi.readUInt16LE(p + 10);
    const cs = isi.readUInt32LE(p + 20);
    const lNama = isi.readUInt16LE(p + 28);
    const lEks = isi.readUInt16LE(p + 30);
    const lKom = isi.readUInt16LE(p + 32);
    const off = isi.readUInt32LE(p + 42);
    const nama = isi.subarray(p + 46, p + 46 + lNama).toString("utf8");
    const mulai = off + 30 + isi.readUInt16LE(off + 26) + isi.readUInt16LE(off + 28);
    const data = isi.subarray(mulai, mulai + cs);
    hasil[nama] = (metode === 8 ? zlib.inflateRawSync(data) : Buffer.from(data)).toString("utf8");
    p += 46 + lNama + lEks + lKom;
  }
  return hasil;
}

/** Semua teks PDF: mentah + aliran Flate (termasuk ObjStm), string literal & heksadesimal (UTF-16/latin1). */
function teksPdf(isi: Buffer): string {
  const bagian: string[] = [isi.toString("latin1")];
  const mentah = isi.toString("latin1");
  const pola = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(mentah))) {
    const mulai = m.index + m[0].length;
    const ujung = mentah.indexOf("endstream", mulai);
    if (ujung < 0) break;
    try {
      bagian.push(zlib.inflateSync(isi.subarray(mulai, ujung)).toString("latin1"));
    } catch {
      /* aliran tidak termampat / bukan Flate */
    }
  }
  const semua = bagian.join("\n");
  const urai: string[] = [semua];
  for (const h of semua.matchAll(/<([0-9A-Fa-f\s]{4,})>/g)) {
    const b = Buffer.from(h[1].replace(/\s+/g, ""), "hex");
    urai.push(b[0] === 0xfe && b[1] === 0xff ? Buffer.from(b.subarray(2)).swap16().toString("utf16le") : b.toString("latin1"));
  }
  for (const s of semua.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)) urai.push(s[1].replace(/\\([0-7]{1,3})/g, (_x, o) => String.fromCharCode(parseInt(o, 8))));
  return urai.join("\n");
}

/** Teks RTF: mentah + huruf berkode \'xx dan \uN. */
function teksRtf(s: string): string {
  return `${s}\n${s.replace(/\\'([0-9a-f]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\u(-?\d+)\??/g, (_x, n) => String.fromCharCode((Number(n) + 65536) % 65536))}`;
}

/** Pemindai: true bila berkas (isi ATAU metadata, ATAU nama entri) menyebut ALETA. */
function berkasMenyebut(isi: Buffer | string): boolean {
  const b = typeof isi === "string" ? Buffer.from(isi, "latin1") : isi;
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return menyebutAleta(teksPdf(b));
  if (b.subarray(0, 5).toString("latin1") === "{\\rtf") return menyebutAleta(teksRtf(b.toString("latin1")));
  if (b[0] === 0x50 && b[1] === 0x4b) {
    const zip = bacaZip(b);
    return Object.entries(zip).some(([nama, teks]) => menyebutAleta(nama) || menyebutAleta(teks));
  }
  return menyebutAleta(b.toString("latin1"));
}

/** Metadata saja (untuk berkas yang badannya sengaja menyebut ALETA). */
function metadataPdf(isi: Buffer): string {
  const t = teksPdf(isi);
  const urai = (v: string) => {
    if (!v.startsWith("<")) return v;
    const b = Buffer.from(v.slice(1, -1).replace(/\s+/g, ""), "hex");
    return b[0] === 0xfe && b[1] === 0xff ? Buffer.from(b.subarray(2)).swap16().toString("utf16le") : b.toString("latin1");
  };
  return (
    [...t.matchAll(/\/(Title|Author|Subject|Keywords|Creator|Producer)\s*(\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]*>)/g)].map((x) => `/${x[1]} ${urai(x[2])}`).join(" ") +
    [...t.matchAll(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g)].join(" ")
  );
}

const LEMBAR = { name: "Lembar", columns: [{ key: "a", header: "Kolom" }], rows: [{ a: "isi" }] } as never;

describe("D0 - pemindai berkas terbukti menangkap (bukan lulus karena buta)", () => {
  it("PDF pdf-lib: Producer ber-ALETA di ObjStm termampat dan teks halaman tertangkap; yang bersih tidak", async () => {
    const kotor = await PDFDocument.create();
    kotor.setProducer("ALETA (pdf-lib)");
    kotor.addPage();
    const bitaKotor = Buffer.from(await kotor.save());
    expect(bitaKotor.toString("latin1")).not.toMatch(/ALETA/); // tersembunyi di aliran termampat/UTF-16
    expect(berkasMenyebut(bitaKotor)).toBe(true);
    expect(menyebutAleta(metadataPdf(bitaKotor))).toBe(true);

    const halaman = await buatPdf({ alinea: [{ teks: "Disusun ALETA" }] });
    expect(berkasMenyebut(halaman.berkas)).toBe(true);
    const bersih = await buatPdf({ alinea: [{ teks: "Penggugat Siti binti Ahmad" }] });
    expect(berkasMenyebut(bersih.berkas)).toBe(false);
  });

  it("RTF: huruf berkode dan grup info tertangkap; DOCX/XLSX: isi dan docProps tertangkap", () => {
    expect(berkasMenyebut("{\\rtf1 \\'41\\'4c\\'45\\'54\\'41\\par}")).toBe(true);
    expect(berkasMenyebut("{\\rtf1{\\info{\\author Aleta}}x}")).toBe(true);
    expect(berkasMenyebut(buatDocx({ alinea: [{ teks: "lewat ALETA" }] }))).toBe(true);
    expect(berkasMenyebut(createXlsxWorkbook([LEMBAR]))).toBe(true); // bawaan creator/Application ALETA
    expect(berkasMenyebut(createXlsxWorkbook([LEMBAR], { creator: "", aplikasi: "" }))).toBe(false);
  });
});

describe("D1 - keluaran pembangkit berkas yang dapat sampai ke SIPP/ABT/e-Court bebas kata ALETA (isi + metadata)", () => {
  const ISI = "Penggugat Siti binti Ahmad melawan Tergugat Budi bin Umar.";

  it("RTF: laporan mediasi, draf putusan, blangko sendiri, konversi naskah", () => {
    const keluaran: Record<string, string> = {
      "laporan mediasi (naskahKeRtf)": naskahKeRtf([{ jenis: "judul", teks: "LAPORAN MEDIASI" }, { jenis: "paragraf", teks: ISI }]),
      "draf putusan (drafKeRtf)": drafKeRtf({
        bagian: [{ kunci: "duduk" as never, judul: "DUDUK PERKARA", paragraf: [{ teks: ISI, asal: "naskah" } as never], jumlahTanda: 0 }],
      } as never),
      "blangko sendiri (bangunRtf)": bangunRtf([{ urutan: 1, teks: ISI, rata: "kiri" as never, tebal: false }]),
      "konversi naskah (teksKeRtf)": teksKeRtf([ISI]),
    };
    for (const [nama, rtf] of Object.entries(keluaran)) {
      expect(rtf.startsWith("{\\rtf"), nama).toBe(true);
      expect(rtf, nama).toContain("Siti binti Ahmad");
      expect(berkasMenyebut(rtf), nama).toBe(false);
    }
  });

  it("DOCX (buatDocx) dan PDF (buatPdf, metadata bawaan pdf-lib) - blangko ALETA mandiri", async () => {
    const docx = buatDocx({ alinea: [{ teks: ISI }] });
    expect(Object.keys(bacaZip(docx))).toContain("word/document.xml");
    expect(berkasMenyebut(docx)).toBe(false);
    const pdf = await buatPdf({ alinea: [{ teks: ISI }] });
    expect(berkasMenyebut(pdf.berkas)).toBe(false);
  });

  it("salinan putusan (bot salinanPutusanService.susunSalinan) tidak menambah jejak", () => {
    const salinan: Apa = botReq(path.join(AKAR, "aleta_bot/services/salinanPutusanService.js"));
    const rtf = `{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard\\qc PUTUSAN\\par\\pard ${ISI}\\par\\pard Untuk Salinan\\par\\pard Panitera\\par}`;
    const h = salinan.susunSalinan(rtf, { ttd: null });
    expect(typeof h.rtf).toBe("string");
    expect(berkasMenyebut(h.rtf)).toBe(false);
  });

  it("metadata RTF/PDF di bot (metadataTanpaAletaService) membersihkan semua lapisan yang dipindai", () => {
    const m: Apa = botReq(path.join(AKAR, "aleta_bot/services/metadataTanpaAletaService.js"));
    const rtf = Buffer.from("{\\rtf1{\\info{\\title Putusan}{\\author ALETA}{\\*\\company Aleta Bot}}{\\*\\aletaasal sisa}\\pard Isi\\par}", "latin1");
    const hasil = m.buangGrupTersembunyiRtf(m.tanpaTandaAletaMetadata(rtf));
    expect(berkasMenyebut(Buffer.from(hasil))).toBe(false);
    expect(Buffer.from(hasil).toString("latin1")).toContain("Isi");
  });
});

describe("D2 - Eviden SKP (keluar ke sistem kinerja pusat): metadata tanpa ALETA", () => {
  const naskah = () => susunNaskahEvidenSkp(paketContoh(), dokumenRekapContoh(), { instansi: INSTANSI_CONTOH, tanggalTandaTangan: "2026-06-30", sebutanOrang: "Hakim" } as never);

  it("PDF: Author/Creator/Producer tidak menyebut ALETA (juga bukan bawaan pdf-lib)", async () => {
    const h = await gambarPdfEvidenSkp(naskah());
    const meta = metadataPdf(Buffer.from(h.berkas));
    expect(meta).toMatch(/Title/);
    expect(menyebutAleta(meta), meta).toBe(false);
    expect(meta).not.toMatch(/pdf-lib/);
  });

  it("XLSX: docProps core/app tanpa ALETA", async () => {
    const zip = bacaZip(await gambarXlsxEvidenSkp(naskah()));
    expect(zip["docProps/core.xml"]).toBeDefined();
    expect(menyebutAleta(zip["docProps/core.xml"])).toBe(false);
    expect(menyebutAleta(zip["docProps/app.xml"])).toBe(false);
  });
});
