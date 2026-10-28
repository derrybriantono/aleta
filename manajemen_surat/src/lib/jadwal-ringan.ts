/**
 * ============================================================================
 * JADWAL SIDANG: PEMBARUAN RINGAN & PEMBARUAN SETEMPAT (22 Okt 2026)
 * ============================================================================
 *
 * Keluhan pengguna: sidang yang sudah ditunda atau sudah diberi keterangan
 * putus baru terlihat lama sesudahnya.
 *
 * TERUKUR (server, 22 Okt 2026, 25 sidang):
 *   - jadwal PENUH   216-277 ms di bot, 83-96 KB (~40 kueri SIPP)
 *   - satu-satunya jalur yang membawa tunda/putus ke layar: muat ulang penuh
 *     tiap 45 detik (JEDA_MUAT_ULANG_MS) + singgahan portal 4 detik, jadi
 *     terlihat 0-49 detik kemudian (rata-rata ~26 detik); tab yang baru kembali
 *     terlihat menunggu putaran berikutnya lagi;
 *   - sesudah tombol Tunda/Putus di ALETA, baris baru berubah setelah jadwal
 *     penuh selesai dimuat ulang (~0,3-1 detik, tanpa perubahan setempat).
 *
 * JALUR BARU
 *   1. Jalur RINGAN (bot /jadwal-sidang/ringan, 10-12 ms, 15 KB): hanya kolom
 *      yang berubah sepanjang hari - ditunda, hasil/putus, kehadiran, sidang
 *      berikutnya, tanggal putusan - untuk SELURUH daftar dengan empat kueri
 *      berindeks. Ditanyakan tiap 8 detik (hari ini) / 30 detik (tanggal lain)
 *      HANYA saat tab terlihat; berhenti saat tersembunyi, dan langsung segar
 *      saat terlihat lagi. Hasilnya digabung ke baris yang sudah ada.
 *   2. Jalur LENGKAP tetap seperti semula (45 detik, hari ini).
 *   3. Sesudah tombol Tunda/Putus berhasil: baris diperbarui SETEMPAT dari
 *      jawaban penulisan, lalu satu bacaan ringan membenarkannya seketika.
 *
 * Berkas ini murni (tanpa React/jaringan) supaya aturannya dapat diuji.
 */

/** Selang jalur ringan untuk hari ini. */
export const SELANG_RINGAN_HARI_INI_MS = 8_000;
/** Selang jalur ringan untuk tanggal lain yang dibuka (jarang berubah). */
export const SELANG_RINGAN_LAIN_MS = 30_000;
/** Tab kembali terlihat: bila jadwal penuh terakhir lebih tua dari ini, muat penuh sekali. */
export const BATAS_BASI_PENUH_MS = 45_000;
/** Jadwal penuh membatasi 200 baris; di batas itu daftar bisa terpotong. */
export const BATAS_BARIS_PENUH = 200;

/** Kolom yang boleh ditimpa jalur ringan (nama sama dengan baris jadwal penuh). */
export const KOLOM_RINGAN = [
  "tanggalSidang",
  "jamSidang",
  "agenda",
  "ruangan",
  "ditunda",
  "alasanDitunda",
  "sidangIkrarTalak",
  "sidangKeliling",
  "urutanSidang",
  "dihadiriOleh",
  "adaBas",
  "tanggalSidangBerikut",
  "ikrarTercatat",
  "sudahPutus",
  "tanggalPutusan",
  "statusPutusan",
  "tanggalMinutasi",
  "tanggalBht",
  "verstekPutusan",
  "adaBerkasPutusan",
] as const;

export type BarisRingan = { sidangId: string; perkaraId: string } & Record<string, unknown>;

export type JawabanRingan = {
  dari: string;
  sampai: string;
  diperiksaPada: string;
  baris: BarisRingan[];
  /** Kelompok yang gagal dibaca: kolomnya tidak dikirim, jadi nilai lama dibiarkan. */
  terbaca: { putusan: boolean; berikutnya: boolean; ikrar: boolean };
  /** Pembacaan terpotong batas bot: jangan menyimpulkan baris hilang/baru. */
  terpotong: boolean;
};

