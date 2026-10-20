/**
 * ============================================================================
 * REKOMENDASI BLANGKO UNTUK SATU PERKARA PADA SATU SIDANG (Q3, 16 Okt 2026)
 * ============================================================================
 *
 * Peta perkara L3 (15 Okt) menyambungkan peta kasus -> blangko Derry ke pemilihan blangko ALETA (BAS massal, putusan, relaas). Berkas ini
 * mengumpulkan sambungan itu menjadi SATU fungsi murni yang juga dapat dipakai tampilan Blangko ABT (jendela pilih blangko, tahap E):
 *
 *   rekomendasiBlangko(masukan) -> { sumberTeks, teksDasar, bas[], putusan[], relaas[] }
 *
 * Teks yang menjadi dasar tebakan langkah sidang: KETERANGAN / ALASAN TUNDA sidang itu (perkara_jadwal_sidang.alasan_ditunda - mis. "T tidak
 * hadir, panggil lagi", "menunggu jawaban Tergugat") bila terisi; bila kosong, AGENDA sidang. Alasan tunda ditulis sesudah sidang berlangsung,
 * jadi lebih menggambarkan apa yang terjadi daripada agenda yang ditulis sewaktu menjadwalkan (diukur: agenda "panggil tergugat" pada 81%
 * sidang ke-2 verstek yang ternyata tuntas di sidang itu).
 *
 *   - bas      langkah BAS yang diusulkan dan alternatifnya, SELALU berupa berkas di folder "<jenis> - BAS" (salinan), lengkap dengan nama menu
 *              ABT-nya; yang pertama bertanda `utama`. Sumber: penebak alur ALUR 01-13/kumulasi (lib/alur-bas.ts) dan BAS baru D3/E3
 *              (lib/alur-bas-baru.ts), digabung seperti BAS massal (gabungSemuaBas).
 *   - putusan  blangko putusan menurut jenis + status + verstek + kumulasi + KEADAAN (lib/keadaan-putusan.ts: mediasi sebagian, T tidak
 *              hadir setelah mediasi, verstek tanpa bendera, cabut sesudah mediasi, NO SEMA, gugur 3a, itsbat kontensius). Cermin TS dari
 *              alatPetaUntukPerkara ekstensi (dijaga putusan-per-keadaan-q3.test.ts / rekomendasi-blangko-q3.test.ts). Sidang yang akan memutus
 *              tetapi statusnya belum tercatat diberi blangko "Dikabulkan" bertanda perkiraan.
 *   - relaas   panggilan sidang berikutnya untuk pihak yang tidak hadir (bila sidang ditunda) dan pemberitahuan putusan (bila sudah putus),
 *              beserta amplop pendampingnya; set e-Court bila perkaranya e-Court.
 *
 * Tidak menulis apa pun ke mana pun, tanpa jaringan dan tanpa basis data.
 */
import { gabungSemuaBas, type PilihanBlangkoBas } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { perluasAliasMenu } from "@/lib/alias-menu-derry";
import { FOLDER_MENU_W3B } from "@/lib/w3b-jenis-data";
import { tentukanAlurBasKumulasi } from "@/lib/alur-bas-kumulasi";
import { tentukanBasBaru } from "@/lib/alur-bas-baru";
import { batasEnamBulanIkrar } from "@/lib/ikrar-talak";
import { keadaanPutusan, type MasukanKeadaanPutusan } from "@/lib/keadaan-putusan";
import { kunciJenisPerkara, kunciStatusPutusan } from "@/lib/pemetaan-blangko";
import { JENIS_PENCEGAHAN_PERKAWINAN, blangkoAmplopPendamping, blangkoRelaas, pihakDipanggil, type BlangkoRelaas, type KeadaanRelaas, type PihakDipanggil } from "@/lib/pohon-blangko";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";

const AKAR = "derry_briantono";

export type JenisRekomendasi = "bas" | "putusan" | "relaas" | "ptsp";

export type Rekomendasi = {
  jenis: JenisRekomendasi;
  /** Jalur relatif _blangko_abt, mis. "derry_briantono/1 Perceraian CG - BAS". */
  folder: string;
  berkas: string;
  /** abt_menu.nama dan nama_alias menu pemilik folder itu (nama kelompok di ABT). */
  menu: string;
  alias: string[];
  label: string;
  /** Kalimat untuk petugas: mengapa blangko ini. */
  alasan: string;
  /** true = blangko yang paling mungkin; selebihnya alternatif. */
  utama: boolean;
  /** true = ditebak (urutan sidang, agenda, kehadiran, status belum tercatat) - periksa kembali. */
  perkiraan: boolean;
  /** 20 Okt: tingkat keyakinan saran ("pasti" = keadaan perkara cocok; "cukup" = jenis dan tahap cocok; "perkiraan" = ditebak). Kosong = dihitung dari `perkiraan`. */
  keyakinan?: "pasti" | "cukup" | "perkiraan";
};

