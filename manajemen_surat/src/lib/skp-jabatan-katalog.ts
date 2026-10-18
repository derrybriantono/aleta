import type { AspekSkp, JabatanSkp } from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * KATALOG SKP JABATAN PERKARA 2026 - BUNYI RHK, INDIKATOR, ATURAN HITUNG
 * ============================================================================
 *
 * Padanan SKP_HAKIM_2026 (eviden-skp-katalog.ts) untuk Ketua, Wakil Ketua,
 * Panitera, Panmud, PP, Jurusita, Petugas Meja, Kasir, Operator. Diminta dan
 * disetujui pengguna 17 Oktober 2026 (rancangan: D:/aleta-dev/kerja/skp).
 *
 * BUNYI DAN TARGET DI SINI ADALAH USULAN ALETA (statusTarget "usulan"),
 * bukan salinan e-Kinerja. Setelah tangkapan SKP resmi tiap jabatan didapat,
 * sunting teks/target di berkas ini saja, atau simpan sebagai target
 * "disahkan" lewat aleta_skp_target - aturan hitung di skp-jabatan-hitung.ts
 * tidak membaca bunyi teks.
 *
 * ATURAN DATA (sama dengan kontrak skp-jabatan-tipe.ts): bot hanya mengirim
 * FAKTA per kejadian; di sinilah aturan hitung dinyatakan (lulus/tidak,
 * selisih hari, persen). Penyebut nol = "—"; nilai yang tidak terbaca (null)
 * tidak pernah menjadi 0.
 *
 * KUNCI. Kunci RHK mudah dibaca ("pmh"); kunci indikator = "<rhk>-<aspek>"
 * ("pmh-kuantitas"). Kunci indikator sama dengan FaktaIndikatorSkp.kunci yang
 * dikirim bot; fakta pendukung (daftar pembanding untuk persen) memakai
 * kunci tambahan yang tercatat di `faktaTambahan`. Seluruh kunci yang harus
 * dikirim bot dapat dibaca dari KUNCI_FAKTA_SKP_JABATAN (diuji selaras).
 */

// ─── Aturan hitung ──────────────────────────────────────────────────────────

/** Arah selisih hari antara dua tanggal sebuah kejadian. */
export type ArahSelisihSkp = "acuan-ke-tanggal" | "tanggal-ke-acuan";

export type AturanHitungSkp =
  /** Banyaknya kejadian (daftar terbaca kosong = 0 sungguhan; tak terbaca = "—"). */
  | { jenis: "jumlah" }
  /** Jumlah `nilai` kejadian (rupiah). */
  | { jenis: "jumlah-nilai" }
  /**
   * Persen kejadian yang selisih harinya memenuhi batas. maks: selisih <=
   * batas (batal tertib = belum diinput melewati batas); min: selisih >=
   * batas. `syarat` = frasa dasar hitung ("diberitahukan paling lama 7 hari").
   */
  | { jenis: "persen-hari"; arah: ArahSelisihSkp; cocok: "maks" | "min"; batas: number; syarat: string }
  /** Rata-rata selisih hari kejadian. */
  | { jenis: "rata-hari"; arah: ArahSelisihSkp }
  /** Persen banyaknya kejadian daftar `pembilang` terhadap daftar `penyebut` (kunci fakta). */
  | { jenis: "rasio"; pembilang: string; penyebut: string; syarat: string }
  /** Tidak ada sumber SIPP: seluruhnya isian manual (dengan bukti). */
  | { jenis: "isian" };

export type DefIndikatorSkp = {
  kunci: string;
  aspek: AspekSkp;
  teks: string;
  /** "Perkara", "Relaas", "Rp" ... (jumlah); persen "%" ; rata-hari "Hari". */
  satuan: string;
  /** Benda yang dihitung, untuk kalimat dasar ("penunjukan majelis hakim"). */
  objek: string;
  aturan: AturanHitungSkp;
  /** null = belum ada target. */
  targetNilai: number | null;
  targetTeks: string;
  /** Pakai kejadian indikator lain bila bot tidak mengirim daftar sendiri. */
  dari?: string;
  /** Kunci fakta pembanding yang juga dibaca aturan (rasio). */
  faktaTambahan?: string[];
};

