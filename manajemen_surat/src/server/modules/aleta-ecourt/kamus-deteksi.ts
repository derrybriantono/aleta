import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  RUAS_BAKU_POLA,
  RUAS_BAKU_TEMPLAT,
  bentukBakuNilai,
  gabungTambahan,
  ketepatan,
  kompilasiPola,
  periksaBerkasBenih,
  periksaPola,
  periksaTemplat,
  rapikanPola,
  rapikanTemplat,
  rapikanUkur,
  sidikPendek,
  statusSah,
  type BenihKelompok,
  type PolaKamus,
  type StatusKamus,
  type TemplatKamus,
  type UkurPola,
} from "@/lib/kamus-deteksi";
import { type AletaDatabase } from "@/server/db/client";
import { panggilBotKamus } from "@/server/modules/aleta-ecourt/kamus-deteksi-gateway";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * KAMUS DETEKSI & KALIMAT - LAPIS DATABASE (P9), JEJAK KOREKSI (D2), CALON (P8)
 * ============================================================================
 *
 * 10 Oktober 2026, paket deteksi lengkap. Kontrak: aleta_bot/kamus-deteksi/
 * README.md. Benih JSON hidup di citra bot; baris di sini menimpanya menurut
 * kode. Yang dikirim ke bot HANYA baris "aktif" dan "nonaktif":
 *
 *   aktif     menimpa/menambah pola benih
 *   nonaktif  mematikan pola benih (kamusDeteksi.js membuang status nonaktif)
 *   draf      TIDAK dikirim - benihnya tetap berlaku sampai drafnya diaktifkan.
 *             Calon dari koreksi petugas (P8) masuk sebagai draf atau ditolak;
 *             tidak ada yang aktif sendiri.
 *
 * Jejak koreksi (D2) adalah jejak JUJUR di aleta_*: usulan yang ditampilkan
 * ALETA dan nilai yang akhirnya disimpan petugas ke ABT. ABT tidak diberi
 * tanda apa pun.
 */

// ─── Bentuk baris ────────────────────────────────────────────────────────────

export type BarisPolaDb = PolaKamus & { asalCalon: string; diubahOleh: string; diubahAt: string };
export type BarisTemplatDb = TemplatKamus & { asalCalon: string; diubahOleh: string; diubahAt: string };

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function json<T>(nilai: unknown, bawaan: T): T {
  try {
    const isi = JSON.parse(String(nilai ?? ""));
    return (isi ?? bawaan) as T;
  } catch {
    return bawaan;
  }
}

function barisKePola(b: Record<string, unknown>): BarisPolaDb {
  return {
    ...rapikanPola({
      kode: b.kode,
      kelompok: b.kelompok,
      label: b.label,
      kunci: b.kunci,
      regex: b.regex,
      flags: b.flags,
      status: b.status,
      yakin: b.yakin,
      contohBenar: json<string[]>(b.contoh_benar, []),
      contohSalah: json<string[]>(b.contoh_salah, []),
      ukur: json<UkurPola>(b.ukur, { n: 0, tepat: 0, salahTangkap: 0 }),
      catatan: b.catatan,
      tambahan: json<Record<string, unknown>>(b.tambahan, {}),
    }),
    status: statusSah(b.status),
    asalCalon: teks(b.asal_calon),
    diubahOleh: teks(b.diubah_oleh),
    diubahAt: teks(b.diubah_at),
  };
}

function barisKeTemplat(b: Record<string, unknown>): BarisTemplatDb {
  return {
    ...rapikanTemplat({
      kode: b.kode,
      kelompok: b.kelompok,
      label: b.label,
      gaya: b.gaya,
      teks: b.teks,
      syarat: json<Record<string, unknown>>(b.syarat, {}),
      catatan: b.catatan,
      tambahan: json<Record<string, unknown>>(b.tambahan, {}),
    }),
    status: statusSah(b.status),
    asalCalon: teks(b.asal_calon),
    diubahOleh: teks(b.diubah_oleh),
    diubahAt: teks(b.diubah_at),
  };
}

export async function bacaLapisDb(db: AletaDatabase): Promise<{ pola: BarisPolaDb[]; templat: BarisTemplatDb[] }> {
  const [pola, templat] = await Promise.all([
    db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_pola ORDER BY kelompok, kode`),
    db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_templat ORDER BY kelompok, kode`),
  ]);
  return { pola: pola.map(barisKePola), templat: templat.map(barisKeTemplat) };
}

// ─── Lapis untuk bot ─────────────────────────────────────────────────────────

export type LapisBot = {
  pola: Array<PolaKamus & { kelompok: string }>;
  templat: Array<TemplatKamus & { kelompok: string }>;
  sidik: string;
  disusunPada: string;
};

/**
 * Bentuk yang diterima aturLapisDatabase di aleta_bot/services/kamusDeteksi.js:
 * butir berbentuk benih + kelompok. Draf TIDAK ikut. Ruas tambahan (0063)
 * digabung kembali ke objek butir - bentuknya sama dengan pola benih, jadi
 * mesin bot membaca p.sebab / p.kebalikan / p.golongan seperti dari benih.
 */
export function lapisUntukBot(lapis: { pola: BarisPolaDb[]; templat: BarisTemplatDb[] }, kini = new Date()): LapisBot {
  const dikirim = (s: StatusKamus) => s === "aktif" || s === "nonaktif";
  const pola = lapis.pola
    .filter((p) => dikirim(p.status))
    .map((p) =>
      gabungTambahan(
        {
          kode: p.kode,
          kelompok: p.kelompok,
          label: p.label,
          kunci: p.kunci,
          regex: p.regex,
          flags: p.flags,
          status: p.status,
          yakin: p.yakin,
          contohBenar: p.contohBenar,
          contohSalah: p.contohSalah,
          ukur: p.ukur,
          catatan: p.catatan,
        },
        p.tambahan
      )
    );
  const templat = lapis.templat
    .filter((t) => dikirim(t.status))
    .map((t) =>
      gabungTambahan(
        {
          kode: t.kode,
          kelompok: t.kelompok,
          label: t.label,
          gaya: t.gaya,
          teks: t.teks,
          syarat: t.syarat,
          status: t.status,
          catatan: t.catatan,
        },
        t.tambahan
      )
    );
  return { pola, templat, sidik: sidikPendek(JSON.stringify({ pola, templat })), disusunPada: kini.toISOString() };
}

export type HasilDorong = { ok: boolean; jumlahPola: number; jumlahTemplat: number; sidik: string; error?: string };

/** Mengirim lapis database ke bot. Gagal = dilaporkan, tidak dilempar. */
export async function dorongLapisKeBot(db: AletaDatabase): Promise<HasilDorong> {
  const lapis = lapisUntukBot(await bacaLapisDb(db));
  const r = await panggilBotKamus<{ ok?: boolean; diterima?: { pola?: number; templat?: number }; ditolak?: string[] }>("/lapis", {
    method: "PUT",
    body: lapis,
  });
  if (!r.ok) return { ok: false, jumlahPola: lapis.pola.length, jumlahTemplat: lapis.templat.length, sidik: lapis.sidik, error: r.error };
  return { ok: true, jumlahPola: lapis.pola.length, jumlahTemplat: lapis.templat.length, sidik: lapis.sidik };
}

// ─── Benih ───────────────────────────────────────────────────────────────────

