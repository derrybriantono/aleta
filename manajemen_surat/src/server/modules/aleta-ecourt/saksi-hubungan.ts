/**
 * ============================================================================
 * DAFTAR HUBUNGAN SAKSI - DATABASE YANG BISA DITAMBAH (1.189.x BUTIR 10)
 * ============================================================================
 *
 * TANPA TABEL BARU: aleta_ekstensi_setelan (0052) dengan pengguna_id
 * PENGGUNA_SEMUA ("*semua-pengguna*", pola tampilan-jadwal-bawaan.ts) dan SATU
 * BARIS PER HUBUNGAN, kunci "portal:saksi-hubungan:<siput>". Satu baris per
 * hubungan, bukan satu baris JSON berisi seluruh daftar: dua petugas yang
 * menambah bersamaan tidak saling menimpa. Kuncinya di luar daftar putih
 * setelan ekstensi, jadi tidak ikut terkirim sebagai setelan pribadi.
 *
 *   nilai = { teks, kelompok, aktif, oleh, pada }
 *
 * Isi awal (HUBUNGAN_BAWAAN, terukur atas data saksi satker) TIDAK ditulis ke
 * basis data - ia digabung saat dibaca. Menyembunyikan isi awal = satu baris
 * ber-aktif false dengan kunci yang sama.
 *
 * Kewenangan:
 *   membaca, menambah     kapabilitas "panel" (petugas yang mengisi saksi)
 *   menyembunyikan/kembali Admin & Super Admin (pastikanAdminIstimewa)
 * Setiap perubahan tercatat di audit_logs.
 */

import { HUBUNGAN_BAWAAN, kunciHubungan, rapikanDasarHubungan, type KelompokHubungan } from "@/lib/saksi-hubungan";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { PENGGUNA_SEMUA } from "@/server/modules/aleta-ecourt/tampilan-jadwal-bawaan";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const AWALAN_KUNCI_HUBUNGAN = "portal:saksi-hubungan:";

export type HubunganSaksi = {
  kunci: string;
  teks: string;
  kelompok: KelompokHubungan;
  bawaan: boolean;
  aktif: boolean;
  jumlah: number;
};

type NilaiTersimpan = { teks?: unknown; kelompok?: unknown; aktif?: unknown; oleh?: unknown; pada?: unknown };

function uraiNilai(nilai: string): NilaiTersimpan | null {
  try {
    const isi = JSON.parse(nilai) as unknown;
    return isi && typeof isi === "object" ? (isi as NilaiTersimpan) : null;
  } catch {
    return null;
  }
}

/** Isi awal + tambahan petugas, urut menurut pemakaian. `semua` = termasuk yang disembunyikan. */
export async function bacaDaftarHubungan(db: AletaDatabase, semua = false): Promise<HubunganSaksi[]> {
  const baris = await db
    .prepare("SELECT kunci, nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci LIKE ?")
    .all<{ kunci: string; nilai: string }>(PENGGUNA_SEMUA, `${AWALAN_KUNCI_HUBUNGAN}%`);
  const peta = new Map<string, HubunganSaksi>();
  for (const h of HUBUNGAN_BAWAAN) {
    const kunci = kunciHubungan(h.teks);
    peta.set(kunci, { kunci, teks: h.teks, kelompok: h.kelompok, bawaan: true, aktif: true, jumlah: h.jumlah });
  }
  for (const b of baris) {
    const isi = uraiNilai(b.nilai);
    if (!isi) continue;
    const ada = peta.get(b.kunci);
    const aktif = isi.aktif !== false;
    if (ada) {
      ada.aktif = aktif;
      continue;
    }
    const rapi = rapikanDasarHubungan(isi.teks);
    if (!rapi.ok) continue;
    peta.set(b.kunci, {
      kunci: b.kunci,
      teks: rapi.teks,
      kelompok: isi.kelompok === "keluarga" || isi.kelompok === "lain" ? isi.kelompok : rapi.kelompok,
      bawaan: false,
      aktif,
      jumlah: 0,
    });
  }
  return [...peta.values()]
    .filter((h) => semua || h.aktif)
    .sort((a, b) => b.jumlah - a.jumlah || a.teks.localeCompare(b.teks, "id"));
}

async function tulis(db: AletaDatabase, kunci: string, nilai: Record<string, unknown>, aktorId: string, aksi: string) {
  const pada = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SEMUA, kunci, JSON.stringify({ ...nilai, pada }), pada);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktorId,
      action: aksi,
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SEMUA}:${kunci}`,
      payload: { teks: nilai.teks, aktif: nilai.aktif },
      createdAt: pada,
    });
  });
}

/** Tambah satu dasar hubungan. Yang sudah ada (termasuk isi awal) tidak digandakan. */
export async function tambahHubungan(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  masukan: unknown
): Promise<{ hubungan: HubunganSaksi; sudahAda: boolean }> {
  const rapi = rapikanDasarHubungan(masukan);
  if (!rapi.ok) throw new ApiError(400, rapi.alasan);
  const kunci = kunciHubungan(rapi.teks);
  const daftar = await bacaDaftarHubungan(db, true);
  const ada = daftar.find((h) => h.kunci === kunci);
  if (ada && ada.aktif) return { hubungan: ada, sudahAda: true };
  // Yang pernah disembunyikan lalu ditambahkan lagi = dimunculkan kembali.
  await tulis(
    db,
    kunci,
    { teks: ada ? ada.teks : rapi.teks, kelompok: ada ? ada.kelompok : rapi.kelompok, aktif: true, oleh: aktor.name ?? aktor.id },
    aktor.id,
    "SAKSI_HUBUNGAN_TAMBAH"
  );
  const hubungan = (await bacaDaftarHubungan(db)).find((h) => h.kunci === kunci);
  if (!hubungan) throw new ApiError(500, "Hubungan tersimpan tetapi tidak terbaca kembali.");
  return { hubungan, sudahAda: false };
}

/** Sembunyikan / tampilkan kembali satu hubungan (Admin). */
export async function aturHubungan(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  kunci: unknown,
  aktif: boolean
): Promise<HubunganSaksi[]> {
  const k = String(kunci ?? "");
  if (!k.startsWith(AWALAN_KUNCI_HUBUNGAN)) throw new ApiError(400, "Kunci hubungan tidak sah.");
  const ada = (await bacaDaftarHubungan(db, true)).find((h) => h.kunci === k);
  if (!ada) throw new ApiError(404, "Hubungan tidak ditemukan.");
  await tulis(
    db,
    k,
    { teks: ada.teks, kelompok: ada.kelompok, aktif, oleh: aktor.name ?? aktor.id },
    aktor.id,
    aktif ? "SAKSI_HUBUNGAN_TAMPILKAN" : "SAKSI_HUBUNGAN_SEMBUNYIKAN"
  );
  return bacaDaftarHubungan(db, true);
}
