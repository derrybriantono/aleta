"use client";

import { useEffect } from "react";

import { tanggalHariPanjang } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * CETAKAN STATUS PERKARA YANG TERBACA DI KERTAS
 * ============================================================================
 *
 * Dilaporkan pengguna 27 September 2026, dengan tangkapan pratinjau cetak
 * Chrome (A4 tegak, tujuh halaman, layar bertema gelap): kertasnya putih
 * tetapi tulisannya abu-abu pucat nyaris putih - label, angka "Lama perkara"
 * dan "Nilai kelengkapan", nama majelis, isi tabel tahapan.
 *
 * Sebabnya dua lapis, dan keduanya harus dibereskan:
 *
 *   1. TOKEN TEMA. Peramban tidak mencetak warna latar (kecuali diminta), jadi
 *      latar gelap hilang menjadi kertas putih - sedangkan warna tulisan tema
 *      gelap (--foreground 98% terang) tetap dicetak apa adanya.
 *
 *   2. WARNA TERTULIS KERAS DI VARIAN dark:. "text-amber-700 dark:text-amber-300"
 *      tidak memakai token sama sekali. Selama <html> berkelas .dark, yang
 *      berlaku amber-300 - kuning pucat yang di kertas putih tidak terbaca.
 *      Mengganti token saja tidak menyentuh ratusan kelas seperti ini.
 *
 * ============================================================================
 * KARENA ITU: TEMA TERANG SELAMA MENCETAK, LALU DIKEMBALIKAN
 * ============================================================================
 *
 * Saat peramban hendak mencetak (beforeprint) - lewat tombol Cetak maupun
 * Ctrl+P - kelas .dark dilepas sementara dari <html>, sehingga SELURUH varian
 * dark: berhenti berlaku dan tiap warna kembali ke pasangan terangnya yang
 * memang dirancang untuk latar putih. Sesudah dialog cetak ditutup
 * (afterprint), kelasnya dipasang kembali - hanya bila tadinya memang ada.
 *
 * Di dalam pembungkus halaman ini, token tema juga diganti dengan palet
 * KERTAS: putih bersih, tulisan hampir hitam, garis tepi abu-abu yang cukup
 * gelap untuk terlihat - bukan tema terang layar, yang garis tepinya (74%
 * terang) nyaris hilang di kertas. Palet ini tetap berlaku walau skrip tidak
 * sempat berjalan, sebagai lapis cadangan.
 *
 * Warna penanda (hijau/kuning/merah pada lencana, kartu angka, kotak Perlu
 * tindakan) dicetak dengan print-color-adjust: exact - tanpanya peramban
 * membuang latar lencana dan yang tersisa hanya tulisan, kehilangan artinya.
 *
 * ============================================================================
 * TERBATAS PADA HALAMAN INI
 * ============================================================================
 *
 * Aturan menyembunyikan navigasi hanya menyala bila <html> bertanda
 * data-cetak-halaman="status-perkara", dan tanda itu HANYA dipasang bila:
 *   - pembungkus Status Perkara ada di halaman, dan
 *   - tidak ada lembar cetak lain yang sedang ditempel ke <body> (hasil
 *     pencarian, jadwal sidang, relaas massal, riwayat bot - semuanya beri
 *     id berawalan "aleta-cetak-").
 * Lembar-lembar itu punya aturan cetaknya sendiri dan tidak berubah sedikit
 * pun. Aturan di sini pun hanya ada di halaman selama Status Perkara terbuka:
 * ia ditanam komponen bilah alatnya, bukan di globals.css.
 *
 * ============================================================================
 * BAGIAN YANG TERCIUT TIDAK DIBUKA SENDIRI
 * ============================================================================
 *
 * Yang tercetak adalah yang TAMPIL. Membuka seluruh dua puluh tujuh bagian
 * saat mencetak akan (1) mengubah tujuh halaman menjadi puluhan, dan (2)
 * mencetak nama dan keterangan para pihak - bagian yang sengaja terciut
 * sebagai bawaan karena data pribadi - tanpa pernah diputuskan pencetaknya.
 * Tombol "Buka semua" sudah ada tepat di sebelah tombol Cetak bagi yang
 * memang menginginkan seluruhnya.
 *
 * Supaya lembar yang tidak lengkap tidak terbaca sebagai lengkap, kepala tiap
 * bagian yang terciut diberi keterangan "(terciut)", dan kepala lembarnya
 * menyebut kapan dicetak serta bahwa bagian terciut hanya tercetak judulnya.
 */

/** Penanda pembungkus seluruh isi Status Perkara - dipasang di IsiStatus. */
export const PENANDA_PEMBUNGKUS_CETAK = "data-cetak-status-perkara";

