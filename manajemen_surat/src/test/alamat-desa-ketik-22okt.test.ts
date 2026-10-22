/**
 * ============================================================================
 * 22 OKT 2026 (W50, lanjutan) - KETIK AWAL NAMA DESA -> ALAMAT WILAYAH LENGKAP
 * ============================================================================
 *
 * Masukan pengguna: harus mengetik sampai kabupaten baru menu Tab keluar; yang
 * diminta, cukup awal NAMA DESA/KELURAHAN (atau kecamatan) dan seluruh alamatnya
 * dikenali: "Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi
 * Tengah", lalu empat dropdown ikut terisi.
 *
 * Data uji: daftar ringkas Sulawesi Tengah SUNGGUHAN dari SIPP (13 kabupaten,
 * 175 kecamatan, 2.016 desa) - fixtures/wilayah-ringkas-72.json, bentuk yang sama
 * dengan jawaban rute /wilayah-ringkas. Yang diuji:
 *
 *   - pencarian murni: nama desa, sesudah nama jalan, kecamatan, desa ganda
 *     (urut: kabupaten satker lebih dulu), tanpa kecocokan, nama jalan, alamat
 *     yang sudah lengkap, dropdown terisi;
 *   - kecepatan: puluhan ribu pencarian, rata-rata dan terburuk (ms), ukuran data;
 *   - halaman: ketikan beruntun = SATU permintaan daftar (bukan per ketikan),
 *     jeda ketik, Tab, panah + Enter, dropdown terisi bertingkat, disimpan 30 hari.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_JEMBATAN = baca("jembatan.js");
const SUMBER_PENJAGA = baca("penjaga-tanda.js");
const SUMBER_PL = baca("pihak-lengkap.js");
const MENTAH = readFileSync(path.join(__dirname, "fixtures", "wilayah-ringkas-72.json"), "utf8");
const RINGKAS_72 = JSON.parse(MENTAH) as {
  versi: 1;
  provinsi: { kode: string; nama: string };
  kab: Array<[string, string]>;
  kec: Array<[string, string]>;
  desa: Record<string, Array<[string, string]>>;
};
const NAMA = new Map<string, string>([
  [RINGKAS_72.provinsi.kode, RINGKAS_72.provinsi.nama],
  ...RINGKAS_72.kab,
  ...RINGKAS_72.kec,
]);
for (const [kec, daftar] of Object.entries(RINGKAS_72.desa)) for (const [akhir, nama] of daftar) NAMA.set(`${kec}.${akhir}`, nama);

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
    await tunggu(15);
  }
}

const ASAL = "http://192.168.10.10";
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

/** Penyimpanan chrome.storage.local tiruan yang dapat dipakai bersama beberapa halaman (seperti satu PC). */
function penyimpananTiruan(awal: Record<string, unknown> = {}) {
  const isi: Record<string, unknown> = { ...awal };
  return {
    isi,
    local: {
      get: async (kunci?: string | string[]) => {
        const daftar = kunci == null ? Object.keys(isi) : [kunci].flat();
        const hasil: Record<string, unknown> = {};
        for (const k of daftar) if (k in isi) hasil[k] = JSON.parse(JSON.stringify(isi[k]));
        return hasil;
      },
      set: async (x: Record<string, unknown>) => void Object.assign(isi, JSON.parse(JSON.stringify(x))),
    },
  };
}

const PL = () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  const w = dom.window as any;
  w.ALETA_PIHAK_LENGKAP_MANUAL = true;
  w.eval(SUMBER_PL);
  return { w, pl: w.AletaPihakLengkap, tutup: () => w.close() };
};
function indeksUji(pl: any, data: unknown = RINGKAS_72) {
  const ind = pl.buatIndeks();
  expect(ind.tambah(JSON.parse(JSON.stringify(data)))).toBe(true);
  return ind;
}

/* ─────────────────────────── pencarian murni ─────────────────────────── */