export type InfoLapisBot = { jumlahPola: number; jumlahTemplat: number; sidik: string; diterimaPada: string } | null;

export type BacaanBenih = {
  asal: "bot" | "berkas" | "tidak-ada";
  kelompok: BenihKelompok[];
  galat: string[];
  lapisBot: InfoLapisBot;
  sebab: string;
};

function folderBenihLokal(): string | null {
  const calon = [
    process.env.ALETA_KAMUS_DETEKSI_BENIH_DIR || "",
    path.resolve(process.cwd(), "..", "aleta_bot", "kamus-deteksi", "awal"),
  ].filter(Boolean);
  return calon.find((p) => existsSync(p)) ?? null;
}

/** Benih dari folder lokal (pengembangan: portal dan bot satu repo). */
export function bacaBenihDariFolder(folder: string): { kelompok: BenihKelompok[]; galat: string[] } {
  const kelompok: BenihKelompok[] = [];
  const galat: string[] = [];
  for (const nama of readdirSync(folder).filter((n) => n.endsWith(".json")).sort()) {
    try {
      const hasil = periksaBerkasBenih(JSON.parse(readFileSync(path.join(folder, nama), "utf8")), nama);
      galat.push(...hasil.galat);
      if (hasil.benih) kelompok.push(hasil.benih);
    } catch (e) {
      galat.push(`${nama}: JSON tidak sah - ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { kelompok, galat };
}

/**
 * Benih dibaca dari BOT (yang memakainya), dengan cadangan folder lokal saat
 * pengembangan. Di server, citra portal tidak memuat folder aleta_bot.
 */
export async function bacaBenihKamus(): Promise<BacaanBenih> {
  const r = await panggilBotKamus<{
    benih?: Record<string, { pola?: unknown[]; templat?: unknown[] }>;
    lapis?: { jumlahPola?: number; jumlahTemplat?: number; sidik?: string; diterimaPada?: string };
  }>("", { timeoutMs: 5000 });
  if (r.ok && r.data.benih && typeof r.data.benih === "object") {
    const kelompok: BenihKelompok[] = [];
    const galat: string[] = [];
    for (const [nama, isi] of Object.entries(r.data.benih).sort(([a], [b]) => a.localeCompare(b))) {
      const hasil = periksaBerkasBenih({ kelompok: nama, ...isi }, `${nama}.json`);
      galat.push(...hasil.galat);
      if (hasil.benih) kelompok.push(hasil.benih);
    }
    const l = r.data.lapis;
    return {
      asal: "bot",
      kelompok,
      galat,
      sebab: "",
      lapisBot: l
        ? {
            jumlahPola: Number(l.jumlahPola) || 0,
            jumlahTemplat: Number(l.jumlahTemplat) || 0,
            sidik: teks(l.sidik),
            diterimaPada: teks(l.diterimaPada),
          }
        : null,
    };
  }
  const folder = folderBenihLokal();
  if (folder) {
    const hasil = bacaBenihDariFolder(folder);
    return { asal: "berkas", ...hasil, lapisBot: null, sebab: r.ok ? "" : `Bot: ${r.error}` };
  }
  return { asal: "tidak-ada", kelompok: [], galat: [], lapisBot: null, sebab: r.ok ? "Bot tidak mengirim benih." : r.error };
}

// ─── Angka lapangan dari jejak koreksi ───────────────────────────────────────

export type Lapangan = { dipakai: number; diterima: number; disunting: number; persenDiterima: number };

async function lapanganPerPola(db: AletaDatabase): Promise<Map<string, Lapangan>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT kode_pola, hasil, COUNT(*) AS jumlah FROM aleta_jejak_koreksi WHERE kode_pola <> '' GROUP BY kode_pola, hasil`
  );
  const peta = new Map<string, Lapangan>();
  for (const b of baris) {
    const kode = teks(b.kode_pola);
    const l = peta.get(kode) ?? { dipakai: 0, diterima: 0, disunting: 0, persenDiterima: 0 };
    const n = Number(b.jumlah) || 0;
    l.dipakai += n;
    if (teks(b.hasil) === "diterima") l.diterima += n;
    if (teks(b.hasil) === "disunting") l.disunting += n;
    peta.set(kode, l);
  }
  for (const l of peta.values()) l.persenDiterima = l.dipakai ? Math.round((l.diterima / l.dipakai) * 1000) / 10 : 0;
  return peta;
}

// ─── Daftar gabungan untuk layar Admin ───────────────────────────────────────

export type AsalButir = "benih" | "database" | "database-menimpa";

export type ItemPola = PolaKamus & {
  asal: AsalButir;
  adaBenih: boolean;
  ketepatan: number;
  peringatan: string[];
  lapangan: Lapangan | null;
  diubahOleh: string;
  diubahAt: string;
  asalCalon: string;
};

export type ItemTemplat = TemplatKamus & {
  asal: AsalButir;
  adaBenih: boolean;
  peringatan: string[];
  diubahOleh: string;
  diubahAt: string;
  asalCalon: string;
};

export type KelompokKamus = { kelompok: string; pola: ItemPola[]; templat: ItemTemplat[] };

export function gabungKamus(
  benih: BenihKelompok[],
  lapis: { pola: BarisPolaDb[]; templat: BarisTemplatDb[] },
  lapangan: Map<string, Lapangan> = new Map()
): KelompokKamus[] {
  const kelompok = new Map<string, { pola: Map<string, ItemPola>; templat: Map<string, ItemTemplat> }>();
  const wadah = (k: string) => {
    if (!kelompok.has(k)) kelompok.set(k, { pola: new Map(), templat: new Map() });
    return kelompok.get(k)!;
  };
  for (const b of benih) {
    const w = wadah(b.kelompok);
    for (const p of b.pola)
      w.pola.set(p.kode, {
        ...p,
        asal: "benih",
        adaBenih: true,
        ketepatan: ketepatan(p.ukur),
        peringatan: periksaPola(p).peringatan,
        lapangan: lapangan.get(p.kode) ?? null,
        diubahOleh: "",
        diubahAt: "",
        asalCalon: "",
      });
    for (const t of b.templat)
      w.templat.set(t.kode, { ...t, asal: "benih", adaBenih: true, peringatan: [], diubahOleh: "", diubahAt: "", asalCalon: "" });
  }
  for (const p of lapis.pola) {
    const w = wadah(p.kelompok);
    const adaBenih = benih.some((b) => b.pola.some((x) => x.kode === p.kode));
    // Baris database menimpa benih dengan kode sama - termasuk bila
    // kelompoknya berbeda (kamusDeteksi.js menimpa menurut kode per kelompok;
    // pindah kelompok berarti benih lama tetap di kelompok asalnya).
    w.pola.set(p.kode, {
      ...p,
      asal: adaBenih && w.pola.has(p.kode) ? "database-menimpa" : "database",
      adaBenih,
      ketepatan: ketepatan(p.ukur),
      peringatan: periksaPola(p).peringatan,
      lapangan: lapangan.get(p.kode) ?? null,
    });
  }
  for (const t of lapis.templat) {
    const w = wadah(t.kelompok);
    const adaBenih = benih.some((b) => b.templat.some((x) => x.kode === t.kode));
    w.templat.set(t.kode, { ...t, asal: adaBenih && w.templat.has(t.kode) ? "database-menimpa" : "database", adaBenih, peringatan: periksaTemplat(t).peringatan });
  }
  return Array.from(kelompok.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nama, w]) => ({
      kelompok: nama,
      pola: Array.from(w.pola.values()).sort((a, b) => a.kode.localeCompare(b.kode)),
      templat: Array.from(w.templat.values()).sort((a, b) => a.kode.localeCompare(b.kode)),
    }));
}

