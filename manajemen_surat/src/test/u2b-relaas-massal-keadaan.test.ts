// @vitest-environment node
/**
 * ============================================================================
 * UJI RILIS U2b - RELAAS & PBT MASSAL DALAM KEADAAN SULIT (9 OKT 2026)
 * ============================================================================
 *
 * Dua jalur:
 *
 *   A. jurusita.js (panel Relaas & PBT massal di daftar SIPP / beranda ABT)
 *      dijalankan SUNGGUHAN di jsdom bersama panel-alat.js. Pekerja latar
 *      ditiru di tepinya (chrome.runtime.sendMessage) dengan kegagalan yang
 *      SUNGGUH terjadi di MV3: pekerja mati selagi menjawab ("The message port
 *      closed before a response was received") dan pekerja yang tidak menjawab
 *      dalam batas waktu. Pemantau putaran tidak boleh berhenti diam-diam
 *      karena satu pertanyaan yang gagal - putarannya sendiri tetap berjalan.
 *
 *   B. latar.js SUNGGUHAN di node:vm (dunia-latar.ts): pekerja dibunuh di
 *      tengah putaran, lalu pekerja baru dibangunkan oleh pesan halaman -
 *      Hentikan, dua tab yang bertanya bersamaan, dan sesi ABT yang habis
 *      selagi pekerjanya mati. Tidak ada dokumen yang tercetak dua kali.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { ENAM, Dunia, abtPalsu, cetakUntuk, jalankan, minta, namaRelatif, nyalakan, pesanMulai } from "./dunia-latar";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_JURUSITA = process.env.ALETA_UJI_JURUSITA
  ? readFileSync(process.env.ALETA_UJI_JURUSITA, "utf8").replace(/\r\n/g, "\n")
  : baca("jurusita.js");

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
    await tunggu(20);
  }
}

// ===========================================================================
// A. PEMANTAU PUTARAN DI PANEL JURU SITA
// ===========================================================================

/** Jawaban relaas-keadaan berurutan: objek = dijawab, "putus" = pekerja mati selagi menjawab. */
type Langkah = Record<string, unknown> | "putus";

const JURUSITA = { nama: "Rahmat Hidayat", peran: "Jurusita", roleId: "jurusita", peranTambahan: [] };

