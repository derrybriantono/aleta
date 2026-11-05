// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bedaDaftar, bedaKata, bedaLarik, bedaTeks } from "@/lib/aleta-abt-beda";
import {
  AKSARA_KOTAK,
  PEMISAH_PARAGRAF,
  bagianParagraf,
  kodeTeks,
  nomorIsianDi,
  terapkanSuntingan,
  uraiRtf,
  type DokumenRtf,
} from "@/lib/aleta-abt-rtf";

/**
 * ============================================================================
 * PENYUNTING RTF AMAN (ALETA ABT Tahap 3, 5 Nov 2026)
 * ============================================================================
 *   1. beda (Myers): menerapkan op ke A selalu menghasilkan B;
 *   2. urai: aksara, \'hh, \uN?, \tab, kelompok (kepala/kaki/gambar/kotak/bidang/daftar), tabel;
 *   3. tulis: yang tidak diubah utuh per bita; hanya rentang aksara yang berubah yang berganti; Enter = \par; hapus paragraf;
 *      kotak terkunci tidak bisa dihapus; pemeriksa menolak hasil yang melenceng;
 *   4. pulang-pergi atas blangko sungguhan (bila folder contoh ada di mesin ini).
 */

// ─── 1. beda ────────────────────────────────────────────────────────────────────────────────────────────────────
function terapkanOps(a: string, b: string, ops: ReturnType<typeof bedaTeks>) {
  let h = "";
  for (const op of ops) {
    if (op.t === "=") h += a.slice(op.a, op.a + op.n);
    else if (op.t === "+") h += b.slice(op.b, op.b + op.n);
  }
  return h;
}

describe("1. beda Myers", () => {
  it("op menyusun B dari A, dan op '=' selalu benar-benar sama (acak 400 pasang)", () => {
    let seed = 7;
    const acak = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const huruf = "abc dEf#1";
    for (let i = 0; i < 400; i += 1) {
      const buat = (n: number) => Array.from({ length: n }, () => huruf[acak(huruf.length)]).join("");
      const a = buat(acak(40));
      let b = a;
      for (let k = acak(4); k > 0; k -= 1) {
        const pos = acak(b.length + 1);
        b = acak(2) ? b.slice(0, pos) + buat(acak(5)) + b.slice(pos) : b.slice(0, pos) + b.slice(pos + acak(5));
      }
      if (i % 5 === 0) b = buat(acak(30));
      const ops = bedaTeks(a, b);
      expect(terapkanOps(a, b, ops), `${a} -> ${b}`).toBe(b);
      for (const op of ops) if (op.t === "=") expect(a.slice(op.a, op.a + op.n)).toBe(b.slice(op.b, op.b + op.n));
    }
  });
  it("sama persis = satu op sama; kosong ke isi = satu tambah; beda terlalu besar jatuh ke penggantian utuh", () => {
    expect(bedaTeks("abc", "abc")).toEqual([{ t: "=", a: 0, b: 0, n: 3 }]);
    expect(bedaTeks("", "xy")).toEqual([{ t: "+", a: 0, b: 0, n: 2 }]);
    const besar = bedaLarik(Int32Array.from({ length: 300 }, (_, i) => i), Int32Array.from({ length: 300 }, (_, i) => 1000 + i), 20);
    expect(besar.map((o) => o.t)).toEqual(["-", "+"]);
  });
  it("beda daftar dan beda kata", () => {
    const ops = bedaDaftar(["a", "b", "c"], ["a", "x", "c"]);
    expect(ops.map((o) => o.t).join("")).toBe("=-+=");
    const k = bedaKata("Penggugat hadir hari ini", "Penggugat tidak hadir hari ini");
    expect(k.baru.some((p) => p.d === "tambah" && p.t.includes("tidak"))).toBe(true);
    expect(k.lama.every((p) => !p.d)).toBe(true);
  });
});

// ─── 2. urai ────────────────────────────────────────────────────────────────────────────────────────────────────
const KEPALA = "{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff1{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}{\\f1\\fswiss\\fcharset0 Calibri;}{\\f2\\froman\\fcharset178 Times New Roman;}}{\\colortbl;\\red255\\green255\\blue255;}{\\stylesheet{\\s0 Normal;}}\r\n";

