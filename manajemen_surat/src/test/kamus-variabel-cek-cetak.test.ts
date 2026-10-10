// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cerminDari,
  pilihAcuan,
  rekapUraian,
  rujukanDalamPetik,
  tabelDibaca,
  uraiVariabel,
  type DefinisiAbt,
} from "@/lib/kamus-sumber-abt";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KAMUS_SUMBER } from "@/server/db/schema";
import {
  kueriDataSipp,
  nilaiSippUntukCek,
  pastikanKamusAwal,
  rapikanNilaiJembatan,
  uraiUlangKamus,
  type BenihKamus,
} from "@/server/modules/aleta-ecourt/kamus-sumber";

/**
 * ============================================================================
 * D1 KAMUS VARIABEL ABT + B1 NILAI SIPP UNTUK PENGINGAT SEBELUM CETAK
 * ============================================================================
 *
 * Contoh kueri di bawah disalin APA ADANYA dari aps_badilag.abt_variabel
 * lokal (salinan server 9 Okt 2026) - bukan dikarang.
 */

const NYATA: Record<string, DefinisiAbt> = {
  "0001": { noVar: "0001", nama: "No Perkara", jenis: "data_sipp", dataTabel: "perkara", dataKolom: "nomor_perkara" },
  "0098": { noVar: "0098", nama: "Nama #0046#", jenis: "data_sipp", dataTabel: "perkara_pihak1", dataKolom: "nama", urutanData: 1 },
  "1036": { noVar: "1036", nama: "Alamat #0046# II", jenis: "data_sipp", dataTabel: "perkara_pihak1", dataKolom: "alamat", urutanData: 2 },
  "0046": {
    noVar: "0046",
    nama: "Pemohon/ Penggugat",
    jenis: "data_sql",
    sqlQuery:
      'select (case when alur_perkara_id=16 or jenis_perkara_id=346 or jenis_perkara_id=341 then "Pemohon" when alur_perkara_id=122 or alur_perkara_id=123  then "Penuntut Umum" else "Penggugat" end) as data from perkara where perkara_id=#perkara_id#',
  },
  "0012": {
    noVar: "0012",
    nama: "Nama #0668#",
    jenis: "data_sql",
    sqlQuery: 'select b.nama_gelar as data from perkara_hakim_pn a join hakim_pn b on a.hakim_id=b.id where a.aktif="Y" and a.urutan=1 and a.perkara_id=#perkara_id#',
  },
  "0015": {
    noVar: "0015",
    nama: "Nama PP",
    jenis: "data_sql",
    sqlQuery: 'select panitera_nama as data from perkara_panitera_pn  where aktif="Y" and perkara_id=#perkara_id#',
  },
  "0106": {
    noVar: "0106",
    nama: "Nama Kuasa #0046#",
    jenis: "data_sql",
    sqlQuery: "select nama as data from perkara_pengacara where pihak_ke=1 and urutan=1 and perkara_id=#perkara_id#",
  },
  "0166": {
    noVar: "0166",
    nama: "Agama Kuasa #0046#",
    jenis: "data_sql",
    sqlQuery:
      "select c.nama as data from perkara_pengacara a join pihak b on a.pengacara_id=b.id join agama c on b.agama_id=c.id where a.pihak_ke=1 and a.urutan=1 and a.perkara_id=#perkara_id#",
  },
  "5403": {
    noVar: "5403",
    nama: "NAMA PANITERA SIDANG YANG SEBELUMNYA (PENGGANTIAN PANITERA)",
    jenis: "data_sql",
    sqlQuery:
      "SELECT ganti_panitera.panitera_nama AS data\nFROM perkara_panitera_pn AS a\nLEFT JOIN perkara AS b ON a.perkara_id = b.perkara_id\nLEFT JOIN (\n    SELECT perkara_id, panitera_nama\n    FROM perkara_panitera_pn\n    WHERE aktif = 'T' AND tanggal_tidak_aktif IS NOT NULL\n) AS ganti_panitera ON a.perkara_id = ganti_panitera.perkara_id\nWHERE a.aktif = 'Y'\nAND a.tanggal_penetapan = \"#0033#\"\nAND a.perkara_id = #perkara_id#;",
  },
  "0143": {
    noVar: "0143",
    nama: "Total Biaya Perkara",
    jenis: "data_sql",
    sqlQuery: "SELECT (0#0279# + 0#6060# + 0#0312# + 0#6063# + 0#6061# + 0#6062# + 0#0026# + 0#0281# + 0#0242# + 0#0243# + 0#0244# + 0#5223#) as data;",
  },
  "0279": { noVar: "0279", nama: "Biaya Pendaftaran", jenis: "data_sql", sqlQuery: "select jumlah as data from perkara_biaya where jenis_biaya_id=61 and perkara_id=#perkara_id#" },
  "1069": { noVar: "1069", nama: "Tgl Putusan", jenis: "data_sipp", dataTabel: "perkara_putusan", dataKolom: "tanggal_putusan" },
  "0025": { noVar: "0025", nama: "Hari Tgl Putusan", jenis: "tanggal_hari", referensi: "1069" },
  "0033": { noVar: "0033", nama: "Tgl Sidang", jenis: "multi_sidang" },
  "0156": { noVar: "0156", nama: "Kantor Kuasa #0046# (nama kantor di surat kuasa/gugatan, mis. DERRY & PARTNERS) #11111#", jenis: "data_teks" },
  "8503": { noVar: "8503", nama: "HURUF ALASAN PERCERAIAN (A-H GABUNGAN BEBAS)", jenis: "data_teks" },
  "8537": { noVar: "8537", nama: "Nama Advokat Kuasa #0046# (kosong = dari SIPP) #11111#", jenis: "data_teks" },
  "1214": { noVar: "1214", nama: "Alat-alat bukti CG/CT", jenis: "data_teks" },
  "0004": { noVar: "0004", nama: "Sebab konflik", jenis: "" },
  "7999": {
    noVar: "7999",
    nama: "Contoh kantor kuasa dalam petik tunggal",
    jenis: "data_sql",
    sqlQuery: "SELECT CASE WHEN '#0156#' != '' THEN CONCAT('melalui kantor ', '#0156#') ELSE '' END AS data",
  },
  "7998": {
    noVar: "7998",
    nama: "Contoh nama pihak dalam petik ganda, sebutan dalam petik tunggal, komentar",
    jenis: "data_sql",
    sqlQuery: "SELECT CONCAT(\"#0098#\", ' sebagai ', '#0046#') AS data -- '#0156#' di komentar bukan kueri\nFROM perkara WHERE perkara_id = #perkara_id#",
  },
};
const PETA = new Map(Object.entries(NYATA));
const urai = (kode: string) => uraiVariabel(NYATA[kode], PETA);

