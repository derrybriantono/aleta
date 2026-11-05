import { alineaDariRtf, type HasilBandingAlinea } from "@/lib/aleta-abt-naskah";
import {
  JAWABAN_SAH,
  bandingRingkasan,
  jenisDariFolder,
  jenisDariNama,
  naskahDariFolder,
  ringkasAlinea,
  ringkasBerdampingan,
  type Bagian,
  type BarisBerdampingan,
  type HasilBerdampingan,
  type JawabanBeda,
  type JenisNaskahBanding,
  type JenisPerkaraBanding,
  type RingkasanBerdampingan,
} from "@/lib/aleta-abt-berdampingan";
import type { AletaDatabase } from "@/server/db/client";
import { susunNaskah, type NaskahDitolak, type NaskahJadi } from "@/server/modules/aleta-abt-cetak/naskah";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * BERDAMPINGAN DENGAN ABT - LAYANAN (5 Nov 2026, Tahap 7)
 * ============================================================================
 *
 * Saat cetak ABT terdeteksi lewat jalur yang sudah ada (POST /aleta-ecourt/cetak-terakhir, dikirim ekstensi sesudah cetak berhasil),
 * naskah yang sama disusun di belakang oleh jalur ALETA ABT dan dibandingkan dengan ringkasan cetakan itu. Hasilnya dicatat sebagai ANGKA.
 *
 *   - BAWAAN MATI. Dinyalakan Super Admin (saklar di aleta_ekstensi_setelan). ALETA_ABT_BERDAMPINGAN=0 mematikan apa pun isi saklarnya.
 *   - TIDAK MEMPERLAMBAT CETAK PETUGAS: pemicu tidak ditunggu (rute tidak menunggu janji ini), satu pekerjaan sekali jalan, antrean
 *     pendek (yang berlebih dibuang, bukan ditumpuk), pekerjaan yang sama tidak berganda.
 *   - TIDAK MENGUBAH HASIL CETAK ABT: hanya membaca ringkasan yang sudah ada dan menyusun naskah di ALETA; tidak menulis ke ABT/SIPP.
 *   - HANYA MENYIMPAN angka, nama blangko, kelompok jenis perkara, dan jenis beda (hitungan dan nomor alinea). Bukan isi naskah, bukan kalimat,
 *     bukan nama pihak. Yang dikirim ekstensi (potongan paragraf 160 huruf) dipakai membandingkan lalu dibuang.
 *   - Yang belum dapat dibandingkan dicatat "belum diukur" beserta sebabnya, bukan dihitung lulus atau gagal:
 *     BAS tanpa nomor sidang (ekstensi belum mengirimnya), blangko yang tidak ada di pustaka atau bernama ganda, jenis naskah selain
 *     putusan dan BAS, atau naskah yang tidak dapat disusun.
 */

export const KUNCI_SETELAN_BERDAMPINGAN = "aleta_abt_berdampingan_setelan";
const MASA_SIMPAN_HARI = 120;
const BATAS_ANTREAN = 8;

export type SetelanBerdampingan = { aktif: boolean; diubahOleh: string; diubahPada: string };

export async function bacaSetelanBerdampingan(db: AletaDatabase, env: Record<string, string | undefined> = process.env): Promise<SetelanBerdampingan> {
  const t = await bacaKunci<Partial<SetelanBerdampingan>>(db, KUNCI_SETELAN_BERDAMPINGAN).catch(() => null);
  const mati = env.ALETA_ABT_BERDAMPINGAN === "0";
  return { aktif: !mati && t?.aktif === true, diubahOleh: String(t?.diubahOleh ?? ""), diubahPada: String(t?.diubahPada ?? "") };
}

export async function simpanSetelanBerdampingan(db: AletaDatabase, aktor: { id: string; name: string }, aktif: boolean): Promise<SetelanBerdampingan> {
  const baru = { aktif, diubahOleh: aktor.name || aktor.id, diubahPada: new Date().toISOString() };
  await tulisKunci(db, KUNCI_SETELAN_BERDAMPINGAN, baru);
  return baru;
}

