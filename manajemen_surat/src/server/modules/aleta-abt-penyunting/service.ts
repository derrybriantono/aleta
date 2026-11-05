import { createHash, randomUUID } from "node:crypto";

import { bedaDaftar, bedaKata, type PotongBeda } from "@/lib/aleta-abt-beda";
import type {
  BarisBeda,
  BlangkoBuka,
  BlangkoDaftar,
  FolderDaftar,
  HasilBeda,
  HasilCoba,
  HasilSimpan,
  ParagrafLayar,
  RingkasVersi,
  TetapLayar,
} from "@/lib/aleta-abt-penyunting-tipe";
import { nomorBaku, petaRujukan } from "@/lib/aleta-abt-pustaka";
import { nilaiRekaan, NAMA_PERKARA_REKAAN } from "@/lib/aleta-abt-rekaan";
import {
  AKSARA_KOTAK,
  POLA_ISIAN,
  bagianParagraf,
  nomorIsianDi,
  terapkanSuntingan,
  uraiRtf,
  type BagianTeks,
  type BagianTetap,
  type DokumenRtf,
  type Rata,
  type Suntingan,
} from "@/lib/aleta-abt-rtf";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { bitaIsi, simpananIsi } from "@/server/modules/aleta-abt-pustaka/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PENYUNTING BLANGKO DAN VERSI ALETA ABT (5 Nov 2026, Tahap 3, migrasi 0135)
 * ============================================================================
 *
 * Aturan yang ditegakkan di sini (rute hanya memeriksa Super Admin dan mencatat audit):
 *   - tiap simpan = versi baru (draf); aleta_abt_berkas.isi TIDAK berubah sampai versi diterbitkan;
 *   - versi 1 = salinan ABT apa adanya, dibuat saat blangko pertama kali disimpan/dipulihkan/diterbitkan;
 *   - pulihkan = salinan PERSIS PER BITA dari versi lama menjadi versi baru (kolom isi/pengkodean/md5 disalin, tidak
 *     dikodekan ulang);
 *   - terbit memindahkan isi versi itu ke aleta_abt_berkas dan menandai berkas diubah = 1 sehingga Sinkron dari ABT tidak
 *     menimpanya (aturan lama di lib/aleta-abt-pustaka.ts, tidak diubah);
 *   - penulisan RTF lewat lib/aleta-abt-rtf.ts (menambal bita, tidak membangun ulang);
 *   - tidak ada yang ditulis ke ABT/SIPP; jalur mana pun selain penyunting ini tidak membaca versi.
 */

export type {
  BarisBeda,
  BlangkoBuka,
  BlangkoDaftar,
  FolderDaftar,
  HasilBeda,
  HasilCoba,
  HasilSimpan,
  ParagrafLayar,
  RingkasVersi,
  TetapLayar,
} from "@/lib/aleta-abt-penyunting-tipe";

export type Aktor = { id: string; name: string };

export type Opsi = {
  transaksi?: <T>(kerja: (tx: AletaDatabase) => Promise<T>) => Promise<T>;
  kini?: () => string;
  idBaru?: () => string;
};

const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
const teks = (x: unknown) => String(x ?? "");
const bilangan = (x: unknown) => Number(x) || 0;

const transaksiDari = (db: AletaDatabase, o: Opsi) => o.transaksi ?? (<T,>(kerja: (tx: AletaDatabase) => Promise<T>) => withTransaction(db, kerja));
const kiniDari = (o: Opsi) => (o.kini ?? (() => new Date().toISOString()))();
const idDari = (o: Opsi) => (o.idBaru ?? randomUUID)();

type BarisBerkas = {
  id: string;
  folder: string;
  nama: string;
  arsip: number;
  isi: string;
  pengkodean: string;
  md5: string;
  ukuran: number;
  diubah: number;
  status: string;
  asal: string;
};

type BarisVersi = {
  id: string;
  berkas_id: string;
  nomor: number;
  isi: string;
  pengkodean: string;
  md5: string;
  ukuran: number;
  jenis: string;
  status: string;
  dari_nomor: number;
  catatan: string;
  ringkas: string;
  dibuat_oleh: string;
  dibuat_nama: string;
  dibuat_at: string;
  terbit_oleh: string;
  terbit_nama: string;
  terbit_at: string;
};


