import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

/**
 * LEMBAR BAS - tempat jawaban sidang disimpan.
 *
 * ============================================================================
 * PERTANYAANNYA IKUT DISIMPAN, BUKAN HANYA JAWABANNYA
 * ============================================================================
 *
 * Yang disimpan adalah pertanyaan SESUDAH penandanya terisi - lengkap dengan
 * nama para pihak sebagaimana berbunyi saat itu.
 *
 * Kalau hanya nomor pertanyaannya yang disimpan lalu bunyinya diambil ulang
 * dari ABT tiap kali dibaca, maka setiap perubahan katalog ABT akan mengubah
 * bunyi BAS yang SUDAH ditandatangani. Naskah resmi tidak boleh bergeser di
 * bawah tanda tangan yang sudah membubuhinya.
 *
 * ============================================================================
 * ABT TIDAK DITULISI
 * ============================================================================
 *
 * abt_keterangan_saksi tetap hanya dibaca. ABT adalah alat kerja panitera yang
 * dipakai setiap hari; menulis ke dalamnya dari luar berarti mengubah alat
 * kerja orang lain tanpa sepengetahuannya.
 */

export type SaksiIdentitas = {
  nama: string;
  umur: string;
  agama: string;
  pendidikan: string;
  pekerjaan: string;
  alamat: string;
};

export type BarisJawaban = {
  urutan: number;
  pertanyaan: string;
  jawaban: string;
};

export type Lembar = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  kodeKumpulan: string;
  namaKumpulan: string;
  saksiKe: number;
  saksi: SaksiIdentitas;
  tanggalSidang: string;
  keadaan: "draf" | "selesai";
  catatan: string;
  baris: BarisJawaban[];
  diubahOleh: string;
  diubahAt: string;
};

export type RingkasanLembar = {
  id: string;
  kodeKumpulan: string;
  namaKumpulan: string;
  saksiKe: number;
  saksiNama: string;
  keadaan: "draf" | "selesai";
  jumlahTerjawab: number;
  jumlahPertanyaan: number;
  diubahAt: string;
};

const SAKSI_KOSONG: SaksiIdentitas = {
  nama: "",
  umur: "",
  agama: "",
  pendidikan: "",
  pekerjaan: "",
  alamat: "",
};

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function keadaanSah(nilai: unknown): "draf" | "selesai" {
  return teks(nilai) === "selesai" ? "selesai" : "draf";
}

type BarisLembarDb = Record<string, unknown>;

function bentukLembar(baris: BarisLembarDb, jawaban: BarisJawaban[]): Lembar {
  return {
    id: teks(baris.id),
    perkaraId: teks(baris.perkara_id),
    nomorPerkara: teks(baris.nomor_perkara),
    kodeKumpulan: teks(baris.kode_kumpulan),
    namaKumpulan: teks(baris.nama_kumpulan),
    saksiKe: Number(baris.saksi_ke) || 1,
    saksi: {
      nama: teks(baris.saksi_nama),
      umur: teks(baris.saksi_umur),
      agama: teks(baris.saksi_agama),
      pendidikan: teks(baris.saksi_pendidikan),
      pekerjaan: teks(baris.saksi_pekerjaan),
      alamat: teks(baris.saksi_alamat),
    },
    tanggalSidang: teks(baris.tanggal_sidang),
    keadaan: keadaanSah(baris.keadaan),
    catatan: teks(baris.catatan),
    baris: jawaban,
    diubahOleh: teks(baris.diubah_oleh),
    diubahAt: teks(baris.diubah_at),
  };
}

async function ambilJawaban(db: AletaDatabase, lembarId: string): Promise<BarisJawaban[]> {
  const baris = await db.queryAll<BarisLembarDb>(
    `SELECT urutan, pertanyaan, jawaban FROM aleta_bas_jawaban WHERE lembar_id = ? ORDER BY urutan`,
    [lembarId]
  );
  return baris.map((item) => ({
    urutan: Number(item.urutan) || 0,
    pertanyaan: teks(item.pertanyaan),
    jawaban: teks(item.jawaban),
  }));
}

