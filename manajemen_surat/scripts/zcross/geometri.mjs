// Z cross otomatis - geometri murni (tanpa soffice) supaya aturannya dapat diuji sendiri. Satuan: poin PDF, titik asal kiri-atas.
import { CM } from "./lintasan1.mjs";

export const RUANG_MIN_GARIS_ATAS = 3 * CM; // ruang di samping kata terakhir; kurang dari ini = rapatkan
export const JARAK_BAWAH_HALAMAN = 3 * CM; // garis bawah +-3 cm di atas batas bawah halaman
const TINGGI_TANGGAL = 15;
const SISA_TEPI_TANGGAL = 1.2 * CM; // tanggal tidak boleh menempel tepi kertas

/**
 * Aturan Derry: garis atas SELALU mulai di samping kata terakhir pada baris yang sama sampai batas kanan (tidak pernah di bawah paragraf;
 * ruang < 3 cm = rapatkan jarak, bukan pindah); diagonal ke kiri bawah; garis bawah +-3 cm di atas batas bawah halaman; tanggal tepat di
 * bawah garis dan tidak menempel tepi kertas.
 * @param {{ kata:{x2:number}, baris:{y1:number,y2:number}, lebarHalaman:number, tinggiHalaman:number }} jangkar
 * @param {{ kiri:number, kanan:number, tanggal:string }} o
 */
export function rencanaZ(jangkar, { kiri, kanan, tanggal }) {
  const temuan = [];
  const { kata, baris, tinggiHalaman: H } = jangkar;
  const y = baris.y1 + 0.58 * (baris.y2 - baris.y1);
  const sisa = kanan - kata.x2;
  const rapat = sisa < RUANG_MIN_GARIS_ATAS;
  const x1 = kata.x2 + (rapat ? 1.5 : 4);
  if (rapat) temuan.push({ tingkat: "info", pesan: `Ruang di samping kata terakhir hanya ${(sisa / CM).toFixed(1)} cm (kurang dari 3 cm): jarak garis atas dirapatkan, garis tetap sebaris.` });
  if (kanan - x1 < 0.8 * CM) temuan.push({ tingkat: "peringatan", pesan: "Garis atas sangat pendek (kurang dari 0,8 cm): kata terakhir hampir menyentuh batas kanan." });

  let yBawah = H - JARAK_BAWAH_HALAMAN;
  const terendah = H - SISA_TEPI_TANGGAL - TINGGI_TANGGAL - 2;
  const terdekat = baris.y2 + 1 * CM;
  if (yBawah < terdekat) {
    yBawah = terdekat;
    temuan.push({ tingkat: "info", pesan: "Kata terakhir dekat dasar halaman: garis bawah diturunkan dari 3 cm di atas tepi bawah." });
  }
  if (yBawah > terendah) {
    yBawah = terendah;
    temuan.push({ tingkat: "peringatan", pesan: "Ruang di bawah kata terakhir kurang dari 1 cm: Z dipadatkan, periksa tampilannya." });
  }
  return {
    atas: { x1, x2: kanan, y },
    diagonal: { x1: kanan, y1: y, x2: kiri, y2: yBawah },
    bawah: { x1: kiri, x2: kanan, y: yBawah },
    tanggal: { teks: tanggal, x: kiri, y: yBawah + 2, lebar: Math.min(kanan - kiri, 8 * CM), tinggi: TINGGI_TANGGAL },
    temuan,
  };
}

/** Nomor halaman bagian berikutnya = halaman Z + jumlah halaman bukti (+ tambah, bawaan 0 = rumus arahan T11 apa adanya). */
export const nomorBagianBerikutnya = (halamanZTampil, jumlahHalamanBukti, tambah = 0) => halamanZTampil + jumlahHalamanBukti + tambah;

export const TANGGAL_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** "31 Oktober 2026" menurut tanggal di zona Asia/Makassar (tanpa bergantung ICU). */
export function tanggalIndonesia(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-").map(Number);
  return `${p[2]} ${TANGGAL_BULAN[p[1] - 1]} ${p[0]}`;
}
