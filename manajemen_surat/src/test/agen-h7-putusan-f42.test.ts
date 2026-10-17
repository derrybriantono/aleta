// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  alasanH7,
  bandingkanDenganAkhir,
  golongkanIsian,
  jendelaH7,
  nilaiKesiapanH7,
  pilihBlangkoH7,
  ringkasOtomatis,
  samaIsi,
  susunRingkasan,
  tambahHari,
  teksLaporanH7,
  teksLencanaH7,
  tanggalIso,
  untukChecklistH7,
  usulanDariKtp,
  usulanPasti,
  type BarisSidangH7,
  type IsianDraf,
} from "@/lib/agen-h7-putusan";
import type { ButirIsian, Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_AGEN_H7 } from "@/server/db/schema";
import {
  agenH7JatuhTempo,
  bacaDrafH7,
  bacaDrafSaya,
  bacaRingkasDrafH7,
  detakAgenH7,
  jalankanAgenH7,
  jamAgenH7,
  susunDrafSatu,
  type SumberAgenH7,
} from "@/server/modules/aleta-ecourt/agen-h7-putusan";

/**
 * ============================================================================
 * AGEN H-7 DRAF PUTUSAN (F4.2, 17 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga:
 *   1. migrasi 0068 (idx 65): berkas = schema.ts, jurnal tanpa lubang, ikut
 *      cadangan mode ingatan;
 *   2. aturan: sidang mana yang disiapkan (H-7 dibuat, H-6..H-1 diperbarui),
 *      blangko Derry menurut keadaan (verstek diperkirakan dari kehadiran),
 *      golongan isian (terisi/pasti/usulan/manusia), isian HUKUM tidak pernah
 *      pasti, isian berkeadaan yang tidak berlaku disembunyikan, kesiapan,
 *      ringkasan berlabel sumber, pembanding ukur;
 *   3. jalan agen dengan sumber tiruan: draf tersimpan lalu diperbarui, TIDAK
 *      ada operasi tulis SIPP/ABT, penjadwal sekali sehari & saklar env;
 *   4. rute: membaca boleh panel, menjalankan hanya penyusun draf;
 *      konseptor-langkah GET membawa draf H-7;
 *   5. ekstensi: kartu checklist menampilkan draf dan tombolnya memanggil
 *      Blangko Derry pakaiDrafH7 - yang hanya memasang SARAN (tanpa simpan).
 */

