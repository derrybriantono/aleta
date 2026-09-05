import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Membaca log penarikan e-Court, untuk dipantau dari portal.
 *
 * ============================================================================
 * LOG YANG SAMA PERSIS DENGAN YANG DILIHAT DARI PuTTY
 * ============================================================================
 *
 * /var/www/html/aleta-data/reports terpasang ke container portal di /app/reports
 * dan ke container bot di /usr/src/app/reports. Ketiganya folder yang sama.
 *
 * Karena itu layar pemantauan menampilkan log penarikan yang dimulai dari
 * portal MAUPUN yang dimulai dengan aleta-ecourt-unduh-latar.sh dari SSH.
 * Kalau hanya log dari portal yang terbaca, penarikan yang sudah berjalan
 * lewat PuTTY akan tampak seperti tidak ada - dan petugas akan memulai
 * penarikan kedua di atas yang pertama.
 *
 * ============================================================================
 * NAMA BERKAS TIDAK PERNAH DATANG DARI PERMINTAAN APA ADANYA
 * ============================================================================
 *
 * Rute ini membaca berkas dari disk berdasarkan nama yang dikirim peramban.
 * Nama seperti "../../etc/passwd" akan membaca berkas mana pun yang dapat
 * dijangkau proses portal. Karena itu nama dicocokkan ke pola yang ketat, dan
 * jalur hasilnya diperiksa ulang harus benar-benar berada di dalam folder log
 * setelah diselesaikan - dua lapis, karena pemeriksaan pola saja pernah
 * dilewati oleh penyandian yang tidak terduga.
 */

/** Folder log di dalam container portal. */
const FOLDER_LOG = process.env.ALETA_ECOURT_LOG_DIR || "/app/reports";

/**
 * Pola nama log yang boleh dibaca.
 *
 * Hanya log penarikan e-Court - folder reports juga memuat berkas lain yang
 * tidak ada urusannya dengan layar ini.
 */
const POLA_NAMA = /^ecourt-(unduh|tarik-ulang)-[0-9]{8}-[0-9]{6}\.log$/;

/** Berapa banyak isi log yang dikirim sekali baca. */
const POTONGAN_MAKS = 200 * 1024;

export type RingkasanLog = {
  nama: string;
  ukuran: number;
  diubahPada: string;
  jenis: "unduh" | "tarik-ulang";
  masihTumbuh: boolean;
};

/** Menyelesaikan nama menjadi jalur, atau null bila tidak sah. */
function jalurAman(nama: string) {
  if (!POLA_NAMA.test(nama)) return null;

  const jalur = path.resolve(FOLDER_LOG, nama);
  const folder = path.resolve(FOLDER_LOG);

  // Lapis kedua: hasil resolve HARUS berada di dalam folder log.
  if (jalur !== path.join(folder, path.basename(jalur))) return null;
  if (!jalur.startsWith(folder + path.sep)) return null;

  return jalur;
}

/**
 * Log yang masih tumbuh dianggap penarikan yang sedang berjalan.
 *
 * Dua menit, bukan beberapa detik: penarikan satu perkara dapat diam cukup
 * lama saat menunggu jawaban e-Court, dan menyatakannya berhenti padahal masih
 * jalan akan mendorong petugas memulai penarikan kedua.
 */
const AMBANG_TUMBUH_MS = 2 * 60 * 1000;

/** Daftar log penarikan, terbaru lebih dulu. */
export async function daftarLogPenarikan(batas = 20): Promise<RingkasanLog[]> {
  let isi: string[];
  try {
    isi = await fs.readdir(FOLDER_LOG);
  } catch {
    // Folder belum ada - belum pernah ada penarikan sama sekali.
    return [];
  }

  const hasil: RingkasanLog[] = [];
  const sekarang = Date.now();

  for (const nama of isi) {
    if (!POLA_NAMA.test(nama)) continue;
    const jalur = jalurAman(nama);
    if (!jalur) continue;

    try {
      const info = await fs.stat(jalur);
      if (!info.isFile()) continue;

      hasil.push({
        nama,
        ukuran: info.size,
        diubahPada: info.mtime.toISOString(),
        jenis: nama.startsWith("ecourt-tarik-ulang-") ? "tarik-ulang" : "unduh",
        masihTumbuh: sekarang - info.mtimeMs < AMBANG_TUMBUH_MS,
      });
    } catch {
      // Berkas hilang di antara readdir dan stat - lewati saja.
    }
  }

  hasil.sort((a, b) => b.diubahPada.localeCompare(a.diubahPada));
  return hasil.slice(0, Math.min(Math.max(batas, 1), 100));
}

export type PotonganLog = {
  nama: string;
  mulai: number;
  akhir: number;
  ukuran: number;
  isi: string;
  masihTumbuh: boolean;
};

/**
 * Membaca sepotong log dari posisi tertentu - padanan tail -f.
 *
 * Peramban menyimpan posisi terakhir lalu meminta lanjutannya, sehingga yang
 * berpindah lewat jaringan hanya baris baru. Membaca seluruh berkas tiap
 * beberapa detik akan mengirim ulang puluhan megabita yang sama.
 *
 * mulai < 0 berarti "seukuran potongan terakhir" - dipakai saat layar pertama
 * kali dibuka pada log yang sudah panjang.
 */
export async function bacaPotonganLog(
  namaMentah: string,
  mulaiMentah: number
): Promise<PotonganLog | null> {
  const nama = String(namaMentah || "").trim();
  const jalur = jalurAman(nama);
  if (!jalur) return null;

  let info;
  try {
    info = await fs.stat(jalur);
  } catch {
    return null;
  }
  if (!info.isFile()) return null;

  const ukuran = info.size;

  let mulai = Number(mulaiMentah);
  if (!Number.isFinite(mulai) || mulai < 0) {
    mulai = Math.max(0, ukuran - POTONGAN_MAKS);
  }

  // Berkas menyusut berarti ia diputar ulang atau diganti - mulai dari awal
  // alih-alih membaca dari posisi yang sudah tidak berarti apa-apa.
  if (mulai > ukuran) mulai = 0;

  const akhir = Math.min(ukuran, mulai + POTONGAN_MAKS);

  if (akhir <= mulai) {
    return { nama, mulai, akhir: mulai, ukuran, isi: "", masihTumbuh: Date.now() - info.mtimeMs < AMBANG_TUMBUH_MS };
  }

  const pegangan = await fs.open(jalur, "r");
  try {
    const penyangga = Buffer.alloc(akhir - mulai);
    await pegangan.read(penyangga, 0, penyangga.length, mulai);

    return {
      nama,
      mulai,
      akhir,
      ukuran,
      isi: penyangga.toString("utf8"),
      masihTumbuh: Date.now() - info.mtimeMs < AMBANG_TUMBUH_MS,
    };
  } finally {
    await pegangan.close();
  }
}
