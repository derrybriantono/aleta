import crypto from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { ajukanPeringatan, lepasPeringatanTertunda } from "@/server/modules/kesehatan/peringatan-gabungan";
import { BERAT, LABEL_JENIS, periksaIsi, type JenisTemuan } from "@/server/modules/integritas/aturan";
import { BATAS_HALAMAN_BYTE, pindaiFolder, type JenisPindai, type RingkasPindai } from "@/server/modules/integritas/pemindai";
import { bacaPengaturanIntegritas, type PengaturanIntegritas } from "@/server/modules/integritas/pengaturan";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PENJAGA INTEGRITAS: TEMUAN, PERINGATAN, DETAK, RINGKASAN (E6, 25 Okt 2026)
 * ============================================================================
 *
 *   - halaman publik website diperiksa kata judolnya (HTTP GET, hanya alamat
 *     yang didaftarkan Super Admin, batas 2 MB dan 10 detik);
 *   - temuan BARU menghasilkan SATU pesan WhatsApp ke admin (jalur ringkas,
 *     tanpa isi berkas) lewat jalur peringatan Pusat kesehatan; komponen
 *     "Integritas berkas" di Pusat kesehatan merah selama ada temuan baru;
 *   - TIDAK ADA yang dihapus, dipindah, atau diubah di folder terdaftar;
 *   - daftar "diketahui aman" (sha256) untuk pembaruan resmi.
 */
export const FOLDER_HALAMAN = "halaman-publik";

export type Temuan = {
  id: string;
  folderId: string;
  folderNama: string;
  jalur: string;
  jenis: JenisTemuan;
  label: string;
  aturan: string;
  baris: number;
  sha256: string;
  ukuran: number;
  pertamaAt: string;
  terakhirAt: string;
  status: "baru" | "ditangani";
  tanganiOleh: string;
  tanganiAt: string;
};

type BarisTemuan = {
  id: string;
  folder_id: string;
  jalur: string;
  jenis: string;
  aturan: string;
  baris: number | string;
  sha256: string;
  ukuran: number | string;
  pertama_at: string;
  terakhir_at: string;
  status: string;
  ditangani_oleh: string;
  ditangani_at: string;
  diperingatkan_at: string;
};

function namaFolder(p: PengaturanIntegritas, id: string): string {
  if (id === FOLDER_HALAMAN) return "Halaman publik";
  return p.folder.find((f) => f.id === id)?.nama ?? id;
}

function keTemuan(b: BarisTemuan, p: PengaturanIntegritas): Temuan {
  const jenis = b.jenis as JenisTemuan;
  return {
    id: b.id,
    folderId: b.folder_id,
    folderNama: namaFolder(p, b.folder_id),
    jalur: b.jalur,
    jenis,
    label: LABEL_JENIS[jenis] ?? b.jenis,
    aturan: b.aturan,
    baris: Number(b.baris),
    sha256: b.sha256,
    ukuran: Number(b.ukuran),
    pertamaAt: b.pertama_at,
    terakhirAt: b.terakhir_at,
    status: b.status === "baru" ? "baru" : "ditangani",
    tanganiOleh: b.ditangani_oleh,
    tanganiAt: b.ditangani_at,
  };
}

export async function daftarTemuan(db: AletaDatabase, opsi: { status?: "baru" | "ditangani" | "semua"; batas?: number } = {}): Promise<Temuan[]> {
  const p = await bacaPengaturanIntegritas(db);
  const status = opsi.status ?? "baru";
  const baris = await db.queryAll<BarisTemuan>(
    status === "semua" ? "SELECT * FROM aleta_integritas_temuan ORDER BY terakhir_at DESC" : "SELECT * FROM aleta_integritas_temuan WHERE status = ? ORDER BY terakhir_at DESC",
    status === "semua" ? [] : [status]
  );
  return baris
    .map((b) => keTemuan(b, p))
    .sort((a, b) => BERAT[b.jenis] - BERAT[a.jenis] || b.terakhirAt.localeCompare(a.terakhirAt))
    .slice(0, opsi.batas ?? 300);
}

async function catatAudit(db: AletaDatabase, actorId: string, action: string, entityId: string, payload: Record<string, unknown>) {
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actorId,
    action,
    entityType: "aleta_integritas_temuan",
    entityId,
    payload,
  });
}

