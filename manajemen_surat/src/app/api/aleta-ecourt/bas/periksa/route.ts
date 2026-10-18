import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { petaPenanda } from "@/server/modules/aleta-ecourt/bas-tanya-jawab";
import { penandaDariLembar, pihakLembar, saksiBerlembar, semuaLembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { penandaDariSidang, sidangKe, susunRangkaian } from "@/lib/rangkaian-sidang";
import { muatKehadiran, penandaDariKehadiran } from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { bacaSaksiAbt, kunciSaksi, letakSaksiAbt, penandaDariAbt } from "@/lib/keterangan-abt";
import { susunIsianNaskahBas } from "@/server/modules/aleta-ecourt/bas-isian-naskah";
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
    await pastikanAksi(db, actorUserId, "bas.baca"); // 18 Okt 2026: matriks hak akses

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

    const punyaLembar = saksiBerlembar(lembar);
    const saksiAbt = bacaSaksiAbt(isiBerkas.pemeriksaanSaksi.nilai);

    // Q2 14 Okt: pratinjau = pengisian SUNGGUHAN tanpa berkas (tanpaRtf) oleh
    // mesin variabel ABT yang sama dengan Unduh - "tersisa" adalah isian yang
    // benar-benar akan tercetak "..." bersorot, bukan tebakan dari daftar
    // penanda yang ALETA kenal. Bot lama (tanpa mesin) jatuh ke hitungan lama.
    type HasilIsi = { ok?: boolean; tersisa?: string[]; kosong?: Array<{ noVar: string; nama?: string }> };
    const isian = await susunIsianNaskahBas(db, perkaraId, nomorSidang, { isiBerkas, lembar, kehadiran });
    const dicoba = await callAletaBotSippBridge<HasilIsi>(
      "blangko.isi",
      {
        folder,
        berkas,
        perkaraId,
        sidangKe: nomorSidang,
        nilai: isian.timpa,
        cadangan: isian.cadangan,
        tanyaJawabSaksi: isian.tanyaJawabSaksi,
        tanpaRtf: true,
      },
      { timeoutMs: 90_000 }
    );
    const namaPenanda: Record<string, string> = {};
    let tersisa: string[];
    if (dicoba.ok && dicoba.data?.ok && Array.isArray(dicoba.data.kosong)) {
      tersisa = dicoba.data.tersisa ?? dicoba.data.kosong.map((k) => k.noVar);
      for (const k of dicoba.data.kosong) if (k.nama) namaPenanda[k.noVar] = k.nama;
    } else {
      const terisi = new Set<string>();
      for (const [noVar] of petaPenanda(isiBerkas)) terisi.add(noVar);
      for (const [noVar] of penandaDariSidang(sidang)) terisi.add(noVar);
      for (const [noVar] of penandaDariKehadiran(kehadiran)) terisi.add(noVar);
      for (const [noVar] of penandaDariAbt(saksiAbt, punyaLembar)) terisi.add(noVar);
      for (const [noVar] of penandaDariLembar(lembar)) terisi.add(noVar);
      tersisa = penandaBlangko.filter((noVar) => !terisi.has(noVar));
    }

    // Nama variabel hanya diminta untuk yang tersisa - itulah yang perlu
    // disebutkan. Meminta seluruhnya menambah beban tanpa menambah keterangan.
    type Variabel = { variabel?: Array<{ noVar: string; nama: string }> };
    if (tersisa.some((noVar) => !namaPenanda[noVar])) {
      const jawaban = await callAletaBotSippBridge<Variabel>("abt.namaVariabel", { noVar: tersisa });
      for (const item of jawaban.data?.variabel ?? []) namaPenanda[item.noVar] = item.nama;
    }

    // Saksi yang keterangannya sudah terekam ABT ikut dihitung ada - ia memang
    // sudah diperiksa, hanya belum lewat ALETA. Tidak menghitungnya berarti
    // pemeriksaan menuntut pengetikan ulang atas keterangan yang sudah tercatat.
    const dariAbt: LembarRingkas[] = saksiAbt
      .filter((item) => {
        // Saksi urutan 3+ tanpa pihak dari jembatan tetap DIHITUNG sudah
        // diperiksa, walau letaknya di blangko tidak dipastikan (penandaDariAbt
        // tidak menaruhnya) - penanda tanya-jawabnya akan tetap tersisa dan
        // disebut sendiri oleh pemeriksaan.
        const letak = letakSaksiAbt(item);
        return !(letak && punyaLembar.has(kunciSaksi(letak.pihak, letak.ke))) && item.tanyaJawab.some((b) => b.jawaban);
      })
      .map((item) => ({
        saksiKe: letakSaksiAbt(item)?.ke ?? item.saksiKe,
        pihak: letakSaksiAbt(item)?.pihak ?? "P",
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
      pihak: pihakLembar(item),
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