function berkasContoh(): string {
  return (
    KEPALA +
    "{\\header\\pard\\qc Kop #9999#\\par}{\\footer\\pard\\qr{\\field{\\*\\fldinst{ PAGE \\\\* Arabic }}{\\fldrslt{1}}}\\par}\r\n" +
    "\\pard\\qc\\b PUTUSAN\\b0\\par\r\n" +
    "\\pard\\qj\\fi567\\plain\\f1\\fs24 Nomor #0001# tentang \\'93kutipan\\'94 dan \\u8220?lain\\u8221? serta caf\\'e9\\tab selesai\\par\r\n" +
    "\\pard\\qj {\\b Nama:} #0098#, {\\i miring} biasa.\\par\r\n" +
    "\\pard\\intbl Sel satu\\cell\\pard\\intbl Sel dua #0102#\\cell\\row\r\n" +
    "\\pard\\qj Kotak {\\shp{\\*\\shpinst{\\sp{\\sn shapeType}{\\sv 202}}{\\shptxt\\pard Isi kotak teks\\par}}{\\shprslt{\\pict\\wmetafile8 abcdef}}} sesudah.\\par\r\n" +
    "\\pard {\\listtext 1.\\tab}Butir bernomor\\par\r\n" +
    "\\pard\\plain\\f2 \\'c7\\'e1\\par\r\n" +
    "\\pard\\par\r\n" +
    "\\pard Terakhir.\\par}"
  );
}

describe("2. urai", () => {
  const doc = uraiRtf(berkasContoh());
  const teks = doc.paragraf.map((p) => p.teks);
  it("teks logis: \\'hh, \\uN?, \\tab, escape, tanpa tabel fon/warna/gaya", () => {
    expect(teks[0]).toBe("PUTUSAN");
    expect(teks[1]).toBe("Nomor #0001# tentang \u201ckutipan\u201d dan \u201clain\u201d serta caf\u00e9\tselesai");
    expect(teks[2]).toBe("Nama: #0098#, miring biasa.");
    expect(teks.join("|")).not.toMatch(/Arial|Calibri|Normal/);
  });
  it("sel tabel tetap paragraf (bertanda tabel); kotak teks, bidang jadi satu aksara terkunci; daftar jadi awalan", () => {
    expect(teks[3]).toBe("Sel satu");
    expect(doc.paragraf[3].tabel).toBe(true);
    expect(teks[4]).toBe("Sel dua #0102#");
    const kotak = doc.paragraf[5];
    expect(kotak.teks).toBe(`Kotak ${AKSARA_KOTAK} sesudah.`);
    expect(kotak.kotak[0].jenis).toBe("kotak");
    expect(kotak.kotak[0].label).toContain("Isi kotak teks");
    expect(doc.paragraf[6].awalan).toBe("1.");
    expect(doc.paragraf[6].teks).toBe("Butir bernomor");
  });
  it("kepala/kaki halaman dipisahkan sebagai bagian tetap (terkunci); gaya dan rata terbaca", () => {
    expect(doc.tetap).toEqual([
      { jenis: "kepala", teks: ["Kop #9999#"] },
      { jenis: "kaki", teks: [] },
    ]);
    expect(doc.paragraf[0].rata).toBe("tengah");
    const bagian = bagianParagraf(doc.paragraf[2]);
    expect(bagian.filter((b) => b.j === "isian")).toEqual([{ j: "isian", no: "0098", g: 0 }]);
    expect(bagian.some((b) => b.j === "teks" && b.g === 1 && b.t === "Nama:")).toBe(true);
    expect(bagian.some((b) => b.j === "teks" && b.g === 2 && b.t === "miring")).toBe(true);
  });
  it("huruf dari fon khusus (Arab lewat \\'hh) mengunci paragrafnya", () => {
    const p = doc.paragraf.find((x) => x.teks.length === 2 && x.terkunci);
    expect(p?.terkunci).toMatch(/dikodekan khusus/);
  });
  it("bukan RTF = dokumen tidak dapat disunting", () => {
    expect(uraiRtf("bukan rtf").sebabDokumen).toMatch(/bukan RTF/);
    expect(uraiRtf("{\\rtf1 x}").sebabDokumen).toBe("");
  });
  it("kode teks: kurung, garis miring, tab, kutip miring, huruf Latin, Unicode", () => {
    expect(kodeTeks("a{b}\\c\t\u00e9\u201c\u0627")).toBe("a\\{b\\}\\\\c\\tab \\'e9\\'93\\u1575?");
    expect(kodeTeks("\u201c", true)).toBe("\\u8220?");
    expect(kodeTeks("x\u0627", false, 0)).toBe("x\\u1575 ");
  });
  it("nomor isian unik dan dibakukan 4 angka", () => {
    expect(nomorIsianDi("#001# a #0098# #98# #0098# #12345#")).toEqual(["0001", "0098", "12345"]);
  });
});

