import type { KunciPeriodeSkp, PeranEvidenSkp, PeriodeSkp } from "@/lib/eviden-skp-tipe";
import { bacaIdSipp } from "@/lib/rekap-petugas";

/**
 * ============================================================================
 * UNDUHAN EVIDEN SKP - ALAMAT, PARAMETER, DAN NAMA BERKAS (2.40.0)
 * ============================================================================
 *
 * Satu berkas untuk dua pemakai: rute unduhan (membaca dan menolak
 * parameter) dan menu di halaman Rekap Hakim (menyusun alamatnya). Keduanya
 * membaca aturan yang SAMA - menu yang menyusun alamat dengan aturan sendiri
 * cepat atau lambat mengirim alamat yang ditolak rutenya.
 *
 * Tidak ada yang tahu apa itu perkara di sini: yang diatur hanya siapa (peran
 * dan ID SIPP), kapan (tahun dan periode), dokumen apa, dan formatnya.
 */

export const FORMAT_EVIDEN_SKP = ["pdf", "xlsx", "docx"] as const;
export type FormatEvidenSkp = (typeof FORMAT_EVIDEN_SKP)[number];

export const SEBUTAN_FORMAT_EVIDEN_SKP: Record<FormatEvidenSkp, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  docx: "Word",
};

export const JENIS_BERKAS_EVIDEN_SKP: Record<FormatEvidenSkp, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const PILIHAN_PERIODE_EVIDEN_SKP: ReadonlyArray<{ kunci: KunciPeriodeSkp; label: string }> = [
  { kunci: "tw1", label: "Triwulan I" },
  { kunci: "tw2", label: "Triwulan II" },
  { kunci: "tw3", label: "Triwulan III" },
  { kunci: "tw4", label: "Triwulan IV" },
  { kunci: "tahun", label: "Tahunan" },
];

/** Peran yang sudah dapat diunduh evidennya. Panitera dan juru sita menyusul. */
export const PERAN_EVIDEN_SKP: readonly PeranEvidenSkp[] = ["hakim"];

/**
 * Sebutan orang yang membuat eviden, untuk baris tanda tangan kiri
 * ("Hakim yang bersangkutan,"). Penggambar tidak mengenal peran - yang
 * dikenalnya hanya sebutan ini.
 */
export const SEBUTAN_PERAN_EVIDEN_SKP: Record<PeranEvidenSkp, string> = {
  hakim: "Hakim",
};

/** Kata kunci "semua dokumen" pada parameter ?dokumen=. */
export const SEMUA_DOKUMEN_EVIDEN_SKP = "semua";

export function peranEvidenSkpSah(nilai: unknown): nilai is PeranEvidenSkp {
  return (PERAN_EVIDEN_SKP as readonly string[]).includes(String(nilai));
}

export function periodeEvidenSkpSah(nilai: unknown): nilai is KunciPeriodeSkp {
  return PILIHAN_PERIODE_EVIDEN_SKP.some((p) => p.kunci === nilai);
}

export function formatEvidenSkpSah(nilai: unknown): nilai is FormatEvidenSkp {
  return (FORMAT_EVIDEN_SKP as readonly string[]).includes(String(nilai));
}

/**
 * Hari pertama periode ("2026-04-01" untuk tw2). Periode yang belum dimulai
 * ditolak rute daftar (bacaPermintaanEvidenSkp) dan rute unduhan dengan
 * kalimat yang sama, dan tidak dapat dipilih di menu.
 */
export function mulaiPeriodeEvidenSkp(periode: KunciPeriodeSkp, tahun: number): string {
  const bulan: Record<KunciPeriodeSkp, string> = { tw1: "01", tw2: "04", tw3: "07", tw4: "10", tahun: "01" };
  return `${tahun}-${bulan[periode]}-01`;
}

export const PESAN_PERIODE_BELUM_DIMULAI =
  "Periode itu belum dimulai - eviden hanya dapat disusun untuk periode yang sudah berjalan.";

