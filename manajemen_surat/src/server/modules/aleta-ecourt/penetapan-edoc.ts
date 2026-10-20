/**
 * Edoc penetapan PMH/PPP/PJS/PHS dan CAP pengadilan - sisi portal
 * (perbaikan 2 Okt 2026, butir 17, kontrak K6).
 *
 * ============================================================================
 * CAP BUKAN TANDA TANGAN
 * ============================================================================
 *
 * Tanda tangan milik SATU orang dan disimpan di basis data bot (wajib disahkan,
 * tertaut ke satu akun - layar "Berkas tanda tangan"). Cap milik JABATAN:
 * dipakai pejabat mana saja sesuai NAMA cap-nya. Peruntukan:
 *
 *   ketua     PMH  (ditandatangani Ketua / Wakil / Plh Ketua)
 *   panitera  PPP, PJS  (ditandatangani Panitera / Plh Panitera)
 *   hakim     PHS  (ditandatangani Ketua Majelis)
 *   umum      cadangan untuk jenis yang belum punya cap khusus
 *
 * Disimpan di aleta_ecourt_cap (migrasi 0056), diunggah pengguna sendiri.
 *
 * ============================================================================
 * PASSPHRASE TIDAK PERNAH TINGGAL
 * ============================================================================
 *
 * Passphrase TTE (opsional, hanya bila penyedia TTE disetel di bot) diteruskan
 * ke bot dalam satu permintaan dan tidak disimpan/dicatat di mana pun - pola
 * yang sama dengan TTE e-Court 1.177.0 (ecourt-aksi.ts).
 *
 * ============================================================================
 * JEJAK JUJUR DI ALETA, TANPA TANDA ALETA DI SIPP (butir 14, K4)
 * ============================================================================
 *
 * Yang tercatat di SIPP (perkara_dokumen_penetapan.diinput_oleh) adalah akun
 * SIPP petugas yang login. Siapa + waktu + IP + "lewat ALETA" dicatat di
 * audit_logs portal dan di jejak bot (aleta_bot_jejak_penetapan).
 */

