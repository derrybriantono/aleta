/**
 * ============================================================================
 * JADWAL SIDANG PORTAL - PERBAIKAN 1 OKTOBER 2026 (agen J: J1-J8, K5)
 * ============================================================================
 *
 *   J1  pilih mediator di Jadwal Sidang & Hasil Sidang - jalur tulis SIPP
 *       baru, persis blangko "Penetapan Mediasi" (diuji dengan basis data
 *       TIRUAN; tidak ada yang ditulis ke SIPP sungguhan)
 *   J2  tombol Selesai sinkron dua arah dengan antrian (antrian.status = 2)
 *   J3  kerangka ALETA e-Court lebih lebar di layar lebar
 *   J4  layar penuh berjendela
 *   J5  Mode lengkap / Mode minimalis di paling atas panel Tampilan
 *   J6  Majelis & petugas dan Identitas pihak terlipat sebagai bawaan
 *   J7  proses mediasi di rincian (hanya bila ada)
 *   J8  tombol unduh per riwayat panggilan, bernama sesuai dokumennya
 *   K5  aksi & lencana e-Court (komponen agen E) terpasang
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DIKECUALIKAN_MODE_LENGKAP,
  HASIL_MEDIASI,
  JENIS_PENETAPAN_MEDIATOR,
  bawaanPenetapanMediator,
  keadaanSelesai,
  kunciSelesai,
  modeTampilanAktif,
  namaBerkasRelaas,
  namaDokumenRelaas,
  periksaIsianMediator,
  ringkasMediasi,
  tampilanModeLengkap,
  tampilanModeMinimalis,
  type ProsesMediasi,
} from "@/lib/jadwal-sidang-1okt";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

const SIDANG = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const HASIL = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");
const PENGGUNA = baca("manajemen_surat/src/components/portal/aleta-ecourt-pengguna.tsx");
const KOMPONEN = baca("manajemen_surat/src/components/portal/jadwal-sidang-1okt.tsx");

type Layanan = Record<string, (...a: never[]) => Promise<Record<string, unknown>>>;
const mediatorMod = require_(path.join(AKAR, "aleta_bot/services/mediatorTulisService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  waktuDuaBelas: (s: string) => string;
  keteranganAudit: (n: Record<string, unknown>) => string;
  JENIS_PENETAPAN: Array<{ nilai: string; label: string }>;
  HASIL_MEDIASI: Record<string, string>;
  DAFTAR_TABEL_MEDIATOR: Set<string>;
  TANDA: Record<string, string>;
};
const selesaiMod = require_(path.join(AKAR, "aleta_bot/services/sidangSelesaiService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  nilaiDisidangSelesai: (s?: string) => number | null;
  kunciSelesai: (p: string, t: string) => string;
  ANTRIAN_SELESAI: number;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ============================================================================
// J5 - MODE LENGKAP / MINIMALIS
// ============================================================================

describe("J5 - Mode lengkap dan Mode minimalis", () => {
  it("Mode lengkap: semua menyala KECUALI Kolom Siap dan Catatan cara menghitung", () => {
    expect([...DIKECUALIKAN_MODE_LENGKAP]).toEqual(["kolom-siap", "catatan-cara-hitung", "ciutkan-selesai"]);
    const lengkap = tampilanModeLengkap();
    for (const s of SAKLAR_TAMPILAN) {
      const harap = s.wajib ? true : !["kolom-siap", "catatan-cara-hitung", "ciutkan-selesai"].includes(s.kunci);
      expect(tampil(lengkap, s.kunci), s.kunci).toBe(harap);
    }
    // Sama dengan keadaan bawaan - Mode lengkap tidak mengubah layar orang yang
    // belum pernah menyentuh panelnya.
    expect(modeTampilanAktif(tampilanBawaan())).toBe("lengkap");
  });

  it("Mode minimalis: semua mati, yang wajib tetap menyala", () => {
    const mini = tampilanModeMinimalis();
    for (const s of SAKLAR_TAMPILAN) expect(tampil(mini, s.kunci), s.kunci).toBe(Boolean(s.wajib));
    expect(modeTampilanAktif(mini)).toBe("minimalis");
  });

  it("mengubah satu centang menjadikannya 'suai' - tombol mode tidak menyala lagi", () => {
    const ubah = { ...tampilanModeLengkap(), "kolom-siap": true };
    expect(modeTampilanAktif(ubah)).toBe("suai");
    const ubah2 = { ...tampilanModeMinimalis(), retur: false, "umur-perkara": true };
    expect(modeTampilanAktif(ubah2)).toBe("suai");
  });

  it("tombol mode berada PALING ATAS panel, di atas kelompok Penanda", () => {
    const iMode = SIDANG.indexOf('aria-label="Mode tampilan"');
    const iKelompok = SIDANG.indexOf("{kelompokTampilan().map((kelompok) => (");
    expect(iMode).toBeGreaterThan(-1);
    expect(iKelompok).toBeGreaterThan(iMode);
    const blok = SIDANG.slice(iMode, iKelompok);
    expect(blok).toContain("Mode lengkap");
    expect(blok).toContain("Mode minimalis");
    expect(blok).toContain('aria-pressed={modeTampilan === "lengkap"}');
    expect(blok).toContain('aria-pressed={modeTampilan === "minimalis"}');
    // Memilih mode MENGUBAH centangnya: kedua tombol menulis pilihan, bukan
    // menyimpan "mode" tersendiri.
    expect(SIDANG).toContain("const baru = tampilanModeLengkap();");
    expect(SIDANG).toContain("const baru = tampilanSemuaMati();");
    expect(SIDANG).toContain("modeTampilanAktif(tampilan)");
  });
});

// ============================================================================
// J2 - SELESAI SINKRON DUA ARAH
// ============================================================================

describe("J2 - keadaan Selesai satu baris", () => {
  const baris = { perkaraId: "10063", tanggalSidang: "2026-10-01" };

  it("kunci peta portal SAMA dengan kunci bot", () => {
    expect(kunciSelesai("10063", "2026-10-01")).toBe(selesaiMod.kunciSelesai("10063", "2026-10-01"));
  });

  it("antrian berstatus selesai menghijaukan baris ALETA (arah antrian -> ALETA)", () => {
    const k = keadaanSelesai(baris, false, {
      "10063|2026-10-01": { perkaraId: "10063", tanggalSidang: "2026-10-01", sumber: ["antrian-sipp"] },
    });
    expect(k.hijau).toBe(true);
    expect(k.bolehBatal).toBe(true);
    expect(k.keterangan).toContain("antrian sidang SIPP");
  });

  it("hasil sidang tercatat tetap hijau dan TIDAK dapat dibatalkan dari tombol ini", () => {
    const k = keadaanSelesai(baris, true, {});
    expect(k).toMatchObject({ hijau: true, dariHasilSidang: true, ditandai: false, bolehBatal: false });
  });

  it("tanpa apa pun: belum selesai", () => {
    expect(keadaanSelesai(baris, false, {}).hijau).toBe(false);
    // Tanggal lain untuk perkara yang sama tidak ikut hijau.
    const k = keadaanSelesai(baris, false, {
      "10063|2026-09-24": { perkaraId: "10063", tanggalSidang: "2026-09-24", sumber: ["aleta"] },
    });
    expect(k.hijau).toBe(false);
  });

  it("layar: hijau baris dari selesaiTanda; sidangSelesai tetap dari hasil sidang saja", () => {
    expect(SIDANG).toContain("const sidangSelesai = sidangSelesaiHariIni(baris);");
    expect(SIDANG).toContain("const selesaiTanda = keadaanSelesai(baris, sidangSelesai, tandaSelesai.peta);");
    expect(SIDANG).toMatch(/selesaiTanda\.hijau &&\s+dibuka !== kunci &&\s+"border-l-4 border-l-emerald-500/);
    // Tombol tunda|putus tetap disembunyikan HANYA oleh hasil sidang - sidang
    // yang ditandai selesai tetap harus dapat dicatat hasilnya.
    expect(SIDANG).toContain("{sidangSelesai ? null : (");
    expect(SIDANG).toContain("<TombolSelesaiSidang");
    expect(SIDANG).toContain("const tandaSelesai = useSelesaiSidang(dari, sampai, sidang);");
  });
});

/** Tiruan basis data - mencatat tiap SQL, menjawab menurut polanya. */
function tiruan(jawab: (sql: string, params: unknown[]) => unknown) {
  const catatan: Array<{ sql: string; params: unknown[] }> = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    catatan.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    return jawab(sql.replace(/\s+/g, " ").trim(), params);
  };
  return { kueri, catatan };
}

