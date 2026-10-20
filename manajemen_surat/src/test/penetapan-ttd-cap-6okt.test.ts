// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BAWAAN_PETA_PENETAPAN,
  GalatPetaPenetapan,
  aturUntukBot,
  bersihkanAturPenetapan,
} from "@/lib/peta-penetapan";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { olahPikselCap } from "@/server/shared/cap-latar-transparan";

import { ASAL, Dunia, abtPalsu, jawaban, minta, nyalakan, type Pelayan } from "./dunia-latar";

/**
 * ============================================================================
 * PERBAIKAN 6 OKT 2026 - BUTIR 17-20: EDOC PENETAPAN DARI BLANGKO ABT,
 * TANDA TANGAN SESUAI NAMA, CAP KANTOR DI ATAS TANDA TANGAN, PETA PENETAPAN
 * ============================================================================
 *
 * Yang dijaga (semua dengan TIRUAN - tanpa SIPP/ABT/basis data bot sungguhan,
 * kecuali bagian yang membaca blangko Derry setempat HANYA-BACA):
 *
 *   A. Bubuhan RTF: gambar bawaan blok tanda tangan dibuang, nama penanda
 *      tangan dibaca dari LABEL jabatannya, tanda tangan sah dicocokkan ke
 *      nama itu (tidak dikarang), cap DI ATAS tanda tangan.
 *   B. Unggah ke SIPP berbentuk sama dengan unggahan manual petugas (berkas
 *      resources/file/doc/... + baris perkara_dokumen_penetapan merujuk baris
 *      petugas yang SAMA dengan SIPP), dan KERING sebagai bawaan.
 *   C. Peta penetapan: bawaan PMH/PHS, pengaturan hanya admin, penjaga unggah
 *      otomatis di rute.
 *   D. Cap: latar dibuang menjadi PNG transparan.
 *   E. Ekstensi: latar.js "relaas-rtf" (jalan cetak relaas yang sama) dan
 *      blok konten.js 6 Okt tanpa jalur tulis baru.
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

type BarisTtd = { id: number; namaPejabat: string; disahkanPada?: string; penggunaId?: string };
type Edoc = {
  bubuhkanPenetapan: (p: Record<string, unknown>) => Promise<any>;
  bubuhkanTtdCap: (r: string, o: Record<string, unknown>) => any;
  cariPenandaTangan: (r: string, o: Record<string, unknown>) => any;
  cocokkanTandaTangan: (n: string, d: BarisTtd[], b: (x: string) => string) => any;
  buangGambarBlokTtd: (r: string, o?: Record<string, unknown>) => any;
  sapuRtf: (r: string) => { kedalamanAkhir: number; baris: Array<{ teks: string }> };
  ambilBagian: (r: string, j: string) => { ok: boolean };
  aturBerlaku: (j: string, k?: unknown) => Record<string, unknown>;
  redamkanAlfaPng: (b: Buffer, o: number) => Buffer;
  UKURAN_TTD_CAP: Record<string, number>;
  buatLayanan: (d: Record<string, unknown>) => { unggah: (m: Record<string, unknown>) => Promise<any> };
};
function modulEdoc(): Edoc {
  pasang("db_config.js", { query: () => undefined });
  pasang("bot_db_config.js", { query: () => undefined });
  return muatSegar<Edoc>("services/penetapanEdocService.js");
}
const bakuNama = (n: string) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const heks = (b: Buffer) => b.toString("hex");

// Gambar sungguhan (berkepala IHDR) - ukuran piksel dipakai menghitung tinggi.
let TTD_KETUA: Buffer;
let TTD_WAKIL: Buffer;
let TTD_HAKIM: Buffer;
let CAP_PNG: Buffer; // RGBA - transparan
let CAP_JPG: Buffer; // tanpa transparansi
let GAMBAR_LAMA: Buffer; // gambar bawaan blangko
beforeAll(async () => {
  const png = (w: number, h: number, warna: { r: number; g: number; b: number; alpha: number }) =>
    sharp({ create: { width: w, height: h, channels: 4, background: warna } }).png().toBuffer();
  TTD_KETUA = await png(400, 200, { r: 10, g: 10, b: 60, alpha: 0.9 });
  TTD_WAKIL = await png(300, 100, { r: 20, g: 10, b: 50, alpha: 0.8 });
  TTD_HAKIM = await png(240, 160, { r: 0, g: 0, b: 0, alpha: 0.7 });
  CAP_PNG = await png(500, 600, { r: 110, g: 60, b: 180, alpha: 0.5 });
  CAP_JPG = await sharp({ create: { width: 500, height: 600, channels: 3, background: { r: 110, g: 60, b: 180 } } }).jpeg().toBuffer();
  GAMBAR_LAMA = await png(50, 40, { r: 1, g: 2, b: 3, alpha: 1 });
});
afterEach(() => lepasSemua());

/**
 * RTF berbentuk keluaran ABT Derry "@ 1 - PMH": blok tanda tangan berinden
 * \li4535, gambar BAWAAN (cap + ttd Ketua lama) tertambat di "Ditetapkan di"
 * dan "Pada tanggal", lalu #7050# yang diisi ABT lewat cleanHtmlTagSpecial
 * ("Ketua,<br><br><br><strong>Nama</strong>" -> \par dan \b).
 */
function rtfPmh({ label = "Ketua,", nama = "Ketua Contoh, S.H.I., M.H.", lama = true } = {}) {
  const bentukLama = (isi: Buffer, ket: string) =>
    String.raw`{\shp{\*\shpinst\shpleft3765\shptop237\shpright5328\shpbottom2158\shpfhdr0\shpbxcolumn\shpbypara\shpwr3\shpfblwtxt0\shpz1{\sp{\sn shapeType}{\sv 75}}{\sp{\sn pib}{\sv {\pict\pngblip\picwgoal1563\pichgoal1921 ` +
    heks(isi) +
    String.raw`}}}{\sp{\sn wzDescription}{\sv ` +
    ket +
    String.raw`}}}{\shprslt{\pict }}}`;
  return (
    String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\paperw12240\margl2268\margr1239` +
    "\n" +
    String.raw`\pard\plain\qc{\b PENETAPAN}\par` +
    "\n" +
    String.raw`\pard\plain\qj Nomor 12/Pdt.G/2026/PA.Dgl\par Ketua Pengadilan Agama Donggala\par MENETAPKAN\par 1.\tab {\b Hakim Anggota Satu, S.H.} sebagai Ketua Majelis;\par 2.\tab {\b Wakil Contoh, S.H.} sebagai Hakim Anggota;\par untuk memeriksa dan memutus perkara tersebut di atas.\par` +
    "\n" +
    String.raw`\pard\plain\qj\li4535\ri0\sl360\slmult1 {\fs24 Ditetapkan di Donggala}` +
    (lama ? bentukLama(GAMBAR_LAMA, "Cap DgL terbaru") : "") +
    String.raw`{\fs24 \par }{\fs24 Pada tanggal 15 September 2026}` +
    (lama ? bentukLama(GAMBAR_LAMA, "TTD PAK KETUA") : "") +
    String.raw`{\fs24 \par }{\fs24 ` +
    label +
    String.raw`\par \par \par \b ` +
    nama +
    String.raw`\b0 }{\fs24 \par }}`
  );
}

function rtfPhs({ label = "Ketua Majelis,", nama = "Hakim Anggota Satu, S.H." } = {}) {
  return (
    String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\paperw12240\margl2268\margr1239` +
    String.raw`\pard\plain\qc{\b PENETAPAN}\par\pard\plain\qj - Menetapkan pemeriksaan perkara tersebut dilangsungkan pada hari Senin tanggal 6 Oktober 2026;\par` +
    String.raw`\pard\plain\qj\fi-431\li4535 Ditetapkan di Donggala\par Pada tanggal 1 Oktober 2026\par ` +
    label +
    String.raw`\par \par \par {\b ` +
    nama +
    String.raw`}\par }`
  );
}

