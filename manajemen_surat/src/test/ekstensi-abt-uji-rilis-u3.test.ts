// @vitest-environment node
/**
 * ============================================================================
 * UJI RILIS 9 OKT 2026 - WILAYAH U3 PANEL ABT
 * ============================================================================
 *
 * Tiga cacat yang ditemukan dengan data dan kueri satker (MariaDB 5.5.68,
 * baca-saja) - abt.js dijalankan sungguhan di jsdom:
 *
 *   1. PETIK MENTAH MEMATAHKAN KUERI ABT. Abt_model::variabel_var_data
 *      mengganti #xxxx# di kueri data_sql dengan isi variabel tanpa escape.
 *      Diukur di satker: 5227 berpetik ganda -> 8521/8522/8528 ER_PARSE_ERROR;
 *      berpetik tunggal -> 8522/8529; berakhiran "\" -> 8521/8522/8528. ABT lalu
 *      die("ERROR Variabel #x#") dan SELURUH halaman blangko + CETAK berhenti.
 *      37 jawaban saksi satker memuat petik ganda, 89 petik tunggal - bahan
 *      usulan 5227. Sesudah dinetralkan (’ dan /): 0 galat.
 *   2. CETAK (tiga berkas) menyimpan halaman masuk / "ERROR Variabel" sebagai
 *      putusan .rtf - jalur satu perkara hanya memeriksa panjangnya.
 *   3. tipeData mengingat tipe "" dari halaman masuk (sesi ABT habis): variabel
 *      itu "bertipe tidak dikenal" sampai halaman dimuat ulang.
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
const JATI = { perkaraId: "10018", perkTemp: "T1" };

const HALAMAN_MASUK =
  '<html><head><title>Login</title></head><body><form action="login/signin" method="post">' +
  '<input type="text" name="username"><input type="password" name="password" class="form-control" required></form></body></html>';
const HALAMAN_GALAT_VARIABEL =
  "<h3>ERROR Variabel #8529#</h3>You have an error in your SQL syntax; check the manual that corresponds to your MariaDB " +
  "server version for the right syntax to use near 'Adathul (Kartu Tanda Penduduk)' REGEXP 'KTP|Kartu Tanda Penduduk' THEN";

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

type Minta = { url: string; cara: string; badan: string };
type Jawab = { status?: number; isi?: unknown; mentah?: string; jenis?: string };
type Pengganti = (url: string, cara: string, badan: string) => Jawab | undefined;

const ISI: Record<string, string> = {
  "0001": NOMOR,
  "0048": "Cerai Gugat",
  "0046": "Penggugat",
  "0047": "Tergugat",
  "5227": "Tergugat sering berkata kasar",
  "0222": "bulan November 2022",
  "0663": "01/10/2026",
  "8503": "F",
  "4020": "Pasal 19 huruf f",
};

function halamanHtml() {
  const baris = Object.keys(ISI)
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${ISI[k]}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`
    )
    .join("");
  return (
    `<div id="wrapper"><div id="content"><h3 class="w3l_header"><span>${NOMOR}</span></h3><h2>CG Verstek</h2>` +
    `<p class="cetak"><a id="cetak" href="${CETAK}">CETAK</a></p><table>${baris}</table></div></div>`
  );
}

function jawabBaku(url: string, cara: string, badan: string): Jawab {
  if (url.includes("/aleta-bot/abt/usulan")) {
    const muatan = JSON.parse(badan || "{}");
    if (muatan.sumber === "siapa") return { isi: { data: { available: true, pengguna: { nama: "Uji Hakim", peran: "Hakim" }, kapabilitas: {} } } };
    return { isi: { data: { available: true, sipp: { ok: true, usulan: [] }, saksi: { usulan: [], huruf: [] } } } };
  }
  if (url.includes("/aleta-bot/abt/pdf")) return { isi: { data: { available: true, pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64") } } };
  if (url.includes("/edit_data?")) {
    if (cara === "POST") return { mentah: "<b>DATA DISIMPAN</b>", jenis: "text/html" };
    const tipe = /no_var=0663/.test(url) ? "data_tanggal" : "data_teks";
    return { mentah: `<input type="hidden" name="var_type" value="${tipe}">`, jenis: "text/html" };
  }
  if (url.includes("/abt/preview")) return { mentah: "{\\rtf1\\ansi uji putusan " + "x".repeat(64) + "}", jenis: "application/vnd.ms-word" };
  if (url.includes("/aleta-ecourt/")) return { isi: { ok: true, data: {} } };
  if (url.includes("/aps_badilag/") && cara === "GET") return { mentah: "<html><body></body></html>", jenis: "text/html" };
  return { status: 404, isi: { ok: false, error: { message: "tidak ada" } } };
}

function tanggapan(j: Jawab) {
  const status = j.status ?? 200;
  if (j.mentah !== undefined) {
    return new Response(j.mentah, { status, headers: { "content-type": j.jenis || "text/plain" } });
  }
  return new Response(JSON.stringify(j.isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

type Halaman = { dom: JSDOM; w: any; u: any; minta: Minta[]; pesanLatar: any[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(ganti?: Pengganti, simpananAwal: Record<string, unknown> = {}, badanHtml?: string): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badanHtml ?? halamanHtml()}</body></html>`, {
    url: ALAMAT,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiFitur: {}, ujiIzinkanNyata: true, ...simpananAwal };
  const pesanLatar: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.188.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (p: unknown, balik?: (x: unknown) => void) => {
        pesanLatar.push(p);
        if (balik) balik({ ok: true });
      },
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
          for (const [k, v] of Object.entries(baru)) simpanan[k] = polos(v);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Minta[] = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    const b = typeof opsi?.body === "string" ? opsi.body : opsi?.body ? String(opsi.body) : "";
    minta.push({ url, cara, badan: b });
    return tanggapan((ganti && ganti(url, cara, b)) || jawabBaku(url, cara, b));
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.URL.createObjectURL = () => "blob:uji";
  w.URL.revokeObjectURL = () => undefined;
  w.document.addEventListener("click", (e: any) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a) e.preventDefault();
  });
  // panel-alat.js ber-"use strict": fungsinya tidak menjadi milik window -
  // yang diuji diserahkan lewat window.__uji (pola ekstensi-abt-tahap6).
  const ada = (n: string) => `${n}: typeof ${n} === "function" ? ${n} : () => { throw new Error("${n} tidak ada"); }`;
  w.eval(
    `${SUMBER_ALAT}\n;\n${SUMBER_ABT}\n;\nwindow.__uji = { ${[
      "a3NetralkanPetik",
      "a3SebabBukanAbt",
      "simpanVariabel",
      "terbitkanTigaBerkas",
      "terapkanUsulanBerurutan",
      "mintaPositaRapi",
      "sambungPecahanPosita",
      "bersihkanKeteranganSaksi",
    ]
      .map(ada)
      .join(", ")}, polaBukanPutusan: A3_POLA_BUKAN_PUTUSAN };\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`
  );
  return { dom, w, u: w.__uji, minta, pesanLatar };
}

const postEditData = (h: Halaman) => h.minta.filter((m) => m.cara === "POST" && m.url.includes("/edit_data?"));
const nilaiTerkirim = (m: Minta) => new URLSearchParams(m.badan).get("value");

// ============================================================================
describe("1. petik dan garis miring terbalik dinetralkan sebelum masuk ABT", () => {
  it("a3NetralkanPetik: ' dan \" menjadi ’, \\ menjadi /; teks lain (non-ASCII) tidak disentuh", () => {
    const h = buka();
    expect(h.u.a3NetralkanPetik(`Tergugat berkata "pergi kamu" ke rumah Ma'ruf\\`)).toBe("Tergugat berkata ’pergi kamu’ ke rumah Ma’ruf/");
    expect(h.u.a3NetralkanPetik("café — 2 kali; Penggugat’s ½")).toBe("café — 2 kali; Penggugat’s ½");
    expect(h.u.a3NetralkanPetik(null)).toBe("");
  });

  it("data_teks berpetik: yang dikirim ke edit_data sudah netral, dan pesannya menyebut penggantian", async () => {
    const h = buka();
    const hasil = await h.u.simpanVariabel("5227", `Tergugat berkata "pergi kamu" dan ke rumah Ma'ruf`, JATI);
    expect(hasil.ok).toBe(true);
    expect(hasil.pesan).toContain("petik diganti");
    expect(hasil.nilaiTersimpan).toBe("Tergugat berkata ’pergi kamu’ dan ke rumah Ma’ruf");
    const post = postEditData(h);
    expect(post).toHaveLength(1);
    expect(nilaiTerkirim(post[0])).toBe("Tergugat berkata ’pergi kamu’ dan ke rumah Ma’ruf");
    expect(nilaiTerkirim(post[0])).not.toMatch(/["'\\]/);
  });

  it("data_teks tanpa petik: dikirim apa adanya, pesan biasa", async () => {
    const h = buka();
    const hasil = await h.u.simpanVariabel("0222", "bulan November 2022 – sekarang", JATI);
    expect(hasil).toMatchObject({ ok: true, pesan: "tersimpan", nilaiTersimpan: "bulan November 2022 – sekarang" });
    expect(nilaiTerkirim(postEditData(h)[0])).toBe("bulan November 2022 – sekarang");
  });

  it("data_tanggal tidak dinetralkan - tetap disusun d/m/Y", async () => {
    const h = buka();
    const hasil = await h.u.simpanVariabel("0663", "2026-10-15", JATI);
    expect(hasil.ok).toBe(true);
    expect(nilaiTerkirim(postEditData(h)[0])).toBe("15/10/2026");
  });

  it("Input usulan berurutan: sel halaman dan riwayat memakai isi yang sungguh tersimpan", async () => {
    const h = buka();
    const centang = h.w.document.createElement("input");
    centang.type = "checkbox";
    centang.checked = true;
    const dipilih = [
      {
        usulan: { kode: "5227", nama: "Alasan", nilai: 'Tergugat berkata "kasar"', keyakinan: "yakin", sumber: [{ saksi: 1 }] },
        centang,
        nilai: () => 'Tergugat berkata "kasar"',
        disunting: () => false,
      },
    ];
    const r = await h.u.terapkanUsulanBerurutan(dipilih, JATI, () => {});
    expect(r).toMatchObject({ berhasil: 1, gagal: [] });
    expect(h.w.document.getElementById("5227").parentElement.children[2].textContent).toBe("Tergugat berkata ’kasar’");
  });
});

// ============================================================================
describe("2. jawaban ABT yang bukan RTF / bukan 'DATA DISIMPAN' disebut sebabnya", () => {
  it("a3SebabBukanAbt mengenali die ERROR Variabel dan halaman masuk", () => {
    const h = buka();
    expect(h.u.a3SebabBukanAbt(HALAMAN_GALAT_VARIABEL)).toContain("#8529#");
    expect(h.u.a3SebabBukanAbt(HALAMAN_GALAT_VARIABEL)).toMatch(/petik/);
    expect(h.u.a3SebabBukanAbt(HALAMAN_MASUK)).toContain("sesi ABT habis");
    expect(h.u.a3SebabBukanAbt("<html>lain</html>")).toBe("");
  });

  it("CETAK tiga berkas: pratinjau berbunyi 'ERROR Variabel' -> tidak ada .rtf/.pdf yang diterbitkan, sebabnya menyebut variabelnya", async () => {
    const h = buka((url) => (url.includes("/abt/preview") ? { mentah: HALAMAN_GALAT_VARIABEL, jenis: "text/html" } : undefined), {
      cetakTigaBerkas: true,
    });
    const laporan: string[] = [];
    const hasil = await h.u.terbitkanTigaBerkas(CETAK, JATI, (t: string) => laporan.push(t));
    await tunggu(300); // unduhBlob tidak ditunggu pemanggilnya
    expect(hasil.rtf).toMatch(/^gagal: ABT berhenti menghitung variabel #8529#/);
    expect(h.pesanLatar.filter((p) => p && p.jenis === "unduh")).toEqual([]);
    expect(h.minta.some((m) => m.url.includes("/aleta-bot/abt/pdf"))).toBe(false);
    expect(laporan.join("\n")).toContain("#8529#");
  });

  it("CETAK tiga berkas: sesi ABT habis (halaman masuk) -> tidak tersimpan sebagai putusan .rtf", async () => {
    const h = buka((url) => (url.includes("/abt/preview") ? { mentah: HALAMAN_MASUK, jenis: "text/html" } : undefined), {
      cetakTigaBerkas: true,
    });
    const hasil = await h.u.terbitkanTigaBerkas(CETAK, JATI, () => {});
    await tunggu(300); // unduhBlob tidak ditunggu pemanggilnya
    expect(hasil.rtf).toContain("sesi ABT habis");
    expect(h.pesanLatar.filter((p) => p && p.jenis === "unduh")).toEqual([]);
  });

  it("CETAK tiga berkas: RTF sah tetap diterbitkan (kemunduran dijaga)", async () => {
    const h = buka(undefined, { cetakTigaBerkas: true });
    const hasil = await h.u.terbitkanTigaBerkas(CETAK, JATI, () => {});
    await tunggu(300); // unduhBlob tidak ditunggu pemanggilnya
    expect(hasil.rtf).toBe("tersimpan");
    expect(hasil.pdf).toBe("tersimpan");
    expect(h.pesanLatar.filter((p) => p && p.jenis === "unduh").length).toBeGreaterThanOrEqual(2);
  });

  it("simpan saat sesi ABT habis: sebabnya 'sesi ABT habis', bukan 'jawaban tidak dikenali'", async () => {
    const h = buka((url, cara) => (url.includes("/edit_data?") && cara === "POST" ? { mentah: HALAMAN_MASUK, jenis: "text/html" } : undefined));
    const hasil = await h.u.simpanVariabel("5227", "Tergugat pergi", JATI);
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain("sesi ABT habis");
  });
});

// ============================================================================
describe("3. tipe variabel dari halaman masuk tidak diingat", () => {
  it("sesi habis saat membaca tipe -> galat 'sesi ABT habis'; sesudah masuk lagi, simpan berhasil tanpa muat ulang halaman", async () => {
    let sesiHabis = true;
    const h = buka((url, cara) =>
      sesiHabis && url.includes("/edit_data?") && cara === "GET" ? { mentah: HALAMAN_MASUK, jenis: "text/html" } : undefined
    );
    await expect(h.u.simpanVariabel("0222", "bulan Mei 2024", JATI)).rejects.toThrow(/sesi ABT habis/);
    expect(postEditData(h)).toEqual([]);
    sesiHabis = false;
    const hasil = await h.u.simpanVariabel("0222", "bulan Mei 2024", JATI);
    expect(hasil.ok).toBe(true);
    expect(nilaiTerkirim(postEditData(h)[0])).toBe("bulan Mei 2024");
  });
});

// ============================================================================
describe("4. label kegagalan posita tidak tertukar", () => {
  it("merapikan posita gagal -> 'Merapikan posita gagal'; menyambung kata gagal -> 'Menyambung kata gagal'", async () => {
    const h = buka((url) => (url.includes("/aleta-bot/sipp/posita") ? { status: 500, isi: { ok: false } } : undefined));
    const rapi = await h.u.mintaPositaRapi("10018", true);
    expect(rapi.ok).toBe(false);
    expect(rapi.pesan).toContain("Merapikan posita gagal");
    const sambung = await h.u.sambungPecahanPosita("10018", 0);
    expect(sambung.ok).toBe(false);
    expect(sambung.pesan).toContain("Menyambung kata gagal");
  });
});

// ============================================================================
describe("5. kalimat penutup saksi yang terbelah baris (data satker)", () => {
  it("'Sudah\ncukup;' (2 jawaban di satker) dibuang seperti 'Sudah cukup;'; jawaban berisi fakta tidak tersentuh", () => {
    const h = buka();
    expect(h.u.bersihkanKeteranganSaksi("Sudah\ncukup;")).toBe("");
    expect(h.u.bersihkanKeteranganSaksi("Sudah  cukup ;")).toBe("");
    // 17 Okt: "tidak sanggup lagi" hanya penutup bila pertanyaannya penutup (tanpa pertanyaan dibiarkan).
    expect(h.u.bersihkanKeteranganSaksi("Sudah tidak sanggup lagi.")).toBe("Sudah tidak sanggup lagi.");
    expect(h.u.bersihkanKeteranganSaksi("Sudah tidak sanggup lagi.", "Apakah masih ada yang ingin saudara sampaikan?")).toBe("");
    expect(h.u.bersihkanKeteranganSaksi("Sudah tidak sanggup lagi.", "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?")).toBe("Sudah tidak sanggup lagi.");
    expect(h.u.bersihkanKeteranganSaksi("Tergugat pergi sejak 2024;\nSudah cukup;")).toBe("Tergugat pergi sejak 2024;");
    expect(h.u.bersihkanKeteranganSaksi("Saksi sudah tidak sanggup lagi merukunkan keduanya;")).toBe(
      "Saksi sudah tidak sanggup lagi merukunkan keduanya;"
    );
  });
});

// ============================================================================
describe("7. halaman blangko yang dihentikan ABT ('ERROR Variabel #x#') diterangkan", () => {
  it("pesan SQL ABT mendapat keterangan sebab + cara memperbaiki; tidak ada tulisan ke ABT", async () => {
    const h = buka(undefined, {}, HALAMAN_GALAT_VARIABEL);
    const kotak = await (async () => {
      for (let i = 0; i < 300; i += 1) {
        const k = h.w.document.getElementById("aleta-abt-galat-variabel");
        if (k) return k;
        await tunggu(10);
      }
      return null;
    })();
    expect(kotak).not.toBeNull();
    expect(kotak.textContent).toContain("#8529#");
    expect(kotak.textContent).toMatch(/petik/);
    expect(h.minta.filter((m) => m.cara !== "GET")).toEqual([]);
    // Halaman blangko biasa tidak mendapat kotak ini.
    const biasa = buka();
    await tunggu(200);
    expect(biasa.w.document.getElementById("aleta-abt-galat-variabel")).toBeNull();
  });
});

// ============================================================================
describe("6. nama blangko satker yang BUKAN putusan (839 berkas _blangko_abt)", () => {
  const bukan = [
    "A.4.z Penetapan Penunjukkan Mediator",
    "E.1.a. Penetapan Aanmaning",
    "E.1.b. Penetapan Eksekusi Riil",
    "E.1.e. Penetapan Eksekusi Lelang",
    "E.1.f. Penetapan Pengangkatan Sita Jaminan (Telah Dilaksanakan Secara Sukarela)",
    "E.1.q. Penetapan Harga Limit",
    "F.1.b Penetapan titipan dari eksekusi lelang pihak tidak hadir",
    "A.4.b. Penetapan Perintah Pengumuman Isbat Nikah",
    "1.l Penetapan Perpanjangan Penahanan tahap pertamakedua dari  Ketua MS Aceh",
    "1.m Penetapan izin penyitaan barang bukti",
    "6.d Penetapan Ketua MS diversi berhasil di Pengadilan",
    "3.  Penetapan Ketua PA Donggala utk Prodeo",
    "P3HP 1P (Penetapan Ahli Waris)",
  ];
  const putusan = [
    "[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah",
    "[01] [Kabul] IN",
    "A.19. Putusan CT Dibatalkan Dari Pendaftaran",
    "A.23. Penetapan Cerai Gugat cabut Sebelum Jawaban prodeo DIPA",
    "A.51. Putusan CG Verstek, Prodeo DIPA",
    "CG Verstek-Prodeo",
    "IN 2 Pemohon (prodeo)",
    "Penetapan - IN 2P (Hakim Tunggal) - KTP",
  ];
  it("penetapan eksekusi/jinayat/pengumuman/prodeo ketua ditolak; nama putusan sungguhan (termasuk prodeo & pendaftaran) tidak", () => {
    const h = buka();
    const pola: RegExp = h.u.polaBukanPutusan;
    expect(bukan.filter((n) => !pola.test(n))).toEqual([]);
    expect(putusan.filter((n) => pola.test(n))).toEqual([]);
  });
});
