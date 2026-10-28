// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - "LIHAT SEBAGAI" SATU ORANG SATU ENTRI, DAN BLANGKO DIKUNCI PER PERAN
 * ============================================================================
 *
 * Temuan pengguna (hakim, super admin) pada panel Blangko ABT by Derry Briantono:
 *
 *   1  Pemilih "Lihat sebagai" memuat orang yang sama berkali-kali: "Derry Briantono" dan "Derry Briantono, S.H.",
 *      "Idris" dan "Idris, S.H.I., M.H." ... Sebabnya nama petugas di jadwal sidang disalin PER PERKARA
 *      (perkara_hakim_pn.hakim_nama dst.) dengan ejaan gelar berbeda. Kini disatukan menurut kunci orang
 *      (lib/orang-unik), nama terlengkap ditampilkan, orang mutasi/nonaktif tidak ditawarkan.
 *   2  Admin memilih BAS pada "Semua akun", lalu pindah "Lihat sebagai" hakim: panel hakim masih menampilkan BAS
 *      ("Akun Anda hanya dapat melihat; berita acara sidang ditulis Panitera Pengganti"), dan saran blangko hakim
 *      menyebut berita acara. Pilihan blangko kini dikunci per PERAN; saran mengikuti peran yang dilihat.
 *
 * Yang dijalankan sungguhan: fungsi murni orang-unik, susunPerkaraSaya (rute perkara-saya), dan ekstensi
 * (blangko-derry.js + blangko-derry-isian.js) di jsdom.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunPerkaraSaya, sebagaiApa, type BarisSidangSaya } from "@/app/api/aleta-ecourt/perkara-saya/susun";
import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { kunciAkunTidakAktif, kunciOrang, kunciTidakAktif, namaTerbaik, orangSama, rapikanNama, satukanOrang, saringAktif, sippTidakAktif } from "@/lib/orang-unik";

// ----------------------------------------------------------------------------
// Bahan: nama sungguhan PA Donggala (perkara_hakim_pn, diukur 20 Okt 2026, hanya nama)
// ----------------------------------------------------------------------------
const HAKIM_MENTAH = [
  "Derry Briantono", "Derry Briantono, S.H.",
  "Fahri Saifuddin", "Fahri Saifuddin, S.H.I., M.H.",
  "Himawan Tatura Wijaya", "Himawan Tatura Wijaya, S.H.I., M.H.", "Himawan Tatura Wijaya, S.H.I.,M.H.", "Himawan Tatura Wijaya. S.H.I.,M.H.",
  "Idris", "Idris, S.H.I., M.H.", "Idris,S.H.I.,M.H.",
  "Sudarmin H.I.M. Tang", "Sudarmin H.I.M. Tang, S.H.I.,M.H",
  "M. Tang", "Drs. M. Tang, M.H.",
  "Akbar  Ali, S.H.I.", "Akbar Ali", "Akbar Ali, S.H.I.",
  "Mazidah", "Mazidah, S.Ag., M.H.", "Mazidah, S.Ag.,M.H.",
  "Dra. Hj. St. Hasmah, M.H.", "St. Hasmah",
  "Abd. Hamid Sanewing", "Drs. H. Abd. Hamid Sanewing, M.H.",
  "Ruhana  Faried", "Ruhana  Faried, S.H.I., M.H.I.", "Ruhana Faried, S.H.I., M.H.I.",
];

