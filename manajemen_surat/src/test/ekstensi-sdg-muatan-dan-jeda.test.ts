// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PANEL SAKSI SDG DI ABT: MUATAN, N SAKSI, PILIHAN, SIMPAN BERURUTAN
 * ============================================================================
 *
 * panel-alat.js dan abt.js dimuat SUNGGUHAN ke halaman blangko jsdom; panelnya
 * dibangun pasang() sendiri, tombolnya ditekan, dan permintaan /abt/usulan
 * dijawab oleh penangan rute bot SUNGGUHAN - dipotong dari
 * internalGatewayRoutes.js dan dijalankan di node:vm bersama abtUsulanService
 * yang asli. Yang ditiru hanya jaringan ABT (halaman penyunting tanya-jawab)
 * dan kewenangan portal.
 *
 * Yang dijaga:
 *   1. muatan saksi-sdg membawa nomorPerkara, kodeKumpulan, jenisPerkara (id
 *      SIPP), alur, jawabMentah, dan saksi[] dengan sumberNama untuk ketiga
 *      pilihan pencerita;
 *   2. jawaban berpilihan tampil sebagai pilihan dan TIDAK dapat disimpan
 *      sebelum dipilih;
 *   3. saksi disimpan berurutan ke variabel yang benar (2021, 2022, 2031 ...),
 *      satu permintaan dalam satu waktu, TANPA jeda tiruan - keputusan
 *      25 September 2026 membatalkan jeda "antar-saksi";
 *   4. pemetaan variabel saksi cocok dengan ekspor aps_badilag.abt_variabel;
 *   5. pilihan alasan: portal mati -> 9 tertanam; portal -> 13 kunci;
 *   6. kartu usulan 1268 yang bot ragukan menggambar pilihan bunyinya dan
 *      tidak tercentang sendiri.
 *
 * Templat di bawah disalin dari abt_tanyajawab_template (kode 04 dan A2,
 * PA Donggala), tanpa isi perkara apa pun. Penggantian variabelnya ditiru
 * dengan sebutan dan 'xxx'.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
// ALETA_UJI_ABT hanya dipakai skrip pembukti gigitan: cacat dipasang pada
// SALINAN, bukan pada berkas yang dipakai uji lain.
const SUMBER_ALAT = readFileSync(process.env.ALETA_UJI_PANEL_ALAT || path.join(AKAR, "panel-alat.js"), "utf8");
const SUMBER_ABT = readFileSync(process.env.ALETA_UJI_ABT || path.join(AKAR, "abt.js"), "utf8");

// ============================================================================
// RUTE BOT SUNGGUHAN
// ============================================================================
const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;

