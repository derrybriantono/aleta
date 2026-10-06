// @vitest-environment node
/**
 * ============================================================================
 * RELAAS & PBT MASSAL DI DAFTAR SIPP / BERANDA ABT (PERBAIKAN 30 SEP SORE, J)
 * ============================================================================
 *
 * panel-alat.js + jurusita.js dijalankan SUNGGUHAN sebagai satu skrip di jendela
 * jsdom beralamat halaman DAFTAR perkara SIPP atau BERANDA ABT. Yang ditiru hanya
 * tepinya: chrome.storage, chrome.runtime.sendMessage (pekerja latar), dan jawaban
 * rute ALETA. Dokumen rute cetak DINILAI dengan nilaiCetakDokumen yang sama
 * dengan rute relaas-massal/cetak - bukan diketik tangan.
 *
 * Yang dijaga:
 *   K3  aletaJurusitaPasangMassal: panel berdiri sendiri, tanggal (hari ini /
 *       hari kerja sebelumnya), centang Panggilan P/T + PBT P/T per perkara,
 *       Pilih semua, cetak massal lewat relaas-mulai, putaran Hentikan/Lanjutkan.
 *   Lama tidak menggambar, membaca, maupun mengirim apa pun.
 *   Peran selaras matriks K1: admin & juru sita; panitera/PP/hakim tidak.
 *   U3  panggilan sidang TUNDAAN: d = sidang tujuan; per perkara menyebut
 *       pertama/tundaan; atas data sungguhan sipp_donggala (SELECT saja).
 *   K5  penjelasan teknis bertanda aleta-teknis; pesan error tidak.
 *   latar.js: relaas RTF saja (6 Okt 2026) - rute PDF/siapa ALETA tidak
 *       disentuh, jadi sesi ALETA tidak dapat menahan putaran.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

import { ASAL as ASAL_LATAR, ENAM, Dunia, abtPalsu, jalankan, jawaban, minta, nyalakan, pesanMulai as pesanMulaiLatar } from "./dunia-latar";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_JURUSITA hanya dipakai pembukti gigitan: cacat dipasang pada SALINAN.
const SUMBER_JURUSITA = process.env.ALETA_UJI_JURUSITA
  ? readFileSync(process.env.ALETA_UJI_JURUSITA, "utf8").replace(/\r\n/g, "\n")
  : baca("jurusita.js");

const ASAL = "http://192.168.10.10";
const HALAMAN = {
  sippDaftar: `${ASAL}/SIPP/perkara`,
  abtBeranda: `${ASAL}/aps_badilag/abt/`,
  sippPerkara: `${ASAL}/SIPP/perkara_detil_agama/xyz`,
};
const berkasUntuk = (keadaan: string) => BLANGKO_RELAAS.find((x) => x.keadaan === keadaan)!.berkas;
const P_DAN_T = berkasUntuk("sidang-pertama");
const T_LANJUTAN = berkasUntuk("sidang-ditunda");
const PBT = berkasUntuk("pemberitahuan-putusan");

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

function hariIniIso() {
  const t = new Date();
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
}
function hariKerjaSebelum(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d, 12);
  do t.setDate(t.getDate() - 1);
  while (t.getDay() === 0 || t.getDay() === 6);
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
}

// ---------------------------------------------------------------------------
// Dokumen rute - bentuk bot, dinilai nilaiCetakDokumen seperti cetak/route.ts
// ---------------------------------------------------------------------------

type Bot = Record<string, any>;
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
    jurusita: { nama: "Rahmat Hidayat, S.H.", nip: "", dariPenunjukan: true },
    sudahAdaRelaas: false,
    sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" },
    ...x,
  };
}
function rute(d: Bot): Bot {
  const n = nilaiCetakDokumen(d as any);
  return {
    ...d,
    blangko: n.blangko,
    bisaDicetak: n.bisaDicetak,
    sebabTidakBisa: n.sebabTidakBisa,
    peringatan: n.peringatan,
    ikutPilihSemua: n.ikutPilihSemua,
  };
}

const CETAK = {
  ok: true,
  tanggal: "2026-09-30",
  dokumen: [
    bot({ perkaraId: 700, golongan: "sidang-pertama", d: 1, tanggalSidangTujuan: "2026-10-07", pihakDipanggil: "keduanya" }),
    // Tundaan: sidang ASAL hari ini, yang dipanggil sidang TUJUAN ke-3.
    bot({ perkaraId: 701, golongan: "sidang-ditunda", d: 3, tanggalSidangTujuan: "2026-10-06", pihakDipanggil: "kedua", dihadiriOleh: 2 }),
    bot({ perkaraId: 702, golongan: "sidang-ditunda", d: 2, tanggalSidangTujuan: "2026-10-08", pihakDipanggil: "keduanya", dihadiriOleh: 4 }),
    bot({ perkaraId: 703, golongan: "sidang-ditunda", d: 4, tanggalSidangTujuan: "2026-10-09", pihakDipanggil: "tidak-diketahui" }),
    bot({ perkaraId: 704, golongan: "pemberitahuan-putusan", d: null, pihakKe: 1, pihakDipanggil: "pertama", sudahAdaRelaas: true }),
    bot({ perkaraId: 704, golongan: "pemberitahuan-putusan", d: null, pihakKe: 2, pihakDipanggil: "kedua" }),
    bot({ perkaraId: 705, golongan: "sidang-ditunda", d: 2, tanggalSidangTujuan: "2026-10-06", pihakDipanggil: "kedua", sudahAdaRelaas: true }),
    bot({ perkaraId: 706, golongan: "sidang-pertama", d: 1, tanggalSidangTujuan: "2026-10-07", jurusita: { nama: "Budi Santoso", nip: "", dariPenunjukan: true } }),
    // Ikrar di luar rentang proses menu ABT - pasti ditolak ABT: tidak dapat dicetak.
    bot({ perkaraId: 707, golongan: "ikrar-talak", d: 5, tanggalSidangTujuan: "2026-10-10", prosesTerakhirId: 150, prosesTerakhirNama: "Sidang" }),
  ].map(rute),
  hariKerjaSebelumnya: {
    tanggal: "2026-09-29",
    dokumen: [bot({ perkaraId: 708, golongan: "sidang-ditunda", d: 3, tanggalSidangTujuan: "2026-10-13", pihakDipanggil: "kedua" })].map(rute),
  },
};

// ---------------------------------------------------------------------------
// Jendela uji
// ---------------------------------------------------------------------------

type Siapa = { nama: string; peran: string; roleId: string; peranTambahan?: string[] } | null;
type Pilihan = {
  mode?: "lama" | "baru" | "ui";
  url?: string;
  /** Jawaban "siapa" berurutan; yang terakhir dipakai seterusnya. null = 401. */
  siapa?: Siapa | Siapa[];
  cetak?: Record<string, unknown> | ((tanggal: string) => { status?: number; isi: unknown });
  rincian?: Record<string, unknown>;
  simpanan?: Record<string, unknown>;
  keadaan?: Record<string, unknown>;
  konfirmasi?: boolean;
  dataPeran?: string;
};

