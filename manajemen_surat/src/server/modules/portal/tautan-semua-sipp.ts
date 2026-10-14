/**
 * ============================================================================
 * "TAUTKAN SEMUA KE SIPP" - PRATINJAU, TERAPKAN, BATALKAN (14 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 14 Okt: "semua akun SIPP ditautkan ke ALETA (user dan
 * passwordnya)" - petugas masuk ALETA dengan USERNAME dan PASSWORD SIPP-nya
 * sendiri, memakai "masuk ALETA dengan akun SIPP" yang sudah ada (7 Okt,
 * masuk-sipp.ts). Aturan pencocokannya murni di lib/tautan-akun-sipp.ts.
 *
 *   PRATINJAU  - membaca saja: akun ALETA + tautan (Postgres) dan daftar akun
 *                SIPP (bot, user.daftarSipp, tanpa sidik password). Tidak ada
 *                satu baris pun yang ditulis.
 *   TERAPKAN   - hanya pilihan admin yang lolos saringPilihanTerapkan /
 *                saringBuatAkun atas pratinjau yang disusun ULANG saat itu,
 *                SATU transaksi (gagal satu = batal semua), jejak audit per
 *                akun (siapa, kapan, apa).
 *   BATALKAN   - per akun, hanya tautan buatan alat ini (tautan_sumber
 *                'admin-massal' / 'admin-massal-baru').
 *
 * PASSWORD TIDAK PERNAH DISALIN. Tautan ditulis tanpa password
 * (encrypted_password & password_md5_hash kosong). Akun ALETA BARU dibuat
 * TANPA password ALETA: password_hash kosong dan TIDAK ada baris 'credential'
 * di tabel accounts, sehingga /sign-in/email selalu menolak dan satu-satunya
 * jalan masuk adalah password SIPP yang cocok dengan sidik sys_users (bot).
 * Bot mati = akun baru tidak dapat masuk (bukan masuk tanpa password).
 *
 * Super Admin tidak diubah. Peran akun baru selalu peran AMAN dari pemetaan
 * grup SIPP (lib/tautan-akun-sipp.ts PETA_GRUP_SIPP) - peran tinggi
 * ditetapkan admin sendiri sesudahnya.
 */

import {
  saringBuatAkun,
  saringPilihanTerapkan,
  susunPratinjauTautanSipp,
  type BahanTautan,
  type PenggunaSippDaftar,
  type PilihanDitolak,
  type PilihanTautan,
  type PratinjauTautan,
} from "@/lib/tautan-akun-sipp";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { KEADAAN_KREDENSIAL } from "@/server/modules/external-apps/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const SUMBER_MASSAL = "admin-massal";
export const SUMBER_MASSAL_BARU = "admin-massal-baru";

export type AktorTautan = { id: string; roleId: string };

export type JawabanDaftarSipp =
  | { ok: false; error?: string }
  | { ok: true; data?: { pengguna?: Array<Partial<PenggunaSippDaftar>> } };

export type DepsTautanSemua = {
  /** bot: user.daftarSipp - tanpa sidik password. */
  daftarSipp: () => Promise<JawabanDaftarSipp>;
};

/** Akun ALETA (seluruhnya, termasuk yang dihapus - username UNIK lintas semua) + tautan SIPP. */
export async function bacaBahanAleta(db: AletaDatabase): Promise<Pick<BahanTautan, "akun" | "kredensial">> {
  const [akun, kred] = await Promise.all([
    db.queryAll<{
      id: string;
      username: string | null;
      name: string | null;
      nip: string | null;
      role_id: string | null;
      is_active: number | boolean | null;
      deleted_at: string | null;
    }>(`SELECT id, username, name, nip, role_id, is_active, deleted_at FROM users`, []),
    db.queryAll<{
      user_id: string | null;
      external_username: string | null;
      is_enabled: number | boolean | null;
      last_verified_status: string | null;
      tautan_sumber: string | null;
    }>(
      `SELECT user_id, external_username, is_enabled, last_verified_status, tautan_sumber
         FROM external_app_credentials WHERE app_id = 'sipp'`,
      []
    ),
  ]);
  return {
    akun: akun.map((a) => ({
      id: String(a.id),
      username: String(a.username ?? ""),
      name: String(a.name ?? ""),
      nip: a.nip == null ? null : String(a.nip),
      roleId: String(a.role_id ?? ""),
      isActive: a.is_active === true || Number(a.is_active) === 1,
      dihapus: Boolean(a.deleted_at),
    })),
    kredensial: kred.map((k) => ({
      userId: String(k.user_id ?? ""),
      username: String(k.external_username ?? "").trim(),
      aktif: k.is_enabled === true || Number(k.is_enabled) === 1,
      keadaan: String(k.last_verified_status || KEADAAN_KREDENSIAL.BELUM_DIUJI),
      sumber: String(k.tautan_sumber ?? ""),
    })),
  };
}

