/**
 * ============================================================================
 * D1 - KAMUS VARIABEL ABT: DARI MANA TIAP VARIABEL MENDAPAT NILAINYA
 * ============================================================================
 *
 * 10 Okt 2026 (rencana-upgrade-sinkron-sipp-abt, D1). Kamus 0033 menyalin
 * definisi ABT apa adanya; berkas ini MENGURAINYA - fungsi murni, tanpa basis
 * data - menjadi keterangan yang dapat dibaca orang dan dipakai mesin:
 *
 *   tipe      data_sql / data_sipp / teks / tanggal / turunan / ...
 *   sumber    sipp | ecourt | isian | turunan | sistem | tanpa
 *   rinci     kolom SIPP yang dibaca, atau tabel-tabel yang disentuh kuerinya
 *   status    otomatis | manual | rawan-petik | tanpa-sumber
 *   cermin    kunci "data inti" SIPP yang dicerminkan variabel itu (nama
 *             pihak, nomor perkara, majelis/PP/JS, tanggal putusan/penetapan,
 *             kuasa, biaya) - dasar pengingat sebelum CETAK (B1)
 *
 * ============================================================================
 * RAWAN PETIK
 * ============================================================================
 *
 * ABT menyisipkan nilai variabel ke dalam kueri dengan str_replace polos
 * (Abt_model::variabel_var_data) - tanpa pelolosan apa pun. Kueri yang menaruh
 * #NNNN# berisi teks bebas di DALAM tanda petik ("#0156#") patah begitu
 * nilainya memuat petik (Ma'ruf, DERRY & PARTNER'S) dan seluruh halaman
 * blangko berhenti dengan "ERROR Variabel". Kasus nyatanya: 7080 atas 0156,
 * 8746 atas 1214 (rencana A8).
 *
 * ============================================================================
 * MENEBAK DARI NAMA HANYA UNTUK ISIAN MANUAL YANG MEMANG MENIRU SIPP
 * ============================================================================
 *
 * Cermin variabel otomatis dibaca dari KUERINYA, bukan dari namanya - pelajaran
 * 0033 (#0046# adalah sebutan, bukan nama pihak). Nama dipakai hanya untuk
 * isian manual yang terang-terangan meniru kolom SIPP ("Nama Advokat Kuasa
 * #0046# (kosong = dari SIPP)"), dan Super Admin dapat membetulkannya.
 */

export type DefinisiAbt = {
  noVar: string;
  nama?: string;
  jenis?: string;
  sqlQuery?: string;
  dataTabel?: string;
  dataKolom?: string;
  urutanData?: number | string | null;
  referensi?: string;
};

export type SumberVariabel = "sipp" | "ecourt" | "isian" | "turunan" | "sistem" | "tanpa";
export type StatusVariabel = "otomatis" | "manual" | "rawan-petik" | "tanpa-sumber";

export const SUMBER_VARIABEL: readonly SumberVariabel[] = ["sipp", "ecourt", "isian", "turunan", "sistem", "tanpa"];
export const STATUS_VARIABEL: readonly StatusVariabel[] = ["otomatis", "manual", "rawan-petik", "tanpa-sumber"];

export const LABEL_SUMBER: Record<SumberVariabel, string> = {
  sipp: "Kolom SIPP",
  ecourt: "e-Court",
  isian: "Isian manual di ABT",
  turunan: "Turunan variabel lain",
  sistem: "Dihitung sistem",
  tanpa: "Tanpa sumber",
};

export const LABEL_STATUS: Record<StatusVariabel, string> = {
  otomatis: "Otomatis",
  manual: "Manual",
  "rawan-petik": "Rawan petik",
  "tanpa-sumber": "Tanpa sumber",
};

