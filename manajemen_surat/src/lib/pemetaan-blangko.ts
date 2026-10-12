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

export const JENIS_PEMETAAN = ["putusan", "relaas", "pbt", "bas"] as const;
export type JenisPemetaan = (typeof JENIS_PEMETAAN)[number];

export const LABEL_JENIS_PEMETAAN: Record<JenisPemetaan, string> = {
  putusan: "Putusan",
  relaas: "Relaas panggilan",
  pbt: "Pemberitahuan putusan",
  bas: "Berita acara sidang (BAS)",
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
    // 6 Okt (butir 10): sidang pertama PER PIHAK - kunci yang sama dengan yang
    // dibuat admin di server 2 Okt, supaya barisnya menjadi baris baku.
    { kunci: "relaas-panggilan-sidang-pertama-penggugat", sebutan: "Relaas panggilan sidang pertama - Penggugat" },
    { kunci: "relaas-panggilan-sidang-pertama-tergugat", sebutan: "Relaas panggilan sidang pertama - Tergugat" },
    { kunci: "relaas-panggilan-sidang-pertama-pemohon", sebutan: "Relaas panggilan sidang pertama - Pemohon" },
    { kunci: "relaas-panggilan-sidang-pertama-termohon", sebutan: "Relaas panggilan sidang pertama - Termohon" },
    {
      kunci: "panggilan-sidang-pertama",
      sebutan: "Relaas panggilan sidang P dan T (gabungan - hanya bila satu dokumen memanggil kedua pihak)",
    },
    { kunci: "panggilan-penggugat", sebutan: "Relaas panggilan sidang lanjutan - Penggugat" },
    { kunci: "panggilan-tergugat", sebutan: "Relaas panggilan sidang lanjutan - Tergugat" },
    { kunci: "panggilan-pemohon", sebutan: "Relaas panggilan sidang lanjutan - Pemohon" },
    { kunci: "panggilan-termohon", sebutan: "Relaas panggilan sidang lanjutan - Termohon" },
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
  // Perbaikan 2 Okt sore butir 6: jenis perkara ber-set BAS x keadaan sidang.
  // Disusun di bawah (KUNCI_BAKU_BAS) - fungsi, bukan daftar ketikan.
  bas: [],
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
  if (jenis === "putusan") return normalkanKunciPutusan(k);
  if (jenis === "bas") return normalkanKunciBas(k);
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
    const data = (e.data ?? {}) as { jenisAsli?: string; statusAsli?: string; catatan?: string };
    // P 12 Okt: baris status bawaan ("cerai gugat|dikabulkan|verstek") disarankan dengan kunci admin yang sama bentuknya
    // ("Cerai Gugat|Dikabulkan|verstek"), sehingga normalkanKunciPutusan & alatKunciPetaDariAdmin memetakannya kembali.
    const verstek = String(e.kunci).split("|")[2] === "verstek";
    const kunci = data.statusAsli
      ? `${String(data.jenisAsli || "")}|${data.statusAsli}${verstek ? "|verstek" : ""}`
      : String(data.jenisAsli || e.kunci);
    return { kunci, namaBerkas: String(e.nilai), catatan: String(data.catatan || "") };
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
 * (Diubah 6 Okt, butir 10 - per pihak; aturan lama yang memberi
 * panggilan-penggugat/pemohon blangko gabungan sudah dibuang.)
 *   relaas-panggilan-sidang-pertama-<pihak> -> "0. ... Sidang Pertama P/T"
 *   panggilan-<pihak> (sidang lanjutan)     -> "1. ... P/T (Sidang Lanjutan)"
 *   pbt-<pihak>                             -> "2. ... Pemberitahuan Putusan P/T"
 *   panggilan-sidang-pertama (tanpa pihak)  -> 3.b gabungan (cadangan)
 *   panggilan-ikrar -> ikrar talak (P dan T - hanya gabungan yang ada)
 *   delegasi, amplop -> blangko masing-masing
 *
 * Putusan TIDAK berbawaan di sini (lihat `saran`).
 */
/*
 * Perbaikan 6 Okt (butir 10): bawaan PER PIHAK. Sebelumnya panggilan-penggugat
 * dan panggilan-pemohon (sidang LANJUTAN) berbawaan blangko gabungan 3.b dan
 * pbt-* satu blangko tanpa pihak; kini tiap kunci berpihak menunjuk blangko
 * pihaknya (P untuk Penggugat/Pemohon, T untuk Tergugat/Termohon). Gabungan
 * hanya untuk kunci tanpa pihak (panggilan-sidang-pertama) dan ikrar talak -
 * satu-satunya blangko ikrar di folder derry memang "P dan T".
 */
const BAWAAN_KEADAAN: Record<string, { keadaan: KeadaanRelaas; pihak?: "pertama" | "kedua" | "keduanya" }> = {
  "relaas-panggilan-sidang-pertama-penggugat": { keadaan: "sidang-pertama", pihak: "pertama" },
  "relaas-panggilan-sidang-pertama-pemohon": { keadaan: "sidang-pertama", pihak: "pertama" },
  "relaas-panggilan-sidang-pertama-tergugat": { keadaan: "sidang-pertama", pihak: "kedua" },
  "relaas-panggilan-sidang-pertama-termohon": { keadaan: "sidang-pertama", pihak: "kedua" },
  "panggilan-sidang-pertama": { keadaan: "sidang-pertama", pihak: "keduanya" },
  "panggilan-penggugat": { keadaan: "sidang-ditunda", pihak: "pertama" },
  "panggilan-pemohon": { keadaan: "sidang-ditunda", pihak: "pertama" },
  "panggilan-tergugat": { keadaan: "sidang-ditunda", pihak: "kedua" },
  "panggilan-termohon": { keadaan: "sidang-ditunda", pihak: "kedua" },
  "panggilan-ikrar": { keadaan: "ikrar-talak" },
  delegasi: { keadaan: "delegasi" },
  amplop: { keadaan: "amplop" },
  "pbt-penggugat": { keadaan: "pemberitahuan-putusan", pihak: "pertama" },
  "pbt-pemohon": { keadaan: "pemberitahuan-putusan", pihak: "pertama" },
  "pbt-tergugat": { keadaan: "pemberitahuan-putusan", pihak: "kedua" },
  "pbt-termohon": { keadaan: "pemberitahuan-putusan", pihak: "kedua" },
};

export function bawaanPemetaan(jenis: JenisPemetaan): { kunci: string; sebutan: string; namaBerkas: string; catatan: string }[] {
  if (jenis === "putusan") return [];
  const hasil: { kunci: string; sebutan: string; namaBerkas: string; catatan: string }[] = [];
  for (const { kunci, sebutan } of KUNCI_BAKU[jenis]) {
    const aturan = BAWAAN_KEADAAN[kunci];
    // Berpihak: HANYA blangko pihak itu (tidak jatuh ke gabungan). Tanpa pihak:
    // blangko pertama keadaannya (ikrar, delegasi, amplop - masing-masing satu).
    const blangko = !aturan
      ? undefined
      : aturan.pihak
        ? BLANGKO_RELAAS.find((b) => b.keadaan === aturan.keadaan && b.pihak === aturan.pihak)
        : BLANGKO_RELAAS.find((b) => b.keadaan === aturan.keadaan);
    if (!blangko) continue;
    hasil.push({ kunci, sebutan, namaBerkas: blangko.berkas, catatan: blangko.label });
  }
  return hasil;
}

/**
 * ============================================================================
 * PERBAIKAN 2 OKT SORE (AGEN P) - KUNCI YANG DIPAHAMI, BUKAN HANYA DICOCOKKAN
 * ============================================================================
 *
 * Butir 2: admin menambah kunci sendiri ("relaas-panggilan-sidang-pertama-
 * pemohon", ...). Sebelum ini ekstensi hanya mencari daftar kunci tetap, jadi
 * kunci buatan sendiri tersimpan di server tetapi TIDAK PERNAH dipakai - tanpa
 * satu pun tanda. Kini tiap kunci DIURAIKAN menjadi (awalan, keadaan, pihak),
 * dan permintaan cetak memilih kunci yang paling KHUSUS yang cocok:
 *
 *   keadaan tepat (+4) > tanpa keadaan; pihak tepat (+2) > pihak umum
 *   penggugat/tergugat (+1) > tanpa pihak. Seri: kunci yang lebih panjang
 *   (lebih eksplisit), lalu abjad.
 *
 * "panggilan-<pihak>" tanpa keadaan = sidang LANJUTAN (arti sejak 30 Sep:
 * sidang pertama selalu "panggilan-sidang-pertama"). Kunci yang memuat kata
 * yang tidak dikenal ("panggilan-kuasa") TIDAK dibuang - disimpan dan tampil,
 * tetapi ditandai "tidak dikenali" dan tidak dipilih otomatis.
 *
 * CERMIN: ekstensi-sipp/jurusita.js (jurusitaUraiKunci / jurusitaPilihKunci)
 * memakai aturan yang SAMA; uji pemetaan-blangko-2okt.test.ts menjalankan
 * keduanya atas daftar kunci yang sama dan menuntut jawaban yang sama.
 */
export type AwalanRelaas = "panggilan" | "pbt" | "delegasi" | "amplop";
export type KeadaanKunci = "pertama" | "lanjutan" | "ikrar" | "";
export type PihakKunci = "penggugat" | "tergugat" | "pemohon" | "termohon" | "";
export type UraianKunciRelaas = { awalan: AwalanRelaas; keadaan: KeadaanKunci; pihak: PihakKunci; dikenal: boolean; asing: string[] };

const KATA_PIHAK: PihakKunci[] = ["penggugat", "tergugat", "pemohon", "termohon"];
/** Kata yang boleh ada tanpa mengubah arti kunci. */
const KATA_DIKENAL = new Set([
  "relaas",
  "panggilan",
  "sidang",
  "pbt",
  "pemberitahuan",
  "putusan",
  "isi",
  "dan",
  "untuk",
  "ke",
  "p",
  "t",
  "penggugat",
  "tergugat",
  "pemohon",
  "termohon",
  "delegasi",
  "amplop",
  "ikrar",
  "talak",
  "pertama",
  "lanjutan",
  "tundaan",
  "ditunda",
]);

export function uraiKunciRelaas(kunci: string): UraianKunciRelaas {
  const kata = normalkanKunci("relaas", kunci).split("-").filter(Boolean);
  const ada = (x: string) => kata.includes(x);
  const awalan: AwalanRelaas =
    ada("pbt") || ada("pemberitahuan") ? "pbt" : ada("delegasi") ? "delegasi" : ada("amplop") ? "amplop" : "panggilan";
  let keadaan: KeadaanKunci = ada("ikrar")
    ? "ikrar"
    : ada("pertama")
      ? "pertama"
      : ada("lanjutan") || ada("tundaan") || ada("ditunda")
        ? "lanjutan"
        : "";
  const pihak = (KATA_PIHAK.find((p) => ada(p)) ?? "") as PihakKunci;
  // "panggilan-<pihak>" tanpa keadaan = sidang lanjutan (arti 30 Sep).
  if (awalan === "panggilan" && !keadaan && pihak) keadaan = "lanjutan";
  const asing = kata.filter((k) => !KATA_DIKENAL.has(k));
  return { awalan, keadaan: awalan === "pbt" ? "" : keadaan, pihak, dikenal: asing.length === 0 && kata.length > 0, asing };
}

export type PermintaanRelaas = { awalan: AwalanRelaas; keadaan: KeadaanKunci; khusus: PihakKunci; umum: PihakKunci };

/** Nilai kecocokan satu kunci untuk satu permintaan; -1 = tidak boleh dipakai. */
export function nilaiKunciRelaas(kunci: string, minta: PermintaanRelaas): number {
  const u = uraiKunciRelaas(kunci);
  if (!u.dikenal || u.awalan !== minta.awalan) return -1;
  let nilai = 0;
  if (u.keadaan) {
    if (u.keadaan !== minta.keadaan) return -1;
    nilai += 4;
  }
  if (u.pihak) {
    if (u.pihak === minta.khusus) nilai += 2;
    else if (u.pihak === minta.umum && minta.umum !== minta.khusus) nilai += 1;
    else return -1;
  }
  return nilai;
}

/** Kunci terbaik dari daftar untuk permintaan ini, atau null. */
export function pilihKunciRelaas(kunciDaftar: string[], minta: PermintaanRelaas): string | null {
  let terbaik: { kunci: string; nilai: number } | null = null;
  for (const kunci of kunciDaftar) {
    const nilai = nilaiKunciRelaas(kunci, minta);
    if (nilai < 0) continue;
    if (
      !terbaik ||
      nilai > terbaik.nilai ||
      (nilai === terbaik.nilai &&
        (kunci.length > terbaik.kunci.length || (kunci.length === terbaik.kunci.length && kunci < terbaik.kunci)))
    ) {
      terbaik = { kunci, nilai };
    }
  }
  return terbaik ? terbaik.kunci : null;
}

const SEBUT_KEADAAN: Record<KeadaanKunci, string> = {
  pertama: "sidang pertama",
  lanjutan: "sidang lanjutan (tundaan)",
  ikrar: "sidang ikrar talak",
  "": "",
};

const besarAwal = (x: string) => `${x[0].toUpperCase()}${x.slice(1)}`;

/** Kalimat "dipakai saat ..." untuk satu kunci relaas/pbt - kolom layar admin dan laporan. */
export function kapanDipakaiRelaas(kunci: string): { dikenal: boolean; dipakai: string } {
  const u = uraiKunciRelaas(kunci);
  if (!u.dikenal) {
    return {
      dikenal: false,
      dipakai: `Tidak dikenali ekstensi (kata "${u.asing.join(", ") || kunci}") - disimpan, tetapi tidak dipilih otomatis.`,
    };
  }
  const pihak = u.pihak
    ? u.pihak === "penggugat" || u.pihak === "tergugat"
      ? `${besarAwal(u.pihak)} (juga ${u.pihak === "penggugat" ? "Pemohon" : "Termohon"} bila kunci ${u.pihak === "penggugat" ? "pemohon" : "termohon"}-nya tidak diatur)`
      : `${besarAwal(u.pihak)} (permohonan / cerai talak)`
    : "";
  if (u.awalan === "pbt") return { dikenal: true, dipakai: `Pemberitahuan isi putusan${pihak ? ` kepada ${pihak}` : " - pihak mana pun (cadangan)"}.` };
  if (u.awalan === "delegasi") {
    return { dikenal: true, dipakai: "Permohonan bantuan panggilan (delegasi) - cetak dari portal; ekstensi belum punya jalur cetak delegasi." };
  }
  if (u.awalan === "amplop") {
    return { dikenal: true, dipakai: "Amplop panggilan surat tercatat - cetak dari portal; ekstensi belum punya jalur cetak amplop." };
  }
  const keadaan = u.keadaan ? SEBUT_KEADAAN[u.keadaan] : "sidang mana pun (cadangan terakhir)";
  const ekor = pihak ? ` - ${pihak}` : u.keadaan === "pertama" || u.keadaan === "ikrar" ? " - P dan T" : "";
  return { dikenal: true, dipakai: `Panggilan ${keadaan}${ekor}.` };
}

/**
 * ============================================================================
 * PUTUSAN PER JENIS PERKARA DAN PER STATUS PUTUSAN (BUTIR 3)
 * ============================================================================
 *
 * Kunci teks, tanpa migrasi: "Cerai Gugat" (jenis saja - perilaku lama),
 * "Cerai Gugat|Dikabulkan", "Cerai Gugat|Dikabulkan|verstek". Kosong = jatuh
 * ke kunci yang kurang khusus: status+verstek -> status -> jenis.
 *
 * Daftar status DIBACA dari sipp_donggala (HANYA SELECT, 2 Okt 2026):
 *   SELECT id, nama FROM status_putusan WHERE jenis_pengadilan = 4
 *     AND jenis_perkara_id = 1 AND aktif = 'Y'
 * diurutkan menurut pemakaian di perkara_putusan satker ini:
 *   62 Dikabulkan 8.909 · 67 Dicabut 507 (+28 baris id 7 "Dicabut" peradilan
 *   umum) · 65 Digugurkan 256 · 93 Gugur 123 · 64 Tidak Dapat Diterima 75 ·
 *   63 Ditolak 53 · 66 Dicoret dari Register 34 · 85 Perdamaian 8 ·
 *   92 Dismissal 0. "Verstek" BUKAN status SIPP - medan tersendiri (verstek
 *   Y/T di blangko Putusan Akhir), jadi ia penanda tambahan di kunci.
 */
export const STATUS_PUTUSAN_SIPP = [
  { id: 62, nama: "Dikabulkan" },
  { id: 67, nama: "Dicabut" },
  { id: 65, nama: "Digugurkan" },
  { id: 93, nama: "Gugur" },
  { id: 64, nama: "Tidak Dapat Diterima" },
  { id: 63, nama: "Ditolak" },
  { id: 66, nama: "Dicoret dari Register" },
  { id: 85, nama: "Perdamaian" },
  { id: 92, nama: "Dismissal" },
] as const;

/** Status yang diberi baris "(verstek)" di layar admin (yang lain tetap boleh diketik). */
export const STATUS_BERVERSTEK = ["Dikabulkan"] as const;

const PADANAN_JENIS = new Map(
  (CERMIN_EKSTENSI["putusan.padanan-jenis"] as readonly { kunci: string; nilai: string }[]).map((e) => [e.nilai, e.kunci])
);

/** Sama dengan alatKunciJenis ekstensi (padanan TERTANAM): huruf kecil, spasi tunggal, nama lain SIPP dipadankan. */
export function kunciJenisPerkara(jenis: unknown): string {
  const bersih = String(jenis ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return PADANAN_JENIS.get(bersih) ?? bersih;
}

/** "DIKABULKAN (verstek)" -> "dikabulkan". Sama dengan alatKunciStatusPutusan ekstensi. */
export function kunciStatusPutusan(status: unknown): string {
  return String(status ?? "")
    .replace(/\(.*?\)/g, " ")
    .replace(/\bverstek\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function statusBaku(status: string): string {
  const k = kunciStatusPutusan(status);
  const baku = STATUS_PUTUSAN_SIPP.find((s) => s.nama.toLowerCase() === k);
  return baku ? baku.nama : rapat(status.replace(/\(.*?\)/g, " ").replace(/\bverstek\b/gi, " "), 80);
}

function normalkanKunciPutusan(k: string): string {
  if (!k.includes("|")) return k;
  const [jenis = "", status = "", tanda = ""] = k.split("|").map((x) => rapat(x, 80));
  const verstek = /verstek/i.test(tanda) || /verstek/i.test(status);
  const s = status ? statusBaku(status) : "";
  if (!s) return jenis;
  return verstek ? `${jenis}|${s}|verstek` : `${jenis}|${s}`;
}

export type UraianKunciPutusan = { jenis: string; status: string; verstek: boolean };

export function uraiKunciPutusan(kunci: string): UraianKunciPutusan {
  const [jenis, status, tanda] = normalkanKunciPutusan(rapat(kunci, 120)).split("|");
  return { jenis: jenis || "", status: status || "", verstek: tanda === "verstek" };
}

/**
 * Blangko putusan untuk satu perkara dari peta {kunci admin: nama berkas}.
 * Pulang { kunci, namaBerkas, tingkat } atau null. Status perkara dibaca
 * dari isian putusan SIPP / data perkara (bukan ditebak).
 *
 * CERMIN: ekstensi-sipp/panel-alat.js alatPetaUntukPerkara (dijaga uji).
 */
export function pilihBlangkoPutusan(
  peta: Record<string, string>,
  perkara: { jenis: string; status?: string; verstek?: boolean }
): { kunci: string; namaBerkas: string; tingkat: "status-verstek" | "status" | "jenis" } | null {
  const jenis = kunciJenisPerkara(perkara.jenis);
  if (!jenis) return null;
  const status = kunciStatusPutusan(perkara.status);
  const verstek = Boolean(perkara.verstek) || /verstek/i.test(String(perkara.status || ""));
  let jenisSaja: { kunci: string; namaBerkas: string } | null = null;
  let pakaiStatus: { kunci: string; namaBerkas: string } | null = null;
  let pakaiVerstek: { kunci: string; namaBerkas: string } | null = null;
  for (const [kunci, namaBerkas] of Object.entries(peta)) {
    if (!String(namaBerkas || "").trim()) continue;
    const u = uraiKunciPutusan(kunci);
    if (kunciJenisPerkara(u.jenis) !== jenis) continue;
    if (!u.status) jenisSaja = { kunci, namaBerkas };
    else if (status && kunciStatusPutusan(u.status) === status) {
      if (u.verstek) {
        if (verstek) pakaiVerstek = { kunci, namaBerkas };
      } else pakaiStatus = { kunci, namaBerkas };
    }
  }
  if (pakaiVerstek) return { ...pakaiVerstek, tingkat: "status-verstek" };
  if (pakaiStatus) return { ...pakaiStatus, tingkat: "status" };
  if (jenisSaja) return { ...jenisSaja, tingkat: "jenis" };
  return null;
}

export function kapanDipakaiPutusan(kunci: string): { dikenal: boolean; dipakai: string } {
  const u = uraiKunciPutusan(kunci);
  if (!u.jenis) return { dikenal: false, dipakai: "Jenis perkara kosong - tidak dipakai." };
  if (!u.status) return { dikenal: true, dipakai: `Putusan ${u.jenis} - status yang tidak diatur sendiri.` };
  const dikenalStatus = STATUS_PUTUSAN_SIPP.some((s) => s.nama === u.status);
  return {
    dikenal: dikenalStatus,
    dipakai: dikenalStatus
      ? `Putusan ${u.jenis} berstatus ${u.status}${u.verstek ? " (verstek)" : ""}.`
      : `Status "${u.status}" tidak ada di status_putusan SIPP - disimpan, tetapi tidak akan cocok.`,
  };
}

/**
 * ============================================================================
 * BERITA ACARA SIDANG (BAS) - BUTIR 6 DAN 8
 * ============================================================================
 *
 * Kunci "<jenis>|<sidang>|<kehadiran>":
 *   jenis      nama jenis perkara SIPP (padanan berlaku) atau "*" (semua)
 *   sidang     "1", "2", ... (urutan sidang), "lanjutan" (ke-2 dst.), atau
 *              kata agenda: "mediasi", "pembuktian", "putusan", "jawaban",
 *              "replik", "duplik", "kesimpulan"; "*" = sidang mana pun
 *   kehadiran  "semua-hadir" | "p-hadir" | "t-hadir" | "tidak-hadir" | "*"
 *              (dihadiri_oleh SIPP 1/2/3/4 - sandi borang
 *              jadwal_sidang_p_edit.php)
 *
 * Nilai kekhususan: jenis tepat +8, sidang tepat (nomor/agenda) +4,
 * "lanjutan" +2, kehadiran tepat +1. Tidak ada yang cocok = BAS massal
 * memakai usulan otomatisnya dari katalog (perilaku sebelum ini).
 *
 * FORMAT TANPA KEHADIRAN (keputusan pengguna 9 Okt 2026): bagian sidang
 * "gugur" atau "tunda-panggil" hanya dipakai untuk sidang yang LEWAT pukul
 * 14.00 WITA tanpa kehadiran sama sekali (tidak tercatat di SIPP, tidak
 * mengambil nomor antrian) - BAS massal lalu mengusulkan putus gugur atau
 * tunda panggil para pihak. Nilainya +16 dan kunci biasa tidak berlaku bagi
 * sidang itu; sebaliknya kunci format tidak pernah cocok dengan sidang lain.
 *
 * PENYIMPANAN TANPA MIGRASI: CHECK migrasi 0054 hanya menerima jenis
 * putusan/relaas/pbt. Baris BAS disimpan berjenis 'relaas' dengan kunci
 * berawalan "bas|" (lihat modul server) - kunci relaas biasa tidak pernah
 * memuat "|" (normalkanKunci menggantinya dengan "-"), jadi keduanya tidak
 * dapat bertabrakan.
 */
export const AWALAN_KUNCI_BAS_DB = "bas|";

export const KEHADIRAN_BAS = [
  { kode: "semua-hadir", sandi: 1, sebutan: "P & T hadir" },
  { kode: "p-hadir", sandi: 2, sebutan: "hanya P hadir (T tidak hadir)" },
  { kode: "t-hadir", sandi: 3, sebutan: "hanya T hadir (P tidak hadir)" },
  { kode: "tidak-hadir", sandi: 4, sebutan: "P & T tidak hadir" },
] as const;

export const AGENDA_BAS: Record<string, RegExp> = {
  mediasi: /mediasi/i,
  pembuktian: /bukti|saksi/i,
  putusan: /putus|musyawarah/i,
  jawaban: /jawab/i,
  replik: /replik/i,
  duplik: /duplik/i,
  kesimpulan: /kesimpulan/i,
};

/**
 * Bagian sidang khusus "format tanpa kehadiran" (9 Okt 2026). Diperiksa
 * SEBELUM pola lanjutan/tunda: "tunda-panggil" memuat kata "tunda".
 */
export const FORMAT_BAS_TANPA_HADIR = ["gugur", "tunda-panggil"] as const;
export type FormatBasTanpaHadir = (typeof FORMAT_BAS_TANPA_HADIR)[number];

/**
 * Nama blangko untuk format tanpa kehadiran. Garis bawah ikut diterima: ABT
 * menyimpan "&" sebagai "_" pada nama berkas yang diunggah ("34-a. BAS Putus
 * P _ T Tidak Hadir (Gugur).rtf" di server).
 */
export const POLA_BLANGKO_FORMAT: Record<FormatBasTanpaHadir, RegExp[]> = {
  gugur: [/gugur/i, /\bp\s*(?:&|_|dan)\s*t\s+tidak\s+hadir/i],
  "tunda-panggil": [/tunda\s+panggil\s+p\s*(?:&|_|dan)\s*t\b/i, /\bp\s*(?:&|_|dan)\s*t\s+tidak\s+hadir/i],
};

export function cocokPolaFormat(format: FormatBasTanpaHadir, namaBerkas: string): boolean {
  const n = String(namaBerkas || "").replace(/\s+/g, " ");
  return POLA_BLANGKO_FORMAT[format].every((r) => r.test(n));
}

/** Keadaan baku tab BAS per jenis perkara - urutan tampilan. */
export const KEADAAN_BAS_BAKU = [
  { kunci: "1|semua-hadir", sebutan: "Sidang pertama - P & T hadir" },
  { kunci: "1|p-hadir", sebutan: "Sidang pertama - hanya P hadir (T tidak hadir)" },
  { kunci: "1|t-hadir", sebutan: "Sidang pertama - hanya T hadir" },
  { kunci: "1|tidak-hadir", sebutan: "Sidang pertama - P & T tidak hadir" },
  { kunci: "lanjutan|semua-hadir", sebutan: "Sidang lanjutan - P & T hadir" },
  { kunci: "lanjutan|p-hadir", sebutan: "Sidang lanjutan - hanya P hadir (verstek)" },
  { kunci: "mediasi|*", sebutan: "Laporan mediasi" },
  { kunci: "pembuktian|*", sebutan: "Pembuktian" },
  { kunci: "putusan|*", sebutan: "Pembacaan putusan" },
  { kunci: "gugur|*", sebutan: "Lewat 14.00 tanpa kehadiran - putus gugur" },
  { kunci: "tunda-panggil|*", sebutan: "Lewat 14.00 tanpa kehadiran - tunda panggil para pihak" },
] as const;

/** Jenis perkara yang punya set BAS di pohon-blangko.ts (SET_BLANGKO) - grup tab BAS. */
export const JENIS_BAS_BAKU = ["Cerai Gugat", "Cerai Talak", "Itsbat Nikah", "Asal Usul Anak"] as const;

function normalkanBagianSidang(x: string): string {
  const k = x.toLowerCase().replace(/\s+/g, " ").trim();
  if (!k || k === "*" || k === "semua") return "*";
  const angka = /^(?:sidang\s*)?(?:ke\s*-?\s*)?(\d+)$/.exec(k) || /^bas\s*(\d+)$/.exec(k);
  if (angka) return String(Number(angka[1]));
  // Format tanpa kehadiran lebih dulu - "tunda panggil" memuat "tunda".
  if (/gugur/.test(k)) return "gugur";
  if (/tunda[\s-]*panggil|panggil[\s-]*para[\s-]*pihak/.test(k)) return "tunda-panggil";
  if (/pertama/.test(k)) return "1";
  if (/lanjut|tunda/.test(k)) return "lanjutan";
  for (const nama of Object.keys(AGENDA_BAS)) if (k.includes(nama)) return nama;
  return k.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalkanBagianKehadiran(x: string): string {
  const k = x.toLowerCase().replace(/[^a-z0-9&]+/g, " ").replace(/\s+/g, " ").trim();
  if (!k || k === "*" || k === "semua") return "*";
  const kode = k.replace(/\s+/g, "-");
  if (KEHADIRAN_BAS.some((h) => h.kode === kode)) return kode;
  if (/^(semua( pihak)? hadir|p (&|dan) t hadir|para pihak hadir)$/.test(k)) return "semua-hadir";
  if (/^(p (&|dan) t tidak hadir|para pihak tidak hadir|tidak ada( pihak)? hadir)$/.test(k)) return "tidak-hadir";
  if (/^(hanya )?p hadir|verstek/.test(k)) return "p-hadir";
  if (/^(hanya )?t hadir/.test(k)) return "t-hadir";
  return kode;
}

function normalkanKunciBas(k: string): string {
  const [jenis = "", sidang = "", kehadiran = ""] = k.split("|").map((x) => rapat(x, 80));
  const j = !jenis || jenis === "*" || /^semua/i.test(jenis) ? "*" : jenis;
  return [j, normalkanBagianSidang(sidang), normalkanBagianKehadiran(kehadiran)].join("|");
}

export type UraianKunciBas = { jenis: string; sidang: string; kehadiran: string; dikenal: boolean };

export function uraiKunciBas(kunci: string): UraianKunciBas {
  const [jenis, sidang, kehadiran] = normalkanKunciBas(rapat(kunci, 120)).split("|");
  const sidangDikenal =
    sidang === "*" ||
    sidang === "lanjutan" ||
    /^\d+$/.test(sidang) ||
    sidang in AGENDA_BAS ||
    (FORMAT_BAS_TANPA_HADIR as readonly string[]).includes(sidang);
  const hadirDikenal = kehadiran === "*" || KEHADIRAN_BAS.some((h) => h.kode === kehadiran);
  return { jenis, sidang, kehadiran, dikenal: sidangDikenal && hadirDikenal };
}

export type SidangBas = {
  jenisPerkara: string;
  urutanSidang: number;
  agenda?: string;
  dihadiriOleh: number | null;
  /** Sidang lewat 14.00 tanpa kehadiran (9 Okt 2026) - hanya kunci format yang berlaku. */
  format?: FormatBasTanpaHadir;
};

export function nilaiKunciBas(kunci: string, s: SidangBas): number {
  const u = uraiKunciBas(kunci);
  if (!u.dikenal) return -1;
  let nilai = 0;
  if (u.jenis !== "*") {
    if (kunciJenisPerkara(u.jenis) !== kunciJenisPerkara(s.jenisPerkara)) return -1;
    nilai += 8;
  }
  const kunciFormat = (FORMAT_BAS_TANPA_HADIR as readonly string[]).includes(u.sidang);
  if (kunciFormat || s.format) {
    // Kunci format hanya bagi sidang berformat yang sama, dan sidang berformat
    // hanya memakai kunci format.
    if (!kunciFormat || s.format !== u.sidang) return -1;
    nilai += 16;
  } else if (u.sidang !== "*") {
    if (/^\d+$/.test(u.sidang)) {
      if (Number(u.sidang) !== Number(s.urutanSidang)) return -1;
      nilai += 4;
    } else if (u.sidang === "lanjutan") {
      if (!(Number(s.urutanSidang) >= 2)) return -1;
      nilai += 2;
    } else {
      if (!AGENDA_BAS[u.sidang].test(String(s.agenda || ""))) return -1;
      nilai += 4;
    }
  }
  if (u.kehadiran !== "*") {
    const h = KEHADIRAN_BAS.find((x) => x.kode === u.kehadiran);
    if (!h || h.sandi !== s.dihadiriOleh) return -1;
    nilai += 1;
  }
  return nilai;
}

/** Blangko BAS dari peta admin untuk satu sidang, atau null (= usulan otomatis). */
export function pilihBlangkoBasPeta(peta: Record<string, string>, s: SidangBas): { kunci: string; namaBerkas: string } | null {
  let terbaik: { kunci: string; namaBerkas: string; nilai: number } | null = null;
  for (const [kunci, namaBerkas] of Object.entries(peta)) {
    if (!String(namaBerkas || "").trim()) continue;
    const nilai = nilaiKunciBas(kunci, s);
    if (nilai < 0) continue;
    if (!terbaik || nilai > terbaik.nilai || (nilai === terbaik.nilai && kunci < terbaik.kunci)) terbaik = { kunci, namaBerkas, nilai };
  }
  return terbaik ? { kunci: terbaik.kunci, namaBerkas: terbaik.namaBerkas } : null;
}

export function kapanDipakaiBas(kunci: string): { dikenal: boolean; dipakai: string } {
  const u = uraiKunciBas(kunci);
  if (!u.dikenal) {
    return { dikenal: false, dipakai: `Bagian "${u.sidang}|${u.kehadiran}" tidak dikenali - disimpan, tetapi tidak dipilih otomatis.` };
  }
  const jenis = u.jenis === "*" ? "semua jenis perkara" : u.jenis;
  const SEBUTAN_FORMAT: Record<string, string> = {
    gugur: "sidang lewat 14.00 tanpa kehadiran yang diusulkan putus gugur",
    "tunda-panggil": "sidang lewat 14.00 tanpa kehadiran yang diusulkan tunda panggil para pihak",
  };
  const sidang =
    SEBUTAN_FORMAT[u.sidang] ??
    (u.sidang === "*"
      ? "sidang mana pun"
      : /^\d+$/.test(u.sidang)
        ? `sidang ke-${u.sidang}`
        : u.sidang === "lanjutan"
          ? "sidang ke-2 dst."
          : `agenda ${u.sidang}`);
  const hadir = u.kehadiran === "*" ? "" : `, ${KEHADIRAN_BAS.find((h) => h.kode === u.kehadiran)?.sebutan}`;
  return { dikenal: true, dipakai: `BAS ${jenis} - ${sidang}${hadir}.` };
}

/** Baris baku tab BAS: tiap jenis ber-set BAS x keadaan baku. */
export const KUNCI_BAKU_BAS: { kunci: string; sebutan: string }[] = JENIS_BAS_BAKU.flatMap((jenis) =>
  KEADAAN_BAS_BAKU.map((k) => ({ kunci: `${jenis}|${k.kunci}`, sebutan: `${jenis} - ${k.sebutan}` }))
);
KUNCI_BAKU.bas.push(...KUNCI_BAKU_BAS);

/** "dipakai saat" untuk kunci jenis mana pun. */
export function kapanDipakai(jenis: JenisPemetaan, kunci: string): { dikenal: boolean; dipakai: string } {
  if (jenis === "putusan") return kapanDipakaiPutusan(kunci);
  if (jenis === "bas") return kapanDipakaiBas(kunci);
  return kapanDipakaiRelaas(kunci);
}

/**
 * Saran tab BAS dari katalog blangko yang dibaca BAS massal (bot
 * blangko.katalog, folder set BAS pohon-blangko.ts) - benih bawaan butir 6.
 * Murni: katalog, pemilih set, dan pembaca kehadiran dikirim pemanggil
 * (susun.ts), supaya aturannya satu. Untuk tiap kunci baku: sidang ke-N =
 * jenjang "BAS N", "lanjutan" = BAS 2, kehadiran dari nama blangko, agenda
 * dari kata di keadaan/tindakan/judul/berkas.
 */
export type ButirKatalogBas = { berkas?: unknown; basKe?: unknown; keadaan?: unknown; tindakan?: unknown; judul?: unknown };

export function saranBasDariKatalog(
  katalog: Record<string, { terbaca: boolean; blangko: ButirKatalogBas[] } | undefined>,
  setUntuk: (jenis: string) => { folder: string; id: string }[],
  kehadiranDiNama: (keadaan: string) => { p: boolean | null; t: boolean | null }
): { kunci: string; namaBerkas: string; catatan: string }[] {
  const hasil: { kunci: string; namaBerkas: string; catatan: string }[] = [];
  for (const { kunci } of KUNCI_BAKU_BAS) {
    const u = uraiKunciBas(kunci);
    // Verstek lebih dulu bila T tidak hadir, contra selain itu - urutan susun.ts.
    const tanpaT = u.kehadiran === "p-hadir" || u.kehadiran === "tidak-hadir";
    const urut = [...setUntuk(u.jenis)].sort((a, b) => {
      const n = (id: string) => (id === "bas-verstek" ? (tanpaT ? 0 : 1) : id === "bas-contra" ? (tanpaT ? 1 : 0) : 2);
      return n(a.id) - n(b.id);
    });
    let pilih: { berkas: string; folder: string } | null = null;
    for (const s of urut) {
      const k = katalog[s.folder];
      if (!k || !k.terbaca) continue;
      for (const item of k.blangko) {
        const berkas = String(item.berkas ?? "").trim();
        if (!berkas) continue;
        const ke = Number(item.basKe) || 0;
        const teksSemua = `${String(item.keadaan ?? "")} ${String(item.tindakan ?? "")} ${String(item.judul ?? "")} ${berkas}`;
        if ((FORMAT_BAS_TANPA_HADIR as readonly string[]).includes(u.sidang)) {
          // Format tanpa kehadiran: menurut nama blangkonya saja.
          if (!cocokPolaFormat(u.sidang as FormatBasTanpaHadir, berkas)) continue;
          pilih = { berkas, folder: s.folder };
          break;
        }
        if (/^\d+$/.test(u.sidang) && ke !== Number(u.sidang)) continue;
        if (u.sidang === "lanjutan" && ke !== 2) continue;
        if (u.sidang in AGENDA_BAS && !AGENDA_BAS[u.sidang].test(teksSemua)) continue;
        if (u.kehadiran !== "*") {
          const h = KEHADIRAN_BAS.find((x) => x.kode === u.kehadiran)!;
          const harap = { p: h.sandi === 1 || h.sandi === 2, t: h.sandi === 1 || h.sandi === 3 };
          const nama = kehadiranDiNama(String(item.keadaan ?? ""));
          if (nama.p === null && nama.t === null) continue;
          if ((nama.p !== null && nama.p !== harap.p) || (nama.t !== null && nama.t !== harap.t)) continue;
        }
        pilih = { berkas, folder: s.folder };
        break;
      }
      if (pilih) break;
    }
    if (pilih) hasil.push({ kunci, namaBerkas: pilih.berkas, catatan: `dari katalog ${pilih.folder.split("/").pop()}` });
  }
  return hasil;
}
