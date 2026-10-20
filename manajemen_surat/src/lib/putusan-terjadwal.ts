/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - ATURAN MURNI (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Permintaan hakim: pilih perkara (satu dari halaman perkara SIPP, atau banyak
 * menurut tanggal), seret berkas putusannya, pilih jam, lalu ALETA yang
 * mengerjakan pada waktunya - isi & simpan Putusan Akhir, e-Doc putusan, e-Doc
 * anonimisasi - dengan jeda yang MANUSIAWI antar perkara.
 *
 * Berkas ini hanya HITUNGAN (tanpa basis data, tanpa jaringan, tanpa jam
 * dinding): susunan jadwal dengan jeda acak, jendela jam kerja, status butir,
 * dan kalimat untuk petugas. Dipakai pelaksana server, rute portal, dan diuji
 * langsung. Tidak ada yang ditulis ke SIPP dari sini.
 *
 * JAM. Semua waktu yang dilihat petugas adalah WITA (jam dinding satker,
 * UTC+8 tanpa musim panas), ditulis "YYYY-MM-DD HH:mm". Yang disimpan di basis
 * data ISO UTC ("2026-10-21T00:15:42.000Z") supaya dapat dibandingkan sebagai
 * teks.
 */

import { hariLibur } from "@/lib/hari-libur";

export const OFFSET_WITA_MS = 8 * 3600 * 1000;

/** Tiga langkah satu butir. "isi" dikerjakan peramban; dua e-Doc dikerjakan server. */
export const LANGKAH_TERJADWAL = ["isi", "putusan", "anonim"] as const;
export type LangkahTerjadwal = (typeof LANGKAH_TERJADWAL)[number];

export const NAMA_LANGKAH: Record<LangkahTerjadwal, string> = {
  isi: "Isi & simpan Putusan Akhir",
  putusan: "e-Doc putusan",
  anonim: "e-Doc anonimisasi",
};

/** Keadaan satu langkah. */
export const STATUS_LANGKAH = ["tidak", "menunggu", "jalan", "selesai", "dilewati", "tertahan", "gagal", "batal"] as const;
export type StatusLangkah = (typeof STATUS_LANGKAH)[number];

/** Keadaan satu butir (satu perkara). */
export const STATUS_BUTIR = ["menunggu", "jalan", "selesai", "sebagian", "gagal", "dibatalkan"] as const;
export type StatusButir = (typeof STATUS_BUTIR)[number];

export const NAMA_STATUS_BUTIR: Record<StatusButir, string> = {
  menunggu: "menunggu",
  jalan: "sedang dikerjakan",
  selesai: "selesai",
  sebagian: "selesai sebagian",
  gagal: "gagal",
  dibatalkan: "dibatalkan",
};

/** Bentuk berkas yang diterima (dikenali dari kepala berkas, bukan dari nama). */
export const BENTUK_TERIMA = ["rtf", "docx", "doc", "pdf"] as const;
export type BentukTerima = (typeof BENTUK_TERIMA)[number];

export const BATAS = {
  /** Satu berkas putusan (RTF/DOCX/DOC/PDF). Sama dengan batas unggah-sipp. */
  ukuranBerkas: 10 * 1024 * 1024,
  /** Butir dalam satu jadwal. */
  butirPerJadwal: 200,
  /** Jeda antar perkara (detik): bawaan 2-7 menit, tidak boleh di bawah 30 detik. */
  jedaTerpendek: 30,
  jedaTerpanjang: 3600,
  jedaMinBawaan: 120,
  jedaMaksBawaan: 420,
  /** Berkas dihapus N hari sesudah butirnya selesai (pengaturan). */
  hapusHariBawaan: 7,
  hapusHariTerlama: 90,
  /** Berkas yang diunggah tetapi tak pernah dijadwalkan dibuang sesudah ini (jam). */
  tahapJam: 24,
  /** Masa pegang satu butir oleh pelaksana (detik); lewat dari ini dianggap macet. */
  masaPegangDetik: 600,
  /** Berapa kali butir yang tertahan sebab sementara diulang sebelum dinyatakan gagal. */
  percobaanMaks: 4,
  /** Butir yang belum dikerjakan sampai sekian hari sesudah jam rencananya dinyatakan kedaluwarsa (tidak dikerjakan diam-diam). */
  kedaluwarsaHari: 3,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Waktu WITA <-> epoch
// ──────────────────────────────────────────────────────────────────────────

const p2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD HH:mm[:ss]" WITA -> milidetik UTC; NaN bila tidak sah. */
export function witaKeMs(teks: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(teks ?? "").trim());
  if (!m) return Number.NaN;
  const [t, b, h, j, mn, d] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0)];
  if (b < 1 || b > 12 || h < 1 || h > 31 || j > 23 || mn > 59 || d > 59) return Number.NaN;
  const ms = Date.UTC(t, b - 1, h, j, mn, d) - OFFSET_WITA_MS;
  // Menolak 31 Februari dll.: tanggal hasil harus sama dengan yang ditulis.
  const balik = msKeWita(ms);
  return balik.slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? ms : Number.NaN;
}

