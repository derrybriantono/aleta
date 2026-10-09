/**
 * ============================================================================
 * DAFTAR HUBUNGAN SAKSI DENGAN PIHAK - ISI AWAL TERUKUR (1.189.x BUTIR 10)
 * ============================================================================
 *
 * Kolom Keterangan blangko saksi SIPP (perkara_pihak5.keterangan) diisi
 * hubungan saksi dengan pihak. Daftar ini hanya memuat DASAR hubungannya
 * ("Ibu Kandung", "Tetangga") - sebutan pihaknya ("Penggugat"/"Pemohon"/
 * "Pemohon II"/"Para Pemohon") ditambahkan ekstensi menurut JENIS PERKARA
 * dari sebutanPihakService (satu sumber, nomor alur/jenis - bukan kata).
 *
 * ISI AWAL = keterangan saksi nyata sipp_donggala (dump 9 Okt 2026), diurai
 * oleh saksibantuUrai (ekstensi-sipp/saksiscan.js) lalu dihitung:
 *
 *   16.643 saksi; 4.504 keterangannya terisi (27%, tetapi 90% pada 2026 dan
 *   80% pada 2025 - kebiasaannya baru). 642 ragam tulisan menyusut menjadi
 *   188 dasar hubungan; 4.343 dari 4.504 (96,4%) terurai menjadi dasar. Sisa
 *   161 bukan hubungan sama sekali: jenis perkara salah tempat ("itsbat
 *   nikah" 100, "cerai gugat" 23, ...) dan nomor saksi ("saksi 2").
 *
 *   Sebutan yang SALAH untuk jenis perkaranya: 153 keterangan - 112 di
 *   antaranya "Penggugat/Tergugat" pada Cerai Talak/Izin Poligami.
 *
 * `jumlah` = banyaknya pemakaian terukur (urutan tampil di daftar). Yang
 * dipakai di bawah 2 kali tidak dijadikan isi awal; petugas dapat
 * menambahkannya sendiri (tersimpan di aleta_ekstensi_setelan, lihat
 * modules/aleta-ecourt/saksi-hubungan.ts).
 */

export type KelompokHubungan = "keluarga" | "lain";

export type HubunganBawaan = { teks: string; kelompok: KelompokHubungan; jumlah: number };

export const HUBUNGAN_BAWAAN: readonly HubunganBawaan[] = [
  { teks: "Tetangga", kelompok: "lain", jumlah: 574 },
  { teks: "Ibu Kandung", kelompok: "keluarga", jumlah: 370 },
  { teks: "Sepupu", kelompok: "keluarga", jumlah: 360 },
  { teks: "Paman", kelompok: "keluarga", jumlah: 335 },
  { teks: "Kakak Kandung", kelompok: "keluarga", jumlah: 294 },
  { teks: "Adik Kandung", kelompok: "keluarga", jumlah: 279 },
  { teks: "Ayah Kandung", kelompok: "keluarga", jumlah: 240 },
  { teks: "Tante", kelompok: "keluarga", jumlah: 222 },
  { teks: "Ipar", kelompok: "keluarga", jumlah: 210 },
  { teks: "Keponakan", kelompok: "keluarga", jumlah: 197 },
  { teks: "Sepupu Satu Kali", kelompok: "keluarga", jumlah: 178 },
  { teks: "Saudara Kandung", kelompok: "keluarga", jumlah: 148 },
  { teks: "Teman", kelompok: "lain", jumlah: 135 },
  { teks: "Keluarga", kelompok: "keluarga", jumlah: 98 },
  { teks: "Sepupu Dua Kali", kelompok: "keluarga", jumlah: 75 },
  { teks: "Kakak Ipar", kelompok: "keluarga", jumlah: 37 },
  { teks: "Anak Kandung", kelompok: "keluarga", jumlah: 31 },
  { teks: "Kerabat", kelompok: "keluarga", jumlah: 28 },
  { teks: "Menantu", kelompok: "keluarga", jumlah: 25 },
  { teks: "Kakek", kelompok: "keluarga", jumlah: 22 },
  { teks: "Adik Ipar", kelompok: "keluarga", jumlah: 21 },
  { teks: "Adik Sepupu", kelompok: "keluarga", jumlah: 19 },
  { teks: "Orang Tua Kandung", kelompok: "keluarga", jumlah: 19 },
  { teks: "Teman Kerja", kelompok: "lain", jumlah: 17 },
  { teks: "Kakak Sepupu", kelompok: "keluarga", jumlah: 16 },
  { teks: "Nenek", kelompok: "keluarga", jumlah: 16 },
  { teks: "Saudara Sepupu", kelompok: "keluarga", jumlah: 15 },
  { teks: "Sepupu Tiga Kali", kelompok: "keluarga", jumlah: 11 },
  { teks: "Saudara Ipar", kelompok: "keluarga", jumlah: 11 },
  { teks: "Ayah Tiri", kelompok: "keluarga", jumlah: 8 },
  { teks: "Bibi", kelompok: "keluarga", jumlah: 7 },
  { teks: "Mertua", kelompok: "keluarga", jumlah: 7 },
  { teks: "Rekan Kerja", kelompok: "lain", jumlah: 6 },
  { teks: "Sahabat", kelompok: "lain", jumlah: 5 },
  { teks: "Saudara Tiri", kelompok: "keluarga", jumlah: 5 },
  { teks: "Ibu Tiri", kelompok: "keluarga", jumlah: 4 },
  { teks: "Anak Tiri", kelompok: "keluarga", jumlah: 3 },
  { teks: "Kakak Tiri", kelompok: "keluarga", jumlah: 3 },
  { teks: "Tokoh Adat", kelompok: "lain", jumlah: 3 },
  { teks: "Aparat Desa", kelompok: "lain", jumlah: 2 },
  { teks: "Cucu", kelompok: "keluarga", jumlah: 2 },
  { teks: "Saudara Seibu", kelompok: "keluarga", jumlah: 2 },
];

