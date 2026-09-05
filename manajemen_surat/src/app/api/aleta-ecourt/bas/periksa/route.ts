import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { petaPenanda } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";
import { penandaDariLembar, semuaLembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { penandaDariSidang, sidangKe, susunRangkaian } from "@/lib/rangkaian-sidang";
import { muatKehadiran, penandaDariKehadiran } from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { bacaSaksiAbt, penandaDariAbt } from "@/lib/keterangan-abt";
import { cariPedoman, kataKunciBlangko } from "@/server/modules/aleta-ecourt/pustaka-pedoman";
import { periksaKesiapan, ringkasPemeriksaan, type LembarRingkas } from "@/lib/pemeriksaan-bas";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemeriksaan kelengkapan sebelum naskah diunduh.
 *
 * ============================================================================
 * MEMAKAI JALUR YANG SAMA DENGAN NASKAHNYA
 * ============================================================================
 *
 * Penanda dihitung dengan peta yang persis sama dengan yang dipakai rute
 * naskah - berkas perkara, sidang, lalu lembar BAS. Pemeriksaan yang
 * menghitungnya sendiri pasti berselisih dengan naskahnya cepat atau lambat,
 * dan yang muncul adalah pemeriksaan yang menyatakan lengkap atas naskah yang
 * ternyata masih bertanda.
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
    const nomorSidang = Number(getSearchParam(request, "sidangKe") ?? "0") || 0;

    if (!perkaraId || !berkas) {
      return ok({ ok: false, sebab: "Perkara dan blangko harus disebutkan.", temuan: [] });
    }

    type Dibaca = { ada?: boolean; sebab?: string; penanda?: string[] };
    const [isiBerkas, lembar, kehadiran, dibaca] = await Promise.all([
      rakitBerkasPerkara(perkaraId),
      semuaLembar(db, perkaraId),
      muatKehadiran(db, perkaraId, nomorSidang),
      callAletaBotSippBridge<Dibaca>("blangko.baca", { folder, berkas }),
    ]);

    const penandaBlangko = dibaca.data?.penanda ?? [];
    if (!dibaca.ok || !dibaca.data?.ada) {
      return ok({
        ok: false,
        sebab: dibaca.data?.sebab ?? "Blangko tidak terbaca.",
        temuan: [],
      });
    }

    const sidang = sidangKe(susunRangkaian(isiBerkas.riwayatSidang.nilai), nomorSidang);

    const terisi = new Set<string>();
    for (const [noVar] of petaPenanda(isiBerkas)) terisi.add(noVar);
    for (const [noVar] of penandaDariSidang(sidang)) terisi.add(noVar);
    for (const [noVar] of penandaDariKehadiran(kehadiran)) terisi.add(noVar);

    const punyaLembar = new Set(lembar.filter((item) => item.baris.some((b) => b.jawaban)).map((item) => item.saksiKe));
    const saksiAbt = bacaSaksiAbt(isiBerkas.pemeriksaanSaksi.nilai);
    for (const [noVar] of penandaDariAbt(saksiAbt, punyaLembar)) terisi.add(noVar);

    for (const [noVar] of penandaDariLembar(lembar)) terisi.add(noVar);

    const tersisa = penandaBlangko.filter((noVar) => !terisi.has(noVar));

    // Nama variabel hanya diminta untuk yang tersisa - itulah yang perlu
    // disebutkan. Meminta seluruhnya menambah beban tanpa menambah keterangan.
    type Variabel = { variabel?: Array<{ noVar: string; nama: string }> };
    const namaPenanda: Record<string, string> = {};
    if (tersisa.length > 0) {
      const jawaban = await callAletaBotSippBridge<Variabel>("abt.namaVariabel", { noVar: tersisa });
      for (const item of jawaban.data?.variabel ?? []) namaPenanda[item.noVar] = item.nama;
    }

    // Saksi yang keterangannya sudah terekam ABT ikut dihitung ada - ia memang
    // sudah diperiksa, hanya belum lewat ALETA. Tidak menghitungnya berarti
    // pemeriksaan menuntut pengetikan ulang atas keterangan yang sudah tercatat.
    const dariAbt: LembarRingkas[] = saksiAbt
      .filter((item) => !punyaLembar.has(item.saksiKe) && item.tanyaJawab.some((b) => b.jawaban))
      .map((item) => ({
        saksiKe: item.saksiKe,
        // Jati dirinya tidak tercatat di ABT - hanya tanya-jawabnya. Dikosongkan
        // supaya pemeriksaan tetap menyebutnya perlu dilengkapi, bukan dianggap
        // sudah ada.
        saksiNama: "",
        saksiUmur: "",
        saksiAgama: "",
        jumlahPertanyaan: item.tanyaJawab.length,
        jumlahTerjawab: item.tanyaJawab.filter((b) => b.jawaban).length,
      }));

    const ringkasLembar: LembarRingkas[] = lembar.map((item) => ({
      saksiKe: item.saksiKe,
      saksiNama: item.saksi.nama,
      saksiUmur: item.saksi.umur,
      saksiAgama: item.saksi.agama,
      jumlahPertanyaan: item.baris.length,
      jumlahTerjawab: item.baris.filter((baris) => baris.jawaban).length,
    }));

    const temuan = periksaKesiapan({
      tersisa,
      namaPenanda,
      penandaBlangko,
      lembar: [...ringkasLembar, ...dariAbt],
      namaBlangko: berkas,
      nomorSidang,
      sidangTercatat: Boolean(sidang),
      kehadiranTercatat: Boolean(kehadiran?.kehadiranPenggugat || kehadiran?.kehadiranTergugat),
      blangkoMenanyakanKehadiran: penandaBlangko.some((noVar) => noVar === "1072" || noVar === "1073"),
      selisih: isiBerkas.selisih.map((item) => ({ hal: item.hal, keterangan: item.keterangan })),
    });

    // Bagian pedoman Badilag yang menyinggung dokumen ini - KUTIPAN beserta
    // halamannya, bukan pernyataan sesuai atau tidak. Pencocokannya lewat kata
    // kunci dari nama blangko, dan itu tidak dapat sempurna: pedoman dan
    // blangko ditulis orang yang berbeda pada tahun yang berbeda. Yang menilai
    // kecocokannya harus manusia yang membacanya.
    const kutipanPedoman = [];
    for (const kata of kataKunciBlangko(berkas)) {
      kutipanPedoman.push(...(await cariPedoman(kata, "bas-putusan-2017", 2)));
      if (kutipanPedoman.length >= 4) break;
    }

    return ok({
      ok: true,
      berkas,
      pedoman: kutipanPedoman.slice(0, 4),
      jumlahPenanda: penandaBlangko.length,
      jumlahTerisi: penandaBlangko.length - tersisa.length,
      jumlahTersisa: tersisa.length,
      ringkasan: ringkasPemeriksaan(temuan),
      temuan,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_PERIKSA_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-periksa",
    });
  }
}
