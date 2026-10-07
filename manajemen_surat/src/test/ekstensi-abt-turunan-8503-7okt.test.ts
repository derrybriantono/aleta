// @vitest-environment node
/**
 * ============================================================================
 * 7 OKT 2026 - 8503 DAN TURUNANNYA SATU KESATUAN (UI BARU)
 * ============================================================================
 *
 * Keluhan pengguna (tangkapan 30): pita merah panel ABT menyebut "2 variabel
 * berbunyi pesan error (8531, 8532)", padahal 4020, 8524, 8521, 8522, 8528,
 * 8529, 8530, 8531, dan 8532 seluruhnya berbunyi "TIDAK BENAR QUERY NYA"
 * karena SATU sebab: huruf alasan 8503 belum diisi.
 *
 * Yang dijaga (panel-alat.js + abt.js dijalankan sungguhan di jsdom):
 *   1. deteksi error mencakup SEMUA turunan (8524, 8531, 8532 ikut)
 *   2. selama 8503 kosong/tidak sah: SATU butir "Isi huruf alasan perceraian
 *      (8503)", bukan daftar error per variabel
 *   3. Simpan di butir itu = POST abt/edit_data 8503 (jalur tulis yang sama),
 *      lalu halaman blangko dibaca ulang (GET) dan sel turunan diganti di
 *      tempat - butir hilang, pita error tidak muncul
 *   4. usulan yakin menjadi bawaan isian (belum tersimpan); usulan RAGU tidak
 *      pernah diisikan sendiri dan tidak ada tulisan apa pun sebelum Simpan
 *   5. CETAK tetap meminta "Sudah saya periksa" selama turunan berbunyi error
 *   6. tampilan Baru tidak mendapat butir ini (8531/8532 kini ikut "menunggu")
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ABT = process.env.ALETA_UJI_ABT ? readFileSync(process.env.ALETA_UJI_ABT, "utf8").replace(/\r\n/g, "\n") : baca("abt.js");

const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "533/Pdt.G/2026/PA.Dgl";
const CETAK = `${ASAL_ABT}/preview?c=10018&b=B&a=A`;
const ALAMAT = `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`;

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
    await tunggu(10);
  }
}

const Q = "TIDAK BENAR QUERY NYA";
const QA = "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT";
const TURUNAN = ["4020", "8524", "8531", "8532", "8529", "8528", "8521", "8522", "8530"];

const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5125": "Bahwa sejak bulan November 2022 sering terjadi perselisihan;",
  "0033": "07 Oktober 2026",
  "2021": "Saksi kenal dengan kedua pihak.",
  "2022": "Penggugat dan Tergugat menikah tahun 2018.",
  "0222": "bulan November 2022",
  "5227": "Tergugat sering berkata kasar",
  "0246": "bulan April 2025",
  "9944": "1 tahun",
  "7035": "Tergugat",
  "1268": "pihak keluarga telah berusaha merukunkan",
  "8503": "DATA_TIDAK_ADA",
  "4020": QA,
  "8524": Q,
  "8531": QA,
  "8532": QA,
  "8529": Q,
  "8528": Q,
  "8521": Q,
  "8522": Q,
  "8530": QA,
};
/** Sesudah 8503 = F: yang dihitung ABT ketika halaman disusun ulang. */
const SESUDAH_F: Record<string, string> = {
  "8503": "F",
  "4020": "Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975",
  "8524": "",
  "8531": "Menimbang, bahwa pokok alasan perceraian adalah perselisihan",
  "8532": "Menimbang, bahwa dasar normatifnya Pasal 19 huruf f",
  "8529": "Menimbang, bahwa bukti surat",
  "8528": "Menimbang, bahwa alat bukti saksi",
  "8521": "Menimbang, bahwa fakta hukumnya",
  "8522": "Menimbang, bahwa petitum berdasarkan fakta",
  "8530": "Menimbang, bahwa petitum perceraian",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "5125": "POSITA LENGKAP",
  "8503": "HURUF ALASAN PERCERAIAN (A-H GABUNGAN BEBAS)",
  "4020": "KALIMAT ALASAN (OTOMATIS)",
  "8524": "PERTIMBANGAN HUKUM PNS/BUMN/BUMD/POLRI/TNI",
  "8531": "POKOK ALASAN PERCERAIAN (OTOMATIS DARI 8503)",
  "8532": "DASAR NORMATIF ALASAN PERCERAIAN (OTOMATIS DARI 8503)",
  "8529": "PERTIMBANGAN BUKTI SURAT PERCERAIAN VERSTEK",
  "8528": "PERTIMBANGAN ALAT BUKTI SAKSI PERCERAIAN VERSTEK",
  "8521": "PERTIMBANGAN FAKTA HUKUM PERCERAIAN (OTOMATIS)",
  "8522": "PERTIMBANGAN PETITUM BERDASARKAN FAKTA PERCERAIAN",
  "8530": "PERTIMBANGAN PETITUM PERCERAIAN",
};