describe("J2 - layanan bot sidangSelesaiService (basis data tiruan)", () => {
  it("nilai selesai mesin ruang tunggu: BAWAAN 10 (arti aplikasi antrian, 5 Okt 2026); lingkungan menimpa atau mematikan", () => {
    // Sampai 1.183.0 bawaannya null (mati) dan 10 ditolak sebagai "dipanggil".
    expect(selesaiMod.nilaiDisidangSelesai("")).toBe(10);
    expect(selesaiMod.nilaiDisidangSelesai(undefined)).toBe(10);
    expect(selesaiMod.nilaiDisidangSelesai("10")).toBe(10);
    expect(selesaiMod.nilaiDisidangSelesai("abc")).toBe(10);
    // Nomor ruang = "sedang disidang", tidak mungkin "selesai".
    expect(selesaiMod.nilaiDisidangSelesai("3")).toBe(10);
    expect(selesaiMod.nilaiDisidangSelesai("20")).toBe(20);
    expect(selesaiMod.nilaiDisidangSelesai("mati")).toBeNull();
  });

  it("peta menggabungkan catatan ALETA dan antrian SIPP status 2; ruang tunggu tidak dibaca bila tidak disetel", async () => {
    const bot = tiruan((sql) =>
      sql.startsWith("SELECT") ? [{ perkaraId: "1", tanggalSidang: "2026-10-01", oleh: "Ani", ditandaiPada: "x" }] : []
    );
    const sipp = tiruan(() => [{ perkaraId: "2", tanggalSidang: "2026-10-01" }]);
    const ruang = tiruan(() => []);
    const L = selesaiMod.buatLayanan({
      kueriBot: bot.kueri,
      kueriSipp: sipp.kueri,
      kueriRuangTunggu: ruang.kueri,
      disidangSelesai: null,
      // Sejak 5 Okt 2026 "proses" bawaannya menyala - di sini dimatikan tegas.
      disidangProses: null,
      setelAntrian: async () => ({ ok: true }),
    });
    const hasil = (await (L.petaSelesai as (x: unknown) => Promise<Record<string, unknown>>)({
      dari: "2026-10-01",
      sampai: "2026-10-01",
    })) as { peta: Record<string, { sumber: string[] }>; sumber: Record<string, { terbaca: boolean }> };
    expect(hasil.peta["1|2026-10-01"].sumber).toEqual(["aleta"]);
    expect(hasil.peta["2|2026-10-01"].sumber).toEqual(["antrian-sipp"]);
    expect(sipp.catatan[0].sql).toContain("FROM antrian WHERE tanggal_sidang BETWEEN ? AND ? AND status = ?");
    expect(sipp.catatan[0].params).toEqual(["2026-10-01", "2026-10-01", selesaiMod.ANTRIAN_SELESAI]);
    expect(ruang.catatan).toHaveLength(0);
    expect(hasil.sumber.antrianSipp.terbaca).toBe(true);
  });

  it("sumber yang gagal tidak menjatuhkan yang lain", async () => {
    const L = selesaiMod.buatLayanan({
      kueriBot: async (sql: string) => (sql.startsWith("SELECT") ? [{ perkaraId: "1", tanggalSidang: "2026-10-01" }] : []),
      kueriSipp: async () => {
        throw new Error("SIPP mati");
      },
      kueriRuangTunggu: async () => [],
      disidangSelesai: null,
      setelAntrian: async () => ({ ok: true }),
    });
    const hasil = (await (L.petaSelesai as (x: unknown) => Promise<Record<string, unknown>>)({ dari: "2026-10-01" })) as {
      peta: Record<string, unknown>;
      sumber: { antrianSipp: { terbaca: boolean; alasan: string } };
    };
    expect(Object.keys(hasil.peta)).toEqual(["1|2026-10-01"]);
    expect(hasil.sumber.antrianSipp).toMatchObject({ terbaca: false, alasan: "SIPP mati" });
  });

  it("KERING sebagai bawaan: tidak satu tulisan pun", async () => {
    const bot = tiruan(() => []);
    const setel = vi.fn(async () => ({ ok: true }));
    const L = selesaiMod.buatLayanan({ kueriBot: bot.kueri, kueriSipp: async () => [], kueriRuangTunggu: async () => [], disidangSelesai: 20, setelAntrian: setel });
    const hasil = await (L.setelSelesai as (x: unknown) => Promise<Record<string, unknown>>)({ perkaraId: "5", tanggalSidang: "2026-10-01" });
    expect(hasil.kering).toBe(true);
    expect(bot.catatan).toHaveLength(0);
    expect(setel).not.toHaveBeenCalled();
  });

  it("menandai: catatan ALETA + antrian SIPP status 2 lewat setelAntrian + ruang tunggu (bila disetel)", async () => {
    const bot = tiruan(() => ({ affectedRows: 1 }));
    const ruang = tiruan(() => ({ affectedRows: 1 }));
    const setel = vi.fn(async () => ({ ok: true, baris: 1 }));
    const L = selesaiMod.buatLayanan({ kueriBot: bot.kueri, kueriSipp: async () => [], kueriRuangTunggu: ruang.kueri, disidangSelesai: 20, setelAntrian: setel });
    const hasil = await (L.setelSelesai as (x: unknown) => Promise<Record<string, unknown>>)({
      perkaraId: "5",
      tanggalSidang: "2026-10-01",
      oleh: "Ani",
      kering: false,
    });
    expect(hasil.ok).toBe(true);
    expect(bot.catatan.some((c) => c.sql.startsWith("REPLACE INTO aleta_bot_sidang_selesai"))).toBe(true);
    expect(setel).toHaveBeenCalledWith(expect.objectContaining({ perkaraId: "5", tanggalSidang: "2026-10-01", keadaan: 2, kering: false }));
    expect(ruang.catatan[0].sql).toContain("SET disidang = ?");
    expect(ruang.catatan[0].params).toEqual([20, "5", "2026-10-01"]);
  });

  it("membatalkan: catatan dihapus, antrian kembali 0, ruang tunggu hanya baris yang sedang 'selesai'", async () => {
    const bot = tiruan(() => ({ affectedRows: 1 }));
    const ruang = tiruan(() => ({ affectedRows: 0 }));
    const setel = vi.fn(async () => ({ ok: true }));
    const L = selesaiMod.buatLayanan({ kueriBot: bot.kueri, kueriSipp: async () => [], kueriRuangTunggu: ruang.kueri, disidangSelesai: 20, setelAntrian: setel });
    await (L.setelSelesai as (x: unknown) => Promise<Record<string, unknown>>)({ perkaraId: "5", tanggalSidang: "2026-10-01", selesai: false, kering: false });
    expect(bot.catatan.some((c) => c.sql.startsWith("DELETE FROM aleta_bot_sidang_selesai"))).toBe(true);
    expect(setel).toHaveBeenCalledWith(expect.objectContaining({ keadaan: 0 }));
    // Kembali MENUNGGU (NULL) - dulu ditulis 10, yang justru nilai selesai.
    expect(ruang.catatan[0].sql).toContain("SET disidang = NULL");
    expect(ruang.catatan[0].sql).toContain("AND disidang = ?");
    expect(ruang.catatan[0].params).toEqual(["5", "2026-10-01", 20]);
  });

  it("mesin ruang tunggu TIDAK disentuh bila nilai selesainya belum disetel", async () => {
    const ruang = tiruan(() => ({ affectedRows: 1 }));
    const L = selesaiMod.buatLayanan({ kueriBot: async () => ({}), kueriSipp: async () => [], kueriRuangTunggu: ruang.kueri, disidangSelesai: null, setelAntrian: async () => ({ ok: true }) });
    const hasil = await (L.setelSelesai as (x: unknown) => Promise<Record<string, unknown>>)({ perkaraId: "5", tanggalSidang: "2026-10-01", kering: false });
    expect(ruang.catatan).toHaveLength(0);
    expect(hasil.antrianRuangTunggu).toMatchObject({ dilewati: true });
  });
});

