/**
 * ============================================================================
 * KERJAKAN PENETAPAN SATU PERKARA - SATU PINTU (20 Okt 2026, agen P1)
 * ============================================================================
 *
 * Mengerjakan PMH -> PPP -> PJS -> PHS satu perkara atas {mode, pilihan,
 * langkah yang dicentang} dan melaporkan hasilnya per langkah. Dipakai kartu
 * Penetapan, tombol "Penetapan Otomatis" di halaman SIPP, dan penanda halaman
 * SIPP. Bentuknya: docs/penetapan/KERJAKAN-PENETAPAN.md.
 *
 * Jaminan (semuanya di sini, bukan di pemanggil):
 *   - Satu perkara satu pekerjaan: kunci per perkara dengan masa berlaku
 *     (bot: penetapanKunciService). Yang kalah tidak menulis apa pun.
 *   - Keadaan SIPP dibaca tepat sebelum menulis (bot: penetapanKeadaanService,
 *     satu definisi "ada" untuk semua pembaca). Yang sudah ada DILEWATI -
 *     tidak ditulis ulang dan tidak dibongkar.
 *   - Tidak pernah membongkar. Tidak ada jalur bongkar di berkas ini.
 *   - Sisa PMH->PHS ditulis dalam satu transaksi di bot (utuh atau batal);
 *     bila satu langkah tidak dapat disusun, tidak satu pun ditulis.
 *
 * Modul ini tidak mengunggah e-Doc: blangko e-Doc dicetak oleh sesi ABT di
 * peramban petugas. Peramban mengunggah e-Doc SESUDAH laporan ini, untuk
 * langkah yang `tercatat` atau `dilewati/sudah_ada`.
 *
 * Semua ketergantungan disuntikkan (`Ketergantungan`) supaya perilakunya dapat
 * diuji tanpa bot maupun SIPP.
 */

export const URUTAN_PENETAPAN = ["pmh", "ppp", "pjs", "phs"] as const;
export type JenisPenetapan = (typeof URUTAN_PENETAPAN)[number];

export type PilihanKerja = {
  majelis?: string;
  pmhKursi?: Array<number | string>;
  hakimTunggal?: boolean;
  ppp?: number | string;
  pjs?: number | string;
  phs?: string;
  ruangan?: number | string;
  jam?: string;
  pejabat?: Partial<Record<JenisPenetapan, string>>;
};

export type MasukanKerja = {
  nomorPerkara: string;
  perkaraId?: number;
  mode: "otomatis" | "manual";
  pilihan?: PilihanKerja;
  langkah?: Partial<Record<JenisPenetapan, boolean>>;
  kering?: boolean;
  /** Akun SIPP yang sedang masuk di peramban (penekan sebenarnya, jejak ALETA). */
  olehUsername: string;
  operator: string;
  ip?: string;
  /** Token kunci yang sudah dipegang pemanggil (mis. peramban yang mengunggah e-Doc sesudahnya). */
  kunciToken?: string;
  tanyaJamKerja?: boolean;
  jamKerja?: "antrekan" | "sekarang";
};

export type StatusLangkah = "tercatat" | "dilewati" | "gagal";

export type LaporanLangkah = {
  jenis: JenisPenetapan;
  status: StatusLangkah;
  sebab: string;
  bunyi: string;
  atasNama?: unknown;
  tanggal?: string;
  /** Hanya pada kering: langkah ini lolos pemeriksaan. */
  siap?: boolean;
  diantrekan?: boolean;
};

export type HasilKerja = {
  ok: boolean;
  perkara: { perkaraId: number; nomorPerkara: string };
  kunci: { diambil: boolean; token?: string; oleh?: string; sampai?: string };
  laporan: LaporanLangkah[];
  keadaanSesudah: Record<string, unknown> | null;
  perluPilihanJamKerja: boolean;
  pesan: string;
  kering: boolean;
};

type Hasil<T> = { ok: true; data: T } | { ok: false; error: string; kode?: string; status?: number; badan?: Record<string, unknown> };

