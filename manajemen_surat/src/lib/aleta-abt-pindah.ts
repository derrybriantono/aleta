import { SYARAT_CETAK, SYARAT_HARI_TANPA_MERAH, hasilBerlaku, type BarisBerdampingan } from "@/lib/aleta-abt-berdampingan";

/**
 * ============================================================================
 * PINDAH KE ALETA ABT PER JENIS PERKARA (5 Nov 2026, Tahap 8) - aturan murni, tanpa SQL, tanpa jaringan
 * ============================================================================
 *
 * Sampai Tahap 7 lulus, semua cetak blangko Derry tetap lewat ABT. Tahap 8 hanya MENYIAPKAN perpindahan: tiap jenis perkara
 * punya saklar sendiri (BAWAAN MATI), hanya Super Admin yang dapat mengubahnya, dan saklar menolak menyala selama syaratnya belum terpenuhi.
 *
 * "Jenis perkara" di sini adalah KELUARGA blangko: folder putusan dan berita acara sidang (BAS) yang dipakai satu jenis perkara.
 * Folder diambil dari pohon blangko Derry (107 folder; "terhapus" bukan blangko). Setiap folder RTF masuk TEPAT SATU keluarga.
 *
 * Syarat menyalakan satu keluarga (semuanya):
 *   1. pengukuran  - hasil membandingkan naskah ALETA ABT dengan ABT pada salinan uji ada, mencakup keluarga ini, dan tidak ada
 *                    beda yang belum dijelaskan sebabnya;
 *   2. berdampingan - sedikitnya SYARAT_CETAK cetak ABT yang dibandingkan di belakang untuk keluarga ini, tanpa beda merah yang belum
 *                    dijawab, dan sudah SYARAT_HARI_TANPA_MERAH hari penuh sejak beda merah terakhir (aturan yang sama dengan Tahap 7).
 * Keluarga tanpa perkara di salinan uji tidak punya pengukuran; ia "belum terukur" dan tidak dapat dinyalakan.
 */

export type Keluarga = {
  kunci: string;
  nama: string;
  /** Nama folder persis seperti di pohon blangko (putusan/penetapan dan BAS). */
  folder: readonly string[];
  /** Pola nama jenis perkara SIPP (LIKE; % = sembarang) untuk memilih perkara pengukur. Kosong = lintas jenis (memakai perkara cerai). */
  jenisSipp: readonly string[];
  /** Keluarga lintas jenis (relaas, PTSP, eksekusi, alur): diukur dengan perkara cerai dan perkara itsbat. */
  umum?: boolean;
};

const bas = (f: string) => `${f} - BAS`;
const pasang = (...f: string[]) => f.flatMap((x) => [x, bas(x)]);