export type DefRhkSkp = {
  kunci: string;
  /** Bunyi Rencana Hasil Kerja. */
  teks: string;
  /** "Rekap Penunjukan Majelis Hakim" - judul bukti dukung dan bunyi "berdasarkan ...". */
  judulRekap: string;
  indikator: DefIndikatorSkp[];
};

// ─── Pembantu penyusun katalog ──────────────────────────────────────────────

const TANPA_TARGET = { targetNilai: null, targetTeks: "Belum ada target" } as const;
const TARGET_SERATUS = { targetNilai: 100, targetTeks: "100%" } as const;
const targetMaksHari = (n: number) => ({ targetNilai: n, targetTeks: `≤ ${n} Hari` });

type Opsi = {
  objek?: string;
  satuan?: string;
  target?: { targetNilai: number | null; targetTeks: string };
  dari?: string;
  faktaTambahan?: string[];
};

function ind(aspek: AspekSkp, kunci: string, teks: string, aturan: AturanHitungSkp, o: Opsi = {}): DefIndikatorSkp {
  const satuan =
    o.satuan ??
    (aturan.jenis === "persen-hari" || aturan.jenis === "rasio"
      ? "%"
      : aturan.jenis === "rata-hari"
        ? "Hari"
        : aturan.jenis === "jumlah-nilai"
          ? "Rp"
          : "Perkara");
  return {
    kunci,
    aspek,
    teks,
    satuan,
    objek: o.objek ?? "kejadian",
    aturan,
    ...(o.target ?? (aturan.jenis === "persen-hari" || aturan.jenis === "rasio" ? TARGET_SERATUS : TANPA_TARGET)),
    ...(o.dari ? { dari: o.dari } : {}),
    ...(o.faktaTambahan ? { faktaTambahan: o.faktaTambahan } : {}),
  };
}

function rhk(kunci: string, teks: string, judulRekap: string, indikator: DefIndikatorSkp[]): DefRhkSkp {
  return { kunci, teks, judulRekap, indikator };
}

const kunci3 = (r: string) => ({ k: `${r}-kuantitas`, q: `${r}-kualitas`, w: `${r}-waktu` });

/** Tiga indikator isian (tanpa sumber SIPP) untuk sebuah RHK. */
function rhkIsian(kunci: string, teks: string, judulRekap: string, t: { k: string; q: string; w: string }): DefRhkSkp {
  const x = kunci3(kunci);
  return rhk(kunci, teks, judulRekap, [
    ind("Kuantitas", x.k, t.k, { jenis: "isian" }, { objek: "kegiatan", satuan: "Kegiatan" }),
    ind("Kualitas", x.q, t.q, { jenis: "isian" }, { satuan: "%" }),
    ind("Waktu", x.w, t.w, { jenis: "isian" }, { satuan: "%" }),
  ]);
}

// ─── Pimpinan: Ketua dan Wakil Ketua ────────────────────────────────────────

