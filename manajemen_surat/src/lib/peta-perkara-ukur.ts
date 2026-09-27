/**
 * ============================================================================
 * PETA PERKARA - UKURAN BULATAN, GOLONGAN, DAN WILAYAH KECAMATAN
 * ============================================================================
 *
 * Seluruh hitungan murni yang dipakai `peta-titik-perkara.tsx`, dipisah supaya
 * dapat diuji tanpa peramban dan tanpa Leaflet. Komponen petanya hanya
 * menggambar hasilnya.
 */

/* ==========================================================================
 * 1. KELAS DAN GOLONGAN JENIS PERKARA
 * ==========================================================================
 *
 * Kelas dikirim bot per desa, dan penggolongannya dikerjakan DI BOT lewat
 * jenis_perkara_id (petaPerkaraService.KELAS_JENIS) - bukan lewat nama jenis,
 * sebab SIPP menulis "Istbat Nikah" dan "Pengesahan Perkawinan/Istbat Nikah"
 * untuk satu jenis yang sama. Di sini hanya NAMA kelasnya yang dikenal; daftar
 * nomornya satu tempat saja, di bot. Kesamaan kedua daftar nama kelas dijaga
 * uji peta-perkara-bulatan.test.ts.
 */
export const KELAS_PETA = ["ceraiGugat", "ceraiTalak", "dispensasi", "itsbat", "lainnya"] as const;
export type KelasPeta = (typeof KELAS_PETA)[number];

export type HitungKelas = {
  perkara: number;
  lelaki: number;
  perempuan: number;
  /** Rincian nama jenis - hanya dibawa kelas "lainnya". */
  jenis?: Record<string, number>;
};

export const LABEL_KELAS: Record<KelasPeta, string> = {
  ceraiGugat: "Cerai gugat",
  ceraiTalak: "Cerai talak",
  dispensasi: "Dispensasi kawin",
  itsbat: "Itsbat nikah",
  lainnya: "Lainnya",
};

/**
 * Warna tiap kelas.
 *
 * Cerai gugat MERAH dan cerai talak BIRU adalah keputusan satker (penanda
 * KELOMPOK di bot) dan nilainya sama dengan red-500/blue-500 lencana daftar,
 * supaya bulatan dan lencana terbaca sebagai satu penanda. Tiga lainnya
 * sengaja berjauhan ronanya dari keduanya: jingga, hijau, ungu.
 */
export const WARNA_KELAS: Record<KelasPeta, string> = {
  ceraiGugat: "#ef4444",
  ceraiTalak: "#3b82f6",
  dispensasi: "#f59e0b",
  itsbat: "#10b981",
  lainnya: "#a855f7",
};

export const GOLONGAN_PETA = [
  { kunci: "semua", label: "Semua perkara", keterangan: "seluruh perkara yang diputus pada rentang ini", kelas: KELAS_PETA },
  { kunci: "cerai", label: "Cerai", keterangan: "cerai talak + cerai gugat", kelas: ["ceraiGugat", "ceraiTalak"] },
  { kunci: "dispensasi", label: "Dispensasi kawin", keterangan: "dispensasi kawin", kelas: ["dispensasi"] },
  { kunci: "itsbat", label: "Itsbat nikah", keterangan: "pengesahan perkawinan / itsbat nikah", kelas: ["itsbat"] },
  {
    kunci: "lainnya",
    label: "Lainnya",
    keterangan: "selain cerai, dispensasi kawin, dan itsbat nikah",
    kelas: ["lainnya"],
  },
] as const satisfies ReadonlyArray<{
  kunci: string;
  label: string;
  keterangan: string;
  kelas: ReadonlyArray<KelasPeta>;
}>;

export type GolonganPeta = (typeof GOLONGAN_PETA)[number]["kunci"];

export function adalahGolongan(x: unknown): x is GolonganPeta {
  return typeof x === "string" && GOLONGAN_PETA.some((g) => g.kunci === x);
}

export function kelasGolongan(golongan: GolonganPeta): ReadonlyArray<KelasPeta> {
  return GOLONGAN_PETA.find((g) => g.kunci === golongan)?.kelas ?? KELAS_PETA;
}

export function labelGolongan(golongan: GolonganPeta): string {
  return GOLONGAN_PETA.find((g) => g.kunci === golongan)?.label ?? golongan;
}

/** Sumber hitungan satu tempat - bentuk TitikPerkara dari bot. */
export type SumberHitung = {
  perkara: number;
  lelaki: number;
  perempuan: number;
  jenis?: Record<string, number>;
  /** Kelamin pihak per NAMA jenis - untuk bulatan jenis tunggal (bot 2.40.0 ke atas). */
  jenisKelamin?: Record<string, { lelaki: number; perempuan: number }>;
  kelas?: Partial<Record<KelasPeta, HitungKelas>>;
};

