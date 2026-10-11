import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaKeteranganPerkara,
  riwayatKeteranganPerkara,
  tambahKeteranganPerkara,
} from "@/server/modules/aleta-ecourt/keterangan-perkara";
import { getPositionsFromDb } from "@/server/modules/organization/service";
import { listUsersFromDb } from "@/server/modules/users/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KETERANGAN PERKARA - CATATAN BEBAS DARI SIAPA PUN PEGAWAI PENGADILAN
 * ============================================================================
 *
 * Kapabilitasnya "panel" - sama dengan yang boleh melihat jadwal sidang, dan
 * itu disengaja. Yang diminta pengguna tegas: "bisa diisi keterangan apapun
 * dari siapapun yang isi (semua pegawai pengadilan)".
 *
 * Menuntut kewenangan yang lebih tinggi berarti catatan yang paling berguna -
 * dari petugas yang mengangkat telepon, dari jurusita yang baru pulang - tidak
 * pernah tertulis, sebab merekalah yang kewenangannya paling sempit.
 *
 * ============================================================================
 * TIDAK ADA UBAH, TIDAK ADA HAPUS - DAN ITU DISENGAJA
 * ============================================================================
 *
 * Rute ini hanya BACA dan TAMBAH. Yang keliru diperbaiki dengan menulis revisi
 * baru; yang salah tetap terbaca beserta siapa yang menulisnya.
 *
 * Catatan semacam ini dibaca orang untuk mengambil keputusan, dan ketika
 * keputusan itu kelak dipertanyakan, yang ditanyakan justru "waktu itu
 * tulisannya apa". Menimpa baris lama menghapus jawabannya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const params = request.nextUrl.searchParams;

    // Satu perkara dengan riwayat lengkapnya - dipanggil ketika tombolnya
    // ditekan, bukan saat daftar digambar.
    const satu = String(params.get("perkaraId") || "").trim();
    if (satu) {
      return ok({ ada: true, riwayat: await riwayatKeteranganPerkara(db, satu) });
    }

    // Banyak perkara, hanya keadaan terkininya - untuk menyalakan lambang
    // merah pada baris yang sudah ada keterangannya.
    const mentah = String(params.get("perkaraIds") || "");
    const daftar = mentah
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (daftar.length === 0) return ok({ ada: true, peta: {} });

    return ok({ ada: true, peta: await bacaKeteranganPerkara(db, daftar) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KETERANGAN_PERKARA_BACA_GAGAL",
      feature: "aleta_ecourt",
      entityId: "keterangan-perkara",
    });
  }
}

type Masukan = {
  perkaraId?: string;
  nomorPerkara?: string;
  isi?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.keterangan"); // HAK-PERAN 12 Okt: matriks peran

    const badan = (await request.json().catch(() => ({}))) as Masukan;

    // ========================================================================
    // NAMA DAN JABATAN DIAMBIL DARI SESI, BUKAN DARI YANG DIKIRIM
    // ========================================================================
    //
    // Pengirim tidak boleh menyebutkan sendiri siapa dirinya. Catatan ini
    // dibaca sebagai keterangan resmi tentang perkara orang, dan nama penulis
    // yang dapat diketik sendiri membuat seluruh riwayatnya tidak berarti apa
    // pun sebagai pertanggungjawaban.
    let namaPenulis = "";
    let jabatan = "";
    try {
      const [daftar, posisi] = await Promise.all([
        listUsersFromDb(db, actorUserId),
        getPositionsFromDb(db),
      ]);
      const namaJabatan = new Map(posisi.map((j) => [String(j.id), String(j.name ?? "")]));
      const saya = (daftar ?? []).find((u) => String(u.id) === String(actorUserId));
      if (saya) {
        namaPenulis = String(saya.name ?? "");
        jabatan = namaJabatan.get(String(saya.positionId ?? "")) ?? "";
      }
    } catch {
      // Nama tidak terbaca BUKAN alasan menolak catatannya. Yang tersimpan
      // tetap ditulis_oleh, sehingga penulisnya masih dapat ditelusuri lewat
      // akunnya - dan catatan yang hilang lebih merugikan daripada catatan
      // yang namanya harus dicari.
    }

    const hasil = await tambahKeteranganPerkara(db, {
      perkaraId: String(badan.perkaraId ?? ""),
      nomorPerkara: String(badan.nomorPerkara ?? ""),
      isi: String(badan.isi ?? ""),
      ditulisOleh: String(actorUserId ?? ""),
      namaPenulis,
      jabatan,
    });

    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KETERANGAN_PERKARA_TULIS_GAGAL",
      feature: "aleta_ecourt",
      entityId: "keterangan-perkara",
    });
  }
}
