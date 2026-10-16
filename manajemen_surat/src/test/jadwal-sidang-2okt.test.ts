/**
 * ============================================================================
 * JADWAL SIDANG PORTAL - PERBAIKAN 2 OKTOBER 2026 (agen J: butir 10 dan 12)
 * ============================================================================
 *
 *   10  sorot sidang yang SEDANG BERJALAN di ruang sidang + skors: lompat ke
 *       perkara lain dan menyatakan sidang yang ditinggalkan BELUM SELESAI,
 *       tanpa menghapus tanda Selesai yang sah. Jadwal Sidang DAN Hasil Sidang.
 *       Bot diuji dengan basis data TIRUAN - tidak ada yang ditulis ke SIPP.
 *   12  halaman ALETA e-Court tidak lagi terlalu lebar: bawaan "nyaman"
 *       (paling lebar 1.680 px), lebar J3 tetap dapat dipilih.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  KELAS_LEBAR_ECOURT,
  LEBAR_ECOURT_MAKS_PX,
  aksiRuangSidang,
  bacaLebarEcourt,
  jamSingkat,
  kalimatLangkah,
  lebarIsiEcourt,
  lebarSebelumJ3,
  pesanTolakSkors,
  petaSidangBerjalan,
  rencanaLompat,
  selesaiPerKunciWaktu,
  skorsBerlaku,
  skorsUntuk,
  type PetaSkors,
  type SidangBerjalan,
} from "@/lib/jadwal-sidang-2okt";
import type { BarisWaktuAntrian } from "@/lib/tiga-jarak-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

const SIDANG = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const HASIL = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");
const PENGGUNA = baca("manajemen_surat/src/components/portal/aleta-ecourt-pengguna.tsx");
const KOMPONEN = baca("manajemen_surat/src/components/portal/jadwal-sidang-2okt.tsx");
const RUTE_PORTAL = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/skors/route.ts");
const RUTE_BOT = baca("aleta_bot/routes/jadwalSidangRoutes.js");

type Layanan = Record<string, (x: unknown) => Promise<Record<string, unknown>>>;
const selesaiMod = require_(path.join(AKAR, "aleta_bot/services/sidangSelesaiService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  TABEL_SKORS: string;
  ANTRIAN_SKORS: number;
  ANTRIAN_SELESAI: number;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Tiruan basis data - mencatat tiap SQL, menjawab menurut polanya. */
function tiruan(jawab: (sql: string, params: unknown[]) => unknown) {
  const catatan: Array<{ sql: string; params: unknown[] }> = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    const rapi = sql.replace(/\s+/g, " ").trim();
    catatan.push({ sql: rapi, params });
    return jawab(rapi, params);
  };
  return { kueri, catatan };
}

const HARI = "2026-10-02";

function bw(perkaraId: string, panggil: string, noRuang: number | null, nomor: number | null, tanggal = HARI): BarisWaktuAntrian {
  return {
    tanggalSidang: tanggal,
    perkaraId,
    nomorAntrian: nomor,
    noRuang,
    ruanganId: null,
    ambilPihak1: `${tanggal} 08:00:00`,
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: `${tanggal} 08:00:00`,
    jamJadwal: "09:00:00",
    panggilPertama: panggil,
    panggilTerakhir: panggil,
    jumlahPanggil: panggil ? 1 : 0,
    online: null,
    namaPetugas: "",
    sumber: "langsung",
  };
}

// Ruang 1: 11 (09:10), 12 (09:40, terakhir); ruang 2: 21 (09:20, terakhir); 13 belum dipanggil di ruang 1.
const WAKTU: BarisWaktuAntrian[] = [
  bw("11", `${HARI} 09:10:00`, 1, 1),
  bw("12", `${HARI} 09:40:00`, 1, 2),
  bw("13", "", 1, 3),
  bw("21", `${HARI} 09:20:00`, 2, 4),
];

// ============================================================================
// BUTIR 10 - FUNGSI MURNI
// ============================================================================

