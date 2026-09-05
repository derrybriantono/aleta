import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayPenunjukanPeriksa } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaAturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import {
  SEBUTAN_PENETAPAN,
  bolehMenetapkan,
  sebutanJabatan,
} from "@/server/modules/aleta-ecourt/penunjukan-antrean";
import {
  URUTAN_PENGISIAN,
  type BarisPengisian,
  borangSiap,
  catatPengisian,
  ringkasanPengisian,
  tandaiHasilPengisian,
} from "@/server/modules/aleta-ecourt/penunjukan-pengisian";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JENIS_SAH = new Set<string>(URUTAN_PENGISIAN);

/**
 * Mencatat apa yang diisikan ekstensi ke formulir SIPP.
 *
 * ============================================================================
 * DICATAT SEBELUM SIMPAN, DIPERIKSA SESUDAHNYA
 * ============================================================================
 *
 * POST mencatat pengisiannya dan menandainya belum mendarat. PATCH memeriksa
 * ke SIPP apakah ia benar-benar tercatat, lalu menandai hasilnya.
 *
 * Urutannya begitu karena pengisian yang gagal di tengah adalah yang paling
 * perlu ditelusuri - dan kalau catatannya baru ditulis sesudah berhasil, justru
 * itulah yang tidak meninggalkan jejak sama sekali.
 *
 * ============================================================================
 * KEWENANGANNYA DIPERIKSA LAGI DI SINI
 * ============================================================================
 *
 * Ekstensi sudah menanyakannya sebelum menggambar tombol, tetapi ekstensi
 * berjalan di peramban pengguna. Yang menentukan boleh atau tidaknya adalah
 * pemeriksaan ini, bukan tombol yang muncul di sana.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "penunjukan-otomatis");

    if (!actorUserId) return ok({ ok: false, alasan: "belum_masuk" });

    const body = (await request.json()) as {
      perkaraId?: string;
      nomorPerkara?: string;
      akunSipp?: string;
      baris?: BarisPengisian[];
    };

    const masuk = Array.isArray(body.baris) ? body.baris : [];
    if (masuk.length === 0) {
      return ok({ ok: false, alasan: "tidak_ada_yang_dicatat" });
    }

    // Hanya keempat jenis penetapan yang dikenal. Jenis lain bukan sekadar
    // tidak berguna - ia akan ditolak batasan kolomnya di basis data, dan
    // kegagalan itu muncul sebagai galat server alih-alih sebagai penolakan
    // yang dapat dibaca.
    const baris = masuk
      .filter((x) => JENIS_SAH.has(String(x?.jenis)))
      .slice(0, 40)
      .map((x) => ({
        jenis: String(x.jenis),
        medan: String(x.medan || "").slice(0, 120),
        nilai: String(x.nilai ?? "").slice(0, 500),
        asal: x.asal === "manual" ? ("manual" as const) : ("otomatis" as const),
        usulanSemula: String(x.usulanSemula ?? "").slice(0, 500),
        alasan: String(x.alasan ?? "").slice(0, 500),
      }));

    if (baris.length === 0) {
      return ok({ ok: false, alasan: "jenis_penetapan_tidak_dikenali" });
    }

    // Urutan diperiksa DI SINI, bukan hanya di ekstensi. SIPP menolak PPP dan
    // PJS selama majelisnya belum ditetapkan, sehingga mencatat pengisian yang
    // melompati PMH berarti mencatat sesuatu yang tidak mungkin terjadi.
    const jenisDicatat = new Set(baris.map((x) => x.jenis));
    const urutanKeliru = URUTAN_PENGISIAN.findIndex(
      (jenis, i) =>
        jenisDicatat.has(jenis) &&
        URUTAN_PENGISIAN.slice(0, i).some((sebelum) => !jenisDicatat.has(sebelum))
    );
    const lompat = urutanKeliru >= 0 ? URUTAN_PENGISIAN[urutanKeliru] : "";

    // ======================================================================
    // JABATANNYA DIPERIKSA, BUKAN HANYA KEWENANGAN MENGISI
    // ======================================================================
    //
    // Sebelumnya yang diperiksa hanya "boleh mengisi formulir atau tidak" -
    // sehingga Panitera yang diberi kewenangan itu dapat mengisi formulir PMH,
    // yang merupakan perbuatan Ketua.
    //
    // Penetapan adalah perbuatan pejabat. Yang mencatatnya sebagai sudah
    // diisi harus benar-benar pejabat yang berwenang atas penetapan itu -
    // kalau tidak, jejaknya menyebut satu nama sementara yang mengerjakan
    // orang lain, dan pertanyaan "siapa yang menetapkan ini" tidak dapat
    // dijawab dengan jujur.
    // Modenya dibaca dari pengaturan. Bawaannya longgar - operator memang
    // mengerjakan keempatnya atas arahan Ketua Pengadilan demi kelancaran
    // proses. Yang ketat disediakan bagi pengadilan yang menghendakinya.
    const aturan = await bacaAturanPenunjukan(db);

    for (const jenis of jenisDicatat) {
      if (!bolehMenetapkan(String(actor.roleId ?? ""), jenis, aturan.penetapanBerjabatan)) {
        return ok({
          ok: false,
          alasan: `${SEBUTAN_PENETAPAN[jenis] ?? jenis} ditetapkan ${sebutanJabatan(jenis)}, bukan peran Anda.`,
          // Jalan keluarnya disebutkan, bukan hanya penolakannya: usulannya
          // dapat diteruskan supaya pejabatnya tinggal menekan sekali.
          saran: "teruskan",
          jenis,
        });
      }
    }

    // Borang yang petanya belum lengkap tidak boleh dicatat sebagai terisi.
    for (const jenis of jenisDicatat) {
      const keadaan = await borangSiap(db, jenis);
      if (!keadaan.siap) {
        return ok({ ok: false, alasan: `formulir ${jenis} belum siap: ${keadaan.alasan}` });
      }
    }

    // ======================================================================
    // JABATAN YANG SEHARUSNYA IKUT DICATAT, BERAPA PUN MODENYA
    // ======================================================================
    //
    // Ketika modenya longgar, operator boleh mengerjakan penetapan yang bukan
    // jabatannya - dan itu memang cara kerja yang berlaku. Tetapi catatannya
    // tetap menyebutkan jabatan mana yang seharusnya, sehingga pertanyaan
    // "siapa yang mengerjakan penetapan ini" dapat dijawab apa adanya.
    //
    // Yang dilonggarkan penjagaannya, bukan kejujuran catatannya.
    const barisBercatatan = baris.map((x) => ({
      ...x,
      alasan: bolehMenetapkan(String(actor.roleId ?? ""), x.jenis, "ketat")
        ? x.alasan
        : [x.alasan, `dikerjakan operator, jabatan penetap: ${sebutanJabatan(x.jenis)}`]
            .filter(Boolean)
            .join(" · "),
    }));

    const hasil = await catatPengisian(db, {
      actorUserId,
      perkaraId: String(body.perkaraId || ""),
      nomorPerkara: String(body.nomorPerkara || ""),
      akunSipp: String(body.akunSipp || ""),
      baris: barisBercatatan,
    });

    return ok({
      ok: true,
      ...hasil,
      // Peringatan, bukan penolakan: pengisian sebagian memang terjadi ketika
      // PMH sudah ditetapkan lebih dulu pada kesempatan sebelumnya.
      peringatanUrutan: lompat
        ? `${lompat} dicatat tanpa penetapan sebelumnya - pastikan PMH memang sudah ada di SIPP.`
        : "",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_CATAT_FAILED",
      feature: "penunjukan",
      entityId: "catat",
    });
  }
}

/** Memeriksa ke SIPP apakah pengisiannya mendarat, lalu menandai hasilnya. */
export async function PATCH(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan-otomatis");

    const body = (await request.json()) as {
      nomorPerkara?: string;
      idBaris?: string[];
      harapan?: Record<string, string>;
    };

    const idBaris = Array.isArray(body.idBaris)
      ? body.idBaris.map((x) => String(x)).slice(0, 40)
      : [];

    const periksa = await getGatewayPenunjukanPeriksa({
      nomorPerkara: String(body.nomorPerkara || ""),
      harapan: body.harapan || {},
    });

    if (!periksa.ok) {
      // Bot tidak terjangkau bukan berarti pengisiannya gagal - dan menandainya
      // gagal akan mencatat kebohongan yang lebih buruk daripada tidak tahu.
      // Catatannya dibiarkan "belum", untuk diperiksa lagi nanti.
      return ok({
        ok: false,
        alasan: periksa.error || "bot_tidak_terjangkau",
        mendarat: "belum",
      });
    }

    const mendarat = periksa.data.mendarat;
    const sah = mendarat === "ya" || mendarat === "tidak" || mendarat === "sebagian";

    if (sah) {
      await tandaiHasilPengisian(db, {
        idBaris,
        mendarat,
        tercatat: periksa.data.tercatat || "",
      });
    }

    return ok({
      ok: true,
      mendarat,
      rinci: periksa.data.rinci || [],
      alasan: periksa.data.alasan || "",
      ringkasan: await ringkasanPengisian(db),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_PERIKSA_FAILED",
      feature: "penunjukan",
      entityId: "periksa",
    });
  }
}
