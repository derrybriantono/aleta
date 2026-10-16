// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { statusNilaiLayar } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { susunPenyatu, type FaktaBot, type FaktaPortal } from "@/server/modules/aleta-ecourt/penyatu";

/**
 * ============================================================================
 * 17 OKT 2026 - PERBAIKAN TEMUAN PEMERIKSAAN UJUNG-KE-UJUNG RILIS 1.203.0
 * ============================================================================
 *
 *   A  penyatu: sidang pertama dari jadwal SIPP, penetapan PERTAMA dari riwayat
 *      (273/G: perkara_penetapan.sidang_pertama 29 Juli tertimpa PHS baru; sidang ke-1 13 Mei)
 *   C  penyatu: keterangan saksi ABT vs daftar saksi SIPP (perkara_pihak5)
 *   D  penyatu: tugas juru sita "Pemberitahuan putusan verstek" (sama dengan penanda L2)
 *   E  pemantau putusan e-Court: perkara yang dibaca sebelum putus didahulukan (611/G)
 *   B  jembatan e-Court: pembaca persetujuan longgar + diagnosa (tabel pihak 0 baris)
 *   4  Blangko Derry: teks kosong bukan "terisi" di layar (#9272#)
 *   5  Blangko Derry: folder 99 PTSP mengikuti hak menu ABT
 *   6  kesiapan: sidangId milik perkara lain tidak dipakai
 */

const AKAR = path.resolve(__dirname, "../../..");
const req = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const muatBot = <T,>(rel: string) => req(path.join(AKAR, "aleta_bot", rel)) as T;
const HARI_INI = "2026-10-17";
const NOMOR = "273/Pdt.G/2026/PA.Dgl";

function fakta(ubah: (f: FaktaBot) => void = () => {}): FaktaBot {
  const f: FaktaBot = {
    ok: true,
    perkara: { perkaraId: 9729, nomorPerkara: NOMOR, jenisPerkara: "Kewarisan", alurPerkaraId: 15, tanggalDaftar: "2026-04-20", tahapan: "Persidangan", proses: "Sidang", ecourt: true },
    sipp: {
      terbaca: true,
      sidang: [
        { id: 19001, urutan: 1, tanggal: "2026-05-13", agenda: "Sidang Pertama", ditunda: true, alasanDitunda: "", dihadiriOleh: "1", ikrar: false, verzet: false, adaBas: true },
        { id: 20029, urutan: 8, tanggal: "2026-09-16", agenda: "Pembuktian Penggugat", ditunda: true, alasanDitunda: "", dihadiriOleh: "1", ikrar: false, verzet: false, adaBas: true },
      ],
      hakim: [{ nama: "Hakim Satu", jabatan: "Hakim Ketua", urutan: 1 }],
      pp: [{ nama: "Panji Pengganti", jabatan: "", urutan: 1 }],
      js: [{ nama: "Juru Sitanto", jabatan: "", urutan: 1 }],
      penetapan: {
        pmh: "2026-05-25",
        ppp: "2026-07-29",
        pjs: "2026-04-27",
        phs: "2026-07-16",
        sidangPertama: "2026-05-13",
        sidangPertamaPenetapan: "2026-07-29",
        awal: { pmh: "2026-04-27", ppp: "2026-04-27", pjs: "2026-04-27", phs: "2026-04-27" },
      },
      edocPenetapan: { pmh: true, ppp: true, pjs: true, phs: true },
      putusan: { ada: false, tanggal: "", statusNama: "", verstek: false, adaEdoc: false, adaAnonim: false, minutasi: "", bht: "" },
      pemberitahuan: { pihak1: "", pihak2: "" },
      saksi: { daftar: [{ id: 17459, sisi: 1 }, { id: 17592, sisi: 1 }, { id: 17649, sisi: 2 }], keterangan: 0 },
      relaas: [],
      mediasi: [],
    },
    abt: { terbaca: true, saksi: [{ sidangId: 20029, tanyaJawab: 35, saksi: 2, saksiId: [17459, 17592], terakhir: "2026-09-16" }], validasiBas: [], isian: [] },
    aleta: { terbaca: true, ecourtPutusan: null, tandaSidang: { selesai: [], berjalan: [], kehadiran: [] }, jejakPenetapan: [] },
    galat: [],
  };
  ubah(f);
  return f;
}
const PORTAL: FaktaPortal = { lembar: [], terbit: { jumlah: 0, terakhir: "" }, isianAbt: [], galat: [] };
const susun = (f: FaktaBot, peran: Parameters<typeof susunPenyatu>[0]["peran"] = ["jurusita"], namaAkun = "Juru Sitanto") =>
  susunPenyatu({ fakta: f, portal: PORTAL, peran, namaAkun, hariIni: HARI_INI });