function rapikanSipp(baris: Array<Partial<PenggunaSippDaftar>>): PenggunaSippDaftar[] {
  return baris.map((s) => ({
    sippUserId: String(s.sippUserId ?? ""),
    username: String(s.username ?? "").trim(),
    namaLengkap: String(s.namaLengkap ?? ""),
    pejabat: (Array.isArray(s.pejabat) ? s.pejabat : []).map((p) => ({
      jabatan: String(p?.jabatan ?? ""),
      nama: String(p?.nama ?? ""),
      nip: String(p?.nip ?? ""),
    })),
    diblokir: s.diblokir === true,
    kedaluwarsa: s.kedaluwarsa === true,
    grup: (Array.isArray(s.grup) ? s.grup : []).map((g) => String(g ?? "")).filter(Boolean),
  }));
}

/** PRATINJAU (dry-run). Tidak menulis apa pun. */
export async function pratinjauTautanSemua(db: AletaDatabase, deps: DepsTautanSemua): Promise<PratinjauTautan> {
  const [aleta, sipp] = await Promise.all([bacaBahanAleta(db), deps.daftarSipp()]);
  if (!sipp.ok) {
    throw new ApiError(502, `Daftar akun SIPP belum dapat dibaca lewat ALETA Bot${sipp.error ? `: ${sipp.error}` : "."}`);
  }
  return susunPratinjauTautanSipp({ ...aleta, sipp: rapikanSipp(sipp.data?.pengguna ?? []) });
}

export type HasilTerapkan = {
  ditautkan: PilihanTautan[];
  dibuat: Array<{ userId: string; usernameSipp: string; peran: string; jabatan: string }>;
  ditolak: Array<PilihanDitolak | { usernameSipp: string; sebab: string }>;
};

function wajibAdmin(aktor: AktorTautan) {
  if (aktor.roleId !== "super-admin" && aktor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menautkan akun ke SIPP.");
  }
}

/**
 * Menerapkan pilihan admin dalam SATU transaksi. Pilihan yang tidak lolos
 * penyaring dilaporkan (ditolak) dan tidak ditulis; yang lolos diperiksa
 * sekali lagi DI DALAM transaksi - bila keadaan berubah di sela (akun lain
 * menautkan username yang sama, dsb.), seluruh penerapan dibatalkan.
 */
