import { type AletaDatabase } from "@/server/db/client";
import { catatPeristiwaAman } from "@/server/modules/perangkat/jejak";
import { rujukanSesi } from "@/server/modules/perangkat/jaringan";
import { putuskanSesi, type BarisSesi } from "@/server/modules/portal/sesi-portal";

/**
 * ============================================================================
 * SESI AKTIF PER PERANGKAT, DAN PENCABUTANNYA (23 Okt 2026)
 * ============================================================================
 *
 * "Aktif" = baris sessions yang belum lewat expires_at Better Auth DAN masih
 * berlaku menurut aturan sesi-portal.ts (diingat / dua jam / versi aplikasi).
 * Yang sudah tidak berlaku tidak dihitung walau barisnya masih ada.
 *
 * Sesi yang lahir sebelum fitur ini tidak punya peta perangkat; masing-masing
 * dihitung sebagai SATU perangkat tak dikenal ("sesi:<ref>") supaya tetap
 * terlihat dan dapat dicabut. Dua jam sesudah pemasangan semuanya sudah
 * berganti, kecuali yang diingat.
 *
 * Pencabutan menghapus baris sessions (Better Auth tidak memakai kuki
 * singgahan sesi di ALETA, jadi permintaan berikutnya langsung 401), penanda
 * sesi_portal, dan peta perangkat - lalu mencatat SESI_DICABUT.
 */

export type SesiAktif = {
  sessionId: string;
  sesiRef: string;
  perangkatId: string;
  dikenal: boolean;
  jalur: string;
  ip: string;
  agen: string;
  ingat: boolean;
  dibuatPada: string;
  terakhirAktif: string;
};

type BarisGabung = {
  id: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  perangkat_id: string | null;
  jalur: string | null;
  ip_terakhir: string | null;
  terakhir_aktif: string | null;
  diingat: number | null;
  versi_aplikasi: string | null;
};

export async function daftarSesiAktif(db: AletaDatabase, userId: string, sekarang = new Date()): Promise<SesiAktif[]> {
  const baris = await db.queryAll<BarisGabung>(
    `SELECT s.id, s.created_at, s.updated_at, s.expires_at, s.ip_address, s.user_agent,
            sp.perangkat_id, sp.jalur, sp.ip_terakhir, sp.terakhir_aktif,
            p.diingat, p.versi_aplikasi
     FROM sessions s
     LEFT JOIN aleta_sesi_perangkat sp ON sp.session_id = s.id
     LEFT JOIN sesi_portal p ON p.session_id = s.id
     WHERE s.user_id = ?`,
    [userId]
  );
  const hasil: SesiAktif[] = [];
  for (const b of baris) {
    if (new Date(b.expires_at).getTime() <= sekarang.getTime()) continue;
    const penanda: BarisSesi | undefined =
      b.diingat === null || b.diingat === undefined ? undefined : { diingat: Number(b.diingat), versi_aplikasi: String(b.versi_aplikasi ?? "") };
    const putusan = putuskanSesi(penanda, b.created_at, sekarang);
    if (!putusan.berlaku) continue;
    const ref = rujukanSesi(b.id);
    hasil.push({
      sessionId: b.id,
      sesiRef: ref,
      perangkatId: b.perangkat_id || `sesi:${ref}`,
      dikenal: Boolean(b.perangkat_id),
      jalur: String(b.jalur ?? ""),
      ip: String(b.ip_terakhir || b.ip_address || ""),
      agen: String(b.user_agent ?? ""),
      ingat: putusan.diingat,
      dibuatPada: String(b.created_at),
      terakhirAktif: String(b.terakhir_aktif || b.updated_at || b.created_at),
    });
  }
  return hasil;
}

export type PerangkatAktif = {
  perangkatId: string;
  dikenal: boolean;
  terakhirAktif: string;
  ip: string;
  agen: string;
  sesi: SesiAktif[];
};

/** Sesi aktif dikelompokkan per perangkat, terbaru di atas. */
export function kelompokkanPerPerangkat(sesi: SesiAktif[]): PerangkatAktif[] {
  const peta = new Map<string, PerangkatAktif>();
  for (const s of sesi) {
    const ada = peta.get(s.perangkatId);
    if (!ada) {
      peta.set(s.perangkatId, { perangkatId: s.perangkatId, dikenal: s.dikenal, terakhirAktif: s.terakhirAktif, ip: s.ip, agen: s.agen, sesi: [s] });
      continue;
    }
    ada.sesi.push(s);
    if (s.terakhirAktif > ada.terakhirAktif) {
      ada.terakhirAktif = s.terakhirAktif;
      ada.ip = s.ip;
      ada.agen = s.agen;
    }
  }
  return [...peta.values()].sort((a, b) => (a.terakhirAktif < b.terakhirAktif ? 1 : -1));
}

