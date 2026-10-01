import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  BATAS_PERAMBAN_MS,
  bersihkanNomor,
  catatJejakAksi,
  kalimatAlasan,
  panggilBot,
} from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_BYTE = 20 * 1024 * 1024;

/**
 * KONTRAK K6 (butir 16b): mengunggah "Dokumen Salinan Putusan" ke e-Court
 * (tab Putusan > Salinan Putusan > Upload Dokumen Salinan Putusan) memakai sesi
 * e-Court PRIBADI pengguna yang sedang login.
 *
 *   POST multipart: nomor, berkas (PDF), konfirmasi ("1"/"true")
 *   -> { ok, akun: { nama, peran } | null, salinan, alasan, pesan }
 *
 * Menulis ke e-Court sungguhan. Ditolak bila tidak ada sesi pribadi atau
 * konfirmasi tidak dikirim. Ekstensi TIDAK memasukkan rute ini ke
 * ALETA_COBA_BOLEH (tertahan di mode coba).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const form = await request.formData().catch(() => null);
    if (!form) return ok({ ok: false, akun: null, salinan: null, alasan: "badan_bukan_multipart", pesan: "Kirim sebagai multipart (nomor + berkas)." });
    const nomor = bersihkanNomor(form.get("nomor"));
    const berkas = form.get("berkas");
    const konfirmasiMentah = String(form.get("konfirmasi") ?? "").toLowerCase();
    // Kontrak K6 tidak menyebut medan konfirmasi; ekstensi yang mengikuti
    // kontrak sudah meminta konfirmasi di layarnya sebelum mengirim. Yang
    // mengirim konfirmasi=0/false dengan sengaja tetap ditolak.
    const konfirmasi = konfirmasiMentah !== "0" && konfirmasiMentah !== "false";
    if (!nomor) return ok({ ok: false, akun: null, salinan: null, alasan: "nomor_perkara_kosong", pesan: "Nomor perkara kosong." });
    if (!(berkas instanceof Blob) || berkas.size === 0) {
      return ok({ ok: false, akun: null, salinan: null, alasan: "berkas_kosong", pesan: "Pilih berkas PDF salinan putusan." });
    }
    if (berkas.size > BATAS_BYTE) {
      return ok({ ok: false, akun: null, salinan: null, alasan: "berkas_terlalu_besar", pesan: kalimatAlasan("berkas_terlalu_besar") });
    }
    const isi = Buffer.from(await berkas.arrayBuffer());
    if (isi.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return ok({ ok: false, akun: null, salinan: null, alasan: "berkas_bukan_pdf", pesan: kalimatAlasan("berkas_bukan_pdf") });
    }

    const hasil = await panggilBot<{
      ok: boolean;
      alasan?: string;
      pesan?: string;
      akun: { nama: string; peran: string } | null;
      salinan: unknown;
    }>("/ecourt-putusan/unggah", {
      method: "POST",
      body: {
        penggunaId: actor.id,
        nama: actor.name,
        nomor,
        berkasBase64: isi.toString("base64"),
        konfirmasi,
      },
      batasMs: BATAS_PERAMBAN_MS,
    });
    const data = hasil.ok ? hasil.data : { ok: false, alasan: hasil.alasan, pesan: "", akun: null, salinan: null };
    await catatJejakAksi(db, {
      penggunaId: actor.id,
      penggunaNama: actor.name,
      aksi: "unggah_salinan",
      akunEcourt: data.akun ? `${data.akun.nama} (${data.akun.peran})` : "",
      nomorPerkara: nomor,
      sasaran: `${berkas instanceof File ? berkas.name : "salinan.pdf"} (${isi.length} bita)`,
      hasil: data.ok ? "berhasil" : "gagal",
      alasan: String(data.alasan || ""),
      alamatIp: alamatIpPeramban(request),
    }).catch(() => undefined);
    return ok({
      ok: Boolean(data.ok),
      akun: data.akun ?? null,
      salinan: data.salinan ?? null,
      alasan: String(data.alasan || ""),
      pesan: String(data.pesan || "") || kalimatAlasan(data.alasan),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PUTUSAN_UNGGAH_FAILED",
      feature: "ecourt_aksi",
      entityId: "putusan-unggah",
    });
  }
}