const AKAR = process.cwd();
const EKSTENSI = path.resolve(AKAR, "..", "ekstensi-sipp");

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0068 - diklaim sekali, DDL berkas = schema.ts", () => {
  const SQL = path.join(AKAR, "drizzle", "0068_aleta_agen_h7_draf.sql");

  it("jurnal: 0068 di idx 65 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0068_"))).toEqual([expect.objectContaining({ idx: 65, tag: "0068_aleta_agen_h7_draf" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_AGEN_H7, berjalan di pg-mem, ikut cadangan mode ingatan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual(DDL_AGEN_H7.tabel.map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT perkara_id FROM aleta_agen_h7_draf")).toEqual([]);
    expect(kosong.public.many("SELECT id FROM aleta_agen_h7_jalan")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_agen_h7_draf");
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_agen_h7_jalan");
  });
});

// ─── 2. Aturan ───────────────────────────────────────────────────────────────

const BARIS: BarisSidangH7 = {
  perkaraId: "512",
  nomorPerkara: "512/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  tanggalSidang: "2026-10-24",
  agenda: "Musyawarah Majelis",
  urutanSidang: 4,
  sudahPutus: false,
  sidangIkrarTalak: false,
  majelisNama: "Hakim Ketua A",
  paniteraNama: "PP B",
  lewatEcourt: false,
  penandaPerkara: { ghaib: false, prodeo: false },
  panggilan: { hadirSebelumnya: 2, tergugatPernahHadir: false, penggugatPernahHadir: true },
  saksiNamaPihak1: ["Saksi Satu", "Saksi Dua"],
  saksiNamaPihak2: [],
};

describe("sidang yang disiapkan", () => {
  it("agenda musyawarah/putusan dan kesimpulan; ikrar talak dan yang sudah putus tidak", () => {
    expect(alasanH7(BARIS)).toBe("putusan");
    expect(alasanH7({ ...BARIS, agenda: "Pembacaan Putusan" })).toBe("putusan");
    expect(alasanH7({ ...BARIS, agenda: "Kesimpulan para pihak" })).toBe("kesimpulan");
    // Perkiraan verstek: sidang ke-2+, Tergugat belum pernah hadir, agenda lain.
    expect(alasanH7({ ...BARIS, agenda: "Panggil Tergugat" })).toBe("verstek");
    expect(alasanH7({ ...BARIS, agenda: "Panggil Tergugat" }, { verstek: false })).toBe("");
    expect(alasanH7({ ...BARIS, agenda: "Panggil Tergugat", urutanSidang: 1 })).toBe("");
    expect(alasanH7({ ...BARIS, agenda: "Pembuktian", panggilan: { tergugatPernahHadir: true } })).toBe("");
    expect(alasanH7({ ...BARIS, agenda: "Sidang Ikrar Talak" })).toBe("");
    expect(alasanH7({ ...BARIS, sidangIkrarTalak: true })).toBe("");
    expect(alasanH7({ ...BARIS, sudahPutus: true })).toBe("");
  });

  it("H-7 dibuat, H-6..H-0 diperbarui, selebihnya di luar jendela", () => {
    expect(tambahHari("2026-10-17", 7)).toBe("2026-10-24");
    expect(tambahHari("2026-12-28", 7)).toBe("2027-01-04");
    expect(jendelaH7("2026-10-17", "2026-10-24")).toBe("dibuat");
    expect(jendelaH7("2026-10-17", "2026-10-20")).toBe("diperbarui");
    expect(jendelaH7("2026-10-17", "2026-10-25")).toBe("");
    expect(jendelaH7("2026-10-17", "2026-10-16")).toBe("");
  });

  it("blangko: Tergugat tak pernah hadir -> Kabul Verstek; hadir -> kontradiktoir; selalu perkiraan", () => {
    const v = pilihBlangkoH7(BARIS, "putusan");
    expect(v.perkiraanVerstek).toBe(true);
    expect(v.utama).toMatchObject({ jenis: "putusan", folder: "derry_briantono/1 Perceraian CG", menu: "Putusan Cerai Gugat", perkiraan: true });
    expect(v.utama!.label).toMatch(/Verstek/);
    expect(v.alasan).toMatch(/diperkirakan verstek/);

    const k = pilihBlangkoH7({ ...BARIS, panggilan: { hadirSebelumnya: 1, tergugatPernahHadir: true } }, "kesimpulan");
    expect(k.perkiraanVerstek).toBe(false);
    expect(k.utama!.label).toBe("[02] [Kabul] CG - F");
    expect(k.alternatif.length).toBeGreaterThan(0);
  });
});

const isian = (kode: string, nama: string, lain: Partial<ButirIsian> = {}): ButirIsian => ({
  kode,
  nama,
  namaAsli: nama,
  jenis: "teks",
  pemicu: "",
  wajib: true,
  langsung: true,
  bawaan: "",
  pilihan: [],
  saran: "",
  dipakaiOleh: [],
  khusus: "",
  pihak: "",
  keadaan: "",
  tingkat: "penting",
  opsi: [],
  tj: null,
  ...lain,
});

describe("golongan isian", () => {
  const SUSUNAN = {
    isian: [
      isian("0222", "Awal perselisihan"),
      isian("0246", "Pisah rumah sejak"),
      isian("8503", "Alasan perceraian"),
      isian("1214", "Alat bukti surat Penggugat", { khusus: "bukti", pihak: "P" }),
      isian("0156", "Nama kantor advokat Penggugat", { keadaan: "kuasaP", pemicu: "11111" }),
      isian("8436", "Kesimpulan Penggugat", { tingkat: "tambahan" }),
      isian("9001", "Saksi 1 Penggugat", { jenis: "tj" }),
      isian("7777", "Penanda teknis", { wajib: false }),
    ],
  };

  it("terisi di ABT / pasti / usulan / manusia; hukum tidak pernah pasti; berkeadaan yang tak berlaku hilang", () => {
    const hasil = golongkanIsian({
      susunan: SUSUNAN,
      nilai: { "1214": { status: "terisi", teks: "P-1 Fotokopi KTP" }, "11111": { status: "kosong", teks: "" } },
      usulan: [
        { jalur: "saksi", usulan: { kode: "0222", nilai: "bulan Maret 2024", keyakinan: "pasti", tingkat: "pasti", sumber: [{ saksi: 1 }] } },
        { jalur: "saksi", usulan: { kode: "0246", nilai: "tahun 2025", keyakinan: "pasti", tingkat: "ragu", sumber: [{ saksi: 1 }] } },
        { jalur: "sipp", usulan: { kode: "8503", nilai: "F · terus-menerus berselisih", keyakinan: "pasti" } },
      ],
      perkara: { prodeo: false, ghaib: false, lewatEcourt: false },
    });
    const g = Object.fromEntries(hasil.map((i) => [i.kode, i]));
    expect(g["1214"]).toMatchObject({ golongan: "terisi", sumber: "ABT", langkah: "bukti" });
    expect(g["0222"]).toMatchObject({ golongan: "pasti", nilai: "bulan Maret 2024", sumber: "keterangan saksi di ABT" });
    expect(g["0246"]).toMatchObject({ golongan: "usulan" });
    expect(g["8503"]).toMatchObject({ golongan: "usulan", hukum: true });
    expect(g["8503"].catatan).toMatch(/majelis yang menentukan/);
    expect(g["8436"]).toMatchObject({ golongan: "manusia", penting: false });
    expect(g["9001"]).toMatchObject({ golongan: "manusia", langkah: "saksi" });
    // Kuasa P tidak menyala (11111 kosong) -> isian kantor advokat tidak berlaku; isian tidak wajib tidak dihitung.
    expect(g["0156"]).toBeUndefined();
    expect(g["7777"]).toBeUndefined();

    const k = nilaiKesiapanH7(hasil, { jumlah: 10, terisi: 9, kosong: [{ kode: "0011", nama: "Tanggal daftar", sebab: "kosong" }] }, true);
    expect(k).toMatchObject({ jumlah: 6, terisi: 1, pasti: 1, usulan: 2, manusia: 2, persen: 33, dataSippKosong: 1, tingkat: "belum" });
    expect(k.perlu.slice(0, 2)).toEqual(["Pisah rumah sejak", "Alasan perceraian"]);
    expect(k.perLangkah.bukti).toMatchObject({ jumlah: 1, terisi: 1 });
    expect(k.perLangkah.pertimbangan).toMatchObject({ jumlah: 1, terisi: 0 });
  });

  it("17 Okt: pemicu C/H membaca huruf 8503 seperti ABT (Murtad = H, 'F dan C' = CF, teks bebas tidak ditebak)", () => {
    const susunan = { isian: [isian("8503", "Alasan perceraian"), isian("8536", "Putusan pidana", { pemicu: "11116" }), isian("0227", "Tanggal murtad", { pemicu: "11117" })] };
    const kodeBerlaku = (huruf: string) =>
      golongkanIsian({ susunan, nilai: { "8503": { status: "terisi", teks: huruf } }, usulan: [], perkara: { prodeo: false, ghaib: false, lewatEcourt: false } })
        .map((i) => i.kode)
        .filter((k) => k !== "8503");
    expect(kodeBerlaku("Murtad")).toEqual(["0227"]); // pembaca lama: "MURTAD" -> "AD" -> H tidak terbaca
    expect(kodeBerlaku("fasakh")).toEqual(["0227"]);
    expect(kodeBerlaku("F dan C")).toEqual(["8536"]);
    expect(kodeBerlaku("C · dihukum penjara 5 tahun atau lebih")).toEqual(["8536"]);
    expect(kodeBerlaku("H · murtad (beralih agama)")).toEqual(["0227"]);
    expect(kodeBerlaku("F")).toEqual([]);
    expect(kodeBerlaku("kekejaman dan penganiayaan")).toEqual([]); // teks bebas bukan huruf
  });

  it("usulanPasti = cermin s5UsulanPasti; samaIsi mengabaikan spasi, huruf besar, petik, tag", () => {
    expect(usulanPasti({ nilai: "x", keyakinan: "pasti" })).toBe(true);
    expect(usulanPasti({ nilai: "x", keyakinan: "pasti", sumber: [{ asal: "posita" }] })).toBe(false);
    expect(usulanPasti({ nilai: "x", keyakinan: "pasti", sumber: [{ saksi: 2 }] })).toBe(false);
    expect(usulanPasti({ nilai: "x", keyakinan: "ragu", tingkat: "pasti" })).toBe(true);
    expect(usulanPasti({ nilai: "", keyakinan: "pasti" })).toBe(false);
    expect(samaIsi("Bulan  Maret 2024.", "bulan maret 2024")).toBe(true);
    expect(samaIsi("“Tergugat”<br>pergi", "'tergugat' pergi")).toBe(true);
    expect(samaIsi("2024", "2025")).toBe(false);
  });

  it("variabel otomatis kosong = data SIPP belum ada; kesiapan siap bila tak ada sisa", () => {
    const o = ringkasOtomatis(
      { otomatis: [{ kode: "0011", nama: "Tgl daftar", jenis: "data_sql", langsung: true }, { kode: "4001", nama: "Amar", jenis: "data_sql", langsung: false }] },
      { "0011": { status: "kosong", sebab: "jadwal sidang belum ada di SIPP" }, "4001": { status: "kosong" } }
    );
    expect(o).toMatchObject({ jumlah: 1, terisi: 0, kosong: [{ kode: "0011" }] });
    const siap = nilaiKesiapanH7([{ golongan: "terisi" } as IsianDraf], { jumlah: 1, terisi: 1, kosong: [] }, true);
    expect(siap.tingkat).toBe("siap");
    expect(nilaiKesiapanH7([], null, false).tingkat).toBe("belum");
  });

  it("pembanding ukur: hanya pasti/usulan yang punya isian akhir dihitung", () => {
    const h = bandingkanDenganAkhir(
      [
        { kode: "0222", golongan: "pasti", nilai: "bulan Maret 2024" } as IsianDraf,
        { kode: "0246", golongan: "usulan", nilai: "tahun 2025" } as IsianDraf,
        { kode: "1214", golongan: "terisi", nilai: "P-1" } as IsianDraf,
        { kode: "0007", golongan: "pasti", nilai: "dua orang anak" } as IsianDraf,
      ],
      { "0222": "Bulan Maret 2024", "0246": "bulan Januari 2025", "1214": "P-1" }
    );
    expect(h).toMatchObject({ dibandingkan: 2, sama: 1, pastiDibandingkan: 1, pastiSama: 1 });
    expect(h.beda).toEqual([{ kode: "0246", golongan: "usulan", draf: "tahun 2025", akhir: "bulan Januari 2025" }]);
    expect(tanggalIso("Senin, 3 Mei 2021")).toBe("2021-05-03");
    expect(bandingkanDenganAkhir([{ kode: "0364", golongan: "pasti", nilai: "03/05/2021" } as IsianDraf], { "0364": "3 Mei 2021" }).sama).toBe(1);
  });

  it("tanggal KTP e-Court: pasti -> pasti, cukup -> usulan, ragu dibuang; cermin kode pihak ekstensi", () => {
    const u = usulanDariKtp([
      { cabang: 1, urutan: 1, tanggalKtp: "03/05/2021", yakin: "pasti", cocok: "nik" },
      { cabang: 2, urutan: 1, tanggalKtp: "10/01/2019", yakin: "cukup" },
      { cabang: 1, urutan: 2, tanggalKtp: "11/11/2011", yakin: "ragu" },
    ]);
    expect(u.map((x) => [x.kode, x.keyakinan])).toEqual([
      ["0364", "pasti"],
      ["2222", "pasti"],
      ["0365", "cukup"],
    ]);
    expect(usulanPasti(u[0])).toBe(true);
    expect(usulanPasti(u[2])).toBe(false);
  });
});

describe("ringkasan dari data yang ada", () => {
  it("lima bagian berlabel sumber; verstek tanpa jawab-menjawab disebut", () => {
    const r = susunRingkasan({
      nilai: {
        "5125": { status: "terisi", teks: "Bahwa Penggugat dan Tergugat menikah pada 2015;<br>Bahwa sejak 2023 sering bertengkar;<br>Bahwa Tergugat pergi sejak Januari 2025;" },
        "1214": { status: "terisi", teks: "P-1 Fotokopi KTP<br>P-2 Fotokopi Kutipan Akta Nikah" },
        "2021": { status: "terisi", teks: "Saksi kenal Penggugat; keduanya sudah pisah rumah." },
      },
      riwayat: [
        { urutan: 1, tanggalSidang: "2026-09-10", agenda: "Panggil Tergugat", dihadiriOleh: 2 },
        { urutan: 3, tanggalSidang: "2026-10-01", agenda: "Pembuktian", dihadiriOleh: 2 },
      ],
      saksi: [{ pihak: "P", tanyaJawab: [{}, {}] }, { pihak: "P", tanyaJawab: [{}] }],
      dokumen: [],
      namaSaksi: { P: ["Saksi Satu", "Saksi Dua"], T: [] },
      sebutan: { P: "Penggugat", T: "Tergugat" },
    });
    expect(r.map((b) => b.kode)).toEqual(["duduk", "jawab", "bukti", "saksi", "kesimpulan"]);
    expect(r[0]).toMatchObject({ ada: true, sumber: "Posita gugatan/permohonan di SIPP" });
    expect(r[0].isi[0]).toBe("Posita memuat 3 butir.");
    expect(r[1].isi[0]).toBe("Sidang ke-3 1 Oktober 2026: Pembuktian (hanya pihak pertama hadir).");
    expect(r[2].isi[0]).toBe("Penggugat: 2 baris bukti.");
    expect(r[3].isi[0]).toBe("Saksi Penggugat: 2 diajukan (Saksi Satu, Saksi Dua), 2 sudah diperiksa.");
    expect(r[4].ada).toBe(false);

    const verstek = susunRingkasan({ nilai: {}, riwayat: [{ urutan: 1, tanggalSidang: "2026-09-10", agenda: "Panggil Tergugat", dihadiriOleh: 2 }], saksi: [], dokumen: [], namaSaksi: { P: [], T: [] }, sebutan: { P: "Penggugat", T: "Tergugat" } });
    expect(verstek[1].isi[0]).toMatch(/Tergugat belum pernah hadir/);
  });
});

// ─── 3. Jalan agen (sumber tiruan, pg-mem) ───────────────────────────────────

const KATALOG = new Map<string, Definisi>([
  ["0222", { kode: "0222", nama: "Awal Konflik", jenis: "data_teks", sql: "", bawaan: "" }],
  ["8503", { kode: "8503", nama: "Alasan Perceraian", jenis: "data_teks", sql: "", bawaan: "" }],
  ["1214", { kode: "1214", nama: "Alat-alat bukti #0046#", jenis: "data_teks", sql: "", bawaan: "" }],
  ["0011", { kode: "0011", nama: "Tanggal Daftar", jenis: "data_sql", sql: "select 1", bawaan: "" }],
]);

function sumberTiruan(panggilan: string[], tingkat = "pasti"): SumberAgenH7 {
  return {
    async jadwal(dari, sampai) {
      panggilan.push(`jadwal ${dari}..${sampai}`);
      return {
        ok: true,
        galat: "",
        sidang: [
          BARIS,
          { ...BARIS, perkaraId: "600", nomorPerkara: "600/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-20", agenda: "Kesimpulan" },
          { ...BARIS, perkaraId: "601", nomorPerkara: "601/Pdt.G/2026/PA.Dgl", agenda: "Pembuktian", panggilan: { tergugatPernahHadir: true } },
        ],
      };
    },
    async bacaBlangko(folder, berkas) {
      panggilan.push(`blangko.baca ${folder}/${berkas}`);
      return { ada: true, penanda: ["0222", "8503", "1214", "0011"], sebab: "" };
    },
    async katalog() {
      return KATALOG;
    },
    async nilaiPenanda(perkaraId, kode) {
      panggilan.push(`abt.nilaiPenanda ${perkaraId} ${kode.length}`);
      return {
        ada: true,
        sebab: "",
        nilai: {
          "0011": { status: "terisi", teks: "1 September 2026" },
          "2021": { status: "terisi", teks: "Saksi melihat pertengkaran sejak Maret 2024." },
          "5125": { status: "terisi", teks: "Bahwa Penggugat menikah;<br>Bahwa sering bertengkar;" },
        },
      };
    },
    async usulan(_db, muatan) {
      panggilan.push(`usulan ${muatan.sumber}`);
      if (muatan.sumber === "saksi") {
        // Lama pisah dihitung sampai Hari Putusan perkara itu (dd/mm/yyyy - bentuk yang dibaca bot).
        expect(muatan.tanggalSidang).toBe(muatan.nomorPerkara.startsWith("600/") ? "20/10/2026" : "24/10/2026");
        expect(muatan.saksi1).toContain("Maret 2024");
        return { ok: true, galat: "", jalur: [{ jalur: "saksi", usulan: [{ kode: "0222", nilai: "bulan Maret 2024", keyakinan: "pasti", tingkat }] }] };
      }
      return { ok: true, galat: "", jalur: [{ jalur: "sipp", usulan: [{ kode: "8503", nilai: "F · berselisih", keyakinan: "pasti" }] }] };
    },
    async riwayat(perkaraId) {
      panggilan.push(`case.schedule ${perkaraId}`);
      return [{ urutan: 3, tanggalSidang: "2026-10-10", agenda: "Pembuktian", dihadiriOleh: 2 }];
    },
    async saksi(perkaraId) {
      panggilan.push(`case.pemeriksaanSaksi ${perkaraId}`);
      return [{ pihak: "P", tanyaJawab: [{}] }];
    },
    async dokumen(perkaraId) {
      panggilan.push(`ecourt.dokumenPerkara ${perkaraId}`);
      return [];
    },
    async ktp(nomor) {
      panggilan.push(`ktp-pihak ${nomor}`);
      return [{ cabang: 1, urutan: 1, tanggalKtp: "03/05/2021", yakin: "pasti", cocok: "nik" }];
    },
  };
}

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", async (asli) => {
  const modul = await asli<typeof import("@/server/shared/auth")>();
  return { ...modul, resolveActorUserId: async () => aktor };
});

