import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  daftarKelasC,
  geserSaklar,
  ringkasKelasC,
  saklarMenyala,
  terbitkanBerkas,
  terbitkanNaskah,
  turunkanDariKorpus,
  ujiKemandirian,
} from "@/server/modules/aleta-ecourt/blangko-aleta";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pustaka blangko ALETA (Tahap 5, 6, 7 - Kemandirian Blangko).
 *
 *   GET                              daftar blangko ALETA
 *   GET ?kode=..&perkaraId=..        naskah yang sudah terisi, untuk dilihat lebih dulu
 *   GET ?kelasC=1                    variabel mati beserta blangko yang memuatnya
 *   GET ?saklar=bas                  keadaan saklar periksa satu golongan
 *
 *   POST {tindakan:"turunkan"}       menurunkan blangko dari korpus
 *   POST {tindakan:"terbitkan"}      menerbitkan DOCX dan PDF
 *   POST {tindakan:"saklar"}         menggeser saklar periksa
 *   POST {tindakan:"ujiMandiri"}     menguji kemandirian dari ABT
 *
 * ============================================================================
 * MELIHAT DAN MENERBITKAN TERBUKA; MENYUSUN DAN MENGGESER SAKLAR TIDAK
 * ============================================================================
 *
 * Menerbitkan naskah adalah pekerjaan sehari-hari panitera. Menyusun blangko
 * menetapkan BUNYI kalimat hukum bagi seluruh perkara yang kelak memakainya,
 * dan menggeser saklar menentukan apakah naskah diperiksa - keduanya mengenai
 * seluruh pengadilan, bukan satu perkara.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    if (String(getSearchParam(request, "kelasC") ?? "").trim() === "1") {
      return ok({ ada: true, ringkas: await ringkasKelasC(db), temuan: await daftarKelasC(db) });
    }

    const golongan = String(getSearchParam(request, "saklar") ?? "").trim();
    if (golongan) {
      return ok({ ada: true, golongan, menyala: await saklarMenyala(db, golongan) });
    }

    const kode = String(getSearchParam(request, "kode") ?? "").trim();
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (kode && perkaraId) {
      return ok({ ada: true, naskah: await terbitkanNaskah(db, { kode, perkaraId }) });
    }

    const daftar = await db.queryAll<Record<string, unknown>>(
      `SELECT kode, nama, jenis, asal_abt, keadaan, versi, disusun_oleh, dibuat_at
         FROM aleta_blangko ORDER BY jenis, kode`
    );
    return ok({ ada: true, jumlah: daftar.length, blangko: daftar });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_ALETA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-aleta",
    });
  }
}

type Masukan = {
  tindakan?: string;
  olehNama?: string;
  jalur?: string;
  kode?: string;
  nama?: string;
  perkaraId?: string;
  keadaan?: Record<string, string>;
  golongan?: string;
  menyala?: boolean;
  alasan?: string;
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const masukan = (await request.json()) as Masukan;
    const tindakan = String(masukan.tindakan ?? "");
    const oleh = String(masukan.olehNama ?? "") || String(actorUserId ?? "");

    // Menerbitkan adalah pekerjaan panitera; sisanya mengenai seluruh
    // pengadilan dan menuntut admin.
    if (tindakan === "terbitkan") {
      await pastikanKapabilitas(db, actorUserId, "panel");
    } else {
      await pastikanAdminIstimewa(db, actorUserId, "mengubah pustaka blangko ALETA");
    }

    switch (tindakan) {
      case "turunkan":
        return ok(
          await turunkanDariKorpus(db, {
            jalur: String(masukan.jalur ?? ""),
            kode: String(masukan.kode ?? ""),
            nama: String(masukan.nama ?? ""),
            oleh,
          })
        );

      case "terbitkan": {
        const hasil = await terbitkanBerkas(db, {
          kode: String(masukan.kode ?? ""),
          perkaraId: String(masukan.perkaraId ?? ""),
          keadaan: masukan.keadaan,
          oleh,
        });
        if (!hasil.ok) return ok({ ok: false, sebab: hasil.sebab });
        // Berkasnya dikirim tersandi base64 - rute ini menjawab JSON, dan
        // penanda yang tersisa harus ikut sampai bersama berkasnya supaya yang
        // menandatangani tahu apa yang masih kosong SEBELUM membukanya.
        return ok({
          ok: true,
          docxBase64: hasil.docx?.toString("base64") ?? "",
          pdfBase64: hasil.pdf?.toString("base64") ?? "",
          jumlahHalaman: hasil.jumlahHalaman,
          hurufTakTercetak: hasil.hurufTakTercetak,
          tersisa: hasil.tersisa,
        });
      }

      case "saklar":
        return ok(
          await geserSaklar(db, {
            golongan: String(masukan.golongan ?? ""),
            menyala: Boolean(masukan.menyala),
            alasan: String(masukan.alasan ?? ""),
            oleh,
          })
        );

      case "ujiMandiri":
        return ok(await ujiKemandirian(db, { perkaraId: String(masukan.perkaraId ?? ""), oleh }));

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_ALETA_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-aleta",
    });
  }
}