describe("butir 10 - sidang yang sedang berjalan", () => {
  it("per ruang: perkara TERAKHIR dipanggil hari ini yang belum selesai", () => {
    const r = petaSidangBerjalan(WAKTU, { hariIni: HARI });
    expect(Object.keys(r.berjalan).sort()).toEqual([`${HARI}|12`, `${HARI}|21`]);
    expect(r.perRuang["Ruang 1"].perkaraId).toBe("12");
    expect(r.perRuang["Ruang 2"].perkaraId).toBe("21");
    expect(r.perRuang["Ruang 1"].sejak).toBe(`${HARI} 09:40:00`);
    expect(r.ruangPerKunci[`${HARI}|13`]).toBe("Ruang 1");
    expect(r.panggilPerKunci[`${HARI}|13`]).toBe("");
  });

  it("yang SELESAI tidak berjalan - ruangnya kosong, yang sebelumnya tidak ikut 'naik'", () => {
    const r = petaSidangBerjalan(WAKTU, { hariIni: HARI, selesai: { [`${HARI}|12`]: true } });
    expect(r.perRuang["Ruang 1"]).toBeUndefined();
    expect(r.berjalan[`${HARI}|11`]).toBeUndefined();
    expect(r.perRuang["Ruang 2"].perkaraId).toBe("21");
  });

  it("yang DISKORS tidak berjalan; dipanggil lagi sesudah skors = berjalan lagi", () => {
    const skors: PetaSkors = {
      "12|2026-10-02": { perkaraId: "12", tanggalSidang: HARI, panggilSaatSkors: `${HARI} 09:40:00` },
    };
    expect(petaSidangBerjalan(WAKTU, { hariIni: HARI, skors }).perRuang["Ruang 1"]).toBeUndefined();
    const dipanggilLagi = WAKTU.map((b) => (b.perkaraId === "12" ? { ...b, panggilTerakhir: `${HARI} 10:30:00` } : b));
    expect(petaSidangBerjalan(dipanggilLagi, { hariIni: HARI, skors }).perRuang["Ruang 1"].perkaraId).toBe("12");
  });

  it("hari lain tidak punya sidang yang sedang berjalan", () => {
    const r = petaSidangBerjalan(WAKTU, { hariIni: "2026-10-03" });
    expect(Object.keys(r.berjalan)).toHaveLength(0);
    expect(petaSidangBerjalan(WAKTU, { hariIni: "" }).berjalan).toEqual({});
  });

  it("skors berlaku hanya selama jam panggil terakhirnya sama", () => {
    expect(skorsBerlaku({ perkaraId: "1", tanggalSidang: HARI, panggilSaatSkors: "x" }, "x")).toBe(true);
    expect(skorsBerlaku({ perkaraId: "1", tanggalSidang: HARI, panggilSaatSkors: "x" }, "y")).toBe(false);
    expect(skorsBerlaku({ perkaraId: "1", tanggalSidang: HARI, panggilSaatSkors: "" }, undefined)).toBe(true);
    expect(skorsBerlaku(undefined, "x")).toBe(false);
    const peta: PetaSkors = { "5|2026-10-02": { perkaraId: "5", tanggalSidang: HARI, panggilSaatSkors: "" } };
    expect(skorsUntuk(peta, { perkaraId: "5", tanggalSidang: HARI }, "")).not.toBeNull();
    expect(skorsUntuk(peta, { perkaraId: "6", tanggalSidang: HARI }, "")).toBeNull();
  });

  it("selesai per kunciWaktu = hasil sidang tercatat ATAU ditandai Selesai", () => {
    const peta = { "2|2026-10-02": { perkaraId: "2", tanggalSidang: HARI, sumber: ["aleta" as const] } };
    const hasil = selesaiPerKunciWaktu(
      [
        { perkaraId: "1", tanggalSidang: HARI, ditunda: true },
        { perkaraId: "2", tanggalSidang: HARI },
        { perkaraId: "3", tanggalSidang: HARI },
      ],
      peta
    );
    expect(hasil).toEqual({ [`${HARI}|1`]: true, [`${HARI}|2`]: true, [`${HARI}|3`]: false });
  });
});