/** Triwulan tempat tanggal ISO itu jatuh. */
export function triwulanDariTanggal(tanggalIso: string): KunciPeriodeSkp {
  const bulan = Number(/^\d{4}-(\d{2})-\d{2}/.exec(String(tanggalIso ?? ""))?.[1] ?? 0);
  if (bulan >= 1 && bulan <= 3) return "tw1";
  if (bulan >= 4 && bulan <= 6) return "tw2";
  if (bulan >= 7 && bulan <= 9) return "tw3";
  if (bulan >= 10 && bulan <= 12) return "tw4";
  return "tw1";
}

/**
 * Triwulan TERAKHIR YANG SUDAH SELESAI pada tanggal itu - bawaan menu unduhan.
 * Eviden yang diunggah ke eKinerja adalah eviden triwulan yang sudah lewat;
 * triwulan berjalan masih dapat dipilih, tetapi angkanya belum final.
 * Januari-Maret: Triwulan IV tahun sebelumnya.
 */
export function triwulanSelesaiTerakhir(tanggalIso: string): { tahun: number; periode: KunciPeriodeSkp } {
  const tahun = Number(/^(\d{4})-\d{2}-\d{2}/.exec(String(tanggalIso ?? ""))?.[1] ?? 0);
  const berjalan = triwulanDariTanggal(tanggalIso);
  const sebelumnya: Record<string, KunciPeriodeSkp> = { tw2: "tw1", tw3: "tw2", tw4: "tw3" };
  return berjalan === "tw1" ? { tahun: tahun - 1, periode: "tw4" } : { tahun, periode: sebelumnya[berjalan] };
}

/**
 * Tanggal kalender ISO yang SAH - bukan sekadar berpola. "2026-02-30" ditolak:
 * tanggal tanda tangan yang tidak pernah ada tidak boleh tercetak di dokumen
 * yang ditandatangani Ketua.
 */
export function bacaTanggalIso(nilai: unknown): string | null {
  const teks = String(nilai ?? "").trim();
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
  if (!cocok) return null;
  const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
  if (tahun < 2000 || tahun > 2100) return null;
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (tanggal.getUTCFullYear() !== tahun || tanggal.getUTCMonth() !== bulan - 1 || tanggal.getUTCDate() !== hari) {
    return null;
  }
  return teks;
}

export type PermintaanUnduhEvidenSkp = {
  peran: PeranEvidenSkp;
  id: number;
  tahun: number;
  periode: KunciPeriodeSkp;
  /** Kunci satu dokumen, atau "semua". */
  dokumen: string;
  format: FormatEvidenSkp;
  /** Tanggal tanda tangan; null = hari ini menurut WITA (diputuskan rute). */
  tanggal: string | null;
};

/**
 * Membaca ?peran=&id=&tahun=&periode=&dokumen=&format=&tanggal=.
 *
 * Tiap penolakan menyebut ruasnya dengan kalimat yang dapat dibaca petugas -
 * alamat unduhan dapat disalin dan dibagikan, dan yang menerimanya perlu tahu
 * bagian mana yang salah.
 */
