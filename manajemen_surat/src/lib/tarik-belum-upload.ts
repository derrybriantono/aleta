/**
 * ============================================================================
 * PENANDA "BELUM UPLOAD" DAPAT DITEKAN - TARIK ULANG E-COURT SATU PERKARA
 * (7 Okt 2026)
 * ============================================================================
 *
 * Penanda jingga "belum upload" (penanda-verifikasi-ecourt.ts) dibaca dari
 * simpanan bot yang ditarik berkala tiap 15 menit. Pihak dapat mengunggah
 * dokumennya kapan saja di antara dua tarikan, dan majelis yang menunggu di
 * ruang sidang tidak patut menunggu 15 menit untuk tahu.
 *
 * Ditekan -> bot menarik ulang e-Court HANYA untuk perkara itu (jembatan yang
 * sama dengan penarikan berkala, --perkara, berkas baru ikut diunduh ke arsip
 * ALETA) -> layar menanyakan hasilnya tiap beberapa detik -> keadaan baris
 * itu diganti dengan yang baru, tanpa memuat ulang tabel.
 *
 * Penjagaan terhadap banjir ke e-Court ada di BOT, bukan di sini - di sini
 * hanya kunci per tab (satu tarikan berjalan per perkara di layar ini):
 *   - dua pengguna menekan bersamaan -> tarikan yang kedua bergabung;
 *   - jeda per perkara (bawaan 60 dtk) sesudah selesai -> hasil terakhir;
 *   - penarikan lain sedang berjalan / akun e-Court tanpa sesi -> sebabnya.
 */

import type { VerifikasiPerkara } from "@/lib/penanda-verifikasi-ecourt";

/** Selang menanyakan hasil ke bot. */
export const JEDA_TANYA_MS = 3000;
/**
 * Batas menunggu di layar. Bot sendiri membunuh tarikan satu perkara sesudah
 * 5 menit (BATAS_TARIK_PERKARA_MS); layar menunggu sedikit lebih lama supaya
 * sebab dari bot yang terbaca, bukan sekadar "melewati batas".
 */
export const BATAS_TUNGGU_MS = 6 * 60 * 1000;
/** Berapa kali berturut-turut bot boleh tidak menjawab sebelum menyerah. */
const BATAS_TAK_MENJAWAB = 3;

export type DokumenBaru = { judul: string; peran?: string; diunggahPada?: string };

/**
 * Butir 8 (1.189.x): kemajuan NYATA dari bot (aleta_bot/services/ecourtKemajuanTarik):
 * tahap yang sungguh dikerjakan jembatan + persen yang dihitung dari tahap itu.
 */
export type KemajuanBot = {
  tahap: string;
  label?: string;
  persen: number;
  i?: number;
  n?: number;
  judul?: string;
  teks?: string;
};

/** Tarikan menurut bot (ecourtVerifikasiHarianService.tarikSekarang). */
export type TarikanBot = {
  id?: string;
  nomorPerkara: string;
  status: "berjalan" | "selesai" | "gagal" | "sesi-habis" | "sibuk" | "ditolak" | "terputus";
  mulai?: string;
  selesai?: string;
  pesan?: string;
  alasan?: string;
  dokumenBaru?: DokumenBaru[];
  berkasBaru?: number;
  perkara?: VerifikasiPerkara | null;
  kemajuan?: KemajuanBot | null;
};

/** Keadaan yang digambar di samping penanda. */
export type KeadaanTarik = {
  tahap: "berjalan" | "selesai" | "jeda" | "masalah";
  pesan: string;
  dokumenBaru: string[];
  /** Butir 8: persen 0..100 dari tahap nyata bot (tanpa = belum dilaporkan). */
  persen?: number;
  /** Butir 8: nama tahap nyata ("Mengunduh berkas 2/5"). */
  langkah?: string;
};

/** Persen + nama tahap dari kemajuan bot - murni; tanpa kemajuan = {}. */
export function dariKemajuan(k: KemajuanBot | null | undefined): { persen?: number; langkah?: string } {
  if (!k || typeof k !== "object") return {};
  const persen = Number(k.persen);
  if (!Number.isFinite(persen)) return {};
  return { persen: Math.max(0, Math.min(100, Math.round(persen))), langkah: String(k.teks || k.label || "").trim() };
}

export type HasilTarik = KeadaanTarik & { perkara: VerifikasiPerkara | null };

export const PESAN_MEMERIKSA = "Memeriksa e-Court...";

/** Kunci per perkara - huruf besar tanpa spasi (sama dengan penanda-verifikasi-ecourt). */
export function kunciTarik(nomorPerkara: string): string {
  return String(nomorPerkara || "").replace(/\s+/g, "").toUpperCase();
}

function jamDari(waktu: string | undefined): string {
  const c = /[ T](\d{2}):(\d{2})/.exec(String(waktu || ""));
  return c ? `${c[1]}.${c[2]}` : "";
}