const RHK_PIMPINAN: DefRhkSkp[] = [
  rhk(
    "pmh",
    "Terwujudnya penunjukan majelis hakim yang cepat dan tepat guna menjamin kepastian proses persidangan",
    "Rekap Penunjukan Majelis Hakim",
    [
      ind("Kuantitas", "pmh-kuantitas", "Jumlah penunjukan majelis hakim (PMH) yang diterbitkan", { jenis: "jumlah" }, { objek: "penunjukan majelis hakim" }),
      ind(
        "Kualitas",
        "pmh-kualitas",
        "Persentase penunjukan majelis hakim yang diterbitkan pada hari pendaftaran perkara",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 0, syarat: "diterbitkan pada hari pendaftaran perkara" },
        { objek: "penunjukan majelis hakim", dari: "pmh-kuantitas" }
      ),
      ind(
        "Waktu",
        "pmh-waktu",
        "Rata-rata waktu penerbitan penunjukan majelis hakim sejak pendaftaran perkara",
        { jenis: "rata-hari", arah: "acuan-ke-tanggal" },
        { objek: "penunjukan majelis hakim", dari: "pmh-kuantitas", target: targetMaksHari(1) }
      ),
    ]
  ),
  rhk(
    "phs",
    "Terwujudnya penetapan hari sidang yang cepat guna menjamin kelancaran jadwal persidangan",
    "Rekap Penetapan Hari Sidang",
    [
      ind("Kuantitas", "phs-kuantitas", "Jumlah penetapan hari sidang (PHS) yang diterbitkan", { jenis: "jumlah" }, { objek: "penetapan hari sidang" }),
      ind(
        "Kualitas",
        "phs-kualitas",
        "Persentase penetapan hari sidang yang diterbitkan paling lama 3 hari sejak penunjukan majelis hakim",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 3, syarat: "diterbitkan paling lama 3 hari sejak penunjukan majelis hakim" },
        { objek: "penetapan hari sidang", dari: "phs-kuantitas" }
      ),
      ind(
        "Waktu",
        "phs-waktu",
        "Rata-rata waktu penerbitan penetapan hari sidang sejak penunjukan majelis hakim",
        { jenis: "rata-hari", arah: "acuan-ke-tanggal" },
        { objek: "penetapan hari sidang", dari: "phs-kuantitas", target: targetMaksHari(3) }
      ),
    ]
  ),
];

// ─── Panitera ───────────────────────────────────────────────────────────────

const RHK_PANITERA: DefRhkSkp[] = [
  rhk(
    "pn-penunjukan",
    "Terwujudnya penunjukan panitera pengganti dan jurusita pada setiap perkara secara cepat dan tepat",
    "Rekap Penunjukan Panitera Pengganti dan Jurusita",
    [
      ind("Kuantitas", "pn-penunjukan-kuantitas", "Jumlah penunjukan panitera pengganti dan jurusita pada perkara", { jenis: "jumlah" }, { objek: "penunjukan panitera pengganti dan jurusita", satuan: "Penunjukan" }),
      ind(
        "Kualitas",
        "pn-penunjukan-kualitas",
        "Persentase penunjukan panitera pengganti dan jurusita pada hari penunjukan majelis hakim",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 0, syarat: "dilakukan pada hari penunjukan majelis hakim" },
        { objek: "penunjukan" }
      ),
      ind(
        "Waktu",
        "pn-penunjukan-waktu",
        "Rata-rata waktu penunjukan panitera pengganti dan jurusita sejak penunjukan majelis hakim",
        { jenis: "rata-hari", arah: "acuan-ke-tanggal" },
        { objek: "penunjukan", dari: "pn-penunjukan-kualitas", target: targetMaksHari(1) }
      ),
    ]
  ),
  rhkIsian(
    "pn-administrasi",
    "Terkelolanya administrasi perkara di bawah kendali Panitera secara tertib dan akuntabel",
    "Rekap Pengelolaan Administrasi Perkara",
    {
      k: "Jumlah kegiatan pengendalian administrasi perkara yang dilaksanakan",
      q: "Tingkat kesesuaian pengelolaan administrasi perkara dengan standar layanan",
      w: "Tingkat ketepatan waktu penyelesaian administrasi perkara sesuai SOP",
    }
  ),
];

// ─── Panitera Muda ──────────────────────────────────────────────────────────

const RHK_PANMUD_HUKUM: DefRhkSkp[] = [
  rhk(
    "ph-arsip",
    "Terkelolanya pengarsipan berkas perkara yang berkekuatan hukum tetap secara tertib dan lengkap",
    "Rekap Pengarsipan Berkas Perkara",
    [
      ind("Kuantitas", "ph-arsip-kuantitas", "Jumlah berkas perkara berkekuatan hukum tetap yang diarsipkan", { jenis: "jumlah" }, { objek: "berkas perkara diarsipkan", faktaTambahan: [] }),
      ind(
        "Kualitas",
        "ph-arsip-kualitas",
        "Persentase perkara berkekuatan hukum tetap yang sudah diarsipkan",
        { jenis: "rasio", pembilang: "ph-arsip-kuantitas", penyebut: "ph-arsip-bht", syarat: "sudah masuk arsip" },
        { objek: "perkara berkekuatan hukum tetap", faktaTambahan: ["ph-arsip-bht"] }
      ),
      ind("Waktu", "ph-arsip-waktu", "Tingkat ketepatan waktu penyampaian laporan bulanan", { jenis: "isian" }, { satuan: "%" }),
    ]
  ),
];

