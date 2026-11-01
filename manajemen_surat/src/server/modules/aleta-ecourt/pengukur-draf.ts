import { bandingDrafA1 } from "@/lib/banding-draf-a1";
import type { DrafPutusanA1 } from "@/lib/draf-putusan-a1";
import type { DrafH7, StatusVarianH7 } from "@/lib/agen-h7-putusan";
import {
  koreksiDariBanding,
  koreksiTersering,
  pisahNaskahPutusan,
  polaBerulang,
  ringkasBulanan,
  skorKecocokan,
  usulanMemori,
  type BarisUkur,
  type Koreksi,
  type SkorUkur,
} from "@/lib/pengukur-draf";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * P3 (1 Nov 2026) - PENGUKUR DRAF vs PUTUSAN AKHIR (sisi server)
 * ============================================================================
 *
 * Sesudah putusan diputus, draf A1 yang tersimpan (draf H-7, aleta_agen_h7_draf 0068) dibandingkan dengan putusan akhir:
 *   - sumber utama   amar + pertimbangan hukum SIPP (bot /jadwal-sidang/putusan-akhir, hanya SELECT, banyak perkara per panggilan);
 *   - cadangan       bila pertimbangan SIPP kosong: dokumen putusan yang diunggah (jalur berkas SIPP yang dipakai "cocok putusan"),
 *                    dipisah pertimbangan/amarnya (pisahNaskahPutusan);
 *   - varian draf    menurut hasil putusan (62 dikabulkan, 63 ditolak); hasil lain (tidak dapat diterima, dicabut, dst.) tidak diukur.
 * Aturannya murni (lib/banding-draf-a1.ts + lib/pengukur-draf.ts) - TANPA AI. Hasil per perkara di aleta_pengukur_draf (0130);
 * pola koreksi hakim yang berulang menjadi USULAN memori proyek ALETA Ai (aleta_pengukur_usulan), tersamar, menunggu Super Admin.
 *
 * PEMICU (otomatis, ringan): detak 15 menit -> (a) jam kerja, paling sering tiap 30 menit: perkara yang drafnya Hari Putusan
 * 14 hari terakhir dan belum terukur ("putusan masuk"); (b) sekali sehari sesudah 22.30 WITA: 60 hari terakhir, termasuk memeriksa
 * ulang sidik (putusan yang disunting sesudah diukur diukur ulang). Satu panggilan bot memuat sampai 40 perkara. Tidak ada
 * yang menahan permintaan pengguna; tidak ada yang ditulis ke SIPP/ABT.
 *
 * MEMORI PROYEK ALETA Ai: modul proyek-kelola ada di cabang aleta-ai-proyek (gabung-56). Di sini hanya TITIK SAMBUNG
 * (PelabuhanMemoriProyek). Setelah cabang itu digabung, satu baris memasangnya (mis. di instrumentation.ts atau rute):
 *
 *   pasangPelabuhanMemori({
 *     daftarProyek: async (db) => (await db.queryAll(`SELECT id, nama, memori_aktif FROM aleta_ai_proyek_kelola WHERE aktif = 1`)).map(...),
 *     simpanUsulan: simpanUsulanMemori,   // @/server/modules/aleta-ai/proyek-kelola
 *   });
 */

const teks = (x: unknown) => String(x ?? "").trim();

/** Naik bila aturan pengukuran berubah: semua perkara terukur ulang pada lintasan malam berikutnya. */
export const VERSI_PENGUKUR = 1;

export type PutusanBot = {
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalPutusan: string;
  statusPutusanId: number;
  verstek: boolean;
  amarPutusan: string;
  pertimbanganHukum: string;
  adaBerkas: boolean;
  hakimKetua: string;
  majelis: string[];
};

export type DepsPengukur = {
  /** Bahan putusan banyak perkara (bot). */
  bahan(ids: string[]): Promise<{ ok: true; perkara: PutusanBot[] } | { ok: false; error: string }>;
  /** Teks dokumen putusan yang diunggah (cadangan); null = tidak ada / tidak terbaca. */
  dokumen?(perkaraId: string): Promise<string | null>;
  kini?: () => Date;
};

export type StatusUkur = "diukur" | "sama" | "tanpa-draf" | "belum-putus" | "tanpa-varian" | "tanpa-naskah" | "gagal";

