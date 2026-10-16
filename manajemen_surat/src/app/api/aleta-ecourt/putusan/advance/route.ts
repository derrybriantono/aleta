import { type NextRequest } from "next/server";

import { bacaRtfDariBita } from "@/lib/baca-rtf";
import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";
import { susunRaporAdvance, type ButirPustakaMasuk, type PutusanSerupaMasuk } from "@/lib/putusan-advance";
import { hurufAlasan } from "@/lib/set-pertanyaan-saksi";
import { getDatabase } from "@/server/db/client";
import { getGatewaySippPutusanSerupa } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { cariButir } from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_BASE64 = 28 * 1024 * 1024;
const BATAS_TEKS = 2 * 1024 * 1024;

type Badan = {
  rtfBase64?: unknown;
  teks?: unknown;
  nomorPerkara?: unknown;
  jenisPerkara?: unknown;
  sebutanP?: unknown;
  huruf?: unknown;
  saksi?: unknown;
};

/**
 * ============================================================================
 * PUTUSAN ADVANCE (17 Okt 2026, F4.4)
 * ============================================================================
 *
 *   POST JSON { rtfBase64 | teks, nomorPerkara, jenisPerkara?, sebutanP?,
 *               huruf? (isian #8503#), saksi? (jawaban saksi Blangko Derry) }
 *   -> { ok, rapor }  (lihat RaporAdvance di src/lib/putusan-advance.ts)
 *
 * Membaca draf putusan Blangko Derry (RTF dari ABT) dan menimbangnya: unsur
 * alasan, dasar hukum, konsistensi pertimbangan-amar, dan pembanding putusan
 * BHT hakim yang sama (SIPP lewat bot, baca saja) + pustaka ALETA yang sudah
 * disahkan. TIDAK MENULIS ke mana pun dan tidak memanggil AI: hasilnya hanya
 * rapor di layar; perubahan naskah tetap diketik hakim di Blangko Derry/ABT.
 *
 * Nama pihak perkara pembanding dipakai di sini untuk menyamarkan contoh
 * alinea dan tidak pernah dikirim ke peramban. Hak: kapabilitas
 * "blangko-abt" (sama dengan Cetak/anonim Blangko ABT).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const body = await readJsonBody<Badan>(request).catch(() => ({}) as Badan);
    const nomorPerkara = String(body.nomorPerkara || "").trim();
    if (!nomorPerkara) return ok({ ok: false, sebab: "Nomor perkara belum disebut." });

    let naskah = "";
    const rtfBase64 = String(body.rtfBase64 || "");
    if (rtfBase64) {
      if (rtfBase64.length > BATAS_BASE64) return ok({ ok: false, sebab: "Naskah putusan terlalu besar." });
      const bita = new Uint8Array(Buffer.from(rtfBase64, "base64"));
      if (!String.fromCharCode(...bita.subarray(0, 6)).startsWith("{\\rtf")) return ok({ ok: false, sebab: "Naskah bukan RTF." });
      naskah = bacaRtfDariBita(bita);
    } else {
      naskah = String(body.teks || "").slice(0, BATAS_TEKS);
    }
    if (!naskah.trim()) return ok({ ok: false, sebab: "Naskah putusan tidak terkirim." });

    const pecah = pecahNaskahResmi(naskah);
    const nama: Record<string, string> = { dudukPerkara: "duduk perkara", pertimbangan: "pertimbangan hukum", amar: "amar (MENGADILI)" };
    const bagianHilang = (["dudukPerkara", "pertimbangan", "amar"] as const).filter((k) => !pecah.bagian[k]).map((k) => nama[k]);

    // Pembanding SIPP: gagal-terbuka - rapor tetap jadi, dengan catatan "tidak terbaca".
    let serupa: PutusanSerupaMasuk[] | undefined;
    let jenisSipp = "";
    const hasilSerupa = await getGatewaySippPutusanSerupa(nomorPerkara).catch(() => null);
    if (hasilSerupa && hasilSerupa.ok && hasilSerupa.data.ok) {
      serupa = hasilSerupa.data.kandidat ?? [];
      jenisSipp = hasilSerupa.data.perkara?.jenis ?? "";
    }

    // Pustaka ALETA: hanya butir yang SUDAH DISAHKAN (bawaan cariButir), menurut huruf alasan.
    const huruf = hurufAlasan(String(body.huruf || ""));
    const pustaka: ButirPustakaMasuk[] = [];
    for (const h of (huruf || "F").split("")) {
      try {
        for (const b of await cariButir(db, { bagian: "pertimbangan", labelAlasan: h, batas: 40 })) {
          if (!pustaka.some((x) => x.id === b.id)) pustaka.push({ id: b.id, teks: b.teks, labelAlasan: b.labelAlasan, jumlahPemakaian: b.jumlahPemakaian });
        }
      } catch {
        // Pustaka kosong/tabel belum ada di peladen lama: contoh dari putusan serupa tetap tersedia.
      }
    }

    const saksi = Array.isArray(body.saksi) ? body.saksi.map((x) => String(x || "")).filter(Boolean).slice(0, 400) : undefined;
    const rapor = susunRaporAdvance({
      nomorPerkara,
      jenisPerkara: String(body.jenisPerkara || "") || jenisSipp,
      sebutanP: String(body.sebutanP || ""),
      hurufIsian: String(body.huruf || ""),
      dudukPerkara: pecah.bagian.dudukPerkara ?? "",
      pertimbangan: pecah.bagian.pertimbangan ?? "",
      amar: pecah.bagian.amar ?? "",
      keteranganSaksi: saksi,
      serupa,
      pustaka,
      bagianHilang,
    });
    return ok({ ok: true, rapor });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_ADVANCE_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-advance",
    });
  }
}
