/**
 * ============================================================================
 * ALAMAT HALAMAN SATU PERKARA DI SIPP
 * ============================================================================
 *
 * Tombol "Buka SIPP" dan "Salin tautan" di Status Perkara membawa petugas ke
 * halaman PERKARANYA di SIPP, bukan ke berandanya. Alamatnya tersusun dari dua
 * bagian yang sengaja disusun di dua tempat:
 *
 *   dasar  - ALETA_SIPP_BASE_URL: alamat SIPP menurut PERAMBAN petugas
 *            (http://192.168.10.10/SIPP di satker). Hanya portal yang tahu;
 *            bot melihat SIPP dari dalam container lewat alamat lain.
 *   jalur  - perkara_detil_agama/<enc>: disusun bot, sebab <enc> menuntut
 *            kunci SIPP - dan kunci itu tidak pernah meninggalkan bot.
 *
 * <enc> memakai IV acak seperti SIPP sendiri, jadi tiap permintaan memulangkan
 * alamat yang berbeda. Semuanya sah dan semuanya membuka perkara yang sama.
 *
 * ============================================================================
 * SELALU { alamat, alasan }
 * ============================================================================
 *
 * alamat "" berarti tidak ada tautan, dan alasan berisi kalimat yang dapat
 * ditampilkan kepada petugas apa adanya. Kegagalan bot tidak pernah menjadi
 * galat HTTP: tombolnya cukup menampilkan alasannya.
 *
 * Jalur dari bot tidak dipercaya begitu saja. Tautan ini DIKLIK orang, jadi
 * yang diteruskan menjadi alamat hanya pintu masuk detil perkara SIPP dengan
 * segmen base64 - bukan apa pun yang kebetulan dikirim balik.
 */
import { getGatewaySippTautanPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

export type TautanSippPerkara = {
  /** Alamat mutlak halaman perkara di SIPP, atau "" bila tidak dapat disusun. */
  alamat: string;
  /** Kalimat untuk petugas bila alamat kosong; "" bila alamat tersusun. */
  alasan: string;
};

/** Sama dengan bawaan alamatSipp di masuk-pejabat.ts: alamat SIPP satker. */
const DASAR_SIPP_BAWAAN = "http://192.168.10.10/SIPP";

/**
 * Pintu masuk detil perkara menurut cabang kolom [detil] perkara_list.php, dan
 * segmen base64 tanpa "/" maupun "+" - bentuk yang sama dengan
 * POLA_SEGMEN_AMAN di aleta_bot/services/sippTautanService.js.
 */
const POLA_JALUR = /^perkara_detil(?:_agama|_mil|_tun)?\/[A-Za-z0-9]+={0,2}$/;

/** perkara_id SIPP: bilangan bulat, kolom INT. */
const POLA_PERKARA_ID = /^\d{1,10}$/;

/** Nomor perkara SIPP sekitar 25 karakter; yang jauh lebih panjang bukan nomor. */
const PANJANG_NOMOR_MAKS = 100;

const AWALAN_GAGAL = "Alamat halaman perkara di SIPP belum dapat disusun.";

/**
 * Alamat mutlak dari jalur relatif.
 *
 * Garis miring di sambungan dirapatkan, begitu pula garis miring ganda di
 * dalam dasar yang ditulis tangan ("http://host//SIPP"). Dasar tanpa skema
 * diberi http:// - tanpa itu peramban membacanya sebagai alamat RELATIF
 * terhadap portal, dan tombolnya membuka halaman ALETA yang tidak ada.
 */
export function susunAlamatSipp(jalur: string): string {
  let dasar = String(process.env.ALETA_SIPP_BASE_URL ?? "").trim() || DASAR_SIPP_BAWAAN;
  if (!/^https?:\/\//i.test(dasar)) dasar = `http://${dasar.replace(/^\/+/, "")}`;
  return `${dasar.replace(/\/+$/, "")}/${String(jalur).replace(/^\/+/, "")}`.replace(/([^:/])\/{2,}/g, "$1/");
}

/**
 * Pesan menjadi kalimat yang diakhiri tanda baca. Huruf awalnya dibiarkan:
 * pesan gatewayFetch diawali nama layanan "aleta_bot", yang memang ditulis kecil.
 */
function kalimat(teks: string): string {
  const bersih = String(teks || "").trim();
  if (!bersih) return "ALETA Bot belum dapat dihubungi.";
  return /[.!?]$/.test(bersih) ? bersih : `${bersih}.`;
}

export async function tautanSippPerkara(masukan: {
  perkaraId?: string | null;
  nomor?: string | null;
}): Promise<TautanSippPerkara> {
  const perkaraId = String(masukan.perkaraId ?? "").trim();
  const nomor = String(masukan.nomor ?? "").trim();

  // Masukan yang jelas keliru ditolak di sini juga, bukan hanya di bot: tidak
  // perlu menempuh perjalanan ke bot untuk jawaban yang sudah pasti.
  if (!perkaraId && !nomor) {
    return { alamat: "", alasan: `${AWALAN_GAGAL} Perkara belum dipilih.` };
  }
  if (perkaraId && !POLA_PERKARA_ID.test(perkaraId)) {
    return { alamat: "", alasan: `${AWALAN_GAGAL} Pengenal perkara tidak sah.` };
  }
  if (nomor.length > PANJANG_NOMOR_MAKS) {
    return { alamat: "", alasan: `${AWALAN_GAGAL} Nomor perkara terlalu panjang.` };
  }

  const hasil = await getGatewaySippTautanPerkara({ perkaraId, nomor });
  if (!hasil.ok) {
    // Satu jalan untuk dua keadaan: bot yang menolak (pesannya kalimat sebab)
    // dan bot yang tidak terjangkau (pesannya dari gatewayFetch).
    return { alamat: "", alasan: `${AWALAN_GAGAL} ${kalimat(hasil.error)}` };
  }

  const jalur = String(hasil.data?.jalur ?? "");
  if (!POLA_JALUR.test(jalur)) {
    console.warn(`[sipp-tautan] jalur dari bot ditolak: ${jalur.slice(0, 60)}`);
    return {
      alamat: "",
      alasan: `${AWALAN_GAGAL} ALETA Bot mengirim jalur SIPP yang tidak dikenali. Laporkan ke pengelola ALETA.`,
    };
  }

  return { alamat: susunAlamatSipp(jalur), alasan: "" };
}