/** Tarikan bot yang sudah berakhir -> keadaan layar. */
export function hasilDariTarikan(t: TarikanBot): HasilTarik {
  const dokumenBaru = (t.dokumenBaru ?? []).map((d) => d.judul).filter(Boolean);
  if (t.status === "selesai") {
    const jam = jamDari(t.selesai);
    const pesan =
      t.pesan ||
      (dokumenBaru.length > 0
        ? `${dokumenBaru.length} dokumen baru: ${dokumenBaru.join(", ")}`
        : `Tidak ada dokumen baru${jam ? ` (diperiksa ${jam})` : ""}`);
    return { tahap: "selesai", pesan, dokumenBaru, perkara: t.perkara ?? null, ...dariKemajuan(t.kemajuan), persen: 100 };
  }
  if (t.status === "berjalan") {
    const k = dariKemajuan(t.kemajuan);
    return { tahap: "berjalan", pesan: k.langkah ? `${k.langkah}...` : PESAN_MEMERIKSA, dokumenBaru: [], perkara: null, ...k };
  }
  const bawaan: Record<string, string> = {
    "sesi-habis": "Sesi e-Court habis - minta admin masuk ulang di menu Integrasi e-Court, lalu tekan lagi.",
    sibuk: "Penarikan e-Court lain sedang berjalan - coba lagi sebentar lagi.",
    gagal: "Penarikan e-Court gagal.",
    ditolak: "Tarikan ditolak bot.",
    terputus: "ALETA Bot dinyalakan ulang saat penarikan berjalan - tekan lagi.",
  };
  return {
    tahap: "masalah",
    pesan: t.pesan || bawaan[t.status] || "Penarikan e-Court tidak selesai.",
    dokumenBaru,
    perkara: null,
    // Garis berhenti di persen terakhirnya - di situlah macetnya.
    ...dariKemajuan(t.kemajuan),
  };
}

type Ambil = (alamat: string, init?: RequestInit) => Promise<Response>;

