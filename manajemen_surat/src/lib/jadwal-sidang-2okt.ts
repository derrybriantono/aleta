/**
 * ============================================================================
 * JADWAL SIDANG - PERBAIKAN 2 OKTOBER 2026 (butir 10 dan 12)
 * ============================================================================
 *
 * Fungsi murni untuk Jadwal Sidang dan Hasil Sidang - diuji di
 * src/test/jadwal-sidang-2okt.test.ts.
 *
 * BUTIR 10 - SIDANG YANG SEDANG BERJALAN DAN SKORS
 *
 * "Sedang berjalan" TIDAK dikarang. Sumbernya buku waktu antrian yang sudah
 * dipakai tiga jarak waktu (aplikasi antrian ruang tunggu: disidang = 10 dan
 * jam panggilnya, ditambah rekaman bot): per ruang dan per hari, perkara yang
 * TERAKHIR dipanggil masuk adalah yang sedang disidangkan - persis yang oleh
 * hitungTigaJarak disebut "lama sidang berjalan". Dikecualikan:
 *
 *   - yang sudah SELESAI (hasil sidang tercatat, atau ditandai Selesai di
 *     ALETA / antrian) - ruangnya sudah kosong lagi;
 *   - yang DISKORS dan belum dipanggil lagi sesudah skorsnya.
 *
 * Skors berlaku selama jam panggil terakhirnya masih sama dengan saat
 * diskors. Perkara yang dipanggil lagi - dari ALETA, dari papan panggil, atau
 * dari mesin antrian ruang tunggu - otomatis berjalan lagi; tidak ada dua jam
 * dari dua basis data yang dibandingkan.
 *
 * 2 OKT 2026 MALAM (butir 2 dan 3) - penyempurnaan:
 *
 *   - "sedang berjalan" kini punya TIGA sumber, berurutan menurut kuatnya:
 *       manual         tombol "Tandai sedang berjalan" (tabel ALETA)
 *       antrian-proses "proses sidang" di mesin antrian ruang tunggu (hanya
 *                      bila nilainya disetel - ALETA_ANTRIAN_DISIDANG_PROSES)
 *       panggilan      turunan panggilan terakhir per ruang (bawaan semula)
 *     Satu ruang satu sidang berjalan; sumber yang lebih kuat mengalahkan yang
 *     lebih lemah di ruang yang sama.
 *   - skors tidak lagi dibandingkan dengan SATU jam panggil: tiap perkara punya
 *     daftar PENANDA MULAI (panggilan, proses, tanda manual), dan skors
 *     berlaku selama tidak ada penanda yang lebih baru daripada saat diskors.
 *     Itulah yang membuat skors tetap terlihat sesudah mesin antrian
 *     dikembalikan ke "menunggu", dan berakhir begitu sidangnya dimulai lagi.
 *
 * BUTIR 12 - LEBAR HALAMAN ALETA e-COURT
 *
 * Lihat LEBAR_ECOURT di bawah.
 */
import { hitungTigaJarak, kunciWaktu, type BarisWaktuAntrian } from "@/lib/tiga-jarak-sidang";
import { keadaanSelesai, kunciSelesai, type PetaSelesai } from "@/lib/jadwal-sidang-1okt";
import { sidangSelesaiHariIni } from "@/lib/keadaan-sidang";

// ============================================================================
// SKORS
// ============================================================================

export type CatatanSkors = {
  perkaraId: string;
  tanggalSidang: string;
  nomorPerkara?: string;
  oleh?: string;
  alasan?: string;
  /** panggilTerakhir buku waktu antrian SAAT diskors - "" bila belum pernah dipanggil. */
  panggilSaatSkors?: string;
  diskorsPada?: string;
};

/** Kunci peta = kunciSelesai (perkaraId|tanggal) - sama dengan bot. */
export type PetaSkors = Record<string, CatatanSkors>;

