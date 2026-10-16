import { randomUUID } from "node:crypto";

import {
  hakPengaturanAbt,
  hurufDiluarLatin1,
  periksaKueriVariabel,
  periksaTemplat,
  ringkasBedaTemplat,
  susunSaklar,
  type BarisTemplat,
  type DataMenuAbt,
  type HakPengaturanAbt,
  type JenisSuntingan,
} from "@/lib/pengaturan-abt";
import type { AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

import { panggilBotPengaturanAbt, type HasilBotPengaturan } from "./gateway";

/**
 * ============================================================================
 * PENGATURAN SIPP & ABT - LAYANAN PORTAL (16 Okt 2026, Tahap H)
 * ============================================================================
 *
 * Portal menjaga PERAN dan JEJAK; bot menjaga TULISAN (transaksi + prasyarat
 * nilai lama, lihat aleta_bot/services/abtPengaturanService.js).
 *
 * Urutan tiap simpan:
 *   1. hak diperiksa (lib/pengaturan-abt.ts hakPengaturanAbt);
 *   2. suntingan dicatat di aleta_abt_suntingan berstatus 'menunggu' - nilai
 *      LAMA tersimpan sebelum ABT disentuh (cadangan per suntingan);
 *   3. bot menulis dalam satu transaksi; nilai lama yang dikirim harus sama
 *      persis dengan isi ABT (bila tidak: tidak ada yang ditulis);
 *   4. catatan diperbarui 'tersimpan' (nilai_baru = yang terbaca kembali dari
 *      ABT) atau 'gagal' beserta sebabnya.
 *
 * Kembalikan = simpan biasa dengan nilai lama/baru suntingan itu ditukar, jadi
 * hanya berhasil bila isi ABT masih sama dengan hasil suntingan tersebut.
 */

export type AktorPengaturan = { id: string; name: string; roleId: string };

type BarisSuntingan = {
  id: string;
  jenis: string;
  kunci: string;
  ringkas: string;
  nilai_lama: string;
  nilai_baru: string;
  status: string;
  galat: string;
  pulih_dari: string;
  oleh_id: string;
  oleh_nama: string;
  oleh_peran: string;
  ip: string;
  pada: string;
  selesai_at: string;
};

export type Suntingan = {
  id: string;
  jenis: JenisSuntingan;
  kunci: string;
  ringkas: string;
  nilaiLama: unknown;
  nilaiBaru: unknown;
  status: "menunggu" | "tersimpan" | "gagal";
  galat: string;
  pulihDari: string;
  olehNama: string;
  olehPeran: string;
  pada: string;
};

const json = (teks: string): unknown => {
  try {
    return JSON.parse(teks);
  } catch {
    return null;
  }
};

function keSuntingan(b: BarisSuntingan): Suntingan {
  return {
    id: b.id,
    jenis: b.jenis as JenisSuntingan,
    kunci: b.kunci,
    ringkas: b.ringkas,
    nilaiLama: json(b.nilai_lama),
    nilaiBaru: json(b.nilai_baru),
    status: b.status as Suntingan["status"],
    galat: b.galat,
    pulihDari: b.pulih_dari,
    olehNama: b.oleh_nama,
    olehPeran: b.oleh_peran,
    pada: b.pada,
  };
}

function wajibHak(hak: HakPengaturanAbt, kunci: keyof HakPengaturanAbt, pekerjaan: string) {
  if (!hak[kunci]) throw new ApiError(403, `Hanya Super Admin yang dapat ${pekerjaan}.`);
}

/** Galat bot -> ApiError dengan status yang berarti bagi layar. */
function galatBot(h: Extract<HasilBotPengaturan<unknown>, { ok: false }>): ApiError {
  const status = h.kode === "berubah" ? 409 : h.status && h.status >= 400 && h.status < 500 ? h.status : 502;
  return new ApiError(status, h.error, { kode: h.kode, uji: h.uji });
}

async function bot<T>(jalur: string, pilihan: Parameters<typeof panggilBotPengaturanAbt>[1] = {}): Promise<T> {
  const h = await panggilBotPengaturanAbt<T>(jalur, pilihan);
  if (!h.ok) throw galatBot(h);
  return h.data;
}

// ---------------------------------------------------------------------------
// Catatan suntingan
// ---------------------------------------------------------------------------

async function mulaiCatat(
  db: AletaDatabase,
  isi: { jenis: JenisSuntingan; kunci: string; ringkas: string; lama: unknown; baru: unknown; aktor: AktorPengaturan; ip: string; pulihDari?: string }
): Promise<string> {
  const id = `sunt_${randomUUID()}`;
  await db.run(
    `INSERT INTO aleta_abt_suntingan (id, jenis, kunci, ringkas, nilai_lama, nilai_baru, status, galat, pulih_dari, oleh_id, oleh_nama, oleh_peran, ip, pada, selesai_at)
     VALUES (?, ?, ?, ?, ?, ?, 'menunggu', '', ?, ?, ?, ?, ?, ?, '')`,
    [
      id,
      isi.jenis,
      isi.kunci.slice(0, 200),
      isi.ringkas.slice(0, 500),
      JSON.stringify(isi.lama ?? {}),
      JSON.stringify(isi.baru ?? {}),
      isi.pulihDari ?? "",
      isi.aktor.id,
      isi.aktor.name,
      isi.aktor.roleId,
      isi.ip.slice(0, 80),
      new Date().toISOString(),
    ]
  );
  return id;
}

async function akhiriCatat(db: AletaDatabase, id: string, hasil: { status: "tersimpan" | "gagal"; galat?: string; baru?: unknown }) {
  if (hasil.baru !== undefined) {
    await db.run(`UPDATE aleta_abt_suntingan SET status = ?, galat = ?, nilai_baru = ?, selesai_at = ? WHERE id = ?`, [
      hasil.status,
      (hasil.galat ?? "").slice(0, 1000),
      JSON.stringify(hasil.baru),
      new Date().toISOString(),
      id,
    ]);
  } else {
    await db.run(`UPDATE aleta_abt_suntingan SET status = ?, galat = ?, selesai_at = ? WHERE id = ?`, [
      hasil.status,
      (hasil.galat ?? "").slice(0, 1000),
      new Date().toISOString(),
      id,
    ]);
  }
}

/** Catat -> jalankan -> akhiri. Galat dari tulisan dicatat lalu dilempar ulang. */
async function denganCatatan<T>(
  db: AletaDatabase,
  isi: Parameters<typeof mulaiCatat>[1],
  kerja: () => Promise<{ hasil: T; baru: unknown }>
): Promise<T & { suntinganId: string }> {
  const id = await mulaiCatat(db, isi);
  try {
    const { hasil, baru } = await kerja();
    await akhiriCatat(db, id, { status: "tersimpan", baru });
    return { ...hasil, suntinganId: id };
  } catch (galat) {
    await akhiriCatat(db, id, { status: "gagal", galat: galat instanceof Error ? galat.message : String(galat) }).catch(() => undefined);
    throw galat;
  }
}

export async function riwayatSuntingan(db: AletaDatabase, saring: { jenis?: string; kunci?: string; batas?: number } = {}): Promise<Suntingan[]> {
  const syarat: string[] = [];
  const nilai: string[] = [];
  if (saring.jenis) {
    syarat.push("jenis = ?");
    nilai.push(saring.jenis);
  }
  if (saring.kunci) {
    syarat.push("kunci = ?");
    nilai.push(saring.kunci);
  }
  const batas = Math.max(1, Math.min(200, Number(saring.batas) || 50));
  const baris = await db.queryAll<BarisSuntingan>(
    `SELECT * FROM aleta_abt_suntingan ${syarat.length ? `WHERE ${syarat.join(" AND ")}` : ""} ORDER BY pada DESC LIMIT ${batas}`,
    nilai
  );
  return baris.map(keSuntingan);
}

// ---------------------------------------------------------------------------
// Hak menu & saklar
// ---------------------------------------------------------------------------

export async function bacaMenu() {
  const data = await bot<DataMenuAbt & { ok: boolean }>("/menu");
  const { ok: _ok, ...isi } = data;
  void _ok;
  return { ...isi, saklar: susunSaklar(isi) };
}

type BarisUbahMenu = { id: number; lama: Record<string, unknown>; baru: Record<string, unknown> };
type BarisConfig = { name: string; lama: string; baru: string };

function bacaUbahMenu(badan: Record<string, unknown>): { ubah: BarisUbahMenu[]; config: BarisConfig[] } {
  const ubah = (Array.isArray(badan.ubah) ? badan.ubah : []).map((u) => {
    const x = (u ?? {}) as Record<string, unknown>;
    const lama = x.lama && typeof x.lama === "object" ? (x.lama as Record<string, unknown>) : null;
    const baru = x.baru && typeof x.baru === "object" ? (x.baru as Record<string, unknown>) : null;
    if (!lama || !baru) throw new ApiError(400, "Isian lama dan baru tiap folder wajib dikirim.");
    return { id: Number(x.id), lama, baru };
  });
  const config = (Array.isArray(badan.config) ? badan.config : []).map((c) => {
    const x = (c ?? {}) as Record<string, unknown>;
    return { name: String(x.name ?? ""), lama: String(x.lama ?? ""), baru: String(x.baru ?? "") };
  });
  if (!ubah.length && !config.length) throw new ApiError(400, "Tidak ada yang diubah.");
  return { ubah, config };
}

export async function simpanMenu(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>, pulihDari = "") {
  wajibHak(hakPengaturanAbt(aktor.roleId), "ubahMenu", "mengubah hak menu ABT");
  const { ubah, config } = bacaUbahMenu(badan);
  const ringkas =
    String(badan.ringkas ?? "").trim() ||
    [ubah.length ? `${ubah.length} folder diubah haknya` : "", config.length ? `pengaturan ABT ${config.map((c) => c.name).join(", ")}` : ""]
      .filter(Boolean)
      .join("; ");
  return denganCatatan(
    db,
    {
      jenis: "menu",
      kunci: ubah.length ? ubah.map((u) => u.id).join(",") : `config:${config.map((c) => c.name).join(",")}`,
      ringkas,
      lama: { ubah: ubah.map((u) => ({ id: u.id, ...u.lama })), config: config.map((c) => ({ name: c.name, value: c.lama })) },
      baru: { ubah: ubah.map((u) => ({ id: u.id, ...u.baru })), config: config.map((c) => ({ name: c.name, value: c.baru })) },
      aktor,
      ip,
      pulihDari,
    },
    async () => {
      const h = await bot<{ sebelum: Array<Record<string, unknown>>; sesudah: Array<Record<string, unknown>>; configSebelum: unknown[]; configSesudah: Array<{ name: string; value: string }> }>(
        "/menu/simpan",
        { method: "POST", body: { ubah, config } }
      );
      return { hasil: { sebelum: h.sebelum, sesudah: h.sesudah }, baru: { ubah: h.sesudah, config: h.configSesudah } };
    }
  );
}

// ---------------------------------------------------------------------------
// Variabel
// ---------------------------------------------------------------------------

type ButirDaftarVariabel = {
  noVar: string;
  ada: boolean;
  nama: string;
  jenis: string;
  dikunci: boolean;
  adaKueri: boolean;
  adaBawaan: boolean;
  jumlahBlangko: number;
  contohBlangko: string[];
};

/** Judul mudah dari kamus ALETA (kolom `arti`, 0059) bila ada. */
async function petaArti(db: AletaDatabase): Promise<Map<string, string>> {
  try {
    const baris = await db.queryAll<{ no_var: string; arti: string }>(`SELECT no_var, arti FROM aleta_kamus_variabel WHERE arti <> ''`);
    return new Map(baris.map((b) => [String(b.no_var).padStart(4, "0"), String(b.arti)]));
  } catch {
    return new Map();
  }
}

export async function daftarVariabel(db: AletaDatabase) {
  const h = await bot<{ jumlahBerkas: number; daftar: ButirDaftarVariabel[] }>("/variabel", { timeoutMs: 60000 });
  const arti = await petaArti(db);
  return { jumlahBerkas: h.jumlahBerkas, daftar: h.daftar.map((v) => ({ ...v, judul: arti.get(v.noVar) || v.nama || `Isian ${v.noVar}` })) };
}

type DefinisiVariabel = {
  noVar: string;
  nama: string;
  jenis: string;
  sql_query: string;
  default_data: string;
  dikunci: boolean;
  blangko: string[];
  [k: string]: unknown;
};

export async function bacaVariabel(db: AletaDatabase, noVar: string, hak: HakPengaturanAbt) {
  const h = await bot<{ variabel: DefinisiVariabel }>(`/variabel/${encodeURIComponent(noVar)}`, { timeoutMs: 60000 });
  const arti = await petaArti(db);
  const v = h.variabel;
  // Kueri hanya untuk Super Admin (bagian "lanjutan").
  const kueri = hak.ubahKueri ? { sql_query: v.sql_query } : { sql_query: undefined, adaKueri: Boolean(v.sql_query) };
  return { variabel: { ...v, ...kueri, judul: arti.get(v.noVar) || v.nama || `Isian ${v.noVar}` } };
}

export async function cariPerkaraContoh(nomor: string) {
  return bot<{ perkara: { perkaraId: number; nomor: string; jenis: string } | null }>(`/perkara?nomor=${encodeURIComponent(nomor)}`);
}

export async function ujiVariabel(hak: HakPengaturanAbt, badan: Record<string, unknown>) {
  if (badan.sql_query !== undefined) {
    wajibHak(hak, "ubahKueri", "menguji kueri variabel");
    const sebab = periksaKueriVariabel(String(badan.sql_query));
    if (sebab) return { uji: { ok: false, status: "ditolak", sebab, nilai: "", ms: 0 } };
  }
  return bot<{ uji: unknown }>("/variabel/uji", {
    method: "POST",
    timeoutMs: 30000,
    body: {
      noVar: String(badan.noVar ?? ""),
      perkaraId: Number(badan.perkaraId),
      sidangKe: Number(badan.sidangKe) || 0,
      ...(badan.sql_query !== undefined ? { sql_query: String(badan.sql_query) } : {}),
      ...(badan.default_data !== undefined ? { default_data: String(badan.default_data) } : {}),
    },
  });
}

/** Cermin di kamus ALETA ikut diperbarui supaya layar ALETA tidak membaca definisi basi. */
async function perbaruiKamusAleta(db: AletaDatabase, noVar: string, nilai: Record<string, string>) {
  const kolom = Object.keys(nilai).filter((k) => k === "sql_query" || k === "default_data");
  if (!kolom.length) return;
  try {
    await db.run(`UPDATE aleta_kamus_variabel SET ${kolom.map((k) => `${k} = ?`).join(", ")}, diubah_at = ? WHERE no_var = ?`, [
      ...kolom.map((k) => nilai[k] ?? ""),
      new Date().toISOString(),
      noVar,
    ]);
  } catch {
    // Kamus ALETA belum ada (pemasangan baru) - ABT tetap sumber kebenaran.
  }
}

export async function simpanVariabel(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>, pulihDari = "") {
  const hak = hakPengaturanAbt(aktor.roleId);
  const noVar = String(badan.noVar ?? "").trim();
  if (!/^\d{3,5}$/.test(noVar)) throw new ApiError(400, "Nomor variabel tidak sah.");
  const baruMentah = (badan.baru && typeof badan.baru === "object" ? badan.baru : {}) as Record<string, unknown>;
  const lamaMentah = (badan.lama && typeof badan.lama === "object" ? badan.lama : {}) as Record<string, unknown>;
  const baru: Record<string, string> = {};
  const lama: Record<string, string> = {};
  for (const k of ["sql_query", "default_data"] as const) {
    if (baruMentah[k] === undefined) continue;
    if (lamaMentah[k] === undefined) throw new ApiError(400, "Nilai lama tidak dikirim - muat ulang halaman.");
    baru[k] = String(baruMentah[k]);
    lama[k] = String(lamaMentah[k]);
  }
  if (!Object.keys(baru).length) throw new ApiError(400, "Tidak ada yang diubah.");
  if ("sql_query" in baru) {
    wajibHak(hak, "ubahKueri", "mengubah kueri variabel");
    const sebab = pulihDari && !baru.sql_query.trim() ? "" : periksaKueriVariabel(baru.sql_query);
    if (sebab) throw new ApiError(400, sebab);
  }
  if ("default_data" in baru) {
    if (!hak.ubahBawaan) throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah isian bawaan.");
    const luar = hurufDiluarLatin1(baru.default_data);
    if (luar.length) throw new ApiError(400, `Isian bawaan memuat huruf yang tidak dapat disimpan ABT: ${luar.join(" ")}`);
  }
  const bagian = [("sql_query" in baru ? "kueri" : ""), ("default_data" in baru ? "isian bawaan" : "")].filter(Boolean).join(" dan ");
  const hasil = await denganCatatan(
    db,
    {
      jenis: "variabel",
      kunci: noVar.padStart(4, "0"),
      ringkas: String(badan.ringkas ?? "").trim() || `mengubah ${bagian} #${noVar.padStart(4, "0")}#`,
      lama,
      baru,
      aktor,
      ip,
      pulihDari,
    },
    async () => {
      const h = await bot<{ sebelum: Record<string, string>; sesudah: Record<string, string>; uji: unknown }>("/variabel/simpan", {
        method: "POST",
        timeoutMs: 45000,
        body: { noVar, lama, baru, perkaraId: Number(badan.perkaraId), sidangKe: Number(badan.sidangKe) || 0, pulihkan: Boolean(pulihDari) },
      });
      return { hasil: { sebelum: h.sebelum, sesudah: h.sesudah, uji: h.uji }, baru: h.sesudah };
    }
  );
  await perbaruiKamusAleta(db, noVar.padStart(4, "0"), hasil.sesudah ?? {});
  return hasil;
}

// ---------------------------------------------------------------------------
// Template tanya jawab
// ---------------------------------------------------------------------------

export async function daftarTemplat() {
  return bot<{ kumpulan: Array<{ kode: string; nama: string; jenisPerkaraId: number[]; jumlah: number }> }>("/templat");
}

export async function bacaTemplat(kode: string) {
  return bot<{ templat: { kode: string; nama: string; jenisPerkaraId: number[]; baris: BarisTemplat[] } }>(`/templat/isi?kode=${encodeURIComponent(kode)}`);
}

function bacaBaris(x: unknown): BarisTemplat[] {
  if (!Array.isArray(x)) throw new ApiError(400, "Daftar pertanyaan tidak terbaca.");
  return x.map((b) => {
    const r = (b ?? {}) as Record<string, unknown>;
    return { tanya: String(r.tanya ?? ""), jawab: String(r.jawab ?? "") };
  });
}

export async function simpanTemplat(db: AletaDatabase, aktor: AktorPengaturan, ip: string, badan: Record<string, unknown>, pulihDari = "") {
  wajibHak(hakPengaturanAbt(aktor.roleId), "ubahTemplat", "mengubah template tanya jawab");
  const kode = String(badan.kode ?? "");
  if (!kode.trim() || kode.length > 5) throw new ApiError(400, "Kode template tidak sah.");
  const lama = bacaBaris(badan.lama);
  const baru = bacaBaris(badan.baru);
  const bolehKosong = Boolean(pulihDari);
  const masalah = periksaTemplat(baru).filter((m) => !(bolehKosong && /sedikitnya satu/.test(m)));
  if (masalah.length) throw new ApiError(400, masalah.join(" "));
  return denganCatatan(
    db,
    {
      jenis: "templat",
      kunci: kode,
      ringkas: String(badan.ringkas ?? "").trim() || `template ${kode}: ${ringkasBedaTemplat(lama, baru)}`,
      lama: { baris: lama },
      baru: { baris: baru },
      aktor,
      ip,
      pulihDari,
    },
    async () => {
      const h = await bot<{ sebelum: BarisTemplat[]; sesudah: BarisTemplat[] }>("/templat/simpan", {
        method: "POST",
        timeoutMs: 30000,
        body: { kode, lama, baru, bolehKosong },
      });
      return { hasil: { sebelum: h.sebelum, sesudah: h.sesudah }, baru: { baris: h.sesudah } };
    }
  );
}

// ---------------------------------------------------------------------------
// Kembalikan
// ---------------------------------------------------------------------------

const tanpaId = (x: Record<string, unknown>) => {
  const { id: _id, ...sisa } = x;
  void _id;
  return sisa;
};

/**
 * Menulis kembali nilai LAMA satu suntingan. Prasyaratnya isi ABT sekarang =
 * nilai_baru suntingan itu - ubahan orang lain sesudahnya tidak ditimpa.
 */
export async function kembalikanSuntingan(db: AletaDatabase, aktor: AktorPengaturan, ip: string, id: string) {
  const baris = await db.queryOne<BarisSuntingan>(`SELECT * FROM aleta_abt_suntingan WHERE id = ?`, [id]);
  if (!baris) throw new ApiError(404, "Catatan suntingan tidak ditemukan.");
  const s = keSuntingan(baris);
  if (s.status !== "tersimpan") throw new ApiError(400, "Hanya suntingan yang berhasil tersimpan yang dapat dikembalikan.");
  const lama = (s.nilaiLama ?? {}) as Record<string, unknown>;
  const baru = (s.nilaiBaru ?? {}) as Record<string, unknown>;
  const ringkas = `mengembalikan keadaan sebelum suntingan ${s.pada.slice(0, 16).replace("T", " ")} (${s.ringkas})`.slice(0, 500);

  if (s.jenis === "menu") {
    const ubahLama = (Array.isArray(lama.ubah) ? lama.ubah : []) as Array<Record<string, unknown>>;
    const ubahBaru = (Array.isArray(baru.ubah) ? baru.ubah : []) as Array<Record<string, unknown>>;
    const cfgLama = (Array.isArray(lama.config) ? lama.config : []) as Array<{ name: string; value: unknown }>;
    const cfgBaru = (Array.isArray(baru.config) ? baru.config : []) as Array<{ name: string; value: unknown }>;
    const ubah = ubahBaru.map((b) => {
      const asal = ubahLama.find((l) => Number(l.id) === Number(b.id));
      if (!asal) throw new ApiError(400, "Cadangan suntingan ini tidak lengkap.");
      return { id: Number(b.id), lama: tanpaId(b), baru: tanpaId(asal) };
    });
    const config = cfgBaru.map((b) => {
      const asal = cfgLama.find((l) => l.name === b.name);
      if (!asal) throw new ApiError(400, "Cadangan suntingan ini tidak lengkap.");
      return { name: b.name, lama: String(b.value ?? ""), baru: String(asal.value ?? "") };
    });
    return simpanMenu(db, aktor, ip, { ubah, config, ringkas }, s.id);
  }
  if (s.jenis === "variabel") {
    return simpanVariabel(db, aktor, ip, { noVar: s.kunci, lama: baru, baru: lama, ringkas }, s.id);
  }
  if (s.jenis === "templat") {
    return simpanTemplat(db, aktor, ip, { kode: s.kunci, lama: baru.baris, baru: lama.baris, ringkas }, s.id);
  }
  throw new ApiError(400, "Jenis suntingan tidak dikenal.");
}
