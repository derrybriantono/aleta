/**
 * ============================================================================
 * JARAK WAKTU ANTARA SATU SIDANG DAN BERIKUTNYA
 * ============================================================================
 *
 * Yang ditanyakan orang di ruang tunggu satu: "kira-kira giliran saya jam
 * berapa". Jadwal menjawabnya dengan "09:00" untuk hampir seluruh perkara
 * hari itu, dan jawaban itu tidak pernah benar untuk perkara nomor dua belas.
 *
 * Yang sungguh menjawabnya adalah jarak antar-sidang yang SUDAH terjadi hari
 * itu: bila sepuluh perkara pertama masing-masing berjarak sepuluh menit,
 * perkara kedua belas dapat ditaksir.
 *
 * ============================================================================
 * AMBANGNYA DIUKUR, BUKAN DIPILIH KARENA ANGKANYA BULAT
 * ============================================================================
 *
 * Diukur atas 10.989 jarak dari 1.753 kelompok (hari x ruang sidang) pada
 * perkara_jadwal_sidang Donggala - selisih diperbaharui_tanggal antara satu
 * sidang dan berikutnya di ruang yang sama, hanya untuk baris yang dicatat
 * pada hari sidangnya sendiri:
 *
 *     p05  0,3      p25   3,1      p50  10,5      p75  24,1      p95   96,0
 *     p10  0,7      p40   7,0      p60  15,1      p85  39,2      p99  179,5
 *
 *     rerata 22,2 menit
 *
 * Batas 5 / 15 / 30 / 60 menit membagi sebaran itu menjadi:
 *
 *     hijau        < 5 menit    32,7%
 *     kuning       5-15         27,1%
 *     jingga       15-30        20,0%
 *     merah        30-60        11,1%
 *     merah gelap  >= 60         9,1%
 *
 * Perlimaan yang sempurna sebenarnya jatuh pada 2 / 7 / 15 / 30 menit, dan
 * itu SENGAJA tidak dipakai. Warna ini dibaca orang yang sedang menaksir
 * jamnya sendiri, dan "kurang dari dua menit" bukan keterangan yang dapat
 * dipakai menaksir apa pun. Lima belas dan tiga puluh menit adalah satuan
 * yang sungguh dipakai orang ketika menghitung giliran; dua dan tujuh tidak.
 *
 * ============================================================================
 * APA YANG SUNGGUH DIUKUR ANGKA INI - DAN APA YANG TIDAK
 * ============================================================================
 *
 * Ambang di atas diukur dari jarak PENCATATAN, sedangkan yang ditampilkan
 * layar jarak PEMANGGILAN (jam_sidang pada mesin antrian, yaitu saat
 * perkaranya dipanggil masuk). Keduanya tidak sama, dan perbedaannya harus
 * dikatakan: 13,4% jarak pencatatan berada di bawah satu menit - itu bukan
 * sidang yang selesai dalam satu menit, melainkan beberapa perkara yang
 * dicatat sekaligus dalam satu duduk.
 *
 * Mesin antrian satker hanya menyimpan SATU hari pada satu waktu, sehingga
 * tidak ada riwayat pemanggilan yang dapat diukur di sini. Ambang ini karena
 * itu taksiran yang beralasan, bukan sebaran jarak pemanggilan yang terukur -
 * dan bila kelak riwayat itu ada, ia harus diukur ulang.
 *
 * Riwayat itu MULAI ADA sejak 27 September 2026: buku waktu antrian bot
 * (aleta_bot_antrian_waktu, lihat antrianWaktuService) menyimpan waktu
 * panggil berdetik tiap perkara, dan rekaman portal menyimpan jaraknya
 * (aleta_rekam_antrian.jarak_sebelum_detik). Sesudah beberapa pekan sidang,
 * batas di bawah patut diukur ulang dari sana - pita yang sama kini dipakai
 * "Dari sebelumnya" dan "Lama sidang" (lib/tiga-jarak-sidang.ts).
 */

export type PitaJarak = "hijau" | "kuning" | "jingga" | "merah" | "merah-gelap";

/** Batas dalam menit - lihat sebab angkanya di kepala berkas. */
export const BATAS_JARAK = [5, 15, 30, 60] as const;

