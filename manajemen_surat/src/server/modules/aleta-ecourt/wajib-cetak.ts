import { randomUUID } from "node:crypto";

import { batasRetensi } from "@/lib/jejak-isian";
import {
  BATAS_RIWAYAT_PER_BERKAS,
  BATAS_SERUPA,
  JENDELA_LAPOR,
  KODE_FITUR_WAJIB_CETAK,
  bersihkanFaktaPola,
  bersihkanLapor,
  pelajariWajib,
  susunUsulanSerupa,
  tandaIsian,
  type HasilBelajar,
  type NilaiPerkaraSerupa,
  type UsulanSerupa,
} from "@/lib/wajib-cetak";
import { type AletaDatabase } from "@/server/db/client";
import { catatSidik, perkaraSerupa } from "@/server/modules/aleta-ecourt/aturan-pemeriksaan";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * DAFTAR WAJIB SEBELUM CETAK DAN SALIN DARI PERKARA SERUPA - PENYIMPANAN
 * (25 Okt 2026, rantai D butir D3 = U13)
 * ============================================================================
 *
 * Aturan murni di src/lib/wajib-cetak.ts. Di sini: membaca saklar, mencatat riwayat kelengkapan blangko
 * (aleta_blangko_lapor, migrasi 0102), menghitung isian yang biasanya terisi saat cetak, dan menyusun
 * usulan dari perkara serupa (aleta_perkara_sidik, 0028 + nilai akhir di aleta_isian_jejak, 0091).
 *
 * SAKLAR: Fitur Satker "wajib-sebelum-cetak", bawaan MATI. Mati = tidak satu baris pun ditulis, tidak ada
 * pengingat tambahan, tidak ada usulan - perilaku cetak persis seperti sebelumnya.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini. Usulan salinan hanya muncul di layar petugas.
 */

export async function wajibCetakAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, KODE_FITUR_WAJIB_CETAK);
  } catch {
    return false;
  }
}

const teks = (x: unknown) => String(x ?? "").trim();

export type AktorLapor = { id: string; nama?: string | null };

// ─── Pembersihan (retensi 2 tahun) ──────────────────────────────────────────

let pembersihanTerakhir = 0;
const SELANG_BERSIH_MS = 6 * 3_600_000;

