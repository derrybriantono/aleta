// @vitest-environment jsdom
/**
 * ============================================================================
 * "LANGSUNG TIMPA" TANGGAL KTP (12 Okt 2026, Agen M, keputusan pengguna 1)
 * ============================================================================
 *
 * Bacaan tanggal KTP e-Court berkeyakinan "pasti" yang BERBEDA dari isian petugas menimpanya: tercentang sendiri dan
 * ditulis ke ABT saat Input; kartu menyebut jelas "menimpa isian lama (...)". "cukup" tetap hanya mengisi yang kosong;
 * "ragu" tidak pernah. Berlaku untuk variabel tanggal (0364/0365/0366/2222) DAN bagian tanggal di variabel teks (1214, 9958, ...).
 * Yang dimuat apa adanya dari ekstensi-sipp/abt.js: blok KTP-TEKS/KTP-PIHAK, kartuUsulan, terapkanUsulanBerurutan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Apa = any;
const AKAR = path.resolve(__dirname, "../../..");
const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");

const awalKonst = sumber.indexOf("const A3_VAR_TANGGAL_KTP_P");
const blok = sumber.slice(awalKonst, sumber.indexOf("/**\n * 9 Okt 2026 (KUASA butir 1-4)", awalKonst));
const awalKeadaan = sumber.indexOf("const NILAI_KOSONG");
const keadaanKode = sumber.slice(awalKeadaan, sumber.indexOf("const ALETA_API_ABT", awalKeadaan));
const awalBuat = sumber.indexOf("function buatElemen(");
const buatKode = sumber.slice(awalBuat, sumber.indexOf("\n}\n", awalBuat) + 3);
const awalNada = sumber.indexOf("const NADA_KEYAKINAN = {");
const kartuKode = sumber.slice(awalNada, sumber.indexOf("/* === KAMUS-DB 10 Okt === */", awalNada));
const awalTerap = sumber.indexOf("async function terapkanUsulanBerurutan(");
const terapKode = sumber.slice(awalTerap, sumber.indexOf("NOMOR 8 - PENJAGA SEBELUM CETAK", awalTerap));

const M = new Function(`${keadaanKode}\n${blok}\nreturn { ktpTeksSusun };`)();
const jawab = (isi: Apa) => ({ ok: true, status: 200, json: async () => ({ data: isi }) });
const borang = (teks: string) =>
  `<html><form method="POST"><input type="hidden" name="var_type" value="data_teks">\n<textarea autofocus id="value" name="value" \n\t>${teks}</textarea></form></html>`;

function pasang(sel: Record<string, string>, fetchPalsu: (url: string) => Promise<Apa>, tipe: Record<string, string> = {}) {
  const peta = new Map(Object.entries(sel).map(([k, n]) => [k, { kode: k, nama: `Variabel ${k}`, nilai: n }]));
  const tipeVariabel = new Map<string, string>(Object.entries(tipe));
  const f = new Function(
    "barisVariabel",
    "fetch",
    "a3BolehDiisi",
    "jatiDiriPerkara",
    "asalAbt",
    "muatTipeHalaman",
    "tipeVariabel",
    "a3SebabBukanAbt",
    `${keadaanKode}\n${blok}\nreturn { a3UsulanTanggalKtp };`
  );
  return f(
    () => peta,
    fetchPalsu,
    (k: string) => (tipeVariabel.has(k) ? tipeVariabel.get(k) === "data_teks" || tipeVariabel.get(k) === "data_tanggal" : null),
    () => ({ perkaraId: "9293", perkTemp: "" }),
    () => "http://abt.test/aps_badilag/abt",
    async () => true,
    tipeVariabel,
    () => ""
  );
}

const P_PASTI = { cabang: 1, urutan: 1, peran: "Penggugat", nama: "RIZKA", tanggalKtp: "18/02/2012", yakin: "pasti", cocok: "nik", kota: "Donggala", sebab: "" };
const P_CUKUP = { ...P_PASTI, yakin: "cukup" };
const butirKtp = (tanggal: string) =>
  `1. Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama RIZKA, NIK 7203144107930512 tanggal ${tanggal}, yang dikeluarkan oleh Pemerintah Kabupaten Donggala, diberi tanda P.1;`;
const AKTA = "2. Fotokopi Kutipan Akta Nikah, Nomor 12/34/V/2010 tanggal 5 Mei 2010, yang dikeluarkan oleh KUA Banawa, diberi tanda P.2;";

