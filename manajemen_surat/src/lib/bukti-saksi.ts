/**
 * ============================================================================
 * PEMETAAN BUKTI <-> KETERANGAN SAKSI (G2, 25 Okt 2026) - USULAN, BUKAN KEPUTUSAN
 * ============================================================================
 *
 * Pertimbangan putusan biasanya menautkan alat bukti dengan keterangan saksi yang menguatkan fakta yang sama ("bukti P.2 dan
 * keterangan Saksi 1 dan Saksi 2 menerangkan bahwa ..."). Berkas ini mengusulkan tautan itu dari DUA sumber yang sudah ada:
 *
 *   - butir daftar bukti P.x / T.x dari e-Court (bot: buktiEcourtService.uraiDaftarBukti);
 *   - baris tanya-jawab saksi (ABT) yang dikirim ekstensi.
 *
 * Dua jalan, dari yang paling pasti:
 *   1. DISEBUT LANGSUNG: jawaban saksi memuat kode buktinya ("bukti P.3", "P-3", "T.2").
 *   2. SEPOKOK: jenis bukti dan isi jawaban membicarakan hal yang sama (akta nikah <-> "menikah", tangkapan layar WhatsApp <->
 *      "bertengkar" / "chat", kuitansi <-> "nafkah" / "uang", dst.). Daftar pokok di POKOK_BUKTI di bawah; sengaja pendek dan
 *      kasar - lebih baik tidak mengusulkan daripada mengarang tautan.
 *
 * SEMUA hasilnya usulan ("ragu"): tidak ditulis ke ABT, SIPP, atau e-Court. Kutipan jawaban dibawa apa adanya supaya majelis
 * dapat memeriksa sendiri. Murni: tanpa basis data dan jaringan.
 */

export type ButirBukti = {
  kode: string;
  pihak?: string;
  jenis?: string;
  nama?: string;
  uraian?: string;
  elektronik?: boolean;
};

export type KeteranganSaksi = {
  /** Mis. "Saksi 1 Penggugat". */
  label: string;
  /** Baris tanya-jawab; yang dibaca hanya jawabannya. */
  jawaban: string[];
};

export type TautanBuktiSaksi = {
  saksi: string;
  kutipan: string;
  /** "disebut-langsung" | nama pokok ("pernikahan", "pertengkaran", ...). */
  dasar: string;
};

export type UsulanBuktiSaksi = {
  kodeBukti: string;
  uraianBukti: string;
  tautan: TautanBuktiSaksi[];
  keyakinan: "ragu";
  catatan: string;
};

type Pokok = { kunci: string; jenisBukti: RegExp; isiJawaban: RegExp };

/**
 * Pokok pembicaraan. `jenisBukti` dicocokkan dengan jenis + uraian bukti; `isiJawaban` dengan jawaban saksi. Kata yang terlalu umum
 * ("keluarga", "rumah") sengaja tidak dipakai sendirian.
 */
export const POKOK_BUKTI: readonly Pokok[] = [
  {
    kunci: "pernikahan",
    jenisBukti: /akta\s+nikah|buku\s+nikah|kutipan\s+akta\s+nikah|surat\s+nikah|surat\s+keterangan\s+(?:nikah|tidak\s+tercatat)|\bkua\b|kantor\s+urusan\s+agama/i,
    isiJawaban: /\bmenikah\b|\bpernikahan\b|\bakad\s+nikah\b|\bsuami\s+istri\b|\bmenikahkan\b|\bwali\s+nikah\b|\bnikah\s+(?:siri|sirri|tidak\s+tercatat)\b/i,
  },
  {
    kunci: "kependudukan",
    jenisBukti: /\bktp\b|kartu\s+tanda\s+penduduk|kartu\s+keluarga|\bkk\b|surat\s+keterangan\s+domisili/i,
    isiJawaban: /\balamat\b|bertempat\s+tinggal|\bdomisili\b|tinggal\s+di\b|\bpenduduk\b|\bberagama\b|\bwarga\b/i,
  },
  {
    kunci: "anak",
    jenisBukti: /akta\s+kelahiran|surat\s+kelahiran|surat\s+keterangan\s+lahir/i,
    isiJawaban: /\banak\b|melahirkan|dikaruniai|\bkelahiran\b|\blahir\b/i,
  },
  {
    kunci: "pertengkaran",
    jenisBukti: /tangkapan\s+layar|screen\s?shot|whats\s?app|\bwa\b|\bchat\b|percakapan|rekaman|\bvideo\b|pesan\s+(?:singkat|teks)|\bsms\b|media\s+sosial|facebook|instagram|tiktok/i,
    isiJawaban: /bertengkar|pertengkaran|cekcok|\bribut\b|berselisih|perselisihan|\bchat\b|whats\s?app|\bpesan\b|menelepon|telepon|bertikai|\bmarah\b|cemburu/i,
  },
  {
    kunci: "pisah rumah",
    jenisBukti: /surat\s+pernyataan|surat\s+keterangan\s+(?:ketua|rt|rw|kepala|desa|lurah|tetangga)|keterangan\s+tetangga|foto\b|pisah\s+rumah/i,
    isiJawaban: /pisah\s+(?:rumah|tempat\s+tinggal|ranjang)|tidak\s+(?:lagi\s+)?tinggal\s+(?:serumah|bersama)|meninggalkan\s+(?:rumah|tempat)|pergi\s+dari\s+rumah|pulang\s+ke\s+rumah\s+orang\s+tua|sudah\s+tidak\s+serumah/i,
  },
  {
    kunci: "nafkah",
    jenisBukti: /slip\s+gaji|kuitansi|kwitansi|bukti\s+(?:transfer|pembayaran)|mutasi\s+rekening|struk|nota\b/i,
    isiJawaban: /\bnafkah\b|\bgaji\b|penghasilan|\buang\b|\bbiaya\b|kebutuhan|\btransfer\b|\bmemberi\s+belanja\b|\bbelanja\b/i,
  },
  {
    kunci: "harta",
    jenisBukti: /sertifikat|sertipikat|\bshm\b|\bbpkb\b|\bstnk\b|buku\s+pemilik\s+kendaraan|akta\s+jual\s+beli|\bajb\b/i,
    isiJawaban: /\bharta\b|\btanah\b|\brumah\b|\bkendaraan\b|\bmotor\b|\bmobil\b|\bsertifikat\b|membeli|dibeli|\bwarisan\b/i,
  },
  {
    kunci: "kematian",
    jenisBukti: /akta\s+kematian|surat\s+(?:keterangan\s+)?kematian/i,
    isiJawaban: /meninggal|wafat|kematian|almarhum|almarhumah/i,
  },
  {
    kunci: "perjanjian",
    jenisBukti: /perjanjian|\bakad\b|surat\s+kesepakatan|somasi|jadwal\s+angsuran/i,
    isiJawaban: /perjanjian|\bakad\b|kesepakatan|\bhutang\b|\butang\b|cicil|angsuran|pinjam/i,
  },
];