/** Lembar yang sudah tersimpan untuk satu perkara, kumpulan, dan urutan saksi. */
export async function muatLembar(
  db: AletaDatabase,
  args: { perkaraId: string; kode: string; saksiKe: number }
): Promise<Lembar | null> {
  const perkaraId = teks(args.perkaraId);
  const kode = teks(args.kode);
  const saksiKe = Number(args.saksiKe) || 1;
  if (!perkaraId || !kode) return null;

  const baris = await db.queryOne<BarisLembarDb>(
    `SELECT * FROM aleta_bas_lembar WHERE perkara_id = ? AND kode_kumpulan = ? AND saksi_ke = ?`,
    [perkaraId, kode, saksiKe]
  );
  if (!baris) return null;

  return bentukLembar(baris, await ambilJawaban(db, teks(baris.id)));
}

/** Semua lembar milik satu perkara - untuk daftar di layar dan untuk merakit naskah. */
export async function daftarLembar(db: AletaDatabase, perkaraId: string): Promise<RingkasanLembar[]> {
  const id = teks(perkaraId);
  if (!id) return [];

  // Dua pembacaan lalu digabung di sini, BUKAN satu kueri dengan subkueri
  // berkorelasi. Portal berjalan di atas Postgres sungguhan maupun basis data
  // dalam memori saat Postgres tidak tersedia, dan yang kedua tidak menangani
  // subkueri berkorelasi. Kueri yang hanya jalan di salah satunya berarti
  // halaman ini mati justru pada keadaan darurat yang membuat cadangan itu ada.
  const baris = await db.queryAll<BarisLembarDb>(
    `SELECT id, kode_kumpulan, nama_kumpulan, saksi_ke, saksi_nama, keadaan, diubah_at
       FROM aleta_bas_lembar
      WHERE perkara_id = ?
      ORDER BY kode_kumpulan, saksi_ke`,
    [id]
  );
  if (baris.length === 0) return [];

  const jawaban = await db.queryAll<BarisLembarDb>(
    `SELECT lembar_id, jawaban FROM aleta_bas_jawaban`
  );

  const milikLembar = new Set(baris.map((item) => teks(item.id)));
  const hitungan = new Map<string, { semua: number; terjawab: number }>();
  for (const item of jawaban) {
    const lembarId = teks(item.lembar_id);
    if (!milikLembar.has(lembarId)) continue;
    const angka = hitungan.get(lembarId) ?? { semua: 0, terjawab: 0 };
    angka.semua += 1;
    if (teks(item.jawaban)) angka.terjawab += 1;
    hitungan.set(lembarId, angka);
  }

  return baris.map((item) => {
    const angka = hitungan.get(teks(item.id)) ?? { semua: 0, terjawab: 0 };
    return {
      id: teks(item.id),
      kodeKumpulan: teks(item.kode_kumpulan),
      namaKumpulan: teks(item.nama_kumpulan),
      saksiKe: Number(item.saksi_ke) || 1,
      saksiNama: teks(item.saksi_nama),
      keadaan: keadaanSah(item.keadaan),
      jumlahTerjawab: angka.terjawab,
      jumlahPertanyaan: angka.semua,
      diubahAt: teks(item.diubah_at),
    };
  });
}

export type MasukanSimpan = {
  perkaraId: string;
  nomorPerkara?: string;
  kode: string;
  namaKumpulan?: string;
  saksiKe?: number;
  saksi?: Partial<SaksiIdentitas>;
  tanggalSidang?: string;
  keadaan?: string;
  catatan?: string;
  baris: Array<{ urutan: number; pertanyaan?: string; jawaban?: string }>;
};

/**
 * Menyimpan satu lembar - dibuat bila belum ada, diperbarui bila sudah.
 *
 * ============================================================================
 * BARIS YANG TIDAK DIKIRIM TIDAK DIHAPUS
 * ============================================================================
 *
 * Yang dikirim ditimpa, yang tidak dikirim dibiarkan. Panitera yang menyimpan
 * sebagian - karena sidang masih berjalan, karena jaringan terputus di tengah -
 * tidak boleh kehilangan bagian yang sudah diisinya sebelumnya.
 *
 * Menghapus seluruh baris lalu menulis ulang memang lebih ringkas ditulis,
 * tetapi berarti satu penyimpanan yang gagal di tengah meninggalkan lembar
 * kosong - dan yang hilang adalah keterangan saksi yang tidak dapat diulang.
 */
