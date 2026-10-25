import { randomUUID } from "node:crypto";

import { KODE_FITUR_ISIAN_SEKALI, bersihkanMasukanSekali, daftarKodeSekali, urutkanBeban, type BarisBeban } from "@/lib/isian-sekali";
import { type AletaDatabase } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * ISIAN SEKALI PER PERKARA - PENYIMPANAN (25 Okt 2026, rantai D butir D2 = U11)
 * ============================================================================
 *
 * Aturan di src/lib/isian-sekali.ts. Di sini: membaca saklar, mengingat dan membaca nilai per perkara di
 * aleta_isian_perkara (+ aleta_isian_riwayat, migrasi 0035 - tanpa migrasi baru), dan menghitung beban.
 *
 * SAKLAR: Fitur Satker "isian-sekali", bawaan MATI. Mati = tidak menulis, tidak membaca, tidak ada saran.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini. Yang diingat hanyalah apa yang petugas sendiri simpan
 * ke ABT lewat Blangko Derry.
 */

export async function isianSekaliAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, KODE_FITUR_ISIAN_SEKALI);
  } catch {
    return false;
  }
}

const teks = (x: unknown) => String(x ?? "").trim();

export type IsianTersimpan = { kode: string; nilai: string; diisiOleh: string; diubahAt: string };

/** Nilai yang diingat untuk satu perkara: hanya isian sekali dan hanya yang berisi. Saklar mati -> kosong. */
export async function bacaIsianSekali(db: AletaDatabase, perkaraId: string): Promise<IsianTersimpan[]> {
  const id = teks(perkaraId);
  if (!id || !(await isianSekaliAktif(db))) return [];
  const boleh = new Set(daftarKodeSekali());
  const baris = await db.queryAll<Record<string, unknown>>(`SELECT no_var, nilai, diisi_oleh, diubah_at FROM aleta_isian_perkara WHERE perkara_id = ?`, [id]);
  return baris
    .filter((b) => boleh.has(teks(b.no_var)) && teks(b.nilai))
    .map((b) => ({ kode: teks(b.no_var), nilai: String(b.nilai ?? "").trim(), diisiOleh: teks(b.diisi_oleh), diubahAt: teks(b.diubah_at) }));
}

export type HasilSimpanSekali = { aktif: boolean; disimpan: boolean; sebab: string };

/**
 * Mengingat satu isian untuk satu perkara. Hanya kode dalam daftar; nilai kosong (petugas mengosongkan
 * isian) ikut diingat sebagai kosong supaya saran lama tidak muncul lagi. Tiap perubahan masuk riwayat.
 */
export async function simpanIsianSekali(db: AletaDatabase, aktor: { id: string; nama?: string | null }, mentah: unknown): Promise<HasilSimpanSekali> {
  if (!(await isianSekaliAktif(db))) return { aktif: false, disimpan: false, sebab: "" };
  const oleh = teks(aktor.nama) || teks(aktor.id);
  if (!oleh) return { aktif: true, disimpan: false, sebab: "Isian harus menyebut siapa yang mengisinya." };
  const m = bersihkanMasukanSekali(mentah);
  if ("ditolak" in m) return { aktif: true, disimpan: false, sebab: m.sebab };
  const lama = await db.queryOne<Record<string, unknown>>(`SELECT id, nilai FROM aleta_isian_perkara WHERE perkara_id = ? AND no_var = ?`, [m.perkaraId, m.kode]);
  const nilaiLama = teks(lama?.nilai);
  if (lama && nilaiLama === m.nilai) return { aktif: true, disimpan: false, sebab: "Sudah sama." };
  if (!lama && !m.nilai) return { aktif: true, disimpan: false, sebab: "Kosong dan belum pernah diingat." };
  const sekarang = new Date().toISOString();
  if (lama) {
    await db.run(`UPDATE aleta_isian_perkara SET nilai = ?, diubah_oleh = ?, diubah_at = ? WHERE id = ?`, [m.nilai, oleh, sekarang, teks(lama.id)]);
  } else {
    await db.run(
      `INSERT INTO aleta_isian_perkara (id, perkara_id, no_var, nilai, diisi_oleh, diisi_at, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), m.perkaraId, m.kode, m.nilai, oleh, sekarang, oleh, sekarang]
    );
  }
  await db.run(`INSERT INTO aleta_isian_riwayat (id, perkara_id, no_var, nilai_lama, nilai_baru, oleh, pada) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    randomUUID(),
    m.perkaraId,
    m.kode,
    nilaiLama,
    m.nilai,
    oleh,
    sekarang,
  ]);
  return { aktif: true, disimpan: true, sebab: "" };
}

export type LaporanBeban = {
  aktif: boolean;
  /** Jejak isian (C1) menyala: hitungan hidup berarti. */
  jejakMenyala: boolean;
  jumlahKode: number;
  jumlahTanpaSumber: number;
  diingatTotal: number;
  baris: BarisBeban[];
};

/**
 * Urutan kerja menutup isian manual (Admin/Super Admin). Hitungan hidup = penyimpanan ketikan (cara "diketik")
 * di jejak isian per kode; "diingat" = perkara yang isiannya sudah diingat. Saklar mati -> kosong.
 */
export async function laporanBebanSekali(db: AletaDatabase): Promise<LaporanBeban> {
  const aktif = await isianSekaliAktif(db);
  if (!aktif) return { aktif: false, jejakMenyala: false, jumlahKode: 0, jumlahTanpaSumber: 0, diingatTotal: 0, baris: [] };
  const boleh = new Set(daftarKodeSekali());
  const hidup: Record<string, number> = {};
  const diingat: Record<string, number> = {};
  const ketik = await db.queryAll<Record<string, unknown>>(`SELECT kode, COUNT(*) AS n FROM aleta_isian_jejak WHERE cara = 'diketik' GROUP BY kode`);
  for (const k of ketik) if (boleh.has(teks(k.kode))) hidup[teks(k.kode)] = Number(k.n) || 0;
  const ada = await db.queryAll<Record<string, unknown>>(`SELECT no_var, COUNT(*) AS n FROM aleta_isian_perkara WHERE nilai <> '' GROUP BY no_var`);
  let total = 0;
  for (const k of ada) {
    if (!boleh.has(teks(k.no_var))) continue;
    diingat[teks(k.no_var)] = Number(k.n) || 0;
    total += Number(k.n) || 0;
  }
  const baris = urutkanBeban(hidup, diingat);
  let jejakMenyala = false;
  try {
    jejakMenyala = await fiturMenyala(db, "jejak-isian");
  } catch {
    jejakMenyala = false;
  }
  return { aktif: true, jejakMenyala, jumlahKode: baris.length, jumlahTanpaSumber: baris.filter((b) => b.tanpaSumber).length, diingatTotal: total, baris };
}