describe("ketik awal nama desa -> alamat lengkap (murni)", () => {
  it("'dala' -> Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah; satu kecocokan = kuat", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    const h = pl.cariWilayah(ind, "dala");
    expect(h.kandidat.length).toBe(1);
    expect(h.kuat).toBe(true);
    expect(h.kandidat[0].teks).toBe("Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(pl.cariWilayah(ind, "Dalaka").kandidat[0].teks).toBe(h.kandidat[0].teks);
    tutup();
  });

  it("sesudah nama jalan: nama jalan di kiri tidak diubah (hanya dibakukan), koma menempel, satu spasi", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    const h = pl.cariWilayah(ind, "Jalan Kanalele IV dala");
    expect(h.kuat).toBe(true);
    expect(h.head).toBe("Jalan Kanalele IV");
    expect(h.kandidat[0].teks).toBe("Jalan Kanalele IV, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    // singkatan di kiri dipanjangkan seperti biasa
    expect(pl.cariWilayah(ind, "jl mawar rt 2 rw 3 dalaka").kandidat[0].teks).toBe(
      "Jalan Mawar RT 2/RW 3, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
    tutup();
  });

  it("kata kunci 'Desa'/'Kel' di depan dibuang dari kiri; 'Kec' hanya mencari kecamatan", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    expect(pl.cariWilayah(ind, "Jalan X Desa dala").kandidat[0].teks).toBe(
      "Jalan X, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
    const kec = pl.cariWilayah(ind, "Jalan X kec sind");
    expect(kec.kandidat.length).toBeGreaterThan(1);
    expect(kec.kandidat.every((k: any) => k.jenis === "kec")).toBe(true);
    expect(kec.kandidat[0].teks).toBe("Jalan X, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    tutup();
  });

  it("mulai dari kecamatan: 'sind' -> Kecamatan Sindue, Kabupaten Donggala, Provinsi ...; ada pilihan, tidak kuat", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    const h = pl.cariWilayah(ind, "sind");
    expect(h.kuat).toBe(false);
    expect(h.kandidat.map((k: any) => k.label[0])).toEqual(expect.arrayContaining(["Kecamatan Sindue", "Kecamatan Sindue Tobata", "Kecamatan Sindue Tombusabora"]));
    expect(h.kandidat[0].teks).toBe("Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    tutup();
  });

  it("desa ganda: daftar maksimal 6, kabupaten satker lebih dulu lalu yang terdekat, bukan kuat", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    // 'Tondo' ada di Donggala (72.03), Palu (72.71) dan Parigi Moutong (72.06)
    const h = pl.cariWilayah(ind, "Jalan X tondo");
    expect(h.kuat).toBe(false);
    const kab = h.kandidat.map((k: any) => k.label.find((l: string) => /^Kab|^Kota/.test(l)));
    expect(kab.slice(0, 2)).toEqual(["Kabupaten Donggala", "Kota Palu"]);
    expect(h.kandidat.length).toBeLessThanOrEqual(6);
    // 'Malino' ada di 5 tempat; semuanya paling banyak 6 tampil, yang di Donggala (satker) di depan
    const m = pl.cariWilayah(ind, "malino");
    expect(m.kandidat.length).toBeGreaterThanOrEqual(5);
    expect(m.kandidat.length).toBeLessThanOrEqual(6);
    expect(m.kandidat[0].label.join(" ")).toContain("Kabupaten Donggala");
    // Tab tidak memilih sendiri bila tidak ada satu kecocokan kuat
    expect(m.kuat).toBe(false);
    tutup();
  });

  it("desa yang pernah dipilih naik ke atas daftar", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    const pakai = new Map([["72.71.08.1002", 3]]); // Tondo di Kota Palu
    const h = pl.cariWilayah(ind, "tondo", { pakai });
    expect(h.kandidat[0].kode).toBe("72.71.08.1002");
    tutup();
  });

  it("tanpa kecocokan, nama jalan, kata penanda, angka, dan alamat yang sudah lengkap: tidak ada usulan", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    for (const teks of [
      "Jalan Xyzqw",
      "Jalan Mawar",
      "jl",
      "Jalan Sudirman No. 12",
      "dsn",
      "RT 003",
      "Jalan X, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala",
      "Jalan X kabupaten dala",
      "Jalan X ",
      "Jalan X,",
      "",
    ]) {
      expect(pl.cariWilayah(ind, teks).kandidat, teks).toEqual([]);
    }
    tutup();
  });

  it("dropdown yang sudah terisi dihormati: desa di luar kabupaten terpilih tidak diusulkan", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    expect(pl.cariWilayah(ind, "dala", { terisi: ["", "Kabupaten Sigi", "", ""] }).kandidat).toEqual([]);
    const ok = pl.cariWilayah(ind, "dala", { terisi: ["Sulawesi Tengah", "KAB. DONGGALA", "", ""] });
    expect(ok.kandidat[0].kode).toBe("72.03.10.2001");
    // 'tondo' dibatasi ke Kota Palu bila itu yang terpilih
    const palu = pl.cariWilayah(ind, "tondo", { terisi: ["", "Kota Palu", "", ""] });
    expect(palu.kandidat.map((k: any) => k.kode)).toEqual(["72.71.08.1002"]);
    expect(palu.kuat).toBe(true);
    tutup();
  });

  it("Desa atau Kelurahan mengikuti kode wilayah SIPP; tanpa kata Aleta", () => {
    const { pl, tutup } = PL();
    const ind = indeksUji(pl);
    const kel = pl.cariWilayah(ind, "tondo", { terisi: ["", "Kota Palu", "", ""] }).kandidat[0];
    expect(kel.label[0]).toBe("Kelurahan Tondo"); // 72.71.08.1002 -> 1xxx
    const desa = pl.cariWilayah(ind, "dalaka").kandidat[0];
    expect(desa.label[0]).toBe("Desa Dalaka"); // 72.03.10.2001 -> 2xxx
    expect(JSON.stringify([kel, desa])).not.toMatch(/aleta/i);
    tutup();
  });
});

