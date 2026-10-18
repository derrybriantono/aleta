// @vitest-environment jsdom
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { menyebutAleta as menyebutPortal } from "@/lib/tanda-aleta";

/**
 * Penjaga batas di EKSTENSI (17 Okt 2026): tidak ada kata "ALETA" yang ditulis
 * ekstensi ke SIPP / ABT. Satu pintu: fetch skrip konten dibungkus, sehingga
 * seluruh tulisan langsung ke SIPP/ABT (Court Calendar, variabel ABT, unggah
 * anonimisasi, ...) diperiksa tanpa menyentuh tiap pemanggil.
 */
const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P: any = req(path.join(AKAR, "ekstensi-sipp/penjaga-tanda.js"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bot: any = req(path.join(AKAR, "aleta_bot/services/tandaAletaService.js"));

const ASAL = { asal: "http://192.168.10.10/SIPP/" };
const SIPP = "http://192.168.10.10/SIPP/manage_court_calendar/validateInput";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("pengenal kata - sama di ekstensi, bot, dan portal", () => {
  it("contoh yang sama memberi jawaban yang sama", () => {
    for (const t of ["ALETA", "aleta", "viaALETA", "A L E T A", "A.L.E.T.A", "a-l-e-t-a", "ＡＬＥＴＡ", "Alétà", "Al​eta", "kepala letak", "Alat", ""]) {
      expect(P.menyebutAleta(t), t).toBe(bot.menyebutAleta(t));
      expect(P.menyebutAleta(t), t).toBe(menyebutPortal(t));
    }
  });
  it("kalimat penolakan sama dengan bot dan portal", () => {
    expect(P.pesanIsian("Agenda sidang")).toBe(`Isian "Agenda sidang" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`);
  });
});

describe("periksaPermintaan - hanya TULISAN ke SIPP/ABT yang diperiksa", () => {
  it("POST ke SIPP dengan keterangan ber-ALETA ditolak, menyebut isiannya", () => {
    const h = P.periksaPermintaan(SIPP, { method: "POST", body: "tgl_sidang=19%2F10%2F2026&agenda_sidang=Pembuktian&keterangan=lewat+ALETA" }, ASAL);
    expect(h).toMatchObject({ ok: false, kolom: "Keterangan" });
    expect(h.pesan).toBe(`Isian "Keterangan" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`);
  });

  it("badan bersih lolos; GET, jalur ALETA, dan POST pembacaan (cari/list) tidak diperiksa", () => {
    expect(P.periksaPermintaan(SIPP, { method: "POST", body: "agenda_sidang=Pembuktian&keterangan=" }, ASAL)).toEqual({ ok: true });
    expect(P.periksaPermintaan(SIPP, { method: "GET" }, ASAL)).toBeNull();
    expect(P.periksaPermintaan("http://192.168.10.10/aleta/api/aleta-ecourt/sidang/kasir", { method: "POST", body: "x=ALETA" }, ASAL)).toBeNull();
    expect(P.periksaPermintaan("http://192.168.10.10/SIPP/perkara/ajax_list", { method: "POST", body: "search=Aleta" }, ASAL)).toBeNull();
    expect(P.periksaPermintaan("http://192.168.10.10/aps_badilag/main/cari", { method: "POST", body: "nama=Aleta" }, ASAL)).toBeNull();
  });

  it("ABT: nilai variabel (edit_data) ber-ALETA ditolak dengan nomor variabelnya", () => {
    const h = P.periksaPermintaan("http://192.168.10.10/aps_badilag/edit_data?no_var=4020&perkara_id=1&e=x", { method: "POST", body: new URLSearchParams({ aksi: "Simpan", value: "A,B diisi ALETA" }) }, ASAL);
    expect(h).toMatchObject({ ok: false, kolom: "Variabel #4020#" });
  });

  it("badan JSON dan FormData (isi serta NAMA berkas) ikut diperiksa", () => {
    expect(P.periksaPermintaan("http://192.168.10.10/aps_badilag/data/simpan", { method: "POST", body: JSON.stringify({ data: { catatan: "dari Aleta" } }) }, ASAL)).toMatchObject({ ok: false, kolom: "Catatan" });
    const form = new FormData();
    form.append("perkara_id", "1");
    form.append("berkas", new File(["x"], "aleta_anonim.pdf"));
    expect(P.periksaPermintaan("http://192.168.10.10/aps_badilag/main/anonim", { method: "POST", body: form }, ASAL)).toMatchObject({ ok: false, kolom: "nama berkas berkas" });
    const bersih = new FormData();
    bersih.append("berkas", new File(["x"], "anonim.pdf"));
    expect(P.periksaPermintaan("http://192.168.10.10/aps_badilag/main/anonim", { method: "POST", body: bersih }, ASAL)).toEqual({ ok: true });
  });
});

describe("data SIPP pada halaman yang dibuka tidak dihitung (dan elemen buatan ALETA bukan data SIPP)", () => {
  it("nama pihak 'Aleta' yang tampil di halaman SIPP boleh ikut tertulis; kemunculan lain tetap ditolak", () => {
    document.body.innerHTML =
      '<table><tr><td>ALETA SARI binti Hasan</td></tr></table><input type="text" value="Aleta Putri" /><div class="aleta-panel">Isi dengan ALETA</div>';
    const badan = (keterangan: string) => ({ method: "POST", body: new URLSearchParams({ keterangan }) });
    expect(P.periksaPermintaan(SIPP, badan("Penggugat ALETA SARI binti Hasan hadir"), ASAL)).toEqual({ ok: true });
    expect(P.periksaPermintaan(SIPP, badan("Penggugat Aleta Putri hadir"), ASAL)).toEqual({ ok: true });
    expect(P.periksaPermintaan(SIPP, badan("Penggugat ALETA SARI binti Hasan dan ALETA"), ASAL)).toMatchObject({ ok: false });
    // teks panel buatan ALETA sendiri tidak membebaskan apa pun
    expect(P.periksaPermintaan(SIPP, badan("Isi dengan ALETA"), ASAL)).toMatchObject({ ok: false });
  });

  it("periksaTeks (pengisi borang SIPP) memakai halaman terbuka bila daftar tidak diberikan", () => {
    expect(P.periksaTeks("lewat ALETA", "Keterangan")).toMatchObject({ ok: false, kolom: "Keterangan" });
    document.body.innerHTML = "<p>PT ALETA JAYA</p>";
    expect(P.periksaTeks("Tergugat PT ALETA JAYA", "Nama")).toEqual({ ok: true });
    expect(P.periksaTeks("biasa", "Nama")).toEqual({ ok: true });
  });
});

describe("pasangFetch - satu pintu untuk semua tulisan ekstensi", () => {
  it("menolak sebelum terkirim, meneruskan yang bersih, dan idempoten", async () => {
    const dipanggil: unknown[] = [];
    const dunia = { fetch: async (...a: unknown[]) => dipanggil.push(a) } as unknown as { fetch: ((...a: unknown[]) => Promise<unknown>) & { __aletaPenjaga?: boolean } };
    expect(P.pasangFetch(dunia)).toBe(true);
    expect(P.pasangFetch(dunia)).toBe(false);

    document.body.innerHTML = "";
    // alamat mutlak: jsdom memakai asal halaman uji, dan jalur /aleta/ tetap dibebaskan
    await expect(dunia.fetch(SIPP, { method: "POST", body: "keterangan=ALETA" })).rejects.toMatchObject({
      name: "PenjagaTandaSipp",
      kode: "teks_menyebut_aleta",
      message: `Isian "Keterangan" memuat kata 'ALETA'; hapus dulu sebelum disimpan ke SIPP.`,
    });
    expect(dipanggil).toHaveLength(0);

    await dunia.fetch(SIPP, { method: "POST", body: "keterangan=bersih" });
    await dunia.fetch("http://192.168.10.10/aleta/api/x", { method: "POST", body: "a=ALETA" });
    await dunia.fetch(SIPP);
    expect(dipanggil).toHaveLength(3);
  });
});

// ============================================================================
// Audit jejak 18 Okt 2026 - celah yang lolos dari penjaga 17 Okt
// ============================================================================
describe("audit jejak 18 Okt - kepala permintaan, alamat, dan NAMA isian juga sampai ke server", () => {
  it("kepala permintaan ber-ALETA ditolak pada SEMUA cara (juga GET); GET bersih tetap null", () => {
    expect(P.periksaPermintaan(SIPP, { method: "GET", headers: { "X-Aleta-Versi": "1.205" } }, ASAL)).toMatchObject({ ok: false, kolom: "kepala permintaan X-Aleta-Versi" });
    expect(P.periksaPermintaan(SIPP, { method: "POST", body: "a=1", headers: new Headers({ "X-Sumber": "aleta" }) }, ASAL)).toMatchObject({ ok: false });
    expect(P.periksaPermintaan(SIPP, { method: "GET", headers: [["Accept", "text/html"]] }, ASAL)).toBeNull();
    // jalur ALETA sendiri tetap bebas
    expect(P.periksaPermintaan("http://192.168.10.10/aleta/api/x", { method: "GET", headers: { "X-Aleta": "1" } }, ASAL)).toBeNull();
  });

  it("alamat: nama query ber-ALETA ditolak (GET juga); nilai query dan jalur diperiksa pada tulisan", () => {
    expect(P.periksaPermintaan(`${SIPP}?aleta=1`, { method: "GET" }, ASAL)).toMatchObject({ ok: false, kolom: "alamat (aleta)" });
    expect(P.periksaPermintaan(`${SIPP}?ket=lewat%20ALETA`, { method: "POST", body: "a=1" }, ASAL)).toMatchObject({ ok: false, kolom: "ket" });
    expect(P.periksaPermintaan("http://192.168.10.10/SIPP/simpan/Aleta", { method: "POST", body: "a=1" }, ASAL)).toMatchObject({ ok: false, kolom: "alamat" });
    expect(P.periksaPermintaan(`${SIPP}?id=5`, { method: "POST", body: "a=1" }, ASAL)).toEqual({ ok: true });
    // fragmen (#aleta-tab=3) tidak pernah sampai ke server
    expect(P.periksaPermintaan(`${SIPP}#aleta-tab=3`, { method: "POST", body: "a=1" }, ASAL)).toEqual({ ok: true });
  });

  it("NAMA isian badan (urlencoded, FormData, JSON) ber-ALETA ditolak walau nilainya bersih", () => {
    expect(P.periksaPermintaan(SIPP, { method: "POST", body: "aleta_token=1" }, ASAL)).toMatchObject({ ok: false, kolom: "nama isian aleta_token" });
    const f = new FormData();
    f.append("dariAleta", "1");
    expect(P.periksaPermintaan(SIPP, { method: "POST", body: f }, ASAL)).toMatchObject({ ok: false });
    expect(P.periksaPermintaan(SIPP, { method: "POST", body: JSON.stringify({ data: { aletaAsal: "x" } }) }, ASAL)).toMatchObject({ ok: false, kolom: "nama isian aletaAsal" });
  });

  it("bersihkanRtf: grup tersembunyi isianasal/aletaasal dan properti {\\info} ber-ALETA dibuang; naskah tetap", () => {
    const rtf =
      "{\\rtf1{\\info{\\title Putusan}{\\author ALETA}{\\*\\company Aleta Bot}}{\\*\\generator ALETA 1.205;}\\pard Isi naskah Aleta Sari\\par{\\*\\isianasal #0046#}{\\*\\aletaasal sisa {bersarang}}\\par}";
    expect(P.bersihkanRtf(rtf)).toBe("{\\rtf1{\\info{\\title Putusan}}\\pard Isi naskah Aleta Sari\\par\\par}");
    const bersih = "{\\rtf1{\\info{\\title Putusan}}\\pard x\\par}";
    expect(P.bersihkanRtf(bersih)).toBe(bersih);
    expect(P.bersihkanRtf("bukan rtf ALETA")).toBe("bukan rtf ALETA");
  });

  it("pasangFetch: berkas RTF di FormData ke SIPP/ABT dibersihkan SEBELUM terkirim (ABT main/anonim); berkas lain tak disentuh", async () => {
    const terkirim: Array<{ url: unknown; init: { body?: unknown } }> = [];
    const dunia = { fetch: async (url: unknown, init: { body?: unknown }) => terkirim.push({ url, init }) } as unknown as { fetch: (...a: unknown[]) => Promise<unknown> };
    P.pasangFetch(dunia);
    const f = new FormData();
    f.set("perkara_id", "1");
    f.set("file_putusan", new Blob(["{\\rtf1{\\info{\\author ALETA}}\\pard Isi\\par{\\*\\isianasal x}}"], { type: "application/rtf" }), "putusan.rtf");
    f.set("lampiran", new Blob(["%PDF-1.4 biasa"], { type: "application/pdf" }), "lampiran.pdf");
    await dunia.fetch("http://192.168.10.10/aps_badilag/main/anonim", { method: "POST", body: f });
    expect(terkirim).toHaveLength(1);
    const badan = terkirim[0].init.body as FormData;
    const berkas = badan.get("file_putusan") as File;
    const teks = (b: Blob) =>
      new Promise<string>((selesai) => {
        const r = new FileReader();
        r.onload = () => selesai(String(r.result));
        r.readAsText(b);
      });
    expect(berkas.name).toBe("putusan.rtf");
    expect(await teks(berkas)).toBe("{\\rtf1{\\info}\\pard Isi\\par}");
    expect(await teks(badan.get("lampiran") as File)).toBe("%PDF-1.4 biasa");
    expect(badan.get("perkara_id")).toBe("1");
  });
});

describe("audit jejak 18 Okt - semua pintu pengisi kolom SIPP lewat penjaga", () => {
  const baca = (b: string) => (req("node:fs") as typeof import("node:fs")).readFileSync(path.join(AKAR, b), "utf8");
  /** Badan fungsi `kepala` dalam sumber. */
  const badan = (s: string, kepala: string) => {
    const i = s.indexOf(kepala);
    return i < 0 ? "" : s.slice(i, s.indexOf("\n}\n", i));
  };
  const dijagaSebelum = (isi: string, kirim: string) => {
    const i = isi.indexOf("AletaPenjagaTanda.periksaTeks(");
    return i > -1 && i < isi.indexOf(kirim);
  };

  it("pemeriksa urutan terbukti menangkap pintu tanpa penjaga", () => {
    expect(dijagaSebelum("async function x(p) {\n  return kirimKeJembatanLangsung(p);\n}", "kirimKeJembatanLangsung(")).toBe(false);
  });

  it("kirimKeJembatan (satu pintu konten.js: CKEditor pertimbangan/amar, alamat, email/HP) dan saksiscanJembatan memeriksa SEBELUM mengirim", () => {
    const konten = badan(baca("ekstensi-sipp/konten.js"), "async function kirimKeJembatan(pesan) {");
    expect(konten.length).toBeGreaterThan(100);
    expect(dijagaSebelum(konten, "kirimKeJembatanLangsung(")).toBe(true);
    const saksi = badan(baca("ekstensi-sipp/saksiscan.js"), "function saksiscanJembatan(pesan, batasMs) {");
    expect(dijagaSebelum(saksi, "window.postMessage(")).toBe(true);
  });

  it("teks salinan ringkasan musyawarah (papan klip) tanpa kata ALETA", () => {
    const s = baca("ekstensi-sipp/abt.js");
    const f = badan(s, "function t6TeksMusyawarah(");
    expect(f.length).toBeGreaterThan(100);
    // literal teks (bukan pemilih CSS ".aleta-abt-..." milik panel sendiri)
    const literal = [...f.matchAll(/`([^`]*)`|"([^"]*)"/g)].map((m) => m[1] ?? m[2]).filter((t) => !/^[.#]?aleta-[\w-]+(\s[.#]aleta-[\w-]+)*$/.test(t));
    expect(literal.some((t) => t.includes("Bahan musyawarah"))).toBe(true);
    expect(literal.filter((t) => P.menyebutAleta(t))).toEqual([]);
  });
});
