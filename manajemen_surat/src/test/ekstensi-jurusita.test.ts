// @vitest-environment node
/**
 * ============================================================================
 * TAB JURU SITA (PERBAIKAN 30 SEP 2026, BUTIR 15-16) - jurusita.js DIJALANKAN
 * ============================================================================
 *
 * panel-alat.js dan jurusita.js dijalankan SUNGGUHAN sebagai satu skrip di
 * jendela jsdom beralamat halaman perkara SIPP. Yang ditiru hanya tepi luarnya:
 * chrome.storage, chrome.runtime.sendMessage (pekerja latar), dan jawaban rute
 * ALETA (siapa, sidang?nomor, pemetaan-blangko K3, relaas-massal/cetak).
 *
 * Yang dijaga:
 *   1. Tampilan Lama: tidak menggambar, tidak membaca, tidak mengirim apa pun.
 *   2. Hanya juru sita / admin / super admin (matriks K1, perbaikan 30 Sep
 *      sore - panitera/PP tidak lagi); peran "lain" memakai aturan lama.
 *   3. Per perkara: pesan relaas-mulai ke latar.js berbentuk kontrak mesin
 *      relaas yang sudah ada (golongan, d, berkas APA ADANYA, asal halaman).
 *   4. Pemetaan blangko: server -> simpanan -> bawaan; bawaan = pohon-blangko.ts.
 *   5. Massal: hanya yang siap, milik juru sita yang masuk; sisanya "perlu dilihat".
 *   6. Mode kering: tidak ada yang dikirim.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
// ALETA_UJI_JURUSITA hanya dipakai pembukti gigitan: cacat dipasang pada SALINAN.
const SUMBER_JURUSITA = process.env.ALETA_UJI_JURUSITA
  ? readFileSync(process.env.ALETA_UJI_JURUSITA, "utf8").replace(/\r\n/g, "\n")
  : baca("jurusita.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "544/Pdt.G/2026/PA.Dgl";
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

type Jawab = { status?: number; isi?: unknown };
type Pilihan = {
  mode?: "lama" | "baru" | "ui";
  siapa?: { nama: string; peran: string; roleId: string; peranTambahan?: string[] } | null;
  rincian?: Record<string, unknown>;
  pemetaan?: Record<string, Array<{ kunci: string; namaBerkas: string }>> | null;
  cetak?: Record<string, unknown>;
  simpanan?: Record<string, unknown>;
  konfirmasi?: boolean;
};

const JURUSITA = { nama: "Rahmat Hidayat", peran: "Jurusita", roleId: "jurusita", peranTambahan: [] };

function rincianBaku(tambahan: Record<string, unknown> = {}) {
  return {
    perkaraId: "10018",
    nomorPerkara: NOMOR,
    jenisPerkara: "Cerai Gugat",
    jurusita: [{ kode: "1", nama: "Rahmat Hidayat, S.H." }],
    putusan: { sudahPutus: false, tanggalPutusan: "" },
    jadwalPerkara: [
      { sidangId: "1", urutanSidang: 1, tanggalSidang: "2026-09-01", agenda: "Pemeriksaan identitas" },
      { sidangId: "2", urutanSidang: 2, tanggalSidang: "2026-09-15", agenda: "Panggil Tergugat" },
      { sidangId: "3", urutanSidang: 3, tanggalSidang: "2099-10-07", agenda: "Pembuktian" },
    ],
    ...tambahan,
  };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: Pilihan = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="panel" data-peran="panitera"><div id="wadah"></div></div></body></html>`, {
    url: `${ASAL}/SIPP/perkara_detil_agama/xyz`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
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
      getManifest: () => ({ version: "1.174.1" }),
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
            ringkas: { menunggu: butir.length, sedang: 0, selesai: 0, gagal: 0, dilewati: 0 },
            perkiraan: { rata: 120000, rendah: 90000, tinggi: 150000 },
          };
        } else if (m.jenis === "relaas-keadaan") {
          jawab = { ok: true, pekerjaan: null, ringkas: {} };
        }
        setTimeout(() => balik && balik(jawab), 0);
      },
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    const j = jawabRute(url, p);
    return new Response(JSON.stringify(j.isi ?? {}), {
      status: j.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  const konfirmasi: string[] = [];
  w.confirm = (x: string) => {
    konfirmasi.push(x);
    return p.konfirmasi !== false;
  };
  // Fungsi skrip tidak terjangkau dari w.eval berikutnya - probe dipasang di
  // dalam skrip yang sama, seperti uji tahap 6.
  w.eval(
    `${SUMBER_ALAT}\n;\n${SUMBER_JURUSITA}\n;\nwindow.__uji = { mode: () => alatUjiMode(), kering: () => alatKeringNyala() };`
  );
  return { dom, w, simpanan, pesan, minta, konfirmasi, wadah: w.document.getElementById("wadah") as HTMLElement };
}

function jawabRute(url: string, p: Pilihan): Jawab {
  if (url.includes("/aleta/api/aleta-ecourt/ekstensi/siapa")) {
    if (p.siapa === null) return { status: 401, isi: { ok: false } };
    return { isi: { ok: true, data: p.siapa ?? JURUSITA } };
  }
  if (url.includes("/aleta/api/aleta-ecourt/pemetaan-blangko")) {
    const jenis = new URL(url, ASAL).searchParams.get("jenis") || "";
    if (!p.pemetaan || !p.pemetaan[jenis]) return { status: 404, isi: { ok: false } };
    return {
      isi: {
        ok: true,
        data: {
          jenis,
          butir: p.pemetaan[jenis].map((b) => ({ ...b, sebutan: "", catatan: "", diubahPada: "2026-09-30", diubahOleh: "admin" })),
          diubahPada: "2026-09-30",
        },
      },
    };
  }
  if (url.includes("/aleta/api/aleta-ecourt/sidang?nomor=")) {
    return { isi: { ok: true, data: { available: true, nomorPerkara: NOMOR, sipp: p.rincian ?? rincianBaku() } } };
  }
  if (url.includes("/aleta/api/aleta-ecourt/relaas-massal/cetak")) {
    return { isi: { ok: true, data: p.cetak ?? { dokumen: [] } } };
  }
  return { status: 404, isi: { ok: false } };
}

async function siapBaru(h: ReturnType<typeof buka>, mode = "baru") {
  await sampai(() => h.w.__uji.mode() === mode, `mode ${mode} terbaca`);
}

async function pasang(h: ReturnType<typeof buka>, opsi: Record<string, unknown> = { situs: "sipp", nomorPerkara: NOMOR, perkaraId: "10018" }) {
  return (await h.w.aletaJurusitaPasang(h.wadah, opsi)) as boolean;
}

function centang(h: ReturnType<typeof buka>, nilai: string) {
  const c = h.wadah.querySelector(`input[type=checkbox][value="${nilai}"]`) as HTMLInputElement;
  expect(c, `centang ${nilai}`).toBeTruthy();
  c.checked = true;
  c.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}

function tombolCetak(h: ReturnType<typeof buka>) {
  return h.wadah.querySelector(".aleta-jurusita-bagian .aleta-jurusita-aksi .aleta-jurusita-tombol-utama") as HTMLButtonElement;
}

const pesanMulai = (h: ReturnType<typeof buka>) => h.pesan.filter((m) => m.jenis === "relaas-mulai");

// ---------------------------------------------------------------------------

describe("gerbang tampilan dan peran", () => {
  it("tampilan Lama: tidak menggambar, tidak membaca rute juru sita, tidak mengirim pesan", async () => {
    const h = buka({ mode: "lama" });
    await tunggu(50);
    const sebelum = h.wadah.outerHTML;
    expect(await pasang(h)).toBe(false);
    await tunggu(50);
    expect(h.wadah.outerHTML).toBe(sebelum);
    expect(h.minta.filter((u) => /ekstensi\/siapa|sidang\?nomor|pemetaan-blangko|relaas-massal/.test(u))).toEqual([]);
    expect(h.pesan).toEqual([]);
    expect(h.w.aletaJurusitaBoleh("Jurusita")).toBe(false);
  });

  it("hakim dan panitera tidak melihat tab Juru Sita, juru sita/admin/super admin melihatnya", async () => {
    const h = buka({ siapa: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim" } });
    await siapBaru(h);
    expect(await pasang(h)).toBe(false);
    expect(h.wadah.innerHTML).toBe("");
    expect(h.pesan).toEqual([]);
    expect(h.w.aletaJurusitaBoleh("Hakim")).toBe(false);
    for (const peran of ["Jurusita", "Jurusita Pengganti", "Admin", "Super Admin"]) {
      expect(h.w.aletaJurusitaBoleh(peran), peran).toBe(true);
    }
    // Matriks K1 (30 Sep sore): relaas/PBT bukan menu panitera/PP, ketua, hakim.
    for (const peran of ["Panitera Pengganti", "Panitera", "Panitera Muda", "Ketua", "Wakil Ketua"]) {
      expect(h.w.aletaJurusitaBoleh(peran), peran).toBe(false);
    }
  });

  it("peran tambahan juru sita cukup; akun tak terbaca memakai data-peran panel", async () => {
    const h = buka({ siapa: { nama: "Staf", peran: "Staf Pelaksana", roleId: "staf", peranTambahan: ["jurusita"] } });
    await siapBaru(h);
    expect(await pasang(h)).toBe(true);
    const h2 = buka({ siapa: null });
    await siapBaru(h2);
    expect(await pasang(h2)).toBe(true); // data-peran="panitera"
    h2.w.document.getElementById("panel").setAttribute("data-peran", "hakim");
    h2.wadah.textContent = "";
    expect(await pasang(h2)).toBe(false);
  });

  it("UI Baru juga menggambar; pemasangan ulang tidak menggandakan bagian", async () => {
    const h = buka({ mode: "ui" });
    await siapBaru(h, "ui");
    expect(await pasang(h)).toBe(true);
    expect(await pasang(h)).toBe(true);
    expect(h.wadah.querySelectorAll(".aleta-jurusita").length).toBe(1);
  });
});

describe("per perkara - relaas panggilan dan PBT lewat mesin relaas latar.js", () => {
  it("panggilan Tergugat sidang lanjutan: blangko T (Sidang Lanjutan) apa adanya, d = sidang terpilih", async () => {
    const h = buka();
    await siapBaru(h);
    expect(await pasang(h)).toBe(true);
    await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan sidang");
    const pilih = h.wadah.querySelector("select.aleta-jurusita-sidang") as HTMLSelectElement;
    // Sidang bawaan: yang terdekat belum lewat (ke-3).
    expect(pilih.value).toBe("3");
    expect(tombolCetak(h).disabled).toBe(true); // tidak ada yang tercentang sendiri
    centang(h, "p2");
    expect(tombolCetak(h).disabled).toBe(false);
    tombolCetak(h).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai terkirim");
    const m = pesanMulai(h)[0];
    expect(m.sumber).toBe("aleta-panel");
    expect(m.asal).toBe(ASAL);
    expect(m.pekerjaan.asal).toBe(ASAL);
    expect(m.pekerjaan.asalAbt).toBe(`${ASAL}/aps_badilag`);
    expect(m.pekerjaan.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(m.pekerjaan.dokumen).toHaveLength(1);
    const d = m.pekerjaan.dokumen[0];
    expect(d.berkas).toBe(T_LANJUTAN);
    expect(d.berkas).toContain(") .rtf"); // spasi sebelum .rtf tidak dirapikan
    expect(d).toMatchObject({ perkaraId: "10018", nomorPerkara: NOMOR, golongan: "sidang-lanjutan", d: 3, jurusita: "Rahmat Hidayat, S.H." });
    expect(d.nama).toBe("544-Pdt.G-2026-PA.Dgl - panggilan sidang ke-3 Tergugat");
    // Hanya ruas kontrak mesin relaas yang dikirim.
    expect(Object.keys(d).sort()).toEqual(["berkas", "d", "golongan", "jurusita", "kunci", "label", "nama", "nomorPerkara", "perkaraId"]);
    await sampai(() => /1 dokumen masuk putaran cetak/.test(h.wadah.textContent || ""), "kabar berhasil");
  });

  it("sidang pertama: Penggugat + Tergugat = SATU dokumen blangko P dan T", async () => {
    const h = buka();
    await siapBaru(h);
    await pasang(h);
    const pilih = await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang") as HTMLSelectElement, "pilihan");
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    centang(h, "p1");
    centang(h, "p2");
    expect(tombolCetak(h).textContent).toBe("Cetak");
    tombolCetak(h).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    const dok = pesanMulai(h)[0].pekerjaan.dokumen;
    expect(dok).toHaveLength(1);
    expect(dok[0]).toMatchObject({ berkas: P_DAN_T, golongan: "sidang-pertama", d: 1, label: "Panggilan Penggugat dan Tergugat" });
  });

  it("sidang lanjutan: Penggugat + Tergugat = SATU dokumen P dan T (memuat keduanya, pohon-blangko)", async () => {
    // Sampai 30 Sep sore: dua dokumen (P dan T + T lanjutan) - panggilan
    // Tergugat tercetak dua kali. pohon-blangko.ts: pihak keduanya pada sidang
    // ditunda memakai blangko P dan T saja.
    const h = buka();
    await siapBaru(h);
    await pasang(h);
    await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    centang(h, "p1");
    centang(h, "p2");
    expect(tombolCetak(h).textContent).toBe("Cetak");
    // Blangko yang dipakai tertulis beserta sumbernya.
    const daftar = h.wadah.querySelector(".aleta-jurusita-rinci .aleta-jurusita-daftar")!.textContent || "";
    expect(daftar).toContain(P_DAN_T);
    expect(daftar).not.toContain(T_LANJUTAN);
    expect(daftar).toContain("bawaan ekstensi");
    tombolCetak(h).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    const dok = pesanMulai(h)[0].pekerjaan.dokumen;
    expect(dok).toHaveLength(1);
    expect(dok[0]).toMatchObject({ berkas: P_DAN_T, golongan: "sidang-lanjutan", d: 3, label: "Panggilan Penggugat dan Tergugat" });
  });

  it("PBT: mati sebelum putus; sesudah putus satu dokumen pemberitahuan-putusan tanpa sidang", async () => {
    const h = buka();
    await siapBaru(h);
    await pasang(h);
    await sampai(() => h.wadah.querySelector("input[value=b1]"), "centang PBT");
    expect((h.wadah.querySelector("input[value=b1]") as HTMLInputElement).disabled).toBe(true);

    const h2 = buka({ rincian: rincianBaku({ putusan: { sudahPutus: true, tanggalPutusan: "2026-09-20" } }) });
    await siapBaru(h2);
    await pasang(h2);
    await sampai(() => h2.wadah.querySelector("input[value=b1]"), "centang PBT");
    centang(h2, "b1");
    centang(h2, "b2");
    tombolCetak(h2).click();
    await sampai(() => pesanMulai(h2).length === 1, "relaas-mulai");
    const dok = pesanMulai(h2)[0].pekerjaan.dokumen;
    expect(dok).toHaveLength(1);
    expect(dok[0]).toMatchObject({ berkas: PBT, golongan: "pemberitahuan-putusan", d: 0 });
  });

  it("cerai talak: sebutan Pemohon/Termohon, sidang sesudah putusan = panggilan ikrar", async () => {
    const h = buka({
      rincian: rincianBaku({
        jenisPerkara: "Cerai Talak",
        putusan: { sudahPutus: true, tanggalPutusan: "2026-09-20" },
        jadwalPerkara: [
          { urutanSidang: 1, tanggalSidang: "2026-08-01", agenda: "Pemeriksaan" },
          { urutanSidang: 5, tanggalSidang: "2099-10-10", agenda: "Penyaksian" },
        ],
      }),
    });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    expect(h.wadah.textContent).toContain("Panggilan Pemohon");
    expect(h.wadah.textContent).toContain("PBT Termohon");
    centang(h, "p1");
    centang(h, "p2");
    tombolCetak(h).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    const dok = pesanMulai(h)[0].pekerjaan.dokumen;
    expect(dok).toHaveLength(1);
    expect(dok[0]).toMatchObject({ berkas: berkasUntuk("ikrar-talak"), golongan: "ikrar-talak", d: 5 });
  });

  it("mode kering: tidak ada yang dikirim, yang akan dicetak disebutkan", async () => {
    const h = buka({ simpanan: { modeKering: true } });
    await siapBaru(h);
    await sampai(() => h.w.__uji.kering() === true, "mode kering terbaca");
    await pasang(h);
    await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    centang(h, "p2");
    tombolCetak(h).click();
    await sampai(() => /Mode kering/.test(h.wadah.textContent || ""), "kabar mode kering");
    expect(pesanMulai(h)).toEqual([]);
    expect(h.wadah.textContent).toContain(T_LANJUTAN);
  });
});

describe("pemetaan blangko K3 - server, simpanan, bawaan", () => {
  it("server menang atas bawaan dan disimpan; tanpa server simpanan yang dipakai", async () => {
    const khusus = "[JS] 9. Relaas Tergugat Khusus Satker.rtf";
    const h = buka({ pemetaan: { relaas: [{ kunci: "panggilan-tergugat", namaBerkas: khusus }], pbt: [] } });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    centang(h, "p2");
    tombolCetak(h).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    expect(pesanMulai(h)[0].pekerjaan.dokumen[0].berkas).toBe(khusus);
    expect((h.simpanan.petaBlangkoRelaasPbt as any).relaas.peta["panggilan-tergugat"]).toBe(khusus);

    // Halaman berikutnya: server 404 (rute belum terpasang) -> simpanan.
    const h2 = buka({ pemetaan: null, simpanan: { petaBlangkoRelaasPbt: h.simpanan.petaBlangkoRelaasPbt } });
    await siapBaru(h2);
    await pasang(h2);
    await sampai(() => h2.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    centang(h2, "p2");
    expect(h2.wadah.textContent).toContain("simpanan server terakhir");
    tombolCetak(h2).click();
    await sampai(() => pesanMulai(h2).length === 1, "relaas-mulai");
    expect(pesanMulai(h2)[0].pekerjaan.dokumen[0].berkas).toBe(khusus);
  });

  it("sidang pertama tidak memakai kunci per pihak - hanya panggilan-sidang-pertama", async () => {
    const h = buka({ pemetaan: { relaas: [{ kunci: "panggilan-tergugat", namaBerkas: "[JS] X.rtf" }], pbt: [] } });
    await siapBaru(h);
    await pasang(h);
    const pilih = await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang") as HTMLSelectElement, "pilihan");
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change"));
    centang(h, "p2");
    tombolCetak(h).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai");
    expect(pesanMulai(h)[0].pekerjaan.dokumen[0].berkas).toBe(P_DAN_T);
  });

  it("jalan ke pengaturan hanya untuk admin dan super admin", async () => {
    const h = buka({ siapa: { nama: "Admin", peran: "Admin", roleId: "admin" } });
    await siapBaru(h);
    await pasang(h);
    await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    const a = h.wadah.querySelector("a.aleta-jurusita-tautan") as HTMLAnchorElement;
    expect(a?.href).toBe(`${ASAL}/aleta/admin/aleta-ecourt#pemetaan-blangko`);
    const h2 = buka();
    await siapBaru(h2);
    await pasang(h2);
    await sampai(() => h2.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan");
    expect(h2.wadah.querySelector('a[href$="#pemetaan-blangko"]')).toBeNull();
  });
});

describe("cetak massal juru sita", () => {
  const dok = (x: Record<string, unknown>) => ({
    perkaraId: 20001,
    nomorPerkara: "600/Pdt.G/2026/PA.Dgl",
    golongan: "sidang-pertama",
    d: 1,
    pihakDipanggil: "keduanya",
    pihakKe: null,
    jurusita: { nama: "Rahmat Hidayat, S.H.", nip: "", dariPenunjukan: true },
    sudahAdaRelaas: false,
    blangko: { berkas: P_DAN_T, label: "Panggilan sidang pertama (P dan T)" },
    bisaDicetak: true,
    sebabTidakBisa: "",
    peringatan: [],
    ikutPilihSemua: true,
    sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" },
    ...x,
  });
  const CETAK = {
    dokumen: [
      dok({ kunci: "sidang-pertama:20001:1:0" }),
      dok({ kunci: "sidang-pertama:20002:1:0", perkaraId: 20002, jurusita: { nama: "Budi Santoso", nip: "", dariPenunjukan: true } }),
      dok({ kunci: "sidang-ditunda:20003:2:0", perkaraId: 20003, golongan: "sidang-ditunda", d: 2, bisaDicetak: false, sebabTidakBisa: "Pihak yang dipanggil belum diketahui" }),
      dok({ kunci: "pemberitahuan-putusan:20004:0:2", perkaraId: 20004, golongan: "pemberitahuan-putusan", d: null, pihakKe: 2, blangko: { berkas: PBT, label: "PBT" } }),
      // Dapat dicetak tetapi menahan "Pilih semua" (putusan dicabut) - perlu dilihat.
      dok({
        kunci: "pemberitahuan-putusan:20005:0:1",
        perkaraId: 20005,
        golongan: "pemberitahuan-putusan",
        d: null,
        pihakKe: 1,
        blangko: { berkas: PBT, label: "PBT" },
        ikutPilihSemua: false,
        peringatan: [{ jenis: "status-putusan", teks: 'Putusan berstatus "Dicabut" - pastikan diperlukan.', tahanPilihSemua: true }],
      }),
      // Sudah tercatat di SIPP - tidak dicetak ulang diam-diam.
      dok({ kunci: "sidang-pertama:20006:1:0", perkaraId: 20006, sudahAdaRelaas: true }),
    ],
  };

  async function bukaMassal(h: ReturnType<typeof buka>) {
    await siapBaru(h);
    await pasang(h, { situs: "abt" });
    const rinci = h.wadah.querySelector("details.aleta-jurusita-massal") as HTMLDetailsElement;
    expect(rinci).toBeTruthy();
    // Daftar belum dibaca sebelum dibuka.
    expect(h.minta.some((u) => u.includes("relaas-massal/cetak"))).toBe(false);
    rinci.open = true;
    rinci.dispatchEvent(new h.w.Event("toggle"));
    return sampai(() => h.wadah.querySelector(".aleta-jurusita-ringkas"), "ringkasan massal");
  }

  it("juru sita: hanya miliknya yang siap; yang belum pasti 'perlu dilihat'; dikirim sekaligus sesudah konfirmasi", async () => {
    const h = buka({ cetak: CETAK });
    const ringkas = await bukaMassal(h);
    expect(ringkas.textContent).toBe("2 siap dicetak (1 sidang pertama, 1 PBT) · 3 perlu dilihat");
    const daftar = h.wadah.querySelector(".aleta-jurusita-hasil .aleta-jurusita-daftar")!.textContent || "";
    expect(daftar).toContain("Dicabut");
    expect(daftar).toContain("sudah tercatat di SIPP");
    expect(daftar).toContain("Pihak yang dipanggil belum diketahui");
    const cetak = h.wadah.querySelector(".aleta-jurusita-hasil .aleta-jurusita-tombol-utama") as HTMLButtonElement;
    expect(cetak.textContent).toBe("Cetak 2 dokumen");
    cetak.click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai massal");
    expect(h.konfirmasi).toHaveLength(1);
    const kirim = pesanMulai(h)[0].pekerjaan.dokumen;
    expect(kirim.map((x: any) => x.kunci)).toEqual(["sidang-pertama:20001:1:0", "pemberitahuan-putusan:20004:0:2"]);
    expect(kirim[1]).toMatchObject({ golongan: "pemberitahuan-putusan", d: 0, berkas: PBT });
    expect(kirim[0].nama).toBe("600-Pdt.G-2026-PA.Dgl - panggilan sidang ke-1");
  });

  it("Batal pada konfirmasi tidak mengirim apa pun; admin melihat semua juru sita", async () => {
    const h = buka({ cetak: CETAK, konfirmasi: false, siapa: { nama: "Admin", peran: "Admin", roleId: "admin" } });
    const ringkas = await bukaMassal(h);
    expect(ringkas.textContent).toMatch(/^3 siap dicetak/);
    (h.wadah.querySelector(".aleta-jurusita-hasil .aleta-jurusita-tombol-utama") as HTMLButtonElement).click();
    await tunggu(50);
    expect(h.konfirmasi).toHaveLength(1);
    expect(pesanMulai(h)).toEqual([]);
  });

  it("pemetaan server mengganti blangko massal (PBT Tergugat)", async () => {
    const khusus = "[JS] 2.b. PBT Tergugat.rtf";
    const h = buka({ cetak: CETAK, pemetaan: { relaas: [], pbt: [{ kunci: "pbt-tergugat", namaBerkas: khusus }] } });
    await bukaMassal(h);
    (h.wadah.querySelector(".aleta-jurusita-hasil .aleta-jurusita-tombol-utama") as HTMLButtonElement).click();
    await sampai(() => pesanMulai(h).length === 1, "relaas-mulai massal");
    const kirim = pesanMulai(h)[0].pekerjaan.dokumen;
    expect(kirim.find((x: any) => x.golongan === "pemberitahuan-putusan").berkas).toBe(khusus);
    expect(kirim.find((x: any) => x.golongan === "sidang-pertama").berkas).toBe(P_DAN_T);
  });
});

describe("pemasangan di ekstensi", () => {
  const manifest = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js?: string[] }> };
  it("jurusita.js dimuat di SIPP dan ABT, sesudah panel-alat.js dan sebelum konten.js/abt.js", () => {
    for (const utama of ["konten.js", "abt.js"]) {
      const js = manifest.content_scripts.find((x) => (x.js || []).includes(utama))!.js!;
      expect(js.indexOf("jurusita.js"), utama).toBeGreaterThan(js.indexOf("panel-alat.js"));
      expect(js.indexOf("jurusita.js"), utama).toBeLessThan(js.indexOf(utama));
    }
  });

  it("susun-ekstensi menanam jurusita.js dan penjaga TDZ menyisirnya", () => {
    expect(readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"jurusita.js",');
    expect(readFileSync(path.resolve(process.cwd(), "src/test/ekstensi-tdz-tingkat-atas.test.ts"), "utf8")).toContain('"jurusita.js",');
  });

  it("bawaan tertanam = nama blangko pohon-blangko.ts, huruf demi huruf", () => {
    for (const keadaan of ["sidang-pertama", "sidang-ditunda", "pemberitahuan-putusan", "ikrar-talak"]) {
      expect(SUMBER_JURUSITA, keadaan).toContain(JSON.stringify(berkasUntuk(keadaan)));
    }
  });
});
