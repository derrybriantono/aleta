// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * T2 (25 Okt 2026) - KETERANGAN SAKSI OTOMATIS UNTUK SEMUA JENIS PERKARA
 * ============================================================================
 *
 * "Susun saksi menurut keadaan perkara" di panel ABT hanya meminta fakta perkara untuk cerai (346/347): pada itsbat,
 * dispensasi kawin, wali adhal, asal usul anak, harta bersama, waris, hadhanah, ... variabel katalog yang kosong di ABT
 * (#1217# nama wali, #8171# tujuan, #6087# alasan wali, #0999# hamil, ...) tetap "..." walau posita menyebutnya.
 *
 * Keputusan yang dijaga: POSITA acuan utama (sesudah isian blangko dan data SIPP); sebab/alasan yang hanya didalilkan
 * posita = SARAN (ragu, kuning, keterangan "belum dikuatkan saksi"); tanpa kalimat penutup; sebutan pihak yang kosong
 * dari alur/jenis_perkara_id (sebutanPihakService), bukan "Pemohon" bawaan. Cerai tidak berubah.
 *
 * Seluruh posita, nama, dan nomor di bawah REKAAN.
 */

type Apa = any;
const REPO = path.resolve(__dirname, "../../..");
const muatBot = createRequire(path.join(REPO, "aleta_bot/package.json"));
const Isi: Apa = muatBot(path.join(REPO, "aleta_bot/services/isiJawabanSaksiService.js"));
const Saran: Apa = muatBot(path.join(REPO, "aleta_bot/services/saranSebabSaksi.js"));
const Penutup: Apa = muatBot(path.join(REPO, "aleta_bot/services/penutupSaksi.js"));
const EKS = path.join(REPO, "ekstensi-sipp");
const muat = createRequire(import.meta.url);
const M: Apa = muat(path.join(EKS, "saksi-katalog.js"));
const katalog = (k: string) => JSON.parse(readFileSync(path.join(EKS, "saksi-katalog", `${k}.json`), "utf8"));

const POSITA_ITSBAT = [
  "Bahwa pada tanggal 12 Mei 2010 Pemohon I dan Pemohon II telah melangsungkan pernikahan menurut agama Islam di Desa Sukarekaan, Kecamatan Banawa, Kabupaten Donggala, dengan wali nikah ayah kandung Pemohon II bernama Ahmad Rekaan dan dinikahkan oleh Imam Desa bernama Umar Fiktif, disaksikan oleh dua orang saksi masing-masing bernama Budi Contoh dan Dedi Sampel dengan mahar berupa uang Rp100.000 dibayar tunai;",
  "Bahwa pernikahan Pemohon I dan Pemohon II tidak tercatat pada Kantor Urusan Agama karena kelalaian petugas pencatat nikah;",
  "Bahwa Pemohon I dan Pemohon II membutuhkan penetapan pengesahan nikah untuk keperluan pengurusan akta kelahiran anak;",
].join("\n");
const POSITA_WA = [
  "Bahwa Pemohon hendak menikah dengan seorang laki-laki bernama Rudi Rekaan, umur 27 tahun, pekerjaan petani, yang telah lama dikenal Pemohon;",
  "Bahwa wali nikah Pemohon adalah Ayah Kandung Pemohon yang bernama Hasan Fiktif yang beralamat di Desa Contoh;",
  "Bahwa ayah kandung Pemohon tidak bersedia menjadi wali nikah dengan alasan calon suami Pemohon berasal dari suku yang berbeda;",
].join("\n");
const POSITA_DK = [
  "Bahwa anak Pemohon dan calon suaminya telah saling mengenal selama 2 tahun dan hubungan mereka sudah sedemikian eratnya, bahkan anak Pemohon sedang hamil 3 bulan;",
].join("\n");

const variabel = (jenisPerkara: string, alur: string, posita: string, kode: string[], tambahan: Apa = {}) =>
  Isi.isiBaris({ posita, jenisPerkara, alur, kodeVariabel: kode, saksiIsi: [], ...tambahan }).__variabel || {};

describe("bot: variabel katalog non-cerai dari posita, sebab dalil = saran", () => {
  it("itsbat nikah: nama wali dan saksi nikah terisi; tujuan permohonan = saran (ragu, belum dikuatkan saksi)", () => {
    const v = variabel("360", "16", POSITA_ITSBAT, ["1217", "0650", "8171"]);
    expect(v["1217"].teks).toBe("Ahmad Rekaan");
    expect(v["1217"].saran).toBeUndefined();
    expect(v["0650"].teks).toBe("Budi Contoh");
    expect(v["8171"].teks).toMatch(/akta kelahiran anak/);
    expect(v["8171"].saran).toEqual(["tujuan"]);
    expect(v["8171"].yakin).toBe("ragu");
    expect(v["8171"].ket).toMatch(/belum dikuatkan saksi/);
  });

  it("isian blangko yang sudah diketik petugas bukan saran - posita tidak mengalahkannya", () => {
    const v = variabel("360", "16", POSITA_ITSBAT, ["8171"], { isian: { "8171": { nilai: "pengurusan kartu keluarga", keyakinan: "pasti" } } });
    expect(v["8171"].teks).toBe("pengurusan kartu keluarga");
    expect(v["8171"].saran).toBeUndefined();
    expect(v["8171"].sumber).toMatch(/^isian blangko/);
  });

  it("wali adhal: nama wali dari posita; alasan wali enggan = saran", () => {
    const v = variabel("363", "16", POSITA_WA, ["9200", "1029", "6087"]);
    expect(v["9200"].teks).toBe("Hasan Fiktif");
    expect(v["1029"].teks).toBe("Rudi Rekaan");
    expect(v["9200"].saran).toBeUndefined();
    expect(v["6087"].teks).toMatch(/suku yang berbeda/);
    expect(v["6087"].saran).toEqual(["alasanWali"]);
  });

  it("dispensasi kawin: kehamilan dan eratnya hubungan (alasan mendesak) = saran", () => {
    const v = variabel("362", "16", POSITA_DK, ["0999", "1014"]);
    expect(v["0999"].teks).toBe("3 bulan");
    expect(v["0999"].saran).toEqual(["hamil"]);
    expect(v["1014"].saran).toEqual(["eratHubungan"]);
  });

  it("sumber campuran (data SIPP / isian + gugatan) bukan saran; hanya posita yang saran", () => {
    expect(Saran.sebabBelumDikuatkan([{ kunci: "tujuan", sumber: "data SIPP + gugatan" }])).toEqual([]);
    expect(Saran.sebabBelumDikuatkan([{ kunci: "tujuan", sumber: "gugatan" }])).toEqual(["tujuan"]);
    // fakta identitas/peristiwa (nama wali) dari posita bukan sebab dalil
    expect(Saran.sebabBelumDikuatkan([{ kunci: "waliNama", sumber: "gugatan" }])).toEqual([]);
  });

  it("tidak satu pun nilai berupa kalimat penutup atau memuat nama aplikasi", () => {
    const semua = [
      variabel("360", "16", POSITA_ITSBAT, ["1217", "0650", "0651", "8087", "8171", "5197"]),
      variabel("363", "16", POSITA_WA, ["9200", "1029", "1030", "6331", "6087"]),
      variabel("362", "16", POSITA_DK, ["0999", "1014", "1666"]),
    ].flatMap((x) => Object.values(x) as Apa[]);
    expect(semua.length).toBeGreaterThanOrEqual(8);
    for (const x of semua) {
      expect(Penutup.adalahKalimatPenutupSaksi(x.teks)).toBe(false);
      expect(x.teks).not.toMatch(/aleta/i);
    }
  });
});

describe("bot: sebutan pihak kosong diturunkan dari alur/jenis_perkara_id (satu sumber)", () => {
  it("gugatan harta bersama (alur 15, jenis 348) = Penggugat/Tergugat, bukan 'Pemohon' bawaan", () => {
    expect(Saran.sebutanUntuk({ alur: "15", jenisPerkara: "348" })).toMatchObject({ P: "Penggugat", T: "Tergugat" });
  });
  it("permohonan (alur 16) = Pemohon/Termohon; cerai talak 346 beralur gugatan = Pemohon/Termohon", () => {
    expect(Saran.sebutanUntuk({ alur: "16", jenisPerkara: "360" })).toMatchObject({ P: "Pemohon", T: "Termohon" });
    expect(Saran.sebutanUntuk({ alur: "15", jenisPerkara: "346" })).toMatchObject({ P: "Pemohon", T: "Termohon" });
  });
  it("sebutan dari variabel ABT (#0046#/#0047#) selalu menang", () => {
    expect(Saran.sebutanUntuk({ alur: "15", jenisPerkara: "348", lawan: "Para Penggugat", pelaku: "Para Tergugat" })).toMatchObject({ P: "Para Penggugat", T: "Para Tergugat" });
  });
  it("isiBaris memakai sebutan itu: bentuk pihak pada nilai variabel 7036 mengikuti alur, tanpa kiriman sebutan", () => {
    const g = Isi.isiBaris({ posita: "", jenisPerkara: "348", alur: "15", kodeVariabel: ["7036"], saksiIsi: [], sipp: { pihak1: [{}] } });
    expect(g.__variabel["7036"].teks).toBe("Penggugat");
    const p = Isi.isiBaris({ posita: "", jenisPerkara: "360", alur: "16", kodeVariabel: ["7036"], saksiIsi: [], sipp: { pihak1: [{}, {}] } });
    expect(p.__variabel["7036"].teks).toBe("para Pemohon");
  });
});

describe("mesin katalog: variabel non-cerai dari server mengisi yang KOSONG, saran ditandai kuning", () => {
  const susunItsbat = (nilaiAbt: Record<string, string>, variabelFakta: Apa, jenis = "melihat") => {
    const kat = M.kenaliPaket([katalog("itsbat-nikah")], { jenisPerkaraId: "360", alurPerkaraId: "16", nama: "Istbat Nikah" });
    const v = Object.assign({ "0046": "Pemohon I", "0047": "Pemohon II" }, nilaiAbt);
    return M.susunSaksi(kat, { keadaan: M.keadaanBawaan(kat, {}), benih: "9/Pdt.P/2026/PA.Dgl", saksi: [{ pihak: "P", jenis }, { pihak: "P", jenis }], variabel: (k: string) => v[k], slot: {}, slotSaksi: [{}, {}], fakta: {}, variabelFakta, tingkat: ["inti", "pilihan", "tambahan"] });
  };
  const baris = (h: Apa, butir: string) => h.saksi[0].baris.find((b: Apa) => b.butir === butir);
  const VF = {
    "1217": { teks: "Ahmad Rekaan", yakin: "cukup", sumber: "gugatan", label: "nama wali" },
    "8171": { teks: "keperluan pengurusan akta kelahiran anak", yakin: "ragu", sumber: "gugatan", label: "tujuan perkara", saran: true },
  };

  it("nama wali kosong di ABT terisi dari fakta, bersumber; tujuan bertanda saran dan kuning", () => {
    const h = susunItsbat({}, VF);
    const wali = baris(h, "q-in-wali-pb");
    expect(wali.jawab).toContain("Ahmad Rekaan");
    expect(wali.kosong).not.toContain("#1217#");
    expect(wali.dariGugatan).toEqual([expect.objectContaining({ nama: "#1217#", kunci: "nama wali", sumber: "gugatan" })]);
    const tujuan = baris(h, "q-in-tujuan-pb");
    expect(tujuan.jawab).toContain("akta kelahiran anak");
    expect(tujuan.dariGugatan[0]).toMatchObject({ saran: true, yakin: "ragu" });
    expect(tujuan.tandaKuning).toBe(true);
  });

  it("nilai di ABT selalu menang atas fakta server", () => {
    const h = susunItsbat({ "1217": "Wali Tercatat" }, VF);
    expect(baris(h, "q-in-wali-pb").jawab).toContain("Wali Tercatat");
    expect(baris(h, "q-in-wali-pb").jawab).not.toContain("Ahmad Rekaan");
    expect(baris(h, "q-in-wali-pb").dariGugatan).toEqual([]);
  });

  it("saksi 'ragu' / 'tidak tahu' tidak diberi rincian dari posita", () => {
    for (const jenis of ["ragu", "tidak-tahu"]) {
      const h = susunItsbat({}, VF, jenis);
      for (const b of h.saksi[0].baris) expect(b.jawab).not.toContain("Ahmad Rekaan");
    }
  });

  it("tanpa fakta server: tetap titik-titik, tidak ditebak", () => {
    const wali = baris(susunItsbat({}, {}), "q-in-wali-pb");
    expect(wali.kosong).toContain("#1217#");
    expect(wali.dariGugatan).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Perceraian (keputusan pengguna 23 Okt): aturan saran juga berlaku
// ---------------------------------------------------------------------------

const POSITA_CG = [
  "Bahwa sejak awal tahun 2021 rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat tidak memberikan nafkah yang cukup kepada Penggugat;",
  "Bahwa sejak Juni 2024 Penggugat dan Tergugat telah pisah tempat tinggal;",
].join("\n");
const U: Apa = muatBot(path.join(REPO, "aleta_bot/services/abtUsulanService.js"));
const A1 = [
  { no: "6", tanya: "Kenapa Penggugat mengajukan cerai terhadap Tergugat?", jawab: "Penggugat mengajukan cerai terhadap Tergugat karena sudah tidak rukun dalam rumah tangganya;" },
  { no: "8", tanya: "Apa yang biasa menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat?", jawab: "Yang biasa menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah karena ........;" },
  { no: "11", tanya: "Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?", jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak ....., kira-kira sampai sekarang sudah sekitar ........ tahun;" },
];
const susunCg = (opsi: Apa = {}) =>
  U.susunKeteranganSaksiSdg({ templat: A1, posita: POSITA_CG, pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", kodeKumpulan: "A1", jenisPerkara: "347", alur: "15", modus: { saksi1: { modus: "sama" }, saksi2: { modus: "sama" } }, ...opsi });

describe("perceraian: sebab dari posita = saran, sebab pilihan petugas tidak", () => {
  it("Susun keterangan saksi 1 & 2 (cerai gugat): jawaban penyebab dari posita bertanda saran; jawaban lain tidak", () => {
    const h = susunCg();
    expect(h.asalAlasan).toBe("posita");
    const penyebab = h.saksi[0].jawaban.find((b: Apa) => b.no === "8");
    expect(penyebab.jawab).toMatch(/nafkah/);
    expect(penyebab.saran).toBe(true);
    expect(h.saranSebab.map((x: Apa) => x.no)).toEqual(["8"]);
    expect(h.saksi[0].jawaban.find((b: Apa) => b.no === "11").saran).toBeUndefined();
    expect(h.catatan).toMatch(/belum dikuatkan saksi/);
  });

  it("alasan yang DIPILIH petugas bukan saran; saksi 'tidak tahu' tidak diberi saran sebab", () => {
    expect(susunCg({ alasan: ["nafkah"] }).saranSebab).toEqual([]);
    const h = susunCg({ modus: { saksi1: { modus: "tidak-tahu" }, saksi2: { modus: "tidak-tahu" } } });
    expect(h.saranSebab).toEqual([]);
  });

  it("fakta perkara cerai untuk penyusun katalog: penyebab dari gugatan = saran (ragu)", () => {
    const f = Isi.faktaPerkara({ posita: POSITA_CG, jenisPerkara: "347", alur: "15", pelaku: "Tergugat", lawan: "Penggugat" });
    expect(f.penyebab.nilai).toMatch(/nafkah/);
    expect(f.penyebab.saran).toEqual(["penyebab"]);
    expect(f.penyebab.yakin).toBe("ragu");
    // fakta bukan sebab (pisah sejak) tidak berubah
    expect(f.pisahSejak?.saran).toBeUndefined();
  });

  it("mesin katalog cerai gugat: penyebab bertanda saran dan kuning; variabel #5227# yang terisi tetap menang", () => {
    const kat = M.kenaliPaket([katalog("cerai-gugat")], { jenisPerkaraId: "347", alurPerkaraId: "15", nama: "Cerai Gugat" });
    const keadaan = Object.assign(M.keadaanBawaan(kat, {}), { kehadiran: "kontradiktoir", alasan: ["F"], suami: "lawan" });
    const fakta = { penyebab: { nilai: "Tergugat tidak memberikan nafkah yang cukup", yakin: "ragu", sumber: "gugatan", ket: "", saran: true } };
    const jalan = (v: Record<string, string>) =>
      M.susunSaksi(kat, { keadaan, benih: "3/Pdt.G/2026/PA.Dgl", saksi: [{ pihak: "P", jenis: "melihat" }], variabel: (k: string) => ({ "0046": "Penggugat", "0047": "Tergugat", ...v })[k], slot: {}, slotSaksi: [{}], fakta, tingkat: ["inti", "pilihan", "tambahan"] });
    const b = jalan({}).saksi[0].baris.find((x: Apa) => x.butir === "q-penyebab");
    expect(b.jawab).toMatch(/nafkah yang cukup/);
    expect(b.dariGugatan).toEqual([expect.objectContaining({ kunci: "penyebab", saran: true, yakin: "ragu" })]);
    expect(b.tandaKuning).toBe(true);
    const terisi = jalan({ "5227": "Tergugat sering mabuk" }).saksi[0].baris.find((x: Apa) => x.butir === "q-penyebab");
    expect(terisi.jawab).toMatch(/sering mabuk/);
    expect(terisi.dariGugatan).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Panel ABT (jsdom): "Susun saksi" meminta fakta untuk jenis non-cerai
// ---------------------------------------------------------------------------

const baca = (n: string) => readFileSync(path.join(EKS, n), "utf8");
const SUMBER_EKSTENSI = ["panel-alat.js", "saksi-katalog.js", "saksi-katalog-data.js", "saksi-susun.js", "blangko-derry-jawab-katalog.js", "abt.js"].map(baca).join("\n;\n");
const KODE = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0047 1217 8171 0650 0651 8087 5197 5105 1046 1241 1242 0032 0033".split(" ");
const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

function buka(isi: Record<string, string>, fetchBuatan: (alamat: string, o?: Apa) => Promise<Apa>, nomor = "9/Pdt.P/2026/PA.Dgl") {
  const barisHtml = KODE.map((k) => `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in isi ? isi[k] : `isi ${k}`}</td><td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`).join("");
  const dom = new JSDOM(`<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>${nomor}</span></h3><table>${barisHtml}</table></div></div></body></html>`, {
    url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3",
    runScripts: "outside-only",
  });
  halaman.push(dom);
  const w = dom.window as Apa;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: { local: { get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async (b: Record<string, unknown>) => void Object.assign(simpanan, b), remove: async () => {} }, onChanged: { addListener: () => {} } },
  };
  w.Response = globalThis.Response;
  w.fetch = fetchBuatan;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""); } });
  w.eval(`${SUMBER_EKSTENSI}\n;\nwindow.__uji = { mode: () => alatUjiMode(), tahanPost: (nilai) => { alatCobaMenahan = () => nilai; } };`);
  return w;
}
const tunggu = async (kondisi: () => boolean, pesan: string) => {
  for (let i = 0; i < 300; i += 1) {
    if (kondisi()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};
const TOMBOL = "Susun saksi menurut keadaan perkara";
const tombolDi = (akar: Apa, teks: string) => Array.from(akar.querySelectorAll("button")).find((b: Apa) => b.textContent === teks) as Apa;

describe("panel ABT: Susun saksi itsbat nikah memakai fakta perkara dari server", () => {
  it("variabel kosong dikirim sebagai kodeVariabel; jawaban terisi; tujuan tampil sebagai saran", async () => {
    const dipanggil: Apa[] = [];
    const simpanAbt: Array<{ alamat: string; badan: string }> = [];
    const fetchBuatan = async (alamat: string, o?: Apa) => {
      const jawab = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
      if (o && o.method === "POST" && /tanyajawab_perkara_edit/.test(alamat)) {
        simpanAbt.push({ alamat, badan: String(o.body) });
        return { ok: true, status: 200, text: async () => "Tanya Jawab Disimpan", json: async () => ({}), clone() { return this; } };
      }
      if (/aleta-bot\/abt\/usulan/.test(alamat)) {
        const m = JSON.parse((o && o.body) || "{}");
        dipanggil.push(m);
        if (m.sumber === "isi-jawaban" && m.mintaFakta === true) {
          // jawaban bot SUNGGUHAN atas posita rekaan, seperti rute 'isi-jawaban' (isiBaris + faktaPerkara)
          const isiJawaban = Isi.isiBaris({ ...m, posita: POSITA_ITSBAT });
          return jawab({ data: { available: true, isiJawaban, faktaPerkara: Isi.faktaPerkara({ ...m, posita: POSITA_ITSBAT }) } });
        }
        return jawab({ data: { available: true } });
      }
      return jawab({ ok: false }, 404);
    };
    const w = buka({ "0048": "Pengesahan Perkawinan/Istbat Nikah", "0046": "Pemohon I", "0047": "Pemohon II", "1217": "", "8171": "", "0650": "", "0651": "", "5125": POSITA_ITSBAT }, fetchBuatan);
    await tunggu(() => Boolean(w.document.getElementById("aleta-panel-abt")), "panel");
    const panel = w.document.getElementById("aleta-panel-abt");
    await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog itsbat");
    tombolDi(panel, TOMBOL).click();
    await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "borang");
    const wadah = panel.querySelector(".aleta-ssk");
    tombolDi(wadah, "Susun pertanyaan dan jawaban").click();
    await tunggu(() => wadah.querySelectorAll(".aleta-ssk-saksi").length === 2, "dua saksi");

    // butir penutup katalog tidak ditampilkan (keputusan pengguna 23 Okt)
    const idPenutup = katalog("itsbat-nikah").pertanyaan.filter((q: Apa) => q.kelompok === "penutup").map((q: Apa) => q.id);
    expect(idPenutup.length).toBeGreaterThan(0);
    const tampil = Array.from(wadah.querySelectorAll(".aleta-ssk-baris")).map((b: Apa) => b.getAttribute("data-butir"));
    expect(tampil.length).toBeGreaterThan(10);
    for (const id of idPenutup) expect(tampil).not.toContain(id);
    const nomor = Array.from(wadah.querySelectorAll(".aleta-ssk-saksi")[0].querySelectorAll(".aleta-ssk-tanya")).map((t: Apa) => Number(String(t.textContent).split(".")[0]));
    expect(nomor).toEqual(nomor.map((_, i) => i + 1));

    const minta = dipanggil.find((m) => m.sumber === "isi-jawaban" && m.mintaFakta === true);
    expect(minta).toBeTruthy();
    expect(minta.jenisPerkara).toBe("360");
    expect(minta.kodeVariabel).toEqual(expect.arrayContaining(["1217", "8171", "0650"]));
    // sebutan dan variabel yang sudah terisi tidak diminta
    expect(minta.kodeVariabel).not.toContain("0046");
    expect(minta.kodeVariabel).not.toContain("0048");

    const jawabDi = (butir: string) => (wadah.querySelector(`.aleta-ssk-saksi .aleta-ssk-baris[data-butir="${butir}"] textarea`) as Apa)?.value as string;
    expect(jawabDi("q-in-wali-pb") ?? jawabDi("q-in-wali-lw") ?? jawabDi("q-in-wali-pm")).toContain("Ahmad Rekaan");
    const barisTujuan = Array.from(wadah.querySelectorAll(".aleta-ssk-saksi .aleta-ssk-baris")).find((b: Apa) => /^q-in-tujuan/.test(b.getAttribute("data-butir"))) as Apa;
    expect(barisTujuan.querySelector("textarea").value).toMatch(/akta kelahiran anak/);
    const ket = barisTujuan.querySelector("[data-sumber-fakta]");
    expect(ket.getAttribute("data-saran")).toBe("1");
    expect(ket.textContent).toMatch(/Saran dari gugatan/);
    expect(ket.textContent).toMatch(/belum dikuatkan saksi/);
    expect(barisTujuan.classList.contains("aleta-ssk-kuning")).toBe(true);
    // tanpa kalimat penutup dan tanpa nama aplikasi di yang SUNGGUH dikirim ke ABT
    w.__uji.tahanPost(false);
    tombolDi(wadah, "Simpan ke ABT").click();
    await tunggu(() => simpanAbt.length === 2, "dua permintaan simpan");
    const data = simpanAbt.flatMap((x) => JSON.parse(new URLSearchParams(x.badan).get("data") as string)) as Array<{ tanya: string; jawab: string }>;
    expect(data.length).toBeGreaterThanOrEqual(10);
    expect(data.some((b) => /Ahmad Rekaan/.test(b.jawab))).toBe(true);
    for (const b of data) expect(Penutup.adalahKalimatPenutupSaksi(b.jawab, b.tanya), b.jawab).toBe(false);
    expect(JSON.stringify(simpanAbt)).not.toMatch(/aleta/i);
  });
});