export type LangkahTulis = {
  jenis: string;
  hakimId?: number[];
  petugasId?: number;
  tanggalSidang?: string;
  ruanganId?: number;
  jamSidang?: string;
  pejabatUsername?: string;
};

export type Ketergantungan = {
  bacaKeadaan(acuan: { perkaraId?: number; nomorPerkara?: string }): Promise<Hasil<Record<string, unknown>>>;
  ambilKunci(p: { perkaraId: number; operator: string; tujuan: string; token?: string }): Promise<Hasil<Record<string, unknown>>>;
  lepasKunci(p: { perkaraId: number; token: string }): Promise<unknown>;
  bacaUsulan(nomorPerkara: string, pilihanMajelis: number[]): Promise<Hasil<Record<string, unknown>>>;
  /** Mengisi pejabatUsername bawaan dan menolak yang tidak sah; pulang null bila semuanya sah. */
  pastikanPejabat(tanggal: string, langkah: LangkahTulis[]): Promise<{ alasan: string; jenis?: string; username?: string } | null>;
  periksaLibur(tanggal: string, langkah: LangkahTulis[]): Promise<{ alasan: string; diminta: string } | null>;
  tulisRantai(p: {
    perkaraId: number;
    tanggalPenetapan: string;
    olehUsername: string;
    operator: string;
    ip?: string;
    langkah: LangkahTulis[];
    tanyaJamKerja?: boolean;
    jamKerja?: "antrekan" | "sekarang";
    kunciToken?: string;
  }): Promise<Hasil<Record<string, unknown>>>;
  tulisKering(p: {
    jenis: string;
    perkaraId: number;
    tanggalPenetapan: string;
    olehUsername: string;
    pejabatUsername?: string;
    operator: string;
    rantaiSebelum: string[];
    ip?: string;
  } & Omit<LangkahTulis, "jenis" | "pejabatUsername">): Promise<Hasil<Record<string, unknown>>>;
};

// ---------------------------------------------------------------------------
// Nilai tulis dari usulan - ID, bukan nama (padanan idUntukTulis di ekstensi)
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" ? (x as Obj) : {});
const daftar = (x: unknown): Obj[] => (Array.isArray(x) ? (x as Obj[]) : []);
const idSah = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

function pilihanDari(calon: unknown, pengenal: unknown): Obj | null {
  if (!Array.isArray(calon) || pengenal === undefined || pengenal === null || pengenal === "") return null;
  const cari = String(pengenal);
  return (
    (calon as Obj[]).find((x) => String(x.id ?? x.hakimId ?? x.paniteraId ?? x.jurusitaId ?? x.nama) === cari) || null
  );
}

/**
 * Nilai tulis satu langkah menurut usulan server dan pilihan petugas.
 * Urutan menang PMH: susunan (majelis) > per orang (pmhKursi) > usulan.
 * Pilihan yang tidak ketemu di daftar calon DITOLAK (bukan diganti usulan).
 */
