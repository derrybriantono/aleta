/**
 * ============================================================================
 * PETA BLANGKO PER TUGAS - ATURAN, BUKAN DAFTAR (13 Okt 2026, butir 7)
 * ============================================================================
 *
 * Permintaan pengguna: putusan -> hakim, BAS -> panitera, relaas -> juru sita,
 * form PTSP -> PTSP. Blangko yang ditambah kemudian (mis. putusan & BAS per
 * jenis perkara x status putusan) harus ikut terpetakan TANPA ada yang menulis
 * ulang daftar - karena itu tugasnya dibaca dari NAMA FOLDER dan NAMA BERKAS
 * menurut konvensi penamaan grup "Blangko Derry" (derry_briantono) di ABT:
 *
 *   FOLDER (abt_menu.direktori, induk derry_briantono)
 *     putusan  "<nomor><huruf?> <Jenis Perkara>"           "1 Perceraian CG", "4a Harta Bersama", "1d Putusan Cerai Gugat Kumulasi ..."
 *     BAS      "ALUR NN <alur sidang>" atau memuat kata BAS  "ALUR 06 Cerai T Hadir ...", "BAS Itsbat Nikah Gugur dan Cabut"
 *     relaas   memuat Relaas / PBT / Amplop                  "Relaas"
 *     PTSP     memuat PTSP                                   "PTSP"
 *   BERKAS
 *     putusan  "[kode] [Status] Judul - keadaan.rtf"         "[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi.rtf"
 *              Status: Kabul, Kabul Verstek, Tolak, Tolak Verstek, NO, Gugur, Cabut, Coret, Perdamaian
 *     BAS      "[kode] BAS <n> <kehadiran> - <tindakan>.rtf" "[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf"
 *     relaas   "[JS] <n>. Relaas ... P|T.rtf"                "[JS] 2. Relaas Pemberitahuan Putusan T.rtf"
 *     PTSP     "@ <n> - <PMH|PHS|...>.rtf"                   "@ 1 - PMH.rtf"
 *
 * Urutan aturan PENTING: relaas lebih dulu ("Relaas Pemberitahuan Putusan" memuat
 * kata putusan), lalu PTSP, BAS ("BAS ... Putusan Verstek" memuat kata putusan),
 * dan putusan terakhir. Yang tidak cocok satu aturan pun dijawab "" - tidak
 * ditebak, sama seperti taksonomi-blangko.ts.
 *
 * Hak ABT per tugas = abt_menu.user_grup_id yang DIUKUR di server satker 13 Okt
 * 2026 (baris 901/951/981/991); paket ABT abt-blangko-derry-rapi menyamakan baris
 * induk 900 - yang dibaca ABT untuk folder Relaas & PTSP - dengan tugas ini.
 *
 * ============================================================================
 * FOLDER PUTUSAN DAN FOLDER BAS BERPASANGAN (K3, 15 Okt 2026; menggantikan "satu folder" F3 14 Okt)
 * ============================================================================
 *
 * Keputusan pengguna 15 Okt sore: tiap jenis DUA menu berdampingan. Folder putusan tetap ("1 Perceraian CG": hakim, hak
 * putusan 1|10|20) dan BAS-nya di folder pasangan "<folder putusan> - BAS" ("1 Perceraian CG - BAS": panitera, hak BAS).
 * Nama folder "... - BAS" terbaca "bas" oleh RX_BAS; tidak perlu hak gabungan. Aturan "nama berkas ^BAS menang atas folder"
 * (F3) dipertahankan sebagai pengaman bila ada BAS tertinggal di folder putusan. Menu ALUR 960-972, 945, 946 tetap tersembunyi.
 */

export type TugasBlangko = "hakim" | "panitera" | "jurusita" | "ptsp";
export type JenisDokumenBlangko = "putusan" | "bas" | "relaas" | "ptsp";

export const TUGAS_JENIS_DOKUMEN: Record<JenisDokumenBlangko, TugasBlangko> = {
  putusan: "hakim",
  bas: "panitera",
  relaas: "jurusita",
  ptsp: "ptsp",
};

export const LABEL_TUGAS: Record<TugasBlangko, string> = {
  hakim: "Hakim",
  panitera: "Panitera / PP",
  jurusita: "Juru Sita",
  ptsp: "PTSP",
};

