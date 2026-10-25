/**
 * Pemantau Cermin Perkara (Admin > Pemantau Cermin Perkara).
 *
 * Halaman: pengaturan + saklar per layar, kemajuan pemindai awal ("18.400 dari
 * 23.100 perkara, perkiraan selesai 02.40"), hitungan tiap tabel cermin, dan
 * tindakan (jalankan satu kelompok sekarang, lanjutkan setelah galat, mulai
 * ulang). Admin dan Super Admin MELIHAT; mengubah saklar dan menjalankan
 * tindakan hanya Super Admin. Tidak ada yang ditulis ke SIPP/ABT.
 */
import {
  LABEL_LAYAR_CERMIN,
  LAYAR_CERMIN,
  dalamJendelaJam,
  perkiraanSelesai,
  persenKemajuan,
  type KeadaanPemindai,
  type LayarCermin,
  type PengaturanCermin,
} from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { pengaturanCerminBerlaku, simpanPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { hitunganCermin } from "@/server/modules/cermin/penyimpan";
import {
  keadaanProsesPemindai,
  lanjutkanPemindai,
  muatKeadaanPemindai,
  putaranPemindai,
  ulangPemindai,
  type HasilPutaran,
} from "@/server/modules/cermin/pemindai";
import { ApiError } from "@/server/shared/errors";
import { requireActorUser } from "@/server/modules/organization/service";

export type HalamanPemantauCermin = {
  sekarang: string;
  bolehMengubah: boolean;
  pengaturan: PengaturanCermin;
  layar: Array<{ kunci: LayarCermin; label: string; aktif: boolean }>;
  keadaan: KeadaanPemindai;
  persen: number;
  perkiraanSelesai: string | null;
  jendela: { mulai: string; selesai: string; dalamJendelaSekarang: boolean; jamSekarang: string };
  hitungan: Awaited<ReturnType<typeof hitunganCermin>>;
  proses: ReturnType<typeof keadaanProsesPemindai>;
};

async function adalahSuperAdmin(db: AletaDatabase, actorUserId: string | null | undefined): Promise<boolean> {
  try {
    const pengguna = await requireActorUser(db, actorUserId);
    return String((pengguna as { roleId?: string }).roleId ?? "") === "super-admin";
  } catch {
    return false;
  }
}

export async function halamanPemantauCermin(db: AletaDatabase, actorUserId: string | null | undefined): Promise<HalamanPemantauCermin> {
  await pastikanAdminIstimewa(db, actorUserId, "membuka Pemantau Cermin Perkara");
  const [pengaturan, keadaan, hitungan, bolehMengubah] = await Promise.all([
    pengaturanCerminBerlaku(db),
    muatKeadaanPemindai(db),
    hitunganCermin(db),
    adalahSuperAdmin(db, actorUserId),
  ]);
  const kini = new Date();
  const jam = waktuPengadilan(kini).jam.slice(0, 5);
  return {
    sekarang: kini.toISOString(),
    bolehMengubah,
    pengaturan,
    layar: LAYAR_CERMIN.map((kunci) => ({ kunci, label: LABEL_LAYAR_CERMIN[kunci], aktif: pengaturan.layar[kunci] === true })),
    keadaan,
    persen: persenKemajuan(keadaan),
    perkiraanSelesai: perkiraanSelesai(keadaan, kini, { mulai: pengaturan.jendelaMulai, selesai: pengaturan.jendelaSelesai }),
    jendela: {
      mulai: pengaturan.jendelaMulai,
      selesai: pengaturan.jendelaSelesai,
      dalamJendelaSekarang: dalamJendelaJam(jam, pengaturan.jendelaMulai, pengaturan.jendelaSelesai),
      jamSekarang: jam,
    },
    hitungan,
    proses: keadaanProsesPemindai(),
  };
}

async function pastikanSuperAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  await pastikanAdminIstimewa(db, actorUserId, "mengubah Cermin Perkara");
  if (!(await adalahSuperAdmin(db, actorUserId))) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah atau menjalankan Cermin Perkara.");
  }
}

export async function simpanPengaturanPemantauCermin(db: AletaDatabase, actorUserId: string | null | undefined, masukan: unknown | null) {
  await pastikanSuperAdmin(db, actorUserId);
  await simpanPengaturanCermin(db, actorUserId, masukan);
}

export type AksiPemantauCermin = "putaran-sekarang" | "lanjutkan" | "ulang";

export async function aksiPemantauCermin(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  aksi: AksiPemantauCermin,
  opsi: { konfirmasi?: boolean } = {}
): Promise<{ aksi: AksiPemantauCermin; hasil?: HasilPutaran }> {
  await pastikanSuperAdmin(db, actorUserId);
  if (aksi === "putaran-sekarang") {
    // Satu kelompok sekarang, melewati saklar dan jendela jam (tindakan Super Admin yang sadar).
    return { aksi, hasil: await putaranPemindai(undefined, { paksa: true }) };
  }
  if (aksi === "lanjutkan") {
    await lanjutkanPemindai(db);
    return { aksi };
  }
  if (aksi === "ulang") {
    if (opsi.konfirmasi !== true) throw new ApiError(400, "Mulai ulang pemindaian harus dikonfirmasi.");
    await ulangPemindai(db);
    return { aksi };
  }
  throw new ApiError(400, "Aksi tidak dikenal.");
}
