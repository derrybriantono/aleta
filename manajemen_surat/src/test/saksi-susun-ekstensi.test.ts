// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BORANG "SUSUN SAKSI MENURUT KEADAAN PERKARA" DI PANEL ABT
 * ============================================================================
 *
 * panel-alat.js, saksi-katalog.js, saksi-katalog-data.js, saksi-susun.js, dan
 * abt.js dimuat SUNGGUHAN ke halaman blangko jsdom, urutannya seperti di
 * manifest. Yang dijaga:
 *   - tombolnya muncul menurut JENIS PERKARA dari data SIPP (variabel 0048),
 *     bukan menurut variabel cerai: blangko yang jenisnya tidak punya katalog
 *     tidak mendapat tombol walau memuat variabel cerai;
 *   - tombol dan borang lama ("Input ke ABT", "Susun keterangan saksi 1 & 2")
 *     tetap ada pada blangko cerai;
 *   - borang menyusun 2 sampai 5 saksi dengan jenis keterangan masing-masing,
 *     dapat disunting, dan menyimpan lewat rute simpan ABT.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const SUMBER = [baca("panel-alat.js"), baca("saksi-katalog.js"), baca("saksi-katalog-data.js"), baca("saksi-susun.js"), baca("abt.js")].join("\n;\n");

const KODE_BLANGKO_CERAI = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0047 0222 5227 0246 9944 7035 1268 8503 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8505 0155 7095 8501 0032 0033".split(" ");

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

type Opsi = { isi?: Record<string, string>; mode?: string; fetch?: (alamat: string, o?: any) => Promise<any>; judul?: string; nomor?: string; simpanan?: Record<string, unknown> };

function buka(kode: string[], opsi: Opsi = {}) {
  const baris = kode
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td>` +
        `<td>${opsi.isi && k in opsi.isi ? opsi.isi[k] : `isi ${k}`}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>${opsi.judul ?? "Blangko"}</title></head><body><div id="wrapper"><div id="content">` +
      `<h3 class="w3l_header"><span>${opsi.nomor ?? "123/Pdt.G/2026/PA.Dgl"}</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halaman.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: opsi.mode ?? "baru", ...(opsi.simpanan || {}) };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.Response = globalThis.Response;
  w.fetch = opsi.fetch || (async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "", clone() { return this; } }));
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.eval(`${SUMBER}\n;\nwindow.__uji = { mode: () => alatUjiMode(), tahanPost: (nilai) => { alatCobaMenahan = () => nilai; } };`);
  return w;
}

