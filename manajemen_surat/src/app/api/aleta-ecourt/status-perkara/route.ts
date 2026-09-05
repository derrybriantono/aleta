import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  cariGatewayPerkara,
  getGatewayStatusPerkara,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status satu perkara, dari pendaftaran sampai produk pengadilan.
 *
 * ============================================================================
 * DUA KEDALAMAN, SATU RUTE
 * ============================================================================
 *
 *   ?cari=419   - daftar perkara yang cocok, untuk dipilih
 *   ?nomor=...  - seluruh keadaan satu perkara
 *
 * Pencarian mengembalikan DAFTAR, bukan langsung membuka yang pertama. Nomor
 * urut saja dapat cocok pada beberapa perkara - Pdt.G, Pdt.P, tahun berbeda -
 * dan membuka salah satunya begitu saja berarti menampilkan perkara yang keliru
 * tanpa ada yang menyadarinya.
 *
 * ============================================================================
 * KEMAMPUAN YANG SAMA DENGAN PANEL SIPP
 * ============================================================================
 *
 * Isinya keterangan perkara yang sama dengan panel di halaman SIPP, hanya
 * disusun menurut perkaranya. Karena itu memakai kemampuan panel yang sudah
 * diatur per peran.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    // Pencarian dijalankan bila ADA salah satu isian - bukan hanya kata cari.
    // Menuntut kata cari akan membuat "seluruh perkara cerai gugat 2025 yang
    // belum putus" mustahil ditanyakan, padahal itu pertanyaan yang lazim.
    const p = request.nextUrl.searchParams;
    const saringan = {
      cari: String(p.get("cari") || "").trim(),
      jenisPerkara: String(p.get("jenisPerkara") || "").trim(),
      status: String(p.get("status") || "").trim(),
      tahun: String(p.get("tahun") || "").trim(),
      alurPerkaraId: Number(p.get("alurPerkaraId")) || 0,
      sejak: String(p.get("sejak") || "").trim(),
      sampai: String(p.get("sampai") || "").trim(),
      namaPihak: String(p.get("namaPihak") || "").trim(),
      petugas: String(p.get("petugas") || "").trim(),
      hakim: String(p.get("hakim") || "").trim(),
      panitera: String(p.get("panitera") || "").trim(),
      jurusita: String(p.get("jurusita") || "").trim(),
      statusPutusan: String(p.get("statusPutusan") || "").trim(),
      pertimbangan: String(p.get("pertimbangan") || "").trim(),
      amar: String(p.get("amar") || "").trim(),
      verstek: String(p.get("verstek") || "").trim(),
      alamatPihak: String(p.get("alamatPihak") || "").trim(),
      kua: String(p.get("kua") || "").trim(),
      relaas: String(p.get("relaas") || "").trim(),
      putusSejak: String(p.get("putusSejak") || "").trim(),
      putusSampai: String(p.get("putusSampai") || "").trim(),
      umur: String(p.get("umur") || "").trim(),
      ecourt: String(p.get("ecourt") || "").trim(),
      batas: Number(p.get("batas")) || 25,
    };

    const adaSaringan =
      Boolean(saringan.cari) ||
      Boolean(saringan.jenisPerkara) ||
      Boolean(saringan.status) ||
      Boolean(saringan.tahun) ||
      saringan.alurPerkaraId > 0 ||
      Boolean(saringan.sejak) ||
      Boolean(saringan.sampai) ||
      Boolean(saringan.namaPihak) ||
      Boolean(saringan.petugas) ||
      Boolean(saringan.hakim) ||
      Boolean(saringan.panitera) ||
      Boolean(saringan.jurusita) ||
      Boolean(saringan.statusPutusan) ||
      Boolean(saringan.pertimbangan) ||
      Boolean(saringan.amar) ||
      Boolean(saringan.verstek) ||
      Boolean(saringan.alamatPihak) ||
      Boolean(saringan.kua) ||
      Boolean(saringan.relaas) ||
      Boolean(saringan.putusSejak) ||
      Boolean(saringan.putusSampai) ||
      Boolean(saringan.umur) ||
      Boolean(saringan.ecourt);

    if (adaSaringan) {
      const hasil = await cariGatewayPerkara(saringan);
      if (!hasil.ok) {
        return ok({
          available: false,
          message: hasil.error || "ALETA Bot belum dapat dihubungi.",
          perkara: [],
        });
      }
      return ok({
        available: true,
        perkara: hasil.data?.perkara ?? [],
        pilihanStatus: hasil.data?.pilihanStatus ?? [],
        pilihanAlur: hasil.data?.pilihanAlur ?? [],
      });
    }

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return ok({ available: true, status: null, alasan: "nomor_perkara_kosong" });
    }

    const hasil = await getGatewayStatusPerkara(nomor);
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        status: null,
      });
    }

    if (!hasil.data?.ok) {
      return ok({
        available: true,
        status: null,
        alasan: String(hasil.data?.alasan || "perkara_tidak_ditemukan"),
      });
    }

    return ok({ available: true, status: hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_STATUS_PERKARA_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