export type MasukanRekomendasi = {
  jenisPerkara: string;
  nomorPerkara?: string;
  /** 1 = sidang pertama; 0/kosong = tidak diketahui (dianggap pertama). */
  urutanSidang?: number;
  /** Sandi dihadiri_oleh sidang ini: 1 semua, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada. */
  dihadiriOleh?: number | null;
  agenda?: string;
  /** perkara_jadwal_sidang.alasan_ditunda sidang INI. Dipakai lebih dulu dari agenda bila berisi huruf. */
  alasanDitunda?: string;
  /** Keterangan lain yang menerangkan sidang ini (mis. catatan petugas); diperlakukan sama dengan alasanDitunda. */
  keterangan?: string;
  tergugatPernahHadir?: boolean;
  penggugatPernahHadir?: boolean | null;
  hadirSebelumnya?: number | null;
  sidangIkrarTalak?: boolean;
  /** 19 Okt: tanggal sidang ini (YYYY-MM-DD) dan penetapan hari sidang ikrar (SIPP, bila terkirim) - dasar penetapan gugur [91] sesudah lewat 6 bulan. */
  tanggalSidang?: string;
  tanggalPenetapanSidangIkrar?: string | null;
  kumulasi?: unknown;
  ditunda?: boolean;
  sudahPutus?: boolean;
  statusPutusan?: string;
  verstekPutusan?: boolean;
  mediasi?: { hasil?: unknown } | null;
  mediasiTerbaca?: boolean;
  /** 19 Okt: banyaknya saksi yang tercatat/diajukan pada perkara (SIPP); dipakai memilih varian "(N Saksi)" blangko putusan. Kosong = tidak diketahui. */
  jumlahSaksi?: number | null;
  lewatEcourt?: boolean | null;
  /**
   * 20 Okt (saran semua jenis): alur SIPP (15 gugatan, 16 permohonan/voluntair), banyaknya pihak pertama (Pemohon/Penggugat) dan pihak kedua
   * (Termohon/Tergugat), serta ada-tidaknya majelis, panitera pengganti, dan juru sita yang tertunjuk. Kosong = tidak diketahui (tidak ditebak).
   */
  alurPerkaraId?: number | null;
  jumlahPemohon?: number | null;
  jumlahTermohon?: number | null;
  majelisAda?: boolean;
  paniteraAda?: boolean;
  jurusitaAda?: boolean;
  /** I14 18 Okt: jenis_perkara_id (bot); 342 = pencegahan perkawinan -> relaas Pemohon [JS] 11.1. Kosong: dikenali dari nama jenis. */
  jenisPerkaraId?: number | null;
  /** I9 17 Okt: petitum perkara memohon sita (bot: baris jadwal `sita` terisi). */
  bersita?: boolean;
  /** I7 17 Okt: Tergugat perempuan pada gugatan hak asuh (bot); null = tidak diketahui. */
  tergugatPerempuan?: boolean | null;
  /** I7 17 Okt: potongan amar "Dalam Rekonvensi" (bot) atau amar penuh; dasar [01a] HB rekonvensi dikabulkan. */
  amarRekonvensi?: string;
  /** I7 17 Okt: penanda tegas (saklar konseptor/hakim) bahwa rekonvensi dikabulkan. */
  rekonvensiDikabulkan?: boolean;
  /** I17 18 Okt: Tergugat sudah menjawab (saklar tegas atau penandaJawaban bot) - dasar blangko cabut [98b]. */
  sesudahJawaban?: boolean;
  penandaJawaban?: { berkas?: unknown } | null;
  /** I17: penanda tegas NO karena gugatan kabur / kurang pihak (SIPP tidak menyimpannya terstruktur). */
  cacatFormil?: boolean;
  kurangPihak?: boolean;
  /** I17: penandaPerkara bot ({ghaib}) dan saklar alamat Tergugat tidak diketahui; cerai kumulasi itsbat: itsbat kabul, cerai ditolak. */
  penandaPerkara?: { ghaib?: unknown } | null;
  alamatTergugatTidakDiketahui?: boolean;
  itsbatKabulCeraiDitolak?: boolean;
  /** I17: amar putusan penuh bila tersedia (dasar itsbat kabul / cerai ditolak). */
  amarPutusan?: string;
  /** I19 18 Okt: penanda tegas hakim/konseptor - pencabutan ditolak Tergugat sesudah jawaban; eksepsi kewenangan ("absolut"|"relatif") dikabulkan atau ditolak dalam putusan sela; alasan itsbat. */
  cabutDitolakT?: boolean;
  /** I20 18 Okt: sikap Tergugat atas pencabutan sesudah jawaban ("setuju" | "menolak") - dasar BAS CS / CM. */
  sikapTergugatCabut?: string;
  /** I20 18 Okt: putusan dikabulkan untuk sebagian (bot: amar memuat "untuk sebagian"; atau saklar) dan penguasaan anak dialihkan (saklar). */
  dikabulkanSebagian?: boolean;
  penguasaanDialihkan?: boolean;
  /** I22 18 Okt: PAW susunan dinamis, AUA anak sah perkawinan tercatat (saklar); petitum pencairan dana dan nafkah istri (bot membaca petitum). */
  susunanAhliWaris?: boolean;
  anakSahPerkawinanTercatat?: boolean;
  pencairanDana?: boolean;
  kumulasiNafkahIstri?: boolean;
  /** I26 18 Okt (saklar tegas, pilih manual): PAW susunan lengkap; DK ditolak menurut jenis kelamin anak dan alasan; cerai kumulasi itsbat: itsbat ditolak / NO bersama cerai NO. */
  susunanAhliWarisLengkap?: boolean;
  anakDispensasi?: string;
  alasanTolakDispensasi?: string;
  amarKumulasiItsbat?: string;
  /** I28 18 Okt: penetapan mafqud (Lain-Lain Pdt.P): bot membaca petitum/posita (mafqud, orang hilang); saklar boleh menimpa. */
  mafqud?: boolean;
  /** I23 18 Okt: hak asuh yang petitumnya juga memuat nafkah anak (bot membaca petitum; saklar). */
  plusNafkahAnak?: boolean;
  eksepsiKewenangan?: string;
  putusanSela?: boolean;
  alasanItsbat?: string;
};

export type HasilRekomendasi = {
  sumberTeks: "alasan-tunda" | "agenda" | "kosong";
  teksDasar: string;
  /** 19 Okt: banyaknya saksi perkara (bila diketahui) - ekstensi memilih varian "(N Saksi)" putusan. */
  jumlahSaksi?: number;
  bas: Rekomendasi[];
  putusan: Rekomendasi[];
  relaas: Rekomendasi[];
  /** 20 Okt: saran blangko PTSP (penetapan PMH / PPP / PJS / PHS dst.); diisi oleh saran-blangko-semua.ts. */
  ptsp?: Rekomendasi[];
};

const adaHuruf = (x: unknown) => /[a-z]/i.test(String(x ?? ""));

/** Teks dasar tebakan: alasan tunda / keterangan sidang bila berisi huruf ("0" bawaan kolom SIPP bukan isi), selain itu agenda. */
export function teksDasarSidang(m: Pick<MasukanRekomendasi, "alasanDitunda" | "keterangan" | "agenda">): { sumber: HasilRekomendasi["sumberTeks"]; teks: string } {
  for (const kandidat of [m.alasanDitunda, m.keterangan]) {
    if (adaHuruf(kandidat)) return { sumber: "alasan-tunda", teks: String(kandidat).replace(/\s+/g, " ").trim() };
  }
  if (adaHuruf(m.agenda)) return { sumber: "agenda", teks: String(m.agenda).replace(/\s+/g, " ").trim() };
  return { sumber: "kosong", teks: "" };
}

