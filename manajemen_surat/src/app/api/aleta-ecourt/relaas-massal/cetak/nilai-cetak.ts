/**
 * ============================================================================
 * SATU PENILAIAN "DAPAT DICETAK ATAU TIDAK" - DIPAKAI RUTE DAN DIALOG
 * ============================================================================
 *
 * Rute portal (cetak/route.ts) menilai tiap dokumen sekali, dan dialog Cetak
 * relaas menilai ULANG dokumen yang pihaknya dipilihkan juru sita. Keduanya
 * WAJIB memakai aturan yang sama: dua salinan aturan yang sedikit berbeda
 * membuat layar mencentang dokumen yang oleh rute dinyatakan tidak dapat
 * dicetak, atau sebaliknya - dan yang dikirim ke ekstensi adalah yang di
 * layar.
 *
 * Berkas ini murni: hanya pohon-blangko.ts yang diimpor, tanpa peladen, tanpa
 * React. Itu yang membuatnya boleh diimpor layar peramban walau letaknya di
 * bawah src/app/api - hanya route.ts yang istimewa di sana.
 *
 * Nama berkas blangko TIDAK ditulis di sini. '[JS] 1. Relaas Panggilan Sidang
 * T (Sidang Lanjutan) .rtf' punya satu spasi sebelum ".rtf"; namanya hanya
 * dibaca dari pohon-blangko.ts lewat blangkoRelaas().
 *
 * ============================================================================
 * YANG PASTI DITOLAK ABT TIDAK DAPAT DICETAK - DAN SEBABNYA DIKATAKAN
 * ============================================================================
 *
 * ABT memeriksa perkara.proses_terakhir_id terhadap proses_id_min/max menu
 * blangkonya SAAT MENCETAK (controllers/Abt.php html_cari_perkara, baris 312)
 * dan menolak semua akun selain grup 1. Menu relaas setempat berentang 80-220,
 * sedangkan ikrar talak berada di proses 290-296 (293 = Penetapan Hari Sidang
 * Ikrar Talak) dan verzet di 240-260 - dokumen seperti itu SELALU gagal di
 * putaran (telaah 25 September 2026: 61 dari 107 dokumen ikrar 2026). Karena
 * itu bisaDicetak = false dengan sebab yang menyebut rentang dan tempat
 * mengubahnya (menu ABT), bukan tampil "siap dicetak".
 *
 * ============================================================================
 * PERINGATAN - DAPAT DICETAK, TETAPI JANGAN IKUT "PILIH SEMUA" TANPA DILIHAT
 * ============================================================================
 *
 *   putusan dicabut / gugur   pemberitahuannya jarang dikirim di satker ini
 *                             (dicabut: 12 dari 110 berberkas PBT; gugur Pdt.P
 *                             3 dari 37) - PERLU KONFIRMASI, dan tidak ikut
 *                             "Pilih semua" (ikutPilihSemua = false) tanpa
 *                             mengunci centangnya: keputusannya pada juru sita.
 *
 * Peringatan jumlah pihak hanya MEMBERI TAHU: dokumennya tetap benar untuk
 * pihak yang dimuatnya, tetapi pihak lain perlu relaas sendiri.
 */

import {
  BLANGKO_RELAAS,
  blangkoRelaas,
  keadaanUntukGolongan,
  type PihakDipanggil,
} from "@/lib/pohon-blangko";

import { uraiKunciRelaas } from "@/lib/pemetaan-blangko";
import { strukturPihakRelaas } from "@/lib/relaas-pihak";

import { blangkoMenurutPemetaan, opsiEcourtDokumen } from "./pemetaan-cetak";

/**
 * Peta pemetaan blangko admin yang BERLAKU (admin di atas bawaan) - dikirim
 * rute bersama dokumennya, supaya layar menilai ulang dengan peta yang SAMA
 * (6 Okt, butir 10: sebelumnya layar menilai ulang tanpa peta, sehingga
 * berkas yang dikirim ke ekstensi selalu bawaan pohon-blangko.ts).
 */
