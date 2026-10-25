/**
 * Panggilan portal ke rute bot Cermin Perkara (/internal/aleta-bot/cermin).
 *
 * Semuanya GET dan HANYA MEMBACA SIPP (aleta_bot/services/cerminService.js).
 * Berkas sendiri, pola yang sama dengan jadwal-sidang-gateway.ts: alamat dan
 * token internal dari env yang sama. Fungsi `Bot` disuntikkan ke pemindai
 * supaya uji dapat menggantinya tanpa jaringan.
 */

export type HasilBotCermin<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export type RingkasanSumber = {
  perkara: { jumlah: number; terkecil: number; terbesar: number };
  sidang: { jumlah: number; awal: string; akhir: string };
  hariIni: string;
};

export type PerkaraSumber = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkaraId: number | null;
  jenisPerkaraNama: string;
  alurPerkaraId: number | null;
  tanggalPendaftaran: string;
  prodeo: number;
  tahapanTerakhirId: number | null;
  tahapanTerakhirText: string;
  prosesTerakhirId: number | null;
  prosesTerakhirText: string;
  majelisHakim: string;
  paniteraPengganti: string;
  jurusita: string;
  sidangPertama: string;
  sidangTerakhir: string;
  sidangBerikut: string;
  jumlahSidang: number;
  tanggalPutusan: string;
  statusPutusan: string;
  putusanVerstek: number;
  tanggalMinutasi: string;
  tanggalBht: string;
  /** A5: tanggal dasar lingkup Status Perkara. Bot lama tidak mengirimnya (jatuh ke kosong). */
  sidangMaks?: string;
  tanggalAkta?: string;
  tanggalRelaas?: string;
  tanggalIkrar?: string;
  sippDiperbarui: string;
};

export type KelompokPerkara = { perkara: PerkaraSumber[]; terakhirId: number; habis: boolean };

export type SidangSumber = {
  sidangId: string;
  perkaraId: string;
  tanggalSidang: string;
  jamSidang: string;
  ruangan: string;
  agenda: string;
  ditunda: number;
  sippDiperbarui: string;
  /** Keluaran daftarSidang apa adanya. */
  baris: Record<string, unknown>;
};

export type JendelaSidang = { dari: string; sampai: string; terpotong: boolean; sidang: SidangSumber[] };

/** Satu pertemuan mediasi = keluaran daftarJadwalMediasi apa adanya. */
export type MediasiSumber = Record<string, unknown> & { mediasiId?: string; perkaraId?: string; tanggal?: string; jam?: string; nomorPerkara?: string };
export type JendelaMediasi = {
  dari: string;
  sampai: string;
  terbaca: boolean;
  alasan: string;
  terpotong: boolean;
  mediasi: MediasiSumber[];
};

export type KatalogTagSumber = {
  tag: Array<{ kunci: string; label: string; kelompok: string; nada: string; judul: string; balik: boolean }>;
  kelompok: Array<{ kunci: string; label: string }>;
  dasar: Array<{ kunci: string; label: string }>;
  batasId: number;
};
export type PerkaraTagSumber = { kunci: string; perkaraId: string[]; terpotong: boolean };

export type PerubahanSumber = {
  sejak: string;
  /** Waktu SIPP terakhir yang termuat; pembaruan berikutnya mulai dari sini (dikurangi tumpang tindih). */
  tandaBaru: string;
  terpotong: boolean;
  jumlahTersentuh: number;
  perkaraId: string[];
  tanggalSidang: string[];
  tidakTerbaca: Array<{ tabel: string; sebab: string }>;
};

export type IdPerkaraSumber = { perkara: Array<{ perkaraId: string; waktu: string }>; terakhirId: number; habis: boolean };

export type IdSidangSumber = {
  dari: string;
  sampai: string;
  sidang: Array<{ sidangId: string; perkaraId: string; tanggalSidang: string; waktu: string }>;
};

/** Antarmuka bot yang dipakai pemindai awal; uji menggantinya. */
export type BotCermin = {
  ringkasan: () => Promise<HasilBotCermin<RingkasanSumber>>;
  perkara: (setelahId: number, batas: number) => Promise<HasilBotCermin<KelompokPerkara>>;
  sidang: (dari: string, sampai: string) => Promise<HasilBotCermin<JendelaSidang>>;
};

