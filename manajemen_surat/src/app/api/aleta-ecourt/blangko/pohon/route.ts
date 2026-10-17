import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";
import {
  jenjangkan,
  setBlangkoGabung,
  setCocokPerkara,
  usulanPutusanDariJenjang,
  type BlangkoItem,
  type SetBlangko,
} from "@/lib/pohon-blangko";
import { berkasBasSalinan, petaStatusDariBerkas, tugasBlangko, type BarisStatusOtomatis } from "@/lib/tugas-blangko";

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
 *
 * 13 Okt 2026 (butir 7, peta per tugas): set putusan = SET_BLANGKO + folder grup
 * Derry yang DITEMUKAN di server dan bertugas hakim menurut lib/tugas-blangko.ts
 * (folder "<nomor><huruf> <Jenis>"), dan tiap set membawa `petaStatus` - satu
 * berkas per status SIPP (+verstek) dari tanda "[Kabul]", "[Cabut]" ... di nama
 * berkasnya. Ekstensi memakainya HANYA untuk baris status yang belum ada.
 */
type SetTerisi = {
  id: string;
  nama: string;
  folder: string;
  untuk: string[];
  /** I7/F22 17 Okt: syarat nomor perkara (hak asuh Lain-Lain Pdt.G; ES sederhana vs acara biasa) - ekstensi tidak memakai set "acara biasa" untuk pemetaan per jenis. */
  untukGugatan?: string[];
  syaratNomor?: string;
  tugas: string;
  ada: boolean;
  sebab: string;
  jenjang: Array<{ kunci: string; label: string; blangko: BlangkoItem[] }>;
  usulan: { berkas: string; kategori: string; kunciJenjang: string } | null;
  petaStatus: BarisStatusOtomatis[];
};

const AKAR_DERRY = "derry_briantono";

/** Subfolder grup Derry di server (nama saja); kosong bila bot tidak menjawab - set tertulis tetap dipakai. */
async function folderDitemukan(): Promise<string[]> {
  const k = await callAletaBotSippBridge("blangko.katalog", { folder: AKAR_DERRY });
  const data = k.ok ? (k.data as { set?: Array<{ nama?: string }> }) : null;
  return Array.isArray(data?.set) ? data!.set!.map((s) => String(s?.nama ?? "")).filter(Boolean) : [];
}

/** Set putusan yang cocok dengan jenis perkara; set KUMULASI di belakang (cermin alatSetCocokJenis ekstensi). */
function setPutusanCocok(daftar: SetBlangko[], jenis: string, nomor = ""): SetBlangko[] {
  const j = jenis.toLowerCase();
  // I7/F22 17 Okt: nomor perkara (?nomor=) memilih hak asuh Lain-Lain Pdt.G dan ekonomi syariah sederhana (Pdt.G.S) vs acara biasa (Pdt.G).
  // Tanpa nomor, set "acara biasa" TIDAK ikut: pemetaan per jenis ("ekonomi syariah") mengisi baris yang kosong dan tidak boleh memberi perkara
  // gugatan sederhana blangko acara biasa.
  const cocok = daftar.filter(
    (s) => s.jenis === "putusan" && (!j || (setCocokPerkara(s, jenis, nomor) && (nomor || s.syaratNomor !== "gugatan-biasa")))
  );
  const kumulasi = (s: SetBlangko) => /kumulasi/i.test(`${s.nama} ${s.folder}`);
  return [...cocok.filter((s) => !kumulasi(s)), ...cocok.filter(kumulasi)];
}

async function isiSet(set: SetBlangko): Promise<SetTerisi> {
  const katalog = await callAletaBotSippBridge("blangko.katalog", { folder: set.folder });
  const data = katalog.ok ? (katalog.data as { ada?: boolean; sebab?: string; blangko?: BlangkoItem[] }) : null;
  // F3 14 Okt: folder jenis kini memuat BAS salinan ("BAS ALUR nn ...", paket abt-susunan-satu-folder) - itu tugas panitera, bukan putusan.
  const blangko = (Array.isArray(data?.blangko) ? data!.blangko! : []).filter((b) => !berkasBasSalinan(String(b.berkas ?? "")));
  const jenjangPenuh = jenjangkan("putusan", blangko);
  return {
    id: set.id,
    nama: set.nama,
    folder: set.folder,
    untuk: set.untuk,
    ...(set.untukGugatan ? { untukGugatan: set.untukGugatan } : {}),
    ...(set.syaratNomor ? { syaratNomor: set.syaratNomor } : {}),
    tugas: tugasBlangko(set.folder),
    ada: Boolean(data?.ada) && blangko.length > 0,
    sebab: katalog.ok ? String(data?.sebab ?? "") : String(katalog.error ?? "Katalog blangko tidak terbaca."),
    jenjang: jenjangPenuh.map((j) => ({ kunci: j.kunci, label: j.label, blangko: j.blangko })),
    usulan: usulanPutusanDariJenjang(jenjangPenuh),
    petaStatus: petaStatusDariBerkas(blangko.map((b) => String(b.berkas ?? ""))),
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
    const semua = setBlangkoGabung(await folderDitemukan(), AKAR_DERRY);
    const nomor = String(getSearchParam(request, "nomor") ?? "").trim();
    const daftarSet = jenis ? setPutusanCocok(semua, jenis, nomor) : semua.filter((set) => set.jenis === "putusan");

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