// ============================================================================
// J1 - PENETAPAN MEDIATOR (BASIS DATA TIRUAN)
// ============================================================================

type Langkah = { tabel: string; aksi: string; sql: string; params: unknown[] };

function sippTiruan(opsi: { sudahAda?: boolean; mediatorAktif?: boolean; sidangPertama?: string | null } = {}) {
  return tiruan((sql) => {
    if (sql.includes("FROM perkara p LEFT JOIN perkara_penetapan")) {
      return [
        {
          perkaraId: 10063,
          nomorPerkara: "520/Pdt.G/2026/PA.Dgl",
          alurPerkaraId: 15,
          sidangPertama: opsi.sidangPertama === undefined ? "2026-09-09" : opsi.sidangPertama,
        },
      ];
    }
    if (sql.includes("AS keputusan FROM perkara_mediasi")) return [];
    if (sql.includes("tahapan_id = 10 AND jenis_mediasi = 1")) return opsi.sudahAda ? [{ mediasiId: 1, mediator: "X" }] : [];
    if (sql.includes("FROM mediator WHERE id = ?")) {
      return opsi.mediatorAktif === false
        ? []
        : [{ id: 25, status: "H", nama: "Himawan Tatura Wijaya", namaGelar: "Himawan Tatura Wijaya, S.H.I., M.H." }];
    }
    if (sql.includes("FROM proses_alur_perkara")) {
      return [
        { prosesId: 110, tahapanId: 13, tahapanNama: "Mediasi", prosesNama: "Penetapan Mediator" },
        { prosesId: 120, tahapanId: 13, tahapanNama: "Mediasi", prosesNama: "Penetapan Tanggal Mediasi" },
        { prosesId: 121, tahapanId: 13, tahapanNama: "Mediasi", prosesNama: "Mulai Mediasi" },
      ];
    }
    if (sql.includes("FROM perkara_hakim_pn a JOIN v_users")) return [{ username: "fahri", fullname: "Fahri Saifuddin" }];
    if (sql.includes("FROM perkara_panitera_pn c JOIN v_users")) return [{ username: "pp1", fullname: "PP Satu" }];
    if (sql.includes("MAX(mediasi_id)+1")) return [{ n: 781 }];
    if (sql.includes("MAX(id),0)+1 AS n FROM perkara_mediator")) return [{ n: 856 }];
    if (sql.includes("MAX(id),0)+1 AS n FROM perkara_jadwal_mediasi")) return [{ n: 1294 }];
    return { affectedRows: 1 };
  });
}