/** Membaca jawaban portal {ok, data} - bungkusnya DIBUKA (penjaga jawaban-portal-dibuka). */
async function bacaData(jawaban: Response): Promise<Record<string, unknown>> {
  try {
    const isi = (await jawaban.json())?.data;
    return (isi && typeof isi === "object" ? isi : {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Jawaban portal {ok, data} DIBUKA sekali: isi `data` beserta pesan
 * penolakan server ({ error: { message } }) - tanpa memulangkan bungkusnya.
 */
async function bacaJawaban(jawaban: Response): Promise<{ data: Record<string, unknown>; pesanServer: string }> {
  try {
    const luar = (await jawaban.json()) as { data?: unknown; error?: { message?: unknown } } | null;
    const isi = luar && typeof luar === "object" ? luar.data : null;
    const pesan = luar && typeof luar === "object" ? luar.error?.message : undefined;
    return {
      data: (isi && typeof isi === "object" ? isi : {}) as Record<string, unknown>,
      pesanServer: typeof pesan === "string" ? pesan.trim() : "",
    };
  } catch {
    return { data: {}, pesanServer: "" };
  }
}

/**
 * Penolakan oleh portal sendiri: sesi habis (401) atau tanpa kewenangan (403).
 * Pesan server ({ error: { message } }) dipakai bila ada.
 */
function pesanPenolakanPortal(status: number, dariServer: string): string {
  if (status !== 401 && status !== 403) return "";
  if (status === 401) {
    return `Sesi ALETA Anda berakhir${dariServer ? ` (${dariServer})` : ""} - masuk ulang ke portal, lalu tekan lagi.`;
  }
  return dariServer || "Akun Anda tidak berwenang memeriksa e-Court dari layar ini.";
}

function pesanBotMati(data: Record<string, unknown>): string {
  const sebab = String(data.pesan || data.alasan || "").trim();
  return `ALETA Bot tidak tersambung${sebab ? ` (${sebab})` : ""} - e-Court tidak dapat diperiksa sekarang.`;
}

/**
 * Menarik ulang e-Court untuk satu perkara dan menunggu hasilnya.
 * Tidak pernah melempar: tiap kegagalan berakhir sebagai tahap "masalah"
 * dengan sebabnya.
 */
export async function tarikBelumUpload({
  nomorPerkara,
  tanggal,
  alamat,
  ambil = (a, i) => fetch(a, i),
  tunggu = (ms) => new Promise((selesai) => setTimeout(selesai, ms)),
  sekarang = () => Date.now(),
  batasTungguMs = BATAS_TUNGGU_MS,
  padaKemajuan,
}: {
  nomorPerkara: string;
  tanggal: string;
  /** Alamat rute /api/aleta-ecourt/sidang/verifikasi-ecourt/tarik (dibungkus apiPath oleh pemanggil). */
  alamat: string;
  ambil?: Ambil;
  tunggu?: (ms: number) => Promise<unknown>;
  sekarang?: () => number;
  batasTungguMs?: number;
  /** Butir 8: dipanggil tiap kali bot melaporkan tahap/persen baru selama berjalan. */
  padaKemajuan?: (k: KeadaanTarik) => void;
}): Promise<HasilTarik> {
  const lapor = (t: TarikanBot | null) => {
    if (!padaKemajuan || !t || t.status !== "berjalan") return;
    const { perkara: _abaikan, ...tampil } = hasilDariTarikan(t);
    void _abaikan;
    try {
      padaKemajuan(tampil);
    } catch {
      // Penggambar yang rusak tidak menghentikan tarikan.
    }
  };
  const mulai = sekarang();
  let data: Record<string, unknown>;
  try {
    const jawaban = await ambil(alamat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomorPerkara, tanggal }),
      cache: "no-store",
    });
    const dibuka = await bacaJawaban(jawaban);
    data = dibuka.data;
    if (!jawaban.ok && data.available === undefined) {
      // 401/403 berasal dari PORTAL, bukan dari bot (U5, 9 Okt 2026): dulu
      // keduanya terbaca "ALETA Bot tidak tersambung (HTTP 401)".
      const pesanPortal = pesanPenolakanPortal(jawaban.status, dibuka.pesanServer);
      if (pesanPortal) return { tahap: "masalah", pesan: pesanPortal, dokumenBaru: [], perkara: null };
      return { tahap: "masalah", pesan: pesanBotMati({ pesan: `HTTP ${jawaban.status}` }), dokumenBaru: [], perkara: null };
    }
  } catch (e) {
    return { tahap: "masalah", pesan: pesanBotMati({ pesan: e instanceof Error ? e.message : "" }), dokumenBaru: [], perkara: null };
  }
  if (data.available === false) return { tahap: "masalah", pesan: pesanBotMati(data), dokumenBaru: [], perkara: null };

  const tarikanAwal = (data.tarikan ?? null) as TarikanBot | null;
  if (data.ok === false) {
    return {
      tahap: "masalah",
      pesan: String(data.pesan || tarikanAwal?.pesan || "Tarikan ditolak bot."),
      dokumenBaru: [],
      perkara: null,
    };
  }

  // Masih dalam jeda per perkara: hasil terakhirnya yang dijawab.
  if (data.jeda === true && tarikanAwal) {
    const akhir = hasilDariTarikan(tarikanAwal);
    const sisa = Number(data.sisaDetik) || 0;
    const jam = jamDari(tarikanAwal.selesai);
    return {
      ...akhir,
      tahap: "jeda",
      pesan: `${akhir.pesan}${jam && !akhir.pesan.includes(jam) ? ` (diperiksa ${jam})` : ""}. Dapat diperiksa lagi dalam ${sisa} dtk.`,
    };
  }

  if (tarikanAwal && tarikanAwal.status !== "berjalan") return hasilDariTarikan(tarikanAwal);
  lapor(tarikanAwal);

  let takMenjawab = 0;
  const alamatTanya = `${alamat}?nomorPerkara=${encodeURIComponent(nomorPerkara)}`;
  for (;;) {
    await tunggu(JEDA_TANYA_MS);
    if (sekarang() - mulai > batasTungguMs) {
      return {
        tahap: "masalah",
        pesan: `e-Court belum selesai dibaca dalam ${Math.round(batasTungguMs / 60000)} menit - hasilnya muncul sendiri saat jadwal disegarkan.`,
        dokumenBaru: [],
        perkara: null,
      };
    }
    let isi: Record<string, unknown> = {};
    let terjawab = false;
    try {
      const jawaban = await ambil(alamatTanya, { cache: "no-store" });
      isi = await bacaData(jawaban);
      terjawab = jawaban.ok && isi.available !== false;
    } catch {
      terjawab = false;
    }
    if (!terjawab) {
      takMenjawab += 1;
      if (takMenjawab >= BATAS_TAK_MENJAWAB) {
        return { tahap: "masalah", pesan: pesanBotMati(isi), dokumenBaru: [], perkara: null };
      }
      continue;
    }
    takMenjawab = 0;
    const t = (isi.tarikan ?? null) as TarikanBot | null;
    if (!t) {
      // Bot dinyalakan ulang di tengah tarikan - catatan dalam memorinya hilang.
      return {
        tahap: "masalah",
        pesan: "ALETA Bot dinyalakan ulang di tengah pemeriksaan - tekan lagi.",
        dokumenBaru: [],
        perkara: null,
      };
    }
    if (t.status === "berjalan") {
      lapor(t);
      continue;
    }
    return hasilDariTarikan(t);
  }
}

/**
 * Menimpa keadaan SATU perkara di data verifikasi tanpa menyentuh yang lain.
 * Entri lama dicari menurut kunci nomor (penulisan bot dapat berbeda spasi).
 */
export function gantiPerkaraVerifikasi<T extends { perkara: Record<string, VerifikasiPerkara> }>(
  data: T,
  baru: VerifikasiPerkara
): T {
  const k = kunciTarik(baru.nomorPerkara);
  const perkara: Record<string, VerifikasiPerkara> = {};
  for (const [nomor, item] of Object.entries(data.perkara)) {
    if (kunciTarik(item.nomorPerkara || nomor) !== k) perkara[nomor] = item;
  }
  perkara[baru.nomorPerkara] = baru;
  return { ...data, perkara };
}
