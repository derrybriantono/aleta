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
import { perkaraGugatan, sebabVerstek, terapkanKeadaanPerkara } from "@/lib/saran-keadaan-perkara";
import { STATUS_PUTUSAN_SIPP, kunciJenisPerkara, kunciStatusPutusan } from "@/lib/pemetaan-blangko";
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
  /** G2B 30 Okt: amar SIPP memuat "verstek" walau putusan_verstek bukan 'Y' (bot amarVerstek). */
  amarVerstek?: boolean;
  /** G2B 30 Okt: penanda prodeo perkara (bot penandaPerkara.prodeo), kuasa tiap sisi (bot kuasaPihak1/2), saksi diajukan tiap sisi. */
  prodeo?: boolean;
  kuasaPihak1?: boolean;
  kuasaPihak2?: boolean;
  saksiP?: number | null;
  saksiT?: number | null;
};

export type HasilRekomendasi = {
  sumberTeks: "alasan-tunda" | "agenda" | "kosong";
  teksDasar: string;
  /** 19 Okt: banyaknya saksi perkara (bila diketahui) - ekstensi memilih varian "(N Saksi)" putusan. */
  jumlahSaksi?: number;
  /** G2B 30 Okt: saksi Penggugat / Tergugat terpisah - ekstensi memilih varian "(N Saksi)" BAS pembuktian P / T. */
  saksiP?: number;
  saksiT?: number;
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
/** 30 Okt 2026 (keputusan pengguna 44): sidang beragenda mediasi selalu dihadiri kedua pihak (mediasi hanya bila keduanya hadir). */
const RX_AGENDA_MEDIASI = /mediasi/i;
const RX_KETIDAKHADIRAN = /tidak\s+(?:hadir|datang|menghadap)|\bghaib\b|\bgaib\b/i;
const RX_AGENDA_KESIMPULAN = /kesimpulan/i;
const RX_TUNDA_PANGGIL = /tunda\s+panggil/i;

function rekomendasiBas(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  const akhir = m.sudahPutus ? akhirDariStatus(m.statusPutusan) : null;
  // Keputusan 44: agenda MEDIASI = kontradiktoir; agenda KESIMPULAN mengikuti kehadiran sidang sebelumnya bila sidang ini belum
  // tercatat, dan tidak pernah "Tunda Panggil T Lagi" (kesimpulan baru diminta sesudah para pihak menjalani pemeriksaan).
  // Hanya bila kehadiran sidang ini BELUM tercatat (sidang yang akan datang / draf H-1): kehadiran yang sudah dicatat SIPP adalah
  // fakta, dan Derry punya BAS laporan mediasi "T Tidak Hadir" (ALUR 06 [2]) untuk sidang laporan yang tidak dihadiri Tergugat.
  const kehadiranBelumTercatat = m.dihadiriOleh === null || m.dihadiriOleh === undefined;
  const agendaMediasi = RX_AGENDA_MEDIASI.test(teks) && !RX_KETIDAKHADIRAN.test(teks) && !m.sudahPutus && kehadiranBelumTercatat;
  const agendaKesimpulan = RX_AGENDA_KESIMPULAN.test(teks) && !agendaMediasi;
  const masukan = {
    jenisPerkara: m.jenisPerkara,
    urutanSidang: Number(m.urutanSidang) || 0,
    dihadiriOleh: agendaMediasi ? 1 : agendaKesimpulan ? (m.dihadiriOleh ?? m.hadirSebelumnya ?? null) : (m.dihadiriOleh ?? null),
    agenda: teks,
    tergugatPernahHadir: agendaMediasi ? true : m.tergugatPernahHadir,
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
  if (agendaKesimpulan) {
    const tanpaTunda = hasil.filter((r) => !RX_TUNDA_PANGGIL.test(`${r.berkas} ${r.label}`));
    // Tanpa calon lain (mis. alur kumulasi hak asuh yang belum punya BAS kesimpulan): lebih baik tanpa saran daripada "tunda panggil".
    if (tanpaTunda.length < hasil.length) {
      if (tanpaTunda.length && !tanpaTunda.some((r) => r.utama)) tanpaTunda[0] = { ...tanpaTunda[0], utama: true, alasan: "Sidang kesimpulan: langkah sesudah pemeriksaan menurut kehadiran sidang sebelumnya." };
      return tanpaTunda;
    }
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
  // 30 Okt: paket ABT sela-ps-30okt - menu 151 putusan sela semua jenis (folder baru "97a Putusan Sela").
  "Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat, Mediasi, Rekonvensi, Penggabungan)": "97a Putusan Sela",
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
 * 30 Okt 2026 (paket ABT sela-ps-30okt): putusan sela SEMUA jenis perkara di bab baru "97a Putusan Sela" (menu 151, hakim) dan BAS-nya di
 * "97a Putusan Sela - BAS" (menu 152, panitera pengganti): eksepsi kewenangan absolut/relatif (ditolak = putusan sela, dikabulkan = putusan akhir),
 * tuntutan provisi, intervensi (voeging, tussenkomst, vrijwaring), sumpah pelengkap (gugatan / permohonan), dan perintah pemeriksaan setempat.
 * Sita tetap di "97 Sita" (PUTUSAN_SELA_SITA). Dikabulkan/ditolak ditentukan majelis: keduanya ditawarkan, yang lazim lebih dulu.
 */
export const PUTUSAN_SELA_UMUM = {
  folder: `${AKAR}/97a Putusan Sela`,
  menu: "Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat, Mediasi, Rekonvensi, Penggabungan)",
  alias: ["Putusan Sela - Putusan", "Putusan Sela (Eksepsi, Provisi, Intervensi, Sumpah, Pemeriksaan Setempat)"],
  berkas: {
    absolutTolak: "[01] [Sela Tolak] Eksepsi Kewenangan Absolut Ditolak - Pemeriksaan Dilanjutkan.rtf",
    absolutKabul: "[02] [NO] Eksepsi Kewenangan Absolut Dikabulkan - Pengadilan Agama Tidak Berwenang (Putusan Akhir).rtf",
    relatifTolak: "[03] [Sela Tolak] Eksepsi Kewenangan Relatif Ditolak - Pemeriksaan Dilanjutkan.rtf",
    relatifKabul: "[04] [NO] Eksepsi Kewenangan Relatif Dikabulkan - Pengadilan Agama Tidak Berwenang (Putusan Akhir).rtf",
    provisiKabul: "[05] [Sela Kabul] Tuntutan Provisi Dikabulkan.rtf",
    provisiTolak: "[06] [Sela Tolak] Tuntutan Provisi Ditolak.rtf",
    voegingKabul: "[07] [Sela Kabul] Intervensi Voeging (Menggabungkan Diri) Dikabulkan.rtf",
    voegingTolak: "[08] [Sela Tolak] Intervensi Voeging (Menggabungkan Diri) Ditolak.rtf",
    tussenkomstKabul: "[09] [Sela Kabul] Intervensi Tussenkomst (Menengahi) Dikabulkan.rtf",
    tussenkomstTolak: "[10] [Sela Tolak] Intervensi Tussenkomst (Menengahi) Ditolak.rtf",
    vrijwaringKabul: "[11] [Sela Kabul] Intervensi Vrijwaring (Penanggungan) Dikabulkan.rtf",
    vrijwaringTolak: "[12] [Sela Tolak] Intervensi Vrijwaring (Penanggungan) Ditolak.rtf",
    sumpahGugatan: "[13] [Sela] Sumpah Pelengkap (Suppletoir) - Gugatan.rtf",
    sumpahPermohonan: "[14] [Sela] Sumpah Pelengkap (Suppletoir) - Permohonan (Penetapan Sela).rtf",
    setempat: "[15] [Sela] Pemeriksaan Setempat - Perintah Pemeriksaan di Lokasi Objek.rtf",
    // 30 Okt (jawaban pengguna butir 9): eksepsi lain - dikabulkan = putusan akhir NO; ditolak = sisipan "Dalam Eksepsi" untuk putusan akhir
    kaburKabul: "[16] [NO] Eksepsi Gugatan Kabur (Obscuur Libel) Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir).rtf",
    kaburTolak: "[17] [Sisipan] Eksepsi Gugatan Kabur (Obscuur Libel) Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir.rtf",
    personaKabul: "[18] [NO] Eksepsi Keliru Pihak (Error in Persona) Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir).rtf",
    personaTolak: "[19] [Sisipan] Eksepsi Keliru Pihak (Error in Persona) Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir.rtf",
    kurangKabul: "[20] [NO] Eksepsi Kurang Pihak (Plurium Litis Consortium) Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir).rtf",
    kurangTolak: "[21] [Sisipan] Eksepsi Kurang Pihak (Plurium Litis Consortium) Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir.rtf",
    nebisKabul: "[22] [NO] Eksepsi Ne Bis In Idem Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir).rtf",
    nebisTolak: "[23] [Sisipan] Eksepsi Ne Bis In Idem Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir.rtf",
    prematurKabul: "[24] [NO] Eksepsi Gugatan Prematur Dikabulkan - Gugatan Tidak Dapat Diterima (Putusan Akhir).rtf",
    prematurTolak: "[25] [Sisipan] Eksepsi Gugatan Prematur Ditolak - Bagian Dalam Eksepsi untuk Putusan Akhir.rtf",
    rekonvensi: "[26] [Sela] Gugatan Rekonvensi Tidak Dapat Diterima - Pemeriksaan Konvensi Dilanjutkan.rtf",
    gabungKabul: "[27] [Sela Kabul] Penggabungan Perkara Dikabulkan.rtf",
    gabungTolak: "[28] [Sela Tolak] Penggabungan Perkara Ditolak.rtf",
    pemutus: "[29] [Sela] Sumpah Pemutus (Decisoir) - Gugatan.rtf",
    penaksir: "[30] [Sela] Sumpah Penaksir (Aestimatoir) - Gugatan.rtf",
    lian: "[31] [Sela] Sumpah Lian - Cerai dengan Alasan Zina.rtf",
    mediasiTergugat: "[32] [Penetapan] Tergugat Tidak Beriktikad Baik dalam Mediasi - Biaya Mediasi (PERMA 1 2016 Pasal 23).rtf",
    mediasiPenggugat: "[33] [NO] Penggugat Tidak Beriktikad Baik dalam Mediasi - Gugatan Tidak Dapat Diterima (PERMA 1 2016 Pasal 22).rtf",
    // 30 Okt putaran 3: sisipan Dalam Rekonvensi, pemisahan perkara (splitsing)
    rekonvensiKabul: "[34] [Sisipan] Gugatan Rekonvensi Dikabulkan - Bagian Dalam Rekonvensi untuk Putusan Akhir.rtf",
    rekonvensiTolak: "[35] [Sisipan] Gugatan Rekonvensi Ditolak - Bagian Dalam Rekonvensi untuk Putusan Akhir.rtf",
    pisahKabul: "[36] [Sela Kabul] Pemisahan Perkara (Splitsing) Dikabulkan.rtf",
    pisahTolak: "[37] [Sela Tolak] Pemisahan Perkara (Splitsing) Ditolak.rtf",
  },
  bas: {
    folder: `${AKAR}/97a Putusan Sela - BAS`,
    menu: "Putusan Sela - BAS",
    alias: ["Putusan Sela - BAS"],
    insidentil: "BAS SELA [1] Sidang Insidentil - Pemeriksaan Eksepsi, Provisi atau Intervensi, Tunda Putusan Sela.rtf",
    pembacaan: "BAS SELA [2] Pembacaan Putusan Sela - Pemeriksaan Dilanjutkan.rtf",
    sumpah: "BAS SELA [3] Sumpah Pelengkap (Suppletoir) - Tunda Putusan.rtf",
    sumpahPutus: "BAS SELA [3a] Sumpah Pelengkap (Suppletoir) - Lalu Putusan Dibacakan.rtf",
    pemutus: "BAS SELA [4] Sumpah Pemutus (Decisoir) - Tunda Putusan.rtf",
    pemutusPutus: "BAS SELA [4a] Sumpah Pemutus (Decisoir) - Lalu Putusan Dibacakan.rtf",
    penaksir: "BAS SELA [5] Sumpah Penaksir (Aestimatoir) - Tunda Putusan.rtf",
    penaksirPutus: "BAS SELA [5a] Sumpah Penaksir (Aestimatoir) - Lalu Putusan Dibacakan.rtf",
    lian: "BAS SELA [6] Sumpah Lian - Tunda Putusan.rtf",
  },
  /** 30 Okt (butir 8): BAS mediasi elektronik PERMA 3/2022 di setiap folder BAS yang punya BAS mediasi biasa [1] (nama sama di semua folder). */
  mediasiBiasa: "BAS ALUR 04 [1] BAS 1 P & T Hadir - Mediasi.rtf",
  mediasiElektronik: "BAS ALUR 04 [1e] BAS 1 P & T Hadir - Mediasi Elektronik (PERMA 3 2022).rtf",
  /** 30 Okt putaran 3: putusan akhir perceraian karena li'an (folder cerai gugat / cerai talak). */
  lianAkhir: {
    "cerai gugat": { folder: `${AKAR}/1 Perceraian CG`, menu: "Putusan Cerai Gugat", berkas: "[97] [Lian] CG - Perkawinan Putus karena Lian (Putusan Akhir).rtf" },
    "cerai talak": { folder: `${AKAR}/1a Perceraian CT`, menu: "Putusan Cerai Talak", berkas: "[97] [Lian] CT - Perkawinan Putus karena Lian (Putusan Akhir).rtf" },
  },
} as const;
const RX_SUMPAH_PELENGKAP = /sumpah\s+(?:pelengkap|tambahan)|supp?l[ei]?t[oi]i?r/i;
const RX_SUMPAH_PEMUTUS = /sumpah\s+pemutus|decis[oi]i?r/i;
const RX_SUMPAH_PENAKSIR = /sumpah\s+penaksir|a?estimat[oi]i?r/i;
const RX_LIAN = /(?:^|[^a-z])li['’]?an(?![a-z])/i;
const RX_IKTIKAD = /(?:tidak|tak)\s+beri[kt]{1,2}ikad\s+baik|i[kt]{1,2}ikad\s+tidak\s+baik/i;
const RX_REKONVENSI = /rekonvensi|gugatan\s+balik/i;
const RX_GABUNG = /penggabungan\s+perkara|digabung(?:kan)?\s+dengan\s+perkara/i;
const RX_PISAH = /pemisahan\s+perkara|splitsing|dipisah(?:kan)?\s+(?:dari|pemeriksaan)/i;
/** 30 Okt putaran 3: BAS mediasi sidang pertama -> nama BAS mediasi elektronik di folder yang sama (sama dengan paket: sumber/mediasi_el.py). */
export function namaMediasiElektronik(berkas: string): string | null {
  if (!/^(?:BAS ALUR 0[45] \[1\] BAS 1 P & T Hadir - Mediasi|BAS ALUR 34 Poligami - Sidang 1 - P & T Hadir - Mediasi|BAS ALUR 36 Cerai Kumulasi IN - T Hadir - Sidang 1 - Mediasi|BAS ALUR 37 CG Kumulasi Hak Asuh - Sidang 1 - P & T Hadir - Mediasi)\.rtf$/.test(berkas)) return null;
  return berkas.replace(" [1] BAS 1 ", " [1e] BAS 1 ").replace(/ - Mediasi\.rtf$/, " - Mediasi Elektronik (PERMA 3 2022).rtf");
}
const RX_MEDIASI_EL = /mediasi[^.;]{0,40}(?:elektronik|daring|online|virtual|jarak\s+jauh)|(?:elektronik|daring|online|virtual)[^.;]{0,20}mediasi/i;
/** Eksepsi selain kewenangan: [kata kunci, kunci berkas kabul, kunci berkas tolak, nama]. */
const EKSEPSI_LAIN: Array<[RegExp, keyof typeof PUTUSAN_SELA_UMUM.berkas, keyof typeof PUTUSAN_SELA_UMUM.berkas, string]> = [
  [/obs?cuur|kabur|tidak\s+jelas/i, "kaburKabul", "kaburTolak", "gugatan kabur"],
  [/error\s+in\s+persona|keliru\s+pihak|salah\s+pihak|diskualifikasi/i, "personaKabul", "personaTolak", "keliru pihak"],
  [/plurium|kurang\s+pihak/i, "kurangKabul", "kurangTolak", "kurang pihak"],
  [/ne\s*bis\s*in\s*idem|nebis/i, "nebisKabul", "nebisTolak", "ne bis in idem"],
  [/prematur/i, "prematurKabul", "prematurTolak", "gugatan prematur"],
];
const RX_PROVISI = /provisi/i;
const RX_INTERVENSI = /intervensi|voeging|tussenkomst|vrijwaring/i;
const RX_EKSEPSI_KEWENANGAN = /eksepsi|kompetensi|kewenangan\s+(?:absolut|relatif|mengadili)/i;
const RX_SETEMPAT_SELA = /setempat|descente/i;

/** Perkara permohonan (voluntair): alur 16 atau nomor Pdt.P. */
function permohonan(m: MasukanRekomendasi): boolean {
  return Number(m.alurPerkaraId) === 16 || /\/Pdt\.P\//i.test(String(m.nomorPerkara ?? ""));
}

/**
 * Saran putusan sela bab 97a menurut agenda/keterangan sidang (dan penanda eksepsi bot bila jenisnya tidak punya blangko sela sendiri).
 * Hanya sidang yang belum memutus perkara. Urutan pengenalan: sumpah, provisi, intervensi, eksepsi kewenangan, pemeriksaan setempat.
 */
export function rekomendasiPutusanSela(m: MasukanRekomendasi, teks: string, darurat = false): Rekomendasi[] {
  if (m.sudahPutus) return [];
  const u = PUTUSAN_SELA_UMUM;
  const b = u.berkas;
  const r = (berkas: string, label: string, alasan: string, utama: boolean): Rekomendasi => ({
    jenis: "putusan", folder: u.folder, berkas, menu: u.menu, alias: perluasAliasMenu([...u.alias]), label, alasan, utama, perkiraan: true,
  });
  const sela = RX_SELA_SITA.test(teks);
  // 30 Okt (butir 7): sumpah pemutus/penaksir hanya gugatan; li'an hanya perkara cerai.
  if (RX_LIAN.test(teks) && /^cerai/.test(kunciJenisPerkara(m.jenisPerkara))) {
    return [r(b.lian, "Putusan sela - sumpah li'an", "Sidang memerintahkan sumpah li'an atas tuduhan zina yang dibantah dan tidak dapat dibuktikan dengan alat bukti lain.", true)];
  }
  if (RX_SUMPAH_PEMUTUS.test(teks) && !permohonan(m)) {
    return [r(b.pemutus, "Putusan sela - sumpah pemutus", "Sidang memerintahkan sumpah pemutus (decisoir) atas permohonan pihak yang tidak mempunyai alat bukti lain.", true)];
  }
  if (RX_SUMPAH_PENAKSIR.test(teks) && !permohonan(m)) {
    return [r(b.penaksir, "Putusan sela - sumpah penaksir", "Sidang memerintahkan sumpah penaksir (aestimatoir) untuk menetapkan jumlah uang atau nilai barang yang dituntut.", true)];
  }
  if (RX_SUMPAH_PELENGKAP.test(teks)) {
    return permohonan(m)
      ? [r(b.sumpahPermohonan, "Penetapan sela - sumpah pelengkap", "Sidang memerintahkan sumpah pelengkap (suppletoir) dalam perkara permohonan.", true)]
      : [r(b.sumpahGugatan, "Putusan sela - sumpah pelengkap", "Sidang memerintahkan sumpah pelengkap (suppletoir) karena bukti belum sempurna.", true)];
  }
  if (permohonan(m)) return [];
  // 30 Okt (butir 8): tidak beriktikad baik dalam mediasi - tergugat = penetapan biaya mediasi (Pasal 23), penggugat = gugatan NO (Pasal 22).
  if (RX_IKTIKAD.test(teks)) {
    const penggugat = /penggugat\s+(?:dinyatakan\s+)?(?:tidak|tak)\s+beri/i.test(teks);
    const t = r(b.mediasiTergugat, "Penetapan - tergugat tidak beriktikad baik dalam mediasi", "Laporan mediator menyatakan tergugat tidak beriktikad baik: penetapan biaya mediasi sebelum pemeriksaan dilanjutkan.", !penggugat);
    const g = r(b.mediasiPenggugat, "Putusan - penggugat tidak beriktikad baik dalam mediasi", "Laporan mediator menyatakan penggugat tidak beriktikad baik: gugatan tidak dapat diterima dan biaya mediasi dibebankan.", penggugat);
    return penggugat ? [g, t] : [t, g];
  }
  if (RX_REKONVENSI.test(teks) && sela) {
    return [r(b.rekonvensi, "Putusan sela - gugatan rekonvensi tidak dapat diterima", "Sidang memutus gugatan rekonvensi lebih dahulu; pemeriksaan gugatan konvensi dilanjutkan.", true)];
  }
  // 30 Okt putaran 3: rekonvensi diputus bersama konvensi -> sisipan "Dalam Rekonvensi" untuk putusan akhir.
  if (RX_REKONVENSI.test(teks) && /putus|musyawarah/i.test(teks)) {
    return [r(b.rekonvensiKabul, "Bagian putusan akhir - rekonvensi dikabulkan", "Gugatan rekonvensi diputus bersama konvensi: bagian Dalam Rekonvensi untuk disalin ke putusan akhir.", true),
      r(b.rekonvensiTolak, "Bagian putusan akhir - rekonvensi ditolak", "Alternatif bila gugatan rekonvensi ditolak.", false),
      r(b.rekonvensi, "Putusan sela - gugatan rekonvensi tidak dapat diterima", "Alternatif bila rekonvensi tidak memenuhi syarat formil.", false)];
  }
  if (RX_PISAH.test(teks)) {
    return [r(b.pisahKabul, "Putusan sela - pemisahan perkara dikabulkan", "Sidang memutus permohonan pemisahan perkara; dikabulkan diperkirakan, ditolak sebagai alternatif.", true),
      r(b.pisahTolak, "Putusan sela - pemisahan perkara ditolak", "Alternatif pada sidang putusan sela atas permohonan pemisahan perkara.", false)];
  }
  if (RX_GABUNG.test(teks)) {
    return [r(b.gabungKabul, "Putusan sela - penggabungan perkara dikabulkan", "Sidang memutus permohonan penggabungan perkara; dikabulkan diperkirakan, ditolak sebagai alternatif.", true),
      r(b.gabungTolak, "Putusan sela - penggabungan perkara ditolak", "Alternatif pada sidang putusan sela atas permohonan penggabungan perkara.", false)];
  }
  // 30 Okt (butir 9): eksepsi selain kewenangan diputus bersama pokok perkara (Pasal 162 RBg).
  if (/eksepsi/i.test(teks) && !/kewenangan|kompetensi/i.test(teks)) {
    for (const [pola, kabul, tolak, nama] of EKSEPSI_LAIN) {
      if (!pola.test(teks)) continue;
      return [r(b[tolak], `Bagian putusan akhir - eksepsi ${nama} ditolak`, "Eksepsi selain kewenangan diputus bersama pokok perkara: bagian Dalam Eksepsi untuk disalin ke putusan akhir.", true),
        r(b[kabul], `Putusan - eksepsi ${nama} dikabulkan`, "Alternatif: eksepsi dikabulkan - gugatan tidak dapat diterima (putusan akhir).", false)];
    }
  }
  if (RX_PROVISI.test(teks) && (sela || /putus/i.test(teks))) {
    return [r(b.provisiKabul, "Putusan sela - provisi dikabulkan", "Sidang memutus tuntutan provisi; dikabulkan diperkirakan, ditolak sebagai alternatif.", true),
      r(b.provisiTolak, "Putusan sela - provisi ditolak", "Alternatif pada sidang putusan sela atas tuntutan provisi.", false)];
  }
  if (RX_INTERVENSI.test(teks)) {
    const pilih: Array<[string, string, string]> = /tussenkomst|menengahi/i.test(teks)
      ? [[b.tussenkomstKabul, b.tussenkomstTolak, "tussenkomst"]]
      : /vrijwaring|penanggung/i.test(teks)
        ? [[b.vrijwaringKabul, b.vrijwaringTolak, "vrijwaring"]]
        : /voeging|menggabung/i.test(teks)
          ? [[b.voegingKabul, b.voegingTolak, "voeging"]]
          : [[b.voegingKabul, b.voegingTolak, "voeging"], [b.tussenkomstKabul, b.tussenkomstTolak, "tussenkomst"], [b.vrijwaringKabul, b.vrijwaringTolak, "vrijwaring"]];
    return pilih.flatMap(([k, t, nama], i) => [
      r(k, `Putusan sela - intervensi ${nama} dikabulkan`, `Sidang memutus permohonan intervensi (${nama}); dikabulkan diperkirakan, ditolak sebagai alternatif.`, i === 0),
      r(t, `Putusan sela - intervensi ${nama} ditolak`, `Alternatif pada sidang putusan sela atas permohonan intervensi (${nama}).`, false),
    ]);
  }
  const eksepsiPenanda = /^(?:absolut|relatif)$/i.test(String(m.eksepsiKewenangan ?? "")) && m.putusanSela === true;
  if ((RX_EKSEPSI_KEWENANGAN.test(teks) && sela) || (darurat && eksepsiPenanda)) {
    const relatif = /relatif/i.test(teks) || /^relatif$/i.test(String(m.eksepsiKewenangan ?? ""));
    const [tolak, kabul, lain] = relatif ? [b.relatifTolak, b.relatifKabul, b.absolutTolak] : [b.absolutTolak, b.absolutKabul, b.relatifTolak];
    const jenis = relatif ? "relatif" : "absolut";
    const lama = PETA_PUTUSAN_BAWAAN[`${kunciJenisPerkara(m.jenisPerkara)}|putusan sela|eksepsi-${jenis}-ditolak-putusan-sela`];
    const folderLama = lama?.blangko ? FOLDER_MENU_PUTUSAN[lama.blangko] : undefined;
    const alternatifLama: Rekomendasi[] = lama && folderLama
      ? [{ jenis: "putusan", folder: `${AKAR}/${folderLama}`, berkas: `${lama.berkas.replace(/\.rtf$/i, "")}.rtf`, menu: lama.blangko ?? "", alias: perluasAliasMenu(lama.blangkoLain ?? []),
          label: lama.berkas, alasan: "Alternatif: blangko putusan sela eksepsi di folder jenis perkara ini.", utama: false, perkiraan: true }]
      : [];
    return [r(tolak, `Putusan sela - eksepsi kewenangan ${jenis} ditolak`, `Sidang memutus eksepsi kewenangan ${jenis}; ditolak (pemeriksaan dilanjutkan) diperkirakan.`, true),
      r(kabul, `Putusan - eksepsi kewenangan ${jenis} dikabulkan`, "Alternatif: eksepsi dikabulkan - perkara selesai dengan putusan akhir (biaya menurut putusan akhir).", false),
      r(lain, `Putusan sela - eksepsi kewenangan ${relatif ? "absolut" : "relatif"} ditolak`, "Alternatif bila eksepsinya mengenai kewenangan yang lain.", false), ...alternatifLama];
  }
  if (sela && RX_SETEMPAT_SELA.test(teks)) {
    return [r(b.setempat, "Putusan sela - pemeriksaan setempat", "Sidang membacakan putusan sela yang memerintahkan pemeriksaan setempat atas objek sengketa.", true)];
  }
  return [];
}

/** BAS sidang putusan sela (bab 97a - BAS): sumpah pelengkap, pembacaan putusan sela, sidang insidentil selain sita. Kosong bila agenda lain. */
export function rekomendasiBasSela(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  if (m.sudahPutus) return [];
  const x = PUTUSAN_SELA_UMUM.bas;
  const r = (berkas: string, label: string, alasan: string, utama = true): Rekomendasi => ({
    jenis: "bas", folder: x.folder, berkas, menu: x.menu, alias: perluasAliasMenu([...x.alias]), label, alasan, utama, perkiraan: true,
  });
  // 30 Okt (butir 7): tiap jenis sumpah punya BAS "tunda putusan" dan "lalu putusan dibacakan" pada hari yang sama.
  const lalu = /(?:dan|lalu|kemudian|serta|dilanjutkan)\s+(?:musyawarah|putusan(?!\s+sela)|pembacaan\s+putusan(?!\s+sela)|pengucapan\s+putusan(?!\s+sela))/i.test(teks);
  const sumpah = (tunda: string, putus: string, nama: string) =>
    lalu
      ? [r(putus, `BAS sumpah ${nama} lalu putusan dibacakan`, `Sidang pengucapan sumpah ${nama}, lalu putusan dibacakan pada hari itu juga.`), r(tunda, `BAS sumpah ${nama}`, "Alternatif bila putusan ditunda ke sidang berikutnya.", false)]
      : [r(tunda, `BAS sumpah ${nama}`, `Sidang pengucapan sumpah ${nama} sesudah putusan sela; putusan ditunda.`), r(putus, `BAS sumpah ${nama} lalu putusan dibacakan`, "Alternatif bila putusan dibacakan pada hari yang sama.", false)];
  if (RX_LIAN.test(teks) && /^cerai/.test(kunciJenisPerkara(m.jenisPerkara))) return [r(x.lian, "BAS sumpah li'an", "Sidang pengucapan sumpah li'an sesudah putusan sela.")];
  if (RX_SUMPAH_PEMUTUS.test(teks)) return sumpah(x.pemutus, x.pemutusPutus, "pemutus");
  if (RX_SUMPAH_PENAKSIR.test(teks)) return sumpah(x.penaksir, x.penaksirPutus, "penaksir");
  if (RX_SUMPAH_PELENGKAP.test(teks)) return sumpah(x.sumpah, x.sumpahPutus, "pelengkap");
  // Harta bersama / kewarisan punya BAS pembacaan putusan sela sendiri (ALUR 30/32 "Sidang Insidentil 2"): tidak didahului.
  const kebendaan = ["harta bersama", "kewarisan"].includes(kunciJenisPerkara(m.jenisPerkara));
  if (RX_SELA_SITA.test(teks) && !RX_KONTEKS_SITA.test(teks) && !(m.bersita === true) && !kebendaan) return [r(x.pembacaan, "BAS pembacaan putusan sela", "Sidang pembacaan putusan sela; amar diambil dari putusan sela yang tercatat di SIPP.")];
  if (/insidentil/i.test(teks) && !/\bsita\b/i.test(teks) && !(m.bersita === true)) return [r(x.insidentil, "BAS sidang insidentil", "Sidang insidentil memeriksa eksepsi, provisi, atau intervensi sebelum putusan sela.")];
  return [];
}


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
  // 28 Okt 2026 (keputusan P4a, paket ABT blangko-ikrar-92-28okt): Pemohon rukun kembali, tidak menjatuhkan ikrar.
  rukunPTidakHadirT: "[92] [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf",
  rukunKeduanyaHadir: "[92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf",
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
  // 28 Okt 2026: hasil sidang "rukun kembali" -> penetapan rukun kembali [92]/[92a] didahulukan.
  if (/\brukun\b/i.test(teks)) {
    hasil.push(
      r(keduanya ? i.rukunKeduanyaHadir : i.rukunPTidakHadirT, keduanya ? "Penetapan rukun kembali (P & T hadir)" : "Penetapan rukun kembali (T tidak hadir)",
        "Sidang ikrar talak: Pemohon dan Termohon rukun kembali, ikrar talak tidak dijatuhkan.", !hasil.length, h !== 1 && h !== 2)
    );
  }
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

/**
 * 27 Okt: status putusan menurut keterangan sidang ("putus Tidak Dapat Diterima", "putus DIKABULKAN (verstek)", "Panggil T · putus NO")
 * sebelum status tercatat di SIPP. Hanya kata SESUDAH "putus" yang dibaca; nama status SIPP (terpanjang lebih dulu) atau singkatan lazim.
 * Kosong bila keterangan tidak menyebut hasil (mis. hanya "putus" atau "musyawarah").
 */
export function statusDariKeteranganPutus(teks: string): string {
  const m = /\bputus(?:an)?\b([^\r\n·]*)/i.exec(String(teks ?? ""));
  if (!m) return "";
  const sisa = ` ${kunciStatusPutusan(m[1]).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ")} `;
  const nama = [...STATUS_PUTUSAN_SIPP].map((x) => x.nama).sort((a, b) => b.length - a.length);
  for (const n of nama) if (sisa.includes(` ${n.toLowerCase()} `)) return n;
  const singkat: Array<[RegExp, string]> = [
    [/ (?:no|n o|niet ontvankelijk) /, "Tidak Dapat Diterima"],
    [/ (?:kabul|dikabulkan sebagian) /, "Dikabulkan"],
    [/ tolak /, "Ditolak"],
    [/ cabut /, "Dicabut"],
    [/ (?:gugur|digugurkan) /, "Digugurkan"],
    [/ coret /, "Dicoret dari Register"],
    [/ damai /, "Perdamaian"],
  ];
  for (const [pola, n] of singkat) if (pola.test(sisa)) return n;
  return "";
}

export function rekomendasiPutusan(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  if (m.sidangIkrarTalak === true && kunciJenisPerkara(m.jenisPerkara) === "cerai talak") return rekomendasiPenetapanIkrar(m, teks);
  // I9 17 Okt: putusan sela sita (bukan putusan akhir) - didahulukan; sela di luar konteks sita tetap diperlakukan seperti dulu.
  const sela = rekomendasiPutusanSelaSita(m, teks);
  if (sela.length) return sela;
  // 30 Okt (paket ABT sela-ps-30okt): putusan sela bab 97a menurut agenda/keterangan (sumpah, provisi, intervensi, eksepsi, pemeriksaan setempat).
  // 30 Okt putaran 3: putusan akhir li'an (perkara cerai yang diputus sesudah sumpah li'an).
  const kunciCerai = kunciJenisPerkara(m.jenisPerkara);
  const lian = PUTUSAN_SELA_UMUM.lianAkhir[kunciCerai as keyof typeof PUTUSAN_SELA_UMUM.lianAkhir];
  if (lian && RX_LIAN.test(teks) && (m.sudahPutus === true || (/putus|musyawarah|telah\s+(?:diucapkan|dilakukan|dilaksanakan)/i.test(teks) && !RX_SELA_SITA.test(teks)))) {
    return [{ jenis: "putusan", folder: lian.folder, berkas: lian.berkas, menu: lian.menu, alias: perluasAliasMenu([lian.menu]), label: "Putusan - perkawinan putus karena li'an",
      alasan: "Sumpah li'an telah diucapkan kedua belah pihak: perkawinan putus untuk selama-lamanya (KHI Pasal 125 dan 162).", utama: true, perkiraan: true }];
  }
  const selaUmum = rekomendasiPutusanSela(m, teks);
  if (selaUmum.length) return selaUmum;
  let status = String(m.statusPutusan ?? "").trim();
  let perkiraan = false;
  let menurutKeterangan = false;
  if (!status && m.putusanSela === true && /^(?:absolut|relatif)$/i.test(String(m.eksepsiKewenangan ?? ""))) {
    // I19 18 Okt: putusan sela atas eksepsi kewenangan bukan status akhir SIPP - baris petanya berstatus "Putusan Sela".
    status = "Putusan Sela";
  } else if (!status) {
    // Belum putus: hanya sidang yang agendanya memutus yang diberi blangko.
    if (!/putus|musyawarah|pembacaan\s+(?:putusan|penetapan)/i.test(teks)) return [];
    // 27 Okt: keterangan sidang yang sudah menyebut hasilnya ("putus Tidak Dapat Diterima", perkara 591) dipakai sebelum status
    // tercatat di SIPP; anggapan dikabulkan hanya bila keterangan tidak menyebut hasil.
    const dariKeterangan = statusDariKeteranganPutus(teks);
    if (dariKeterangan) {
      status = dariKeterangan;
      menurutKeterangan = true;
    } else {
      status = "Dikabulkan";
      perkiraan = true;
    }
  }
  // 27 Okt (keputusan pengguna, perkara 591): putusan NO, Penggugat pernah hadir lalu tidak hadir di sidang sebelumnya = SEMA 1/2022,
  // diucapkan di luar hadirnya Penggugat dan Tergugat walau kehadiran sidang putus tercatat "Penggugat saja" (2).
  const noSema = kunciStatusPutusan(status) === "tidak dapat diterima" && Number(m.hadirSebelumnya) === 4 && m.penggugatPernahHadir === true && Number(m.dihadiriOleh) === 2;
  const keadaan = keadaanPutusan({
    jenisPerkara: m.jenisPerkara,
    nomorPerkara: m.nomorPerkara,
    verstekPutusan: m.verstekPutusan,
    dihadiriOleh: noSema ? 4 : m.dihadiriOleh,
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
  // 30 Okt: jenis tanpa blangko sela eksepsi sendiri -> bab 97a Putusan Sela.
  if (status === "Putusan Sela" && (!p || p.tingkat === "jenis")) return rekomendasiPutusanSela(m, teks, true);
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
        `${perkiraan ? " - status belum tercatat, diperkirakan dikabulkan" : menurutKeterangan ? " - menurut keterangan sidang, status belum tercatat di SIPP" : ""}.`,
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
    // G2B 30 Okt: keadaan perkara untuk saran pertama yang benar (saran-keadaan-perkara.ts).
    ...(b.amarVerstek === true ? { amarVerstek: true } : {}),
    ...(b.penandaPerkara && typeof b.penandaPerkara === "object" && (b.penandaPerkara as { prodeo?: unknown }).prodeo === true ? { prodeo: true } : {}),
    ...(typeof b.kuasaPihak1 === "boolean" ? { kuasaPihak1: b.kuasaPihak1 } : {}),
    ...(typeof b.kuasaPihak2 === "boolean" ? { kuasaPihak2: b.kuasaPihak2 } : {}),
    ...(typeof b.saksiPihak1 === "number" ? { saksiP: b.saksiPihak1 } : {}),
    ...(typeof b.saksiPihak2 === "number" ? { saksiT: b.saksiPihak2 } : {}),
  };
}
export function rekomendasiBlangko(masukan: MasukanRekomendasi): HasilRekomendasi {
  // Keputusan pengguna 30 Okt malam (no. 38a): perkara PERMOHONAN tidak pernah verstek - tanda verstek SIPP / amar verstek pada Pdt.P
  // diabaikan (catatan temuannya di panel cetak Blangko Derry). Cerai talak / izin poligami (Pdt.G "Pemohon") tetap gugatan.
  const pastiPermohonan = Number(masukan.alurPerkaraId) === 16 || (!masukan.alurPerkaraId && /\/pdt\.p\//i.test(String(masukan.nomorPerkara ?? "")) && !perkaraGugatan(masukan));
  const m: MasukanRekomendasi = pastiPermohonan && (masukan.verstekPutusan || masukan.amarVerstek) ? { ...masukan, verstekPutusan: false, amarVerstek: false } : masukan;
  const { sumber, teks } = teksDasarSidang(m);
  const hasil: HasilRekomendasi = { sumberTeks: sumber, teksDasar: teks, bas: [], putusan: [], relaas: [] };
  if (typeof m.jumlahSaksi === "number" && Number.isFinite(m.jumlahSaksi) && m.jumlahSaksi > 0) hasil.jumlahSaksi = m.jumlahSaksi;
  if (!String(m.jenisPerkara ?? "").trim()) return hasil;
  hasil.bas = rekomendasiBas(m, teks);
  // 30 Okt: BAS sidang putusan sela bab 97a didahulukan (sumpah, pembacaan putusan sela di luar sita, sidang insidentil di luar sita).
  const basSela = rekomendasiBasSela(m, teks);
  if (basSela.length) hasil.bas = [...basSela, ...hasil.bas.map((x) => ({ ...x, utama: false }))];
  // 30 Okt (butir 8): mediasi elektronik (PERMA 3/2022) - BAS [1e] di folder yang sama didahulukan, BAS mediasi biasa jadi alternatif.
  if (RX_MEDIASI_EL.test(teks)) {
    hasil.bas = hasil.bas.flatMap((x) => {
      const el = namaMediasiElektronik(x.berkas);
      return el
        ? [{ ...x, berkas: el, label: `${x.label} (mediasi elektronik)`, alasan: "Para pihak sepakat mediasi dilaksanakan secara elektronik (PERMA 3 Tahun 2022 Pasal 5 dan Pasal 6)." }, { ...x, utama: false }]
        : [x];
    });
  }
  // G2B 30 Okt: verstek menurut keadaan perkara (amar SIPP menyebut verstek; Tergugat tidak pernah hadir) sebelum peta putusan dibaca.
  const verstekSebab = sebabVerstek(m, teks);
  hasil.putusan = rekomendasiPutusan(verstekSebab ? { ...m, verstekPutusan: true } : m, teks);
  hasil.relaas = rekomendasiRelaas(verstekSebab === "amar" ? { ...m, verstekPutusan: true } : m, teks);
  return terapkanKeadaanPerkara(hasil, m, teks, verstekSebab);
}