export type HasilUkurSatu = { perkaraId: string; status: StatusUkur; catatan?: string };

type BarisRingan = { tanggal_sidang: string; diperbarui_pada: string };

const ARAH_STATUS: Record<number, StatusVarianH7> = { 62: "dikabulkan", 63: "ditolak" };

export function varianUntukStatus(statusPutusanId: number): StatusVarianH7 | null {
  return ARAH_STATUS[statusPutusanId] ?? null;
}

function urai<T>(json: unknown, cadangan: T): T {
  try {
    return JSON.parse(String(json ?? "")) as T;
  } catch {
    return cadangan;
  }
}

/**
 * Draf paling akhir yang Hari Putusannya tidak melewati tanggal putusan dan memuat draf A1 varian yang diminta.
 * KINERJA: baris ringan (tanggal + saat dibuat) dibaca dulu; badan draf (ratusan KB) dimuat satu per satu, biasanya satu saja.
 */
async function muatDrafUntukUkur(db: AletaDatabase, perkaraId: string, ringan: BarisRingan[], varian: StatusVarianH7) {
  for (const r of ringan) {
    const b = await db.queryOne<{ draf_json: string }>(`SELECT draf_json FROM aleta_agen_h7_draf WHERE perkara_id = ? AND tanggal_sidang = ?`, [perkaraId, r.tanggal_sidang]);
    const d = urai<DrafH7 | null>(b?.draf_json, null);
    if (!d) continue;
    const putusan = varian === "dikabulkan" ? d.putusan : d.varian?.find((v) => v.status === varian)?.putusan;
    if (putusan) return { draf: d, putusan, tanggalSidang: teks(r.tanggal_sidang), dibuatPada: teks(r.diperbarui_pada) };
  }
  return null;
}

async function sidikBahan(...bagian: string[]): Promise<string> {
  const { createHash } = await import("node:crypto");
  const h = createHash("sha256");
  for (const b of bagian) h.update(b).update("\u0001");
  return h.digest("hex").slice(0, 24);
}

