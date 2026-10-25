/**
 * ============================================================================
 * PUSAT KESEHATAN SISTEM - PEMERIKSA (E2, admin 2 - 25 Okt 2026)
 * ============================================================================
 *
 * Satu fungsi per komponen. Setiap pemeriksa menerima jawaban mentahnya
 * (bukan memanggil jaringan sendiri), sehingga uji memberi jawaban tiruan dan
 * memeriksa WARNA yang dihasilkan. Pemanggil (layanan.ts) yang mengambil
 * jawaban dari bot, basis data, dan sinkron secara bersamaan dengan batas
 * waktu masing-masing - satu komponen yang macet tidak menahan yang lain.
 *
 * Warna:
 *   hijau   baik
 *   kuning  perlu diperhatikan (belum mengganggu)
 *   merah   mengganggu / mati
 *   kelabu  tidak terukur atau sengaja dimatikan - BUKAN tanda bahaya, dan
 *           tidak pernah memicu peringatan WhatsApp
 */
import type { RingkasGalat } from "@/server/modules/kesehatan/galat";

export type Warna = "hijau" | "kuning" | "merah" | "kelabu";
export type KelompokKomponen = "layanan" | "data" | "server" | "klien";

export type Komponen = {
  kunci: string;
  nama: string;
  kelompok: KelompokKomponen;
  warna: Warna;
  ringkas: string;
  rincian: Array<{ label: string; nilai: string }>;
  diukurPada: string;
  durasiMs: number;
};

export type UjiBebanRingkas = {
  id: string;
  dibuatAt: string;
  perangkat: number;
  profil: string;
  durasiDetik: number;
  p95Ms: number;
  galatPersen: number;
  kueriSippPerMenit: number | null;
  sambunganSippMaks: number | null;
  cpuMesinMaks: number | null;
  ramMesinMaksPersen: number | null;
};

export type HasilKesehatan = {
  diukurPada: string;
  warna: Warna;
  komponen: Komponen[];
  galat: RingkasGalat | null;
  ujiBeban: UjiBebanRingkas | null;
};

const URUTAN: Record<Warna, number> = { kelabu: 0, hijau: 1, kuning: 2, merah: 3 };

/** Warna terburuk; kelabu tidak menurunkan warna lain, semuanya kelabu -> kelabu. */
export function warnaTerburuk(daftar: Warna[]): Warna {
  let terburuk: Warna = "kelabu";
  for (const w of daftar) if (URUTAN[w] > URUTAN[terburuk]) terburuk = w;
  return terburuk;
}

export function bentukKomponen(
  dasar: Pick<Komponen, "kunci" | "nama" | "kelompok">,
  isi: { warna: Warna; ringkas: string; rincian?: Array<{ label: string; nilai: string }> },
  diukurPada: string,
  durasiMs = 0
): Komponen {
  return { ...dasar, warna: isi.warna, ringkas: isi.ringkas, rincian: isi.rincian ?? [], diukurPada, durasiMs };
}

function lamaSingkat(detik: number): string {
  if (!(detik >= 0)) return "-";
  if (detik < 90) return `${Math.round(detik)} detik`;
  if (detik < 5400) return `${Math.round(detik / 60)} menit`;
  if (detik < 172_800) return `${Math.round(detik / 3600)} jam`;
  return `${Math.round(detik / 86_400)} hari`;
}

export function umurTeks(iso: string | null | undefined, kini: Date): string {
  if (!iso) return "belum pernah";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "-";
  return `${lamaSingkat((kini.getTime() - t) / 1000)} lalu`;
}

type Hasil<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Portal dan basis data ALETA
// ---------------------------------------------------------------------------

export function periksaPortal(proses: { uptime(): number; memoryUsage(): { rss: number; heapUsed: number } }, versi: string) {
  const memMB = Math.round(proses.memoryUsage().rss / 1048576);
  const warna: Warna = memMB > 3000 ? "merah" : memMB > 1800 ? "kuning" : "hijau";
  return {
    warna,
    ringkas: `Portal berjalan ${lamaSingkat(proses.uptime())}, memori ${memMB} MB.`,
    rincian: [
      { label: "Versi portal", nilai: versi },
      { label: "Memori proses", nilai: `${memMB} MB` },
    ],
  };
}

