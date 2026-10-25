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
 *
 * PENGENAL POLA TEKS BEBAS (T9, keputusan pengguna 24 Okt: "sebisa mungkin"):
 *   - nama sesudah sebutan: saksi (I/II/pertama...), Penggugat/Tergugat/
 *     Pemohon/Termohon/Pelawan/Terlawan, Pewaris, ahli waris, anak, istri/
 *     suami, Sdr./Sdri./Saudara/Bapak/Ibu, almarhum/almarhumah, bernama,
 *     atas nama; dan rangkaian "X bin/binti Y" di mana pun;
 *   - NIK/KK 16 angka (juga berkelompok 4-4-4-4), telepon, email, rekening;
 *   - alamat rinci (Jalan/Jl./Dusun/Desa/Kelurahan/Lorong/Gang/Perumahan,
 *     RT/RW) - sampai koma/titik koma/baris baru atau Kecamatan/Kabupaten;
 *   - tempat & tanggal lahir dan umur (jenis LAHIR).
 * Positif palsu dicegah daftar KATA_BUKAN_NAMA (istilah pengadilan, sebutan
 * pihak, urutan, wilayah): rangkaian nama berhenti di kata itu.
 */

export type JenisSamaran = "NAMA" | "NIK" | "ALAMAT" | "TELEPON" | "EMAIL" | "REKENING" | "LAHIR";
export const JENIS_SAMARAN: readonly JenisSamaran[] = ["NAMA", "NIK", "ALAMAT", "TELEPON", "EMAIL", "REKENING", "LAHIR"];

export type EntriSamaran = { kode: string; jenis: JenisSamaran; asli: string };

const POLA_KODE = /\[\s*(NAMA|NIK|ALAMAT|TELEPON|EMAIL|REKENING|LAHIR)[-_ ](\d{1,5})\s*\]/g;
const POLA_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const POLA_NIK = /(?<![\d])(?:\d{16}|\d{4}[ .]\d{4}[ .]\d{4}[ .]\d{4})(?![\d])/g;
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

// ─── Pengenal pola teks bebas ────────────────────────────────────────────────

const BULAN = "Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|Nopember|November|Desember";
const TANGGAL = `\\d{1,2}[\\s/.-]+(?:\\d{1,2}|${BULAN})[\\s/.-]+\\d{4}`;
/** "lahir di Donggala, 5 September 1990" / "tanggal lahir 05-09-1990" / "Palu, 12 Maret 1988" sesudah "tempat/tanggal lahir". */
const POLA_LAHIR = new RegExp(
  `(\\b(?:tempat\\s*(?:dan|/|,)?\\s*tanggal\\s+lahir|tempat\\s+lahir|tanggal\\s+lahir|tgl\\.?\\s*lahir|lahir\\s+(?:di|pada|tanggal))\\s*:?\\s*)((?:[\\p{L} .'-]{2,40},?\\s*)?${TANGGAL}|[\\p{Lu}][\\p{L}'-]+(?:\\s+[\\p{Lu}][\\p{L}'-]+)?)`,
  "giu"
);
/** Umur orang ("umur 36 tahun"), bukan usia perkawinan/kandungan. */
const POLA_UMUR = /(?<!(?:perkawinan|pernikahan|kandungan|perkara)\s)(\b(?:umur|usia|berumur|berusia)\s*:?\s*)(\d{1,3}\s*tahun)/giu;
/** Alamat rinci: kata kunci jalan/dusun/desa ... sampai pemisah. Huruf besar wajib ("berjalan" bukan alamat). */
const POLA_ALAMAT =
  /(?<![\p{L}])(?:Jalan|Jl\.|Jln\.?|JALAN|Dusun|Dsn\.?|DUSUN|Desa|DESA|Kelurahan|Kel\.|KELURAHAN|Lorong|Lr\.|Gang|Gg\.|Kompleks|Komplek|Perumahan|Perum\.?|RT\.?\s*\d)[^,;\n()[\]]{1,80}?(?=\s*(?:[,;\n()]|(?<!\b(?:No|NO|Nomor|Jl|Jln|Gg|Kel|Dsn|Lr|Perum|Kav|Blok))\.(?:\s|$)|$|\s+(?:Kecamatan|Kec\.|Kabupaten|Kab\.|Kota|Provinsi|KECAMATAN|KABUPATEN|KOTA|PROVINSI)\b))/gu;