export const KELUARGA_PINDAH: readonly Keluarga[] = [
  { kunci: "cerai-gugat", nama: "Cerai gugat", folder: [...pasang("1 Perceraian CG", "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak"), "BAS Kumulasi Cerai Gugat Verstek (Hak Asuh Anak)"], jenisSipp: ["Cerai Gugat"] },
  { kunci: "cerai-talak", nama: "Cerai talak", folder: pasang("1a Perceraian CT"), jenisSipp: ["Cerai Talak"] },
  { kunci: "cerai-kumulasi-itsbat", nama: "Cerai kumulasi itsbat nikah", folder: pasang("1c Perceraian Kumulasi Itsbat Nikah"), jenisSipp: ["Cerai Gugat"] },
  { kunci: "kelalaian-kewajiban", nama: "Kelalaian kewajiban suami istri", folder: pasang("1e Kelalaian Kewajiban Suami Istri"), jenisSipp: ["Kelalaian%"] },
  { kunci: "hak-bekas-istri", nama: "Hak bekas istri", folder: pasang("1f Hak Bekas Istri"), jenisSipp: ["Hak%Bekas%"] },
  { kunci: "itsbat-nikah", nama: "Itsbat nikah", folder: [...pasang("2 Itsbat Nikah", "2a Itsbat Nikah Kontensius"), "BAS Itsbat Nikah Gugur dan Cabut"], jenisSipp: ["Pengesahan Perkawinan/Istbat Nikah", "Istbat Nikah"] },
  { kunci: "dispensasi-kawin", nama: "Dispensasi kawin", folder: pasang("3 Dispensasi Kawin"), jenisSipp: ["Dispensasi Kawin"] },
  { kunci: "izin-kawin", nama: "Izin kawin", folder: pasang("3a Izin Kawin"), jenisSipp: ["Izin Kawin%"] },
  { kunci: "harta-bersama", nama: "Harta bersama", folder: pasang("4a Harta Bersama"), jenisSipp: ["Harta Bersama"] },
  { kunci: "kewarisan", nama: "Kewarisan", folder: pasang("4b Kewarisan"), jenisSipp: ["Kewarisan"] },
  { kunci: "wasiat", nama: "Wasiat", folder: pasang("4c Wasiat"), jenisSipp: ["Wasiat"] },
  { kunci: "hibah", nama: "Hibah", folder: pasang("4d Hibah"), jenisSipp: ["Hibah"] },
  { kunci: "wakaf", nama: "Wakaf", folder: pasang("4e Wakaf"), jenisSipp: ["Wakaf"] },
  { kunci: "izin-poligami", nama: "Izin poligami", folder: pasang("5 Izin Poligami"), jenisSipp: ["%Poligami%"] },
  { kunci: "pembatalan-perkawinan", nama: "Pembatalan perkawinan", folder: pasang("5a Pembatalan Perkawinan"), jenisSipp: ["Pembatalan Perkawinan"] },
  { kunci: "pencegahan-perkawinan", nama: "Pencegahan perkawinan", folder: pasang("5b Pencegahan Perkawinan"), jenisSipp: ["Pencegahan Perkawinan"] },
  { kunci: "penolakan-perkawinan", nama: "Penolakan perkawinan", folder: pasang("5c Penolakan Perkawinan"), jenisSipp: ["Penolakan Perkawinan"] },
  { kunci: "perkawinan-campuran", nama: "Perkawinan campuran", folder: pasang("5d Perkawinan Campuran"), jenisSipp: ["Perkawinan Campuran"] },
  { kunci: "perwalian", nama: "Perwalian", folder: pasang("6 Perwalian", "6f Penunjukan Wali oleh Pengadilan"), jenisSipp: ["Perwalian"] },
  { kunci: "hak-asuh-anak", nama: "Hak asuh anak", folder: pasang("6a Hak Asuh Anak (Hadhanah)"), jenisSipp: ["Lain-Lain"] },
  { kunci: "penguasaan-anak", nama: "Penguasaan anak", folder: pasang("6b Penguasaan Anak"), jenisSipp: ["Penguasaan Anak%"] },
  { kunci: "nafkah-anak", nama: "Nafkah anak", folder: pasang("6c Nafkah Anak", "6h Nafkah Anak oleh Ibu"), jenisSipp: ["Nafkah Anak%"] },
  { kunci: "pencabutan-kekuasaan", nama: "Pencabutan kekuasaan orang tua dan wali", folder: pasang("6d Pencabutan Kekuasaan Orang Tua", "6e Pencabutan Kekuasaan Wali"), jenisSipp: ["Pencabutan Kekuasaan%"] },
  { kunci: "ganti-rugi-wali", nama: "Ganti rugi terhadap wali", folder: pasang("6g Ganti Rugi terhadap Wali"), jenisSipp: ["Ganti Rugi%"] },
  { kunci: "wali-adhal", nama: "Wali adhal", folder: pasang("7 Wali Adhal"), jenisSipp: ["Wali Adh%"] },
  { kunci: "asal-usul-anak", nama: "Asal usul anak", folder: pasang("8 Asal Usul Anak"), jenisSipp: ["Asal Usul Anak"] },
  { kunci: "pengesahan-anak", nama: "Pengesahan anak", folder: pasang("8a Pengesahan Anak"), jenisSipp: ["Pengesahan Anak%"] },
  { kunci: "ahli-waris", nama: "Penetapan ahli waris", folder: pasang("9 Penetapan Ahli Waris"), jenisSipp: ["P3HP/Penetapan Ahli Waris"] },
  { kunci: "pengangkatan-anak", nama: "Pengangkatan anak (lain-lain)", folder: pasang("9a Lain-Lain (Pengangkatan Anak)"), jenisSipp: ["Lain-Lain"] },
  { kunci: "permohonan-umum", nama: "Permohonan umum (cabut, gugur, tidak dapat diterima)", folder: pasang("9b Permohonan Umum"), jenisSipp: ["Perwalian"] },
  { kunci: "mafqud", nama: "Penetapan mafqud", folder: pasang("9c Penetapan Mafqud"), jenisSipp: ["%Mafqud%"] },
  { kunci: "ekonomi-syariah", nama: "Ekonomi syariah", folder: pasang("10 Ekonomi Syariah", "10a Ekonomi Syariah Biasa"), jenisSipp: ["Ekonomi Syariah"] },
  {
    kunci: "dokumen-umum",
    nama: "Dokumen umum (relaas, PTSP, eksekusi, verzet, sita, putusan sela, alur)",
    folder: [
      ...pasang("96 Eksekusi", "96a Verzet", "97a Putusan Sela"),
      "97 Sita",
      "98 Relaas",
      bas("98b Berkas Perkara"),
      bas("98c Court Calendar"),
      "99 PTSP",
      "ALUR 01 Cerai Verstek 1 Sidang (Putus Sidang Pertama)",
      "ALUR 02 Cerai Verstek 2 Sidang",
      "ALUR 03 Cerai Verstek 3 Sidang atau Lebih",
      "ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)",
      "ALUR 05 Cerai Kontra Lisan (Mediasi s.d. Putusan)",
      "ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir",
      "ALUR 07 Cerai Gugur",
      "ALUR 08 Cerai Dicabut",
      "ALUR 09 Cerai Tidak Dapat Diterima (NO)",
      "ALUR 10 Cerai Talak Sidang Ikrar Talak",
      "ALUR 11 Itsbat Nikah 1 Sidang",
      "ALUR 12 Dispensasi Kawin",
      "ALUR 13 Asal Usul Anak",
    ],
    jenisSipp: [],
    umum: true,
  },
];