// ─── 3. tulis ───────────────────────────────────────────────────────────────────────────────────────────────────
function ubah(s: string, doc: DokumenRtf, indeks: number, fn: (t: string) => string, opsi = {}) {
  return terapkanSuntingan(s, doc, [{ indeks, teks: fn(doc.paragraf[indeks].teks) }], opsi);
}
function beda(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j += 1;
  return { awal: i, lama: a.slice(i, a.length - j), baru: b.slice(i, b.length - j) };
}

describe("3. tulis", () => {
  const s = berkasContoh();
  const doc = uraiRtf(s);
  it("tanpa suntingan atau teks sama = bita sama persis", () => {
    const h = terapkanSuntingan(s, doc, []);
    expect(h.ok && h.rtf === s).toBe(true);
    const h2 = terapkanSuntingan(s, doc, doc.paragraf.map((p) => ({ indeks: p.indeks, teks: p.teks })));
    expect(h2.ok && h2.rtf === s).toBe(true);
  });
  it("ganti satu kata: hanya kata itu yang berubah di bita, kerangka utuh", () => {
    const h = ubah(s, doc, 2, (t) => t.replace("biasa", "tebal"));
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const b = beda(s, h.rtf);
    expect(b.lama).toMatch(/^[a-z]+$/);
    expect(h.rtf.length - s.length).toBe(0);
    expect(uraiRtf(h.rtf).paragraf[2].teks).toBe("Nama: #0098#, miring tebal.");
    // kembali ke kata semula = bita awal persis
    const kembali = ubah(h.rtf, uraiRtf(h.rtf), 2, (t) => t.replace("tebal", "biasa"));
    expect(kembali.ok && kembali.rtf === s).toBe(true);
  });
  it("sisip isian bernama: #NNNN# ditulis apa adanya, mewarisi gaya aksara sebelumnya", () => {
    const h = ubah(s, doc, 2, (t) => t.replace("Nama:", "Nam#0005#a:"));
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.rtf).toContain("{\\b Nam#0005#a:}");
  });
  it("huruf Latin, kutip miring, dan Arab ditulis sebagai \\'hh atau \\uN? yang sah", () => {
    const h = ubah(s, doc, 0, () => "PUTUSAN \u00e9 \u201cx\u201d \u0627");
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.rtf).toContain("PUTUSAN \\'e9 \\'93x\\'94 \\u1575?");
    expect(uraiRtf(h.rtf).paragraf[0].teks).toBe("PUTUSAN \u00e9 \u201cx\u201d \u0627");
  });
  it("ganti kata di tengah teks bergaya campur tidak menggeser gaya (hanya ganti di tempatnya)", () => {
    const h = ubah(s, doc, 2, (t) => t.replace("Nama:", "Julukan:"));
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.rtf).toContain("{\\b Julukan:}");
  });
  it("Enter = \\par disisipkan; paragraf baru mewarisi format; tab, \\line, nbsp tertulis", () => {
    const h = ubah(s, doc, 0, () => `PUT${PEMISAH_PARAGRAF}USAN\u00a0Ke\ndua`);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const baru = uraiRtf(h.rtf);
    expect(baru.paragraf.slice(0, 2).map((p) => p.teks)).toEqual(["PUT", "USAN\u00a0Ke\ndua"]);
    expect(baru.paragraf.length).toBe(doc.paragraf.length + 1);
  });
  it("hapus paragraf: teks hilang dan \\par ikut dibuang bila berikutnya \\pard; paragraf lain utuh", () => {
    const h = terapkanSuntingan(s, doc, [], { hapus: [1] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const baru = uraiRtf(h.rtf);
    expect(baru.paragraf.length).toBe(doc.paragraf.length - 1);
    expect(baru.paragraf[1].teks).toBe(doc.paragraf[2].teks);
    expect(h.rtf).toContain("\\pard\\qj\\fi567\\plain\\f1\\fs24");
  });
  it("kotak terkunci: tidak bisa dihapus, ditambah, atau dibuang bersama paragrafnya; sekitarnya boleh diubah", () => {
    const hapusKotak = ubah(s, doc, 5, (t) => t.replace(AKSARA_KOTAK, ""));
    expect(hapusKotak.ok).toBe(false);
    if (!hapusKotak.ok) expect(hapusKotak.sebab).toMatch(/terkunci/);
    const tambah = ubah(s, doc, 0, (t) => t + AKSARA_KOTAK);
    expect(tambah.ok).toBe(false);
    const hapusParagraf = terapkanSuntingan(s, doc, [], { hapus: [5] });
    expect(hapusParagraf.ok).toBe(false);
    const sekitar = ubah(s, doc, 5, (t) => t.replace("Kotak", "Bingkai").replace("sesudah", "setelah"));
    expect(sekitar.ok).toBe(true);
    if (sekitar.ok) {
      expect(sekitar.rtf).toContain("{\\shp{\\*\\shpinst{\\sp{\\sn shapeType}{\\sv 202}}{\\shptxt\\pard Isi kotak teks\\par}}{\\shprslt{\\pict\\wmetafile8 abcdef}}}");
      expect(uraiRtf(sekitar.rtf).paragraf[5].teks).toBe(`Bingkai ${AKSARA_KOTAK} setelah.`);
    }
  });
  it("tabel: teks sel boleh diubah, Enter dan hapus paragraf sel dikunci", () => {
    const ok = ubah(s, doc, 3, () => "Sel satu diubah");
    expect(ok.ok).toBe(true);
    const enter = ubah(s, doc, 3, () => `Sel${PEMISAH_PARAGRAF}satu`);
    expect(enter.ok).toBe(false);
    if (!enter.ok) expect(enter.sebab).toMatch(/tabel/i);
    expect(terapkanSuntingan(s, doc, [], { hapus: [3] }).ok).toBe(false);
  });
  it("paragraf huruf khusus terkunci; kepala dan kaki halaman tidak pernah berubah", () => {
    const idx = doc.paragraf.findIndex((p) => p.terkunci);
    const h = ubah(s, doc, idx, () => "x");
    expect(h.ok).toBe(false);
    const lain = ubah(s, doc, 0, () => "BERUBAH");
    expect(lain.ok && lain.rtf.includes("{\\header\\pard\\qc Kop #9999#\\par}")).toBe(true);
    expect(lain.ok && lain.rtf.includes("{\\field{\\*\\fldinst{ PAGE \\\\* Arabic }}{\\fldrslt{1}}}")).toBe(true);
  });
  it("paragraf kosong boleh diisi; sisipan setelah kata kendali bernilai tidak menyatu dengan angkanya", () => {
    const kosong = doc.paragraf.findIndex((p) => p.teks === "" && p.terminator);
    const h = ubah(s, doc, kosong, () => "Baris baru");
    expect(h.ok).toBe(true);
    const angka = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\pard\\fs24x5 tail\\par}";
    const d = uraiRtf(angka);
    expect(d.paragraf[0].teks).toBe("x5 tail");
    const hapus = ubah(angka, d, 0, () => "5 tail");
    expect(hapus.ok).toBe(true);
    if (hapus.ok) expect(uraiRtf(hapus.rtf).paragraf[0].teks).toBe("5 tail");
    const depan = ubah(angka, d, 0, (t) => `1${t}`);
    expect(depan.ok).toBe(true);
    if (depan.ok) expect(uraiRtf(depan.rtf).paragraf[0].teks).toBe("1x5 tail");
  });
  it("indeks tak dikenal, paragraf ganda, dan hapus+ubah bersamaan ditolak", () => {
    expect(terapkanSuntingan(s, doc, [{ indeks: 99, teks: "x" }]).ok).toBe(false);
    expect(terapkanSuntingan(s, doc, [{ indeks: 0, teks: "x" }, { indeks: 0, teks: "y" }]).ok).toBe(false);
    expect(terapkanSuntingan(s, doc, [{ indeks: 0, teks: "x" }], { hapus: [0] }).ok).toBe(false);
  });
});