export function nilaiTulisDariUsulan(
  jenis: JenisPenetapan,
  usulanMentah: unknown,
  pilihan: PilihanKerja,
  manual: boolean
): { ok: true; nilai: Omit<LangkahTulis, "jenis" | "pejabatUsername"> } | { ok: false; alasan: string } {
  const usulan = obj(usulanMentah);
  const p = manual ? pilihan : {};

  if (jenis === "pmh") {
    const pmh = obj(usulan.pmh);
    const anggota = daftar(pmh.anggota);
    const kolam = daftar(pmh.hitungan);
    const kuncSusunan = String(p.majelis || "");
    const susunan = kuncSusunan ? daftar(pmh.susunanTerpakai).find((x) => x.kunci === kuncSusunan) || null : null;
    if (kuncSusunan && !susunan) return { ok: false, alasan: "pilihan_majelis_tidak_ketemu" };
    const kursiDipilih = Array.isArray(p.pmhKursi) ? p.pmhKursi : [];

    const hakimId: number[] = [];
    for (const urutan of [0, 1, 2]) {
      const dariSusunan = susunan ? daftar(susunan.anggota)[urutan] : null;
      const pengenal = kursiDipilih[urutan];
      const dariOrang = pilihanDari(kolam, pengenal);
      if (pengenal !== undefined && pengenal !== null && pengenal !== "" && !dariOrang && !dariSusunan) {
        return { ok: false, alasan: "pilihan_hakim_tidak_ketemu" };
      }
      const orang = dariSusunan || dariOrang || anggota[urutan];
      const id = idSah(orang && (orang.hakimId ?? orang.id));
      if (id) hakimId.push(id);
    }
    // Hakim tunggal memang satu kursi; majelis yang hanya terbaca dua kursi
    // adalah susunan cacat yang harus dibongkar dengan tangan - ditolak.
    if (String(pmh.bentuk || "") === "majelis" && hakimId.length !== 3) return { ok: false, alasan: "majelis_tidak_lengkap" };
    if (hakimId.length === 0) return { ok: false, alasan: "belum_ada_usulan" };
    if (new Set(hakimId).size !== hakimId.length) return { ok: false, alasan: "hakim_kembar" };
    return { ok: true, nilai: { hakimId } };
  }

  if (jenis === "ppp" || jenis === "pjs") {
    const bagian = obj(usulan[jenis]);
    const dipilih = pilihanDari(bagian.calon, p[jenis]);
    if (p[jenis] !== undefined && p[jenis] !== null && p[jenis] !== "" && !dipilih) {
      return { ok: false, alasan: jenis === "ppp" ? "pilihan_panitera_tidak_ketemu" : "pilihan_jurusita_tidak_ketemu" };
    }
    const orang = dipilih || obj(bagian.usulan);
    const id = idSah(jenis === "ppp" ? (orang.paniteraId ?? orang.id) : (orang.jurusitaId ?? orang.id));
    return id ? { ok: true, nilai: { petugasId: id } } : { ok: false, alasan: "belum_ada_usulan" };
  }

  // phs
  const manualTgl = String(p.phs || "").trim();
  const tanggalSidang = manualTgl || String(obj(usulan.phs).usulan || "");
  if (!tanggalSidang) return { ok: false, alasan: "belum_ada_usulan" };
  if (manualTgl && !/^\d{4}-\d{2}-\d{2}$/.test(manualTgl)) return { ok: false, alasan: "tanggal_sidang_tidak_terbaca" };
  const tp = String(usulan.tanggalPenetapan || "").slice(0, 10);
  if (manualTgl && tp && manualTgl < tp) return { ok: false, alasan: "sidang_mendahului_penetapan" };
  const nilai: Omit<LangkahTulis, "jenis" | "pejabatUsername"> = { tanggalSidang: tanggalSidang.slice(0, 10) };
  const ruangan = idSah(p.ruangan);
  if (ruangan) nilai.ruanganId = ruangan;
  const jam = String(p.jam || "");
  if (/^\d{2}:\d{2}$/.test(jam) && jam !== "09:00") nilai.jamSidang = jam;
  return { ok: true, nilai };
}

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------

