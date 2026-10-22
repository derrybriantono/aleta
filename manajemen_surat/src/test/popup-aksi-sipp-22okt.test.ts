// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * POP-UP TOMBOL AKSI DI HALAMAN SIPP + BERHASIL -> SEGAR DI HALAMAN YANG SAMA (22 Okt 2026, agen W54)
 * ============================================================================
 *
 * popup-aksi.js, muat-ulang-sipp.js, putusan-terjadwal.js, penetapan-sipp.js, dan putusan-sipp.js dijalankan
 * SUNGGUHAN di jsdom (bersama panel-alat.js untuk hak peran) atas replika halaman detil perkara dan halaman
 * daftar perkara SIPP. Yang dijaga:
 *
 *   - keempat tombol (Jadwalkan Putusan Massal, Penetapan Otomatis, Putusan Otomatis, Jadwalkan Putusan)
 *     membuka panelnya di POP-UP di tengah layar, bukan menurunkan tabel di halaman;
 *   - satu klik di luar kotak tidak menutup; klik DUA KALI di luar menutup; Escape sekali bertanya di dalam
 *     pop-up (bukan window.confirm), Escape kedua atau [Keluar] menutup, [Batal] kembali; tombol x menutup;
 *   - selama proses tulis berjalan penutupan DITAHAN dengan pesan; fokus keyboard terkunci di dalam kotak;
 *   - berhasil -> "Berhasil: ..." + halaman disegarkan di halaman yang SAMA (detil perkara lewat pintu masuk
 *     perkara_detil/<enc> + tab aktif tersimpan; daftar perkara lewat perkara_list/page/<halaman>/<enc>/...
 *     yang tercetak di skrip halamannya), BUKAN ke dasbor; gagal -> pesan di pop-up, tidak menyegarkan;
 *   - daftar perkara yang beralamat /main tidak dianggap dasbor; dasbor sungguhan tetap dikembalikan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const POPUP = baca("popup-aksi.js");
const MUAT = baca("muat-ulang-sipp.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");
const PTJ = baca("putusan-terjadwal.js");
const PEN = baca("penetapan-sipp.js");
const PUT = baca("putusan-sipp.js");
const CSS = baca("penetapan-sipp.css");

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const ENC_PERKARA = "ZW5jUGVya2FyYQ==";
const URL_PINTU_PERKARA = `${ASAL}/SIPP/perkara_detil/${ENC_PERKARA}`;
const URL_PINTU_DAFTAR = `${ASAL}/SIPP/perkara_list/page/3/ENCABC123/S0tX/col=2`;
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
    await tunggu(10);
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  halaman?: "perkara" | "daftar" | "dasbor" | "daftar-main-tanpa-skrip";
  peran?: string;
  jeda?: number;
  buatGagal?: boolean;
  /** catatan segar di chrome.storage (penanda "menunggu" sesudah muat ulang) */
  catatan?: Record<string, unknown>;
  tanpaPopup?: boolean;
  url?: string;
};

const SKRIP_DAFTAR =
  `<script>$(function(){ var totalPage='934'; var page = '3'; ` +
  `$('#selector').pagination({items: totalPage, currentPage:page, onPageClick: function(pageNumber){ ` +
  `window.open('${ASAL}/SIPP/perkara_list/page/'+pageNumber+'/ENCABC123/S0tX/col=2','_self') } }); });</script>`;

