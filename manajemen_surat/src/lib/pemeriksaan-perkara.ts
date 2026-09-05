/**
 * PEMERIKSAAN PERKARA (G1-G4) - yang dapat dikerjakan aturan pasti.
 *
 * ============================================================================
 * ATURANNYA DATA, DAN TIAP ATURAN WAJIB MENUNJUK PASAL
 * ============================================================================
 *
 * Godaan yang wajar di sini adalah menuliskan aturan kompetensi dan syarat
 * formil langsung sebagai kode - daftar jenis perkara di satu berkas, tenggang
 * panggilan sebagai angka di berkas lain. Itu bekerja, dan itulah masalahnya:
 * pengadilan kemudian bergantung pada bunyi hukum yang tidak ada rujukannya,
 * tidak ada tanggal berlakunya, dan tidak dapat diperiksa siapa pun tanpa
 * membaca kode.
 *
 * Maka tiap aturan di sini adalah DATA yang membawa jangkar - alamat pasal di
 * pustaka hukum. Bunyinya dapat dibuka, versinya dapat dilihat, dan perubahan
 * undang-undang tidak menuntut perubahan kode.
 *
 * ============================================================================
 * ATURAN YANG JANGKARNYA BELUM TERBUKTI TIDAK MEMUTUSKAN APA PUN
 * ============================================================================
 *
 * Inilah aturan yang mengikat seluruh berkas ini, dan ia sama dengan J1.
 *
 * Bila jangkar sebuah aturan tidak ditemukan di pustaka hukum, aturan itu
 * TIDAK menyatakan lolos dan TIDAK menyatakan gagal. Ia menghasilkan catatan
 * bahwa dasarnya belum ada. Pemeriksaan yang menyatakan "kompetensi absolut
 * terpenuhi" berdasarkan aturan yang dasarnya tidak pernah dimasukkan siapa
 * pun adalah pernyataan hukum tanpa hukum - dan ia terbaca persis sama
 * meyakinkannya dengan pemeriksaan yang benar.
 *
 * ============================================================================
 * TIDAK ADA YANG DISIMPULKAN DARI KEKOSONGAN
 * ============================================================================
 *
 * Fakta yang belum diketahui tidak pernah dibaca sebagai "tidak" maupun "ya".
 * Perkara yang agama pihaknya belum tercatat tidak lolos kompetensi absolut
 * dan tidak pula gagal - ia bertanda "belum dapat diperiksa", dan itu yang
 * dikerjakan petugas.
 */

import type { TingkatTemuan } from "@/lib/pemeriksaan-bas";

export type KelompokPeriksa = "kompetensi" | "formil" | "petitum" | "risiko";

export type JenisPeriksa =
  /** Fakta harus bernilai sama dengan pembanding. */
  | "nilaiSama"
  /** Fakta harus salah satu dari daftar pembanding. */
  | "nilaiSalahSatu"
  /** Fakta harus ada isinya - apa pun isinya. */
  | "wajibAda"
  /** Fakta angka sekurangnya sebesar pembanding. */
  | "minimal"
  /** Fakta tidak boleh bernilai sama dengan pembanding. */
  | "tidakBoleh";

export type AturanPemeriksaan = {
  kode: string;
  kelompok: KelompokPeriksa;
  /** Yang diperiksa, dalam bahasa petugas. */
  hal: string;
  jenis: JenisPeriksa;
  /** Nama fakta yang diadu. */
  fakta: string;
  pembanding?: unknown;
  /** Tingkat temuan bila aturan ini TIDAK terpenuhi. */
  tingkat: TingkatTemuan;
  tindakan: string;
  /** Alamat pasal di pustaka hukum. WAJIB - tanpanya aturan tidak memutuskan. */
  jangkar: string;
};

export type Fakta = Record<string, unknown>;

export type HasilAturan = {
  kode: string;
  kelompok: KelompokPeriksa;
  hal: string;
  keadaan: "terpenuhi" | "tidakTerpenuhi" | "belumDapatDiperiksa" | "dasarBelumAda";
  keterangan: string;
  tindakan: string;
  jangkar: string;
  tingkat: TingkatTemuan;
};

