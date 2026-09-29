// @vitest-environment node
/**
 * ============================================================================
 * TAHAP 6 RENCANA "EKSTENSI DULU" - PANEL EKSTENSI DI ABT
 * ============================================================================
 *
 * panel-alat.js dan abt.js dijalankan SUNGGUHAN sebagai satu skrip di jendela
 * jsdom beralamat halaman blangko ABT - sama dengan dunia terasing Chrome.
 * Yang ditiru hanya tepi luarnya: chrome.storage (beserta onChanged) dan
 * jawaban jaringan - rute /abt/usulan, halaman ABT (edit_data, tanya-jawab,
 * preview, anonim), dan tiga rute server Tahap 6 menurut KONTRAK.md
 * (bas-komentar, templat-hukum, abt-wajib).
 *
 * Yang dijaga, menurut pentingnya:
 *   1. Tampilan Lama IDENTIK dengan abt.js commit fd9aad7 (sebelum Tahap 6):
 *      DOM panel sesudah tiap langkah kerja, atribut <html>, penyimpanan, dan
 *      permintaan - walau seluruh saklar abt dan kunci penyimpanan Tahap 6
 *      tersimpan. Baru tanpa satu saklar abt pun juga sama DOM-nya.
 *   2. Tiap ide abt-N hanya tampil bila saklarnya menyala (Baru dan UI Baru);
 *      desain D1-D15 hanya di UI Baru.
 *   3. CETAK dengan huruf G/galat (abt-5) dan unggah dengan anonim yang belum
 *      bersih (abt-26) = peringatan + konfirmasi "Sudah saya periksa", bukan
 *      penahanan; Batal benar-benar tidak mencetak/mengunggah.
 *   4. Templat pasal DRAF tidak dapat disisipkan (abt-27).
 *   5. Tidak ada permintaan non-GET baru selain yang memang fitur, dan
 *      semuanya tunduk mode coba (423 disebut apa adanya).
 */
import { execFileSync } from "node:child_process";
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
/**
 * abt.js SEBELUM Tahap 6 - pembanding "Lama identik". Diambil dari sejarah
 * git (commit tetap), bukan dari salinan di pohon kerja yang dapat ikut
 * tersunting.
 */
const SUMBER_ABT_LAMA = execFileSync("git", ["show", "fd9aad7:ekstensi-sipp/abt.js"], {
  cwd: EKSTENSI,
  encoding: "utf8",
}).replace(/\r\n/g, "\n");

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

function buka(p: { sumber?: string; simpanan?: Record<string, unknown>; ganti?: Pengganti; konfirmasi?: boolean } = {}): Halaman {
  const baris = Object.keys(ISI)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${ISI[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="cssmenu"></div><div id="content">` +
      `<h3 class="w3l_header"><span>${NOMOR}</span></h3>` +
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
  w.eval(
    `${SUMBER_ALAT}\n;\n${p.sumber ?? SUMBER_ABT}\n;\nwindow.__uji = { kerjakan: typeof kerjakanSatuPerkaraAbt === "function" ? kerjakanSatuPerkaraAbt : null, ` +
      `t6: typeof t6TeksRtf === "function" ? { t6TeksRtf, t6KalimatRamah, t6VarianKalimat, t6PeriksaAnonim, t6DataPribadi } : null };`
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
describe("SYARAT MUTLAK: tampilan Lama IDENTIK dengan abt.js sebelum Tahap 6 (fd9aad7)", () => {
  /** Rangkaian kerja yang sama di dua halaman; potret panel sesudah tiap langkah. */
  async function jalani(h: Halaman) {
    const hasil: string[] = [];
    await panelLahir(h);
    await sampai(() => q(h, ".aleta-id-aleta"), "pita akun");
    await tunggu(60);
    hasil.push(potret(h), JSON.stringify(atributAkar(h)));
    await isiDariSipp(h);
    hasil.push(potret(h));
    await inputKeAbt(h);
    hasil.push(potret(h));
    h.w.document.getElementById("cetak").click();
    await tunggu(30);
    hasil.push(potret(h), JSON.stringify(h.konfirmasi.length), JSON.stringify(h.navigasi));
    await susunSaksi(h);
    hasil.push(potret(h));
    // Sunting di tempat pada halaman ABT.
    const sel = h.w.document.getElementById("0222").parentElement.children[2];
    sel.click();
    const ketik = await sampai(() => sel.querySelector("textarea"), "penyunting di tempat");
    ketik.value = "sejak November 2022";
    sel.querySelector(".aleta-abt-simpan").click();
    await sampai(() => !sel.querySelector("textarea"), "tersimpan");
    await tunggu(30);
    hasil.push(potret(h), String(sel.textContent));
    return hasil;
  }

  const SEMUA_T6_TERSIMPAN = {
    ujiFitur: fitur(SEMUA_ABT),
    abtModeBaca: true,
    abtVariabelSematan: ["0222"],
    abtDrafSaksi: { [NOMOR]: { pada: "2026-09-29T10:00:00.000Z", kolom: [{ judul: "Saksi 1 P", baris: [{ tanya: "a", jawab: "b" }] }] } },
    abtTemplatPribadi: { "Cerai Gugat": [{ nama: "x", tanya: ["a"] }] },
    abtAlasanDitolak: { "10018": ["tidak memberi nafkah"] },
  };

  for (const [nama, simpanan] of [
    ["tanpa kunci ujiTampilan, seluruh 30 saklar abt dan kunci Tahap 6 tersimpan", SEMUA_T6_TERSIMPAN],
    ["ujiTampilan 'lama' tertulis, seluruh saklar menyala", { ...SEMUA_T6_TERSIMPAN, ujiTampilan: "lama" }],
    ["nilai tampilan asing (diperlakukan Lama)", { ...SEMUA_T6_TERSIMPAN, ujiTampilan: "entah" }],
  ] as const) {
    it(`${nama}: DOM tiap langkah, atribut <html>, penyimpanan, dan permintaan sama persis`, async () => {
      const lama = buka({ sumber: SUMBER_ABT_LAMA, simpanan });
      const kini = buka({ simpanan });
      const [a, b] = await Promise.all([jalani(lama), jalani(kini)]);
      expect(b).toEqual(a);
      await tunggu(40);
      expect(tanpaCap(kini.simpanan)).toEqual(tanpaCap(lama.simpanan));
      expect(kini.tulisan.sort()).toEqual(lama.tulisan.sort());
      const daftar = (h: Halaman) => h.minta.map((m) => `${m.cara} ${m.url.replace(ASAL, "")} ${m.badan.replace(/"pada":"[^"]*"/g, "")}`).sort();
      expect(daftar(kini)).toEqual(daftar(lama));
      expect(mintaT6(kini)).toEqual([]);
      expect(kini.konfirmasi.length).toBe(1);
      expect(potret(kini)).not.toMatch(/aleta-t6|data-t6/);
      expect(kini.w.document.querySelector(".aleta-t6, .aleta-t6-sorot, [data-t6-baca]")).toBeNull();
      for (const k of KUNCI_T6) expect(kini.tulisan.includes(k), k).toBe(false);
    });
  }

  it("Lama: unggah dari 'Kerjakan perkara ini' tidak memeriksa anonim dan urutan permintaannya sama persis", async () => {
    const simpanan = { ujiTampilan: "lama", ujiFitur: fitur(SEMUA_ABT) };
    const jalan = async (h: Halaman) => {
      await panelLahir(h);
      await tunggu(40);
      h.minta.length = 0;
      const hasil = await h.w.__uji.kerjakan(
        { nomor: NOMOR, perkaraId: "10018", jenis: "cerai gugat" },
        { a: "A", b: "B", berkas: "[01].rtf" },
        { draf: false, anonim: true, unggah: true, unduh: false, pdf: false },
        "derry",
        () => {}
      );
      return { hasil: polos(hasil), minta: h.minta.map((m) => `${m.cara} ${m.url.replace(ASAL, "")}`) };
    };
    const lama = buka({ sumber: SUMBER_ABT_LAMA, simpanan });
    const kini = buka({ simpanan });
    const [a, b] = await Promise.all([jalan(lama), jalan(kini)]);
    expect(b).toEqual(a);
    expect(b.minta.some((m) => m.includes("/putusan/unggah-sipp"))).toBe(true);
    expect(kini.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
  });

  it("Baru TANPA satu saklar abt pun: DOM panel sama dengan Lama - hanya saklar yang membawa perubahan", async () => {
    const lama = buka({ simpanan: {} });
    const kini = buka({ simpanan: baru(["sipp-5", "portal-3"]) });
    await Promise.all([panelLahir(lama), panelLahir(kini)]);
    await Promise.all([sampai(() => q(lama, ".aleta-id-aleta"), "pita"), sampai(() => q(kini, ".aleta-id-aleta"), "pita")]);
    await tunggu(80);
    expect(potret(kini)).toBe(potret(lama));
    await Promise.all([isiDariSipp(lama), isiDariSipp(kini)]);
    expect(potret(kini)).toBe(potret(lama));
    expect(mintaT6(kini)).toEqual([]);
  });

  it("dari Baru kembali ke Lama seketika: panel disusun ulang tanpa sisa Tahap 6", async () => {
    const pembanding = buka({ simpanan: {} });
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata) });
    await Promise.all([panelLahir(pembanding), panelUi(h)]);
    await sampai(() => q(pembanding, ".aleta-id-aleta"), "pita");
    const panelPertama = panelDari(pembanding);
    q(pembanding, ".aleta-kaki-segar").click();
    await sampai(() => panelDari(pembanding) && panelDari(pembanding) !== panelPertama && q(pembanding, ".aleta-id-aleta"), "pembanding disegarkan");
    await h.setel({ ujiTampilan: "lama" });
    await sampai(() => panelDari(h) && !panelDari(h).hasAttribute("data-t6") && !q(h, ".aleta-t6"), "panel Lama kembali");
    await sampai(() => q(h, ".aleta-id-aleta"), "pita");
    await tunggu(80);
    expect(potret(h)).toBe(potret(pembanding));
    expect(h.w.document.querySelector(".aleta-t6, .aleta-t6-wajib-cetak")).toBeNull();
    expect(h.w.document.documentElement.hasAttribute("data-aleta-kulit")).toBe(false);
  });
});