// ---------------------------------------------------------------------------------------------------------------
// Penyimpanan hasil (angka saja)
// ---------------------------------------------------------------------------------------------------------------

export type CatatanBanding = {
  pemicu: "cetak-abt" | "pembanding";
  berkasNama: string;
  folder: string;
  jenisPerkara: JenisPerkaraBanding;
  jenisNaskah: JenisNaskahBanding;
  perkaraId: string;
  sidangKe: number;
  hasil: "hijau" | "kuning" | "merah" | "belum-diukur";
  sebabBelum: string;
  total: number;
  identik: number;
  dijelaskan: number;
  belumDijelaskan: number;
  perKelas: Record<string, number>;
  nomor: Array<{ kelas: string; abt: number; aleta: number }>;
  waktuMs: number;
};

const kunciNama = (nama: string) => String(nama ?? "").replace(/\s+/g, " ").trim().replace(/\.rtf$/i, "").toLowerCase();

export async function simpanBanding(db: AletaDatabase, c: CatatanBanding, sekarang: Date = new Date()): Promise<string> {
  const waktu = sekarang.toISOString();
  const id = `bdp-${sekarang.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.run(
    `INSERT INTO aleta_abt_berdampingan (id, waktu, pemicu, berkas_nama, folder, jenis_perkara, jenis_naskah, perkara_id, sidang_ke, hasil, sebab_belum,
       total_alinea, identik, dijelaskan_n, belum_dijelaskan_n, per_kelas, nomor_beda, waktu_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      waktu,
      c.pemicu,
      c.berkasNama.slice(0, 200),
      c.folder.slice(0, 200),
      c.jenisPerkara,
      c.jenisNaskah,
      c.perkaraId.slice(0, 12),
      c.sidangKe,
      c.hasil,
      c.sebabBelum.slice(0, 60),
      c.total,
      c.identik,
      c.dijelaskan,
      c.belumDijelaskan,
      JSON.stringify(c.perKelas),
      JSON.stringify(c.nomor.slice(0, 50)),
      Math.max(0, Math.trunc(c.waktuMs)),
    ]
  );
  const batas = new Date(sekarang.getTime() - MASA_SIMPAN_HARI * 86_400_000).toISOString();
  await db.run("DELETE FROM aleta_abt_berdampingan WHERE waktu < ?", [batas]);
  return id;
}

type BarisDb = {
  id: string;
  waktu: string;
  pemicu: string;
  berkas_nama: string;
  folder: string;
  jenis_perkara: string;
  jenis_naskah: string;
  perkara_id: string;
  sidang_ke: number | string;
  hasil: string;
  sebab_belum: string;
  total_alinea: number | string;
  identik: number | string;
  dijelaskan_n: number | string;
  belum_dijelaskan_n: number | string;
  per_kelas: string;
  nomor_beda: string;
  waktu_ms: number | string;
  jawaban: string;
  dijawab_oleh: string;
  dijawab_at: string;
};

const JENIS_PERKARA: readonly JenisPerkaraBanding[] = ["cerai-gugat", "cerai-talak", "lain", "tidak-diketahui"];
const JENIS_NASKAH: readonly JenisNaskahBanding[] = ["putusan", "bas", "relaas", "lain"];
const HASIL: readonly BarisBerdampingan["hasil"][] = ["hijau", "kuning", "merah", "belum-diukur"];

function keBaris(b: BarisDb): BarisBerdampingan {
  return {
    id: String(b.id),
    waktu: String(b.waktu),
    pemicu: String(b.pemicu),
    berkasNama: String(b.berkas_nama),
    jenisPerkara: JENIS_PERKARA.includes(b.jenis_perkara as JenisPerkaraBanding) ? (b.jenis_perkara as JenisPerkaraBanding) : "tidak-diketahui",
    jenisNaskah: JENIS_NASKAH.includes(b.jenis_naskah as JenisNaskahBanding) ? (b.jenis_naskah as JenisNaskahBanding) : "lain",
    perkaraId: String(b.perkara_id),
    hasil: HASIL.includes(b.hasil as BarisBerdampingan["hasil"]) ? (b.hasil as BarisBerdampingan["hasil"]) : "belum-diukur",
    sebabBelum: String(b.sebab_belum ?? ""),
    totalAlinea: Number(b.total_alinea) || 0,
    identik: Number(b.identik) || 0,
    dijelaskanN: Number(b.dijelaskan_n) || 0,
    belumDijelaskanN: Number(b.belum_dijelaskan_n) || 0,
    jawaban: JAWABAN_SAH.includes(b.jawaban as JawabanBeda) ? (b.jawaban as JawabanBeda) : "",
  };
}

