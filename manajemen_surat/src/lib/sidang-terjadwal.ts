/**
 * ============================================================================
 * UNGGAH BAS TERJADWAL & TUNDAAN TERJADWAL - ATURAN MURNI (27 Okt 2026)
 * ============================================================================
 *
 * Petugas memilih sidang, mengisi penundaan (atau menyeret berkas BAS), memilih
 * jam, lalu SERVER yang menulis ke SIPP lewat bot pada waktunya. Berkas ini hanya
 * HITUNGAN (tanpa basis data, jaringan, atau jam dinding): status, kalimat untuk
 * petugas, aturan waktu, muatan penundaan, dan susunan jam. Tidak ada yang
 * ditulis ke SIPP dari sini.
 *
 * ATURAN WAKTU
 *   Tunda  HARI SAMA (keputusan 22 Okt, lihat JENIS_HARI_SAMA di antreanTulisSippService):
 *          waktu rencana harus jatuh pada tanggal sidangnya (WITA) dan tidak lampau.
 *          Boleh lewat jam kerja (di atas 16.30), tidak boleh lewat hari itu. Yang
 *          baru sempat dikerjakan sesudah hari sidangnya = kedaluwarsa, TIDAK
 *          pernah ditulis keesokan harinya.
 *   BAS    waktu rencana pada atau sesudah tanggal sidang, di dalam jam kerja
 *          satker (hari libur dilewati), dengan jeda manusiawi antar butir.
 *
 * Susunan jam dan jeda acak memakai susunJadwal (putusan-terjadwal.ts) - satu
 * sumber, tidak disalin.
 */

import {
  BATAS as BATAS_PUTUSAN,
  hhmmSah,
  msDariIso,
  msKeWita,
  susunJadwal,
  witaKeMs,
  type HasilJadwal,
} from "@/lib/putusan-terjadwal";
import { menyebutAleta, pesanTandaAletaSipp } from "@/lib/tanda-aleta";

export const JENIS_SIDANG = ["bas", "tunda"] as const;
export type JenisSidang = (typeof JENIS_SIDANG)[number];

export const NAMA_JENIS: Record<JenisSidang, string> = {
  bas: "Unggah BAS",
  tunda: "Tunda sidang",
};

export const STATUS_SIDANG = ["menunggu", "jalan", "selesai", "dilewati", "gagal", "dibatalkan", "kedaluwarsa"] as const;
export type StatusSidang = (typeof STATUS_SIDANG)[number];

export const NAMA_STATUS_SIDANG: Record<StatusSidang, string> = {
  menunggu: "menunggu",
  jalan: "sedang dikerjakan",
  selesai: "selesai",
  dilewati: "dilewati (sudah ada di SIPP)",
  gagal: "gagal",
  dibatalkan: "dibatalkan",
  kedaluwarsa: "kedaluwarsa",
};

export const STATUS_AKTIF: readonly StatusSidang[] = ["menunggu", "jalan"];
export const STATUS_AKHIR: readonly StatusSidang[] = ["selesai", "dilewati", "gagal", "dibatalkan", "kedaluwarsa"];

export const jenisSah = (j: unknown): j is JenisSidang => j === "bas" || j === "tunda";
export const statusSah = (s: unknown): s is StatusSidang => (STATUS_SIDANG as readonly string[]).includes(String(s));
export const namaStatus = (s: string) => (statusSah(s) ? NAMA_STATUS_SIDANG[s] : s);

export const BATAS_SIDANG = {
  /** Sidang dalam satu permintaan. */
  butirPerPermintaan: BATAS_PUTUSAN.butirPerJadwal,
  /** Satu berkas BAS (sama dengan rute unggah-sipp). */
  ukuranBerkas: 10 * 1024 * 1024,
  /** Seluruh berkas dalam satu permintaan. */
  ukuranTotal: 80 * 1024 * 1024,
  /** Masa pegang satu pekerjaan oleh pelaksana (detik); lewat dari ini dianggap macet. */
  masaPegangDetik: BATAS_PUTUSAN.masaPegangDetik,
  /** Berapa kali galat sementara diulang sebelum dinyatakan gagal. */
  percobaanMaks: BATAS_PUTUSAN.percobaanMaks,
  /** Berkas BAS dihapus N hari sesudah pekerjaannya berakhir (dibatalkan: 1 hari). */
  hapusHari: BATAS_PUTUSAN.hapusHariBawaan,
  /** BAS yang belum dikerjakan sampai sekian hari sesudah jam rencananya dinyatakan kedaluwarsa. */
  kedaluwarsaBasHari: BATAS_PUTUSAN.kedaluwarsaHari,
  /** Tunggu sebelum percobaan ke-1..4 (detik). */
  tungguUlangDetik: [60, 180, 420, 900],
  alasanMaks: 500,
  agendaMaks: 300,
} as const;