const MINTA = {
  perkaraId: 10063,
  mediatorId: 25,
  tanggalPenetapan: "2026-09-09",
  nomorSk: "520/Pdt.G/2026/PA.Dgl",
  jenisPenetapan: JENIS_PENETAPAN_MEDIATOR[0].nilai,
  operator: "usr_uji",
  ip: "192.168.9.1",
};

async function rencanaDari(db: ReturnType<typeof sippTiruan>, minta: Record<string, unknown> = MINTA, saat = "2026-09-29 14:20:05") {
  const L = mediatorMod.buatLayanan({ kueri: db.kueri, waktu: async () => saat });
  const r = (await (L.susunRencanaMediator as (x: unknown) => Promise<Record<string, unknown>>)(minta)) as {
    ok: boolean;
    alasan?: string;
    langkah: Langkah[];
    atasNama: { username: string };
  };
  return { L, r };
}

describe("J1 - rencana penetapan mediator = blangko Penetapan Mediasi SIPP", () => {
  it("urutan tulis persis SIPP: mediator, mediasi+audit, data dukung+audit, jadwal+audit, riwayat 110/120/121, perkara", async () => {
    const { r } = await rencanaDari(sippTiruan());
    expect(r.ok, r.alasan).toBe(true);
    expect(r.langkah.map((l) => `${l.tabel}:${l.aksi}`)).toEqual([
      "perkara_mediator:INSERT",
      "perkara_mediasi:INSERT",
      "sys_audittrail:INSERT",
      "perkara_data_dukung_mediasi:INSERT",
      "sys_audittrail:INSERT",
      "perkara_jadwal_mediasi:INSERT",
      "sys_audittrail:INSERT",
      "perkara_proses:DELETE",
      "perkara_proses:INSERT",
      "perkara_proses:DELETE",
      "perkara_proses:INSERT",
      "perkara_proses:DELETE",
      "perkara_proses:INSERT",
      "perkara:UPDATE",
    ]);
  });

  it("audit: tablename perkara_mediasi, formname Add Mediasi, judul SIPP apa adanya", async () => {
    const { r } = await rencanaDari(sippTiruan());
    const audit = r.langkah.filter((l) => l.tabel === "sys_audittrail");
    for (const a of audit) {
      expect(a.params[3]).toBe("perkara_mediasi");
      expect(a.params[4]).toBe("Add Mediasi");
      expect(a.params[5]).toBe("INSERT");
      expect(a.params[2]).toBe("fahri");
      // Cap waktu audit 24 jam (add_audittrail memakai date("Y-m-d H:i:s")).
      expect(a.params[0]).toBe("2026-09-29 14:20:05");
    }
    expect(audit.map((a) => a.params[6])).toEqual([
      "Tambah Data Mediasi <br />Tambah table <b>Perkara_Mediasi</b> dari halaman <b>Mediasi</b> dengan Primary Key [mediasi_id=#MEDIASI_ID#]",
      "Tambah Data Dukung Mediasi <br />Tambah table <b>perkara_data_dukung_mediasi</b> dari halaman <b>Mediasi</b> dengan Primary Key [mediasi_id=#MEDIASI_ID#]",
      "Tambah Data Jadwal Mediasi <br />Tambah table <b>Perkara_Jadwal_Mediasi</b> dari halaman <b>Penetapan Mediasi</b> dengan Primary Key [id=#JADWAL_MEDIASI_ID#]",
    ]);
    // Deskripsi data dukung KOSONG - persis SIPP (terukur pada audit 780).
    expect(audit[1].params[7]).toBe(
      '<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1"><tr><th>Nama Kolom</th><th>Nilai</th></tr></table>'
    );
    // Deskripsi mediasi: urutan kolom $data_add SIPP.
    const kolom = [...String(audit[0].params[7]).matchAll(/<tr><td>([a-z_]+)<\/td>/g)].map((m) => m[1]);
    expect(kolom).toEqual([
      "mediasi_id",
      "perkara_id",
      "nomor_sk_penetapan_mediator",
      "penetapan_penunjukan_mediator",
      "dimulai_mediasi",
      "diinput_oleh",
      "diinput_tanggal",
      "jenis_mediasi",
      "mediator_id",
      "status_mediator",
      "mediator_text",
    ]);
  });

  it("diinput_tanggal tiga tabel mediasi JAM 12 (date('h')), riwayat perkara 24 jam - seperti data satker", async () => {
    expect(mediatorMod.waktuDuaBelas("2026-09-29 14:20:05")).toBe("2026-09-29 02:20:05");
    expect(mediatorMod.waktuDuaBelas("2026-09-29 00:30:00")).toBe("2026-09-29 12:30:00");
    expect(mediatorMod.waktuDuaBelas("2026-09-29 12:00:00")).toBe("2026-09-29 12:00:00");
    const { r } = await rencanaDari(sippTiruan());
    const nilai = (tabel: string) => r.langkah.find((l) => l.tabel === tabel && l.aksi === "INSERT")!;
    for (const t of ["perkara_mediator", "perkara_mediasi", "perkara_jadwal_mediasi"]) {
      expect(nilai(t).params, t).toContain("2026-09-29 02:20:05");
      expect(nilai(t).params, t).not.toContain("2026-09-29 14:20:05");
    }
    expect(nilai("perkara_proses").params).toContain("2026-09-29 14:20:05");
  });

  it("nama mediator = nama_gelar; jadwal mediasi pertama 'Ditentukan Kemudian'; data dukung #pilih_mediator# I_03", async () => {
    const { r } = await rencanaDari(sippTiruan());
    const mediasi = r.langkah.find((l) => l.tabel === "perkara_mediasi")!;
    expect(mediasi.params).toContain("Himawan Tatura Wijaya, S.H.I., M.H.");
    expect(mediasi.params).toContain("25"); // mediator_id berupa daftar berkoma
    const jadwal = r.langkah.find((l) => l.tabel === "perkara_jadwal_mediasi")!;
    expect(jadwal.params).toEqual(["#JADWAL_MEDIASI_ID#", "#MEDIASI_ID#", 1, "2026-09-09", "Ditentukan Kemudian", "fahri", "2026-09-29 02:20:05"]);
    const dukung = r.langkah.find((l) => l.tabel === "perkara_data_dukung_mediasi")!;
    expect(dukung.params).toEqual([10063, "#pilih_mediator#", "I_03", JENIS_PENETAPAN_MEDIATOR[0].nilai, "#MEDIASI_ID#"]);
    const proses = r.langkah.filter((l) => l.tabel === "perkara_proses" && l.aksi === "INSERT").map((l) => l.params[3]);
    expect(proses).toEqual([110, 120, 121]);
  });

  it("atas nama ketua majelis sebagai bawaan; panitera pengganti bila diminta - tidak pernah diketik", async () => {
    expect((await rencanaDari(sippTiruan())).r.atasNama.username).toBe("fahri");
    expect((await rencanaDari(sippTiruan(), { ...MINTA, atasNama: "panitera" })).r.atasNama.username).toBe("pp1");
    expect((await rencanaDari(sippTiruan(), { ...MINTA, atasNama: "siapa-saja" })).r.atasNama.username).toBe("fahri");
  });

  it.each([
    ["Sabtu", { tanggalPenetapan: "2026-09-26" }, "Sabtu - Minggu"],
    ["melebihi hari ini", { tanggalPenetapan: "2026-09-30" }, "Melebihi Hari ini"],
    ["sebelum sidang pertama", { tanggalPenetapan: "2026-09-08" }, "Kurang Dari Tanggal Sidang Pertama"],
    ["jenis tidak dikenal", { jenisPenetapan: "terserah" }, "Jenis Penetapan Mediator wajib"],
    ["tanpa mediator", { mediatorId: 0 }, "Nama Mediator wajib"],
    ["SK terlalu panjang", { nomorSk: "x".repeat(51) }, "50 huruf"],
  ])("ditolak sebelum menulis: %s", async (_n, ubah, pesan) => {
    const db = sippTiruan();
    const { r } = await rencanaDari(db, { ...MINTA, ...ubah });
    expect(r.ok).toBe(false);
    expect(r.alasan).toContain(pesan);
    expect(db.catatan.every((c) => c.sql.startsWith("SELECT"))).toBe(true);
  });

  it("ditolak: mediasi pertama sudah tersimpan, mediator tidak aktif, penetapan sidang tidak ada", async () => {
    expect((await rencanaDari(sippTiruan({ sudahAda: true }))).r.alasan).toContain("Data Mediasi Sudah Tersimpan");
    expect((await rencanaDari(sippTiruan({ mediatorAktif: false }))).r.alasan).toContain("Data Mediator Tidak Ditemukan");
    expect((await rencanaDari(sippTiruan({ sidangPertama: null }))).r.alasan).toContain("Data Penetapan Sidang Tidak Ditemukan");
  });

  it("menjalankan KERING sebagai bawaan: tidak ada satu pun pernyataan selain SELECT", async () => {
    const db = sippTiruan();
    const { L, r } = await rencanaDari(db);
    const hasil = await (L.jalankanRencanaMediator as (a: unknown, b: unknown) => Promise<Record<string, unknown>>)(r, {});
    expect(hasil.kering).toBe(true);
    expect(db.catatan.every((c) => c.sql.startsWith("SELECT"))).toBe(true);
  });

  it("menjalankan sungguhan: id dihitung saat menulis dan penandanya terganti di SQL maupun judul audit", async () => {
    const db = sippTiruan();
    const { L, r } = await rencanaDari(db);
    const hasil = await (L.jalankanRencanaMediator as (a: unknown, b: unknown) => Promise<Record<string, unknown>>)(r, { kering: false });
    expect(hasil.ok).toBe(true);
    expect(hasil.mediasiId).toBe(781);
    const tulis = db.catatan.filter((c) => !c.sql.startsWith("SELECT"));
    expect(tulis).toHaveLength(14);
    const semua = JSON.stringify(tulis.map((t) => t.params));
    for (const tanda of Object.values(mediatorMod.TANDA)) expect(semua).not.toContain(tanda);
    expect(tulis[0].params[0]).toBe(856); // perkara_mediator.id
    expect(tulis[1].params[0]).toBe(781); // perkara_mediasi.mediasi_id
    expect(String(tulis[2].params[6])).toContain("[mediasi_id=781]");
    expect(String(tulis[6].params[6])).toContain("[id=1294]");
    // Hanya tabel di daftar putih.
    for (const t of tulis) {
      const tabel = t.sql.match(/^(?:INSERT INTO|DELETE FROM|UPDATE)\s+(\w+)/)![1];
      expect(mediatorMod.DAFTAR_TABEL_MEDIATOR.has(tabel), tabel).toBe(true);
    }
  });

  it("uji rilis 9 Okt: langkah gagal di tengah -> SELURUH penetapan mediator dibatalkan (transaksi), bukan perkara_mediasi tertinggal sendirian", async () => {
    const db = sippTiruan();
    const { r } = await rencanaDari(db);
    const kejadian: string[] = [];
    const kueriGagal = async (sql: string, params: unknown[] = []) => {
      if (/^INSERT INTO perkara_jadwal_mediasi/.test(sql.trim())) throw new Error("ER_LOCK_WAIT_TIMEOUT: Lock wait timeout exceeded");
      return db.kueri(sql, params);
    };
    const L = mediatorMod.buatLayanan({
      kueri: db.kueri,
      waktu: async () => "2026-09-29 14:20:05",
      // Transaksi tiruan: mencatat START/COMMIT/ROLLBACK seperti transaksiSipp.
      transaksi: async (kerja: (k: typeof kueriGagal) => Promise<unknown>) => {
        kejadian.push("START");
        try {
          const hasil = await kerja(kueriGagal);
          kejadian.push("COMMIT");
          return hasil;
        } catch (galat) {
          kejadian.push("ROLLBACK");
          (galat as { dipulihkan?: boolean }).dipulihkan = true;
          throw galat;
        }
      },
    });
    const hasil = await (L.jalankanRencanaMediator as (a: unknown, b: unknown) => Promise<Record<string, unknown>>)(r, { kering: false });
    expect(hasil).toMatchObject({ ok: false, alasan: "gagal_menulis", dipulihkan: true, selesai: [] });
    expect((hasil.pada as { tabel: string }).tabel).toBe("perkara_jadwal_mediasi");
    expect((hasil.dibatalkan as unknown[]).length).toBe(5);
    expect(kejadian).toEqual(["START", "ROLLBACK"]);
  });

  it("uji rilis 9 Okt: penjaga 'sudah tersimpan' dan id MAX+1 dibaca DI DALAM transaksi", () => {
    const sumber = readFileSync(path.join(AKAR, "aleta_bot/services/mediatorTulisService.js"), "utf8");
    const awal = sumber.indexOf("async function jalankanRencanaMediator");
    const badan = sumber.slice(awal, sumber.indexOf("return { daftarMediator", awal));
    const trans = badan.indexOf("return await transaksi(");
    expect(trans).toBeGreaterThan(0);
    expect(badan.indexOf("Data Mediasi Sudah Tersimpan")).toBeGreaterThan(trans);
    expect(badan.indexOf("MAX(mediasi_id)+1")).toBeGreaterThan(trans);
  });

  it("daftar putih menolak tabel di luar daftar, sebelum satu pun ditulis", async () => {
    const db = sippTiruan();
    const { L, r } = await rencanaDari(db);
    r.langkah.push({ tabel: "perkara_putusan", aksi: "DELETE", sql: "DELETE FROM perkara_putusan", params: [] });
    const hasil = await (L.jalankanRencanaMediator as (a: unknown, b: unknown) => Promise<Record<string, unknown>>)(r, { kering: false });
    expect(hasil).toMatchObject({ ok: false, alasan: "tabel_di_luar_daftar" });
    expect(db.catatan.every((c) => c.sql.startsWith("SELECT"))).toBe(true);
  });

  it("pilihan jenis penetapan dan arti hasil mediasi SAMA di portal dan bot", () => {
    expect(JENIS_PENETAPAN_MEDIATOR.map((j) => ({ ...j }))).toEqual(mediatorMod.JENIS_PENETAPAN);
    expect(HASIL_MEDIASI).toEqual(mediatorMod.HASIL_MEDIASI);
  });
});

