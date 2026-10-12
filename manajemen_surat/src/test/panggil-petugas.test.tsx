/**
 * ============================================================================
 * PANGGIL PETUGAS SIDANG DAN PARA PIHAK - BUTIR 33, 34, 36, 37 (5 OKT 2026)
 * ============================================================================
 *
 * Yang dijaga, dan DIJALANKAN (bukan menyisir teks):
 *
 *   - saklar: chat petugas hidup, audio mati, chat pihak hidup; nama tanpa
 *     saklar digambar apa adanya;
 *   - pop-up MELAYANG di document.body (bukan sisipan di tabel), menyebut bot
 *     nonaktif, dan tombol audio hanya ada bila saklarnya dinyalakan;
 *   - bot: sasaran per orang (Hakim Ketua / Anggota masing-masing), baris
 *     kembar SIPP disatukan, kuasa dicabut tidak ikut, saksi hanya golongan saksi1/saksi2,
 *     nomor pihak + verifikasinya; riwayat menolak panggilan beruntun;
 *     pengumuman suara tidak memutar ulang yang lama;
 *   - portal: nomor petugas dari tautan akun SIPP / nama yang tunggal; bot
 *     NONAKTIF = tidak diantre, tidak disebut terkirim, tetap dicatat; nomor
 *     ditolak pemiliknya tidak dikirimi; belum terverifikasi menuntut
 *     persetujuan; pihak tidak dapat diumumkan lewat suara; rute menuntut
 *     kapabilitas "panel".
 *
 * Nama orang dan nomor telepon di sini karangan.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  KUNCI_SIMPANAN_PANGGIL,
  PERISTIWA_SAKLAR_PANGGIL,
  bacaPanggil,
  kalimatPengumuman,
  kalimatPesanPetugas,
  kalimatPesanPihak,
  namaDapatDiklik,
  panggilBawaan,
  samarkanNomor,
} from "@/lib/panggil-petugas";
import { langkahPengumuman } from "@/lib/pengumuman-suara-layar";

// ----------------------------------------------------------------------------
// Tiruan ketergantungan peladen portal
// ----------------------------------------------------------------------------

const tiruan = vi.hoisted(() => ({
  setelan: { botEnabled: false, notificationsEnabled: false, dryRunEnabled: true, exposesToken: false },
  bot: [] as Array<{ jalur: string; body?: unknown }>,
  sasaran: null as unknown,
  catatJawab: { ok: true, id: 41 } as Record<string, unknown>,
  kirim: vi.fn(),
  audit: vi.fn(),
  akses: vi.fn(),
  akun: [] as unknown[],
  pengguna: [] as unknown[],
}));

vi.mock("@/server/modules/panggil-petugas/gateway", () => ({
  panggilBotPanggil: async (jalur: string, pilihan: { body?: unknown } = {}) => {
    tiruan.bot.push({ jalur, body: pilihan.body });
    if (jalur.startsWith("/sasaran")) return { ok: true, data: tiruan.sasaran };
    if (jalur.startsWith("/catat")) return { ok: true, data: tiruan.catatJawab };
    if (jalur.startsWith("/riwayat")) return { ok: true, data: { ok: true, daftar: [] } };
    return { ok: true, data: { ok: true } };
  },
}));
vi.mock("@/server/modules/judicia/legal-form/jlf-aleta-bot-status-reader", () => ({
  getAletaBotSettingsSummary: async () => tiruan.setelan,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>()),
  getWhatsappRuntimeMode: () => "aleta_bot",
  getGatewayWhatsappStatus: async () => ({ ok: true, data: { status: "connected" } }),
}));
vi.mock("@/server/modules/whatsapp/portal-whatsapp-sender", () => ({
  sendPortalWhatsappMessage: (...a: unknown[]) => tiruan.kirim(...a),
}));
vi.mock("@/server/modules/aleta-ecourt/pemetaan-jabatan", () => ({
  bacaPemetaanJabatan: async () => ({ ok: true, galat: "", akun: tiruan.akun }),
}));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: (...a: unknown[]) => tiruan.audit(...a) }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({ prepare: () => ({ all: async () => tiruan.pengguna }) }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: (...a: unknown[]) => tiruan.akses(...a),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: Error) =>
    new Response(JSON.stringify({ ok: false, error: galat.message }), { status: 403 }),
}));

import { cariNomorPetugas, kunciNamaPegawai, lakukanPanggilan } from "@/server/modules/panggil-petugas/service";
import { NamaDapatDipanggil } from "@/components/portal/panggil-petugas";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Layanan = Record<string, (x?: unknown) => Promise<Record<string, unknown>>>;
const botPanggil = require_(path.join(AKAR, "aleta_bot/services/panggilPetugasService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  ambilNomor: (t: string) => string;
};
const kelengkapan = require_(path.join(AKAR, "aleta_bot/services/kelengkapanDataService.js")) as Record<string, unknown>;

function kueriTiruan(jawab: (sql: string, params: unknown[]) => unknown) {
  const catatan: Array<{ sql: string; params: unknown[] }> = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    const rapi = sql.replace(/\s+/g, " ").trim();
    catatan.push({ sql: rapi, params });
    return jawab(rapi, params);
  };
  return { kueri, catatan };
}

beforeEach(() => {
  tiruan.bot = [];
  tiruan.kirim.mockReset();
  tiruan.audit.mockReset();
  tiruan.akses.mockReset();
  tiruan.akses.mockResolvedValue({ name: "Petugas Uji" });
  tiruan.setelan = { botEnabled: false, notificationsEnabled: false, dryRunEnabled: true, exposesToken: false };
  tiruan.catatJawab = { ok: true, id: 41 };
  tiruan.akun = [];
  tiruan.pengguna = [];
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ============================================================================
// ATURAN MURNI
// ============================================================================

describe("saklar dan kalimat (butir 37)", () => {
  it("bawaan: chat petugas hidup, audio MATI, chat pihak hidup", () => {
    expect(panggilBawaan()).toEqual({
      "panggil-petugas-chat": true,
      "panggil-petugas-audio": false,
      "panggil-pihak-chat": true,
      // Lanjutan butir 23 (6 Okt 2026) - bawaannya mati seperti audio petugas.
      "panggil-pihak-audio": false,
    });
  });

  it("simpanan rusak / asing / bukan boolean tidak dipercaya", () => {
    expect(bacaPanggil("{rusak")).toEqual(panggilBawaan());
    expect(bacaPanggil(JSON.stringify({ "panggil-petugas-audio": "ya", lain: true }))).toEqual(panggilBawaan());
    expect(bacaPanggil(JSON.stringify({ "panggil-pihak-chat": false }))["panggil-pihak-chat"]).toBe(false);
  });

  it("nama petugas tetap dapat diklik bila hanya audio yang hidup; nama pihak mengikuti saklarnya sendiri", () => {
    const hanyaAudio = { "panggil-petugas-chat": false, "panggil-petugas-audio": true, "panggil-pihak-chat": false, "panggil-pihak-audio": false };
    expect(namaDapatDiklik(hanyaAudio, "majelis")).toBe(true);
    expect(namaDapatDiklik(hanyaAudio, "pihak1")).toBe(false);
    // Pihak dengan audio saja tetap dapat diklik.
    expect(namaDapatDiklik({ ...hanyaAudio, "panggil-pihak-audio": true }, "pihak4")).toBe(true);
  });

  it("nomor disamarkan, dan kalimatnya memuat ruang, perkara, agenda, pemanggil", () => {
    expect(samarkanNomor("6281234567890")).toBe("6281****890");
    expect(samarkanNomor("")).toBe("");
    expect(
      kalimatPesanPetugas({ ruang: "Ruang Sidang 1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", agenda: "Pembuktian", pemanggil: "Rina" })
    ).toBe("Mohon hadir di Ruang Sidang 1 untuk perkara 1/Pdt.G/2026/PA.Dgl (Pembuktian) - dipanggil dari ALETA oleh Rina.");
    expect(kalimatPesanPihak({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", pemanggil: "Rina", sebutan: "Penggugat" })).toContain(
      "dipanggil masuk ruang sidang"
    );
    expect(kalimatPengumuman({ peran: "Hakim Ketua", nama: "Budi", ruang: "Ruang Sidang 2", nomorPerkara: "9/Pdt.G/2026" })).toBe(
      "Panggilan untuk Hakim Ketua Budi, mohon hadir di Ruang Sidang 2 untuk perkara nomor 9/Pdt.G/2026."
    );
  });

  it("layar yang baru dibuka tidak memutar pengumuman lama; sesudahnya hanya yang baru", () => {
    expect(langkahPengumuman(null, { terakhirId: 7, daftar: [{ id: 7, teks: "lama" }] })).toEqual({ ucapkan: [], sejakId: 7 });
    expect(
      langkahPengumuman(7, { terakhirId: 9, daftar: [{ id: 7, teks: "lama" }, { id: 8, teks: "a" }, { id: 9, teks: "b" }] })
    ).toEqual({ ucapkan: ["a", "b"], sejakId: 9 });
  });
});

// ============================================================================
// BOT: SASARAN, RIWAYAT, PENGUMUMAN
// ============================================================================

function sippTiruan() {
  return kueriTiruan((sql) => {
    if (sql.includes("FROM perkara WHERE")) {
      return [{ nomorPerkara: "77/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 346, jenisPerkaraNama: "Cerai Talak" }];
    }
    if (sql.includes("FROM perkara_hakim_pn")) {
      return [
        { id: 3, nama: "Dr. Ahmad Ketua, S.H.I., M.H.", jabatanId: 1, jabatan: "Hakim Ketua", urutan: 1, aktif: "Y" },
        { id: 5, nama: "Siti Anggota, S.Ag.", jabatanId: 2, jabatan: "Hakim Anggota", urutan: 2, aktif: "Y" },
        { id: 5, nama: "Siti Anggota", jabatanId: 2, jabatan: "Hakim Anggota", urutan: 2, aktif: "Y" },
        { id: 8, nama: "Rudi Anggota Lama", jabatanId: 2, jabatan: "Hakim Anggota", urutan: 3, aktif: "T" },
        { id: 9, nama: "Yusuf Anggota, M.H.", jabatanId: 2, jabatan: "Hakim Anggota", urutan: 3, aktif: "Y" },
      ];
    }
    if (sql.includes("FROM perkara_panitera_pn")) return [{ id: 11, nama: "Nur Panitera, S.H.", urutan: 1, aktif: "Y" }];
    if (sql.includes("FROM perkara_jurusita")) return [{ id: 21, nama: "Hasan Jurusita", urutan: 1, aktif: "Y" }];
    if (sql.includes("FROM perkara_mediator")) return [];
    if (sql.includes("FROM perkara_pihak1")) return [{ id: 101, nama: "Andi Pemohon", urutan: 1, telepon: "0812-3456-7890 / 0813" }];
    if (sql.includes("FROM perkara_pihak2")) return [{ id: 102, nama: "Wati Termohon", urutan: 1, telepon: "00000" }];
    if (sql.includes("FROM perkara_pengacara")) {
      // Kueri sungguhan menyaring aktif = 'Y' - kuasa yang dicabut tidak pernah sampai ke sini.
      expect(sql).toContain("a.aktif = 'Y'");
      return [{ id: 201, nama: "Advokat Kuasa", pihakKe: 2, urutan: 1, telepon: "081299990000" }];
    }
    if (sql.includes("FROM perkara_jadwal_sidang")) return [{ ruangan: "Ruang Sidang Utama", agenda: "Pembuktian" }];
    return [];
  });
}

describe("bot: sasaran panggilan dari SIPP", () => {
  it("tiap hakim dengan perannya sendiri, baris kembar disatukan, yang tidak aktif tidak ikut", async () => {
    const sipp = sippTiruan();
    const L = botPanggil.buatLayanan({
      kueriSipp: sipp.kueri,
      kueriBot: async () => [],
      statusNomor: async (nomor: string) => (nomor === "6281299990000" ? { status: "ditolak" } : null),
    });
    const hasil = (await L.sasaran({ perkaraId: "77", tanggal: "2026-10-05" })) as Record<string, any>;
    expect(hasil.ok).toBe(true);
    expect(hasil.petugas.majelis.map((x: { peran: string; nama: string }) => `${x.peran}: ${x.nama}`)).toEqual([
      "Hakim Ketua: Dr. Ahmad Ketua, S.H.I., M.H.",
      "Hakim Anggota: Siti Anggota, S.Ag.",
      "Hakim Anggota: Yusuf Anggota, M.H.",
    ]);
    expect(hasil.petugas.pp[0].nama).toBe("Nur Panitera, S.H.");
    expect(hasil.perkara.ruang).toBe("Ruang Sidang Utama");

    const pihak = hasil.pihak as Array<Record<string, string>>;
    expect(pihak.map((p) => p.kunci)).toEqual(["pihak1:101", "pihak2:102", "kuasa2:201"]);
    expect(pihak[0]).toMatchObject({ nomor: "6281234567890", statusNomor: "belum-terverifikasi" });
    expect(pihak[1]).toMatchObject({ nomor: "", statusNomor: "bermasalah" });
    expect(pihak[2]).toMatchObject({ statusNomor: "bermasalah", jenis: "kuasa", golongan: "pihak2" });
    // Saksi dibaca (12 Okt 2026, butir 4) HANYA dari perkara_pihak5, dan bergolongan
    // saksi1/saksi2 - tidak pernah bercampur dengan pihak1/pihak2 di atas.
    expect(sipp.catatan.filter((c) => /saksi/i.test(c.sql)).every((c) => c.sql.includes("FROM perkara_pihak5"))).toBe(true);
    expect(pihak.some((p) => String(p.golongan).startsWith("saksi"))).toBe(false); // sippTiruan tanpa saksi
  });

  it("isian telepon SIPP: yang tidak sah dianggap tidak ada, bukan ditebak", () => {
    expect(botPanggil.ambilNomor("00000")).toBe("");
    expect(botPanggil.ambilNomor("-")).toBe("");
    expect(botPanggil.ambilNomor("082271268189 ")).toBe("6282271268189");
    expect(botPanggil.ambilNomor("0811 / 085656679339")).toBe("6285656679339");
  });

  it("panggilan beruntun ke orang yang sama ditolak, dengan nama pemanggil sebelumnya", async () => {
    const bot = kueriTiruan((sql) => {
      if (sql.startsWith("SELECT id, oleh")) return [{ id: 1, oleh: "Rina", jam: "09:10" }];
      return [];
    });
    const L = botPanggil.buatLayanan({ kueriSipp: async () => [], kueriBot: bot.kueri });
    const hasil = await L.catat({ perkaraId: "77", saluran: "whatsapp", sasaranKunci: "hakim:3", oleh: "Budi" });
    expect(hasil).toMatchObject({ ok: false, alasan: "baru_saja_dipanggil" });
    expect(String(hasil.pesan)).toContain("Rina");
    expect(bot.catatan.some((c) => c.sql.startsWith("INSERT"))).toBe(false);
  });

  it("pengumuman: tanpa titik mula hanya id terakhir; sesudahnya hanya audio yang diumumkan", async () => {
    const bot = kueriTiruan((sql) => {
      if (sql.includes("MAX(id)")) return [{ id: 12 }];
      if (sql.includes("saluran = 'audio' AND hasil = 'diumumkan'")) return [{ id: 13, teks: "Panggilan untuk Hakim", ruang: "" }];
      return [];
    });
    const L = botPanggil.buatLayanan({ kueriSipp: async () => [], kueriBot: bot.kueri });
    expect(await L.pengumuman({})).toMatchObject({ ok: true, terakhirId: 12, daftar: [] });
    const lanjut = await L.pengumuman({ sejakId: "12" });
    expect(lanjut).toMatchObject({ terakhirId: 13 });
    expect((lanjut.daftar as unknown[]).length).toBe(1);
  });
});

// ============================================================================
// PORTAL: NOMOR PETUGAS DAN PANGGILAN
// ============================================================================

describe("portal: nomor petugas dari akun ALETA", () => {
  const pengguna = [
    { id: "u1", name: "AHMAD KETUA, S.H.I., M.H.", whatsapp_number: "081111111111" },
    { id: "u2", name: "Siti Anggota", whatsapp_number: "082222222222" },
    { id: "u3", name: "Siti Anggota Dua", whatsapp_number: "083333333333" },
  ];

  it("tautan akun SIPP didahulukan dan disebut terverifikasi", () => {
    const hasil = cariNomorPetugas(
      { golongan: "majelis", pejabatId: "3", nama: "Nama Lain Sama Sekali" },
      pengguna,
      [{ jabatan: "hakim", pejabatId: "3", pemilikUserId: "u1", diblokir: false }]
    );
    expect(hasil).toMatchObject({ nomor: "6281111111111", statusNomor: "terverifikasi" });
  });

  it("tanpa tautan: nama tanpa gelar yang TUNGGAL cocok - belum terverifikasi", () => {
    const hasil = cariNomorPetugas({ golongan: "majelis", pejabatId: "3", nama: "Dr. Ahmad Ketua" }, pengguna, []);
    expect(hasil).toMatchObject({ nomor: "6281111111111", statusNomor: "belum-terverifikasi" });
  });

  it("kunci nama portal sama dengan kunci nama bot", () => {
    const bot = kelengkapan.namaKunci as (n: string) => string;
    for (const nama of ["Drs. H. ABDUL SALAM, M.H.", "Hj. Siti Rahma, S.Ag.", "Muhammad Abdul Salam", "SUDARMIN H.I.M. TANG, S.H.I.,M.H"]) {
      expect(kunciNamaPegawai(nama)).toBe(bot(nama));
    }
    expect(kunciNamaPegawai("Drs. H. ABDUL SALAM, M.H.")).toBe("abdul salam");
  });

  it("tidak ada akun yang cocok = tanpa nomor, tidak ditebak", () => {
    expect(cariNomorPetugas({ golongan: "js", pejabatId: "21", nama: "Hasan Jurusita" }, pengguna, []).nomor).toBe("");
  });
});

function sasaranBot() {
  return {
    ok: true,
    perkara: {
      perkaraId: "77",
      nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
      alurPerkaraId: 15,
      jenisPerkaraId: 346,
      jenisPerkaraNama: "Cerai Talak",
      ruang: "Ruang Sidang Utama",
      agenda: "Pembuktian",
    },
    petugas: {
      majelis: [{ kunci: "hakim:3", golongan: "majelis", pejabatId: "3", nama: "Ahmad Ketua", peran: "Hakim Ketua" }],
      pp: [],
      js: [],
      mediator: [],
    },
    pihak: [
      { kunci: "pihak1:101", golongan: "pihak1", jenis: "pihak", nama: "Andi", nomor: "6281234567890", statusNomor: "belum-terverifikasi", keteranganNomor: "belum dijawab" },
      { kunci: "pihak2:102", golongan: "pihak2", jenis: "pihak", nama: "Wati", nomor: "6281299990000", statusNomor: "bermasalah", keteranganNomor: "pemilik menjawab BUKAN" },
      { kunci: "kuasa2:201", golongan: "pihak2", jenis: "kuasa", nama: "Advokat", nomor: "6281288880000", statusNomor: "terverifikasi", keteranganNomor: "dijawab YA" },
    ],
    tidakTerbaca: [],
  };
}

const PELAKU = { id: "usr_uji", nama: "Petugas Uji", ip: "10.0.0.5" };
const db = { prepare: () => ({ all: async () => tiruan.pengguna }) } as never;

describe("portal: panggilan WhatsApp dan suara", () => {
  beforeEach(() => {
    tiruan.sasaran = sasaranBot();
    tiruan.pengguna = [{ id: "u1", name: "Ahmad Ketua", whatsapp_number: "081111111111" }];
    tiruan.akun = [{ jabatan: "hakim", pejabatId: "3", pemilikUserId: "u1", diblokir: false }];
  });

  it("bot NONAKTIF: tidak diantre, tidak disebut terkirim, tetapi riwayatnya dicatat", async () => {
    const hasil = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "hakim:3", saluran: "whatsapp" });
    expect(hasil.ok).toBe(false);
    expect(hasil.hasil).toBe("tidak_dikirim");
    expect(hasil.pesan).toMatch(/NONAKTIF/);
    expect(tiruan.kirim).not.toHaveBeenCalled();
    const catat = tiruan.bot.find((x) => x.jalur === "/catat");
    expect(catat?.body).toMatchObject({ saluran: "whatsapp", sasaranKunci: "hakim:3", oleh: "Petugas Uji", ip: "10.0.0.5" });
    expect(tiruan.bot.find((x) => x.jalur === "/perbarui")?.body).toMatchObject({ id: 41, hasil: "tidak_dikirim" });
    expect(tiruan.audit).toHaveBeenCalled();
  });

  it("bot aktif: pesan petugas masuk antrean dengan kalimat yang diminta", async () => {
    tiruan.setelan = { botEnabled: true, notificationsEnabled: true, dryRunEnabled: false, exposesToken: false };
    tiruan.kirim.mockResolvedValue({ ok: true, status: "enqueued", queueId: 900, message: "ok" });
    const hasil = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "hakim:3", saluran: "whatsapp" });
    expect(hasil).toMatchObject({ ok: true, hasil: "diantre" });
    expect(tiruan.kirim).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientNumber: "6281111111111",
        category: "employee",
        message:
          "Mohon hadir di Ruang Sidang Utama untuk perkara 77/Pdt.G/2026/PA.Dgl (Pembuktian) - dipanggil dari ALETA oleh Petugas Uji.",
      })
    );
  });

  it("nomor yang pemiliknya menjawab BUKAN tidak pernah dikirimi", async () => {
    tiruan.setelan = { botEnabled: true, notificationsEnabled: true, dryRunEnabled: false, exposesToken: false };
    const hasil = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "pihak2:102", saluran: "whatsapp" });
    expect(hasil.hasil).toBe("nomor_bermasalah");
    expect(tiruan.kirim).not.toHaveBeenCalled();
  });

  it("nomor pihak yang belum terverifikasi menuntut persetujuan tegas; sesudahnya sebagai pihak (party)", async () => {
    tiruan.setelan = { botEnabled: true, notificationsEnabled: true, dryRunEnabled: false, exposesToken: false };
    tiruan.kirim.mockResolvedValue({ ok: true, status: "enqueued", queueId: 901, message: "ok" });
    const pertama = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "pihak1:101", saluran: "whatsapp" });
    expect(pertama.hasil).toBe("perlu_persetujuan");
    expect(tiruan.kirim).not.toHaveBeenCalled();
    const kedua = await lakukanPanggilan(db, PELAKU, {
      perkaraId: "77",
      konteks: "sidang",
      kunci: "pihak1:101",
      saluran: "whatsapp",
      setujuBelumTerverifikasi: true,
    });
    expect(kedua.hasil).toBe("diantre");
    expect(tiruan.kirim).toHaveBeenCalledWith(expect.objectContaining({ category: "party", recipientNumber: "6281234567890" }));
    expect(String(tiruan.kirim.mock.calls[0][0].message)).toContain("Pemohon");
  });

  it("pihak (lanjutan butir 23) dan petugas dapat diumumkan lewat suara", async () => {
    const pihak = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "kuasa2:201", saluran: "audio" });
    expect(pihak).toMatchObject({ ok: true, hasil: "diumumkan" });
    expect(String(pihak.teks)).toMatch(/^Panggilan untuk Kuasa .* atas nama .*, perkara nomor 77\/Pdt\.G\/2026\/PA\.Dgl, dipersilakan masuk ke /);
    tiruan.bot.length = 0;
    const hakim = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "hakim:3", saluran: "audio" });
    expect(hakim).toMatchObject({ ok: true, hasil: "diumumkan" });
    expect(tiruan.bot.find((x) => x.jalur === "/catat")?.body).toMatchObject({
      saluran: "audio",
      hasil: "diumumkan",
      teks: "Panggilan untuk Hakim Ketua Ahmad Ketua, mohon hadir di Ruang Sidang Utama untuk perkara nomor 77/Pdt.G/2026/PA.Dgl.",
    });
  });

  it("orang yang tidak ada di SIPP (mis. saksi, kunci karangan) ditolak", async () => {
    const hasil = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "saksi:1", saluran: "whatsapp" });
    expect(hasil.hasil).toBe("ditolak");
  });
});

describe("rute: hanya peran berwenang", () => {
  async function post(badan: unknown) {
    const mod = await import("@/app/api/aleta-ecourt/panggil/route");
    const permintaan = new Request("http://uji.local/api/aleta-ecourt/panggil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(badan),
    });
    return mod.POST(permintaan as never);
  }

  it("kapabilitas 'panel' dituntut; yang ditolak tidak memicu apa pun", async () => {
    tiruan.sasaran = sasaranBot();
    tiruan.akses.mockRejectedValue(new Error("Tidak berwenang"));
    const jawaban = await post({ perkaraId: "77", kunci: "hakim:3", saluran: "whatsapp" });
    expect(jawaban.status).toBe(403);
    expect(tiruan.akses).toHaveBeenCalledWith(expect.anything(), "usr_uji", "panel");
    expect(tiruan.bot).toEqual([]);
    expect(tiruan.kirim).not.toHaveBeenCalled();
  });
});

// ============================================================================
// LAYAR: POP-UP MELAYANG
// ============================================================================

function pasangFetchSasaran() {
  const panggilan: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      panggilan.push(String(alamat));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            available: true,
            orang: [
              { kunci: "hakim:3", golongan: "majelis", nama: "Ahmad Ketua", peran: "Hakim Ketua", jenis: "petugas", nomorTersamar: "6281****111", statusNomor: "terverifikasi", keteranganNomor: "tertaut" },
              { kunci: "hakim:5", golongan: "majelis", nama: "Siti Anggota", peran: "Hakim Anggota", jenis: "petugas", nomorTersamar: "", statusNomor: "tidak-ada", keteranganNomor: "tidak ada akun" },
            ],
            whatsapp: { dapatKirim: false, alasan: "Bot WhatsApp ALETA sedang NONAKTIF (Pengaturan ALETA Bot)." },
            riwayat: [],
            tidakTerbaca: [],
          },
        }),
      } as unknown as Response;
    })
  );
  return panggilan;
}

function gambarTabel(golongan: "majelis" | "pihak1") {
  return render(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement(
          "tr",
          null,
          createElement(
            "td",
            null,
            createElement(NamaDapatDipanggil, {
              golongan,
              perkaraId: "77",
              tanggal: "2026-10-05",
              nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
              ruang: "Ruang Sidang Utama",
              children: golongan === "majelis" ? "Ahmad Ketua, Siti Anggota" : "Andi",
            })
          )
        )
      )
    )
  );
}

describe("layar: nama yang dapat dipanggil", () => {
  it("klik nama membuka pop-up DI LUAR tabel, per hakim, dan menyebut bot nonaktif", async () => {
    const panggilan = pasangFetchSasaran();
    const { container } = gambarTabel("majelis");
    const selSebelum = container.querySelector("td")!.innerHTML;
    fireEvent.click(screen.getByRole("button", { name: "Ahmad Ketua, Siti Anggota" }));
    const dialog = await screen.findByRole("dialog");
    // Melayang: bukan anak tabel, sel tabel tidak bertambah isi.
    expect(container.querySelector("table")!.contains(dialog)).toBe(false);
    expect(dialog.style.position).toBe("fixed");
    // Sel tabelnya tidak bertambah isi apa pun selain penanda aria-expanded.
    expect(container.querySelector("td")!.innerHTML.replace('aria-expanded="true"', 'aria-expanded="false"')).toBe(selSebelum);
    await waitFor(() => expect(dialog.textContent).toContain("NONAKTIF"));
    expect(dialog.textContent).toContain("Hakim Ketua");
    expect(dialog.textContent).toContain("Hakim Anggota");
    expect(panggilan[0]).toContain("golongan=majelis");
    // Bawaan: chat saja, tanpa audio.
    expect(screen.getAllByRole("button", { name: /Panggil \(chat WhatsApp\)/ }).length).toBe(2);
    expect(screen.queryByRole("button", { name: /audio speaker/ })).toBeNull();
  });

  it("menyalakan saklar audio menambah tombol audio tanpa memuat ulang halaman", async () => {
    pasangFetchSasaran();
    gambarTabel("majelis");
    fireEvent.click(screen.getByRole("button", { name: "Ahmad Ketua, Siti Anggota" }));
    await screen.findAllByRole("button", { name: /Panggil \(chat WhatsApp\)/ });
    act(() => {
      window.localStorage.setItem(KUNCI_SIMPANAN_PANGGIL, JSON.stringify({ "panggil-petugas-audio": true }));
      window.dispatchEvent(new Event(PERISTIWA_SAKLAR_PANGGIL));
    });
    expect(screen.getAllByRole("button", { name: /Panggil \(audio speaker\)/ }).length).toBe(2);
  });

  it("saklar chat pihak dimatikan: nama pihak digambar apa adanya, tanpa tombol", () => {
    window.localStorage.setItem(KUNCI_SIMPANAN_PANGGIL, JSON.stringify({ "panggil-pihak-chat": false }));
    gambarTabel("pihak1");
    expect(screen.getByText("Andi").tagName).toBe("TD");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
