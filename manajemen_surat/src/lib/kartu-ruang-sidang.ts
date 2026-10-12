/**
 * ============================================================================
 * KARTU RUANG SIDANG DI BAWAH DERETAN ALAT JADWAL SIDANG (12 Okt 2026, butir 3)
 * ============================================================================
 *
 * Diminta pengguna: "tambahkan tab baru di bawah tab Hitung skor yaitu ruang
 * sidang yang digunakan, buat kolom roundednya agak besar dan berwarna (beda
 * warna tiap ruang sidang) dengan keterangan nama ruang sidangnya serta jumlah
 * perkara dan keterangan perlu diperiksa, buat defaultnya itu minimize."
 *
 * Tombol ruang di ujung kanan deretan alat (ruang-sidang-saring.ts, saklar
 * saring-ruang) TETAP ADA. Kartu ini pelengkapnya: lebih besar, berwarna, dan
 * memuat angka "perlu diperiksa" per ruang - yang tidak dimuat tombolnya.
 * Menekan kartu memakai saringan yang SAMA (setRuangDipilih), jadi keduanya
 * selalu sepakat tentang ruang mana yang sedang dipilih.
 *
 * ============================================================================
 * "PERLU DIPERIKSA" TIDAK DIDEFINISIKAN ULANG DI SINI
 * ============================================================================
 *
 * Angka per ruang dihitung dengan predikat kotak gabungan "Perlu diperiksa"
 * yang sudah ada di layar (seluruh penanda merah + sidang yang lewat pukul
 * 15:00 WITA tanpa hasil). Berkas ini hanya menerima predikatnya dari layar -
 * jadi jumlah di semua kartu bila dijumlahkan sama dengan angka pada kotak
 * Perlu diperiksa untuk jadwal yang sama. Aturan kedua yang sedikit berbeda
 * akan melahirkan dua angka "perlu diperiksa" yang tidak sama di satu layar.
 *
 * ============================================================================
 * WARNA TETAP PER RUANG
 * ============================================================================
 *
 * Ruang yang sama sebaiknya berwarna sama dari hari ke hari, supaya mata
 * belajar "biru = Ruang Sidang 1". Warna dipilih dari nomor ruang bila namanya
 * memuat angka ("Ruang Sidang 2" -> warna ke-2), selain itu dari sidik jari
 * namanya. Dua ruang yang jatuh ke warna yang sama pada jadwal yang sama
 * digeser ke warna kosong berikutnya, supaya TIDAK ADA dua kartu sewarna pada
 * satu layar (sepanjang ruangnya tidak lebih banyak daripada paletnya).
 * Ruang diproses menurut urutan nama alami sehingga hasilnya deterministik.
 *
 * Warna ditulis sebagai kelas Tailwind lengkap (bukan dirangkai) supaya
 * tersapu oleh pemindai kelas, tiap warna dengan padanan gelapnya. Merah
 * sengaja TIDAK ada di palet: merah milik "perlu diperiksa".
 */

import { daftarRuangAktif } from "@/lib/ruang-sidang-saring";

export type WarnaKartuRuang = {
  kunci: string;
  /** Kartunya: batas, latar, tulisan. */
  kartu: string;
  /** Titik kecil pada ringkasan saat panel diciutkan. */
  titik: string;
  /** Cincin saat kartunya sedang dipilih. */
  cincin: string;
  /** Lencana jumlah perkara. */
  lencana: string;
};