const BUNYI: Record<string, string> = {
  sedang_dikerjakan:
    "Perkara ini sedang dikerjakan penetapannya oleh pekerjaan lain. Tunggu selesai, lalu muat ulang - yang sudah tertulis dilewati.",
  kunci_tidak_tersedia: "Pagar penetapan di server tidak dapat dipakai sekarang, jadi tidak ada yang ditulis. Coba lagi sebentar lagi.",
  keadaan_tidak_terbaca: "Keadaan penetapan perkara ini tidak terbaca dari SIPP, jadi tidak ada yang ditulis.",
  belum_ada_usulan: "Belum ada usulan yang dapat ditulis untuk langkah ini.",
  pilihan_majelis_tidak_ketemu: "Susunan majelis pilihan tidak ada lagi di daftar - pilih ulang.",
  pilihan_hakim_tidak_ketemu: "Hakim pilihan tidak ada di daftar calon - pilih ulang.",
  pilihan_panitera_tidak_ketemu: "Panitera pengganti pilihan tidak ada di daftar calon - pilih ulang.",
  pilihan_jurusita_tidak_ketemu: "Juru sita pilihan tidak ada di daftar calon - pilih ulang.",
  majelis_tidak_lengkap: "Susunan majelis tidak lengkap (kurang dari tiga hakim) - tidak ditulis.",
  hakim_kembar: "Hakim yang sama terpilih dua kali di majelis.",
  tanggal_sidang_tidak_terbaca: "Tanggal sidang pilihan tidak terbaca. Pilih ulang dari kalender.",
  sidang_mendahului_penetapan: "Tanggal sidang pilihan mendahului tanggal penetapan. Pilih tanggal lain.",
  tanggal_sidang_hari_libur: "Tanggal sidang jatuh pada hari libur. Pilih hari kerja lain; ALETA tidak menggantinya sendiri.",
  tanggal_penetapan_hari_libur: "Tanggal penetapan jatuh pada hari libur. Penetapan tidak dibuat pada hari libur.",
  dibatalkan_rantai: "Tidak tertulis - seluruh sisa penetapan dibatalkan karena satu langkah tidak dapat ditulis.",
  pejabat_belum_dipilih: "Pejabat penetap belum dipilih.",
  pejabat_tidak_sah: "Akun itu bukan pejabat yang berwenang untuk langkah ini.",
};
const bunyiDari = (kode: string, tambahan = "") => (BUNYI[kode] ? BUNYI[kode] : tambahan || kode);

const ISO = /^\d{4}-\d{2}-\d{2}/;

function langkahKosong(): Record<JenisPenetapan, LaporanLangkah> {
  const r = {} as Record<JenisPenetapan, LaporanLangkah>;
  for (const j of URUTAN_PENETAPAN) r[j] = { jenis: j, status: "dilewati", sebab: "tidak_dicentang", bunyi: "" };
  return r;
}

function bentukHasil(
  dasar: Pick<HasilKerja, "perkara" | "kering">,
  laporan: Record<JenisPenetapan, LaporanLangkah>,
  tambahan: Partial<HasilKerja> & { kunci: HasilKerja["kunci"] }
): HasilKerja {
  const daftarLaporan = URUTAN_PENETAPAN.map((j) => laporan[j]);
  const gagal = daftarLaporan.filter((x) => x.status === "gagal");
  const tercatat = daftarLaporan.filter((x) => x.status === "tercatat").map((x) => x.jenis.toUpperCase());
  const sibuk = daftarLaporan.some((x) => x.sebab === "sedang_dikerjakan");
  const pesan =
    tambahan.pesan ??
    (gagal.length
      ? `Gagal: ${gagal.map((x) => `${x.jenis.toUpperCase()} (${x.bunyi || x.sebab})`).join("; ")}.`
      : sibuk
        ? bunyiDari("sedang_dikerjakan")
        : tercatat.length
          ? `Tercatat di SIPP: ${tercatat.join(", ")}.`
          : "Tidak ada yang perlu ditulis.");
  return {
    ok: gagal.length === 0 && !sibuk && !tambahan.perluPilihanJamKerja,
    perkara: dasar.perkara,
    kering: dasar.kering,
    kunci: tambahan.kunci,
    laporan: daftarLaporan,
    keadaanSesudah: tambahan.keadaanSesudah ?? null,
    perluPilihanJamKerja: tambahan.perluPilihanJamKerja === true,
    pesan,
  };
}

// ---------------------------------------------------------------------------
// Orkestrasi
// ---------------------------------------------------------------------------

