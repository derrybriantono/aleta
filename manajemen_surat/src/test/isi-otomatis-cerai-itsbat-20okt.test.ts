// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 (agen S3) - ISIAN OTOMATIS CERAI GUGAT, CERAI TALAK, IKRAR TALAK DAN ITSBAT NIKAH
 * ============================================================================
 *
 * Pengisi baru aleta_bot/services/abtIsianLengkap20okt.js dijalankan sungguhan dengan posita/petitum bentuk SIPP
 * (nama diganti) dan baris SIPP tiruan. Yang dijaga:
 *   A  delegasi, PHS baru ikrar, tab Anak, hubungan orang tua, umur dari tanggal lahir: nilai, keyakinan, sumber;
 *   B  tuntutan accessoir dari posita+petitum (ragu), jumlah untuk amar (9711-9713), 9715, 9050;
 *   C  7035/8503/9686 dari posita: selalu "ragu" dengan keterangan; tak ada tebakan bila posita diam;
 *   D  perangkai usulanLengkap: hanya SELECT, satu kueri gagal tidak menggagalkan yang lain, jenis lain tidak disentuh,
 *      tidak ada kata aplikasi di nilai, semua jagaIsianLama;
 *   E  mesin bersama (isi-sipp-bersama.js): tulis hanya pasti/cukup, ragu = saran, isian terisi TIDAK ditimpa, "diisi manual"
 *      + alasan, nilai pengisi mengalahkan tanda manual;
 *   F  susunIsian: #9134# opsional dengan labelPengguna; isian manual membawa alasan; isian lain tidak berubah;
 *   G  penjaga: isian cerai/itsbat di DAFTAR-CEK yang belum otomatis punya pengisi baru, tanda manual, atau opsional.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ISIAN_MANUAL, ISIAN_OPSIONAL } from "@/app/api/aleta-ecourt/blangko-derry/isian-metadata";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));

type Usulan = { kode: string; nama: string; nilai: string; keyakinan: string; catatan: string; jagaIsianLama?: boolean; sumber: Array<{ asal: string; kalimat: string }> };
type Modul = {
  KODE_DIISI: string[];
  polos: (h: string) => string;
  usulanDelegasi: (rows: unknown) => Usulan[];
  usulanPhsBaruIkrar: (rows: unknown) => Usulan[];
  usulanAnak: (rows: unknown) => Usulan[];
  usulanHubunganOrangTua: (o: unknown) => Usulan[];
  umurTahun: (lahir: string, pada: string) => number | null;
  usulanUmurItsbat: (pihak: unknown, tgl: string) => Usulan[];
  rincianNafkah: (t: unknown, T: unknown) => string;
  usulanDariGugatanSipp: (o: { jenis: number; posita: string; petitum: string }) => { usulan: Usulan[] };
  kenaikanNafkahAnak: (t: string) => { nilai: string; kalimat: string } | null;
  bayarSebelumAktaCerai: (t: string) => { kalimat: string } | null;
  usulanPergiDariPosita: (p: string, jenis: number) => Usulan[];
  usulanHurufDariPosita: (p: string, jenis: number) => Usulan[];
  alasanTidakDicatat: (p: string) => { nilai: string; kalimat: string } | null;
  ketanggalIso: (t: string) => string;
  usulanLengkap: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<Usulan[]>;
};
type Mesin = {
  rencanakan: (u: Map<string, unknown>, katalog: unknown[], keIso: (t: string) => string, semua?: unknown[]) => {
    tulis: Array<{ kode: string; nilai: string }>;
    saran: Array<{ kode: string; nilai: string }>;
    lewati: Array<{ kode: string; sebab: string }>;
    info: Record<string, { golongan: string; catatan: string; lencana: { yakin: { teks: string } }; nilai: string }>;
  };
  pilihPerKode: (s: unknown[], boleh?: Set<string>) => Map<string, unknown>;
};

const M = req(path.join(AKAR, "aleta_bot", "services", "abtIsianLengkap20okt.js")) as Modul;
req(path.join(AKAR, "ekstensi-sipp", "isi-sipp-bersama.js"));
const mesin = (globalThis as unknown as { AletaIsiSipp: Mesin }).AletaIsiSipp;

const keIso = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

