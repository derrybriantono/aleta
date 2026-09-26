// @vitest-environment node

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * JEJAK AUDIT UNGGAH e-DOC: JUJUR - PETUGAS, WAKTU, DAN ALAMAT SUNGGUHAN,
 * DAN CARANYA DISEBUT: LEWAT ALETA
 * ============================================================================
 *
 * Catatan audit perkara adalah alat pertanggungjawaban. Keputusan orkestrator
 * 25 September 2026: baris sys_audittrail yang ditulis bot tidak boleh
 * menyamar sebagai kerja petugas lewat borang SIPP. Maka yang dijaga di sini:
 *
 *   - SETIAP tulisan ke SIPP punya barisnya (perkara_putusan, dirput_dokumen,
 *     dirput_antrian) - tidak ada tulisan yang disembunyikan dari audit;
 *   - formname, judul, dan deskripsi menyebut ALETA, dan tidak menyalin teks
 *     borang SIPP ("UPLOAD E-DOCS PUTUSAN AKHIR" dan kawan-kawannya);
 *   - pelaku = akun SIPP petugas yang memicu, IP = alamat perambannya (kosong
 *     bila tidak diteruskan, tidak pernah dipotong menjadi alamat lain), waktu
 *     = jam yang dibaca saat tulisan itu terjadi.
 *
 * Uji ini MENJALANKAN putusanUnggahService.unggahPutusan dengan basis data
 * tiruan yang mencatat tiap kueri.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

// ============================================================================
// putusanUnggahService DENGAN BASIS DATA, SKEMA, AKAR SIPP, DAN KONVERSI TIRUAN
// ============================================================================
type Kueri = { sql: string; params: unknown[] };
const folderUji: string[] = [];

function muatLayanan({
  ubahKePdf,
  dirputLama = 0,
}: { ubahKePdf?: (isi: Buffer) => Promise<unknown>; dirputLama?: number } = {}) {
  const Module = require_("module") as unknown as new (id: string) => {
    filename: string;
    loaded: boolean;
    exports: unknown;
  };
  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };
  const kueri: Kueri[] = [];
  const akar = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-uji-unggah-"));
  folderUji.push(akar);

  pasang(require_.resolve(path.join(akarBot, "db_config")), {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      kueri.push({ sql: String(sql), params });
      const s = String(sql);
      if (s.includes("SELECT tanggal_putusan")) return balik(null, [{ tanggal_putusan: "2026-09-01" }]);
      if (s.includes("dirput_dokumen_ref")) return balik(null, [{ ref: 89 }]);
      if (s.includes("SELECT id FROM dirput_dokumen") && dirputLama) return balik(null, [{ id: dirputLama }]);
      if (s.startsWith("SELECT")) return balik(null, []);
      return balik(null, { affectedRows: 1 });
    },
  });
  pasang(require_.resolve(path.join(akarBot, "services/sippSkemaService")), {
    tabelAda: async () => true,
  });
  pasang(require_.resolve(path.join(akarBot, "services/dokumenPenetapanService")), {
    periksaAkarSipp: () => ({ dapatDitulis: true, akar }),
    samakanPemilikSipp: () => undefined,
  });
  // kenaliDokumen ASLI; hanya konversinya yang ditiru (soffice tidak ada di sini).
  const cetakAsli = require_(path.join(akarBot, "services/abtCetakService")) as {
    kenaliDokumen: (b: Buffer) => string;
  };
  pasang(require_.resolve(path.join(akarBot, "services/abtCetakService")), {
    kenaliDokumen: cetakAsli.kenaliDokumen,
    dokumenKePdf:
      ubahKePdf ?? (async () => ({ ok: true, pdf: Buffer.from("%PDF-1.4 hasil konversi tiruan") })),
  });

  const jalurLayanan = require_.resolve(path.join(akarBot, "services/putusanUnggahService"));
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const layanan = require_(jalurLayanan) as Record<string, unknown> & {
    unggahPutusan: (m: Record<string, unknown>) => Promise<{
      ok: boolean;
      antrean: boolean;
      berkas: Array<{ jenis: string; ok: boolean; jalur?: string; jalurPdf?: string; published?: number }>;
    }>;
  };
  // Layanan asli dibuang lagi dari singgahan supaya berkas uji lain memuat yang asli.
  delete (require_.cache as Record<string, unknown>)[require_.resolve(path.join(akarBot, "services/abtCetakService"))];
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  return { layanan, kueri };
}