import { type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { capBerlatarTransparan, pastikanCapBening } from "@/server/shared/cap-latar-transparan";
import { nextPrefixedId } from "@/server/shared/ids";

import { BATAS_PERAMBAN_MS, panggilBot, type HasilBot } from "./ecourt-aksi";

export const JENIS_PENETAPAN = ["pmh", "ppp", "pjs", "phs"] as const;
export type JenisPenetapan = (typeof JENIS_PENETAPAN)[number];

export const PERUNTUKAN_CAP = ["ketua", "panitera", "hakim", "umum"] as const;
export type PeruntukanCap = (typeof PERUNTUKAN_CAP)[number];

/** Jenis penetapan -> peruntukan cap yang dipakai. */
export const PERUNTUKAN_UNTUK_JENIS: Record<JenisPenetapan, PeruntukanCap> = {
  pmh: "ketua",
  ppp: "panitera",
  pjs: "panitera",
  phs: "hakim",
};

/** Sebutan penanda tangan per kode peta bot (ketua/panitera/hakim). */
export const SEBUTAN_PENANDATANGAN: Record<string, string> = {
  ketua: "Ketua / Wakil / Plh Ketua",
  panitera: "Panitera / Plh Panitera",
  hakim: "Ketua Majelis",
};

/**
 * Halaman tempat cap dan tanda tangan diunggah: ALETA e-Court, menu
 * "Berkas tanda tangan" (#ttd). Awalan /aleta/ = basePath portal.
 */
export const TAUTAN_BERKAS_TANDA_TANGAN = "/aleta/aleta-ecourt#ttd";

export const SEBUTAN_PERUNTUKAN: Record<PeruntukanCap, string> = {
  ketua: "Ketua (PMH)",
  panitera: "Panitera (PPP, PJS)",
  hakim: "Ketua Majelis (PHS)",
  umum: "Umum (semua jenis)",
};

/** Batas gambar cap - cap wajar puluhan sampai ratusan KB. */
export const BATAS_CAP_BYTE = 3 * 1024 * 1024;
const BATAS_CAP_KECIL = 1024;

export function jenisGambarCap(isi: Uint8Array): "png" | "jpg" | "" {
  if (
    isi.length > 3 &&
    isi[0] === 0x89 &&
    isi[1] === 0x50 &&
    isi[2] === 0x4e &&
    isi[3] === 0x47
  )
    return "png";
  if (isi.length > 2 && isi[0] === 0xff && isi[1] === 0xd8 && isi[2] === 0xff)
    return "jpg";
  return "";
}

/** WEBP (RIFF....WEBP) - diterima HANYA bila latarnya dibuang (hasilnya PNG). */
export function jenisWebp(isi: Uint8Array): boolean {
  return (
    isi.length > 12 &&
    Buffer.from(isi.subarray(0, 4)).toString("latin1") === "RIFF" &&
    Buffer.from(isi.subarray(8, 12)).toString("latin1") === "WEBP"
  );
}

export type BarisCap = {
  id: string;
  nama: string;
  peruntukan: PeruntukanCap;
  keterangan: string;
  jenisBerkas: "png" | "jpg";
  ukuran: number;
  aktif: boolean;
  diunggahOlehNama: string;
  dibuatPada: string;
  diubahPada: string;
};

function keBarisCap(b: Record<string, unknown>): BarisCap {
  return {
    id: String(b.id),
    nama: String(b.nama ?? ""),
    peruntukan: String(b.peruntukan ?? "umum") as PeruntukanCap,
    keterangan: String(b.keterangan ?? ""),
    jenisBerkas: (String(b.jenis_berkas ?? "png") === "jpg" ? "jpg" : "png") as
      "png" | "jpg",
    ukuran: Number(b.ukuran ?? 0),
    aktif: Number(b.aktif ?? 0) === 1,
    diunggahOlehNama: String(b.diunggah_oleh_nama ?? ""),
    dibuatPada: String(b.dibuat_pada ?? ""),
    diubahPada: String(b.diubah_pada ?? ""),
  };
}

export async function daftarCap(
  db: AletaDatabase,
  { hanyaAktif = false } = {},
): Promise<BarisCap[]> {
  const baris = await db
    .prepare(
      "SELECT id, nama, peruntukan, keterangan, jenis_berkas, ukuran, aktif, diunggah_oleh_nama, dibuat_pada, diubah_pada FROM aleta_ecourt_cap" +
        (hanyaAktif ? " WHERE aktif = 1" : "") +
        " ORDER BY aktif DESC, peruntukan, nama, id",
    )
    .all();
  return (baris as Array<Record<string, unknown>>).map(keBarisCap);
}

export async function gambarCap(
  db: AletaDatabase,
  id: string,
): Promise<{ isi: Buffer; jenis: "png" | "jpg" } | null> {
  const b = (await db
    .prepare(
      "SELECT jenis_berkas, isi_base64 FROM aleta_ecourt_cap WHERE id = ?",
    )
    .get(id)) as Record<string, unknown> | undefined;
  if (!b) return null;
  return {
    isi: Buffer.from(String(b.isi_base64 ?? ""), "base64"),
    jenis: String(b.jenis_berkas ?? "png") === "jpg" ? "jpg" : "png",
  };
}

export type HasilUbahCap =
  { ok: true; id: string } | { ok: false; alasan: string };

export async function tambahCap(
  db: AletaDatabase,
  masukan: {
    nama: string;
    peruntukan: string;
    keterangan?: string;
    isi: Uint8Array;
    /** Buang latar kertas -> PNG transparan (cap-latar-transparan.ts). WEBP hanya lewat jalan ini. */
    buangLatar?: boolean;
  },
  aktor: { id: string; nama: string },
): Promise<HasilUbahCap> {
  const nama = String(masukan.nama ?? "")
    .trim()
    .slice(0, 150);
  if (!nama) return { ok: false, alasan: "nama_cap_kosong" };
  const peruntukan = String(masukan.peruntukan ?? "") as PeruntukanCap;
  if (!PERUNTUKAN_CAP.includes(peruntukan))
    return { ok: false, alasan: "peruntukan_tidak_dikenal" };
  let isi = masukan.isi;
  let latarDibuang = false;
  if (masukan.buangLatar) {
    if (!isi || isi.length < BATAS_CAP_KECIL)
      return { ok: false, alasan: "gambar_cap_terlalu_kecil" };
    if (isi.length > BATAS_CAP_BYTE)
      return { ok: false, alasan: "gambar_cap_terlalu_besar" };
    if (!jenisGambarCap(isi) && !jenisWebp(isi))
      return { ok: false, alasan: "gambar_cap_bukan_png_jpg" };
    try {
      const olah = await capBerlatarTransparan(Buffer.from(isi));
      isi = new Uint8Array(olah.buffer);
      latarDibuang = true;
    } catch (galat) {
      const pesan = galat instanceof Error ? galat.message : "";
      return {
        ok: false,
        alasan:
          pesan === "gambar_cap_tanpa_tinta"
            ? "gambar_cap_tanpa_tinta"
            : "gambar_cap_tidak_terbaca",
      };
    }
  }
  if (!isi || isi.length < BATAS_CAP_KECIL)
    return { ok: false, alasan: "gambar_cap_terlalu_kecil" };
  if (isi.length > BATAS_CAP_BYTE)
    return { ok: false, alasan: "gambar_cap_terlalu_besar" };
  const jenis = jenisGambarCap(isi);
  if (!jenis) return { ok: false, alasan: "gambar_cap_bukan_png_jpg" };

  const id = await nextPrefixedId(db, "aleta_ecourt_cap", "cap");
  const sekarang = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO aleta_ecourt_cap (id, nama, peruntukan, keterangan, jenis_berkas, ukuran, isi_base64, aktif, diunggah_oleh_id, diunggah_oleh_nama, dibuat_pada, diubah_pada) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
    )
    .run(
      id,
      nama,
      peruntukan,
      String(masukan.keterangan ?? "").slice(0, 300),
      jenis,
      isi.length,
      Buffer.from(isi).toString("base64"),
      aktor.id,
      aktor.nama,
      sekarang,
      sekarang,
    );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: aktor.id,
    action: "CAP_PENETAPAN_TAMBAH",
    entityType: "aleta_ecourt_cap",
    entityId: id,
    payload: { nama, peruntukan, ukuran: isi.length, latarDibuang, lewat: "ALETA" },
  });
  return { ok: true, id };
}

