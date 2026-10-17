/**
 * ============================================================================
 * PETA PENETAPAN - JENIS PENETAPAN -> BLANGKO ABT -> TEMPAT UNGGAH SIPP,
 * BESERTA PENGATURAN TANDA TANGAN DAN CAP (perbaikan 6 Okt 2026, butir 17-20)
 * ============================================================================
 *
 * Aturan murni (tanpa basis data) - dipakai modul penyimpanan
 * (src/server/modules/aleta-ecourt/peta-penetapan.ts), rute unggah edoc
 * penetapan, dan layar "Peta penetapan" di Integrasi e-Court.
 *
 * Satu butir per jenis penetapan:
 *
 *   namaBerkas     nama blangko ABT PERSIS seperti di halaman kelompok ABT
 *                  (".rtf" boleh ikut) - "@ 1 - PMH.rtf" di folder Derry.
 *   kelompok       nama kelompok/menu blangko ABT yang DIDAHULUKAN saat
 *                  ekstensi memanen token blangkonya ("Form Bantu PTSP").
 *                  Hanya urutan: kelompok lain tetap dibuka bila tidak ada.
 *   otomatisUnggah sesudah penetapan jenis ini TERTULIS lewat panel SIPP,
 *                  ekstensi mencetak blangkonya dari ABT dan mengunggahnya ke
 *                  SIPP. Mati = hanya lewat tombol, kering lebih dulu.
 *   pakaiTtd/pakaiCap, penandatangan, labelPenandatangan, ukuran & geser
 *                  -> diteruskan ke bot (aturBerlaku di penetapanEdocService).
 *
 * PPP dan PJS SENGAJA mati sebagai bawaan (blangkonya menyusul): menambahkan
 * keduanya cukup mengisi nama blangko dan menyalakannya di layar - tanpa kode.
 *
 * Tempat unggah di SIPP TIDAK dapat diubah: satu-satunya tempat yang dibaca
 * SIPP untuk dokumen penetapan adalah perkara_dokumen_penetapan dengan
 * jenis_dokumen_id 1-4 (ikon Cetak Dokumen tab Penetapan) - menulis ke tempat
 * lain berarti berkas yang tidak pernah terlihat petugas.
 */

export const JENIS_PETA_PENETAPAN = ["pmh", "phs", "ppp", "pjs"] as const;
export type JenisPetaPenetapan = (typeof JENIS_PETA_PENETAPAN)[number];

export const SEBUTAN_JENIS_PENETAPAN: Record<JenisPetaPenetapan, string> = {
  pmh: "Penetapan Majelis Hakim (PMH)",
  phs: "Penetapan Hari Sidang (PHS)",
  ppp: "Penunjukan Panitera Pengganti (PPP)",
  pjs: "Penunjukan Jurusita (PJS)",
};

export const PENANDATANGAN_PENETAPAN = [
  { kode: "ketua", sebutan: "Ketua / Wakil Ketua / Plh. Ketua" },
  { kode: "ketua_majelis", sebutan: "Ketua Majelis / Hakim tunggal" },
  { kode: "panitera", sebutan: "Panitera / Plh. Panitera" },
  { kode: "otomatis", sebutan: "Siapa pun yang tertulis di blok tanda tangan" },
] as const;
export type KodePenandatangan = (typeof PENANDATANGAN_PENETAPAN)[number]["kode"];

