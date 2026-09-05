import { createHash, randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { bacaPdf } from "@/server/modules/aleta-ecourt/baca-pdf";
import {
  jangkarBagian,
  pecahPeraturan,
  periksaPecahan,
  sebutanBagian,
  type BagianPeraturan,
  type RingkasanPecahan,
} from "@/server/modules/aleta-ecourt/pemecah-peraturan";

/**
 * PUSTAKA HUKUM - naskah peraturan yang dapat dicari, dikutip, dan ditelusuri.
 *
 * ============================================================================
 * NASKAHNYA SELALU DARI BERKAS RESMI
 * ============================================================================
 *
 * Satu-satunya jalan masuk naskah ke pustaka ini adalah berkas PDF yang
 * dibaca modul pembaca berkas. Tidak ada jalan mengetik bunyi pasal langsung.
 *
 * Itu batasan yang disengaja. Pustaka hukum yang memuat satu pasal yang
 * diketik dari ingatan tidak salah sekali, melainkan salah di SETIAP putusan
 * yang merujuknya - dengan rapi, meyakinkan, dan tanpa ada yang memeriksanya
 * lagi karena "sudah ada di pustaka".
 *
 * ============================================================================
 * MASUK SEBAGAI DRAF, DIPAKAI SETELAH DISAHKAN
 * ============================================================================
 *
 * Penyerapan menghasilkan peraturan berstatus draf dengan verifikasi
 * "unverified". Pencarian untuk menyusun putusan hanya membaca yang SUDAH
 * disahkan - karena pemecahan naskah dapat meleset, dan pasal yang terpotong
 * di tempat yang salah terbaca wajar.
 *
 * Yang mengesahkan manusia yang membandingkannya dengan berkas aslinya.
 */

/**
 * Akar naskah peraturan - TERPISAH dari folder APS Badilag.
 *
 * Naskah yang diunduh milik ALETA; menaruhnya di folder APS Badilag berarti
 * menulis ke dalam alat kerja aplikasi lain, dan folder itu memang dipasang
 * hanya-baca justru supaya itu tidak terjadi.
 */
export const AKAR_PERATURAN = process.env.ALETA_PERATURAN_DIR || "/usr/src/app/pustaka_hukum";

export type Peraturan = {
  id: string;
  jenisId: string;
  judul: string;
  judulPendek: string;
  nomor: string;
  tahun: number | null;
  penerbit: string;
  status: string;
  verifikasi: string;
  berkasSumber: string;
  berlakuSejak: string;
  diundangkan: string;
  dicabutPada: string;
  dicabutOlehId: string;
  digantiOlehId: string;
};

export type BagianTersimpan = {
  id: string;
  peraturanId: string;
  jenis: string;
  nomor: string;
  jangkar: string;
  sebutan: string;
  judul: string;
  isi: string;
  halaman: number | null;
  urutan: number;
};

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function angka(nilai: unknown): number | null {
  const hasil = Number(nilai);
  return Number.isFinite(hasil) && hasil !== 0 ? hasil : null;
}

/**
 * Nama pendek yang menjadi awalan jangkar.
 *
 * Disusun dari jenis, nomor, dan tahunnya - bukan dari judulnya. Judul
 * peraturan sering ditulis berbeda antar penerbit, dan jangkar yang berubah
 * karena judulnya diketik lain membuat rujukan putusan lama menunjuk ke tempat
 * yang tidak ada.
 */
export function slugPeraturan(jenisKode: string, nomor: string, tahun: number | null): string {
  const bagian = [jenisKode, nomor, tahun ? String(tahun) : ""]
    .map((item) => teks(item).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return bagian.join("-");
}

function bentukPeraturan(baris: Record<string, unknown>): Peraturan {
  return {
    id: teks(baris.id),
    jenisId: teks(baris.regulation_type_id),
    judul: teks(baris.title),
    judulPendek: teks(baris.short_title),
    nomor: teks(baris.regulation_number),
    tahun: angka(baris.regulation_year),
    penerbit: teks(baris.issuing_body),
    status: teks(baris.status),
    verifikasi: teks(baris.verification_status),
    berkasSumber: teks(baris.official_document_path),
    berlakuSejak: teks(baris.effective_date),
    diundangkan: teks(baris.promulgation_date),
    dicabutPada: teks(baris.revoked_at),
    dicabutOlehId: teks(baris.revoked_by_regulation_id),
    digantiOlehId: teks(baris.superseded_by_regulation_id),
  };
}

export type MasukanPeraturan = {
  jenisId: string;
  judul: string;
  judulPendek?: string;
  nomor?: string;
  tahun?: number;
  penerbit?: string;
  berkasSumber?: string;
  berlakuSejak?: string;
  diundangkan?: string;
};

/** Mendaftarkan peraturan baru sebagai draf yang belum disahkan. */
export async function daftarkanPeraturan(
  db: AletaDatabase,
  actorUserId: string,
  masukan: MasukanPeraturan
): Promise<Peraturan> {
  const judul = teks(masukan.judul);
  const jenisId = teks(masukan.jenisId);
  if (!judul) throw new Error("Judul peraturan harus diisi.");
  if (!jenisId) throw new Error("Jenis peraturan harus dipilih.");

  const jenis = await db.queryOne<Record<string, unknown>>(`SELECT id FROM jlf_regulation_types WHERE id = ?`, [jenisId]);
  if (!jenis) throw new Error("Jenis peraturan tidak dikenali.");

  const id = randomUUID();
  const sekarang = new Date().toISOString();

  await db.run(
    `INSERT INTO jlf_regulations
       (id, regulation_type_id, title, short_title, regulation_number, regulation_year,
        issuing_body, official_document_path, effective_date, promulgation_date,
        status, verification_status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'unverified', ?, ?, ?)`,
    [
      id,
      jenisId,
      judul,
      teks(masukan.judulPendek),
      teks(masukan.nomor),
      masukan.tahun ?? null,
      teks(masukan.penerbit),
      teks(masukan.berkasSumber),
      teks(masukan.berlakuSejak) || null,
      teks(masukan.diundangkan) || null,
      actorUserId || null,
      sekarang,
      sekarang,
    ]
  );

  const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM jlf_regulations WHERE id = ?`, [id]);
  if (!baris) throw new Error("Peraturan gagal didaftarkan.");
  return bentukPeraturan(baris);
}

export type HasilSerap = {
  ok: boolean;
  sebab: string;
  peraturanId: string;
  versiId: string;
  jumlahHalaman: number;
  ringkasan: RingkasanPecahan;
  /** Halaman yang terurai tanpa huruf - petunjuk berkas pindaian. */
  halamanKosong: number[];
};

/**
 * Menyerap naskah satu peraturan dari berkas PDF.
 *
 * ============================================================================
 * PENYERAPAN ULANG MENGGANTI, BUKAN MENUMPUK
 * ============================================================================
 *
 * Naskah yang sama diserap dua kali - karena pemecahannya diperbaiki, atau
 * karena berkasnya diganti dengan cetakan yang lebih bersih - menghasilkan
 * versi baru, dan bagian versi lama DIHAPUS.
 *
 * Menumpuknya berarti pencarian mengembalikan pasal yang sama dua kali dengan
 * bunyi yang sedikit berbeda, dan yang membacanya harus menebak mana yang
 * berlaku. Riwayat versinya sendiri tetap tersimpan di jlf_regulation_versions.
 */
export async function serapNaskah(
  db: AletaDatabase,
  actorUserId: string,
  peraturanId: string,
  jalurBerkas: string
): Promise<HasilSerap> {
  const gagal = (sebab: string): HasilSerap => ({
    ok: false,
    sebab,
    peraturanId,
    versiId: "",
    jumlahHalaman: 0,
    ringkasan: {
      jumlahBagian: 0,
      jumlahPasal: 0,
      jumlahPasalPenjelasan: 0,
      jangkarGanda: [],
      jumlahAyat: 0,
      pasalHilang: [],
      bagianKosong: 0,
    },
    halamanKosong: [],
  });

  const peraturan = await db.queryOne<Record<string, unknown>>(`SELECT * FROM jlf_regulations WHERE id = ?`, [peraturanId]);
  if (!peraturan) return gagal("Peraturan tidak dikenali.");

  const isi = await bacaPdf(jalurBerkas);
  if (!isi.ada) return gagal(isi.sebab || "Berkas tidak terbaca.");

  const bagian = pecahPeraturan(isi.halaman);
  if (bagian.length === 0) return gagal("Naskah terbaca tetapi tidak memuat satu pun bagian.");

  const jenis = await db.queryOne<Record<string, unknown>>(
    `SELECT code FROM jlf_regulation_types WHERE id = ?`,
    [teks(peraturan.regulation_type_id)]
  );
  const slug = slugPeraturan(teks(jenis?.code), teks(peraturan.regulation_number), angka(peraturan.regulation_year));

  const sekarang = new Date().toISOString();
  const versiId = randomUUID();
  const seluruhTeks = isi.halaman.map((item) => item.teks).join("\n");
  const sidik = createHash("sha256").update(seluruhTeks).digest("hex");

  const versiSebelumnya = await db.queryAll<Record<string, unknown>>(
    `SELECT version_number FROM jlf_regulation_versions WHERE regulation_id = ?`,
    [peraturanId]
  );
  const nomorVersi = versiSebelumnya.length + 1;

  await db.run(
    `INSERT INTO jlf_regulation_versions
       (id, regulation_id, version_number, version_label, document_path, checksum,
        text_content, extracted_text_status, change_note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'extracted', ?, ?, ?)`,
    [
      versiId,
      peraturanId,
      nomorVersi,
      `Penyerapan ke-${nomorVersi}`,
      jalurBerkas,
      sidik,
      seluruhTeks,
      `${bagian.length} bagian dari ${isi.jumlahHalaman} halaman.`,
      actorUserId || null,
      sekarang,
    ]
  );

  // Bagian versi lama dihapus supaya pencarian tidak mengembalikan pasal yang
  // sama dua kali dengan bunyi yang sedikit berbeda.
  await db.run(`DELETE FROM jlf_regulation_sections WHERE regulation_id = ?`, [peraturanId]);

  // Urutan penyimpanan menentukan urutan induk: induk selalu tersimpan lebih
  // dulu karena urutannya di dalam naskah memang lebih awal.
  const idBagian = new Map<number, string>();
  for (const item of bagian) {
    const id = randomUUID();
    idBagian.set(item.urutan, id);

    await db.run(
      `INSERT INTO jlf_regulation_sections
         (id, regulation_id, regulation_version_id, section_type, section_number, anchor,
          citation_label, parent_section_id, title, content, normalized_content,
          page_number, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        peraturanId,
        versiId,
        item.jenis,
        item.nomor,
        jangkarBagian(slug, item, bagian),
        sebutanBagian(item, bagian),
        item.indukUrutan >= 0 ? (idBagian.get(item.indukUrutan) ?? null) : null,
        item.judul,
        item.isi,
        item.isi.toLowerCase(),
        item.halaman,
        item.urutan,
        sekarang,
        sekarang,
      ]
    );
  }

  await db.run(`UPDATE jlf_regulations SET official_document_path = ?, updated_at = ? WHERE id = ?`, [
    jalurBerkas,
    sekarang,
    peraturanId,
  ]);

  return {
    ok: true,
    sebab: "",
    peraturanId,
    versiId,
    jumlahHalaman: isi.jumlahHalaman,
    ringkasan: periksaPecahan(bagian),
    halamanKosong: isi.halamanKosong,
  };
}

