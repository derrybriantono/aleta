import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  HEADER_TAUTAN_JADWAL,
  periksaTautan,
  personaUntukPeramban,
  tandaiPemakaian,
} from "@/server/modules/tautan-jadwal/service";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Membuka tampilan Jadwal Sidang lewat tautan rahasia: memeriksa rahasia (di
 * header, bukan di alamat) dan menjawab nama tautan serta akun yang diwakili,
 * supaya halaman menggambar tombol sesuai hak akun itu. Semua penolakan
 * (jaringan luar, tak dikenal, dicabut, kedaluwarsa, dimatikan) berupa
 * kalimat biasa tanpa data jadwal.
 */
export async function GET(request: NextRequest) {
  try {
    const rahasia = request.headers.get(HEADER_TAUTAN_JADWAL) || "";
    const db = await getDatabase();
    const hasil = await periksaTautan(db, request, rahasia);
    await tandaiPemakaian(db, hasil.tautan.id, hasil.ip);
    return ok({
      nama: hasil.tautan.nama,
      berlakuSampai: hasil.tautan.berlakuSampai,
      pengguna: personaUntukPeramban(hasil.aktor),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