/** Detik tunggu sebelum mengulang, menurut jumlah percobaan yang SUDAH terjadi (1 = baru gagal sekali). */
export function tungguUlang(percobaan: number): number {
  const daftar = BATAS_SIDANG.tungguUlangDetik;
  return daftar[Math.min(Math.max(Math.floor(percobaan) - 1, 0), daftar.length - 1)];
}

// ──────────────────────────────────────────────────────────────────────────
// Tanggal & aturan waktu
// ──────────────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" sah (kalender nyata)? */
export function tanggalSah(t: unknown): t is string {
  return typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t) && Number.isFinite(witaKeMs(`${t} 00:00`));
}

/** Tanggal WITA ("YYYY-MM-DD") dari milidetik UTC. */
export const tanggalWita = (ms: number) => msKeWita(ms).slice(0, 10);

/** Tunda: tanggal sidangnya sudah lewat (WITA) sehingga tidak boleh ditulis lagi. */
export function tundaKedaluwarsa(tanggalSidang: string, kiniMs: number): boolean {
  return tanggalSah(tanggalSidang) && tanggalWita(kiniMs) > tanggalSidang;
}

/** BAS: jam rencananya sudah lewat lebih dari batas kedaluwarsa. */
export function basKedaluwarsa(waktuRencanaMs: number, kiniMs: number): boolean {
  return Number.isFinite(waktuRencanaMs) && kiniMs - waktuRencanaMs > BATAS_SIDANG.kedaluwarsaBasHari * 24 * 3600_000;
}

const SELANG_TOLERANSI_MS = 60_000;

/** Tunda: waktu rencana pada tanggal sidangnya (WITA) dan tidak lampau. null = sah. */
export function periksaWaktuTunda(waktuMs: number, tanggalSidang: string, kiniMs: number): string | null {
  if (!Number.isFinite(waktuMs)) return "Waktu rencana belum sah.";
  if (waktuMs < kiniMs - SELANG_TOLERANSI_MS) return "Waktu rencana sudah lewat.";
  if (tanggalWita(waktuMs) !== tanggalSidang) {
    return `Penundaan hanya ditulis pada hari sidangnya (${tanggalSidang}); waktu rencana ${msKeWita(waktuMs).slice(0, 16)} WITA jatuh di hari lain. Pilih jam mulai dan jeda yang semuanya muat di hari sidang.`;
  }
  return null;
}

/** BAS: waktu rencana pada atau sesudah hari sidangnya dan tidak lampau. null = sah. */
export function periksaWaktuBas(waktuMs: number, tanggalSidang: string, kiniMs: number): string | null {
  if (!Number.isFinite(waktuMs)) return "Waktu rencana belum sah.";
  if (waktuMs < kiniMs - SELANG_TOLERANSI_MS) return "Waktu rencana sudah lewat.";
  if (tanggalWita(waktuMs) < tanggalSidang) {
    return `BAS baru dapat diunggah pada atau sesudah hari sidangnya (${tanggalSidang}); waktu rencana ${msKeWita(waktuMs).slice(0, 16)} WITA lebih awal.`;
  }
  return null;
}

/** Aturan waktu menurut jenis. */
export const periksaWaktu = (jenis: JenisSidang, waktuMs: number, tanggalSidang: string, kiniMs: number) =>
  jenis === "tunda" ? periksaWaktuTunda(waktuMs, tanggalSidang, kiniMs) : periksaWaktuBas(waktuMs, tanggalSidang, kiniMs);

export type MasukanSusunWaktu = {
  jenis: JenisSidang;
  jumlah: number;
  mulai: string;
  jedaMin?: number;
  jedaMaks?: number;
  libur?: (iso: string) => boolean;
  acak?: () => number;
};

