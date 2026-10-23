import type { AletaDatabase } from "@/server/db/client";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - REKONSILIASI HARIAN (tahap 4)
 * ============================================================================
 *
 * Tiga pemeriksaan, hasilnya satu baris aleta_ai_rekonsiliasi per tanggal:
 *
 *   1. saldo = jumlah mutasi, untuk SETIAP pengguna (aturan inti saldo.ts);
 *      juga saldo_setelah mutasi terakhir = saldo sekarang (rantai utuh).
 *   2. pendapatan giliran hari itu (aleta_ai_obrolan_pesan.biaya_rp) = jumlah
 *      potongan di buku mutasi yang merujuk giliran-giliran itu.
 *   3. tahanan menggantung: rujukan dengan "tahan" tetapi tanpa "lepas" yang
 *      lebih tua dari 2 jam (giliran/tugas yang tidak pernah ditutup).
 *
 * status: 'selisih' bila (1) atau (2) tidak cocok; 'menggantung' bila hanya
 * (3); selain itu 'seimbang'. Pemeriksaan hanya MEMBACA - tidak ada saldo yang
 * dikoreksi otomatis; koreksi tetap mutasi "koreksi" oleh Super Admin.
 */

export type SelisihRekonsiliasi =
  | { jenis: "saldo"; penggunaId: string; saldoRp: number; jumlahMutasiRp: number; selisihRp: number }
  | { jenis: "rantai"; penggunaId: string; saldoRp: number; saldoSetelahTerakhirRp: number }
  | { jenis: "pendapatan"; pendapatanGiliranRp: number; potongMutasiRp: number; selisihRp: number }
  | { jenis: "tahanan"; penggunaId: string; rujukanId: string; ditahanRp: number; sejak: string };

export type HasilRekonsiliasi = {
  id: string;
  tanggal: string;
  dijalankanAt: string;
  olehId: string;
  jumlahPengguna: number;
  jumlahSelisih: number;
  tahananMenggantung: number;
  pendapatanGiliranRp: number;
  potongMutasiRp: number;
  status: "seimbang" | "selisih" | "menggantung";
  rincian: SelisihRekonsiliasi[];
};

const BATAS_MENGGANTUNG_MS = 2 * 60 * 60 * 1000;

function rentangHari(tanggal: string): { awal: string; akhir: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new ApiError(400, "Format tanggal harus YYYY-MM-DD.");
  const awal = new Date(`${tanggal}T00:00:00+08:00`);
  if (Number.isNaN(awal.getTime())) throw new ApiError(400, "Tanggal tidak sah.");
  return { awal: awal.toISOString(), akhir: new Date(awal.getTime() + 86_400_000).toISOString() };
}

