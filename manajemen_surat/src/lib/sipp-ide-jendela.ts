import { kehadiranDariAntrian, type AntrianSidangRingkas } from "@/lib/antrian-hasil-sidang";
import {
  usulanTundaSidang,
  type KeadaanTundaMin,
  type KontakPihak,
  type RencanaKalender,
  type RiwayatTundaMin,
} from "@/lib/bawaan-tunda";
import { ccBukanHariKerja, ccIsoSah, ccMajuHariKerja } from "@/lib/court-calendar-susun";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA GELOMBANG 2 (TAHAP M1, 16 Okt 2026) - BAHAN JENDELA
 * ============================================================================
 *
 * Bahan usulan untuk jendela SIPP yang dibantu ekstensi (sipp-ide-m1.js):
 * Edit/Tunda Jadwal, Relaas, Putusan Sela, Rekonvensi, Arsip. Semuanya
 * DIBACA dari mesin dan data yang sudah ada - tidak ada aturan isi baru:
 *
 *   jadwal & putusan     rincian sidang bot (sippJadwalSidangService.rincianSidang)
 *   tunda/edit           usulanTundaSidang (@/lib/bawaan-tunda) - SATU pintu
 *                        yang sama dengan Jadwal Sidang dan Hasil Sidang portal,
 *                        kehadiran menurut antrian sidang (kehadiranDariAntrian)
 *   relaas               kesiapan sidang bot (kepatutan panggilan tiap pihak)
 *   rekonvensi           dokumen jawaban e-Court di arsip ALETA
 *
 * Pemeriksaan tanggal (libur nasional, bentrok, jumlah sidang hari itu) hanya
 * MEMBERI TAHU: tanggal usulan tidak digeser diam-diam. Usulan yang jatuh pada
 * hari libur diturunkan menjadi "ragu" sehingga ekstensi tidak mengisikannya
 * sendiri - petugas memilih tanggalnya.
 */

export type JadwalM1 = {
  sidangId: string;
  /** YYYY-MM-DD */
  tanggal: string;
  jam: string;
  agenda: string;
  ditunda: boolean;
  alasan: string;
  dihadiriOleh: number | null;
  urutan: number;
};

const iso10 = (t: unknown) => String(t ?? "").slice(0, 10);

/** Jadwal sidang perkara dari rincian bot, urut tanggal lalu urutan. */
export function jadwalDariRincian(rincian: { jadwalPerkara?: unknown } | null | undefined): JadwalM1[] {
  const mentah = Array.isArray(rincian?.jadwalPerkara) ? (rincian!.jadwalPerkara as Record<string, unknown>[]) : [];
  return mentah
    .map((s) => {
      const hadir = Number(s.dihadiriOleh);
      return {
        sidangId: String(s.sidangId ?? ""),
        tanggal: iso10(s.tanggalSidang),
        jam: String(s.jamSidang ?? "").slice(0, 5),
        agenda: String(s.agenda ?? ""),
        ditunda: Boolean(s.ditunda),
        alasan: String(s.alasanDitunda ?? ""),
        dihadiriOleh: Number.isFinite(hadir) && hadir > 0 ? hadir : null,
        urutan: Number(s.urutanSidang) || 0,
      };
    })
    .filter((s) => s.sidangId && ccIsoSah(s.tanggal))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.urutan - b.urutan);
}

/**
 * Sidang pada tanggal itu. Lebih dari satu baris setanggal (jarang - sidang
 * diulang hari yang sama) -> urutan terbesar, yaitu yang terakhir dicatat.
 */
export function pilihSidang(jadwal: readonly JadwalM1[], tanggal: string): JadwalM1 | null {
  const t = iso10(tanggal);
  if (!ccIsoSah(t)) return null;
  const cocok = jadwal.filter((s) => s.tanggal === t);
  if (!cocok.length) return null;
  return cocok.reduce((a, b) => (b.urutan >= a.urutan ? b : a));
}

export type CekTanggal = {
  tanggal: string;
  /** "" = hari kerja; selain itu sebabnya ("hari Sabtu", "libur: Natal"). */
  libur: string;
  /** Hari kerja pertama pada/sesudah tanggal itu - hanya disebut, tidak dipakai sendiri. */
  hariKerjaTerdekat: string;
  /** Perkara ini sudah punya jadwal sidang lain pada tanggal itu. */
  bentrokPerkara: boolean;
  /** Jumlah sidang seluruh pengadilan pada tanggal itu (null = tak terbaca). */
  jumlahSidangHariItu: number | null;
};

export function cekTanggalSidang(
  tanggal: string,
  opsi: { jadwal?: readonly JadwalM1[]; kecualiSidangId?: string; rekapHari?: ReadonlyArray<{ tanggal: string; jumlah: number }> | null } = {}
): CekTanggal | null {
  const t = iso10(tanggal);
  if (!ccIsoSah(t)) return null;
  const libur = ccBukanHariKerja(t);
  const baris = (opsi.rekapHari || []).find((h) => iso10(h.tanggal) === t);
  return {
    tanggal: t,
    libur,
    hariKerjaTerdekat: libur ? ccMajuHariKerja(t) : t,
    bentrokPerkara: (opsi.jadwal || []).some((s) => s.tanggal === t && s.sidangId !== opsi.kecualiSidangId),
    jumlahSidangHariItu: opsi.rekapHari ? (baris ? Number(baris.jumlah) || 0 : 0) : null,
  };
}