/** Tanda pada <html> selama Status Perkara sedang dicetak. */
export const ATRIBUT_CETAK_HALAMAN = "data-cetak-halaman";
export const NILAI_CETAK_HALAMAN = "status-perkara";

/** Kalimat kepala lembar, dipasang pada pembungkus selama mencetak. */
export const ATRIBUT_CATATAN_CETAK = "data-cetak-catatan";

const W = `[${PENANDA_PEMBUNGKUS_CETAK}]`;
const H = `html[${ATRIBUT_CETAK_HALAMAN}="${NILAI_CETAK_HALAMAN}"]`;

/**
 * Palet kertas. Angkanya HSL tanpa pembungkus, sama bentuknya dengan token di
 * globals.css, sebab kelas Tailwind membacanya sebagai hsl(var(--token)).
 *
 *   --foreground         215 28% 12%  kontras terhadap putih +-16:1
 *   --muted-foreground   215 16% 32%  +-8:1 - label kecil tetap terbaca
 *                                     walau dicetak printer yang pucat
 *   --border             215 14% 58%  +-3:1 - garis tepi tampak, tidak
 *                                     menyaingi tulisan
 */
const PALET_KERTAS = `
    --background: 0 0% 100%;
    --foreground: 215 28% 12%;
    --card: 0 0% 100%;
    --card-foreground: 215 28% 12%;
    --primary: 201 70% 27%;
    --primary-foreground: 0 0% 100%;
    --secondary: 42 48% 92%;
    --secondary-foreground: 203 54% 18%;
    --muted: 210 20% 95%;
    --muted-foreground: 215 16% 32%;
    --accent: 198 64% 94%;
    --accent-foreground: 201 70% 24%;
    --destructive: 0 72% 42%;
    --destructive-foreground: 0 0% 100%;
    --border: 215 14% 58%;
    --input: 215 14% 58%;
    --ring: 201 70% 27%;`;

export const GAYA_CETAK_STATUS_PERKARA = `
@media print {
  ${H}, ${H} body {
    background: #fff !important;
    background-image: none !important;
    color-scheme: light;
  }

  /* Selain pembungkus, leluhurnya, dan isinya: tidak dicetak. Navigasi
     samping, kepala portal, menu e-Court, kotak pencarian - seluruhnya. */
  ${H} body *:not(:has(${W})):not(${W}):not(${W} *) {
    display: none !important;
  }

  /* Leluhur pembungkus dilucuti: tanpa bingkai, tanpa lapisan kaca, tanpa
     tinggi terpagar. Wadah bergulung setinggi layar akan memotong cetakan
     menjadi satu halaman saja. */
  ${H} body *:has(${W}) {
    display: block !important;
    position: static !important;
    width: auto !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: none !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    overflow: visible !important;
    transform: none !important;
  }

  ${W} {${PALET_KERTAS}
    color: hsl(var(--foreground));
    background: #fff;
    color-scheme: light;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /* Sisipan 2 px: tanpa bingkai leluhur, garis kanan tiap bagian jatuh
       TEPAT di tepi bidang cetak, dan pada bagian yang terbelah antarhalaman
       Chromium memangkasnya - terukur di PDF hasil cetak. */
    padding: 0 2px;
  }

  /* Tanpa peralihan: warna yang sedang beralih dari gelap ke terang tidak
     boleh tertangkap di tengah jalan. */
  ${W}, ${W} *, ${W} *::before, ${W} *::after {
    transition: none !important;
    animation: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  /* Kotak bergulung di layar dibuka penuh di kertas - isi yang tersembunyi
     di balik gulungan tidak dapat digulung di atas kertas. */
  ${W} [class*="overflow-y-auto"],
  ${W} [class*="overflow-auto"],
  ${W} [class*="overflow-x-auto"],
  ${W} [class*="max-h-"] {
    max-height: none !important;
    overflow: visible !important;
  }

  /* Nada 500-600 cukup terang di layar, tetapi pucat di kertas: text-
     emerald-600 (uang masuk di Biaya perkara) terukur 3,77:1 di atas putih.
     Digelapkan ke nada 700-nya (5,0-5,9:1) - warnanya tetap berarti sama.
     Dicocokkan per KELAS UTUH (~=), bukan potongan teks, supaya varian
     hover: atau dark: tidak ikut tertangkap. */
  ${W} [class~="text-emerald-500"], ${W} [class~="text-emerald-600"] { color: rgb(4 120 87); }
  ${W} [class~="text-green-500"], ${W} [class~="text-green-600"] { color: rgb(21 128 61); }
  ${W} [class~="text-amber-500"], ${W} [class~="text-amber-600"] { color: rgb(180 83 9); }
  ${W} [class~="text-sky-500"], ${W} [class~="text-sky-600"] { color: rgb(3 105 161); }

  ${W} tr, ${W} li, ${W} dl > div, ${W} div.rounded-xl, ${W} div.rounded-lg {
    break-inside: avoid;
  }
  ${W} h3, ${W} h4, ${W} h5, ${W} section > button {
    break-after: avoid;
  }

  /* Yang tidak tercetak DISEBUT, bukan dihilangkan diam-diam. Pendek saja -
     kalimat lengkapnya di kepala lembar; yang panjang di sini melipat judul
     bagian menjadi tiga baris karena berbagi tempat dengan keterangannya. */
  ${W} section > button[aria-expanded="false"] h5::after {
    content: " (terciut)";
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  ${W} details:not([open]) > summary::after {
    content: " (tertutup, isinya tidak tercetak)";
    font-weight: 400;
  }

  ${H} ${W}[${ATRIBUT_CATATAN_CETAK}]::before {
    content: attr(${ATRIBUT_CATATAN_CETAK});
    display: block;
    margin: 0 0 10px;
    padding: 0 0 6px;
    border-bottom: 1px solid hsl(var(--border));
    font-size: 9pt;
    line-height: 1.4;
    color: hsl(var(--muted-foreground));
  }
}
`;