export async function bacaBarisBerdampingan(db: AletaDatabase, hari = MASA_SIMPAN_HARI): Promise<BarisBerdampingan[]> {
  const sejak = new Date(Date.now() - hari * 86_400_000).toISOString();
  const baris = await db.queryAll<BarisDb>("SELECT * FROM aleta_abt_berdampingan WHERE waktu >= ? ORDER BY waktu DESC LIMIT 5000", [sejak]);
  return baris.map(keBaris);
}

export type BedaTerbaru = {
  id: string;
  waktu: string;
  berkasNama: string;
  jenisPerkara: JenisPerkaraBanding;
  jenisNaskah: JenisNaskahBanding;
  perkaraId: string;
  hasil: "kuning" | "merah";
  jawaban: JawabanBeda;
  total: number;
  identik: number;
  dijelaskan: number;
  belumDijelaskan: number;
  perKelas: Record<string, number>;
  nomor: Array<{ kelas: string; abt: number; aleta: number }>;
};

function urai<T>(teks: string, bawaan: T): T {
  try {
    return JSON.parse(String(teks)) as T;
  } catch {
    return bawaan;
  }
}

export async function bacaBedaTerbaru(db: AletaDatabase, hari = 14, batas = 60): Promise<BedaTerbaru[]> {
  const sejak = new Date(Date.now() - hari * 86_400_000).toISOString();
  const baris = await db.queryAll<BarisDb>("SELECT * FROM aleta_abt_berdampingan WHERE waktu >= ? AND hasil IN ('merah', 'kuning') ORDER BY waktu DESC LIMIT ?", [sejak, batas]);
  return baris.map((b) => ({
    id: String(b.id),
    waktu: String(b.waktu),
    berkasNama: String(b.berkas_nama),
    jenisPerkara: keBaris(b).jenisPerkara,
    jenisNaskah: keBaris(b).jenisNaskah,
    perkaraId: String(b.perkara_id),
    hasil: b.hasil === "merah" ? ("merah" as const) : ("kuning" as const),
    jawaban: keBaris(b).jawaban,
    total: Number(b.total_alinea) || 0,
    identik: Number(b.identik) || 0,
    dijelaskan: Number(b.dijelaskan_n) || 0,
    belumDijelaskan: Number(b.belum_dijelaskan_n) || 0,
    perKelas: urai<Record<string, number>>(b.per_kelas, {}),
    nomor: urai<Array<{ kelas: string; abt: number; aleta: number }>>(b.nomor_beda, []),
  }));
}

export async function bacaRingkasanBerdampingan(db: AletaDatabase, kini: Date = new Date()): Promise<{ ringkasan: RingkasanBerdampingan; beda: BedaTerbaru[]; setelan: SetelanBerdampingan }> {
  const [baris, beda, setelan] = await Promise.all([bacaBarisBerdampingan(db), bacaBedaTerbaru(db), bacaSetelanBerdampingan(db)]);
  return { ringkasan: ringkasBerdampingan(baris, kini), beda, setelan };
}

