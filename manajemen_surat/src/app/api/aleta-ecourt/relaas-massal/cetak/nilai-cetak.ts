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
  blangkoRelaas,
  keadaanUntukGolongan,
  type PihakDipanggil,
} from "@/lib/pohon-blangko";

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
 */
export const RENTANG_PROSES_MENU_RELAAS = { min: 80, max: 220 } as const;

/** Status putusan yang pemberitahuannya perlu dikonfirmasi dulu - dicabut atau gugur. */
const POLA_STATUS_KONFIRMASI = /^\s*(dicabut|(dinyatakan\s+)?gugur|digugurkan)\s*$/i;

/** Sebab "tidak dapat dicetak" bila proses perkara di luar rentang menu ABT; "" bila di dalamnya/tak diketahui. */
export function sebabProsesDiLuarMenu(dokumen: Pick<DokumenDinilai, "prosesTerakhirId" | "prosesTerakhirNama">): string {
  const proses = angkaAtauNull(dokumen.prosesTerakhirId);
  if (proses === null) return "";
  if (proses >= RENTANG_PROSES_MENU_RELAAS.min && proses <= RENTANG_PROSES_MENU_RELAAS.max) return "";
  const nama = String(dokumen.prosesTerakhirNama ?? "").trim();
  return (
    `ABT akan menolaknya: proses perkara saat ini ${proses}${nama ? ` (${nama})` : ""} di luar rentang ` +
    `proses menu ABT "Relaas dan PBT" (${RENTANG_PROSES_MENU_RELAAS.min}-${RENTANG_PROSES_MENU_RELAAS.max}), dan ` +
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
    const tSaja = blangko.berkas === blangkoRelaas("sidang-ditunda", "kedua")?.berkas;
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
export function nilaiCetakDokumen(dokumen: DokumenDinilai, pihakPilihan?: PihakPilihan | null): NilaiCetak {
  const pihakSipp = String(dokumen.pihakDipanggil ?? "").trim();
  const pihak =
    pihakSipp === "tidak-diketahui" && pihakPilihan && PIHAK_PILIHAN.includes(pihakPilihan)
      ? pihakPilihan
      : pihakSipp || "tidak-diketahui";

  const keadaan = keadaanUntukGolongan(dokumen.golongan);
  const pihakSah = (PIHAK_DIKENAL.has(pihak) ? pihak : "tidak-diketahui") as PihakDipanggil;
  const pilih = keadaan ? blangkoRelaas(keadaan, pihakSah) : null;
  const blangko = pilih ? { berkas: pilih.berkas, label: pilih.label } : null;
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