describe("butir 10 - aksi skors / lompat / lanjutkan", () => {
  const asal: SidangBerjalan = {
    kunci: `${HARI}|12`,
    perkaraId: "12",
    tanggalSidang: HARI,
    ruang: "Ruang 1",
    sejak: `${HARI} 09:40:00`,
    nomorAntrian: 2,
  };

  it("SELESAI YANG SAH tidak pernah mendapat aksi - tidak diskors, tidak dilompati", () => {
    for (const berjalan of [asal, null]) {
      const a = aksiRuangSidang({ hijau: true, berjalan, skors: null, berjalanDiRuang: asal, bisaDipanggil: true });
      expect(a).toMatchObject({ skors: false, lompat: false, lanjut: false });
    }
  });

  it("yang berjalan: Skors; perkara lain di ruang yang sama: Lompat; yang diskors: Lanjutkan", () => {
    expect(aksiRuangSidang({ hijau: false, berjalan: asal, skors: null, berjalanDiRuang: asal, bisaDipanggil: true }).skors).toBe(true);
    const lompat = aksiRuangSidang({ hijau: false, berjalan: null, skors: null, berjalanDiRuang: asal, bisaDipanggil: true });
    expect(lompat).toMatchObject({ lompat: true, asal });
    const lanjut = aksiRuangSidang({
      hijau: false,
      berjalan: null,
      skors: { perkaraId: "11", tanggalSidang: HARI },
      berjalanDiRuang: asal,
      bisaDipanggil: true,
    });
    expect(lanjut).toMatchObject({ lanjut: true, lompat: false, asal });
  });

  it("tanpa antrian hari ini tidak ada lompat; tanpa sidang berjalan pun tidak", () => {
    expect(aksiRuangSidang({ hijau: false, berjalan: null, skors: null, berjalanDiRuang: asal, bisaDipanggil: false }).lompat).toBe(false);
    expect(aksiRuangSidang({ hijau: false, berjalan: null, skors: null, berjalanDiRuang: null, bisaDipanggil: true }).lompat).toBe(false);
  });

  it("lompat = skors yang berjalan, LALU panggil tujuan; lanjutkan mencatat dilanjutkan SESUDAH panggilan", () => {
    expect(rencanaLompat({ asal, tujuan: { perkaraId: "13", tanggalSidang: HARI }, tujuanDiskors: false, bisaDipanggil: true })).toEqual([
      { jenis: "skors", perkaraId: "12", tanggalSidang: HARI, panggilSaatSkors: `${HARI} 09:40:00` },
      { jenis: "panggil", perkaraId: "13" },
    ]);
    expect(
      rencanaLompat({ asal, tujuan: { perkaraId: "11", tanggalSidang: HARI }, tujuanDiskors: true, bisaDipanggil: true }).map((l) => l.jenis)
    ).toEqual(["skors", "panggil", "lanjut"]);
    // Tanpa antrian hari ini: hanya catatan dilanjutkan, tidak ada skors/panggil.
    expect(
      rencanaLompat({ asal, tujuan: { perkaraId: "11", tanggalSidang: HARI }, tujuanDiskors: true, bisaDipanggil: false }).map((l) => l.jenis)
    ).toEqual(["lanjut"]);
    // Tujuan = yang berjalan sendiri: tidak menskors dirinya.
    expect(rencanaLompat({ asal, tujuan: { perkaraId: "12", tanggalSidang: HARI }, tujuanDiskors: false, bisaDipanggil: true }).map((l) => l.jenis)).toEqual([
      "panggil",
    ]);
  });

  it("kalimat konfirmasi menyebut BELUM SELESAI dan nomor perkaranya", () => {
    const k = kalimatLangkah(
      rencanaLompat({ asal, tujuan: { perkaraId: "13", tanggalSidang: HARI }, tujuanDiskors: false, bisaDipanggil: true }),
      (id) => (id === "12" ? "12/Pdt.G/2026/PA.Dgl" : "13/Pdt.G/2026/PA.Dgl")
    );
    expect(k[0]).toContain("Skors 12/Pdt.G/2026/PA.Dgl - sidangnya BELUM SELESAI");
    expect(k[1]).toContain("Panggil 13/Pdt.G/2026/PA.Dgl");
    expect(jamSingkat(`${HARI} 09:40:00`)).toBe("09:40");
    expect(pesanTolakSkors("sudah_ditandai_selesai")).toContain("sudah ditandai Selesai");
  });
});

// ============================================================================
// BUTIR 10 - LAYANAN BOT (BASIS DATA TIRUAN)
// ============================================================================