// Posita bentuk SIPP (nama diganti): cerai gugat dengan pisah rumah 3 tahun lebih, Penggugat pergi, satu anak.
const POSITA_CG = `<div>1. Bahwa pada tanggal 05 Februari 2018, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah Nomor : 0013/003/II/2018, tertanggal 05 Februari 2018;</div>
<div>2. Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Labuan hingga pisah rumah;</div>
<div>3. Bahwa setelah menikah, Penggugat dan Tergugat hidup selayaknya suami isteri dan telah di karuniai seorang anak yang bernama Fulan bin Fulan, umur 5 tahun;
Saat ini anak tersebut dalam Pengasuhan Penggugat;</div>
<div>4. Bahwa sejak tahun 2022 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat secara terus menerus yang disebabkan karena Tergugat memiliki hubungan dengan wanita lain;</div>
<div>5. Bahwa puncak keretakan hubungan rumah tangga tersebut terjadi pada tanggal 18 Januari 2023, Penggugat pergi meninggalkan rumah kediaman bersama dan pamit kepada Tergugat untuk mengantar kerabat, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 3 tahun 10 bulan. Sejak saat itu hak dan kewajiban suami isteri tidak terlaksana sebagaimana mestinya;</div>
<div>6. Bahwa keluarga telah mencoba memusyawarahkan untuk mencari penyelesaian namun usaha tersebut tidak membuahkan hasil;</div>`;

// Cerai gugat yang Tergugatnya dipenjara: tidak ada perselisihan, tidak ada yang "pergi" (ditahan).
const POSITA_CG_PENJARA = `<div>1. Bahwa pada tanggal 25 Maret 2012, Penggugat dan Tergugat telah melangsungkan pernikahan di KUA Kecamatan Damsol;</div>
<div>2. Bahwa selama pernikahan antara Penggugat dan Tergugat tidak pernah terjadi perselisihan dan pertengkaran namun pada tanggal 27 April 2023 Tergugat ditahan di Lembaga Pemasyarakatan Kelas IIA Palu, sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 3 tahun 5 bulan. Sejak saat itu hak dan kewajiban suami isteri tidak terlaksana;</div>`;

const PETITUM_CG_NAFKAH = `<div>PRIMER</div>
<div>1. Mengabulkan Gugatan Penggugat;</div>
<div>2. Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;</div>
<div>3. Menetapkan Penggugat sebagai pemegang hak asuh atas ketiga anak Penggugat dan Tergugat;</div>
<div>4. Menghukum Tergugat untuk membayar nafkah iddah sebesar Rp. 3.000.000 per bulan;</div>
<div>5. Menghukum Tergugat untuk membayar Nafkah Mut'ah sebesar Rp.20.000.000;</div>
<div>6. Membebankan biaya perkara sesuai ketentuan hukum;</div>`;

// Itsbat nikah voluntair dua Pemohon (bentuk perkara contoh 228; nama diganti).
const POSITA_ITSBAT = `<div>1. Bahwa pada hari Senin, 17 November 2025 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa Lembantongoa, di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah;</div>
<div>2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan  dalam usia 18 tahun Pernikahan dilangsungkan dengan wali nikah yaitu Fulan (Ayah Kandung Pemohon II) dan yang menikahkan adalah Fulan (Imam Desa), dan dihadiri saksi nikah bernama Fulan A dan Fulan B, dengan mas kawin berupa Rp.1.100.000 dan dibayar tunai;</div>
<div>6. Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena Para Pemohon masih berstatus belum cukup umur saat pernikahan dan pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan Palolo, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah;</div>`;