const PITA: Array<{ pita: PitaJarak; sebutan: string; kelas: string }> = [
  {
    pita: "hijau",
    sebutan: "cepat",
    kelas:
      "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  {
    pita: "kuning",
    sebutan: "sedang",
    kelas:
      "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200",
  },
  {
    pita: "jingga",
    sebutan: "agak lama",
    kelas:
      "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-500/60 dark:bg-orange-500/15 dark:text-orange-200",
  },
  {
    pita: "merah",
    sebutan: "lama",
    kelas:
      "border-red-400 bg-red-100 text-red-900 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-200",
  },
  {
    pita: "merah-gelap",
    sebutan: "paling lama",
    kelas:
      "border-red-700 bg-red-700 text-white dark:border-red-500 dark:bg-red-800 dark:text-red-50",
  },
];

/**
 * Pita warna untuk satu jarak.
 *
 * Jarak negatif memulangkan null, tidak dipaksakan menjadi nol. Urutan
 * pemanggilan yang terbalik berarti datanya yang keliru - dan menampilkannya
 * sebagai "0 menit, cepat" menyembunyikan kekeliruan itu di balik warna
 * hijau.
 */
export function pitaJarak(menit: number | null | undefined): (typeof PITA)[number] | null {
  // null dan undefined ditolak SEBELUM diangkakan. Number(null) adalah 0 -
  // sehingga jarak yang tidak ada akan tampil sebagai "0 menit" berwarna
  // hijau, yaitu kabar paling menenangkan justru pada baris yang sama sekali
  // tidak punya angka.
  if (menit === null || menit === undefined) return null;
  const n = Number(menit);
  if (!Number.isFinite(n) || n < 0) return null;
  for (let i = 0; i < BATAS_JARAK.length; i += 1) {
    if (n < BATAS_JARAK[i]) return PITA[i];
  }
  return PITA[PITA.length - 1];
}

/**
 * Selisih menit antara dua jam "HH:MM" pada hari yang sama.
 *
 * Memulangkan null bila salah satunya tidak terbaca. Jam yang tidak terbaca
 * BUKAN nol: nol berarti dua perkara dipanggil pada menit yang sama, dan itu
 * keterangan yang berbeda sama sekali dari "belum dipanggil".
 */
export function selisihJam(awal: string, akhir: string): number | null {
  const a = menitHari(awal);
  const b = menitHari(akhir);
  if (a === null || b === null) return null;
  return b - a;
}

function menitHari(jam: string): number | null {
  const cocok = /^(\d{1,2}):(\d{2})/.exec(String(jam || "").trim());
  if (!cocok) return null;
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (j < 0 || j > 23 || m < 0 || m > 59) return null;
  return j * 60 + m;
}

/** "7 menit", "1 jam 5 menit" - bukan "65 menit", yang harus dihitung sendiri. */
export function sebutanJarak(menit: number): string {
  const n = Math.round(menit);
  if (n < 60) return `${n} menit`;
  const jam = Math.floor(n / 60);
  const sisa = n % 60;
  return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
}

export type BarisJarak = {
  kunci: string;
  ruangan?: string;
  jamPanggil?: string;
};

/**
 * Menghitung jarak tiap baris terhadap baris SEBELUMNYA di ruang yang sama.
 *
 * ============================================================================
 * PER RUANG, DAN ITU BUKAN KERAPIAN
 * ============================================================================
 *
 * Dua ruang sidang berjalan bersamaan. Menghitung jaraknya dalam satu deret
 * menghasilkan angka nol dan satu menit yang tidak pernah terjadi di ruang
 * mana pun - dan seluruh warnanya menjadi hijau justru pada hari yang
 * tersibuk.
 *
 * ============================================================================
 * DIURUT MENURUT JAM PANGGIL, BUKAN MENURUT URUTAN TAMPIL
 * ============================================================================
 *
 * Daftar di layar dapat diurutkan menurut apa saja - nomor perkara, majelis,
 * tanggal putusan. Menghitung jarak menurut urutan yang sedang tampil berarti
 * angkanya berubah tiap kali kepala kolom ditekan, dan angka yang berubah
 * karena pengurutan bukan angka tentang sidang.
 */
export function petaJarakAntarSidang(baris: BarisJarak[]): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const deret of deretPerRuang(baris)) {
    for (let i = 1; i < deret.length; i += 1) {
      hasil[deret[i].kunci] = deret[i].menit - deret[i - 1].menit;
    }
  }
  return hasil;
}

