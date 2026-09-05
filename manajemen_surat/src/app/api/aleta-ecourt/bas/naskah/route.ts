import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { petaPenanda } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";
import { penandaDariLembar, semuaLembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { penandaDariSidang, sidangKe, susunRangkaian } from "@/lib/rangkaian-sidang";
import { muatKehadiran, penandaDariKehadiran } from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { bacaSaksiAbt, penandaDariAbt } from "@/lib/keterangan-abt";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HasilIsi = {
  ok?: boolean;
  sebab?: string;
  berkas?: string;
  jumlahTerisi?: number;
  terisi?: string[];
  tersisa?: string[];
  rtfBase64?: string;
};

/**
 * Blangko yang sudah terisi dari berkas perkara, siap diunduh.
 *
 * ============================================================================
 * YANG DIUNDUH ADALAH BLANGKO ASLINYA
 * ============================================================================
 *
 * Bukan naskah yang disusun ulang ALETA. Blangko dibaca apa adanya dan hanya
 * penandanya yang diganti, sehingga tata letak, huruf, penomoran, dan tabel
 * tetap persis seperti bentuk baku yang ditetapkan pedoman Badilag.
 *
 * ============================================================================
 * YANG BELUM TERISI IKUT DILAPORKAN DI KEPALA JAWABAN
 * ============================================================================
 *
 * Penanda yang tersisa disebutkan di header X-Aleta-Tersisa. Panitera membuka
 * berkasnya di Word dan langsung melihat penanda yang tertinggal - tetapi
 * mengetahuinya SEBELUM membuka jauh lebih berguna, dan penanda yang tertinggal
 * di naskah resmi lebih mudah dibereskan sekarang daripada sesudah
 * ditandatangani.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const folder = String(getSearchParam(request, "folder") ?? "").trim();
    const berkas = String(getSearchParam(request, "berkas") ?? "").trim();
    // Blangko "BAS 2" memang untuk sidang ke-2, jadi nomornya datang dari
    // jenjang blangko yang sudah dipilih - tidak perlu ditanyakan lagi.
    const nomorSidang = Number(getSearchParam(request, "sidangKe") ?? "0") || 0;

    if (!perkaraId || !berkas) {
      return Response.json({ ok: false, sebab: "Perkara dan blangko harus disebutkan." }, { status: 400 });
    }

    // Berkas perkara dan lembar BAS diambil BERSAMAAN - keduanya tidak saling
    // bergantung, dan yang menunggu adalah petugas yang sedang mencetak.
    const [isiBerkas, lembar, kehadiran] = await Promise.all([
      rakitBerkasPerkara(perkaraId),
      semuaLembar(db, perkaraId),
      muatKehadiran(db, perkaraId, nomorSidang),
    ]);

    const nilai: Record<string, string> = {};
    // Berkas perkara lebih dulu, lalu lembar BAS di atasnya. Urutan ini
    // disengaja: keterangan yang diketik panitera di persidangan adalah yang
    // benar-benar terjadi hari itu, dan ia berhak menimpa apa pun yang terbaca
    // dari sistem lain untuk penanda yang sama.
    for (const [noVar, item] of petaPenanda(isiBerkas)) nilai[noVar] = item.nilai;
    // Hari, tanggal, dan sebutan sidang berubah dari satu BAS ke BAS
    // berikutnya - ketiganya bertipe multi_sidang di ABT. Diambil dari sidang
    // yang nomornya cocok dengan blangkonya, bukan dari sidang terakhir.
    const sidang = sidangKe(susunRangkaian(isiBerkas.riwayatSidang.nilai), nomorSidang);
    for (const [noVar, item] of penandaDariSidang(sidang)) nilai[noVar] = item.nilai;
    for (const [noVar, item] of penandaDariKehadiran(kehadiran)) nilai[noVar] = item.nilai;

    // Rekaman ABT dipakai untuk saksi yang BELUM punya lembar di ALETA -
    // perkara yang pemeriksaannya sudah berlangsung tidak dimulai dari kosong.
    // Ia ditaruh SEBELUM lembar supaya lembar ALETA selalu menang: yang diketik
    // hari ini adalah yang benar-benar terjadi hari ini.
    const punyaLembar = new Set(lembar.filter((item) => item.baris.some((b) => b.jawaban)).map((item) => item.saksiKe));
    const saksiAbt = bacaSaksiAbt(isiBerkas.pemeriksaanSaksi.nilai);
    for (const [noVar, item] of penandaDariAbt(saksiAbt, punyaLembar)) nilai[noVar] = item.nilai;

    for (const [noVar, item] of penandaDariLembar(lembar)) nilai[noVar] = item.nilai;

    const hasil = await callAletaBotSippBridge<HasilIsi>("blangko.isi", { folder, berkas, nilai });
    const data = hasil.data;

    if (!hasil.ok || !data?.ok || !data.rtfBase64) {
      return Response.json(
        { ok: false, sebab: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." },
        { status: 502 }
      );
    }

    const rtf = Buffer.from(data.rtfBase64, "base64");
    const namaUnduhan = `${isiBerkas.nomorPerkara || perkaraId} - ${data.berkas ?? berkas}`.replace(/[\\/:*?"<>|]/g, "_");

    return new Response(new Uint8Array(rtf), {
      status: 200,
      headers: {
        "Content-Type": "application/rtf",
        "Content-Disposition": `attachment; filename="${namaUnduhan}"`,
        "Content-Length": String(rtf.length),
        "Cache-Control": "no-store",
        "X-Aleta-Terisi": String(data.jumlahTerisi ?? 0),
        "X-Aleta-Tersisa": (data.tersisa ?? []).join(","),
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_NASKAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-naskah",
    });
  }
}