function rhkPanmudPerkara(awal: string, sebutan: string): DefRhkSkp[] {
  const putusan = `${awal}-putusan`;
  const publikasi = `${awal}-publikasi`;
  const akta = `${awal}-akta`;
  return [
    rhk(
      putusan,
      `Terkelolanya putusan perkara ${sebutan} yang lengkap, transparan, dan diberitahukan tepat waktu`,
      `Rekap Putusan Perkara ${sebutan[0].toUpperCase()}${sebutan.slice(1)}`,
      [
        ind("Kuantitas", `${putusan}-kuantitas`, `Jumlah putusan perkara ${sebutan} yang diselesaikan administrasinya`, { jenis: "jumlah" }, { objek: `putusan perkara ${sebutan}`, satuan: "Putusan" }),
        ind(
          "Kualitas",
          `${putusan}-kualitas`,
          "Persentase putusan yang salinannya terunggah di SIPP",
          { jenis: "rasio", pembilang: `${putusan}-unggah`, penyebut: `${putusan}-kuantitas`, syarat: "salinan putusannya terunggah di SIPP" },
          { objek: "putusan", faktaTambahan: [`${putusan}-unggah`] }
        ),
        ind(
          "Waktu",
          `${putusan}-waktu`,
          "Persentase putusan yang diberitahukan kepada para pihak paling lama 7 hari sejak putusan",
          { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 7, syarat: "diberitahukan kepada para pihak paling lama 7 hari sejak putusan" },
          { objek: "putusan" }
        ),
      ]
    ),
    rhk(
      publikasi,
      `Terwujudnya anonimisasi putusan perkara ${sebutan} sebelum dipublikasikan`,
      "Rekap Anonimisasi Putusan",
      [
        ind("Kuantitas", `${publikasi}-kuantitas`, "Jumlah putusan yang sudah dianonimisasi", { jenis: "jumlah" }, { objek: "putusan teranonimisasi", satuan: "Putusan" }),
        ind(
          "Kualitas",
          `${publikasi}-kualitas`,
          "Persentase putusan yang sudah dianonimisasi dari seluruh putusan",
          { jenis: "rasio", pembilang: `${publikasi}-kuantitas`, penyebut: `${putusan}-kuantitas`, syarat: "sudah dianonimisasi" },
          { objek: "putusan", faktaTambahan: [`${putusan}-kuantitas`] }
        ),
        ind("Waktu", `${publikasi}-waktu`, "Tingkat ketepatan waktu anonimisasi putusan", { jenis: "isian" }, { satuan: "%" }),
      ]
    ),
    rhk(
      akta,
      "Terwujudnya penerbitan akta cerai yang cepat setelah putusan berkekuatan hukum tetap",
      "Rekap Penerbitan Akta Cerai",
      [
        ind("Kuantitas", `${akta}-kuantitas`, "Jumlah akta cerai yang diterbitkan", { jenis: "jumlah" }, { objek: "akta cerai", satuan: "Akta" }),
        ind(
          "Kualitas",
          `${akta}-kualitas`,
          "Persentase akta cerai yang diterbitkan paling lama 7 hari sejak putusan berkekuatan hukum tetap",
          { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 7, syarat: "diterbitkan paling lama 7 hari sejak putusan berkekuatan hukum tetap" },
          { objek: "perkara cerai berkekuatan hukum tetap" }
        ),
        ind(
          "Waktu",
          `${akta}-waktu`,
          "Rata-rata waktu penerbitan akta cerai sejak putusan berkekuatan hukum tetap",
          { jenis: "rata-hari", arah: "acuan-ke-tanggal" },
          { objek: "akta cerai", dari: `${akta}-kualitas`, target: targetMaksHari(7) }
        ),
      ]
    ),
  ];
}

