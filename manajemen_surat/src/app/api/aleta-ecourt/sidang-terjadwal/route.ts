import { type NextRequest } from "next/server";

import { BATAS_SIDANG } from "@/lib/sidang-terjadwal";
import { getDatabase } from "@/server/db/client";
import { buatTerjadwal, daftarTerjadwal, kelolaTerjadwal, type BerkasMasuk } from "@/server/modules/sidang-terjadwal/layanan";
import { pelaksanaNyala } from "@/server/modules/sidang-terjadwal/pelaksana";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * UNGGAH BAS TERJADWAL & TUNDAAN TERJADWAL (27 Okt 2026)
 * ============================================================================
 *
 *   GET   ?jenis=bas|tunda &aktif=1 &semua=1 &jadwalId=<id>
 *           -> { ok, butir[], pelaksanaNyala }   (milik sendiri; semua=1 hanya Super Admin/Admin)
 *   POST  JSON (tunda)   { jenis:"tunda", mulai, jedaMin?, jedaMaks?, butir:[{ jadwalId, perkaraId, nomorPerkara, tanggalSidang,
 *                          alasanTunda, tanggalBerikut, jamBerikut, agendaBerikut, ... }] }
 *         multipart (bas) jenis=bas, mulai, jedaMin?, jedaMaks?, butir=<JSON [{ perkaraId, sidangId, nomorPerkara, tanggalSidang,
 *                          berkas:"<nama field>", ganti? }]> + satu field berkas per butir
 *           -> { ok:true, butir:[{ id, nomorPerkara, waktuWita }], perkiraanSelesai, peringatan[] }
 *           -> { ok:false, sebab, tolak:[{ nomorPerkara, sebab }] }   (SEMUA ditolak bila ada satu yang tidak sah)
 *   PATCH JSON { aksi:"batal"|"jadwal-ulang"|"ulang", id, wita? } -> { ok:true, butir, ringkas }
 *
 * Menjadwalkan TIDAK menulis ke SIPP: penulisan dikerjakan pelaksana di server pada waktunya (detak 30 detik).
 * Hak sama dengan rute langsungnya - sidang-tunda (panel + sidang.tunda-putus) dan bas/unggah-sipp (panel +
 * golongan BAS, PP hanya perkaranya sendiri) - dan dinilai lagi saat dijalankan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const q = request.nextUrl.searchParams;
    const hasil = await daftarTerjadwal(db, actorUserId ?? "", {
      jenis: q.get("jenis") ?? undefined,
      aktif: q.get("aktif") === "1",
      semua: q.get("semua") === "1",
      jadwalId: q.get("jadwalId") ?? undefined,
      batas: Number(q.get("batas")) || undefined,
    });
    return ok({ ok: true, ...hasil, pelaksanaNyala: pelaksanaNyala() });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_TERJADWAL_DAFTAR_GAGAL",
      feature: "aleta_ecourt",
      entityId: "sidang-terjadwal",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const ip = alamatIpPeramban(request);

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const formulir = await request.formData();
      let butir: unknown;
      try {
        butir = JSON.parse(String(formulir.get("butir") ?? "[]"));
      } catch {
        return ok({ ok: false, sebab: "Daftar sidang tidak terbaca.", tolak: [] });
      }
      // Berkas dibaca ke memori hanya yang disebut butir, dan ukurannya diperiksa SEBELUM dibaca.
      const berkas: Record<string, BerkasMasuk> = {};
      let total = 0;
      for (const b of Array.isArray(butir) ? butir : []) {
        const nama = String((b as { berkas?: unknown })?.berkas ?? "").trim();
        if (!nama || berkas[nama]) continue;
        const file = formulir.get(nama);
        if (!(file instanceof File)) continue;
        const nomor = String((b as { nomorPerkara?: unknown })?.nomorPerkara ?? "") || nama;
        if (file.size > BATAS_SIDANG.ukuranBerkas) {
          return ok({ ok: false, sebab: `${nomor}: berkas BAS melampaui 10 MB.`, tolak: [{ nomorPerkara: nomor, sebab: "Berkas BAS melampaui 10 MB." }] });
        }
        total += file.size;
        if (total > BATAS_SIDANG.ukuranTotal) {
          return ok({ ok: false, sebab: `Seluruh berkas dalam satu permintaan melampaui ${Math.round(BATAS_SIDANG.ukuranTotal / 1024 / 1024)} MB. Jadwalkan dalam beberapa kali.`, tolak: [] });
        }
        berkas[nama] = { nama: file.name, bita: new Uint8Array(await file.arrayBuffer()) };
      }
      const hasil = await buatTerjadwal(db, actorUserId ?? "", ip, {
        jenis: String(formulir.get("jenis") ?? "bas"),
        mulai: String(formulir.get("mulai") ?? ""),
        jedaMin: formulir.get("jedaMin") ?? undefined,
        jedaMaks: formulir.get("jedaMaks") ?? undefined,
        akunSipp: formulir.get("akunSipp") ?? undefined,
        butir,
        berkas,
      });
      return ok(hasil);
    }

    const badan = await readJsonBody<Record<string, unknown>>(request);
    const hasil = await buatTerjadwal(db, actorUserId ?? "", ip, {
      jenis: badan.jenis ?? "tunda",
      mulai: badan.mulai,
      jedaMin: badan.jedaMin,
      jedaMaks: badan.jedaMaks,
      akunSipp: badan.akunSipp,
      butir: badan.butir,
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_TERJADWAL_BUAT_GAGAL",
      feature: "aleta_ecourt",
      entityId: "sidang-terjadwal",
    });
  }
}

export async function PATCH(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await readJsonBody<{ aksi?: unknown; id?: unknown; wita?: unknown }>(request);
    const hasil = await kelolaTerjadwal(db, actorUserId ?? "", { aksi: badan.aksi, id: badan.id, wita: badan.wita });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_TERJADWAL_KELOLA_GAGAL",
      feature: "aleta_ecourt",
      entityId: "sidang-terjadwal",
    });
  }
}
