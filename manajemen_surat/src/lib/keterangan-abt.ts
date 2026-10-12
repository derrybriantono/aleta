/**
 * KETERANGAN SAKSI YANG SUDAH TEREKAM DI ABT.
 *
 * ============================================================================
 * PERKARA YANG SUDAH DIPERIKSA TIDAK DIMULAI DARI KOSONG
 * ============================================================================
 *
 * abt_keterangan_saksi memuat 65.526 tanya-jawab dari 4.529 saksi - dan itu
 * bukan ringkasan melainkan transkrip pemeriksaan: siapa yang bertanya, saksi
 * ke berapa, urutan, pertanyaannya, jawabannya.
 *
 * Untuk perkara yang pemeriksaannya sudah berlangsung dan sudah tercatat di
 * ABT, keterangan itu SUDAH ADA. Menuntut panitera mengetiknya ulang di ALETA
 * adalah persis pekerjaan yang modul ini dibuat untuk menghapus.
 *
 * ============================================================================
 * DIPAKAI SEBAGAI PASANGAN UTUH, BUKAN DICOCOKKAN PER JAWABAN
 * ============================================================================
 *
 * Yang masuk ke naskah adalah pasangan tanya-jawab ABT APA ADANYA - pertanyaan
 * dan jawabannya bersama-sama.
 *
 * Yang TIDAK dikerjakan: mencocokkan jawaban ABT ke pertanyaan katalog menurut
 * urutan. Urutan di ABT tidak dijamin sama dengan katalog, dan jawaban yang
 * mendarat di bawah pertanyaan yang keliru akan terbaca masuk akal justru saat
 * ia paling salah. Karena keduanya dibawa bersama, tidak ada yang dapat
 * tergeser.
 *
 * ============================================================================
 * LEMBAR ALETA SELALU MENANG
 * ============================================================================
 *
 * Bila panitera sudah mengisi lembar di ALETA untuk saksi itu, lembarnya yang
 * dipakai - bukan rekaman ABT. Yang diketik hari ini adalah yang benar-benar
 * terjadi hari ini; rekaman ABT adalah keadaan sebelum ALETA menyentuhnya.
 */

export type TanyaJawabAbt = {
  urutan: number;
  penanya: string;
  pertanyaan: string;
  jawaban: string;
};

export type SaksiAbt = {
  saksiId: string;
  saksiKe: number;
  sidangId: string;
  tanyaJawab: TanyaJawabAbt[];
  /**
   * Pihak yang mengajukan saksi ('P' Penggugat/Pemohon, 'T' Tergugat/Termohon)
   * dan urutannya DI PIHAK ITU - hanya bila jembatan bot MENYATAKANNYA
   * (perkara_pihak5.saksi_pihak_ke). Tanpa keduanya saksi dibaca seperti
   * dahulu: hanya saksi ke-1 dan ke-2 yang dipetakan, sebagai saksi Penggugat.
   */
  pihak?: PihakSaksi;
  saksiKePihak?: number;
};

// ============================================================================
// PENANDA SAKSI DI BLANGKO - SATU TABEL UNTUK SELURUH PORTAL
// ============================================================================

export type PihakSaksi = "P" | "T";

export type PenandaSaksi = {
  nama: string;
  umur: string;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  alamat: string;
  /** Tempat tanya-jawab. Saksi 3 P punya DUA - keduanya dirujuk blangko. */
  tanyaJawab: string[];
  /** Lafal sumpah yang mengikuti agama saksi. */
  sumpah: string;
};

/**
 * Nomor penanda tiap saksi - dari abt_variabel APS Badilag (baca-saja,
 * 26 September 2026) dan dicocokkan dengan blangko BAS nyata di _blangko_abt.
 *
 * Tanya-jawab ABT tidak dipetakan menurut NAMA variabelnya, melainkan menurut
 * kolom `referensi`-nya: ABT (Iwan.php, data_type 'tanya_jawab') mengambil
 * keterangan saksi yang namanya ditunjuk referensi itu. Maka:
 *   5058 -> 1197 (saksi 1 P)      6120 -> 6100 (saksi 1 T)
 *   5059 -> 1203 (saksi 2 P)      6121 -> 6106 (saksi 2 T)
 *   5060 -> 6132 (saksi 3 P)      6124 -> 6144 (saksi 4 P)
 *   6122 -> 6132 (saksi 3 P)  <- BERNAMA "TanyaJwb Saksi 3 T", tetapi
 *                                referensinya Nama Saksi 3 P, dan blangko
 *                                "(3 Saksi)"/"(4 Saksi)" menaruhnya tepat
 *                                sesudah #6132#-#6137# dan sumpah #7038#.
 * 5060 tidak dipakai satu pun dari 499 blangko BAS yang terbaca; 6122 dipakai
 * 4. Keduanya diisi, karena keduanya sah menurut ABT.
 *
 * Sumpah: 7029/7030 (agama #1199#/#1205#, saksi 1-2 P), 7038/7039 (#6134#/
 * #6146#, saksi 3-4 P), 7031/7032 (#6102#/#6108#, saksi 1-2 T).
 *
 * Saksi 4 P: pekerjaannya #6151#, BUKAN #6147# (#6147# pendidikan) - urutan
 * nomornya tidak berurutan seperti saksi lain.
 *
 * ----------------------------------------------------------------------------
 * 12 Okt 2026 (paket ABT abt-saksi-pertanyaan, variabel 8920-8943): saksi 3 T,
 * 4 T dan 5 P kini punya tempat sendiri.
 *   8921 -> 6138 (saksi 3 T, TanyaJwb; sebelumnya TIDAK ada - 6122 menunjuk
 *                 saksi 3 P)   sumpah 7040 (diperbaiki paket; agama #6140#)
 *   8941 -> 8934 (saksi 4 T)   8931 -> 8924 (saksi 5 P)
 * Hubungan dengan pihak: 8923 (saksi 4 P; 6150 salah), 8922 (saksi 3 T),
 * 8930 (saksi 5 P), 8940 (saksi 4 T). Keterangan (bentuk "- Bahwa ..." untuk
 * putusan): 8920 (saksi 4 P), 8932 (5 P), 8942 (4 T).
 *
 * Yang dilayani: 5 saksi Penggugat dan 4 saksi Tergugat. Saksi P ke-6 dan T ke-5
 * (2 dan 1 perkara dari 8.200) belum punya variabel - satu saksi tambahan = 10
 * variabel dengan pola tabel ini.
 */
