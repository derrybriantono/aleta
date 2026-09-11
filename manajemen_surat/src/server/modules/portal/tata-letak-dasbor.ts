import { type AletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * Susunan kartu dasbor milik tiap pengguna.
 *
 * ============================================================================
 * SUSUNAN, BUKAN KEWENANGAN
 * ============================================================================
 *
 * Yang disimpan di sini hanya URUTAN. Kartu mana yang boleh dilihat seseorang
 * tetap ditentukan kewenangannya, dan dihitung ulang pada tiap pemuatan. Itu
 * dipisah dengan sengaja: kalau daftar urutan ikut menentukan apa yang tampil,
 * pegawai yang kewenangannya dicabut akan tetap melihat kartunya selama
 * susunan lamanya masih tersimpan - dan tidak akan ada satu layar pun yang
 * memperlihatkan bahwa itu sedang terjadi.
 *
 * Akibatnya dua aturan pembacaan di sisi peramban: kunci yang tidak dikenal
 * DIABAIKAN, dan kartu yang belum pernah disusun muncul di akhir. Keduanya
 * membuat kartu baru selalu terlihat, alih-alih hilang diam-diam bagi setiap
 * orang yang pernah menyusun dasbornya.
 *
 * ============================================================================
 * BATAS UKURAN
 * ============================================================================
 *
 * Ini masukan dari peramban dan disimpan apa adanya, jadi ia dibatasi: paling
 * banyak dua belas zona, tiga puluh kunci per zona, dan tiap kunci hanya boleh
 * memuat huruf, angka, dan tanda hubung. Tanpa itu, satu permintaan dapat
 * menaruh muatan sebesar apa pun di baris milik pengguna itu sendiri.
 */
export const BATAS_ZONA = 12;
export const BATAS_KUNCI_PER_ZONA = 30;
const POLA_KUNCI = /^[a-z0-9][a-z0-9-]{0,47}$/;
const POLA_ZONA = /^[a-z0-9][a-z0-9-]{0,31}$/;
const POLA_HALAMAN = /^[a-z0-9][a-z0-9/-]{0,63}$/;

export type SusunanDasbor = Record<string, string[]>;

type BarisTataLetak = { susunan_json: string; updated_at: string };

/**
 * Membersihkan susunan yang datang dari peramban.
 *
 * Yang tidak lolos dibuang diam-diam, bukan ditolak: satu kunci aneh tidak
 * boleh membuat seluruh penyimpanan gagal, sebab yang tersimpan lalu tetap
 * susunan lama sementara layarnya sudah berubah - dan pengguna akan melihat
 * dasbornya melompat kembali pada pemuatan berikutnya tanpa sebab yang
 * terbaca.
 */
export function bersihkanSusunan(mentah: unknown): SusunanDasbor {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return {};

  const hasil: SusunanDasbor = {};
  for (const [zona, daftar] of Object.entries(mentah as Record<string, unknown>).slice(0, BATAS_ZONA)) {
    if (!POLA_ZONA.test(zona)) continue;
    if (!Array.isArray(daftar)) continue;

    const kunci: string[] = [];
    for (const satu of daftar) {
      const teks = String(satu ?? "");
      // Ganda dibuang: urutan yang memuat satu kunci dua kali akan
      // menggambar kartunya dua kali, dan React akan mengeluh soal key
      // kembar - gejalanya jauh dari sebabnya.
      if (!POLA_KUNCI.test(teks) || kunci.includes(teks)) continue;
      kunci.push(teks);
      if (kunci.length >= BATAS_KUNCI_PER_ZONA) break;
    }

    if (kunci.length > 0) hasil[zona] = kunci;
  }

  return hasil;
}

function periksaHalaman(halaman: string) {
  const bersih = String(halaman || "").trim();
  if (!POLA_HALAMAN.test(bersih)) {
    throw new ApiError(400, "Nama halaman tidak dikenali.");
  }
  return bersih;
}

/** Susunan yang tersimpan untuk satu halaman. Kosong berarti memakai bawaan. */
export async function bacaTataLetak(
  db: AletaDatabase,
  userId: string,
  halaman: string
): Promise<SusunanDasbor> {
  const baris = await db
    .prepare("SELECT susunan_json, updated_at FROM tata_letak_dasbor WHERE user_id = ? AND halaman = ?")
    .all<BarisTataLetak>(userId, periksaHalaman(halaman));

  if (baris.length === 0) return {};

  try {
    return bersihkanSusunan(JSON.parse(baris[0].susunan_json));
  } catch {
    // Baris yang rusak diperlakukan seperti belum pernah disusun. Melempar
    // galat di sini akan mematikan seluruh dasbor karena satu baris setelan.
    return {};
  }
}

/**
 * Menyimpan susunan satu halaman.
 *
 * Hanya untuk dirinya sendiri - tidak ada ruas userId pada masukannya, dengan
 * sengaja. Setelan tampilan orang lain bukan sesuatu yang perlu dapat disentuh
 * lewat rute mana pun, termasuk oleh administrator: tidak ada keperluannya,
 * dan adanya jalan itu berarti ada yang harus menjaganya.
 */
export async function simpanTataLetak(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  halaman: string,
  susunan: unknown
): Promise<SusunanDasbor> {
  const actor = await requireActorUser(db, actorUserId);
  const namaHalaman = periksaHalaman(halaman);
  const bersih = bersihkanSusunan(susunan);

  await db
    .prepare(
      "INSERT INTO tata_letak_dasbor (user_id, halaman, susunan_json, updated_at) " +
        "VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(user_id, halaman) DO UPDATE SET " +
        "susunan_json = excluded.susunan_json, updated_at = excluded.updated_at"
    )
    .run(actor.id, namaHalaman, JSON.stringify(bersih), new Date().toISOString());

  return bersih;
}

/**
 * Mengembalikan satu halaman ke susunan bawaan.
 *
 * Barisnya dihapus, bukan diisi susunan bawaan. Bawaan dapat berubah ketika
 * kartu baru ditambahkan, dan baris yang memuat "bawaan hari ini" akan
 * membekukan dasbor orang itu pada bawaan lama selamanya.
 */
export async function hapusTataLetak(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  halaman: string
) {
  const actor = await requireActorUser(db, actorUserId);
  await db
    .prepare("DELETE FROM tata_letak_dasbor WHERE user_id = ? AND halaman = ?")
    .run(actor.id, periksaHalaman(halaman));
  return {} as SusunanDasbor;
}
