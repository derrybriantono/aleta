/**
 * PETA DALIL - BUKTI - PETITUM (G3), dan risiko yang lahir darinya (G4).
 *
 * ============================================================================
 * TAUTANNYA DITEGASKAN, BUKAN DITEBAK
 * ============================================================================
 *
 * Tautan antara dalil, bukti, dan petitum adalah penilaian - dan penilaian
 * itulah pekerjaan hakim. Menebaknya dari kemiripan kata akan menghasilkan
 * peta yang tampak lengkap: tiap petitum punya dalil, tiap dalil punya bukti,
 * dan tidak satu pun tautan itu pernah dinyatakan siapa pun.
 *
 * Peta semacam itu lebih berbahaya daripada tidak ada peta. Yang membacanya
 * menyimpulkan pembuktiannya sudah tuntas, padahal yang dilihatnya hanyalah
 * dua kalimat yang kebetulan memakai kata yang sama.
 *
 * Maka tautan yang dihitung hanyalah yang DITEGASKAN. Kemiripan kata tetap
 * dihitung, tetapi keluar sebagai USULAN yang bertanda jelas dan tidak pernah
 * mengurangi daftar kekurangan.
 *
 * ============================================================================
 * YANG DICARI ADALAH LUBANGNYA
 * ============================================================================
 *
 * Peta ini tidak ada untuk memperlihatkan yang sudah tertaut - itu sudah
 * terbaca dari berkasnya. Ia ada untuk memperlihatkan:
 *
 *   - petitum yang tidak punya dalil sama sekali;
 *   - dalil yang tidak punya bukti sama sekali; dan
 *   - petitum yang menyebut orang yang bukan pihak dalam perkara.
 *
 * Ketiganya tidak terlihat saat membaca berkas dari depan ke belakang, karena
 * masing-masing bagian terbaca lengkap pada tempatnya sendiri.
 */

import { namaDisebut } from "@/lib/nama-orang";

export type Dalil = {
  nomor: number;
  teks: string;
  /** Nomor bukti yang ditegaskan mendukung dalil ini. */
  buktiKe?: number[];
};

export type Bukti = {
  nomor: number;
  kode: string;
  teks: string;
  jenis?: "surat" | "saksi" | "pengakuan" | "sumpah" | "lainnya";
};

export type PetitumTertaut = {
  nomor: number;
  teks: string;
  /** Nomor dalil yang ditegaskan mendasari petitum ini. */
  dalilKe?: number[];
};

export type BarisPeta = {
  petitum: PetitumTertaut;
  dalil: Dalil[];
  bukti: Bukti[];
  /** Dalil yang tertaut tetapi tidak punya satu pun bukti. */
  dalilTanpaBukti: Dalil[];
};

export type Usulan = {
  petitumKe: number;
  dalilKe: number;
  /** 0..1 - kemiripan kata. Usulan, bukan tautan. */
  skor: number;
};

export type Risiko = {
  jenis: "petitumTanpaDalil" | "dalilTanpaBukti" | "kurangPihak" | "buktiTakTerpakai" | "daluwarsa";
  keterangan: string;
  tindakan: string;
};

export type HasilPeta = {
  baris: BarisPeta[];
  petitumTanpaDalil: PetitumTertaut[];
  dalilTanpaBukti: Dalil[];
  buktiTakTerpakai: Bukti[];
  /** Usulan tautan dari kemiripan kata - TIDAK mengurangi kekurangan di atas. */
  usulan: Usulan[];
  risiko: Risiko[];
};

const KATA_UMUM = new Set([
  "bahwa", "yang", "dan", "atau", "untuk", "dengan", "dari", "pada", "atas", "oleh",
  "ini", "itu", "adalah", "kepada", "dalam", "para", "serta", "agar", "telah", "akan",
  "tersebut", "sebagai", "secara", "menurut", "guna", "maka", "terhadap", "karena",
  "antara", "sudah", "tidak", "juga", "dapat", "harus", "sejak", "selama",
]);

function kataIsi(teks: string): string[] {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((kata) => kata.length > 3 && !KATA_UMUM.has(kata));
}

function skorKemiripan(a: string, b: string): number {
  const kataA = kataIsi(a);
  if (!kataA.length) return 0;
  const kataB = new Set(kataIsi(b));
  const sama = kataA.filter((kata) => kataB.has(kata));
  return sama.length / kataA.length;
}