const RTF_PUTUSAN = Buffer.from("{\\rtf1\\ansi PUTUSAN\\par Nomor 12/Pdt.G/2026/PA.Dgl}", "latin1");
const RTF_ANONIM = Buffer.from("{\\rtf1\\ansi PUTUSAN anonim\\par Nomor 12/Pdt.G/2026/PA.Dgl}", "latin1");
const MASUKAN = {
  perkaraId: "901",
  nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
  olehUsername: "petugas uji",
  ip: "192.168.9.121",
};

/** Kolom sys_audittrail dari satu INSERT yang tercatat. */
function barisAudit(q: Kueri) {
  const [datetime, ipaddress, username, tablename, formname, action, title, description] = q.params as string[];
  return { datetime, ipaddress, username, tablename, formname, action, title, description };
}
const auditDari = (kueri: Kueri[]) => kueri.filter((q) => q.sql.includes("INSERT INTO sys_audittrail")).map(barisAudit);

/** Tulisan ke tabel SIPP selain audit itu sendiri: [tabel, perintah]. */
function tulisanDari(kueri: Kueri[]) {
  return kueri
    .map((q) => q.sql.trim())
    .filter((s) => /^(INSERT|UPDATE|REPLACE|DELETE)\b/i.test(s) && !s.includes("sys_audittrail"))
    .map((s) => {
      const cocok = /^(INSERT\s+INTO|UPDATE|REPLACE\s+INTO|DELETE\s+FROM)\s+([a-z_]+)/i.exec(s);
      return [cocok?.[2] ?? "?", (cocok?.[1] ?? "?").split(/\s+/)[0].toUpperCase()];
    });
}

/** Teks borang/add_audittrail SIPP yang TIDAK boleh disalin ke baris ALETA. */
const TEKS_BORANG_SIPP = [
  "UPLOAD E-DOCS PUTUSAN AKHIR",
  "Unggah Dokumen Putusan Akhir <br />dengan perkara_id",
  "Kelola Dokumen Elektronik",
  '<table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1">',
];

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  for (const f of folderUji) fs.rmSync(f, { recursive: true, force: true });
});

