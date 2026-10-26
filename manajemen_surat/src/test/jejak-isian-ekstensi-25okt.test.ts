// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, C1: JEJAK ISIAN DAN BUTIR SAKSI, SISI EKSTENSI (U1 + U6)
 * ============================================================================
 *
 * jejak-isian.js, saksi-susun.js, abt.js (jalur cerai lama dan riwayat), dan pengisi jawaban bot
 * dijalankan SUNGGUHAN di jsdom / node; jaringan ABT dan portal ditiru di fetch. Yang dijaga:
 *   1. pembantu jejak-isian.js: saklar bertanya, mengingat, gagal = mati; kirim dipecah 60; tak pernah melempar
 *   2. kodePola dari pengisi jawaban saksi bot (bawa id pola kalimat yang mengubah teks)
 *   3. saksi-susun (katalog): saklar mati = tidak satu pun permintaan jejak; menyala = satu butir per baris
 *      (usulan vs final, katalog/butir/varian/pola, hapus = teks final kosong)
 *   4. jalur cerai lama (abt.js): butir tercatat sesudah tersimpan, usulan = jawaban awal mesin
 *   5. riwayat Urungkan (abt.js): catatan server yang LENGKAP dari PC lain dapat dikembalikan dengan konfirmasi dua
 *      langkah; yang terpotong / sudah dikembalikan tidak; saklar mati = daftar seperti dulu
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const JEJAK = baca("jejak-isian.js");

const halaman: JSDOM[] = [];
afterEach(async () => {
  await new Promise((s) => setTimeout(s, 30));
  while (halaman.length) halaman.pop()!.window.close();
});