export function periksaDatabaseAleta(masukan: { ok: boolean; latensiMs: number; ukuranByte: number | null; galat?: string }) {
  if (!masukan.ok) {
    return { warna: "merah" as Warna, ringkas: `Basis data ALETA tidak menjawab${masukan.galat ? `: ${masukan.galat}` : "."}`, rincian: [] };
  }
  const warna: Warna = masukan.latensiMs > 2000 ? "merah" : masukan.latensiMs > 500 ? "kuning" : "hijau";
  const rincian = [{ label: "Waktu jawab", nilai: `${Math.round(masukan.latensiMs)} ms` }];
  if (masukan.ukuranByte !== null) rincian.push({ label: "Ukuran basis data", nilai: `${(masukan.ukuranByte / 1048576).toFixed(0)} MB` });
  return { warna, ringkas: `Basis data ALETA menjawab dalam ${Math.round(masukan.latensiMs)} ms.`, rincian };
}

// ---------------------------------------------------------------------------
// Bot, WhatsApp
// ---------------------------------------------------------------------------

type BotStatusMentah = {
  whatsapp?: { status?: string; lastError?: string | null; lastConnectedAt?: string | null; lastDisconnectedAt?: string | null };
  bot?: { botEnabled?: boolean; dryRunEnabled?: boolean; notificationsEnabled?: boolean };
  queue?: Record<string, unknown>;
};

export function periksaBot(status: Hasil<BotStatusMentah>) {
  if (!status.ok) return { warna: "merah" as Warna, ringkas: `ALETA Bot tidak menjawab: ${status.error}`, rincian: [] };
  const b = status.data.bot ?? {};
  const rincian = [
    { label: "Bot WhatsApp", nilai: b.botEnabled === false ? "dimatikan di pengaturan" : "menyala" },
    { label: "Mode uji (dry run)", nilai: b.dryRunEnabled ? "ya - pesan tidak sungguh dikirim" : "tidak" },
  ];
  return { warna: "hijau" as Warna, ringkas: "ALETA Bot menjawab.", rincian };
}

const WA_HIJAU = new Set(["connected", "ready", "authenticated"]);
const WA_KUNING = new Set(["qr_needed", "initializing", "reconnecting", "reconnect_scheduled", "reconnect_attempt"]);
const WA_MERAH = new Set(["disconnected", "error", "auth_failure", "initialize_timeout", "reconnect_failed", "shutdown_error", "shutdown"]);

export function periksaWhatsapp(status: Hasil<BotStatusMentah>, kini: Date) {
  if (!status.ok) return { warna: "kelabu" as Warna, ringkas: "Tidak terukur karena ALETA Bot tidak menjawab.", rincian: [] };
  const wa = status.data.whatsapp ?? {};
  const b = status.data.bot ?? {};
  const kode = String(wa.status || "unknown");
  const rincian = [
    { label: "Keadaan", nilai: kode },
    { label: "Terakhir tersambung", nilai: umurTeks(wa.lastConnectedAt ?? null, kini) },
  ];
  if (wa.lastError) rincian.push({ label: "Galat terakhir", nilai: String(wa.lastError).slice(0, 160) });
  // Bot sengaja dimatikan (mis. mode uji sejak September): bukan tanda bahaya.
  if (b.botEnabled === false) return { warna: "kelabu" as Warna, ringkas: "WhatsApp sengaja dimatikan di pengaturan bot.", rincian };
  if (WA_HIJAU.has(kode)) return { warna: "hijau" as Warna, ringkas: "WhatsApp tersambung.", rincian };
  if (WA_KUNING.has(kode)) return { warna: "kuning" as Warna, ringkas: kode === "qr_needed" ? "WhatsApp perlu dipindai ulang." : "WhatsApp sedang menyambung.", rincian };
  if (WA_MERAH.has(kode)) return { warna: "merah" as Warna, ringkas: "WhatsApp terputus.", rincian };
  return { warna: "kelabu" as Warna, ringkas: "Keadaan WhatsApp belum diketahui.", rincian };
}

// ---------------------------------------------------------------------------
// SIPP, ABT, antrian (lewat rute /kesehatan di bot)
// ---------------------------------------------------------------------------

export type SambunganMentah = {
  kunci: string;
  nama: string;
  circuit: {
    keadaan: string;
    gagalBerturut: number;
    gagalTerakhir: string | null;
    berhasilTerakhir: string | null;
    pesanTerakhir: string;
  } | null;
  ping: { status: string; durasiMs: number; galat: string };
};
export type BotKesehatanMentah = { sambungan?: SambunganMentah[]; bot?: { uptimeDetik?: number; memoriMB?: number } };

