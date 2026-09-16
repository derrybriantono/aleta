/**
 * ============================================================================
 * ANDAIAN ANTREAN MASSAL - BENTUK RINGKASNYA DI ALAMAT, DAN PEMBACANYA
 * ============================================================================
 *
 * Penetapan massal memeriksa dua puluh perkara lebih dahulu, lalu menuliskannya
 * satu per satu; tiap penulisan mengubah giliran bagi perkara berikutnya.
 * Supaya pratinjaunya bergilir persis seperti penulisannya, usulan perkara
 * ke-n diminta dengan ANDAIAN: perkara 1..n-1 sudah tertulis, beserta siapa
 * yang diusulkan bagi masing-masing.
 *
 * Usulan dibaca lewat GET, jadi andaiannya dibawa di alamat dalam bentuk
 * ringkas - satu perkara per butir, dipisah titik koma:
 *
 *   perkaraId:hakim.hakim.hakim:paniteraId:jurusitaId:tanggalSidang
 *   10119:32.26.31:18:30:2026-09-23;10120:33.28.31:21:30:2026-09-22
 *
 * Ladang yang kosong ditulis kosong. Dua puluh lima butir = sekitar 700
 * karakter, jauh di bawah batas alamat mana pun. Ekstensi menulisnya dengan
 * aturan yang SAMA (serialkanAndaian di konten.js), dan ujinya membandingkan
 * keduanya bolak-balik.
 *
 * Murni: tidak ada jaringan, tidak ada basis data. Yang datang dari peramban
 * disaring di sini, lalu sekali lagi di rute gerbang bot.
 */

export type AndaianPenunjukan = {
  perkaraId: number;
  /** id hakim_pn, ketua di depan; kosong bila belum ada PMH yang diusulkan. */
  hakimId: number[];
  paniteraId: number;
  jurusitaId: number;
  /** YYYY-MM-DD, atau kosong. */
  tanggalSidang: string;
};

/** Sebesar batas penetapan massal di papan (BATAS_PERKARA_MASSAL). */
export const BATAS_ANDAIAN = 25;

const bulat = (x: unknown): number => {
  const n = Number(String(x ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export function bacaAndaianPenunjukan(teks: string | null | undefined): AndaianPenunjukan[] {
  const hasil: AndaianPenunjukan[] = [];
  for (const potongan of String(teks || "").split(";")) {
    if (hasil.length >= BATAS_ANDAIAN) break;
    const bagian = potongan.trim();
    if (!bagian) continue;
    const [perkara = "", hakim = "", panitera = "", jurusita = "", tanggal = ""] = bagian.split(":");
    const hakimId = hakim
      .split(".")
      .map(bulat)
      .filter((x) => x > 0)
      .slice(0, 5);
    const tanggalSidang = /^\d{4}-\d{2}-\d{2}$/.test(tanggal.trim()) ? tanggal.trim() : "";
    const satu: AndaianPenunjukan = {
      perkaraId: bulat(perkara),
      hakimId,
      paniteraId: bulat(panitera),
      jurusitaId: bulat(jurusita),
      tanggalSidang,
    };
    // Butir yang tidak mengandaikan apa pun dibuang - ia hanya menambah
    // panjang tanpa mengubah hitungan.
    if (satu.hakimId.length === 0 && !satu.paniteraId && !satu.jurusitaId && !satu.tanggalSidang) continue;
    hasil.push(satu);
  }
  return hasil;
}

export function tulisAndaianPenunjukan(daftar: readonly AndaianPenunjukan[]): string {
  return daftar
    .slice(0, BATAS_ANDAIAN)
    .map((a) =>
      [
        a.perkaraId > 0 ? String(a.perkaraId) : "",
        (a.hakimId || []).filter((x) => x > 0).join("."),
        a.paniteraId > 0 ? String(a.paniteraId) : "",
        a.jurusitaId > 0 ? String(a.jurusitaId) : "",
        a.tanggalSidang || "",
      ].join(":")
    )
    .join(";");
}
