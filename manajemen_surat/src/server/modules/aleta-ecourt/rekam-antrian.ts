import { gabungRekamLampau, type BarisRekamAntrian } from "@/lib/rekam-antrian";
import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * REKAM ANTRIAN - PENULISAN DAN PEMBACAAN
 * ============================================================================
 *
 * Salinan ALETA atas antrian sidang. Sebab lengkapnya di
 * drizzle/0048_rekam_antrian.sql; penyusunan barisnya di lib/rekam-antrian.ts.
 */

export type RekamAntrianTersimpan = Omit<BarisRekamAntrian, "adaWaktu" | "bersumber"> & {
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
    waktuAmbilLengkap: teks(row.waktu_ambil_lengkap),
    jamJadwal: teks(row.jam_jadwal),
    waktuPanggilPertama: teks(row.waktu_panggil_pertama),
    waktuPanggilLengkap: teks(row.waktu_panggil_lengkap),
    jumlahPanggil: Number(row.jumlah_panggil) || 0,
    menungguDetik: angka(row.menunggu_detik),
    jarakSebelumDetik: angka(row.jarak_sebelum_detik),
    lamaSidangDetik: angka(row.lama_sidang_detik),
    pertamaDirekamAt: teks(row.pertama_direkam_at),
    direkamAt: teks(row.direkam_at),
  };
}

/**
 * Kolom 0051 pada SET pembaruan - HANYA bila waktunya terbaca pada pemuatan
 * ini. Bila tidak, kolom-kolom itu tidak disebut sama sekali dan nilai yang
 * sudah tersimpan tetap: bot yang sedang tidak menjawab tidak boleh
 * menghapus jarak yang sudah tercatat dengan kosong.
 */
const SET_WAKTU = `,
           waktu_ambil_lengkap = excluded.waktu_ambil_lengkap,
           jam_jadwal = excluded.jam_jadwal,
           waktu_panggil_pertama = excluded.waktu_panggil_pertama,
           waktu_panggil_lengkap = excluded.waktu_panggil_lengkap,
           jumlah_panggil = excluded.jumlah_panggil,
           menunggu_detik = excluded.menunggu_detik,
           jarak_sebelum_detik = excluded.jarak_sebelum_detik,
           lama_sidang_detik = excluded.lama_sidang_detik`;

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
 *
 * ============================================================================
 * KOLOM 0051 HANYA DITIMPA OLEH WAKTU YANG TERBACA
 * ============================================================================
 *
 * Baris yang adaWaktu-nya false tetap ditulis - kolom lamanya berasal dari
 * aplikasi antrian yang terbaca - tetapi delapan kolom berdetik tidak ikut
 * disebut pada SET-nya. Lihat SET_WAKTU.
 *
 * ============================================================================
 * HARI LAMPAU DIGABUNG DENGAN YANG TERSIMPAN, TIDAK DITIMPA
 * ============================================================================
 *
 * Temuan penelaah 27 September 2026: pemuatan esok hari menimpa rekaman hari
 * lampau yang benar dengan NULL. Baris bertanda `lampau` kini dibaca dulu
 * pasangan tersimpannya, lalu digabung lewat gabungRekamLampau - yang kosong
 * tidak menimpa yang terisi, dan panggilan tidak mundur. Hari ini tetap
 * ditimpa apa adanya: di sana data langsung yang benar, dan "belum ada lama
 * sidangnya" pada perkara yang dipanggil ulang memang keadaan yang baru.
 */
export async function rekamAntrian(
  db: AletaDatabase,
  baris: BarisRekamAntrian[]
): Promise<{ ditulis: number; gagal: string }> {
  if (!Array.isArray(baris) || baris.length === 0) return { ditulis: 0, gagal: "" };

  const sekarang = new Date().toISOString();
  let ditulis = 0;
  try {
    const idLampau = [...new Set(baris.filter((b) => b.lampau && b.id).map((b) => b.id))];
    const tersimpan = new Map<string, RekamAntrianTersimpan>();
    for (let mulai = 0; mulai < idLampau.length; mulai += 200) {
      const bagian = idLampau.slice(mulai, mulai + 200);
      const rows = await db.queryAll<Record<string, unknown>>(
        `SELECT * FROM aleta_rekam_antrian WHERE id IN (${bagian.map(() => "?").join(", ")})`,
        bagian
      );
      for (const row of rows) tersimpan.set(teks(row.id), dariBaris(row));
    }

    for (const asli of baris) {
      if (!asli.id || !asli.sidangId || !asli.tanggalSidang) continue;
      const satu = asli.lampau ? gabungRekamLampau(tersimpan.get(asli.id), asli) : asli;
      const adaWaktu = satu.adaWaktu === true;
      await db.run(
        `INSERT INTO aleta_rekam_antrian
           (id, tanggal_sidang, sidang_id, perkara_id, nomor_perkara, ruangan,
            nomor_antrian, urutan_ruang, waktu_ambil, jam_panggil, online, keadaan,
            nama_petugas, jarak_sebelum_menit, jarak_berikut_menit,
            pertama_direkam_at, direkam_at,
            waktu_ambil_lengkap, jam_jadwal, waktu_panggil_pertama, waktu_panggil_lengkap,
            jumlah_panggil, menunggu_detik, jarak_sebelum_detik, lama_sidang_detik)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           direkam_at = excluded.direkam_at${adaWaktu ? SET_WAKTU : ""}`,
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
          // Baris BARU tanpa waktu terbaca mendapat bawaan kolomnya; baris
          // lama tidak disentuh karena SET-nya tidak menyebut kolom ini.
          adaWaktu ? satu.waktuAmbilLengkap || "" : "",
          adaWaktu ? satu.jamJadwal || "" : "",
          adaWaktu ? satu.waktuPanggilPertama || "" : "",
          adaWaktu ? satu.waktuPanggilLengkap || "" : "",
          adaWaktu ? Number(satu.jumlahPanggil) || 0 : 0,
          adaWaktu ? satu.menungguDetik ?? null : null,
          adaWaktu ? satu.jarakSebelumDetik ?? null : null,
          adaWaktu ? satu.lamaSidangDetik ?? null : null,
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
