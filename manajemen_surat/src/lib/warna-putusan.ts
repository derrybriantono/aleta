/**
 * Warna penanda menurut status putusan.
 *
 * ============================================================================
 * SATU ATURAN, DIPAKAI SETIAP LAYAR YANG MENYEBUT STATUS PUTUSAN
 * ============================================================================
 *
 * Aturan ini semula tinggal di dalam layar jadwal sidang. Begitu layar Status
 * Perkara ikut mewarnai statusnya, ada dua pilihan: menyalinnya, atau
 * mengangkatnya ke sini. Menyalinnya akan sama-sama bekerja - lalu pada suatu
 * hari satu layar menghijaukan status yang dimerahkan layar lain, untuk
 * perkara yang persis sama, dan tidak seorang pun tahu mana yang benar.
 *
 * ============================================================================
 * WARNANYA MENYEBUT ARTI, BUKAN SELERA
 * ============================================================================
 *
 * Tujuh status yang benar-benar dipakai PA Donggala, dibaca dari tabel
 * status_putusan SIPP - bukan daftar yang dikarang:
 *
 *   Dikabulkan, Dikabulkan Sebagian, Perdamaian   hijau  permohonan berhasil
 *   Ditolak                                       merah  ditolak pokoknya
 *   Tidak Dapat Diterima                          kuning bukan ditolak - tidak
 *                                                        diperiksa pokoknya,
 *                                                        dan boleh diajukan lagi
 *   Digugurkan, Gugur                             kuning berhenti tanpa putusan
 *   Dicabut, Dicoret dari Register                kelabu ditarik pemohonnya
 *
 * ============================================================================
 * TIGA KEPUTUSAN YANG MUDAH DIPERSOALKAN - DAN SEBABNYA
 * ============================================================================
 *
 * 1. "Tidak Dapat Diterima" TIDAK merah.
 *
 *    Ia bukan kekalahan. Syarat formalnya belum terpenuhi - salah pihak, salah
 *    kewenangan, gugatan kabur - dan perkaranya boleh diajukan kembali sesudah
 *    diperbaiki. Ditolak berarti pokoknya sudah diperiksa dan tidak berdasar,
 *    dan mengajukannya lagi menabrak nebis in idem.
 *
 *    Dua keadaan yang akibatnya berlawanan bagi pihak yang membacanya, dan
 *    warna yang sama akan menyamakannya.
 *
 * 2. "Dicabut" dan "Dicoret dari Register" KELABU, bukan merah maupun kuning.
 *
 *    Keduanya bukan penilaian atas perkaranya - pemohonnya sendiri yang
 *    menarik. Tidak ada yang perlu ditindaklanjuti siapa pun, dan warna yang
 *    menuntut perhatian pada perkara yang sudah selesai atas kehendak
 *    pihaknya hanya menambah warna yang harus diabaikan.
 *
 * 3. "Perdamaian" HIJAU, sederajat dengan dikabulkan.
 *
 *    PERMA 1/2016 menempatkan perdamaian sebagai hasil yang paling
 *    dikehendaki. Mewarnainya lebih pucat daripada dikabulkan akan
 *    menyampaikan yang sebaliknya.
 *
 * ============================================================================
 * YANG TIDAK DIKENALI TETAP TAMPIL
 * ============================================================================
 *
 * Status di luar daftar dikembalikan netral, bukan disembunyikan dan bukan
 * dipaksa masuk salah satu warna. Nama status ditentukan operator SIPP dan
 * dapat bertambah kapan saja; status baru yang tidak terbaca sama sekali jauh
 * lebih merugikan daripada status yang tampil tanpa warna.
 */
export type WarnaPutusan = "success" | "danger" | "warning" | "muted" | "outline";

export function warnaStatusPutusan(status: string): WarnaPutusan {
  const teks = String(status || "").toLowerCase();
  if (!teks) return "muted";

  // Diperiksa PALING DULU: "tidak dapat diterima" tidak memuat kata tolak,
  // tetapi urutan yang keliru pada pola lain dapat merebutnya kelak.
  if (/tidak\s+dapat\s+diterima/.test(teks)) return "warning";

  if (/dikabulkan|perdamaian|damai/.test(teks)) return "success";
  if (/tolak/.test(teks)) return "danger";
  if (/gugur/.test(teks)) return "warning";
  if (/cabut|dicoret/.test(teks)) return "muted";
  return "outline";
}

/**
 * Kelas warna tulisan untuk status putusan, bagi tempat yang bukan lencana.
 *
 * Dipakai keterangan di dalam tabel dan baris rincian - tempat yang tidak
 * pantas diberi lencana penuh tetapi tetap perlu mewarnai artinya. Warnanya
 * diturunkan dari aturan yang SAMA di atas, sehingga lencana dan tulisan tidak
 * mungkin menyebut arti yang berbeda untuk status yang sama.
 */
export function kelasTulisanPutusan(status: string): string {
  switch (warnaStatusPutusan(status)) {
    case "success":
      return "text-emerald-700 dark:text-emerald-300";
    case "danger":
      return "text-rose-700 dark:text-rose-300";
    case "warning":
      return "text-amber-700 dark:text-amber-300";
    case "muted":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}