export function bacaPermintaanUnduhEvidenSkp(
  p: URLSearchParams,
  /** Tanggal hari ini menurut WITA; kosong = periode tidak diperiksa sudah dimulai atau belum. */
  hariIni = ""
): { ok: true; nilai: PermintaanUnduhEvidenSkp } | { ok: false; pesan: string } {
  const peran = String(p.get("peran") ?? "").trim().toLowerCase();
  if (!peranEvidenSkpSah(peran)) {
    return { ok: false, pesan: "Peran eviden SKP yang dapat diunduh saat ini hanya hakim." };
  }
  // Pembaca ID yang sama dengan rute rekap-petugas dan rute daftar eviden.
  const id = bacaIdSipp(p.get("id"));
  if (id === null) return { ok: false, pesan: "ID SIPP harus bilangan bulat positif." };

  const tahunTeks = String(p.get("tahun") ?? "").trim();
  const tahun = Number(tahunTeks);
  if (!/^\d{4}$/.test(tahunTeks) || tahun < 2000 || tahun > 2100) {
    return { ok: false, pesan: "Tahun harus empat angka antara 2000 dan 2100." };
  }

  const periode = String(p.get("periode") ?? "").trim().toLowerCase();
  if (!periodeEvidenSkpSah(periode)) {
    return { ok: false, pesan: "Periode harus tw1, tw2, tw3, tw4, atau tahun." };
  }
  if (hariIni && mulaiPeriodeEvidenSkp(periode, tahun) > hariIni) {
    return { ok: false, pesan: PESAN_PERIODE_BELUM_DIMULAI };
  }

  const dokumen = String(p.get("dokumen") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(dokumen)) {
    return { ok: false, pesan: 'Dokumen harus kunci dokumen (huruf kecil, angka, tanda hubung) atau "semua".' };
  }

  const format = String(p.get("format") ?? "").trim().toLowerCase();
  if (!formatEvidenSkpSah(format)) return { ok: false, pesan: "Format harus pdf, xlsx, atau docx." };

  const tanggalTeks = String(p.get("tanggal") ?? "").trim();
  const tanggal = tanggalTeks ? bacaTanggalIso(tanggalTeks) : null;
  if (tanggalTeks && !tanggal) {
    return { ok: false, pesan: "Tanggal tanda tangan harus tanggal yang sah berbentuk YYYY-MM-DD." };
  }

  return { ok: true, nilai: { peran, id, tahun, periode, dokumen, format, tanggal } };
}

/** Alamat daftar dokumen (rute JSON), TANPA basePath - pemanggil membungkusnya dengan apiPath. */
export function alamatDaftarEvidenSkp(p: {
  peran: PeranEvidenSkp;
  id: number | string;
  tahun: number;
  periode: KunciPeriodeSkp;
}): string {
  const kueri = new URLSearchParams({ peran: p.peran, id: String(p.id), tahun: String(p.tahun), periode: p.periode });
  return `/api/aleta-ecourt/eviden-skp?${kueri.toString()}`;
}

/** Alamat unduhan satu dokumen atau "semua", TANPA basePath. */
export function alamatUnduhEvidenSkp(p: {
  peran: PeranEvidenSkp;
  id: number | string;
  tahun: number;
  periode: KunciPeriodeSkp;
  dokumen: string;
  format: FormatEvidenSkp;
  tanggal?: string | null;
}): string {
  const kueri = new URLSearchParams({
    peran: p.peran,
    id: String(p.id),
    tahun: String(p.tahun),
    periode: p.periode,
    dokumen: p.dokumen,
    format: p.format,
  });
  if (p.tanggal) kueri.set("tanggal", p.tanggal);
  return `/api/aleta-ecourt/eviden-skp/unduh?${kueri.toString()}`;
}

// ============================================================================
// NAMA BERKAS
// ============================================================================

/**
 * Membersihkan nama berkas dari huruf yang ditolak Windows (\ / : * ? " < > |),
 * bita kendali, dan tanda kutip melengkung (menjadi ' biasa, supaya nama di
 * dalam ZIP terbaca sama di pembuka arsip mana pun).
 *
 * Titik dan spasi di ujung ikut dibuang. Windows diam-diam membuangnya dari
 * nama berkas, sehingga nama yang tercatat di jejak audit tidak sama lagi
 * dengan yang ada di cakram; dan gelar "S.H." di ujung nama orang akan
 * menjadi "S.H..pdf" begitu ekstensinya ditambahkan.
 */