/** Jawaban rute portal /sidang/ringan -> JawabanRingan; bentuk tak dikenal / bot tak terjangkau = null. */
export function bacaJawabanRingan(data: unknown): JawabanRingan | null {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.available === false || d.ok === false || !Array.isArray(d.baris)) return null;
  const baris: BarisRingan[] = [];
  for (const b of d.baris as Array<Record<string, unknown>>) {
    const sidangId = String(b?.sidangId ?? "").trim();
    if (!sidangId) continue;
    baris.push({ ...b, sidangId, perkaraId: String(b.perkaraId ?? "").trim() });
  }
  const t = (d.terbaca ?? {}) as Record<string, unknown>;
  return {
    dari: String(d.dari ?? ""),
    sampai: String(d.sampai ?? ""),
    diperiksaPada: String(d.diperiksaPada ?? ""),
    baris,
    terbaca: { putusan: t.putusan !== false, berikutnya: t.berikutnya !== false, ikrar: t.ikrar !== false },
    terpotong: d.terpotong === true,
  };
}

export type HasilGabung<T> = {
  sidang: T[];
  /** false = obyek `sidang` yang SAMA dipulangkan (tidak ada yang berubah). */
  berubah: boolean;
  /** Jumlah baris yang kolomnya berubah. */
  jumlahBerubah: number;
  /**
   * Tanda tangan perubahan susunan baris (ada sidang baru / sidang hilang) yang
   * hanya jadwal PENUH dapat menyelesaikan; "" = susunan sama. Pemanggil memuat
   * penuh SEKALI per tanda tangan, bukan tiap tanya.
   */
  perluMuatPenuh: string;
};

function samaNilai(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // null/undefined/"" dianggap sama untuk kolom teks kosong yang belum ada di baris lama.
  const kosong = (x: unknown) => x === undefined || x === null || x === "";
  return kosong(a) && kosong(b);
}

/**
 * Menggabungkan jawaban ringan ke daftar sidang yang sedang tampil. Hanya
 * kolom di KOLOM_RINGAN yang DIKIRIM bot yang ditimpa; baris yang tidak ada di
 * jawaban dibiarkan (daftar bisa tersaring kata cari). Obyek daftar yang sama
 * dipulangkan bila tidak ada yang berubah - layar tidak melukis ulang.
 */
export function gabungRingan<T extends { sidangId: string }>(
  sidang: T[],
  ringan: JawabanRingan,
  opsi: { adaPencarian?: boolean } = {}
): HasilGabung<T> {
  const peta = new Map(ringan.baris.map((b) => [b.sidangId, b]));
  let jumlahBerubah = 0;
  const baru = sidang.map((lama) => {
    const sumber = peta.get(String(lama.sidangId));
    if (!sumber) return lama;
    let salinan: Record<string, unknown> | null = null;
    for (const kolom of KOLOM_RINGAN) {
      if (!(kolom in sumber)) continue;
      const nilai = sumber[kolom];
      if (samaNilai((lama as Record<string, unknown>)[kolom], nilai)) continue;
      salinan ??= { ...(lama as Record<string, unknown>) };
      salinan[kolom] = nilai;
    }
    if (!salinan) return lama;
    jumlahBerubah += 1;
    return salinan as T;
  });

  // Susunan baris: hanya bila bacaan ringan tidak terpotong dan daftar penuh
  // tidak mungkin terpotong batas 200 barisnya.
  let perluMuatPenuh = "";
  if (!ringan.terpotong && sidang.length < BATAS_BARIS_PENUH) {
    const ada = new Set(sidang.map((b) => String(b.sidangId)));
    const hilang = sidang.filter((b) => !peta.has(String(b.sidangId))).map((b) => String(b.sidangId));
    // Dengan kata cari, daftar tampil sengaja lebih sedikit dari seluruh sidang - tambahan bukan perubahan.
    const baruMuncul = opsi.adaPencarian ? [] : ringan.baris.filter((b) => !ada.has(b.sidangId)).map((b) => b.sidangId);
    if (hilang.length > 0 || baruMuncul.length > 0) {
      perluMuatPenuh = `-${hilang.sort().join(",")}|+${baruMuncul.sort().join(",")}`;
    }
  }

  return { sidang: jumlahBerubah > 0 ? baru : sidang, berubah: jumlahBerubah > 0, jumlahBerubah, perluMuatPenuh };
}

// ============================================================================
// PEMBARUAN SETEMPAT SESUDAH TOMBOL TUNDA / PUTUS
// ============================================================================