describe("A. sidang pertama & penetapan pertama (sama dengan penanda L2)", () => {
  it("rincian penetapan: tanggal PERTAMA dari riwayat + yang terakhir; sidang pertama dari jadwal, bukan perkara_penetapan", () => {
    const pen = susun(fakta()).blangko.find((b) => b.jenis === "penetapan")!;
    expect(pen.rincian[0]).toContain("PMH: 27 April 2026 (pertama), terakhir 25 Mei 2026");
    expect(pen.rincian[3]).toContain("PHS: 27 April 2026 (pertama), terakhir 16 Juli 2026");
    const sp = pen.rincian.find((r) => r.startsWith("Sidang pertama"))!;
    expect(sp).toContain("Sidang pertama: 13 Mei 2026");
    expect(sp).toContain("29 Juli 2026");
    expect(sp).not.toMatch(/^Sidang pertama: 29 Juli/);
  });

  it("bot: sidangPertama = tanggal sidang paling awal di jadwal; penetapan pertama dari MIN tanggal_penetapan riwayat (SELECT saja)", async () => {
    const layanan = muatBot<{ buatLayanan: (d: unknown) => { ringkas: (x: unknown) => Promise<any> } }>("services/penyatuPerkaraService.js");
    const sql: string[] = [];
    const d = {
      tabelAda: async () => true,
      kolomAda: async () => true,
      kueriSipp: async (s: string) => {
        sql.push(s);
        if (/FROM perkara WHERE/.test(s)) return [{ perkara_id: 9729, nomor_perkara: NOMOR, jenis_perkara_nama: "Kewarisan", alur_perkara_id: 15, tanggal_daftar: "2026-04-20" }];
        if (/FROM perkara_jadwal_sidang/.test(s)) return [{ id: 20029, urutan: 8, tanggal: "2026-09-16" }, { id: 19001, urutan: 1, tanggal: "2026-05-13" }];
        if (/FROM perkara_penetapan WHERE/.test(s)) return [{ pmh: "2026-05-25", phs: "2026-07-16", sidang_pertama: "2026-07-29" }];
        if (/MIN\(tanggal_penetapan\)/.test(s)) return [{ pmh: "2026-04-27", ppp: "2026-04-27", pjs: "2026-04-27", phs: "2026-04-27" }];
        if (/FROM perkara_putusan_pemberitahuan_putusan/.test(s)) return [{ pihak: 2, tanggal: "2026-10-01" }];
        if (/FROM perkara_putusan /.test(s)) return [{ tanggal: "2026-09-20", verstek: "Y", ada_edoc: 1, ada_anonim: 1 }];
        if (/FROM perkara_pihak5/.test(s)) return [{ id: 17459, sisi: 1 }];
        if (/FROM perkara_keterangan_saksi/.test(s)) return [{ n: 0 }];
        return [];
      },
      kueriAbt: async (s: string) => (sql.push(s), /abt_keterangan_saksi/.test(s) ? [{ sidang_id: 20029, n: 35, saksi: 2, saksi_id: "17459,17592" }] : []),
      kueriBot: async (s: string) => (sql.push(s), []),
    };
    const h = await layanan.buatLayanan(d).ringkas({ nomorPerkara: NOMOR });
    expect(h.sipp.penetapan).toMatchObject({ sidangPertama: "2026-05-13", sidangPertamaPenetapan: "2026-07-29", awal: { pmh: "2026-04-27", phs: "2026-04-27" } });
    expect(h.sipp.putusan).toMatchObject({ verstek: true });
    expect(h.sipp.pemberitahuan).toEqual({ pihak1: "", pihak2: "2026-10-01" });
    expect(h.sipp.saksi).toEqual({ daftar: [{ id: 17459, sisi: 1 }], keterangan: 0 });
    expect(h.abt.saksi[0].saksiId).toEqual([17459, 17592]);
    expect(h.galat).toEqual([]);
    for (const s of sql) expect(s.trim(), s.slice(0, 60)).toMatch(/^SELECT\b/i);
  });
});

