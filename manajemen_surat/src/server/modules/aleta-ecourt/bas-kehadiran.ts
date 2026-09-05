import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

/**
 * KEHADIRAN SIDANG - siapa hadir, apa agendanya, apa hasilnya.
 *
 * ============================================================================
 * INILAH SATU-SATUNYA YANG TIDAK DAPAT DIBACA DARI MANA PUN
 * ============================================================================
 *
 * Blangko BAS menanyakan kehadiran para pihak pada #1072# dan #1073#. SIPP
 * hanya mencatat "dihadiri oleh 2" sebagai angka - tanpa menyebut siapa:
 * Penggugat sendiri, kuasanya, atau keduanya.
 *
 * Selama kehadiran belum tercatat, BAS sidang pertama tidak akan pernah dapat
 * selesai di ALETA betapapun lengkapnya bagian lain. Karena itu ia mendapat
 * tempatnya sendiri, bukan dititipkan pada lembar tanya-jawab saksi - sidang
 * pertama biasanya belum ada saksinya sama sekali.
 */

export type Kehadiran = {
  perkaraId: string;
  nomorPerkara: string;
  sidangKe: number;
  kehadiranPenggugat: string;
  kehadiranTergugat: string;
  agenda: string;
  hasil: string;
  catatan: string;
  diubahOleh: string;
  diubahAt: string;
};

/**
 * Bunyi kehadiran yang lazim dipakai, untuk dipilih tanpa mengetik.
 *
 * Bukan daftar tertutup - kotaknya tetap dapat diketik bebas. Perkara
 * menghadirkan keadaan yang tidak terduga, dan daftar tertutup memaksa panitera
 * memilih yang paling mendekati lalu menuliskan yang tidak terjadi.
 */
export const BUNYI_KEHADIRAN = [
  "hadir secara pribadi",
  "hadir didampingi kuasanya",
  "tidak hadir, diwakili kuasanya",
  "tidak hadir dan tidak pula menyuruh orang lain sebagai wakil/kuasanya",
  "tidak hadir tanpa alasan yang sah",
];

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

type BarisDb = Record<string, unknown>;

function bentuk(baris: BarisDb): Kehadiran {
  return {
    perkaraId: teks(baris.perkara_id),
    nomorPerkara: teks(baris.nomor_perkara),
    sidangKe: Number(baris.sidang_ke) || 0,
    kehadiranPenggugat: teks(baris.kehadiran_penggugat),
    kehadiranTergugat: teks(baris.kehadiran_tergugat),
    agenda: teks(baris.agenda),
    hasil: teks(baris.hasil),
    catatan: teks(baris.catatan),
    diubahOleh: teks(baris.diubah_oleh),
    diubahAt: teks(baris.diubah_at),
  };
}

export async function muatKehadiran(
  db: AletaDatabase,
  perkaraId: string,
  sidangKe: number
): Promise<Kehadiran | null> {
  const id = teks(perkaraId);
  const nomor = Number(sidangKe) || 0;
  if (!id || !nomor) return null;

  const baris = await db.queryOne<BarisDb>(
    `SELECT * FROM aleta_bas_kehadiran WHERE perkara_id = ? AND sidang_ke = ?`,
    [id, nomor]
  );
  return baris ? bentuk(baris) : null;
}

export async function semuaKehadiran(db: AletaDatabase, perkaraId: string): Promise<Kehadiran[]> {
  const id = teks(perkaraId);
  if (!id) return [];

  const baris = await db.queryAll<BarisDb>(
    `SELECT * FROM aleta_bas_kehadiran WHERE perkara_id = ? ORDER BY sidang_ke`,
    [id]
  );
  return baris.map(bentuk);
}

export type MasukanKehadiran = {
  perkaraId: string;
  nomorPerkara?: string;
  sidangKe: number;
  kehadiranPenggugat?: string;
  kehadiranTergugat?: string;
  agenda?: string;
  hasil?: string;
  catatan?: string;
};

export async function simpanKehadiran(
  db: AletaDatabase,
  actorUserId: string,
  masukan: MasukanKehadiran
): Promise<Kehadiran> {
  const perkaraId = teks(masukan.perkaraId);
  const sidangKe = Number(masukan.sidangKe) || 0;
  if (!perkaraId) throw new Error("Perkara tidak dikenali.");
  if (!sidangKe) throw new Error("Sidang ke berapa belum ditentukan.");

  const sekarang = new Date().toISOString();
  const ada = await db.queryOne<BarisDb>(
    `SELECT id FROM aleta_bas_kehadiran WHERE perkara_id = ? AND sidang_ke = ?`,
    [perkaraId, sidangKe]
  );

  const nilai = [
    teks(masukan.nomorPerkara),
    teks(masukan.kehadiranPenggugat),
    teks(masukan.kehadiranTergugat),
    teks(masukan.agenda),
    teks(masukan.hasil),
    teks(masukan.catatan),
    teks(actorUserId),
    sekarang,
  ];

  if (ada) {
    await db.run(
      `UPDATE aleta_bas_kehadiran
          SET nomor_perkara = ?, kehadiran_penggugat = ?, kehadiran_tergugat = ?,
              agenda = ?, hasil = ?, catatan = ?, diubah_oleh = ?, diubah_at = ?
        WHERE id = ?`,
      [...nilai, teks(ada.id)]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_bas_kehadiran
         (id, perkara_id, sidang_ke, nomor_perkara, kehadiran_penggugat, kehadiran_tergugat,
          agenda, hasil, catatan, dibuat_oleh, dibuat_at, diubah_oleh, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), perkaraId, sidangKe, ...nilai.slice(0, 6), teks(actorUserId), sekarang, teks(actorUserId), sekarang]
    );
  }

  const tersimpan = await muatKehadiran(db, perkaraId, sidangKe);
  if (!tersimpan) throw new Error("Kehadiran gagal disimpan.");
  return tersimpan;
}

/**
 * Penanda blangko yang berasal dari catatan kehadiran.
 *
 * Nomornya dari abt_variabel: 1072 "Kehadiran #0046#", 1073 "Kehadiran
 * #0047#". Keduanya HANYA diisi bila panitera benar-benar mencatatnya -
 * menebak kehadiran berarti BAS menyatakan seseorang hadir di persidangan yang
 * tidak pernah ia datangi.
 */
export function penandaDariKehadiran(kehadiran: Kehadiran | null): Map<string, { nilai: string; asal: string }> {
  const peta = new Map<string, { nilai: string; asal: string }>();
  if (!kehadiran) return peta;

  const asal = `ALETA - catatan kehadiran sidang ke-${kehadiran.sidangKe}`;
  if (kehadiran.kehadiranPenggugat) peta.set("1072", { nilai: kehadiran.kehadiranPenggugat, asal });
  if (kehadiran.kehadiranTergugat) peta.set("1073", { nilai: kehadiran.kehadiranTergugat, asal });

  return peta;
}