// ─── Panitera Pengganti ─────────────────────────────────────────────────────

const RHK_PP: DefRhkSkp[] = [
  rhk(
    "pp-sidang",
    "Terwujudnya pendampingan persidangan dan pencatatan berita acara sidang (BAS) yang lengkap dan tepat waktu",
    "Rekap Pendampingan Sidang dan BAS",
    [
      ind("Kuantitas", "pp-sidang-kuantitas", "Jumlah persidangan yang didampingi", { jenis: "jumlah" }, { objek: "persidangan didampingi", satuan: "Sidang", faktaTambahan: ["pp-sidang-bas"] }),
      ind(
        "Kualitas",
        "pp-sidang-kualitas",
        "Persentase persidangan yang berita acara sidangnya (BAS) terisi",
        { jenis: "rasio", pembilang: "pp-sidang-bas", penyebut: "pp-sidang-kuantitas", syarat: "berita acara sidangnya terisi" },
        { objek: "persidangan", faktaTambahan: ["pp-sidang-bas"] }
      ),
      ind(
        "Waktu",
        "pp-sidang-waktu",
        "Persentase hasil sidang yang diinput ke SIPP paling lama 1 hari sesudah sidang",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 1, syarat: "diinput paling lama 1 hari sesudah sidang" },
        { objek: "hasil sidang" }
      ),
    ]
  ),
  rhkIsian("pp-putusan", "Terselesaikannya perkara yang ditangani sampai putusan dan minutasi secara tertib", "Rekap Penyelesaian Perkara", {
    k: "Jumlah perkara yang diselesaikan sampai putusan",
    q: "Tingkat kesesuaian berkas yang diminutasi dengan standar kelengkapan berkas",
    w: "Tingkat ketepatan waktu penyelesaian administrasi putusan",
  }),
];

// ─── Jurusita ───────────────────────────────────────────────────────────────

const RHK_JURUSITA: DefRhkSkp[] = [
  rhk(
    "js-relaas",
    "Terwujudnya pelaksanaan pemanggilan dan pemberitahuan kepada para pihak secara sah dan tepat waktu",
    "Rekap Pelaksanaan Relaas Panggilan",
    [
      ind("Kuantitas", "js-relaas-kuantitas", "Jumlah relaas panggilan/pemberitahuan yang dilaksanakan", { jenis: "jumlah" }, { objek: "relaas", satuan: "Relaas", faktaTambahan: ["js-relaas-dokumen"] }),
      ind(
        "Kualitas",
        "js-relaas-kualitas",
        "Persentase relaas yang dilengkapi dokumen relaas",
        { jenis: "rasio", pembilang: "js-relaas-dokumen", penyebut: "js-relaas-kuantitas", syarat: "dilengkapi dokumen relaas" },
        { objek: "relaas", faktaTambahan: ["js-relaas-dokumen"] }
      ),
      ind(
        "Waktu",
        "js-relaas-waktu",
        "Persentase panggilan yang sampai kepada para pihak paling lambat 3 hari sebelum sidang",
        { jenis: "persen-hari", arah: "tanggal-ke-acuan", cocok: "min", batas: 3, syarat: "disampaikan paling lambat 3 hari sebelum sidang" },
        { objek: "panggilan" }
      ),
    ]
  ),
  rhk(
    "js-input",
    "Tertibnya penginputan relaas ke SIPP segera sesudah panggilan dilaksanakan",
    "Rekap Penginputan Relaas",
    [
      ind("Kuantitas", "js-input-kuantitas", "Jumlah relaas yang diinput ke SIPP", { jenis: "jumlah" }, { objek: "relaas diinput", satuan: "Relaas", dari: "js-relaas-kuantitas" }),
      ind(
        "Kualitas",
        "js-input-kualitas",
        "Persentase relaas yang diinput ke SIPP paling lama 2 hari sejak tanggal relaas",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 2, syarat: "diinput ke SIPP paling lama 2 hari sejak tanggal relaas" },
        { objek: "relaas" }
      ),
      ind(
        "Waktu",
        "js-input-waktu",
        "Rata-rata waktu penginputan relaas ke SIPP sejak tanggal relaas",
        { jenis: "rata-hari", arah: "acuan-ke-tanggal" },
        { objek: "relaas", dari: "js-input-kualitas", target: targetMaksHari(2) }
      ),
    ]
  ),
  rhkIsian("js-putusan", "Terselenggaranya pemberitahuan putusan kepada para pihak secara sah", "Rekap Pemberitahuan Putusan", {
    k: "Jumlah pemberitahuan putusan yang disampaikan kepada para pihak",
    q: "Tingkat kesesuaian pemberitahuan putusan dengan alamat dan identitas para pihak",
    w: "Tingkat ketepatan waktu penyampaian pemberitahuan putusan",
  }),
];

