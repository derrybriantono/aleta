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
    ...Object.entries(EKSTENSI_BERKAS).map(([nama, isi]) => ({
      nama: namai(nama),
      isi: Buffer.from(nama === "manifest.json" ? isiManifest() : isi, "utf8"),
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
