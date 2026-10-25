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
 *
 * K2 (25 Okt 2026): LAYAR PUBLIK MEMINJAM JAWABAN LAYAR JADWAL. Layar Jadwal
 * menanyakan hari ini dengan `waktu: true` dan batas 200; layar publik
 * (antrian-publik, antrian-tampil, sidang-ruang) menanyakan hal yang sama
 * dengan `waktu` mati dan batas berbeda - kunci lain, kueri SIPP lain.
 * Jawaban `waktu: true` adalah himpunan-atas (jadwal yang sama + waktu antrian
 * dan kehadiran rinci), jadi permintaan tanpa `waktu` memakainya bila sudah
 * ada di singgahan, dan batas yang berbeda memakai jawaban batas lain selama
 * daftarnya utuh (tidak terpotong oleh batasnya sendiri) dan muat di batas
 * yang diminta.
 * Sebaliknya TIDAK berlaku: permintaan `waktu: true` tidak pernah dilayani
 * jawaban tanpa waktu, dan layar publik tidak memicu kueri waktu antrian
 * sendiri (bila layar Jadwal tidak dibuka, ia bertanya dengan kuncinya
 * sendiri seperti dulu).
 *
 * A4 (25 Okt 2026): CERMIN PERKARA. Bila saklar `jadwal` menyala dan cermin
 * segar, daftar sidang dibaca dari cermin (satu baca Postgres) alih-alih
 * ±40 kueri SIPP; bila tidak, jalur lama persis seperti sebelumnya. Lihat
 * cermin/jadwal-cermin.ts. Singgahan di sini tetap berlaku di atas keduanya.
 */

import { bacaJadwalDariCermin } from "@/server/modules/cermin/jadwal-cermin";
import { getGatewayJadwalSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { RUANG_SINGGAH } from "@/server/modules/aleta-bot/singgah-tulisan";
import { intipSinggah, singgahSingkat, ttlDariEnv, type Cakupan } from "@/server/shared/singgah-singkat";

export const RUANG_SINGGAH_JADWAL = RUANG_SINGGAH.jadwal;

/** Lama singgahan (ms). Bawaan 4 detik; di lingkungan uji mati kecuali env diisi. */
export function ttlSinggahJadwal() {
  return ttlDariEnv("ALETA_SINGGAH_JADWAL_MS", process.env.NODE_ENV === "test" ? 0 : 4000);
}

/**
 * K1 tahap 1 (A4, 25 Okt 2026): bacaan RINGAN (kolom yang berubah sepanjang hari, 8 detik per layar)
 * dan keadaan DISIDANG (5 detik per layar/widget) dibagi SEMUA perangkat: permintaan serentak
 * menunggu satu bacaan bot dan jawabannya dipakai bersama sebentar. Tulisan sidang/antrian
 * membuangnya seketika (singgah-tulisan.ts). ALETA_SINGGAH_RINGAN_MS / _DISIDANG_MS; "0" mematikan;
 * di lingkungan uji mati kecuali env diisi.
 */
export function ttlSinggahRingan() {
  return ttlDariEnv("ALETA_SINGGAH_RINGAN_MS", process.env.NODE_ENV === "test" ? 0 : 2500);
}
export function ttlSinggahDisidang() {
  return ttlDariEnv("ALETA_SINGGAH_DISIDANG_MS", process.env.NODE_ENV === "test" ? 0 : 2000);
}

type MasukanJadwal = Parameters<typeof getGatewayJadwalSidang>[0];
type HasilJadwal = Awaited<ReturnType<typeof getGatewayJadwalSidang>>;

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

const TANGGAL_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Rentang tanggal kunci ini; tak diketahui (kosong/bukan ISO) = undefined = selalu terkena tulisan. */
export function cakupanJadwal(p: MasukanJadwal): Cakupan | undefined {
  const dari = String(p.dari || "").trim();
  const sampai = String(p.sampai || "").trim() || dari;
  if (!TANGGAL_ISO.test(dari) || !TANGGAL_ISO.test(sampai) || sampai < dari) return undefined;
  return { dari, sampai };
}

/** Batas yang dipakai layar-layar (Jadwal 200, layar publik 50/200/500). */
const BATAS_LAZIM = [200, 500];

/**
 * Kunci jawaban yang boleh dipinjam permintaan ini: rentang dan pencarian yang
 * sama, `waktu: true` (himpunan-atas) dan/atau batas lain yang lazim. Tanpa
 * kunci permintaan sendiri; urut dari batas yang paling dekat. Kelayakan tiap
 * jawaban (utuh, muat di batas yang diminta) diperiksa pinjamJawaban.
 */
export function kunciPinjaman(p: MasukanJadwal): Array<{ kunci: string; batas: number }> {
  const batasDiminta = Number(p.batas) || 0;
  if (batasDiminta <= 0) return [];
  const sendiri = kunciSinggahJadwal(p);
  const batas = [...new Set([batasDiminta, ...BATAS_LAZIM])].sort((a, b) => Math.abs(a - batasDiminta) - Math.abs(b - batasDiminta));
  const hasil: Array<{ kunci: string; batas: number }> = [];
  for (const waktu of p.waktu === true ? [true] : [true, false]) {
    for (const b of batas) {
      const kunci = kunciSinggahJadwal({ ...p, batas: b, waktu });
      if (kunci !== sendiri) hasil.push({ kunci, batas: b });
    }
  }
  return hasil;
}

function pinjamJawaban(p: MasukanJadwal): HasilJadwal | undefined {
  const batasDiminta = Number(p.batas) || 0;
  for (const calon of kunciPinjaman(p)) {
    const ada = intipSinggah<HasilJadwal>(RUANG_SINGGAH_JADWAL, calon.kunci);
    if (!ada || ada.ok !== true) continue;
    // Batas lain hanya dipinjam bila daftarnya UTUH (tidak terpotong oleh
    // batasnya sendiri) dan muat di batas yang diminta; selain itu hasilnya
    // bisa berbeda dari kueri sendiri.
    if (calon.batas !== batasDiminta) {
      const jumlah = Array.isArray(ada.data?.sidang) ? ada.data.sidang.length : Number.POSITIVE_INFINITY;
      if (jumlah > batasDiminta || jumlah >= calon.batas) continue;
    }
    return ada;
  }
  return undefined;
}

/**
 * Sumber daftar sidang: cermin bila boleh, selain itu bot/SIPP. Di lingkungan
 * uji cermin dilewati kecuali ALETA_CERMIN_JADWAL_UJI=1 (uji lain tidak boleh
 * menyentuh basis data hanya karena membaca jadwal).
 */
async function jadwalSumber(p: MasukanJadwal): Promise<HasilJadwal> {
  if (process.env.NODE_ENV !== "test" || process.env.ALETA_CERMIN_JADWAL_UJI === "1") {
    const dariCermin = await bacaJadwalDariCermin(p);
    if (dariCermin) return dariCermin as unknown as HasilJadwal;
  }
  return getGatewayJadwalSidang(p);
}

export function getGatewayJadwalSidangSinggah(p: MasukanJadwal): ReturnType<typeof getGatewayJadwalSidang> {
  const ttl = ttlSinggahJadwal();
  if (ttl > 0) {
    const pinjaman = pinjamJawaban(p);
    if (pinjaman) return Promise.resolve(pinjaman);
  }
  return singgahSingkat(RUANG_SINGGAH_JADWAL, kunciSinggahJadwal(p), ttl, () => jadwalSumber(p), {
    simpanBila: (hasil) => hasil.ok === true,
    cakupan: cakupanJadwal(p),
  });
}
