/**
 * ============================================================================
 * KETEPATAN ISIAN - ATURAN MURNI (25 Okt 2026, rantai D butir D1 = U3 + U4)
 * ============================================================================
 *
 * Berkas ini hanya aturan: tanpa basis data dan tanpa jaringan. Penyimpanan dan
 * persetujuan ada di src/server/modules/aleta-ecourt/ketepatan-isian.ts.
 *
 * ============================================================================
 * APA YANG DIUKUR (U3)
 * ============================================================================
 *
 * Gerbang isian bot (aleta_bot/config/gerbang-isian.json) menentukan usulan
 * mana yang boleh TERISI SENDIRI dan mana yang hanya saran "ragu - periksa".
 * Berkas itu statis: diukur sekali atas perkara lama. Angka lapangan datang
 * dari jejak isian (C1, aleta_isian_jejak): tiap usulan ALETA yang ditulis
 * sendiri atau disarankan lalu DITERIMA atau DIUBAH petugas.
 *
 *   usulan    otomatis + saran diterima + saran disunting
 *   bertahan  usulan yang masih berlaku sampai akhir; usulan yang ALETA tulis
 *             sendiri lalu disunting petugas dikurangkan
 *   presisi   bertahan / usulan
 *
 * Satuan penilaian: SATU ISIAN (kode) x PENGISI (asal usulan) x JENIS PERKARA.
 * Pengisi yang sama bisa tepat untuk cerai gugat dan meleset untuk itsbat.
 *
 * ============================================================================
 * ATURAN KENAIKAN DAN PENURUNAN
 * ============================================================================
 *
 *   naik    presisi >= 0,95 dari paling sedikit 30 kejadian dalam jendela 6 bulan
 *           terakhir, dan isian itu BELUM boleh terisi sendiri
 *   turun   isian yang boleh terisi sendiri, presisinya < 0,90 dari paling
 *           sedikit 30 kejadian dalam jendela 6 bulan terakhir
 *
 * KENAIKAN TIDAK PERNAH OTOMATIS. Berkas ini hanya MENGUSULKAN; yang
 * memutuskan Super Admin (akun Derry termasuk) di layar Ketepatan isian.
 * Kenaikan yang disetujui paling jauh "cukup" (terisi sendiri, tetapi tetap
 * terlihat dapat dikoreksi); "pasti" hanya dari ukuran luring di gerbang JSON.
 * Berkas JSON tetap menjadi bawaan dan cadangan: keputusan yang dicabut
 * mengembalikan perilaku persis seperti sebelumnya.
 *
 * ============================================================================
 * KEBENARAN ISI SAKSI (U4)
 * ============================================================================
 *
 * Tingkat "terisi" tidak berarti benar. Butir saksi yang disimpan petugas
 * dibandingkan dengan usulan mesin: BENAR bila diterima apa adanya atau
 * disunting tetapi tetap mirip (kemiripan >= 0,9); selainnya meleset. Diukur
 * per jenis keterangan, per katalog, dan per bulan.
 */

/** Kode butir katalog Fitur Satker (src/lib/fitur-satker.ts). */
export const KODE_FITUR_KETEPATAN_ISIAN = "ketepatan-isian";

/** Kejadian minimal per isian dan jenis perkara sebelum usulan naik/turun dibuat. */
export const MIN_KEJADIAN = 30;
/** Presisi minimal untuk diusulkan naik. */
export const AMBANG_NAIK = 0.95;
/** Presisi di bawah ini pada isian yang boleh terisi sendiri diusulkan turun. */
export const AMBANG_TURUN = 0.9;
/** Jendela penilaian: bulan terakhir (termasuk bulan berjalan). */
export const JENDELA_BULAN = 6;
/** Butir saksi dengan kemiripan sekian atau lebih dianggap tetap benar walau disunting. */
export const KEMIRIPAN_BENAR = 0.9;

const teks = (x: unknown): string => String(x ?? "").trim();

// ─── Jenis perkara ──────────────────────────────────────────────────────────

/**
 * Nama jenis perkara SIPP -> id. Sama dengan ID_JENIS_PERKARA_SIPP di ekstensi (abt.js); id dipakai
 * bot (yang menerima id dari ekstensi), sehingga kunci jenis di portal dan bot sama.
 */
