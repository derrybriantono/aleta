/**
 * Pengelompokan isian Kelas B (Tahap 3 - Kemandirian Blangko).
 *
 * ============================================================================
 * 144 KOTAK KOSONG BUKAN LAYAR ISIAN
 * ============================================================================
 *
 * Kelas B adalah variabel yang nilainya HANYA diketahui hakim atau panitera
 * yang menyidangkan - mas kawin, status wali nikah, alasan poligami. Tidak ada
 * sumbernya di mana pun, dan menebaknya berarti mengarang fakta perkara.
 *
 * Menampilkannya sebagai daftar 144 kotak berurutan nomor akan membuat panitera
 * menghadapi "#0650#", "#1046#", "#1152#" tanpa tahu mana yang berlaku untuk
 * perkaranya. Yang dibutuhkan pengelompokan menurut MAKNANYA, dan kelompok yang
 * tidak berlaku tidak perlu ditampilkan sama sekali.
 *
 * ============================================================================
 * KELOMPOKNYA DARI NAMA VARIABELNYA, BUKAN DARI DAFTAR TANGAN
 * ============================================================================
 *
 * ABT sudah menuliskan maknanya di dalam nama variabel: "(Dispensasi)",
 * "(IN)", "Hadhanah", "Prodeo", "poligami". Menyusun daftar tersendiri berarti
 * daftar itu harus dijaga tetap cocok dengan kamus yang isinya dapat disalin
 * ulang kapan saja - dan begitu keduanya berselisih, yang muncul di layar
 * adalah isian yang tidak ada atau isian yang ada tetapi tidak terlihat.
 */

export type KelompokIsian = {
  kode: string;
  nama: string;
  /** Urutan tampil - yang paling sering dipakai lebih dulu. */
  urutan: number;
};

export const KELOMPOK: KelompokIsian[] = [
  { kode: "pernikahan", nama: "Keterangan pernikahan (isbat nikah)", urutan: 1 },
  { kode: "perceraian", nama: "Keterangan perceraian", urutan: 2 },
  { kode: "dispensasi", nama: "Dispensasi kawin", urutan: 3 },
  { kode: "anak", nama: "Hadhanah, perwalian, dan anak", urutan: 4 },
  { kode: "waris", nama: "Waris dan pihak yang meninggal", urutan: 5 },
  { kode: "poligami", nama: "Poligami", urutan: 6 },
  { kode: "bukti", nama: "Alat bukti surat", urutan: 7 },
  { kode: "kuasa", nama: "Kuasa hukum", urutan: 8 },
  { kode: "izin-atasan", nama: "Izin atasan dan prodeo", urutan: 9 },
  { kode: "keuangan", nama: "Biaya dan kasir", urutan: 10 },
  { kode: "lain", nama: "Lain-lain", urutan: 99 },
];

/**
 * Aturan pencocokan, DIURUTKAN - yang pertama cocok menang.
 *
 * Urutannya penting: "Alamat Wanita (dispensasi)" memuat kata "alamat" yang
 * juga muncul di kelompok lain, tetapi "(dispensasi)" lebih menentukan. Yang
 * lebih khusus harus diperiksa lebih dulu.
 */
const ATURAN: Array<[RegExp, string]> = [
  [/\(dispensasi\)|dispensasi kawin|\bDK\b/i, "dispensasi"],
  [/hadhanah|perwalian|hak asuh|menjenguk anak|akta kelahiran|dikarunai anak|dikaruniai anak/i, "anak"],
  [/poligami|istri pertama|calon suami|calon\/suami|eratnya hubungan calon/i, "poligami"],
  [/almarhum|almarhumah|meninggal|waris|kematian/i, "waris"],
  [/prodeo|izin cerai|atasan|surat izin/i, "izin-atasan"],
  [/kasir|meterai|biaya|nip\b/i, "keuangan"],
  [/kuasa/i, "kuasa"],
  [
    /\(IN\)|itsbat|isbat|mas kawin|maskawin|wali nikah|saksi nikah|sblm nikah|setelah nikah|surat nikah|penolakan kua|ket\. kua|syahadah/i,
    "pernikahan",
  ],
  [/konflik|pisah rumah|komunikasi|damaikan|penghasilan|jawaban replik|nafkah/i, "perceraian"],
  [/^no\.|^nomor|akta|kartu keluarga|bukti|alat-alat bukti|duplikat/i, "bukti"],
];

/** Kelompok sebuah variabel Kelas B menurut namanya. */
export function kelompokUntuk(nama: string): string {
  const t = String(nama ?? "");
  for (const [pola, kode] of ATURAN) {
    if (pola.test(t)) return kode;
  }
  return "lain";
}

export type ButirIsian = {
  noVar: string;
  nama: string;
  kelompok: string;
  /** Nilai yang sudah tersimpan, kosong bila belum diisi. */
  nilai: string;
  diisiOleh: string;
  diisiAt: string;
  /** Berapa kali penanda ini muncul di pustaka blangko - dasar pengurutan. */
  jumlahPakai: number;
};

export type KelompokTerisi = {
  kode: string;
  nama: string;
  urutan: number;
  butir: ButirIsian[];
  jumlahTerisi: number;
};

/**
 * Menyusun butir menjadi kelompok yang siap ditampilkan.
 *
 * Kelompok kosong TIDAK dibuang: panitera perlu melihat bahwa kelompok itu ada
 * dan belum satu pun terisi. Yang disembunyikan adalah kelompok yang tidak
 * memuat satu butir pun untuk blangko ini - itu memang tidak berlaku.
 */
export function susunKelompok(butir: ButirIsian[]): KelompokTerisi[] {
  const peta = new Map<string, ButirIsian[]>();
  for (const b of butir) {
    const daftar = peta.get(b.kelompok) ?? [];
    daftar.push(b);
    peta.set(b.kelompok, daftar);
  }

  return KELOMPOK.filter((k) => peta.has(k.kode))
    .map((k) => {
      const daftar = (peta.get(k.kode) ?? []).sort((a, b) => {
        // Yang paling sering dipakai lebih dulu; nomor variabel sebagai
        // penyeimbang supaya urutannya ajek antar pembukaan halaman.
        if (b.jumlahPakai !== a.jumlahPakai) return b.jumlahPakai - a.jumlahPakai;
        return a.noVar.localeCompare(b.noVar);
      });
      return {
        kode: k.kode,
        nama: k.nama,
        urutan: k.urutan,
        butir: daftar,
        jumlahTerisi: daftar.filter((b) => b.nilai.trim()).length,
      };
    })
    .sort((a, b) => a.urutan - b.urutan);
}

/** Ringkasan kesiapan isian sebuah perkara. */
export function ringkasIsian(kelompok: KelompokTerisi[]): {
  jumlah: number;
  terisi: number;
  kosong: number;
  kalimat: string;
} {
  const jumlah = kelompok.reduce((a, k) => a + k.butir.length, 0);
  const terisi = kelompok.reduce((a, k) => a + k.jumlahTerisi, 0);
  const kosong = jumlah - terisi;
  if (jumlah === 0) return { jumlah, terisi, kosong, kalimat: "Blangko ini tidak menuntut isian tangan." };
  if (kosong === 0) return { jumlah, terisi, kosong, kalimat: `Seluruh ${jumlah} isian sudah terisi.` };
  return {
    jumlah,
    terisi,
    kosong,
    kalimat: `${terisi} dari ${jumlah} isian sudah terisi; ${kosong} lagi menunggu.`,
  };
}
