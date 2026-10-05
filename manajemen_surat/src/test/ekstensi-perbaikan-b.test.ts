// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 30 SEPTEMBER 2026 - PANEL ABT (AGEN B)
 * ============================================================================
 *
 * Temuan pengguna sesudah 1.174.1 (tangkapan 94-107), daftar DAFTAR-26.md:
 *
 *   2   "Susun saksi" hanya panitera sidang/PP (Admin & Super Admin melihat semua)
 *   3   langkah yang selesai disembunyikan; "lihat semua langkah" membukanya
 *   4   "Isi dari SIPP" + "Input ke ABT" satu langkah, Rapikan lebih dulu
 *   5   4020/8521/8522/8528/8529/8530 tidak masuk pita error selama 8503 kosong
 *   6   penjelasan panjang di balik ⓘ
 *   20-23  penyunting saksi: tidak ramai, huruf 15px, setinggi isi, baris sejajar
 *   28  jawaban saksi kosong/"..."/templat ditandai, ditawari isian, ditanyakan
 *   +   bagian Juru Sita (jurusita.js) di panel ABT
 *
 * Harness-nya salinan harness ekstensi-abt-tahap6.test.ts (panel-alat.js dan
 * abt.js dijalankan sungguhan di jsdom beralamat halaman blangko ABT), dengan
 * dua tambahan: isi halaman dapat ditimpa per uji (`isi`), dan global dapat
 * dipasang sebelum skrip berjalan (`sebelum`, untuk jurusita.js tiruan).
 * Tampilan Lama tetap dijaga uji pembanding di ekstensi-abt-tahap6.test.ts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan: cacat dipasang pada
// SALINAN, bukan pada berkas yang dipakai uji lain.
const SUMBER_ABT = process.env.ALETA_UJI_ABT ? readFileSync(process.env.ALETA_UJI_ABT, "utf8").replace(/\r\n/g, "\n") : baca("abt.js");

const ASAL = "http://192.168.10.10";
const ASAL_ABT = `${ASAL}/aps_badilag/index.php/abt`;
const NOMOR = "544/Pdt.G/2026/PA.Dgl";
const CETAK = `${ASAL_ABT}/preview?c=10018&b=B&a=A`;
const SEMUA_ABT = Array.from({ length: 30 }, (_, i) => `abt-${i + 1}`);
const KUNCI_T6 = ["abtVariabelSematan", "abtModeBaca", "abtDrafSaksi", "abtTemplatPribadi", "abtAlasanDitolak"];

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 5000): Promise<NonNullable<T>> {
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
// Halaman blangko cerai - nama dan alamat karangan, bukan data perkara
// ----------------------------------------------------------------------------
const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "7047":
    "Sarinah Wulandari binti Ikhsan, NIK 7203010101010001, umur 29 tahun, agama Islam, tempat kediaman di Desa Tanamea, Kecamatan Banawa, Kabupaten Donggala, sebagai Penggugat;",
  "7048": "Ahmad Yani bin Marzuki, umur 33 tahun, dahulu bertempat kediaman di Desa Tanamea, sekarang tidak diketahui alamatnya, sebagai Tergugat;",
  "5125":
    "Bahwa pada tanggal 14 Maret 2019 Penggugat dan Tergugat melangsungkan pernikahan;<br>Bahwa sejak bulan November 2022 sering terjadi perselisihan karena Tergugat tidak memberi nafkah;",
  "4001": "Menjatuhkan talak satu ba'in shughra Tergugat (Ahmad Yani bin Marzuki) terhadap Penggugat (Sarinah Wulandari binti Ikhsan);",
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
  "8503": "G",
  "4020": "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT",
  "8521": "TIDAK BENAR QUERY NYA",
  "0661": "DATA_TIDAK_ADA",
  "0663": "DATA_TIDAK_ADA",
  "0227": "DATA_TIDAK_ADA",
  "0132": "DATA_TIDAK_ADA",
  "0156": "DATA_TIDAK_ADA",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "7047": "IDENTITAS Nama Penggugat (OTOMATIS)",
  "7048": "IDENTITAS Nama Tergugat",
  "5125": "POSITA LENGKAP",
  "4001": "AMAR PUTUSAN CERAI UNIVERSAL",
  "0222": "Awal Konflik",
  "5227": "Alasan-Alasan Cerai",
  "8503": "Huruf Alasan",
  "4020": "Kalimat Alasan (OTOMATIS)",
  "8521": "Pertimbangan (OTOMATIS)",
  "0227": "Tanggal Fasakh",
  "0132": "Tgl. Kuasa Penggugat",
};

