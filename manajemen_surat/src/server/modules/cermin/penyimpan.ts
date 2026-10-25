/**
 * Penyimpan cermin: menulis kelompok perkara / sidang dari SIPP ke tabel
 * aleta_cermin_* (basis data ALETA). TIDAK ADA tulisan ke SIPP/ABT di sini.
 *
 * Baris yang isinya SAMA (sidik sama) dengan yang tersimpan dilewati, sehingga
 * pemindaian ulang dan pembaruan berkala tidak menulis apa pun bila tidak ada
 * yang berubah. Kolom yang diisi lapis lain (penanda_json, status_mediasi,
 * sisa_panjar pada perkara) TIDAK ditimpa di sini.
 */
import { createHash } from "node:crypto";

import { withTransaction, type AletaDatabase } from "@/server/db/client";
import type { JendelaSidang, PerkaraSumber, SidangSumber } from "@/server/modules/cermin/bot";

export function sidikIsi(isi: unknown): string {
  return createHash("sha1").update(JSON.stringify(isi)).digest("hex");
}

export type HasilSimpan = { ditulis: number; tetap: number };

async function sidikTersimpan(db: AletaDatabase, tabel: string, kunci: string, id: string[]): Promise<Map<string, string>> {
  const peta = new Map<string, string>();
  for (let mulai = 0; mulai < id.length; mulai += 500) {
    const bagian = id.slice(mulai, mulai + 500);
    const rows = await db.queryAll<{ k: string; sidik: string }>(
      `SELECT ${kunci} AS k, sidik FROM ${tabel} WHERE ${kunci} IN (${bagian.map(() => "?").join(", ")})`,
      bagian
    );
    for (const r of rows) peta.set(String(r.k), String(r.sidik));
  }
  return peta;
}

const nullAngka = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? null : Number(n));

/** Satu kelompok perkara -> aleta_cermin_perkara. */
export async function simpanKelompokPerkara(db: AletaDatabase, perkara: PerkaraSumber[], sekarang = new Date().toISOString()): Promise<HasilSimpan> {
  if (perkara.length === 0) return { ditulis: 0, tetap: 0 };
  const lama = await sidikTersimpan(db, "aleta_cermin_perkara", "perkara_id", perkara.map((p) => String(p.perkaraId)));
  const baru = perkara
    .map((p) => ({ p, sidik: sidikIsi(p) }))
    .filter(({ p, sidik }) => lama.get(String(p.perkaraId)) !== sidik);
  if (baru.length > 0) {
    await withTransaction(db, async (tx) => {
      for (const { p, sidik } of baru) {
        await tx.run(
          `INSERT INTO aleta_cermin_perkara
             (perkara_id, nomor_perkara, jenis_perkara_id, jenis_perkara_nama, alur_perkara_id, tanggal_pendaftaran, prodeo,
              tahapan_terakhir_id, tahapan_terakhir_text, proses_terakhir_id, proses_terakhir_text,
              majelis_hakim, panitera_pengganti, jurusita, sidang_pertama, sidang_terakhir, sidang_berikut, jumlah_sidang,
              tanggal_putusan, status_putusan, putusan_verstek, tanggal_minutasi, tanggal_bht,
              tanggal_sidang_maks, tanggal_akta, tanggal_relaas, tanggal_ikrar,
              sipp_diperbarui, cermin_diperbarui, sidik)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (perkara_id) DO UPDATE SET
             nomor_perkara = excluded.nomor_perkara,
             jenis_perkara_id = excluded.jenis_perkara_id,
             jenis_perkara_nama = excluded.jenis_perkara_nama,
             alur_perkara_id = excluded.alur_perkara_id,
             tanggal_pendaftaran = excluded.tanggal_pendaftaran,
             prodeo = excluded.prodeo,
             tahapan_terakhir_id = excluded.tahapan_terakhir_id,
             tahapan_terakhir_text = excluded.tahapan_terakhir_text,
             proses_terakhir_id = excluded.proses_terakhir_id,
             proses_terakhir_text = excluded.proses_terakhir_text,
             majelis_hakim = excluded.majelis_hakim,
             panitera_pengganti = excluded.panitera_pengganti,
             jurusita = excluded.jurusita,
             sidang_pertama = excluded.sidang_pertama,
             sidang_terakhir = excluded.sidang_terakhir,
             sidang_berikut = excluded.sidang_berikut,
             jumlah_sidang = excluded.jumlah_sidang,
             tanggal_putusan = excluded.tanggal_putusan,
             status_putusan = excluded.status_putusan,
             putusan_verstek = excluded.putusan_verstek,
             tanggal_minutasi = excluded.tanggal_minutasi,
             tanggal_bht = excluded.tanggal_bht,
             tanggal_sidang_maks = excluded.tanggal_sidang_maks,
             tanggal_akta = excluded.tanggal_akta,
             tanggal_relaas = excluded.tanggal_relaas,
             tanggal_ikrar = excluded.tanggal_ikrar,
             sipp_diperbarui = excluded.sipp_diperbarui,
             cermin_diperbarui = excluded.cermin_diperbarui,
             sidik = excluded.sidik`,
          [
            String(p.perkaraId),
            p.nomorPerkara,
            nullAngka(p.jenisPerkaraId),
            p.jenisPerkaraNama,
            nullAngka(p.alurPerkaraId),
            p.tanggalPendaftaran,
            p.prodeo ? 1 : 0,
            nullAngka(p.tahapanTerakhirId),
            p.tahapanTerakhirText,
            nullAngka(p.prosesTerakhirId),
            p.prosesTerakhirText,
            p.majelisHakim,
            p.paniteraPengganti,
            p.jurusita,
            p.sidangPertama,
            p.sidangTerakhir,
            p.sidangBerikut,
            Number(p.jumlahSidang) || 0,
            p.tanggalPutusan,
            p.statusPutusan,
            p.putusanVerstek ? 1 : 0,
            p.tanggalMinutasi,
            p.tanggalBht,
            p.sidangMaks ?? "",
            p.tanggalAkta ?? "",
            p.tanggalRelaas ?? "",
            p.tanggalIkrar ?? "",
            p.sippDiperbarui,
            sekarang,
            sidik,
          ]
        );
      }
    });
  }
  return { ditulis: baru.length, tetap: perkara.length - baru.length };
}