/* --------------------------------------------------------------------------
 * PILIHAN BULATAN: SATU GOLONGAN, ATAU JENIS TUNGGAL HALAMAN
 * --------------------------------------------------------------------------
 *
 * Telaah 2.40.0: memilih satu jenis di "Jenis perkara" - Kewarisan, Harta
 * Bersama - dahulu membuat bulatan menghitung SELURUH golongannya ("lainnya"),
 * sedangkan tabel di bawah peta hanya jenis itu. Sebelum 2.40.0 peta
 * menampilkan tepat jenis itu. Pilihan "jenis" mengembalikannya: bulatan
 * dihitung dari rincian NAMA jenis tiap desa, dengan perbandingan yang sama
 * dengan saringan tabelnya (cocokKelompok di bot) - sehingga angka peta,
 * daftar desa yang diketuk, dan tabel sama.
 *
 * Itsbat pun perlu: "Pengesahan Perkawinan/Istbat Nikah" (3.956) BUKAN
 * golongan itsbat (4.045 - kedua ejaan id 360).
 */
export const PILIHAN_JENIS = "jenis" as const;
export type PilihanBulatan = GolonganPeta | typeof PILIHAN_JENIS;

export function adalahPilihan(x: unknown): x is PilihanBulatan {
  return x === PILIHAN_JENIS || adalahGolongan(x);
}

/**
 * Kolasi MySQL untuk nama jenis: besar-kecil huruf tidak dibedakan, spasi di
 * EKOR diabaikan. Sama dengan samakanTeksJenis/cocokKelompok di bot - tabel
 * disaring dengan aturan itu, jadi bulatan pun harus.
 */
export function samakanTeksJenis(x: unknown): string {
  return String(x ?? "").replace(/\s+$/, "").toLowerCase();
}

/** Hitungan satu tempat untuk SATU NAMA jenis. */
export function hitungJenis(sumber: SumberHitung, jenis: string, kelas: KelasPeta): HitungGolongan {
  const kunci = samakanTeksJenis(jenis);
  let perkara = 0;
  let lelaki = 0;
  let perempuan = 0;
  let adaKelamin = false;
  for (const [teks, n] of Object.entries(sumber.jenis ?? {})) {
    if (samakanTeksJenis(teks) !== kunci || !(n > 0)) continue;
    perkara += n;
    const k = sumber.jenisKelamin?.[teks];
    if (k) {
      adaKelamin = true;
      lelaki += k.lelaki || 0;
      perempuan += k.perempuan || 0;
    }
  }
  // Bot tua tanpa jenisKelamin: kelamin desanya hanya dapat dipakai bila
  // seluruh perkara desa itu memang jenis ini.
  if (!adaKelamin && !sumber.jenisKelamin && perkara > 0 && perkara === sumber.perkara) {
    lelaki = sumber.lelaki;
    perempuan = sumber.perempuan;
  }
  return {
    perkara,
    lelaki,
    perempuan,
    kelas: perkara > 0 ? { [kelas]: perkara } : {},
    rincian: perkara > 0 ? { [jenis]: perkara } : {},
  };
}

/** Hitungan satu tempat untuk pilihan bulatan apa pun. */
export function hitungPilihan(
  sumber: SumberHitung,
  pilihan: PilihanBulatan,
  jenisTerpilih: string,
  kelasJenis: KelasPeta
): HitungGolongan {
  if (pilihan === PILIHAN_JENIS) {
    return jenisTerpilih ? hitungJenis(sumber, jenisTerpilih, kelasJenis) : hitungGolongan(sumber, "semua");
  }
  return hitungGolongan(sumber, pilihan);
}

/**
 * Pilihan bulatan ketika peta lahir.
 *
 * Yang DIINGAT menang - kecuali "jenis" ketika halaman sedang tidak memilih
 * jenis tunggal (kelompok halaman tidak diingat; dimuat ulang, ia kembali
 * Perceraian). Belum ada yang diingat - kunjungan pertama - pilihan
 * diturunkan dari "Jenis perkara" halaman: Perceraian -> cerai, jenis tunggal
 * -> jenis itu. Telaah 2.40.0: sebelumnya "Semua perkara", sehingga menu
 * berbunyi Perceraian sementara bulatan menghitung seluruh perkara.
 */
export function pilihanAwal(ingat: string | null, jenisTerpilih: string): PilihanBulatan {
  if (adalahGolongan(ingat)) return ingat;
  return jenisTerpilih ? PILIHAN_JENIS : "cerai";
}

/** Pilihan yang ditulis halaman ke ingatan ketika "Jenis perkara" diganti. */
export function pilihanUntukKelompok(jenisTunggal: boolean, golonganMenu?: string): PilihanBulatan {
  if (jenisTunggal) return PILIHAN_JENIS;
  return adalahGolongan(golonganMenu) ? golonganMenu : "cerai";
}

/** Kelas warna untuk jenis tunggal, dari golongan menu jenis itu (dihitung bot lewat id). */
export function kelasUntukGolongan(golongan?: string): KelasPeta {
  if (golongan === "cerai") return "ceraiGugat";
  if (golongan === "dispensasi" || golongan === "itsbat") return golongan;
  return "lainnya";
}

export type HitungGolongan = {
  perkara: number;
  lelaki: number;
  perempuan: number;
  /** Jumlah per kelas di dalam golongan ini - penentu warna. */
  kelas: Partial<Record<KelasPeta, number>>;
  /** Rincian nama jenis untuk keterangan melayang. */
  rincian: Record<string, number>;
};