export async function daftarKamus(db: AletaDatabase) {
  const [benih, lapis, lapangan] = await Promise.all([bacaBenihKamus(), bacaLapisDb(db), lapanganPerPola(db)]);
  const kelompok = gabungKamus(benih.kelompok, lapis, lapangan);
  const kirim = lapisUntukBot(lapis);
  return {
    kelompok,
    benih: { asal: benih.asal, sebab: benih.sebab, galat: benih.galat, jumlahKelompok: benih.kelompok.length },
    lapisBot: benih.lapisBot,
    lapisPortal: { jumlahPola: kirim.pola.length, jumlahTemplat: kirim.templat.length, sidik: kirim.sidik },
    selaras: benih.lapisBot ? benih.lapisBot.sidik === kirim.sidik : null,
  };
}

// ─── Simpan / status ─────────────────────────────────────────────────────────

async function namaPengguna(db: AletaDatabase, id: string): Promise<string> {
  if (!id) return "";
  try {
    const b = await db.queryOne<Record<string, unknown>>(`SELECT name FROM users WHERE id = ?`, [id]);
    return teks(b?.name);
  } catch {
    return "";
  }
}

/* === RUAS-TAMBAHAN 11 Okt === */
/**
 * Badan permintaan hanya boleh membawa ruas baku + `tambahan` (objek). Kunci
 * lain di badan (tindakan, asalCalon, ...) BUKAN ruas tambahan pola - tanpa
 * penyaring ini rapikanPola akan menganggapnya ruas benih.
 */
function hanyaRuasBaku(masukan: Record<string, unknown>, ruasBaku: readonly string[]): Record<string, unknown> {
  const hasil: Record<string, unknown> = {};
  for (const k of ruasBaku) if (masukan[k] !== undefined) hasil[k] = masukan[k];
  if (masukan.tambahan !== undefined) hasil.tambahan = masukan.tambahan;
  return hasil;
}

function tambahanDariBadan(masukan: Record<string, unknown>): Record<string, unknown> | undefined {
  if (masukan.tambahan === undefined || masukan.tambahan === null) return undefined;
  if (typeof masukan.tambahan !== "object" || Array.isArray(masukan.tambahan))
    throw new ApiError(400, "Ruas tambahan harus objek JSON ({...}), bukan daftar atau teks.");
  return masukan.tambahan as Record<string, unknown>;
}

/** Rincian ukur di luar n/tepat/salahTangkap/sumber/tanggal (mis. golongan). */
function rincianUkur(ukur: UkurPola | undefined): Record<string, unknown> {
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ukur ?? {})) if (!["n", "tepat", "salahTangkap", "sumber", "tanggal"].includes(k)) hasil[k] = v;
  return hasil;
}

async function benihPola(kode: string, benih?: BenihKelompok[]): Promise<PolaKamus | null> {
  for (const b of benih ?? (await bacaBenihKamus()).kelompok) {
    const x = b.pola.find((p) => p.kode === kode);
    if (x) return x;
  }
  return null;
}

async function benihTemplat(kode: string, benih?: BenihKelompok[]): Promise<TemplatKamus | null> {
  for (const b of benih ?? (await bacaBenihKamus()).kelompok) {
    const x = b.templat.find((t) => t.kode === kode);
    if (x) return x;
  }
  return null;
}
/* === AKHIR RUAS-TAMBAHAN === */

/* === RIWAYAT 27 Okt === */
export type BarisRiwayatKamus = {
  id: string;
  jenis: "pola" | "templat";
  kode: string;
  kelompok: string;
  aksi: string;
  isiLama: Record<string, unknown> | null;
  isiBaru: Record<string, unknown> | null;
  oleh: string;
  pada: string;
};

/**
 * Mencatat satu perubahan kamus: siapa, kapan, isi lama dan isi baru. Gagal mencatat TIDAK menggagalkan simpan
 * (tabel riwayat belum termigrasi di server yang terlewat 0115) - hanya dicatat ke log.
 */