function buka(o: Opsi = {}) {
  const halaman = o.halaman ?? "perkara";
  const jalur = halaman === "perkara" ? "/SIPP/detil_perkara_agama" : halaman === "dasbor" ? "/SIPP/main" : halaman === "daftar" ? "/SIPP/main" : "/SIPP/main";
  const tabelDaftar =
    `<table id="daftar"><tr><th>No</th><th>Nomor</th></tr>` +
    `<tr><td>1</td><td>12/Pdt.G/2026/PA.Dgl</td></tr><tr><td>2</td><td>13/Pdt.G/2026/PA.Dgl</td></tr></table>`;
  const isiDaftar =
    `<div id="konten-sipp"><div id="pageTitle">DAFTAR PERKARA PERDATA GUGATAN</div><hr class="thick-line">` +
    `<div id="left"><input id="cetak_perkara_list" type="submit" value="Cetak" class="btn"></div>` +
    `<div id="pages">${tabelDaftar}</div>${halaman === "daftar" ? SKRIP_DAFTAR : ""}</div>`;
  const isiDasbor = `<section class="content-header"><h1><small>DASHBOARD PERKARA PERTAMA</small> <small>[Statistik Perkara]</small></h1></section><div class="konten"></div>`;
  const isiPerkara =
    `<table width="100%" id="submenus"><tr><td><table><tr>` +
    `<td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td>` +
    `<td><a class="btn btn-default btn-sm" href="#">Penetapan Majelis Hakim</a></td>` +
    `</tr></table></td></tr></table>` +
    `<div id="usual2" class="usual"><ul><li class="tab"><a href="#tabs1" id="tabInfo" class="selected">Data Umum</a></li>` +
    `<li class="tab"><a href="#tabs2" id="tabInfo">Penetapan</a></li><li class="tab"><a href="#tabs4" id="tabInfo">Jadwal Sidang</a></li></ul></div>`;
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">` +
      (halaman === "perkara" ? isiPerkara : halaman === "dasbor" ? isiDasbor : isiDaftar) +
      `</div></body></html>`,
    { url: o.url ?? `${ASAL}${jalur}`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true, ...(o.catatan ? { muatUlangSipp: o.catatan } : {}) };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.19" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  // window.confirm TIDAK boleh dipakai: konfirmasi ada di dalam pop-up.
  w.confirm = () => {
    throw new Error("window.confirm dipakai");
  };

  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);

  const panggilan: Array<{ metode: string; alamat: string; badan: any }> = [];
  const navigasi: string[] = [];
  const jawab = (data: unknown, status = 200, pesan?: string) => ({
    ok: status < 400,
    status,
    json: async () => (pesan ? { ok: false, error: { message: pesan } } : { ok: status < 400, data }),
  });
  let urutBerkas = 0;
  const alatAmbilTiruan = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    let badan: any = null;
    if (opsi && typeof opsi.body === "string") badan = JSON.parse(opsi.body);
    else if (opsi && opsi.body && typeof opsi.body.get === "function") badan = { berkas: opsi.body.get("berkas") };
    panggilan.push({ metode, alamat, badan });
    if (alamat.includes("/putusan-terjadwal/berkas")) {
      urutBerkas += 1;
      const file = badan.berkas as { name: string; size: number };
      return jawab({ ok: true, berkas: { id: `ptf-${urutBerkas}`, nama: file.name, bentuk: "rtf", ukuran: file.size, nomorIsi: "", peringatan: [] } });
    }
    if (alamat.includes("/putusan-terjadwal/pratinjau")) {
      const mulai = new Date(`${badan.mulai.replace(" ", "T")}:00Z`).getTime();
      const butir = Array.from({ length: badan.jumlah }, (_, i) => {
        const t = new Date(mulai + i * 5 * 60_000).toISOString();
        return { urut: i + 1, iso: t, wita: `${t.slice(0, 10)} ${t.slice(11, 16)}` };
      });
      return jawab({ ok: true, sebab: "", benih: 4242, tidakMuat: 0, jedaMin: badan.jedaMin, jedaMaks: badan.jedaMaks, peringatan: [], butir });
    }
    if (alamat.includes("/putusan-terjadwal/ringkasan-form")) {
      const ringkasan: Record<string, unknown> = {};
      for (const b of badan.berkas) {
        ringkasan[b.berkasId] = { ada: true, sebab: "", status: { label: "Dikabulkan", keyakinan: "pasti", kutipan: "x", alasan: "" }, verstek: { label: "Ya", keyakinan: "pasti", kutipan: "x", alasan: "" } };
      }
      return jawab({ ok: true, statusTersedia: ["Dikabulkan", "Ditolak"], ringkasan });
    }
    if (alamat.includes("/unggah-massal")) return jawab({ ok: true, putusan: [], tertahan: [] });
    if (alamat.includes("/aleta-ecourt/sidang")) return jawab({ available: true, sidang: [] });
    if (alamat.includes("/putusan-terjadwal") && metode === "POST") {
      if (o.buatGagal) return jawab({ ok: false }, 400, "Jadwal tidak dapat dibuat: akun SIPP belum tertaut.");
      const butir = badan.butir.map((b: any, i: number) => ({ id: `ptb-${i + 1}`, urut: i + 1, nomorPerkara: b.nomorPerkara, waktuWita: `${badan.mulai.slice(0, 16)}`, waktuIso: "", langkah: [], ringkasForm: "" }));
      return jawab({ ok: true, jadwalId: "ptj-1", akunSipp: "hakim.satu", butir, peringatan: [] });
    }
    if (alamat.includes("/putusan-terjadwal") && metode === "GET")
      return jawab({ ok: true, jadwal: [], ringkasan: { menunggu: 0, jalan: 0, selesai: 0, sebagian: 0, gagal: 0, dibatalkan: 0, belumDilihat: 0, menungguPeramban: 0 }, pengaturan: { hapusHari: 7, pelaksanaNyala: true } });
    return jawab({ ok: false, sebab: `tak dikenal: ${alamat}` }, 404);
  };
  Object.assign(w, {
    penggunaTerakhir: { nama: "Hakim Satu", peran: o.peran ?? "Super Admin" },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    a30PerkaraIdUntukAbt: async (nomor: string) => String(30000 + Number(String(nomor).split("/")[0])),
    b6KeadaanPutusanTerisi: async () => ({ terisi: false }),
    namaPenggunaSipp: () => "Hakim Satu, S.H.",
    alatAmbil: alatAmbilTiruan,
    alatSidangPadaTanggal: async () => [],
    barisPerkaraDiHalaman: () => Array.from(w.document.querySelectorAll("#daftar tr")).slice(1).map((tr: any) => ({ nomor: tr.cells[1].textContent, baris: tr })),
    aletaUjiPindah: (alamat: string) => void navigasi.push(alamat),
  });
  if (halaman === "perkara") {
    Object.assign(w, { alamatHalamanPerkara: () => true, alamatMasukPerkara: () => URL_PINTU_PERKARA });
    const baris = w.document.querySelector("#submenus td#backlist").parentElement as HTMLElement;
    const l1 = w.document.createElement("td");
    l1.className = "aleta-l1-submenu";
    l1.innerHTML = '<a href="#">Buka di ABT</a>';
    baris.appendChild(l1);
  } else {
    Object.assign(w, { alamatHalamanPerkara: () => false });
  }
  if (!o.tanpaPopup) vm.runInContext(POPUP, ctx, { filename: "popup-aksi.js" });
  vm.runInContext(MUAT, ctx, { filename: "muat-ulang-sipp.js" });
  if (o.jeda != null) w.aletaMuatUlangSipp.konf.jeda = o.jeda;
  vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  vm.runInContext(PTJ, ctx, { filename: "putusan-terjadwal.js" });
  if (halaman === "perkara") {
    vm.runInContext(PEN, ctx, { filename: "penetapan-sipp.js" });
    vm.runInContext(PUT, ctx, { filename: "putusan-sipp.js" });
  }
  return { w, d: w.document as Document, panggilan, navigasi, simpanan };
}
type Halaman = ReturnType<typeof buka>;

