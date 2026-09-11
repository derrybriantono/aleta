/**
 * ============================================================================
 * MENGUSULKAN ISI MEDAN PILIHAN PADA BORANG PUTUSAN SIPP
 * ============================================================================
 *
 * Borang Putusan Akhir tidak hanya berisi teks panjang. Ia juga menuntut
 * pilihan yang BERBEDA-BEDA menurut jenis perkara dan status putusannya, dan
 * tiap pilihan itu masuk ke laporan resmi:
 *
 *   Cerai (alur 15, status 62)   faktor perceraian, faktor sekunder, nusyuz,
 *                                qobla/ba'da dukhul, keadaan istri
 *   Dispensasi kawin (362)       alasan pengajuan - hamil, pergaulan bebas,
 *                                ekonomi, budaya/adat, menghindari zina
 *   Izin poligami (341)          alasan izin
 *   Pembatalan perkawinan (344)  alasan pembatalan
 *   Itsbat nikah (360)           alasan itsbat
 *   Asal usul anak (358)         alasan permohonan
 *   Ekonomi syariah              jenis akad
 *
 * Angka-angka inilah yang kemudian menjadi Laporan Faktor Penyebab Perceraian
 * dan statistik Dispensasi Kawin. Salah pilih di sini tidak terlihat di
 * putusannya sama sekali - ia baru muncul setahun kemudian sebagai angka yang
 * tidak masuk akal pada laporan satuan kerja.
 *
 * ============================================================================
 * PILIHANNYA DATANG DARI HALAMAN, BUKAN DARI HAFALAN
 * ============================================================================
 *
 * Berkas ini TIDAK memuat satu pun nomor pilihan SIPP. Daftar pilihan dikirim
 * ekstensi apa adanya dari borang yang sedang terbuka - sudah disaring SIPP
 * menurut jenis perkara, jenis pengadilan, dan versinya sendiri - dan yang
 * dikerjakan di sini hanya memilih SATU di antaranya berdasarkan bunyi
 * putusan.
 *
 * Akibatnya: SIPP boleh menambah, menghapus, atau menomori ulang pilihannya
 * tanpa satu baris pun di sini berubah. Yang menghafal nomor akan diam-diam
 * salah pada hari daftarnya diperbarui, dan salahnya tidak berbunyi.
 *
 * ============================================================================
 * TIDAK PERNAH MENEBAK
 * ============================================================================
 *
 * Bila tidak ada pilihan yang benar-benar disebut naskahnya, yang dikembalikan
 * KOSONG beserta sebabnya - bukan pilihan pertama, bukan "Lain-Lain". Usulan
 * yang menebak akan dicentang orang yang sedang terburu-buru, dan tebakan itu
 * menjadi angka resmi.
 */

export type PilihanMedan = {
  /** Nilai yang akan disetel ke borang - apa adanya dari halaman. */
  nilai: string;
  /** Tulisan yang dibaca petugas pada daftar pilihan. */
  label: string;
};

export type MedanPilihan = {
  /** Penunjuk CSS medan pada halaman, mis. "#faktor_cerai". */
  kunci: string;
  /** Nama medan sebagaimana tertulis di borang. */
  label: string;
  pilihan: PilihanMedan[];
};

export type UsulanMedan = {
  kunci: string;
  label: string;
  /** Kosong berarti tidak ada usulan - dan itu jawaban yang sah. */
  nilai: string;
  nilaiLabel: string;
  keyakinan: "pasti" | "cukup" | "bentrok" | "kosong";
  /** Kalimat naskah yang menjadi dasarnya, apa adanya. */
  kutipan: string;
  /** Pilihan lain yang ikut terjaring, supaya petugas melihat saingannya. */
  saingan: Array<{ nilai: string; label: string; nilai_skor: number }>;
  alasan: string;
};

/** Kata yang terlalu umum untuk menjadi bukti apa pun. */
const KATA_UMUM = new Set([
  "yang",
  "dan",
  "atau",
  "dari",
  "pada",
  "dalam",
  "untuk",
  "tidak",
  "dapat",
  "telah",
  "sudah",
  "akan",
  "oleh",
  "dengan",
  "adalah",
  "karena",
  "lain",
  "lainnya",
  "salah",
  "satu",
  "pihak",
  "hukum",
  "perkara",
  "orang",
  "anak",
  "istri",
  "suami",
  "kawin",
  "nikah",
  "perkawinan",
  "pengadilan",
  "agama",
]);