/**
 * Mengesahkan peraturan setelah dibandingkan dengan berkas aslinya.
 *
 * Sampai ini dikerjakan manusia, peraturannya tidak dipakai menyusun apa pun.
 * Pemecahan naskah dapat meleset, dan pasal yang terpotong di tempat yang
 * salah terbaca wajar - justru itu yang membuatnya berbahaya.
 */
export async function sahkanPeraturan(db: AletaDatabase, actorUserId: string, peraturanId: string): Promise<boolean> {
  const sekarang = new Date().toISOString();
  const hasil = await db.run(
    `UPDATE jlf_regulations
        SET status = 'active', verification_status = 'verified', verified_by = ?, verified_at = ?, updated_at = ?
      WHERE id = ?`,
    [actorUserId || null, sekarang, sekarang, peraturanId]
  );
  return (hasil.changes ?? 0) > 0;
}

export type TemuanPasal = BagianTersimpan & {
  peraturanJudul: string;
  peraturanNomor: string;
  peraturanTahun: number | null;
};

/**
 * Mencari pasal di dalam pustaka.
 *
 * `hanyaDisahkan` bawaannya TRUE. Yang menyusun putusan tidak boleh menemukan
 * pasal yang belum dibandingkan seseorang dengan berkas aslinya - dan
 * bawaan yang aman lebih baik daripada bawaan yang lengkap.
 */