describe("D1 - urai definisi nyata ABT", () => {
  it("data_sipp: kolom SIPP + urutan pihak, otomatis, bercermin", () => {
    expect(urai("0098")).toMatchObject({ tipe: "data_sipp", sumber: "sipp", sumberRinci: "perkara_pihak1.nama (urutan 1)", status: "otomatis", cermin: "nama_pihak1" });
    expect(urai("0098").arti).toBe("Nama Penggugat/Pemohon. Dibaca langsung dari SIPP perkara_pihak1.nama (urutan 1).");
    expect(urai("0001").cermin).toBe("nomor_perkara");
    expect(urai("1069").cermin).toBe("tanggal_putusan");
    expect(urai("1036").cermin).toBe(""); // alamat bukan data inti
  });

  it("data_sql: tabel yang dibaca dan cermin dari KUERI, bukan dari nama", () => {
    expect(urai("0012")).toMatchObject({ sumber: "sipp", status: "otomatis", cermin: "hakim_ketua", tabelSipp: ["hakim_pn", "perkara_hakim_pn"] });
    expect(urai("0015").cermin).toBe("panitera_pengganti");
    expect(urai("0106").cermin).toBe("kuasa_pihak1");
    expect(urai("0279").cermin).toBe("biaya");
    // c.nama sesudah JOIN agama = nama agama; panitera aktif='T' di subkueri = orang lain.
    expect(urai("0166").cermin).toBe("");
    expect(urai("5403").cermin).toBe("");
    // #0046# adalah SEBUTAN (pelajaran 0033), bukan nama pihak.
    expect(urai("0046").cermin).toBe("");
  });

  it("turunan: dirangkai dari variabel lain; tanggal_hari mengikuti acuannya", () => {
    expect(urai("0143")).toMatchObject({ sumber: "turunan", status: "otomatis", cermin: "biaya", tabelSipp: [] });
    expect(urai("0143").rujukan).toContain("0279");
    expect(urai("0025")).toMatchObject({ sumber: "turunan", status: "otomatis", sumberRinci: "tanggal_hari dari #1069#" });
    expect(urai("0033")).toMatchObject({ sumber: "sipp", status: "otomatis" });
  });

  it("isian manual, tanpa tipe, dan isian yang meniru SIPP", () => {
    expect(urai("1214")).toMatchObject({ tipe: "teks", sumber: "isian", status: "manual", cermin: "" });
    expect(urai("8537")).toMatchObject({ sumber: "isian", status: "manual", cermin: "kuasa_pihak1" });
    expect(urai("0156").cermin).toBe(""); // kantor kuasa, bukan nama kuasa
    expect(urai("0004")).toMatchObject({ tipe: "tanpa tipe", sumber: "tanpa", status: "tanpa-sumber" });
  });

  it("rawan petik: teks bebas di dalam petik; sebutan tetap, petik ganda untuk nama, dan komentar tidak", () => {
    expect(urai("7999")).toMatchObject({ status: "rawan-petik", rujukanPetik: ["0156"] });
    expect(urai("7999").arti).toContain("Rawan petik: #0156#");
    expect(urai("7998").status).toBe("otomatis");
    expect(rujukanDalamPetik(NYATA["7998"].sqlQuery!)).toEqual([
      { kode: "0046", petik: "'" },
      { kode: "0098", petik: '"' },
    ]);
    // Nama pihak di dalam petik TUNGGAL patah oleh apostrof (Ma'ruf).
    const tunggal = { noVar: "7997", jenis: "data_sql", sqlQuery: "SELECT CONCAT('#0098#', '') AS data" };
    expect(uraiVariabel(tunggal, PETA).status).toBe("rawan-petik");
    expect(tabelDibaca("select a.x from perkara_pihak1 a left join `pihak` b on 1 where y in (select 1 from dual)")).toEqual(["perkara_pihak1", "pihak"]);
  });

  it("acuan untuk isian manual: data_sipp didahulukan, yang bersarang tidak", () => {
    const kandidat = [
      { noVar: "0170", jenis: "data_sql", status: "otomatis", cermin: "kuasa_pihak1" },
      { noVar: "0106", jenis: "data_sql", status: "otomatis", cermin: "kuasa_pihak1" },
      { noVar: "0143", jenis: "data_sql", status: "otomatis", cermin: "biaya", bersarang: ["0279"] },
      { noVar: "0279", jenis: "data_sql", status: "otomatis", cermin: "biaya" },
      { noVar: "1069", jenis: "data_sipp", status: "otomatis", cermin: "tanggal_putusan" },
      { noVar: "9000", jenis: "data_sql", status: "otomatis", cermin: "tanggal_putusan" },
    ];
    expect(pilihAcuan(kandidat, "kuasa_pihak1")).toBe("0106");
    expect(pilihAcuan(kandidat, "biaya")).toBe("0279");
    expect(pilihAcuan(kandidat, "tanggal_putusan")).toBe("1069");
    expect(pilihAcuan(kandidat, "jurusita")).toBe("");
  });

  it("cerminDari menebak nama HANYA untuk isian manual", () => {
    expect(cerminDari({ noVar: "x", jenis: "data_tanggal", nama: "Tgl. Putusan (isi bila belum di SIPP)" })).toBe("tanggal_putusan");
    expect(cerminDari({ noVar: "x", jenis: "data_sql", nama: "Tgl Putusan", sqlQuery: "select now() as data" })).toBe("");
  });
});

