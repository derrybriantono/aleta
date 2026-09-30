import { BLANGKO_RELAAS, type KeadaanRelaas } from "@/lib/pohon-blangko";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";

/**
 * ============================================================================
 * PEMETAAN BLANGKO - PUTUSAN, RELAAS, PEMBERITAHUAN PUTUSAN (kontrak K3)
 * ============================================================================
 *
 * Perbaikan 30 September 2026, butir 16 dan 17. Aturan murni: jenis yang
 * dikenal, kunci baku, sebutan bawaan, dan pembersihan masukan. Penyimpanan
 * di src/server/modules/aleta-ecourt/pemetaan-blangko.ts (tabel
 * aleta_pemetaan_blangko, migrasi 0054).
 *
 *   putusan  kunci = jenis perkara ("Cerai Gugat", "Cerai Talak", ...) -
 *            sama dengan petaBlangkoPutusan di ekstensi
 *   relaas   kunci = "panggilan-penggugat" | "panggilan-tergugat" |
 *            "panggilan-pemohon" | "panggilan-termohon" | "panggilan-ikrar"
 *            | kunci bebas lain
 *   pbt      kunci = "pbt-penggugat" | "pbt-tergugat" | ... bebas
 *
 * GET mengembalikan HANYA yang sudah diatur admin. Bawaan ekstensi untuk
 * putusan (ALAT_PETA_BAWAAN, dicerminkan di tipe keluaran) dikirim sebagai
 * `saran` - bukan sebagai butir - supaya ekstensi yang membaca server lebih
 * dulu tidak menimpa pemetaan lokal peramban dengan tebakan.
 */

export const JENIS_PEMETAAN = ["putusan", "relaas", "pbt"] as const;
export type JenisPemetaan = (typeof JENIS_PEMETAAN)[number];

export const LABEL_JENIS_PEMETAAN: Record<JenisPemetaan, string> = {
  putusan: "Putusan",
  relaas: "Relaas panggilan",
  pbt: "Pemberitahuan putusan",
};

/** Kunci baku per jenis, beserta sebutan bawaannya untuk layar. */
export const KUNCI_BAKU: Record<JenisPemetaan, { kunci: string; sebutan: string }[]> = {
  putusan: [
    { kunci: "Cerai Gugat", sebutan: "Cerai Gugat" },
    { kunci: "Cerai Talak", sebutan: "Cerai Talak" },
    { kunci: "Itsbat Nikah", sebutan: "Itsbat Nikah (Pengesahan Perkawinan/Istbat Nikah)" },
    { kunci: "Dispensasi Kawin", sebutan: "Dispensasi Kawin" },
    { kunci: "Penetapan Ahli Waris", sebutan: "Penetapan Ahli Waris (P3HP)" },
    { kunci: "Perwalian", sebutan: "Perwalian" },
    { kunci: "Wali Adhal", sebutan: "Wali Adhal (Wali Adhol)" },
    { kunci: "Poligami", sebutan: "Izin Poligami" },
    { kunci: "Harta Bersama", sebutan: "Harta Bersama" },
    { kunci: "Kewarisan", sebutan: "Kewarisan" },
    { kunci: "Pengangkatan Anak", sebutan: "Pengangkatan Anak" },
    { kunci: "Asal Usul Anak", sebutan: "Asal Usul Anak" },
  ],
  relaas: [
    { kunci: "panggilan-sidang-pertama", sebutan: "Relaas panggilan sidang pertama (P dan T)" },
    { kunci: "panggilan-penggugat", sebutan: "Relaas panggilan sidang - Penggugat" },
    { kunci: "panggilan-tergugat", sebutan: "Relaas panggilan sidang - Tergugat" },
    { kunci: "panggilan-pemohon", sebutan: "Relaas panggilan sidang - Pemohon" },
    { kunci: "panggilan-termohon", sebutan: "Relaas panggilan sidang - Termohon" },
    { kunci: "panggilan-ikrar", sebutan: "Relaas panggilan sidang ikrar talak" },
    { kunci: "delegasi", sebutan: "Permohonan bantuan panggilan (delegasi)" },
    { kunci: "amplop", sebutan: "Amplop panggilan surat tercatat" },
  ],
  pbt: [
    { kunci: "pbt-penggugat", sebutan: "Pemberitahuan isi putusan - Penggugat" },
    { kunci: "pbt-tergugat", sebutan: "Pemberitahuan isi putusan - Tergugat" },
    { kunci: "pbt-pemohon", sebutan: "Pemberitahuan isi putusan - Pemohon" },
    { kunci: "pbt-termohon", sebutan: "Pemberitahuan isi putusan - Termohon" },
  ],
};

export const BATAS_BUTIR_PEMETAAN = 200;
export const BATAS_PANJANG_NAMA = 300;
export const BATAS_PANJANG_CATATAN = 400;

export function jenisPemetaanSah(nilai: unknown): nilai is JenisPemetaan {
  return typeof nilai === "string" && (JENIS_PEMETAAN as readonly string[]).includes(nilai);
}

function rapat(teks: unknown, batas: number) {
  return String(teks ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, batas);
}

/**
 * Nama berkas: hanya karakter kendali yang dibuang dan tepinya dirapikan -
 * spasi di DALAM nama TIDAK dirapatkan. Nama blangko ABT memuat spasi yang
 * tak terlihat ("[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf"),
 * dan nama yang "dirapikan" tidak lagi menunjuk berkas yang ada.
 */