const DAFTAR: BarisTtd[] = [
  { id: 1, namaPejabat: "Ketua Contoh, S.H.I., M.H." },
  { id: 2, namaPejabat: "Wakil Contoh, S.H." },
  { id: 3, namaPejabat: "Hakim Anggota Satu, S.H." },
];
const GAMBAR: Record<number, () => Buffer> = { 1: () => TTD_KETUA, 2: () => TTD_WAKIL, 3: () => TTD_HAKIM };

async function bubuh(rtf: string, jenis: string, lain: Record<string, unknown> = {}) {
  const m = modulEdoc();
  return m.bubuhkanPenetapan({
    rtf,
    jenis,
    atur: {},
    cap: { isi: CAP_PNG, jenis: "png", id: "cap-1", nama: "Cap PA Donggala" },
    daftarTtd: DAFTAR,
    ambilGambar: async (id: number) => ({ jenis: "png", isi: GAMBAR[id]() }),
    bakuNama,
    ...lain,
  });
}

/** Bentuk-bentuk (\shp) di RTF: nama, z, kiri/atas/lebar/tinggi, depan/belakang. */
function bentukDi(rtf: string) {
  const hasil: Array<{ nama: string; z: number; kiri: number; atas: number; lebar: number; tinggi: number; depan: boolean; di: number }> = [];
  const re = /\{\\shp\{\\\*\\shpinst\\shpleft(-?\d+)\\shptop(-?\d+)\\shpright(-?\d+)\\shpbottom(-?\d+)[^{]*?\\shpfblwtxt(\d)\\shpz(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rtf))) {
    const nama = (/\{\\sn wzName\}\{\\sv ([^}]*)\}/.exec(rtf.slice(m.index, m.index + 1200)) || [])[1] || "";
    hasil.push({
      nama,
      kiri: Number(m[1]),
      atas: Number(m[2]),
      lebar: Number(m[3]) - Number(m[1]),
      tinggi: Number(m[4]) - Number(m[2]),
      depan: m[5] === "0",
      z: Number(m[6]),
      di: m.index,
    });
  }
  return hasil;
}

// ===========================================================================
// A. BUBUHAN
// ===========================================================================
describe("A. PMH: tanda tangan sesuai nama di bawah 'Ketua,' + cap DI ATAS tanda tangan", () => {
  it("gambar bawaan blok ttd dibuang; ttd Ketua lalu cap ditambatkan di paragraf nama; cap z lebih tinggi, menumpang sisi kiri", async () => {
    const h = await bubuh(rtfPmh(), "pmh");
    expect(h.ok).toBe(true);
    expect(h.gambarBawaan).toEqual({ dibuang: 2, uraian: ["Cap DgL terbaru", "TTD PAK KETUA"] });
    expect(h.rtf).not.toContain(heks(GAMBAR_LAMA));
    expect(h.penandaTangan).toEqual({ label: "Ketua,", nama: "Ketua Contoh, S.H.I., M.H." });
    expect(h.tandaTangan).toMatchObject({ id: 1, namaPejabat: "Ketua Contoh, S.H.I., M.H.", sumber: "nama_lengkap" });
    expect(h.peringatan).toEqual([]);

    const [ttd, cap, ...lebih] = bentukDi(h.rtf);
    expect(lebih).toEqual([]);
    expect(ttd.nama).toBe("Tanda tangan");
    expect(cap.nama).toBe("Cap");
    // Cap DI ATAS: ditulis sesudah ttd, z lebih tinggi, di depan teks.
    expect(cap.di).toBeGreaterThan(ttd.di);
    expect(cap.z).toBeGreaterThan(ttd.z);
    expect(ttd.depan && cap.depan).toBe(true);
    // Keduanya tertambat di paragraf NAMA (sebelum huruf pertama nama, sesudah label).
    const iNama = h.rtf.indexOf("Ketua Contoh, S.H.I.");
    expect(ttd.di).toBeGreaterThan(h.rtf.indexOf("Ketua,\\par"));
    expect(cap.di).toBeLessThan(iNama);
    // Tanda tangan tepat di atas nama, di inden blok (\li4535): bawahnya di
    // sekitar puncak paragraf nama.
    expect(ttd.kiri).toBe(4535);
    expect(ttd.atas).toBeLessThan(0);
    expect(ttd.atas + ttd.tinggi).toBeGreaterThanOrEqual(0);
    expect(ttd.atas + ttd.tinggi).toBeLessThan(300);
    // Perbandingan gambar ttd (400x200) dijaga: 40 mm x 20 mm.
    expect(Math.abs(ttd.lebar / ttd.tinggi - 2)).toBeLessThan(0.02);
    // Cap menumpang sisi KIRI tanda tangan: pusatnya di kiri pusat ttd, tetapi bertumpang.
    const pusatTtd = ttd.kiri + ttd.lebar / 2;
    const pusatCap = cap.kiri + cap.lebar / 2;
    expect(pusatCap).toBeLessThan(pusatTtd);
    expect(cap.kiri + cap.lebar).toBeGreaterThan(ttd.kiri);
    expect(cap.atas).toBeLessThan(ttd.atas + ttd.tinggi);
    // RTF tetap seimbang dan masih dikenali sebagai PMH.
    const m = modulEdoc();
    expect(m.sapuRtf(h.rtf).kedalamanAkhir).toBe(0);
    expect(m.ambilBagian(h.rtf, "pmh").ok).toBe(true);
  });

  it("'Wakil Ketua,': ttd WAKIL - bukan Ketua, bukan nama majelis yang juga tertulis di badan penetapan", async () => {
    const h = await bubuh(rtfPmh({ label: "Wakil Ketua,", nama: "Wakil Contoh, S.H." }), "pmh");
    expect(h.tandaTangan).toMatchObject({ id: 2, namaPejabat: "Wakil Contoh, S.H." });
    expect(h.rtf).toContain(heks(TTD_WAKIL));
    expect(h.rtf).not.toContain(heks(TTD_KETUA));
    expect(h.rtf).not.toContain(heks(TTD_HAKIM));
  });

  it("'Plh. Ketua,' dikenali sebagai penanda tangan PMH", async () => {
    const m = modulEdoc();
    const s = m.cariPenandaTangan(rtfPmh({ label: "Plh. Ketua,", nama: "Plh Contoh, S.H." }), { penandatangan: "ketua" });
    expect(s).toMatchObject({ ok: true, label: "Plh. Ketua,", nama: "Plh Contoh, S.H." });
  });

  it("TTD TIDAK ADA untuk nama itu: TIDAK dikarang - dokumen tetap disusun tanpa ttd & tanpa cap, gambar bawaan (ttd orang lain) tetap dibuang, petugas diberi tahu", async () => {
    const h = await bubuh(rtfPmh({ label: "Plh. Ketua,", nama: "Pejabat Baru, S.H." }), "pmh");
    expect(h.ok).toBe(true);
    expect(h.tandaTangan).toBeNull();
    expect(h.cap).toBeNull();
    expect(bentukDi(h.rtf)).toEqual([]);
    expect(h.rtf).not.toContain(heks(GAMBAR_LAMA));
    for (const g of [TTD_KETUA, TTD_WAKIL, TTD_HAKIM, CAP_PNG]) expect(h.rtf).not.toContain(heks(g));
    expect(h.peringatan.map((p: any) => p.kode)).toEqual(["tanda_tangan_tidak_ada_untuk_nama", "cap_dilewati_tanpa_tanda_tangan"]);
    expect(h.peringatan[0].nama).toBe("Pejabat Baru, S.H.");
  });

  it("kalimat galat ABT #7050# ('KETUA/WAKIL/HAKIM BARU ... HUBUNGI ADMIN') tidak dianggap nama", async () => {
    const h = await bubuh(rtfPmh({ label: "Ketua/Wakil Ketua,", nama: "KETUA/WAKIL/HAKIM BARU YANG BELUM DIINPUT DI VARIABEL ABT NO 7050 MOHON HUBUNGI ADMIN" }), "pmh");
    expect(h.tandaTangan).toBeNull();
    expect(bentukDi(h.rtf)).toEqual([]);
    expect(h.peringatan[0].kode).toMatch(/label_penanda_tangan_tidak_ditemukan|nama_penanda_tangan_tidak_terbaca/);
  });

  it("pencocokan nama: penuh dulu; tanpa gelar bila hanya SATU orang; dua orang berbeda = tidak ada yang dipakai", () => {
    const m = modulEdoc();
    const d: BarisTtd[] = [
      { id: 7, namaPejabat: "Sudarmin H.I.M. Tang, S.H.I., M.H.", disahkanPada: "2026-09-01T00:00:00Z" },
      { id: 8, namaPejabat: "Sudarmin H.I.M. Tang, S.H.I.,M.H", disahkanPada: "2026-10-01T00:00:00Z" },
      { id: 9, namaPejabat: "Drs. H. Abdul Salam" },
      { id: 10, namaPejabat: "Abdul Salam, S.Ag." },
      { id: 11, namaPejabat: "Abdul Salam Lain, S.H." },
    ];
    // ABT menulis "S.H.I.,M.H" - sama huruf-angkanya dengan dua baris; yang terbaru disahkan.
    expect(m.cocokkanTandaTangan("Sudarmin H.I.M. Tang, S.H.I.,M.H", d, bakuNama)).toMatchObject({ baris: { id: 8 }, cara: "nama_lengkap" });
    expect(m.cocokkanTandaTangan("Sudarmin H.I.M. Tang", d, bakuNama)).toMatchObject({ baris: { id: 8 }, cara: "nama_tanpa_gelar" });
    expect(m.cocokkanTandaTangan("H. Abdul Salam, S.H.I.", d, bakuNama)).toMatchObject({ baris: null, alasan: "tanda_tangan_ganda_untuk_nama" });
    expect(m.cocokkanTandaTangan("Orang Lain, S.H.", d, bakuNama)).toMatchObject({ baris: null, alasan: "tanda_tangan_tidak_ada_untuk_nama" });
  });

  it("berkas sah ganda untuk SATU orang: yang ditautkan ke akun didahulukan, baru yang terbaru disahkan (19 Okt)", () => {
    const m = modulEdoc();
    const d: BarisTtd[] = [
      { id: 21, namaPejabat: "Idris, S.H.I., M.H.", disahkanPada: "2026-10-18T00:00:00Z" },
      { id: 22, namaPejabat: "Idris, S.H.I., M.H.", disahkanPada: "2026-10-01T00:00:00Z", penggunaId: "usr-idris" },
    ];
    expect(m.cocokkanTandaTangan("Idris, S.H.I., M.H.", d, bakuNama)).toMatchObject({ baris: { id: 22 }, cara: "nama_lengkap" });
    // tanpa tautan sama sekali: tetap yang terbaru disahkan (perilaku lama)
    const tanpa: BarisTtd[] = d.map((b) => ({ ...b, penggunaId: "" }));
    expect(m.cocokkanTandaTangan("Idris, S.H.I., M.H.", tanpa, bakuNama)).toMatchObject({ baris: { id: 21 } });
  });

  it("cap JPG / PNG tanpa alfa: ditaruh DI BELAKANG (tidak menutupi tanda tangan) dan disebut", async () => {
    const h = await bubuh(rtfPmh(), "pmh", { cap: { isi: CAP_JPG, jenis: "jpg", id: "c", nama: "Cap foto" } });
    const [ttd, cap] = bentukDi(h.rtf);
    expect(cap.nama).toBe("Cap");
    expect(cap.depan).toBe(false);
    expect(cap.z).toBeLessThan(ttd.z);
    expect(h.rtf).toContain("\\jpegblip");
    expect(h.peringatan.map((p: any) => p.kode)).toContain("cap_tanpa_latar_transparan_di_belakang");
  });

  it("ukuran & letak dari pengaturan (mm) dipakai; nilai di luar batas dijepit", async () => {
    const h = await bubuh(rtfPmh(), "pmh", { atur: { lebarCapMm: 20, capGeserKiriMm: 0, capGeserAtasMm: 0, lebarTtdMm: 30 } });
    const [ttd, cap] = bentukDi(h.rtf);
    expect(Math.round(ttd.lebar / (1440 / 25.4))).toBe(30);
    expect(Math.round(Math.max(cap.lebar, cap.tinggi) / (1440 / 25.4))).toBe(20); // kotak cap persegi 20 mm (19 Okt: diameter tetap)
    expect(Math.abs(cap.kiri + cap.lebar / 2 - (ttd.kiri + ttd.lebar / 2))).toBeLessThan(2);
    const m = modulEdoc();
    expect(m.aturBerlaku("pmh", { lebarCapMm: 9999, penandatangan: "siapa-saja", pakaiCap: "ya" })).toMatchObject({ lebarCapMm: 60, penandatangan: "ketua", pakaiCap: true });
  });
});

