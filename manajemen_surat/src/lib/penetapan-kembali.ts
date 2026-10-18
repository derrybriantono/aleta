/**
 * ============================================================================
 * PENETAPAN KEMBALI - ATURAN POP-UP JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 * Murni logika, tanpa basis data dan tanpa peramban: dari isian pop-up
 * menjadi ANTREAN TULIS - satu butir per perkara per jenis, berurutan PMH,
 * PPP, PJS, PHS - beserta alasan dan penetap tiap butir.
 *
 * Permintaan pengguna yang dijaga di sini:
 *
 *   - satu perkara atau massal; tiap perkara boleh SEBAGIAN jenis saja
 *     (perkara A hanya PMH, perkara B hanya PPP, ...);
 *   - alasan: satu untuk semua, KECUALI perkara yang ditandai beralasan
 *     sendiri (pilihan di samping nomor perkaranya) - atau tiap perkara
 *     beralasan sendiri bila saklar "sama untuk semua" dimatikan;
 *   - penetap menurut jenis: PMH Ketua/Wakil (dipilih), PPP & PJS Panitera
 *     atau Plh Panitera (dipilih), PHS ketua majelis perkara itu - ketua
 *     majelis BARU bila majelisnya ikut ditetapkan kembali pada antrean yang
 *     sama.
 *
 * Penetap tidak pernah ditulis ke SIPP (keputusan 2 Okt 2026, butir 39); ia
 * hanya ke jejak ALETA. Yang tercatat di SIPP adalah akun SIPP petugas yang
 * menekan tombolnya.
 */

import { menyebutAleta } from "@/lib/tanda-aleta";

export const JENIS_KEMBALI = ["pmh", "ppp", "pjs", "phs"] as const;
export type JenisKembali = (typeof JENIS_KEMBALI)[number];

export const SEBUTAN_KEMBALI: Record<JenisKembali, string> = {
  pmh: "PMH - majelis hakim",
  ppp: "PPP - panitera pengganti",
  pjs: "PJS - juru sita",
  phs: "PHS - hari sidang",
};

/**
 * Pilihan alasan. Ejaannya mengikuti yang sudah ditulis petugas satker di
 * kolom keterangan SIPP ("Cuti Tahunan" 20 baris, "Cuti Alasan Penting" ...),
 * bukan huruf kecil semua.
 */
export const PILIHAN_ALASAN = [
  { kode: "cuti-tahunan", label: "Cuti Tahunan" },
  { kode: "izin-sakit", label: "Izin Sakit" },
  { kode: "cuti-alasan-penting", label: "Cuti Alasan Penting" },
  { kode: "dinas-luar", label: "Perjalanan Dinas Luar" },
  { kode: "lainnya", label: "Lainnya" },
] as const;
export type KodeAlasan = (typeof PILIHAN_ALASAN)[number]["kode"];

export type PilihanAlasan = { kode: KodeAlasan | ""; lainnya: string };

/** Teks alasan yang dituliskan - "" bila belum dipilih/diisi. */
export function teksAlasan(p: PilihanAlasan | null | undefined): string {
  if (!p || !p.kode) return "";
  if (p.kode === "lainnya") return String(p.lainnya || "").replace(/\s+/g, " ").trim();
  return PILIHAN_ALASAN.find((x) => x.kode === p.kode)?.label ?? "";
}

/** Masalah pada teks alasan, sama dengan penjaga bot (alasanBersih). */
export function masalahAlasan(teks: string): string {
  if (!teks) return "alasan belum dipilih";
  if (menyebutAleta(teks)) return "alasan tidak boleh menyebut ALETA (tertulis di SIPP)";
  if (teks.length > 450) return "alasan lebih dari 450 huruf";
  return "";
}

export type Penetap = { username: string; nama: string; sebutan: string };

export type BarisKembali = {
  perkaraId: number;
  nomorPerkara: string;
  /** Jenis yang DICENTANG untuk perkara ini - boleh sebagian. */
  jenis: Partial<Record<JenisKembali, boolean>>;
  /** Ketua, anggota 1, anggota 2, ... (1 = hakim tunggal). */
  hakimId: number[];
  pppId: number;
  pjsId: number;
  tanggalSidang: string;
  jamSidang: string;
  ruanganId: number;
  /** Ditandai beralasan sendiri - pengecualian dari "alasan sama untuk semua". */
  alasanSendiri: boolean;
  alasan: PilihanAlasan;
  /** Ketua majelis yang SEKARANG tercatat (hakim_id + nama). */
  ketuaMajelis: { hakimId: number; nama: string } | null;
};

export type PengaturanKembali = {
  tanggalPenetapan: string;
  alasanSama: boolean;
  alasan: PilihanAlasan;
  /** Penetap PMH (Ketua/Wakil/Plh) dan PPP/PJS (Panitera/Plh) - dipilih di layar. */
  penetap: { pmh: Penetap | null; ppp: Penetap | null; pjs: Penetap | null };
};