/** Ukur satu perkara; menulis (atau memperbarui) satu baris aleta_pengukur_draf. */
export async function ukurPerkara(db: AletaDatabase, p: PutusanBot, deps: DepsPengukur): Promise<HasilUkurSatu> {
  const perkaraId = String(p.perkaraId);
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tanggalPutusan)) return { perkaraId, status: "belum-putus" };
    const varian = varianUntukStatus(p.statusPutusanId);
    if (!varian) return { perkaraId, status: "tanpa-varian", catatan: "Hasil putusan bukan dikabulkan atau ditolak." };
    const ringan = await db.queryAll<BarisRingan>(
      `SELECT tanggal_sidang, diperbarui_pada FROM aleta_agen_h7_draf WHERE perkara_id = ? AND tanggal_sidang <= ? ORDER BY tanggal_sidang DESC LIMIT 4`,
      [perkaraId, p.tanggalPutusan]
    );
    if (!ringan.length) return { perkaraId, status: "tanpa-draf" };
    if (!teks(p.amarPutusan) && !teks(p.pertimbanganHukum) && !p.adaBerkas) return { perkaraId, status: "tanpa-naskah" };

    // Sidik dari bahan RINGAN saja (draf terbaru yang memenuhi syarat + putusan SIPP + ada-tidaknya dokumen): bahan sama = selesai
    // tanpa memuat badan draf ataupun membaca dokumen.
    const sidik = await sidikBahan(String(VERSI_PENGUKUR), varian, p.tanggalPutusan, p.amarPutusan, p.pertimbanganHukum, p.adaBerkas ? "berkas" : "", teks(ringan[0].tanggal_sidang), teks(ringan[0].diperbarui_pada));
    const lama = await db.queryOne<{ sidik: string }>(`SELECT sidik FROM aleta_pengukur_draf WHERE perkara_id = ?`, [perkaraId]);
    if (lama && lama.sidik === sidik) return { perkaraId, status: "sama" };

    const pilih = await muatDrafUntukUkur(db, perkaraId, ringan, varian);
    if (!pilih) return { perkaraId, status: "tanpa-draf" };

    let amarHtml = p.amarPutusan;
    let pertimbanganHtml = p.pertimbanganHukum;
    let sumber = "sipp";
    if (!teks(pertimbanganHtml) && p.adaBerkas && deps.dokumen) {
      const t = await deps.dokumen(perkaraId).catch(() => null);
      const pisah = t ? pisahNaskahPutusan(t) : null;
      if (pisah) {
        amarHtml = pisah.amarHtml;
        pertimbanganHtml = pisah.pertimbanganHtml;
        sumber = "dokumen";
      }
    }
    if (!teks(amarHtml) && !teks(pertimbanganHtml)) return { perkaraId, status: "tanpa-naskah" };

    const mulai = Date.now();
    const banding = bandingDrafA1(pilih.putusan, { amarHtml, pertimbanganHtml });
    const skor = skorKecocokan(banding);
    const koreksi = koreksiDariBanding(banding, pilih.putusan.namaSamaran ?? []);
    const hakim = teks(p.hakimKetua) || teks(pilih.draf.majelis).split(/[;\n]/)[0]?.trim() || "";
    const majelis = p.majelis.length ? p.majelis.join("; ") : teks(pilih.draf.majelis);
    const kini = (deps.kini ?? (() => new Date()))().toISOString();
    const nilai = [
      p.nomorPerkara || pilih.draf.nomorPerkara,
      p.jenisPerkara || pilih.draf.jenisPerkara,
      hakim,
      majelis,
      p.tanggalPutusan,
      p.tanggalPutusan.slice(0, 7),
      varian,
      varian,
      sumber,
      pilih.tanggalSidang,
      pilih.dibuatPada,
      sidik,
      skor.amarAkhir,
      skor.amarCocok,
      skor.amarPersis,
      skor.dasarAkhir,
      skor.dasarCocok,
      skor.dasarTerverifikasi,
      skor.bagianAkhir,
      skor.bagianCocok,
      banding.huruf.draf,
      banding.huruf.akhir,
      skor.hurufSama,
      JSON.stringify(koreksi),
      Date.now() - mulai,
      kini,
    ];
    if (lama) {
      await db.run(
        `UPDATE aleta_pengukur_draf SET nomor_perkara = ?, jenis_perkara = ?, hakim = ?, majelis = ?, tanggal_putusan = ?, bulan = ?, arah = ?, varian = ?, sumber = ?,
           tanggal_sidang_draf = ?, draf_dibuat_pada = ?, sidik = ?, amar_akhir = ?, amar_cocok = ?, amar_persis = ?, dasar_akhir = ?, dasar_cocok = ?, dasar_terverifikasi = ?,
           bagian_akhir = ?, bagian_cocok = ?, huruf_draf = ?, huruf_akhir = ?, huruf_sama = ?, koreksi_json = ?, lama_ms = ?, diukur_pada = ? WHERE perkara_id = ?`,
        [...nilai, perkaraId]
      );
    } else {
      await db.run(
        `INSERT INTO aleta_pengukur_draf (nomor_perkara, jenis_perkara, hakim, majelis, tanggal_putusan, bulan, arah, varian, sumber, tanggal_sidang_draf, draf_dibuat_pada, sidik,
           amar_akhir, amar_cocok, amar_persis, dasar_akhir, dasar_cocok, dasar_terverifikasi, bagian_akhir, bagian_cocok, huruf_draf, huruf_akhir, huruf_sama, koreksi_json, lama_ms, diukur_pada, perkara_id)
         VALUES (${nilai.map(() => "?").join(", ")}, ?)`,
        [...nilai, perkaraId]
      );
    }
    return { perkaraId, status: "diukur" };
  } catch (e) {
    return { perkaraId, status: "gagal", catatan: e instanceof Error ? e.message : String(e) };
  }
}

// ============================================================================
// LINTASAN
// ============================================================================

export type HasilLintasan = {
  pemicu: "peristiwa" | "malam" | "tangan";
  calon: number;
  diukur: number;
  sama: number;
  dilewati: number;
  gagal: number;
  galat: string;
  usulanBaru: number;
};

const UKURAN_PANGGILAN_BOT = 40;
/** Jendela Hari Putusan draf (hari ke belakang) dan banyak perkara paling banyak per lintasan. Putusan yang ditunda lama tertangkap lintasan malam. */
export const BATAS_LINTASAN = { peristiwa: { hari: 14, maks: 40 }, malam: { hari: 60, maks: 150 }, tangan: { hari: 60, maks: 150 } } as const;

function tambahHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const wadah = (): { berjalan: boolean } => {
  const g = globalThis as unknown as { __aletaPengukurDraf?: { berjalan: boolean } };
  if (!g.__aletaPengukurDraf) g.__aletaPengukurDraf = { berjalan: false };
  return g.__aletaPengukurDraf;
};

export async function jalankanPengukur(db: AletaDatabase, deps: DepsPengukur, pemicu: HasilLintasan["pemicu"] = "tangan"): Promise<HasilLintasan | null> {
  const w = wadah();
  if (w.berjalan) return null;
  w.berjalan = true;
  const hasil: HasilLintasan = { pemicu, calon: 0, diukur: 0, sama: 0, dilewati: 0, gagal: 0, galat: "", usulanBaru: 0 };
  try {
    const kini = (deps.kini ?? (() => new Date()))();
    const hariIni = waktuPengadilan(kini).tanggal;
    const { hari, maks } = BATAS_LINTASAN[pemicu];
    // Hanya kolom ringan (tanpa draf_json): perkara yang Hari Putusan drafnya jatuh di jendela.
    const baris = await db.queryAll<{ perkara_id: string }>(
      `SELECT DISTINCT perkara_id FROM aleta_agen_h7_draf WHERE tanggal_sidang >= ? AND tanggal_sidang <= ? LIMIT ${maks * 3}`,
      [tambahHari(hariIni, -hari), hariIni]
    );
    let ids = [...new Set(baris.map((b) => teks(b.perkara_id)).filter(Boolean))];
    if (pemicu === "peristiwa" && ids.length) {
      // Yang sudah terukur tidak ditanyakan lagi ke bot (pemeriksaan ulang sidik hanya di lintasan malam).
      const ada = await db.queryAll<{ perkara_id: string }>(`SELECT perkara_id FROM aleta_pengukur_draf WHERE perkara_id IN (${ids.map(() => "?").join(", ")})`, ids);
      const sudah = new Set(ada.map((a) => teks(a.perkara_id)));
      ids = ids.filter((i) => !sudah.has(i));
    }
    ids = ids.slice(0, maks);
    hasil.calon = ids.length;
    for (let i = 0; i < ids.length; i += UKURAN_PANGGILAN_BOT) {
      const bahan = await deps.bahan(ids.slice(i, i + UKURAN_PANGGILAN_BOT));
      if (!bahan.ok) {
        hasil.galat = bahan.error;
        break;
      }
      for (const p of bahan.perkara) {
        const r = await ukurPerkara(db, p, deps);
        if (r.status === "diukur") hasil.diukur += 1;
        else if (r.status === "sama") hasil.sama += 1;
        else if (r.status === "gagal") hasil.gagal += 1;
        else hasil.dilewati += 1;
      }
    }
    if (hasil.diukur) {
      hasil.usulanBaru = (await segarkanUsulan(db, kini)).baru;
      // Keputusan 119: tanpa klik tambahan - usulan langsung masuk antrean persetujuan memori proyek.
      // Gagal meneruskan tidak boleh menggagalkan pengukuran; usulan tetap tersimpan di sini.
      try {
        await teruskanOtomatis(db, kini);
      } catch {
        /* dicoba lagi pada lintasan berikutnya */
      }
    }
    return hasil;
  } finally {
    w.berjalan = false;
  }
}

// ============================================================================
// DATA UNTUK LAPORAN & USULAN
// ============================================================================

type BarisSimpan = {
  perkara_id: string;
  hakim: string;
  majelis: string;
  bulan: string;
  amar_akhir: number;
  amar_cocok: number;
  amar_persis: number;
  dasar_akhir: number;
  dasar_cocok: number;
  dasar_terverifikasi: number;
  bagian_akhir: number;
  bagian_cocok: number;
  huruf_sama: number;
  koreksi_json: string;
};

export type BarisUkurMajelis = BarisUkur & { majelis: string };

const BATAS_BARIS_LAPORAN = 3000;