describe("A. PHS: tanda tangan ketua majelis sesuai namanya, TANPA cap (bawaan)", () => {
  it("'Ketua Majelis,' -> ttd hakim itu; cap tidak dibubuhkan walau ada", async () => {
    const h = await bubuh(rtfPhs(), "phs");
    expect(h.tandaTangan).toMatchObject({ id: 3, namaPejabat: "Hakim Anggota Satu, S.H." });
    expect(h.cap).toBeNull();
    const bentuk = bentukDi(h.rtf);
    expect(bentuk.map((b) => b.nama)).toEqual(["Tanda tangan"]);
    expect(h.rtf).not.toContain(heks(CAP_PNG));
    // Baris pertama paragraf nama berinden gantung (\fi-431): x = li + fi.
    expect(bentuk[0].kiri).toBe(4535 - 431);
  });

  it("hakim tunggal ('Hakim,') juga dikenali; cap menyala lewat pengaturan (butir 20)", async () => {
    const h = await bubuh(rtfPhs({ label: "Hakim,", nama: "Hakim Anggota Satu, S.H." }), "phs", { atur: { pakaiCap: true } });
    expect(bentukDi(h.rtf).map((b) => b.nama)).toEqual(["Tanda tangan", "Cap"]);
  });

  it("label PMH ('Ketua,') TIDAK dipakai untuk PHS - penanda tangan PHS adalah ketua majelis", async () => {
    // Lewat pengaturan BAWAAN jenis phs (tanpa menyebut penandatangan).
    const h = await bubuh(rtfPhs({ label: "Ketua,", nama: "Ketua Contoh, S.H.I., M.H." }), "phs");
    expect(h.tandaTangan).toBeNull();
    expect(h.peringatan[0].kode).toBe("label_penanda_tangan_tidak_ditemukan");
    const m = modulEdoc();
    expect(m.cariPenandaTangan(rtfPhs({ label: "Ketua," }), { penandatangan: "ketua_majelis" })).toMatchObject({
      ok: false,
      alasan: "label_penanda_tangan_tidak_ditemukan",
    });
  });
});