/**
 * Hitungan satu tempat untuk satu golongan.
 *
 * Tempat yang tidak membawa `kelas` - bot yang lebih tua - hanya dapat
 * menjawab "semua", dan jawabannya hitungan polosnya. Golongan lain menjawab
 * nol, bukan menebak dari nama jenis.
 */
export function hitungGolongan(sumber: SumberHitung, golongan: GolonganPeta): HitungGolongan {
  if (!sumber.kelas) {
    if (golongan !== "semua") return { perkara: 0, lelaki: 0, perempuan: 0, kelas: {}, rincian: {} };
    return {
      perkara: sumber.perkara,
      lelaki: sumber.lelaki,
      perempuan: sumber.perempuan,
      kelas: {},
      rincian: { ...(sumber.jenis ?? {}) },
    };
  }
  const hasil: HitungGolongan = { perkara: 0, lelaki: 0, perempuan: 0, kelas: {}, rincian: {} };
  const kelasSumber: Partial<Record<KelasPeta, HitungKelas>> = sumber.kelas;
  for (const k of kelasGolongan(golongan)) {
    const h: HitungKelas | undefined = kelasSumber[k];
    if (!h || !(h.perkara > 0)) continue;
    hasil.perkara += h.perkara;
    hasil.lelaki += h.lelaki || 0;
    hasil.perempuan += h.perempuan || 0;
    hasil.kelas[k] = h.perkara;
    const rincianJenis: Record<string, number> | undefined = h.jenis;
    if (k === "lainnya" && rincianJenis) {
      for (const [j, n] of Object.entries(rincianJenis)) {
        const nama = j || "(tanpa nama)";
        hasil.rincian[nama] = (hasil.rincian[nama] || 0) + n;
      }
    } else {
      hasil.rincian[LABEL_KELAS[k]] = h.perkara;
    }
  }
  return hasil;
}

/** Menjumlahkan hitungan per kelas - dipakai tingkat kecamatan. */
export function tambahKelas(
  ke: Partial<Record<KelasPeta, number>>,
  dari: Partial<Record<KelasPeta, number>>
): Partial<Record<KelasPeta, number>> {
  for (const k of KELAS_PETA) {
    const n = dari[k];
    if (n && n > 0) ke[k] = (ke[k] ?? 0) + n;
  }
  return ke;
}

/** Kelas yang menanggung perkara terbanyak - penentu warna bulatan. Seri: urutan KELAS_PETA. */
export function kelasDominan(kelas: Partial<Record<KelasPeta, number>>): KelasPeta | null {
  let juara: KelasPeta | null = null;
  let tertinggi = 0;
  for (const k of KELAS_PETA) {
    const n = kelas[k] ?? 0;
    if (n > tertinggi) {
      tertinggi = n;
      juara = k;
    }
  }
  return juara;
}

/* ==========================================================================
 * 2. UKURAN BULATAN - LUAS SEBANDING JUMLAH, SKALA DARI DATANYA
 * ==========================================================================
 *
 * Mata membaca LUAS, jadi jari-jari sebanding AKAR jumlah:
 *
 *     r(n) = rAcuan x akar(n / nAcuan),   dijepit ke [rMin, rMaks]
 *
 * Rumus lama (3 + 15 x akar(n / terbesar)) punya dua cacat, keduanya terukur
 * pada sipp_donggala 27 Sep 2026:
 *
 *   1. DIUKUR DARI YANG TERBESAR. Satu desa besar menentukan skala semuanya.
 *      Seluruh basis data: median desa 8 perkara, P95 30, terbesar 127 - desa
 *      median mendapat 3 + 15 x akar(8/127) = 6,8 px lawan 18 px desa
 *      terbesar. Hampir seluruh peta menjadi titik seukuran sama.
 *   2. TAMBAHAN 3 px merusak kesebandingan luas: desa berperkara 1 dan desa
 *      berperkara 4 tampak jauh lebih mirip daripada seharusnya.
 *
 * Yang dipakai sekarang P95 SEBAGAI ACUAN - kuantil ke-95 jumlah per tempat
 * pada tingkat yang sedang tampil. Terukur (desa bertitik, semua perkara):
 *
 *     rentang        P50   P95   terbesar   terbesar/P95
 *     tahun 2026      2     8       23          2,9
 *     tahun 2025      2,5  13       36          2,8
 *     seluruhnya      8    30      127          4,3
 *     kecamatan*     17   167      467          2,8     (* seluruhnya)
 *
 * P95 dipetakan ke 20 px, dan batas atasnya 36 px - luas (36/20)^2 = 3,2 kali
 * acuan. Terbesar/P95 pada data sungguhan 2,8-4,3, jadi hampir seluruh desa
 * tetap sebanding. Terukur: tahun 2026 nol desa dijepit dari 161, tahun 2025
 * nol dari 204, seluruhnya SATU dari 245 (127 perkara; ambangnya 97) - dan
 * keterangan ukurannya berkata "≥" untuk itu. Batas bawah 4 px supaya desa
 * satu perkara tetap dapat diketuk.
 *
 * nAcuan paling sedikit 4: rentang sebulan yang tiap desanya 1-2 perkara
 * tidak boleh membuat satu perkara tergambar sebesar acuan.
 *
 * SKALA DIHITUNG DARI "SEMUA PERKARA", LALU DIPAKAI SEMUA GOLONGAN. Berpindah
 * dari "Semua" ke "Dispensasi kawin" membuat bulatannya MENGECIL - memang
 * begitu seharusnya: dispensasi tahun 2026 paling banyak 2 per desa. Skala
 * per golongan akan menggambar desa berdispensasi 2 sebesar desa bercerai 20.
 */
