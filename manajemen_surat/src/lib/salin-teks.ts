/**
 * ============================================================================
 * MENYALIN TEKS KE PAPAN KLIP - JUGA DI PELADEN SATKER YANG BUKAN HTTPS
 * ============================================================================
 *
 * Portal satker dibuka lewat http://192.168.10.10 - bukan HTTPS, bukan
 * localhost. Di sana peramban TIDAK menyediakan navigator.clipboard sama
 * sekali: API itu hanya ada pada konteks aman. Uji di mesin pengembang lewat
 * localhost tidak pernah memperlihatkannya, sebab localhost dianggap aman.
 *
 * Akibatnya tombol "Salin" yang hanya memanggil navigator.clipboard.writeText
 * di satker SELALU gagal - dan dulu gagalnya berbunyi "salin tangan dari
 * layar" untuk ringkasan yang justru tidak pernah tampil di layar.
 *
 * ============================================================================
 * DUA JALAN, BERURUTAN
 * ============================================================================
 *
 *   1. navigator.clipboard.writeText  - bila ada (HTTPS, localhost)
 *   2. textarea tersembunyi + document.execCommand("copy") - jalan lama yang
 *      masih dihormati peramban di luar konteks aman, selama dipanggil dari
 *      tindakan pengguna (klik)
 *
 * Bila API papan klip TIDAK ADA, jalan kedua dijalankan SEBELUM satu pun
 * `await` - masih di dalam klik yang sama. Menunggu apa pun lebih dahulu
 * dapat membuat peramban tidak lagi menganggapnya tindakan pengguna, dan
 * execCommand lalu menolak dalam diam.
 *
 * Bila keduanya gagal, jawabannya "gagal" - yang memanggil WAJIB
 * mengatakannya dan menyodorkan teksnya untuk disalin tangan. Diam berarti
 * penggunanya menempelkan isi papan klip yang lama.
 */

export type HasilSalin = "papan-klip" | "cadangan" | "gagal";

type LingkunganSalin = {
  navigator?: Pick<Navigator, "clipboard"> | null;
  document?: Document | null;
};

export async function salinTeks(teks: string, lingkungan: LingkunganSalin = {}): Promise<HasilSalin> {
  const nav =
    lingkungan.navigator !== undefined ? lingkungan.navigator : typeof navigator !== "undefined" ? navigator : null;
  const doc = lingkungan.document !== undefined ? lingkungan.document : typeof document !== "undefined" ? document : null;

  const papan = nav?.clipboard;
  if (papan && typeof papan.writeText === "function") {
    try {
      await papan.writeText(teks);
      return "papan-klip";
    } catch {
      // Ditolak (izin, dokumen tidak berfokus). Jalan kedua masih dicoba:
      // penolakan papan klip tidak berarti execCommand ikut ditolak.
    }
  }
  return salinLewatTextarea(teks, doc) ? "cadangan" : "gagal";
}

/**
 * Jalan kedua: textarea yang tidak terlihat, dipilih isinya, lalu disalin.
 *
 * Diletakkan tetap (fixed) di luar layar, bukan display:none - elemen yang
 * tidak digambar tidak dapat dipilih, dan yang tidak dipilih tidak tersalin.
 * Ukuran hurufnya 12pt supaya peramban ponsel tidak memperbesar halaman saat
 * textarea itu mendapat fokus sesaat.
 *
 * Fokus dan pilihan teks pengguna dipulihkan sesudahnya: tombol yang baru
 * ditekan kehilangan fokusnya adalah kejutan bagi yang memakai papan ketik.
 */
export function salinLewatTextarea(teks: string, doc: Document | null | undefined): boolean {
  if (!doc?.body || typeof doc.createElement !== "function") return false;

  const fokusSebelum = doc.activeElement as HTMLElement | null;
  const pilihan = typeof doc.getSelection === "function" ? doc.getSelection() : null;
  const rentangSebelum = pilihan && pilihan.rangeCount > 0 ? pilihan.getRangeAt(0) : null;

  const area = doc.createElement("textarea");
  area.value = teks;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.setAttribute("tabindex", "-1");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.opacity = "0";
  area.style.fontSize = "12pt";
  doc.body.appendChild(area);

  let berhasil = false;
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, teks.length);
    berhasil = typeof doc.execCommand === "function" && doc.execCommand("copy") === true;
  } catch {
    berhasil = false;
  } finally {
    area.remove();
    if (pilihan && rentangSebelum) {
      try {
        pilihan.removeAllRanges();
        pilihan.addRange(rentangSebelum);
      } catch {
        /* pilihan lama tidak dapat dipulihkan - tidak mengubah hasil salin */
      }
    }
    if (fokusSebelum && typeof fokusSebelum.focus === "function" && fokusSebelum !== doc.body) {
      try {
        fokusSebelum.focus({ preventScroll: true });
      } catch {
        /* lihat di atas */
      }
    }
  }
  return berhasil;
}
