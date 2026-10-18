// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 30 SEP SORE - PANEL ABT SEDERHANA DAN MENU PER PERAN (AGEN T)
 * ============================================================================
 *
 * panel-alat.js dan abt.js dijalankan SUNGGUHAN di jsdom beralamat halaman
 * blangko ABT (dan beranda ABT). Yang ditiru hanya tepi luarnya: chrome.storage
 * dan jawaban jaringan.
 *
 * Yang dijaga (tampilan Baru dan UI Baru; Lama dijaga ekstensi-abt-tahap6
 * "SYARAT MUTLAK"):
 *   1. menu panel perkara per peran (alatMenuPeran "abt","perkara") dan
 *      penanda "ditangani" (K2): yang di luar menu DISEMBUNYIKAN, tidak dihapus
 *   2. beranda ABT per peran (alatMenuPeran "abt","daftar"): juru sita tidak
 *      melihat Putusan massal; BAS massal & Relaas/PBT massal dipasang lewat
 *      fungsi agen M/J, yang belum ada dilewati tanpa error
 *   3. cari/kemajuan/wajib/komentar kosong pindah ke ⋯; komentar berisi = pita
 *   4. penjelasan teknis berkelas aleta-teknis; error tidak
 *   5. Isi dari SIPP & Susun saksi berjalan sendiri, HANYA MEMBACA: permintaan
 *      non-GET ke ABT = 0 sebelum "Input ke ABT" ditekan
 *   6. satu tombol tulis ("Input ke ABT") untuk usulan DAN huruf alasan
 *   7. satu daftar, hanya data yang terdeteksi dan belum sama
 *   8. huruf alasan menyebut kenapa ia terdeteksi; rincian lama di balik ⓘ
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan: cacat dipasang pada SALINAN.
const SUMBER_ABT = process.env.ALETA_UJI_ABT ? readFileSync(process.env.ALETA_UJI_ABT, "utf8").replace(/\r\n/g, "\n") : baca("abt.js");

const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "544/Pdt.G/2026/PA.Dgl";
const CETAK = `${ASAL_ABT}/preview?c=10018&b=B&a=A`;
const SEMUA_ABT = Array.from({ length: 30 }, (_, i) => `abt-${i + 1}`);

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

// ----------------------------------------------------------------------------
// Halaman blangko cerai - nama karangan
// ----------------------------------------------------------------------------
const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5125": "Bahwa sejak bulan November 2022 sering terjadi perselisihan karena Tergugat tidak memberi nafkah;",
  "0033": "10 September 2026",
  "1197": "Rahman bin Ali",
  "1203": "Siti binti Umar",
  "2021": "Saksi kenal dengan kedua pihak. Penggugat dan Tergugat menikah tahun 2019.",
  "2022": "Penggugat dan Tergugat menikah tahun 2018.",
  "0222": "DATA_TIDAK_ADA",
  "5227": "DATA_TIDAK_ADA",
  "0246": "DATA_TIDAK_ADA",
  "9944": "DATA_TIDAK_ADA",
  "7035": "DATA_TIDAK_ADA",
  "1268": "DATA_TIDAK_ADA",
  "8503": "DATA_TIDAK_ADA",
  "0132": "DATA_TIDAK_ADA",
  "0156": "DATA_TIDAK_ADA",
  "0661": "DATA_TIDAK_ADA",
  "0227": "DATA_TIDAK_ADA",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "5125": "POSITA LENGKAP",
  "0222": "Awal Konflik",
  "5227": "Alasan-Alasan Cerai",
  "8503": "Huruf Alasan",
  "0132": "Tgl. Kuasa Penggugat",
  "0156": "Kantor Kuasa Penggugat",
  "0661": "No. SK Prodeo",
  "0227": "Tanggal Fasakh",
  "0912": "Nama Hakim Ketua Majelis",
};