const ptj = (h: Halaman) => h.w.aletaPutusanTerjadwal;
const pa = (h: Halaman) => h.w.aletaPopupAksi;
const latar = (h: Halaman) => h.d.querySelector(".aleta-pa-latar") as HTMLElement | null;
const kotak = (h: Halaman) => h.d.querySelector(".aleta-pa-kotak") as HTMLElement | null;
const tanya = (h: Halaman) => h.d.querySelector('[data-pa="tanya"]') as HTMLElement;
const pesanPa = (h: Halaman) => h.d.querySelector('[data-pa="pesan"]') as HTMLElement;
const tombolPtj = (h: Halaman) => h.d.querySelector("#aleta-ptj-tombol") as HTMLButtonElement | null;

function tekan(h: Halaman, key: string, tambahan: Record<string, unknown> = {}) {
  const e = new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...tambahan });
  (h.d.activeElement || h.d.body).dispatchEvent(e);
  return e;
}
const klikDua = (h: Halaman, sasaran: Element) => sasaran.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true }));
const klikSatu = (h: Halaman, sasaran: Element) => sasaran.dispatchEvent(new h.w.MouseEvent("click", { bubbles: true, cancelable: true }));

async function bukaMassal(h: Halaman) {
  await sampai(() => (ptj(h).pasang(h.d), tombolPtj(h)), "tombol Jadwalkan Putusan Massal");
  tombolPtj(h)!.focus(); // klik petugas memfokuskan tombolnya
  tombolPtj(h)!.click();
  return sampai(() => latar(h), "pop-up terbuka");
}

// ============================================================================
describe("pop-up: membuka", () => {
  it("Jadwalkan Putusan Massal (daftar perkara): panel di dalam pop-up di tengah layar, bukan menurunkan tabel", async () => {
    const h = buka({ halaman: "daftar" });
    await sampai(() => (ptj(h).pasang(h.d), tombolPtj(h)), "tombol");
    // Sebelum diklik: tidak ada pop-up dan panel tidak tampak di halaman.
    expect(latar(h)).toBeNull();
    const panelSebelum = h.d.getElementById("aleta-ptj-panel");
    expect(!panelSebelum || panelSebelum.hidden).toBe(true);
    expect(tombolPtj(h)!.textContent).toContain("Jadwalkan Putusan Massal");
    tombolPtj(h)!.click();
    const l = await sampai(() => latar(h), "pop-up");
    const panel = h.d.getElementById("aleta-ptj-panel")!;
    expect(l.contains(panel)).toBe(true);
    expect(panel.parentElement!.classList.contains("aleta-pa-isi")).toBe(true);
    expect(panel.hidden).toBe(false);
    const k = kotak(h)!;
    expect(k.getAttribute("role")).toBe("dialog");
    expect(k.getAttribute("aria-modal")).toBe("true");
    expect(h.d.getElementById(k.getAttribute("aria-labelledby")!)!.textContent).toBe("Jadwalkan Putusan Massal");
    expect(h.d.documentElement.classList.contains("aleta-pa-kunci")).toBe(true);
    expect(pa(h).keadaan().terbuka).toBe(true);
    expect(tombolPtj(h)!.getAttribute("aria-expanded")).toBe("true");
    // Dipanggil ulang tiap putaran pemasangan: satu pop-up saja, panel tidak digandakan.
    for (let i = 0; i < 4; i += 1) ptj(h).pasang(h.d);
    expect(h.d.querySelectorAll(".aleta-pa-latar")).toHaveLength(1);
    expect(h.d.querySelectorAll("#aleta-ptj-panel")).toHaveLength(1);
  });

  it("dashboard: tombol massal yang sama juga membuka pop-up", async () => {
    const h = buka({ halaman: "dasbor" });
    await bukaMassal(h);
    expect(h.d.getElementById("aleta-ptj-panel")!.closest(".aleta-pa-latar")).not.toBeNull();
  });

  it("detil perkara: Penetapan Otomatis, Putusan Otomatis, dan Jadwalkan Putusan membuka pop-up masing-masing", async () => {
    const h = buka({ halaman: "perkara" });
    const tPen = await sampai(() => (h.w.aletaPenetapanSipp.pasang(h.d), h.d.querySelector("#aleta-pensipp-tombol")) as HTMLButtonElement, "Penetapan Otomatis");
    const tPut = await sampai(() => (h.w.aletaPutusanSipp.pasang(h.d), h.d.querySelector("#aleta-pusipp-tombol")) as HTMLButtonElement, "Putusan Otomatis");
    const tJad = await sampai(() => (ptj(h).pasang(h.d), tombolPtj(h)), "Jadwalkan Putusan");

    tPen.click();
    await sampai(() => latar(h), "pop-up Penetapan");
    expect(h.d.getElementById("aleta-pensipp-panel")!.closest(".aleta-pa-latar")).not.toBeNull();
    expect(h.d.querySelector(".aleta-pa-judul")!.textContent).toBe(`Penetapan Otomatis · ${NOMOR}`);
    klikDua(h, latar(h)!);
    expect(latar(h)).toBeNull();
    expect(h.d.getElementById("aleta-pensipp-panel")!.hidden).toBe(true);
    expect(tPen.getAttribute("aria-expanded")).toBe("false");

    tPut.click();
    await sampai(() => latar(h), "pop-up Putusan");
    expect(h.d.getElementById("aleta-pusipp-panel")!.closest(".aleta-pa-latar")).not.toBeNull();
    expect(h.d.querySelector(".aleta-pa-judul")!.textContent).toBe(`Putusan Otomatis · ${NOMOR}`);
    klikDua(h, latar(h)!);
    expect(latar(h)).toBeNull();

    tJad.click();
    await sampai(() => latar(h), "pop-up Jadwalkan");
    expect(h.d.getElementById("aleta-ptj-panel")!.closest(".aleta-pa-latar")).not.toBeNull();
    expect(h.d.querySelector(".aleta-pa-judul")!.textContent).toBe(`Jadwalkan Putusan · ${NOMOR}`);
    klikDua(h, latar(h)!);
    expect(latar(h)).toBeNull();
    // Ditutup semua: tidak ada panel yang terbuka di halaman; masing-masing diparkir tersembunyi, bukan dibuang.
    for (const id of ["aleta-pensipp-panel", "aleta-pusipp-panel", "aleta-ptj-panel"]) {
      const p = h.d.getElementById(id)!;
      expect(p.hidden, id).toBe(true);
    }
  });
});