/** Satu jendela sidang -> aleta_cermin_sidang (baris_json = baris persis seperti layar Jadwal Sidang). */
export async function simpanJendelaSidang(
  db: AletaDatabase,
  jendela: Pick<JendelaSidang, "sidang">,
  sekarang = new Date().toISOString()
): Promise<HasilSimpan> {
  const daftar: SidangSumber[] = jendela.sidang ?? [];
  if (daftar.length === 0) return { ditulis: 0, tetap: 0 };
  const lama = await sidikTersimpan(db, "aleta_cermin_sidang", "sidang_id", daftar.map((s) => String(s.sidangId)));
  const baru = daftar.map((s) => ({ s, sidik: sidikIsi(s) })).filter(({ s, sidik }) => lama.get(String(s.sidangId)) !== sidik);
  if (baru.length > 0) {
    await withTransaction(db, async (tx) => {
      for (const { s, sidik } of baru) {
        await tx.run(
          `INSERT INTO aleta_cermin_sidang
             (sidang_id, perkara_id, tanggal_sidang, jam_sidang, ruangan, agenda, ditunda,
              baris_json, sipp_diperbarui, cermin_diperbarui, sidik)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (sidang_id) DO UPDATE SET
             perkara_id = excluded.perkara_id,
             tanggal_sidang = excluded.tanggal_sidang,
             jam_sidang = excluded.jam_sidang,
             ruangan = excluded.ruangan,
             agenda = excluded.agenda,
             ditunda = excluded.ditunda,
             baris_json = excluded.baris_json,
             sipp_diperbarui = excluded.sipp_diperbarui,
             cermin_diperbarui = excluded.cermin_diperbarui,
             sidik = excluded.sidik`,
          [
            String(s.sidangId),
            String(s.perkaraId),
            s.tanggalSidang,
            s.jamSidang,
            s.ruangan,
            s.agenda,
            s.ditunda ? 1 : 0,
            JSON.stringify(s.baris ?? {}),
            s.sippDiperbarui,
            sekarang,
            sidik,
          ]
        );
      }
    });
  }
  return { ditulis: baru.length, tetap: daftar.length - baru.length };
}

