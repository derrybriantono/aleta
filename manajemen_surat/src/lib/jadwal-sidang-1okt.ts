/**
 * ============================================================================
 * JADWAL SIDANG - PERBAIKAN 1 OKTOBER 2026 (J1, J2, J5, J7, J8)
 * ============================================================================
 *
 * Fungsi murni yang dipakai layar Jadwal Sidang dan Hasil Sidang. Aturannya
 * di sini, satu tempat, dan diuji di src/test/jadwal-sidang-1okt.test.ts -
 * bukan tersebar di dalam komponen 9.000 baris.
 */
import {
  SAKLAR_TAMPILAN,
  tampil,
  tampilanSemuaMati,
  type PilihanTampilan,
} from "@/lib/tampilan-antrian-sidang";

// ============================================================================
// J5 - MODE LENGKAP / MODE MINIMALIS
// ============================================================================

/**
 * Yang TIDAK ikut dinyalakan Mode lengkap - diminta pengguna 1 Okt 2026:
 * "lengkap = semua kecuali kolom siap dan catatan cara menghitung".
 * Keduanya juga yang bawaannya mati (bawaanMati), dan sebabnya sama: yang
 * hilang hanya kalimat cara menghitung dan kolom skor yang baru terisi
 * sesudah Hitung skor ditekan - bukan fakta perkara.
 */
export const DIKECUALIKAN_MODE_LENGKAP = ["kolom-siap", "catatan-cara-hitung"] as const;

export type ModeTampilan = "lengkap" | "minimalis" | "suai";

/** Mode lengkap: semua menyala kecuali kedua yang dikecualikan. */
export function tampilanModeLengkap(): PilihanTampilan {
  const hasil: PilihanTampilan = {};
  for (const saklar of SAKLAR_TAMPILAN) {
    hasil[saklar.kunci] = saklar.wajib
      ? true
      : !(DIKECUALIKAN_MODE_LENGKAP as readonly string[]).includes(saklar.kunci);
  }
  return hasil;
}

/**
 * Mode minimalis: semua mati. Yang wajib (retur dan kawan-kawannya) tetap
 * menyala - tampil() memaksanya, dan simpanan tidak boleh berbohong tentangnya.
 */
export function tampilanModeMinimalis(): PilihanTampilan {
  return tampilanSemuaMati();
}

/**
 * Mode yang SEDANG berlaku, dibaca dari centangnya - bukan disimpan
 * tersendiri. Begitu satu centang diubah tangan, modenya "suai": tombol mode
 * tidak boleh tetap menyala untuk susunan yang sudah bukan susunannya.
 */
export function modeTampilanAktif(pilihan: PilihanTampilan): ModeTampilan {
  const sama = (acuan: PilihanTampilan) =>
    SAKLAR_TAMPILAN.every((x) => x.wajib || tampil(pilihan, x.kunci) === Boolean(acuan[x.kunci]));
  if (sama(tampilanModeLengkap())) return "lengkap";
  if (sama(tampilanModeMinimalis())) return "minimalis";
  return "suai";
}

// ============================================================================
// J2 - SELESAI, SINKRON DUA ARAH DENGAN ANTRIAN
// ============================================================================

export type SumberSelesai = "aleta" | "antrian-sipp" | "antrian-ruang-tunggu";

export type CatatanSelesai = {
  perkaraId: string;
  tanggalSidang: string;
  sumber: SumberSelesai[];
  oleh?: string;
  ditandaiPada?: string;
};

export type PetaSelesai = Record<string, CatatanSelesai>;

/** Kunci peta - SAMA dengan kunciSelesai di bot (sidangSelesaiService). */
export function kunciSelesai(perkaraId: string | number, tanggalSidang: string): string {
  return `${String(perkaraId ?? "").trim()}|${String(tanggalSidang ?? "").slice(0, 10)}`;
}

export type KeadaanSelesai = {
  /** Baris dihijaukan. */
  hijau: boolean;
  /** Hijau karena hasil sidang (ditunda/putus/ikrar) sudah tercatat di SIPP. */
  dariHasilSidang: boolean;
  /** Hijau karena ditandai - di ALETA atau di antrian. */
  ditandai: boolean;
  sumber: SumberSelesai[];
  /** Tombolnya boleh membatalkan: hanya yang DITANDAI, bukan hasil sidang. */
  bolehBatal: boolean;
  keterangan: string;
};

