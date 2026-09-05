/**
 * RANGKAIAN SIDANG - satu perkara, beberapa sidang, saling menyambung.
 *
 * ============================================================================
 * SIPP SUDAH MENYIMPAN SAMBUNGANNYA
 * ============================================================================
 *
 * perkara_jadwal_sidang bukan sekadar daftar tanggal. Tiap barisnya membawa
 * sidang ke berapa, agendanya, apakah ditunda dan mengapa, kapan ditundakan -
 * DAN sidang sebelumnya: tanggalnya, agendanya, alasannya.
 *
 * Artinya "BAS berikutnya tahu apa yang terjadi sebelumnya" tidak menuntut
 * ALETA mengarang apa pun maupun menyimpan salinan tersendiri. Yang perlu
 * dikerjakan hanyalah membacanya dalam bentuk yang terbaca petugas.
 *
 * ============================================================================
 * NOMOR BLANGKO DAN NOMOR SIDANG ITU SATU HAL YANG SAMA
 * ============================================================================
 *
 * Blangko "BAS 2" memang untuk sidang ke-2. Karena jenjang blangko sudah
 * menyebut nomornya, ALETA dapat memilih sidang yang tepat tanpa bertanya -
 * dan pertanyaan yang tidak perlu diajukan adalah pertanyaan yang tidak dapat
 * dijawab keliru.
 */

export type Sidang = {
  sidangKe: number;
  tanggal: string;
  hari: string;
  jam: string;
  agenda: string;
  ruangan: string;
  ditunda: boolean;
  alasanDitunda: string;
  tanggalDitunda: string;
  /** Sidang sebelumnya menurut SIPP - kosong bila ini sidang pertama. */
  sebelumnya: { tanggal: string; agenda: string; alasan: string } | null;
};

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const BULAN = [
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
];

function waktuDari(nilai: unknown): Date | null {
  const teks = String(nilai ?? "").trim();
  if (!teks) return null;
  const waktu = new Date(teks);
  return Number.isNaN(waktu.getTime()) ? null : waktu;
}

/**
 * Nama hari dari tanggal - dibaca sebagai UTC, sama seperti tanggalnya.
 *
 * Kalau tanggal dan harinya dibaca dengan aturan zona yang berbeda, BAS dapat
 * menyebut "Senin, 2 September 2026" untuk tanggal yang jatuh pada Selasa -
 * dan keduanya tertulis di naskah yang sama.
 */
export function hariIndonesia(nilai: unknown): string {
  const waktu = waktuDari(nilai);
  return waktu ? HARI[waktu.getUTCDay()] : "";
}

export function tanggalIndonesia(nilai: unknown): string {
  const waktu = waktuDari(nilai);
  return waktu ? `${waktu.getUTCDate()} ${BULAN[waktu.getUTCMonth()]} ${waktu.getUTCFullYear()}` : "";
}

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Menyusun riwayat sidang SIPP menjadi rangkaian yang terbaca.
 *
 * Diurutkan menurut nomor sidang, BUKAN menurut urutan baris dari basis data.
 * Urutan baris tidak dijamin, dan BAS yang menyebut sidang ke-2 sebagai sidang
 * pertama adalah kekeliruan yang tidak dapat ditarik setelah ditandatangani.
 */
export function susunRangkaian(riwayat: unknown): Sidang[] {
  const baris = Array.isArray(riwayat) ? (riwayat as Array<Record<string, unknown>>) : [];

  return baris
    .map((item) => {
      const tanggal = teks(item.tanggalSidang ?? item.tanggal);
      const tanggalSebelum = teks(item.tanggalSebelumnya);
      return {
        sidangKe: Number(item.sidangKe ?? item.urutan) || 0,
        tanggal,
        hari: hariIndonesia(tanggal),
        jam: teks(item.jamSidang).slice(0, 5),
        agenda: teks(item.agenda ?? item.agendaSidang),
        ruangan: teks(item.ruangan),
        ditunda: teks(item.ditunda).toUpperCase() === "Y",
        alasanDitunda: teks(item.alasanDitunda),
        tanggalDitunda: teks(item.tanggalDitunda),
        sebelumnya: tanggalSebelum
          ? {
              tanggal: tanggalSebelum,
              agenda: teks(item.agendaSebelumnya),
              alasan: teks(item.alasanSebelumnya),
            }
          : null,
      };
    })
    .sort((a, b) => a.sidangKe - b.sidangKe);
}

/** Sidang yang nomornya cocok dengan blangko yang dipilih. */
export function sidangKe(rangkaian: Sidang[], nomor: number): Sidang | null {
  if (!nomor) return null;
  return rangkaian.find((item) => item.sidangKe === nomor) ?? null;
}

/**
 * Kalimat yang menyebut sidang sebelumnya, untuk ditampilkan di layar.
 *
 * Bukan untuk dimasukkan ke naskah. Blangko sudah punya kalimatnya sendiri
 * dengan bentuk baku; yang dibutuhkan panitera adalah MENGETAHUI apa yang
 * terjadi sebelumnya tanpa membuka SIPP di tab lain.
 */
export function ringkasSebelumnya(sidang: Sidang | null): string {
  if (!sidang?.sebelumnya) return "";
  const { tanggal, agenda, alasan } = sidang.sebelumnya;
  const bagian = [
    `Sidang sebelumnya ${hariIndonesia(tanggal)}, ${tanggalIndonesia(tanggal)}`,
    agenda ? `agenda ${agenda}` : "",
    alasan ? `ditunda untuk ${alasan}` : "",
  ].filter(Boolean);
  return `${bagian.join(", ")}.`;
}

/**
 * Penanda blangko yang berasal dari sidang ini.
 *
 * Nomor penandanya dari abt_variabel: 0032 Hari Sidang, 0033 Tgl Sidang, 9003
 * Sidang Pertama / Lanjutan. Ketiganya bertipe multi_sidang di ABT - artinya
 * memang berubah dari satu BAS ke BAS berikutnya, dan itulah yang membuat E6
 * ini perlu ada.
 */
export function penandaDariSidang(sidang: Sidang | null): Map<string, { nilai: string; asal: string }> {
  const peta = new Map<string, { nilai: string; asal: string }>();
  if (!sidang) return peta;

  const asal = `SIPP - perkara_jadwal_sidang, sidang ke-${sidang.sidangKe}`;
  const pasang = (noVar: string, nilai: string) => {
    if (nilai) peta.set(noVar, { nilai, asal });
  };

  pasang("0032", sidang.hari);
  pasang("0033", tanggalIndonesia(sidang.tanggal));

  // Tempat sidang dilangsungkan - "yang dilangsungkan di #1261#" pada blangko.
  pasang("1261", sidang.ruangan);

  // Hari dan tanggal sidang berikutnya, bila sidang ini ditunda. Hanya diisi
  // saat SIPP benar-benar mencatat penundaannya; menebaknya berarti BAS
  // memerintahkan para pihak hadir pada tanggal yang tidak pernah ditetapkan.
  if (sidang.ditunda && sidang.tanggalDitunda) {
    pasang("0133", hariIndonesia(sidang.tanggalDitunda));
    pasang("0134", tanggalIndonesia(sidang.tanggalDitunda));
  }
  // "Pertama" hanya untuk sidang ke-1; sisanya "Lanjutan". Sidang tanpa nomor
  // tidak diisi sama sekali - menebaknya berarti BAS lanjutan menyebut dirinya
  // sidang pertama, dan sebaliknya.
  if (sidang.sidangKe === 1) pasang("9003", "Pertama");
  else if (sidang.sidangKe > 1) pasang("9003", "Lanjutan");

  return peta;
}