export type PetaBlangkoCetak = { relaas: Record<string, string>; pbt: Record<string, string> };

/** Pihak yang boleh DIPILIH juru sita bila SIPP tidak menjawabnya. */
export type PihakPilihan = "pertama" | "kedua" | "keduanya";

export const PIHAK_PILIHAN: PihakPilihan[] = ["pertama", "kedua", "keduanya"];

/** Ruas dokumen yang dibaca penilaian ini - sisanya tidak disentuh. Ruas opsional datang dari bot versi baru. */
export type DokumenDinilai = {
  perkaraId: unknown;
  golongan: unknown;
  d: unknown;
  pihakDipanggil: unknown;
  alurPerkaraId?: unknown;
  prosesTerakhirId?: unknown;
  prosesTerakhirNama?: unknown;
  statusPutusanNama?: unknown;
  jumlahPihak?: { pertama?: unknown; kedua?: unknown; lain?: unknown } | null;
  sebutanPihak?: { pertama?: unknown; kedua?: unknown } | null;
  /** Q3 16 Okt: perkara terdaftar lewat e-Court / putusannya verstek - bot relaasMassalService; kosong = bot lama (perilaku lama). */
  lewatEcourt?: unknown;
  verstekPutusan?: unknown;
  /** I14 18 Okt: jenis_perkara_id (bot); 342 pencegahan perkawinan memakai relaas Pemohon [JS] 11.1. */
  jenisPerkaraId?: unknown;
};

export type PeringatanCetak = {
  /** "status-putusan" | "pihak-tak-termuat" | "pihak-lain" */
  jenis: string;
  teks: string;
  /** true: dokumen tidak ikut "Pilih semua" - tetap dapat dicentang sendiri. */
  tahanPilihSemua: boolean;
};

export type NilaiCetak = {
  blangko: { berkas: string; label: string } | null;
  bisaDicetak: boolean;
  /** "" bila bisaDicetak. Selalu berisi bila tidak - tidak ada penolakan tanpa sebab. */
  sebabTidakBisa: string;
  /** Pihak yang BERLAKU sesudah pilihan juru sita (bila ada). */
  pihak: string;
  peringatan: PeringatanCetak[];
  /** bisaDicetak DAN tidak ada peringatan yang menahan. */
  ikutPilihSemua: boolean;
};

const PIHAK_DIKENAL = new Set<string>(["keduanya", "pertama", "kedua", "tidak-perlu", "tidak-diketahui"]);

/**
 * Rentang proses menu ABT tempat blangko relaas berada - abt_menu 900 "Blangko
 * Derry" (yang terbaca hak_akses_menu lebih dahulu) dan 981 "Relaas dan PBT"
 * sama-sama proses_id 80..220, diukur pada ABT setempat 25 September 2026.
 * Ini SETELAN ABT: bila pengguna mengubahnya di ABT, angka ini harus ikut.
 *
 * Sejak 26 September 2026 blangko IKRAR berada di menu 25 "Relaas Ikrar Talak"
 * (proses 290..600) - rentangnya dibaca dari menuAbt blangko itu sendiri di
 * pohon-blangko.ts, bukan dari konstanta ini.
 */
export const RENTANG_PROSES_MENU_RELAAS = { min: 80, max: 220 } as const;

/** Menu ABT yang menentukan dokumen ini: menurut folder blangko golongannya. */
function menuUntukGolongan(golongan: unknown, lewatEcourt = false): { nama: string; prosesMin: number; prosesMax: number } {
  const keadaan = keadaanUntukGolongan(golongan);
  // Q3 16 Okt: ikrar e-Court ([JS] 7) berada di folder Relaas (menu berentang lain dari ikrar biasa di _ikrar_talak).
  const b = keadaan
    ? BLANGKO_RELAAS.find((x) => x.keadaan === keadaan && Boolean(x.ecourt) === (lewatEcourt && keadaan === "ikrar-talak")) ??
      BLANGKO_RELAAS.find((x) => x.keadaan === keadaan)
    : null;
  return b
    ? b.menuAbt
    : { nama: "Relaas dan PBT", prosesMin: RENTANG_PROSES_MENU_RELAAS.min, prosesMax: RENTANG_PROSES_MENU_RELAAS.max };
}