export function bersihkanNamaBerkas(nama: string, cadangan = "Eviden SKP"): string {
  const bersih = String(nama ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″"]/g, "'")
    .replace(/[\\/]/g, "-")
    .replace(/[:*?<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "")
    .trim();
  const hasil = bersih.slice(0, 180).replace(/[.\s]+$/g, "").trim();
  return hasil || cadangan;
}

/**
 * "Rekap Perkara Triwulan II Tahun 2026" -> "Rekap Perkara". Periodenya sudah
 * disebut di depan nama berkas; menyebutnya dua kali membuat nama terlalu
 * panjang untuk kolom penjelajah berkas.
 */
export function judulTanpaPeriode(judulLengkap: string, periode: Pick<PeriodeSkp, "labelPanjang" | "label" | "tahun">): string {
  let judul = String(judulLengkap ?? "").trim();
  const hapus = (bagian: string) => {
    if (!bagian) return;
    const letak = judul.toLowerCase().lastIndexOf(bagian.toLowerCase());
    if (letak >= 0) judul = `${judul.slice(0, letak)} ${judul.slice(letak + bagian.length)}`;
  };
  hapus(periode.labelPanjang);
  if (judul.trim() === String(judulLengkap ?? "").trim()) {
    // Bentuk lain yang mungkin dipakai katalog: "Triwulan II 2026", "Tahun 2026".
    hapus(`${periode.label} ${periode.tahun}`);
    hapus(`Tahun ${periode.tahun}`);
  }
  return judul.replace(/\s+/g, " ").replace(/[\s\-–—,:]+$/g, "").trim() || String(judulLengkap ?? "").trim();
}

/** "Eviden SKP 2026 - Triwulan II - Rekap Perkara - Nama.pdf" */
export function namaBerkasEvidenSkp(p: {
  periode: Pick<PeriodeSkp, "labelPanjang" | "label" | "tahun">;
  judulLengkap: string;
  nama: string;
  format: FormatEvidenSkp;
}): string {
  const inti = bersihkanNamaBerkas(
    `Eviden SKP ${p.periode.tahun} - ${p.periode.label} - ${judulTanpaPeriode(p.judulLengkap, p.periode)} - ${p.nama}`
  );
  return `${inti}.${p.format}`;
}

/**
 * Content-Disposition lampiran: nama ASCII untuk peramban lama, dan nama
 * UTF-8 utuh (RFC 5987) untuk yang lain.
 *
 * Tanda petik tunggal SENGAJA disandikan (%27): ia pemisah di dalam
 * filename*=UTF-8''..., dan nama hakim yang memuatnya ("Ma'ruf") membuat
 * peramban membuang filename* lalu memakai nama cadangan ASCII-nya.
 */
export function dispositionLampiran(nama: string): string {
  const cadangan =
    String(nama ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;]/g, "_")
      .slice(0, 180) || "eviden-skp";
  const utf8 = encodeURIComponent(String(nama ?? "")).replace(
    /['()*!]/g,
    (k) => `%${k.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${cadangan}"; filename*=UTF-8''${utf8}`;
}

/** Nama berkas dari Content-Disposition - filename* lebih dahulu. Kosong bila tidak ada. */
export function namaDariDisposition(nilai: string | null | undefined): string {
  const teks = String(nilai ?? "");
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(teks);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      // Sandi rusak - jatuh ke filename biasa.
    }
  }
  const biasa = /filename\s*=\s*"([^"]*)"/i.exec(teks) ?? /filename\s*=\s*([^;]+)/i.exec(teks);
  return biasa ? biasa[1].trim() : "";
}

/** "Eviden SKP 2026 - Triwulan II - Semua dokumen (PDF) - Nama.zip" */
export function namaZipEvidenSkp(p: {
  periode: Pick<PeriodeSkp, "label" | "tahun">;
  nama: string;
  format: FormatEvidenSkp;
}): string {
  const inti = bersihkanNamaBerkas(
    `Eviden SKP ${p.periode.tahun} - ${p.periode.label} - Semua dokumen (${SEBUTAN_FORMAT_EVIDEN_SKP[p.format]}) - ${p.nama}`
  );
  return `${inti}.zip`;
}