export async function terapkanTautanSemua(
  db: AletaDatabase,
  deps: DepsTautanSemua,
  aktor: AktorTautan,
  masukan: { tautkan?: PilihanTautan[]; buat?: string[] }
): Promise<HasilTerapkan> {
  wajibAdmin(aktor);
  const pratinjau = await pratinjauTautanSemua(db, deps);
  const bahan = await bacaBahanAleta(db);
  const tautkan = saringPilihanTerapkan(pratinjau, masukan.tautkan ?? [], bahan.kredensial);
  const buat = saringBuatAkun(pratinjau, masukan.buat ?? []);

  // Username SIPP yang sama tidak boleh sekaligus ditautkan DAN dibuatkan akun.
  const dipakaiTaut = new Set(tautkan.diterima.map((p) => p.usernameSipp.toLowerCase()));
  const buatSah = buat.diterima.filter((s) => !dipakaiTaut.has(s.username.toLowerCase()));
  const ditolak: HasilTerapkan["ditolak"] = [
    ...tautkan.ditolak,
    ...buat.ditolak,
    ...buat.diterima
      .filter((s) => dipakaiTaut.has(s.username.toLowerCase()))
      .map((s) => ({ usernameSipp: s.username, sebab: "Akun SIPP ini sekaligus dipilih untuk ditautkan ke akun ALETA yang ada." })),
  ];
  if (tautkan.diterima.length === 0 && buatSah.length === 0) return { ditautkan: [], dibuat: [], ditolak };

  const waktu = new Date().toISOString();
  const dibuat: HasilTerapkan["dibuat"] = [];

  await withTransaction(db, async (tx) => {
    const klaimAktifLain = async (username: string, kecuali: string) => {
      const kunci = username.trim().toLowerCase();
      const aktif = await tx.queryAll<{ user_id: string; external_username: string | null }>(
        `SELECT user_id, external_username FROM external_app_credentials
          WHERE app_id = 'sipp' AND is_enabled = 1 AND user_id <> ?`,
        [kecuali]
      );
      return aktif.find((k) => String(k.external_username ?? "").trim().toLowerCase() === kunci) ?? null;
    };

    for (const p of tautkan.diterima) {
      const akun = await tx.queryOne<{ role_id: string; is_active: number | boolean; deleted_at: string | null }>(
        `SELECT role_id, is_active, deleted_at FROM users WHERE id = ?`,
        [p.userId]
      );
      if (!akun || akun.deleted_at || !(akun.is_active === true || Number(akun.is_active) === 1)) {
        throw new ApiError(409, `Akun ALETA ${p.userId} berubah (nonaktif/dihapus) sesudah pratinjau. Muat ulang pratinjau.`);
      }
      if (akun.role_id === "super-admin") throw new ApiError(409, "Super Admin tidak diubah oleh alat ini.");
      if (await klaimAktifLain(p.usernameSipp, p.userId)) {
        throw new ApiError(409, `Akun SIPP ${p.usernameSipp} sudah tertaut ke akun ALETA lain sesudah pratinjau. Muat ulang pratinjau.`);
      }
      const ada = await tx.queryOne<{ id: string; external_username: string | null }>(
        `SELECT id, external_username FROM external_app_credentials WHERE user_id = ? AND app_id = 'sipp' LIMIT 1`,
        [p.userId]
      );
      if (ada && String(ada.external_username ?? "").trim()) {
        throw new ApiError(409, `Akun ALETA ${p.userId} sudah punya tautan SIPP sesudah pratinjau. Muat ulang pratinjau.`);
      }
      if (ada) {
        await tx.run(
          `UPDATE external_app_credentials
              SET external_username = ?, encrypted_password = '', password_md5_hash = '', is_enabled = 1,
                  last_verified_status = ?, last_verified_at = ?, tautan_sumber = ?, tautan_ditinjau_oleh = ?,
                  tautan_ditinjau_pada = ?, updated_by = ?, updated_at = ?
            WHERE id = ?`,
          [p.usernameSipp, KEADAAN_KREDENSIAL.BELUM_DIUJI, waktu, SUMBER_MASSAL, aktor.id, waktu, aktor.id, waktu, ada.id]
        );
      } else {
        await tx.run(
          `INSERT INTO external_app_credentials (
             id, user_id, app_id, external_username, encrypted_password, password_md5_hash, is_enabled,
             last_verified_status, last_verified_at, created_by, updated_by, created_at, updated_at,
             tautan_sumber, tautan_ditinjau_oleh, tautan_ditinjau_pada
           ) VALUES (?, ?, 'sipp', ?, '', '', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            await nextPrefixedId(tx, "external_app_credentials", "eac"),
            p.userId,
            p.usernameSipp,
            KEADAAN_KREDENSIAL.BELUM_DIUJI,
            waktu,
            aktor.id,
            aktor.id,
            waktu,
            waktu,
            SUMBER_MASSAL,
            aktor.id,
            waktu,
          ]
        );
      }
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: aktor.id,
        action: "LINK_SIPP_ACCOUNT_BULK",
        entityType: "user",
        entityId: p.userId,
        payload: { appId: "sipp", username: p.usernameSipp, sumber: SUMBER_MASSAL, pada: waktu },
      });
    }

    for (const s of buatSah) {
      const bentrok = await tx.queryOne<{ id: string }>(`SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`, [s.username]);
      if (bentrok) throw new ApiError(409, `Username "${s.username}" sudah dipakai akun ALETA lain sesudah pratinjau. Muat ulang pratinjau.`);
      if (await klaimAktifLain(s.username, "")) {
        throw new ApiError(409, `Akun SIPP ${s.username} sudah tertaut ke akun ALETA lain sesudah pratinjau. Muat ulang pratinjau.`);
      }
      const jabatan = await tx.queryOne<{ id: string }>(`SELECT id FROM positions WHERE id = ?`, [s.usulan.jabatanAman]);
      const peran = await tx.queryOne<{ id: string }>(`SELECT id FROM roles WHERE id = ?`, [s.usulan.peranAman]);
      if (!jabatan || !peran) {
        throw new ApiError(409, `Jabatan ${s.usulan.jabatanAman} / peran ${s.usulan.peranAman} belum ada di ALETA - akun ${s.username} tidak dapat dibuat.`);
      }
      const userId = await nextPrefixedId(tx, "users", "usr");
      // Surel wajib & unik di tabel users; akun SIPP tidak punya surel, jadi
      // dipakai alamat ber-TLD .invalid (RFC 2606) yang tidak pernah terkirim.
      const surel = `sipp-${s.sippUserId || userId}@aleta.invalid`;
      await tx.run(
        `INSERT INTO users (
           id, username, password_hash, name, nip, email, email_verified, whatsapp_number, profile_photo_url,
           role_id, position_id, additional_role_ids_json, is_active, can_bypass_hierarchy, deleted_at, created_at, updated_at
         ) VALUES (?, ?, '', ?, ?, ?, TRUE, '', NULL, ?, ?, '[]', 1, 0, NULL, ?, ?)`,
        [userId, s.username, s.namaLengkap || s.username, s.nip || null, surel, s.usulan.peranAman, s.usulan.jabatanAman, waktu, waktu]
      );
      // SENGAJA tanpa baris accounts 'credential': tidak ada password ALETA.
      await tx.run(
        `INSERT INTO external_app_credentials (
           id, user_id, app_id, external_username, encrypted_password, password_md5_hash, is_enabled,
           last_verified_status, last_verified_at, created_by, updated_by, created_at, updated_at,
           tautan_sumber, tautan_ditinjau_oleh, tautan_ditinjau_pada
         ) VALUES (?, ?, 'sipp', ?, '', '', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          await nextPrefixedId(tx, "external_app_credentials", "eac"),
          userId,
          s.username,
          KEADAAN_KREDENSIAL.BELUM_DIUJI,
          waktu,
          aktor.id,
          aktor.id,
          waktu,
          waktu,
          SUMBER_MASSAL_BARU,
          aktor.id,
          waktu,
        ]
      );
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: aktor.id,
        action: "CREATE_USER_FROM_SIPP",
        entityType: "user",
        entityId: userId,
        payload: {
          username: s.username,
          roleId: s.usulan.peranAman,
          positionId: s.usulan.jabatanAman,
          peranPadanan: s.usulan.peranPadanan,
          peranTinggiPerluKeputusan: s.usulan.tinggi,
          dasar: s.usulan.dasar,
          tanpaPasswordAleta: true,
          sumber: SUMBER_MASSAL_BARU,
          pada: waktu,
        },
      });
      dibuat.push({ userId, usernameSipp: s.username, peran: s.usulan.peranAman, jabatan: s.usulan.jabatanAman });
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "SIPP_BULK_LINK_APPLY",
      entityType: "user",
      entityId: "massal",
      payload: { ditautkan: tautkan.diterima.length, dibuat: dibuat.length, ditolak: ditolak.length, pada: waktu },
    });
  });

  return { ditautkan: tautkan.diterima, dibuat, ditolak };
}