const DERRY = "D:/satker asal/website pa bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono/PTSP";
describe.skipIf(!existsSync(DERRY))("A. blangko Derry SUNGGUHAN (hanya baca), diisi seperti ABT", () => {
  /** Meniru views/abt/preview.php + cleanHtmlTagSpecial untuk variabel yang dibutuhkan. */
  const isiAbt = (rtf: string, nilai: Record<string, string>) => {
    let s = rtf.split("\n").join("").split("\r").join("");
    for (const [k, v] of Object.entries(nilai)) {
      const rtfNilai = v.replace(/<br(\s*)?\/?>/gi, "\\par ").replace(/<strong>/g, "\\b ").replace(/<\/strong>/g, "\\b0 ");
      s = s.split(`#${k}#`).join(rtfNilai);
    }
    return s.replace(/#\d{4}#/g, "...");
  };
  it("@ 1 - PMH: dua gambar bawaan (cap + ttd lama) dibuang, ttd Wakil + cap dibubuhkan, RTF seimbang", async () => {
    const asli = readFileSync(path.join(DERRY, "@ 1 - PMH.rtf"), "latin1");
    const rtf = isiAbt(asli, { "7050": "Wakil Ketua,<br><br><br><strong>Wakil Contoh, S.H.</strong>", "8011": "Donggala", "1060": "15 September 2026" });
    const h = await bubuh(rtf, "pmh");
    expect(h.gambarBawaan.dibuang).toBe(2);
    expect(h.tandaTangan).toMatchObject({ namaPejabat: "Wakil Contoh, S.H." });
    expect(bentukDi(h.rtf).map((b) => b.nama)).toEqual(["Tanda tangan", "Cap"]);
    expect(modulEdoc().sapuRtf(h.rtf).kedalamanAkhir).toBe(0);
  });
  it("@ 2 - PHS: tiga ttd hakim bawaan dibuang, hanya ttd ketua majelis perkara ini", async () => {
    const asli = readFileSync(path.join(DERRY, "@ 2 - PHS.rtf"), "latin1");
    const rtf = isiAbt(asli, { "4004": "Ketua Majelis", "0012": "Hakim Anggota Satu, S.H.", "8011": "Donggala", "1064": "1 Oktober 2026" });
    const h = await bubuh(rtf, "phs");
    expect(h.gambarBawaan.dibuang).toBe(3);
    expect(h.tandaTangan).toMatchObject({ namaPejabat: "Hakim Anggota Satu, S.H." });
    expect(bentukDi(h.rtf).map((b) => b.nama)).toEqual(["Tanda tangan"]);
  });
});

// ===========================================================================
// B. UNGGAH KE SIPP - BENTUK SAMA DENGAN UNGGAHAN MANUAL, KERING BAWAAN
// ===========================================================================
function depsLayanan(catatan: { simpan: any[]; pdf: string[] }, { tahan = false } = {}) {
  const dokumenAsli = muatSegar<{ TABEL_PENETAPAN: Record<string, string>; JENIS_DOKUMEN_ID: Record<string, number> }>("services/dokumenPenetapanService.js");
  return {
    kueriSipp: async (sql: string) => {
      if (sql.includes("FROM sys_users")) return [{ username: "ptsp1" }];
      if (sql.includes("FROM perkara WHERE")) return [{ perkara_id: 901, nomor_perkara: "12/Pdt.G/2026/PA.Dgl" }];
      return [{ id: 77 }];
    },
    dokumen: {
      ...dokumenAsli,
      pengaturanBlangko: () => ({ aktif: false }),
      ambilBlangko: async () => ({ ok: false, alasan: "tidak dipakai" }),
      jalurDokumen: () => "resources/file/doc/2026/10/x/x_Dokumen_PMH_1.pdf",
      simpanKeSipp: async (m: Record<string, unknown>) => {
        catatan.simpan.push(m);
        return { ok: true, jalur: "resources/file/doc/x.pdf" };
      },
    },
    ttd: {
      bakuNama,
      daftar: async () => ({ baris: DAFTAR }),
      gambar: async (id: number) => ({ jenis: "png", isi: GAMBAR[id]() }),
      untukPengguna: async () => null,
    },
    cetak: {
      rtfKePdf: async (b: Buffer) => {
        catatan.pdf.push(b.toString("latin1"));
        return { ok: true, pdf: Buffer.from("%PDF-1.4 x") };
      },
      kenaliDokumen: (b: Buffer) => (b.subarray(0, 5).toString("latin1").startsWith("{\\rtf") ? "rtf" : ""),
      dokumenKeBentuk: async () => ({ ok: false }),
    },
    jejak: { catat: async () => true },
    jeda: { jeda: async () => 0 },
    tte: { tersedia: () => false, tandatangani: async () => ({ ok: false }) },
    _tahan: tahan,
  };
}

describe("B. unggah edoc penetapan dari RTF ABT ekstensi (abt[])", () => {
  it("KERING sebagai BAWAAN: tanpa kering:false tidak ada yang ditulis ke SIPP, tetapi ttd/cap/peringatan dilaporkan", async () => {
    const m = modulEdoc();
    const catatan = { simpan: [] as any[], pdf: [] as string[] };
    const h = await m.buatLayanan(depsLayanan(catatan)).unggah({
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      abt: [{ jenis: "pmh", isi: Buffer.from(rtfPmh(), "latin1"), berkas: "@ 1 - PMH.rtf" }],
      cap: { pmh: { isi: CAP_PNG, jenis: "png", id: "cap-1", nama: "Cap" } },
      olehUsername: "ptsp1",
    });
    expect(h.kering).toBe(true);
    expect(catatan.simpan).toEqual([]);
    expect(h.hasil[0]).toMatchObject({ jenis: "pmh", sumber: "abt", berkas: "@ 1 - PMH.rtf", ok: true, kering: true, tandaTangan: { namaPejabat: "Ketua Contoh, S.H.I., M.H." } });
    expect(h.hasil[0].gambarBawaan.dibuang).toBe(2);
  });

  it("MENULIS: PDF dari RTF bercap diserahkan ke simpanKeSipp atas akun SIPP yang login; PHS tanpa cap walau cap dikirim", async () => {
    const m = modulEdoc();
    const catatan = { simpan: [] as any[], pdf: [] as string[] };
    const h = await m.buatLayanan(depsLayanan(catatan)).unggah({
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      abt: [
        { jenis: "pmh", isi: Buffer.from(rtfPmh(), "latin1"), berkas: "@ 1 - PMH.rtf" },
        { jenis: "phs", isi: Buffer.from(rtfPhs(), "latin1"), berkas: "@ 2 - PHS.rtf" },
      ],
      cap: { pmh: { isi: CAP_PNG, jenis: "png", id: "cap-1", nama: "Cap" }, phs: { isi: CAP_PNG, jenis: "png", id: "cap-1", nama: "Cap" } },
      kering: false,
      olehUsername: "ptsp1",
    });
    expect(h.ok).toBe(true);
    expect(catatan.simpan.map((s) => [s.jenis, s.olehUsername, String(s.pdf).slice(0, 5)])).toEqual([
      ["pmh", "ptsp1", "%PDF-"],
      ["phs", "ptsp1", "%PDF-"],
    ]);
    expect(catatan.pdf[0]).toContain(heks(m.redamkanAlfaPng(CAP_PNG, m.UKURAN_TTD_CAP.opasitasCap))); // cap dibubuhkan semi-transparan (19 Okt)
    expect(catatan.pdf[1]).not.toContain(heks(CAP_PNG));
    expect(catatan.pdf.join("")).not.toMatch(/aleta/i);
  });

  it("tahanBilaTanpaTtd: penanda tangan tanpa ttd sah -> DITAHAN, tidak ada PDF maupun tulisan ke SIPP", async () => {
    const m = modulEdoc();
    const catatan = { simpan: [] as any[], pdf: [] as string[] };
    const h = await m.buatLayanan(depsLayanan(catatan)).unggah({
      nomorPerkara: "x",
      abt: [{ jenis: "pmh", isi: Buffer.from(rtfPmh({ nama: "Pejabat Baru, S.H." }), "latin1") }],
      atur: { pmh: { tahanBilaTanpaTtd: true } },
      kering: false,
      olehUsername: "ptsp1",
    });
    expect(h.hasil[0]).toMatchObject({ ok: false, alasan: "ditahan_tanpa_tanda_tangan" });
    expect(catatan.pdf).toEqual([]);
    expect(catatan.simpan).toEqual([]);
  });

  it("RTF ABT yang bukan RTF (halaman masuk ABT) ditolak per jenis", async () => {
    const m = modulEdoc();
    const catatan = { simpan: [] as any[], pdf: [] as string[] };
    const h = await m.buatLayanan(depsLayanan(catatan)).unggah({ nomorPerkara: "x", abt: [{ jenis: "pmh", isi: Buffer.from("<html>login</html>") }], kering: false, olehUsername: "a" });
    expect(h.hasil[0]).toMatchObject({ ok: false, alasan: "jawaban_abt_bukan_rtf" });
    expect(catatan.simpan).toEqual([]);
  });
});

describe("B. simpanKeSipp: berkas + baris perkara_dokumen_penetapan SEPERTI unggahan manual petugas", () => {
  const AKAR = path.join("D:/Aplikasi/aleta/tmp", `uji-sipp-penetapan-${process.pid}`);
  afterAll(() => rmSync(AKAR, { recursive: true, force: true }));

  it("PMH merujuk baris perkara_hakim_pn URUTAN 1 (bukan id terbesar); jalur & nama berkas berbentuk SIPP; diinput_oleh akun yang login", async () => {
    mkdirSync(path.join(AKAR, "resources/file/doc"), { recursive: true });
    const kueri: Array<{ sql: string; params: unknown[] }> = [];
    pasang("db_config.js", {
      query: (sql: string, params: unknown[], cb: (g: unknown, h: unknown) => void) => {
        kueri.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
        if (/FROM perkara_hakim_pn/.test(sql)) return cb(null, [{ id: 29014 }]);
        return cb(null, { insertId: 1 });
      },
    });
    pasang("services/sippSkemaService.js", { tabelAda: async () => true });
    const lama = process.env.ALETA_SIPP_ROOT;
    process.env.ALETA_SIPP_ROOT = AKAR;
    try {
      const d = muatSegar<{ simpanKeSipp: (m: Record<string, unknown>) => Promise<any>; KUERI_BARIS_PETUGAS: Record<string, string> }>("services/dokumenPenetapanService.js");
      expect(d.KUERI_BARIS_PETUGAS.pmh).toMatch(/ORDER BY \(urutan = 1\) DESC/);
      const saat = new Date(2026, 9, 6, 9, 15, 30);
      const pdf = Buffer.from("%PDF-1.4 penetapan");
      // 13 Okt 2026: diinput_tanggal = jam SIPP (WIB) dari basis data, bukan jam
      // container; saatSipp menirukannya. Jalur berkasnya tetap dari saat.
      const h = await d.simpanKeSipp({ perkaraId: 10126, nomorPerkara: "574/Pdt.G/2026/PA.Dgl", jenis: "pmh", pdf, olehUsername: "fahri", saat, saatSipp: "2026-10-06 08:15:30" });
      const epoch = Math.floor(saat.getTime() / 1000);
      const jalur = `resources/file/doc/2026/10/574_PdtG_2026_PADgl/574_PdtG_2026_PADgl_Dokumen_PMH_${epoch}.pdf`;
      expect(h).toMatchObject({ ok: true, jalur, perkaraPenetapanId: 29014 });
      expect(readFileSync(path.join(AKAR, jalur))).toEqual(pdf);
      const pilih = kueri.find((k) => /FROM perkara_hakim_pn/.test(k.sql))!;
      expect(pilih.sql).toContain("(urutan = 1) DESC");
      const sisip = kueri.find((k) => /INSERT INTO perkara_dokumen_penetapan/.test(k.sql))!;
      expect(sisip.params).toEqual([10126, 29014, 1, 1, "PMH", jalur, "fahri", "2026-10-06 08:15:30"]);
      expect(JSON.stringify(sisip.params)).not.toMatch(/aleta/i);
    } finally {
      if (lama === undefined) delete process.env.ALETA_SIPP_ROOT;
      else process.env.ALETA_SIPP_ROOT = lama;
    }
  });

  // Pengguna 6 Okt 2026: "penetapan pmh, ppp, pjs dan phs harus pdf". Pintu
  // tulis satu-satunya ke e-Doc penetapan menolak RTF/DOCX - tidak ada berkas
  // yang ditulis dan tidak ada baris yang disisipkan.
  it.each([
    ["RTF", Buffer.from("{\\rtf1\\ansi penetapan}", "latin1")],
    ["DOCX", Buffer.from("PK\u0003\u0004word/document.xml", "latin1")],
  ])("PMH/PPP/PJS/PHS SELALU PDF: %s ditolak 'bukan_pdf' sebelum menulis apa pun", async (_bentuk, isi) => {
    mkdirSync(path.join(AKAR, "resources/file/doc"), { recursive: true });
    const kueri: string[] = [];
    pasang("db_config.js", {
      query: (sql: string, _params: unknown[], cb: (g: unknown, h: unknown) => void) => {
        kueri.push(String(sql));
        return cb(null, [{ id: 1 }]);
      },
    });
    pasang("services/sippSkemaService.js", { tabelAda: async () => true });
    const lama = process.env.ALETA_SIPP_ROOT;
    process.env.ALETA_SIPP_ROOT = AKAR;
    try {
      const d = muatSegar<{ simpanKeSipp: (m: Record<string, unknown>) => Promise<any> }>("services/dokumenPenetapanService.js");
      for (const jenis of ["pmh", "ppp", "pjs", "phs"]) {
        const h = await d.simpanKeSipp({ perkaraId: 10126, nomorPerkara: "575/Pdt.G/2026/PA.Dgl", jenis, pdf: isi, olehUsername: "fahri" });
        expect(h, jenis).toEqual({ ok: false, alasan: "bukan_pdf" });
      }
      expect(kueri.filter((s) => /INSERT/i.test(s))).toEqual([]);
      expect(existsSync(path.join(AKAR, "resources/file/doc/2026/10/575_PdtG_2026_PADgl"))).toBe(false);
    } finally {
      if (lama === undefined) delete process.env.ALETA_SIPP_ROOT;
      else process.env.ALETA_SIPP_ROOT = lama;
    }
  });
});

let adaSoffice = false;
try {
  execFileSync(process.env.ALETA_SOFFICE || "soffice", ["--version"], { timeout: 15000, stdio: "ignore" });
  adaSoffice = true;
} catch {
  adaSoffice = false;
}
describe.skipIf(!adaSoffice)("B. PDF sungguhan lewat soffice (hanya bila soffice terpasang)", () => {
  it("RTF bertanda tangan + cap menjadi PDF yang memuat dua gambar", async () => {
    const h = await bubuh(rtfPmh(), "pmh");
    const cetak = muatSegar<{ rtfKePdf: (b: Buffer) => Promise<{ ok: boolean; pdf: Buffer }> }>("services/abtCetakService.js");
    const r = await cetak.rtfKePdf(Buffer.from(h.rtf, "latin1"));
    expect(r.ok).toBe(true);
    expect((r.pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) || []).length).toBeGreaterThanOrEqual(2);
  }, 120000);
});

