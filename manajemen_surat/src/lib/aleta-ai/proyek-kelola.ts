/**
 * ============================================================================
 * ALETA Ai - PROYEK KELOLAAN SUPER ADMIN (murni): pemilihan pengetahuan, memori, blok prompt
 * ============================================================================
 *
 * Proyek bergaya Project Claude: instruksi + berkas pengetahuan + memori. Hanya Super Admin
 * yang mengelola; pengguna lain memakainya saat bertanya. Berkas pengetahuan TIDAK dikirim
 * semuanya: yang ikut hanya bagian yang relevan dengan pertanyaan (kata kunci), ditambah berkas
 * bertanda "selalu". Himpunan yang sama menghasilkan teks yang sama persis (urutan tetap) supaya
 * prompt caching tetap kena.
 */

export type BerkasPengetahuan = {
  id: string;
  nama: string;
  teks: string;
  /** true = selalu ikut ke prompt (aturan inti proyek). */
  selalu: boolean;
};

export type MemoriProyek = { id: string; isi: string };

export type BagianTerpilih = { berkasId: string; nama: string; bagian: number; dari: number; teks: string };

/** Berkas lebih panjang dari ini dipecah per bagian agar hanya bagian relevan yang dikirim. */
export const BATAS_BERKAS_UTUH_KARAKTER = 12_000;
export const UKURAN_BAGIAN_KARAKTER = 6_000;
export const BATAS_MEMORI_KARAKTER = 1_000;
export const BATAS_TOTAL_MEMORI_KARAKTER = 20_000;
export const BATAS_INSTRUKSI_KARAKTER = 100_000;

/** Anggaran karakter pengetahuan proyek per label mode (kira-kira 1 token per 3-4 karakter). */
export const ANGGARAN_PENGETAHUAN_KARAKTER: Readonly<Record<string, number>> = { Cepat: 20_000, Teliti: 60_000, Mendalam: 100_000 };
export const ANGGARAN_PENGETAHUAN_BAWAAN = 40_000;

const KATA_BERHENTI = new Set([
  "yang", "dari", "dan", "atau", "untuk", "dengan", "pada", "dalam", "adalah", "akan", "telah", "sudah", "ini", "itu", "bagaimana",
  "apa", "apakah", "tolong", "mohon", "buatkan", "berikan", "jelaskan", "tentang", "serta", "oleh", "saya", "kami", "kita", "dapat",
  "bisa", "agar", "supaya", "karena", "jika", "maka", "juga", "lebih", "harus", "perlu", "setelah", "sebelum",
]);

const lepasHuruf = (t: string) => String(t ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function kataKunciDariTeks(teks: string): string[] {
  const hasil = new Set<string>();
  for (const k of lepasHuruf(teks).split(/[^a-z0-9]+/)) {
    if (k.length >= 4 && !KATA_BERHENTI.has(k)) hasil.add(k);
  }
  return [...hasil].slice(0, 60);
}

function hitungKemunculan(tumpukan: string, kata: string): number {
  let n = 0;
  let dari = 0;
  for (;;) {
    const i = tumpukan.indexOf(kata, dari);
    if (i < 0) return n;
    n += 1;
    dari = i + kata.length;
    if (n >= 50) return n;
  }
}

/** Memecah teks panjang pada batas paragraf menjadi bagian-bagian sekitar UKURAN_BAGIAN_KARAKTER. */
export function pecahBagian(teks: string, ukuran = UKURAN_BAGIAN_KARAKTER): string[] {
  const t = String(teks ?? "");
  if (t.length <= ukuran) return [t];
  const hasil: string[] = [];
  let sisa = t;
  while (sisa.length > ukuran) {
    // Setiap bagian paling panjang `ukuran`; dipotong di batas paragraf, lalu baris, lalu paksa.
    let potong = sisa.lastIndexOf("\n\n", ukuran);
    if (potong < ukuran / 3) potong = sisa.lastIndexOf("\n", ukuran);
    if (potong < ukuran / 3) potong = ukuran;
    hasil.push(sisa.slice(0, potong).trim());
    sisa = sisa.slice(potong).trim();
  }
  if (sisa) hasil.push(sisa);
  return hasil.filter(Boolean);
}

/**
 * Memilih bagian pengetahuan untuk satu pertanyaan.
 *   1. Berkas "selalu" masuk dulu (urutan nama), dipotong bila melebihi anggaran.
 *   2. Bagian lain dinilai dari kata kunci pertanyaan: nama berkas (bobot 5) + jumlah kemunculan di bagian itu.
 *      Berkas yang namanya disebut utuh dalam pertanyaan mendapat tambahan besar.
 *   3. Skor tertinggi masuk sampai anggaran habis; skor 0 tidak pernah masuk.
 * Hasil diurutkan menurut nama berkas lalu nomor bagian (stabil).
 */
export function pilihPengetahuan(opsi: { berkas: readonly BerkasPengetahuan[]; teks: string; anggaran: number }): BagianTerpilih[] {
  const kata = kataKunciDariTeks(opsi.teks);
  const t = lepasHuruf(opsi.teks);
  const unit: Array<BagianTerpilih & { skor: number; selalu: boolean }> = [];
  for (const b of opsi.berkas) {
    const bagian = b.teks.length <= BATAS_BERKAS_UTUH_KARAKTER ? [b.teks] : pecahBagian(b.teks);
    const nama = lepasHuruf(b.nama);
    const namaTanpaAkhiran = nama.replace(/\.[a-z0-9]{1,5}$/, "");
    const disebut = namaTanpaAkhiran.length >= 4 && t.includes(namaTanpaAkhiran);
    const skorNama = kata.reduce((n, k) => (nama.includes(k) ? n + 5 : n), 0) + (disebut ? 100 : 0);
    bagian.forEach((isi, i) => {
      const bawah = lepasHuruf(isi);
      const skorIsi = kata.reduce((n, k) => n + hitungKemunculan(bawah, k), 0);
      unit.push({ berkasId: b.id, nama: b.nama, bagian: i + 1, dari: bagian.length, teks: isi, skor: skorNama + skorIsi, selalu: b.selalu });
    });
  }

  const terpilih: typeof unit = [];
  let terpakai = 0;
  const masukkan = (u: (typeof unit)[number]): boolean => {
    if (!u.teks.trim()) return false;
    if (terpakai + u.teks.length > opsi.anggaran) return false;
    terpilih.push(u);
    terpakai += u.teks.length;
    return true;
  };
  for (const u of unit.filter((x) => x.selalu).sort((a, b) => a.nama.localeCompare(b.nama) || a.bagian - b.bagian)) masukkan(u);
  for (const u of unit.filter((x) => !x.selalu && x.skor > 0).sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama) || a.bagian - b.bagian)) masukkan(u);
  terpilih.sort((a, b) => a.nama.localeCompare(b.nama) || a.berkasId.localeCompare(b.berkasId) || a.bagian - b.bagian);
  return terpilih.map(({ berkasId, nama, bagian, dari, teks }) => ({ berkasId, nama, bagian, dari, teks }));
}

