import type { BarisRekamAntrian } from "@/lib/rekam-antrian";
import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * REKAM ANTRIAN - PENULISAN DAN PEMBACAAN
 * ============================================================================
 *
 * Salinan ALETA atas antrian sidang. Sebab lengkapnya di
 * drizzle/0048_rekam_antrian.sql; penyusunan barisnya di lib/rekam-antrian.ts.
 */

export type RekamAntrianTersimpan = BarisRekamAntrian & {
  pertamaDirekamAt: string;
  direkamAt: string;
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();
const angka = (nilai: unknown): number | null =>
  nilai === null || nilai === undefined || nilai === "" ? null : Number(nilai);

function dariBaris(row: Record<string, unknown>): RekamAntrianTersimpan {
  return {
    id: teks(row.id),
    tanggalSidang: teks(row.tanggal_sidang),
    sidangId: teks(row.sidang_id),
    perkaraId: teks(row.perkara_id),
    nomorPerkara: teks(row.nomor_perkara),
    ruangan: teks(row.ruangan),
    nomorAntrian: angka(row.nomor_antrian),
    urutanRuang: angka(row.urutan_ruang),
    waktuAmbil: teks(row.waktu_ambil),
    jamPanggil: teks(row.jam_panggil),
    online: Number(row.online) === 1,
    keadaan: teks(row.keadaan),
    namaPetugas: teks(row.nama_petugas),
    jarakSebelumMenit: angka(row.jarak_sebelum_menit),
    jarakBerikutMenit: angka(row.jarak_berikut_menit),
    pertamaDirekamAt: teks(row.pertama_direkam_at),
    direkamAt: teks(row.direkam_at),
  };
}

/**
 * Menulis - atau memperbarui - rekaman antrian.
 *
 * ============================================================================
 * KEGAGALANNYA TIDAK BOLEH MENJATUHKAN JADWALNYA
 * ============================================================================
 *
 * Fungsi ini dipanggil dari rute jadwal sidang, di jalur yang sama dengan
 * pemuatan daftar. Rekaman adalah catatan tambahan; jadwal sidang adalah
 * pekerjaan yang sedang dikerjakan orang. Satu galat menulis - kolom yang
 * belum ada karena migrasi belum dijalankan, basis data yang sedang terkunci -
 * tidak boleh membuat layar jadwal kosong.
 *
 * Karena itu yang dipulangkan jumlah yang berhasil ditulis beserta sebab
 * gagalnya, BUKAN lemparan. Yang memanggil menyebutkannya, tidak menghentikan
 * apa pun.
 *
 * ============================================================================
 * pertama_direkam_at TIDAK IKUT DITIMPA
 * ============================================================================
 *
 * Ia menyatakan kapan ALETA pertama kali melihat baris itu - keterangan yang
 * hilang selamanya kalau tertimpa tiap kali layar dimuat ulang, dan layar ini
 * memuat ulang sendiri secara berkala.
 */
export async function rekamAntrian(
  db: AletaDatabase,
  baris: BarisRekamAntrian[]
): Promise<{ ditulis: number; gagal: string }> {
  if (!Array.isArray(baris) || baris.length === 0) return { ditulis: 0, gagal: "" };

  const sekarang = new Date().toISOString();
  let ditulis = 0;
  try {
    for (const satu of baris) {
      if (!satu.id || !satu.sidangId || !satu.tanggalSidang) continue;
      await db.run(
        `INSERT INTO aleta_rekam_antrian
           (id, tanggal_sidang, sidang_id, perkara_id, nomor_perkara, ruangan,
            nomor_antrian, urutan_ruang, waktu_ambil, jam_panggil, online, keadaan,
            nama_petugas, jarak_sebelum_menit, jarak_berikut_menit,
            pertama_direkam_at, direkam_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           tanggal_sidang = excluded.tanggal_sidang,
           sidang_id = excluded.sidang_id,
           perkara_id = excluded.perkara_id,
           nomor_perkara = excluded.nomor_perkara,
           ruangan = excluded.ruangan,
           nomor_antrian = excluded.nomor_antrian,
           urutan_ruang = excluded.urutan_ruang,
           waktu_ambil = excluded.waktu_ambil,
           jam_panggil = excluded.jam_panggil,
           online = excluded.online,
           keadaan = excluded.keadaan,
           nama_petugas = excluded.nama_petugas,
           jarak_sebelum_menit = excluded.jarak_sebelum_menit,
           jarak_berikut_menit = excluded.jarak_berikut_menit,
           direkam_at = excluded.direkam_at`,
        [
          satu.id,
          satu.tanggalSidang,
          satu.sidangId,
          satu.perkaraId,
          satu.nomorPerkara,
          satu.ruangan,
          satu.nomorAntrian,
          satu.urutanRuang,
          satu.waktuAmbil,
          satu.jamPanggil,
          satu.online ? 1 : 0,
          satu.keadaan,
          satu.namaPetugas,
          satu.jarakSebelumMenit,
          satu.jarakBerikutMenit,
          sekarang,
          sekarang,
        ]
      );
      ditulis += 1;
    }
  } catch (kesalahan) {
    return {
      ditulis,
      gagal: kesalahan instanceof Error ? kesalahan.message : "gagal merekam antrian",
    };
  }
  return { ditulis, gagal: "" };
}

/** Rekaman satu rentang tanggal, urut per hari lalu per ruang lalu urutannya. */
export async function bacaRekamAntrian(
  db: AletaDatabase,
  dari: string,
  sampai: string
): Promise<RekamAntrianTersimpan[]> {
  const a = teks(dari);
  const b = teks(sampai) || a;
  if (!a) return [];
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_rekam_antrian
      WHERE tanggal_sidang >= ? AND tanggal_sidang <= ?
      ORDER BY tanggal_sidang ASC, ruangan ASC, urutan_ruang ASC, nomor_antrian ASC`,
    [a, b]
  );
  return baris.map(dariBaris);
}

/** Riwayat antrian satu perkara, lintas hari sidangnya. */
export async function riwayatAntrianPerkara(
  db: AletaDatabase,
  perkaraId: string
): Promise<RekamAntrianTersimpan[]> {
  const id = teks(perkaraId);
  if (!id) return [];
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_rekam_antrian
      WHERE perkara_id = ?
      ORDER BY tanggal_sidang DESC`,
    [id]
  );
  return baris.map(dariBaris);
}

/**
 * Ringkasan sehari: berapa yang mengambil nomor, berapa yang tidak, dan
 * jarak antar perkara di tiap ruang.
 *
 * Rata-rata TIDAK dipakai sendirian. Satu ruang dengan jeda tiga jam di siang
 * hari menghasilkan rata-rata yang tampak longgar padahal paginya berdesakan;
 * karena itu yang dipulangkan juga yang terapat dan yang terenggang.
 */
export function ringkasRekamAntrian(baris: RekamAntrianTersimpan[]) {
  const jarak = baris
    .map((x) => x.jarakBerikutMenit)
    .filter((x): x is number => typeof x === "number");
  return {
    jumlah: baris.length,
    mengambilNomor: baris.filter((x) => typeof x.nomorAntrian === "number").length,
    online: baris.filter((x) => x.online).length,
    petugas: [...new Set(baris.map((x) => x.namaPetugas).filter(Boolean))],
    jarakTerapat: jarak.length ? Math.min(...jarak) : null,
    jarakTerenggang: jarak.length ? Math.max(...jarak) : null,
    jarakRerata: jarak.length
      ? Math.round(jarak.reduce((n, x) => n + x, 0) / jarak.length)
      : null,
  };
}
