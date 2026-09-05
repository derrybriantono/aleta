/**
 * PAGU BIAYA AI (K1) DAN PEMILIHAN MODEL MENURUT PEKERJAAN (K3).
 *
 * ============================================================================
 * PAGU HABIS TIDAK BOLEH MENGHENTIKAN PENGADILAN
 * ============================================================================
 *
 * Inilah pertanyaan yang menentukan apakah pagu ini boleh ada. Bila pada
 * tanggal 20 pagunya habis dan seluruh alat berhenti, yang terjadi bukan
 * penghematan melainkan sidang yang tertunda - dan pada bulan berikutnya
 * pagunya akan dinaikkan sampai tidak pernah habis, yang sama saja dengan
 * tidak ada pagu.
 *
 * Yang benar: pagu habis mengembalikan ALETA ke keadaan PUSTAKA SAJA. Draf
 * tetap dirakit, pemeriksaan tetap berjalan, jejak tetap tercatat - hanya
 * penyusunan alinea baru yang berhenti. Itu dapat ditanggung justru karena
 * I5 membuat pustaka lebih dulu sejak awal; tanpa arsitektur itu, pagu ini
 * hanya akan menjadi tombol yang tidak berani ditekan siapa pun.
 *
 * ============================================================================
 * PERINGATAN DI 70 PERSEN, BUKAN SETELAH HABIS
 * ============================================================================
 *
 * Peringatan yang datang saat pagu habis tidak dapat ditindaklanjuti - yang
 * membacanya sudah tidak punya pilihan. Di 70 persen masih ada waktu
 * memutuskan: menaikkan pagu, mematikan sebagian modul, atau membiarkan
 * sisanya habis dengan sadar.
 *
 * ============================================================================
 * MODEL KUAT HANYA UNTUK PEKERJAAN YANG MENUNTUTNYA
 * ============================================================================
 *
 * Menyusun alinea pertimbangan baru menuntut penalaran; menarik tanggal dari
 * naskah tidak. Memakai model termahal untuk keduanya menghabiskan pagu pada
 * pekerjaan yang model murah kerjakan sama baiknya - dan menghabiskannya
 * lebih cepat daripada yang diduga siapa pun, karena penarikan fakta berjalan
 * jauh lebih sering daripada penyusunan.
 */

export type Pekerjaan =
  /** Menarik fakta dari naskah tak berpola (I1). */
  | "tarikFakta"
  /** Menjawab pertanyaan percakapan (I3). */
  | "percakapan"
  /** Menyusun alinea pertimbangan baru (I2). */
  | "susunPertimbangan";

export type TingkatModel = "hemat" | "kuat";

/**
 * Pekerjaan mana menuntut model kuat.
 *
 * Sengaja hanya satu. Tiap tambahan di sini menggandakan biaya pekerjaan yang
 * bersangkutan, dan penambahannya harus dapat dijawab dengan "mengapa model
 * murah tidak cukup" - bukan dengan "supaya hasilnya lebih baik", sebab
 * jawaban itu selalu tersedia untuk pekerjaan apa pun.
 */
const MENUNTUT_KUAT = new Set<Pekerjaan>(["susunPertimbangan"]);

export function tingkatUntuk(pekerjaan: Pekerjaan): TingkatModel {
  return MENUNTUT_KUAT.has(pekerjaan) ? "kuat" : "hemat";
}

export type Pemakaian = {
  /** Rupiah yang sudah terpakai bulan berjalan. */
  terpakai: number;
  /** Pagu bulan berjalan dalam rupiah. */
  pagu: number;
};

export type TingkatPagu = "aman" | "peringatan" | "habis";

export type KeadaanPagu = {
  tingkat: TingkatPagu;
  terpakai: number;
  pagu: number;
  sisa: number;
  /** 0..100, dibulatkan. */
  persen: number;
  /** Pekerjaan yang masih boleh memanggil model. */
  bolehKuat: boolean;
  bolehHemat: boolean;
  pesan: string;
};

/** Ambang peringatan. Di bawahnya tidak ada pesan apa pun. */
export const AMBANG_PERINGATAN = 0.7;

/**
 * Ambang penghentian model kuat, sebelum pagu benar-benar habis.
 *
 * Model kuat berhenti lebih dulu supaya sisa pagu cukup untuk pekerjaan
 * murah yang berjalan sepanjang hari. Menghentikan keduanya bersamaan berarti
 * penarikan fakta - yang biayanya kecil - ikut mati karena satu penyusunan
 * pertimbangan menghabiskan sisanya.
 */
export const AMBANG_HENTI_KUAT = 0.9;

function rupiah(nilai: number): string {
  return `Rp ${Math.round(Number(nilai) || 0).toLocaleString("id-ID")}`;
}

