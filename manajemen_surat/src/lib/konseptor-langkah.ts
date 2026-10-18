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
 * Keputusan 17 Okt 2026 (butir 35, 36, 38):
 *   - langkah "Putusan sela", "Eksepsi", "Rekonvensi" BERSYARAT - hanya muncul
 *     bila perkaranya memilikinya (keadaan dari SIPP/arsip e-Court ALETA lewat
 *     bot konseptorKeadaanService) atau sudah pernah dicentang;
 *   - "Dikoreksi majelis" hanya boleh dicentang ketua/anggota majelis perkara
 *     itu (bukan PP) - bolehKoreksiMajelis, dijaga rute;
 *   - checklist juga untuk perkara yang konseptornya sudah tercatat di SIPP
 *     tanpa tunjukan sementara (rute konseptor-sementara, Rincian).
 *
 * Aturannya di @/lib (bukan @/server) karena dipakai rute peladen, layar
 * Jadwal Sidang, dan checklist milestone sekaligus - satu aturan, satu
 * tempat. Ekstensi hanya mengirim daftar isian beserta keadaannya; pemetaan
 * isian ke langkah dikerjakan di sini.
 */

import { namaCocokSatu } from "@/lib/perkara-sendiri";

export type KodeLangkah =
  | "duduk"
  | "bukti"
  | "saksi"
  | "kesimpulan"
  | "sela"
  | "eksepsi"
  | "pertimbangan"
  | "rekonvensi"
  | "amar"
  | "biaya"
  | "koreksi";

/** Keadaan perkara yang memunculkan langkah bersyarat (butir 35). */
export type SyaratLangkah = "sela" | "eksepsi" | "rekonvensi";
export type KeadaanPerkara = Partial<Record<SyaratLangkah, boolean>>;