const tunggu = async (kondisi: () => boolean, pesan: string) => {
  for (let i = 0; i < 300; i += 1) {
    if (kondisi()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};

const panelDari = async (w: any) => {
  await tunggu(() => Boolean(w.document.getElementById("aleta-panel-abt")), "panel ABT");
  return w.document.getElementById("aleta-panel-abt");
};
const tombolDi = (panel: any, teks: string) => Array.from(panel.querySelectorAll("button")).find((b: any) => b.textContent === teks) as any;
const TOMBOL = "Susun saksi menurut keadaan perkara";

describe("tombol Susun saksi menurut keadaan perkara - menurut jenis perkara", () => {
  it("cerai gugat (0048) tampak pada tampilan Baru; tombol lama tetap ada", async () => {
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Gugat" } });
    const panel = await panelDari(w);
    await tunggu(() => w.__uji.mode() === "baru", "mode baru");
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
    expect(tombolDi(panel, "Input ke ABT").hidden).toBe(false);
    expect(tombolDi(panel, "Susun keterangan saksi 1 & 2")).toBeTruthy();
    expect(tombolDi(panel, "Susun keterangan saksi 1 & 2").hidden).toBe(false);
  });

  it("cerai talak (0048) juga tampak", async () => {
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Talak" } });
    const panel = await panelDari(w);
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
  });

  it("jenis tanpa katalog TIDAK jatuh ke cerai - tersembunyi walau blangko memuat variabel cerai", async () => {
    for (const jenis of ["Zakat", "Perkara Rekaan", ""]) { // I28 18 Okt: Hibah kini punya katalog (366)
      const w = buka(KODE_BLANGKO_CERAI, { isi: jenis ? { "0048": jenis } : {} });
      const panel = await panelDari(w);
      await tunggu(() => w.__uji.mode() === "baru", "mode baru");
      await new Promise((r) => setTimeout(r, 80));
      expect(tombolDi(panel, TOMBOL).hidden, `jenis "${jenis}"`).toBe(true);
    }
  });

  it("alur permohonan (Pdt.P) dengan jenis cerai gugat tidak mendapat katalog cerai gugat", async () => {
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Gugat" }, nomor: "55/Pdt.P/2026/PA.Dgl" });
    const panel = await panelDari(w);
    await tunggu(() => w.__uji.mode() === "baru", "mode baru");
    await new Promise((r) => setTimeout(r, 80));
    expect(tombolDi(panel, TOMBOL).hidden).toBe(true);
  });

  it("tampilan Lama tidak berubah sama sekali: tombolnya tersembunyi", async () => {
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Gugat" }, mode: "lama" });
    const panel = await panelDari(w);
    await new Promise((r) => setTimeout(r, 120));
    expect(tombolDi(panel, TOMBOL).hidden).toBe(true);
    expect(tombolDi(panel, "Susun keterangan saksi 1 & 2")).toBeTruthy();
  });
});

describe("tombol Susun saksi di tampilan Baru dengan akun berperan (menu per peran)", () => {
  // Regresi 18 Okt: tombol katalog disisipkan di antara "Susun keterangan saksi" dan "Riwayat", sehingga pemetaan
  // tombol menurut urutan menggeser riwayat dan rapikan satu tempat; tombol katalog terhitung "tombol lama" dan
  // disembunyikan (data-sore-tampak="tidak") bagi semua akun berperan - tidak terlihat sama sekali di layar.
  const SIAPA = { data: { available: true, pengguna: { nama: "Pengguna Contoh", peran: "Super Admin" }, kapabilitas: {} } };
  const fetchAkun = async (alamat: string, o?: any) => {
    const jawab = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
    if (/aleta-bot\/abt\/usulan/.test(alamat)) {
      let m: any = {};
      try {
        m = JSON.parse((o && o.body) || "{}");
      } catch {
        m = {};
      }
      return jawab(m.sumber === "siapa" ? SIAPA : { data: { available: true } });
    }
    return jawab({ ok: false }, 404);
  };

  for (const mode of ["baru", "ui"]) {
    it(`tampilan ${mode}: tombol katalog tidak ikut disembunyikan sebagai tombol lama`, async () => {
      const fitur = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`abt-${i + 1}`, true]));
      const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Gugat" }, mode, fetch: fetchAkun, simpanan: { ujiFitur: fitur, ujiIzinkanNyata: true } });
      const panel = await panelDari(w);
      await tunggu(() => w.__uji.mode() === mode, `mode ${mode}`);
      await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
      // beri waktu penataan peran (akun datang menyusul) sebelum memeriksa
      await new Promise((r) => setTimeout(r, 700));
      const tombol = tombolDi(panel, TOMBOL);
      expect(tombol.getAttribute("data-sore-tampak")).not.toBe("tidak");
    });
  }
});