const SQL_VERSI_RINGKAS =
  "SELECT nomor, jenis, status, dari_nomor, catatan, ringkas, dibuat_nama, dibuat_at, terbit_nama, terbit_at, ukuran, md5 FROM aleta_abt_berkas_versi WHERE berkas_id = ? ORDER BY nomor ASC";

const ringkasDari = (b: Record<string, unknown>): RingkasVersi => ({
  nomor: bilangan(b.nomor),
  jenis: b.jenis === "asal" ? "asal" : b.jenis === "pulih" ? "pulih" : "sunting",
  status: b.status === "terbit" ? "terbit" : b.status === "lama" ? "lama" : "draf",
  dariNomor: bilangan(b.dari_nomor),
  catatan: teks(b.catatan),
  ringkas: teks(b.ringkas),
  dibuatNama: teks(b.dibuat_nama),
  dibuatAt: teks(b.dibuat_at),
  terbitNama: teks(b.terbit_nama),
  terbitAt: teks(b.terbit_at),
  ukuran: bilangan(b.ukuran),
  md5: teks(b.md5),
});

async function ambilBerkas(db: AletaDatabase, id: string): Promise<BarisBerkas> {
  const b = await db.queryOne<BarisBerkas>(
    "SELECT id, folder, nama, arsip, isi, pengkodean, md5, ukuran, diubah, status, asal FROM aleta_abt_berkas WHERE id = ?",
    [id]
  );
  if (!b) throw new ApiError(404, "Blangko tidak ditemukan di pustaka.");
  return b;
}

/** Versi 1 maya (belum ada baris) = salinan ABT di aleta_abt_berkas. */
const versiMaya = (b: BarisBerkas): BarisVersi => ({
  id: "",
  berkas_id: b.id,
  nomor: 1,
  isi: b.isi,
  pengkodean: b.pengkodean,
  md5: b.md5,
  ukuran: bilangan(b.ukuran),
  jenis: "asal",
  status: "terbit",
  dari_nomor: 0,
  catatan: "Salinan dari ABT",
  ringkas: "",
  dibuat_oleh: "",
  dibuat_nama: "",
  dibuat_at: "",
  terbit_oleh: "",
  terbit_nama: "",
  terbit_at: "",
});

async function ambilVersi(db: AletaDatabase, b: BarisBerkas, nomor?: number): Promise<{ versi: BarisVersi; terakhir: number; nyata: boolean }> {
  const ada = await db.queryAll<{ nomor: number }>("SELECT nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ? ORDER BY nomor DESC LIMIT 1", [b.id]);
  if (!ada.length) {
    if (nomor !== undefined && nomor !== 1) throw new ApiError(404, "Versi itu tidak ada.");
    return { versi: versiMaya(b), terakhir: 1, nyata: false };
  }
  const terakhir = bilangan(ada[0].nomor);
  const mau = nomor === undefined ? terakhir : nomor;
  const v = await db.queryOne<BarisVersi>("SELECT * FROM aleta_abt_berkas_versi WHERE berkas_id = ? AND nomor = ?", [b.id, mau]);
  if (!v) throw new ApiError(404, "Versi itu tidak ada.");
  return { versi: { ...v, nomor: bilangan(v.nomor), ukuran: bilangan(v.ukuran), dari_nomor: bilangan(v.dari_nomor) }, terakhir, nyata: true };
}

const rtfDari = (v: Pick<BarisVersi, "isi" | "pengkodean">) => bitaIsi(v.isi, v.pengkodean).toString("latin1");
const adaRtf = (nama: string) => /\.rtf$/i.test(nama);

// ---------------------------------------------------------------------------------------------------------------
// Nama isian
// ---------------------------------------------------------------------------------------------------------------

export type InfoIsian = { nama: string; bersyarat: boolean; dipakai: number };

