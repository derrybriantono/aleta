/**
 * Apa yang terkena sebuah tulisan ke bot, untuk singgahan singkat
 * (K2, 25 Okt 2026).
 *
 * Sampai 1.205.39 SETIAP tulisan (termasuk antrean pesan WhatsApp yang tidak
 * menyentuh data perkara sama sekali) membuang SELURUH singgahan, sehingga
 * layar yang dibuka 100 perangkat tetap menembus ke SIPP berkali-kali. Kini
 * tiap jalur tulisan yang DIKENAL menyebut ruang (dan tanggal) yang terkena.
 *
 * Aturan keselamatan: jalur yang tidak dikenal = `undefined` = SEMUA dibuang,
 * seperti dulu. Daftar di bawah hanya boleh MENYEMPITKAN untuk jalur yang
 * sebabnya jelas; menambah jalur ke daftar "tidak menyentuh apa pun" harus
 * disertai alasan.
 */

import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { Terkena } from "@/server/shared/singgah-singkat";

/** Nama ruang singgahan - satu sumber, dipakai pembaca dan penulis. */
export const RUANG_SINGGAH = {
  jadwal: "jadwal-sidang",
  antrian: "antrian-sidang",
  tag: "tag-perkara",
  pegawai: "pegawai-penunjukan",
} as const;

const AWALAN_BOT = "/internal/aleta-bot";
const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Jalur yang BUKAN data perkara/jadwal/antrian/pegawai: kendali WhatsApp,
 * antrean pesan, antrean mati, pekerja, kosakata. Tidak ada satu pun ruang
 * singgahan yang memuat isinya.
 */
const BUKAN_DATA_PERKARA = [/^\/whatsapp\//, /^\/messages\//, /^\/queue\//, /^\/worker\//, /^\/kosakata$/];

function tanggalDariBadan(bodi: unknown): string | null {
  let isi: unknown = bodi;
  if (typeof bodi === "string") {
    try {
      isi = JSON.parse(bodi);
    } catch {
      return null;
    }
  }
  if (!isi || typeof isi !== "object") return null;
  const t = String((isi as Record<string, unknown>).tanggal ?? "").trim();
  return TANGGAL_ISO.test(t) ? t : null;
}

/**
 * @param path  jalur ke bot (boleh dengan awalan /internal/aleta-bot dan kueri)
 * @param bodi  badan permintaan (teks JSON atau objek), bila ada
 * @param hariIni  untuk uji; bawaan hari ini WITA
 * @returns yang terkena, atau `undefined` = tidak tahu = buang semuanya
 */
export function terkenaTulisan(path: string, bodi?: unknown, hariIni?: string): Terkena | undefined {
  let p = String(path || "").split("?")[0];
  if (p.startsWith(AWALAN_BOT)) p = p.slice(AWALAN_BOT.length);

  if (BUKAN_DATA_PERKARA.some((pola) => pola.test(p))) return { ruang: [] };

  const hari = hariIni || waktuPengadilan().tanggal;

  // Antrian hidup hari ini: yang berubah hanya antrian dan jadwal yang
  // memuat HARI INI. Hitungan tag Status Perkara tidak bergantung pada
  // pemanggilan/pemberitahuan.
  if (p === "/antrian/panggil" || p === "/antrian/pemberitahuan") {
    return { ruang: [RUANG_SINGGAH.antrian, RUANG_SINGGAH.jadwal], tanggal: [hari] };
  }
  // Kehadiran hari ini juga bisa mengubah penanda perkara (tag).
  if (p === "/antrian/hadir" || p === "/antrian/batal-hadir" || p === "/antrian/kehadiran/keadaan") {
    return { ruang: [RUANG_SINGGAH.antrian, RUANG_SINGGAH.jadwal, RUANG_SINGGAH.tag], tanggal: [hari] };
  }
  // Sinkron antrian satu tanggal: bertanggal bila badannya menyebutnya.
  if (p === "/antrian/sinkron") {
    const t = tanggalDariBadan(bodi);
    return { ruang: [RUANG_SINGGAH.antrian, RUANG_SINGGAH.jadwal], ...(t ? { tanggal: [t] } : {}) };
  }

  // Sidang (tunda, putus, ikrar), penetapan: mengubah jadwal, antrian, dan
  // penanda perkara; TIDAK mengubah daftar hakim/panitera/SK tetap. Tanggal
  // sidang aslinya tidak ada di badan (hanya jadwalId), jadi semua kunci
  // jadwal dibuang.
  if (p.startsWith("/sidang/") || p.startsWith("/penetapan/") || p.startsWith("/dokumen-penetapan/")) {
    return { ruang: [RUANG_SINGGAH.jadwal, RUANG_SINGGAH.antrian, RUANG_SINGGAH.tag] };
  }

  return undefined;
}
