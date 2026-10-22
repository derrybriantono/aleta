/**
 * ============================================================================
 * 22 OKT 2026 (W50) - B. ALAMAT <-> DROPDOWN WILAYAH di blangko data pihak/kuasa SIPP
 * ============================================================================
 *
 * pihak-lengkap.js dijalankan di atas tiruan "Tambah Referensi Data Pihak"
 * (form#frm_ref_pihak: #pihak_alamat + #prop #kab #kec #kel) lewat jembatan.js
 * sungguhan dan data wilayah SIPP tiruan yang dijawab ASINKRON (tertunda), meniru
 * select2 SIPP yang memuat opsinya lewat AJAX.
 *
 *   1. alamat lengkap, dropdown kosong      -> dropdown terisi bertingkat
 *   2. dropdown lengkap, alamat hanya jalan -> tambahan di kanan, kecil ke besar
 *   3. hanya provinsi yang belum tertulis   -> ", Provinsi Sulawesi Tengah"
 *   4. nama tak dikenal / ganda             -> tidak menebak
 *   5. dropdown yang sudah terisi           -> tidak ditimpa
 *   6. tidak loop; tidak menimpa ketikan yang sedang berlangsung; tanpa "Aleta"
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_JEMBATAN = baca("jembatan.js");
const SUMBER_PENJAGA = baca("penjaga-tanda.js");
const SUMBER_PL = baca("pihak-lengkap.js");

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(20);
  }
}

const ASAL = "http://192.168.10.10";

type W = { kode: string; nama: string; nilaiSipp: string };
const WILAYAH: Record<string, W[]> = {
  "": [
    { kode: "72", nama: "SULAWESI TENGAH", nilaiSipp: "S72" },
    { kode: "73", nama: "SULAWESI SELATAN", nilaiSipp: "S73" },
  ],
  "72": [
    { kode: "72.03", nama: "KAB. DONGGALA", nilaiSipp: "S7203" },
    { kode: "72.10", nama: "KAB. SIGI", nilaiSipp: "S7210" },
    { kode: "72.71", nama: "KOTA PALU", nilaiSipp: "S7271" },
  ],
  "73": [
    { kode: "73.71", nama: "KOTA MAKASSAR", nilaiSipp: "S7371" },
    { kode: "73.10", nama: "KAB. SIGI", nilaiSipp: "S7310X" }, // kembar antar provinsi (rekaan uji)
  ],
  "72.03": [
    { kode: "72.03.09", nama: "LABUAN", nilaiSipp: "S720309" },
    { kode: "72.03.11", nama: "SINDUE", nilaiSipp: "S720311" },
    { kode: "72.03.12", nama: "SINDUE TOBATA", nilaiSipp: "S720312" },
  ],
  "72.10": [{ kode: "72.10.01", nama: "DOLO", nilaiSipp: "S721001" }],
  "72.71": [
    { kode: "72.71.01", nama: "PALU BARAT", nilaiSipp: "S727101" },
    { kode: "72.71.02", nama: "PALU TIMUR", nilaiSipp: "S727102" },
  ],
  "72.03.11": [
    { kode: "72.03.11.2001", nama: "DALAKA", nilaiSipp: "D2001" },
    { kode: "72.03.11.1001", nama: "SINDUE", nilaiSipp: "D1001" },
  ],
  "72.03.09": [{ kode: "72.03.09.2001", nama: "LABUAN SALUMBONE", nilaiSipp: "D3001" }],
  "72.71.01": [{ kode: "72.71.01.1001", nama: "BALAROA", nilaiSipp: "D4001" }],
};

const HALAMAN = `
<div id="popup_pihak" class="popup" style="display:block">
  <form id="frm_ref_pihak" method="post" action="${ASAL}/SIPP/pihak_list/validateInput">
    <table><tbody>
      <tr><td><input id="pihak_fullname" name="pihak_fullname" value=""></td></tr>
      <tr><td><textarea id="pihak_alamat" name="pihak_alamat"></textarea></td></tr>
      <tr class="wni"><td><select name="prop" id="prop"><option value="">- Cari/Pilih Propinsi -</option></select></td></tr>
      <tr class="wni"><td><select name="kab" id="kab"><option value="">- Cari/Pilih Kabupaten/Kota -</option></select></td></tr>
      <tr class="wni"><td><select name="kec" id="kec"><option value="">- Cari/Pilih Kecamatan -</option></select></td></tr>
      <tr class="wni"><td><select name="kel" id="kel"><option value="">- Cari/Pilih Kelurahan/Desa -</option></select></td></tr>
      <tr><td><input type="submit" id="simpan_btn" value="Simpan"></td></tr>
    </tbody></table>
  </form>
</div>`;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaSipp(opsi?: { halaman?: string }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${opsi?.halaman ?? HALAMAN}</body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = { runtime: { id: "aleta-uji", getURL: (x: string) => x, lastError: undefined } };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/aleta-ecourt/wilayah")) {
      const induk = new URL(url, ASAL).searchParams.get("induk") || "";
      await tunggu(15); // dijawab tertunda seperti AJAX
      return Response.json({ ok: true, data: { ok: true, sandi: { ok: true }, data: WILAYAH[induk] || [] } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.postMessage = (data: unknown) => setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  let simpanDitekan = 0;
  w.document.getElementById("simpan_btn").addEventListener("click", () => (simpanDitekan += 1));
  w.document.getElementById("frm_ref_pihak").addEventListener("submit", (e: Event) => e.preventDefault());
  w.ALETA_PL_JEDA = { detak: 60, ketik: 150 };
  w.eval(SUMBER_PENJAGA);
  w.eval(SUMBER_JEMBATAN);
  w.eval(SUMBER_PL);
  const doc = w.document as Document;
  return { w, doc, minta, simpan: () => simpanDitekan };
}
type Halaman = ReturnType<typeof bukaSipp>;

const alamat = (h: Halaman) => h.doc.getElementById("pihak_alamat") as HTMLTextAreaElement;
const sel = (h: Halaman, id: string) => h.doc.getElementById(id) as HTMLSelectElement;
const teksPilihan = (h: Halaman, id: string) => {
  const s = sel(h, id);
  return s.value ? String(s.options[s.selectedIndex].textContent) : "";
};
/** Meniru SIPP/select2: petugas memilih satu wilayah (opsi dimuat lalu dipilih). */
function pilihSepertiSipp(h: Halaman, id: string, nilai: string, teks: string) {
  const s = sel(h, id);
  for (const o of Array.from(s.options)) if (o.value) o.remove();
  const o = h.doc.createElement("option");
  o.value = nilai;
  o.textContent = teks;
  s.appendChild(o);
  s.value = nilai;
  s.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}
