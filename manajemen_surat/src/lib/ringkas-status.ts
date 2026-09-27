/**
 * ============================================================================
 * RINGKASAN SATU LAYAR, DAN DAFTAR YANG PERLU DITINDAKLANJUTI
 * ============================================================================
 *
 * Status Perkara memuat dua puluh enam bagian. Yang membukanya hampir selalu
 * datang dengan tiga pertanyaan yang sama, dan ketiganya saat ini menuntut
 * menggulung:
 *
 *     perkara ini sekarang DI MANA
 *     apa yang TERLAMBAT
 *     apa BERIKUTNYA
 *
 * Berkas ini menjawab ketiganya dari muatan yang SUDAH ada di layar - tidak
 * ada pembacaan tambahan ke SIPP, tidak ada kueri baru. Itu penting: ringkasan
 * yang menuntut pembacaan sendiri akan menjadi hal keempat yang harus ditunggu
 * sebelum halaman berguna.
 *
 * ============================================================================
 * PERINGATANNYA DIKUMPULKAN, BUKAN DILAHIRKAN
 * ============================================================================
 *
 * Tiap peringatan di sini sudah tampil di salah satu bagian di bawah -
 * tersebar di antara dua puluh enam bagian yang sebagian besarnya terciut.
 * Yang dikerjakan di sini MENGUMPULKANNYA, bukan menemukan hal baru: kalau ia
 * menemukan hal baru, akan ada dua sumber kebenaran yang menyimpang diam-diam.
 *
 * Yang TIDAK dijadikan peringatan: apa pun yang tidak dapat ditindaklanjuti
 * petugas. "Perkara ini dibanding" bukan peringatan - itu keadaan, dan tidak
 * ada yang dapat dikerjakan siapa pun atasnya.
 */

/** Ambang lama perkara menurut SEMA 2/2014 - lima bulan untuk tingkat pertama. */
export const AMBANG_HARI_SEMA = 150;

/** Ambang mediasi menurut PERMA 1/2016 - tiga puluh hari. */
export const AMBANG_HARI_MEDIASI = 30;

export type BahanRingkas = {
  identitas: { nomorPerkara: string; jenisPerkara: string; tanggalDaftar: string };
  umur: {
    hariBerjalan: number | null;
    bulanBerjalan: number | null;
    sudahPutus: boolean;
    sebabSelesai?: string;
    hariMinutasi: number | null;
    hariMediasi: number;
  };
  majelis: Array<{ nama: string; jabatan: string }>;
  panitera: Array<{ nama: string }>;
  jadwal: Array<{ tanggalSidang: string; jamSidang: string; agenda: string; ditunda: boolean }>;
  putusan: {
    sudahPutus: boolean;
    tanggalPutusan: string;
    statusPutusan: string;
    tanggalMinutasi: string;
    tanggalBht: string;
    aktaCerai: { nomor: string; diserahkanPihak1: string; diserahkanPihak2: string } | null;
  } | null;
};

export type Peringatan = {
  /** Kalimat yang dibaca petugas - apa yang kurang. */
  pesan: string;
  /** Kenapa itu penting, dan dari mana angkanya. Kosong bila tidak perlu. */
  sebab: string;
  /** "berat" menuntut tindakan hari ini; "ringan" perlu diketahui saja. */
  berat: boolean;
};

export type Ringkasan = {
  keadaan: string;
  keadaanBerat: boolean;
  umurKalimat: string;
  berikutnya: string;
  majelisKalimat: string;
  peringatan: Peringatan[];
};

const angka = (n: number) => n.toLocaleString("id-ID");

/**
 * Sidang terdekat yang BELUM lewat, dari daftar jadwal.
 *
 * Diekspor supaya ringkasan yang DISALIN (ringkasan-salin.ts) menyebut sidang
 * yang sama dengan kartu "Sidang berikutnya" di layar. Dua pemilih yang
 * masing-masing menentukan "berikutnya" akan berselisih tepat pada hari
 * sidangnya - hari ketika pertanyaan itu paling sering diajukan.
 */
export function sidangBerikutnya(
  jadwal: BahanRingkas["jadwal"],
  hariIni: string
): { tanggalSidang: string; jamSidang: string; agenda: string } | null {
  const depan = jadwal
    .filter((j) => /^\d{4}-\d{2}-\d{2}/.test(String(j.tanggalSidang)) && String(j.tanggalSidang).slice(0, 10) >= hariIni)
    .sort((a, b) => String(a.tanggalSidang).localeCompare(String(b.tanggalSidang)));
  return depan[0] ?? null;
}

/**
 * Menyusun ringkasan dan daftar peringatan dari muatan status.
 *
 * @param hariIni tanggal acuan "YYYY-MM-DD" - disuntikkan, bukan dibaca dari
 *   jam mesin, supaya perilakunya dapat diuji tanpa bergantung pada hari uji
 *   itu dijalankan.
 */