export async function cariPasal(
  db: AletaDatabase,
  kata: string,
  opsi: { hanyaDisahkan?: boolean; peraturanId?: string; batas?: number } = {}
): Promise<TemuanPasal[]> {
  const dicari = teks(kata).toLowerCase();
  if (!dicari) return [];

  const hanyaDisahkan = opsi.hanyaDisahkan !== false;
  const batas = Math.min(Math.max(opsi.batas ?? 30, 1), 200);

  const syarat: string[] = ["s.normalized_content LIKE ?"];
  const nilai: Array<string | number> = [`%${dicari}%`];

  if (hanyaDisahkan) syarat.push("r.verification_status = 'verified'");
  if (opsi.peraturanId) {
    syarat.push("s.regulation_id = ?");
    nilai.push(teks(opsi.peraturanId));
  }
  syarat.push("r.deleted_at IS NULL");

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT s.*, r.title AS peraturan_judul, r.regulation_number AS peraturan_nomor, r.regulation_year AS peraturan_tahun
       FROM jlf_regulation_sections s
       JOIN jlf_regulations r ON r.id = s.regulation_id
      WHERE ${syarat.join(" AND ")}
      ORDER BY s.regulation_id, s.sort_order
      LIMIT ${batas}`,
    nilai
  );

  return baris.map((item) => ({
    id: teks(item.id),
    peraturanId: teks(item.regulation_id),
    jenis: teks(item.section_type),
    nomor: teks(item.section_number),
    jangkar: teks(item.anchor),
    sebutan: teks(item.citation_label),
    judul: teks(item.title),
    isi: teks(item.content),
    halaman: angka(item.page_number),
    urutan: Number(item.sort_order) || 0,
    peraturanJudul: teks(item.peraturan_judul),
    peraturanNomor: teks(item.peraturan_nomor),
    peraturanTahun: angka(item.peraturan_tahun),
  }));
}

/** Membuka satu bagian lewat jangkarnya - inilah jalan rujukan putusan kembali. */
export async function bukaJangkar(db: AletaDatabase, jangkar: string): Promise<TemuanPasal | null> {
  const alamat = teks(jangkar);
  if (!alamat) return null;

  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT s.*, r.title AS peraturan_judul, r.regulation_number AS peraturan_nomor, r.regulation_year AS peraturan_tahun
       FROM jlf_regulation_sections s
       JOIN jlf_regulations r ON r.id = s.regulation_id
      WHERE s.anchor = ?`,
    [alamat]
  );
  if (!baris) return null;

  return {
    id: teks(baris.id),
    peraturanId: teks(baris.regulation_id),
    jenis: teks(baris.section_type),
    nomor: teks(baris.section_number),
    jangkar: teks(baris.anchor),
    sebutan: teks(baris.citation_label),
    judul: teks(baris.title),
    isi: teks(baris.content),
    halaman: angka(baris.page_number),
    urutan: Number(baris.sort_order) || 0,
    peraturanJudul: teks(baris.peraturan_judul),
    peraturanNomor: teks(baris.peraturan_nomor),
    peraturanTahun: angka(baris.peraturan_tahun),
  };
}