const ID_JENIS: Readonly<Record<string, string>> = Object.freeze({
  "cerai talak": "346",
  "cerai gugat": "347",
  "harta bersama": "348",
  "penguasaan anak": "349",
  "pengesahan anak": "352",
  "kelalaian atas kewajiban suami / istri": "345",
  "hak - hak bekas istri/kewajiban bekas suami": "351",
  "perkawinan campuran": "359",
  "izin kawin": "361",
  perwalian: "354",
  "asal usul anak": "358",
  "istbat nikah": "360",
  "pengesahan perkawinan/istbat nikah": "360",
  "dispensasi kawin": "362",
  "wali adhol": "363",
  kewarisan: "364",
  wasiat: "365",
  hibah: "366",
  wakaf: "367",
  "nafkah anak oleh ibu karena ayah tidak mampu": "350",
  "pencabutan kekuasaan orang tua": "353",
  "pencabutan kekuasaan wali": "355",
  "penunjukan orang lain sebagai wali oleh pengadilan": "356",
  "ganti rugi terhadap wali": "357",
  "lain-lain": "369",
  "lain-lain *)": "369",
  "ekonomi syariah": "370",
  "p3hp/penetapan ahli waris": "371",
  "nafkah anak pasca perceraian": "743",
});

const NAMA_JENIS: Readonly<Record<string, string>> = Object.freeze({
  "346": "Cerai Talak",
  "347": "Cerai Gugat",
  "348": "Harta Bersama",
  "349": "Penguasaan Anak",
  "350": "Nafkah Anak oleh Ibu",
  "351": "Hak Bekas Istri/Kewajiban Bekas Suami",
  "352": "Pengesahan Anak",
  "353": "Pencabutan Kekuasaan Orang Tua",
  "354": "Perwalian",
  "355": "Pencabutan Kekuasaan Wali",
  "356": "Penunjukan Wali",
  "357": "Ganti Rugi terhadap Wali",
  "358": "Asal Usul Anak",
  "359": "Perkawinan Campuran",
  "360": "Itsbat Nikah",
  "361": "Izin Kawin",
  "362": "Dispensasi Kawin",
  "363": "Wali Adhal",
  "364": "Kewarisan",
  "365": "Wasiat",
  "366": "Hibah",
  "367": "Wakaf",
  "369": "Lain-lain",
  "370": "Ekonomi Syariah",
  "371": "Penetapan Ahli Waris",
  "743": "Nafkah Anak Pasca Perceraian",
});

/**
 * Kunci jenis perkara untuk pengelompokan: id SIPP bila namanya dikenal (atau sudah berupa id),
 * "alur:..." dibiarkan, selainnya nama yang dirapikan (huruf kecil, spasi tunggal). Kosong = "(tanpa)".
 */
export function jenisKunci(x: unknown): string {
  const bersih = teks(x).replace(/\s+/g, " ");
  if (!bersih) return "(tanpa)";
  if (/^\d{3}$/.test(bersih)) return bersih;
  if (/^alur:/i.test(bersih)) return bersih;
  const kecil = bersih.toLowerCase();
  return ID_JENIS[kecil] ?? kecil.slice(0, 120);
}

/** Label awam satu kunci jenis. */
export function labelJenis(kunci: string): string {
  if (NAMA_JENIS[kunci]) return NAMA_JENIS[kunci];
  if (kunci === "(tanpa)") return "Jenis tidak tercatat";
  return kunci.replace(/^alur:/i, "Alur ");
}

// ─── Pengisi ↔ gerbang ──────────────────────────────────────────────────────

/** Tingkat sumber yang dipakai gerbang bot (aleta_bot/services/gerbangIsian.js asalDari). */
export type AsalGerbang = "sipp" | "posita" | "berkas";

/**
 * Pengisi (penanda asal yang dicatat ekstensi, mis. "posita-gugatan") -> tingkat sumber gerbang bot. Salinan aturan
 * faktaPerkara.prioUsulan atas label yang dibuat ekstensi (isi-sipp-bersama.js asalUsulan). null = pengisi ini
 * tidak melewati gerbang bot (mis. "bawaan-abt", isian ketikan petugas): usulan naik/turun tetap dihitung dan
 * ditampilkan, tetapi tidak dapat diterapkan di bot.
 */