/** Menyalakan/mematikan cap. Cap TIDAK dihapus - yang mati tetap terlihat dan dapat dinyalakan lagi. */
export async function setelAktifCap(
  db: AletaDatabase,
  id: string,
  aktif: boolean,
  aktor: { id: string; nama: string },
): Promise<HasilUbahCap> {
  const ada = await db
    .prepare("SELECT id FROM aleta_ecourt_cap WHERE id = ?")
    .get(id);
  if (!ada) return { ok: false, alasan: "cap_tidak_ditemukan" };
  await db
    .prepare(
      "UPDATE aleta_ecourt_cap SET aktif = ?, diubah_pada = ? WHERE id = ?",
    )
    .run(aktif ? 1 : 0, new Date().toISOString(), id);
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: aktor.id,
    action: aktif ? "CAP_PENETAPAN_NYALAKAN" : "CAP_PENETAPAN_MATIKAN",
    entityType: "aleta_ecourt_cap",
    entityId: id,
    payload: { lewat: "ALETA" },
  });
  return { ok: true, id };
}

/**
 * Cap untuk satu jenis: yang dipilih tegas (capId) bila aktif; selain itu cap
 * aktif TERBARU dengan peruntukan jenis itu; selain itu cap "umum" terbaru.
 */
export async function pilihCap(
  db: AletaDatabase,
  jenis: JenisPenetapan,
  capId?: string | null,
): Promise<(BarisCap & { isi: Buffer }) | null> {
  const semua = await daftarCap(db, { hanyaAktif: true });
  const terbaru = (a: BarisCap, b: BarisCap) =>
    a.diubahPada < b.diubahPada ? 1 : -1;
  let pilih: BarisCap | undefined;
  if (capId) pilih = semua.find((c) => c.id === capId);
  if (!pilih)
    pilih = semua
      .filter((c) => c.peruntukan === PERUNTUKAN_UNTUK_JENIS[jenis])
      .sort(terbaru)[0];
  if (!pilih)
    pilih = semua.filter((c) => c.peruntukan === "umum").sort(terbaru)[0];
  // 20 Okt 2026 (butir 5): cap adalah cap KANTOR - satu cap yang sama dipakai
  // Ketua, Panitera, dan hakim. Peruntukan hanya urutan pilihan: bila tidak ada
  // yang khusus maupun "umum" (mis. hanya cap Panitera yang pernah diunggah),
  // PMH tidak boleh terbit tanpa cap - dipakai cap aktif terbaru yang ada.
  if (!pilih) pilih = semua.slice().sort(terbaru)[0];
  if (!pilih) return null;
  const g = await gambarCap(db, pilih.id);
  if (!g) return null;
  // Cap berlatar pekat dibersihkan lebih dulu; kalau tidak, tanda tangan
  // berlatar pekat menutupinya (cap dibubuhkan di belakang) - lihat cap-latar-transparan.
  const bening = await pastikanCapBening(Buffer.from(g.isi)).catch(() => null);
  return bening ? { ...pilih, isi: bening.isi, jenisBerkas: bening.jenis } : { ...pilih, isi: g.isi };
}