describe("C. keterangan saksi ABT vs daftar saksi SIPP", () => {
  it("saksi ABT terdaftar di SIPP (273/G, 611/G): tidak ada selisih; SIPP tanpa tanya-jawab saksi hanya disebut di rincian BAS", () => {
    const h = susun(fakta());
    expect(h.selisih.filter((x) => x.kode.startsWith("saksi"))).toEqual([]);
    expect(h.blangko.find((b) => b.jenis === "bas")!.rincian.join(" ")).toContain("tanya-jawab saksi tidak disimpan di SIPP");
  });

  it("SIPP mencatat 0 saksi: kuning dengan penjelasan + tombol Data Umum dan ABT", () => {
    const h = susun(fakta((f) => (f.sipp.saksi = { daftar: [], keterangan: 0 })));
    const x = h.selisih.find((s) => s.kode === "saksi-sipp-kosong")!;
    expect(x).toMatchObject({ tingkat: "kuning", judul: "Keterangan saksi ada di ABT, SIPP mencatat 0 saksi" });
    expect(x.nilai).toEqual({ abt: "keterangan 2 saksi (35 tanya-jawab)", sipp: "0 saksi di daftar saksi perkara" });
    expect(x.penjelasan).toContain("Saksi Yang Dihadirkan");
    expect(x.perbaiki.map((t) => t.label)).toEqual(["Buka tab Data Umum", "Buka di ABT"]);
  });

  it("saksi ABT yang tidak ada di daftar SIPP: kuning, tombol tab Saksi; sidang perkara lain diabaikan; SIPP tak terbaca = diam", () => {
    const h = susun(fakta((f) => (f.sipp.saksi = { daftar: [{ id: 17459, sisi: 1 }], keterangan: 0 })));
    const x = h.selisih.find((s) => s.kode === "saksi-tak-terdaftar")!;
    expect(x.judul).toBe("Keterangan 1 saksi di ABT tidak cocok dengan daftar saksi SIPP");
    expect(x.perbaiki[0]).toMatchObject({ jenis: "tab", tab: "tabs23" });
    const lain = susun(fakta((f) => ((f.sipp.saksi = { daftar: [], keterangan: 0 }), (f.abt.saksi = [{ sidangId: 1, tanyaJawab: 5, saksi: 1, saksiId: [9], terakhir: "" }]))));
    expect(lain.selisih.some((s) => s.kode.startsWith("saksi-"))).toBe(false);
    const takTerbaca = susun(fakta((f) => (f.sipp.saksi = null)));
    expect(takTerbaca.selisih.some((s) => s.kode.startsWith("saksi-"))).toBe(false);
  });
});

