// @vitest-environment node
/**
 * ============================================================================
 * UJI RILIS U2b - BAS MASSAL DALAM SEMUA KEADAAN (9 OKT 2026)
 * ============================================================================
 *
 * panel-alat.js + basmassal.js dijalankan SUNGGUHAN di jsdom (halaman daftar
 * perkara SIPP). Yang ditiru hanya tepinya: chrome.storage dan jawaban rute
 * ALETA - termasuk jawaban yang RUSAK: 5xx, batas waktu, server mati, bot
 * mati, sesi ALETA habis (401). Yang dijaga:
 *
 *   - daftar campuran (BAS sudah/belum/tak diketahui di SIPP, saksi ada/tidak,
 *     lembar ALETA ada/tidak, tanpa blangko, perkara_id kosong) tergambar
 *     dengan tanda yang benar, dan hanya yang berblangko dapat dicentang;
 *   - satu perkara gagal di tengah "Kerjakan yang dicentang" (periksa 5xx,
 *     naskah 502, batas waktu, 401) TIDAK menghentikan yang berikutnya, dan
 *     sebabnya tertulis di baris perkara itu;
 *   - selama putaran berjalan tanggal & saringan dikunci (daftar yang tampak
 *     selalu daftar tanggal yang tertulis);
 *   - admin di UI Baru: "Kerjakan semua milik X" hanya mengerjakan perkara X;
 *   - tidak ada satu pun permintaan non-GET di seluruh keadaan itu.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_BAS = process.env.ALETA_UJI_BASMASSAL
  ? readFileSync(process.env.ALETA_UJI_BASMASSAL, "utf8").replace(/\r\n/g, "\n")
  : baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 8000): Promise<NonNullable<T>> {
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

const FOLDER = "derry_briantono/- BAS VERSTEK PERCERAIAN -";
const PILIHAN = [
  { folder: FOLDER, berkas: "[02] BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf", setId: "bas-verstek", setNama: "BAS Verstek Perceraian", basKe: 2, label: "P Hadir & T Tidak Hadir - Putusan Verstek", kehadiran: "cocok" },
  { folder: FOLDER, berkas: "[02a] BAS 2 P & T Tidak Hadir - Gugur.rtf", setId: "bas-verstek", setNama: "BAS Verstek Perceraian", basKe: 2, label: "P & T Tidak Hadir - Gugur", kehadiran: "bertentangan" },
];

function baris(id: number, tambahan: Record<string, unknown> = {}) {
  return {
    sidangId: String(500 + id),
    perkaraId: String(id),
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-10-09",
    jamSidang: "09:00",
    agenda: "Pembuktian",
    ditunda: false,
    sudahPutus: false,
    urutanSidang: 2,
    dihadiriOleh: 2,
    kehadiran: "hanya pihak pertama hadir",
    basSipp: false,
    paniteraNama: "Siti Aminah, S.H.",
    pengguna: { id: "siti", nama: "Siti Aminah, S.H." },
    milikSaya: true,
    saksi: { pihak1: 0, pihak2: 0, nama1: [], nama2: [] },
    lembar: null,
    blangko: { usulan: PILIHAN[0], pilihan: PILIHAN, sebab: "" },
    ...tambahan,
  };
}

/** Jawaban satu permintaan: Response, atau lemparan (server mati / batas waktu). */
type Layan = (url: string, ke: number) => Response | undefined | Promise<Response | undefined>;

type Pilihan = {
  mode?: "baru" | "ui" | "lama";
  siapa?: Record<string, unknown>;
  sidang?: unknown[] | ((tanggal: string) => unknown[]);
  saringan?: string;
  layan?: Layan;
};