/**
 * Jarak tiap baris terhadap baris SESUDAHNYA di ruang yang sama.
 *
 * ============================================================================
 * KENAPA PERLU DUA ARAH
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: "perbandingan jarak antara perkara
 * dengan perkara selanjutnya". Yang sudah ada menjawab pertanyaan yang
 * berbeda - "berapa lama sesudah perkara sebelumnya" - dan keduanya dibaca
 * oleh orang yang berbeda.
 *
 * Yang menyusun jadwal melihat ke DEPAN: sesudah perkara ini, berapa lama
 * sampai yang berikutnya duduk. Yang sedang menjaga ruang sidang melihat ke
 * BELAKANG: sudah berapa lama sejak perkara sebelumnya dipanggil.
 *
 * Angka terakhir di tiap ruang tidak punya jarak berikutnya, dan itu memang
 * tidak diisi - bukan nol. Nol berarti "dipanggil bersamaan", dan itu keadaan
 * yang sungguh terjadi serta patut diwarnai merah.
 */
export function petaJarakBerikutSidang(baris: BarisJarak[]): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const deret of deretPerRuang(baris)) {
    for (let i = 0; i < deret.length - 1; i += 1) {
      hasil[deret[i].kunci] = deret[i + 1].menit - deret[i].menit;
    }
  }
  return hasil;
}

/**
 * Baris yang punya jam panggil, dikelompokkan per ruang dan diurutkan menurut
 * jamnya.
 *
 * Dipakai bersama oleh kedua peta di atas supaya keduanya tidak pernah
 * mengurutkan dengan cara yang berbeda: jarak-ke-belakang dan jarak-ke-depan
 * yang dihitung dari dua urutan yang berlainan akan saling bertentangan pada
 * baris yang sama, dan tidak ada pada layarnya yang memberi tahu mana yang
 * benar.
 */
function deretPerRuang(baris: BarisJarak[]): Array<Array<{ kunci: string; menit: number }>> {
  const perRuang = new Map<string, Array<{ kunci: string; menit: number }>>();
  for (const b of baris) {
    const menit = menitHari(String(b.jamPanggil || ""));
    if (menit === null) continue;
    const ruang = String(b.ruangan || "");
    if (!perRuang.has(ruang)) perRuang.set(ruang, []);
    perRuang.get(ruang)!.push({ kunci: b.kunci, menit });
  }
  for (const deret of perRuang.values()) deret.sort((a, b) => a.menit - b.menit);
  return [...perRuang.values()];
}

/**
 * ============================================================================
 * TETANGGA MANA - SUPAYA ANGKANYA DAPAT DIPERIKSA
 * ============================================================================
 *
 * Keluhan pengguna 23 September 2026: jeda antar-perkara pada layar Antrian
 * Sidang terasa tidak cocok satu sama lain. Dari tangkapan layarnya sendiri,
 * antrian 1 bertulis "→35" sedangkan antrian 2 tepat di bawahnya bertulis
 * "+4" - padahal 09:22 ke 10:01 berjarak 39 menit.
 *
 * Keduanya BENAR. Ada perkara ketiga yang dipanggil 09:57 di ruang yang sama,
 * dan ia tidak ikut tergambar karena tabelnya sedang disaring atau diurutkan
 * menurut hal lain. Angkanya menunjuk tetangga di RUANG yang sama menurut JAM
 * PANGGIL - bukan baris di atas atau di bawahnya pada tabel.
 *
 * Yang salah karena itu bukan hitungannya melainkan bahwa ia tidak dapat
 * diperiksa: tidak ada yang menyebutkan tetangga MANA yang dimaksud, sehingga
 * dua angka yang benar terbaca sebagai dua angka yang bertengkar.
 *
 * Kedua peta di bawah memulangkan KUNCI tetangganya, supaya layar dapat
 * menyebut nomor antriannya di dalam judul penandanya.
 */
export function petaTetanggaSebelum(baris: BarisJarak[]): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const deret of deretPerRuang(baris)) {
    for (let i = 1; i < deret.length; i += 1) {
      hasil[deret[i].kunci] = deret[i - 1].kunci;
    }
  }
  return hasil;
}

/** Pasangan petaTetanggaSebelum - lihat keterangannya di sana. */
export function petaTetanggaBerikut(baris: BarisJarak[]): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const deret of deretPerRuang(baris)) {
    for (let i = 0; i < deret.length - 1; i += 1) {
      hasil[deret[i].kunci] = deret[i + 1].kunci;
    }
  }
  return hasil;
}