describe("A - sumber terstruktur SIPP", () => {
  it("delegasi: nomor, tanggal dan biaya surat permintaan bantuan panggilan terbaru, biaya angka saja", () => {
    const u = M.usulanDelegasi([
      { nomor: "62/PAN.PA.W22-A5/HK.2.6/XII/2026", tgl: "2026-12-11", biaya: "1280000.00", tujuan: "PENGADILAN AGAMA PALU" },
      { nomor: "10/PAN.PA.W22-A5/HK.2.6/X/2026", tgl: "2026-10-01", biaya: "300000.00", tujuan: "PENGADILAN AGAMA PALU" },
    ]);
    const per = Object.fromEntries(u.map((x) => [x.kode, x]));
    expect(per["1154"].nilai).toBe("62/PAN.PA.W22-A5/HK.2.6/XII/2026");
    expect(per["1154"].keyakinan).toBe("pasti");
    expect(per["1232"].nilai).toBe("11/12/2026");
    expect(per["5230"].nilai).toBe("1280000");
    expect(per["5230"].keyakinan).toBe("cukup");
    expect(per["1154"].catatan).toMatch(/2 surat/);
    expect(per["1154"].sumber[0].kalimat).toMatch(/PENGADILAN AGAMA PALU/);
  });

  it("delegasi tanpa surat: tanda 'tidak ada sumber' dengan alasan, bukan tebakan", () => {
    const u = M.usulanDelegasi([]);
    expect(u.map((x) => x.kode).sort()).toEqual(["1154", "1232", "5230"]);
    for (const x of u) {
      expect(x.keyakinan).toBe("tidak_ada_sumber");
      expect(x.nilai).toBe("");
      expect(x.catatan).toMatch(/tab Delegasi SIPP/);
    }
    // biaya nol atau tak terbaca tidak ditulis
    const nol = M.usulanDelegasi([{ nomor: "1/X", tgl: "2026-10-01", biaya: "0.00", tujuan: "" }]);
    expect(nol.map((x) => x.kode)).toEqual(["1154", "1232"]);
  });

  it("PHS baru ikrar talak = penetapan kembali hari sidang ikrar terbaru", () => {
    const u = M.usulanPhsBaruIkrar([{ penetapan: "2026-09-30", sidang: "2026-10-12" }]);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ kode: "1081", nilai: "30/09/2026", keyakinan: "cukup", jagaIsianLama: true });
    expect(u[0].sumber[0].kalimat).toMatch(/12\/10\/2026/);
    expect(M.usulanPhsBaruIkrar([])[0].keyakinan).toBe("tidak_ada_sumber");
  });

  it("tab Anak SIPP: 8603 dipisah koma, 5110 'A, B dan C', nama kembar dibuang", () => {
    const u = M.usulanAnak([{ nama: "Anak Satu bin Fulan" }, { nama: "Anak  Dua binti Fulan" }, { nama: "Anak Tiga bin Fulan" }, { nama: "Anak Satu bin Fulan" }, { nama: " " }]);
    const per = Object.fromEntries(u.map((x) => [x.kode, x.nilai]));
    expect(per["8603"]).toBe("Anak Satu bin Fulan, Anak Dua binti Fulan, Anak Tiga bin Fulan");
    expect(per["5110"]).toBe("Anak Satu bin Fulan, Anak Dua binti Fulan dan Anak Tiga bin Fulan");
    expect(M.usulanAnak([])).toEqual([]);
    expect(M.usulanAnak(null)).toEqual([]);
  });

  it("hubungan orang tua: hanya cerai yang menyangkut anak; ibu kandung (Penggugat/Termohon-rekonvensi) dan bapak kandung", () => {
    const cg = M.usulanHubunganOrangTua({ jenis: 347, adaAnak: true, petitum: "" });
    expect(cg.map((x) => [x.kode, x.nilai])).toEqual([
      ["0709", "ibu kandung"],
      ["0711", "bapak kandung"],
    ]);
    expect(M.usulanHubunganOrangTua({ jenis: 346, adaAnak: false, petitum: "Menetapkan hak asuh anak kepada Termohon" })).toHaveLength(2);
    expect(M.usulanHubunganOrangTua({ jenis: 347, adaAnak: false, petitum: "Menjatuhkan talak satu bain" })).toEqual([]);
    expect(M.usulanHubunganOrangTua({ jenis: 360, adaAnak: true, petitum: "" })).toEqual([]);
  });

  it("umur saat menikah dari tanggal lahir: penuh tahun, pihak dikenali dari jenis kelamin, tidak ditebak bila ganda; selalu ragu", () => {
    expect(M.umurTahun("2004-02-26", "2025-11-17")).toBe(21);
    expect(M.umurTahun("2007-05-03", "2025-11-17")).toBe(18);
    expect(M.umurTahun("2003-11-25", "2025-07-23")).toBe(21); // belum ulang tahun: bukan 22
    expect(M.umurTahun("0000-00-00", "2025-07-23")).toBeNull();
    expect(M.umurTahun("2030-01-01", "2025-07-23")).toBeNull();
    const u = M.usulanUmurItsbat(
      [
        { urutan: 1, jk: "P", lahir: "2007-05-03" },
        { urutan: 2, jk: "L", lahir: "2004-02-26" },
      ],
      "2025-11-17"
    );
    const per = Object.fromEntries(u.map((x) => [x.kode, x]));
    expect(per["7211"].nilai).toBe("21 tahun");
    expect(per["7212"].nilai).toBe("18 tahun");
    expect(per["7211"].keyakinan).toBe("ragu");
    expect(per["7211"].catatan).toMatch(/dibulatkan/);
    expect(M.usulanUmurItsbat([{ jk: "L", lahir: "2004-02-26" }, { jk: "L", lahir: "2003-01-01" }], "2025-11-17")).toEqual([]);
    expect(M.usulanUmurItsbat([{ jk: "L", lahir: "2004-02-26" }], "")).toEqual([]);
    expect(M.usulanUmurItsbat([{ jk: "L", lahir: "2020-02-26" }], "2025-11-17")).toEqual([]); // 5 tahun: tidak masuk akal
  });
});