function rapi(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** "YYYY-MM-DD HH:MM" - bentuk waktu yang dapat dibandingkan sebagai teks. */
const BENTUK_WAKTU = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;

/** Penanda sudah ada pada atau sebelum saat diskors? Teks bukan-waktu hanya dibandingkan kesamaannya. */
function penandaSudahAda(penanda: string, saatSkors: string): boolean {
  if (BENTUK_WAKTU.test(penanda) && BENTUK_WAKTU.test(saatSkors)) return penanda <= saatSkors;
  return penanda === saatSkors;
}

/**
 * Skors masih berlaku: ada catatannya DAN sidangnya belum dimulai lagi sesudah
 * diskors - tidak ada PENANDA MULAI (panggilan terakhir, proses sidang di mesin
 * antrian, tanda manual) yang lebih baru daripada saat diskors.
 *
 * `penanda` boleh satu teks (jam panggil terakhir, perilaku semula) atau
 * daftar. Tanpa penanda sama sekali: skors yang dibuat tanpa penanda
 * (panggilSaatSkors kosong) berlaku, dan yang dibuat dengan penanda berbentuk
 * waktu juga tetap berlaku - mesin antrian sudah dikembalikan ke "menunggu",
 * sehingga penanda lamanya hilang, dan tidak ada yang memulai sidangnya lagi.
 */
export function skorsBerlaku(
  catatan: CatatanSkors | null | undefined,
  penanda: string | readonly string[] | null | undefined
): boolean {
  if (!catatan) return false;
  const saat = rapi(catatan.panggilSaatSkors);
  const daftar = (Array.isArray(penanda) ? penanda : [penanda]).map((x) => rapi(x)).filter(Boolean);
  if (daftar.length === 0) return saat === "" || BENTUK_WAKTU.test(saat);
  return daftar.every((m) => penandaSudahAda(m, saat));
}

/** Catatan skors untuk satu baris jadwal, atau null bila tidak ada / tidak berlaku lagi. */
export function skorsUntuk(
  peta: PetaSkors | null | undefined,
  baris: { perkaraId: string; tanggalSidang: string },
  penanda: string | readonly string[] | null | undefined
): CatatanSkors | null {
  const catatan = peta?.[kunciSelesai(baris.perkaraId, baris.tanggalSidang)];
  return catatan && skorsBerlaku(catatan, penanda) ? catatan : null;
}

// ============================================================================
// SIDANG YANG SEDANG BERJALAN
// ============================================================================

/** Dari mana "sedang berjalan" diketahui - lihat kepala berkas. */
export type SumberBerjalan = "manual" | "antrian-proses" | "panggilan";

const KUAT_SUMBER: Record<SumberBerjalan, number> = { panggilan: 1, "antrian-proses": 2, manual: 3 };

export type SidangBerjalan = {
  /** kunciWaktu (tanggal|perkara). */
  kunci: string;
  perkaraId: string;
  tanggalSidang: string;
  /** Sebutan ruang menurut hitungTigaJarak - "Ruang 1", atau ruangan SIPP. */
  ruang: string;
  /** Saat sidangnya dimulai: penanda mulai TERBARU (panggilan, proses mesin, atau tanda manual). */
  sejak: string;
  nomorAntrian: number | null;
  /** Kosong = panggilan (perilaku semula). */
  sumber?: SumberBerjalan;
  /** Siapa yang menandai - hanya sumber manual. */
  oleh?: string;
};

/** Satu tanda "sedang berjalan" manual dari bot (aleta_bot_sidang_berjalan). */
export type CatatanBerjalan = {
  perkaraId: string;
  tanggalSidang: string;
  nomorPerkara?: string;
  ruang?: string;
  oleh?: string;
  /** "YYYY-MM-DD HH:MM:SS" - saat ditandai. */
  ditandaiPada?: string;
};

/** Kunci peta = kunciSelesai (perkaraId|tanggal) - sama dengan bot. */
export type PetaBerjalanManual = Record<string, CatatanBerjalan>;

/** Satu baris yang sedang "proses sidang" menurut mesin antrian ruang tunggu. */
export type ProsesAntrian = {
  perkaraId: string;
  tanggalSidang: string;
  noRuang: number | null;
  /** "YYYY-MM-DD HH:MM:SS" - jam_sidang yang ditulis mesin saat PROSES. */
  sejak: string;
};

/** Bacaan bot di `berjalan` pada GET /sidang/selesai. Bot lama = tidak ada. */
export type DataBerjalan = {
  manual: PetaBerjalanManual;
  proses: ProsesAntrian[];
};

export const DATA_BERJALAN_KOSONG: DataBerjalan = { manual: {}, proses: [] };

export type KeadaanRuangSidang = {
  /** kunciWaktu -> sidang yang sedang berjalan. */
  berjalan: Record<string, SidangBerjalan>;
  /** sebutan ruang -> sidang yang sedang berjalan di ruang itu. */
  perRuang: Record<string, SidangBerjalan>;
  /** kunciWaktu -> sebutan ruang (juga untuk yang belum dipanggil). */
  ruangPerKunci: Record<string, string>;
  /** kunciWaktu -> panggilTerakhir ("" bila belum dipanggil). */
  panggilPerKunci: Record<string, string>;
  /**
   * kunciWaktu -> SEMUA penanda mulai yang diketahui (panggilan, proses mesin,
   * tanda manual). Inilah yang dipakai skorsUntuk di layar - bukan hanya
   * panggilPerKunci.
   */
  penandaPerKunci: Record<string, string[]>;
};

export const RUANG_SIDANG_KOSONG: KeadaanRuangSidang = {
  berjalan: {},
  perRuang: {},
  ruangPerKunci: {},
  panggilPerKunci: {},
  penandaPerKunci: {},
};

/**
 * Sidang yang sedang berjalan di tiap ruang, HARI INI saja.
 *
 * @param opsi.selesai  kunciWaktu -> sudah selesai (hasil sidang ATAU ditandai Selesai)
 * @param opsi.skors    peta skors dari bot (kunciSelesai)
 * @param opsi.berjalan tanda manual + "proses sidang" mesin antrian dari bot
 *                      (bot lama / tidak disetel = tidak ada - perilaku semula)
 */
export function petaSidangBerjalan(
  baris: BarisWaktuAntrian[],
  opsi: {
    hariIni: string;
    selesai?: Record<string, boolean>;
    skors?: PetaSkors | null;
    ruangSipp?: Record<string, string>;
    berjalan?: DataBerjalan | null;
  }
): KeadaanRuangSidang {
  const daftar = Array.isArray(baris) ? baris : [];
  const hariIni = rapi(opsi.hariIni);
  const manual = Object.values(opsi.berjalan?.manual ?? {}).filter((m) => rapi(m.tanggalSidang) === hariIni && rapi(m.perkaraId));
  const proses = (opsi.berjalan?.proses ?? []).filter((p) => rapi(p.tanggalSidang) === hariIni && rapi(p.perkaraId));
  if (!hariIni || (daftar.length === 0 && manual.length === 0 && proses.length === 0)) return RUANG_SIDANG_KOSONG;
  const tiga = hitungTigaJarak(daftar, { hariIni, selesai: opsi.selesai, ruangSipp: opsi.ruangSipp });
  const hasil: KeadaanRuangSidang = { berjalan: {}, perRuang: {}, ruangPerKunci: {}, panggilPerKunci: {}, penandaPerKunci: {} };

  const tandai = (kunci: string, penanda: string) => {
    const m = rapi(penanda);
    if (!m) return;
    (hasil.penandaPerKunci[kunci] ??= []).push(m);
  };
  const terbaru = (kunci: string) => [...(hasil.penandaPerKunci[kunci] ?? [])].sort().pop() ?? "";

  type Calon = SidangBerjalan & { kuat: number };
  const calon: Calon[] = [];
  const barisPerKunci: Record<string, BarisWaktuAntrian> = {};

  // ---- penanda dan ruang dari antrian; calon "panggilan" (perilaku semula) ----
  for (const satu of daftar) {
    const kunci = kunciWaktu(satu.tanggalSidang, satu.perkaraId);
    const t = tiga[kunci];
    if (!t || kunci in hasil.ruangPerKunci) continue;
    barisPerKunci[kunci] = satu;
    hasil.ruangPerKunci[kunci] = t.ruang;
    hasil.panggilPerKunci[kunci] = rapi(satu.panggilTerakhir);
    tandai(kunci, satu.panggilTerakhir);
    if (t.lamaSidang.keadaan !== "berjalan") continue;
    calon.push({
      kunci,
      perkaraId: rapi(satu.perkaraId),
      tanggalSidang: rapi(satu.tanggalSidang),
      ruang: t.ruang,
      sejak: rapi(satu.panggilTerakhir),
      nomorAntrian: typeof satu.nomorAntrian === "number" ? satu.nomorAntrian : null,
      sumber: "panggilan",
      kuat: KUAT_SUMBER.panggilan,
    });
  }

  const ruangBaru = (kunci: string, cadangan: string[]) => {
    const dariAntrian = hasil.ruangPerKunci[kunci];
    if (dariAntrian) return dariAntrian;
    const sipp = rapi(opsi.ruangSipp?.[kunci]);
    const pilih = [...cadangan.map(rapi), sipp, "Ruang sidang"].find(Boolean) as string;
    hasil.ruangPerKunci[kunci] = pilih;
    return pilih;
  };
  const nomorDari = (kunci: string) => {
    const n = barisPerKunci[kunci]?.nomorAntrian;
    return typeof n === "number" ? n : null;
  };

  // ---- "proses sidang" mesin antrian dan tanda manual: penanda + calon ----
  for (const p of proses) {
    const kunci = kunciWaktu(p.tanggalSidang, p.perkaraId);
    tandai(kunci, p.sejak);
    const ruang = ruangBaru(kunci, [p.noRuang ? `Ruang ${p.noRuang}` : ""]);
    calon.push({
      kunci,
      perkaraId: rapi(p.perkaraId),
      tanggalSidang: rapi(p.tanggalSidang),
      ruang,
      sejak: rapi(p.sejak),
      nomorAntrian: nomorDari(kunci),
      sumber: "antrian-proses",
      kuat: KUAT_SUMBER["antrian-proses"],
    });
  }
  for (const m of manual) {
    const kunci = kunciWaktu(m.tanggalSidang, m.perkaraId);
    tandai(kunci, m.ditandaiPada ?? "");
    const ruang = ruangBaru(kunci, [m.ruang ?? ""]);
    calon.push({
      kunci,
      perkaraId: rapi(m.perkaraId),
      tanggalSidang: rapi(m.tanggalSidang),
      ruang,
      sejak: rapi(m.ditandaiPada),
      nomorAntrian: nomorDari(kunci),
      sumber: "manual",
      oleh: rapi(m.oleh) || undefined,
      kuat: KUAT_SUMBER.manual,
    });
  }

  // ---- penyaringan: selesai dan diskors tidak berjalan ----
  const sah = calon.filter((c) => {
    if (opsi.selesai?.[c.kunci]) return false;
    return !skorsUntuk(opsi.skors, c, hasil.penandaPerKunci[c.kunci]);
  });

  // ---- satu ruang satu sidang: sumber lebih kuat mengalahkan yang lemah ----
  // Yang lemah dipasang lebih dulu; yang kuat menggantikannya. "panggilan"
  // boleh berdampingan di satu ruang (perilaku semula); proses/manual tidak -
  // yang TERBARU di ruang itu yang menang.
  const urut = [...sah].sort((a, b) => a.kuat - b.kuat || a.sejak.localeCompare(b.sejak));
  const kuatRuang: Record<string, number> = {};
  for (const c of urut) {
    const sekarang = kuatRuang[c.ruang] ?? 0;
    if (c.kuat > sekarang || (c.kuat === sekarang && c.kuat > KUAT_SUMBER.panggilan)) {
      for (const [k, b] of Object.entries(hasil.berjalan)) if (b.ruang === c.ruang) delete hasil.berjalan[k];
    }
    kuatRuang[c.ruang] = Math.max(sekarang, c.kuat);
    const { kuat: _kuat, ...isi } = c;
    void _kuat;
    // "sejak" = penanda mulai TERBARU perkara ini, supaya skors yang dibuat
    // darinya langsung berlaku (tidak ada penanda yang lebih baru).
    const sejak = terbaru(c.kunci) || isi.sejak;
    const berjalan: SidangBerjalan = { ...isi, sejak };
    hasil.berjalan[c.kunci] = berjalan;
    hasil.perRuang[c.ruang] = berjalan;
  }
  return hasil;
}

// ============================================================================
// AKSI PADA SATU BARIS - SKORS, LOMPAT, LANJUTKAN
// ============================================================================

export type AksiRuangSidang = {
  /** Baris ini sedang berjalan - boleh diskors. */
  skors: boolean;
  /** Ada sidang lain berjalan di ruang yang sama - boleh lompat ke baris ini. */
  lompat: boolean;
  /** Baris ini diskors - boleh dilanjutkan. */
  lanjut: boolean;
  /** Sidang yang akan diskors bila lompat/lanjut ditekan. */
  asal: SidangBerjalan | null;
  /** "Tandai sedang berjalan" - perkara lagi jalan tetapi tidak terdeteksi dari antrian. */
  tandai?: boolean;
  /** "Batalkan tanda" - hanya bila berjalannya dari tanda manual. */
  batalTanda?: boolean;
};

const TANPA_AKSI: AksiRuangSidang = { skors: false, lompat: false, lanjut: false, asal: null, tandai: false, batalTanda: false };

/**
 * Aksi yang ditawarkan pada satu baris.
 *
 * SELESAI YANG SAH TIDAK PERNAH DISENTUH: baris yang hijau (hasil sidang
 * tercatat, atau ditandai Selesai) tidak mendapat satu pun aksi - tidak dapat
 * diskors, tidak dapat dilompati ke sana.
 */
export function aksiRuangSidang(opsi: {
  hijau: boolean;
  /** Sidang baris ini sendiri yang berjalan, bila ya. */
  berjalan: SidangBerjalan | null | undefined;
  /** Catatan skors yang BERLAKU untuk baris ini. */
  skors: CatatanSkors | null | undefined;
  /** Sidang yang sedang berjalan di ruang baris ini (siapa pun). */
  berjalanDiRuang: SidangBerjalan | null | undefined;
  /** Baris ini dapat dipanggil hari ini (punya baris antrian bertanggal hari ini). */
  bisaDipanggil: boolean;
  /** Tanggal baris ini hari ini - tanda manual hanya berlaku untuk sidang hari ini. */
  bisaTandai?: boolean;
}): AksiRuangSidang {
  if (opsi.hijau) return TANPA_AKSI;
  if (opsi.berjalan) {
    return {
      skors: true,
      lompat: false,
      lanjut: false,
      asal: null,
      tandai: false,
      batalTanda: opsi.berjalan.sumber === "manual",
    };
  }
  const asal = opsi.berjalanDiRuang ?? null;
  // Yang diskors dilanjutkan lewat Lanjutkan - tidak ditandai ulang.
  if (opsi.skors) return { ...TANPA_AKSI, lanjut: true, asal: opsi.bisaDipanggil ? asal : null };
  const lompat = Boolean(asal && opsi.bisaDipanggil);
  const tandai = opsi.bisaTandai === true;
  if (lompat || tandai) return { ...TANPA_AKSI, lompat, asal: lompat ? asal : null, tandai };
  return TANPA_AKSI;
}

export type LangkahRuangSidang =
  | { jenis: "skors"; perkaraId: string; tanggalSidang: string; panggilSaatSkors: string }
  | { jenis: "panggil"; perkaraId: string }
  | { jenis: "lanjut"; perkaraId: string; tanggalSidang: string };

/**
 * Urutan langkah lompat / lanjutkan - SATU tempat, dipakai Jadwal Sidang dan
 * Hasil Sidang.
 *
 *   1. skors sidang yang sedang berjalan di ruang itu (bila ada, bukan tujuan)
 *   2. panggil perkara tujuan (jalur panggil antrian yang sudah ada)
 *   3. catat skors tujuan dilanjutkan (bila tujuan sedang diskors)
 *
 * Panggil SEBELUM catat-lanjut: bila panggilannya gagal, tujuan tetap
 * tercatat diskors - tidak ada keadaan "dilanjutkan" yang tidak pernah
 * terjadi. Tanpa bisaDipanggil, lanjutkan hanya mencatat dilanjutkan.
 */
export function rencanaLompat(opsi: {
  asal: SidangBerjalan | null | undefined;
  tujuan: { perkaraId: string; tanggalSidang: string };
  tujuanDiskors: boolean;
  bisaDipanggil: boolean;
}): LangkahRuangSidang[] {
  const langkah: LangkahRuangSidang[] = [];
  const tujuanId = rapi(opsi.tujuan.perkaraId);
  if (opsi.bisaDipanggil && opsi.asal && rapi(opsi.asal.perkaraId) !== tujuanId) {
    langkah.push({
      jenis: "skors",
      perkaraId: rapi(opsi.asal.perkaraId),
      tanggalSidang: rapi(opsi.asal.tanggalSidang),
      panggilSaatSkors: rapi(opsi.asal.sejak),
    });
  }
  if (opsi.bisaDipanggil) langkah.push({ jenis: "panggil", perkaraId: tujuanId });
  if (opsi.tujuanDiskors) langkah.push({ jenis: "lanjut", perkaraId: tujuanId, tanggalSidang: rapi(opsi.tujuan.tanggalSidang) });
  return langkah;
}

/** Kalimat tiap langkah - untuk konfirmasi sebelum dikerjakan. */
export function kalimatLangkah(langkah: LangkahRuangSidang[], nomorPerkara: (perkaraId: string) => string): string[] {
  return langkah.map((l) => {
    const nomor = nomorPerkara(l.perkaraId) || `perkara ${l.perkaraId}`;
    if (l.jenis === "skors") return `Skors ${nomor} - sidangnya BELUM SELESAI dan dapat dilanjutkan nanti.`;
    if (l.jenis === "panggil") return `Panggil ${nomor} masuk ruang sidang (antrian ruang tunggu).`;
    return `Catat skors ${nomor} dilanjutkan.`;
  });
}

/**
 * Peta "sudah selesai" per kunciWaktu - hasil sidang tercatat ATAU ditandai
 * Selesai (ALETA / antrian). Itulah yang tidak boleh "berjalan" dan tidak
 * boleh diskors.
 */
export function selesaiPerKunciWaktu(
  sidang: Array<{
    perkaraId: string;
    tanggalSidang: string;
    sudahPutus?: boolean;
    tanggalPutusan?: string;
    agenda?: string;
    sidangIkrarTalak?: boolean;
    ikrarTercatat?: boolean;
    ditunda?: boolean;
    alasanDitunda?: string;
  }>,
  peta: PetaSelesai | undefined
): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  for (const b of Array.isArray(sidang) ? sidang : []) {
    const k = kunciWaktu(b.tanggalSidang, b.perkaraId);
    hasil[k] = Boolean(hasil[k]) || keadaanSelesai(b, sidangSelesaiHariIni(b), peta).hijau;
  }
  return hasil;
}