describe("J1 - isian di layar", () => {
  it("bawaan terukur: tanggal sidang, nomor perkara sebagai No. penetapan, Majelis Hakim memilih, ketua majelis", () => {
    expect(bawaanPenetapanMediator({ tanggalSidang: "2026-10-01", nomorPerkara: "1/Pdt.G/2026/PA.Dgl" })).toEqual({
      tanggalPenetapan: "2026-10-01",
      nomorSk: "1/Pdt.G/2026/PA.Dgl",
      jenisPenetapan: JENIS_PENETAPAN_MEDIATOR[0].nilai,
      atasNama: "hakim",
    });
  });

  it("pemeriksaan di layar mencerminkan blangko SIPP", () => {
    const sah = { mediatorId: 25, tanggalPenetapan: "2026-10-01", jenisPenetapan: JENIS_PENETAPAN_MEDIATOR[1].nilai, nomorSk: "" };
    expect(periksaIsianMediator(sah, "2026-10-01")).toEqual([]);
    expect(periksaIsianMediator({ ...sah, tanggalPenetapan: "2026-10-03" }, "2026-10-05").join()).toContain("Sabtu");
    expect(periksaIsianMediator({ ...sah, tanggalPenetapan: "2026-10-02" }, "2026-10-01").join()).toContain("melebihi");
    expect(periksaIsianMediator({ ...sah, mediatorId: null }, "2026-10-01").join()).toContain("Mediator");
  });

  it("dua langkah: Periksa (kering) lalu 'Ya, tulis ke SIPP' (kering: false)", async () => {
    const kiriman: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!init || !init.method || init.method === "GET") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                available: true,
                ok: true,
                mediasi: [],
                daftarMediator: [{ id: 25, status: "H", nama: "Himawan", namaGelar: "Himawan Tatura Wijaya, S.H.I., M.H.", noSertifikasi: "", anggotaMajelis: false }],
                akun: { hakim: { username: "fahri", namaLengkap: "Fahri" }, panitera: null },
              },
            }),
            { status: 200 }
          );
        }
        const badan = JSON.parse(String(init.body));
        kiriman.push(badan);
        return new Response(
          JSON.stringify({
            ok: true,
            data: badan.kering
              ? { available: true, ok: true, kering: true, mediator: { nama: "Himawan" }, penetapan: { tanggal: "2026-10-01" }, atasNama: { username: "fahri" }, rencana: [{ tabel: "perkara_mediasi", aksi: "INSERT" }] }
              : { available: true, ok: true, kering: false, jumlahLangkah: 14 },
          }),
          { status: 200 }
        );
      })
    );
    const { IsianMediator } = await import("@/components/portal/jadwal-sidang-1okt");
    render(createElement(IsianMediator, { perkaraId: "10063", nomorPerkara: "520/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-09-29" }));
    fireEvent.click(await screen.findByRole("option", { name: /Himawan Tatura Wijaya/ }));
    fireEvent.click(screen.getByRole("button", { name: "Periksa penetapan mediator" }));
    await screen.findByText("Periksa sebelum ditulis ke SIPP");
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0]).toMatchObject({ kering: true, mediatorId: 25, tanggalPenetapan: "2026-09-29", nomorSk: "520/Pdt.G/2026/PA.Dgl" });
    fireEvent.click(screen.getByRole("button", { name: "Ya, tulis ke SIPP" }));
    await waitFor(() => expect(kiriman).toHaveLength(2));
    expect(kiriman[1]).toMatchObject({ kering: false });
    await screen.findByText(/tertulis di SIPP \(14 langkah\)/);
  });

  it("tombol mediator Jadwal Sidang dan kartu Hasil Sidang memakai komponen yang SAMA", () => {
    expect(SIDANG).toContain("<TombolPilihMediator");
    expect(HASIL).toContain('import { IsianMediator } from "@/components/portal/jadwal-sidang-1okt";');
    expect(HASIL).toContain("<KartuMediator");
    // Jalan lama ke Status Perkara bagian Mediasi TIDAK hilang.
    expect(KOMPONEN).toContain("Buka Status Perkara → bagian Mediasi");
  });
});

