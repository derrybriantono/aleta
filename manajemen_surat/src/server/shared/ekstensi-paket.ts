import { createHash } from "node:crypto";

import { kunciPublikDer } from "@/server/shared/crx";
import { EKSTENSI_BERKAS, EKSTENSI_BINER } from "@/server/shared/ekstensi-berkas";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

/**
 * Manifest ekstensi, dengan kunci publik disisipkan.
 *
 * ============================================================================
 * SUPAYA ZIP DAN .CRX BERJATI DIRI SAMA
 * ============================================================================
 *
 * Chrome menurunkan ID ekstensi dari kunci publiknya. Paket .crx membawa kunci
 * itu di dalam tanda tangannya, tetapi folder yang dimuat "Load unpacked"
 * TIDAK - Chrome mengarang ID untuknya dari letak foldernya.
 *
 * Akibatnya, tanpa penyisipan ini, satu komputer dapat memuat DUA salinan
 * sekaligus: yang lama dari folder dan yang baru dari kebijakan. Keduanya
 * menempel ke halaman SIPP yang sama, dan panelnya muncul dobel - gejala yang
 * tampak seperti kerusakan, bukan seperti salah pasang.
 *
 * Ruas "key" pada manifest menghapus perbedaan itu: folder pun memakai ID yang
 * sama dengan paketnya.
 *
 * Kunci publiknya DITURUNKAN dari kunci penanda tangan saat diminta, bukan
 * ditulis terpisah di dalam manifest. Dua salinan yang seharusnya sama adalah
 * sumber kekeliruan paling mahal di proyek ini - dan bila keduanya berselisih,
 * Chrome menolak paketnya dengan keterangan "package is invalid" saja.
 */
function isiManifest(): string {
  const asli = EKSTENSI_BERKAS["manifest.json"] || "";
  const kunci = kunciCrx();
  if (!kunci) return asli;
  try {
    const manifest = JSON.parse(asli);
    manifest.key = kunciPublikDer(kunci).toString("base64");
    return JSON.stringify(manifest, null, 2);
  } catch {
    // Kunci yang tidak terbaca tidak boleh membuat ekstensi gagal diunduh.
    // Yang hilang hanya kesamaan ID, dan itu ketahuan saat memasang.
    return asli;
  }
}

/**
 * Skrip Windows (.cmd/.ps1) disajikan dengan akhir baris CRLF. Repositori
 * menyimpan semuanya dengan LF, sedangkan cmd.exe dapat salah menguraikan
 * berkas .cmd ber-LF saja. Teks lain tidak disentuh.
 */
function akhirBarisWindows(nama: string, isi: string): string {
  return /\.(?:cmd|ps1)$/i.test(nama) ? isi.replace(/\r?\n/g, "\r\n") : isi;
}

/**
 * Berkas yang tertanam (disajikan rute lain) tetapi TIDAK dimasukkan ke ZIP/.crx.
 *
 * Pemasang dan pembantu macOS (26 Okt 2026) disajikan rute pemasang (?os=mac).
 * Bila ikut ZIP, pembantu Windows yang SUDAH terpasang di komputer petugas
 * menolak seluruh paket ("jenis berkas tidak diizinkan": ia hanya mengenal
 * js/css/html/json/png/md/txt/ps1/cmd) dan pembaruan otomatis Windows berhenti.
 */
export const BERKAS_TANPA_ZIP: ReadonlySet<string> = new Set([
  "pembaru/pembaru-aleta.sh",
  "pembaru/pasang-pembaru-aleta.command",
]);

/**
 * Menyusun isi ekstensi menjadi satu ZIP.
 *
 * ============================================================================
 * DUA BENTUK, SATU SUMBER
 * ============================================================================
 *
 * ZIP untuk diunduh petugas memakai awalan folder "ekstensi-sipp/" supaya yang
 * membukanya tidak menumpahkan belasan berkas ke folder unduhan.
 *
 * ZIP di dalam .crx TIDAK BOLEH berawalan: Chrome mencari manifest.json tepat
 * di akar, dan menolak paketnya bila tidak ada di situ - dengan keterangan
 * "package is invalid" yang tidak menyebutkan sebabnya.
 *
 * Karena itu keduanya disusun dari daftar yang sama dengan satu saklar awalan,
 * bukan dari dua salinan kode yang akan berselisih diam-diam.
 */