/** nomor ABT (4 angka) -> nama + apakah kuerinya bercabang (bisa kosong/berganti menurut keadaan). */
export async function petaIsian(db: AletaDatabase): Promise<Map<string, InfoIsian>> {
  const baris = await db.queryAll<{ no_var: string; nama: string; sql_query: string | null; jumlah_blangko: number | string }>(
    `SELECT p.no_var AS no_var, v.nama AS nama, v.sql_query AS sql_query, v.jumlah_blangko AS jumlah_blangko
       FROM aleta_abt_peta_variabel p JOIN aleta_abt_variabel v ON v.kode = p.kode
      WHERE p.status <> 'hilang' AND v.status <> 'hilang' ORDER BY p.server ASC, p.no_var ASC`
  );
  const peta = new Map<string, InfoIsian>();
  for (const b of baris) {
    const no = nomorBaku(b.no_var);
    if (peta.has(no)) continue;
    peta.set(no, { nama: teks(b.nama).trim() || `Isian ${no}`, bersyarat: /\b(CASE|IFNULL|NULLIF|COALESCE)\b|\bIF\s*\(/i.test(teks(b.sql_query)), dipakai: bilangan(b.jumlah_blangko) });
  }
  return peta;
}

/** Daftar untuk "Sisipkan isian": [nomor, nama, bersyarat, dipakai] - nomor hanya untuk dikirim balik, tidak ditampilkan. */
export async function daftarIsian(db: AletaDatabase) {
  const peta = await petaIsian(db);
  return [...peta.entries()]
    .map(([no, i]) => ({ no, nama: i.nama, bersyarat: i.bersyarat, dipakai: i.dipakai }))
    .sort((a, b) => b.dipakai - a.dipakai || a.nama.localeCompare(b.nama));
}

const ganti = (t: string, peta: Map<string, InfoIsian>, bentuk: (no: string, nama: string) => string) =>
  t.replace(new RegExp(POLA_ISIAN.source, "g"), (_u, no: string) => bentuk(no.padStart(4, "0"), peta.get(no.padStart(4, "0"))?.nama ?? `Isian ${no.padStart(4, "0")}`));

// ---------------------------------------------------------------------------------------------------------------
// Daftar
// ---------------------------------------------------------------------------------------------------------------


export async function daftarBlangko(db: AletaDatabase): Promise<{ folder: FolderDaftar[]; jumlah: number; tersalin: boolean }> {
  const [berkas, menu, versi] = await Promise.all([
    db.queryAll<{ id: string; folder: string; nama: string; arsip: number; ukuran: number; diubah: number; status: string }>(
      "SELECT id, folder, nama, arsip, ukuran, diubah, status FROM aleta_abt_berkas ORDER BY folder ASC, nama ASC"
    ),
    db.queryAll<{ id: string; nama: string | null; nama_alias: string | null }>("SELECT id, nama, nama_alias FROM aleta_abt_menu").catch(() => []),
    db.queryAll<{ berkas_id: string; nomor: number; status: string }>("SELECT berkas_id, nomor, status FROM aleta_abt_berkas_versi"),
  ]);
  const label = new Map(menu.map((m) => [teks(m.id), teks(m.nama_alias || m.nama || m.id)]));
  const perBerkas = new Map<string, { terakhir: number; terbit: number; draf: boolean }>();
  for (const v of versi) {
    const k = perBerkas.get(v.berkas_id) ?? { terakhir: 0, terbit: 0, draf: false };
    k.terakhir = Math.max(k.terakhir, bilangan(v.nomor));
    if (v.status === "terbit") k.terbit = bilangan(v.nomor);
    perBerkas.set(v.berkas_id, k);
  }
  for (const [id, k] of perBerkas) {
    const sesudah = [...versi].filter((v) => v.berkas_id === id && v.status === "draf" && bilangan(v.nomor) > k.terbit);
    k.draf = sesudah.length > 0;
  }
  const folder = new Map<string, FolderDaftar>();
  for (const b of berkas) {
    const kunci = teks(b.folder);
    if (!folder.has(kunci)) folder.set(kunci, { folder: kunci, label: label.get(kunci) || kunci || "Tanpa folder", blangko: [] });
    const v = perBerkas.get(b.id);
    folder.get(kunci)!.blangko.push({
      id: b.id,
      nama: teks(b.nama).replace(/\.rtf$/i, ""),
      rtf: adaRtf(b.nama),
      arsip: bilangan(b.arsip) === 1,
      hilang: b.status === "hilang",
      ukuran: bilangan(b.ukuran),
      disunting: bilangan(b.diubah) === 1,
      versi: v ? v.terakhir : 1,
      terbit: v ? v.terbit : 1,
      adaDraf: v ? v.draf : false,
    });
  }
  const urut = [...folder.values()].sort((a, b) => Number(a.blangko.every((x) => x.arsip)) - Number(b.blangko.every((x) => x.arsip)) || a.label.localeCompare(b.label, "id", { numeric: true }));
  return { folder: urut, jumlah: berkas.length, tersalin: berkas.length > 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Buka
// ---------------------------------------------------------------------------------------------------------------




function bagianTeksBiasa(t: string): BagianTeks[] {
  const hasil: BagianTeks[] = [];
  const re = new RegExp(POLA_ISIAN.source, "g");
  let akhir = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > akhir) hasil.push({ j: "teks", t: t.slice(akhir, m.index), g: 0 });
    hasil.push({ j: "isian", no: m[1].padStart(4, "0"), r: m[1], g: 0 });
    akhir = m.index + m[0].length;
  }
  if (akhir < t.length) hasil.push({ j: "teks", t: t.slice(akhir), g: 0 });
  return hasil;
}

const ringkasVersiDari = (v: BarisVersi): RingkasVersi => ringkasDari(v as unknown as Record<string, unknown>);

async function terbitDari(db: AletaDatabase, berkasId: string, nyata: boolean): Promise<number> {
  if (!nyata) return 1;
  const r = await db.queryAll<{ nomor: number }>("SELECT nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ? AND status = 'terbit' ORDER BY nomor DESC LIMIT 1", [berkasId]);
  return r.length ? bilangan(r[0].nomor) : 0;
}

export async function bukaBlangko(db: AletaDatabase, id: string, nomor?: number): Promise<BlangkoBuka> {
  const b = await ambilBerkas(db, id);
  const { versi, terakhir, nyata } = await ambilVersi(db, b, nomor);
  const doc: DokumenRtf = adaRtf(b.nama) ? uraiRtf(rtfDari(versi)) : { paragraf: [], tetap: [], sebabDokumen: "Berkas ini bukan RTF, jadi tidak dapat disunting di sini.", panjang: 0 };
  const peta = await petaIsian(db);
  const dipakai = new Set<string>();
  const paragraf: ParagrafLayar[] = doc.paragraf.map((p) => {
    const bagian = bagianParagraf(p);
    for (const x of bagian) if (x.j === "isian") dipakai.add(x.no);
    return { i: p.indeks, bagian, rata: p.rata, li: p.li, fi: p.fi, tabel: p.tabel, awalan: p.awalan, terkunci: p.terkunci };
  });
  const tetap: TetapLayar[] = doc.tetap.map((t) => ({
    jenis: t.jenis,
    baris: t.teks.map((x) => {
      const bagian = bagianTeksBiasa(x);
      for (const y of bagian) if (y.j === "isian") dipakai.add(y.no);
      return bagian;
    }),
  }));
  const isian: BlangkoBuka["isian"] = {};
  for (const no of dipakai) {
    const i = peta.get(no);
    isian[no] = { nama: i?.nama ?? `Isian ${no}`, bersyarat: Boolean(i?.bersyarat) };
  }
  const terbit = await terbitDari(db, b.id, nyata);
  return {
    id: b.id,
    nama: teks(b.nama).replace(/\.rtf$/i, ""),
    folder: teks(b.folder),
    versi: ringkasVersiDari(versi),
    terakhir,
    terbit,
    dapatDisunting: !doc.sebabDokumen,
    sebabTerkunci: doc.sebabDokumen,
    paragraf,
    tetap,
    isian,
    jumlahTerkunci: doc.paragraf.filter((p) => p.terkunci).length,
    belumDisimpan: !nyata,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Simpan / pulihkan / terbitkan
// ---------------------------------------------------------------------------------------------------------------

async function pastikanVersiAsal(tx: AletaDatabase, b: BarisBerkas, aktor: Aktor, sekarang: string, o: Opsi) {
  const ada = await tx.queryAll<{ nomor: number }>("SELECT nomor FROM aleta_abt_berkas_versi WHERE berkas_id = ? LIMIT 1", [b.id]);
  if (ada.length) return;
  await tx.run(
    `INSERT INTO aleta_abt_berkas_versi (id, berkas_id, nomor, isi, pengkodean, md5, ukuran, jenis, status, dari_nomor, catatan, ringkas, dibuat_oleh, dibuat_nama, dibuat_at, terbit_oleh, terbit_nama, terbit_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, 'asal', 'terbit', 0, 'Salinan dari ABT', '', ?, ?, ?, ?, ?, ?)`,
    [idDari(o), b.id, b.isi, b.pengkodean, b.md5, bilangan(b.ukuran), aktor.id, aktor.name, sekarang, aktor.id, aktor.name, sekarang]
  );
}

async function sisipVersiBaru(
  tx: AletaDatabase,
  b: BarisBerkas,
  aktor: Aktor,
  sekarang: string,
  o: Opsi,
  v: { isi: string; pengkodean: string; md5: string; ukuran: number; jenis: "sunting" | "pulih"; dariNomor: number; catatan: string; ringkas: string }
): Promise<number> {
  const m = await tx.queryAll<{ m: number | string | null }>("SELECT MAX(nomor) AS m FROM aleta_abt_berkas_versi WHERE berkas_id = ?", [b.id]);
  const nomor = bilangan(m[0]?.m) + 1;
  try {
    await tx.run(
      `INSERT INTO aleta_abt_berkas_versi (id, berkas_id, nomor, isi, pengkodean, md5, ukuran, jenis, status, dari_nomor, catatan, ringkas, dibuat_oleh, dibuat_nama, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draf', ?, ?, ?, ?, ?, ?)`,
      [idDari(o), b.id, nomor, v.isi, v.pengkodean, v.md5, v.ukuran, v.jenis, v.dariNomor, v.catatan.slice(0, 300), v.ringkas.slice(0, 300), aktor.id, aktor.name, sekarang]
    );
  } catch (galat) {
    if (/duplicate|unique|sudah ada/i.test(galat instanceof Error ? galat.message : String(galat))) throw new ApiError(409, "Blangko ini baru saja disimpan orang lain. Muat ulang lalu ubah lagi.");
    throw galat;
  }
  await tx.run("UPDATE aleta_abt_berkas SET diubah = 1, diubah_at = ? WHERE id = ?", [sekarang, b.id]);
  return nomor;
}

export type MasukanSimpan = {
  id: string;
  dasarNomor: number;
  suntingan: Array<{ i: number; teks: string }>;
  hapus?: number[];
  catatan?: string;
};


export async function simpanSuntingan(db: AletaDatabase, aktor: Aktor, masukan: MasukanSimpan, o: Opsi = {}): Promise<HasilSimpan> {
  const b = await ambilBerkas(db, masukan.id);
  if (!adaRtf(b.nama)) throw new ApiError(422, "Berkas ini bukan RTF, jadi tidak dapat disunting di sini.");
  const { versi, terakhir } = await ambilVersi(db, b);
  if (bilangan(masukan.dasarNomor) !== terakhir) throw new ApiError(409, "Blangko ini sudah berubah sejak Anda membukanya. Muat ulang lalu ubah lagi.");
  if (!Array.isArray(masukan.suntingan) || masukan.suntingan.length > 5000) throw new ApiError(400, "Daftar suntingan tidak sah.");
  const sunting: Suntingan[] = masukan.suntingan.map((x) => ({ indeks: Number(x?.i), teks: teks(x?.teks) }));
  const s = rtfDari(versi);
  const doc = uraiRtf(s);
  const h = terapkanSuntingan(s, doc, sunting, { hapus: (masukan.hapus ?? []).map(Number) });
  if (!h.ok) throw new ApiError(422, h.sebab);
  if (h.rtf === s) throw new ApiError(400, "Tidak ada perubahan untuk disimpan.");
  const bita = Buffer.from(h.rtf, "latin1");
  const simpan = simpananIsi(bita);
  const bagian: string[] = [];
  if (h.diubah) bagian.push(`${h.diubah} paragraf diubah`);
  if (h.dipecah) bagian.push(`${h.dipecah} paragraf ditambah`);
  if (h.dihapus) bagian.push(`${h.dihapus} paragraf dihapus`);
  const ringkas = bagian.join(", ");
  const sekarang = kiniDari(o);
  const nomor = await transaksiDari(db, o)(async (tx) => {
    await pastikanVersiAsal(tx, b, aktor, sekarang, o);
    return sisipVersiBaru(tx, b, aktor, sekarang, o, {
      isi: simpan.isi,
      pengkodean: simpan.pengkodean,
      md5: md5(bita),
      ukuran: bita.length,
      jenis: "sunting",
      dariNomor: terakhir,
      catatan: teks(masukan.catatan).trim(),
      ringkas,
    });
  });
  return { nomor, md5: md5(bita), ukuran: bita.length, ringkas, diubah: h.diubah, dihapus: h.dihapus, dipecah: h.dipecah };
}

export async function pulihkanVersi(db: AletaDatabase, aktor: Aktor, masukan: { id: string; nomor: number }, o: Opsi = {}): Promise<{ nomor: number; md5: string; dariNomor: number }> {
  const b = await ambilBerkas(db, masukan.id);
  const { versi: lama, terakhir } = await ambilVersi(db, b, bilangan(masukan.nomor));
  if (lama.nomor === terakhir) throw new ApiError(400, "Itu sudah versi terkini. Tidak ada yang perlu dikembalikan.");
  const sekarang = kiniDari(o);
  const nomor = await transaksiDari(db, o)(async (tx) => {
    await pastikanVersiAsal(tx, b, aktor, sekarang, o);
    // Salin kolom apa adanya: tidak dikodekan ulang, jadi bita identik.
    return sisipVersiBaru(tx, b, aktor, sekarang, o, {
      isi: lama.isi,
      pengkodean: lama.pengkodean,
      md5: lama.md5,
      ukuran: bilangan(lama.ukuran),
      jenis: "pulih",
      dariNomor: lama.nomor,
      catatan: `Dikembalikan dari versi ${lama.nomor}`,
      ringkas: "",
    });
  });
  return { nomor, md5: lama.md5, dariNomor: lama.nomor };
}

export async function terbitkanVersi(db: AletaDatabase, aktor: Aktor, masukan: { id: string; nomor: number }, o: Opsi = {}): Promise<{ nomor: number; md5: string }> {
  const b = await ambilBerkas(db, masukan.id);
  const { versi } = await ambilVersi(db, b, bilangan(masukan.nomor));
  if (versi.status === "terbit") throw new ApiError(409, "Versi ini sudah terbit.");
  const bita = bitaIsi(versi.isi, versi.pengkodean);
  if (md5(bita) !== versi.md5) throw new ApiError(500, "Isi versi ini tidak cocok dengan sidiknya. Tidak diterbitkan.");
  const doc = adaRtf(b.nama) ? uraiRtf(bita.toString("latin1")) : null;
  if (doc && doc.sebabDokumen) throw new ApiError(422, doc.sebabDokumen);
  // Penanda isian mengikuti isi baru (untuk daftar di pustaka).
  const nomorIsian: string[] = [];
  if (doc) {
    const semua = [...doc.paragraf.map((p) => p.teks), ...doc.tetap.flatMap((t) => t.teks)];
    for (const t of semua) for (const no of nomorIsianDi(t)) if (!nomorIsian.includes(no)) nomorIsian.push(no);
  }
  const petaKode = new Map<string, string>();
  for (const r of await db.queryAll<{ no_var: string; kode: string }>("SELECT no_var, kode FROM aleta_abt_peta_variabel WHERE status <> 'hilang' ORDER BY server ASC")) {
    const no = nomorBaku(r.no_var);
    if (!petaKode.has(no)) petaKode.set(no, r.kode);
  }
  const sekarang = kiniDari(o);
  const sisi = simpananIsi(bita);
  await transaksiDari(db, o)(async (tx) => {
    await pastikanVersiAsal(tx, b, aktor, sekarang, o);
    await tx.run("UPDATE aleta_abt_berkas_versi SET status = 'lama' WHERE berkas_id = ? AND status = 'terbit'", [b.id]);
    await tx.run("UPDATE aleta_abt_berkas_versi SET status = 'terbit', terbit_oleh = ?, terbit_nama = ?, terbit_at = ? WHERE berkas_id = ? AND nomor = ?", [aktor.id, aktor.name, sekarang, b.id, versi.nomor]);
    await tx.run(
      `UPDATE aleta_abt_berkas SET isi = ?, pengkodean = ?, md5 = ?, ukuran = ?, penanda_asal = ?, penanda_kode = ?, diubah = 1, diubah_at = ? WHERE id = ?`,
      [sisi.isi, sisi.pengkodean, versi.md5, bita.length, JSON.stringify(nomorIsian), JSON.stringify(petaRujukan(nomorIsian, petaKode).kode), sekarang, b.id]
    );
  });
  return { nomor: versi.nomor, md5: versi.md5 };
}

// ---------------------------------------------------------------------------------------------------------------
// Riwayat dan beda
// ---------------------------------------------------------------------------------------------------------------

export async function riwayatVersi(db: AletaDatabase, id: string): Promise<{ id: string; nama: string; versi: RingkasVersi[]; belumDisimpan: boolean }> {
  const b = await ambilBerkas(db, id);
  const baris = await db.queryAll<Record<string, unknown>>(SQL_VERSI_RINGKAS, [b.id]);
  const versi = baris.length ? baris.map(ringkasDari) : [ringkasVersiDari(versiMaya(b))];
  return { id: b.id, nama: teks(b.nama).replace(/\.rtf$/i, ""), versi: versi.reverse(), belumDisimpan: !baris.length };
}



const BATAS_BARIS_BEDA = 600;

export async function bedaAntarVersi(db: AletaDatabase, id: string, nomorA: number, nomorB: number): Promise<HasilBeda> {
  const b = await ambilBerkas(db, id);
  const A = (await ambilVersi(db, b, nomorA)).versi;
  const B = (await ambilVersi(db, b, nomorB)).versi;
  const peta = await petaIsian(db);
  const nama = (t: string) => ganti(t, peta, (_no, n) => `‹${n}›`);
  const docA = uraiRtf(rtfDari(A));
  const docB = uraiRtf(rtfDari(B));
  const ta = docA.paragraf.map((p) => nama(p.teks).replace(/￼/g, "□"));
  const tb = docB.paragraf.map((p) => nama(p.teks).replace(/￼/g, "□"));
  const ops = bedaDaftar(ta, tb);
  const baris: BarisBeda[] = [];
  const ringkas = { tambah: 0, hapus: 0, ubah: 0 };
  const konteks = 1;
  const sama = (dari: number, n: number) => {
    if (n <= konteks * 2 + 1) {
      for (let i = 0; i < n; i += 1) baris.push({ k: "sama", a: bagianTeksBiasa(ta[dari + i]) });
      return;
    }
    const awalSama = baris.length === 0 ? 0 : konteks;
    for (let i = 0; i < awalSama; i += 1) baris.push({ k: "sama", a: bagianTeksBiasa(ta[dari + i]) });
    baris.push({ k: "lipat", n: n - awalSama - konteks });
    for (let i = n - konteks; i < n; i += 1) baris.push({ k: "sama", a: bagianTeksBiasa(ta[dari + i]) });
  };
  let adaBeda = false;
  for (let k = 0; k < ops.length; k += 1) {
    const op = ops[k];
    if (op.t === "=") {
      const terakhir = k === ops.length - 1;
      if (terakhir) {
        const n = op.n;
        if (n <= konteks) for (let i = 0; i < n; i += 1) baris.push({ k: "sama", a: bagianTeksBiasa(ta[op.a + i]) });
        else {
          for (let i = 0; i < konteks; i += 1) baris.push({ k: "sama", a: bagianTeksBiasa(ta[op.a + i]) });
          baris.push({ k: "lipat", n: n - konteks });
        }
      } else sama(op.a, op.n);
      continue;
    }
    adaBeda = true;
    let hapus: string[] = [];
    let tambah: string[] = [];
    let ujung = k;
    for (let j = k; j < ops.length && ops[j].t !== "="; j += 1) {
      if (ops[j].t === "-") hapus = hapus.concat(ta.slice(ops[j].a, ops[j].a + ops[j].n));
      else tambah = tambah.concat(tb.slice(ops[j].b, ops[j].b + ops[j].n));
      ujung = j;
    }
    k = ujung;
    const pasang = Math.min(hapus.length, tambah.length);
    for (let i = 0; i < pasang; i += 1) {
      const kata = bedaKata(hapus[i], tambah[i]);
      baris.push({ k: "ubah", a: kata.lama, b: kata.baru });
      ringkas.ubah += 1;
    }
    for (let i = pasang; i < hapus.length; i += 1) {
      baris.push({ k: "hapus", a: [{ t: hapus[i], d: "hapus" }] });
      ringkas.hapus += 1;
    }
    for (let i = pasang; i < tambah.length; i += 1) {
      baris.push({ k: "tambah", b: [{ t: tambah[i], d: "tambah" }] });
      ringkas.tambah += 1;
    }
  }
  // Jika ops berakhir pada beda, baris "sama" penutup sudah tidak ada; jika awal beda, tidak ada pembuka.
  if (!adaBeda && !baris.length) baris.length = 0;
  const terpotong = baris.length > BATAS_BARIS_BEDA;
  return {
    a: { nomor: A.nomor, md5: A.md5, ukuran: bilangan(A.ukuran) },
    b: { nomor: B.nomor, md5: B.md5, ukuran: bilangan(B.ukuran) },
    samaBita: A.md5 === B.md5,
    samaTeks: ta.length === tb.length && ta.every((x, i) => x === tb[i]),
    kepalaKakiBeda: JSON.stringify(docA.tetap) !== JSON.stringify(docB.tetap),
    ringkas,
    baris: terpotong ? baris.slice(0, BATAS_BARIS_BEDA) : baris,
    terpotong,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Coba pada perkara rekaan
// ---------------------------------------------------------------------------------------------------------------


export async function cobaBlangko(db: AletaDatabase, id: string, nomor: number | undefined, sertakanBerkas: boolean): Promise<HasilCoba> {
  const b = await ambilBerkas(db, id);
  if (!adaRtf(b.nama)) throw new ApiError(422, "Berkas ini bukan RTF, jadi tidak dapat dicoba di sini.");
  const { versi } = await ambilVersi(db, b, nomor);
  const s = rtfDari(versi);
  const doc = uraiRtf(s);
  const peta = await petaIsian(db);
  let terisi = 0;
  let takBerContoh = 0;
  const isi = (t: string) =>
    ganti(t, peta, (no, nm) => {
      const v = nilaiRekaan(peta.has(no) ? nm : "");
      if (v === null) {
        takBerContoh += 1;
        return `‹${nm}›`;
      }
      terisi += 1;
      return v;
    });
  const sunting: Suntingan[] = [];
  const paragraf = doc.paragraf.map((p) => {
    const baru = isi(p.teks);
    if (baru !== p.teks && !p.terkunci) sunting.push({ indeks: p.indeks, teks: baru });
    let bagian: BagianTeks[];
    if (baru === p.teks) bagian = bagianParagraf(p);
    else {
      // Teks hasil pengisian tampil polos; kotak terkunci tetap ada di tempatnya.
      bagian = [];
      const kotak = p.kotak.slice();
      let akhir = 0;
      for (let i = 0; i < baru.length; i += 1) {
        if (baru[i] !== AKSARA_KOTAK) continue;
        if (i > akhir) bagian.push({ j: "teks", t: baru.slice(akhir, i), g: 0 });
        const kt = kotak.shift();
        bagian.push({ j: "kotak", label: kt?.label ?? "Bagian terkunci", jenis: kt?.jenis ?? "lain" });
        akhir = i + 1;
      }
      if (akhir < baru.length) bagian.push({ j: "teks", t: baru.slice(akhir), g: 0 });
    }
    return { i: p.indeks, bagian, rata: p.rata, li: p.li, fi: p.fi, tabel: p.tabel, awalan: p.awalan };
  });
  let rtfBase64: string | null = null;
  let sebabTanpaBerkas = "";
  if (sertakanBerkas) {
    const h = terapkanSuntingan(s, doc, sunting);
    if (h.ok) rtfBase64 = Buffer.from(h.rtf, "latin1").toString("base64");
    else sebabTanpaBerkas = h.sebab;
  }
  return { perkara: NAMA_PERKARA_REKAAN, versi: versi.nomor, paragraf, terisi, takBerContoh, rtfBase64, sebabTanpaBerkas };
}
