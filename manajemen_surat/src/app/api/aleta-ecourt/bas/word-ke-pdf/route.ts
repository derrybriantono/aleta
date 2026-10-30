import { type NextRequest } from "next/server";

import { ukuranUntukBot } from "@/lib/ukuran-ttd-cap";
import { getDatabase } from "@/server/db/client";
import { ambilGambarTandaTangan, getGatewayTandaTangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { BATAS_WORD_PDF, ubahKePdfLewatBot, wordKePdfBas } from "@/server/modules/aleta-ecourt/bas-word-pdf";
import { ukuranTtdCapBerlaku } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * BAS dari Word ke PDF bertanda tangan scan (30 Okt 2026) - untuk jendela e-Doc BAS di SIPP, yang hanya menerima PDF.
 *
 *   POST multipart: berkas (RTF/DOCX/DOC, <= 20 MB), ttd ("0" = tanpa tanda tangan; bawaan ya)
 *   -> { pdfBase64, namaBerkas, bentukAsal, blokTtd, penandatangan[], peringatan[] }
 *
 * Hanya menghitung: tidak ada yang disimpan dan tidak ada tulisan ke SIPP/ABT (ekstensi yang menaruh PDF di kotak berkas SIPP,
 * SIPP sendiri yang mengunggah). Cukup akun yang MASUK - sama dengan konversi-naskah; hak atas gambar tanda tangan ditegakkan
 * di modules/aleta-ecourt/bas-word-pdf.ts (admin: semua yang sah; lainnya: milik sendiri).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await requireActorUser(db, actorUserId);

    let formulir: FormData;
    try {
      formulir = await request.formData();
    } catch {
      throw new ApiError(400, "Kirim multipart/form-data dengan ruas berkas.");
    }
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) throw new ApiError(400, "Berkasnya belum dipilih.");
    // Ukuran diperiksa SEBELUM dibaca ke memori.
    if (berkas.size > BATAS_WORD_PDF) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_WORD_PDF / 1024 / 1024} MB.`);
    const denganTtd = String(formulir.get("ttd") ?? "1") !== "0";

    // Admin (kapabilitas "blangko-abt") boleh memasang tanda tangan siapa pun yang sah; akun lain hanya miliknya sendiri.
    let bolehSemuaTtd = true;
    try {
      await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    } catch (galat) {
      if (!(galat instanceof ApiError) || galat.status !== 403) throw galat;
      bolehSemuaTtd = false;
    }

    const hasil = await wordKePdfBas(
      {
        bita: new Uint8Array(await berkas.arrayBuffer()),
        namaBerkas: berkas.name,
        denganTtd,
        akun: { id: String(aktor.id), nama: String(aktor.name ?? "") },
        bolehSemuaTtd,
      },
      {
        ubahKePdf: ubahKePdfLewatBot,
        daftarTtdSah: async () => {
          const r = (await getGatewayTandaTangan(true)) as { ok?: boolean; baris?: Array<Record<string, unknown>> } | null;
          if (!r || r.ok === false) throw new ApiError(502, "Daftar tanda tangan belum dapat dibaca.");
          return (r.baris ?? [])
            .filter((b) => b && b.disahkan !== false)
            .map((b) => ({
              id: Number(b.id),
              namaPejabat: String(b.namaPejabat ?? ""),
              disahkan: true,
              penggunaId: String(b.penggunaId ?? ""),
              disahkanPada: String(b.disahkanPada ?? ""),
            }));
        },
        gambarTtd: async (id) => {
          const respons = await ambilGambarTandaTangan(id);
          if (!respons.ok) return null;
          return new Uint8Array(await respons.arrayBuffer());
        },
        atur: ukuranUntukBot(await ukuranTtdCapBerlaku(db)),
      }
    );

    return ok({
      pdfBase64: Buffer.from(hasil.pdf).toString("base64"),
      byte: hasil.pdf.length,
      namaBerkas: hasil.namaBerkas,
      bentukAsal: hasil.bentukAsal,
      blokTtd: hasil.blokTtd,
      penandatangan: hasil.penandatangan,
      peringatan: hasil.peringatan,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_WORD_PDF_GAGAL",
      feature: "aleta_ecourt",
      entityId: "bas-word-ke-pdf",
    });
  }
}
