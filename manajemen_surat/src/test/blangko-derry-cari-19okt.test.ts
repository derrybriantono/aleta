// @vitest-environment node
/**
 * ============================================================================
 * 19 OKT 2026 - BLANGKO ABT BY DERRY: PENCARIAN PINTAR DI BAGIAN "PERKARA"
 * ============================================================================
 *
 * ekstensi-sipp/blangko-derry.js dijalankan SUNGGUHAN di jsdom. Kotak cari kini
 * punya pemilih jenis: semua (kata kunci otomatis), nomor, jenis perkara, alur
 * (Pdt.G/Pdt.P), nama pihak, kegiatan/agenda sidang, prioritas, dokumen di SIPP,
 * tanggal sidang, majelis/PP/JS. Datanya SUDAH termuat di tabel - mengetik tidak
 * memicu permintaan server baru.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_DERRY = baca("blangko-derry.js");

const ASAL = "http://192.168.10.10";
const BERANDA = `${ASAL}/aps_badilag/index.php/abt/main/beranda`;
const HARI_INI = "2026-10-15";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
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

// ----------------------------------------------------------------------------
// Bahan: perkara nama karangan (hari ini 15 Okt 2026)
// ----------------------------------------------------------------------------
const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({
  sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra,
});
const PK = (nomor: string, jenis: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/PA.Dgl`, perkaraId: `id${nomor}`, jenisPerkara: jenis, alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: [`Penggugat ${nomor}`], tergugat: [`Tergugat ${nomor}`] }, sidang, ...extra,
});
const DAFTAR = [
  PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat"), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)")], { sudahPutus: true, tanggalPutusan: HARI_INI, pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] } }),
  PK("512/Pdt.G/2026", "Cerai Gugat", [SI("2026-09-28", "Sidang Pertama"), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus")], { sudahPutus: true, tanggalPutusan: HARI_INI, adaBerkasPutusan: true }),
  PK("540/Pdt.G/2026", "Cerai Talak", [SI("2026-10-19", "Sidang Pertama")]),
  PK("455/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-15", "Sidang Pertama", "Mediasi")], { paniteraNama: "Siti Aminah" }),
  PK("410/Pdt.G/2026", "Kewarisan", [SI("2026-10-02", "Pemeriksaan pokok perkara", "putus")], { sudahPutus: true, tanggalPutusan: "2026-10-02" }),
  PK("77/Pdt.P/2026", "Itsbat Nikah", [SI("2026-10-14", "Pembuktian", "Saksi dua orang")], { sudahPutus: true, tanggalPutusan: "2026-10-09", tanggalMinutasi: "2026-10-10", majelisNama: "Hakim Tiga, S.H.", pihak: { penggugat: ["Hasan bin Umar"], tergugat: [] } }),
];
const AKUN = { hakim: ["Hakim Satu", "Hakim Dua"], pp: ["PP Satu"], js: ["JS Satu"] };
const dataDaftar = (mode = "hari", tambah: Record<string, unknown> = {}) => ({
  hariIni: HARI_INI, mode, dari: HARI_INI, sampai: HARI_INI, lihatSemua: false, nama: "Hakim Satu", sebagaiNama: "", sebagaiPeran: null,
  terpotong: false, jumlahSemua: 9, adaYangCocok: true, akun: null, perkara: polos(DAFTAR), ...tambah,
});

type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  js: { nama: "JS Satu", peran: "Juru Sita", roleId: "jurusita", golonganMenu: ["jurusita"] },
  kasir: { nama: "Kasir Satu", peran: "Kasir", roleId: "kasir", golonganMenu: ["kasir"] },
  ptsp: { nama: "PTSP Satu", peran: "Petugas PTSP", roleId: "ptsp", golonganMenu: ["ptsp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};

type Minta = { url: string; cara: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; tulis: Array<Record<string, unknown>> };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const MENU_DERRY = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${ASAL}/aps_badilag/index.php/abt/main/beranda?a=D1&c=" title="(12 Blangko)" class="DERRY1">Putusan CG</a><a href="${ASAL}/aps_badilag/index.php/abt/main/beranda?a=D2&c=" title="(4 Blangko)">BAS CG</a></div>`;
const GRUP_LAIN = (aktif = false) => `<button class="accordion">Gugatan &amp; Permohonan</button><div class="panel"><a ${aktif ? 'class="active"' : ""} href="${ASAL}/x?a=G">Gugatan Cerai</a></div><button class="accordion">Berita Acara Sidang</button><div class="panel"><a href="${ASAL}/x?a=B">BAS</a></div>`;

type Opsi = {
  orang?: string;
  orangKustom?: Orang;
  url?: string;
  simpanan?: Record<string, unknown>;
  headerAdmin?: boolean;
  grupLainAktif?: boolean;
  derryAktif?: boolean;
  tanpaDerry?: boolean;
  siapaMati?: boolean;
  sesi?: Record<string, string>;
  perkara?: (url: string) => { status?: number; isi: unknown } | undefined;
  panelLama?: boolean;
};

function buka(p: Opsi = {}): Halaman {
  const derry = p.derryAktif ? MENU_DERRY.replace('title="(12 Blangko)"', 'title="(12 Blangko)" class="active"') : MENU_DERRY;
  const badan =
    `<div id="header"><div class="h_right"><b>Pengguna Uji</b> ${p.headerAdmin ? "Administrator" : "Panitera"}</div></div>` +
    `<div id="wrapper"><div id="cssmenu"></div><div id="navbar">${GRUP_LAIN(p.grupLainAktif)}${p.tanpaDerry ? "" : derry}<button class="accordion">Blangko Fikrianto</button><div class="panel"><a href="#">F</a></div></div>` +
    `<div id="content"><div class="pricing_inner_w3ls"><div class="pricing-top"><h3>Putusan</h3></div></div></div></div>` +
    (p.panelLama ? `<div class="aleta-panel aleta-panel-abt" id="panel-lama">PANEL ALETA LAMA</div>` : "");
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, {
    url: p.url ?? BERANDA,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  for (const [k, v] of Object.entries(p.sesi || {})) w.sessionStorage.setItem(k, v);
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const tulis: Array<Record<string, unknown>> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      tulis.push(polos(isi));
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: polos(simpanan[k]), newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.200.2" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: () => undefined, lastError: undefined },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) } },
  };
  const minta: Minta[] = [];
  const orang = p.orangKustom ?? ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String(opsi?.method || "GET").toUpperCase() });
    if (url.includes("/ekstensi/siapa")) {
      if (p.siapaMati) return json({ ok: false, alasan: "tidak terjangkau" }, 502);
      return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: p.orang === "kasir" } });
    }
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const khusus = p.perkara && p.perkara(url);
      if (khusus) return json(khusus.isi, khusus.status ?? 200);
      const q = new URL(url, ASAL).searchParams;
      const admin = p.orang === "admin";
      return json({ ok: true, data: dataDaftar(q.get("mode") || "hari", { lihatSemua: admin, akun: admin ? AKUN : null, nama: orang.nama }) });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) {
      return json({
        ok: true,
        data: {
          sipp: {
            jadwalPerkara: [
              { sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", ditunda: true, urutanSidang: 1, adaBas: true },
              { sidangId: "sx", tanggalSidang: "2026-10-08", jamSidang: "09:00:00", agenda: "Sidang Kedua", alasanDitunda: "0", ditunda: false, urutanSidang: 2, adaBas: false },
              { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", ditunda: false, urutanSidang: 3, adaBas: false },
            ],
          },
        },
      });
    }
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_DERRY}`);
  return { dom, w, simpanan, minta, tulis };
}

const D = (h: Halaman) => h.w.document as Document;
const akarDari = (h: Halaman) => D(h).getElementById("aleta-bd-akar") as HTMLElement | null;
const tawarDari = (h: Halaman) => D(h).getElementById("aleta-bd-tawar") as HTMLElement | null;
const akarTampak = (h: Halaman) => {
  const a = akarDari(h);
  return a && !a.hidden ? a : null;
};
const klikDerry = (h: Halaman) => (Array.from(D(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
const tekan = (h: Halaman, s: string) => (akarDari(h)!.querySelector(s) as HTMLElement).click();
const nomorKartu = (h: Halaman) => Array.from(akarDari(h)!.querySelectorAll("[data-pk]")).map((e) => (e as HTMLElement).getAttribute("data-pk"));
/** Menunggu pemasangan awal selesai (akun terbaca) sebelum menekan sesuatu. */
const siapPakai = (h: Halaman) => sampai(() => h.w.aletaBlangkoDerry.keadaan().peran.length > 0, "akun terbaca");
const bukaTampilan = async (h: Halaman) => {
  await sampai(() => tawarDari(h), "kartu tawaran");
  klikDerry(h);
  await sampai(() => akarTampak(h), "tampilan terbuka");
  await sampai(() => akarDari(h)!.querySelector("[data-pk]"), "daftar termuat");
};
const gerak = (h: Halaman, tipe: string, el: Element) => el.dispatchEvent(new h.w.MouseEvent(tipe, { bubbles: true }));


