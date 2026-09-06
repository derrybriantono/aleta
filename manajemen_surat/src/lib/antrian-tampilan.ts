/**
 * ============================================================================
 * BAHASA RUPA DAN HITUNGAN BERSAMA UNTUK SELURUH LAYAR ANTRIAN
 * ============================================================================
 *
 * Lima layar - kios pihak, televisi ruang tunggu, halaman cepat per ruang,
 * pencatatan kehadiran, dan papan panggil - harus terasa sebagai SATU alat.
 * Warna ruang yang berbeda antar layar membuat orang mengira ia sedang melihat
 * dua sistem yang berlainan, dan petugas kehilangan kebiasaan membaca warna.
 *
 * Karena itu warna, hitungan antrian, dan perkiraan waktu tunggu dikumpulkan
 * di sini, bukan disalin ke tiap layar.
 *
 * ============================================================================
 * PERKIRAAN WAKTU TUNGGU DIHITUNG DARI LAJU HARI INI
 * ============================================================================
 *
 * Inilah satu-satunya keterangan yang paling dicari orang yang menunggu, dan
 * satu-satunya yang paling mudah dikarang. Angka tetap - "kira-kira 15 menit
 * per perkara" - akan meleset jauh pada hari yang padat dan membuat orang
 * pergi lalu kehilangan gilirannya.
 *
 * Yang dipakai di sini SELANG NYATA antar panggilan hari ini: jarak waktu
 * antara nomor-nomor yang sudah benar-benar dipanggil. Bila baru satu nomor
 * dipanggil - belum ada jarak yang dapat diukur - perkiraannya TIDAK
 * ditampilkan sama sekali. Lebih baik tidak menyebut angka daripada menyebut
 * angka yang tidak berdasar apa pun.
 */

/** Satu baris antrian, sebagaimana dikirim bot. */
export type BarisAntrian = {
  nomor: number | null;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil" | string;
  jamPanggil?: string;
  waktuAmbil?: string;
  noRuang?: number | null;
};

/**
 * Warna per ruang sidang.
 *
 * Dipakai sebagai PENANDA, bukan hiasan: orang yang menunggu mencari ruangnya
 * lebih dulu, baru nomornya. Warna yang tetap sama di seluruh layar membuat
 * pencarian itu selesai dalam sekali lihat.
 *
 * Warna TIDAK PERNAH menjadi satu-satunya pembeda - nomor ruangnya selalu
 * ditulis juga. Sebagian orang tidak dapat membedakan warna, dan layar ruang
 * tunggu dibaca dari jauh dengan sudut yang buruk.
 */
export const WARNA_RUANG = [
  { nama: "Semua", teks: "text-slate-200", latar: "bg-slate-800", garis: "border-slate-600", aksen: "#94a3b8" },
  { nama: "Ruang 1", teks: "text-emerald-200", latar: "bg-emerald-950", garis: "border-emerald-700", aksen: "#34d399" },
  { nama: "Ruang 2", teks: "text-sky-200", latar: "bg-sky-950", garis: "border-sky-700", aksen: "#38bdf8" },
  { nama: "Ruang 3", teks: "text-amber-200", latar: "bg-amber-950", garis: "border-amber-700", aksen: "#fbbf24" },
  { nama: "Ruang 4", teks: "text-violet-200", latar: "bg-violet-950", garis: "border-violet-700", aksen: "#a78bfa" },
  { nama: "Ruang 5", teks: "text-rose-200", latar: "bg-rose-950", garis: "border-rose-700", aksen: "#fb7185" },
];

export function warnaRuang(noRuang: number | null | undefined) {
  const n = Number(noRuang);
  if (!Number.isFinite(n) || n <= 0) return WARNA_RUANG[0];
  return WARNA_RUANG[n % WARNA_RUANG.length] || WARNA_RUANG[0];
}

/** "09:35" menjadi menit sejak tengah malam; kosong bila tidak terbaca. */
export function keMenit(jam: string | undefined | null) {
  const cocok = String(jam || "").match(/^(\d{1,2}):(\d{2})/);
  if (!cocok) return null;
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (!Number.isFinite(j) || !Number.isFinite(m)) return null;
  return j * 60 + m;
}