function akhirDariStatus(status: string | undefined): "gugur" | "cabut" | "no" | null {
  const s = kunciStatusPutusan(status);
  if (s === "digugurkan" || s === "gugur") return "gugur";
  if (s === "dicabut") return "cabut";
  if (s === "tidak dapat diterima") return "no";
  return null;
}

// ---------------------------------------------------------------------------
// BAS
// ---------------------------------------------------------------------------
function rekomendasiBas(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  const akhir = m.sudahPutus ? akhirDariStatus(m.statusPutusan) : null;
  const masukan = {
    jenisPerkara: m.jenisPerkara,
    urutanSidang: Number(m.urutanSidang) || 0,
    dihadiriOleh: m.dihadiriOleh ?? null,
    agenda: teks,
    tergugatPernahHadir: m.tergugatPernahHadir,
    sidangIkrarTalak: m.sidangIkrarTalak === true,
    kumulasi: m.kumulasi,
    nomorPerkara: m.nomorPerkara,
    akhir,
    // I20 18 Okt: Pemohon pernah hadir (N vs G), cabut sesudah jawaban (CS / CM).
    penggugatPernahHadir: m.penggugatPernahHadir,
    sudahJawaban: m.sesudahJawaban === true || Number(m.penandaJawaban?.berkas) > 0,
    sikapTergugatCabut: m.sikapTergugatCabut ?? null,
    mafqud: m.mafqud,
  };
  const hAlur = tentukanAlurBasKumulasi(masukan);
  const baru = tentukanBasBaru(masukan);
  const g = gabungSemuaBas({ usulan: null, pilihan: [], sebab: "" }, baru, hAlur, m.jenisPerkara);
  const hasil: Rekomendasi[] = [];
  const lihat = new Set<string>();
  for (const p of g.pilihan.slice(0, 16)) {
    const s = (p.salinan ?? [])[0];
    const folder = s ? s.folder : p.folder;
    const berkas = s ? s.berkas : p.berkas;
    const kunci = `${folder}|${berkas}`;
    if (!s || lihat.has(kunci)) continue; // tanpa salinan di folder jenis = tak dapat dibuka di ABT
    lihat.add(kunci);
    const utama = Boolean(g.usulan && sama(g.usulan, p));
    hasil.push({
      jenis: "bas",
      folder,
      berkas,
      menu: s.menu,
      alias: perluasAliasMenu(s.alias ? [s.alias] : []),
      label: p.label,
      alasan: utama ? g.sebab || "Langkah BAS menurut keadaan sidang." : "Alternatif pada keadaan sidang yang sama.",
      utama,
      perkiraan: p.perkiraan === true || p.kehadiran !== "cocok",
    });
  }
  return hasil;
}

function sama(a: PilihanBlangkoBas, b: PilihanBlangkoBas): boolean {
  return a === b || (a.folder === b.folder && a.berkas === b.berkas);
}

// ---------------------------------------------------------------------------
// PUTUSAN - cermin TS alatPetaUntukPerkara (ekstensi-sipp/panel-alat.js)
// ---------------------------------------------------------------------------
type BarisPeta = { berkas: string; jenisAsli: string; statusAsli?: string; blangko?: string; blangkoLain?: string[]; catatan?: string };

/** Peta bawaan ekstensi (putusan.peta-blangko) menurut kunci - sama dengan ALAT_PETA_BAWAAN (dijaga uji cermin). */
export const PETA_PUTUSAN_BAWAAN: Record<string, BarisPeta> = Object.fromEntries(
  CERMIN_EKSTENSI["putusan.peta-blangko"].map((e) => {
    const d = (e.data ?? {}) as Omit<BarisPeta, "berkas">;
    return [String(e.kunci), { berkas: String(e.nilai), ...d }];
  })
);

/** Menu putusan (abt_menu.nama) -> folder derry_briantono (susunan berpasangan, MENU-FINAL J3). */
export const FOLDER_MENU_PUTUSAN: Record<string, string> = {
  "Putusan Cerai Gugat": "1 Perceraian CG",
  "Putusan Cerai Talak": "1a Perceraian CT",
  "Putusan Cerai Kumulasi Itsbat Nikah": "1c Perceraian Kumulasi Itsbat Nikah",
  "Putusan Cerai Gugat Kumulasi Hak Asuh Anak": "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
  "Putusan Itsbat Nikah": "2 Itsbat Nikah",
  "Putusan Itsbat Nikah Kontensius": "2a Itsbat Nikah Kontensius",
  "Putusan Dispensasi Kawin": "3 Dispensasi Kawin",
  "Putusan Harta Bersama": "4a Harta Bersama",
  "Putusan Kewarisan": "4b Kewarisan",
  "Putusan Izin Poligami": "5 Izin Poligami",
  "Putusan Perwalian": "6 Perwalian",
  "Putusan Asal Usul Anak": "8 Asal Usul Anak",
  "Putusan Penetapan Ahli Waris (P3HP)": "9 Penetapan Ahli Waris",
  "Putusan Lain-Lain (Pengangkatan Anak)": "9a Lain-Lain (Pengangkatan Anak)",
  "Putusan Permohonan Umum (Cabut/Gugur/NO)": "9b Permohonan Umum",
  // I2 16 Okt: paket ABT abt-wali-adhal - menu 113 "Putusan Wali Adhal" (alias "Wali Adhal - Putusan").
  "Putusan Wali Adhal": "7 Wali Adhal",
  // F21 17 Okt: paket ABT abt-hak-asuh-derry (menu 133), abt-pembatalan-perkawinan-derry (135), abt-ekonomi-syariah-derry (137).
  "Putusan Hak Asuh Anak (Hadhanah)": "6a Hak Asuh Anak (Hadhanah)",
  "Putusan Pembatalan Perkawinan": "5a Pembatalan Perkawinan",
  "Putusan Ekonomi Syariah": "10 Ekonomi Syariah",
  // I9 17 Okt: paket ABT abt-penetap-phs-sita-derry - menu 150 "Putusan Sela & Penetapan Sita" (alias "Sita - Putusan Sela"), folder baru "97 Sita".
  "Putusan Sela & Penetapan Sita": "97 Sita",
  // F22 17 Okt: paket ABT abt-pencegahan-nikah-derry (menu 139), abt-wasiat-derry (141), abt-es-biasa-derry (143).
  // I15 18 Okt: paket ABT abt-penguasaan-anak-derry (menu 153).
  "Putusan Penguasaan Anak": "6b Penguasaan Anak",
  // I23 18 Okt: paket ABT abt-nafkah-anak-derry - menu 165 "Putusan Nafkah Anak" (alias "Nafkah Anak - Putusan"), folder baru "6c Nafkah Anak", jenis 743.
  "Putusan Nafkah Anak": "6c Nafkah Anak",
  "Putusan Pencegahan Perkawinan": "5b Pencegahan Perkawinan",
  "Putusan Wasiat": "4c Wasiat",
  "Putusan Ekonomi Syariah (Acara Biasa)": "10a Ekonomi Syariah Biasa",
  // I28 18 Okt: paket ABT abt-hibah-derry (menu 180), abt-wakaf-derry (182), abt-mafqud-derry (184).
  "Putusan Hibah": "4d Hibah",
  "Putusan Wakaf": "4e Wakaf",
  "Putusan Penetapan Mafqud": "9c Penetapan Mafqud",
  // W3a 21 Okt: paket ABT abt-w3a-blangko-baru-perkawinan (menu 168, 170, 172, 174, 176, 178).
  "Putusan Penolakan Perkawinan": "5c Penolakan Perkawinan",
  "Putusan Perkawinan Campuran": "5d Perkawinan Campuran",
  "Putusan Izin Kawin": "3a Izin Kawin",
  "Putusan Pengesahan Anak": "8a Pengesahan Anak",
  "Putusan Kelalaian Kewajiban Suami Istri": "1e Kelalaian Kewajiban Suami Istri",
  "Putusan Hak Bekas Istri": "1f Hak Bekas Istri",
  // W3b 21 Okt: paket abt-w3b-blangko-baru-kuasa-wali (menu 240-253; dibangkitkan ke w3b-jenis-data.ts).
  ...FOLDER_MENU_W3B,
};