async function catatRiwayat(
  db: AletaDatabase,
  o: { jenis: "pola" | "templat"; kode: string; kelompok: string; aksi: string; lama: unknown; baru: unknown; oleh: string }
) {
  try {
    await db.run(
      `INSERT INTO aleta_kamus_deteksi_riwayat (id, jenis, kode, kelompok, aksi, isi_lama, isi_baru, oleh, pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        o.jenis,
        o.kode,
        o.kelompok,
        o.aksi,
        o.lama == null ? "" : JSON.stringify(o.lama),
        o.baru == null ? "" : JSON.stringify(o.baru),
        o.oleh,
        new Date().toISOString(),
      ]
    );
  } catch (e) {
    console.warn("[kamus deteksi] riwayat tidak tercatat:", e instanceof Error ? e.message : String(e));
  }
}

/** Riwayat perubahan terbaru lebih dulu; `kode` kosong = semua kode. */
export async function bacaRiwayatKamus(db: AletaDatabase, o: { kode?: string; batas?: number } = {}): Promise<BarisRiwayatKamus[]> {
  const batas = Math.max(1, Math.min(Number(o.batas) || 50, 500));
  const kode = teks(o.kode);
  let baris: Record<string, unknown>[] = [];
  try {
    baris = await db.queryAll<Record<string, unknown>>(
      `SELECT * FROM aleta_kamus_deteksi_riwayat ${kode ? "WHERE kode = ?" : ""} ORDER BY pada DESC LIMIT ${batas}`,
      kode ? [kode] : []
    );
  } catch {
    return [];
  }
  const urai = (v: unknown) => {
    const t = teks(v);
    if (!t) return null;
    try {
      const x = JSON.parse(t) as unknown;
      return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return baris.map((b) => ({
    id: teks(b.id),
    jenis: teks(b.jenis) === "templat" ? ("templat" as const) : ("pola" as const),
    kode: teks(b.kode),
    kelompok: teks(b.kelompok),
    aksi: teks(b.aksi),
    isiLama: urai(b.isi_lama),
    isiBaru: urai(b.isi_baru),
    oleh: teks(b.oleh),
    pada: teks(b.pada),
  }));
}
/* === AKHIR RIWAYAT === */

/**
 * Menyimpan (tambah/sunting) satu pola database. Galat aturan = 400.
 * Status bawaan untuk pola BARU adalah draf: yang baru diketik belum diuji
 * atas apa pun selain contohnya sendiri.
 *
 * Ruas tambahan (0063): `tambahan` di badan = isi lengkapnya (objek kosong
 * mengosongkan). Badan TANPA `tambahan` (klien lama, terima calon) mewarisi
 * ruas tambahan - beserta rincian ukur - dari baris lama, atau dari benih
 * berkode sama, supaya pola benih yang disunting tidak kehilangan ruas yang
 * dibaca mesin bot.
 */
export async function simpanPola(
  db: AletaDatabase,
  actorUserId: string,
  masukan: Record<string, unknown>,
  benih?: BenihKelompok[]
): Promise<BarisPolaDb> {
  const lama = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_pola WHERE kode = ?`, [teks(masukan.kode)]);
  const tambahanBadan = tambahanDariBadan(masukan);
  const p: PolaKamus = {
    ...rapikanPola(hanyaRuasBaku(masukan, RUAS_BAKU_POLA)),
    status: statusSah(masukan.status, lama ? statusSah(lama.status) : "draf"),
  };
  if (tambahanBadan === undefined) {
    const sumber = lama ? barisKePola(lama) : await benihPola(p.kode, benih);
    if (sumber) {
      p.tambahan = { ...sumber.tambahan };
      p.ukur = { ...rincianUkur(sumber.ukur), ...p.ukur };
    }
  }
  const periksa = periksaPola(p);
  if (periksa.galat.length) throw new ApiError(400, `Pola ditolak: ${periksa.galat.join("; ")}`);
  const kini = new Date().toISOString();
  const oleh = teks(actorUserId);
  const nilai = [
    p.kelompok,
    p.label,
    p.kunci,
    p.regex,
    p.flags,
    p.status,
    p.yakin,
    JSON.stringify(p.contohBenar),
    JSON.stringify(p.contohSalah),
    JSON.stringify(p.ukur),
    p.catatan,
    JSON.stringify(p.tambahan ?? {}),
  ];
  if (lama) {
    await db.run(
      `UPDATE aleta_kamus_deteksi_pola
          SET kelompok = ?, label = ?, kunci = ?, regex = ?, flags = ?, status = ?, yakin = ?,
              contoh_benar = ?, contoh_salah = ?, ukur = ?, catatan = ?, tambahan = ?, diubah_oleh = ?, diubah_at = ?
        WHERE kode = ?`,
      [...nilai, oleh, kini, p.kode]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_kamus_deteksi_pola
         (id, kode, kelompok, label, kunci, regex, flags, status, yakin, contoh_benar, contoh_salah, ukur, catatan, tambahan,
          asal_calon, dibuat_oleh, dibuat_at, diubah_oleh, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), p.kode, ...nilai, teks(masukan.asalCalon), oleh, kini, oleh, kini]
    );
  }
  const baru = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_pola WHERE kode = ?`, [p.kode]);
  const isiLama = lama ? barisKePola(lama) : await benihPola(p.kode, benih);
  await catatRiwayat(db, { jenis: "pola", kode: p.kode, kelompok: p.kelompok, aksi: isiLama ? "ubah" : "buat", lama: isiLama, baru: baru ? barisKePola(baru) : p, oleh });
  return barisKePola(baru ?? {});
}

/**
 * Templat: aturan ruas tambahan sama dengan simpanPola. `syarat` yang tidak
 * dikirim juga diwarisi (layar lama tidak mengirimnya sama sekali).
 */
export async function simpanTemplat(
  db: AletaDatabase,
  actorUserId: string,
  masukan: Record<string, unknown>,
  benih?: BenihKelompok[]
): Promise<BarisTemplatDb> {
  const lama = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_templat WHERE kode = ?`, [teks(masukan.kode)]);
  const tambahanBadan = tambahanDariBadan(masukan);
  const t: TemplatKamus = {
    ...rapikanTemplat(hanyaRuasBaku(masukan, RUAS_BAKU_TEMPLAT)),
    status: statusSah(masukan.status, lama ? statusSah(lama.status) : "draf"),
  };
  if (tambahanBadan === undefined || masukan.syarat === undefined) {
    const sumber = lama ? barisKeTemplat(lama) : await benihTemplat(t.kode, benih);
    if (sumber) {
      if (tambahanBadan === undefined) t.tambahan = { ...sumber.tambahan };
      if (masukan.syarat === undefined) t.syarat = { ...sumber.syarat };
    }
  }
  const periksa = periksaTemplat(t);
  if (periksa.galat.length) throw new ApiError(400, `Templat ditolak: ${periksa.galat.join("; ")}`);
  const kini = new Date().toISOString();
  const oleh = teks(actorUserId);
  const nilai = [t.kelompok, t.label, t.gaya, t.teks, JSON.stringify(t.syarat), t.status, t.catatan, JSON.stringify(t.tambahan ?? {})];
  if (lama) {
    await db.run(
      `UPDATE aleta_kamus_deteksi_templat
          SET kelompok = ?, label = ?, gaya = ?, teks = ?, syarat = ?, status = ?, catatan = ?, tambahan = ?, diubah_oleh = ?, diubah_at = ?
        WHERE kode = ?`,
      [...nilai, oleh, kini, t.kode]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_kamus_deteksi_templat
         (id, kode, kelompok, label, gaya, teks, syarat, status, catatan, tambahan, asal_calon, dibuat_oleh, dibuat_at, diubah_oleh, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), t.kode, ...nilai, teks(masukan.asalCalon), oleh, kini, oleh, kini]
    );
  }
  const baru = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_templat WHERE kode = ?`, [t.kode]);
  const isiLama = lama ? barisKeTemplat(lama) : await benihTemplat(t.kode, benih);
  await catatRiwayat(db, { jenis: "templat", kode: t.kode, kelompok: t.kelompok, aksi: isiLama ? "ubah" : "buat", lama: isiLama, baru: baru ? barisKeTemplat(baru) : t, oleh });
  return barisKeTemplat(baru ?? {});
}

/**
 * Mengubah status. Pola/templat yang HANYA ada di benih disalin dulu ke
 * database (dengan status barunya) - itulah cara mematikan pola benih.
 * Salinannya memuat SELURUH ruas benih: ruas baku, ruas tambahan (0063),
 * dan rincian ukur.
 */
export async function ubahStatusKamus(
  db: AletaDatabase,
  actorUserId: string,
  masukan: { jenis: string; kode: string; status: string },
  benih?: BenihKelompok[]
) {
  const jenis = masukan.jenis === "templat" ? "templat" : "pola";
  const kode = teks(masukan.kode);
  const status = statusSah(masukan.status, "draf");
  if (!(["aktif", "draf", "nonaktif"] as string[]).includes(teks(masukan.status))) throw new ApiError(400, "Status harus aktif, draf, atau nonaktif.");
  const tabel = jenis === "pola" ? "aleta_kamus_deteksi_pola" : "aleta_kamus_deteksi_templat";
  const ada = await db.queryOne<Record<string, unknown>>(`SELECT * FROM ${tabel} WHERE kode = ?`, [kode]);
  if (ada) {
    if (jenis === "pola" && status === "aktif") {
      const p = { ...barisKePola(ada), status: "aktif" as const };
      const g = periksaPola(p).galat;
      if (g.length) throw new ApiError(400, `Belum dapat diaktifkan: ${g.join("; ")}`);
    }
    await db.run(`UPDATE ${tabel} SET status = ?, diubah_oleh = ?, diubah_at = ? WHERE kode = ?`, [
      status,
      teks(actorUserId),
      new Date().toISOString(),
      kode,
    ]);
    await catatRiwayat(db, { jenis, kode, kelompok: teks(ada.kelompok), aksi: "status", lama: { status: teks(ada.status) }, baru: { status }, oleh: teks(actorUserId) });
    return { kode, status, disalinDariBenih: false };
  }
  const daftarBenih = benih ?? (await bacaBenihKamus()).kelompok;
  for (const b of daftarBenih) {
    if (jenis === "pola") {
      const p = b.pola.find((x) => x.kode === kode);
      if (p) {
        await simpanPola(db, actorUserId, { ...p, tambahan: p.tambahan ?? {}, kelompok: b.kelompok, status }, daftarBenih);
        return { kode, status, disalinDariBenih: true };
      }
    } else {
      const t = b.templat.find((x) => x.kode === kode);
      if (t) {
        await simpanTemplat(db, actorUserId, { ...t, tambahan: t.tambahan ?? {}, kelompok: b.kelompok, status }, daftarBenih);
        return { kode, status, disalinDariBenih: true };
      }
    }
  }
  throw new ApiError(404, `Kode ${kode} tidak ditemukan di benih maupun database.`);
}

/** Membuang baris database yang menimpa benih - benihnya berlaku lagi. */
export async function kembalikanKeBenih(db: AletaDatabase, masukan: { jenis: string; kode: string; oleh?: string }, benih?: BenihKelompok[]) {
  const jenis = masukan.jenis === "templat" ? "templat" : "pola";
  const kode = teks(masukan.kode);
  const daftarBenih = benih ?? (await bacaBenihKamus()).kelompok;
  const adaBenih = daftarBenih.some((b) => (jenis === "pola" ? b.pola : b.templat).some((x) => x.kode === kode));
  if (!adaBenih) throw new ApiError(400, "Kode ini tidak punya benih - nonaktifkan saja bila tidak dipakai.");
  const tabel = jenis === "pola" ? "aleta_kamus_deteksi_pola" : "aleta_kamus_deteksi_templat";
  const sebelum = await db.queryOne<Record<string, unknown>>(`SELECT * FROM ${tabel} WHERE kode = ?`, [kode]);
  await db.run(`DELETE FROM ${tabel} WHERE kode = ?`, [kode]);
  if (sebelum) {
    await catatRiwayat(db, {
      jenis,
      kode,
      kelompok: teks(sebelum.kelompok),
      aksi: "kembali-ke-benih",
      lama: jenis === "pola" ? barisKePola(sebelum) : barisKeTemplat(sebelum),
      baru: null,
      oleh: teks(masukan.oleh),
    });
  }
  return { kode, kembaliKeBenih: true };
}

// ─── D2: jejak koreksi ───────────────────────────────────────────────────────

export const HASIL_KOREKSI = ["diterima", "disunting", "diketik", "dipilih"] as const;
export type HasilKoreksi = (typeof HASIL_KOREKSI)[number];

const BATAS_ISI_KOREKSI = 2000;

export type MasukanKoreksi = {
  perkaraId?: string;
  nomorPerkara?: string;
  variabel?: string;
  namaVariabel?: string;
  nilaiUsulan?: string;
  sumber?: string;
  kodePola?: string;
  keyakinan?: string;
  kalimatSumber?: string;
  nilaiAkhir?: string;
  hasil?: string;
  jalur?: string;
  pada?: string;
};

function samaLonggar(a: string, b: string) {
  const baku = (x: string) => x.replace(/[’‘`"“”]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  return baku(a) === baku(b);
}

