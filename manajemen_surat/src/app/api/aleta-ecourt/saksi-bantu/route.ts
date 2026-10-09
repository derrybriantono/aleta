import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { aturHubungan, bacaDaftarHubungan, tambahHubungan } from "@/server/modules/aleta-ecourt/saksi-hubungan";
import { getGatewaySaksiKonteks, postGatewaySaksiGanda } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * BANTU DATA SAKSI (1.189.x BUTIR 10-12) - DIPAKAI ekstensi-sipp/saksiscan.js
 * ============================================================================
 *
 *   GET  ?nomorPerkara=   daftar hubungan (isi awal terukur + tambahan
 *                         petugas) dan konteks perkara dari SIPP: sebutan
 *                         para pihak menurut jenis perkara, para pihak, saksi
 *                         yang sudah ada. Konteks yang gagal dibaca tidak
 *                         menggagalkan daftar - konteks:null + alasannya.
 *   POST {aksi:"ganda"}   orang yang SUDAH ADA di data pihak SIPP (NIK sama,
 *                         atau nama + tanggal lahir sama). POST supaya nama
 *                         dan NIK tidak masuk alamat permintaan.
 *   POST {aksi:"tambah"}  tambah dasar hubungan ke daftar (kapabilitas panel)
 *   POST {aksi:"sembunyikan"|"tampilkan", kunci}   Admin & Super Admin
 *
 * Tidak ada yang ditulis ke SIPP dari rute ini. Yang mengisi blangko SIPP
 * adalah ekstensi, dan yang menyimpannya petugas lewat tombol Simpan SIPP.
 */

const NOMOR_PERKARA = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}\.?$/;
const KODE_DITOLAK_BOT = new Set(["perkara_tidak_ada", "masukan_tidak_sah", "gagal_membaca_sipp"]);

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const bolehKelola = isPrivilegedAdmin(aktor);
    const hubungan = await bacaDaftarHubungan(db, bolehKelola);

    const nomorPerkara = String(request.nextUrl.searchParams.get("nomorPerkara") || "").trim();
    let konteks: Record<string, unknown> | null = null;
    let konteksAlasan = "";
    if (!nomorPerkara) {
      konteksAlasan = "Nomor perkara tidak terbaca di halaman SIPP.";
    } else if (!NOMOR_PERKARA.test(nomorPerkara)) {
      konteksAlasan = "Nomor perkara tidak sah.";
    } else {
      const hasil = await getGatewaySaksiKonteks(nomorPerkara);
      if (hasil.ok && (hasil.data as { ok?: unknown }).ok === true) {
        konteks = hasil.data as Record<string, unknown>;
      } else if (!hasil.ok && hasil.kode && KODE_DITOLAK_BOT.has(hasil.kode)) {
        konteksAlasan = hasil.error || "Perkara tidak terbaca di SIPP.";
      } else {
        konteksAlasan = (!hasil.ok && hasil.error) || "ALETA Bot belum dapat dihubungi.";
      }
    }
    return ok({ available: true, ok: true, hubungan, bolehKelola, konteks, konteksAlasan });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_BANTU_READ_FAILED",
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
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");

    const mentah = await request.text();
    if (mentah.length > 8_000) throw new ApiError(413, "Permintaan terlalu besar.");
    let badan: Record<string, unknown>;
    try {
      badan = JSON.parse(mentah || "{}") as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Permintaan tidak dapat dibaca.");
    }
    const aksi = String(badan.aksi || "");

    if (aksi === "ganda") {
      const nama = String(badan.nama || "").trim().slice(0, 200);
      const nik = String(badan.nik || "").replace(/\s+/g, "");
      const tanggalLahir = String(badan.tanggalLahir || "").trim();
      const nomorPerkara = String(badan.nomorPerkara || "").trim();
      if (nik && !/^\d{16}$/.test(nik)) throw new ApiError(400, "NIK harus 16 angka.");
      if (tanggalLahir && !/^\d{2}\/\d{2}\/\d{4}$/.test(tanggalLahir)) throw new ApiError(400, "Tanggal lahir harus dd/mm/yyyy.");
      if (!nama && !nik) throw new ApiError(400, "Nama atau NIK wajib diisi.");
      const hasil = await postGatewaySaksiGanda({
        nama,
        nik,
        tanggalLahir,
        nomorPerkara: NOMOR_PERKARA.test(nomorPerkara) ? nomorPerkara : "",
      });
      if (!hasil.ok) {
        return ok({ available: Boolean(hasil.status && hasil.status < 500), ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
    }

    if (aksi === "tambah") {
      const hasil = await tambahHubungan(db, aktor, badan.teks);
      return ok({ available: true, ok: true, ...hasil });
    }

    if (aksi === "sembunyikan" || aksi === "tampilkan") {
      const admin = await pastikanAdminIstimewa(db, actorUserId, "mengatur daftar hubungan saksi");
      const hubungan = await aturHubungan(db, admin, badan.kunci, aksi === "tampilkan");
      return ok({ available: true, ok: true, hubungan });
    }

    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_BANTU_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