function normalkan(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kata bermakna pada sebuah label pilihan. */
function kataPenting(label: string): string[] {
  return normalkan(label)
    .split(/[\s/]+/)
    .filter((kata) => kata.length >= 4 && !KATA_UMUM.has(kata));
}

/**
 * Label yang memuat garis miring adalah beberapa kemungkinan sekaligus -
 * "Pergaulan Bebas/Hubungan Intim" terpenuhi oleh salah satunya. Dipecah
 * supaya naskah yang hanya menyebut "hubungan intim" tetap tertangkap.
 */
function kemungkinanLabel(label: string): string[] {
  const bagian = String(label ?? "")
    .split("/")
    .map((satu) => satu.trim())
    .filter(Boolean);
  return bagian.length > 1 ? [label, ...bagian] : [label];
}

/** Kalimat naskah yang memuat kata itu, dipulangkan apa adanya. */
function kalimatYangMemuat(naskah: string, kata: string[]): string {
  const kalimat = String(naskah ?? "")
    .split(/(?<=[.;:])\s+|\n+/)
    .map((satu) => satu.trim())
    .filter(Boolean);
  for (const satu of kalimat) {
    const rendah = normalkan(satu);
    if (kata.every((k) => rendah.includes(k))) return satu.length > 300 ? `${satu.slice(0, 300)}…` : satu;
  }
  for (const satu of kalimat) {
    const rendah = normalkan(satu);
    if (kata.some((k) => rendah.includes(k))) return satu.length > 300 ? `${satu.slice(0, 300)}…` : satu;
  }
  return "";
}

/**
 * Nilai satu pilihan terhadap naskah.
 *
 * Kata yang lebih panjang berbobot lebih besar: "pertengkaran" menyebut satu
 * hal tertentu, sedangkan "badan" dapat muncul di mana saja. Seluruh kata
 * penting yang hadir bersama-sama memberi tambahan tersendiri - itulah beda
 * antara naskah yang benar-benar menyebut "perselisihan dan pertengkaran terus
 * menerus" dan naskah yang kebetulan memuat kata "terus".
 */
function skorPilihan(naskah: string, label: string): { skor: number; kata: string[] } {
  const rendah = normalkan(naskah);
  let terbaik = { skor: 0, kata: [] as string[] };

  for (const kemungkinan of kemungkinanLabel(label)) {
    const kata = kataPenting(kemungkinan);
    if (kata.length === 0) continue;

    // Frasa utuh - bukti terkuat yang mungkin ada.
    const frasa = normalkan(kemungkinan);
    if (frasa.length >= 6 && rendah.includes(frasa)) {
      const skor = 100 + frasa.length;
      if (skor > terbaik.skor) terbaik = { skor, kata };
      continue;
    }

    let skor = 0;
    let hadir = 0;
    for (const satu of kata) {
      if (rendah.includes(satu)) {
        hadir += 1;
        skor += satu.length;
      }
    }
    if (hadir === 0) continue;
    // Seluruh kata hadir: jauh lebih meyakinkan daripada sebagian.
    if (hadir === kata.length) skor += 20 * kata.length;
    if (skor > terbaik.skor) terbaik = { skor, kata: kata.filter((k) => rendah.includes(k)) };
  }

  return terbaik;
}

/** Pilihan yang bukan pilihan: "- Pilih -", "0", dan sejenisnya. */
function pilihanKosong(satu: PilihanMedan): boolean {
  const label = normalkan(satu.label);
  const nilai = String(satu.nilai ?? "").trim();
  if (!label) return true;
  if (nilai === "" || nilai === "0" || nilai === "-1") return true;
  return /^(pilih|silakan pilih|none|kosong)$/.test(label.replace(/^[-\s]+|[-\s]+$/g, ""));
}

/**
 * Mengusulkan satu nilai untuk tiap medan pilihan.
 *
 * @param naskah Bunyi putusan - pertimbangan dan duduk perkara yang menyebut
 *               fakta yang menentukan pilihan ini.
 */
export function usulkanMedanPutusan(naskah: string, medan: MedanPilihan[]): UsulanMedan[] {
  const teks = String(naskah ?? "");
  return (Array.isArray(medan) ? medan : []).map((satu) => {
    const kandidat = (satu.pilihan ?? []).filter((x) => !pilihanKosong(x));
    const dasar: UsulanMedan = {
      kunci: satu.kunci,
      label: satu.label,
      nilai: "",
      nilaiLabel: "",
      keyakinan: "kosong",
      kutipan: "",
      saingan: [],
      alasan: "",
    };

    if (!teks.trim()) return { ...dasar, alasan: "Naskah putusan belum ada isinya." };
    if (kandidat.length === 0) return { ...dasar, alasan: "Borang tidak menawarkan pilihan apa pun." };

    const dinilai = kandidat
      .map((x) => ({ ...x, ...skorPilihan(teks, x.label) }))
      .filter((x) => x.skor > 0)
      .sort((a, b) => b.skor - a.skor);

    if (dinilai.length === 0) {
      return {
        ...dasar,
        alasan: "Tidak satu pun pilihan disebut naskah putusan. Pilih sendiri - ALETA tidak menebak.",
      };
    }

    const juara = dinilai[0];
    const kedua = dinilai[1];
    // Selisih tipis berarti naskahnya memang menyebut keduanya. Itu bukan
    // kegagalan mesin melainkan keadaan perkaranya, dan yang memutuskan
    // mana yang pokok adalah hakimnya.
    const tipis = kedua ? juara.skor - kedua.skor <= Math.max(6, juara.skor * 0.15) : false;

    return {
      kunci: satu.kunci,
      label: satu.label,
      nilai: String(juara.nilai),
      nilaiLabel: juara.label,
      keyakinan: tipis ? "bentrok" : juara.skor >= 100 ? "pasti" : "cukup",
      kutipan: kalimatYangMemuat(teks, juara.kata),
      saingan: dinilai.slice(1, 4).map((x) => ({ nilai: String(x.nilai), label: x.label, nilai_skor: x.skor })),
      alasan: tipis
        ? `Naskah menyebut lebih dari satu kemungkinan (${juara.label} dan ${kedua?.label}). Periksa sendiri mana yang pokok.`
        : "",
    };
  });
}