/** Jam:menit dari "YYYY-MM-DD HH:MM:SS" atau "HH:MM(:SS)". */
export function jamSingkat(teks: string | null | undefined): string {
  const cocok = /(\d{1,2}):(\d{2})/.exec(String(teks ?? ""));
  return cocok ? `${cocok[1].padStart(2, "0")}:${cocok[2]}` : "";
}

/** Alasan penolakan skors dari bot -> kalimat untuk petugas. */
export function pesanTolakSkors(alasan: string, pesan?: string): string {
  if (pesan) return pesan;
  switch (alasan) {
    case "sudah_selesai_hasil_sidang":
      return "Hasil sidangnya sudah tercatat - sidang ini selesai, tidak dapat diskors.";
    case "sudah_ditandai_selesai":
      return "Sidang ini sudah ditandai Selesai. Batalkan tanda Selesai lebih dulu bila memang belum selesai.";
    case "antrian_sipp_selesai":
      return "Antrian sidang SIPP perkara ini sudah berstatus selesai - tidak diskors.";
    case "sedang_diskors":
      return "Sidang ini sedang diskors - gunakan Lanjutkan, bukan Tandai sedang berjalan.";
    default:
      return alasan || "Skors belum tersimpan.";
  }
}

// ============================================================================
// BUTIR 12 - LEBAR HALAMAN ALETA e-COURT
// ============================================================================