const JURUSITA = { nama: "Rahmat Hidayat", peran: "Jurusita", roleId: "jurusita", peranTambahan: [] };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Pilihan = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body><div id="panel"${p.dataPeran ? ` data-peran="${p.dataPeran}"` : ""}><div id="wadah"></div></div></body></html>`,
    { url: p.url ?? HALAMAN.sippDaftar, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos({ ujiTampilan: p.mode ?? "baru", ...(p.simpanan ?? {}) });
  const local = {
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
  };
  const pesan: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.175.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      lastError: undefined,
      sendMessage: (m: any, balik?: (x: unknown) => void) => {
        pesan.push(polos(m));
        let jawab: unknown = { ok: true };
        if (m.jenis === "relaas-mulai") {
          const butir = (m.pekerjaan?.dokumen ?? []).map((d: any) => ({ ...d, keadaan: "menunggu" }));
          jawab = {
            ok: true,
            pekerjaan: { id: "relaas-uji", butir, selesai: false, dilewati: [] },
            ringkas: { menunggu: butir.length, selesai: 0 },
            perkiraan: { rata: 120000 },
          };
        } else if (m.jenis === "relaas-keadaan") {
          jawab = p.keadaan ?? { ok: true, pekerjaan: null, ringkas: {} };
        }
        setTimeout(() => balik && balik(polos(jawab)), 0);
      },
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: string[] = [];
  let keSiapa = 0;
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    let status = 200;
    let isi: unknown = { ok: false };
    if (url.includes("/aleta/api/aleta-ecourt/ekstensi/siapa")) {
      const urut = Array.isArray(p.siapa) ? p.siapa : [p.siapa === undefined ? JURUSITA : p.siapa];
      const s = urut[Math.min(keSiapa, urut.length - 1)];
      keSiapa += 1;
      if (s === null) status = 401;
      else isi = { ok: true, data: s };
    } else if (url.includes("/aleta/api/aleta-ecourt/pemetaan-blangko")) {
      status = 404;
    } else if (url.includes("/aleta/api/aleta-ecourt/relaas-massal/cetak")) {
      const tanggal = new URL(url, ASAL).searchParams.get("tanggal") || "";
      if (typeof p.cetak === "function") {
        const j = p.cetak(tanggal);
        status = j.status ?? 200;
        isi = j.isi;
      } else isi = { ok: true, data: p.cetak ?? CETAK };
    } else if (url.includes("/aleta/api/aleta-ecourt/sidang?nomor=")) {
      isi = { ok: true, data: { available: true, sipp: p.rincian } };
    } else status = 404;
    return new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  const konfirmasi: string[] = [];
  w.confirm = (x: string) => {
    konfirmasi.push(x);
    return p.konfirmasi !== false;
  };
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_JURUSITA}\n;\nwindow.__uji = { mode: () => alatUjiMode(), kering: () => alatKeringNyala(), golongan: (p) => alatGolonganPeran(p) };`);
  return { dom, w, pesan, minta, konfirmasi, wadah: w.document.getElementById("wadah") as HTMLElement };
}