// ===========================================================================
// C. PETA PENETAPAN
// ===========================================================================
describe("C. peta penetapan - aturan murni", () => {
  it("bawaan: PMH -> '@ 1 - PMH.rtf' (ttd Ketua + cap), PHS -> '@ 2 - PHS.rtf' (ttd ketua majelis, tanpa cap), PPP/PJS -> berkas tunggal '@ 0a'/'@ 0b' (cadangan gabungan '@ 0'; I9 17 Okt) tanpa unggah otomatis", () => {
    expect(BAWAAN_PETA_PENETAPAN.pmh).toMatchObject({ aktif: true, namaBerkas: "@ 1 - PMH.rtf", otomatisUnggah: true, pakaiTtd: true, pakaiCap: true, penandatangan: "ketua" });
    expect(BAWAAN_PETA_PENETAPAN.phs).toMatchObject({ aktif: true, namaBerkas: "@ 2 - PHS.rtf", otomatisUnggah: true, pakaiTtd: true, pakaiCap: false, penandatangan: "ketua_majelis" });
    expect(BAWAAN_PETA_PENETAPAN.ppp).toMatchObject({ aktif: true, namaBerkas: "@ 0a - PPP.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", otomatisUnggah: false, pakaiCap: true, penandatangan: "panitera" });
    expect(BAWAAN_PETA_PENETAPAN.pjs).toMatchObject({ aktif: true, namaBerkas: "@ 0b - PJS.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", otomatisUnggah: false, pakaiCap: true, penandatangan: "panitera" });
  });
  it("PPP cukup dinyalakan dari pengaturan (tanpa kode); aktif tanpa nama blangko DITOLAK; angka di luar batas DITOLAK; mati = otomatis mati", () => {
    expect(bersihkanAturPenetapan("ppp", { aktif: true, namaBerkas: "@ 3 - PPP.rtf", otomatisUnggah: true })).toMatchObject({ aktif: true, namaBerkas: "@ 3 - PPP.rtf", otomatisUnggah: true });
    // Q3 16 Okt: PPP/PJS kini berbawaan blangko gabungan "@ 0"; menyalakan dengan nama KOSONG tetap ditolak.
    expect(() => bersihkanAturPenetapan("pjs", { aktif: true, namaBerkas: "" })).toThrow(GalatPetaPenetapan);
    expect(() => bersihkanAturPenetapan("pmh", { lebarCapMm: 500 })).toThrow(/Lebar cap/);
    expect(() => bersihkanAturPenetapan("pmh", { namaBerkas: "../x/@ 1 - PMH.rtf" })).toThrow(/garis miring/);
    expect(bersihkanAturPenetapan("pmh", { aktif: false, otomatisUnggah: true })).toMatchObject({ aktif: false, otomatisUnggah: false });
    // Spasi di dalam nama blangko tidak dirapikan - ABT membedakannya.
    expect(bersihkanAturPenetapan("pmh", { namaBerkas: "@ 1 -  PMH.rtf" }).namaBerkas).toBe("@ 1 -  PMH.rtf");
    expect(Object.keys(aturUntukBot(BAWAAN_PETA_PENETAPAN.pmh))).not.toContain("namaBerkas");
  });
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

type Kiriman = { url: string; badan: any };
let kiriman: Kiriman[] = [];
function tiruBot(jawab: (badan: any) => unknown) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    return new Response(JSON.stringify(jawab(badan)), { status: 200, headers: { "content-type": "application/json" } });
  });
}
async function rute(modul: string, cara: "GET" | "POST" | "PUT", badan?: unknown) {
  const r = (await import(`@/app/api/aleta-ecourt/${modul}/route`)) as Record<string, (q: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/x", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" } : { "x-forwarded-for": "10.0.0.9" },
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const j = await r[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}

describe("C. peta penetapan - rute dan penyimpanan", () => {
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

  it("GET semua pegawai: bawaan PMH/PHS; non-admin TIDAK boleh mengubah (403), admin boleh; tercatat di audit", async () => {
    aktor = "usr-hakim";
    const baca = await rute("penetapan-edoc/peta-penetapan", "GET");
    expect(baca.status).toBe(200);
    expect(baca.isi.data.bolehMengubah).toBe(false);
    const per = Object.fromEntries(baca.isi.data.butir.map((b: any) => [b.jenis, b]));
    expect(per.pmh).toMatchObject({ namaBerkas: "@ 1 - PMH.rtf", sumber: "bawaan", tempatUnggah: { tabel: "perkara_dokumen_penetapan", jenisDokumenId: 1 } });
    expect(per.phs).toMatchObject({ namaBerkas: "@ 2 - PHS.rtf", tempatUnggah: { jenisDokumenId: 4 } });

    const tolak = await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "ppp", aktif: true, namaBerkas: "@ 3 - PPP.rtf" }] });
    expect(tolak.status).toBe(403);

    aktor = "usr-admin";
    const ubah = await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "ppp", aktif: true, namaBerkas: "@ 3 - PPP.rtf", otomatisUnggah: true, lebarCapMm: 30 }] });
    expect(ubah.status).toBe(200);
    const ppp = ubah.isi.data.butir.find((b: any) => b.jenis === "ppp");
    expect(ppp).toMatchObject({ aktif: true, namaBerkas: "@ 3 - PPP.rtf", otomatisUnggah: true, lebarCapMm: 30, sumber: "admin" });
    const audit = await db!.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action = 'UPDATE_PETA_PENETAPAN'");
    expect(audit).toHaveLength(1);

    // Baris peta TIDAK bocor ke pemetaan relaas (tabel yang sama, kunci penetapan|).
    const { bacaPemetaanBlangko } = await import("@/server/modules/aleta-ecourt/pemetaan-blangko");
    for (const jenis of ["relaas", "bas"]) {
      const relaas = await bacaPemetaanBlangko(db!, jenis);
      expect(JSON.stringify(relaas.butir)).not.toMatch(/penetapan|@ 3 - PPP/);
    }
    const mentah = await db!.queryAll<{ jenis: string; kunci: string }>("SELECT jenis, kunci FROM aleta_pemetaan_blangko");
    expect(mentah).toEqual([{ jenis: "relaas", kunci: "penetapan|ppp" }]);

    const salah = await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "pjs", aktif: true, namaBerkas: "" }] });
    expect(salah.status).toBe(400);

    const balik = await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "ppp", kembalikanBawaan: true }] });
    // Q3 16 Okt: bawaan PPP = bagian dari blangko gabungan "@ 0 - PMH - PHS"; I9 17 Okt: berkas tunggal "@ 0a - PPP" dengan cadangan gabungan (aktif, tanpa unggah otomatis).
    expect(balik.isi.data.butir.find((b: any) => b.jenis === "ppp")).toMatchObject({ aktif: true, namaBerkas: "@ 0a - PPP.rtf", namaBerkasCadangan: "@ 0 - PMH - PHS.rtf", otomatisUnggah: false, sumber: "bawaan" });
  });

  it("unggah OTOMATIS: jenis yang unggah otomatisnya MATI tidak pernah sampai ke bot; yang menyala dikirim beserta pengaturan + cap hanya bila pakaiCap", async () => {
    aktor = "usr-admin";
    await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "phs", otomatisUnggah: false }] });
    aktor = "usr-super";
    await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "Cap Ketua", peruntukan: "ketua", isiBase64: CAP_PNG.toString("base64") });
    await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "Cap Umum", peruntukan: "umum", isiBase64: CAP_PNG.toString("base64") });

    tiruBot(() => ({ ok: true, hasil: [] }));
    const rtfB64 = Buffer.from("{\\rtf1 x}").toString("base64");
    const mati = await rute("penetapan-edoc/unggah", "POST", {
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      perkaraId: "901",
      abt: [{ jenis: "phs", isiBase64: rtfB64, berkas: "@ 2 - PHS.rtf" }],
      otomatis: true,
      konfirmasi: true,
      kering: false,
      olehUsername: "ptsp1",
    });
    expect(mati.isi.data).toMatchObject({ ok: false, alasan: "otomatis_unggah_mati" });
    expect(kiriman).toEqual([]);

    tiruBot(() => ({ ok: true, hasil: [{ jenis: "pmh", sumber: "abt", ok: true, tandaTangan: { id: 1, namaPejabat: "Ketua Contoh", sumber: "nama_lengkap" }, peringatan: [] }] }));
    const hidup = await rute("penetapan-edoc/unggah", "POST", {
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      perkaraId: "901",
      abt: [
        { jenis: "pmh", isiBase64: rtfB64, berkas: "@ 1 - PMH.rtf" },
        { jenis: "phs", isiBase64: rtfB64, berkas: "@ 2 - PHS.rtf" },
      ],
      otomatis: true,
      konfirmasi: true,
      kering: false,
      olehUsername: "ptsp1",
    });
    expect(kiriman).toHaveLength(1);
    const badan = kiriman[0].badan;
    expect(badan.abt.map((x: any) => x.jenis)).toEqual(["pmh"]);
    expect(badan.atur.pmh).toMatchObject({ pakaiTtd: true, pakaiCap: true, penandatangan: "ketua" });
    expect(badan.cap.pmh).toMatchObject({ nama: "Cap Ketua" });
    expect(badan.kering).toBe(false);
    expect(badan.olehUsername).toBe("ptsp1");
    expect(hidup.isi.data.berkas).toEqual([
      { jenis: "PMH", ok: true, sebab: "", peringatan: [], tandaTangan: "Ketua Contoh" },
      { jenis: "PHS", ok: false, sebab: expect.stringMatching(/dimatikan/), peringatan: [], tandaTangan: "" },
    ]);
  });

  it("unggah TANPA konfirmasi = KERING (bawaan); PHS tidak membawa cap (pakaiCap mati)", async () => {
    await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "Cap Umum", peruntukan: "umum", isiBase64: CAP_PNG.toString("base64") });
    tiruBot(() => ({ ok: true, kering: true, hasil: [{ jenis: "phs", sumber: "abt", ok: true, kering: true, peringatan: [{ kode: "tanda_tangan_tidak_ada_untuk_nama", nama: "X" }] }] }));
    const h = await rute("penetapan-edoc/unggah", "POST", {
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      abt: [{ jenis: "phs", isiBase64: Buffer.from("{\\rtf1 x}").toString("base64") }],
    });
    expect(kiriman[0].badan.kering).toBe(true);
    expect(kiriman[0].badan.cap.phs).toBeUndefined();
    expect(h.isi.data.berkas[0].peringatan[0]).toMatch(/TANPA tanda tangan.*\(X\)/);
  });

  it("cap: foto (JPG berlatar kertas) + buangLatar -> disimpan PNG transparan; WEBP tanpa buangLatar ditolak", async () => {
    const foto = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 236, g: 231, b: 220 } } })
      .composite([{ input: await sharp({ create: { width: 120, height: 120, channels: 3, background: { r: 110, g: 60, b: 180 } } }).png().toBuffer(), left: 90, top: 90 }])
      .jpeg({ quality: 90 })
      .toBuffer();
    const t = await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "Cap foto", peruntukan: "ketua", isiBase64: foto.toString("base64"), buangLatar: true });
    expect(t.isi.data).toMatchObject({ ok: true });
    const baris = (await db!.queryAll<{ jenis_berkas: string; isi_base64: string }>("SELECT jenis_berkas, isi_base64 FROM aleta_ecourt_cap"))[0];
    expect(baris.jenis_berkas).toBe("png");
    const meta = await sharp(Buffer.from(baris.isi_base64, "base64")).metadata();
    expect(meta.hasAlpha).toBe(true);
    // Kertas dipotong: tinggal kotak tinta (+ sedikit ruang).
    expect(meta.width).toBeLessThan(140);
    const webp = await sharp({ create: { width: 60, height: 60, channels: 4, background: { r: 1, g: 1, b: 1, alpha: 1 } } }).webp().toBuffer();
    const tolak = await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "w", peruntukan: "ketua", isiBase64: Buffer.concat([webp, Buffer.alloc(2000)]).toString("base64") });
    expect(tolak.isi.data).toMatchObject({ ok: false, alasan: "gambar_cap_bukan_png_jpg" });
  });
});

