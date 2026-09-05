/**
 * PERTIMBANGAN SUSUNAN MODEL (I2) DAN USULAN BUTIR PUSTAKA (I4).
 *
 * ============================================================================
 * MODEL DIPANGGIL HANYA BILA PUSTAKA BELUM PUNYA BUTIRNYA
 * ============================================================================
 *
 * Bukan "bila pustaka kurang lengkap" dan bukan "bila hakim ingin pembanding" -
 * hanya bila pustaka menjawab KOSONG. Dua kelonggaran itu terdengar wajar dan
 * keduanya berakhir sama: model dipanggil pada tiap perkara, dan pustaka
 * berhenti tumbuh karena tidak ada lagi yang merasa perlu mengisinya.
 *
 * ============================================================================
 * KUTIPAN MODEL DIPERIKSA DENGAN ALAT YANG SAMA DENGAN KUTIPAN HAKIM
 * ============================================================================
 *
 * Pemecah rujukan yang membaca pasal dari alinea tulisan hakim (D4) dipakai
 * apa adanya untuk membaca pasal dari alinea susunan model. Sengaja alat yang
 * sama: kalau modelnya diberi pemeriksa yang lebih longgar, longgarnya persis
 * berada di tempat yang paling membutuhkan ketat.
 *
 * Pasal karangan adalah kegagalan terparah sistem ini, dan model adalah satu-
 * satunya bagian yang benar-benar dapat mengarang pasal.
 *
 * ============================================================================
 * USULAN MASUK PUSTAKA SEBAGAI USULAN, DAN TIDAK ADA JALAN LAIN
 * ============================================================================
 *
 * Butir susunan model masuk ke tabel yang sama dengan butir tulisan hakim,
 * berkeadaan 'usulan', dan hanya dapat disahkan lewat jalur yang menuntut
 * atas perintah siapa. Tidak ada jalur pintas, dan tidak ada penanda yang
 * membuatnya lolos lebih mudah.
 *
 * Yang dibedakan hanya ASALNYA - dicatat, supaya yang mengesahkan tahu
 * kalimat itu tidak pernah ditulis hakim mana pun.
 */

import { jangkarRujukan, kenaliRujukan } from "@/server/modules/aleta-ecourt/pemecah-pertimbangan";

export type KutipanDiperiksa = {
  tertulis: string;
  jangkar: string;
  terbukti: boolean;
};

export type UsulanButir = {
  teks: string;
  isu: string;
  kutipan: KutipanDiperiksa[];
  /** Kutipan yang jangkarnya tidak ada di pustaka - inilah yang menahan. */
  takTerbukti: KutipanDiperiksa[];
  /** Kutipan yang peraturannya tidak dikenali sama sekali. */
  tanpaJangkar: KutipanDiperiksa[];
  layakDiusulkan: boolean;
  sebab: string;
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Memeriksa alinea susunan model sebelum ia boleh diusulkan.
 *
 * `jangkarTerbukti` diberikan dari luar - berisi alamat pasal yang benar-benar
 * ada di pustaka hukum. Tidak ada bawaan "anggap terbukti": pemeriksa yang
 * dapat dipanggil tanpa daftar itu akan dipanggil tanpa daftar itu.
 */
export function periksaUsulan(
  masukan: { teks: string; isu?: string },
  jangkarTerbukti: Set<string>
): UsulanButir {
  const teks = bersih(masukan.teks);
  const kutipan: KutipanDiperiksa[] = kenaliRujukan(teks).map((rujukan) => {
    const jangkar = jangkarRujukan(rujukan);
    return {
      tertulis: rujukan.tertulis,
      jangkar,
      terbukti: Boolean(jangkar) && jangkarTerbukti.has(jangkar),
    };
  });

  const tanpaJangkar = kutipan.filter((item) => !item.jangkar);
  const takTerbukti = kutipan.filter((item) => item.jangkar && !item.terbukti);

  const sebab = !teks
    ? "Usulan kosong."
    : takTerbukti.length
      ? `${takTerbukti.length} kutipan tidak ditemukan di pustaka hukum.`
      : tanpaJangkar.length
        ? `${tanpaJangkar.length} kutipan menyebut peraturan yang belum dikenali.`
        : "";

  return {
    teks,
    isu: bersih(masukan.isu),
    kutipan,
    takTerbukti,
    tanpaJangkar,
    layakDiusulkan: Boolean(teks) && takTerbukti.length === 0 && tanpaJangkar.length === 0,
    sebab,
  };
}

export type PerintahSusun = {
  jenisPerkara: string;
  isu: string;
  /** Fakta perkara yang sudah lolos saringan batas data. */
  fakta: Record<string, unknown>;
  /** Pasal yang tersedia di pustaka - model hanya boleh mengutip dari sini. */
  pasalTersedia: Array<{ jangkar: string; sebutan: string; isi: string }>;
};

/**
 * Perintah untuk menyusun pertimbangan.
 *
 * Model diberi daftar pasal yang BOLEH dikutip beserta bunyinya. Tanpa daftar
 * itu ia akan mengutip dari ingatannya, dan ingatannya memuat pasal dari
 * peraturan yang sudah dicabut, dari negara lain, dan dari yang tidak pernah
 * ada. Memberi daftarnya tidak menghapus pemeriksaan sesudahnya - ia hanya
 * membuat pemeriksaan itu lebih sering lolos.
 */
export function susunPerintahPertimbangan(masukan: PerintahSusun): string {
  const daftar = masukan.pasalTersedia
    .map((item) => `- ${item.sebutan} [${item.jangkar}]: ${item.isi.slice(0, 400)}`)
    .join("\n");

  return [
    "Anda membantu menyusun SATU alinea pertimbangan hukum putusan pengadilan agama Indonesia.",
    `Jenis perkara: ${masukan.jenisPerkara || "(tidak disebut)"}.`,
    `Isu yang dibahas: ${masukan.isu || "(tidak disebut)"}.`,
    "",
    "Fakta perkara:",
    JSON.stringify(masukan.fakta),
    "",
    daftar
      ? `Pasal yang BOLEH dikutip - hanya dari daftar ini, tidak ada yang lain:\n${daftar}`
      : "TIDAK ada pasal yang tersedia. Susun alinea tanpa mengutip pasal apa pun.",
    "",
    "Aturan:",
    '- Mulai dengan "Menimbang, bahwa".',
    "- Satu alinea saja.",
    "- Jangan mengutip pasal di luar daftar di atas. Bila ragu, jangan mengutip sama sekali.",
    "- Jangan menyebut nama orang, tanggal, atau nomor perkara.",
    '- Jawab dalam JSON: {"teks":"","isu":""}',
  ].join("\n");
}