describe("jalan agen (sumber tiruan, pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("satu perkara: blangko, golongan, ringkasan, laporan; hanya operasi BACA", async () => {
    const panggilan: string[] = [];
    const d = (await susunDrafSatu(db!, BARIS, sumberTiruan(panggilan)))!;
    expect(d.blangko.utama!.label).toMatch(/Verstek/);
    expect(d.isian.map((i) => [i.kode, i.golongan])).toEqual([
      ["8503", "usulan"],
      ["0222", "pasti"],
      ["1214", "manusia"],
    ]);
    expect(d.otomatis).toMatchObject({ jumlah: 1, terisi: 1 });
    expect(d.kesiapan).toMatchObject({ tingkat: "hampir", pasti: 1, usulan: 1, manusia: 1 });
    expect(d.ringkasan.find((b) => b.kode === "saksi")!.isi[0]).toContain("1 sudah diperiksa");
    const laporan = teksLaporanH7(d);
    expect(laporan[0]).toBe("Hari Putusan 24 Oktober 2026 (Musyawarah Majelis).");
    expect(laporan.at(-1)).toMatch(/belum disimpan ke ABT maupun SIPP/);
    // Hanya bacaan: tidak ada blangko.isi, edit_data, simpan, unggah.
    expect(panggilan.join("\n")).not.toMatch(/blangko\.isi|edit_data|simpan|unggah|rapikan/);
    // Untuk checklist: saran pasti & usulan (hukum tetap usulan), blangko yang dibuka.
    const c = untukChecklistH7(d);
    expect(c.saran["0222"]).toEqual({ nilai: "bulan Maret 2024", golongan: "pasti", sumber: "keterangan saksi di ABT" });
    expect(c.saran["8503"].golongan).toBe("usulan");
    expect(c.blangko).toMatchObject({ menu: "Putusan Cerai Gugat", folder: "derry_briantono/1 Perceraian CG" });
  });

  it("jalan: H-7 dibuat, yang lebih dekat diperbarui, bukan Hari Putusan dilewati; jalan kedua memperbarui", async () => {
    const panggilan: string[] = [];
    const h = await jalankanAgenH7(db!, { pemicu: "tangan", oleh: "Hakim A", hariIni: "2026-10-17", sumber: sumberTiruan(panggilan) });
    expect(panggilan[0]).toBe("jadwal 2026-10-18..2026-10-24");
    expect(h).toMatchObject({ diperiksa: 2, dibuat: 2, diperbarui: 0, gagal: 0, galat: "" });
    expect(h.perkara.map((p) => p.perkaraId)).toEqual(["512", "600"]);
    const r = await bacaRingkasDrafH7(db!, ["512", "600", "601"]);
    expect(Object.keys(r).sort()).toEqual(["512", "600"]);
    expect(r["512"]).toMatchObject({ tanggalSidang: "2026-10-24", tingkat: "hampir" });
    // 1 usulan (alasan perceraian - hukum) + 1 manusia (bukti); 0222 disiapkan agen.
    expect(teksLencanaH7(r["512"])).toBe("Draf H-7 33% - 2 perlu diisi");

    const kedua = await jalankanAgenH7(db!, { pemicu: "tangan", hariIni: "2026-10-17", sumber: sumberTiruan([], "ragu") });
    expect(kedua).toMatchObject({ dibuat: 0, diperbarui: 2 });
    const d = (await bacaDrafH7(db!, ["512"]))["512"];
    expect(d.isian.find((i) => i.kode === "0222")!.golongan).toBe("usulan");
  });

  it("widget: draf milik akun (majelis/PP/konseptor) dalam tujuh hari; orang lain tidak; admin semua", async () => {
    await jalankanAgenH7(db!, { pemicu: "tangan", hariIni: "2026-10-17", sumber: sumberTiruan([]) });
    const hakim = await bacaDrafSaya(db!, { nama: "Hakim Ketua A", lihatSemua: false, hariIni: "2026-10-17" });
    expect(hakim.perkara.map((p) => [p.nomorPerkara, p.sisaHari, p.sebagai.join()])).toEqual([
      ["600/Pdt.G/2026/PA.Dgl", 3, "hakim"],
      ["512/Pdt.G/2026/PA.Dgl", 7, "hakim"],
    ]);
    expect(hakim.perkara[1]).toMatchObject({ lencana: "Draf H-7 33% - 2 perlu diisi", tingkat: "hampir" });
    expect(hakim.perkara[1].checklist.saran["0222"].golongan).toBe("pasti");
    expect((await bacaDrafSaya(db!, { nama: "Orang Lain", lihatSemua: false, hariIni: "2026-10-17" })).jumlah).toBe(0);
    expect((await bacaDrafSaya(db!, { nama: "Admin", lihatSemua: true, hariIni: "2026-10-17" })).jumlah).toBe(2);
    // Hari Putusan sudah lewat tidak tampil lagi.
    expect((await bacaDrafSaya(db!, { nama: "Admin", lihatSemua: true, hariIni: "2026-10-25" })).jumlah).toBe(0);
  });

  it("penjadwal: saklar env, jam bawaan 06.00 WITA, sekali sehari", async () => {
    expect(jamAgenH7({})).toBe("06:00");
    expect(jamAgenH7({ ALETA_AGEN_H7_JAM: "05:30" })).toBe("05:30");
    expect(jamAgenH7({ ALETA_AGEN_H7_JAM: "25:00" })).toBe("06:00");
    // 05.59 WITA = 21.59 UTC hari sebelumnya.
    expect(agenH7JatuhTempo("06:00", new Date("2026-10-16T21:59:00Z"), false)).toBe(false);
    expect(agenH7JatuhTempo("06:00", new Date("2026-10-16T22:01:00Z"), false)).toBe(true);
    expect(agenH7JatuhTempo("06:00", new Date("2026-10-16T22:01:00Z"), true)).toBe(false);
    expect(await detakAgenH7(db!, { ALETA_AGEN_H7: "0" })).toBeNull();
    // Sudah ada jalan terjadwal hari ini -> tidak jalan lagi.
    await db!.run(`INSERT INTO aleta_agen_h7_jalan (id, tanggal, pemicu, oleh, mulai) VALUES ('x', '2026-10-17', 'jadwal', 'Agen ALETA', '2026-10-16T22:00:00Z')`);
    expect(await detakAgenH7(db!, {}, new Date("2026-10-17T01:00:00Z"))).toBeNull();
  });

  // ─── 4. Rute ───────────────────────────────────────────────────────────────

  type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown> } };
  async function rute(alamat: string, cara: "GET" | "POST", badan?: unknown): Promise<Hasil> {
    const modul = (alamat.startsWith("/api/aleta-ecourt/konseptor-langkah")
      ? await import("@/app/api/aleta-ecourt/konseptor-langkah/route")
      : await import("@/app/api/aleta-ecourt/agen-h7/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
    const req = new NextRequest(`http://localhost${alamat}`, {
      method: cara,
      headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
      body: badan !== undefined ? JSON.stringify(badan) : undefined,
    });
    const j = await modul[cara](req);
    return { status: j.status, isi: (await j.json()) as Hasil["isi"] };
  }

  it("rute: ringkas boleh panel, draf utuh hanya blangko-abt; menjalankan ditolak juru sita; checklist membawa draf", async () => {
    await jalankanAgenH7(db!, { pemicu: "tangan", hariIni: "2026-10-17", sumber: sumberTiruan([]) });
    aktor = "usr-jurusita";
    const ringkas = await rute("/api/aleta-ecourt/agen-h7?ringkas=1&perkaraId=512,601", "GET");
    expect(ringkas.status).toBe(200);
    expect(Object.keys(ringkas.isi.data.peta as object)).toEqual(["512"]);
    // Audit 17 Okt: draf UTUH hanya pemegang Panel blangko ABT - juru sita tidak (403), hakim boleh.
    expect((await rute("/api/aleta-ecourt/agen-h7?perkaraId=512", "GET")).status).toBe(403);
    aktor = "usr-hakim";
    const lengkap = await rute("/api/aleta-ecourt/agen-h7?perkaraId=512", "GET");
    aktor = "usr-jurusita";
    const d = (lengkap.isi.data.peta as Record<string, { laporan: string[]; isian: unknown[] }>)["512"];
    expect(d.laporan[0]).toMatch(/^Hari Putusan 24 Oktober 2026/);
    expect((await rute("/api/aleta-ecourt/agen-h7", "POST", {})).status).toBe(403);
    const jalan = await rute("/api/aleta-ecourt/agen-h7?jalan=1", "GET");
    expect((jalan.isi.data.jalan as unknown[]).length).toBe(1);

    // Audit 17 Okt: draf UTUH hanya pemegang perkara ("blangko-abt"); lencana tetap untuk semua ber-"panel".
    aktor = "usr-analiskeu";
    expect((await rute("/api/aleta-ecourt/agen-h7?ringkas=1&perkaraId=512", "GET")).status).toBe(200);
    const tolak = await rute("/api/aleta-ecourt/agen-h7?perkaraId=512", "GET");
    expect(tolak.status).toBe(403);
    expect(JSON.stringify(tolak.isi)).not.toContain("Hari Putusan 24 Oktober");

    aktor = "usr-hakim";
    const k = await rute("/api/aleta-ecourt/konseptor-langkah?perkaraId=512", "GET");
    const h7 = (k.isi.data.drafH7 as Record<string, { ringkas: { tingkat: string }; saran: Record<string, unknown> }>)["512"];
    expect(h7.ringkas.tingkat).toBe("hampir");
    expect(Object.keys(h7.saran).sort()).toEqual(["0222", "8503"]);
  });
});

