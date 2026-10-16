/**
 * ============================================================================
 * CHECKLIST KONSEPTOR SEMENTARA (F1.6, 17 Okt 2026)
 * ============================================================================
 *
 * "Konseptor sementara" di ALETA = orang yang DITUNJUK TANGAN oleh majelis
 * atau panitera untuk menyusun draf putusan, berlaku sampai SIPP sendiri
 * dapat menyebut konseptornya (jejak tahapan putusan, proses 210, baru lahir
 * sesudah naskahnya disentuh). Lihat drizzle/0046_konseptor_sementara.sql.
 *
 * Checklist ini mengikuti tunjukan itu: langkah-langkah penyusunan draf
 * putusan per perkara, tanda selesai per langkah (siapa dan kapan), dan
 * sambungan ke Blangko ABT by Derry Briantono - isian blangko putusan yang
 * masih kosong membuat langkahnya BELUM selesai, walau dicentang.
 *
 * Aturannya di @/lib (bukan @/server) karena dipakai rute peladen, layar
 * Jadwal Sidang, dan checklist milestone sekaligus - satu aturan, satu
 * tempat. Ekstensi hanya mengirim daftar isian beserta keadaannya; pemetaan
 * isian ke langkah dikerjakan di sini.
 */

export type KodeLangkah =
  | "duduk"
  | "bukti"
  | "saksi"
  | "kesimpulan"
  | "pertimbangan"
  | "amar"
  | "biaya"
  | "koreksi";

export type LangkahKatalog = {
  kode: KodeLangkah;
  judul: string;
  keterangan: string;
  /** false = hanya dapat diselesaikan dengan centang tangan (tidak ada isian blangkonya). */
  dariBlangko: boolean;
};

/** Urutan = urutan menyusun draf putusan. */
export const LANGKAH_KONSEPTOR: readonly LangkahKatalog[] = [
  {
    kode: "duduk",
    judul: "Duduk perkara",
    keterangan: "Isi gugatan/permohonan, jawaban, replik, dan duplik dirangkum.",
    dariBlangko: true,
  },
  { kode: "bukti", judul: "Bukti surat", keterangan: "Daftar bukti surat kedua pihak beserta keterangannya.", dariBlangko: true },
  { kode: "saksi", judul: "Keterangan saksi", keterangan: "Keterangan saksi dari berita acara sidang.", dariBlangko: true },
  { kode: "kesimpulan", judul: "Kesimpulan para pihak", keterangan: "Kesimpulan yang disampaikan pada sidang terakhir.", dariBlangko: true },
  { kode: "pertimbangan", judul: "Pertimbangan hukum", keterangan: "Fakta yang terbukti, alasan, dan dasar hukumnya.", dariBlangko: true },
  { kode: "amar", judul: "Amar putusan", keterangan: "Bunyi amar yang akan dibacakan.", dariBlangko: true },
  { kode: "biaya", judul: "Biaya perkara", keterangan: "Rincian biaya dan siapa yang dibebani.", dariBlangko: true },
  {
    kode: "koreksi",
    judul: "Dikoreksi majelis",
    keterangan: "Draf sudah dibaca dan dikoreksi ketua/anggota majelis.",
    dariBlangko: false,
  },
] as const;

const KODE_SAH = new Set<string>(LANGKAH_KONSEPTOR.map((l) => l.kode));

export function kodeLangkahSah(kode: unknown): kode is KodeLangkah {
  return KODE_SAH.has(String(kode ?? ""));
}

// ============================================================================
// ISIAN BLANGKO -> LANGKAH
// ============================================================================

/** Satu isian blangko sebagaimana dilaporkan Blangko Derry di ABT. */
export type IsianBlangkoLapor = {
  kode?: string;
  nama?: string;
  /** "teks" | "tanggal" | "tj" (tanya jawab saksi). */
  jenis?: string;
  /** "bukti" untuk isian bukti surat. */
  khusus?: string;
  terisi?: boolean;
};