/** Pemilik menjawab satu beda merah: dijelaskan, sudah dibetulkan, atau pembandingnya yang keliru. Hanya pilihan baku, tanpa teks bebas. */
export async function jawabBeda(db: AletaDatabase, aktor: { id: string; name: string }, id: string, jawaban: string): Promise<{ id: string; jawaban: JawabanBeda }> {
  if (!(JAWABAN_SAH as readonly string[]).includes(jawaban)) throw new ApiError(400, "Pilih dijelaskan, sudah dibetulkan, atau pembandingnya yang keliru.");
  const b = await db.queryOne<{ hasil: string }>("SELECT hasil FROM aleta_abt_berdampingan WHERE id = ?", [id]);
  if (!b) throw new ApiError(404, "Hasil banding tidak ditemukan.");
  if (b.hasil !== "merah") throw new ApiError(422, "Hanya beda merah yang perlu dijawab.");
  await db.run("UPDATE aleta_abt_berdampingan SET jawaban = ?, dijawab_oleh = ?, dijawab_at = ? WHERE id = ?", [jawaban, (aktor.name || aktor.id).slice(0, 120), new Date().toISOString(), id]);
  return { id, jawaban: jawaban as JawabanBeda };
}

// ---------------------------------------------------------------------------------------------------------------
// Banding
// ---------------------------------------------------------------------------------------------------------------

/** Mengubah hasil banding alinea layar cetak (RTF dari ABT) menjadi catatan angka. Tidak membawa kalimat. */
export function catatanDariBandingAlinea(h: HasilBandingAlinea, dasar: Pick<CatatanBanding, "berkasNama" | "folder" | "jenisPerkara" | "jenisNaskah" | "perkaraId" | "sidangKe" | "waktuMs">): CatatanBanding {
  const belum = Math.max(0, h.total - h.identik - h.dijelaskan);
  return {
    ...dasar,
    pemicu: "pembanding",
    hasil: belum > 0 ? "merah" : h.dijelaskan > 0 ? "kuning" : "hijau",
    sebabBelum: "",
    total: h.total,
    identik: h.identik,
    dijelaskan: h.dijelaskan,
    belumDijelaskan: belum,
    perKelas: { ...h.perKelas },
    nomor: h.beda.slice(0, 50).map((b) => ({ kelas: b.kelas, abt: b.nomorAbt, aleta: b.nomorAleta })),
  };
}

/**
 * Pembandingan MANUAL dari layar cetak (RTF cetakan ABT yang diunggah): hasilnya dicatat sebagai angka dengan pemicu "pembanding".
 * Dipicu langsung oleh Super Admin, jadi tidak bergantung pada saklar pembandingan otomatis.
 */
export async function catatBandingManual(
  db: AletaDatabase,
  m: { berkasId: string; perkaraId: string; sidangKe: number; jenisPerkara?: unknown; hasil: HasilBandingAlinea; waktuMs: number }
): Promise<{ id: string; hasil: CatatanBanding["hasil"]; jenisPerkara: JenisPerkaraBanding }> {
  const b = await db.queryOne<{ folder: string; nama: string }>("SELECT folder, nama FROM aleta_abt_berkas WHERE id = ?", [m.berkasId]);
  if (!b) throw new ApiError(404, "Blangko tidak ditemukan di pustaka.");
  const folder = String(b.folder ?? "");
  const jenisPerkara = jenisDariNama(m.jenisPerkara) ?? jenisDariFolder(folder);
  const c = catatanDariBandingAlinea(m.hasil, {
    berkasNama: String(b.nama),
    folder,
    jenisPerkara,
    jenisNaskah: naskahDariFolder(folder),
    perkaraId: m.perkaraId,
    sidangKe: m.sidangKe,
    waktuMs: m.waktuMs,
  });
  return { id: await simpanBanding(db, c), hasil: c.hasil, jenisPerkara };
}

export type MasukanCetakAbt = {
  perkaraId: string;
  nomorPerkara: string;
  berkas: string;
  bagian: Bagian[];
  sidangKe?: number;
};

type BerkasPustaka = { id: string; folder: string; nama: string; arsip: number | string };

export type DepsBanding = {
  susun?: (db: AletaDatabase, p: { berkasId: string; perkaraId: string; sidangKe: number; cetakFinal: false }) => Promise<NaskahJadi | NaskahDitolak>;
  jenisDariBot?: (nomorPerkara: string, perkaraId: string) => Promise<string>;
  kini?: () => Date;
};

