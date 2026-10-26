/**
 * ============================================================================
 * CATATAN GALAT (E2, admin 3 - 25 Okt 2026)
 * ============================================================================
 *
 * Galat server (rute API), peramban (halaman portal), dan ekstensi
 * dikelompokkan per SIDIK - sha256 dari sumber + jenis + pesan yang sudah
 * dinormalkan + lokasi - sehingga seribu kejadian yang sama menjadi satu
 * baris dengan jumlah. Rincian per kejadian (halaman, akun, peramban, versi,
 * potongan stack) disimpan paling banyak 50 per kelompok per jam dan 90 hari.
 *
 * YANG TIDAK PERNAH MASUK: sandi, token, kuki, alamat dengan kueri, surel,
 * nomor 16 digit (NIK), nomor WhatsApp. Pembersihan dilakukan di sini SEBELUM
 * disimpan, bukan saat ditampilkan. Pencatat tidak pernah melempar galat:
 * catatan yang gagal tertulis tidak boleh menjatuhkan permintaan yang sedang
 * dilayani.
 */
import { createHash, randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

export type SumberGalat = "server" | "peramban" | "ekstensi";
export const SUMBER_GALAT: readonly SumberGalat[] = ["server", "peramban", "ekstensi"];

export const RETENSI_GALAT_HARI = 90;
/** Rincian kejadian per kelompok per jam; selebihnya hanya menaikkan jumlah. */
export const BATAS_KEJADIAN_PER_JAM = 50;
/** Batas kasar kejadian baru per menit untuk seluruh sistem (banjir galat tidak membanjiri basis data). */
export const BATAS_CATAT_PER_MENIT = 120;

export type MasukanGalat = {
  sumber: SumberGalat;
  jenis?: string;
  pesan: string;
  lokasi?: string;
  halaman?: string;
  stack?: string;
  akunId?: string;
  akunNama?: string;
  peramban?: string;
  versi?: string;
};

export type KelompokGalat = {
  id: string;
  sidik: string;
  sumber: SumberGalat;
  jenis: string;
  pesan: string;
  lokasi: string;
  jumlah: number;
  pertamaAt: string;
  terakhirAt: string;
  status: "baru" | "ditangani";
  tanganiOleh: string;
  tanganiAt: string;
  catatan: string;
};

export type KejadianGalat = {
  id: string;
  waktu: string;
  halaman: string;
  akunId: string;
  akunNama: string;
  peramban: string;
  versi: string;
  potonganStack: string;
};

// ---------------------------------------------------------------------------
// Pembersihan
// ---------------------------------------------------------------------------

const POLA_RAHASIA: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [disamarkan]"],
  [/\b(password|passwd|sandi|token|secret|api[_-]?key|authorization|cookie|kuki)\s*[=:]\s*[^\s,;&"']+/gi, "$1=[disamarkan]"],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[surel]"],
  [/\b\d{16}\b/g, "[nomor16]"],
  [/(?<!\d)(?:\+?62|0)8\d{8,12}\b/g, "[telepon]"],
  [/\b[A-Fa-f0-9]{32,}\b/g, "[hex]"],
  [/\b[A-Za-z0-9_-]{40,}\b/g, "[panjang]"],
];

/** Alamat: buang kueri dan fragmen (bisa memuat tiket, nomor perkara, token). */
export function bersihkanAlamat(alamat: unknown): string {
  const teks = String(alamat ?? "").trim();
  if (!teks) return "";
  const tanpaKueri = teks.replace(/[?#].*$/, "");
  return tanpaKueri.slice(0, 300);
}

export function bersihkanTeksGalat(teks: unknown, maks = 600): string {
  let hasil = String(teks ?? "").replace(/\u0000/g, "");
  // Alamat penuh di dalam pesan: buang kuerinya.
  hasil = hasil.replace(/(https?:\/\/[^\s"'<>)]+?)[?#][^\s"'<>)]*/gi, "$1");
  for (const [pola, ganti] of POLA_RAHASIA) hasil = hasil.replace(pola, ganti);
  return hasil.trim().slice(0, maks);
}

/** Potongan stack: paling banyak 8 baris, alamat berkas tanpa kueri, rahasia dibuang. */
export function bersihkanStack(stack: unknown): string {
  const baris = String(stack ?? "")
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((b) => bersihkanTeksGalat(b, 240));
  return baris.join("\n").slice(0, 1500);
}

/** Bentuk pesan untuk SIDIK: angka dan id acak disamakan supaya kejadian serupa satu kelompok. */
export function normalkanPesan(pesan: string): string {
  return pesan
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\[(hex|panjang|surel|telepon|nomor16)\]/g, "<$1>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export function sidikGalat(m: Pick<MasukanGalat, "sumber" | "jenis" | "pesan" | "lokasi">): string {
  const dasar = [
    m.sumber,
    String(m.jenis ?? "").slice(0, 80),
    normalkanPesan(bersihkanTeksGalat(m.pesan, 400)),
    bersihkanAlamat(m.lokasi).replace(/\/\d+(?=\/|$)/g, "/#"),
  ].join("|");
  return createHash("sha256").update(dasar).digest("hex");
}

// ---------------------------------------------------------------------------
// Pencatat
// ---------------------------------------------------------------------------

const jendela = { menit: 0, jumlah: 0 };
const kejadianTerakhir = new Map<string, { jam: number; jumlah: number }>();
let pangkasTerakhir = 0;

/** Hanya untuk uji. */
export function setelUlangPencatatGalat() {
  jendela.menit = 0;
  jendela.jumlah = 0;
  kejadianTerakhir.clear();
  pangkasTerakhir = 0;
}

function baris2kelompok(b: Record<string, unknown>): KelompokGalat {
  return {
    id: String(b.id),
    sidik: String(b.sidik),
    sumber: String(b.sumber) as SumberGalat,
    jenis: String(b.jenis ?? ""),
    pesan: String(b.pesan ?? ""),
    lokasi: String(b.lokasi ?? ""),
    jumlah: Number(b.jumlah ?? 0),
    pertamaAt: String(b.pertama_at),
    terakhirAt: String(b.terakhir_at),
    status: b.status === "ditangani" ? "ditangani" : "baru",
    tanganiOleh: String(b.ditangani_oleh ?? ""),
    tanganiAt: String(b.ditangani_at ?? ""),
    catatan: String(b.catatan ?? ""),
  };
}

/**
 * Mencatat satu kejadian galat. TIDAK PERNAH melempar. Mengembalikan id
 * kelompok, atau null bila ditolak (sumber tidak sah, banjir, atau gagal tulis).
 */
export async function catatGalat(db: AletaDatabase, masukan: MasukanGalat, kini: Date = new Date()): Promise<string | null> {
  try {
    if (!SUMBER_GALAT.includes(masukan.sumber)) return null;
    const pesan = bersihkanTeksGalat(masukan.pesan, 600);
    if (!pesan) return null;

    const menit = Math.floor(kini.getTime() / 60_000);
    if (jendela.menit !== menit) {
      jendela.menit = menit;
      jendela.jumlah = 0;
    }
    jendela.jumlah += 1;
    if (jendela.jumlah > BATAS_CATAT_PER_MENIT) return null;

    const jenis = String(masukan.jenis ?? "").replace(/[^\w .$:-]/g, "").slice(0, 80);
    const lokasi = bersihkanAlamat(masukan.lokasi);
    const sidik = sidikGalat({ sumber: masukan.sumber, jenis, pesan, lokasi });
    const waktu = kini.toISOString();

    let kelompok = await db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_catatan_galat WHERE sidik = ?", [sidik]);
    if (kelompok) {
      // Kambuh sesudah ditandai ditangani: dibuka kembali.
      await db.run(
        "UPDATE aleta_catatan_galat SET jumlah = jumlah + 1, terakhir_at = ?, status = 'baru' WHERE sidik = ?",
        [waktu, sidik]
      );
    } else {
      const id = `galat-${sidik.slice(0, 16)}`;
      try {
        await db.run(
          `INSERT INTO aleta_catatan_galat (id, sidik, sumber, jenis, pesan, lokasi, jumlah, pertama_at, terakhir_at, status)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'baru')`,
          [id, sidik, masukan.sumber, jenis, pesan, lokasi, waktu, waktu]
        );
      } catch {
        // Kelompok yang sama baru dibuat permintaan lain.
        await db.run("UPDATE aleta_catatan_galat SET jumlah = jumlah + 1, terakhir_at = ?, status = 'baru' WHERE sidik = ?", [waktu, sidik]);
      }
      kelompok = await db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_catatan_galat WHERE sidik = ?", [sidik]);
    }
    const galatId = String(kelompok?.id ?? `galat-${sidik.slice(0, 16)}`);

    const jam = Math.floor(kini.getTime() / 3_600_000);
    const hitung = kejadianTerakhir.get(galatId);
    const sudah = hitung && hitung.jam === jam ? hitung.jumlah : 0;
    if (sudah < BATAS_KEJADIAN_PER_JAM) {
      kejadianTerakhir.set(galatId, { jam, jumlah: sudah + 1 });
      await db.run(
        `INSERT INTO aleta_catatan_galat_kejadian (id, galat_id, waktu, halaman, akun_id, akun_nama, peramban, versi, potongan_stack)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `kej-${randomUUID()}`,
          galatId,
          waktu,
          bersihkanAlamat(masukan.halaman),
          String(masukan.akunId ?? "").slice(0, 80),
          String(masukan.akunNama ?? "").slice(0, 120),
          String(masukan.peramban ?? "").replace(/[^\w .,/;:()-]/g, "").slice(0, 160),
          String(masukan.versi ?? "").replace(/[^\w.+-]/g, "").slice(0, 40),
          bersihkanStack(masukan.stack),
        ]
      );
    }

    if (kini.getTime() - pangkasTerakhir > 3_600_000) {
      pangkasTerakhir = kini.getTime();
      await pangkasGalat(db, kini);
    }
    return galatId;
  } catch {
    return null;
  }
}

/** Membuang kejadian dan kelompok yang terakhir terlihat lebih dari 90 hari lalu. */
export async function pangkasGalat(db: AletaDatabase, kini: Date = new Date(), hari = RETENSI_GALAT_HARI) {
  const batas = new Date(kini.getTime() - hari * 86_400_000).toISOString();
  await db.run("DELETE FROM aleta_catatan_galat_kejadian WHERE waktu < ?", [batas]);
  await db.run(
    "DELETE FROM aleta_catatan_galat_kejadian WHERE galat_id IN (SELECT id FROM aleta_catatan_galat WHERE terakhir_at < ?)",
    [batas]
  );
  await db.run("DELETE FROM aleta_catatan_galat WHERE terakhir_at < ?", [batas]);
}

// ---------------------------------------------------------------------------
// Pembacaan dan pengelolaan
// ---------------------------------------------------------------------------

export async function daftarGalat(
  db: AletaDatabase,
  saring: { sumber?: string; status?: string; batas?: number } = {}
): Promise<KelompokGalat[]> {
  const syarat: string[] = [];
  const param: string[] = [];
  if (saring.sumber && SUMBER_GALAT.includes(saring.sumber as SumberGalat)) {
    syarat.push("sumber = ?");
    param.push(saring.sumber);
  }
  if (saring.status === "baru" || saring.status === "ditangani") {
    syarat.push("status = ?");
    param.push(saring.status);
  }
  const batas = Math.min(500, Math.max(1, Math.floor(saring.batas ?? 200)));
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_catatan_galat ${syarat.length ? `WHERE ${syarat.join(" AND ")}` : ""} ORDER BY terakhir_at DESC LIMIT ${batas}`,
    param
  );
  return baris.map(baris2kelompok);
}

export async function rincianGalat(db: AletaDatabase, id: string): Promise<{ kelompok: KelompokGalat; kejadian: KejadianGalat[] } | null> {
  const k = await db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_catatan_galat WHERE id = ?", [id]);
  if (!k) return null;
  const kej = await db.queryAll<Record<string, unknown>>(
    "SELECT * FROM aleta_catatan_galat_kejadian WHERE galat_id = ? ORDER BY waktu DESC LIMIT 50",
    [id]
  );
  return {
    kelompok: baris2kelompok(k),
    kejadian: kej.map((b) => ({
      id: String(b.id),
      waktu: String(b.waktu),
      halaman: String(b.halaman ?? ""),
      akunId: String(b.akun_id ?? ""),
      akunNama: String(b.akun_nama ?? ""),
      peramban: String(b.peramban ?? ""),
      versi: String(b.versi ?? ""),
      potonganStack: String(b.potongan_stack ?? ""),
    })),
  };
}

export async function tandaiGalat(
  db: AletaDatabase,
  id: string,
  oleh: { id: string; nama: string },
  ditangani: boolean,
  catatan = "",
  kini: Date = new Date()
): Promise<boolean> {
  const ada = await db.queryOne<{ id: string }>("SELECT id FROM aleta_catatan_galat WHERE id = ?", [id]);
  if (!ada) return false;
  await db.run(
    "UPDATE aleta_catatan_galat SET status = ?, ditangani_oleh = ?, ditangani_at = ?, catatan = ? WHERE id = ?",
    [ditangani ? "ditangani" : "baru", ditangani ? oleh.nama || oleh.id : "", ditangani ? kini.toISOString() : "", String(catatan).slice(0, 400), id]
  );
  return true;
}

export type RingkasGalat = {
  kelompokBaru: number;
  kejadian24Jam: number;
  terakhirAt: string;
  teratas: Array<{ id: string; sumber: string; pesan: string; jumlah: number; terakhirAt: string }>;
};

/** Untuk Pusat kesehatan: galat yang belum ditangani dan kejadian 24 jam terakhir. */
export async function ringkasGalat(db: AletaDatabase, kini: Date = new Date()): Promise<RingkasGalat> {
  const batas = new Date(kini.getTime() - 86_400_000).toISOString();
  const baru = await db.queryOne<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM aleta_catatan_galat WHERE status = 'baru' AND terakhir_at >= ?",
    [batas]
  );
  const kej = await db.queryOne<{ n: number | string }>("SELECT COUNT(*) AS n FROM aleta_catatan_galat_kejadian WHERE waktu >= ?", [batas]);
  const atas = await db.queryAll<Record<string, unknown>>(
    "SELECT id, sumber, pesan, jumlah, terakhir_at FROM aleta_catatan_galat WHERE status = 'baru' AND terakhir_at >= ? ORDER BY jumlah DESC, terakhir_at DESC LIMIT 5",
    [batas]
  );
  const akhir = await db.queryOne<{ t: string | null }>("SELECT MAX(terakhir_at) AS t FROM aleta_catatan_galat");
  return {
    kelompokBaru: Number(baru?.n ?? 0),
    kejadian24Jam: Number(kej?.n ?? 0),
    terakhirAt: String(akhir?.t ?? ""),
    teratas: atas.map((b) => ({
      id: String(b.id),
      sumber: String(b.sumber),
      pesan: String(b.pesan),
      jumlah: Number(b.jumlah),
      terakhirAt: String(b.terakhir_at),
    })),
  };
}

/** Teks siap salin untuk pengembang: tanpa nama akun, tanpa data perkara. */
export function teksUntukPengembang(k: KelompokGalat, kejadian: KejadianGalat[]): string {
  const baris = [
    `Galat ${k.sumber}: ${k.jenis || "(tanpa jenis)"}`,
    `Pesan: ${k.pesan}`,
    `Lokasi: ${k.lokasi || "-"}`,
    `Jumlah kejadian: ${k.jumlah} (pertama ${k.pertamaAt}, terakhir ${k.terakhirAt})`,
    `Status: ${k.status}`,
  ];
  const versi = [...new Set(kejadian.map((e) => e.versi).filter(Boolean))];
  const peramban = [...new Set(kejadian.map((e) => e.peramban).filter(Boolean))].slice(0, 3);
  if (versi.length) baris.push(`Versi: ${versi.join(", ")}`);
  if (peramban.length) baris.push(`Peramban: ${peramban.join(" | ")}`);
  const halaman = [...new Set(kejadian.map((e) => e.halaman).filter(Boolean))].slice(0, 5);
  if (halaman.length) baris.push(`Halaman: ${halaman.join(", ")}`);
  const stack = kejadian.find((e) => e.potonganStack)?.potonganStack;
  if (stack) baris.push("Potongan stack:", stack);
  return baris.join("\n");
}

// ---------------------------------------------------------------------------
// Galat server dari handleRouteError
// ---------------------------------------------------------------------------

/** Rute API dari tumpukan panggilan ("app/api/x/y/route" -> "/api/x/y"); kosong bila tidak terbaca. */
export function lokasiRuteDariStack(stack: unknown): string {
  const m = /app\/(api\/[\w\-./[\]]+?)\/route\.(?:js|ts)/.exec(String(stack ?? "").split("\\").join("/"));
  return m ? `/${m[1]}` : "";
}

/**
 * Dipanggil handleRouteError untuk galat 5xx yang tidak terduga. Berjalan di
 * latar (tidak ditunggu), tidak pernah melempar, dan dilewati saat uji kecuali
 * ALETA_GALAT_CATAT_UJI=1.
 */
export function catatGalatServerLatar(error: unknown, lokasi?: string) {
  if (process.env.NODE_ENV === "test" && process.env.ALETA_GALAT_CATAT_UJI !== "1") return;
  void (async () => {
    try {
      const { getDatabase } = await import("@/server/db/client");
      const db = await getDatabase();
      const e = error instanceof Error ? error : null;
      await catatGalat(db, {
        sumber: "server",
        jenis: e?.name || typeof error,
        pesan: e?.message || String(error ?? ""),
        stack: e?.stack,
        lokasi: lokasi || lokasiRuteDariStack(e?.stack),
      });
    } catch {
      /* pencatat tidak boleh menjatuhkan permintaan */
    }
  })();
}