export async function bersihkanLaporLawas(db: AletaDatabase, sekarang: Date = new Date()) {
  const batas = batasRetensi(sekarang);
  const n = await db.queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS n FROM aleta_blangko_lapor WHERE pada < ?`, [batas]);
  await db.run(`DELETE FROM aleta_blangko_lapor WHERE pada < ?`, [batas]);
  return { dihapus: Number(n?.n) || 0, batas };
}

function bersihkanBilaPerlu(db: AletaDatabase) {
  const kini = Date.now();
  if (kini - pembersihanTerakhir < SELANG_BERSIH_MS) return;
  pembersihanTerakhir = kini;
  void bersihkanLaporLawas(db).catch(() => undefined);
}

/** Untuk uji. */
export function lupakanPembersihanLapor() {
  pembersihanTerakhir = 0;
}

// ─── Riwayat kelengkapan ────────────────────────────────────────────────────

export type HasilLapor = { aktif: boolean; dicatat: boolean; sebab: string };

/**
 * Mencatat keadaan kelengkapan satu blangko pada satu perkara (semua jenis blangko). Satu baris per keadaan yang
 * BERBEDA dari yang terakhir; satu baris tersendiri setiap kali blangko DICETAK. Paling banyak
 * BATAS_RIWAYAT_PER_BERKAS baris bukan-cetak terbaru per perkara + blangko; baris cetak dipertahankan (bahan belajar).
 * Bila ada fakta pola dan jenis perkara, pola perkara ikut dicatat (aleta_perkara_sidik) supaya perkara ini
 * dapat dicari sebagai perkara serupa.
 */
export async function catatLaporan(db: AletaDatabase, aktor: AktorLapor, mentah: unknown): Promise<HasilLapor> {
  if (!(await wajibCetakAktif(db))) return { aktif: false, dicatat: false, sebab: "" };
  const m = bersihkanLapor(mentah);
  if (!m) return { aktif: true, dicatat: false, sebab: "Laporan tidak lengkap." };
  const tanda = tandaIsian(m.isian);
  const terisi = m.isian.filter((i) => i.terisi).length;
  const dicetak = m.dicetak ? 1 : 0;
  const kini = new Date().toISOString();

  if (!dicetak) {
    const terakhir = await db.queryOne<Record<string, unknown>>(`SELECT isian, dicetak FROM aleta_blangko_lapor WHERE perkara_id = ? AND berkas = ? ORDER BY pada DESC, dibuat_at DESC LIMIT 1`, [m.perkaraId, m.berkas]);
    if (terakhir && teks(terakhir.isian) === tanda && Number(terakhir.dicetak) === 0) return { aktif: true, dicatat: false, sebab: "Sudah sama." };
  }

  let nama = teks(aktor.nama);
  if (!nama) {
    try {
      nama = teks((await db.queryOne<Record<string, unknown>>(`SELECT name FROM users WHERE id = ?`, [aktor.id]))?.name);
    } catch {
      nama = "";
    }
  }
  await db.run(
    `INSERT INTO aleta_blangko_lapor (id, perkara_id, nomor_perkara, berkas, jenis_blangko, jenis_perkara, isian, terisi, jumlah, dicetak, pengguna_id, pengguna_nama, pada, dibuat_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), m.perkaraId, m.nomorPerkara, m.berkas, m.jenisBlangko, m.jenisPerkara, tanda, terisi, m.isian.length, dicetak, teks(aktor.id), nama, kini, kini]
  );

  // Riwayat bukan-cetak dibatasi per perkara + blangko.
  const lama = await db.queryAll<Record<string, unknown>>(`SELECT id FROM aleta_blangko_lapor WHERE perkara_id = ? AND berkas = ? AND dicetak = 0 ORDER BY pada DESC, dibuat_at DESC`, [m.perkaraId, m.berkas]);
  for (const b of lama.slice(BATAS_RIWAYAT_PER_BERKAS)) await db.run(`DELETE FROM aleta_blangko_lapor WHERE id = ?`, [teks(b.id)]);

  // Pola perkara untuk pencarian perkara serupa; gagal mencatat pola tidak menggagalkan laporan.
  if (m.jenisPerkara && Object.keys(m.fakta).length) {
    try {
      await catatSidik(db, { perkaraId: m.perkaraId, nomorPerkara: m.nomorPerkara, jenisPerkara: m.jenisPerkara, fakta: m.fakta });
    } catch {
      /* pola tertinggal */
    }
  }
  bersihkanBilaPerlu(db);
  return { aktif: true, dicatat: true, sebab: "" };
}

// ─── Isian yang biasanya terisi ─────────────────────────────────────────────

export type JawabanWajib = { aktif: boolean } & HasilBelajar;