describe("baris audit unggah: setiap tulisan tercatat, dan caranya disebut", () => {
  it("SETIAP tulisan ke SIPP punya tepat satu baris audit, dengan tabel dan perintah yang sama", async () => {
    const { layanan, kueri } = muatLayanan();
    const hasil = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    expect(hasil.ok).toBe(true);
    expect(hasil.berkas.map((b) => b.ok)).toEqual([true, true]);
    expect(hasil.antrean).toBe(true);

    const tulisan = tulisanDari(kueri);
    const audit = auditDari(kueri);
    expect(tulisan).toEqual([
      ["perkara_putusan", "UPDATE"],
      ["dirput_dokumen", "INSERT"],
      ["perkara_putusan", "UPDATE"],
      ["dirput_dokumen", "INSERT"],
      ["dirput_antrian", "INSERT"],
    ]);
    // Satu baris audit untuk tiap tulisan - tidak ada yang dibuang.
    expect(audit.map((a) => [a.tablename, a.action])).toEqual(tulisan);
  });

  it("dirput_dokumen yang sudah ada dicatat UPDATE - perintah yang sungguh dijalankan", async () => {
    const { layanan, kueri } = muatLayanan({ dirputLama: 77 });
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN });
    const audit = auditDari(kueri);
    expect(audit.map((a) => [a.tablename, a.action])).toEqual(tulisanDari(kueri));
    expect(audit.find((a) => a.tablename === "dirput_dokumen")?.action).toBe("UPDATE");
  });

  it("formname, judul, dan deskripsi menyebut ALETA - tidak menyalin teks borang SIPP", async () => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const audit = auditDari(kueri);
    expect(audit).toHaveLength(5);
    for (const baris of audit) {
      expect(baris.formname).toBe("ALETA - Unggah Dokumen Putusan");
      expect(baris.title).toBe(`${baris.action} table <b>${baris.tablename}</b> lewat <b>ALETA</b> dengan Primary Key [perkara_id=901]`);
      expect(baris.title.length).toBeLessThanOrEqual(250);
      expect(baris.description).toContain(
        "Ditulis otomatis oleh ALETA (unggah dokumen putusan), bukan lewat borang SIPP, atas perintah pengguna <b>petugas uji</b>."
      );
      for (const teks of TEKS_BORANG_SIPP) {
        expect(Object.values(baris).some((nilai) => String(nilai).includes(teks)), teks).toBe(false);
      }
    }
  });

  it("pemicu yang tidak terkirim DITULIS tidak diketahui - bukan dihilangkan diam-diam", async () => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, olehUsername: "", pdfPutusan: RTF_PUTUSAN });
    const audit = auditDari(kueri);
    expect(audit.length).toBeGreaterThan(0);
    for (const baris of audit) {
      expect(baris.description).toContain("pemicunya TIDAK DIKETAHUI");
      expect(baris.description).not.toContain("atas perintah pengguna <b></b>");
    }
  });

  it("deskripsi memuat kolom dan nilai yang SUNGGUH ditulis", async () => {
    const { layanan, kueri } = muatLayanan();
    const hasil = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const audit = auditDari(kueri);
    const [putusan, anonim] = hasil.berkas;
    expect(putusan.jalur).toBe("resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.rtf");
    expect(audit[0].description).toContain(`<tr><td>amar_putusan_dok</td><td>${putusan.jalur}</td></tr>`);
    expect(audit[1].description).toContain(`<tr><td>path_filename</td><td>${putusan.jalurPdf}</td></tr>`);
    expect(audit[1].description).toContain("<tr><td>published</td><td>0</td></tr>");
    expect(audit[2].description).toContain(`<tr><td>amar_putusan_anonimisasi_dok</td><td>${anonim.jalur}</td></tr>`);
    expect(audit[3].description).toContain("<tr><td>published</td><td>1</td></tr>");
    expect(audit[4].description).toContain("<tr><td>status</td><td>0</td></tr>");
    // Nilai di baris audit = nilai yang ditulis ke tabelnya.
    const ubahKolom = kueri.find((q) => q.sql.startsWith("UPDATE perkara_putusan"));
    expect(ubahKolom?.params[0]).toBe(putusan.jalur);
  });

  it("nilai di deskripsi di-escape - layar Audit Trail SIPP menampilkannya sebagai HTML", async () => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, olehUsername: '<img src=x onerror="a">', pdfPutusan: RTF_PUTUSAN });
    const [baris] = auditDari(kueri);
    expect(baris.description).toContain("<b>&lt;img src=x onerror=&quot;a&quot;&gt;</b>");
    expect(baris.description).not.toContain("<img");
  });

  it("satu slot saja: anonimisasi sendiri - tiga tulisan, tiga baris audit", async () => {
    const { layanan, kueri } = muatLayanan();
    const hasil = await layanan.unggahPutusan({ ...MASUKAN, pdfAnonimisasi: RTF_ANONIM });
    expect(hasil.berkas.map((b) => b.jenis)).toEqual(["anonimisasi"]);
    const audit = auditDari(kueri);
    expect(audit.map((a) => a.tablename)).toEqual(["perkara_putusan", "dirput_dokumen", "dirput_antrian"]);
    expect(audit[0].description).toContain("amar_putusan_anonimisasi_dok");
  });

  it("penyalin bentuk audit SIPP sudah dihapus dari layanan", () => {
    const { layanan } = muatLayanan();
    expect(Object.keys(layanan)).not.toContain("fetchDescription");
  });
});

describe("pelaku dan alamat: petugas yang memicu, tidak pernah dikarang", () => {
  it("username = akun SIPP petugas; IP = alamat perambannya", async () => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN });
    const audit = auditDari(kueri);
    expect(audit.every((a) => a.username === "petugas uji")).toBe(true);
    expect(audit.every((a) => a.ipaddress === "192.168.9.121")).toBe(true);
  });

  it.each([
    ["", ""],
    ["::ffff:192.168.9.7", "192.168.9.7"],
    // IPv6 dan alamat rusak DIKOSONGKAN - dipotong ke 15 huruf ia menjadi alamat lain.
    ["2001:db8:85a3::8a2e:370:7334", ""],
    ["192.168.9.300", ""],
    ["10.0.0.1, 1.2.3.4", ""],
  ])("IP %j tercatat %j", async (masuk, harapan) => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, ip: masuk, pdfPutusan: RTF_PUTUSAN });
    const audit = auditDari(kueri);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((a) => a.ipaddress === harapan)).toBe(true);
  });
});

