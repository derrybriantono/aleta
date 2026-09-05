/**
 * PEMILIHAN BUTIR PERTIMBANGAN (F3) - yang syaratnya terpenuhi, dan hanya itu.
 *
 * ============================================================================
 * SYARAT YANG TIDAK DAPAT DINILAI BUKAN SYARAT YANG TERPENUHI
 * ============================================================================
 *
 * Inilah satu keputusan yang menentukan apakah perakit ini boleh dipakai.
 *
 * Butir pustaka membawa syarat berlakunya: "hanya untuk cerai gugat", "hanya
 * bila tergugat tidak hadir", "hanya bila saksi sekurangnya dua". Saat merakit,
 * syarat itu diadu dengan fakta perkara. Pertanyaannya: apa yang terjadi bila
 * faktanya TIDAK DIKETAHUI?
 *
 * Jawaban yang mudah - anggap terpenuhi - menghasilkan draf yang selalu penuh
 * dan sering keliru. Butir verstek akan masuk ke perkara yang tergugatnya
 * hadir, karena kehadiran tergugat kebetulan belum tercatat. Dan pertimbangan
 * yang keliru dalam naskah yang rapi tidak dibaca sebagai kekeliruan mesin,
 * melainkan sebagai pendirian majelis.
 *
 * Maka: fakta yang tidak diketahui membuat butirnya TIDAK dipilih, dan
 * sebabnya dicatat. Draf menjadi lebih pendek dan daftar "belum dapat dinilai"
 * menjadi lebih panjang - itu memang yang diinginkan. Yang pendek dan jujur
 * dapat dilengkapi; yang panjang dan keliru harus dibongkar.
 *
 * ============================================================================
 * URUTANNYA URUTAN PENALARAN, BUKAN URUTAN POPULARITAS
 * ============================================================================
 *
 * Pertimbangan hukum bergerak dari kewenangan ke syarat formil, baru ke pokok
 * perkara, pembuktian, kesimpulan, dan biaya. Mengurutkan butir menurut
 * seberapa sering ia dipakai menghasilkan naskah yang membahas pembuktian
 * sebelum kewenangan - susunan yang membuat pembacanya berhenti percaya pada
 * seluruh naskah, dan sepantasnya begitu.
 *
 * Hasilnya juga harus AJEG: dua perakitan atas fakta yang sama wajib
 * menghasilkan urutan yang sama, sampai ke butir yang tidak punya isu
 * sekalipun. Draf yang berubah susunannya tiap kali ditekan tidak dapat
 * dibandingkan dengan versi sebelumnya, dan riwayat versi (F6) kehilangan
 * gunanya.
 */

/** Kunci yang mengatur perakitan, bukan syarat yang diadu dengan fakta. */
const KUNCI_PENGATUR = new Set(["urutan", "catatan"]);

/**
 * Urutan penalaran baku. Angkanya renggang supaya isu baru dapat disisipkan
 * tanpa menomori ulang seluruhnya.
 */
const URUTAN_ISU: Record<string, number> = {
  maksud: 10,
  kompetensi: 20,
  formil: 30,
  panggilan: 40,
  verstek: 50,
  mediasi: 60,
  pokok: 70,
  alasan: 80,
  pembuktian: 90,
  saksi: 100,
  kesimpulan: 110,
  biaya: 120,
};

/** Isu yang tidak dikenali diletakkan sesudah semua yang dikenali. */
const URUTAN_TAK_DIKENAL = 900;

export type Fakta = Record<string, unknown>;

export type ButirTerpilih<T> = {
  butir: T;
  urutan: number;
  /** Syarat yang diperiksa dan hasilnya, supaya pilihan ini dapat ditelusuri. */
  alasan: string[];
};

export type ButirDilewati<T> = {
  butir: T;
  /** Sebab ia tidak dipilih - "tidak terpenuhi" atau "belum dapat dinilai". */
  sebab: string;
  /** true bila sebabnya fakta yang belum ada, bukan fakta yang bertentangan. */
  karenaBelumDiketahui: boolean;
};

