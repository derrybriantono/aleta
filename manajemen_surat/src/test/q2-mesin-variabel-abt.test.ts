// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Q2 14 Okt 2026 - MESIN VARIABEL ABT (aleta_bot/services/abtMesinVariabel.js)
 *
 * Naskah ALETA dari Blangko Derry dulu memuat penanda mentah ("#5404# #8562#",
 * "agama #1199#") karena hanya penanda yang ALETA kenal yang diisi. Yang
 * dijaga di sini:
 *
 *   - SEMUA penanda di 222 RTF Blangko Derry punya jalur pengisian di katalog
 *     ABT - kecuali daftar CACAT yang disebut satu per satu (ABT pun mencetak
 *     "..." untuknya); cacat baru langsung merah.
 *   - Mesin tidak pernah mengeluarkan #NNNN# mentah - termasuk penanda yang
 *     terpecah kode RTF (5 di 4 blangko) dan nilai yang memuat penanda lagi.
 *   - Port ABT setia: cleanHtmlTagSpecial, tgl_indo2, Terbilang,
 *     number_format, dan tanya-jawab berbentuk TABEL (pertanyaan kiri,
 *     jawaban kanan) seperti kolom_kode_A4.
 *   - Hanya SELECT yang dijalankan; ABT memanggil CALL reorder - mesin tidak.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const mesinAbt = require_(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js"));

type Var = { n: string; t: string | null; r: string | null; m: string | null; q?: boolean; b?: string[] };
type Fixture = {
  berkas: Array<{ b: string; p: string }>;
  terpecah: Array<{ berkas: string; noVar: string; rtf: string }>;
  variabel: Record<string, Var>;
};
const fixture = JSON.parse(readFileSync(path.join(__dirname, "fixtures/q2-penanda-blangko-derry.json"), "utf8")) as Fixture;

function defDari(noVar: string): Record<string, unknown> | null {
  const v = fixture.variabel[noVar];
  if (!v) return null;
  return {
    no_var: noVar,
    nama: v.n,
    data_type: v.t,
    referensi: v.r,
    multi_sidang: v.m,
    sql_query: v.t === "data_sql" && v.q ? `select "nilai ${noVar}" as data` : "",
    data_tabel: v.t === "data_sipp" && v.q ? "perkara" : "",
    data_kolom: v.t === "data_sipp" && v.q ? "nomor_perkara" : "",
  };
}

/** Penanda tanpa jalur pengisian - cacat blangko/katalog yang SUDAH diketahui (ABT pun mencetak "..."). */
const CACAT_DIKETAHUI: Record<string, string> = {
  "0218": "4 Kebendaan/[00] [E-Court] HB Kabul - tidak ada di katalog",
  "0219": "HB Kabul - tidak ada di katalog",
  "0225": "HB Kabul - tidak ada di katalog",
  "0226": "HB Kabul - tidak ada di katalog",
  "0242": "HB Kabul - tidak ada di katalog",
  "0244": "HB Kabul - tidak ada di katalog",
  "0888": "HB Kabul - tidak ada di katalog",
  "0889": "HB Kabul - tidak ada di katalog",
  "9951": "HB Kabul - tidak ada di katalog",
  "9952": "HB Kabul - tidak ada di katalog",
  "5032": "HB Kabul - Harta bersama/gono-gini, katalog tanpa data_type",
  "1021": "Itsbat [99aa] - Nama Istri Pertama, katalog tanpa data_type",
  "5015": "Itsbat [99aa] Cerai Mati - Tgl meninggal, katalog tanpa data_type",
  "5016": "Itsbat [99aa] Cerai Mati - Sebab meninggal, katalog tanpa data_type",
  "5120": "ALUR 05 [4] - Mengadili/Menetapkan, katalog tanpa data_type",
};

/** Basis data palsu: katalog dari fixture, SELECT apa pun memulangkan satu nilai. */
function basisPalsu(opsi: { tolakTeks?: boolean; tanpaSidang?: boolean } = {}) {
  const katalog = Object.keys(fixture.variabel).map((n) => defDari(n));
  const dijalankan: string[] = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    dijalankan.push(sql);
    if (/FROM \w+\.abt_variabel/.test(sql)) return katalog;
    if (/abt_config/.test(sql)) return [{ value: "A4" }];
    if (/FROM perkara_jadwal_sidang/.test(sql)) {
      if (opsi.tanpaSidang) return [];
      return [
        { id: "11", perkara_id: params[0], tanggal_sidang: "2026-10-01", ruangan: "Ruang Sidang I", jam_sidang: "09:00:00", sampai_jam: null, agenda: "Panggil T", alasan_ditunda: "Memanggil Tergugat", dihadiri_oleh: "2" },
        { id: "12", perkara_id: params[0], tanggal_sidang: "2026-10-15", ruangan: "Ruang Sidang I", jam_sidang: "09:00:00", sampai_jam: null, agenda: "Pembuktian", alasan_ditunda: null, dihadiri_oleh: "2" },
      ];
    }
    if (/from pihak a/.test(sql)) return [{ id: "501", kolom: "saksi_id", tabel: "abt_keterangan_saksi" }];
    if (/abt_keterangan_/.test(sql)) return [{ urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Ya, kenal" }];
    if (/abt_data_(teks|tanggal)/.test(sql)) return opsi.tolakTeks ? [] : [{ data: /tanggal/.test(sql) ? "2026-09-30" : "isian petugas" }];
    return [{ data: "nilai" }];
  };
  return { kueri, dijalankan };
}

describe("Q2 penjaga: seluruh Blangko Derry punya jalur pengisian", () => {
  it("222 RTF, setiap penanda berjalur kecuali cacat yang disebut", () => {
    expect(fixture.berkas.length).toBe(222);
    const tanpaJalur = new Map<string, string[]>();
    let jumlah = 0;
    for (const b of fixture.berkas) {
      for (const n of b.p.split(" ").filter(Boolean)) {
        jumlah += 1;
        if (mesinAbt.jalurPengisian(defDari(n))) continue;
        tanpaJalur.set(n, [...(tanpaJalur.get(n) ?? []), b.b]);
      }
    }
    expect(jumlah).toBeGreaterThan(10000);
    // Cacat BARU (penanda tanpa jalur di luar daftar) harus dibereskan di blangko/katalog,
    // bukan dibiarkan tercetak "...".
    expect([...tanpaJalur.keys()].filter((n) => !CACAT_DIKETAHUI[n]).sort()).toEqual([]);
    // Cacat yang sudah dibereskan dikeluarkan dari daftar.
    expect(Object.keys(CACAT_DIKETAHUI).filter((n) => !tanpaJalur.has(n)).sort()).toEqual([]);
  });

  it("variabel bersarang tanpa jalur diganti kosong di kueri (seperti ABT), induknya tetap terisi", async () => {
    const katalog = [
      { no_var: "7048", nama: "Induk", data_type: "data_sql", sql_query: 'select concat("a", "#5078#", "b") as data' },
      { no_var: "5078", nama: "Tanpa jenis", data_type: null },
    ];
    const dikirim: string[] = [];
    const mesin = mesinAbt.buatMesin({
      kueri: async (sql: string) => {
        dikirim.push(sql);
        if (/abt_variabel/.test(sql)) return katalog;
        return [{ data: "ab" }];
      },
    });
    const h = await mesin.isiRtf("{\\rtf1 #7048#}", { perkaraId: "1" });
    expect(h.kosong).toEqual([]);
    expect(dikirim.some((s) => s.includes('concat("a", "", "b")'))).toBe(true);
  });

  it("kueri yang menyebut dirinya sendiri tidak menggantung", async () => {
    const katalog = [{ no_var: "7000", nama: "Diri", data_type: "data_sql", sql_query: 'select "#7000#" as data' }];
    const mesin = mesinAbt.buatMesin({ kueri: async (sql: string) => (/abt_variabel/.test(sql) ? katalog : [{ data: "x" }]) });
    const h = await mesin.isiRtf("{\\rtf1 #7000#}", { perkaraId: "1" });
    expect(h.rtf).not.toMatch(/#\d{3,5}#/);
    expect(h.kosong.map((k: { noVar: string }) => k.noVar)).toEqual(["7000"]);
  });

  it("mesin mengisi SEMUA penanda tiap blangko - nol penanda mentah, yang kosong bersorot dan disebut", async () => {
    const { kueri, dijalankan } = basisPalsu({ tolakTeks: true });
    const mesin = mesinAbt.buatMesin({ kueri, umurKatalogMs: 600000 });
    let kosongTotal = 0;
    for (const b of fixture.berkas) {
      const penanda = b.p.split(" ").filter(Boolean);
      const rtf = `{\\rtf1{\\colortbl;\\red0\\green0\\blue0;}${penanda.map((n) => `{\\b #${n}#}\\par `).join("")}}`;
      const h = await mesin.isiRtf(rtf, { perkaraId: "10133", sidangKe: 2 });
      expect(h.rtf, b.b).not.toMatch(/#\d{3,5}#/);
      // Isian tangan (abt_data_teks/tanggal) yang belum diisi + cacat = kosong; yang lain terisi.
      for (const k of h.kosong as Array<{ noVar: string }>) {
        const v = fixture.variabel[k.noVar];
        expect(Boolean(CACAT_DIKETAHUI[k.noVar] || v?.t === "data_teks" || v?.t === "data_tanggal" || (v?.b ?? []).length || v?.r), `${b.b} #${k.noVar}#`).toBe(true);
      }
      if (h.kosong.length) expect(h.rtf).toContain("{\\highlight2 ...}");
      kosongTotal += h.kosong.length;
    }
    expect(kosongTotal).toBeGreaterThan(0);
    // Hanya SELECT yang pernah dikirim - tidak ada CALL perkara_jadwal_sidang_reorder seperti ABT.
    for (const sql of dijalankan) expect(mesinAbt.pagarBaca(sql), sql).toBe("");
    expect(dijalankan.some((s) => /\bcall\b/i.test(s))).toBe(false);
  });

  it("penanda yang terpecah kode RTF di blangko sungguhan disatukan lalu terisi", async () => {
    expect(fixture.terpecah.length).toBeGreaterThanOrEqual(4);
    const { kueri } = basisPalsu();
    const mesin = mesinAbt.buatMesin({ kueri });
    for (const t of fixture.terpecah) {
      const satu = mesinAbt.satukanPenandaTerpecah(t.rtf);
      expect(satu.jumlah, t.berkas).toBe(1);
      expect(satu.rtf.startsWith(`#${t.noVar}#`), t.berkas).toBe(true);
      // Kurung grup tetap seimbang.
      const hitung = (s: string, c: string) => s.split(c).length - 1;
      expect(hitung(satu.rtf, "{") - hitung(satu.rtf, "}")).toBe(hitung(t.rtf, "{") - hitung(t.rtf, "}"));
      const h = await mesin.isiRtf(`{\\rtf1 ${t.rtf}}`, { perkaraId: "10133", sidangKe: 2 });
      expect(h.rtf).not.toMatch(/#\d{3,5}#/);
      expect(h.terpecahDisatukan).toBe(1);
    }
  });
});

describe("Q2 port setia ABT", () => {
  it("cleanHtmlTagSpecial: \\par, \\tab, tebal, miring, entitas, titik koma, kutip lengkung", () => {
    const { bersihkanHtmlAbt, keRtf } = mesinAbt;
    expect(keRtf(bersihkanHtmlAbt("Bahwa satu</p>Bahwa dua<br>tiga"))).toBe("Bahwa satu\\par Bahwa dua\\par tiga");
    expect(keRtf(bersihkanHtmlAbt("1.   Pertama"))).toBe("1.\\tab Pertama");
    // Dua spasi sesudah \b0 = satu pembatas + satu spasi tampak (sama dengan ABT); kode di ujung nilai diberi pembatas.
    expect(keRtf(bersihkanHtmlAbt("<strong>MENGADILI</strong> <i>ba'in</i>"))).toBe("\\b MENGADILI\\b0  \\i ba'in\\i0 ");
    expect(keRtf(bersihkanHtmlAbt("Rp&nbsp;229.000;biaya"))).toBe("Rp\\u160?229.000; biaya");
    expect(keRtf(bersihkanHtmlAbt("\u201CDemi Allah\u201D"))).toBe("Demi Allah");
    expect(keRtf(bersihkanHtmlAbt("DATA_TIDAK_ADA"))).toBe("...");
    // Isi data tidak boleh merusak RTF: garis miring & kurung diloloskan, aksara non-ASCII \uN?.
    expect(keRtf(bersihkanHtmlAbt("a\\b {c} é"))).toBe("a\\\\b \\{c\\} \\u233?");
  });

  it("tgl_indo2, Terbilang, number_format, getHari, hijriah", () => {
    expect(mesinAbt.tglIndo2("2026-10-04")).toBe("04 Oktober 2026");
    expect(mesinAbt.tglIndo2(null)).toBe("");
    expect(mesinAbt.tglIndo2("0000-00-00")).toBe("");
    expect(mesinAbt.terbilangAbt("229000")).toBe(" dua ratus dua puluh sembilan ribu");
    expect(mesinAbt.formatAngka("229000.00")).toBe("229.000");
    expect(mesinAbt.getHari("2026-10-15")).toBe("Kamis");
    expect(mesinAbt.getHari("2026/10/14")).toBe("Rabu");
    expect(mesinAbt.hijriah("2026/10/14")).toMatch(/^\d{1,2} [A-Za-z' ]+ 14\d\d $/);
  });

  it("tanya-jawab saksi: TABEL seperti kolom_kode_A4 - pertanyaan sel kiri, jawaban sel kanan di baris bawahnya", () => {
    const peta = new Map<string, string>();
    let i = 0;
    const wakil = (rtf: string) => {
      const c = String.fromCharCode(0xe100 + i++);
      peta.set(c, rtf);
      return c;
    };
    const teks = mesinAbt.tabelTanyaJawab(
      [
        { pertanyaan: "Apakah saksi kenal Penggugat?", jawaban: "Kenal, saksi adalah ibu kandung" },
        { pertanyaan: "Sejak kapan berpisah?", jawaban: "Sejak Januari 2025" },
      ],
      "A4",
      wakil
    );
    const rtf = mesinAbt.keRtf(mesinAbt.bersihkanHtmlAbt(teks), peta);
    expect(rtf).toContain("\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1 Apakah saksi kenal Penggugat? \\cell\\cell\n\\trowd\\irow0\\irowband0");
    expect(rtf).toContain("\\pard\\intbl\\widctlpar\\qr\\ri100\\sl360\\slmult1 - \\cell\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1 Kenal, saksi adalah ibu kandung \\cell\n\\trowd\\irow1\\irowband1\\lastrow");
    expect(rtf).toContain("\\clwWidth4250\\cellx4250");
    expect(rtf).toContain("\\clwWidth4250\\cellx8500\\row");
    expect((rtf.match(/\\row/g) ?? []).length).toBe(4);
    expect(rtf.trimEnd().endsWith("\\pard")).toBe(true);
    // A4s: jawaban di sel kanan tanpa tanda "-".
    const a4s = mesinAbt.keRtf(mesinAbt.bersihkanHtmlAbt(mesinAbt.tabelTanyaJawab([{ pertanyaan: "T", jawaban: "J" }], "A4s", wakil)), peta);
    expect(a4s).toContain("\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1\\cell J \\cell");
    expect(a4s).toContain("\\cellx8800\\row");
  });

  it("daftar keterangan (list_keterangan): '-   Bahwa ...' dengan saya->saksi", () => {
    expect(mesinAbt.daftarKeterangan([{ jawaban: "Saya kenal Penggugat" }, { jawaban: "" }])).toBe("-   Bahwa saksi kenal Penggugat<br>\n");
  });

  it("pagar: hanya satu SELECT; REPLACE() fungsi dan CHARACTER SET boleh", () => {
    const { pagarBaca } = mesinAbt;
    expect(pagarBaca("select REPLACE(CONVERT(x USING utf8),'\\\\','/') as data from perkara")).toBe("");
    expect(pagarBaca("SELECT CAST(DAY(d) AS CHAR CHARACTER SET utf8) data FROM t")).toBe("");
    expect(pagarBaca("select 'a;b' as data")).toBe("");
    expect(pagarBaca("update perkara set x=1")).not.toBe("");
    expect(pagarBaca("select 1 as data; delete from perkara")).not.toBe("");
    expect(pagarBaca("call perkara_jadwal_sidang_reorder(1)")).not.toBe("");
    expect(pagarBaca("select sleep(10) as data")).not.toBe("");
    expect(pagarBaca("select * from perkara for update")).not.toBe("");
  });
});

describe("Q2 isiRtf: urutan sumber dan bentuk ABT", () => {
  const katalog = [
    { no_var: "0046", nama: "Sebutan P", data_type: "data_sql", sql_query: "select 'Penggugat' as data" },
    { no_var: "0047", nama: "Sebutan T", data_type: "data_sql", sql_query: "select 'Tergugat' as data" },
    { no_var: "1197", nama: "Nama Saksi 1 P", data_type: "data_sql", sql_query: "select nama as data from perkara_pihak5 where perkara_id=#perkara_id#" },
    { no_var: "1199", nama: "Agama Saksi 1 P", data_type: "data_sql", sql_query: "select 'Islam' as data" },
    { no_var: "7029", nama: "Sumpah", data_type: "data_sql", sql_query: 'SELECT CASE WHEN "#1199#" = "Islam" THEN "Demi Allah" ELSE "Saya berjanji" END data' },
    { no_var: "1214", nama: "Alat bukti", data_type: "data_teks" },
    { no_var: "0033", nama: "Tgl Sidang", data_type: "multi_sidang", multi_sidang: "tanggal_sidang" },
    { no_var: "0090", nama: "Dihadiri", data_type: "multi_sidang", multi_sidang: "dihadiri_oleh" },
    { no_var: "5058", nama: "TanyaJwb Saksi 1 P", data_type: "tanya_jawab", referensi: "1197", multi_sidang: "tanyajawab" },
    { no_var: "2021", nama: "Keterangan Saksi 1 P", data_type: "tanya_jawab", referensi: "1197", multi_sidang: "keterangan" },
    { no_var: "4001", nama: "Biaya", data_type: "data_sql", sql_query: "select '229000.00' as data" },
    { no_var: "4002", nama: "Biaya terbilang", data_type: "terbilang", referensi: "4001" },
    { no_var: "1268", nama: "Upaya damai", data_type: "data_teks" },
    { no_var: "9000", nama: "Kueri jahat", data_type: "data_sql", sql_query: "update perkara set x=1" },
  ];
  function kueriDari(rows: Record<string, (sql: string, p: unknown[]) => unknown[]>) {
    const dijalankan: string[] = [];
    const kueri = async (sql: string, params: unknown[] = []) => {
      dijalankan.push(sql);
      if (/abt_variabel/.test(sql)) return katalog;
      if (/abt_config/.test(sql)) return [{ value: "A4" }];
      if (/perkara_jadwal_sidang/.test(sql))
        return [
          { id: "1", tanggal_sidang: "2026-10-01", dihadiri_oleh: "1" },
          { id: "2", tanggal_sidang: "2026-10-15", dihadiri_oleh: "2" },
        ];
      for (const [pola, fn] of Object.entries(rows)) if (sql.includes(pola)) return fn(sql, params);
      const m = /select '([^']*)' as data/i.exec(sql);
      if (m) return [{ data: m[1] }];
      const c = /SELECT CASE WHEN "([^"]*)" = "Islam"/.exec(sql);
      if (c) return [{ data: c[1] === "Islam" ? "Demi Allah" : "Saya berjanji" }];
      return [];
    };
    return { kueri, dijalankan };
  }

  it("ABT mengisi, timpa menang, cadangan hanya bila ABT kosong, sisanya '...' bersorot", async () => {
    const { kueri, dijalankan } = kueriDari({
      // Urutan penting: kueri jati diri pihak juga menyebut perkara_pihak5.
      "from pihak a": () => [{ id: "77", kolom: "saksi_id", tabel: "abt_keterangan_saksi" }],
      perkara_pihak5: () => [{ data: "Fadlina binti Musi" }],
      "abt_keterangan_saksi": (sql) =>
        /sidang_id = 2/.test(sql) || !/sidang_id/.test(sql) ? [{ urutan_pertanyaan: "1", pertanyaan: "Kenal?", jawaban: "Saya kenal" }] : [],
      abt_data_teks: (_s, p) => (p[1] === "1268" ? [{ data: "telah diupayakan damai oleh #0046#" }] : []),
    });
    const mesin = mesinAbt.buatMesin({ kueri });
    const rtf =
      "{\\rtf1{\\colortbl;\\red0\\green0\\blue0;\\red255\\green0\\blue0;}" +
      "#0033# #0090# #1197# #1199# #7029# #1214# #4001# (#4002#) #9000# #1268# #2021# #5058# #0102#}";
    const h = await mesin.isiRtf(rtf, {
      perkaraId: "10133",
      sidangKe: 2,
      timpa: { "1199": "Islam" },
      cadangan: { "0102": "Andi Moh. Rustam", "1197": "JANGAN DIPAKAI" },
    });
    expect(h.rtf).not.toMatch(/#\d{3,5}#/);
    expect(h.rtf).toContain("15 Oktober 2026");
    expect(h.rtf).toContain("Penggugat saja");
    expect(h.rtf).toContain("Fadlina binti Musi");
    expect(h.rtf).not.toContain("JANGAN DIPAKAI");
    expect(h.rtf).toContain("Demi Allah");
    // Spasi depan Terbilang dibuang trim() cleanHtmlTagSpecial - sama dengan ABT.
    expect(h.rtf).toContain("229.000 (dua ratus dua puluh sembilan ribu)");
    expect(h.rtf).toContain("Andi Moh. Rustam");
    // Nilai isian yang memuat penanda lagi ikut terisi.
    expect(h.rtf).toContain("telah diupayakan damai oleh Penggugat");
    // Keterangan (daftar) dan tanya-jawab (tabel ABT).
    expect(h.rtf).toContain("-\\tab Bahwa saksi kenal");
    expect(h.rtf).toContain("\\slmult1 Kenal? \\cell\\cell");
    // Kosong: isian tangan #1214# dan kueri yang ditolak pagar #9000# - "..." bersorot (indeks warna baru = 3).
    expect(h.kosong.map((k: { noVar: string }) => k.noVar)).toEqual(["1214", "9000"]);
    expect(h.rtf).toContain("\\red255\\green255\\blue0;}");
    expect(h.rtf).toContain("{\\highlight3 ...}");
    expect(h.sumber.cadangan).toBe(1);
    expect(dijalankan.some((s) => /update perkara/i.test(s))).toBe(false);
  });

  it("lembar ALETA untuk saksi dibentuk persis ABT (tabel), tanpa membaca rekaman ABT", async () => {
    const { kueri, dijalankan } = kueriDari({ perkara_pihak5: () => [{ data: "Fadlina" }] });
    const mesin = mesinAbt.buatMesin({ kueri });
    const h = await mesin.isiRtf("{\\rtf1 #5058#}", {
      perkaraId: "10133",
      sidangKe: 2,
      tanyaJawabSaksi: { "1197": [{ pertanyaan: "Apa hubungan saksi?", jawaban: "Ibu kandung" }] },
    });
    expect(h.kosong).toEqual([]);
    expect(h.rtf).toContain("\\slmult1 Apa hubungan saksi? \\cell\\cell");
    expect(h.rtf).toContain("\\slmult1 Ibu kandung \\cell");
    expect(dijalankan.some((s) => /abt_keterangan_saksi/.test(s))).toBe(false);
  });

  it("basis data tidak terjangkau: tetap tanpa penanda mentah, seluruhnya disebut kosong", async () => {
    const mesin = mesinAbt.buatMesin({
      kueri: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const h = await mesin.isiRtf("{\\rtf1 #0046# dan #0047#}", { perkaraId: "1", timpa: { "0046": "Penggugat" } });
    expect(h.rtf).not.toMatch(/#\d{3,5}#/);
    expect(h.rtf).toContain("Penggugat dan ...");
    expect(h.kosong.map((k: { noVar: string }) => k.noVar)).toEqual(["0047"]);
  });
});