// ─── 5. Ekstensi & penjaga baca-saja ─────────────────────────────────────────

describe("ekstensi: draf H-7 di kartu checklist konseptor", () => {
  const SUMBER = readFileSync(path.join(EKSTENSI, "konseptor-langkah.js"), "utf8");
  let alat: Map<string, () => void>;
  let dipakai: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="aleta-bd-akar"></div>`;
    alat = new Map();
    dipakai = [];
    const g = globalThis as Record<string, unknown>;
    delete g.aletaKonseptorLangkah;
    g.aletaBlangkoDerry = {
      daftarkanAlat: (id: string, fn: () => void) => alat.set(id, fn),
      perkaraTerpilih: () => ({ perkara: { perkaraId: "512", nomorPerkara: "512/Pdt.G/2026/PA.Dgl" } }),
    };
    g.aletaBlangkoDerryIsian = { pakaiDrafH7: async (d: unknown) => dipakai.push(d) };
    const H7 = {
      ringkas: { tanggalSidang: "2026-10-24", blangko: "[01] [Kabul Verstek] Cerai (Format Lengkap)", tingkat: "hampir", persen: 67, perlu: ["Alasan perceraian"], jumlahPerlu: 2, dibuatPada: "2026-10-16T22:00:00.000Z" },
      blangko: { folder: "derry_briantono/1 Perceraian CG", berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", menu: "Putusan Cerai Gugat", alias: [], label: "x" },
      saran: { "0222": { nilai: "bulan Maret 2024", golongan: "pasti", sumber: "keterangan saksi di ABT" } },
      perlu: [],
      laporan: ["Hari Putusan 24 Oktober 2026 (Musyawarah Majelis).", "Blangko yang disiapkan: [01]"],
    };
    g.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { ada: true, peta: {}, drafH7: { "512": H7 } } }), { status: 200 }));
    new Function(SUMBER)();
  });
  afterEach(() => {
    vi.useRealTimers();
    const g = globalThis as Record<string, unknown>;
    delete g.aletaBlangkoDerry;
    delete g.aletaBlangkoDerryIsian;
    delete g.aletaKonseptorLangkah;
  });

  it("kartu menampilkan lencana & laporan; tombol memanggil pakaiDrafH7 dengan saran agen", async () => {
    alat.get("konseptor")!();
    await vi.advanceTimersByTimeAsync(0);
    const kartu = document.getElementById("bd-konseptor")!;
    const blok = kartu.querySelector("[data-kl-h7]")!;
    expect(blok.textContent).toContain("Draf H-7 67% - 2 perlu diisi");
    expect(blok.textContent).toContain("belum disimpan ke ABT maupun SIPP");
    expect(blok.textContent).toContain("Hari Putusan 24 Oktober 2026");
    (kartu.querySelector("[data-kl-pakai-h7]") as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(dipakai).toHaveLength(1);
    expect((dipakai[0] as { saran: Record<string, unknown> }).saran["0222"]).toMatchObject({ golongan: "pasti" });
  });
});

describe("penjaga: agen hanya membaca SIPP/ABT, tanpa AI luar", () => {
  it("modul server tidak memanggil operasi tulis maupun penyedia AI", () => {
    const modul = readFileSync(path.join(AKAR, "src/server/modules/aleta-ecourt/agen-h7-putusan.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(modul).not.toMatch(/"blangko\.isi"|edit_data|PositaRapikan|PositaSambung|unggah|lapisan-ai|anthropic|openai|ollama/i);
    for (const op of modul.match(/"(?:case|abt|blangko|ecourt)\.[A-Za-z]+"/g) ?? []) {
      expect(["\"abt.semuaVariabel\"", "\"blangko.baca\"", "\"abt.nilaiPenanda\"", "\"case.schedule\"", "\"case.pemeriksaanSaksi\"", "\"ecourt.dokumenPerkara\""]).toContain(op);
    }
  });

  it("Blangko Derry pakaiDrafH7 hanya memasang saran (tanpa simpan ke ABT); usulan belum pasti tidak ikut 'pakai semua saran'", () => {
    const isi = readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8");
    const fungsi = isi.slice(isi.indexOf("async function pakaiDrafH7("), isi.indexOf("function saatKlik(e)"));
    expect(fungsi).toContain("S.saranH7[kode]");
    expect(fungsi).not.toMatch(/jadwalkanSimpan|simpanVariabel|edit_data/);
    expect(isi).toContain("pakaiDrafH7,");
    const pakaiSemua = isi.slice(isi.indexOf("function pakaiSemuaSaran()"), isi.indexOf("async function pakaiDrafH7("));
    expect(pakaiSemua).toContain('S.saranH7[b.kode].golongan !== "pasti"');
  });
});