/** Kata sebutan pihak - tidak boleh ada di DASAR hubungan (sebutannya ditambahkan ekstensi). */
const KATA_SEBUTAN = /\b(?:penggugat|tergugat|pemohon|termohon|para\s+pihak|terdakwa)\b/i;

const KELUARGA =
  /^(?:ibu|ayah|bapak|orang tua|kakak|adik|saudara|anak|nenek|kakek|paman|tante|bibi|sepupu|keponakan|ipar|menantu|mertua|cucu|keluarga|kerabat|suami|istri|om|bude|pakde)\b/i;

/** "kakak SEPUPU" -> "Kakak Sepupu"; kata sambung tetap kecil. */
function hurufBesar(teks: string): string {
  return teks
    .split(" ")
    .map((k, i) => {
      const kecil = k.toLowerCase();
      if (i > 0 && (kecil === "dan" || kecil === "dari")) return kecil;
      return kecil.charAt(0).toUpperCase() + kecil.slice(1);
    })
    .join(" ");
}

/**
 * Dasar hubungan baru yang diketik petugas -> bentuk rapinya, atau alasan
 * penolakan. Ekstensi sudah menguraikannya lewat saksibantuUrai (sebutan
 * pihak dibuang); ini jaring pengamannya di server.
 */
export function rapikanDasarHubungan(
  masukan: unknown
): { ok: true; teks: string; kelompok: KelompokHubungan } | { ok: false; alasan: string } {
  const teks = String(masukan ?? "")
    .replace(/[^\p{L}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (teks.length < 3) return { ok: false, alasan: "Hubungan terlalu pendek." };
  if (teks.length > 60) return { ok: false, alasan: "Hubungan terlalu panjang (paling banyak 60 huruf)." };
  if (KATA_SEBUTAN.test(teks)) {
    return { ok: false, alasan: "Tulis hubungannya saja, tanpa sebutan pihak - sebutan (Penggugat/Pemohon/...) ditambahkan sendiri menurut jenis perkara." };
  }
  const rapi = hurufBesar(teks);
  return { ok: true, teks: rapi, kelompok: KELUARGA.test(rapi) ? "keluarga" : "lain" };
}

/** Kunci baris aleta_ekstensi_setelan untuk satu dasar hubungan. */
export function kunciHubungan(teks: string): string {
  const siput = teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `portal:saksi-hubungan:${siput}`;
}
