import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { auditSinkron, pastikanAdminSinkron } from "@/server/modules/sinkron/akses";
import { periksaSumberBot } from "@/server/modules/sinkron/bot-dump";
import {
  KlienDrive,
  mulaiPersetujuanPerangkat,
  periksaPersetujuanPerangkat,
} from "@/server/modules/sinkron/drive";
import { buatKlienDrive, folderInduk } from "@/server/modules/sinkron/drive-cadangan";
import {
  bacaPengaturan,
  buatTokenLaptop,
  cabutTokenLaptop,
  rahasiaDrive,
  tulisPengaturan,
} from "@/server/modules/sinkron/pengaturan";
import { hentikanTugas, jalankanTugas, tugasBerjalan } from "@/server/modules/sinkron/penjadwal";
import { saringRahasia, type JenisTugas } from "@/server/modules/sinkron/riwayat";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { encryptCredentialSecret } from "@/server/shared/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tindakan layar Sinkron & cadangan - SEMUANYA hanya Super Admin:
 *
 *   jalankan       { tugas: "cadangan" | "drive-cadangan" | "drive-berkas" }
 *                  mulai di latar; kemajuannya dibaca lewat GET /api/admin/sinkron
 *   hentikan       menghentikan tugas yang berjalan
 *   uji            sambungan bot (MySQL) dan Google Drive
 *   oauth-mulai    meminta kode perangkat Google
 *   oauth-periksa  memeriksa apakah kode sudah disetujui
 *   oauth-putus    melupakan refresh token
 *   token-buat     { label } -> token laptop, DIPERLIHATKAN SEKALI
 *   token-cabut    { id }
 */