export async function simpanLembar(
  db: AletaDatabase,
  actorUserId: string,
  masukan: MasukanSimpan
): Promise<Lembar> {
  const perkaraId = teks(masukan.perkaraId);
  const kode = teks(masukan.kode);
  const saksiKe = Number(masukan.saksiKe) || 1;
  if (!perkaraId) throw new Error("Perkara tidak dikenali.");
  if (!kode) throw new Error("Kumpulan pertanyaan belum dipilih.");

  const sekarang = new Date().toISOString();
  const saksi = { ...SAKSI_KOSONG, ...(masukan.saksi ?? {}) };

  const adaSebelumnya = await db.queryOne<BarisLembarDb>(
    `SELECT id FROM aleta_bas_lembar WHERE perkara_id = ? AND kode_kumpulan = ? AND saksi_ke = ?`,
    [perkaraId, kode, saksiKe]
  );

  const lembarId = adaSebelumnya ? teks(adaSebelumnya.id) : randomUUID();

  if (adaSebelumnya) {
    await db.run(
      `UPDATE aleta_bas_lembar
          SET nomor_perkara = ?, nama_kumpulan = ?, saksi_nama = ?, saksi_umur = ?, saksi_agama = ?,
              saksi_pendidikan = ?, saksi_pekerjaan = ?, saksi_alamat = ?, tanggal_sidang = ?,
              keadaan = ?, catatan = ?, diubah_oleh = ?, diubah_at = ?
        WHERE id = ?`,
      [
        teks(masukan.nomorPerkara),
        teks(masukan.namaKumpulan),
        teks(saksi.nama),
        teks(saksi.umur),
        teks(saksi.agama),
        teks(saksi.pendidikan),
        teks(saksi.pekerjaan),
        teks(saksi.alamat),
        teks(masukan.tanggalSidang),
        keadaanSah(masukan.keadaan),
        teks(masukan.catatan),
        teks(actorUserId),
        sekarang,
        lembarId,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_bas_lembar
         (id, perkara_id, nomor_perkara, kode_kumpulan, nama_kumpulan, saksi_ke,
          saksi_nama, saksi_umur, saksi_agama, saksi_pendidikan, saksi_pekerjaan, saksi_alamat,
          tanggal_sidang, keadaan, catatan, dibuat_oleh, dibuat_at, diubah_oleh, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lembarId,
        perkaraId,
        teks(masukan.nomorPerkara),
        kode,
        teks(masukan.namaKumpulan),
        saksiKe,
        teks(saksi.nama),
        teks(saksi.umur),
        teks(saksi.agama),
        teks(saksi.pendidikan),
        teks(saksi.pekerjaan),
        teks(saksi.alamat),
        teks(masukan.tanggalSidang),
        keadaanSah(masukan.keadaan),
        teks(masukan.catatan),
        teks(actorUserId),
        sekarang,
        teks(actorUserId),
        sekarang,
      ]
    );
  }

  for (const item of Array.isArray(masukan.baris) ? masukan.baris : []) {
    const urutan = Number(item.urutan);
    if (!Number.isFinite(urutan)) continue;

    const sudahAda = await db.queryOne<BarisLembarDb>(
      `SELECT id FROM aleta_bas_jawaban WHERE lembar_id = ? AND urutan = ?`,
      [lembarId, urutan]
    );

    if (sudahAda) {
      await db.run(`UPDATE aleta_bas_jawaban SET pertanyaan = ?, jawaban = ?, diubah_at = ? WHERE id = ?`, [
        teks(item.pertanyaan),
        teks(item.jawaban),
        sekarang,
        teks(sudahAda.id),
      ]);
    } else {
      await db.run(
        `INSERT INTO aleta_bas_jawaban (id, lembar_id, urutan, pertanyaan, jawaban, diubah_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), lembarId, urutan, teks(item.pertanyaan), teks(item.jawaban), sekarang]
      );
    }
  }

  const tersimpan = await muatLembar(db, { perkaraId, kode, saksiKe });
  if (!tersimpan) throw new Error("Lembar gagal disimpan.");
  return tersimpan;
}

/**
 * Menyusun tanya-jawab menjadi teks untuk naskah BAS.
 *
 * Bentuknya mengikuti yang dipakai ABT dan blangko: tanya lalu jawab,
 * berpasangan, tiap pasangan pada barisnya sendiri. Pertanyaan yang belum
 * dijawab TETAP ditulis, dengan jawabannya dikosongkan - sehingga yang membaca
 * naskah melihat pertanyaan itu memang diajukan dan jawabannya belum terisi,
 * bukan mengira pertanyaannya tidak pernah ada.
 */
export function tanyaJawabKeTeks(baris: BarisJawaban[]): string {
  return baris
    .slice()
    .sort((a, b) => a.urutan - b.urutan)
    .map((item) => `- Tanya : ${item.pertanyaan}\n- Jawab : ${item.jawaban}`)
    .join("\n");
}

/** Semua lembar milik satu perkara, lengkap dengan jawabannya. */
export async function semuaLembar(db: AletaDatabase, perkaraId: string): Promise<Lembar[]> {
  const id = teks(perkaraId);
  if (!id) return [];

  const baris = await db.queryAll<BarisLembarDb>(
    `SELECT * FROM aleta_bas_lembar WHERE perkara_id = ? ORDER BY kode_kumpulan, saksi_ke`,
    [id]
  );

  const hasil: Lembar[] = [];
  for (const item of baris) {
    hasil.push(bentukLembar(item, await ambilJawaban(db, teks(item.id))));
  }
  return hasil;
}

/**
 * Penanda blangko yang berasal dari lembar yang sudah diisi.
 *
 * ============================================================================
 * NOMOR PENANDANYA DARI ABT, BUKAN KARANGAN
 * ============================================================================
 *
 * Blangko BAS menyediakan tempat terpisah untuk tiap saksi, dan abt_variabel
 * menyatakan nomornya: #1197# sampai #1202# jati diri saksi pertama, #5058#
 * tanya-jawabnya; #1203# sampai #1208# dan #5059# untuk saksi kedua.
 *
 * Hanya dua saksi yang dipetakan karena hanya dua yang disediakan blangkonya.
 * Lembar saksi ketiga dan seterusnya tetap tersimpan dan tetap terbaca di
 * layar - yang tidak ada adalah tempatnya di blangko ini, dan itu keadaan
 * blangkonya, bukan sesuatu yang boleh ditambal dengan menaruhnya di tempat
 * milik saksi lain.
 */
const PENANDA_SAKSI: Record<number, { nama: string; umur: string; agama: string; pendidikan: string; pekerjaan: string; alamat: string; tanyaJawab: string }> = {
  1: { nama: "1197", umur: "1198", agama: "1199", pendidikan: "1200", pekerjaan: "1201", alamat: "1202", tanyaJawab: "5058" },
  2: { nama: "1203", umur: "1204", agama: "1205", pendidikan: "1206", pekerjaan: "1207", alamat: "1208", tanyaJawab: "5059" },
};

export function penandaDariLembar(lembar: Lembar[]): Map<string, { nilai: string; asal: string }> {
  const peta = new Map<string, { nilai: string; asal: string }>();
  const pasang = (noVar: string, nilai: string, asal: string) => {
    if (String(nilai || "").trim()) peta.set(noVar, { nilai: String(nilai).trim(), asal });
  };

  for (const item of lembar) {
    const penanda = PENANDA_SAKSI[item.saksiKe];
    if (!penanda) continue;

    const asal = `ALETA - lembar BAS ${item.kodeKumpulan} saksi ke-${item.saksiKe}`;
    pasang(penanda.nama, item.saksi.nama, asal);
    pasang(penanda.umur, item.saksi.umur, asal);
    pasang(penanda.agama, item.saksi.agama, asal);
    pasang(penanda.pendidikan, item.saksi.pendidikan, asal);
    pasang(penanda.pekerjaan, item.saksi.pekerjaan, asal);
    pasang(penanda.alamat, item.saksi.alamat, asal);

    const terjawab = item.baris.filter((baris) => baris.jawaban);
    if (terjawab.length > 0) pasang(penanda.tanyaJawab, tanyaJawabKeTeks(terjawab), asal);
  }

  return peta;
}