/**
 * Grup SIPP (sys_groups) yang boleh memakai blangko satu tugas di ABT -
 * abt_menu.user_grup_id / user_top_id. 1 Super Administrator, 10 Ketua/Wakil,
 * 20 Hakim, 30 Panitera, 430 Panmud Hukum, 500 PP, 600 Juru Sita, 650 Koordinator
 * Delegasi, 1000/1010/1020 Panmud, 1001/1011/1032 Meja I.
 */
export const GRUP_ABT_TUGAS: Record<TugasBlangko, { grup: string; top: string }> = {
  hakim: { grup: "1|10|20", top: "1" },
  panitera: { grup: "1|30|500|430|1000|1010|1020", top: "1|30" },
  jurusita: { grup: "600|650", top: "1|30" },
  ptsp: { grup: "30|500|430|1000|1010|1020|1032|1001|1011", top: "1|30" },
};


/** Grup ABT yang menjadi pemilik tugas (tanpa pejabat puncak 1/10/30 yang boleh semuanya). */
export function grupTugas(tugas: TugasBlangko): string[] {
  return GRUP_ABT_TUGAS[tugas].grup.split("|").filter(Boolean);
}

const RX_RELAAS = /\brela+s\b|\brelas{1,2}\b|\bPBT\b|pemberitahuan\s+(isi\s+)?putusan|\bamplop\b|\bdelegasi\b|^\[JS\]/i;
const RX_PTSP = /\bPTSP\b|^@\s*\d|\bPMH\b|\bPHS\b|penetapan\s+hari\s+sidang|penetapan\s+majelis\s+hakim|penunjukan\s+(panitera|juru\s*sita)/i;
const RX_BAS = /^ALUR\s+\d+\b|\bBAS\b|berita\s+acara\s+sidang/i;
/* === F3 14 Okt === */
// Nama berkas BAS salinan di folder jenis: "BAS ALUR 04 [2] ...", "BAS KUMULASI ...", "BAS IN GUGUR CABUT ...".
const RX_BERKAS_BAS_SALINAN = /^BAS\b/;
/* === AKHIR F3 === */
const RX_FOLDER_PUTUSAN =/^\d+[a-z]{0,2}\s+\S/i;
const RX_TAG_STATUS = /^\s*\[[^\]]+\]\s*\[(kabul(?:\s+verstek)?|tolak(?:\s+verstek)?|no|gugur|cabut|coret|perdamaian)\]/i;
const RX_PUTUSAN = /\bputusan\b|\bpenetapan\b|akta\s+perdamaian/i;