const USULAN_SIPP = {
  ok: true,
  jumlahKuasa: 0,
  prodeo: false,
  usulan: [
    { kode: "0132", nama: "Tgl. Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [] },
    { kode: "0156", nama: "Kantor Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [] },
    { kode: "0661", nama: "No. SK Prodeo", nilai: "", keyakinan: "tidak_ada_sumber", sumber: [] },
    { kode: "0227", nama: "Tanggal Fasakh", nilai: "", keyakinan: "tidak_ada_sumber", sumber: [] },
    { kode: "0222", nama: "Awal Konflik", nilai: "bulan November 2022", keyakinan: "ragu", sumber: [{ asal: "posita", kalimat: "sejak bulan November 2022" }] },
  ],
};
const USULAN_SAKSI = {
  butir: { saksi1: 1, saksi2: 1 },
  selisih: [{ hal: "Tahun menikah", saksi1: "2019", saksi2: "2018" }],
  ciri: ["perselisihan terus-menerus"],
  ciriSepihak: [{ nama: "pihak lain (wanita/pria idaman lain)", saksi: 2 }],
  ciriDiluarGugatan: ["judi"],
  ciriBelumTerbukti: ["tidak memberi nafkah"],
  gugatanTerbaca: true,
  huruf: [
    { huruf: "A", pemicu: ["judi"], syarat: "", dasar: [] },
    { huruf: "F", pemicu: ["perselisihan terus-menerus"], syarat: "", dasar: [{ sumber: { nama: "Pasal 19 PP 9/1975" }, bunyi: "huruf f" }] },
  ],
  hurufTidakDiusulkan: [{ huruf: "D", ciri: "kekerasan dalam rumah tangga", sebab: "blangko [01] belum punya cabang" }],
  hurufBelumSiap: [],
  usulan: [
    { kode: "0222", nama: "Awal Konflik", nilai: "November 2022", keyakinan: "pasti", sumber: [{ saksi: 1, kalimat: "sejak November 2022" }] },
    { kode: "9944", nama: "Lama Pisah", nilai: "1 tahun", keyakinan: "cukup", sumber: [] },
    { kode: "7035", nama: "Yang Meninggalkan", nilai: "Tergugat", keyakinan: "bentrok", bentrok: "Penggugat", sumber: [] },
  ],
};
const SAKSI_SDG = {
  ok: true,
  alasan: ["perselisihan terus-menerus"],
  asalAlasan: "posita",
  saksi: [
    { ke: 1, pihak: "P", jawaban: [{ no: "1", tanya: "Apakah saksi kenal?", jawab: "Kenal" }] },
    { ke: 2, pihak: "P", jawaban: [{ no: "1", tanya: "Apakah saksi kenal?", jawab: "Kenal juga" }] },
  ],
};
const KOMENTAR_ADA = [
  {
    id: "kom-1",
    nomor: NOMOR,
    perkaraId: "10018",
    sidangKe: 2,
    bagian: "alasan:f",
    kutipan: "",
    isi: "Pertimbangkan juga huruf F.",
    penulis: { id: "hakim-1", nama: "Hakim Anggota" },
    dibuatPada: "2026-09-29T09:55:00+08:00",
    selesai: false,
    diselesaikanOleh: null,
    diselesaikanPada: null,
  },
];

type Minta = { url: string; cara: string; badan: string };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };
type Pengganti = (url: string, cara: string, badan: string) => Jawab | undefined;

function jawabBaku(peran: string, nama: string, url: string, cara: string, badan: string): Jawab {
  if (url.includes("/aleta-bot/abt/usulan")) {
    const muatan = JSON.parse(badan || "{}");
    if (muatan.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama, peran }, kapabilitas: {} } } };
    if (muatan.sumber === "sipp") return { isi: { data: { available: true, sipp: USULAN_SIPP } } };
    if (muatan.sumber === "saksi") return { isi: { data: { available: true, saksi: USULAN_SAKSI } } };
    if (muatan.sumber === "saksi-sdg") return { isi: { data: { available: true, saksiSdg: SAKSI_SDG } } };
    return { isi: { data: { available: true } } };
  }
  if (url.includes("/aleta-ecourt/bas-komentar")) {
    return { isi: { ok: true, data: { komentar: [], saya: { id: "pp", nama: "Panitera Pengganti", bolehMenulis: false, bolehMenyelesaikanSemua: true } } } };
  }
  if (url.includes("/aleta-ecourt/abt-wajib")) return { isi: { ok: true, data: { jenis: "Cerai Gugat", variabel: [], catatan: "" } } };
  if (url.includes("/aleta-ecourt/abt-riwayat")) return { isi: { ok: true, data: { daftar: [] } } };
  if (url.includes("/edit_data?")) {
    if (cara === "POST") return { mentah: "<b>DATA DISIMPAN</b>", jenis: "text/html" };
    return { mentah: '<input type="hidden" name="var_type" value="data_teks">', jenis: "text/html" };
  }
  if (url.includes("/tanyajawab_perkara_edit?")) {
    if (badan.includes("load_template")) {
      const t = { "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Ya kenal;" } };
      return { mentah: `<script>\n var ajax_data = ${JSON.stringify(t)} \n</script>`, jenis: "text/html" };
    }
    return {
      mentah: `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = [] \n</script>`,
      jenis: "text/html",
    };
  }
  if (url.includes("/tanyajawab_template_edit?")) return { mentah: "<script>\n var ajax_data = [] \n</script>", jenis: "text/html" };
  // Halaman ABT lain (bilah kelompok blangko di beranda): kosong, bukan 404 -
  // lengkapiTokenPeta tidak menangkap 404-nya sendiri.
  if (url.includes("/aps_badilag/") && cara === "GET") return { mentah: "<html><body></body></html>", jenis: "text/html" };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}

function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) return new Response(Buffer.from(j.mentah, "latin1"), { status, headers: { "content-type": j.jenis || "text/plain" } });
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; setel: (isi: Record<string, unknown>) => Promise<void> };

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  simpanan?: Record<string, unknown>;
  peran?: string;
  nama?: string;
  ganti?: Pengganti;
  isi?: Record<string, string>;
  sebelum?: (w: any) => void;
  beranda?: boolean;
  /** Jeda (ms) sebelum jawaban permintaan ini - meniru jaringan lambat. */
  lambat?: (url: string, badan: string) => number;
};

function buka(p: Opsi = {}): Halaman {
  const isiHalaman: Record<string, string> = { ...ISI, ...(p.isi || {}) };
  const baris = Object.keys(isiHalaman)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${isiHalaman[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  const badan = p.beranda
    ? `<div id="wrapper"><div id="cssmenu"></div><div id="navbar"><button class="accordion">Putusan &amp; Penetapan</button></div>` +
      `<div id="content"><div class="pricing_inner_w3ls"><div class="pricing-top"><h3>Putusan</h3></div><div class="pricing-bottom-bottom"></div></div></div></div>`
    : `<div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3>` +
      `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${baris}</table></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, {
    url: p.beranda ? `${ASAL_ABT}/` : `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.175.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const peran = p.peran ?? "Super Admin";
  const nama = p.nama ?? "Uji Peran";
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const b = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: b });
    const ms = p.lambat ? p.lambat(url, b) : 0;
    if (ms) await tunggu(ms);
    const j = (p.ganti && p.ganti(url, cara, b)) || jawabBaku(peran, nama, url, cara, b);
    return tanggapan(j);
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
  w.confirm = () => false;
  w.document.addEventListener("click", (e: any) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) e.preventDefault();
  });
  if (p.sebelum) p.sebelum(w);
  // Disesuaikan 2 Okt (agen A, butir 14): tulisan ke ABT kini didahului
  // alatJedaManusia (0,9-3,5 detik). Uji ini memeriksa ISI tulisan, bukan
  // jedanya (jeda diuji di ekstensi-abt-2okt) - jeda dinolkan DI DALAM skrip
  // yang sama (panel-alat.js "use strict": fungsinya tidak menjadi milik window).
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nwindow.__sore = typeof soreSebabHuruf === "function" ? { soreSebabHuruf, soreKesimpulan, soreBakuNamaAkun } : null;\n;\n/* 2 Okt (agen A, butir 14): jeda manusia dinolkan - lihat catatan di buka() */ if (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { dom, w, simpanan, minta, setel: (isi) => local.set(isi) };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const massalDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt-massal") as any;
const q = (h: Halaman, pemilih: string) => panelDari(h)?.querySelector(pemilih) as any;
const qs = (h: Halaman, pemilih: string) => Array.from(panelDari(h)?.querySelectorAll(pemilih) || []) as any[];
const tombol = (h: Halaman, teks: string | RegExp) => qs(h, "button").find((b) => (typeof teks === "string" ? b.textContent === teks : teks.test(b.textContent)));
const fitur = (kode: string[]) => Object.fromEntries(kode.map((k) => [k, true]));
const ui = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "ui", ujiFitur: fitur(kode), ...lain });
const baru = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "baru", ujiFitur: fitur(kode), ...lain });
const nyata = { ujiIzinkanNyata: true };

/**
 * Tampak menurut CSS blok T: unsur (atau leluhurnya di dalam panel) yang
 * berlabel data-sore-tampak="tidak", atau ber-hidden, tidak tampak.
 */