const ketik = (h: Halaman, jenis: string, teks: string) => {
  const sel = akarDari(h)!.querySelector("#bd-carijenis") as HTMLSelectElement;
  sel.value = jenis;
  sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
  const c = akarDari(h)!.querySelector("#bd-cari") as HTMLInputElement;
  c.value = teks;
  c.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  return nomorKartu(h).map((n) => String(n).split("/")[0]);
};
const urut = (x: string[]) => [...x].sort();

describe("pencarian pintar - satu kotak, sembilan jenis", () => {
  it("tampil: pemilih jenis berisi semua jenis; bawaan 'Semua'; placeholder mengikuti jenis", async () => {
    const h = buka();
    await bukaTampilan(h);
    const sel = akarDari(h)!.querySelector("#bd-carijenis") as HTMLSelectElement;
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual([
      "Semua (otomatis)", "Nomor perkara", "Jenis perkara", "Alur perkara", "Nama pihak", "Kegiatan sidang / agenda", "Prioritas", "Dokumen di SIPP", "Tanggal sidang", "Majelis / PP / JS",
    ]);
    expect(sel.value).toBe("semua");
    ketik(h, "alur", "");
    expect((akarDari(h)!.querySelector("#bd-cari") as HTMLInputElement).placeholder).toContain("Pdt.G atau Pdt.P");
  });

  it("nomor perkara", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(ketik(h, "nomor", "540")).toEqual(["540"]);
    expect(ketik(h, "nomor", "581/Pdt.G")).toEqual(["581"]);
    expect(ketik(h, "nomor", "Pdt.P")).toEqual(["77"]);
  });

  it("jenis perkara (Cerai Gugat, Kewarisan, ...)", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(urut(ketik(h, "jenis", "cerai gugat"))).toEqual(["455", "512", "581"]);
    expect(ketik(h, "jenis", "Kewarisan")).toEqual(["410"]);
    expect(ketik(h, "jenis", "itsbat")).toEqual(["77"]);
  });

  it("alur perkara: Pdt.G / Pdt.P (juga kata 'gugatan'/'permohonan')", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(urut(ketik(h, "alur", "Pdt.G"))).toEqual(["410", "455", "512", "540", "581"]);
    expect(urut(ketik(h, "alur", "g"))).toEqual(["410", "455", "512", "540", "581"]);
    expect(ketik(h, "alur", "Pdt.P")).toEqual(["77"]);
    expect(ketik(h, "alur", "permohonan")).toEqual(["77"]);
    expect(urut(ketik(h, "alur", "gugatan"))).toEqual(["410", "455", "512", "540", "581"]);
  });

  it("nama pihak (penggugat/tergugat/pemohon)", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(ketik(h, "pihak", "yulfiani")).toEqual(["581"]);
    expect(ketik(h, "pihak", "RUSTAM")).toEqual(["581"]);
    expect(ketik(h, "pihak", "hasan")).toEqual(["77"]);
    expect(ketik(h, "pihak", "tidak ada orangnya")).toEqual([]);
  });

  it("kegiatan sidang / agenda (juga keterangan sidang mana pun)", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(ketik(h, "kegiatan", "mediasi")).toEqual(["455"]);
    expect(ketik(h, "kegiatan", "pembuktian")).toEqual(["77"]);
    expect(ketik(h, "kegiatan", "panggil tergugat")).toEqual(["581"]);
    expect(urut(ketik(h, "kegiatan", "pokok perkara"))).toEqual(["410", "512", "581"]);
  });

  it("prioritas: Menyusul / Selesai / Perlu segera", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(urut(ketik(h, "prioritas", "selesai"))).toEqual(["512", "77"]);
    const menyusul = ketik(h, "prioritas", "menyusul");
    expect(menyusul).toContain("455");
    expect(menyusul).not.toContain("512");
    expect(menyusul).not.toContain("77");
    expect(ketik(h, "prioritas", "Perlu segera")).toContain("581");
  });

  it("dokumen di SIPP: belum diunggah / sudah minutasi / sudah ada", async () => {
    const h = buka();
    await bukaTampilan(h);
    const belum = ketik(h, "dokumen", "belum diunggah");
    expect(belum).toContain("581");
    expect(belum).toContain("410");
    expect(belum).not.toContain("512");
    expect(ketik(h, "dokumen", "minutasi")).toEqual(["77"]);
    expect(ketik(h, "dokumen", "sudah ada di sipp")).toEqual(["512"]);
  });

  it("tanggal sidang: 15/10/2026, 2026-10-19, '19 Okt 2026', 14-10-2026, '28 September'", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(urut(ketik(h, "tanggal", "15/10/2026"))).toEqual(["455", "512", "581"]);
    expect(ketik(h, "tanggal", "2026-10-19")).toEqual(["540"]);
    expect(ketik(h, "tanggal", "19 Okt 2026")).toEqual(["540"]);
    expect(ketik(h, "tanggal", "14-10-2026")).toEqual(["77"]);
    expect(ketik(h, "tanggal", "28 September")).toEqual(["512"]);
    expect(ketik(h, "tanggal", "17/10/2026")).toEqual([]);
  });

  it("majelis / PP / JS", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(ketik(h, "majelis", "Hakim Tiga")).toEqual(["77"]);
    expect(ketik(h, "majelis", "siti aminah")).toEqual(["455"]);
    expect(ketik(h, "majelis", "JS Satu").length).toBe(6);
  });

  it("'Semua': kata kunci otomatis di bidang mana pun; beberapa kata = semuanya harus cocok", async () => {
    const h = buka();
    await bukaTampilan(h);
    expect(ketik(h, "semua", "540")).toEqual(["540"]);
    expect(ketik(h, "semua", "kewarisan")).toEqual(["410"]);
    expect(ketik(h, "semua", "yulfiani")).toEqual(["581"]);
    expect(ketik(h, "semua", "mediasi")).toEqual(["455"]);
    expect(ketik(h, "semua", "cerai gugat mediasi")).toEqual(["455"]);
    expect(ketik(h, "semua", "Hakim Tiga")).toEqual(["77"]);
    expect(ketik(h, "semua", "19 Okt 2026")).toEqual(["540"]);
    expect(ketik(h, "semua", "15/10/2026").length).toBe(3);
    expect(ketik(h, "semua", "kewarisan mediasi")).toEqual([]);
    expect(ketik(h, "semua", "").length).toBe(6);
  });

  it("memakai data yang sudah dimuat: mengetik dan mengganti jenis TIDAK meminta server lagi", async () => {
    const h = buka();
    await bukaTampilan(h);
    const sebelum = h.minta.length;
    ketik(h, "pihak", "yulfiani");
    ketik(h, "tanggal", "15/10/2026");
    ketik(h, "semua", "mediasi");
    expect(h.minta.length).toBe(sebelum);
    expect(h.minta.every((m) => m.cara === "GET")).toBe(true);
  });

  it("PTSP: tetap hanya kotak nomor (dicari di server), tanpa pemilih jenis", async () => {
    const h = buka({ orang: "ptsp" });
    await sampai(() => tawarDari(h), "kartu tawaran");
    klikDerry(h);
    await sampai(() => akarTampak(h), "tampilan terbuka");
    await sampai(() => akarDari(h)!.querySelector("#bd-cari"), "kotak cari");
    expect(akarDari(h)!.querySelector("#bd-carijenis")).toBeNull();
    expect((akarDari(h)!.querySelector("#bd-cari") as HTMLInputElement).getAttribute("aria-label")).toBe("Cari nomor perkara");
  });
});