// ─── 4. pulang-pergi blangko sungguhan ──────────────────────────────────────────────────────────────────────────
const AKAR_CONTOH = process.env.ALETA_ABT_UJI_RTF || "D:/satker asal/website pa bungku/xampp/htdocs/aps_badilag/_blangko_abt/derry_briantono";

function semuaRtf(dir: string, hasil: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) semuaRtf(p, hasil);
    else if (/\.rtf$/i.test(e.name)) hasil.push(p);
  }
  return hasil;
}

describe.skipIf(!existsSync(AKAR_CONTOH))("4. pulang-pergi atas blangko sungguhan", () => {
  const berkas = existsSync(AKAR_CONTOH) ? semuaRtf(AKAR_CONTOH).sort() : [];
  it("ada cukup contoh", () => {
    expect(berkas.length).toBeGreaterThanOrEqual(20);
  });
  it("semua berkas: urai, simpan tanpa perubahan = bita sama; sunting satu kata = hanya kata itu; kembali = bita awal", () => {
    let diuji = 0;
    let tanpaTempat = 0;
    const gagal: string[] = [];
    for (const f of berkas) {
      const s = readFileSync(f).toString("latin1");
      const doc = uraiRtf(s);
      const nama = path.basename(f).slice(0, 50);
      if (doc.sebabDokumen) {
        gagal.push(`${nama}: ${doc.sebabDokumen}`);
        continue;
      }
      const kosong = terapkanSuntingan(s, doc, doc.paragraf.map((p) => ({ indeks: p.indeks, teks: p.teks })));
      if (!kosong.ok || kosong.rtf !== s) {
        gagal.push(`${nama}: simpan tanpa ubahan tidak sama persis`);
        continue;
      }
      // Cari satu kata murni ASCII di paragraf yang boleh disunting (bukan tabel) yang bitanya utuh bersambung (satu larian).
      let target = -1;
      let kata = "";
      for (const p of doc.paragraf) {
        if (p.terkunci || p.tabel) continue;
        for (const m of p.teks.matchAll(/(?:^|[ ,;.])([A-Za-z]{5,12})(?=[ ,;.]|$)/g)) {
          const mulai = m.index! + m[0].length - m[1].length;
          let bersambung = true;
          for (let i = mulai; i < mulai + m[1].length - 1; i += 1) if (p.e[i] !== p.s[i + 1]) bersambung = false;
          if (bersambung) {
            target = p.indeks;
            kata = m[1];
            break;
          }
        }
        if (target >= 0) break;
      }
      if (target < 0) {
        tanpaTempat += 1;
        continue;
      }
      const lama = doc.paragraf[target].teks;
      const baruTeks = lama.replace(kata, "UBAHANUJI");
      const h = terapkanSuntingan(s, doc, [{ indeks: target, teks: baruTeks }]);
      if (!h.ok) {
        gagal.push(`${nama}: ${h.sebab}`);
        continue;
      }
      const b = beda(s, h.rtf);
      if (!/^[A-Za-z]*$/.test(b.lama) || !/^[A-Za-z]*$/.test(b.baru) || b.lama.length > kata.length || b.baru.length > 9) {
        gagal.push(`${nama}: beda bita melebihi kata (${JSON.stringify(b.lama.slice(0, 30))} -> ${JSON.stringify(b.baru.slice(0, 30))})`);
        continue;
      }
      const baruDoc = uraiRtf(h.rtf);
      const ubahLain = baruDoc.paragraf.some((p, i) => i !== target && p.teks !== doc.paragraf[i].teks);
      if (ubahLain || baruDoc.paragraf[target].teks !== baruTeks || JSON.stringify(baruDoc.tetap) !== JSON.stringify(doc.tetap)) {
        gagal.push(`${nama}: paragraf lain ikut berubah`);
        continue;
      }
      const kembali = terapkanSuntingan(h.rtf, baruDoc, [{ indeks: target, teks: lama }]);
      if (!kembali.ok || kembali.rtf !== s) {
        gagal.push(`${nama}: mengembalikan kata tidak menghasilkan bita awal`);
        continue;
      }
      diuji += 1;
    }
    expect(gagal).toEqual([]);
    expect(diuji + tanpaTempat).toBe(berkas.length);
    expect(diuji).toBeGreaterThanOrEqual(20);
  }, 120_000);
  it("tebal-nipisnya: kotak, kepala/kaki, tabel, dan gambar muncul di contoh (uji tidak kosong)", () => {
    let kotak = 0;
    let tabel = 0;
    let tetap = 0;
    let gambar = 0;
    for (const f of berkas.slice(0, 80)) {
      if (statSync(f).size > 1_500_000) continue;
      const doc = uraiRtf(readFileSync(f).toString("latin1"));
      for (const p of doc.paragraf) {
        if (p.tabel) tabel += 1;
        for (const k of p.kotak) {
          if (k.jenis === "kotak") kotak += 1;
          if (k.jenis === "gambar") gambar += 1;
        }
      }
      tetap += doc.tetap.length;
    }
    expect(tabel).toBeGreaterThan(0);
    expect(kotak + gambar).toBeGreaterThan(0);
    expect(tetap).toBeGreaterThan(0);
  });
});