/** Yang diketahui layar sesaat sesudah penulisan Tunda/Putus berhasil. */
export type HasilTulisRingkas = {
  jalan: "tunda" | "putus";
  /** Penulisan benar-benar masuk ke SIPP (bukan diantrekan / kering). */
  tertulis: boolean;
  /** Kehadiran yang dikirim bersama penulisan (1 semua, 2, 3, 4). */
  dihadiriOleh?: number | null;
  /** Tunda: alasan yang dikirim. */
  alasanTunda?: string;
  /** Tunda: sidang berikutnya dari jawaban bot. */
  sidangBerikutnya?: { tanggal?: string; jam?: string; agenda?: string } | null;
  /** Putus: dari jawaban bot. */
  putusan?: { tanggalPutus?: string; status?: string; verstek?: boolean } | null;
  /** Putus ikrar talak (tanpa status putusan). */
  ikrarDilaksanakan?: boolean;
  /** 28 Okt 2026: hasil sidang ikrar status 2/3 (gugur / rukun kembali) - ikrar TIDAK tercatat diucapkan. */
  hasilSidangIkrar?: string;
  tanggalPutus?: string;
};

/**
 * Baris `sidangId` diperbarui dari jawaban penulisan - SEBELUM bacaan berikut
 * datang. Nilai yang tidak diketahui dari jawaban (mis. teks alasan putus yang
 * disusun bot) dibiarkan; bacaan ringan sesudahnya memberi nilai aslinya.
 */
export function terapkanHasilTulis<T extends { sidangId: string }>(
  sidang: T[],
  sidangId: string,
  hasil: HasilTulisRingkas
): T[] {
  if (!hasil.tertulis) return sidang;
  let ketemu = false;
  const baru = sidang.map((lama) => {
    if (String(lama.sidangId) !== String(sidangId)) return lama;
    ketemu = true;
    const tambah: Record<string, unknown> = {};
    if (hasil.dihadiriOleh !== undefined && hasil.dihadiriOleh !== null) tambah.dihadiriOleh = hasil.dihadiriOleh;
    if (hasil.jalan === "tunda") {
      tambah.ditunda = true;
      if (hasil.alasanTunda) tambah.alasanDitunda = hasil.alasanTunda;
      if (hasil.sidangBerikutnya?.tanggal) tambah.tanggalSidangBerikut = hasil.sidangBerikutnya.tanggal;
    } else {
      const tanggal = hasil.putusan?.tanggalPutus || hasil.tanggalPutus || "";
      tambah.sudahPutus = true;
      if (tanggal) tambah.tanggalPutusan = tanggal.slice(0, 10);
      if (hasil.putusan?.status) tambah.statusPutusan = hasil.putusan.status;
      if (hasil.putusan?.verstek !== undefined) tambah.verstekPutusan = hasil.putusan.verstek;
      if (hasil.ikrarDilaksanakan) tambah.ikrarTercatat = true;
      else if (hasil.hasilSidangIkrar) tambah.alasanDitunda = hasil.hasilSidangIkrar;
    }
    return { ...(lama as Record<string, unknown>), ...tambah } as T;
  });
  return ketemu ? baru : sidang;
}

// ============================================================================
// TANDA "diperbarui hh:mm:ss"
// ============================================================================

const duaAngka = (n: number) => String(n).padStart(2, "0");

/** "14:05:33" dari milidetik (waktu setempat peramban). */
export function jamDiperbarui(ms: number): string {
  const t = new Date(ms);
  return `${duaAngka(t.getHours())}:${duaAngka(t.getMinutes())}:${duaAngka(t.getSeconds())}`;
}

/**
 * Kalimat tanda di bawah tanggal. Jujur: waktu BACAAN terakhir yang berhasil
 * (jalur ringan atau lengkap). Bila sudah lebih dari 60 detik tanpa bacaan
 * berhasil padahal tab terlihat, disebut tertunda - bukan seolah-olah segar.
 */
export function kalimatDiperbarui(terakhirMs: number | null, sekarangMs: number): { teks: string; tertunda: boolean } {
  if (terakhirMs === null) return { teks: "", tertunda: false };
  const tertunda = sekarangMs - terakhirMs > 60_000;
  return { teks: `diperbarui ${jamDiperbarui(terakhirMs)}${tertunda ? " (tertunda)" : ""}`, tertunda };
}
