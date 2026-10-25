import { gabungRekamLampau, type BarisRekamAntrian } from "@/lib/rekam-antrian";
import { withTransaction, type AletaDatabase } from "@/server/db/client";

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
 * Isi yang akan ditulis sama persis dengan yang tersimpan? Hanya kolom yang
 * SET-nya benar-benar menimpa yang dibandingkan: kolom berdetik (0051) hanya
 * bila waktunya terbaca pada pemuatan ini (adaWaktu), sebab bila tidak, SET
 * tidak menyentuhnya dan nilai tersimpan tetap apa pun isi baris masuknya.
 * Normalisasinya sama dengan dariBaris/penulisan: teks dipangkas, angka kosong
 * = null, online = 0/1.
 */
function samaDenganTersimpan(lama: RekamAntrianTersimpan | undefined, baru: BarisRekamAntrian): boolean {
  if (!lama) return false;
  const adaWaktu = baru.adaWaktu === true;
  return (
    lama.tanggalSidang === teks(baru.tanggalSidang) &&
    lama.sidangId === teks(baru.sidangId) &&
    lama.perkaraId === teks(baru.perkaraId) &&
    lama.nomorPerkara === teks(baru.nomorPerkara) &&
    lama.ruangan === teks(baru.ruangan) &&
    lama.nomorAntrian === angka(baru.nomorAntrian) &&
    lama.urutanRuang === angka(baru.urutanRuang) &&
    lama.waktuAmbil === teks(baru.waktuAmbil) &&
    lama.jamPanggil === teks(baru.jamPanggil) &&
    lama.online === Boolean(baru.online) &&
    lama.keadaan === teks(baru.keadaan) &&
    lama.namaPetugas === teks(baru.namaPetugas) &&
    lama.jarakSebelumMenit === angka(baru.jarakSebelumMenit) &&
    lama.jarakBerikutMenit === angka(baru.jarakBerikutMenit) &&
    (!adaWaktu ||
      (lama.waktuAmbilLengkap === teks(baru.waktuAmbilLengkap) &&
        lama.jamJadwal === teks(baru.jamJadwal) &&
        lama.waktuPanggilPertama === teks(baru.waktuPanggilPertama) &&
        lama.waktuPanggilLengkap === teks(baru.waktuPanggilLengkap) &&
        lama.jumlahPanggil === (Number(baru.jumlahPanggil) || 0) &&
        lama.menungguDetik === angka(baru.menungguDetik) &&
        lama.jarakSebelumDetik === angka(baru.jarakSebelumDetik) &&
        lama.lamaSidangDetik === angka(baru.lamaSidangDetik)))
  );
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
): Promise<{ ditulis: number; gagal: string; dilewati?: number }> {
  if (!Array.isArray(baris) || baris.length === 0) return { ditulis: 0, gagal: "" };

  const sekarang = new Date().toISOString();
  let ditulis = 0;
  let dilewati = 0;
  try {
    // ========================================================================
    // DIBANDINGKAN DULU, HANYA YANG BERUBAH YANG DITULIS (K6, 25 Okt 2026)
    // ========================================================================
    //
    // Rute jadwal memanggil fungsi ini pada SETIAP muat penuh (45 detik per
    // layar; ±133 transaksi per menit pada 100 perangkat), padahal isi
    // barisnya jarang berubah. Kini baris tersimpannya dibaca SEKALI (satu
    // SELECT berindeks, tanpa fsync) dan dibandingkan dengan yang akan
    // ditulis; baris yang isinya sama persis dilewati, dan bila semuanya sama
    // tidak ada transaksi sama sekali. Perbandingannya atas basis data, bukan
    // ingatan proses: baris yang terhapus dari luar atau proses yang baru
    // mulai ulang tetap benar. direkam_at hanya bergeser bila isinya berubah
    // (tidak ada pembaca yang bergantung padanya selain tampilan rekaman).
    const idSemua = [...new Set(baris.filter((b) => b && b.id).map((b) => b.id))];
    const tersimpan = new Map<string, RekamAntrianTersimpan>();
    for (let mulai = 0; mulai < idSemua.length; mulai += 200) {
      const bagian = idSemua.slice(mulai, mulai + 200);
      const rows = await db.queryAll<Record<string, unknown>>(
        `SELECT * FROM aleta_rekam_antrian WHERE id IN (${bagian.map(() => "?").join(", ")})`,
        bagian
      );
      for (const row of rows) tersimpan.set(teks(row.id), dariBaris(row));
    }

    // Diurutkan menurut id: dua muat jadwal yang serentak mengunci baris
    // dalam urutan yang sama, sehingga transaksinya tidak saling menunggu
    // melingkar (deadlock). Tiap baris berdiri sendiri - urutannya tidak
    // mengubah isi rekaman.
    const urut = [...baris].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    const perluTulis: BarisRekamAntrian[] = [];
    for (const asli of urut) {
      if (!asli.id || !asli.sidangId || !asli.tanggalSidang) continue;
      // Hari lampau digabung dengan yang tersimpan, tidak ditimpa (lihat di atas).
      const satu = asli.lampau ? gabungRekamLampau(tersimpan.get(asli.id), asli) : asli;
      if (samaDenganTersimpan(tersimpan.get(satu.id), satu)) {
        dilewati += 1;
        continue;
      }
      perluTulis.push(satu);
    }

    // ========================================================================
    // SATU TRANSAKSI, BUKAN SATU COMMIT PER BARIS (performa muat 19 Okt 2026)
    // ========================================================================
    //
    // Rekaman ini ditulis pada muat Jadwal Sidang. Sampai 1.205.11 tiap baris
    // satu INSERT ... ON CONFLICT dengan commit sendiri - satu fsync WAL per
    // baris di disk berputar server (synchronous_commit on): sebulan ±160
    // sidang = ±160 fsync berurutan sebelum jadwalnya dijawab. Kini satu
    // transaksi: isinya sama, satu fsync. Gagal = seluruhnya dibatalkan
    // (ditulis 0), tidak lagi sebagian - jadwalnya tetap terjawab.
    if (perluTulis.length > 0) {
      ditulis = await withTransaction(db, async (tx) => {
        let jumlah = 0;
        for (const satu of perluTulis) {
          const adaWaktu = satu.adaWaktu === true;
          await tx.run(
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
          jumlah += 1;
        }
        return jumlah;
      });
    }
  } catch (kesalahan) {
    return {
      ditulis: 0,
      gagal: kesalahan instanceof Error ? kesalahan.message : "gagal merekam antrian",
    };
  }
  return { ditulis, gagal: "", ...(dilewati > 0 ? { dilewati } : {}) };
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
