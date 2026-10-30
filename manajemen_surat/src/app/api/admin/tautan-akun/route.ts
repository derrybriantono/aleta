import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { panggilBot } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { getUsersFromDb } from "@/server/modules/organization/service";
import { panggilBotPengaturanAbt } from "@/server/modules/pengaturan-abt/gateway";
import {
  bacaKartuTautan,
  hapusEcourtPegawai,
  isiEcourtPegawai,
  tautkanSippPilihan,
  type DepsKartuTautan,
} from "@/server/modules/portal/kartu-tautan-akun";
import type { JawabanDaftarSipp } from "@/server/modules/portal/tautan-semua-sipp";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kartu tautan akun pegawai (G4, 30 Okt 2026) - aksi "tautan-akun.atur" (Super Admin & Admin).
 * Lihat server/modules/portal/kartu-tautan-akun.ts.
 *
 *   GET                                              -> kartu (tautan SIPP yang PASTI ditautkan otomatis lebih dulu)
 *   POST { aksi: "tautkan-sipp", userId, usernameSipp }
 *   POST { aksi: "isi-ecourt", penggunaId, peran, email, sandi }   BADAN MEMUAT SANDI e-COURT
 *   POST { aksi: "hapus-ecourt", penggunaId, peran }
 *
 * Sandi e-Court diteruskan sekali ke bot lalu dibuang - tidak pernah dikembalikan
 * dan tidak dicatat. Galat dari rute ini diganti kalimat umum.
 */
function deps(): DepsKartuTautan {
  return {
    daftarSipp: async () => (await callAletaBotSippBridge("user.daftarSipp", {}, { timeoutMs: 20_000 })) as JawabanDaftarSipp,
    rekapEcourt: async () => {
      const h = await panggilBot<{ akun?: never[]; sesi?: never[] }>("/ecourt-pengguna/rekap");
      return h.ok ? { ok: true, data: h.data as never } : { ok: false, alasan: h.alasan };
    },
    grupAbt: async () => {
      const h = await panggilBotPengaturanAbt<{ grup?: never[] }>("/grup-blangko", { timeoutMs: 8000 });
      return h.ok ? { ok: true, data: h.data as never } : { ok: false, alasan: h.error };
    },
    simpanEcourt: async (badan) => {
      const h = await panggilBot<{ ok?: boolean; alasan?: string }>("/ecourt-pengguna/akun/simpan", { method: "POST", body: badan });
      badan.sandi = "";
      return h.ok ? { ok: true, data: h.data } : { ok: false, alasan: h.alasan };
    },
    hapusEcourt: async (badan) => {
      const h = await panggilBot<{ ok?: boolean; alasan?: string }>("/ecourt-pengguna/akun/hapus", { method: "POST", body: badan });
      return h.ok ? { ok: true, data: h.data } : { ok: false, alasan: h.alasan };
    },
    pengguna: async (db) =>
      (await getUsersFromDb(db)).map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        nip: u.nip ?? null,
        roleId: u.roleId,
        positionId: u.positionId,
        additionalRoleIds: u.additionalRoleIds ?? [],
        isActive: u.isActive !== false,
      })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "tautan-akun.atur");
    return ok(await bacaKartuTautan(db, { id: actor.id, roleId: String(actor.roleId), name: actor.name }, deps()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "tautan-akun.atur");
    const aktor = { id: actor.id, roleId: String(actor.roleId), name: actor.name };
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const d = deps();
    if (badan.aksi === "tautkan-sipp") {
      return ok(await tautkanSippPilihan(db, aktor, { userId: String(badan.userId ?? ""), usernameSipp: String(badan.usernameSipp ?? "") }, d));
    }
    if (badan.aksi === "isi-ecourt") {
      const masukan = { penggunaId: badan.penggunaId, peran: badan.peran, email: badan.email, sandi: badan.sandi, alamatIp: alamatIpPeramban(request) };
      badan.sandi = "";
      try {
        return ok(await isiEcourtPegawai(db, aktor, masukan, d));
      } catch (galat) {
        // Pesan galat asli tidak diteruskan bila bukan ApiError: badan permintaan memuat sandi.
        throw galat instanceof ApiError ? galat : new ApiError(500, "Akun e-Court belum tersimpan.");
      }
    }
    if (badan.aksi === "hapus-ecourt") {
      return ok(await hapusEcourtPegawai(db, aktor, { penggunaId: badan.penggunaId, peran: badan.peran, alamatIp: alamatIpPeramban(request) }, d));
    }
    throw new ApiError(400, "Aksi tidak dikenali.");
  } catch (error) {
    return handleRouteError(error);
  }
}
