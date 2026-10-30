/**
 * ============================================================================
 * PUSTAKA KALIMAT PRIBADI - ATURAN MURNI (30 Okt 2026)
 * ============================================================================
 *
 * Hakim dan panitera pengganti menyimpan paragraf yang sering mereka pakai per jenis perkara, status, dan isian teks. Berkas ini hanya
 * aturan murni (membersihkan masukan, memilih kalimat yang berlaku, mengurutkan menurut kecocokan dan pemakaian); penyimpanan di
 * src/server/modules/aleta-ecourt/kalimat-pribadi.ts, tampilan di ekstensi-sipp/blangko-derry-pustaka.js.
 */

export const BATAS_TEKS_KALIMAT = 6000;
export const BATAS_JUDUL_KALIMAT = 80;
export const BATAS_KALIMAT_PER_PEMILIK = 300;
/** Golongan yang boleh dipilih sebagai tujuan berbagi (kunci matriks-peran). */
export const GOLONGAN_BAGI = ["hakim", "pimpinan", "panitera", "panmud", "pp", "jurusita", "ptsp"] as const;

export type KalimatMasukan = { id: string; jenisPerkara: string; status: string; kode: string; judul: string; teks: string; dibagikan: string[] };
export type HasilBersih = { ok: true; nilai: KalimatMasukan } | { ok: false; sebab: string };

const buangKendali = (x: string) => x.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** Kunci jenis perkara: huruf kecil, spasi dilebur, panjang dibatasi ("Cerai Gugat" -> "cerai gugat"). */
export function kunciJenisPerkara(x: unknown): string {
  return String(x ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9. \-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function kunciStatusPerkara(x: unknown): string {
  return String(x ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function bersihkanKalimat(mentah: unknown): HasilBersih {
  const m = mentah && typeof mentah === "object" && !Array.isArray(mentah) ? (mentah as Record<string, unknown>) : null;
  if (!m) return { ok: false, sebab: "Masukan kalimat tidak sah." };
  const teks = buangKendali(String(m.teks ?? "").replace(/\r\n?/g, "\n")).trim();
  if (teks.length < 5) return { ok: false, sebab: "Kalimat terlalu pendek untuk disimpan." };
  if (teks.length > BATAS_TEKS_KALIMAT) return { ok: false, sebab: `Kalimat terlalu panjang (paling banyak ${BATAS_TEKS_KALIMAT} huruf).` };
  const kode = String(m.kode ?? "").trim();
  if (kode && !/^\d{3,5}$/.test(kode)) return { ok: false, sebab: "Nomor isian harus 3-5 angka." };
  const id = String(m.id ?? "").trim();
  if (id && !/^[A-Za-z0-9_-]{8,64}$/.test(id)) return { ok: false, sebab: "Pengenal kalimat tidak sah." };
  const judulMentah = buangKendali(String(m.judul ?? "")).replace(/\s+/g, " ").trim();
  const judul = (judulMentah || teks.replace(/\s+/g, " ")).slice(0, BATAS_JUDUL_KALIMAT);
  const bagi = Array.isArray(m.dibagikan) ? m.dibagikan : typeof m.dibagikan === "string" && m.dibagikan ? m.dibagikan.split(",") : [];
  const dibagikan = Array.from(new Set(bagi.map((g) => String(g).trim()).filter((g) => (GOLONGAN_BAGI as readonly string[]).includes(g))));
  return { ok: true, nilai: { id, jenisPerkara: kunciJenisPerkara(m.jenisPerkara), status: kunciStatusPerkara(m.status), kode, judul, teks, dibagikan } };
}

export type BarisKalimat = {
  id: string;
  pemilikId: string;
  pemilikNama: string;
  jenisPerkara: string;
  status: string;
  kode: string;
  judul: string;
  teks: string;
  dibagikan: string[];
  dipakai: number;
  dipakaiTerakhir: string;
  diubahPada: string;
};

/** Berlaku untuk konteks ini? Ruas kosong pada kalimat = berlaku untuk semuanya. */
export function berlakuUntuk(k: Pick<BarisKalimat, "jenisPerkara" | "status" | "kode">, konteks: { jenisPerkara?: string; status?: string; kode?: string }): boolean {
  const jenis = kunciJenisPerkara(konteks.jenisPerkara);
  const status = kunciStatusPerkara(konteks.status);
  const kode = String(konteks.kode ?? "").trim();
  if (k.jenisPerkara && jenis && k.jenisPerkara !== jenis) return false;
  if (k.jenisPerkara && !jenis) return false;
  if (k.status && status && k.status !== status) return false;
  if (k.status && !status) return false;
  if (k.kode && kode && k.kode !== kode) return false;
  if (k.kode && !kode) return false;
  return true;
}

/** Kecocokan: makin spesifik makin tinggi (isian > jenis > status); milik sendiri sedikit di atas milik orang lain. */
export function skorKalimat(k: BarisKalimat, pembacaId: string): number {
  return (k.kode ? 4 : 0) + (k.jenisPerkara ? 2 : 0) + (k.status ? 1 : 0) + (k.pemilikId === pembacaId ? 0.5 : 0);
}

/** Urutan tampil: kecocokan, lalu paling sering dipakai, lalu paling baru dipakai/diubah. */
export function urutkanKalimat(daftar: BarisKalimat[], pembacaId: string): BarisKalimat[] {
  return daftar.slice().sort((a, b) => {
    const s = skorKalimat(b, pembacaId) - skorKalimat(a, pembacaId);
    if (s) return s;
    if (b.dipakai !== a.dipakai) return b.dipakai - a.dipakai;
    return String(b.dipakaiTerakhir || b.diubahPada).localeCompare(String(a.dipakaiTerakhir || a.diubahPada));
  });
}

/** Kalimat yang dibagikan kepada pembaca (salah satu golongannya tercantum) atau milik pembaca. */
export function terlihatOleh(k: Pick<BarisKalimat, "pemilikId" | "dibagikan">, pembacaId: string, golonganPembaca: readonly string[]): boolean {
  if (k.pemilikId === pembacaId) return true;
  return k.dibagikan.some((g) => golonganPembaca.includes(g));
}