type H = ReturnType<typeof buka>;
const siapMode = (h: H, mode = "baru") => sampai(() => h.w.__uji.mode() === mode, `mode ${mode}`);
const pasangMassal = async (h: H, situs = "sipp") => (await h.w.aletaJurusitaPasangMassal(h.wadah, { situs })) as boolean;
const pesanMulai = (h: H) => h.pesan.filter((m) => m.jenis === "relaas-mulai");
const panel = (h: H) => h.wadah.querySelector(".aleta-jurusita-massal-panel") as HTMLElement;
const ringkas = (h: H) => sampai(() => h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-ringkas"), "ringkasan massal");
const tombol = (h: H, kelas: string) => h.wadah.querySelector(`.aleta-jurusita-massal-panel .${kelas}`) as HTMLButtonElement;
function centang(h: H, perkaraId: number, nilai: string, kelompok = "hari-ini") {
  const c = h.wadah.querySelector(
    `.aleta-jurusita-perkara[data-perkara-id="${perkaraId}"][data-kelompok="${kelompok}"] input[value="${nilai}"]`
  ) as HTMLInputElement;
  expect(c, `centang ${perkaraId} ${nilai}`).toBeTruthy();
  return c;
}
function klikCentang(h: H, perkaraId: number, nilai: string, kelompok = "hari-ini") {
  const c = centang(h, perkaraId, nilai, kelompok);
  c.checked = !c.checked;
  c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}
const ringkasDok = (d: any) => `${d.perkaraId}|${d.golongan}|${d.d}|${d.berkas}`;

// ===========================================================================

describe("gerbang: tampilan Lama dan peran (matriks K1)", () => {
  it("Lama: panel massal tidak menggambar, tidak membaca, tidak mengirim - di daftar SIPP dan beranda ABT", async () => {
    for (const url of [HALAMAN.sippDaftar, HALAMAN.abtBeranda]) {
      const h = buka({ mode: "lama", url });
      await tunggu(50);
      expect(typeof h.w.aletaJurusitaPasangMassal).toBe("function");
      const sebelum = h.wadah.outerHTML;
      expect(await pasangMassal(h, url === HALAMAN.abtBeranda ? "abt" : "sipp")).toBe(false);
      await tunggu(50);
      expect(h.wadah.outerHTML).toBe(sebelum);
      expect(h.minta.filter((u) => /ekstensi\/siapa|relaas-massal|pemetaan-blangko/.test(u))).toEqual([]);
      expect(h.pesan).toEqual([]);
    }
  });

  it("panitera pengganti (akun MUNIFA di ALETA) dan hakim ditolak; juru sita, admin, super admin boleh", async () => {
    for (const [siapa, boleh] of [
      [{ nama: "MUNIFA, S.H.", peran: "Panitera Pengganti", roleId: "panitera-pengganti" }, false],
      [{ nama: "Hakim Satu", peran: "Hakim", roleId: "hakim" }, false],
      [{ nama: "Ketua", peran: "Wakil Ketua", roleId: "wakil-ketua" }, false],
      [JURUSITA, true],
      [{ nama: "Admin", peran: "Admin", roleId: "admin" }, true],
      [{ nama: "Super", peran: "Super Admin", roleId: "super-admin" }, true],
      // Peran tambahan juru sita pada akun PP cukup.
      [{ nama: "PP Merangkap", peran: "Panitera Pengganti", roleId: "panitera-pengganti", peranTambahan: ["jurusita"] }, true],
      // Peran "lain" seperti sebelumnya: staf pelaksana tidak (alatKelasPeran lain).
      [{ nama: "Mustini", peran: "Staf Pelaksana", roleId: "staf" }, false],
    ] as Array<[Siapa, boolean]>) {
      const h = buka({ siapa });
      await siapMode(h);
      expect(await pasangMassal(h), String(siapa!.peran)).toBe(boleh);
      if (!boleh) {
        expect(h.wadah.innerHTML).toBe("");
        expect(h.minta.some((u) => u.includes("relaas-massal"))).toBe(false);
      }
    }
  });

  it("aletaJurusitaBoleh selaras matriks: panitera tidak lagi, 'lain' tetap aturan lama", async () => {
    const h = buka();
    await siapMode(h);
    const ab = (p: string) => h.w.aletaJurusitaBoleh(p);
    expect(ab("Jurusita")).toBe(true);
    expect(ab("Jurusita Pengganti")).toBe(true);
    expect(ab("Super Admin")).toBe(true);
    expect(ab("Admin")).toBe(true);
    expect(ab("Panitera Pengganti")).toBe(false);
    expect(ab("Panitera")).toBe(false);
    expect(ab("Hakim")).toBe(false);
    // "lain": alatKelasPeran lama - "Pengadministrasi Umum" (kelas admin) tetap boleh, Operator tidak.
    expect(h.w.__uji.golongan("Pengadministrasi Umum")).toBe("lain");
    expect(ab("Pengadministrasi Umum")).toBe(true);
    expect(ab("Operator")).toBe(false);
  });
});

describe("K3 panel massal di DAFTAR perkara SIPP", () => {
  it("membaca daftar hari ini SEGERA; ringkasan menyebut tundaan; hanya milik juru sita yang masuk", async () => {
    const h = buka();
    await siapMode(h);
    expect(await pasangMassal(h)).toBe(true);
    expect(panel(h).getAttribute("data-situs")).toBe("sipp");
    expect(panel(h).textContent).toContain("Relaas & pemberitahuan putusan - massal");
    const r = await ringkas(h);
    const bacaan = h.minta.filter((u) => u.includes("relaas-massal/cetak"));
    expect(bacaan).toHaveLength(1);
    expect(new URL(bacaan[0], ASAL).searchParams.get("tanggal")).toBe(hariIniIso());
    expect(r.textContent).toBe("7 perkara · 6 panggilan (4 tundaan) · 1 PBT");
    // 706 milik Budi Santoso - tidak tampil dalam "Milik saya".
    expect(h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="706"]')).toBeNull();
    // Tundaan menyebut sidang TUJUAN dan jenisnya.
    const b701 = h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="701"]')!.textContent || "";
    expect(b701).toContain("Panggilan sidang ke-3 · 6 Okt 2026 · tundaan");
    // Tidak ada yang tercentang sendiri.
    expect(tombol(h, "aleta-jurusita-cetak-massal").disabled).toBe(true);
  });

  it("Pilih semua: pihak menurut SIPP; tundaan d = sidang tujuan; P dan T satu dokumen; PBT sekali; dikirim sesudah konfirmasi", async () => {
    const h = buka();
    await siapMode(h);
    await pasangMassal(h);
    await ringkas(h);
    tombol(h, "aleta-jurusita-pilih-semua").click();
    await sampai(() => !tombol(h, "aleta-jurusita-cetak-massal").disabled, "cetak menyala");
    const cetak = tombol(h, "aleta-jurusita-cetak-massal");
    expect(cetak.textContent).toBe("Cetak 4 dokumen");
    // Yang tidak ikut Pilih semua: sudah tercatat (705, PBT 704 pihak 1), pihak tak diketahui (703), ikrar ditolak ABT (707).
    expect(centang(h, 705, "p2").checked).toBe(false);
    expect(centang(h, 703, "p2").checked).toBe(false);
    expect(centang(h, 703, "p2").disabled).toBe(false); // pihaknya dicentang sendiri
    expect(centang(h, 704, "b1").checked).toBe(false);
    expect(centang(h, 704, "b2").checked).toBe(true);
    expect(centang(h, 707, "p1").disabled).toBe(true);
    expect(h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="707"] .aleta-jurusita-salah')!.textContent).toMatch(/ABT akan menolaknya/);
    cetak.click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    expect(h.konfirmasi).toHaveLength(1);
    const m = pesanMulai(h)[0];
    expect(m.sumber).toBe("aleta-panel");
    expect(m.pekerjaan.asal).toBe(ASAL);
    expect(m.pekerjaan.asalAbt).toBe(`${ASAL}/aps_badilag`);
    expect(m.pekerjaan.tanggal).toBe(hariIniIso());
    const dok = m.pekerjaan.dokumen;
    expect(dok.map(ringkasDok).sort()).toEqual(
      [
        `700|sidang-pertama|1|${P_DAN_T}`,
        `701|sidang-ditunda|3|${T_LANJUTAN}`,
        `702|sidang-ditunda|2|${P_DAN_T}`,
        `704|pemberitahuan-putusan|0|${PBT}`,
      ].sort()
    );
    // Hanya ruas kontrak mesin relaas; kunci unik; nama berkas menyebut sidang tundaan.
    for (const d of dok) {
      expect(Object.keys(d).sort()).toEqual(["berkas", "d", "golongan", "jurusita", "kunci", "label", "nama", "nomorPerkara", "perkaraId"]);
    }
    expect(new Set(dok.map((d: any) => d.kunci)).size).toBe(dok.length);
    expect(dok.find((d: any) => d.perkaraId === "701").nama).toBe("701-Pdt.G-2026-PA.Dgl - panggilan sidang ke-3 Tergugat");
    expect(dok.find((d: any) => d.perkaraId === "702").label).toBe("Panggilan Penggugat dan Tergugat");
    await sampai(() => /4 dokumen masuk putaran cetak/.test(panel(h).textContent || ""), "kabar berhasil");
  });

  it("centang sendiri: pihak tak diketahui (Tergugat -> T lanjutan), hari kerja sebelumnya ikut bila dicentang", async () => {
    const h = buka();
    await siapMode(h);
    await pasangMassal(h);
    await ringkas(h);
    const kemarin = h.wadah.querySelector(".aleta-jurusita-kemarin") as HTMLDetailsElement;
    expect(kemarin.querySelector("summary")!.textContent).toBe("Dari hari kerja sebelumnya · 29 Sep 2026 (1)");
    tombol(h, "aleta-jurusita-pilih-semua").click();
    await sampai(() => tombol(h, "aleta-jurusita-cetak-massal").textContent === "Cetak 4 dokumen", "4 dokumen");
    expect(centang(h, 708, "p2", "kemarin").checked).toBe(false); // tidak ikut Pilih semua
    klikCentang(h, 703, "p2");
    klikCentang(h, 708, "p2", "kemarin");
    expect(tombol(h, "aleta-jurusita-cetak-massal").textContent).toBe("Cetak 6 dokumen");
    tombol(h, "aleta-jurusita-cetak-massal").click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    const dok = pesanMulai(h)[0].pekerjaan.dokumen.map(ringkasDok);
    expect(dok).toContain(`703|sidang-ditunda|4|${T_LANJUTAN}`);
    expect(dok).toContain(`708|sidang-ditunda|3|${T_LANJUTAN}`);
  });

  it("tundaan yang pihaknya diubah: Tergugat saja -> T lanjutan; ditambah Penggugat -> satu P dan T", async () => {
    const h = buka();
    await siapMode(h);
    await pasangMassal(h);
    await ringkas(h);
    klikCentang(h, 701, "p2");
    expect(tombol(h, "aleta-jurusita-cetak-massal").textContent).toBe("Cetak 1 dokumen");
    klikCentang(h, 701, "p1");
    expect(tombol(h, "aleta-jurusita-cetak-massal").textContent).toBe("Cetak 1 dokumen");
    const blangko = h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="701"] .aleta-jurusita-blangko')!;
    expect(blangko.textContent).toBe(`Blangko: ${P_DAN_T}`);
    tombol(h, "aleta-jurusita-cetak-massal").click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    expect(pesanMulai(h)[0].pekerjaan.dokumen.map(ringkasDok)).toEqual([`701|sidang-ditunda|3|${P_DAN_T}`]);
  });

  it("Batal pada konfirmasi dan mode kering: tidak ada yang dikirim", async () => {
    const h = buka({ konfirmasi: false });
    await siapMode(h);
    await pasangMassal(h);
    await ringkas(h);
    tombol(h, "aleta-jurusita-pilih-semua").click();
    await sampai(() => !tombol(h, "aleta-jurusita-cetak-massal").disabled, "cetak menyala");
    tombol(h, "aleta-jurusita-cetak-massal").click();
    await tunggu(50);
    expect(h.konfirmasi).toHaveLength(1);
    expect(pesanMulai(h)).toEqual([]);

    const k = buka({ simpanan: { modeKering: true } });
    await siapMode(k);
    await sampai(() => k.w.__uji.kering() === true, "mode kering");
    await pasangMassal(k);
    await ringkas(k);
    tombol(k, "aleta-jurusita-pilih-semua").click();
    await sampai(() => !tombol(k, "aleta-jurusita-cetak-massal").disabled, "cetak menyala");
    tombol(k, "aleta-jurusita-cetak-massal").click();
    await sampai(() => /Mode kering/.test(panel(k).textContent || ""), "kabar kering");
    expect(pesanMulai(k)).toEqual([]);
  });

  it("admin di daftar SIPP: panel terlipat, daftar satu hari dibaca baru saat dibuka", async () => {
    const h = buka({ siapa: { nama: "Admin", peran: "Admin", roleId: "admin" } });
    await siapMode(h);
    expect(await pasangMassal(h)).toBe(true);
    const lipat = h.wadah.querySelector(".aleta-jurusita-massal-lipat") as HTMLDetailsElement;
    expect(lipat.open).toBe(false);
    await tunggu(50);
    expect(h.minta.some((u) => u.includes("relaas-massal/cetak"))).toBe(false);
    lipat.open = true;
    lipat.dispatchEvent(new h.w.Event("toggle"));
    await ringkas(h);
    expect(h.minta.filter((u) => u.includes("relaas-massal/cetak"))).toHaveLength(1);
    // Juru sita: terbuka dan langsung dibaca (lihat uji pertama).
    const j = buka();
    await siapMode(j);
    await pasangMassal(j);
    expect((j.wadah.querySelector(".aleta-jurusita-massal-lipat") as HTMLDetailsElement).open).toBe(true);
  });

  it("rute gagal: sebabnya tampil sebagai error (tidak bertanda teknis)", async () => {
    const h = buka({ cetak: () => ({ status: 502, isi: { ok: false, alasan: "bot tidak menjawab" } }) });
    await siapMode(h);
    await pasangMassal(h);
    const salah = await sampai(() => h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-kabar-salah"), "kabar salah");
    expect(salah.textContent).toBe("bot tidak menjawab");
    expect(salah.closest(".aleta-teknis")).toBeNull();
  });
});

