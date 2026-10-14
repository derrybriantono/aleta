// @vitest-environment node
/**
 * ============================================================================
 * MASSAL PER USER - PERBAIKAN 1 OKT 2026 (AGEN M, KONTRAK K4)
 * ============================================================================
 *
 * Semuanya DIJALANKAN atas basmassal.js yang sungguhan - bukan menyisir teks:
 *
 *   A. aletaMassalPutusanLayak / aletaMassalAlasanPutusan (murni, vm Node
 *      TANPA panel-alat.js - fungsi ini harus berdiri sendiri bagi A dan S).
 *      Kalimat ujinya diambil dari kolom alasan_ditunda / agenda / keterangan
 *      perkara_jadwal_sidang sipp_donggala apa adanya (termasuk salah ketik).
 *
 *      DIUKUR atas 16.076 baris jadwal sipp_donggala 2018 s.d. 30 Sep 2026
 *      (SELECT saja; skrip D:/aleta-dev/kerja/perbaikan-1okt/m-ukur/ukur.js):
 *        ruas bot (alasan, agenda, ditunda, tanggal putusan):
 *          layak 8.362 - 8.300 tepat (99,3%): putus hari itu atau putus pada
 *          sidang berikutnya; putus-hari-itu tertangkap 7.745/7.745 (100%).
 *          "tunda-putusan" 592, tepat 554 (93,6%) - sisanya ditunda lagi
 *          sebelum dibacakan.
 *        tanpa tanggal putusan (teks saja): putus-hari-itu 5.889/7.745 (76%),
 *          sebab 1.856 baris lama alasannya "0" dan keterangannya kosong.
 *        pagi hari (agenda saja, hasil belum dicatat): 1.065 layak, 98,4%
 *          tepat.
 *      Yang tidak ikut (benar): 1.529 "panggil tergugat", 641 "tergugat tidak
 *      hadir" dst. - perkara itu baru diputus verstek pada sidang berikutnya.
 *
 *   B. aletaMassalKelompokkan - per user, gelar disatukan, kunci sama dengan
 *      penggunaKunci di rute bas-massal (susun.ts).
 *   C. aletaMassalGambarKelompok di jsdom bersama panel-alat.js - per user
 *      HANYA UI Baru + golongan admin; selain itu datar.
 *   D. Panel BAS massal: admin UI Baru per PP; Baru tetap 1.176.0; PP tetap
 *      miliknya; Lama tidak menggambar; tidak ada permintaan non-GET.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { penggunaKunci } from "@/app/api/aleta-ecourt/bas-massal/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_BASMASSAL hanya untuk pembukti gigitan: cacat dipasang pada SALINAN.
const SUMBER_BAS = process.env.ALETA_UJI_BASMASSAL
  ? readFileSync(process.env.ALETA_UJI_BASMASSAL, "utf8").replace(/\r\n/g, "\n")
  : baca("basmassal.js");

type Alasan = { layak: boolean; jenis: string; sebab: string };
type Murni = {
  aletaMassalPutusanLayak: (p: unknown) => boolean;
  aletaMassalAlasanPutusan: (p: unknown) => Alasan;
  aletaMassalKelompokkan: (d: unknown[], k: unknown) => Array<{ pengguna: { id: string; nama: string }; perkara: any[] }>;
};

function muatMurni(): Murni {
  const ctx: Record<string, unknown> = { console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SUMBER_BAS, ctx);
  return ctx as unknown as Murni;
}
const M = muatMurni();
const nilai = (p: Record<string, unknown>) => M.aletaMassalAlasanPutusan(p);

// ============================================================================
// A. DETEKSI PUTUSAN MASSAL (BUTIR 13)
// ============================================================================
describe("A. aletaMassalPutusanLayak - putus atau ditunda untuk putusan / musyawarah", () => {
  it("berdiri sendiri: tanpa panel-alat.js, keempat fungsi K4 ada di globalThis", () => {
    for (const f of ["aletaMassalPutusanLayak", "aletaMassalAlasanPutusan", "aletaMassalKelompokkan", "aletaMassalGambarKelompok"]) {
      expect(typeof (M as unknown as Record<string, unknown>)[f], f).toBe("function");
    }
  });

  it("hasil sidang PUTUS (ditunda T) - kalimat SIPP sungguhan", () => {
    for (const alasan of ["putus DIKABULKAN (verstek)", "Putus", "putus dicabut", "Dikabulkan", "Putus Verstek", "Panggil Tergugat\nputus verstek"]) {
      expect(nilai({ ditunda: false, alasanDitunda: alasan }), alasan).toMatchObject({ layak: true, jenis: "putus" });
    }
    // "putus" sebagai kata menang walau benderanya Y (10 baris di data).
    expect(nilai({ ditunda: "Y", alasanDitunda: "putus dikabulkan (verstek)" }).jenis).toBe("putus");
    // Keterangan jadwal: "cabut", "gugur", "dicoret dari register".
    for (const ket of ["cabut", "gugur", "dicoret dari register", "putus kabul"]) {
      expect(nilai({ ditunda: "T", alasanDitunda: "0", keterangan: ket }), ket).toMatchObject({ layak: true, jenis: "putus" });
    }
  });

  it("DITUNDA UNTUK musyawarah majelis / pembacaan putusan / penetapan - termasuk salah ketik di data", () => {
    const kalimat = [
      "Musyawarah Majelis",
      "musyawarah majelis hakim (MMH)",
      "Musyawarah Majelis dan Pembacaan Putusan",
      "musywarah majelis dan pembacaan putusan",
      "musaywarah majelis dan pembacaan putusan",
      "musyawarh majelis",
      "musy. majelis",
      "untuk musyawarah",
      "Pembacaan Putusan",
      "pembacan putusan",
      "musyawarah majelis dan pembacaan oputusan",
      "Pembacaan Putusan secara elektronik",
      "Penyampaian Putusan",
      "Baca Putusan",
      "Pembacaan Penetapan",
      "menunggu putusan untuk hakim tunggal",
    ];
    for (const k of kalimat) expect(nilai({ ditunda: "Y", alasanDitunda: k }), k).toMatchObject({ layak: true, jenis: "tunda-putusan" });
    expect(nilai({ ditunda: true, alasanDitunda: "Musyawarah Majelis" }).sebab).toBe("Ditunda untuk: Musyawarah Majelis");
  });

  it("BUKAN: putusan sela, isi/pembebanan putusan, salinan penetapan, penetapan hari sidang, musyawarah keluarga, tunda alasan lain", () => {
    const bukan = [
      "Pembacaan Putusan Sela",
      "putusan sela",
      "untuk membaca putusan sela",
      "pemohon belum menyerahkan pembebanan putusan",
      "beri kesempatan kepada pemohon selama 6 bulan untuk pengucapan ikrar talak dan membayar pembabanan sesuai isi putusan",
      "Penyampaian Salinan Penetapan",
      "Penetapan Kembali Hari Sidang",
      "mendengar hasil musyawarah dari keluarga pemohon dan termohon",
      "Panggil Tergugat",
      "tergugat tidak hadir",
      "Pembuktian lanjutan",
      "Pembacaan Gugatan",
      "Pembacaan hasil mediasi",
      "telah ikrar talak",
      "0",
      "",
    ];
    for (const k of bukan) expect(nilai({ ditunda: "Y", alasanDitunda: k }).layak, k).toBe(false);
    expect(nilai({ ditunda: "T", alasanDitunda: "telah ikrar talak", agenda: "Sidang Ikrar Talak" }).layak).toBe(false);
  });

  it("agenda hari itu hanya berlaku selama hasil BELUM dicatat - hasil lain mengalahkan agenda", () => {
    expect(nilai({ ditunda: false, alasanDitunda: "", agenda: "Musyawarah Majelis" })).toMatchObject({ layak: true, jenis: "agenda-putusan" });
    expect(nilai({ ditunda: "T", alasanDitunda: "0", agenda: "Sidang Pertama,putus" })).toMatchObject({ layak: true, jenis: "agenda-putusan" });
    expect(nilai({ ditunda: "T", alasanDitunda: "0", agenda: "Pemeriksaan, kesimpulan, pembacaan penetapan" }).layak).toBe(true);
    expect(nilai({ ditunda: true, alasanDitunda: "Panggil Tergugat", agenda: "Pembacaan Putusan" }).layak).toBe(false);
    expect(nilai({ ditunda: false, alasanDitunda: "", agenda: "Sidang Pertama" }).layak).toBe(false);
    expect(nilai({ ditunda: false, alasanDitunda: "", agenda: "Penetapan Kembali Hari Sidang" }).layak).toBe(false);
  });

  it("tanggal putusan SIPP = tanggal sidang -> putus; putus lebih dulu (sidang ikrar sesudahnya) -> tidak", () => {
    expect(nilai({ sudahPutus: true, tanggalPutusan: "2026-09-30", tanggalSidang: "2026-09-30", alasanDitunda: "0", agenda: "Sidang Pertama" })).toMatchObject({
      layak: true,
      jenis: "putus",
    });
    expect(nilai({ sudahPutus: true, tanggalPutusan: "2026-08-01", tanggalSidang: "2026-09-30", agenda: "Sidang Ikrar Talak", ikrar: true }).layak).toBe(false);
    // Bentuk lain nama ruas: alasan_ditunda / tanggal.
    expect(M.aletaMassalPutusanLayak({ alasan_ditunda: "Musyawarah Majelis", ditunda: "Y" })).toBe(true);
    expect(M.aletaMassalPutusanLayak({ sudahPutus: true, tanggalPutusan: "2026-09-30", tanggal: "2026-09-30" })).toBe(true);
  });

  it("bentuk alatSidangPadaTanggal (tanpa alasanDitunda) tetap dinilai dari agenda; masukan rusak = false tanpa lempar", () => {
    expect(M.aletaMassalPutusanLayak({ nomor: "1/Pdt.G/2026/PA.Dgl", agenda: "Pembacaan Putusan", sudahPutus: false, ditunda: false })).toBe(true);
    expect(M.aletaMassalPutusanLayak({ nomor: "2/Pdt.G/2026/PA.Dgl", agenda: "Pembuktian", sudahPutus: false, ditunda: false })).toBe(false);
    for (const rusak of [null, undefined, 7, "putus", [], { agenda: { x: 1 } }]) expect(M.aletaMassalPutusanLayak(rusak)).toBe(false);
  });
});

// ============================================================================
// B. PENGELOMPOKAN PER USER
// ============================================================================
describe("B. aletaMassalKelompokkan", () => {
  it("ruas objek {id,nama}, nama ruas teks, dan fungsi - urut abjad, tanpa nama paling akhir, urutan perkara tetap", () => {
    const daftar = [
      { nomor: "1", pengguna: { id: "budi", nama: "Budi" } },
      { nomor: "2", pengguna: { id: "", nama: "" } },
      { nomor: "3", pengguna: { id: "ani", nama: "Ani" } },
      { nomor: "4", pengguna: { id: "budi", nama: "Budi" } },
    ];
    const k = M.aletaMassalKelompokkan(daftar, "pengguna");
    expect(k.map((x) => x.pengguna.nama)).toEqual(["Ani", "Budi", ""]);
    expect(k[1].perkara.map((p) => p.nomor)).toEqual(["1", "4"]);
    const lewatFungsi = M.aletaMassalKelompokkan(daftar, (p: { pengguna: { nama: string } }) => p.pengguna.nama);
    expect(lewatFungsi.map((x) => x.perkara.length)).toEqual([1, 2, 1]);
    expect(M.aletaMassalKelompokkan(null as unknown as unknown[], "x")).toEqual([]);
  });

  it("gelar disatukan: 'Siti Aminah, S.H.' dan 'Siti Aminah' satu kelompok, judulnya nama terlengkap", () => {
    const k = M.aletaMassalKelompokkan(
      [
        { nomor: "1", hakimNama: "Siti Aminah" },
        { nomor: "2", hakimNama: "Siti Aminah, S.H." },
        { nomor: "3", hakimNama: "Drs. H. Muhammad Syukri, M.H." },
      ],
      "hakimNama"
    );
    expect(k).toHaveLength(2);
    expect(k.find((x) => x.pengguna.id === "siti aminah")!.pengguna.nama).toBe("Siti Aminah, S.H.");
    expect(k.find((x) => x.pengguna.id === "muhammad syukri")).toBeTruthy();
  });

  it("kunci ekstensi SAMA dengan penggunaKunci rute bas-massal (susun.ts)", () => {
    for (const nama of ["Siti Aminah, S.H.", "Drs. H. Muhammad Syukri, M.H.", "Hj. Tanty Restianty", "Unun Fidjayanti Patangai, S.H.", "Ir. Prof. Abc", "", "Qadarsyah, S.H."]) {
      expect(M.aletaMassalKelompokkan([{ n: nama }], "n")[0].pengguna.id, nama).toBe(penggunaKunci(nama));
    }
  });
});

// ============================================================================
// JSDOM - panel-alat.js + basmassal.js sebagai satu skrip konten
// ============================================================================
const ASAL = "http://192.168.10.10";
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

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Pilihan = { mode?: "lama" | "baru" | "ui"; siapa?: Record<string, unknown>; sidang?: unknown[]; tanpaAlat?: boolean };

function buka(p: Pilihan = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="wadah"></div></body></html>`, {
    url: `${ASAL}/SIPP/list_perkara`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.mode ?? "ui" };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.176.0" }), getURL: (x: string) => x, lastError: undefined,
      // 14 Okt: unduhan diterbitkan pekerja latar (pesan "unduh").
      sendMessage: (m: { jenis?: string; nama?: string }, balik?: (x: unknown) => void) => {
        if (!m || m.jenis !== "unduh") return undefined;
        unduhan.push(String(m.nama));
        if (balik) setTimeout(() => balik({ ok: true }), 0);
        return undefined;
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
    if (url.includes("/ekstensi/siapa")) return Response.json({ ok: true, data: p.siapa ?? ADMIN });
    if (url.includes("/aleta-ecourt/bas-massal")) {
      const q = new URL(url, ASAL).searchParams;
      const admin = /admin/i.test(String((p.siapa ?? ADMIN).peran));
      const saringan = q.get("saringan") || (admin ? "semua" : "saya");
      return Response.json({
        ok: true,
        data: { tanggal: q.get("tanggal"), saringan, lihatSemua: admin, kelompokPerUser: admin && saringan === "semua", sidang: p.sidang ?? SIDANG },
      });
    }
    if (url.includes("/bas/periksa")) return Response.json({ ok: true, data: { ok: true, jumlahPenanda: 10, jumlahTerisi: 10, jumlahTersisa: 0, ringkasan: "siap", temuan: [] } });
    if (url.includes("/bas/naskah")) return new Response("{\\rtf1}", { status: 200, headers: { "content-disposition": 'attachment; filename="bas.rtf"' } });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  const unduhan: string[] = [];
  w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    unduhan.push(this.download);
  };
  w.URL.createObjectURL = () => "blob:uji";
  w.URL.revokeObjectURL = () => undefined;
  if (p.tanpaAlat) {
    // basmassal.js sendirian (tanpa alatLipat milik W): gerbang dipalsukan di window.
    w.alatUjiMode = () => p.mode ?? "ui";
    w.alatGolonganPeran = (x: string) => (/admin/i.test(String(x)) ? "admin" : "lain");
    w.eval(`${SUMBER_BAS}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  } else {
    w.eval(`${SUMBER_ALAT}\n;\n${SUMBER_BAS}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`);
  }
  return { dom, w, minta, unduhan, simpanan, wadah: w.document.getElementById("wadah") as HTMLElement };
}
type H = ReturnType<typeof buka>;
const siap = (h: H, mode: string) => sampai(() => h.w.__uji.mode() === mode, `mode ${mode}`);
const nonGet = (h: H) => h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");

const ADMIN = { nama: "Administrator", peran: "Admin", roleId: "admin", peranTambahan: [] };
const PP = { nama: "Siti Aminah", peran: "Panitera Pengganti", roleId: "panitera-pengganti", peranTambahan: [] };

// ============================================================================
// C. GAMBAR KELOMPOK (dipakai A dan S)
// ============================================================================
const PERKARA = [
  { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", hakim: "Tanty Restianty" },
  { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", hakim: "Muslimin" },
  { nomorPerkara: "3/Pdt.G/2026/PA.Dgl", hakim: "Tanty Restianty, S.H.I." },
  { nomorPerkara: "4/Pdt.G/2026/PA.Dgl", hakim: "Tanty Restianty", mati: true },
];

function gambar(h: H, peran: string, onCentang?: (x: unknown) => void) {
  const kel = h.w.aletaMassalKelompokkan(PERKARA, "hakim");
  return h.w.aletaMassalGambarKelompok(h.wadah, kel, {
    peran,
    kunciLipat: "putusan-massal-uji",
    onCentang,
    gambarBaris: (p: { nomorPerkara: string; mati?: boolean }, isi: HTMLElement) => {
      const l = h.w.document.createElement("label");
      l.className = "baris-uji";
      const c = h.w.document.createElement("input");
      c.type = "checkbox";
      c.disabled = Boolean(p.mati);
      l.append(c, p.nomorPerkara);
      isi.appendChild(l);
      return c;
    },
  });
}

describe("C. aletaMassalGambarKelompok", () => {
  it("UI Baru + Admin: per hakim, berlipat (alatLipat W), centang kelompok menyalakan yang aktif saja, tidak ada yang tercentang sendiri", async () => {
    const h = buka({ mode: "ui" });
    await siap(h, "ui");
    const kabar: Array<{ pengguna: { nama: string }; perkara: unknown[]; dicentang: boolean }> = [];
    const k = gambar(h, "Super Admin", (x) => kabar.push(x as (typeof kabar)[number]));
    expect(k.perUser).toBe(true);
    const kelompok = Array.from(h.wadah.querySelectorAll(".aleta-massal-kelompok")) as HTMLElement[];
    expect(kelompok).toHaveLength(2);
    // Bentuk lipat seragam K2.
    expect(kelompok.every((x) => x.classList.contains("aleta-lipatan"))).toBe(true);
    expect(kelompok[1].querySelector(".aleta-lipat-kepala")!.textContent).toContain("Tanty Restianty, S.H.I. · 3 perkara");
    expect(k.dicentang()).toEqual([]);
    const tanty = k.kelompok[1];
    expect(tanty.centangKelompok.parentElement.textContent).toContain("Kerjakan semua milik Tanty Restianty, S.H.I.");
    tanty.centangKelompok.checked = true;
    tanty.centangKelompok.dispatchEvent(new h.w.Event("change"));
    expect(k.dicentang().map((p: { nomorPerkara: string }) => p.nomorPerkara)).toEqual(["1/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"]);
    expect(tanty.centang[2].checked).toBe(false); // yang mati tidak ikut
    expect(kabar).toHaveLength(1);
    expect(kabar[0].perkara).toHaveLength(2);
    expect(kelompok[1].querySelector(".aleta-lipat-ringkas")!.textContent).toBe("2 dicentang");
    // Setengah: satu dimatikan dari baris.
    tanty.centang[0].checked = false;
    tanty.centang[0].dispatchEvent(new h.w.Event("change"));
    expect(tanty.centangKelompok.indeterminate).toBe(true);
    expect(tanty.centangKelompok.checked).toBe(false);
    expect(kabar).toHaveLength(2);
  });

  it("peran BUKAN admin (Hakim, Ketua, PP) di UI Baru: DATAR, tanpa kepala kelompok", async () => {
    for (const peran of ["Hakim", "Ketua", "Panitera Pengganti", ""]) {
      const h = buka({ mode: "ui" });
      await siap(h, "ui");
      const k = gambar(h, peran);
      expect(k.perUser, peran).toBe(false);
      expect(h.wadah.querySelectorAll(".aleta-massal-kelompok").length, peran).toBe(0);
      expect(h.wadah.querySelectorAll(".baris-uji").length, peran).toBe(4);
    }
  });

  it("tampilan Baru, Admin: DATAR (perubahan hanya UI Baru, K1)", async () => {
    const h = buka({ mode: "baru" });
    await siap(h, "baru");
    const k = gambar(h, "Admin");
    expect(k.perUser).toBe(false);
    expect(h.wadah.querySelectorAll(".aleta-massal-kelompok").length).toBe(0);
  });

  it("alatLipat belum ada: cadangan <details> dengan kelas yang sama", async () => {
    const h = buka({ mode: "ui", tanpaAlat: true });
    await siap(h, "ui");
    expect(typeof h.w.alatLipat).toBe("undefined");
    gambar(h, "Admin");
    const d = Array.from(h.wadah.querySelectorAll("details.aleta-massal-kelompok")) as HTMLDetailsElement[];
    expect(d).toHaveLength(2);
    expect(d.every((x) => x.open)).toBe(true);
  });
});

// ============================================================================
// D. PANEL BAS MASSAL
// ============================================================================
const baris = (nomor: string, id: string, pp: string) => {
  const pilihan = [{ folder: "f", berkas: "[02] BAS 2.rtf", setId: "bas-verstek", setNama: "BAS Verstek", basKe: 2, label: "BAS 2", kehadiran: "cocok" }];
  return {
    sidangId: id,
    perkaraId: id,
    nomorPerkara: nomor,
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: "2026-10-01",
    jamSidang: "09:00",
    agenda: "Pembuktian",
    urutanSidang: 2,
    dihadiriOleh: 2,
    kehadiran: "hanya pihak pertama hadir",
    basSipp: false,
    paniteraNama: pp,
    pengguna: { id: penggunaKunci(pp), nama: pp },
    saksi: { pihak1: 0, pihak2: 0, nama1: [], nama2: [] },
    lembar: null,
    blangko: { usulan: pilihan[0], pilihan, sebab: "" },
  };
};
const SIDANG = [
  baris("498/Pdt.G/2026/PA.Dgl", "498", "Unun Fidjayanti Patangai, S.H."),
  baris("575/Pdt.G/2026/PA.Dgl", "575", "Munifa, S.H."),
  baris("586/Pdt.G/2026/PA.Dgl", "586", "Qadarsyah, S.H."),
  baris("587/Pdt.G/2026/PA.Dgl", "587", "Qadarsyah, S.H."),
];
const barisDom = (h: H) => Array.from(h.wadah.querySelectorAll(".aleta-basmassal-baris")) as HTMLElement[];
const tombol = (akar: ParentNode, pola: RegExp) =>
  (Array.from(akar.querySelectorAll("button")) as HTMLButtonElement[]).find((b) => pola.test(b.textContent || "") && !b.hidden)!;

describe("D. BAS massal (butir 14, 1, 16)", () => {
  it("Admin di UI Baru: dikelompokkan per PP, 'Kerjakan semua milik Qadarsyah' -> hanya dua perkaranya yang dikerjakan, semua GET", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN });
    await siap(h, "ui");
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "abt" })).toBe(true);
    await sampai(() => barisDom(h).length === 4, "empat baris");
    const kelompok = Array.from(h.wadah.querySelectorAll(".aleta-massal-kelompok")) as HTMLElement[];
    expect(kelompok.map((k) => k.querySelector(".aleta-lipat-judul")!.textContent)).toEqual([
      "PP: Munifa, S.H. · 1 perkara",
      "PP: Qadarsyah, S.H. · 2 perkara",
      "PP: Unun Fidjayanti Patangai, S.H. · 1 perkara",
    ]);
    // Nama PP di kepala kelompok - tidak diulang di tiap baris.
    expect(h.wadah.textContent).not.toMatch(/PP: Qadarsyah, S\.H\.(?! ·)/);
    expect(barisDom(h).every((b) => !(b.querySelector(".aleta-basmassal-centang") as HTMLInputElement).checked)).toBe(true);
    const c = kelompok[1].querySelector(".aleta-massal-kelompok-centang") as HTMLInputElement;
    c.checked = true;
    c.dispatchEvent(new h.w.Event("change"));
    const kerja = tombol(h.wadah, /^Kerjakan/);
    expect(kerja.textContent).toBe("Kerjakan 2 yang dicentang");
    kerja.click();
    await sampai(() => /Selesai: 2 diunduh/.test(h.wadah.textContent || ""), "selesai");
    const dikerjakan = h.minta.filter((m) => m.url.includes("/bas/naskah")).map((m) => new URL(m.url, ASAL).searchParams.get("perkaraId"));
    expect(dikerjakan).toEqual(["586", "587"]);
    expect(nonGet(h)).toEqual([]);
    // "Centang semua yang berblangko" ikut menyalakan centang kelompok.
    tombol(h.wadah, /Centang semua/).click();
    expect((Array.from(h.wadah.querySelectorAll(".aleta-massal-kelompok-centang")) as HTMLInputElement[]).every((x) => x.checked)).toBe(true);
  });

  it("tampilan Baru, Admin: DATAR seperti 1.176.0 - tanda 'PP:' per baris, tanpa kelompok", async () => {
    const h = buka({ mode: "baru", siapa: ADMIN });
    await siap(h, "baru");
    await h.w.aletaBasMassalPasang(h.wadah, { situs: "abt" });
    await sampai(() => barisDom(h).length === 4, "empat baris");
    expect(h.wadah.querySelectorAll(".aleta-massal-kelompok").length).toBe(0);
    expect(barisDom(h)[0].textContent).toContain("PP: Unun Fidjayanti Patangai, S.H.");
  });

  it("PP di UI Baru: miliknya saja (bawaan 'saya'), datar; admin yang berganti peran ke PP juga datar", async () => {
    const h = buka({ mode: "ui", siapa: PP, sidang: [SIDANG[0]] });
    await siap(h, "ui");
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "sipp" })).toBe(true);
    await sampai(() => barisDom(h).length === 1, "satu baris");
    expect(h.wadah.querySelectorAll(".aleta-massal-kelompok").length).toBe(0);
    expect((h.wadah.querySelector(".aleta-basmassal-saring") as HTMLSelectElement).value).toBe("saya");
    const h2 = buka({ mode: "ui", siapa: ADMIN });
    await siap(h2, "ui");
    expect(await h2.w.aletaBasMassalPasang(h2.wadah, { situs: "sipp", peran: "Panitera Pengganti" })).toBe(true);
    await sampai(() => barisDom(h2).length === 4, "empat baris");
    expect(h2.wadah.querySelectorAll(".aleta-massal-kelompok").length).toBe(0);
  });

  it("Admin memilih 'PP: saya' di UI Baru: datar", async () => {
    const h = buka({ mode: "ui", siapa: ADMIN });
    await siap(h, "ui");
    await h.w.aletaBasMassalPasang(h.wadah, { situs: "sipp" });
    await sampai(() => h.wadah.querySelectorAll(".aleta-massal-kelompok").length === 3, "kelompok");
    const saring = h.wadah.querySelector(".aleta-basmassal-saring") as HTMLSelectElement;
    saring.value = "saya";
    saring.dispatchEvent(new h.w.Event("change"));
    await sampai(() => barisDom(h).length === 4 && h.wadah.querySelectorAll(".aleta-massal-kelompok").length === 0, "datar");
  });

  it("tampilan Lama: tidak menggambar apa pun, tidak meminta apa pun", async () => {
    const h = buka({ mode: "lama", siapa: ADMIN });
    await tunggu(30);
    const sebelum = h.minta.length;
    expect(await h.w.aletaBasMassalPasang(h.wadah, { situs: "abt" })).toBe(false);
    expect(h.wadah.innerHTML).toBe("");
    expect(h.minta.slice(sebelum).filter((m) => /siapa|bas-massal|bas\//.test(m.url))).toEqual([]);
  });

  it("butir 1: rincian 'Yang perlu dilengkapi' memakai lipat seragam di UI Baru, tidak di Baru", async () => {
    for (const mode of ["ui", "baru"] as const) {
      const h = buka({ mode, siapa: PP, sidang: [SIDANG[0]] });
      // Pratinjau dengan temuan.
      const asli = h.w.fetch;
      h.w.fetch = async (u: string, o?: { method?: string }) =>
        String(u).includes("/bas/periksa")
          ? Response.json({ ok: true, data: { ok: true, jumlahPenanda: 10, jumlahTerisi: 8, jumlahTersisa: 2, ringkasan: "", temuan: [{ tingkat: "catatan", hal: "Saksi", tindakan: "isi" }] } })
          : asli(u, o);
      await siap(h, mode);
      await h.w.aletaBasMassalPasang(h.wadah, { situs: "sipp" });
      await sampai(() => barisDom(h).length === 1, "baris");
      tombol(barisDom(h)[0], /^Pratinjau$/).click();
      const rinci = await sampai(() => h.wadah.querySelector("details.aleta-basmassal-rinci") as HTMLElement, "rinci");
      expect(rinci.classList.contains("aleta-lipatan"), mode).toBe(mode === "ui");
    }
  });
});

describe("E. panel.css blok M1 dan gerbang kulit", () => {
  it("blok M1 ada di ujung panel.css dan seluruh aturannya di bawah html[data-aleta-kulit=\"modern\"]", () => {
    const css = baca("panel.css");
    const mulai = css.indexOf("/* === M1 - PERBAIKAN 1 OKT === */");
    const akhir = css.indexOf("/* === AKHIR M1 === */");
    expect(mulai).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(mulai);
    const blok = css.slice(mulai, akhir).replace(/\/\*[\s\S]*?\*\//g, "");
    const pemilih = blok.split("}").map((x) => x.split("{")[0].trim()).filter(Boolean);
    expect(pemilih.length).toBeGreaterThan(5);
    for (const p of pemilih) for (const satu of p.split(",")) expect(satu.trim(), satu).toMatch(/^html\[data-aleta-kulit="modern"\] /);
  });
});
