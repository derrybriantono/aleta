import { useCallback, useEffect, useState } from "react";

import { withBasePath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * ============================================================================
 * ALAMAT HALAMAN PERKARA DI SIPP - DIMINTA SEKALI, SAAT PERKARA DIBUKA
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: "tombol buka sipp seharusnya diarahkan
 * ke halaman sipp perkaranya", dan "salin tautan ... diarahkan ke halaman sipp
 * perkaranya". Dulu keduanya menunjuk halaman ALETA - "Buka SIPP" ke
 * /aleta-sipp, "Salin tautan" ke layar Status Perkara ALETA sendiri.
 *
 * Alamatnya disusun PELADEN (GET /api/aleta-ecourt/sipp-tautan), bukan di
 * sini: alamat SIPP satker dan bentuk halaman perkaranya adalah pengaturan
 * peladen, dan peramban yang menyusunnya sendiri akan menyimpang diam-diam
 * begitu pengaturan itu berubah.
 *
 * Kontraknya: 200 { ok: true, data: { alamat, alasan } } - alamat mutlak ke
 * halaman perkara di SIPP, atau "" beserta alasan yang dapat dibaca petugas.
 *
 * ============================================================================
 * KENAPA DIMINTA LEBIH DAHULU, BUKAN SAAT TOMBOL DITEKAN
 * ============================================================================
 *
 * Peramban hanya membuka tab baru tanpa diblokir bila tab itu lahir LANGSUNG
 * dari klik. window.open yang menunggu jawaban peladen lebih dahulu sudah
 * bukan "langsung", dan pemblokir popup menahannya. Jalan memutarnya - membuka
 * tab kosong saat klik lalu mengarahkannya - meninggalkan tab about:blank
 * yang harus ditutup tangan setiap kali alamatnya ternyata tidak ada.
 *
 * Karena itu alamatnya diminta SEKALI saat perkara terbuka, lalu tombolnya
 * menjadi tautan <a target="_blank"> biasa: tidak pernah diblokir, dapat
 * diklik-tengah, dan "Salin alamat tautan" di menu klik-kanan pun berfungsi.
 * Menyalin ke papan klip juga butuh alamat yang sudah ada di tangan - di
 * peladen satker yang bukan HTTPS, salinan hanya diizinkan di dalam klik itu
 * sendiri, bukan sesudah menunggu jaringan.
 *
 * Permintaannya ringan dan tidak membocorkan apa pun yang baru: peladen yang
 * menjawabnya baru saja menyajikan status perkara yang sama.
 */

export const RUTE_TAUTAN_SIPP = "/api/aleta-ecourt/sipp-tautan";

/** Batas tunggu. Sama dengan gerbang portal ke bot - lebih dari itu, jawabannya tidak akan datang. */
export const BATAS_TUNGGU_TAUTAN_MS = 8000;

export type TautanSipp =
  | { keadaan: "memuat" }
  /** Alamat halaman perkara di SIPP, siap dibuka dan disalin. */
  | { keadaan: "ada"; alamat: string }
  /** Peladen menjawab, tetapi alamatnya tidak dapat disusun - alasannya dari peladen. */
  | { keadaan: "tidak-ada"; alasan: string }
  /** Peladen tidak menjawab dengan benar: jaringan, rute, sesi, atau batas tunggu. */
  | { keadaan: "gagal"; alasan: string };

export type TautanSippSelesai = Exclude<TautanSipp, { keadaan: "memuat" }>;

export function alamatPermintaanTautanSipp(perkaraId: string, nomorPerkara: string): string {
  const kueri = new URLSearchParams();
  if (perkaraId) kueri.set("perkaraId", perkaraId);
  if (nomorPerkara) kueri.set("nomor", nomorPerkara);
  return withBasePath(`${RUTE_TAUTAN_SIPP}?${kueri.toString()}`);
}

/**
 * Hanya alamat http/https MUTLAK yang boleh menjadi href.
 *
 * Alamat ini dipasang ke <a href> dan disalin ke pesan orang lain. Alamat
 * "javascript:" atau jalur relatif - dari rute yang keliru atau dari data yang
 * tercemar - akan menjadi tautan yang menjalankan kode atau mendarat di
 * halaman ALETA sendiri. Keduanya ditolak di sini, bukan dipercaya.
 */
export function alamatSippSah(alamat: unknown): string {
  const teks = String(alamat ?? "").trim();
  if (!/^https?:\/\//i.test(teks)) return "";
  try {
    const url = new URL(teks);
    return url.protocol === "http:" || url.protocol === "https:" ? teks : "";
  } catch {
    return "";
  }
}

type Pengambil = (masukan: string, init?: RequestInit) => Promise<Response>;

/**
 * Meminta alamat halaman perkara di SIPP kepada portal.
 *
 * Tidak pernah melempar - kecuali pembatalan dari yang memanggil, yang memang
 * harus sampai ke sana supaya jawaban perkara lama tidak menimpa perkara baru.
 * Seluruh kegagalan lain menjadi kalimat untuk petugas.
 */
export async function mintaTautanSipp({
  perkaraId,
  nomorPerkara,
  ambil = (masukan, init) => fetch(masukan, init),
  sinyal,
  batasMs = BATAS_TUNGGU_TAUTAN_MS,
}: {
  perkaraId: string;
  nomorPerkara: string;
  ambil?: Pengambil;
  sinyal?: AbortSignal;
  batasMs?: number;
}): Promise<TautanSippSelesai> {
  if (!String(perkaraId || "").trim() && !String(nomorPerkara || "").trim()) {
    return { keadaan: "tidak-ada", alasan: "Nomor perkara belum diketahui, jadi alamat SIPP-nya tidak dapat disusun." };
  }

  // Pembatal sendiri untuk batas tunggu, disambungkan ke pembatal pemanggil.
  const pembatal = new AbortController();
  let habisWaktu = false;
  const pewaktu = setTimeout(() => {
    habisWaktu = true;
    pembatal.abort();
  }, batasMs);
  const teruskan = () => pembatal.abort();
  sinyal?.addEventListener("abort", teruskan);

  try {
    let jawaban: Response;
    try {
      jawaban = await ambil(alamatPermintaanTautanSipp(String(perkaraId || "").trim(), String(nomorPerkara || "").trim()), {
        cache: "no-store",
        signal: pembatal.signal,
      });
    } catch (galat) {
      if (sinyal?.aborted) throw galat;
      if (habisWaktu) {
        return {
          keadaan: "gagal",
          alasan: `ALETA tidak menjawab dalam ${Math.round(batasMs / 1000)} detik saat menyusun alamat SIPP.`,
        };
      }
      return { keadaan: "gagal", alasan: "ALETA tidak dapat dihubungi untuk menyusun alamat SIPP." };
    }

    let isi: unknown = null;
    try {
      isi = await jawaban.json();
    } catch {
      isi = null;
    }

    if (!jawaban.ok) {
      // 404 tanpa badan JSON = rutenya belum terpasang di peladen ini (portal
      // lama). Disebut begitu, bukan "gagal" yang tidak menjelaskan apa pun.
      const cadangan =
        jawaban.status === 404
          ? "Portal ALETA di peladen ini belum dapat menyusun alamat SIPP (rute sipp-tautan belum terpasang)."
          : `ALETA gagal menyusun alamat SIPP (HTTP ${jawaban.status}).`;
      return { keadaan: "gagal", alasan: pesanGalatPortal(isi, cadangan) };
    }

    const badan = (isi && typeof isi === "object" ? isi : {}) as { ok?: unknown; data?: unknown };
    if (badan.ok === false) {
      return { keadaan: "gagal", alasan: pesanGalatPortal(isi, "ALETA gagal menyusun alamat SIPP.") };
    }
    const data = (badan.data && typeof badan.data === "object" ? badan.data : badan) as {
      alamat?: unknown;
      alasan?: unknown;
    };

    const mentah = String(data.alamat ?? "").trim();
    const alamat = alamatSippSah(mentah);
    if (alamat) return { keadaan: "ada", alamat };

    const alasan = String(data.alasan ?? "").trim();
    if (mentah) {
      // Ada alamat, tetapi bukan alamat http(s) mutlak. Tidak dipasang.
      return { keadaan: "gagal", alasan: "Alamat SIPP yang diterima tidak sah, jadi tidak dipakai." };
    }
    return { keadaan: "tidak-ada", alasan: alasan || "Alamat halaman perkara di SIPP tidak tersedia." };
  } finally {
    clearTimeout(pewaktu);
    sinyal?.removeEventListener("abort", teruskan);
  }
}

/**
 * Alamat SIPP untuk perkara yang sedang terbuka.
 *
 * Diminta ulang hanya bila perkaranya berganti, atau bila `ulangi` dipanggil
 * sesudah gagal. Jawaban untuk perkara yang sudah ditinggalkan dibuang - bukan
 * digambar pada perkara berikutnya.
 */
export function useTautanSipp(
  perkaraId: string,
  nomorPerkara: string,
  ambil?: Pengambil
): { tautan: TautanSipp; ulangi: () => void } {
  const [putaran, setPutaran] = useState(0);
  // Jawaban disimpan BERSAMA kunci permintaannya. "Memuat" tidak disetel di
  // dalam efek - ia turunan: jawaban yang kuncinya bukan kunci sekarang
  // berarti permintaan untuk perkara ini belum dijawab. Dengan begitu
  // jawaban perkara lama tidak pernah tergambar pada perkara baru, walau
  // hanya sekejap.
  const kunci = `${perkaraId}\u0000${nomorPerkara}\u0000${putaran}`;
  const [jawaban, setJawaban] = useState<{ kunci: string; hasil: TautanSippSelesai } | null>(null);

  useEffect(() => {
    const pembatal = new AbortController();
    const kunciIni = `${perkaraId}\u0000${nomorPerkara}\u0000${putaran}`;
    mintaTautanSipp({ perkaraId, nomorPerkara, ambil, sinyal: pembatal.signal })
      .then((hasil) => {
        if (!pembatal.signal.aborted) setJawaban({ kunci: kunciIni, hasil });
      })
      .catch(() => {
        // Hanya pembatalan yang sampai ke sini - perkaranya sudah berganti.
      });
    return () => pembatal.abort();
    // `ambil` sengaja tidak ikut: pemanggil boleh mengirim fungsi baru tiap
    // gambar, dan memintanya ulang tiap gambar berarti banjir permintaan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perkaraId, nomorPerkara, putaran]);

  const ulangi = useCallback(() => setPutaran((n) => n + 1), []);
  const tautan: TautanSipp = jawaban && jawaban.kunci === kunci ? jawaban.hasil : { keadaan: "memuat" };
  return { tautan, ulangi };
}