// ----------------------------------------------------------------------------
// Jawaban jaringan tiruan
// ----------------------------------------------------------------------------
const USULAN_SIPP = {
  ok: true,
  jumlahKuasa: 0,
  prodeo: false,
  usulan: [
    { kode: "0132", nama: "Tgl. Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [] },
    { kode: "0156", nama: "Kantor Kuasa Penggugat", nilai: "", keyakinan: "kosong", sumber: [] },
    { kode: "0661", nama: "No. SK Prodeo", nilai: "", keyakinan: "tidak_ada_sumber", sumber: [] },
    { kode: "0227", nama: "Tanggal Fasakh", nilai: "", keyakinan: "tidak_ada_sumber", catatan: "SIPP tidak punya kolom untuk tanggal ini.", sumber: [] },
    {
      kode: "0222",
      nama: "Awal Konflik",
      nilai: "bulan November 2022",
      keyakinan: "ragu",
      sumber: [{ asal: "posita", kalimat: "Bahwa sejak bulan November 2022 sering terjadi perselisihan" }],
    },
  ],
};
const USULAN_SAKSI = {
  butir: { saksi1: 1, saksi2: 1 },
  selisih: [{ hal: "Tahun menikah", saksi1: "2019", saksi2: "2018" }],
  ciri: ["perselisihan terus-menerus"],
  ciriSepihak: [],
  ciriDiluarGugatan: [],
  ciriBelumTerbukti: ["tidak memberi nafkah"],
  gugatanTerbaca: true,
  huruf: [{ huruf: "F", pemicu: ["perselisihan"], syarat: "", dasar: [] }],
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
    {
      ke: 1,
      pihak: "P",
      jawaban: [
        { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Kenal, saksi adalah paman Penggugat" },
        { no: "2", tanya: "Kapan Penggugat dan Tergugat menikah?", jawab: "Tahun 2019" },
        { no: "3", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan November 2022 sering bertengkar", varian: { n: 1, habis: true } },
      ],
    },
    {
      ke: 2,
      pihak: "P",
      jawaban: [
        { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Kenal, saksi adalah tetangga Penggugat" },
        { no: "2", tanya: "Kapan Penggugat dan Tergugat menikah?", jawab: "Tahun 2018" },
        { no: "3", tanya: "Sejak kapan tidak rukun?", jawab: "Sejak bulan November 2022 sering bertengkar", varian: { n: 1, habis: true } },
      ],
    },
  ],
};
const KOMENTAR = [
  {
    id: "kom-1",
    nomor: NOMOR,
    perkaraId: "10018",
    sidangKe: 2,
    bagian: "saksi-1:2",
    kutipan: "Tahun 2019",
    isi: "Tahun nikah berbeda dengan saksi 2 - periksa catatan sidang.",
    penulis: { id: "hakim-1", nama: "Hakim Anggota" },
    dibuatPada: "2026-09-29T09:50:00+08:00",
    selesai: false,
    diselesaikanOleh: null,
    diselesaikanPada: null,
  },
  {
    id: "kom-2",
    nomor: NOMOR,
    perkaraId: "10018",
    sidangKe: null,
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
const PASAL = [
  {
    id: "p-f",
    jenis: "pasal",
    kunci: "f",
    judul: "Perselisihan terus-menerus",
    isi: "Pasal 39 ayat (2) UU 1/1974 jo. Pasal 19 huruf f PP 9/1975 jo. Pasal 116 huruf f KHI",
    disahkan: true,
    disahkanOleh: { id: "sa", nama: "Super Admin" },
    disahkanPada: "2026-09-29T10:00:00+08:00",
    diubahPada: "2026-09-29T10:00:00+08:00",
  },
  {
    id: "p-g",
    jenis: "pasal",
    kunci: "g",
    judul: "Melanggar taklik talak",
    isi: "Pasal 116 huruf g KHI",
    disahkan: false,
    disahkanOleh: null,
    disahkanPada: null,
    diubahPada: "2026-09-29T10:00:00+08:00",
  },
];
const WAJIB = {
  jenis: "Cerai Gugat",
  variabel: [
    { kode: "0227", nama: "Tanggal Fasakh", sumber: "ukur", persenTerisi: 0.9, aktif: true },
    { kode: "5227", nama: "Alasan-Alasan Cerai", sumber: "ukur", persenTerisi: 0.99, aktif: true },
    { kode: "0001", nama: "No Perkara", sumber: "ukur", persenTerisi: 1, aktif: true },
    { kode: "0132", nama: "Tgl. Kuasa", sumber: "admin", persenTerisi: null, aktif: false },
  ],
  diukurPada: "2026-09-29T00:00:00+08:00",
  catatan: "Diukur dari putusan.",
};
const RIWAYAT_PIHAK = {
  ok: true,
  pihak: [
    {
      pihakId: 1,
      pihakKe: 1,
      nama: "Sarinah Wulandari binti Ikhsan",
      kedudukan: "Penggugat",
      ceraiBerakta: 0,
      cerai: [],
      jumlahTerkait: 1,
      terkait: [
        {
          perkaraId: "900",
          nomorPerkara: "211/Pdt.G/2024/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          keadaan: "dicabut",
          tanggalPutusan: "12-06-2024",
          arah: "sebelumnya",
          dasar: { tingkat: "nik", label: "NIK sama", catatan: "" },
          aktaCerai: null,
        },
      ],
    },
  ],
};
/** RTF putusan tiruan: satu kalimat galat ikut tercetak. */
const RTF_PUTUSAN =
  "{\\rtf1\\ansi{\\fonttbl{\\f0 Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;}" +
  "\\pard PUTUSAN\\par Nomor 544/Pdt.G/2026/PA.Dgl\\par DUDUK PERKARA\\par Bahwa Penggugat mengajukan gugatan\\'2c tertanggal 3 Agustus 2026;\\par " +
  "PERTIMBANGAN HUKUM\\par Menimbang, bahwa TIDAK BENAR QUERY NYA;\\par MENGADILI\\par Mengabulkan gugatan Penggugat;\\par }";
/** Anonim ABT yang belum bersih: nama pihak, NIK, dan desa masih utuh. */
const RTF_ANONIM =
  "{\\rtf1\\ansi\\pard PUTUSAN\\par Sa*** binti Ik***, NIK 7203010101010001, tempat kediaman di Desa Ta****\\par " +
  "Menimbang, bahwa saksi melihat Sarinah Wulandari pulang ke Desa Tanamea;\\par }";
const RTF_ANONIM_BERSIH = "{\\rtf1\\ansi\\pard PUTUSAN\\par Sa*** binti Ik***, NIK 72**************, di Desa Ta****\\par }";

type Minta = { url: string; cara: string; badan: string };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };
type Pengganti = (url: string, cara: string, badan: string) => Jawab | undefined;

function jawabBaku(url: string, cara: string, badan: string): Jawab {
  if (url.includes("/aleta-bot/abt/usulan")) {
    const muatan = JSON.parse(badan || "{}");
    if (muatan.sumber === "siapa") {
      return { isi: { data: { available: true, pengguna: { nama: "Derry Briantono", peran: "Super Admin" }, kapabilitas: {} } } };
    }
    if (muatan.sumber === "sipp") return { isi: { data: { available: true, sipp: USULAN_SIPP } } };
    if (muatan.sumber === "saksi") return { isi: { data: { available: true, saksi: USULAN_SAKSI } } };
    if (muatan.sumber === "saksi-sdg") return { isi: { data: { available: true, saksiSdg: SAKSI_SDG } } };
    return { isi: { data: { available: true } } };
  }
  if (url.includes("/aleta-ecourt/bas-komentar")) {
    if (cara === "PATCH") {
      const b = JSON.parse(badan || "{}");
      const x = KOMENTAR.find((y) => y.id === b.id)!;
      return { isi: { ok: true, data: { komentar: { ...x, selesai: b.selesai, diselesaikanOleh: { id: "pp", nama: "Panitera Pengganti" } } } } };
    }
    return { isi: { ok: true, data: { komentar: KOMENTAR, saya: { id: "pp", nama: "Panitera Pengganti", bolehMenulis: false, bolehMenyelesaikanSemua: true } } } };
  }
  if (url.includes("/aleta-ecourt/templat-hukum")) return { isi: { ok: true, data: { butir: PASAL, bolehMenyunting: false, tandaDraf: "DRAF - belum disahkan" } } };
  if (url.includes("/aleta-ecourt/abt-wajib")) return { isi: { ok: true, data: WAJIB } };
  if (url.includes("/aleta-ecourt/riwayat-pihak")) return { isi: { ok: true, data: { available: true, ...RIWAYAT_PIHAK } } };
  if (url.includes("/aleta-ecourt/abt-riwayat")) return { isi: { ok: true, data: { daftar: [] } } };
  if (url.includes("/edit_data?")) {
    if (cara === "POST") return { mentah: "<b>DATA DISIMPAN</b>", jenis: "text/html" };
    return { mentah: '<input type="hidden" name="var_type" value="data_teks">', jenis: "text/html" };
  }
  if (url.includes("/tanyajawab_perkara_edit?")) {
    if (badan.includes("load_template")) {
      const t = {
        "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal?", jawaban: "Ya kenal;" },
        "1": { urutan_pertanyaan: "2", pertanyaan: "Kapan menikah?", jawaban: "Tahun ....;" },
      };
      return { mentah: `<script>\n var ajax_data = ${JSON.stringify(t)} \n</script>`, jenis: "text/html" };
    }
    return {
      mentah: `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = [] \n</script>`,
      jenis: "text/html",
    };
  }
  if (url.includes("/tanyajawab_template_edit?")) return { mentah: "<script>\n var ajax_data = [] \n</script>", jenis: "text/html" };
  if (url.includes("/abt/preview?")) return { mentah: RTF_PUTUSAN, jenis: "application/rtf" };
  if (url.includes("/main/anonim")) return { mentah: RTF_ANONIM, jenis: "application/rtf" };
  if (url.includes("/putusan/unggah-sipp")) return { isi: { ok: true, data: { ok: true } } };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}

function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) {
    return new Response(Buffer.from(j.mentah, "latin1"), { status, headers: { "content-type": j.jenis || "text/plain" } });
  }
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

// ----------------------------------------------------------------------------
// Halaman ABT dengan panel-alat.js + abt.js
// ----------------------------------------------------------------------------
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Halaman = {
  dom: JSDOM;
  w: any;
  simpanan: Record<string, unknown>;
  tulisan: string[];
  minta: Minta[];
  konfirmasi: string[];
  navigasi: string[];
  setel: (isi: Record<string, unknown>) => Promise<void>;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(
  p: {
    sumber?: string;
    simpanan?: Record<string, unknown>;
    ganti?: Pengganti;
    konfirmasi?: boolean;
    isi?: Record<string, string>;
    sebelum?: (w: any) => void;
  } = {}
): Halaman {
  const isiHalaman: Record<string, string> = { ...ISI, ...(p.isi || {}) };
  const baris = Object.keys(isiHalaman)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${isiHalaman[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="cssmenu"></div><div id="content">` +
      `<h3 class="w3l_header"><span>${NOMOR}</span></h3><h2>CG (Lite) Verstek F V.2</h2>` +
      `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${baris}</table></div></div></body></html>`,
    { url: `${ASAL_ABT}/main/view?a=A&b=B&c=10018&d=3`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const tulisan: string[] = [];
  const pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Ubah = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
        simpanan[k] = polos(v);
        tulisan.push(k);
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
      getManifest: () => ({ version: "1.173.1" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const badan = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan });
    const j = (p.ganti && p.ganti(url, cara, badan)) || jawabBaku(url, cara, badan);
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
  const konfirmasi: string[] = [];
  w.confirm = (pesan: string) => {
    konfirmasi.push(pesan);
    return p.konfirmasi === true;
  };
  const navigasi: string[] = [];
  w.document.addEventListener("click", (e: any) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (!e.defaultPrevented && !String(a.getAttribute("href")).startsWith("#")) navigasi.push(a.href);
    e.preventDefault();
  });
  if (p.sebelum) p.sebelum(w);
  w.eval(
    `${SUMBER_ALAT}\n;\n${p.sumber ?? SUMBER_ABT}\n;\nwindow.__uji = { kerjakan: typeof kerjakanSatuPerkaraAbt === "function" ? kerjakanSatuPerkaraAbt : null, ` +
      `t6: typeof t6TeksRtf === "function" ? { t6TeksRtf, t6KalimatRamah, t6VarianKalimat, t6PeriksaAnonim, t6DataPribadi } : null };` +
      `window.__ujiB = typeof t6KelasPeran === "function" ? { t6KelasPeran, t6LipatInfo, t6RingkasInfo, t6JawabKosong } : null;`
  );
  return { dom, w, simpanan, tulisan, minta, konfirmasi, navigasi, setel: (isi) => local.set(isi) };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const q = (h: Halaman, pemilih: string) => panelDari(h)?.querySelector(pemilih) as any;
const qs = (h: Halaman, pemilih: string) => Array.from(panelDari(h)?.querySelectorAll(pemilih) || []) as any[];
const tombol = (h: Halaman, teks: string | RegExp) =>
  qs(h, "button").find((b) => (typeof teks === "string" ? b.textContent === teks : teks.test(b.textContent)));
const panelLahir = (h: Halaman) => sampai(() => panelDari(h), "panel ABT lahir");
/** Panel yang sudah ditata Tahap 6 (UI Baru: data-t6="ui"; Baru: unsur t6 pertama). */
const panelUi = (h: Halaman) => sampai(() => (panelDari(h)?.getAttribute("data-t6") === "ui" ? panelDari(h) : null), "panel UI Baru");
const adaT6 = (h: Halaman) => sampai(() => q(h, ".aleta-t6"), "unsur Tahap 6");

function fitur(kode: string[]): Record<string, boolean> {
  return Object.fromEntries(kode.map((k) => [k, true]));
}
const baru = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "baru", ujiFitur: fitur(kode), ...lain });
const ui = (kode: string[], lain: Record<string, unknown> = {}) => ({ ujiTampilan: "ui", ujiFitur: fitur(kode), ...lain });
const nyata = { ujiIzinkanNyata: true };

/** Permintaan yang hanya dapat berasal dari Tahap 6. */
const RUTE_T6 = /\/bas-komentar|\/templat-hukum|\/abt-wajib|\/riwayat-pihak|\/abt\/preview/;
const mintaT6 = (h: Halaman) => h.minta.filter((m) => RUTE_T6.test(m.url)).map((m) => `${m.cara} ${m.url.replace(ASAL, "")}`);
const bukanGet = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD").map((m) => `${m.cara} ${m.url.replace(ASAL, "")}`);

async function isiDariSipp(h: Halaman) {
  (await sampai(() => tombol(h, "Isi blangko dari SIPP"), "tombol SIPP")).click();
  await sampai(() => qs(h, ".aleta-abt-kartu").length >= 5, "kartu usulan SIPP");
  await tunggu(20);
}
async function inputKeAbt(h: Halaman) {
  (await sampai(() => tombol(h, "Input ke ABT"), "tombol Input ke ABT")).click();
  await sampai(() => q(h, ".aleta-alasan-kelompok"), "kartu alasan");
  await tunggu(20);
}
async function susunSaksi(h: Halaman) {
  (await sampai(() => tombol(h, "Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
  const susun = await sampai(() => tombol(h, "Susun keterangan para saksi"), "blangko SDG");
  susun.click();
  const hasil = await sampai(() => q(h, ".aleta-sdg-hasil"), "penyunting saksi");
  await tunggu(30);
  return hasil;
}

/** Isi panel tanpa unsur yang berubah tiap detik (tidak ada di panel ABT - dijaga tetap). */
const potret = (h: Halaman) => String(panelDari(h)?.outerHTML || "");
const atributAkar = (h: Halaman) =>
  h.w.document.documentElement
    .getAttributeNames()
    .filter((n: string) => n !== "style")
    .map((n: string) => `${n}=${h.w.document.documentElement.getAttribute(n)}`)
    .sort();
const tanpaCap = (x: Record<string, any>) => {
  const y = polos(x);
  if (y.tampilanServer) delete y.tampilanServer.diambil;
  // Cap waktu (riwayat, peta blangko) berbeda beberapa milidetik antara dua
  // halaman yang berjalan bersamaan - isinya yang dibandingkan, bukan jamnya.
  return JSON.parse(JSON.stringify(y).replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, "<cap>"));
};

// ============================================================================
// PERBAIKAN 30 SEPTEMBER 2026 - AGEN B (PANEL ABT)
// ============================================================================

/** Jawaban /abt/usulan "siapa" dengan peran tertentu. */
const sebagai =
  (peran: string, lain?: Pengganti): Pengganti =>
  (url, cara, badan) => {
    if (url.includes("/aleta-bot/abt/usulan") && JSON.parse(badan || "{}").sumber === "siapa") {
      return { isi: { data: { available: true, pengguna: { nama: "Uji Peran", peran }, kapabilitas: {} } } };
    }
    return lain ? lain(url, cara, badan) : undefined;
  };
/** Peran panel sudah diterapkan Tahap 6. */
const peranTerpasang = (h: Halaman) => sampai(() => panelDari(h)?.getAttribute("data-t6-peran"), "peran terbaca");
const langkahDari = (h: Halaman, kunci: string) => q(h, `.aleta-t6-langkah [data-t6-langkah="${kunci}"]`);

describe("butir 2: 'Susun saksi' hanya untuk panitera sidang/PP", () => {
  it("golongan peran: panitera sebelum hakim (Wakil Panitera), juru sita bukan PP, admin & super admin", () => {
    const h = buka({ simpanan: {} });
    const kelas = h.w.__ujiB.t6KelasPeran;
    expect(kelas("Hakim")).toBe("hakim");
    expect(kelas("Wakil Ketua")).toBe("hakim");
    expect(kelas("Panitera Pengganti")).toBe("panitera");
    expect(kelas("paniterapengganti")).toBe("panitera");
    expect(kelas("Wakil Panitera")).toBe("panitera");
    expect(kelas("Jurusita Pengganti")).toBe("juru-sita");
    expect(kelas("Juru Sita")).toBe("juru-sita");
    expect(kelas("Admin")).toBe("admin");
    expect(kelas("Super Admin")).toBe("super-admin");
    expect(kelas("adminit")).toBe("admin");
    // "administrasi" bukan admin - tanpa penjaga ini pengadministrasi umum mendapat penyusun saksi.
    expect(kelas("Pengadministrasi Umum")).toBe("lain");
    expect(kelas("Kasir")).toBe("lain");
    expect(kelas("")).toBe("");
  });

  it("hakim (UI Baru): tombol lama tersembunyi DAN mati, langkahnya tidak ada, penyunting & '+ pertanyaan saksi' disembunyikan", async () => {
    const h = buka({ simpanan: ui(["abt-10", "abt-6"]), ganti: sebagai("Hakim") });
    await panelUi(h);
    expect(await peranTerpasang(h)).toBe("hakim");
    const sdg = tombol(h, "Susun keterangan saksi 1 & 2");
    expect(sdg.hidden).toBe(true);
    expect(sdg.disabled).toBe(true);
    expect(panelDari(h).getAttribute("data-t6-sdg")).toBe("tidak");
    expect(langkahDari(h, "sdg").hidden).toBe(true);
    // Langkah putusan hakim: gabung lalu Kerjakan, bernomor 1 dan 2.
    const nomor = (kunci: string) => langkahDari(h, kunci).querySelector(".aleta-t6-langkah-no").textContent;
    expect([nomor("gabung"), nomor("kerjakan")]).toEqual(["1", "2"]);
    expect(await sampai(() => h.w.getComputedStyle && true, "css")).toBe(true);
    const css = baca("panel.css");
    expect(css).toContain('#aleta-panel-abt[data-t6-sdg="tidak"] .aleta-sdg-form,');
    expect(css).toContain('#aleta-panel-abt[data-t6-sdg="tidak"] .aleta-t6-tanya-saksi { display: none !important; }');
  });

  it("juru sita dan peran lain juga tidak; panitera pengganti, admin, dan super admin melihatnya", async () => {
    for (const [peran, boleh] of [
      ["Jurusita", false],
      ["Kasir", false],
      ["Panitera Pengganti", true],
      ["Admin", true],
      ["Super Admin", true],
    ] as const) {
      const h = buka({ simpanan: ui(["abt-10"]), ganti: sebagai(peran) });
      await panelUi(h);
      await peranTerpasang(h);
      expect(tombol(h, "Susun keterangan saksi 1 & 2").hidden, peran).toBe(!boleh);
      expect(langkahDari(h, "sdg").hidden, peran).toBe(!boleh);
      expect(panelDari(h).hasAttribute("data-t6-sdg"), peran).toBe(!boleh);
    }
  });

  it("tampilan Lama: hakim tetap melihat tombol lamanya (Lama identik)", async () => {
    const h = buka({ simpanan: { ujiTampilan: "lama", ujiFitur: fitur(SEMUA_ABT) }, ganti: sebagai("Hakim") });
    await panelLahir(h);
    await sampai(() => q(h, ".aleta-id-aleta"), "pita akun");
    await tunggu(400);
    expect(tombol(h, "Susun keterangan saksi 1 & 2").hidden).toBe(false);
    expect(panelDari(h).hasAttribute("data-t6-peran")).toBe(false);
  });
});

describe("butir 3 dan 4: satu langkah 'Isi dari SIPP & input ke ABT', yang selesai disembunyikan", () => {
  it("keterangan saksi 1 sudah terisi: Susun saksi bertanda selesai, yang tampak hanya langkah gabung; 'lihat semua langkah' dan ⋯ membuka sisanya", async () => {
    const h = buka({ simpanan: ui(["abt-10"]) });
    await panelUi(h);
    await peranTerpasang(h);
    const gabung = langkahDari(h, "gabung");
    const sdg = langkahDari(h, "sdg");
    await sampai(() => gabung.classList.contains("aleta-t6-sekarang"), "gabung sekarang");
    expect(sdg.classList.contains("aleta-t6-selesai")).toBe(true);
    expect(sdg.title).toContain("keterangan saksi 1 sudah terisi di blangko");
    expect(langkahDari(h, "kerjakan").classList.contains("aleta-t6-sekarang")).toBe(false);
    // Urutan tampil: susun saksi, gabung, kerjakan (CSS order), DOM tetap gabung dulu.
    expect([sdg, gabung, langkahDari(h, "kerjakan")].map((b: any) => b.style.order)).toEqual(["1", "2", "3"]);
    const semua = q(h, ".aleta-t6-langkah-semua");
    expect(semua.hidden).toBe(false);
    expect(semua.textContent).toBe("lihat semua langkah (2)");
    semua.click();
    expect(panelDari(h).getAttribute("data-t6-langkah-semua")).toBe("ya");
    expect(semua.textContent).toBe("sembunyikan yang selesai");
    semua.click();
    expect(panelDari(h).hasAttribute("data-t6-langkah-semua")).toBe(false);
    // ⋯ memunculkan tombol lama satu per satu.
    const lama = q(h, ".aleta-t6-langkah-lama");
    lama.click();
    expect(panelDari(h).getAttribute("data-t6-tombol-lama")).toBe("ya");
    lama.click();
    expect(panelDari(h).hasAttribute("data-t6-tombol-lama")).toBe(false);
    // CSS: yang bukan langkah sekarang disembunyikan kecuali "lihat semua";
    // tombol lama tampak lagi lewat ⋯.
    const css = baca("panel.css");
    expect(css).toContain(
      "#aleta-panel-abt[data-t6-langkah]:not([data-t6-langkah-semua]) .aleta-t6-langkah .aleta-t6-langkah-tombol:not(.aleta-t6-sekarang) { display: none; }"
    );
    expect(css).toContain("#aleta-panel-abt[data-t6-langkah][data-t6-tombol-lama] .aleta-abt-aksi .aleta-t6-diwakili:not([hidden]) { display: inline-block !important; }");
  });

  it("langkah gabung: Rapikan (pratinjau) lebih dulu, lalu SIPP, lalu keterangan saksi - usulan SIPP tetap utuh di wadahnya sendiri", async () => {
    const h = buka({ simpanan: ui(["abt-10", "abt-4"], nyata) });
    await panelUi(h);
    await peranTerpasang(h);
    const gabung = langkahDari(h, "gabung");
    h.minta.length = 0;
    gabung.click();
    await sampai(() => gabung.classList.contains("aleta-t6-selesai"), "gabung selesai", 8000);
    const urutan = h.minta
      .map((m) => (m.url.includes("/sipp/posita") ? "rapikan" : m.url.includes("/abt/usulan") ? JSON.parse(m.badan).sumber : ""))
      .filter((x) => x === "rapikan" || x === "sipp" || x === "saksi");
    expect(urutan.indexOf("rapikan")).toBeGreaterThanOrEqual(0);
    expect(urutan.indexOf("rapikan")).toBeLessThan(urutan.indexOf("sipp"));
    expect(urutan.indexOf("sipp")).toBeLessThan(urutan.indexOf("saksi"));
    // Rapikan hanya pratinjau: tidak satu pun tulisan ke ABT/SIPP.
    expect(bukanGet(h).filter((x) => !/\/abt\/usulan|\/sipp\/posita/.test(x))).toEqual([]);
    // Usulan SIPP (5 kartu) di wadahnya sendiri, usulan saksi (3) di wadah lama.
    const wSipp = q(h, ".aleta-t6-usulan-sipp");
    expect(wSipp).not.toBeNull();
    expect(wSipp.querySelectorAll(":scope > .aleta-abt-kartu")).toHaveLength(5);
    expect(q(h, ".aleta-t6-usulan-sipp .aleta-t6-usulan-judul").textContent).toContain("Dari SIPP");
    expect(qs(h, ".aleta-t6-usulan-judul").map((x) => x.firstChild.textContent)).toEqual(["Dari SIPP", "Dari keterangan saksi"]);
    const wSaksi = wSipp.nextElementSibling.nextElementSibling;
    expect(wSaksi.querySelectorAll(":scope > .aleta-abt-kartu")).toHaveLength(3);
    // Tombol "Terapkan yang dicentang" milik SIPP masih hidup (pendengarnya ikut pindah).
    const terapSipp = Array.from(wSipp.querySelectorAll("button")).find((b: any) => b.textContent === "Terapkan yang dicentang") as any;
    terapSipp.click();
    await sampai(() => /Tidak ada yang dicentang|tersimpan/.test(wSipp.textContent), "terap SIPP menjawab");
    // Segmen keyakinan menghitung kedua wadah.
    const angka = await sampai(() => q(h, '.aleta-t6-segmen [data-t6-yakin="semua"] .aleta-t6-segmen-angka'), "segmen");
    expect(angka.textContent).toBe("8");
    // Berikutnya Kerjakan; sesudah itu semua langkah selesai dan kalimatnya tampak.
    const kerjakan = langkahDari(h, "kerjakan");
    expect(kerjakan.classList.contains("aleta-t6-sekarang")).toBe(true);
    expect(q(h, ".aleta-t6-langkah-habis").hidden).toBe(true);
    kerjakan.click();
    await sampai(() => !q(h, ".aleta-t6-langkah-habis").hidden, "semua selesai");
    expect(q(h, ".aleta-t6-langkah-semua").textContent).toBe("lihat semua langkah (3)");
  });

  it("penyunting keterangan saksi yang belum disimpan tidak dibuang diam-diam: ditanyakan, dan Batal tidak menjalankan apa pun", async () => {
    const h = buka({ simpanan: ui(["abt-10"]) });
    await panelUi(h);
    await peranTerpasang(h);
    await susunSaksi(h);
    h.minta.length = 0;
    langkahDari(h, "gabung").click();
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog");
    expect(tirai.textContent).toContain("Penyunting keterangan saksi masih terbuka");
    tirai.querySelector(".aleta-t6-dialog-tidak").click();
    await tunggu(80);
    expect(h.minta.filter((m) => m.url.includes("/abt/usulan"))).toEqual([]);
    expect(q(h, ".aleta-sdg-hasil")).not.toBeNull();
  });
});

describe("butir 5: variabel yang menunggu 8503 tidak masuk pita error selama 8503 kosong", () => {
  const G = "TIDAK BENAR QUERY NYA";
  it("8503 kosong: 4020/8521/8522/8528/8529/8530 disebut sekali 'akan terisi sesudah 8503 diisi', pita error tidak tampil", async () => {
    const h = buka({
      simpanan: baru(["abt-5", "abt-11"]),
      isi: { "8503": "DATA_TIDAK_ADA", "8522": G, "8528": G, "8529": G, "8530": G },
    });
    const tunggu8503 = await sampai(() => (q(h, ".aleta-t6-pita-tunggu:not([hidden])") ? q(h, ".aleta-t6-pita-tunggu") : null), "pita tunggu");
    expect(tunggu8503.textContent).toContain("4020, 8521, 8522, 8528, 8529, 8530 akan terisi sesudah 8503 (huruf alasan) diisi");
    expect(q(h, ".aleta-t6-pita-bahaya").hidden).toBe(true);
    const rinci = q(h, ".aleta-t6-kemajuan-rinci").textContent;
    expect(rinci).toContain("6 menunggu 8503");
    expect(rinci).not.toContain("berbunyi error");
    expect(q(h, ".aleta-t6-kemajuan").classList.contains("aleta-t6-ada-galat")).toBe(false);
  });

  it("8503 kosong tetapi variabel LAIN berbunyi error: hanya yang lain itu di pita error", async () => {
    const h = buka({ simpanan: baru(["abt-5"]), isi: { "8503": "DATA_TIDAK_ADA", "0663": G } });
    const pita = await sampai(() => (q(h, ".aleta-t6-pita-bahaya:not([hidden])") ? q(h, ".aleta-t6-pita-bahaya") : null), "pita");
    expect(pita.textContent).toContain("1 variabel berbunyi pesan error (0663)");
    expect(pita.textContent).not.toContain("4020");
    expect(q(h, ".aleta-t6-pita-tunggu").hidden).toBe(false);
  });

  it("8503 sudah terisi dan 4020/8521 masih berbunyi error: barulah pita error", async () => {
    const h = buka({ simpanan: baru(["abt-5"]), isi: { "8503": "F" } });
    const pita = await sampai(() => (q(h, ".aleta-t6-pita-bahaya:not([hidden])") ? q(h, ".aleta-t6-pita-bahaya") : null), "pita");
    expect(pita.textContent).toContain("2 variabel berbunyi pesan error (4020, 8521)");
    expect(q(h, ".aleta-t6-pita-tunggu").hidden).toBe(true);
  });
});

describe("butir 6: penjelasan panjang di balik ⓘ yang dapat dibuka-tutup", () => {
  it("keterangan panjang dilipat: kalimat pertama + ⓘ; ⓘ membuka teks utuh yang TIDAK diubah, dan menutupnya lagi", async () => {
    const h = buka({ simpanan: ui([]) });
    await panelUi(h);
    const ket = await sampai(() => (q(h, '.aleta-baris-ket[data-t6-info]') ? q(h, ".aleta-baris-ket") : null), "keterangan terlipat");
    expect(ket.textContent).toBe("Klik isi variabel mana pun untuk menyuntingnya langsung di barisnya. Ctrl+Enter menyimpan, Esc membatalkan.");
    expect(ket.getAttribute("data-t6-info")).toBe("tutup");
    const pita = ket.previousElementSibling;
    expect(pita.classList.contains("aleta-t6-info-pita")).toBe(true);
    const ringkas = pita.querySelector(".aleta-t6-info-ringkas");
    expect(ringkas.textContent).toBe("Klik isi variabel mana pun untuk menyuntingnya langsung di barisnya.");
    const i = pita.querySelector(".aleta-t6-info-tombol");
    expect(i.textContent).toBe("ⓘ");
    i.click();
    expect(ket.getAttribute("data-t6-info")).toBe("buka");
    expect(i.getAttribute("aria-expanded")).toBe("true");
    expect(ringkas.hidden).toBe(true);
    i.click();
    expect(ket.getAttribute("data-t6-info")).toBe("tutup");
    expect(ringkas.hidden).toBe(false);
    // Catatan di penyunting saksi dan di kartu alasan ikut; peringatan tidak.
    await inputKeAbt(h);
    await sampai(() => qs(h, ".aleta-alasan-kelompok .aleta-abt-catatan[data-t6-info]").length > 0, "catatan alasan terlipat");
    const css = baca("panel.css");
    expect(css).toContain('#aleta-panel-abt [data-t6-info="tutup"] { display: none !important; }');
  });

  it("pesan gagal, peringatan MENIMPA/JANGAN, dan kalimat pendek tidak pernah dilipat", async () => {
    const h = buka({ simpanan: ui([]) });
    await panelUi(h);
    const lipat = h.w.__ujiB.t6LipatInfo;
    const buat = (kelas: string, teks: string) => {
      const el = h.w.document.createElement("div");
      el.className = kelas;
      el.textContent = teks;
      q(h, ".aleta-isi").appendChild(el);
      lipat(el);
      return el.hasAttribute("data-t6-info");
    };
    const panjang = "Kalimat pertama yang cukup panjang untuk diringkas. " + "Isi penjelasan lanjutan yang panjang sekali. ".repeat(3);
    expect(buat("aleta-abt-catatan", panjang)).toBe(true);
    expect(buat("aleta-abt-catatan aleta-abt-gagal", panjang)).toBe(false);
    expect(buat("aleta-abt-catatan", `Menyimpan akan MENIMPANYA. ${panjang}`)).toBe(false);
    expect(buat("aleta-abt-catatan", `JANGAN dimasukkan. ${panjang}`)).toBe(false);
    expect(buat("aleta-abt-catatan", "Pendek saja.")).toBe(false);
    // Ringkasan dipotong pada ". ", "; ", " - " - bukan pada titik dua.
    const ringkas = h.w.__ujiB.t6RingkasInfo;
    expect(ringkas("Kirim ke BAS SIPP: belum tersedia - ALETA belum punya jalur tulis berita acara ke SIPP yang aman.")).toBe(
      "Kirim ke BAS SIPP: belum tersedia"
    );
    expect(ringkas("Dikuatkan KEDUA saksi dan didalilkan dalam gugatan. Inilah yang sudah tertulis pada alasan perceraian.")).toBe(
      "Dikuatkan KEDUA saksi dan didalilkan dalam gugatan."
    );
  });
});

/** Keterangan saksi berpertanyaan upaya rukun - jawaban saksi 1 "...;" (contoh 459/Pdt.G/2026/PA.Dgl). */
const SAKSI_RUKUN = {
  ok: true,
  alasan: ["perselisihan terus-menerus"],
  asalAlasan: "posita",
  saksi: [1, 2].map((ke) => ({
    ke,
    pihak: "P",
    jawaban: [
      { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: ke === 1 ? "Kenal, saksi adalah paman Penggugat;" : "Kenal, saksi tetangga Penggugat;" },
      { no: "2", tanya: "Kapan Penggugat dan Tergugat menikah?", jawab: "Tahun 2019;" },
      { no: "3", tanya: "Sejak kapan tidak rukun?", jawab: ke === 1 ? "Sejak November 2022;" : "Sejak akhir 2022;" },
      {
        no: "14",
        tanya: "Apakah sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun kembali?",
        jawab: ke === 1 ? "...;" : "Pihak keluarga sudah mendamaikan namun tidak berhasil;",
      },
    ],
  })),
};
const UPAYA_DAMAI = "pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil";
const denganRukun: Pengganti = (url, _cara, badan) =>
  url.includes("/aleta-bot/abt/usulan") && JSON.parse(badan || "{}").sumber === "saksi-sdg"
    ? { isi: { data: { available: true, saksiSdg: SAKSI_RUKUN } } }
    : undefined;

describe("butir 28 bagian B: jawaban saksi yang belum terisi ditandai, ditawari isian, dan ditanyakan sebelum disimpan", () => {
  it("pengenal 'belum terisi': kosong, '...', '…', '_', titik-titik templat, token #0000#", () => {
    const h = buka({ simpanan: {} });
    const kosong = h.w.__ujiB.t6JawabKosong;
    for (const x of ["", "  ", "...;", "…", "_", "__;", "-", "Tahun ....;", "Saksi kenal dengan #0098#;"]) expect(kosong(x), JSON.stringify(x)).toBe(true);
    for (const x of ["Ya kenal;", "Tahun 2019;", "Tidak."]) expect(kosong(x), x).toBe(false);
  });

  it("jawaban '...;' bertanda belum terisi, tidak dihitung siap, dan ditawari 1268 Upaya Damai Keluarga serta jawaban saksi 2", async () => {
    const h = buka({ simpanan: ui([], nyata), isi: { "1268": UPAYA_DAMAI }, ganti: denganRukun });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    const baris = await sampai(() => hasil.querySelector('.aleta-sdg-baris[data-t6-belum="ya"]'), "baris belum terisi");
    expect(baris.querySelector(".aleta-sdg-tanya").textContent).toContain("diupayakan untuk rukun kembali");
    expect(hasil.querySelectorAll('.aleta-sdg-baris[data-t6-belum="ya"]')).toHaveLength(1);
    expect(baris.querySelector(".aleta-t6-lencana-belum").textContent).toBe("belum terisi");
    const tawaran = Array.from(baris.querySelectorAll(".aleta-t6-tawaran")).map((b: any) => b.textContent);
    expect(tawaran).toEqual(["1268 Upaya Damai Keluarga", "Saksi 2 P no. 4"]);
    const siap = hasil.querySelector(".aleta-t6-sdg-siap");
    expect(siap.textContent).toContain("7 dari 8 jawaban siap · 1 belum terisi");
    expect(siap.classList.contains("aleta-t6-sdg-siap-kurang")).toBe(true);
    // Tawaran 1268: disisipkan ke tempat "...", berhuruf besar di awal.
    baris.querySelector(".aleta-t6-tawaran").click();
    expect(baris.querySelector("textarea").value).toBe(
      "Pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil;"
    );
    expect(baris.hasAttribute("data-t6-belum")).toBe(false);
    expect(baris.querySelector(".aleta-t6-belum")).toBeNull();
    expect(siap.textContent).toBe("✓ 8 jawaban terisi.");
  });

  it("simpan dengan jawaban belum terisi: peringatan + konfirmasi 'Sudah saya periksa'; Kembali mengisi = tidak ada yang tersimpan; Tetap simpan = tersimpan", async () => {
    const h = buka({ simpanan: ui([], nyata), ganti: denganRukun });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    await sampai(() => hasil.querySelector('.aleta-sdg-baris[data-t6-belum="ya"]'), "baris belum terisi");
    // 1268 kosong di blangko ini: yang ditawarkan hanya jawaban saksi 2.
    expect(Array.from(hasil.querySelectorAll(".aleta-t6-tawaran")).map((b: any) => b.textContent)).toEqual(["Saksi 2 P no. 4"]);
    const simpan = tombol(h, /^Simpan keterangan 2 saksi ke ABT/);
    const tulisSaksi = () => h.minta.filter((m) => m.cara === "POST" && m.url.includes("tanyajawab") && !m.badan.includes("load_template"));
    const sebelum = tulisSaksi().length;
    simpan.click();
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog");
    expect(tirai.textContent).toContain("Masih ada jawaban saksi yang belum terisi");
    expect(tirai.textContent).toContain("Saksi 1 P no. 4: Apakah sejak ada masalah");
    expect(tirai.querySelector(".aleta-t6-dialog-ya").disabled).toBe(true);
    tirai.querySelector(".aleta-t6-dialog-tidak").click();
    await tunggu(80);
    expect(tulisSaksi().length).toBe(sebelum);

    simpan.click();
    const tirai2 = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog kedua");
    const centang = tirai2.querySelector(".aleta-t6-dialog-periksa");
    centang.checked = true;
    centang.dispatchEvent(new h.w.Event("change"));
    tirai2.querySelector(".aleta-t6-dialog-ya").click();
    await sampai(() => tulisSaksi().length > sebelum, "tersimpan sesudah konfirmasi");
  });

  it("semua jawaban terisi: simpan berjalan tanpa dialog", async () => {
    const h = buka({ simpanan: ui([], nyata) });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    expect(hasil.querySelector(".aleta-t6-sdg-siap").textContent).toBe("✓ 6 jawaban terisi.");
    tombol(h, /^Simpan keterangan 2 saksi ke ABT/).click();
    await tunggu(60);
    expect(h.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
  });
});

describe("butir 20-23: penyunting saksi - tidak ramai, huruf 15px, kotak setinggi isi, baris sejajar", () => {
  it("✎ varian duduk di baris pertanyaan; templat pribadi dan catatan 'belum tersedia' di 'Lainnya'; ikon baris tetap ada", async () => {
    const h = buka({ simpanan: ui(["abt-15", "abt-28", "abt-20"]) });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    const baris = hasil.querySelector(".aleta-sdg-kolom .aleta-sdg-baris");
    expect(baris.querySelector(".aleta-sdg-alat > .aleta-t6-varian > .aleta-t6-tombol").textContent).toBe("✎");
    expect(Array.from(baris.querySelectorAll(".aleta-sdg-tombol")).map((b: any) => b.textContent)).toEqual(["↑", "↓", "⇄", "⧉", "✕"]);
    const lainnya = hasil.querySelector(".aleta-t6-sdg-lainnya");
    expect(lainnya.tagName).toBe("DETAILS");
    expect(lainnya.querySelector(".aleta-t6-templat")).not.toBeNull();
    expect(lainnya.querySelector(".aleta-t6-belum-tersedia")).not.toBeNull();
    // Catatan "Seret ⠿ ..." terlipat di balik ⓘ, teksnya utuh.
    const seret = await sampai(
      () => Array.from(hasil.querySelectorAll(".aleta-abt-catatan")).find((x: any) => /^Seret/.test(x.textContent) && x.getAttribute("data-t6-info") === "tutup"),
      "catatan seret terlipat"
    );
    expect((seret as any).textContent).toContain("⧉ menyalin tanpa memindahkan");
  });

  it("berdampingan: kolom saksi merentang --t6-baris baris kisi (subgrid) - pertanyaan bernomor sama sebaris", async () => {
    const h = buka({ simpanan: ui([]) });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    const dua = hasil.querySelector(".aleta-sdg-dua");
    expect(dua.getAttribute("data-t6-sejajar")).toBe("ya");
    // judul + 3 pertanyaan + "+ Tambah keterangan"
    expect(dua.style.getPropertyValue("--t6-baris")).toBe("5");
    hasil.querySelector(".aleta-sdg-kolom .aleta-sdg-tambah").click();
    await sampai(() => dua.style.getPropertyValue("--t6-baris") === "6", "baris kisi bertambah");
    const css = baca("panel.css");
    expect(css).toMatch(
      /#aleta-panel-abt \.aleta-sdg-dua\[data-t6-sejajar\]:not\(\.aleta-sdg-tumpuk\) > \.aleta-sdg-kolom \{\s*display: grid;\s*grid-template-rows: subgrid;\s*grid-row: span var\(--t6-baris, 1\);/
    );
  });

  it("CSS: keterangan saksi 15px dengan pengali skala, tanpa gulir (field-sizing / overflow), tetap dapat disunting", () => {
    const css = baca("panel.css");
    const aturan = /#aleta-panel-abt \.aleta-sdg-hasil\[data-t6-hias\] \.aleta-sdg-jawab \{([^}]*)\}/.exec(css);
    expect(aturan).not.toBeNull();
    const isi = aturan![1];
    expect(isi).toContain("font-size: calc(15px * var(--aleta-skala-huruf, 1));");
    expect(isi).toContain("field-sizing: content;");
    expect(isi).toContain("overflow-y: hidden;");
    expect(isi).not.toMatch(/readonly|pointer-events/);
  });

  it("peramban tanpa field-sizing: tinggi kotak diukur dari isinya saat diketik", async () => {
    const h = buka({ simpanan: ui([]) });
    Object.defineProperty(h.w.HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 20 * (String(this.value).split("\n").length + 1);
      },
    });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    const ta = hasil.querySelector("textarea.aleta-sdg-jawab");
    await sampai(() => ta.style.height === "42px", "tinggi awal");
    ta.value = "satu\ndua\ntiga\nempat";
    ta.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    expect(ta.style.height).toBe("102px");
  });
});

describe("bagian Juru Sita (jurusita.js) di panel ABT", () => {
  type Panggil = { wadah: any; opsi: any };
  const pasangJurusita = (dipanggil: Panggil[], hasil: boolean, boleh: (p?: string) => boolean) => (w: any) => {
    w.aletaJurusitaBoleh = boleh;
    w.aletaJurusitaPasang = async (wadah: any, opsi: any) => {
      dipanggil.push({ wadah, opsi });
      if (hasil) wadah.appendChild(w.document.createElement("p")).textContent = "isi juru sita";
      return hasil;
    };
  };
  const bolehJs = (p?: string) => /jurusita|juru sita|panitera|admin/i.test(String(p || ""));

  it("juru sita: bagian terbuka dan aletaJurusitaPasang dipanggil dengan situs, nomor, dan perkara ABT", async () => {
    const dipanggil: Panggil[] = [];
    const h = buka({ simpanan: ui([]), ganti: sebagai("Jurusita"), sebelum: pasangJurusita(dipanggil, true, bolehJs) });
    await panelUi(h);
    const kotak = await sampai(() => q(h, ".aleta-t6-jurusita"), "bagian juru sita");
    expect(kotak.open).toBe(true);
    await sampai(() => dipanggil.length === 1, "dipasang");
    expect(dipanggil[0].opsi).toEqual({ situs: "abt", nomorPerkara: NOMOR, perkaraId: "10018" });
    expect(kotak.textContent).toContain("isi juru sita");
  });

  it("panitera: bagian tertutup, dipasang saat dibuka; pulang false = bagiannya disembunyikan", async () => {
    const dipanggil: Panggil[] = [];
    const h = buka({ simpanan: ui([]), ganti: sebagai("Panitera Pengganti"), sebelum: pasangJurusita(dipanggil, false, bolehJs) });
    await panelUi(h);
    const kotak = await sampai(() => q(h, ".aleta-t6-jurusita"), "bagian juru sita");
    expect(kotak.open).toBe(false);
    await tunggu(40);
    expect(dipanggil).toHaveLength(0);
    kotak.open = true;
    await sampai(() => dipanggil.length === 1, "dipasang saat dibuka");
    await sampai(() => kotak.hidden === true, "disembunyikan");
  });

  it("hakim (aletaJurusitaBoleh false), jurusita.js tidak dimuat, dan tampilan Lama: tidak ada bagian Juru Sita", async () => {
    const dipanggil: Panggil[] = [];
    const hakim = buka({ simpanan: ui([]), ganti: sebagai("Hakim"), sebelum: pasangJurusita(dipanggil, true, bolehJs) });
    const tanpa = buka({ simpanan: ui([]), ganti: sebagai("Jurusita") });
    const lama = buka({ simpanan: { ujiTampilan: "lama" }, ganti: sebagai("Jurusita"), sebelum: pasangJurusita(dipanggil, true, bolehJs) });
    await Promise.all([panelUi(hakim), panelUi(tanpa), panelLahir(lama)]);
    await Promise.all([peranTerpasang(hakim), peranTerpasang(tanpa)]);
    await tunggu(300);
    expect(q(hakim, ".aleta-t6-jurusita")).toBeNull();
    expect(q(tanpa, ".aleta-t6-jurusita")).toBeNull();
    expect(q(lama, ".aleta-t6-jurusita")).toBeNull();
    expect(dipanggil).toEqual([]);
  });
});

describe("pengamat tetap tenang dengan perbaikan 30 September", () => {
  it("seluruh saklar, langkah gabung dan penyunting saksi: sesudah tenang DOM panel tidak berubah lagi", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata), isi: { "1268": UPAYA_DAMAI }, ganti: denganRukun });
    await panelUi(h);
    await peranTerpasang(h);
    langkahDari(h, "gabung").click();
    await sampai(() => langkahDari(h, "gabung").classList.contains("aleta-t6-selesai"), "gabung selesai", 8000);
    await susunSaksi(h);
    await tunggu(400);
    const a = potret(h);
    await tunggu(400);
    expect(potret(h)).toBe(a);
  });
});
