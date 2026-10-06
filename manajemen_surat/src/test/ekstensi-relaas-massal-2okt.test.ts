// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - AGEN R (RELAAS & MASSAL), EKSTENSI 1.178.0
 * ============================================================================
 *
 * panel-alat.js + jurusita.js + basmassal.js dijalankan SUNGGUHAN sebagai satu
 * skrip konten (urutan manifest) di jendela jsdom beralamat daftar perkara SIPP
 * atau beranda ABT. Yang ditiru hanya tepinya: chrome.storage,
 * chrome.runtime.sendMessage (pekerja latar), dan jawaban rute ALETA. Dokumen
 * rute cetak DINILAI dengan nilaiCetakDokumen yang sama dengan rute
 * relaas-massal/cetak.
 *
 * Yang dijaga:
 *   butir 2   relaas & PBT massal PER JURU SITA (UI Baru, admin): kelompok
 *             berlipat bertag "Juru Sita", "Kerjakan semua milik X", centang
 *             per perkara; pekerjaan yang dikirim = milik kelompok itu saja.
 *             Juru sita: "Milik saya" bawaan, "Semua juru sita" datar.
 *             Lama tidak menggambar; Baru tetap datar seperti 1.177.0.
 *   butir 19  kelompok milik akun yang masuk terbuka, lainnya tertutup -
 *             relaas massal DAN BAS massal (namaSaya di aletaMassalGambarKelompok).
 *   butir 7   tag peran: "Juru Sita" di kepala relaas massal, "PP" di BAS massal.
 *   butir 3   aletaMassalBarisBlangko: blangko utama + "Blangko berbeda…" per
 *             perkara (helper K3 untuk agen S dan A).
 *   butir 14  pekerjaan cetak relaas tidak memuat penanda "ALETA" dan tidak
 *             ada permintaan non-GET (relaas = unduhan, bukan tulis).
 *
 * Pembukti gigitan: ALETA_UJI_JURUSITA_R / ALETA_UJI_BASMASSAL_R menunjuk
 * SALINAN berkas yang dirusak sengaja.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const bacaGanti = (env: string | undefined, berkas: string) => (env ? readFileSync(env, "utf8").replace(/\r\n/g, "\n") : baca(berkas));
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_JURUSITA = bacaGanti(process.env.ALETA_UJI_JURUSITA_R, "jurusita.js");
const SUMBER_BAS = bacaGanti(process.env.ALETA_UJI_BASMASSAL_R, "basmassal.js");

const ASAL = "http://192.168.10.10";
const HALAMAN = { sippDaftar: `${ASAL}/SIPP/perkara`, abtBeranda: `${ASAL}/aps_badilag/abt/` };
// 6 Okt (butir 10): blangko PER PIHAK.
const berkasUntuk = (keadaan: string, pihak?: string) =>
  BLANGKO_RELAAS.find((x) => x.keadaan === keadaan && (!pihak || x.pihak === pihak))!.berkas;
const P_DAN_T = berkasUntuk("sidang-pertama", "keduanya");
const PERTAMA_P = berkasUntuk("sidang-pertama", "pertama");
const PERTAMA_T = berkasUntuk("sidang-pertama", "kedua");
const T_LANJUTAN = berkasUntuk("sidang-ditunda", "kedua");

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
    await tunggu(10);
  }
}

// ---------------------------------------------------------------------------
// Dokumen rute - bentuk bot, dinilai nilaiCetakDokumen seperti cetak/route.ts
// ---------------------------------------------------------------------------
type Bot = Record<string, any>;
const RAHMAT = { nama: "Rahmat Hidayat, S.H.", nip: "198701012010011001", dariPenunjukan: true };
const BUDI = { nama: "Budi Santoso", nip: "199002022015031002", dariPenunjukan: true };
const TANPA = { nama: "tidak tercatat", nip: "", dariPenunjukan: false };

