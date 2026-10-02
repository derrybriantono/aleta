import { sebutanPihakPerkara, type BahanSebutan } from "@/lib/sebutan-pihak";

/**
 * ============================================================================
 * BAWAAN ISIAN TUNDA SIDANG - DISIMPULKAN DARI RIWAYAT SIDANG PERKARANYA
 * ============================================================================
 *
 * Perbaikan 30 September 2026, butir 14. Sampai 2.40.1 borang tunda di Jadwal
 * Sidang berbawaan: alasan KOSONG, agenda KOSONG (atau satu langkah sesudah
 * agenda baku), kehadiran "Pihak tidak hadir", tanggal dua pekan. Panitera
 * sidang mengisi empat hal yang hampir selalu sama untuk belasan sidang tiap
 * pagi - padahal jawabannya dapat dibaca dari sidang-sidang sebelumnya.
 *
 * Aturan pengguna:
 *   - alasan: sidang pertama = Panggil Tergugat/Termohon; lainnya mengikuti
 *     riwayat (sidang pertama tergugat tidak hadir -> berikutnya Pembuktian
 *     Lanjutan Penggugat/Pemohon);
 *   - agenda: sidang pertama = Pemeriksaan Pokok Perkara; hadir keduanya +
 *     mediasi -> Jawaban Tergugat/Termohon;
 *   - tanggal: hadir satu pihak -> dua pekan, hari yang sama;
 *   - kehadiran: bawaan Pihak Pertama saja; pernah hadir keduanya -> semua
 *     hadir; hanya tergugat yang pernah hadir -> pihak kedua saja.
 * Semuanya USULAN yang terlihat di kotaknya dan tetap dapat diganti lewat
 * dropdown - tidak ada yang terkirim diam-diam.
 *
 * Sandi kehadiran SIPP (dihadiri_oleh, dari antrian/php/menu.sidang.php):
 *   1 semua pihak, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada.
 *
 * ============================================================================
 * HASIL UKUR - sipp_donggala, penundaan 1 Jul 2025 s.d. 30 Sep 2026
 * ============================================================================
 *
 * Diukur dengan D:/aleta-dev/kerja/perbaikan-30sep/agen-c/ukur-bawaan-tunda.ts
 * atas setiap sidang ditunda (bukan ikrar talak), memakai HANYA riwayat
 * sebelum sidang itu, lalu dibandingkan dengan yang ditulis petugas.
 * Kategori dibandingkan, bukan kalimat: "Tergugat Tidak Hadir" dan "Panggil
 * Tergugat" satu kategori (memanggil pihak kedua). 1.737 penundaan:
 *
 *   kehadiran                        1.385 / 1.736   79,8%
 *   alasan (bawaan murni)            1.044 / 1.737   60,1%
 *   alasan (kehadiran dipilih benar) 1.206 / 1.737   69,4%
 *   agenda sidang berikutnya           944 / 1.737   54,3%
 *     - di luar sidang pertama         689 / 1.082   63,7%
 *     - sidang pertama                 255 /   655   38,9%  (aturan pengguna
 *       "Pemeriksaan Pokok Perkara"; petugas lebih sering menulis "Panggil
 *       Tergugat" 327 kali - aturan pengguna yang dipakai, dropdown tetap ada)
 *   hadir satu pihak: sidang berikut tepat 14 hari   677 / 952   71,1%
 *                     hari yang sama (kelipatan 7)   853 / 952   89,6%
 *
 * Bawaan LAMA (alasan kosong, kehadiran "tidak hadir") cocok 0% untuk alasan
 * dan hanya pada 1.055 dari 20.109 baris untuk kehadiran.
 */

/** Satu sidang terdahulu (atau sidang ini) dari perkara_jadwal_sidang. */
export type SidangRiwayat = {
  jadwalId: number;
  /** YYYY-MM-DD */
  tanggal: string;
  agenda: string;
  ditunda: boolean;
  alasan: string;
  dihadiriOleh: number | null;
  ikrar: boolean;
};

/** Keadaan mediasi perkara dari perkara_mediasi (baris terakhir). */
export type MediasiRiwayat = {
  /** Ada baris mediasi sama sekali (mediator sudah ditunjuk). */
  ada: boolean;
  /** keputusan_mediasi sudah terisi pada atau sebelum sidang ini. */
  selesai: boolean;
  /** hasil_mediasi berhasil (Y1/Y2) atau tanggal mediasi_berhasil terisi. */
  berhasil: boolean;
} | null;

/** Persetujuan pihak memakai saluran elektronik menurut e-Court: setuju (centang hijau), tidak (x merah), belum (kotak toska). */
export type PersetujuanEcourt = "setuju" | "tidak_setuju" | "belum" | "tidak-diketahui";

/**
 * Email dan persetujuan saluran elektronik para pihak, dari bot (sidangKontakService).
 * SENGAJA tanpa alamat email: yang dibutuhkan aturan hanya ada/tidaknya, dan
 * alamat adalah data pribadi yang tidak perlu sampai ke peramban.
 */
export type KontakPihak = {
  /** e-Court mencatat pihak perkara ini - tanpanya persetujuan tidak diketahui. */
  ecourtTerbaca: boolean;
  /** Mengapa ada yang tidak terbaca - kalimat untuk layar. */
  sebab: string;
  /** Email penggugat/pemohon: SIPP bila ada, kalau tidak e-Court. */
  penggugat: { adaEmail: boolean; sumber: "sipp" | "ecourt" | "" };
  /** Email tergugat/termohon + persetujuannya: dari e-Court. */
  tergugat: { adaEmail: boolean; persetujuan: PersetujuanEcourt };
  /** Kapan e-Court terakhir terbaca untuk perkara ini (YYYY-MM-DD). */
  terakhirTerlihat?: string;
};