export const PENANDA_SAKSI: Record<PihakSaksi, Record<number, PenandaSaksi>> = {
  P: {
    1: { nama: "1197", umur: "1198", agama: "1199", pendidikan: "1200", pekerjaan: "1201", alamat: "1202", tanyaJawab: ["5058"], sumpah: "7029" },
    2: { nama: "1203", umur: "1204", agama: "1205", pendidikan: "1206", pekerjaan: "1207", alamat: "1208", tanyaJawab: ["5059"], sumpah: "7030" },
    3: { nama: "6132", umur: "6133", agama: "6134", pendidikan: "6135", pekerjaan: "6136", alamat: "6137", tanyaJawab: ["5060", "6122"], sumpah: "7038" },
    4: { nama: "6144", umur: "6145", agama: "6146", pendidikan: "6147", pekerjaan: "6151", alamat: "6148", tanyaJawab: ["6124"], sumpah: "7039" },
    5: { nama: "8924", umur: "8925", agama: "8926", pendidikan: "8927", pekerjaan: "8928", alamat: "8929", tanyaJawab: ["8931"], sumpah: "8933" },
  },
  T: {
    1: { nama: "6100", umur: "6101", agama: "6102", pendidikan: "6103", pekerjaan: "6104", alamat: "6105", tanyaJawab: ["6120"], sumpah: "7031" },
    2: { nama: "6106", umur: "6107", agama: "6108", pendidikan: "6109", pekerjaan: "6110", alamat: "6111", tanyaJawab: ["6121"], sumpah: "7032" },
    3: { nama: "6138", umur: "6139", agama: "6140", pendidikan: "6141", pekerjaan: "6142", alamat: "6143", tanyaJawab: ["8921"], sumpah: "7040" },
    4: { nama: "8934", umur: "8935", agama: "8936", pendidikan: "8937", pekerjaan: "8938", alamat: "8939", tanyaJawab: ["8941"], sumpah: "8943" },
  },
};

/** Penanda satu saksi, atau null bila blangko ABT tidak menyediakan tempatnya. */
export function penandaSaksi(pihak: PihakSaksi, ke: number): PenandaSaksi | null {
  return PENANDA_SAKSI[pihak]?.[ke] ?? null;
}

/** "saksi ke-2" atau "saksi Tergugat ke-1" - sebutan di layar dan di asal nilai. */
export function sebutanSaksi(pihak: PihakSaksi, ke: number): string {
  return pihak === "T" ? `saksi Tergugat ke-${ke}` : `saksi ke-${ke}`;
}

/**
 * Pihak yang mengajukan saksi menurut kumpulan pertanyaannya.
 *
 * Katalog ABT (abt_tanyajawab_id) menamai kumpulan saksi Tergugat "Pertanyaan
 * Saksi T CG/CT" dengan kode A2/A2a. Kumpulan lain - termasuk "Jawaban Lisan
 * T" (01) dan "Duplik Lisan T" (03), yang bukan saksi - tetap dibaca pihak
 * Penggugat, sama seperti sebelumnya.
 */
export function pihakKumpulan(kode: unknown, nama?: unknown): PihakSaksi {
  if (/^A2[a-z]?$/i.test(String(kode ?? "").trim())) return "T";
  if (/\bsaksi\s+t\b/i.test(String(nama ?? ""))) return "T";
  return "P";
}

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** Pihak dan urutan di pihak itu - diambil HANYA bila keduanya dinyatakan sah. */
function pihakDinyatakan(item: Record<string, unknown>): { pihak?: PihakSaksi; saksiKePihak?: number } {
  const pihak = teks(item.pihak).toUpperCase();
  const ke = Number(item.saksiKePihak);
  if ((pihak === "P" || pihak === "T") && Number.isInteger(ke) && ke > 0) return { pihak, saksiKePihak: ke };
  return {};
}