function bot(x: Bot): Bot {
  const golongan = String(x.golongan || "sidang-pertama");
  return {
    kunci: `${golongan}:${x.perkaraId}:${x.d ?? 0}:${x.pihakKe ?? 0}`,
    nomorPerkara: `${x.perkaraId}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    golongan,
    sebabMasuk: golongan === "pemberitahuan-putusan" ? "diputus" : golongan === "sidang-pertama" ? "didaftarkan" : "ditunda",
    d: null,
    sidangId: null,
    tanggalSidangTujuan: "",
    sidangAsalId: null,
    dihadiriOleh: null,
    pihakDipanggil: "keduanya",
    pihakKe: null,
    jurusita: RAHMAT,
    sudahAdaRelaas: false,
    sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" },
    ...x,
  };
}
function rute(d: Bot): Bot {
  const n = nilaiCetakDokumen(d as any);
  return { ...d, blangko: n.blangko, bisaDicetak: n.bisaDicetak, sebabTidakBisa: n.sebabTidakBisa, peringatan: n.peringatan, ikutPilihSemua: n.ikutPilihSemua };
}

const CETAK = {
  ok: true,
  tanggal: "2026-10-02",
  dokumen: [
    bot({ perkaraId: 700, golongan: "sidang-pertama", d: 1, tanggalSidangTujuan: "2026-10-09" }),
    bot({ perkaraId: 701, golongan: "sidang-ditunda", d: 3, tanggalSidangTujuan: "2026-10-08", pihakDipanggil: "kedua", dihadiriOleh: 2 }),
    // Sudah tercatat di SIPP - tidak ikut Pilih semua: centang perkaranya mati.
    bot({ perkaraId: 705, golongan: "sidang-ditunda", d: 2, tanggalSidangTujuan: "2026-10-08", pihakDipanggil: "kedua", sudahAdaRelaas: true }),
    bot({ perkaraId: 706, golongan: "sidang-pertama", d: 1, tanggalSidangTujuan: "2026-10-09", jurusita: BUDI }),
    bot({ perkaraId: 704, golongan: "pemberitahuan-putusan", pihakKe: 2, pihakDipanggil: "kedua", jurusita: BUDI }),
    bot({ perkaraId: 709, golongan: "sidang-pertama", d: 1, tanggalSidangTujuan: "2026-10-09", jurusita: TANPA }),
  ].map(rute),
  hariKerjaSebelumnya: {
    tanggal: "2026-10-01",
    dokumen: [bot({ perkaraId: 708, golongan: "sidang-ditunda", d: 3, tanggalSidangTujuan: "2026-10-13", pihakDipanggil: "kedua", jurusita: BUDI })].map(rute),
  },
};

// BAS massal (bas-massal) - baris bentuk bot.
const barisBas = (nomor: string, id: string, pp: string) => {
  const pilihan = [{ folder: "f", berkas: "[02] BAS 2.rtf", setId: "bas-verstek", setNama: "BAS Verstek", basKe: 2, label: "BAS 2", kehadiran: "cocok" }];
  return {
    sidangId: id,
    perkaraId: id,
    nomorPerkara: nomor,
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-10-02",
    jamSidang: "09:00",
    agenda: "Pembuktian",
    urutanSidang: 2,
    dihadiriOleh: 2,
    kehadiran: "hanya pihak pertama hadir",
    basSipp: false,
    paniteraNama: pp,
    pengguna: { id: pp.split(",")[0].toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), nama: pp },
    saksi: { pihak1: 0, pihak2: 0, nama1: [], nama2: [] },
    lembar: null,
    blangko: { usulan: pilihan[0], pilihan, sebab: "" },
  };
};
const SIDANG_BAS = [
  barisBas("498/Pdt.G/2026/PA.Dgl", "498", "Unun Fidjayanti Patangai, S.H."),
  barisBas("575/Pdt.G/2026/PA.Dgl", "575", "Munifa, S.H."),
  barisBas("586/Pdt.G/2026/PA.Dgl", "586", "Qadarsyah, S.H."),
];

// ---------------------------------------------------------------------------
// Jendela uji
// ---------------------------------------------------------------------------
type Siapa = { nama: string; peran: string; roleId: string; peranTambahan?: string[] };
type Pilihan = { mode?: "lama" | "baru" | "ui"; url?: string; siapa?: Siapa };

const ADMIN: Siapa = { nama: "Administrator", peran: "Admin", roleId: "admin", peranTambahan: [] };
const JS_RAHMAT: Siapa = { nama: "Rahmat Hidayat", peran: "Jurusita", roleId: "jurusita", peranTambahan: [] };

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Pilihan = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="panel"><div id="wadah"></div></div></body></html>`, {
    url: p.url ?? HALAMAN.sippDaftar,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.mode ?? "ui" };
  const pesan: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.178.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      lastError: undefined,
      sendMessage: (m: any, balik?: (x: unknown) => void) => {
        pesan.push(polos(m));
        let jawab: unknown = { ok: true, pekerjaan: null, ringkas: {} };
        if (m.jenis === "relaas-mulai") {
          const butir = (m.pekerjaan?.dokumen ?? []).map((d: any) => ({ ...d, keadaan: "menunggu" }));
          jawab = { ok: true, pekerjaan: { id: "relaas-uji", butir, selesai: false, dilewati: [] }, ringkas: { menunggu: butir.length }, perkiraan: { rata: 60000 } };
        }
        setTimeout(() => balik && balik(polos(jawab)), 0);
      },
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase() });
    const siapa = p.siapa ?? ADMIN;
    if (url.includes("/aleta/api/aleta-ecourt/ekstensi/siapa")) return Response.json({ ok: true, data: siapa });
    if (url.includes("/aleta/api/aleta-ecourt/relaas-massal/cetak")) return Response.json({ ok: true, data: CETAK });
    if (url.includes("/aleta/api/aleta-ecourt/bas-massal")) {
      const q = new URL(url, ASAL).searchParams;
      const admin = /admin/i.test(siapa.peran);
      const saringan = q.get("saringan") || (admin ? "semua" : "saya");
      return Response.json({ ok: true, data: { tanggal: q.get("tanggal"), saringan, lihatSemua: admin, sidang: SIDANG_BAS } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  const konfirmasi: string[] = [];
  w.confirm = (x: string) => {
    konfirmasi.push(x);
    return true;
  };
  // Urutan manifest: panel-alat.js, jurusita.js, basmassal.js.
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_JURUSITA}\n;\n${SUMBER_BAS}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  return { dom, w, pesan, minta, konfirmasi, wadah: w.document.getElementById("wadah") as HTMLElement };
}
type H = ReturnType<typeof buka>;
const siapMode = (h: H, mode = "ui") => sampai(() => h.w.__uji.mode() === mode, `mode ${mode}`);
const pasangRelaas = async (h: H, situs = "sipp") => (await h.w.aletaJurusitaPasangMassal(h.wadah, { situs, terbuka: true })) as boolean;
const ringkas = (h: H) => sampai(() => h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-ringkas"), "ringkasan massal");
const kelompokDom = (h: H) => Array.from(h.wadah.querySelectorAll(".aleta-massal-kelompok")) as HTMLElement[];
const judulKelompok = (k: HTMLElement) => k.querySelector(".aleta-lipat-judul")!.textContent;
const tagKelompok = (k: HTMLElement) => (k.querySelector(":scope > .aleta-lipat-kepala > .aleta-lipat-peran") as HTMLElement | null)?.textContent ?? "";
const kelompokTerbuka = (k: HTMLElement) => k.getAttribute("data-terbuka") === "ya";
const tombolCetak = (h: H) => h.wadah.querySelector(".aleta-jurusita-cetak-massal") as HTMLButtonElement;
const centangKelompok = (k: HTMLElement) => k.querySelector(".aleta-massal-kelompok-centang") as HTMLInputElement;
const centangPerkara = (h: H, id: number) =>
  h.wadah.querySelector(`.aleta-jurusita-perkara[data-perkara-id="${id}"] .aleta-jurusita-centang-baris`) as HTMLInputElement | null;
const centangPihak = (h: H, id: number, nilai: string) =>
  h.wadah.querySelector(`.aleta-jurusita-perkara[data-perkara-id="${id}"][data-kelompok="hari-ini"] input[value="${nilai}"]`) as HTMLInputElement;
const ubahCentang = (h: H, c: HTMLInputElement, nilai: boolean) => {
  c.checked = nilai;
  c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
};
const pesanMulai = (h: H) => h.pesan.filter((m) => m.jenis === "relaas-mulai");
const ringkasDok = (d: any) => `${d.perkaraId}|${d.golongan}|${d.d}|${d.berkas}`;
const nonGet = (h: H) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");

// ===========================================================================
// A. BUTIR 2 - RELAAS & PBT MASSAL PER JURU SITA
// ===========================================================================
describe("butir 2: relaas massal dibagi per juru sita (UI Baru, admin)", () => {
  it("admin di daftar SIPP: satu kelompok berlipat per juru sita, bertag 'Juru Sita', urut nama, yang tak tercatat paling akhir", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN });
    await siapMode(h);
    expect(await pasangRelaas(h)).toBe(true);
    await ringkas(h);
    const k = kelompokDom(h);
    expect(k.map(judulKelompok)).toEqual([
      "Juru sita: Budi Santoso · 2 perkara",
      "Juru sita: Rahmat Hidayat, S.H. · 3 perkara",
      "Juru sita: belum tercatat · 1 perkara",
    ]);
    // Bentuk lipat seragam K2 + tag peran butir 7.
    expect(k.every((x) => x.classList.contains("aleta-lipatan"))).toBe(true);
    expect(k.map(tagKelompok)).toEqual(["Juru Sita", "Juru Sita", "Juru Sita"]);
    expect(centangKelompok(k[1]).parentElement!.textContent).toContain("Kerjakan semua milik Rahmat Hidayat, S.H.");
    // Nama juru sita ada di kepala kelompok - tidak diulang di tiap baris.
    expect(k[1].querySelector('.aleta-jurusita-perkara[data-perkara-id="700"]')!.textContent).not.toContain("Rahmat Hidayat");
    // Perkara ada di kelompok juru sitanya.
    expect(k[0].querySelector('[data-perkara-id="706"]')).toBeTruthy();
    expect(k[0].querySelector('[data-perkara-id="704"]')).toBeTruthy();
    expect(k[2].querySelector('[data-perkara-id="709"]')).toBeTruthy();
    // Kepala panel massal: tag peran Juru Sita (butir 7) di bentuk lipat seragam.
    const kepalaPanel = h.wadah.querySelector(".aleta-jurusita-massal-lipat > summary") as HTMLElement;
    expect(kepalaPanel.querySelector(".aleta-lipat-peran")!.textContent).toBe("Juru Sita");
    // Tidak ada yang tercentang sendiri.
    expect(tombolCetak(h).disabled).toBe(true);
    expect(k.every((x) => !centangKelompok(x).checked)).toBe(true);
  });

  it("'Kerjakan semua milik Rahmat' -> hanya dokumen Rahmat yang dikirim ke relaas-mulai, pihak menurut SIPP; tanpa 'ALETA', tanpa non-GET (butir 14)", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN });
    await siapMode(h);
    await pasangRelaas(h);
    await ringkas(h);
    const rahmat = kelompokDom(h)[1];
    ubahCentang(h, centangKelompok(rahmat), true);
    // 705 sudah tercatat di SIPP: centang perkaranya mati dan tidak ikut.
    expect(centangPerkara(h, 705)!.disabled).toBe(true);
    expect(centangPerkara(h, 705)!.checked).toBe(false);
    expect(centangPerkara(h, 700)!.checked).toBe(true);
    expect(centangPihak(h, 700, "p1").checked).toBe(true);
    expect(centangPihak(h, 700, "p2").checked).toBe(true);
    expect(centangPihak(h, 701, "p1").checked).toBe(false); // pihak pertama tidak dipanggil menurut SIPP
    expect(centangPihak(h, 701, "p2").checked).toBe(true);
    expect(centangPerkara(h, 706)!.checked).toBe(false); // milik Budi
    expect(rahmat.querySelector(".aleta-lipat-ringkas")!.textContent).toBe("2 dicentang");
    const cetak = tombolCetak(h);
    // Sidang pertama 700 untuk kedua pihak = dua dokumen per pihak (6 Okt, butir 10).
    expect(cetak.textContent).toBe("Cetak 3 dokumen");
    cetak.click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    const dok = pesanMulai(h)[0].pekerjaan.dokumen;
    expect(dok.map(ringkasDok).sort()).toEqual(
      [`700|sidang-pertama|1|${PERTAMA_P}`, `700|sidang-pertama|1|${PERTAMA_T}`, `701|sidang-ditunda|3|${T_LANJUTAN}`].sort()
    );
    expect(dok.map((d: any) => d.berkas)).not.toContain(P_DAN_T);
    expect(dok.every((d: any) => d.jurusita === "Rahmat Hidayat, S.H.")).toBe(true);
    // Butir 14: tidak ada penanda ALETA di pekerjaan cetak (isi/nama berkas/label).
    expect(JSON.stringify(dok)).not.toMatch(/aleta/i);
    expect(nonGet(h)).toEqual([]);
  });

  it("centang perkara = Pilih semua untuk perkara itu; centang pihak menyelaraskan perkara dan kelompok (setengah)", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN });
    await siapMode(h);
    await pasangRelaas(h);
    await ringkas(h);
    const budi = kelompokDom(h)[0];
    ubahCentang(h, centangPerkara(h, 706)!, true);
    expect(centangPihak(h, 706, "p1").checked).toBe(true);
    expect(centangPihak(h, 706, "p2").checked).toBe(true);
    expect(centangKelompok(budi).indeterminate).toBe(true);
    // PBT 704 lewat centang pihaknya sendiri -> perkara & kelompok penuh.
    ubahCentang(h, centangPihak(h, 704, "b2"), true);
    expect(centangPerkara(h, 704)!.checked).toBe(true);
    expect(centangKelompok(budi).checked).toBe(true);
    expect(tombolCetak(h).textContent).toBe("Cetak 3 dokumen");
    // Kosongkan perkara 706 -> pihaknya ikut kosong.
    ubahCentang(h, centangPerkara(h, 706)!, false);
    expect(centangPihak(h, 706, "p1").checked).toBe(false);
    expect(centangPihak(h, 706, "p2").checked).toBe(false);
    expect(tombolCetak(h).textContent).toBe("Cetak 1 dokumen");
    // "Pilih semua" (tombol lama) tetap ada dan menyalakan centang perkara.
    (h.wadah.querySelector(".aleta-jurusita-pilih-semua") as HTMLButtonElement).click();
    await sampai(() => centangPerkara(h, 700)?.checked, "pilih semua menyala");
    expect(kelompokDom(h).slice(0, 2).every((k) => centangKelompok(k).checked)).toBe(true);
  });

  it("beranda ABT juga per juru sita; hari kerja sebelumnya tetap terpisah dan menyebut juru sitanya", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN, url: HALAMAN.abtBeranda });
    await siapMode(h);
    expect(await pasangRelaas(h, "abt")).toBe(true);
    await ringkas(h);
    expect(kelompokDom(h)).toHaveLength(3);
    expect(kelompokDom(h)[0].getAttribute("data-kunci")).toMatch(/^relaas-massal-abt-user-/);
    const kemarin = h.wadah.querySelector(".aleta-jurusita-kemarin") as HTMLElement;
    expect(kemarin.querySelector('[data-perkara-id="708"]')!.textContent).toContain("Budi Santoso");
  });

  it("juru sita di UI Baru: bawaan 'Milik saya' datar; 'Semua juru sita' tetap ada dan DATAR (1.177.0)", async () => {
    const h = buka({ mode: "ui", siapa: JS_RAHMAT });
    await siapMode(h);
    expect(await pasangRelaas(h)).toBe(true);
    await ringkas(h);
    const saring = h.wadah.querySelector(".aleta-jurusita-saring") as HTMLSelectElement;
    expect(saring.value).toBe("saya");
    expect(Array.from(saring.options).map((o) => o.textContent)).toEqual(["Milik saya", "Semua juru sita"]);
    expect(kelompokDom(h)).toHaveLength(0);
    expect(h.wadah.querySelector('[data-perkara-id="706"]')).toBeNull();
    saring.value = "semua";
    saring.dispatchEvent(new h.w.Event("change"));
    await sampai(() => h.wadah.querySelector('[data-perkara-id="706"]'), "semua juru sita");
    expect(kelompokDom(h)).toHaveLength(0);
    expect(h.wadah.querySelector(".aleta-jurusita-centang-baris")).toBeNull();
  });

  it("tampilan Baru (admin): datar seperti 1.177.0 - tanpa kelompok, tanpa centang perkara, tanpa tag peran", async () => {
    const h = buka({ mode: "baru", siapa: ADMIN });
    await siapMode(h, "baru");
    expect(await pasangRelaas(h)).toBe(true);
    await ringkas(h);
    expect(kelompokDom(h)).toHaveLength(0);
    expect(h.wadah.querySelector(".aleta-jurusita-centang-baris")).toBeNull();
    expect(h.wadah.querySelector(".aleta-lipat-peran")).toBeNull();
    expect(h.wadah.querySelector(".aleta-jurusita-massal-lipat")!.classList.contains("aleta-lipatan")).toBe(false);
    expect(h.wadah.querySelector('[data-perkara-id="700"]')!.textContent).toContain("Rahmat Hidayat");
  });

  it("tampilan Lama: tidak menggambar, tidak membaca, tidak mengirim", async () => {
    const h = buka({ mode: "lama", siapa: ADMIN });
    await siapMode(h, "lama");
    expect(await pasangRelaas(h)).toBe(false);
    await tunggu(30);
    expect(h.wadah.innerHTML).toBe("");
    // panel-alat.js sendiri membaca /ekstensi/tampilan (milik W) - yang dijaga: tidak ada bacaan relaas/akun.
    expect(h.minta.filter((m) => /ekstensi\/siapa|relaas-massal|pemetaan-blangko/.test(m.url))).toEqual([]);
    expect(h.pesan).toEqual([]);
  });
});