export type UsulanTundaM1 = {
  alasan: string;
  agenda: string;
  tanggal: string;
  jam: string;
  /** Kehadiran sidang yang ditunda (sandi SIPP dihadiri_oleh). */
  kehadiran: number;
  kehadiranTercatat: boolean;
  penjelasan: string;
  penjelasanTanggal: string;
  sumberTanggal: string;
  /** false bila tanggal usulan jatuh pada hari libur - ekstensi tidak mengisikannya sendiri. */
  tanggalPasti: boolean;
};

/**
 * Usulan isian Tunda/Edit Jadwal untuk satu sidang - usulanTundaSidang apa
 * adanya (riwayat + Court Calendar + kontak e-Court + kehadiran antrian).
 * null bila riwayat tidak terbaca (bot lama): tidak menebak "sidang pertama".
 */
export function susunUsulanTunda(bahan: {
  keadaan: KeadaanTundaMin | null | undefined;
  riwayat: Omit<RiwayatTundaMin, "kalender" | "kontak"> | null | undefined;
  antrian?: AntrianSidangRingkas | undefined;
  kalender?: readonly RencanaKalender[] | null;
  kontak?: KontakPihak | null;
}): { usulan: UsulanTundaM1 | null; kehadiranAntrian: number | null } {
  const kehadiranAntrian = kehadiranDariAntrian(bahan.antrian ?? null);
  if (!bahan.keadaan || !bahan.riwayat) return { usulan: null, kehadiranAntrian };
  const u = usulanTundaSidang(
    bahan.keadaan,
    { ...bahan.riwayat, kalender: bahan.kalender ?? null, kontak: bahan.kontak ?? null },
    kehadiranAntrian
  );
  if (!u) return { usulan: null, kehadiranAntrian };
  return {
    kehadiranAntrian,
    usulan: {
      alasan: u.alasan,
      agenda: u.agenda,
      tanggal: u.tanggal,
      jam: u.jam,
      kehadiran: u.kehadiran,
      kehadiranTercatat: u.kehadiranTercatat,
      penjelasan: u.penjelasan,
      penjelasanTanggal: u.penjelasanTanggal,
      sumberTanggal: String(u.sumberTanggal),
      tanggalPasti: ccIsoSah(u.tanggal) && !ccBukanHariKerja(u.tanggal),
    },
  };
}

export type PanggilanM1 = {
  nama: string;
  peran: string;
  seharusnya: string;
  terlaksana: string;
  sandiRelaas: string;
  eSummonsTerkirim: boolean | null;
  tanggalPanggilan: string;
  tanggalPelaksanaanRelaas: string;
  patut: boolean | null;
  dinilai: boolean;
  alasanPatut: string;
  dasarHukum: string;
  selisih: number | null;
  ambang: number | null;
  /** Ambang dihitung dalam hari kerja (bukan hari kalender). */
  hariKerja: boolean;
};

/** Keadaan panggilan tiap pihak (kesiapan bot) - tanpa resi dan bukti, hanya yang dipakai jendela Relaas. */
export function ringkasPanggilan(kesiapan: unknown): PanggilanM1[] {
  const k = (kesiapan || {}) as { panggilan?: { pihak?: unknown } };
  const daftar = Array.isArray(k.panggilan?.pihak) ? (k.panggilan!.pihak as Record<string, unknown>[]) : [];
  return daftar.map((p) => {
    const kep = (p.kepatutan || {}) as Record<string, unknown>;
    return {
      nama: String(p.nama ?? ""),
      peran: String(p.peran ?? ""),
      seharusnya: String(p.seharusnya ?? ""),
      terlaksana: String(p.terlaksana ?? ""),
      sandiRelaas: String(p.sandiRelaas ?? ""),
      eSummonsTerkirim: typeof p.eSummonsTerkirim === "boolean" ? p.eSummonsTerkirim : null,
      tanggalPanggilan: iso10(p.tanggalPanggilan),
      tanggalPelaksanaanRelaas: iso10(p.tanggalPelaksanaanRelaas),
      patut: kep.dinilai ? (typeof kep.patut === "boolean" ? kep.patut : null) : null,
      dinilai: Boolean(kep.dinilai),
      alasanPatut: String(kep.alasan ?? ""),
      dasarHukum: String(kep.dasarHukum ?? ""),
      selisih: Number.isFinite(Number(kep.selisih)) && kep.selisih !== null ? Number(kep.selisih) : null,
      ambang: Number.isFinite(Number(kep.ambang)) && kep.ambang !== null ? Number(kep.ambang) : null,
      hariKerja: Boolean(kep.hariKerja),
    };
  });
}

export type JawabanEcourt = { judul: string; tanggalSidang: string; diunggahPada: string; rekonvensi: boolean };

/** Dokumen jawaban/duplik/rekonvensi dari arsip e-Court - bahan tanggal pendaftaran rekonvensi. */
export function dokumenJawaban(dokumen: unknown): JawabanEcourt[] {
  const daftar = Array.isArray(dokumen) ? (dokumen as Record<string, unknown>[]) : [];
  return daftar
    .map((d) => {
      const judul = String(d.judulDokumen ?? d.jenisDokumen ?? "");
      return {
        judul,
        tanggalSidang: iso10(d.tanggalSidang),
        diunggahPada: iso10(d.diunggahPada),
        rekonvensi: /rekonvensi/i.test(`${judul} ${String(d.jenisDokumen ?? "")}`),
      };
    })
    .filter((d) => /jawaban|rekonvensi/i.test(d.judul))
    .sort((a, b) => (a.tanggalSidang || a.diunggahPada).localeCompare(b.tanggalSidang || b.diunggahPada));
}