describe("pergantian tampilan tidak membuang keterangan saksi yang sedang disunting", () => {
  it("penyunting saksi terbuka: panel tidak disusun ulang sampai ↻ ditekan, dan sebabnya disebut", async () => {
    const h = buka({ simpanan: ui([]) });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    hasil.querySelector("textarea").value = "diketik petugas";
    await h.setel({ ujiTampilan: "lama" });
    await sampai(() => /Panel disusun ulang saat ↻ ditekan/.test(q(h, ".aleta-abt-kabar")?.textContent || ""), "kabar penundaan");
    expect(q(h, ".aleta-sdg-hasil textarea").value).toBe("diketik petugas");
    q(h, ".aleta-kaki-segar").click();
    await sampai(() => panelDari(h) && !panelDari(h).hasAttribute("data-t6") && !q(h, ".aleta-t6"), "disusun ulang sebagai Lama");
  });
});

// ============================================================================
describe("ide abt-N hanya tampil bila saklarnya menyala (Baru)", () => {
  /** [kode, pemilih unsur yang HANYA lahir dari ide itu]. */
  const UNSUR: Array<[string, string]> = [
    ["abt-1", ".aleta-t6-ramah"],
    ["abt-3", ".aleta-t6-akan-terjadi"],
    ["abt-4", ".aleta-t6-segmen"],
    ["abt-5", ".aleta-t6-pita-bahaya"],
    ["abt-10", ".aleta-t6-langkah"],
    ["abt-11", ".aleta-t6-kemajuan"],
    ["abt-17", ".aleta-t6-wajib"],
    ["abt-18", ".aleta-t6-komentar"],
    ["abt-21", ".aleta-t6-cari-masuk"],
    ["abt-22", ".aleta-t6-sematan"],
    ["abt-23", ".aleta-t6-kepala-tombol:not(.aleta-t6-tombol-baca)"],
    ["abt-25", ".aleta-t6-tombol-baca"],
  ];
  const ALAT: Array<[string, string]> = [
    ["abt-12", "Pratinjau putusan"],
    ["abt-13", "Periksa konsistensi"],
    ["abt-19", "Perkara sebelumnya"],
    ["abt-24", "Perkiraan panjang"],
    ["abt-27", "Saran dasar hukum"],
    ["abt-30", "Ringkasan musyawarah"],
  ];

  it("tiap unsur ada bila saklarnya SENDIRIAN menyala, dan tidak ada bila seluruh saklar LAIN menyala", async () => {
    for (const [kode, pemilih] of UNSUR) {
      const sendiri = buka({ simpanan: baru([kode]) });
      const lain = buka({ simpanan: baru(SEMUA_ABT.filter((x) => x !== kode)) });
      await sampai(() => q(sendiri, pemilih), `${kode} sendirian: ${pemilih}`);
      await adaT6(lain);
      await tunggu(40);
      expect(q(lain, pemilih), `${kode} tanpa saklarnya`).toBeNull();
    }
    for (const [kode, label] of ALAT) {
      const sendiri = buka({ simpanan: baru([kode]) });
      const lain = buka({ simpanan: baru(SEMUA_ABT.filter((x) => x !== kode && !(kode === "abt-24" && x === "abt-12"))) });
      await sampai(() => tombol(sendiri, label), `${kode} sendirian: ${label}`);
      await adaT6(lain);
      await tunggu(40);
      expect(tombol(lain, label), `${kode} tanpa saklarnya`).toBeUndefined();
    }
  });

  it("permintaan server Tahap 6 hanya milik saklarnya: abt-17 wajib, abt-18 komentar - dan tidak ada yang lain saat panel lahir", async () => {
    const h17 = buka({ simpanan: baru(["abt-17"]) });
    const h18 = buka({ simpanan: baru(["abt-18"]) });
    const hLain = buka({ simpanan: baru(SEMUA_ABT.filter((x) => x !== "abt-17" && x !== "abt-18")) });
    await sampai(() => q(h17, ".aleta-t6-wajib-kurang"), "wajib terbaca");
    await sampai(() => /belum selesai/.test(q(h18, ".aleta-t6-komentar-judul")?.textContent || ""), "komentar terbaca");
    await adaT6(hLain);
    await tunggu(80);
    expect(mintaT6(h17)).toEqual(["GET /aleta/api/aleta-ecourt/abt-wajib?jenis=Cerai%20Gugat"]);
    expect(mintaT6(h18)).toEqual([`GET /aleta/api/aleta-ecourt/bas-komentar?nomor=${encodeURIComponent(NOMOR)}`]);
    // Templat pasal, riwayat pihak, dan preview baru diminta saat ditekan.
    expect(mintaT6(hLain)).toEqual([]);
  });

  it("abt-2: yang memang tidak berlaku (tanpa kuasa, bukan prodeo) dilipat; 0227 yang tidak bergantung kuasa/prodeo tetap tampak", async () => {
    const h = buka({ simpanan: baru(["abt-2"]) });
    await panelLahir(h);
    await isiDariSipp(h);
    const lipat = await sampai(() => q(h, ".aleta-t6-lipat-takberlaku"), "baris lipat");
    expect(lipat.textContent).toContain("3 variabel memang tidak berlaku untuk perkara ini (tanpa kuasa, bukan prodeo): 0132, 0156, 0661");
    const kartu = (kode: string) => qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === kode);
    expect(kartu("0132").getAttribute("data-t6-tak-berlaku")).toBe("ya");
    expect(kartu("0227").hasAttribute("data-t6-tak-berlaku")).toBe(false);
    const mati = buka({ simpanan: baru(["abt-4"]) });
    await panelLahir(mati);
    await isiDariSipp(mati);
    expect(q(mati, ".aleta-t6-lipat-takberlaku")).toBeNull();
    expect(qs(mati, "[data-t6-tak-berlaku]")).toHaveLength(0);
  });

  it("abt-4: segmen berangka menyaring; yang tercentang tetapi tersembunyi disebut", async () => {
    const h = buka({ simpanan: baru(["abt-4"]) });
    await panelLahir(h);
    await inputKeAbt(h);
    const seg = await sampai(() => (q(h, ".aleta-t6-segmen:not([hidden])") ? q(h, ".aleta-t6-segmen") : null), "segmen tampak");
    const angka = (kunci: string) => seg.querySelector(`[data-t6-yakin="${kunci}"] .aleta-t6-segmen-angka`).textContent;
    expect([angka("semua"), angka("pasti"), angka("cukup"), angka("bentrok"), angka("ragu")]).toEqual(["3", "1", "1", "1", "0"]);
    seg.querySelector('[data-t6-yakin="bentrok"]').click();
    const wadah = q(h, ".aleta-t6-usulan");
    expect(wadah.getAttribute("data-t6-saring")).toBe("bentrok");
    // 0222 (pasti) dan 9944 (cukup) tercentang sendiri dan kini tersembunyi.
    expect(q(h, ".aleta-t6-segmen-catatan").textContent).toContain("2 usulan tercentang sedang tersembunyi saringan");
  });

  it("abt-10: langkah mewakili tombol lama - menekan langkah 1 menjalankan 'Isi blangko dari SIPP' dan diberi tanda selesai", async () => {
    const h = buka({ simpanan: baru(["abt-10"]) });
    const langkah = await sampai(() => q(h, ".aleta-t6-langkah"), "langkah");
    expect(Array.from(langkah.querySelectorAll(".aleta-t6-langkah-nama")).map((x: any) => x.textContent)).toEqual([
      "Isi dari SIPP",
      "Susun saksi",
      "Rapikan",
      "Input ke ABT",
      "Kerjakan",
    ]);
    // Tombol lama tetap ada di DOM (disembunyikan CSS), dan langkah 1 duduk
    // paling awal di baris tindakan - Alt+P tetap berarti "isi dari SIPP".
    expect(tombol(h, "Isi blangko dari SIPP").classList.contains("aleta-t6-diwakili")).toBe(true);
    const pertama = q(h, ".aleta-abt-aksi .aleta-permintaan-tombol");
    expect(pertama.getAttribute("data-t6-langkah")).toBe("1");
    pertama.click();
    await sampai(() => qs(h, ".aleta-abt-kartu").length >= 5, "usulan SIPP");
    await sampai(() => pertama.classList.contains("aleta-t6-selesai"), "langkah 1 selesai");
    expect(h.minta.some((m) => m.url.includes("/abt/usulan") && m.badan.includes('"sipp"'))).toBe(true);
  });

  it("abt-1: kalimat teknis menjadi satu kalimat ramah; teks aslinya tetap utuh di Rincian", async () => {
    const h = buka({ simpanan: baru(["abt-1"]) });
    await panelLahir(h);
    await isiDariSipp(h);
    const ramah = await sampai(() => q(h, ".aleta-t6-ramah"), "kalimat ramah");
    expect(ramah.textContent).toBe("Tidak ada kuasa aktif · bukan prodeo. Variabel prodeo dan fasakh diisi tangan.");
    expect(q(h, ".aleta-t6-rincian .aleta-abt-kabar").textContent).toContain("Kuasa aktif: 0. Prodeo: tidak.");
    const t6 = h.w.__uji.t6;
    expect(
      t6.t6KalimatRamah(
        "Terbaca 1 butir dari saksi 1 dan 1 dari saksi 2 (saksi 1 dibaca dari layar - bacaan mentah gagal: tidak ada sidang yang memuat keterangan saksi ini - diperiksa urutan 1 sampai 12).",
        false
      )
    ).toBe("Keterangan saksi belum tersimpan per sidang di ABT - saksi 1 dan 2 dibaca dari layar (1 dan 1 butir).");
  });

  it("abt-3: centang unggah bersusun dan kalimat 'yang akan terjadi' mengikuti pilihannya", async () => {
    const h = buka({ simpanan: baru(["abt-3"]) });
    const kalimat = await sampai(() => q(h, ".aleta-t6-akan-terjadi"), "kalimat");
    expect(kalimat.textContent).toBe(
      "Yang akan terjadi bila ditekan: simpan draf ke ALETA, buat anonim, unggah putusan dan anonimnya ke SIPP. Tidak ada berkas yang diunduh."
    );
    const centang = qs(h, ".aleta-abt-bagian label.aleta-abt-centang-baris input");
    centang[2].checked = false;
    centang[2].dispatchEvent(new h.w.Event("change"));
    expect(kalimat.textContent).toContain("Anonim tidak dibuat - tidak diunggah maupun diunduh.");
  });

  it("abt-11: bilah kemajuan menghitung baris halaman", async () => {
    const h = buka({ simpanan: baru(["abt-11"]) });
    const judul = await sampai(() => q(h, ".aleta-t6-kemajuan-judul"), "kemajuan");
    const total = Object.keys(ISI).length;
    const kosong = Object.values(ISI).filter((v) => v === "DATA_TIDAK_ADA").length;
    expect(judul.textContent).toBe(`${total - kosong - 2} dari ${total} variabel siap`);
    expect(q(h, ".aleta-t6-kemajuan-rinci").textContent).toBe(`${kosong} kosong · 2 berbunyi galat`);
  });
});

