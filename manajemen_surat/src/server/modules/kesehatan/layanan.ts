/**
 * ============================================================================
 * PUSAT KESEHATAN SISTEM - LAYANAN (E2, 25 Okt 2026)
 * ============================================================================
 *
 * Mengumpulkan semua komponen sekaligus (tiap panggilan berbatas waktu sendiri),
 * menyimpan warna terakhir, dan - HANYA bila Super Admin menyalakannya - memeriksa
 * tiap menit lalu mengirim peringatan WhatsApp ke admin.
 *
 * SAKLAR (aleta_ekstensi_setelan, *sistem*, kunci "kesehatan:pengaturan"),
 * dua-duanya MATI bawaan:
 *   berkala  pemeriksaan tiap menit di latar (menanyai bot, mencatat riwayat)
 *   wa       peringatan WhatsApp: komponen MERAH dua pemeriksaan berturut-turut
 *            (dua menit), diulang paling cepat tiap `ulangJam` jam, dan satu
 *            kabar "pulih". Kelabu dan kuning tidak pernah mengirim apa pun.
 * Tanpa saklar, halaman Pusat kesehatan tetap memeriksa saat dibuka.
 *
 * Peringatan WhatsApp lewat jalur notifikasi yang ada (sendPortalWhatsappMessage).
 * Bila bot/WhatsApp itu sendiri yang mati, pesannya tidak dapat terkirim: merah di
 * halaman dan lonceng portal tetap menjadi penandanya.
 */