describe("D. tugas juru sita: pemberitahuan putusan verstek (BHT = pemberitahuan + 15 hari)", () => {
  const verstek = (pbt: string, tanggal = "2026-10-15", bht = "") =>
    fakta((f) => {
      f.perkara.jenisPerkara = "Cerai Gugat";
      f.sipp.putusan = { ada: true, tanggal, statusNama: "Dikabulkan", verstek: true, adaEdoc: true, adaAnonim: true, minutasi: tanggal, bht };
      f.sipp.pemberitahuan = { pihak1: "", pihak2: pbt };
    });

  it("611/G verstek 15 Okt belum diberitahukan: tugas juru sita perkara itu (tab Putusan), sama dengan 'Menunggu pemberitahuan' L2", () => {
    const h = susun(verstek(""));
    const t = h.tugas.find((x) => x.kode === "pemberitahuan-verstek")!;
    expect(t).toMatchObject({ peran: "jurusita", untukAnda: true, judul: "Pemberitahuan putusan verstek" });
    expect(t.sebab).toContain("belum tercatat diberitahukan kepada Tergugat");
    expect(t.tempat).toEqual([{ jenis: "tab", tab: "tabs10", label: "Buka tab Putusan" }]);
    // >= 14 hari: judul menyebut lamanya (L2: "Belum diberitahukan (n hari)").
    expect(susun(verstek("", "2026-09-30")).tugas.find((x) => x.kode === "pemberitahuan-verstek")!.judul).toBe("Pemberitahuan putusan verstek (sudah 17 hari)");
  });

  it("sudah diberitahukan: tidak ada tugas; rincian menyebut tenggang verzet dan BHT = pemberitahuan + 15", () => {
    const h = susun(verstek("2026-10-01", "2026-09-20"));
    expect(h.tugas.some((x) => x.kode === "pemberitahuan-verstek")).toBe(false);
    const r = h.blangko.find((b) => b.jenis === "putusan")!.rincian.join(" ");
    expect(r).toContain("diberitahukan kepada Tergugat 1 Oktober 2026");
    expect(r).toContain("berakhir 15 Oktober 2026");
    expect(r).toContain("BHT jatuh 16 Oktober 2026");
  });

  it("bukan verstek, sudah BHT, atau bot lama tanpa data pemberitahuan: tidak ada tugas", () => {
    expect(susun(fakta((f) => (f.sipp.putusan = { ada: true, tanggal: "2026-10-15", statusNama: "", verstek: false, adaEdoc: true, adaAnonim: true, minutasi: "", bht: "" }))).tugas.some((x) => x.kode === "pemberitahuan-verstek")).toBe(false);
    expect(susun(verstek("", "2026-09-01", "2026-09-30")).tugas.some((x) => x.kode === "pemberitahuan-verstek")).toBe(false);
    const lama = verstek("");
    delete lama.sipp.pemberitahuan;
    expect(susun(lama).tugas.some((x) => x.kode === "pemberitahuan-verstek")).toBe(false);
  });
});

describe("E. pemantau putusan e-Court: data yang dibaca sebelum putus didahulukan", () => {
  const pantau = muatBot<{ pilihCalon: (o: unknown) => string[] }>("services/ecourtPantauPutusanService.js");
  it("611/G (dibaca 15 Okt 08.09, putus 15 Okt) mendahului perkara yang tinggal menunggu TTE dan yang lebih lama diperiksa", () => {
    const n = (x: number) => `${x}/Pdt.G/2026/PA.Dgl`;
    const calon = pantau.pilihCalon({
      putus: [
        { nomor: n(588), tanggal: "2026-10-15" },
        { nomor: n(538), tanggal: "2026-09-22" },
        { nomor: n(611), tanggal: "2026-10-15" },
        { nomor: n(700), tanggal: "2026-10-16" },
        n(1),
      ],
      dikenalEcourt: new Set([n(588), n(538), n(611), n(700), n(1)]),
      catatan: {
        // Dibaca ulang 16 Okt 16.00 WITA (sesudah putus): tinggal TTE.
        [n(588)]: { adaBaris: true, dokumenAda: true, paniteraTte: false, diperiksaPada: "2026-10-16T08:00:00Z" },
        [n(538)]: { adaBaris: false, dokumenAda: false, paniteraTte: false, diperiksaPada: "2026-10-14T00:00:00Z" },
        [n(611)]: { adaBaris: false, dokumenAda: false, paniteraTte: false, diperiksaPada: "2026-10-15T00:09:15Z" },
        [n(1)]: { adaBaris: true, dokumenAda: true, paniteraTte: false, diperiksaPada: "2026-09-01T00:00:00Z" },
      },
      sekarang: Date.parse("2026-10-17T02:00:00Z"),
      jedaUlangJam: 12,
    });
    // 700 belum pernah, 611 basi (tingkat 0) -> 538 belum ada baris -> 1 lalu 588 tinggal TTE.
    expect(calon).toEqual([n(700), n(611), n(538), n(1), n(588)]);
  });
});

