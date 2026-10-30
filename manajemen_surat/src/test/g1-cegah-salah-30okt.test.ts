// @vitest-environment node
/**
 * ============================================================================
 * G1 CEGAH SALAH (30 Okt 2026) - rencana "Blangko ABT by Derry Briantono" gelombang 1
 * ============================================================================
 *
 *   1.1 Huruf alasan perceraian: yang PASTI dari keterangan kedua saksi + posita (hanya "F saja", terukur 52/53 putusan) terisi
 *       sendiri lewat jalur simpan biasa; yang MUNGKIN tetap saran; isian berisi/berjejak ketikan TIDAK PERNAH ditimpa.
 *   1.2 Periksa sebelum cetak: SATU daftar di langkah Cetak (blok lama saksi/verstek di dalamnya), tiap butir tombol Perbaiki;
 *       tanpa temuan daftar tersembunyi; aturan dipakai ulang.
 *   1.3 Bunyi "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]" dikenali ekstensi bersama bunyi lama.
 *   1.4 Pindai mingguan variabel Blangko Derry (bot, baca saja) + kartu Pusat Kesehatan.
 *
 * Skrip ekstensi dijalankan sungguhan di jsdom dengan portal/bot/ABT ditiru di fetch (pola blangko-derry-isi-otomatis-19okt).
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { periksaPindaiVariabel } from "@/server/modules/kesehatan/pemeriksa";

const AKAR = path.resolve(process.cwd(), "..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const req = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const reqEks = createRequire(path.join(EKSTENSI, "x.js"));

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

// ============================================================================
// 1.1 - aturan bot (keterangan saksi + posita -> golongan huruf alasan)
// ============================================================================
const S1 =
  "- Bahwa saksi kenal dengan Penggugat dan Tergugat karena saksi adalah ayah kandung Penggugat\n" +
  "- Bahwa sejak bulan Januari 2025 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran\n" +
  "- Bahwa saksi pernah melihat Penggugat dan Tergugat bertengkar\n" +
  "- Bahwa Penggugat dan Tergugat sudah pisah rumah sejak bulan Maret 2026";
const S2 = S1.replace("ayah kandung", "tetangga").replace("melihat", "mendengar");
const POSITA =
  "1. Bahwa Penggugat dan Tergugat menikah pada tanggal 5 Mei 2020;\n" +
  "2. Bahwa sejak bulan Januari 2025 rumah tangga Penggugat dan Tergugat mulai goyah, sering terjadi perselisihan dan pertengkaran secara terus menerus yang disebabkan Tergugat kurang perhatian;\n" +
  "3. Bahwa puncaknya terjadi pada bulan Maret 2026, Penggugat dan Tergugat telah pisah rumah selama kurang lebih 7 bulan;";
const PIHAK = { pelaku: "Tergugat", lawan: "Penggugat" };

describe("1.1 golongan huruf alasan dari keterangan saksi (bot)", () => {
  const svc = req("./services/abtUsulanService.js") as { dariKeteranganSaksi: (...a: unknown[]) => { hurufAlasan?: { huruf: string; golongan: string; sebab: string } } };
  const golongan = (s1: string, s2: string, posita: string, tanggal = "2026-10-20") => svc.dariKeteranganSaksi(s1, s2, tanggal, PIHAK, posita, {}).hurufAlasan;

  it("perselisihan diterangkan kedua saksi dan didalilkan posita, tanpa ciri lain, pisah < 24 bulan -> F pasti", () => {
    expect(golongan(S1, S2, POSITA)).toMatchObject({ huruf: "F", golongan: "pasti" });
  });
  it("ada ciri KDRT pada kedua saksi -> DF hanya usulan (huruf D tetap diusulkan, tidak pernah pasti)", () => {
    const d = "\n- Bahwa saksi pernah melihat Tergugat memukul Penggugat";
    expect(golongan(S1 + d, S2 + d, `${POSITA}\n4. Bahwa Tergugat sering memukul Penggugat;`)).toMatchObject({ huruf: "DF", golongan: "usulan" });
  });
  it("pisah rumah sejak 3 tahun lebih (dapat menjadi huruf B) -> F hanya usulan", () => {
    const h = golongan(S1.replace("bulan Maret 2026", "bulan Maret 2023"), S2.replace("bulan Maret 2026", "bulan Maret 2023"), POSITA);
    expect(h).toMatchObject({ huruf: "F", golongan: "usulan" });
    expect(h!.sebab).toMatch(/huruf B/);
  });
  it("hanya satu saksi menerangkan perselisihan -> usulan; tanpa posita -> usulan", () => {
    const tanpaKonflik = S2.replace(/sering terjadi perselisihan dan pertengkaran/, "baik-baik saja").replace(/\n- Bahwa saksi pernah mendengar Penggugat dan Tergugat bertengkar/, "");
    expect(golongan(S1, tanpaKonflik, POSITA)?.golongan).toBe("usulan");
    expect(golongan(S1, S2, "")?.golongan).toBe("usulan");
  });
  it("tanpa keterangan apa pun -> kosong", () => {
    expect(golongan("", "", "")?.golongan).toBe("");
  });
});

// ============================================================================
// Panel jsdom (1.1 dan 1.2)
// ============================================================================
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
  D("1006", "Tempat tinggal setelah menikah", "data_teks"),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("4001", "AMAR PUTUSAN CERAI UNIVERSAL", "data_sql", "select data from aps_badilag.abt_data_teks where no_var = '8503'"),
  D("5125", "Posita", "data_sql", "select posita from perkara"),
  D("0222", "Awal Konflik : bulan _ / tahun _ / awal tahun / akhir tahun / tanggal _", "data_teks", "", "#8493#"),
]);
const PENANDA = ["0001", "0046", "4001", "0007", "1006", "8503", "0222"];
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

type Opsi = { abtAwal?: Record<string, string>; hurufAlasan?: unknown; riwayat?: Array<Record<string, unknown>>; isiOto?: boolean; usulanSipp?: unknown[] };
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
    if (url.includes("/aleta-ecourt/isi-gugatan")) return json({ ok: true, data: { usulan: [], tanyaJawab: [], kalimat: [], kontak: null } });
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
const POSITA_ABT = { "5125": POSITA.replace(/\n/g, "<br>") };
const PASTI = { huruf: "F", golongan: "pasti", sebab: "perselisihan terus-menerus diterangkan kedua saksi dan didalilkan posita, tanpa ciri huruf lain" };

// ============================================================================
// 1.1 - keputusan panel (blangko-derry-isian.js, murni.putuskanHurufAlasan)
// ============================================================================
describe("1.1 putuskanHurufAlasan (panel, murni)", () => {
  let m: { putuskanHurufAlasan: (ha: unknown, k: unknown) => { golongan: string; nilai: string; keyakinan: string } };
  beforeAll(() => {
    m = buka().w.aletaBlangkoDerryIsian.murni;
  });
  const pasti = { huruf: "F", golongan: "pasti", sebab: "x" };
  it("pasti + kosong + tanpa jejak ketikan -> tulis F", () => {
    expect(m.putuskanHurufAlasan(pasti, { kosong: true })).toMatchObject({ golongan: "tulis", nilai: "F", keyakinan: "pasti" });
  });
  it("isian berisi atau pernah diketik petugas -> tidak pernah ditulis", () => {
    expect(m.putuskanHurufAlasan(pasti, { kosong: false }).golongan).toBe("lewati");
    expect(m.putuskanHurufAlasan(pasti, { kosong: true, jejakKetikan: true }).golongan).toBe("lewati");
  });
  it("saklar isi otomatis mati (baca saja) -> saran; usulan -> saran; sudah ada saran lain -> dibiarkan", () => {
    expect(m.putuskanHurufAlasan(pasti, { kosong: true, bacaSaja: true })).toMatchObject({ golongan: "saran", nilai: "F" });
    expect(m.putuskanHurufAlasan({ huruf: "BF", golongan: "usulan" }, { kosong: true })).toMatchObject({ golongan: "saran", nilai: "BF", keyakinan: "ragu" });
    expect(m.putuskanHurufAlasan({ huruf: "BF", golongan: "usulan" }, { kosong: true, adaSaran: true }).golongan).toBe("lewati");
  });
  it("golongan pasti selain F saja tidak pernah ditulis (pertahanan kedua)", () => {
    expect(m.putuskanHurufAlasan({ huruf: "BF", golongan: "pasti" }, { kosong: true }).golongan).toBe("saran");
    expect(m.putuskanHurufAlasan({ huruf: "X", golongan: "pasti" }, { kosong: true }).golongan).toBe("lewati");
  });
});

describe("1.1 panel: huruf alasan pasti terisi sendiri, yang lain tidak", () => {
  it("pasti + kosong: tersimpan ke ABT lewat jalur simpan biasa (tipe dibaca dulu), tercatat di riwayat, tanpa kata ALETA", async () => {
    const h = buka({ abtAwal: POSITA_ABT, hurufAlasan: PASTI });
    await bukaBlangko(h);
    await sampai(() => h.abt["8503"] === "F", "huruf alasan tersimpan");
    const post = mintaKe(h, /edit_data\?no_var=8503/, "POST");
    expect(post).toHaveLength(1);
    expect(post[0].badan).toBe("aksi=Simpan&value=F&var_type=data_teks");
    expect(post[0].badan).not.toMatch(/aleta/i);
    await sampai(() => (q(h, "#bd-i8503") as HTMLInputElement | null)?.value === "F", "kotak tampil terisi");
    await sampai(() => h.riwayatCatat.some((r) => r.kode === "8503" && /keterangan kedua saksi dan posita \(pasti\)/.test(String(r.cara))), "riwayat");
    // peringatan "belum dipilih" hilang begitu terisi
    await sampai(() => (q(h, '[data-peringatan="8503"]') as HTMLElement | null)?.hidden === true, "peringatan hilang");
  });

  it("isian sudah berisi di ABT (pilihan hakim) TIDAK ditimpa walau mesin pasti", async () => {
    const h = buka({ abtAwal: { ...POSITA_ABT, "8503": "BF" }, hurufAlasan: PASTI });
    await bukaBlangko(h);
    await sampai(() => mintaKe(h, /aleta-bot\/abt\/usulan/).some((m) => /"saksi"/.test(m.badan)), "bacaan saksi diminta");
    await tunggu(150);
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
    expect(h.abt["8503"]).toBe("BF");
  });

  it("isian kosong tetapi pernah diketik/disunting petugas (riwayat) TIDAK ditulis", async () => {
    const h = buka({ abtAwal: POSITA_ABT, hurufAlasan: PASTI, riwayat: [{ perkaraId: "10154", kode: "8503", cara: "diketik petugas di panel ALETA", pada: "2026-10-14T01:00:00Z" }] });
    await bukaBlangko(h);
    await sampai(() => mintaKe(h, /aleta-bot\/abt\/usulan/).some((m) => /"saksi"/.test(m.badan)), "bacaan saksi diminta");
    await tunggu(150);
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
  });

  it("usulan (mungkin): hanya saran samar di kotak, tidak ditulis", async () => {
    const h = buka({ abtAwal: POSITA_ABT, hurufAlasan: { huruf: "DF", golongan: "usulan", sebab: "selain huruf F saja, huruf alasan adalah pilihan majelis" } });
    await bukaBlangko(h);
    await sampai(() => (q(h, "#bd-i8503") as HTMLInputElement | null)?.placeholder === "DF", "saran samar DF");
    expect((q(h, "#bd-i8503") as HTMLInputElement).value).toBe("");
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
  });

  it("saklar Isi otomatis dari SIPP mati: tidak ada yang ditulis sendiri", async () => {
    const h = buka({ abtAwal: POSITA_ABT, hurufAlasan: PASTI, isiOto: false });
    await bukaBlangko(h);
    await tunggu(300);
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
  });
});

describe("1.2 panel: Periksa sebelum cetak - satu daftar, Perbaiki, tersembunyi bila kosong", () => {
  it("huruf alasan kosong + isian penting kosong: daftar tampil di langkah Cetak; Perbaiki membuka & menyorot kotak huruf alasan", async () => {
    const h = buka({ abtAwal: POSITA_ABT });
    await bukaBlangko(h);
    const wadah = await sampai(() => {
      const w = q(h, "#bd-periksacetak");
      return w && !w.hidden && q(h, '#bd-periksa [data-periksa="huruf"]') ? w : null;
    }, "daftar periksa tampil");
    expect(wadah.textContent).toMatch(/Periksa sebelum cetak \(\d+\)/);
    expect(wadah.textContent).toMatch(/Tidak menahan cetak/);
    const huruf = q(h, '#bd-periksa [data-periksa="huruf"]')!;
    expect(huruf.textContent).toContain("Huruf alasan perceraian belum dipilih");
    expect(huruf.textContent).toContain("[HURUF ALASAN PERCERAIAN BELUM DIPILIH]");
    // teks tampil tanpa angka empat digit telanjang
    expect((q(h, "#bd-periksa")!.textContent || "").replace(/\d{1,2} [A-Z][a-z]+ \d{4}/g, "")).not.toMatch(/\b\d{4}\b/);
    // isian penting kosong ikut disebut, huruf alasan tidak disebut dua kali
    expect(qq(h, '#bd-periksa [data-periksa="kosong"]').length).toBeGreaterThan(0);
    expect(qq(h, '#bd-periksa [data-periksa="kosong"]').some((x) => /ALASAN PERCERAIAN/i.test(x.textContent || ""))).toBe(false);
    (huruf.querySelector('[data-bd2="perbaiki"]') as HTMLElement).click();
    await sampai(() => q(h, '.bd-f[data-f="8503"]')?.classList.contains("bd-sorot"), "kotak huruf alasan disorot");
    expect(doc(h).activeElement).toBe(q(h, "#bd-i8503"));
    // Perbaiki tidak menulis apa pun ke ABT
    expect(mintaKe(h, /edit_data\?no_var=8503/, "POST")).toEqual([]);
  });

  it("titik koma di tengah isian tersimpan: butir sendiri; Perbaiki merapikan lalu menyimpan (titik koma menjadi koma)", async () => {
    const h = buka({ abtAwal: { ...POSITA_ABT, "1006": "di rumah orang tua Penggugat; kemudian di rumah sendiri" } });
    await bukaBlangko(h);
    const b = await sampai(() => q(h, '#bd-periksa [data-periksa="titikkoma"]'), "butir titik koma");
    expect(b.textContent).toMatch(/titik koma di tengah isian/);
    (b.querySelector('[data-bd2="perbaiki"]') as HTMLElement).click();
    await sampai(() => h.abt["1006"] === "di rumah orang tua Penggugat, kemudian di rumah sendiri", "dirapikan & tersimpan");
    await sampai(() => !q(h, '#bd-periksa [data-periksa="titikkoma"]'), "butir hilang sesudah dirapikan");
  });

  it("semua isian penting terisi dan tanpa temuan: daftar tersembunyi (tidak menambah apa pun di layar)", async () => {
    const h = buka({ abtAwal: { ...POSITA_ABT, "8503": "F", "0007": "telah dikaruniai 2 orang anak", "1006": "di rumah orang tua Penggugat", "0222": "bulan Januari 2025" } });
    await bukaBlangko(h);
    await sampai(() => q(h, '[data-bd2="cetak"]') && q(h, "#bd-periksacetak"), "langkah cetak");
    await tunggu(200);
    expect(q(h, "#bd-periksacetak")!.hidden).toBe(true);
    expect(q(h, "#bd-periksa")!.children.length).toBe(0);
  });
});

// ============================================================================
// 1.2 - aturan murni pemeriksa
// ============================================================================
function muatPeriksa() {
  const g: Record<string, unknown> = {};
  new Function("globalThis", "window", baca("blangko-derry-periksa.js"))(g, g);
  return g.AletaPeriksaCetak as {
    kumpulkan: (b: unknown) => Array<{ jenis: string; teks: string; perbaiki: { aksi: string; kode?: string } | null }>;
    html: (d: unknown, esc?: unknown) => string;
    adaTitikKomaTengah: (v: string) => boolean;
  };
}
describe("1.2 aturan pemeriksa (murni)", () => {
  const m = muatPeriksa();
  const sisa = reqEks("./deteksi-sisa-blangko.js") as { periksaRtf: (r: string) => { temuan: unknown[] } };
  const rtf = (...par: string[]) => `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}${par.map((p) => `\\pard ${p}\\par`).join("")}}`;

  it("tanpa temuan -> daftar kosong (tidak tampil)", () => {
    expect(m.kumpulkan({ huruf: { ada: true, nilai: "F", dikenal: true }, kosong: [], titikKoma: [], naskah: { teks: "Menimbang, bahwa ...", temuanSisa: [] }, prodeo: false, kodeAda: new Set() })).toEqual([]);
  });
  it("bunyi agama baru dan lama di naskah -> butir agama (bukan butir huruf alasan)", () => {
    for (const bunyi of ["[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]", "TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP - ubah agama pihak itu di SIPP, lalu muat ulang ABT"]) {
      const d = m.kumpulkan({ naskah: { teks: `Menimbang, bahwa ${bunyi};`, temuanSisa: [] } });
      expect(d.map((x) => x.jenis)).toEqual(["agama"]);
    }
  });
  it("bunyi huruf alasan lama ('TIDAK BENAR QUERY NYA') di naskah tanpa kotak huruf -> butir huruf ke pratinjau", () => {
    const d = m.kumpulkan({ naskah: { teks: "Menimbang, bahwa TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT;", temuanSisa: [] } });
    expect(d).toEqual([expect.objectContaining({ jenis: "huruf", perbaiki: { aksi: "pratinjau" } })]);
  });
  it("prodeo dengan nominal biaya -> butir; bukan prodeo atau Rp0 -> tidak", () => {
    const t = "Membebankan biaya perkara kepada Penggugat sejumlah Rp290.000,00 (dua ratus sembilan puluh ribu rupiah);";
    expect(m.kumpulkan({ prodeo: true, naskah: { teks: t, temuanSisa: [] } }).map((x) => x.jenis)).toEqual(["prodeo"]);
    expect(m.kumpulkan({ prodeo: false, naskah: { teks: t, temuanSisa: [] } })).toEqual([]);
    expect(m.kumpulkan({ prodeo: true, naskah: { teks: "Membebankan biaya perkara kepada DIPA Pengadilan Agama Donggala Tahun 2026;", temuanSisa: [] } })).toEqual([]);
    expect(m.kumpulkan({ prodeo: true, naskah: { teks: "Membebankan biaya perkara kepada Pemohon sejumlah Rp0,00;", temuanSisa: [] } })).toEqual([]);
    // bunyi blangko sebelum paket prodeo-panggilan (render 9558): terbilang di belakang DIPA; "(nihil)" bukan nominal
    expect(m.kumpulkan({ prodeo: true, naskah: { teks: "Membebankan biaya perkara kepada DIPA Pengadilan Agama Donggala Tahun 2026 (dua puluh ribu Nihil).", temuanSisa: [] } }).map((x) => x.jenis)).toEqual(["prodeo"]);
    expect(m.kumpulkan({ prodeo: true, naskah: { teks: "Jumlah Rp 0,00 (nihil). Membebankan biaya perkara kepada DIPA Pengadilan Agama Donggala Tahun 2026 (nihil).", temuanSisa: [] } })).toEqual([]);
  });
  it("tanggal panggilan ganda -> butir; dua tanggal berbeda -> tidak", () => {
    expect(m.kumpulkan({ naskah: { teks: "telah dipanggil secara resmi dan patut pada tanggal 26 Oktober 2026 dan tanggal 26 Oktober 2026, tidak hadir", temuanSisa: [] } }).map((x) => x.jenis)).toEqual(["tanggal"]);
    expect(m.kumpulkan({ naskah: { teks: "dipanggil pada tanggal 12 Oktober 2026 dan tanggal 26 Oktober 2026", temuanSisa: [] } })).toEqual([]);
  });
  it("sisa blangko dari deteksi-sisa-blangko dikelompokkan per jenis; #kode# yang ada di blangko -> Perbaiki ke isiannya", () => {
    const t = sisa.periksaRtf(rtf("Menimbang, bahwa [nama saksi] menerangkan;", "Tergugat bekerja sebagai #2004#;", "tanggal ........ "));
    const d = m.kumpulkan({ naskah: { teks: "", temuanSisa: t.temuan }, kodeAda: new Set(["2004"]), namaIsian: new Map([["2004", "Pekerjaan terakhir Tergugat"]]) });
    const jenis = d.map((x) => x.jenis);
    expect(jenis).toContain("sisa-kurung");
    expect(jenis).toContain("sisa-tanda");
    const tanda = d.find((x) => x.jenis === "sisa-tanda")!;
    expect(tanda.perbaiki).toEqual({ aksi: "isian", kode: "2004" });
    // nomor variabel tidak tampil; yang disebut nama isiannya
    expect(tanda.teks).toContain("Pekerjaan terakhir Tergugat");
    expect(tanda.teks).not.toMatch(/\b\d{4}\b/);
    expect(d.find((x) => x.jenis === "sisa-kurung")!.perbaiki).toEqual({ aksi: "pratinjau" });
  });
  it("huruf sudah dipilih tetapi naskah tetap berbunyi 'belum dipilih' (render nyata: H saja pada pertimbangan bukti surat) -> butir cabang ke pratinjau", () => {
    const d = m.kumpulkan({ huruf: { ada: true, nilai: "H", dikenal: true }, naskah: { teks: "Menimbang, bahwa [HURUF ALASAN PERCERAIAN BELUM DIPILIH];", temuanSisa: [] } });
    expect(d).toEqual([expect.objectContaining({ jenis: "huruf-cabang", perbaiki: { aksi: "pratinjau" } })]);
    expect(d[0].teks).toContain('"H" sudah dipilih');
  });

  it("kurung bunyi huruf alasan di sisa blangko tidak disebut dua kali", () => {
    const t = sisa.periksaRtf(rtf("Menimbang, bahwa [HURUF ALASAN PERCERAIAN BELUM DIPILIH];"));
    const d = m.kumpulkan({ huruf: { ada: true, nilai: "", dikenal: false }, naskah: { teks: "Menimbang, bahwa [HURUF ALASAN PERCERAIAN BELUM DIPILIH];", temuanSisa: t.temuan }, kodeAda: new Set(["8503"]) });
    expect(d.map((x) => x.jenis)).toEqual(["huruf"]);
    expect(d[0].perbaiki).toEqual({ aksi: "isian", kode: "8503" });
  });
  it("titik koma di tengah: ya untuk 'a; b', tidak untuk titik koma di akhir", () => {
    expect(m.adaTitikKomaTengah("di rumah A; kemudian di rumah B")).toBe(true);
    expect(m.adaTitikKomaTengah("di rumah A;")).toBe(false);
    expect(m.adaTitikKomaTengah("di rumah A; ")).toBe(false);
  });
  it("isian kosong dibatasi delapan butir + satu butir 'lainnya'; HTML berisi tombol Perbaiki dan teks yang aman", () => {
    const kosong = Array.from({ length: 11 }, (_, i) => ({ kode: String(1000 + i), nama: `Isian <${i}>` }));
    const d = m.kumpulkan({ kosong });
    expect(d.filter((x) => x.jenis === "kosong")).toHaveLength(8);
    expect(d.find((x) => x.jenis === "kosong-lain")!.teks).toBe("3 isian penting lain masih kosong.");
    const html = m.html(d);
    expect(html).toContain('data-bd2="perbaiki"');
    expect(html).toContain("Isian &lt;0&gt;");
    expect(html).not.toContain("Isian <0>");
  });
});

// ============================================================================
// 1.3 - bunyi agama baru dikenali bersama bunyi lama
// ============================================================================
describe("1.3 bunyi [AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]", () => {
  const BARU = "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]";
  const LAMA = "TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP - ubah agama pihak itu di SIPP, lalu muat ulang ABT";
  it("panel ABT: keadaanNilai menggolongkan bunyi baru dan lama sebagai galat", () => {
    const isi = baca("abt-panel-blangko.js");
    const a = isi.indexOf("const NILAI_KOSONG = new Set(");
    const b = isi.indexOf('return "terisi";\n}', a);
    const keadaanNilai = new Function(`${isi.slice(a, b + 'return "terisi";\n}'.length)}\nreturn keadaanNilai;`)() as (n: unknown) => string;
    expect(keadaanNilai(BARU)).toBe("galat");
    expect(keadaanNilai(`Menimbang, bahwa ${BARU};`)).toBe("galat");
    expect(keadaanNilai(LAMA)).toBe("galat");
    expect(keadaanNilai("Menimbang, bahwa Tergugat telah murtad;")).toBe("terisi");
  });
  it("pemeriksa cetak (deteksi-sisa-blangko) menemukan bunyi baru sebagai kurung siku", () => {
    const d = reqEks("./deteksi-sisa-blangko.js") as { periksaRtf: (r: string) => { temuan: Array<{ jenis: string; cocok: string }> } };
    const h = d.periksaRtf(`{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\pard Menimbang, bahwa ${BARU};\\par}`);
    expect(h.temuan.some((t) => t.jenis === "kurung" && t.cocok.includes("AGAMA PIHAK"))).toBe(true);
  });
  it("pratinjau panel ABT menyorot bunyi baru (pola penyorot)", () => {
    const m = baca("abt-panel-blangko.js").match(/const pola = (\/.*\/gi);\n/);
    expect(m).toBeTruthy();
    const pola = new Function(`return ${m![1]};`)() as RegExp;
    expect(`Menimbang, bahwa ${BARU};`.match(pola)![0]).toBe(BARU);
  });
  it("paket ABT: PRASYARAT/PASANG/PULIH hanya 4 variabel dan hanya bunyi itu; tanpa kata aplikasi", () => {
    const dir = path.join(AKAR, "abt-paket/agama-belum-diubah-30okt/paket-satker");
    const pasang = readFileSync(path.join(dir, "abt-agama-belum-diubah-30okt-PASANG.sql"), "utf8");
    expect(pasang).toContain("WHERE no_var IN (8521,8522,8528,8531)");
    expect(pasang).toContain(`'<mark>${LAMA}</mark>', '<mark>${BARU}</mark>'`);
    expect(pasang.match(/UPDATE/g)).toHaveLength(1);
    const pulih = readFileSync(path.join(dir, "abt-agama-belum-diubah-30okt-PULIH.sql"), "utf8");
    expect(pulih).toContain(`'<mark>${BARU}</mark>', '<mark>${LAMA}</mark>'`);
    for (const b of ["PASANG", "PULIH", "PRASYARAT", "PERIKSA"]) expect(readFileSync(path.join(dir, `abt-agama-belum-diubah-30okt-${b}.sql`), "utf8")).not.toMatch(/aleta/i);
    expect(readFileSync(path.join(dir, "harap.txt"), "utf8")).toBe("4|0\n0|4\n");
  });
});

// ============================================================================
// 1.4 - pindai mingguan variabel (bot) + kartu Pusat Kesehatan
// ============================================================================
type Pindai = {
  pindaiSekali: (d: unknown) => Promise<any>;
  jalankan: (d: unknown) => Promise<any>;
  bacaHasil: (b?: string) => any;
  golongkan: (v: unknown) => { golongan: string };
  folderCocok: (f: string[], j: string) => boolean;
};
describe("1.4 pindai mingguan variabel Blangko Derry", () => {
  const P = req("./services/pindaiVariabelDerryService.js") as Pindai;
  const KATALOG_V = [
    { no_var: "8521", nama: "PERTIMBANGAN FAKTA HUKUM PERCERAIAN", data_type: "data_sql", modifier: "admin" },
    { no_var: "9001", nama: "VARIABEL RUSAK", data_type: "data_sql", modifier: "admin" },
    { no_var: "9002", nama: "VARIABEL BERPENANDA", data_type: "data_sql", modifier: "admin" },
    { no_var: "9003", nama: "NAMA PIHAK", data_type: "data_sql", modifier: "admin" },
    { no_var: "2021", nama: "TANYA JAWAB", data_type: "tanya_jawab", modifier: "admin" },
  ];
  const peta = new Map([
    ["8521", ["1 Perceraian CG/[01].rtf"]],
    ["9001", ["2 Itsbat/[1].rtf"]],
    ["9002", ["1 Perceraian CG/[01].rtf"]],
    ["9003", ["1 Perceraian CG/[01].rtf", "2 Itsbat/[1].rtf"]],
    ["2021", ["1 Perceraian CG/[01].rtf"]],
  ]);
  const kueriTiruan = (kelompok: unknown[], perkara: Record<string, unknown[]>) => async (sql: string, params: unknown[] = []) => {
    if (/FROM \w+\.abt_variabel/.test(sql)) return KATALOG_V;
    if (/GROUP BY p\.jenis_perkara_id/.test(sql)) return kelompok;
    if (/WHERE perkara_id = \?/.test(sql)) return [{ perkara_id: params[0] }];
    if (/LEFT JOIN perkara_putusan/.test(sql)) return perkara[`${params[0]}|${/IS NOT NULL/.test(sql) ? 1 : 0}`] || [];
    throw new Error(`kueri tak dikenal: ${sql}`);
  };
  const KELOMPOK = [
    { jenis_perkara_id: 347, alur_perkara_id: 15, nama: "Cerai Gugat", n: 300 },
    { jenis_perkara_id: 360, alur_perkara_id: 16, nama: "Pengesahan Perkawinan/Istbat Nikah", n: 40 },
  ];
  const PERKARA = {
    "347|1": [{ perkara_id: 101, nomor_perkara: "1/Pdt.G/2026/PA.X" }],
    "347|0": [{ perkara_id: 102, nomor_perkara: "2/Pdt.G/2026/PA.X" }],
    "360|1": [{ perkara_id: 201, nomor_perkara: "3/Pdt.P/2026/PA.X" }],
  };
  const mesinTiruan = (kosongkan: string[] = []) => () => ({
    nilaiPenanda: async (opsi: { perkaraId: number }, daftar: string[]) => {
      const itsbat = opsi.perkaraId === 201;
      return new Map(
        daftar.map((no) => {
          if (no === "9001") return [no, { status: "galat", sebab: "Unknown column 'x' in 'field list'", polos: "" }];
          if (no === "9002") return [no, { status: "terisi", polos: "Tergugat bekerja sebagai #2004#" }];
          if (no === "8521") return [no, { status: "terisi", polos: itsbat ? "TIDAK BENAR QUERY NYA" : "<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>" }];
          if (kosongkan.includes(no)) return [no, { status: "kosong", polos: "" }];
          return [no, { status: "terisi", polos: "Penggugat Satu" }];
        })
      );
    },
  });
  const deps = (kosongkan: string[] = []) => ({ kueri: kueriTiruan(KELOMPOK, PERKARA), indeksDerry: async () => ({ peta, jumlahBerkas: 2 }), buatMesin: mesinTiruan(kosongkan), skemaAbt: "aps_badilag", kini: new Date("2026-11-01T18:15:00Z") });

  it("golongan: galat kueri (semua jenis), penanda & bunyi hanya pada perkara sejenis; tanya jawab tidak dipindai", async () => {
    const h = await P.pindaiSekali({ ...deps(), sebelum: null });
    expect(h.jumlahVariabel).toBe(4);
    expect(h.contoh.map((c: { perkaraId: number }) => c.perkaraId)).toEqual([101, 102, 201]);
    expect(h.temuan.galat.map((x: { no: string }) => x.no)).toEqual(["9001"]);
    expect(h.temuan.galat[0].jumlah).toBe(3);
    expect(h.temuan.penanda.map((x: { no: string; jumlah: number }) => [x.no, x.jumlah])).toEqual([["9002", 2]]);
    // 8521 cerai: bunyi pada 2 perkara cerai; bunyi lama pada perkara itsbat TIDAK dihitung (bukan jenisnya)
    expect(h.temuan.bunyi.map((x: { no: string; jumlah: number }) => [x.no, x.jumlah])).toEqual([["8521", 2]]);
    expect(h.temuan.kosongBaru).toEqual([]);
  });

  it("tiba-tiba kosong: terisi pekan lalu pada perkara contoh yang SAMA, kini kosong; perkara contoh dipakai lagi", async () => {
    const dir = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "g1-pindai-"));
    try {
      const berkas = path.join(dir, "pindai.json");
      const r1 = await P.jalankan({ ...deps(), berkas });
      expect(r1.adaPembanding).toBe(false);
      const r2 = await P.jalankan({ ...deps(["9003"]), berkas });
      expect(r2.adaPembanding).toBe(true);
      expect(r2.temuan.kosongBaru.map((x: { no: string; jumlah: number }) => [x.no, x.jumlah])).toEqual([["9003", 3]]);
      const s = P.bacaHasil(berkas);
      expect(s.ada).toBe(true);
      expect(s.riwayat).toHaveLength(2);
      expect(s.terakhir.jumlah).toEqual({ galat: 1, lambat: 0, penanda: 1, bunyi: 1, kosongBaru: 1 });
      expect(JSON.stringify(s)).not.toMatch(/"terisi"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("waktu habis bukan galat: diulang sekali dengan batas lebih longgar; yang tetap habis = 'terlalu lama', bukan merah", async () => {
    let mesinKe = 0;
    const buatMesin = (o: { batasKueriMs: number }) => {
      mesinKe += 1;
      const ulang = o.batasKueriMs >= 30000;
      return {
        nilaiPenanda: async (_opsi: unknown, daftar: string[]) =>
          new Map(
            daftar.map((no) => {
              if (no === "9001") return [no, { status: "galat", sebab: "Query inactivity timeout", polos: "" }]; // selalu habis
              if (no === "9003" && !ulang) return [no, { status: "galat", sebab: "bergantung pada #3507# yang gagal diisi (Query inactivity timeout)", polos: "" }];
              return [no, { status: "terisi", polos: "Penggugat Satu" }];
            })
          ),
      };
    };
    const h = await P.pindaiSekali({ ...deps(), buatMesin, sebelum: null });
    expect(mesinKe).toBeGreaterThan(1);
    expect(h.temuan.galat).toEqual([]);
    expect(h.temuan.lambat.map((x: { no: string; jumlah: number }) => [x.no, x.jumlah])).toEqual([["9001", 3]]);
    expect(h.terisi.every((t: { kode: string[] }) => t.kode.includes("9003"))).toBe(true);
    const kini = new Date("2026-11-02T00:00:00Z");
    const k = periksaPindaiVariabel({ ok: true, data: { ada: true, terakhir: { selesai: h.selesai, jumlahVariabel: 4, jumlahContoh: 3, jumlah: { galat: 0, lambat: 1, penanda: 0, bunyi: 0, kosongBaru: 0 }, temuan: { galat: [], lambat: h.temuan.lambat, penanda: [], bunyi: [], kosongBaru: [] }, adaPembanding: false } } }, kini);
    expect(k.warna).toBe("kuning");
    expect(k.ringkas).toMatch(/terlalu lama dihitung/);
  });

  it("hanya membaca: tiap kueri SELECT, tanpa kata penulis", async () => {
    const terlihat: string[] = [];
    const k = kueriTiruan(KELOMPOK, PERKARA);
    await P.pindaiSekali({ ...deps(), kueri: async (sql: string, p: unknown[]) => (terlihat.push(sql), k(sql, p)), sebelum: null });
    expect(terlihat.length).toBeGreaterThan(0);
    for (const sql of terlihat) {
      expect(sql.trim()).toMatch(/^SELECT/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE INTO|CREATE|ALTER|DROP|CALL)\b/i);
    }
  });

  it("kartu Pusat Kesehatan: kelabu belum pernah, merah bila error/penanda, kuning bila tiba-tiba kosong atau basi, hijau bila bersih", () => {
    const kini = new Date("2026-11-02T00:00:00Z");
    expect(periksaPindaiVariabel(undefined, kini).warna).toBe("kelabu");
    expect(periksaPindaiVariabel({ ok: true, data: { ada: false } }, kini).warna).toBe("kelabu");
    const dasar = (j: { galat: number; penanda: number; bunyi: number; kosongBaru: number }, selesai = "2026-11-01T18:30:00Z") => ({
      ok: true as const,
      data: { ada: true, terakhir: { selesai, jumlahVariabel: 1630, jumlahContoh: 18, jumlah: j, temuan: { galat: [], penanda: [], bunyi: [], kosongBaru: [] }, adaPembanding: true } },
    });
    expect(periksaPindaiVariabel(dasar({ galat: 1, penanda: 0, bunyi: 0, kosongBaru: 0 }), kini).warna).toBe("merah");
    expect(periksaPindaiVariabel(dasar({ galat: 0, penanda: 0, bunyi: 5, kosongBaru: 2 }), kini).warna).toBe("kuning");
    expect(periksaPindaiVariabel(dasar({ galat: 0, penanda: 0, bunyi: 5, kosongBaru: 0 }, "2026-10-20T00:00:00Z"), kini).warna).toBe("kuning");
    const hijau = periksaPindaiVariabel(dasar({ galat: 0, penanda: 0, bunyi: 5, kosongBaru: 0 }), kini);
    expect(hijau.warna).toBe("hijau");
    expect(hijau.ringkas).not.toMatch(/\b\d{4}\b(?! variabel)/);
  });

  it("dijadwalkan mingguan di luar jam kerja (Minggu 02.15), dapat dimatikan", () => {
    const P2 = req("./services/pindaiVariabelDerryService.js") as { jadwal: (c: unknown, env: Record<string, string>) => unknown };
    const dipasang: string[] = [];
    const cron = { schedule: (e: string) => (dipasang.push(e), { e }) };
    expect(P2.jadwal(cron, {})).toBeTruthy();
    expect(dipasang).toEqual(["15 02 * * 0"]);
    expect(P2.jadwal(cron, { ALETA_PINDAI_VARIABEL: "0" })).toBeNull();
    expect(readFileSync(path.join(AKAR, "aleta_bot/app.js"), "utf8")).toContain('require("./services/pindaiVariabelDerryService").jadwal(cron)');
  });
});