/** Nilai tengah - satu panggilan yang tertunda lama tidak boleh menarik rata-rata. */
function nilaiTengah(daftar: number[]) {
  const bersih = daftar.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (bersih.length === 0) return null;
  const tengah = Math.floor(bersih.length / 2);
  return bersih.length % 2
    ? bersih[tengah]
    : Math.round((bersih[tengah - 1] + bersih[tengah]) / 2);
}

/**
 * Selang antar panggilan hari ini, dalam menit.
 *
 * Dihitung dari jarak antara nomor-nomor yang SUDAH dipanggil. Perlu
 * sekurang-kurangnya dua panggilan supaya ada jarak yang dapat diukur; di
 * bawah itu dijawab null dan perkiraannya tidak ditampilkan.
 */
export function selangPanggilan(baris: BarisAntrian[]) {
  const jam = baris
    .filter((x) => x.keadaan === "dipanggil")
    .map((x) => keMenit(x.jamPanggil))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);

  if (jam.length < 2) return null;

  const selang: number[] = [];
  for (let i = 1; i < jam.length; i += 1) {
    const jarak = jam[i] - jam[i - 1];
    // Jarak nol - dua nomor dipanggil pada menit yang sama - bukan laju
    // pelayanan melainkan pemanggilan berbarengan. Jarak yang tidak masuk akal
    // panjang biasanya jeda istirahat, bukan lamanya melayani satu perkara.
    if (jarak > 0 && jarak <= 120) selang.push(jarak);
  }

  return nilaiTengah(selang);
}

export type PerkiraanTunggu = {
  /** Berapa nomor lagi sebelum giliran ini. */
  posisi: number;
  /** Perkiraan menit; null bila lajunya belum dapat diukur. */
  menit: number | null;
  /** Kalimat siap tampil. */
  kalimat: string;
};

/**
 * Posisi dan perkiraan tunggu untuk satu nomor.
 *
 * Posisinya dihitung dari nomor yang MASIH MENUNGGU dan bernomor lebih kecil -
 * bukan dari selisih nomor. Nomor yang sudah dipanggil tidak lagi mengantre,
 * dan menghitungnya membuat perkiraan selalu lebih panjang daripada
 * kenyataannya.
 */
export function perkiraanTunggu(
  baris: BarisAntrian[],
  nomorSaya: number | null,
  pilihan: { ruang?: number | null } = {}
): PerkiraanTunggu | null {
  // null dan undefined ditolak SEBELUM diangkakan.
  //
  // Number(null) bernilai 0, dan 0 lolos Number.isFinite - sehingga perkara
  // yang BELUM punya nomor antrian akan dihitung seolah bernomor nol, lalu
  // dijawab "Anda berikutnya" kepada orang yang bahkan belum mengambil nomor.
  if (nomorSaya === null || nomorSaya === undefined) return null;

  const saya = Number(nomorSaya);
  if (!Number.isFinite(saya) || saya <= 0) return null;

  const seruang = baris.filter((x) =>
    pilihan.ruang && pilihan.ruang > 0 ? Number(x.noRuang) === pilihan.ruang : true
  );

  const didepan = seruang.filter(
    (x) => x.keadaan === "menunggu" && x.nomor !== null && Number(x.nomor) < saya
  ).length;

  const selang = selangPanggilan(seruang);
  const menit = selang === null ? null : Math.max(0, didepan * selang);

  let kalimat: string;
  if (didepan === 0) {
    kalimat = "Anda berikutnya";
  } else if (menit === null) {
    // Lajunya belum dapat diukur - sebutkan yang PASTI saja.
    kalimat = `${didepan} antrian lagi sebelum giliran Anda`;
  } else if (menit < 5) {
    kalimat = `${didepan} antrian lagi - sebentar lagi`;
  } else {
    kalimat = `${didepan} antrian lagi - kira-kira ${menit} menit`;
  }

  return { posisi: didepan, menit, kalimat };
}

/** Jam dinding, dipakai seragam di seluruh layar. */
export function jamSekarang(denganDetik = false) {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    ...(denganDetik ? { second: "2-digit" } : {}),
  });
}

/** "Sabtu, 6 September 2026" */
export function tanggalPanjang(waktu = new Date()) {
  return waktu.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