describe("B. jembatan e-Court: persetujuan pihak", () => {
  const scraper = muatBot<Record<string, any>>("tools/ecourt-bridge/scraper.js");
  const JUDUL = "<h4>Persetujuan Pihak Menggunakan Saluran Elektronik</h4>";
  it("bentuk 5 sel lama tetap terbaca sama; bentuk 3-4 sel dibaca longgar (nama ber-kedudukan, ikon di mana pun)", () => {
    const lima = `${JUDUL}<table><tr><th>No</th></tr><tr><td>1</td><td>Bida binti Pakalibu (Penggugat)</td><td>-</td><td>bida@contoh.id Telp : 0812 3456 789</td><td><i class="fa fa-check-circle"></i></td></tr></table>`;
    expect(scraper.extractPersetujuanPihak(lima)).toEqual([{ nama: "Bida binti Pakalibu", peran: "Penggugat", email: "bida@contoh.id", telp: "0812 3456 789", persetujuan: "setuju" }]);
    const tiga = `${JUDUL}<table><tr><td>1</td><td>Ali bin Abu (Tergugat)</td><td>ali@contoh.id <i class="fa fa-times-circle"></i></td></tr><tr><td>-</td><td>tanpa kedudukan</td><td>x</td></tr></table>`;
    expect(scraper.extractPersetujuanPihak(tiga)).toEqual([{ nama: "Ali bin Abu", peran: "Tergugat", email: "ali@contoh.id", telp: "", persetujuan: "tidak_setuju" }]);
  });

  it("diagnosa: judul, jumlah baris & sel, id tab - tanpa isi halaman", () => {
    const d = scraper.diagnosaPihakElektronik(`<div class="tab-pane" id="detil_pihak">${JUDUL}<table><tr><td>1</td><td>A (Penggugat)</td><td>a@b.id</td></tr></table></div><div class="tab-pane active" id="detil_putusan"></div>`);
    expect(d).toEqual({ persetujuan: { judul: true, baris: 1, sel: [3] }, panggilan: { judul: false, baris: 0, sel: [] }, adaKataSummons: false, adaKataPersetujuan: true, tab: ["detil_pihak", "detil_putusan"] });
    expect(JSON.stringify(d)).not.toContain("a@b.id");
  });
});

describe("4. Blangko Derry: teks kosong bukan 'terisi' di layar", () => {
  it("#9272# (kueri memulangkan '') -> kosong beserta sebab; yang berisi, galat, dan tanya-jawab dibiarkan", () => {
    expect(statusNilaiLayar({ status: "terisi", teks: "  ", nama: "SATKER: NOMOR TELEPON", sebab: "" }, false)).toEqual({
      status: "kosong",
      teks: "  ",
      nama: "SATKER: NOMOR TELEPON",
      sebab: "Kueri ABT tidak memulangkan isi untuk perkara ini (ABT mencetaknya kosong).",
    });
    const isi = { status: "terisi", teks: "0457-123", nama: "", sebab: "" };
    expect(statusNilaiLayar(isi, false)).toBe(isi);
    const tj = { status: "terisi", teks: "", nama: "", sebab: "" };
    expect(statusNilaiLayar(tj, true)).toBe(tj);
    const galat = { status: "galat", teks: "", nama: "", sebab: "x" };
    expect(statusNilaiLayar(galat, false)).toBe(galat);
  });

  it("rute memakainya sesudah nilai dibaca dari bot (mesin bot tidak diubah - tetap meniru ABT)", () => {
    const rute = readFileSync(path.join(AKAR, "manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/route.ts"), "utf8");
    expect(rute).toMatch(/nilai = await nilaiPenanda\([^)]*\);\s*\/\/[^\n]*\n\s*const tj = [^\n]*\n\s*for \(const \[k, v\] of Object\.entries\(nilai\.nilai\)\) nilai\.nilai\[k\] = statusNilaiLayar\(v, tj\.has\(k\)\);/);
  });
});