/** Kalimat kepala lembar - kapan dicetak, dan apa yang tidak ikut. */
export function kalimatCatatanCetak(kini: Date = new Date()): string {
  // Jam PENGADILAN (WITA), bukan jam mesin yang mencetak - sama dengan lembar
  // cetak hasil pencarian.
  const { tanggal, jam } = waktuPengadilan(kini);
  const hari = tanggalHariPanjang(tanggal, tanggal);
  return `Dicetak dari ALETA, ${hari} pukul ${jam.slice(0, 5)} WITA. Bagian yang terciut di layar hanya tercetak judulnya.`;
}

/**
 * Menyiapkan dokumen untuk mencetak Status Perkara.
 *
 * @returns fungsi pemulih, atau null bila cetakan ini BUKAN milik Status
 *   Perkara (pembungkusnya tidak ada, atau lembar cetak lain sedang
 *   ditempel) - dalam hal itu tidak ada satu pun yang disentuh.
 */
export function mulaiCetakStatusPerkara(doc: Document, kini: Date = new Date()): (() => void) | null {
  const pembungkus = doc.querySelector<HTMLElement>(W);
  if (!pembungkus) return null;
  if (doc.querySelector('body > [id^="aleta-cetak-"]')) return null;

  const html = doc.documentElement;
  const tadinyaGelap = html.classList.contains("dark");

  html.setAttribute(ATRIBUT_CETAK_HALAMAN, NILAI_CETAK_HALAMAN);
  pembungkus.setAttribute(ATRIBUT_CATATAN_CETAK, kalimatCatatanCetak(kini));
  if (tadinyaGelap) html.classList.remove("dark");

  let sudahDipulihkan = false;
  return () => {
    if (sudahDipulihkan) return;
    sudahDipulihkan = true;
    html.removeAttribute(ATRIBUT_CETAK_HALAMAN);
    pembungkus.removeAttribute(ATRIBUT_CATATAN_CETAK);
    // Dipasang kembali HANYA bila tadinya ada. Memasangnya tanpa syarat akan
    // membuat layar bertema terang menjadi gelap sesudah mencetak.
    if (tadinyaGelap) html.classList.add("dark");
  };
}

/**
 * Mendengarkan beforeprint/afterprint selama Status Perkara terbuka.
 *
 * Lewat peristiwa peramban, bukan hanya lewat tombol Cetak: Ctrl+P dan menu
 * peramban mencetak halaman yang sama, dan cetakan itu harus sama terbacanya.
 */
export function useCetakStatusPerkara() {
  useEffect(() => {
    let pulihkan: (() => void) | null = null;
    const sebelum = () => {
      pulihkan?.();
      pulihkan = mulaiCetakStatusPerkara(document);
    };
    const sesudah = () => {
      pulihkan?.();
      pulihkan = null;
    };
    window.addEventListener("beforeprint", sebelum);
    window.addEventListener("afterprint", sesudah);
    return () => {
      window.removeEventListener("beforeprint", sebelum);
      window.removeEventListener("afterprint", sesudah);
      // Ditinggalkan di tengah mencetak - temanya tetap harus kembali.
      sesudah();
    };
  }, []);
}

/** Aturan cetaknya, ditanam selama Status Perkara terbuka. */
export function GayaCetakStatusPerkara() {
  return <style data-gaya-cetak-status-perkara="">{GAYA_CETAK_STATUS_PERKARA}</style>;
}
