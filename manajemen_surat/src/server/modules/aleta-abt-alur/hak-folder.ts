import {
  barisMenuDari,
  periksaHakFolder,
  susunMatriks,
  type BarisMenu,
  type FolderPustaka,
  type HasilHakFolder,
  type Matriks,
} from "@/lib/aleta-abt-hak-folder";
import type { GolonganPeran } from "@/lib/matriks-peran";
import type { AletaDatabase } from "@/server/db/client";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * Hak per folder blangko ALETA ABT dari pustaka ALETA (aleta_abt_menu, aleta_abt_berkas) - HANYA MEMBACA, ditambah satu saklar
 * persetujuan. Matriks BELUM BERLAKU sebelum Super Admin (pemilik) menyetujuinya, dan persetujuan terikat pada sidik isi matriks yang dilihat:
 * bila pustaka berubah sehingga sidik berubah, persetujuan lama tidak berlaku lagi. Bawaan: belum disetujui.
 * Yang berlaku hanya di dalam ALETA ABT (yang masih khusus Super Admin); Blangko ABT by Derry Briantono tetap memakai hak ABT sendiri.
 */

export const KUNCI_PERSETUJUAN_HAK_FOLDER = "aleta_abt_hak_folder_setuju";

export type Persetujuan = { disetujui: boolean; sidik: string; oleh: string; pada: string };
const BAWAAN: Persetujuan = { disetujui: false, sidik: "", oleh: "", pada: "" };

export async function bacaPersetujuan(db: AletaDatabase): Promise<Persetujuan> {
  const t = await bacaKunci<Partial<Persetujuan>>(db, KUNCI_PERSETUJUAN_HAK_FOLDER);
  if (!t || typeof t !== "object") return { ...BAWAAN };
  return { disetujui: t.disetujui === true, sidik: String(t.sidik ?? ""), oleh: String(t.oleh ?? ""), pada: String(t.pada ?? "") };
}

type BarisMenuDb = Record<string, unknown>;

export async function muatMenuDanFolder(db: AletaDatabase): Promise<{ menu: BarisMenu[]; folder: FolderPustaka[] }> {
  const [menuDb, berkas] = await Promise.all([
    db.queryAll<BarisMenuDb>(
      `SELECT id AS direktori, nama, nama_alias, parent_direktori, user_grup_id, user_top_id, user_validator, user_cek, proses_id_min, proses_id_max,
              perkara_id_min, perkara_id_max, perkara_id_referensi, status FROM aleta_abt_menu`
    ).catch(() => [] as BarisMenuDb[]),
    db
      .queryAll<{ folder: string; arsip: number | string }>("SELECT folder, MAX(arsip) AS arsip FROM aleta_abt_berkas WHERE status <> 'hilang' GROUP BY folder")
      .catch(() => [] as Array<{ folder: string; arsip: number | string }>),
  ]);
  return {
    menu: menuDb.map(barisMenuDari).filter((m) => m.id),
    folder: berkas.filter((b) => String(b.folder ?? "").trim()).map((b) => ({ folder: String(b.folder), arsip: Number(b.arsip) === 1 })),
  };
}

export type KeadaanHakFolder = { matriks: Matriks; persetujuan: Persetujuan; berlaku: boolean };

export async function bacaKeadaanHakFolder(db: AletaDatabase): Promise<KeadaanHakFolder & { menu: BarisMenu[] }> {
  const { menu, folder } = await muatMenuDanFolder(db);
  const matriks = susunMatriks(menu, folder);
  const persetujuan = await bacaPersetujuan(db);
  return { matriks, persetujuan, berlaku: persetujuan.disetujui && persetujuan.sidik === matriks.sidik, menu };
}

/** Menyetujui atau mencabut persetujuan. Menyetujui hanya sah atas sidik yang SAMA dengan matriks sekarang (yang dilihat pemilik). */
export async function simpanPersetujuan(db: AletaDatabase, aktor: { id: string; name: string }, masukan: { setuju: boolean; sidik: string }): Promise<Persetujuan> {
  if (masukan.setuju) {
    const { matriks } = await bacaKeadaanHakFolder(db);
    if (!masukan.sidik || masukan.sidik !== matriks.sidik) throw new ApiError(409, "Isi matriks sudah berubah sejak Anda melihatnya. Muat ulang layar, periksa, lalu setujui lagi.");
    if (matriks.jumlahFolder === 0) throw new ApiError(422, "Belum ada folder blangko di pustaka, jadi belum ada yang dapat disetujui.");
  }
  const baru: Persetujuan = { disetujui: masukan.setuju, sidik: masukan.setuju ? masukan.sidik : "", oleh: aktor.name || aktor.id, pada: new Date().toISOString() };
  await tulisKunci(db, KUNCI_PERSETUJUAN_HAK_FOLDER, baru);
  return baru;
}

/** Hak sebuah folder untuk golongan tertentu menurut matriks - hanya bila matriks berlaku; selain itu tidak ada putusan (null). */
export function putusanHakFolder(keadaan: { berlaku: boolean; menu: readonly BarisMenu[] }, folder: string, golongan: readonly GolonganPeran[], opsi: { ditunjuk?: boolean | null } = {}): HasilHakFolder | null {
  if (!keadaan.berlaku) return null;
  const k = folder.trim().toLowerCase();
  const baris = keadaan.menu.find((m) => m.id.trim().toLowerCase() === k) ?? null;
  return periksaHakFolder(baris, golongan, opsi);
}
