import crypto from "node:crypto";

import { type AletaDatabase } from "@/server/db/client";
import { daftarSesiAktif, cabutSesi, kelompokkanPerPerangkat, type PerangkatAktif } from "@/server/modules/perangkat/sesi";
import { bacaUa, namaPerangkat } from "@/server/modules/perangkat/ua";

/**
 * ============================================================================
 * BATAS PERANGKAT YANG BOLEH MASUK BERSAMAAN (23 Okt 2026)
 * ============================================================================
 *
 * Kebijakan per PERAN (roleId) dengan pengecualian per AKUN:
 *   - akun menang atas peran (selama berlaku_sampai belum lewat);
 *   - akun dengan beberapa peran (peran utama + peran tambahan) memakai batas
 *     TERBESAR di antara peran yang punya kebijakan; 0 = tanpa batas = terbesar.
 *     Peran tanpa kebijakan tidak ikut menimbang (bukan "tanpa batas"), supaya
 *     peran tambahan seperti kasir tidak membuka batas peran utamanya;
 *   - tanpa kebijakan sama sekali = TANPA BATAS (bawaan sesudah pemasangan).
 *
 * Yang dihitung PERANGKAT (kuki aleta_perangkat) dengan sesi aktif, bukan
 * jumlah sesi: masuk ulang dari perangkat yang sama tidak menambah hitungan.
 * MAC tidak pernah dipakai di sini - itu klaim klien.
 *
 * SUPER ADMIN TIDAK PERNAH TERKUNCI: untuk akun yang memegang peran
 * super-admin, perilaku "tolak" diganti "keluarkan-terlama" saat ditegakkan,
 * dan menyimpan "tolak" untuk peran/akun super-admin ditolak. Masuk selalu
 * berhasil; yang tergeser adalah perangkat super admin yang paling lama diam.
 */

export type Perilaku = "tolak" | "keluarkan-terlama";
export const PERILAKU: readonly Perilaku[] = ["tolak", "keluarkan-terlama"];

export type BarisKebijakan = {
  id: string;
  cakupan: "peran" | "akun";
  sasaran: string;
  maks: number;
  perilaku: Perilaku;
  berlaku_sampai: string;
  alasan: string;
  diubah_oleh: string;
  diubah_nama: string;
  diubah_pada: string;
};

export type Kebijakan = {
  maks: number;
  perilaku: Perilaku;
  sumber: "akun" | "peran" | "bawaan";
  sasaran: string;
  dipaksaSuperAdmin: boolean;
};

function perilakuSah(v: unknown): Perilaku {
  return v === "tolak" ? "tolak" : "keluarkan-terlama";
}

/** Keputusan murni: peran akun + baris kebijakan -> kebijakan yang berlaku. */
export function pilihKebijakan(
  akun: { id: string; peran: string[] },
  baris: BarisKebijakan[],
  sekarang = new Date()
): Kebijakan {
  const superAdmin = akun.peran.includes("super-admin");
  const paksa = (k: Kebijakan): Kebijakan =>
    superAdmin && k.perilaku === "tolak" ? { ...k, perilaku: "keluarkan-terlama", dipaksaSuperAdmin: true } : k;

  const pengecualian = baris.find(
    (b) =>
      b.cakupan === "akun" &&
      b.sasaran === akun.id &&
      (!b.berlaku_sampai || new Date(b.berlaku_sampai).getTime() > sekarang.getTime())
  );
  if (pengecualian) {
    return paksa({ maks: Math.max(0, Number(pengecualian.maks) || 0), perilaku: perilakuSah(pengecualian.perilaku), sumber: "akun", sasaran: akun.id, dipaksaSuperAdmin: false });
  }

  const milikPeran = baris.filter((b) => b.cakupan === "peran" && akun.peran.includes(b.sasaran));
  if (milikPeran.length === 0) return { maks: 0, perilaku: "keluarkan-terlama", sumber: "bawaan", sasaran: "", dipaksaSuperAdmin: false };
  const tanpaBatas = milikPeran.find((b) => (Number(b.maks) || 0) <= 0);
  if (tanpaBatas) return { maks: 0, perilaku: "keluarkan-terlama", sumber: "peran", sasaran: tanpaBatas.sasaran, dipaksaSuperAdmin: false };
  const terbesar = [...milikPeran].sort(
    (a, b) => Number(b.maks) - Number(a.maks) || (perilakuSah(a.perilaku) === "keluarkan-terlama" ? -1 : 1)
  )[0];
  return paksa({ maks: Number(terbesar.maks), perilaku: perilakuSah(terbesar.perilaku), sumber: "peran", sasaran: terbesar.sasaran, dipaksaSuperAdmin: false });
}

export async function bacaKebijakanSemua(db: AletaDatabase) {
  return db.queryAll<BarisKebijakan>(
    `SELECT id, cakupan, sasaran, maks, perilaku, berlaku_sampai, alasan, diubah_oleh, diubah_nama, diubah_pada
     FROM aleta_batas_perangkat ORDER BY cakupan, sasaran`,
    []
  );
}

