/**
 * Mengisi kolom yang dapat dicari (0134) pada baris cermin LAMA - dari baris_json yang sudah ada.
 *
 * Baris yang ditulis sesudah 0134 sudah berisi kolomnya (kolom_diisi = 1). Baris lama bernilai bawaan
 * (kolom_diisi = 0) sampai pengisi ini lewat. Sumbernya HANYA baris_json di Postgres ALETA: tidak satu kueri pun
 * ke SIPP dan tidak ke bot, jadi aman dijalankan kapan saja; per kelompok kecil supaya Postgres tidak terbebani.
 *
 * Aman diulang: hanya menyentuh kolom_diisi = 0, dan baris yang baris_json-nya rusak ditandai terisi dengan nilai
 * bawaan (pencocokan mingguan menulis ulang barisnya dari SIPP).
 */
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { NAMA_KOLOM_MEDIASI, NAMA_KOLOM_SIDANG, kolomMediasiDariBaris, kolomSidangDariBaris } from "@/server/modules/cermin/jadwal-kolom";

export const KELOMPOK_ISI_KOLOM = 200;

function urai(json: string): Record<string, unknown> | null {
  try {
    const b = JSON.parse(json) as unknown;
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type HasilIsiKolom = { sidang: number; mediasi: number; sisa: boolean };

/** Mengisi paling banyak `batas` baris sidang dan `batas` baris mediasi. `sisa` = masih ada baris lama. */
export async function isiKolomLama(db: AletaDatabase, batas = KELOMPOK_ISI_KOLOM): Promise<HasilIsiKolom> {
  const sidang = await db.queryAll<{ sidang_id: string; baris_json: string }>(
    `SELECT sidang_id, baris_json FROM aleta_cermin_sidang WHERE kolom_diisi = 0 LIMIT ${Math.max(1, Math.floor(batas))}`
  );
  const mediasi = await db.queryAll<{ id: string; baris_json: string }>(
    `SELECT id, baris_json FROM aleta_cermin_mediasi WHERE kolom_diisi = 0 LIMIT ${Math.max(1, Math.floor(batas))}`
  );
  if (sidang.length === 0 && mediasi.length === 0) return { sidang: 0, mediasi: 0, sisa: false };

  await withTransaction(db, async (tx) => {
    for (const r of sidang) {
      const k = kolomSidangDariBaris(urai(r.baris_json));
      await tx.run(`UPDATE aleta_cermin_sidang SET ${NAMA_KOLOM_SIDANG.map((n) => `${n} = ?`).join(", ")}, kolom_diisi = 1 WHERE sidang_id = ?`, [
        ...NAMA_KOLOM_SIDANG.map((n) => k[n]),
        String(r.sidang_id),
      ]);
    }
    for (const r of mediasi) {
      const k = kolomMediasiDariBaris(urai(r.baris_json));
      await tx.run(`UPDATE aleta_cermin_mediasi SET ${NAMA_KOLOM_MEDIASI.map((n) => `${n} = ?`).join(", ")}, kolom_diisi = 1 WHERE id = ?`, [
        ...NAMA_KOLOM_MEDIASI.map((n) => k[n]),
        String(r.id),
      ]);
    }
  });
  return { sidang: sidang.length, mediasi: mediasi.length, sisa: sidang.length >= batas || mediasi.length >= batas };
}

type Wadah = { selesai: boolean };
const SIMPAN = globalThis as unknown as { __aletaCerminIsiKolom?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminIsiKolom ??= { selesai: false };
  return SIMPAN.__aletaCerminIsiKolom;
}
/** Hanya untuk uji. */
export function aturUlangIsiKolom() {
  SIMPAN.__aletaCerminIsiKolom = { selesai: false };
}

/**
 * Satu langkah per detak: sesudah semua baris lama terisi, proses ini tidak memeriksa lagi (baris baru selalu
 * terisi penulisnya). Tidak pernah melempar.
 */
export async function putaranIsiKolom(db: () => Promise<AletaDatabase>): Promise<HasilIsiKolom | null> {
  const w = wadah();
  if (w.selesai) return null;
  try {
    const hasil = await isiKolomLama(await db());
    if (!hasil.sisa) w.selesai = true;
    return hasil;
  } catch {
    return null;
  }
}
