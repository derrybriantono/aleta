// @vitest-environment node

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * AUDIT UNGGAH e-DOC: BENTUK SIPP, PELAKU PETUGAS YANG LOGIN, TANPA TANDA ALETA
 * - JEJAK JUJUR PINDAH KE BASIS DATA ALETA
 * ============================================================================
 *
 * Keputusan pengguna 2 Oktober 2026 (butir 14, kontrak K4) membalik keputusan
 * orkestrator 25 September. Yang dijaga di sini:
 *
 *   - baris sys_audittrail untuk kolom e-Doc perkara_putusan berbentuk SIPP
 *     ("UPLOAD E-DOCS PUTUSAN AKHIR", aksi UNGGAH) dan TIDAK memuat kata ALETA;
 *   - dirput_dokumen/dirput_antrian tidak diberi baris audit SIPP (SIPP sendiri
 *     tidak mengauditnya) - tetapi tercatat di jejak ALETA;
 *   - pelaku = akun SIPP petugas yang memicu, IP = alamat perambannya (kosong
 *     bila tidak diteruskan, tidak pernah dipotong menjadi alamat lain), waktu
 *     = jam yang dibaca saat tulisan itu terjadi;
 *   - jejak ALETA memuat siapa + IP + seluruh tabel yang disentuh.
 *
 * Uji ini MENJALANKAN putusanUnggahService.unggahPutusan dengan basis data
 * tiruan yang mencatat tiap kueri, dan jejakAletaService tiruan.
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
  tanpaPutusan = false,
}: { ubahKePdf?: (isi: Buffer) => Promise<unknown>; dirputLama?: number; tanpaPutusan?: boolean } = {}) {
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
      if (s.includes("SELECT tanggal_putusan")) return balik(null, tanpaPutusan ? [] : [{ tanggal_putusan: "2026-09-01" }]);
      if (s.includes("dirput_dokumen_ref")) return balik(null, [{ ref: 89 }]);
      if (s.includes("SELECT id FROM dirput_dokumen") && dirputLama) return balik(null, [{ id: dirputLama }]);
      if (s.startsWith("SELECT")) return balik(null, []);
      return balik(null, { affectedRows: 1 });
    },
  });
  const jejak: Array<Record<string, unknown>> = [];
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
  // Jejak ALETA ditiru lewat parameter catatJejak - uji tidak pernah menulis
  // ke basis data bot sungguhan.
  const unggahAsli = layanan.unggahPutusan;
  layanan.unggahPutusan = (m: Record<string, unknown>) =>
    unggahAsli({
      catatJejak: async (j: Record<string, unknown>) => {
        jejak.push(j);
        return true;
      },
      ...m,
    });
  return { layanan, kueri, jejak };
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

/** Penanda ALETA yang TIDAK boleh ada di kolom mana pun di baris audit SIPP. */
const PENANDA_ALETA = /aleta/i;

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  for (const f of folderUji) fs.rmSync(f, { recursive: true, force: true });
});

