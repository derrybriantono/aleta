import { createHash } from "node:crypto";

import {
  KUNCI_CATATAN_SINKRON_ABT,
  KUNCI_SETELAN_SINKRON_ABT,
  SETELAN_SINKRON_ABT_BAWAAN,
  bersihkanSetelanSinkron,
  hitungNamaAplikasi,
  hitungTambalan,
  keputusanDetak,
  sebabSetelanDitolak,
  terapkanTambalan,
  type ButirBeda,
  type ButirEkspor,
  type ButirHilang,
  type ButirTidakSiap,
  type CatatanSinkronAbt,
  type DaftarEkspor,
  type RingkasBeda,
  type SetelanSinkronAbt,
} from "@/lib/aleta-abt-sinkron";
import type { HasilBeda } from "@/lib/aleta-abt-penyunting-tipe";
import { nomorBaku, petaRujukan } from "@/lib/aleta-abt-pustaka";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { bedaDuaIsi, petaIsian } from "@/server/modules/aleta-abt-penyunting/service";
import { bitaIsi, isiTersimpanDari, mulaiSinkron, simpanSebagaiVersiAbt } from "@/server/modules/aleta-abt-pustaka/service";
import { buatZip } from "@/server/modules/aleta-abt-sinkron/zip";
import { susunPaket, type ButirPaket } from "@/server/modules/aleta-abt-sinkron/paket";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * TETAP SINKRON DENGAN ABT (5 Nov 2026, Tahap 9, migrasi 0136)
 * ============================================================================
 *
 * Yang dikerjakan di sini (rute /api/aleta-abt/sinkron hanya memeriksa Super Admin dan mencatat audit):
 *   - sinkron terjadwal: detak 5 menit, bawaan MATI, sekali per tanggal WITA sesudah jam yang dipilih, tidak pada jam kerja sidang
 *     kecuali diizinkan; yang dijalankan adalah mulaiSinkron milik pustaka (satu sinkron sekaligus, ABT hanya dibaca);
 *   - daftar blangko yang isinya berbeda dengan ABT (ubahan ALETA ABT melawan isi ABT terbaru yang disimpan sebagai pembanding);
 *   - pilihan Super Admin per blangko: ambil dari ABT (isi ALETA ABT disimpan sebagai versi lama) atau tetap memakai ALETA ABT;
 *   - ekspor ubahan sebagai paket ABT yang dapat ditinjau (ZIP berkas saja).
 *
 * Tidak ada yang ditulis ke ABT/SIPP dan paket tidak dipasang ke mana pun. Aturan tidak-menimpa tetap di lib/aleta-abt-pustaka.ts.
 */

export type Aktor = { id: string; name: string };

type Opsi = { kini?: () => string };

const teks = (x: unknown) => String(x ?? "");
const bilangan = (x: unknown) => Number(x) || 0;
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const HARI_MS = 86_400_000;
const adaRtf = (nama: string) => /\.rtf$/i.test(nama);
const tanpaRtf = (nama: string) => teks(nama).replace(/\.rtf$/i, "");
const kiniDari = (o?: Opsi) => (o?.kini ?? (() => new Date().toISOString()))();

// ---------------------------------------------------------------------------------------------------------------
// Setelan
// ---------------------------------------------------------------------------------------------------------------

export async function bacaSetelanSinkronAbt(db: AletaDatabase): Promise<SetelanSinkronAbt> {
  return bersihkanSetelanSinkron((await bacaKunci(db, KUNCI_SETELAN_SINKRON_ABT)) ?? SETELAN_SINKRON_ABT_BAWAAN);
}

/** Hanya dipanggil rute yang sudah memastikan Super Admin. Jam pemicu di jam kerja sidang ditolak kecuali diizinkan. */
export async function simpanSetelanSinkronAbt(db: AletaDatabase, aktor: Aktor, badan: Record<string, unknown>, o?: Opsi): Promise<SetelanSinkronAbt> {
  const lama = await bacaSetelanSinkronAbt(db);
  const baru = bersihkanSetelanSinkron({
    jadwal: typeof badan.jadwal === "boolean" ? badan.jadwal : lama.jadwal,
    jam: badan.jam ?? lama.jam,
    izinJamKerja: typeof badan.izinJamKerja === "boolean" ? badan.izinJamKerja : lama.izinJamKerja,
    diubahOleh: aktor.name || aktor.id,
    diubahPada: kiniDari(o),
  });
  const sebab = sebabSetelanDitolak(baru);
  if (sebab) throw new ApiError(422, sebab);
  await tulisKunci(db, KUNCI_SETELAN_SINKRON_ABT, baru);
  return baru;
}

