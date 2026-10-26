/**
 * Jejak tunda/putus otomatis terstruktur (U19, rantai F3, 25 Okt 2026).
 *
 * Blob harian di aleta_ekstensi_setelan ('sistem:tunda-otomatis:hari:*' dan
 * 'sistem:putus-otomatis:hari:*') TETAP sumber logika harian (satu jalan per tanggal,
 * tanda batal, pemberitahuan). Modul ini menulis BERDAMPINGAN ke aleta_otomatis_jejak
 * (0105) supaya hasilnya dapat dihitung: aturan mana, ditolak penjaga atau tidak, kering
 * atau nyata. Jejak tidak pernah menghentikan tunda/putus otomatis: semua kegagalan
 * ditelan (dicatat sekali di konsol), dan tabel yang belum ada (migrasi belum jalan)
 * tidak membuat portal galat.
 *
 * MATI BAWAAN (keputusan Derry 26 Okt 2026): saklar Fitur Satker "jejak-tunda-putus-otomatis" (hanya Super Admin).
 * Mati = tidak menulis baris jejak; blob harian lama tetap seperti dulu. Env ALETA_OTOMATIS_JEJAK memaksa:
 * "1" menyala, "0" mati, selain itu mengikuti saklar. Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */
import type { AletaDatabase } from "@/server/db/client";
import {
  KODE_FITUR_JEJAK_OTOMATIS,
  ringkasKetepatan,
  type BarisJejak,
  type FiturOtomatis,
  type LaporanKetepatan,
} from "@/lib/otomatis-jejak";
import { fiturMenyala } from "@/server/modules/satker/fitur";
import type { ButirPutusOtomatis, CatatanHariPutus } from "@/server/modules/putus-otomatis/layanan";
import type { ButirTundaOtomatis, CatatanHari } from "@/server/modules/tunda-otomatis/layanan";

const teks = (x: unknown) => String(x ?? "").trim();
const PANJANG_PESAN = 300;
const PENGGUNA_SISTEM = "*sistem*";

export const kunciJejak = (fitur: FiturOtomatis, tanggal: string, jadwalId: string) => `${fitur}:${tanggal}:${jadwalId}`;

// ---------------------------------------------------------------------------
// Pembentuk baris (murni)
// ---------------------------------------------------------------------------