export type HasilPemilihan<T> = {
  terpilih: Array<ButirTerpilih<T>>;
  dilewati: Array<ButirDilewati<T>>;
  /** Fakta yang dituntut butir tetapi tidak ada - inilah yang perlu dilengkapi. */
  faktaKurang: string[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function samaTeks(a: unknown, b: unknown): boolean {
  return bersih(a).toLowerCase() === bersih(b).toLowerCase();
}

type Nilaian = { terpenuhi: boolean; belumDiketahui: boolean; kalimat: string };

/**
 * Menilai satu syarat terhadap fakta.
 *
 * Kunci berawalan "minimal"/"maksimal" dibandingkan sebagai angka; sisanya
 * dibandingkan menurut jenis nilainya. Kunci yang faktanya tidak ada selalu
 * menghasilkan belumDiketahui, apa pun jenisnya.
 */
function nilaiSyarat(kunci: string, diminta: unknown, fakta: Fakta): Nilaian {
  const minimal = /^minimal[A-Z]/.test(kunci);
  const maksimal = /^maksimal[A-Z]/.test(kunci);
  const namaFakta = minimal || maksimal ? turunkanNamaFakta(kunci) : kunci;

  if (!(namaFakta in fakta) || fakta[namaFakta] === null || fakta[namaFakta] === undefined) {
    return { terpenuhi: false, belumDiketahui: true, kalimat: `${namaFakta} belum diketahui` };
  }

  const ada = fakta[namaFakta];

  if (minimal || maksimal) {
    const batas = Number(diminta);
    const nyata = Number(ada);
    if (!Number.isFinite(batas) || !Number.isFinite(nyata)) {
      return { terpenuhi: false, belumDiketahui: true, kalimat: `${namaFakta} bukan angka` };
    }
    const lolos = minimal ? nyata >= batas : nyata <= batas;
    return {
      terpenuhi: lolos,
      belumDiketahui: false,
      kalimat: `${namaFakta} ${nyata} ${minimal ? "≥" : "≤"} ${batas}${lolos ? "" : " TIDAK"}`,
    };
  }

  if (typeof diminta === "boolean") {
    const nyata = ada === true || ada === "true" || ada === 1 || ada === "1";
    return {
      terpenuhi: nyata === diminta,
      belumDiketahui: false,
      kalimat: `${namaFakta} ${nyata ? "ya" : "tidak"}, diminta ${diminta ? "ya" : "tidak"}`,
    };
  }

  if (Array.isArray(diminta)) {
    const cocok = diminta.some((pilihan) => samaTeks(pilihan, ada));
    return {
      terpenuhi: cocok,
      belumDiketahui: false,
      kalimat: `${namaFakta} "${bersih(ada)}" ${cocok ? "termasuk" : "TIDAK termasuk"} pilihan yang diminta`,
    };
  }

  const cocok = samaTeks(diminta, ada);
  return {
    terpenuhi: cocok,
    belumDiketahui: false,
    kalimat: `${namaFakta} "${bersih(ada)}"${cocok ? "" : ` bukan "${bersih(diminta)}"`}`,
  };
}

/** "minimalSaksi" -> "saksi"; "maksimalUmur" -> "umur". */
function turunkanNamaFakta(kunci: string): string {
  const sisa = kunci.replace(/^(minimal|maksimal)/, "");
  return sisa.charAt(0).toLowerCase() + sisa.slice(1);
}

type PunyaSyarat = {
  id: string;
  isu?: string;
  syarat?: Record<string, unknown>;
  jumlahPemakaian?: number;
};

/**
 * Memilih dan mengurutkan butir.
 *
 * Butir tanpa satu pun syarat DIPILIH - ia berlaku umum, dan itulah bentuk
 * sebagian besar alinea pembuka. Yang tidak boleh adalah butir bersyarat yang
 * syaratnya tidak sempat dinilai.
 */
export function pilihButir<T extends PunyaSyarat>(daftar: T[], fakta: Fakta): HasilPemilihan<T> {
  const terpilih: Array<ButirTerpilih<T>> = [];
  const dilewati: Array<ButirDilewati<T>> = [];
  const kurang = new Set<string>();

  for (const butir of daftar) {
    const syarat = butir.syarat ?? {};
    const alasan: string[] = [];
    let gagal = "";
    let belumDiketahui = false;

    for (const [kunci, diminta] of Object.entries(syarat)) {
      if (KUNCI_PENGATUR.has(kunci)) continue;
      const hasil = nilaiSyarat(kunci, diminta, fakta);
      alasan.push(hasil.kalimat);
      if (hasil.belumDiketahui) {
        belumDiketahui = true;
        kurang.add(hasil.kalimat.replace(/ (belum diketahui|bukan angka)$/, ""));
      }
      if (!hasil.terpenuhi && !gagal) gagal = hasil.kalimat;
    }

    if (gagal) {
      dilewati.push({ butir, sebab: gagal, karenaBelumDiketahui: belumDiketahui });
      continue;
    }
    terpilih.push({ butir, urutan: urutanButir(butir), alasan });
  }

  terpilih.sort(bandingkan);
  return { terpilih, dilewati, faktaKurang: [...kurang].sort() };
}

function urutanButir(butir: PunyaSyarat): number {
  const disebut = Number(butir.syarat?.urutan);
  if (Number.isFinite(disebut)) return disebut;
  const isu = bersih(butir.isu).toLowerCase();
  for (const [nama, angka] of Object.entries(URUTAN_ISU)) {
    if (isu.includes(nama)) return angka;
  }
  return URUTAN_TAK_DIKENAL;
}

/**
 * Urutan penalaran lebih dulu; yang seurutan diurutkan menurut seberapa mapan
 * pemakaiannya; yang masih seri diurutkan menurut id.
 *
 * Pemutus terakhir itu bukan hiasan. Tanpanya, dua butir yang sama mapannya
 * dapat bertukar tempat antar perakitan, dan riwayat versi mencatat perubahan
 * yang tidak pernah diputuskan siapa pun.
 */
function bandingkan<T extends PunyaSyarat>(a: ButirTerpilih<T>, b: ButirTerpilih<T>): number {
  if (a.urutan !== b.urutan) return a.urutan - b.urutan;
  const pakaiA = Number(a.butir.jumlahPemakaian ?? 0);
  const pakaiB = Number(b.butir.jumlahPemakaian ?? 0);
  if (pakaiA !== pakaiB) return pakaiB - pakaiA;
  return bersih(a.butir.id).localeCompare(bersih(b.butir.id));
}