describe("K3 panel massal di BERANDA ABT", () => {
  it("situs abt; 'Semua juru sita' memperlihatkan perkara juru sita lain; Hari kerja sebelumnya membaca tanggal itu", async () => {
    const tanggalDibaca: string[] = [];
    const h = buka({
      url: HALAMAN.abtBeranda,
      siapa: { nama: "Super", peran: "Super Admin", roleId: "super-admin" },
      cetak: (t) => {
        tanggalDibaca.push(t);
        return { isi: { ok: true, data: CETAK } };
      },
    });
    await siapMode(h);
    expect(await pasangMassal(h, "abt")).toBe(true);
    expect(panel(h).getAttribute("data-situs")).toBe("abt");
    await ringkas(h);
    // Admin: bawaannya semua juru sita.
    expect((h.wadah.querySelector(".aleta-jurusita-saring") as HTMLSelectElement).value).toBe("semua");
    expect(h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="706"]')).toBeTruthy();
    expect(h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="706"]')!.textContent).toContain("Budi Santoso");
    tombol(h, "aleta-jurusita-hari-sebelumnya").click();
    await sampai(() => tanggalDibaca.length === 2, "bacaan kedua");
    expect(tanggalDibaca).toEqual([hariIniIso(), hariKerjaSebelum(hariIniIso())]);
    expect((h.wadah.querySelector(".aleta-jurusita-tanggal") as HTMLInputElement).value).toBe(hariKerjaSebelum(hariIniIso()));
    tombol(h, "aleta-jurusita-hari-ini").click();
    await sampai(() => tanggalDibaca.length === 3, "bacaan ketiga");
    expect(tanggalDibaca[2]).toBe(hariIniIso());
  });

  it("pemasangan ulang tidak menggandakan; panel per perkara di wadah yang sama tidak terhapus", async () => {
    const h = buka({ url: HALAMAN.abtBeranda });
    await siapMode(h, "baru");
    await pasangMassal(h, "abt");
    await pasangMassal(h, "abt");
    expect(h.wadah.querySelectorAll(".aleta-jurusita-massal-panel").length).toBe(1);
    const u = buka({ mode: "ui", url: HALAMAN.abtBeranda });
    await siapMode(u, "ui");
    expect(await pasangMassal(u, "abt")).toBe(true);
  });
});