// ===========================================================================
// B. BUTIR 19 - KELOMPOK MILIK SAYA TERBUKA, LAINNYA TERTUTUP
// ===========================================================================
describe("butir 19: bawaan buka/tutup kelompok per user", () => {
  it("relaas: admin bernama sama dengan juru sita -> kelompoknya terbuka (bertanda milik saya), lainnya tertutup", async () => {
    const h = buka({ mode: "ui", siapa: { nama: "Budi Santoso", peran: "Super Admin", roleId: "super-admin" } });
    await siapMode(h);
    await pasangRelaas(h);
    await ringkas(h);
    const k = kelompokDom(h);
    expect(k.map(kelompokTerbuka)).toEqual([true, false, false]);
    expect(k[0].getAttribute("data-milik-saya")).toBe("ya");
    expect(k[1].hasAttribute("data-milik-saya")).toBe(false);
    // Yang tertutup benar-benar tersembunyi (isi hidden), tetap dapat dibuka.
    expect((k[1].querySelector(".aleta-lipat-isi") as HTMLElement).hidden).toBe(true);
    (k[1].querySelector(".aleta-lipat-kepala") as HTMLButtonElement).click();
    expect(kelompokTerbuka(k[1])).toBe(true);
  });

  it("relaas: admin yang bukan juru sita -> semua kelompok tertutup (tidak semua terbuka sekaligus)", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN });
    await siapMode(h);
    await pasangRelaas(h);
    await ringkas(h);
    expect(kelompokDom(h).map(kelompokTerbuka)).toEqual([false, false, false]);
  });

  it("BAS massal: kelompok PP milik akun terbuka, PP lain tertutup; tag peran 'PP' di kepala kelompok dan di judul", async () => {
    const h = buka({ mode: "ui", siapa: { nama: "Qadarsyah", peran: "Super Admin", roleId: "super-admin" } });
    await siapMode(h);
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "abt" })).toBe(true);
    await sampai(() => kelompokDom(h).length === 3, "tiga kelompok PP");
    const k = kelompokDom(h);
    expect(k.map(judulKelompok)).toEqual(["PP: Munifa, S.H. · 1 perkara", "PP: Qadarsyah, S.H. · 1 perkara", "PP: Unun Fidjayanti Patangai, S.H. · 1 perkara"]);
    expect(k.map(kelompokTerbuka)).toEqual([false, true, false]);
    expect(k.map(tagKelompok)).toEqual(["PP", "PP", "PP"]);
    expect(h.wadah.querySelector(".aleta-basmassal-judul > .aleta-lipat-peran")!.textContent).toBe("PP");
    expect(nonGet(h)).toEqual([]);
  });

  it("BAS massal dengan peran dari panel (tanpa akun terbaca lebih dulu): nama akun dibaca sekali untuk bawaan buka", async () => {
    const h = buka({ mode: "ui", siapa: { nama: "Munifa", peran: "Admin", roleId: "admin" } });
    await siapMode(h);
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "sipp", peran: "Admin" })).toBe(true);
    await sampai(() => kelompokDom(h).length === 3, "tiga kelompok PP");
    expect(kelompokDom(h).map(kelompokTerbuka)).toEqual([true, false, false]);
  });

  it("BAS massal tampilan Baru: tanpa tag peran di judul (1.177.0)", async () => {
    const h = buka({ mode: "baru", siapa: ADMIN });
    await siapMode(h, "baru");
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "abt" })).toBe(true);
    await sampai(() => h.wadah.querySelectorAll(".aleta-basmassal-baris").length === 3, "tiga baris");
    expect(h.wadah.querySelector(".aleta-lipat-peran:not([hidden])")).toBeNull();
    expect(kelompokDom(h)).toHaveLength(0);
  });

  it("aletaMassalGambarKelompok: tanpa namaSaya/terbukaUntuk perilaku 1 Okt (semua terbuka); satu kelompok selalu terbuka", async () => {
    const h = buka({ mode: "ui" });
    await siapMode(h);
    const daftar = [
      { nomor: "1", pengguna: { id: "a", nama: "Ani" } },
      { nomor: "2", pengguna: { id: "b", nama: "Bona" } },
    ];
    const w1 = h.w.document.createElement("div");
    h.w.aletaMassalGambarKelompok(w1, h.w.aletaMassalKelompokkan(daftar, "pengguna"), { peran: "Admin" });
    expect(Array.from(w1.querySelectorAll(".aleta-massal-kelompok")).map((x: any) => x.getAttribute("data-terbuka"))).toEqual(["ya", "ya"]);
    const w2 = h.w.document.createElement("div");
    h.w.aletaMassalGambarKelompok(w2, h.w.aletaMassalKelompokkan([daftar[1]], "pengguna"), { peran: "Admin", namaSaya: "Orang Lain" });
    expect(w2.querySelector(".aleta-massal-kelompok")!.getAttribute("data-terbuka")).toBe("ya");
    const w3 = h.w.document.createElement("div");
    h.w.aletaMassalGambarKelompok(w3, h.w.aletaMassalKelompokkan(daftar, "pengguna"), {
      peran: "Admin",
      terbukaUntuk: (u: { nama: string }) => u.nama === "Bona",
    });
    expect(Array.from(w3.querySelectorAll(".aleta-massal-kelompok")).map((x: any) => x.getAttribute("data-terbuka"))).toEqual(["tidak", "ya"]);
  });
});