async function jenisDariBotBawaan(nomorPerkara: string, perkaraId: string): Promise<string> {
  const h = await callAletaBotSippBridge<{ ok?: boolean; perkara?: Array<{ perkaraId?: unknown; perkara_id?: unknown; jenisPerkara?: unknown; jenis_perkara?: unknown }> }>(
    "tes.cariPerkara",
    { nomorPerkara, limit: 5 },
    { timeoutMs: 20_000 }
  );
  const daftar = h.ok && h.data?.ok ? (h.data.perkara ?? []) : [];
  const cocok = daftar.find((x) => String(x.perkaraId ?? x.perkara_id ?? "") === perkaraId) ?? daftar[0];
  return String(cocok?.jenisPerkara ?? cocok?.jenis_perkara ?? "");
}

function belumDiukur(m: MasukanCetakAbt, folder: string, jenisPerkara: JenisPerkaraBanding, jenisNaskah: JenisNaskahBanding, sebab: string, mulai: number): CatatanBanding {
  return {
    pemicu: "cetak-abt",
    berkasNama: m.berkas,
    folder,
    jenisPerkara,
    jenisNaskah,
    perkaraId: m.perkaraId,
    sidangKe: Math.max(0, Math.trunc(Number(m.sidangKe) || 0)),
    hasil: "belum-diukur",
    sebabBelum: sebab,
    total: 0,
    identik: 0,
    dijelaskan: 0,
    belumDijelaskan: 0,
    perKelas: {},
    nomor: [],
    waktuMs: Date.now() - mulai,
  };
}

/**
 * Satu pembandingan: ringkasan cetakan ABT lawan naskah ALETA ABT yang disusun sekarang. Selalu mencatat satu baris (angka),
 * tidak pernah melempar ke pemanggil. Tidak memeriksa saklar; pemanggil (picuBerdampingan) yang memeriksa.
 */