export type Pelaku = { id: string; nama: string } | null;

export type AlasanCabut =
  | "oleh-diri"
  | "oleh-admin"
  | "batas-perangkat"
  | "pilih-perangkat"
  | "login-ulang-perangkat-sama"
  | "akun-diblokir"
  | "password-direset"
  | "peran-diganti";

const TEKS_ALASAN: Record<AlasanCabut, string> = {
  "oleh-diri": "dikeluarkan pemilik akun",
  "oleh-admin": "dikeluarkan admin",
  "batas-perangkat": "batas perangkat: perangkat terlama dikeluarkan otomatis",
  "pilih-perangkat": "batas perangkat: dipilih pemilik akun saat masuk",
  "login-ulang-perangkat-sama": "masuk ulang dari perangkat yang sama",
  "akun-diblokir": "akun diblokir",
  "password-direset": "password direset",
  "peran-diganti": "peran diganti",
};

/** Mencabut sesi tertentu milik userId. Sesi milik akun lain diabaikan. */
export async function cabutSesi(
  db: AletaDatabase,
  m: { userId: string; sessionIds: string[]; alasan: AlasanCabut; pelaku: Pelaku; ip?: string }
) {
  let jumlah = 0;
  for (const sessionId of [...new Set(m.sessionIds)]) {
    const milik = await db.queryOne<{ id: string; ip_address: string | null; user_agent: string | null }>(
      "SELECT id, ip_address, user_agent FROM sessions WHERE id = ? AND user_id = ?",
      [sessionId, m.userId]
    );
    if (!milik) continue;
    const peta = await db.queryOne<{ perangkat_id: string; ip_terakhir: string }>(
      "SELECT perangkat_id, ip_terakhir FROM aleta_sesi_perangkat WHERE session_id = ?",
      [sessionId]
    );
    await db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
    await db.run("DELETE FROM sesi_portal WHERE session_id = ?", [sessionId]);
    await db.run("DELETE FROM aleta_sesi_perangkat WHERE session_id = ?", [sessionId]);
    jumlah += 1;
    await catatPeristiwaAman(db, {
      peristiwa: "SESI_DICABUT",
      alasan: TEKS_ALASAN[m.alasan],
      userId: m.userId,
      sessionId,
      perangkatId: peta?.perangkat_id ?? "",
      ip: peta?.ip_terakhir || milik.ip_address || "",
      agen: String(milik.user_agent ?? ""),
      pelaku: m.pelaku,
      rincian: { sebab: m.alasan, ...(m.ip ? { ipPelaku: m.ip } : {}) },
    });
  }
  return jumlah;
}

/**
 * Mencabut sesi akun menurut sasaran: satu perangkat, satu rujukan sesi, atau
 * semuanya (opsional kecuali satu sesi - sesi pemanggil sendiri).
 */
export async function cabutSesiAkun(
  db: AletaDatabase,
  m: {
    userId: string;
    alasan: AlasanCabut;
    pelaku: Pelaku;
    perangkatId?: string;
    sesiRef?: string;
    semua?: boolean;
    kecualiSessionId?: string | null;
    ip?: string;
  }
) {
  const aktif = await daftarSesiAktif(db, m.userId).catch(() => [] as SesiAktif[]);
  // "Semua" juga membuang sesi yang sudah tidak berlaku tetapi barisnya masih ada.
  const semuaBaris = m.semua
    ? (await db.queryAll<{ id: string }>("SELECT id FROM sessions WHERE user_id = ?", [m.userId])).map((b) => b.id)
    : [];
  const sasaran = m.semua
    ? semuaBaris
    : aktif
        .filter((s) => (m.perangkatId ? s.perangkatId === m.perangkatId : false) || (m.sesiRef ? s.sesiRef === m.sesiRef : false))
        .map((s) => s.sessionId);
  const ids = sasaran.filter((id) => !m.kecualiSessionId || id !== m.kecualiSessionId);
  return cabutSesi(db, { userId: m.userId, sessionIds: ids, alasan: m.alasan, pelaku: m.pelaku, ip: m.ip });
}