export const ATURAN_BULATAN = {
  rMin: 4,
  rAcuan: 20,
  rMaks: 36,
  kuantil: 0.95,
  nAcuanMin: 4,
} as const;

export type SkalaBulatan = {
  nAcuan: number;
  rMin: number;
  rAcuan: number;
  rMaks: number;
  /** Jumlah tempat bulatan mencapai rMaks - yang lebih besar dijepit. */
  nJenuh: number;
};

/** Kuantil berinterpolasi linear atas nilai positif. */
export function kuantil(nilai: number[], q: number): number {
  const urut = nilai.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (urut.length === 0) return 0;
  const i = (urut.length - 1) * Math.min(1, Math.max(0, q));
  const bawah = Math.floor(i);
  const atas = Math.ceil(i);
  return urut[bawah] + (urut[atas] - urut[bawah]) * (i - bawah);
}

export function skalaBulatan(nilaiAcuan: number[], aturan = ATURAN_BULATAN): SkalaBulatan {
  const nAcuan = Math.max(aturan.nAcuanMin, kuantil(nilaiAcuan, aturan.kuantil));
  return {
    nAcuan,
    rMin: aturan.rMin,
    rAcuan: aturan.rAcuan,
    rMaks: aturan.rMaks,
    nJenuh: nAcuan * (aturan.rMaks / aturan.rAcuan) ** 2,
  };
}

/** Jari-jari satu bulatan dalam piksel; 0 untuk tempat tanpa perkara (tidak digambar). */
export function jariJariBulatan(n: number, skala: SkalaBulatan): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const r = skala.rAcuan * Math.sqrt(n / skala.nAcuan);
  return Math.min(skala.rMaks, Math.max(skala.rMin, r));
}

/** Bilangan rapi 1-2-5 terbesar yang tidak melebihi x (paling sedikit 1). */
export function rapiKeBawah(x: number): number {
  if (!(x >= 1)) return 1;
  const pangkat = 10 ** Math.floor(Math.log10(x));
  for (const m of [5, 2, 1]) {
    if (m * pangkat <= x) return m * pangkat;
  }
  return pangkat;
}

export type AnakTangga = { nilai: number; r: number; jenuh: boolean };

/**
 * Keterangan ukuran - tiga bulatan dengan ANGKA SUNGGUHAN.
 *
 * Yang teratas jumlah terbesar yang sedang tampil, atau ambang jepit bila
 * yang terbesar melewatinya (ditandai `jenuh`, dibaca "≥"). Dua di bawahnya
 * bilangan rapi seperempat dan seperenambelasnya - luas seperempat, jari-jari
 * separuh.
 */
export function tanggaUkuran(skala: SkalaBulatan, terbesar: number): AnakTangga[] {
  if (!(terbesar > 0)) return [];
  const jenuh = terbesar > skala.nJenuh;
  const atas = jenuh ? Math.ceil(skala.nJenuh) : Math.round(terbesar);
  const calon = [rapiKeBawah(atas / 16), rapiKeBawah(atas / 4), Math.max(1, atas)];
  const unik = [...new Set(calon)].sort((a, b) => a - b);
  return unik.map((nilai) => ({ nilai, r: jariJariBulatan(nilai, skala), jenuh: jenuh && nilai === Math.max(1, atas) }));
}

/* ==========================================================================
 * 3. KODE WILAYAH DAN REKAP KECAMATAN
 * ==========================================================================
 *
 * Kode desa Kemendagri: "72.03.08.1020" = provinsi.kabupaten.kecamatan.desa.
 * Kode kecamatannya tiga ruas pertama. Diukur di sipp_donggala: 3.043 baris
 * berkode desa, dan tak satu pun kode desanya menyimpang dari kolom kode
 * kecamatannya - jadi menurunkan kecamatan dari kode desa aman.
 */
const POLA_KODE_DESA = /^(\d{2}\.\d{2}\.\d{2})\.\d{4}$/;
const POLA_KODE_KECAMATAN = /^\d{2}\.\d{2}\.\d{2}$/;

export function kodeKecamatanDesa(kode: string): string | null {
  const m = POLA_KODE_DESA.exec(String(kode || "").trim());
  return m ? m[1] : null;
}

export function adalahKodeDesa(kode: string): boolean {
  return POLA_KODE_DESA.test(String(kode || "").trim());
}

export function adalahKodeKecamatan(kode: string): boolean {
  return POLA_KODE_KECAMATAN.test(String(kode || "").trim());
}