const SEBUTAN_SUMBER: Record<SumberSelesai, string> = {
  aleta: "ditandai di ALETA",
  "antrian-sipp": "antrian sidang SIPP berstatus selesai",
  "antrian-ruang-tunggu": "mesin antrian ruang tunggu berstatus selesai",
};

/**
 * Keadaan selesai satu baris jadwal.
 *
 * Hasil sidang yang sudah tercatat (ditunda / putus / ikrar) tetap hijau
 * seperti sebelumnya - dan TIDAK dapat "dibatalkan" dari tombol ini: yang
 * membatalkannya adalah mengubah hasil sidang di SIPP, bukan papan antrian.
 */
export function keadaanSelesai(
  baris: { perkaraId: string; tanggalSidang: string },
  hasilSidangSelesai: boolean,
  peta: PetaSelesai | undefined
): KeadaanSelesai {
  const catatan = peta?.[kunciSelesai(baris.perkaraId, baris.tanggalSidang)];
  const sumber = (catatan?.sumber ?? []).filter((x): x is SumberSelesai => x in SEBUTAN_SUMBER);
  const ditandai = sumber.length > 0;
  const bagian: string[] = [];
  if (hasilSidangSelesai) bagian.push("hasil sidang sudah tercatat di SIPP");
  for (const s of sumber) bagian.push(SEBUTAN_SUMBER[s]);
  if (catatan?.oleh && sumber.includes("aleta")) bagian.push(`oleh ${catatan.oleh}`);
  return {
    hijau: hasilSidangSelesai || ditandai,
    dariHasilSidang: hasilSidangSelesai,
    ditandai,
    sumber,
    bolehBatal: ditandai,
    keterangan: bagian.length > 0 ? `Selesai: ${bagian.join("; ")}.` : "Belum ditandai selesai.",
  };
}

// ============================================================================
// J8 - UNDUH PER RIWAYAT PANGGILAN, BERNAMA SESUAI DOKUMENNYA
// ============================================================================