describe("A. ktpTeksSusun: pasti + pihak kuat + tanggal utuh yang beda = TIMPA (otomatis)", () => {
  it("pasti menimpa tanggal petugas yang beda: otomatis, hanya bagian tanggal berubah, aksi 'timpa' memuat isian lama", () => {
    const t = `${butirKtp("20 Maret 2023")}\n${AKTA}`;
    const s = M.ktpTeksSusun(t, "1214", [P_PASTI]);
    expect(s.otomatis).toBe(true);
    expect(s.perubahan).toEqual([expect.objectContaining({ aksi: "timpa", dari: "20 Maret 2023", ke: "18 Februari 2012", kuat: true })]);
    expect(s.nilai).toBe(t.replace("20 Maret 2023", "18 Februari 2012"));
    expect(s.nilai).toContain("tanggal 5 Mei 2010"); // tanggal akta nikah tidak tersentuh
  });

  it("gaya penulisan petugas tetap dipertahankan saat menimpa (angka dengan strip, ISO)", () => {
    expect(M.ktpTeksSusun(butirKtp("20-03-2023"), "1214", [P_PASTI]).nilai).toContain("tanggal 18-02-2012,");
    expect(M.ktpTeksSusun(butirKtp("2023-03-20"), "1214", [P_PASTI]).nilai).toContain("tanggal 2012-02-18,");
  });

  it("'cukup' TIDAK menimpa: hanya tawaran (tidak otomatis), seperti sebelumnya", () => {
    const s = M.ktpTeksSusun(butirKtp("20 Maret 2023"), "1214", [P_CUKUP]);
    expect(s.otomatis).toBe(false);
    expect(s.perubahan).toEqual([expect.objectContaining({ aksi: "beda", dari: "20 Maret 2023" })]);
  });

  it("'ragu' tidak pernah: teks tidak diubah", () => {
    const s = M.ktpTeksSusun(butirKtp("20 Maret 2023"), "1214", [{ ...P_PASTI, yakin: "ragu" }]);
    expect(s.nilai).toBe("");
    expect(s.otomatis).toBe(false);
  });

  it("pasti tetapi pihak di teks dikenali LEMAH (nama satu kata) = hanya tawaran, tidak menimpa", () => {
    const t = "Fotokopi KTP atas nama Siti, NIK 1 tanggal 20 Maret 2023 yang dikeluarkan oleh X";
    const s = M.ktpTeksSusun(t, "5105", [{ ...P_PASTI, nama: "SITI AMINAH" }]);
    expect(s.otomatis).toBe(false);
    expect(s.perubahan[0]).toMatchObject({ aksi: "beda", kuat: false });
  });

  it("pasti tetapi tulisan petugas RUSAK (salah ketik yang bisa menelan teks lain) = tawaran, tidak menimpa", () => {
    const s = M.ktpTeksSusun("Fotokopi KTP atas nama RIZKA, NIK 1 tanggal 29-092020, yang dikeluarkan", "1214", [P_PASTI]);
    expect(s.otomatis).toBe(false);
    expect(s.perubahan[0]).toMatchObject({ aksi: "beda", dari: "29-092020" });
  });

  it("pasti dan tanggal petugas SAMA = dibiarkan (tidak ada yang berubah)", () => {
    const s = M.ktpTeksSusun(butirKtp("18 Pebruari 2012"), "1214", [P_PASTI]);
    expect(s.nilai).toBe("");
    expect(s.perubahan).toEqual([]);
  });

  it("pasti menimpa DAN mengisi yang kosong dalam satu teks; Pemohon I ditimpa, Pemohon II diisi", () => {
    const t =
      "1. Fotokopi KTP atas nama SITI AMINAH, NIK 1 tanggal 01 Januari 2020 yang dikeluarkan oleh X;\n2. Fotokopi KTP atas nama BUDI SANTOSO, NIK 2 tanggal ... yang dikeluarkan oleh X;";
    const P1 = { cabang: 1, urutan: 1, peran: "Pemohon I", nama: "SITI AMINAH", tanggalKtp: "18/02/2012", yakin: "pasti" };
    const P2 = { cabang: 1, urutan: 2, peran: "Pemohon II", nama: "BUDI SANTOSO", tanggalKtp: "07/09/2014", yakin: "cukup" };
    const s = M.ktpTeksSusun(t, "9958", [P1, P2]);
    expect(s.otomatis).toBe(true);
    expect(s.perubahan.map((x: Apa) => x.aksi).sort()).toEqual(["isi", "timpa"]);
    expect(s.nilai).toContain("tanggal 18 Februari 2012 yang");
    expect(s.nilai).toContain("tanggal 07 September 2014 yang");
  });

  it("idempoten: teks hasil timpa tidak diubah lagi", () => {
    const s1 = M.ktpTeksSusun(butirKtp("20 Maret 2023"), "1214", [P_PASTI]);
    expect(M.ktpTeksSusun(s1.nilai, "1214", [P_PASTI]).nilai).toBe("");
  });
});

