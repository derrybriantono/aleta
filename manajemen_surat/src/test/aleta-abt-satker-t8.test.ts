// @vitest-environment node
/**
 * ============================================================================
 * PAKET PASANG ALETA ABT UNTUK SATKER LAIN (5 Nov 2026, Tahap 8) - DATA REKAAN
 * ============================================================================
 *   1. isian satker dinetralkan: cabang kode satker pembuat paket dibuang (cabang kosong dan ELSE tidak disentuh), kode surat diganti
 *      kode netral, hasilnya idempotent; isian lain yang khas daerah hanya didaftar, tidak diubah;
 *   2. identitas satker dibaca dari SIPP setempat (sys_config) dan diperiksa dengan kalimat sehari-hari;
 *   3. manifest: sidik hanya bergantung pada isi; paket rusak, jalur berbahaya, berkas dobel, atau cabang satker yang tertinggal ditolak;
 *   4. pemasangan lewat sinkron yang sudah ada (pg-mem, SQL migrasi sungguhan): tanpa ABT; pasang ulang tidak menulis; paket rusak tidak
 *      dipasang setengah; ubahan dan blangko satker tidak ditimpa dan tidak ditandai hilang; nomor isian ABT setempat tidak bentrok;
 *   5. naskah jadi tanpa penanda tersisa dan tanpa kata khas satker pembuat paket.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";

import {
  FORMAT_PAKET,
  KODE_SURAT_KOSONG,
  SERVER_INDUK,
  bocoranIdentitas,
  identitasDariSysConfig,
  netralkanVariabelInduk,
  penandaTersisa,
  perluDisesuaikan,
  periksaIdentitasSipp,
  periksaManifest,
  sidikPaket,
  type ManifestPaket,
} from "@/lib/aleta-abt-satker";
import { bentukSatker, gantiCabangSatker, isiCabangSatker, kodeSuratDari } from "@/lib/identitas-satker";
import { bacaPaket, jalurDiPaket, muatPustakaInduk, pasangPaketInduk, periksaIsiPaket } from "@/server/modules/aleta-abt-satker/paket";
import { muatPustakaMesin } from "@/server/modules/aleta-abt-pustaka/service";

const M = process.cwd();
const SQL = ["0133_aleta_abt_pustaka", "0135_aleta_abt_penyunting", "0136_aleta_abt_banding"].map((n) => readFileSync(path.join(M, `drizzle/${n}.sql`), "utf8"));

const md5 = (b: Buffer | string) => createHash("md5").update(typeof b === "string" ? Buffer.from(b, "latin1") : b).digest("hex");

const SQL_ALAMAT = "SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1) WHEN 'PA.Dgl' THEN 'Jalan Contoh Nomor 1' ELSE (SELECT TRIM(value) FROM sys_config WHERE name = 'AlamatPN' LIMIT 1) END AS data";
const SQL_HUKUM = "SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1) WHEN '' THEN 'RBg' ELSE IF(LOWER('#9276#') LIKE '%jawa%', 'HIR', 'RBg') END AS data";

describe("menetralkan isian satker", () => {
  it("cabang kode satker dibuang; ELSE tetap; satker lain jatuh ke data SIPP", () => {
    const { variabel, perubahan } = netralkanVariabelInduk({ no: "9271", sql_query: SQL_ALAMAT, default_data: null });
    expect(variabel.sql_query).not.toContain("PA.Dgl");
    expect(variabel.sql_query).not.toContain("Jalan Contoh");
    expect(variabel.sql_query).toContain("name = 'AlamatPN'");
    expect(bentukSatker(variabel.sql_query!)).toBe(true);
    expect(isiCabangSatker(variabel.sql_query!, "PA.Dgl").ada).toBe(false);
    expect(perubahan).toEqual([{ noVar: "9271", jenis: "cabang-satker", keterangan: expect.stringContaining("PA.Dgl") }]);
  });

  it("CASE tidak pernah dibiarkan tanpa WHEN (tidak sah di MariaDB): tersisa satu cabang penjaga untuk KodePN kosong; cabang satker pemasang masih dapat disisipkan", () => {
    const { variabel } = netralkanVariabelInduk({ no: "9271", sql_query: SQL_ALAMAT, default_data: null });
    expect(variabel.sql_query).toMatch(/CASE\s*\(SELECT TRIM\(value\) FROM sys_config WHERE name = 'KodePN' LIMIT 1\)\s+WHEN '' THEN ''\s+ELSE/);
    const sesudahTerapkan = gantiCabangSatker(variabel.sql_query!, "PA.Xyz", "Jalan Pemasang 5");
    expect(sesudahTerapkan).toContain("WHEN 'PA.Xyz' THEN 'Jalan Pemasang 5'");
    expect(sesudahTerapkan).toContain("WHEN '' THEN ''");
    expect(isiCabangSatker(sesudahTerapkan, "PA.Xyz")).toEqual({ ada: true, nilai: "Jalan Pemasang 5" });
    // cabang yang sudah ada selain milik pembuat paket tidak diganti penjaga
    const hukum = netralkanVariabelInduk({ no: "11850", sql_query: SQL_HUKUM, default_data: null });
    expect(hukum.variabel.sql_query).toBe(SQL_HUKUM);
  });

  it("beberapa cabang kode: semuanya dibuang; cabang kosong (WHEN '') tidak disentuh", () => {
    const dua = SQL_ALAMAT.replace("WHEN 'PA.Dgl'", "WHEN 'PA.Aaa' THEN 'x' WHEN 'PA.Dgl'");
    const n = netralkanVariabelInduk({ no: "9271", sql_query: dua, default_data: null });
    expect(n.variabel.sql_query).not.toMatch(/PA\.(Aaa|Dgl)/);
    expect(n.perubahan).toHaveLength(2);
    const hukum = netralkanVariabelInduk({ no: "11850", sql_query: SQL_HUKUM, default_data: null });
    expect(hukum.variabel.sql_query).toBe(SQL_HUKUM);
    expect(hukum.perubahan).toEqual([]);
  });

  it("kode surat #1154# diganti kode netral dan tetap sah bagi Identitas satker; tidak ada perubahan bila sudah netral", () => {
    const n = netralkanVariabelInduk({ no: "1154", sql_query: "", default_data: "W20-A11//Hk.05/ /#0191#" });
    expect(n.variabel.default_data).toBe(`${KODE_SURAT_KOSONG}//Hk.05/ /#0191#`);
    expect(kodeSuratDari(n.variabel.default_data!)).toBe(KODE_SURAT_KOSONG);
    expect(n.perubahan).toEqual([{ noVar: "1154", jenis: "kode-surat", keterangan: expect.stringContaining("W20-A11") }]);
    expect(netralkanVariabelInduk({ no: "1154", sql_query: "", default_data: n.variabel.default_data }).perubahan).toEqual([]);
    expect(netralkanVariabelInduk({ no: "1154", sql_query: "", default_data: "tanpa kode surat" }).perubahan).toEqual([]);
  });

  it("idempotent dan tidak menyentuh isian yang bukan isian satker", () => {
    const sekali = netralkanVariabelInduk({ no: "9271", sql_query: SQL_ALAMAT, default_data: null }).variabel;
    expect(netralkanVariabelInduk({ ...sekali }).perubahan).toEqual([]);
    const biasa = { no: "0046", sql_query: "SELECT x AS data WHEN 'PA.Dgl' THEN 'a'", default_data: "W20-A11/x" };
    const n = netralkanVariabelInduk(biasa);
    expect(n.variabel).toEqual(biasa);
    expect(n.perubahan).toEqual([]);
  });

  it("provinsi satker (#9276#) dihitung dari 1000 pihak perkara terbaru supaya selesai dalam batas waktu kueri; isian lain tidak disentuh", () => {
    const sql9276 =
      "SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1) WHEN 'PA.Dgl' THEN 'Sulawesi Tengah' ELSE (SELECT COALESCE(r.provinsi_nama, x.propinsi) FROM (SELECT TRIM(b.propinsi) AS propinsi, COUNT(*) AS n FROM perkara_pihak1 p JOIN pihak b ON b.id = p.pihak_id WHERE IFNULL(TRIM(b.propinsi), '') <> '' GROUP BY TRIM(b.propinsi) ORDER BY n DESC LIMIT 1) x LEFT JOIN ref_provinsi_new r ON r.provinsi_kode = x.propinsi) END AS data";
    const n = netralkanVariabelInduk({ no: "9276", sql_query: sql9276, default_data: null });
    expect(n.variabel.sql_query).toContain("FROM (SELECT pihak_id FROM perkara_pihak1 ORDER BY perkara_id DESC LIMIT 1000) p JOIN pihak b ON b.id = p.pihak_id");
    expect(n.variabel.sql_query).not.toContain("PA.Dgl");
    expect(n.variabel.sql_query).toContain("WHEN '' THEN ''");
    expect(n.perubahan.map((x) => x.jenis).sort()).toEqual(["cabang-satker", "provinsi-cepat"]);
    // idempotent, dan isian lain yang memuat potongan serupa tidak diubah
    expect(netralkanVariabelInduk({ ...n.variabel }).perubahan).toEqual([]);
    expect(netralkanVariabelInduk({ no: "1234", sql_query: sql9276.replace("CASE", "CASE"), default_data: null }).variabel.sql_query).toContain("FROM perkara_pihak1 p JOIN pihak b ON b.id = p.pihak_id");
  });

  it("isian khas daerah hanya didaftar, tidak diubah", () => {
    const daftar = [
      { no: "670", sql_query: null, default_data: "siaran RRI Pro 1 Palu 90,8 FM" },
      { no: "46", sql_query: "SELECT 1 AS data", default_data: null },
      { no: "2224", sql_query: 'locate("Donggala", "#0101#")', default_data: null },
    ];
    expect(perluDisesuaikan(daftar)).toEqual(["0670", "2224"]);
  });
});

describe("naskah jadi", () => {
  it("penanda tersisa terdeteksi (nomor ABT dan kode ALETA ABT); naskah baik tidak punya", () => {
    expect(penandaTersisa("{\\rtf1 Putusan Nomor 12/Pdt.G/2026 #0046# dan #AA100012#}")).toEqual(["0046", "AA100012"]);
    expect(penandaTersisa("{\\rtf1 Pagar # 12 # dan #12#}")).toEqual([]);
    expect(penandaTersisa("{\\rtf1 Putusan}")).toEqual([]);
  });
  it("bocoran identitas satker pembuat paket terdeteksi tanpa membedakan huruf", () => {
    expect(bocoranIdentitas("PENGADILAN AGAMA DONGGALA\\par Jalan Vatu Bala", ["donggala", "vatu bala", "pa-donggala"])).toEqual(["donggala", "vatu bala"]);
    expect(bocoranIdentitas("PENGADILAN AGAMA CONTOH", ["donggala", ""])).toEqual([]);
  });
});

describe("identitas dari SIPP setempat", () => {
  const BARIS = [
    { name: "KodePN", value: "PA.Xyz" },
    { name: "NamaPN", value: "PENGADILAN AGAMA CONTOH" },
    { name: "NamaPT", value: "PENGADILAN TINGGI AGAMA CONTOH" },
    { name: "AlamatPN", value: " JL. CONTOH NO. 1 " },
    { name: "ZonaWaktu", value: "wib" },
    { name: "KetuaPNNama", value: "tidak dibaca" },
  ];
  it("dibaca dari sys_config; hanya kunci identitas yang dipakai", () => {
    expect(identitasDariSysConfig(BARIS)).toEqual({ kodePN: "PA.Xyz", namaPN: "PENGADILAN AGAMA CONTOH", namaPT: "PENGADILAN TINGGI AGAMA CONTOH", alamatPN: "JL. CONTOH NO. 1", zonaWaktu: "WIB" });
    expect(identitasDariSysConfig([])).toEqual({ kodePN: "", namaPN: "", namaPT: "", alamatPN: "", zonaWaktu: "" });
  });
  it("temuan: semua baik bila identitas lengkap dan kode surat diisi; kode surat netral atau kosong diberi tahu", () => {
    const s = identitasDariSysConfig(BARIS);
    expect(periksaIdentitasSipp(s, "W21-A02").every((t) => t.ok)).toBe(true);
    for (const kode of ["", KODE_SURAT_KOSONG, "salah"]) {
      const t = periksaIdentitasSipp(s, kode).filter((x) => !x.ok);
      expect(t.map((x) => x.kunci)).toEqual(["kodeSurat"]);
      expect(t[0].keterangan).toContain("Identitas satker");
    }
    const kurang = periksaIdentitasSipp(identitasDariSysConfig([{ name: "KodePN", value: "x" }]), "W21-A02");
    expect(kurang.filter((x) => !x.ok).map((x) => x.kunci)).toEqual(["kodePN", "namaPN", "namaPT", "alamatPN", "zonaWaktu"]);
  });
});

// ─── paket di disk ──────────────────────────────────────────────────────────────────────────────────────────────

const dirSementara: string[] = [];
afterEach(() => {
  for (const d of dirSementara.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const RTF_CG = "{\\rtf1 PUTUSAN #8008#\\par Nomor #0046# lawan #0047#\\par}";
const RTF_ITSBAT = "{\\rtf1 PENETAPAN #8008#\\par #9271#\\par}";

function variabelPaket(no: string, lain: Record<string, unknown> = {}) {
  return { no, nama: `Isian ${no}`, data_type: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: `SELECT 'nilai ${no}' AS data`, default_data: null, multi_sidang: null, locked: 0, modifier: "", modified: "", sumber: "blangko", jumlahBlangko: 1, rujukan: [], ...lain };
}

const FUNGSI_UJI = "DROP FUNCTION IF EXISTS `isian_rtf_spasi`$$\nCREATE FUNCTION `isian_rtf_spasi`(x TEXT) RETURNS text RETURN TRIM(x)$$\n";

function susunPaketUji(lain: { rtfCg?: string; variabel?: Array<Record<string, unknown>>; denganFungsi?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paket-t8-"));
  dirSementara.push(dir);
  const berkas = [
    { jalur: "1 Perceraian CG/[01] Kabul.rtf", isi: lain.rtfCg ?? RTF_CG, penanda: ["8008", "0046", "0047"] },
    { jalur: "2 Itsbat Nikah/[01] Kabul.rtf", isi: RTF_ITSBAT, penanda: ["8008", "9271"] },
  ];
  for (const b of berkas) {
    const tujuan = path.join(dir, "blangko", ...b.jalur.split("/"));
    fs.mkdirSync(path.dirname(tujuan), { recursive: true });
    fs.writeFileSync(tujuan, Buffer.from(b.isi, "latin1"));
  }
  const variabel = lain.variabel ?? [variabelPaket("0046"), variabelPaket("0047"), variabelPaket("8008"), variabelPaket("9271", { sql_query: netralkanVariabelInduk({ no: "9271", sql_query: SQL_ALAMAT, default_data: null }).variabel.sql_query })];
  const fungsi = lain.denganFungsi ? [{ nama: "isian_rtf_spasi", md5: md5(FUNGSI_UJI), ukuran: Buffer.byteLength(FUNGSI_UJI, "latin1") }] : undefined;
  if (fungsi) {
    fs.mkdirSync(path.join(dir, "fungsi"), { recursive: true });
    fs.writeFileSync(path.join(dir, "fungsi", "isian_rtf_spasi.sql"), Buffer.from(FUNGSI_UJI, "latin1"));
  }
  const manifest: ManifestPaket = {
    format: FORMAT_PAKET,
    dibuat: "2026-11-05T10:00:00.000Z",
    server: SERVER_INDUK,
    ...(fungsi ? { fungsi } : {}),
    berkas: berkas.map((b) => {
      const bagian = b.jalur.split("/");
      return { jalur: b.jalur, folder: bagian[0], nama: bagian[1], arsip: false, md5: md5(b.isi), ukuran: Buffer.byteLength(b.isi, "latin1"), waktu: "2026-11-02T10:00:00.000Z", penanda: b.penanda };
    }),
    variabel,
    takDikenal: [],
    perubahan: [],
    perluDisesuaikan: [],
    sidik: "",
  };
  manifest.sidik = sidikPaket(manifest.berkas, manifest.variabel, manifest.fungsi);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  return { dir, manifest };
}

describe("manifest", () => {
  it("sidik hanya bergantung pada isi, bukan urutan", () => {
    const { manifest } = susunPaketUji();
    const terbalik = sidikPaket([...manifest.berkas].reverse(), [...manifest.variabel].reverse());
    expect(terbalik).toBe(manifest.sidik);
    expect(sidikPaket(manifest.berkas, [...manifest.variabel, variabelPaket("0999")])).not.toBe(manifest.sidik);
  });

  it("paket baik tidak punya temuan; yang rusak ditolak dengan sebab", () => {
    const { manifest } = susunPaketUji();
    expect(periksaManifest(manifest)).toEqual([]);
    expect(periksaManifest(null)).toEqual(["Manifest paket tidak terbaca."]);
    expect(periksaManifest({ ...manifest, format: 9 })[0]).toContain("Format paket 9");
    expect(periksaManifest({ ...manifest, server: "PA.Dgl" })[0]).toContain("bukan paket induk");
    expect(periksaManifest({ ...manifest, berkas: [] })[0]).toContain("tidak berisi blangko");
    expect(periksaManifest({ ...manifest, variabel: [] })[0]).toContain("tidak berisi definisi isian");
    expect(periksaManifest({ ...manifest, variabel: [...manifest.variabel, variabelPaket("0999")] }).join(" ")).toContain("Sidik paket tidak cocok");
    const jahat = { ...manifest, berkas: [{ ...manifest.berkas[0], jalur: "../../etc/passwd" }, manifest.berkas[1]] };
    expect(periksaManifest(jahat).join(" ")).toContain("Jalur berkas tidak aman");
    const ganda = { ...manifest, berkas: [manifest.berkas[0], manifest.berkas[0]] };
    expect(periksaManifest(ganda).join(" ")).toContain("Berkas dobel");
    const md5Buruk = { ...manifest, berkas: [{ ...manifest.berkas[0], md5: "zzz" }, manifest.berkas[1]] };
    expect(periksaManifest(md5Buruk).join(" ")).toContain("Sidik berkas tidak sah");
  });

  it("isian berbentuk CASE tanpa satu pun WHEN ditolak (kueri tidak sah)", () => {
    const tanpaWhen = "SELECT CASE (SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1) ELSE 'x' END AS data";
    const berkas = susunPaketUji().manifest.berkas;
    const v = [variabelPaket("9271", { sql_query: tanpaWhen })];
    const m = { format: FORMAT_PAKET, server: SERVER_INDUK, berkas, variabel: v, sidik: sidikPaket(berkas, v) };
    expect(periksaManifest(m).join(" ")).toContain("CASE tanpa satu pun WHEN");
  });

  it("fungsi basis data: ikut sidik, nama dan sidik diperiksa, berkasnya diperiksa utuh sebelum pemasangan", async () => {
    const { manifest, dir } = susunPaketUji({ denganFungsi: true });
    expect(periksaManifest(manifest)).toEqual([]);
    expect(sidikPaket(manifest.berkas, manifest.variabel)).not.toBe(manifest.sidik); // fungsi ikut sidik
    expect(periksaManifest({ ...manifest, fungsi: [{ nama: "../x", md5: "zzz", ukuran: 1 }] }).join(" ")).toContain("Nama fungsi tidak sah");
    expect(periksaManifest({ ...manifest, fungsi: [manifest.fungsi![0], manifest.fungsi![0]] }).join(" ")).toContain("Fungsi dobel");
    expect(periksaManifest({ ...manifest, fungsi: [{ ...manifest.fungsi![0], md5: "salah" }] }).join(" ")).toContain("Sidik fungsi tidak sah");
    expect(periksaManifest({ ...manifest, fungsi: [{ ...manifest.fungsi![0], md5: "0".repeat(32) }] }).join(" ")).toContain("Sidik paket tidak cocok");
    const p = await bacaPaket(dir);
    expect(await periksaIsiPaket(p)).toEqual([]);
    fs.appendFileSync(path.join(dir, "fungsi", "isian_rtf_spasi.sql"), "-- diubah");
    expect((await periksaIsiPaket(p)).join(" ")).toContain("Isi fungsi tidak cocok dengan manifest: isian_rtf_spasi");
    fs.rmSync(path.join(dir, "fungsi", "isian_rtf_spasi.sql"));
    expect((await periksaIsiPaket(p)).join(" ")).toContain("Berkas fungsi hilang dari paket: isian_rtf_spasi");
  });

  it("isian yang masih membawa cabang satker ditolak", () => {
    const v = [variabelPaket("9271", { sql_query: SQL_ALAMAT })];
    const berkas = susunPaketUji().manifest.berkas;
    const m = { format: FORMAT_PAKET, server: SERVER_INDUK, berkas, variabel: v, sidik: sidikPaket(berkas, v) };
    expect(periksaManifest(m).join(" ")).toContain("masih memuat cabang satker PA.Dgl");
  });

  it("jalur berkas dalam paket tidak boleh keluar dari folder blangko", () => {
    const dir = path.resolve(os.tmpdir(), "x");
    expect(jalurDiPaket(dir, "1 Perceraian CG/a.rtf")).toBe(path.resolve(dir, "blangko", "1 Perceraian CG", "a.rtf"));
    expect(jalurDiPaket(dir, "../manifest.json")).toBeNull();
    const mundur = jalurDiPaket(dir, "..\\..\\x");
    expect(mundur === null || mundur.startsWith(path.resolve(dir, "blangko"))).toBe(true);
  });
});

// ─── pemasangan (pg-mem) ────────────────────────────────────────────────────────────────────────────────────────

async function siapkanDb() {
  const mem = newDb();
  for (const s of SQL) mem.public.none(s);
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  return { db: db as never, run: db.run, baca: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>> };
}

const langsung = (db: never) => ({ transaksi: async <T,>(kerja: (tx: never) => Promise<T>) => kerja(db), kini: () => "2026-11-05T10:00:00.000Z" });

describe("memasang paket induk (tanpa ABT)", () => {
  it("memasang blangko dan isian sebagai server induk; memasang ulang tidak menulis apa pun", async () => {
    const { db, baca } = await siapkanDb();
    const { dir, manifest } = susunPaketUji();
    const satu = await pasangPaketInduk(db, dir, "Pemasang", langsung(db));
    expect(satu).toMatchObject({ server: SERVER_INDUK, berkasPaket: 2, variabelPaket: 4, paketSidik: manifest.sidik });
    expect(satu.berkas).toMatchObject({ baru: 2, gagal: 0 });
    expect(satu.variabel).toMatchObject({ baru: 4 });
    expect((await baca("SELECT id, asal, asal_server, status FROM aleta_abt_berkas ORDER BY id")).map((b) => [b.id, b.asal, b.asal_server, b.status])).toEqual([
      ["1 Perceraian CG/[01] Kabul.rtf", "abt", SERVER_INDUK, "aktif"],
      ["2 Itsbat Nikah/[01] Kabul.rtf", "abt", SERVER_INDUK, "aktif"],
    ]);
    expect((await baca("SELECT server, no_var, kode FROM aleta_abt_peta_variabel ORDER BY no_var")).map((p) => [p.server, p.no_var, p.kode])).toEqual([
      [SERVER_INDUK, "0046", "AA00046"],
      [SERVER_INDUK, "0047", "AA00047"],
      [SERVER_INDUK, "8008", "AA08008"],
      [SERVER_INDUK, "9271", "AA09271"],
    ]);
    const dua = await pasangPaketInduk(db, dir, "Pemasang", langsung(db));
    expect(dua.tulis).toBe(0);
    expect(dua.berkas).toMatchObject({ baru: 0, sama: 2, berubah: 0, bentrok: 0, hilang: 0 });
    // tidak ada baris menu: paket induk tidak membawa hak folder satu satker
    expect(await baca("SELECT id FROM aleta_abt_menu")).toHaveLength(0);
  });

  it("pustaka induk dibaca dari server induk dan tidak mengandung cabang satker pembuat paket", async () => {
    const { db } = await siapkanDb();
    const { dir } = susunPaketUji();
    await pasangPaketInduk(db, dir, "Pemasang", langsung(db));
    const p = await muatPustakaInduk(db);
    expect(Object.keys(p.pustaka).sort()).toEqual(["0046", "0047", "8008", "9271"]);
    expect(p.pustaka["9271"].sql_query).not.toContain("PA.Dgl");
    expect(p.alias["AA09271"]).toBe("9271");
  });

  it("paket rusak tidak dipasang setengah: tidak satu baris pun tertulis", async () => {
    const { db, baca } = await siapkanDb();
    const { dir } = susunPaketUji();
    fs.appendFileSync(path.join(dir, "blangko", "1 Perceraian CG", "[01] Kabul.rtf"), "rusak");
    await expect(pasangPaketInduk(db, dir, "Pemasang", langsung(db))).rejects.toMatchObject({ status: 400 });
    await expect(pasangPaketInduk(db, dir, "Pemasang", langsung(db))).rejects.toThrow(/Paket rusak, tidak dipasang/);
    fs.rmSync(path.join(dir, "blangko", "2 Itsbat Nikah"), { recursive: true });
    const p = await bacaPaket(dir);
    expect((await periksaIsiPaket(p)).join(" ")).toContain("Berkas hilang dari paket");
    for (const t of ["aleta_abt_berkas", "aleta_abt_variabel", "aleta_abt_peta_variabel", "aleta_abt_sinkron"]) expect(await baca(`SELECT * FROM ${t}`), t).toHaveLength(0);
  });

  it("folder yang bukan paket ditolak 400", async () => {
    const { db } = await siapkanDb();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bukan-paket-"));
    dirSementara.push(dir);
    await expect(pasangPaketInduk(db, dir, "x", langsung(db))).rejects.toMatchObject({ status: 400 });
  });

  it("blangko dan isian milik satker tidak tertimpa dan tidak ditandai hilang oleh pasang/ubah paket induk", async () => {
    const { db, baca, run } = await siapkanDb();
    const { dir } = susunPaketUji();
    await pasangPaketInduk(db, dir, "Pemasang", langsung(db));
    const sekarang = "2026-11-05T11:00:00.000Z";
    // satker menyunting blangko induk (diubah = 1), membuat blangko sendiri (asal aleta) dan isian sendiri
    await run("UPDATE aleta_abt_berkas SET isi = 'UBAHAN SATKER', diubah = 1 WHERE id = '1 Perceraian CG/[01] Kabul.rtf'");
    await run("INSERT INTO aleta_abt_berkas (id, folder, nama, isi, asal, asal_server, diubah, status, dibuat_at, diubah_at) VALUES ('Milik Satker/a.rtf', 'Milik Satker', 'a.rtf', 'BLANGKO SATKER', 'aleta', 'satker', 1, 'aktif', ?, ?)", [sekarang, sekarang]);
    await run("INSERT INTO aleta_abt_variabel (kode, nama, sql_query, asal, asal_server, diubah, status, dibuat_at, diubah_at) VALUES ('AA100500', 'Isian satker', 'SELECT 1', 'aleta', 'satker', 1, 'aktif', ?, ?)", [sekarang, sekarang]);
    // paket diperbarui: blangko CG berubah, blangko Itsbat dan isian 0047 dibuang
    const baru = susunPaketUji({ rtfCg: "{\\rtf1 PUTUSAN BARU #8008#}", variabel: [variabelPaket("0046"), variabelPaket("8008"), variabelPaket("9271")] });
    const hasil = await pasangPaketInduk(db, baru.dir, "Pemasang", langsung(db));
    expect(hasil.berkas).toMatchObject({ bentrok: 1 });
    const cg = (await baca("SELECT isi, diubah, bentrok_md5 FROM aleta_abt_berkas WHERE id = '1 Perceraian CG/[01] Kabul.rtf'"))[0];
    expect(cg).toMatchObject({ isi: "UBAHAN SATKER", diubah: 1 });
    expect(String(cg.bentrok_md5)).toHaveLength(32);
    expect((await baca("SELECT isi, status FROM aleta_abt_berkas WHERE id = 'Milik Satker/a.rtf'"))[0]).toEqual({ isi: "BLANGKO SATKER", status: "aktif" });
    expect((await baca("SELECT status FROM aleta_abt_variabel WHERE kode = 'AA100500'"))[0]).toEqual({ status: "aktif" });
    // ubah paket induk menandai yang hilang dari paket, tidak menghapusnya
    expect((await baca("SELECT status FROM aleta_abt_variabel WHERE kode = 'AA00047'"))[0]).toEqual({ status: "hilang" });
    expect(await baca("SELECT id FROM aleta_abt_berkas")).toHaveLength(3);
  });

  it("nomor isian ABT setempat tidak bentrok: kode dipetakan per server; pustaka induk dipakai walau ABT setempat ikut disinkron", async () => {
    const { db, baca, run } = await siapkanDb();
    const sekarang = "2026-11-05T11:00:00.000Z";
    // ABT setempat (server "PA.Xyz") sudah ada lebih dulu: #0046# di sana BERARTI hal lain dan memegang kode AA00046
    await run("INSERT INTO aleta_abt_variabel (kode, nama, sql_query, asal, asal_server, asal_no, status, dibuat_at, diubah_at) VALUES ('AA00046', 'Isian setempat 0046', 'SELECT ''setempat'' AS data', 'abt', 'PA.Xyz', '0046', 'aktif', ?, ?)", [sekarang, sekarang]);
    await run("INSERT INTO aleta_abt_peta_variabel (id, server, no_var, kode, status, dibuat_at, diubah_at) VALUES ('p1', 'PA.Xyz', '0046', 'AA00046', 'aktif', ?, ?)", [sekarang, sekarang]);
    const { dir } = susunPaketUji();
    await pasangPaketInduk(db, dir, "Pemasang", langsung(db));
    const peta = await baca("SELECT server, no_var, kode FROM aleta_abt_peta_variabel WHERE no_var = '0046' ORDER BY server");
    expect(peta).toHaveLength(2);
    expect(new Set(peta.map((p) => p.kode)).size).toBe(2); // kode berbeda: tidak bentrok
    const induk = await muatPustakaInduk(db);
    expect(induk.pustaka["0046"].sql_query).toBe("SELECT 'nilai 0046' AS data");
    expect(induk.pustaka["0046"].sql_query).not.toContain("setempat");
    // yang dipilih mesin tanpa penunjuk server adalah server dengan isian aktif terbanyak: induk (4) menang atas ABT setempat (1)
    const pilihan = await muatPustakaMesin(db);
    expect(pilihan.pustaka["0046"].sql_query).toBe("SELECT 'nilai 0046' AS data");
  });
});