/**
 * Hasil ditetapkan DI SINI dari usulan vs nilai akhir, bukan dipercaya dari
 * ekstensi - kecuali "dipilih" (bunyi dipilih petugas dari pilihan ALETA),
 * yang memang tidak dapat dibedakan dari luar.
 */
export function tetapkanHasilKoreksi(nilaiUsulan: string, nilaiAkhir: string, hasilDikirim = ""): HasilKoreksi {
  if (hasilDikirim === "dipilih") return "dipilih";
  if (!nilaiUsulan.trim()) return "diketik";
  return samaLonggar(nilaiUsulan, nilaiAkhir) ? "diterima" : "disunting";
}

export async function catatKoreksi(db: AletaDatabase, actorUserId: string, masukan: MasukanKoreksi) {
  const variabel = teks(masukan.variabel).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 20);
  const perkaraId = teks(masukan.perkaraId);
  if (!variabel || !perkaraId) return null;
  const potong = (x: unknown) => String(x ?? "").slice(0, BATAS_ISI_KOREKSI);
  const nilaiUsulan = potong(masukan.nilaiUsulan);
  const nilaiAkhir = potong(masukan.nilaiAkhir);
  const hasil = tetapkanHasilKoreksi(nilaiUsulan, nilaiAkhir, teks(masukan.hasil));
  const id = randomUUID();
  const kini = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_jejak_koreksi
       (id, perkara_id, nomor_perkara, variabel, nama_variabel, nilai_usulan, sumber, kode_pola, keyakinan, kalimat_sumber,
        nilai_akhir, hasil, jalur, petugas_id, petugas_nama, pada, dibuat_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      perkaraId,
      teks(masukan.nomorPerkara).slice(0, 100),
      variabel,
      teks(masukan.namaVariabel).slice(0, 300),
      nilaiUsulan,
      teks(masukan.sumber).slice(0, 300),
      teks(masukan.kodePola).slice(0, 100),
      teks(masukan.keyakinan).slice(0, 40),
      potong(masukan.kalimatSumber),
      nilaiAkhir,
      hasil,
      teks(masukan.jalur).slice(0, 60),
      teks(actorUserId),
      await namaPengguna(db, teks(actorUserId)),
      teks(masukan.pada) || kini,
      kini,
    ]
  );
  return { id, hasil };
}

export type BarisKoreksi = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  variabel: string;
  namaVariabel: string;
  nilaiUsulan: string;
  sumber: string;
  kodePola: string;
  keyakinan: string;
  kalimatSumber: string;
  nilaiAkhir: string;
  hasil: string;
  jalur: string;
  petugasNama: string;
  pada: string;
};

function barisKeKoreksi(b: Record<string, unknown>): BarisKoreksi {
  return {
    id: teks(b.id),
    perkaraId: teks(b.perkara_id),
    nomorPerkara: teks(b.nomor_perkara),
    variabel: teks(b.variabel),
    namaVariabel: teks(b.nama_variabel),
    nilaiUsulan: String(b.nilai_usulan ?? ""),
    sumber: teks(b.sumber),
    kodePola: teks(b.kode_pola),
    keyakinan: teks(b.keyakinan),
    kalimatSumber: String(b.kalimat_sumber ?? ""),
    nilaiAkhir: String(b.nilai_akhir ?? ""),
    hasil: teks(b.hasil),
    jalur: teks(b.jalur),
    petugasNama: teks(b.petugas_nama),
    pada: teks(b.pada),
  };
}