describe("borang menyusun saksi", () => {
  async function bukaBorang(opsi: Opsi = {}) {
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat", "1241": "ibu kandung", "1242": "tetangga", "0222": "Maret 2023", "5227": "tidak memberi nafkah dan sering bertengkar", "0246": "Januari 2024", "9944": "1 (satu) tahun", "7035": "Tergugat", "1268": "pihak keluarga telah berusaha mendamaikan namun tidak berhasil", "8503": "F", ...(opsi.isi ?? {}) }, judul: opsi.judul, fetch: opsi.fetch });
    const panel = await panelDari(w);
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
    tombolDi(panel, TOMBOL).click();
    await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "borang");
    return { w, panel };
  }

  it("memuat keadaan, jumlah saksi, dan jenis keterangan per saksi", async () => {
    const { panel } = await bukaBorang();
    const teks = panel.querySelector(".aleta-ssk").textContent;
    expect(teks).toContain("Susun saksi - Cerai gugat");
    expect(teks).toContain("Keadaan perkara");
    expect(teks).toContain("Jumlah saksi");
    expect(teks).toContain("Ragu atau tidak yakin");
    expect(teks).toContain("Tahu dari cerita orang lain");
    expect(teks).toContain("Hanya sebagian yang diketahui");
    expect(teks).not.toMatch(/aleta/i);
  });

  it("menyusun 3 saksi: tiap butir berbeda antar saksi, jenis ragu bertanda kuning, dan bisa disunting", async () => {
    const { w, panel } = await bukaBorang();
    const wadah = panel.querySelector(".aleta-ssk");
    const pilihan = Array.from(wadah.querySelectorAll("select")) as any[];
    const jumlah = pilihan.find((s) => Array.from(s.options).some((o: any) => o.value === "5") && Array.from(s.options).some((o: any) => o.value === "2"));
    jumlah.value = "3";
    jumlah.dispatchEvent(new w.Event("change"));
    const jenisSaksi = () => Array.from(wadah.querySelectorAll(".aleta-sdg-modus")).map((b: any) => Array.from(b.querySelectorAll("select")).find((s: any) => Array.from(s.options).some((o: any) => o.value === "ragu")) as any);
    const j = jenisSaksi();
    expect(j).toHaveLength(3);
    j[1].value = "ragu";
    j[1].dispatchEvent(new w.Event("change"));
    j[2].value = "de-auditu";
    j[2].dispatchEvent(new w.Event("change"));

    const susun = tombolDi(wadah, "Susun pertanyaan dan jawaban");
    susun.click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 3, "tiga saksi tersusun");
    const kolom = Array.from(wadah.querySelectorAll(".aleta-ssk-saksi")) as any[];
    const jawabDi = (i: number, butir: string) => (kolom[i].querySelector(`.aleta-ssk-baris[data-butir="${butir}"] textarea`) as any).value as string;
    const semua = [0, 1, 2].map((i) => jawabDi(i, "q-penyebab"));
    expect(new Set(semua).size).toBe(3);
    expect(kolom[1].querySelector('.aleta-ssk-baris[data-butir="q-cara-tahu"]').classList.contains("aleta-ssk-kuning")).toBe(true);
    expect(kolom[0].querySelector('.aleta-ssk-baris[data-butir="q-cara-tahu"]').classList.contains("aleta-ssk-kuning")).toBe(false);
    expect(jawabDi(2, "q-cara-tahu")).toMatch(/cerita|diberi tahu|penuturan|dikabari|mendengar dari/i);
    // variabel perkara terisi (bukan ditebak) dan tidak ada penanda yang tersisa
    expect(jawabDi(0, "q-penyebab")).toContain("tidak memberi nafkah dan sering bertengkar");
    expect(jawabDi(0, "q-kenal")).toContain("ibu kandung");
    expect(jawabDi(1, "q-kenal")).toContain("tetangga");
    const nilaiJawab = Array.from(wadah.querySelectorAll("textarea")).map((x: any) => x.value as string);
    expect(nilaiJawab.length).toBeGreaterThan(20);
    expect(nilaiJawab.filter((v) => /#\d{4}#|\{[a-z]+\}/i.test(v))).toEqual([]);
    // verstek / kontradiktoir diturunkan dari nama blangko; bawaan kontradiktoir
    expect(kolom[0].querySelector('.aleta-ssk-baris[data-butir="q-upaya-keluarga"]')).toBeTruthy();
    // menyunting satu jawaban tidak terhapus oleh mengubah jenis butir lain
    const t = kolom[0].querySelector('.aleta-ssk-baris[data-butir="q-kenal"] textarea');
    t.value = "disunting petugas";
    const barisPenyebab = kolom[0].querySelector('.aleta-ssk-baris[data-butir="q-penyebab"]');
    const pilihButir = barisPenyebab.querySelector("select.aleta-ssk-jenis-butir");
    pilihButir.value = "tidak-tahu";
    pilihButir.dispatchEvent(new w.Event("change"));
    expect(barisPenyebab.querySelector("textarea").value).toMatch(/tidak/);
    expect(t.value).toBe("disunting petugas");
  });

  it("isian yang belum terisi disebut dengan nama manusiawi: teks tampil tanpa kode #nnnn#, kode hanya di title", async () => {
    const { w, panel } = await bukaBorang({ isi: { "5227": "DATA_TIDAK_ADA", "0222": "DATA_TIDAK_ADA" } });
    // satu variabel diberi nama yang dapat dibaca (seperti kolom nama di halaman ABT), yang lain tanpa nama
    (w.document.getElementById("5227") as any).nextElementSibling.textContent = "Penyebab perselisihan";
    const wadah = panel.querySelector(".aleta-ssk");
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi tersusun");
    const kabar = Array.from(wadah.querySelectorAll(".aleta-abt-gagal")) as any[];
    const kosong = kabar.filter((x) => /Belum terisi dari data perkara|titik-titik isian/.test(x.textContent));
    expect(kosong.length).toBeGreaterThan(0);
    for (const x of kosong) {
      expect(x.textContent, x.textContent).not.toMatch(/#\d{4}#/);
      expect(x.textContent).not.toMatch(/\{[^}]*\}/);
    }
    expect(kosong.some((x) => /Penyebab perselisihan/.test(x.textContent))).toBe(true);
    expect(kosong.some((x) => /satu isian|isian lain/.test(x.textContent))).toBe(true);
    expect(kosong.some((x) => /Kode isian: .*5227/.test(x.getAttribute("title") || ""))).toBe(true);
    // seluruh teks tampil form (di luar nilai kotak isian) dan nilai jawaban tidak memuat kode variabel mentah
    expect(wadah.textContent).not.toMatch(/#\d{4}#/);
    const nilai = (Array.from(wadah.querySelectorAll("textarea")) as any[]).map((x) => x.value as string);
    expect(nilai.filter((v) => /#\d{4}#/.test(v))).toEqual([]);
  });

  it("nama blangko Verstek menurunkan keadaan verstek", async () => {
    const { panel } = await bukaBorang({ judul: "[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)" });
    const wadah = panel.querySelector(".aleta-ssk");
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi tersusun");
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-upaya-keluarga-verstek"]')).toBeTruthy();
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-upaya-keluarga"]')).toBeNull();
  });

  it("menyimpan lewat rute simpan ABT: satu permintaan per saksi dengan jawaban hasil sunting, tanpa kata Aleta", async () => {
    const permintaan: Array<{ alamat: string; badan: string }> = [];
    const fetchTiruan = async (alamat: string, o?: any) => {
      if (o && o.method === "POST") {
        if (/tanyajawab_perkara_edit/.test(alamat)) permintaan.push({ alamat, badan: String(o.body) });
        return { ok: true, status: 200, text: async () => "Tanya Jawab Disimpan", json: async () => ({}), clone() { return this; } };
      }
      return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    };
    const { w, panel } = await bukaBorang({ fetch: fetchTiruan });
    w.__uji.tahanPost(false); // mode coba tidak boleh menahan penyimpanan di uji ini
    const wadah = panel.querySelector(".aleta-ssk");
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi tersusun");
    // 23 Okt (T2, keputusan pengguna): butir penutup tidak lagi ditampilkan; suntingan petugas diuji pada baris terakhir yang tampil
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-penutup"]')).toBeNull();
    const semuaBaris = wadah.querySelector(".aleta-ssk-saksi").querySelectorAll(".aleta-ssk-baris textarea");
    const t = semuaBaris[semuaBaris.length - 1];
    t.value = "keterangan terakhir disunting petugas";
    const simpan = tombolDi(wadah, "Simpan ke ABT");
    expect(simpan.hidden).toBe(false);
    simpan.click();
    try {
      await tunggu(() => permintaan.length === 2, "dua permintaan simpan");
    } catch (e) {
      const kabar = Array.from(wadah.querySelectorAll(".aleta-sdg-form > .aleta-abt-kabar")).map((x: any) => x.textContent).join(" | ");
      throw new Error(`${(e as Error).message}; permintaan=${permintaan.length}; kabar=${kabar}`);
    }
    expect(permintaan[0].alamat).toContain("no_var=2021");
    expect(permintaan[1].alamat).toContain("no_var=2022");
    const data0 = JSON.parse(new URLSearchParams(permintaan[0].badan).get("data") as string);
    expect(data0.length).toBeGreaterThanOrEqual(10);
    expect(data0[data0.length - 1].jawab).toBe("keterangan terakhir disunting petugas");
    expect(data0.some((b: any) => /^(?:saya\s+)?sudah\s+cukup/i.test(b.jawab))).toBe(false);
    expect(JSON.stringify(permintaan)).not.toMatch(/aleta/i);
    expect(JSON.stringify(data0)).not.toMatch(/ya, |sayang/i);
    w.close;
  });
});

describe("tab keterangan anak, calon, dan orang tua (dispensasi kawin)", () => {
  async function bukaDk(isi: Record<string, string> = {}) {
    const w = buka([...KODE_BLANGKO_CERAI, "0600", "0606", "0601", "0607", "0999"], { isi: { "0048": "Dispensasi Kawin", "0600": "Budi", "0606": "Siti", "0601": "20 (dua puluh) tahun", "0607": "16 (enam belas) tahun", "0999": "2 (dua) bulan", ...isi }, nomor: "5/Pdt.P/2026/PA.Dgl", judul: "[1] BAS DK - Anak Perempuan Hamil" });
    const panel = await panelDari(w);
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
    tombolDi(panel, TOMBOL).click();
    await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "form");
    return { w, panel, wadah: panel.querySelector(".aleta-ssk") as any };
  }
  const tab = (wadah: any, nilai: string) => wadah.querySelector(`.aleta-ssk-tab-tombol[data-tab="${nilai}"]`) as any;

  it("dispensasi kawin punya dua tab; cerai gugat tidak punya tab keterangan", async () => {
    const { wadah } = await bukaDk();
    expect(tab(wadah, "saksi")).toBeTruthy();
    expect(tab(wadah, "keterangan").textContent).toBe("Keterangan anak, calon, dan orang tua");
    expect(tab(wadah, "saksi").getAttribute("aria-pressed")).toBe("true");
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Cerai Gugat" } });
    const panel = await panelDari(w);
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
    tombolDi(panel, TOMBOL).click();
    await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "form cerai");
    expect(panel.querySelector(".aleta-ssk-tab-tombol")).toBeNull();
  });

  it("tab keterangan: kartu empat peran, konfirmasi kehamilan bawaan mati, susun, dan salin", async () => {
    const { w, wadah } = await bukaDk();
    tab(wadah, "keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-kartu").length === 4, "empat kartu peran");
    const teksForm = wadah.textContent as string;
    expect(teksForm).toContain("Orang tua atau wali anak");
    expect(teksForm).not.toMatch(/aleta|borang|peladen|galat|template/i);
    const pilihSebab = (Array.from(wadah.querySelectorAll("select")) as any[]).find((s) => Array.from(s.options).some((o: any) => o.value === "hubungan-badan"));
    pilihSebab.value = "hamil";
    pilihSebab.dispatchEvent(new w.Event("change"));
    await tunggu(() => Boolean(wadah.querySelector(".aleta-ssk-konfirmasi input")), "kotak konfirmasi");
    expect(wadah.querySelector(".aleta-ssk-konfirmasi input").checked).toBe(false);
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length >= 4, "pemberi keterangan tersusun");
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hamil-diri"]')).toBeNull();
    expect(wadah.textContent).toContain("belum ikut disusun");
    const nilai = (Array.from(wadah.querySelectorAll("textarea")) as any[]).map((x) => x.value as string);
    expect(nilai.filter((v) => /#\d{4}#|\{[a-z]+\}/i.test(v))).toEqual([]);
    expect(nilai.join(" ")).toContain("16 (enam belas) tahun");
    wadah.querySelector(".aleta-ssk-konfirmasi input").click();
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => Boolean(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hamil-diri"]')), "butir kehamilan setelah konfirmasi");
    tombolDi(wadah, "Salin semua tanya-jawab ke BAS").click();
    await tunggu(() => Boolean(wadah.querySelector(".aleta-ssk-salin-teks")), "kotak salin");
    expect(wadah.querySelector(".aleta-ssk-salin-teks").value).toMatch(/ \?.+;/);
  });

  // Keputusan pengguna 18 Okt (no. 65): butir kehamilan dan hubungan badan mengikuti posita; centang petugas menang.
  const POSITA_HAMIL = "Bahwa anak Pemohon bernama Siti sekarang sedang hamil 2 (dua) bulan dari calon suaminya, sehingga perkawinan perlu segera dilaksanakan;";
  const POSITA_BIASA = "Bahwa anak Pemohon bernama Siti berumur 16 tahun dan ingin menikah dengan calon suaminya Budi yang telah bekerja tetap;";

  it("posita menyebut calon istri hamil: kotak konfirmasi tercentang sendiri bertuliskan 'menurut posita', dan butir kehamilan ikut disusun", async () => {
    const { wadah } = await bukaDk({ "5125": POSITA_HAMIL });
    tab(wadah, "keterangan").click();
    await tunggu(() => Boolean(wadah.querySelector(".aleta-ssk-konfirmasi input")), "kotak konfirmasi muncul tanpa memilih latar belakang");
    const kotak = wadah.querySelector(".aleta-ssk-konfirmasi") as any;
    expect(kotak.querySelector("input").checked).toBe(true);
    expect(kotak.textContent).toContain("menurut posita");
    expect(kotak.textContent).not.toMatch(/\b5125\b|#\d{4}#/);
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => Boolean(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hamil-diri"]')), "butir kehamilan tersusun tanpa centang manual");
    expect(wadah.textContent).not.toContain("belum ikut disusun");
  });

  it("posita tidak menyebut kehamilan atau hubungan badan: tetap mati, tidak ada kotak konfirmasi dan tidak ada butirnya", async () => {
    const { wadah } = await bukaDk({ "5125": POSITA_BIASA });
    tab(wadah, "keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-kartu").length === 4, "empat kartu peran");
    expect(wadah.querySelector(".aleta-ssk-konfirmasi")).toBeNull();
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length >= 4, "pemberi keterangan tersusun");
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hamil-diri"]')).toBeNull();
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hubungan-badan-diri"]')).toBeNull();
  });

  it("posita yang menyangkal ('tidak hamil', 'belum pernah berhubungan badan') tidak mencentang apa pun", async () => {
    const { wadah } = await bukaDk({ "5125": "Bahwa anak Pemohon tidak hamil dan belum pernah berhubungan badan dengan calon suaminya, namun keduanya sudah bertunangan;" });
    tab(wadah, "keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-kartu").length === 4, "empat kartu peran");
    expect(wadah.querySelector(".aleta-ssk-konfirmasi")).toBeNull();
  });

  it("centang manual menang: petugas mencabut centang otomatis, butir ditahan; mencentang lagi menyalakannya; keterangan sumber hilang", async () => {
    const { wadah } = await bukaDk({ "5125": POSITA_HAMIL });
    tab(wadah, "keterangan").click();
    await tunggu(() => Boolean(wadah.querySelector(".aleta-ssk-konfirmasi input")), "kotak konfirmasi");
    const cb = wadah.querySelector(".aleta-ssk-konfirmasi input") as any;
    expect(cb.checked).toBe(true);
    cb.click();
    expect(cb.checked).toBe(false);
    expect((wadah.querySelector(".aleta-ssk-sumber") as any).hidden).toBe(true);
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length >= 4, "pemberi keterangan tersusun");
    expect(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hamil-diri"]')).toBeNull();
    expect(wadah.textContent).toContain("belum ikut disusun");
    cb.click();
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => Boolean(wadah.querySelector('.aleta-ssk-baris[data-butir="q-kt-hamil-diri"]')), "butir kehamilan setelah dicentang petugas");
  });

  it("kartu: orang tua 2 orang menjadi ayah dan ibu terpisah; calon tidak hadir tidak diperiksa", async () => {
    const { w, wadah } = await bukaDk();
    tab(wadah, "keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-kartu").length === 4, "empat kartu");
    const kartu = (kode: string) => wadah.querySelector(`.aleta-ssk-kartu[data-peran="${kode}"]`) as any;
    const ubah = (el: any, nilaiBaru: string) => {
      el.value = nilaiBaru;
      el.dispatchEvent(new w.Event("change"));
    };
    ubah(Array.from(kartu("orangTuaAnak").querySelectorAll("select")).find((s: any) => Array.from(s.options).some((o: any) => o.value === "2")), "2");
    await tunggu(() => kartu("orangTuaAnak").querySelectorAll(".aleta-ssk-pemberi").length === 2, "dua pemberi");
    ubah(kartu("calon").querySelector("select"), "tidak");
    await tunggu(() => kartu("calon").querySelectorAll(".aleta-ssk-pemberi").length === 0, "calon tidak hadir");
    tombolDi(wadah, "Susun tanya-jawab keterangan").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 4, "anak, ayah, ibu, orang tua calon");
    const label = (Array.from(wadah.querySelectorAll(".aleta-ssk-saksi")) as any[]).map((k) => k.querySelector(".aleta-abt-label").textContent as string);
    expect(label.some((l) => /ayah/.test(l))).toBe(true);
    expect(label.some((l) => /ibu/.test(l))).toBe(true);
    expect(label.some((l) => /^Calon suami atau istri -/.test(l))).toBe(false);
  });
});

