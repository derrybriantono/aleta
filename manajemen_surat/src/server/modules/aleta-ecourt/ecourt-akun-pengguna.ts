/**
 * Akun e-Court MILIK TIAP PENGGUNA - sisi portal (butir 20, 5 Okt 2026).
 *
 * ============================================================================
 * YANG DIKERJAKAN DI SINI
 * ============================================================================
 *
 *   1. Penjaga identitas SIPP: panel ekstensi di halaman SIPP mengirim
 *      username SIPP yang sedang terbuka (olehUsername). Tindakan e-Court
 *      tetap memakai akun e-Court milik pengguna ALETA yang LOGIN - username
 *      SIPP tidak pernah dipakai memilih akun orang lain. Gunanya hanya
 *      mencegat satu kekeliruan nyata di komputer bersama: ALETA masuk
 *      sebagai A sementara SIPP terbuka sebagai B. Bila username SIPP itu
 *      tersimpan (kredensial SIPP aktif, pemilik tunggal - aturan
 *      tentukanPemilikSipp) atas nama pengguna ALETA LAIN, tindakan ditolak.
 *
 *   2. Rekap admin: siapa saja hakim, panitera, panitera pengganti, dan juru
 *      sita yang sudah/belum menyimpan akun e-Court dan bersesi. Tanpa sandi
 *      - bot memang tidak pernah mengirimnya.
 *
 * Sandi akun e-Court TIDAK disimpan portal. Ia diteruskan sekali ke bot
 * (disandi di sana, ecourtAkunPenggunaService) dan dibuang.
 */