export async function bacaJejakKoreksi(
  db: AletaDatabase,
  pilihan: { variabel?: string; kodePola?: string; hanyaKoreksi?: boolean; batas?: number } = {}
): Promise<BarisKoreksi[]> {
  const syarat: string[] = [];
  const nilai: string[] = [];
  if (pilihan.variabel) {
    syarat.push("variabel = ?");
    nilai.push(teks(pilihan.variabel));
  }
  if (pilihan.kodePola) {
    syarat.push("kode_pola = ?");
    nilai.push(teks(pilihan.kodePola));
  }
  if (pilihan.hanyaKoreksi) syarat.push("hasil <> 'diterima'");
  const batas = Math.max(1, Math.min(Number(pilihan.batas) || 100, 500));
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_jejak_koreksi ${syarat.length ? `WHERE ${syarat.join(" AND ")}` : ""} ORDER BY pada DESC LIMIT ${batas}`,
    nilai
  );
  return baris.map(barisKeKoreksi);
}

export async function ringkasKoreksi(db: AletaDatabase) {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT variabel, hasil, COUNT(*) AS jumlah FROM aleta_jejak_koreksi GROUP BY variabel, hasil`
  );
  const perHasil: Record<HasilKoreksi, number> = { diterima: 0, disunting: 0, diketik: 0, dipilih: 0 };
  const perVariabel = new Map<string, { variabel: string; jumlah: number } & Record<HasilKoreksi, number>>();
  let jumlah = 0;
  for (const b of baris) {
    const v = teks(b.variabel);
    const h = teks(b.hasil) as HasilKoreksi;
    const n = Number(b.jumlah) || 0;
    jumlah += n;
    if (h in perHasil) perHasil[h] += n;
    const w = perVariabel.get(v) ?? { variabel: v, jumlah: 0, diterima: 0, disunting: 0, diketik: 0, dipilih: 0 };
    w.jumlah += n;
    if (h in perHasil) w[h] += n;
    perVariabel.set(v, w);
  }
  return { jumlah, perHasil, perVariabel: Array.from(perVariabel.values()).sort((a, b) => b.jumlah - a.jumlah) };
}

// ─── P8: calon dari koreksi berulang ─────────────────────────────────────────

/**
 * Ambang calon. Satu koreksi bisa kebetulan; tiga koreksi yang sama di dua
 * perkara berbeda adalah kebiasaan petugas yang layak ditinjau admin.
 * rasioPola: bagian usulan satu pola yang disunting sebelum dianggap perlu
 * ditinjau (0,2 = satu dari lima).
 */
export const AMBANG_CALON = { koreksi: 3, perkara: 2, rasioPola: 0.2 };

export type Calon = {
  id: string;
  jenis: "pola" | "templat";
  sidik: string;
  kelompok: string;
  variabel: string;
  kodePolaAsal: string;
  usulKode: string;
  usulLabel: string;
  usulKunci: string;
  usulRegex: string;
  usulFlags: string;
  usulTeks: string;
  contohBenar: string[];
  contohSalah: string[];
  jumlahKoreksi: number;
  jumlahPerkara: number;
  jumlahDipakai: number;
  alasan: string;
  keadaan: "menunggu" | "diterima" | "ditolak";
  ditinjauOleh: string;
  ditinjauAt: string;
  alasanTolak: string;
  hasilKode: string;
  diubahAt: string;
};

function barisKeCalon(b: Record<string, unknown>): Calon {
  const k = teks(b.keadaan);
  return {
    id: teks(b.id),
    jenis: teks(b.jenis) === "templat" ? "templat" : "pola",
    sidik: teks(b.sidik),
    kelompok: teks(b.kelompok),
    variabel: teks(b.variabel),
    kodePolaAsal: teks(b.kode_pola_asal),
    usulKode: teks(b.usul_kode),
    usulLabel: teks(b.usul_label),
    usulKunci: teks(b.usul_kunci),
    usulRegex: String(b.usul_regex ?? ""),
    usulFlags: teks(b.usul_flags),
    usulTeks: String(b.usul_teks ?? ""),
    contohBenar: json<string[]>(b.contoh_benar, []),
    contohSalah: json<string[]>(b.contoh_salah, []),
    jumlahKoreksi: Number(b.jumlah_koreksi) || 0,
    jumlahPerkara: Number(b.jumlah_perkara) || 0,
    jumlahDipakai: Number(b.jumlah_dipakai) || 0,
    alasan: teks(b.alasan),
    keadaan: k === "diterima" || k === "ditolak" ? k : "menunggu",
    ditinjauOleh: teks(b.ditinjau_oleh),
    ditinjauAt: teks(b.ditinjau_at),
    alasanTolak: teks(b.alasan_tolak),
    hasilKode: teks(b.hasil_kode),
    diubahAt: teks(b.diubah_at),
  };
}

type UsulCalon = Omit<Calon, "id" | "keadaan" | "ditinjauOleh" | "ditinjauAt" | "alasanTolak" | "hasilKode" | "diubahAt"> & {
  bukti: string[];
};

/** Kode yang sah dari variabel + sidik. */
function kodeCalon(awalan: string, variabel: string, sidik: string) {
  return `${awalan}-${variabel.toLowerCase().replace(/[^a-z0-9]/g, "")}-${sidik.slice(0, 6)}`;
}

/**
 * Menyusun calon dari jejak koreksi - fungsi murni atas baris koreksi.
 *
 *   templat  nilai akhir yang sama (bentuk baku: angka -> #) diketik/disunting
 *            petugas >= ambang kali di >= 2 perkara untuk variabel yang sama:
 *            calon templat dengan teks nilai akhir terbaru.
 *   pola     usulan satu kode pola disunting >= ambang kali DAN >= 20% dari
 *            pemakaiannya: calon tinjauan pola, kalimat sumber yang dikoreksi
 *            menjadi contohSalah, yang diterima utuh menjadi contohBenar.
 */
export function usulCalonDariKoreksi(
  koreksi: BarisKoreksi[],
  polaDikenal: Map<string, PolaKamus & { kelompok: string }> = new Map(),
  ambang = AMBANG_CALON
): UsulCalon[] {
  const hasil: UsulCalon[] = [];

  // --- templat ---
  const kelompokNilai = new Map<string, BarisKoreksi[]>();
  for (const k of koreksi) {
    if (k.hasil !== "disunting" && k.hasil !== "diketik") continue;
    // 25 Okt (C1): koreksi butir saksi (variabel "saksi-<kode>") hanya untuk statistik per pola - teks keterangan
    // saksi memuat nama asli dan tidak pernah menjadi calon templat.
    if (/^saksi-/i.test(k.variabel)) continue;
    const bentuk = bentukBakuNilai(k.nilaiAkhir);
    if (bentuk.length < 3) continue;
    const kunci = `${k.variabel}|${bentuk}`;
    const w = kelompokNilai.get(kunci) ?? [];
    w.push(k);
    kelompokNilai.set(kunci, w);
  }
  for (const [kunci, daftar] of kelompokNilai) {
    const perkara = new Set(daftar.map((d) => d.perkaraId));
    if (daftar.length < ambang.koreksi || perkara.size < ambang.perkara) continue;
    const [variabel] = kunci.split("|");
    const sidik = `templat|${variabel}|${sidikPendek(kunci)}`;
    const terbaru = [...daftar].sort((a, b) => b.pada.localeCompare(a.pada))[0];
    hasil.push({
      jenis: "templat",
      sidik,
      kelompok: `koreksi-${variabel.toLowerCase()}`,
      variabel,
      kodePolaAsal: "",
      usulKode: kodeCalon("koreksi", variabel, sidikPendek(kunci)),
      usulLabel: `Isian petugas berulang untuk ${variabel}${terbaru.namaVariabel ? ` (${terbaru.namaVariabel})` : ""}`,
      usulKunci: variabel,
      usulRegex: "",
      usulFlags: "i",
      usulTeks: terbaru.nilaiAkhir,
      contohBenar: [],
      contohSalah: [],
      jumlahKoreksi: daftar.length,
      jumlahPerkara: perkara.size,
      jumlahDipakai: daftar.length,
      alasan: `${daftar.length} kali petugas menyimpan isian yang sama bentuknya untuk ${variabel} di ${perkara.size} perkara, berbeda dari usulan ALETA.`,
      bukti: daftar.slice(0, 50).map((d) => d.id),
    });
  }

  // --- pola ---
  const perPola = new Map<string, BarisKoreksi[]>();
  for (const k of koreksi) {
    if (!k.kodePola) continue;
    const w = perPola.get(k.kodePola) ?? [];
    w.push(k);
    perPola.set(k.kodePola, w);
  }
  for (const [kodePola, daftar] of perPola) {
    const disunting = daftar.filter((d) => d.hasil === "disunting");
    if (disunting.length < ambang.koreksi) continue;
    if (disunting.length / daftar.length < ambang.rasioPola) continue;
    const perkara = new Set(disunting.map((d) => d.perkaraId));
    if (perkara.size < ambang.perkara) continue;
    const dikenal = polaDikenal.get(kodePola);
    const unik = (xs: string[]) => Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean))).slice(0, 10);
    hasil.push({
      jenis: "pola",
      sidik: `pola|${kodePola}`,
      kelompok: dikenal?.kelompok ?? "",
      variabel: disunting[0].variabel,
      kodePolaAsal: kodePola,
      usulKode: kodePola,
      usulLabel: dikenal?.label ? `${dikenal.label} (tinjau)` : `Tinjau pola ${kodePola}`,
      usulKunci: dikenal?.kunci ?? "",
      usulRegex: dikenal?.regex ?? "",
      usulFlags: dikenal?.flags ?? "i",
      usulTeks: "",
      contohBenar: unik(daftar.filter((d) => d.hasil === "diterima").map((d) => d.kalimatSumber)).slice(0, 5),
      contohSalah: unik(disunting.map((d) => d.kalimatSumber)),
      jumlahKoreksi: disunting.length,
      jumlahPerkara: perkara.size,
      jumlahDipakai: daftar.length,
      alasan: `Usulan dari pola ${kodePola} disunting petugas ${disunting.length} dari ${daftar.length} kali (${Math.round(
        (disunting.length / daftar.length) * 100
      )}%) di ${perkara.size} perkara.`,
      bukti: disunting.slice(0, 50).map((d) => d.id),
    });
  }
  return hasil;
}