export function berkasEkstensi(awalan: string): BerkasZip[] {
  const namai = (nama: string) => (awalan ? `${awalan}/${nama}` : nama);
  return [
    ...Object.entries(EKSTENSI_BERKAS)
      .filter(([nama]) => !BERKAS_TANPA_ZIP.has(nama))
      .map(([nama, isi]) => ({
        nama: namai(nama),
        isi: Buffer.from(nama === "manifest.json" ? isiManifest() : akhirBarisWindows(nama, isi), "utf8"),
      })),
    // Ikon disandikan base64 saat ditanam - PNG tidak selamat melewati utf8.
    // Tanpa ikon, Chrome MENOLAK memasang ekstensinya sama sekali, karena
    // manifest menunjuk berkas yang tidak ada.
    ...Object.entries(EKSTENSI_BINER).map(([nama, isi]) => ({
      nama: namai(nama),
      isi: Buffer.from(isi, "base64"),
    })),
  ];
}

/** ZIP dengan berkas di AKAR - bentuk yang dituntut isi .crx. */
export function zipEkstensiAkar(): Buffer {
  return susunZip(berkasEkstensi(""));
}

/** Versi ekstensi menurut manifest yang ditanam. */
export function versiEkstensi(): string {
  try {
    return String(JSON.parse(EKSTENSI_BERKAS["manifest.json"] || "{}").version || "");
  } catch {
    return "";
  }
}

/**
 * Kunci penanda tangan .crx, dibaca dari lingkungan server.
 *
 * TIDAK disimpan di dalam kode. Kunci menentukan jati diri ekstensi di mata
 * Chrome: yang berganti berarti ekstensi yang sama sekali lain, dan kebijakan
 * di tiap komputer harus disetel ulang satu per satu. Karena itu ia harus
 * dicadangkan di luar server.
 *
 * Menerima isi PEM langsung, atau PEM yang barisnya digabung dengan "\n"
 * harfiah - berkas .env kerap tidak menyimpan baris baru dengan utuh.
 */
export function kunciCrx(): string {
  const mentah = String(process.env.ALETA_EKSTENSI_CRX_KEY || "").trim();
  if (!mentah) return "";
  return mentah.includes("\\n") ? mentah.replace(/\\n/g, "\n") : mentah;
}

/** ZIP unduhan petugas (berawalan folder "ekstensi-sipp/") - satu rumus untuk rute unduh dan pembaru. */
export function zipEkstensiUnduh(): Buffer {
  return susunZip(berkasEkstensi("ekstensi-sipp"));
}

export type SidikPaket = { versi: string; sha256: string; ukuran: number };

let ingatanSidik: { kunci: string; nilai: SidikPaket } | null = null;

/**
 * Versi, SHA-256, dan ukuran ZIP yang disajikan rute pembaru.
 *
 * ZIP-nya deterministik (waktu tetap, tanpa pemampatan), jadi sidik ini sama
 * setiap kali selama isi tertanam dan kunci .crx tidak berubah. Diingat per
 * proses supaya pemeriksaan berkala dari puluhan komputer tidak menyusun ulang
 * 17 MB setiap kali.
 */
export function sidikPaketEkstensi(): SidikPaket {
  const versi = versiEkstensi();
  const kunci = `${versi}|${createHash("sha256").update(kunciCrx()).digest("hex")}|${Object.keys(EKSTENSI_BERKAS).length}`;
  if (ingatanSidik && ingatanSidik.kunci === kunci) return ingatanSidik.nilai;
  const zip = zipEkstensiUnduh();
  const nilai: SidikPaket = { versi, sha256: createHash("sha256").update(zip).digest("hex"), ukuran: zip.length };
  ingatanSidik = { kunci, nilai };
  return nilai;
}
