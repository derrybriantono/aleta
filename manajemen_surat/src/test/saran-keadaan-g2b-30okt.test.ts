// @vitest-environment node
/**
 * G2B 2.2 (30 Okt 2026) - saran blangko menurut KEADAAN perkara (lib/saran-keadaan-perkara.ts, lib/sandi-kehadiran.ts):
 *   - verstek bila amar SIPP menyebut verstek / Tergugat tidak pernah hadir (sandi identik paket relaas-penetapan-30okt), dengan alasannya;
 *   - sandi kehadiran 8, 9, 11, 15 = Tergugat hadir (portal, bot, centang Verstek form Putus);
 *   - itsbat satu Pemohon, kuasa insidentil tidak sah, prodeo, relaas kuasa / e-Court;
 *   - varian "(N Saksi)" BAS bernomor berhuruf di ekstensi (pilihVarianSaksi dijalankan sungguhan di jsdom).
 * Arah sebaliknya selalu diuji (keadaan yang TIDAK memenuhi syarat tidak mengubah saran).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { masukanRekomendasiDariBaris, rekomendasiBlangko, type MasukanRekomendasi } from "@/lib/rekomendasi-blangko";
import { SANDI_PENGGUGAT_HADIR, SANDI_TERGUGAT_HADIR, tergugatHadirSandi } from "@/lib/sandi-kehadiran";
import { sebabVerstek, sisiRelaas } from "@/lib/saran-keadaan-perkara";
import { verstekBawaan } from "@/lib/verstek-bawaan";

const require_ = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));

const CG: MasukanRekomendasi = { jenisPerkara: "Cerai Gugat", nomorPerkara: "610/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, mediasi: null, mediasiTerbaca: true };
const utamaPutusan = (m: MasukanRekomendasi) => rekomendasiBlangko(m).putusan.find((x) => x.utama);

describe("sandi kehadiran satu sumber", () => {
  it("portal = bot, dan Tergugat hadir mencakup 8, 9, 11, 15 (bukan 2, 4, 5, 7, 10, 13, 14)", () => {
    const bot = require_("../services/sandiKehadiranService.js");
    expect([...bot.SANDI_TERGUGAT_HADIR]).toEqual([...SANDI_TERGUGAT_HADIR]);
    expect([...bot.SANDI_PENGGUGAT_HADIR]).toEqual([...SANDI_PENGGUGAT_HADIR]);
    for (const n of [1, 3, 8, 9, 11, 15]) expect(tergugatHadirSandi(n)).toBe(true);
    for (const n of [2, 4, 5, 7, 10, 13, 14, null, undefined, ""]) expect(tergugatHadirSandi(n)).toBe(false);
  });

  it("bot kehadiranSebelumnya: Tergugat hadir bersama intervensi (9) / turut tergugat (15) = pernah hadir", () => {
    const { kehadiranSebelumnya } = require_("../services/sippJadwalSidangService.js");
    const sidang = (perkaraId: number, sidangId: number, dihadiriOleh: number | null) => ({ perkaraId, sidangId, dihadiriOleh });
    const h = kehadiranSebelumnya([sidang(1, 11, 9), sidang(1, 12, 2), sidang(2, 21, 15), sidang(2, 22, 2), sidang(3, 31, 2), sidang(3, 32, 2)]);
    expect(h.tergugatPernahHadir["12"]).toBe(true);
    expect(h.tergugatPernahHadir["22"]).toBe(true);
    expect(h.tergugatPernahHadir["32"]).toBe(false);
    expect(h.penggugatPernahHadir["12"]).toBe(true); // 9 = P + T
  });

  it("centang Verstek bawaan form Putus: Tergugat yang hadir bersama turut tergugat (15) bukan verstek", () => {
    const riwayat = [{ jadwalId: 1, dihadiriOleh: 15 }, { jadwalId: 2, dihadiriOleh: 2 }] as never;
    expect(verstekBawaan({ gugatan: true, riwayat, jadwalIdSekarang: 2, dihadiriHariIni: 2, namaStatus: "Dikabulkan" })).toBe(false);
    const riwayat2 = [{ jadwalId: 1, dihadiriOleh: 2 }, { jadwalId: 2, dihadiriOleh: 2 }] as never;
    expect(verstekBawaan({ gugatan: true, riwayat: riwayat2, jadwalIdSekarang: 2, dihadiriHariIni: 2, namaStatus: "Dikabulkan" })).toBe(true);
  });
});

describe("verstek menurut keadaan perkara", () => {
  it("sidang ke-3 akan memutus, Tergugat tidak pernah hadir, kehadiran sidang ini belum tercatat: blangko verstek + alasan", () => {
    const r = utamaPutusan({ ...CG, urutanSidang: 3, agenda: "pembacaan putusan", tergugatPernahHadir: false, penggugatPernahHadir: true, dihadiriOleh: null });
    expect(r?.berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    expect(r?.alasan).toContain("karena Tergugat tidak pernah hadir");
  });

  it("arah sebaliknya: Tergugat pernah hadir / kehadiran sebelumnya tidak tercatat / ada mediasi / sidang pertama = tidak dipaksa verstek", () => {
    const dasar = { ...CG, urutanSidang: 3, agenda: "pembacaan putusan", dihadiriOleh: null };
    expect(utamaPutusan({ ...dasar, tergugatPernahHadir: true, penggugatPernahHadir: true })?.berkas).not.toMatch(/Verstek/);
    expect(utamaPutusan({ ...dasar, tergugatPernahHadir: false, penggugatPernahHadir: null })?.berkas).not.toMatch(/Verstek/);
    expect(utamaPutusan({ ...dasar, tergugatPernahHadir: false, penggugatPernahHadir: true, mediasi: { hasil: "T" } })?.berkas).not.toMatch(/Verstek/);
    expect(sebabVerstek({ ...dasar, urutanSidang: 1, tergugatPernahHadir: false, penggugatPernahHadir: false }, "pembacaan putusan")).toBeNull();
    // Tergugat hadir hari ini bersama intervensi (9): bukan verstek.
    expect(sebabVerstek({ ...dasar, tergugatPernahHadir: false, penggugatPernahHadir: true, dihadiriOleh: 9 }, "pembacaan putusan")).toBeNull();
    // Permohonan (Pdt.P) tidak pernah verstek.
    expect(sebabVerstek({ jenisPerkara: "Dispensasi Kawin", nomorPerkara: "231/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, urutanSidang: 2, tergugatPernahHadir: false, penggugatPernahHadir: true }, "putusan")).toBeNull();
  });

  it("sudah putus dikabulkan, putusan_verstek bukan Y tetapi amar SIPP menyebut verstek: blangko verstek, PBT ikut verstek", () => {
    const baris = { jenisPerkara: "Cerai Gugat", nomorPerkara: "315/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: false, amarVerstek: true, urutanSidang: 2, dihadiriOleh: 2, panggilan: { tergugatPernahHadir: true, penggugatPernahHadir: true } };
    const m = masukanRekomendasiDariBaris(baris);
    expect(m.amarVerstek).toBe(true);
    const h = rekomendasiBlangko(m);
    const u = h.putusan.find((x) => x.utama);
    expect(u?.berkas).toMatch(/\[Kabul Verstek\]/);
    expect(u?.alasan).toContain("karena amar putusan di SIPP menyebut verstek");
    const tanpa = rekomendasiBlangko(masukanRekomendasiDariBaris({ ...baris, amarVerstek: false })).putusan.find((x) => x.utama);
    expect(tanpa?.berkas).not.toMatch(/Verstek/);
  });

  it("amar verstek tidak mengubah putusan dicabut / tidak dapat diterima", () => {
    for (const statusPutusan of ["Dicabut", "Tidak Dapat Diterima"]) {
      const m = { ...CG, sudahPutus: true, statusPutusan, amarVerstek: true, urutanSidang: 2, dihadiriOleh: 2 };
      expect(sebabVerstek(m, "")).toBeNull();
    }
  });
});

describe("itsbat satu Pemohon, kuasa insidentil, prodeo, relaas", () => {
  const IN = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "260/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, sudahPutus: true, statusPutusan: "Dikabulkan", urutanSidang: 1, dihadiriOleh: 2 };

  it("itsbat voluntair satu Pemohon dikabulkan -> [01e] Satu Pemohon; dua Pemohon -> [01] seperti dulu", () => {
    const satu = rekomendasiBlangko({ ...IN, jumlahPemohon: 1 }).putusan;
    expect(satu[0]).toMatchObject({ berkas: "[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf", utama: true });
    expect(satu[0].alasan).toContain("Pemohonnya satu orang");
    expect(satu.find((x) => x.berkas === "[01] [Kabul] IN.rtf")?.utama).toBe(false);
    expect(rekomendasiBlangko({ ...IN, jumlahPemohon: 2 }).putusan[0].berkas).toBe("[01] [Kabul] IN.rtf");
    // Ditolak tetap blangko tolak.
    expect(rekomendasiBlangko({ ...IN, jumlahPemohon: 1, statusPutusan: "Ditolak" }).putusan[0].berkas).not.toContain("Satu Pemohon");
  });

  it("keterangan 'kuasa insidentil tidak sah': BAS KUASA INSIDENTIL menurut kehadiran Tergugat; NO -> [98] NO 4b", () => {
    const ket = "kuasa insidentil tidak sah, Penggugat hadir sendiri";
    const tTidak = rekomendasiBlangko({ ...CG, urutanSidang: 1, alasanDitunda: ket, dihadiriOleh: 2, tergugatPernahHadir: false, penggugatPernahHadir: false });
    expect(tTidak.bas[0].berkas).toBe("BAS KUASA INSIDENTIL - Sidang 1 P Hadir Sendiri Menandatangani Gugatan dari Kuasa Tidak Sah & T Tidak Hadir - Tunda Panggil T.rtf");
    expect(tTidak.bas.filter((x) => x.utama)).toHaveLength(1);
    const tHadir = rekomendasiBlangko({ ...CG, urutanSidang: 1, alasanDitunda: ket, dihadiriOleh: 1 });
    expect(tHadir.bas[0].berkas).toContain("& T Hadir - Mediasi");
    const ct = rekomendasiBlangko({ ...CG, jenisPerkara: "Cerai Talak", jenisPerkaraId: 346, urutanSidang: 1, alasanDitunda: ket, dihadiriOleh: 2 });
    expect(ct.bas[0].folder).toBe("derry_briantono/1a Perceraian CT - BAS");
    expect(ct.bas[0].berkas).toContain("Menandatangani Permohonan dari Kuasa Tidak Sah");
    const no = rekomendasiBlangko({ ...CG, sudahPutus: true, statusPutusan: "Tidak Dapat Diterima", urutanSidang: 2, alasanDitunda: ket, dihadiriOleh: 2 });
    expect(no.putusan[0].berkas).toBe("[98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah.rtf");
    // Tanpa kata itu: saran lama.
    const biasa = rekomendasiBlangko({ ...CG, urutanSidang: 1, alasanDitunda: "Tergugat tidak hadir, panggil lagi", dihadiriOleh: 2 });
    expect(biasa.bas[0].berkas).not.toContain("KUASA INSIDENTIL");
  });

  it("prodeo: alasan putusan menyebut DIPA; bukan prodeo: tidak", () => {
    const m = { ...CG, sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true, urutanSidang: 2, dihadiriOleh: 2 };
    expect(utamaPutusan({ ...m, prodeo: true })?.alasan).toContain("DIPA");
    expect(utamaPutusan(m)?.alasan).not.toContain("DIPA");
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", penandaPerkara: { ghaib: false, prodeo: true } }).prodeo).toBe(true);
  });

  it("relaas pemberitahuan kepada pihak berkuasa / e-Court membawa alasannya; sisi relaas dikenali dari nama berkas", () => {
    const m = { ...CG, sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true, urutanSidang: 2, dihadiriOleh: 2 };
    const kuasaT = rekomendasiBlangko({ ...m, kuasaPihak2: true }).relaas;
    expect(kuasaT.find((x) => /Pemberitahuan Putusan T/.test(x.berkas))?.alasan).toContain("kuasanya");
    const kuasaP = rekomendasiBlangko({ ...m, kuasaPihak1: true }).relaas;
    expect(kuasaP.find((x) => /Pemberitahuan Putusan T/.test(x.berkas))?.alasan).not.toContain("kuasanya");
    expect(sisiRelaas("[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf")).toBe("T");
    expect(sisiRelaas("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf")).toBe("P");
    expect(sisiRelaas("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf")).toBe("PT");
    expect(sisiRelaas("[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf")).toBe("");
  });

  it("saksi tiap sisi diteruskan ke ekstensi (saksiP / saksiT)", () => {
    const m = masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat", urutanSidang: 2, saksiPihak1: 3, saksiPihak2: 2 });
    const h = rekomendasiBlangko(m);
    expect(h.saksiP).toBe(3);
    expect(h.saksiT).toBe(2);
  });
});

describe("ekstensi: varian (N Saksi) BAS bernomor berhuruf (blangko-derry-isian.js sungguhan)", () => {
  const E = path.resolve(process.cwd(), "../ekstensi-sipp");
  const baca = (b: string) => readFileSync(path.join(E, b), "utf8");
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/beranda", runScripts: "outside-only" });
  const w = dom.window as never as Record<string, any>;
  w.chrome = { runtime: { id: "uji", getManifest: () => ({ version: "1" }), getURL: (x: string) => x, sendMessage: () => undefined }, storage: { local: { get: async () => ({}), set: async () => undefined }, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: () => undefined } } };
  w.fetch = async () => new w.Response("{}", { status: 404 });
  w.eval(["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-isian.js"].map(baca).join("\n;\n"));
  afterAll(() => dom.window.close());
  const pilih = (berkas: string, daftar: string[], n: number) => w.aletaBlangkoDerryIsian.murni.pilihVarianSaksi(berkas, daftar, n);
  const ALUR02 = [
    "BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
    "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf",
    "BAS ALUR 02 [2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf",
    "BAS ALUR 02 [2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf",
    "BAS ALUR 02 [2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf",
    "BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf",
    "BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf",
    "BAS ALUR 04 [6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi).rtf",
    "BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf",
    "BAS ALUR 04 [7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi).rtf",
  ];
  const DUA = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";

  it("3/4/5 saksi -> [2a]/[2b]/[2c]; 2 saksi atau tidak diketahui -> [2]", () => {
    expect(pilih(DUA, ALUR02, 3)).toBe("BAS ALUR 02 [2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi)");
    expect(pilih(DUA, ALUR02, 5)).toBe("BAS ALUR 02 [2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi)");
    expect(pilih(DUA, ALUR02, 9)).toBe("BAS ALUR 02 [2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi)");
    expect(pilih(DUA, ALUR02, 2)).toBe(DUA);
    expect(pilih(DUA, ALUR02, 0)).toBe(DUA);
  });

  it("pembuktian tanpa akhiran saksi: [6] -> [6a]/[6b]; 5 saksi tanpa [6c] -> yang terbesar [6b]; [7] tidak tertukar dengan [6]", () => {
    expect(pilih("BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P", ALUR02, 3)).toBe("BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi)");
    expect(pilih("BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P", ALUR02, 5)).toBe("BAS ALUR 04 [6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi)");
    expect(pilih("BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T", ALUR02, 3)).toBe("BAS ALUR 04 [7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi)");
    expect(pilih("BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T", ALUR02, 4)).toBe("BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T");
  });

  it("putusan tetap seperti dulu (nama persis lebih dulu)", () => {
    const dasar = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
    const daftar = [dasar, `${dasar} - (3 Saksi)`, `${dasar} - (4 Saksi)`, "[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)"];
    expect(pilih(dasar, daftar, 4)).toBe(`${dasar} - (4 Saksi)`);
    expect(pilih("[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)", daftar, 4)).toBe("[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)");
  });
});

// ─── 2.3: daftar bukti e-Court sebelum bawaan hitungan ABT (siapkanBukti dijalankan sungguhan) ───────────────────────────────
describe("2.3 bukti e-Court: urutan sumber daftar bukti saat blangko dibuka", () => {
  const sumber = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
  const awal = sumber.indexOf("  async function siapkanBukti() {");
  const akhir = sumber.indexOf("  /** Butir bukti elektronik satu pihak (dibuat bila belum ada). */");
  const kode = sumber.slice(awal, akhir);
  type Opsi = { abtTersimpan?: string; bawaanAbt?: string; ecourt?: string[] | null };
  async function jalan(o: Opsi) {
    const tulis: string[] = [];
    let tanyaEcourt = 0;
    let tanyaBawaan = 0;
    const S: Record<string, any> = { susunan: { isian: [{ khusus: "bukti", pihak: "P", kode: "1214" }] }, nilai: o.abtTersimpan ? { "1214": { status: "terisi", teks: o.abtTersimpan } } : {}, bukti: {}, buktiEl: {}, buktiBawaan: {}, buktiAbt: {}, buktiAbtJam: {} };
    const uraiBukti = (t: string) => String(t).split("\n").filter(Boolean).map((nm) => ({ nm, manual: null }));
    const f = new Function(
      "S", "bacaPenyimpanan", "perkaraId", "susunTeksBukti", "sebutan", "pisahBuktiElektronik", "uraiBukti", "butirElDariTeks", "klienAbt", "sidangUrutan", "barisBuktiEcourt", "buktiBaru", "POLA_BUKTI_BERNOMOR", "buangNomorAwal", "bolehTulis", "tes", "teksBuktiAbt", "rapiBukti", "normalAbt", "renderIsian", "laporKeKerangka", "tulisBuktiKeAbt",
      `${kode}\nreturn siapkanBukti;`
    )(
      S, async () => ({}), () => "77", () => "", () => ({ P: "Penggugat", T: "Tergugat" }), (t: string) => ({ surat: t, el: [] }), uraiBukti, () => null,
      () => ({ bacaIsian: async () => { tanyaBawaan += 1; return { ok: true, nilai: o.bawaanAbt ?? "" }; } }),
      () => 1,
      async () => { tanyaEcourt += 1; return o.ecourt ? o.ecourt.map((nm) => ({ nm, manual: null })) : null; },
      (nm: string) => ({ nm, manual: null }), /^\s*\d+\./, (x: string) => String(x || ""), () => true, () => false,
      (w: string) => (S.bukti[w] || []).map((r: { nm: string }) => r.nm).join("\n"), (t: string) => String(t || "").trim(), (t: string) => ({ teks: t }), () => undefined, () => undefined,
      async (w: string) => { tulis.push(w); }
    );
    await f();
    return { S, tulis, tanyaEcourt, tanyaBawaan };
  }

  it("ABT belum menyimpan bukti, bawaan ABT berisi, daftar e-Court rapi: daftar e-Court dipakai dan langsung ditulis ke ABT", async () => {
    const h = await jalan({ bawaanAbt: "Fotokopi KTP-el atas nama Penggugat", ecourt: ["Fotokopi KTP atas nama Rahmi", "Fotokopi Kutipan Akta Nikah Nomor 123"] });
    expect(h.S.bukti.P.map((r: { nm: string }) => r.nm)).toEqual(["Fotokopi KTP atas nama Rahmi", "Fotokopi Kutipan Akta Nikah Nomor 123"]);
    expect(h.tanyaBawaan).toBe(0);
    expect(h.tulis).toEqual(["P"]);
  });

  it("tanpa daftar e-Court: bawaan ABT seperti dulu; bukti yang sudah tersimpan di ABT tidak pernah diganti e-Court", async () => {
    const bawaan = await jalan({ bawaanAbt: "Fotokopi KTP-el atas nama Penggugat", ecourt: null });
    expect(bawaan.S.bukti.P.map((r: { nm: string }) => r.nm)).toEqual(["Fotokopi KTP-el atas nama Penggugat"]);
    const tersimpan = await jalan({ abtTersimpan: "Fotokopi surat yang diketik petugas", ecourt: ["Fotokopi KTP atas nama Rahmi"] });
    expect(tersimpan.tanyaEcourt).toBe(0);
    expect(tersimpan.S.bukti.P.map((r: { nm: string }) => r.nm)).toEqual(["Fotokopi surat yang diketik petugas"]);
    // (isi ABT yang persis sama dengan daftar boleh ditulis ulang sekali untuk memastikan - bunyinya tetap ketikan petugas)
  });
});
