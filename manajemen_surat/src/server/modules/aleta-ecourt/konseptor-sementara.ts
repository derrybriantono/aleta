import type { AletaDatabase } from "@/server/db/client";
import type { KonseptorSementara } from "@/lib/konseptor-sementara";

/**
 * ============================================================================
 * KONSEPTOR SEMENTARA
 * ============================================================================
 *
 * SIPP baru dapat menyebut konseptor putusan SESUDAH ada yang mengerjakannya:
 * namanya terbaca dari jejak tahapan (perkara_proses, proses_id 210), dan
 * jejak itu baru lahir ketika naskahnya disentuh. Di antara sidang terakhir
 * dan naskah yang jadi, SIPP tidak dapat ditanyai "siapa yang menyusun ini" -
 * dan justru pada rentang itulah pertanyaannya paling sering diajukan.
 *
 * Yang dicatat di sini jawabannya sementara, ditunjuk tangan.
 *
 * ============================================================================
 * SEMENTARA, DAN TIDAK PERNAH MENJADI KEBENARAN
 * ============================================================================
 *
 * Begitu SIPP punya nama, yang berlaku nama SIPP. Baris ini tidak dihapus
 * ketika itu terjadi - selisih antara yang DITUNJUK dan yang SUNGGUH
 * mengerjakan adalah keterangan tersendiri, dan menghapusnya menghapus
 * pertanyaannya.
 *
 * ALETA TIDAK MENULIS APA PUN KE SIPP dari sini. Tunjukan tangan bukan fakta
 * perkara; menuliskannya ke jejak tahapan SIPP akan membuat penunjukan
 * terbaca sebagai pekerjaan yang sudah dikerjakan.
 */

// Bentuk dan aturan bandingnya di @/lib/konseptor-sementara - lihat sebabnya
// di sana. Diteruskan dari sini supaya pemanggil lama tidak ikut berubah.
export { bandingkanKonseptor } from "@/lib/konseptor-sementara";
export type { KonseptorSementara } from "@/lib/konseptor-sementara";

const KOSONG = (perkaraId: string): KonseptorSementara => ({
  perkaraId,
  nomorPerkara: "",
  nama: "",
  pengguna: "",
  catatan: "",
  ditetapkanOleh: "",
  ditetapkanAt: "",
});

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function dariBaris(row: Record<string, unknown>): KonseptorSementara {
  return {
    perkaraId: teks(row.perkara_id),
    nomorPerkara: teks(row.nomor_perkara),
    nama: teks(row.nama),
    pengguna: teks(row.pengguna),
    catatan: teks(row.catatan),
    ditetapkanOleh: teks(row.ditetapkan_oleh),
    ditetapkanAt: teks(row.ditetapkan_at),
  };
}

/**
 * Membaca tunjukan untuk sejumlah perkara sekaligus.
 *
 * Sekaligus, bukan satu per satu: layar antrian memuat belasan sampai puluhan
 * baris, dan satu pertanyaan per baris berarti puluhan perjalanan ke basis
 * data untuk satu layar yang digambar sekali.
 */
export async function bacaKonseptorSementara(
  db: AletaDatabase,
  perkaraIds: string[]
): Promise<Record<string, KonseptorSementara>> {
  const daftar = [...new Set(perkaraIds.map(teks).filter(Boolean))];
  if (daftar.length === 0) return {};

  // Batasnya bukan kerapian: daftar tanda tanya yang tumbuh sebesar apa pun
  // akan menabrak batas parameter basis data pada hari seseorang membuka
  // rentang setahun, dan salahnya baru terlihat pada hari itu.
  const potong = daftar.slice(0, 500);
  const tanya = potong.map(() => "?").join(", ");
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT perkara_id, nomor_perkara, nama, pengguna, catatan, ditetapkan_oleh, ditetapkan_at
       FROM aleta_konseptor_sementara
      WHERE perkara_id IN (${tanya})`,
    potong
  );

  const peta: Record<string, KonseptorSementara> = {};
  for (const row of baris) {
    const satu = dariBaris(row);
    if (satu.perkaraId) peta[satu.perkaraId] = satu;
  }
  return peta;
}

export type IsianKonseptorSementara = {
  perkaraId: string;
  nomorPerkara: string;
  nama: string;
  pengguna?: string;
  catatan?: string;
  oleh: string;
};

/**
 * Menunjuk - atau mencabut, bila namanya dikosongkan.
 *
 * Nama kosong MENGHAPUS barisnya, bukan menyimpan baris bernama kosong.
 * Baris bernama kosong akan tampil di layar sebagai "konseptor sementara: "
 * dengan titik dua yang menggantung, dan yang membacanya akan mengira
 * namanya gagal dibaca alih-alih tidak pernah ada.
 */
export async function simpanKonseptorSementara(
  db: AletaDatabase,
  isian: IsianKonseptorSementara
): Promise<{ ok: boolean; alasan: string; baris: KonseptorSementara }> {
  const perkaraId = teks(isian.perkaraId);
  if (!perkaraId) {
    return { ok: false, alasan: "Perkara wajib disebut.", baris: KOSONG("") };
  }

  const nama = teks(isian.nama).slice(0, 200);
  if (!nama) {
    await db.run(`DELETE FROM aleta_konseptor_sementara WHERE perkara_id = ?`, [perkaraId]);
    return { ok: true, alasan: "", baris: KOSONG(perkaraId) };
  }

  const sekarang = new Date().toISOString();
  const baris: KonseptorSementara = {
    perkaraId,
    nomorPerkara: teks(isian.nomorPerkara).slice(0, 100),
    nama,
    pengguna: teks(isian.pengguna).slice(0, 100),
    catatan: teks(isian.catatan).slice(0, 500),
    // Nama penunjuk diambil dari sesi yang sedang berjalan dan TIDAK dapat
    // diketik. Ruas yang dapat diisi sendiri membuat penunjukannya tidak dapat
    // ditelusuri pada hari ia dipersoalkan.
    ditetapkanOleh: teks(isian.oleh).slice(0, 200),
    ditetapkanAt: sekarang,
  };

  const lama = await db.queryOne<Record<string, unknown>>(
    `SELECT perkara_id FROM aleta_konseptor_sementara WHERE perkara_id = ?`,
    [perkaraId]
  );

  if (lama) {
    await db.run(
      `UPDATE aleta_konseptor_sementara
          SET nomor_perkara = ?, nama = ?, pengguna = ?, catatan = ?,
              ditetapkan_oleh = ?, ditetapkan_at = ?
        WHERE perkara_id = ?`,
      [
        baris.nomorPerkara,
        baris.nama,
        baris.pengguna,
        baris.catatan,
        baris.ditetapkanOleh,
        baris.ditetapkanAt,
        perkaraId,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_konseptor_sementara
         (perkara_id, nomor_perkara, nama, pengguna, catatan, ditetapkan_oleh, ditetapkan_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        perkaraId,
        baris.nomorPerkara,
        baris.nama,
        baris.pengguna,
        baris.catatan,
        baris.ditetapkanOleh,
        baris.ditetapkanAt,
      ]
    );
  }

  return { ok: true, alasan: "", baris };
}