/* ─────────────────────────── kecepatan dan ukuran ─────────────────────────── */

describe("ringan: ukuran data dan waktu cari", () => {
  it("data Sulawesi Tengah ~48 KB, indeks dibangun cepat, pencarian < 5 ms (rata-rata dan terburuk)", () => {
    const { pl, tutup } = PL();
    const mulaiBangun = performance.now();
    const ind = indeksUji(pl);
    const waktuBangun = performance.now() - mulaiBangun;
    const jumlahDesa = Object.values(RINGKAS_72.desa).reduce((a, b) => a + b.length, 0);
    expect(ind.desa.length).toBe(jumlahDesa);
    expect(jumlahDesa).toBeGreaterThan(2000);
    expect(MENTAH.length).toBeLessThan(60_000);

    const ketikan = ["d", "da", "dal", "dala", "dalak", "Jalan Kanalele IV dala", "sind", "sindu", "tond", "malin", "lab", "labuan s", "jl mawar bar", "kam", "toli", "pal", "bam", "xyz", "tombu", "Desa lompio"];
    for (const k of ketikan) pl.cariWilayah(ind, k); // hangatkan
    const waktu: number[] = [];
    for (let putaran = 0; putaran < 50; putaran += 1) {
      for (const k of ketikan) {
        const t = performance.now();
        pl.cariWilayah(ind, k);
        waktu.push(performance.now() - t);
      }
    }
    const rata = waktu.reduce((a, b) => a + b, 0) / waktu.length;
    const terburuk = Math.max(...waktu);
    // eslint-disable-next-line no-console
    console.info(
      `[ukur] data ${(MENTAH.length / 1024).toFixed(1)} KB, ${jumlahDesa} desa, bangun indeks ${waktuBangun.toFixed(1)} ms; cari ${waktu.length}x: rata-rata ${rata.toFixed(3)} ms, terburuk ${terburuk.toFixed(2)} ms`
    );
    expect(rata).toBeLessThan(5);
    expect(terburuk).toBeLessThan(25); // satu pencarian lambat tunggal (JIT/GC) boleh, tetapi bukan puluhan ms
    expect(waktuBangun).toBeLessThan(200);
    tutup();
  });

  it("enam kali lipat desa (~12 ribu): pencarian tetap < 5 ms rata-rata", () => {
    const { pl, tutup } = PL();
    const ind = pl.buatIndeks();
    for (let i = 0; i < 6; i += 1) {
      // salinan dengan kode provinsi lain: 6 provinsi buatan
      const kodeP = String(60 + i);
      const salin = JSON.parse(MENTAH.split('"72').join(`"${kodeP}`).split("72.").join(`${kodeP}.`));
      ind.tambah(salin);
    }
    expect(ind.desa.length).toBeGreaterThan(12_000);
    const ketikan = ["d", "dal", "dala", "Jalan X dalaka", "sind", "tond", "malin", "lab", "kam", "bam"];
    const waktu: number[] = [];
    for (let putaran = 0; putaran < 40; putaran += 1) {
      for (const k of ketikan) {
        const t = performance.now();
        pl.cariWilayah(ind, k);
        waktu.push(performance.now() - t);
      }
    }
    const rata = waktu.reduce((a, b) => a + b, 0) / waktu.length;
    // eslint-disable-next-line no-console
    console.info(`[ukur] ${ind.desa.length} desa: rata-rata ${rata.toFixed(3)} ms, terburuk ${Math.max(...waktu).toFixed(2)} ms`);
    expect(rata).toBeLessThan(5);
    tutup();
  });
});