// ============================================================================
// SELURUH SALINAN LOKAL - angka laporan
// ============================================================================

const JALUR_BENIH = path.join(process.cwd(), "src/server/modules/aleta-ecourt/kamus-variabel-awal.json");
const BENIH = JSON.parse(readFileSync(JALUR_BENIH, "utf8")) as BenihKamus;
const defBenih = (b: BenihKamus["variabel"][number]): DefinisiAbt => ({
  noVar: b.k,
  nama: b.n,
  jenis: b.j,
  dataTabel: b.t,
  dataKolom: b.c,
  urutanData: b.u ?? null,
  referensi: b.r,
  sqlQuery: b.q,
});

describe("D1 - isi awal dari salinan lokal abt_variabel (9 Okt 2026)", () => {
  it("1.285 variabel terurai; angka status sama dengan laporan", () => {
    const peta = new Map(BENIH.variabel.map((b) => [b.k, defBenih(b)]));
    const semua = BENIH.variabel.map((b) => uraiVariabel(defBenih(b), peta));
    const r = rekapUraian(semua);
    expect(r.jumlah).toBe(1285);
    expect(r.perStatus).toEqual({ otomatis: 487, manual: 241, "rawan-petik": 97, "tanpa-sumber": 460 });
    const dipakai = BENIH.variabel.map((b, i) => ({ b, u: semua[i] })).filter((x) => (x.b.b ?? 0) > 0);
    expect(rekapUraian(dipakai.map((x) => x.u)).perStatus).toEqual({ otomatis: 375, manual: 222, "rawan-petik": 81, "tanpa-sumber": 59 });
    // Kasus rencana A8: 7080 rawan atas 0156.
    const i7080 = BENIH.variabel.findIndex((b) => b.k === "7080");
    expect(semua[i7080].status).toBe("rawan-petik");
    expect(semua[i7080].rujukanPetik).toContain("0156");
  });
});

