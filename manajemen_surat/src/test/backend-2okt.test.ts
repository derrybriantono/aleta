// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ECOURT_CAP } from "@/server/db/schema";

/**
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - AGEN E (BACKEND)
 * ============================================================================
 *
 * Butir 14 / kontrak K4: di SIPP/ABT/e-Court TIDAK ADA tanda ALETA - tidak di
 * tampilan, tidak di kolom audit/keterangan sistem mereka. Pelakunya petugas
 * yang login, alamat yang tidak diteruskan dikosongkan (tidak dikarang
 * "127.0.0.1"), jeda seperti manusia dipertahankan untuk aksi tulis lewat
 * halaman. Jejak JUJUR (siapa + waktu + IP + "lewat ALETA") di tabel aleta_*.
 *
 * Butir 17 / kontrak K6: edoc penetapan PMH/PPP/PJS/PHS dari ABT (peta blangko
 * Derry "Form Bantu PTSP"), tanda tangan sah sesuai nama di dokumen, CAP di
 * atas tanda tangan, passphrase TTE tidak pernah tersimpan; cap disimpan di
 * aleta_ecourt_cap (migrasi 0056).
 *
 * Semua dengan TIRUAN - tidak ada SIPP/ABT/e-Court/basis data bot sungguhan.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const jalurBot = (r: string) => require_.resolve(path.join(akarBot, r));

type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = jalurBot(relatif);
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
function muatSegar<T>(relatif: string): T {
  const jalur = jalurBot(relatif);
  delete (require_.cache as Record<string, unknown>)[jalur];
  const m = require_(jalur) as T;
  delete (require_.cache as Record<string, unknown>)[jalur];
  return m;
}
function lepasSemua() {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
}
afterEach(() => lepasSemua());

const baca = (relatif: string) => readFileSync(path.join(akarBot, relatif), "utf8");

// ============================================================================
// Basis data bot TIRUAN untuk jejakAletaService - tidak ada MySQL sungguhan.
// ============================================================================
type Kueri = { sql: string; params: unknown[] };
function jejakDenganDbTiruan() {
  const kueri: Kueri[] = [];
  pasang("bot_db_config.js", {
    query: (sql: string, params: unknown, balik?: (g: unknown, h: unknown) => void) => {
      const cb = (typeof params === "function" ? params : balik) as (g: unknown, h: unknown) => void;
      const p = Array.isArray(params) ? params : [];
      kueri.push({ sql: String(sql), params: p });
      if (/SHOW COLUMNS/i.test(String(sql))) return cb(null, [{ Field: "ada" }]);
      return cb(null, { affectedRows: 1, insertId: 1 });
    },
  });
  const jejak = muatSegar<{ catat: (j: Record<string, unknown>) => Promise<boolean> }>("services/jejakAletaService.js");
  return { jejak, kueri };
}

// ============================================================================
// SAPUAN TEKS: kata ALETA pada KODE (bukan komentar) berkas penulis sistem luar
// ============================================================================
function tanpaKomentar(sumber: string) {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((b) => b.replace(/(^|[\s;,{}()])\/\/.*$/, "$1"))
    .join("\n");
}
/** Baris kode yang memuat kata ALETA (bukan nama env ALETA_*). */
function barisBerALETA(sumber: string, izin: string[] = []) {
  return tanpaKomentar(sumber)
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => /\bALETA\b(?!_)/.test(b) || /data-aleta/i.test(b))
    .filter((b) => !izin.some((z) => b.includes(z)));
}

const PENULIS_LUAR: Array<[string, string[]]> = [
  ["services/putusanUnggahService.js", []],
  ["services/penetapanTulisService.js", ['const TANDA_ALETA = "[ALETA]";']],
  ["services/putusanTulisService.js", []],
  ["services/sidangHasilService.js", []],
  ["services/mediatorTulisService.js", []],
  ["services/sippPositaService.js", []],
  ["services/penetapanEdocService.js", []],
  ["services/tteProviderService.js", []],
  ["services/ecourtPerambanAksiService.js", []],
  ["services/ecourtLoginService.js", []],
  // Pesan untuk pengguna ALETA (bukan isi yang ditulis ke SIPP).
  ["services/dokumenPenetapanService.js", ["di pengaturan ALETA"]],
];

