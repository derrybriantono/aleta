import type { AletaDatabase } from "@/server/db/client";
import { bacaKonseptorSementara, type KonseptorSementara } from "@/server/modules/aleta-ecourt/konseptor-sementara";
import { ApiError } from "@/server/shared/errors";
import { orangSama } from "@/lib/orang-unik";
import type { PilihanHakimSidang } from "@/lib/jadwal-keliling-hakim";

/**
 * ============================================================================
 * SIDANG KELILING PER HARI & HAKIM YANG MENYIDANGKAN PER PERKARA (0083, 22 Okt 2026)
 * ============================================================================
 *
 * Seluruhnya di basis data ALETA - TIDAK ADA yang ditulis ke SIPP:
 *
 *   aleta_sidang_keliling_hari   saklar per tanggal. Tidak ada baris = MATI
 *                                (bawaan) dan "belum diputuskan" (pop-up boleh
 *                                ditawarkan). Tunda otomatis membaca
 *                                sidangKelilingAktif(): hari yang menyala
 *                                berjalan pukul 14.00.
 *   aleta_hakim_sidang_perkara   SATU hakim per (tanggal, perkara) walau
 *                                bermajelis. Boleh hakim di luar majelis
 *                                (tambahan pengguna 22 Okt) - anggota_majelis
 *                                mencatatnya.
 *
 * KONSEPTOR SEMENTARA IKUT DIISI (tambahan pengguna 22 Okt 2026)
 *
 * Konseptor sementara milik ALETA (aleta_konseptor_sementara, tidak ditulis ke
 * SIPP - fitur itu memang tidak pernah menulis ke SIPP). Begitu hakim dipilih,
 * konseptor sementara perkara itu diisi nama hakimnya, KECUALI:
 *   - sudah ada konseptor sementara yang ditunjuk orang (bukan isian otomatis
 *     ini) dengan nama lain, atau
 *   - SIPP sudah mencatat konseptor (tetap) dengan nama lain;
 * keduanya hanya ditimpa dengan konfirmasi (timpaKonseptor). Keadaan konseptor
 * sebelumnya disimpan di konseptor_sebelum; pembatalan pilihan hakim
 * mengembalikannya - kecuali konseptornya sudah diganti orang sesudah itu.
 */

/** Penanda pada catatan konseptor sementara yang diisi dari pilihan hakim. */
export const PENANDA_KONSEPTOR_OTOMATIS = "Diisi dari pilihan hakim sidang";