function bersihNamaBerkas(teks: string): string {
  return String(teks || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nama dokumen relaas di riwayat panggilan: "Relaas Panggilan Sidang ke-3 -
 * Tergugat". Dipakai sebagai label tombol DAN nama berkas cadangan (yang
 * dipakai bila server tidak menyebut namanya lewat Content-Disposition).
 */
export function namaDokumenRelaas(
  baris: { namaPihak?: string; peran?: string },
  jenis: "relaas" | "resi",
  urutanSidang?: number
): string {
  const ke = Number(urutanSidang) > 0 ? ` Sidang ke-${Number(urutanSidang)}` : "";
  const dasar = jenis === "resi" ? `Resi Pos Relaas${ke}` : `Relaas Panggilan${ke}`;
  const siapa = String(baris.peran || baris.namaPihak || "").trim();
  return siapa ? `${dasar} - ${siapa}` : dasar;
}

export function namaBerkasRelaas(
  nomorPerkara: string,
  baris: { id: string; namaPihak?: string; peran?: string },
  jenis: "relaas" | "resi",
  urutanSidang?: number
): string {
  const nomor = bersihNamaBerkas(nomorPerkara);
  const nama = bersihNamaBerkas(namaDokumenRelaas(baris, jenis, urutanSidang));
  return `${nama}${nomor ? ` - ${nomor}` : ""}.pdf`;
}

// ============================================================================
// J1 / J7 - MEDIASI
// ============================================================================

/** Arti hasil_mediasi - <option> tab_mediasi_edit2.php SIPP (sama dengan bot). */
export const HASIL_MEDIASI: Record<string, string> = {
  Y1: "Berhasil dengan akta perdamaian",
  Y2: "Berhasil dengan pencabutan",
  S: "Berhasil sebagian",
  T: "Tidak berhasil",
  D: "Tidak dapat dilaksanakan",
};

/** Pilihan "Jenis Penetapan Mediator" - nilai <option> blangko SIPP. */
export const JENIS_PENETAPAN_MEDIATOR = [
  {
    nilai: "sepakat untuk menyerahkan kepada Majelis Hakim untuk menunjuk Mediator dari Daftar Mediator",
    label: "Majelis Hakim Memilih Mediator",
  },
  { nilai: "sepakat memilih Mediator", label: "Pihak Sepakat Memilih Mediator" },
] as const;

export type JadwalMediasi = {
  mediasiId: number;
  urutan: number;
  tanggal: string;
  jam: string;
  sampaiJam: string;
  tempat: string;
  dihadiriOleh: number | null;
  kehadiran: string;
  ditunda: boolean;
};

export type ProsesMediasi = {
  mediasiId: number;
  tahapanId: number;
  jenisMediasi: number;
  penetapan: string;
  nomorSk: string;
  mediator: string;
  statusMediator: string;
  mulai: string;
  keputusan: string;
  hasil: string;
  hasilSebutan: string;
  laporan: string;
  berhasil: string;
  gagal: string;
  catatan: string;
  jadwal: JadwalMediasi[];
};

/**
 * Satu kalimat keadaan mediasi: hasilnya bila sudah diputus, pertemuan
 * berikutnya bila masih berjalan.
 */
export function ringkasMediasi(m: ProsesMediasi, hariIni: string): string {
  const hasil = m.hasilSebutan || HASIL_MEDIASI[m.hasil] || "";
  if (hasil) return `${hasil}${m.keputusan ? ` (${m.keputusan})` : ""}`;
  const berikut = m.jadwal.filter((j) => !j.ditunda && j.tanggal && j.tanggal >= hariIni).sort((a, b) =>
    a.tanggal.localeCompare(b.tanggal)
  )[0];
  if (berikut) return `Berjalan - pertemuan ke-${berikut.urutan} ${berikut.tanggal}`;
  return m.jadwal.length > 0 ? `Berjalan - ${m.jadwal.length} pertemuan tercatat` : "Berjalan";
}

/**
 * Bawaan isian penetapan mediator - DIUKUR, bukan dikira (sipp_donggala,
 * penetapan 2025-2026, 118 baris):
 *   tanggal penetapan = tanggal sidang     118 dari 118
 *   nomor SK = nomor perkara               47 (67 kosong, 4 lain) - dapat diubah
 *   jenis "Majelis Hakim memilih"          496 lawan 208 sepanjang masa
 *   atas nama ketua majelis                penetapan mediator ditetapkan ketua
 *                                          majelis (PERMA 1/2016); dapat diganti
 *                                          panitera pengganti perkara
 */
export function bawaanPenetapanMediator(baris: { tanggalSidang: string; nomorPerkara: string }) {
  return {
    tanggalPenetapan: String(baris.tanggalSidang || "").slice(0, 10),
    nomorSk: String(baris.nomorPerkara || "").trim(),
    jenisPenetapan: JENIS_PENETAPAN_MEDIATOR[0].nilai as string,
    atasNama: "hakim" as "hakim" | "panitera",
  };
}

/** Hari dalam pekan tanpa zona waktu - 0 Minggu, 6 Sabtu. */
function hariPekan(iso: string): number {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h)).getUTCDay();
}

/**
 * Pemeriksaan isian di layar - cermin pemeriksaan blangko SIPP yang juga
 * dikerjakan bot. Di layar supaya petugas tidak menunggu satu perjalanan ke
 * server hanya untuk diberitahu tanggalnya jatuh pada hari Sabtu.
 */
export function periksaIsianMediator(
  isian: { mediatorId: number | null; tanggalPenetapan: string; jenisPenetapan: string; nomorSk: string },
  hariIni: string
): string[] {
  const salah: string[] = [];
  if (!isian.mediatorId) salah.push("Nama Mediator wajib dipilih.");
  const tanggal = String(isian.tanggalPenetapan || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    salah.push("Tanggal Penetapan Mediator wajib diisi.");
  } else {
    if (hariIni && tanggal > hariIni) salah.push("Tanggal Penetapan Mediator tidak boleh melebihi hari ini.");
    const hari = hariPekan(tanggal);
    if (hari === 0 || hari === 6) salah.push("Tanggal Penetapan Mediator tidak boleh hari Sabtu atau Minggu.");
  }
  if (!JENIS_PENETAPAN_MEDIATOR.some((j) => j.nilai === isian.jenisPenetapan)) {
    salah.push("Jenis Penetapan Mediator wajib dipilih.");
  }
  if (String(isian.nomorSk || "").length > 50) salah.push("No. Penetapan Mediator paling panjang 50 huruf.");
  return salah;
}
