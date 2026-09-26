/**
 * ============================================================================
 * SATU BENTUK TANGGAL UNTUK SELURUH LAYAR e-COURT
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026: "ganti format dari ini 2026-10-07
 * menjadi 07-10-2026, sebut juga harinya di samping tanggal".
 *
 * Sebelum berkas ini ada, tanggal ditulis dengan SEMBILAN pembantu terpisah -
 * empat di layar (aleta-ecourt-sidang.tsx tanggalTerbaca,
 * aleta-ecourt-status-perkara.tsx tanggalPanjang + namaHariIso,
 * aleta-ecourt-cetak-jadwal.tsx tanggalPanjang, bentuk-sajian.tsx tanggalUtuh
 * + tanggalRingkas) dan lima di lib - sementara 67 tempat LAIN tidak memakai
 * pembantu apa pun: ISO dari SIPP dicetak apa adanya. Pada satu layar yang
 * sama panitera karena itu membaca "2026-10-07", "7 Oktober 2026",
 * "Rab, 9 September 2026", "7 Okt", dan "07 Okt 2026".
 *
 * ============================================================================
 * NAMA HARINYA BUKAN HIASAN
 * ============================================================================
 *
 * Diukur di sipp_donggala atas jadwal sejak 1 September 2026: Selasa 91,
 * Senin 68, Rabu 42, Kamis 27, Jumat 20 - Sabtu dan Minggu NOL. Panitera yang
 * membaca "ditunda sampai 07-10-2026" tidak dapat menilai apa pun; yang
 * membaca "Sab, 07-10-2026" langsung tahu tundaannya salah ketik. Selama ini
 * kekeliruan seperti itu baru ketahuan pada hari H.
 *
 * ============================================================================
 * NAMA HARI DIHITUNG DARI ANGKANYA, BUKAN DARI ZONA MESIN
 * ============================================================================
 *
 * "2026-10-07" dari SIPP adalah tanggal KALENDER: tanpa jam, tanpa zona.
 * new Date("2026-10-07") membacanya sebagai tengah malam UTC, lalu getDay()
 * menjawab menurut zona mesin - pada mesin di sebelah barat UTC hasilnya
 * mundur sehari, dan layar menulis "Selasa, 06-10-2026" untuk tanggal yang
 * tertulis 7 Oktober.
 *
 * Di ALETA itu bukan teori: halaman pertama dilukis PELADEN (Next.js di dalam
 * Docker, TZ=UTC) lalu dilukis ulang PERAMBAN (WITA). Dua lukisan yang tidak
 * sepakat nama harinya membuat React membuang lukisan peladen dan mencatat
 * hydration mismatch. Karena itu berkas ini tidak menyentuh zona sama sekali:
 * angkanya diambil dari teksnya, harinya dihitung dengan Date.UTC +
 * getUTCDay - jawaban yang sama di mesin mana pun.
 *
 * lib/waktu-pengadilan.ts tetap yang menjawab pertanyaan yang MEMANG butuh
 * zona: "sekarang tanggal berapa di Donggala". Bukan "2026-10-07 itu hari
 * apa" - yang jawabannya tidak bergantung tempat.
 */

export const HARI_PANJANG = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;
export const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
export const BULAN_PANJANG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;
export const BULAN_PENDEK = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

type Pecahan = { tahun: number; bulan: number; hari: number };

/**
 * Memecah ISO menjadi angka. null bila tanggalnya tidak sah.
 *
 * SIPP menyimpan tanggal kosong sebagai 0000-00-00 - diukur 24 September 2026
 * atas sipp_donggala: 1 dari 20.109 baris perkara_jadwal_sidang. Tanggal itu
 * DITOLAK di sini, bukan diterjemahkan menjadi "30 November -1".
 *
 * Awalan ISO diterima juga dari cap waktu penuh ("2026-10-07T00:00:00.000Z"),
 * sebab sebagian ruas mengirim cap waktu untuk tanggal murni.
 */
function pecah(nilai: unknown): Pecahan | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nilai ?? "").trim());
  if (!cocok) return null;
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  if (!tahun || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;
  return { tahun, bulan, hari };
}

/** Nomor hari 0..6 - tanpa zona, sama di peladen dan di peramban. */
function nomorHari(p: Pecahan): number {
  return new Date(Date.UTC(p.tahun, p.bulan - 1, p.hari)).getUTCDay();
}

/** Tanggalnya terbaca sebagai tanggal kalender yang sah. */
export function tanggalSah(nilai: unknown): boolean {
  return pecah(nilai) !== null;
}

/** "2026-10-07" -> "07-10-2026". Yang tidak sah -> cadangan (bawaan kosong). */
export function tanggalDMY(nilai: unknown, cadangan = ""): string {
  const p = pecah(nilai);
  if (!p) return cadangan;
  return `${String(p.hari).padStart(2, "0")}-${String(p.bulan).padStart(2, "0")}-${p.tahun}`;
}

/** "Rabu". Kosong bila tanggalnya tidak sah. */
export function namaHari(nilai: unknown): string {
  const p = pecah(nilai);
  return p ? HARI_PANJANG[nomorHari(p)] : "";
}

/** "Rab". Kosong bila tanggalnya tidak sah. */
export function namaHariPendek(nilai: unknown): string {
  const p = pecah(nilai);
  return p ? HARI_PENDEK[nomorHari(p)] : "";
}

/** "Rab, 07-10-2026" - tabel dan lencana, tempat kolomnya sempit. */
export function tanggalHariPendek(nilai: unknown, cadangan = ""): string {
  const p = pecah(nilai);
  if (!p) return cadangan;
  return `${HARI_PENDEK[nomorHari(p)]}, ${tanggalDMY(nilai)}`;
}

/** "Rabu, 07-10-2026" - panel rincian, kepala bagian, tooltip, aria-label. */
export function tanggalHariPanjang(nilai: unknown, cadangan = ""): string {
  const p = pecah(nilai);
  if (!p) return cadangan;
  return `${HARI_PANJANG[nomorHari(p)]}, ${tanggalDMY(nilai)}`;
}

/**
 * "7 Oktober 2026" - bulan berhuruf, HANYA untuk lembar cetak dan naskah.
 *
 * Naskah pengadilan menulis bulan dengan huruf supaya angkanya tidak dapat
 * diubah sesudah dicetak dan ditandatangani. Layar tidak ditandatangani, jadi
 * layar memakai bentuk angka yang lebih cepat dipindai.
 */
export function tanggalPanjang(nilai: unknown, cadangan = ""): string {
  const p = pecah(nilai);
  if (!p) return cadangan;
  return `${p.hari} ${BULAN_PANJANG[p.bulan - 1]} ${p.tahun}`;
}

/** "Rabu, 7 Oktober 2026" - kop lembar cetak. */
export function tanggalPanjangDenganHari(nilai: unknown, cadangan = ""): string {
  const p = pecah(nilai);
  if (!p) return cadangan;
  return `${HARI_PANJANG[nomorHari(p)]}, ${tanggalPanjang(nilai)}`;
}

/** "7 Okt" / "7 Okt '26" - sumbu grafik, tempat hanya ada +-34 piksel. */
export function tanggalRingkas(nilai: unknown, denganTahun = false, cadangan = ""): string {
  const p = pecah(nilai);
  if (!p) return cadangan;
  const dasar = `${p.hari} ${BULAN_PENDEK[p.bulan - 1]}`;
  return denganTahun ? `${dasar} '${String(p.tahun).slice(2)}` : dasar;
}