describe("baris audit unggah: bentuk SIPP, tanpa tanda ALETA", () => {
  it("hanya kolom e-Doc perkara_putusan yang diaudit di SIPP - dirput tidak (seperti SIPP)", async () => {
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
    expect(audit.map((a) => [a.tablename, a.action])).toEqual([
      ["perkara_putusan", "UNGGAH"],
      ["perkara_putusan", "UNGGAH"],
    ]);
  });

  it("formname, judul, dan deskripsi berbentuk SIPP dan TIDAK memuat kata ALETA", async () => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const [putusan, anonim] = auditDari(kueri);
    expect(putusan.formname).toBe("UPLOAD E-DOCS PUTUSAN AKHIR");
    expect(putusan.title).toBe("Unggah Dokumen Putusan Akhir <br />dengan perkara_id [id=901]");
    expect(anonim.formname).toBe("UPLOAD E-DOCS PUTUSAN ANONIMISASI");
    expect(anonim.title).toBe("Unggah Dokumen Putusan Anonimisasi <br />dengan perkara_id [id=901]");
    for (const baris of [putusan, anonim]) {
      expect(baris.description.startsWith('<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1">')).toBe(true);
      for (const [kolom, nilai] of Object.entries(baris)) {
        expect(PENANDA_ALETA.test(String(nilai)), kolom).toBe(false);
      }
    }
  });

  it("SEMUA tulisan ke SIPP (bukan hanya audit) bebas kata ALETA", async () => {
    const { layanan, kueri } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const tulis = kueri.filter((q) => /^(INSERT|UPDATE|REPLACE|DELETE)\b/i.test(q.sql.trim()));
    expect(tulis.length).toBeGreaterThan(0);
    for (const q of tulis) {
      expect(PENANDA_ALETA.test(q.sql), q.sql).toBe(false);
      expect(PENANDA_ALETA.test(JSON.stringify(q.params)), q.sql).toBe(false);
    }
  });

  it("jejak ALETA mencatat siapa, IP, lewat ALETA, dan SETIAP tabel - termasuk dirput", async () => {
    const { layanan, jejak } = muatLayanan();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    expect(jejak).toHaveLength(1);
    const j = jejak[0] as { akunSipp: string; ip: string; berhasil: boolean; aksi: string; langkah: Array<{ tabel: string }> };
    expect(j).toMatchObject({ aksi: "unggah", jenis: "edoc_putusan", akunSipp: "petugas uji", ip: "192.168.9.121", berhasil: true });
    expect([...new Set(j.langkah.map((l) => l.tabel))]).toEqual(["perkara_putusan", "dirput_dokumen", "dirput_antrian"]);
  });

  it("unggahan yang ditolak (belum ada putusan) pun tercatat di jejak ALETA", async () => {
    const { layanan, jejak, kueri } = muatLayanan({ tanpaPutusan: true });
    const hasil = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN });
    expect(hasil.ok).toBe(false);
    expect(tulisanDari(kueri)).toEqual([]);
    expect(auditDari(kueri)).toEqual([]);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]).toMatchObject({ berhasil: false, alasan: "belum_ada_putusan", akunSipp: "petugas uji", ip: "192.168.9.121" });
  });

  it("dirput_dokumen yang sudah ada ditulis UPDATE dan tetap tanpa baris audit SIPP", async () => {
    const { layanan, kueri } = muatLayanan({ dirputLama: 77 });
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN });
    expect(tulisanDari(kueri)).toContainEqual(["dirput_dokumen", "UPDATE"]);
    expect(auditDari(kueri).map((a) => a.tablename)).toEqual(["perkara_putusan"]);
  });

  it("deskripsi memuat kolom dan nilai yang SUNGGUH ditulis", async () => {
    const { layanan, kueri } = muatLayanan();
    const hasil = await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const audit = auditDari(kueri);
    const [putusan, anonim] = hasil.berkas;
    expect(putusan.jalur).toBe("resources/file/doc/2026/09/PA.Dgl_2026_Pdt.G_12_putusan_akhir.rtf");
    expect(audit[0].description).toContain(`<tr><td>amar_putusan_dok</td><td>${putusan.jalur}</td></tr>`);
    expect(audit[1].description).toContain(`<tr><td>amar_putusan_anonimisasi_dok</td><td>${anonim.jalur}</td></tr>`);
    const ubahKolom = kueri.find((q) => q.sql.startsWith("UPDATE perkara_putusan"));
    expect(ubahKolom?.params[0]).toBe(putusan.jalur);
  });

  it("nilai di deskripsi di-escape - layar Audit Trail SIPP menampilkannya sebagai HTML", () => {
    const { layanan } = muatLayanan();
    const barisAuditFn = layanan.barisAudit as (m: Record<string, unknown>) => { params: string[] };
    const baris = barisAuditFn({ username: "x", jenis: "putusan", perkaraId: 1, rincian: { k: '<img src=x onerror="a">' }, ip: "", saat: "2026-10-02 09:00:00" });
    expect(baris.params[7]).toContain("&lt;img src=x onerror=&quot;a&quot;&gt;");
    expect(baris.params[7]).not.toContain("<img");
  });

  it("satu slot saja: anonimisasi sendiri - satu baris audit SIPP", async () => {
    const { layanan, kueri } = muatLayanan();
    const hasil = await layanan.unggahPutusan({ ...MASUKAN, pdfAnonimisasi: RTF_ANONIM });
    expect(hasil.berkas.map((b) => b.jenis)).toEqual(["anonimisasi"]);
    const audit = auditDari(kueri);
    expect(audit.map((a) => a.formname)).toEqual(["UPLOAD E-DOCS PUTUSAN ANONIMISASI"]);
    expect(audit[0].description).toContain("amar_putusan_anonimisasi_dok");
  });

  it("penyalin bentuk audit SIPP lama tetap tidak ada", () => {
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
  // 13 Okt 2026: jam yang ditulis = jam SIPP (WIB, Asia/Jakarta) - SIPP
  // menulis jamnya dengan PHP Asia/Jakarta. Tidak digeser selain zonanya.
  it("tanpa jam tiruan, cap waktunya jam dinding saat itu dalam jam SIPP (WIB) - tidak digeser", async () => {
    const { layanan, kueri } = muatLayanan();
    const sebelum = Date.now();
    await layanan.unggahPutusan({ ...MASUKAN, pdfPutusan: RTF_PUTUSAN, pdfAnonimisasi: RTF_ANONIM });
    const sesudah = Date.now();
    for (const baris of auditDari(kueri)) {
      const [tgl, pukul] = baris.datetime.split(" ");
      const [y, m, d] = tgl.split("-").map(Number);
      const [hh, mm, ss] = pukul.split(":").map(Number);
      // WIB = UTC+7.
      const t = Date.UTC(y, m - 1, d, hh - 7, mm, ss);
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
    const wib = (ms: number) =>
      new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
    expect(kolom.map((a) => a.datetime)).toEqual([
      wib(new Date(2026, 8, 9, 14, 59, 48).getTime()),
      wib(new Date(2026, 8, 9, 15, 0, 13).getTime()),
    ]);
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
    // Jam dibaca untuk tiap tulisan (perkara_putusan, dirput_dokumen, ...);
    // yang diaudit di SIPP hanya kolom e-Doc, pada jam tulisannya masing-masing.
    expect(audit.map((a) => [a.tablename, a.datetime])).toEqual([
      ["perkara_putusan", "2026-09-09 10:00:00"],
      ["perkara_putusan", "2026-09-09 10:00:07"],
    ]);
    // Antrean mencatat jam saat barisnya ditulis.
    const antrean = kueri.find((q) => q.sql.includes("INSERT INTO dirput_antrian"));
    expect(antrean?.params[1]).toBe("2026-09-09 10:00:14");
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