const SAKSI_DASAR = {
  butir: { saksi1: 2, saksi2: 2 },
  selisih: [],
  ciri: ["perselisihan terus-menerus"],
  ciriSepihak: [{ nama: "tidak memberi nafkah", saksi: 2 }],
  ciriDiluarGugatan: [],
  ciriBelumTerbukti: [],
  gugatanTerbaca: true,
  hurufTidakDiusulkan: [],
  hurufBelumSiap: [],
  usulan: [],
};
const HURUF_YAKIN_DAN_RAGU = [
  { huruf: "F", pemicu: ["perselisihan terus-menerus"], syarat: "", dasar: [] },
  { huruf: "B", pemicu: ["tidak memberi nafkah"], syarat: "", dasar: [], centangOtomatis: false },
];

type Minta = { url: string; cara: string; badan: string };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };
type Pengganti = (url: string, cara: string, badan: string) => Jawab | undefined;

function tabel(isi: Record<string, string>, nama: Record<string, string>) {
  return Object.keys(isi)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${nama[k] || `Variabel ${k}`}</td>` +
        `<td>${isi[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
}

function halamanHtml(isi: Record<string, string>, nama: Record<string, string>) {
  return (
    `<div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3>` +
    `<h2>CG (Lite) Verstek F V.2</h2>` +
    `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${tabel(isi, nama)}</table></div></div>`
  );
}

function jawabBaku(saksi: unknown, url: string, cara: string, badan: string): Jawab {
  if (url.includes("/aleta-bot/abt/usulan")) {
    const muatan = JSON.parse(badan || "{}");
    if (muatan.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama: "Uji Hakim", peran: "Hakim" }, kapabilitas: {} } } };
    if (muatan.sumber === "sipp") return { isi: { data: { available: true, sipp: { ok: true, jumlahKuasa: 0, prodeo: false, usulan: [] } } } };
    if (muatan.sumber === "saksi") return { isi: { data: { available: true, saksi } } };
    return { isi: { data: { available: true } } };
  }
  if (url.includes("/aleta-bot/sipp/posita")) return { isi: { data: { available: true, berubah: false, alasan: "sudah rapi" } } };
  if (url.includes("/aleta-ecourt/bas-komentar")) {
    return { isi: { ok: true, data: { komentar: [], saya: { id: "h", nama: "Hakim", bolehMenulis: false, bolehMenyelesaikanSemua: false } } } };
  }
  if (url.includes("/aleta-ecourt/abt-wajib")) return { isi: { ok: true, data: { jenis: "Cerai Gugat", variabel: [], catatan: "" } } };
  if (url.includes("/aleta-ecourt/abt-riwayat")) return { isi: { ok: true, data: { daftar: [] } } };
  if (url.includes("/aleta-ecourt/templat-hukum")) return { isi: { ok: true, data: { butir: [], bolehMenyunting: false } } };
  if (url.includes("/edit_data?")) {
    if (cara === "POST") return { mentah: "<b>DATA DISIMPAN</b>", jenis: "text/html" };
    return { mentah: '<input type="hidden" name="var_type" value="data_teks">', jenis: "text/html" };
  }
  if (url.includes("/tanyajawab_perkara_edit?")) return { mentah: "<script>\n var ajax_data = [] \n</script>", jenis: "text/html" };
  if (url.includes("/aps_badilag/") && cara === "GET") return { mentah: "<html><body></body></html>", jenis: "text/html" };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}