describe("putaran tertahan - Hentikan/Lanjutkan dan kalimat sesi yang jujur", () => {
  const tertahan = {
    ok: true,
    pekerjaan: {
      id: "relaas-x",
      butir: Array.from({ length: 8 }, (_, i) => ({ nomorPerkara: `${i}/Pdt.G/2026/PA.Dgl`, label: "x", keadaan: i < 3 ? "selesai" : "menunggu" })),
      selesai: false,
      dilewati: [],
      tertahan: { sebab: "Sesi ALETA habis - masuk ke portal ALETA lagi, lalu tekan Lanjutkan.", perluMasuk: "aleta", pada: 1234 },
    },
    ringkas: { selesai: 3 },
  };

  it("halaman masih masuk ALETA: dikatakan, bukan disuruh masuk lagi; Lanjutkan & Hentikan dikirim ke latar", async () => {
    const h = buka({ keadaan: tertahan });
    await siapMode(h);
    await pasangMassal(h);
    const teks = await sampai(() => h.wadah.querySelector(".aleta-jurusita-putaran-teks"), "putaran");
    expect(teks.textContent).toBe("Putaran tertahan: 3/8 selesai");
    const cek = await sampai(() => {
      const e = h.wadah.querySelector(".aleta-jurusita-cek-sesi") as HTMLElement;
      return e && !e.hidden && e.textContent ? e : null;
    }, "cek sesi");
    expect(cek.textContent).toContain("masih masuk ALETA sebagai Rahmat Hidayat");
    expect(cek.closest(".aleta-teknis")).toBeNull();
    const tombolPutaran = [...h.wadah.querySelectorAll(".aleta-jurusita-putaran-kepala button")] as HTMLButtonElement[];
    expect(tombolPutaran.map((b) => b.textContent)).toEqual(["Hentikan", "Lanjutkan"]);
    tombolPutaran[1].click();
    await sampai(() => h.pesan.some((m) => m.jenis === "relaas-lanjut"), "relaas-lanjut");
  });

  it("halaman juga tidak masuk: disuruh masuk ke portal", async () => {
    const h = buka({ keadaan: tertahan, siapa: [JURUSITA, null] });
    await siapMode(h);
    await pasangMassal(h);
    const cek = await sampai(() => {
      const e = h.wadah.querySelector(".aleta-jurusita-cek-sesi") as HTMLElement;
      return e && !e.hidden && e.textContent ? e : null;
    }, "cek sesi");
    expect(cek.textContent).toBe("Halaman ini juga tidak lagi masuk ALETA - buka portal ALETA, masuk, lalu tekan Lanjutkan.");
  });
});

