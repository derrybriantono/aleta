/**
 * SAKLAR MATI (I6) - per pengadilan, per peran, atau per perkara.
 *
 * ============================================================================
 * MATI SELALU MENANG, DAN ITULAH SELURUH GUNANYA
 * ============================================================================
 *
 * Saklar yang dapat dibatalkan lapisan lain bukan saklar. Bila pengadilan
 * mematikan AI dan setelan peran masih dapat menyalakannya, maka yang
 * dimatikan pengadilan sebenarnya tidak pernah mati - dan yang menekannya
 * mengira sudah.
 *
 * Maka aturannya satu kalimat: SATU "mati" di lapisan mana pun mematikan
 * seluruhnya. Tidak ada lapisan yang dapat menyalakan kembali apa yang
 * dimatikan lapisan lain, termasuk lapisan yang lebih sempit.
 *
 * ============================================================================
 * YANG MEMATIKAN DAN SEBABNYA IKUT TERBACA
 * ============================================================================
 *
 * "AI tidak tersedia" tanpa keterangan akan dibaca sebagai kerusakan, dan yang
 * membacanya akan menelepon pranata komputer untuk memperbaiki sesuatu yang
 * sengaja dimatikan hakim. Maka hasilnya menyebut lingkup mana yang mematikan,
 * siapa yang memutuskannya, dan alasannya.
 *
 * ============================================================================
 * PER PERKARA ADA KARENA SEBAGIAN PERKARA MEMANG BERBEDA
 * ============================================================================
 *
 * Perkara yang para pihaknya dikenal luas, perkara yang sedang disorot, atau
 * perkara yang isinya sangat pribadi - hakim yang menanganinya berhak
 * memutuskan tidak ada apa pun dari berkas itu yang keluar, tanpa harus
 * mematikan AI bagi seluruh pengadilan.
 *
 * Karena itu lingkup perkara TIDAK menuntut kewenangan admin. Menuntutnya
 * berarti hakim harus meminta izin untuk berhati-hati, dan izin yang harus
 * diminta tidak akan diminta pada hari yang sibuk.
 */

export type LingkupSaklar = "pengadilan" | "peran" | "perkara";

export type Saklar = {
  lingkup: LingkupSaklar;
  /** Id peran atau id perkara; kosong untuk lingkup pengadilan. */
  kunci: string;
  menyala: boolean;
  alasan: string;
  diputuskanOleh: string;
};

export type Konteks = {
  peran: string;
  perkaraId: string;
};

export type Keputusan = {
  menyala: boolean;
  /** Lingkup yang mematikan; kosong bila menyala. */
  dimatikanOleh: LingkupSaklar | "";
  /** Kalimat siap tampil, menyebut siapa dan mengapa. */
  sebab: string;
};

const NAMA_LINGKUP: Record<LingkupSaklar, string> = {
  pengadilan: "pengadilan ini",
  peran: "peran Anda",
  perkara: "perkara ini",
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Menghitung keadaan AI untuk satu konteks.
 *
 * Diperiksa dari yang paling luas ke paling sempit, dan BERHENTI pada "mati"
 * pertama. Urutannya bukan sekadar rapi: sebab yang ditampilkan harus yang
 * paling luas, karena itulah yang harus diurus lebih dulu. Memberi tahu hakim
 * bahwa perkaranya dimatikan padahal seluruh pengadilan juga dimatikan akan
 * membuatnya menyalakan perkaranya, gagal, lalu tidak tahu apa lagi.
 */
export function hitungSaklar(
  saklar: Saklar[],
  konteks: Konteks,
  globalMenyala: boolean
): Keputusan {
  if (!globalMenyala) {
    return {
      menyala: false,
      dimatikanOleh: "pengadilan",
      sebab: "AI dimatikan pada setelan global pengadilan.",
    };
  }

  const daftar = saklar ?? [];
  const peran = bersih(konteks.peran).toLowerCase();
  const perkaraId = bersih(konteks.perkaraId);

  const urutan: Array<{ lingkup: LingkupSaklar; cocok: (item: Saklar) => boolean }> = [
    { lingkup: "pengadilan", cocok: (item) => item.lingkup === "pengadilan" },
    {
      lingkup: "peran",
      cocok: (item) => item.lingkup === "peran" && bersih(item.kunci).toLowerCase() === peran && Boolean(peran),
    },
    {
      lingkup: "perkara",
      cocok: (item) => item.lingkup === "perkara" && bersih(item.kunci) === perkaraId && Boolean(perkaraId),
    },
  ];

  for (const { lingkup, cocok } of urutan) {
    const mati = daftar.find((item) => cocok(item) && !item.menyala);
    if (mati) {
      const oleh = bersih(mati.diputuskanOleh);
      const alasan = bersih(mati.alasan);
      return {
        menyala: false,
        dimatikanOleh: lingkup,
        sebab:
          `AI dimatikan untuk ${NAMA_LINGKUP[lingkup]}` +
          (oleh ? ` oleh ${oleh}` : "") +
          (alasan ? `: ${alasan}` : ".") +
          (alasan ? "" : ""),
      };
    }
  }

  return { menyala: true, dimatikanOleh: "", sebab: "" };
}

/**
 * Memeriksa masukan sebelum saklar disimpan.
 *
 * Mematikan WAJIB beralasan; menyalakan tidak. Bukan pilih kasih - saklar yang
 * mati adalah keadaan yang akan ditanyakan orang lain ("mengapa AI tidak
 * jalan?"), dan alasan yang tercatat menjawabnya tanpa perlu mencari siapa
 * yang menekan. Saklar yang menyala adalah keadaan biasa dan tidak
 * menimbulkan pertanyaan.
 */
export function periksaSaklar(masukan: {
  lingkup: string;
  kunci: string;
  menyala: boolean;
  alasan: string;
  oleh: string;
}): { ok: boolean; sebab?: string } {
  const lingkup = bersih(masukan.lingkup) as LingkupSaklar;
  if (!["pengadilan", "peran", "perkara"].includes(lingkup)) {
    return { ok: false, sebab: "Lingkup saklar tidak dikenali." };
  }
  if (lingkup !== "pengadilan" && !bersih(masukan.kunci)) {
    return { ok: false, sebab: `Lingkup "${lingkup}" menuntut kunci - peran atau nomor perkaranya.` };
  }
  if (!bersih(masukan.oleh)) {
    return { ok: false, sebab: "Sebutkan siapa yang memutuskan." };
  }
  if (!masukan.menyala && !bersih(masukan.alasan)) {
    return { ok: false, sebab: "Mematikan AI wajib beralasan." };
  }
  return { ok: true };
}