/**
 * I9 17 Okt (paket ABT abt-penetap-phs-sita-derry): putusan sela atas permohonan sita. Jalur perkara bersita:
 *   - PHS bawaan menangguhkan penetapan sita sampai kedua pihak didengar (blok otomatis, "@ 2");
 *   - sidang insidentil (BAS ALUR 30/32 "Sidang Insidentil 1" di "4a Harta Bersama - BAS" / "4b Kewarisan - BAS") memeriksa permohonan sita;
 *   - putusan sela dibacakan: dikabulkan [01] atau ditolak [02] di folder "97 Sita" (menu 150, hakim; acuan alur 15-17).
 * Pilihan kabul/tolak belum diketahui saat sidang akan memutus, jadi keduanya ditawarkan - [01] sebagai perkiraan, [02] alternatif.
 */
export const PUTUSAN_SELA_SITA = {
  folder: `${AKAR}/97 Sita`,
  menu: "Putusan Sela & Penetapan Sita",
  alias: ["Sita - Putusan Sela"],
  kabul: "[01] [Kabul] Putusan Sela - Sita Dikabulkan.rtf",
  tolak: "[02] [Tolak] Putusan Sela - Sita Ditolak.rtf",
} as const;

/** Sidang yang agendanya membacakan putusan sela ATAS PERMOHONAN SITA (sela atas eksepsi bukan sela sita). */
const RX_SELA_SITA = /putusan\s+sela/i;
const RX_KONTEKS_SITA = /\bsita\b|insidentil/i;


/**
 * I2 16 Okt (paket ABT abt-ikrar-derry): penetapan sidang ikrar talak Derry di folder "1a Perceraian CT" (menu "Putusan Cerai Talak").
 * [90] Pemohon hadir & Termohon tidak, [90a] keduanya hadir, [91] penetapan putusan gugur karena Pemohon tidak mengikrarkan dalam 6 bulan.
 */
export const PENETAPAN_IKRAR = {
  folder: `${AKAR}/1a Perceraian CT`,
  menu: "Putusan Cerai Talak",
  alias: ["Putusan CT", "CT - Putusan"],
  pTidakHadirT: "[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir.rtf",
  keduanyaHadir: "[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf",
  gugur: "[91] [Ikrar Gugur] Penetapan Kekuatan Putusan Gugur - P Tidak Ikrar 6 Bulan.rtf",
} as const;

/** Baris jenis lama tanpa menu (itsbat, dispensasi): menu menurut jenisnya. */
export const MENU_JENIS_TANPA_MENU: Record<string, string> = { "itsbat nikah": "Putusan Itsbat Nikah", "dispensasi kawin": "Putusan Dispensasi Kawin" };

const URUT_KUMULASI = ["itsbat-nikah", "hak-asuh-anak", "nafkah-anak"];

function kodeKumulasi(kumulasi: unknown): string[] {
  const daftar: unknown[] = Array.isArray(kumulasi) ? kumulasi : kumulasi && typeof kumulasi === "object" && Array.isArray((kumulasi as { daftar?: unknown }).daftar) ? (kumulasi as { daftar: unknown[] }).daftar : [];
  const kode = daftar
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { kode?: unknown }).kode === "string" ? (x as { kode: string }).kode : ""))
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[a-z0-9-]{2,40}$/.test(x));
  return [...new Set(kode)];
}

function calonKunciKumulasi(kumulasi: unknown): string[] {
  const kode = kodeKumulasi(kumulasi).filter((k) => URUT_KUMULASI.includes(k));
  kode.sort((a, b) => URUT_KUMULASI.indexOf(a) - URUT_KUMULASI.indexOf(b));
  const hasil: string[] = [];
  if (kode.length > 1) hasil.push(kode.join("+"));
  for (const k of kode) hasil.push(k);
  return hasil;
}

export type PilihanPutusanBawaan = { kunci: string; baris: BarisPeta; tingkat: "kumulasi-verstek" | "kumulasi-keadaan" | "kumulasi" | "keadaan" | "status-verstek" | "status" | "jenis" };

/**
 * Baris peta bawaan untuk satu perkara: [kumulasi+status+verstek -> kumulasi+status+keadaan -> kumulasi+status ->] [status+keadaan ->] status+verstek -> status -> jenis.
 * CERMIN alatPetaUntukPerkara (panel-alat.js): urutan dan hasilnya sama - dijaga rekomendasi-blangko-q3.test.ts atas matriks masukan.
 */