/** Blok yang STABIL antar-giliran (memori disetujui, dan instruksi bila proyek bawaan ikut sebagai dasar; bila tidak, instruksi menjadi Core Prompt di blok pertama): kena prompt caching. */
export function rakitBlokProyekTetap(opsi: { nama: string; instruksi: string; memori: readonly MemoriProyek[]; instruksiTerpisah: boolean }): string {
  const bagian: string[] = [];
  const instruksi = opsi.instruksi.trim();
  if (instruksi && opsi.instruksiTerpisah) bagian.push(`# INSTRUKSI PROYEK "${opsi.nama}"\n\n${instruksi}`);
  const memori = opsi.memori.map((m) => `- ${m.isi.trim()}`).filter((x) => x.length > 2);
  if (memori.length) bagian.push(`# MEMORI PROYEK (fakta yang diingat proyek ini; anggap benar kecuali pengguna menyatakan lain)\n\n${memori.join("\n")}`);
  return bagian.join("\n\n");
}

export function rakitBlokPengetahuan(bagian: readonly BagianTerpilih[]): string {
  if (!bagian.length) return "";
  const isi = bagian.map((b) => `=== ${b.nama}${b.dari > 1 ? ` (bagian ${b.bagian}/${b.dari})` : ""} ===\n${b.teks.trim()}`);
  return `# PENGETAHUAN PROYEK (berkas yang relevan dengan permintaan ini)\n\n${isi.join("\n\n")}`;
}

/** Petunjuk tambahan agar model mengusulkan memori (hanya bila proyek mengizinkan). */
export const PETUNJUK_USULAN_MEMORI =
  'Bila dalam percakapan ini pengguna menyatakan fakta atau kebiasaan yang layak diingat proyek untuk percakapan lain (bukan data perkara atau identitas orang), tambahkan di PALING AKHIR jawaban, masing-masing satu baris: "USUL-MEMORI: <satu kalimat ringkas>". Jangan menulis baris itu bila tidak ada. Usulan hanya berlaku setelah disetujui Super Admin.';

const POLA_USULAN = /^[ \t]*USUL-MEMORI:[ \t]*(.+?)[ \t]*$/gim;
const POLA_KODE_SAMARAN = /\[[A-Z]{2,12}-\d{1,4}\]/;

/** Memisahkan baris USUL-MEMORI dari jawaban. Usulan yang memuat kode samaran (data orang) dibuang. */
export function pisahUsulanMemori(teks: string): { teks: string; usulan: string[] } {
  const usulan: string[] = [];
  const bersih = String(teks ?? "").replace(POLA_USULAN, (_m, isi: string) => {
    const t = String(isi).replace(/\s+/g, " ").trim().slice(0, BATAS_MEMORI_KARAKTER);
    if (t.length >= 8 && !POLA_KODE_SAMARAN.test(t) && !usulan.includes(t)) usulan.push(t);
    return "";
  });
  return { teks: bersih.replace(/\n{3,}/g, "\n\n").replace(/\s+$/, ""), usulan: usulan.slice(0, 5) };
}

/** Pilihan proyek untuk layar tanya (tanpa isi apa pun). */
export type PilihanProyek = { id: string; nama: string; deskripsi: string };

export const ID_PROYEK_BAWAAN = "";
export const NAMA_PROYEK_BAWAAN = "Proyek bawaan satker";

export type AksesProyek = "semua" | "peran" | "pengguna";