describe("butir 14 - tidak ada tanda ALETA di payload tulis SIPP/ABT/e-Court", () => {
  it.each(PENULIS_LUAR)("%s: kode (bukan komentar) bebas kata ALETA", (berkas, izin) => {
    expect(barisBerALETA(baca(berkas), izin)).toEqual([]);
  });

  it("penjaga sapuan MENGGIGIT: kode yang menyisipkan 'lewat ALETA' tertangkap, komentar tidak", () => {
    const contoh = [
      "// komentar menyebut ALETA boleh",
      "/* ALETA di komentar blok */",
      'const judul = `UPDATE table <b>${t}</b> lewat <b>ALETA</b>`;',
      "const env = process.env.ALETA_BOT_DB_NAME;",
      "el.setAttribute('data-aleta-aksi', 'x');",
    ].join("\n");
    const temuan = barisBerALETA(contoh);
    expect(temuan).toHaveLength(2);
    expect(temuan[0]).toContain("lewat <b>ALETA</b>");
  });

  it("alamat yang tidak diteruskan DIKOSONGKAN - tidak dikarang 127.0.0.1", () => {
    for (const berkas of ["services/penetapanTulisService.js", "services/putusanTulisService.js", "services/sidangHasilService.js"]) {
      expect(tanpaKomentar(baca(berkas)), berkas).not.toContain('"127.0.0.1"');
    }
  });

  it("baris audit penetapan/putusan/tunda (penetapan.barisAudit) tidak memuat ALETA", () => {
    pasang("db_config.js", { query: () => undefined });
    const p = muatSegar<{ barisAudit: (m: Record<string, unknown>) => { params: unknown[] } }>("services/penetapanTulisService.js");
    const b = p.barisAudit({
      username: "kpa",
      tabel: "perkara_hakim_pn",
      formulir: "TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM",
      aksi: "INSERT",
      nilai: { perkara_id: 10, hakim_id: 3 },
      ip: "192.168.10.5",
      saat: "2026-10-02 09:00:00",
    });
    expect(JSON.stringify(b.params)).not.toMatch(/aleta/i);
    expect(b.params[2]).toBe("kpa");
  });

  it("unggah putusan: SEMUA tulisan ke SIPP bebas ALETA, dan jejaknya di aleta_bot_jejak_penetapan menyebut ALETA + siapa + IP", async () => {
    const tulisSipp: Kueri[] = [];
    pasang("db_config.js", {
      query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
        tulisSipp.push({ sql: String(sql), params });
        const s = String(sql);
        if (s.includes("SELECT tanggal_putusan")) return balik(null, [{ tanggal_putusan: "2026-09-01" }]);
        if (s.includes("dirput_dokumen_ref")) return balik(null, [{ ref: 89 }]);
        if (s.includes("FROM sys_users")) return balik(null, [{ username: "derry" }]);
        if (s.startsWith("SELECT")) return balik(null, []);
        return balik(null, { affectedRows: 1 });
      },
    });
    pasang("services/sippSkemaService.js", { tabelAda: async () => true });
    const akar = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-uji-2okt-"));
    pasang("services/dokumenPenetapanService.js", {
      periksaAkarSipp: () => ({ dapatDitulis: true, akar }),
      samakanPemilikSipp: () => undefined,
    });
    pasang("services/abtCetakService.js", {
      kenaliDokumen: (b: Buffer) => (b.subarray(0, 5).toString("latin1") === "%PDF-" ? "pdf" : "rtf"),
      dokumenKePdf: async () => ({ ok: true, pdf: Buffer.from("%PDF-1.4 x") }),
    });
    const unggah = muatSegar<{ unggahPutusan: (m: Record<string, unknown>) => Promise<{ ok: boolean }> }>(
      "services/putusanUnggahService.js"
    );
    const jejakMasuk: Array<Record<string, unknown>> = [];
    const h = await unggah.unggahPutusan({
      perkaraId: "901",
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      pdfPutusan: Buffer.from("%PDF-1.4 putusan"),
      pdfAnonimisasi: Buffer.from("%PDF-1.4 anonim"),
      // Panel ABT mengirim NAMA LENGKAP; yang ditulis ke SIPP username-nya.
      olehUsername: "Derry Briantono",
      ip: "192.168.10.21",
      operator: "Derry (portal)",
      catatJejak: async (j: Record<string, unknown>) => {
        jejakMasuk.push(j);
        return true;
      },
    });
    fs.rmSync(akar, { recursive: true, force: true });
    expect(h.ok).toBe(true);

    const tulis = tulisSipp.filter((q) => /^(INSERT|UPDATE|REPLACE|DELETE)\b/i.test(q.sql.trim()));
    expect(tulis.length).toBeGreaterThanOrEqual(5);
    for (const q of tulis) expect(q.sql + JSON.stringify(q.params), q.sql).not.toMatch(/aleta/i);
    const audit = tulis.filter((q) => q.sql.includes("sys_audittrail"));
    expect(audit.map((a) => a.params[2])).toEqual(["derry", "derry"]);
    expect(audit.map((a) => a.params[1])).toEqual(["192.168.10.21", "192.168.10.21"]);

    // Jejak yang sama, diteruskan ke jejakAletaService (basis data tiruan).
    expect(jejakMasuk).toHaveLength(1);
    const { jejak, kueri } = jejakDenganDbTiruan();
    expect(await jejak.catat(jejakMasuk[0])).toBe(true);
    const sisip = kueri.find((q) => q.sql.includes("INSERT INTO aleta_bot_jejak_penetapan"));
    expect(sisip, "baris jejak ditulis").toBeTruthy();
    const nilai = JSON.stringify(sisip!.params);
    expect(sisip!.params).toContain("ALETA");
    expect(nilai).toContain("derry");
    expect(nilai).toContain("192.168.10.21");
    expect(nilai).toContain("Derry (portal)");
    expect(nilai).toContain("dirput_dokumen");
    expect(kueri.some((q) => /lewat VARCHAR\(20\) NOT NULL DEFAULT 'ALETA'/.test(q.sql))).toBe(true);
  });
});

describe("butir 14 - jeda seperti manusia untuk aksi tulis lewat halaman e-Court", () => {
  const jeda = () =>
    muatSegar<{
      hitung: (j: string, o?: { acak?: () => number }) => number;
      jeda: (j?: string, o?: { kering?: boolean }) => Promise<number>;
      rentang: (j: string) => [number, number];
      setelSkala: (n: number | null) => number;
    }>("services/jedaManusiaService.js");

  it("rentang sama dengan alatJedaManusia ekstensi; hasil selalu di dalam rentang", () => {
    const j = jeda();
    expect(j.rentang("klik")).toEqual([350, 900]);
    expect(j.rentang("unggah")).toEqual([1500, 3500]);
    expect(j.rentang("tak-dikenal")).toEqual([900, 2200]);
    for (const a of [0, 0.3, 0.999]) {
      const ms = j.hitung("simpan", { acak: () => a });
      expect(ms).toBeGreaterThanOrEqual(900);
      expect(ms).toBeLessThanOrEqual(2200);
    }
  });

  it("mode kering dan skala 0 tidak menunggu", async () => {
    const j = jeda();
    expect(await j.jeda("perkara", { kering: true })).toBe(0);
    j.setelSkala(0);
    expect(await j.jeda("perkara")).toBe(0);
    j.setelSkala(null as unknown as number);
  });

  it("pengemudi peramban e-Court menjeda SEBELUM klik, isi, unggah, dan kirim", () => {
    const s = baca("services/ecourtPerambanAksiService.js");
    const sebelum = (jedaTeks: string, aksi: string) => {
      const a = s.indexOf(aksi);
      expect(a, aksi).toBeGreaterThan(0);
      const potongan = s.slice(Math.max(0, a - 120), a);
      expect(potongan, aksi).toContain(jedaTeks);
    };
    sebelum('jedaManusia.jeda("klik"', `page.click('[data-pk-aksi="verifikasi"]')`);
    sebelum('jedaManusia.jeda("klik")', `page.click('[data-pk-aksi="tte"]')`);
    sebelum('jedaManusia.jeda("isi")', `kolom[0].type(String(passphrase || ""))`);
    sebelum('jedaManusia.jeda("unggah")', "kolom[0].uploadFile(jalurBerkas)");
    sebelum('jedaManusia.jeda("simpan")', `page.click('[data-pk-aksi="kirim-dialog"]')`);
  });
});

