import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  BATAS_PERAMBAN_MS,
  bacaJejakLoginWa,
  bacaJejakPengguna,
  catatJejakAksi,
  kalimatAlasan,
  panggilBot,
  sinkronLoginWa,
} from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { periksaAkunSippTerbuka } from "@/server/modules/aleta-ecourt/ecourt-akun-pengguna";
import { usernameSippDariPermintaan } from "@/server/modules/aleta-ecourt/ecourt-menu-sipp";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SesiBaris = {
  peran: string;
  sebutanPeran: string;
  namaAkunEcourt: string;
  tersambungPada: string;
  terakhirDipakai: string;
  diperiksaPada: string;
  keadaan: "tersambung" | "kedaluwarsa" | "terputus";
  kedaluwarsaPada: string;
};

/** Akun e-Court tersimpan milik pengguna (butir 20) - surel, TANPA sandi. */
type AkunBaris = {
  peran: string;
  email: string;
  adaSandi: boolean;
  diperbaruiPada: string;
  diujiPada: string;
  hasilUji: string;
  /** G4 (30 Okt 2026): nama Super Admin/Admin yang mengisi akun ini untuk pemiliknya; kosong = diisi sendiri. */
  diisiOleh?: string;
};

/**
 * Sesi e-Court PRIBADI pengguna yang sedang login (perbaikan 1 Okt 2026, E10)
 * dan akun e-Court miliknya yang tersimpan (butir 20, 5 Okt 2026). Tanpa
 * cookie dan tanpa sandi - keduanya tidak pernah keluar dari bot.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    // Menu "E-Court" di bilah atas SIPP (?dariSipp=1): akun SIPP yang terbuka di peramban ini tidak boleh
    // tertaut ke pengguna ALETA lain - lihat ecourt-menu-sipp.ts. Tanpa parameter, perilaku GET tidak berubah.
    if (request.nextUrl.searchParams.get("dariSipp") === "1") {
      const sipp = await periksaAkunSippTerbuka(db, actor.id, await usernameSippDariPermintaan(request.headers));
      if (!sipp.ok) {
        return ok({ tersedia: false, alasan: sipp.alasan, pesan: kalimatAlasan(sipp.alasan), sesi: [], akun: [], peranTersedia: [], jejak: [] });
      }
    }
    const hasil = await panggilBot<{
      sesi: SesiBaris[];
      akun?: AkunBaris[];
      peranTersedia: Array<{ kode: string; sebutan: string }>;
    }>(`/ecourt-pengguna/sesi?penggunaId=${encodeURIComponent(actor.id)}`);
    const jejak = await bacaJejakPengguna(db, actor.id, 20).catch(() => []);
    // Riwayat login e-Court lewat WhatsApp (0074): HANYA Super Admin dan Admin. Disinkronkan dari
    // jejak keamanan bot saat dibuka (idempoten); selain keduanya kuncinya tidak ikut dikirim.
    let jejakWa: Awaited<ReturnType<typeof bacaJejakLoginWa>> | undefined;
    if (isPrivilegedAdmin(actor)) {
      await sinkronLoginWa(db).catch(() => null);
      jejakWa = await bacaJejakLoginWa(db, 30).catch(() => []);
    }
    if (!hasil.ok) {
      return ok({
        tersedia: false,
        pesan: kalimatAlasan(hasil.alasan),
        sesi: [],
        akun: [],
        peranTersedia: [],
        jejak,
        ...(jejakWa ? { jejakWa } : {}),
      });
    }
    return ok({
      tersedia: true,
      pesan: "",
      ...(jejakWa ? { jejakWa } : {}),
      pengguna: { id: actor.id, nama: actor.name },
      sesi: hasil.data.sesi ?? [],
      // Bot lama (sebelum butir 20) tidak mengirim `akun`: layar menyebut
      // "belum didukung server" alih-alih pura-pura kosong.
      akun: (hasil.data.akun ?? []).map((a) => ({
        peran: String(a.peran),
        email: String(a.email ?? ""),
        adaSandi: Boolean(a.adaSandi),
        diperbaruiPada: String(a.diperbaruiPada ?? ""),
        diujiPada: String(a.diujiPada ?? ""),
        hasilUji: String(a.hasilUji ?? ""),
        diisiOleh: String(a.diisiOleh ?? ""),
      })),
      akunDidukung: Array.isArray(hasil.data.akun),
      peranTersedia: hasil.data.peranTersedia ?? [],
      jejak,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SESI_PRIBADI_READ_FAILED",
      feature: "ecourt_sesi_pribadi",
      entityId: "sesi",
    });
  }
}

/**
 * aksi: "mulai" | "kirim" | "periksa" | "keluar" | "simpan-akun" | "hapus-akun".
 *
 * BADAN PERMINTAAN "kirim" DAN "simpan-akun" MEMUAT SANDI e-COURT. Tidak satu
 * bagiannya pun dicatat; galat yang keluar dari rute ini diganti kalimat
 * umum. penggunaId SELALU akun yang login - pengguna hanya dapat menyimpan,
 * menguji, dan menghapus akun e-Court MILIKNYA SENDIRI.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const body = (await request.json().catch(() => ({}))) as {
      aksi?: string;
      peran?: string;
      email?: string;
      sandi?: string;
      captcha?: string;
      pakaiTersimpan?: boolean;
      simpanAkun?: boolean;
    };
    const peran = String(body.peran || "");
    const ip = alamatIpPeramban(request);

    if (body.aksi === "mulai") {
      const hasil = await panggilBot<{ ok: boolean; alasan?: string; captcha?: string; adaCaptcha?: boolean; akunTersimpan?: string }>(
        "/ecourt-pengguna/login/mulai",
        { method: "POST", body: { penggunaId: actor.id, peran }, batasMs: BATAS_PERAMBAN_MS }
      );
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.alasan, pesan: kalimatAlasan(hasil.alasan) });
      return ok({ ...hasil.data, pesan: kalimatAlasan(hasil.data.alasan) });
    }

    if (body.aksi === "kirim") {
      const sandi = String(body.sandi || "");
      const pakaiTersimpan = body.pakaiTersimpan === true;
      const hasil = await panggilBot<{ ok: boolean; alasan?: string; namaAkunEcourt?: string; akunDisimpan?: boolean }>(
        "/ecourt-pengguna/login/kirim",
        {
          method: "POST",
          body: {
            penggunaId: actor.id,
            peran,
            namaPengguna: actor.name,
            // Uji masuk dengan akun tersimpan: surel dan sandi diambil BOT dari
            // simpanan milik penggunaId ini - portal tidak pernah melihatnya.
            email: pakaiTersimpan ? "" : String(body.email || ""),
            sandi: pakaiTersimpan ? "" : sandi,
            captcha: String(body.captcha || ""),
            pakaiTersimpan,
            simpanAkun: !pakaiTersimpan && body.simpanAkun === true,
          },
          batasMs: BATAS_PERAMBAN_MS,
        }
      );
      body.sandi = "";
      const berhasil = hasil.ok && hasil.data.ok;
      // Alasan dari bot/e-Court disapu: pesan penolakan dapat memantulkan isian.
      const sapuSandi = (teks: unknown) => (sandi ? String(teks ?? "").split(sandi).join("***") : String(teks ?? ""));
      const alasan = sapuSandi(hasil.ok ? String(hasil.data.alasan || "") : hasil.alasan);
      await catatJejakAksi(
        db,
        {
          penggunaId: actor.id,
          penggunaNama: actor.name,
          aksi: "sambung",
          peranEcourt: peran,
          akunEcourt: hasil.ok ? String(hasil.data.namaAkunEcourt || "") : "",
          sasaran: pakaiTersimpan ? "uji masuk akun tersimpan" : hasil.ok && hasil.data.akunDisimpan ? "akun disimpan" : "",
          hasil: berhasil ? "berhasil" : "gagal",
          alasan,
          alamatIp: ip,
        },
        [sandi]
      ).catch(() => undefined);
      return ok({
        ok: berhasil,
        alasan,
        pesan: kalimatAlasan(alasan),
        namaAkunEcourt: hasil.ok ? sapuSandi(hasil.data.namaAkunEcourt || "") : "",
        akunDisimpan: Boolean(hasil.ok && hasil.data.akunDisimpan),
      });
    }

    if (body.aksi === "simpan-akun") {
      const sandi = String(body.sandi || "");
      const hasil = await panggilBot<{ ok: boolean; alasan?: string }>("/ecourt-pengguna/akun/simpan", {
        method: "POST",
        body: {
          penggunaId: actor.id,
          peran,
          namaPengguna: actor.name,
          email: String(body.email || ""),
          sandi,
          olehSiapa: `portal:${actor.id}`,
        },
      });
      body.sandi = "";
      const berhasil = hasil.ok && hasil.data.ok;
      const sapuSandi = (teks: unknown) => (sandi ? String(teks ?? "").split(sandi).join("***") : String(teks ?? ""));
      const alasan = sapuSandi(hasil.ok ? String(hasil.data.alasan || "") : hasil.alasan);
      if (berhasil) {
        // Yang dicatat perbuatannya, bukan isinya: tanpa surel, tanpa sandi.
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: actor.id,
          action: "ECOURT_AKUN_PRIBADI_DISIMPAN",
          entityType: "ecourt_akun_pribadi",
          entityId: peran || "-",
          payload: { peran, sandiDiganti: Boolean(sandi), alamatIp: ip },
        }).catch(() => undefined);
      }
      return ok({ ok: berhasil, alasan, pesan: berhasil ? "Akun e-Court tersimpan." : kalimatAlasan(alasan) });
    }

    if (body.aksi === "hapus-akun") {
      const hasil = await panggilBot<{ ok: boolean; alasan?: string }>("/ecourt-pengguna/akun/hapus", {
        method: "POST",
        body: { penggunaId: actor.id, peran, olehSiapa: `portal:${actor.id}` },
      });
      const alasan = hasil.ok ? String(hasil.data.alasan || "") : hasil.alasan;
      const berhasil = hasil.ok && hasil.data.ok;
      if (berhasil) {
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: actor.id,
          action: "ECOURT_AKUN_PRIBADI_DIHAPUS",
          entityType: "ecourt_akun_pribadi",
          entityId: peran || "-",
          payload: { peran, alamatIp: ip },
        }).catch(() => undefined);
      }
      return ok({ ok: berhasil, alasan, pesan: berhasil ? "Akun e-Court dihapus dari ALETA." : kalimatAlasan(alasan) });
    }

    if (body.aksi === "periksa" || body.aksi === "keluar") {
      const jalur = body.aksi === "periksa" ? "/ecourt-pengguna/periksa" : "/ecourt-pengguna/keluar";
      const hasil = await panggilBot<{ ok: boolean; alasan?: string; berlaku?: boolean | null; namaAkunEcourt?: string }>(
        jalur,
        { method: "POST", body: { penggunaId: actor.id, peran }, batasMs: BATAS_PERAMBAN_MS }
      );
      const alasan = hasil.ok ? String(hasil.data.alasan || "") : hasil.alasan;
      await catatJejakAksi(db, {
        penggunaId: actor.id,
        penggunaNama: actor.name,
        aksi: body.aksi === "periksa" ? "periksa" : "putus",
        peranEcourt: peran,
        hasil: hasil.ok && hasil.data.ok ? "berhasil" : "gagal",
        alasan,
        alamatIp: ip,
      }).catch(() => undefined);
      if (!hasil.ok) return ok({ ok: false, alasan, pesan: kalimatAlasan(alasan) });
      return ok({ ...hasil.data, pesan: kalimatAlasan(alasan) });
    }

    return ok({ ok: false, alasan: "aksi_tidak_dikenali", pesan: "Aksi tidak dikenali." });
  } catch (error) {
    // Pesan galat asli sengaja tidak diteruskan: badan permintaan memuat sandi.
    return handleAdminRouteError(error instanceof ApiError ? error : new Error("Permintaan sesi e-Court pribadi gagal diproses."), request, {
      db,
      actorUserId,
      action: "ECOURT_SESI_PRIBADI_FAILED",
      feature: "ecourt_sesi_pribadi",
      entityId: "sesi",
    });
  }
}