export type TitikUntukRekap = SumberHitung & { kode: string; kecamatan: string; kabupaten: string };

export type SisaKecamatan = {
  kode: string;
  nama: string;
  kabupaten: string;
  perkara: number;
  kelas?: Partial<Record<KelasPeta, number>>;
  /** Rincian nama jenis - untuk pilihan jenis tunggal. */
  jenis?: Record<string, number>;
};

export type RekapKecamatan = {
  kode: string;
  nama: string;
  kabupaten: string;
  /** SELURUH perkara golongan ini di kecamatan itu. */
  perkara: number;
  /** ...dari desa yang punya titik di peta. */
  perkaraBertitik: number;
  /** ...dari desa berkode yang BELUM punya titik. */
  perkaraTanpaTitik: number;
  /** ...yang kecamatannya berkode tetapi desanya tidak. */
  perkaraTanpaDesa: number;
  desa: number;
  desaBertitik: number;
};

/**
 * Rekap per kecamatan untuk label lapisan kecamatan.
 *
 * Dihitung dari SELURUH desa kecamatan itu - termasuk yang belum punya titik
 * di OpenStreetMap - ditambah baris yang hanya berkode kecamatan. Label
 * kecamatan yang hanya menjumlahkan desa bertitik akan menyebut angka yang
 * lebih kecil daripada kenyataan tanpa berkata demikian; di Donggala saja
 * 30 desa (60 perkara) tahun 2026 belum punya titik.
 */
export function rekapKecamatan(
  titik: TitikUntukRekap[],
  koordinat: Record<string, [number, number]> | null,
  sisa: SisaKecamatan[] | undefined,
  pilihan: PilihanBulatan,
  jenisTerpilih = ""
): Map<string, RekapKecamatan> {
  const jenisTunggal = pilihan === PILIHAN_JENIS && Boolean(jenisTerpilih);
  const golongan: GolonganPeta = pilihan === PILIHAN_JENIS ? "semua" : pilihan;
  const hasil = new Map<string, RekapKecamatan>();
  const ambil = (kode: string, nama: string, kabupaten: string) => {
    let r = hasil.get(kode);
    if (!r) {
      r = {
        kode,
        nama: nama || kode,
        kabupaten,
        perkara: 0,
        perkaraBertitik: 0,
        perkaraTanpaTitik: 0,
        perkaraTanpaDesa: 0,
        desa: 0,
        desaBertitik: 0,
      };
      hasil.set(kode, r);
    }
    if ((!r.nama || r.nama === kode) && nama) r.nama = nama;
    if (!r.kabupaten && kabupaten) r.kabupaten = kabupaten;
    return r;
  };

  for (const t of titik) {
    const kec = kodeKecamatanDesa(t.kode);
    if (!kec) continue;
    const n = jenisTunggal ? hitungJenis(t, jenisTerpilih, "lainnya").perkara : hitungGolongan(t, golongan).perkara;
    if (n <= 0) continue;
    const r = ambil(kec, t.kecamatan, t.kabupaten);
    r.perkara += n;
    r.desa += 1;
    if (koordinat && koordinat[t.kode]) {
      r.perkaraBertitik += n;
      r.desaBertitik += 1;
    } else {
      r.perkaraTanpaTitik += n;
    }
  }

  const kelasDipilih = kelasGolongan(golongan);
  const kunciJenis = samakanTeksJenis(jenisTerpilih);
  for (const s of sisa ?? []) {
    if (!adalahKodeKecamatan(s.kode)) continue;
    const n = jenisTunggal
      ? Object.entries(s.jenis ?? {}).reduce((jml, [teks, x]) => jml + (samakanTeksJenis(teks) === kunciJenis ? x : 0), 0)
      : s.kelas
        ? kelasDipilih.reduce((jml, k) => jml + (s.kelas?.[k] ?? 0), 0)
        : golongan === "semua"
          ? s.perkara
          : 0;
    if (n <= 0) continue;
    const r = ambil(s.kode, s.nama, s.kabupaten);
    r.perkara += n;
    r.perkaraTanpaDesa += n;
  }
  return hasil;
}

/* ==========================================================================
 * 4. GEOMETRI - SELIMUT CEMBUNG, TITIK LABEL, TITIK DI DALAM POLIGON
 * ==========================================================================
 *
 * Seluruh titik berbentuk [lintang, bujur], sama dengan Leaflet. Hitungannya
 * datar (bujur sebagai x, lintang sebagai y): wilayah yang diurus satu
 * kecamatan hanya beberapa puluh kilometer, dan dekat khatulistiwa - lintang
 * Donggala -0,7 - satu derajat bujur dan satu derajat lintang hampir sama
 * panjang (cos 0,7 derajat = 0,9999).
 */
export type LatLon = [number, number];

function silang(o: LatLon, a: LatLon, b: LatLon) {
  return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
}

/**
 * Selimut cembung (rantai monoton Andrew). Memulangkan cincin berlawanan
 * arah jarum jam tanpa mengulang titik pertama. Titik kembar dibuang.
 */
