import { getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import { hakPutusanAdvance, PERAN_HAKIM_ADVANCE, type HakAdvance, type OrangKonseptor } from "@/lib/putusan-advance";
import type { AletaDatabase } from "@/server/db/client";
import { bacaKredensialSipp, tentukanPemilikSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";

/**
 * ============================================================================
 * HAK PUTUSAN ADVANCE (keputusan pengguna 17 Okt 2026, butir 57)
 * ============================================================================
 *
 * Hakim DAN konseptor, ditambah Super Admin/Admin. Aturannya murni di
 * hakPutusanAdvance (@/lib/putusan-advance); modul ini hanya mengumpulkan
 * bahannya - semuanya BACA SAJA dari basis data ALETA:
 *
 *   - username SIPP milik akun (kredensial aktif yang ia miliki sendiri,
 *     tentukanPemilikSipp - aturan yang sama dengan checklist konseptor);
 *   - konseptor sementara perkara ini (aleta_konseptor_sementara, F1.6).
 *
 * Konseptor yang tercatat di SIPP datang dari bot bersama putusan serupa
 * (putusanSerupaService, jejak tahapan putusan) - diteruskan pemanggil.
 * Bahan yang gagal dibaca dianggap kosong: aksesnya TERTUTUP, bukan terbuka.
 */

type Aktor = { id: string; name?: string | null; roleId?: unknown; additionalRoleIds?: unknown } & Parameters<typeof isPrivilegedAdmin>[0];

const teks = (x: unknown) => String(x ?? "").trim();

async function konseptorSementaraPerkara(db: AletaDatabase, perkaraId: string, nomorPerkara: string): Promise<OrangKonseptor | null> {
  const nomor = nomorPerkara.replace(/\.$/, "");
  try {
    const baris = await db.queryOne<Record<string, unknown>>(
      `SELECT nama, pengguna FROM aleta_konseptor_sementara WHERE perkara_id = ? OR nomor_perkara IN (?, ?) LIMIT 1`,
      [perkaraId || "-", nomor, `${nomor}.`]
    );
    return baris ? { nama: teks(baris.nama), pengguna: teks(baris.pengguna) } : null;
  } catch {
    return null;
  }
}

async function usernameSippAkun(db: AletaDatabase, aktorId: string): Promise<string[]> {
  try {
    const kredensial = await bacaKredensialSipp(db);
    const pemilik = tentukanPemilikSipp(kredensial);
    return kredensial
      .filter((k) => k.userId === aktorId && pemilik.get(k.username.trim().toLowerCase())?.pemilik === aktorId)
      .map((k) => k.username);
  } catch {
    return [];
  }
}

export async function periksaHakPutusanAdvance(
  db: AletaDatabase,
  aktor: Aktor,
  perkara: { perkaraId?: string; nomorPerkara: string; konseptorSipp?: OrangKonseptor[] }
): Promise<HakAdvance> {
  const tambahan = Array.isArray(aktor?.additionalRoleIds) ? (aktor.additionalRoleIds as unknown[]).map(teks) : [];
  const peran = [teks(getEffectiveRoleId(aktor)), teks(aktor?.roleId), ...tambahan].filter(Boolean);
  const admin = isPrivilegedAdmin(aktor);
  // Admin dan hakim tidak perlu bahan konseptor.
  if (admin || peran.some((p) => (PERAN_HAKIM_ADVANCE as readonly string[]).includes(p))) {
    return hakPutusanAdvance({ admin, peran, nama: [], usernames: [] });
  }
  const [usernames, konseptorSementara] = await Promise.all([
    usernameSippAkun(db, teks(aktor?.id)),
    konseptorSementaraPerkara(db, teks(perkara.perkaraId), teks(perkara.nomorPerkara)),
  ]);
  return hakPutusanAdvance({
    admin,
    peran,
    nama: [teks(aktor?.name)].filter(Boolean),
    usernames,
    konseptorSementara,
    konseptorSipp: perkara.konseptorSipp ?? [],
  });
}
