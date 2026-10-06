/**
 * ============================================================================
 * PEMBEBANAN SAAT IKRAR TALAK - ATURAN TAMPIL (TANPA REACT)
 * ============================================================================
 *
 * Diminta pengguna 6 Oktober 2026: "pada perkara yang ikrar talak tambahkan
 * dibawah putusan penanda ada pembebanan ... detailnya nanti dibuat di dalam
 * rincian".
 *
 * Datanya diurai bot dari amar putusan (aleta_bot/services/
 * pembebananIkrarService.js) - tabel nafkah SIPP praktis tidak pernah diisi.
 * Berkas ini hanya memutuskan KAPAN penanda tampil dan BAGAIMANA angkanya
 * dibaca, supaya keduanya dapat diuji tanpa menggambar layar.
 */

import { sidangIkrar } from "@/lib/keadaan-sidang";

export type JenisPembebanan = "mutah" | "iddah" | "madliyah" | "anak" | "kiswah-maskan" | "mahar" | "lainnya";

export type PosPembebanan = {
  jenis: JenisPembebanan | string;
  sebutan: string;
  /** null = jenisnya terbaca tetapi jumlahnya tidak tertulis dalam angka (mut'ah berupa emas). */
  jumlah: number | null;
  /** Dibayar tiap bulan (nafkah anak) - tidak ikut total yang dibayar saat ikrar. */
  berkala: boolean;
  penerima: string;
  keterangan: string;
  /** Kalimat amar sumbernya - supaya yang membaca dapat mencocokkan sendiri. */
  kalimat: string;
  /** Angka dan terbilangnya berbeda, atau periodenya tidak tertulis. */
  ragu: boolean;
  catatan: string;
};

export type PembebananIkrar = {
  pos: PosPembebanan[];
  totalSekaligus: number;
  berkalaPerBulan: number;
  adaTanpaAngka: boolean;
  adaRagu: boolean;
  sebelumIkrar: boolean;
  waktuBayar: string;
  /** Amar menyebut pembebanan, tetapi tidak satu pos pun terurai. */
  tidakTerbaca: boolean;
  tanggalPutusan?: string;
};

/**
 * Penanda tampil HANYA pada baris sidang ikrar talak yang pembebanannya ada.
 *
 * Aturan "sidang ikrar"-nya sidangIkrar yang sama dengan penanda biru Ikrar
 * Talak - bukan aturan kedua. Bot pun hanya mengirim pembebanan pada baris
 * ikrar, tetapi layar tidak bersandar pada itu saja: jadwal yang tersimpan
 * dari bot lama atau baris yang benderanya berubah tidak boleh memunculkan
 * penanda pembebanan pada sidang pembuktian.
 */
export function tampilkanPembebanan(baris: {
  agenda?: string;
  sidangIkrarTalak?: boolean;
  pembebanan?: PembebananIkrar | null;
}): boolean {
  if (!sidangIkrar(baris)) return false;
  const p = baris.pembebanan;
  if (!p) return false;
  return (Array.isArray(p.pos) && p.pos.length > 0) || p.tidakTerbaca === true;
}

/** Rp 14.500.000 */
export function rupiahPenuh(nilai: number): string {
  return `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;
}

/** Rp 14,5 jt / Rp 500 rb - untuk lencana yang sempit. */
export function rupiahRingkas(nilai: number): string {
  const potong = (x: number) => (Math.round(x * 10) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (nilai >= 1e9) return `Rp ${potong(nilai / 1e9)} M`;
  if (nilai >= 1e6) return `Rp ${potong(nilai / 1e6)} jt`;
  if (nilai >= 1e3) return `Rp ${potong(nilai / 1e3)} rb`;
  return `Rp ${Math.round(nilai)}`;
}

/** Tulisan lencana di kolom Putusan. */
export function teksLencanaPembebanan(p: PembebananIkrar): string {
  if (p.pos.length === 0) return "pembebanan ?";
  const bagian: string[] = [];
  if (p.totalSekaligus > 0) bagian.push(rupiahRingkas(p.totalSekaligus));
  if (p.berkalaPerBulan > 0) bagian.push(`${rupiahRingkas(p.berkalaPerBulan)}/bln`);
  const isi = bagian.length > 0 ? ` ${bagian.join(" + ")}` : "";
  // Pos tanpa angka (mut'ah berupa emas) - total di lencana BUKAN seluruh
  // beban. "+ barang" mengatakannya tanpa mengarang nilai barangnya.
  const barang = p.adaTanpaAngka ? (bagian.length > 0 ? " + barang" : " (barang)") : "";
  return `pembebanan${isi}${barang}${p.adaRagu ? " ?" : ""}`;
}

/** Keterangan lencana saat disorot - daftar posnya, satu per baris. */
export function judulLencanaPembebanan(p: PembebananIkrar): string {
  if (p.pos.length === 0) {
    return "Amar putusan menyebut pembebanan, tetapi rinciannya tidak terbaca otomatis. Periksa naskah putusan.";
  }
  const baris = p.pos.map((x) => {
    const nilai =
      x.jumlah === null ? x.keterangan || "tanpa angka" : `${rupiahPenuh(x.jumlah)}${x.berkala ? " per bulan" : ""}`;
    return `${x.sebutan}: ${nilai}${x.ragu ? " (periksa amar)" : ""}`;
  });
  const waktu = p.sebelumIkrar ? "Menurut amar dibayar sebelum/saat ikrar talak diucapkan." : "";
  return [...baris, waktu, "Rinciannya di panel Rincian."].filter(Boolean).join("\n");
}