describe("waktu audit = waktu tulisan itu sungguh terjadi", () => {
  it("tanpa jam tiruan, cap waktunya jam dinding saat itu - tidak digeser", async () => {
    const { layanan, kueri } = muatLayanan();
    const sebelum = Date.now();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const sesudah = Date.now();
    for (const baris of auditDari(kueri)) {
      const [tgl, pukul] = baris.datetime.split(" ");
      const [y, m, d] = tgl.split("-").map(Number);
      const [hh, mm, ss] = pukul.split(":").map(Number);
      const t = new Date(y, m - 1, d, hh, mm, ss).getTime();
      expect(t).toBeGreaterThanOrEqual(Math.floor(sebelum / 1000) * 1000);
      expect(t).toBeLessThanOrEqual(sesudah);
    }
  });

  it("dua permintaan terpisah (jam tiruan) bercap waktu masing-masing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { layanan, kueri } = muatLayanan();

    vi.setSystemTime(new Date(2026, 8, 9, 14, 59, 48));
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN });
    vi.setSystemTime(new Date(2026, 8, 9, 15, 0, 13));
    await layanan.unggahPutusan({ ...MASUKAN, pdfAnonimisasi: RTF_ANONIM });

    const kolom = auditDari(kueri).filter((a) => a.tablename === "perkara_putusan");
    expect(kolom.map((a) => a.datetime)).toEqual(["2026-09-09 14:59:48", "2026-09-09 15:00:13"]);
    // Tanggal dirput_dokumen pun dari saat berkas masing-masing.
    const dirput = kueri.filter((q) => q.sql.includes("INSERT INTO dirput_dokumen"));
    expect(dirput.map((q) => q.params[4])).toEqual(["2026-09-09", "2026-09-09"]);
  });

  it("dalam SATU permintaan, jam dibaca tepat sebelum tiap tulisan - bukan sekali di awal", async () => {
    // Jam tiruan yang maju tujuh detik tiap kali dibaca. Bila 'saat' diambil
    // sekali untuk seluruh permintaan (bentuk lama), semua baris akan sama.
    let kali = 0;
    const jam = () => new Date(2026, 8, 9, 10, 0, kali++ * 7);
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM, jam });
    const audit = auditDari(kueri);
    expect(audit.map((a) => [a.tablename, a.datetime])).toEqual([
      ["perkara_putusan", "2026-09-09 10:00:00"],
      ["dirput_dokumen", "2026-09-09 10:00:07"],
      ["perkara_putusan", "2026-09-09 10:00:14"],
      ["dirput_dokumen", "2026-09-09 10:00:21"],
      ["dirput_antrian", "2026-09-09 10:00:28"],
    ]);
    // Antrean mencatat jam yang sama pada barisnya dan pada auditnya.
    const antrean = kueri.find((q) => q.sql.includes("INSERT INTO dirput_antrian"));
    expect(antrean?.params[1]).toBe("2026-09-09 10:00:28");
  });

  it("putusan ditulis lebih dahulu daripada anonimisasi, walau konversi anonimisasi selesai duluan", async () => {
    let lepasPutusan: () => void = () => undefined;
    const tungguPutusan = new Promise<void>((r) => {
      lepasPutusan = r;
    });
    const { layanan, kueri } = muatLayanan({
      ubahKePdf: async (isi: Buffer) => {
        if (isi.toString("latin1").includes("anonim")) return { ok: true, pdf: Buffer.from("%PDF-1.4 a") };
        await tungguPutusan;
        return { ok: true, pdf: Buffer.from("%PDF-1.4 p") };
      },
    });
    const jalan = layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    await new Promise((r) => setTimeout(r, 20));
    // Belum ada satu tulisan pun selama konversi putusan belum selesai.
    expect(kueri.some((q) => q.sql.startsWith("UPDATE perkara_putusan"))).toBe(false);
    lepasPutusan();
    await jalan;
    const urutan = auditDari(kueri)
      .filter((a) => a.tablename === "perkara_putusan")
      .map((a) => (a.description.includes("anonimisasi") ? "anonimisasi" : "putusan"));
    expect(urutan).toEqual(["putusan", "anonimisasi"]);
  });
});
