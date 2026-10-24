/**
 * ============================================================================
 * ALETA Ai - PENYAMARAN DUA ARAH (murni, tanpa basis data)
 * ============================================================================
 *
 * Rencana v2 bagian 4: nama, NIK, alamat rinci, telepon, email, dan nomor
 * rekening diganti KODE SAMARAN sebelum apa pun dikirim ke layanan AI, lalu
 * kode itu dikembalikan menjadi data asli pada jawaban untuk pengguna.
 *
 *   samarkan(teks)       teks bebas (pesan pengguna, riwayat): nilai yang sudah
 *                        dikenal diganti kodenya; NIK/telepon/email/rekening
 *                        dikenali dari bentuknya dan didaftarkan.
 *   samarkanData(nilai)  hasil alat data: ruas identitas (nama, nik, alamat,
 *                        telepon, email, rekening) selalu disamarkan; ruas teks
 *                        lain lewat samarkan() supaya nama yang terselip ikut.
 *   pulihkan(teks)       jawaban model: [NAMA-1] -> nama asli.
 *   PemulihAliran        pulihkan() untuk streaming: kode yang terpotong di
 *                        tengah dua potongan ditahan sampai utuh.
 *
 * Kode bersifat tetap per PERCAKAPAN (entri disimpan terenkripsi oleh
 * server/modules/aleta-ai/samaran.ts), sehingga [NAMA-1] pada giliran ketiga
 * masih orang yang sama dengan giliran pertama.
 *
 * Angka rekap, nomor perkara, nama pejabat pengadilan (majelis/PP/JS), dan
 * jenis perkara TIDAK disamarkan (rencana 10.2).
 */

export type JenisSamaran = "NAMA" | "NIK" | "ALAMAT" | "TELEPON" | "EMAIL" | "REKENING";
export const JENIS_SAMARAN: readonly JenisSamaran[] = ["NAMA", "NIK", "ALAMAT", "TELEPON", "EMAIL", "REKENING"];

export type EntriSamaran = { kode: string; jenis: JenisSamaran; asli: string };

const POLA_KODE = /\[\s*(NAMA|NIK|ALAMAT|TELEPON|EMAIL|REKENING)[-_ ](\d{1,5})\s*\]/g;
const POLA_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const POLA_NIK = /(?<![\d])\d{16}(?![\d])/g;
const POLA_TELEPON = /(?<![\d+])(?:\+62|62|0)\s?8\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{3,5}(?![\d])/g;
const POLA_REKENING = /(\b(?:no(?:mor)?\.?\s*)?rek(?:ening)?\.?\s*(?:no(?:mor)?\.?\s*)?[:.]?\s*)(\d[\d .-]{6,22}\d)/gi;

/** Batas bawah panjang nilai yang dicari di teks bebas (nilai lebih pendek hanya disamarkan pada ruasnya). */
const PANJANG_MIN_CARI = 4;