/** Kode variabel ABT yang langkahnya pasti (susun.ts / RAMAH). */
const KODE_KE_LANGKAH: Record<string, KodeLangkah> = {
  "1214": "bukti",
  "9911": "bukti",
  "8436": "kesimpulan",
  "8437": "kesimpulan",
  "8503": "pertimbangan",
  "8729": "pertimbangan",
  "8901": "amar",
  "8902": "amar",
  "5230": "biaya",
  "8712": "biaya",
  "8713": "biaya",
  "8714": "biaya",
};

/**
 * Menempatkan satu isian blangko pada langkahnya.
 *
 * Kode yang dikenal lebih dulu, lalu kata pada namanya. Yang tidak cocok
 * dengan apa pun jatuh ke "duduk perkara" - isian tangan blangko putusan yang
 * tersisa hampir seluruhnya keadaan perkara (awal perselisihan, pisah rumah,
 * anak, kuasa, prodeo) yang memang dirangkum di sana.
 */
export function langkahUntukIsian(isian: IsianBlangkoLapor): KodeLangkah {
  const kode = String(isian.kode ?? "").trim();
  if (KODE_KE_LANGKAH[kode]) return KODE_KE_LANGKAH[kode];
  const nama = String(isian.nama ?? "").toLowerCase();
  if (isian.jenis === "tj") return "saksi";
  if (isian.khusus === "bukti" || /\bbukti\b/.test(nama)) return "bukti";
  if (/kesimpulan/.test(nama)) return "kesimpulan";
  if (/\bamar\b|petitum|diktum/.test(nama)) return "amar";
  if (/biaya|ongkos|panjar/.test(nama)) return "biaya";
  if (/pertimbangan|terbukti|penilaian|dasar hukum|alasan perceraian/.test(nama)) return "pertimbangan";
  if (/saksi/.test(nama)) return "saksi";
  return "duduk";
}

export type BlangkoPerLangkah = Partial<Record<KodeLangkah, { jumlah: number; terisi: number; kosong: string[] }>>;

/** Mengelompokkan laporan isian per langkah (nama kosong dibatasi 8 per langkah). */
export function kelompokkanIsian(isian: IsianBlangkoLapor[]): BlangkoPerLangkah {
  const hasil: BlangkoPerLangkah = {};
  for (const butir of isian) {
    const kode = langkahUntukIsian(butir);
    const satu = (hasil[kode] ??= { jumlah: 0, terisi: 0, kosong: [] });
    satu.jumlah += 1;
    if (butir.terisi) satu.terisi += 1;
    else if (satu.kosong.length < 8) satu.kosong.push(String(butir.nama ?? butir.kode ?? "isian").trim() || "isian");
  }
  return hasil;
}

// ============================================================================
// KEADAAN TIAP LANGKAH
// ============================================================================

export type TandaLangkah = { selesai: boolean; oleh: string; pada: string; catatan: string };

export type LaporBlangko = {
  berkas: string;
  terisi: number;
  jumlah: number;
  perLangkah: BlangkoPerLangkah;
  oleh: string;
  pada: string;
};

export type KeadaanLangkah = {
  kode: KodeLangkah;
  judul: string;
  keterangan: string;
  /** selesai = boleh dianggap rampung; belum = belum dikerjakan; kosong = dicentang/terisi sebagian tetapi blangko masih kosong. */
  status: "selesai" | "belum" | "kosong";
  /** "tangan" = dicentang; "blangko" = semua isian blangkonya terisi; "" = belum ada. */
  sumber: "tangan" | "blangko" | "";
  oleh: string;
  pada: string;
  catatan: string;
  dicentang: boolean;
  blangko: { jumlah: number; terisi: number; kosong: string[] } | null;
};

export type KemajuanKonseptor = {
  langkah: KeadaanLangkah[];
  selesai: number;
  jumlah: number;
  /** Semua langkah selesai: draf siap dibacakan. */
  siap: boolean;
  blangko: Omit<LaporBlangko, "perLangkah"> | null;
};