/** Status putusan yang pemberitahuannya perlu dikonfirmasi dulu - dicabut atau gugur. */
const POLA_STATUS_KONFIRMASI = /^\s*(dicabut|(dinyatakan\s+)?gugur|digugurkan)\s*$/i;

/** Sebab "tidak dapat dicetak" bila proses perkara di luar rentang menu ABT; "" bila di dalamnya/tak diketahui. */
export function sebabProsesDiLuarMenu(
  dokumen: Pick<DokumenDinilai, "prosesTerakhirId" | "prosesTerakhirNama" | "lewatEcourt"> & { golongan?: unknown }
): string {
  const proses = angkaAtauNull(dokumen.prosesTerakhirId);
  if (proses === null) return "";
  const menu = menuUntukGolongan(dokumen.golongan, dokumen.lewatEcourt === true);
  if (proses >= menu.prosesMin && proses <= menu.prosesMax) return "";
  const nama = String(dokumen.prosesTerakhirNama ?? "").trim();
  return (
    `ABT akan menolaknya: proses perkara saat ini ${proses}${nama ? ` (${nama})` : ""} di luar rentang ` +
    `proses menu ABT "${menu.nama}" (${menu.prosesMin}-${menu.prosesMax}), dan ` +
    `ABT hanya mengecualikan akun administrator (grup 1). Rentang itu setelan menu ABT (proses_id_min/max), ` +
    `bukan ALETA - ubah di ABT, atau cetak manual dari ABT dengan akun yang berhak.`
  );
}

/** perkara_id yang sah: bilangan bulat positif, sebagai angka atau teks angka. */
export function perkaraIdSah(nilai: unknown): boolean {
  const teks = typeof nilai === "number" ? String(nilai) : typeof nilai === "string" ? nilai.trim() : "";
  return /^\d+$/.test(teks) && !/^0+$/.test(teks);
}