export function tanggalSah(nilai: unknown): string {
  const t = String(nilai ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new ApiError(400, "Tanggal sidang wajib berbentuk YYYY-MM-DD.");
  return t;
}

function teks(n: unknown, batas = 200): string {
  return String(n ?? "").trim().slice(0, batas);
}

export type KelilingHari = {
  tanggal: string;
  aktif: boolean;
  /** Sudah ada keputusan (nyala ATAU mati) untuk tanggal ini - pop-up tidak ditawarkan lagi. */
  diputuskan: boolean;
  diubahNama: string;
  diubahPada: string;
};

export async function bacaKelilingHari(db: AletaDatabase, tanggal: string): Promise<KelilingHari> {
  const t = tanggalSah(tanggal);
  const b = await db.queryOne<{ aktif: number; diubah_nama: string; diubah_pada: string }>(
    `SELECT aktif, diubah_nama, diubah_pada FROM aleta_sidang_keliling_hari WHERE tanggal = ?`,
    [t]
  );
  return {
    tanggal: t,
    aktif: Boolean(b && Number(b.aktif) === 1),
    diputuskan: Boolean(b),
    diubahNama: teks(b?.diubah_nama),
    diubahPada: teks(b?.diubah_pada, 40),
  };
}

/**
 * Untuk TUNDA OTOMATIS (agen lain): apakah tanggal ini hari Sidang keliling.
 * Tabel belum terpasang / tanggal tidak sah = false (jam biasa), tidak melempar.
 */
export async function sidangKelilingAktif(db: AletaDatabase, tanggal: string): Promise<boolean> {
  try {
    return (await bacaKelilingHari(db, tanggal)).aktif;
  } catch {
    return false;
  }
}

export async function simpanKelilingHari(
  db: AletaDatabase,
  isian: { tanggal: unknown; aktif: unknown; olehId: string; olehNama: string }
): Promise<KelilingHari> {
  const t = tanggalSah(isian.tanggal);
  if (typeof isian.aktif !== "boolean") throw new ApiError(400, "Pilihan Sidang keliling wajib nyala atau mati.");
  const sekarang = new Date().toISOString();
  await db.run(`DELETE FROM aleta_sidang_keliling_hari WHERE tanggal = ?`, [t]);
  await db.run(
    `INSERT INTO aleta_sidang_keliling_hari (tanggal, aktif, diubah_oleh, diubah_nama, diubah_pada) VALUES (?, ?, ?, ?, ?)`,
    [t, isian.aktif ? 1 : 0, teks(isian.olehId), teks(isian.olehNama), sekarang]
  );
  return bacaKelilingHari(db, t);
}

type BarisHakim = {
  id: string;
  tanggal: string;
  perkara_id: string;
  nomor_perkara: string;
  sidang_id: string;
  hakim_id: string;
  hakim_nama: string;
  hakim_kode: string;
  anggota_majelis: number;
  panitera_nama: string;
  konseptor_diisi: number;
  konseptor_sebelum: string;
  dipilih_oleh: string;
  dipilih_nama: string;
  waktu: string;
};

function kePilihan(b: BarisHakim): PilihanHakimSidang & { nomorPerkara: string; paniteraNama: string } {
  return {
    perkaraId: teks(b.perkara_id),
    nomorPerkara: teks(b.nomor_perkara),
    hakimId: teks(b.hakim_id),
    hakimNama: teks(b.hakim_nama),
    hakimKode: teks(b.hakim_kode),
    anggotaMajelis: Number(b.anggota_majelis) === 1,
    paniteraNama: teks(b.panitera_nama),
    konseptorDiisi: Number(b.konseptor_diisi) === 1,
    dipilihNama: teks(b.dipilih_nama),
    waktu: teks(b.waktu, 40),
  };
}

export async function bacaHakimSidang(db: AletaDatabase, tanggal: string): Promise<Record<string, ReturnType<typeof kePilihan>>> {
  const t = tanggalSah(tanggal);
  const baris = await db.queryAll<BarisHakim>(`SELECT * FROM aleta_hakim_sidang_perkara WHERE tanggal = ?`, [t]);
  const peta: Record<string, ReturnType<typeof kePilihan>> = {};
  for (const b of baris) peta[teks(b.perkara_id)] = kePilihan(b);
  return peta;
}

export type IsianHakimSidang = {
  perkaraId: string;
  nomorPerkara?: string;
  sidangId?: string;
  hakimId?: string;
  hakimNama: string;
  hakimKode?: string;
  anggotaMajelis?: boolean;
  paniteraNama?: string;
};

export type HasilHakimSidang = {
  perkaraId: string;
  nomorPerkara: string;
  ok: boolean;
  sebab: string;
  /** diisi = konseptor sementara diisi hakim ini; sama = sudah hakim itu; perlu-konfirmasi = tidak ditimpa. */
  konseptor: "diisi" | "sama" | "perlu-konfirmasi" | "tidak-diubah";
  konseptorLama?: string;
};

/** Konseptor sementara ini hasil isian otomatis pilihan hakim (bukan tunjukan orang). */
export function konseptorOtomatis(k: Pick<KonseptorSementara, "catatan"> | null | undefined): boolean {
  return Boolean(k && String(k.catatan || "").startsWith(PENANDA_KONSEPTOR_OTOMATIS));
}

async function tulisKonseptor(db: AletaDatabase, k: KonseptorSementara) {
  await db.run(`DELETE FROM aleta_konseptor_sementara WHERE perkara_id = ?`, [k.perkaraId]);
  await db.run(
    `INSERT INTO aleta_konseptor_sementara (perkara_id, nomor_perkara, nama, pengguna, catatan, ditetapkan_oleh, ditetapkan_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [k.perkaraId, k.nomorPerkara, k.nama, k.pengguna, k.catatan, k.ditetapkanOleh, k.ditetapkanAt]
  );
}

/**
 * Menyimpan pilihan hakim (satu atau banyak perkara sekaligus - per perkara
 * atau per panitera sidang) dan mengisi konseptor sementara.
 *
 * konseptorSipp: nama konseptor yang tercatat di SIPP per perkara (dibaca rute
 * lewat bot); undefined = tidak terbaca - konseptor sementara tetap boleh diisi.
 */
export async function simpanHakimSidang(
  db: AletaDatabase,
  opsi: {
    tanggal: unknown;
    pilihan: IsianHakimSidang[];
    olehId: string;
    olehNama: string;
    timpaKonseptor?: boolean;
    konseptorSipp?: Record<string, string[]>;
  }
): Promise<HasilHakimSidang[]> {
  const t = tanggalSah(opsi.tanggal);
  const daftar = Array.isArray(opsi.pilihan) ? opsi.pilihan.slice(0, 300) : [];
  if (daftar.length === 0) throw new ApiError(400, "Pilih perkara dan hakimnya lebih dulu.");
  const ids = daftar.map((p) => teks(p.perkaraId, 40)).filter(Boolean);
  const konseptor = await bacaKonseptorSementara(db, ids);
  const sekarang = new Date().toISOString();
  const hasil: HasilHakimSidang[] = [];

  for (const p of daftar) {
    const perkaraId = teks(p.perkaraId, 40);
    const hakimNama = teks(p.hakimNama);
    const nomorPerkara = teks(p.nomorPerkara, 100);
    if (!perkaraId || !hakimNama) {
      hasil.push({ perkaraId, nomorPerkara, ok: false, sebab: "Perkara atau hakimnya kosong.", konseptor: "tidak-diubah" });
      continue;
    }
    const kunci = `${t}|${perkaraId}`;
    const lama = await db.queryOne<BarisHakim>(`SELECT * FROM aleta_hakim_sidang_perkara WHERE id = ?`, [kunci]);
    const kini = konseptor[perkaraId] ?? null;
    const sipp = opsi.konseptorSipp?.[perkaraId] ?? [];

    // --- konseptor sementara ------------------------------------------------
    let status: HasilHakimSidang["konseptor"] = "tidak-diubah";
    let konseptorLama: string | undefined;
    let diisi = lama ? Number(lama.konseptor_diisi) === 1 : false;
    let sebelum = lama ? String(lama.konseptor_sebelum || "") : "";
    const sippLain = sipp.length > 0 && !sipp.some((n) => orangSama(n, hakimNama));
    const sementaraLain = Boolean(kini && kini.nama && !konseptorOtomatis(kini) && !orangSama(kini.nama, hakimNama));
    if (kini && kini.nama && orangSama(kini.nama, hakimNama) && !konseptorOtomatis(kini)) {
      status = "sama";
    } else if ((sippLain || sementaraLain) && !opsi.timpaKonseptor) {
      status = "perlu-konfirmasi";
      konseptorLama = sementaraLain ? kini!.nama : sipp.join(", ");
    } else {
      // Keadaan sebelum pilihan PERTAMA tanggal ini yang disimpan: memilih
      // ulang hakim lain tidak boleh menjadikan isian otomatis sebagai "asli".
      if (!(lama && Number(lama.konseptor_diisi) === 1)) sebelum = kini ? JSON.stringify(kini) : "";
      await tulisKonseptor(db, {
        perkaraId,
        nomorPerkara: nomorPerkara || kini?.nomorPerkara || "",
        nama: hakimNama,
        pengguna: "",
        catatan: `${PENANDA_KONSEPTOR_OTOMATIS} ${t}`,
        ditetapkanOleh: teks(opsi.olehNama) || "petugas",
        ditetapkanAt: sekarang,
      });
      diisi = true;
      status = "diisi";
    }

    await db.run(`DELETE FROM aleta_hakim_sidang_perkara WHERE id = ?`, [kunci]);
    await db.run(
      `INSERT INTO aleta_hakim_sidang_perkara
         (id, tanggal, perkara_id, nomor_perkara, sidang_id, hakim_id, hakim_nama, hakim_kode, anggota_majelis,
          panitera_nama, konseptor_diisi, konseptor_sebelum, dipilih_oleh, dipilih_nama, waktu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kunci,
        t,
        perkaraId,
        nomorPerkara,
        teks(p.sidangId, 40),
        teks(p.hakimId, 40),
        hakimNama,
        teks(p.hakimKode, 40),
        p.anggotaMajelis ? 1 : 0,
        teks(p.paniteraNama),
        diisi ? 1 : 0,
        diisi ? sebelum : "",
        teks(opsi.olehId),
        teks(opsi.olehNama),
        sekarang,
      ]
    );
    hasil.push({
      perkaraId,
      nomorPerkara,
      ok: true,
      sebab: status === "perlu-konfirmasi" ? `Konseptor tidak diubah: sudah ditunjuk ${konseptorLama}.` : "",
      konseptor: status,
      ...(konseptorLama ? { konseptorLama } : {}),
    });
  }
  return hasil;
}