/** Folder yang bukan blangko dan tidak masuk keluarga mana pun (kosong atau berkas non-RTF). */
export const FOLDER_BUKAN_BLANGKO: readonly string[] = ["terhapus", "- BAS ASAL USUL ANAK -", "- BAS CONTRA PERCERAIAN -", "- BAS ITSTBAT NIKAH -", "- BAS VERSTEK PERCERAIAN -"];

const rapikan = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

const PETA_FOLDER = new Map<string, string>();
for (const k of KELUARGA_PINDAH) for (const f of k.folder) PETA_FOLDER.set(rapikan(f).toLowerCase(), k.kunci);

export const keluargaSah = (kunci: unknown): kunci is string => KELUARGA_PINDAH.some((k) => k.kunci === kunci);

/** Keluarga sebuah folder blangko; folder yang tidak dikenal = null (tidak pernah ditebak). */
export function keluargaDariFolder(folder: unknown): string | null {
  return PETA_FOLDER.get(rapikan(folder).toLowerCase()) ?? null;
}

export const namaKeluarga = (kunci: string) => KELUARGA_PINDAH.find((k) => k.kunci === kunci)?.nama ?? kunci;

// ---------------------------------------------------------------------------------------------------------------
// Saklar
// ---------------------------------------------------------------------------------------------------------------

export type SaklarKeluarga = { aktif: boolean; diubahOleh: string; diubahPada: string };
export type SetelanPindah = { keluarga: Record<string, SaklarKeluarga> };

/** Bawaan: SEMUA mati. Kunci yang tidak dikenal dibuang; nilai selain `true` persis dianggap mati. */
export function bersihkanSetelanPindah(mentah: unknown): SetelanPindah {
  const sumber = mentah && typeof mentah === "object" ? ((mentah as { keluarga?: unknown }).keluarga as Record<string, Partial<SaklarKeluarga>> | undefined) : undefined;
  const hasil: Record<string, SaklarKeluarga> = {};
  for (const k of KELUARGA_PINDAH) {
    const s = sumber && typeof sumber === "object" ? sumber[k.kunci] : undefined;
    hasil[k.kunci] = { aktif: s?.aktif === true, diubahOleh: String(s?.diubahOleh ?? ""), diubahPada: String(s?.diubahPada ?? "") };
  }
  return { keluarga: hasil };
}

// ---------------------------------------------------------------------------------------------------------------
// Hasil pengukuran pada salinan uji (angka saja; tanpa data pihak)
// ---------------------------------------------------------------------------------------------------------------

export type UkurKeluarga = {
  kunci: string;
  /** Perkara pengukur yang dipakai (jumlah, bukan nomor). 0 = belum terukur karena tidak ada perkara di salinan. */
  perkara: number;
  naskah: number;
  alinea: number;
  identik: number;
  dijelaskan: number;
  belumDijelaskan: number;
  /** Isian yang dibandingkan dan yang cocok (nilai tiap isian, bukan alinea). */
  isianNilai: number;
  isianCocok: number;
  /** Beda isian yang dijelaskan karena cacat ABT (tidak ditiru). */
  isianDijelaskan: number;
  sebabBelum: string;
};