// ─── Petugas Meja ───────────────────────────────────────────────────────────

const RHK_MEJA: DefRhkSkp[] = [
  rhk(
    "mj-minutasi",
    "Terwujudnya minutasi berkas perkara yang lengkap dan tertib",
    "Rekap Minutasi Berkas Perkara",
    [
      ind("Kuantitas", "mj-minutasi-kuantitas", "Jumlah berkas perkara yang diminutasi", { jenis: "jumlah" }, { objek: "berkas diminutasi", satuan: "Berkas" }),
      ind("Kualitas", "mj-minutasi-kualitas", "Tingkat kelengkapan berkas yang diminutasi", { jenis: "isian" }, { satuan: "%" }),
      ind("Waktu", "mj-minutasi-waktu", "Tingkat ketepatan waktu penyelesaian minutasi", { jenis: "isian" }, { satuan: "%" }),
    ]
  ),
  rhk(
    "mj-akta",
    "Terwujudnya penerbitan akta cerai yang cepat setelah putusan berkekuatan hukum tetap",
    "Rekap Penerbitan Akta Cerai",
    [
      ind("Kuantitas", "mj-akta-kuantitas", "Jumlah akta cerai yang diterbitkan", { jenis: "jumlah" }, { objek: "akta cerai", satuan: "Akta" }),
      ind("Kualitas", "mj-akta-kualitas", "Tingkat kesesuaian data akta cerai dengan putusan", { jenis: "isian" }, { satuan: "%" }),
      ind(
        "Waktu",
        "mj-akta-waktu",
        "Persentase akta cerai yang diterbitkan paling lama 7 hari sejak putusan berkekuatan hukum tetap",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 7, syarat: "diterbitkan paling lama 7 hari sejak putusan berkekuatan hukum tetap" },
        { objek: "perkara cerai berkekuatan hukum tetap" }
      ),
    ]
  ),
  rhkIsian("mj-layanan", "Terwujudnya pelayanan meja yang cepat dan ramah kepada pencari keadilan", "Rekap Pelayanan Meja", {
    k: "Jumlah pencari keadilan yang dilayani di meja",
    q: "Tingkat kepuasan pencari keadilan terhadap pelayanan meja",
    w: "Tingkat ketepatan waktu pelayanan meja sesuai standar",
  }),
];

// ─── Kasir ──────────────────────────────────────────────────────────────────