function tampak(el: any): boolean {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    if (x.getAttribute("data-sore-tampak") === "tidak" || x.hidden) return false;
    if (x.id === "aleta-panel-abt" || x.id === "aleta-panel-abt-massal") return true;
  }
  return true;
}
const kerja = (h: Halaman, jenis: "isi" | "susun") => q(h, `[data-sore-kerja="${jenis}"]`);
const siapPeran = (h: Halaman) => sampai(() => panelDari(h)?.getAttribute("data-sore-golongan"), "peran lapisan sore");
/** Permintaan non-GET ke ABT (aps_badilag) - tulisan ke ABT atau baca lewat POST. */
const nonGetAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
const tulisAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && (/\/edit_data\?/.test(m.url) || /aksi=simpan/.test(m.url)));
const usulanDiminta = (h: Halaman, sumber: string) => h.minta.filter((m) => m.url.includes("/abt/usulan") && JSON.parse(m.badan || "{}").sumber === sumber).length;
const selesaiIsi = (h: Halaman) => sampai(() => (q(h, ".aleta-sore-input") ? q(h, ".aleta-sore-input") : null), "Input ke ABT tergambar");

// ============================================================================
describe("butir 1: menu panel perkara per peran (alatMenuPeran abt/perkara)", () => {
  it("hakim: LANGSUNG Isi dari SIPP & input ke ABT + unggah putusan; susun saksi, juru sita, tombol lama, dan alat disembunyikan (tidak dihapus)", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT), peran: "Hakim" });
    expect(await siapPeran(h)).toBe("hakim");
    await selesaiIsi(h);
    expect(tampak(kerja(h, "isi"))).toBe(true);
    expect(tampak(q(h, ".aleta-abt-bagian"))).toBe(true);
    expect(tampak(kerja(h, "susun"))).toBe(false);
    // Tombol lama tetap di DOM, disembunyikan.
    for (const nama of ["Isi blangko dari SIPP", "Input ke ABT", "Susun keterangan saksi 1 & 2", "Lihat riwayat perubahan", "Rapikan posita & keterangan saksi"]) {
      const t = tombol(h, nama);
      expect(t, nama).toBeDefined();
      expect(tampak(t), nama).toBe(false);
    }
    expect(tampak(q(h, ".aleta-t6-alat"))).toBe(false);
    expect(q(h, ".aleta-sore-bukan-penangan").getAttribute("data-sore-tampak")).toBe("tidak");
  });

  it("panitera pengganti: hanya Susun keterangan saksi - berjalan sendiri sampai pratinjau; Isi dari SIPP dan unggah disembunyikan", async () => {
    const h = buka({ simpanan: ui([]), peran: "Panitera Pengganti", isi: { "2021": "DATA_TIDAK_ADA", "2022": "DATA_TIDAK_ADA" } });
    expect(await siapPeran(h)).toBe("panitera");
    await sampai(() => q(h, ".aleta-sdg-hasil"), "pratinjau saksi tersusun sendiri");
    expect(tampak(kerja(h, "susun"))).toBe(true);
    expect(tampak(q(h, ".aleta-sdg-hasil"))).toBe(true);
    expect(tampak(kerja(h, "isi"))).toBe(false);
    // 9 Okt 2026: PP tidak berhak unggah putusan - bagiannya tidak ada sama sekali.
    expect(q(h, ".aleta-abt-bagian") === null || !tampak(q(h, ".aleta-abt-bagian"))).toBe(true);
    expect(usulanDiminta(h, "sipp")).toBe(0);
    expect(usulanDiminta(h, "saksi-sdg")).toBe(1);
    expect(tulisAbt(h)).toEqual([]);
  });

  it("panitera pengganti, keterangan saksi 1 SUDAH terisi: tidak disusun ulang sendiri (tawaran menimpa = keputusan petugas); tombol Susun menjalankannya", async () => {
    const h = buka({ simpanan: ui([]), peran: "Panitera Pengganti" });
    await siapPeran(h);
    await sampai(() => /sudah terisi di blangko/.test(kerja(h, "susun").textContent), "kabar sudah terisi");
    expect(q(h, ".aleta-sdg-form")).toBeNull();
    expect(usulanDiminta(h, "saksi-sdg")).toBe(0);
    kerja(h, "susun").querySelector(".aleta-sore-jalankan").click();
    await sampai(() => q(h, ".aleta-sdg-hasil"), "pratinjau lewat tombol Susun");
    expect(tulisAbt(h)).toEqual([]);
  });

  it("juru sita: bagian Juru Sita terbuka; tidak ada pembacaan otomatis, kerja lain dan unggah disembunyikan", async () => {
    const dipanggil: any[] = [];
    const h = buka({
      simpanan: baru([]),
      peran: "Jurusita",
      sebelum: (w) => {
        w.aletaJurusitaBoleh = () => true;
        w.aletaJurusitaPasang = async (wadah: any, opsi: any) => {
          dipanggil.push(opsi);
          wadah.appendChild(w.document.createElement("p")).textContent = "isi juru sita";
          return true;
        };
      },
    });
    expect(await siapPeran(h)).toBe("jurusita");
    const js = await sampai(() => q(h, ".aleta-t6-jurusita"), "bagian juru sita");
    await sampai(() => dipanggil.length === 1, "juru sita dipasang");
    expect(js.open).toBe(true);
    expect(tampak(js)).toBe(true);
    await tunggu(150);
    expect(tampak(kerja(h, "isi"))).toBe(false);
    expect(tampak(kerja(h, "susun"))).toBe(false);
    // 9 Okt 2026: juru sita tidak berhak unggah putusan - bagiannya tidak ada sama sekali.
    expect(q(h, ".aleta-abt-bagian") === null || !tampak(q(h, ".aleta-abt-bagian"))).toBe(true);
    expect(usulanDiminta(h, "sipp") + usulanDiminta(h, "saksi")).toBe(0);
  });

  it("Super Admin: seluruhnya tampak; Isi dari SIPP berjalan sendiri, Susun saksi lewat tombolnya", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT) });
    expect(await siapPeran(h)).toBe("admin");
    await selesaiIsi(h);
    for (const el of [kerja(h, "isi"), kerja(h, "susun"), q(h, ".aleta-abt-bagian")]) expect(tampak(el)).toBe(true);
    expect(usulanDiminta(h, "sipp")).toBe(1);
    expect(usulanDiminta(h, "saksi")).toBe(1);
    expect(usulanDiminta(h, "saksi-sdg")).toBe(0);
  });

  it("peran lain (operator): susunan lama - tombol lama tampak, tidak ada pembacaan otomatis", async () => {
    const h = buka({ simpanan: ui([]), peran: "Operator" });
    expect(await siapPeran(h)).toBe("lain");
    await tunggu(200);
    expect(tampak(tombol(h, "Isi blangko dari SIPP"))).toBe(true);
    expect(tampak(tombol(h, "Rapikan posita & keterangan saksi"))).toBe(true);
    expect(tampak(kerja(h, "isi"))).toBe(false);
    expect(usulanDiminta(h, "sipp") + usulanDiminta(h, "saksi")).toBe(0);
  });

  it("ditangani (K2): hakim yang bukan majelis (sipp-konteks: bukan_anggota_majelis) hanya membaca; ⋯ → Bagian peran lain membukanya", async () => {
    const bukan: Pengganti = (url) =>
      url.includes("/aleta-bot/sipp-konteks?nomor=")
        ? { isi: { ok: true, data: { available: true, konteks: { hakim: { bolehVerifikasi: false, alasan: "bukan_anggota_majelis" } } } } }
        : undefined;
    const h = buka({ simpanan: ui([]), peran: "Hakim", ganti: bukan });
    await sampai(() => panelDari(h)?.getAttribute("data-sore-ditangani") === "tidak", "ditangani tidak");
    await tunggu(100);
    expect(tampak(q(h, ".aleta-sore-bukan-penangan"))).toBe(true);
    expect(tampak(kerja(h, "isi"))).toBe(false);
    expect(tampak(q(h, ".aleta-abt-bagian"))).toBe(false);
    expect(usulanDiminta(h, "sipp")).toBe(0);
    q(h, ".aleta-sore-menu-tombol").click();
    const butir = await sampai(() => q(h, '[data-sore-butir="peran"]'), "butir bagian peran lain");
    butir.click();
    expect(tampak(kerja(h, "isi"))).toBe(true);
    expect(tampak(q(h, ".aleta-abt-bagian"))).toBe(true);
  });

  it("ditangani (K2): nama akun di variabel majelis blangko = ditangani, tanpa membaca sipp-konteks; data tak pasti = tidak mengurangi", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim", nama: "Dra. Hj. MUNIFA, S.H.", isi: { "0912": "Hakim Ketua: Munifa, S.H., Hakim Anggota: Lain" } });
    await sampai(() => panelDari(h)?.getAttribute("data-sore-ditangani") === "ya", "ditangani ya");
    expect(h.minta.some((m) => m.url.includes("/sipp-konteks"))).toBe(false);
    // sipp-konteks 404 (tidak pasti): tidak ada data-sore-ditangani, menu hakim utuh.
    const g = buka({ simpanan: ui([]), peran: "Hakim" });
    await selesaiIsi(g);
    expect(panelDari(g).hasAttribute("data-sore-ditangani")).toBe(false);
    expect(tampak(kerja(g, "isi"))).toBe(true);
    expect(h.w.__sore.soreBakuNamaAkun("Dra. Hj. MUNIFA, S.H.")).toBe("munifa");
  });
});