/** Kata yang menghentikan rangkaian nama (istilah pengadilan, sebutan, urutan, wilayah, kata sambung). */
const KATA_BUKAN_NAMA = new Set(
  (
    "pengadilan agama negeri tinggi mahkamah agung majelis hakim ketua wakil anggota panitera pengganti jurusita juru sita mediator kuasa hukum advokat prinsipal " +
    "penggugat tergugat pemohon termohon pelawan terlawan pewaris ahli waris saksi anak istri isteri suami turut intervensi konvensi rekonvensi asal kasasi banding peninjauan kembali " +
    "pertama kedua ketiga keempat kelima keenam ketujuh kedelapan i ii iii iv v vi vii viii ix x " +
    "nomor no nik kk rt rw jalan dusun desa kelurahan kecamatan kabupaten kota provinsi republik indonesia " +
    "islam kompilasi hukum undang-undang uu pasal ayat huruf perma sema pp yang dan atau dengan tersebut telah pada di ke dari dalam untuk bahwa adalah melawan " +
    "menurut mohon menyatakan memberi memberikan keterangan menerangkan hadir tidak sah sebagai selaku beserta kepada oleh"
  ).split(/\s+/)
);
const KATA_SAMBUNG_NAMA = new Set(["bin", "binti", "bt", "bt.", "binti.", "al", "el", "as", "ash", "ad", "an", "ar", "at", "az", "van", "de", "da"]);
const POLA_KATA_NAMA = /^(?:\p{Lu}[\p{L}'’`-]*\.?|\p{Lu}\.)$/u;

/** Sebutan yang diikuti nama orang. */
const POLA_SEBUTAN =
  /(?<![\p{L}])(?:saksi(?:\s+(?:ke-?\s*)?(?:I{1,3}|IV|V|\d|pertama|kedua|ketiga|keempat|kelima)(?![\p{L}]))?|penggugat|tergugat|pemohon|termohon|pelawan|terlawan|pewaris|ahli\s+waris|anak(?:\s+(?:kandung|angkat))?|istri|isteri|suami|sdr\.|sdri\.|saudara|saudari|bapak|ibu|almarhum(?:ah)?|alm\.|almh\.|bernama|atas\s+nama|a\.n\.)(?:\s+(?:I{1,3}|IV|V|Konvensi|Rekonvensi|Asal))?\s*[:,]?[ \t]+/giu;

/** Rangkaian nama mulai dari `awal` (berhenti di kata bukan nama / tanda baca / baris baru). */
function rangkaiNama(teks: string, awal: number): string {
  const sisa = teks.slice(awal, awal + 160);
  const kata = sisa.split(/(?<=\S)(?=[ \t]+)/);
  const ambil: string[] = [];
  for (const mentah of kata) {
    const k = mentah.trim();
    if (!k) break;
    const bersih = k.replace(/[,;:)]+$/, "");
    const bawah = bersih.toLowerCase();
    const sambung = KATA_SAMBUNG_NAMA.has(bawah) && ambil.length > 0;
    if (!sambung && (!POLA_KATA_NAMA.test(bersih) || KATA_BUKAN_NAMA.has(bawah.replace(/\.$/, "")))) break;
    ambil.push(bersih);
    if (bersih !== k || ambil.length >= 8) break; // tanda baca menutup nama
  }
  while (ambil.length && KATA_SAMBUNG_NAMA.has(ambil[ambil.length - 1]!.toLowerCase())) ambil.pop();
  // Titik akhir kalimat bukan bagian nama (singkatan pendek seperti "H." tetap).
  const akhir = ambil.length - 1;
  if (akhir >= 0 && /\.$/.test(ambil[akhir]!) && ambil[akhir]!.length > 4) ambil[akhir] = ambil[akhir]!.slice(0, -1);
  const nama = ambil.join(" ");
  // Satu huruf/gelar saja ("H.", "Drs.") bukan nama.
  return ambil.some((k) => k.replace(/\.$/, "").length >= 3) ? nama : "";
}

/** Nama-nama di teks bebas menurut sebutan dan pola "X bin/binti Y". */
export function kenaliNamaBebas(teks: string): string[] {
  const hasil = new Set<string>();
  const t = String(teks ?? "");
  for (const m of t.matchAll(POLA_SEBUTAN)) {
    const nama = rangkaiNama(t, (m.index ?? 0) + m[0].length);
    if (nama) hasil.add(nama);
  }
  // "X bin Y" / "X binti Y" di mana pun: mundur ke awal rangkaian nama sebelum bin/binti.
  for (const m of t.matchAll(/(?<![\p{L}])(?:bin|binti)[ \t]+\p{Lu}/gu)) {
    const sebelum = t.slice(Math.max(0, (m.index ?? 0) - 80), m.index ?? 0);
    const kataSebelum = sebelum.split(/[ \t]+/).filter(Boolean);
    let i = kataSebelum.length;
    while (i > 0) {
      const k = kataSebelum[i - 1]!;
      if (!POLA_KATA_NAMA.test(k) || KATA_BUKAN_NAMA.has(k.toLowerCase().replace(/\.$/, "")) || /[,;:]$/.test(k)) break;
      i -= 1;
    }
    if (i === kataSebelum.length) continue;
    const mulai = (m.index ?? 0) - kataSebelum.slice(i).join(" ").length - 1;
    const nama = rangkaiNama(t, Math.max(0, mulai));
    if (/\s(?:bin|binti)\s/i.test(nama)) hasil.add(nama);
  }
  return [...hasil];
}

export class Penyamar {
  private readonly perNilai = new Map<string, EntriSamaran>();
  private readonly perKode = new Map<string, EntriSamaran>();
  private readonly nomor: Record<JenisSamaran, number> = { NAMA: 0, NIK: 0, ALAMAT: 0, TELEPON: 0, EMAIL: 0, REKENING: 0, LAHIR: 0 };
  /** Entri yang dibuat sejak penyamar dimuat (untuk disimpan). */
  readonly baru: EntriSamaran[] = [];
  private pola: RegExp | null = null;
  /** Kamus alias nama (U18): kunci normal setiap nama baku/varian -> nama baku. Kosong = tanpa kamus (bawaan). */
  private readonly aliasKeBaku = new Map<string, string>();

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

  /**
   * Kamus alias nama (U18, rantai B): varian ejaan seorang tokoh diikat ke KODE SAMARAN nama bakunya, jadi
   * "Muhamad Alwi" dan "Moh. Alwi" menjadi [NAMA-1] yang sama dengan "Muhammad Alwi". Tanpa kamus perilaku tidak berubah.
   */
  pakaiAlias(kamus: ReadonlyArray<{ baku: string; varian: readonly string[] }>): void {
    this.aliasKeBaku.clear();
    for (const e of kamus) {
      const baku = String(e?.baku ?? "").replace(/\s+/g, " ").trim();
      if (!baku) continue;
      for (const v of [baku, ...(e.varian ?? [])]) {
        const k = normal(v);
        if (k.length >= PANJANG_MIN_CARI) this.aliasKeBaku.set(k, baku);
      }
    }
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
    if (jenis === "NAMA" && this.aliasKeBaku.size) {
      const baku = this.aliasKeBaku.get(normal(bersih));
      if (baku && normal(baku) !== normal(bersih)) {
        const kode = this.daftar("NAMA", baku);
        const tokoh = this.perNilai.get(normal(baku));
        if (tokoh) this.ikat(bersih, tokoh);
        return kode;
      }
    }
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
    hasil = hasil.replace(POLA_NIK, (m) => this.daftar("NIK", m.replace(/[ .]/g, "")));
    hasil = hasil.replace(POLA_TELEPON, (m) => this.daftar("TELEPON", m.replace(/[\s.-]/g, "")));
    hasil = hasil.replace(POLA_LAHIR, (_m, awal: string, nilai: string) => `${awal}${this.daftar("LAHIR", nilai)}`);
    hasil = hasil.replace(POLA_UMUR, (_m, awal: string, nilai: string) => `${awal}${this.daftar("LAHIR", nilai)}`);
    hasil = hasil.replace(POLA_ALAMAT, (m) => this.daftar("ALAMAT", m));
    // Nama dari pola didaftarkan dulu, lalu SEMUA sebutannya (juga yang muncul lebih awal) diganti.
    for (const nama of kenaliNamaBebas(hasil)) this.daftar("NAMA", nama);
    if (this.aliasKeBaku.size) {
      const rendah = normal(hasil);
      for (const k of this.aliasKeBaku.keys()) {
        if (!rendah.includes(k)) continue;
        // Hanya bila benar-benar kata utuh di teks (bukan potongan kata lain).
        const pola = new RegExp(`(?<![\\p{L}\\p{N}])${k.split(" ").map(escapeRegex).join("\\s+")}(?![\\p{L}\\p{N}])`, "iu");
        const cocok = pola.exec(hasil);
        if (cocok) this.daftar("NAMA", cocok[0]);
      }
    }
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