export function periksaSambungan(kunci: string, kesehatan: Hasil<BotKesehatanMentah>, kini: Date) {
  if (!kesehatan.ok) {
    return {
      warna: "kelabu" as Warna,
      ringkas: `Belum terukur: ${kesehatan.error}`,
      rincian: [],
    };
  }
  const s = (kesehatan.data.sambungan ?? []).find((x) => x.kunci === kunci);
  if (!s) return { warna: "kelabu" as Warna, ringkas: "Sambungan ini tidak dikenal bot.", rincian: [] };
  const rincian: Array<{ label: string; nilai: string }> = [];
  if (s.ping.status !== "dilewati") {
    rincian.push({ label: "Uji sambung (SELECT 1)", nilai: s.ping.status === "berhasil" ? `berhasil, ${Math.round(s.ping.durasiMs)} ms` : `gagal${s.ping.galat ? `: ${s.ping.galat}` : ""}` });
  }
  if (s.circuit) {
    rincian.push({ label: "Pemutus arus", nilai: s.circuit.keadaan });
    if (s.circuit.gagalBerturut) rincian.push({ label: "Gagal berturut-turut", nilai: String(s.circuit.gagalBerturut) });
    if (s.circuit.berhasilTerakhir) rincian.push({ label: "Berhasil terakhir", nilai: umurTeks(s.circuit.berhasilTerakhir, kini) });
  }
  if (s.circuit?.keadaan === "terbuka") {
    return { warna: "merah" as Warna, ringkas: `${s.nama} sedang tertekan: bot berhenti menanyainya sementara.`, rincian };
  }
  if (s.ping.status === "gagal") {
    return { warna: "merah" as Warna, ringkas: `${s.nama} tidak menjawab uji sambung.`, rincian };
  }
  if (s.circuit?.keadaan === "setengah_terbuka" || (s.circuit && s.circuit.gagalBerturut >= 2)) {
    return { warna: "kuning" as Warna, ringkas: `${s.nama} baru saja bermasalah dan sedang dipantau.`, rincian };
  }
  if (s.ping.status === "berhasil") {
    return { warna: s.ping.durasiMs > 1500 ? ("kuning" as Warna) : ("hijau" as Warna), ringkas: `${s.nama} menjawab dalam ${Math.round(s.ping.durasiMs)} ms.`, rincian };
  }
  // Tanpa uji sambung: hanya pemutus arus yang diketahui.
  return s.circuit
    ? { warna: "hijau" as Warna, ringkas: `${s.nama}: pemutus arus tertutup (normal).`, rincian }
    : { warna: "kelabu" as Warna, ringkas: `${s.nama}: belum ada kegiatan yang diukur.`, rincian };
}

// ---------------------------------------------------------------------------
// e-Court, cadangan, server, ekstensi
// ---------------------------------------------------------------------------

type JadwalEcourtMentah = {
  pengaturan?: { aktif?: boolean; jarakJam?: number };
  berjalan?: boolean;
  sedangJalan?: boolean;
  terakhirSelesai?: string | null;
  terakhirGalat?: string | null;
};

export function periksaEcourt(jadwal: Hasil<{ jadwal?: JadwalEcourtMentah | null }>, kini: Date) {
  if (!jadwal.ok) return { warna: "kelabu" as Warna, ringkas: "Tidak terukur karena ALETA Bot tidak menjawab.", rincian: [] };
  const j = jadwal.data.jadwal;
  if (!j) return { warna: "kelabu" as Warna, ringkas: "Penjadwal e-Court belum melapor.", rincian: [] };
  const rincian = [
    { label: "Penarikan berkala", nilai: j.pengaturan?.aktif ? "menyala" : "dimatikan" },
    { label: "Selesai terakhir", nilai: umurTeks(j.terakhirSelesai ?? null, kini) },
  ];
  if (j.terakhirGalat) rincian.push({ label: "Galat terakhir", nilai: String(j.terakhirGalat).slice(0, 160) });
  if (!j.pengaturan?.aktif) return { warna: "kelabu" as Warna, ringkas: "Penarikan berkala e-Court dimatikan.", rincian };
  if (j.sedangJalan) return { warna: "hijau" as Warna, ringkas: "Penarikan e-Court sedang berjalan.", rincian };
  if (j.terakhirGalat) return { warna: "kuning" as Warna, ringkas: "Putaran e-Court terakhir mencatat galat.", rincian };
  const jarakJam = Math.max(1, Number(j.pengaturan?.jarakJam ?? 6));
  const umurJam = j.terakhirSelesai ? (kini.getTime() - new Date(j.terakhirSelesai).getTime()) / 3_600_000 : Infinity;
  // Putaran hanya berjalan di jam kerja: yang dianggap macet adalah > 3x jarak (min. 24 jam).
  if (umurJam > Math.max(24, jarakJam * 3)) {
    return { warna: "kuning" as Warna, ringkas: `Penarikan e-Court belum selesai dalam ${Math.round(umurJam)} jam.`, rincian };
  }
  return { warna: "hijau" as Warna, ringkas: "Penarikan e-Court berjalan sesuai jadwal.", rincian };
}