/** Ditambah rute pembaruan berkala dan pencocokan mingguan. */
export type BotCerminLengkap = BotCermin & {
  perkaraId: (id: string[]) => Promise<HasilBotCermin<{ perkara: PerkaraSumber[] }>>;
  perubahan: (sejak: string, batas: number) => Promise<HasilBotCermin<PerubahanSumber>>;
  idPerkara: (setelahId: number, batas: number) => Promise<HasilBotCermin<IdPerkaraSumber>>;
  idSidang: (dari: string, sampai: string) => Promise<HasilBotCermin<IdSidangSumber>>;
  /** A5: pertemuan mediasi satu jendela tanggal. */
  mediasi: (dari: string, sampai: string) => Promise<HasilBotCermin<JendelaMediasi>>;
  /** A5: katalog tag dan anggota tiap tag atas seluruh register. */
  tagKatalog: () => Promise<HasilBotCermin<KatalogTagSumber>>;
  tagPerkara: (kunci: string) => Promise<HasilBotCermin<PerkaraTagSumber>>;
};

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotCermin<T>(jalur: string, timeoutMs = 60_000): Promise<HasilBotCermin<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), timeoutMs);
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/cermin${jalur}`, {
      method: "GET",
      headers: kepala,
      signal: pengendali.signal,
      cache: "no-store",
    });
    const teks = await jawaban.text();
    let isi: Record<string, unknown>;
    try {
      isi = JSON.parse(teks) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: jawaban.status,
        error:
          jawaban.status === 404
            ? "ALETA Bot belum punya rute Cermin Perkara - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    if (!jawaban.ok || isi.ok === false) {
      return { ok: false, status: jawaban.status, error: String(isi.error || isi.message || `HTTP ${jawaban.status}`) };
    }
    return { ok: true, data: isi as T };
  } catch (galat) {
    return {
      ok: false,
      error:
        galat instanceof Error && galat.name === "AbortError"
          ? "ALETA Bot tidak menjawab dalam batas waktu."
          : galat instanceof Error
            ? galat.message
            : "ALETA Bot belum dapat dihubungi.",
    };
  } finally {
    clearTimeout(penunda);
  }
}

/** Bot sungguhan lewat HTTP. */
export const botCerminAsli: BotCerminLengkap = {
  ringkasan: () => panggilBotCermin<RingkasanSumber>("/ringkasan", 30_000),
  perkara: (setelahId, batas) =>
    panggilBotCermin<KelompokPerkara>(`/perkara?setelahId=${encodeURIComponent(String(setelahId))}&batas=${encodeURIComponent(String(batas))}`),
  sidang: (dari, sampai) =>
    panggilBotCermin<JendelaSidang>(`/sidang?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`, 90_000),
  perkaraId: (id) => panggilBotCermin<{ perkara: PerkaraSumber[] }>(`/perkara-id?id=${encodeURIComponent(id.join(","))}`),
  perubahan: (sejak, batas) =>
    panggilBotCermin<PerubahanSumber>(`/perubahan?sejak=${encodeURIComponent(sejak)}&batas=${encodeURIComponent(String(batas))}`),
  idPerkara: (setelahId, batas) =>
    panggilBotCermin<IdPerkaraSumber>(`/id-perkara?setelahId=${encodeURIComponent(String(setelahId))}&batas=${encodeURIComponent(String(batas))}`),
  idSidang: (dari, sampai) =>
    panggilBotCermin<IdSidangSumber>(`/id-sidang?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`),
  mediasi: (dari, sampai) =>
    panggilBotCermin<JendelaMediasi>(`/mediasi?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`, 90_000),
  tagKatalog: () => panggilBotCermin<KatalogTagSumber>("/tag-katalog", 20_000),
  tagPerkara: (kunci) => panggilBotCermin<PerkaraTagSumber>(`/tag-perkara?kunci=${encodeURIComponent(kunci)}`, 120_000),
};