export async function kerjakanPenetapan(dep: Ketergantungan, masuk: MasukanKerja): Promise<HasilKerja> {
  const kering = masuk.kering === true;
  const manual = masuk.mode === "manual";
  const pilihan = masuk.pilihan || {};
  const dicentang = (j: JenisPenetapan) => (masuk.langkah ? masuk.langkah[j] === true : true);
  const laporan = langkahKosong();

  // 1. Keadaan dibaca lebih dulu (juga untuk mengenali perkara).
  const awal = await dep.bacaKeadaan({
    perkaraId: masuk.perkaraId && masuk.perkaraId > 0 ? masuk.perkaraId : undefined,
    nomorPerkara: masuk.nomorPerkara,
  });
  const perkaraKosong = { perkaraId: masuk.perkaraId || 0, nomorPerkara: masuk.nomorPerkara };
  const tanpaKunci = { diambil: false };
  const gagalSemua = (sebab: string, bunyi: string): HasilKerja => {
    for (const j of URUTAN_PENETAPAN) {
      if (dicentang(j)) laporan[j] = { jenis: j, status: "gagal", sebab, bunyi };
    }
    return bentukHasil({ perkara: perkaraKosong, kering }, laporan, { kunci: tanpaKunci });
  };
  if (!awal.ok) {
    const notFound = awal.status === 404;
    return gagalSemua(notFound ? "perkara_tidak_ketemu" : "keadaan_tidak_terbaca", notFound ? "Perkara ini tidak ditemukan di SIPP." : bunyiDari("keadaan_tidak_terbaca"));
  }
  const perkaraId = idSah(awal.data.perkaraId);
  const nomorPerkara = String(awal.data.nomorPerkara || masuk.nomorPerkara);
  const perkara = { perkaraId, nomorPerkara };

  // 2. Kunci per perkara (uji kering tidak menulis, jadi tidak mengunci).
  let token = "";
  let kunciSendiri = false;
  let infoKunci: HasilKerja["kunci"] = tanpaKunci;
  if (!kering) {
    const kunci = await dep.ambilKunci({ perkaraId, operator: masuk.operator, tujuan: "kerjakan-penetapan", token: masuk.kunciToken });
    if (!kunci.ok) {
      const alasan = kunci.error === "sedang_dikerjakan" ? "sedang_dikerjakan" : "kunci_tidak_tersedia";
      const bacaLagi = await dep.bacaKeadaan({ perkaraId });
      const k = bacaLagi.ok ? obj(bacaLagi.data.kunci) : {};
      // Pekerjaan lain sedang berjalan = DILEWATI (bukan kegagalan); pagar yang
      // tidak dapat dipakai = GAGAL. Dua-duanya tidak menulis apa pun.
      for (const j of URUTAN_PENETAPAN) {
        if (dicentang(j)) {
          laporan[j] = { jenis: j, status: alasan === "sedang_dikerjakan" ? "dilewati" : "gagal", sebab: alasan, bunyi: bunyiDari(alasan) };
        }
      }
      return bentukHasil({ perkara, kering }, laporan, {
        kunci: { diambil: false, oleh: String(k.oleh || ""), sampai: String(k.sampai || "") },
      });
    }
    token = String(kunci.data.token || "");
    kunciSendiri = !masuk.kunciToken;
    infoKunci = { diambil: true, token };
  }

  try {
    // 3. Keadaan SESUDAH kunci dipegang - inilah yang menentukan apa yang ditulis.
    const keadaan = kering ? awal : await dep.bacaKeadaan({ perkaraId });
    if (!keadaan.ok) return gagalSemua("keadaan_tidak_terbaca", bunyiDari("keadaan_tidak_terbaca"));
    const langkahAda = obj(keadaan.data.langkah);
    const ada = (j: JenisPenetapan) => obj(langkahAda[j]).ada === true;
    const tanggalAda = (j: JenisPenetapan) => String(obj(langkahAda[j]).tanggal || "");

    const tulis: JenisPenetapan[] = [];
    for (const j of URUTAN_PENETAPAN) {
      if (!dicentang(j)) continue;
      if (ada(j)) {
        laporan[j] = { jenis: j, status: "dilewati", sebab: "sudah_ada", bunyi: `${j.toUpperCase()} memang sudah ada di SIPP - tidak ditulis ulang.`, tanggal: tanggalAda(j) };
      } else {
        tulis.push(j);
      }
    }
    if (tulis.length === 0) {
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }

    // 4. Usulan server (majelis pilihan dihitung ulang: PP, JS, hari sidang mengikuti majelis).
    const pilihanMajelis =
      manual && pilihan.majelis ? String(pilihan.majelis).split("-").map(idSah).filter(Boolean).slice(0, 5) : [];
    const usulan = await dep.bacaUsulan(nomorPerkara, pilihanMajelis);
    if (!usulan.ok) {
      for (const j of tulis) laporan[j] = { jenis: j, status: "gagal", sebab: "belum_ada_usulan", bunyi: `${bunyiDari("belum_ada_usulan")} (${usulan.error})` };
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }
    const tanggalPenetapan = ISO.test(String(usulan.data.tanggalPenetapan || "")) ? String(usulan.data.tanggalPenetapan).slice(0, 10) : "";
    // Tanggal penetapan: yang sudah dipakai langkah lain bila ada (usulan sudah membawanya).
    if (!tanggalPenetapan) {
      for (const j of tulis) laporan[j] = { jenis: j, status: "gagal", sebab: "tanggal_penetapan_tidak_sah", bunyi: "Tanggal penetapan tidak terbaca." };
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }

    // 5. Menyusun langkah - semua atau tidak satu pun.
    const langkahTulis: LangkahTulis[] = [];
    let masalah: { jenis: JenisPenetapan; alasan: string } | null = null;
    for (const j of tulis) {
      const n = nilaiTulisDariUsulan(j, usulan.data, pilihan, manual);
      if (!n.ok) {
        masalah = { jenis: j, alasan: n.alasan };
        break;
      }
      const pejabat = manual && pilihan.pejabat ? String(pilihan.pejabat[j] || "").trim().slice(0, 150) : "";
      langkahTulis.push({ jenis: j, ...n.nilai, ...(pejabat ? { pejabatUsername: pejabat } : {}) });
    }
    const tandaiBatal = (kecuali: JenisPenetapan | null, sebab: string, bunyi: string) => {
      for (const j of tulis) {
        laporan[j] =
          j === kecuali
            ? { jenis: j, status: "gagal", sebab, bunyi: bunyiDari(sebab, bunyi) }
            : { jenis: j, status: "gagal", sebab: "dibatalkan_rantai", bunyi: bunyiDari("dibatalkan_rantai") };
      }
    };
    if (masalah) {
      tandaiBatal(masalah.jenis, masalah.alasan, masalah.alasan);
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }

    const tolakPejabat = await dep.pastikanPejabat(tanggalPenetapan, langkahTulis);
    if (tolakPejabat) {
      tandaiBatal((tolakPejabat.jenis as JenisPenetapan) || tulis[0], tolakPejabat.alasan, `${bunyiDari(tolakPejabat.alasan)}${tolakPejabat.username ? ` (${tolakPejabat.username})` : ""}`);
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }
    const libur = await dep.periksaLibur(tanggalPenetapan, langkahTulis);
    if (libur) {
      tandaiBatal(libur.alasan === "tanggal_sidang_hari_libur" ? "phs" : tulis[0], libur.alasan, libur.alasan);
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }

    // 6a. Uji kering: tiap langkah dinilai bot atas keadaan yang AKAN ada.
    if (kering) {
      const sebelum: string[] = URUTAN_PENETAPAN.filter((j) => ada(j));
      for (const l of langkahTulis) {
        const jenis = l.jenis as JenisPenetapan;
        const r = await dep.tulisKering({
          jenis,
          perkaraId,
          tanggalPenetapan,
          olehUsername: masuk.olehUsername,
          pejabatUsername: l.pejabatUsername,
          operator: masuk.operator,
          rantaiSebelum: [...sebelum],
          ip: masuk.ip,
          hakimId: l.hakimId,
          petugasId: l.petugasId,
          tanggalSidang: l.tanggalSidang,
          ruanganId: l.ruanganId,
          jamSidang: l.jamSidang,
        });
        if (r.ok) {
          laporan[jenis] = { jenis, status: "dilewati", sebab: "kering", bunyi: "Siap ditulis (uji kering - belum ada yang ditulis).", siap: true, atasNama: r.data.atasNama };
          sebelum.push(jenis);
        } else {
          const kode = r.error || "ditolak";
          laporan[jenis] = { jenis, status: "gagal", sebab: kode, bunyi: bunyiDari(kode, kode), siap: false };
          break;
        }
      }
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data });
    }

    // 6b. Menulis: satu transaksi di bot, di bawah kunci yang kita pegang.
    const rantai = await dep.tulisRantai({
      perkaraId,
      tanggalPenetapan,
      olehUsername: masuk.olehUsername,
      operator: masuk.operator,
      ip: masuk.ip,
      langkah: langkahTulis,
      tanyaJamKerja: masuk.tanyaJamKerja,
      jamKerja: masuk.jamKerja,
      kunciToken: token,
    });

    const badan: Obj = rantai.ok ? obj(rantai.data) : obj(rantai.badan);
    // Di luar jam kerja: pilihan Antrekan / Tulis sekarang ada di badan jawaban.
    if (badan.perluPilihan === true || badan.alasan === "di_luar_jam_kerja" || (!rantai.ok && rantai.error === "di_luar_jam_kerja")) {
      for (const j of tulis) laporan[j] = { jenis: j, status: "dilewati", sebab: "di_luar_jam_kerja", bunyi: String(badan.pesan || badan.error || "Sekarang di luar jam kerja.") };
      return bentukHasil({ perkara, kering }, laporan, {
        kunci: infoKunci,
        keadaanSesudah: keadaan.data,
        perluPilihanJamKerja: true,
        pesan: String(badan.pesan || badan.error || "Sekarang di luar jam kerja. Pilih Antrekan atau Tulis sekarang."),
      });
    }
    if (badan.diantrekan === true) {
      for (const j of tulis) {
        laporan[j] = { jenis: j, status: "dilewati", sebab: "diantrekan", bunyi: String(badan.pesan || "Diantrekan, dikerjakan pada jam kerja berikutnya."), diantrekan: true };
      }
      return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: keadaan.data, pesan: String(badan.pesan || "Diantrekan.") });
    }

    const rincian = daftar(badan.hasil);
    const dari = (j: JenisPenetapan) => rincian.find((x) => String(x.jenis) === j) || {};
    const gagalUmum = !rantai.ok || badan.ok === false;
    const jenisGagal = String(badan.jenisGagal || "");
    const kodeUmum = String(badan.alasan || (!rantai.ok ? rantai.error : "") || "ditolak");
    for (const j of tulis) {
      const r = dari(j);
      if (r.sudahAda === true) {
        laporan[j] = { jenis: j, status: "dilewati", sebab: "sudah_ada", bunyi: `${j.toUpperCase()} memang sudah ada di SIPP - tidak ditulis ulang.` };
      } else if (!gagalUmum && r.ok === true) {
        laporan[j] = { jenis: j, status: "tercatat", sebab: "", bunyi: "", atasNama: r.atasNama, tanggal: String(r.tanggalPenetapan || tanggalPenetapan) };
      } else if (gagalUmum && (jenisGagal === j || (!jenisGagal && j === tulis[0]))) {
        const kode = String(r.alasan || kodeUmum);
        laporan[j] = { jenis: j, status: "gagal", sebab: kode, bunyi: bunyiDari(kode, String(badan.pesan || kode)) };
      } else {
        laporan[j] = { jenis: j, status: "gagal", sebab: "dibatalkan_rantai", bunyi: bunyiDari("dibatalkan_rantai") };
      }
    }
    const sesudah = await dep.bacaKeadaan({ perkaraId });
    return bentukHasil({ perkara, kering }, laporan, { kunci: infoKunci, keadaanSesudah: sesudah.ok ? sesudah.data : null });
  } finally {
    // Kunci yang dipinjam pemanggil (token dari peramban) dilepas pemanggilnya
    // sesudah e-Doc; yang kita ambil sendiri dilepas di sini.
    if (token && kunciSendiri) await dep.lepasKunci({ perkaraId, token });
  }
}