describe("1. orang-unik: satu orang satu entri", () => {
  it("ejaan berbeda (gelar ada/tidak, koma/titik, spasi ganda) menjadi satu entri bernama lengkap", () => {
    const hasil = satukanOrang(HAKIM_MENTAH);
    const nama = hasil.map((o) => o.nama);
    expect(nama).toContain("Derry Briantono, S.H.");
    expect(nama).toContain("Fahri Saifuddin, S.H.I., M.H.");
    expect(nama).toContain("Himawan Tatura Wijaya, S.H.I., M.H.");
    expect(nama).toContain("Idris, S.H.I., M.H.");
    expect(nama).toContain("Sudarmin H.I.M. Tang, S.H.I., M.H");
    expect(nama).toContain("Akbar Ali, S.H.I.");
    expect(nama).toContain("Mazidah, S.Ag., M.H.");
    expect(nama).toContain("Ruhana Faried, S.H.I., M.H.I.");
    // 12 orang berbeda dari 28 tulisan: Derry, Fahri, Himawan, Idris, Sudarmin, M. Tang, Akbar, Mazidah, Hasmah, Abd. Hamid, Ruhana.
    expect(hasil).toHaveLength(11);
    // Tidak ada dua entri yang menunjuk orang yang sama.
    for (const a of hasil) for (const b of hasil) if (a !== b) expect(orangSama(a.nama, b.nama)).toBe(false);
  });

  it("dua orang berbeda tidak ikut menyatu: 'M. Tang' dan 'Sudarmin H.I.M. Tang'", () => {
    expect(kunciOrang("M. Tang")).toBe("tang");
    expect(kunciOrang("Drs. M. Tang, M.H.")).toBe("tang");
    expect(kunciOrang("Sudarmin H.I.M. Tang, S.H.I.,M.H")).toBe("sudarmin tang");
    expect(orangSama("M. Tang", "Sudarmin H.I.M. Tang")).toBe(false);
    expect(satukanOrang(["M. Tang", "Sudarmin H.I.M. Tang", "Drs. M. Tang, M.H."]).map((o) => o.nama)).toEqual(["Drs. M. Tang, M.H.", "Sudarmin H.I.M. Tang"]);
  });

  it("varian dipertahankan untuk pencarian lewat nama; nama terbaik = gelar terlengkap lalu tulisan rapi", () => {
    const [himawan] = satukanOrang(["Himawan Tatura Wijaya. S.H.I.,M.H.", "Himawan Tatura Wijaya", "Himawan Tatura Wijaya, S.H.I., M.H.", "Himawan Tatura Wijaya, S.H.I.,M.H."]);
    expect(himawan.nama).toBe("Himawan Tatura Wijaya, S.H.I., M.H.");
    expect(himawan.varian).toHaveLength(4);
    expect(namaTerbaik(["Idris", "Idris,S.H.I.,M.H."])).toBe("Idris, S.H.I., M.H.");
    expect(rapikanNama("Akbar  Ali ,S.H.I.")).toBe("Akbar Ali, S.H.I.");
  });

  it("nama kosong/nol dilewati; nama pendek tak jatuh ke kunci kosong yang menyatukan orang asing", () => {
    expect(satukanOrang(["", "  ", "Ab", "Cd"]).map((o) => o.nama)).toEqual(["Ab", "Cd"]);
    expect(kunciOrang("")).toBe("");
  });
});

describe("2. keaktifan: SIPP dan akun ALETA", () => {
  it("SIPP: hanya 'Y' aktif; 'T'/'N' tidak; kosong dianggap aktif (tak ada bukti)", () => {
    expect(sippTidakAktif("T")).toBe(true);
    expect(sippTidakAktif("N")).toBe(true);
    expect(sippTidakAktif("Y")).toBe(false);
    expect(sippTidakAktif("")).toBe(false);
    expect(sippTidakAktif(null)).toBe(false);
  });

  it("induk SIPP: orang nonaktif hanya bila SEMUA barisnya nonaktif (Munifa tiga id, Mazidah dua id)", () => {
    const tidak = kunciTidakAktif([
      { nama: "Munifa", aktif: "T" }, { nama: "Munifa", aktif: "T" }, { nama: "Munifa", aktif: "Y" },
      { nama: "Mazidah", aktif: "T" }, { nama: "Mazidah", aktif: "T" },
      { nama: "Derry Briantono", aktif: "Y" },
      { nama: "Mohammad syukri, S.H.", aktif: "T" }, { nama: "Mohammad Syukri", aktif: "Y" },
    ]);
    expect(tidak.has(kunciOrang("Munifa"))).toBe(false);
    expect(tidak.has(kunciOrang("Mazidah, S.Ag., M.H."))).toBe(true);
    expect(tidak.has(kunciOrang("Derry Briantono, S.H."))).toBe(false);
    expect(tidak.has(kunciOrang("Mohammad Syukri"))).toBe(false);
  });

  it("akun ALETA: nonaktif atau terhapus disembunyikan; akun ganda (satu aktif) tetap tampil", () => {
    const tidak = kunciAkunTidakAktif([
      { name: "Mannaria, S.H.", isActive: 0 },
      { name: "Nuniek Widriyani", isActive: 1, deletedAt: "2026-10-01" },
      { name: "Sudirman B", isActive: 0 }, { name: "Sudirman B, S.H.", isActive: 0 },
      { name: "Derry Briantono", isActive: 0 }, { name: "Derry Briantono, S.H.", isActive: 1 },
      { name: "Idris, S.H.I., M.H.", isActive: 1, deletedAt: null },
    ]);
    expect([...tidak].sort()).toEqual([kunciOrang("Mannaria"), kunciOrang("Nuniek Widriyani"), kunciOrang("Sudirman B")].sort());
  });

  it("saringAktif membuang orang di himpunan mana pun", () => {
    const orang = satukanOrang(["Mannaria", "Derry Briantono, S.H.", "Idris"]);
    const hasil = saringAktif(orang, new Set([kunciOrang("Mannaria")]), undefined, new Set([kunciOrang("Idris")]));
    expect(hasil.map((o) => o.nama)).toEqual(["Derry Briantono, S.H."]);
  });
});