const teks = (x: unknown) => String(x ?? "").trim();

/** Potongan jawaban untuk dikutip: satu kalimat bila ada, paling panjang `maks` huruf. */
function kutip(jawaban: string, maks = 220): string {
  const rapi = teks(jawaban).replace(/\s+/g, " ");
  if (rapi.length <= maks) return rapi;
  const potong = rapi.slice(0, maks);
  const akhir = Math.max(potong.lastIndexOf(". "), potong.lastIndexOf("; "));
  return `${(akhir > maks * 0.5 ? potong.slice(0, akhir + 1) : potong).trim()} ...`;
}

/** Pola yang menyebut kode bukti: "bukti P.3", "P-3", "P 3", "(T.2)". Kode dibandingkan sesudah dinormalkan ("P.3"). */
function menyebutKode(jawaban: string, kode: string): boolean {
  const m = /^([PT])\.(\d{1,2})$/i.exec(teks(kode));
  if (!m) return false;
  const pola = new RegExp(`(?:^|[^A-Za-z0-9])${m[1]}\\s*[-.]?\\s*${m[2]}(?![0-9])`, "i");
  return pola.test(jawaban);
}

/**
 * Mengusulkan tautan bukti <-> saksi. Hasil diurut menurut kode bukti; bukti tanpa tautan tidak muncul. Satu bukti paling banyak
 * `maksSaksiPerBukti` tautan (yang disebut langsung didahulukan).
 */
export function petakanBuktiSaksi(bukti: readonly ButirBukti[], saksi: readonly KeteranganSaksi[], maksSaksiPerBukti = 3): UsulanBuktiSaksi[] {
  const hasil: UsulanBuktiSaksi[] = [];
  const urut = [...bukti].sort((a, b) => teks(a.kode).localeCompare(teks(b.kode), "id", { numeric: true }));
  for (const b of urut) {
    const uraian = teks(b.uraian) || teks(b.nama);
    const jenis = `${teks(b.jenis)} ${uraian}`;
    const pokok = POKOK_BUKTI.filter((p) => p.jenisBukti.test(jenis));
    const langsung: TautanBuktiSaksi[] = [];
    const sepokok: TautanBuktiSaksi[] = [];
    for (const s of saksi) {
      const label = teks(s.label) || "Saksi";
      let ketemuLangsung = false;
      for (const j of s.jawaban ?? []) {
        if (menyebutKode(j, b.kode)) {
          langsung.push({ saksi: label, kutipan: kutip(j), dasar: "disebut-langsung" });
          ketemuLangsung = true;
          break;
        }
      }
      if (ketemuLangsung) continue;
      for (const p of pokok) {
        const jawab = (s.jawaban ?? []).find((j) => p.isiJawaban.test(j));
        if (jawab) {
          sepokok.push({ saksi: label, kutipan: kutip(jawab), dasar: p.kunci });
          break;
        }
      }
    }
    const tautan = [...langsung, ...sepokok].slice(0, Math.max(1, maksSaksiPerBukti));
    if (tautan.length === 0) continue;
    hasil.push({
      kodeBukti: teks(b.kode),
      uraianBukti: uraian.slice(0, 200),
      tautan,
      keyakinan: "ragu",
      catatan: langsung.length
        ? "Saksi menyebut kode bukti ini; periksa apakah yang diterangkan memang bukti yang dimaksud."
        : "Dugaan dari pokok pembicaraan yang sama (bukan saksi menyebut bukti ini); periksa sebelum dipakai di pertimbangan.",
    });
  }
  return hasil;
}

/** Satu kalimat usulan per bukti untuk disalin ke bahan pertimbangan. Nama saksi dari label; tidak mengarang isi keterangan. */
export function kalimatUsulanBuktiSaksi(u: UsulanBuktiSaksi): string {
  const daftar = u.tautan.map((t) => t.saksi);
  const sebut = daftar.length === 1 ? daftar[0] : `${daftar.slice(0, -1).join(", ")} dan ${daftar[daftar.length - 1]}`;
  return `Bukti ${u.kodeBukti} (${u.uraianBukti}) berkaitan dengan keterangan ${sebut}.`;
}