/**
 * Menghitung keadaan pagu.
 *
 * Pagu nol atau negatif berarti BELUM DISETEL, bukan pagu habis. Membacanya
 * sebagai habis akan mematikan seluruh lapisan AI pada pemasangan baru, dan
 * yang memasangnya akan mengira ada kerusakan.
 */
export function hitungPagu(pemakaian: Pemakaian): KeadaanPagu {
  const pagu = Number(pemakaian.pagu) || 0;
  const terpakai = Math.max(0, Number(pemakaian.terpakai) || 0);

  if (pagu <= 0) {
    return {
      tingkat: "aman",
      terpakai,
      pagu: 0,
      sisa: 0,
      persen: 0,
      bolehKuat: true,
      bolehHemat: true,
      pesan: "Pagu AI belum disetel, sehingga pemakaian tidak dibatasi.",
    };
  }

  const bagian = terpakai / pagu;
  const persen = Math.round(bagian * 100);
  const sisa = Math.max(0, pagu - terpakai);

  if (bagian >= 1) {
    return {
      tingkat: "habis",
      terpakai,
      pagu,
      sisa: 0,
      persen,
      bolehKuat: false,
      bolehHemat: false,
      pesan:
        `Pagu AI bulan ini habis (${rupiah(terpakai)} dari ${rupiah(pagu)}). ` +
        "ALETA kembali ke keadaan pustaka saja: draf tetap dirakit dan pemeriksaan tetap berjalan, " +
        "hanya penyusunan alinea baru yang berhenti.",
    };
  }

  if (bagian >= AMBANG_HENTI_KUAT) {
    return {
      tingkat: "peringatan",
      terpakai,
      pagu,
      sisa,
      persen,
      bolehKuat: false,
      bolehHemat: true,
      pesan:
        `Pagu AI terpakai ${persen} persen (${rupiah(terpakai)} dari ${rupiah(pagu)}). ` +
        `Penyusunan pertimbangan baru dihentikan lebih dulu supaya sisa ${rupiah(sisa)} cukup ` +
        "untuk penarikan fakta dan percakapan sampai akhir bulan.",
    };
  }

  if (bagian >= AMBANG_PERINGATAN) {
    return {
      tingkat: "peringatan",
      terpakai,
      pagu,
      sisa,
      persen,
      bolehKuat: true,
      bolehHemat: true,
      pesan:
        `Pagu AI terpakai ${persen} persen (${rupiah(terpakai)} dari ${rupiah(pagu)}). ` +
        `Sisa ${rupiah(sisa)}. Masih ada waktu memutuskan sebelum habis.`,
    };
  }

  return {
    tingkat: "aman",
    terpakai,
    pagu,
    sisa,
    persen,
    bolehKuat: true,
    bolehHemat: true,
    pesan: "",
  };
}

/**
 * Apakah satu pekerjaan boleh memanggil model.
 *
 * Jawabannya menyertakan sebab supaya layar dapat menyebutkannya. "AI tidak
 * tersedia" tanpa keterangan akan dibaca sebagai kerusakan, dan yang
 * membacanya akan menelepon pranata komputer untuk memperbaiki pagu yang
 * memang sengaja habis.
 */
export function bolehPanggil(
  pekerjaan: Pekerjaan,
  keadaan: KeadaanPagu
): { boleh: boolean; tingkat: TingkatModel; sebab: string } {
  const tingkat = tingkatUntuk(pekerjaan);
  if (tingkat === "kuat" && !keadaan.bolehKuat) {
    return { boleh: false, tingkat, sebab: keadaan.pesan };
  }
  if (tingkat === "hemat" && !keadaan.bolehHemat) {
    return { boleh: false, tingkat, sebab: keadaan.pesan };
  }
  return { boleh: true, tingkat, sebab: "" };
}

/**
 * Biaya satu panggilan, dari jumlah token dan tarif per juta token.
 *
 * Tarif diberikan pemanggil, tidak ditanam di sini: tarif penyedia berubah,
 * dan tarif yang tertanam di kode akan tetap dipakai berbulan-bulan sesudah
 * berubah - menghasilkan laporan biaya yang rapi dan salah.
 */
export function hitungBiaya(masukan: {
  tokenMasuk: number;
  tokenKeluar: number;
  tarifMasukPerJuta: number;
  tarifKeluarPerJuta: number;
}): number {
  const masuk = Math.max(0, Number(masukan.tokenMasuk) || 0);
  const keluar = Math.max(0, Number(masukan.tokenKeluar) || 0);
  const tarifMasuk = Math.max(0, Number(masukan.tarifMasukPerJuta) || 0);
  const tarifKeluar = Math.max(0, Number(masukan.tarifKeluarPerJuta) || 0);
  return (masuk / 1_000_000) * tarifMasuk + (keluar / 1_000_000) * tarifKeluar;
}