export async function peranAkun(db: AletaDatabase, userId: string): Promise<string[]> {
  const u = await db.queryOne<{ role_id: string | null; additional_role_ids_json: string | null }>(
    "SELECT role_id, additional_role_ids_json FROM users WHERE id = ?",
    [userId]
  );
  if (!u) return [];
  let tambahan: string[] = [];
  try {
    const j = JSON.parse(String(u.additional_role_ids_json ?? "[]"));
    if (Array.isArray(j)) tambahan = j.map(String);
  } catch {
    tambahan = [];
  }
  return [...new Set([String(u.role_id ?? ""), ...tambahan].filter(Boolean))];
}

export async function kebijakanUntuk(db: AletaDatabase, userId: string, sekarang = new Date()) {
  const [peran, baris] = await Promise.all([peranAkun(db, userId), bacaKebijakanSemua(db)]);
  return pilihKebijakan({ id: userId, peran }, baris, sekarang);
}

export async function simpanKebijakan(
  db: AletaDatabase,
  m: { cakupan: "peran" | "akun"; sasaran: string; maks: number; perilaku: Perilaku; berlakuSampai?: string; alasan?: string },
  oleh: { id: string; nama: string }
) {
  const sasaran = String(m.sasaran ?? "").trim();
  if (m.cakupan !== "peran" && m.cakupan !== "akun") throw new Error("Cakupan harus peran atau akun.");
  if (!sasaran) throw new Error("Peran/akun sasaran belum dipilih.");
  const maks = Math.round(Number(m.maks));
  if (!Number.isFinite(maks) || maks < 0 || maks > 50) throw new Error("Batas perangkat 0-50 (0 = tanpa batas).");
  if (!PERILAKU.includes(m.perilaku)) throw new Error("Perilaku saat penuh tidak dikenal.");
  const berlakuSampai = String(m.berlakuSampai ?? "").trim();
  if (berlakuSampai && Number.isNaN(new Date(berlakuSampai).getTime())) throw new Error("Tanggal berlaku sampai tidak terbaca.");
  if (m.perilaku === "tolak") {
    const superAdmin =
      m.cakupan === "peran" ? sasaran === "super-admin" : (await peranAkun(db, sasaran)).includes("super-admin");
    if (superAdmin) {
      throw new Error(
        "Super Admin tidak boleh memakai perilaku \"tolak\" supaya tidak pernah terkunci. Pakai \"keluarkan perangkat terlama\"."
      );
    }
  }
  if (m.cakupan === "akun") {
    const ada = await db.queryOne<{ id: string }>("SELECT id FROM users WHERE id = ?", [sasaran]);
    if (!ada) throw new Error("Akun sasaran tidak ditemukan.");
  }
  const kini = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO aleta_batas_perangkat (id, cakupan, sasaran, maks, perilaku, berlaku_sampai, alasan, diubah_oleh, diubah_nama, diubah_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cakupan, sasaran) DO UPDATE SET maks = excluded.maks, perilaku = excluded.perilaku,
         berlaku_sampai = excluded.berlaku_sampai, alasan = excluded.alasan, diubah_oleh = excluded.diubah_oleh,
         diubah_nama = excluded.diubah_nama, diubah_pada = excluded.diubah_pada`
    )
    .run(
      `bp-${crypto.randomUUID()}`,
      m.cakupan,
      sasaran,
      maks,
      m.perilaku,
      berlakuSampai ? new Date(berlakuSampai).toISOString() : "",
      String(m.alasan ?? "").slice(0, 300),
      oleh.id,
      oleh.nama,
      kini
    );
}

export async function hapusKebijakan(db: AletaDatabase, cakupan: "peran" | "akun", sasaran: string) {
  const r = await db.run("DELETE FROM aleta_batas_perangkat WHERE cakupan = ? AND sasaran = ?", [cakupan, sasaran]);
  return r.changes;
}

// ─── Ringkasan perangkat untuk layar ─────────────────────────────────────────

export type RingkasPerangkat = { perangkatId: string; nama: string; terakhirAktif: string; ip: string; jumlahSesi: number };

export async function ringkasPerangkat(db: AletaDatabase, userId: string, kelompok: PerangkatAktif[]): Promise<RingkasPerangkat[]> {
  const hasil: RingkasPerangkat[] = [];
  for (const k of kelompok) {
    const p = k.dikenal
      ? await db.queryOne<{ label: string; nama_komputer: string; nama_terbaca: string }>(
          "SELECT label, nama_komputer, nama_terbaca FROM aleta_perangkat WHERE perangkat_id = ? AND user_id = ?",
          [k.perangkatId, userId]
        )
      : undefined;
    const nama = p?.label || [p?.nama_komputer, p?.nama_terbaca].filter(Boolean).join(" · ") || namaPerangkat(bacaUa(k.agen));
    hasil.push({ perangkatId: k.perangkatId, nama, terakhirAktif: k.terakhirAktif, ip: k.ip, jumlahSesi: k.sesi.length });
  }
  return hasil;
}

// ─── Penegakan ───────────────────────────────────────────────────────────────

export type HasilBatas =
  | { lolos: true; kebijakan: Kebijakan; dikeluarkan: string[] }
  | { lolos: false; kebijakan: Kebijakan; perangkat: PerangkatAktif[] };

/**
 * Dipanggil SEBELUM sesi baru dibuat (sesudah password terbukti). Tidak
 * mencabut apa pun bila ditolak.
 */
export async function tegakkanBatas(
  db: AletaDatabase,
  m: { userId: string; perangkatId: string; sekarang?: Date }
): Promise<HasilBatas> {
  const sekarang = m.sekarang ?? new Date();
  const kebijakan = await kebijakanUntuk(db, m.userId, sekarang);
  if (kebijakan.maks <= 0) return { lolos: true, kebijakan, dikeluarkan: [] };
  const lain = kelompokkanPerPerangkat(await daftarSesiAktif(db, m.userId, sekarang)).filter(
    (p) => p.perangkatId !== m.perangkatId
  );
  if (lain.length < kebijakan.maks) return { lolos: true, kebijakan, dikeluarkan: [] };
  if (kebijakan.perilaku === "tolak") return { lolos: false, kebijakan, perangkat: lain };

  const terlama = [...lain].sort((a, b) => (a.terakhirAktif < b.terakhirAktif ? -1 : 1)).slice(0, lain.length - kebijakan.maks + 1);
  for (const p of terlama) {
    await cabutSesi(db, {
      userId: m.userId,
      sessionIds: p.sesi.map((s) => s.sessionId),
      alasan: "batas-perangkat",
      pelaku: { id: "", nama: "Sistem (batas perangkat)" },
    });
  }
  return { lolos: true, kebijakan, dikeluarkan: terlama.map((p) => p.perangkatId) };
}

// ─── Tiket "pilih perangkat yang dikeluarkan" ────────────────────────────────

export const MASA_TIKET_MS = 5 * 60 * 1000;

function hashTiket(tiket: string) {
  return crypto.createHash("sha256").update(`aleta-tiket-perangkat:${tiket}`).digest("hex");
}

/** Tiket mentah dipulangkan SEKALI ke layar masuk; yang disimpan hanya hash-nya. */
export async function buatTiket(db: AletaDatabase, m: { userId: string; perangkatId: string; jalur: string; sekarang?: Date }) {
  const sekarang = m.sekarang ?? new Date();
  const tiket = crypto.randomBytes(24).toString("base64url");
  await db
    .prepare(
      `INSERT INTO aleta_tiket_perangkat (id, user_id, perangkat_id, jalur, dibuat_pada, kedaluwarsa_pada)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(hashTiket(tiket), m.userId, m.perangkatId, m.jalur, sekarang.toISOString(), new Date(sekarang.getTime() + MASA_TIKET_MS).toISOString());
  return tiket;
}