function bersihNama(teks: unknown) {
  return String(teks ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .trim()
    .slice(0, BATAS_PANJANG_NAMA);
}

/**
 * Kunci yang dinormalkan: spasi dirapatkan. Untuk relaas/pbt huruf kecil dan
 * tanda hubung (kunci mesin); untuk putusan tulisan jenis perkara dipakai apa
 * adanya (ekstensi mencocokkannya lewat padanan jenis, bukan di sini).
 */
export function normalkanKunci(jenis: JenisPemetaan, kunci: unknown): string {
  const k = rapat(kunci, 120);
  if (jenis === "putusan") return k;
  return k
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sebutanBawaan(jenis: JenisPemetaan, kunci: string): string {
  const baku = KUNCI_BAKU[jenis].find((b) => b.kunci.toLowerCase() === kunci.toLowerCase());
  return baku?.sebutan ?? kunci;
}

export type MasukanButir = { kunci: string; namaBerkas: string; catatan: string; sebutan: string };

export class GalatPemetaan extends Error {}

/**
 * Membersihkan daftar butir PUT. Butir tanpa nama berkas BUKAN galat -
 * artinya pemetaannya dihapus (dikembalikan di `dihapus`). Kunci ganda:
 * yang terakhir menang, seperti mengetik ulang satu baris.
 */
export function bersihkanButir(jenis: JenisPemetaan, masukan: unknown): { simpan: MasukanButir[]; hapus: string[] } {
  if (!Array.isArray(masukan)) throw new GalatPemetaan("butir harus berupa daftar.");
  if (masukan.length > BATAS_BUTIR_PEMETAAN) {
    throw new GalatPemetaan(`Paling banyak ${BATAS_BUTIR_PEMETAAN} butir sekali simpan.`);
  }
  const peta = new Map<string, MasukanButir | null>();
  for (const b of masukan) {
    if (!b || typeof b !== "object") throw new GalatPemetaan("Tiap butir harus berupa objek { kunci, namaBerkas }.");
    const isi = b as Record<string, unknown>;
    const kunci = normalkanKunci(jenis, isi.kunci);
    if (!kunci) throw new GalatPemetaan("Ada butir tanpa kunci.");
    const namaBerkas = bersihNama(isi.namaBerkas);
    peta.set(
      kunci,
      namaBerkas
        ? {
            kunci,
            namaBerkas,
            catatan: rapat(isi.catatan, BATAS_PANJANG_CATATAN),
            sebutan: rapat(isi.sebutan, 200),
          }
        : null
    );
  }
  const simpan: MasukanButir[] = [];
  const hapus: string[] = [];
  for (const [kunci, isi] of peta) {
    if (isi) simpan.push(isi);
    else hapus.push(kunci);
  }
  return { simpan, hapus };
}

/** Saran untuk layar admin: bawaan ekstensi untuk putusan (cermin tipe keluaran). */
export function saranPemetaan(jenis: JenisPemetaan): { kunci: string; namaBerkas: string; catatan: string }[] {
  if (jenis !== "putusan") return [];
  return CERMIN_EKSTENSI["putusan.peta-blangko"].map((e) => {
    const data = (e.data ?? {}) as { jenisAsli?: string; catatan?: string };
    return { kunci: String(data.jenisAsli || e.kunci), namaBerkas: String(e.nilai), catatan: String(data.catatan || "") };
  });
}

/**
 * ============================================================================
 * BAWAAN RELAAS & PBT - DIBENIH DARI BLANGKO_RELAAS (pohon-blangko.ts)
 * ============================================================================
 *
 * Permintaan agen E (tab Juru Sita): bawaan server SAMA dengan bawaan tertanam
 * ekstensi, yang disamakan dengan BLANGKO_RELAAS. Dibaca dari sana, tidak
 * diketik ulang - dua daftar yang diketik terpisah akan berselisih diam-diam.
 *
 *   panggilan-sidang-pertama, panggilan-penggugat, panggilan-pemohon
 *       -> blangko sidang pertama (P dan T): pihak pertama yang tidak hadir
 *          dipanggil dengan blangko yang memuat kedua pihak (keterangan
 *          BLANGKO_RELAAS "sidang-ditunda")
 *   panggilan-tergugat, panggilan-termohon -> blangko sidang lanjutan (T)
 *   panggilan-ikrar -> ikrar talak (P dan T)
 *   delegasi, amplop -> blangko masing-masing
 *   pbt-* -> Relaas Pemberitahuan Putusan (pihaknya dari baris PBT-nya)
 *
 * Putusan TIDAK berbawaan di sini (lihat `saran`).
 */
const BAWAAN_KEADAAN: Record<string, KeadaanRelaas> = {
  "panggilan-sidang-pertama": "sidang-pertama",
  "panggilan-penggugat": "sidang-pertama",
  "panggilan-pemohon": "sidang-pertama",
  "panggilan-tergugat": "sidang-ditunda",
  "panggilan-termohon": "sidang-ditunda",
  "panggilan-ikrar": "ikrar-talak",
  delegasi: "delegasi",
  amplop: "amplop",
  "pbt-penggugat": "pemberitahuan-putusan",
  "pbt-tergugat": "pemberitahuan-putusan",
  "pbt-pemohon": "pemberitahuan-putusan",
  "pbt-termohon": "pemberitahuan-putusan",
};

export function bawaanPemetaan(jenis: JenisPemetaan): { kunci: string; sebutan: string; namaBerkas: string; catatan: string }[] {
  if (jenis === "putusan") return [];
  const hasil: { kunci: string; sebutan: string; namaBerkas: string; catatan: string }[] = [];
  for (const { kunci, sebutan } of KUNCI_BAKU[jenis]) {
    const keadaan = BAWAAN_KEADAAN[kunci];
    const blangko = keadaan ? BLANGKO_RELAAS.find((b) => b.keadaan === keadaan) : undefined;
    if (!blangko) continue;
    hasil.push({ kunci, sebutan, namaBerkas: blangko.berkas, catatan: blangko.label });
  }
  return hasil;
}