/** Usulan di bawah ambang ini tidak ditampilkan sama sekali. */
const AMBANG_USULAN = 0.4;

function nomorUnik(daftar: unknown): number[] {
  return [...new Set((Array.isArray(daftar) ? daftar : []).map(Number).filter(Number.isFinite))];
}


export type MasukanPeta = {
  petitum: PetitumTertaut[];
  dalil: Dalil[];
  bukti: Bukti[];
  /** Nama para pihak sebagaimana tercatat di SIPP. */
  pihak: string[];
};

/**
 * Menyusun peta dan menemukan lubangnya.
 *
 * Petitum subsidair tidak menuntut dalil tersendiri dan tidak dihitung
 * kurang - sama seperti pada pemeriksaan amar. Aturannya sengaja diulang di
 * sini alih-alih diimpor, karena bunyi yang dikenali berbeda: di petitum ia
 * kalimat penutup, di amar ia tidak pernah muncul.
 */
export function susunPeta(masukan: MasukanPeta): HasilPeta {
  const petaDalil = new Map<number, Dalil>();
  for (const item of masukan.dalil ?? []) petaDalil.set(Number(item.nomor), item);

  const petaBukti = new Map<number, Bukti>();
  for (const item of masukan.bukti ?? []) petaBukti.set(Number(item.nomor), item);

  const buktiDipakai = new Set<number>();
  const dalilDipakai = new Set<number>();
  const baris: BarisPeta[] = [];
  const petitumTanpaDalil: PetitumTertaut[] = [];

  const daftarPetitum = [...(masukan.petitum ?? [])].sort((a, b) => a.nomor - b.nomor);

  for (const petitum of daftarPetitum) {
    if (subsidair(petitum.teks)) continue;

    const nomorDalil = nomorUnik(petitum.dalilKe);
    const dalil = nomorDalil.map((nomor) => petaDalil.get(nomor)).filter((item): item is Dalil => Boolean(item));
    for (const item of dalil) dalilDipakai.add(item.nomor);

    const bukti: Bukti[] = [];
    const dalilTanpaBukti: Dalil[] = [];
    for (const satu of dalil) {
      const nomorBukti = nomorUnik(satu.buktiKe);
      const punya = nomorBukti
        .map((nomor) => petaBukti.get(nomor))
        .filter((item): item is Bukti => Boolean(item));
      if (!punya.length) dalilTanpaBukti.push(satu);
      for (const item of punya) {
        buktiDipakai.add(item.nomor);
        if (!bukti.some((sudah) => sudah.nomor === item.nomor)) bukti.push(item);
      }
    }

    baris.push({ petitum, dalil, bukti, dalilTanpaBukti });
    if (!dalil.length) petitumTanpaDalil.push(petitum);
  }

  const dalilTanpaBukti = (masukan.dalil ?? []).filter((item) => !nomorUnik(item.buktiKe).length);
  const buktiTakTerpakai = (masukan.bukti ?? []).filter((item) => !buktiDipakai.has(Number(item.nomor)));

  return {
    baris,
    petitumTanpaDalil,
    dalilTanpaBukti,
    buktiTakTerpakai,
    usulan: usulkanTautan(petitumTanpaDalil, masukan.dalil ?? []),
    risiko: kenaliRisiko({
      petitumTanpaDalil,
      dalilTanpaBukti,
      buktiTakTerpakai,
      petitum: daftarPetitum,
      pihak: masukan.pihak ?? [],
      dalilDipakai,
      semuaDalil: masukan.dalil ?? [],
    }),
  };
}

function subsidair(teks: string): boolean {
  const isi = String(teks ?? "").toLowerCase();
  return /seadil[- ]?adilnya/.test(isi) || /ex\s*aequo\s*et\s*bono/.test(isi) || /\bsubsidair\b/.test(isi);
}

/**
 * Usulan tautan untuk petitum yang belum punya dalil.
 *
 * Hanya untuk yang BELUM tertaut. Mengusulkan tautan bagi petitum yang sudah
 * ditegaskan hakim berarti menawarkan mesin sebagai pembanding penilaian
 * hakim, dan itu bukan tempatnya.
 */
