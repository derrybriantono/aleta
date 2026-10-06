// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jamSidangBerikut } from "@/lib/bawaan-tunda";
import * as cc from "@/lib/court-calendar-susun";
import { bolehIsiCourtCalendar } from "@/lib/court-calendar-hak";
import { pilihAkunSipp } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * BUTIR 3 (6 Okt 2026) - COURT CALENDAR DARI JADWAL SIDANG, TERINPUT DI SIPP
 * ============================================================================
 *
 *   SATU ATURAN     @/lib/court-calendar-susun diadu dengan ccSusun di
 *                   ekstensi-sipp/konten.js YANG ASLI (dijalankan di node:vm)
 *                   atas matriks perkara - keluaran harus identik, termasuk
 *                   seluruh tetapan. Satu angka berubah di satu sisi = merah.
 *   PENULIS SIPP    courtCalendarTulisService dijalankan atas basis data
 *                   tiruan: pernyataan INSERT/UPDATE berbentuk validateInput/
 *                   validateEdit SIPP (kolom, urutan, jam DUA BELAS dari NOW()),
 *                   TANPA sys_audittrail, akun dari sys_users, pagar Sabtu/
 *                   Minggu & tanggal pendaftaran, kering bawaan, jeda sebelum
 *                   tiap tulisan, "tersimpan" hanya bila terbaca ulang.
 *   AKUN & HAK      tanpa akun SIPP milik sendiri = ditolak SEBELUM bot
 *                   dipanggil; hakim ditolak; kering bila tidak disebut.
 */

const AKAR = path.resolve(process.cwd(), "..");
const KONTEN = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");

/** Satu fungsi tingkat atas konten.js, utuh sampai kurung tutupnya di kolom 0. */
function potongFungsi(nama: string) {
  const awal = KONTEN.indexOf(`\nfunction ${nama}(`);
  if (awal < 0) throw new Error(`fungsi ${nama} tidak ada di konten.js`);
  const akhir = KONTEN.indexOf("\n}\n", awal);
  return KONTEN.slice(awal, akhir + 3);
}

/** Mesin butir 29 dari konten.js yang asli. */
function mesinEkstensi() {
  const awal = KONTEN.indexOf("const CC_LIBUR = {");
  const akhir = KONTEN.indexOf("// ─── Membaca dan menulis Court Calendar SIPP");
  expect(awal).toBeGreaterThan(0);
  expect(akhir).toBeGreaterThan(awal);
  const sumber =
    KONTEN.slice(awal, akhir) +
    potongFungsi("ccKunciBaris") +
    potongFungsi("ccPeriksaBaris") +
    potongFungsi("ccMasukan") +
    "\nglobalThis.__cc = { ccSusun, ccKunciBaris, ccPeriksaBaris, ccMasukan, ccMajuHariKerja, ccTahap, ccGolongan," +
    " CC_LIBUR, CC_LIBUR_TAHUN_LENGKAP, CC_HARI_DAFTAR, CC_HARI, CC_URUT, CC_PENJELASAN, CC_TAHAP_SORE, CC_JAM_PAGI, CC_JAM_SORE };";
  const ctx = vm.createContext({});
  vm.runInContext(sumber, ctx);
  return (ctx as { __cc: Record<string, any> }).__cc;
}

const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ----------------------------------------------------------------------------
// Matriks perkara
// ----------------------------------------------------------------------------
const JENIS: Array<[string, string]> = [
  ["Cerai Gugat", "500/Pdt.G/2026/PA.Dgl"],
  ["Cerai Talak", "501/Pdt.G/2026/PA.Dgl"],
  ["Istbat Nikah", "90/Pdt.P/2026/PA.Dgl"],
  ["Dispensasi Kawin", "91/Pdt.P/2026/PA.Dgl"],
  ["Perwalian", "92/Pdt.P/2026/PA.Dgl"],
  ["Ekonomi Syariah", "3/Pdt.G.S/2026/PA.Dgl"],
  ["Harta Bersama", "502/Pdt.G/2026/PA.Dgl"],
  ["Izin Poligami", "503/Pdt.G/2026/PA.Dgl"],
];