export async function jalankanRekonsiliasi(
  db: AletaDatabase,
  opsi: { tanggal?: string; olehId?: string; sekarang?: Date } = {}
): Promise<HasilRekonsiliasi> {
  const sekarang = opsi.sekarang ?? new Date();
  const tanggal = opsi.tanggal || tanggalLokal(sekarang);
  const { awal, akhir } = rentangHari(tanggal);
  const rincian: SelisihRekonsiliasi[] = [];

  // 1. Saldo = jumlah mutasi, per pengguna.
  const saldo = await db.queryAll<{ pengguna_id: string; saldo_rp: number | string }>(`SELECT pengguna_id, saldo_rp FROM aleta_ai_saldo`);
  const jumlah = await db.queryAll<{ pengguna_id: string; total: number | string | null }>(
    `SELECT pengguna_id, COALESCE(SUM(jumlah_rp), 0) AS total FROM aleta_ai_mutasi GROUP BY pengguna_id`
  );
  const terakhir = await db.queryAll<{ pengguna_id: string; saldo_setelah: number | string; dibuat_at: string; id: string }>(
    `SELECT pengguna_id, saldo_setelah, dibuat_at, id FROM aleta_ai_mutasi ORDER BY dibuat_at, id`
  );
  const petaSaldo = new Map(saldo.map((b) => [b.pengguna_id, Number(b.saldo_rp)]));
  const petaJumlah = new Map(jumlah.map((b) => [b.pengguna_id, Number(b.total ?? 0)]));
  const petaTerakhir = new Map<string, number>();
  for (const b of terakhir) petaTerakhir.set(b.pengguna_id, Number(b.saldo_setelah));
  const pengguna = new Set([...petaSaldo.keys(), ...petaJumlah.keys()]);
  for (const id of [...pengguna].sort()) {
    const s = petaSaldo.get(id) ?? 0;
    const j = petaJumlah.get(id) ?? 0;
    if (s !== j) rincian.push({ jenis: "saldo", penggunaId: id, saldoRp: s, jumlahMutasiRp: j, selisihRp: s - j });
    const t = petaTerakhir.get(id);
    if (t !== undefined && t !== s) rincian.push({ jenis: "rantai", penggunaId: id, saldoRp: s, saldoSetelahTerakhirRp: t });
  }

  // 2. Pendapatan giliran hari itu = potongan mutasi yang merujuk giliran itu.
  const giliran = await db.queryAll<{ id: string; biaya_rp: number | string }>(
    `SELECT id, biaya_rp FROM aleta_ai_obrolan_pesan WHERE peran = 'ai' AND status <> 'berjalan' AND dibuat_at >= ? AND dibuat_at < ?`,
    [awal, akhir]
  );
  const idGiliran = new Set(giliran.map((g) => g.id));
  const pendapatanGiliranRp = giliran.reduce((n, g) => n + Number(g.biaya_rp), 0);
  // Potongan ditulis saat giliran SELESAI - bisa lewat tengah malam; rentang mutasi diperlebar satu hari.
  const potong = await db.queryAll<{ rujukan_id: string; jumlah_rp: number | string }>(
    `SELECT rujukan_id, jumlah_rp FROM aleta_ai_mutasi WHERE jenis = 'potong' AND dibuat_at >= ? AND dibuat_at < ?`,
    [awal, new Date(new Date(akhir).getTime() + 86_400_000).toISOString()]
  );
  const potongMutasiRp = potong.filter((m) => idGiliran.has(m.rujukan_id)).reduce((n, m) => n - Number(m.jumlah_rp), 0);
  if (pendapatanGiliranRp !== potongMutasiRp) {
    rincian.push({ jenis: "pendapatan", pendapatanGiliranRp, potongMutasiRp, selisihRp: pendapatanGiliranRp - potongMutasiRp });
  }

  // 3. Tahanan menggantung (seluruh waktu, bukan hanya hari itu).
  const tahan = await db.queryAll<{ pengguna_id: string; rujukan_id: string; jenis: string; jumlah_rp: number | string; dibuat_at: string }>(
    `SELECT pengguna_id, rujukan_id, jenis, jumlah_rp, dibuat_at FROM aleta_ai_mutasi WHERE jenis IN ('tahan', 'lepas') AND rujukan_id <> ''`
  );
  const perRujukan = new Map<string, { penggunaId: string; rujukanId: string; ditahan: number; sejak: string; lepas: boolean }>();
  for (const m of tahan) {
    const kunci = `${m.pengguna_id}\u0000${m.rujukan_id}`;
    const r = perRujukan.get(kunci) ?? { penggunaId: m.pengguna_id, rujukanId: m.rujukan_id, ditahan: 0, sejak: m.dibuat_at, lepas: false };
    if (m.jenis === "lepas") r.lepas = true;
    else {
      r.ditahan += -Number(m.jumlah_rp);
      if (m.dibuat_at < r.sejak) r.sejak = m.dibuat_at;
    }
    perRujukan.set(kunci, r);
  }
  let tahananMenggantung = 0;
  for (const r of perRujukan.values()) {
    if (r.lepas || r.ditahan <= 0) continue;
    if (sekarang.getTime() - new Date(r.sejak).getTime() < BATAS_MENGGANTUNG_MS) continue;
    tahananMenggantung += 1;
    rincian.push({ jenis: "tahanan", penggunaId: r.penggunaId, rujukanId: r.rujukanId, ditahanRp: r.ditahan, sejak: r.sejak });
  }

  const jumlahSelisih = rincian.filter((r) => r.jenis !== "tahanan").length;
  const status: HasilRekonsiliasi["status"] = jumlahSelisih > 0 ? "selisih" : tahananMenggantung > 0 ? "menggantung" : "seimbang";
  const hasil: HasilRekonsiliasi = {
    id: `rek-${tanggal}`,
    tanggal,
    dijalankanAt: sekarang.toISOString(),
    olehId: String(opsi.olehId ?? ""),
    jumlahPengguna: pengguna.size,
    jumlahSelisih,
    tahananMenggantung,
    pendapatanGiliranRp,
    potongMutasiRp,
    status,
    rincian,
  };

  const nilai = [hasil.dijalankanAt, hasil.olehId, hasil.jumlahPengguna, jumlahSelisih, tahananMenggantung, pendapatanGiliranRp, potongMutasiRp, status, JSON.stringify(rincian.slice(0, 500))];
  const ubah = await db.run(
    `UPDATE aleta_ai_rekonsiliasi SET dijalankan_at = ?, oleh_id = ?, jumlah_pengguna = ?, jumlah_selisih = ?, tahanan_menggantung = ?, pendapatan_giliran_rp = ?, potong_mutasi_rp = ?, status = ?, rincian_json = ? WHERE id = ?`,
    [...nilai, hasil.id]
  );
  if (!ubah.changes) {
    await db.run(
      `INSERT INTO aleta_ai_rekonsiliasi (dijalankan_at, oleh_id, jumlah_pengguna, jumlah_selisih, tahanan_menggantung, pendapatan_giliran_rp, potong_mutasi_rp, status, rincian_json, id, tanggal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...nilai, hasil.id, tanggal]
    );
  }
  if (status !== "seimbang") {
    await catatJejak(db, { penggunaId: hasil.olehId, peranId: hasil.olehId ? "super-admin" : "", aksi: "rekonsiliasi", hasil: status, ringkas: `Rekonsiliasi ${tanggal}: ${jumlahSelisih} selisih, ${tahananMenggantung} tahanan menggantung` });
  }
  return hasil;
}

type BarisRekonsiliasi = {
  id: string;
  tanggal: string;
  dijalankan_at: string;
  oleh_id: string;
  jumlah_pengguna: number | string;
  jumlah_selisih: number | string;
  tahanan_menggantung: number | string;
  pendapatan_giliran_rp: number | string;
  potong_mutasi_rp: number | string;
  status: string;
  rincian_json: string;
};

export async function daftarRekonsiliasi(db: AletaDatabase, batas = 31): Promise<HasilRekonsiliasi[]> {
  const baris = await db.queryAll<BarisRekonsiliasi>(`SELECT * FROM aleta_ai_rekonsiliasi ORDER BY tanggal DESC LIMIT ?`, [Math.min(366, Math.max(1, batas))]);
  return baris.map((b) => {
    let rincian: SelisihRekonsiliasi[] = [];
    try {
      const j = JSON.parse(b.rincian_json) as unknown;
      if (Array.isArray(j)) rincian = j as SelisihRekonsiliasi[];
    } catch {
      rincian = [];
    }
    return {
      id: b.id,
      tanggal: b.tanggal,
      dijalankanAt: b.dijalankan_at,
      olehId: b.oleh_id,
      jumlahPengguna: Number(b.jumlah_pengguna),
      jumlahSelisih: Number(b.jumlah_selisih),
      tahananMenggantung: Number(b.tahanan_menggantung),
      pendapatanGiliranRp: Number(b.pendapatan_giliran_rp),
      potongMutasiRp: Number(b.potong_mutasi_rp),
      status: (["seimbang", "selisih", "menggantung"].includes(b.status) ? b.status : "selisih") as HasilRekonsiliasi["status"],
      rincian,
    };
  });
}

/**
 * Rekonsiliasi KEMARIN bila belum pernah dijalankan (malas: dipanggil saat
 * Super Admin membuka laporan/rekonsiliasi - server tidak punya penjadwal
 * khusus ALETA Ai). Tidak pernah melempar.
 */
export async function rekonsiliasiHarianBilaPerlu(db: AletaDatabase, sekarang: Date = new Date()): Promise<HasilRekonsiliasi | null> {
  try {
    const kemarin = tanggalLokal(new Date(sekarang.getTime() - 86_400_000));
    const ada = await db.queryOne<{ id: string }>(`SELECT id FROM aleta_ai_rekonsiliasi WHERE id = ?`, [`rek-${kemarin}`]);
    if (ada) return null;
    return await jalankanRekonsiliasi(db, { tanggal: kemarin, sekarang });
  } catch {
    return null;
  }
}