const normal = (s: string) => String(s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ruas hasil alat -> jenis samaran. Kunci dicocokkan tanpa beda huruf besar/kecil dan garis bawah. */
const RUAS_SAMARAN: ReadonlyArray<[RegExp, JenisSamaran]> = [
  [/^(nama|name|namapihak|namalengkap|namaalias|alias|namasaksi|namaayah|namaibu|namawali)$/, "NAMA"],
  [/^(nik|nomoridentitas|nomorindentitas|noktp|nomorktp|nomorkk|nokk)$/, "NIK"],
  [/^(alamat|alamatlengkap|alamatrinci|alamatdomisili|alamatpihak|desakelurahan|desa|kelurahan|rt|rw)$/, "ALAMAT"],
  [/^(telepon|telp|notelp|nomortelepon|hp|nohp|nomorhp|wa|whatsapp|ponsel)$/, "TELEPON"],
  [/^(email|surel)$/, "EMAIL"],
  [/^(rekening|norekening|nomorrekening|norek)$/, "REKENING"],
];

export function jenisRuas(kunci: string): JenisSamaran | null {
  const k = String(kunci ?? "").toLowerCase().replace(/[_\s-]/g, "");
  for (const [pola, jenis] of RUAS_SAMARAN) if (pola.test(k)) return jenis;
  return null;
}

/** Nama tanpa "bin/binti/alias ..." - dipakai sebagai sebutan lain dari orang yang sama. */
function sebutanNama(nama: string): string[] {
  const hasil: string[] = [];
  const potong = nama.split(/\s+(?:bin|binti|alias|als\.?)\s+/i);
  if (potong.length > 1) {
    const depan = potong[0]!.trim();
    if (depan.length >= PANJANG_MIN_CARI) hasil.push(depan);
  }
  return hasil;
}

export class Penyamar {
  private readonly perNilai = new Map<string, EntriSamaran>();
  private readonly perKode = new Map<string, EntriSamaran>();
  private readonly nomor: Record<JenisSamaran, number> = { NAMA: 0, NIK: 0, ALAMAT: 0, TELEPON: 0, EMAIL: 0, REKENING: 0 };
  /** Entri yang dibuat sejak penyamar dimuat (untuk disimpan). */
  readonly baru: EntriSamaran[] = [];
  private pola: RegExp | null = null;

  constructor(entri: readonly EntriSamaran[] = []) {
    for (const e of entri) this.muat(e);
  }

  private muat(e: EntriSamaran) {
    if (!e?.kode || !e.asli || !JENIS_SAMARAN.includes(e.jenis)) return;
    this.perKode.set(e.kode, e);
    this.ikat(e.asli, e);
    if (e.jenis === "NAMA") for (const s of sebutanNama(e.asli)) if (!this.perNilai.has(normal(s))) this.ikat(s, e);
    const n = Number(/-(\d+)\]$/.exec(e.kode)?.[1] ?? 0);
    if (n > this.nomor[e.jenis]) this.nomor[e.jenis] = n;
  }

  private ikat(nilai: string, e: EntriSamaran) {
    const k = normal(nilai);
    if (!k) return;
    this.perNilai.set(k, e);
    this.pola = null;
  }

  entri(): EntriSamaran[] {
    return [...this.perKode.values()];
  }

  /** Kode untuk nilai asli (dibuat bila belum ada). Nilai kosong dikembalikan apa adanya. */
  daftar(jenis: JenisSamaran, asli: string): string {
    const bersih = String(asli ?? "").replace(/\s+/g, " ").trim();
    if (!bersih) return String(asli ?? "");
    const ada = this.perNilai.get(normal(bersih));
    if (ada) return ada.kode;
    this.nomor[jenis] += 1;
    const e: EntriSamaran = { kode: `[${jenis}-${this.nomor[jenis]}]`, jenis, asli: bersih };
    this.muat(e);
    this.baru.push(e);
    return e.kode;
  }

  private polaNilai(): RegExp | null {
    if (this.pola) return this.pola;
    const nilai = [...this.perNilai.keys()].filter((k) => k.length >= PANJANG_MIN_CARI).sort((a, b) => b.length - a.length);
    if (!nilai.length) return null;
    const isi = nilai.map((k) => k.split(" ").map(escapeRegex).join("\\s+")).join("|");
    this.pola = new RegExp(`(?<![\\p{L}\\p{N}])(?:${isi})(?![\\p{L}\\p{N}])`, "giu");
    return this.pola;
  }

  /** Teks bebas -> teks tanpa data asli yang dikenal atau berbentuk NIK/telepon/email/rekening. */
  samarkan(teks: string): string {
    let hasil = String(teks ?? "");
    if (!hasil) return hasil;
    hasil = hasil.replace(POLA_EMAIL, (m) => this.daftar("EMAIL", m));
    hasil = hasil.replace(POLA_REKENING, (_m, awal: string, angka: string) => `${awal}${this.daftar("REKENING", angka.replace(/[ .-]/g, ""))}`);
    hasil = hasil.replace(POLA_NIK, (m) => this.daftar("NIK", m));
    hasil = hasil.replace(POLA_TELEPON, (m) => this.daftar("TELEPON", m.replace(/[\s.-]/g, "")));
    const pola = this.polaNilai();
    if (pola) hasil = hasil.replace(pola, (m) => this.perNilai.get(normal(m))?.kode ?? m);
    return hasil;
  }

  /** Hasil alat (objek/daftar) -> salinan tersamar. Ruas identitas selalu menjadi kode. */
  samarkanData<T>(nilai: T): T {
    // Ruas identitas didaftarkan DULU (seluruh pohon), baru teks lain disamarkan,
    // supaya nama yang disebut di ruas keterangan sebelum ruas namanya ikut tertangkap.
    const kumpul = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(kumpul);
      if (!v || typeof v !== "object") return;
      for (const [k, isi] of Object.entries(v as Record<string, unknown>)) {
        const jenis = jenisRuas(k);
        if (jenis && (typeof isi === "string" || typeof isi === "number") && String(isi).trim()) this.daftar(jenis, String(isi));
        else kumpul(isi);
      }
    };
    kumpul(nilai);
    const ganti = (v: unknown, kunci = ""): unknown => {
      if (Array.isArray(v)) return v.map((x) => ganti(x));
      if (v && typeof v === "object") {
        const keluar: Record<string, unknown> = {};
        for (const [k, isi] of Object.entries(v as Record<string, unknown>)) keluar[k] = ganti(isi, k);
        return keluar;
      }
      if (typeof v === "string" || (typeof v === "number" && jenisRuas(kunci))) {
        const jenis = jenisRuas(kunci);
        if (jenis && String(v).trim()) return this.daftar(jenis, String(v));
        return typeof v === "string" ? this.samarkan(v) : v;
      }
      return v;
    };
    return ganti(nilai) as T;
  }

  /** Kode -> data asli. Kode yang tidak dikenal dibiarkan. */
  pulihkan(teks: string): string {
    return String(teks ?? "").replace(POLA_KODE, (m, jenis: string, n: string) => this.perKode.get(`[${jenis}-${Number(n)}]`)?.asli ?? m);
  }
}

/**
 * pulihkan() untuk aliran: potongan yang berakhir di tengah "[NAMA-1" ditahan
 * sampai kurung tutupnya datang (atau sudah terlalu panjang untuk sebuah kode).
 */
export class PemulihAliran {
  private sisa = "";
  constructor(private readonly penyamar: Penyamar) {}

  dorong(potongan: string): string {
    const t = this.sisa + potongan;
    const buka = t.lastIndexOf("[");
    if (buka >= 0 && t.indexOf("]", buka) < 0 && t.length - buka < 20) {
      this.sisa = t.slice(buka);
      return this.penyamar.pulihkan(t.slice(0, buka));
    }
    this.sisa = "";
    return this.penyamar.pulihkan(t);
  }

  akhir(): string {
    const t = this.sisa;
    this.sisa = "";
    return this.penyamar.pulihkan(t);
  }
}

/** Uji kebocoran: nilai asli mana yang masih tampak di `teks` (tanpa beda huruf besar/kecil & spasi). */
export function dataAsliTersisa(teks: string, daftarAsli: readonly string[]): string[] {
  const t = normal(teks);
  const angkaSaja = String(teks ?? "").replace(/\D/g, "");
  return daftarAsli.filter((a) => {
    const n = normal(a);
    if (!n) return false;
    if (/^[\d\s.+-]+$/.test(a)) return angkaSaja.includes(a.replace(/\D/g, ""));
    return t.includes(n);
  });
}