// ----------------------------------------------------------------------------
// 3. Rute perkara-saya (susunPerkaraSaya)
// ----------------------------------------------------------------------------
const B = (perkaraId: string, nomor: string, majelis: string, pp: string, js: string, extra: Partial<BarisSidangSaya> = {}): BarisSidangSaya => ({
  sidangId: `s${perkaraId}`, perkaraId, nomorPerkara: nomor, jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, tanggalSidang: "2026-10-20", jamSidang: "09:00", agenda: "Pemeriksaan",
  urutanSidang: 1, majelisNama: majelis, paniteraNama: pp, jurusitaNama: js, ...extra,
});
const BARIS: BarisSidangSaya[] = [
  B("1", "101/Pdt.G/2026/PA.Dgl", "Derry Briantono, S.H.", "Sri Susilowati, S.H.", "Mohammad Syukri"),
  B("2", "102/Pdt.G/2026/PA.Dgl", "Derry Briantono", "Sri Susilowati, S.H.", "Mohammad Syukri, S.H."),
  B("3", "103/Pdt.G/2026/PA.Dgl", "Idris, S.H.I., M.H., Himawan Tatura Wijaya, S.H.I.,M.H.", "Mannaria", "Mustini"),
  B("4", "104/Pdt.G/2026/PA.Dgl", "Idris,S.H.I.,M.H., Himawan Tatura Wijaya. S.H.I.,M.H.", "Mannaria, S.H.", "Mustini"),
  B("5", "105/Pdt.G/2026/PA.Dgl", "Sudarmin H.I.M. Tang", "Nuniek Widriyani", "Mustini"),
  B("6", "106/Pdt.G/2026/PA.Dgl", "Sudarmin H.I.M. Tang, S.H.I.,M.H", "Sri Susilowati, S.H.", "Mustini"),
  B("7", "107/Pdt.G/2026/PA.Dgl", "Drs. M. Tang, M.H.", "Sri Susilowati, S.H.", "jsp5"),
];
const ADMIN = { hariIni: "2026-10-20", nama: "Super Admin", lihatSemua: true };