describe("B - tuntutan accessoir dari posita dan petitum SIPP", () => {
  it("nafkah iddah, mut'ah dan hak asuh terbaca; semuanya ragu dan membawa sumber SIPP", () => {
    const { usulan } = M.usulanDariGugatanSipp({ jenis: 347, posita: POSITA_CG, petitum: PETITUM_CG_NAFKAH });
    const per = Object.fromEntries(usulan.map((x) => [x.kode, x]));
    expect(per["6054"].nilai).toMatch(/Rp3\.000\.000,00/);
    expect(per["6055"].nilai).toMatch(/Rp20\.000\.000,00/);
    expect(per["7778"].nilai).toBe("1");
    expect(per["9712"].nilai).toBe("Rp9.000.000,00 (3 bulan x Rp3.000.000,00)");
    expect(per["9713"].nilai).toBe("uang sejumlah Rp20.000.000,00");
    for (const k of ["6054", "6055", "7778", "9712", "9713"]) {
      expect(per[k].keyakinan).toBe("ragu");
      expect(per[k].jagaIsianLama).toBe(true);
      expect(per[k].sumber[0].asal).toBe("posita-gugatan");
    }
    expect(per["6054"].sumber[0].kalimat).toMatch(/^Posita\/petitum di SIPP/);
    expect(per["9712"].catatan).toMatch(/DITUNTUT/);
    // nama anak diserahkan ke tab Anak SIPP, bukan ke sini
    expect(usulan.some((x) => x.kode === "5110")).toBe(false);
  });

  it("petitum tanpa nafkah/hak asuh: tidak ada usulan tuntutan; teks terlalu pendek: kosong", () => {
    const { usulan } = M.usulanDariGugatanSipp({ jenis: 347, posita: POSITA_CG, petitum: "<div>1. Mengabulkan gugatan;</div><div>2. Menjatuhkan talak satu bain shughra;</div>" });
    expect(usulan.filter((x) => ["6054", "6055", "7120", "6071", "9711", "9712", "9713"].includes(x.kode))).toEqual([]);
    expect(M.usulanDariGugatanSipp({ jenis: 347, posita: "", petitum: "" }).usulan).toEqual([]);
  });

  it("9050 kenaikan nafkah anak per tahun hanya bila petitum menyebut persen kenaikan", () => {
    const k = M.kenaikanNafkahAnak("Menghukum Tergugat membayar nafkah anak Rp1.000.000 per bulan dengan kenaikan 10% setiap tahun di luar biaya pendidikan");
    expect(k?.nilai).toBe("10% (sepuluh persen)");
    expect(M.kenaikanNafkahAnak("Menghukum Tergugat membayar nafkah anak Rp1.000.000 per bulan")).toBeNull();
    expect(M.kenaikanNafkahAnak("bunga 12% per tahun atas pinjaman")).toBeNull();
  });

  it("9715 hanya bila dituntut dibayar sebelum Tergugat mengambil akta cerai", () => {
    expect(M.bayarSebelumAktaCerai("Menghukum Tergugat membayar nafkah iddah dan mut'ah sebelum Tergugat mengambil akta cerai")).not.toBeNull();
    expect(M.bayarSebelumAktaCerai("Menghukum Tergugat membayar nafkah iddah sebesar Rp3.000.000")).toBeNull();
  });
});