/**
 * Membatalkan pilihan hakim (kembali ke majelis) dan mengembalikan konseptor
 * sementara ke keadaan sebelum diisi - hanya bila konseptornya masih isian
 * otomatis untuk hakim itu.
 */
export async function batalHakimSidang(
  db: AletaDatabase,
  opsi: { tanggal: unknown; perkaraIds: unknown }
): Promise<Array<{ perkaraId: string; ok: boolean; konseptor: "dikembalikan" | "dibiarkan" | "tidak-ada"; sebab: string }>> {
  const t = tanggalSah(opsi.tanggal);
  const ids = (Array.isArray(opsi.perkaraIds) ? opsi.perkaraIds : []).map((x) => teks(x, 40)).filter(Boolean).slice(0, 300);
  if (ids.length === 0) throw new ApiError(400, "Pilih perkara yang dibatalkan.");
  const konseptor = await bacaKonseptorSementara(db, ids);
  const hasil: Array<{ perkaraId: string; ok: boolean; konseptor: "dikembalikan" | "dibiarkan" | "tidak-ada"; sebab: string }> = [];
  for (const perkaraId of ids) {
    const kunci = `${t}|${perkaraId}`;
    const lama = await db.queryOne<BarisHakim>(`SELECT * FROM aleta_hakim_sidang_perkara WHERE id = ?`, [kunci]);
    if (!lama) {
      hasil.push({ perkaraId, ok: true, konseptor: "tidak-ada", sebab: "" });
      continue;
    }
    let status: "dikembalikan" | "dibiarkan" | "tidak-ada" = "tidak-ada";
    let sebab = "";
    if (Number(lama.konseptor_diisi) === 1) {
      const kini = konseptor[perkaraId] ?? null;
      if (kini && konseptorOtomatis(kini) && orangSama(kini.nama, lama.hakim_nama)) {
        let asal: KonseptorSementara | null = null;
        try {
          asal = lama.konseptor_sebelum ? (JSON.parse(lama.konseptor_sebelum) as KonseptorSementara) : null;
        } catch {
          asal = null;
        }
        if (asal && asal.nama) await tulisKonseptor(db, { ...asal, perkaraId });
        else await db.run(`DELETE FROM aleta_konseptor_sementara WHERE perkara_id = ?`, [perkaraId]);
        status = "dikembalikan";
      } else {
        status = "dibiarkan";
        sebab = "Konseptor sementara sudah diganti sesudah hakim dipilih - dibiarkan.";
      }
    }
    await db.run(`DELETE FROM aleta_hakim_sidang_perkara WHERE id = ?`, [kunci]);
    hasil.push({ perkaraId, ok: true, konseptor: status, sebab });
  }
  return hasil;
}
