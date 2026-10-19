/**
 * TTE BSrE per pejabat (19 Okt 2026) - bentuk data dan penyaring hak, MURNI.
 *
 * Yang dikenal HANYA cara tanda tangan dan identitas sertifikat (NIK / ID
 * pengguna BSrE). Tidak ada tempat untuk passphrase: ia diminta kepada pejabat
 * tiap kali menandatangani dan tidak disimpan.
 */

export type CaraTtd = "gambar" | "tte";

/** Baris mentah dari bot (hanya kolom yang dipakai). */
export type BarisTteMentah = {
  id: number;
  namaPejabat?: string;
  jabatan?: string;
  disahkan?: boolean;
  penggunaId?: string;
  caraTtd?: string;
  nikBsre?: string;
};

export type BarisTte = {
  id: number;
  namaPejabat: string;
  jabatan: string;
  disahkan: boolean;
  tertaut: boolean;
  /** Milik akun yang sedang melihat. */
  milikSaya: boolean;
  caraTtd: CaraTtd;
  nikBsre: string;
};

export const KETERANGAN_PASSPHRASE =
  "Passphrase diminta kepada pejabat setiap kali menandatangani dan tidak disimpan.";

export const KETERANGAN_DIALOG_PASSPHRASE =
  "Bila BSrE sudah tersambung, permintaan passphrase muncul sebagai dialog kepada pejabat pemilik sertifikat saat menandatangani, bukan di panel petugas.";

/**
 * Baris yang boleh dilihat: Admin/Super Admin semua yang BERNAMA; pejabat lain
 * hanya yang ditautkan ke akunnya sendiri.
 */
export function petaTteSaya(baris: BarisTteMentah[], aku: { admin: boolean; penggunaId: string }): BarisTteMentah[] {
  const bernama = (Array.isArray(baris) ? baris : []).filter((b) => String(b.namaPejabat ?? "").trim());
  if (aku.admin) return bernama;
  const id = String(aku.penggunaId || "").trim();
  if (!id) return [];
  return bernama.filter((b) => String(b.penggunaId ?? "") === id);
}

export function bentukBarisTte(b: BarisTteMentah, aku: { admin: boolean; penggunaId: string }): BarisTte {
  const milikSaya = Boolean(aku.penggunaId) && String(b.penggunaId ?? "") === aku.penggunaId;
  return {
    id: Number(b.id),
    namaPejabat: String(b.namaPejabat ?? ""),
    jabatan: String(b.jabatan ?? ""),
    disahkan: b.disahkan === true,
    tertaut: Boolean(String(b.penggunaId ?? "").trim()),
    milikSaya,
    caraTtd: String(b.caraTtd ?? "gambar") === "tte" ? "tte" : "gambar",
    // NIK hanya untuk admin dan pemiliknya; selain itu tidak pernah dikirim.
    nikBsre: aku.admin || milikSaya ? String(b.nikBsre ?? "") : "",
  };
}

/** NIK/ID pengguna BSrE yang sah: 5-32 huruf/angka/titik/garis. Kosong = sah (belum diisi). */
export function nikBsreSah(nilai: string): boolean {
  const n = String(nilai ?? "").trim();
  return n === "" || /^[A-Za-z0-9._-]{5,32}$/.test(n);
}

const KALIMAT: Record<string, string> = {
  tte_belum_tersambung: "BSrE belum tersambung - cara TTE belum dapat dipilih.",
  nik_bsre_kosong: "Isi NIK / ID pengguna BSrE lebih dahulu.",
  nik_bsre_tidak_sah: "NIK / ID pengguna BSrE tidak sah (5-32 huruf, angka, titik atau garis).",
  passphrase_tidak_disimpan: "Passphrase tidak disimpan di server.",
  cara_ttd_tidak_dikenal: "Cara tanda tangan tidak dikenal.",
  tanda_tangan_tidak_ketemu: "Tanda tangan tidak ditemukan - muat ulang daftarnya.",
  id_tidak_sah: "Nomor tanda tangan tidak sah.",
};

export function kalimatTte(kode: string): string {
  const k = String(kode || "").trim();
  if (KALIMAT[k]) return KALIMAT[k];
  return /^[a-z0-9_]+$/.test(k) ? k.replace(/_/g, " ") : k;
}