describe("K5 penjelasan teknis", () => {
  it("ⓘ dan uraiannya bertanda aleta-teknis dan uraiannya kini benar-benar terbuka; pesan tindakan tidak", async () => {
    const h = buka();
    await siapMode(h);
    await pasangMassal(h);
    await ringkas(h);
    const info = h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-info") as HTMLButtonElement;
    const uraian = h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-uraian") as HTMLElement;
    expect(info.classList.contains("aleta-teknis")).toBe(true);
    expect(uraian.classList.contains("aleta-teknis")).toBe(true);
    expect(uraian.isConnected).toBe(true);
    expect(uraian.hidden).toBe(true);
    info.click();
    expect(uraian.hidden).toBe(false);
    // Nama berkas blangko = teknis; sebab tidak dapat dicetak & catatan = bukan.
    klikCentang(h, 701, "p2");
    expect(h.wadah.querySelector('.aleta-jurusita-perkara[data-perkara-id="701"] .aleta-jurusita-blangko')!.classList.contains("aleta-teknis")).toBe(true);
    for (const e of h.wadah.querySelectorAll(".aleta-jurusita-salah, .aleta-jurusita-catatan, .aleta-jurusita-ringkas")) {
      expect(e.closest(".aleta-teknis"), e.textContent || "").toBeNull();
    }
  });
});