// ============================================================================
// J7 - PROSES MEDIASI DI RINCIAN
// ============================================================================

const mediasiContoh: ProsesMediasi = {
  mediasiId: 780,
  tahapanId: 10,
  jenisMediasi: 1,
  penetapan: "2026-09-08",
  nomorSk: "534/Pdt.G/2026/PA.Dgl",
  mediator: "Himawan Tatura Wijaya, S.H.I., M.H.",
  statusMediator: "H",
  mulai: "2026-09-08",
  keputusan: "",
  hasil: "",
  hasilSebutan: "",
  laporan: "",
  berhasil: "",
  gagal: "",
  catatan: "",
  jadwal: [
    { mediasiId: 780, urutan: 1, tanggal: "2026-09-08", jam: "10:00", sampaiJam: "10:50", tempat: "ruang mediasi", dihadiriOleh: 1, kehadiran: "Semua pihak", ditunda: true },
    { mediasiId: 780, urutan: 2, tanggal: "2026-09-29", jam: "", sampaiJam: "", tempat: "ruang mediasi", dihadiriOleh: null, kehadiran: "", ditunda: false },
  ],
};

describe("J7 - proses mediasi di rincian", () => {
  it("ringkasan: pertemuan berikutnya bila berjalan, hasil bila sudah diputus", () => {
    expect(ringkasMediasi(mediasiContoh, "2026-09-20")).toBe("Berjalan - pertemuan ke-2 2026-09-29");
    expect(ringkasMediasi({ ...mediasiContoh, hasil: "T", keputusan: "2026-09-29" }, "2026-10-01")).toBe(
      "Tidak berhasil (2026-09-29)"
    );
  });

  it("tanpa mediasi = TIDAK tampil sama sekali", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { available: true, ok: true, mediasi: [] } }))));
    const { ProsesMediasiRincian } = await import("@/components/portal/jadwal-sidang-1okt");
    const { container } = render(createElement(ProsesMediasiRincian, { perkaraId: "1", cadangan: [] }));
    await waitFor(() => expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1));
    expect(container.textContent).toBe("");
  });

  it("ada mediasi = bagian 'Proses mediasi' beserta mediator dan pertemuannya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { available: true, ok: true, mediasi: [mediasiContoh] } }))));
    const { ProsesMediasiRincian } = await import("@/components/portal/jadwal-sidang-1okt");
    render(createElement(ProsesMediasiRincian, { perkaraId: "10080" }));
    await screen.findByText("Himawan Tatura Wijaya, S.H.I., M.H.");
    expect(screen.getByText("Proses mediasi")).toBeTruthy();
    expect(screen.getByText("Semua pihak", { exact: false })).toBeTruthy();
  });

  it("rincian memasangnya, dengan cadangan durasi.mediasi bila bot lama", () => {
    expect(SIDANG).toContain("<ProsesMediasiRincian perkaraId={perkaraId} cadangan={durasi?.mediasi} />");
  });
});