// ============================================================================
describe("pop-up: menutup", () => {
  it("satu klik di luar kotak (latar), di dalam kotak, atau klik dua kali di dalam kotak: TIDAK menutup", async () => {
    const h = buka({ halaman: "daftar" });
    const l = await bukaMassal(h);
    klikSatu(h, l);
    klikDua(h, kotak(h)!);
    klikDua(h, h.d.getElementById("aleta-ptj-panel")!);
    klikSatu(h, kotak(h)!);
    expect(latar(h)).not.toBeNull();
    expect(pa(h).keadaan().terbuka).toBe(true);
  });

  it("klik DUA KALI di luar kotak menutup; tombol kembali ke keadaan tertutup; dibuka lagi tanpa kehilangan keadaan panel", async () => {
    const h = buka({ halaman: "daftar" });
    const l = await bukaMassal(h);
    // Keadaan panel (kotak saring) bertahan antara tutup dan buka.
    const saring = h.d.querySelector('#aleta-ptj-panel input[type="text"], #aleta-ptj-panel input:not([type])') as HTMLInputElement | null;
    const panelAwal = h.d.getElementById("aleta-ptj-panel")!;
    klikDua(h, l);
    expect(latar(h)).toBeNull();
    expect(h.d.documentElement.classList.contains("aleta-pa-kunci")).toBe(false);
    expect(ptj(h).keadaan().terbuka).toBe(false);
    expect(tombolPtj(h)!.getAttribute("aria-expanded")).toBe("false");
    expect(panelAwal.hidden).toBe(true);
    expect(panelAwal.closest(".aleta-pa-parkir")).not.toBeNull();
    // Putaran pemasangan berikutnya tidak membuka lagi sendiri.
    for (let i = 0; i < 3; i += 1) ptj(h).pasang(h.d);
    expect(latar(h)).toBeNull();
    tombolPtj(h)!.click();
    await sampai(() => latar(h), "dibuka lagi");
    expect(h.d.getElementById("aleta-ptj-panel")).toBe(panelAwal);
    expect(saring === null || h.d.contains(saring)).toBe(true);
  });

  it("Escape SATU kali: pertanyaan 'Yakin ingin keluar?' di dalam pop-up (bukan window.confirm); [Batal] kembali", async () => {
    const h = buka({ halaman: "daftar" });
    await bukaMassal(h);
    expect(tanya(h).hidden).toBe(true);
    const e = tekan(h, "Escape");
    expect(e.defaultPrevented).toBe(true);
    expect(tanya(h).hidden).toBe(false);
    expect(tanya(h).textContent).toContain("Yakin ingin keluar?");
    expect(Array.from(tanya(h).querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Keluar", "Batal"]);
    expect(latar(h)).not.toBeNull();
    (tanya(h).querySelector('[data-pa="batal"]') as HTMLButtonElement).click();
    expect(tanya(h).hidden).toBe(true);
    expect(latar(h)).not.toBeNull();
    expect(ptj(h).keadaan().terbuka).toBe(true);
  });

  it("Escape DUA kali berturut-turut menutup; [Keluar] menutup; tanda ditahan pada Escape yang ditekan tanpa dilepas", async () => {
    const h = buka({ halaman: "daftar" });
    await bukaMassal(h);
    tekan(h, "Escape");
    tekan(h, "Escape");
    expect(latar(h)).toBeNull();
    expect(ptj(h).keadaan().terbuka).toBe(false);

    tombolPtj(h)!.click();
    await sampai(() => latar(h), "dibuka lagi");
    tekan(h, "Escape");
    (tanya(h).querySelector('[data-pa="keluar"]') as HTMLButtonElement).click();
    expect(latar(h)).toBeNull();

    // Tombol ditahan (repeat) tidak dihitung sebagai Escape kedua.
    tombolPtj(h)!.click();
    await sampai(() => latar(h), "dibuka lagi");
    tekan(h, "Escape");
    tekan(h, "Escape", { repeat: true });
    expect(latar(h)).not.toBeNull();
  });

  it("tombol x menutup langsung", async () => {
    const h = buka({ halaman: "daftar" });
    await bukaMassal(h);
    const x = h.d.querySelector(".aleta-pa-tutup") as HTMLButtonElement;
    expect(x.getAttribute("aria-label")).toBe("Tutup");
    x.click();
    expect(latar(h)).toBeNull();
    expect(ptj(h).keadaan().terbuka).toBe(false);
  });

  it("selama proses tulis berjalan penutupan DITAHAN dengan pesan: x, klik dua kali, dan Escape; selesai -> boleh", async () => {
    const h = buka({ halaman: "daftar" });
    const l = await bukaMassal(h);
    ptj(h).keadaan().sibuk = true;
    (h.d.querySelector(".aleta-pa-tutup") as HTMLButtonElement).click();
    expect(latar(h)).not.toBeNull();
    expect(pesanPa(h).hidden).toBe(false);
    expect(pesanPa(h).textContent).toMatch(/Sedang bekerja/);
    klikDua(h, l);
    tekan(h, "Escape");
    tekan(h, "Escape");
    expect(latar(h)).not.toBeNull();
    expect(tanya(h).hidden).toBe(true);
    expect(pa(h).keadaan().sibuk).toBe(true);
    ptj(h).keadaan().sibuk = false;
    klikDua(h, l);
    expect(latar(h)).toBeNull();
  });

  it("fokus keyboard terkunci di dalam kotak: Tab dari yang terakhir ke yang pertama, Shift+Tab sebaliknya, fokus yang lari ditarik masuk", async () => {
    const h = buka({ halaman: "daftar" });
    await bukaMassal(h);
    const dalam = Array.from(kotak(h)!.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')).filter(
      (e) => !(e as HTMLInputElement).disabled && !e.closest("[hidden]")
    ) as HTMLElement[];
    expect(dalam.length).toBeGreaterThan(2);
    expect(kotak(h)!.contains(h.d.activeElement)).toBe(true);
    dalam[dalam.length - 1].focus();
    const maju = tekan(h, "Tab");
    expect(maju.defaultPrevented).toBe(true);
    expect(h.d.activeElement === dalam[0], `fokus ${h.d.activeElement?.outerHTML.slice(0, 80)} vs ${dalam[0].outerHTML.slice(0, 80)}`).toBe(true);
    const mundur = tekan(h, "Tab", { shiftKey: true });
    expect(mundur.defaultPrevented).toBe(true);
    expect(h.d.activeElement === dalam[dalam.length - 1], `fokus mundur ${h.d.activeElement?.outerHTML.slice(0, 80)}`).toBe(true);
    // Fokus lari ke halaman di belakang -> kembali ke dalam kotak.
    const luar = h.d.createElement("button");
    luar.textContent = "di halaman SIPP";
    h.d.getElementById("konten")!.appendChild(luar);
    luar.focus();
    expect(kotak(h)!.contains(h.d.activeElement)).toBe(true);
    // Sesudah ditutup, fokus kembali ke tombol yang membukanya.
    klikDua(h, latar(h)!);
    expect(h.d.activeElement === tombolPtj(h), "fokus kembali ke tombol").toBe(true);
  });
});

describe("pop-up: penutupan ditahan di Penetapan Otomatis dan Putusan Otomatis", () => {
  it("selama penetapan/putusan ditulis ke SIPP: x, klik dua kali, Escape tidak menutup; fokus halaman SIPP boleh berpindah (pengisian otomatis)", async () => {
    const h = buka({ halaman: "perkara" });
    const tPen = await sampai(() => (h.w.aletaPenetapanSipp.pasang(h.d), h.d.querySelector("#aleta-pensipp-tombol")) as HTMLButtonElement, "Penetapan Otomatis");
    tPen.click();
    await sampai(() => latar(h), "pop-up Penetapan");
    h.w.aletaPenetapanSipp.keadaan().sibuk = true;
    (h.d.querySelector(".aleta-pa-tutup") as HTMLButtonElement).click();
    klikDua(h, latar(h)!);
    tekan(h, "Escape");
    tekan(h, "Escape");
    expect(latar(h)).not.toBeNull();
    expect(pesanPa(h).textContent).toMatch(/Sedang bekerja/);
    h.w.aletaPenetapanSipp.keadaan().sibuk = false;
    klikDua(h, latar(h)!);
    expect(latar(h)).toBeNull();

    const tPut = await sampai(() => (h.w.aletaPutusanSipp.pasang(h.d), h.d.querySelector("#aleta-pusipp-tombol")) as HTMLButtonElement, "Putusan Otomatis");
    tPut.click();
    await sampai(() => latar(h), "pop-up Putusan");
    h.w.aletaPutusanSipp.keadaan().sibuk = true;
    // Pengisian otomatis borang SIPP di belakang memindahkan fokus: tidak ditarik kembali selama proses.
    const luar = h.d.createElement("input");
    h.d.getElementById("konten")!.appendChild(luar);
    luar.focus();
    expect(h.d.activeElement === luar).toBe(true);
    (h.d.querySelector(".aleta-pa-tutup") as HTMLButtonElement).click();
    expect(latar(h)).not.toBeNull();
    h.w.aletaPutusanSipp.keadaan().sibuk = false;
    (h.d.querySelector(".aleta-pa-tutup") as HTMLButtonElement).click();
    expect(latar(h)).toBeNull();
  });
});

// ============================================================================
describe("tampilan: tema gelap dan terang, layar kecil", () => {
  const mulaiBlok = CSS.indexOf("Pop-up tombol aksi (popup-aksi.js");
  const akhirBlok = CSS.indexOf("Tombol di deretan tombol SIPP");
  const blok = CSS.slice(mulaiBlok, akhirBlok);

  it("palet terang dan gelap dipakai bersama (--ps-*); aturan pop-up memakai peubah, tanpa angka warna", () => {
    expect(mulaiBlok).toBeGreaterThan(0);
    expect(akhirBlok).toBeGreaterThan(mulaiBlok);
    const bersih = blok.replace(/\/\*[\s\S]*?\*\//g, "");
    // Tidak ada warna harfiah (#hex, rgb(), hsl()) di aturan pop-up: semuanya lewat var(--ps-*).
    expect(bersih).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(bersih).not.toMatch(/\brgba?\(|\bhsla?\(/i);
    expect(bersih).toMatch(/var\(--ps-merek\)/);
    expect(bersih).not.toMatch(/tema-sipp="gelap"/);
    // Daftar selektor palet terang DAN gelap memuat .aleta-pa-latar.
    expect(/\.aleta-ptj-spanduk,\s*\.aleta-pa-latar\s*\{\s*--ps-latar:\s*#ffffff/.test(CSS)).toBe(true);
    expect(/html\[data-aleta-tema-sipp="gelap"\] \.aleta-pa-latar\s*\{\s*--ps-latar:\s*#17231d/.test(CSS)).toBe(true);
  });

  it("z-index wajar: di atas halaman SIPP, di bawah panel ALETA utama (2147483000) dan kotak hasil melayang (2147483001)", () => {
    const m = /\.aleta-sisip\.aleta-pa-latar\s*\{[^}]*z-index:\s*(\d+)/.exec(blok);
    expect(m).not.toBeNull();
    const z = Number(m![1]);
    expect(z).toBeGreaterThan(2147482500); // spanduk Jadwalkan Putusan
    expect(z).toBeLessThan(2147483000);
  });

  it("layar kecil: kotak memenuhi layar; kotak bergulir sendiri; halaman di belakang tidak ikut bergulir", () => {
    expect(blok).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.aleta-pa-kotak\s*\{[^}]*height:\s*100%/);
    expect(blok).toMatch(/\.aleta-pa-isi\s*\{[^}]*overflow:\s*auto/);
    expect(blok).toMatch(/html\.aleta-pa-kunci\s*\{\s*overflow:\s*hidden/);
  });

  it("popup-aksi.js terdaftar di manifest (SIPP) dan penyusun; dimuat sebelum ketiga modul panel", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js?: string[] }> };
    const sipp = m.content_scripts.find((x) => (x.js || []).includes("konten.js"))!.js!;
    const i = sipp.indexOf("popup-aksi.js");
    expect(i).toBeGreaterThan(0);
    for (const modul of ["penetapan-sipp.js", "putusan-sipp.js", "putusan-terjadwal.js"]) expect(sipp.indexOf(modul)).toBeGreaterThan(i);
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"popup-aksi.js",');
    // Wadah saja: tidak ada panggilan jaringan, tidak ada tulisan ke SIPP.
    expect(POPUP).not.toMatch(/\bfetch\(|XMLHttpRequest|alatAmbil\(/);
  });
});

// ============================================================================
describe("berhasil -> pesan + segarkan di halaman yang sama", () => {
  async function jadwalkanSatu(h: Halaman, mode: "perkara" | "daftar") {
    if (mode === "daftar") {
      await bukaMassal(h);
      (h.d.querySelector('#aleta-ptj-panel [data-ptj="dari-halaman"]') as HTMLElement).click();
    } else {
      await sampai(() => (ptj(h).pasang(h.d), tombolPtj(h)), "tombol");
      tombolPtj(h)!.click();
      await sampai(() => latar(h), "pop-up");
    }
    const zona = h.d.querySelector('#aleta-ptj-panel [data-ptj="zona"]')!;
    const evt = new h.w.Event("drop", { bubbles: true, cancelable: true }) as any;
    evt.dataTransfer = { files: [new h.w.File([new Uint8Array(2048)], mode === "daftar" ? "12_Pdt.G_2026_PA.Dgl putusan.rtf" : "684_Pdt.G_2026_PA.Dgl putusan.rtf")] };
    zona.dispatchEvent(evt);
    await sampai(() => ptj(h).keadaan().berkas.length === 1 && ptj(h).keadaan().berkas.every((b: any) => b.status === "ok"), "berkas terunggah");
    if (mode === "daftar") {
      // Hanya satu perkara yang dijadwalkan: yang lain dilepas.
      for (const k of ptj(h).keadaan().kandidat) {
        const cek = h.d.querySelector(`#aleta-ptj-panel [data-ptj-kandidat="${k.kunci}"]`) as HTMLInputElement;
        const pakai = /^12\//.test(k.nomor);
        if (cek && cek.checked !== pakai) {
          cek.checked = pakai;
          cek.dispatchEvent(new h.w.Event("change", { bubbles: true }));
        }
      }
    }
    await sampai(() => ptj(h).keadaan().pratinjau && ptj(h).keadaan().pratinjau.ok, "pratinjau jam");
    await sampai(() => !(h.d.querySelector('#aleta-ptj-panel [data-ptj="utama"]') as HTMLButtonElement).disabled, "tombol jadwalkan siap");
    (h.d.querySelector('#aleta-ptj-panel [data-ptj="utama"]') as HTMLButtonElement).click();
    (await sampai(() => h.d.querySelector('#aleta-ptj-panel [data-ptj="ya"]'), "Ya")).dispatchEvent(new h.w.MouseEvent("click", { bubbles: true }));
  }

  // 22 Okt malam (pengguna): Jadwalkan Putusan TIDAK menyegarkan sendiri - tab Antrean terjadwal tetap terbuka;
  // penyegaran hanya lewat tombol, tetap di halaman yang sama (pintu masuk perkara / alamat daftar).
  it("detil perkara: 'Berhasil: ...' tanpa segar sendiri; tombol Segarkan halaman -> pintu masuk perkara (bukan reload, bukan dasbor); tab aktif tersimpan", async () => {
    const h = buka({ halaman: "perkara", jeda: 350 });
    // Petugas sedang di tab Penetapan.
    h.d.querySelector('#usual2 a.selected')!.classList.remove("selected");
    h.d.querySelector('#usual2 a[href="#tabs2"]')!.classList.add("selected");
    await jadwalkanSatu(h, "perkara");
    const kotakMu = await sampai(() => h.d.querySelector(".aleta-mu"), "kotak hasil");
    expect(kotakMu.textContent).toContain("Berhasil: 1 perkara dijadwalkan.");
    expect(kotakMu.textContent).toContain("Antrean terjadwal tetap terbuka");
    expect(Array.from(kotakMu.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Segarkan halaman"]);
    await tunggu(600);
    expect(h.navigasi).toEqual([]);
    (kotakMu.querySelector('[data-mu="sekarang"]') as HTMLButtonElement).click();
    await sampai(() => h.navigasi.length > 0, "segar lewat tombol");
    await tunggu(500);
    expect(h.navigasi).toEqual([URL_PINTU_PERKARA]); // sekali, di perkara yang sama
    expect(h.navigasi[0]).not.toMatch(/\/(main|dashboard|beranda|home)(\/|$)/);
    const rec = (h.simpanan.muatUlangSipp as Record<string, any>)[Object.keys(h.simpanan.muatUlangSipp as object)[0]];
    expect(rec.alamat).toBe(URL_PINTU_PERKARA);
    expect(rec.tabAktif).toBe("#tabs2");
    expect(rec.ringkasan.judul).toBe("Berhasil: 1 perkara dijadwalkan.");
  });

  it("daftar perkara (/main): disegarkan lewat perkara_list/page/<halaman>/<enc>/<kata kunci>/col=<kolom> yang tercetak di skrip halaman, bukan /main", async () => {
    const h = buka({ halaman: "daftar", jeda: 350 });
    await jadwalkanSatu(h, "daftar");
    const kotakMu = await sampai(() => h.d.querySelector(".aleta-mu"), "kotak hasil");
    expect(kotakMu.textContent).toContain("Berhasil: 1 perkara dijadwalkan.");
    await tunggu(600);
    expect(h.navigasi).toEqual([]);
    (kotakMu.querySelector('[data-mu="sekarang"]') as HTMLButtonElement).click();
    await sampai(() => h.navigasi.length > 0, "segar lewat tombol");
    await tunggu(300);
    expect(h.navigasi).toEqual([URL_PINTU_DAFTAR]);
  });

  it("'Segarkan halaman' seketika dan sekali walau ditekan dua kali", async () => {
    const h = buka({ halaman: "perkara", jeda: 60000 });
    await jadwalkanSatu(h, "perkara");
    const kotakMu = await sampai(() => h.d.querySelector(".aleta-mu"), "kotak hasil");
    (kotakMu.querySelector('[data-mu="sekarang"]') as HTMLButtonElement).click();
    (kotakMu.querySelector('[data-mu="sekarang"]') as HTMLButtonElement).click();
    await sampai(() => h.navigasi.length > 0, "segar");
    await tunggu(100);
    expect(h.navigasi).toEqual([URL_PINTU_PERKARA]);
  });

  it("GAGAL: pesan galat tetap di pop-up, pop-up tetap terbuka, TIDAK menyegarkan", async () => {
    const h = buka({ halaman: "perkara", jeda: 200, buatGagal: true });
    await jadwalkanSatu(h, "perkara");
    const pesan = await sampai(() => h.d.querySelector('#aleta-ptj-panel [data-ptj="pesan"]'), "pesan");
    await sampai(() => /akun SIPP belum tertaut/.test(pesan.textContent || ""), "galat tampil");
    await tunggu(600);
    expect(h.d.querySelector(".aleta-mu")).toBeNull();
    expect(h.navigasi).toEqual([]);
    expect(latar(h)).not.toBeNull();
    expect(latar(h)!.contains(pesan)).toBe(true);
  });

  it("tanpa skrip pagination (halaman lain): jatuh ke alamat halaman itu sendiri, tidak ke tempat lain", async () => {
    const h = buka({ halaman: "daftar-main-tanpa-skrip", jeda: 100 });
    await h.w.aletaMuatUlangSipp.catatAlamat("");
    h.w.aletaMuatUlangSipp.jadwalkan({ nomor: "", ringkasan: h.w.aletaMuatUlangSipp.ringkasan("Selesai.", [], "x") });
    await sampai(() => h.navigasi.length > 0, "segar");
    expect(h.navigasi).toEqual([`${ASAL}/SIPP/main`]);
  });
});

// ============================================================================
describe("sesudah dimuat ulang: daftar di /main bukan dasbor; tab dipulihkan", () => {
  const catatan = (alamat: string, tab = "") => ({
    [`H:/SIPP/main`]: { nomor: "", alamat, alamatDetil: `${ASAL}/SIPP/main`, waktu: Date.now(), saatMuat: Date.now(), sampai: Date.now() + 60000, menunggu: true, tabAktif: tab },
  });

  it("daftar perkara di /main (judul DAFTAR PERKARA): TIDAK dipantulkan lagi", async () => {
    const h = buka({ halaman: "daftar", catatan: catatan(URL_PINTU_DAFTAR) });
    await tunggu(200);
    expect(h.navigasi).toEqual([]);
    const rec = (h.simpanan.muatUlangSipp as any)["H:/SIPP/main"];
    expect(rec.menunggu).toBe(false);
    expect(rec.kembali).toBe(false);
  });

  it("dasbor sungguhan di /main (SIPP menjatuhkan halaman ke dasbor): dikembalikan SEKALI ke daftar tadi", async () => {
    const h = buka({ halaman: "dasbor", catatan: catatan(URL_PINTU_DAFTAR) });
    await sampai(() => h.navigasi.length > 0, "dikembalikan");
    await tunggu(100);
    expect(h.navigasi).toEqual([URL_PINTU_DAFTAR]);
    expect(((h.simpanan.muatUlangSipp as any)["H:/SIPP/main"] as any).menunggu).toBe(false);
  });

  it("detil perkara: tab yang tadi aktif dibuka lagi; perkara lain tidak disentuh", async () => {
    const rekam = {
      "684/PDT.G/2026/PA.DGL": { nomor: NOMOR, alamat: URL_PINTU_PERKARA, alamatDetil: `${ASAL}/SIPP/detil_perkara_agama`, waktu: Date.now(), saatMuat: Date.now(), sampai: Date.now() + 60000, menunggu: true, tabAktif: "#tabs4" },
    };
    const h = buka({ halaman: "perkara", catatan: rekam });
    const diklik: string[] = [];
    for (const a of Array.from(h.d.querySelectorAll("#usual2 a"))) a.addEventListener("click", (e) => (e.preventDefault(), diklik.push(a.getAttribute("href")!)));
    await sampai(() => diklik.length > 0, "tab dipulihkan");
    expect(diklik).toEqual(["#tabs4"]);
    expect(h.navigasi).toEqual([]);

    const g = buka({ halaman: "perkara", catatan: { ...rekam, "684/PDT.G/2026/PA.DGL": { ...rekam["684/PDT.G/2026/PA.DGL"], alamat: `${ASAL}/SIPP/perkara_detil/PERKARA-LAIN` } } });
    const diklikG: string[] = [];
    for (const a of Array.from(g.d.querySelectorAll("#usual2 a"))) a.addEventListener("click", (e) => (e.preventDefault(), diklikG.push(a.getAttribute("href")!)));
    await tunggu(700);
    expect(diklikG).toEqual([]);
  });
});

// ============================================================================
describe("cadangan: tanpa popup-aksi.js perilaku lama tetap (panel di halaman)", () => {
  it("modul panel tidak gagal tanpa pop-up: panel dibuka di halaman seperti sebelumnya", async () => {
    const h = buka({ halaman: "daftar", tanpaPopup: true });
    await sampai(() => (ptj(h).pasang(h.d), tombolPtj(h)), "tombol");
    tombolPtj(h)!.click();
    const panel = await sampai(() => (ptj(h).pasang(h.d), h.d.getElementById("aleta-ptj-panel")), "panel");
    expect(panel.hidden).toBe(false);
    expect(panel.closest(".aleta-pa-latar")).toBeNull();
  });
});