describe("butir 10 - bot setelSkors (basis data tiruan)", () => {
  function layanan(opsi: { tandaSelesai?: boolean; statusSipp?: readonly number[]; sippMati?: boolean; skorsAktif?: boolean } = {}) {
    const bot = tiruan((sql) => {
      if (sql.startsWith("SELECT perkara_id FROM aleta_bot_sidang_selesai")) return opsi.tandaSelesai ? [{ perkara_id: "5" }] : [];
      if (sql.startsWith(`SELECT id FROM ${selesaiMod.TABEL_SKORS}`)) return opsi.skorsAktif ? [{ id: 1 }] : [];
      return { affectedRows: 1 };
    });
    const sipp = tiruan((sql) => {
      if (opsi.sippMati) throw new Error("SIPP mati");
      if (sql.startsWith("SELECT status FROM antrian")) return (opsi.statusSipp ?? []).map((status) => ({ status }));
      return { affectedRows: 1 };
    });
    const setel = vi.fn(async () => ({ ok: true }));
    const L = selesaiMod.buatLayanan({
      kueriBot: bot.kueri,
      kueriSipp: sipp.kueri,
      kueriRuangTunggu: async () => [],
      disidangSelesai: null,
      setelAntrian: setel,
    });
    return { L, bot, sipp, setel };
  }
  const minta = { perkaraId: "5", tanggalSidang: HARI, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", oleh: "Ani Panitera", ip: "192.168.10.21", panggilSaatSkors: `${HARI} 09:40:00` };

  it("KERING sebagai bawaan: tidak satu tulisan pun", async () => {
    const { L, bot, sipp } = layanan({ statusSipp: [0] });
    const hasil = await L.setelSkors({ ...minta });
    expect(hasil.kering).toBe(true);
    expect(bot.catatan.some((c) => /^(INSERT|UPDATE|REPLACE|DELETE)/.test(c.sql))).toBe(false);
    expect(sipp.catatan.some((c) => c.sql.startsWith("UPDATE"))).toBe(false);
  });

  it("menskors: catatan ALETA jujur (petugas, IP, lewat ALETA) + antrian SIPP 0 -> 1 BERSYARAT, tanpa penanda ALETA ke SIPP", async () => {
    const { L, bot, sipp, setel } = layanan({ statusSipp: [0] });
    const hasil = await L.setelSkors({ ...minta, kering: false });
    expect(hasil.ok).toBe(true);
    const sisip = bot.catatan.find((c) => c.sql.startsWith(`INSERT INTO ${selesaiMod.TABEL_SKORS}`));
    expect(sisip?.sql).toContain("'ALETA', NOW()");
    // F3.1: dua kolom di belakang - alasan_kode dan perkiraan_lanjut (kosong bila tidak dipilih).
    expect(sisip?.params).toEqual(["5", HARI, "5/Pdt.G/2026/PA.Dgl", "", `${HARI} 09:40:00`, "Ani Panitera", "192.168.10.21", "", null]);
    const tulis = sipp.catatan.filter((c) => c.sql.startsWith("UPDATE"));
    expect(tulis).toHaveLength(1);
    expect(tulis[0].sql).toBe("UPDATE antrian SET status = ? WHERE perkara_id = ? AND tanggal_sidang = ? AND status = ?");
    expect(tulis[0].params).toEqual([selesaiMod.ANTRIAN_SKORS, "5", HARI, 0]);
    // Butir 14: tidak ada nama petugas, IP, atau kata ALETA di tulisan SIPP.
    expect(JSON.stringify(tulis)).not.toMatch(/ALETA|Ani Panitera|192\.168\.10\.21/);
    // setelAntrian (yang menimpa status apa pun) TIDAK dipakai skors.
    expect(setel).not.toHaveBeenCalled();
  });

  it("TANDA SELESAI YANG SAH tidak dihapus: ditandai Selesai / antrian SIPP 2 / hasil sidang -> ditolak tanpa satu tulisan", async () => {
    for (const [opsi, tambahan, alasan] of [
      [{ tandaSelesai: true, statusSipp: [0] }, {}, "sudah_ditandai_selesai"],
      [{ statusSipp: [2] }, {}, "antrian_sipp_selesai"],
      [{ statusSipp: [0] }, { hasilSidangSelesai: true }, "sudah_selesai_hasil_sidang"],
    ] as const) {
      const { L, bot, sipp } = layanan(opsi);
      const hasil = await L.setelSkors({ ...minta, ...tambahan, kering: false });
      expect(hasil).toMatchObject({ ok: false, alasan });
      expect(bot.catatan.some((c) => /^(INSERT|UPDATE|REPLACE|DELETE)/.test(c.sql))).toBe(false);
      expect(sipp.catatan.some((c) => c.sql.startsWith("UPDATE"))).toBe(false);
    }
  });

  it("melanjutkan: catatan ALETA diberi dilanjutkan_pada (riwayat tidak dihapus) + antrian 1 -> 0 bersyarat", async () => {
    const { L, bot, sipp } = layanan({ statusSipp: [1] });
    const hasil = await L.setelSkors({ ...minta, skors: false, kering: false });
    expect(hasil.ok).toBe(true);
    expect(bot.catatan.some((c) => c.sql.startsWith(`UPDATE ${selesaiMod.TABEL_SKORS} SET dilanjutkan_pada = NOW()`))).toBe(true);
    expect(bot.catatan.some((c) => c.sql.startsWith("DELETE"))).toBe(false);
    const tulis = sipp.catatan.find((c) => c.sql.startsWith("UPDATE antrian"));
    expect(tulis?.params).toEqual([0, "5", HARI, selesaiMod.ANTRIAN_SKORS]);
  });

  it("skors yang masih berlaku tidak digandakan; SIPP tak terbaca = SIPP tidak disentuh, catatan ALETA tetap", async () => {
    const satu = layanan({ statusSipp: [0], skorsAktif: true });
    await satu.L.setelSkors({ ...minta, kering: false });
    expect(satu.bot.catatan.some((c) => c.sql.startsWith("INSERT"))).toBe(false);

    const dua = layanan({ sippMati: true });
    const hasil = await dua.L.setelSkors({ ...minta, kering: false });
    expect(hasil.ok).toBe(true);
    expect(hasil.antrianSipp).toMatchObject({ dilewati: true });
    expect(dua.bot.catatan.some((c) => c.sql.startsWith("INSERT"))).toBe(true);
    expect(dua.sipp.catatan.some((c) => c.sql.startsWith("UPDATE"))).toBe(false);
  });

  it("peta selesai ikut memulangkan skors yang BELUM dilanjutkan - terpisah dari peta selesai", async () => {
    const bot = tiruan((sql) => {
      if (sql.includes(`FROM ${selesaiMod.TABEL_SKORS}`)) {
        return [{ perkaraId: "7", tanggalSidang: HARI, nomorPerkara: "7/x", oleh: "Ani", alasan: "", panggilSaatSkors: "p", diskorsPada: "d" }];
      }
      return [];
    });
    const L = selesaiMod.buatLayanan({ kueriBot: bot.kueri, kueriSipp: async () => [], kueriRuangTunggu: async () => [], disidangSelesai: null, setelAntrian: async () => ({ ok: true }) });
    const hasil = (await L.petaSelesai({ dari: HARI, sampai: HARI })) as {
      peta: Record<string, unknown>;
      skors: Record<string, { panggilSaatSkors: string }>;
    };
    expect(hasil.peta).toEqual({});
    expect(hasil.skors["7|2026-10-02"].panggilSaatSkors).toBe("p");
    expect(bot.catatan.find((c) => c.sql.includes(`FROM ${selesaiMod.TABEL_SKORS}`))?.sql).toContain("AND dilanjutkan_pada IS NULL");
  });

  it("rute bot dan portal: bertoken, kering bawaan, kewenangan panel, IP peramban", () => {
    expect(RUTE_BOT).toContain('router.post("/skors", wajibToken,');
    expect(RUTE_BOT).toContain("kering: badan.kering !== false,");
    expect(RUTE_PORTAL).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(RUTE_PORTAL).toContain("ip: alamatIpPeramban(request),");
    expect(RUTE_PORTAL).toContain("kering: badan.kering !== false,");
    expect(RUTE_PORTAL).toContain('panggilBotJadwalSidang("/skors"');
  });
});

// ============================================================================
// BUTIR 10 - LAYAR
// ============================================================================

describe("butir 10 - Jadwal Sidang dan Hasil Sidang", () => {
  it("Jadwal Sidang: baris berjalan disorot, lencana, ringkasan ruang, tombol di samping Selesai", () => {
    expect(SIDANG).toContain("const ruangSidang = useMemo(() => {");
    expect(SIDANG).toContain("selesai: selesaiPerKunciWaktu(sidang, tandaSelesai.peta),");
    expect(SIDANG).toMatch(/berjalanIni &&\s+"border-l-4 border-l-sky-500/);
    expect(SIDANG).toContain("{berjalanIni ? <LencanaSedangBerjalan berjalan={berjalanIni} /> : null}");
    expect(SIDANG).toContain("<RingkasRuangSidang");
    expect(SIDANG).toContain("data-kunci-waktu={kunciTiga}");
    // 2 Okt 2026 malam (butir 4): kolom kanan = Rincian, Status, lalu tombol
    // ruang sidang, dan Selesai PALING BAWAH - bukan lagi di atas keduanya.
    const iRuang = SIDANG.indexOf("<TombolRuangSidang");
    const iSelesai = SIDANG.indexOf("<TombolSelesaiSidang");
    expect(iRuang).toBeGreaterThan(-1);
    expect(iSelesai).toBeGreaterThan(iRuang);
    expect(SIDANG).toContain("hijau: selesaiTanda.hijau,");
  });

  it("Hasil Sidang: papan ruang sidang, tahu hasil yang sudah tercatat", () => {
    expect(HASIL).toContain('import { PapanRuangSidang } from "@/components/portal/jadwal-sidang-2okt";');
    expect(HASIL).toContain("hasilSidangSelesai={sudahDitunda || sudahPutus || sudahTertulis}");
    expect(KOMPONEN).toContain("window.location.assign(withBasePath(`/sidang-tunda/${encodeURIComponent(tujuan.sidangId)}`));");
  });

  // F3.1 (17 Okt 2026): Skors membuka jendela alasan + perkiraan; "Skors
  // sekarang" di jendela itulah konfirmasinya (tidak ada confirm() kedua).
  it("menekan Skors: jendela alasan, lalu POST skors (kering: false) dengan jam panggilnya", async () => {
    const { TombolRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const ambil = vi.fn(async (_alamat: string, _init?: RequestInit) => new Response(JSON.stringify({ data: { available: true, ok: true } })));
    vi.stubGlobal("fetch", ambil);
    const berubah = vi.fn();
    render(
      createElement(TombolRuangSidang, {
        baris: { perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI },
        aksi: { skors: true, lompat: false, lanjut: false, asal: null },
        berjalan: { kunci: `${HARI}|12`, perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: `${HARI} 09:40:00`, nomorAntrian: 2 },
        skors: null,
        bisaDipanggil: true,
        info: () => ({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", nomorAntrian: 2, noRuang: 1 }),
        onBerubah: berubah,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Skors/ }));
    expect(ambil).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Musyawarah majelis" }));
    fireEvent.click(screen.getByRole("button", { name: /Skors sekarang/ }));
    await waitFor(() => expect(berubah).toHaveBeenCalled());
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(String(ambil.mock.calls[0][0])).toContain("/api/aleta-ecourt/sidang/skors");
    expect(JSON.parse(String(ambil.mock.calls[0][1]?.body))).toMatchObject({
      perkaraId: "12",
      skors: true,
      kering: false,
      panggilSaatSkors: `${HARI} 09:40:00`,
      alasanKode: "musyawarah",
      alasan: "Musyawarah majelis",
    });
  });

  it("menekan Lompat ke sini: skors yang berjalan LALU panggil - berhenti pada yang gagal", async () => {
    const { TombolRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const ambil = vi.fn(async (alamat: string) =>
      String(alamat).includes("/sidang/skors")
        ? new Response(JSON.stringify({ data: { available: true, ok: false, alasan: "sudah_ditandai_selesai" } }))
        : new Response(JSON.stringify({ data: { available: true, ok: true } }))
    );
    vi.stubGlobal("fetch", ambil);
    render(
      createElement(TombolRuangSidang, {
        baris: { perkaraId: "13", nomorPerkara: "13/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI },
        aksi: {
          skors: false,
          lompat: true,
          lanjut: false,
          asal: { kunci: `${HARI}|12`, perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: "s", nomorAntrian: 2 },
        },
        berjalan: null,
        skors: null,
        bisaDipanggil: true,
        info: (id: string) => ({ nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, nomorAntrian: null, noRuang: 1 }),
        onBerubah: () => undefined,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /Lompat ke sini/ }));
    await screen.findByText(/sudah ditandai Selesai/);
    // Skors ditolak (sidang asal sudah selesai) -> panggilan TIDAK dikerjakan.
    expect(ambil).toHaveBeenCalledTimes(1);
  });

  it("baris tanpa aksi (mis. hijau) tidak menggambar tombol apa pun", async () => {
    const { TombolRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    const { container } = render(
      createElement(TombolRuangSidang, {
        baris: { perkaraId: "1", nomorPerkara: "1/x", tanggalSidang: HARI },
        aksi: aksiRuangSidang({ hijau: true, berjalan: null, skors: null, berjalanDiRuang: null, bisaDipanggil: true }),
        berjalan: null,
        skors: null,
        bisaDipanggil: true,
        info: () => ({ nomorPerkara: "1/x", nomorAntrian: null, noRuang: null }),
        onBerubah: () => undefined,
      })
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

// ============================================================================
// BUTIR 12 - LEBAR HALAMAN ALETA e-COURT
// ============================================================================

describe("butir 12 - lebar halaman ALETA e-Court", () => {
  it("terukur dari rumusnya: 1920 px -> 1.872 (J3) menjadi 1.680; di bawah 1.728 px sama dengan J3", () => {
    const tabel = [1366, 1440, 1600, 1680, 1728, 1920, 2560].map((w) => [
      w,
      lebarSebelumJ3(w),
      lebarIsiEcourt(w, "penuh"),
      lebarIsiEcourt(w, "nyaman"),
    ]);
    expect(tabel).toEqual([
      [1366, 1318, 1318, 1318],
      [1440, 1392, 1392, 1392],
      [1600, 1552, 1552, 1552],
      [1680, 1552, 1632, 1632],
      [1728, 1552, 1680, 1680],
      [1920, 1552, 1872, 1680],
      [2560, 1552, 2400, 1680],
    ]);
    expect(LEBAR_ECOURT_MAKS_PX).toEqual({ nyaman: 1680, penuh: 2400 });
  });

  it("kelasnya: rumus J3 yang sama, hanya batasnya; tanpa transform; bawaan nyaman", () => {
    expect(KELAS_LEBAR_ECOURT.nyaman).toBe(
      "min-[1600px]:ml-[calc(50%_-_min(50vw_-_1.5rem,_840px))] min-[1600px]:w-[min(100vw_-_3rem,_1680px)] min-[1600px]:max-w-none"
    );
    expect(Object.values(KELAS_LEBAR_ECOURT).join(" ")).not.toMatch(/translate|transform/);
    expect(bacaLebarEcourt(null)).toBe("nyaman");
    expect(bacaLebarEcourt("ngawur")).toBe("nyaman");
    expect(bacaLebarEcourt("penuh")).toBe("penuh");
  });

  it("halaman memakai kelas pilihan; lebar J3 tetap terjangkau lewat tombol di sidebar; diingat per peramban", () => {
    expect(PENGGUNA).toContain("<div data-lebar-ecourt={lebar} className={KELAS_LEBAR_ECOURT[lebar]}>");
    expect(PENGGUNA).toContain("useSyncExternalStore(langgananLebarEcourt, bacaLebarTersimpan, () => \"nyaman\" as LebarEcourt)");
    expect(PENGGUNA).toContain("data-tombol-lebar-ecourt");
    expect(PENGGUNA).toContain("window.localStorage.setItem(KUNCI_SIMPAN_LEBAR_ECOURT, nilai);");
    // Fit-to-size dan layar penuh tidak tersentuh.
    expect(SIDANG).toContain('"min-w-[980px] xl:min-w-0 [&_.hanya-ringkas]:hidden"');
    expect(SIDANG).toContain("<TombolLayarPenuh penuh={layarPenuh} onUbah={setLayarPenuh} />");
  });
});