type KeadaanCadanganMentah = { terakhir?: Partial<Record<string, { mulai: string; selesai: string; berhasil: boolean }>> };

export function periksaCadangan(keadaan: Hasil<KeadaanCadanganMentah>, kini: Date) {
  if (!keadaan.ok) return { warna: "kelabu" as Warna, ringkas: `Keadaan cadangan tidak terbaca: ${keadaan.error}`, rincian: [] };
  const t = keadaan.data.terakhir ?? {};
  const rincian = [
    { label: "Basis data (server)", nilai: t.cadangan ? `${t.cadangan.berhasil ? "berhasil" : "GAGAL"} ${umurTeks(t.cadangan.selesai, kini)}` : "belum pernah" },
    { label: "Basis data ke Google Drive", nilai: t["drive-cadangan"] ? `${t["drive-cadangan"].berhasil ? "berhasil" : "GAGAL"} ${umurTeks(t["drive-cadangan"].selesai, kini)}` : "belum pernah" },
  ];
  const c = t.cadangan;
  if (!c) return { warna: "kelabu" as Warna, ringkas: "Belum ada cadangan basis data yang tercatat.", rincian };
  if (!c.berhasil) return { warna: "merah" as Warna, ringkas: "Cadangan basis data terakhir GAGAL.", rincian };
  const jam = (kini.getTime() - new Date(c.selesai).getTime()) / 3_600_000;
  if (jam > 72) return { warna: "merah" as Warna, ringkas: `Cadangan basis data terakhir ${Math.round(jam / 24)} hari lalu.`, rincian };
  if (jam > 36) return { warna: "kuning" as Warna, ringkas: `Cadangan basis data terakhir ${Math.round(jam)} jam lalu.`, rincian };
  return { warna: "hijau" as Warna, ringkas: `Cadangan basis data terakhir ${umurTeks(c.selesai, kini)}.`, rincian };
}

type KepingSumber = { persen: number | null; warna: Warna };
type SumberDayaMentah = { ringkas?: { server?: { ram?: KepingSumber; disk?: KepingSumber; cpu?: KepingSumber } } };

export function periksaServer(sumber: Hasil<SumberDayaMentah>) {
  if (!sumber.ok) return { warna: "kelabu" as Warna, ringkas: `Sumber daya server tidak terbaca: ${sumber.error}`, rincian: [] };
  const s = sumber.data.ringkas?.server;
  if (!s) return { warna: "kelabu" as Warna, ringkas: "Bot belum melaporkan sumber daya server.", rincian: [] };
  const p = (k?: KepingSumber) => (k && k.persen !== null && k.persen !== undefined ? `${k.persen}%` : "tidak terbaca");
  const rincian = [
    { label: "Prosesor", nilai: p(s.cpu) },
    { label: "Memori", nilai: p(s.ram) },
    { label: "Disk", nilai: p(s.disk) },
  ];
  const warna = warnaTerburuk([s.cpu?.warna ?? "kelabu", s.ram?.warna ?? "kelabu", s.disk?.warna ?? "kelabu"]);
  const ringkas =
    warna === "merah" ? "Prosesor, memori, atau disk server hampir penuh." : warna === "kuning" ? "Salah satu sumber daya server mulai tinggi." : warna === "hijau" ? "Prosesor, memori, dan disk server wajar." : "Sumber daya server belum terukur.";
  return { warna, ringkas, rincian };
}

export type PerangkatEkstensi = { nama: string; akun: string; versi: string; terakhirDilihat: string };

