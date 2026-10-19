/**
 * Jadwal sidang dari bot DENGAN singgahan singkat (performa muat 19 Okt 2026).
 *
 * Satu jadwal sidang = ±40 kueri SIPP di bot (terukur di server 19 Okt: hari
 * ini 18 sidang 190-220 ms, sepekan 330-480 ms, sebulan 0,9-1,0 detik). Jadwal
 * yang SAMA ditanyakan berulang oleh banyak pemanggil sekaligus: layar Jadwal
 * Sidang tiap tab, widget kehadiran-saya di ekstensi, Perkara Saya, dan layar
 * publik antrian/ruang sidang yang memuat ulang sendiri. Sebelumnya tiap
 * permintaan menembakkan seluruh kuerinya sendiri.
 *
 * Kini permintaan yang sama dalam 4 detik (ALETA_SINGGAH_JADWAL_MS) memakai
 * satu jawaban, dan yang serentak menunggu satu kueri. Tulisan lewat bot
 * (tunda, putus, kehadiran, panggilan, penetapan, aksi e-Court) membuang
 * singgahan seketika - lihat tandaiTulisan di gatewayFetch. Yang diubah
 * langsung di SIPP di luar ALETA tampil paling lambat 4 detik kemudian.
 *
 * Hanya jawaban yang BERHASIL disinggahkan; galat selalu ditanyakan ulang.
 */

import { getGatewayJadwalSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { singgahSingkat, ttlDariEnv } from "@/server/shared/singgah-singkat";

export const RUANG_SINGGAH_JADWAL = "jadwal-sidang";

/** Lama singgahan (ms). Bawaan 4 detik; di lingkungan uji mati kecuali env diisi. */
export function ttlSinggahJadwal() {
  return ttlDariEnv("ALETA_SINGGAH_JADWAL_MS", process.env.NODE_ENV === "test" ? 0 : 4000);
}

type MasukanJadwal = Parameters<typeof getGatewayJadwalSidang>[0];

/** Kunci yang sama = permintaan ke bot yang sama persis. */
export function kunciSinggahJadwal(p: MasukanJadwal) {
  return JSON.stringify([
    String(p.dari || ""),
    String(p.sampai || ""),
    String(p.cari || ""),
    Number(p.batas) || 0,
    p.waktu === true,
  ]);
}

export function getGatewayJadwalSidangSinggah(
  p: MasukanJadwal
): ReturnType<typeof getGatewayJadwalSidang> {
  return singgahSingkat(RUANG_SINGGAH_JADWAL, kunciSinggahJadwal(p), ttlSinggahJadwal(), () => getGatewayJadwalSidang(p), {
    simpanBila: (hasil) => hasil.ok === true,
  });
}