function usulkanTautan(petitumTanpaDalil: PetitumTertaut[], dalil: Dalil[]): Usulan[] {
  const usulan: Usulan[] = [];
  for (const petitum of petitumTanpaDalil) {
    for (const satu of dalil) {
      const skor = skorKemiripan(petitum.teks, satu.teks);
      if (skor >= AMBANG_USULAN) {
        usulan.push({ petitumKe: petitum.nomor, dalilKe: satu.nomor, skor: Number(skor.toFixed(2)) });
      }
    }
  }
  return usulan.sort((a, b) => b.skor - a.skor || a.petitumKe - b.petitumKe || a.dalilKe - b.dalilKe);
}

function kenaliRisiko(bahan: {
  petitumTanpaDalil: PetitumTertaut[];
  dalilTanpaBukti: Dalil[];
  buktiTakTerpakai: Bukti[];
  petitum: PetitumTertaut[];
  pihak: string[];
  dalilDipakai: Set<number>;
  semuaDalil: Dalil[];
}): Risiko[] {
  const risiko: Risiko[] = [];

  for (const item of bahan.petitumTanpaDalil) {
    risiko.push({
      jenis: "petitumTanpaDalil",
      keterangan: `Petitum ${item.nomor} tidak menunjuk satu pun dalil.`,
      tindakan: "Tautkan ke dalil yang mendasarinya, atau nyatakan petitum ini tidak berdasar.",
    });
  }

  for (const item of bahan.dalilTanpaBukti) {
    risiko.push({
      jenis: "dalilTanpaBukti",
      keterangan: `Dalil ${item.nomor} tidak menunjuk satu pun bukti.`,
      tindakan: "Tautkan ke bukti surat atau keterangan saksi, atau tandai sebagai dalil yang diakui.",
    });
  }

  for (const item of bahan.buktiTakTerpakai) {
    risiko.push({
      jenis: "buktiTakTerpakai",
      keterangan: `Bukti ${item.kode || item.nomor} tidak dipakai satu pun dalil.`,
      tindakan: "Periksa apakah bukti ini memang tidak relevan, atau tautannya yang terlewat.",
    });
  }

  // Kurang pihak: petitum menyebut orang yang tidak tercatat sebagai pihak.
  const pihakTercatat = (bahan.pihak ?? []).map((item) => String(item ?? "").toLowerCase().trim()).filter(Boolean);
  for (const petitum of bahan.petitum) {
    for (const nama of namaDisebut(petitum.teks)) {
      const dikenal = pihakTercatat.some(
        (pihak) => pihak.includes(nama.toLowerCase()) || nama.toLowerCase().includes(pihak)
      );
      if (!dikenal) {
        risiko.push({
          jenis: "kurangPihak",
          keterangan: `Petitum ${petitum.nomor} menyebut "${nama}", yang tidak tercatat sebagai pihak.`,
          tindakan: "Pastikan orang ini memang tidak perlu ditarik sebagai pihak.",
        });
      }
    }
  }

  return risiko;
}

/**
 * Daluwarsa - hanya dihitung bila tenggangnya diberikan.
 *
 * Tidak ada tenggang bawaan. Daluwarsa yang dihitung dari angka tebakan akan
 * menyatakan perkara lewat waktu padahal tidak, dan pernyataan itu terbaca
 * seyakin pernyataan yang benar.
 */
export function periksaDaluwarsa(masukan: {
  tanggalPeristiwa: string;
  tanggalDaftar: string;
  tenggangHari: number | null;
  jangkar: string;
}): Risiko | null {
  const tenggang = Number(masukan.tenggangHari);
  if (!masukan.jangkar || !Number.isFinite(tenggang) || tenggang <= 0) return null;

  const peristiwa = String(masukan.tanggalPeristiwa ?? "").slice(0, 10);
  const daftar = String(masukan.tanggalDaftar ?? "").slice(0, 10);
  if (!peristiwa || !daftar) return null;

  const selisih = Math.round(
    (new Date(`${daftar}T00:00:00Z`).getTime() - new Date(`${peristiwa}T00:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  if (!Number.isFinite(selisih) || selisih <= tenggang) return null;

  return {
    jenis: "daluwarsa",
    keterangan: `Perkara didaftarkan ${selisih} hari sesudah peristiwanya, melewati tenggang ${tenggang} hari (${masukan.jangkar}).`,
    tindakan: "Periksa apakah tenggang ini memang berlaku bagi perkara ini sebelum dijadikan pertimbangan.",
  };
}

// Dipakai ulang pemanggil lama; pengenalnya sendiri ada di nama-orang.ts.
export { namaDisebut };