describe("C - fakta dari posita: ragu dan tidak menebak", () => {
  it("7035: pihak yang meninggalkan rumah menurut posita; sebutan menurut jenis; ragu", () => {
    const cg = M.usulanPergiDariPosita(POSITA_CG, 347);
    expect(cg).toHaveLength(1);
    expect(cg[0]).toMatchObject({ kode: "7035", nilai: "Penggugat", keyakinan: "ragu" });
    expect(cg[0].catatan).toMatch(/kuatkan dengan keterangan saksi/);
    const ct = M.usulanPergiDariPosita(POSITA_CG.replace(/Penggugat/g, "Pemohon").replace(/Tergugat/g, "Termohon"), 346);
    expect(ct[0].nilai).toBe("Pemohon");
    // ditahan bukan 'pergi': posita diam -> tidak ada usulan
    expect(M.usulanPergiDariPosita(POSITA_CG_PENJARA, 347)).toEqual([]);
  });

  it("8503: hanya F dan B yang terukur; sangkalan perselisihan dihormati; catatan menyebut huruf lain", () => {
    const a = M.usulanHurufDariPosita(POSITA_CG, 347);
    expect(a[0]).toMatchObject({ kode: "8503", nilai: "BF", keyakinan: "ragu" });
    expect(a[0].catatan).toMatch(/keputusan hakim/);
    const b = M.usulanHurufDariPosita(POSITA_CG_PENJARA, 347);
    expect(b[0].nilai).toBe("B"); // 3 tahun 5 bulan; 'tidak pernah terjadi perselisihan' bukan dalil F
    expect(b[0].nilai).not.toMatch(/F/);
    expect(M.usulanHurufDariPosita("<div>1. Bahwa Penggugat dan Tergugat menikah pada 2020;</div>", 347)).toEqual([]);
  });

  it("9686: alasan tidak mencatatkan pernikahan dari kalimat 'karena ...' pada posita itsbat; tanpa kalimat itu kosong", () => {
    const a = M.alasanTidakDicatat(POSITA_ITSBAT);
    expect(a).not.toBeNull();
    expect(a?.nilai).toMatch(/^para Pemohon masih berstatus belum cukup umur saat pernikahan/i);
    expect(M.alasanTidakDicatat("<div>1. Bahwa Pemohon I dan Pemohon II menikah pada 2020 di KUA;</div>")).toBeNull();
  });

  it("tanggal nikah ke ISO untuk perhitungan umur", () => {
    expect(M.ketanggalIso("17 November 2025")).toBe("2025-11-17");
    expect(M.ketanggalIso("04 Juli 2011")).toBe("2011-07-04");
    expect(M.ketanggalIso("17/11/2025")).toBe("2025-11-17");
    expect(M.ketanggalIso("hari ini")).toBe("");
  });
});

/** SIPP tiruan: jawaban kueri menurut potongan SQL; semua kueri dicatat untuk memastikan hanya SELECT. */
function sippTiruan(perkara: Record<string, unknown>, sisa: Record<string, unknown> = {}, gagal: string[] = []) {
  const sql: string[] = [];
  const q = async (teks: string) => {
    sql.push(teks);
    const t = teks.replace(/\s+/g, " ");
    for (const g of gagal) if (t.includes(g)) throw new Error(`tabel ${g} tidak ada`);
    if (t.includes("FROM perkara WHERE perkara_id")) return [perkara];
    for (const [kunci, nilai] of Object.entries(sisa)) if (t.includes(kunci)) return nilai;
    return [];
  };
  return { q, sql };
}