describe("saksi diajukan oleh Penggugat atau Tergugat (harta bersama, versi Tergugat)", () => {
  it("pilihan 'Diajukan oleh' per saksi; saksi Tergugat tanpa bantahan diingatkan, dengan bantahan mendapat butir versi Tergugat", async () => {
    const w = buka(KODE_BLANGKO_CERAI, { isi: { "0048": "Harta Bersama", "0046": "Penggugat", "0047": "Tergugat" }, nomor: "7/Pdt.G/2026/PA.Dgl", judul: "BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P" });
    const panel = await panelDari(w);
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog tampak");
    tombolDi(panel, TOMBOL).click();
    await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "form");
    const wadah = panel.querySelector(".aleta-ssk");
    expect(wadah.textContent).toContain("Diajukan oleh Penggugat");
    expect(wadah.textContent).toContain("menerangkan versi Tergugat");
    const pilihPihak = () => (Array.from(wadah.querySelectorAll(".aleta-sdg-modus")) as any[])[1].querySelector("select");
    let sel = pilihPihak();
    sel.value = "T";
    sel.dispatchEvent(new w.Event("change"));
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");
    expect(wadah.textContent).toMatch(/belum menerangkan versinya/);
    const cb = (Array.from(wadah.querySelectorAll(".aleta-sdg-centang")) as any[]).find((c) => /harta sudah dibagi/.test(c.textContent));
    expect(cb, "centang bantahan sudah dibagi").toBeTruthy();
    cb.querySelector("input").click();
    await tunggu(() => !wadah.querySelector(".aleta-ssk-saksi"), "form tergambar ulang");
    sel = pilihPihak();
    sel.value = "T";
    sel.dispatchEvent(new w.Event("change"));
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi lagi");
    const kolom = Array.from(wadah.querySelectorAll(".aleta-ssk-saksi")) as any[];
    expect(kolom[1].querySelector('.aleta-ssk-baris[data-butir="q-tg-sudah-dibagi"]')).toBeTruthy();
    expect(kolom[1].querySelector('.aleta-ssk-baris[data-butir="q-belum-terbagi"]')).toBeNull();
    expect(kolom[0].querySelector('.aleta-ssk-baris[data-butir="q-belum-terbagi"]')).toBeTruthy();
    expect(kolom[0].querySelector('.aleta-ssk-baris[data-butir="q-tg-sudah-dibagi"]')).toBeNull();
    expect(wadah.textContent).not.toMatch(/aleta|borang|peladen|galat/i);
  });
});