/** Menandai temuan sudah ditangani (manusia sudah memeriksa/membersihkan). Tidak menyentuh berkas. */
export async function tandaiDitangani(db: AletaDatabase, id: string, oleh: { id: string; nama: string }, kini: Date = new Date()): Promise<Temuan> {
  const b = await db.queryOne<BarisTemuan>("SELECT * FROM aleta_integritas_temuan WHERE id = ?", [id]);
  if (!b) throw new ApiError(404, "Temuan tidak ditemukan.");
  await db.run("UPDATE aleta_integritas_temuan SET status = 'ditangani', ditangani_oleh = ?, ditangani_at = ? WHERE id = ?", [oleh.nama || oleh.id, kini.toISOString(), id]);
  await catatAudit(db, oleh.id, "INTEGRITAS_DITANGANI", id, { jalur: b.jalur, jenis: b.jenis });
  return keTemuan({ ...b, status: "ditangani", ditangani_oleh: oleh.nama || oleh.id, ditangani_at: kini.toISOString() }, await bacaPengaturanIntegritas(db));
}

/**
 * "Diketahui aman": sha256 berkas ini dicatat sebagai sudah diperiksa manusia
 * (mis. pembaruan resmi CMS). Berkas dengan jalur + sha256 yang sama tidak
 * dilaporkan lagi; bila isinya berubah lagi, ia dilaporkan kembali.
 */
export async function tandaiAman(db: AletaDatabase, id: string, alasan: string, oleh: { id: string; nama: string }, kini: Date = new Date()): Promise<Temuan> {
  const b = await db.queryOne<BarisTemuan>("SELECT * FROM aleta_integritas_temuan WHERE id = ?", [id]);
  if (!b) throw new ApiError(404, "Temuan tidak ditemukan.");
  if (!b.sha256) throw new ApiError(400, "Temuan ini tidak punya sidik berkas, jadi tidak dapat ditandai aman.");
  const teks = String(alasan ?? "").replace(/[<>]/g, "").trim();
  if (teks.length < 5) throw new ApiError(400, "Tulis alasan singkat (paling sedikit 5 huruf), mis. pembaruan resmi CMS.");
  await db.run(
    `INSERT INTO aleta_integritas_aman (folder_id, jalur, sha256, alasan, dibuat_oleh, dibuat_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (folder_id, jalur, sha256) DO UPDATE SET alasan = excluded.alasan, dibuat_oleh = excluded.dibuat_oleh, dibuat_at = excluded.dibuat_at`,
    [b.folder_id, b.jalur, b.sha256, teks.slice(0, 200), oleh.nama || oleh.id, kini.toISOString()]
  );
  // Semua temuan atas berkas + sha yang sama ikut selesai.
  await db.run(
    "UPDATE aleta_integritas_temuan SET status = 'ditangani', ditangani_oleh = ?, ditangani_at = ? WHERE folder_id = ? AND jalur = ? AND sha256 = ? AND status = 'baru'",
    [`${oleh.nama || oleh.id} (diketahui aman)`, kini.toISOString(), b.folder_id, b.jalur, b.sha256]
  );
  await catatAudit(db, oleh.id, "INTEGRITAS_AMAN", id, { jalur: b.jalur, jenis: b.jenis, alasan: teks.slice(0, 200) });
  return keTemuan({ ...b, status: "ditangani" }, await bacaPengaturanIntegritas(db));
}

// ---------------------------------------------------------------------------
// Halaman publik
// ---------------------------------------------------------------------------

export type AmbilHalaman = (url: string) => Promise<{ status: number; teks: string }>;

async function ambilHalamanBawaan(url: string): Promise<{ status: number; teks: string }> {
  const ctl = new AbortController();
  const jam = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (pemeriksa halaman satker)" } });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, teks: buf.subarray(0, BATAS_HALAMAN_BYTE).toString("utf8") };
  } finally {
    clearTimeout(jam);
  }
}