describe("B. a3UsulanTanggalKtp: variabel tanggal dan teks", () => {
  const ke = (pihak: Apa[]) => async (url: string) => {
    if (url.includes("/ktp-pihak")) return jawab({ ada: true, pihak, catatan: [] });
    throw new Error(`url tak dikenal ${url}`);
  };

  it("variabel tanggal: pasti + isian petugas BEDA = tercentang sendiri (awal), keyakinan cukup, tingkat pasti, menyebut isian lama", async () => {
    const p = pasang({ "0364": "20 Mei 2020" }, ke([P_PASTI]));
    const u = (await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0];
    expect(u).toMatchObject({ kode: "0364", nilai: "18/02/2012", keyakinan: "cukup", awal: true, tingkat: "pasti" });
    expect(u.timpa).toEqual([{ dari: "20 Mei 2020", ke: "18/02/2012" }]);
    expect(u.ringkas).toContain("menimpa isian lama (20 Mei 2020)");
    expect(u.sumber[0].keterangan).toContain("MENIMPA isian lama 20 Mei 2020");
  });

  it("variabel tanggal: pasti + isian SAMA = tidak ditampilkan; cukup + beda = tidak dicentang (ocr) seperti semula; ragu = tidak dicentang", async () => {
    const sama = pasang({ "0364": "18 Februari 2012" }, ke([P_PASTI]));
    expect((await sama.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan).toEqual([]);
    const cukup = pasang({ "0364": "20 Mei 2020" }, ke([P_CUKUP]));
    const u = (await cukup.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0];
    expect(u).toMatchObject({ keyakinan: "ocr", awal: false });
    expect(u.timpa).toBeUndefined();
    expect(u.tingkat).toBeUndefined();
    const ragu = pasang({ "0364": "20 Mei 2020" }, ke([{ ...P_PASTI, yakin: "ragu", sebab: "hanya_nama_cocok" }]));
    expect((await ragu.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0]).toMatchObject({ keyakinan: "ragu", awal: false });
  });

  it("variabel tanggal KOSONG + pasti tetap isi biasa (tanpa 'timpa')", async () => {
    const p = pasang({ "0364": "..." }, ke([P_PASTI]));
    const u = (await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0];
    expect(u).toMatchObject({ keyakinan: "cukup", awal: true, tingkat: "pasti" });
    expect(u.timpa).toBeUndefined();
  });

  it("variabel teks 1214: usulan menimpa tanggal lama, awal true, memuat `timpa`, ringkasan dan sumber menyebut isian lama", async () => {
    const asli = `${butirKtp("20 Maret 2023")}\n${AKTA}`;
    const p = pasang(
      { "1214": asli.replace(/\s+/g, " ") },
      async (url) => {
        if (url.includes("/ktp-pihak")) return jawab({ ada: true, pihak: [P_PASTI], catatan: [] });
        return { ok: true, status: 200, text: async () => borang(asli) };
      },
      { "1214": "data_teks" }
    );
    const u = (await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0];
    expect(u).toMatchObject({ kode: "1214", keyakinan: "cukup", awal: true });
    expect(u.nilai).toBe(asli.replace("20 Maret 2023", "18 Februari 2012"));
    expect(u.timpa).toEqual([expect.objectContaining({ dari: "20 Maret 2023", ke: "18 Februari 2012" })]);
    expect(u.ringkas).toContain("timpa tanggal KTP");
    expect(u.ringkas).toContain("menimpa isian lama: 20 Maret 2023");
    expect(u.sumber[0].keterangan).toContain("MENIMPA isian lama 20 Maret 2023");
    expect(typeof u.sebelumTulis).toBe("function"); // penjaga isi-berubah-sejak-dibaca tetap berlaku
  });

  it("variabel teks 1214 dengan bacaan CUKUP dan tanggal beda: tetap tawaran (ocr, tidak dicentang), tanpa `timpa`", async () => {
    const asli = butirKtp("20 Maret 2023");
    const p = pasang(
      { "1214": asli },
      async (url) => {
        if (url.includes("/ktp-pihak")) return jawab({ ada: true, pihak: [P_CUKUP], catatan: [] });
        return { ok: true, status: 200, text: async () => borang(asli) };
      },
      { "1214": "data_teks" }
    );
    const u = (await p.a3UsulanTanggalKtp("1/Pdt.G/2026/PA.Dgl")).usulan[0];
    expect(u).toMatchObject({ keyakinan: "ocr", awal: false });
    expect(u.timpa).toBeUndefined();
  });
});

describe("C. kartuUsulan: kartu menyebut jelas 'menimpa isian lama (...)'", () => {
  const K = new Function("document", "suntingLangsungSekarang", "penyegarSunting", "suntingLangsungNyala", `${buatKode}\n${kartuKode}\nreturn { kartuUsulan };`)(
    document,
    async () => true,
    new Set(),
    false
  );
  function kartu(u: Apa, sekarang = "") {
    const pilih: Apa[] = [];
    const el: HTMLElement = K.kartuUsulan(u, sekarang, pilih);
    return { el, pilih, centang: el.querySelector("input.aleta-abt-centang") as HTMLInputElement, lencana: el.querySelector(".aleta-tanda") as HTMLElement };
  }
  const dasar = {
    kode: "0364",
    nama: "Tanggal KTP Penggugat",
    nilai: "18/02/2012",
    keyakinan: "cukup",
    awal: true,
    tingkat: "pasti",
    sumber: [{ asal: "ktp-ecourt", keterangan: "e-Court: KTP Penggugat (RIZKA)" }],
  };

  it("timpa: tercentang, lencana kuning 'menimpa isian lama (20 Mei 2020)', rinciannya di title", () => {
    const k = kartu({ ...dasar, timpa: [{ dari: "20 Mei 2020", ke: "18/02/2012" }] }, "20 Mei 2020");
    expect(k.centang.checked).toBe(true);
    expect(k.lencana.textContent).toBe("menimpa isian lama (20 Mei 2020)");
    expect(k.lencana.className).toContain("aleta-tanda-kuning");
    expect(k.lencana.title).toContain("20 Mei 2020 → 18/02/2012");
    expect(k.pilih[0].nilai()).toBe("18/02/2012");
  });

  it("beberapa bagian ditimpa dalam satu kartu teks: 'menimpa 2 isian lama'", () => {
    const k = kartu({ ...dasar, kode: "9958", timpa: [{ label: "Tanggal KTP Pemohon I", dari: "01 Januari 2020", ke: "18 Februari 2012" }, { label: "Tanggal KTP Pemohon II", dari: "02 Februari 2020", ke: "07 September 2014" }] });
    expect(k.lencana.textContent).toBe("menimpa 2 isian lama");
    expect(k.lencana.title).toContain("Tanggal KTP Pemohon II: 02 Februari 2020 → 07 September 2014");
  });

  it("tanpa `timpa`, lencana tetap hijau 'dari berkas KTP e-Court' (isi kosong); ragu tidak tercentang", () => {
    const k = kartu({ ...dasar, tingkat: undefined }, "(kosong)");
    expect(k.lencana.textContent).toBe("dari berkas KTP e-Court");
    expect(k.centang.checked).toBe(true);
    expect(kartu({ ...dasar, keyakinan: "ragu", awal: false }).centang.checked).toBe(false);
  });

  it("`timpa` pada usulan yang bukan dari KTP e-Court diabaikan (tidak membuat lencana palsu)", () => {
    const k = kartu({ kode: "0222", nama: "x", nilai: "y", keyakinan: "cukup", timpa: [{ dari: "z" }], sumber: [{ asal: "posita", kalimat: "k" }] });
    expect(k.lencana.textContent).toBe("dari posita");
  });
});

describe("D. terapkanUsulanBerurutan: timpa ditulis ke ABT dan tercatat sebagai 'MENIMPA isian lama'", () => {
  function terap(simpan: (k: string, v: string) => Promise<Apa>, riwayat: Apa[]) {
    const f = new Function("barisVariabel", "simpanVariabel", "catatRiwayat", "d2Koreksi", `${terapKode.slice(0, terapKode.lastIndexOf("/**"))}\nreturn terapkanUsulanBerurutan;`);
    return f(() => new Map([["0364", { nilai: "20 Mei 2020", selNilai: { textContent: "" } }]]), simpan, async (r: Apa) => void riwayat.push(r), () => ({}));
  }
  it("nilai e-Court ditulis lewat jalur simpan yang sama; riwayat mencatat isian lama dan caranya", async () => {
    const ditulis: string[] = [];
    const riwayat: Apa[] = [];
    const usulan = {
      kode: "0364",
      nama: "Tanggal KTP Penggugat",
      nilai: "18/02/2012",
      keyakinan: "cukup",
      timpa: [{ dari: "20 Mei 2020", ke: "18/02/2012" }],
      sumber: [{ asal: "ktp-ecourt", keterangan: "x" }],
    };
    const r = await terap(async (k, v) => (ditulis.push(`${k}=${v}`), { ok: true, pesan: "ok" }), riwayat)(
      [{ usulan, centang: { checked: true, disabled: false }, nilai: () => usulan.nilai, disunting: () => false }],
      { perkaraId: "9293", perkTemp: "" },
      () => {}
    );
    expect(r).toMatchObject({ berhasil: 1, gagal: [] });
    expect(ditulis).toEqual(["0364=18/02/2012"]);
    expect(riwayat[0]).toMatchObject({ kode: "0364", sebelum: "20 Mei 2020", sesudah: "18/02/2012" });
    expect(riwayat[0].cara).toContain("MENIMPA isian lama");
  });
});
