import { getGatewaySippTautanPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * perkara_id DARI PENGIRIM DIADU DENGAN NOMORNYA (perbaikan 1 Okt, butir 11)
 * ============================================================================
 *
 * Panel ABT ("Unggah putusan perkara ini ke SIPP" dan putusan massal ABT)
 * mengirim perkara_id dari alamat halaman ABT beserta nomor yang dibaca dari
 * kepala halamannya. Dua hal dapat macet atau keliru di rute putusan:
 *
 *   1. nomor tidak terbaca dari kepala halaman ABT - panel ABT berjanji
 *      "tetap memakai perkara yang sedang dibuka", tetapi rute menolak dengan
 *      "Nomor perkara belum disebut." Kini nomornya ditanyakan ke SIPP.
 *   2. perkara_id dan nomor menunjuk perkara yang BERBEDA - berkas/draf akan
 *      tertaut ke perkara lain tanpa ada yang menyadarinya. Kini ditolak.
 *
 * Satu bacaan baris perkara di bot (rute tautan-perkara yang sudah ada).
 * Bila bot tidak dapat memastikannya (kunci SIPP tak terbaca, bot lama, bot
 * mati), perilaku lama berlaku: masukan dipakai apa adanya.
 *
 * Tanpa perkara_id (halaman SIPP) tidak ada pertanyaan tambahan sama sekali.
 */
export async function selaraskanPerkaraDariId(masukan: {
  perkaraId: string;
  nomorPerkara: string;
}): Promise<{ ok: true; perkaraId: string; nomorPerkara: string } | { ok: false; alasan: string; sebab: string }> {
  let perkaraId = String(masukan.perkaraId ?? "").trim();
  let nomorPerkara = String(masukan.nomorPerkara ?? "").trim();
  if (!/^\d{1,10}$/.test(perkaraId)) return { ok: true, perkaraId, nomorPerkara };

  const tautan = await getGatewaySippTautanPerkara({ perkaraId, nomor: nomorPerkara });
  if (!tautan.ok) {
    if (tautan.status === 409 || /nomor_tidak_cocok/.test(String(tautan.error || ""))) {
      return {
        ok: false,
        alasan: "perkara_id_nomor_beda",
        sebab:
          `perkara_id ${perkaraId} di SIPP bukan milik perkara ${nomorPerkara} - berkas TIDAK dikirim supaya tidak ` +
          "tertaut ke perkara lain. Muat ulang halaman perkaranya lalu ulangi.",
      };
    }
    return { ok: true, perkaraId, nomorPerkara };
  }
  const nomorSipp = String(tautan.data?.nomorPerkara ?? "").trim();
  const idSipp = String(tautan.data?.perkaraId ?? "").trim();
  if (!nomorPerkara && nomorSipp) nomorPerkara = nomorSipp;
  if (idSipp) perkaraId = idSipp;
  return { ok: true, perkaraId, nomorPerkara };
}