describe("3. rute perkara-saya: daftar akun satu entri per orang", () => {
  it("tanpa saringan: tiap orang satu kali, bernama lengkap (bukan kembar bergelar/tidak)", () => {
    const h = susunPerkaraSaya(BARIS, ADMIN);
    expect(h.akun!.hakim).toEqual([
      "Derry Briantono, S.H.",
      "Drs. M. Tang, M.H.",
      "Himawan Tatura Wijaya, S.H.I., M.H.",
      "Idris, S.H.I., M.H.",
      "Sudarmin H.I.M. Tang, S.H.I., M.H",
    ]);
    expect(h.akun!.pp).toEqual(["Mannaria, S.H.", "Nuniek Widriyani", "Sri Susilowati, S.H."]);
    expect(h.akun!.js).toEqual(["jsp5", "Mohammad Syukri, S.H.", "Mustini"].sort((a, b) => a.localeCompare(b, "id")));
  });

  it("orang mutasi/nonaktif tidak ditawarkan (akun ALETA dan induk SIPP); pilihan lain utuh", () => {
    const h = susunPerkaraSaya(BARIS, {
      ...ADMIN,
      tidakAktif: {
        semua: kunciAkunTidakAktif([{ name: "Mannaria, S.H.", isActive: 0 }, { name: "Nuniek Widriyani", isActive: 0 }]),
        js: kunciTidakAktif([{ nama: "MUSTINI", aktif: "T" }]),
      },
    });
    expect(h.akun!.pp).toEqual(["Sri Susilowati, S.H."]);
    expect(h.akun!.js).not.toContain("Mustini");
    expect(h.akun!.hakim).toHaveLength(5);
    // Daftar perkara admin tidak ikut menyusut: yang disaring hanya pemilih.
    expect(h.perkara).toHaveLength(7);
  });

  it("nilai pilihan (nama bergelar) mendapatkan perkara SEMUA ejaan orang itu - 2 perkara Derry, bukan hanya yang bergelar", () => {
    const derry = susunPerkaraSaya(BARIS, { ...ADMIN, sebagaiNama: "Derry Briantono, S.H.", sebagaiPeran: "hakim" });
    expect(derry.perkara.map((p) => p.nomorPerkara)).toEqual(["101/Pdt.G/2026/PA.Dgl", "102/Pdt.G/2026/PA.Dgl"]);
    const idris = susunPerkaraSaya(BARIS, { ...ADMIN, sebagaiNama: "Idris, S.H.I., M.H.", sebagaiPeran: "hakim" });
    expect(idris.perkara.map((p) => p.nomorPerkara)).toEqual(["103/Pdt.G/2026/PA.Dgl", "104/Pdt.G/2026/PA.Dgl"]);
    const sudarmin = susunPerkaraSaya(BARIS, { ...ADMIN, sebagaiNama: "Sudarmin H.I.M. Tang, S.H.I., M.H", sebagaiPeran: "hakim" });
    expect(sudarmin.perkara.map((p) => p.nomorPerkara)).toEqual(["105/Pdt.G/2026/PA.Dgl", "106/Pdt.G/2026/PA.Dgl"]);
    // M. Tang tetap perkara 107 saja - tidak ikut perkara Sudarmin.
    const tang = susunPerkaraSaya(BARIS, { ...ADMIN, sebagaiNama: "Drs. M. Tang, M.H.", sebagaiPeran: "hakim" });
    expect(tang.perkara.map((p) => p.nomorPerkara)).toEqual(["107/Pdt.G/2026/PA.Dgl"]);
    expect(sebagaiApa(BARIS[1], "Derry Briantono, S.H.", "hakim")).toEqual(["hakim"]);
  });

  it("bukan admin: tidak menerima daftar akun (hak tidak berubah)", () => {
    const h = susunPerkaraSaya(BARIS, { hariIni: "2026-10-20", nama: "Derry Briantono, S.H.", lihatSemua: false });
    expect(h.akun).toBeNull();
    expect(h.perkara.map((p) => p.nomorPerkara)).toEqual(["101/Pdt.G/2026/PA.Dgl", "102/Pdt.G/2026/PA.Dgl"]);
  });
});

// ----------------------------------------------------------------------------
// 4. Ekstensi di jsdom
// ----------------------------------------------------------------------------
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-isian.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-20";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
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
    await tunggu(5);
  }
}

const BLANGKO_PUT = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const BLANGKO_BAS = "BAS ALUR 17 IN 2+ Sidang - [3] Sidang Terakhir";
const KATALOG = new Map<string, Definisi>([
  ["0001", { kode: "0001", nama: "No Perkara", jenis: "data_sipp", sql: "", bawaan: "" }],
  ["0046", { kode: "0046", nama: "Pemohon/ Penggugat", jenis: "data_sql", sql: "select ...", bawaan: "" }],
]);
const PENANDA = ["0001", "0046"];