// ============================================================================
describe("butir 2 dan 3: alat variabel ke ⋯, komentar berisi = pita, penjelasan teknis berkelas aleta-teknis", () => {
  it("cari, sematan, kemajuan, wajib, dan komentar kosong tersembunyi; ⋯ → Alat variabel menampilkannya", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT) });
    await siapPeran(h);
    const unsur = [".aleta-t6-cari", ".aleta-t6-kemajuan", ".aleta-t6-wajib", ".aleta-t6-komentar"];
    await sampai(() => unsur.every((p) => q(h, p)), "unsur Tahap 6");
    await sampai(() => /belum ada/.test(q(h, ".aleta-t6-komentar-judul")?.textContent || ""), "komentar terbaca");
    await tunggu(120);
    for (const p of unsur) expect(tampak(q(h, p)), p).toBe(false);
    q(h, ".aleta-sore-menu-tombol").click();
    (await sampai(() => q(h, '[data-sore-butir="alatVar"]'), "butir alat variabel")).click();
    for (const p of unsur) expect(tampak(q(h, p)), p).toBe(true);
  });

  it("komentar hakim yang BERISI tetap tampak sebagai pita kecil", async () => {
    const ada: Pengganti = (url) => (url.includes("/aleta-ecourt/bas-komentar") ? { isi: { ok: true, data: { komentar: KOMENTAR_ADA, saya: null } } } : undefined);
    const h = buka({ simpanan: ui(["abt-18"]), ganti: ada });
    const kom = await sampai(() => (q(h, ".aleta-t6-komentar[data-sore-pita]") ? q(h, ".aleta-t6-komentar") : null), "pita komentar");
    expect(tampak(kom)).toBe(true);
    expect(kom.querySelector(".aleta-t6-komentar-judul").textContent).toContain("1 belum selesai dari 1");
  });

  it("penjelasan teknis ditandai; kalimat hasil, error, dan tombol tidak", async () => {
    const galat: Pengganti = (url, _c, badan) =>
      url.includes("/abt/usulan") && JSON.parse(badan || "{}").sumber === "sipp" ? { isi: { data: { available: true, sipp: { ok: false, alasan: "SIPP sedang sibuk" } } } } : undefined;
    const h = buka({ simpanan: ui(SEMUA_ABT), ganti: galat });
    await selesaiIsi(h);
    await tunggu(100);
    for (const p of [".aleta-baris-ket", ".aleta-abt-petunjuk", ".aleta-kaki-pintasan", ".aleta-sore-catatan"]) {
      const el = panelDari(h).querySelector(p);
      expect(el, p).not.toBeNull();
      expect(el.classList.contains("aleta-teknis"), p).toBe(true);
    }
    // Contoh pengguna: "Klik isi variabel mana pun..." ikut pita ⓘ-nya.
    const ket = q(h, ".aleta-baris-ket");
    if (ket.previousElementSibling?.classList.contains("aleta-t6-info-pita")) expect(ket.previousElementSibling.classList.contains("aleta-teknis")).toBe(true);
    const err = await sampai(() => q(h, ".aleta-sore-galat"), "error SIPP");
    expect(err.textContent).toContain("SIPP sedang sibuk");
    expect(err.classList.contains("aleta-teknis")).toBe(false);
    expect(q(h, ".aleta-sore-input").classList.contains("aleta-teknis")).toBe(false);
    expect(kerja(h, "isi").querySelector(".aleta-sore-status").classList.contains("aleta-teknis")).toBe(false);
  });
});

