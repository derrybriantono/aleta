import { type AletaDatabase } from "@/server/db/client";

/**
 * Siapa yang SEDANG berwenang menandatangani PMH.
 *
 * ============================================================================
 * URUTANNYA: KETUA - WAKIL - PLH
 * ============================================================================
 *
 * Wakil Ketua TIDAK perlu diangkat sebagai Plh untuk menandatangani. Jabatannya
 * memang sejajar dengan Ketua; ketika Ketua tidak hadir, Wakil mengerjakannya
 * SEBAGAI Wakil Ketua, bukan sebagai pelaksana harian orang lain. Menuntut SK
 * Plh untuk itu berarti menuntut surat yang di praktiknya memang tidak pernah
 * dibuat - dan penetapan berhenti menunggu surat yang tidak akan datang.
 *
 * Plh baru dipakai ketika Ketua DAN Wakil sama-sama tidak ada. Yang ditunjuk
 * biasanya seorang Hakim; bila hakim pun tidak ada, barulah Panitera atau
 * Sekretaris. Karena itu Plh diperiksa PALING AKHIR, bukan paling awal.
 *
 * Rancangan sebelumnya membalik urutan ini - Plh menang atas Ketua definitif -
 * dan akibatnya dua-duanya salah: Wakil yang seharusnya langsung berwenang
 * malah dituntut SK, sementara Ketua yang hadir bisa tergeser oleh SK lama yang
 * lupa ditutup.
 *
 * ============================================================================
 * DUA HAL YANG BERBEDA, DIBACA DARI DUA TEMPAT
 * ============================================================================
 *
 * KETIDAKHADIRAN dibaca dari cuti yang sudah disetujui (hr_leave_requests) -
 * itulah yang menjawab "apakah Ketua ada hari ini".
 *
 * PENUNJUKAN dibaca dari acting_assignments - itulah yang menjawab "siapa yang
 * ditunjuk bila keduanya tidak ada". Keduanya tidak dapat saling menggantikan:
 * cuti tidak memberi kewenangan kepada siapa pun, dan penunjukan tidak
 * membuktikan siapa pun sedang pergi.
 */

export type PejabatBertugas = {
  /** Pengguna ALETA yang ditunjuk sebagai pelaksana. */
  userId: string;
  /** "PLH" atau "PLT". */
  tipe: string;
  mulai: string;
  selesai: string | null;
};

type BarisPenugasan = {
  user_id_pengganti: string;
  tipe: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
};

type BarisCuti = { user_id: string };

/**
 * Penunjukan PLH/PLT yang berlaku pada satu tanggal untuk satu jabatan.
 *
 * Tanggalnya dibandingkan sebagai teks ISO - sah selama keduanya berawalan
 * tahun-bulan-hari, dan itulah bentuk yang dipakai di seluruh basis data ini.
 * Hanya awalan tanggal yang diambil, supaya nilai yang tersimpan lengkap dengan
 * jamnya tidak meleset sehari.
 */
export async function pejabatBertugas(
  db: AletaDatabase,
  jabatanId: string,
  padaTanggal: string
): Promise<PejabatBertugas | null> {
  const hari = String(padaTanggal || "").slice(0, 10);
  if (!hari) return null;

  try {
    const baris = await db
      .prepare(
        `SELECT user_id_pengganti, tipe, tanggal_mulai, tanggal_selesai
           FROM acting_assignments
          WHERE deleted_at IS NULL
            AND jabatan_id_target = ?
            AND substr(tanggal_mulai, 1, 10) <= ?
            AND (tanggal_selesai IS NULL OR substr(tanggal_selesai, 1, 10) >= ?)
          ORDER BY tanggal_mulai DESC`
      )
      .all<BarisPenugasan>(jabatanId, hari, hari);

    const dipakai = baris[0];
    if (!dipakai) return null;

    return {
      userId: dipakai.user_id_pengganti,
      tipe: String(dipakai.tipe || "PLH").toUpperCase(),
      mulai: dipakai.tanggal_mulai,
      selesai: dipakai.tanggal_selesai,
    };
  } catch {
    // Tabel penugasan belum ada di pemasangan lama. Yang benar di situ adalah
    // meneruskan rantai Ketua - Wakil seperti biasa, BUKAN menggagalkan seluruh
    // rencana penetapan.
    return null;
  }
}

/**
 * Siapa saja yang sedang cuti pada satu tanggal.
 *
 * Hanya cuti BERSTATUS DISETUJUI yang dihitung. Pengajuan yang masih menunggu
 * tanda tangan belum memindahkan kewenangan apa pun - memperlakukannya sebagai
 * ketidakhadiran berarti Ketua yang mengajukan cuti langsung kehilangan
 * wewenangnya sebelum cutinya sendiri disetujui.
 *
 * Dikembalikan sebagai himpunan id pengguna ALETA, bukan id pegawai, supaya
 * pemanggilnya tidak perlu tahu tabel kepegawaian sama sekali.
 */
export async function yangSedangCuti(db: AletaDatabase, padaTanggal: string): Promise<Set<string>> {
  const hari = String(padaTanggal || "").slice(0, 10);
  if (!hari) return new Set();

  try {
    const baris = await db
      .prepare(
        `SELECT p.user_id
           FROM hr_leave_requests c
           JOIN employee_profiles p ON p.id = c.employee_id
          WHERE c.deleted_at IS NULL
            AND c.status = 'approved'
            AND substr(c.start_date, 1, 10) <= ?
            AND substr(c.end_date, 1, 10) >= ?`
      )
      .all<BarisCuti>(hari, hari);

    return new Set(baris.map((x) => x.user_id).filter(Boolean));
  } catch {
    // Modul kepegawaian belum terpasang. Yang benar adalah menganggap semua
    // hadir - menebak sebaliknya akan memindahkan tanda tangan tanpa dasar.
    return new Set();
  }
}