describe("U3 per perkara: sidang pertama DAN tundaan dapat dipilih", () => {
  const rincian = {
    perkaraId: "10018",
    nomorPerkara: "544/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    jurusita: [{ nama: "Rahmat Hidayat, S.H." }],
    putusan: { sudahPutus: false, tanggalPutusan: "" },
    jadwalPerkara: [
      { urutanSidang: 1, tanggalSidang: "2026-09-01", agenda: "Pemeriksaan identitas", dihadiriOleh: 4 },
      { urutanSidang: 2, tanggalSidang: "2026-09-15", agenda: "Panggil Tergugat", dihadiriOleh: 2 },
      { urutanSidang: 3, tanggalSidang: "2099-10-07", agenda: "Pembuktian", dihadiriOleh: null },
    ],
  };

  it("pilihan menyebut 'sidang pertama'/'tundaan'; petunjuk dari kehadiran sidang sebelumnya; tundaan P+T = satu P dan T", async () => {
    const h = buka({ url: HALAMAN.sippPerkara, rincian });
    await siapMode(h);
    expect(await h.w.aletaJurusitaPasang(h.wadah, { situs: "sipp", nomorPerkara: rincian.nomorPerkara, perkaraId: "10018" })).toBe(true);
    const pilih = await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang") as HTMLSelectElement, "pilihan sidang");
    const opsi = [...pilih.options].map((o) => o.textContent);
    expect(opsi[0]).toBe("ke-1 · 1 Sep 2026 · sidang pertama · Pemeriksaan identitas");
    expect(opsi[1]).toBe("ke-2 · 15 Sep 2026 · tundaan · Panggil Tergugat");
    expect(opsi[2]).toBe("ke-3 · 7 Okt 2099 · tundaan · Pembuktian");
    expect(pilih.value).toBe("3");
    const petunjuk = h.wadah.querySelector(".aleta-jurusita-petunjuk") as HTMLElement;
    expect(petunjuk.hidden).toBe(false);
    expect(petunjuk.textContent).toBe("Sidang ke-2 hanya dihadiri Penggugat - yang dipanggil Tergugat.");
    pilih.value = "2";
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(petunjuk.textContent).toBe("Sidang ke-1 tidak dihadiri pihak - yang dipanggil Penggugat dan Tergugat.");
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    expect(petunjuk.hidden).toBe(true);
    // Rincian blangko teknis bila semua terpetakan.
    expect(h.wadah.querySelector(".aleta-jurusita-bagian .aleta-jurusita-rinci")!.classList.contains("aleta-teknis")).toBe(true);
  });
});

// ===========================================================================
// latar.js - relaas RTF saja (6 Okt 2026): ALETA tidak disentuh, tidak tertahan
// ===========================================================================

describe("latar.js: relaas RTF saja - sesi ALETA yang habis TIDAK menahan putaran", () => {
  it("rute PDF dan 'siapa' menjawab 401, tetapi putaran selesai dengan RTF tanpa menyentuh keduanya", async () => {
    const abt = abtPalsu({ pdf: () => jawaban(401, "{}", `${ASAL_LATAR}/aleta/api/aleta-bot/abt/pdf`) });
    const d = new Dunia((p) =>
      p.alamat.includes("/aleta/api/aleta-ecourt/ekstensi/siapa") ? jawaban(401, "{}", p.alamat) : abt(p)
    );
    const pekerja = nyalakan(d);
    await minta(d, pekerja, pesanMulaiLatar(ENAM.slice(0, 1)));
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    expect(d.putaran().tertahan).toBeNull();
    expect(d.putaran().butir[0].keadaan).toBe("selesai");
    expect(d.permintaan.filter((p) => p.alamat.includes("/aleta/api/"))).toEqual([]);
    expect(d.unduhan).toHaveLength(1);
    expect(d.unduhan[0].filename).toMatch(/\.rtf$/);
  });
});

// ===========================================================================
// U3 atas data sungguhan: sipp_donggala (HANYA SELECT) -> rute -> panel massal
// ===========================================================================

const MYSQL = "D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe";
const ADA_MYSQL = existsSync(MYSQL);
const KERJA = "D:/aleta-dev/kerja/relaas-antrian";
const BERKAS_SQL = path.join(KERJA, `_uji-jurusita-massal-${process.pid}.sql`);