export function pilihPutusanBawaan(
  peta: Record<string, BarisPeta>,
  jenis: string,
  status: string,
  verstek: boolean,
  kumulasi?: unknown,
  keadaan?: readonly string[]
): PilihanPutusanBawaan | null {
  const j = kunciJenisPerkara(jenis);
  if (!j) return null;
  let s = kunciStatusPutusan(status);
  const kodeKeadaan = [...new Set((keadaan ?? []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => /^[a-z0-9-]{2,40}$/.test(x)))];
  // I20 18 Okt: kabul sebagian - status tetap "Dikabulkan", baris petanya "<jenis>|dikabulkan sebagian[|verstek]" bila jenis itu punya (cermin alatPetaUntukPerkara).
  if (s === "dikabulkan" && kodeKeadaan.includes("dikabulkan-sebagian") && Object.keys(peta).some((k) => k.startsWith(`${j}|dikabulkan sebagian`))) s = "dikabulkan sebagian";
  const v = Boolean(verstek) || /verstek/i.test(String(status || "")) || kodeKeadaan.includes("verstek-tanpa-bendera");
  const ada = (k: string) => Boolean(peta[k] && String(peta[k].berkas || "").trim());
  if (s) {
    for (const kode of calonKunciKumulasi(kumulasi)) {
      const jk = `${j}+${kode}`;
      if (v && ada(`${jk}|${s}|verstek`)) return { kunci: `${jk}|${s}|verstek`, baris: peta[`${jk}|${s}|verstek`], tingkat: "kumulasi-verstek" };
      // I17 18 Okt: baris kumulasi berkeadaan menang atas baris kumulasi polos (folder 1c / 1d) - cermin alatPetaUntukPerkara.
      for (const kodeK of kodeKeadaan) {
        if (kodeK === "verstek-tanpa-bendera") continue;
        if (ada(`${jk}|${s}|${kodeK}`)) return { kunci: `${jk}|${s}|${kodeK}`, baris: peta[`${jk}|${s}|${kodeK}`], tingkat: "kumulasi-keadaan" };
      }
      if (ada(`${jk}|${s}`)) return { kunci: `${jk}|${s}`, baris: peta[`${jk}|${s}`], tingkat: "kumulasi" };
    }
    for (const kode of kodeKeadaan) {
      if (kode === "verstek-tanpa-bendera") continue;
      if (ada(`${j}|${s}|${kode}`)) return { kunci: `${j}|${s}|${kode}`, baris: peta[`${j}|${s}|${kode}`], tingkat: "keadaan" };
    }
  }
  if (s && v && ada(`${j}|${s}|verstek`)) return { kunci: `${j}|${s}|verstek`, baris: peta[`${j}|${s}|verstek`], tingkat: "status-verstek" };
  if (s && ada(`${j}|${s}`)) return { kunci: `${j}|${s}`, baris: peta[`${j}|${s}`], tingkat: "status" };
  if (peta[j]) return { kunci: j, baris: peta[j], tingkat: "jenis" };
  return null;
}

/** Sidang ikrar talak: penetapan ikrar menurut kehadiran (Pemohon tidak hadir = belum ada penetapan; gugur hanya bila teks sidang menyebutnya). */
function rekomendasiPenetapanIkrar(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  const i = PENETAPAN_IKRAR;
  const r = (berkas: string, label: string, alasan: string, utama: boolean, perkiraan: boolean): Rekomendasi => ({
    jenis: "putusan",
    folder: i.folder,
    berkas,
    menu: i.menu,
    alias: perluasAliasMenu(i.alias),
    label,
    alasan,
    utama,
    perkiraan,
  });
  const h = m.dihadiriOleh ?? null;
  const hasil: Rekomendasi[] = [];
  // Tenggat 6 bulan dihitung sejak penetapan hari sidang ikrar (Pasal 70 ayat (6) UU 7/1989); sidang tepat pada batas masih sah.
  const batas = batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: m.tanggalPenetapanSidangIkrar });
  const lewatBatas = Boolean(batas) && /^\d{4}-\d{2}-\d{2}/.test(String(m.tanggalSidang ?? "")) && String(m.tanggalSidang).slice(0, 10) > batas;
  if (lewatBatas || /gugur|6\s*bulan|enam\s+bulan|tidak\s+(?:meng)?ikrar/i.test(teks)) {
    hasil.push(
      r(i.gugur, "Penetapan putusan gugur (tidak ikrar 6 bulan)", lewatBatas ? `Sidang ikrar talak sesudah batas 6 bulan sejak hari sidang ikrar ditetapkan (${batas}): Pemohon tidak mengikrarkan talak.` : "Sidang ikrar talak: Pemohon tidak mengikrarkan talak dalam 6 bulan.", true, !lewatBatas)
    );
  }
  if (h === 3 || h === 4) return hasil; // Pemohon tidak hadir: ikrar belum diucapkan (BAS tunda ALUR 10 [3]/[4])
  const keduanya = h === 1;
  hasil.push(
    r(keduanya ? i.keduanyaHadir : i.pTidakHadirT, keduanya ? "Penetapan ikrar talak (P & T hadir)" : "Penetapan ikrar talak (T tidak hadir)",
      `Sidang ikrar talak: ${keduanya ? "Pemohon dan Termohon hadir" : h === 2 ? "Pemohon hadir, Termohon tidak hadir" : "kehadiran belum tercatat"}.`, !hasil.length, h !== 1 && h !== 2),
    r(keduanya ? i.pTidakHadirT : i.keduanyaHadir, keduanya ? "Penetapan ikrar talak (T tidak hadir)" : "Penetapan ikrar talak (P & T hadir)", "Varian kehadiran pada sidang ikrar.", false, true)
  );
  return hasil;
}

/** Putusan sela sita: hanya sidang yang BELUM memutus perkara, agendanya putusan sela, dan perkaranya bersita (bot) atau agendanya menyebut sita/insidentil. */
function rekomendasiPutusanSelaSita(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  if (m.sudahPutus || !RX_SELA_SITA.test(teks)) return [];
  const bersita = m.bersita === true;
  if (!bersita && !RX_KONTEKS_SITA.test(teks)) return [];
  const i = PUTUSAN_SELA_SITA;
  const r = (berkas: string, label: string, alasan: string, utama: boolean): Rekomendasi => ({
    jenis: "putusan",
    folder: i.folder,
    berkas,
    menu: i.menu,
    alias: perluasAliasMenu(i.alias),
    label,
    alasan,
    utama,
    // Kabul/tolak sela ditentukan majelis; hanya bersita-tidaknya yang pasti.
    perkiraan: true,
  });
  return [
    r(i.kabul, "Putusan sela - sita dikabulkan", `Sidang pembacaan putusan sela atas permohonan sita${bersita ? "" : " (perkara belum ditandai bersita - periksa petitum)"}; dikabulkan diperkirakan, tolak sebagai alternatif.`, true),
    r(i.tolak, "Putusan sela - sita ditolak", "Alternatif pada sidang putusan sela atas permohonan sita.", false),
  ];
}

