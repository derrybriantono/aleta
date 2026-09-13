import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";
import {
  SET_BLANGKO,
  jenjangkan,
  setPutusanUntukPerkara,
  usulanPutusanDariJenjang,
  type BlangkoItem,
  type SetBlangko,
} from "@/lib/pohon-blangko";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * POHON BLANGKO PUTUSAN UNTUK PEMETAAN EKSTENSI
 * ============================================================================
 *
 * Pemetaan blangko di ekstensi (jenis perkara -> satu berkas ABT) selama ini
 * diisi tangan, padahal portal sudah tahu set mana untuk jenis apa
 * (SET_BLANGKO) dan bot sudah dapat membaca isi foldernya di peladen
 * (blangko.katalog). Rute ini menyatukan keduanya untuk ekstensi:
 *
 *   ?jenis=<jenis perkara>   set putusan yang cocok, isinya dijenjangkan
 *                            menurut skenario akhir, beserta satu USULAN
 *                            bawaan per set
 *   tanpa jenis              seluruh set putusan sekaligus - satu panggilan
 *                            untuk mengisi semua baris pemetaan
 *
 * Yang tidak dilakukan di sini: memutuskan berkas mana yang dipakai. Usulan
 * hanya bawaan, dan tiap perkara di daftar massal masih memilih blangkonya
 * sendiri. Folder yang tidak terbaca di peladen dilaporkan apa adanya pada
 * setnya, bukan ditelan menjadi set kosong.
 */
type SetTerisi = {
  id: string;
  nama: string;
  folder: string;
  untuk: string[];
  ada: boolean;
  sebab: string;
  jenjang: Array<{ kunci: string; label: string; blangko: BlangkoItem[] }>;
  usulan: { berkas: string; kategori: string; kunciJenjang: string } | null;
};

async function isiSet(set: SetBlangko): Promise<SetTerisi> {
  const katalog = await callAletaBotSippBridge("blangko.katalog", { folder: set.folder });
  const data = katalog.ok ? (katalog.data as { ada?: boolean; sebab?: string; blangko?: BlangkoItem[] }) : null;
  const blangko = Array.isArray(data?.blangko) ? data!.blangko! : [];
  const jenjangPenuh = jenjangkan("putusan", blangko);
  return {
    id: set.id,
    nama: set.nama,
    folder: set.folder,
    untuk: set.untuk,
    ada: Boolean(data?.ada) && blangko.length > 0,
    sebab: katalog.ok ? String(data?.sebab ?? "") : String(katalog.error ?? "Katalog blangko tidak terbaca."),
    jenjang: jenjangPenuh.map((j) => ({ kunci: j.kunci, label: j.label, blangko: j.blangko })),
    usulan: usulanPutusanDariJenjang(jenjangPenuh),
  };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const jenis = String(getSearchParam(request, "jenis") ?? "").trim();
    const daftarSet = jenis ? setPutusanUntukPerkara(jenis) : SET_BLANGKO.filter((set) => set.jenis === "putusan");

    // Berurutan, bukan serentak: tiap set adalah satu pembacaan folder di
    // peladen lewat jembatan bot, dan tujuh pembacaan sekaligus tidak lebih
    // cepat - hanya lebih berat bagi bot yang juga melayani WhatsApp.
    const set: SetTerisi[] = [];
    for (const satu of daftarSet) set.push(await isiSet(satu));

    return ok({ jenis, set });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_POHON_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-pohon",
    });
  }
}