/**
 * Menyimpan calon: yang baru masuk "menunggu"; yang menunggu diperbarui
 * angkanya; yang sudah diterima/ditolak TIDAK dihidupkan lagi.
 */
export async function susunCalon(db: AletaDatabase, polaDikenal?: Map<string, PolaKamus & { kelompok: string }>, ambang = AMBANG_CALON) {
  const koreksi = (
    await db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_jejak_koreksi ORDER BY pada DESC LIMIT 20000`)
  ).map(barisKeKoreksi);
  const usul = usulCalonDariKoreksi(koreksi, polaDikenal, ambang);
  let baru = 0;
  let diperbarui = 0;
  const kini = new Date().toISOString();
  for (const u of usul) {
    const ada = await db.queryOne<Record<string, unknown>>(`SELECT id, keadaan FROM aleta_kamus_deteksi_calon WHERE sidik = ?`, [u.sidik]);
    if (ada) {
      if (teks(ada.keadaan) !== "menunggu") continue;
      await db.run(
        `UPDATE aleta_kamus_deteksi_calon
            SET jumlah_koreksi = ?, jumlah_perkara = ?, jumlah_dipakai = ?, contoh_benar = ?, contoh_salah = ?, bukti = ?,
                alasan = ?, usul_teks = ?, usul_regex = ?, diubah_at = ?
          WHERE id = ?`,
        [
          u.jumlahKoreksi,
          u.jumlahPerkara,
          u.jumlahDipakai,
          JSON.stringify(u.contohBenar),
          JSON.stringify(u.contohSalah),
          JSON.stringify(u.bukti),
          u.alasan,
          u.usulTeks,
          u.usulRegex,
          kini,
          teks(ada.id),
        ]
      );
      diperbarui += 1;
      continue;
    }
    await db.run(
      `INSERT INTO aleta_kamus_deteksi_calon
         (id, jenis, sidik, kelompok, variabel, kode_pola_asal, usul_kode, usul_label, usul_kunci, usul_regex, usul_flags,
          usul_teks, contoh_benar, contoh_salah, jumlah_koreksi, jumlah_perkara, jumlah_dipakai, bukti, alasan, keadaan,
          dibuat_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?)`,
      [
        randomUUID(),
        u.jenis,
        u.sidik,
        u.kelompok,
        u.variabel,
        u.kodePolaAsal,
        u.usulKode,
        u.usulLabel,
        u.usulKunci,
        u.usulRegex,
        u.usulFlags,
        u.usulTeks,
        JSON.stringify(u.contohBenar),
        JSON.stringify(u.contohSalah),
        u.jumlahKoreksi,
        u.jumlahPerkara,
        u.jumlahDipakai,
        JSON.stringify(u.bukti),
        u.alasan,
        kini,
        kini,
      ]
    );
    baru += 1;
  }
  return { baru, diperbarui, diperiksa: koreksi.length };
}

export async function daftarCalon(db: AletaDatabase, keadaan = "menunggu"): Promise<Calon[]> {
  const k = ["menunggu", "diterima", "ditolak"].includes(keadaan) ? keadaan : "menunggu";
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_kamus_deteksi_calon WHERE keadaan = ? ORDER BY jumlah_koreksi DESC, diubah_at DESC LIMIT 200`,
    [k]
  );
  return baris.map(barisKeCalon);
}

/**
 * Menerima calon: lahir baris pola/templat (status aktif atau draf menurut
 * pilihan admin; bawaan draf), calon ditandai diterima. Isian yang dikirim
 * admin (kode, kelompok, regex, teks, ...) mengalahkan usulan calon.
 */