export async function bacaBarisUkur(db: AletaDatabase, dariBulan = ""): Promise<BarisUkurMajelis[]> {
  const baris = await db.queryAll<BarisSimpan>(
    `SELECT perkara_id, hakim, majelis, bulan, amar_akhir, amar_cocok, amar_persis, dasar_akhir, dasar_cocok, dasar_terverifikasi, bagian_akhir, bagian_cocok, huruf_sama, koreksi_json
       FROM aleta_pengukur_draf ${dariBulan ? "WHERE bulan >= ?" : ""} ORDER BY tanggal_putusan DESC LIMIT ${BATAS_BARIS_LAPORAN}`,
    dariBulan ? [dariBulan] : []
  );
  return baris.map((b) => ({
    perkaraId: teks(b.perkara_id),
    hakim: teks(b.hakim),
    majelis: teks(b.majelis),
    bulan: teks(b.bulan),
    skor: {
      amarAkhir: Number(b.amar_akhir) || 0,
      amarCocok: Number(b.amar_cocok) || 0,
      amarPersis: Number(b.amar_persis) || 0,
      dasarAkhir: Number(b.dasar_akhir) || 0,
      dasarCocok: Number(b.dasar_cocok) || 0,
      dasarTerverifikasi: Number(b.dasar_terverifikasi) || 0,
      bagianAkhir: Number(b.bagian_akhir) || 0,
      bagianCocok: Number(b.bagian_cocok) || 0,
      hurufSama: (Number(b.huruf_sama) === 1 ? 1 : Number(b.huruf_sama) === 0 ? 0 : -1) as SkorUkur["hurufSama"],
    },
    koreksi: urai<Koreksi[]>(b.koreksi_json, []),
  }));
}

export type BarisUsulan = {
  id: string;
  lingkup: "hakim" | "semua";
  hakim: string;
  jenis: string;
  kunci: string;
  teks: string;
  perkara: number;
  dari: number;
  status: "baru" | "diteruskan" | "ditolak";
  proyekId: string;
};

/**
 * Hitung ulang usulan dari seluruh hasil ukur: yang berstatus 'diteruskan' / 'ditolak' dibiarkan (tidak diusulkan lagi),
 * yang 'baru' diperbarui angkanya, yang tak lagi memenuhi ambang dihapus, yang belum ada ditambahkan.
 */
export async function segarkanUsulan(db: AletaDatabase, kini = new Date()): Promise<{ baru: number; total: number }> {
  const baris = await bacaBarisUkur(db);
  const usulan = usulanMemori(polaBerulang(baris));
  const ada = await db.queryAll<{ id: string; status: string }>(`SELECT id, status FROM aleta_pengukur_usulan`);
  const status = new Map(ada.map((a) => [teks(a.id), teks(a.status)]));
  const saat = kini.toISOString();
  const baruId = new Set<string>();
  let baru = 0;
  for (const u of usulan) {
    baruId.add(u.id);
    const s = status.get(u.id);
    if (s === "diteruskan" || s === "ditolak") continue;
    if (s === "baru") {
      await db.run(`UPDATE aleta_pengukur_usulan SET teks = ?, perkara = ?, dari = ?, diperbarui_pada = ? WHERE id = ?`, [u.teks, u.perkara, u.dari, saat, u.id]);
    } else {
      await db.run(
        `INSERT INTO aleta_pengukur_usulan (id, lingkup, hakim, jenis, kunci, teks, perkara, dari, status, proyek_id, dibuat_pada, diperbarui_pada, diputuskan_oleh, diputuskan_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'baru', '', ?, ?, '', '')`,
        [u.id, u.lingkup, u.hakim, u.jenis, u.kunci, u.teks, u.perkara, u.dari, saat, saat]
      );
      baru += 1;
    }
  }
  for (const [id, s] of status) if (s === "baru" && !baruId.has(id)) await db.run(`DELETE FROM aleta_pengukur_usulan WHERE id = ?`, [id]);
  return { baru, total: usulan.length };
}