// ============================================================================
// J6, J8, J3, J4, K5 - DI DALAM BERKAS LAYAR
// ============================================================================

describe("J6 - Majelis & petugas dan Identitas pihak terlipat sebagai bawaan", () => {
  it("keduanya ciutBawaan, kuncinya tetap (pilihan orang yang pernah membukanya dihormati)", () => {
    expect(SIDANG).toContain('<Bagian judul="Majelis dan petugas" kunci="sidang-majelis" ciutBawaan>');
    expect(SIDANG).toContain('<Bagian judul="Identitas pihak" kunci="sidang-pihak" ciutBawaan>');
  });
});

describe("J8 - unduh per riwayat panggilan", () => {
  it("nama dokumen: jenis, sidang ke-berapa, dan pihaknya", () => {
    expect(namaDokumenRelaas({ peran: "Tergugat" }, "relaas", 3)).toBe("Relaas Panggilan Sidang ke-3 - Tergugat");
    expect(namaDokumenRelaas({ namaPihak: "Ani" }, "resi", undefined)).toBe("Resi Pos Relaas - Ani");
    expect(namaBerkasRelaas("520/Pdt.G/2026/PA.Dgl", { id: "9", peran: "Tergugat" }, "relaas", 2)).toBe(
      "Relaas Panggilan Sidang ke-2 - Tergugat - 520-Pdt.G-2026-PA.Dgl.pdf"
    );
  });

  it("tiap baris riwayat punya tombol unduh relaas/resi lewat TombolUnduh (tanganiUnduhan)", () => {
    const i = SIDANG.indexOf('kunci="sidang-relaas-riwayat"');
    const j = SIDANG.indexOf('<Bagian judul="Seluruh jadwal sidang perkara ini"', i);
    const blok = SIDANG.slice(i, j);
    expect(blok).toContain("jenis=relaas&id=");
    expect(blok).toContain("jenis=resi&id=");
    expect(blok).toContain('label={namaDokumenRelaas(baris, "relaas"');
    expect(blok).toContain("namaCadangan={namaBerkasRelaas(");
    expect(SIDANG).toContain("const hasil = await tanganiUnduhan(respons, { namaCadangan, alamat: apiPath(alamat) });");
  });
});