function kutip(n: unknown): string {
  if (n === null || n === undefined) return "NULL";
  if (Array.isArray(n)) return n.length === 0 ? "NULL" : n.map(kutip).join(",");
  if (typeof n === "number") return String(n);
  if (n instanceof Date) return `'${n.toISOString().slice(0, 19).replace("T", " ")}'`;
  return `'${String(n).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}
function jalankanSql(sql: string, isian: unknown[]) {
  // Hanya pembacaan: sipp_donggala tidak boleh diubah.
  if (!/^\s*(\(\s*)?(select|with)\b/i.test(sql)) throw new Error(`bukan SELECT: ${sql.slice(0, 80)}`);
  let i = 0;
  const utuh = sql.replace(/\?/g, () => kutip(isian[i++]));
  mkdirSync(KERJA, { recursive: true });
  writeFileSync(BERKAS_SQL, utuh, "utf8");
  const keluar = execFileSync(MYSQL, ["-u", "root", "-B", "sipp_donggala", `--execute=source ${BERKAS_SQL}`], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  }).trim();
  if (!keluar) return [];
  const baris = keluar.split(/\r?\n/);
  const kepala = baris[0].split("\t");
  return baris.slice(1).map((b) => {
    const sel = b.split("\t");
    const o: Record<string, string | null> = {};
    kepala.forEach((k, j) => (o[k] = sel[j] === "NULL" ? null : sel[j]));
    return o;
  });
}
function muatLayanan() {
  const require_ = createRequire(import.meta.url);
  const akarBot = path.join(path.resolve(process.cwd(), ".."), "aleta_bot");
  const jalurDb = require_.resolve(path.join(akarBot, "db_config"));
  const Modul = require_("node:module") as any;
  const palsu = new Modul(jalurDb);
  palsu.filename = jalurDb;
  palsu.loaded = true;
  palsu.exports = {
    query: (sql: string, isian: unknown[], balik: (g: Error | null, h: unknown) => void) => {
      try {
        balik(null, jalankanSql(sql, isian || []));
      } catch (e) {
        const g = e as { stderr?: string; message?: string };
        balik(new Error(String(g.stderr || g.message || e).split(/\r?\n/)[0].slice(0, 400)), null);
      }
    },
  };
  (require_.cache as any)[jalurDb] = palsu;
  return require_(path.join(akarBot, "services", "relaasMassalService.js")) as {
    relaasCetakHarian: (t: string) => Promise<any>;
  };
}

describe.skipIf(!ADA_MYSQL)("U3 data sungguhan sipp_donggala: panggilan sidang TUNDAAN sampai ke relaas-mulai", () => {
  /**
   * 9 Sep 2026 (diukur 30 Sep): 12 dokumen lahir - 11 panggilan sidang tundaan
   * (golongan sidang-ditunda, d = urutan sidang TUJUAN) + 1 ikrar; hari kerja
   * sebelumnya (8 Sep) 12 dokumen. Tidak satu pun sidang pertama: yang
   * menggigit bila tundaan tidak diikutkan.
   */
  it("9 Sep 2026: tiap tundaan yang siap ikut Pilih semua dan dikirim dengan d sidang tujuan", async () => {
    const layanan = muatLayanan();
    const hasil = await layanan.relaasCetakHarian("2026-09-09");
    const tundaan = hasil.dokumen.filter((d: any) => d.golongan === "sidang-ditunda");
    expect(tundaan.length).toBeGreaterThanOrEqual(10);
    for (const d of tundaan) {
      expect(Number(d.d), d.kunci).toBeGreaterThan(1);
      expect(String(d.tanggalSidangTujuan) > "2026-09-09", d.kunci).toBe(true);
    }
    const data = {
      ...hasil,
      dokumen: hasil.dokumen.map(rute),
      hariKerjaSebelumnya: { tanggal: hasil.hariKerjaSebelumnya.tanggal, dokumen: hasil.hariKerjaSebelumnya.dokumen.map(rute) },
    };
    const h = buka({ siapa: { nama: "Admin", peran: "Admin", roleId: "admin" }, cetak: () => ({ isi: { ok: true, data } }) });
    await siapMode(h);
    expect(await h.w.aletaJurusitaPasangMassal(h.wadah, { situs: "sipp", terbuka: true })).toBe(true);
    const r = await ringkas(h);
    expect(r.textContent).toMatch(new RegExp(`\\(${tundaan.length} tundaan\\)`));
    tombol(h, "aleta-jurusita-pilih-semua").click();
    await tunggu(20);
    const harus = data.dokumen.filter(
      (d: any) =>
        d.golongan === "sidang-ditunda" && d.bisaDicetak === true && d.ikutPilihSemua !== false && d.sudahAdaRelaas !== true
    );
    expect(harus.length).toBeGreaterThan(0);
    const cetak = tombol(h, "aleta-jurusita-cetak-massal");
    expect(cetak.disabled).toBe(false);
    cetak.click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    const kirim = pesanMulai(h)[0].pekerjaan.dokumen.filter((d: any) => d.golongan === "sidang-ditunda");
    expect(kirim.map((d: any) => `${d.perkaraId}|${d.d}`).sort()).toEqual(harus.map((d: any) => `${d.perkaraId}|${Number(d.d)}`).sort());
    for (const d of kirim) {
      const asal = harus.find((x: any) => String(x.perkaraId) === d.perkaraId)!;
      expect(d.berkas, d.nomorPerkara).toBe(asal.blangko.berkas);
    }
  }, 60000);
});
