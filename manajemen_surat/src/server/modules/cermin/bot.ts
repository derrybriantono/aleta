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

/** Antarmuka bot yang dipakai pemindai; uji menggantinya. */
export type BotCermin = {
  ringkasan: () => Promise<HasilBotCermin<RingkasanSumber>>;
  perkara: (setelahId: number, batas: number) => Promise<HasilBotCermin<KelompokPerkara>>;
  sidang: (dari: string, sampai: string) => Promise<HasilBotCermin<JendelaSidang>>;
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
export const botCerminAsli: BotCermin = {
  ringkasan: () => panggilBotCermin<RingkasanSumber>("/ringkasan", 30_000),
  perkara: (setelahId, batas) =>
    panggilBotCermin<KelompokPerkara>(`/perkara?setelahId=${encodeURIComponent(String(setelahId))}&batas=${encodeURIComponent(String(batas))}`),
  sidang: (dari, sampai) =>
    panggilBotCermin<JendelaSidang>(`/sidang?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`, 90_000),
};