// ===========================================================================
// C. BUTIR 3 - aletaMassalBarisBlangko (helper K3 untuk S dan A)
// ===========================================================================
describe("butir 3: aletaMassalBarisBlangko - blangko utama dan pengecualian per perkara", () => {
  const UTAMA = { nilai: "01", label: "[01] Kabul Cerai Gugat" };
  const DAFTAR = [UTAMA, { nilai: "02", label: "[02] Verstek" }, { nilai: "03", label: "[03] Tolak" }];

  it("baris bawaan mengikuti blangko utama; 'Blangko berbeda…' memilih blangko lain untuk perkara itu saja; 'Ikuti blangko utama' membatalkan", async () => {
    const h = buka({ mode: "ui" });
    await siapMode(h);
    const kabar: any[] = [];
    const perkara = { nomorPerkara: "498/Pdt.G/2026/PA.Dgl", perkaraId: "498" };
    const el = h.w.aletaMassalBarisBlangko(perkara, { blangkoUtama: UTAMA, daftarBlangko: DAFTAR, onPilih: (x: any) => kabar.push(x) });
    h.wadah.appendChild(el);
    const teks = el.querySelector(".aleta-massal-blangko-teks") as HTMLElement;
    const beda = el.querySelector(".aleta-massal-blangko-beda") as HTMLButtonElement;
    const ulang = el.querySelector(".aleta-massal-blangko-ulang") as HTMLButtonElement;
    const pilih = el.querySelector(".aleta-massal-blangko-pilih") as HTMLSelectElement;
    expect(el.getAttribute("data-keadaan")).toBe("utama");
    expect(teks.textContent).toBe("Blangko utama: [01] Kabul Cerai Gugat");
    expect(beda.textContent).toBe("Blangko berbeda…");
    expect(pilih.hidden).toBe(true);
    expect(ulang.hidden).toBe(true);
    expect(el.aletaBlangko.pilihan()).toEqual({ blangko: UTAMA, bawaan: true });

    beda.click();
    expect(pilih.hidden).toBe(false);
    expect(pilih.getAttribute("aria-label")).toBe("Blangko untuk 498/Pdt.G/2026/PA.Dgl");
    expect(Array.from(pilih.options).map((o) => o.textContent)).toEqual([
      "Pilih blangko untuk perkara ini…",
      "[01] Kabul Cerai Gugat (blangko utama)",
      "[02] Verstek",
      "[03] Tolak",
    ]);
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(kabar).toHaveLength(1);
    expect(kabar[0].perkara).toBe(perkara);
    expect(kabar[0].blangko).toBe(DAFTAR[1]); // objek ASLI milik pemanggil
    expect(kabar[0].bawaan).toBe(false);
    expect(el.getAttribute("data-keadaan")).toBe("beda");
    expect(teks.textContent).toBe("Blangko berbeda: [02] Verstek");
    expect(pilih.hidden).toBe(true);
    expect(ulang.hidden).toBe(false);

    // Kepala daftar berganti blangko utama: pengecualian TETAP, tanpa onPilih.
    el.aletaBlangko.setelUtama(DAFTAR[2]);
    expect(kabar).toHaveLength(1);
    expect(el.aletaBlangko.pilihan()).toEqual({ blangko: DAFTAR[1], bawaan: false });

    ulang.click();
    expect(kabar).toHaveLength(2);
    expect(kabar[1]).toMatchObject({ blangko: DAFTAR[2], bawaan: true });
    expect(teks.textContent).toBe("Blangko utama: [03] Tolak");
    expect(el.getAttribute("data-keadaan")).toBe("utama");
    // Murni DOM: tidak ada permintaan selain bacaan tampilan panel-alat.js sendiri.
    expect(h.minta.filter((m) => !m.url.includes("/ekstensi/tampilan"))).toEqual([]);
  });

  it("baris yang mengikuti utama ikut berganti saat setelUtama; memilih blangko utama di pemilih = kembali ke bawaan", async () => {
    const h = buka({ mode: "ui" });
    await siapMode(h);
    const kabar: any[] = [];
    const el = h.w.aletaMassalBarisBlangko({ nomor: "575/Pdt.G/2026/PA.Dgl" }, { blangkoUtama: "a.rtf", daftarBlangko: () => ["a.rtf", "b.rtf"], onPilih: (x: any) => kabar.push(x) });
    el.aletaBlangko.setelUtama("b.rtf");
    expect(el.querySelector(".aleta-massal-blangko-teks")!.textContent).toBe("Blangko utama: b.rtf");
    expect(kabar).toEqual([]);
    (el.querySelector(".aleta-massal-blangko-beda") as HTMLButtonElement).click();
    const pilih = el.querySelector(".aleta-massal-blangko-pilih") as HTMLSelectElement;
    pilih.value = "0"; // a.rtf
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(kabar[0]).toMatchObject({ blangko: "a.rtf", bawaan: false });
    (el.querySelector(".aleta-massal-blangko-beda") as HTMLButtonElement).click();
    pilih.value = "1"; // b.rtf = blangko utama
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(kabar[1]).toMatchObject({ blangko: "b.rtf", bawaan: true });
    expect(el.getAttribute("data-keadaan")).toBe("utama");
  });

  it("bentuk <option> (abt.js): `pilihan` sebagai nama lain daftar, value kosong dilewati, nilai ikut di permukaan onPilih", async () => {
    const h = buka({ mode: "ui", url: HALAMAN.abtBeranda });
    await siapMode(h);
    const kabar: any[] = [];
    const el = h.w.aletaMassalBarisBlangko(
      { nomor: "586/Pdt.G/2026/PA.Dgl" },
      {
        blangkoUtama: "[01] Kabul",
        pilihan: [
          { nilai: "", label: "ikuti blangko utama" },
          { nilai: "k01", label: "[01] Kabul" },
          { nilai: "k02", label: "[02] Verstek" },
        ],
        onPilih: (x: any) => kabar.push(x),
      }
    );
    (el.querySelector(".aleta-massal-blangko-beda") as HTMLButtonElement).click();
    const pilih = el.querySelector(".aleta-massal-blangko-pilih") as HTMLSelectElement;
    expect(Array.from(pilih.options).map((o) => o.textContent)).toEqual(["Pilih blangko untuk perkara ini…", "[01] Kabul", "[02] Verstek"]);
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(kabar[0]).toMatchObject({ nilai: "k02", label: "[02] Verstek", bawaan: false });
    (el.querySelector(".aleta-massal-blangko-ulang") as HTMLButtonElement).click();
    expect(kabar[1]).toMatchObject({ nilai: "[01] Kabul", bawaan: true });
  });

  it("tanpa blangko lain: tombol mati dan menjelaskan; tanpa blangko utama: disebut belum dipilih", async () => {
    const h = buka({ mode: "ui" });
    await siapMode(h);
    const a = h.w.aletaMassalBarisBlangko({ nomor: "1" }, { blangkoUtama: "a.rtf", daftarBlangko: ["a.rtf"] });
    const tombol = a.querySelector(".aleta-massal-blangko-beda") as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    expect(tombol.title).toBe("Tidak ada blangko lain untuk dipilih");
    const b = h.w.aletaMassalBarisBlangko({ nomor: "2" }, { daftarBlangko: ["a.rtf"] });
    expect(b.querySelector(".aleta-massal-blangko-teks")!.textContent).toBe("Blangko utama belum dipilih");
    expect((b.querySelector(".aleta-massal-blangko-beda") as HTMLButtonElement).disabled).toBe(false);
  });
});

// ===========================================================================
// D. CSS - blok R2 di ujung panel.css, hanya UI Baru
// ===========================================================================
describe("panel.css blok R2", () => {
  it("ada di antara penanda R2, setiap aturan bersyarat kulit modern kecuali [hidden]", () => {
    const css = baca("panel.css");
    const m = /\/\* === R2 - PERBAIKAN 2 OKT === \*\/([\s\S]*?)\/\* === AKHIR R2 === \*\//.exec(css);
    expect(m).toBeTruthy();
    const aturan = m![1].replace(/\/\*[\s\S]*?\*\//g, "").split("}").map((x) => x.split("{")[0].trim()).filter(Boolean);
    expect(aturan.length).toBeGreaterThan(5);
    for (const sel of aturan) {
      for (const s of sel.split(",").map((x) => x.trim())) {
        if (s.endsWith("[hidden]")) continue;
        expect(s, s).toMatch(/^html\[data-aleta-kulit="modern"\] /);
      }
    }
  });
});