export async function pindaiHalamanPublik(db: AletaDatabase, p: Pick<PengaturanIntegritas, "halamanPublik">, opsi: { ambil?: AmbilHalaman; kini?: Date } = {}): Promise<{ diperiksa: number; temuanBaru: number; galat: string }> {
  const ambil = opsi.ambil ?? ambilHalamanBawaan;
  const kini = opsi.kini ?? new Date();
  let diperiksa = 0;
  let baru = 0;
  let galat = "";
  const dilihat = new Map<string, string>();
  for (const url of p.halamanPublik) {
    try {
      const h = await ambil(url);
      if (h.status >= 400) {
        galat ||= `${url} menjawab ${h.status}`;
        continue;
      }
      diperiksa += 1;
      dilihat.set(url, h.teks);
      const sha = crypto.createHash("sha256").update(h.teks).digest("hex");
      for (const d of periksaIsi(h.teks, { skrip: false, htaccess: false })) {
        const ada = await db.queryOne<BarisTemuan>("SELECT * FROM aleta_integritas_temuan WHERE folder_id = ? AND jalur = ? AND jenis = ? AND aturan = ?", [FOLDER_HALAMAN, url, d.jenis, d.aturan]);
        const t = kini.toISOString();
        if (!ada) {
          await db.run(
            `INSERT INTO aleta_integritas_temuan (id, folder_id, jalur, jenis, aturan, baris, sha256, ukuran, pertama_at, terakhir_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baru')`,
            [crypto.randomUUID(), FOLDER_HALAMAN, url, d.jenis, d.aturan, d.baris, sha, Buffer.byteLength(h.teks), t, t]
          );
          baru += 1;
        } else if (ada.status !== "baru") {
          await db.run("UPDATE aleta_integritas_temuan SET status = 'baru', ditangani_oleh = '', ditangani_at = '', diperingatkan_at = '', terakhir_at = ?, sha256 = ? WHERE id = ?", [t, sha, ada.id]);
          baru += 1;
        } else {
          await db.run("UPDATE aleta_integritas_temuan SET terakhir_at = ?, sha256 = ? WHERE id = ?", [t, sha, ada.id]);
        }
      }
    } catch (e) {
      galat ||= `${url}: ${(e as Error).name === "AbortError" ? "tidak menjawab dalam 10 detik" : "tidak dapat dijangkau"}`;
    }
  }
  // Halaman yang kini bersih: temuan lamanya ditutup.
  for (const [url, teksHalaman] of dilihat) {
    const terbuka = await db.queryAll<{ id: string; aturan: string }>("SELECT id, aturan FROM aleta_integritas_temuan WHERE folder_id = ? AND jalur = ? AND status = 'baru'", [FOLDER_HALAMAN, url]);
    if (terbuka.length === 0) continue;
    if (periksaIsi(teksHalaman, { skrip: false, htaccess: false }).length === 0) {
      await db.run("UPDATE aleta_integritas_temuan SET status = 'ditangani', ditangani_oleh = 'sistem (halaman sudah bersih)', ditangani_at = ? WHERE folder_id = ? AND jalur = ? AND status = 'baru'", [kini.toISOString(), FOLDER_HALAMAN, url]);
    }
  }
  return { diperiksa, temuanBaru: baru, galat };
}

// ---------------------------------------------------------------------------
// Peringatan WhatsApp
// ---------------------------------------------------------------------------

export type KirimPeringatan = (penerima: Array<{ id: string; nama: string; nomor: string }>, pesan: string, kunci: string) => Promise<{ terkirim: number; gagal: number }>;