/** Data inti SIPP yang diperiksa sebelum CETAK (B1). */
export const CERMIN_SIPP = {
  nomor_perkara: "Nomor perkara",
  nama_pihak1: "Nama Penggugat/Pemohon",
  nama_pihak1_2: "Nama Penggugat/Pemohon II",
  nama_pihak1_3: "Nama Penggugat/Pemohon III",
  nama_pihak2: "Nama Tergugat/Termohon",
  nama_pihak2_2: "Nama Tergugat/Termohon II",
  hakim_ketua: "Ketua Majelis/Hakim",
  hakim_anggota1: "Hakim Anggota 1",
  hakim_anggota2: "Hakim Anggota 2",
  panitera_pengganti: "Panitera Pengganti",
  jurusita: "Jurusita/Jurusita Pengganti",
  tanggal_putusan: "Tanggal putusan",
  tanggal_bht: "Tanggal BHT",
  tanggal_pmh: "Tanggal PMH",
  tanggal_penunjukan_pp: "Tanggal penunjukan PP/JS",
  tanggal_phs: "Tanggal PHS",
  tanggal_sidang_pertama: "Tanggal sidang pertama",
  tanggal_daftar: "Tanggal pendaftaran",
  kuasa_pihak1: "Kuasa Penggugat/Pemohon",
  kuasa_pihak2: "Kuasa Tergugat/Termohon",
  nomor_kuasa_pihak1: "Nomor register kuasa Penggugat/Pemohon",
  nomor_kuasa_pihak2: "Nomor register kuasa Tergugat/Termohon",
  biaya: "Biaya perkara",
} as const;

export type KunciCermin = keyof typeof CERMIN_SIPP;

export function kunciCerminSah(nilai: unknown): KunciCermin | "" {
  const k = String(nilai ?? "").trim();
  return Object.prototype.hasOwnProperty.call(CERMIN_SIPP, k) ? (k as KunciCermin) : "";
}

export type UraianVariabel = {
  tipe: string;
  sumber: SumberVariabel;
  sumberRinci: string;
  tabelSipp: string[];
  rujukan: string[];
  rujukanPetik: string[];
  status: StatusVariabel;
  cermin: KunciCermin | "";
  arti: string;
};

const teks = (x: unknown) => String(x ?? "").trim();

/** Label tipe untuk layar - dari data_type ABT. */
export function tipeVariabel(jenis: unknown): string {
  const j = teks(jenis).toLowerCase();
  if (!j) return "tanpa tipe";
  if (j === "data_teks") return "teks";
  if (j === "data_tanggal") return "tanggal";
  if (j === "tanggal_hari" || j === "tanggal_hijriah" || j === "terbilang" || j === "qrcode") return `turunan (${j})`;
  return j;
}

/** Komentar SQL dibuang - kata di dalamnya bukan bagian kueri. */
function tanpaKomentar(sql: string): string {
  // MySQL: "-- " (dengan spasi) dan "#" sampai akhir baris; #NNNN# dan
  // #perkara_id# adalah penanda ABT, bukan komentar.
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)(--\s|#(?!\d{3,5}#|perkara_id#))[^\n]*/g, "$1");
}

/**
 * Menyusuri kueri dan memisahkan isi literal petik dari selebihnya.
 * Petik ganda di dalam literal ('it''s') dan garis miring terbalik dihormati.
 */
function pilahPetik(sql: string): { luar: string; dalam: Array<{ petik: string; isi: string }> } {
  let luar = "";
  const dalam: Array<{ petik: string; isi: string }> = [];
  let petik = "";
  let isi = "";
  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i];
    if (!petik) {
      if (c === "'" || c === '"') {
        petik = c;
        isi = "";
        luar += " '' ";
      } else luar += c;
      continue;
    }
    if (c === "\\" && i + 1 < sql.length) {
      isi += sql[i + 1];
      i += 1;
      continue;
    }
    if (c === petik) {
      if (sql[i + 1] === petik) {
        isi += c;
        i += 1;
        continue;
      }
      dalam.push({ petik, isi });
      petik = "";
      continue;
    }
    isi += c;
  }
  if (petik) dalam.push({ petik, isi });
  return { luar, dalam };
}

const POLA_PENANDA = /#(\d{4,5})#/g;

/** #NNNN# yang disebut kueri (tanpa dirinya sendiri), terurut. */
export function rujukanVariabel(sql: string, diri = ""): string[] {
  const kumpul = new Set<string>();
  for (const c of tanpaKomentar(String(sql || "")).matchAll(POLA_PENANDA)) if (c[1] !== diri) kumpul.add(c[1]);
  return [...kumpul].sort();
}