const TUGAS: JenisTugas[] = ["cadangan", "drive-cadangan", "drive-berkas"];

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const { actor } = await pastikanAdminSinkron(db, actorUserId, true);
    const oleh = actor.name || actor.id;
    const isi = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const aksi = String(isi.aksi || "");

    if (aksi === "jalankan") {
      const tugas = String(isi.tugas || "") as JenisTugas;
      if (!TUGAS.includes(tugas)) throw new ApiError(400, "Tugas tidak dikenal.");
      const berjalan = tugasBerjalan();
      if (berjalan) throw new ApiError(409, "Tugas sinkron lain sedang berjalan. Tunggu sampai selesai atau hentikan.");
      await auditSinkron(db, "SINKRON_DIJALANKAN", actor.id, { entityId: tugas, tugas });
      // Di latar: dump SIPP penuh dapat berjalan puluhan menit, jauh melewati
      // batas 120 detik nginx. Layar membaca kemajuannya lewat GET.
      void jalankanTugas(tugas, { pemicu: "manual", olehId: actor.id, olehNama: oleh }, db).catch((galat) =>
        console.error("[sinkron] tugas gagal:", saringRahasia(galat))
      );
      return ok({ dimulai: true, tugas });
    }

    if (aksi === "hentikan") {
      const berhenti = hentikanTugas();
      await auditSinkron(db, "SINKRON_DIHENTIKAN", actor.id, { berhenti });
      return ok({ berhenti });
    }

    if (aksi === "uji") {
      const hasil: Record<string, unknown> = {};
      try {
        hasil.bot = { ok: true, ...(await periksaSumberBot()) };
      } catch (galat) {
        hasil.bot = { ok: false, error: saringRahasia(galat) };
      }
      const p = await bacaPengaturan();
      if (p.drive.metode === "akun-layanan" ? p.drive.akunLayanan.jsonTersandi : p.drive.oauth.refreshTokenTersandi) {
        try {
          const klien = buatKlienDrive(p);
          const saya = await klien.tentang();
          const induk = await folderInduk(klien, p);
          hasil.drive = { ok: true, akun: saya.email, kuotaByte: saya.kuotaByte, terpakaiByte: saya.terpakaiByte, folderInduk: induk };
        } catch (galat) {
          hasil.drive = { ok: false, error: saringRahasia(galat) };
        }
      } else {
        hasil.drive = { ok: false, error: "Google Drive belum tersambung." };
      }
      await auditSinkron(db, "SINKRON_UJI_SAMBUNGAN", actor.id, {
        bot: (hasil.bot as { ok: boolean }).ok,
        drive: (hasil.drive as { ok: boolean }).ok,
      });
      return ok(hasil);
    }

    if (aksi === "oauth-mulai") {
      const p = await bacaPengaturan();
      if (!p.drive.oauth.clientId || !p.drive.oauth.clientSecretTersandi) {
        throw new ApiError(400, "Simpan Client ID dan Client secret lebih dulu.");
      }
      const kode = await mulaiPersetujuanPerangkat(p.drive.oauth.clientId).catch((galat) => {
        throw new ApiError(400, saringRahasia(galat));
      });
      p.drive.oauth.perangkat = {
        deviceCodeTersandi: encryptCredentialSecret(kode.deviceCode),
        userCode: kode.userCode,
        alamatVerifikasi: kode.alamatVerifikasi,
        kedaluwarsa: kode.kedaluwarsa,
        jedaDetik: kode.jedaDetik,
      };
      await tulisPengaturan(p);
      await auditSinkron(db, "SINKRON_DRIVE_MINTA_PERSETUJUAN", actor.id, {});
      return ok({ userCode: kode.userCode, alamatVerifikasi: kode.alamatVerifikasi, kedaluwarsa: kode.kedaluwarsa, jedaDetik: kode.jedaDetik });
    }

    if (aksi === "oauth-periksa") {
      const p = await bacaPengaturan();
      const r = rahasiaDrive(p);
      if (!p.drive.oauth.perangkat || !r.deviceCode) throw new ApiError(400, "Belum ada permintaan kode perangkat. Tekan \"Sambungkan\" lebih dulu.");
      const hasil = await periksaPersetujuanPerangkat({ clientId: p.drive.oauth.clientId, clientSecret: r.clientSecret, deviceCode: r.deviceCode }).catch(
        (galat) => {
          throw new ApiError(400, saringRahasia(galat));
        }
      );
      if (hasil.keadaan === "berhasil") {
        const token = hasil.accessToken;
        const klien = new KlienDrive({ ambil: async () => token });
        const saya = await klien.tentang().catch(() => ({ email: "" }));
        p.drive.oauth.refreshTokenTersandi = encryptCredentialSecret(hasil.refreshToken);
        p.drive.oauth.akun = saya.email;
        p.drive.oauth.perangkat = null;
        await tulisPengaturan(p);
        await auditSinkron(db, "SINKRON_DRIVE_TERSAMBUNG", actor.id, { akun: saya.email });
        return ok({ keadaan: "berhasil", akun: saya.email });
      }
      if (hasil.keadaan === "ditolak" || hasil.keadaan === "kedaluwarsa") {
        p.drive.oauth.perangkat = null;
        await tulisPengaturan(p);
      }
      return ok({ keadaan: hasil.keadaan });
    }

    if (aksi === "oauth-putus") {
      const p = await bacaPengaturan();
      p.drive.oauth.refreshTokenTersandi = "";
      p.drive.oauth.akun = "";
      p.drive.oauth.perangkat = null;
      await tulisPengaturan(p);
      await auditSinkron(db, "SINKRON_DRIVE_DIPUTUS", actor.id, {});
      return ok({ terputus: true });
    }

    if (aksi === "token-buat") {
      let hasil;
      try {
        hasil = buatTokenLaptop(await bacaPengaturan(), String(isi.label || ""), oleh);
      } catch (galat) {
        throw new ApiError(400, (galat as Error).message);
      }
      await tulisPengaturan(hasil.pengaturan);
      const baru = hasil.pengaturan.laptop.token[hasil.pengaturan.laptop.token.length - 1];
      await auditSinkron(db, "SINKRON_TOKEN_LAPTOP_DIBUAT", actor.id, { entityId: baru.id, label: baru.label });
      // Satu-satunya saat tokennya keluar dari server. Yang tersimpan hanya sidiknya.
      return ok({ id: baru.id, label: baru.label, token: hasil.token });
    }

    if (aksi === "token-cabut") {
      let p;
      try {
        p = cabutTokenLaptop(await bacaPengaturan(), String(isi.id || ""));
      } catch (galat) {
        throw new ApiError(404, (galat as Error).message);
      }
      await tulisPengaturan(p);
      await auditSinkron(db, "SINKRON_TOKEN_LAPTOP_DICABUT", actor.id, { entityId: String(isi.id || "") });
      return ok({ dicabut: true });
    }

    throw new ApiError(400, "Tindakan tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
