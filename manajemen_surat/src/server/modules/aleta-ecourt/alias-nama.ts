import { createHash } from "node:crypto";

import { GalatEjaan, bersihkanEntriKamus, bersihkanSumberNama, periksaEjaan, tulisanDasar, type EntriKamus, type SumberNama } from "@/lib/ejaan-nama";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { bacaKinerja } from "@/server/modules/aleta-ecourt/kinerja-ekstensi";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * KAMUS ALIAS NAMA PIHAK + PEMERIKSA EJAAN (U18, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Tabel aleta_alias_nama (0100): nama baku + varian ejaan. Aturan perbandingan ada di src/lib/ejaan-nama.ts.
 *
 *   - Kamus hanya dapat DILIHAT dan DIUBAH Admin dan Super Admin (isinya nama orang). Pemeriksa memakainya di sisi
 *     server dan tidak pernah mengirim daftar kamus; yang kembali hanya usulan atas nama yang dikirim pemanggil.
 *   - Pemeriksa hanya bekerja bila Super Admin menyalakan saklar kinerja.ejaanNamaPihak (mati bawaan:
 *     { tersedia: false }); kamus yang sama dipakai penyamaran ALETA Ai hanya bila saklar itu menyala.
 *   - SEMUANYA USULAN: tidak ada fungsi di sini yang menulis ke SIPP, ABT, atau e-Court.
 */

type Baris = { id: string; baku: string; varian: string; baku_kunci: string; varian_kunci: string; sumber: string; dibuat_oleh: string; dibuat_pada: string; diubah_pada: string };

/** Sidik pendek nama untuk jejak audit: nama orang tidak pernah ditulis ke audit. */
const sidikNama = (k: string) => createHash("sha256").update(k).digest("hex").slice(0, 12);

export const SUMBER_ALIAS = ["manual", "usulan"] as const;
export type SumberAlias = (typeof SUMBER_ALIAS)[number];

export async function saklarEjaanNyala(db: AletaDatabase) {
  return (await bacaKinerja(db)).ejaanNamaPihak === true;
}

/** Seluruh kamus sebagai entri {baku, varian[]}; dipakai pemeriksa dan penyamaran (di sisi server saja). */
export async function bacaKamus(db: AletaDatabase): Promise<EntriKamus[]> {
  const baris = await db.prepare("SELECT baku, varian, baku_kunci FROM aleta_alias_nama ORDER BY baku_kunci ASC, varian ASC").all<Pick<Baris, "baku" | "varian" | "baku_kunci">>();
  const peta = new Map<string, EntriKamus>();
  for (const b of baris) {
    const e = peta.get(b.baku_kunci) ?? { baku: b.baku, varian: [] };
    e.varian.push(b.varian);
    peta.set(b.baku_kunci, e);
  }
  return [...peta.values()];
}

/** Kamus untuk penyamaran ALETA Ai: kosong bila saklar mati (kamus tidak dipakai). */
export async function kamusUntukSamaran(db: AletaDatabase): Promise<EntriKamus[]> {
  try {
    if (!(await saklarEjaanNyala(db))) return [];
    return await bacaKamus(db);
  } catch {
    return [];
  }
}

export async function daftarAlias(db: AletaDatabase, aktorId: string | null | undefined) {
  await pastikanAdminIstimewa(db, aktorId, "melihat kamus alias nama");
  const baris = await db
    .prepare("SELECT id, baku, varian, baku_kunci, varian_kunci, sumber, dibuat_oleh, dibuat_pada, diubah_pada FROM aleta_alias_nama ORDER BY baku_kunci ASC, varian ASC")
    .all<Baris>();
  const kelompok = new Map<string, { baku: string; varian: Array<{ id: string; varian: string; sumber: string; dibuatPada: string }> }>();
  for (const b of baris) {
    const k = kelompok.get(b.baku_kunci) ?? { baku: b.baku, varian: [] };
    k.varian.push({ id: b.id, varian: b.varian, sumber: b.sumber, dibuatPada: b.dibuat_pada });
    kelompok.set(b.baku_kunci, k);
  }
  return { aktif: await saklarEjaanNyala(db), jumlah: baris.length, kamus: [...kelompok.values()] };
}

export async function tambahAlias(db: AletaDatabase, aktorId: string | null | undefined, masukan: unknown, sumber: SumberAlias = "manual") {
  const actor = await pastikanAdminIstimewa(db, aktorId, "mengubah kamus alias nama");
  let e: EntriKamus;
  try {
    e = bersihkanEntriKamus(masukan);
  } catch (galat) {
    if (galat instanceof GalatEjaan) throw new ApiError(400, galat.message);
    throw galat;
  }
  const sekarang = new Date().toISOString();
  const bakuKunci = tulisanDasar(e.baku);
  const ditambah: string[] = [];
  const sudahAda: string[] = [];
  await withTransaction(db, async (tx) => {
    for (const v of e.varian) {
      const varianKunci = tulisanDasar(v);
      const ada = await tx.prepare("SELECT id FROM aleta_alias_nama WHERE baku_kunci = ? AND varian_kunci = ?").all<{ id: string }>(bakuKunci, varianKunci);
      if (ada.length) {
        sudahAda.push(v);
        continue;
      }
      await tx
        .prepare(
          "INSERT INTO aleta_alias_nama (id, baku, varian, baku_kunci, varian_kunci, sumber, dibuat_oleh, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(await nextPrefixedId(tx, "aleta_alias_nama", "aln"), e.baku, v, bakuKunci, varianKunci, sumber, actor.id, sekarang, sekarang);
      ditambah.push(v);
    }
    if (ditambah.length) {
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "TAMBAH_ALIAS_NAMA",
        entityType: "aleta_alias_nama",
        entityId: sidikNama(bakuKunci),
        // Nama orang tidak ditulis ke audit; cukup kunci ejaan dan jumlahnya.
        payload: { sidikBaku: sidikNama(bakuKunci), jumlahVarian: ditambah.length, sumber },
        createdAt: sekarang,
      });
    }
  });
  return { ditambah, sudahAda };
}