// ---------------------------------------------------------------------------
// Peta dan unggah - lewat bot
// ---------------------------------------------------------------------------

export type JenisPeta = {
  jenis: JenisPenetapan;
  judul: string;
  tersedia: boolean;
  alasan: string;
  alamatDisetel: boolean;
  adaPenetapan: boolean;
  sudahDiunggah: boolean;
  jumlahDiunggah: number;
  terakhirDiunggah: string;
  blangko: {
    sumber: string;
    menu: string;
    berkas: string;
    bagianGabungan: number;
    /** I9 17 Okt: berkas cadangan bila berkas tunggal tidak ada di ABT (PPP/PJS: gabungan "@ 0"). */
    cadangan?: string;
    /** I9 17 Okt: varian pilihan tangan (PHS: "sita-dikabulkan" -> "@ 2a ...", "sita-ditolak" -> "@ 2b ..."). */
    varian?: Record<string, string>;
  };
  penandatangan: string;
};

export type JawabanPeta = {
  ok: boolean;
  alasan?: string;
  /** bersita (I9 17 Okt): petitum perkara memohon sita (bot); null/tak ada = tidak terbaca. */
  perkara?: { perkaraId: number; nomorPerkara: string; bersita?: boolean | null };
  jenis?: JenisPeta[];
  /** Penyedia TTE elektronik disetel di bot (ALETA_TTE_PENETAPAN_URL). */
  tteElektronik?: boolean;
};

export async function petaEdoc({
  nomor,
  perkaraId,
}: {
  nomor: string;
  perkaraId?: string;
}): Promise<HasilBot<JawabanPeta>> {
  const q = new URLSearchParams();
  if (nomor) q.set("nomor", nomor);
  if (perkaraId) q.set("perkaraId", perkaraId);
  return panggilBot<JawabanPeta>(`/penetapan-edoc/peta?${q.toString()}`);
}

export type JawabanUnggah = {
  ok: boolean;
  alasan?: string;
  sebagian?: boolean;
  kering?: boolean;
  perkara?: { perkaraId: number; nomorPerkara: string };
  tte?: { elektronik: boolean; passphraseDibuang: boolean };
  akunSipp?: { username: string; terpetakan: boolean };
  hasil?: Array<{
    jenis: string;
    sumber: string;
    ok: boolean;
    alasan?: string;
    langkah?: string;
    jalur?: string;
    tandaTangan?: { id: number; namaPejabat: string; sumber: string } | null;
    cap?: { id: string; nama: string; diBelakang?: boolean } | null;
    penandaTangan?: { label: string; nama: string } | null;
    peringatan?: Array<{ kode: string; nama?: string }>;
    gambarBawaan?: { dibuang: number; uraian: string[] };
    berkas?: string;
    tte?: boolean;
    catatan?: string;
  }>;
};

