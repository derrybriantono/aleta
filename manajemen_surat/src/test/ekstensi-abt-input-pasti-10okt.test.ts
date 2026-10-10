// @vitest-environment node
/**
 * ============================================================================
 * 10 OKT 2026 - S5=H1 + H3: FAKTA SAKSI KE KARTU HAKIM, "INPUT SEMUA YANG PASTI"
 * ============================================================================
 *
 * panel-alat.js + abt.js dijalankan sungguhan di jsdom (pola uji 8503 7 Okt).
 * Yang dijaga:
 *   1. kartu 0222/0246/9944/5227 bertanda kesepakatan saksi DAN tingkat yakin;
 *      tingkat "ragu" TIDAK dicentang sendiri
 *   2. "Input semua yang pasti (n)" menghitung hanya usulan pasti (tingkat
 *      pasti, atau SIPP berkeyakinan pasti) - ragu/cukup tidak ikut
 *   3. tekanan pertama hanya pratinjau lama -> baru; NOL tulisan ke ABT
 *   4. "Ya, simpan" menulis lewat edit_data (petik ' menjadi ’), hanya yang
 *      pasti dan dicentang di pratinjau
 *   5. halaman dibaca ulang; tanda hijau per variabel yang SUNGGUH terbaca,
 *      merah bila ABT tidak memuatnya
 *   6. Batal = tidak ada tulisan
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ABT = baca("abt.js");

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

const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5125": "Bahwa sejak bulan Maret 2024 sering terjadi perselisihan; sejak bulan Mei 2025 Tergugat pergi meninggalkan Penggugat;",
  "0033": "07 Oktober 2026",
  "2021": "Saksi kenal dengan kedua pihak.",
  "2022": "Penggugat dan Tergugat menikah tahun 2018.",
  "0222": "DATA_TIDAK_ADA",
  "5227": "DATA_TIDAK_ADA",
  "0246": "DATA_TIDAK_ADA",
  "9944": "DATA_TIDAK_ADA",
  "0156": "DATA_TIDAK_ADA",
  "8503": "F",
};
const NAMA: Record<string, string> = {
  "0001": "No Perkara",
  "0048": "Jenis Perkara",
  "5125": "POSITA LENGKAP",
  "0222": "Awal Konflik",
  "5227": "Alasan-Alasan Cerai",
  "0246": "Pisah Rumah",
  "9944": "Lama Pisah",
  "0156": "Nama Kantor Kuasa",
  "8503": "HURUF ALASAN PERCERAIAN (A-H GABUNGAN BEBAS)",
};

const S = (kalimat: string, saksi: number) => ({ saksi, kalimat });
const USULAN_SAKSI = [
  {
    kode: "0222",
    nama: "Awal Konflik",
    nilai: "bulan Maret 2024",
    keyakinan: "ragu",
    bentrok: "",
    catatan: "Kedua saksi tidak menyebut kapan perselisihan mulai; diambil dari posita - dalil yang belum dikuatkan saksi.",
    sumber: [{ saksi: 0, asal: "posita", kalimat: "Bahwa sejak bulan Maret 2024 sering terjadi perselisihan" }],
    kesepakatan: "posita",
    tingkat: "ragu",
    dasarTingkat: "posita, bulan, posita-sama",
  },
  {
    kode: "0246",
    nama: "Pisah Rumah",
    nilai: "bulan Mei 2025",
    keyakinan: "pasti",
    bentrok: "",
    catatan: "",
    sumber: [S("Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2025", 1), S("Bahwa keduanya pisah sejak Mei 2025", 2)],
    kesepakatan: "sama",
    tingkat: "pasti",
    dasarTingkat: "sama, bulan, posita-sama",
  },
  {
    kode: "9944",
    nama: "Lama Pisah",
    nilai: "1 tahun 4 bulan",
    keyakinan: "pasti",
    bentrok: "",
    catatan: "",
    sumber: [S("sampai sekarang sudah 1 tahun 4 bulan", 1), S("sudah 1 tahun 4 bulan", 2)],
    kesepakatan: "sama",
    tingkat: "cukup",
    dasarTingkat: "sama, hitung-dekat, posita-sama",
  },
  {
    kode: "5227",
    nama: "Alasan-Alasan Cerai",
    nilai: "Tergugat melalaikan kewajiban nafkah lahir yang memicu perselisihan terus-menerus dengan Penggugat",
    keyakinan: "pasti",
    bentrok: "",
    catatan: "",
    sumber: [S("Tergugat tidak memberi nafkah", 1), S("Tergugat tidak menafkahi", 2)],
    kesepakatan: "sama",
    tingkat: "cukup",
    dasarTingkat: "sama",
  },
];
const SAKSI = {
  butir: { saksi1: 2, saksi2: 2 },
  selisih: [],
  ciri: ["perselisihan terus-menerus"],
  ciriSepihak: [],
  ciriDiluarGugatan: [],
  ciriBelumTerbukti: [],
  gugatanTerbaca: true,
  huruf: [],
  hurufTidakDiusulkan: [],
  hurufBelumSiap: [],
  usulan: USULAN_SAKSI,
};
const SIPP = {
  ok: true,
  jumlahKuasa: 1,
  prodeo: false,
  usulan: [{ kode: "0156", nama: "Nama Kantor Kuasa", nilai: "Kantor Hukum Ma'ruf & Rekan", keyakinan: "pasti", sumber: [{ keterangan: "SIPP" }] }],
};

type Minta = { url: string; cara: string; badan: string };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };

function tabel(isi: Record<string, string>) {
  return Object.keys(isi)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>${NAMA[k] || `Variabel ${k}`}</td>` +
        `<td>${isi[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
}
function halamanHtml(isi: Record<string, string>) {
  return (
    `<div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3>` +
    `<h2>CG (Lite) Verstek F V.2</h2>` +
    `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${tabel(isi)}</table></div></div>`
  );
}
function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) return new Response(Buffer.from(j.mentah, "utf8"), { status, headers: { "content-type": j.jenis || "text/plain" } });
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

type Halaman = { dom: JSDOM; w: any; minta: Minta[]; tersimpan: Record<string, string> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

/** abaikan: kode yang POST-nya dijawab DISIMPAN tetapi tidak muncul di halaman yang dibaca ulang. */
function buka(opsi: { abaikan?: string[] } = {}): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${halamanHtml(ISI)}</body></html>`, {
    url: ALAMAT,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiFitur: {}, ujiIzinkanNyata: true };
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.190.0" }),
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
  const minta: Minta[] = [];
  const tersimpan: Record<string, string> = {};
  const jawab = (url: string, cara: string, badan: string): Jawab => {
    if (url.includes("/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(badan || "{}");
      if (muatan.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama: "Uji Hakim", peran: "Hakim" }, kapabilitas: {} } } };
      if (muatan.sumber === "sipp") return { isi: { data: { available: true, sipp: SIPP } } };
      if (muatan.sumber === "saksi") return { isi: { data: { available: true, saksi: SAKSI } } };
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
      if (cara === "POST") {
        const kode = new URL(url).searchParams.get("no_var") || "";
        const nilai = new URLSearchParams(badan).get("value") || "";
        if (!(opsi.abaikan || []).includes(kode)) tersimpan[kode] = nilai;
        return { mentah: "<b>DATA DISIMPAN</b>", jenis: "text/html" };
      }
      return { mentah: '<input type="hidden" name="var_type" value="data_teks">', jenis: "text/html" };
    }
    if (url.includes("/tanyajawab_perkara_edit?")) return { mentah: "<script>\n var ajax_data = [] \n</script>", jenis: "text/html" };
    // Halaman blangko yang dibaca ulang: ABT menyusunnya dari isi yang tersimpan.
    if (url === ALAMAT && cara === "GET") return { mentah: `<html><body>${halamanHtml({ ...ISI, ...tersimpan })}</body></html>`, jenis: "text/html" };
    if (url.includes("/aps_badilag/") && cara === "GET") return { mentah: "<html><body></body></html>", jenis: "text/html" };
    return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
  };
  w.fetch = async (alamat: string, o?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(o?.method || "GET").toUpperCase();
    const b = typeof o?.body === "string" ? o.body : o?.body ? String(o.body) : "";
    minta.push({ url, cara, badan: b });
    return tanggapan(jawab(url, cara, b));
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
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return { dom, w, minta, tersimpan };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-abt") as any;
const q = (h: Halaman, pemilih: string) => panelDari(h)?.querySelector(pemilih) as any;
const qs = (h: Halaman, pemilih: string) => Array.from(panelDari(h)?.querySelectorAll(pemilih) || []) as any[];
const kartu = (h: Halaman, kode: string) => qs(h, ".aleta-abt-kartu").find((k) => k.querySelector(".aleta-abt-kode")?.textContent === kode);
const tulisAbt = (h: Halaman) => h.minta.filter((m) => m.cara !== "GET" && m.url.includes("/aps_badilag/"));
const tombolPasti = (h: Halaman) => q(h, ".aleta-sore-input-pasti");
const siap = (h: Halaman) => sampai(() => (tombolPasti(h) && kartu(h, "0246") && kartu(h, "0156") ? tombolPasti(h) : null), "panel dan kartu siap");

describe("S5=H1: tanda kesepakatan saksi + tingkat yakin pada kartu hakim", () => {
  it("0246 kedua saksi sama + yakin pasti tercentang; 0222 dari posita yakin ragu TIDAK tercentang; kutipan sumber tampil", async () => {
    const h = buka();
    await siap(h);
    const k0246 = kartu(h, "0246");
    expect(k0246.textContent).toContain("kedua saksi sama");
    expect(k0246.querySelector(".aleta-s5-yakin").dataset.tingkat).toBe("pasti");
    expect(k0246.querySelector(".aleta-abt-centang").checked).toBe(true);
    expect(Array.from(k0246.querySelectorAll(".aleta-abt-kutipan")).map((x: any) => x.textContent).join(" ")).toContain("pisah tempat tinggal sejak bulan Mei 2025");

    const k0222 = kartu(h, "0222");
    expect(k0222.textContent).toContain("dari posita — belum dikuatkan saksi");
    expect(k0222.querySelector(".aleta-s5-yakin").textContent).toBe("yakin: ragu — periksa");
    expect(k0222.querySelector(".aleta-abt-centang").checked).toBe(false);
    expect(k0222.querySelector(".aleta-abt-kutipan .aleta-abt-asal").textContent).toBe("Posita");

    // Cukup: tetap dicentang seperti dahulu, tetapi bukan "pasti".
    const k9944 = kartu(h, "9944");
    expect(k9944.querySelector(".aleta-s5-yakin").dataset.tingkat).toBe("cukup");
    expect(k9944.querySelector(".aleta-abt-centang").checked).toBe(true);
  });
});

describe("H3: Input semua yang pasti - pratinjau, tulis, baca ulang", () => {
  it("hanya yang pasti dihitung (0246 tingkat pasti + 0156 SIPP pasti); klik pertama = pratinjau, NOL tulisan ke ABT", async () => {
    const h = buka();
    const t = await siap(h);
    expect(t.hidden).toBe(false);
    expect(t.textContent).toBe("Input semua yang pasti (2)");
    expect(tulisAbt(h)).toEqual([]);
    t.click();
    const tabel = await sampai(() => q(h, ".aleta-s5-tabel"), "pratinjau");
    const baris = Array.from(tabel.querySelectorAll("tr[data-kode]")) as any[];
    expect(baris.map((b) => b.dataset.kode).sort()).toEqual(["0156", "0246"]);
    const b0156 = baris.find((b) => b.dataset.kode === "0156");
    expect(b0156.querySelector(".aleta-s5-lama").textContent).toBe("(belum diisi)");
    // "Baru" ditampilkan sebagaimana akan tersimpan: petik menjadi ’.
    expect(b0156.querySelector(".aleta-s5-baru").textContent).toBe("Kantor Hukum Ma’ruf & Rekan");
    expect(q(h, ".aleta-s5-simpan").textContent).toBe("Ya, simpan 2 ke ABT");
    await tunggu(50);
    expect(tulisAbt(h)).toEqual([]);
  });

  it("Ya, simpan: edit_data hanya 0246 dan 0156 (petik ’), lalu halaman dibaca ulang dan keduanya bertanda hijau", async () => {
    const h = buka();
    (await siap(h)).click();
    (await sampai(() => q(h, ".aleta-s5-simpan"), "tombol simpan")).click();
    await sampai(() => /terbukti tersimpan/.test(q(h, ".aleta-s5-kabar")?.textContent || ""), "kabar sesudah baca ulang");
    const tulis = tulisAbt(h).filter((m) => m.url.includes("/edit_data?"));
    const kode = tulis.map((m) => new URL(m.url).searchParams.get("no_var")).sort();
    expect(kode).toEqual(["0156", "0246"]);
    const v0156 = new URLSearchParams(tulis.find((m) => m.url.includes("no_var=0156"))!.badan).get("value");
    expect(v0156).toBe("Kantor Hukum Ma’ruf & Rekan");
    expect(v0156).not.toContain("'");
    // Ragu (0222) dan cukup (9944, 5227) tidak tertulis.
    for (const k of ["0222", "9944", "5227"]) expect(h.tersimpan[k]).toBeUndefined();
    // Dibaca ulang (GET halaman blangko) SESUDAH tulisan.
    const iTulisAkhir = h.minta.lastIndexOf(tulis[tulis.length - 1]);
    expect(h.minta.slice(iTulisAkhir + 1).some((m) => m.cara === "GET" && m.url === ALAMAT)).toBe(true);
    const hijau = qs(h, ".aleta-s5-tabel tr.aleta-s5-hijau").map((b) => b.dataset.kode).sort();
    expect(hijau).toEqual(["0156", "0246"]);
    expect(q(h, ".aleta-s5-tabel tr[data-kode='0246'] .aleta-s5-hasil").textContent).toBe("✓ tersimpan");
    expect(q(h, ".aleta-s5-kabar").textContent).toContain("2 variabel terbukti tersimpan");
    // Sel blangko di halaman ikut diganti dengan isi ABT.
    expect(h.w.document.getElementById("0246").parentElement.children[2].textContent).toContain("bulan Mei 2025");
    // Yang sudah tersimpan tidak dihitung lagi.
    await sampai(() => tombolPasti(h).hidden, "tombol pasti tersembunyi sesudah semua tersimpan");
  });

  it("ABT menjawab DISIMPAN tetapi isi tidak terbaca saat dibaca ulang: baris itu merah, bukan hijau", async () => {
    const h = buka({ abaikan: ["0156"] });
    (await siap(h)).click();
    (await sampai(() => q(h, ".aleta-s5-simpan"), "tombol simpan")).click();
    await sampai(() => /perlu diperiksa/.test(q(h, ".aleta-s5-kabar")?.textContent || ""), "kabar merah");
    expect(q(h, ".aleta-s5-tabel tr[data-kode='0156']").classList.contains("aleta-s5-merah")).toBe(true);
    expect(q(h, ".aleta-s5-tabel tr[data-kode='0156'] .aleta-s5-hasil").textContent).toContain("belum terbaca di ABT");
    expect(q(h, ".aleta-s5-tabel tr[data-kode='0246']").classList.contains("aleta-s5-hijau")).toBe(true);
  });

  it("baris yang dibatalkan centangnya di pratinjau tidak ditulis; Batal tidak menulis apa pun", async () => {
    const h = buka();
    (await siap(h)).click();
    await sampai(() => q(h, ".aleta-s5-tabel"), "pratinjau");
    q(h, ".aleta-s5-batal").click();
    expect(q(h, ".aleta-s5-tabel")).toBeNull();
    await tunggu(50);
    expect(tulisAbt(h)).toEqual([]);

    tombolPasti(h).click();
    const c = await sampai(() => q(h, ".aleta-s5-tabel tr[data-kode='0156'] .aleta-s5-centang"), "centang 0156");
    c.checked = false;
    c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(q(h, ".aleta-s5-simpan").textContent).toBe("Ya, simpan 1 ke ABT");
    q(h, ".aleta-s5-simpan").click();
    await sampai(() => /terbukti tersimpan/.test(q(h, ".aleta-s5-kabar")?.textContent || ""), "kabar");
    const kode = tulisAbt(h)
      .filter((m) => m.url.includes("/edit_data?"))
      .map((m) => new URL(m.url).searchParams.get("no_var"));
    expect(kode).toEqual(["0246"]);
  });
});