const RHK_KASIR: DefRhkSkp[] = [
  rhk(
    "ks-penerimaan",
    "Terwujudnya penerimaan panjar biaya perkara yang tertib dan tepat waktu",
    "Rekap Penerimaan Panjar Biaya Perkara",
    [
      ind("Kuantitas", "ks-penerimaan-kuantitas", "Jumlah panjar biaya perkara yang diterima", { jenis: "jumlah-nilai" }, { objek: "transaksi panjar", faktaTambahan: [] }),
      ind(
        "Kualitas",
        "ks-penerimaan-kualitas",
        "Persentase panjar biaya perkara yang diterima pada hari pendaftaran perkara",
        { jenis: "persen-hari", arah: "acuan-ke-tanggal", cocok: "maks", batas: 0, syarat: "diterima pada hari pendaftaran perkara" },
        { objek: "perkara" }
      ),
      ind(
        "Waktu",
        "ks-penerimaan-waktu",
        "Rata-rata waktu penerimaan panjar sejak pendaftaran perkara",
        { jenis: "rata-hari", arah: "acuan-ke-tanggal" },
        { objek: "perkara", dari: "ks-penerimaan-kualitas", target: targetMaksHari(1) }
      ),
    ]
  ),
  rhk(
    "ks-biaya",
    "Terwujudnya pengelolaan biaya perkara dan pengembalian sisa panjar yang akuntabel",
    "Rekap Biaya Perkara dan Sisa Panjar",
    [
      ind("Kuantitas", "ks-biaya-kuantitas", "Jumlah biaya perkara yang dibebankan", { jenis: "jumlah-nilai" }, { objek: "transaksi biaya" }),
      ind(
        "Kualitas",
        "ks-biaya-kualitas",
        "Persentase sisa panjar yang dikembalikan kepada para pihak",
        { jenis: "rasio", pembilang: "ks-biaya-sisa-kembali", penyebut: "ks-biaya-sisa", syarat: "sisa panjarnya sudah dikembalikan" },
        { objek: "perkara bersisa panjar", faktaTambahan: ["ks-biaya-sisa-kembali", "ks-biaya-sisa"] }
      ),
      ind("Waktu", "ks-biaya-waktu", "Tingkat ketepatan waktu laporan keuangan perkara", { jenis: "isian" }, { satuan: "%" }),
    ]
  ),
  rhk(
    "ks-pendaftaran",
    "Terwujudnya pendaftaran perkara yang lengkap dan tertib",
    "Rekap Pendaftaran Perkara",
    [
      ind("Kuantitas", "ks-pendaftaran-kuantitas", "Jumlah perkara yang didaftarkan", { jenis: "jumlah" }, { objek: "perkara didaftarkan" }),
      ind("Kualitas", "ks-pendaftaran-kualitas", "Tingkat kelengkapan berkas pendaftaran perkara", { jenis: "isian" }, { satuan: "%" }),
      ind("Waktu", "ks-pendaftaran-waktu", "Tingkat ketepatan waktu pendaftaran perkara", { jenis: "isian" }, { satuan: "%" }),
    ]
  ),
];

// ─── Operator dan opsional ──────────────────────────────────────────────────

const RHK_OPERATOR: DefRhkSkp[] = [
  rhk(
    "op-layanan",
    "Terwujudnya pengoperasian aplikasi perkara yang tertib dan akurat",
    "Rekap Pengoperasian Aplikasi",
    [
      ind("Kuantitas", "op-layanan-kuantitas", "Jumlah kegiatan pengoperasian aplikasi yang tercatat", { jenis: "jumlah" }, { objek: "kegiatan pengoperasian", satuan: "Kegiatan" }),
      ind("Kualitas", "op-layanan-kualitas", "Tingkat akurasi data yang dioperasikan", { jenis: "isian" }, { satuan: "%" }),
      ind("Waktu", "op-layanan-waktu", "Tingkat ketepatan waktu penyelesaian pekerjaan operator", { jenis: "isian" }, { satuan: "%" }),
    ]
  ),
];

const RHK_KOORDINATOR_DELEGASI: DefRhkSkp[] = [
  rhkIsian("kd-delegasi", "Terkoordinasinya pelaksanaan delegasi panggilan dan pemberitahuan secara tertib", "Rekap Delegasi Panggilan", {
    k: "Jumlah delegasi panggilan yang dikoordinasikan",
    q: "Tingkat kelengkapan relaas delegasi yang dikembalikan",
    w: "Tingkat ketepatan waktu pengiriman dan pengembalian delegasi",
  }),
];