// Daftar akun SENGAJA kembar seperti jawaban server lama: ekstensi tetap harus menampilkan satu entri per orang.
const AKUN_KEMBAR = {
  hakim: ["Derry Briantono", "Derry Briantono, S.H.", "Fahri Saifuddin", "Fahri Saifuddin, S.H.I., M.H.", "Himawan Tatura Wijaya", "Himawan Tatura Wijaya, S.H.I., M.H.", "Himawan Tatura Wijaya, S.H.I.,M.H.", "Idris", "Idris, S.H.I., M.H.", "Sudarmin H.I.M. Tang", "Sudarmin H.I.M. Tang, S.H.I.,M.H"],
  pp: ["Sri Susilowati", "Sri Susilowati, S.H."],
  js: ["Mustini"],
};
const PERKARA_228 = {
  nomorPerkara: "228/Pdt.P/2026/PA.Dgl", perkaraId: "10228", jenisPerkara: "Itsbat Nikah", alurPerkaraId: 17, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Derry Briantono, S.H.", paniteraNama: "Sri Susilowati, S.H.", jurusitaNama: "Mustini",
  pihak: { penggugat: ["Pemohon Satu"], tergugat: [] },
  sidang: [
    { sidangId: "s1", tanggal: "2026-10-13", jam: "09:00", agenda: "Sidang Pertama", ket: "", ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "" },
    { sidangId: "s2", tanggal: HARI_INI, jam: "09:00", agenda: "Pemeriksaan pokok perkara", ket: "", ditunda: false, urutan: 2, hadir: null, adaBas: null, ruangan: "" },
  ],
};
const ADMINAKUN = { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] };
const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(1 Blangko)">Putusan IN</a><a href="${BERANDA}?a=D2&c=" title="(1 Blangko)">BAS IN</a></div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");