describe("J3 - kerangka ALETA e-Court lebih lebar", () => {
  it("melebar hanya di atas 1600 px, simetris, tanpa transform; pembungkus lama tetap", () => {
    // 2 Okt 2026 (butir 12): lebar J3 kini pilihan "Lebar penuh"; bawaannya
    // "nyaman" (1.680 px). Kelasnya pindah ke @/lib/jadwal-sidang-2okt.
    expect(baca("manajemen_surat/src/lib/jadwal-sidang-2okt.ts")).toContain(
      '"min-[1600px]:ml-[calc(50%_-_min(50vw_-_1.5rem,_1200px))] min-[1600px]:w-[min(100vw_-_3rem,_2400px)] min-[1600px]:max-w-none"'
    );
    expect(PENGGUNA).toContain("<div data-lebar-ecourt={lebar} className={KELAS_LEBAR_ECOURT[lebar]}>");
    const i = PENGGUNA.indexOf("data-lebar-ecourt");
    const blok = PENGGUNA.slice(i, PENGGUNA.indexOf('<div className="space-y-4 px-0 pb-4 pt-1 sm:pb-5">', i));
    expect(blok).not.toMatch(/translate|transform/);
    expect(PENGGUNA).toContain('className="space-y-4 px-0 pb-4 pt-1 sm:pb-5"');
  });

  it("fit-to-size tabel jadwal tidak diubah", () => {
    expect(SIDANG).toContain('"min-w-[980px] xl:min-w-0 [&_.hanya-ringkas]:hidden"');
    expect(SIDANG).toContain('"min-w-[640px] xl:min-w-0 [&_.kolom-lengkap]:hidden"');
  });
});

describe("J4 - layar penuh berjendela", () => {
  it("kartu menutupi jendela, tanpa filter (anak fixed tetap di tengah jendela), Esc keluar", () => {
    expect(SIDANG).toContain("const [layarPenuh, setLayarPenuh] = useLayarPenuh();");
    expect(SIDANG).toMatch(/layarPenuh &&\s+"fixed inset-0 z-50[^"]*backdrop-blur-none/);
    expect(SIDANG).toContain("<TombolLayarPenuh penuh={layarPenuh} onUbah={setLayarPenuh} />");
    expect(KOMPONEN).toContain('if (e.key === "Escape") setPenuh(false);');
  });

  it("Esc sungguh keluar dari layar penuh", async () => {
    const { useLayarPenuh } = await import("@/components/portal/jadwal-sidang-1okt");
    let keadaan: readonly [boolean, (b: boolean) => void] | null = null;
    function Uji() {
      keadaan = useLayarPenuh();
      return null;
    }
    render(createElement(Uji));
    await waitFor(() => expect(keadaan).not.toBeNull());
    const { act } = await import("@testing-library/react");
    act(() => keadaan![1](true));
    expect(keadaan![0]).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(keadaan![0]).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("K5 - aksi dan lencana e-Court milik agen E terpasang", () => {
  it("EcourtAksiPerkara konteks jadwal di rincian; EcourtLencanaPutusan di baris perkara yang sudah putus", () => {
    expect(SIDANG).toContain('import { EcourtAksiPerkara, EcourtLencanaPutusan } from "@/components/portal/ecourt-aksi-perkara";');
    expect(SIDANG).toMatch(/<EcourtAksiPerkara\s+konteks="jadwal"\s+nomorPerkara=\{nomorPerkara\}\s+perkaraId=\{perkaraId\}/);
    expect(SIDANG).toMatch(/baris\.sudahPutus \|\| sudahPutusHariIni\(baris\) \? \(\s+<EcourtLencanaPutusan/);
  });
});

// ============================================================================
// RUTE PORTAL - kewenangan dan kering sebagai bawaan
// ============================================================================

describe("rute portal sidang/selesai dan sidang/mediator", () => {
  const RUTE_SELESAI = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/selesai/route.ts");
  const RUTE_MEDIATOR = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/mediator/route.ts");

  it("keduanya menuntut kewenangan panel dan kering kecuali kering:false tegas", () => {
    for (const r of [RUTE_SELESAI, RUTE_MEDIATOR]) {
      expect(r.match(/pastikanKapabilitas\(db, actorUserId, "panel"\)/g)?.length).toBe(2);
      expect(r).toContain("kering: badan.kering !== false");
    }
    // Akun SIPP tidak diterima dari peramban - hanya "hakim" atau "panitera".
    expect(RUTE_MEDIATOR).toContain('atasNama: badan.atasNama === "panitera" ? "panitera" : "hakim"');
  });

  it("bot memasang rutenya di berkas sendiri, bertoken", () => {
    const app = baca("aleta_bot/app.js");
    expect(app).toContain('app.use("/internal/aleta-bot/jadwal-sidang", require("./routes/jadwalSidangRoutes"));');
    const rute = baca("aleta_bot/routes/jadwalSidangRoutes.js");
    // 2 Okt 2026: rute keenam POST /skors (butir 10); 2 Okt malam: ketujuh
    // POST /berjalan, kedelapan GET /kalender, kesembilan GET /pihak-elektronik.
    // Yang dijaga: SETIAP rute bertoken, bukan jumlahnya.
    // 6 Okt 2026 (butir 3): GET /court-calendar, GET /court-calendar/jumlah,
    // POST /court-calendar - ke-10 s.d. ke-12. 6 Okt sore: ke-13 GET /disidang
    // (keadaan disidang ringan, jadwal-sidang-6okt-sore.test.tsx).
    // 6 Okt 2026 (Kasir jurnal): GET /kasir, GET /kasir/cari, POST /kasir -
    // ke-14 s.d. ke-16.
    // 7 Okt 2026 (penanda belum upload dapat ditekan): POST dan GET
    // /belum-upload/tarik - ke-17 dan ke-18 (jadwal-sidang-belum-upload-tarik.test.tsx).
    const jumlahRute = rute.match(/router\.(get|post)\(/g)?.length ?? 0;
    expect(jumlahRute).toBe(18);
    expect(rute.match(/wajibToken, async/g)?.length).toBe(jumlahRute);
    expect(rute).toContain("kering: badan.kering !== false");
  });
});
