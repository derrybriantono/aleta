import type { DimensiBlangko } from "@/lib/taksonomi-blangko";

/**
 * Pustaka blangko ALETA (Tahap 5 - Kemandirian Blangko).
 *
 * ============================================================================
 * BLANGKO ALETA BUKAN BERKAS
 * ============================================================================
 *
 * Pustaka ABT berlubang karena ia matriks yang diisi berkas satu per satu:
 * 110 berkas BAS hanya menempati 58 sel dari kombinasi yang jauh lebih banyak,
 * dan tiap dimensi baru melipatgandakan jumlahnya. Menambah berkas tidak akan
 * pernah menutupnya.
 *
 * Blangko ALETA karena itu tersusun dari tiga hal:
 *
 *   kerangka  - urutan bagian dokumen, satu untuk satu jenis
 *   bagian    - tiap bagian menunjuk blok kalimat dari korpus
 *   syarat    - keadaan perkara yang membuat bagian itu terpakai
 *
 * Dari ketiganya, kombinasi yang ABT tidak punya berkasnya pun menghasilkan
 * dokumen yang benar - dan itulah yang tidak mungkin dicapai dengan menyalin.
 *
 * ============================================================================
 * SYARAT YANG TIDAK DIKETAHUI MENGELUARKAN BAGIANNYA
 * ============================================================================
 *
 * Aturan yang sama dengan pemilih butir putusan (Kelompok F): keadaan yang
 * belum diketahui TIDAK dianggap terpenuhi. Bagian "Ketua Majelis berusaha
 * mendamaikan" hanya terpakai bila penggugat sungguh tercatat hadir - bukan
 * bila kehadirannya belum diisi. Menganggap yang tidak diketahui sebagai
 * "ya" akan menuliskan peristiwa persidangan yang tidak pernah terjadi.
 */

/** Syarat sebuah bagian: dimensi mana harus bernilai apa. */
export type SyaratBagian = Partial<Record<keyof DimensiBlangko, string | string[] | boolean | number>>;

export type BagianBlangko = {
  id: string;
  urutan: number;
  /** Sidik blok kalimat dari korpus. */
  blokSidik: string;
  /** Teks bloknya - disalin saat blangko disusun supaya naskah tidak berubah
   *  sendiri ketika bloknya disunting kemudian. */
  teks: string;
  syarat: SyaratBagian;
  rata?: "kiri" | "tengah" | "kanan" | "justify";
  tebal?: boolean;
  nomor?: number;
  jorok?: number;
  /** Bagian yang selalu ikut, apa pun keadaannya. */
  selalu?: boolean;
};

export type HasilPilih = {
  terpakai: BagianBlangko[];
  /** Bagian yang dikeluarkan beserta sebabnya - supaya dapat diperiksa. */
  dikeluarkan: Array<{ id: string; sebab: string }>;
};

function cocokSatu(nilaiKeadaan: unknown, diminta: string | string[] | boolean | number): boolean {
  if (Array.isArray(diminta)) {
    return diminta.some((d) => cocokSatu(nilaiKeadaan, d));
  }
  if (typeof diminta === "boolean") return Boolean(nilaiKeadaan) === diminta;
  if (typeof diminta === "number") return Number(nilaiKeadaan) === diminta;

  const nilai = nilaiKeadaan;
  if (Array.isArray(nilai)) return nilai.map(String).includes(String(diminta));
  return String(nilai ?? "") === String(diminta);
}

/**
 * Memilih bagian yang terpakai untuk sebuah keadaan perkara.
 *
 * Keadaan yang KOSONG pada dimensi yang disyaratkan mengeluarkan bagiannya -
 * bukan meloloskannya. Itulah bedanya "belum diketahui" dari "tidak".
 */
export function pilihBagian(bagian: BagianBlangko[], keadaan: Partial<DimensiBlangko>): HasilPilih {
  const terpakai: BagianBlangko[] = [];
  const dikeluarkan: Array<{ id: string; sebab: string }> = [];

  for (const b of [...bagian].sort((x, y) => x.urutan - y.urutan)) {
    if (b.selalu || Object.keys(b.syarat ?? {}).length === 0) {
      terpakai.push(b);
      continue;
    }

    let lolos = true;
    for (const [ruas, diminta] of Object.entries(b.syarat)) {
      const nilai = (keadaan as Record<string, unknown>)[ruas];

      // Dimensi yang belum diisi TIDAK dianggap terpenuhi. Menuliskan
      // "Ketua Majelis berusaha mendamaikan" pada perkara yang kehadirannya
      // belum tercatat berarti menuliskan peristiwa yang tidak pernah terjadi.
      const kosong =
        nilai === undefined || nilai === null || nilai === "" || (Array.isArray(nilai) && nilai.length === 0);
      if (kosong && typeof diminta !== "boolean") {
        lolos = false;
        dikeluarkan.push({ id: b.id, sebab: `keadaan "${ruas}" belum diketahui` });
        break;
      }

      if (!cocokSatu(nilai, diminta as string | string[] | boolean | number)) {
        lolos = false;
        dikeluarkan.push({
          id: b.id,
          sebab: `keadaan "${ruas}" bernilai "${String(nilai ?? "")}", bukan "${
            Array.isArray(diminta) ? diminta.join(" atau ") : String(diminta)
          }"`,
        });
        break;
      }
    }

    if (lolos) terpakai.push(b);
  }

  return { terpakai, dikeluarkan };
}

/** Naskah yang tersusun dari bagian terpilih. */
export function naskahDariBagian(terpakai: BagianBlangko[]): Array<{
  teks: string;
  rata?: "kiri" | "tengah" | "kanan" | "justify";
  tebal?: boolean;
  nomor?: number;
  jorok?: number;
}> {
  // Penomoran dihitung ULANG di sini, bukan diambil dari bagiannya.
  //
  // Nomor yang tersimpan pada bagian akan berlubang begitu satu bagian
  // dikeluarkan syarat - naskah berbunyi "1., 3., 4." dan yang membacanya
  // menyangka ada butir yang hilang. Yang tersimpan hanyalah PENANDA bahwa
  // bagian ini bernomor; nomornya sendiri lahir dari yang benar-benar terpakai.
  let hitung = 0;
  return terpakai.map((b) => {
    const bernomor = typeof b.nomor === "number" && b.nomor > 0;
    if (bernomor) hitung += 1;
    else hitung = 0;
    return {
      teks: b.teks,
      rata: b.rata,
      tebal: b.tebal,
      nomor: bernomor ? hitung : undefined,
      jorok: b.jorok,
    };
  });
}

/** Berapa sel matriks yang dapat dilayani sebuah kerangka. */
export function selTerlayani(bagian: BagianBlangko[]): { ruas: string[]; nilai: Record<string, string[]> } {
  const nilai: Record<string, Set<string>> = {};
  for (const b of bagian) {
    for (const [ruas, diminta] of Object.entries(b.syarat ?? {})) {
      const kumpul = nilai[ruas] ?? new Set<string>();
      for (const d of Array.isArray(diminta) ? diminta : [diminta]) kumpul.add(String(d));
      nilai[ruas] = kumpul;
    }
  }
  return {
    ruas: Object.keys(nilai).sort(),
    nilai: Object.fromEntries(Object.entries(nilai).map(([k, v]) => [k, [...v].sort()])),
  };
}