export function selimutCembung(titik: LatLon[]): LatLon[] {
  const kunci = new Set<string>();
  const unik: LatLon[] = [];
  for (const p of titik) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const k = `${p[0]},${p[1]}`;
    if (kunci.has(k)) continue;
    kunci.add(k);
    unik.push(p);
  }
  if (unik.length < 3) return unik;
  // Diurut menurut x (bujur) lalu y (lintang).
  const urut = [...unik].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const bawah: LatLon[] = [];
  for (const p of urut) {
    while (bawah.length >= 2 && silang(bawah[bawah.length - 2], bawah[bawah.length - 1], p) <= 0) bawah.pop();
    bawah.push(p);
  }
  const atas: LatLon[] = [];
  for (let i = urut.length - 1; i >= 0; i--) {
    const p = urut[i];
    while (atas.length >= 2 && silang(atas[atas.length - 2], atas[atas.length - 1], p) <= 0) atas.pop();
    atas.push(p);
  }
  atas.pop();
  bawah.pop();
  return [...bawah, ...atas];
}

const KM_PER_DERAJAT = 111.32;

/**
 * BATAS PERKIRAAN satu kecamatan dari titik desanya: selimut cembung dari
 * lingkaran-lingkaran berjari-jari `km` di sekeliling tiap titik desa - yaitu
 * selimut cembung yang "diberi jarak" sehingga desa di tepi tidak jatuh tepat
 * di atas garisnya.
 *
 * null bila titik UNIKNYA kurang dari tiga. Dua titik hanya membentuk garis,
 * dan garis yang dilebarkan menjadi kapsul akan tampak seperti wilayah,
 * padahal tidak ada yang tahu bentuknya. Kecamatan seperti itu tetap
 * berlabel, hanya tanpa garis.
 *
 * INI BUKAN BATAS RESMI dan tidak boleh dibaca begitu: kecamatan meliputi
 * hutan, gunung, dan laut di antara desanya, dan selimut titik desa hanya
 * menggambar tempat orangnya tinggal.
 */
export const JARAK_SELIMUT_KM = 1.5;

export function selimutBerjarak(titik: LatLon[], km = JARAK_SELIMUT_KM, langkah = 16): LatLon[] | null {
  const inti = selimutCembung(titik);
  if (inti.length < 3) return null;
  const perluasan: LatLon[] = [];
  for (const [lat, lon] of inti) {
    const dLat = km / KM_PER_DERAJAT;
    const dLon = km / (KM_PER_DERAJAT * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < langkah; i++) {
      const sudut = (2 * Math.PI * i) / langkah;
      perluasan.push([lat + dLat * Math.sin(sudut), lon + dLon * Math.cos(sudut)]);
    }
  }
  return selimutCembung(perluasan);
}

/** Luas bertanda satu cincin (bujur sebagai x) - positif bila berlawanan jarum jam. */
function luasBertanda(cincin: LatLon[]) {
  let a = 0;
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    a += cincin[j][1] * cincin[i][0] - cincin[i][1] * cincin[j][0];
  }
  return a / 2;
}