// ============================================================================
// BUTIR 17 - EDOC PENETAPAN
// ============================================================================
const RTF_GABUNGAN = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}{\colortbl;\red0\green0\blue0;}
\pard\qc{\b PENETAPAN}\par
\pard\qj Nomor 12/Pdt.G/2026/PA.Dgl\par MENETAPKAN\par Menunjuk majelis untuk memeriksa dan memutus perkara tersebut di atas.\par Ketua,\par Drs. H. Ketua Uji, M.H.\par
\pard\qc{\b PENUNJUKAN}\par
\pard\qj MENUNJUK\par Siti sebagai Panitera Sidang.\par Panitera,\par Hj. Panitera Uji, S.H.\par
\pard\qc{\b PENUNJUKAN}\par
\pard\qj MENUNJUK\par Budi sebagai Jurusita Pengganti\par Panitera,\par Hj. Panitera Uji, S.H.\par
\pard\qc{\b PENETAPAN}\par
\pard\qj Menetapkan pemeriksaan perkara tersebut dilangsungkan pada hari Senin\par Ketua Majelis,\par Hakim Uji, S.H.\par
}`;
const PNG = (isi: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(isi.padEnd(64, "."))]);
const PNG_TTD = { 1: PNG("ttd-ketua"), 2: PNG("ttd-panitera"), 3: PNG("ttd-hakim") } as Record<number, Buffer>;
const PNG_CAP = PNG("cap-pengadilan");
const PASSPHRASE = "rahasia-TTE-2okt-9911";

type LayananEdoc = {
  peta: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  unggah: (m: Record<string, unknown>) => Promise<Record<string, any>>;
};
type ModulEdoc = {
  pisahBagian: (r: string) => { ok: boolean; bagian?: Array<{ rtf: string; kepala: string; teks: string }>; alasan?: string };
  ambilBagian: (r: string, j: string) => { ok: boolean; rtf?: string; teks?: string; alasan?: string };
  sisipkanCap: (r: string, m: Record<string, unknown>) => { ok: boolean; rtf?: string; alasan?: string };
  PETA_PTSP: Record<string, any>;
  buatLayanan: (d: Record<string, unknown>) => LayananEdoc;
};

function modulEdoc() {
  pasang("db_config.js", { query: () => undefined });
  pasang("bot_db_config.js", { query: () => undefined });
  return muatSegar<ModulEdoc>("services/penetapanEdocService.js");
}

function depsTiruan({ tte, adaCap = true, untukPengguna }: { tte?: Record<string, unknown>; adaCap?: boolean; untukPengguna?: unknown } = {}) {
  const dokumenAsli = muatSegar<{
    sisipkanTandaTangan: (r: string, m: Record<string, unknown>) => { ok: boolean; rtf?: string };
    TABEL_PENETAPAN: Record<string, string>;
    JENIS_DOKUMEN_ID: Record<string, number>;
  }>("services/dokumenPenetapanService.js");
  const ttdAsli = muatSegar<{ bakuNama: (n: string) => string }>("services/tandaTanganService.js");
  const catatan = {
    simpan: [] as Array<Record<string, unknown>>,
    rtfKePdf: [] as string[],
    jejak: [] as Array<Record<string, unknown>>,
    jeda: 0,
    tte: [] as Array<Record<string, unknown>>,
  };
  const deps = {
    kueriSipp: async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM sys_users")) {
        const t = String(params[0] ?? "").toLowerCase();
        return t === "ptsp1" || t === "petugas ptsp" ? [{ username: "ptsp1" }] : [];
      }
      if (sql.includes("FROM perkara WHERE")) return [{ perkara_id: 901, nomor_perkara: "12/Pdt.G/2026/PA.Dgl" }];
      if (sql.includes("FROM perkara_dokumen_penetapan")) return [{ jenis_dokumen_id: 1, terakhir: "2026-09-30 10:00:00", n: 1 }];
      if (sql.includes("FROM perkara_jurusita")) return [];
      return [{ id: 77 }];
    },
    dokumen: {
      TABEL_PENETAPAN: dokumenAsli.TABEL_PENETAPAN,
      JENIS_DOKUMEN_ID: dokumenAsli.JENIS_DOKUMEN_ID,
      pengaturanBlangko: () => ({ aktif: true, pmh: "http://abt/pmh", ppp: "http://abt/ppp", pjs: "", phs: "http://abt/phs" }),
      ambilBlangko: async () => ({ ok: true, rtf: RTF_GABUNGAN }),
      sisipkanTandaTangan: dokumenAsli.sisipkanTandaTangan,
      jalurDokumen: (n: string, j: string) => `resources/file/doc/2026/10/x/x_Dokumen_${j.toUpperCase()}_1.pdf`,
      simpanKeSipp: async (m: Record<string, unknown>) => {
        catatan.simpan.push(m);
        return { ok: true, jalur: `resources/file/doc/${String(m.jenis)}.pdf`, perkaraPenetapanId: 77 };
      },
    },
    ttd: {
      bakuNama: ttdAsli.bakuNama,
      untukPengguna: async () => untukPengguna ?? null,
      daftar: async () => ({
        baris: [
          { id: 1, namaPejabat: "Drs. H. Ketua Uji, M.H." },
          { id: 2, namaPejabat: "Hj. Panitera Uji, S.H." },
          { id: 3, namaPejabat: "Hakim Uji, S.H." },
        ],
      }),
      gambar: async (id: number) => ({ jenis: "png", isi: PNG_TTD[id] }),
    },
    cetak: {
      rtfKePdf: async (b: Buffer) => {
        catatan.rtfKePdf.push(b.toString("latin1"));
        return { ok: true, pdf: Buffer.from("%PDF-1.4 hasil") };
      },
      kenaliDokumen: (b: Buffer) => {
        const a = b.subarray(0, 5).toString("latin1");
        return a === "%PDF-" ? "pdf" : a.startsWith("{\\rtf") ? "rtf" : "";
      },
      dokumenKeBentuk: async () => ({ ok: false, kode: "soffice_tidak_ada" }),
    },
    jejak: {
      catat: async (j: Record<string, unknown>) => {
        catatan.jejak.push(j);
        return true;
      },
    },
    jeda: {
      jeda: async () => {
        catatan.jeda += 1;
        return 0;
      },
    },
    tte: tte ?? { tersedia: () => false, tandatangani: async () => ({ ok: false, alasan: "tte_belum_tersambung" }) },
  };
  const cap = adaCap
    ? Object.fromEntries(["pmh", "ppp", "pjs", "phs"].map((j) => [j, { isi: PNG_CAP, jenis: "png", id: `cap-${j}`, nama: `Cap ${j}` }]))
    : {};
  return { deps, catatan, cap };
}

const heks = (b: Buffer) => b.toString("hex");

describe("butir 17 - peta blangko PTSP dan pemisahan bagian", () => {
  it("peta menyebut menu ABT 'Form Bantu PTSP' Derry dan bagian gabungan tiap jenis", () => {
    const m = modulEdoc();
    expect(m.PETA_PTSP.menu).toMatchObject({ id: 991, nama: "Form Bantu PTSP", kelompok: "derry_briantono", direktori: "PTSP" });
    expect(m.PETA_PTSP.berkasGabungan).toBe("@ 0 - PMH - PHS.rtf");
    expect(["pmh", "ppp", "pjs", "phs"].map((j) => m.PETA_PTSP.jenis[j].bagianGabungan)).toEqual([1, 2, 3, 4]);
  });

  it("dokumen gabungan dipisah menjadi empat RTF utuh, dikenali dari CIRI isinya", () => {
    const m = modulEdoc();
    const p = m.pisahBagian(RTF_GABUNGAN);
    expect(p.ok).toBe(true);
    expect(p.bagian!.map((b) => b.kepala)).toEqual(["PENETAPAN", "PENUNJUKAN", "PENUNJUKAN", "PENETAPAN"]);
    for (const b of p.bagian!) {
      expect(b.rtf.startsWith("{\\rtf1")).toBe(true);
      expect(b.rtf).toContain("{\\fonttbl");
    }
    expect(m.ambilBagian(RTF_GABUNGAN, "pmh").teks).toContain("ketua uji");
    expect(m.ambilBagian(RTF_GABUNGAN, "ppp").teks).toContain("panitera sidang");
    expect(m.ambilBagian(RTF_GABUNGAN, "pjs").teks).toContain("jurusita pengganti");
    expect(m.ambilBagian(RTF_GABUNGAN, "phs").teks).toContain("dilangsungkan pada hari");
    expect(m.ambilBagian(RTF_GABUNGAN, "pjs").teks).not.toContain("panitera sidang");
  });

  it("dokumen satu bagian yang bukan jenisnya DITOLAK - tidak pernah diunggah sebagai jenis lain", () => {
    const m = modulEdoc();
    const phs = m.ambilBagian(RTF_GABUNGAN, "phs").rtf!;
    expect(m.ambilBagian(phs, "phs").ok).toBe(true);
    expect(m.ambilBagian(phs, "pmh")).toMatchObject({ ok: false, alasan: "blangko_tidak_memuat_pmh" });
  });

  const DERRY = "D:/satker asal/website pa bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono/PTSP/@ 0 - PMH - PHS.rtf";
  it.skipIf(!existsSync(DERRY))("blangko Derry SUNGGUHAN (hanya baca): keempat jenis terpisah dan dikenali", () => {
    const m = modulEdoc();
    const rtf = readFileSync(DERRY, "latin1");
    for (const j of ["pmh", "ppp", "pjs", "phs"]) expect(m.ambilBagian(rtf, j).ok, j).toBe(true);
  });

  it("cap disisipkan sebagai bentuk mengambang DI DEPAN tanda tangan, sebelum gambar tanda tangannya", () => {
    const m = modulEdoc();
    const rtf = String.raw`{\rtf1 \pard Ketua,\par {\pict\pngblip\picwgoal1700\pichgoal800 89504e47aa}\par Nama\par}`;
    const h = m.sisipkanCap(rtf, { isi: PNG_CAP, jenis: "png", penandaTtd: "{\\pict\\pngblip\\picwgoal1700" });
    expect(h.ok).toBe(true);
    const iCap = h.rtf!.indexOf("{\\shp");
    expect(iCap).toBeGreaterThan(0);
    expect(iCap).toBeLessThan(h.rtf!.indexOf("{\\pict\\pngblip\\picwgoal1700"));
    expect(h.rtf).toContain("\\shpfblwtxt0");
    expect(h.rtf).toContain("{\\sn pib}");
    expect(h.rtf).toContain(heks(PNG_CAP));
    expect(m.sisipkanCap(rtf, { isi: Buffer.from("bukan gambar"), penandaTtd: "{\\pict" })).toMatchObject({ ok: false, alasan: "cap_bukan_png_jpg" });
  });
});

describe("butir 17 - unggah edoc penetapan (tiruan SIPP/ABT)", () => {
  it("peta: tersedia = alamat ABT disetel + penetapan ada di SIPP; sudah diunggah terbaca", async () => {
    const m = modulEdoc();
    const { deps } = depsTiruan();
    const p = await m.buatLayanan(deps).peta({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl" });
    const per = Object.fromEntries(p.jenis.map((j: any) => [j.jenis, j]));
    expect(per.pmh).toMatchObject({ tersedia: true, sudahDiunggah: true, jumlahDiunggah: 1 });
    expect(per.ppp).toMatchObject({ tersedia: true, sudahDiunggah: false });
    expect(per.pjs).toMatchObject({ tersedia: false, alasan: "alamat_blangko_pjs_belum_disetel" });
    expect(per.phs.blangko).toMatchObject({ sumber: "ABT", berkas: "@ 2 - PHS.rtf", bagianGabungan: 4 });
  });

  it("KERING (bawaan): tidak ada yang ditulis ke SIPP; tanda tangan dipilih dari NAMA di dokumen", async () => {
    const m = modulEdoc();
    const { deps, catatan, cap } = depsTiruan();
    const h = await m.buatLayanan(deps).unggah({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", jenis: ["pmh", "ppp", "pjs", "phs"], cap });
    expect(h.ok).toBe(true);
    expect(h.kering).toBe(true);
    expect(catatan.simpan).toEqual([]);
    expect(catatan.jeda).toBe(0);
    expect(h.hasil.map((x: any) => [x.jenis, x.tandaTangan.namaPejabat])).toEqual([
      ["pmh", "Drs. H. Ketua Uji, M.H."],
      ["ppp", "Hj. Panitera Uji, S.H."],
      ["pjs", "Hj. Panitera Uji, S.H."],
      ["phs", "Hakim Uji, S.H."],
    ]);
  });

  it("MENULIS: pelaku = akun SIPP yang login, tanpa ALETA di SIPP; cap DI ATAS ttd; jeda antar jenis; jejak jujur", async () => {
    const m = modulEdoc();
    const { deps, catatan, cap } = depsTiruan();
    const h = await m.buatLayanan(deps).unggah({
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      jenis: ["pmh", "phs"],
      cap,
      kering: false,
      olehUsername: "ptsp1",
      penggunaId: "usr-ptsp",
      operator: "Petugas PTSP",
      ip: "192.168.10.44",
    });
    expect(h.ok).toBe(true);
    expect(catatan.simpan.map((s) => [s.jenis, s.olehUsername])).toEqual([
      ["pmh", "ptsp1"],
      ["phs", "ptsp1"],
    ]);
    const keSipp = JSON.stringify(catatan.simpan.map(({ pdf: _pdf, ...sisa }) => sisa));
    expect(keSipp).not.toMatch(/aleta/i);
    // RTF yang diubah ke PDF: cap (shp) mendahului gambar tanda tangan.
    const pmh = catatan.rtfKePdf[0];
    expect(pmh).toContain(heks(PNG_TTD[1]));
    expect(pmh).toContain(heks(PNG_CAP));
    expect(pmh.indexOf("{\\shp")).toBeLessThan(pmh.indexOf(heks(PNG_TTD[1])));
    expect(pmh).not.toMatch(/aleta/i);
    expect(catatan.jeda).toBe(1);
    expect(catatan.jejak).toHaveLength(2);
    expect(catatan.jejak[0]).toMatchObject({ aksi: "unggah", jenis: "edoc_pmh", akunSipp: "ptsp1", operator: "Petugas PTSP", ip: "192.168.10.44", berhasil: true });
    expect(h.akunSipp).toEqual({ username: "ptsp1", terpetakan: true });
    expect(JSON.stringify(catatan.jejak[0])).toContain("cap Cap pmh");
  });

  it("tanpa cap: DITOLAK per jenis (cap_belum_ada), tidak ada yang ditulis", async () => {
    const m = modulEdoc();
    const { deps, catatan, cap } = depsTiruan({ adaCap: false });
    const h = await m.buatLayanan(deps).unggah({ nomorPerkara: "x", jenis: ["pmh"], cap, kering: false, olehUsername: "ptsp1" });
    expect(h.ok).toBe(false);
    expect(h.hasil[0]).toMatchObject({ ok: false, alasan: "cap_belum_ada" });
    expect(catatan.simpan).toEqual([]);
  });

  it("menulis tanpa akun SIPP yang login ditolak - tidak ditulis atas nama kosong/orang lain", async () => {
    const m = modulEdoc();
    const { deps, catatan, cap } = depsTiruan();
    const h = await m.buatLayanan(deps).unggah({ nomorPerkara: "x", jenis: ["pmh"], cap, kering: false, operator: "Orang Lain" });
    expect(h).toMatchObject({ ok: false, alasan: "akun_sipp_tidak_terkirim" });
    expect(catatan.simpan).toEqual([]);
  });

  it("panel tidak mengirim akun SIPP: pengguna ALETA yang login dicocokkan ke sys_users.fullname (orang yang sama)", async () => {
    const m = modulEdoc();
    const { deps, catatan, cap } = depsTiruan();
    const h = await m.buatLayanan(deps).unggah({ nomorPerkara: "x", jenis: ["pmh"], cap, kering: false, operator: "Petugas PTSP" });
    expect(h.ok).toBe(true);
    expect(h.akunSipp).toEqual({ username: "ptsp1", terpetakan: true });
    expect(catatan.simpan[0].olehUsername).toBe("ptsp1");
  });

  it("passphrase tanpa penyedia TTE: TIDAK dikirim ke mana pun, dilaporkan (tte.passphraseDibuang), dipakai gambar ttd + cap", async () => {
    const m = modulEdoc();
    const dipanggil: unknown[] = [];
    const tte = { tersedia: () => false, tandatangani: async (a: unknown) => (dipanggil.push(a), { ok: true, pdf: Buffer.from("%PDF") }) };
    const { deps, catatan, cap } = depsTiruan({ tte });
    const h = await m.buatLayanan(deps).unggah({ nomorPerkara: "x", jenis: ["pmh"], cap, kering: false, olehUsername: "ptsp1", passphrase: PASSPHRASE });
    expect(h.ok).toBe(true);
    expect(h.tte).toEqual({ elektronik: false, passphraseDibuang: true });
    expect(h.hasil[0].tte).toBe(false);
    expect(dipanggil).toEqual([]);
    expect(catatan.simpan).toHaveLength(1);
    expect(JSON.stringify(h) + JSON.stringify(catatan.jejak) + JSON.stringify(catatan.simpan.map(({ pdf: _p, ...x }) => x))).not.toContain(PASSPHRASE);
  });

  it("passphrase ke penyedia TTE SEKALI; tidak ada di jawaban maupun jejak walau penyedia memantulkannya", async () => {
    const m = modulEdoc();
    const dipanggil: Array<Record<string, unknown>> = [];
    const tte = {
      tersedia: () => true,
      tandatangani: async (a: Record<string, unknown>) => {
        dipanggil.push(a);
        return { ok: false, alasan: `passphrase ${String(a.passphrase)} salah` };
      },
    };
    const { deps, catatan, cap } = depsTiruan({ tte });
    const h = await m.buatLayanan(deps).unggah({ nomorPerkara: "x", jenis: ["pmh"], cap, kering: false, olehUsername: "a", passphrase: PASSPHRASE, nik: "1234" });
    expect(dipanggil).toHaveLength(1);
    expect(dipanggil[0].passphrase).toBe(PASSPHRASE);
    expect(JSON.stringify(h)).not.toContain(PASSPHRASE);
    expect(JSON.stringify(catatan.jejak)).not.toContain(PASSPHRASE);
    expect(h.hasil[0].alasan).toContain("***");
    expect(catatan.simpan).toEqual([]);
  });

  it("manual: PDF diunggah apa adanya (dicatat), RTF dibubuhi tanda tangan + cap", async () => {
    const m = modulEdoc();
    const { deps, catatan, cap } = depsTiruan();
    const rtfPmh = m.ambilBagian(RTF_GABUNGAN, "pmh").rtf!;
    const h = await m.buatLayanan(deps).unggah({
      nomorPerkara: "x",
      manual: [
        { jenis: "ppp", isi: Buffer.from("%PDF-1.4 manual ppp") },
        { jenis: "pmh", isi: Buffer.from(rtfPmh, "latin1") },
      ],
      cap,
      kering: false,
      olehUsername: "a",
    });
    expect(h.ok).toBe(true);
    expect(h.hasil.map((x: any) => [x.jenis, x.sumber, x.catatan || ""])).toEqual([
      ["ppp", "manual", "pdf_apa_adanya_ttd_cap_dari_berkas"],
      ["pmh", "manual", ""],
    ]);
    expect(catatan.simpan[0].pdf).toEqual(Buffer.from("%PDF-1.4 manual ppp"));
    expect(catatan.rtfKePdf[0]).toContain(heks(PNG_CAP));
  });
});

describe("butir 17 - penyedia TTE opsional", () => {
  const ENV = "ALETA_TTE_PENETAPAN_URL";
  afterEach(() => {
    delete process.env[ENV];
  });
  const tte = () =>
    muatSegar<{
      tersedia: () => boolean;
      tandatangani: (m: Record<string, unknown>, o?: Record<string, unknown>) => Promise<{ ok: boolean; pdf?: Buffer; alasan?: string }>;
    }>("services/tteProviderService.js");

  it("tanpa alamat: tidak tersedia", async () => {
    const t = tte();
    expect(t.tersedia()).toBe(false);
    expect(await t.tandatangani({ pdf: Buffer.from("%PDF-1"), passphrase: "x", nik: "1" })).toMatchObject({ ok: false, alasan: "tte_belum_tersambung" });
  });

  it("dengan alamat: passphrase terkirim di badan, galat yang memantulkannya disapu", async () => {
    process.env[ENV] = "http://tte.uji/api/sign/pdf";
    const t = tte();
    let badan: FormData | null = null;
    const ok = await t.tandatangani(
      { pdf: Buffer.from("%PDF-1.4 a"), passphrase: PASSPHRASE, nik: "777" },
      {
        fetchFn: async (_u: string, init: { body: FormData }) => {
          badan = init.body;
          return new Response(Buffer.from("%PDF-1.4 bertte"), { status: 200 });
        },
      }
    );
    expect(ok.ok).toBe(true);
    expect((badan as unknown as FormData).get("passphrase")).toBe(PASSPHRASE);
    const gagal = await t.tandatangani(
      { pdf: Buffer.from("%PDF-1.4 a"), passphrase: PASSPHRASE, nik: "777" },
      { fetchFn: async () => { throw new Error(`koneksi ditolak untuk ${PASSPHRASE}`); } }
    );
    expect(gagal.ok).toBe(false);
    expect(gagal.alasan).not.toContain(PASSPHRASE);
  });
});

// ============================================================================
// MIGRASI 0056 - tiga tempat pendaftaran
// ============================================================================
describe("0056 - cap pengadilan: diklaim sekali, tiga tempat pendaftaran", () => {
  const TAG = "0056_aleta_ecourt_cap";
  const SQL = path.join(process.cwd(), "drizzle", `${TAG}.sql`);
  const pernyataan = (sql: string) =>
    sql
      .split("\n")
      .map((b) => b.replace(/--.*$/, ""))
      .join("\n")
      .split(";")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  it("idx 56 bertag 0056_aleta_ecourt_cap tepat sekali, jurnal tanpa lubang", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.idx === 56)).toEqual([expect.objectContaining({ tag: TAG })]);
    expect(j.entries.filter((e) => e.tag.startsWith("0056_"))).toHaveLength(1);
    expect(existsSync(SQL)).toBe(true);
  });

  it("DDL berkas = DDL schema.ts; tabel ikut cadangan; pg-mem kosong membangunnya", () => {
    const dariBerkas = pernyataan(readFileSync(SQL, "utf8"));
    const dariSkema = [...DDL_ECOURT_CAP.tabel, ...DDL_ECOURT_CAP.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_ecourt_cap");
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT * FROM aleta_ecourt_cap")).toEqual([]);
  });
});

// ============================================================================
// RUTE PORTAL atas pg-mem berbenih; bot ditiru lewat fetch.
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const d = () => db as AletaDatabase;

type Kiriman = { url: string; badan: any };
let kiriman: Kiriman[] = [];
function tiruBot(jawab: (url: string, badan: any) => { status?: number; json?: unknown; teks?: string }) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    const j = jawab(String(url), badan);
    return new Response(j.teks ?? JSON.stringify(j.json ?? {}), {
      status: j.status ?? 200,
      headers: { "content-type": j.teks ? "text/html" : "application/json" },
    });
  });
}

async function rute(modul: string, cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}) {
  const r = (await import(`@/app/api/aleta-ecourt/${modul}/route`)) as Record<string, (q: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? `?${opsi.query}` : ""), {
    method: cara,
    headers:
      opsi.badan !== undefined
        ? { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" }
        : { "x-forwarded-for": "10.0.0.9" },
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const j = await r[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}

const CAP_BESAR = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3000, 7)]);

describe("rute portal - cap dan unggah edoc penetapan", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });
  afterAll(() => lepasSemua());

  it("cap: unggah, daftar, matikan (tidak dihapus); gambar bukan PNG/JPG ditolak", async () => {
    const t = await rute("penetapan-edoc/cap", "POST", {
      badan: { tindakan: "tambah", nama: "Cap Panitera PA Donggala", peruntukan: "panitera", isiBase64: CAP_BESAR.toString("base64") },
    });
    expect(t.isi.data).toMatchObject({ ok: true });
    const salah = await rute("penetapan-edoc/cap", "POST", {
      badan: { tindakan: "tambah", nama: "x", peruntukan: "panitera", isiBase64: Buffer.alloc(3000, 1).toString("base64") },
    });
    expect(salah.isi.data).toMatchObject({ ok: false, alasan: "gambar_cap_bukan_png_jpg" });
    const daftar = await rute("penetapan-edoc/cap", "GET");
    expect(daftar.isi.data.baris).toHaveLength(1);
    expect(daftar.isi.data.baris[0]).toMatchObject({ nama: "Cap Panitera PA Donggala", peruntukan: "panitera", aktif: true, jenisBerkas: "png" });
    expect(JSON.stringify(daftar.isi)).not.toContain(CAP_BESAR.toString("base64").slice(0, 40));
    const mati = await rute("penetapan-edoc/cap", "POST", { badan: { tindakan: "aktif", id: daftar.isi.data.baris[0].id, aktif: false } });
    expect(mati.isi.data.ok).toBe(true);
    const lagi = await rute("penetapan-edoc/cap", "GET");
    expect(lagi.isi.data.baris[0].aktif).toBe(false);
  });

  it("unggah: identitas dari sesi, cap dikirim per jenis, passphrase SEKALI ke bot dan tidak tersimpan; audit jujur lewat ALETA", async () => {
    await rute("penetapan-edoc/cap", "POST", {
      badan: { tindakan: "tambah", nama: "Cap Ketua", peruntukan: "ketua", isiBase64: CAP_BESAR.toString("base64") },
    });
    tiruBot(() => ({
      json: { ok: false, alasan: `tte gagal ${PASSPHRASE}`, hasil: [{ jenis: "pmh", sumber: "abt", ok: false, alasan: `ditolak ${PASSPHRASE}` }] },
    }));
    const h = await rute("penetapan-edoc/unggah", "POST", {
      badan: {
        nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
        jenis: ["pmh", "zzz"],
        olehUsername: "ptsp1",
        passphrase: PASSPHRASE,
        nik: "999",
        kering: false,
        konfirmasi: true,
        penggunaId: "usr-lain",
      },
    });
    expect(h.status).toBe(200);
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].url).toContain("/internal/aleta-bot/penetapan-edoc/unggah");
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-super", olehUsername: "ptsp1", jenis: ["pmh"], passphrase: PASSPHRASE, kering: false });
    expect(kiriman[0].badan.cap.pmh).toMatchObject({ nama: "Cap Ketua", jenis: "png" });
    expect(JSON.stringify(h.isi)).not.toContain(PASSPHRASE);
    const tersimpan = JSON.stringify(await d().queryAll<Record<string, unknown>>("SELECT * FROM audit_logs"));
    expect(tersimpan).toContain("PENETAPAN_EDOC_UNGGAH");
    expect(tersimpan).toContain("ALETA");
    expect(tersimpan).toContain("ptsp1");
    expect(tersimpan).not.toContain(PASSPHRASE);
  });

  it("bentuk panel SIPP: JSON {jenis:[PMH], sumber:abt, konfirmasi} MENULIS (kering tidak disebut); jawaban punya berkas[]", async () => {
    await rute("penetapan-edoc/cap", "POST", {
      badan: { tindakan: "tambah", nama: "Cap Umum", peruntukan: "umum", isiBase64: CAP_BESAR.toString("base64") },
    });
    tiruBot(() => ({ json: { ok: true, hasil: [{ jenis: "pmh", sumber: "abt", ok: true, tte: false }], tte: { elektronik: false, passphraseDibuang: true } } }));
    const h = await rute("penetapan-edoc/unggah", "POST", {
      badan: { nomorPerkara: "12/Pdt.G/2026/PA.Dgl", jenis: ["PMH"], sumber: "abt", passphrase: PASSPHRASE, konfirmasi: true },
    });
    expect(kiriman[0].badan).toMatchObject({ jenis: ["pmh"], kering: false, olehUsername: "" });
    expect(kiriman[0].badan.cap.pmh).toMatchObject({ nama: "Cap Umum" });
    expect(h.isi.data.berkas).toEqual([{ jenis: "PMH", ok: true, sebab: "" }]);
    expect(JSON.stringify(h.isi)).not.toContain(PASSPHRASE);
  });

  it("bentuk panel SIPP: FormData manual (berkas_PMH) diteruskan sebagai manual[] base64; passphrase tidak tersimpan", async () => {
    tiruBot(() => ({ json: { ok: true, hasil: [{ jenis: "pmh", sumber: "manual", ok: true }] } }));
    const form = new FormData();
    form.append("nomorPerkara", "12/Pdt.G/2026/PA.Dgl");
    form.append("sumber", "manual");
    form.append("konfirmasi", "true");
    form.append("passphrase", PASSPHRASE);
    form.append("jenis", "PMH");
    form.append("berkas_PMH", new Blob([Buffer.from("%PDF-1.4 manual")], { type: "application/pdf" }), "pmh.pdf");
    const mod = (await import("@/app/api/aleta-ecourt/penetapan-edoc/unggah/route")) as { POST: (q: NextRequest) => Promise<Response> };
    const res = await mod.POST(new NextRequest("http://localhost/api/x", { method: "POST", body: form }));
    const isi = (await res.json()) as any;
    expect(kiriman[0].badan.manual).toEqual([{ jenis: "pmh", isiBase64: Buffer.from("%PDF-1.4 manual").toString("base64") }]);
    expect(kiriman[0].badan.jenis).toEqual([]);
    expect(kiriman[0].badan.kering).toBe(false);
    expect(isi.data.berkas).toEqual([{ jenis: "PMH", ok: true, sebab: "" }]);
    const tersimpan = JSON.stringify(await d().queryAll<Record<string, unknown>>("SELECT * FROM audit_logs"));
    expect(tersimpan).not.toContain(PASSPHRASE);
  });

  it("peta: jenis tanpa cap TIDAK tersedia (sebab disebut); tte/cap/tautanCap berbentuk yang dibaca panel", async () => {
    await rute("penetapan-edoc/cap", "POST", {
      badan: { tindakan: "tambah", nama: "Cap Panitera", peruntukan: "panitera", isiBase64: CAP_BESAR.toString("base64") },
    });
    const blangko = { sumber: "ABT", menu: "derry_briantono/PTSP (Form Bantu PTSP)", berkas: "@ 0 - PMH - PHS.rtf", bagianGabungan: 2 };
    tiruBot(() => ({
      json: {
        ok: true,
        tteElektronik: false,
        perkara: { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl" },
        jenis: [
          { jenis: "pmh", judul: "PMH", tersedia: true, alasan: "", sudahDiunggah: false, blangko: { ...blangko, berkas: "@ 1 - PMH.rtf", bagianGabungan: 1 }, penandatangan: "ketua" },
          { jenis: "ppp", judul: "PPP", tersedia: true, alasan: "", sudahDiunggah: true, blangko, penandatangan: "panitera" },
        ],
      },
    }));
    const p = await rute("penetapan-edoc/peta", "GET", { query: "nomor=1/Pdt.G/2026/PA.Dgl" });
    const per = Object.fromEntries(p.isi.data.jenis.map((j: any) => [j.jenis, j]));
    expect(per.pmh).toMatchObject({ tersedia: false, alasan: "cap_belum_ada" });
    expect(per.pmh.sebab).toContain("cap");
    expect(per.ppp).toMatchObject({ tersedia: true, sebab: "", sudahDiunggah: true, penandatangan: "Panitera / Plh Panitera" });
    expect(per.ppp.nama).toContain("@ 0 - PMH - PHS.rtf (bagian 2)");
    expect(p.isi.data.cap).toMatchObject({ ada: true, nama: "Cap Panitera" });
    expect(p.isi.data.tte).toMatchObject({ elektronik: false });
    expect(p.isi.data.tautanCap.startsWith("/aleta/")).toBe(true);
  });

  it("menulis tanpa konfirmasi ditolak sebelum bot dipanggil; bot lama (404 HTML) = belum tersedia", async () => {
    tiruBot(() => ({ status: 404, teks: "<html>Cannot GET</html>" }));
    const tanpa = await rute("penetapan-edoc/unggah", "POST", { badan: { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenis: ["pmh"], kering: false } });
    expect(tanpa.isi.data).toMatchObject({ ok: false, alasan: "konfirmasi_belum_diberikan" });
    expect(kiriman).toHaveLength(0);
    const peta = await rute("penetapan-edoc/peta", "GET", { query: "nomor=1/Pdt.G/2026/PA.Dgl" });
    expect(peta.status).toBe(404);
    expect(peta.isi.data).toMatchObject({ ok: false, belumTersedia: true, alasan: "fitur_belum_tersedia_di_server" });
    const unggah = await rute("penetapan-edoc/unggah", "POST", { badan: { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenis: ["PMH"], konfirmasi: true } });
    expect(unggah.status).toBe(404);
  });
});