// ============================================================================
describe("butir 4: otomatis, hanya membaca - satu tombol tulis 'Input ke ABT'", () => {
  it("hakim: tidak ada permintaan non-GET ke ABT sebelum Input ke ABT ditekan; sesudahnya hanya yang dicentang", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata), peran: "Hakim" });
    const input = await selesaiIsi(h);
    await tunggu(150);
    expect(nonGetAbt(h)).toEqual([]);
    expect(usulanDiminta(h, "sipp")).toBe(1);
    expect(usulanDiminta(h, "saksi")).toBe(1);
    // Satu-satunya tombol tulis yang TAMPAK.
    const tulis = qs(h, "button").filter((b) => tampak(b) && /Terapkan|Tuliskan huruf|Input ke ABT|Simpan keterangan/.test(b.textContent));
    expect(tulis.map((b) => b.textContent)).toEqual([input.textContent]);
    expect(input.textContent).toBe("Input ke ABT (3)");
    input.click();
    await sampai(() => /tersimpan/.test(q(h, ".aleta-sore-tindakan + .aleta-abt-kabar")?.textContent || ""), "kabar input");
    await sampai(() => tulisAbt(h).length === 3, "tiga tulisan");
    const kode = tulisAbt(h).map((m) => new URLSearchParams(m.url.split("?")[1]).get("no_var") || new URLSearchParams(m.badan).get("no_var") || m.url);
    expect(kode.join(" ")).toMatch(/0222/);
    expect(kode.join(" ")).toMatch(/9944/);
    expect(kode.join(" ")).toMatch(/8503/);
    expect(kode.join(" ")).not.toMatch(/7035/);
  });

  it("mode coba: Input ke ABT ditahan dan disebut - tidak satu tulisan pun sampai ke ABT", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    const input = await selesaiIsi(h);
    input.click();
    const kabar = await sampai(() => (/mode coba|gagal/i.test(q(h, ".aleta-sore-tindakan + .aleta-abt-kabar")?.textContent || "") ? q(h, ".aleta-sore-tindakan + .aleta-abt-kabar") : null), "kabar ditahan");
    expect(kabar.className).toContain("aleta-abt-gagal");
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("mode kering: akun ALETA tidak terbaca (POST ditahan) - susunan lama tanpa pembacaan otomatis; 'Baca ulang' tetap ditahan dan disebut", async () => {
    const h = buka({ simpanan: ui([], { modeKering: true }), peran: "Hakim" });
    expect(await siapPeran(h)).toBe("lain");
    await tunggu(150);
    expect(tampak(tombol(h, "Isi blangko dari SIPP"))).toBe(true);
    expect(h.minta.filter((m) => m.url.includes("/abt/usulan"))).toEqual([]);
    // Dibuka lewat ⋯ (bagian ini mati untuk peran "lain") tidak mungkin; tombol
    // lamanya yang dipakai - dan mode kering menahannya seperti biasa.
    tombol(h, "Isi blangko dari SIPP").click();
    // Ditahan panel-alat.js (423) dan disebut di kabar panel - bukan diam.
    await sampai(() => /423|kering/i.test(q(h, ".aleta-abt-kabar")?.textContent || ""), "kabar ditahan mode kering");
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("sekali per muat: ↻ menyusun ulang panel dari hasil yang sudah dibaca - tidak membaca ulang", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    await selesaiIsi(h);
    const pertama = panelDari(h);
    q(h, ".aleta-kaki-segar").click();
    await sampai(() => panelDari(h) && panelDari(h) !== pertama && q(h, ".aleta-sore-input"), "panel baru dengan daftar", 8000);
    expect(usulanDiminta(h, "sipp")).toBe(1);
    expect(usulanDiminta(h, "saksi")).toBe(1);
    // "Baca ulang" membaca ulang, tetap hanya membaca.
    kerja(h, "isi").querySelector(".aleta-sore-jalankan").click();
    await sampai(() => usulanDiminta(h, "sipp") === 2, "baca ulang");
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("tombol lama yang ditekan petugas tidak ditimpa pembacaan otomatis yang masih berjalan", async () => {
    let pertama = true;
    const h = buka({
      simpanan: ui([]),
      peran: "Hakim",
      // Pembacaan otomatis SIPP yang pertama lambat; tombol lama ditekan selagi ia berjalan.
      lambat: (url, badan) => {
        if (url.includes("/abt/usulan") && JSON.parse(badan || "{}").sumber === "sipp" && pertama) {
          pertama = false;
          return 600;
        }
        return 0;
      },
    });
    await sampai(() => usulanDiminta(h, "sipp") === 1, "pembacaan otomatis mulai");
    tombol(h, "Isi blangko dari SIPP").click();
    await sampai(() => tombol(h, "Terapkan yang dicentang"), "hasil tombol lama");
    await tunggu(900);
    expect(tombol(h, "Terapkan yang dicentang")).toBeDefined();
    expect(q(h, ".aleta-sore-input")).toBeNull();
    expect(kerja(h, "isi").textContent).toContain("Tombol lama ditekan");
  });
});

// ============================================================================
describe("butir 5, 6, 7: satu daftar, huruf dengan sebabnya, satu tombol", () => {
  it("hanya data yang terdeteksi dan belum sama; yang tidak ada tidak tampil (disebut sebagai teknis)", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim", isi: { "9944": "1 tahun" } });
    await selesaiIsi(h);
    const kode = qs(h, ".aleta-abt-kartu .aleta-abt-kode").map((x) => x.textContent);
    // 1.184.0 (butir 17): 5227, 0246, 1268 tidak terdeteksi - tetap tampil sebagai kartu
    // KOSONG yang dapat disunting (tidak tercentang); 9944 sudah sama di blangko; 8503
    // tidak, sebab bagian huruf alasan punya pilihan.
    expect(kode).toEqual(["0222", "7035", "5227", "0246", "1268"]);
    for (const wajib of ["5227", "0246", "1268"]) {
      const kartu = qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === wajib);
      expect(kartu.querySelector(".aleta-abt-isi-sunting").textContent).toBe("(kosong - tekan Sunting untuk mengisi)");
      const c = kartu.querySelector("input.aleta-abt-centang");
      expect(c.checked).toBe(false);
      expect(c.disabled).toBe(true);
      expect(Array.from(kartu.querySelectorAll("button")).some((b: any) => b.textContent === "Sunting")).toBe(true);
    }
    // 0222 diusulkan SIPP (ragu) dan saksi (pasti): tampil sekali, yang pasti.
    const k0222 = qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === "0222");
    expect(k0222.querySelector(".aleta-abt-isi-sunting").textContent).toBe("November 2022");
    expect(q(h, ".aleta-sore-tak-tampil").textContent).toBe(
      "Tidak ditampilkan: 4 tidak terdeteksi (Tgl. Kuasa Penggugat, Kantor Kuasa Penggugat, No. SK Prodeo, Tanggal Fasakh); 1 sudah sama di blangko (lama pisah)."
    );
    // 18 Okt (1.205.7): kodenya hanya di title.
    expect(q(h, ".aleta-sore-tak-tampil").title).toBe("Kode isian: 0132, 0156, 0661, 0227; 9944");
    // Ringkasan 'siap diperiksa' menyebut isian yang harus disunting dengan nama, tidak dengan kode.
    const ringkasan = String(q(h, '[data-sore-kerja="isi"] .aleta-sore-status')?.textContent || "");
    expect(ringkasan).toMatch(/isi lewat Sunting \(/);
    expect(ringkasan).not.toMatch(/Sunting \([^)]*\b\d{4}\b/);
    expect(ringkasan).toContain("Sunting (Alasan-Alasan Cerai");
    // Kuasa yang terdeteksi SIPP: centangnya muncul.
    const kuasa: Pengganti = (url, _c, badan) =>
      url.includes("/abt/usulan") && JSON.parse(badan || "{}").sumber === "sipp"
        ? { isi: { data: { available: true, sipp: { ...USULAN_SIPP, jumlahKuasa: 1, usulan: [{ kode: "0132", nama: "Tgl. Kuasa Penggugat", nilai: "12 Agustus 2026", keyakinan: "pasti", sumber: [] }] } } } }
        : undefined;
    const g = buka({ simpanan: ui([]), peran: "Hakim", ganti: kuasa });
    await selesaiIsi(g);
    expect(qs(g, ".aleta-abt-kartu .aleta-abt-kode").map((x) => x.textContent)).toContain("0132");
  });

  it("huruf menyebut kenapa terdeteksi; yang di luar gugatan tidak tercentang; kesimpulan pendek; rincian lama di balik ⓘ", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim" });
    await selesaiIsi(h);
    const huruf = qs(h, ".aleta-sore-alasan .aleta-abt-huruf");
    const baris = (x: string) => huruf.find((b) => b.querySelector(".aleta-abt-huruf-nama").textContent === `Huruf ${x}`);
    expect(baris("F").querySelector(".aleta-sore-huruf-sebab").textContent).toBe("perselisihan terus-menerus: dikuatkan 2 saksi & ada di gugatan");
    expect(baris("F").querySelector("input").checked).toBe(true);
    expect(baris("A").querySelector(".aleta-sore-huruf-sebab").textContent).toBe("judi: tidak ada di gugatan - jangan dipakai");
    expect(baris("A").querySelector("input").checked).toBe(false);
    const simpul = qs(h, ".aleta-sore-simpul-baris").map((x) => x.textContent);
    expect(simpul).toEqual([
      "Siap dipakai: perselisihan terus-menerus",
      "Baru 1 saksi: pihak lain (wanita/pria idaman lain) (saksi 2)",
      "Tidak ada di gugatan - jangan dipakai: judi",
      "Ada di gugatan, belum dikuatkan 2 saksi: tidak memberi nafkah",
    ]);
    // Kartu panjang lama utuh di wadahnya, tersembunyi sampai ⓘ.
    const rinci = q(h, ".aleta-alasan-kelompok").closest(".aleta-abt-daftar");
    expect(rinci.textContent).toContain("Alasan perceraian - yang siap dipakai dan yang belum");
    expect(tampak(rinci)).toBe(false);
    q(h, ".aleta-sore-rinci-tombol").click();
    expect(tampak(rinci)).toBe(true);
    // Huruf D tanpa cabang: disebut sebagai penjelasan teknis.
    expect(qs(h, ".aleta-sore-alasan .aleta-teknis").map((x) => x.textContent)).toContain("Huruf D (kekerasan dalam rumah tangga) tidak diusulkan - blangko ini belum punya cabangnya.");
    const lapis = h.w.__sore;
    expect(lapis.soreSebabHuruf({ huruf: "F", pemicu: ["pihak lain (wanita/pria idaman lain)"] }, USULAN_SAKSI)).toEqual({
      teks: "pihak lain (wanita/pria idaman lain): baru 1 saksi (saksi 2)",
      nada: "sebagian",
    });
    expect(lapis.soreSebabHuruf({ huruf: "B", pemicu: ["lama pisah 30 bulan"] }, USULAN_SAKSI).teks).toBe("lama pisah 30 bulan (syarat 2 tahun)");
  });

  it("butir 6 di jalur lama (Baru): 'Tuliskan huruf alasan' tidak tampak - 'Terapkan yang dicentang' menulis usulan LALU huruf", async () => {
    const h = buka({ simpanan: baru([], nyata), peran: "Operator" });
    await siapPeran(h);
    tombol(h, "Input ke ABT").click();
    const terap = await sampai(() => tombol(h, "Terapkan yang dicentang"), "tombol terapkan");
    const huruf = tombol(h, "Tuliskan huruf alasan");
    expect(huruf.getAttribute("data-sore-tampak")).toBe("tidak");
    terap.click();
    await sampai(() => tulisAbt(h).some((m) => /8503/.test(m.url + m.badan)), "8503 tertulis");
    const urut = tulisAbt(h).map((m) => (/8503/.test(m.url + m.badan) ? "8503" : "usulan"));
    expect(urut[urut.length - 1]).toBe("8503");
    expect(urut.filter((x) => x === "usulan").length).toBeGreaterThan(0);
  });
});