beforeAll(() => {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    require: (p: string) => require_(p),
    abtUsulanService: require_("../services/abtUsulanService"),
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

// ============================================================================
// TEMPLAT
// ============================================================================
type Baris = { urutan_pertanyaan: string; pertanyaan: string; jawaban: string };
const MENTAH: Baris[] = [
  { urutan_pertanyaan: "1", pertanyaan: "Apakah saksi kenal dengan #0046# dan #0047#?", jawaban: "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;" },
  { urutan_pertanyaan: "2", pertanyaan: "Apakah saksi tahu hubungan #0046# dan #0047#?", jawaban: "Antara #0046# dan #0047# adalah suami istri yang sah;" },
  {
    urutan_pertanyaan: "3",
    pertanyaan: "Apakah #0046# dan #0047# sudah berpisah tempat tinggal ?",
    jawaban: "Ya, #0046# dan #0047# sudah berpisah tempat tinggal; <br>Tidak benar karena masih sering datang bermalam;",
  },
  { urutan_pertanyaan: "4", pertanyaan: "Siapa yang meninggalkan tempat tinggal bersama?", jawaban: "Yang meninggalkan kediaman bersama adalah #7035#;" },
  { urutan_pertanyaan: "5", pertanyaan: "Apakah saksi masih sanggup untuk mendamaikan #0046# dan #0047#?", jawaban: "Saya tidak sanggup lagi;" },
  { urutan_pertanyaan: "6", pertanyaan: "Apakah masih ada keterangan yang saksi akan sampaikan?", jawaban: "Sudah cukup;" },
];
/** Tiruan variabel(): sebutan dan 'xxx' - bukan isi perkara. */
const ganti = (t: string) =>
  t
    .replace(/#0046#/g, "Penggugat")
    .replace(/#0047#/g, "Tergugat")
    .replace(/#1241#/g, "ibu kandung Penggugat")
    .replace(/#1242#/g, "tetangga Penggugat")
    .replace(/#\d{4}#/g, "xxx");
const TERGANTI = Object.fromEntries(
  MENTAH.map((b, i) => [String(i), { urutan_pertanyaan: b.urutan_pertanyaan, pertanyaan: ganti(b.pertanyaan), jawaban: ganti(b.jawaban) }])
);

// ============================================================================
// HALAMAN BLANGKO
// ============================================================================
const halamanTerbuka: JSDOM[] = [];
afterEach(async () => {
  // Panel dibangun asinkron oleh pasang(). Halaman yang ditutup sebelum
  // panelnya lahir membuat pasang() membaca dokumen yang sudah tidak ada.
  while (halamanTerbuka.length) {
    const dom = halamanTerbuka.pop()!;
    for (let i = 0; i < 100 && !dom.window.document.getElementById("aleta-panel-abt"); i += 1) {
      await new Promise((s) => setTimeout(s, 10));
    }
    await new Promise((s) => setTimeout(s, 30));
    dom.window.close();
  }
});

const r = (status: number, badan: string) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => badan,
  json: async () => JSON.parse(badan),
  clone() {
    return this;
  },
});

type Catatan = {
  usulan: any[];
  jawabanBot: any[];
  simpan: Array<{ noVar: string; data: any[]; mulai: number; selesai: number }>;
  terbangMaks: number;
  mentahDibaca: string[];
  editData: Array<{ noVar: string; mulai: number; selesai: number }>;
};

type OpsiJaringan = {
  /** Portal tipe keluaran: undefined = mati (401); larik = entri bas.saksi.alasan-pilihan. */
  alasanPortal?: Array<{ kunci: string; nilai: string }>;
  /** Jawaban /abt/usulan yang diganti (untuk kartu usulan); bawaannya rute bot sungguhan. */
  usulanTiruan?: (muatan: any) => any;
  /** Lama ABT menjawab satu simpanan (md). */
  lamaSimpanMs?: number;
};

function jaringan(opsi: OpsiJaringan = {}) {
  const c: Catatan = { usulan: [], jawabanBot: [], simpan: [], terbangMaks: 0, mentahDibaca: [], editData: [] };
  let terbang = 0;
  const tunda = (ms: number) => new Promise((x) => setTimeout(x, ms));
  const fetch = async (alamat: string, o: any = {}) => {
    const a = String(alamat);
    if (a.includes("/tanyajawab_template_edit?")) {
      c.mentahDibaca.push(new URL(a).searchParams.get("kode") || "");
      return r(200, `<script>\n var ajax_data = ${JSON.stringify(MENTAH)} \n</script>`);
    }
    if (a.includes("/tanyajawab_perkara_edit?")) {
      const q = new URL(a).searchParams;
      if (q.get("aksi") === "simpan") {
        terbang += 1;
        c.terbangMaks = Math.max(c.terbangMaks, terbang);
        const mulai = Date.now();
        await tunda(opsi.lamaSimpanMs ?? 15);
        terbang -= 1;
        const data = JSON.parse(new URLSearchParams(String(o.body || "")).get("data") || "[]");
        c.simpan.push({ noVar: String(q.get("no_var")), data, mulai, selesai: Date.now() });
        return r(200, "Tanya Jawab Disimpan");
      }
      if (String(o.body || "").includes("load_template")) {
        return r(200, `<script>\n var ajax_data = ${JSON.stringify(TERGANTI)} \n</script>`);
      }
      return r(
        200,
        `<select><option value=''>--> Load Template <--</option><option value='04'>(04) Pertanyaan Saksi CG</option></select>` +
          `<script>\n var ajax_data = [] \n</script>`
      );
    }
    if (a.includes("/edit_data?")) {
      const q = new URL(a).searchParams;
      if (o.method === "POST") {
        terbang += 1;
        c.terbangMaks = Math.max(c.terbangMaks, terbang);
        const mulai = Date.now();
        await tunda(opsi.lamaSimpanMs ?? 15);
        terbang -= 1;
        c.editData.push({ noVar: String(q.get("no_var")), mulai, selesai: Date.now() });
        return r(200, "<b>DATA DISIMPAN</b>");
      }
      return r(200, '<input type="hidden" name="var_type" value="data_teks">');
    }
    if (a.endsWith("/aleta/api/aleta-ecourt/ekstensi/tipe-keluaran")) {
      if (!opsi.alasanPortal) return r(401, "{}");
      const entri = opsi.alasanPortal.map((e, urutan) => ({ ...e, data: {}, urutan, asal: urutan < 9 ? "bawaan" : "tambahan", sidik: "" }));
      return r(200, JSON.stringify({ ok: true, versi: "0123456789abcdef", dibuatPada: "2026-09-26T00:00:00Z", daftar: { "bas.saksi.alasan-pilihan": entri } }));
    }
    if (a.endsWith("/aleta/api/aleta-bot/abt/usulan")) {
      const muatan = JSON.parse(String(o.body || "{}"));
      if (muatan.sumber === "siapa" || muatan.sumber === "sipp") return r(401, "{}");
      c.usulan.push(muatan);
      const bot = opsi.usulanTiruan ? { status: 200, json: opsi.usulanTiruan(muatan) } : await penanganBot(muatan);
      c.jawabanBot.push(bot.json);
      return r(200, JSON.stringify({ data: { available: true, ...bot.json } }));
    }
    return r(401, "{}");
  };
  return { c, fetch };
}

/** Variabel blangko cerai [02] yang memuat 2021/2022 dan nama tiga saksi P. */
const KODE_BLANGKO = "0001 0048 0046 0047 5125 0033 1197 1203 6132 2021 2022 0222 5227 9944 7035 1268".split(" ");
const ISI_BLANGKO: Record<string, string> = {
  "0046": "Penggugat",
  "0047": "Tergugat",
  "0048": "Cerai Gugat",
  "1197": "xxx binti xxx",
  "1203": "xxx bin xxx",
  "6132": "xxx binti xxx",
  "5125": "Bahwa sejak tahun 2024 sering terjadi perselisihan karena Tergugat suka berjudi;",
};

function bukaBlangko(kode: string[], isi: Record<string, string>, fetch: (a: string, o?: any) => Promise<any>) {
  const baris = kode
    .map(
      (k) =>
        `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td>` +
        `<td>${k in isi ? isi[k] : `isi ${k}`}</td>` +
        `<td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
    )
    .join("");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content">` +
      `<h3 class="w3l_header"><span>123/Pdt.G/2026/PA.Dgl</span></h3><table>${baris}</table></div></div></body></html>`,
    { url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3", runScripts: "outside-only" }
  );
  halamanTerbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: {
      getManifest: () => ({ version: "uji" }),
      getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }),
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (k: string[]) => Object.fromEntries((k || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  };
  w.fetch = fetch;
  w.console.warn = () => {};
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    },
  });
  // SATU skrip, seperti satu dunia terasing Chrome. Keduanya "use strict",
  // jadi tidak satu pun deklarasinya bocor ke window: yang diuji langsung
  // diserahkan lewat __uji di akhir skrip yang sama.
  w.eval(
    SUMBER_ALAT +
      "\n;\n" +
      SUMBER_ABT +
      "\n;\nwindow.__uji = { susunMuatanSdg, variabelSaksiSdg, VAR_SAKSI_TANYA_JAWAB, VAR_NAMA_SAKSI };"
  );
  return w;
}

async function tunggu<T>(cari: () => T | null | undefined | false, pesan: string): Promise<T> {
  for (let i = 0; i < 400; i += 1) {
    const x = cari();
    if (x) return x;
    await new Promise((s) => setTimeout(s, 10));
  }
  throw new Error(`tidak muncul: ${pesan}`);
}

const panelDari = (w: any) => w.document.getElementById("aleta-panel-abt");
const tombolBertulis = (w: any, teks: string) =>
  Array.from(panelDari(w)?.querySelectorAll("button") || []).find((b: any) => b.textContent === teks) as any;

/** Tekan "Susun keterangan saksi 1 & 2", lalu "Susun keterangan para saksi"; pulang pratinjaunya. */
async function susunSdg(w: any, sebelumSusun?: (w: any) => void) {
  (await tunggu(() => tombolBertulis(w, "Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
  const susun = await tunggu(() => tombolBertulis(w, "Susun keterangan para saksi"), "borang SDG");
  if (sebelumSusun) sebelumSusun(w);
  susun.click();
  return tunggu(() => panelDari(w).querySelector(".aleta-sdg-hasil"), "pratinjau SDG");
}

// ============================================================================
// 1. MUATAN
// ============================================================================
describe("muatan saksi-sdg (susunMuatanSdg dijalankan dari abt.js)", () => {
  it("nomorPerkara dan sumberNama untuk ketiga pilihan pencerita", () => {
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, jaringan().fetch);
    for (const [sumber, sebutanPelaku, sebutanLawan, harap] of [
      ["penggugat", "Tergugat", "Penggugat", "Penggugat"],
      ["tergugat", "Tergugat", "Penggugat", "Tergugat"],
      ["keluarga", "Tergugat", "Penggugat", "keluarga mereka"],
      ["penggugat", "Termohon", "Pemohon", "Pemohon"],
      ["tergugat", "Termohon", "Pemohon", "Termohon"],
    ]) {
      const m = w.__uji.susunMuatanSdg({
        nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
        pelaku: sebutanPelaku,
        lawan: sebutanLawan,
        saksi: [{ pihak: "P", ke: 1, modus: "dari-cerita", sumber }],
      });
      expect(m.nomorPerkara, sumber).toBe("123/Pdt.G/2026/PA.Dgl");
      expect(m.sumber).toBe("saksi-sdg");
      expect(m.saksi[0].sumberNama, `${sumber}/${sebutanLawan}`).toBe(harap);
      expect(m.modus.saksi1.sumberNama).toBe(harap);
    }
  });

  it("lewat panel: kodeKumpulan, jenisPerkara id SIPP, alur, jawabMentah, dan tiga saksi P", async () => {
    const j = jaringan();
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    await susunSdg(w);
    expect(j.c.usulan).toHaveLength(1);
    const m = j.c.usulan[0];
    expect(m).toMatchObject({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", sumber: "saksi-sdg", kodeKumpulan: "04", jenisPerkara: "347", alur: "15" });
    expect(j.c.mentahDibaca).toEqual(["04"]);
    expect(m.templat[0].jawabMentah).toBe(MENTAH[0].jawaban);
    expect(m.templat.every((b: any) => typeof b.jawabMentah === "string")).toBe(true);
    // Nama tiga saksi P tergambar di blangko -> tiga saksi bawaan.
    expect(m.saksi.map((s: any) => `${s.pihak}${s.ke}`)).toEqual(["P1", "P2", "P3"]);
    expect(m.saksi.every((s: any) => s.sumberNama)).toBe(true);
    // Bot sungguhan menerima semuanya: tiga saksi, tanpa penolakan.
    const bot = j.c.jawabanBot[0];
    expect(bot.saksiDitolak).toBeUndefined();
    expect(bot.saksiSdg.saksi).toHaveLength(3);
  });
});

// ============================================================================
// 2 & 3. PILIHAN WAJIB, SIMPAN BERURUTAN TANPA JEDA TIRUAN
// ============================================================================
describe("pratinjau N saksi: pilihan wajib dipilih, lalu disimpan berurutan", () => {
  it("jawaban berpilihan tampil sebagai select tanpa bawaan dan menahan Simpan", async () => {
    const j = jaringan();
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    const hasil = await susunSdg(w);
    expect(hasil.querySelectorAll(".aleta-sdg-kolom")).toHaveLength(3);
    const pilih = Array.from(hasil.querySelectorAll("select.aleta-sdg-pilihan")) as any[];
    // Baris 3 berpilihan untuk tiap saksi; hubungan saksi ke-3 berpilihan
    // (templat mentah menyebut dua orang, saksi 1 dan 2 mendapat miliknya).
    const berpilihanBot = j.c.jawabanBot[0].saksiSdg.saksi.flatMap((s: any) => s.jawaban.filter((b: any) => (b.pilihan || []).length >= 2));
    expect(berpilihanBot.length).toBeGreaterThanOrEqual(4);
    expect(pilih).toHaveLength(berpilihanBot.length);
    for (const s of pilih) expect(s.value).toBe("");
    const simpan = Array.from(hasil.querySelectorAll("button")).find((b: any) => /^Simpan keterangan 3 saksi/.test(b.textContent)) as any;
    expect(simpan.disabled).toBe(true);
    expect(hasil.querySelector(".aleta-sdg-kabar-pilih").textContent).toContain(`${pilih.length} jawaban berpilihan belum dipilih`);
    // Ditekan paksa pun tidak menyimpan apa pun.
    simpan.disabled = false;
    simpan.click();
    await new Promise((s) => setTimeout(s, 60));
    expect(j.c.simpan).toHaveLength(0);
    expect(simpan.disabled).toBe(true);
  });

  it("hubungan saksi per saksi: saksi 1 dan 2 masing-masing satu hubungan, saksi 3 memilih", async () => {
    const j = jaringan();
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    const hasil = await susunSdg(w);
    const kolom = Array.from(hasil.querySelectorAll(".aleta-sdg-kolom")) as any[];
    const jawabPertama = (k: any) => k.querySelector("textarea.aleta-sdg-jawab").value;
    expect(jawabPertama(kolom[0])).toContain("ibu kandung Penggugat");
    expect(jawabPertama(kolom[0])).not.toContain("tetangga");
    expect(jawabPertama(kolom[1])).toContain("tetangga Penggugat");
    expect(jawabPertama(kolom[1])).not.toContain("ibu kandung");
    expect(kolom[2].querySelector(".aleta-sdg-baris select.aleta-sdg-pilihan")).not.toBeNull();
  });

  it("sesudah semua dipilih: 2021, 2022, 2031 berurutan, satu per satu, tanpa jeda tiruan", async () => {
    const j = jaringan({ lamaSimpanMs: 25 });
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    const hasil = await susunSdg(w);
    for (const s of Array.from(hasil.querySelectorAll("select.aleta-sdg-pilihan")) as any[]) {
      s.value = "0";
      s.dispatchEvent(new w.Event("change"));
    }
    const simpan = Array.from(hasil.querySelectorAll("button")).find((b: any) => /^Simpan keterangan 3 saksi/.test(b.textContent)) as any;
    expect(simpan.disabled).toBe(false);
    simpan.click();
    await tunggu(() => /tersimpan di ABT/.test(hasil.textContent), "kabar tersimpan");
    expect(j.c.simpan.map((x) => x.noVar)).toEqual(["2021", "2022", "2031"]);
    expect(j.c.terbangMaks).toBe(1);
    // Tiap simpanan dimulai SESUDAH yang sebelumnya dijawab, dan segera -
    // tidak ada tunggu buatan (dahulu direncanakan 20-180 dtk, dibatalkan).
    for (let i = 1; i < j.c.simpan.length; i += 1) {
      const selang = j.c.simpan[i].mulai - j.c.simpan[i - 1].selesai;
      expect(selang).toBeGreaterThanOrEqual(0);
      expect(selang).toBeLessThan(1000);
    }
    // Yang dipilih yang tersimpan, bukan kedua kemungkinan.
    const baris3 = j.c.simpan[0].data.find((b: any) => /berpisah tempat tinggal/i.test(b.tanya));
    expect(baris3.jawab).not.toMatch(/Tidak benar/);
    expect(j.c.simpan[0].data.map((b: any) => b.no)).toEqual(j.c.simpan[0].data.map((_: any, i: number) => String(i + 1)));
  });

  it("tanda 'varian habis' tergambar sebanyak yang bot tandai", async () => {
    const j = jaringan();
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    const hasil = await susunSdg(w);
    const habisBot = j.c.jawabanBot[0].saksiSdg.saksi.flatMap((s: any) => s.jawaban.filter((b: any) => b.varian && b.varian.habis)).length;
    expect(hasil.querySelectorAll(".aleta-sdg-varian-habis")).toHaveLength(habisBot);
  });

  it("jumlah saksi dapat diubah: 2 P + 1 T disimpan ke 2021, 2022, 2023", async () => {
    const j = jaringan();
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    const hasil = await susunSdg(w, (w2) => {
      const [p, t] = Array.from(panelDari(w2).querySelectorAll(".aleta-sdg-jumlah-saksi select")) as any[];
      p.value = "2";
      p.dispatchEvent(new w2.Event("change"));
      t.value = "1";
      t.dispatchEvent(new w2.Event("change"));
    });
    expect(j.c.usulan[0].saksi.map((s: any) => `${s.pihak}${s.ke}`)).toEqual(["P1", "P2", "T3"]);
    for (const s of Array.from(hasil.querySelectorAll("select.aleta-sdg-pilihan")) as any[]) {
      s.value = "0";
      s.dispatchEvent(new w.Event("change"));
    }
    (Array.from(hasil.querySelectorAll("button")).find((b: any) => /^Simpan keterangan 3 saksi/.test(b.textContent)) as any).click();
    await tunggu(() => /tersimpan di ABT/.test(hasil.textContent), "kabar tersimpan");
    expect(j.c.simpan.map((x) => x.noVar)).toEqual(["2021", "2022", "2023"]);
  });
});

// ============================================================================
// 4. PEMETAAN VARIABEL SAKSI
// ============================================================================
/**
 * Ekspor SELECT aps_badilag.abt_variabel (data_type tanya_jawab) beserta
 * kueri variabel referensinya, 26 September 2026. saksi_pihak_ke 1 = pihak P,
 * 2 = pihak T; urutan saksi = offset limit + 1.
 */
const EKSPOR_ABT_VARIABEL: Array<{ noVar: string; nama: string; referensi: string; kueriReferensi: string }> = [
  { noVar: "2021", nama: "Keterangan Saksi 1 P", referensi: "1197", kueriReferensi: "saksi_pihak_ke=1 ... limit 0,1" },
  { noVar: "2022", nama: "Keterangan Saksi 2 P", referensi: "1203", kueriReferensi: "saksi_pihak_ke=1 ... limit 1,1" },
  { noVar: "2023", nama: "Keterangan Saksi 1 T", referensi: "6100", kueriReferensi: "saksi_pihak_ke=2 ... limit 0,1" },
  { noVar: "2024", nama: "Keterangan Saksi 2 T", referensi: "6106", kueriReferensi: "saksi_pihak_ke=2 ... limit 1,1" },
  { noVar: "2031", nama: "Keterangan Saksi 3 P", referensi: "6132", kueriReferensi: "saksi_pihak_ke=1 ... limit 2,1" },
  { noVar: "2032", nama: "Keterangan Saksi 3 T", referensi: "6138", kueriReferensi: "saksi_pihak_ke=2 ... limit 2,1" },
  { noVar: "6124", nama: "TanyaJwb Saksi 4 P", referensi: "6144", kueriReferensi: "saksi_pihak_ke=1 ... limit 3,2" },
  // Cacat data ABT: namanya saksi 3 T, referensinya nama saksi 3 P.
  { noVar: "6122", nama: "TanyaJwb Saksi 3 T", referensi: "6132", kueriReferensi: "saksi_pihak_ke=1 ... limit 2,1" },
];

describe("pemetaan variabel saksi = ekspor abt_variabel", () => {
  /** Saksi yang SUNGGUH dituju satu variabel: dari kueri referensinya, bukan dari namanya. */
  const tujuan = (e: (typeof EKSPOR_ABT_VARIABEL)[number]) => {
    const m = e.kueriReferensi.match(/saksi_pihak_ke=(\d) .* limit (\d),/)!;
    return { pihak: m[1] === "1" ? "P" : "T", ke: Number(m[2]) + 1 };
  };

  it("0 salah kode untuk saksi P 1-4 dan T 1-3; 6122 (referensinya saksi P) tidak pernah dipakai", () => {
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, jaringan().fetch);
    let salah = 0;
    let diperiksa = 0;
    for (const [pihak, n] of [["P", 4], ["T", 3]] as const) {
      for (let ke = 1; ke <= n; ke += 1) {
        const kode = w.__uji.variabelSaksiSdg(pihak, ke);
        const baris = EKSPOR_ABT_VARIABEL.find((e) => e.noVar === kode);
        diperiksa += 1;
        if (!baris) {
          salah += 1;
          continue;
        }
        const t = tujuan(baris);
        if (t.pihak !== pihak || t.ke !== ke) salah += 1;
      }
    }
    expect(diperiksa).toBe(7);
    expect(salah).toBe(0);
    expect(w.__uji.variabelSaksiSdg("P", 5)).toBe("");
    expect(w.__uji.variabelSaksiSdg("T", 4)).toBe("");
    expect(JSON.stringify(w.__uji.VAR_SAKSI_TANYA_JAWAB)).not.toContain("6122");
    // Variabel nama yang dipakai menebak jumlah saksi = referensi yang sama.
    for (const [pihak, n] of [["P", 4], ["T", 3]] as const) {
      for (let ke = 1; ke <= n; ke += 1) {
        const baris = EKSPOR_ABT_VARIABEL.find((e) => e.noVar === w.__uji.variabelSaksiSdg(pihak, ke))!;
        expect(w.__uji.VAR_NAMA_SAKSI[pihak][ke - 1], `${pihak}${ke}`).toBe(baris.referensi);
      }
    }
  });
});

// ============================================================================
// 5. PILIHAN ALASAN
// ============================================================================
const SEMBILAN = [
  "perselisihan terus-menerus",
  "kekerasan dalam rumah tangga",
  "tidak memberi nafkah",
  "pihak lain (wanita/pria idaman lain)",
  "cemburu",
  "obat terlarang",
  "judi",
  "mabuk",
  "murtad/pindah agama",
];
const EMPAT_TAMBAHAN = ["zina", "salah satu pihak menjalani pidana penjara", "cacat badan atau penyakit", "pelanggaran taklik talak"];

describe("pilihan alasan SDG dari tipe keluaran", () => {
  async function kunciAlasan(alasanPortal?: Array<{ kunci: string; nilai: string }>) {
    const j = jaringan({ alasanPortal });
    const w = bukaBlangko(KODE_BLANGKO, ISI_BLANGKO, j.fetch);
    (await tunggu(() => tombolBertulis(w, "Susun keterangan saksi 1 & 2"), "tombol SDG")).click();
    await tunggu(() => tombolBertulis(w, "Susun keterangan para saksi"), "borang SDG");
    const kotak = panelDari(w).querySelector(".aleta-sdg-form > .aleta-sdg-alasan");
    return {
      kunci: (Array.from(kotak.querySelectorAll("input[type=checkbox]")) as any[]).map((c) => c.value),
      kabar: String(panelDari(w).querySelector(".aleta-abt-kabar").textContent),
    };
  }

  it("portal mati -> 9 tertanam, dan asalnya disebut", async () => {
    const { kunci, kabar } = await kunciAlasan();
    expect(kunci).toEqual(SEMBILAN);
    expect(kabar).toContain("daftar tertanam");
  });

  it("dari portal -> 13 kunci, termasuk zina, penjara, cacat, dan taklik", async () => {
    const { kunci } = await kunciAlasan([...SEMBILAN, ...EMPAT_TAMBAHAN].map((k) => ({ kunci: k, nilai: k })));
    expect(kunci).toHaveLength(13);
    for (const k of EMPAT_TAMBAHAN) expect(kunci).toContain(k);
  });

  it("kunci tambahan dikenal bot: bot menyebut ciri itu dalam alasan yang dipakai", async () => {
    const bot = await penanganBot({
      sumber: "saksi-sdg",
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      templat: [{ no: "1", tanya: "Apakah saksi tahu penyebab perselisihan Penggugat dan Tergugat?", jawab: "Ya, penyebabnya xxx;" }],
      alasan: EMPAT_TAMBAHAN,
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    expect(bot.json.saksiSdg.alasan).toEqual(EMPAT_TAMBAHAN);
  });
});

// ============================================================================
// 6. KARTU USULAN BERPILIHAN (1268 ragu)
// ============================================================================
describe("kartu usulan 1268 yang bot ragukan: pilihan bunyi, tidak tercentang sendiri", () => {
  const KODE_CERAI = "0001 0048 0046 0047 5125 0033 2021 2022 0222 5227 9944 7035 1268".split(" ");

  async function kartu1268() {
    // Jawaban bot SUNGGUHAN atas keterangan saksi yang berkata belum pernah
    // ada upaya damai - bukan jawaban karangan.
    const bot = await penanganBot({
      sumber: "saksi",
      saksi1: "- Bahwa Penggugat dan Tergugat sering bertengkar\n- Bahwa belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat",
      saksi2: "- Bahwa Penggugat dan Tergugat sering bertengkar",
      pelaku: "Tergugat",
      lawan: "Penggugat",
    });
    const u1268 = bot.json.saksi.usulan.find((u: any) => u.kode === "1268");
    const j = jaringan({ usulanTiruan: () => bot.json });
    const layar = { "2021": "-   Bahwa saksi tahu", "2022": "-   Bahwa saksi tahu", "0046": "Penggugat", "0047": "Tergugat" };
    const w = bukaBlangko(KODE_CERAI, layar, j.fetch);
    (await tunggu(() => tombolBertulis(w, "Input ke ABT"), "tombol Input ke ABT")).click();
    const k = await tunggu(
      () =>
        (Array.from(panelDari(w).querySelectorAll(".aleta-abt-kartu")) as any[]).find(
          (x) => x.querySelector(".aleta-abt-kode")?.textContent === "1268"
        ),
      "kartu 1268"
    );
    return { w, k, u1268, j };
  }

  it("bot mengirim dua bunyi; kartu menggambarnya tanpa bawaan, centang mati", async () => {
    const { k, u1268 } = await kartu1268();
    expect(u1268.keyakinan).toBe("ragu");
    expect(u1268.pilihan.map((p: any) => p.keadaan)).toEqual(["gagal", "belum-ada"]);
    const pilih = k.querySelector("select.aleta-abt-pilihan-bunyi");
    expect(pilih).not.toBeNull();
    expect(pilih.value).toBe("");
    expect(pilih.options).toHaveLength(3);
    const centang = k.querySelector(".aleta-abt-centang");
    expect(centang.checked).toBe(false);
    expect(centang.disabled).toBe(true);
  });

  it("memilih bunyi menjadikannya nilai dan menyalakan centang; Terapkan menyimpan bunyi itu", async () => {
    const { w, k, u1268, j } = await kartu1268();
    const pilih = k.querySelector("select.aleta-abt-pilihan-bunyi");
    pilih.value = "1";
    pilih.dispatchEvent(new w.Event("change"));
    const centang = k.querySelector(".aleta-abt-centang");
    expect(centang.disabled).toBe(false);
    expect(centang.checked).toBe(true);
    expect(k.querySelector(".aleta-abt-usul .aleta-abt-isi").textContent).toBe(u1268.pilihan[1].nilai);
    // Hanya 1268 yang diterapkan.
    for (const c of Array.from(panelDari(w).querySelectorAll(".aleta-abt-centang")) as any[]) if (c !== centang) c.checked = false;
    tombolBertulis(w, "Terapkan yang dicentang").click();
    await tunggu(() => j.c.editData.length === 1 && j.c.editData, "edit_data 1268");
    expect(j.c.editData[0].noVar).toBe("1268");
  });
});
