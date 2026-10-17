import { jenisNaskahDariAlamat, jenisNaskahDariNama, type JenisNaskah } from "@/lib/deteksi-sisa-blangko";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * ============================================================================
 * SATU PENANGANAN UNDUHAN BERKAS DI PORTAL (butir 31, 30 September 2026)
 * ============================================================================
 *
 * Jadwal Sidang > Rincian 574/Pdt.G/2026/PA.Dgl > "Relaas panggilan sidang
 * ini" > Relaas baris Tergugat: berkasnya TERUNDUH, tetapi tulisan merah
 * "Berkasnya kosong di server." tetap muncul.
 *
 * Sebabnya bukan server. Rute berkas-sipp mengirim Content-Length yang benar;
 * yang mengosongkan badan jawaban di sisi PERAMBAN adalah pengelola unduhan
 * yang mengambil alih unduhan fetch/XHR (IDM dan sejenisnya menangkap jawaban
 * ber-Content-Disposition, mengunduhnya sendiri, dan menyisakan badan kosong
 * bagi halaman). Halaman lalu membaca blob 0 bita dan menyebutnya kosong -
 * padahal berkasnya sudah di folder Unduhan.
 *
 * Aturannya kini satu, untuk setiap tombol unduh:
 *   - jawaban galat / JSON              -> pesan galat dari server
 *   - badan berisi                      -> diunduh lewat tautan blob
 *   - badan 0 bita, Content-Length 0    -> SUNGGUH kosong: pesan galat
 *   - badan 0 bita, Content-Length > 0  -> diambil alih pengelola unduhan:
 *                                          BERHASIL, tanpa pesan merah, dan
 *                                          tanpa tautan blob kedua (yang akan
 *                                          melahirkan berkas 0 bita kembar)
 *   - badan 0 bita, tanpa Content-Length -> tidak dapat dipastikan: diserahkan
 *                                          ke navigasi unduhan biasa peramban
 *                                          (tidak ada pesan merah)
 */

export type HasilUnduhan =
  | { ok: true; nama: string; cara: "blob" | "diambil-alih" | "navigasi" }
  | { ok: false; pesan: string; dibatalkan?: boolean };

export type PemicuUnduhan = {
  /** Menyimpan blob sebagai berkas (tautan <a download>). */
  simpanBlob: (blob: Blob, nama: string) => void;
  /** Membuka alamat unduhan biasa - peramban/pengelola unduhan yang menanganinya. */
  navigasi: (alamat: string) => void;
};

export function namaDariDisposisi(disposisi: string | null | undefined): string {
  const cocok = String(disposisi || "").match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!cocok) return "";
  try {
    return decodeURIComponent(cocok[1]);
  } catch {
    return cocok[1];
  }
}

/** Pemicu sungguhan di peramban. */
export function pemicuPeramban(): PemicuUnduhan {
  return {
    simpanBlob(blob, nama) {
      const url = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = url;
      tautan.download = nama;
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
      // Tidak dilepas seketika: peramban masih membaca blobnya sesudah klik.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    navigasi(alamat) {
      const tautan = document.createElement("a");
      tautan.href = alamat;
      tautan.rel = "noopener";
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
    },
  };
}

/**
 * Menangani satu jawaban unduhan. `alamat` dipakai hanya untuk jalan
 * navigasi (badan kosong tanpa Content-Length).
 */
export async function tanganiUnduhan(
  respons: Response,
  opsi: {
    namaCadangan: string;
    /** Nama yang sudah dipastikan pemanggil (mis. dari filename* RFC 5987) - mengalahkan disposisi. */
    nama?: string;
    alamat?: string;
    pesanKosong?: string;
    pemicu?: PemicuUnduhan;
    /**
     * Jenis naskah untuk pemeriksaan sisa blangko sebelum diunduh (17 Okt 2026).
     * Tanpa ini ditebak dari alamat (berkas-sipp?jenis=relaas|bas|putusan) lalu nama berkas.
     * false = jangan periksa sama sekali.
     */
    jenisNaskah?: JenisNaskah | "" | false;
  }
): Promise<HasilUnduhan> {
  const pemicu = opsi.pemicu ?? pemicuPeramban();
  const tipe = respons.headers.get("content-type") || "";
  // Jawaban galat berbentuk JSON tidak boleh tersimpan sebagai berkas.
  if (!respons.ok || tipe.includes("application/json")) {
    const isi = await respons.json().catch(() => null);
    return { ok: false, pesan: pesanGalatPortal(isi, `HTTP ${respons.status}`).replace(/_/g, " ") };
  }

  const nama = opsi.nama || namaDariDisposisi(respons.headers.get("content-disposition")) || opsi.namaCadangan;
  const blob = await respons.blob();
  if (blob.size > 0) {
    // Putusan, BAS, dan relaas diperiksa dulu: bila masih ada sisa blangko petugas
    // diperingatkan (tetap boleh lanjut). Tanpa temuan -> alur lama persis.
    if (opsi.jenisNaskah !== false) {
      const jenis = opsi.jenisNaskah || jenisNaskahDariAlamat(opsi.alamat) || jenisNaskahDariNama(nama);
      if (jenis) {
        let batalkan = false;
        try {
          const { tinjauSisaBlangko } = await import("@/lib/dialog-sisa-blangko");
          const tinjau = await tinjauSisaBlangko(blob, { nama, jenis, aksi: "unduh" });
          batalkan = tinjau.lanjut === false;
        } catch {
          // Galat pemeriksa (termasuk gagal memuat modul dialog) TIDAK BOLEH menahan unduhan.
          batalkan = false;
        }
        if (batalkan) return { ok: false, pesan: "Unduhan dibatalkan.", dibatalkan: true };
      }
    }
    pemicu.simpanBlob(blob, nama);
    return { ok: true, nama, cara: "blob" };
  }

  const panjangMentah = respons.headers.get("content-length");
  const panjang = panjangMentah === null ? NaN : Number(panjangMentah);
  if (panjang === 0) {
    return { ok: false, pesan: opsi.pesanKosong || "Berkasnya kosong di server." };
  }
  if (Number.isFinite(panjang) && panjang > 0) {
    // Server mengirim isinya, peramban tidak menyerahkannya ke halaman:
    // pengelola unduhan sudah mengambilnya. Bukan galat.
    return { ok: true, nama, cara: "diambil-alih" };
  }
  if (opsi.alamat) {
    pemicu.navigasi(opsi.alamat);
    return { ok: true, nama, cara: "navigasi" };
  }
  return { ok: false, pesan: opsi.pesanKosong || "Berkasnya kosong di server." };
}
