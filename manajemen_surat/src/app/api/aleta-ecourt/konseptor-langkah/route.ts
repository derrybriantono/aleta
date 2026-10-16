import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaDrafRingkasUntukChecklist } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import {
  bacaKeadaanKonseptor,
  bacaKemajuanKonseptor,
  hakKoreksiUntuk,
  keadaanDariBot,
  simpanLaporBlangko,
  simpanTandaLangkah,
} from "@/server/modules/aleta-ecourt/konseptor-langkah";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import type { IsianBlangkoLapor } from "@/lib/konseptor-langkah";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * CHECKLIST KONSEPTOR SEMENTARA (F1.6)
 * ============================================================================
 *
 *   GET  ?perkaraId=1,2,3
 *        kemajuan lengkap tiap perkara: langkah, status, siapa & kapan, isian
 *        Blangko Derry yang masih kosong.
 *   POST { perkaraId, langkah, selesai, catatan? }
 *        mencentang / mencabut centang satu langkah.
 *   POST { perkaraId, nomorPerkara, lapor: { berkas, isian: [...] } }
 *        laporan Blangko ABT by Derry Briantono atas blangko PUTUSAN perkara
 *        itu (dikirim ekstensi di ABT).
 *
 * Membaca: siapa pun yang boleh membuka panel. Menulis: aksi "putusan.draf"
 * (majelis dan panitera pengganti - yang memang menyusun draf putusan).
 * "Dikoreksi majelis" (butir 36, 17 Okt): HANYA ketua/anggota majelis perkara
 * itu (bolehKoreksiMajelis) - PP ditolak 403 walau boleh menyusun draf.
 * Langkah bersyarat (butir 35): Putusan sela, Eksepsi, Rekonvensi muncul bila
 * keadaan perkaranya terbaca dari bot (SELECT saja).
 * Hanya basis data ALETA yang ditulis; SIPP dan ABT tidak disentuh.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const daftar = String(request.nextUrl.searchParams.get("perkaraId") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (daftar.length === 0) return ok({ ada: true, peta: {} });
    // Butir 35-36: keadaan perkara (langkah bersyarat) + hak "Dikoreksi majelis" akun ini.
    const keadaan = await bacaKeadaanKonseptor(daftar);
    const hak = hakKoreksiUntuk(aktor, daftar, keadaan.peta);
    const peta = await bacaKemajuanKonseptor(db, daftar, {
      keadaan: keadaan.terbaca ? keadaanDariBot(keadaan.peta) : undefined,
      hakKoreksi: Object.fromEntries(Object.entries(hak).map(([pid, h]) => [pid, h.boleh])),
    });
    // F4.2: draf H-7 dari agen (blangko, kesiapan, isian yang perlu manusia) ikut,
    // supaya konseptor melihatnya di kartu checklist yang sama. Tabel 0068 belum
    // terpasang = tanpa draf, checklist tetap terbaca.
    let drafH7: Record<string, unknown> = {};
    try {
      drafH7 = await bacaDrafRingkasUntukChecklist(db, daftar);
    } catch {
      drafH7 = {};
    }
    return ok({ ada: true, peta, drafH7, keadaanTerbaca: keadaan.terbaca });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONSEPTOR_LANGKAH_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "konseptor-langkah",
    });
  }
}

type Masukan = {
  perkaraId?: string;
  nomorPerkara?: string;
  langkah?: string;
  selesai?: boolean;
  catatan?: string;
  lapor?: { berkas?: string; isian?: IsianBlangkoLapor[] };
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "putusan.draf"); // HAK-PERAN: penyusun draf putusan

    const masukan = (await request.json().catch(() => ({}))) as Masukan;
    const perkaraId = String(masukan.perkaraId ?? "");
    const oleh = aktor.name || String(actorUserId ?? "petugas");
    const keadaan = await bacaKeadaanKonseptor([perkaraId]);
    const hak = hakKoreksiUntuk(aktor, [perkaraId], keadaan.peta)[perkaraId] ?? { boleh: false, alasan: "" };
    // Butir 36 (17 Okt): "Dikoreksi majelis" hanya ketua/anggota majelis - dijaga di sini, bukan hanya di layar.
    if (!masukan.lapor && String(masukan.langkah ?? "") === "koreksi" && !hak.boleh) {
      return Response.json({ ok: false, error: { message: hak.alasan }, data: { ok: false, alasan: hak.alasan } }, { status: 403 });
    }

    const hasil = masukan.lapor
      ? await simpanLaporBlangko(db, {
          perkaraId,
          nomorPerkara: String(masukan.nomorPerkara ?? ""),
          berkas: String(masukan.lapor.berkas ?? ""),
          isian: Array.isArray(masukan.lapor.isian) ? masukan.lapor.isian : [],
          oleh,
        })
      : await simpanTandaLangkah(db, {
          perkaraId,
          langkah: String(masukan.langkah ?? ""),
          selesai: masukan.selesai === true,
          catatan: String(masukan.catatan ?? ""),
          oleh,
        });
    if (!hasil.ok) return ok(hasil);
    const peta = await bacaKemajuanKonseptor(db, [perkaraId], {
      keadaan: keadaan.terbaca ? keadaanDariBot(keadaan.peta) : undefined,
      hakKoreksi: { [perkaraId]: hak.boleh },
    });
    return ok({ ...hasil, kemajuan: peta[perkaraId] ?? null });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KONSEPTOR_LANGKAH_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "konseptor-langkah",
    });
  }
}