export const PALET_KARTU_RUANG: readonly WarnaKartuRuang[] = [
  {
    kunci: "sky",
    kartu: "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-50 dark:hover:bg-sky-900/60",
    titik: "bg-sky-500 dark:bg-sky-400",
    cincin: "ring-2 ring-sky-500 dark:ring-sky-400",
    lencana: "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  },
  {
    kunci: "emerald",
    kartu: "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50 dark:hover:bg-emerald-900/60",
    titik: "bg-emerald-500 dark:bg-emerald-400",
    cincin: "ring-2 ring-emerald-500 dark:ring-emerald-400",
    lencana: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  },
  {
    kunci: "violet",
    kartu: "border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-50 dark:hover:bg-violet-900/60",
    titik: "bg-violet-500 dark:bg-violet-400",
    cincin: "ring-2 ring-violet-500 dark:ring-violet-400",
    lencana: "bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100",
  },
  {
    kunci: "amber",
    kartu: "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/60",
    titik: "bg-amber-500 dark:bg-amber-400",
    cincin: "ring-2 ring-amber-500 dark:ring-amber-400",
    lencana: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  },
  {
    kunci: "teal",
    kartu: "border-teal-300 bg-teal-50 text-teal-950 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-50 dark:hover:bg-teal-900/60",
    titik: "bg-teal-500 dark:bg-teal-400",
    cincin: "ring-2 ring-teal-500 dark:ring-teal-400",
    lencana: "bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-100",
  },
  {
    kunci: "fuchsia",
    kartu: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950 hover:bg-fuchsia-100 dark:border-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-50 dark:hover:bg-fuchsia-900/60",
    titik: "bg-fuchsia-500 dark:bg-fuchsia-400",
    cincin: "ring-2 ring-fuchsia-500 dark:ring-fuchsia-400",
    lencana: "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-900 dark:text-fuchsia-100",
  },
  {
    kunci: "indigo",
    kartu: "border-indigo-300 bg-indigo-50 text-indigo-950 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-50 dark:hover:bg-indigo-900/60",
    titik: "bg-indigo-500 dark:bg-indigo-400",
    cincin: "ring-2 ring-indigo-500 dark:ring-indigo-400",
    lencana: "bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100",
  },
  {
    kunci: "lime",
    kartu: "border-lime-300 bg-lime-50 text-lime-950 hover:bg-lime-100 dark:border-lime-700 dark:bg-lime-950/50 dark:text-lime-50 dark:hover:bg-lime-900/60",
    titik: "bg-lime-500 dark:bg-lime-400",
    cincin: "ring-2 ring-lime-500 dark:ring-lime-400",
    lencana: "bg-lime-200 text-lime-900 dark:bg-lime-900 dark:text-lime-100",
  },
  {
    kunci: "cyan",
    kartu: "border-cyan-300 bg-cyan-50 text-cyan-950 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-50 dark:hover:bg-cyan-900/60",
    titik: "bg-cyan-500 dark:bg-cyan-400",
    cincin: "ring-2 ring-cyan-500 dark:ring-cyan-400",
    lencana: "bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100",
  },
  {
    kunci: "orange",
    kartu: "border-orange-300 bg-orange-50 text-orange-950 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-50 dark:hover:bg-orange-900/60",
    titik: "bg-orange-500 dark:bg-orange-400",
    cincin: "ring-2 ring-orange-500 dark:ring-orange-400",
    lencana: "bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-100",
  },
];

function bersih(nilai: unknown): string {
  return String(nilai ?? "").replace(/\s+/g, " ").trim();
}

/** Sidik jari sederhana (djb2) - stabil antarproses, tidak bergantung pada Math.random. */
function sidikJari(teks: string): number {
  let h = 5381;
  for (let i = 0; i < teks.length; i += 1) h = ((h << 5) + h + teks.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Warna pilihan pertama sebuah ruang, 0..palet-1.
 *
 * Nomor ruang dipakai bila ada ("Ruang Sidang 3" -> 2); yang memuat beberapa
 * angka memakai angka PERTAMA. Tanpa angka ("Terpadu Sindue"): sidik jari
 * namanya yang sudah dinormalkan (huruf kecil, spasi tunggal).
 */
export function indeksWarnaPilihan(nama: string, ukuranPalet = PALET_KARTU_RUANG.length): number {
  const n = bersih(nama).toLowerCase();
  const angka = /(\d+)/.exec(n);
  if (angka) return (Math.max(1, Number(angka[1])) - 1) % ukuranPalet;
  return sidikJari(n) % ukuranPalet;
}

/**
 * Menetapkan warna tiap ruang pada satu jadwal, tanpa dua ruang sewarna
 * selama paletnya masih cukup. Masukannya urut nama alami (seperti
 * daftarRuangAktif) supaya hasilnya deterministik.
 */
export function tetapkanWarnaRuang(namaRuang: readonly string[]): Record<string, number> {
  const ukuran = PALET_KARTU_RUANG.length;
  const terpakai = new Set<number>();
  const hasil: Record<string, number> = {};
  for (const nama of namaRuang) {
    let indeks = indeksWarnaPilihan(nama, ukuran);
    if (terpakai.size < ukuran) {
      while (terpakai.has(indeks)) indeks = (indeks + 1) % ukuran;
    }
    terpakai.add(indeks);
    hasil[nama] = indeks;
  }
  return hasil;
}

export type KartuRuang = {
  nama: string;
  /** Seluruh sidang di ruang itu pada rentang yang dibuka. */
  jumlah: number;
  /** Di antaranya yang masuk kotak "Perlu diperiksa". */
  perlu: number;
  warna: WarnaKartuRuang;
};

/**
 * Satu kartu per ruang yang dipakai, urut nama alami.
 *
 * Dihitung dari SELURUH sidang pada rentang itu, bukan dari yang sudah
 * tersaring - sama seperti tombol ruang dan kotak keadaan: angka yang ikut
 * menyusut membuat kartu lain tampak nol dan mustahil dipilih kembali.
 *
 * @param perluDiperiksa predikat kotak gabungan "Perlu diperiksa" milik layar.
 */
export function susunKartuRuang<T extends { ruangan?: string | null }>(
  sidang: ReadonlyArray<T>,
  perluDiperiksa: (baris: T) => boolean
): KartuRuang[] {
  const ruang = daftarRuangAktif(sidang);
  const warna = tetapkanWarnaRuang(ruang.map((r) => r.nama));
  const perlu = new Map<string, number>();
  for (const baris of sidang) {
    const nama = bersih(baris.ruangan);
    if (!nama) continue;
    if (perluDiperiksa(baris)) perlu.set(nama, (perlu.get(nama) ?? 0) + 1);
  }
  return ruang.map((r) => ({
    nama: r.nama,
    jumlah: r.jumlah,
    perlu: perlu.get(r.nama) ?? 0,
    warna: PALET_KARTU_RUANG[warna[r.nama] ?? 0],
  }));
}

/** Jumlah perkara dan yang perlu diperiksa di seluruh ruang - untuk ringkasan saat panel diciutkan. */
export function ringkasKartuRuang(kartu: ReadonlyArray<KartuRuang>): {
  ruang: number;
  perkara: number;
  perlu: number;
} {
  return {
    ruang: kartu.length,
    perkara: kartu.reduce((n, k) => n + k.jumlah, 0),
    perlu: kartu.reduce((n, k) => n + k.perlu, 0),
  };
}

/** Kunci simpanan peramban untuk keadaan terbuka/diciutkan. */
export const KUNCI_SIMPANAN_KARTU_RUANG = "aleta.jadwal-sidang.kartu-ruang-terbuka";

/** Bawaannya DICIUTKAN; hanya "1" yang berarti terbuka. Simpanan rusak = bawaan. */
export function bacaKartuRuangTerbuka(mentah: string | null | undefined): boolean {
  return mentah === "1";
}

/** Membaca keadaan dari peramban; apa pun galatnya (mode privat, data diblokir) = diciutkan. */
export function muatKartuRuangTerbuka(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return bacaKartuRuangTerbuka(window.localStorage.getItem(KUNCI_SIMPANAN_KARTU_RUANG));
  } catch {
    return false;
  }
}

/** Menulis keadaan ke peramban; gagal menulis tidak boleh mengganggu layar. */
export function simpanKartuRuangTerbuka(terbuka: boolean): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KUNCI_SIMPANAN_KARTU_RUANG, terbuka ? "1" : "0");
  } catch {
    /* peramban menolak penyimpanan - pilihan hanya berlaku selama layar terbuka */
  }
}

/**
 * Kalimat keterangan "perlu diperiksa" di bawah kartu. Daftar penandanya
 * dikirim layar (dihitung dari penanda merah yang sama), bukan ditulis ulang
 * di sini.
 */
export function keteranganPerluDiperiksa(labelPenandaMerah: ReadonlyArray<string>, jamBatas: string): string {
  const daftar = labelPenandaMerah.length > 0 ? labelPenandaMerah.join(", ") : "penanda merah";
  return (
    `Perlu diperiksa = perkara di ruang itu yang menyandang penanda merah (${daftar}) ` +
    `atau sudah lewat pukul ${jamBatas} WITA pada hari sidangnya tetapi hasilnya belum dicatat. ` +
    "Aturannya sama persis dengan kotak Perlu diperiksa di bawah; perkara yang ruangnya tidak terbaca tidak punya kartu."
  );
}