/** Milidetik UTC -> "YYYY-MM-DD HH:mm:ss" WITA. */
export function msKeWita(ms: number): string {
  const d = new Date(ms + OFFSET_WITA_MS);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

export const isoDariMs = (ms: number) => new Date(ms).toISOString();

/** ISO UTC (atau apa pun yang dapat dibaca Date) -> milidetik, NaN bila tidak sah. */
export function msDariIso(iso: string): number {
  const ms = Date.parse(String(iso ?? ""));
  return Number.isFinite(ms) ? ms : Number.NaN;
}

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "Rabu, 21 Oktober 2026 pukul 09.15" dari milidetik UTC. */
export function sebutWaktuWita(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  const w = msKeWita(ms);
  const hari = new Date(ms + OFFSET_WITA_MS).getUTCDay();
  return `${NAMA_HARI[hari]}, ${Number(w.slice(8, 10))} ${NAMA_BULAN[Number(w.slice(5, 7)) - 1]} ${w.slice(0, 4)} pukul ${w.slice(11, 13)}.${w.slice(14, 16)}`;
}

/** Hari dalam pekan (0 Minggu .. 6 Sabtu) tanggal "YYYY-MM-DD". */
export function hariPekan(tanggal: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : Number.NaN;
}

export function tambahHariTanggal(tanggal: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
  if (!m) return tanggal;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Jam kerja satker
// ──────────────────────────────────────────────────────────────────────────

export type JamKerja = {
  /** "HH:mm" WITA. */
  dari: string;
  sampai: string;
  /** Istirahat (tidak ada butir di dalamnya); null = tanpa istirahat. */
  istirahatDari: string | null;
  istirahatSampai: string | null;
};

export const JAM_KERJA_BAWAAN = {
  biasa: { dari: "07:30", sampai: "16:00", istirahatDari: "12:00", istirahatSampai: "13:00" },
  jumat: { dari: "07:30", sampai: "16:30", istirahatDari: "11:30", istirahatSampai: "13:00" },
} as const;

const menitDari = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return Number.NaN;
  const j = +m[1];
  const mn = +m[2];
  return j > 23 || mn > 59 ? Number.NaN : j * 60 + mn;
};

export const hhmmSah = (hhmm: string) => Number.isFinite(menitDari(hhmm));

export type PilihanJamKerja = {
  /** Jendela harian pilihan petugas; kosong = jam kerja satker (Jumat lebih panjang). */
  dari?: string;
  sampai?: string;
  /** Hindari istirahat siang. Bawaan ya. */
  hindariIstirahat?: boolean;
  /** Di luar jam kerja (malam, Sabtu/Minggu, libur) - hanya bila dipilih tegas. */
  malamBoleh?: boolean;
};

/**
 * Jendela kerja pada satu tanggal WITA, atau null bila bukan hari kerja dan
 * malam tidak dibolehkan. `malamBoleh` = sepanjang hari (00:00-23:59), tanpa istirahat.
 */
export function jendelaHari(
  tanggal: string,
  pil: PilihanJamKerja = {},
  libur: (iso: string) => boolean = (iso) => hariLibur(iso)
): JamKerja | null {
  if (pil.malamBoleh) {
    const dari = pil.dari && hhmmSah(pil.dari) ? pil.dari : "00:00";
    const sampai = pil.sampai && hhmmSah(pil.sampai) ? pil.sampai : "23:59";
    return { dari, sampai, istirahatDari: null, istirahatSampai: null };
  }
  const hari = hariPekan(tanggal);
  if (!Number.isFinite(hari) || hari === 0 || hari === 6 || libur(tanggal)) return null;
  const baku = hari === 5 ? JAM_KERJA_BAWAAN.jumat : JAM_KERJA_BAWAAN.biasa;
  // Pilihan petugas hanya boleh MENYEMPITKAN jam kerja, tidak melebarkannya.
  const dariBaku = menitDari(baku.dari);
  const sampaiBaku = menitDari(baku.sampai);
  let dari = pil.dari && hhmmSah(pil.dari) ? Math.max(menitDari(pil.dari), dariBaku) : dariBaku;
  let sampai = pil.sampai && hhmmSah(pil.sampai) ? Math.min(menitDari(pil.sampai), sampaiBaku) : sampaiBaku;
  if (sampai <= dari) {
    dari = dariBaku;
    sampai = sampaiBaku;
  }
  const hindari = pil.hindariIstirahat !== false;
  const f = (menit: number) => `${p2(Math.floor(menit / 60))}:${p2(menit % 60)}`;
  return {
    dari: f(dari),
    sampai: f(sampai),
    istirahatDari: hindari ? baku.istirahatDari : null,
    istirahatSampai: hindari ? baku.istirahatSampai : null,
  };
}

/** Apakah saat itu (ms UTC) di dalam jendela kerja? */
export function dalamJendela(ms: number, pil: PilihanJamKerja = {}, libur?: (iso: string) => boolean): boolean {
  if (!Number.isFinite(ms)) return false;
  const w = msKeWita(ms);
  const j = jendelaHari(w.slice(0, 10), pil, libur);
  if (!j) return false;
  const menit = menitDari(w.slice(11, 16));
  if (menit < menitDari(j.dari) || menit >= menitDari(j.sampai) + (pil.malamBoleh ? 1 : 0)) return false;
  if (j.istirahatDari && j.istirahatSampai && menit >= menitDari(j.istirahatDari) && menit < menitDari(j.istirahatSampai)) return false;
  return true;
}

/** Awal jendela berikutnya (ms UTC) pada atau sesudah `ms`; NaN bila tidak ada dalam 30 hari. */
export function awalJendelaBerikut(ms: number, pil: PilihanJamKerja = {}, libur?: (iso: string) => boolean): number {
  let w = msKeWita(ms);
  let tanggal = w.slice(0, 10);
  const menit = menitDari(w.slice(11, 16));
  for (let i = 0; i < 30; i += 1) {
    const j = jendelaHari(tanggal, pil, libur);
    if (j) {
      const dari = menitDari(j.dari);
      const sampai = menitDari(j.sampai);
      // Hari ini: bila sudah di dalam jendela (di luar istirahat), saat ini juga; bila di istirahat, selesai istirahat.
      if (i === 0 && menit >= dari && menit < sampai) {
        if (j.istirahatDari && j.istirahatSampai && menit >= menitDari(j.istirahatDari) && menit < menitDari(j.istirahatSampai)) {
          return witaKeMs(`${tanggal} ${j.istirahatSampai}`);
        }
        return ms;
      }
      if (i > 0 || menit < dari) return witaKeMs(`${tanggal} ${j.dari}`);
    }
    tanggal = tambahHariTanggal(tanggal, 1);
    w = `${tanggal} 00:00`;
  }
  return Number.NaN;
}

// ──────────────────────────────────────────────────────────────────────────
// Susunan jadwal dengan jeda manusiawi
// ──────────────────────────────────────────────────────────────────────────

export type MasukanJadwal = {
  jumlah: number;
  /** "YYYY-MM-DD HH:mm" WITA. */
  mulai: string;
  /** "YYYY-MM-DD HH:mm" WITA; kosong = akhir jendela hari mulai (atau 23.59 bila malam dibolehkan). */
  batasAkhir?: string;
  jedaMinDetik?: number;
  jedaMaksDetik?: number;
  jamKerja?: PilihanJamKerja;
  /** Bila hari mulai tidak muat, sambung ke hari kerja berikutnya (sampai batasAkhir bila diisi). Bawaan: tidak. */
  lintasHari?: boolean;
  libur?: (iso: string) => boolean;
  acak?: () => number;
  /** Butir yang sudah punya saat tetap (mis. sudah berjalan) tidak dihitung ulang - jumlah saja. */
};

export type ButirJadwal = { urut: number; ms: number; iso: string; wita: string };

export type HasilJadwal = {
  ok: boolean;
  butir: ButirJadwal[];
  /** Jumlah butir yang tidak muat di rentang yang dipilih. */
  tidakMuat: number;
  jedaMinDetik: number;
  jedaMaksDetik: number;
  peringatan: string[];
  /** Kalimat untuk petugas bila ok = false. */
  sebab?: string;
};

export const bersihkanJeda = (nilai: unknown, bawaan: number) => {
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(Math.max(n, BATAS.jedaTerpendek), BATAS.jedaTerpanjang);
};

/** Log-seragam di [min, maks]: condong ke pendek tetapi tak pernah di luar rentang. */
export function jedaAcak(min: number, maks: number, acak: () => number = Math.random): number {
  const u = Math.min(Math.max(Number(acak()) || 0, 0), 1);
  if (maks <= min) return min;
  return Math.round(min * Math.pow(maks / min, u));
}

/**
 * Menyusun saat tiap butir: butir pertama pada saat mulai (digeser ke dalam
 * jendela bila jatuh di luar) ditambah sedikit acak, lalu tiap butir berikut
 * sesudah jeda acak. Tidak ada butir di luar jendela kerja (kecuali dipilih
 * tegas), tidak ada di istirahat siang, dan tidak melewati batas akhir.
 */
export function susunJadwal(m: MasukanJadwal): HasilJadwal {
  const peringatan: string[] = [];
  const acak = m.acak ?? Math.random;
  const min = bersihkanJeda(m.jedaMinDetik, BATAS.jedaMinBawaan);
  let maks = bersihkanJeda(m.jedaMaksDetik, BATAS.jedaMaksBawaan);
  if (maks < min) maks = min;
  const kosong = (sebab: string): HasilJadwal => ({ ok: false, butir: [], tidakMuat: m.jumlah, jedaMinDetik: min, jedaMaksDetik: maks, peringatan, sebab });

  const jumlah = Math.floor(Number(m.jumlah));
  if (!Number.isFinite(jumlah) || jumlah < 1) return kosong("Belum ada perkara yang dipilih.");
  if (jumlah > BATAS.butirPerJadwal) return kosong(`Satu jadwal paling banyak ${BATAS.butirPerJadwal} perkara.`);

  const mulaiMs = witaKeMs(m.mulai);
  if (!Number.isFinite(mulaiMs)) return kosong("Tanggal dan jam mulai belum sah (YYYY-MM-DD HH:mm).");
  const pil = m.jamKerja ?? {};
  const libur = m.libur;
  let batasMs = Number.POSITIVE_INFINITY;
  if (m.batasAkhir) {
    batasMs = witaKeMs(m.batasAkhir);
    if (!Number.isFinite(batasMs)) return kosong("Batas akhir belum sah (YYYY-MM-DD HH:mm).");
    if (batasMs <= mulaiMs) return kosong("Batas akhir harus sesudah jam mulai.");
  }

  let t = awalJendelaBerikut(mulaiMs, pil, libur);
  if (!Number.isFinite(t)) return kosong("Tidak ada hari kerja dalam 30 hari ke depan untuk jam yang dipilih.");
  if (t > mulaiMs) {
    // Hanya digeser bila jam mulai yang dipilih jatuh di luar jam kerja / istirahat.
    peringatan.push(`Jam mulai ${m.mulai} di luar jam kerja; butir pertama digeser ke ${msKeWita(t).slice(0, 16)} WITA.`);
  }

  const butir: ButirJadwal[] = [];
  let urut = 0;
  const pasang = (ms: number) => {
    urut += 1;
    butir.push({ urut, ms, iso: isoDariMs(ms), wita: msKeWita(ms) });
  };

  // Butir pertama: sedikit acak supaya tidak tepat di menit bulat (0-45 detik, tetap di dalam jendela).
  t += Math.round(acak() * 45) * 1000;
  for (let i = 0; i < jumlah; i += 1) {
    if (i > 0) t += jedaAcak(min, maks, acak) * 1000;
    // Jatuh di luar jendela (akhir hari / istirahat)?
    if (!dalamJendela(t, pil, libur)) {
      const berikut = awalJendelaBerikut(t, pil, libur);
      const tanggalLama = msKeWita(t).slice(0, 10);
      if (!Number.isFinite(berikut)) break;
      const pindahHari = msKeWita(berikut).slice(0, 10) !== tanggalLama;
      if (pindahHari && !m.lintasHari) break;
      // Awal jendela baru + sebaran pagi/sesudah istirahat 0-10 menit (petugas tidak mulai tepat di jam buka).
      t = berikut + Math.round(acak() * 10 * 60) * 1000;
      if (!dalamJendela(t, pil, libur)) break;
    }
    if (t > batasMs) break;
    pasang(t);
  }

  const tidakMuat = jumlah - butir.length;
  if (tidakMuat > 0) {
    const sebab = m.batasAkhir
      ? `Hanya ${butir.length} dari ${jumlah} perkara yang muat sebelum batas akhir dengan jeda ${Math.round(min / 60)}-${Math.round(maks / 60)} menit.`
      : `Hanya ${butir.length} dari ${jumlah} perkara yang muat di hari itu dengan jeda ${Math.round(min / 60)}-${Math.round(maks / 60)} menit.`;
    peringatan.push(`${sebab} Majukan jam mulai, perpendek jeda, atau izinkan sambung ke hari kerja berikutnya.`);
  }
  return { ok: tidakMuat === 0, butir, tidakMuat, jedaMinDetik: min, jedaMaksDetik: maks, peringatan, ...(tidakMuat > 0 ? { sebab: peringatan[peringatan.length - 1] } : {}) };
}

/** Saat tiap butir yang TIDAK muat dapat ditaruh sesudah hari terakhir (dipakai tombol "sambung ke hari berikutnya"). */
export function perkiraanSelesai(butir: ButirJadwal[]): string {
  return butir.length ? butir[butir.length - 1].wita.slice(0, 16) : "";
}

// ──────────────────────────────────────────────────────────────────────────
// Status
// ──────────────────────────────────────────────────────────────────────────

export type LangkahButir = Record<LangkahTerjadwal, StatusLangkah>;

const SELESAI_SAH: ReadonlySet<StatusLangkah> = new Set(["selesai", "dilewati"]);
const AKTIF: ReadonlySet<StatusLangkah> = new Set(["menunggu", "jalan"]);
const MACET: ReadonlySet<StatusLangkah> = new Set(["gagal", "tertahan"]);

/** Status butir dari status ketiga langkahnya. */
export function hitungStatusButir(l: LangkahButir, dibatalkan = false): StatusButir {
  if (dibatalkan) return "dibatalkan";
  const dipilih = LANGKAH_TERJADWAL.map((k) => l[k]).filter((s) => s !== "tidak" && s !== "batal");
  if (dipilih.length === 0) return "selesai";
  if (dipilih.some((s) => s === "jalan")) return "jalan";
  if (dipilih.some((s) => AKTIF.has(s))) return "menunggu";
  const selesai = dipilih.filter((s) => SELESAI_SAH.has(s)).length;
  const macet = dipilih.filter((s) => MACET.has(s)).length;
  if (macet === 0) return "selesai";
  return selesai > 0 ? "sebagian" : "gagal";
}

/** Berapa langkah dipilih / selesai / bermasalah - untuk ringkasan satu baris. */
export function ringkasLangkah(l: LangkahButir): { dipilih: number; selesai: number; macet: number } {
  const dipilih = LANGKAH_TERJADWAL.map((k) => l[k]).filter((s) => s !== "tidak" && s !== "batal");
  return {
    dipilih: dipilih.length,
    selesai: dipilih.filter((s) => SELESAI_SAH.has(s)).length,
    macet: dipilih.filter((s) => MACET.has(s)).length,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Pilihan form Putusan Akhir yang boleh diperiksa/diubah petugas
// ──────────────────────────────────────────────────────────────────────────

/**
 * Pilihan form yang BOLEH ditentukan petugas sebelum dijadwalkan. Kosong =
 * ALETA memilih dengan aturan yang SAMA dengan Putusan Otomatis (usulan dari
 * bunyi naskah, praperiksa yang menahan bila bertentangan). Yang diisi di sini
 * dipasang di borang SIPP lebih dulu, dan usulan ALETA menghormatinya
 * (nilai yang sudah dipilih di halaman tidak ditimpa).
 */
export type PilihanForm = {
  /** Teks pilihan "Status Putusan" persis seperti di SIPP (mis. "Dikabulkan"). */
  statusPutusan?: string;
  /** Putusan verstek: "Y" ya, "T" tidak. */
  verstek?: "Y" | "T";
};

export function bersihkanPilihanForm(mentah: unknown): PilihanForm {
  const x = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
  const hasil: PilihanForm = {};
  const status = String(x.statusPutusan ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (status) hasil.statusPutusan = status;
  const v = String(x.verstek ?? "").trim().toUpperCase();
  if (v === "Y" || v === "T") hasil.verstek = v;
  return hasil;
}

export function ringkasPilihanForm(p: PilihanForm): string {
  const bagian: string[] = [];
  bagian.push(`Status putusan: ${p.statusPutusan ? p.statusPutusan : "dipilih ALETA dari bunyi amar"}`);
  bagian.push(`Verstek: ${p.verstek === "Y" ? "ya" : p.verstek === "T" ? "tidak" : "dipilih ALETA dari kehadiran para pihak"}`);
  return bagian.join(" · ");
}

// ──────────────────────────────────────────────────────────────────────────
// Acak berbenih - pratinjau dan jadwal sesungguhnya memakai benih yang SAMA
// ──────────────────────────────────────────────────────────────────────────

/** Pembangkit acak deterministik (mulberry32) dari benih bilangan bulat. */
export function acakBenih(benih: number): () => number {
  let a = (Math.floor(Number(benih)) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Benih baru untuk satu pratinjau (bilangan bulat positif 31 bit). */
export function benihBaru(acak: () => number = Math.random): number {
  return Math.floor(acak() * 2147483646) + 1;
}

// ──────────────────────────────────────────────────────────────────────────
// Kalimat untuk petugas
// ──────────────────────────────────────────────────────────────────────────

const NAMA_STATUS_LANGKAH: Record<StatusLangkah, string> = {
  tidak: "tidak dipilih",
  menunggu: "menunggu",
  jalan: "mengerjakan",
  selesai: "selesai",
  dilewati: "sudah ada, dilewati",
  tertahan: "tertahan",
  gagal: "gagal",
  batal: "dibatalkan",
};

export const sebutStatusLangkah = (s: StatusLangkah) => NAMA_STATUS_LANGKAH[s] ?? s;