describe("D - perangkai usulanLengkap", () => {
  const ADA_ANAK = { "FROM perkara_anak_pihak": [{ nama: "Fulan bin Fulan" }] };

  it("cerai talak: PHS baru ikrar, delegasi, anak, 0709/0711 dan fakta posita tersusun tanpa kembar", async () => {
    const { q, sql } = sippTiruan(
      { jenis: 346, alur: 15, posita: POSITA_CG.replace(/Penggugat/g, "Pemohon").replace(/Tergugat/g, "Termohon"), petitum: PETITUM_CG_NAFKAH.replace(/Penggugat/g, "Pemohon").replace(/Tergugat/g, "Termohon") },
      {
        "FROM delegasi_keluar": [{ nomor: "31/PAN/X/2026", tgl: "2026-10-05", biaya: "250000.00", tujuan: "PENGADILAN AGAMA PALU" }],
        "FROM perkara_penetapan_kembali_ikrar": [{ penetapan: "2026-09-30", sidang: "2026-10-12" }],
        ...ADA_ANAK,
      }
    );
    const u = await M.usulanLengkap(10001, q);
    const kode = u.map((x) => x.kode);
    expect(new Set(kode).size).toBe(kode.length);
    const per = Object.fromEntries(u.map((x) => [x.kode, x]));
    expect(per["1081"].nilai).toBe("30/09/2026");
    expect(per["1154"].nilai).toBe("31/PAN/X/2026");
    expect(per["5230"].nilai).toBe("250000");
    expect(per["8603"].nilai).toBe("Fulan bin Fulan");
    expect(per["0709"].nilai).toBe("ibu kandung");
    expect(per["7035"].nilai).toBe("Pemohon");
    expect(per["8503"].nilai).toBe("BF");
    // hanya SELECT
    for (const s of sql) expect(s.trim().toUpperCase().startsWith("SELECT")).toBe(true);
    // semua usulan hanya mengisi isian yang kosong
    for (const x of u) expect(x.jagaIsianLama).toBe(true);
  });

  it("cerai gugat tidak mendapat PHS baru ikrar (itu khusus cerai talak)", async () => {
    const { q } = sippTiruan({ jenis: 347, alur: 15, posita: POSITA_CG, petitum: "<div>1. Mengabulkan gugatan;</div>" }, { "FROM perkara_penetapan_kembali_ikrar": [{ penetapan: "2026-09-30", sidang: "2026-10-12" }] });
    const u = await M.usulanLengkap(10002, q);
    expect(u.some((x) => x.kode === "1081")).toBe(false);
    expect(u.some((x) => x.kode === "7035")).toBe(true);
  });

  it("itsbat: umur dari tanggal lahir SIPP (tanggal nikah dari posita), 9686 dari posita, tanpa isian cerai", async () => {
    const { q } = sippTiruan(
      { jenis: 360, alur: 16, posita: POSITA_ITSBAT, petitum: "<div>2. Menetapkan sah pernikahan;</div>" },
      {
        "FROM perkara_pihak1": [
          { urutan: 1, jk: "L", lahir: "2004-02-26" },
          { urutan: 2, jk: "P", lahir: "2007-05-03" },
        ],
      }
    );
    const u = await M.usulanLengkap(10003, q);
    const per = Object.fromEntries(u.map((x) => [x.kode, x]));
    expect(per["7211"].nilai).toBe("21 tahun");
    expect(per["7212"].nilai).toBe("18 tahun");
    expect(per["9686"].keyakinan).toBe("ragu");
    for (const k of ["7035", "8503", "8603", "0709", "1081"]) expect(per[k]).toBeUndefined();
  });

  it("satu kueri gagal tidak menggagalkan yang lain; jenis lain tidak disentuh; id tak sah kosong", async () => {
    const { q } = sippTiruan({ jenis: 347, alur: 15, posita: POSITA_CG, petitum: PETITUM_CG_NAFKAH }, ADA_ANAK, ["delegasi_keluar", "perkara_penetapan_kembali_ikrar"]);
    const u = await M.usulanLengkap(10004, q);
    expect(u.some((x) => x.kode === "8603")).toBe(true);
    expect(u.some((x) => x.kode === "1154")).toBe(true); // delegasi gagal dibaca -> tanda 'tidak ada sumber', bukan galat
    const lain = await M.usulanLengkap(10005, sippTiruan({ jenis: 363, alur: 16, posita: "x", petitum: "y" }).q);
    expect(lain).toEqual([]);
    expect(await M.usulanLengkap(0, sippTiruan({}).q)).toEqual([]);
    expect(await M.usulanLengkap(10006, undefined as unknown as never)).toEqual([]);
    const mati = await M.usulanLengkap(10007, async () => {
      throw new Error("SIPP mati");
    });
    expect(mati).toEqual([]);
  });

  it("tidak ada kata aplikasi pada nilai maupun catatan; kode yang dipancarkan terdaftar di KODE_DIISI", async () => {
    const { q } = sippTiruan({ jenis: 347, alur: 15, posita: POSITA_CG, petitum: PETITUM_CG_NAFKAH }, { ...ADA_ANAK, "FROM delegasi_keluar": [{ nomor: "1/X", tgl: "2026-10-05", biaya: "100000", tujuan: "PA" }] });
    const u = await M.usulanLengkap(10008, q);
    for (const x of u) {
      expect(`${x.nilai} ${x.catatan} ${x.sumber.map((s) => s.kalimat).join(" ")}`).not.toMatch(/aleta/i);
      expect(M.KODE_DIISI).toContain(x.kode);
    }
  });
});