function ketik(h: Halaman, teks: string) {
  const a = alamat(h);
  a.focus();
  a.value = teks;
  a.dispatchEvent(new h.w.Event("input", { bubbles: true }));
}
function lepasFokus(h: Halaman) {
  alamat(h).blur();
}

/* ─────────────────────────── bagian murni ─────────────────────────── */

const PL = () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  const w = dom.window as any;
  w.ALETA_PIHAK_LENGKAP_MANUAL = true;
  w.eval(SUMBER_PL);
  return { w, pl: w.AletaPihakLengkap, tutup: () => w.close() };
};
const BAGIAN_PENUH = {
  provinsi: { nama: "SULAWESI TENGAH" },
  kabupaten: { nama: "KAB. DONGGALA" },
  kecamatan: { nama: "SINDUE" },
  kelurahan: { nama: "DALAKA", sebutan: "Desa" },
};

describe("B2. dropdown -> alamat: bentuk tambahan", () => {
  it("hanya provinsi yang belum tertulis: koma menempel di akhir, satu spasi, lalu nama", () => {
    const { pl, tutup } = PL();
    expect(pl.tambahanAlamat("Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala", BAGIAN_PENUH)).toBe(
      "Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
    tutup();
  });

  it("beberapa bagian kurang: tiap bagian diawali ', ', urut kecil ke besar; kiri alamat tak berubah", () => {
    const { pl, tutup } = PL();
    const hasil = pl.tambahanAlamat("Jalan Trans Sulawesi No. 5", BAGIAN_PENUH);
    expect(hasil).toBe("Jalan Trans Sulawesi No. 5, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(hasil.startsWith("Jalan Trans Sulawesi No. 5")).toBe(true);
    tutup();
  });

  it("spasi dan koma di ujung teks lama dibuang dulu: tanpa '  ,' dan tanpa ',,'", () => {
    const { pl, tutup } = PL();
    for (const lama of ["Jalan X  ", "Jalan X,", "Jalan X, ", "Jalan X ,  "]) {
      const hasil = pl.tambahanAlamat(lama, { provinsi: { nama: "SULAWESI TENGAH" } });
      expect(hasil).toBe("Jalan X, Provinsi Sulawesi Tengah");
      expect(hasil).not.toMatch(/\s,|,,|\s{2}/);
    }
    tutup();
  });

  it("yang sudah tertulis (tak peka huruf besar, dengan/tanpa awalan) tidak ditambah; teks dikembalikan persis", () => {
    const { pl, tutup } = PL();
    const lengkap = "jl. mawar, DESA DALAKA, kec sindue, Kab. Donggala, propinsi sulawesi tengah ";
    expect(pl.tambahanAlamat(lengkap, BAGIAN_PENUH)).toBe(lengkap);
    expect(pl.tambahanAlamat("Jalan A Dalaka Sindue Donggala Sulawesi Tengah", BAGIAN_PENUH)).toBe("Jalan A Dalaka Sindue Donggala Sulawesi Tengah");
    tutup();
  });

  it("dipilih bertahap dari provinsi (seperti SIPP): urutan akhir tetap kecil ke besar", () => {
    const { pl, tutup } = PL();
    let a = pl.tambahanAlamat("Jalan X", { provinsi: { nama: "SULAWESI TENGAH" } });
    expect(a).toBe("Jalan X, Provinsi Sulawesi Tengah");
    a = pl.tambahanAlamat(a, { provinsi: { nama: "SULAWESI TENGAH" }, kabupaten: { nama: "KAB. DONGGALA" } });
    expect(a).toBe("Jalan X, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    a = pl.tambahanAlamat(a, { ...BAGIAN_PENUH, kelurahan: { nama: "DALAKA", sebutan: "Desa" } });
    expect(a).toBe("Jalan X, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    // sudah lengkap -> tidak berubah lagi
    expect(pl.tambahanAlamat(a, BAGIAN_PENUH)).toBe(a);
    tutup();
  });

  it("nama yang termuat di nama lain tidak dianggap sudah tertulis (Kota Palu vs Kecamatan Palu Barat)", () => {
    const { pl, tutup } = PL();
    const hasil = pl.tambahanAlamat("Jalan A, Kecamatan Palu Barat", {
      kecamatan: { nama: "PALU BARAT" },
      kabupaten: { nama: "KOTA PALU" },
      provinsi: { nama: "SULAWESI TENGAH" },
    });
    expect(hasil).toBe("Jalan A, Kecamatan Palu Barat, Kota Palu, Provinsi Sulawesi Tengah");
    tutup();
  });

  it("Desa atau Kelurahan mengikuti data wilayah SIPP (kode), bukan tebakan; tanpa data = nama saja", () => {
    const { pl, tutup } = PL();
    expect(pl.sebutanDesa("72.71.01.1001")).toBe("Kelurahan");
    expect(pl.sebutanDesa("72.03.11.2001")).toBe("Desa");
    expect(pl.sebutanDesa("72.03.11")).toBe("");
    expect(pl.tambahanAlamat("Jalan A", { kelurahan: { nama: "BALAROA", sebutan: "Kelurahan" } })).toBe("Jalan A, Kelurahan Balaroa");
    expect(pl.tambahanAlamat("Jalan A", { kelurahan: { nama: "BALAROA", sebutan: "" } })).toBe("Jalan A, Balaroa");
    tutup();
  });

  it("alamat kosong: tanpa koma di depan; tanpa kata Aleta", () => {
    const { pl, tutup } = PL();
    const hasil = pl.tambahanAlamat("", BAGIAN_PENUH);
    expect(hasil).toBe("Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(hasil).not.toMatch(/aleta/i);
    expect(pl.tambahanAlamat("Jalan X", {})).toBe("Jalan X");
    tutup();
  });
});

describe("B1. alamat -> dropdown: rencana (murni)", () => {
  const ambil = (hitung?: { n: number }) => async ({ induk }: { induk: string }) => {
    if (hitung) hitung.n += 1;
    return { ok: true, data: WILAYAH[induk || ""] || [] };
  };
  const kosong = [
    { terisi: false, nama: "" },
    { terisi: false, nama: "" },
    { terisi: false, nama: "" },
    { terisi: false, nama: "" },
  ];

  it("alamat lengkap dengan provinsi: keempat tingkat dikenali, bertingkat", async () => {
    const { pl, tutup } = PL();
    const r = await pl.rencanaDropdown(
      "Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala Provinsi Sulawesi Tengah",
      kosong,
      ambil()
    );
    expect(r.map((x: any) => [x.indeks, x.wilayah.nilaiSipp])).toEqual([[0, "S72"], [1, "S7203"], [2, "S720311"], [3, "D2001"]]);
    tutup();
  });

  it("provinsi tak tertulis tetapi 'Kabupaten Donggala' tertulis: provinsi disimpulkan hanya bila satu-satunya", async () => {
    const { pl, tutup } = PL();
    const r = await pl.rencanaDropdown("Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala", kosong, ambil());
    expect(r.map((x: any) => x.wilayah.nilaiSipp)).toEqual(["S72", "S7203", "S720311", "D2001"]);
    // Kabupaten kembar di dua provinsi: tidak menebak.
    const kembar = await pl.rencanaDropdown("Jalan X Kecamatan Dolo Kabupaten Sigi", kosong, ambil());
    expect(kembar).toEqual([]);
    tutup();
  });

  it("nama tak dikenal: tidak menebak; nama pendek tanpa kata tingkat tidak dianggap", async () => {
    const { pl, tutup } = PL();
    expect(await pl.rencanaDropdown("Jalan Mawar Desa Xyzzy Kecamatan Qwerty", kosong, ambil())).toEqual([]);
    expect(await pl.rencanaDropdown("Jalan Palu Raya", kosong, ambil())).toEqual([]);
    tutup();
  });

  it("Desa Labuan Salumbone: nama terpanjang menang atas LABUAN; Kab vs Kota dibedakan kata di depan", async () => {
    const { pl, tutup } = PL();
    const r = await pl.rencanaDropdown("Jl. A Desa Labuan Salumbone Kecamatan Labuan Kabupaten Donggala Provinsi Sulawesi Tengah", kosong, ambil());
    expect(r.map((x: any) => x.wilayah.nilaiSipp)).toEqual(["S72", "S7203", "S720309", "D3001"]);
    const kota = await pl.rencanaDropdown("Jl. A Kelurahan Balaroa Kecamatan Palu Barat Kota Palu Provinsi Sulawesi Tengah", kosong, ambil());
    expect(kota.map((x: any) => x.wilayah.nilaiSipp)).toEqual(["S72", "S7271", "S727101", "D4001"]);
    tutup();
  });

  it("tingkat yang sudah terisi tidak dimasukkan rencana; yang tak sejalan dengan induknya membatalkan induk pilihan sendiri", async () => {
    const { pl, tutup } = PL();
    const isi = [
      { terisi: true, nama: "SULAWESI TENGAH" },
      { terisi: false, nama: "" },
      { terisi: false, nama: "" },
      { terisi: false, nama: "" },
    ];
    const r = await pl.rencanaDropdown("Jl. A Desa Dalaka Kecamatan Sindue Kabupaten Donggala", isi, ambil());
    expect(r.map((x: any) => x.indeks)).toEqual([1, 2, 3]);
    // Kabupaten sudah dipilih petugas = Kota Palu (Sulawesi Tengah); alamat menyebut Provinsi Sulawesi Selatan:
    // provinsi pilihan sendiri itu tak sejalan dengan kabupaten terpilih -> dibatalkan, tidak ada yang diisi.
    const palu = [
      { terisi: false, nama: "" },
      { terisi: true, nama: "KOTA PALU" },
      { terisi: false, nama: "" },
      { terisi: false, nama: "" },
    ];
    const r2 = await pl.rencanaDropdown("Jl. A Provinsi Sulawesi Selatan", palu, ambil());
    expect(r2).toEqual([]);
    // Kabupaten terpilih tetapi provinsi kosong dan tak tertulis: rantai berhenti di situ (tidak menebak).
    const r3 = await pl.rencanaDropdown("Jl. A Kecamatan Palu Barat", palu, ambil());
    expect(r3).toEqual([]);
    tutup();
  });
});

/* ─────────────────────────── dropdown bertingkat di halaman ─────────────────────────── */

describe("B. halaman SIPP tiruan (dropdown memuat opsi tertunda)", () => {
  it("alamat lengkap tanpa dropdown: dropdown terisi bertingkat; Simpan tidak ditekan; tanpa Aleta", async () => {
    const h = bukaSipp();
    ketik(h, "Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala");
    await sampai(() => teksPilihan(h, "kel") === "DALAKA", "keempat tingkat terisi");
    expect([teksPilihan(h, "prop"), teksPilihan(h, "kab"), teksPilihan(h, "kec"), teksPilihan(h, "kel")]).toEqual([
      "SULAWESI TENGAH",
      "KAB. DONGGALA",
      "SINDUE",
      "DALAKA",
    ]);
    expect(sel(h, "kel").value).toBe("D2001");
    lepasFokus(h);
    // provinsi hasil simpulan belum tertulis di alamat -> ditambahkan di kanan sesudah blur
    await sampai(() => alamat(h).value.endsWith(", Provinsi Sulawesi Tengah"), "provinsi ditambahkan ke alamat");
    expect(alamat(h).value).toBe("Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(h.simpan()).toBe(0);
    expect(alamat(h).value).not.toMatch(/aleta/i);
  });

  it("dropdown lengkap, alamat hanya jalan: alamat bertambah di kanan; tidak menyela ketikan yang sedang berlangsung", async () => {
    const h = bukaSipp();
    ketik(h, "Jalan Trans Sulawesi");
    // petugas masih memfokus alamat saat dropdown dipilih: alamat TIDAK disentuh
    pilihSepertiSipp(h, "prop", "S72", "SULAWESI TENGAH");
    pilihSepertiSipp(h, "kab", "S7203", "KAB. DONGGALA");
    pilihSepertiSipp(h, "kec", "S720311", "SINDUE");
    pilihSepertiSipp(h, "kel", "D2001", "DALAKA");
    await tunggu(500);
    expect(alamat(h).value).toBe("Jalan Trans Sulawesi");
    lepasFokus(h);
    await sampai(() => alamat(h).value.includes("Provinsi"), "alamat bertambah sesudah blur");
    expect(alamat(h).value).toBe("Jalan Trans Sulawesi, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    // dropdown tidak berubah oleh pengisian alamat
    expect(sel(h, "kab").value).toBe("S7203");
  });

  it("hanya provinsi yang kurang: ', Provinsi Sulawesi Tengah' menempel di kanan", async () => {
    const h = bukaSipp();
    alamat(h).value = "Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala";
    pilihSepertiSipp(h, "kab", "S7203", "KAB. DONGGALA");
    pilihSepertiSipp(h, "kec", "S720311", "SINDUE");
    pilihSepertiSipp(h, "kel", "D2001", "DALAKA");
    pilihSepertiSipp(h, "prop", "S72", "SULAWESI TENGAH");
    await sampai(() => alamat(h).value.endsWith(", Provinsi Sulawesi Tengah"), "provinsi ditambahkan");
    expect(alamat(h).value).toBe("Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala, Provinsi Sulawesi Tengah");
  });

  it("nama tak dikenal: dropdown tetap kosong; dropdown yang sudah terisi tidak ditimpa", async () => {
    const h = bukaSipp();
    ketik(h, "Jalan Mawar Desa Xyzzy Kecamatan Qwerty");
    await tunggu(700);
    expect(sel(h, "prop").value).toBe("");
    expect(sel(h, "kab").value).toBe("");

    // Kabupaten dipilih petugas = Sigi; alamat menyebut Donggala: Sigi tidak diganti.
    pilihSepertiSipp(h, "prop", "S72", "SULAWESI TENGAH");
    pilihSepertiSipp(h, "kab", "S7210", "KAB. SIGI");
    ketik(h, "Jalan Mawar Kecamatan Sindue Kabupaten Donggala");
    await tunggu(700);
    expect(sel(h, "kab").value).toBe("S7210");
    expect(teksPilihan(h, "kab")).toBe("KAB. SIGI");
    expect(sel(h, "kec").value).toBe("");
  });

  it("tidak loop: sesudah stabil tidak ada permintaan wilayah baru dan alamat tidak berubah lagi", async () => {
    const h = bukaSipp();
    ketik(h, "Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala Provinsi Sulawesi Tengah");
    await sampai(() => teksPilihan(h, "kel") === "DALAKA", "terisi");
    lepasFokus(h);
    await tunggu(500);
    const awalAlamat = alamat(h).value;
    // Alamat sudah memuat semuanya: tidak ada tambahan.
    expect(awalAlamat).toBe("Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala Provinsi Sulawesi Tengah");
    let ubah = 0;
    alamat(h).addEventListener("input", () => (ubah += 1));
    const permintaan = h.minta.length;
    await tunggu(900);
    expect(alamat(h).value).toBe(awalAlamat);
    expect(ubah).toBe(0);
    expect(h.minta.length).toBe(permintaan);
  });
});