export type PeriksaTiket = { sah: true; userId: string; jalur: string } | { sah: false; sebab: "tidak-dikenal" | "kedaluwarsa" | "sudah-dipakai" | "perangkat-lain" };

export async function periksaTiket(db: AletaDatabase, tiket: string, perangkatId: string, sekarang = new Date()): Promise<PeriksaTiket> {
  const b = await db.queryOne<{ user_id: string; perangkat_id: string; jalur: string; kedaluwarsa_pada: string; dipakai_pada: string }>(
    "SELECT user_id, perangkat_id, jalur, kedaluwarsa_pada, dipakai_pada FROM aleta_tiket_perangkat WHERE id = ?",
    [hashTiket(String(tiket ?? ""))]
  );
  if (!b) return { sah: false, sebab: "tidak-dikenal" };
  if (b.dipakai_pada) return { sah: false, sebab: "sudah-dipakai" };
  if (new Date(b.kedaluwarsa_pada).getTime() <= sekarang.getTime()) return { sah: false, sebab: "kedaluwarsa" };
  if (!perangkatId || b.perangkat_id !== perangkatId) return { sah: false, sebab: "perangkat-lain" };
  return { sah: true, userId: b.user_id, jalur: b.jalur };
}

/** Menandai tiket terpakai - atomik: hanya pemanggil pertama yang mendapat true. */
export async function pakaiTiket(db: AletaDatabase, tiket: string, sekarang = new Date()) {
  const r = await db.run("UPDATE aleta_tiket_perangkat SET dipakai_pada = ? WHERE id = ? AND dipakai_pada = ''", [
    sekarang.toISOString(),
    hashTiket(String(tiket ?? "")),
  ]);
  return r.changes === 1;
}

export const PESAN_TIKET: Record<string, string> = {
  "tidak-dikenal": "Tiket pilih perangkat tidak dikenal. Silakan masuk lagi.",
  kedaluwarsa: "Waktu memilih perangkat (5 menit) sudah habis. Silakan masuk lagi.",
  "sudah-dipakai": "Tiket ini sudah dipakai. Silakan masuk lagi.",
  "perangkat-lain": "Tiket ini milik perangkat lain. Silakan masuk lagi dari perangkat ini.",
};