describe("E - mesin bersama: tulis, saran, tidak menimpa, diisi manual", () => {
  const usulanDari = (daftar: Usulan[]) => mesin.pilihPerKode([daftar]);

  it("pasti/cukup ditulis ke isian kosong; ragu hanya saran; isian terisi tidak ditimpa", () => {
    const daftar = [
      ...M.usulanDelegasi([{ nomor: "31/PAN/X/2026", tgl: "2026-10-05", biaya: "250000", tujuan: "PA Palu" }]),
      ...M.usulanUmurItsbat([{ jk: "L", lahir: "2004-02-26" }], "2025-11-17"),
    ];
    const katalog = [
      { kode: "1154", nama: "Nomor surat", jenis: "teks", kosong: true },
      { kode: "1232", nama: "Tanggal surat", jenis: "tanggal", kosong: true },
      { kode: "5230", nama: "Ongkos", jenis: "teks", kosong: false }, // sudah diketik petugas
      { kode: "7211", nama: "Umur", jenis: "teks", kosong: true },
    ];
    const r = mesin.rencanakan(usulanDari(daftar), katalog, keIso, [daftar]);
    expect(r.tulis.map((x) => x.kode).sort()).toEqual(["1154", "1232"]);
    expect(r.saran.map((x) => x.kode)).toEqual(["7211"]);
    expect(r.lewati).toContainEqual({ kode: "5230", sebab: "sudah ada isinya" });
    expect(r.info["7211"].lencana.yakin.teks).toBe("yakin: ragu — periksa");
    expect(r.info["1154"].lencana.yakin.teks).toBe("yakin: pasti");
  });

  it("isian ditandai manual tanpa nilai: lencana 'diisi manual' dengan alasan; sudah terisi: tidak ada tanda", () => {
    const katalog = [
      { kode: "9501", nama: "Penilaian", jenis: "teks", kosong: true, manual: true, alasanManual: ISIAN_MANUAL["9501"] },
      { kode: "8729", nama: "Penilaian saksi", jenis: "teks", kosong: false, manual: true, alasanManual: ISIAN_MANUAL["8729"] },
    ];
    const r = mesin.rencanakan(new Map(), katalog, keIso, []);
    expect(r.info["9501"].golongan).toBe("manual");
    expect(r.info["9501"].lencana.yakin.teks).toBe("diisi manual");
    expect(r.info["9501"].catatan).toBe(ISIAN_MANUAL["9501"]);
    expect(r.info["8729"]).toBeUndefined();
    expect(r.tulis).toEqual([]);
  });

  it("nilai pengisi mengalahkan tanda manual; usulan 'tidak ada sumber' membawa alasannya sendiri", () => {
    const berNilai = M.usulanPhsBaruIkrar([{ penetapan: "2026-09-30", sidang: "" }]);
    const r1 = mesin.rencanakan(usulanDari(berNilai), [{ kode: "1081", nama: "PHS baru", jenis: "tanggal", kosong: true, manual: true, alasanManual: "cadangan" }], keIso, [berNilai]);
    expect(r1.tulis.map((x) => x.kode)).toEqual(["1081"]);
    expect(r1.info["1081"].golongan).not.toBe("manual");

    const tanpa = M.usulanPhsBaruIkrar([]);
    const r2 = mesin.rencanakan(usulanDari(tanpa), [{ kode: "1081", nama: "PHS baru", jenis: "tanggal", kosong: true, manual: false }], keIso, [tanpa]);
    expect(r2.info["1081"].golongan).toBe("manual");
    expect(r2.info["1081"].catatan).toMatch(/penetapan kembali hari sidang ikrar/);
    // alasan dari pengisi didahulukan di atas alasan tetap isian
    const r3 = mesin.rencanakan(usulanDari(tanpa), [{ kode: "1081", nama: "PHS baru", jenis: "tanggal", kosong: true, manual: true, alasanManual: "alasan tetap" }], keIso, [tanpa]);
    expect(r3.info["1081"].catatan).toMatch(/penetapan kembali/);
    // sudah terisi petugas: tidak ada tanda manual
    const r4 = mesin.rencanakan(usulanDari(tanpa), [{ kode: "1081", nama: "PHS baru", jenis: "tanggal", kosong: false }], keIso, [tanpa]);
    expect(r4.info["1081"]).toBeUndefined();
  });
});