/**
 * Sejak 1.177.0 (J3) seluruh halaman ALETA e-Court melebar hampir sampai tepi
 * jendela (jarak 1,5 rem, paling lebar 2.400 px): pada layar 1920 px lebar
 * isinya 1.872 px. Dikeluhkan 2 Okt 2026: terlalu lebar untuk dibaca.
 *
 * Bawaan baru "nyaman": paling lebar 1.680 px - pada 1920 px menyisakan 120 px
 * di tiap sisi. Di bawah 1.728 px jendela tidak ada bedanya dengan J3; di
 * bawah 1.600 px tidak ada yang berubah sama sekali (fit-to-size tetap).
 *
 * Lebar J3 TIDAK dibuang: tetap dapat dipilih lewat tombol "Lebar penuh" di
 * kaki sidebar, dan pilihannya diingat per peramban.
 */
export type LebarEcourt = "nyaman" | "penuh";

export const LEBAR_ECOURT_MAKS_PX: Record<LebarEcourt, number> = { nyaman: 1680, penuh: 2400 };

/** Jarak ke tepi jendela pada tiap sisi (px) - sama untuk keduanya: 1,5 rem. */
export const JARAK_TEPI_ECOURT_PX = 24;

/** Lebar isi bagan luar portal SEBELUM J3: max-w-[1600px] dikurangi lg:px-6. */
export function lebarSebelumJ3(lebarJendela: number): number {
  return Math.min(lebarJendela, 1600) - 48;
}