// ============================================================================
// MIGRASI 0059
// ============================================================================

describe("0059 - diklaim sekali, DDL berkas = schema.ts", () => {
  const TAG = "0059_aleta_kamus_variabel_sumber";
  const SQL = path.join(process.cwd(), "drizzle", `${TAG}.sql`);
  const pernyataan = (sql: string) =>
    sql
      .split("\n")
      .map((b) => b.replace(/--.*$/, ""))
      .join("\n")
      .split(";")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  it("tag 0059 tepat sekali di jurnal, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0059_"))).toEqual([expect.objectContaining({ tag: TAG })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_KAMUS_SUMBER; berjalan di atas tabel 0033", () => {
    const dariBerkas = pernyataan(readFileSync(SQL, "utf8"));
    const dariSkema = [...DDL_KAMUS_SUMBER.kolom, ...DDL_KAMUS_SUMBER.indeks].map((s) => pernyataan(s)[0]);
    expect(dariBerkas).toEqual(dariSkema);
    const kosong = newDb();
    kosong.public.none(readFileSync(path.join(process.cwd(), "drizzle/0033_aleta_kamus_variabel.sql"), "utf8"));
    kosong.public.none(readFileSync(SQL, "utf8"));
    kosong.public.none(readFileSync(SQL, "utf8")); // dua kali tetap aman (IF NOT EXISTS)
    expect(kosong.public.many("SELECT status, cermin_sipp, blangko_pakai FROM aleta_kamus_variabel")).toEqual([]);
  });
});

// ============================================================================
// BASIS DATA + RUTE
// ============================================================================

const BENIH_KECIL: BenihKamus = {
  asal: "uji",
  blangko: ["putusan/CG Verstek.rtf", "bas/BAS Sidang 1.rtf"],
  variabel: [
    { k: "0001", n: "No Perkara", j: "data_sipp", t: "perkara", c: "nomor_perkara", b: 2, bl: [0, 1] },
    { k: "0098", n: "Nama #0046#", j: "data_sipp", t: "perkara_pihak1", c: "nama", u: 1, b: 2, bl: [0, 1] },
    { k: "0102", n: "Nama #0047#", j: "data_sipp", t: "perkara_pihak2", c: "nama", u: 1, b: 1, bl: [0] },
    { k: "0106", n: "Nama Kuasa #0046#", j: "data_sql", q: NYATA["0106"].sqlQuery, b: 1, bl: [0] },
    { k: "0143", n: "Total Biaya Perkara", j: "data_sql", q: "SELECT (0#0279#) as data;", b: 1, bl: [0] },
    { k: "0279", n: "Biaya Pendaftaran", j: "data_sql", q: NYATA["0279"].sqlQuery },
    { k: "1214", n: "Alat-alat bukti CG/CT", j: "data_teks", b: 1, bl: [0] },
    { k: "8537", n: "Nama Advokat Kuasa #0046# (kosong = dari SIPP) #11111#", j: "data_teks", b: 1, bl: [0] },
    { k: "0156", n: "Kantor Kuasa #0046#", j: "data_teks" },
    { k: "7999", n: "Contoh rawan", j: "data_sql", q: NYATA["7999"].sqlQuery },
    { k: "0004", n: "Sebab konflik" },
  ],
};

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
const kueriBot: Array<{ op: string; params: Record<string, unknown> }> = [];
let jawabKueri: (sql: string) => { ok: boolean; data?: unknown; error?: string } = () => ({ ok: false, error: "bot mati" });

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-sipp/aleta-sipp-datasource")>();
  return {
    ...modul,
    callAletaBotSippBridge: async (op: string, params: Record<string, unknown>) => {
      kueriBot.push({ op, params });
      return jawabKueri(String(params.sql ?? ""));
    },
  };
});

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };

async function panggil(rute: "kamus-sumber" | "abt-cek-sipp", cara: "GET" | "PATCH" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul =
    rute === "kamus-sumber" ? await import("@/app/api/aleta-ecourt/kamus-sumber/route") : await import("@/app/api/aleta-ecourt/abt-cek-sipp/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("D1/B1 di basis data (pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    kueriBot.length = 0;
    jawabKueri = () => ({ ok: false, error: "bot mati" });
    await db.run(`DELETE FROM aleta_kamus_variabel`);
    await pastikanKamusAwal(db, BENIH_KECIL);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db?.close();
    db = null;
  });

  it("isi awal: ditanam dari benih, terurai, blangko pemakai ikut; rekap otomatis vs manual", async () => {
    const r = await panggil("kamus-sumber", "GET", { query: "batas=50&dipakai=1" });
    expect(r.status).toBe(200);
    const d = r.isi.data as { rekap: { jumlah: number; perStatus: Record<string, number> }; butir: Array<Record<string, unknown>>; jumlahCocok: number };
    expect(d.rekap.jumlah).toBe(11);
    expect(d.rekap.perStatus).toEqual({ otomatis: 6, manual: 3, "rawan-petik": 1, "tanpa-sumber": 1 });
    // Bawaan layar: hanya yang dipakai blangko.
    expect(d.jumlahCocok).toBe(7);
    const v0098 = d.butir.find((b) => b.noVar === "0098")!;
    expect(v0098).toMatchObject({ sumber: "sipp", status: "otomatis", cermin: "nama_pihak1", cerminLabel: "Nama Penggugat/Pemohon", jumlahBlangko: 2 });
    expect(v0098.blangko).toEqual(["putusan/CG Verstek.rtf", "bas/BAS Sidang 1.rtf"]);
    const semua = (await panggil("kamus-sumber", "GET", { query: "status=rawan-petik" })).isi.data as { butir: Array<Record<string, unknown>> };
    expect(semua.butir.map((b) => b.noVar)).toEqual(["7999"]);
  });

  it("sunting arti/sumber/cermin (Super Admin) tidak ditimpa urai ulang; kembalikan memulihkan uraian", async () => {
    aktor = "usr-ppg";
    expect((await panggil("kamus-sumber", "PATCH", { badan: { noVar: "1214", arti: "x", sumber: "isian" } })).status).toBe(403);
    aktor = "usr-super";
    const s = await panggil("kamus-sumber", "PATCH", {
      badan: { noVar: "1214", arti: "Daftar bukti surat P.1 dst.", sumber: "ecourt", sumberRinci: "dokumen e-Court", cermin: "" },
    });
    expect(s.status).toBe(200);
    expect(s.isi.data.butir).toMatchObject({ arti: "Daftar bukti surat P.1 dst.", sumber: "ecourt", disunting: true, status: "manual" });
    expect((await panggil("kamus-sumber", "PATCH", { badan: { noVar: "1214", arti: "x", sumber: "ngawur" } })).status).toBe(400);
    expect((await panggil("kamus-sumber", "PATCH", { badan: { noVar: "1214", arti: "x", sumber: "isian", cermin: "bukan_kunci" } })).status).toBe(400);

    await uraiUlangKamus(db!, { benih: BENIH_KECIL });
    const r = (await panggil("kamus-sumber", "GET", { query: "cari=1214" })).isi.data as { butir: Array<Record<string, unknown>> };
    expect(r.butir[0]).toMatchObject({ arti: "Daftar bukti surat P.1 dst.", sumber: "ecourt", disunting: true });

    const k = await panggil("kamus-sumber", "PATCH", { badan: { noVar: "1214", kembalikan: true } });
    expect(k.isi.data.butir).toMatchObject({ sumber: "isian", disunting: false });
    expect(String((k.isi.data.butir as Record<string, unknown>).arti)).toContain("Diketik petugas di ABT");
  });

  it("B1: nilai SIPP dihitung dengan definisi yang sama - data_sipp ber-urutan seperti ABT, isian manual lewat acuan", async () => {
    jawabKueri = (sql) => {
      if (sql.includes("perkara_pihak1")) return { ok: true, data: { ada: true, nilai: "Siti Aminah" } };
      if (sql.includes("perkara_pihak2")) return { ok: true, data: { ada: true, nilai: "Budi Santoso" } };
      if (sql.includes("perkara_pengacara")) return { ok: true, data: { ada: true, nilai: "Andi Wijaya, S.H." } };
      if (sql.includes("jenis_biaya_id=61")) return { ok: true, data: { ada: true, nilai: "30000.00" } };
      if (sql.includes("nomor_perkara")) return { ok: true, data: { ada: true, nilai: "533/Pdt.G/2026/PA.Dgl" } };
      // 0143 sesudah #0279# disisipkan penyelesai bertingkat.
      if (/^SELECT \(0\s*30000(\.00)?\) as data;$/.test(sql)) return { ok: true, data: { ada: true, nilai: "30000" } };
      return { ok: true, data: { ada: true, kosong: true, nilai: "" } };
    };
    aktor = "usr-ppg";
    const r = await panggil("abt-cek-sipp", "GET", { query: "perkaraId=10018&kode=0001,0098,0102,0106,8537,1214,0143,9999" });
    expect(r.status).toBe(200);
    const butir = r.isi.data.butir as Array<Record<string, unknown>>;
    expect(butir.map((b) => b.kode)).toEqual(["0001", "0098", "0102", "0106", "8537", "0143"]);
    expect(butir.find((b) => b.kode === "0098")).toMatchObject({ cermin: "nama_pihak1", terbaca: true, nilaiSipp: "Siti Aminah", acuan: "" });
    expect(butir.find((b) => b.kode === "8537")).toMatchObject({ status: "manual", cermin: "kuasa_pihak1", acuan: "0106", nilaiSipp: "Andi Wijaya, S.H." });
    expect(butir.find((b) => b.kode === "0143")).toMatchObject({ cermin: "biaya", terbaca: true, nilaiSipp: "30000" });
    expect(kueriBot.map((x) => String(x.params.sql))).toContainEqual(expect.stringMatching(/^SELECT \(0\s*30000/));
    expect(String(r.isi.data.catatan)).toMatch(/CETAK tidak ditahan/);
    // Kueri data_sipp persis Abt_model::get_data_variabel, perkara sebagai parameter.
    const sql0098 = kueriBot.find((x) => String(x.params.sql).includes("perkara_pihak1"))!;
    expect(sql0098.op).toBe("kamus.jalankanKueri");
    expect(sql0098.params).toEqual({ sql: "select nama as data from perkara_pihak1 where perkara_id=#perkara_id# and urutan=1 limit 1", perkaraId: "10018" });
    // 0106 dihitung sekali walau dipakai dua kali (dirinya + acuan 8537).
    expect(kueriBot.filter((x) => String(x.params.sql).includes("perkara_pengacara"))).toHaveLength(1);
    expect(kueriBot.every((x) => x.op === "kamus.jalankanKueri")).toBe(true);
  });

  it("B1: perkaraId wajib angka; jembatan mati = tidak terbaca, bukan error halaman", async () => {
    expect((await panggil("abt-cek-sipp", "GET", { query: "perkaraId=abc&kode=0098" })).status).toBe(400);
    const r = await nilaiSippUntukCek(db!, { perkaraId: "10018", kode: "0098" });
    expect(r.butir).toEqual([expect.objectContaining({ kode: "0098", terbaca: false, nilaiSipp: "" })]);
  });

  it("kueriDataSipp menolak nama tabel/kolom liar; jembatan Date dirapikan tanpa zona waktu", () => {
    expect(kueriDataSipp("perkara_putusan_pemberitahuan_putusan", "max(tanggal_pemberitahuan_putusan)", "")).toBe(
      "select max(tanggal_pemberitahuan_putusan) as data from perkara_putusan_pemberitahuan_putusan where perkara_id=#perkara_id# limit 1"
    );
    expect(kueriDataSipp("perkara; drop", "nama", "1")).toBeNull();
    expect(kueriDataSipp("perkara", "nama from x", "1")).toBeNull();
    expect(rapikanNilaiJembatan("Thu Oct 01 2026 00:00:00 GMT+0800 (Waktu Indonesia Tengah)")).toBe("2026-10-01");
    expect(rapikanNilaiJembatan("Thu Oct 01 2026 09:30:00 GMT+0800 (WITA)")).toBe("2026-10-01 09:30:00");
    expect(rapikanNilaiJembatan("Budi")).toBe("Budi");
  });
});