import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { getEffectiveRoleId } from "@/lib/permissions";
import { APP_VERSION } from "@/lib/patch-notes";
import {
  periksaBot,
  periksaCadangan,
  periksaDatabaseAleta,
  periksaEcourt,
  periksaEkstensi,
  periksaGalat,
  periksaIntegritas,
  periksaPortal,
  periksaServer,
  periksaSambungan,
  periksaUjiBeban,
  periksaWhatsapp,
  bentukKomponen,
  warnaTerburuk,
  type BotKesehatanMentah,
  type HasilKesehatan,
  type Komponen,
  type PerangkatEkstensi,
  type UjiBebanRingkas,
  type Warna,
} from "@/server/modules/kesehatan/pemeriksa";
import { ringkasGalat } from "@/server/modules/kesehatan/galat";
import { bacaSetelanJson, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import { panggilBotInternal, type HasilBotInternal } from "@/server/modules/kesehatan/bot";
import { ApiError } from "@/server/shared/errors";

export const KUNCI_PENGATURAN_KESEHATAN = "kesehatan:pengaturan";

export type PengaturanKesehatan = {
  berkala: boolean;
  wa: boolean;
  /** "admin" = Admin dan Super Admin; "super-admin" = Super Admin saja. */
  penerima: "admin" | "super-admin";
  ulangJam: number;
};

export const PENGATURAN_KESEHATAN_BAWAAN: PengaturanKesehatan = { berkala: false, wa: false, penerima: "admin", ulangJam: 6 };

export function bersihkanPengaturanKesehatan(masukan: unknown): PengaturanKesehatan {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : {};
  const ulang = Math.floor(Number(x.ulangJam));
  return {
    berkala: x.berkala === true,
    wa: x.wa === true,
    penerima: x.penerima === "super-admin" ? "super-admin" : "admin",
    ulangJam: Number.isFinite(ulang) ? Math.min(24, Math.max(1, ulang)) : PENGATURAN_KESEHATAN_BAWAAN.ulangJam,
  };
}

export async function bacaPengaturanKesehatan(db: AletaDatabase): Promise<PengaturanKesehatan> {
  const tersimpan = await bacaSetelanJson<PengaturanKesehatan>(db, KUNCI_PENGATURAN_KESEHATAN);
  return bersihkanPengaturanKesehatan({ ...PENGATURAN_KESEHATAN_BAWAAN, ...(tersimpan ?? {}) });
}

export async function simpanPengaturanKesehatan(db: AletaDatabase, masukan: unknown, kini = new Date()) {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : null;
  if (!x) throw new ApiError(400, "Pengaturan tidak sah.");
  const sekarang = await bacaPengaturanKesehatan(db);
  const baru = bersihkanPengaturanKesehatan({ ...sekarang, ...x });
  await simpanSetelanSistem(db, KUNCI_PENGATURAN_KESEHATAN, JSON.stringify(baru), kini.toISOString());
  return baru;
}

// ---------------------------------------------------------------------------
// Uji beban
// ---------------------------------------------------------------------------

function hostLoopback(alamat: string): boolean {
  try {
    const h = new URL(alamat).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127(\.\d{1,3}){3}$/.test(h);
  } catch {
    return false;
  }
}

type BerkasUjiBeban = {
  versi?: number;
  dibuat?: string;
  sasaran?: string;
  profil?: string;
  perangkat?: number;
  durasiDetik?: number;
  total?: { p95?: number; persenGalat?: number };
  sumberDaya?: { cpuMesinMaks?: number; ramMesinMaksPersen?: number };
  sipp?: { tersedia?: boolean; kueriPerMenit?: number; sambunganMaks?: number };
};

/**
 * Mengimpor berkas JSON dari scripts/uji-beban.mjs. Menolak berkas yang bukan
 * keluaran skrip itu atau yang sasarannya bukan kembaran (loopback): hasil uji
 * beban yang sah tidak pernah berasal dari server kantor.
 */
export async function imporUjiBeban(db: AletaDatabase, berkas: unknown, olehNama: string, kini = new Date()): Promise<UjiBebanRingkas> {
  const b = (berkas && typeof berkas === "object" ? berkas : {}) as BerkasUjiBeban;
  const p95 = Number(b.total?.p95);
  const galatPersen = Number(b.total?.persenGalat);
  const perangkat = Math.floor(Number(b.perangkat));
  const durasi = Math.floor(Number(b.durasiDetik));
  const dibuat = String(b.dibuat || "");
  if (b.versi !== 1 || !Number.isFinite(p95) || !Number.isFinite(galatPersen) || !(perangkat > 0) || !(durasi > 0) || Number.isNaN(Date.parse(dibuat))) {
    throw new ApiError(400, "Berkas bukan hasil skrip uji beban ALETA (versi 1).");
  }
  if (!hostLoopback(String(b.sasaran || ""))) {
    throw new ApiError(400, "Hasil ini bukan dari kembaran laptop (sasaran bukan localhost). Uji beban hanya sah bila dijalankan ke kembaran.");
  }
  const profil = String(b.profil || "").slice(0, 30);
  const id = `ub-${randomUUID()}`;
  await db.run(
    `INSERT INTO aleta_uji_beban_hasil (id, diimpor_at, diimpor_oleh, dibuat_at, perangkat, profil, sasaran, durasi_detik, p95_ms, galat_persen, hasil_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, kini.toISOString(), olehNama.slice(0, 120), new Date(dibuat).toISOString(), perangkat, profil, String(b.sasaran).slice(0, 200), durasi, p95, galatPersen, JSON.stringify(b).slice(0, 200_000)]
  );
  // Simpan 50 hasil terakhir.
  await db.run(
    "DELETE FROM aleta_uji_beban_hasil WHERE id NOT IN (SELECT id FROM aleta_uji_beban_hasil ORDER BY dibuat_at DESC LIMIT 50)"
  );
  return ringkasDariBerkas(id, perangkat, profil, durasi, new Date(dibuat).toISOString(), p95, galatPersen, b);
}

function ringkasDariBerkas(id: string, perangkat: number, profil: string, durasi: number, dibuatAt: string, p95: number, galatPersen: number, b: BerkasUjiBeban): UjiBebanRingkas {
  const angka = (x: unknown) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
  return {
    id,
    dibuatAt,
    perangkat,
    profil,
    durasiDetik: durasi,
    p95Ms: p95,
    galatPersen,
    kueriSippPerMenit: b.sipp?.tersedia ? angka(b.sipp.kueriPerMenit) : null,
    sambunganSippMaks: b.sipp?.tersedia ? angka(b.sipp.sambunganMaks) : null,
    cpuMesinMaks: angka(b.sumberDaya?.cpuMesinMaks),
    ramMesinMaksPersen: angka(b.sumberDaya?.ramMesinMaksPersen),
  };
}

export async function daftarUjiBeban(db: AletaDatabase, batas = 20): Promise<Array<UjiBebanRingkas & { diimporOleh: string; diimporAt: string }>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_uji_beban_hasil ORDER BY dibuat_at DESC LIMIT ${Math.min(50, Math.max(1, Math.floor(batas)))}`
  );
  return baris.map((r) => {
    let isi: BerkasUjiBeban = {};
    try {
      isi = JSON.parse(String(r.hasil_json || "{}")) as BerkasUjiBeban;
    } catch {
      /* hasil rusak: ringkasan dari kolom saja */
    }
    return {
      ...ringkasDariBerkas(String(r.id), Number(r.perangkat), String(r.profil), Number(r.durasi_detik), String(r.dibuat_at), Number(r.p95_ms), Number(r.galat_persen), isi),
      diimporOleh: String(r.diimpor_oleh || ""),
      diimporAt: String(r.diimpor_at || ""),
    };
  });
}

export async function ujiBebanTerakhir(db: AletaDatabase): Promise<UjiBebanRingkas | null> {
  const [p] = await daftarUjiBeban(db, 1);
  return p ?? null;
}

// ---------------------------------------------------------------------------
// Pengumpulan
// ---------------------------------------------------------------------------

export type DepsKesehatan = {
  kini: () => Date;
  proses: { uptime(): number; memoryUsage(): { rss: number; heapUsed: number } };
  versiPortal: string;
  versiEkstensiTerbaru: string;
  botStatus: () => Promise<HasilBotInternal<Record<string, unknown>>>;
  botKesehatan: (ping: boolean) => Promise<HasilBotInternal<BotKesehatanMentah>>;
  sumberDaya: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  jadwalEcourt: () => Promise<{ ok: true; data: { jadwal?: unknown } } | { ok: false; error: string }>;
  keadaanCadangan: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  ukuranDatabase: (db: AletaDatabase) => Promise<number | null>;
};

export async function depsAsli(): Promise<DepsKesehatan> {
  const [{ bacaSumberDaya }, { mintaSumberDayaBot }, { getGatewayEcourtJadwal }, { bacaKeadaan }, { EKSTENSI_VERSI }] = await Promise.all([
    import("@/server/modules/sumber-daya/layanan"),
    import("@/server/modules/sumber-daya/gateway"),
    import("@/server/modules/aleta-bot/whatsapp-gateway-client"),
    import("@/server/modules/sinkron/riwayat"),
    import("@/server/shared/ekstensi-berkas"),
  ]);
  return {
    kini: () => new Date(),
    proses: process,
    versiPortal: APP_VERSION,
    versiEkstensiTerbaru: EKSTENSI_VERSI,
    botStatus: () => panggilBotInternal("/status", { timeoutMs: 5000 }),
    botKesehatan: (ping) => panggilBotInternal<BotKesehatanMentah>(`/kesehatan${ping ? "?ping=1" : ""}`, { timeoutMs: 9000 }),
    sumberDaya: async () => {
      const h = await bacaSumberDaya(null, () => mintaSumberDayaBot());
      return h.ok ? { ok: true, data: h.data } : { ok: false, error: h.error };
    },
    jadwalEcourt: async () => {
      const h = await getGatewayEcourtJadwal();
      return h.ok ? { ok: true, data: { jadwal: h.data?.jadwal } } : { ok: false, error: h.error || "tidak terhubung" };
    },
    keadaanCadangan: async () => {
      try {
        return { ok: true, data: await bacaKeadaan() };
      } catch (galat) {
        return { ok: false, error: galat instanceof Error ? galat.message : "tidak terbaca" };
      }
    },
    ukuranDatabase: async (db) => {
      try {
        const b = await db.queryOne<{ n: number | string }>("SELECT pg_database_size(current_database()) AS n");
        return b ? Number(b.n) : null;
      } catch {
        return null;
      }
    },
  };
}

async function dengan<T>(janji: Promise<T>, batasMs: number, galat: T): Promise<T> {
  let pewaktu: ReturnType<typeof setTimeout> | undefined;
  const batas = new Promise<T>((selesai) => {
    pewaktu = setTimeout(() => selesai(galat), batasMs);
  });
  try {
    return await Promise.race([janji, batas]);
  } catch {
    return galat;
  } finally {
    if (pewaktu) clearTimeout(pewaktu);
  }
}

async function perangkatEkstensi(db: AletaDatabase): Promise<PerangkatEkstensi[]> {
  try {
    const baris = await db.queryAll<Record<string, unknown>>(
      `SELECT p.nama_komputer, p.nama_terbaca, p.versi_ekstensi, p.terakhir_dilihat, p.data_ekstensi_pada, u.name AS nama_akun
       FROM aleta_perangkat p LEFT JOIN users u ON u.id = p.user_id
       WHERE p.data_ekstensi_pada <> '' ORDER BY p.terakhir_dilihat DESC LIMIT 2000`
    );
    return baris.map((b) => ({
      nama: String(b.nama_komputer || b.nama_terbaca || ""),
      akun: String(b.nama_akun || ""),
      versi: String(b.versi_ekstensi || ""),
      terakhirDilihat: String(b.terakhir_dilihat || b.data_ekstensi_pada || ""),
    }));
  } catch {
    return [];
  }
}

const KOMPONEN: Array<{ kunci: string; nama: string; kelompok: Komponen["kelompok"] }> = [
  { kunci: "portal", nama: "Portal ALETA", kelompok: "layanan" },
  { kunci: "basis-data", nama: "Basis data ALETA", kelompok: "data" },
  { kunci: "bot", nama: "ALETA Bot", kelompok: "layanan" },
  { kunci: "whatsapp", nama: "WhatsApp", kelompok: "layanan" },
  { kunci: "sipp", nama: "SIPP", kelompok: "data" },
  { kunci: "abt", nama: "ABT", kelompok: "data" },
  { kunci: "antrian", nama: "Antrian sidang", kelompok: "data" },
  { kunci: "ecourt", nama: "e-Court", kelompok: "layanan" },
  { kunci: "cadangan", nama: "Cadangan", kelompok: "data" },
  { kunci: "server", nama: "Prosesor, memori, disk server", kelompok: "server" },
  { kunci: "ekstensi", nama: "Ekstensi di PC pengguna", kelompok: "klien" },
  { kunci: "galat", nama: "Error 24 jam", kelompok: "layanan" },
  { kunci: "uji-beban", nama: "Uji beban terakhir", kelompok: "server" },
  { kunci: "integritas", nama: "Integritas berkas website/server", kelompok: "server" },
];

/** Komponen yang ikut menentukan warna keseluruhan dan boleh memicu peringatan. Ekstensi dan uji beban hanya informasi. */
export const KOMPONEN_PENENTU = new Set(["portal", "basis-data", "bot", "whatsapp", "sipp", "abt", "antrian", "ecourt", "cadangan", "server", "galat", "integritas"]);

async function ringkasIntegritasAman(db: AletaDatabase) {
  const { ringkasIntegritas } = await import("@/server/modules/integritas/layanan");
  return ringkasIntegritas(db);
}

export async function jalankanPemeriksaan(db: AletaDatabase, opsi: { ping?: boolean; deps?: DepsKesehatan } = {}): Promise<HasilKesehatan> {
  const deps = opsi.deps ?? (await depsAsli());
  const kini = deps.kini();
  const diukurPada = kini.toISOString();
  const mulai = Date.now();
  const kosong = { ok: false as const, error: "tidak menjawab dalam batas waktu" };

  const [status, kesehatanBot, sumber, ecourt, cadangan, ukuran, perangkat, galat, uji, integritas] = await Promise.all([
    dengan(deps.botStatus(), 7000, kosong),
    dengan(deps.botKesehatan(opsi.ping ?? false), 10_000, kosong),
    dengan(deps.sumberDaya(), 8000, kosong),
    dengan(deps.jadwalEcourt(), 7000, kosong),
    dengan(deps.keadaanCadangan(), 3000, kosong),
    dengan(deps.ukuranDatabase(db), 3000, null),
    dengan(perangkatEkstensi(db), 4000, [] as PerangkatEkstensi[]),
    dengan(ringkasGalat(db, kini), 3000, null),
    dengan(ujiBebanTerakhir(db), 3000, null),
    dengan(ringkasIntegritasAman(db), 3000, null),
  ]);

  // Basis data ALETA: diukur sendiri (dua pembacaan terkecil).
  const t0 = Date.now();
  let dbOk = true;
  let dbGalat = "";
  try {
    await db.queryOne("SELECT 1 AS ok");
  } catch (e) {
    dbOk = false;
    dbGalat = e instanceof Error ? e.message.slice(0, 120) : "tidak menjawab";
  }
  const latensi = Date.now() - t0;

  const isi: Record<string, { warna: Warna; ringkas: string; rincian?: Array<{ label: string; nilai: string }> }> = {
    portal: periksaPortal(deps.proses, deps.versiPortal),
    "basis-data": periksaDatabaseAleta({ ok: dbOk, latensiMs: latensi, ukuranByte: ukuran, galat: dbGalat }),
    bot: periksaBot(status as Parameters<typeof periksaBot>[0]),
    whatsapp: periksaWhatsapp(status as Parameters<typeof periksaWhatsapp>[0], kini),
    sipp: periksaSambungan("sipp_primary", kesehatanBot as Parameters<typeof periksaSambungan>[1], kini),
    abt: periksaSambungan("aps_badilag", kesehatanBot as Parameters<typeof periksaSambungan>[1], kini),
    antrian: periksaSambungan("antrian_sidang", kesehatanBot as Parameters<typeof periksaSambungan>[1], kini),
    ecourt: periksaEcourt(ecourt as Parameters<typeof periksaEcourt>[0], kini),
    cadangan: periksaCadangan(cadangan as Parameters<typeof periksaCadangan>[0], kini),
    server: periksaServer(sumber as Parameters<typeof periksaServer>[0]),
    ekstensi: periksaEkstensi(perangkat, deps.versiEkstensiTerbaru, kini),
    galat: periksaGalat(galat),
    "uji-beban": periksaUjiBeban(uji, kini),
    integritas: periksaIntegritas(integritas, kini),
  };
  const durasi = Date.now() - mulai;
  const komponen = KOMPONEN.map((k) => bentukKomponen(k, isi[k.kunci], diukurPada, durasi));
  return {
    diukurPada,
    warna: warnaTerburuk(komponen.filter((k) => KOMPONEN_PENENTU.has(k.kunci)).map((k) => k.warna)),
    komponen,
    galat,
    ujiBeban: uji,
  };
}

// ---------------------------------------------------------------------------
// Status berkala dan peringatan
// ---------------------------------------------------------------------------

export type KirimPeringatan = (penerima: Array<{ id: string; nama: string; nomor: string }>, pesan: string, kunci: string) => Promise<{ terkirim: number; gagal: number }>;

/** Admin (atau hanya Super Admin) aktif yang punya nomor WhatsApp - penerima peringatan sistem. */
export async function daftarPenerimaAdmin(db: AletaDatabase, penerima: "admin" | "super-admin") {
  const peran = penerima === "super-admin" ? ["super-admin"] : ["super-admin", "admin"];
  const baris = await db.queryAll<{ id: string; name: string; whatsapp_number: string; role_id: string }>(
    `SELECT id, name, whatsapp_number, role_id FROM users WHERE is_active = 1 AND deleted_at IS NULL AND role_id IN (${peran.map(() => "?").join(", ")})`,
    peran
  );
  return baris.filter((b) => String(b.whatsapp_number || "").replace(/\D/g, "").length >= 8).map((b) => ({ id: b.id, nama: b.name, nomor: b.whatsapp_number }));
}

async function penerimaPeringatan(db: AletaDatabase, pengaturan: PengaturanKesehatan) {
  return daftarPenerimaAdmin(db, pengaturan.penerima);
}

export async function kirimPeringatanWhatsapp(
  penerima: Array<{ id: string; nama: string; nomor: string }>,
  pesan: string,
  kunci: string
): Promise<{ terkirim: number; gagal: number }> {
  const { sendPortalWhatsappMessage } = await import("@/server/modules/whatsapp/portal-whatsapp-sender");
  let terkirim = 0;
  let gagal = 0;
  for (const p of penerima) {
    try {
      const h = await sendPortalWhatsappMessage({
        sourceFeature: "pusat_kesehatan",
        entityType: "kesehatan",
        entityId: kunci,
        eventType: "peringatan",
        recipientNumber: p.nomor,
        recipientName: p.nama,
        message: pesan,
        category: "employee",
        priority: 2,
      });
      if (h.ok && h.status !== "skipped") terkirim += 1;
      else gagal += 1;
    } catch {
      gagal += 1;
    }
  }
  return { terkirim, gagal };
}

export type HasilPerbaruiStatus = { peringatan: string[]; pulih: string[]; dikirim: { terkirim: number; gagal: number } | null };

/**
 * Memperbarui aleta_kesehatan_status dari satu pemeriksaan dan, bila saklar `wa`
 * menyala, mengirim peringatan. Peringatan hanya untuk MERAH yang bertahan dua
 * pemeriksaan berturut-turut dan belum diperingatkan dalam `ulangJam` jam.
 */
export async function perbaruiStatus(
  db: AletaDatabase,
  hasil: HasilKesehatan,
  opsi: { pengaturan: PengaturanKesehatan; kirim?: KirimPeringatan; kini?: Date }
): Promise<HasilPerbaruiStatus> {
  const kini = opsi.kini ?? new Date();
  const waktu = kini.toISOString();
  const peringatan: Komponen[] = [];
  const pulih: Komponen[] = [];

  for (const k of hasil.komponen) {
    if (!KOMPONEN_PENENTU.has(k.kunci)) continue;
    const sebelum = await db.queryOne<{ warna: string; sejak: string; merah_berturut: number | string; diperingatkan_at: string }>(
      "SELECT warna, sejak, merah_berturut, diperingatkan_at FROM aleta_kesehatan_status WHERE kunci = ?",
      [k.kunci]
    );
    const merahBerturut = k.warna === "merah" ? Number(sebelum?.merah_berturut ?? 0) + 1 : 0;
    const sejak = sebelum && sebelum.warna === k.warna ? sebelum.sejak : waktu;
    let diperingatkan = String(sebelum?.diperingatkan_at ?? "");

    if (k.warna === "merah" && merahBerturut >= 2) {
      const sudahLama = !diperingatkan || kini.getTime() - new Date(diperingatkan).getTime() >= opsi.pengaturan.ulangJam * 3_600_000;
      if (sudahLama) {
        peringatan.push(k);
        diperingatkan = waktu;
      }
    } else if (k.warna !== "merah" && diperingatkan) {
      // Pulih: kabar sekali, hanya bila sebelumnya pernah diperingatkan.
      if (k.warna === "hijau") pulih.push(k);
      diperingatkan = "";
    }

    if (sebelum) {
      await db.run(
        "UPDATE aleta_kesehatan_status SET warna = ?, sejak = ?, diperiksa_at = ?, merah_berturut = ?, diperingatkan_at = ?, ringkas = ? WHERE kunci = ?",
        [k.warna, sejak, waktu, merahBerturut, diperingatkan, k.ringkas.slice(0, 300), k.kunci]
      );
    } else {
      await db.run(
        "INSERT INTO aleta_kesehatan_status (kunci, warna, sejak, diperiksa_at, merah_berturut, diperingatkan_at, ringkas) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [k.kunci, k.warna, sejak, waktu, merahBerturut, diperingatkan, k.ringkas.slice(0, 300)]
      );
    }
  }

  const baris = [
    ...peringatan.map((k) => `MERAH: ${k.nama}. ${k.ringkas}`),
    ...pulih.map((k) => `Pulih: ${k.nama}. ${k.ringkas}`),
  ];
  let dikirim: HasilPerbaruiStatus["dikirim"] = null;
  if (baris.length && opsi.pengaturan.wa) {
    const penerima = await penerimaPeringatan(db, opsi.pengaturan);
    const pesan = `Pusat kesehatan ALETA (${waktu.slice(11, 16)} UTC)\n${baris.join("\n")}\nBuka Admin > Pusat kesehatan untuk rinciannya.`;
    dikirim = await (opsi.kirim ?? kirimPeringatanWhatsapp)(penerima, pesan, `${waktu.slice(0, 16)}`);
  }
  return { peringatan: peringatan.map((k) => k.kunci), pulih: pulih.map((k) => k.kunci), dikirim };
}

export async function catatRiwayatKesehatan(db: AletaDatabase, hasil: HasilKesehatan) {
  const ringkas = { warna: hasil.warna, komponen: Object.fromEntries(hasil.komponen.map((k) => [k.kunci, k.warna])) };
  await db.run("INSERT INTO aleta_kesehatan_riwayat (id, waktu, warna, ringkas_json) VALUES (?, ?, ?, ?)", [
    `kr-${randomUUID()}`,
    hasil.diukurPada,
    hasil.warna,
    JSON.stringify(ringkas),
  ]);
  const batas = new Date(new Date(hasil.diukurPada).getTime() - 14 * 86_400_000).toISOString();
  await db.run("DELETE FROM aleta_kesehatan_riwayat WHERE waktu < ?", [batas]);
}

export async function riwayatKesehatan(db: AletaDatabase, jam = 24): Promise<Array<{ waktu: string; warna: Warna; komponen: Record<string, Warna> }>> {
  const batas = new Date(Date.now() - jam * 3_600_000).toISOString();
  const baris = await db.queryAll<{ waktu: string; warna: string; ringkas_json: string }>(
    "SELECT waktu, warna, ringkas_json FROM aleta_kesehatan_riwayat WHERE waktu >= ? ORDER BY waktu DESC LIMIT 1500",
    [batas]
  );
  return baris.map((b) => {
    let komponen: Record<string, Warna> = {};
    try {
      komponen = (JSON.parse(b.ringkas_json) as { komponen?: Record<string, Warna> }).komponen ?? {};
    } catch {
      /* baris rusak: tanpa rincian */
    }
    return { waktu: b.waktu, warna: b.warna as Warna, komponen };
  });
}

/** Satu detak penjadwal: hanya bila saklar `berkala` menyala. */
export async function detakKesehatan(db: AletaDatabase, opsi: { deps?: DepsKesehatan; kirim?: KirimPeringatan; kini?: Date } = {}) {
  const pengaturan = await bacaPengaturanKesehatan(db);
  if (!pengaturan.berkala) return null;
  const hasil = await jalankanPemeriksaan(db, { ping: true, deps: opsi.deps });
  await catatRiwayatKesehatan(db, hasil);
  const status = await perbaruiStatus(db, hasil, { pengaturan, kirim: opsi.kirim, kini: opsi.kini });
  return { hasil, status };
}

const wadah = globalThis as typeof globalThis & { __kesehatanDetak?: ReturnType<typeof setInterval>; __kesehatanJalan?: boolean };

/** Dinyalakan instrumentation.ts. Matikan seluruhnya dengan ALETA_KESEHATAN_BERKALA=0. Saklar Super Admin tetap menjadi syarat. */
export function mulaiKesehatanBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_KESEHATAN_BERKALA === "0") return;
  if (wadah.__kesehatanDetak) return;
  const detak = async () => {
    if (wadah.__kesehatanJalan) return;
    wadah.__kesehatanJalan = true;
    try {
      await detakKesehatan(await getDb());
    } catch (e) {
      console.error("[Pusat kesehatan] detak gagal:", e);
    } finally {
      wadah.__kesehatanJalan = false;
    }
  };
  wadah.__kesehatanDetak = setInterval(() => void detak(), 60_000);
  wadah.__kesehatanDetak.unref?.();
}

