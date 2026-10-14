/**
 * ============================================================================
 * TAUTKAN BERKAS TANDA TANGAN KE AKUN PEMILIKNYA LEWAT NAMA (14 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 14 Okt: "untuk TTD sudah ada namanya, minta tolong
 * langsung ditautkan saja dengan akunnya".
 *
 * Tanda tangan yang sudah BERNAMA tetapi belum bertaut ke akun portal tidak
 * terpakai oleh edoc penetapan yang mendahulukan tanda tangan akun yang sedang
 * masuk (tandaTanganService.untukPengguna). Modul ini MURNI: ia hanya
 * menjawab akun mana yang namanya SAMA PERSIS dengan nama pada berkas itu.
 *
 * ============================================================================
 * SAMA, BUKAN MIRIP - DAN TIDAK MENYENTUH PENGESAHAN
 * ============================================================================
 *
 * Kunci nama sama dengan pencocok pegawai SIPP (lib/nama-pegawai-sipp.ts):
 * gelar, tanda baca, ejaan dilipat, lalu SAMA PERSIS. Tepat satu akun aktif =
 * pasti; lebih dari satu = ganda; nol = tidak ketemu (yang mirip disebut
 * sebagai petunjuk, tidak pernah ditautkan). Tanda tangan yang namanya keliru
 * dipasang adalah tanda tangan palsu pada penetapan - yang ragu dibiarkan
 * untuk manusia.
 *
 * Menautkan hanya mengisi pengguna_id/peran/sub_peran pada berkas yang BELUM
 * bertaut. Nama tidak diubah, sehingga pengesahan yang sudah ada tetap; yang
 * belum disahkan tetap belum dapat dipakai.
 */

import { kunciNamaSemua } from "@/lib/nama-pegawai-sipp";
import { namaMirip, namaSama } from "@/lib/tautan-akun-sipp";

export type BerkasTtdRingkas = {
  id: number;
  namaPejabat: string;
  penggunaId: string;
  disahkan: boolean;
};

export type AkunTtd = {
  id: string;
  nama: string;
  /** roleId - disalin ke kolom peran tanda tangan, seperti pemilih manual. */
  peran: string;
  subPeran: string;
  isActive?: boolean;
};

export type KelompokTtd = "pasti" | "ganda" | "tidak-ketemu" | "sudah" | "sudah-beda" | "tanpa-nama";

export type HasilTtd = {
  id: number;
  namaPejabat: string;
  disahkan: boolean;
  kelompok: KelompokTtd;
  /** Untuk "pasti": akun tujuan. Untuk "sudah"/"sudah-beda": akun yang tertaut. */
  akun: AkunTtd | null;
  /** Untuk "ganda": semua akun bernama sama. */
  calon: AkunTtd[];
  /** Untuk "tidak-ketemu": akun bernama MIRIP - hanya petunjuk. */
  mirip: AkunTtd[];
  sebab: string;
};

export type JawabanAkunNama = { jenis: "pasti"; akun: AkunTtd } | { jenis: "ganda"; calon: AkunTtd[] } | { jenis: "tidak" };

/** Akun AKTIF yang kunci namanya sama persis dengan nama ini. */
export function akunPastiUntukNama(nama: string, akun: AkunTtd[]): JawabanAkunNama {
  if (kunciNamaSemua(nama).size === 0) return { jenis: "tidak" };
  const calon = akun.filter((a) => a.isActive !== false && namaSama(a.nama, nama));
  if (calon.length === 1) return { jenis: "pasti", akun: calon[0] };
  if (calon.length > 1) return { jenis: "ganda", calon };
  return { jenis: "tidak" };
}

export function cocokkanTtdKeAkun(berkas: BerkasTtdRingkas[], akun: AkunTtd[]): HasilTtd[] {
  const perId = new Map(akun.map((a) => [a.id, a]));
  return berkas.map((b): HasilTtd => {
    const dasar = { id: b.id, namaPejabat: b.namaPejabat, disahkan: b.disahkan, calon: [] as AkunTtd[], mirip: [] as AkunTtd[] };
    if (!b.namaPejabat.trim()) {
      return { ...dasar, kelompok: "tanpa-nama", akun: null, sebab: "Belum dinamai." };
    }
    if (b.penggunaId) {
      const tertaut = perId.get(b.penggunaId) ?? null;
      if (!tertaut) {
        return { ...dasar, kelompok: "sudah-beda", akun: null, sebab: "Tertaut ke akun yang tidak ada/nonaktif - periksa manual." };
      }
      const sama = namaSama(tertaut.nama, b.namaPejabat);
      return {
        ...dasar,
        kelompok: sama ? "sudah" : "sudah-beda",
        akun: tertaut,
        sebab: sama ? "Sudah bertaut." : `Tertaut ke akun bernama lain (${tertaut.nama}) - periksa manual.`,
      };
    }
    const jawab = akunPastiUntukNama(b.namaPejabat, akun);
    if (jawab.jenis === "pasti") {
      return { ...dasar, kelompok: "pasti", akun: jawab.akun, sebab: "Nama sama persis dengan satu akun aktif." };
    }
    if (jawab.jenis === "ganda") {
      return { ...dasar, kelompok: "ganda", akun: null, calon: jawab.calon, sebab: `Nama sama dengan ${jawab.calon.length} akun aktif.` };
    }
    const mirip = akun.filter((a) => a.isActive !== false && namaMirip(a.nama, b.namaPejabat));
    return {
      ...dasar,
      kelompok: "tidak-ketemu",
      akun: null,
      mirip,
      sebab: mirip.length > 0 ? `Tidak ada yang sama persis; ${mirip.length} akun bernama mirip.` : "Tidak ada akun yang namanya sama.",
    };
  });
}

export function ringkasTtd(hasil: HasilTtd[]): Record<KelompokTtd, number> & { jumlah: number; bernama: number } {
  const r = { pasti: 0, ganda: 0, "tidak-ketemu": 0, sudah: 0, "sudah-beda": 0, "tanpa-nama": 0 } as Record<KelompokTtd, number>;
  for (const h of hasil) r[h.kelompok] += 1;
  return { ...r, jumlah: hasil.length, bernama: hasil.length - r["tanpa-nama"] };
}