// ---------------------------------------------------------------------------------------------------------------
// Detak terjadwal (pola penjadwal yang sudah ada: detak 5 menit di instrumentation.ts, sekali per tanggal)
// ---------------------------------------------------------------------------------------------------------------

export type HasilDetak = "mati" | "belum" | "jam-kerja" | "sudah" | "jalan" | "sibuk" | "gagal" | "dimatikan";

export async function detakSinkronAbt(
  db: AletaDatabase,
  opsi: { kini?: Date; env?: Record<string, string | undefined>; mulai?: (db: AletaDatabase, oleh: string) => Promise<unknown> } = {}
): Promise<HasilDetak> {
  const env = opsi.env ?? process.env;
  if (env.ALETA_ABT_SINKRON === "0") return "dimatikan";
  const setelan = await bacaSetelanSinkronAbt(db);
  const { tanggal, jam } = waktuPengadilan(opsi.kini);
  const catatan = await bacaKunci<CatatanSinkronAbt>(db, KUNCI_CATATAN_SINKRON_ABT);
  const putus = keputusanDetak(setelan, tanggal, jam, catatan && typeof catatan.tanggal === "string" ? catatan : null);
  if (putus !== "jalan") return putus;
  const mulai = opsi.mulai ?? ((d: AletaDatabase, oleh: string) => mulaiSinkron(d, oleh));
  try {
    await mulai(db, "Jadwal otomatis");
  } catch (galat) {
    // Sedang berjalan (sinkron tangan): dicoba lagi pada detak berikutnya, tanpa mencatat tanggal.
    if (galat instanceof ApiError && galat.status === 409) return "sibuk";
    await tulisKunci(db, KUNCI_CATATAN_SINKRON_ABT, { tanggal, pada: new Date().toISOString() }).catch(() => undefined);
    console.error("[aleta-abt-sinkron] jadwal gagal dimulai:", galat instanceof Error ? galat.message : galat);
    return "gagal";
  }
  await tulisKunci(db, KUNCI_CATATAN_SINKRON_ABT, { tanggal, pada: new Date().toISOString() });
  return "jalan";
}

type Wadah = { detak?: ReturnType<typeof setInterval> };
const wadah = (): Wadah => {
  const g = globalThis as unknown as { __aletaAbtSinkronWadah?: Wadah };
  if (!g.__aletaAbtSinkronWadah) g.__aletaAbtSinkronWadah = {};
  return g.__aletaAbtSinkronWadah;
};