export type HasilPemeriksaan = {
  hasil: HasilAturan[];
  /** Aturan yang tidak terpenuhi pada tingkat halangan. */
  halangan: HasilAturan[];
  /** Aturan yang faktanya belum ada - inilah yang dilengkapi petugas. */
  belumDapatDiperiksa: HasilAturan[];
  /** Aturan yang jangkarnya tidak ada di pustaka - dasar hukumnya belum dimuat. */
  dasarBelumAda: HasilAturan[];
  /** Nama fakta yang dituntut aturan tetapi tidak ada. */
  faktaKurang: string[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function samaTeks(a: unknown, b: unknown): boolean {
  return bersih(a).toLowerCase() === bersih(b).toLowerCase();
}

function adaNilai(fakta: Fakta, nama: string): boolean {
  if (!(nama in fakta)) return false;
  const nilai = fakta[nama];
  if (nilai === null || nilai === undefined) return false;
  if (typeof nilai === "string") return nilai.trim() !== "";
  return true;
}

type Nilaian = { lolos: boolean; keterangan: string };

function nilaiAturan(aturan: AturanPemeriksaan, fakta: Fakta): Nilaian {
  const nilai = fakta[aturan.fakta];
  const terbaca = bersih(nilai);

  switch (aturan.jenis) {
    case "wajibAda":
      return { lolos: true, keterangan: `${aturan.fakta} terisi: "${terbaca}"` };

    case "nilaiSama": {
      const lolos = samaTeks(nilai, aturan.pembanding);
      return {
        lolos,
        keterangan: lolos
          ? `${aturan.fakta} "${terbaca}" sesuai`
          : `${aturan.fakta} "${terbaca}", seharusnya "${bersih(aturan.pembanding)}"`,
      };
    }

    case "tidakBoleh": {
      const kena = samaTeks(nilai, aturan.pembanding);
      return {
        lolos: !kena,
        keterangan: kena
          ? `${aturan.fakta} bernilai "${terbaca}", yang tidak diperbolehkan`
          : `${aturan.fakta} "${terbaca}" tidak termasuk yang dilarang`,
      };
    }

    case "nilaiSalahSatu": {
      const pilihan = Array.isArray(aturan.pembanding) ? aturan.pembanding : [];
      const lolos = pilihan.some((satu) => samaTeks(satu, nilai));
      return {
        lolos,
        keterangan: lolos
          ? `${aturan.fakta} "${terbaca}" termasuk yang disebut aturan`
          : `${aturan.fakta} "${terbaca}" tidak termasuk: ${pilihan.map(bersih).join(", ")}`,
      };
    }

    case "minimal": {
      const batas = Number(aturan.pembanding);
      const nyata = Number(nilai);
      if (!Number.isFinite(batas) || !Number.isFinite(nyata)) {
        return { lolos: false, keterangan: `${aturan.fakta} bukan angka` };
      }
      return {
        lolos: nyata >= batas,
        keterangan:
          nyata >= batas
            ? `${aturan.fakta} ${nyata}, sekurangnya ${batas}`
            : `${aturan.fakta} ${nyata}, kurang dari ${batas}`,
      };
    }

    default:
      return { lolos: false, keterangan: "Jenis pemeriksaan tidak dikenali." };
  }
}

/**
 * Menjalankan seluruh aturan atas fakta perkara.
 *
 * `jangkarTerbukti` berisi alamat pasal yang benar-benar ditemukan di pustaka
 * hukum. Ia diberikan dari luar supaya berkas ini tetap murni dan dapat diuji
 * tanpa basis data - dan supaya yang memanggil harus SENGAJA menyediakannya.
 * Bawaan yang berisi "anggap saja terbukti" tidak disediakan.
 */
export function periksaPerkara(
  aturan: AturanPemeriksaan[],
  fakta: Fakta,
  jangkarTerbukti: Set<string>
): HasilPemeriksaan {
  const hasil: HasilAturan[] = [];
  const kurang = new Set<string>();

  for (const satu of aturan ?? []) {
    const dasar = {
      kode: satu.kode,
      kelompok: satu.kelompok,
      hal: satu.hal,
      tindakan: satu.tindakan,
      jangkar: satu.jangkar,
      tingkat: satu.tingkat,
    };

    // Dasar hukum diperiksa LEBIH DULU daripada faktanya. Aturan tanpa dasar
    // tidak boleh menyatakan apa pun tentang perkara, termasuk menyatakan
    // faktanya kurang - kekurangan yang dituntut aturan tak berdasar bukan
    // kekurangan.
    if (!satu.jangkar || !jangkarTerbukti.has(satu.jangkar)) {
      hasil.push({
        ...dasar,
        keadaan: "dasarBelumAda",
        keterangan: satu.jangkar
          ? `Dasar hukumnya (${satu.jangkar}) belum ada di pustaka hukum.`
          : "Aturan ini tidak menyebut dasar hukumnya.",
      });
      continue;
    }

    if (!adaNilai(fakta, satu.fakta)) {
      kurang.add(satu.fakta);
      hasil.push({
        ...dasar,
        keadaan: "belumDapatDiperiksa",
        keterangan: `${satu.fakta} belum tercatat.`,
      });
      continue;
    }

    const nilaian = nilaiAturan(satu, fakta);
    hasil.push({
      ...dasar,
      keadaan: nilaian.lolos ? "terpenuhi" : "tidakTerpenuhi",
      keterangan: nilaian.keterangan,
    });
  }

  return {
    hasil,
    halangan: hasil.filter((item) => item.keadaan === "tidakTerpenuhi" && item.tingkat === "halangan"),
    belumDapatDiperiksa: hasil.filter((item) => item.keadaan === "belumDapatDiperiksa"),
    dasarBelumAda: hasil.filter((item) => item.keadaan === "dasarBelumAda"),
    faktaKurang: [...kurang].sort(),
  };
}

/**
 * Perkara boleh diperiksa lebih jauh hanya bila kompetensi terpenuhi.
 *
 * Kompetensi diperiksa lebih dulu karena ia menentukan boleh-tidaknya perkara
 * diperiksa sama sekali. Pengadilan yang menjatuhkan putusan atas perkara yang
 * bukan wewenangnya tidak menghasilkan putusan yang keliru isinya - ia
 * menghasilkan putusan yang batal seluruhnya, betapa pun tepat pertimbangannya.
 */
export function kompetensiTerpenuhi(hasil: HasilPemeriksaan): { boleh: boolean; sebab: string } {
  const kompetensi = hasil.hasil.filter((item) => item.kelompok === "kompetensi");
  if (!kompetensi.length) {
    return { boleh: false, sebab: "Tidak ada satu pun aturan kompetensi yang dijalankan." };
  }

  const gagal = kompetensi.find((item) => item.keadaan === "tidakTerpenuhi");
  if (gagal) return { boleh: false, sebab: gagal.keterangan };

  const tertunda = kompetensi.find(
    (item) => item.keadaan === "belumDapatDiperiksa" || item.keadaan === "dasarBelumAda"
  );
  if (tertunda) return { boleh: false, sebab: tertunda.keterangan };

  return { boleh: true, sebab: "" };
}

const URUTAN_TINGKAT: Record<TingkatTemuan, number> = { halangan: 0, peringatan: 1, catatan: 2 };
const URUTAN_KELOMPOK: Record<KelompokPeriksa, number> = {
  kompetensi: 0,
  formil: 1,
  petitum: 2,
  risiko: 3,
};

/** Kompetensi lebih dulu, lalu formil, dan yang terberat di atas. */
export function urutkanHasil(hasil: HasilAturan[]): HasilAturan[] {
  return [...hasil].sort((a, b) => {
    const kelompok = URUTAN_KELOMPOK[a.kelompok] - URUTAN_KELOMPOK[b.kelompok];
    if (kelompok !== 0) return kelompok;
    const tingkat = URUTAN_TINGKAT[a.tingkat] - URUTAN_TINGKAT[b.tingkat];
    if (tingkat !== 0) return tingkat;
    return a.kode.localeCompare(b.kode);
  });
}