/** Titik di dalam cincin (lemparan sinar). */
export function titikDalamCincin(p: LatLon, cincin: LatLon[]): boolean {
  let dalam = false;
  const [y, x] = p;
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    const [yi, xi] = cincin[i];
    const [yj, xj] = cincin[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

/** Titik di dalam poligon bercincin dalam: di dalam cincin luar, di luar seluruh lubangnya. */
export function titikDalamPoligon(p: LatLon, poligon: LatLon[][]): boolean {
  if (poligon.length === 0 || !titikDalamCincin(p, poligon[0])) return false;
  for (let i = 1; i < poligon.length; i++) if (titikDalamCincin(p, poligon[i])) return false;
  return true;
}

function rataRata(titik: LatLon[]): LatLon {
  let lat = 0;
  let lon = 0;
  for (const p of titik) {
    lat += p[0];
    lon += p[1];
  }
  return [lat / Math.max(1, titik.length), lon / Math.max(1, titik.length)];
}

/** Titik berat luas satu cincin; rata-rata titiknya bila cincinnya tidak berluas. */
export function titikBerat(cincin: LatLon[]): LatLon {
  const a = luasBertanda(cincin);
  if (Math.abs(a) < 1e-12) return rataRata(cincin);
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    const f = cincin[j][1] * cincin[i][0] - cincin[i][1] * cincin[j][0];
    cx += (cincin[j][1] + cincin[i][1]) * f;
    cy += (cincin[j][0] + cincin[i][0]) * f;
  }
  return [cy / (6 * a), cx / (6 * a)];
}

/**
 * Titik label satu wilayah: bagian TERLUAS, titik beratnya bila jatuh di
 * dalam; kalau tidak - kecamatan berbentuk bulan sabit atau berteluk -
 * tengah potongan mendatar terlebar yang melewati lintang titik berat itu.
 * Label yang jatuh di laut atau di kecamatan tetangga menyebut angka untuk
 * tempat yang salah.
 */
export function titikLabelWilayah(bagian: LatLon[][][]): LatLon | null {
  let terluas: LatLon[][] | null = null;
  let luas = -1;
  for (const pol of bagian) {
    if (!pol[0] || pol[0].length < 3) continue;
    const a = Math.abs(luasBertanda(pol[0]));
    if (a > luas) {
      luas = a;
      terluas = pol;
    }
  }
  if (!terluas) return null;
  const berat = titikBerat(terluas[0]);
  if (titikDalamPoligon(berat, terluas)) return berat;

  const y = berat[0];
  const potong: number[] = [];
  for (const cincin of terluas) {
    for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
      const [yi, xi] = cincin[i];
      const [yj, xj] = cincin[j];
      if (yi > y !== yj > y) potong.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  potong.sort((a, b) => a - b);
  let lebar = -1;
  let tengah: number | null = null;
  for (let i = 0; i + 1 < potong.length; i += 2) {
    if (potong[i + 1] - potong[i] > lebar) {
      lebar = potong[i + 1] - potong[i];
      tengah = (potong[i] + potong[i + 1]) / 2;
    }
  }
  return tengah === null ? rataRata(terluas[0]) : [y, tengah];
}

/* ==========================================================================
 * 5. BERKAS BATAS KECAMATAN RESMI (public/peta/batas-kecamatan.json)
 * ==========================================================================
 *
 * GeoJSON FeatureCollection, properti tiap fitur { kode: "72.03.08", nama,
 * kabupaten }, geometri Polygon atau MultiPolygon berurutan [bujur, lintang]
 * sebagaimana GeoJSON. Dibalik di sini menjadi [lintang, bujur] untuk
 * Leaflet. Fitur yang kodenya tidak berbentuk kode kecamatan, atau
 * koordinatnya di luar Indonesia, DILEWATI - dan jumlahnya disebut, bukan
 * ditelan.
 */
export type BatasKecamatan = {
  kode: string;
  nama: string;
  kabupaten: string;
  /** MultiPolygon: [poligon][cincin][titik] dalam [lintang, bujur]. */
  bagian: LatLon[][][];
  label: LatLon | null;
};

export type BerkasBatasKecamatan = {
  sumber: string;
  dibuat: string;
  lisensi: string;
  kecamatan: BatasKecamatan[];
  dilewati: number;
};

function cincinGeoJson(x: unknown): LatLon[] | null {
  if (!Array.isArray(x) || x.length < 4) return null;
  const hasil: LatLon[] = [];
  for (const titik of x) {
    if (!Array.isArray(titik) || titik.length < 2) return null;
    const lon = Number(titik[0]);
    const lat = Number(titik[1]);
    // Indonesia dan sekitarnya - koordinat tertukar atau berasal dari
    // proyeksi lain akan jatuh di luar kotak ini.
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -12 || lat > 7 || lon < 94 || lon > 142) return null;
    hasil.push([lat, lon]);
  }
  return hasil;
}

function poligonGeoJson(x: unknown): LatLon[][] | null {
  if (!Array.isArray(x) || x.length === 0) return null;
  const cincin: LatLon[][] = [];
  for (const c of x) {
    const r = cincinGeoJson(c);
    if (!r) return null;
    cincin.push(r);
  }
  return cincin;
}

export function bacaBatasKecamatan(json: unknown): BerkasBatasKecamatan | null {
  if (!json || typeof json !== "object") return null;
  const isi = json as {
    type?: unknown;
    features?: unknown;
    sumber?: unknown;
    dibuat?: unknown;
    lisensi?: unknown;
  };
  if (isi.type !== "FeatureCollection" || !Array.isArray(isi.features)) return null;

  const kecamatan: BatasKecamatan[] = [];
  let dilewati = 0;
  for (const f of isi.features as Array<{ properties?: Record<string, unknown>; geometry?: { type?: unknown; coordinates?: unknown } }>) {
    const kode = String(f?.properties?.kode ?? "").trim();
    const g = f?.geometry;
    let bagian: LatLon[][][] | null = null;
    if (adalahKodeKecamatan(kode) && g && Array.isArray(g.coordinates)) {
      if (g.type === "Polygon") {
        const p = poligonGeoJson(g.coordinates);
        bagian = p ? [p] : null;
      } else if (g.type === "MultiPolygon") {
        const semua = (g.coordinates as unknown[]).map(poligonGeoJson);
        bagian = semua.every(Boolean) ? (semua as LatLon[][][]) : null;
      }
    }
    if (!bagian || bagian.length === 0) {
      dilewati += 1;
      continue;
    }
    kecamatan.push({
      kode,
      nama: String(f.properties?.nama ?? kode),
      kabupaten: String(f.properties?.kabupaten ?? ""),
      bagian,
      label: titikLabelWilayah(bagian),
    });
  }
  return {
    sumber: String(isi.sumber ?? ""),
    dibuat: String(isi.dibuat ?? ""),
    lisensi: String(isi.lisensi ?? ""),
    kecamatan,
    dilewati,
  };
}

/* ==========================================================================
 * 6. LAPISAN KECAMATAN MENURUT PERBESARAN
 * ==========================================================================
 *
 *   zum <= 8   tidak ada garis maupun label. Seluruh Sulawesi Tengah tampak;
 *              175 garis kecamatan pada lebar layar seukuran itu menjadi
 *              jaring, dan bulatannya sendiri sudah per kecamatan.
 *   zum 9      GARIS saja - pandangan awal peta. Bulatan masih per kecamatan
 *              dan keterangan melayangnya sudah menyebut angkanya; label di
 *              atasnya hanya mengulang.
 *   zum >= 10  garis + LABEL nama kecamatan dan jumlah perkaranya. Di sini
 *              bulatan sudah per DESA, dan label kecamatanlah yang menyebut
 *              jumlah sekecamatan - termasuk desa yang belum bertitik.
 *
 * Di zum 10 satu kecamatan lembah Palu selebar 5-15 km tergambar 35-110 px:
 * cukup untuk satu label dua baris. Label yang bertabrakan disembunyikan -
 * yang perkaranya lebih sedikit mengalah.
 */
export const ZUM_GARIS_KECAMATAN = 9;
export const ZUM_LABEL_KECAMATAN = 10;

export function lapisanKecamatanTampil(zum: number): { garis: boolean; label: boolean } {
  return { garis: zum >= ZUM_GARIS_KECAMATAN, label: zum >= ZUM_LABEL_KECAMATAN };
}

export type KotakLabel = { kunci: string; kiri: number; atas: number; lebar: number; tinggi: number; prioritas: number };

/** Label yang boleh tampil: rakus menurut prioritas, yang bertabrakan mengalah. */
export function pilihLabelTakBertabrakan(kotak: KotakLabel[], sela = 2): Set<string> {
  const urut = [...kotak].sort((a, b) => b.prioritas - a.prioritas);
  const terpasang: KotakLabel[] = [];
  const hasil = new Set<string>();
  for (const k of urut) {
    const tabrak = terpasang.some(
      (t) =>
        k.kiri < t.kiri + t.lebar + sela &&
        t.kiri < k.kiri + k.lebar + sela &&
        k.atas < t.atas + t.tinggi + sela &&
        t.atas < k.atas + k.tinggi + sela
    );
    if (tabrak) continue;
    terpasang.push(k);
    hasil.add(k.kunci);
  }
  return hasil;
}

/* ==========================================================================
 * 7. LAYAR PENUH SEMU - LELUHUR YANG MENAHAN `position: fixed`
 * ==========================================================================
 *
 * Kotak berposisi fixed seharusnya menempel ke jendela. Tetapi leluhur yang
 * punya transform, filter, backdrop-filter, perspective, contain, atau
 * will-change atasnya menjadi BLOK PENAMPUNG baginya - kotak "layar penuh"
 * lalu menempel ke leluhur itu, bukan ke jendela. Kartu portal memakai
 * `backdrop-blur`, jadi layar penuh semu yang tidak menetralkannya menutupi
 * kartunya saja. Leluhur yang ber-z-index membentuk konteks tumpukan yang
 * mengurung z-index kotak itu - ia pun dinetralkan selama layar penuh semu.
 */
export type GayaLeluhur = {
  transform?: string;
  filter?: string;
  backdropFilter?: string;
  webkitBackdropFilter?: string;
  perspective?: string;
  contain?: string;
  willChange?: string;
  containerType?: string;
  position?: string;
  zIndex?: string;
};

export function leluhurMenahanFixed(g: GayaLeluhur): boolean {
  const ada = (v: string | undefined, kosong: string[]) => Boolean(v) && !kosong.includes(String(v));
  return (
    ada(g.transform, ["none"]) ||
    ada(g.filter, ["none"]) ||
    ada(g.backdropFilter, ["none"]) ||
    ada(g.webkitBackdropFilter, ["none"]) ||
    ada(g.perspective, ["none"]) ||
    /\b(paint|layout|strict|content)\b/.test(String(g.contain || "")) ||
    /\b(transform|filter|perspective|backdrop-filter)\b/.test(String(g.willChange || "")) ||
    ada(g.containerType, ["normal"]) ||
    (ada(g.zIndex, ["auto"]) && ada(g.position, ["static"]))
  );
}

/* ==========================================================================
 * 8. PILIHAN YANG DIINGAT
 * ==========================================================================
 *
 * Disimpan di peramban petugas sendiri. Tiap akses dibungkus: penyimpanan
 * dapat ditolak (jendela pribadi, kebijakan situs) dan peta tidak boleh
 * gagal karenanya - ia hanya lupa.
 */
export const KUNCI_INGAT_GOLONGAN = "aleta:peta-perkara:golongan";

/** Pilihan bulatan yang diingat: satu golongan, atau "jenis" (jenis tunggal halaman). */
export function bacaPilihanTersimpan(): PilihanBulatan | null {
  try {
    const nilai = window.localStorage.getItem(KUNCI_INGAT_GOLONGAN);
    return adalahPilihan(nilai) ? nilai : null;
  } catch {
    return null;
  }
}

export function simpanPilihan(pilihan: string) {
  if (!adalahPilihan(pilihan)) return;
  try {
    window.localStorage.setItem(KUNCI_INGAT_GOLONGAN, pilihan);
  } catch {
    // Penyimpanan ditolak - pilihannya hanya berlaku sampai halaman ditutup.
  }
}
