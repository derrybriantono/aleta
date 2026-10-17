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
import { tentukanAlurBasKumulasi } from "@/lib/alur-bas-kumulasi";
import { tentukanBasBaru } from "@/lib/alur-bas-baru";
import { keadaanPutusan, type MasukanKeadaanPutusan } from "@/lib/keadaan-putusan";
import { kunciJenisPerkara, kunciStatusPutusan } from "@/lib/pemetaan-blangko";
import { blangkoAmplopPendamping, blangkoRelaas, pihakDipanggil, type BlangkoRelaas, type KeadaanRelaas, type PihakDipanggil } from "@/lib/pohon-blangko";
import { CERMIN_EKSTENSI } from "@/lib/tipe-keluaran/bawaan/bawaan-ekstensi";

const AKAR = "derry_briantono";

export type JenisRekomendasi = "bas" | "putusan" | "relaas";

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
  kumulasi?: unknown;
  ditunda?: boolean;
  sudahPutus?: boolean;
  statusPutusan?: string;
  verstekPutusan?: boolean;
  mediasi?: { hasil?: unknown } | null;
  mediasiTerbaca?: boolean;
  lewatEcourt?: boolean | null;
};

export type HasilRekomendasi = {
  sumberTeks: "alasan-tunda" | "agenda" | "kosong";
  teksDasar: string;
  bas: Rekomendasi[];
  putusan: Rekomendasi[];
  relaas: Rekomendasi[];
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
      alias: s.alias ? [s.alias] : [],
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
};

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
const MENU_JENIS_TANPA_MENU: Record<string, string> = { "itsbat nikah": "Putusan Itsbat Nikah", "dispensasi kawin": "Putusan Dispensasi Kawin" };

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

export type PilihanPutusanBawaan = { kunci: string; baris: BarisPeta; tingkat: "kumulasi-verstek" | "kumulasi" | "keadaan" | "status-verstek" | "status" | "jenis" };

/**
 * Baris peta bawaan untuk satu perkara: [kumulasi+status+verstek -> kumulasi+status ->] [status+keadaan ->] status+verstek -> status -> jenis.
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
  const s = kunciStatusPutusan(status);
  const kodeKeadaan = [...new Set((keadaan ?? []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => /^[a-z0-9-]{2,40}$/.test(x)))];
  const v = Boolean(verstek) || /verstek/i.test(String(status || "")) || kodeKeadaan.includes("verstek-tanpa-bendera");
  const ada = (k: string) => Boolean(peta[k] && String(peta[k].berkas || "").trim());
  if (s) {
    for (const kode of calonKunciKumulasi(kumulasi)) {
      const jk = `${j}+${kode}`;
      if (v && ada(`${jk}|${s}|verstek`)) return { kunci: `${jk}|${s}|verstek`, baris: peta[`${jk}|${s}|verstek`], tingkat: "kumulasi-verstek" };
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
    alias: [...i.alias],
    label,
    alasan,
    utama,
    perkiraan,
  });
  const h = m.dihadiriOleh ?? null;
  const hasil: Rekomendasi[] = [];
  if (/gugur|6\s*bulan|enam\s+bulan|tidak\s+(?:meng)?ikrar/i.test(teks)) {
    hasil.push(r(i.gugur, "Penetapan putusan gugur (tidak ikrar 6 bulan)", "Sidang ikrar talak: Pemohon tidak mengikrarkan talak dalam 6 bulan.", true, true));
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

function rekomendasiPutusan(m: MasukanRekomendasi, teks: string): Rekomendasi[] {
  if (m.sidangIkrarTalak === true && kunciJenisPerkara(m.jenisPerkara) === "cerai talak") return rekomendasiPenetapanIkrar(m, teks);
  let status = String(m.statusPutusan ?? "").trim();
  let perkiraan = false;
  if (!status) {
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
      alias: p.baris.blangkoLain ?? [],
      label: p.baris.berkas,
      alasan:
        `Putusan ${status.toLowerCase()}${p.tingkat === "keadaan" ? ` (${p.kunci.split("|")[2].replace(/-/g, " ")})` : p.tingkat.includes("verstek") ? " (verstek)" : ""}` +
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
      alias: p.baris.blangkoLain ?? [],
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
function dariRelaas(b: BlangkoRelaas, alasan: string, utama: boolean): Rekomendasi {
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
  const opsi = { lewatEcourt: m.lewatEcourt === true, verstek: m.verstekPutusan === true };
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
    kumulasi: b.kumulasi,
    ditunda: b.ditunda === true,
    sudahPutus: b.sudahPutus === true,
    statusPutusan: String(b.statusPutusan ?? ""),
    verstekPutusan: b.verstekPutusan === true,
    mediasi: b.mediasi && typeof b.mediasi === "object" ? (b.mediasi as { hasil?: unknown }) : null,
    mediasiTerbaca: b.mediasiTerbaca === false ? false : true,
    lewatEcourt: typeof b.lewatEcourt === "boolean" ? b.lewatEcourt : null,
  };
}
export function rekomendasiBlangko(m: MasukanRekomendasi): HasilRekomendasi {
  const { sumber, teks } = teksDasarSidang(m);
  const hasil: HasilRekomendasi = { sumberTeks: sumber, teksDasar: teks, bas: [], putusan: [], relaas: [] };
  if (!String(m.jenisPerkara ?? "").trim()) return hasil;
  hasil.bas = rekomendasiBas(m, teks);
  hasil.putusan = rekomendasiPutusan(m, teks);
  hasil.relaas = rekomendasiRelaas(m, teks);
  return hasil;
}