export function barisDariTunda(tanggal: string, jalan: CatatanHari["jalan"], b: ButirTundaOtomatis): BarisJejak {
  const k = b.keputusan;
  const lewati = k.jenis === "lewati";
  const hasil = b.tulis?.status ?? "";
  return {
    id: kunciJejak("tunda", tanggal, b.jadwalId),
    fitur: "tunda",
    tanggal,
    jadwalId: b.jadwalId,
    perkaraId: teks(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    jenisPerkara: teks(b.jenisPerkara),
    keputusan: k.jenis,
    aturan: k.jenis === "lewati" ? k.sebab : k.aturan,
    nomorAturan: k.jenis === "lewati" ? 0 : Number(k.nomorAturan) || 0,
    tanggalTunda: k.jenis === "tunda" ? teks(k.tanggal) : "",
    hasil,
    kering: jalan?.mode === "kering",
    ditolakPenjaga: hasil === "ditolak" || hasil === "kering-ditolak",
    dibatalkanPetugas: (lewati && k.sebab === "dibatalkan-petugas") || hasil === "dibatalkan",
    pesan: teks(b.tulis?.pesan || k.penjelasan).slice(0, PANJANG_PESAN),
    edoc: "",
    pemicu: teks(jalan?.pemicu),
    jam: teks(jalan?.jam),
  };
}

export function barisDariPutus(tanggal: string, jalan: CatatanHariPutus["jalan"], b: ButirPutusOtomatis): BarisJejak {
  const k = b.keputusan;
  const putus = k.jenis === "putus";
  const hasil = b.tulis?.status ?? "";
  return {
    id: kunciJejak("putus", tanggal, b.jadwalId),
    fitur: "putus",
    tanggal,
    jadwalId: b.jadwalId,
    perkaraId: teks(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    jenisPerkara: teks(b.jenisPerkara),
    keputusan: putus ? "putus" : "lewati",
    aturan: putus ? k.status : k.sebab,
    nomorAturan: putus ? Number(k.nomorAturan) || 0 : 0,
    tanggalTunda: "",
    hasil,
    kering: jalan?.mode === "kering",
    ditolakPenjaga: hasil === "ditolak" || hasil === "kering-ditolak",
    dibatalkanPetugas: !putus && k.sebab === "dibatalkan-petugas",
    pesan: teks(b.tulis?.pesan || k.penjelasan).slice(0, PANJANG_PESAN),
    edoc: teks(b.edoc?.status),
    pemicu: teks(jalan?.pemicu),
    jam: teks(jalan?.jam),
  };
}

// ---------------------------------------------------------------------------
// Penulisan (berdampingan dengan blob; tidak pernah melempar)
// ---------------------------------------------------------------------------

const TINGGI_CADANGAN = 6000;
const SIMPAN = globalThis as unknown as { __aletaOtomatisJejak?: { hash: Map<string, string>; matiSampai: number; sudahMengeluh: boolean } };
const keadaan = () => (SIMPAN.__aletaOtomatisJejak ??= { hash: new Map(), matiSampai: 0, sudahMengeluh: false });

/** Pemaksa env: true/false bila ALETA_OTOMATIS_JEJAK "1"/"0", null bila saklar yang menentukan. */
export function pemaksaJejak(env: Record<string, string | undefined> = process.env): boolean | null {
  const v = String(env.ALETA_OTOMATIS_JEJAK ?? "").trim();
  if (v === "1") return true;
  if (v === "0") return false;
  return null;
}

/** Apakah jejak ditulis? Pemaksa env dulu, lalu saklar Fitur Satker (bawaan MATI; gagal baca = mati). */
export async function jejakMenyala(db: AletaDatabase, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const paksa = pemaksaJejak(env);
  if (paksa !== null) return paksa;
  try {
    return await fiturMenyala(db, KODE_FITUR_JEJAK_OTOMATIS);
  } catch {
    return false;
  }
}

/** Untuk uji: lupakan ingatan hash dan penundaan. */
export function aturUlangJejak() {
  SIMPAN.__aletaOtomatisJejak = undefined;
}

function ringkasBaris(b: BarisJejak): string {
  return JSON.stringify([b.keputusan, b.aturan, b.nomorAturan, b.tanggalTunda, b.hasil, b.kering, b.ditolakPenjaga, b.dibatalkanPetugas, b.pesan, b.edoc, b.pemicu, b.jam, b.nomorPerkara]);
}

const SQL_UPSERT =
  "INSERT INTO aleta_otomatis_jejak (id, fitur, tanggal, jadwal_id, perkara_id, nomor_perkara, jenis_perkara, keputusan, aturan, nomor_aturan, " +
  "tanggal_tunda, hasil, kering, ditolak_penjaga, dibatalkan_petugas, pesan, edoc, pemicu, jam, dibuat_pada, diubah_pada) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT (id) DO UPDATE SET perkara_id = excluded.perkara_id, nomor_perkara = excluded.nomor_perkara, jenis_perkara = excluded.jenis_perkara, " +
  "keputusan = excluded.keputusan, aturan = excluded.aturan, nomor_aturan = excluded.nomor_aturan, tanggal_tunda = excluded.tanggal_tunda, " +
  "hasil = excluded.hasil, kering = excluded.kering, ditolak_penjaga = excluded.ditolak_penjaga, dibatalkan_petugas = excluded.dibatalkan_petugas, " +
  "pesan = excluded.pesan, edoc = excluded.edoc, pemicu = excluded.pemicu, jam = excluded.jam, diubah_pada = excluded.diubah_pada";

/**
 * Menulis (upsert) baris-baris jejak. Baris yang tidak berubah sejak penulisan terakhir
 * dilewati, sehingga penyimpanan blob yang berulang-ulang dalam satu jalan murah.
 * Mengembalikan jumlah baris yang ditulis. TIDAK PERNAH melempar.
 */
export async function catatBaris(db: AletaDatabase, baris: readonly BarisJejak[], env: Record<string, string | undefined> = process.env): Promise<number> {
  if (baris.length === 0 || !(await jejakMenyala(db, env))) return 0;
  const k = keadaan();
  if (Date.now() < k.matiSampai) return 0;
  let tertulis = 0;
  const sekarang = new Date().toISOString();
  try {
    for (const b of baris) {
      if (!b.jadwalId || !b.tanggal) continue;
      const sidik = ringkasBaris(b);
      if (k.hash.get(b.id) === sidik) continue;
      await db.run(SQL_UPSERT, [
        b.id, b.fitur, b.tanggal, b.jadwalId, b.perkaraId, b.nomorPerkara, b.jenisPerkara, b.keputusan, b.aturan, b.nomorAturan,
        b.tanggalTunda, b.hasil, b.kering ? 1 : 0, b.ditolakPenjaga ? 1 : 0, b.dibatalkanPetugas ? 1 : 0, b.pesan, b.edoc, b.pemicu, b.jam,
        sekarang, sekarang,
      ]);
      if (k.hash.size > TINGGI_CADANGAN) k.hash.clear();
      k.hash.set(b.id, sidik);
      tertulis += 1;
    }
  } catch (e) {
    // Tabel belum ada (migrasi 0105 belum jalan) atau basis data bermasalah: jangan ganggu tunda/putus otomatis.
    k.matiSampai = Date.now() + 10 * 60 * 1000;
    if (!k.sudahMengeluh) {
      k.sudahMengeluh = true;
      console.warn("[OTOMATIS JEJAK] tidak dapat menulis jejak terstruktur (dicoba lagi 10 menit):", teks((e as Error)?.message).slice(0, 200));
    }
  }
  return tertulis;
}

/** Dipanggil setelah catatan tunda otomatis hari itu disimpan. Hanya sesudah ada jalan. */
export async function catatTundaHari(db: AletaDatabase, c: Pick<CatatanHari, "tanggal" | "jalan" | "butir">): Promise<number> {
  if (!c.jalan || c.butir.length === 0) return 0;
  try {
    return await catatBaris(db, c.butir.map((b) => barisDariTunda(c.tanggal, c.jalan, b)));
  } catch {
    return 0; // butir yang tidak utuh tidak boleh mengganggu tunda otomatis
  }
}

/** Dipanggil setelah catatan putus otomatis hari itu disimpan. Hanya sesudah ada jalan. */
export async function catatPutusHari(db: AletaDatabase, c: Pick<CatatanHariPutus, "tanggal" | "jalan" | "butir">): Promise<number> {
  if (!c.jalan || c.butir.length === 0) return 0;
  try {
    return await catatBaris(db, c.butir.map((b) => barisDariPutus(c.tanggal, c.jalan, b)));
  } catch {
    return 0; // butir yang tidak utuh tidak boleh mengganggu putus otomatis
  }
}

// ---------------------------------------------------------------------------
// Isi ulang dari blob lama
// ---------------------------------------------------------------------------

/**
 * Membaca semua blob harian yang sudah ada dan menuliskannya ke tabel (idempoten).
 * Dipakai sekali setelah migrasi dijalankan, atau kapan saja jejak perlu disusun ulang.
 */
export async function isiUlangJejakOtomatis(db: AletaDatabase): Promise<{ hariTunda: number; hariPutus: number; baris: number }> {
  const baris = await db.queryAll<{ kunci: string; nilai: string }>(
    "SELECT kunci, nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND (kunci LIKE ? OR kunci LIKE ?) ORDER BY kunci",
    [PENGGUNA_SISTEM, "sistem:tunda-otomatis:hari:%", "sistem:putus-otomatis:hari:%"]
  );
  let hariTunda = 0;
  let hariPutus = 0;
  let ditulis = 0;
  for (const r of baris) {
    let isi: Record<string, unknown>;
    try {
      isi = JSON.parse(String(r.nilai)) as Record<string, unknown>;
    } catch {
      continue;
    }
    const tanggal = r.kunci.slice(r.kunci.lastIndexOf(":") + 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !isi || typeof isi !== "object") continue;
    const butir = Array.isArray(isi.butir) ? isi.butir : [];
    const jalan = isi.jalan && typeof isi.jalan === "object" ? isi.jalan : null;
    if (!jalan || butir.length === 0) continue;
    if (r.kunci.startsWith("sistem:tunda-otomatis:hari:")) {
      hariTunda += 1;
      ditulis += await catatTundaHari(db, { tanggal, jalan: jalan as CatatanHari["jalan"], butir: butir as ButirTundaOtomatis[] });
    } else {
      hariPutus += 1;
      ditulis += await catatPutusHari(db, { tanggal, jalan: jalan as CatatanHariPutus["jalan"], butir: butir as ButirPutusOtomatis[] });
    }
  }
  return { hariTunda, hariPutus, baris: ditulis };
}

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------

type BarisDb = {
  id: string; fitur: string; tanggal: string; jadwal_id: string; perkara_id: string; nomor_perkara: string; jenis_perkara: string;
  keputusan: string; aturan: string; nomor_aturan: number | string; tanggal_tunda: string; hasil: string; kering: number | string | boolean;
  ditolak_penjaga: number | string | boolean; dibatalkan_petugas: number | string | boolean; pesan: string; edoc: string; pemicu: string; jam: string;
};

const benar = (x: unknown) => x === true || x === 1 || x === "1" || x === "t" || x === "true";

export function barisDariDb(r: BarisDb): BarisJejak {
  return {
    id: r.id,
    fitur: r.fitur === "putus" ? "putus" : "tunda",
    tanggal: r.tanggal,
    jadwalId: r.jadwal_id,
    perkaraId: r.perkara_id,
    nomorPerkara: r.nomor_perkara,
    jenisPerkara: r.jenis_perkara,
    keputusan: r.keputusan,
    aturan: r.aturan,
    nomorAturan: Number(r.nomor_aturan) || 0,
    tanggalTunda: r.tanggal_tunda,
    hasil: r.hasil,
    kering: benar(r.kering),
    ditolakPenjaga: benar(r.ditolak_penjaga),
    dibatalkanPetugas: benar(r.dibatalkan_petugas),
    pesan: r.pesan,
    edoc: r.edoc,
    pemicu: r.pemicu,
    jam: r.jam,
  };
}

/** Banyak baris yang ada di tabel (untuk memutuskan perlu isi ulang atau tidak). */
export async function hitungJejak(db: AletaDatabase): Promise<number> {
  const r = await db.queryOne<{ n: number | string }>("SELECT COUNT(*) AS n FROM aleta_otomatis_jejak");
  return Number(r?.n) || 0;
}

export async function laporanKetepatan(db: AletaDatabase, opsi: { dari: string; sampai: string; fitur?: FiturOtomatis | null }): Promise<LaporanKetepatan & { baris: BarisJejak[] }> {
  const params: Array<string> = [opsi.dari, opsi.sampai];
  let tambahan = "";
  if (opsi.fitur) {
    tambahan = " AND fitur = ?";
    params.push(opsi.fitur);
  }
  const rows = await db.queryAll<BarisDb>(
    "SELECT id, fitur, tanggal, jadwal_id, perkara_id, nomor_perkara, jenis_perkara, keputusan, aturan, nomor_aturan, tanggal_tunda, hasil, kering, " +
      "ditolak_penjaga, dibatalkan_petugas, pesan, edoc, pemicu, jam FROM aleta_otomatis_jejak WHERE tanggal >= ? AND tanggal <= ?" +
      tambahan +
      " ORDER BY tanggal DESC, jadwal_id",
    params
  );
  const baris = rows.map(barisDariDb);
  return { ...ringkasKetepatan(baris, opsi.dari, opsi.sampai), baris };
}