/** Tempat unggah di SIPP - tetap, dibaca dari baris SIPP sendiri (lihat dokumenPenetapanService). */
export const TEMPAT_UNGGAH_SIPP: Record<JenisPetaPenetapan, { tabel: string; jenisDokumenId: number; rujukan: string; berkas: string }> = {
  pmh: { tabel: "perkara_dokumen_penetapan", jenisDokumenId: 1, rujukan: "perkara_hakim_pn (urutan 1)", berkas: "resources/file/doc/YYYY/MM/<nomor>/<nomor>_Dokumen_PMH_<epoch>.pdf" },
  phs: { tabel: "perkara_dokumen_penetapan", jenisDokumenId: 4, rujukan: "perkara_penetapan_hari_sidang", berkas: "resources/file/doc/YYYY/MM/<nomor>/<nomor>_Dokumen_PHS_<epoch>.pdf" },
  ppp: { tabel: "perkara_dokumen_penetapan", jenisDokumenId: 2, rujukan: "perkara_panitera_pn", berkas: "resources/file/doc/YYYY/MM/<nomor>/<nomor>_Dokumen_PPP_<epoch>.pdf" },
  pjs: { tabel: "perkara_dokumen_penetapan", jenisDokumenId: 3, rujukan: "perkara_jurusita", berkas: "resources/file/doc/YYYY/MM/<nomor>/<nomor>_Dokumen_PJS_<epoch>.pdf" },
};

export type AturPenetapan = {
  aktif: boolean;
  namaBerkas: string;
  /**
   * I9 17 Okt: blangko cadangan bila `namaBerkas` tidak ada di ABT satker (PPP/PJS: gabungan "@ 0 - PMH - PHS.rtf", bagian 2/3 dipotong bot lewat
   * cirinya). Turunan bawaan - tidak disimpan di baris admin dan tidak diubah layar.
   */
  namaBerkasCadangan?: string;
  kelompok: string;
  otomatisUnggah: boolean;
  pakaiTtd: boolean;
  pakaiCap: boolean;
  penandatangan: KodePenandatangan;
  labelPenandatangan: string;
  gantiGambarBawaan: boolean;
  tahanBilaTanpaTtd: boolean;
  /** Cap tertentu (aleta_ecourt_cap.id); kosong = cap aktif terbaru sesuai peruntukan. */
  capId: string;
  lebarTtdMm: number;
  tinggiTtdMaksMm: number;
  ttdGeserKananMm: number;
  ttdTurunMm: number;
  lebarCapMm: number;
  capGeserKiriMm: number;
  capGeserAtasMm: number;
};

/** Batas angka (mm) - sama dengan BATAS_ANGKA bot. */
export const BATAS_UKURAN_MM: Record<
  "lebarTtdMm" | "tinggiTtdMaksMm" | "ttdGeserKananMm" | "ttdTurunMm" | "lebarCapMm" | "capGeserKiriMm" | "capGeserAtasMm",
  { min: number; max: number; sebutan: string }
> = {
  lebarTtdMm: { min: 10, max: 90, sebutan: "Lebar tanda tangan (mm)" },
  tinggiTtdMaksMm: { min: 8, max: 60, sebutan: "Tinggi maksimum tanda tangan (mm)" },
  ttdGeserKananMm: { min: -60, max: 60, sebutan: "Tanda tangan geser ke kanan (mm)" },
  ttdTurunMm: { min: -30, max: 30, sebutan: "Tanda tangan turun mendekati nama (mm)" },
  lebarCapMm: { min: 10, max: 60, sebutan: "Lebar cap (mm)" },
  capGeserKiriMm: { min: -60, max: 60, sebutan: "Pusat cap di kiri pusat tanda tangan (mm)" },
  capGeserAtasMm: { min: -60, max: 60, sebutan: "Pusat cap di atas pusat tanda tangan (mm)" },
};
export type KunciUkuran = keyof typeof BATAS_UKURAN_MM;

const UKURAN_BAWAAN: Pick<AturPenetapan, KunciUkuran> = {
  lebarTtdMm: 40,
  tinggiTtdMaksMm: 22,
  ttdGeserKananMm: 0,
  ttdTurunMm: 2,
  lebarCapMm: 30,
  capGeserKiriMm: 16,
  capGeserAtasMm: 6,
};