export async function hapusAlias(db: AletaDatabase, aktorId: string | null | undefined, masukan: { id?: unknown; baku?: unknown }) {
  const actor = await pastikanAdminIstimewa(db, aktorId, "mengubah kamus alias nama");
  const sekarang = new Date().toISOString();
  let dihapus = 0;
  await withTransaction(db, async (tx) => {
    if (typeof masukan.id === "string" && masukan.id) {
      const ada = await tx.prepare("SELECT id FROM aleta_alias_nama WHERE id = ?").all<{ id: string }>(masukan.id);
      if (ada.length) {
        await tx.prepare("DELETE FROM aleta_alias_nama WHERE id = ?").run(masukan.id);
        dihapus = 1;
      }
    } else if (typeof masukan.baku === "string" && masukan.baku.trim()) {
      const k = tulisanDasar(masukan.baku);
      const ada = await tx.prepare("SELECT id FROM aleta_alias_nama WHERE baku_kunci = ?").all<{ id: string }>(k);
      if (ada.length) {
        await tx.prepare("DELETE FROM aleta_alias_nama WHERE baku_kunci = ?").run(k);
        dihapus = ada.length;
      }
    } else {
      throw new ApiError(400, "Sebutkan id varian atau nama baku yang dihapus.");
    }
    if (dihapus) {
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "HAPUS_ALIAS_NAMA",
        entityType: "aleta_alias_nama",
        entityId: typeof masukan.id === "string" && masukan.id ? masukan.id : sidikNama(tulisanDasar(String(masukan.baku))),
        payload: { jumlah: dihapus },
        createdAt: sekarang,
      });
    }
  });
  return { dihapus };
}

/** Pemeriksa untuk siapa saja yang masuk. Saklar mati -> { tersedia: false }. Hanya usulan atas nama yang dikirim pemanggil. */
export async function periksaNamaPihak(db: AletaDatabase, masukan: unknown) {
  if (!(await saklarEjaanNyala(db))) return { tersedia: false as const, alasan: "saklar-mati" as const };
  const badan = masukan && typeof masukan === "object" ? (masukan as { nama?: unknown }) : {};
  let sumber: SumberNama[];
  try {
    sumber = bersihkanSumberNama(badan.nama);
  } catch (galat) {
    if (galat instanceof GalatEjaan) throw new ApiError(400, galat.message);
    throw galat;
  }
  const kamus = await bacaKamus(db);
  const usulan = periksaEjaan(sumber, kamus);
  return {
    tersedia: true as const,
    jumlahNama: sumber.length,
    usulan,
    // kejujuran layar: pemeriksa tanpa kamus hanya memakai aturan ejaan dan jarak
    kamusKosong: kamus.length === 0,
  };
}