/** Dipasang di instrumentation.ts. Saklar jadwal bawaan MATI: detak hanya membaca satu baris setelan. Matikan total: ALETA_ABT_SINKRON=0. */
export function mulaiSinkronAbtBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_ABT_SINKRON === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakSinkronAbt(await getDb(), { env });
    } catch (e) {
      console.error("[aleta-abt-sinkron] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 5 * 60 * 1000);
  setTimeout(() => void detak(), 170 * 1000);
}

// ---------------------------------------------------------------------------------------------------------------
// Daftar
// ---------------------------------------------------------------------------------------------------------------

type BarisBerkas = {
  id: string;
  folder: string;
  nama: string;
  status: string;
  ukuran: number | string;
  diubah: number | string;
  asal: string;
  md5: string;
  md5_asal: string;
  bentrok_md5: string;
  bentrok_at: string;
  hilang_at: string;
};

export async function ringkasanBeda(db: AletaDatabase, kini: Date = new Date()): Promise<RingkasBeda> {
  const [berkas, menu, banding, riwayat, setelan] = await Promise.all([
    db.queryAll<BarisBerkas>("SELECT id, folder, nama, status, ukuran, diubah, asal, md5, md5_asal, bentrok_md5, bentrok_at, hilang_at FROM aleta_abt_berkas"),
    db.queryAll<{ id: string; nama: string | null; nama_alias: string | null }>("SELECT id, nama, nama_alias FROM aleta_abt_menu").catch(() => []),
    db.queryAll<{ berkas_id: string; md5: string; ukuran: number | string }>("SELECT berkas_id, md5, ukuran FROM aleta_abt_berkas_banding WHERE peran = 'beda'"),
    db.queryAll<{ status: string; mulai_at: string; selesai_at: string; galat: string }>("SELECT status, mulai_at, selesai_at, galat FROM aleta_abt_sinkron ORDER BY mulai_at DESC LIMIT 1"),
    bacaSetelanSinkronAbt(db),
  ]);
  const label = new Map(menu.map((m) => [teks(m.id), teks(m.nama_alias || m.nama || m.id)]));
  const ukuranAbt = new Map(banding.map((b) => [`${b.berkas_id}|${b.md5}`, bilangan(b.ukuran)]));
  const daftar: ButirBeda[] = berkas
    .filter((b) => teks(b.bentrok_md5) && b.status !== "hilang")
    .map((b) => {
      const sejak = teks(b.bentrok_at);
      const t = Date.parse(sejak);
      return {
        id: b.id,
        nama: tanpaRtf(b.nama),
        folder: teks(b.folder),
        folderLabel: label.get(teks(b.folder)) || teks(b.folder) || "Tanpa folder",
        ukuranAleta: bilangan(b.ukuran),
        ukuranAbt: ukuranAbt.get(`${b.id}|${b.bentrok_md5}`) ?? 0,
        sejak,
        hari: Number.isFinite(t) ? Math.max(0, Math.floor((kini.getTime() - t) / HARI_MS)) : 0,
      };
    })
    .sort((a, b) => a.sejak.localeCompare(b.sejak) || a.nama.localeCompare(b.nama, "id", { numeric: true }));
  const daftarHilang: ButirHilang[] = berkas
    .filter((b) => b.status === "hilang")
    .map((b) => ({ id: b.id, nama: tanpaRtf(b.nama), folder: teks(b.folder), folderLabel: label.get(teks(b.folder)) || teks(b.folder) || "Tanpa folder", sejak: teks(b.hilang_at) }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true }));
  const ubahan = berkas.filter((b) => bilangan(b.diubah) === 1 && b.asal === "abt" && b.status !== "hilang" && !teks(b.bentrok_md5) && teks(b.md5) !== teks(b.md5_asal)).length;
  const r = riwayat[0];
  return {
    menunggu: daftar.length,
    tertuaHari: daftar.reduce((m, x) => Math.max(m, x.hari), 0),
    hilang: daftarHilang.length,
    ubahan,
    setelan,
    putaranTerakhir: r ? { status: r.status === "berhasil" ? "berhasil" : r.status === "gagal" ? "gagal" : "jalan", pada: teks(r.selesai_at || r.mulai_at), galat: teks(r.galat) } : null,
    sedangJalan: r?.status === "jalan",
    daftar,
    daftarHilang,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Buka satu beda
// ---------------------------------------------------------------------------------------------------------------

export type BedaBuka = {
  id: string;
  nama: string;
  folder: string;
  md5Aleta: string;
  md5Abt: string;
  ukuranAleta: number;
  ukuranAbt: number;
  sejak: string;
  /** null bila isi ABT belum tersimpan, atau berkas bukan RTF. */
  beda: HasilBeda | null;
  sebabTanpaBeda: string;
  /** Isi ABT terbaru tersimpan, jadi "ambil dari ABT" dapat dilakukan. */
  dapatDiambil: boolean;
  /** Blangko punya suntingan yang belum terbit (draf); tetap aman, tetap ada di riwayat. */
  adaDraf: boolean;
};

type BerkasIsi = BarisBerkas & { isi: string; pengkodean: string; penanda_asal: string };

async function ambilBerkasIsi(db: AletaDatabase, id: string): Promise<BerkasIsi> {
  const b = await db.queryOne<BerkasIsi>(
    "SELECT id, folder, nama, status, ukuran, diubah, asal, md5, md5_asal, bentrok_md5, bentrok_at, hilang_at, isi, pengkodean, penanda_asal FROM aleta_abt_berkas WHERE id = ?",
    [id]
  );
  if (!b) throw new ApiError(404, "Blangko tidak ditemukan di pustaka.");
  return b;
}

export async function bukaBeda(db: AletaDatabase, id: string): Promise<BedaBuka> {
  const b = await ambilBerkasIsi(db, id);
  if (!teks(b.bentrok_md5)) throw new ApiError(404, "Blangko ini tidak sedang berbeda dengan ABT.");
  const abt = await db.queryOne<{ isi: string; pengkodean: string; ukuran: number | string }>("SELECT isi, pengkodean, ukuran FROM aleta_abt_berkas_banding WHERE id = ?", [`${b.id}|${b.bentrok_md5}`]);
  const draf = await db.queryAll<{ nomor: number | string }>("SELECT nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ? AND status = 'draf' ORDER BY nomor DESC LIMIT 1", [b.id]);
  const terbit = await db.queryAll<{ nomor: number | string }>("SELECT nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ? AND status = 'terbit' ORDER BY nomor DESC LIMIT 1", [b.id]);
  const adaDraf = Boolean(draf.length && bilangan(draf[0].nomor) > bilangan(terbit[0]?.nomor));
  const dasar = {
    id: b.id,
    nama: tanpaRtf(b.nama),
    folder: teks(b.folder),
    md5Aleta: teks(b.md5),
    md5Abt: teks(b.bentrok_md5),
    ukuranAleta: bilangan(b.ukuran),
    ukuranAbt: abt ? bilangan(abt.ukuran) : 0,
    sejak: teks(b.bentrok_at),
    adaDraf,
  };
  if (!abt) {
    return { ...dasar, beda: null, sebabTanpaBeda: "Isi ABT yang terbaru belum tersimpan. Jalankan Sinkron dari ABT sekali lagi.", dapatDiambil: false };
  }
  if (!adaRtf(b.nama)) {
    return { ...dasar, beda: null, sebabTanpaBeda: "Berkas ini bukan RTF, jadi isinya tidak dapat ditampilkan berdampingan. Ukuran keduanya tertera di atas.", dapatDiambil: true };
  }
  const peta = await petaIsian(db);
  const beda = bedaDuaIsi(
    { nomor: 0, md5: teks(b.md5), ukuran: bilangan(b.ukuran), rtf: bitaIsi(b.isi, b.pengkodean).toString("latin1") },
    { nomor: 0, md5: dasar.md5Abt, ukuran: dasar.ukuranAbt, rtf: bitaIsi(abt.isi, abt.pengkodean).toString("latin1") },
    peta
  );
  return { ...dasar, beda, sebabTanpaBeda: "", dapatDiambil: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Pilihan: ambil dari ABT atau tetap memakai ALETA ABT
// ---------------------------------------------------------------------------------------------------------------

export type MasukanPutusan = { id: string; pilihan: "ambil" | "tetap"; md5Abt: string; md5Aleta: string };

export async function putuskanBeda(db: AletaDatabase, aktor: Aktor, masukan: MasukanPutusan, o: Opsi & { transaksi?: <T>(kerja: (tx: AletaDatabase) => Promise<T>) => Promise<T> } = {}) {
  const b = await ambilBerkasIsi(db, masukan.id);
  if (!teks(b.bentrok_md5)) throw new ApiError(409, "Blangko ini sudah tidak berbeda dengan ABT. Muat ulang daftar.");
  if (teks(masukan.md5Abt) !== teks(b.bentrok_md5) || teks(masukan.md5Aleta) !== teks(b.md5)) {
    throw new ApiError(409, "Isi blangko berubah sejak Anda membukanya. Muat ulang lalu tinjau lagi.");
  }
  const sekarang = kiniDari(o);
  const transaksi = o.transaksi ?? (<T,>(kerja: (tx: AletaDatabase) => Promise<T>) => withTransaction(db, kerja));
  if (masukan.pilihan === "tetap") {
    await transaksi(async (tx) => {
      const ada = (await tx.queryAll<{ id: string }>("SELECT id FROM aleta_abt_berkas_banding WHERE id = ?", [`${b.id}|${b.bentrok_md5}`]))[0];
      await tx.run("DELETE FROM aleta_abt_berkas_banding WHERE berkas_id = ? AND id <> ?", [b.id, `${b.id}|${b.bentrok_md5}`]);
      if (ada) await tx.run("UPDATE aleta_abt_berkas_banding SET peran = 'dasar' WHERE id = ?", [ada.id]);
      // ABT dicatat sebagai dasar baru; isi dan penanda ALETA ABT tidak disentuh sama sekali.
      await tx.run("UPDATE aleta_abt_berkas SET md5_asal = ?, bentrok_md5 = '', bentrok_at = '' WHERE id = ?", [b.bentrok_md5, b.id]);
    });
    return { id: b.id, pilihan: "tetap" as const, nomor: 0 };
  }
  const abt = await db.queryOne<{ isi: string; pengkodean: string; ukuran: number | string; penanda_asal: string }>(
    "SELECT isi, pengkodean, ukuran, penanda_asal FROM aleta_abt_berkas_banding WHERE id = ?",
    [`${b.id}|${b.bentrok_md5}`]
  );
  if (!abt) throw new ApiError(409, "Isi ABT yang terbaru belum tersimpan. Jalankan Sinkron dari ABT sekali lagi.");
  const bita = bitaIsi(abt.isi, abt.pengkodean);
  if (md5(bita) !== b.bentrok_md5) throw new ApiError(500, "Isi ABT yang tersimpan tidak cocok dengan sidiknya. Tidak diambil.");
  let penanda: string[] = [];
  try {
    const x = JSON.parse(teks(abt.penanda_asal)) as unknown;
    penanda = Array.isArray(x) ? x.map(String) : [];
  } catch {
    penanda = [];
  }
  const petaKode = new Map<string, string>();
  for (const r of await db.queryAll<{ no_var: string; kode: string }>("SELECT no_var, kode FROM aleta_abt_peta_variabel WHERE status <> 'hilang' ORDER BY server ASC")) {
    const no = nomorBaku(r.no_var);
    if (!petaKode.has(no)) petaKode.set(no, r.kode);
  }
  const baru = isiTersimpanDari(bita);
  const nomor = await transaksi(async (tx) => {
    const n = await simpanSebagaiVersiAbt(
      tx,
      b.id,
      { isi: b.isi, pengkodean: b.pengkodean, md5: teks(b.md5), ukuran: bilangan(b.ukuran) },
      baru,
      sekarang,
      { versiSatu: "Salinan dari ABT (sebelum dipilih dari ABT)", ambil: `Dipilih dari ABT oleh ${aktor.name || aktor.id}`, nama: aktor.name || aktor.id, oleh: aktor.id }
    );
    await tx.run(
      `UPDATE aleta_abt_berkas SET isi = ?, pengkodean = ?, md5 = ?, ukuran = ?, penanda_asal = ?, penanda_kode = ?, md5_asal = ?, diubah = 0,
         bentrok_md5 = '', bentrok_at = '', disinkron_at = ?, diubah_at = ? WHERE id = ?`,
      [baru.isi, baru.pengkodean, baru.md5, baru.ukuran, JSON.stringify(penanda), JSON.stringify(petaRujukan(penanda, petaKode).kode), baru.md5, sekarang, sekarang, b.id]
    );
    await tx.run("DELETE FROM aleta_abt_berkas_banding WHERE berkas_id = ?", [b.id]);
    return n;
  });
  return { id: b.id, pilihan: "ambil" as const, nomor };
}

// ---------------------------------------------------------------------------------------------------------------
// Ekspor ubahan sebagai paket ABT
// ---------------------------------------------------------------------------------------------------------------

type ButirSiap = ButirPaket & { nama: string; folder: string };

/** Hitung apa yang siap dikirim dan apa yang belum (dengan sebabnya). `hanyaId` membatasi ke blangko tertentu. */
export async function siapkanEkspor(db: AletaDatabase, hanyaId?: string[]): Promise<{ siap: ButirSiap[]; tidakSiap: ButirTidakSiap[] }> {
  const baris = await db.queryAll<BerkasIsi>(
    `SELECT id, folder, nama, status, ukuran, diubah, asal, md5, md5_asal, bentrok_md5, bentrok_at, hilang_at, isi, pengkodean, penanda_asal
       FROM aleta_abt_berkas WHERE diubah = 1 AND asal = 'abt' ORDER BY folder ASC, nama ASC`
  );
  const pilih = hanyaId?.length ? new Set(hanyaId) : null;
  const siap: ButirSiap[] = [];
  const tidakSiap: ButirTidakSiap[] = [];
  for (const b of baris) {
    if (pilih && !pilih.has(b.id)) continue;
    if (teks(b.md5) === teks(b.md5_asal)) continue; // isinya sama dengan ABT: tidak ada yang dikirim
    const tolak = (sebab: string) => tidakSiap.push({ id: b.id, nama: tanpaRtf(b.nama), folder: teks(b.folder), sebab });
    if (b.status === "hilang") {
      tolak("Blangko ini tidak ada lagi di ABT, jadi tidak ada berkas yang dapat ditambal.");
      continue;
    }
    if (teks(b.bentrok_md5)) {
      tolak("ABT juga berubah sejak ubahan dibuat. Tinjau dulu di daftar Beda dengan ABT, lalu pilih.");
      continue;
    }
    const baru = bitaIsi(b.isi, b.pengkodean);
    if (md5(baru) !== teks(b.md5)) {
      tolak("Isi yang tersimpan tidak cocok dengan sidiknya. Tidak dikirim.");
      continue;
    }
    // Isi ABT yang menjadi dasar: versi 1 (salinan ABT saat pertama disunting), isi yang diambil dari ABT, atau pembanding yang dipertahankan.
    let dasarRow = await db.queryOne<{ isi: string; pengkodean: string }>("SELECT isi, pengkodean FROM aleta_abt_berkas_versi WHERE berkas_id = ? AND md5 = ? LIMIT 1", [b.id, b.md5_asal]);
    if (!dasarRow) dasarRow = await db.queryOne<{ isi: string; pengkodean: string }>("SELECT isi, pengkodean FROM aleta_abt_berkas_banding WHERE berkas_id = ? AND md5 = ? LIMIT 1", [b.id, b.md5_asal]);
    if (!dasarRow) {
      tolak("Isi ABT yang menjadi dasar ubahan ini tidak tersimpan, jadi tambalannya tidak dapat dihitung dengan aman.");
      continue;
    }
    const lama = bitaIsi(dasarRow.isi, dasarRow.pengkodean);
    if (md5(lama) !== teks(b.md5_asal)) {
      tolak("Isi dasar yang tersimpan tidak cocok dengan sidiknya. Tidak dikirim.");
      continue;
    }
    if (hitungNamaAplikasi(baru) > hitungNamaAplikasi(lama)) {
      tolak("Isinya memuat nama aplikasi. Hapus kata itu di penyunting, terbitkan, lalu coba lagi.");
      continue;
    }
    const potongan = hitungTambalan(lama, baru);
    const cek = terapkanTambalan(lama, potongan);
    if (!cek || !cek.equals(baru)) {
      tolak("Tambalan tidak menghasilkan isi yang sama persis. Tidak dikirim.");
      continue;
    }
    siap.push({ id: b.id, nama: tanpaRtf(b.nama), folder: teks(b.folder), lama, baru, potongan });
  }
  return { siap, tidakSiap };
}

export async function daftarEkspor(db: AletaDatabase): Promise<DaftarEkspor> {
  const { siap, tidakSiap } = await siapkanEkspor(db);
  const butir: ButirEkspor[] = siap.map((s) => ({ id: s.id, nama: s.nama, folder: s.folder, potongan: s.potongan.length, ukuranBaru: s.baru.length }));
  return { siap: butir, tidakSiap };
}

export type HasilPaket = { nama: string; zip: Buffer; berkas: number; potongan: number; tidakSiap: ButirTidakSiap[]; sidikBerkas: Array<{ id: string; md5Lama: string; md5Baru: string }> };

export async function buatPaketEkspor(db: AletaDatabase, hanyaId?: string[], kini: Date = new Date()): Promise<HasilPaket> {
  const { siap, tidakSiap } = await siapkanEkspor(db, hanyaId);
  if (!siap.length) throw new ApiError(409, "Belum ada ubahan yang siap dikirim sebagai paket.");
  const tanggal = waktuPengadilan(kini).tanggal;
  const paket = susunPaket(tanggal, siap);
  // Penjaga terakhir: tidak satu kata nama aplikasi pun boleh ada di berkas paket.
  for (const f of paket.berkas) {
    if (/paket-satker\/tambal\.tsv$/.test(f.jalur)) continue; // base64 acak; isinya sudah diperiksa sebelum dihitung
    if (/aleta/i.test(f.isi.toString("latin1"))) throw new ApiError(500, `Paket memuat nama aplikasi di ${f.jalur}. Paket tidak dibuat.`);
  }
  return {
    nama: paket.nama,
    zip: buatZip(paket.berkas, kini),
    berkas: siap.length,
    potongan: paket.potongan,
    tidakSiap,
    sidikBerkas: siap.map((s) => ({ id: s.id, md5Lama: md5(s.lama), md5Baru: md5(s.baru) })),
  };
}