export function ringkasStatus(status: BahanRingkas, hariIni: string): Ringkasan {
  const putusan = status.putusan;
  const sudahPutus = Boolean(putusan?.sudahPutus || status.umur.sudahPutus);
  const berikut = sidangBerikutnya(status.jadwal, hariIni);

  // ---- keadaan sekarang --------------------------------------------------
  let keadaan: string;
  let keadaanBerat = false;
  if (sudahPutus) {
    const sebab = String(status.umur.sebabSelesai || "putus");
    const nama = sebab === "dicabut" ? "Dicabut" : sebab === "gugur" ? "Gugur" : "Sudah putus";
    keadaan = putusan?.statusPutusan ? `${nama} — ${putusan.statusPutusan}` : nama;
  } else if (berikut) {
    keadaan = "Dalam persidangan";
  } else if (status.jadwal.length > 0) {
    keadaan = "Menunggu jadwal sidang berikutnya";
    keadaanBerat = true;
  } else {
    keadaan = "Belum bersidang";
  }

  // ---- umur --------------------------------------------------------------
  const hari = status.umur.hariBerjalan;
  const umurKalimat =
    hari === null
      ? "Lama proses tidak terbaca"
      : sudahPutus
        ? `Selesai dalam ${angka(hari)} hari`
        : `Berjalan ${angka(hari)} hari`;

  // ---- berikutnya --------------------------------------------------------
  const berikutnya = berikut
    ? `${String(berikut.tanggalSidang).slice(0, 10)}${berikut.jamSidang ? ` ${berikut.jamSidang}` : ""} — ${
        berikut.agenda || "agenda belum tercatat"
      }`
    : sudahPutus
      ? "Tidak ada sidang lagi"
      : "Belum ada sidang terjadwal";

  const majelisKalimat =
    status.majelis.length > 0
      ? status.majelis.map((m) => m.nama).join(", ")
      : "Majelis belum ditetapkan";

  // ---- peringatan --------------------------------------------------------
  const peringatan: Peringatan[] = [];

  if (status.majelis.length === 0) {
    peringatan.push({
      pesan: "Majelis hakim belum ditetapkan",
      sebab: "Tanpa penetapan majelis, perkara tidak dapat dijadwalkan bersidang.",
      berat: true,
    });
  }

  if (!sudahPutus && hari !== null && hari > AMBANG_HARI_SEMA) {
    peringatan.push({
      pesan: `Sudah ${angka(hari)} hari dan belum putus`,
      sebab: `Melewati lima bulan (SEMA 2/2014) — ambangnya ${AMBANG_HARI_SEMA} hari.`,
      berat: true,
    });
  }

  if (!sudahPutus && status.umur.hariMediasi > AMBANG_HARI_MEDIASI) {
    peringatan.push({
      pesan: `Mediasi sudah ${angka(status.umur.hariMediasi)} hari`,
      sebab: `Melewati tiga puluh hari (PERMA 1/2016).`,
      berat: true,
    });
  }

  if (!sudahPutus && status.jadwal.length > 0 && !berikut) {
    peringatan.push({
      pesan: "Belum ada sidang berikutnya yang terjadwal",
      sebab: "Sidang terakhir sudah lewat dan tidak ada tanggal baru di SIPP.",
      berat: true,
    });
  }

  if (sudahPutus && putusan) {
    if (!putusan.tanggalMinutasi) {
      peringatan.push({
        pesan: "Minutasi belum tercatat",
        sebab: "Berkas belum dapat diarsipkan sebelum minutasinya tercatat.",
        berat: true,
      });
    }
    if (!putusan.tanggalBht) {
      peringatan.push({
        pesan: "Tanggal berkekuatan hukum tetap belum tercatat",
        sebab: "Akta cerai tidak dapat terbit sebelum BHT-nya tercatat.",
        berat: false,
      });
    }
    if (putusan.aktaCerai && !putusan.aktaCerai.diserahkanPihak1) {
      peringatan.push({
        pesan: "Akta cerai belum diserahkan kepada pihak pertama",
        sebab: `Akta ${putusan.aktaCerai.nomor || "sudah terbit"} tetapi penyerahannya belum tercatat.`,
        berat: false,
      });
    }
  }

  // Yang paling menuntut tindakan diletakkan di atas - bukan urutan kemunculan
  // di dalam kode, yang tidak berarti apa pun bagi yang membacanya.
  peringatan.sort((a, b) => Number(b.berat) - Number(a.berat));

  return { keadaan, keadaanBerat, umurKalimat, berikutnya, majelisKalimat, peringatan };
}