// ===========================================================================
// D. CAP BERLATAR TRANSPARAN - inti piksel
// ===========================================================================
describe("D. olahPikselCap", () => {
  const gambar = (w: number, h: number, isi: (x: number, y: number) => [number, number, number, number]) => {
    const d = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(isi(x, y), (y * w + x) * 4);
    return d;
  };
  it("kertas krem -> alfa 0; tinta ungu -> alfa tinggi, warnanya dipulihkan; bintik kecil terpisah dibuang", () => {
    const w = 200;
    const h = 200;
    const d = gambar(w, h, (x, y) => {
      if (x >= 60 && x < 140 && y >= 60 && y < 140) return [110, 60, 180, 255];
      if (x >= 10 && x < 12 && y >= 10 && y < 12) return [110, 60, 180, 255]; // bintik
      return [236, 231, 220, 255];
    });
    const r = olahPikselCap(d, w, h);
    const a = (x: number, y: number) => d[(y * w + x) * 4 + 3];
    expect(r.latar).toEqual([236, 231, 220]);
    expect(r.sudahBening).toBe(false);
    expect(a(0, 0)).toBe(0);
    expect(a(100, 100)).toBeGreaterThan(200);
    expect(a(10, 10)).toBe(0);
    expect(r.bintikDibuang).toBeGreaterThanOrEqual(1);
    expect(r.kotak).toEqual({ kiri: 60, atas: 60, lebar: 80, tinggi: 80 });
  });
  it("gambar yang pinggirannya SUDAH bening (cap dari pengguna): alfa asli dipakai, tinta di tepi tidak dihapus", () => {
    const w = 100;
    const h = 100;
    const d = gambar(w, h, (x, y) => (Math.hypot(x - 50, y - 50) < 48 && Math.hypot(x - 50, y - 50) > 40 ? [110, 60, 180, 230] : [0, 0, 0, 0]));
    const r = olahPikselCap(d, w, h);
    expect(r.sudahBening).toBe(true);
    expect(d[(50 * w + 5) * 4 + 3]).toBeGreaterThan(150);
    expect(d[(50 * w + 50) * 4 + 3]).toBe(0);
  });
});