export type ButirTulis = {
  kunci: string;
  perkaraId: number;
  nomorPerkara: string;
  jenis: JenisKembali;
  tanggalPenetapan: string;
  alasan: string;
  penetap: Penetap | null;
  hakimId?: number[];
  petugasId?: number;
  tanggalSidang?: string;
  jamSidang?: string;
  ruanganId?: number;
};

export type HasilSusun = { butir: ButirTulis[]; masalah: Array<{ nomorPerkara: string; jenis?: JenisKembali; pesan: string }> };

/** Alasan yang berlaku untuk satu perkara: yang sama untuk semua, kecuali ditandai sendiri. */
export function alasanUntuk(baris: Pick<BarisKembali, "alasanSendiri" | "alasan">, atur: Pick<PengaturanKembali, "alasanSama" | "alasan">): string {
  return atur.alasanSama && !baris.alasanSendiri ? teksAlasan(atur.alasan) : teksAlasan(baris.alasan);
}

/** Jenis yang dicentang, dalam urutan SIPP: PMH, PPP, PJS, PHS. */
export function jenisTerpilih(baris: Pick<BarisKembali, "jenis">): JenisKembali[] {
  return JENIS_KEMBALI.filter((j) => baris.jenis[j] === true);
}

/** Susunan majelis yang diterima borang SIPP: tunggal, atau ketua + 2..4 anggota. */
export function susunanHakimSah(id: number[]): boolean {
  const bersih = id.filter((x) => Number.isFinite(x) && x > 0);
  return bersih.length === id.length && [1, 3, 4, 5].includes(bersih.length) && new Set(bersih).size === bersih.length;
}

/**
 * Penetap PHS: ketua majelis perkara itu. Bila PMH perkara yang sama ikut
 * ditetapkan kembali pada antrean ini, ketuanya adalah hakim PERTAMA susunan
 * baru - dialah yang menjabat ketika PHS ditulis (PHS selalu sesudah PMH).
 */
export function penetapPhs(baris: BarisKembali, namaHakim: (id: number) => string): Penetap | null {
  if (baris.jenis.pmh && baris.hakimId[0] > 0) {
    const id = baris.hakimId[0];
    return { username: "", nama: namaHakim(id) || `hakim ${id}`, sebutan: baris.hakimId.length === 1 ? "Hakim Tunggal" : "Ketua Majelis" };
  }
  if (baris.ketuaMajelis && baris.ketuaMajelis.hakimId > 0) {
    return { username: "", nama: baris.ketuaMajelis.nama, sebutan: "Ketua Majelis" };
  }
  return null;
}

const JAM = /^\d{2}:\d{2}$/;
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dari isian pop-up menjadi antrean tulis. Perkara tanpa jenis yang
 * dicentang DILEWATI (bukan masalah); butir yang tidak lengkap dilaporkan dan
 * tidak masuk antrean - tidak ada yang dikarang.
 */
export function susunAntreanKembali(
  daftar: BarisKembali[],
  atur: PengaturanKembali,
  namaHakim: (id: number) => string = () => ""
): HasilSusun {
  const butir: ButirTulis[] = [];
  const masalah: HasilSusun["masalah"] = [];
  if (!TANGGAL.test(atur.tanggalPenetapan)) {
    masalah.push({ nomorPerkara: "", pesan: "tanggal penetapan belum diisi" });
  }

  for (const baris of daftar) {
    const jenis = jenisTerpilih(baris);
    if (jenis.length === 0) continue;

    const alasan = alasanUntuk(baris, atur);
    const salahAlasan = masalahAlasan(alasan);
    if (salahAlasan) {
      masalah.push({ nomorPerkara: baris.nomorPerkara, pesan: salahAlasan });
      continue;
    }

    for (const j of jenis) {
      const dasar = {
        kunci: `${baris.perkaraId}:${j}`,
        perkaraId: baris.perkaraId,
        nomorPerkara: baris.nomorPerkara,
        jenis: j,
        tanggalPenetapan: atur.tanggalPenetapan,
        alasan,
      };
      if (j === "pmh") {
        if (!susunanHakimSah(baris.hakimId)) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "susunan majelis harus 1 hakim tunggal atau ketua + 2 anggota, tanpa nama ganda" });
          continue;
        }
        if (!atur.penetap.pmh) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "penetap PMH (Ketua/Wakil) belum dipilih" });
          continue;
        }
        butir.push({ ...dasar, penetap: atur.penetap.pmh, hakimId: [...baris.hakimId] });
      } else if (j === "ppp" || j === "pjs") {
        const id = j === "ppp" ? baris.pppId : baris.pjsId;
        if (!(id > 0)) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: j === "ppp" ? "panitera pengganti belum dipilih" : "juru sita belum dipilih" });
          continue;
        }
        const penetap = atur.penetap[j];
        if (!penetap) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: `penetap ${j.toUpperCase()} (Panitera/Plh) belum dipilih` });
          continue;
        }
        butir.push({ ...dasar, penetap, petugasId: id });
      } else {
        if (!TANGGAL.test(baris.tanggalSidang)) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "tanggal sidang baru belum diisi" });
          continue;
        }
        if (!JAM.test(baris.jamSidang)) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "jam sidang harus JJ:MM" });
          continue;
        }
        if (!(baris.ruanganId > 0)) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "ruang sidang belum dipilih" });
          continue;
        }
        if (TANGGAL.test(atur.tanggalPenetapan) && baris.tanggalSidang < atur.tanggalPenetapan) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "tanggal sidang mendahului tanggal penetapan" });
          continue;
        }
        const penetap = penetapPhs(baris, namaHakim);
        if (!penetap) {
          masalah.push({ nomorPerkara: baris.nomorPerkara, jenis: j, pesan: "ketua majelis perkara ini tidak terbaca" });
          continue;
        }
        butir.push({
          ...dasar,
          penetap,
          tanggalSidang: baris.tanggalSidang,
          jamSidang: baris.jamSidang,
          ruanganId: baris.ruanganId,
        });
      }
    }
  }
  return { butir, masalah };
}

