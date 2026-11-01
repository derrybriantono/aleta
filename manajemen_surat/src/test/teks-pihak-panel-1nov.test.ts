// @vitest-environment node
/**
 * KEPUTUSAN 56 + 55 DI PANEL (Blangko Derry, jsdom) - 1 Nov 2026.
 *   - dua berkas e-Court atau lebih untuk bagian yang sama: panel memberi tahu, menampilkan isi tiap berkas, petugas memilih; saran bawaan =
 *     yang terakhir diunggah dan TIDAK ditulis sendiri; satu berkas: ditulis sendiri tanpa klik tambahan;
 *   - isian salinan teks pihak (9355 dst.) disimpan apa adanya walau ada ";" di tengah.
 * Harness meniru g1-cegah-salah-30okt.test.ts (skrip ekstensi sungguhan di jsdom; portal/bot/ABT ditiru di fetch). Usulan e-Court datang dari
 * isiGugatanService SUNGGUHAN (fixture rekaan jawab-replik-31okt).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const req = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const S: Apa = req(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const N: Apa = req(path.join(AKAR, "aleta_bot/services/naskahJawabMenjawabService.js"));
const F: Apa = req(path.join(AKAR, "manajemen_surat/src/test/fixtures/jawab-replik-31okt.cjs"));

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(5);
  }
}

const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-saksi.js", "deteksi-sisa-blangko.js", "blangko-derry-periksa.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");
const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const NOMOR = "581/Pdt.G/2026/PA.Dgl";
const BLANGKO = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("0007", "Telah Dikarunai Anak", "data_teks"),
  D("12020", "Uraian jawaban #0047#", "data_teks"),
  D("9355", "Pokok jawaban Tergugat/Termohon", "data_teks"),
]);
const PENANDA = ["0001", "0046", "0007", "12020", "9355"];
const PK = () => ({
  nomorPerkara: NOMOR, perkaraId: "10154", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Penggugat Satu"], tergugat: ["Tergugat Satu"] },
  sidang: [{ sidangId: `s${HARI_INI}`, tanggal: HARI_INI, jam: "09:00", agenda: "Pembuktian", ket: "", ditunda: false, urutan: 2, hadir: null, adaBas: null, ruangan: "" }],
});
const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(1 Blangko)">Putusan CG</a></div>`;
const HAL_KELOMPOK = `<div class="pricing-top tiga"><h3>Putusan Cerai Gugat</h3></div><p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"A01", b:"B01", c:"" });'># <span>${BLANGKO}</span></a></p>`;
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>${NOMOR}</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

type Opsi = { abtAwal?: Record<string, string>; hurufAlasan?: unknown; riwayat?: Array<Record<string, unknown>>; isiOto?: boolean; usulanSipp?: unknown[]; usulanEcourt?: unknown[] };
type Halaman = { dom: JSDOM; w: any; minta: Array<{ url: string; cara: string; badan: string }>; abt: Record<string, string>; riwayatCatat: Array<Record<string, unknown>> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Opsi = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Hakim</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = p.isiOto === false ? { blangkoDerryIsiOto: false } : {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.56" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Halaman["minta"] = [];
  const abt: Record<string, string> = { ...(p.abtAwal ?? {}) };
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], tjKode: Set<string>) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      const v = abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: NOMOR, nama: "", sebab: "" } : k === "0046" ? { status: "terisi", teks: "Penggugat Satu", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
      n[k] = statusNilaiLayar(v, tjKode.has(k));
    }
    return n;
  };
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badanMinta = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: badanMinta });
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"], kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: "Hakim Satu", sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: null, perkara: [PK()] } });
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [] } } });
    if (url.includes("/aleta-ecourt/sidang?dari=")) return json({ ok: false }, 404);
    if (url.includes("/aleta-ecourt/sidang/skors?")) return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    if (url.includes("/aleta-ecourt/konseptor-langkah")) return json({ ok: true, data: { ada: true, peta: {}, drafH7: {}, keadaanTerbaca: true } });
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) return json({ ok: true, data: { ada: false } });
    if (url.includes("/aleta-ecourt/blangko-derry?hak=1")) return json({ ok: true, data: { saklar: { hakimBas: false, ppPutusan: false }, folder: [] } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: [`${BLANGKO}.rtf`] }], sumber: "pohon", sebab: "" } });
      const s = susunIsian(PENANDA, KATALOG, { P: "Penggugat", T: "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${BLANGKO}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined, nilaiAda: Boolean(q.get("perkaraId")), nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/usulan")) {
      const sumber = (() => {
        try {
          return String(JSON.parse(badanMinta).sumber || "");
        } catch {
          return "";
        }
      })();
      if (sumber === "saksi") return json({ ok: true, data: { available: true, saksi: { usulan: [], huruf: [], ...(p.hurufAlasan ? { hurufAlasan: polos(p.hurufAlasan) } : {}) } } });
      if (sumber === "itsbat" || sumber === "posita-lain") return json({ ok: true, data: { available: true, itsbat: { ok: false }, positaLain: { ok: false } } });
      return json({ ok: true, data: { available: true, sipp: { ok: true, usulan: polos(p.usulanSipp ?? []), jumlahKuasa: 0, prodeo: false } } });
    }
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: polos(p.usulanEcourt ?? []), tanyaJawab: [], kalimat: [], kontak: null } });
    if (url.includes("/aleta-ecourt/kuasa-gugatan")) return json({ ok: true, data: { usulan: [], ada: false } });
    if (url.includes("/aleta-ecourt/ktp-pihak")) return json({ ok: true, data: { pihak: [] } });
    if (url === BERANDA) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK);
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const kode = new URL(url).searchParams.get("no_var") || "";
      if (cara === "POST") {
        abt[kode] = String(new URLSearchParams(badanMinta).get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(kode);
      return html(POPUP(kode, def ? def.jenis : "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) return html(`<div class="panel-heading"><b><big>${NOMOR}</big></b> - TanyaJwb Saksi : <b>Saksi</b></div><script>var ajax_data = []\n</script>`);
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.console.info = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.eval(SUMBER);
  const riwayatCatat: Array<Record<string, unknown>> = [];
  w.teksSaksiMentah = (baris: Array<{ jawaban: string }>) => baris.map((b) => `- Bahwa ${b.jawaban}`).join("\n");
  w.catatRiwayat = (c: Record<string, unknown>) => {
    riwayatCatat.push(polos(c));
    return Promise.resolve();
  };
  w.bacaRiwayat = async () => polos(p.riwayat ?? []);
  return { dom, w, minta, abt, riwayatCatat };
}
const doc = (h: Halaman) => h.w.document as Document;
const q = (h: Halaman, s: string) => (doc(h).getElementById("aleta-bd-akar") as HTMLElement).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from((doc(h).getElementById("aleta-bd-akar") as HTMLElement).querySelectorAll(s)) as HTMLElement[];
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));
async function bukaBlangko(h: Halaman) {
  await sampai(() => doc(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(doc(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, `[data-pk="${NOMOR}"]`), "daftar");
  klik(h, `[data-pk="${NOMOR}"]`);
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => {
    if (q(h, `[data-bl="${BLANGKO}"]:not([disabled])`)) return true;
    for (const k of qq(h, "[data-kelmodal]")) k.click();
    return Boolean(q(h, `[data-bl="${BLANGKO}"]:not([disabled])`));
  }, "berkas di jendela");
  klik(h, `[data-bl="${BLANGKO}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, ".bd-ok"), "isian tergambar");
}


// ============================================================================
// Bahan: usulan e-Court dari mesin SUNGGUHAN
// ============================================================================
const CG = { lawan: "Penggugat", pelaku: "Tergugat" };
function dok(judul: string, teks: string, diunggah: string) {
  return { judul, peran: "jawaban", teks, jenis: "Jawaban", pengunggah: "Tergugat", penuntutKode: "0047", diunggah };
}
const BERKAS_LAMA = dok("Jawaban Awal Tergugat", F.JAWABAN_LENGKAP, "2026-09-09");
const BERKAS_BARU = dok("Jawaban Perbaikan Tergugat", F.JAWABAN_EKSEPSI, "2026-09-15");
const usulanEcourt = (dokumen: Apa[]) => S.susunIsiGugatan({ dokumen, sebutan: CG }).usulan.filter((u: Apa) => u.kode === "12020");
const NASKAH_LAMA = N.naskahDariSurat(F.JAWABAN_LENGKAP, {}).konvensi;
const NASKAH_BARU = N.naskahDariSurat(F.JAWABAN_EKSEPSI, {}).konvensi;

describe("56 - panel: beberapa berkas e-Court untuk satu bagian", () => {
  it("dua berkas: tidak ditulis sendiri; panel memberi tahu, menampilkan isi tiap berkas, dan menawarkan pilihan berkas (bawaan = terakhir diunggah)", async () => {
    const h = buka({ usulanEcourt: usulanEcourt([BERKAS_LAMA, BERKAS_BARU]) });
    await bukaBlangko(h);
    await sampai(() => q(h, ".bd-berkas"), "kotak pilihan berkas tergambar");
    await tunggu(150);
    // tidak ada penulisan otomatis ke ABT
    expect(mintaKe(h, /edit_data\?no_var=12020/, "POST")).toEqual([]);
    expect((q(h, "#bd-i12020") as HTMLTextAreaElement).value).toBe("");
    // pemberitahuan
    expect(q(h, ".bd-berkasinfo")!.textContent).toMatch(/Ada 2 berkas di e-Court untuk bagian ini\. Yang disarankan: yang terakhir diunggah/);
    // pilihan: satu pilihan bawaan + dua berkas
    const pilih = q(h, 'select[data-bunyi="12020"]') as HTMLSelectElement;
    const opsi = Array.from(pilih.options).map((o) => o.textContent || "");
    expect(opsi).toHaveLength(3);
    expect(opsi[0]).toMatch(/saran: yang terakhir diunggah/);
    expect(opsi[1]).toBe("Jawaban Perbaikan Tergugat, diunggah 15 September 2026 (terakhir diunggah, bawaan)");
    expect(opsi[2]).toBe("Jawaban Awal Tergugat, diunggah 9 September 2026");
    // isi tiap berkas dapat dilihat tanpa memilih
    const item = qq(h, ".bd-berkasitem");
    expect(item).toHaveLength(2);
    expect(item[0].textContent).toContain("Menerima eksepsi Tergugat;");
    expect(item[1].textContent).toContain("Bahwa Tergugat menolak seluruh dalil gugatan Penggugat");
    // saran samar di kotak = berkas terakhir
    expect((q(h, "#bd-i12020") as HTMLTextAreaElement).placeholder.startsWith("I. DALAM EKSEPSI")).toBe(true);
  });

  it("petugas memilih berkas yang lebih lama: naskah berkas itu tersimpan PERSIS (tanpa perapian)", async () => {
    const h = buka({ usulanEcourt: usulanEcourt([BERKAS_LAMA, BERKAS_BARU]) });
    await bukaBlangko(h);
    const pilih = (await sampai(() => q(h, 'select[data-bunyi="12020"]'), "pilihan berkas")) as HTMLSelectElement;
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.abt["12020"], "naskah tersimpan");
    expect(h.abt["12020"]).toBe(NASKAH_LAMA);
    expect(h.abt["12020"]).toContain("DALAM POKOK PERKARA");
    expect((q(h, "#bd-i12020") as HTMLTextAreaElement).value).toBe(NASKAH_LAMA);
  });

  it("petugas memilih 'saran: yang terakhir diunggah': naskah berkas terakhir tersimpan", async () => {
    const h = buka({ usulanEcourt: usulanEcourt([BERKAS_LAMA, BERKAS_BARU]) });
    await bukaBlangko(h);
    const pilih = (await sampai(() => q(h, 'select[data-bunyi="12020"]'), "pilihan berkas")) as HTMLSelectElement;
    pilih.value = "0";
    pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.abt["12020"], "naskah tersimpan");
    expect(h.abt["12020"]).toBe(NASKAH_BARU);
  });

  it("satu berkas: ditulis sendiri ke ABT apa adanya, tanpa kotak pilihan berkas dan tanpa klik tambahan", async () => {
    const h = buka({ usulanEcourt: usulanEcourt([BERKAS_BARU]) });
    await bukaBlangko(h);
    await sampai(() => h.abt["12020"], "naskah ditulis sendiri");
    expect(h.abt["12020"]).toBe(NASKAH_BARU);
    expect(q(h, ".bd-berkas")).toBeNull();
    expect(q(h, 'select[data-bunyi="12020"]')).toBeNull();
  });

  it("isian sudah berisi di ABT (suntingan petugas) tidak ditimpa walau ada dua berkas", async () => {
    const h = buka({ abtAwal: { "12020": "Ketikan petugas ; apa adanya" }, usulanEcourt: usulanEcourt([BERKAS_LAMA, BERKAS_BARU]) });
    await bukaBlangko(h);
    await tunggu(200);
    expect(h.abt["12020"]).toBe("Ketikan petugas ; apa adanya");
    expect(mintaKe(h, /edit_data\?no_var=12020/, "POST")).toEqual([]);
  });
});

describe("55 - panel: isian salinan teks pihak disimpan apa adanya", () => {
  it("9355 diketik/dipilih dengan ';' di tengah, huruf kecil, salah ketik: tersimpan persis (isian 0007 biasa tetap dirapikan)", async () => {
    const h = buka();
    await bukaBlangko(h);
    const el = (await sampai(() => q(h, "#bd-i9355"), "kotak 9355")) as HTMLTextAreaElement;
    const ketik = (kotak: HTMLElement, nilai: string) => {
      (kotak as HTMLTextAreaElement).value = nilai;
      kotak.dispatchEvent(new h.w.Event("input", { bubbles: true }));
      kotak.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
    };
    const asli = "tergugat mengakui menikah ; namun pembayarn nafkah tidak benar.. ;;";
    ketik(el, asli);
    await sampai(() => h.abt["9355"], "9355 tersimpan");
    expect(h.abt["9355"]).toBe(asli);
    const anak = (await sampai(() => q(h, "#bd-i0007"), "kotak 0007")) as HTMLTextAreaElement;
    ketik(anak, "belum dikaruniai anak ; Penggugat ingin bercerai ;;");
    await sampai(() => h.abt["0007"], "0007 tersimpan");
    expect(h.abt["0007"]).toBe("belum dikaruniai anak, Penggugat ingin bercerai;");
  });
});