/* ─────────────────────────── halaman SIPP tiruan ─────────────────────────── */

const HALAMAN = `
<div id="popup_pihak" class="popup" style="display:block">
  <form id="frm_ref_pihak" method="post" action="${ASAL}/SIPP/pihak_list/validateInput">
    <table><tbody>
      <tr><td><input id="pihak_fullname" name="pihak_fullname" value=""></td></tr>
      <tr><td><textarea id="pihak_alamat" name="pihak_alamat"></textarea></td></tr>
      <tr><td><select name="prop" id="prop"><option value="">- Cari/Pilih Propinsi -</option></select></td></tr>
      <tr><td><select name="kab" id="kab"><option value="">- Cari/Pilih Kabupaten/Kota -</option></select></td></tr>
      <tr><td><select name="kec" id="kec"><option value="">- Cari/Pilih Kecamatan -</option></select></td></tr>
      <tr><td><select name="kel" id="kel"><option value="">- Cari/Pilih Kelurahan/Desa -</option></select></td></tr>
      <tr><td><input type="submit" id="simpan_btn" value="Simpan"></td></tr>
    </tbody></table>
  </form>
</div>`;

function bukaSipp(opsi: { simpanan?: ReturnType<typeof penyimpananTiruan>; ringkasGagal?: boolean; tersembunyi?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${HALAMAN}</body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  if (opsi.tersembunyi) w.document.getElementById("popup_pihak").style.display = "none";
  const simpanan = opsi.simpanan ?? penyimpananTiruan();
  w.chrome = { runtime: { id: "aleta-uji", getURL: (x: string) => x, lastError: undefined }, storage: { local: simpanan.local } };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/aleta-ecourt/wilayah-ringkas")) {
      await tunggu(10);
      if (opsi.ringkasGagal) return Response.json({ ok: false }, { status: 500 });
      return Response.json({ ok: true, data: { available: true, ok: true, ...RINGKAS_72 } });
    }
    if (url.includes("/aleta-ecourt/wilayah")) {
      const kode = new URL(url, ASAL).searchParams.get("kode") || "";
      const ruas = kode.split(".");
      const data = ruas.map((_, i) => {
        const k = ruas.slice(0, i + 1).join(".");
        return { tingkat: ["provinsi", "kabupaten", "kecamatan", "kelurahan"][i], kode: k, nama: NAMA.get(k) || k, nilaiSipp: `N${k}` };
      });
      await tunggu(5);
      return Response.json({ ok: true, data: { ok: true, lengkap: true, sandi: { ok: true }, data } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.postMessage = (data: unknown) => setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  let simpanDitekan = 0;
  w.document.getElementById("simpan_btn").addEventListener("click", () => (simpanDitekan += 1));
  w.document.getElementById("frm_ref_pihak").addEventListener("submit", (e: Event) => e.preventDefault());
  w.ALETA_PL_JEDA = { detak: 50, ketik: 150, gambar: 60, tetangga: 60_000 };
  w.ALETA_PL_WILAYAH = { utama: ["72"], tetangga: [] };
  w.eval(SUMBER_PENJAGA);
  w.eval(SUMBER_JEMBATAN);
  w.eval(SUMBER_PL);
  const doc = w.document as Document;
  return { w, doc, minta, simpanan, simpan: () => simpanDitekan, pl: w.AletaPihakLengkap };
}
type Halaman = ReturnType<typeof bukaSipp>;

const alamat = (h: Halaman) => h.doc.getElementById("pihak_alamat") as HTMLTextAreaElement;
const sel = (h: Halaman, id: string) => h.doc.getElementById(id) as HTMLSelectElement;
const teksPilihan = (h: Halaman, id: string) => {
  const s = sel(h, id);
  return s.value ? String(s.options[s.selectedIndex].textContent) : "";
};
const permintaan = (h: Halaman, bagian: string) => h.minta.filter((u) => u.includes(bagian)).length;
const kotakSaran = (h: Halaman) => alamat(h).nextElementSibling as HTMLElement;
const saranTeks = (h: Halaman) => (kotakSaran(h) && !kotakSaran(h).hidden ? kotakSaran(h).textContent || "" : "");
const chips = (h: Halaman) => Array.from(kotakSaran(h).querySelectorAll(".aleta-pl-chip")) as HTMLButtonElement[];

/** Mengetik huruf demi huruf (satu peristiwa input tiap huruf, seperti papan ketik sungguhan). */
async function ketikSatuSatu(h: Halaman, teks: string, jeda = 3) {
  const a = alamat(h);
  a.focus();
  for (let i = 1; i <= teks.length; i += 1) {
    a.value = teks.slice(0, i);
    a.setSelectionRange(i, i);
    a.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await tunggu(jeda);
  }
}
function tekan(h: Halaman, key: string) {
  const k = new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  alamat(h).dispatchEvent(k);
  return k.defaultPrevented as boolean;
}
async function indeksSiap(h: Halaman) {
  await sampai(() => h.pl.wilayahKini.indeks.desa.length > 2000, "indeks wilayah termuat");
}

describe("halaman: ketik awal nama desa", () => {
  it("ketikan beruntun = SATU permintaan daftar; usulan lengkap tampil; Tab mengisi alamat dan keempat dropdown bertingkat", async () => {
    const h = bukaSipp();
    await indeksSiap(h);
    expect(permintaan(h, "wilayah-ringkas")).toBe(1);

    await ketikSatuSatu(h, "Jalan Kanalele IV dala");
    await sampai(() => saranTeks(h).includes("Desa Dalaka"), "usulan tampil sesudah jeda ketik");
    expect(saranTeks(h)).toBe("Tab: Jalan Kanalele IV, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(alamat(h).value).toBe("Jalan Kanalele IV dala"); // belum diterapkan

    // tidak ada permintaan ke server per ketikan: daftar tetap satu, rantai belum diminta
    expect(permintaan(h, "wilayah-ringkas")).toBe(1);
    expect(permintaan(h, "wilayah?kode")).toBe(0);

    expect(tekan(h, "Tab")).toBe(true);
    expect(alamat(h).value).toBe("Jalan Kanalele IV, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    await sampai(() => sel(h, "kel").value === "N72.03.10.2001", "dropdown desa terisi");
    expect([teksPilihan(h, "prop"), teksPilihan(h, "kab"), teksPilihan(h, "kec"), teksPilihan(h, "kel")]).toEqual([
      "Sulawesi Tengah",
      "Kabupaten Donggala",
      "Sindue",
      "Dalaka",
    ]);
    expect([sel(h, "prop").value, sel(h, "kab").value, sel(h, "kec").value]).toEqual(["N72", "N72.03", "N72.03.10"]);
    // satu permintaan untuk rantai desa yang dipilih; daftar tetap satu
    expect(permintaan(h, "wilayah?kode=72.03.10.2001")).toBe(1);
    expect(permintaan(h, "wilayah-ringkas")).toBe(1);

    // alamat sesudah itu stabil (tidak ditambah/dibalik lagi oleh sinkron dropdown)
    alamat(h).blur();
    await tunggu(400);
    expect(alamat(h).value).toBe("Jalan Kanalele IV, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    // Tab berikutnya = Tab biasa
    alamat(h).focus();
    expect(tekan(h, "Tab")).toBe(false);
    expect(h.simpan()).toBe(0);
    expect(alamat(h).value).not.toMatch(/aleta/i);
  });

  it("jeda ketik: puluhan ketikan cepat tidak memicu pencarian di setiap tombol", async () => {
    const h = bukaSipp();
    await indeksSiap(h);
    const awal = h.pl.wilayahKini.pencarian;
    const a = alamat(h);
    a.focus();
    const teks = "Jalan Kanalele IV dalaka";
    for (let i = 1; i <= teks.length; i += 1) {
      a.value = teks.slice(0, i);
      a.setSelectionRange(i, i);
      a.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    }
    await sampai(() => saranTeks(h).includes("Desa Dalaka"), "usulan");
    expect(h.pl.wilayahKini.pencarian - awal).toBeLessThanOrEqual(2); // 24 ketikan -> paling banyak 2 pencarian
  });

  it("desa ganda: daftar pilihan; panah bawah + Enter memilih; Tab tanpa pilihan tidak memilih sendiri", async () => {
    const h = bukaSipp();
    await indeksSiap(h);
    await ketikSatuSatu(h, "Jalan X tondo");
    await sampai(() => chips(h).length >= 3, "daftar pilihan");
    expect(chips(h).length).toBeLessThanOrEqual(6);
    expect(chips(h)[0].textContent).toBe("Jalan X, Desa Tondo, Kecamatan Sirenja, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(chips(h)[1].textContent).toContain("Kota Palu");
    expect(saranTeks(h)).toContain("panah atas/bawah");

    // Tab tanpa memilih apa pun: Tab biasa, alamat tidak berubah
    expect(tekan(h, "Tab")).toBe(false);
    expect(alamat(h).value).toBe("Jalan X tondo");

    expect(tekan(h, "ArrowDown")).toBe(true);
    expect(tekan(h, "ArrowDown")).toBe(true);
    expect(chips(h)[1].classList.contains("aleta-pl-aktif")).toBe(true);
    expect(tekan(h, "ArrowUp")).toBe(true);
    expect(tekan(h, "ArrowDown")).toBe(true);
    expect(tekan(h, "Enter")).toBe(true);
    expect(alamat(h).value).toBe("Jalan X, Kelurahan Tondo, Kecamatan Mantikulore, Kota Palu, Provinsi Sulawesi Tengah");
    await sampai(() => sel(h, "kel").value === "N72.71.08.1002", "dropdown sesuai pilihan");
    expect(teksPilihan(h, "kab")).toBe("Kota Palu");
  });

  it("klik pada pilihan sama dengan Enter; Escape menutup daftar; tanpa kecocokan Tab biasa dan alamat tidak berubah", async () => {
    const h = bukaSipp();
    await indeksSiap(h);
    await ketikSatuSatu(h, "tondo");
    await sampai(() => chips(h).length >= 3, "daftar");
    expect(tekan(h, "Escape")).toBe(false);
    expect(kotakSaran(h).hidden).toBe(true);

    await ketikSatuSatu(h, "Jalan Xyzqw");
    await tunggu(250);
    expect(saranTeks(h)).toBe("");
    expect(tekan(h, "Tab")).toBe(false);
    expect(alamat(h).value).toBe("Jalan Xyzqw");

    await ketikSatuSatu(h, "tondo");
    await sampai(() => chips(h).length >= 3, "daftar lagi");
    chips(h)[0].click();
    expect(alamat(h).value).toBe("Desa Tondo, Kecamatan Sirenja, Kabupaten Donggala, Provinsi Sulawesi Tengah");
  });

  it("dropdown yang sudah terisi tidak ditimpa dan membatasi usulan", async () => {
    const h = bukaSipp();
    await indeksSiap(h);
    // petugas sudah memilih Kabupaten Sigi
    for (const [id, nilai, teks] of [
      ["prop", "N72", "Sulawesi Tengah"],
      ["kab", "N72.10", "Kabupaten Sigi"],
    ]) {
      const o = h.doc.createElement("option");
      o.value = nilai;
      o.textContent = teks;
      sel(h, id).appendChild(o);
      sel(h, id).value = nilai;
    }
    await ketikSatuSatu(h, "dala"); // Dalaka ada di Donggala, bukan Sigi
    await tunggu(300);
    // tidak ada alamat wilayah untuk Dalaka (bukan di Sigi); yang tersisa hanya bentuk baku biasa
    expect(saranTeks(h)).not.toMatch(/Dalaka|Sindue|Donggala/);
    tekan(h, "Tab");
    expect(alamat(h).value).not.toMatch(/Dalaka|Sindue|Donggala|Kabupaten/);
    expect(teksPilihan(h, "kab")).toBe("Kabupaten Sigi");
    expect(sel(h, "kec").value).toBe("");
  });

  it("blangko dibuka lewat pop-up [Cari]/[Tambah] (semula tersembunyi): tidak ada permintaan sebelum tampil; sesudah tampil bekerja, juga untuk mengubah referensi yang sudah beralamat", async () => {
    const h = bukaSipp({ tersembunyi: true });
    await tunggu(300);
    expect(h.minta.length).toBe(0);
    h.doc.getElementById("popup_pihak")!.style.display = "block";
    await indeksSiap(h);
    expect(permintaan(h, "wilayah-ringkas")).toBe(1);
    // ubah referensi: alamat lama sudah ada, petugas menambah di ujung
    alamat(h).value = "Jalan Kanalele IV";
    await ketikSatuSatu(h, "Jalan Kanalele IV dalaka");
    await sampai(() => saranTeks(h).includes("Desa Dalaka"), "usulan pada blangko ubah");
    expect(tekan(h, "Tab")).toBe(true);
    expect(alamat(h).value).toBe("Jalan Kanalele IV, Desa Dalaka, Kecamatan Sindue, Kabupaten Donggala, Provinsi Sulawesi Tengah");
  });

  it("data disimpan 30 hari di penyimpanan peramban: halaman berikutnya tanpa permintaan; basi >30 hari = satu permintaan baru", async () => {
    const simpanan = penyimpananTiruan();
    const h1 = bukaSipp({ simpanan });
    await indeksSiap(h1);
    expect(permintaan(h1, "wilayah-ringkas")).toBe(1);
    const tersimpan = simpanan.isi.aletaWilayahRingkas as Record<string, { diambil: number; data: unknown }>;
    expect(Object.keys(tersimpan)).toEqual(["72"]);
    expect(Date.now() - tersimpan["72"].diambil).toBeLessThan(10_000);

    const h2 = bukaSipp({ simpanan });
    await indeksSiap(h2);
    expect(permintaan(h2, "wilayah-ringkas")).toBe(0);
    await ketikSatuSatu(h2, "dalaka");
    await sampai(() => saranTeks(h2).includes("Desa Dalaka"), "usulan dari simpanan");

    tersimpan["72"].diambil = Date.now() - 31 * 24 * 3600 * 1000;
    simpanan.isi.aletaWilayahRingkas = tersimpan;
    const h3 = bukaSipp({ simpanan });
    await indeksSiap(h3);
    expect(permintaan(h3, "wilayah-ringkas")).toBe(1);
  });

  it("server tak terjangkau: tanpa indeks, perilaku lama tetap (bentuk baku); tidak membanjiri permintaan", async () => {
    const h = bukaSipp({ ringkasGagal: true });
    await tunggu(300);
    expect(h.pl.wilayahKini.indeks.desa.length).toBe(0);
    await ketikSatuSatu(h, "jl mawar ds lalombi");
    await sampai(() => saranTeks(h).includes("Jalan Mawar Desa Lalombi"), "usulan baku lama");
    await tunggu(400);
    expect(permintaan(h, "wilayah-ringkas")).toBe(1); // tidak diulang sebelum 10 menit
  });
});

/* ─────────────────────────── sisi server ─────────────────────────── */

describe("sisi server: daftar ringkas", () => {
  it("bot menyusun bentuk ringkas dari tabel rujukan (SELECT berparameter, tanpa nilai bersandi); portal menyusun dari ?induk= bila bot lama", async () => {
    const { ambilWilayahRingkas, kosongkanSinggahRingkas } = await import("@/server/modules/aleta-ecourt/wilayah-ringkas");
    kosongkanSinggahRingkas();
    const panggilan: string[] = [];
    // Bot lama: ?ringkas diabaikan, menjawab daftar provinsi biasa.
    const sumber = {
      ringkas: async () => ({ ok: true, data: { ok: true, tingkat: "provinsi", data: [] } as Record<string, unknown> }),
      anak: async (induk: string) => {
        panggilan.push(induk);
        const n = induk.split(".").filter(Boolean).length;
        if (induk === "") return { ok: true, data: [{ kode: "72", nama: "Sulawesi Tengah" }] };
        if (n === 1) return { ok: true, data: RINGKAS_72.kab.map(([kode, nama]) => ({ kode, nama })) };
        if (n === 2) return { ok: true, data: RINGKAS_72.kec.filter(([k]) => k.startsWith(`${induk}.`)).map(([kode, nama]) => ({ kode, nama })) };
        const d = RINGKAS_72.desa[induk] || [];
        return { ok: true, data: d.map(([akhir, nama]) => ({ kode: `${induk}.${akhir}`, nama })) };
      },
    };
    const hasil = await ambilWilayahRingkas("72", sumber);
    expect(hasil).not.toBeNull();
    expect(hasil!.kab.length).toBe(RINGKAS_72.kab.length);
    expect(hasil!.kec.length).toBe(RINGKAS_72.kec.length);
    expect(Object.values(hasil!.desa).reduce((a, b) => a + b.length, 0)).toBe(Object.values(RINGKAS_72.desa).reduce((a, b) => a + b.length, 0));
    expect(JSON.stringify(hasil)).not.toMatch(/nilaiSipp/);
    // dua pemanggil serentak + pemanggil sesudahnya memakai hasil yang sama (tidak menyusun ulang)
    const sebelum = panggilan.length;
    await Promise.all([ambilWilayahRingkas("72", sumber), ambilWilayahRingkas("72", sumber)]);
    expect(panggilan.length).toBe(sebelum);
    kosongkanSinggahRingkas();
  });

  it("bot baru menjawab bentuk ringkas langsung: dipakai apa adanya, tanpa ?induk=", async () => {
    const { ambilWilayahRingkas, kosongkanSinggahRingkas } = await import("@/server/modules/aleta-ecourt/wilayah-ringkas");
    kosongkanSinggahRingkas();
    let anak = 0;
    const hasil = await ambilWilayahRingkas("72", {
      ringkas: async () => ({ ok: true, data: { ok: true, ...RINGKAS_72 } as Record<string, unknown> }),
      anak: async () => {
        anak += 1;
        return { ok: false, data: [] };
      },
    });
    expect(hasil!.provinsi.kode).toBe("72");
    expect(anak).toBe(0);
    kosongkanSinggahRingkas();
    // bot menolak (bukan "tidak punya rute"): tidak ada susunan cadangan
    const ditolak = await ambilWilayahRingkas("72", {
      ringkas: async () => ({ ok: false, status: 500, kode: "sipp_tidak_terbaca", error: "x" }),
      anak: async () => {
        anak += 1;
        return { ok: false, data: [] };
      },
    });
    expect(ditolak).toBeNull();
    expect(anak).toBe(0);
    kosongkanSinggahRingkas();
  });
});

describe("sisi bot: daftarRingkas", () => {
  const AKAR_BOT = path.join(AKAR, "aleta_bot");
  const muatBot = createRequire(path.join(AKAR_BOT, "package.json"));
  it("tiga SELECT berparameter (provinsi, kabupaten, kecamatan, desa), bentuk ringkas tanpa nilai bersandi, diingat 12 jam; kode tidak sah ditolak", async () => {
    for (const k of Object.keys(muatBot.cache)) if (k.startsWith(AKAR_BOT) && !k.includes("node_modules")) delete muatBot.cache[k];
    const kueri: Array<{ sql: string; nilai: unknown[] }> = [];
    const dbPalsu = {
      query(sql: string, nilai: unknown, cb?: (e: unknown, r: unknown) => void) {
        const selesai = (typeof nilai === "function" ? nilai : cb) as (e: unknown, r: unknown) => void;
        kueri.push({ sql: String(sql), nilai: Array.isArray(nilai) ? nilai : [] });
        const tabel = /FROM\s+(ref_\w+)/.exec(String(sql))?.[1] || "";
        const baris =
          tabel === "ref_provinsi_new"
            ? [{ kode: "72", nama: "Sulawesi Tengah" }]
            : tabel === "ref_kabupaten_new"
              ? [{ kode: "72.03", nama: "Kabupaten Donggala" }]
              : tabel === "ref_kecamatan_new"
                ? [{ kode: "72.03.10", nama: "Sindue" }]
                : [
                    { kode: "72.03.10.2001", nama: "Dalaka" },
                    { kode: "72.03.10.2002", nama: "Alindau" },
                  ];
        setTimeout(() => selesai(null, baris), 0);
      },
    };
    const berkas = muatBot.resolve("./db_config");
    muatBot.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: dbPalsu } as unknown as NodeJS.Module;
    const layanan = muatBot("./services/sippWilayahService.js");

    const h = await layanan.daftarRingkas({ provinsi: "72" });
    expect(h).toEqual({
      ok: true,
      versi: 1,
      provinsi: { kode: "72", nama: "Sulawesi Tengah" },
      kab: [["72.03", "Kabupaten Donggala"]],
      kec: [["72.03.10", "Sindue"]],
      desa: { "72.03.10": [["2001", "Dalaka"], ["2002", "Alindau"]] },
    });
    expect(kueri.length).toBe(4);
    expect(kueri.every((k) => /^\s*SELECT/i.test(k.sql))).toBe(true);
    expect(kueri.every((k) => !/72/.test(k.sql.replace(/LIMIT \d+/, "")))).toBe(true); // nilai selalu parameter
    expect(kueri.slice(2).map((k) => k.nilai[0])).toEqual(["72.%", "72.%"]);
    await layanan.daftarRingkas({ provinsi: "72" });
    expect(kueri.length).toBe(4); // diingat
    expect((await layanan.daftarRingkas({ provinsi: "7x" })).ok).toBe(false);
    expect((await layanan.daftarRingkas({ provinsi: "72; DROP" })).ok).toBe(false);
    const rute = await layanan.jawabRute({ ringkas: "1", provinsi: "72" });
    expect(rute.status).toBe(200);
    expect((await layanan.jawabRute({ ringkas: "1", provinsi: "abc" })).status).toBe(400);
    for (const k of Object.keys(muatBot.cache)) if (k.startsWith(AKAR_BOT) && !k.includes("node_modules")) delete muatBot.cache[k];
  });
});