const tunggu = async <T>(cari: () => T | null | undefined | false, pesan: string, batas = 400): Promise<T> => {
  for (let i = 0; i < batas; i += 1) {
    const x = cari();
    if (x) return x;
    await new Promise((s) => setTimeout(s, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};
const jeda = (ms: number) => new Promise((s) => setTimeout(s, ms));

const jawab = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
const html = (status: number, badan: string) => ({ ok: status >= 200 && status < 300, status, text: async () => badan, json: async () => JSON.parse(badan), clone() { return this; } });

// ─── Portal tiruan: saklar + penampung ───────────────────────────────────────

type Portal = {
  aktif: boolean | "galat" | "jaringan";
  tanya: number;
  isian: Array<Record<string, any>>;
  butir: Array<Record<string, any>>;
  jejakPerkara: Array<Record<string, any>>;
  riwayat: Array<Record<string, any>>;
};
const portalBaru = (aktif: Portal["aktif"] = false): Portal => ({ aktif, tanya: 0, isian: [], butir: [], jejakPerkara: [], riwayat: [] });

/** Menjawab rute portal jejak; undefined bila alamatnya bukan milik jejak. */
function jawabPortal(p: Portal, alamat: string, o: any = {}) {
  if (!/\/aleta\/api\/aleta-ecourt\/(jejak-isian|saksi-butir|abt-riwayat)/.test(alamat)) return undefined;
  const cara = String(o.method || "GET").toUpperCase();
  if (/jejak-isian\?bagian=saklar/.test(alamat)) {
    p.tanya += 1;
    if (p.aktif === "jaringan") throw new Error("jaringan putus");
    if (p.aktif === "galat") return jawab({ ok: false }, 500);
    return jawab({ ok: true, data: { aktif: p.aktif } });
  }
  if (/jejak-isian\?perkaraId=/.test(alamat)) return jawab({ ok: true, data: { aktif: p.aktif === true, ada: p.jejakPerkara.length > 0, daftar: p.aktif === true ? p.jejakPerkara : [] } });
  if (/abt-riwayat/.test(alamat)) {
    if (cara === "POST") {
      p.riwayat.push(JSON.parse(String(o.body || "{}")));
      return jawab({ ok: true, data: { ok: true, tercatat: 1 } });
    }
    return jawab({ ok: true, data: { ada: false, daftar: [] } });
  }
  if (cara === "POST") {
    const badan = JSON.parse(String(o.body || "{}"));
    const sasaran = /saksi-butir/.test(alamat) ? p.butir : p.isian;
    sasaran.push(...(badan.daftar || []));
    return jawab({ ok: true, data: { aktif: p.aktif === true, dicatat: (badan.daftar || []).length } });
  }
  return jawab({ ok: false }, 404);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. PEMBANTU jejak-isian.js
// ═════════════════════════════════════════════════════════════════════════════

function bukaPembantu(p: Portal) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/view", runScripts: "outside-only" });
  halaman.push(dom);
  const w = dom.window as any;
  const permintaan: Array<{ alamat: string; cara: string }> = [];
  w.fetch = async (alamat: string, o: any = {}) => {
    permintaan.push({ alamat: String(alamat), cara: String(o.method || "GET") });
    return jawabPortal(p, String(alamat), o) ?? jawab({ ok: false }, 404);
  };
  w.eval(JEJAK);
  return { w, J: w.AletaJejakIsian, permintaan };
}

describe("pembantu jejak-isian.js", () => {
  it("saklar mati: aktif() false, catat tidak mengirim apa pun, jejakPerkara kosong", async () => {
    const p = portalBaru(false);
    const { J, permintaan } = bukaPembantu(p);
    expect(J.aktifSegera()).toBeNull();
    expect(await J.aktif()).toBe(false);
    expect(await J.catatIsian({ perkaraId: "1", kode: "0222" })).toEqual({ aktif: false, dicatat: 0 });
    expect(await J.catatButir([{ perkaraId: "1" }])).toEqual({ aktif: false, dicatat: 0 });
    expect(await J.jejakPerkara("1")).toEqual([]);
    expect(permintaan.filter((x) => x.cara === "POST")).toEqual([]);
    expect(permintaan.filter((x) => /perkaraId=/.test(x.alamat))).toEqual([]);
  });

  it("jawaban saklar diingat: sekali bertanya untuk banyak panggilan; lupakan() menanyakan lagi", async () => {
    const p = portalBaru(true);
    const { J } = bukaPembantu(p);
    await Promise.all([J.aktif(), J.aktif(), J.aktif()]);
    expect(p.tanya).toBe(1);
    expect(J.aktifSegera()).toBe(true);
    await J.aktif();
    expect(p.tanya).toBe(1);
    J.lupakan();
    await J.aktif();
    expect(p.tanya).toBe(2);
  });

  it("gagal bertanya (500 atau jaringan putus) = MATI, tidak melempar, dan tidak mengirim", async () => {
    for (const keadaan of ["galat", "jaringan"] as const) {
      const p = portalBaru(keadaan);
      const { J, permintaan } = bukaPembantu(p);
      expect(await J.aktif()).toBe(false);
      await expect(J.catatIsian({ perkaraId: "1", kode: "1" })).resolves.toEqual({ aktif: false, dicatat: 0 });
      expect(permintaan.some((x) => x.cara === "POST")).toBe(false);
    }
  });

  it("saklar menyala: catatIsian mengirim ke rute jejak-isian dan catatButir ke saksi-butir; dipecah 60", async () => {
    const p = portalBaru(true);
    const { J, permintaan } = bukaPembantu(p);
    await J.catatIsian({ perkaraId: "1", kode: "0222", nilaiFinal: "x" });
    expect(p.isian).toHaveLength(1);
    const banyak = Array.from({ length: 130 }, (_, i) => ({ perkaraId: "1", nomorButir: i + 1 }));
    await J.catatButir(banyak);
    expect(p.butir).toHaveLength(130);
    const kirimButir = permintaan.filter((x) => x.cara === "POST" && /saksi-butir/.test(x.alamat));
    expect(kirimButir).toHaveLength(3); // 60 + 60 + 10
  });

  it("jejakPerkara dan keRiwayat: bentuk catatan riwayat, lengkap dan dapat dikembalikan hanya bila server berkata begitu", async () => {
    const p = portalBaru(true);
    p.jejakPerkara = [
      { id: "j1", perkaraId: "10018", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", kode: "5125", nama: "Posita", nilaiSebelum: "lama", nilaiFinal: "baru", cara: "diubah", pada: "2026-10-25T03:00:00.000Z", sebelumDipotong: false, bisaDiurungkan: true, olehNama: "Budi" },
      { id: "j2", perkaraId: "10018", kode: "0222", nilaiSebelum: "x", nilaiFinal: "y", cara: "diurungkan", pada: "2026-10-25T03:01:00.000Z", sebelumDipotong: true, bisaDiurungkan: false },
    ];
    const { J } = bukaPembantu(p);
    const daftar = (await J.jejakPerkara("10018")).map((b: any) => J.keRiwayat(b));
    expect(daftar[0]).toMatchObject({ kode: "5125", sebelum: "lama", sesudah: "baru", cara: "usulan diubah petugas", dariPeladen: false, dariServerLengkap: true, utuh: true, bisaDiurungkan: true, idJejak: "j1", oleh: "Budi" });
    expect(daftar[1]).toMatchObject({ cara: "dikembalikan", dariPeladen: true, utuh: false, dipotong: true, bisaDiurungkan: false });
  });

  it("tentukanCara: otomatis, diurungkan, saran diterima, diubah, diubah-otomatis, diketik; pembanding dapat diganti", () => {
    const { J } = bukaPembantu(portalBaru(false));
    expect(J.tentukanCara({ ditulisOtomatis: true, usulan: "a", final: "a" })).toBe("otomatis");
    expect(J.tentukanCara({ urungkan: true, usulan: "a", final: "b" })).toBe("diurungkan");
    expect(J.tentukanCara({ usulan: "Sejak  2019", final: "sejak 2019" })).toBe("saran-diterima");
    expect(J.tentukanCara({ usulan: "2019", final: "2020" })).toBe("diubah");
    expect(J.tentukanCara({ usulan: "2019", final: "2020", usulanDariOtomatis: true })).toBe("diubah-otomatis");
    expect(J.tentukanCara({ usulan: "", final: "2020" })).toBe("diketik");
    expect(J.tentukanCara({ usulan: "F · uraian", final: "F" }, (a: string, b: string) => a.slice(0, 1) === b)).toBe("saran-diterima");
    expect(J.penandaAsal(" Draf H-7 ")).toBe("draf-h-7");
    expect(J.kodePolaButir({ katalog: "cerai-gugat", butir: "q1" })).toBe("cerai-gugat/q1");
    expect(J.kodePolaButir({ kodePola: "waktu-tempat" })).toBe("waktu-tempat");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. kodePola dari pengisi jawaban saksi bot
// ═════════════════════════════════════════════════════════════════════════════

describe("pengisi jawaban saksi bot membawa kodePola", () => {
  const require_ = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
  const usul = require_("../services/abtUsulanService.js");
  const servis = require_("../services/isiJawabanSaksiService.js");
  const BD = createRequire(import.meta.url)("../../../ekstensi-sipp/blangko-derry-saksi.js");

  const POSITA = `<ol><li>Bahwa pada hari Senin, 17 November 2025 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa Lembantongoa , di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah;</li>
<li>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan dalam usia 18 tahun Pernikahan dilangsungkan dengan wali nikah yaitu Samsul Bahri (Ayah Kandung Pemohon II) dan yang menikahkan adalah Fathoni (Imam Desa), dan dihadiri saksi nikah bernama Azumar dan Luthfi Hakim, dengan mas kawin berupa Rp.1.100.000 (Satu Juta Seratus Ribu Rupiah) dan dibayar tunai;</li></ol>`;

  it("jawaban yang terisi dari data menyebut id pola kalimat yang mengubahnya (usulan.kodePola); bentuk lain tidak berubah", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Itsbat Nikah", nomor: "1/Pdt.P/2026/PA.Dgl", folder: "", sebutanP: "Pemohon", sebutanT: "Termohon", jumlahP: 2 } as any);
    const rows = t.set[0].baris.map((r: any) => ({ no: r.no, tanya: r.tanya, jawab: r.jawab }));
    const templatAsli = BD.templatDariBaris(BD.tandaiDasar(rows, true));
    const saksi = [
      { pihak: "P", ke: 1, modus: "sama", sumber: "penggugat", alasan: [] },
      { pihak: "P", ke: 2, modus: "sama", sumber: "penggugat", alasan: [] },
    ];
    const muatan = BD.susunMuatan({ nomorPerkara: "1/Pdt.P/2026/PA.Dgl", templat: templatAsli, jenisPerkara: "360", alur: "16", pelaku: "Termohon", lawan: "Pemohon", saksi });
    const h = usul.susunKeteranganSaksiSdg({ templat: templatAsli, posita: POSITA, alasan: [], pelaku: "Termohon", lawan: "Pemohon", nomorPerkara: "1/Pdt.P/2026/PA.Dgl", kodeKumpulan: "", jenisPerkara: "360", alur: "16", modus: muatan.modus, saksi: muatan.saksi });
    servis.lengkapi(h, { templatMasuk: templatAsli, posita: POSITA, jenisPerkara: "360", alur: "16", pelaku: "Termohon", lawan: "Pemohon", saksi });
    const diisi = h.saksi[0].jawaban.filter((j: any) => j.usulan && /menikah pada 17 November 2025/.test(j.jawab));
    expect(diisi.length).toBeGreaterThan(0);
    const kode = String(diisi[0].usulan.kodePola || "");
    expect(kode).toMatch(/^[a-z0-9-]+(\+[a-z0-9-]+)*$/);
    const idCue = new Set((require_("../services/isiJawabanSaksi.js").CUES as Array<{ id: string }>).map((c) => c.id));
    expect(kode.split("+").every((id) => idCue.has(id))).toBe(true);
    expect(kode).toContain("nikah-tgl-tempat");
    // jawaban tanpa pola yang cocok tidak diberi kodePola kosong palsu
    for (const j of h.saksi[0].jawaban) if (j.usulan && "kodePola" in j.usulan) expect(String(j.usulan.kodePola).length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. saksi-susun (katalog)
// ═════════════════════════════════════════════════════════════════════════════

const SUMBER_KATALOG = [baca("panel-alat.js"), JEJAK, baca("saksi-katalog.js"), baca("saksi-katalog-data.js"), baca("saksi-susun.js"), baca("abt.js")].join("\n;\n");
const KODE_BLANGKO_CERAI = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 4001 0047 0222 5227 0246 9944 7035 1268 8503 1197 1198 1199 1200 1201 1202 1241 2021 1203 1204 1205 1206 1207 1208 1242 2022 8505 0155 7095 8501 0032 0033".split(" ");

function bukaHalamanKatalog(portal: Portal, tulisAbt: Array<{ alamat: string; badan: string }>) {
  const isi: Record<string, string> = { "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat", "1241": "ibu kandung", "1242": "tetangga", "0222": "Maret 2023", "5227": "tidak memberi nafkah dan sering bertengkar", "0246": "Januari 2024", "9944": "1 (satu) tahun", "7035": "Tergugat", "1268": "pihak keluarga telah berusaha mendamaikan namun tidak berhasil", "8503": "F" };
  const baris = KODE_BLANGKO_CERAI.map(
    (k) =>
      `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in isi ? isi[k] : `isi ${k}`}</td>` +
      `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
  ).join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>[2] BAS 2 P Hadir &amp; T Tidak Hadir</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halaman.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.Response = globalThis.Response;
  w.fetch = async (alamat: string, o: any = {}) => {
    const p = jawabPortal(portal, String(alamat), o);
    if (p) return p;
    if (o && o.method === "POST" && /tanyajawab_perkara_edit/.test(alamat)) {
      tulisAbt.push({ alamat: String(alamat), badan: String(o.body) });
      return html(200, "Tanya Jawab Disimpan");
    }
    return html(404, "");
  };
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.eval(`${SUMBER_KATALOG}\n;\nwindow.__uji = { tahanPost: (nilai) => { alatCobaMenahan = () => nilai; } };`);
  return w;
}

async function susunKatalog(portal: Portal) {
  const tulisAbt: Array<{ alamat: string; badan: string }> = [];
  const w = bukaHalamanKatalog(portal, tulisAbt);
  w.__uji.tahanPost(false);
  const panel = await tunggu(() => w.document.getElementById("aleta-panel-abt"), "panel ABT");
  const tombolDi = (akar: any, teks: string) => Array.from(akar.querySelectorAll("button")).find((b: any) => b.textContent === teks) as any;
  await tunggu(() => !tombolDi(panel, "Susun saksi menurut keadaan perkara")?.hidden, "tombol katalog tampak");
  tombolDi(panel, "Susun saksi menurut keadaan perkara").click();
  const wadah = await tunggu(() => (panel.querySelector(".aleta-ssk .aleta-sdg-form") ? panel.querySelector(".aleta-ssk") : null), "borang");
  tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
  await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi tersusun");
  return { w, wadah, tulisAbt, tombolDi };
}

describe("saksi-susun: butir saksi dicatat hanya bila saklar menyala", () => {
  it("saklar MATI: keterangan tersimpan ke ABT seperti dulu dan tidak satu pun permintaan ke rute saksi-butir", async () => {
    const portal = portalBaru(false);
    const { wadah, tulisAbt, tombolDi } = await susunKatalog(portal);
    tombolDi(wadah, "Simpan ke ABT").click();
    await tunggu(() => tulisAbt.length === 2, "dua permintaan simpan ABT");
    await jeda(120);
    expect(portal.butir).toEqual([]);
    expect(portal.isian).toEqual([]);
  });

  it("saklar menyala: satu butir per baris dengan usulan mesin vs teks final; disunting dan dihapus tercatat", async () => {
    const portal = portalBaru(true);
    const { wadah, tulisAbt, tombolDi } = await susunKatalog(portal);
    const kolom = Array.from(wadah.querySelectorAll(".aleta-ssk-saksi")) as any[];
    const barisSemua = Array.from(wadah.querySelectorAll(".aleta-ssk-baris")) as any[];
    const asli = barisSemua.map((b) => ({ butir: b.getAttribute("data-butir"), saksi: Number(b.getAttribute("data-saksi")), jawab: (b.querySelector("textarea") as any).value as string }));
    // saksi 1: sunting butir pertama; hapus (kosongkan) butir kedua; saksi 2 dibiarkan
    const t1 = kolom[0].querySelectorAll(".aleta-ssk-baris textarea")[0] as any;
    const t2 = kolom[0].querySelectorAll(".aleta-ssk-baris textarea")[1] as any;
    const butir1 = kolom[0].querySelectorAll(".aleta-ssk-baris")[0].getAttribute("data-butir");
    const butir2 = kolom[0].querySelectorAll(".aleta-ssk-baris")[1].getAttribute("data-butir");
    t1.value = "Disunting petugas sendiri.";
    t2.value = "";
    tombolDi(wadah, "Simpan ke ABT").click();
    await tunggu(() => tulisAbt.length === 2, "dua permintaan simpan ABT");
    await tunggu(() => portal.butir.length === asli.length, `semua butir terkirim (${asli.length})`);

    expect(portal.butir).toHaveLength(asli.length);
    const s1 = portal.butir.filter((b) => b.saksiKe === 1);
    const s2 = portal.butir.filter((b) => b.saksiKe === 2);
    expect(s1.length + s2.length).toBe(asli.length);
    for (const b of portal.butir) {
      expect(b).toMatchObject({ perkaraId: "10018", jalur: "katalog", katalog: "cerai-gugat", pihak: "P", sidang: expect.any(String) });
      expect(b.variabel).toMatch(/^202[12]$/);
      expect(b.kodePola).toBe(`cerai-gugat/${b.butir}`);
      expect(b.varian).toMatch(/^s[12]:\d+$/);
      expect(b.jenisKeterangan).toBeTruthy();
      expect(b.pertanyaan.length).toBeGreaterThan(5);
      expect(b.usulan.length).toBeGreaterThan(0);
      expect(String(b.versiKatalog)).toMatch(/^\d+$/);
      expect(JSON.stringify(b)).not.toMatch(/aleta/i);
    }
    const b1 = s1.find((b) => b.butir === butir1)!;
    expect(b1.teksFinal).toBe("Disunting petugas sendiri.");
    expect(b1.usulan).not.toBe(b1.teksFinal);
    expect(b1.nomorButir).toBe(1);
    const b2 = s1.find((b) => b.butir === butir2)!;
    expect(b2.teksFinal).toBe(""); // dihapus petugas -> tidak ikut tersimpan ke ABT, tetap tercatat sebagai dibuang
    expect(b2.nomorButir).toBe(0);
    // yang tidak disentuh: final = usulan
    const utuh = s2.filter((b) => b.teksFinal.trim() === b.usulan.trim());
    expect(utuh.length).toBe(s2.length);
    // ABT menerima baris saksi 1 TANPA butir yang dikosongkan
    const data0 = JSON.parse(new URLSearchParams(tulisAbt[0].badan).get("data") as string);
    expect(data0[0].jawab).toBe("Disunting petugas sendiri.");
    expect(data0.some((x: any) => x.jawab === "")).toBe(false);
    // riwayat panel untuk variabel tanya-jawab tidak masuk jejak isian (butir punya tabel sendiri)
    expect(portal.riwayat.every((r) => r.tanpaJejak === true)).toBe(true);
  });

  it("gagal mengirim jejak tidak menggagalkan penyimpanan: server jejak 500 -> keterangan tetap tersimpan", async () => {
    const portal = portalBaru(true);
    const { w, wadah, tulisAbt, tombolDi } = await susunKatalog(portal);
    const sebelum = w.fetch;
    w.fetch = async (alamat: string, o: any = {}) => (/saksi-butir/.test(String(alamat)) && o.method === "POST" ? jawab({ ok: false }, 500) : sebelum(alamat, o));
    tombolDi(wadah, "Simpan ke ABT").click();
    await tunggu(() => tulisAbt.length === 2, "dua permintaan simpan ABT");
    await tunggu(() => /tersimpan di ABT/.test(wadah.textContent), "kabar tersimpan");
    expect(portal.butir).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. jalur cerai lama (abt.js, "Susun keterangan saksi 1 & 2")
// ═════════════════════════════════════════════════════════════════════════════

const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ABT = baca("abt.js");
const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;

beforeAll(() => {
  const rq = createRequire(BERKAS_RUTE);
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    require: (p: string) => rq(p),
    abtUsulanService: rq("../services/abtUsulanService"),
    requireInternalToken: () => undefined,
    router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const f = rute["/abt/usulan"];
  penanganBot = async (body) => {
    let status = 200;
    let json: any = null;
    await f({ body: JSON.parse(JSON.stringify(body)) }, { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) });
    return { status, json };
  };
});

const MENTAH = [
  { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal dengan #0046# dan #0047#?", jawaban: "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;" },
  { urutan_pertanyaan: "2", pertanyaan: "Apakah saksi tahu hubungan #0046# dan #0047#?", jawaban: "Antara #0046# dan #0047# adalah suami istri yang sah;" },
  { urutan_pertanyaan: "3", pertanyaan: "Siapa yang meninggalkan tempat tinggal bersama?", jawaban: "Yang meninggalkan kediaman bersama adalah #7035#;" },
  { urutan_pertanyaan: "4", pertanyaan: "Apakah saksi masih sanggup untuk mendamaikan #0046# dan #0047#?", jawaban: "Saya tidak sanggup lagi;" },
];
const ganti = (t: string) => t.replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat").replace(/#1241#/g, "ibu kandung Penggugat").replace(/#1242#/g, "tetangga Penggugat").replace(/#\d{4}#/g, "xxx");
const TERGANTI = Object.fromEntries(MENTAH.map((b, i) => [String(i), { urutan_pertanyaan: b.urutan_pertanyaan, pertanyaan: ganti(b.pertanyaan), jawaban: ganti(b.jawaban) }]));
const KODE_SDG = "0001 0048 0046 0047 5125 0033 1197 1203 2021 2022 0222 5227 9944 7035 1268".split(" ");
const ISI_SDG: Record<string, string> = { "0046": "Penggugat", "0047": "Tergugat", "0048": "Cerai Gugat", "1197": "xxx binti xxx", "1203": "xxx bin xxx", "5125": "Bahwa sejak tahun 2024 sering terjadi perselisihan karena Tergugat suka berjudi;" };

function bukaHalamanSdg(portal: Portal, simpanAbt: Array<{ noVar: string; data: any[] }>) {
  const baris = KODE_SDG.map(
    (k) =>
      `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in ISI_SDG ? ISI_SDG[k] : `isi ${k}`}</td>` +
      `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
  ).join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halaman.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://aleta-uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: {
      local: {
        get: async (k: string[]) => Object.fromEntries((k || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    const p = jawabPortal(portal, a, o);
    if (p) return p;
    if (a.includes("/tanyajawab_template_edit?")) return html(200, `<script>\n var ajax_data = ${JSON.stringify(MENTAH)} \n</script>`);
    if (a.includes("/tanyajawab_perkara_edit?")) {
      const q = new URL(a).searchParams;
      if (q.get("aksi") === "simpan") {
        simpanAbt.push({ noVar: String(q.get("no_var")), data: JSON.parse(new URLSearchParams(String(o.body || "")).get("data") || "[]") });
        return html(200, "Tanya Jawab Disimpan");
      }
      if (String(o.body || "").includes("load_template")) return html(200, `<script>\n var ajax_data = ${JSON.stringify(TERGANTI)} \n</script>`);
      return html(200, `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select><script>\n var ajax_data = [] \n</script>`);
    }
    if (a.includes("/edit_data?")) return o.method === "POST" ? html(200, "<b>DATA DISIMPAN</b>") : html(200, '<input type="hidden" name="var_type" value="data_teks">');
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(String(o.body || "{}"));
      if (muatan.sumber === "siapa" || muatan.sumber === "sipp") return html(401, "{}");
      const bot = await penanganBot(muatan);
      return html(200, JSON.stringify({ data: { available: true, ...bot.json } }));
    }
    return html(401, "{}");
  };
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  w.eval(`${SUMBER_ALAT}\n;\n${JEJAK}\n;\n${SUMBER_ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
  return w;
}

describe("jalur cerai lama (abt.js): butir tercatat sesudah tersimpan", () => {
  async function susunDanSimpan(portal: Portal) {
    const simpanAbt: Array<{ noVar: string; data: any[] }> = [];
    const w = bukaHalamanSdg(portal, simpanAbt);
    const panel = () => w.document.getElementById("aleta-panel-abt");
    const tombol = (teks: string) => Array.from(panel()?.querySelectorAll("button") || []).find((b: any) => b.textContent === teks) as any;
    (await tunggu(() => tombol("Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
    (await tunggu(() => tombol("Susun keterangan para saksi"), "blangko SDG")).click();
    const hasil = await tunggu(() => panel().querySelector(".aleta-sdg-hasil"), "pratinjau SDG");
    return { w, hasil, simpanAbt };
  }
  const pilihSemua = (w: any, hasil: any) => {
    for (const s of Array.from(hasil.querySelectorAll("select.aleta-sdg-pilihan")) as any[]) {
      s.value = "0";
      s.dispatchEvent(new w.Event("change"));
    }
  };
  const tombolSimpan = (hasil: any) => Array.from(hasil.querySelectorAll("button")).find((b: any) => /^Simpan keterangan \d+ saksi/.test(b.textContent)) as any;

  it("saklar MATI: ABT menerima saksi seperti dulu; tidak ada permintaan jejak sama sekali", async () => {
    const portal = portalBaru(false);
    const { w, hasil, simpanAbt } = await susunDanSimpan(portal);
    pilihSemua(w, hasil);
    tombolSimpan(hasil).click();
    await tunggu(() => /tersimpan di ABT/.test(hasil.textContent), "kabar tersimpan");
    expect(simpanAbt.length).toBeGreaterThanOrEqual(2);
    await jeda(100);
    expect(portal.butir).toEqual([]);
    expect(portal.isian).toEqual([]);
  });

  it("saklar menyala: butir tercatat dengan usulan awal mesin vs jawaban akhir (sunting petugas), variabel dan pihak benar", async () => {
    const portal = portalBaru(true);
    const { w, hasil, simpanAbt } = await susunDanSimpan(portal);
    pilihSemua(w, hasil);
    const kotak = Array.from(hasil.querySelectorAll("textarea.aleta-sdg-jawab")) as any[];
    const awal = kotak.map((k) => k.value as string);
    kotak[0].value = "Jawaban pertama disunting petugas;";
    kotak[0].dispatchEvent(new w.Event("input"));
    tombolSimpan(hasil).click();
    await tunggu(() => /tersimpan di ABT/.test(hasil.textContent), "kabar tersimpan");
    await tunggu(() => portal.butir.length > 0, "butir terkirim");
    expect(simpanAbt.map((x) => x.noVar)).toEqual(expect.arrayContaining(["2021", "2022"]));
    expect(portal.butir.every((b) => b.jalur === "cerai-lama" && b.perkaraId === "10018" && ["2021", "2022"].includes(b.variabel))).toBe(true);
    const pertama = portal.butir.find((b) => b.variabel === "2021" && b.nomorButir === 1)!;
    expect(pertama.teksFinal).toBe("Jawaban pertama disunting petugas;");
    // usulan = jawaban awal mesin SEBELUM petugas menyunting kotak (bukan teks yang sudah disunting)
    expect(pertama.usulan).not.toBe(pertama.teksFinal);
    expect(pertama.usulan.replace(/\s+/g, " ").trim()).toBe(awal[0].replace(/\s+/g, " ").trim());
    expect(pertama.saksiKe).toBe(1);
    expect(pertama.pihak).toBe("P");
    expect(JSON.stringify(portal.butir)).not.toMatch(/aleta/i);
    // variabel tanya-jawab tidak masuk jejak isian (butir punya tabel sendiri)
    expect(portal.riwayat.every((r) => r.tanpaJejak === true)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Riwayat Urungkan di panel ABT: catatan server yang lengkap dari PC lain
// ═════════════════════════════════════════════════════════════════════════════

describe("riwayat panel ABT: catatan server lengkap dapat dikembalikan dengan konfirmasi dua langkah", () => {
  const JEJAK_SERVER = (tambah: Record<string, unknown> = {}) => ({
    id: "jejak-1",
    perkaraId: "10018",
    nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
    kode: "0222",
    nama: "Awal perselisihan",
    nilaiSebelum: "sejak Maret 2023 (lengkap, tidak dipotong)",
    nilaiFinal: "sejak tahun 2020",
    cara: "diubah",
    pada: "2026-10-25T03:00:00.000Z",
    sebelumDipotong: false,
    bisaDiurungkan: true,
    olehNama: "PP Dua",
    ...tambah,
  });

  async function bukaRiwayat(portal: Portal) {
    const simpanAbt: Array<{ noVar: string; data: any[] }> = [];
    const tulis: Array<{ alamat: string; badan: string }> = [];
    const w = bukaHalamanSdg(portal, simpanAbt);
    const asli = w.fetch;
    w.fetch = async (alamat: string, o: any = {}) => {
      if (/\/edit_data\?/.test(String(alamat)) && o.method === "POST") tulis.push({ alamat: String(alamat), badan: String(o.body) });
      return asli(alamat, o);
    };
    const panel = () => w.document.getElementById("aleta-panel-abt");
    const tombolRiwayat = await tunggu(() => Array.from(panel()?.querySelectorAll("button") || []).find((b: any) => /riwayat/i.test(b.textContent)) as any, "tombol riwayat");
    tombolRiwayat.click();
    return { w, panel, tulis };
  }

  it("saklar MATI: tidak ada catatan server; riwayat seperti dulu (kosong) dan tidak menanyakan jejak perkara", async () => {
    const portal = portalBaru(false);
    portal.jejakPerkara = [JEJAK_SERVER()];
    const { panel } = await bukaRiwayat(portal);
    await tunggu(() => panel().textContent.includes("Belum ada perubahan yang tercatat"), "daftar kosong");
    expect(panel().textContent).not.toContain("dicatat di server");
  });

  it("saklar menyala: catatan lengkap tampil dengan sebabnya; tekan sekali meminta konfirmasi, tekan lagi menulis nilai sebelumnya utuh ke ABT dan mencatat 'dikembalikan' beserta urungkanDari", async () => {
    const portal = portalBaru(true);
    portal.jejakPerkara = [JEJAK_SERVER()];
    const { w, panel, tulis } = await bukaRiwayat(portal);
    await tunggu(() => panel().textContent.includes("PP Dua"), "catatan server tampil");
    expect(panel().textContent).toContain("PC lain");
    const urung = (await tunggu(() => Array.from(panel().querySelectorAll("button")).find((b: any) => /Kembalikan yang sebelumnya/.test(b.textContent)) as any, "tombol kembalikan"));
    urung.click();
    await jeda(60);
    expect(tulis).toEqual([]); // tekan pertama = konfirmasi, belum menulis
    expect(urung.textContent).toMatch(/Yakin/);
    urung.click();
    await tunggu(() => tulis.length >= 1, "ditulis ke ABT");
    expect(new URLSearchParams(tulis[0].badan).get("value")).toBe("sejak Maret 2023 (lengkap, tidak dipotong)");
    expect(tulis[0].alamat).toContain("no_var=0222");
    await tunggu(() => portal.riwayat.length >= 1, "pengembalian dicatat");
    expect(portal.riwayat[0]).toMatchObject({ kode: "0222", cara: "dikembalikan", urungkanDari: "jejak-1", sesudah: "sejak Maret 2023 (lengkap, tidak dipotong)" });
    void w;
  });

  it("catatan yang terpotong atau sudah dikembalikan TIDAK punya tombol; sebabnya disebut", async () => {
    const portal = portalBaru(true);
    portal.jejakPerkara = [
      JEJAK_SERVER({ id: "j-potong", kode: "5125", sebelumDipotong: true, bisaDiurungkan: false, pada: "2026-10-25T03:05:00.000Z" }),
      JEJAK_SERVER({ id: "j-sudah", kode: "0246", nilaiSebelum: "a", nilaiFinal: "b", bisaDiurungkan: false, pada: "2026-10-25T03:06:00.000Z" }),
    ];
    const { panel } = await bukaRiwayat(portal);
    await tunggu(() => panel().textContent.includes("PP Dua"), "catatan server tampil");
    expect(Array.from(panel().querySelectorAll("button")).some((b: any) => /Kembalikan yang sebelumnya/.test(b.textContent))).toBe(false);
    expect(panel().textContent).toContain("Isinya dipotong");
    expect(panel().textContent).toContain("Sudah ada perubahan yang lebih baru");
  });
});
