import { type NextRequest } from "next/server";

import { bacaPemetaanUntukLayar } from "@/server/modules/skp/layanan";
import { simpanPemetaan, type MasukanPemetaanSkp } from "@/server/modules/skp/pemetaan";
import { bacaIsiJson, jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemetaan akun SIPP -> pegawai -> jabatan (bertanggal berlaku).
 *
 *   GET  tautan yang ada, pegawai aktif beserta saran jabatan dan akun SIPP di
 *        profilnya. Ketua, Wakil Ketua, Panitera, Super Admin, Admin.
 *   PUT  {id?, usernameSipp, userIdSipp?, userId, jabatanUtama, jabatanTambahan?: [],
 *         berlakuDari, berlakuSampai?}
 *        Menyimpan (= mengonfirmasi) satu tautan. Panitera, Ketua, Super Admin,
 *        Admin saja. Satu akun tidak boleh ditautkan ke dua pegawai pada
 *        tanggal yang bertumpang (409).
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_PEMETAAN_FAILED", async ({ db, aktor }) => ok(await bacaPemetaanUntukLayar(db, aktor)));
}

export async function PUT(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_PEMETAAN_SIMPAN_FAILED", async ({ db, aktor }) => {
    const isi = await bacaIsiJson(request);
    const pemetaan = await simpanPemetaan(db, aktor, {
      id: typeof isi.id === "string" ? isi.id : null,
      usernameSipp: String(isi.usernameSipp ?? ""),
      userIdSipp: typeof isi.userIdSipp === "string" ? isi.userIdSipp : null,
      userId: String(isi.userId ?? ""),
      jabatanUtama: typeof isi.jabatanUtama === "string" ? isi.jabatanUtama : null,
      jabatanTambahan: Array.isArray(isi.jabatanTambahan) ? isi.jabatanTambahan : [],
      berlakuDari: String(isi.berlakuDari ?? ""),
      berlakuSampai: typeof isi.berlakuSampai === "string" ? isi.berlakuSampai : null,
    } satisfies MasukanPemetaanSkp);
    return ok({ pemetaan });
  });
}
