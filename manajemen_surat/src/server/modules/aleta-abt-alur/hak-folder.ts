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
import { jenisFolderDerry } from "@/app/api/aleta-ecourt/blangko-derry/susun";
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

export type KeadaanSaklarFolder = "nyala" | "sebagian" | "mati" | "tidak-ada";
export type SaklarHakAbt = { ppPutusan: KeadaanSaklarFolder; hakimBas: KeadaanSaklarFolder };

/**
 * Saklar "PP boleh membuka folder putusan" dan "Hakim boleh membuka folder BAS" bekerja dengan menambah peran ke user_grup_id folder-folder itu
 * di ABT (lib/pengaturan-abt.ts). Karena matriks dibaca dari hak yang sama, keadaan saklar SUDAH ikut terhitung di tabel; di sini hanya
 * dilaporkan supaya terlihat. Aturannya sama dengan susunSaklar: nyala bila semua folder yang terkena memuatnya, sebagian bila sebagian.
 */
export function keadaanSaklarDariMenu(menu: readonly BarisMenu[]): SaklarHakAbt {
  const hitung = (jenis: "put" | "bas", peran: number): KeadaanSaklarFolder => {
    const kena = menu.filter((m) => m.aktif && m.parent === "derry_briantono" && jenisFolderDerry(m.id) === jenis);
    if (!kena.length) return "tidak-ada";
    const punya = kena.filter((m) => m.grup.includes(peran)).length;
    return punya === 0 ? "mati" : punya === kena.length ? "nyala" : "sebagian";
  };
  return { ppPutusan: hitung("put", 500), hakimBas: hitung("bas", 20) };
}

export type KeadaanHakFolder = { matriks: Matriks; persetujuan: Persetujuan; berlaku: boolean; saklar: SaklarHakAbt };

export async function bacaKeadaanHakFolder(db: AletaDatabase): Promise<KeadaanHakFolder & { menu: BarisMenu[]; folder: FolderPustaka[] }> {
  const { menu, folder } = await muatMenuDanFolder(db);
  const matriks = susunMatriks(menu, folder);
  const persetujuan = await bacaPersetujuan(db);
  return { matriks, persetujuan, berlaku: persetujuan.disetujui && persetujuan.sidik === matriks.sidik, menu, folder, saklar: keadaanSaklarDariMenu(menu) };
}

export type SinkronTerakhir = { status: string; mulaiAt: string; selesaiAt: string; galat: string } | null;

/** Putaran sinkron pustaka terakhir (sinkron yang sama dengan Pengaturan SIPP & ABT): acuan matriks harus dicocokkan ulang dengan ABT di server. */
export async function bacaSinkronTerakhir(db: AletaDatabase): Promise<SinkronTerakhir> {
  const b = await db
    .queryOne<{ status: string; mulai_at: string; selesai_at: string; galat: string }>("SELECT status, mulai_at, selesai_at, galat FROM aleta_abt_sinkron ORDER BY mulai_at DESC LIMIT 1")
    .catch(() => null);
  return b ? { status: String(b.status), mulaiAt: String(b.mulai_at), selesaiAt: String(b.selesai_at ?? ""), galat: String(b.galat ?? "") } : null;
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

/**
 * Hak sebuah folder untuk golongan tertentu menurut matriks - hanya bila matriks berlaku; selain itu tidak ada putusan (null).
 * Folder arsip hanya untuk Super Admin; folder tanpa baris menu hanya untuk Super Admin sampai ditetapkan.
 */
export function putusanHakFolder(
  keadaan: { berlaku: boolean; menu: readonly BarisMenu[]; folder?: readonly FolderPustaka[] },
  folder: string,
  golongan: readonly GolonganPeran[],
  opsi: { ditunjuk?: boolean | null } = {}
): HasilHakFolder | null {
  if (!keadaan.berlaku) return null;
  const k = folder.trim().toLowerCase();
  const baris = keadaan.menu.find((m) => m.id.trim().toLowerCase() === k) ?? null;
  const arsip = keadaan.folder?.some((f) => f.folder.trim().toLowerCase() === k && f.arsip) === true;
  return periksaHakFolder(baris, golongan, { ...opsi, arsip });
}
