import type { DataEvidenSkp, KunciPeriodeSkp, PeranEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  PESAN_PERIODE_BELUM_DIMULAI,
  mulaiPeriodeEvidenSkp,
  periodeEvidenSkpSah,
  peranEvidenSkpSah,
} from "@/lib/eviden-skp-unduh";
import { bacaIdSipp } from "@/lib/rekap-petugas";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getGatewayEvidenSkp } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * DATA EVIDEN SKP DARI BOT (2.40.0)
 * ============================================================================
 *
 * Mengambil DataEvidenSkp dari bot (rute gateway /sipp/eviden-skp). Tanda
 * tangan ambilDataEvidenSkp adalah KONTRAK dengan rute unduhan dan rute daftar
 * dokumen - jangan diubah tanpa menyelaraskan pemakainya.
 *
 * Kegagalan selalu { ok:false, status, alasan } dengan `alasan` berupa kalimat
 * untuk petugas - kalimat bot diteruskan apa adanya, sebab bot yang tahu
 * bagian SIPP mana yang tidak terbaca. gatewayFetch tidak membawa kode HTTP
 * bot, jadi statusnya dibaca dari kalimat yang BOT SENDIRI tulis
 * (evidenSkpService.periksaMasukan dan evidenSkp) - uji eviden-skp-rute
 * mengunci keduanya bersamaan.
 */
export type HasilDataEvidenSkp =
  | { ok: true; data: DataEvidenSkp }
  | { ok: false; status: number; alasan: string };

export type PermintaanEvidenSkp = {
  peran: PeranEvidenSkp;
  id: number;
  tahun: number;
  periode: KunciPeriodeSkp;
};

/**
 * Hari pertama periode. Kini SATU fungsi dengan rute unduhan
 * (mulaiPeriodeEvidenSkp) - nama ini dipertahankan untuk pemakai lama.
 */
export const mulaiPeriodeSkp = mulaiPeriodeEvidenSkp;

/**
 * ?peran=&id=&tahun=&periode= untuk rute daftar dokumen. Kalimat penolakannya
 * sama dengan rute unduhan (bacaPermintaanUnduhEvidenSkp) - alamat keduanya
 * dibagikan dan dibaca petugas yang sama.
 */
export function bacaPermintaanEvidenSkp(
  p: URLSearchParams,
  hariIni: string = waktuPengadilan().tanggal
): { ok: true; nilai: PermintaanEvidenSkp } | { ok: false; pesan: string } {
  const peran = String(p.get("peran") ?? "").trim().toLowerCase();
  if (!peranEvidenSkpSah(peran)) {
    return { ok: false, pesan: "Peran eviden SKP yang dapat diunduh saat ini hanya hakim." };
  }
  const id = bacaIdSipp(p.get("id"));
  if (id === null) return { ok: false, pesan: "ID SIPP harus bilangan bulat positif." };

  const tahunTeks = String(p.get("tahun") ?? "").trim();
  const tahun = Number(tahunTeks);
  if (!/^\d{4}$/.test(tahunTeks) || tahun < 2000 || tahun > 2100) {
    return { ok: false, pesan: "Tahun harus empat angka antara 2000 dan 2100." };
  }
  const periode = String(p.get("periode") ?? "").trim().toLowerCase();
  if (!periodeEvidenSkpSah(periode)) {
    return { ok: false, pesan: "Periode harus tw1, tw2, tw3, tw4, atau tahun." };
  }
  // Satu aturan dan satu kalimat dengan rute unduhan (lib/eviden-skp-unduh).
  if (hariIni && mulaiPeriodeEvidenSkp(periode, tahun) > hariIni) {
    return { ok: false, pesan: PESAN_PERIODE_BELUM_DIMULAI };
  }
  return { ok: true, nilai: { peran, id, tahun, periode } };
}

/**
 * Kode HTTP dari kalimat kegagalan. Kalimat bot: lihat evidenSkpService
 * (periksaMasukan: 400; "Tidak ada hakim dengan ID SIPP": 404; "SIPP tidak
 * dapat dibaca": 502). Kalimat gatewayFetch: bot mati 503, habis waktu 504.
 */
export function statusGagalEvidenSkp(pesan: string): number {
  const teks = String(pesan ?? "");
  if (/^Tidak ada \S+ dengan ID SIPP/i.test(teks)) return 404;
  if (/belum dimulai|harus bilangan bulat|harus empat angka|harus tw1|Peran eviden SKP/i.test(teks)) return 400;
  if (/tidak dapat dihubungi/i.test(teks)) return 503;
  if (/tidak merespons/i.test(teks)) return 504;
  return 502;
}

/** Bentuk jawaban bot yang dapat disusun katalog - diperiksa, bukan dipercaya. */
function bentuknyaData(nilai: unknown): nilai is DataEvidenSkp {
  const d = nilai as Partial<DataEvidenSkp> | null;
  return Boolean(
    d &&
      d.ok === true &&
      Array.isArray(d.baris) &&
      Array.isArray(d.galat) &&
      Array.isArray(d.catatan) &&
      d.periode &&
      typeof d.periode.mulai === "string" &&
      typeof d.periode.selesai === "string" &&
      d.orang &&
      typeof d.orang.nama === "string"
  );
}

export async function ambilDataEvidenSkp(p: {
  peran: PeranEvidenSkp;
  id: string;
  tahun: number;
  periode: KunciPeriodeSkp;
}): Promise<HasilDataEvidenSkp> {
  // Pintu kedua: pemanggil sudah memeriksa alamatnya, tetapi fungsi ini juga
  // kontrak - masukan yang salah tidak diteruskan ke bot.
  if (!peranEvidenSkpSah(p.peran)) {
    return { ok: false, status: 400, alasan: "Peran eviden SKP yang dapat diunduh saat ini hanya hakim." };
  }
  if (bacaIdSipp(p.id) === null) return { ok: false, status: 400, alasan: "ID SIPP harus bilangan bulat positif." };
  if (!Number.isInteger(p.tahun) || p.tahun < 2000 || p.tahun > 2100) {
    return { ok: false, status: 400, alasan: "Tahun harus empat angka antara 2000 dan 2100." };
  }
  if (!periodeEvidenSkpSah(p.periode)) {
    return { ok: false, status: 400, alasan: "Periode harus tw1, tw2, tw3, tw4, atau tahun." };
  }

  const hasil = await getGatewayEvidenSkp({ peran: p.peran, id: String(bacaIdSipp(p.id)), tahun: p.tahun, periode: p.periode });
  if (!hasil.ok) {
    const alasan = String(hasil.error || "").trim() || "ALETA Bot belum dapat dihubungi.";
    return { ok: false, status: statusGagalEvidenSkp(alasan), alasan };
  }
  if (!bentuknyaData(hasil.data)) {
    return {
      ok: false,
      status: 502,
      alasan: "Jawaban ALETA Bot bukan data eviden SKP - kemungkinan bot masih versi lama dan perlu dibangun ulang.",
    };
  }
  return { ok: true, data: hasil.data };
}