// ===========================================================================
// E. EKSTENSI
// ===========================================================================
const AKAR_EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const KONTEN = () => readFileSync(path.join(AKAR_EKSTENSI, "konten.js"), "utf8");

describe("E. latar.js relaas-rtf: SATU blangko ABT, jalan yang sama dengan cetak relaas", () => {
  const PTSP = "GRPptsp~33.c-";
  const pelayan = (dasar: Pelayan): Pelayan => (p) => {
    const u = new URL(p.alamat);
    if (u.pathname === "/aps_badilag/abt/main/beranda" && !u.searchParams.get("a")) {
      return jawaban(
        200,
        `<div id="navbar">` +
          `<a href="/aps_badilag/abt/main/beranda?a=GRPpmh~11.a-&c=">PMH &amp; PHT</a>` +
          `<a href="/aps_badilag/abt/main/beranda?a=GRPrelaas~22.b-&c=">Relaas dan PBT</a>` +
          `<a href="/aps_badilag/abt/main/beranda?a=${PTSP}&c=">Form Bantu PTSP</a></div>`,
        p.alamat
      );
    }
    if (u.pathname === "/aps_badilag/abt/main/beranda" && u.searchParams.get("a") === PTSP) {
      return jawaban(
        200,
        `<div class="pricing-top"><h3>Form Bantu PTSP</h3></div><div class="pricing-bottom-bottom">` +
          `<p><a href='#' onclick='post("/aps_badilag/abt/main/cari", {a:"PDIR~p.", b:"PBRK~q.", c:""});'># <span>@ 1 - PMH</span></a></p>` +
          `<p><a href='#' onclick='post("/aps_badilag/abt/main/cari", {a:"PDIR~p.", b:"PBRK2~q.", c:""});'># <span>@ 2 - PHS</span></a></p></div>`,
        p.alamat
      );
    }
    return dasar(p);
  };
  const PENGIRIM_SIPP = { url: `${ASAL}/SIPP/perkara_detil_agama/x`, origin: ASAL };
  const pesan = (lain: Record<string, unknown> = {}) => ({
    jenis: "relaas-rtf",
    asal: ASAL,
    asalAbt: `${ASAL}/aps_badilag`,
    perkaraId: "10126",
    berkas: "@ 1 - PMH.rtf",
    utamakan: "Form Bantu PTSP",
    ...lain,
  });

  it("memulangkan RTF hasil CETAK ABT untuk perkara itu; kelompok 'Form Bantu PTSP' dibuka PERTAMA; tidak ada unduhan", async () => {
    const dunia = new Dunia(pelayan(abtPalsu()));
    const pekerja = nyalakan(dunia);
    const j = await minta(dunia, pekerja, pesan(), PENGIRIM_SIPP);
    expect(j.ok).toBe(true);
    expect(Buffer.from(j.rtfBase64, "base64").toString("latin1")).toBe("{\\rtf1\\ansi perkara 10126 sidang }");
    const kelompok = dunia.permintaan.filter((p) => /main\/beranda\?a=/.test(p.alamat)).map((p) => new URL(p.alamat).searchParams.get("a"));
    expect(kelompok[0]).toBe(PTSP);
    expect(dunia.permintaan.some((p) => p.alamat.includes("/abt/main/cari") && p.metode === "POST")).toBe(true);
    expect(dunia.unduhan).toEqual([]);
  });

  it("pesan dari asal lain / nama blangko berjalur / perkara tak sah ditolak SEBELUM ABT disentuh", async () => {
    const dunia = new Dunia(pelayan(abtPalsu()));
    const pekerja = nyalakan(dunia);
    expect((await minta(dunia, pekerja, pesan(), { url: "http://jahat.contoh/x", origin: "http://jahat.contoh" })).ok).toBe(false);
    expect((await minta(dunia, pekerja, pesan({ berkas: "../@ 1 - PMH.rtf" }), PENGIRIM_SIPP)).ok).toBe(false);
    expect((await minta(dunia, pekerja, pesan({ perkaraId: "0" }), PENGIRIM_SIPP)).ok).toBe(false);
    expect(dunia.permintaan).toEqual([]);
  });

  it("sesi ABT habis: perluMasuk, tanpa RTF", async () => {
    const dunia = new Dunia(pelayan(abtPalsu({ masuk: () => false })));
    const pekerja = nyalakan(dunia);
    const j = await minta(dunia, pekerja, pesan(), PENGIRIM_SIPP);
    expect(j).toMatchObject({ ok: false, perluMasuk: true });
    expect(j.rtfBase64).toBeUndefined();
  });

  it("tanpa 'utamakan' urutan kelompok relaas TIDAK berubah", () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    const urut = (d: unknown, u?: string) => (pekerja.konteks.relaasUrutkanKelompok(d, u) as Array<{ kelompok: string }>).map((k) => k.kelompok);
    const daftar = [{ kelompok: "Form Bantu PTSP" }, { kelompok: "Relaas Panggilan" }, { kelompok: "Relaas dan PBT" }];
    expect(urut(daftar)).toEqual(["Relaas dan PBT", "Relaas Panggilan", "Form Bantu PTSP"]);
    expect(urut(daftar, "Form Bantu PTSP")[0]).toBe("Form Bantu PTSP");
    expect(urut([{ kelompok: "Relaas dan PBT" }, { kelompok: "Form PTSP" }], "Form Bantu PTSP")[0]).toBe("Form PTSP");
  });
});