/**
 * Peraturan yang BERLAKU pada satu tanggal (C4).
 *
 * ============================================================================
 * YANG BERLAKU SAAT PERBUATAN, BUKAN YANG BERLAKU HARI INI
 * ============================================================================
 *
 * Perkara menilai perbuatan yang terjadi bertahun lalu. Peraturan yang dipakai
 * menilainya adalah yang berlaku SAAT ITU - dan mengambil yang berlaku hari
 * ini menghasilkan putusan yang menerapkan aturan yang belum ada ketika
 * perbuatannya terjadi.
 *
 * Peraturan tanpa tanggal berlaku IKUT dikembalikan, dan itu disengaja:
 * banyak naskah lama tidak mencantumkannya, dan membuangnya berarti pustaka
 * seolah kosong untuk tanggal mana pun.
 */
export async function berlakuPada(db: AletaDatabase, tanggal: string, hanyaDisahkan = true): Promise<Peraturan[]> {
  const pada = teks(tanggal);
  if (!pada) return [];

  const syarat = [
    "r.deleted_at IS NULL",
    "(r.effective_date IS NULL OR r.effective_date <= ?)",
    "(r.revoked_at IS NULL OR r.revoked_at > ?)",
  ];
  const nilai: string[] = [pada, pada];
  if (hanyaDisahkan) syarat.push("r.verification_status = 'verified'");

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT r.* FROM jlf_regulations r WHERE ${syarat.join(" AND ")} ORDER BY r.regulation_year DESC, r.title`,
    nilai
  );
  return baris.map(bentukPeraturan);
}

/**
 * Mencabut peraturan, dan menyebut penggantinya bila ada.
 *
 * Peraturan yang dicabut TIDAK dihapus. Putusan lama merujuknya, dan rujukan
 * yang menunjuk ke tempat kosong lebih buruk daripada rujukan ke aturan yang
 * sudah tidak berlaku - yang kedua setidaknya dapat dibaca dan dinilai.
 */
export async function cabutPeraturan(
  db: AletaDatabase,
  peraturanId: string,
  tanggalCabut: string,
  penggantiId = ""
): Promise<boolean> {
  const sekarang = new Date().toISOString();
  const hasil = await db.run(
    `UPDATE jlf_regulations
        SET revoked_at = ?, status = 'revoked', superseded_by_regulation_id = ?, updated_at = ?
      WHERE id = ?`,
    [teks(tanggalCabut) || sekarang, teks(penggantiId) || null, sekarang, peraturanId]
  );
  return (hasil.changes ?? 0) > 0;
}

/** Menautkan peraturan ke topik (C5). */
export async function tautkanTopik(
  db: AletaDatabase,
  actorUserId: string,
  peraturanId: string,
  topikId: string,
  catatan = ""
): Promise<boolean> {
  const sudah = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM jlf_regulation_topic_links WHERE regulation_id = ? AND topic_id = ?`,
    [peraturanId, topikId]
  );
  if (sudah) return false;

  await db.run(
    `INSERT INTO jlf_regulation_topic_links (id, regulation_id, topic_id, relevance_note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), peraturanId, topikId, teks(catatan), actorUserId || null, new Date().toISOString()]
  );
  return true;
}

/** Peraturan yang tertaut pada satu topik. */
export async function peraturanTopik(db: AletaDatabase, topikSlug: string, hanyaDisahkan = true): Promise<Peraturan[]> {
  const slug = teks(topikSlug);
  if (!slug) return [];

  const syarat = ["t.slug = ?", "r.deleted_at IS NULL"];
  const nilai: string[] = [slug];
  if (hanyaDisahkan) syarat.push("r.verification_status = 'verified'");

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT r.* FROM jlf_regulation_topic_links l
       JOIN jlf_regulations r ON r.id = l.regulation_id
       JOIN jlf_regulation_topics t ON t.id = l.topic_id
      WHERE ${syarat.join(" AND ")}
      ORDER BY r.regulation_year DESC, r.title`,
    nilai
  );
  return baris.map(bentukPeraturan);
}