// ---------------------------------------------------------------------------
// Lonceng portal
// ---------------------------------------------------------------------------

export type PemberitahuanKesehatan = { id: string; judul: string; uraian: string; waktu: string };

/** Komponen MERAH dua pemeriksaan berturut-turut -> lonceng Admin/Super Admin. Hanya ada isinya bila pemeriksaan berkala menyala. */
export async function pemberitahuanKesehatan(db: AletaDatabase): Promise<PemberitahuanKesehatan[]> {
  const baris = await db.queryAll<{ kunci: string; sejak: string; ringkas: string; diperiksa_at: string }>(
    "SELECT kunci, sejak, ringkas, diperiksa_at FROM aleta_kesehatan_status WHERE warna = 'merah' AND merah_berturut >= 2 ORDER BY sejak"
  );
  const nama = new Map(KOMPONEN.map((k) => [k.kunci, k.nama]));
  return baris.map((b) => ({
    id: `kesehatan:${b.kunci}`,
    judul: `Pusat kesehatan: ${nama.get(b.kunci) ?? b.kunci} merah`,
    uraian: `${b.ringkas} Merah sejak ${b.sejak.slice(0, 16).replace("T", " ")} UTC. Rincian di Admin > Pusat kesehatan.`,
    waktu: b.diperiksa_at,
  }));
}

/** Untuk lonceng: hanya Admin dan Super Admin. */
export function bolehLihatKesehatan(actor: Parameters<typeof getEffectiveRoleId>[0]): boolean {
  const peran = String(getEffectiveRoleId(actor) ?? "");
  return peran === "super-admin" || peran === "admin";
}