/** Blangko gabungan PTSP di folder derry_briantono/99 PTSP (dulu "PTSP", paket abt-ganti-nama-relaas-ptsp): bagian 1 PMH, 2 PPP, 3 PJS, 4 PHS (cermin PETA_PTSP.berkasGabungan di bot). */
export const BERKAS_PTSP_GABUNGAN = "@ 0 - PMH - PHS.rtf";

/**
 * I9 17 Okt (paket abt-penetap-phs-sita-derry): PPP dan PJS punya berkas TUNGGAL sendiri (satu bagian; kotak "Ditandatangani secara elektronik oleh"
 * dengan nama dan jabatan sungguhan penetapnya - variabel 9531/9533 dst.); berkas gabungan "@ 0" tetap ada sebagai cadangan.
 */
export const BERKAS_PPP_TUNGGAL = "@ 0a - PPP.rtf";
export const BERKAS_PJS_TUNGGAL = "@ 0b - PJS.rtf";

/**
 * I9 17 Okt: PHS perkara bersita. Bawaan "@ 2 - PHS" memuat blok sita DITANGGUHKAN otomatis (#7061# -> #9534#, hanya bila petitum memohon sita);
 * varian pilihan tangan (jalur kabul/tolak langsung tanpa putusan sela): "@ 2a" sita dikabulkan, "@ 2b" sita ditolak.
 */
export const VARIAN_SITA_PHS = {
  dikabulkan: "@ 2a - PHS - Sita Dikabulkan.rtf",
  ditolak: "@ 2b - PHS - Sita Ditolak.rtf",
} as const;
export type PilihanSitaPhs = "" | keyof typeof VARIAN_SITA_PHS;

const UMUM: Omit<AturPenetapan, "aktif" | "namaBerkas" | "otomatisUnggah" | "pakaiCap" | "penandatangan"> = {
  kelompok: "Form Bantu PTSP",
  pakaiTtd: true,
  labelPenandatangan: "",
  gantiGambarBawaan: true,
  tahanBilaTanpaTtd: false,
  capId: "",
  ...UKURAN_BAWAAN,
};

/**
 * BAWAAN (butir 19): PMH -> "@ 1 - PMH", PHS -> "@ 2 - PHS" (blangko Derry,
 * "Form Bantu PTSP"), keduanya otomatis diunggah. PMH: tanda tangan Ketua +
 * cap kantor di atasnya. PHS: tanda tangan ketua majelis, tanpa cap.
 *
 * Q3 16 Okt (peta perkara L3, bagian 5): PPP dan PJS tidak punya berkas tunggal di Derry - keduanya bagian 2 dan 3 dari "@ 0 - PMH - PHS"
 * (satu dokumen gabungan yang dipotong bot per bagian lewat cirinya, penetapanEdocService.ambilBagian). Sebelumnya peta mereka mati dan
 * kosong sehingga bot melaporkan "alamat_blangko_ppp_belum_disetel" padahal blangkonya ada; kini aktif dengan alamat gabungan itu - satu
 * sumber dengan bot. Unggah otomatis TETAP mati: jenis baru tidak diunggah ke SIPP tanpa keputusan admin.
 */
export const BAWAAN_PETA_PENETAPAN: Record<JenisPetaPenetapan, AturPenetapan> = {
  pmh: { ...UMUM, aktif: true, namaBerkas: "@ 1 - PMH.rtf", otomatisUnggah: true, pakaiCap: true, penandatangan: "ketua" },
  phs: { ...UMUM, aktif: true, namaBerkas: "@ 2 - PHS.rtf", otomatisUnggah: true, pakaiCap: false, penandatangan: "ketua_majelis" },
  // I9 17 Okt: berkas tunggal @ 0a / @ 0b; gabungan @ 0 = cadangan (satu sumber dengan PETA_PTSP bot).
  ppp: { ...UMUM, aktif: true, namaBerkas: BERKAS_PPP_TUNGGAL, namaBerkasCadangan: BERKAS_PTSP_GABUNGAN, otomatisUnggah: false, pakaiCap: true, penandatangan: "panitera" },
  pjs: { ...UMUM, aktif: true, namaBerkas: BERKAS_PJS_TUNGGAL, namaBerkasCadangan: BERKAS_PTSP_GABUNGAN, otomatisUnggah: false, pakaiCap: true, penandatangan: "panitera" },
};