/**
 * Satu rencana sidang dari perkara_court_calendar - rencana yang disusun majelis
 * di awal (bukan sidang yang terjadi). Dibaca bot, lihat kalenderPerkara.
 */
export type RencanaKalender = {
  /** YYYY-MM-DD */
  tanggal: string;
  /** "HH:MM" */
  jam?: string;
  agenda?: string;
  keterangan?: string;
};

export type MasukanBawaanTunda = {
  jadwalId: number;
  /** YYYY-MM-DD - tanggal sidang yang ditunda. */
  tanggalSidang: string;
  agenda: string;
  /** Kehadiran yang SUDAH tercatat pada sidang ini (1..4), bila ada. */
  dihadiriOlehSekarang?: number | null;
  ikrar?: boolean;
  /** Seluruh sidang perkara ini, urutan bebas - sidang ini boleh ikut. */
  riwayat: SidangRiwayat[];
  mediasi?: MediasiRiwayat;
  /**
   * Court Calendar perkara ini. undefined/null = tidak terbaca (bot lama atau
   * tabelnya tak terjangkau); [] = terbaca dan memang tidak ada rencana.
   */
  kalender?: readonly RencanaKalender[] | null;
  /**
   * Email dan persetujuan saluran elektronik para pihak (bahan aturan
   * ketidakhadiran). undefined/null = tidak terbaca - aturan lalu jatuh ke
   * "tanpa email", tidak menebak.
   */
  kontak?: KontakPihak | null;
  /** Bahan sebutan para pihak - alur/jenis perkara lebih dulu, lihat sebutan-pihak.ts. */
  sebutan?: BahanSebutan;
};

export type SebabBawaan =
  | "sidang-pertama"
  | "hadir-keduanya-mediasi-berjalan"
  | "hadir-keduanya-belum-mediasi"
  | "hadir-keduanya-sesudah-mediasi"
  | "tergugat-tidak-pernah-hadir"
  | "hanya-tergugat-hadir"
  | "tidak-ada-yang-hadir"
  | "ikrar-talak"
  | "permohonan";

export type BawaanTunda = {
  /** Sidang ke berapa (tanpa sidang ikrar), dihitung dari riwayat. */
  sidangKe: number;
  alasan: string;
  agenda: string;
  /** YYYY-MM-DD */
  tanggal: string;
  /**
   * Dari mana tanggalnya: ketidakhadiran (1 atau 2 minggu), tundaan mediasi
   * (3 minggu), rencana Court Calendar, atau dua pekan sesudah sidang ini.
   */
  sumberTanggal: SumberTanggal;
  /** Rencana Court Calendar ke berapa (1 = sidang pertama menurut rencana); null bila bukan dari kalender. */
  rencanaKe: number | null;
  /** Kalimat pendek untuk layar - "mengikuti Court Calendar: 2026-06-02 (sidang ke-4)". */
  penjelasanTanggal: string;
  /** "09:00" atau "15:00" - lihat jamSidangBerikut. */
  jam: JamSidang;
  /**
   * Bahan tanggal - disimpan supaya tanggal dan jam dapat disusun ulang ketika
   * petugas mengganti alasan atau agenda (tanggalJamUntuk), tanpa membaca ulang.
   */
  dasar: DasarTanggal;
  /** Sandi SIPP 1..4. */
  kehadiran: number;
  /** true bila kehadiran diambil dari yang sudah tercatat di SIPP. */
  kehadiranTercatat: boolean;
  sebab: SebabBawaan;
  /** Kalimat pendek untuk layar: dari mana usulan ini datang. */
  penjelasan: string;
};

export const KEHADIRAN_SEMUA = 1;
export const KEHADIRAN_PERTAMA = 2;
export const KEHADIRAN_KEDUA = 3;
export const KEHADIRAN_TIDAK_ADA = 4;

const KEHADIRAN_SAH = new Set([1, 2, 3, 4]);

function kehadiranSah(n: unknown): n is number {
  return typeof n === "number" && KEHADIRAN_SAH.has(n);
}

function tanggalIso(t: string) {
  return String(t || "").slice(0, 10);
}

export function tambahHari(iso: string, hari: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + hari));
  return t.toISOString().slice(0, 10);
}

/**
 * Tahap acara menurut kalimat agenda - untuk rantai jawab-menjawab. Kalimat
 * agenda di SIPP bebas ("jawaban Termohon", "Duplik Tergugat Rekonvensi",
 * "pembuktian tambahan"), jadi yang dibaca kata kuncinya.
 */
export type TahapAcara =
  | "mediasi"
  | "jawaban"
  | "replik"
  | "duplik"
  | "pembuktian-pertama"
  | "pembuktian-kedua"
  | "kesimpulan"
  | "musyawarah"
  | "lain";