export async function bandingkanCetakAbt(db: AletaDatabase, m: MasukanCetakAbt, deps: DepsBanding = {}): Promise<CatatanBanding> {
  const mulai = Date.now();
  const sidangKe = Math.max(0, Math.trunc(Number(m.sidangKe) || 0));
  const simpan = async (c: CatatanBanding) => {
    await simpanBanding(db, c, deps.kini?.());
    return c;
  };
  try {
    const kunci = kunciNama(m.berkas);
    const berkas = (await db.queryAll<BerkasPustaka>("SELECT id, folder, nama, arsip FROM aleta_abt_berkas WHERE status <> 'hilang'")).filter((b) => kunciNama(b.nama) === kunci);
    const aktif = berkas.filter((b) => Number(b.arsip) !== 1);
    const pilihan = aktif.length ? aktif : berkas;
    const folderBerkas = pilihan[0]?.folder ?? "";
    const naskahJenis = naskahDariFolder(folderBerkas);
    let jenis: JenisPerkaraBanding = jenisDariFolder(folderBerkas);
    if (!pilihan.length) return simpan(belumDiukur(m, "", "tidak-diketahui", "lain", "blangko-tidak-di-pustaka", mulai));
    if (pilihan.length > 1) return simpan(belumDiukur(m, folderBerkas, jenis, naskahJenis, "blangko-ganda", mulai));
    if (naskahJenis !== "putusan" && naskahJenis !== "bas") return simpan(belumDiukur(m, folderBerkas, jenis, naskahJenis, "jenis-naskah-belum-dibandingkan", mulai));
    if (jenis === "tidak-diketahui") {
      const nama = await (deps.jenisDariBot ?? jenisDariBotBawaan)(m.nomorPerkara, m.perkaraId).catch(() => "");
      jenis = jenisDariNama(nama) ?? "tidak-diketahui";
    }
    if (naskahJenis === "bas" && sidangKe < 1) return simpan(belumDiukur(m, folderBerkas, jenis, naskahJenis, "sidang-tidak-dikirim", mulai));

    const n = await (deps.susun ?? susunNaskah)(db, { berkasId: pilihan[0].id, perkaraId: m.perkaraId, sidangKe, cetakFinal: false });
    if (!n.ok) return simpan(belumDiukur(m, folderBerkas, jenis, naskahJenis, "naskah-tidak-tersusun", mulai));
    const aleta = ringkasAlinea(alineaDariRtf(n.rtf.toString("latin1")));
    const h: HasilBerdampingan = bandingRingkasan(m.bagian, aleta);
    return await simpan({
      pemicu: "cetak-abt",
      berkasNama: m.berkas,
      folder: folderBerkas,
      jenisPerkara: jenis,
      jenisNaskah: naskahJenis,
      perkaraId: m.perkaraId,
      sidangKe,
      hasil: h.hasil,
      sebabBelum: "",
      total: h.total,
      identik: h.identik,
      dijelaskan: h.dijelaskan,
      belumDijelaskan: h.belumDijelaskan,
      perKelas: { ...h.perKelas },
      nomor: h.nomor,
      waktuMs: Date.now() - mulai,
    });
  } catch {
    const c = belumDiukur(m, "", "tidak-diketahui", "lain", "galat-pembanding", mulai);
    await simpan(c).catch(() => undefined);
    return c;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Pemicu: antrean pendek, satu pekerjaan sekali jalan, tidak ditunggu pemanggil
// ---------------------------------------------------------------------------------------------------------------

type KeadaanAntrean = { tunggu: Array<{ kunci: string; kerja: () => Promise<unknown> }>; jalan: boolean; kunciJalan: string; selesai: Array<() => void> };
const ANTREAN: KeadaanAntrean = { tunggu: [], jalan: false, kunciJalan: "", selesai: [] };

async function putar() {
  if (ANTREAN.jalan) return;
  ANTREAN.jalan = true;
  try {
    for (let x = ANTREAN.tunggu.shift(); x; x = ANTREAN.tunggu.shift()) {
      ANTREAN.kunciJalan = x.kunci;
      try {
        await x.kerja();
      } catch {
        /* galat satu pekerjaan tidak menghentikan antrean */
      }
    }
  } finally {
    ANTREAN.jalan = false;
    ANTREAN.kunciJalan = "";
    for (const s of ANTREAN.selesai.splice(0)) s();
  }
}

/** Untuk uji: menunggu antrean kosong. */
export function tungguAntreanBerdampingan(): Promise<void> {
  return ANTREAN.jalan || ANTREAN.tunggu.length ? new Promise((r) => ANTREAN.selesai.push(r)) : Promise.resolve();
}

export type HasilPicu = "mati" | "antre" | "penuh" | "ganda" | "tak-sah";

/**
 * Dipanggil rute cetak-terakhir TANPA ditunggu (void). Bagian yang berjalan sebelum janji dikembalikan hanya membaca satu baris
 * saklar; pembandingan sebenarnya berjalan di antrean setelah jawaban cetak terkirim.
 */
export async function picuBerdampingan(db: AletaDatabase, m: MasukanCetakAbt, deps: DepsBanding & { env?: Record<string, string | undefined> } = {}): Promise<HasilPicu> {
  try {
    if (!/^\d{1,12}$/.test(String(m.perkaraId ?? "")) || !String(m.berkas ?? "").trim() || !Array.isArray(m.bagian) || !m.bagian.length) return "tak-sah";
    if (!(await bacaSetelanBerdampingan(db, deps.env)).aktif) return "mati";
    const kunci = `${m.perkaraId}|${kunciNama(m.berkas)}|${Math.trunc(Number(m.sidangKe) || 0)}`;
    if (ANTREAN.kunciJalan === kunci || ANTREAN.tunggu.some((x) => x.kunci === kunci)) return "ganda";
    if (ANTREAN.tunggu.length >= BATAS_ANTREAN) return "penuh";
    ANTREAN.tunggu.push({ kunci, kerja: () => bandingkanCetakAbt(db, m, deps) });
    // Menunda ke putaran berikutnya supaya jawaban cetak lebih dulu terkirim.
    setTimeout(() => void putar(), 0);
    return "antre";
  } catch {
    return "tak-sah";
  }
}