/** Isian yang biasanya terisi saat blangko ini dicetak (satu cetak terbaru per perkara). Saklar mati -> kosong. */
export async function bacaWajibBelajar(db: AletaDatabase, berkas: string): Promise<JawabanWajib> {
  if (!(await wajibCetakAktif(db))) return { aktif: false, cetak: 0, cukupData: false, wajib: [] };
  const nama = teks(berkas).slice(0, 300);
  if (!nama) return { aktif: true, cetak: 0, cukupData: false, wajib: [] };
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, isian FROM aleta_blangko_lapor WHERE berkas = ? AND dicetak = 1 ORDER BY pada DESC, dibuat_at DESC LIMIT ${JENDELA_LAPOR}`,
    [nama]
  );
  const lihat = new Set<string>();
  const satuPerPerkara: Array<{ isian: string; dicetak: boolean }> = [];
  for (const b of baris) {
    const id = teks(b.perkara_id);
    if (lihat.has(id)) continue;
    lihat.add(id);
    satuPerPerkara.push({ isian: teks(b.isian), dicetak: true });
  }
  return { aktif: true, ...pelajariWajib(satuPerPerkara) };
}

// ─── Salin dari perkara serupa ──────────────────────────────────────────────

export type JawabanSerupa = { aktif: boolean; serupa: number; usulan: UsulanSerupa[] };

export type MasukanSerupa = { perkaraId: string; nomorPerkara: string; jenisPerkara: string; fakta: unknown; kode: unknown };

/**
 * Usulan isian dari perkara sejenis yang SUDAH PUTUS (putusannya pernah dicetak, dicatat riwayat di atas): nilai akhir
 * isian non-identitas yang ditulis sama oleh sedikitnya dua perkara serupa. Hanya untuk kode yang diminta (yang masih
 * kosong). Tidak ada yang ditulis; saklar mati -> kosong.
 */
export async function usulSalinSerupa(db: AletaDatabase, masukan: MasukanSerupa): Promise<JawabanSerupa> {
  if (!(await wajibCetakAktif(db))) return { aktif: false, serupa: 0, usulan: [] };
  const perkaraId = teks(masukan.perkaraId).slice(0, 60);
  const jenisPerkara = teks(masukan.jenisPerkara).slice(0, 120);
  const fakta = bersihkanFaktaPola(masukan.fakta);
  const kode = (Array.isArray(masukan.kode) ? masukan.kode : [])
    .map((k) => teks(k).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 20))
    .filter(Boolean)
    .slice(0, 200);
  if (!perkaraId || !jenisPerkara || !Object.keys(fakta).length || !kode.length) return { aktif: true, serupa: 0, usulan: [] };

  // Banyak calon dicari dahulu (pola fakta kasar bisa cocok dengan puluhan perkara), lalu disaring ke yang sudah putus
  // dan dipilih yang putusannya paling baru dicetak.
  const { serupa } = await perkaraSerupa(db, { perkaraId, nomorPerkara: teks(masukan.nomorPerkara), jenisPerkara, fakta, batas: 100 });
  if (!serupa.length) return { aktif: true, serupa: 0, usulan: [] };
  const ids = serupa.map((s) => s.perkaraId).filter((id) => id && id !== perkaraId);
  if (!ids.length) return { aktif: true, serupa: 0, usulan: [] };

  // Sudah putus = putusannya pernah dicetak.
  const tanyaId = ids.map(() => "?").join(", ");
  const putus = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, MAX(pada) AS terakhir FROM aleta_blangko_lapor WHERE jenis_blangko = 'put' AND dicetak = 1 AND perkara_id IN (${tanyaId}) GROUP BY perkara_id ORDER BY MAX(pada) DESC LIMIT ${BATAS_SERUPA}`,
    ids
  );
  const dipakai = putus.map((p) => teks(p.perkara_id));
  if (!dipakai.length) return { aktif: true, serupa: 0, usulan: [] };

  const tanyaPutus = dipakai.map(() => "?").join(", ");
  const tanyaKode = kode.map(() => "?").join(", ");
  const nilai = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, nomor_perkara, kode, nama_variabel, nilai_final, pada FROM aleta_isian_jejak
      WHERE perkara_id IN (${tanyaPutus}) AND kode IN (${tanyaKode}) AND hasil <> 'diurungkan' AND nilai_final <> ''
      ORDER BY pada DESC LIMIT 5000`,
    [...dipakai, ...kode]
  );
  const baris: NilaiPerkaraSerupa[] = nilai.map((n) => ({
    perkaraId: teks(n.perkara_id),
    nomorPerkara: teks(n.nomor_perkara),
    kode: teks(n.kode),
    nama: teks(n.nama_variabel),
    nilai: String(n.nilai_final ?? ""),
    pada: teks(n.pada),
  }));
  return { aktif: true, serupa: dipakai.length, usulan: susunUsulanSerupa(baris, kode) };
}
