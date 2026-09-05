import { type NextRequest } from "next/server";

import { getGatewayAntrianSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ANTRIAN PER RUANG - TANPA LOGIN, DAN KARENA ITU SANGAT DIBATASI
 * ============================================================================
 *
 * Petugas sidang perlu melihat nomor yang sedang dipanggil di ruangannya tanpa
 * berhenti untuk login - kerap sambil berdiri, kerap dari ponsel, kerap
 * sepuluh detik sebelum sidang dibuka. Itu kebutuhan yang nyata, dan menuntut
 * login untuk melihat satu angka akan membuat mereka berhenti memakainya.
 *
 * Tetapi rute ini terbuka bagi SIAPA PUN yang berada di jaringan pengadilan.
 * Maka yang dijawab hanya sebanyak yang sudah tampil di layar televisi ruang
 * tunggu, tidak lebih:
 *
 *     nomor antrian, nomor ruang, keadaan, jam panggil
 *
 * Yang TIDAK pernah dijawab di sini, dan itu disengaja:
 *
 *     nomor perkara      - menghubungkan orang dengan perkaranya
 *     nama para pihak    - identitas orang yang sedang berperkara
 *     siapa yang hadir   - keterangan kehadiran adalah keterangan pribadi
 *     nama petugas       - tidak ada gunanya bagi yang menunggu
 *
 * Untuk melihat semuanya, petugas login ke portal. Halaman cepat ini memang
 * sengaja tidak cukup untuk bekerja - ia hanya cukup untuk MELIHAT giliran.
 */
export async function GET(request: NextRequest) {
  try {
    const ruangDiminta = Number(request.nextUrl.searchParams.get("ruang") || 0);

    const hasil = await getGatewayAntrianSidang();
    if (!hasil.ok || !hasil.data) {
      return ok({
        available: false,
        message: "Antrian belum dapat dibaca.",
        ruang: ruangDiminta || null,
        baris: [],
      });
    }

    const semua = Object.values(hasil.data.peta || {})
      // Hanya empat medan yang keluar dari sini. Disaring dengan menyusun
      // objek baru, bukan dengan menghapus medan: yang disusun ulang tidak
      // dapat kebocoran medan baru yang suatu saat ditambahkan di hulu.
      .map((baris) => ({
        nomor: baris.nomor,
        noRuang: baris.noRuang,
        keadaan: baris.keadaan,
        jamPanggil: baris.jamPanggil,
      }))
      .filter((baris) => baris.nomor !== null)
      .filter((baris) => (ruangDiminta > 0 ? Number(baris.noRuang) === ruangDiminta : true))
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));

    return ok({
      available: true,
      terbaca: hasil.data.terbaca,
      ruang: ruangDiminta || null,
      baris: semua,
    });
  } catch {
    // Tanpa login, galatnya tidak boleh menceritakan apa pun tentang dalamnya.
    return ok({ available: false, message: "Antrian belum dapat dibaca.", ruang: null, baris: [] });
  }
}