/** Lebar isi halaman ALETA e-Court menurut pilihan - rumus kelas Tailwind-nya. */
export function lebarIsiEcourt(lebarJendela: number, pilihan: LebarEcourt): number {
  if (lebarJendela < 1600) return lebarSebelumJ3(lebarJendela);
  return Math.min(lebarJendela - 2 * JARAK_TEPI_ECOURT_PX, LEBAR_ECOURT_MAKS_PX[pilihan]);
}

/** Kelas pembungkus per pilihan - literal supaya Tailwind menemukannya. */
export const KELAS_LEBAR_ECOURT: Record<LebarEcourt, string> = {
  nyaman:
    "min-[1600px]:ml-[calc(50%_-_min(50vw_-_1.5rem,_840px))] min-[1600px]:w-[min(100vw_-_3rem,_1680px)] min-[1600px]:max-w-none",
  penuh:
    "min-[1600px]:ml-[calc(50%_-_min(50vw_-_1.5rem,_1200px))] min-[1600px]:w-[min(100vw_-_3rem,_2400px)] min-[1600px]:max-w-none",
};

export const KUNCI_SIMPAN_LEBAR_ECOURT = "aleta-ecourt-lebar";

export function bacaLebarEcourt(nilai: string | null | undefined): LebarEcourt {
  return nilai === "penuh" ? "penuh" : "nyaman";
}

