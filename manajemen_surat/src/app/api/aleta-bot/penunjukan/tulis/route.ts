import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  kirimPenetapanTulisGateway,
  kirimPenetapanTulisRantaiGateway,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanPejabatLangkah, pejabatSahUntukTanggal } from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { periksaLiburPenetapan } from "@/server/modules/hari-libur/penjaga";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { alamatIpPeramban } from "@/server/shared/request";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * MENULIS PENETAPAN KE SIPP - RUTE YANG PALING BERAT AKIBATNYA
 * ============================================================================
 *
 * Seluruh rute lain di ALETA membaca SIPP. Rute ini menulis. Sejak butir 17
 * (13 Okt 2026) PMH/PPP/PJS/PHS tercatat di SIPP (Riwayat Perkara dan
 * sys_audittrail) atas AKUN SIPP PEJABAT yang dipilih di panel - Ketua/Wakil/
 * Plh, Panitera/Plh, ketua majelis - apa pun akun yang sedang masuk, pada jam
 * yang disusun seperti orang bekerja. Akun SIPP yang masuk (olehUsername) dan
 * operator ALETA hanya dicatat di jejak ALETA. Pilihan pejabat dari peramban
 * dipastikan di sini (pejabatSahPenetapan); PHS dipastikan bot terhadap
 * majelis perkara itu.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN
 * ============================================================================
 *
 * Permintaan yang tidak menyebut apa-apa menghasilkan hasil KERING: daftar
 * pernyataan lengkap yang akan dikirim, tanpa satu pun dijalankan. Menulis
 * menuntut { kering: false } yang tegas.
 *
 * ============================================================================
 * OPERATOR DIAMBIL DARI SESI, BUKAN DARI PERAMBAN
 * ============================================================================
 *
 * Akun ALETA yang menekan tombolnya dicatat pada jejak jujur ALETA
 * (aleta_bot_jejak_penetapan: operator, akun SIPP, IP, "lewat ALETA"). Kalau
 * nama itu boleh dikirim peramban, ia dapat diisi apa saja - dan jejak itu
 * kehilangan satu-satunya hal yang membuatnya dapat dipercaya.
 *
 * Karena itu operatornya diambil dari akun ALETA yang sedang masuk, dan badan
 * permintaan yang mencoba menyebutnya diabaikan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kemampuan yang sama dengan papan penunjukan - yang boleh mengusulkan,
    // dialah yang boleh menetapkan. Memisahkannya menjadi kemampuan tersendiri
    // hanya akan menghasilkan satu daftar izin lagi yang tidak pernah diisi.
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();
    if (!operator) {
      return Response.json({ ok: false, alasan: "operator_tidak_dikenali" }, { status: 403 });
    }

    const badan = (await request.json()) as Record<string, unknown>;

    /**
     * ========================================================================
     * DATA UMUM IKUT - DAN HURUF BESARNYA TIDAK BOLEH HILANG
     * ========================================================================
     *
     * Mesin tulis di bot sudah lama mendukung "dataUmum", tetapi rute ini
     * hanya menerima empat penetapan. Akibatnya tombol "Tulis ke SIPP" pada
     * bagian Data Umum SELALU ditolak jenis_tidak_didukung - fitur yang
     * lengkap di kedua ujungnya dan putus tepat di tengah.
     *
     * Yang menyamarkannya: toLowerCase() di baris ini. Bahkan seandainya
     * "dataUmum" ikut didaftarkan, yang diteruskan ke bot menjadi "dataumum" -
     * dan bot membandingkannya persis, sehingga tetap tidak dikenali. Karena
     * itu jenisnya dicocokkan tanpa mempersoalkan besar-kecil huruf, lalu
     * diteruskan dalam BENTUK BAKUNYA.
     */
    const JENIS_BAKU: Record<string, string> = {
      pmh: "pmh",
      ppp: "ppp",
      pjs: "pjs",
      phs: "phs",
      dataumum: "dataUmum",
    };
    // ========================================================================
    // SISA PENETAPAN SATU PERKARA - UTUH ATAU BATAL (uji rilis U1, 9 Okt 2026)
    // ========================================================================
    //
    // Panel mengirim seluruh langkah sisa sekaligus pada penulisan sungguhan;
    // bot menuliskannya dalam SATU transaksi (tulisRantaiUtuh). Uji kering
    // tetap per langkah di bawah.
    if (Array.isArray(badan.rantai)) {
      if (badan.kering !== false) {
        return Response.json({ ok: false, alasan: "rantai_hanya_untuk_menulis" }, { status: 400 });
      }
      const perkaraIdRantai = Number(badan.perkaraId);
      if (!Number.isFinite(perkaraIdRantai) || perkaraIdRantai <= 0) {
        return Response.json({ ok: false, alasan: "perkara_tidak_sah" }, { status: 400 });
      }
      const olehRantai = String(badan.olehUsername || "").trim();
      if (!olehRantai) {
        return Response.json({ ok: false, alasan: "akun_sipp_belum_terbaca" }, { status: 400 });
      }
      const RANTAI_SAH = new Set(["pmh", "ppp", "pjs", "phs"]);
      const langkah = (badan.rantai as unknown[]).map((x) => {
        const s = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return {
          jenis: String(s.jenis || "").toLowerCase(),
          hakimId: Array.isArray(s.hakimId)
            ? (s.hakimId as unknown[]).map((h) => Number(h)).filter((h) => Number.isFinite(h) && h > 0)
            : undefined,
          petugasId: s.petugasId === undefined ? undefined : Number(s.petugasId),
          tanggalSidang: s.tanggalSidang === undefined ? undefined : String(s.tanggalSidang),
          ruanganId: s.ruanganId === undefined ? undefined : Number(s.ruanganId),
          jamSidang: s.jamSidang === undefined ? undefined : String(s.jamSidang),
          pejabatUsername: String(s.pejabatUsername || "").trim().slice(0, 150) || undefined,
        };
      });
      if (langkah.length === 0 || langkah.some((x) => !RANTAI_SAH.has(x.jenis))) {
        return Response.json({ ok: false, alasan: "jenis_tidak_didukung" }, { status: 400 });
      }
      const tolak = await isiPejabatSah(db, String(badan.tanggalPenetapan || ""), langkah);
      if (tolak) return tolak;
      // Hari libur nasional/cuti bersama/tambahan - SIPP menerimanya, ALETA tidak.
      const libur = await periksaLiburPenetapan(db, badan.tanggalPenetapan, langkah);
      if (libur) {
        return Response.json(
          { ok: false, alasan: libur.alasan, diminta: libur.diminta, jenisGagal: libur.alasan === "tanggal_sidang_hari_libur" ? "phs" : langkah[0].jenis, hasil: [], dipulihkan: true },
          { status: 409 }
        );
      }
      const responsRantai = await kirimPenetapanTulisRantaiGateway({
        perkaraId: perkaraIdRantai,
        tanggalPenetapan: String(badan.tanggalPenetapan || ""),
        olehUsername: olehRantai,
        operator,
        ip: alamatIpPeramban(request),
        langkah,
      });
      if (responsRantai?.ok === false) {
        return Response.json({ ok: false, alasan: responsRantai.error ?? "ditolak", hasil: [] }, { status: 409 });
      }
      const badanRantai = (responsRantai?.data ?? {}) as Record<string, unknown>;
      return Response.json(badanRantai, { status: badanRantai?.ok === false ? 409 : 200 });
    }

    const jenis = JENIS_BAKU[String(badan.jenis || "").toLowerCase()];
    if (!jenis) {
      return Response.json({ ok: false, alasan: "jenis_tidak_didukung" }, { status: 400 });
    }

    const perkaraId = Number(badan.perkaraId);
    if (!Number.isFinite(perkaraId) || perkaraId <= 0) {
      return Response.json({ ok: false, alasan: "perkara_tidak_sah" }, { status: 400 });
    }

    // ========================================================================
    // AKUN SIPP YANG MASUK (penekan) DAN AKUN PEJABAT (yang dicatat SIPP)
    // ========================================================================
    //
    // olehUsername = nama pada kepala halaman SIPP yang sedang dibuka petugas -
    // penekan sebenarnya, wajib terbaca, dicatat di jejak ALETA. Sejak butir 17
    // (13 Okt 2026) yang dicatat di Riwayat Perkara dan sys_audittrail untuk
    // PMH/PPP/PJS/PHS adalah pejabatUsername (dipastikan isiPejabatSah). Data
    // Umum tetap atas akun yang masuk.
    const olehUsername = String(badan.olehUsername || "").trim();
    if (!olehUsername) {
      return Response.json({ ok: false, alasan: "akun_sipp_belum_terbaca" }, { status: 400 });
    }
    const tunggal = [{ jenis, pejabatUsername: String(badan.pejabatUsername || "").trim().slice(0, 150) || undefined }];
    if (jenis !== "dataUmum") {
      const tolak = await isiPejabatSah(db, String(badan.tanggalPenetapan || ""), tunggal);
      if (tolak) return tolak;
      // Hari libur nasional/cuti bersama/tambahan - SIPP menerimanya, ALETA tidak.
      const libur = await periksaLiburPenetapan(db, badan.tanggalPenetapan, [{ jenis, tanggalSidang: badan.tanggalSidang }]);
      if (libur) return Response.json({ ok: false, alasan: libur.alasan, diminta: libur.diminta }, { status: 409 });
    }
    const pejabatUsername = tunggal[0].pejabatUsername || "";

    // Menulis HARUS diminta tegas. Permintaan yang lupa menyebutnya
    // menghasilkan hasil kering, bukan tulisan.
    const kering = badan.kering !== false;

    // Rantai yang mendahului langkah ini. Datang dari peramban, jadi disaring
    // ke daftar tertutup - dan pengaruhnya pun hanya pada UJI KERING, yang
    // tidak menulis apa pun. Pada penulisan sungguhan bot mengabaikannya dan
    // tetap menuntut PMH benar-benar tersimpan.
    const rantaiSebelum = Array.isArray(badan.rantaiSebelum)
      ? (badan.rantaiSebelum as unknown[])
          .map((x) => String(x).toLowerCase())
          .filter((x) => Object.prototype.hasOwnProperty.call(JENIS_BAKU, x))
      : [];

    const respons = await kirimPenetapanTulisGateway({
      jenis,
      perkaraId,
      tanggalPenetapan: String(badan.tanggalPenetapan || ""),
      hakimId: Array.isArray(badan.hakimId)
        ? (badan.hakimId as unknown[]).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
        : undefined,
      petugasId: badan.petugasId === undefined ? undefined : Number(badan.petugasId),
      tanggalSidang: badan.tanggalSidang === undefined ? undefined : String(badan.tanggalSidang),
      ruanganId: badan.ruanganId === undefined ? undefined : Number(badan.ruanganId),
      jamSidang: badan.jamSidang === undefined ? undefined : String(badan.jamSidang),
      dataUmum:
        badan.dataUmum && typeof badan.dataUmum === "object"
          ? (badan.dataUmum as Record<string, unknown>)
          : undefined,
      olehUsername,
      pejabatUsername: pejabatUsername || undefined,
      operator,
      kering,
      rantaiSebelum,
      ip: alamatIpPeramban(request),
    });

    // ========================================================================
    // JAWABAN BOT DITERUSKAN APA ADANYA - BUKAN PEMBUNGKUS GERBANGNYA
    // ========================================================================
    //
    // gatewayFetch memulangkan { ok, data?, error? }. Ketika bot MENOLAK -
    // akun pejabat tidak ada di SIPP, tanggal tidak sah, langkah sudah ada -
    // ia menjawab 4xx, dan pembungkusnya menjadi { ok: false, error: "..." }
    // TANPA medan `alasan`.
    //
    // Yang diteruskan ke panel selama ini pembungkus itu. Panel membaca
    // jawab.alasan, tidak menemukannya, lalu jatuh ke kata cadangannya:
    // "ditolak". Seluruh penolakan bot karena itu tampil sebagai satu kata
    // yang sama, dan tidak satu pun dapat ditelusuri sebabnya - persis yang
    // terjadi pada penetapan massal yang berhenti di perkara pertama.
    //
    // Sekarang badan jawaban bot yang diteruskan, beserta alasannya. Kegagalan
    // gerbang sendiri - bot mati, jaringan putus - tetap punya bentuknya
    // sendiri, dan ia memang bukan penolakan.
    //
    // gatewayFetch SUDAH membaca `alasan` milik bot ke dalam `error`-nya -
    // lihat catatannya di sana. Yang kurang hanya meneruskannya dengan nama
    // yang dicari panel.
    if (respons?.ok === false) {
      return Response.json({ ok: false, alasan: respons.error ?? "ditolak" }, { status: 409 });
    }
    const badanBot = (respons?.data ?? {}) as Record<string, unknown>;
    return Response.json(badanBot, { status: badanBot?.ok === false ? 409 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_TULIS_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/**
 * Memastikan akun pejabat tiap langkah PMH/PPP/PJS (butir 17) dan mengisi
 * pilihan otomatis bila panel tidak memilih. Pulang Response penolakan, atau
 * null bila seluruhnya sah. PHS diteruskan apa adanya - bot memastikannya
 * terhadap majelis perkara itu.
 */
async function isiPejabatSah(
  db: Awaited<ReturnType<typeof getDatabase>>,
  tanggal: string,
  langkah: Array<{ jenis: string; pejabatUsername?: string }>
): Promise<Response | null> {
  if (!langkah.some((x) => ["pmh", "ppp", "pjs"].includes(x.jenis))) return null;
  const baca = await pejabatSahUntukTanggal(db, tanggal);
  if (!baca.ok) {
    return Response.json({ ok: false, alasan: "pemetaan_jabatan_tidak_terbaca", pesan: baca.galat }, { status: 503 });
  }
  for (const satu of langkah) {
    const hasil = pastikanPejabatLangkah(baca.sah, satu.jenis, satu.pejabatUsername || "");
    if (!hasil.ok) return Response.json(hasil, { status: 409 });
    if (hasil.username) satu.pejabatUsername = hasil.username;
  }
  return null;
}