/**
 * Membatalkan SATU tautan buatan alat ini. Tautan tidak dihapus melainkan
 * DINONAKTIFKAN (username tetap tercatat) - sama dengan "cabut" di Manajemen
 * Akun - supaya tidak dibuat ulang otomatis lewat nama saat masuk. Akun yang
 * DIBUAT alat ini ikut dinonaktifkan.
 */
export async function batalkanTautanMassal(db: AletaDatabase, aktor: AktorTautan, userId: string) {
  wajibAdmin(aktor);
  return withTransaction(db, async (tx) => {
    const baris = await tx.queryOne<{ id: string; external_username: string; tautan_sumber: string | null; is_enabled: number | boolean; role_id: string }>(
      `SELECT e.id, e.external_username, e.tautan_sumber, e.is_enabled, u.role_id
         FROM external_app_credentials e JOIN users u ON u.id = e.user_id
        WHERE e.user_id = ? AND e.app_id = 'sipp' LIMIT 1`,
      [userId]
    );
    if (!baris) throw new ApiError(404, "Akun ini tidak punya tautan SIPP.");
    const sumber = String(baris.tautan_sumber ?? "");
    if (sumber !== SUMBER_MASSAL && sumber !== SUMBER_MASSAL_BARU) {
      throw new ApiError(400, "Tautan ini bukan buatan 'Tautkan semua ke SIPP' - cabut lewat Manajemen Akun.");
    }
    if (!(baris.is_enabled === true || Number(baris.is_enabled) === 1)) {
      return { ok: true as const, sudahBatal: true, akunDinonaktifkan: false };
    }
    if (baris.role_id === "super-admin") throw new ApiError(403, "Super Admin tidak diubah oleh alat ini.");
    const waktu = new Date().toISOString();
    await tx.run(
      `UPDATE external_app_credentials
          SET is_enabled = 0, tautan_ditinjau_oleh = ?, tautan_ditinjau_pada = ?, updated_by = ?, updated_at = ?
        WHERE id = ?`,
      [aktor.id, waktu, aktor.id, waktu, baris.id]
    );
    const akunBaru = sumber === SUMBER_MASSAL_BARU;
    if (akunBaru) await tx.run(`UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?`, [waktu, userId]);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UNDO_SIPP_ACCOUNT_LINK_BULK",
      entityType: "user",
      entityId: userId,
      payload: { appId: "sipp", username: baris.external_username, sumber, akunDinonaktifkan: akunBaru, pada: waktu },
    });
    return { ok: true as const, sudahBatal: false, akunDinonaktifkan: akunBaru };
  });
}