// ============================================================================
describe("beranda ABT: menu massal per peran (alatMenuPeran abt/daftar)", () => {
  const pasangMassal = (dipanggil: string[], bas = true, js = true) => (w: any) => {
    if (bas) {
      w.aletaBasMassalPasang = async (wadah: any, opsi: any) => {
        dipanggil.push(`bas:${opsi.situs}`);
        wadah.appendChild(w.document.createElement("p")).textContent = "BAS massal";
        return true;
      };
    }
    if (js) {
      w.aletaJurusitaPasangMassal = async (wadah: any, opsi: any) => {
        dipanggil.push(`js:${opsi.situs}`);
        wadah.appendChild(w.document.createElement("p")).textContent = "Relaas massal";
        return true;
      };
    }
  };
  const bagianPutusan = (h: Halaman) => Array.from(massalDari(h).querySelectorAll(".aleta-isi > .aleta-bagian")) as any[];

  it("juru sita: Putusan massal tidak tampak; Relaas & PBT massal langsung terpasang", async () => {
    const dipanggil: string[] = [];
    const h = buka({ beranda: true, simpanan: ui([]), peran: "Jurusita", sebelum: pasangMassal(dipanggil) });
    await sampai(() => massalDari(h)?.getAttribute("data-sore-golongan"), "beranda tertata");
    await sampai(() => dipanggil.length === 1, "relaas massal dipasang");
    expect(dipanggil).toEqual(["js:abt"]);
    expect(bagianPutusan(h).length).toBeGreaterThan(0);
    for (const b of bagianPutusan(h)) expect(tampak(b)).toBe(false);
    expect(massalDari(h).querySelector(".aleta-kepala-nama").textContent).toBe("Relaas & PBT massal · ABT");
  });

  it("Super Admin: tiga tab kiri ke kanan, yang pertama terbuka; tab lain dipasang saat dibuka", async () => {
    const dipanggil: string[] = [];
    const h = buka({ beranda: true, simpanan: ui([]), sebelum: pasangMassal(dipanggil) });
    const tab = await sampai(() => (massalDari(h)?.querySelectorAll(".aleta-sore-tab-tombol").length ? Array.from(massalDari(h).querySelectorAll(".aleta-sore-tab-tombol")) : null), "tab");
    expect(tab.map((b: any) => b.textContent)).toEqual(["Putusan massal", "BAS massal", "Relaas & PBT massal"]);
    expect((tab[0] as any).getAttribute("aria-selected")).toBe("true");
    for (const b of bagianPutusan(h)) expect(tampak(b)).toBe(true);
    expect(dipanggil).toEqual([]);
    (tab[1] as any).click();
    await sampai(() => dipanggil.length === 1, "BAS massal dipasang");
    expect(dipanggil).toEqual(["bas:abt"]);
    for (const b of bagianPutusan(h)) expect(tampak(b)).toBe(false);
  });

  it("fungsi agen lain belum ada: tab-nya dilewati tanpa error; panitera tanpa BAS massal mendapat kalimat, bukan panel kosong", async () => {
    const dipanggil: string[] = [];
    const admin = buka({ beranda: true, simpanan: ui([]), sebelum: pasangMassal(dipanggil, false, true) });
    const tab = await sampai(() => (massalDari(admin)?.querySelectorAll(".aleta-sore-tab-tombol").length ? Array.from(massalDari(admin).querySelectorAll(".aleta-sore-tab-tombol")) : null), "tab");
    expect(tab.map((b: any) => b.textContent)).toEqual(["Putusan massal", "Relaas & PBT massal"]);
    const pp = buka({ beranda: true, simpanan: ui([]), peran: "Panitera Pengganti" });
    await sampai(() => massalDari(pp)?.querySelector(".aleta-sore-massal-kosong"), "kalimat tanpa menu");
    for (const b of bagianPutusan(pp)) expect(tampak(b)).toBe(false);
  });

  it("hakim: Putusan massal saja; tampilan Lama tidak ditata sama sekali", async () => {
    const dipanggil: string[] = [];
    const hakim = buka({ beranda: true, simpanan: ui([]), peran: "Hakim", sebelum: pasangMassal(dipanggil) });
    await sampai(() => massalDari(hakim)?.getAttribute("data-sore-golongan"), "beranda tertata");
    expect(massalDari(hakim).querySelector(".aleta-sore-tab")).toBeNull();
    for (const b of bagianPutusan(hakim)) expect(tampak(b)).toBe(true);
    const lama = buka({ beranda: true, simpanan: {}, peran: "Jurusita", sebelum: pasangMassal(dipanggil) });
    await sampai(() => massalDari(lama), "panel massal Lama");
    await tunggu(150);
    expect(massalDari(lama).hasAttribute("data-sore")).toBe(false);
    expect(massalDari(lama).querySelector(".aleta-sore, [data-sore-tampak], .aleta-teknis")).toBeNull();
    expect(massalDari(lama).querySelector(".aleta-kepala-nama").textContent).toBe("Putusan massal · ABT");
    expect(dipanggil).toEqual([]);
  });
});