export async function terimaCalon(db: AletaDatabase, actorUserId: string, masukan: Record<string, unknown>) {
  const b = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_kamus_deteksi_calon WHERE id = ?`, [teks(masukan.id)]);
  if (!b) throw new ApiError(404, "Calon tidak ditemukan.");
  const c = barisKeCalon(b);
  if (c.keadaan !== "menunggu") throw new ApiError(409, `Calon ini sudah ${c.keadaan}.`);
  const status = teks(masukan.status) === "aktif" ? "aktif" : "draf";
  const ambil = (kunci: string, cadangan: string) => (masukan[kunci] === undefined ? cadangan : String(masukan[kunci] ?? ""));
  let hasilKode: string;
  if (c.jenis === "pola") {
    const p = await simpanPola(db, actorUserId, {
      kode: ambil("kode", c.usulKode),
      kelompok: ambil("kelompok", c.kelompok),
      label: ambil("label", c.usulLabel),
      kunci: ambil("kunci", c.usulKunci),
      regex: ambil("regex", c.usulRegex),
      flags: ambil("flags", c.usulFlags || "i"),
      status,
      yakin: "ragu",
      contohBenar: Array.isArray(masukan.contohBenar) ? masukan.contohBenar : c.contohBenar,
      contohSalah: Array.isArray(masukan.contohSalah) ? masukan.contohSalah : c.contohSalah,
      ukur: { n: 0, tepat: 0, salahTangkap: 0 },
      catatan: `Dari calon koreksi petugas: ${c.alasan}`,
      asalCalon: c.id,
    });
    hasilKode = p.kode;
  } else {
    const t = await simpanTemplat(db, actorUserId, {
      kode: ambil("kode", c.usulKode),
      kelompok: ambil("kelompok", c.kelompok),
      label: ambil("label", c.usulLabel),
      gaya: ambil("gaya", ""),
      teks: ambil("teks", c.usulTeks),
      status,
      catatan: `Dari calon koreksi petugas: ${c.alasan}`,
      asalCalon: c.id,
    });
    hasilKode = t.kode;
  }
  await db.run(
    `UPDATE aleta_kamus_deteksi_calon SET keadaan = 'diterima', ditinjau_oleh = ?, ditinjau_at = ?, hasil_kode = ?, diubah_at = ? WHERE id = ?`,
    [teks(actorUserId), new Date().toISOString(), hasilKode, new Date().toISOString(), c.id]
  );
  return { id: c.id, jenis: c.jenis, hasilKode, status };
}

export async function tolakCalon(db: AletaDatabase, actorUserId: string, masukan: { id?: unknown; alasan?: unknown }) {
  const alasan = teks(masukan.alasan);
  if (!alasan) throw new ApiError(400, "Penolakan wajib beralasan.");
  const b = await db.queryOne<Record<string, unknown>>(`SELECT keadaan FROM aleta_kamus_deteksi_calon WHERE id = ?`, [teks(masukan.id)]);
  if (!b) throw new ApiError(404, "Calon tidak ditemukan.");
  if (teks(b.keadaan) !== "menunggu") throw new ApiError(409, `Calon ini sudah ${teks(b.keadaan)}.`);
  const kini = new Date().toISOString();
  await db.run(
    `UPDATE aleta_kamus_deteksi_calon SET keadaan = 'ditolak', ditinjau_oleh = ?, ditinjau_at = ?, alasan_tolak = ?, diubah_at = ? WHERE id = ?`,
    [teks(actorUserId), kini, alasan, kini, teks(masukan.id)]
  );
  return { id: teks(masukan.id), keadaan: "ditolak" as const };
}

/** Peta pola yang dikenal (benih + database) - bahan calon pola. */
export function petaPolaDikenal(kelompok: KelompokKamus[]): Map<string, PolaKamus & { kelompok: string }> {
  const peta = new Map<string, PolaKamus & { kelompok: string }>();
  for (const k of kelompok) for (const p of k.pola) peta.set(p.kode, { ...p, kelompok: k.kelompok });
  return peta;
}

// ─── Uji pola atas sampel data nyata (lewat bot, baca-saja) ──────────────────

export const SUMBER_SAMPEL = {
  saksi: "Keterangan saksi (ABT abt_keterangan_saksi.jawaban)",
  posita: "Posita (SIPP perkara.posita)",
  petitum: "Petitum (SIPP perkara.petitum)",
  amar: "Amar putusan (SIPP perkara_putusan.amar_putusan)",
  isian: "Isian petugas ABT (abt_data_teks.data, boleh per variabel)",
} as const;
export type SumberSampel = keyof typeof SUMBER_SAMPEL;

export type HasilUjiSampel = {
  ok: boolean;
  sumber: string;
  diperiksa: number;
  cocok: number;
  persen: number;
  contoh: Array<{ rujukan: string; cuplikan: string }>;
  contohTidak: Array<{ rujukan: string; cuplikan: string }>;
  error?: string;
};

export async function ujiPolaAtasSampel(masukan: Record<string, unknown>): Promise<HasilUjiSampel> {
  const regex = String(masukan.regex ?? "");
  const flags = masukan.flags === undefined ? "i" : teks(masukan.flags);
  const k = kompilasiPola(regex, flags);
  if (!k.ok) throw new ApiError(400, k.galat);
  const sumber = teks(masukan.sumber) as SumberSampel;
  if (!(sumber in SUMBER_SAMPEL)) throw new ApiError(400, `Sumber sampel harus salah satu dari: ${Object.keys(SUMBER_SAMPEL).join(", ")}.`);
  const batas = Math.max(50, Math.min(Number(masukan.batas) || 2000, 20000));
  const noVar = teks(masukan.noVar).replace(/[^0-9]/g, "").slice(0, 4);
  const r = await panggilBotKamus<HasilUjiSampel>("/uji", {
    method: "POST",
    body: { regex, flags, sumber, batas, noVar },
    timeoutMs: 30000,
  });
  if (!r.ok) return { ok: false, sumber, diperiksa: 0, cocok: 0, persen: 0, contoh: [], contohTidak: [], error: r.error };
  const d = r.data;
  const diperiksa = Number(d.diperiksa) || 0;
  const cocok = Number(d.cocok) || 0;
  return {
    ok: true,
    sumber,
    diperiksa,
    cocok,
    persen: diperiksa ? Math.round((cocok / diperiksa) * 1000) / 10 : 0,
    contoh: Array.isArray(d.contoh) ? d.contoh.slice(0, 20) : [],
    contohTidak: Array.isArray(d.contohTidak) ? d.contohTidak.slice(0, 5) : [],
  };
}

// ─── Dorong berkala (instrumentation.ts) ─────────────────────────────────────

/**
 * Menyelaraskan lapis bot dengan portal: dibandingkan sidiknya dulu, didorong
 * hanya bila berbeda (bot baru dibangun ulang, dorongan sebelumnya gagal,
 * atau berkas runtime-data hilang). Tidak pernah melempar.
 */
export async function selaraskanLapisBot(db: AletaDatabase): Promise<{ didorong: boolean; sebab: string }> {
  try {
    const kirim = lapisUntukBot(await bacaLapisDb(db));
    const r = await panggilBotKamus<{ lapis?: { sidik?: string } }>("", { timeoutMs: 5000 });
    if (!r.ok) return { didorong: false, sebab: r.error };
    const sidikBot = teks(r.data.lapis?.sidik);
    if (sidikBot === kirim.sidik) return { didorong: false, sebab: "sudah selaras" };
    // Lapis portal kosong dan bot belum pernah menerima apa pun: tidak ada yang perlu dikirim.
    if (!sidikBot && !kirim.pola.length && !kirim.templat.length) return { didorong: false, sebab: "lapis kosong" };
    const d = await dorongLapisKeBot(db);
    return { didorong: d.ok, sebab: d.ok ? "didorong" : (d.error ?? "gagal") };
  } catch (e) {
    return { didorong: false, sebab: e instanceof Error ? e.message : String(e) };
  }
}

const WADAH_DORONG = globalThis as unknown as { __aletaKamusDorong?: NodeJS.Timeout | null };

/** Detak penyelarasan: pertama sesudah 60 detik, lalu tiap 15 menit (ALETA_KAMUS_DETEKSI_DORONG_MENIT). */
export function mulaiSelarasBerkala(ambilDb: () => Promise<AletaDatabase>) {
  if (WADAH_DORONG.__aletaKamusDorong) return;
  const menit = Math.max(1, Number(process.env.ALETA_KAMUS_DETEKSI_DORONG_MENIT || 15));
  const jalan = async () => {
    try {
      const hasil = await selaraskanLapisBot(await ambilDb());
      if (hasil.didorong) console.log("[kamus deteksi] lapis database didorong ke bot.");
    } catch {
      /* portal tetap berjalan; dicoba lagi pada detak berikutnya */
    }
  };
  const awal = setTimeout(() => void jalan(), 60000);
  awal.unref?.();
  WADAH_DORONG.__aletaKamusDorong = setInterval(() => void jalan(), menit * 60000);
  WADAH_DORONG.__aletaKamusDorong.unref?.();
}