type Keadaan = Partial<cc.MasukanCc>;
const KEADAAN: Array<[string, Keadaan]> = [
  ["belum apa-apa, ada pendaftaran", { tanggalDaftar: "2026-09-22", kalender: [] }],
  ["belum apa-apa, ada PHS", { tanggalDaftar: "2026-09-22", sidangPertama: "2026-10-07", kalender: [] }],
  ["tanpa pendaftaran dan PHS", { kalender: [] }],
  ["kalender belum terbaca", { tanggalDaftar: "2026-09-22", kalender: null }],
  [
    "verstek - pihak kedua tak pernah hadir",
    { tanggalDaftar: "2026-09-01", jadwal: [{ tanggal: "2026-09-15", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 2 }], kalender: [] },
  ],
  [
    "litigasi e-Court sesudah mediasi gagal",
    {
      tanggalDaftar: "2026-08-20",
      ecourt: true,
      jadwal: [
        { tanggal: "2026-09-02", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 1 },
        { tanggal: "2026-09-23", jam: "09:00", agenda: "Mendengar Laporan Hasil Mediasi", dihadiriOleh: 1 },
      ],
      mediasi: { baris: [{ berhasil: false }] },
      kalender: [{ tanggal: "2026-09-02", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" }],
    },
  ],
  [
    "mediasi berhasil",
    {
      tanggalDaftar: "2026-08-20",
      jadwal: [{ tanggal: "2026-09-02", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 1 }],
      mediasi: { baris: [{ berhasil: true }] },
      kalender: [],
    },
  ],
  [
    "sudah putus, ikrar belum",
    {
      tanggalDaftar: "2026-07-01",
      jadwal: [{ tanggal: "2026-08-04", jam: "09:00", agenda: "Pembacaan Putusan", dihadiriOleh: 1 }],
      sudahPutus: true,
      kalender: [],
    },
  ],
  [
    "sidang terjadwal belum di kalender + lampau",
    {
      tanggalDaftar: "2026-09-01",
      jadwal: [
        { tanggal: "2026-09-16", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 3 },
        { tanggal: "2026-10-14", jam: "15:00", agenda: "Replik Penggugat", dihadiriOleh: null },
      ],
      kalender: [{ tanggal: "2026-10-28", jam: "09:00", agenda: "Pembuktian", keterangan: "x" }],
    },
  ],
  ["jatuh di Natal dan 2027", { tanggalDaftar: "2026-12-10", sidangPertama: "2026-12-18", kalender: [] }],
];

describe("satu aturan: @/lib/court-calendar-susun = ccSusun konten.js", () => {
  const ek = mesinEkstensi();

  it("seluruh tetapan identik", () => {
    expect(polos(cc.CC_LIBUR)).toEqual(polos(ek.CC_LIBUR));
    expect(polos(cc.CC_LIBUR_TAHUN_LENGKAP)).toEqual(polos(ek.CC_LIBUR_TAHUN_LENGKAP));
    expect(polos(cc.CC_HARI_DAFTAR)).toEqual(polos(ek.CC_HARI_DAFTAR));
    expect(polos(cc.CC_HARI)).toEqual(polos(ek.CC_HARI));
    expect(polos(cc.CC_URUT)).toEqual(polos(ek.CC_URUT));
    expect(polos(cc.CC_PENJELASAN)).toEqual(polos(ek.CC_PENJELASAN));
    expect(polos(cc.CC_TAHAP_SORE)).toEqual(polos(ek.CC_TAHAP_SORE));
    expect([cc.CC_JAM_PAGI, cc.CC_JAM_SORE]).toEqual([ek.CC_JAM_PAGI, ek.CC_JAM_SORE]);
  });

  for (const hariIni of ["2026-10-06", "2026-12-20"]) {
    for (const [jenis, nomor] of JENIS) {
      for (const [nama, keadaan] of KEADAAN) {
        it(`${jenis} - ${nama} (hari ini ${hariIni})`, () => {
          const masukan = { nomorPerkara: nomor, jenisPerkara: jenis, hariIni, ...keadaan };
          const portal = cc.ccSusun(polos(masukan));
          const ekstensi = ek.ccSusun(polos(masukan));
          expect(polos(portal)).toEqual(polos(ekstensi));
        });
      }
    }
  }

  it("ccMasukan, ccPeriksaBaris, ccKunciBaris berperilaku sama", () => {
    const status = {
      tahapan: { tahap: [{ kunci: "pendaftaran", tanggal: "2026-09-01T00:00:00" }], sidangPertama: "2026-09-16" },
      identitasPihak: { jenisPerkara: "Cerai Talak" },
      jadwal: [{ tanggalSidang: "2026-09-16", jamSidang: "09:00:00", agenda: "Sidang Pertama", dihadiriOleh: 1 }],
      mediasi: { baris: [{ berhasil: false }] },
      lewatEcourt: true,
      putusan: { sudahPutus: false },
      ikrarTalak: { ada: false },
    };
    const kal = [{ tanggal: "2026-09-16", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" }];
    const a = cc.ccMasukan(polos(status), { nomorPerkara: "501/Pdt.G/2026/PA.Dgl" }, polos(kal), "2026-10-06");
    const b = ek.ccMasukan(polos(status), { nomorPerkara: "501/Pdt.G/2026/PA.Dgl" }, polos(kal));
    b.hariIni = "2026-10-06";
    expect(polos(a)).toEqual(polos(b));
    expect(polos(cc.ccSusun(a))).toEqual(polos(ek.ccSusun(b)));

    const contoh = [
      { agenda: "", tanggal: "2026-10-13", jam: "09:00" },
      { agenda: "x", tanggal: "", jam: "09:00" },
      { agenda: "x", tanggal: "2026-10-13", jam: "9:00" },
      { agenda: "x", tanggal: "2026-10-10", jam: "09:00" },
      { agenda: "x", tanggal: "2026-08-31", jam: "09:00" },
      { agenda: "x", tanggal: "2026-10-13", jam: "15:00" },
    ];
    for (const x of contoh) {
      expect(cc.ccPeriksaBaris(x, "2026-09-01")).toBe(ek.ccPeriksaBaris(x, "2026-09-01"));
      expect(cc.ccKunciBaris({ ...x, agenda: `  ${x.agenda}  Sidang ` })).toBe(ek.ccKunciBaris({ ...x, agenda: `  ${x.agenda}  Sidang ` }));
    }
  });
});

describe("rekomendasi ALETA - perilaku yang dipakai layar", () => {
  it("cerai talak e-Litigasi: jawab-menjawab 15:00 'Elitigasi', ikrar 35 hari sesudah putusan, Sabtu/Minggu/libur dilompati", () => {
    const h = cc.ccSusun({
      nomorPerkara: "501/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Talak",
      hariIni: "2026-10-06",
      ecourt: true,
      jadwal: [{ tanggal: "2026-10-06", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 1 }],
      kalender: [],
    });
    expect(h.jalur).toBe("litigasi");
    const jawaban = h.baris.find((b) => b.tahap === "jawaban")!;
    expect(jawaban).toMatchObject({ agenda: "Jawaban Termohon", jam: "15:00", keterangan: "Elitigasi", asal: "rencana", pilih: true });
    const putusan = h.baris.find((b) => b.tahap === "putusan")!;
    const ikrar = h.baris.find((b) => b.tahap === "ikrar")!;
    expect(ikrar.tanggal).toBe(cc.ccMajuHariKerja(cc.ccTambahHari(putusan.tanggal, 35)));
    for (const b of h.baris.filter((x) => x.asal === "rencana")) expect(cc.ccBukanHariKerja(b.tanggal)).toBe("");
  });

  it("jam rekomendasi = jam bawaan borang tunda untuk agenda yang sama (satu mesin)", () => {
    const h = cc.ccSusun({
      nomorPerkara: "500/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      hariIni: "2026-10-06",
      jadwal: [{ tanggal: "2026-10-06", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 1 }],
      kalender: [],
    });
    expect(h.baris.length).toBeGreaterThan(5);
    for (const b of h.baris.filter((x) => x.asal === "rencana")) expect(b.jam).toBe(jamSidangBerikut(b.agenda));
  });

  it("baris manual: sepekan sesudah baris terakhir, maju melewati Natal ke Senin", () => {
    const b = cc.ccBarisTambahan("2026-12-18", "2026-10-06");
    expect(b).toMatchObject({ tanggal: "2026-12-28", jam: "09:00", agenda: "", pilih: true, catatan: "baris tambahan" });
  });

  it("baris yang sudah di Court Calendar SIPP tidak disusun ulang dan tidak dicentang", () => {
    const h = cc.ccSusun({
      nomorPerkara: "500/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      hariIni: "2026-10-06",
      tanggalDaftar: "2026-09-22",
      sidangPertama: "2026-10-07",
      kalender: [
        { tanggal: "2026-10-07", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" },
        { tanggal: "2026-10-21", jam: "09:00", agenda: "Pemeriksaan Pokok Perkara", keterangan: "" },
      ],
    });
    expect(h.baris).toEqual([]);
    expect(h.catatan.join(" ")).toMatch(/sudah memuat seluruh rencana/);
  });
});

// ----------------------------------------------------------------------------
// Penulis SIPP di bot
// ----------------------------------------------------------------------------
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const layananBot = requireBot(path.join(AKAR, "aleta_bot/services/courtCalendarTulisService.js"));

type Kueri = { sql: string; params: unknown[] };

function basisDataTiruan(awal: Array<Record<string, unknown>> = []) {
  const rekaman: Kueri[] = [];
  const jeda: string[] = [];
  const kalender = awal.map((b) => ({ ...b }));
  let idBerikut = 9000;
  const kueri = async (sql: string, params: unknown[] = []) => {
    rekaman.push({ sql, params });
    const s = sql.replace(/\s+/g, " ");
    if (/FROM sys_users/.test(s)) {
      const u = String(params[0]).toLowerCase();
      if (u === "munifa,sh.") return [{ username: "munifa,SH.", fullname: "Munifa, S.H.", block: "0" }];
      if (u === "lama") return [{ username: "lama", fullname: "Akun Lama", block: "1" }];
      return [];
    }
    if (/FROM perkara WHERE/.test(s)) {
      return Number(params[0]) === 10049
        ? [{ perkaraId: 10049, nomorPerkara: "123/Pdt.G/2026/PA.Dgl", tanggalDaftar: "2026-09-01", jenisPerkara: "Cerai Gugat" }]
        : [];
    }
    if (/^SELECT id, DATE_FORMAT\(rencana_tanggal/.test(s.trim())) return kalender.map((b) => ({ ...b }));
    if (/^INSERT INTO perkara_court_calendar/.test(s)) {
      idBerikut += 1;
      kalender.push({
        id: idBerikut,
        tanggal: params[1],
        jam: params[2],
        agenda: params[3],
        keterangan: params[4],
        diinputOleh: params[5],
        diinputTanggal: "2026-10-06 02:15:00",
        diperbaharuiOleh: null,
        diperbaharuiTanggal: null,
      });
      return { insertId: idBerikut, affectedRows: 1 };
    }
    if (/^UPDATE perkara_court_calendar/.test(s)) {
      const b = kalender.find((x) => x.id === params[5] && params[6] === 10049);
      if (!b) return { affectedRows: 0 };
      Object.assign(b, { tanggal: params[0], jam: params[1], agenda: params[2], keterangan: params[3], diperbaharuiOleh: params[4] });
      return { affectedRows: 1 };
    }
    throw new Error(`kueri tak terduga: ${s.slice(0, 80)}`);
  };
  const layanan = layananBot.buatLayanan({
    kueri,
    tabelAda: async () => true,
    jeda: async (jenis: string, opsi: { kering?: boolean }) => {
      jeda.push(`${jenis}:${opsi?.kering ? "kering" : "sungguh"}`);
      return 0;
    },
  });
  const tulisan = () => rekaman.filter((k) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(k.sql));
  return { layanan, rekaman, tulisan, jeda, kalender };
}

const LAMA = [
  {
    id: 8717,
    tanggal: "2026-09-08",
    jam: "09:00",
    agenda: "Sidang Pertama",
    keterangan: "",
    diinputOleh: "andini",
    diinputTanggal: "2026-09-01 11:43:47",
    diperbaharuiOleh: null,
    diperbaharuiTanggal: null,
  },
];

describe("penulis Court Calendar SIPP (bot)", () => {
  it("bentuk validateInput/validateEdit SIPP: kolom, urutan, jam DUA BELAS dari NOW(), akun dari sys_users, TANPA sys_audittrail", async () => {
    const t = basisDataTiruan(LAMA);
    const rencana = await t.layanan.susunRencana({
      perkaraId: 10049,
      akunSipp: "MUNIFA,SH.",
      operator: "Penguji",
      tambah: [{ tanggal: "2026-10-13", jam: "15:00", agenda: "  Replik Penggugat ", keterangan: "Elitigasi" }],
      ubah: [{ id: 8717, tanggal: "2026-09-09", jam: "09:00", agenda: "Sidang Pertama", keterangan: "Panggil Tergugat" }],
    });
    expect(rencana.ok).toBe(true);
    // Ejaan akun dari sys_users, bukan ejaan kiriman.
    expect(rencana.akunSipp.username).toBe("munifa,SH.");
    const ins = rencana.langkah.find((x: { aksi: string }) => x.aksi === "INSERT");
    const upd = rencana.langkah.find((x: { aksi: string }) => x.aksi === "UPDATE");
    expect(ins.sql).toBe(
      "INSERT INTO perkara_court_calendar (perkara_id, rencana_tanggal, rencana_jam, rencana_agenda, keterangan, diinput_oleh, diinput_tanggal) " +
        "VALUES (?,?,?,?,?,?,DATE_FORMAT(NOW(), '%Y-%m-%d %h:%i:%s'))"
    );
    expect(ins.params).toEqual([10049, "2026-10-13", "15:00", "Replik Penggugat", "Elitigasi", "munifa,SH."]);
    expect(upd.sql).toBe(
      "UPDATE perkara_court_calendar SET rencana_tanggal = ?, rencana_jam = ?, rencana_agenda = ?, keterangan = ?, " +
        "diperbaharui_oleh = ?, diperbaharui_tanggal = DATE_FORMAT(NOW(), '%Y-%m-%d %h:%i:%s') WHERE id = ? AND perkara_id = ?"
    );
    expect(upd.params).toEqual(["2026-09-09", "09:00", "Sidang Pertama", "Panggil Tergugat", "munifa,SH.", 8717, 10049]);
    // Jam dua belas ala date("h") - bukan %H; diedit_* tidak disentuh.
    for (const l of rencana.langkah) {
      expect(l.sql).not.toMatch(/%H/);
      expect(l.sql).not.toMatch(/diedit_/);
      expect(l.tabel).toBe("perkara_court_calendar");
    }
    expect(JSON.stringify(rencana)).not.toMatch(/sys_audittrail|ALETA/i);

    const hasil = await t.layanan.jalankanRencana(rencana, { kering: false });
    expect(t.tulisan().map((k) => k.sql.split(" ")[0])).toEqual(["UPDATE", "INSERT"]);
    expect(t.rekaman.some((k) => /sys_audittrail/i.test(k.sql))).toBe(false);
    expect(t.rekaman.some((k) => k.params.some((p) => /aleta/i.test(String(p))))).toBe(false);
    // Jeda manusia sungguhan sebelum TIAP tulisan.
    expect(t.jeda).toEqual(["klik:sungguh", "simpan:sungguh"]);
    expect(hasil.ok).toBe(true);
    expect(hasil.hasil.map((h: { keadaan: string }) => h.keadaan)).toEqual(["tersimpan", "tersimpan"]);
    expect(hasil.daftarSesudah).toHaveLength(2);
  });

  it("kering sebagai bawaan: tanpa { kering:false } tidak satu pun tulisan, tanpa jeda", async () => {
    const t = basisDataTiruan(LAMA);
    const rencana = await t.layanan.susunRencana({
      perkaraId: 10049,
      akunSipp: "munifa,SH.",
      operator: "Penguji",
      tambah: [{ tanggal: "2026-10-13", jam: "09:00", agenda: "Pembuktian Penggugat" }],
    });
    for (const opsi of [undefined, {}, { kering: true }, { kering: "false" }, { kering: 0 }]) {
      const h = await t.layanan.jalankanRencana(rencana, opsi);
      expect(h.kering).toBe(true);
      expect(h.rencana[0].sql).toMatch(/^INSERT INTO perkara_court_calendar/);
    }
    expect(t.tulisan()).toEqual([]);
    expect(t.jeda).toEqual([]);
  });

  it("tanpa akun SIPP / akun tak dikenal / akun diblokir = ditolak, tidak ada rencana", async () => {
    const t = basisDataTiruan(LAMA);
    const dasar = { perkaraId: 10049, operator: "Penguji", tambah: [{ tanggal: "2026-10-13", jam: "09:00", agenda: "Pembuktian" }] };
    expect(await t.layanan.susunRencana({ ...dasar })).toMatchObject({ ok: false, alasan: "akun_sipp_tidak_disebut" });
    expect(await t.layanan.susunRencana({ ...dasar, akunSipp: "fahri" })).toMatchObject({ ok: false, alasan: "akun_sipp_tidak_ketemu" });
    expect(await t.layanan.susunRencana({ ...dasar, akunSipp: "lama" })).toMatchObject({ ok: false, alasan: "akun_sipp_diblokir" });
    expect(await t.layanan.jalankanRencana({ ok: false }, { kering: false })).toMatchObject({ ok: false });
    expect(t.tulisan()).toEqual([]);
  });

  it("pagar blangko SIPP per baris: Sabtu/Minggu, sebelum pendaftaran, agenda kosong, id bukan milik perkara; ganda & tak berubah dilewati", async () => {
    const t = basisDataTiruan(LAMA);
    const r = await t.layanan.susunRencana({
      perkaraId: 10049,
      akunSipp: "munifa,SH.",
      operator: "Penguji",
      tambah: [
        { tanggal: "2026-10-10", jam: "09:00", agenda: "Sabtu" },
        { tanggal: "2026-08-31", jam: "09:00", agenda: "Sebelum daftar" },
        { tanggal: "2026-10-13", jam: "09:00", agenda: "   " },
        { tanggal: "2026-09-08", jam: "09:00", agenda: "sidang  pertama" },
        { tanggal: "2026-10-14", jam: "09:00", agenda: "Pembuktian" },
      ],
      ubah: [
        { id: 1, tanggal: "2026-10-13", jam: "09:00", agenda: "punya perkara lain" },
        { id: 8717, tanggal: "2026-09-08", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" },
      ],
    });
    expect(r.ok).toBe(true);
    const tolak = Object.fromEntries(r.ditolak.map((x: { jenis: string; ke: number; pesan: string }) => [`${x.jenis}${x.ke}`, x.pesan]));
    expect(tolak.tambah0).toBe(layananBot.PESAN.libur);
    expect(tolak.tambah1).toBe(layananBot.PESAN.sebelumDaftar);
    expect(tolak.tambah2).toBe(layananBot.PESAN.agenda);
    expect(tolak.ubah0).toBe(layananBot.PESAN.tidakAda);
    expect(r.dilewati.map((x: { jenis: string; ke: number }) => `${x.jenis}${x.ke}`).sort()).toEqual(["tambah3", "ubah1"]);
    expect(r.langkah).toHaveLength(1);
    expect(r.langkah[0].params[3]).toBe("Pembuktian");
  });

  it("dibaca segar sebelum menulis: baris yang muncul di sela pratinjau dan simpan tidak ditulis ganda", async () => {
    const t = basisDataTiruan(LAMA);
    const r = await t.layanan.susunRencana({
      perkaraId: 10049,
      akunSipp: "munifa,SH.",
      operator: "Penguji",
      tambah: [{ tanggal: "2026-10-14", jam: "09:00", agenda: "Pembuktian" }],
    });
    t.kalender.push({ id: 8800, tanggal: "2026-10-14", jam: "09:00", agenda: "Pembuktian", keterangan: "", diinputOleh: "andini" });
    const h = await t.layanan.jalankanRencana(r, { kering: false });
    expect(t.tulisan()).toEqual([]);
    expect(h.hasil[0].keadaan).toBe("sudah-ada");
  });

  it("'tersimpan' hanya bila terbaca ulang - baris yang tidak kembali disebut belum-terbaca", async () => {
    const t = basisDataTiruan(LAMA);
    const r = await t.layanan.susunRencana({
      perkaraId: 10049,
      akunSipp: "munifa,SH.",
      operator: "Penguji",
      tambah: [{ tanggal: "2026-10-14", jam: "09:00", agenda: "Pembuktian" }],
    });
    // Basis data yang menjawab insertId tetapi barisnya tidak pernah ada.
    const asli = t.kalender.push.bind(t.kalender);
    t.kalender.push = (() => 0) as typeof t.kalender.push;
    const h = await t.layanan.jalankanRencana(r, { kering: false });
    t.kalender.push = asli;
    expect(h.hasil[0].keadaan).toBe("belum-terbaca");
    expect(h.ok).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Akun SIPP pengguna ALETA dan hak
// ----------------------------------------------------------------------------
describe("akun SIPP milik pengguna yang login", () => {
  const k = (userId: string, username: string, aktif = true, keadaan = "sah") => ({ userId, username, aktif, keadaan });

  it("tanpa kredensial SIPP = ditolak, tidak pernah meminjam akun lain", () => {
    expect(pilihAkunSipp([k("usr_lain", "munifa,SH.")], "usr_saya")).toMatchObject({ ok: false, alasan: "akun_sipp_belum_tertaut" });
    expect(pilihAkunSipp([k("usr_saya", "derry", false)], "usr_saya")).toMatchObject({ ok: false, alasan: "akun_sipp_belum_tertaut" });
  });

  it("akun yang juga diklaim orang lain dengan bukti setara bukan milik siapa pun", () => {
    expect(pilihAkunSipp([k("usr_saya", "meja1"), k("usr_lain", "meja1")], "usr_saya")).toMatchObject({ ok: false, alasan: "akun_sipp_belum_tertaut" });
  });

  it("satu akun = itu; meminta akun orang lain ditolak; dua akun harus dipilih", () => {
    expect(pilihAkunSipp([k("usr_saya", "derry")], "usr_saya")).toMatchObject({ ok: true, username: "derry" });
    expect(pilihAkunSipp([k("usr_saya", "derry"), k("usr_lain", "fahri")], "usr_saya", "fahri")).toMatchObject({
      ok: false,
      alasan: "akun_sipp_bukan_milik_anda",
    });
    const dua = [k("usr_saya", "derry"), k("usr_saya", "meja2")];
    expect(pilihAkunSipp(dua, "usr_saya")).toMatchObject({ ok: false, alasan: "akun_sipp_ganda", milik: ["derry", "meja2"] });
    expect(pilihAkunSipp(dua, "usr_saya", "MEJA2")).toMatchObject({ ok: true, username: "meja2" });
  });

  it("hak: panitera, PP, panitera muda, admin - bukan hakim/juru sita", () => {
    const u = (roleId: string, positionId = "", additionalRoleIds: string[] = []) =>
      ({ roleId, positionId, additionalRoleIds }) as Parameters<typeof bolehIsiCourtCalendar>[0];
    for (const r of ["panitera", "panitera-pengganti", "panitera-muda", "admin", "super-admin"]) expect(bolehIsiCourtCalendar(u(r))).toBe(true);
    for (const r of ["hakim", "jurusita", "ketua", "ptsp"]) expect(bolehIsiCourtCalendar(u(r))).toBe(false);
    expect(bolehIsiCourtCalendar(u("staf", "", ["panitera-pengganti"]))).toBe(true);
    expect(bolehIsiCourtCalendar(null)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Rute portal: hak, akun, kering bawaan
// ----------------------------------------------------------------------------
const rute = vi.hoisted(() => ({
  aktor: { id: "usr_saya", name: "Derry", roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti" } as Record<string, unknown>,
  kapabilitas: [] as string[],
  kredensial: [] as Array<{ userId: string; username: string; aktif: boolean; keadaan: string }>,
  bot: [] as Array<{ jalur: string; pilihan: Record<string, unknown> }>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_saya" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async (_db: unknown, _id: unknown, kapabilitas: string) => {
    rute.kapabilitas.push(kapabilitas);
    return rute.aktor;
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { handleRouteError } = await import("@/server/shared/http");
  return { handleAdminRouteError: (galat: unknown) => handleRouteError(galat) };
});
vi.mock("@/server/modules/aleta-ecourt/checklist-milestone", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-ecourt/checklist-milestone")>();
  return { ...modul, bacaKredensialSipp: async () => rute.kredensial };
});
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({
  panggilBotJadwalSidang: async (jalur: string, pilihan: Record<string, unknown> = {}) => {
    rute.bot.push({ jalur, pilihan });
    return { ok: true, data: { ok: true, kering: (pilihan.body as { kering?: boolean })?.kering !== false, hasil: [], rencana: [] } };
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({ getGatewayStatusPerkara: async () => ({ ok: false, error: "x" }) }));

import { POST } from "@/app/api/aleta-ecourt/sidang/court-calendar/route";

function minta(badan: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/aleta-ecourt/sidang/court-calendar", {
    method: "POST",
    body: JSON.stringify(badan),
    headers: { "content-type": "application/json", "x-forwarded-for": "192.168.9.121" },
  });
}

describe("rute POST /api/aleta-ecourt/sidang/court-calendar", () => {
  beforeEach(() => {
    rute.aktor = { id: "usr_saya", name: "Derry", roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti" };
    rute.kapabilitas = [];
    rute.kredensial = [{ userId: "usr_saya", username: "derry", aktif: true, keadaan: "sah" }];
    rute.bot = [];
  });

  const badan = { perkaraId: "10049", tambah: [{ tanggal: "2026-10-13", jam: "09:00", agenda: "Pembuktian" }] };

  it("tanpa akun SIPP milik sendiri: ditolak, bot TIDAK dipanggil", async () => {
    rute.kredensial = [{ userId: "usr_lain", username: "fahri", aktif: true, keadaan: "sah" }];
    const j = await POST(minta({ ...badan, kering: false }));
    const isi = (await j.json()) as { data: Record<string, unknown> };
    expect(isi.data).toMatchObject({ ok: false, alasan: "akun_sipp_belum_tertaut" });
    expect(rute.bot).toEqual([]);
  });

  it("akun SIPP orang lain yang diketik tidak dipakai", async () => {
    rute.kredensial.push({ userId: "usr_lain", username: "fahri", aktif: true, keadaan: "sah" });
    const j = await POST(minta({ ...badan, akunSipp: "fahri", kering: false }));
    expect(((await j.json()) as { data: Record<string, unknown> }).data).toMatchObject({ ok: false, alasan: "akun_sipp_bukan_milik_anda" });
    expect(rute.bot).toEqual([]);
  });

  it("kering bila tidak disebut tegas; akun, operator, IP peramban diteruskan; kemampuan data-umum", async () => {
    await POST(minta({ ...badan }));
    await POST(minta({ ...badan, kering: "false" }));
    await POST(minta({ ...badan, kering: false }));
    expect(rute.bot.map((x) => (x.pilihan.body as { kering: boolean }).kering)).toEqual([true, true, false]);
    expect(rute.bot[0]).toMatchObject({
      jalur: "/court-calendar",
      pilihan: { method: "POST", body: { perkaraId: "10049", akunSipp: "derry", operator: "Derry", ip: "192.168.9.121" } },
    });
    expect(rute.kapabilitas).toEqual(["data-umum", "data-umum", "data-umum"]);
  });

  it("hakim ditolak 403 walau kemampuannya menyala", async () => {
    rute.aktor = { id: "usr_saya", name: "Hakim", roleId: "hakim", positionId: "pos-hakim" };
    const j = await POST(minta({ ...badan, kering: false }));
    expect(j.status).toBe(403);
    expect(rute.bot).toEqual([]);
  });
});

void ApiError;