export function tahapAgenda(agenda: string): TahapAcara {
  const t = String(agenda || "").toLowerCase();
  if (/musyawarah|pembacaan putusan|baca putusan|putusan/.test(t)) return "musyawarah";
  if (/kesimpulan/.test(t)) return "kesimpulan";
  if (/duplik/.test(t)) return "duplik";
  if (/replik/.test(t)) return "replik";
  if (/jawab/.test(t)) return "jawaban";
  if (/pembuktian|bukti|saksi/.test(t)) {
    return /tergugat|termohon|pihak kedua/.test(t) ? "pembuktian-kedua" : "pembuktian-pertama";
  }
  if (/mediasi|damai|perdamaian/.test(t)) return "mediasi";
  return "lain";
}

// ============================================================================
// ATURAN BERSAMA - TANGGAL DAN JAM SIDANG BERIKUTNYA (perbaikan 2 Okt 2026 malam)
// ============================================================================
//
// SATU tempat untuk dua layar: tunda dari baris Jadwal Sidang (CatatHasilRingkas)
// dan layar Hasil Sidang penuh (HasilSidang) memanggil fungsi-fungsi di bawah -
// tidak ada salinan aturan di komponen mana pun. Dijaga src/test/
// perbaikan-2okt-malam-jadwal-sidang.test.ts (keduanya diadu atas masukan sama,
// dan komponen tidak boleh punya aturan jam/tanggal sendiri).

export type JamSidang = "09:00" | "15:00";
export const JAM_PAGI: JamSidang = "09:00";
export const JAM_SORE: JamSidang = "15:00";

/**
 * Tahap acara yang disidangkan SORE: jawab-menjawab dan kesimpulan. Pembuktian,
 * musyawarah majelis, pembacaan putusan/penetapan, dan semua yang lain (mediasi,
 * panggilan ulang, ikrar) tetap pagi. Terukur pada Court Calendar sipp_donggala:
 * rencana_jam jawaban/replik/duplik/kesimpulan 15:00, selebihnya 09:00.
 */
const TAHAP_SORE: ReadonlySet<TahapAcara> = new Set<TahapAcara>(["jawaban", "replik", "duplik", "kesimpulan"]);

/** Tundaan mediasi: tanggal sidang berikutnya 3 minggu sesudah sidang ini. */
export const HARI_TUNDA_MEDIASI = 21;

/**
 * Ditunda KARENA mediasi: alasan tundanya menyebut mediasi - "Proses Mediasi"
 * (bawaan bawaanTunda), "Memberi kesempatan mediasi", "mediasi para pihak",
 * termasuk salah ketik ("peroses mediasi", "mediasin"). Akar katanya, seperti
 * mediasi-sidang.ts: tulisan di SIPP bebas. Yang dibaca ALASAN tunda yang sedang
 * diisi - agenda "Mendengarkan Laporan Hasil Mediasi" adalah acara sesudah
 * mediasi, bukan sebab penundaan ini.
 */
export function tundaKarenaMediasi(alasan: string | null | undefined): boolean {
  return /medias/i.test(String(alasan ?? ""));
}

/**
 * Jam bawaan sidang berikutnya.
 *
 * Tundaan mediasi SELALU 09:00 - mendahului aturan sore. Selebihnya menurut
 * AGENDA sidang berikutnya: jawab-menjawab dan kesimpulan 15:00, yang lain 09:00.
 */
export function jamSidangBerikut(agenda: string, alasan?: string | null): JamSidang {
  if (tundaKarenaMediasi(alasan)) return JAM_PAGI;
  return TAHAP_SORE.has(tahapAgenda(agenda)) ? JAM_SORE : JAM_PAGI;
}

export type SumberTanggal = "tidak-hadir" | "mediasi" | "court-calendar" | "dua-pekan";

/** Tunda karena ketidakhadiran: satu pekan bila panggilan elektronik dapat dikirim, dua pekan bila harus manual. */
export const HARI_TUNDA_SATU_PEKAN = 7;
export const HARI_TUNDA_DUA_PEKAN = 14;

/** Bahan tanggal sidang berikutnya - lihat tanggalSidangBerikut. Tidak memuat kehadiran sidang ini: itu parameter tersendiri. */
export type DasarTanggal = {
  tanggalSidang: string;
  /** Kedua pihak PERNAH hadir pada sidang SEBELUM ini (dihadiri_oleh = 1). */
  pernahKeduanyaSebelumnya: boolean;
  /** Permohonan tanpa pihak kedua - Court Calendar dan aturan ketidakhadiran tidak berlaku. */
  voluntair?: boolean;
  /** Sidang ikrar talak - aturan ketidakhadiran tidak berlaku (ikrar memanggil ulang untuk pengucapan). */
  ikrar?: boolean;
  kalender?: readonly RencanaKalender[] | null;
  sudahTerjadwal?: readonly string[];
  kontak?: KontakPihak | null;
  /** Sebutan pihak untuk kalimat ("Penggugat"/"Tergugat", "Pemohon"/"Termohon"). */
  sebutan?: { satu: string; dua: string };
};