// ============================================================================
describe("tampilan Lama tidak tersentuh lapisan sore", () => {
  it("Lama: tidak ada data-sore, aleta-sore, aleta-teknis, dan tidak ada pembacaan otomatis", async () => {
    const h = buka({ simpanan: { ujiTampilan: "lama", ujiFitur: fitur(SEMUA_ABT) }, peran: "Hakim" });
    await sampai(() => q(h, ".aleta-id-aleta"), "pita akun");
    await tunggu(300);
    expect(panelDari(h).hasAttribute("data-sore")).toBe(false);
    expect(h.w.document.querySelector(".aleta-sore, [data-sore-tampak], .aleta-teknis")).toBeNull();
    expect(usulanDiminta(h, "sipp") + usulanDiminta(h, "saksi")).toBe(0);
  });

  it("CSS: seluruh aturan blok T berada di antara penandanya dan bersyarat data-sore / aleta-sore", () => {
    const css = baca("panel.css");
    const mulai = css.indexOf("/* === T - PERBAIKAN 30 SEP SORE === */");
    const akhir = css.indexOf("/* === AKHIR T === */");
    expect(mulai).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(mulai);
    expect(css.slice(0, mulai)).not.toMatch(/aleta-sore|data-sore/);
    const blok = css.slice(css.indexOf("*/", mulai) + 2, akhir).replace(/\/\*[\s\S]*?\*\//g, "");
    let dihitung = 0;
    for (const aturan of blok.split("}")) {
      if (!aturan.includes("{")) continue;
      dihitung += 1;
      for (const b of aturan.split("{")[0].split(",")) expect(b.trim(), b).toMatch(/data-sore|aleta-sore/);
    }
    expect(dihitung).toBeGreaterThan(15);
    expect(css).toContain('#aleta-panel-abt[data-sore] [data-sore-tampak="tidak"],');
  });
});

// ============================================================================
describe("9 Okt (KUASA butir 1-4): kuasa hukum dari surat gugatan e-Court di Isi dari SIPP & input ke ABT", () => {
  const ISI_KUASA = { "0184": "DATA_TIDAK_ADA", "8537": "DATA_TIDAK_ADA", "8538": "DATA_TIDAK_ADA", "8539": "DATA_TIDAK_ADA" };
  const sumberG = (kalimat: string) => [{ asal: "gugatan-ecourt", kalimat: `"SURAT GUGATAN (Docx/Rtf)" e-Court: ${kalimat}` }];
  const KUASA_GUGATAN = {
    ada: true,
    catatan: [],
    usulan: [
      { kode: "0156", nama: "Kantor Kuasa Penggugat", nilai: "DERRY & PARTNER'S", keyakinan: "cukup", sumber: sumberG("…pada Kantor Hukum “DERRY & PARTNER’S” berkedudukan…"), catatan: "" },
      { kode: "0184", nama: "Tgl. Surat Kuasa Penggugat", nilai: "11/04/2026", keyakinan: "cukup", sumber: sumberG("Surat Kuasa Khusus tanggal 11 April 2026"), catatan: "" },
      { kode: "8538", nama: "Alamat Kantor Kuasa Penggugat", nilai: "Jl. Dayo No. 2, Palu", keyakinan: "ragu", sumber: [{ asal: "sipp", kalimat: "Alamat advokat di SIPP: Jl. Dayo No. 2, Palu" }], catatan: "" },
      { kode: "8537", nama: "Nama Advokat Kuasa Penggugat", nilai: "DERRY, S.H. dan ANDI, S.H.", keyakinan: "pasti", sumber: [{ asal: "sipp", kalimat: "Kuasa aktif Penggugat di SIPP" }], catatan: "" },
    ],
  };
  const SIPP_KUASA = {
    ...USULAN_SIPP,
    jumlahKuasa: 2,
    usulan: [
      { kode: "0132", nama: "Tgl. Register Kuasa Khusus Penggugat", nilai: "11/08/2026", keyakinan: "pasti", sumber: [{ saksi: 0, kalimat: "DERRY, S.H. - register 69/SK/VIII/2026" }] },
      { kode: "0156", nama: "Kantor Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [], catatan: "dibaca dari surat gugatan" },
      { kode: "8539", nama: "No. Register Kuasa Khusus Penggugat", nilai: "69/SK/VIII/2026", keyakinan: "pasti", sumber: [] },
      ...USULAN_SIPP.usulan.filter((u) => !["0132", "0156"].includes(u.kode)),
    ],
  };
  const jawab =
    (kuasa: unknown, sipp: unknown): Pengganti =>
    (url, _c, badan) => {
      if (url.includes("/aleta-ecourt/kuasa-gugatan")) return { isi: { ok: true, data: kuasa } };
      if (url.includes("/abt/usulan") && JSON.parse(badan || "{}").sumber === "sipp") return { isi: { data: { available: true, sipp } } };
      return undefined;
    };
  const kartu = (h: Halaman, kode: string) => qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === kode);

  it("kantor & tanggal surat kuasa dari gugatan bertanda 'dari gugatan e-Court' dan tercentang; cadangan SIPP 'ragu' tidak; register dari SIPP", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata), peran: "Hakim", isi: ISI_KUASA, ganti: jawab(KUASA_GUGATAN, SIPP_KUASA) });
    await selesaiIsi(h);
    expect(h.minta.filter((m) => m.url.includes("/aleta-ecourt/kuasa-gugatan?nomor=")).length).toBe(1);
    for (const k of ["0156", "0184", "8538", "8537", "0132", "8539"]) expect(kartu(h, k), k).toBeDefined();
    const k0156 = kartu(h, "0156");
    expect(k0156.querySelector(".aleta-abt-isi-sunting").textContent).toBe("DERRY & PARTNER'S");
    expect(k0156.querySelector(".aleta-tanda").textContent).toBe("dari gugatan e-Court");
    expect(k0156.querySelector(".aleta-abt-asal").textContent).toBe("Gugatan e-Court");
    expect(k0156.querySelector("input.aleta-abt-centang").checked).toBe(true);
    expect(kartu(h, "0184").querySelector("input.aleta-abt-centang").checked).toBe(true);
    expect(kartu(h, "8538").querySelector("input.aleta-abt-centang").checked).toBe(false);
    expect(kartu(h, "0132").querySelector(".aleta-abt-isi-sunting").textContent).toBe("11/08/2026");
    // Hanya MEMBACA sampai Input ke ABT ditekan.
    expect(nonGetAbt(h)).toEqual([]);
  });

  it("perkara ber-kuasa yang kantornya tidak terdeteksi: kartu 0156 tetap ada, kosong, dapat disunting, membawa sebabnya", async () => {
    const tanpaKantor = {
      ...KUASA_GUGATAN,
      usulan: KUASA_GUGATAN.usulan.map((u) => (u.kode === "0156" ? { ...u, nilai: "", keyakinan: "kosong", sumber: [], catatan: "Gugatan tidak menyebut nama kantor (kuasa perorangan)" } : u)),
    };
    const h = buka({ simpanan: ui([]), peran: "Hakim", isi: ISI_KUASA, ganti: jawab(tanpaKantor, SIPP_KUASA) });
    await selesaiIsi(h);
    const k = kartu(h, "0156");
    expect(k.querySelector(".aleta-abt-isi-sunting").textContent).toBe("(kosong - tekan Sunting untuk mengisi)");
    expect(k.querySelector("input.aleta-abt-centang").disabled).toBe(true);
    expect(Array.from(k.querySelectorAll("button")).some((b: any) => b.textContent === "Sunting")).toBe(true);
    expect(k.querySelector(".aleta-abt-catatan").textContent).toContain("kuasa perorangan");
  });

  it("tanpa kuasa (SIPP 0, gugatan tidak menyebut): tidak ada kartu kuasa; server lama (404) diam", async () => {
    const h = buka({ simpanan: ui([]), peran: "Hakim", isi: ISI_KUASA, ganti: jawab({ ada: false, catatan: [], usulan: [] }, USULAN_SIPP) });
    await selesaiIsi(h);
    for (const k of ["0156", "0184", "8538", "8537", "8539"]) expect(kartu(h, k), k).toBeUndefined();
    const g = buka({ simpanan: ui([]), peran: "Hakim", isi: ISI_KUASA });
    await selesaiIsi(g);
    expect(g.minta.some((m) => m.url.includes("/aleta-ecourt/kuasa-gugatan"))).toBe(true);
    expect(kerja(g, "isi").textContent).not.toContain("Kuasa hukum dari gugatan e-Court");
  });

  it("Input ke ABT menulis nama kantor gugatan ke #0156# dan tanggal surat kuasa ke #0184#; yang 'ragu' tidak", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata), peran: "Hakim", isi: ISI_KUASA, ganti: jawab(KUASA_GUGATAN, SIPP_KUASA) });
    const input = await selesaiIsi(h);
    input.click();
    await sampai(() => /tersimpan/.test(q(h, ".aleta-sore-tindakan + .aleta-abt-kabar")?.textContent || ""), "kabar input");
    const tulis = tulisAbt(h).map((m) => ({ no: new URLSearchParams(m.url.split("?")[1]).get("no_var"), nilai: new URLSearchParams(m.badan).get("value") }));
    // Petik lurus dinetralkan menjadi ’ oleh simpanVariabel (uji rilis U3,
    // 8c1e9f7): ABT menempelkan #var# mentah ke kueri data_sql, dan petik
    // lurus mematikan seluruh halaman blangko. cleanHtmlTagSpecial ABT
    // mengembalikannya menjadi ' saat mencetak - namanya tetap utuh.
    expect(tulis).toContainEqual({ no: "0156", nilai: "DERRY & PARTNER’S" });
    expect(tulis).toContainEqual({ no: "0184", nilai: "11/04/2026" });
    expect(tulis.some((t) => t.no === "8538")).toBe(false);
  });
});