/**
 * Susunan jam. Tunda: sepanjang hari tanpa istirahat dan TIDAK lintas hari (jam di atas 16.30 boleh).
 * BAS: jam kerja satker dan hari libur dilewati, boleh bersambung ke hari kerja berikutnya.
 */
export function susunWaktuSidang(m: MasukanSusunWaktu): HasilJadwal {
  const tunda = m.jenis === "tunda";
  const h = susunJadwal({
    jumlah: m.jumlah,
    mulai: m.mulai,
    jedaMinDetik: m.jedaMin,
    jedaMaksDetik: m.jedaMaks,
    jamKerja: tunda ? { malamBoleh: true } : {},
    // Tunda tidak pernah pindah hari: batas akhirnya ujung HARI MULAI (jendela "sepanjang hari" sendiri tidak menahan tengah malam).
    ...(tunda ? { batasAkhir: `${String(m.mulai).slice(0, 10)} 23:59:59` } : {}),
    lintasHari: !tunda,
    libur: m.libur,
    acak: m.acak,
  });
  if (!tunda || h.tidakMuat <= 0) return h;
  const sebab = `Hanya ${h.butir.length} dari ${m.jumlah} penundaan yang muat di hari itu dengan jeda ${Math.round(h.jedaMinDetik / 60)}-${Math.round(h.jedaMaksDetik / 60)} menit. Penundaan tidak pernah ditulis di hari lain: majukan jam mulai, perpendek jeda, atau kurangi jumlahnya.`;
  return { ...h, sebab, peringatan: [...h.peringatan.slice(0, -1), sebab] };
}

// ──────────────────────────────────────────────────────────────────────────
// Muatan
// ──────────────────────────────────────────────────────────────────────────

/** Kode ruang/jenis pengadilan/dihadiri oleh: bilangan bulat bila berbentuk angka, selain itu teks pendek, kosong = tidak diisi. */
function kodeKecil(v: unknown): number | string | undefined {
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  if (!t) return undefined;
  if (/^\d{1,9}$/.test(t)) return Number(t);
  return t.slice(0, 40);
}

const sebarisTeks = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();

/** Muatan penundaan yang diteruskan apa adanya ke bot (/sidang/tunda). */
export type MuatanTunda = {
  alasanTunda: string;
  /** YYYY-MM-DD */
  tanggalBerikut: string;
  /** HH:mm */
  jamBerikut: string;
  agendaBerikut: string;
  dihadiriOleh?: number | string;
  ruanganIdBerikut?: number | string;
  sidangKelilingBerikut?: boolean;
  jenisPengadilan?: number | string;
  ruangId?: number | string;
};

export type MasukanTundaMentah = Record<string, unknown>;