export async function unggahEdoc(badan: {
  nomorPerkara: string;
  perkaraId?: string;
  jenis: JenisPenetapan[];
  manual: Array<{ jenis: JenisPenetapan; isiBase64: string }>;
  /** RTF blangko ABT yang dicetak ekstensi (butir 17, 6 Okt). */
  abt?: Array<{ jenis: JenisPenetapan; isiBase64: string; berkas: string }>;
  /** Pengaturan peta penetapan per jenis (aturUntukBot). */
  atur?: Partial<Record<JenisPenetapan, Record<string, unknown>>>;
  otomatis?: boolean;
  cap: Partial<
    Record<
      JenisPenetapan,
      { id: string; nama: string; jenis: string; isiBase64: string }
    >
  >;
  penggunaId: string;
  operator: string;
  olehUsername: string;
  ip: string;
  passphrase?: string;
  nik?: string;
  kering: boolean;
}): Promise<HasilBot<JawabanUnggah>> {
  return panggilBot<JawabanUnggah>("/penetapan-edoc/unggah", {
    method: "POST",
    body: badan,
    // soffice per jenis + TTE: sama panjang dengan aksi peramban.
    batasMs: BATAS_PERAMBAN_MS,
  });
}

export const KALIMAT_EDOC: Record<string, string> = {
  fitur_belum_tersedia_di_server:
    "Fitur ini belum tersedia di server (ALETA Bot belum diperbarui).",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
  bot_tidak_menjawab_tepat_waktu:
    "ALETA Bot tidak menjawab tepat waktu. Coba lagi sebentar lagi.",
  perkara_tidak_ditemukan: "Perkara tidak ditemukan di SIPP.",
  blangko_belum_dinyalakan:
    "Blangko penetapan ABT belum dinyalakan di pengaturan ALETA.",
  tidak_ada_jenis_dipilih:
    "Belum ada jenis penetapan yang dipilih atau berkas manual yang diunggah.",
  akun_sipp_tidak_terkirim:
    "Akun SIPP yang sedang login tidak terbaca - buka dari halaman SIPP yang sudah login.",
  tte_belum_tersambung:
    "TTE elektronik belum tersambung di server ALETA - dipakai gambar tanda tangan pejabat + cap.",
  berkas_terlalu_besar: "Berkas melampaui 20 MB.",
  bentuk_tidak_dikenali: "Berkas bukan PDF, RTF, DOC, maupun DOCX.",
  soffice_tidak_ada: "Pengubah dokumen (LibreOffice) tidak ada di server, jadi DOC/DOCX belum dapat diproses.",
  nik_penandatangan_kosong: "NIK penanda tangan untuk TTE elektronik belum diisi.",
  cap_belum_ada:
    "Belum ada cap aktif untuk jenis ini. Unggah cap di ALETA e-Court > Berkas tanda tangan > Cap.",
  tanda_tangan_sah_tidak_ada_untuk_nama_di_dokumen:
    "Tanda tangan sah untuk pejabat yang namanya tertulis di dokumen belum ada. Unggah/sahkan di Berkas tanda tangan.",
  nama_pejabat_tidak_ada_di_blangko:
    "Nama pejabat penanda tangan tidak ditemukan di dokumen.",
  konfirmasi_belum_diberikan: "Tindakan belum dikonfirmasi.",
  // Perbaikan 6 Okt (butir 17-20).
  jawaban_abt_bukan_rtf: "Yang dicetak ABT bukan RTF (sesi ABT habis atau blangko tidak ditemukan).",
  ditahan_tanpa_tanda_tangan:
    "Ditahan: tanda tangan penanda tangan belum ada, dan peta penetapan diatur menahan dokumen tanpa tanda tangan.",
  otomatis_unggah_mati:
    "Unggah otomatis untuk jenis ini dimatikan di Peta penetapan (Integrasi e-Court) - tidak ada yang ditulis.",
  blangko_jenis_belum_dipetakan: "Jenis penetapan ini belum dipetakan ke blangko ABT di Peta penetapan.",
};

export function kalimatEdoc(kode: string | undefined | null): string {
  const k = String(kode || "");
  if (!k) return "";
  if (KALIMAT_EDOC[k]) return KALIMAT_EDOC[k];
  if (/^alamat_blangko_(\w+)_belum_disetel$/.test(k))
    return `Alamat blangko ABT untuk ${k.split("_")[2].toUpperCase()} belum disetel.`;
  if (/^penetapan_(\w+)_belum_ada_di_sipp$/.test(k))
    return `Penetapan ${k.split("_")[1].toUpperCase()} belum ada di SIPP.`;
  if (/^blangko_tidak_memuat_(\w+)$/.test(k))
    return `Dokumen dari ABT tidak memuat ${k.split("_")[3].toUpperCase()}.`;
  return k.replace(/_/g, " ");
}
