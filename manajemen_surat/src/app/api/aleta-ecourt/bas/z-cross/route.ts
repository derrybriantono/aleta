import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { kenaliBerkasWord } from "@/server/modules/aleta-ecourt/bas-word-pdf";
import { BATAS_KONVERSI } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { bacaKonteksBas, catatRunut, pasangRunut } from "@/server/modules/aleta-ecourt/bas-halaman/layanan";
import { bacaOpsiBukti, peringatanZcross, pilihMesinPortal, sesuaikanZcrossOtomatis } from "@/server/modules/aleta-ecourt/zcross/pakai";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  rtf: "application/rtf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pdf: "application/pdf",
};

/**
 * Z CROSS OTOMATIS untuk BAS - dipanggil ekstensi tiap BAS dicetak / diunduh (RTF, DOCX, DOC, PDF) tanpa tombol tambahan.
 *
 *   POST multipart: berkas (RTF/DOCX/DOC, <= 20 MB), keluar ("rtf" | "docx" | "doc" | "pdf"; bawaan = bentuk berkas),
 *                   jumlahBukti (angka, opsional), halamanBukti ("2,1,3" jumlah halaman tiap bukti, opsional), tanggal (opsional)
 *   -> { berkasBase64, bentuk, mime, diubah, alasan, laporan, peringatan[] }
 *
 * Tidak ada tulisan ke SIPP/ABT. Naskah tanpa bentuk "SC Z" (atau bila mesin gagal) dikembalikan APA ADANYA supaya cetak/unduh tidak pernah
 * tertahan oleh Z. Cukup akun yang masuk.
 *
 * NOMOR HALAMAN RUNUT (1 Nov 2026, keputusan 71): ruas perkaraId / nomorPerkara, sidangId, tanggalSidang, sidang (JSON daftar sidang panel)
 * - bila kosong perkara & sidang dikenali dari naskah. Halaman awal BAS = halaman terakhir BAS sidang sebelumnya + 1 (tabel portal
 * aleta_bas_halaman) dipasang SEBELUM Z; sesudahnya jumlah halaman dihitung (render PDF) dan halaman terakhir BAS ini dicatat
 * (catat = "0" bila pemanggil juga meminta PDF yang dicatat rute PDF). -> ruas runut { awal, akhir } + peringatan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    let formulir: FormData;
    try {
      formulir = await request.formData();
    } catch {
      throw new ApiError(400, "Kirim multipart/form-data dengan ruas berkas.");
    }
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) throw new ApiError(400, "Berkasnya belum dipilih.");
    if (berkas.size > BATAS_KONVERSI) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_KONVERSI / 1024 / 1024} MB.`);
    const bita = new Uint8Array(await berkas.arrayBuffer());
    const bentuk = kenaliBerkasWord(bita);
    if (bentuk !== "rtf" && bentuk !== "docx" && bentuk !== "doc") {
      throw new ApiError(400, bentuk === "pdf" ? "Berkas ini sudah PDF; Z dipasang pada naskah Word sebelum diubah ke PDF." : "Isinya bukan berkas Word (RTF, DOCX, atau DOC) - dikenali dari isi berkasnya, bukan dari namanya.");
    }
    const keluarMinta = String(formulir.get("keluar") ?? "").trim().toLowerCase();
    const keluar = (["rtf", "docx", "doc", "pdf"] as const).find((k) => k === keluarMinta) ?? bentuk;
    const tanggal = String(formulir.get("tanggal") ?? "").trim().slice(0, 40) || undefined;

    const konteks =
      bacaKonteksBas({
        perkaraId: formulir.get("perkaraId"),
        nomorPerkara: formulir.get("nomorPerkara"),
        sidangId: formulir.get("sidangId"),
        tanggalSidang: formulir.get("tanggalSidang"),
        sidang: formulir.get("sidang"),
      }) ?? {};
    const runutMati = String(formulir.get("runut") ?? "") === "0";
    const r = runutMati ? null : await pasangRunut(db, bita, bentuk, konteks);
    const hasil = await sesuaikanZcrossOtomatis(r ? r.bita : bita, r ? r.bentuk : bentuk, { keluar, tanggal, ...bacaOpsiBukti(formulir.get("jumlahBukti"), formulir.get("halamanBukti")), ...(r?.opsiZ ?? {}) });
    const peringatan = [...(r?.peringatan ?? []), ...peringatanZcross(hasil.laporan)];
    let runut: { awal: number; akhir: number } | null = null;
    if (r?.rencana) {
      runut = { awal: r.rencana.awal, akhir: 0 };
      if (String(formulir.get("catat") ?? "1") !== "0") {
        // KINERJA (arahan 1 Nov): halaman terakhir dihitung & dicatat DI LATAR - unduhan tidak menunggu render hitung halaman.
        // PDF ukur lampiran dipakai ulang bila Z tidak mengubah naskah; BAS yang sama persis dengan catatan tidak dirender lagi.
        const rencana = r.rencana;
        const pdfUkur = r.pdfUkur ?? null;
        const dbLatar = db;
        void catatRunut(dbLatar, rencana, {
          pdf: hasil.bentuk === "pdf" ? hasil.bita : null,
          pdfUkur,
          naskah: hasil.bentuk === "pdf" ? undefined : { bita: hasil.bita, bentuk: hasil.bentuk, mesin: pilihMesinPortal() },
          z: hasil.laporan,
          sumber: "unduh",
          olehId: String(actorUserId ?? ""),
        }).catch(() => undefined);
      }
    }
    return ok({
      berkasBase64: Buffer.from(hasil.bita).toString("base64"),
      byte: hasil.bita.length,
      bentuk: hasil.bentuk,
      mime: MIME[hasil.bentuk],
      diubah: hasil.laporan.diubah || Boolean(r?.rencana),
      alasan: hasil.laporan.alasan,
      laporan: hasil.laporan,
      runut,
      peringatan,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_ZCROSS_GAGAL",
      feature: "aleta_ecourt",
      entityId: "bas-z-cross",
    });
  }
}
