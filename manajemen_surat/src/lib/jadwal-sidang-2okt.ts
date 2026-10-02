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

/**
 * Skors masih berlaku: ada catatannya DAN perkaranya belum dipanggil lagi
 * sesudah diskors (jam panggil terakhirnya masih sama).
 */
export function skorsBerlaku(catatan: CatatanSkors | null | undefined, panggilTerakhirSekarang: string | null | undefined): boolean {
  if (!catatan) return false;
  return rapi(catatan.panggilSaatSkors) === rapi(panggilTerakhirSekarang);
}

/** Catatan skors untuk satu baris jadwal, atau null bila tidak ada / tidak berlaku lagi. */
export function skorsUntuk(
  peta: PetaSkors | null | undefined,
  baris: { perkaraId: string; tanggalSidang: string },
  panggilTerakhir: string | null | undefined
): CatatanSkors | null {
  const catatan = peta?.[kunciSelesai(baris.perkaraId, baris.tanggalSidang)];
  return catatan && skorsBerlaku(catatan, panggilTerakhir) ? catatan : null;
}

// ============================================================================
// SIDANG YANG SEDANG BERJALAN
// ============================================================================

export type SidangBerjalan = {
  /** kunciWaktu (tanggal|perkara). */
  kunci: string;
  perkaraId: string;
  tanggalSidang: string;
  /** Sebutan ruang menurut hitungTigaJarak - "Ruang 1", atau ruangan SIPP. */
  ruang: string;
  /** Jam panggil terakhir (mulai sidangnya), apa adanya dari buku waktu. */
  sejak: string;
  nomorAntrian: number | null;
};

export type KeadaanRuangSidang = {
  /** kunciWaktu -> sidang yang sedang berjalan. */
  berjalan: Record<string, SidangBerjalan>;
  /** sebutan ruang -> sidang yang sedang berjalan di ruang itu. */
  perRuang: Record<string, SidangBerjalan>;
  /** kunciWaktu -> sebutan ruang (juga untuk yang belum dipanggil). */
  ruangPerKunci: Record<string, string>;
  /** kunciWaktu -> panggilTerakhir ("" bila belum dipanggil). */
  panggilPerKunci: Record<string, string>;
};

export const RUANG_SIDANG_KOSONG: KeadaanRuangSidang = {
  berjalan: {},
  perRuang: {},
  ruangPerKunci: {},
  panggilPerKunci: {},
};

/**
 * Sidang yang sedang berjalan di tiap ruang, HARI INI saja.
 *
 * @param opsi.selesai  kunciWaktu -> sudah selesai (hasil sidang ATAU ditandai Selesai)
 * @param opsi.skors    peta skors dari bot (kunciSelesai)
 */
export function petaSidangBerjalan(
  baris: BarisWaktuAntrian[],
  opsi: {
    hariIni: string;
    selesai?: Record<string, boolean>;
    skors?: PetaSkors | null;
    ruangSipp?: Record<string, string>;
  }
): KeadaanRuangSidang {
  const daftar = Array.isArray(baris) ? baris : [];
  if (!rapi(opsi.hariIni) || daftar.length === 0) return RUANG_SIDANG_KOSONG;
  const tiga = hitungTigaJarak(daftar, { hariIni: opsi.hariIni, selesai: opsi.selesai, ruangSipp: opsi.ruangSipp });
  const hasil: KeadaanRuangSidang = { berjalan: {}, perRuang: {}, ruangPerKunci: {}, panggilPerKunci: {} };

  for (const satu of daftar) {
    const kunci = kunciWaktu(satu.tanggalSidang, satu.perkaraId);
    const t = tiga[kunci];
    if (!t || kunci in hasil.ruangPerKunci) continue;
    hasil.ruangPerKunci[kunci] = t.ruang;
    hasil.panggilPerKunci[kunci] = rapi(satu.panggilTerakhir);
    if (t.lamaSidang.keadaan !== "berjalan") continue;
    if (opsi.selesai?.[kunci]) continue;
    if (skorsUntuk(opsi.skors, satu, satu.panggilTerakhir)) continue;
    const isi: SidangBerjalan = {
      kunci,
      perkaraId: rapi(satu.perkaraId),
      tanggalSidang: rapi(satu.tanggalSidang),
      ruang: t.ruang,
      sejak: rapi(satu.panggilTerakhir),
      nomorAntrian: typeof satu.nomorAntrian === "number" ? satu.nomorAntrian : null,
    };
    hasil.berjalan[kunci] = isi;
    hasil.perRuang[t.ruang] = isi;
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
};

const TANPA_AKSI: AksiRuangSidang = { skors: false, lompat: false, lanjut: false, asal: null };

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
}): AksiRuangSidang {
  if (opsi.hijau) return TANPA_AKSI;
  if (opsi.berjalan) return { skors: true, lompat: false, lanjut: false, asal: null };
  const asal = opsi.berjalanDiRuang ?? null;
  if (opsi.skors) return { skors: false, lompat: false, lanjut: true, asal: opsi.bisaDipanggil ? asal : null };
  if (asal && opsi.bisaDipanggil) return { skors: false, lompat: true, lanjut: false, asal };
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