export function rekomendasiPutusan(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  if (m.sidangIkrarTalak === true && kunciJenisPerkara(m.jenisPerkara) === "cerai talak") return rekomendasiPenetapanIkrar(m, teks);
  // I9 17 Okt: putusan sela sita (bukan putusan akhir) - didahulukan; sela di luar konteks sita tetap diperlakukan seperti dulu.
  const sela = rekomendasiPutusanSelaSita(m, teks);
  if (sela.length) return sela;
  let status = String(m.statusPutusan ?? "").trim();
  let perkiraan = false;
  if (!status && m.putusanSela === true && /^(?:absolut|relatif)$/i.test(String(m.eksepsiKewenangan ?? ""))) {
    // I19 18 Okt: putusan sela atas eksepsi kewenangan bukan status akhir SIPP - baris petanya berstatus "Putusan Sela".
    status = "Putusan Sela";
  } else if (!status) {
    // Belum putus: hanya sidang yang agendanya memutus yang diberi blangko, dengan anggapan dikabulkan.
    if (!/putus|musyawarah|pembacaan\s+(?:putusan|penetapan)/i.test(teks)) return [];
    status = "Dikabulkan";
    perkiraan = true;
  }
  const keadaan = keadaanPutusan({
    jenisPerkara: m.jenisPerkara,
    nomorPerkara: m.nomorPerkara,
    verstekPutusan: m.verstekPutusan,
    dihadiriOleh: m.dihadiriOleh,
    panggilan: { hadirSebelumnya: m.hadirSebelumnya, tergugatPernahHadir: m.tergugatPernahHadir, penggugatPernahHadir: m.penggugatPernahHadir },
    mediasi: m.mediasi ?? null,
    mediasiTerbaca: m.mediasiTerbaca,
    tergugatPerempuan: m.tergugatPerempuan,
    amarPutusan: m.amarPutusan || m.amarRekonvensi,
    ...(m.rekonvensiDikabulkan === undefined ? {} : { rekonvensiDikabulkan: m.rekonvensiDikabulkan }),
    // I17 18 Okt: keadaan gugatan (cabut sesudah jawaban, NO formil / kurang pihak, alamat T tidak diketahui, itsbat kabul-cerai ditolak, kumulasi).
    ...(m.sesudahJawaban === undefined ? {} : { sesudahJawaban: m.sesudahJawaban }),
    penandaJawaban: m.penandaJawaban ?? null,
    cacatFormil: m.cacatFormil,
    kurangPihak: m.kurangPihak,
    kumulasi: m.kumulasi,
    penandaPerkara: m.penandaPerkara ?? null,
    alamatTergugatTidakDiketahui: m.alamatTergugatTidakDiketahui,
    ...(m.itsbatKabulCeraiDitolak === undefined ? {} : { itsbatKabulCeraiDitolak: m.itsbatKabulCeraiDitolak }),
    // I19 18 Okt: pencabutan ditolak T, eksepsi kewenangan (dikabulkan / putusan sela), alasan itsbat.
    cabutDitolakT: m.cabutDitolakT,
    dikabulkanSebagian: m.dikabulkanSebagian,
    penguasaanDialihkan: m.penguasaanDialihkan,
    susunanAhliWaris: m.susunanAhliWaris,
    anakSahPerkawinanTercatat: m.anakSahPerkawinanTercatat,
    pencairanDana: m.pencairanDana,
    kumulasiNafkahIstri: m.kumulasiNafkahIstri,
    susunanAhliWarisLengkap: m.susunanAhliWarisLengkap,
    anakDispensasi: m.anakDispensasi,
    alasanTolakDispensasi: m.alasanTolakDispensasi,
    amarKumulasiItsbat: m.amarKumulasiItsbat,
    mafqud: m.mafqud,
    plusNafkahAnak: m.plusNafkahAnak,
    eksepsiKewenangan: m.eksepsiKewenangan,
    putusanSela: m.putusanSela,
    alasanItsbat: m.alasanItsbat,
  } as MasukanKeadaanPutusan);
  const p = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, m.jenisPerkara, status, m.verstekPutusan === true, m.kumulasi, keadaan);
  if (!p) return [];
  const menu = p.baris.blangko || MENU_JENIS_TANPA_MENU[kunciJenisPerkara(m.jenisPerkara)] || "";
  const folderMenu = FOLDER_MENU_PUTUSAN[menu];
  if (!folderMenu) return [];
  const folder = `${AKAR}/${folderMenu}`;
  const hasil: Rekomendasi[] = [
    {
      jenis: "putusan",
      folder,
      berkas: `${p.baris.berkas.replace(/\.rtf$/i, "")}.rtf`,
      menu,
      alias: perluasAliasMenu(p.baris.blangkoLain ?? []),
      label: p.baris.berkas,
      alasan:
        `Putusan ${status.toLowerCase()}${p.tingkat === "keadaan" || p.tingkat === "kumulasi-keadaan" ? ` (${p.kunci.split("|")[2].replace(/-/g, " ")})` : p.tingkat.includes("verstek") ? " (verstek)" : ""}` +
        `${perkiraan ? " - status belum tercatat, diperkirakan dikabulkan" : ""}.`,
      utama: true,
      perkiraan,
    },
  ];
  // Varian yang disebut baris itu ("varian: A; B") ikut sebagai alternatif.
  const varian = /^varian: /.test(p.baris.catatan ?? "") ? (p.baris.catatan ?? "").replace(/^varian: /, "").split("; ").filter(Boolean) : [];
  for (const v of varian) {
    hasil.push({
      jenis: "putusan",
      folder,
      berkas: `${v.replace(/\.rtf$/i, "")}.rtf`,
      menu,
      alias: perluasAliasMenu(p.baris.blangkoLain ?? []),
      label: v,
      alasan: "Varian pada status yang sama.",
      utama: false,
      perkiraan: true,
    });
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// RELAAS
// ---------------------------------------------------------------------------
export function dariRelaas(b: BlangkoRelaas, alasan: string, utama: boolean): Rekomendasi {
  return {
    jenis: "relaas",
    folder: b.folder,
    berkas: b.berkas,
    menu: b.menuAbt.nama,
    alias: [],
    label: b.label,
    alasan,
    utama,
    perkiraan: b.pihak === "tidak-diketahui",
  };
}

function rekomendasiRelaas(m: MasukanRekomendasi, teks = ""): Rekomendasi[] {
  const opsi = {
    lewatEcourt: m.lewatEcourt === true,
    verstek: m.verstekPutusan === true,
    // I14 18 Okt: pencegahan perkawinan dikenali dari jenis_perkara_id, atau dari namanya bila id tidak terkirim.
    jenisPerkaraId: m.jenisPerkaraId ?? (/pencegahan\s+perkawinan/i.test(String(m.jenisPerkara ?? "")) ? JENIS_PENCEGAHAN_PERKAWINAN : null),
  };
  const hasil: Rekomendasi[] = [];
  const tambah = (b: BlangkoRelaas | null, alasan: string, utama = true) => {
    if (b && !hasil.some((x) => x.berkas === b.berkas)) hasil.push(dariRelaas(b, alasan, utama));
  };
  const sisiDari = (pihak: PihakDipanggil): Array<"pertama" | "kedua"> =>
    pihak === "keduanya" ? ["pertama", "kedua"] : pihak === "pertama" ? ["pertama"] : pihak === "kedua" ? ["kedua"] : [];
  // Sidang ikrar talak yang ditunda diperiksa lebih dulu: perkaranya SUDAH putus (izin ikrar), tetapi yang dipanggil ulang adalah ikrar, bukan pemberitahuan putusan.
  const ikrarDitunda = m.sidangIkrarTalak === true && m.ditunda === true;
  if (m.sudahPutus && !ikrarDitunda) {
    // Pemberitahuan putusan kepada pihak yang tidak hadir saat dibacakan (hadir semua = tidak perlu).
    const pihak = pihakDipanggil(m.dihadiriOleh);
    for (const sisi of sisiDari(pihak)) {
      const keadaan: KeadaanRelaas = "pemberitahuan-putusan";
      tambah(blangkoRelaas(keadaan, sisi, opsi), "Pemberitahuan isi putusan kepada pihak yang tidak hadir.");
      tambah(blangkoAmplopPendamping(keadaan, sisi, opsi), "Amplop pendamping pemberitahuan putusan.", false);
    }
  } else if (m.ditunda) {
    const ikrar = m.sidangIkrarTalak === true;
    const keadaan: KeadaanRelaas = ikrar ? "ikrar-talak" : "sidang-ditunda";
    const pihak = ikrar ? "keduanya" : pihakDipanggil(m.dihadiriOleh);
    for (const sisi of sisiDari(pihak)) {
      tambah(blangkoRelaas(keadaan, sisi, opsi), ikrar ? "Panggilan sidang ikrar talak." : "Panggilan sidang lanjutan kepada pihak yang tidak hadir.");
      tambah(blangkoAmplopPendamping(keadaan, sisi, opsi), "Amplop pendamping panggilan.", false);
    }
    // I2 16 Okt (paket abt-mediasi-derry): sidang ditunda untuk mediasi -> relaas panggilan pertemuan mediasi [JS] 10.1/10.2 sebagai alternatif.
    if (!ikrar && /mediasi/i.test(teks) && !/laporan|berhasil|gagal/i.test(teks)) {
      for (const sisi of sisiDari(pihak)) tambah(blangkoRelaas("mediasi", sisi, opsi), "Panggilan pertemuan mediasi kepada pihak yang tidak hadir.", false);
    }
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Fungsi utama
// ---------------------------------------------------------------------------

/** Masukan dari satu baris jadwal sidang bot (SidangBaris) - ruas yang tak ada dibiarkan kosong (bot lama). */
export function masukanRekomendasiDariBaris(b: Record<string, unknown>): MasukanRekomendasi {
  const panggilan = (b.panggilan && typeof b.panggilan === "object" ? b.panggilan : {}) as Record<string, unknown>;
  const angka = (x: unknown) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
  return {
    jenisPerkara: String(b.jenisPerkara ?? ""),
    nomorPerkara: String(b.nomorPerkara ?? ""),
    urutanSidang: Number(b.urutanSidang) || 0,
    dihadiriOleh: angka(b.dihadiriOleh),
    agenda: String(b.agenda ?? ""),
    alasanDitunda: String(b.alasanDitunda ?? ""),
    tergugatPernahHadir: panggilan.tergugatPernahHadir === true,
    penggugatPernahHadir: panggilan.penggugatPernahHadir === true ? true : panggilan.penggugatPernahHadir === false ? false : null,
    hadirSebelumnya: angka(panggilan.hadirSebelumnya),
    sidangIkrarTalak: b.sidangIkrarTalak === true,
    tanggalSidang: String(b.tanggalSidang ?? "").slice(0, 10),
    tanggalPenetapanSidangIkrar: typeof b.tanggalPenetapanSidangIkrar === "string" ? b.tanggalPenetapanSidangIkrar.slice(0, 10) : null,
    kumulasi: b.kumulasi,
    ditunda: b.ditunda === true,
    sudahPutus: b.sudahPutus === true,
    statusPutusan: String(b.statusPutusan ?? ""),
    verstekPutusan: b.verstekPutusan === true,
    mediasi: b.mediasi && typeof b.mediasi === "object" ? (b.mediasi as { hasil?: unknown }) : null,
    mediasiTerbaca: b.mediasiTerbaca === false ? false : true,
    // 19 Okt: saksi yang TERCATAT diperiksa (bot: saksiDiperiksa, perkara_keterangan_saksi) bila ada; cadangannya saksi yang diajukan
    // kedua sisi (saksiPihak1/2). Tidak ada keduanya = tidak diketahui (bukan nol).
    ...(typeof b.saksiDiperiksa === "number" && b.saksiDiperiksa > 0
      ? { jumlahSaksi: b.saksiDiperiksa }
      : typeof b.saksiPihak1 === "number" || typeof b.saksiPihak2 === "number"
        ? { jumlahSaksi: (Number(b.saksiPihak1) || 0) + (Number(b.saksiPihak2) || 0) }
        : {}),
    lewatEcourt: typeof b.lewatEcourt === "boolean" ? b.lewatEcourt : null,
    jenisPerkaraId: angka(b.jenisPerkaraId),
    // 20 Okt: bahan saran semua jenis (alur, jumlah pihak, petugas tertunjuk) - ruas yang tak terkirim dibiarkan kosong.
    alurPerkaraId: angka(b.alurPerkaraId),
    ...(b.pihak && typeof b.pihak === "object"
      ? {
          jumlahPemohon: Array.isArray((b.pihak as { penggugat?: unknown }).penggugat) ? ((b.pihak as { penggugat: unknown[] }).penggugat.length || null) : null,
          jumlahTermohon: Array.isArray((b.pihak as { tergugat?: unknown }).tergugat) ? (b.pihak as { tergugat: unknown[] }).tergugat.length : null,
        }
      : {}),
    ...(typeof b.majelisNama === "string" ? { majelisAda: b.majelisNama.trim() !== "" || String(b.majelisKode ?? "").trim() !== "" } : {}),
    ...(typeof b.paniteraNama === "string" ? { paniteraAda: b.paniteraNama.trim() !== "" } : {}),
    ...(typeof b.jurusitaNama === "string" ? { jurusitaAda: b.jurusitaNama.trim() !== "" } : {}),
    bersita: Boolean(b.sita) && typeof b.sita === "object",
    tergugatPerempuan: typeof b.tergugatPerempuan === "boolean" ? b.tergugatPerempuan : null,
    amarRekonvensi: typeof b.amarRekonvensi === "string" ? b.amarRekonvensi : "",
    // I17 18 Okt: bahan keadaan gugatan dari baris bot (tidak ada = tidak ditebak).
    penandaJawaban: b.penandaJawaban && typeof b.penandaJawaban === "object" ? (b.penandaJawaban as { berkas?: unknown }) : null,
    penandaPerkara: b.penandaPerkara && typeof b.penandaPerkara === "object" ? (b.penandaPerkara as { ghaib?: unknown }) : null,
    ...(typeof b.sesudahJawaban === "boolean" ? { sesudahJawaban: b.sesudahJawaban } : {}),
    ...(typeof b.cacatFormil === "boolean" ? { cacatFormil: b.cacatFormil } : {}),
    ...(typeof b.kurangPihak === "boolean" ? { kurangPihak: b.kurangPihak } : {}),
    ...(typeof b.alamatTergugatTidakDiketahui === "boolean" ? { alamatTergugatTidakDiketahui: b.alamatTergugatTidakDiketahui } : {}),
    ...(typeof b.itsbatKabulCeraiDitolak === "boolean" ? { itsbatKabulCeraiDitolak: b.itsbatKabulCeraiDitolak } : {}),
    // I19 18 Okt: penanda tegas (tidak ada = tidak ditebak).
    ...(typeof b.cabutDitolakT === "boolean" ? { cabutDitolakT: b.cabutDitolakT } : {}),
    // I20 18 Okt: kabul sebagian (bot), penguasaan anak dialihkan (saklar), sikap Tergugat atas pencabutan (saklar), sudah menjawab.
    ...(typeof b.dikabulkanSebagian === "boolean" ? { dikabulkanSebagian: b.dikabulkanSebagian } : {}),
    ...(typeof b.penguasaanDialihkan === "boolean" ? { penguasaanDialihkan: b.penguasaanDialihkan } : {}),
    // I22 18 Okt: saklar PAW / AUA dan petitum (bot).
    ...(typeof b.susunanAhliWaris === "boolean" ? { susunanAhliWaris: b.susunanAhliWaris } : {}),
    ...(typeof b.anakSahPerkawinanTercatat === "boolean" ? { anakSahPerkawinanTercatat: b.anakSahPerkawinanTercatat } : {}),
    ...(typeof b.pencairanDana === "boolean" ? { pencairanDana: b.pencairanDana } : {}),
    ...(typeof b.kumulasiNafkahIstri === "boolean" ? { kumulasiNafkahIstri: b.kumulasiNafkahIstri } : {}),
    // I26 18 Okt: saklar PAW susunan lengkap, DK ditolak (anak, alasan), cerai kumulasi itsbat ditolak / NO.
    ...(typeof b.susunanAhliWarisLengkap === "boolean" ? { susunanAhliWarisLengkap: b.susunanAhliWarisLengkap } : {}),
    ...(typeof b.anakDispensasi === "string" ? { anakDispensasi: b.anakDispensasi } : {}),
    ...(typeof b.alasanTolakDispensasi === "string" ? { alasanTolakDispensasi: b.alasanTolakDispensasi } : {}),
    ...(typeof b.amarKumulasiItsbat === "string" ? { amarKumulasiItsbat: b.amarKumulasiItsbat } : {}),
    // I28 18 Okt: bot membaca petitum/posita (mafqud, orang hilang); null = bukan Lain-Lain Pdt.P / tidak terbaca (tidak ditebak).
    ...(typeof b.mafqud === "boolean" ? { mafqud: b.mafqud } : {}),
    ...(typeof b.plusNafkahAnak === "boolean" ? { plusNafkahAnak: b.plusNafkahAnak } : {}),
    ...(typeof b.sikapTergugatCabut === "string" ? { sikapTergugatCabut: b.sikapTergugatCabut } : {}),
    ...(typeof b.eksepsiKewenangan === "string" ? { eksepsiKewenangan: b.eksepsiKewenangan } : {}),
    ...(typeof b.putusanSela === "boolean" ? { putusanSela: b.putusanSela } : {}),
    ...(typeof b.alasanItsbat === "string" ? { alasanItsbat: b.alasanItsbat } : {}),
  };
}
export function rekomendasiBlangko(m: MasukanRekomendasi): HasilRekomendasi {
  const { sumber, teks } = teksDasarSidang(m);
  const hasil: HasilRekomendasi = { sumberTeks: sumber, teksDasar: teks, bas: [], putusan: [], relaas: [] };
  if (typeof m.jumlahSaksi === "number" && Number.isFinite(m.jumlahSaksi) && m.jumlahSaksi > 0) hasil.jumlahSaksi = m.jumlahSaksi;
  if (!String(m.jenisPerkara ?? "").trim()) return hasil;
  hasil.bas = rekomendasiBas(m, teks);
  hasil.putusan = rekomendasiPutusan(m, teks);
  hasil.relaas = rekomendasiRelaas(m, teks);
  return hasil;
}
