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
};

/** Penanda tempat tanya-jawab tiap saksi - dari abt_variabel. */
const PENANDA_TANYA_JAWAB: Record<number, string> = { 1: "5058", 2: "5059" };

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
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
 * `sudahAdaLembar` menyebut nomor saksi yang lembarnya sudah diisi di ALETA.
 * Saksi itu dilewati sepenuhnya - lembar ALETA selalu menang, dan menimpanya
 * dengan rekaman lama berarti keterangan yang baru saja diketik panitera
 * lenyap dari naskah tanpa ia mengetahuinya.
 */
export function penandaDariAbt(
  saksi: SaksiAbt[],
  sudahAdaLembar: Set<number>
): Map<string, { nilai: string; asal: string }> {
  const peta = new Map<string, { nilai: string; asal: string }>();

  for (const item of saksi) {
    const penanda = PENANDA_TANYA_JAWAB[item.saksiKe];
    if (!penanda) continue;
    if (sudahAdaLembar.has(item.saksiKe)) continue;

    const terisi = item.tanyaJawab.filter((baris) => baris.jawaban);
    if (terisi.length === 0) continue;

    peta.set(penanda, {
      nilai: abtKeTeks(terisi),
      asal: `APS Badilag - abt_keterangan_saksi, saksi ke-${item.saksiKe}`,
    });
  }

  return peta;
}