const PP = { nama: "Siti Aminah", peran: "Panitera Pengganti", roleId: "panitera-pengganti", peranTambahan: [] };
const ADMIN = { nama: "Qadarsyah", peran: "Admin", roleId: "admin", peranTambahan: [] };

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Pilihan = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="panel"><div id="wadah"></div></div></body></html>`, {
    url: `${ASAL}/SIPP/list_perkara`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.mode ?? "baru" };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.188.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      lastError: undefined,
      sendMessage: (_m: unknown, balik?: (x: unknown) => void) => setTimeout(() => balik && balik({ ok: true }), 0),
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
  const hitung = new Map<string, number>();
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    minta.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase() });
    const jalur = url.replace(/\?.*$/, "");
    const ke = (hitung.get(url) ?? 0) + 1;
    hitung.set(url, ke);
    if (p.layan) {
      const r = await p.layan(url, ke);
      if (r) return r;
    }
    if (jalur.endsWith("/ekstensi/siapa")) return Response.json({ ok: true, data: p.siapa ?? PP });
    if (jalur.endsWith("/aleta-ecourt/bas-massal")) {
      const q = new URL(url, ASAL).searchParams;
      const tanggal = q.get("tanggal") || "2026-10-09";
      const sidang = typeof p.sidang === "function" ? p.sidang(tanggal) : (p.sidang ?? [baris(11)]);
      return Response.json({
        ok: true,
        data: { tanggal, saringan: q.get("saringan") || p.saringan || "saya", lihatSemua: false, jumlahSemua: sidang.length, jumlahSaya: sidang.length, sidang },
      });
    }
    if (jalur.endsWith("/bas/periksa")) {
      return Response.json({ ok: true, data: { ok: true, berkas: "x", jumlahPenanda: 40, jumlahTerisi: 40, jumlahTersisa: 0, ringkasan: "siap", temuan: [] } });
    }
    if (jalur.endsWith("/bas/naskah")) {
      const id = new URL(url, ASAL).searchParams.get("perkaraId");
      return new Response(`{\\rtf1 perkara ${id}}`, {
        status: 200,
        headers: { "content-type": "application/rtf", "content-disposition": `attachment; filename="${id} - BAS 2.rtf"`, "x-aleta-tersisa": "" },
      });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  const unduhan: string[] = [];
  w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download) unduhan.push(this.download);
  };
  w.URL.createObjectURL = () => "blob:uji-bas";
  w.URL.revokeObjectURL = () => undefined;
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_BAS}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  return { w, minta, unduhan, wadah: w.document.getElementById("wadah") as HTMLElement };
}

type H = ReturnType<typeof buka>;
const siap = (h: H, mode = "baru") => sampai(() => h.w.__uji.mode() === mode, `mode ${mode}`);
const pasang = async (h: H, opsi: Record<string, unknown> = { situs: "sipp" }) => (await h.w.aletaBasMassalPasang(h.wadah, opsi)) as boolean;
const barisDom = (h: H) => Array.from(h.wadah.querySelectorAll(".aleta-basmassal-baris")) as HTMLElement[];
const barisNomor = (h: H, id: number) => h.wadah.querySelector(`.aleta-basmassal-baris[data-nomor="${id}/Pdt.G/2026/PA.Dgl"]`) as HTMLElement;
const tombol = (akar: ParentNode, pola: RegExp) =>
  (Array.from(akar.querySelectorAll("button")) as HTMLButtonElement[]).find((b) => pola.test(b.textContent || "") && !b.hidden)!;
const nonGet = (h: H) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");
const kemajuan = (h: H) => (Array.from(h.wadah.querySelectorAll(".aleta-basmassal-kabar")) as HTMLElement[]).map((e) => e.textContent || "").find((t) => /^(Selesai|Dihentikan|Mengerjakan)/.test(t)) || "";
const basDiminta = (h: H) =>
  h.minta
    .filter((m) => /\/bas\/(periksa|naskah)/.test(m.url))
    .map((m) => `${m.url.includes("/bas/periksa") ? "periksa" : "naskah"}:${new URL(m.url, ASAL).searchParams.get("perkaraId")}`);

async function kerjakanSemua(h: H) {
  tombol(h.wadah, /Centang semua/).click();
  tombol(h.wadah, /^Kerjakan/).click();
}

// ===========================================================================

describe("U2b BAS massal - daftar campuran", () => {
  it("tanda tiap baris benar; tanpa blangko / perkara_id kosong tidak dapat dicentang; 'Centang semua' melewatinya", async () => {
    const sidang = [
      baris(11, { basSipp: true }),
      baris(12, { basSipp: false, saksi: { pihak1: 2, pihak2: 0, nama1: ["Ani", "Budi"], nama2: [] }, lembar: { jumlah: 2, selesai: 2, draf: 0 } }),
      baris(13, { basSipp: null, blangko: { usulan: null, pilihan: [], sebab: 'Jenis perkara "Harta Bersama" belum punya set blangko BAS.' } }),
      baris(14, { perkaraId: "" }),
      baris(15, { blangko: { usulan: null, pilihan: PILIHAN, sebab: "Kehadiran sidang ini belum dicatat di SIPP - pilih blangkonya sendiri." } }),
    ];
    const h = buka({ sidang });
    await siap(h);
    expect(await pasang(h)).toBe(true);
    await sampai(() => barisDom(h).length === 5, "lima baris");
    const kabarAtas = h.wadah.querySelector(".aleta-basmassal-kabar") as HTMLElement;
    expect(kabarAtas.textContent).toBe("5 perkara bersidang · 3 BAS belum di SIPP · 3 blangko terusul");

    expect(barisNomor(h, 11).textContent).toContain("BAS sudah di SIPP");
    expect(barisNomor(h, 12).textContent).toContain("BAS belum di SIPP");
    expect(barisNomor(h, 12).textContent).toContain("saksi 2");
    expect(barisNomor(h, 12).textContent).toContain("lembar BAS 2/2 selesai");
    // basSipp null (bot lama) = tidak disebut sama sekali, bukan "belum".
    expect(barisNomor(h, 13).textContent).not.toMatch(/BAS (sudah|belum) di SIPP/);
    expect(barisNomor(h, 13).textContent).toContain("belum punya set blangko BAS");
    expect(barisNomor(h, 11).textContent).not.toMatch(/saksi \d|lembar BAS/);

    const centang = (id: number) => barisNomor(h, id).querySelector(".aleta-basmassal-centang") as HTMLInputElement;
    expect([11, 12, 13, 14, 15].map((id) => centang(id).disabled)).toEqual([false, false, true, true, true]);

    tombol(h.wadah, /Centang semua/).click();
    expect([11, 12, 13, 14, 15].map((id) => centang(id).checked)).toEqual([true, true, false, false, false]);
    expect(tombol(h.wadah, /^Kerjakan/).textContent).toBe("Kerjakan 2 yang dicentang");
    tombol(h.wadah, /^Kerjakan/).click();
    await sampai(() => /^Selesai/.test(kemajuan(h)), "selesai");
    expect(basDiminta(h)).toEqual(["periksa:11", "naskah:11", "periksa:12", "naskah:12"]);
    expect(h.unduhan).toEqual(["11 - BAS 2.rtf", "12 - BAS 2.rtf"]);
    expect(nonGet(h)).toEqual([]);
  });
});

describe("U2b BAS massal - satu perkara gagal di tengah, yang lain jalan terus", () => {
  it("periksa 503 (diulang sekali lalu gagal) dan naskah 502 bersebab: keduanya 'gagal', perkara sesudahnya tetap diunduh", async () => {
    const sidang = [baris(21), baris(22), baris(23), baris(24)];
    const h = buka({
      sidang,
      layan: (url) => {
        const id = new URL(url, ASAL).searchParams.get("perkaraId");
        if (url.includes("/bas/periksa") && id === "22") return new Response("Service Unavailable", { status: 503 });
        if (url.includes("/bas/naskah") && id === "23") {
          return Response.json({ ok: false, sebab: "Blangko tidak ditemukan di folder APS Badilag." }, { status: 502 });
        }
        return undefined;
      },
    });
    await siap(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 4, "empat baris");
    await kerjakanSemua(h);
    await sampai(() => /^Selesai/.test(kemajuan(h)), "selesai", 15000);
    expect(kemajuan(h)).toBe("Selesai: 2 diunduh · 2 gagal");
    // 22: periksa diminta DUA kali (alatAmbil mengulang 5xx bacaan sekali), naskah tidak.
    expect(basDiminta(h).filter((x) => x.endsWith(":22"))).toEqual(["periksa:22", "periksa:22"]);
    expect(barisNomor(h, 22).textContent).toMatch(/Pratinjau BAS gagal: server ALETA tidak terjangkau/);
    // 23: sebab dari server ditampilkan apa adanya.
    expect(barisNomor(h, 23).textContent).toContain("Tidak diunduh: Blangko tidak ditemukan di folder APS Badilag.");
    expect(h.unduhan).toEqual(["21 - BAS 2.rtf", "24 - BAS 2.rtf"]);
    expect(nonGet(h)).toEqual([]);
  }, 30000);

  it("batas waktu (AbortError) dan sesi ALETA habis (401) di tengah: sebabnya benar, perkara berikutnya tetap dikerjakan", async () => {
    const sidang = [baris(31), baris(32), baris(33)];
    const h = buka({
      sidang,
      layan: (url) => {
        const id = new URL(url, ASAL).searchParams.get("perkaraId");
        if (url.includes("/bas/periksa") && id === "31") throw new DOMException("The operation was aborted.", "AbortError");
        if (url.includes("/bas/naskah") && id === "32") return Response.json({ ok: false, error: { message: "Sesi berakhir" } }, { status: 401 });
        return undefined;
      },
    });
    await siap(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 3, "tiga baris");
    await kerjakanSemua(h);
    await sampai(() => /^Selesai/.test(kemajuan(h)), "selesai", 15000);
    expect(kemajuan(h)).toBe("Selesai: 1 diunduh · 2 gagal");
    expect(barisNomor(h, 31).textContent).toMatch(/Pratinjau BAS dihentikan karena ALETA tidak menjawab dalam 9 detik/);
    // Batas waktu TIDAK diulang (yang sudah menunggu 9 detik tidak ditolong dengan 9 detik lagi).
    expect(basDiminta(h).filter((x) => x === "periksa:31")).toHaveLength(1);
    expect(barisNomor(h, 32).textContent).toMatch(/Mengunduh BAS gagal: belum masuk portal ALETA di peramban ini/);
    expect(h.unduhan).toEqual(["33 - BAS 2.rtf"]);
  }, 30000);

  it("Hentikan di tengah pratinjau yang lambat: perkara yang sedang dikerjakan selesai, sisanya 'belum dikerjakan'", async () => {
    const sidang = [baris(41), baris(42), baris(43)];
    let lepas: (() => void) | null = null;
    const h = buka({
      sidang,
      layan: async (url) => {
        const id = new URL(url, ASAL).searchParams.get("perkaraId");
        if (url.includes("/bas/periksa") && id === "41") await new Promise<void>((r) => (lepas = r));
        return undefined;
      },
    });
    await siap(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 3, "tiga baris");
    await kerjakanSemua(h);
    await sampai(() => lepas, "periksa 41 menggantung");
    tombol(h.wadah, /^Hentikan$/).click();
    lepas!();
    await sampai(() => /^Dihentikan/.test(kemajuan(h)), "dihentikan");
    expect(kemajuan(h)).toBe("Dihentikan: 1 diunduh · 2 belum dikerjakan");
    expect(basDiminta(h)).toEqual(["periksa:41", "naskah:41"]);
    // Sesudah berhenti, putaran berikutnya dapat dimulai lagi.
    expect(tombol(h.wadah, /^Kerjakan/).disabled).toBe(false);
  });
});

describe("U2b BAS massal - tanggal tidak dapat berganti di tengah putaran", () => {
  it("selama 'Kerjakan' berjalan tanggal & saringan terkunci; sesudahnya terbuka lagi", async () => {
    let lepas: (() => void) | null = null;
    const h = buka({
      sidang: (tanggal) => (tanggal === "2026-10-08" ? [baris(91)] : [baris(51), baris(52)]),
      layan: async (url) => {
        const id = new URL(url, ASAL).searchParams.get("perkaraId");
        if (url.includes("/bas/periksa") && id === "51") await new Promise<void>((r) => (lepas = r));
        return undefined;
      },
    });
    await siap(h);
    await pasang(h);
    await sampai(() => barisDom(h).length === 2, "dua baris");
    const tanggal = h.wadah.querySelector(".aleta-basmassal-tanggal") as HTMLInputElement;
    const saring = h.wadah.querySelector(".aleta-basmassal-saring") as HTMLSelectElement;
    await kerjakanSemua(h);
    await sampai(() => lepas, "periksa 51 menggantung");
    // Petugas tidak dapat memilih tanggal lain selagi putaran berjalan: daftar
    // yang tampak tetap daftar tanggal yang tertulis.
    expect(tanggal.disabled).toBe(true);
    expect(saring.disabled).toBe(true);
    lepas!();
    await sampai(() => /^Selesai/.test(kemajuan(h)), "selesai");
    expect(tanggal.disabled).toBe(false);
    expect(saring.disabled).toBe(false);
    tanggal.value = "2026-10-08";
    tanggal.dispatchEvent(new h.w.Event("change"));
    await sampai(() => barisDom(h).length === 1 && barisNomor(h, 91), "daftar tanggal baru");
  });
});

describe("U2b BAS massal - server ALETA, bot, dan sesi", () => {
  it("portal mati (fetch melempar): kalimat 'server ALETA tidak terjangkau', tanpa baris", async () => {
    const h = buka({
      layan: (url) => {
        if (url.includes("/aleta-ecourt/bas-massal")) throw new TypeError("Failed to fetch");
        return undefined;
      },
    });
    await siap(h);
    expect(await pasang(h)).toBe(true);
    const salah = await sampai(() => h.wadah.querySelector(".aleta-basmassal-kabar-salah"), "kabar salah");
    expect(salah.textContent).toMatch(/^Membaca daftar sidang gagal: server ALETA tidak terjangkau/);
    expect(barisDom(h)).toHaveLength(0);
  });

  it("bot mati: 502 rute dengan alasannya ditampilkan apa adanya (bukan 'tidak ada sidang')", async () => {
    const h = buka({
      layan: (url) =>
        url.includes("/aleta-ecourt/bas-massal")
          ? Response.json({ ok: false, alasan: "ALETA Bot tidak menjawab (ECONNREFUSED)." }, { status: 502 })
          : undefined,
    });
    await siap(h);
    await pasang(h);
    const salah = await sampai(() => h.wadah.querySelector(".aleta-basmassal-kabar-salah"), "kabar salah");
    expect(salah.textContent).toBe("ALETA Bot tidak menjawab (ECONNREFUSED).");
  });

  it("sesi ALETA habis saat membaca daftar (401): pesan server tampil; akun tak terbaca saat dipasang = tidak digambar", async () => {
    const h = buka({
      layan: (url) =>
        url.includes("/aleta-ecourt/bas-massal") ? Response.json({ ok: false, error: { message: "Sesi tidak valid. Silakan masuk kembali." } }, { status: 401 }) : undefined,
    });
    await siap(h);
    await pasang(h);
    const salah = await sampai(() => h.wadah.querySelector(".aleta-basmassal-kabar-salah"), "kabar salah");
    expect(salah.textContent).toBe("Sesi tidak valid. Silakan masuk kembali.");

    const h2 = buka({ layan: (url) => (url.includes("/ekstensi/siapa") ? new Response("{}", { status: 401 }) : undefined) });
    await siap(h2);
    expect(await pasang(h2)).toBe(false);
    expect(h2.wadah.innerHTML).toBe("");
    expect(h2.minta.filter((m) => m.url.includes("/bas-massal"))).toEqual([]);
  });

  it("tidak ada sidang PP ini, tetapi ada milik PP lain: diarahkan ke 'Semua PP'", async () => {
    const h = buka({
      layan: (url) =>
        url.includes("/aleta-ecourt/bas-massal")
          ? Response.json({ ok: true, data: { tanggal: "2026-10-09", saringan: "saya", jumlahSemua: 4, jumlahSaya: 0, sidang: [] } })
          : undefined,
    });
    await siap(h);
    await pasang(h);
    await sampai(() => /Tidak ada sidang Anda/.test(h.wadah.textContent || ""), "kabar kosong");
    expect(h.wadah.textContent).toContain('(4 perkara bersidang dengan PP lain - pilih "Semua PP")');
    expect((h.wadah.querySelector(".aleta-basmassal-bawah") as HTMLElement).hidden).toBe(true);
  });
});

describe("U2b BAS massal - peran", () => {
  const tigaPp = () => [
    baris(61, { paniteraNama: "Munifa, S.H.", pengguna: { id: "munifa", nama: "Munifa, S.H." } }),
    baris(62, { paniteraNama: "Qadarsyah, S.H.", pengguna: { id: "qadar", nama: "Qadarsyah, S.H." } }),
    baris(63, { paniteraNama: "Munifa, S.H.", pengguna: { id: "munifa", nama: "Munifa, S.H." } }),
  ];

  it("admin UI Baru: per PP; 'Kerjakan semua milik Munifa' hanya mengerjakan perkara Munifa", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN, sidang: tigaPp(), saringan: "semua" });
    await siap(h, "ui");
    expect(await pasang(h)).toBe(true);
    await sampai(() => h.wadah.querySelectorAll(".aleta-massal-kelompok[data-pengguna]").length === 2, "dua kelompok PP");
    const kelompokMunifa = h.wadah.querySelector('.aleta-massal-kelompok[data-pengguna="munifa"]') as HTMLElement;
    const semuaMilik = kelompokMunifa.querySelector(".aleta-massal-kelompok-centang") as HTMLInputElement;
    semuaMilik.checked = true;
    semuaMilik.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const kerja = tombol(h.wadah, /^Kerjakan/);
    expect(kerja.textContent).toBe("Kerjakan 2 yang dicentang");
    kerja.click();
    await sampai(() => /^Selesai/.test(kemajuan(h)), "selesai");
    expect(basDiminta(h)).toEqual(["periksa:61", "naskah:61", "periksa:63", "naskah:63"]);
    expect(nonGet(h)).toEqual([]);
  });

  it("PP di UI Baru: daftar DATAR (tanpa kepala kelompok) walau memilih 'Semua PP'; nama PP di tiap baris", async () => {
    const h = buka({ mode: "ui", siapa: PP, sidang: tigaPp() });
    await siap(h, "ui");
    await pasang(h);
    await sampai(() => barisDom(h).length === 3, "tiga baris");
    const saring = h.wadah.querySelector(".aleta-basmassal-saring") as HTMLSelectElement;
    saring.value = "semua";
    saring.dispatchEvent(new h.w.Event("change"));
    await sampai(() => h.minta.some((m) => m.url.includes("saringan=semua")), "minta semua");
    await sampai(() => barisDom(h).length === 3 && /PP: Munifa/.test(h.wadah.textContent || ""), "baris semua PP");
    expect(h.wadah.querySelectorAll(".aleta-massal-kelompok[data-pengguna]")).toHaveLength(0);
  });

  it("hakim dan juru sita: tidak digambar, tidak membaca daftar", async () => {
    for (const peran of ["Hakim", "Jurusita"]) {
      const h = buka({ siapa: { nama: "X", peran, roleId: "", peranTambahan: [] } });
      await siap(h);
      expect(await pasang(h), peran).toBe(false);
      expect(h.minta.filter((m) => m.url.includes("/bas-massal"))).toEqual([]);
    }
  });
});