export type LaporanUkur = { dibuat: string; keterangan: string; keluarga: UkurKeluarga[] };

const angka = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.trunc(Number(x)) : 0);

/** Menerima JSON hasil skrip pengukur (laporan-t8.json) dan menyaringnya menjadi angka baku. Keluarga tak dikenal dibuang. */
export function bersihkanLaporanUkur(mentah: unknown): LaporanUkur | null {
  if (!mentah || typeof mentah !== "object") return null;
  const m = mentah as { dibuat?: unknown; keterangan?: unknown; keluarga?: unknown };
  if (!Array.isArray(m.keluarga)) return null;
  const lihat = new Set<string>();
  const keluarga: UkurKeluarga[] = [];
  for (const x of m.keluarga as Array<Record<string, unknown>>) {
    const kunci = String(x?.kunci ?? "");
    if (!keluargaSah(kunci) || lihat.has(kunci)) continue;
    lihat.add(kunci);
    keluarga.push({
      kunci,
      perkara: angka(x.perkara),
      naskah: angka(x.naskah),
      alinea: angka(x.alinea),
      identik: angka(x.identik),
      dijelaskan: angka(x.dijelaskan),
      belumDijelaskan: angka(x.belumDijelaskan),
      isianNilai: angka(x.isianNilai),
      isianCocok: angka(x.isianCocok),
      isianDijelaskan: angka(x.isianDijelaskan),
      sebabBelum: rapikan(x.sebabBelum).slice(0, 160),
    });
  }
  if (!keluarga.length) return null;
  return { dibuat: rapikan(m.dibuat).slice(0, 40), keterangan: rapikan(m.keterangan).slice(0, 300), keluarga };
}

// ---------------------------------------------------------------------------------------------------------------
// Kesiapan
// ---------------------------------------------------------------------------------------------------------------

export type SyaratPindah = { kunci: "pengukuran" | "berdampingan"; judul: string; lulus: boolean; keterangan: string };

export type KesiapanKeluarga = {
  kunci: string;
  nama: string;
  folder: number;
  ukur: UkurKeluarga | null;
  /** Persen alinea yang cocok atau sudah dijelaskan; null bila belum terukur. */
  persenNaskah: number | null;
  persenIsian: number | null;
  cetak: number;
  hijau: number;
  kuning: number;
  merah: number;
  belumDiukur: number;
  hariTanpaMerah: number;
  syarat: SyaratPindah[];
  siap: boolean;
  aktif: boolean;
};

const HARI = 86_400_000;
const persen = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);

/** Ringkasan cetak berdampingan untuk SATU keluarga (aturan Tahap 7: 30 cetak, tanpa merah, 14 hari). Baris dikelompokkan lewat folder. */
export function hitungBerdampinganKeluarga(baris: readonly Pick<BarisBerdampingan, "waktu" | "hasil" | "jawaban">[], kini: Date) {
  let hijau = 0;
  let kuning = 0;
  let merah = 0;
  let belum = 0;
  let merahTerakhir = 0;
  let pertama = Infinity;
  for (const b of baris) {
    const h = hasilBerlaku(b);
    const t = Date.parse(b.waktu);
    if (h === "belum-diukur") {
      belum += 1;
      continue;
    }
    if (Number.isFinite(t) && t < pertama) pertama = t;
    if (h === "hijau") hijau += 1;
    else if (h === "kuning") kuning += 1;
    else {
      merah += 1;
      if (Number.isFinite(t) && t > merahTerakhir) merahTerakhir = t;
    }
  }
  const patokan = merahTerakhir || (Number.isFinite(pertama) ? pertama : 0);
  const hariTanpaMerah = patokan ? Math.max(0, Math.floor((kini.getTime() - patokan) / HARI)) : 0;
  return { cetak: hijau + kuning + merah, hijau, kuning, merah, belumDiukur: belum, hariTanpaMerah };
}

export type BarisBerdampinganFolder = Pick<BarisBerdampingan, "waktu" | "hasil" | "jawaban"> & { folder: string };