describe("F - susunIsian: opsional dan manual", () => {
  const katalog = new Map<string, Definisi>([
    ["9134", { kode: "9134", nama: 'BAS PERMOHONAN: PETUNJUK PERBAIKAN PERMOHONAN - ISIAN (mis. "melengkapi nama"; kosong = titik-titik)', jenis: "data_teks", sql: "", bawaan: "" }],
    ["2557", { kode: "2557", nama: "(Saksi I) Berapa Kali Melihat dan Mendengar Pertengkaran (CUKUP ANGKA SAJA)", jenis: "data_teks", sql: "", bawaan: "1" }],
    ["0007", { kode: "0007", nama: "Telah Dikarunai Anak ", jenis: "data_teks", sql: "", bawaan: "#8492#" }],
  ]);

  it("#9134# opsional dengan label pengguna; #2557# manual dengan alasan; isian lain tidak berubah", () => {
    const s = susunIsian(["9134", "2557", "0007"], katalog);
    const per = Object.fromEntries(s.isian.map((b) => [b.kode, b]));
    expect(per["9134"].opsional).toBe(true);
    expect(per["9134"].labelPengguna).toBe("Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)");
    expect(per["9134"].nama).toBe("Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)");
    expect(per["9134"].manual).toBeUndefined();
    expect(per["2557"].manual).toBe(true);
    expect(per["2557"].alasanManual).toBe(ISIAN_MANUAL["2557"]);
    expect(per["2557"].opsional).toBeUndefined();
    expect("opsional" in per["0007"]).toBe(false);
    expect("manual" in per["0007"]).toBe(false);
  });

  it("metadata: kunci empat-lima angka, teks bahasa pengguna tanpa kata aplikasi, tak ada kode di kedua daftar", () => {
    for (const daftar of [ISIAN_MANUAL, ISIAN_OPSIONAL]) {
      for (const [k, v] of Object.entries(daftar)) {
        expect(k).toMatch(/^\d{4,5}$/);
        expect(v.trim().length).toBeGreaterThan(15);
        expect(v).not.toMatch(/aleta/i);
      }
    }
    for (const k of Object.keys(ISIAN_OPSIONAL)) expect(ISIAN_MANUAL[k]).toBeUndefined();
  });
});

describe("G - penjaga: tidak ada isian cerai/itsbat tanpa pengisi atau tanda", () => {
  type Cek = { isian: Array<{ kunci: string; status: string; keadaan?: string; nama: string }>; blangko: Array<{ folder: string; isian: string[] }> };
  const cek = JSON.parse(readFileSync(path.join(AKAR, "docs", "isi-sipp-abt", "DAFTAR-CEK.json"), "utf8")) as Cek;
  const { petaFolder } = req(path.join(AKAR, "scripts", "isi-sipp-abt", "folder-jenis.cjs")) as { petaFolder: (f: string) => { freq: string[]; universal?: boolean } };

  it("setiap isian status 'tidak/sebagian' pada blangko cerai gugat, cerai talak dan itsbat punya pengisi baru, tanda manual, atau opsional", () => {
    const info = new Map(cek.isian.map((x) => [x.kunci, x]));
    const milik = new Set(["347/15", "346/15", "360/16", "360/15"]);
    // Sudah terisi pada jenis S3 oleh pengisi yang ada (hanya "sebagian" di jenis lain): tgl nikah, pengumuman itsbat.
    // Di luar jenis S3 (pencegahan perkawinan, wali adhal): milik agen lain.
    const MILIK_LAIN = new Set(["5197", "0303", "1029", "9460", "1002"]);
    const tanpa: string[] = [];
    for (const b of cek.blangko) {
      const pf = petaFolder(b.folder);
      if (!(pf.universal || pf.freq.some((f) => milik.has(f)))) continue;
      for (const k of b.isian) {
        const x = info.get(k);
        if (!x || x.keadaan || k.startsWith("tj:") || x.status === "ya") continue;
        if (M.KODE_DIISI.includes(k) || ISIAN_MANUAL[k] || ISIAN_OPSIONAL[k] || MILIK_LAIN.has(k)) continue;
        tanpa.push(`${k} ${x.nama}`);
      }
    }
    expect([...new Set(tanpa)]).toEqual([]);
  });
});