function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) return new Response(Buffer.from(j.mentah, "latin1"), { status, headers: { "content-type": j.jenis || "text/plain" } });
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

type Halaman = { dom: JSDOM; w: any; minta: Minta[]; konfirmasi: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  tampilan?: "ui" | "baru";
  isi?: Record<string, string>;
  nama?: Record<string, string>;
  huruf?: unknown[];
  ganti?: Pengganti;
};

function buka(p: Opsi = {}): Halaman {
  const isi = { ...ISI, ...(p.isi || {}) };
  const nama = { ...NAMA, ...(p.nama || {}) };
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${halamanHtml(isi, nama)}</body></html>`, {
    url: ALAMAT,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.tampilan ?? "ui", ujiFitur: p.tampilan === "baru" ? { "abt-5": true } : {}, ujiIzinkanNyata: true };
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.187.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (baru: Record<string, unknown>) => {
          const ubah: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(baru)) {
            ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => {
            for (const f of [...pendengar]) f(polos(ubah), "local");
          }, 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const saksi = { ...SAKSI_DASAR, huruf: p.huruf ?? HURUF_YAKIN_DAN_RAGU };
  const minta: Minta[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const b = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: b });
    return tanggapan((p.ganti && p.ganti(url, cara, b)) || jawabBaku(saksi, url, cara, b));
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  const konfirmasi: string[] = [];
  w.confirm = (pesan: string) => {
    konfirmasi.push(pesan);
    return false;
  };
  w.document.addEventListener("click", (e: any) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) e.preventDefault();
  });
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { dom, w, minta, konfirmasi };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const q = (h: Halaman, pemilih: string) => panelDari(h)?.querySelector(pemilih) as any;
const qs = (h: Halaman, pemilih: string) => Array.from(panelDari(h)?.querySelectorAll(pemilih) || []) as any[];
const pita8503 = (h: Halaman) => q(h, ".aleta-t6-pita-8503");
const pitaBahaya = (h: Halaman) => q(h, ".aleta-t6-pita-bahaya");
const kotakKetik = (h: Halaman) => q(h, ".aleta-t6-8503-ketik");
const simpan8503 = (h: Halaman) => q(h, ".aleta-t6-8503-simpan");
const tulisAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
const selNilai = (h: Halaman, kode: string) => h.w.document.getElementById(kode).parentElement.children[2];
/** Butir 8503 sudah tergambar DAN usulan saksi sudah dibaca (bawaan isian terpasang). */
const siapButir = (h: Halaman) =>
  sampai(() => {
    const p = pita8503(h);
    return p && !p.hidden && kotakKetik(h) && /Usulan|tidak terdeteksi/.test(p.textContent) && !/belum terbaca/.test(p.textContent) ? p : null;
  }, "butir 8503 dengan usulan");

function ketik(h: Halaman, nilai: string) {
  const el = kotakKetik(h);
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
}

// ============================================================================
describe("1-2. deteksi semua turunan dan satu butir 8503", () => {
  it("8503 kosong + sembilan turunan berbunyi error: tidak ada daftar error per variabel, satu butir 'Isi huruf alasan perceraian (8503)' memuat SEMUA turunan", async () => {
    const h = buka();
    const p = await siapButir(h);
    expect(p.querySelector(".aleta-t6-pita-judul").textContent).toBe("Isi huruf alasan perceraian (8503)");
    expect(p.textContent).toContain("8503 masih kosong, sehingga 9 variabel turunannya");
    const kode = Array.from(p.querySelectorAll(".aleta-t6-keping")).map((b: any) => b.textContent.split(" ")[0]);
    expect(kode.sort()).toEqual([...TURUNAN].sort());
    // Pita error (yang dulu berbunyi "2 variabel berbunyi pesan error (8531, 8532)") tidak tampil.
    expect(pitaBahaya(h).hidden).toBe(true);
    expect(panelDari(h).textContent).not.toContain("berbunyi pesan error (8531");
    // Catatan "menunggu" UI Baru juga tidak menyebut turunannya - satu sebab, disebut sekali.
    const t = q(h, ".aleta-t6-pita-tunggu");
    expect(!t || t.hidden || !/8531|4020/.test(t.textContent)).toBe(true);
    // Delapan tombol huruf A-H (blangko berpaket: semuanya dapat dipilih).
    const huruf = qs(h, ".aleta-t6-8503-tombol-huruf");
    expect(huruf.map((b) => b.textContent)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(huruf.every((b) => !b.disabled)).toBe(true);
  });

  it("variabel lain yang berbunyi error tetap di pita error - hanya turunan 8503 yang dihimpun", async () => {
    const h = buka({ isi: { "0663": Q } });
    await siapButir(h);
    const pita = await sampai(() => (pitaBahaya(h) && !pitaBahaya(h).hidden ? pitaBahaya(h) : null), "pita error");
    expect(pita.textContent).toContain("1 variabel berbunyi pesan error (0663)");
    expect(pita.textContent).not.toMatch(/8531|8532|4020/);
  });

  it("8503 berisi bentuk yang tidak dikenali ('A, F'): butir tetap muncul dan isian dirapatkan dari isi sekarang", async () => {
    const h = buka({ isi: { "8503": "A, F" } });
    const p = await siapButir(h);
    expect(p.textContent).toContain('8503 berisi "A, F" - bentuk itu tidak dikenali kueri ABT');
    expect(kotakKetik(h).value).toBe("AF");
    expect(p.textContent).toContain("Diambil dari isi 8503 sekarang");
  });

  it("8503 sudah sah (F) dan turunan masih error sejak halaman dimuat: bukan butir 8503 (pita error lama yang berlaku)", async () => {
    const h = buka({ isi: { "8503": "F" } });
    await sampai(() => q(h, ".aleta-sore-input"), "panel siap");
    await tunggu(100);
    expect(!pita8503(h) || pita8503(h).hidden).toBe(true);
    // Tidak ada baca ulang halaman: isi 8503 tidak berubah sejak dimuat.
    expect(h.minta.filter((m) => m.cara === "GET" && m.url === ALAMAT)).toEqual([]);
  });

  it("Baru: tidak ada butir 8503; 8531/8532/8524 kini ikut 'akan terisi sesudah 8503', bukan pita error", async () => {
    const h = buka({ tampilan: "baru" });
    const t = await sampai(() => (q(h, ".aleta-t6-pita-tunggu:not([hidden])") ? q(h, ".aleta-t6-pita-tunggu") : null), "pita tunggu Baru");
    for (const kode of ["8524", "8531", "8532"]) expect(t.textContent).toContain(kode);
    expect(pitaBahaya(h).hidden).toBe(true);
    expect(pita8503(h)).toBeNull();
  });
});

// ============================================================================
describe("3. isi 8503 memicu simpan ke ABT lalu hitung ulang turunan", () => {
  it("Simpan ke ABT: POST edit_data 8503=F, halaman dibaca ulang (GET), sel turunan terisi di tempat, butir dan error hilang", async () => {
    const ganti: Pengganti = (url, cara) =>
      cara === "GET" && url === ALAMAT ? { mentah: `<html><body>${halamanHtml({ ...ISI, ...SESUDAH_F }, NAMA)}</body></html>`, jenis: "text/html" } : undefined;
    const h = buka({ ganti });
    await siapButir(h);
    expect(kotakKetik(h).value).toBe("F");
    expect(tulisAbt(h)).toEqual([]);
    simpan8503(h).click();
    const kabar = await sampai(
      () => (/tidak ada lagi pesan error dari 8503/.test(pita8503(h)?.textContent || "") ? pita8503(h) : null),
      "kabar hitung ulang"
    );
    // Jalur tulis yang sama dengan Input ke ABT: satu POST edit_data untuk 8503.
    const tulis = tulisAbt(h);
    expect(tulis).toHaveLength(1);
    expect(tulis[0].url).toContain("edit_data?no_var=8503&perkara_id=10018");
    expect(new URLSearchParams(tulis[0].badan).get("value")).toBe("F");
    expect(new URLSearchParams(tulis[0].badan).get("aksi")).toBe("Simpan");
    // Dibaca ulang SEKALI (pengamat tabel dan tombol tidak menggandakannya).
    expect(h.minta.filter((m) => m.cara === "GET" && m.url === ALAMAT)).toHaveLength(1);
    expect(selNilai(h, "8531").textContent).toBe(SESUDAH_F["8531"]);
    expect(selNilai(h, "4020").textContent).toBe(SESUDAH_F["4020"]);
    expect(selNilai(h, "8503").textContent).toBe("F");
    expect(kabar.querySelector(".aleta-t6-8503-ketik")).toBeNull();
    await tunggu(500);
    expect(pitaBahaya(h).hidden).toBe(true);
    expect(panelDari(h).textContent).not.toContain("berbunyi pesan error");
  });

  it("8503 diisi di luar butir (sunting di tempat / Input ke ABT mengubah selnya): turunan dihitung ulang sendiri, tanpa tulisan tambahan", async () => {
    const ganti: Pengganti = (url, cara) =>
      cara === "GET" && url === ALAMAT ? { mentah: `<html><body>${halamanHtml({ ...ISI, ...SESUDAH_F }, NAMA)}</body></html>`, jenis: "text/html" } : undefined;
    const h = buka({ ganti });
    await siapButir(h);
    selNilai(h, "8503").textContent = "F";
    await sampai(() => selNilai(h, "8532").textContent === SESUDAH_F["8532"], "8532 dihitung ulang");
    expect(h.minta.filter((m) => m.cara === "GET" && m.url === ALAMAT)).toHaveLength(1);
    expect(tulisAbt(h)).toEqual([]);
    await sampai(() => /tidak ada lagi pesan error dari 8503/.test(pita8503(h)?.textContent || ""), "kabar");
  });

  it("tombol huruf: A lalu F menjadi 'AF'; Enter menyimpan", async () => {
    const h = buka({ huruf: [] });
    await siapButir(h);
    expect(kotakKetik(h).value).toBe("");
    expect(simpan8503(h).disabled).toBe(true);
    const tombol = (x: string) => qs(h, ".aleta-t6-8503-tombol-huruf").find((b) => b.textContent === x);
    tombol("F").click();
    tombol("A").click();
    expect(kotakKetik(h).value).toBe("AF");
    expect(tombol("A").getAttribute("aria-pressed")).toBe("true");
    expect(simpan8503(h).disabled).toBe(false);
    kotakKetik(h).dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sampai(() => tulisAbt(h).length === 1, "8503 tertulis");
    expect(new URLSearchParams(tulisAbt(h)[0].badan).get("value")).toBe("AF");
  });

  it("baca ulang gagal (halaman tanpa tabel): 8503 tetap tersimpan, kabar meminta muat ulang dengan tombolnya", async () => {
    const h = buka();
    await siapButir(h);
    simpan8503(h).click();
    const p = await sampai(() => (/belum dapat dihitung ulang/.test(pita8503(h)?.textContent || "") ? pita8503(h) : null), "kabar gagal");
    expect(tulisAbt(h)).toHaveLength(1);
    expect(p.querySelector(".aleta-t6-8503-ulang").textContent).toBe("Muat ulang halaman");
  });

  it("gabungan yang tidak dikenali blangko tanpa paket (CF) ditolak sebelum menulis; C/D/E/G tidak dapat dipilih", async () => {
    const h = buka({ nama: { "8503": "HURUF ALASAN PERCERAIAN" } });
    await siapButir(h);
    const huruf = qs(h, ".aleta-t6-8503-tombol-huruf");
    expect(huruf.filter((b) => b.disabled).map((b) => b.textContent)).toEqual(["C", "D", "E", "G"]);
    ketik(h, "C F");
    expect(simpan8503(h).disabled).toBe(true);
    expect(q(h, ".aleta-t6-8503-periksa").textContent).toContain("Gabungan CF belum punya cabang");
    simpan8503(h).click();
    await tunggu(50);
    expect(tulisAbt(h)).toEqual([]);
  });

  it("blangko berpaket (GABUNGAN BEBAS): CF diterima", async () => {
    const h = buka();
    await siapButir(h);
    ketik(h, "c, f");
    expect(simpan8503(h).disabled).toBe(false);
    expect(q(h, ".aleta-t6-8503-periksa").textContent).toBe('Akan disimpan sebagai "CF".');
  });
});

// ============================================================================
describe("4. usulan: yakin menjadi bawaan, ragu tidak pernah diisikan diam-diam", () => {
  it("F yakin diisikan (belum tersimpan); B ragu hanya ditawarkan lewat tombol 'Pakai B'", async () => {
    const h = buka();
    const p = await siapButir(h);
    expect(kotakKetik(h).value).toBe("F");
    expect(p.textContent).toContain("Usulan ALETA dari gugatan dan keterangan saksi: F - sudah diisikan di kotak, belum tersimpan");
    expect(p.textContent).toContain("Usulan ragu: B - tidak diisikan sendiri");
    await tunggu(100);
    expect(tulisAbt(h)).toEqual([]);
    q(h, ".aleta-t6-8503-pakai").click();
    expect(kotakKetik(h).value).toBe("BF");
    expect(tulisAbt(h)).toEqual([]);
  });

  it("hanya usulan ragu: isian KOSONG, tidak ada tulisan apa pun", async () => {
    const h = buka({ huruf: [{ huruf: "F", pemicu: ["perselisihan terus-menerus"], syarat: "", dasar: [], centangOtomatis: false }] });
    const p = await siapButir(h);
    expect(kotakKetik(h).value).toBe("");
    expect(simpan8503(h).disabled).toBe(true);
    expect(p.textContent).toContain("Usulan ragu: F - tidak diisikan sendiri");
    await tunggu(150);
    expect(tulisAbt(h)).toEqual([]);
  });

  it("huruf bersyarat (B butuh dua tahun) juga ragu, tidak diisikan", async () => {
    const h = buka({ huruf: [{ huruf: "B", pemicu: ["tidak memberi nafkah"], syarat: "Butuh 2 tahun berturut-turut", dasar: [] }] });
    await siapButir(h);
    expect(kotakKetik(h).value).toBe("");
  });

  it("tidak ada huruf terdeteksi: isian kosong dengan penjelasan", async () => {
    const h = buka({ huruf: [] });
    const p = await siapButir(h);
    expect(kotakKetik(h).value).toBe("");
    expect(p.textContent).toContain("Huruf alasan tidak terdeteksi dari gugatan maupun keterangan saksi");
  });
});

// ============================================================================
describe("5. CETAK tetap dijaga selama turunan berbunyi error", () => {
  it("klik CETAK: dialog 'Sudah saya periksa' menyebut 8503 dan seluruh turunannya", async () => {
    const h = buka();
    await siapButir(h);
    h.w.document.getElementById("cetak").click();
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog CETAK");
    expect(tirai.textContent).toContain("Huruf alasan perceraian (8503) belum diisi atau tidak dikenali ABT");
    for (const kode of TURUNAN) expect(tirai.textContent).toContain(kode);
    expect(tirai.querySelector(".aleta-t6-dialog-periksa")).not.toBeNull();
    expect(tirai.textContent).toContain("Sudah saya periksa");
  });
});
