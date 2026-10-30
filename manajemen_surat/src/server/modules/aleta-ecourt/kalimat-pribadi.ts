import { randomUUID } from "node:crypto";

import {
  BATAS_KALIMAT_PER_PEMILIK,
  bersihkanKalimat,
  berlakuUntuk,
  terlihatOleh,
  urutkanKalimat,
  type BarisKalimat,
} from "@/lib/kalimat-pribadi";
import { golonganPengguna } from "@/lib/matriks-peran";
import { type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PUSTAKA KALIMAT PRIBADI - PENYIMPANAN (migrasi 0121, 30 Okt 2026)
 * ============================================================================
 *
 * Satu-satunya modul yang menyentuh aleta_kalimat_pribadi. Pemilik membaca, mengubah, menghapus, dan membagikan kalimatnya sendiri;
 * kalimat yang dibagikan kepada golongan peran tertentu hanya dapat DIBACA dan DIPAKAI oleh golongan itu (hitungan pemakaian bersama).
 * Tidak ada yang ditulis ke SIPP/ABT di sini; menyisipkan ke isian adalah tindakan petugas di Blangko Derry.
 */

type Aktor = { id: string; name?: string | null; roleId?: string | null; additionalRoleIds?: string[] | null };

type Baris = {
  id: string;
  pemilik_id: string;
  pemilik_nama: string;
  jenis_perkara: string;
  status: string;
  kode: string;
  judul: string;
  teks: string;
  dibagikan: string;
  dipakai: number | string;
  dipakai_terakhir: string;
  diubah_pada: string;
};

const KOLOM = "id, pemilik_id, pemilik_nama, jenis_perkara, status, kode, judul, teks, dibagikan, dipakai, dipakai_terakhir, diubah_pada";

const keBaris = (b: Baris): BarisKalimat => ({
  id: String(b.id),
  pemilikId: String(b.pemilik_id),
  pemilikNama: String(b.pemilik_nama ?? ""),
  jenisPerkara: String(b.jenis_perkara ?? ""),
  status: String(b.status ?? ""),
  kode: String(b.kode ?? ""),
  judul: String(b.judul ?? ""),
  teks: String(b.teks ?? ""),
  dibagikan: String(b.dibagikan ?? "").split(",").map((x) => x.trim()).filter(Boolean),
  dipakai: Number(b.dipakai) || 0,
  dipakaiTerakhir: String(b.dipakai_terakhir ?? ""),
  diubahPada: String(b.diubah_pada ?? ""),
});

const golonganAktor = (aktor: Aktor): string[] => golonganPengguna({ roleId: aktor.roleId ?? undefined, additionalRoleIds: aktor.additionalRoleIds ?? [] } as never) as string[];

/** Kalimat yang berlaku bagi aktor untuk konteks ini (milik sendiri + yang dibagikan kepada golongannya), urut kecocokan. `semuaKode`: untuk isian mana pun (ekstensi mengelompokkan sendiri). */
export async function kalimatUntuk(db: AletaDatabase, aktor: Aktor, konteks: { jenisPerkara?: string; status?: string; kode?: string; semuaKode?: boolean }) {
  const semua = (await db.queryAll<Baris>(`SELECT ${KOLOM} FROM aleta_kalimat_pribadi WHERE pemilik_id = ? OR dibagikan <> ''`, [aktor.id])).map(keBaris);
  const golongan = golonganAktor(aktor);
  const berlaku = semua.filter((k) => terlihatOleh(k, aktor.id, golongan) && berlakuUntuk(konteks.semuaKode ? { ...k, kode: "" } : k, konteks));
  return urutkanKalimat(berlaku, aktor.id).slice(0, 50);
}

/** Semua kalimat milik aktor (untuk mengelola). */
export async function kalimatMilik(db: AletaDatabase, aktor: Aktor) {
  const baris = await db.queryAll<Baris>(`SELECT ${KOLOM} FROM aleta_kalimat_pribadi WHERE pemilik_id = ? ORDER BY diubah_pada DESC`, [aktor.id]);
  return baris.map(keBaris);
}

export async function simpanKalimat(db: AletaDatabase, aktor: Aktor, mentah: unknown): Promise<BarisKalimat> {
  const h = bersihkanKalimat(mentah);
  if (!h.ok) throw new ApiError(400, h.sebab);
  const n = h.nilai;
  const sekarang = new Date().toISOString();
  const bagi = n.dibagikan.join(",");
  if (n.id) {
    const lama = await db.queryOne<Baris>(`SELECT ${KOLOM} FROM aleta_kalimat_pribadi WHERE id = ?`, [n.id]);
    if (!lama) throw new ApiError(404, "Kalimat tidak ditemukan.");
    if (String(lama.pemilik_id) !== aktor.id) throw new ApiError(403, "Kalimat ini milik akun lain; hanya pemiliknya yang dapat mengubahnya.");
    await db.run(
      `UPDATE aleta_kalimat_pribadi SET jenis_perkara = ?, status = ?, kode = ?, judul = ?, teks = ?, dibagikan = ?, diubah_pada = ? WHERE id = ?`,
      [n.jenisPerkara, n.status, n.kode, n.judul, n.teks, bagi, sekarang, n.id]
    );
    return keBaris({ ...lama, jenis_perkara: n.jenisPerkara, status: n.status, kode: n.kode, judul: n.judul, teks: n.teks, dibagikan: bagi, diubah_pada: sekarang });
  }
  const jumlah = await db.queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM aleta_kalimat_pribadi WHERE pemilik_id = ?`, [aktor.id]);
  if (Number(jumlah?.n) >= BATAS_KALIMAT_PER_PEMILIK) throw new ApiError(400, `Pustaka penuh (paling banyak ${BATAS_KALIMAT_PER_PEMILIK} kalimat); hapus yang tidak terpakai.`);
  // Kalimat yang persis sama untuk konteks yang sama tidak disimpan dua kali: yang lama diperbarui.
  const kembar = await db.queryOne<Baris>(
    `SELECT ${KOLOM} FROM aleta_kalimat_pribadi WHERE pemilik_id = ? AND jenis_perkara = ? AND status = ? AND kode = ? AND teks = ?`,
    [aktor.id, n.jenisPerkara, n.status, n.kode, n.teks]
  );
  if (kembar) {
    await db.run(`UPDATE aleta_kalimat_pribadi SET judul = ?, dibagikan = ?, diubah_pada = ? WHERE id = ?`, [n.judul, bagi, sekarang, String(kembar.id)]);
    return keBaris({ ...kembar, judul: n.judul, dibagikan: bagi, diubah_pada: sekarang });
  }
  const id = randomUUID();
  await db.run(
    `INSERT INTO aleta_kalimat_pribadi (id, pemilik_id, pemilik_nama, jenis_perkara, status, kode, judul, teks, dibagikan, dipakai, dipakai_terakhir, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)`,
    [id, aktor.id, String(aktor.name ?? "").slice(0, 120), n.jenisPerkara, n.status, n.kode, n.judul, n.teks, bagi, sekarang, sekarang]
  );
  return keBaris({ id, pemilik_id: aktor.id, pemilik_nama: String(aktor.name ?? ""), jenis_perkara: n.jenisPerkara, status: n.status, kode: n.kode, judul: n.judul, teks: n.teks, dibagikan: bagi, dipakai: 0, dipakai_terakhir: "", diubah_pada: sekarang });
}

/** Mencatat satu pemakaian (disisipkan atau diterima dari saran). Hanya kalimat yang terlihat oleh aktor. */
export async function pakaiKalimat(db: AletaDatabase, aktor: Aktor, id: string): Promise<boolean> {
  const b = await db.queryOne<Baris>(`SELECT ${KOLOM} FROM aleta_kalimat_pribadi WHERE id = ?`, [String(id ?? "")]);
  if (!b) return false;
  const k = keBaris(b);
  if (!terlihatOleh(k, aktor.id, golonganAktor(aktor))) return false;
  await db.run(`UPDATE aleta_kalimat_pribadi SET dipakai = dipakai + 1, dipakai_terakhir = ? WHERE id = ?`, [new Date().toISOString(), k.id]);
  return true;
}

export async function hapusKalimat(db: AletaDatabase, aktor: Aktor, id: string): Promise<boolean> {
  const b = await db.queryOne<Baris>(`SELECT ${KOLOM} FROM aleta_kalimat_pribadi WHERE id = ?`, [String(id ?? "")]);
  if (!b) return false;
  if (String(b.pemilik_id) !== aktor.id) throw new ApiError(403, "Kalimat ini milik akun lain; hanya pemiliknya yang dapat menghapusnya.");
  await db.run(`DELETE FROM aleta_kalimat_pribadi WHERE id = ?`, [String(id)]);
  return true;
}