describe("5. folder 99 PTSP mengikuti hak menu ABT", () => {
  const src = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry.js"), "utf8");
  const ctx: Record<string, unknown> = { location: { pathname: "/" }, console, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const m = (ctx.aletaBlangkoDerry as { murni: Record<string, any> }).murni;
  // abt_menu 991 di server 17 Okt.
  const folder = [{ id: 991, nama: "Form Bantu PTSP", namaAlias: "Form PTSP", user_grup_id: "30|500|430|1000|1010|1020|1032|1001|1011", user_top_id: "1|10|30" }];
  const k = { nama: "Form PTSP", jenis: "ptsp" };

  it("akun biasa: menunya sudah disaring ABT -> tampil (sebelumnya selalu tersembunyi bagi non-admin)", () => {
    for (const peran of [["pp"], ["hakim"], []]) expect(m.kelompokBoleh(k, { admin: false, sebagaiPeran: "", peran, hak: null })).toBe(true);
  });

  it("Super Admin 'Lihat sebagai': PP, PTSP, Ketua/Wakil (ikut hakim) boleh; juru sita tidak - sama dengan menu_cek ABT", () => {
    const boleh = (p: string) => m.kelompokBoleh(k, { admin: true, sebagaiPeran: p, peran: [], hak: { saklar: {}, folder } });
    expect(["pp", "ptsp", "hakim", "js"].map(boleh)).toEqual([true, true, true, false]);
    expect(m.kelompokBoleh(k, { admin: true, sebagaiPeran: "", peran: [], hak: null })).toBe(true);
    // Putusan/BAS/relaas tidak berubah.
    expect(m.jenisDokumenBoleh({ admin: true, sebagaiPeran: "pp", peran: [], hak: null })).toEqual(["bas"]);
  });
});

describe("6. kesiapan: sidangId milik perkara lain", () => {
  const k = muatBot<{ sidangSahUntukPerkara: (j: unknown, id: unknown, t: unknown) => { sidangId: number; diabaikan: boolean } }>("services/kesiapanSidangService.js");
  const jadwal = [
    { sidangId: 20271, tanggalSidang: "2026-10-08" },
    { sidangId: 20272, tanggalSidang: "2026-10-15" },
  ];
  it("milik perkara ini dipakai; milik perkara lain diganti sidang perkara ini pada tanggal yang sama, bila tidak ada diabaikan", () => {
    expect(k.sidangSahUntukPerkara(jadwal, 20272, "2026-10-15")).toEqual({ sidangId: 20272, diabaikan: false });
    expect(k.sidangSahUntukPerkara(jadwal, 99999, "2026-10-15")).toEqual({ sidangId: 20272, diabaikan: true });
    expect(k.sidangSahUntukPerkara(jadwal, 99999, "2026-11-01")).toEqual({ sidangId: 0, diabaikan: true });
    // Jadwal tidak terbaca ([] cadangan rincianSidang): tidak dapat diperiksa, dipakai apa adanya.
    expect(k.sidangSahUntukPerkara([], 99999, "")).toEqual({ sidangId: 99999, diabaikan: false });
  });

  it("nilaiKesiapanPerkara memakai sidang yang sah, bukan sidangId mentah", () => {
    const sumber = readFileSync(path.join(AKAR, "aleta_bot/services/kesiapanSidangService.js"), "utf8");
    const i = sumber.indexOf("async function nilaiKesiapanPerkara");
    const badan = sumber.slice(i, sumber.indexOf("\n}\n", i));
    expect(badan.indexOf("sidangSahUntukPerkara(rincian.jadwalPerkara, sidangId, tanggalSidang)")).toBeGreaterThan(-1);
    expect(badan.indexOf("sidangSahUntukPerkara(")).toBeLessThan(badan.indexOf("keadaanPanggilanSidang("));
  });
});
