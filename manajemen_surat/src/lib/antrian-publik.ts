/**
 * ============================================================================
 * ANTRIAN SIDANG TANPA LOGIN - DAFTAR RUAS DAN BAWAANNYA
 * ============================================================================
 *
 * Diminta pengguna 23 September 2026: satu alamat yang dapat dibuka tanpa
 * login untuk melihat antrian sidang, beserta pengaturan di admin ALETA
 * tentang ruas mana yang boleh tampil. Bawaannya seluruhnya tampil.
 *
 * Daftarnya ditulis SATU KALI di sini dan dibaca layar, rute, maupun panel
 * pengaturannya. Tiga daftar terpisah yang menyebut hal yang sama selalu
 * berakhir dengan satu yang tertinggal - dan yang tertinggal di sini berarti
 * ruas yang dikira mati ternyata tetap terkirim.
 *
 * ============================================================================
 * "PEKA" BUKAN "TERLARANG"
 * ============================================================================
 *
 * Empat ruas ditandai peka: nomor perkara, nama para pihak, agenda, dan nama
 * majelis. Penandanya tidak mematikan apa pun dan tidak menghalangi apa pun -
 * ia hanya memastikan yang menyalakannya tahu apa yang dinyalakannya.
 *
 * Sebabnya: alamat ini terbuka bagi siapa pun yang dapat membukanya, tanpa
 * login dan tanpa jejak siapa yang membacanya. Televisi ruang tunggu
 * memperlihatkan hal yang sama kepada semua orang yang duduk di sana, tetapi
 * jangkauannya berhenti di pintu ruang tunggu; sebuah alamat tidak.
 */

/** Satu ruas yang dapat dinyalakan atau dimatikan. */
export type RuasAntrianPublik = {
  kunci: string;
  label: string;
  keterangan: string;
  /** Menyangkut identitas orang atau perkaranya. Ditandai di layar pengaturan. */
  peka: boolean;
};

export const RUAS_ANTRIAN_PUBLIK: RuasAntrianPublik[] = [
  {
    kunci: "nomorAntrian",
    label: "Nomor antrian",
    keterangan: "Angka besar yang dibaca dari kejauhan. Tanpa ini layarnya tidak ada gunanya.",
    peka: false,
  },
  {
    kunci: "noRuang",
    label: "Nomor ruang sidang",
    keterangan: "Ruang mana yang memanggil. Diperlukan ketika lebih dari satu ruang berjalan.",
    peka: false,
  },
  {
    kunci: "keadaan",
    label: "Keadaan (menunggu / dipanggil)",
    keterangan: "Membedakan yang sedang dipanggil dari yang masih menunggu giliran.",
    peka: false,
  },
  {
    kunci: "jamPanggil",
    label: "Jam dipanggil",
    keterangan: "Dipakai menaksir giliran berikutnya.",
    peka: false,
  },
  {
    kunci: "menitMenunggu",
    label: "Sudah menunggu berapa lama",
    keterangan: "Lama menunggu sejak nomor diambil. Berhenti dihitung begitu dipanggil.",
    peka: false,
  },
  {
    kunci: "nomorPerkara",
    label: "Nomor perkara",
    keterangan:
      "Menghubungkan nomor antrian dengan perkaranya. Siapa pun yang membaca layar dapat mencatatnya.",
    peka: true,
  },
  {
    kunci: "namaPihak",
    label: "Nama para pihak",
    keterangan:
      "Identitas orang yang sedang berperkara. Menolong mereka mengenali gilirannya, dan terbaca semua orang.",
    peka: true,
  },
  {
    kunci: "agenda",
    label: "Agenda sidang",
    keterangan:
      "Tahapan yang akan disidangkan - mis. pembuktian, putusan. Menerangkan isi perkaranya.",
    peka: true,
  },
  {
    kunci: "majelis",
    label: "Majelis hakim",
    keterangan: "Siapa yang menyidangkan. Tidak menolong yang menunggu, menolong petugas.",
    peka: true,
  },
];

export type TampilAntrianPublik = Record<string, boolean>;

/**
 * Bawaan: SELURUHNYA menyala.
 *
 * Diminta dengan tegas. Yang perlu diketahui akibatnya ada di keterangan tiap
 * ruas yang ditandai peka - dan penandanya muncul tiap kali pengaturannya
 * dibuka, bukan sekali saat dipasang.
 */
export function bawaanTampilAntrianPublik(): TampilAntrianPublik {
  const hasil: TampilAntrianPublik = {};
  for (const ruas of RUAS_ANTRIAN_PUBLIK) hasil[ruas.kunci] = true;
  return hasil;
}

/**
 * Menormalkan isi tampil_json.
 *
 * Kunci yang tidak dikenali DIBUANG - bukan diteruskan. Pengaturan lama yang
 * menyebut ruas yang sudah tidak ada akan terbaca sebagai izin bagi ruas yang
 * tidak diperiksa siapa pun.
 *
 * Kunci yang belum ada mengikuti BAWAAN, bukan mati. Ruas baru yang lahir
 * sesudah pengaturan disimpan harus mengikuti keputusan yang sama dengan
 * saudara-saudaranya; memaksanya mati berarti fitur baru selalu tidak tampil
 * sampai seseorang menyadarinya.
 */
export function normalkanTampilAntrianPublik(nilai: unknown): TampilAntrianPublik {
  const bawaan = bawaanTampilAntrianPublik();
  if (!nilai || typeof nilai !== "object") return bawaan;
  const masuk = nilai as Record<string, unknown>;
  const hasil: TampilAntrianPublik = {};
  for (const ruas of RUAS_ANTRIAN_PUBLIK) {
    hasil[ruas.kunci] =
      typeof masuk[ruas.kunci] === "boolean" ? (masuk[ruas.kunci] as boolean) : bawaan[ruas.kunci];
  }
  return hasil;
}

/** Seluruh pengaturan layar antrian tanpa login. */
export type PengaturanAntrianPublik = {
  aktif: boolean;
  tampil: TampilAntrianPublik;
  judul: string;
  catatan: string;
  diperbaruiPada: string;
};

export const BAWAAN_ANTRIAN_PUBLIK: PengaturanAntrianPublik = {
  aktif: true,
  tampil: bawaanTampilAntrianPublik(),
  judul: "",
  catatan: "",
  diperbaruiPada: "",
};

/** Ruas peka yang sedang menyala - dipakai layar pengaturan untuk memberi tahu. */
export function ruasPekaMenyala(tampil: TampilAntrianPublik): RuasAntrianPublik[] {
  return RUAS_ANTRIAN_PUBLIK.filter((ruas) => ruas.peka && tampil[ruas.kunci]);
}