/** Satu pesan ringkas untuk semua temuan yang belum pernah diperingatkan. Isi berkas TIDAK ikut. */
export async function kirimPeringatanIntegritas(
  db: AletaDatabase,
  opsi: { kini?: Date; kirim?: KirimPeringatan; penerima?: (db: AletaDatabase) => Promise<Array<{ id: string; nama: string; nomor: string }>> } = {}
): Promise<{ jumlah: number; terkirim: number } | null> {
  const p = await bacaPengaturanIntegritas(db, { tanpaSinggah: true });
  if (!p.aktif || !p.peringatanWa) return null;
  const kini = opsi.kini ?? new Date();
  const baris = await db.queryAll<BarisTemuan>("SELECT * FROM aleta_integritas_temuan WHERE status = 'baru' AND diperingatkan_at = ''");
  if (baris.length === 0) return null;
  const temuan = baris.map((b) => keTemuan(b, p)).sort((a, b) => BERAT[b.jenis] - BERAT[a.jenis]);

  const perJenis = new Map<string, number>();
  for (const t of temuan) perJenis.set(t.label, (perJenis.get(t.label) ?? 0) + 1);
  const contoh = temuan.slice(0, 5).map((t) => `- ${t.label}: ${t.folderNama}/${t.jalur.length > 80 ? `...${t.jalur.slice(-77)}` : t.jalur}`);
  const pesan =
    `PERINGATAN KEAMANAN website/server satker: penjaga integritas menemukan ${temuan.length} hal baru ` +
    `(${[...perJenis].map(([l, n]) => `${l} ${n}`).join(", ")}).\n${contoh.join("\n")}${temuan.length > 5 ? `\n...dan ${temuan.length - 5} lainnya.` : ""}\n` +
    "Buka Pusat Kendali > Penjaga Integritas untuk rinciannya. Tidak ada berkas yang diubah atau dihapus otomatis.";

  // 26 Okt 2026: satu pesan bersama Pusat kesehatan bila keduanya punya temuan di jendela yang sama.
  const penerimaSuntik = opsi.penerima;
  const hasil = await ajukanPeringatan(
    db,
    { sumber: "integritas", teks: pesan, penerima: "admin", kunci: `integritas-${kini.toISOString().slice(0, 16)}` },
    { kini, kirim: opsi.kirim, penerima: penerimaSuntik ? (d) => penerimaSuntik(d) : undefined }
  );
  // Ditandai sudah diperingatkan bila terkirim ke seseorang, tidak ada penerima sama sekali (agar tidak berulang tanpa ujung),
  // atau bagiannya ditahan untuk digabung (tersimpan, dikirim pada detak berikutnya).
  if (hasil.status === "terkirim" || hasil.status === "ditunda") {
    await db.run("UPDATE aleta_integritas_temuan SET diperingatkan_at = ? WHERE status = 'baru' AND diperingatkan_at = ''", [kini.toISOString()]);
  }
  return { jumlah: temuan.length, terkirim: hasil.terkirim };
}

// ---------------------------------------------------------------------------
// Pindai semua + detak
// ---------------------------------------------------------------------------

export type HasilPindaiSemua = { folder: RingkasPindai[]; halaman: { diperiksa: number; temuanBaru: number; galat: string } | null; peringatan: { jumlah: number; terkirim: number } | null };

const penguncian = globalThis as typeof globalThis & { __integritasSibuk?: boolean };

export function sedangMemindai(): boolean {
  return Boolean(penguncian.__integritasSibuk);
}

export async function pindaiSemua(
  db: AletaDatabase,
  opsi: { jenis?: JenisPindai | "otomatis"; kini?: () => Date; ambilHalaman?: AmbilHalaman; kirim?: KirimPeringatan; penerima?: (db: AletaDatabase) => Promise<Array<{ id: string; nama: string; nomor: string }>>; berhentiSetelahMs?: number } = {}
): Promise<HasilPindaiSemua> {
  if (penguncian.__integritasSibuk) throw new ApiError(409, "Pemindaian sedang berjalan. Tunggu sampai selesai.");
  penguncian.__integritasSibuk = true;
  try {
    const p = await bacaPengaturanIntegritas(db, { tanpaSinggah: true });
    const folder: RingkasPindai[] = [];
    for (const f of p.folder) folder.push(await pindaiFolder(db, f, p, opsi.jenis ?? "otomatis", { kini: opsi.kini, berhentiSetelahMs: opsi.berhentiSetelahMs }));
    let halaman: HasilPindaiSemua["halaman"] = null;
    if (p.halamanPublik.length) {
      const mulai = (opsi.kini ?? (() => new Date()))();
      halaman = await pindaiHalamanPublik(db, p, { ambil: opsi.ambilHalaman, kini: mulai });
      await db.run("INSERT INTO aleta_integritas_pindai (id, folder_id, jenis, mulai_at, selesai_at, jumlah_berkas, temuan_baru, galat) VALUES (?, ?, 'rutin', ?, ?, ?, ?, ?)", [
        crypto.randomUUID(),
        FOLDER_HALAMAN,
        mulai.toISOString(),
        (opsi.kini ?? (() => new Date()))().toISOString(),
        halaman.diperiksa,
        halaman.temuanBaru,
        halaman.galat.slice(0, 300),
      ]);
    }
    const peringatan = await kirimPeringatanIntegritas(db, { kini: (opsi.kini ?? (() => new Date()))(), kirim: opsi.kirim, penerima: opsi.penerima });
    return { folder, halaman, peringatan };
  } finally {
    penguncian.__integritasSibuk = false;
  }
}