export class GalatPetaPenetapan extends Error {}

export function jenisPetaSah(x: unknown): x is JenisPetaPenetapan {
  return JENIS_PETA_PENETAPAN.includes(String(x).toLowerCase() as JenisPetaPenetapan);
}

/** Aksara kendali (0-31, 127) diganti `ganti`. */
function tanpaKendali(s: string, ganti: string): string {
  return Array.from(s, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ganti : c)).join("");
}

const rapat = (x: unknown, batas: number) =>
  tanpaKendali(String(x ?? ""), " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, batas);

/**
 * Nama blangko: TIDAK dirapikan spasinya di dalam (ABT membedakan satu spasi
 * - lihat relaasCocokTepat latar.js), hanya dibuang aksara kendali dan garis
 * miring (bukan jalur folder).
 */
function namaBerkasBersih(x: unknown): string {
  const s = tanpaKendali(String(x ?? ""), "");
  if (/[\\/]/.test(s)) throw new GalatPetaPenetapan("Nama blangko tidak boleh memuat garis miring - tulis nama berkasnya saja, mis. \"@ 1 - PMH.rtf\".");
  return s.slice(0, 160);
}

/**
 * Membersihkan satu butir kiriman layar. Yang tidak disebut memakai nilai
 * `dasar` (yang berlaku sekarang). Nilai yang salah bentuk DITOLAK dengan
 * kalimatnya - tidak diganti diam-diam.
 */
export function bersihkanAturPenetapan(jenis: JenisPetaPenetapan, masukan: unknown, dasar?: AturPenetapan): AturPenetapan {
  const awal = dasar ?? BAWAAN_PETA_PENETAPAN[jenis];
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  const hasil: AturPenetapan = { ...awal };
  const boolean = ["aktif", "otomatisUnggah", "pakaiTtd", "pakaiCap", "gantiGambarBawaan", "tahanBilaTanpaTtd"] as const;
  for (const k of boolean) {
    if (m[k] === undefined) continue;
    if (typeof m[k] !== "boolean") throw new GalatPetaPenetapan(`${k} harus ya/tidak.`);
    hasil[k] = m[k] as boolean;
  }
  if (m.namaBerkas !== undefined) hasil.namaBerkas = namaBerkasBersih(m.namaBerkas);
  if (m.kelompok !== undefined) hasil.kelompok = rapat(m.kelompok, 120);
  if (m.labelPenandatangan !== undefined) hasil.labelPenandatangan = rapat(m.labelPenandatangan, 80);
  if (m.capId !== undefined) hasil.capId = rapat(m.capId, 64);
  if (m.penandatangan !== undefined) {
    const p = String(m.penandatangan);
    if (!PENANDATANGAN_PENETAPAN.some((x) => x.kode === p)) throw new GalatPetaPenetapan("Penanda tangan tidak dikenal.");
    hasil.penandatangan = p as KodePenandatangan;
  }
  for (const [k, b] of Object.entries(BATAS_UKURAN_MM) as Array<[KunciUkuran, { min: number; max: number; sebutan: string }]>) {
    if (m[k] === undefined || m[k] === null || m[k] === "") continue;
    const n = Number(m[k]);
    if (!Number.isFinite(n) || n < b.min || n > b.max) {
      throw new GalatPetaPenetapan(`${b.sebutan} harus angka ${b.min} sampai ${b.max}.`);
    }
    hasil[k] = Math.round(n * 10) / 10;
  }
  if (hasil.aktif && !hasil.namaBerkas.trim()) {
    throw new GalatPetaPenetapan(`${SEBUTAN_JENIS_PENETAPAN[jenis]}: nama blangko ABT wajib diisi sebelum dinyalakan.`);
  }
  if (!hasil.aktif) hasil.otomatisUnggah = false;
  // Mode tanda tangan elektronik (keputusan 17 Okt 2026 butir 5): penetapan yang
  // dicetak/diunggah lewat ALETA tidak pernah membawa gambar cap/TTD statis
  // blangko - kiriman false (pengaturan lama) tidak berlaku.
  hasil.gantiGambarBawaan = true;
  return hasil;
}

/** Bagian pengaturan yang diteruskan ke bot (aturBerlaku penetapanEdocService). */
export function aturUntukBot(a: AturPenetapan) {
  return {
    pakaiTtd: a.pakaiTtd,
    pakaiCap: a.pakaiCap,
    penandatangan: a.penandatangan,
    labelPenandatangan: a.labelPenandatangan,
    // Selalu true - mode tanda tangan elektronik (bot juga memaksanya).
    gantiGambarBawaan: true,
    tahanBilaTanpaTtd: a.tahanBilaTanpaTtd,
    lebarTtdMm: a.lebarTtdMm,
    tinggiTtdMaksMm: a.tinggiTtdMaksMm,
    ttdGeserKananMm: a.ttdGeserKananMm,
    ttdTurunMm: a.ttdTurunMm,
    lebarCapMm: a.lebarCapMm,
    capGeserKiriMm: a.capGeserKiriMm,
    capGeserAtasMm: a.capGeserAtasMm,
  };
}

/** Kalimat untuk peringatan bubuhan dari bot (hasil[].peringatan[].kode). */
export const KALIMAT_PERINGATAN_PENETAPAN: Record<string, string> = {
  kotak_ttd_elektronik:
    "Blok tanda tangan blangko ini adalah kotak \"Ditandatangani secara elektronik\" - dipakai apa adanya; gambar tanda tangan/cap tidak ditempel.",
  label_penanda_tangan_tidak_ditemukan:
    "Label jabatan penanda tangan (mis. \"Ketua,\") tidak ditemukan di blok tanda tangan - dokumen disusun TANPA tanda tangan.",
  nama_penanda_tangan_tidak_terbaca: "Nama penanda tangan di bawah label tidak terbaca - dokumen disusun TANPA tanda tangan.",
  tanda_tangan_tidak_ada_untuk_nama:
    "Belum ada tanda tangan SAH untuk nama penanda tangan ini - dokumen disusun TANPA tanda tangan. Unggah/sahkan di ALETA e-Court > Berkas tanda tangan.",
  tanda_tangan_ganda_untuk_nama:
    "Dua orang berbeda cocok dengan nama penanda tangan ini (tanpa gelar) - tidak ada yang dibubuhkan. Lengkapi nama tanda tangan dengan gelarnya.",
  nama_terlalu_pendek: "Nama penanda tangan terlalu pendek untuk dicocokkan - dokumen disusun TANPA tanda tangan.",
  gambar_tanda_tangan_tidak_terbaca: "Gambar tanda tangan tidak terbaca - dokumen disusun TANPA tanda tangan.",
  cap_belum_ada: "Belum ada cap aktif untuk jenis ini - dokumen disusun TANPA cap. Unggah cap di ALETA e-Court > Berkas tanda tangan > Cap.",
  cap_dilewati_tanpa_tanda_tangan: "Cap tidak dibubuhkan karena tanda tangannya tidak ada.",
  cap_tanpa_latar_transparan_di_belakang:
    "Cap tidak berlatar transparan (JPG / PNG tanpa alfa), jadi ditaruh DI BELAKANG tanda tangan. Unggah ulang cap dengan \"buang latar\".",
};

export function kalimatPeringatanPenetapan(kode: string, nama?: string): string {
  const dasar = KALIMAT_PERINGATAN_PENETAPAN[kode] ?? kode.replace(/_/g, " ");
  return nama ? `${dasar} (${nama})` : dasar;
}
