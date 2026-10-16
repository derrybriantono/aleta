/**
 * F3.1 (17 Okt 2026) - status skors sidang yang utuh dan sinkron:
 * alasan baku, perkiraan lanjut + hitung mundur, lama skors saat Lanjutkan,
 * layar antrian pihak, widget ekstensi, usulan kalimat BAS Blangko Derry.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JendelaSkors, LencanaDiskors } from "@/components/portal/jadwal-sidang-2okt";
import {
  ALASAN_SKORS,
  hitungMundur,
  jamTitik,
  kalimatPublikSkors,
  kalimatSkorsBas,
  kodeAlasanSah,
  lamaSkorsDetik,
  perkiraanDariJam,
  perkiraanDariMenit,
  riwayatSkorsSidang,
  ringkasSkors,
  skorsPublikBerlaku,
  skorsUntukBas,
  susunAlasanSkors,
  teksAlasanSkors,
  teksLama,
  type SkorsTercatat,
} from "@/lib/skors-sidang";
import { keteranganSkorsPublik } from "@/server/modules/aleta-ecourt/skors-publik";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Layanan = Record<string, (x: unknown) => Promise<Record<string, unknown>>>;
const selesaiMod = require_(path.join(AKAR, "aleta_bot/services/sidangSelesaiService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  TABEL_SKORS: string;
  kodeAlasanSkors: (x: unknown) => string;
  perkiraanLanjutSah: (x: unknown, t: unknown) => string | null;
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function tiruan(jawab: (sql: string, params: unknown[]) => unknown) {
  const catatan: Array<{ sql: string; params: unknown[] }> = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    const rapi = sql.replace(/\s+/g, " ").trim();
    catatan.push({ sql: rapi, params });
    return jawab(rapi, params);
  };
  return { kueri, catatan };
}

const HARI = "2026-10-17";

describe("lib skors-sidang - alasan, waktu, hitung mundur", () => {
  it("kode alasan baku sama dengan bot; yang lain dibuang", () => {
    expect(ALASAN_SKORS.map((a) => a.kode)).toEqual(["pihak", "saksi", "kuasa", "istirahat", "musyawarah", "berkas", "lainnya"]);
    for (const a of ALASAN_SKORS) expect(selesaiMod.kodeAlasanSkors(a.kode)).toBe(a.kode);
    expect(selesaiMod.kodeAlasanSkors("hapus'; drop")).toBe("");
    expect(kodeAlasanSah("SAKSI")).toBe("saksi");
    expect(kodeAlasanSah("x")).toBe("");
  });

  it("teks alasan: label baku + keterangan; Lainnya = keterangannya saja", () => {
    expect(susunAlasanSkors("saksi", "")).toBe("Menunggu saksi");
    expect(susunAlasanSkors("saksi", " saksi kedua  di jalan ")).toBe("Menunggu saksi - saksi kedua di jalan");
    expect(susunAlasanSkors("lainnya", "listrik padam")).toBe("listrik padam");
    expect(susunAlasanSkors("", "bebas")).toBe("bebas");
    expect(teksAlasanSkors({ alasan: "", alasanKode: "musyawarah" })).toBe("Musyawarah majelis");
  });

  it("perkiraan: pilihan cepat dibulatkan ke 5 menit; jam manual pada tanggal sidang", () => {
    const kini = new Date(2026, 9, 17, 10, 12, 30);
    expect(perkiraanDariMenit(15, kini)).toBe("2026-10-17 10:30:00");
    expect(perkiraanDariMenit(10, kini)).toBe("2026-10-17 10:25:00");
    expect(perkiraanDariJam("10:45", HARI)).toBe(`${HARI} 10:45:00`);
    expect(perkiraanDariJam("25:00", HARI)).toBe("");
    expect(selesaiMod.perkiraanLanjutSah("10.30", HARI)).toBe(`${HARI} 10:30:00`);
    expect(selesaiMod.perkiraanLanjutSah(`${HARI} 11:05:00`, HARI)).toBe(`${HARI} 11:05:00`);
    expect(selesaiMod.perkiraanLanjutSah("besok", HARI)).toBeNull();
    expect(jamTitik(`${HARI} 10:30:00`)).toBe("10.30");
  });

  it("hitung mundur: sisa, sebentar lagi, lewat", () => {
    const kini = new Date(2026, 9, 17, 10, 18, 0);
    expect(hitungMundur(`${HARI} 10:30:00`, kini)).toMatchObject({ sisaMenit: 12, lewat: false, teks: "12 mnt lagi" });
    expect(hitungMundur(`${HARI} 10:18:10`, kini)?.teks).toBe("sebentar lagi");
    expect(hitungMundur(`${HARI} 10:13:00`, kini)).toMatchObject({ lewat: true, teks: "lewat 5 mnt dari perkiraan" });
    expect(hitungMundur("", kini)).toBeNull();
  });

  it("lama skors dari kolom lama_detik atau selisih waktu", () => {
    expect(lamaSkorsDetik({ lamaDetik: 1500 })).toBe(1500);
    expect(lamaSkorsDetik({ diskorsPada: `${HARI} 09:40:00`, dilanjutkanPada: `${HARI} 10:05:00` })).toBe(1500);
    expect(lamaSkorsDetik({ diskorsPada: `${HARI} 09:40:00` })).toBeNull();
    expect(teksLama(1500)).toBe("25 menit");
    expect(teksLama(3900)).toBe("1 jam 5 menit");
    expect(teksLama(20)).toBe("kurang dari 1 menit");
  });
});

describe("layar antrian pihak - kalimat publik tanpa alasan & tanpa nama petugas", () => {
  it("kalimat: dengan / tanpa perkiraan", () => {
    expect(kalimatPublikSkors(`${HARI} 10:30:00`)).toBe("Diskors, dilanjutkan sekitar 10.30");
    expect(kalimatPublikSkors("")).toBe("Diskors sementara");
  });

  it("dipanggil lagi SESUDAH diskors = sidang berjalan lagi (walau Lanjutkan tidak ditekan)", () => {
    const c = { diskorsPada: `${HARI} 09:50:20`, dilanjutkanPada: "" };
    expect(skorsPublikBerlaku(c, "09:40")).toBe(true);
    expect(skorsPublikBerlaku(c, "")).toBe(true);
    expect(skorsPublikBerlaku(c, "10:05")).toBe(false);
    expect(skorsPublikBerlaku(c, `${HARI} 10:05:00`)).toBe(false);
    expect(skorsPublikBerlaku({ ...c, dilanjutkanPada: `${HARI} 10:00:00` }, "")).toBe(false);
  });

  it("keteranganSkorsPublik hanya membawa jam perkiraan", () => {
    const peta = new Map<string, SkorsTercatat>([
      ["7", { perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00`, perkiraanLanjut: `${HARI} 10:30:00`, alasan: "Menunggu saksi", oleh: "Ani Panitera" }],
    ]);
    const teks = keteranganSkorsPublik(peta, "7", "09:30");
    expect(teks).toBe("Diskors, dilanjutkan sekitar 10.30");
    expect(teks).not.toMatch(/saksi|Ani/);
    expect(keteranganSkorsPublik(peta, "8", "")).toBe("");
  });

  it("rute tanpa login memakai pembantu yang sama; urutan antrian tidak berubah", () => {
    const tampil = baca("manajemen_surat/src/app/api/antrian-tampil/route.ts");
    expect(tampil).toContain("keteranganSkorsPublik(skorsBerlaku, perkaraId, baris.jamPanggil)");
    expect(tampil).toContain(".sort((a, b) => Number(a.nomor) - Number(b.nomor))");
    // Hanya bila ruas "keadaan" diizinkan pimpinan.
    expect(tampil).toContain("tampil.keadaan ? await bacaSkorsBerlakuHariIni(hariIni)");
    const papan = baca("manajemen_surat/src/app/api/sidang-ruang/route.ts");
    expect(papan).toContain("keteranganSkorsPublik(skorsBerlaku");
    const layar = baca("manajemen_surat/src/app/antrian-tampil/page.tsx");
    expect(layar).toContain('b.keadaan === "diskors"');
    // Televisi ruang tunggu lama tidak disentuh.
    expect(baca("manajemen_surat/src/app/antrian-layar/page.tsx")).not.toMatch(/skors/i);
  });
});

describe("usulan kalimat BAS dari riwayat skors satu sidang", () => {
  const riwayat: SkorsTercatat[] = [
    { perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 11:10:00`, dilanjutkanPada: `${HARI} 11:30:00`, alasanKode: "musyawarah", alasan: "Musyawarah majelis" },
    { perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00`, dilanjutkanPada: `${HARI} 10:05:00`, alasanKode: "saksi", alasan: "Menunggu saksi - saksi kedua", lamaDetik: 1500 },
    { perkaraId: "7", tanggalSidang: "2026-10-10", diskorsPada: "2026-10-10 09:00:00" },
    { perkaraId: "8", tanggalSidang: HARI, diskorsPada: `${HARI} 09:00:00` },
  ];

  it("hanya sidang itu, terlama dulu; kalimat netral (tanpa 'terbuka untuk umum', tanpa nama petugas)", () => {
    const r = riwayatSkorsSidang(riwayat, "7", HARI);
    expect(r.map((x) => x.diskorsPada)).toEqual([`${HARI} 09:40:00`, `${HARI} 11:10:00`]);
    const k = kalimatSkorsBas(r);
    expect(k).toBe(
      "Pada pukul 09.40 WITA sidang diskors untuk menunggu kehadiran saksi (saksi kedua), dan pada pukul 10.05 WITA skors dicabut dan sidang dibuka kembali. " +
        "Kemudian pada pukul 11.10 WITA sidang diskors untuk musyawarah majelis hakim, dan pada pukul 11.30 WITA skors dicabut dan sidang dibuka kembali."
    );
    expect(k).not.toMatch(/terbuka untuk umum/);
    expect(ringkasSkors(r[0])).toBe("09.40-10.05 (25 menit) · Menunggu saksi - saksi kedua");
  });

  it("skors yang belum dibuka kembali tidak ditebak jamnya; alasan Lainnya memakai keterangannya", () => {
    const k = kalimatSkorsBas([{ perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 13:00:00`, alasanKode: "lainnya", alasan: "Listrik padam" }]);
    expect(k).toBe("Pada pukul 13.00 WITA sidang diskors karena listrik padam, dan sidang belum dibuka kembali pada saat catatan ini dibuat.");
    expect(kalimatSkorsBas([])).toBe("");
  });

  it("butir 49 (17 Okt): BAS hanya mencatat skors musyawarah SEBELUM pengucapan putusan; skors lain tetap di ALETA", () => {
    const r = riwayatSkorsSidang(riwayat, "7", HARI);
    // Sidang berangenda putusan: hanya skors musyawarah yang diusulkan.
    const putus = skorsUntukBas(r, "Pembacaan Putusan");
    expect(putus.map((x) => x.alasanKode)).toEqual(["musyawarah"]);
    expect(kalimatSkorsBas(putus)).toBe(
      "Pada pukul 11.10 WITA sidang diskors untuk musyawarah majelis hakim, dan pada pukul 11.30 WITA skors dicabut dan sidang dibuka kembali."
    );
    // Sidang pembuktian: tidak ada yang diusulkan ke BAS, walau ada skors (termasuk musyawarah).
    expect(skorsUntukBas(r, "Pembuktian saksi")).toEqual([]);
    // Agenda tidak diketahui: cukup alasannya musyawarah.
    expect(skorsUntukBas(r, "").map((x) => x.alasanKode)).toEqual(["musyawarah"]);
    expect(skorsUntukBas(null, "Putusan")).toEqual([]);
  });

  it("rute GET skors memakai skorsUntukBas dengan agenda; Blangko Derry mengirim agendanya", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/skors/route.ts");
    expect(rute).toContain("kalimatBas: kalimatSkorsBas(untukBas),");
    expect(rute).toContain("const untukBas = skorsUntukBas(riwayat, agenda);");
    expect(baca("ekstensi-sipp/blangko-derry-isian.js")).toContain("&agenda=${encodeURIComponent(k.agenda)}");
  });
});

describe("bot - skors dengan alasan, perkiraan, lama, dan daftar", () => {
  function layanan(jawab?: (sql: string) => unknown) {
    const bot = tiruan((sql) => {
      if (jawab) {
        const j = jawab(sql);
        if (j !== undefined) return j;
      }
      if (sql.startsWith("SELECT perkara_id FROM aleta_bot_sidang_selesai")) return [];
      if (sql.startsWith(`SELECT id FROM ${selesaiMod.TABEL_SKORS}`)) return [];
      return { affectedRows: 1 };
    });
    const sipp = tiruan((sql) => (sql.startsWith("SELECT status FROM antrian") ? [{ status: 0 }] : { affectedRows: 1 }));
    const L = selesaiMod.buatLayanan({
      kueriBot: bot.kueri,
      kueriSipp: sipp.kueri,
      kueriRuangTunggu: async () => [],
      disidangSelesai: null,
      setelAntrian: async () => ({ ok: true }),
    });
    return { L, bot, sipp };
  }
  const minta = { perkaraId: "5", tanggalSidang: HARI, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", oleh: "Ani", ip: "10.0.0.1", panggilSaatSkors: `${HARI} 09:40:00` };

  it("alasan & perkiraan hanya ke tabel ALETA; SIPP tetap hanya antrian.status 0 -> 1", async () => {
    const { L, bot, sipp } = layanan();
    const hasil = await L.setelSkors({ ...minta, alasanKode: "saksi", alasan: "Menunggu saksi", perkiraanLanjut: "10:30", kering: false });
    expect(hasil.ok).toBe(true);
    const sisip = bot.catatan.find((c) => c.sql.startsWith(`INSERT INTO ${selesaiMod.TABEL_SKORS}`));
    expect(sisip?.sql).toContain("alasan_kode, perkiraan_lanjut");
    expect(sisip?.params.slice(-2)).toEqual(["saksi", `${HARI} 10:30:00`]);
    const tulisSipp = sipp.catatan.filter((c) => c.sql.startsWith("UPDATE"));
    expect(tulisSipp).toHaveLength(1);
    expect(JSON.stringify(tulisSipp)).not.toMatch(/saksi|10:30/);
  });

  it("skors lama yang sudah dimulai lagi lewat antrian ditutup pada jam mulainya, lalu skors baru tercatat", async () => {
    const { L, bot } = layanan();
    await L.setelSkors({ ...minta, panggilSaatSkors: `${HARI} 10:20:00`, kering: false });
    const tutup = bot.catatan.find((c) => c.sql.includes("'(dipanggil lagi lewat antrian)'"));
    expect(tutup?.sql).toContain("AND dilanjutkan_pada IS NULL AND diskors_pada < ?");
    expect(tutup?.params).toEqual([`${HARI} 10:20:00`, `${HARI} 10:20:00`, "5", HARI, `${HARI} 10:20:00`]);
    const iUbah = bot.catatan.indexOf(tutup!);
    const iSisip = bot.catatan.findIndex((c) => c.sql.startsWith(`INSERT INTO ${selesaiMod.TABEL_SKORS}`));
    expect(iSisip).toBeGreaterThan(iUbah);
  });

  it("sudah diskors: perkiraan boleh diperbarui tanpa mengosongkan alasan", async () => {
    const { L, bot } = layanan((sql) => (sql.startsWith(`SELECT id FROM ${selesaiMod.TABEL_SKORS}`) ? [{ id: 3 }] : undefined));
    await L.setelSkors({ ...minta, panggilSaatSkors: "", perkiraanLanjut: "11:00", kering: false });
    expect(bot.catatan.some((c) => c.sql.startsWith("INSERT"))).toBe(false);
    const ubah = bot.catatan.find((c) => c.sql.startsWith(`UPDATE ${selesaiMod.TABEL_SKORS} SET perkiraan_lanjut = ?`));
    expect(ubah?.params).toEqual([`${HARI} 11:00:00`, "5", HARI]);
    expect(ubah?.sql).not.toContain("alasan");
  });

  it("Lanjutkan mencatat lama skors dan memulangkannya", async () => {
    const { L, bot } = layanan((sql) => (sql.startsWith("SELECT lama_detik AS lamaDetik") ? [{ lamaDetik: 1020 }] : undefined));
    const hasil = await L.setelSkors({ ...minta, skors: false, kering: false });
    expect(bot.catatan.some((c) => c.sql.includes("lama_detik = TIMESTAMPDIFF(SECOND, diskors_pada, NOW())"))).toBe(true);
    expect(hasil.lamaDetik).toBe(1020);
  });

  it("daftarSkors: hanya SELECT tabel ALETA, rentang dibatasi, angka lama terbaca", async () => {
    const { L, bot, sipp } = layanan((sql) =>
      sql.includes(`FROM ${selesaiMod.TABEL_SKORS}`) && sql.includes("ORDER BY diskors_pada ASC")
        ? [
            { perkaraId: "7", tanggalSidang: HARI, nomorPerkara: "7/x", alasan: "Istirahat", alasanKode: "istirahat", diskorsPada: `${HARI} 12:00:00`, perkiraanLanjut: `${HARI} 13:00:00`, dilanjutkanPada: `${HARI} 13:02:00`, lamaDetik: "3720" },
            { perkaraId: "", tanggalSidang: HARI },
          ]
        : undefined
    );
    const hasil = (await L.daftarSkors({ dari: HARI, sampai: HARI, perkaraId: "7" })) as { ok: boolean; skors: Array<Record<string, unknown>> };
    expect(hasil.ok).toBe(true);
    expect(hasil.skors).toHaveLength(1);
    expect(hasil.skors[0]).toMatchObject({ alasanKode: "istirahat", lamaDetik: 3720, perkiraanLanjut: `${HARI} 13:00:00` });
    expect(bot.catatan.filter((c) => /^(INSERT|UPDATE|DELETE|REPLACE)/.test(c.sql))).toEqual([]);
    expect(sipp.catatan).toEqual([]);
    expect(await L.daftarSkors({ dari: "2026-01-01", sampai: HARI })).toMatchObject({ ok: false, alasan: "rentang_terlalu_panjang" });
    expect(await L.daftarSkors({ dari: HARI, perkaraId: "1 OR 1" })).toMatchObject({ ok: false, alasan: "perkara_tidak_sah" });
  });

  it("tabel lama di server mendapat kolom baru lewat information_schema (tanpa IF NOT EXISTS)", async () => {
    const { L, bot } = layanan((sql) =>
      sql.startsWith("SELECT COLUMN_NAME AS nama FROM information_schema.COLUMNS") ? [{ nama: "id" }, { nama: "alasan" }, { nama: "alasan_kode" }] : undefined
    );
    await L.daftarSkors({ dari: HARI });
    const alter = bot.catatan.find((c) => c.sql.startsWith("ALTER TABLE"));
    expect(alter?.sql).toBe(`ALTER TABLE ${selesaiMod.TABEL_SKORS} ADD COLUMN perkiraan_lanjut DATETIME NULL, ADD COLUMN lama_detik INT NULL`);
  });

  it("rute bot & portal: GET /skors bertoken; POST meneruskan alasan baku dan perkiraan", () => {
    const ruteBot = baca("aleta_bot/routes/jadwalSidangRoutes.js");
    expect(ruteBot).toContain('router.get("/skors", wajibToken,');
    expect(ruteBot).toContain("alasanKode: badan.alasanKode,");
    const rutePortal = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/skors/route.ts");
    expect(rutePortal).toContain("export async function GET");
    expect(rutePortal).toContain("alasanKode: kodeAlasanSah(badan.alasanKode)");
    expect(rutePortal).toContain('await pastikanKapabilitas(db, actorUserId, "panel");');
  });
});

describe("tampilan portal - jendela Skors dan lencana diskors", () => {
  it("jendela Skors mengirim alasan baku, keterangan, dan perkiraan", () => {
    const kirim = vi.fn();
    render(createElement(JendelaSkors, { nomorPerkara: "5/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI, sibuk: false, onBatal: () => {}, onSkors: kirim }));
    fireEvent.click(screen.getByRole("button", { name: "Menunggu saksi" }));
    fireEvent.change(screen.getByLabelText("Keterangan alasan skors"), { target: { value: "saksi kedua" } });
    fireEvent.change(screen.getByLabelText("Jam perkiraan dilanjutkan"), { target: { value: "10:30" } });
    expect(screen.getByText(/diskors, dilanjutkan sekitar 10\.30/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Skors sekarang/ }));
    expect(kirim).toHaveBeenCalledWith({ alasanKode: "saksi", alasan: "Menunggu saksi - saksi kedua", perkiraanLanjut: `${HARI} 10:30:00` });
  });

  it("Lainnya wajib diberi keterangan sebelum menskors", () => {
    render(createElement(JendelaSkors, { nomorPerkara: "5", tanggalSidang: HARI, sibuk: false, onBatal: () => {}, onSkors: () => {} }));
    fireEvent.click(screen.getByRole("button", { name: "Lainnya" }));
    expect((screen.getByRole("button", { name: /Skors sekarang/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lencana diskors menyebut alasan, perkiraan lanjut, dan hitung mundurnya", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 10, 18, 0));
    const { container } = render(
      createElement(LencanaDiskors, {
        catatan: { perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00`, alasanKode: "saksi", alasan: "Menunggu saksi", perkiraanLanjut: `${HARI} 10:30:00` },
      })
    );
    expect(container.textContent).toContain("diskors · belum selesai");
    expect(container.textContent).toContain("sejak 09:40 · Menunggu saksi · lanjut ±10.30");
    expect(container.querySelector("[data-hitung-mundur-skors]")?.textContent).toBe("(12 mnt lagi)");
  });

  it("lencana tanpa alasan/perkiraan tetap sama seperti sebelum F3.1", () => {
    const { container } = render(createElement(LencanaDiskors, { catatan: { perkaraId: "7", tanggalSidang: HARI, diskorsPada: `${HARI} 09:40:00` } }));
    expect(container.querySelector("[data-diskors-rinci]")).toBeNull();
    expect(container.querySelector("[data-diskors]")?.textContent).toContain("diskors · belum selesai");
  });
});

describe("ekstensi - widget Lama sidang dan Blangko Derry BAS", () => {
  const CHECKLIST = baca("ekstensi-sipp/checklist.js");
  const DERRY = baca("ekstensi-sipp/blangko-derry-isian.js");

  it("widget hanya MEMBACA skors hari ini, paling sering semenit sekali, dan berhenti bersama widgetnya", () => {
    expect(CHECKLIST).toContain('const ALAMAT_SKORS = "/aleta/api/aleta-ecourt/sidang/skors";');
    expect(CHECKLIST).toContain("const SKORS_SEGAR_MS = 60 * 1000;");
    expect(CHECKLIST).toContain("`${ALAMAT_SKORS}?tanggal=${tanggalHariIniSkors()}`");
    expect(CHECKLIST).toMatch(/if \(jamSkors\) clearInterval\(jamSkors\);\n\s+jamSkors = null;\n\s+if \(akar\) akar\.remove\(\);/);
    // Tidak ada tulisan dari widget ke rute skors.
    expect(CHECKLIST).not.toMatch(/ALAMAT_SKORS[^\n]*method:\s*"POST"/);
  });

  it("Blangko Derry BAS: kartu skors hanya untuk BAS, membaca riwayat sidang terpilih, menyalin tanpa menulis ABT", () => {
    expect(DERRY).toContain('(S.blangko.jenis === "bas" ? `<div id="bd-skorsbas"></div>` : "")');
    expect(DERRY).toContain("`${API_SKORS_SIDANG}?tanggal=${k.tanggal}&perkaraId=${encodeURIComponent(k.id)}${k.agenda ? `&agenda=${encodeURIComponent(k.agenda)}` : \"\"}`");
    expect(DERRY).toContain('if (kode === "salinskors") return void salinKalimatSkors();');
    // Kartu kosong bila sidang ini tidak pernah diskors (isian bersyarat).
    expect(DERRY).toContain("if (!sb || !sb.riwayat.length || !sb.kalimat) {");
  });
});