function bagian(jalur: string): { folder: string; berkas: string } {
  const p = String(jalur || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (p.length === 0) return { folder: "", berkas: "" };
  const akhir = p[p.length - 1];
  if (/\.(rtf|doc|docx|odt)$/i.test(akhir)) {
    return { folder: p.length > 1 ? p[p.length - 2] : "", berkas: akhir };
  }
  return { folder: akhir, berkas: "" };
}

/**
 * Jenis dokumen blangko dari jalurnya ("derry_briantono/<folder>/<berkas>", folder
 * saja, atau berkas saja). Folder menentukan lebih dulu; berkas menjawab bila
 * foldernya tidak menyatakan apa pun.
 */
export function jenisDokumenBlangko(jalur: string): JenisDokumenBlangko | "" {
  const { folder, berkas } = bagian(jalur);
  /* === F3 14 Okt === */
  // BAS salinan di folder jenis ("1 Perceraian CG/BAS ALUR 04 ...") menang atas folder yang menyatakan putusan.
  if (berkas && RX_BERKAS_BAS_SALINAN.test(berkas)) return "bas";
  /* === AKHIR F3 === */
  for (const nama of [folder, berkas]) {
    if (!nama) continue;
    const n = nama.replace(/\.(rtf|doc|docx|odt)$/i, "");
    if (RX_RELAAS.test(n)) return "relaas";
    if (RX_PTSP.test(n)) return "ptsp";
    if (RX_BAS.test(n)) return "bas";
    if (nama === folder && RX_FOLDER_PUTUSAN.test(n)) return "putusan";
    if (nama === berkas && (RX_TAG_STATUS.test(n) || RX_PUTUSAN.test(n))) return "putusan";
  }
  return "";
}

/* === F3 14 Okt === */
/** Berkas BAS salinan di folder jenis (nama diawali "BAS")? Untuk menyaring BAS dari daftar blangko PUTUSAN. */
export function berkasBasSalinan(berkas: string): boolean {
  return RX_BERKAS_BAS_SALINAN.test(String(berkas || "").trim());
}
/* === AKHIR F3 === */

/** Tugas pemilik blangko menurut jalurnya; "" bila tidak terbaca. */
export function tugasBlangko(jalur: string): TugasBlangko | "" {
  const j = jenisDokumenBlangko(jalur);
  return j ? TUGAS_JENIS_DOKUMEN[j] : "";
}

/** Status putusan SIPP (status_putusan.nama) + verstek, dibaca dari tanda kurung siku kedua nama berkas putusan. */
export type StatusDariNama = { status: string[]; verstek: boolean; tanda: string };

const STATUS_TANDA: Record<string, string[]> = {
  kabul: ["Dikabulkan"],
  tolak: ["Ditolak"],
  no: ["Tidak Dapat Diterima"],
  gugur: ["Digugurkan", "Gugur"],
  cabut: ["Dicabut"],
  coret: ["Dicoret dari Register"],
  perdamaian: ["Perdamaian"],
};

export function statusDariNamaBlangko(berkas: string): StatusDariNama | null {
  const m = String(berkas || "").match(RX_TAG_STATUS);
  if (!m) return null;
  const tanda = m[1].replace(/\s+/g, " ").trim();
  const verstek = /verstek/i.test(tanda);
  const dasar = tanda.toLowerCase().replace(/\s*verstek$/, "");
  const status = STATUS_TANDA[dasar];
  return status ? { status, verstek, tanda } : null;
}

/**
 * Jenis perkara SIPP dari nama folder - kata kunci yang sama bentuknya dengan
 * SetBlangko.untuk (dicocokkan sebagai bagian nama jenis perkara SIPP, huruf kecil).
 * Folder kumulasi menyebut dua jenis; keduanya ikut.
 */
const JENIS_FOLDER: Array<[RegExp, string, string[]]> = [
  [/cerai\s+gugat|\bCG\b/i, "Cerai Gugat", ["cerai gugat"]],
  [/cerai\s+talak|\bCT\b/i, "Cerai Talak", ["cerai talak"]],
  [/itsbat|istbat|isbat|pengesahan\s+perkawinan/i, "Itsbat Nikah", ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"]],
  [/dispensasi/i, "Dispensasi Kawin", ["dispensasi kawin"]],
  [/asal\s+usul/i, "Asal Usul Anak", ["asal usul anak"]],
  [/ahli\s+waris|p3hp|\bPAW\b/i, "Penetapan Ahli Waris", ["ahli waris", "p3hp"]],
  [/kewarisan/i, "Kewarisan", ["kewarisan"]],
  [/harta\s+bersama|\bHB\b/i, "Harta Bersama", ["harta bersama"]],
  [/poligami/i, "Izin Poligami", ["poligami"]],
  [/perwalian/i, "Perwalian", ["perwalian"]],
  [/wali\s+adh?[ao]l/i, "Wali Adhal", ["wali adhal", "wali adhol"]],
  [/pengangkatan\s+anak/i, "Pengangkatan Anak", ["pengangkatan anak"]],
  [/hadh?anah|hak\s+asuh/i, "Hak Asuh Anak (Hadhanah)", ["hadhanah", "hak asuh", "penguasaan anak"]],
  [/nafkah/i, "Nafkah", ["nafkah"]],
  [/pembatalan\s+perkawinan/i, "Pembatalan Perkawinan", ["pembatalan perkawinan"]],
  [/ekonomi\s+syari/i, "Ekonomi Syariah", ["ekonomi syariah"]],
];

export function jenisPerkaraDariFolder(folder: string): { label: string[]; untuk: string[] } {
  const n = String(folder || "");
  const label: string[] = [];
  const untuk: string[] = [];
  for (const [rx, l, kata] of JENIS_FOLDER) {
    if (!rx.test(n)) continue;
    label.push(l);
    for (const k of kata) if (!untuk.includes(k)) untuk.push(k);
  }
  // "Perceraian"/"Cerai" tanpa CG/CT = keduanya (folder "1c Perceraian Kumulasi Itsbat Nikah").
  if (/perceraian|\bcerai\b/i.test(n) && !untuk.includes("cerai gugat") && !untuk.includes("cerai talak")) {
    label.unshift("Cerai Gugat", "Cerai Talak");
    untuk.unshift("cerai gugat", "cerai talak");
  }
  return { label, untuk };
}

/** Satu folder grup Derry yang terbaca tugasnya. */
export type FolderTugas = {
  /** Jalur relatif _blangko_abt, mis. "derry_briantono/1 Perceraian CG". */
  folder: string;
  nama: string;
  jenis: JenisDokumenBlangko;
  tugas: TugasBlangko;
  /** Kata kunci jenis perkara SIPP (huruf kecil); kosong = semua jenis (relaas/PTSP) atau tak terbaca. */
  untuk: string[];
  jenisLabel: string[];
};

/** Nama tampil: kode urut di depan dibuang ("1a Perceraian CT" -> "Perceraian CT", "ALUR 06 ..." tetap). */
function namaTampil(direktori: string): string {
  const d = String(direktori || "").trim();
  if (/^ALUR\s+\d+/i.test(d)) return d;
  /* === K3 15 Okt === */
  // Folder BAS berpasangan: "1 Perceraian CG - BAS" tampil "Perceraian CG" (jenisnya "BAS" sudah terbaca dari folder).
  return d.replace(/^\d+[a-z]{0,2}\s+/i, "").replace(/\s+-\s+BAS$/i, "").replace(/^-\s*(.*?)\s*-$/, "$1").trim() || d;
  /* === AKHIR K3 === */
}

export function folderTugas(direktori: string, akar = "derry_briantono"): FolderTugas | null {
  const d = String(direktori || "").trim();
  if (!d || d.startsWith(".") || d.startsWith("_")) return null;
  const jenis = jenisDokumenBlangko(d);
  if (!jenis) return null;
  const j = jenis === "relaas" || jenis === "ptsp" ? { label: [], untuk: [] } : jenisPerkaraDariFolder(d);
  return {
    folder: `${akar}/${d}`,
    nama: namaTampil(d),
    jenis,
    tugas: TUGAS_JENIS_DOKUMEN[jenis],
    untuk: j.untuk,
    jenisLabel: j.label,
  };
}

/** Urutan alami nama berkas: kode yang lebih pendek ("[01]") mendahului turunannya ("[01c]"). */
function kodeBerkas(berkas: string): string {
  const m = String(berkas || "").match(/^\s*\[([^\]]+)\]/);
  return m ? m[1].trim() : "";
}

export type BarisStatusOtomatis = { status: string; verstek: boolean; berkas: string; tanda: string };

/**
 * Peta STATUS -> berkas untuk satu folder putusan, dari nama berkasnya saja:
 * satu baris per (status SIPP, verstek), berkas PERTAMA menurut kode terpendek
 * lalu urutan alami. Dipakai untuk blangko yang belum punya baris pemetaan -
 * baris buatan tangan (bawaan ekstensi, pemetaan admin) selalu menang.
 */
export function petaStatusDariBerkas(berkas: string[]): BarisStatusOtomatis[] {
  const tanpaAkhiran = (x: string) => x.replace(/\.(rtf|doc|docx|odt)$/i, "");
  const urut = [...(berkas || [])].filter(Boolean).sort((a, b) => {
    const ka = kodeBerkas(a).length;
    const kb = kodeBerkas(b).length;
    if (ka !== kb && ka > 0 && kb > 0) return ka - kb;
    // Tanpa ".rtf": berkas induk ("... (Format Lengkap)") adalah awalan variannya ("... - (3 Saksi)") dan selalu lebih dulu.
    return tanpaAkhiran(a).localeCompare(tanpaAkhiran(b), "id", { numeric: true });
  });
  const hasil: BarisStatusOtomatis[] = [];
  const sudah = new Set<string>();
  for (const b of urut) {
    const s = statusDariNamaBlangko(b);
    if (!s) continue;
    for (const status of s.status) {
      const kunci = `${status}|${s.verstek ? "verstek" : ""}`;
      if (sudah.has(kunci)) continue;
      sudah.add(kunci);
      hasil.push({ status, verstek: s.verstek, berkas: b, tanda: s.tanda });
    }
  }
  return hasil;
}