import { type AletaDatabase } from "@/server/db/client";
import { bacaKredensialSipp, tentukanPemilikSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";
import { getUsersFromDb } from "@/server/modules/organization/service";

// ---------------------------------------------------------------------------
// 1. Penjaga identitas SIPP
// ---------------------------------------------------------------------------

export type HasilPeriksaSipp =
  | { ok: true; usernameSipp: string; tertaut: boolean }
  | { ok: false; alasan: "akun_sipp_milik_pengguna_lain"; usernameSipp: string };

/** Username SIPP dari panel ekstensi: dipangkas, dibatasi, karakter wajar saja. */
export function bersihkanUsernameSipp(nilai: unknown): string {
  const s = String(nilai ?? "").trim();
  return /^[A-Za-z0-9_.@-]{1,64}$/.test(s) ? s : "";
}

/**
 * Apakah akun SIPP yang terbuka boleh dipakai bersama akun ALETA yang login?
 *
 * Kosong / belum tersimpan di ALETA / pemiliknya tidak tunggal = boleh
 * (tidak dapat dibuktikan milik orang lain; tindakan tetap atas nama akun
 * ALETA yang login). Tersimpan atas nama pengguna lain = ditolak.
 */
export async function periksaAkunSippTerbuka(
  db: AletaDatabase,
  aktorId: string,
  usernameMentah: unknown
): Promise<HasilPeriksaSipp> {
  const usernameSipp = bersihkanUsernameSipp(usernameMentah);
  if (!usernameSipp) return { ok: true, usernameSipp: "", tertaut: false };
  const pemilik = tentukanPemilikSipp(await bacaKredensialSipp(db)).get(usernameSipp.toLowerCase());
  if (pemilik?.pemilik && pemilik.pemilik !== aktorId) {
    return { ok: false, alasan: "akun_sipp_milik_pengguna_lain", usernameSipp };
  }
  return { ok: true, usernameSipp, tertaut: pemilik?.pemilik === aktorId };
}

// ---------------------------------------------------------------------------
// 2. Rekap admin
// ---------------------------------------------------------------------------

/** Peran e-Court (kode bot) yang lazim untuk jabatan ALETA seseorang. */
export function peranEcourtDiharapkan(u: {
  roleId?: string | null;
  positionId?: string | null;
  additionalRoleIds?: string[] | null;
}): string[] {
  const peran = new Set([String(u.roleId ?? ""), ...(u.additionalRoleIds ?? []).map(String)]);
  const pos = String(u.positionId ?? "");
  const hasil: string[] = [];
  if (["hakim", "ketua", "wakil-ketua"].some((r) => peran.has(r)) || ["pos-hakim", "pos-ketua", "pos-wakil"].includes(pos)) {
    hasil.push("hakim");
  }
  if (["panitera", "panitera-muda"].some((r) => peran.has(r)) || pos === "pos-panitera" || pos.startsWith("pos-panitera-muda")) {
    hasil.push("panitera");
  }
  if (peran.has("panitera-pengganti") || pos === "pos-panitera-pengganti") hasil.push("panitera-pengganti");
  if (peran.has("jurusita") || pos === "pos-jurusita" || pos === "pos-jurusita-pengganti") hasil.push("juru-sita");
  return hasil;
}

export type AkunBot = {
  penggunaId: string;
  namaPengguna?: string;
  peran: string;
  email: string;
  adaSandi: boolean;
  diperbaruiPada: string;
  diujiPada: string;
  hasilUji: string;
};

export type SesiBot = {
  penggunaId: string;
  peran: string;
  keadaan: "tersambung" | "kedaluwarsa" | "terputus";
  namaAkunEcourt: string;
  terakhirDipakai: string;
};

export type BarisRekap = {
  penggunaId: string;
  nama: string;
  jabatan: string;
  peranDiharapkan: string[];
  akun: Array<{
    peran: string;
    email: string;
    adaSandi: boolean;
    diperbaruiPada: string;
    hasilUji: string;
    diujiPada: string;
    sesi: SesiBot["keadaan"] | "";
    namaAkunEcourt: string;
  }>;
  /** sudah = tiap peran yang diharapkan punya akun tersimpan; sebagian; belum. */
  keadaan: "sudah" | "sebagian" | "belum";
};

/**
 * Menyusun rekap dari pengguna ALETA aktif + simpanan bot. Pengguna yang
 * jabatannya tidak memerlukan e-Court tetap ikut bila ia sudah menyimpan akun.
 */
export function susunRekap(
  pengguna: Array<{
    id: string;
    name: string;
    roleId?: string | null;
    positionId?: string | null;
    additionalRoleIds?: string[] | null;
    isActive?: boolean;
  }>,
  akun: AkunBot[],
  sesi: SesiBot[]
): BarisRekap[] {
  const hasil: BarisRekap[] = [];
  for (const u of pengguna) {
    if (u.isActive === false) continue;
    const diharapkan = peranEcourtDiharapkan(u);
    const milik = akun.filter((a) => a.penggunaId === u.id);
    if (!diharapkan.length && !milik.length) continue;
    const peranSemua = [...new Set([...diharapkan, ...milik.map((a) => a.peran)])];
    const baris = peranSemua.map((peran) => {
      const a = milik.find((x) => x.peran === peran);
      const s = sesi.find((x) => x.penggunaId === u.id && x.peran === peran);
      return {
        peran,
        email: a?.email ?? "",
        adaSandi: Boolean(a?.adaSandi),
        diperbaruiPada: a?.diperbaruiPada ?? "",
        hasilUji: a?.hasilUji ?? "",
        diujiPada: a?.diujiPada ?? "",
        sesi: (s?.keadaan ?? "") as BarisRekap["akun"][number]["sesi"],
        namaAkunEcourt: s?.namaAkunEcourt ?? "",
      };
    });
    const terisi = diharapkan.filter((p) => baris.some((b) => b.peran === p && b.adaSandi)).length;
    const punyaApaPun = baris.some((b) => b.adaSandi);
    hasil.push({
      penggunaId: u.id,
      nama: u.name,
      jabatan: String(u.positionId ?? u.roleId ?? ""),
      peranDiharapkan: diharapkan,
      akun: baris,
      keadaan:
        diharapkan.length && terisi === diharapkan.length
          ? "sudah"
          : !diharapkan.length && punyaApaPun
            ? "sudah"
            : punyaApaPun
              ? "sebagian"
              : "belum",
    });
  }
  const urut = { belum: 0, sebagian: 1, sudah: 2 } as const;
  return hasil.sort((a, b) => urut[a.keadaan] - urut[b.keadaan] || a.nama.localeCompare(b.nama, "id"));
}

export async function penggunaUntukRekap(db: AletaDatabase) {
  return getUsersFromDb(db);
}
