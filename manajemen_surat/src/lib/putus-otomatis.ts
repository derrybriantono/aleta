import { KEHADIRAN_KEDUA, KEHADIRAN_TIDAK_ADA } from "@/lib/bawaan-tunda";
import type { PetaLibur } from "@/lib/hari-libur";
import {
  hadirPertamaHariIni,
  jamPemicuSah,
  putuskanTundaOtomatis,
  JAM_PEMICU_BAWAAN,
  type MasukanTundaOtomatis,
} from "@/lib/tunda-otomatis";

/**
 * ============================================================================
 * PUTUS OTOMATIS GUGUR / TIDAK DAPAT DITERIMA (22 Okt 2026) - FUNGSI MURNI
 * ============================================================================
 *
 * Permintaan hakim: perkara yang Penggugat/Pemohonnya tidak hadir sampai jam
 * pemicu (16.30; 14.00 pada hari sidang keliling aktif) dicatat putus GUGUR
 * atau TIDAK DAPAT DITERIMA, lalu (bila blangko Derry yang pas tersedia)
 * putusannya disusun dan e-Doc putusan + anonimisasi diunggah lewat Jadwalkan
 * Putusan.
 *
 * Sasaran memakai aturan 7/8 tunda otomatis (@/lib/tunda-otomatis), sehingga
 * kedua saklar tidak pernah berselisih:
 *   7  tidak hadir sidang pertama dan kedua                 -> gugur
 *   8  hadir sidang pertama, lalu tidak hadir 2x berturut   -> tidak dapat diterima
 *      (keputusan pengguna 22 Okt: bawaan TIDAK DAPAT DITERIMA; dapat diganti
 *      "gugur" di setelan)
 * Tidak pernah untuk: Penggugat/Pemohon yang TERCATAT hadir hari itu (baris
 * SIPP, antrian, atau kehadiran rinci ALETA), ikrar talak, verzet, eksekusi,
 * perkara ber-Court Calendar yang kehadirannya tidak tercatat (aturan 3:
 * dianggap hadir), dan semua yang dilewati tunda otomatis.
 */

export type StatusPutusOtomatis = "gugur" | "tidak-dapat-diterima";

export type SetelanPutusOtomatis = {
  /** Saklar utama. Bawaan MATI. */
  nyala: boolean;
  /** Mode kering: menyusun daftar tanpa menulis. Bawaan NYALA. */
  kering: boolean;
  /** Hasil aturan 8 (hadir lalu absen 2x): bawaan tidak dapat diterima. */
  hasilAturan8: StatusPutusOtomatis;
  /** Sub-pilihan: susun putusan dari blangko Derry + unggah e-Doc (keputusan pengguna 22 Okt: bawaan aktif bila saklar menyala). */
  unggahEdoc: boolean;
  jam: string;
  diubahOleh: string;
  diubahOlehId: string;
  diubahPada: string;
  ip: string;
};

export const SETELAN_PUTUS_BAWAAN: SetelanPutusOtomatis = Object.freeze({
  nyala: false,
  kering: true,
  hasilAturan8: "tidak-dapat-diterima",
  unggahEdoc: true,
  jam: JAM_PEMICU_BAWAAN,
  diubahOleh: "",
  diubahOlehId: "",
  diubahPada: "",
  ip: "",
});

const teks = (x: unknown) => String(x ?? "").trim();

export function bersihkanSetelanPutus(mentah: unknown): SetelanPutusOtomatis {
  const s = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  return {
    nyala: s.nyala === true,
    kering: s.kering !== false,
    hasilAturan8: s.hasilAturan8 === "gugur" ? "gugur" : "tidak-dapat-diterima",
    unggahEdoc: s.unggahEdoc !== false,
    jam: jamPemicuSah(s.jam),
    diubahOleh: teks(s.diubahOleh).slice(0, 120),
    diubahOlehId: teks(s.diubahOlehId).slice(0, 80),
    diubahPada: teks(s.diubahPada).slice(0, 40),
    ip: teks(s.ip).slice(0, 64),
  };
}

export const NAMA_STATUS: Readonly<Record<StatusPutusOtomatis, string>> = {
  gugur: "Gugur",
  "tidak-dapat-diterima": "Tidak Dapat Diterima",
};