export type LangkahKatalog = {
  kode: KodeLangkah;
  judul: string;
  keterangan: string;
  /** false = hanya dapat diselesaikan dengan centang tangan (tidak ada isian blangkonya). */
  dariBlangko: boolean;
  /** Langkah BERSYARAT: hanya tampil bila perkaranya memiliki keadaan ini (atau sudah pernah dicentang). */
  syarat?: SyaratLangkah;
  /** Hanya ketua/anggota majelis yang boleh mencentang (butir 36). */
  hanyaMajelis?: boolean;
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
  {
    kode: "sela",
    judul: "Putusan sela",
    keterangan: "Putusan sela yang sudah dibacakan disebut dan dirujuk dalam draf putusan akhir.",
    dariBlangko: false,
    syarat: "sela",
  },
  {
    kode: "eksepsi",
    judul: "Eksepsi",
    keterangan: "Pertimbangan dan amar dalam eksepsi Tergugat/Termohon, sebelum pokok perkara.",
    dariBlangko: true,
    syarat: "eksepsi",
  },
  { kode: "pertimbangan", judul: "Pertimbangan hukum", keterangan: "Fakta yang terbukti, alasan, dan dasar hukumnya.", dariBlangko: true },
  {
    kode: "rekonvensi",
    judul: "Rekonvensi",
    keterangan: "Gugatan balik: duduk perkara, pertimbangan, dan amar dalam rekonvensi.",
    dariBlangko: true,
    syarat: "rekonvensi",
  },
  { kode: "amar", judul: "Amar putusan", keterangan: "Bunyi amar yang akan dibacakan.", dariBlangko: true },
  { kode: "biaya", judul: "Biaya perkara", keterangan: "Rincian biaya dan siapa yang dibebani.", dariBlangko: true },
  {
    kode: "koreksi",
    judul: "Dikoreksi majelis",
    keterangan: "Draf sudah dibaca dan dikoreksi ketua/anggota majelis. Hanya majelis yang dapat mencentang.",
    dariBlangko: false,
    hanyaMajelis: true,
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
  // I8 17 Okt: penilaian jawaban & bukti T pada putusan cerai ditolak kontradiktoir [03a] - bagian pertimbangan hukum.
  "9501": "pertimbangan",
  // I15 18 Okt: penguasaan anak - keadaan penguasaan anak saat ini (9590) dan tempat tinggal anak senyatanya (9592; kewenangan relatif SEMA 2/2024).
  "9590": "pertimbangan",
  "9592": "pertimbangan",
  // I20 18 Okt: saklar penyerahan anak (9720: amar menyerahkan anak) dan alasan petitum selebihnya ditolak (9726) pada penguasaan anak 6b.
  "9720": "amar",
  "9726": "pertimbangan",
  // I23 18 Okt: nafkah anak (6c; 9751-9759 otomatis): jumlah per bulan, kenaikan, biaya pendidikan/kesehatan, sita, pemotongan penghasilan, nafkah lampau = amar;
  // dasar kemampuan, fakta asuhan, kedudukan pengasuh, alasan petitum ditolak = pertimbangan.
  "9740": "amar",
  "9741": "amar",
  "9742": "amar",
  "9743": "amar",
  "9744": "pertimbangan",
  "9745": "amar",
  "9746": "amar",
  "9747": "amar",
  "9748": "pertimbangan",
  "9749": "pertimbangan",
  "9750": "pertimbangan",
  // F22 17 Okt: alasan pencegahan (huruf), fakta terbukti, pertimbangan tolak; pokok tuntutan wasiat (huruf), fakta, pertimbangan tolak, kurang pihak; arbitrase ES.
  "9463": "pertimbangan",
  "9466": "pertimbangan",
  "9467": "pertimbangan",
  "9475": "pertimbangan",
  "9482": "pertimbangan",
  "9483": "pertimbangan",
  "9485": "pertimbangan",
  "9490": "pertimbangan",
  "9491": "pertimbangan",
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
  // Butir 35: isian dalam eksepsi/rekonvensi ke langkahnya sendiri. Bila
  // perkaranya ternyata tanpa keadaan itu, nilaiKemajuan melipatnya ke
  // Pertimbangan hukum - isiannya tetap dihitung.
  if (/eksepsi|exceptie/.test(nama)) return "eksepsi";
  if (/rekonvensi|rekonpensi|gugatan balik/.test(nama)) return "rekonvensi";
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
  /** Langkah bersyarat: keadaan yang memunculkannya; "" = langkah tetap. */
  syarat: SyaratLangkah | "";
  /** Hanya ketua/anggota majelis yang boleh mencentang. */
  hanyaMajelis: boolean;
};

export type KemajuanKonseptor = {
  langkah: KeadaanLangkah[];
  selesai: number;
  jumlah: number;
  /** Semua langkah selesai: draf siap dibacakan. */
  siap: boolean;
  blangko: Omit<LaporBlangko, "perLangkah"> | null;
  /** Keadaan perkara yang dipakai (null = tidak terbaca - langkah bersyarat hanya yang sudah dicentang). */
  keadaan: KeadaanPerkara | null;
  /** Akun yang meminta boleh mencentang "Dikoreksi majelis"? null = tidak dinilai. */
  hakKoreksi: boolean | null;
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
/**
 * Langkah yang berlaku untuk satu perkara: langkah tetap, ditambah langkah
 * bersyarat yang keadaannya ada ATAU yang sedang dicentang (centang tidak
 * boleh hilang hanya karena bacaan keadaannya gagal; centang yang DICABUT
 * tidak menahan langkah itu - audit 17 Okt). Murni.
 */
export function langkahBerlaku(tanda: Partial<Record<string, TandaLangkah>>, keadaan: KeadaanPerkara | null | undefined): LangkahKatalog[] {
  return LANGKAH_KONSEPTOR.filter((l) => !l.syarat || keadaan?.[l.syarat] === true || tanda[l.kode]?.selesai === true);
}

/** Laporan blangko per langkah, dengan langkah bersyarat yang TIDAK berlaku dilipat ke Pertimbangan hukum. Murni. */
function lipatBlangko(per: BlangkoPerLangkah, berlaku: Set<KodeLangkah>): BlangkoPerLangkah {
  const hasil: BlangkoPerLangkah = {};
  for (const [kode, v] of Object.entries(per) as Array<[KodeLangkah, { jumlah: number; terisi: number; kosong: string[] }]>) {
    if (!v) continue;
    const ke: KodeLangkah = berlaku.has(kode) ? kode : "pertimbangan";
    const satu = (hasil[ke] ??= { jumlah: 0, terisi: 0, kosong: [] });
    satu.jumlah += v.jumlah;
    satu.terisi += v.terisi;
    for (const n of v.kosong) if (satu.kosong.length < 8) satu.kosong.push(n);
  }
  return hasil;
}

export function nilaiKemajuan(
  tanda: Partial<Record<string, TandaLangkah>>,
  blangko: LaporBlangko | null,
  keadaan: KeadaanPerkara | null = null,
  hakKoreksi: boolean | null = null
): KemajuanKonseptor {
  const daftar = langkahBerlaku(tanda, keadaan);
  const perLangkah = blangko ? lipatBlangko(blangko.perLangkah, new Set(daftar.map((l) => l.kode))) : null;
  const langkah: KeadaanLangkah[] = daftar.map((l) => {
    const t = tanda[l.kode];
    const b = l.dariBlangko && perLangkah ? perLangkah[l.kode] ?? null : null;
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
      syarat: l.syarat ?? "",
      hanyaMajelis: Boolean(l.hanyaMajelis),
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
    keadaan: keadaan ? { ...keadaan } : null,
    hakKoreksi,
  };
}

/**
 * Boleh mencentang "Dikoreksi majelis" (butir 36)? Murni.
 *   Admin/Super Admin           boleh (pengelola satker)
 *   bukan hakim/Ketua/Wakil      TIDAK - panitera pengganti menyusun draf, majelis yang mengoreksi
 *   hakim, majelis terbaca      hanya bila namanya ada di majelis AKTIF perkara itu
 *   hakim, majelis tak terbaca  boleh (perannya hakim; SIPP sedang tidak terbaca)
 */
export function bolehKoreksiMajelis(p: { admin: boolean; hakim: boolean; namaAkun: string; majelis: string[] | null | undefined }): {
  boleh: boolean;
  alasan: string;
} {
  if (p.admin) return { boleh: true, alasan: "" };
  if (!p.hakim) {
    return { boleh: false, alasan: "\"Dikoreksi majelis\" hanya dapat dicentang ketua atau anggota majelis - bukan panitera pengganti." };
  }
  const majelis = Array.isArray(p.majelis) ? p.majelis.filter(Boolean) : [];
  if (majelis.length && !majelis.some((n) => namaCocokSatu(p.namaAkun, n))) {
    return { boleh: false, alasan: "\"Dikoreksi majelis\" hanya dapat dicentang ketua atau anggota majelis perkara ini." };
  }
  return { boleh: true, alasan: "" };
}

export function ringkasKemajuan(k: KemajuanKonseptor): RingkasKemajuan {
  // (selesai/jumlah ikut langkah yang berlaku - bersyarat yang tidak berlaku tidak dihitung)
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
