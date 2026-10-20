/**
 * ============================================================================
 * PENGUMUMAN PERMOHONAN ITSBAT NIKAH VOLUNTAIR (14 OKT 2026)
 * ============================================================================
 *
 * Permintaan pengguna: untuk SIDANG PERTAMA perkara itsbat nikah / pengesahan
 * perkawinan (jenis_perkara_id 360) yang VOLUNTAIR (alur_perkara_id 16, Pdt.P)
 * juru sita mencetak panggilan Pemohon I, panggilan Pemohon II, DAN pengumuman
 * itsbat nikah. Itsbat kontensius (360 alur 15, Pdt.G) dan sidang lanjutan
 * tidak diberi pengumuman.
 *
 * Dasar: pengumuman permohonan itsbat nikah voluntair selama 14 (empat belas)
 * hari di papan pengumuman pengadilan sebelum diperiksa (Buku II Pedoman
 * Pelaksanaan Tugas dan Administrasi Peradilan Agama, revisi 2013), atas
 * perintah dalam Penetapan Hari Sidang. Blangkonya di ABT: folder
 * derry_briantono/Relaas "[JS] 9.1 ... (2 Pemohon)" dan "[JS] 9.2 ... (1
 * Pemohon)" - paket ABT abt-pengumuman-itsbat.
 *
 * Satu aturan untuk tiga tempat cetak: panel juru sita per perkara dan cetak
 * massal ekstensi (cermin di ekstensi-sipp/jurusita.js: jurusitaItsbatVoluntair)
 * serta Cetak relaas di Jadwal Sidang portal (rute relaas-massal/cetak memakai
 * tambahPengumumanItsbat di bawah, ekstensi massal membaca rute yang sama).
 */

import { selaraskanPihakRelaas } from "@/lib/relaas-pihak";

export const JENIS_ITSBAT_NIKAH = 360;
export const ALUR_VOLUNTAIR = 16;
export const GOLONGAN_PENGUMUMAN_ITSBAT = "pengumuman-itsbat";
/** Kunci pemetaan blangko (tab Relaas): 2 Pemohon dan 1 Pemohon. */
export const KUNCI_PENGUMUMAN_ITSBAT = "pengumuman-itsbat";
export const KUNCI_PENGUMUMAN_ITSBAT_1P = "pengumuman-itsbat-1p";

/** Itsbat nikah voluntair: jenis 360 DAN alur 16 - keduanya angka SIPP, bukan kata. */
export function itsbatVoluntair(perkara: { jenisPerkaraId?: unknown; alurPerkaraId?: unknown }): boolean {
  return Number(perkara.jenisPerkaraId) === JENIS_ITSBAT_NIKAH && Number(perkara.alurPerkaraId) === ALUR_VOLUNTAIR;
}

/** Jumlah Pemohon (baris perkara_pihak1) dari ruas bot jumlahPihak; null bila tak terbaca. */
export function jumlahPemohon(dok: { jumlahPihak?: { pertama?: unknown } | null }): number | null {
  const n = Number(dok.jumlahPihak?.pertama);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Nama unduhan baku "<nomor, / jadi _> - <nama blangko tanpa .rtf>" - sama
 * dengan alatNamaUnduhanBlangko (ekstensi-sipp/panel-alat.js, 14 Okt) tanpa
 * akhiran; pekerja latar menambahkan ".rtf".
 */
export function namaUnduhanBlangko(nomorPerkara: unknown, berkas: unknown): string {
  const bersih = (s: unknown) =>
    String(s ?? "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  const nomor = bersih(nomorPerkara);
  const batang = bersih(String(berkas ?? "").trim().replace(/\.[A-Za-z0-9]{2,5}$/, "")).replace(/[. ]+$/, "");
  return [nomor, batang].filter(Boolean).join(" - ");
}

type DokumenSumber = {
  kunci: string;
  perkaraId: unknown;
  golongan: string;
  d: unknown;
  jenisPerkaraId?: unknown;
  alurPerkaraId?: unknown;
  pihakDipanggil: string;
  pihakKe?: number | null;
  jumlahPihak?: { pertama?: unknown; kedua?: unknown; lain?: unknown } | null;
  jumlahPihakSasaran?: number | null;
  sudahAdaRelaas?: boolean | null;
  keterangan?: string[];
};

/**
 * Dokumen pengumuman untuk satu dokumen panggilan sidang pertama itsbat
 * voluntair - null untuk dokumen lain. Pihaknya membawa JUMLAH PEMOHON:
 * "pertama" = satu Pemohon (blangko 1P), "keduanya" = dua Pemohon (2P; juga
 * bila jumlahnya tak terbaca - itsbat voluntair hampir selalu suami dan
 * istri). d = sidang pertama (blangko pengumuman tidak memakai variabel
 * sidang; d hanya memenuhi kontrak putaran relaas). sudahAdaRelaas null:
 * pengumuman tidak tercatat di tabel relaas SIPP.
 */
export function dokumenPengumumanItsbat<T extends DokumenSumber>(dok: T): T | null {
  if (dok.golongan !== "sidang-pertama" || !itsbatVoluntair(dok)) return null;
  const n = jumlahPemohon(dok);
  return {
    ...dok,
    kunci: `${GOLONGAN_PENGUMUMAN_ITSBAT}:${String(dok.perkaraId)}:${String(dok.d ?? 0)}:0`,
    golongan: GOLONGAN_PENGUMUMAN_ITSBAT,
    pihakDipanggil: n === 1 ? "pertama" : "keduanya",
    pihakKe: null,
    jumlahPihakSasaran: null,
    sudahAdaRelaas: null,
    keterangan: [
      `Pengumuman permohonan itsbat nikah (${n === 1 ? "1 Pemohon" : "2 Pemohon"}` +
        `${n === null ? " - jumlah Pemohon tidak terbaca" : ""}) - ditempel 14 hari di papan pengumuman.`,
    ],
  } as T;
}

/**
 * Daftar dokumen + pengumuman itsbat tepat SESUDAH panggilan sidang
 * pertamanya. Satu pengumuman per perkara (bot dapat melaporkan sidang pertama
 * yang sama dua kali bila PHS-nya diulang).
 *
 * Panggilan sidang pertama itsbat voluntair yang Pemohonnya terbaca SATU orang
 * (pasangan telah meninggal) dipanggil untuk Pemohon saja: bot menulisnya
 * "keduanya" (sidang pertama selalu dua pihak), dan blangko T (#7109# = Pemohon
 * II pada alur 16) akan tercetak kosong.
 */
export function tambahPengumumanItsbat<T extends DokumenSumber>(dokumen: T[]): T[] {
  const hasil: T[] = [];
  const sudah = new Set<string>();
  for (const mentah of dokumen) {
    // 20 Okt: satu aturan pihak (lib/relaas-pihak.ts) untuk SEMUA permohonan voluntair - itsbat satu Pemohon hanya satu kasus di dalamnya.
    const dok: T = selaraskanPihakRelaas(mentah);
    hasil.push(dok);
    const p = dokumenPengumumanItsbat(dok);
    if (!p || sudah.has(String(dok.perkaraId))) continue;
    sudah.add(String(dok.perkaraId));
    hasil.push(p);
  }
  return hasil;
}
