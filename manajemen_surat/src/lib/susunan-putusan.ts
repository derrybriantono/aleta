/**
 * SUSUNAN BAKU PUTUSAN (F1) - kerangkanya lebih dulu, isinya belakangan.
 *
 * ============================================================================
 * SUSUNANNYA BUKAN SELERA, MELAINKAN SYARAT SAH
 * ============================================================================
 *
 * Putusan pengadilan agama punya bagian yang wajib ada dan wajib berurutan.
 * Kepala putusan tanpa irah-irah "DEMI KEADILAN BERDASARKAN KETUHANAN YANG
 * MAHA ESA" bukan putusan yang kurang rapi - ia putusan yang batal. Begitu
 * pula amar yang mendahului pertimbangan: pembacanya kehilangan satu-satunya
 * cara memeriksa apakah amar itu punya dasar.
 *
 * Karena itu kerangka di sini bukan cetakan yang boleh diubah pemakainya. Ia
 * daftar tertutup, dan perakit hanya boleh MENGISI, tidak menambah bagian
 * baru maupun menukar urutannya.
 *
 * ============================================================================
 * BAGIAN YANG KOSONG DINYATAKAN KOSONG
 * ============================================================================
 *
 * Godaan terbesar penyusun otomatis adalah menyembunyikan bagian yang tidak
 * berhasil diisi, sehingga naskahnya tampak utuh. Naskah yang tampak utuh
 * padahal duduk perkaranya kosong jauh lebih berbahaya daripada naskah yang
 * dengan terang menulis "belum terisi": yang pertama ditandatangani, yang
 * kedua diperiksa.
 *
 * Maka tiap bagian membawa keadaannya sendiri, dan `siapDitandatangani`
 * menolak selama masih ada bagian wajib yang kosong.
 *
 * ============================================================================
 * TIDAK ADA SATU PUN PANGGILAN MODEL DI BERKAS INI
 * ============================================================================
 *
 * Seluruh isi datang dari berkas perkara, BAS, pustaka pertimbangan, dan
 * templat - semuanya sudah pernah dibaca manusia. Kalimat yang tidak
 * bersumber dari salah satunya tidak akan muncul, karena tidak ada tempat
 * baginya untuk muncul.
 */

/** Bagian putusan, dalam urutan yang tidak boleh ditukar. */
export type KunciBagian =
  | "kepala"
  | "identitas"
  | "dudukPerkara"
  | "pertimbangan"
  | "amar"
  | "penutup";

export type Bagian = {
  kunci: KunciBagian;
  /** Judul sebagaimana dibaca petugas, bukan nama teknisnya. */
  judul: string;
  /** Wajib ada supaya putusan sah - bukan wajib menurut selera penyusun. */
  wajib: boolean;
  isi: string;
  /** Butir pustaka yang dipakai bagian ini, untuk ditelusuri kembali (F6). */
  butirDipakai: string[];
  /** Sebab bagian ini belum terisi, dalam bahasa yang terbaca petugas. */
  halangan: string;
};

export type Kerangka = {
  bagian: Bagian[];
  /** Bagian wajib yang masih kosong - selama tidak kosong, draf tidak siap. */
  belumTerisi: KunciBagian[];
  siapDitandatangani: boolean;
};

/**
 * Susunan bakunya. Urutan larik INILAH urutan naskah - tidak ada nomor urut
 * terpisah yang dapat berselisih dengannya.
 */
const SUSUNAN: Array<{ kunci: KunciBagian; judul: string; wajib: boolean }> = [
  { kunci: "kepala", judul: "Kepala putusan", wajib: true },
  { kunci: "identitas", judul: "Identitas para pihak", wajib: true },
  { kunci: "dudukPerkara", judul: "Duduk perkara", wajib: true },
  { kunci: "pertimbangan", judul: "Pertimbangan hukum", wajib: true },
  { kunci: "amar", judul: "Amar putusan", wajib: true },
  { kunci: "penutup", judul: "Penutup", wajib: true },
];

/** Irah-irah. Ketiadaannya membatalkan putusan, jadi ia tidak diparameterkan. */
export const IRAH_IRAH = "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA";

export type IsianBagian = {
  isi?: string;
  butirDipakai?: string[];
  halangan?: string;
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Merangkai isian menjadi kerangka lengkap.
 *
 * Bagian yang tidak disebut pemanggil TIDAK hilang - ia muncul kosong beserta
 * halangannya. Bagian yang hilang dari naskah tidak terlihat siapa pun;
 * bagian kosong yang bertuliskan sebabnya terlihat pembaca pertama.
 */
export function susunKerangka(isian: Partial<Record<KunciBagian, IsianBagian>> = {}): Kerangka {
  const bagian: Bagian[] = SUSUNAN.map((pola) => {
    const diberi = isian[pola.kunci] ?? {};
    const isi = bersih(diberi.isi);
    return {
      kunci: pola.kunci,
      judul: pola.judul,
      wajib: pola.wajib,
      isi,
      butirDipakai: (diberi.butirDipakai ?? []).map(bersih).filter(Boolean),
      halangan: isi ? "" : bersih(diberi.halangan) || `${pola.judul} belum terisi.`,
    };
  });

  const belumTerisi = bagian.filter((item) => item.wajib && !item.isi).map((item) => item.kunci);
  return { bagian, belumTerisi, siapDitandatangani: belumTerisi.length === 0 };
}

/**
 * Menyusun kepala putusan.
 *
 * Nomor perkara dan pengadilan tidak diberi nilai bawaan. Putusan bernomor
 * "-" yang tercetak rapi akan terlanjur dibagikan sebelum ada yang sadar
 * nomornya tidak pernah terisi.
 */
export function kepalaPutusan(masukan: {
  jenisNaskah?: string;
  nomorPerkara: string;
  pengadilan: string;
}): IsianBagian {
  const jenis = bersih(masukan.jenisNaskah) || "PUTUSAN";
  const nomor = bersih(masukan.nomorPerkara);
  const pengadilan = bersih(masukan.pengadilan);

  if (!nomor) return { halangan: "Nomor perkara belum diketahui." };
  if (!pengadilan) return { halangan: "Nama pengadilan belum diketahui." };

  return {
    isi: [jenis.toUpperCase(), `Nomor ${nomor}`, "", IRAH_IRAH, "", pengadilan].join("\n"),
  };
}

/** Menggabungkan kerangka menjadi satu naskah, dengan judul tiap bagian. */
export function naskahDariKerangka(kerangka: Kerangka): string {
  return kerangka.bagian
    .map((item) => `${item.judul.toUpperCase()}\n\n${item.isi || `[${item.halangan}]`}`)
    .join("\n\n");
}
