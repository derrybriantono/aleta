import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaDraf,
  nilaiDraf,
  rakitPutusan,
  riwayatDraf,
  selisihDenganPustaka,
  simpanDraf,
  tandatanganiDraf,
  type MasukanRakit,
} from "@/server/modules/aleta-ecourt/perakit-putusan";
import {
  butirTelaah,
  naskahDiterima,
  ringkasTelaah,
  telaahButir,
  terimaSisanya,
} from "@/server/modules/aleta-ecourt/telaah-draf";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Perakit putusan (F1-F6).
 *
 *   GET ?perkaraId=...                    riwayat draf perkara ini
 *   GET ?drafId=...                       satu draf beserta butir dan nilainya
 *   GET ?drafId=...&selisih=1             butir yang bunyinya sudah berubah di pustaka
 *
 *   POST {tindakan:"rakit", ...}          merakit draf baru dan menyimpannya
 *   POST {tindakan:"telaah", ...}         menerima atau menolak satu alinea (H3)
 *   POST {tindakan:"terimaSisanya", ...}  menerima sisanya sekaligus, dan tercatat begitu
 *   POST {tindakan:"tandatangani", ...}   menandatangani, WAJIB menyebut nama hakim
 *
 * ============================================================================
 * MERAKIT BOLEH, MENANDATANGANI PUNYA SYARAT
 * ============================================================================
 *
 * Merakit tidak mengubah apa pun di luar draf, jadi ia terbuka bagi siapa pun
 * yang boleh membuka berkas. Menandatangani menuntut draf yang sudah siap DAN
 * nama hakimnya - dan tidak ada parameter untuk melewati keduanya, karena
 * pelewat yang disediakan akan dipakai pada hari yang paling sibuk.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const drafId = String(getSearchParam(request, "drafId") ?? "").trim();
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const mintaSelisih = String(getSearchParam(request, "selisih") ?? "").trim() === "1";

    if (drafId) {
      const draf = await bacaDraf(db, drafId);
      if (!draf) return ok({ ada: false, sebab: "Draf tidak ditemukan." });
      const telaah = await butirTelaah(db, drafId);
      return ok({
        ada: true,
        draf,
        butir: telaah,
        ringkasTelaah: ringkasTelaah(telaah),
        // Naskah awal adalah yang DIUSULKAN mesin; yang ini yang DISETUJUI
        // hakim. Perbedaannya yang membuktikan telaahnya sungguh terjadi.
        naskahDiterima: naskahDiterima(telaah),
        nilai: await nilaiDraf(db, drafId),
        // Butir yang bunyinya sudah berubah di pustaka sesudah draf ini dibuat.
        selisihPustaka: mintaSelisih ? await selisihDenganPustaka(db, drafId) : [],
      });
    }

    if (perkaraId) {
      const riwayat = await riwayatDraf(db, perkaraId);
      return ok({ ada: true, jumlah: riwayat.length, riwayat });
    }

    return ok({ ada: false, sebab: "Sebutkan perkaraId atau drafId." });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_DRAF_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "putusan-draf",
    });
  }
}

type Masukan = {
  tindakan?: string;
  drafId?: string;
  olehNama?: string;
  catatan?: string;
  /** Baris butir pada draf - bukan butir pustakanya, sebab satu draf dapat memuatnya dua kali. */
  barisId?: string;
  keadaan?: string;
  alasan?: string;
} & Partial<MasukanRakit>;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "berkas");

    const masukan = (await request.json()) as Masukan;
    const aktor = String(actorUserId ?? "");

    switch (String(masukan.tindakan ?? "")) {
      case "rakit": {
        const perkaraId = String(masukan.perkaraId ?? "").trim();
        if (!perkaraId) return ok({ ok: false, sebab: "perkara_id kosong." });

        const hasil = await rakitPutusan(db, {
          perkaraId,
          nomorPerkara: String(masukan.nomorPerkara ?? ""),
          pengadilan: String(masukan.pengadilan ?? process.env.ALETA_NAMA_SATKER ?? ""),
          jenisNaskah: masukan.jenisNaskah,
          jenisPerkara: String(masukan.jenisPerkara ?? ""),
          fakta: masukan.fakta ?? {},
          dudukPerkara: masukan.dudukPerkara ?? {
            nomorPerkara: String(masukan.nomorPerkara ?? ""),
            tanggalDaftar: "",
            penggugat: "",
            tergugat: "",
            rangkaian: [],
            catatan: [],
            saksi: [],
          },
          petitum: masukan.petitum ?? [],
          amar: masukan.amar ?? [],
          biaya: masukan.biaya ?? { komponen: [], panjar: 0, dibebankanKepada: "" },
          nilai: masukan.nilai ?? [],
        });

        const disimpan = await simpanDraf(db, aktor, {
          perkaraId,
          nomorPerkara: String(masukan.nomorPerkara ?? ""),
          jenisNaskah: masukan.jenisNaskah,
          hasil,
          nilai: masukan.nilai ?? [],
          catatan: String(masukan.catatan ?? ""),
        });

        return ok({
          ok: disimpan.ok,
          drafId: disimpan.drafId,
          versi: disimpan.versi,
          sebab: disimpan.sebab,
          naskah: hasil.naskah,
          // "siap" hanya berarti lengkap dan tanpa halangan - BUKAN benar.
          siapDitandatangani: hasil.siapDitandatangani,
          belumTerisi: hasil.kerangka.belumTerisi,
          halangan: hasil.halangan,
          faktaKurang: hasil.faktaKurang,
          butirTertunda: hasil.butirTertunda,
          aduan: hasil.aduan,
          biaya: hasil.biaya,
        });
      }

      case "telaah":
        return ok(
          await telaahButir(db, {
            drafId: String(masukan.drafId ?? ""),
            barisId: String(masukan.barisId ?? ""),
            keadaan: String(masukan.keadaan ?? "") === "ditolak" ? "ditolak" : "diterima",
            oleh: String(masukan.olehNama ?? ""),
            alasan: String(masukan.alasan ?? ""),
          })
        );

      case "terimaSisanya":
        return ok(
          await terimaSisanya(db, {
            drafId: String(masukan.drafId ?? ""),
            oleh: String(masukan.olehNama ?? ""),
          })
        );

      case "tandatangani":
        return ok(
          await tandatanganiDraf(db, {
            drafId: String(masukan.drafId ?? ""),
            olehNama: String(masukan.olehNama ?? ""),
          })
        );

      default:
        return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_DRAF_UBAH_FAILED",
      feature: "aleta_ecourt",
      entityId: "putusan-draf",
    });
  }
}