async function pindaiTerakhir(db: AletaDatabase, folderId: string, jenis?: string): Promise<string> {
  const b = await db.queryOne<{ mulai_at: string }>(
    jenis ? "SELECT MAX(mulai_at) AS mulai_at FROM aleta_integritas_pindai WHERE folder_id = ? AND jenis = ?" : "SELECT MAX(mulai_at) AS mulai_at FROM aleta_integritas_pindai WHERE folder_id = ?",
    jenis ? [folderId, jenis] : [folderId]
  );
  return b?.mulai_at ?? "";
}

/** Satu detak (tiap menit): memindai bila saklar menyala dan sudah waktunya. Pindai penuh (hash ulang semua) tiap 7 hari. */
export async function detakIntegritas(db: AletaDatabase, opsi: { kini?: Date } & Omit<NonNullable<Parameters<typeof pindaiSemua>[1]>, "kini"> = {}): Promise<HasilPindaiSemua | null> {
  // Bagian peringatan yang ditahan untuk digabung dilepas di sini juga, walau pemindaian tidak jatuh tempo.
  await lepasPeringatanTertunda(db, { kirim: opsi.kirim, kini: opsi.kini }).catch(() => null);
  const p = await bacaPengaturanIntegritas(db);
  if (!p.aktif || (p.folder.length === 0 && p.halamanPublik.length === 0) || sedangMemindai()) return null;
  const kini = opsi.kini ?? new Date();
  const selangMs = p.selangMenit * 60_000;
  const sasaran = [...p.folder.map((f) => f.id), ...(p.halamanPublik.length ? [FOLDER_HALAMAN] : [])];
  let jatuhTempo = false;
  let penuh = false;
  for (const id of sasaran) {
    const terakhir = await pindaiTerakhir(db, id);
    if (!terakhir || kini.getTime() - Date.parse(terakhir) >= selangMs) jatuhTempo = true;
    if (id === FOLDER_HALAMAN || !terakhir) continue;
    const acuan = (await pindaiTerakhir(db, id, "penuh")) || (await pindaiTerakhir(db, id, "awal"));
    if (kini.getTime() - Date.parse(acuan || "1970-01-01") >= 7 * 86_400_000) penuh = true;
  }
  if (!jatuhTempo) return null;
  return pindaiSemua(db, { ...opsi, jenis: penuh ? "penuh" : "otomatis", kini: () => kini });
}

const wadah = globalThis as typeof globalThis & { __integritasDetak?: ReturnType<typeof setInterval> };

/** Dinyalakan instrumentation.ts. Matikan dengan ALETA_INTEGRITAS_DETAK=0. Saklar mati = detak tidak berbuat apa-apa. */
export function mulaiIntegritasBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_INTEGRITAS_DETAK === "0") return;
  if (wadah.__integritasDetak) return;
  wadah.__integritasDetak = setInterval(() => {
    void (async () => {
      try {
        await detakIntegritas(await getDb());
      } catch (e) {
        console.error("[Integritas] detak gagal:", e instanceof Error ? e.message : e);
      }
    })();
  }, 60_000);
  wadah.__integritasDetak.unref?.();
}

// ---------------------------------------------------------------------------
// Ringkasan untuk Pusat kesehatan
// ---------------------------------------------------------------------------

export type RingkasIntegritas = {
  aktif: boolean;
  folder: number;
  halaman: number;
  temuanBaru: number;
  perJenis: Array<{ label: string; jumlah: number }>;
  pindaiTerakhir: string;
  galatTerakhir: string;
};

export async function ringkasIntegritas(db: AletaDatabase): Promise<RingkasIntegritas> {
  const p = await bacaPengaturanIntegritas(db);
  const baris = await db.queryAll<{ jenis: string; n: number | string }>("SELECT jenis, COUNT(*) AS n FROM aleta_integritas_temuan WHERE status = 'baru' GROUP BY jenis");
  const terakhir = await db.queryOne<{ mulai_at: string; galat: string }>("SELECT mulai_at, galat FROM aleta_integritas_pindai ORDER BY mulai_at DESC LIMIT 1");
  return {
    aktif: p.aktif,
    folder: p.folder.length,
    halaman: p.halamanPublik.length,
    temuanBaru: baris.reduce((a, b) => a + Number(b.n), 0),
    perJenis: baris.map((b) => ({ label: LABEL_JENIS[b.jenis as JenisTemuan] ?? b.jenis, jumlah: Number(b.n) })),
    pindaiTerakhir: terakhir?.mulai_at ?? "",
    galatTerakhir: terakhir?.galat ?? "",
  };
}