// ============================================================================
describe("desain D1-D15 hanya di UI Baru", () => {
  it("UI Baru tanpa saklar: perbaikan desain hadir, ide yang bukan desain tidak, dan tidak ada permintaan server Tahap 6", async () => {
    const h = buka({ simpanan: ui([]) });
    const panel = await panelUi(h);
    await sampai(() => q(h, ".aleta-t6-langkah"), "langkah D2");
    await tunggu(60);
    for (const pemilih of [".aleta-t6-langkah", ".aleta-t6-segmen", ".aleta-t6-kemajuan", ".aleta-t6-pita-bahaya", ".aleta-t6-akan-terjadi", ".aleta-t6-kaki-utama"]) {
      expect(q(h, pemilih), pemilih).not.toBeNull();
    }
    expect(tombol(h, "Pratinjau putusan")).toBeDefined();
    for (const pemilih of [".aleta-t6-cari-masuk", ".aleta-t6-komentar", ".aleta-t6-wajib", ".aleta-t6-kepala-alat", ".aleta-t6-sematan"]) {
      expect(q(h, pemilih), pemilih).toBeNull();
    }
    expect(tombol(h, "Periksa konsistensi")).toBeUndefined();
    expect(mintaT6(h)).toEqual([]);
    // D14: bagian Kerjakan pindah ke ujung isi panel; tombol utamanya di kaki
    // menekan tombol lama yang sama.
    const isi = panel.querySelector(".aleta-isi");
    expect(isi.lastElementChild.classList.contains("aleta-abt-bagian")).toBe(true);
    expect(q(h, ".aleta-kaki .aleta-t6-kaki-ringkas").textContent).toBe("Simpan draf · Anonim · Unggah ke SIPP");
  });

  it("Baru dengan seluruh saklar: tidak ada atribut data-t6 (kulit Modern) dan tidak ada tombol layar penuh penyunting (D9)", async () => {
    const h = buka({ simpanan: baru(SEMUA_ABT, nyata) });
    await adaT6(h);
    await panelLahir(h);
    expect(panelDari(h).hasAttribute("data-t6")).toBe(false);
    expect(q(h, ".aleta-t6-kaki-utama")).toBeNull();
    await susunSaksi(h);
    expect(tombol(h, "⤢ Layar penuh")).toBeUndefined();
    expect(q(h, ".aleta-t6-sdg-nav")).toBeNull();
  });

  it("UI Baru: penyunting saksi punya layar penuh dengan daftar pertanyaan (D9)", async () => {
    const h = buka({ simpanan: ui([]) });
    await panelUi(h);
    const hasil = await susunSaksi(h);
    tombol(h, "⤢ Layar penuh").click();
    expect(hasil.classList.contains("aleta-t6-penuh")).toBe(true);
    const nav = hasil.querySelector(".aleta-t6-sdg-nav");
    expect(nav.querySelectorAll(".aleta-t6-nav-butir")).toHaveLength(3);
    // Baris 2 (tahun 2019 vs 2018) berbeda; baris 3 sama persis.
    expect(nav.querySelectorAll(".aleta-t6-nav-butir")[1].textContent).toContain("beda");
  });

  it("CSS: seluruh aturan Tahap 6 ada di antara penandanya, dan aturan kulit Modern berawalan penanda <html>", () => {
    const css = baca("panel.css");
    const mulai = css.indexOf("PANEL ABT - TAHAP 6 (MULAI)");
    const akhir = css.indexOf("/* PANEL ABT - TAHAP 6 (AKHIR) */");
    expect(mulai).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(mulai);
    const blok = css.slice(css.indexOf("*/", mulai) + 2, akhir).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.slice(0, mulai)).not.toMatch(/aleta-t6-/);
    let dihitung = 0;
    for (const aturan of blok.split("}")) {
      if (!aturan.includes("{")) continue;
      const pemilih = aturan.split("{")[0].trim();
      dihitung += 1;
      for (const bagian of pemilih.split(",")) {
        const b = bagian.trim();
        if (!b) continue;
        // Tiap bagian bersyarat: unsur Tahap 6, atribut Tahap 6, atau kulit Modern.
        expect(b, b).toMatch(/aleta-t6|data-t6|^html\[data-aleta-kulit="modern"\]/);
        if (/kulit/.test(b)) expect(b, b).toMatch(/^html\[data-aleta-kulit="modern"\]/);
      }
    }
    // Penyisirnya sungguh membaca aturan - bukan penjaga yang selalu hijau.
    expect(dihitung).toBeGreaterThan(100);
  });
});