/** Pola nama status_putusan SIPP untuk tiap hasil (satker memakai "Gugur"/"Digugurkan" dan "Tidak Dapat Diterima"). */
export const POLA_STATUS: Readonly<Record<StatusPutusOtomatis, RegExp>> = {
  gugur: /gugur/i,
  "tidak-dapat-diterima": /tidak\s+dapat\s+diterima/i,
};

/** Id status_putusan yang paling sering dipakai satker untuk hasil itu. null = tidak ada. */
export function pilihStatusPutusan(daftar: Array<{ id: unknown; nama: unknown; dipakai?: unknown }>, status: StatusPutusOtomatis): { id: number; nama: string } | null {
  const cocok = daftar
    .filter((d) => POLA_STATUS[status].test(teks(d.nama)) && Number(d.id) > 0)
    .sort((a, b) => Number(b.dipakai ?? 0) - Number(a.dipakai ?? 0));
  return cocok[0] ? { id: Number(cocok[0].id), nama: teks(cocok[0].nama) } : null;
}

export type SebabLewatiPutus = "bukan-sasaran" | "hadir-tercatat" | "eksekusi" | "dibatalkan-petugas";

export type KeputusanPutusOtomatis =
  | {
      jenis: "putus";
      status: StatusPutusOtomatis;
      nomorAturan: 7 | 8;
      penjelasan: string;
      /** dihadiri_oleh yang ditulis: 3 bila hanya pihak kedua tercatat hadir, selain itu 4. */
      kehadiran: number;
      tanda: string[];
    }
  | { jenis: "lewati"; sebab: SebabLewatiPutus; penjelasan: string };

export function putuskanPutusOtomatis(
  m: MasukanTundaOtomatis,
  setelan: Pick<SetelanPutusOtomatis, "hasilAturan8">,
  peta?: PetaLibur
): KeputusanPutusOtomatis {
  if (m.dibatalkan) return { jenis: "lewati", sebab: "dibatalkan-petugas", penjelasan: `Ditandai "jangan putus otomatis"${m.dibatalkan.oleh ? ` oleh ${m.dibatalkan.oleh}` : ""}.` };
  if (/eksekusi/i.test(teks(m.jenisPerkara))) return { jenis: "lewati", sebab: "eksekusi", penjelasan: "Perkara eksekusi tidak diputus otomatis." };
  if (hadirPertamaHariIni(m) === true && !m.ditunda) {
    return { jenis: "lewati", sebab: "hadir-tercatat", penjelasan: "Penggugat/Pemohon tercatat hadir hari ini - tidak diputus otomatis." };
  }
  // Pembatalan tunda otomatis tidak berlaku di sini - masing-masing saklar punya daftarnya.
  const t = putuskanTundaOtomatis({ ...m, dibatalkan: null }, peta);
  if (t.jenis !== "gugur" && t.jenis !== "tidak-dapat-diterima") {
    return { jenis: "lewati", sebab: "bukan-sasaran", penjelasan: t.jenis === "lewati" ? t.penjelasan : "Bukan perkara gugur/tidak dapat diterima menurut aturan." };
  }
  const status: StatusPutusOtomatis = t.jenis === "gugur" ? "gugur" : setelan.hasilAturan8;
  const sandi = Number(m.dihadiriOlehSekarang);
  const kehadiran = sandi === KEHADIRAN_KEDUA || m.antrian?.hadirPihak2 ? KEHADIRAN_KEDUA : KEHADIRAN_TIDAK_ADA;
  return {
    jenis: "putus",
    status,
    nomorAturan: t.nomorAturan as 7 | 8,
    penjelasan: `${t.penjelasan.replace(/ Bukan ditunda:.*$/, "")} Dicatat putus ${NAMA_STATUS[status].toUpperCase()}.`,
    kehadiran,
    tanda: t.tanda,
  };
}

export function kalimatSetelanPutus(s: SetelanPutusOtomatis): string {
  if (!s.nyala) return "Mati - tidak ada yang diputus otomatis.";
  const jam = s.jam.replace(":", ".");
  if (s.kering) return `Mode kering - pukul ${jam} daftar usulan putus disusun, TIDAK ada yang ditulis ke SIPP.`;
  return `Menyala - pukul ${jam} keterangan putus gugur/tidak dapat diterima dicatat${s.unggahEdoc ? ", putusan disusun dan e-Doc diunggah bila blangkonya pas" : ""}.`;
}