export function asalGerbangDariPengisi(pengisi: string): AsalGerbang | null {
  const p = teks(pengisi).toLowerCase();
  if (!p) return null;
  if (p === "berkas-ktp-e-court" || p === "surat-gugatan-e-court") return "berkas";
  if (p === "posita" || p === "posita-gugatan" || p === "keterangan-saksi") return "posita";
  if (p === "sipp" || p === "data-pihak" || p === "data-pernikahan-di-sipp" || p === "bukti-akta-nikah") return "sipp";
  return null;
}

// ─── Angka bulanan ──────────────────────────────────────────────────────────

/** Satu baris hasil pengelompokan jejak: berapa kali (n) kombinasi ini terjadi. */
export type KejadianIsian = {
  kode: string;
  pengisi: string;
  /** Nama atau kunci jenis perkara mentah; dirapikan jenisKunci. */
  jenis: string;
  /** Waktu ISO (hanya 7 huruf awal "YYYY-MM" dipakai). */
  pada: string;
  hasil: string;
  cara: string;
  n: number;
};

export type BarisKetepatan = {
  kode: string;
  pengisi: string;
  jenis: string;
  bulan: string;
  usulan: number;
  diterima: number;
  diubah: number;
  diubahOtomatis: number;
  diketik: number;
  /** Boleh negatif pada satu bulan (usulan otomatis bulan lalu disunting bulan ini); presisi jendela menjumlahkannya. */
  bertahan: number;
  presisi: number | null;
};

export function bulanDari(pada: unknown): string {
  const t = teks(pada);
  return /^\d{4}-\d{2}/.test(t) ? t.slice(0, 7) : "";
}

export function kunciKetepatan(kode: string, pengisi: string, jenis: string): string {
  return `${kode}|${pengisi}|${jenis}`;
}

export function uraiKunci(kunci: string): { kode: string; pengisi: string; jenis: string } {
  const [kode = "", pengisi = "", ...sisa] = kunci.split("|");
  return { kode, pengisi, jenis: sisa.join("|") };
}

const bulatTiga = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Melipat kejadian jejak menjadi baris bulanan per isian x pengisi x jenis perkara. `usulan` mengikuti
 * kelompokkanIsian (jejak-isian.ts): otomatis + saran diterima + saran disunting; suntingan atas yang
 * ALETA tulis sendiri (cara "diubah-otomatis") tidak menambah usulan melainkan mengurangi `bertahan`.
 */
export function lipatKetepatanBulanan(kejadian: KejadianIsian[]): BarisKetepatan[] {
  const peta = new Map<string, BarisKetepatan>();
  for (const k of kejadian) {
    const bulan = bulanDari(k.pada);
    const kode = teks(k.kode);
    if (!bulan || !kode) continue;
    const pengisi = teks(k.pengisi);
    const jenis = jenisKunci(k.jenis);
    const id = `${kunciKetepatan(kode, pengisi, jenis)}|${bulan}`;
    const w =
      peta.get(id) ?? { kode, pengisi, jenis, bulan, usulan: 0, diterima: 0, diubah: 0, diubahOtomatis: 0, diketik: 0, bertahan: 0, presisi: null };
    const n = Math.max(0, Math.round(Number(k.n) || 0));
    if (k.hasil === "otomatis" || k.hasil === "diterima") {
      w.usulan += n;
      w.diterima += n;
      w.bertahan += n;
    } else if (k.hasil === "disunting") {
      w.diubah += n;
      if (k.cara === "diubah-otomatis") {
        w.diubahOtomatis += n;
        w.bertahan -= n;
      } else {
        w.usulan += n;
      }
    } else if (k.hasil === "diketik") {
      w.diketik += n;
    }
    peta.set(id, w);
  }
  for (const w of peta.values()) w.presisi = w.usulan ? bulatTiga(Math.max(0, Math.min(1, w.bertahan / w.usulan))) : null;
  return Array.from(peta.values()).sort((a, b) => a.bulan.localeCompare(b.bulan) || a.kode.localeCompare(b.kode) || a.pengisi.localeCompare(b.pengisi) || a.jenis.localeCompare(b.jenis));
}