// ============================================================================
describe("abt-5: CETAK dengan kalimat galat = peringatan dengan konfirmasi, bukan penahanan", () => {
  it("pita merah di atas panel menyebut huruf G dan kelima kalimatnya ikut tercetak", async () => {
    const h = buka({ simpanan: baru(["abt-5"]) });
    const pita = await sampai(() => (q(h, ".aleta-t6-pita-bahaya:not([hidden])") ? q(h, ".aleta-t6-pita-bahaya") : null), "pita");
    expect(pita.textContent).toContain("Blangko ini belum punya cabang untuk huruf G");
    expect(pita.textContent).toContain('4020, 8521 berbunyi "TIDAK BENAR QUERY NYA"');
    expect(pita.textContent).toContain("enam baris huruf C/D/E/G");
    expect(pita.textContent).toContain("CETAK tidak ditahan");
    expect(panelDari(h).querySelector(".aleta-isi").firstElementChild.classList.contains("aleta-t6-atas")).toBe(true);
  });

  it("Batal: tidak mencetak, dan penjaga lama tidak bertanya lagi; konfirmasi 'Sudah saya periksa' lalu Tetap CETAK: mencetak sekali", async () => {
    const h = buka({ simpanan: baru(["abt-5"]) });
    await sampai(() => q(h, ".aleta-t6-pita-bahaya:not([hidden])"), "pita");
    const cetak = h.w.document.getElementById("cetak");
    cetak.click();
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog");
    expect(tirai.textContent).toContain("4020 Kalimat Alasan (OTOMATIS)");
    expect(tirai.textContent).toContain("8503 berisi huruf G");
    const ya = tirai.querySelector(".aleta-t6-dialog-ya");
    expect(ya.disabled).toBe(true);
    tirai.querySelector(".aleta-t6-dialog-tidak").click();
    await tunggu(20);
    expect(h.navigasi).toEqual([]);
    expect(h.konfirmasi).toEqual([]);

    cetak.click();
    const tirai2 = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog kedua");
    const ya2 = tirai2.querySelector(".aleta-t6-dialog-ya");
    ya2.click();
    await tunggu(10);
    expect(h.navigasi).toEqual([]);
    const centang = tirai2.querySelector(".aleta-t6-dialog-periksa");
    centang.checked = true;
    centang.dispatchEvent(new h.w.Event("change"));
    expect(ya2.disabled).toBe(false);
    ya2.click();
    await sampai(() => h.navigasi.length === 1, "tercetak");
    expect(h.navigasi).toEqual([CETAK]);
    // Penjaga lama (window.confirm) tidak ditanyakan kedua kalinya.
    expect(h.konfirmasi).toEqual([]);
    expect(h.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
  });

  it("tanpa abt-5 (Baru, saklar lain menyala): CETAK tetap memakai penjaga lama", async () => {
    const h = buka({ simpanan: baru(SEMUA_ABT.filter((x) => x !== "abt-5")) });
    await adaT6(h);
    h.w.document.getElementById("cetak").click();
    await tunggu(30);
    expect(h.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
    expect(h.konfirmasi).toHaveLength(1);
    expect(h.konfirmasi[0]).toContain("ALETA menahan pencetakan sebentar.");
  });
});

// ============================================================================
describe("abt-26: pemeriksa anonimisasi = peringatan dengan konfirmasi, dan letaknya ditunjukkan", () => {
  const kerjakan = (h: Halaman) =>
    h.w.__uji.kerjakan(
      { nomor: NOMOR, perkaraId: "10018", jenis: "cerai gugat" },
      { a: "A", b: "B", berkas: "[01].rtf" },
      { draf: false, anonim: true, unggah: true, unduh: false, pdf: false },
      "derry",
      () => {}
    );

  it("nama pihak, NIK, dan desa yang masih utuh disebut beserta paragrafnya; Batalkan = tidak ada unggahan", async () => {
    const h = buka({ simpanan: baru(["abt-26"], nyata) });
    await adaT6(h).catch(() => panelLahir(h));
    const janji = kerjakan(h);
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog anonim");
    const teks = tirai.textContent;
    expect(teks).toContain("⚠ 1 NIK utuh");
    expect(teks).toContain('nama pihak "Sarinah Wulandari" (dari 7047) - paragraf 3');
    expect(teks).toContain('alamat "Tanamea"');
    expect(tirai.querySelector(".aleta-t6-dialog-ya").disabled).toBe(true);
    tirai.querySelector(".aleta-t6-dialog-tidak").click();
    const hasil = await janji;
    expect(hasil.ringkas).toContain("unggah ke SIPP dibatalkan petugas");
    expect(h.minta.some((m) => m.url.includes("/putusan/unggah-sipp"))).toBe(false);
  });

  it("konfirmasi 'Sudah saya periksa' lalu Tetap unggah: unggahannya berjalan", async () => {
    const h = buka({ simpanan: baru(["abt-26"], nyata) });
    await panelLahir(h);
    const janji = kerjakan(h);
    const tirai = await sampai(() => h.w.document.querySelector(".aleta-t6-tirai"), "dialog anonim");
    const centang = tirai.querySelector(".aleta-t6-dialog-periksa");
    centang.checked = true;
    centang.dispatchEvent(new h.w.Event("change"));
    tirai.querySelector(".aleta-t6-dialog-ya").click();
    const hasil = await janji;
    expect(hasil.ringkas).toContain("tetap diunggah atas konfirmasi petugas");
    expect(h.minta.filter((m) => m.url.includes("/putusan/unggah-sipp"))).toHaveLength(1);
  });

  it("anonim yang bersih: tidak ada dialog, unggah langsung berjalan", async () => {
    const h = buka({
      simpanan: baru(["abt-26"], nyata),
      ganti: (url) => (url.includes("/main/anonim") ? { mentah: RTF_ANONIM_BERSIH, jenis: "application/rtf" } : undefined),
    });
    await panelLahir(h);
    const hasil = await kerjakan(h);
    expect(h.w.document.querySelector(".aleta-t6-tirai")).toBeNull();
    expect(hasil.ringkas).toContain("anonim diperiksa: NIK, 2 nama, 1 alamat tersamar");
    expect(h.minta.filter((m) => m.url.includes("/putusan/unggah-sipp"))).toHaveLength(1);
  });

  it("pembaca RTF: tabel huruf dilewati, \\'hh diterjemahkan, \\par menjadi baris", () => {
    const h = buka({ simpanan: {} });
    const teks = h.w.__uji.t6.t6TeksRtf(RTF_PUTUSAN);
    expect(teks).not.toContain("Times New Roman");
    expect(teks).toContain("Bahwa Penggugat mengajukan gugatan, tertanggal 3 Agustus 2026;");
    expect(teks.split("\n").filter(Boolean)[0]).toBe("PUTUSAN");
  });
});

// ============================================================================
describe("abt-27: saran dasar hukum - hanya yang disahkan yang dapat disisipkan", () => {
  it("DRAF bertanda 'DRAF - belum disahkan' dan tombol Sisipkan mati; yang disahkan tersisip ke kotak yang terakhir disunting", async () => {
    const h = buka({ simpanan: baru(["abt-27"]) });
    await panelLahir(h);
    const sel = h.w.document.getElementById("5227").parentElement.children[2];
    sel.click();
    const ketik = await sampai(() => sel.querySelector("textarea"), "penyunting 5227");
    ketik.dispatchEvent(new h.w.FocusEvent("focusin", { bubbles: true }));
    (await sampai(() => tombol(h, "Saran dasar hukum"), "alat pasal")).click();
    // 8503 berisi G: hanya huruf G yang ditampilkan - dan ia DRAF.
    const kartu = await sampai(() => q(h, ".aleta-t6-pasal"), "kartu pasal");
    expect(kartu.textContent).toContain("DRAF - belum disahkan");
    const sisip = kartu.querySelector(".aleta-t6-sisip");
    expect(sisip.disabled).toBe(true);
    sisip.click();
    await tunggu(10);
    expect(ketik.value).toBe("");

    // Di kartu huruf F (dari "Input ke ABT") butir yang disahkan dapat disisipkan.
    await inputKeAbt(h);
    const hurufF = await sampai(() => q(h, ".aleta-abt-huruf .aleta-t6-pasal"), "saran di kartu huruf");
    expect(hurufF.textContent).toContain("disahkan");
    expect(hurufF.textContent).not.toContain("DRAF");
    hurufF.querySelector(".aleta-t6-sisip").click();
    await sampai(() => ketik.value.includes("Pasal 19 huruf f PP 9/1975"), "tersisip");
    expect(h.minta.filter((m) => m.url.includes("/templat-hukum"))).toHaveLength(1);
  });

  it("server tanpa rutenya (404): disebut 'belum tersedia di server', bukan gagal", async () => {
    const h = buka({ simpanan: baru(["abt-27"]), ganti: (url) => (url.includes("/templat-hukum") ? { status: 404, isi: {} } : undefined) });
    await panelLahir(h);
    (await sampai(() => tombol(h, "Saran dasar hukum"), "alat pasal")).click();
    const pesan = await sampai(() => q(h, "[data-t6-alat='pasal'] .aleta-t6-bagian-isi")?.textContent.includes("belum tersedia") && q(h, "[data-t6-alat='pasal']"), "pesan");
    expect(pesan.textContent).toContain("Templat dasar hukum belum tersedia di server.");
  });
});

// ============================================================================
describe("abt-18: komentar hakim atas BAS - tanpa acc, tidak menahan, PP menandai selesai", () => {
  it("komentar tampil di baris pertanyaannya (Saksi 1 P no. 2) dan di kartu huruf F", async () => {
    const h = buka({ simpanan: baru(["abt-18"]) });
    await sampai(() => /2 belum selesai/.test(q(h, ".aleta-t6-komentar-judul")?.textContent || ""), "komentar");
    const hasil = await susunSaksi(h);
    const kolom = hasil.querySelectorAll(".aleta-sdg-kolom");
    const baris = kolom[0].querySelectorAll(".aleta-sdg-baris");
    expect(baris[1].querySelector(".aleta-t6-lencana-hakim")?.textContent).toBe("komentar hakim");
    expect(baris[0].querySelector(".aleta-t6-lencana-hakim")).toBeNull();
    expect(kolom[1].querySelector(".aleta-t6-lencana-hakim")).toBeNull();
    // Tombol simpan penyunting tetap hidup - komentar tidak menahan apa pun.
    expect(tombol(h, /^Simpan keterangan 2 saksi ke ABT/).disabled).toBe(false);
    await inputKeAbt(h);
    await sampai(() => q(h, ".aleta-abt-huruf .aleta-t6-komentar-kartu"), "komentar di kartu huruf");
  });

  it("Tandai selesai: PATCH {id, selesai} - catatan internal yang lolos mode coba (ALETA_COBA_BOLEH), dan ditahan-lalu-DISEBUT dalam mode latihan", async () => {
    // Mode coba: PATCH bas-komentar ada di ALETA_COBA_BOLEH (kontrak Tahap
    // 6-7) - ia catatan antar-petugas, tidak menyentuh SIPP, ABT, maupun WA.
    const h = buka({ simpanan: baru(["abt-18"]) });
    await sampai(() => q(h, ".aleta-t6-komentar-kartu"), "komentar");
    q(h, ".aleta-t6-komentar-kartu .aleta-t6-tombol").click();
    await sampai(() => /1 belum selesai/.test(q(h, ".aleta-t6-komentar-judul").textContent), "tertanda selesai");
    const patch = h.minta.filter((m) => m.cara === "PATCH");
    expect(patch).toHaveLength(1);
    expect(patch[0].url).toBe("/aleta/api/aleta-ecourt/bas-komentar");
    expect(JSON.parse(patch[0].badan)).toEqual({ id: "kom-1", selesai: true });

    // Mode latihan (Tahap 7) menahannya: jawaban 423 disebut apa adanya dan
    // komentarnya tetap belum selesai - tidak berpura-pura berhasil.
    const latihan = buka({ simpanan: baru(["abt-18"], { modeLatihan: true }) });
    await sampai(() => q(latihan, ".aleta-t6-komentar-kartu"), "komentar");
    q(latihan, ".aleta-t6-komentar-kartu .aleta-t6-tombol").click();
    const kabar = await sampai(
      () => (/LATIHAN/.test(q(latihan, ".aleta-t6-komentar-kaki > :last-child")?.textContent || "") ? q(latihan, ".aleta-t6-komentar-kaki > :last-child") : null),
      "ditahan latihan"
    );
    expect(kabar.textContent).toContain("tidak dikirim");
    expect(latihan.minta.some((m) => m.cara === "PATCH")).toBe(false);
    expect(q(latihan, ".aleta-t6-komentar-judul").textContent).toContain("2 belum selesai");
  });
});

// ============================================================================
describe("penyunting keterangan saksi: beda disorot (abt-7), varian (abt-15), kelompok alasan (abt-8)", () => {
  it("abt-8: alasan dikelompokkan tanpa mengganti kotak centangnya; tanda G dari posita", async () => {
    const h = buka({ simpanan: baru(["abt-8"]) });
    (await sampai(() => tombol(h, "Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
    const form = await sampai(() => q(h, ".aleta-sdg-form"), "blangko SDG");
    const kotak = await sampai(() => form.querySelector(":scope > .aleta-sdg-alasan[data-t6-kelompok]"), "dikelompokkan");
    const judul = Array.from(kotak.querySelectorAll(".aleta-t6-kelompok-judul")).map((x: any) => x.textContent);
    expect(judul).toEqual(["Perselisihan", "Ekonomi", "Perilaku", "Pihak ketiga", "Agama"]);
    expect(kotak.querySelectorAll("input[type=checkbox]")).toHaveLength(16);
    const g = Array.from(kotak.querySelectorAll("label")).filter((l: any) => l.querySelector(".aleta-t6-tanda-g")).map((l: any) => l.textContent.replace("G", "").trim());
    expect(g).toEqual(["perselisihan terus-menerus", "tidak memberi nafkah"]);
  });

  it("abt-7 dan abt-15: kata yang berbeda disorot; jawaban sama persis ditandai; varian mengubah jawabannya lewat peristiwa input", async () => {
    const h = buka({ simpanan: baru(["abt-7", "abt-15"]) });
    const hasil = await susunSaksi(h);
    const baris = hasil.querySelectorAll(".aleta-sdg-kolom")[0].querySelectorAll(".aleta-sdg-baris");
    expect(Array.from(baris[0].querySelectorAll(".aleta-t6-sorot-kata")).map((x: any) => x.textContent)).toEqual(["paman"]);
    expect(baris[2].querySelector(".aleta-t6-lencana-sama").textContent).toBe("sama persis dengan Saksi 2 P");
    expect(baris[2].querySelector(".aleta-t6-varian-ket")).not.toBeNull();
    baris[2].querySelector(".aleta-t6-varian .aleta-t6-tombol").click();
    const opsi = baris[2].querySelector(".aleta-t6-varian-opsi");
    expect(opsi.textContent).toBe('"Semenjak bulan November 2022 kerap cekcok"');
    opsi.click();
    expect(baris[2].querySelector("textarea").value).toBe("Semenjak bulan November 2022 kerap cekcok");
    await sampai(() => !baris[2].querySelector(".aleta-t6-lencana-sama"), "tidak lagi sama");
  });

  it("abt-14 dan abt-20 ditunda dengan jujur: kalimat 'belum tersedia' tanpa satu permintaan pun", async () => {
    const h = buka({ simpanan: baru(["abt-14", "abt-20"]) });
    await susunSaksi(h);
    const catatan = qs(h, ".aleta-t6-belum-tersedia").map((x) => x.textContent);
    expect(catatan.some((x) => x.startsWith("Salin dari perkara serupa yang sudah putus: belum tersedia"))).toBe(true);
    expect(catatan.some((x) => x.startsWith("Kirim ke BAS SIPP: belum tersedia"))).toBe(true);
    expect(mintaT6(h)).toEqual([]);
  });
});

// ============================================================================
describe("alat baca: konsistensi (abt-13), pratinjau (abt-12/24), perkara sebelumnya (abt-19)", () => {
  it("abt-13: tahun nikah posita 2019 vs saksi 2 2018 disebut selisih; nama pihak dan nomor cocok", async () => {
    const h = buka({ simpanan: baru(["abt-13"]) });
    (await sampai(() => tombol(h, "Periksa konsistensi"), "alat")).click();
    const bagian = await sampai(() => q(h, "[data-t6-alat='konsistensi']"), "bagian");
    expect(bagian.textContent).toContain("1 selisih · 4 cocok");
    expect(qs(h, ".aleta-t6-selisih").map((x) => x.textContent)).toEqual([
      expect.stringContaining("Posita (5125) 2019, saksi 2 (2022) menjawab 2018"),
    ]);
  });

  it("abt-12 + abt-24: naskah CETAK dibaca lewat GET preview; kalimat galat disorot; perkiraan panjang per bagian", async () => {
    const h = buka({ simpanan: baru(["abt-12", "abt-24"]) });
    (await sampai(() => tombol(h, "Pratinjau putusan"), "alat")).click();
    const sorot = await sampai(() => q(h, ".aleta-t6-galat-sorot"), "sorot galat");
    expect(sorot.textContent).toBe("TIDAK BENAR QUERY NYA");
    expect(q(h, ".aleta-t6-perkiraan").textContent).toMatch(/^Perkiraan ± 1 halaman/);
    expect(q(h, ".aleta-t6-perkiraan").textContent).toContain("Duduk perkara");
    expect(mintaT6(h)).toEqual([`GET ${CETAK.replace(ASAL, "")}`]);
  });

  it("abt-19: perkara lain pihak yang sama dibaca saat ditekan, beserta dasar pencocokannya", async () => {
    const h = buka({ simpanan: baru(["abt-19"]) });
    await adaT6(h);
    expect(mintaT6(h)).toEqual([]);
    (await sampai(() => tombol(h, "Perkara sebelumnya"), "alat")).click();
    const baris = await sampai(() => q(h, ".aleta-t6-sebelumnya-baris"), "riwayat");
    expect(baris.textContent).toContain("211/Pdt.G/2024/PA.Dgl · Cerai Gugat · dicabut · putus 12-06-2024");
    expect(baris.textContent).toContain("dasar: NIK sama");
    expect(mintaT6(h)).toEqual([`GET /aleta/api/aleta-ecourt/riwayat-pihak?perkaraId=10018&nomorPerkara=${encodeURIComponent(NOMOR)}`]);
  });
});

// ============================================================================
describe("penyimpanan lokal: sematan (abt-22), mode baca (abt-25), draf (abt-29), templat (abt-28), ditolak (abt-6)", () => {
  it("abt-25: mode baca tersimpan dan klik isi blangko tidak membuka penyunting", async () => {
    const h = buka({ simpanan: baru(["abt-25"]) });
    const b = await sampai(() => q(h, ".aleta-t6-tombol-baca"), "tombol baca");
    b.click();
    expect(panelDari(h).getAttribute("data-t6-baca")).toBe("ya");
    await sampai(() => h.simpanan.abtModeBaca === true, "tersimpan");
    const sel = h.w.document.getElementById("0222").parentElement.children[2];
    sel.click();
    await tunggu(30);
    expect(sel.querySelector("textarea")).toBeNull();
    b.click();
    sel.click();
    await sampai(() => sel.querySelector("textarea"), "penyunting kembali");
  });

  it("abt-22: bintang di hasil cari (abt-21) menyematkan variabel ke peramban ini", async () => {
    const h = buka({ simpanan: baru(["abt-21", "abt-22"]) });
    const masuk = await sampai(() => q(h, ".aleta-t6-cari-masuk"), "kotak cari");
    masuk.value = "awal konflik";
    masuk.dispatchEvent(new h.w.Event("input"));
    const bintang = await sampai(() => q(h, ".aleta-t6-cari-hasil .aleta-t6-bintang"), "hasil cari");
    bintang.click();
    await sampai(() => Array.isArray(h.simpanan.abtVariabelSematan), "tersimpan");
    expect(h.simpanan.abtVariabelSematan).toEqual(["0222"]);
    expect(q(h, ".aleta-t6-sematan").textContent).toContain("★ 0222 Awal Konflik");
  });

  it("abt-29 dan abt-28: draf lama ditawarkan dan dipulihkan ke penyunting; templat pertanyaan pribadi tersimpan per jenis", async () => {
    const draf = {
      [NOMOR]: {
        pada: "2026-09-29T02:00:00.000Z",
        kolom: [
          { judul: "Saksi 1 P", baris: [{ tanya: "Apakah saksi kenal?", jawab: "Ya, paman" }] },
          { judul: "Saksi 2 P", baris: [{ tanya: "Apakah saksi kenal?", jawab: "Ya, tetangga" }] },
        ],
      },
    };
    const h = buka({ simpanan: baru(["abt-29", "abt-28"], { abtDrafSaksi: draf }) });
    await sampai(() => q(h, ".aleta-t6-draf-lama"), "draf ditawarkan");
    const hasil = await susunSaksi(h);
    tombol(h, "Pulihkan draf").click();
    const kolom = hasil.querySelectorAll(".aleta-sdg-kolom");
    expect(kolom[0].querySelector("textarea").value).toBe("Ya, paman");
    expect(kolom[1].querySelector("textarea").value).toBe("Ya, tetangga");
    expect(kolom[0].querySelector(".aleta-sdg-tanya").textContent).toBe("Apakah saksi kenal?");
    tombol(h, "☆ Simpan sebagai templat saya").click();
    await sampai(() => h.simpanan.abtTemplatPribadi, "templat tersimpan");
    const templat = (h.simpanan.abtTemplatPribadi as any)["Cerai Gugat"];
    expect(templat[0].tanya).toEqual(["Apakah saksi kenal?", "Kapan Penggugat dan Tergugat menikah?", "Sejak kapan tidak rukun?"]);
  });

  it("abt-6: tombol cepat pada alasan yang belum terbukti - mencentang alasan di penyunting, dan tanda ditolak hanya di peramban", async () => {
    const h = buka({ simpanan: baru(["abt-6"], nyata) });
    await panelLahir(h);
    await inputKeAbt(h);
    const butir = await sampai(() => q(h, ".aleta-alasan-belum .aleta-t6-alasan-alat"), "tombol cepat");
    // "tandai ditolak" menulis tanda lokal, tidak ada permintaan jaringan.
    const sebelum = h.minta.length;
    butir.querySelectorAll("button")[1].click();
    await sampai(() => h.simpanan.abtAlasanDitolak, "tanda ditolak");
    expect(h.simpanan.abtAlasanDitolak).toEqual({ "10018": ["tidak memberi nafkah"] });
    expect(h.minta.length).toBe(sebelum);
    expect(q(h, ".aleta-alasan-belum .aleta-t6-ditolak")).not.toBeNull();
    butir.querySelectorAll("button")[0].click();
    const form = await sampai(() => q(h, ".aleta-sdg-form"), "penyunting terbuka");
    const alasan = await sampai(
      () => Array.from(form.querySelectorAll(":scope > .aleta-sdg-alasan input[type=checkbox]")).find((c: any) => c.value === "tidak memberi nafkah" && c.checked),
      "alasan tercentang"
    );
    expect(alasan).toBeTruthy();
    expect(form.querySelector(":scope > .aleta-sdg-alasan").hidden).toBe(false);
    expect(q(h, ".aleta-abt-kabar").textContent).toContain("Kartu alasan tertutup saat penyunting dibuka");
  });
});

// ============================================================================
describe("abt-23 dan abt-9: urungkan, ulangi, dan pulihkan menulis lewat jalur simpan ABT yang sama - dan tunduk mode coba", () => {
  async function suntingTangan(h: Halaman, kode: string, nilai: string) {
    const sel = h.w.document.getElementById(kode).parentElement.children[2];
    sel.click();
    const ketik = await sampai(() => sel.querySelector("textarea"), "penyunting");
    ketik.value = nilai;
    sel.querySelector(".aleta-abt-simpan").click();
    await sampai(() => !sel.querySelector("textarea"), "tersimpan");
    return sel;
  }

  it("Ctrl+Z mengembalikan isi sebelumnya ke ABT; Ctrl+Y mengulanginya", async () => {
    const h = buka({ simpanan: baru(["abt-23"], nyata) });
    const urung = await sampai(() => q(h, ".aleta-t6-kepala-tombol:not(.aleta-t6-tombol-baca)"), "tombol urungkan");
    expect(urung.disabled).toBe(true);
    const sel = await suntingTangan(h, "0222", "sejak November 2022");
    await sampai(() => !urung.disabled, "tumpukan terisi");
    h.w.document.body.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    await sampai(() => sel.textContent === "DATA_TIDAK_ADA", "diurungkan");
    const tulis = h.minta.filter((m) => m.cara === "POST" && m.url.includes("/edit_data?no_var=0222"));
    expect(tulis.map((m) => new URLSearchParams(m.badan).get("value"))).toEqual(["sejak November 2022", ""]);
    h.w.document.body.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true, cancelable: true }));
    await sampai(() => sel.textContent === "sejak November 2022", "diulang");
  });

  it("dalam mode coba urungkan ditahan dan kalimatnya jujur - tidak ada tulisan ABT yang lolos", async () => {
    const h = buka({ simpanan: baru(["abt-23", "abt-1"]) });
    await sampai(() => q(h, ".aleta-t6-kepala-tombol"), "tombol");
    // Sunting tangan pun ditahan mode coba (ini perilaku panel-alat.js), jadi
    // tumpukan diisi lewat riwayat yang sama dengan yang ditulis sunting.
    await h.setel({ abtRiwayat: [{ perkaraId: "10018", kode: "0222", nama: "Awal Konflik", sebelum: "DATA_TIDAK_ADA", sesudah: "x", cara: "sunting tangan", pada: "2026-09-29T02:00:00.000Z" }] });
    const urung = q(h, ".aleta-t6-kepala-tombol:not(.aleta-t6-tombol-baca)");
    await sampai(() => !urung.disabled, "tumpukan terisi");
    urung.click();
    await sampai(() => /Ditahan mode coba/.test(q(h, ".aleta-abt-kabar")?.textContent || ""), "ditahan");
    expect(h.minta.filter((m) => m.cara === "POST" && m.url.includes("/edit_data"))).toEqual([]);
  });

  it("abt-9: riwayat per variabel di kartu usulan dengan tombol pulihkan", async () => {
    const h = buka({
      simpanan: baru(["abt-9"], {
        ...nyata,
        abtRiwayat: [
          { perkaraId: "10018", kode: "0222", nama: "Awal Konflik", sebelum: "DATA_TIDAK_ADA", sesudah: "tahun 2022", cara: "diisi dari SIPP", pada: "2026-09-29T02:12:00.000Z" },
        ],
      }),
    });
    await panelLahir(h);
    await isiDariSipp(h);
    const kartu = qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === "0222");
    kartu.querySelector(".aleta-t6-riwayat-tombol").click();
    const pulih = await sampai(() => Array.from(kartu.querySelectorAll(".aleta-t6-riwayat-baris button")).find((b: any) => b.textContent === "pulihkan") as any, "tombol pulihkan");
    pulih.click();
    await sampai(() => h.minta.some((m) => m.cara === "POST" && m.url.includes("/edit_data?no_var=0222")), "ditulis");
    const tulis = h.minta.filter((m) => m.cara === "POST" && m.url.includes("/edit_data?no_var=0222"));
    expect(new URLSearchParams(tulis[0].badan).get("value")).toBe("tahun 2022");
  });
});

// ============================================================================
describe("jaringan: tidak ada non-GET baru selain fitur, dan semuanya tunduk mode coba", () => {
  it("seluruh saklar menyala, panel lahir dan tiga langkah kerja: tulisan non-GET sama dengan Lama", async () => {
    const lama = buka({ simpanan: {} });
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata) });
    await Promise.all([panelLahir(lama), panelUi(h)]);
    for (const x of [lama, h]) {
      await isiDariSipp(x);
      await inputKeAbt(x);
    }
    await tunggu(80);
    expect(bukanGet(h).sort()).toEqual(bukanGet(lama).sort());
  });

  it("pengamat hiasan tidak berputar: sesudah tenang, DOM panel tidak berubah lagi", async () => {
    const h = buka({ simpanan: ui(SEMUA_ABT, nyata) });
    await panelUi(h);
    await inputKeAbt(h);
    await susunSaksi(h);
    await tunggu(400);
    const a = potret(h);
    await tunggu(400);
    expect(potret(h)).toBe(a);
  });
});

describe("kunci bagian komentar hakim - sama dengan portal (letakSaksiAbt)", () => {
  it("huruf pihak dipakai; tanpa huruf hanya ke-1 dan ke-2 = Penggugat, ke-3 dst. tidak ditebak", () => {
    const sumber = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../../../ekstensi-sipp/abt.js"), "utf8");
    const awal = sumber.indexOf("function t6BacaBagian(");
    const fungsi = sumber.slice(awal, sumber.indexOf("\n}\n", awal) + 3);
    const baca = new Function(`${fungsi}; return t6BacaBagian;`)();
    expect(baca("saksi-t1:2")).toEqual({ jenis: "saksi", pihak: "T", ke: 1, no: 2 });
    expect(baca("saksi-p2:5")).toEqual({ jenis: "saksi", pihak: "P", ke: 2, no: 5 });
    expect(baca("saksi-1:3")).toEqual({ jenis: "saksi", pihak: "P", ke: 1, no: 3 });
    expect(baca("saksi-3:1").pihak).toBeNull();
  });
});