function putaran(selesai: number, jumlah: number, akhir = false) {
  const butir = Array.from({ length: jumlah }, (_, i) => ({
    nomorPerkara: `${700 + i}/Pdt.G/2026/PA.Dgl`,
    label: "Panggilan Tergugat",
    keadaan: i < selesai ? "selesai" : "menunggu",
  }));
  return { ok: true, pekerjaan: { id: "relaas-uji", butir, selesai: akhir, dilewati: [] }, ringkas: { selesai } };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaPanel(urutan: Langkah[]) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="panel"><div id="wadah"></div></div></body></html>`, {
    url: `${ASAL}/SIPP/perkara`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  const pesan: any[] = [];
  let keKeadaan = 0;
  const runtime: any = {
    id: "aleta-uji",
    getManifest: () => ({ version: "1.188.0" }),
    getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
    lastError: undefined,
    sendMessage: (m: any, balik?: (x: unknown) => void) => {
      pesan.push(polos(m));
      let jawab: Langkah = { ok: true };
      if (m.jenis === "relaas-keadaan") {
        jawab = urutan[Math.min(keKeadaan, urutan.length - 1)];
        keKeadaan += 1;
      }
      setTimeout(() => {
        if (!balik) return;
        if (jawab === "putus") {
          // Seperti Chrome: lastError hanya terbaca DI DALAM panggilan balik.
          runtime.lastError = { message: "The message port closed before a response was received." };
          try {
            balik(undefined);
          } finally {
            runtime.lastError = undefined;
          }
          return;
        }
        balik(polos(jawab));
      }, 0);
    },
  };
  w.chrome = {
    runtime,
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
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    if (url.includes("/ekstensi/siapa")) return Response.json({ ok: true, data: JURUSITA });
    if (url.includes("/relaas-massal/cetak")) return Response.json({ ok: true, data: { ok: true, tanggal: "2026-10-09", dokumen: [] } });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_JURUSITA}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  return { w, pesan, wadah: w.document.getElementById("wadah") as HTMLElement, keadaanDitanya: () => keKeadaan };
}

const teksPutaran = (h: ReturnType<typeof bukaPanel>) => h.wadah.querySelector(".aleta-jurusita-putaran-teks")?.textContent || "";

describe("A. panel juru sita: pemantau putaran tahan pekerja latar yang mati", () => {
  it("pekerja mati selagi menjawab satu kali: pemantau bertanya lagi dan panel sampai 'Putaran selesai'", async () => {
    const h = bukaPanel([putaran(1, 3), "putus", putaran(2, 3), putaran(3, 3, true)]);
    await sampai(() => h.w.__uji.mode() === "baru", "mode baru");
    expect(await h.w.aletaJurusitaPasangMassal(h.wadah, { situs: "sipp" })).toBe(true);
    await sampai(() => teksPutaran(h) === "Mencetak: 1/3 selesai", "putaran tampil");
    // Dulu pemantau BERHENTI di sini selamanya: panel membeku di "Mencetak 1/3"
    // padahal putarannya terus berjalan di pekerja yang baru.
    await sampai(() => teksPutaran(h) === "Putaran selesai: 3/3 selesai", "putaran selesai tampil", 15000);
    expect(h.keadaanDitanya()).toBe(4);
  }, 30000);

  it("selama pertanyaan gagal, putaran yang tampil TIDAK dihapus dan sebabnya disebut; berhasil lagi = sebabnya hilang", async () => {
    const h = bukaPanel([putaran(1, 3), "putus", "putus", putaran(2, 3), putaran(3, 3, true)]);
    await sampai(() => h.w.__uji.mode() === "baru", "mode baru");
    await h.w.aletaJurusitaPasangMassal(h.wadah, { situs: "sipp" });
    const kabar = await sampai(
      () => h.wadah.querySelector(".aleta-jurusita-pantau-kabar:not([hidden])") as HTMLElement,
      "kabar pemantau",
      15000
    );
    expect(kabar.textContent).toMatch(/^Keadaan putaran belum terbaca dari ekstensi/);
    expect(kabar.textContent).toContain("message port closed");
    expect(teksPutaran(h)).toBe("Mencetak: 1/3 selesai");
    await sampai(() => teksPutaran(h) === "Putaran selesai: 3/3 selesai", "selesai", 20000);
    expect(h.wadah.querySelector(".aleta-jurusita-pantau-kabar")).toBeNull();
  }, 40000);

  it("tanpa putaran yang sedang tampil, pertanyaan yang gagal TIDAK diulang (halaman tanpa putaran tetap diam)", async () => {
    const h = bukaPanel(["putus", putaran(1, 3)]);
    await sampai(() => h.w.__uji.mode() === "baru", "mode baru");
    await h.w.aletaJurusitaPasangMassal(h.wadah, { situs: "sipp" });
    await sampai(() => h.keadaanDitanya() >= 1, "ditanya sekali");
    await tunggu(4500);
    expect(h.keadaanDitanya()).toBe(1);
    expect((h.wadah.querySelector(".aleta-jurusita-putaran") as HTMLElement).hidden).toBe(true);
  }, 20000);
});

// ===========================================================================
// B. MESIN PUTARAN latar.js - PEKERJA DIBUNUH, PESAN DATANG DARI HALAMAN
// ===========================================================================

describe("B. latar.js: pekerja mati di tengah putaran, lalu dibangunkan pesan halaman", () => {
  it("Hentikan yang membangunkan pekerja baru: dokumen sisanya TIDAK dicetak, neraca 'dihentikan', tanpa berkas ganda", async () => {
    let bunuh = true;
    const dunia = new Dunia(
      abtPalsu({
        bunuhSaat: (p) => {
          if (!p.alamat.includes("/abt/preview?")) return false;
          if (new URL(p.alamat).searchParams.get("c") === "102" && bunuh) {
            bunuh = false;
            return true;
          }
          return false;
        },
      })
    );
    const p1 = nyalakan(dunia);
    expect((await minta(dunia, p1, pesanMulai(ENAM))).ok).toBe(true);
    await jalankan(dunia, () => dunia.kematian === 1);

    // Juru sita menekan Hentikan; pesan itulah yang membangunkan pekerja baru.
    const p2 = nyalakan(dunia);
    const henti = await minta(dunia, p2, { jenis: "relaas-henti" });
    expect(henti.ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    // Beri kesempatan pewaktu yang tersisa - tidak boleh ada CETAK baru.
    const cetakSaatSelesai = dunia.permintaan.filter((x) => x.alamat.includes("/abt/preview?")).length;
    await jalankan(dunia, () => dunia.pewaktu.filter((t) => dunia.pekerjaHidup.has(t.pekerja)).length === 0).catch(() => undefined);

    const p = dunia.putaran();
    expect(p.dihentikan).toBe(true);
    expect(p.butir.find((b: any) => b.perkaraId === "101").keadaan).toBe("selesai");
    for (const id of ["103", "104", "105", "106"]) {
      expect(cetakUntuk(dunia, id), `CETAK ${id}`).toHaveLength(0);
      expect(p.butir.find((b: any) => b.perkaraId === id).keadaan).toBe("dilewati");
    }
    // 102 paling banyak dicetak SEKALI lagi (yang sedang dikerjakan saat Hentikan diterima).
    expect(cetakUntuk(dunia, "102").length).toBeLessThanOrEqual(2);
    expect(dunia.permintaan.filter((x) => x.alamat.includes("/abt/preview?")).length).toBe(cetakSaatSelesai);
    const nama = dunia.unduhan.map(namaRelatif);
    expect(new Set(nama).size).toBe(nama.length);
    expect(nama.filter((n) => / \(\d+\)\.rtf$/.test(n))).toEqual([]);
  });

  it("dua tab bertanya keadaan bersamaan pada pekerja baru: SATU putaran saja, tiap dokumen tepat satu RTF", async () => {
    let bunuh = true;
    const dunia = new Dunia(
      abtPalsu({
        bunuhSaat: (p) => {
          if (!p.alamat.includes("/abt/preview?")) return false;
          if (new URL(p.alamat).searchParams.get("c") === "103" && bunuh) {
            bunuh = false;
            return true;
          }
          return false;
        },
      })
    );
    const p1 = nyalakan(dunia);
    expect((await minta(dunia, p1, pesanMulai(ENAM))).ok).toBe(true);
    await jalankan(dunia, () => dunia.kematian === 1);

    const p2 = nyalakan(dunia);
    const tabA = p2.kirim({ sumber: "aleta-panel", jenis: "relaas-keadaan" });
    const tabB = p2.kirim({ sumber: "aleta-panel", jenis: "relaas-keadaan" });
    await jalankan(dunia, () => tabA.selesai() && tabB.selesai());
    expect(tabA.nilai().ok && tabB.nilai().ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));

    const p = dunia.putaran();
    expect(p.butir.map((b: any) => b.keadaan)).toEqual(Array(6).fill("selesai"));
    for (const d of ENAM) {
      const berkas = dunia.unduhan.map(namaRelatif).filter((n) => n.includes(`/${d.perkaraId}-Pdt`));
      expect(berkas, d.perkaraId).toHaveLength(1);
      expect(cetakUntuk(dunia, d.perkaraId).length, `CETAK ${d.perkaraId}`).toBe(d.perkaraId === "103" ? 2 : 1);
    }
    // Pemulihan dijalankan SEKALI, bukan sekali per tab.
    expect(p.pemulihan).toBe(1);
  });

  it("sesi ABT habis -> tertahan; pekerja mati selagi tertahan; sesudah masuk ABT, Lanjutkan dari pekerja baru menuntaskan tanpa ganda", async () => {
    let masuk = true;
    const dunia = new Dunia(abtPalsu({ masuk: () => masuk }));
    // Sesi habis tepat sebelum dokumen ke-3 dibuka.
    const asli = dunia.pelayan;
    dunia.pelayan = (p) => {
      if (p.metode === "POST" && p.alamat.includes("/main/cari") && new URLSearchParams(p.badan).get("c") === "103") masuk = false;
      return asli(p);
    };
    const p1 = nyalakan(dunia);
    expect((await minta(dunia, p1, pesanMulai(ENAM))).ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.tertahan));
    expect(dunia.putaran().tertahan.perluMasuk).toBe("abt");
    expect(dunia.putaran().butir.filter((b: any) => b.keadaan === "selesai")).toHaveLength(2);

    // Chrome mematikan pekerja yang menganggur selagi petugas masuk ke ABT.
    p1.matikan();
    masuk = true;
    dunia.pelayan = asli;
    const p2 = nyalakan(dunia);
    // Pekerja baru TIDAK melanjutkan sendiri putaran yang tertahan.
    await jalankan(dunia, () => true);
    expect(dunia.putaran().tertahan).toBeTruthy();
    const lanjut = await minta(dunia, p2, { jenis: "relaas-lanjut" });
    expect(lanjut.ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));

    const p = dunia.putaran();
    expect(p.butir.map((b: any) => b.keadaan)).toEqual(Array(6).fill("selesai"));
    // Percobaan dokumen yang tertahan tidak dihitung - sesi habis bukan kesalahan dokumennya.
    expect(p.butir.find((b: any) => b.perkaraId === "103").percobaan).toBe(1);
    const nama = dunia.unduhan.map(namaRelatif);
    expect(nama).toHaveLength(6);
    expect(new Set(nama).size).toBe(6);
  });

  it("ekstensi diperbarui saat putaran TERTAHAN: tetap ditahan (storage.session akan dikosongkan)", async () => {
    let masuk = true;
    const dunia = new Dunia(abtPalsu({ masuk: () => masuk }));
    const asli = dunia.pelayan;
    dunia.pelayan = (p) => {
      if (p.metode === "POST" && p.alamat.includes("/main/cari") && new URLSearchParams(p.badan).get("c") === "102") masuk = false;
      return asli(p);
    };
    const p1 = nyalakan(dunia);
    await minta(dunia, p1, pesanMulai(ENAM));
    await jalankan(dunia, () => Boolean(dunia.putaran()?.tertahan));
    dunia.pembaruan = { status: "update_available", version: "1.189.0" };
    const j = await minta(dunia, p1, { jenis: "perbarui" });
    expect(j.ok).toBe(false);
    expect(j.keadaan).toBe("putaran-relaas-berjalan");
    expect(j.pesan).toMatch(/sedang tertahan: 1 dari 6 dokumen selesai, 5 belum\./);
    const mu = await minta(dunia, p1, { jenis: "muat-ulang" });
    expect(mu.keadaan).toBe("putaran-relaas-berjalan");
    expect(dunia.dimuatUlang).toBe(0);
  });
});