describe("E. konten.js blok 6 Okt: tanpa jalur tulis baru, otomatis hanya sesudah penetapan SUNGGUH tertulis", () => {
  const konten = KONTEN();
  const awal = konten.indexOf("PERBAIKAN 6 OKTOBER 2026 - EDOC PENETAPAN DARI BLANGKO ABT");
  // Blok 6 Okt berakhir di blok berlabel berikutnya ("/* === ... === */", mis. KONTAK-EC 11 Okt yang
  // memang mengisi blangko pihak SIPP) - penjaga ini hanya untuk blok edoc penetapan.
  const akhir = awal >= 0 ? konten.indexOf("/* === ", awal) : -1;
  const blok = awal >= 0 ? konten.slice(awal, akhir > awal ? akhir : undefined) : "";

  it("tidak ada method/postMessage/pesan jembatan/sentuhan borang SIPP; tulisan hanya lewat s2KirimEdoc (rute unggah edoc yang sudah ada)", () => {
    expect(blok.length).toBeGreaterThan(3000);
    expect(blok).not.toMatch(/method:\s*"/);
    expect(blok).not.toMatch(/postMessage\(|kirimKeJembatan/);
    expect(blok).not.toMatch(/document\.querySelector/);
    expect(blok).toContain("s2KirimEdoc(JSON.stringify(badan)");
    expect(blok).toContain('jenis: "relaas-rtf"');
    // Mode latihan/kering/coba menahan tulisan.
    expect(blok).toMatch(/if \(!kering\) \{\s*const ditahan = s2ModeMenahan\(S2_API_EDOC_UNGGAH\)/);
    // Kering disebut tegas; otomatis ikut terkirim (penjaga rute).
    expect(blok).toMatch(/konfirmasi: !kering,\s*kering,/);
    expect(blok).toContain("otomatis: Boolean(p.otomatis)");
  });

  it("tetapkanLewatAleta memanggil edoc HANYA bila tidak kering; e6 hanya UI Baru dan hanya jenis yang ok", () => {
    const i = konten.indexOf("async function tetapkanLewatAletaInti(");
    const fungsi = konten.slice(i, konten.indexOf("\n}\n", i));
    // 20 Okt: panel Penetapan Otomatis mengunggah e-Doc sendiri (opsi tanpaEdocOtomatis); jalur lain tetap otomatis sesudah tertulis.
    expect(fungsi).toMatch(/if \(!kering && !opsi\.tanpaEdocOtomatis && typeof e6SesudahPenetapanTertulis === "function"\)/);
    expect(blok).toMatch(/if \(typeof s1Aktif !== "function" \|\| !s1Aktif\(\)\) return null;/);
    expect(blok).toMatch(/filter\(\(x\) => x && x\.ok === true\)/);
  });

  it("e6JenisDipakai: aktif + bernama blangko (+ unggah otomatis bila otomatis)", () => {
    const fn = new Function(`${blok.slice(blok.indexOf("function e6JenisDipakai"), blok.indexOf("/** perkara_id"))}; return e6JenisDipakai;`)() as (
      b: unknown[],
      j: string[],
      o: boolean
    ) => Array<{ jenis: string }>;
    const butir = [
      { jenis: "pmh", aktif: true, namaBerkas: "@ 1 - PMH.rtf", otomatisUnggah: true },
      { jenis: "phs", aktif: true, namaBerkas: "@ 2 - PHS.rtf", otomatisUnggah: false },
      { jenis: "ppp", aktif: false, namaBerkas: "", otomatisUnggah: false },
    ];
    expect(fn(butir, ["pmh", "phs", "ppp"], true).map((x) => x.jenis)).toEqual(["pmh"]);
    expect(fn(butir, ["pmh", "phs", "ppp"], false).map((x) => x.jenis)).toEqual(["pmh", "phs"]);
  });
});