function angkaAtauNull(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || String(nilai).trim() === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pihak per sisi yang identitasnya DIMUAT blangko relaas ABT. Dibaca dari
 * abt_variabel ABT setempat (25 September 2026): #7108# = Penggugat (alur 15)
 * atau Pemohon I (alur 16), #7109# = Tergugat pertama (alur 15) atau Pemohon
 * II (alur 16). Blangko dua pihak (3.b, 4, pemberitahuan) memuat keduanya;
 * blangko "T saja" (sidang lanjutan) hanya #7109#. Alur lain: kedua variabel
 * kosong - null.
 */
function cakupanBlangko(alur: number | null, hanyaT: boolean): { pertama: number; kedua: number } | null {
  if (alur === 15) return hanyaT ? { pertama: 0, kedua: 1 } : { pertama: 1, kedua: 1 };
  if (alur === 16) return hanyaT ? { pertama: 0, kedua: 0 } : { pertama: 2, kedua: 0 };
  return null;
}

function sisiUntuk(pihak: string): Array<"pertama" | "kedua"> {
  if (pihak === "keduanya") return ["pertama", "kedua"];
  if (pihak === "pertama") return ["pertama"];
  if (pihak === "kedua") return ["kedua"];
  return [];
}

/** Peringatan satu dokumen yang blangko dan pihaknya sudah diketahui. */
function peringatanUntuk(
  dokumen: DokumenDinilai,
  pihak: string,
  blangko: { berkas: string } | null
): PeringatanCetak[] {
  const hasil: PeringatanCetak[] = [];

  const status = String(dokumen.statusPutusanNama ?? "").trim();
  if (String(dokumen.golongan ?? "") === "pemberitahuan-putusan" && POLA_STATUS_KONFIRMASI.test(status)) {
    hasil.push({
      jenis: "status-putusan",
      teks:
        `Putusan berstatus "${status}" - pemberitahuan untuk perkara yang dicabut atau gugur jarang ` +
        `dikirim di satker ini. Pastikan memang diperlukan sebelum dicetak.`,
      tahanPilihSemua: true,
    });
  }

  const jumlah = dokumen.jumlahPihak;
  if (jumlah && blangko) {
    const alur = angkaAtauNull(dokumen.alurPerkaraId);
    // Blangko "T saja" = blangko berpihak kedua (0./1./2. ... T) - 6 Okt, butir 10.
    const tSaja = BLANGKO_RELAAS.some((x) => x.pihak === "kedua" && x.berkas === blangko.berkas);
    const cakupan = cakupanBlangko(alur, tSaja);
    const sebutan = {
      pertama: String(dokumen.sebutanPihak?.pertama ?? "").trim() || "Pihak Pertama",
      kedua: String(dokumen.sebutanPihak?.kedua ?? "").trim() || "Pihak Kedua",
    };
    for (const sisi of sisiUntuk(pihak)) {
      const n = Math.max(0, Math.floor(Number(jumlah[sisi]) || 0));
      if (n === 0) continue;
      if (!cakupan) {
        hasil.push({
          jenis: "pihak-tak-termuat",
          teks:
            `Blangko relaas ABT tidak memuat identitas ${sebutan[sisi]} untuk alur perkara ` +
            `${alur ?? "(tidak tercatat)"} - variabelnya hanya terisi untuk alur 15 dan 16.`,
          tahanPilihSemua: false,
        });
        continue;
      }
      const c = cakupan[sisi];
      if (n <= c) continue;
      hasil.push({
        jenis: "pihak-tak-termuat",
        teks:
          c === 0
            ? `${sebutan[sisi]} (${n} orang) tidak dimuat blangko ini sama sekali - buat relaasnya sendiri.`
            : `${sebutan[sisi]} ada ${n} orang; blangko ABT hanya memuat ` +
              `${c === 1 ? `yang pertama` : `${sebutan[sisi]} I dan II`} - ${n - c} lainnya harus dibuatkan ` +
              `relaas sendiri.`,
        tahanPilihSemua: false,
      });
    }
    const lain = Math.max(0, Math.floor(Number(jumlah.lain) || 0));
    if (lain > 0 && sisiUntuk(pihak).length > 0) {
      hasil.push({
        jenis: "pihak-lain",
        teks:
          `Perkara ini punya ${lain} pihak lain (intervensi/turut tergugat) yang tidak dimuat blangko ` +
          `relaas mana pun - periksa apakah mereka juga harus dipanggil atau diberi tahu.`,
        tahanPilihSemua: false,
      });
    }
  }
  return hasil;
}

/**
 * Menilai satu dokumen.
 *
 * @param pihakPilihan pihak yang dipilihkan juru sita untuk dokumen yang
 *   pihakDipanggil-nya "tidak-diketahui". Pilihan itu DIABAIKAN untuk dokumen
 *   yang pihaknya sudah dijawab SIPP - pilihan hanya mengisi yang kosong, tidak
 *   menimpa yang tercatat.
 *
 * Urutan pemeriksaannya urutan kerusakan yang paling mendasar lebih dahulu,
 * supaya sebab yang tampil adalah sebab yang harus dibereskan pertama.
 */
export function nilaiCetakDokumen(
  dokumen: DokumenDinilai,
  pihakPilihan?: PihakPilihan | null,
  peta?: PetaBlangkoCetak | null
): NilaiCetak {
  const pihakSipp = String(dokumen.pihakDipanggil ?? "").trim();
  const pihak =
    pihakSipp === "tidak-diketahui" && pihakPilihan && PIHAK_PILIHAN.includes(pihakPilihan)
      ? pihakPilihan
      : pihakSipp || "tidak-diketahui";

  const keadaan = keadaanUntukGolongan(dokumen.golongan);
  const pihakSah = (PIHAK_DIKENAL.has(pihak) ? pihak : "tidak-diketahui") as PihakDipanggil;
  // Q3 16 Okt: perkara e-Court / putusan verstek memilih set e-Court ([JS] 5.1, 5.2, 6.2, 7) bila bot mengirim penandanya.
  const pilih = keadaan ? blangkoRelaas(keadaan, pihakSah, opsiEcourtDokumen(dokumen)) : null;
  // Pemetaan admin menang atas bawaan (kunci paling khusus - per pihak).
  let dariPeta =
    pilih && peta ? blangkoMenurutPemetaan({ ...dokumen, pihakDipanggil: pihakSah }, peta.relaas, peta.pbt) : null;
  // Bawaan e-Court menang atas kunci admin yang bukan kunci e-Court (tidak membedakan e-Court); admin menimpanya dengan kunci berkata "ecourt".
  if (dariPeta && pilih?.ecourt && !uraiKunciRelaas(dariPeta.kunci).ecourt) dariPeta = null;
  const blangko = pilih ? { berkas: dariPeta ? dariPeta.berkas : pilih.berkas, label: pilih.label } : null;
  const peringatan = peringatanUntuk(dokumen, pihak, blangko);

  const tolak = (sebab: string): NilaiCetak => ({
    blangko,
    bisaDicetak: false,
    sebabTidakBisa: sebab,
    pihak,
    peringatan,
    ikutPilihSemua: false,
  });

  if (!perkaraIdSah(dokumen.perkaraId)) {
    return tolak(`perkara_id "${String(dokumen.perkaraId ?? "")}" tidak sah - pratinjau ABT menuntut angka perkara.`);
  }
  // Didahulukan dari pihak: memilih pihak untuk dokumen yang pasti ditolak ABT sia-sia.
  const diLuarMenu = sebabProsesDiLuarMenu(dokumen);
  if (diLuarMenu) return tolak(diLuarMenu);
  if (!keadaan) {
    return tolak(`Golongan "${String(dokumen.golongan ?? "")}" tidak dikenal pohon-blangko.ts - blangkonya tidak ditebak.`);
  }
  if (pihak === "tidak-perlu") {
    return tolak("Semua pihak hadir - diperintahkan hadir di muka sidang, tidak dipanggil dengan relaas.");
  }
  if (!PIHAK_DIKENAL.has(pihak)) {
    return tolak(`Pihak "${pihak}" tidak dikenal - pilih pihaknya dulu.`);
  }
  // 20 Okt: permohonan tanpa Termohon dan hanya satu Pemohon tidak punya pihak kedua - tidak dicetak dengan blangko T.
  if ((pihak === "kedua" || pihak === "keduanya") && !strukturPihakRelaas(dokumen).adaPihakKedua) {
    return tolak("Perkara permohonan ini tidak punya Termohon maupun Pemohon II - tidak ada pihak kedua yang dipanggil.");
  }
  if (!blangko) {
    return tolak(`Tidak ada blangko terdaftar untuk keadaan "${keadaan}" dengan pihak "${pihak}".`);
  }
  if (pihak === "tidak-diketahui") {
    return tolak("Pihak yang dipanggil belum diketahui dari SIPP - pilih pihaknya dulu.");
  }
  if (keadaan !== "pemberitahuan-putusan") {
    const d = Number(dokumen.d);
    if (dokumen.d === null || dokumen.d === undefined || !Number.isInteger(d) || d <= 0) {
      return tolak("Nomor sidang yang dipanggil (d) tidak terbaca - blangko panggilan akan bertanggal sidang kosong.");
    }
  }
  return {
    blangko,
    bisaDicetak: true,
    sebabTidakBisa: "",
    pihak,
    peringatan,
    ikutPilihSemua: !peringatan.some((p) => p.tahanPilihSemua),
  };
}