export type TanggalBerikut = {
  tanggal: string;
  sumber: SumberTanggal;
  rencanaKe: number | null;
  rencana: RencanaKalender | null;
  penjelasan: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tunda KARENA ketidakhadiran - kehadiran sidang INI (sandi SIPP dihadiri_oleh):
 *
 *   3 pihak kedua saja  -> penggugat/pemohon TIDAK hadir, tergugat hadir:
 *                          1 minggu, tanpa syarat.
 *   2 pihak pertama saja, atau
 *   4 tidak ada yang hadir -> tergugat/termohon TIDAK hadir:
 *     - kedua pihak PERNAH hadir sebelumnya (sudah mediasi + Court Calendar):
 *       1 minggu DENGAN SYARAT tergugat punya email (panggilan elektronik);
 *     - selain itu: 1 minggu bila tergugat punya email DAN persetujuan saluran
 *       elektroniknya setuju (centang hijau e-Court); tidak punya email,
 *       tidak setuju, belum membuat persetujuan, atau data e-Court tidak
 *       terbaca -> 2 minggu (panggilan manual). TIDAK menebak: data yang tak
 *       terbaca diperlakukan sebagai tanpa email, dan sebabnya disebut.
 *
 * Aturan "kedua pihak pernah hadir" (email saja) lebih khusus daripada aturan
 * umum (email + persetujuan): pihak yang sudah pernah menghadiri sidang tidak
 * lagi bergantung pada persetujuan e-Court untuk dipanggil elektronik.
 * Tafsir ini dilaporkan - tertulis di uji.
 */
function tundaKetidakhadiran(opsi: {
  dasar: string;
  kehadiran: number | null | undefined;
  pernahKeduanyaSebelumnya: boolean;
  kontak: KontakPihak | null | undefined;
  satu: string;
  dua: string;
}): TanggalBerikut | null {
  const k = opsi.kehadiran;
  if (k !== KEHADIRAN_PERTAMA && k !== KEHADIRAN_KEDUA && k !== KEHADIRAN_TIDAK_ADA) return null;
  if (!ISO.test(opsi.dasar)) return null;
  const satu = opsi.satu.toLowerCase();
  const dua = opsi.dua.toLowerCase();
  const hasil = (hari: number, penjelasan: string): TanggalBerikut => ({
    tanggal: tambahHari(opsi.dasar, hari),
    sumber: "tidak-hadir",
    rencanaKe: null,
    rencana: null,
    penjelasan,
  });
  const satuPekan = `1 minggu (${HARI_TUNDA_SATU_PEKAN} hari) sesudah sidang ini.`;
  const duaPekan = `2 minggu (${HARI_TUNDA_DUA_PEKAN} hari) sesudah sidang ini.`;

  if (k === KEHADIRAN_KEDUA) return hasil(HARI_TUNDA_SATU_PEKAN, `${satu} tidak hadir, ${dua} hadir: ${satuPekan}`);

  const siapa = k === KEHADIRAN_TIDAK_ADA ? `${satu} dan ${dua} tidak hadir` : `${dua} tidak hadir`;
  const kontak = opsi.kontak;
  const tergugat = kontak?.tergugat;
  // Kontak yang tak terbaca tidak dipercaya walau memuat "ada": tidak menebak.
  const adaEmail = kontak?.ecourtTerbaca === true && Boolean(tergugat?.adaEmail);
  const tidakTerbaca = !kontak
    ? "data e-Court belum dibaca"
    : !kontak.ecourtTerbaca
      ? `data e-Court tidak terbaca${kontak.sebab ? ` (${kontak.sebab})` : ""}`
      : "";

  if (opsi.pernahKeduanyaSebelumnya) {
    if (adaEmail) return hasil(HARI_TUNDA_SATU_PEKAN, `kedua pihak pernah hadir, ${siapa}, ${dua} punya email: ${satuPekan}`);
    return hasil(HARI_TUNDA_DUA_PEKAN, `kedua pihak pernah hadir, ${siapa}, ${tidakTerbaca || `${dua} tidak punya email`}: ${duaPekan}`);
  }

  if (adaEmail && tergugat?.persetujuan === "setuju") {
    return hasil(HARI_TUNDA_SATU_PEKAN, `${siapa}, ${dua} punya email dan setuju e-Court: ${satuPekan}`);
  }
  const sebab =
    tidakTerbaca ||
    (!adaEmail
      ? `${dua} tidak punya email`
      : tergugat?.persetujuan === "tidak_setuju"
        ? `${dua} tidak setuju e-Court`
        : tergugat?.persetujuan === "belum"
          ? `${dua} belum membuat persetujuan e-Court`
          : `persetujuan e-Court ${dua} tidak diketahui`);
  return hasil(HARI_TUNDA_DUA_PEKAN, `${siapa}, ${sebab}: ${duaPekan}`);
}

/**
 * Tanggal sidang berikutnya - empat aturan, berurutan:
 *
 *   1. KETIDAKHADIRAN sidang ini (tundaKetidakhadiran): 1 atau 2 minggu.
 *   2. Ditunda KARENA mediasi (alasan menyebut mediasi): 3 minggu (21 hari).
 *   3. Bila KEDUA pihak pernah hadir (sehingga mediasi dan Court Calendar sudah
 *      ada): rencana majelis - rencana pertama yang tanggalnya sesudah sidang
 *      ini dan belum menjadi sidang di jadwal perkara itu.
 *   4. Selain itu - atau tanpa rencana yang cocok, atau Court Calendar tidak
 *      terbaca - dua pekan, perilaku sebelumnya.
 *
 * Hanya USULAN: tetap dapat diganti, dan hari liburnya diperiksa server.
 */
export function tanggalSidangBerikut(opsi: {
  tanggalSidang: string;
  /** Kehadiran sidang ini (1..4). Tanpa itu aturan ketidakhadiran tidak berlaku. */
  kehadiran?: number | null;
  pernahKeduanyaSebelumnya?: boolean;
  /** Menyebut langsung bahwa kedua pihak pernah hadir (untuk Court Calendar) - bila tidak, diturunkan. */
  keduanyaPernahHadir?: boolean;
  voluntair?: boolean;
  ikrar?: boolean;
  kontak?: KontakPihak | null;
  kalender?: readonly RencanaKalender[] | null;
  /** Tanggal sidang perkara ini yang SUDAH ada di jadwal. */
  sudahTerjadwal?: readonly string[];
  /** Alasan tunda yang sedang diisi - tundaan mediasi mendahului kalender. */
  alasan?: string | null;
  sebutan?: { satu: string; dua: string };
}): TanggalBerikut {
  const dasar = tanggalIso(opsi.tanggalSidang);
  const duaPekan = tambahHari(dasar, 14);

  if (!opsi.voluntair && !opsi.ikrar) {
    const absen = tundaKetidakhadiran({
      dasar,
      kehadiran: opsi.kehadiran,
      pernahKeduanyaSebelumnya: Boolean(opsi.pernahKeduanyaSebelumnya),
      kontak: opsi.kontak,
      satu: opsi.sebutan?.satu ?? "Penggugat",
      dua: opsi.sebutan?.dua ?? "Tergugat",
    });
    if (absen) return absen;
  }

  if (tundaKarenaMediasi(opsi.alasan) && ISO.test(dasar)) {
    return {
      tanggal: tambahHari(dasar, HARI_TUNDA_MEDIASI),
      sumber: "mediasi",
      rencanaKe: null,
      rencana: null,
      penjelasan: `tundaan mediasi: 3 minggu (${HARI_TUNDA_MEDIASI} hari) sesudah sidang ini.`,
    };
  }
  const dua = (alasan: string): TanggalBerikut => ({
    tanggal: duaPekan,
    sumber: "dua-pekan",
    rencanaKe: null,
    rencana: null,
    penjelasan: `${alasan}dua pekan sesudah sidang ini.`,
  });

  const keduanyaPernahHadir =
    opsi.keduanyaPernahHadir ?? (!opsi.voluntair && (opsi.kehadiran === KEHADIRAN_SEMUA || Boolean(opsi.pernahKeduanyaSebelumnya)));
  if (!keduanyaPernahHadir) return dua("");
  if (!Array.isArray(opsi.kalender)) return dua("Court Calendar tidak terbaca, ");
  if (!ISO.test(dasar)) return dua("");

  // Satu tanggal satu rencana (yang pertama): urutan rencana = urutan tanggal.
  const urut: RencanaKalender[] = [];
  for (const r of [...opsi.kalender].sort((a, b) => tanggalIso(a.tanggal).localeCompare(tanggalIso(b.tanggal)))) {
    const t = tanggalIso(r.tanggal);
    if (ISO.test(t) && !urut.some((x) => tanggalIso(x.tanggal) === t)) urut.push({ ...r, tanggal: t });
  }
  if (urut.length === 0) return dua("belum ada rencana Court Calendar, ");

  const terjadwal = new Set((opsi.sudahTerjadwal ?? []).map(tanggalIso));
  const i = urut.findIndex((r) => r.tanggal > dasar && !terjadwal.has(r.tanggal));
  if (i < 0) return dua("tidak ada rencana Court Calendar sesudah sidang ini, ");

  return {
    tanggal: urut[i].tanggal,
    sumber: "court-calendar",
    rencanaKe: i + 1,
    rencana: urut[i],
    penjelasan: `mengikuti Court Calendar: ${urut[i].tanggal} (sidang ke-${i + 1}).`,
  };
}

/**
 * Tanggal DAN jam sidang berikutnya untuk satu pasang alasan + agenda + kehadiran
 * - SATU pintu: dipakai bawaanTunda, dan oleh kedua layar ketika petugas
 * mengganti alasan, agenda, atau kehadiran (tanggal dan jam yang belum disentuh
 * tangan ikut disusun ulang). Prioritas tanggal: ketidakhadiran > tundaan
 * mediasi > Court Calendar > dua pekan. Jam: tundaan mediasi selalu 09:00,
 * selebihnya menurut agenda.
 */
export function tanggalJamUntuk(
  dasar: DasarTanggal,
  alasan: string | null | undefined,
  agenda: string,
  kehadiran?: number | null
): TanggalBerikut & { jam: JamSidang } {
  const t = tanggalSidangBerikut({
    tanggalSidang: dasar.tanggalSidang,
    kehadiran,
    pernahKeduanyaSebelumnya: dasar.pernahKeduanyaSebelumnya,
    voluntair: dasar.voluntair,
    ikrar: dasar.ikrar,
    kontak: dasar.kontak,
    kalender: dasar.kalender,
    sudahTerjadwal: dasar.sudahTerjadwal,
    alasan,
    sebutan: dasar.sebutan,
  });
  return { ...t, jam: jamSidangBerikut(agenda, alasan) };
}

function urutkan(riwayat: SidangRiwayat[]) {
  return [...riwayat].sort((a, b) =>
    tanggalIso(a.tanggal) === tanggalIso(b.tanggal)
      ? a.jadwalId - b.jadwalId
      : tanggalIso(a.tanggal) < tanggalIso(b.tanggal)
        ? -1
        : 1
  );
}

/**
 * Usulan isian tunda untuk satu sidang. Fungsi murni: tidak membaca apa pun
 * selain masukannya, sehingga diuji dengan contoh data sungguhan dan diukur
 * atas seluruh penundaan satker dengan aturan yang SAMA.
 *
 * `kehadiranPilihan` (boleh tidak ada) adalah kehadiran yang dipilih petugas
 * di dropdown - alasan dan agenda yang belum disentuh tangan disusun ulang
 * menurutnya.
 */
export function bawaanTunda(masukan: MasukanBawaanTunda, kehadiranPilihan?: number | null): BawaanTunda {
  const pihak = sebutanPihakPerkara(masukan.sebutan ?? {});
  const satu = pihak.satu;
  const dua = pihak.dua;
  const voluntair = pihak.surat === "permohonan" && pihak.dua === "Termohon" && !adaPihakKedua(masukan);

  const semua = urutkan(masukan.riwayat.filter((r) => r.jadwalId !== masukan.jadwalId));
  const sebelum = semua.filter(
    (r) =>
      tanggalIso(r.tanggal) < tanggalIso(masukan.tanggalSidang) ||
      (tanggalIso(r.tanggal) === tanggalIso(masukan.tanggalSidang) && r.jadwalId < masukan.jadwalId)
  );
  const sebelumBiasa = sebelum.filter((r) => !r.ikrar);
  const sidangKe = sebelumBiasa.length + 1;

  const hadirSebelum = sebelumBiasa.map((r) => r.dihadiriOleh).filter(kehadiranSah);
  const pernahKeduanya = hadirSebelum.includes(KEHADIRAN_SEMUA);
  const pernahPertama = hadirSebelum.includes(KEHADIRAN_PERTAMA);
  const pernahKedua = hadirSebelum.includes(KEHADIRAN_KEDUA);

  // ---- Kehadiran --------------------------------------------------------
  let kehadiran: number;
  let kehadiranTercatat = false;
  if (kehadiranSah(kehadiranPilihan)) {
    kehadiran = kehadiranPilihan;
  } else if (kehadiranSah(masukan.dihadiriOlehSekarang)) {
    kehadiran = masukan.dihadiriOlehSekarang;
    kehadiranTercatat = true;
  } else if (voluntair) {
    // Permohonan tanpa pihak kedua: pilihan "pihak pertama/kedua saja" tidak
    // ditawarkan borangnya, jadi bawaannya pemohon hadir = semua hadir.
    kehadiran = KEHADIRAN_SEMUA;
  } else if (pernahKeduanya) {
    kehadiran = KEHADIRAN_SEMUA;
  } else if (pernahKedua && !pernahPertama) {
    kehadiran = KEHADIRAN_KEDUA;
  } else {
    kehadiran = KEHADIRAN_PERTAMA;
  }

  // Tanggal dan jam sidang berikutnya - aturan bersama (lihat atas). Court
  // Calendar hanya diikuti bila KEDUA pihak pernah hadir; permohonan tanpa
  // pihak kedua tidak punya "kedua belah pihak".
  const dasarTanggal: DasarTanggal = {
    tanggalSidang: masukan.tanggalSidang,
    pernahKeduanyaSebelumnya: pernahKeduanya,
    voluntair,
    ikrar: Boolean(masukan.ikrar),
    kalender: masukan.kalender,
    sudahTerjadwal: semua.map((r) => r.tanggal),
    kontak: masukan.kontak,
    sebutan: { satu, dua },
  };
  const jadi = (alasan: string, agenda: string, sebab: SebabBawaan, penjelasan: string): BawaanTunda => {
    const berikut = tanggalJamUntuk(dasarTanggal, alasan, agenda, kehadiran);
    return {
      sidangKe,
      alasan,
      agenda,
      tanggal: berikut.tanggal,
      sumberTanggal: berikut.sumber,
      rencanaKe: berikut.rencanaKe,
      penjelasanTanggal: berikut.penjelasan,
      jam: berikut.jam,
      dasar: dasarTanggal,
      kehadiran,
      kehadiranTercatat,
      sebab,
      penjelasan,
    };
  };

  // ---- Sidang ikrar talak -------------------------------------------------
  if (masukan.ikrar) {
    return jadi(
      kehadiran === KEHADIRAN_TIDAK_ADA ? `${satu} dan ${dua} tidak hadir` : `${satu} tidak hadir`,
      "SIDANG IKRAR TALAK",
      "ikrar-talak",
      "Sidang ikrar talak - penundaannya memanggil ulang untuk pengucapan ikrar."
    );
  }

  // ---- Permohonan tanpa pihak kedua ---------------------------------------
  if (voluntair) {
    const tahap = tahapAgenda(masukan.agenda);
    const sesudahBukti = tahap === "pembuktian-pertama" || tahap === "pembuktian-kedua" || tahap === "kesimpulan";
    const kalimat =
      tahap === "musyawarah"
        ? "Pembacaan Penetapan"
        : sesudahBukti
          ? "Musyawarah Majelis dan Pembacaan Penetapan"
          : `Pembuktian ${satu}`;
    return jadi(
      kalimat,
      kalimat,
      "permohonan",
      sesudahBukti
        ? "Permohonan tanpa pihak lawan, pembuktian sudah diagendakan - berikutnya penetapan."
        : "Permohonan tanpa pihak lawan - sidang berikutnya pembuktian pemohon."
    );
  }

  const keduanyaHadir = kehadiran === KEHADIRAN_SEMUA || pernahKeduanya;
  const mediasi = masukan.mediasi ?? null;

  // ---- Tidak ada yang hadir ------------------------------------------------
  if (kehadiran === KEHADIRAN_TIDAK_ADA) {
    return jadi(
      `Panggil ${satu} dan ${dua}`,
      `Panggil ${satu} dan ${dua}`,
      "tidak-ada-yang-hadir",
      "Tidak ada pihak yang hadir - kedua pihak dipanggil ulang."
    );
  }

  // ---- Hanya pihak kedua yang hadir ----------------------------------------
  if (kehadiran === KEHADIRAN_KEDUA && !keduanyaHadir) {
    return jadi(
      `Panggil ${satu}`,
      sidangKe === 1 ? "Pemeriksaan Pokok Perkara" : `Panggil ${satu}`,
      "hanya-tergugat-hadir",
      `Hanya ${dua} yang hadir - ${satu} dipanggil ulang.`
    );
  }

  // ---- Keduanya hadir: mediasi, lalu jawab-menjawab ------------------------
  if (keduanyaHadir) {
    if (!mediasi || !mediasi.ada) {
      return jadi(
        "Proses Mediasi",
        "Mendengarkan Laporan Hasil Mediasi",
        "hadir-keduanya-belum-mediasi",
        "Kedua pihak hadir dan mediasinya belum tercatat - sidang ditunda untuk mediasi."
      );
    }
    if (!mediasi.selesai) {
      // Terukur: 91 dari 92 penundaan pada mediasi yang masih berjalan
      // beragenda berikut mediasi/laporan mediasi, bukan jawaban. "Jawaban"
      // baru datang sesudah mediasinya diputus - cabang di bawah.
      return jadi(
        "Proses Mediasi",
        "Mendengarkan Laporan Hasil Mediasi",
        "hadir-keduanya-mediasi-berjalan",
        `Kedua pihak hadir, mediasi masih berjalan - sesudahnya jawaban ${dua}.`
      );
    }
    const berikut = langkahSesudah(tahapAgenda(masukan.agenda), satu, dua);
    return jadi(
      berikut,
      berikut,
      "hadir-keduanya-sesudah-mediasi",
      `Kedua pihak pernah hadir dan mediasi selesai - satu langkah sesudah agenda "${masukan.agenda || "-"}".`
    );
  }

  // ---- Pihak kedua tidak pernah hadir --------------------------------------
  if (sidangKe === 1) {
    return jadi(
      `Panggil ${dua}`,
      "Pemeriksaan Pokok Perkara",
      "sidang-pertama",
      `Sidang pertama, ${dua} tidak hadir - ${dua} dipanggil sekali lagi.`
    );
  }
  // Sidang KEDUA yang pihak keduanya masih belum pernah hadir: panggilan
  // kedua, sama bunyinya dengan sidang pertama. Aturan pengguna menyebut
  // "sidang pertama tergugat tidak hadir -> sidang KETIGA Pembuktian
  // Lanjutan", dan datanya setuju: pada sidang ke-2 petugas menulis
  // "Panggil/Tergugat tidak hadir" 100 kali lawan pembuktian 38 kali.
  if (sidangKe === 2) {
    return jadi(
      `Panggil ${dua}`,
      `Pembuktian ${satu}`,
      "tergugat-tidak-pernah-hadir",
      `${dua} belum pernah hadir - dipanggil sekali lagi sebelum pembuktian ${satu}.`
    );
  }
  return jadi(
    `Pembuktian Lanjutan ${satu}`,
    `Pembuktian Lanjutan ${satu}`,
    "tergugat-tidak-pernah-hadir",
    `${dua} tidak pernah hadir sejak sidang pertama - pemeriksaan berlanjut ke pembuktian ${satu}.`
  );
}

/** Perkara yang punya pihak kedua - gugatan, atau permohonan kontensius (cerai talak). */
function adaPihakKedua(masukan: MasukanBawaanTunda) {
  const nomor = String(masukan.sebutan?.nomorPerkara || "");
  if (/\/Pdt\.G\//i.test(nomor)) return true;
  const hadir = masukan.riwayat.map((r) => r.dihadiriOleh);
  return hadir.includes(KEHADIRAN_PERTAMA) || hadir.includes(KEHADIRAN_KEDUA);
}

/** Rantai acara sesudah mediasi gagal. */
function langkahSesudah(tahap: TahapAcara, satu: string, dua: string) {
  switch (tahap) {
    case "jawaban":
      return `Replik ${satu}`;
    case "replik":
      return `Duplik ${dua}`;
    case "duplik":
      return `Pembuktian ${satu}`;
    case "pembuktian-pertama":
      return `Pembuktian ${dua}`;
    case "pembuktian-kedua":
      return "Kesimpulan";
    case "kesimpulan":
      return "Musyawarah Majelis";
    case "musyawarah":
      return "Pembacaan Putusan";
    default:
      return `Jawaban ${dua}`;
  }
}

/**
 * Pilihan dropdown alasan dan agenda untuk satu perkara - kalimat aturan di
 * atas dengan sebutan para pihak perkaranya, lalu daftar lazim layar lama
 * (tidak ada pilihan lama yang hilang). Tanpa kembar (huruf besar-kecil).
 */
export function pilihanTunda(
  sebutan: BahanSebutan = {},
  alasanLazim: readonly string[] = [],
  agendaLazim: readonly string[] = []
): { alasan: string[]; agenda: string[] } {
  const { satu, dua } = sebutanPihakPerkara(sebutan);
  const unik = (daftar: string[]) => {
    const lihat = new Set<string>();
    return daftar.filter((x) => {
      const k = x.trim().toLowerCase();
      if (!k || lihat.has(k)) return false;
      lihat.add(k);
      return true;
    });
  };
  const alasan = unik([
    `Panggil ${dua}`,
    `${dua} tidak hadir`,
    `Panggil ${satu}`,
    `Panggil ${satu} dan ${dua}`,
    `${satu} tidak hadir`,
    `${satu} dan ${dua} tidak hadir`,
    "Proses Mediasi",
    `Jawaban ${dua}`,
    `Replik ${satu}`,
    `Duplik ${dua}`,
    `Pembuktian ${satu}`,
    `Pembuktian Lanjutan ${satu}`,
    `Pembuktian ${dua}`,
    "Kesimpulan",
    "Musyawarah Majelis",
    "Musyawarah Majelis dan Pembacaan Penetapan",
    ...alasanLazim,
  ]);
  const agenda = unik([
    "Pemeriksaan Pokok Perkara",
    "Mendengarkan Laporan Hasil Mediasi",
    `Jawaban ${dua}`,
    `Replik ${satu}`,
    `Duplik ${dua}`,
    `Pembuktian ${satu}`,
    `Pembuktian Lanjutan ${satu}`,
    `Pembuktian ${dua}`,
    "Kesimpulan",
    "Musyawarah Majelis",
    "Pembacaan Putusan",
    "Musyawarah Majelis dan Pembacaan Penetapan",
    "Pembacaan Penetapan",
    `Panggil ${dua}`,
    `Panggil ${satu}`,
    `Panggil ${satu} dan ${dua}`,
    "SIDANG IKRAR TALAK",
    ...agendaLazim,
  ]);
  return { alasan, agenda };
}

// ============================================================================
// DARI KEADAAN SIDANG + RIWAYAT KE USULAN - SATU JALAN UNTUK KEDUA LAYAR
// ============================================================================

/** Bagian keadaan sidang (dari bot) yang dibutuhkan usulan tunda. */
export type KeadaanTundaMin = {
  jadwalId: number | string;
  nomorPerkara: string;
  tanggalSidang: string;
  agenda: string;
  dihadiriOleh?: number | string | null;
  ikrarTalak?: string | null;
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  jenisPerkara?: string | null;
};

/** Riwayat sidang + mediasi perkara dari bot, plus Court Calendar bila terbaca. */
export type RiwayatTundaMin = {
  sidang: SidangRiwayat[];
  mediasi: MediasiRiwayat;
  kalender?: readonly RencanaKalender[] | null;
  /** Email + persetujuan e-Court (tanpa alamat) - lihat KontakPihak; tak terbaca = tidak ada. */
  kontak?: KontakPihak | null;
};

/** Bahan sebutan para pihak dari keadaan sidang - nomor lebih dulu dari kata, lihat sebutan-pihak.ts. */
export function sebutanDariKeadaan(keadaan: KeadaanTundaMin): BahanSebutan {
  return {
    alurPerkaraId: keadaan.alurPerkaraId ?? null,
    jenisPerkaraId: keadaan.jenisPerkaraId ?? null,
    jenisPerkaraNama: keadaan.jenisPerkara ?? null,
    nomorPerkara: keadaan.nomorPerkara,
  };
}

export function masukanBawaanTunda(keadaan: KeadaanTundaMin, riwayat: RiwayatTundaMin): MasukanBawaanTunda {
  const hadir = Number(keadaan.dihadiriOleh);
  return {
    jadwalId: Number(keadaan.jadwalId),
    tanggalSidang: String(keadaan.tanggalSidang || "").slice(0, 10),
    agenda: String(keadaan.agenda || ""),
    dihadiriOlehSekarang: hadir >= 1 && hadir <= 4 ? hadir : null,
    ikrar: String(keadaan.ikrarTalak || "").toUpperCase() === "Y",
    riwayat: Array.isArray(riwayat.sidang) ? riwayat.sidang : [],
    mediasi: riwayat.mediasi ?? null,
    kalender: Array.isArray(riwayat.kalender) ? riwayat.kalender : null,
    kontak: riwayat.kontak ?? null,
    sebutan: sebutanDariKeadaan(keadaan),
  };
}

/**
 * Usulan isian tunda dari riwayat sidang perkaranya. null bila riwayatnya tidak
 * terkirim (bot lama) - borangnya lalu memakai bawaan lama, bukan menebak
 * "sidang pertama" dari riwayat kosong. SATU-SATUNYA pintu usulan: dipakai
 * baris Jadwal Sidang dan layar Hasil Sidang.
 */
export function usulanTundaSidang(
  keadaan: KeadaanTundaMin,
  riwayat: RiwayatTundaMin | null | undefined,
  kehadiranPilihan?: number | null
): BawaanTunda | null {
  if (!riwayat || !Array.isArray(riwayat.sidang)) return null;
  return bawaanTunda(masukanBawaanTunda(keadaan, riwayat), kehadiranPilihan);
}

/**
 * Bahan tanggal minimal bila riwayat sidang tidak terkirim (bot lama): tidak
 * ada kalender dan kehadiran tidak diketahui - hanya tundaan mediasi (3 minggu)
 * dan dua pekan yang berlaku.
 */
export function dasarTanggalKosong(tanggalSidang: string): DasarTanggal {
  return { tanggalSidang, pernahKeduanyaSebelumnya: false, kalender: null, sudahTerjadwal: [], kontak: null };
}