/** Bulan "YYYY-MM" mundur `jumlah` bulan dari `bulan` (0 = bulan itu sendiri). */
export function bulanMundur(bulan: string, jumlah: number): string {
  const [t, b] = bulan.split("-").map((x) => Number(x));
  if (!t || !b) return bulan;
  const total = t * 12 + (b - 1) - jumlah;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export type NilaiJendela = {
  kunci: string;
  kode: string;
  pengisi: string;
  jenis: string;
  usulan: number;
  bertahan: number;
  diketik: number;
  presisi: number | null;
  bulanAwal: string;
  bulanAkhir: string;
};

/** Menjumlahkan baris bulanan dalam jendela [sampaiBulan - (jendela-1), sampaiBulan]. */
export function nilaiJendelaKetepatan(baris: BarisKetepatan[], sampaiBulan: string, jendela = JENDELA_BULAN): NilaiJendela[] {
  const awal = bulanMundur(sampaiBulan, jendela - 1);
  const peta = new Map<string, NilaiJendela>();
  for (const b of baris) {
    if (b.bulan < awal || b.bulan > sampaiBulan) continue;
    const kunci = kunciKetepatan(b.kode, b.pengisi, b.jenis);
    const w = peta.get(kunci) ?? { kunci, kode: b.kode, pengisi: b.pengisi, jenis: b.jenis, usulan: 0, bertahan: 0, diketik: 0, presisi: null, bulanAwal: b.bulan, bulanAkhir: b.bulan };
    w.usulan += b.usulan;
    w.bertahan += b.bertahan;
    w.diketik += b.diketik;
    if (b.bulan < w.bulanAwal) w.bulanAwal = b.bulan;
    if (b.bulan > w.bulanAkhir) w.bulanAkhir = b.bulan;
    peta.set(kunci, w);
  }
  for (const w of peta.values()) w.presisi = w.usulan ? bulatTiga(Math.max(0, Math.min(1, w.bertahan / w.usulan))) : null;
  return Array.from(peta.values()).sort((a, b) => b.usulan - a.usulan || a.kunci.localeCompare(b.kunci));
}

// ─── Usulan naik / turun ────────────────────────────────────────────────────

/** Status isian pada gerbang. "belum-diketahui" = bot tidak terjangkau saat layar dimuat. */
export type StatusGerbang = "otomatis" | "terstruktur" | "saran" | "tanpa-ukuran" | "belum-diketahui";

export const bolehTerisiSendiri = (s: StatusGerbang): boolean => s === "otomatis" || s === "terstruktur";

export type ArahUsulan = "naik" | "turun";

export type UsulanKetepatan = {
  kunci: string;
  kode: string;
  pengisi: string;
  jenis: string;
  arah: ArahUsulan;
  dariStatus: StatusGerbang;
  keStatus: "otomatis" | "saran";
  n: number;
  bertahan: number;
  presisi: number;
  bulanAwal: string;
  bulanAkhir: string;
  /** Pengisi ini melewati gerbang bot, jadi persetujuannya dapat diterapkan di sana (usulan hanya dibuat untuk pengisi demikian). */
  dapatDiterapkan: boolean;
};

export type MasukanTinjau = {
  baris: BarisKetepatan[];
  sampaiBulan: string;
  /** Status gerbang SEKARANG (berkas JSON + keputusan berlaku) untuk satu kunci; "belum-diketahui" bila tak terbaca. */
  statusSekarang: (kunci: string, nilai: { kode: string; pengisi: string; jenis: string }) => StatusGerbang;
  min?: number;
  naik?: number;
  turun?: number;
  jendela?: number;
};

/**
 * Menyusun usulan naik/turun dari angka lapangan. Murni: tidak menyimpan, tidak menyetujui. Pengisi tanpa nama
 * (isian ketikan petugas) atau yang tidak melewati gerbang bot tidak dinilai - tak ada yang dapat dinaikkan.
 */
export function tinjauKetepatan(m: MasukanTinjau): UsulanKetepatan[] {
  const min = m.min ?? MIN_KEJADIAN;
  const naik = m.naik ?? AMBANG_NAIK;
  const turun = m.turun ?? AMBANG_TURUN;
  const hasil: UsulanKetepatan[] = [];
  for (const w of nilaiJendelaKetepatan(m.baris, m.sampaiBulan, m.jendela)) {
    if (!w.pengisi || w.usulan < min || w.presisi === null) continue;
    const sekarang = m.statusSekarang(w.kunci, w);
    // Pengisi yang tidak melewati gerbang bot (mis. bawaan ABT) tidak punya apa yang dapat dinaikkan atau diturunkan.
    if (asalGerbangDariPengisi(w.pengisi) === null) continue;
    const dapat = true;
    const dasar = { kunci: w.kunci, kode: w.kode, pengisi: w.pengisi, jenis: w.jenis, n: w.usulan, bertahan: Math.max(0, w.bertahan), presisi: w.presisi, bulanAwal: w.bulanAwal, bulanAkhir: w.bulanAkhir, dapatDiterapkan: dapat, dariStatus: sekarang };
    if (!bolehTerisiSendiri(sekarang) && w.presisi >= naik) hasil.push({ ...dasar, arah: "naik", keStatus: "otomatis" });
    else if (bolehTerisiSendiri(sekarang) && w.presisi < turun) hasil.push({ ...dasar, arah: "turun", keStatus: "saran" });
  }
  return hasil.sort((a, b) => (a.arah === b.arah ? b.n - a.n : a.arah === "turun" ? -1 : 1));
}

/** Bagian status efektif dari keputusan yang berlaku (naik -> otomatis, turun -> saran). */
export function statusDariKeputusan(arah: string): "otomatis" | "saran" {
  return arah === "naik" ? "otomatis" : "saran";
}

// ─── Kebenaran isi saksi (U4) ───────────────────────────────────────────────

export type ButirSaksiUkur = {
  jenisKeterangan: string;
  katalog: string;
  pada: string;
  hasil: string;
  kemiripan: number;
};

export type KelompokKebenaran = {
  kunci: string;
  /** Semua butir. */
  jumlah: number;
  /** Butir yang ada usulan mesinnya (diterima + disunting + dibuang). */
  berusulan: number;
  diterima: number;
  disunting: number;
  dibuang: number;
  diketik: number;
  /** Diterima + disunting yang tetap mirip (>= KEMIRIPAN_BENAR). */
  benar: number;
  /** benar / berusulan, 0..100 (1 desimal); null bila tak ada butir berusulan. */
  persenBenar: number | null;
  /** Rata-rata kemiripan atas butir berusulan (diterima = 1, dibuang = 0). */
  rataKemiripan: number | null;
};

export function kelompokkanKebenaran(baris: ButirSaksiUkur[], kunciDari: (b: ButirSaksiUkur) => string, ambang = KEMIRIPAN_BENAR): KelompokKebenaran[] {
  const peta = new Map<string, KelompokKebenaran & { sum: number }>();
  for (const b of baris) {
    const kunci = kunciDari(b) || "(tanpa)";
    const w = peta.get(kunci) ?? { kunci, jumlah: 0, berusulan: 0, diterima: 0, disunting: 0, dibuang: 0, diketik: 0, benar: 0, persenBenar: null, rataKemiripan: null, sum: 0 };
    w.jumlah += 1;
    if (b.hasil === "diterima") {
      w.berusulan += 1;
      w.diterima += 1;
      w.benar += 1;
      w.sum += 1;
    } else if (b.hasil === "disunting") {
      w.berusulan += 1;
      w.disunting += 1;
      const k = Math.max(0, Math.min(1, Number(b.kemiripan) || 0));
      w.sum += k;
      if (k >= ambang) w.benar += 1;
    } else if (b.hasil === "dibuang") {
      w.berusulan += 1;
      w.dibuang += 1;
    } else if (b.hasil === "diketik") {
      w.diketik += 1;
    }
    peta.set(kunci, w);
  }
  return Array.from(peta.values())
    .map(({ sum, ...w }) => ({
      ...w,
      persenBenar: w.berusulan ? Math.round((w.benar / w.berusulan) * 1000) / 10 : null,
      rataKemiripan: w.berusulan ? bulatTiga(sum / w.berusulan) : null,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.kunci.localeCompare(b.kunci));
}

export type RingkasanBulananSaksi = KelompokKebenaran & { bulan: string };

/** Ringkasan per bulan (terbaru dahulu) - tampil di layar Ketepatan isian. */
export function ringkasBulananSaksi(baris: ButirSaksiUkur[], ambang = KEMIRIPAN_BENAR): RingkasanBulananSaksi[] {
  return kelompokkanKebenaran(baris, (b) => bulanDari(b.pada), ambang)
    .map((k) => ({ ...k, bulan: k.kunci }))
    .sort((a, b) => b.bulan.localeCompare(a.bulan));
}