/**
 * #NNNN# yang berada DI DALAM literal petik - tempat str_replace ABT dapat
 * mematahkan kueri - beserta petik pembatasnya (' atau ").
 */
export function rujukanDalamPetik(sql: string, diri = ""): Array<{ kode: string; petik: string }> {
  const kumpul = new Map<string, { kode: string; petik: string }>();
  for (const { petik, isi } of pilahPetik(tanpaKomentar(String(sql || ""))).dalam) {
    for (const c of isi.matchAll(POLA_PENANDA)) {
      if (c[1] === diri) continue;
      const kunci = `${c[1]}${petik}`;
      if (!kumpul.has(kunci)) kumpul.set(kunci, { kode: c[1], petik });
    }
  }
  return [...kumpul.values()].sort((a, b) => a.kode.localeCompare(b.kode) || a.petik.localeCompare(b.petik));
}

/** Tabel yang dibaca kueri (sesudah FROM/JOIN), huruf kecil, tanpa awalan basis data SIPP. */
export function tabelDibaca(sql: string): string[] {
  const { luar } = pilahPetik(tanpaKomentar(String(sql || "")));
  const kumpul = new Set<string>();
  for (const c of luar.matchAll(/\b(?:from|join)\s+`?([a-z_][a-z0-9_]*(?:`?\.`?[a-z_][a-z0-9_]*)?)`?/gi)) {
    const nama = c[1].replace(/`/g, "").toLowerCase();
    if (nama === "dual") continue;
    kumpul.add(nama);
  }
  return [...kumpul].sort();
}

const JENIS_TURUNAN = new Set(["tanggal_hari", "tanggal_hijriah", "terbilang", "qrcode"]);
const JENIS_AMAN_PETIK = new Set(["data_tanggal", "tanggal_hari", "tanggal_hijriah", "terbilang", "qrcode"]);
const NAMA_AMAN_PETIK = /^(tgl|tanggal|tahun|umur|biaya|no\.?\s|nomor|nik|jumlah|hari\s+tgl)/i;

/**
 * Kueri yang keluarannya hanya kata tetap: tiap THEN/ELSE langsung disusul
 * literal tanpa penanda - sebutan seperti #0046# "Penggugat"/"Pemohon".
 */
function keluaranTetap(sql: string): boolean {
  const q = tanpaKomentar(sql).replace(/\s+/g, " ").trim();
  if (!/^select\s*\(?\s*case\b/i.test(q) || /#\d{4,5}#/.test(q)) return false;
  const cabang = [...q.matchAll(/\b(then|else)\s+(\S)/gi)];
  return cabang.length > 0 && cabang.every((c) => c[2] === '"' || c[2] === "'");
}

/** Variabel yang nilainya tidak mungkin memuat petik sama sekali (tanggal, angka, nomor, sebutan tetap). */
function tanpaPetik(def: DefinisiAbt | undefined): boolean {
  if (!def) return true; // tidak terdaftar = tidak pernah bernilai = tidak mematahkan apa pun
  const j = teks(def.jenis).toLowerCase();
  if (!j) return true;
  if (JENIS_AMAN_PETIK.has(j)) return true;
  if (j === "multi_sidang") return !/agenda|alasan|dihadiri/i.test(teks(def.nama));
  if (j === "data_sipp" && /tanggal|tgl|_id$|^nomor|^no_|jumlah|urutan/i.test(teks(def.dataKolom))) return true;
  if ((j === "data_sipp" || j === "data_sql") && NAMA_AMAN_PETIK.test(teks(def.nama))) return true;
  if (j === "data_sql" && keluaranTetap(teks(def.sqlQuery))) return true;
  return false;
}

/**
 * I8 17 Okt: variabel yang mengutip AMAR PUTUSAN SIPP (perkara_putusan.amar_putusan): #0065# (data_sipp) dan #9500# (data_sql: amar yang sama,
 * sisa templat "sidang Pengadilan Agama Bantul/Tangerang" diganti #8008#). Dipakai 16 blangko Derry pengutip amar (ikrar, BAS putusan, relaas).
 */
export const KODE_AMAR_SIPP: ReadonlySet<string> = new Set(["0065", "9500"]);

/** Kueri data_sql yang membaca kolom amar_putusan (bukan amar_putusan_dok / _anonimisasi_dok). */
function kueriBacaAmar(def: DefinisiAbt | undefined): boolean {
  return /\bamar_putusan\b(?!_)/i.test(teks(def?.sqlQuery));
}

/** Teks bebas yang diketik orang - dapat memuat petik ganda maupun tunggal. */
function teksBebas(def: DefinisiAbt | undefined): boolean {
  if (!def) return false;
  const j = teks(def.jenis).toLowerCase();
  // Amar putusan SIPP selalu teks bebas (memuat petik ganda: "Menolak ..."), juga bila dikutip lewat kueri (#9500#).
  if (j === "data_sql" && kueriBacaAmar(def)) return true;
  if (j === "data_teks" || j === "tanya_jawab") return true;
  if (j === "multi_sidang") return /agenda|alasan/i.test(teks(def.nama));
  if (j === "data_sipp") return /amar|posita|petitum|keterangan|alasan/i.test(teks(def.dataKolom));
  return false;
}

/**
 * Apakah sisipan #kode# di dalam petik `petik` dapat mematahkan kueri.
 * Di dalam '...' cukup satu apostrof (Ma'ruf, Jum'at) - semua teks selain
 * tanggal/angka/sebutan tetap. Di dalam "..." hanya teks bebas ketikan orang
 * yang mungkin memuat petik ganda.
 */
function patahDiPetik(def: DefinisiAbt | undefined, petik: string): boolean {
  if (tanpaPetik(def)) return false;
  return petik === "'" ? true : teksBebas(def);
}

function bersihSql(sql: string): string {
  return tanpaKomentar(sql).replace(/'/g, '"').replace(/`/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function urutanAngka(x: unknown): number {
  const n = Number(teks(x));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Cermin data inti dari definisi - kueri/kolomnya untuk yang otomatis, namanya untuk isian yang meniru SIPP. */
export function cerminDari(def: DefinisiAbt): KunciCermin | "" {
  const jenis = teks(def.jenis).toLowerCase();
  const nama = teks(def.nama);

  if (jenis === "data_sipp") {
    const t = teks(def.dataTabel).toLowerCase();
    const k = teks(def.dataKolom).toLowerCase();
    const u = urutanAngka(def.urutanData);
    if (t === "perkara" && k === "nomor_perkara") return "nomor_perkara";
    if (t === "perkara" && k === "tanggal_pendaftaran") return "tanggal_daftar";
    if (t === "perkara_pihak1" && k === "nama") return u === 1 ? "nama_pihak1" : u === 2 ? "nama_pihak1_2" : u === 3 ? "nama_pihak1_3" : "";
    if (t === "perkara_pihak2" && k === "nama") return u === 1 ? "nama_pihak2" : u === 2 ? "nama_pihak2_2" : "";
    if (t === "perkara_putusan" && k === "tanggal_putusan") return "tanggal_putusan";
    if (t === "perkara_putusan" && k === "tanggal_bht") return "tanggal_bht";
    if (t === "perkara_penetapan" && k === "penetapan_majelis_hakim") return "tanggal_pmh";
    if (t === "perkara_penetapan" && k === "penetapan_panitera_pengganti") return "tanggal_penunjukan_pp";
    if (t === "perkara_penetapan" && k === "penetapan_hari_sidang") return "tanggal_phs";
    if (t === "perkara_penetapan" && k === "sidang_pertama") return "tanggal_sidang_pertama";
    return "";
  }

  if (jenis === "data_sql") {
    const q = bersihSql(teks(def.sqlQuery));
    if (!q || /\bcase\b|concat\(/.test(q)) {
      // Kalimat jadi (CASE/CONCAT) bukan cermin satu kolom - kecuali jumlah biaya.
      return /^select\s.*\bfrom perkara_biaya\b/.test(q) && /\bjumlah\b/.test(q) ? "biaya" : "";
    }
    let m = q.match(/^select (?:\w+\.)?nama as data from perkara_pihak([12])(?: \w+)? where (?:\w+\.)?urutan ?= ?(\d)/);
    if (m) {
      const u = Number(m[2]);
      if (m[1] === "1") return u === 1 ? "nama_pihak1" : u === 2 ? "nama_pihak1_2" : u === 3 ? "nama_pihak1_3" : "";
      return u === 1 ? "nama_pihak2" : u === 2 ? "nama_pihak2_2" : "";
    }
    // Majelis/PP/JS: hanya yang AKTIF - "panitera sidang yang sebelumnya"
    // (aktif="T") bukan cermin PP perkara sekarang.
    // Paling banyak satu JOIN (ke hakim_pn/jurusita untuk nama bergelar):
    // kueri bersubkueri seperti #5403# mencari orang LAIN.
    const aktif = /\baktif ?= ?"y"/.test(q) && (q.match(/\bjoin\b/g) || []).length <= 1 && !/\(\s*select\b/.test(q);
    if (aktif && /^select (?:\w+\.)?(?:nama_gelar|nama|hakim_nama) as data from perkara_hakim_pn\b/.test(q)) {
      m = q.match(/\burutan ?= ?(\d)/);
      const u = m ? Number(m[1]) : 0;
      return u === 1 ? "hakim_ketua" : u === 2 ? "hakim_anggota1" : u === 3 ? "hakim_anggota2" : "";
    }
    if (aktif && /^select (?:\w+\.)?panitera_nama as data from perkara_panitera_pn\b/.test(q)) return "panitera_pengganti";
    if (aktif && /^select (?:\w+\.)?(?:nama_gelar|jurusita_nama|nama) as data from perkara_jurusita\b/.test(q)) {
      const u = q.match(/\burutan ?= ?(\d)/);
      return !u || u[1] === "1" ? "jurusita" : "";
    }
    // Kuasa: kolom perkara_pengacara sendiri, tanpa JOIN (c.nama sesudah JOIN
    // agama adalah nama agama, bukan nama kuasa - #0166#).
    m = /\bjoin\b/.test(q) ? null : q.match(/^select (?:\w+\.)?(nama|nomor_kuasa) as data from perkara_pengacara\b.*\bpihak_ke ?= ?([12])/);
    if (m) return `${m[1] === "nama" ? "kuasa" : "nomor_kuasa"}_pihak${m[2]}` as KunciCermin;
    if (/^select (?:sum|max)?\(?(?:\w+\.)?jumlah\)? as data from perkara_biaya\b/.test(q)) return "biaya";
    if (/^total biaya perkara$/i.test(nama)) return "biaya";
    return "";
  }

  if (jenis === "data_teks" || jenis === "data_tanggal") {
    const n = nama.toLowerCase();
    const pihak = n.includes("#0047#") ? "2" : n.includes("#0046#") ? "1" : "";
    if (pihak && /^nama (advokat )?kuasa\b/.test(n)) return `kuasa_pihak${pihak}` as KunciCermin;
    if (pihak && /^no\.?\s*reg(ister|\.)?\s*(surat\s+)?kuasa/.test(n)) return `nomor_kuasa_pihak${pihak}` as KunciCermin;
    if (jenis === "data_tanggal" && /^(tgl\.?|tanggal)\s*putusan\b/.test(n)) return "tanggal_putusan";
    if (jenis === "data_tanggal" && /^(tgl\.?|tanggal)\s*pmh\b/.test(n)) return "tanggal_pmh";
    if (/^(no\.?|nomor)\s*perkara\b/.test(n)) return "nomor_perkara";
  }
  return "";
}

const SEBUTAN_TETAP: Record<string, string> = {
  "0046": "Penggugat/Pemohon",
  "0047": "Tergugat/Termohon",
  "0668": "Ketua Majelis/Hakim",
  "0053": "permohonan/gugatan",
};

/** Nama variabel yang terbaca orang: sebutan dalam #NNNN# diganti, penanda #1111x# dan tag dibuang. */
export function namaTerbaca(nama: string, peta?: Map<string, DefinisiAbt>): string {
  return String(nama || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/#1111\d#/g, " ")
    .replace(POLA_PENANDA, (utuh, kode: string) => {
      if (SEBUTAN_TETAP[kode]) return SEBUTAN_TETAP[kode];
      const lain = peta?.get(kode);
      const n = teks(lain?.nama);
      return n && n.length <= 40 && !/#\d{4,5}#/.test(n) ? n : utuh;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function titik(kalimat: string) {
  const t = kalimat.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Mengurai satu definisi. `peta` = seluruh kamus (untuk menilai rujukan:
 * rawan petik, status turunan).
 */
export function uraiVariabel(def: DefinisiAbt, peta: Map<string, DefinisiAbt>, kedalaman = 0): UraianVariabel {
  const jenis = teks(def.jenis).toLowerCase();
  const sql = String(def.sqlQuery ?? "");
  const tipe = tipeVariabel(jenis);
  const namaBaca = namaTerbaca(teks(def.nama), peta) || `#${def.noVar}#`;
  const kosong: UraianVariabel = {
    tipe,
    sumber: "tanpa",
    sumberRinci: "",
    tabelSipp: [],
    rujukan: [],
    rujukanPetik: [],
    status: "tanpa-sumber",
    cermin: "",
    arti: "",
  };

  if (!jenis) {
    return { ...kosong, arti: titik(`${namaBaca}. Terdaftar di ABT tanpa tipe data - tidak pernah terisi`) };
  }

  if (jenis === "data_sipp") {
    const t = teks(def.dataTabel);
    const k = teks(def.dataKolom);
    if (!t || !k) return { ...kosong, arti: titik(`${namaBaca}. Bertipe data_sipp tetapi tabel/kolomnya tidak disebut`) };
    const u = teks(def.urutanData);
    const rinci = `${t}.${k}${u ? ` (urutan ${u})` : ""}`;
    return {
      ...kosong,
      sumber: "sipp",
      sumberRinci: rinci,
      tabelSipp: [t.toLowerCase()],
      status: "otomatis",
      cermin: cerminDari(def),
      arti: titik(`${namaBaca}. Dibaca langsung dari SIPP ${rinci}`),
    };
  }

  if (jenis === "data_sql") {
    if (!sql.trim()) return { ...kosong, arti: titik(`${namaBaca}. Bertipe data_sql tetapi kuerinya kosong`) };
    const tabel = tabelDibaca(sql);
    const rujukan = rujukanVariabel(sql, def.noVar);
    const petik = [
      ...new Set(
        rujukanDalamPetik(sql, def.noVar)
          .filter((r) => patahDiPetik(peta.get(r.kode), r.petik))
          .map((r) => r.kode)
      ),
    ];
    const tabelSipp = tabel.filter((x) => !/^(aps_badilag\.)?abt_/.test(x));
    const semuaEcourt = tabelSipp.length > 0 && tabelSipp.every((x) => /efiling|ecourt/.test(x));
    const sumber: SumberVariabel = tabelSipp.length ? (semuaEcourt ? "ecourt" : "sipp") : rujukan.length || tabel.length ? "turunan" : "sistem";
    const bagian: string[] = [];
    if (tabelSipp.length) bagian.push(`tabel ${tabelSipp.join(", ")}`);
    if (rujukan.length) bagian.push(`memakai ${rujukan.map((x) => `#${x}#`).join(", ")}`);
    const rinci = KODE_AMAR_SIPP.has(def.noVar) ? ["perkara_putusan.amar_putusan", ...bagian.filter((b) => b.startsWith("memakai"))].join("; ") : bagian.join("; ");
    const asal =
      sumber === "sipp" ? "Dihitung ABT dari SIPP" : sumber === "ecourt" ? "Dihitung ABT dari data e-Court di SIPP" : sumber === "turunan" ? "Dirangkai ABT dari variabel lain" : "Dihitung ABT";
    return {
      tipe,
      sumber,
      sumberRinci: rinci,
      tabelSipp,
      rujukan,
      rujukanPetik: petik,
      status: petik.length ? "rawan-petik" : "otomatis",
      cermin: cerminDari(def),
      arti: titik(
        `${namaBaca}. ${asal}${rinci ? ` (${rinci})` : ""}` +
          (petik.length ? `. Rawan petik: ${petik.map((x) => `#${x}#`).join(", ")} disisipkan di dalam tanda petik` : "")
      ),
    };
  }

  if (jenis === "multi_sidang") {
    return {
      ...kosong,
      sumber: "sipp",
      sumberRinci: "perkara_jadwal_sidang (per sidang yang dibuka)",
      tabelSipp: ["perkara_jadwal_sidang"],
      status: "otomatis",
      arti: titik(`${namaBaca}. Dibaca ABT dari jadwal sidang SIPP untuk sidang yang dibuka`),
    };
  }

  if (JENIS_TURUNAN.has(jenis)) {
    const ref = teks(def.referensi);
    const induk = ref ? peta.get(ref) : undefined;
    if (!ref || !induk) {
      return { ...kosong, sumber: "turunan", rujukan: ref ? [ref] : [], arti: titik(`${namaBaca}. Turunan ${jenis} tanpa variabel acuan yang terdaftar`) };
    }
    const statusInduk = kedalaman < 8 ? uraiVariabel(induk, peta, kedalaman + 1).status : "otomatis";
    return {
      ...kosong,
      sumber: "turunan",
      sumberRinci: `${jenis} dari #${ref}#`,
      rujukan: [ref],
      status: statusInduk === "rawan-petik" ? "otomatis" : statusInduk,
      arti: titik(`${namaBaca}. Turunan (${jenis.replace("_", " ")}) dari #${ref}# ${namaTerbaca(teks(induk.nama), peta)}`),
    };
  }

  if (jenis === "data_teks" || jenis === "data_tanggal") {
    const cermin = cerminDari(def);
    return {
      ...kosong,
      sumber: "isian",
      sumberRinci: jenis === "data_tanggal" ? "abt_data_tanggal (diketik di ABT)" : "abt_data_teks (diketik di ABT)",
      status: "manual",
      cermin,
      arti: titik(`${namaBaca}. Diketik petugas di ABT${cermin ? ` - meniru ${CERMIN_SIPP[cermin]} di SIPP` : ""}`),
    };
  }

  if (jenis === "tanya_jawab") {
    return {
      ...kosong,
      sumber: "isian",
      sumberRinci: "keterangan saksi/pihak di ABT",
      rujukan: teks(def.referensi) ? [teks(def.referensi)] : [],
      status: "manual",
      arti: titik(`${namaBaca}. Keterangan tanya-jawab yang disusun petugas di ABT`),
    };
  }

  return { ...kosong, arti: titik(`${namaBaca}. Tipe "${jenis}" belum dikenali ALETA`) };
}

export type RekapKamus = {
  jumlah: number;
  perStatus: Record<StatusVariabel, number>;
  perSumber: Record<SumberVariabel, number>;
  bercermin: number;
};

export function rekapUraian(daftar: Array<{ status: StatusVariabel; sumber: SumberVariabel; cermin?: string }>): RekapKamus {
  const perStatus = Object.fromEntries(STATUS_VARIABEL.map((s) => [s, 0])) as Record<StatusVariabel, number>;
  const perSumber = Object.fromEntries(SUMBER_VARIABEL.map((s) => [s, 0])) as Record<SumberVariabel, number>;
  let bercermin = 0;
  for (const x of daftar) {
    if (x.status in perStatus) perStatus[x.status] += 1;
    if (x.sumber in perSumber) perSumber[x.sumber] += 1;
    if (x.cermin) bercermin += 1;
  }
  return { jumlah: daftar.length, perStatus, perSumber, bercermin };
}

/**
 * Variabel otomatis yang menjadi ACUAN nilai SIPP sebuah cermin - dipakai untuk
 * membandingkan isian manual yang meniru SIPP. data_sipp didahulukan (paling
 * dekat ke kolomnya), lalu kode terkecil.
 */
export function pilihAcuan(
  kandidat: Array<{ noVar: string; jenis: string; status: string; cermin: string; bersarang?: string[] }>,
  cermin: string
): string {
  const cocok = kandidat
    .filter((x) => x.cermin === cermin && x.status === "otomatis" && (x.jenis === "data_sipp" || x.jenis === "data_sql") && !(x.bersarang ?? []).length)
    .sort((a, b) => Number(b.jenis === "data_sipp") - Number(a.jenis === "data_sipp") || a.noVar.localeCompare(b.noVar));
  return cocok[0]?.noVar ?? "";
}