export async function bacaUsulan(db: AletaDatabase, filter: { hakim?: string; semuaHakim: boolean } = { semuaHakim: true }): Promise<BarisUsulan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT id, lingkup, hakim, jenis, kunci, teks, perkara, dari, status, proyek_id FROM aleta_pengukur_usulan ORDER BY CASE status WHEN 'baru' THEN 0 WHEN 'diteruskan' THEN 1 ELSE 2 END, perkara DESC LIMIT 200`
  );
  return baris
    .map((b) => ({
      id: teks(b.id),
      lingkup: (teks(b.lingkup) === "hakim" ? "hakim" : "semua") as "hakim" | "semua",
      hakim: teks(b.hakim),
      jenis: teks(b.jenis),
      kunci: teks(b.kunci),
      teks: teks(b.teks),
      perkara: Number(b.perkara) || 0,
      dari: Number(b.dari) || 0,
      status: (["baru", "diteruskan", "ditolak"].includes(teks(b.status)) ? teks(b.status) : "baru") as BarisUsulan["status"],
      proyekId: teks(b.proyek_id),
    }))
    .filter((u) => filter.semuaHakim || u.lingkup === "semua" || u.hakim === filter.hakim);
}

export type LaporanPengukur = {
  jumlahPerkara: number;
  /** Tingkat kecocokan per bulan (12 bulan terakhir) - milik pemirsa (hakim: perkara majelisnya; Super Admin: semua). */
  bulanan: ReturnType<typeof ringkasBulanan>;
  tersering: ReturnType<typeof koreksiTersering>;
  /** Khusus yang boleh melihat semua hakim. */
  perHakim: Array<{ hakim: string; perkara: number; amar: number | null; dasar: number | null; bagian: number | null }>;
  pola: ReturnType<typeof polaBerulang>;
  lingkup: "semua" | "saya";
  terakhirDiukur: string;
};

export type OpsiLaporan = {
  /** Boleh melihat semua hakim? (Super Admin, Admin, ketua, wakil ketua). Selain itu hanya perkara majelis pemirsa. */
  lihatSemua: boolean;
  /** Pencocok nama akun dengan nama hakim/majelis perkara (untuk pemirsa non-privileged). */
  milikSaya?: (hakim: string, majelis: string) => boolean;
  bulanTerakhir?: number;
  hariIni?: string;
};

export async function susunLaporan(db: AletaDatabase, opsi: OpsiLaporan): Promise<LaporanPengukur> {
  const hariIni = opsi.hariIni || waktuPengadilan().tanggal;
  const n = Math.max(1, Math.min(36, opsi.bulanTerakhir ?? 12));
  const d = new Date(`${hariIni.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - (n - 1));
  const dariBulan = d.toISOString().slice(0, 7);
  const semua = await bacaBarisUkur(db, dariBulan);
  const baris = opsi.lihatSemua ? semua : semua.filter((b) => (opsi.milikSaya ? opsi.milikSaya(b.hakim, b.majelis) : false));
  const per = new Map<string, BarisUkur[]>();
  if (opsi.lihatSemua) {
    for (const b of baris) {
      if (!b.hakim) continue;
      if (!per.has(b.hakim)) per.set(b.hakim, []);
      per.get(b.hakim)!.push(b);
    }
  }
  const terakhir = await db.queryOne<{ t: string | null }>(`SELECT MAX(diukur_pada) AS t FROM aleta_pengukur_draf`);
  return {
    jumlahPerkara: baris.length,
    bulanan: ringkasBulanan(baris),
    tersering: koreksiTersering(baris, 10),
    perHakim: [...per.entries()]
      .map(([hakim, rows]) => {
        const r = ringkasBulanan(rows.map((x) => ({ ...x, bulan: "semua" })))[0];
        return { hakim, perkara: rows.length, amar: r?.amar ?? null, dasar: r?.dasar ?? null, bagian: r?.bagian ?? null };
      })
      .sort((a, b) => b.perkara - a.perkara || a.hakim.localeCompare(b.hakim)),
    pola: polaBerulang(baris),
    lingkup: opsi.lihatSemua ? "semua" : "saya",
    terakhirDiukur: teks(terakhir?.t),
  };
}

// ============================================================================
// TITIK SAMBUNG MEMORI PROYEK ALETA Ai
// ============================================================================

export type PelabuhanMemoriProyek = {
  daftarProyek(db: AletaDatabase): Promise<Array<{ id: string; nama: string; memoriAktif: boolean }>>;
  /** Menyimpan usulan memori (status "usulan" menunggu persetujuan Super Admin di proyek); mengembalikan jumlah yang benar-benar baru. */
  simpanUsulan(db: AletaDatabase, proyekId: string, daftar: readonly string[]): Promise<number>;
};