/**
 * Kunci satu saksi: "P1", "T2". Dipakai bersama lembar ALETA supaya "lembar
 * sudah ada" dan "rekaman ABT" menunjuk saksi yang sama.
 */
export function kunciSaksi(pihak: PihakSaksi, ke: number): string {
  return `${pihak}${ke}`;
}

/**
 * Letak saksi rekaman ABT di blangko.
 *
 * Tanpa pihak yang dinyatakan jembatan, hanya saksi ke-1 dan ke-2 yang
 * diletakkan - sebagai saksi Penggugat, seperti sebelumnya. Saksi ke-3 dan
 * ke-4 SENGAJA tidak: di data Donggala (26 September 2026) saksi urutan ketiga
 * rekaman ABT 78 kali saksi Penggugat dan 37 kali saksi Tergugat, urutan
 * keempat 30 lawan 32. Menebak pihaknya dari urutan berarti keterangan saksi
 * Tergugat tercetak di tempat saksi Penggugat pada sepertiga perkara.
 */
export function letakSaksiAbt(item: SaksiAbt): { pihak: PihakSaksi; ke: number } | null {
  if (item.pihak && item.saksiKePihak) return { pihak: item.pihak, ke: item.saksiKePihak };
  return item.saksiKe === 1 || item.saksiKe === 2 ? { pihak: "P", ke: item.saksiKe } : null;
}

/**
 * Membaca bagian pemeriksaan saksi menjadi daftar saksi yang terbaca.
 *
 * Nomor urut diambil dari yang DINYATAKAN bot (saksiKe); bila tidak ada -
 * jembatan versi lama - barulah posisi larik dipakai, dan itu disebut tegas di
 * sini supaya tidak terbaca sebagai perilaku yang disengaja.
 */
export function bacaSaksiAbt(pemeriksaan: unknown): SaksiAbt[] {
  const isi = (pemeriksaan ?? {}) as { saksi?: unknown };
  const daftar = Array.isArray(isi.saksi) ? (isi.saksi as Array<Record<string, unknown>>) : [];

  return daftar.map((item, posisi) => ({
    saksiId: teks(item.saksiId),
    saksiKe: Number(item.saksiKe) || posisi + 1,
    ...pihakDinyatakan(item),
    sidangId: teks(item.sidangId),
    tanyaJawab: (Array.isArray(item.tanyaJawab) ? (item.tanyaJawab as Array<Record<string, unknown>>) : [])
      .map((baris) => ({
        urutan: Number(baris.urutan) || 0,
        penanya: teks(baris.penanya),
        pertanyaan: teks(baris.pertanyaan),
        jawaban: teks(baris.jawaban),
      }))
      .filter((baris) => baris.pertanyaan || baris.jawaban)
      .sort((a, b) => a.urutan - b.urutan),
  }));
}

/** Bentuk tanya-jawab untuk naskah - sama dengan yang dipakai lembar ALETA. */
export function abtKeTeks(tanyaJawab: TanyaJawabAbt[]): string {
  return tanyaJawab.map((item) => `- Tanya : ${item.pertanyaan}\n- Jawab : ${item.jawaban}`).join("\n");
}

/**
 * Penanda tanya-jawab dari rekaman ABT, untuk saksi yang BELUM punya lembar.
 *
 * `sudahAdaLembar` menyebut saksi yang lembarnya sudah diisi di ALETA - kunci
 * "P1"/"T2" (kunciSaksi), atau nomor saja untuk saksi pihak Penggugat (bentuk
 * lama). Saksi itu dilewati sepenuhnya - lembar ALETA selalu menang, dan
 * menimpanya dengan rekaman lama berarti keterangan yang baru saja diketik
 * panitera lenyap dari naskah tanpa ia mengetahuinya.
 */
export function penandaDariAbt(
  saksi: SaksiAbt[],
  sudahAdaLembar: Set<number | string>
): Map<string, { nilai: string; asal: string }> {
  const peta = new Map<string, { nilai: string; asal: string }>();

  for (const item of saksi) {
    const letak = letakSaksiAbt(item);
    const penanda = letak ? penandaSaksi(letak.pihak, letak.ke) : null;
    if (!letak || !penanda) continue;
    if (sudahAdaLembar.has(kunciSaksi(letak.pihak, letak.ke))) continue;
    if (letak.pihak === "P" && sudahAdaLembar.has(letak.ke)) continue;

    const terisi = item.tanyaJawab.filter((baris) => baris.jawaban);
    if (terisi.length === 0) continue;

    for (const noVar of penanda.tanyaJawab) {
      peta.set(noVar, {
        nilai: abtKeTeks(terisi),
        asal: `APS Badilag - abt_keterangan_saksi, ${sebutanSaksi(letak.pihak, letak.ke)}`,
      });
    }
  }

  return peta;
}