type Halaman = { dom: JSDOM; w: any; minta: string[] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { hakimBoleh?: boolean } = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Administrator</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.16" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb && cb({ ok: true, id: 1 }), lastError: undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = simpanan[k];
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: string[] = [];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push(url);
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...ADMINAKUN, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const q = new URL(url, ASAL).searchParams;
      const peran = q.get("peranSebagai") || "";
      return json({
        ok: true,
        data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: true, nama: ADMINAKUN.nama, sebagaiNama: q.get("sebagai") || "", sebagaiPeran: peran || null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: AKUN_KEMBAR, perkara: [{ ...PERKARA_228, sebagai: peran ? [peran] : ["hakim", "pp", "js"] }] },
      });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: PERKARA_228.sidang.map((s) => ({ sidangId: s.sidangId, tanggalSidang: s.tanggal, jamSidang: "09:00:00", agenda: s.agenda, alasanDitunda: "", urutanSidang: s.urutan })) } } });
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      // Saklar Pengaturan SIPP & ABT "Hakim boleh membuka folder BAS": menyala - inilah yang dulu membuat saran hakim jatuh ke BAS.
      if (q.get("hak") === "1") return json({ ok: true, data: { ada: true, saklar: { hakimBas: p.hakimBoleh !== false, ppPutusan: false }, folder: [] } });
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "Putusan IN", jenis: "put", berkas: [`${BLANGKO_PUT}.rtf`] }, { nama: "BAS IN", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`] }], sumber: "pohon", sebab: "" } });
      const s = susunIsian(PENANDA, KATALOG, { P: "Pemohon", T: "Termohon" });
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${q.get("berkas")}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s } });
    }
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan IN", [[BLANGKO_PUT, "A01", "B01"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS IN", [[BLANGKO_BAS, "A11", "B11"]]));
    if (url === `${ABT}/main/cari` && cara === "POST") return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, minta };
}

const D_ = (h: Halaman) => h.w.document as Document;
const akar = (h: Halaman) => D_(h).getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
const kerangka = (h: Halaman) => h.w.aletaBlangkoDerry;
const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const blangkoTerpilih = (h: Halaman) => isian(h).keadaan().blangko as { berkas: string; jenis: string } | null;
const teksSaran = (h: Halaman) => (q(h, "#bd-saranblangko")?.textContent || "").replace(/\s+/g, " ");

async function bukaDerry(h: Halaman) {
  await sampai(() => kerangka(h).keadaan().peran.length, "akun terbaca");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar perkara");
}
async function pilihPerkara228(h: Halaman) {
  await sampai(() => q(h, '[data-pk="228/Pdt.P/2026/PA.Dgl"]'), "kartu 228");
  klik(h, '[data-pk="228/Pdt.P/2026/PA.Dgl"]');
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
async function lihatSebagai(h: Halaman, nilai: string) {
  const sel = q(h, "#bd-lihat") as HTMLSelectElement;
  sel.value = nilai;
  expect(sel.value).toBe(nilai);
  sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
  const nama = nilai.split("|").slice(1).join("|");
  // Daftar dapat datang dari server atau dari singgahan ekstensi; yang ditunggu: judul memuat nama itu dan kartu perkara tergambar.
  await sampai(() => (q(h, "#bd-siapa")?.textContent || "").includes(`dilihat sebagai ${nama}`) && q(h, "[data-pk]"), `daftar sebagai ${nama}`);
}
/** Pilih blangko lewat jendela Pilih blangko (sengaja, bukan saran). */
async function pilihLewatJendela(h: Halaman, jenis: "put" | "bas", berkas: string) {
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, "#bd-modal:not([hidden])"), "modal");
  const tab = q(h, `[data-jenismodal="${jenis}"]`);
  if (tab) tab.click();
  // Dicari lewat atribut (mesin selektor jsdom tersandung pada "+" di nilai atribut).
  const tombolBerkas = () => (Array.from(akar(h).querySelectorAll("[data-bl]")) as HTMLElement[]).find((e) => e.getAttribute("data-bl") === berkas) || null;
  await sampai(tombolBerkas, `berkas ${berkas}`);
  tombolBerkas()!.click();
  await sampai(() => blangkoTerpilih(h)?.berkas === berkas, "blangko terpilih");
}

describe("4. ekstensi: pemilih Lihat sebagai", () => {
  it("daftar kembar dari server tetap tampil SATU entri per orang, bernama lengkap; tiap kelompok peran utuh", async () => {
    const h = buka();
    await bukaDerry(h);
    const sel = q(h, "#bd-lihat") as HTMLSelectElement;
    const nilai = Array.from(sel.options).map((o) => o.value);
    expect(nilai).toEqual([
      "",
      "hakim|Derry Briantono, S.H.",
      "hakim|Fahri Saifuddin, S.H.I., M.H.",
      "hakim|Himawan Tatura Wijaya, S.H.I., M.H.",
      "hakim|Idris, S.H.I., M.H.",
      "hakim|Sudarmin H.I.M. Tang, S.H.I., M.H",
      "pp|Sri Susilowati, S.H.",
      "js|Mustini",
      // 28 Okt 2026: pilihan umum PTSP selalu ada (juga tanpa akun PTSP).
      "ptsp|Semua petugas PTSP",
    ]);
  });

  it("kunciOrang di ekstensi sama dengan lib/orang-unik untuk semua nama sungguhan", async () => {
    const h = buka();
    await sampai(() => kerangka(h)?.murni?.kunciOrang, "murni");
    for (const n of HAKIM_MENTAH) expect(kerangka(h).murni.kunciOrang(n)).toBe(kunciOrang(n));
    // Ekstensi mempertahankan urutan kemunculan (server sudah mengurutkan); isinya sama dengan lib.
    expect([...kerangka(h).murni.satukanOrang(HAKIM_MENTAH)].sort()).toEqual(satukanOrang(HAKIM_MENTAH).map((o) => o.nama).sort());
  });

  it("pilihan tetap menunjuk entri yang sama walau daftar baru menulis ejaan lain (tanpa entri kembar)", async () => {
    const h = buka();
    await bukaDerry(h);
    await lihatSebagai(h, "hakim|Derry Briantono, S.H.");
    // Pilihan tersimpan memakai ejaan tanpa gelar (mis. dari rentang tanggal lain): dicocokkan lewat kunci orang.
    h.w.aletaBlangkoDerry.keadaan(); // keadaan dapat dibaca
    const sel = q(h, "#bd-lihat") as HTMLSelectElement;
    const jumlahDerry = Array.from(sel.options).filter((o) => /Derry/.test(o.value)).length;
    expect(jumlahDerry).toBe(1);
    expect(sel.value).toBe("hakim|Derry Briantono, S.H.");
  });
});

describe("5. ekstensi: pilihan blangko dikunci per peran", () => {
  it("BAS dipilih pada 'Semua akun' lalu pindah Lihat sebagai hakim: BAS dibuang, saran mengikuti hakim (putusan), tanpa peringatan 'hanya dapat melihat'", async () => {
    const h = buka({ hakimBoleh: true });
    await bukaDerry(h);
    await pilihPerkara228(h);
    await pilihLewatJendela(h, "bas", BLANGKO_BAS);
    expect(blangkoTerpilih(h)!.jenis).toBe("bas");

    await lihatSebagai(h, "hakim|Derry Briantono, S.H.");
    expect(blangkoTerpilih(h)).toBeNull();
    expect(isian(h).keadaan().pk).toBeNull();
    await pilihPerkara228(h);
    expect(blangkoTerpilih(h)).toBeNull();
    const saran = await sampai(() => teksSaran(h), "kalimat saran");
    expect(saran).not.toMatch(/berita acara sidang/i);
    expect(saran).toMatch(/putusan atau penetapan|\[01\]|Kabul/i);
    expect(q(h, "#bd-perlu")?.textContent || "").not.toMatch(/hanya dapat melihat/);
    expect(akar(h).textContent).not.toMatch(/Akun Anda hanya dapat melihat; berita acara/);
  });

  it("pindah ke Panitera Pengganti: saran BAS; pindah kembali ke hakim: kembali putusan", async () => {
    const h = buka({ hakimBoleh: true });
    await bukaDerry(h);
    await lihatSebagai(h, "hakim|Derry Briantono, S.H.");
    await pilihPerkara228(h);
    expect(teksSaran(h)).not.toMatch(/berita acara sidang/i);

    await lihatSebagai(h, "pp|Sri Susilowati, S.H.");
    await pilihPerkara228(h);
    expect(teksSaran(h)).toMatch(/berita acara sidang|BAS ALUR 17/i);
    expect(teksSaran(h)).not.toMatch(/putusan atau penetapan/i);

    await lihatSebagai(h, "hakim|Derry Briantono, S.H.");
    await pilihPerkara228(h);
    expect(teksSaran(h)).not.toMatch(/berita acara sidang/i);
  });

  it("hakim yang SENGAJA memilih BAS lewat Pilih blangko (saklar menyala) tetap terpilih dan boleh melihat peringatan; ganti peran membuangnya", async () => {
    const h = buka({ hakimBoleh: true });
    await bukaDerry(h);
    await lihatSebagai(h, "hakim|Derry Briantono, S.H.");
    await pilihPerkara228(h);
    await pilihLewatJendela(h, "bas", BLANGKO_BAS);
    expect(blangkoTerpilih(h)!.jenis).toBe("bas");
    expect(blangkoTerpilih(h)).toMatchObject({ peranKunci: "adm:hakim" });
    // Ganti akun yang dilihat melepas perkara (daftarnya milik akun lain): pilihan blangko harus diulang untuk perkara yang dipilih berikutnya.
    await lihatSebagai(h, "hakim|Idris, S.H.I., M.H.");
    expect(blangkoTerpilih(h)).toBeNull();

    await pilihPerkara228(h);
    await pilihLewatJendela(h, "bas", BLANGKO_BAS);
    await lihatSebagai(h, "pp|Sri Susilowati, S.H.");
    expect(blangkoTerpilih(h)).toBeNull();
  });

  it("penjaga tanpa peristiwa perkara: peran berubah sesudah blangko dipilih -> pilihan dibuang saat tampilan digambar ulang", async () => {
    const h = buka({ hakimBoleh: true });
    await bukaDerry(h);
    await pilihPerkara228(h);
    await pilihLewatJendela(h, "bas", BLANGKO_BAS);
    expect(blangkoTerpilih(h)).toMatchObject({ jenis: "bas", peranKunci: "adm:semua" });
    // Peran dipaksa berganti di kerangka tanpa lewat pemilih (keadaan tak terduga): kunci peran baru tidak sama dengan kunci blangko.
    expect(blangkoTerpilih(h)).not.toBeNull();
    const asli = kerangka(h).peranKunci;
    kerangka(h).peranKunci = () => "adm:hakim";
    // Penjaga membaca api.peranKunci milik kerangka; menggambar ulang ringkasan memicu pembuangan.
    D_(h).dispatchEvent(new h.w.CustomEvent("aleta-bd-perkara", { detail: { ...kerangka(h).perkaraTerpilih(), nomorPerkara: PERKARA_228.nomorPerkara, perkaraId: PERKARA_228.perkaraId, jenisPerkara: PERKARA_228.jenisPerkara, sidang: PERKARA_228.sidang, sidangKe: 1, sidangDipilih: PERKARA_228.sidang[1], perkara: PERKARA_228, peranKunci: "adm:hakim" } }));
    expect(blangkoTerpilih(h)).toBeNull();
    kerangka(h).peranKunci = asli;
  });
});