export function nilaiKesiapan(
  keluarga: Keluarga,
  masukan: { ukur: UkurKeluarga | null; berdampingan: readonly BarisBerdampinganFolder[]; aktif: boolean },
  kini: Date = new Date()
): KesiapanKeluarga {
  const milik = masukan.berdampingan.filter((b) => keluargaDariFolder(b.folder) === keluarga.kunci);
  const d = hitungBerdampinganKeluarga(milik, kini);
  const u = masukan.ukur;
  const terukur = Boolean(u && u.perkara > 0 && u.naskah > 0 && u.alinea > 0);
  const sukuBeda = terukur ? u!.belumDijelaskan : 0;
  // Pengukuran yang baru separuh jalan (sebabBelum terisi) atau yang masih menyisakan isian beda tanpa penjelasan tidak cukup untuk lulus.
  const lengkap = terukur && !u!.sebabBelum;
  const isianBeda = terukur ? Math.max(0, u!.isianNilai - u!.isianCocok - u!.isianDijelaskan) : 0;
  const syaratUkur: SyaratPindah = {
    kunci: "pengukuran",
    judul: "Naskah sama dengan ABT di salinan uji",
    lulus: lengkap && sukuBeda === 0 && isianBeda === 0,
    keterangan: !terukur
      ? u?.sebabBelum
        ? `Belum terukur: ${u.sebabBelum}`
        : "Belum terukur: belum ada hasil pengukuran untuk jenis ini."
      : !lengkap
        ? `Pengukuran belum lengkap: ${u!.sebabBelum}.`
        : sukuBeda > 0
          ? `${sukuBeda} paragraf naskah beda dan belum dijelaskan sebabnya.`
          : isianBeda > 0
            ? `${isianBeda} isian beda dan belum dijelaskan sebabnya.`
            : `${u!.naskah} naskah dari ${u!.perkara} perkara sama dengan ABT, atau bedanya sudah dijelaskan.`,
  };
  const kurang = Math.max(0, SYARAT_CETAK - d.cetak);
  const syaratDampingan: SyaratPindah = {
    kunci: "berdampingan",
    judul: `${SYARAT_CETAK} cetak berdampingan tanpa beda merah selama ${SYARAT_HARI_TANPA_MERAH} hari`,
    lulus: d.cetak >= SYARAT_CETAK && d.merah === 0 && d.hariTanpaMerah >= SYARAT_HARI_TANPA_MERAH,
    keterangan:
      d.cetak < SYARAT_CETAK
        ? `Baru ${d.cetak} cetak dibandingkan; kurang ${kurang}.`
        : d.merah > 0
          ? `${d.merah} cetak masih beda merah dan belum dijawab.`
          : d.hariTanpaMerah < SYARAT_HARI_TANPA_MERAH
            ? `Baru ${d.hariTanpaMerah} hari tanpa beda merah; perlu ${SYARAT_HARI_TANPA_MERAH}.`
            : `${d.cetak} cetak dibandingkan, tidak ada beda merah selama ${d.hariTanpaMerah} hari.`,
  };
  return {
    kunci: keluarga.kunci,
    nama: keluarga.nama,
    folder: keluarga.folder.length,
    ukur: u,
    persenNaskah: terukur ? persen(u!.identik + u!.dijelaskan, u!.alinea) : null,
    persenIsian: u && u.isianNilai > 0 ? persen(u.isianCocok + u.isianDijelaskan, u.isianNilai) : null,
    ...d,
    syarat: [syaratUkur, syaratDampingan],
    siap: syaratUkur.lulus && syaratDampingan.lulus,
    aktif: masukan.aktif,
  };
}

/** Pesan penolakan menyalakan saklar: menyebut syarat yang belum terpenuhi dengan bahasa sehari-hari. */
export function pesanSyaratBelum(k: Pick<KesiapanKeluarga, "nama" | "syarat">): string {
  const belum = k.syarat.filter((s) => !s.lulus);
  return `Saklar ${k.nama} belum dapat dinyalakan. ${belum.map((s) => `${s.judul}: ${s.keterangan}`).join(" ")}`.trim();
}

/**
 * Keputusan membuka ALETA ABT dari panel Blangko ABT by Derry Briantono untuk satu folder blangko. Selama saklar keluarganya mati
 * (dan bawaannya mati), jawabannya SELALU "tidak": panel tetap memakai ABT. Folder yang tidak dikenal juga "tidak".
 */
export function bukaAletaAbtUntukFolder(setelan: SetelanPindah, folder: unknown, env: Record<string, string | undefined> = process.env): boolean {
  if (env.ALETA_ABT_PINDAH === "0") return false;
  const k = keluargaDariFolder(folder);
  return Boolean(k && setelan.keluarga[k]?.aktif === true);
}