/** Hitungan baris tiap tabel cermin (untuk layar pemantau). */
export async function hitunganCermin(db: AletaDatabase) {
  const [p, s, pi, m, t] = await Promise.all([
    db.queryAll<{ n: number; terbaru: string | null }>("SELECT COUNT(*) AS n, MAX(cermin_diperbarui) AS terbaru FROM aleta_cermin_perkara"),
    db.queryAll<{ n: number; terbaru: string | null }>("SELECT COUNT(*) AS n, MAX(cermin_diperbarui) AS terbaru FROM aleta_cermin_sidang"),
    db.queryAll<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_cermin_pihak"),
    db.queryAll<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_cermin_mediasi"),
    db.queryAll<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_cermin_tag"),
  ]);
  return {
    perkara: Number(p[0]?.n) || 0,
    sidang: Number(s[0]?.n) || 0,
    pihak: Number(pi[0]?.n) || 0,
    mediasi: Number(m[0]?.n) || 0,
    tag: Number(t[0]?.n) || 0,
    perkaraTerbaru: p[0]?.terbaru ?? "",
    sidangTerbaru: s[0]?.terbaru ?? "",
  };
}

/**
 * Menggantikan seluruh sidang cermin pada [dari, sampai] dengan `sidang` hasil
 * bacaan SIPP: yang berubah/baru ditulis, yang sudah tidak ada di SIPP (dihapus
 * atau dipindah tanggal) dihapus dari cermin. Penghapusan HANYA bila bacaan
 * tidak terpotong batas baris - bacaan terpotong tidak boleh menghapus apa pun.
 */
export async function gantiSidangRentang(
  db: AletaDatabase,
  dari: string,
  sampai: string,
  sidang: SidangSumber[],
  opsi: { terpotong?: boolean; sekarang?: string } = {}
): Promise<HasilSimpan & { dihapus: number }> {
  const sekarang = opsi.sekarang ?? new Date().toISOString();
  const simpan = await simpanJendelaSidang(db, { sidang }, sekarang);
  let dihapus = 0;
  if (!opsi.terpotong) {
    const ada = new Set(sidang.map((s) => String(s.sidangId)));
    const lama = await db.queryAll<{ sidang_id: string }>("SELECT sidang_id FROM aleta_cermin_sidang WHERE tanggal_sidang >= ? AND tanggal_sidang <= ?", [dari, sampai]);
    const hapus = lama.map((r) => String(r.sidang_id)).filter((id) => !ada.has(id));
    for (let mulai = 0; mulai < hapus.length; mulai += 500) {
      const bagian = hapus.slice(mulai, mulai + 500);
      await db.run(`DELETE FROM aleta_cermin_sidang WHERE sidang_id IN (${bagian.map(() => "?").join(", ")})`, bagian);
    }
    dihapus = hapus.length;
  }
  return { ...simpan, dihapus };
}

/** Menghapus perkara (dan sidang, pihak, mediasi, penanda-nya) dari cermin - perkara yang sudah tidak ada di SIPP. */
export async function hapusPerkaraCermin(db: AletaDatabase, id: string[]): Promise<number> {
  const unik = [...new Set(id.map(String))];
  for (let mulai = 0; mulai < unik.length; mulai += 500) {
    const bagian = unik.slice(mulai, mulai + 500);
    const tanda = bagian.map(() => "?").join(", ");
    await withTransaction(db, async (tx) => {
      await tx.run(`DELETE FROM aleta_cermin_perkara WHERE perkara_id IN (${tanda})`, bagian);
      await tx.run(`DELETE FROM aleta_cermin_sidang WHERE perkara_id IN (${tanda})`, bagian);
      await tx.run(`DELETE FROM aleta_cermin_pihak WHERE perkara_id IN (${tanda})`, bagian);
      await tx.run(`DELETE FROM aleta_cermin_mediasi WHERE perkara_id IN (${tanda})`, bagian);
      await tx.run(`DELETE FROM aleta_cermin_tag WHERE perkara_id IN (${tanda})`, bagian);
    });
  }
  return unik.length;
}