/** Versi ekstensi per PC: yang berbeda dari versi terbaru = kuning (bukan merah; PC lama tetap berfungsi). */
export function periksaEkstensi(perangkat: PerangkatEkstensi[], versiTerbaru: string, kini: Date) {
  const aktif = perangkat.filter((p) => kini.getTime() - new Date(p.terakhirDilihat).getTime() < 30 * 86_400_000);
  const dilapor = aktif.filter((p) => p.versi);
  const tanpaLapor = aktif.length - dilapor.length;
  const lama = dilapor.filter((p) => p.versi !== versiTerbaru);
  const rincian: Array<{ label: string; nilai: string }> = [
    { label: "Versi terbaru", nilai: versiTerbaru },
    { label: "PC aktif 30 hari", nilai: String(aktif.length) },
    { label: "Sudah versi terbaru", nilai: String(dilapor.length - lama.length) },
    { label: "Belum melaporkan versi", nilai: String(tanpaLapor) },
  ];
  for (const p of lama.slice(0, 12)) rincian.push({ label: `${p.nama || "PC tanpa nama"} (${p.akun})`, nilai: `versi ${p.versi}` });
  if (lama.length > 12) rincian.push({ label: "Dan lainnya", nilai: `${lama.length - 12} PC` });
  if (!aktif.length) return { warna: "kelabu" as Warna, ringkas: "Belum ada PC yang tercatat memakai ekstensi.", rincian };
  if (lama.length) return { warna: "kuning" as Warna, ringkas: `${lama.length} PC belum memakai ekstensi ${versiTerbaru}.`, rincian };
  if (tanpaLapor === aktif.length) return { warna: "kelabu" as Warna, ringkas: "Belum ada PC yang melaporkan versi ekstensinya (perlu ekstensi terbaru).", rincian };
  return { warna: "hijau" as Warna, ringkas: `Semua PC yang melapor memakai ekstensi ${versiTerbaru}.`, rincian };
}

export function periksaGalat(ringkas: RingkasGalat | null) {
  if (!ringkas) return { warna: "kelabu" as Warna, ringkas: "Catatan galat belum terbaca.", rincian: [] };
  const rincian = [
    { label: "Kelompok galat baru (24 jam)", nilai: String(ringkas.kelompokBaru) },
    { label: "Kejadian tercatat (24 jam)", nilai: String(ringkas.kejadian24Jam) },
    ...ringkas.teratas.slice(0, 3).map((t) => ({ label: `${t.sumber} x${t.jumlah}`, nilai: t.pesan.slice(0, 100) })),
  ];
  const warna: Warna = ringkas.kelompokBaru >= 10 ? "merah" : ringkas.kelompokBaru > 0 ? "kuning" : "hijau";
  return {
    warna,
    ringkas: ringkas.kelompokBaru ? `${ringkas.kelompokBaru} kelompok galat baru dalam 24 jam.` : "Tidak ada galat baru dalam 24 jam.",
    rincian,
  };
}

export function periksaUjiBeban(uji: UjiBebanRingkas | null, kini: Date) {
  if (!uji) return { warna: "kelabu" as Warna, ringkas: "Belum ada hasil uji beban yang diimpor.", rincian: [] };
  const rincian = [
    { label: "Dijalankan", nilai: umurTeks(uji.dibuatAt, kini) },
    { label: "Perangkat tiruan", nilai: `${uji.perangkat} (${uji.profil}, ${uji.durasiDetik} detik)` },
    { label: "p95 waktu jawab", nilai: `${Math.round(uji.p95Ms)} ms` },
    { label: "Galat", nilai: `${uji.galatPersen}%` },
  ];
  if (uji.kueriSippPerMenit !== null) rincian.push({ label: "Kueri SIPP per menit", nilai: String(uji.kueriSippPerMenit) });
  if (uji.sambunganSippMaks !== null) rincian.push({ label: "Sambungan SIPP (maks)", nilai: String(uji.sambunganSippMaks) });
  // Uji beban adalah catatan angka, bukan alarm: kelabu bila baik, kuning bila buruk.
  const buruk = uji.galatPersen > 1 || uji.p95Ms > 3000;
  return {
    warna: buruk ? ("kuning" as Warna) : ("hijau" as Warna),
    ringkas: `${uji.perangkat} perangkat tiruan: p95 ${Math.round(uji.p95Ms)} ms, galat ${uji.galatPersen}%.`,
    rincian,
  };
}