const RHK_INFORMASI: DefRhkSkp[] = [
  rhkIsian("inf-layanan", "Terwujudnya pelayanan informasi pengadilan yang cepat dan akurat", "Rekap Pelayanan Informasi", {
    k: "Jumlah permintaan informasi yang dilayani",
    q: "Tingkat kepuasan pemohon informasi",
    w: "Tingkat ketepatan waktu pelayanan informasi sesuai standar",
  }),
];

// ─── SKP_JABATAN_2026 ───────────────────────────────────────────────────────

/**
 * RHK dan indikator per jabatan. "usulan" ALETA: bunyi dan target disunting di
 * sini sampai ada tangkapan e-Kinerja resmi. Ketua dan Wakil Ketua berbagi RHK
 * pimpinan; Jurusita Pengganti berbagi RHK Jurusita.
 */
export const SKP_JABATAN_2026: Readonly<Record<JabatanSkp, readonly DefRhkSkp[]>> = {
  ketua: RHK_PIMPINAN,
  "wakil-ketua": RHK_PIMPINAN,
  panitera: RHK_PANITERA,
  "panmud-hukum": RHK_PANMUD_HUKUM,
  "panmud-gugatan": rhkPanmudPerkara("gugatan", "gugatan"),
  "panmud-permohonan": rhkPanmudPerkara("permohonan", "permohonan"),
  pp: RHK_PP,
  jurusita: RHK_JURUSITA,
  "jurusita-pengganti": RHK_JURUSITA,
  "petugas-meja": RHK_MEJA,
  kasir: RHK_KASIR,
  operator: RHK_OPERATOR,
  "koordinator-delegasi": RHK_KOORDINATOR_DELEGASI,
  informasi: RHK_INFORMASI,
};

/** Perilaku kerja (Permen PANRB 6/2022, BerAKHLAK) - nilainya diisi manual pejabat penilai. */
export const PERILAKU_KERJA_SKP: readonly string[] = [
  "Berorientasi Pelayanan",
  "Akuntabel",
  "Kompeten",
  "Harmonis",
  "Loyal",
  "Adaptif",
  "Kolaboratif",
];

/** Tanda "usulan" pada bunyi dan target sampai disahkan (dicetak di catatan Lembar SKP). */
export const KALIMAT_USULAN_SKP =
  "Bunyi Rencana Hasil Kerja, indikator, dan target pada dokumen ini adalah USULAN dan belum disahkan; " +
  "sesuaikan dengan SKP resmi di e-Kinerja BKN.";

// ─── Turunan: daftar kunci yang harus dikirim bot ───────────────────────────

/** Semua RHK sebuah jabatan. */
export function rhkJabatanSkp(jabatan: JabatanSkp): readonly DefRhkSkp[] {
  return SKP_JABATAN_2026[jabatan];
}

/** Kunci fakta yang dibaca portal untuk sebuah indikator: miliknya sendiri (atau `dari`) dan pembandingnya. */
export function kunciFaktaIndikator(def: DefIndikatorSkp): string[] {
  const kunci = new Set<string>();
  if (def.aturan.jenis !== "isian") {
    kunci.add(def.kunci);
    if (def.dari) kunci.add(def.dari);
    if (def.aturan.jenis === "rasio") {
      kunci.add(def.aturan.pembilang);
      kunci.add(def.aturan.penyebut);
    }
    for (const t of def.faktaTambahan ?? []) kunci.add(t);
  }
  return [...kunci];
}

/**
 * Seluruh kunci fakta yang harus diketahui bot untuk tiap jabatan (tanpa
 * indikator isian). Bot menyelaraskan rute /sipp/skp-jabatan dengan daftar
 * ini - diuji di sisi portal (skp-jabatan-katalog.test.ts).
 */
export const KUNCI_FAKTA_SKP_JABATAN: Readonly<Record<JabatanSkp, readonly string[]>> = Object.fromEntries(
  (Object.keys(SKP_JABATAN_2026) as JabatanSkp[]).map((j) => [
    j,
    [...new Set(SKP_JABATAN_2026[j].flatMap((r) => r.indikator.flatMap(kunciFaktaIndikator)))],
  ])
) as unknown as Record<JabatanSkp, readonly string[]>;