/** Membersihkan + memeriksa isian penundaan. Kalimat untuk petugas bila tidak sah. */
export function bersihkanMuatanTunda(mentah: MasukanTundaMentah, tanggalSidang: string): { ok: true; muatan: MuatanTunda } | { ok: false; sebab: string } {
  const alasan = sebarisTeks(mentah.alasanTunda);
  if (!alasan) return { ok: false, sebab: "Alasan penundaan belum diisi." };
  if (alasan.length > BATAS_SIDANG.alasanMaks) return { ok: false, sebab: `Alasan penundaan terlalu panjang (paling banyak ${BATAS_SIDANG.alasanMaks} huruf).` };
  const agenda = sebarisTeks(mentah.agendaBerikut);
  if (!agenda) return { ok: false, sebab: "Agenda sidang berikutnya belum diisi." };
  if (agenda.length > BATAS_SIDANG.agendaMaks) return { ok: false, sebab: `Agenda sidang berikutnya terlalu panjang (paling banyak ${BATAS_SIDANG.agendaMaks} huruf).` };
  // Tidak ada kata ALETA di SIPP, juga dari isian bebas (keputusan 2 & 17 Okt).
  if (menyebutAleta(alasan)) return { ok: false, sebab: pesanTandaAletaSipp("Alasan penundaan") };
  if (menyebutAleta(agenda)) return { ok: false, sebab: pesanTandaAletaSipp("Agenda sidang berikutnya") };
  const tanggalBerikut = sebarisTeks(mentah.tanggalBerikut);
  if (!tanggalSah(tanggalBerikut)) return { ok: false, sebab: "Tanggal sidang berikutnya belum sah (YYYY-MM-DD)." };
  if (tanggalSah(tanggalSidang) && tanggalBerikut <= tanggalSidang) {
    return { ok: false, sebab: `Tanggal sidang berikutnya (${tanggalBerikut}) harus sesudah tanggal sidang yang ditunda (${tanggalSidang}).` };
  }
  const jam = sebarisTeks(mentah.jamBerikut);
  if (!hhmmSah(jam)) return { ok: false, sebab: "Jam sidang berikutnya belum sah (HH:mm)." };
  const [j, m] = jam.split(":");
  const muatan: MuatanTunda = { alasanTunda: alasan, tanggalBerikut, jamBerikut: `${j.padStart(2, "0")}:${m}`, agendaBerikut: agenda };
  const dihadiri = kodeKecil(mentah.dihadiriOleh);
  if (dihadiri !== undefined) muatan.dihadiriOleh = dihadiri;
  const ruanganBerikut = kodeKecil(mentah.ruanganIdBerikut);
  if (ruanganBerikut !== undefined) muatan.ruanganIdBerikut = ruanganBerikut;
  if (typeof mentah.sidangKelilingBerikut === "boolean") muatan.sidangKelilingBerikut = mentah.sidangKelilingBerikut;
  const jenisPengadilan = kodeKecil(mentah.jenisPengadilan);
  if (jenisPengadilan !== undefined) muatan.jenisPengadilan = jenisPengadilan;
  const ruang = kodeKecil(mentah.ruangId);
  if (ruang !== undefined) muatan.ruangId = ruang;
  return { ok: true, muatan };
}

/** Yang tersimpan di muatan_json satu pekerjaan. */
export type MuatanTersimpan = {
  /** Jeda antar pekerjaan yang dipilih petugas (detik) - pelaksana tidak memulai dua pekerjaan lebih rapat dari jeda minimum. */
  jedaMin: number;
  jedaMaks: number;
  tunda?: MuatanTunda;
  bas?: { ganti: boolean };
};

export function bacaMuatanTersimpan(json: string): MuatanTersimpan {
  try {
    const x = JSON.parse(json || "{}") as Partial<MuatanTersimpan>;
    return {
      jedaMin: Number.isFinite(Number(x.jedaMin)) ? Number(x.jedaMin) : BATAS_PUTUSAN.jedaMinBawaan,
      jedaMaks: Number.isFinite(Number(x.jedaMaks)) ? Number(x.jedaMaks) : BATAS_PUTUSAN.jedaMaksBawaan,
      ...(x.tunda && typeof x.tunda === "object" ? { tunda: x.tunda } : {}),
      ...(x.bas && typeof x.bas === "object" ? { bas: { ganti: x.bas.ganti === true } } : {}),
    };
  } catch {
    return { jedaMin: BATAS_PUTUSAN.jedaMinBawaan, jedaMaks: BATAS_PUTUSAN.jedaMaksBawaan };
  }
}

const potong = (t: string, maks: number) => (t.length > maks ? `${t.slice(0, maks - 1)}…` : t);

/** Satu kalimat isi pekerjaan untuk daftar di layar (tanpa label teknis). */
export function ringkasMuatan(jenis: JenisSidang, muatan: MuatanTersimpan, berkasNama = ""): string {
  if (jenis === "tunda") {
    const t = muatan.tunda;
    if (!t) return "Penundaan sidang";
    return `Tunda: ${potong(t.alasanTunda, 80)} - sidang berikutnya ${t.tanggalBerikut} pukul ${t.jamBerikut}, agenda ${potong(t.agendaBerikut, 60)}`;
  }
  const nama = berkasNama ? `"${potong(berkasNama, 60)}"` : "berkas BAS";
  return muatan.bas?.ganti ? `BAS ${nama} - menggantikan e-Doc BAS yang sudah ada` : `BAS ${nama}`;
}

/** Sebutan waktu untuk kalimat ("2026-10-27 14:05"). */
export const sebutWitaPendek = (ms: number) => (Number.isFinite(ms) ? msKeWita(ms).slice(0, 16) : "");

/** ISO UTC -> ms; NaN bila tidak sah. */
export const msDariTeks = msDariIso;
