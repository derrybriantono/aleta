import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  batalkanKehadiranAntrian,
  catatKehadiranAntrian,
  getGatewayPeranAntrian,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengambil antrian sidang dari sisi PETUGAS.
 *
 * ============================================================================
 * BERBEDA DARI /api/antrian-publik, DAN BEDANYA DISENGAJA
 * ============================================================================
 *
 * Rute publik melayani layar sentuh di ruang tunggu: tanpa login, tetapi
 * dikunci keras - tidak ada daftar tanpa kata cari, hanya hari berjalan, dan
 * pencatatnya selalu "mesin-antrian".
 *
 * Yang ini melayani petugas yang sedang membuka jadwal sidang di portal.
 * Bedanya bukan pada apa yang dikerjakan - keduanya memanggil pencatat
 * kehadiran yang sama - melainkan pada SIAPA yang tercatat mengerjakannya.
 * Nomor antrian yang muncul tanpa diketahui siapa yang memunculkannya tidak
 * dapat ditelusuri pada hari ia dipersoalkan.
 *
 * ============================================================================
 * KEDATANGAN KEDUA TIDAK MENGGESER NOMOR
 * ============================================================================
 *
 * Itu dijaga di sisi bot, bukan di sini: waktu ambil hanya diisi bila masih
 * kosong. Petugas yang menekan dua kali karena ragu tidak memindahkan
 * siapa pun dalam antrean.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    // Dipisah dua supaya penyempitan tipe bekerja: `error` hanya ada pada
    // cabang gagal, dan `data` hanya pada cabang berhasil.
    const peran = await getGatewayPeranAntrian();
    if (!peran.ok) {
      return ok({ ada: false, sebab: peran.error || "Daftar peran belum dapat dibaca.", peran: [] });
    }
    if (!peran.data) {
      return ok({ ada: false, sebab: "Daftar peran belum dapat dibaca.", peran: [] });
    }
    return ok({ ada: true, peran: peran.data.peran ?? [] });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_PERAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "antrian-ambil",
    });
  }
}

type Masukan = {
  perkaraId?: string;
  nomorPerkara?: string;
  peran?: string;
  urutanPihak?: string;
  sebagaiKuasa?: boolean;
  nama?: string;
  sisi?: string;
  /** F3.2: saksi siapa - pihak_1 / pihak_2. */
  saksiUntuk?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.antrian"); // HAK-PERAN 12 Okt: matriks peran

    const masukan = (await request.json().catch(() => ({}))) as Masukan;
    const perkaraId = String(masukan.perkaraId ?? "").trim();
    const peran = String(masukan.peran ?? "").trim();

    if (!perkaraId || !peran) {
      return ok({ ok: false, alasan: "Perkara dan peran wajib disebut." });
    }

    const hasil = await catatKehadiranAntrian({
      perkaraId,
      nomorPerkara: String(masukan.nomorPerkara ?? ""),
      peran,
      urutanPihak: String(masukan.urutanPihak ?? ""),
      sebagaiKuasa: masukan.sebagaiKuasa === true,
      nama: String(masukan.nama ?? "").slice(0, 120),
      sisi: masukan.sisi ? String(masukan.sisi) : undefined,
      saksiUntuk: masukan.saksiUntuk === "pihak_1" || masukan.saksiUntuk === "pihak_2" ? masukan.saksiUntuk : undefined,
      // Nama petugasnya, bukan "mesin-antrian": inilah satu-satunya bedanya
      // dari rute publik, dan justru inilah alasan rute ini ada.
      dicatatOleh: aktor.name || String(actorUserId ?? "petugas"),
    });

    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.error || "Kehadiran belum dapat dicatat." });
    }
    if (!hasil.data) {
      return ok({ ok: false, alasan: "Kehadiran belum dapat dicatat." });
    }
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_AMBIL_FAILED",
      feature: "aleta_ecourt",
      entityId: "antrian-ambil",
    });
  }
}

/**
 * MEMBATALKAN kehadiran satu sisi - untuk salah input.
 *
 * ============================================================================
 * KENAPA DELETE, DAN KENAPA TETAP DI RUTE YANG SAMA
 * ============================================================================
 *
 * Ia membatalkan apa yang dibuat POST di atas, dan wewenangnya sama persis:
 * yang boleh mencatat kehadiran adalah yang boleh membetulkannya. Memisahnya
 * ke rute lain hanya menambah satu tempat lagi yang harus diingat saat
 * wewenangnya kelak diperketat.
 *
 * ============================================================================
 * INI MENGGESER GILIRAN ORANG LAIN
 * ============================================================================
 *
 * Mengosongkan waktu ambil mengubah urutan antrian - bukan hanya baris ini.
 * Karena itu nama pembatalnya diambil dari sesi yang sedang berjalan dan tidak
 * dapat diketik, sama seperti pada pencatatan kehadiran.
 */
export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.antrian"); // HAK-PERAN 12 Okt: matriks peran

    const masukan = (await request.json().catch(() => ({}))) as {
      perkaraId?: string;
      nomorPerkara?: string;
      sisi?: string;
      alasan?: string;
    };

    const perkaraId = String(masukan.perkaraId ?? "").trim();
    const sisi = String(masukan.sisi ?? "").trim();
    if (!perkaraId || !sisi) {
      return ok({ ok: false, alasan: "Perkara dan sisi wajib disebut." });
    }

    const hasil = await batalkanKehadiranAntrian({
      perkaraId,
      nomorPerkara: String(masukan.nomorPerkara ?? ""),
      sisi,
      alasan: String(masukan.alasan ?? "").slice(0, 255),
      dibatalkanOleh: aktor.name || String(actorUserId ?? "petugas"),
    });

    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.error || "Kehadiran belum dapat dibatalkan." });
    }
    if (!hasil.data) {
      return ok({ ok: false, alasan: "Kehadiran belum dapat dibatalkan." });
    }
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_BATAL_HADIR_FAILED",
      feature: "aleta_ecourt",
      entityId: "antrian-ambil",
    });
  }
}
