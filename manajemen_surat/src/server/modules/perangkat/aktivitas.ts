import { type AletaDatabase } from "@/server/db/client";
import { catatPeristiwaAman } from "@/server/modules/perangkat/jejak";
import { idPerangkatDariHeader, ipKlien } from "@/server/modules/perangkat/jaringan";

/**
 * Aktivitas sesi (23 Okt 2026) - dipanggil resolveActorUserId pada tiap
 * permintaan bersesi, jadi harus murah:
 *
 *   - "terakhir aktif" ditulis paling sering sekali per 5 menit per sesi
 *     (ingatan proses), kecuali IP-nya berubah;
 *   - IP_BERUBAH dicatat SEKALI per perubahan: ip_terakhir langsung
 *     diperbarui, jadi permintaan berikutnya dari IP yang sama tidak mencatat
 *     lagi;
 *   - sesi lama tanpa peta perangkat dilewati.
 *
 * Tidak pernah melempar: gangguan di sini tidak boleh memutus sesi.
 */

const JEDA_TULIS_MS = 5 * 60 * 1000;
const terakhir = new Map<string, { waktu: number; ip: string }>();
const MAKS_INGATAN = 5000;

export async function catatAktivitasSesi(
  db: AletaDatabase,
  m: { sessionId: string; userId: string; headers: { get(n: string): string | null } },
  sekarang = Date.now()
) {
  try {
    const ip = ipKlien(m.headers);
    const ingat = terakhir.get(m.sessionId);
    if (ingat && sekarang - ingat.waktu < JEDA_TULIS_MS && ingat.ip === ip) return;
    if (terakhir.size > MAKS_INGATAN) terakhir.clear();
    terakhir.set(m.sessionId, { waktu: sekarang, ip });

    const sp = await db.queryOne<{ perangkat_id: string; ip_terakhir: string }>(
      "SELECT perangkat_id, ip_terakhir FROM aleta_sesi_perangkat WHERE session_id = ?",
      [m.sessionId]
    );
    if (!sp) return;
    const kini = new Date(sekarang).toISOString();
    await db.run("UPDATE aleta_sesi_perangkat SET terakhir_aktif = ?, ip_terakhir = ? WHERE session_id = ?", [
      kini,
      ip || sp.ip_terakhir,
      m.sessionId,
    ]);
    await db.run(
      "UPDATE aleta_perangkat SET terakhir_dilihat = ?, ip_terakhir = CASE WHEN ? <> '' THEN ? ELSE ip_terakhir END WHERE perangkat_id = ? AND user_id = ?",
      [kini, ip, ip, sp.perangkat_id, m.userId]
    );
    if (ip && sp.ip_terakhir && ip !== sp.ip_terakhir) {
      await catatPeristiwaAman(db, {
        peristiwa: "IP_BERUBAH",
        alasan: `dari ${sp.ip_terakhir} ke ${ip}`,
        userId: m.userId,
        sessionId: m.sessionId,
        perangkatId: sp.perangkat_id,
        headers: m.headers,
        rincian: { ipSebelum: sp.ip_terakhir, ipBaru: ip },
      });
    }
  } catch {
    /* lihat catatan di atas */
  }
}

export async function catatSesiKedaluwarsa(
  db: AletaDatabase,
  m: { sessionId: string; userId: string; sebab: string; headers: { get(n: string): string | null } }
) {
  terakhir.delete(m.sessionId);
  let sp: { perangkat_id: string } | undefined;
  try {
    sp = await db.queryOne<{ perangkat_id: string }>("SELECT perangkat_id FROM aleta_sesi_perangkat WHERE session_id = ?", [m.sessionId]);
  } catch {
    sp = undefined;
  }
  await catatPeristiwaAman(db, {
    peristiwa: "SESI_KEDALUWARSA",
    alasan: m.sebab === "versi-berubah" ? "aplikasi diperbarui" : "masa sesi habis (tanpa \"simpan login\": 2 jam)",
    userId: m.userId,
    sessionId: m.sessionId,
    perangkatId: sp?.perangkat_id || idPerangkatDariHeader(m.headers),
    headers: m.headers,
  });
}

export function __kosongkanAktivitasUntukUji() {
  terakhir.clear();
}