let pelabuhan: PelabuhanMemoriProyek | null = null;

export function pasangPelabuhanMemori(p: PelabuhanMemoriProyek | null) {
  pelabuhan = p;
}

export function bacaPelabuhanMemori(): PelabuhanMemoriProyek | null {
  return pelabuhan;
}

export type HasilTeruskan = { ok: boolean; pesan: string; diteruskan: number; baruDiProyek: number };

/** Super Admin meneruskan usulan terpilih ke memori sebuah proyek ALETA Ai (di sana tetap berstatus usulan sampai disetujui). */
export async function teruskanUsulan(
  db: AletaDatabase,
  opsi: { proyekId: string; ids: string[]; oleh: string; kini?: Date; pelabuhan?: PelabuhanMemoriProyek | null }
): Promise<HasilTeruskan> {
  const p = opsi.pelabuhan === undefined ? pelabuhan : opsi.pelabuhan;
  if (!p) return { ok: false, pesan: "Memori proyek ALETA Ai belum tersedia di pemasangan ini. Usulan tetap tersimpan.", diteruskan: 0, baruDiProyek: 0 };
  const proyek = (await p.daftarProyek(db)).find((x) => x.id === opsi.proyekId);
  if (!proyek) return { ok: false, pesan: "Proyek tidak ditemukan.", diteruskan: 0, baruDiProyek: 0 };
  if (!proyek.memoriAktif) return { ok: false, pesan: "Memori pada proyek ini dimatikan.", diteruskan: 0, baruDiProyek: 0 };
  const ids = [...new Set(opsi.ids.map(teks).filter(Boolean))].slice(0, 30);
  if (!ids.length) return { ok: false, pesan: "Tidak ada usulan yang dipilih.", diteruskan: 0, baruDiProyek: 0 };
  const baris = (await bacaUsulan(db)).filter((u) => ids.includes(u.id) && u.status === "baru");
  if (!baris.length) return { ok: false, pesan: "Usulan yang dipilih sudah diputuskan atau tidak ada.", diteruskan: 0, baruDiProyek: 0 };
  const baruDiProyek = await p.simpanUsulan(db, proyek.id, baris.map((b) => b.teks));
  const saat = (opsi.kini ?? new Date()).toISOString();
  for (const b of baris) {
    await db.run(`UPDATE aleta_pengukur_usulan SET status = 'diteruskan', proyek_id = ?, diputuskan_oleh = ?, diputuskan_pada = ? WHERE id = ? AND status = 'baru'`, [proyek.id, opsi.oleh, saat, b.id]);
  }
  return { ok: true, pesan: `${baris.length} usulan diteruskan ke proyek ${proyek.nama}; di sana tetap menunggu persetujuan.`, diteruskan: baris.length, baruDiProyek };
}

/**
 * Keputusan 119 (2 Nov 2026): usulan baru diteruskan sendiri ke memori proyek, supaya Super Admin cukup satu kali
 * memutuskan (setujui/tolak di memori proyek), bukan "teruskan" lalu "setujui". Proyek tujuan: proyek tempat usulan
 * pengukur terakhir diteruskan bila masih aktif dan memorinya menyala; bila belum pernah, hanya bila ada TEPAT SATU
 * proyek aktif bermemori. Selain itu usulan menunggu di sini seperti sebelumnya (tidak menebak proyek).
 */
export async function teruskanOtomatis(
  db: AletaDatabase,
  kini = new Date(),
  pakaiPelabuhan: PelabuhanMemoriProyek | null = pelabuhan
): Promise<HasilTeruskan | null> {
  if (!pakaiPelabuhan) return null;
  const usulan = (await bacaUsulan(db)).filter((u) => u.status === "baru");
  if (!usulan.length) return null;
  const proyek = (await pakaiPelabuhan.daftarProyek(db)).filter((x) => x.memoriAktif);
  const terakhir = await db.queryOne<{ proyek_id: string }>(
    `SELECT proyek_id FROM aleta_pengukur_usulan WHERE status = 'diteruskan' AND proyek_id IS NOT NULL AND proyek_id <> '' ORDER BY diputuskan_pada DESC LIMIT 1`
  );
  const tujuan = proyek.find((x) => x.id === teks(terakhir?.proyek_id)) ?? (proyek.length === 1 ? proyek[0] : undefined);
  if (!tujuan) return null;
  return teruskanUsulan(db, { proyekId: tujuan.id, ids: usulan.map((u) => u.id), oleh: "otomatis", kini, pelabuhan: pakaiPelabuhan });
}