// ============================================================================
// RINGKASAN RUANG SIDANG - YANG BERJALAN DAN YANG DISKORS (2 Okt 2026 malam)
// ============================================================================

export type DiskorsRingkas = {
  kunci: string;
  perkaraId: string;
  tanggalSidang: string;
  /** Sebutan ruangnya bila diketahui. */
  ruang: string;
  /** Jam diskorsnya, "HH:MM". */
  jam: string;
  oleh: string;
};

/**
 * Perkara yang SEDANG diskors hari ini - bahan ringkasan ruang sidang. Yang
 * sudah selesai (hasil sidang / ditandai Selesai) tidak ikut: skors yang
 * tertinggal di belakangnya bukan lagi sidang yang menunggu dilanjutkan.
 */
export function daftarDiskors(
  sidang: Array<{ perkaraId: string; tanggalSidang: string }>,
  skors: PetaSkors | null | undefined,
  ruang: Pick<KeadaanRuangSidang, "penandaPerKunci" | "ruangPerKunci">,
  selesai?: Record<string, boolean>
): DiskorsRingkas[] {
  const hasil: DiskorsRingkas[] = [];
  const lihat = new Set<string>();
  for (const b of Array.isArray(sidang) ? sidang : []) {
    const kunci = kunciWaktu(b.tanggalSidang, b.perkaraId);
    if (lihat.has(kunci)) continue;
    lihat.add(kunci);
    if (selesai?.[kunci]) continue;
    const catatan = skorsUntuk(skors, b, ruang.penandaPerKunci?.[kunci]);
    if (!catatan) continue;
    hasil.push({
      kunci,
      perkaraId: rapi(b.perkaraId),
      tanggalSidang: rapi(b.tanggalSidang),
      ruang: ruang.ruangPerKunci?.[kunci] ?? "",
      jam: jamSingkat(catatan.diskorsPada),
      oleh: rapi(catatan.oleh),
    });
  }
  return hasil.sort((a, b) => a.jam.localeCompare(b.jam) || a.perkaraId.localeCompare(b.perkaraId, "id", { numeric: true }));
}

/** Kalimat sumber "sedang berjalan" - untuk title lencana dan ringkasan. */
export function kalimatSumberBerjalan(b: Pick<SidangBerjalan, "sumber" | "oleh" | "ruang" | "sejak">): string {
  const jam = jamSingkat(b.sejak);
  const sejak = jam ? ` sejak ${jam}` : "";
  switch (b.sumber) {
    case "manual":
      return `Ditandai sedang berjalan oleh ${b.oleh || "petugas"} di ${b.ruang}${sejak}.`;
    case "antrian-proses":
      return `Berstatus proses sidang di aplikasi antrian ruang tunggu (${b.ruang})${sejak}.`;
    default:
      return `Perkara terakhir yang dipanggil di ${b.ruang}${sejak} dan belum selesai.`;
  }
}