export type RingkasKemajuan = {
  selesai: number;
  jumlah: number;
  siap: boolean;
  /** Judul langkah yang belum selesai, menurut urutan. */
  belum: string[];
  /** Ada laporan dari Blangko Derry. */
  adaBlangko: boolean;
};

/**
 * Menilai seluruh langkah satu perkara.
 *
 *   isian blangko langkah itu masih ada yang kosong  -> "kosong" (belum selesai,
 *                                                       walau sudah dicentang)
 *   dicentang                                        -> selesai (tangan)
 *   semua isian blangkonya terisi                    -> selesai (blangko)
 *   selain itu                                       -> belum
 *
 * Blangko yang kosong MENGALAHKAN centang: yang dibacakan adalah naskahnya,
 * dan naskah dengan isian kosong belum dapat dibacakan siapa pun yang
 * mencentangnya.
 */
export function nilaiKemajuan(
  tanda: Partial<Record<string, TandaLangkah>>,
  blangko: LaporBlangko | null
): KemajuanKonseptor {
  const langkah: KeadaanLangkah[] = LANGKAH_KONSEPTOR.map((l) => {
    const t = tanda[l.kode];
    const b = l.dariBlangko && blangko ? blangko.perLangkah[l.kode] ?? null : null;
    const dicentang = Boolean(t?.selesai);
    let status: KeadaanLangkah["status"] = "belum";
    let sumber: KeadaanLangkah["sumber"] = "";
    if (b && b.terisi < b.jumlah) status = "kosong";
    else if (dicentang) {
      status = "selesai";
      sumber = "tangan";
    } else if (b && b.jumlah > 0 && b.terisi >= b.jumlah) {
      status = "selesai";
      sumber = "blangko";
    }
    return {
      kode: l.kode,
      judul: l.judul,
      keterangan: l.keterangan,
      status,
      sumber,
      oleh: sumber === "blangko" ? blangko?.oleh ?? "" : t?.oleh ?? "",
      pada: sumber === "blangko" ? blangko?.pada ?? "" : t?.pada ?? "",
      catatan: t?.catatan ?? "",
      dicentang,
      blangko: b ? { jumlah: b.jumlah, terisi: b.terisi, kosong: b.kosong.slice() } : null,
    };
  });
  const selesai = langkah.filter((l) => l.status === "selesai").length;
  return {
    langkah,
    selesai,
    jumlah: langkah.length,
    siap: selesai === langkah.length,
    blangko: blangko
      ? { berkas: blangko.berkas, terisi: blangko.terisi, jumlah: blangko.jumlah, oleh: blangko.oleh, pada: blangko.pada }
      : null,
  };
}

export function ringkasKemajuan(k: KemajuanKonseptor): RingkasKemajuan {
  return {
    selesai: k.selesai,
    jumlah: k.jumlah,
    siap: k.siap,
    belum: k.langkah.filter((l) => l.status !== "selesai").map((l) => l.judul),
    adaBlangko: Boolean(k.blangko),
  };
}

/** Teks lencana kesiapan untuk Hari Putusan dan checklist milestone. */
export function teksKesiapan(r: RingkasKemajuan | null | undefined): string {
  if (!r) return "";
  if (r.siap) return "Draf siap dibacakan";
  return `Draf ${r.selesai}/${r.jumlah} langkah`;
}

/** "17 Okt 08.12" dari ISO; dipakai layar portal dan ekstensi (salinan di ekstensi). */
export function waktuSingkat(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  // WITA (UTC+8) - satker di Sulawesi Tengah; tidak bergantung zona mesin.
  const w = new Date(d.getTime() + 8 * 3600 * 1000);
  const jam = `${String(w.getUTCHours()).padStart(2, "0")}.${String(w.getUTCMinutes()).padStart(2, "0")}`;
  return `${w.getUTCDate()} ${BLN[w.getUTCMonth()]} ${jam}`;
}