export async function tolakUsulan(db: AletaDatabase, id: string, oleh: string, kini = new Date()): Promise<boolean> {
  const baris = await db.queryOne<{ status: string }>(`SELECT status FROM aleta_pengukur_usulan WHERE id = ?`, [teks(id)]);
  if (!baris || baris.status !== "baru") return false;
  await db.run(`UPDATE aleta_pengukur_usulan SET status = 'ditolak', diputuskan_oleh = ?, diputuskan_pada = ? WHERE id = ?`, [oleh, kini.toISOString(), teks(id)]);
  return true;
}

// ============================================================================
// PENJADWAL (detak 15 menit; peristiwa tiap 30 menit di jam kerja; malam sekali sehari)
// ============================================================================

export const JAM_KERJA_PENGUKUR = { mulai: "07:00", sampai: "21:00" };
export const JAM_MALAM_PENGUKUR = "22:30";
export const JEDA_PERISTIWA_PENGUKUR_MS = 30 * 60 * 1000;
const PENGGUNA_SISTEM = "sistem";
const KUNCI_MALAM = "pengukur-draf-malam";

export type KeadaanDetak = { terakhirPeristiwa: number };

export async function detakPengukurDraf(
  db: AletaDatabase,
  deps: DepsPengukur,
  keadaan: KeadaanDetak,
  env: Record<string, string | undefined> = process.env
): Promise<HasilLintasan | null> {
  if (env.ALETA_PENGUKUR_DRAF === "0") return null;
  const kini = (deps.kini ?? (() => new Date()))();
  const { tanggal, jam } = waktuPengadilan(kini);
  const hhmm = jam.slice(0, 5);
  if (hhmm >= JAM_MALAM_PENGUKUR) {
    const tanda = await db.queryOne<{ nilai: string }>(`SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?`, [PENGGUNA_SISTEM, KUNCI_MALAM]);
    if (tanda?.nilai === tanggal) return null;
    const hasil = await jalankanPengukur(db, deps, "malam");
    if (hasil) {
      // Ditandai hanya bila bot terjangkau; bila tidak, detak berikutnya mencoba lagi.
      if (!hasil.galat) {
        if (tanda) await db.run(`UPDATE aleta_ekstensi_setelan SET nilai = ?, diubah_pada = ? WHERE pengguna_id = ? AND kunci = ?`, [tanggal, kini.toISOString(), PENGGUNA_SISTEM, KUNCI_MALAM]);
        else await db.run(`INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?)`, [PENGGUNA_SISTEM, KUNCI_MALAM, tanggal, kini.toISOString()]);
      }
    }
    return hasil;
  }
  if (hhmm >= JAM_KERJA_PENGUKUR.mulai && hhmm <= JAM_KERJA_PENGUKUR.sampai && kini.getTime() - keadaan.terakhirPeristiwa >= JEDA_PERISTIWA_PENGUKUR_MS) {
    keadaan.terakhirPeristiwa = kini.getTime();
    return jalankanPengukur(db, deps, "peristiwa");
  }
  return null;
}

/** Dinyalakan instrumentation.ts. Matikan seluruhnya dengan ALETA_PENGUKUR_DRAF=0. */
export function mulaiPengukurDrafBerkala(getDb: () => Promise<AletaDatabase>, deps: DepsPengukur, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PENGUKUR_DRAF === "0") return;
  const g = globalThis as unknown as { __aletaPengukurDrafDetak?: NodeJS.Timeout };
  if (g.__aletaPengukurDrafDetak) return;
  const keadaan: KeadaanDetak = { terakhirPeristiwa: 0 };
  const detak = async () => {
    try {
      await detakPengukurDraf(await getDb(), deps, keadaan, env);
    } catch (e) {
      console.error("[PENGUKUR DRAF] detak gagal:", e);
    }
  };
  g.__aletaPengukurDrafDetak = setInterval(() => void detak(), 15 * 60 * 1000);
  // Detak pertama sesudah portal tenang (tiga menit).
  setTimeout(() => void detak(), 3 * 60 * 1000);
}