/** Badan permintaan POST untuk satu butir. kering BAWAANNYA true. */
export function badanTulis(b: ButirTulis, opsi: { kering?: boolean; akunSipp?: string } = {}) {
  return {
    jenis: b.jenis,
    perkaraId: b.perkaraId,
    tanggalPenetapan: b.tanggalPenetapan,
    alasan: b.alasan,
    pejabatUsername: b.penetap ? [b.penetap.sebutan, b.penetap.nama || b.penetap.username].filter(Boolean).join(": ") : "",
    ...(b.hakimId ? { hakimId: b.hakimId } : {}),
    ...(b.petugasId ? { petugasId: b.petugasId } : {}),
    ...(b.tanggalSidang ? { tanggalSidang: b.tanggalSidang, jamSidang: b.jamSidang, ruanganId: b.ruanganId } : {}),
    ...(opsi.akunSipp ? { akunSipp: opsi.akunSipp } : {}),
    kering: opsi.kering !== false,
  };
}

/** Sidik rencana - pratinjau kedaluwarsa begitu isian berubah. */
export function sidikAntrean(butir: ButirTulis[]): string {
  return JSON.stringify(butir.map((b) => badanTulis(b)));
}

/** Kalimat untuk alasan penolakan bot. */
export function kalimatTolakKembali(alasan: string): string {
  const peta: Record<string, string> = {
    pmh_belum_ada: "PMH pertama belum ada - pakai penetapan biasa, bukan penetapan kembali",
    ppp_belum_ada: "PPP pertama belum ada",
    pjs_belum_ada: "PJS pertama belum ada",
    phs_belum_ada: "PHS pertama belum ada",
    tanggal_kembali_sebelum_penetapan_sebelumnya: "tanggal penetapan kembali mendahului penetapan sebelumnya",
    tanggal_penetapan_masa_depan: "tanggal penetapan melebihi hari ini",
    tanggal_penetapan_hari_libur: "tanggal penetapan jatuh pada hari libur (Sabtu/Minggu, libur nasional, atau cuti bersama)",
    tanggal_sidang_hari_libur: "tanggal sidang jatuh pada hari libur (Sabtu/Minggu, libur nasional, atau cuti bersama)",
    sidang_mendahului_penetapan: "tanggal sidang mendahului tanggal penetapan",
    tanggal_penetapan_sebelum_penunjukan_pp_js: "penetapan hari sidang mendahului penunjukan PP/JS",
    sudah_ada_phs_sesudah_tanggal_ini: "sudah ada penetapan hari sidang sesudah tanggal ini",
    susunan_sama_dengan_sebelumnya: "susunan majelis sama dengan yang sekarang",
    petugas_sama_dengan_sebelumnya: "petugas sama dengan penunjukan sebelumnya",
    susunan_hakim_tidak_sah: "susunan majelis tidak sah",
    hakim_kembar: "nama hakim ganda",
    alasan_kosong: "alasan belum diisi",
    alasan_menyebut_aleta: "alasan tidak boleh menyebut ALETA",
    akun_sipp_tidak_ketemu: "akun SIPP Anda tidak ditemukan di SIPP",
    akun_sipp_ganda: "akun SIPP ganda - pilih salah satu",
    akun_sipp_belum_tertaut: "akun ALETA Anda belum tertaut ke akun SIPP (Manajemen Akun)",
    ruangan_tidak_ketemu: "ruang sidang tidak ditemukan",
    jam_sidang_tidak_sah: "jam sidang tidak sah",
    // Ditulis dalam SATU transaksi sejak uji rilis 9 Okt 2026 - gagal = dibatalkan utuh.
    gagal_menulis: "SIPP menolak salah satu langkah - seluruh penetapan kembali perkara ini dibatalkan, tidak ada yang tertinggal di SIPP",
    gagal_menyimpan: "SIPP tidak dapat menyimpan - seluruh penetapan kembali perkara ini dibatalkan",
    server_sipp_tidak_terhubung: "server SIPP tidak terhubung - tidak ada yang ditulis",
  };
  return peta[alasan] || alasan.replace(/_/g, " ");
}
