import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  BATAS_CAP_BYTE,
  daftarCap,
  PERUNTUKAN_CAP,
  SEBUTAN_PERUNTUKAN,
  setelAktifCap,
  tambahCap,
} from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KALIMAT: Record<string, string> = {
  nama_cap_kosong: 'Nama cap wajib diisi (mis. "Cap Panitera PA Donggala").',
  peruntukan_tidak_dikenal:
    "Pilih peruntukan cap: Ketua, Panitera, Ketua Majelis, atau Umum.",
  gambar_cap_terlalu_kecil:
    "Gambar cap terlalu kecil - unggah hasil pindai cap yang jelas.",
  gambar_cap_terlalu_besar: `Gambar cap melampaui ${BATAS_CAP_BYTE / 1024 / 1024} MB.`,
  gambar_cap_bukan_png_jpg:
    "Gambar cap harus PNG atau JPG (PNG berlatar transparan paling baik), atau WEBP dengan \"buang latar\" dicentang.",
  gambar_cap_tanpa_tinta:
    "Tidak ada tinta cap yang terbaca pada gambar ini - latar tidak dapat dibuang.",
  gambar_cap_tidak_terbaca: "Gambar cap tidak dapat dibaca.",
  cap_tidak_ditemukan: "Cap tidak ditemukan.",
  tindakan_tidak_dikenali: "Tindakan tidak dikenali.",
};

/**
 * CAP PENGADILAN untuk edoc penetapan (butir 17, K6) - tempatnya di layar
 * "Berkas tanda tangan" ALETA e-Court.
 *
 * Kewenangannya "blangko-abt", sama dengan layar tanda tangan: cap berlaku
 * untuk seluruh satuan kerja dan seluruh perkara sesudahnya. Cap TIDAK
 * dihapus - dimatikan/dinyalakan, sehingga yang pernah dipakai tetap terlihat.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const baris = await daftarCap(db);
    return ok({
      ok: true,
      baris,
      peruntukan: PERUNTUKAN_CAP.map((p) => ({
        kode: p,
        sebutan: SEBUTAN_PERUNTUKAN[p],
      })),
      batasByte: BATAS_CAP_BYTE,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "CAP_PENETAPAN_BACA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const aktor = {
      id: actor.id,
      nama: String(actor.name || actor.email || actor.id),
    };
    const badan = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const tindakan = String(badan.tindakan ?? "");

    let hasil: { ok: boolean; alasan?: string; id?: string };
    if (tindakan === "tambah") {
      const teks = String(badan.isiBase64 ?? "");
      if (Math.floor((teks.length * 3) / 4) > BATAS_CAP_BYTE + 4) {
        hasil = { ok: false, alasan: "gambar_cap_terlalu_besar" };
      } else {
        hasil = await tambahCap(
          db,
          {
            nama: String(badan.nama ?? ""),
            peruntukan: String(badan.peruntukan ?? ""),
            keterangan: String(badan.keterangan ?? ""),
            isi: new Uint8Array(Buffer.from(teks, "base64")),
            // Perbaikan 6 Okt (butir 18/20): foto/pindaian cap dibuang
            // latarnya menjadi PNG transparan sebelum disimpan.
            buangLatar: badan.buangLatar === true,
          },
          aktor,
        );
      }
    } else if (tindakan === "aktif") {
      hasil = await setelAktifCap(
        db,
        String(badan.id ?? ""),
        badan.aktif === true,
        aktor,
      );
    } else {
      hasil = { ok: false, alasan: "tindakan_tidak_dikenali" };
    }
    return ok({
      ...hasil,
      pesan: hasil.ok
        ? ""
        : (KALIMAT[hasil.alasan ?? ""] ?? String(hasil.alasan ?? "")),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "CAP_PENETAPAN_UBAH_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