/** Seluruh peraturan yang terdaftar, terbaru lebih dulu. */
export async function daftarPeraturan(db: AletaDatabase, hanyaDisahkan = false): Promise<Peraturan[]> {
  const syarat = ["r.deleted_at IS NULL"];
  if (hanyaDisahkan) syarat.push("r.verification_status = 'verified'");

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT r.* FROM jlf_regulations r WHERE ${syarat.join(" AND ")} ORDER BY r.regulation_year DESC, r.title`
  );
  return baris.map(bentukPeraturan);
}

/** Seluruh bagian satu peraturan, menurut urutan naskahnya. */
export async function bagianPeraturan(db: AletaDatabase, peraturanId: string): Promise<BagianTersimpan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM jlf_regulation_sections WHERE regulation_id = ? ORDER BY sort_order`,
    [teks(peraturanId)]
  );

  return baris.map((item) => ({
    id: teks(item.id),
    peraturanId: teks(item.regulation_id),
    jenis: teks(item.section_type),
    nomor: teks(item.section_number),
    jangkar: teks(item.anchor),
    sebutan: teks(item.citation_label),
    judul: teks(item.title),
    isi: teks(item.content),
    halaman: angka(item.page_number),
    urutan: Number(item.sort_order) || 0,
  }));
}

export type { BagianPeraturan };
