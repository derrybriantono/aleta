// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 28 OKT 2026 - PITA "ALETA Putusan Akhir" di jendela SIPP mengecil bila putusannya sudah ada
 * ============================================================================
 *
 * ekstensi-sipp/sipp-ide-l1.js dijalankan SUNGGUHAN di jsdom atas replika jendela Putusan Akhir SIPP 7.0.4 (seperti sipp-ide-l1-16okt):
 *   A  putusan belum ada (status belum dipilih): pita tampil penuh seperti biasa, tanpa tombol Lipat
 *   B  putusan sudah ada (tanggal terisi + status dipilih, tampak): pita terlipat satu baris, dapat dibuka lagi dan dilipat lagi
 *   C  pilihan buka/lipat diingat per perkara selama sesi tab (sessionStorage); perkara lain tidak ikut
 *   D  tidak melipat di tengah kerja: yang diketik/diisikan petugas tidak dihitung "sudah ada"; medan tersembunyi (.hide()) tidak dinilai
 *   E  kabar gagal membuka pita yang terlipat (tanpa mengubah pilihan petugas); fungsi tombol tetap utuh sesudah dibuka
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const SUMBER = baca("sipp-ide-l1.js");

const ENC = "aWQ9MTAxMTcmbm9tb3I9NTY1X1BkdC5HXzIwMjY";
const NOMOR = "565/Pdt.G/2026/PA.Dgl";

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 30));
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Jendela = any;

function buka(html: string, opsi: { url?: string; simpanan?: Record<string, unknown>; sebelum?: (w: Jendela) => void } = {}) {
  const dom = new JSDOM(html, {
    url: opsi.url || `http://127.0.0.1:8056/index.php/perkara_detil_agama/${ENC}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const simpanan: Record<string, unknown> = { ...(opsi.simpanan || {}) };
  w.__tulisan = [] as Array<Record<string, unknown>>;
  w.__ambil = 0;
  w.chrome = {
    runtime: { getManifest: () => ({ version: "1.201.0" }) },
    storage: {
      local: {
        get: async (k: string[] | string) => {
          const daftar = Array.isArray(k) ? k : [k];
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, simpanan[x]]));
        },
        set: async (isi: Record<string, unknown>) => {
          w.__tulisan.push(isi);
          Object.assign(simpanan, isi);
        },
        remove: async (k: string) => {
          delete simpanan[k];
        },
      },
      onChanged: { addListener() {} },
    },
  };
  w.__simpanan = simpanan;
  w.fetch = async () => {
    w.__ambil += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  if (opsi.sebelum) opsi.sebelum(w);
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER, ctx, { filename: "sipp-ide-l1.js" });
  return w;
}

/** Jendela Putusan Akhir 7.0.4 (edit_putusan_akhir.php) + tab Putusan (putusan_akhir.php) + panel ALETA (bagianIsiPutusan). */
function halamanPutusan(o: { panel?: boolean; edoc?: boolean; aksi?: string; usulan?: boolean; sekaligus?: boolean; terapMati?: boolean; tgl?: string; status?: string; tersembunyi?: boolean; nomor?: string } = {}) {
  const aksi = o.aksi || "http://127.0.0.1:8056/index.php/managePutusanAkhir/validateInput";
  const kartu = o.usulan
    ? `<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang" checked><span class="aleta-abt-nama">Pertimbangan Hukum</span></div><textarea class="aleta-abt-isi aleta-sunting">Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah perceraian.</textarea></div>
<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang" checked><span class="aleta-abt-nama">Status Putusan</span><span class="aleta-tanda aleta-tanda-hijau">disebut naskah</span></div><div class="aleta-abt-sanding"><div class="aleta-abt-kini"><span class="aleta-abt-label">sekarang</span><span class="aleta-abt-isi">(belum dipilih)</span></div><div class="aleta-abt-usul"><span class="aleta-abt-label">usulan</span><span class="aleta-abt-isi">Dikabulkan</span></div></div><div class="aleta-abt-kutipan"><span class="aleta-abt-asal">Putusan</span><span class="aleta-abt-kalimat">Mengabulkan gugatan Penggugat</span></div></div>
<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang"><span class="aleta-abt-nama">Putusan Verstek</span><span class="aleta-tanda aleta-tanda-kuning">mendekati</span></div><div class="aleta-abt-sanding"><div class="aleta-abt-kini"><span class="aleta-abt-label">sekarang</span><span class="aleta-abt-isi">Tidak</span></div><div class="aleta-abt-usul"><span class="aleta-abt-label">usulan</span><span class="aleta-abt-isi">Ya</span></div></div></div>
<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang" disabled><span class="aleta-abt-nama">Keadaan Istri</span><span class="aleta-tanda aleta-tanda-abu">tidak ditemukan</span></div><div class="aleta-abt-sanding"><div class="aleta-abt-kini"><span class="aleta-abt-label">sekarang</span><span class="aleta-abt-isi">(belum dipilih)</span></div></div></div>
<button class="aleta-permintaan-tombol" type="button" id="uji-terap"${o.terapMati ? " disabled" : ""}>Isikan yang dicentang</button><div class="aleta-abt-kabar"></div>`
    : "";
  const panel = o.panel
    ? `<div id="aleta-panel-sipp" class="aleta-panel"><div class="aleta-bagian" data-kunci="isiPutusan"><button class="aleta-bagian-judul" type="button">Putusan otomatis</button><div class="aleta-bagian-isi">
  <div class="aleta-tetap-sebab">Mengambil draf…</div>
  <button class="aleta-permintaan-tombol" type="button" id="uji-ambil">Ambil usulan dari ALETA</button>
  <div class="aleta-abt-kabar">Draf versi 3 (siap).</div>
  <div class="aleta-unggah-naskah"><div class="aleta-tetap-sebab aleta-remeh">Belum ada drafnya?</div><div class="aleta-tetap-kaki"><input type="file" accept=".rtf,.txt,.docx,.doc,.pdf" class="aleta-berkas" id="uji-pemilih"></div>
    <label class="aleta-a30-pilihan aleta-a30-sekaligus" style="display:${o.sekaligus ? "" : "none"}"><input type="checkbox" class="aleta-abt-centang" id="uji-sekaligus" checked><span>Sekali jalan: …</span></label>
    <div class="aleta-unggah-hasil"></div></div>
  <div class="aleta-isian-putusan">${kartu}</div>
</div></div></div>`
    : "";
  const tab = `<div id="tabs10"><table id="tableinfo">
<tr><td id="first-child">E-Doc Putusan Akhir</td><td colspan="2">${o.edoc ? "<a target='_new' href='http://127.0.0.1:8056/resources/file/doc/2026/10/PN1.pdf'>Unduh Dokumen</a>" : "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span>"}</td><td><a class="btn btn-warning btn-sm">Unggah E-Doc</a></td></tr>
<tr><td id="first-child">E-Doc Putusan Anonimisasi</td><td colspan="2"><span style='color:red;font-weight:bold'>Dokumen Belum Ada</span></td></tr>
</table></div>`;
  return `<!doctype html><html><head></head><body>${o.nomor ? `<div id="tabs1"><table><tr><td id="first-child">Nomor Perkara</td><td>${o.nomor}</td></tr></table></div>` : ""}${panel}${tab}
<div id="popup_form" class="popup"${o.tersembunyi ? ' style="display:none"' : ""}><div id="form_pop"><div class="centering"><div id="pihak_pilih"><div class="detil">
<form id="frm_putusan" method="post" action="${aksi}">
<table id="infoPerkara"><tbody>
<tr><td colspan="2">DATA PUTUSAN AKHIR</td></tr>
<tr><td id="first-child">Pertimbangan Hukum<font color="red">*</font></td><td id="perhum_text"><textarea id="perhum" name="perhum" style="visibility:hidden;display:none"></textarea><div id="cke_perhum" class="cke"><iframe></iframe></div></td></tr>
<tr><td id="first-child">Tanggal Putusan<font color="red">*</font></td><td><input id="tgl_putusan" name="tgl_putusan" value="${o.tgl ?? "16/10/2026"}" class="datepicker"></td></tr>
<tr><td id="first-child">Status Putusan<font color="red">*</font></td><td><span class="custom-dropdown"><select name="status_putusan" id="status_putusan"><option value="-1"${(o.status ?? "-1") === "-1" ? " selected" : ""}>Pilih Status Putusan</option><option value="62"${o.status === "62" ? " selected" : ""}>Dikabulkan</option><option value="67"${o.status === "67" ? " selected" : ""}>Dicabut</option></select></span></td></tr>
<tr id="verstek_tr" style="display: none;"><td id="first-child">Putusan Verstek<font color="red">*</font></td><td><select name="verstek" id="verstek"><option value="T">Tidak</option><option value="Y">Ya</option></select></td></tr>
<tr id="sumber_hukum_tr"><td id="first-child">Sumber Hukum<font color="red">*</font></td><td><input type="checkbox" name="sumber_hukum[]" value="1"> UU 1/1974 <input type="checkbox" name="sumber_hukum[]" value="2"> KHI</td></tr>
<tr id="popup_nusyuz_tr"><td id="first-child">Status Nusyuz</td><td><input type="radio" name="status_nusyuz" value="1"> Nusyuz <input type="radio" name="status_nusyuz" value="0" checked> Tidak Nusyuz</td></tr>
<tr><td id="first-child">Amar Putusan<font color="red">*</font></td><td><select id="template_amar"><option value="">Pilih amar</option></select><textarea id="amar" name="amar" style="display:none"></textarea><div id="cke_amar"><iframe></iframe></div></td></tr>
<tr><td id="first-child">Keterangan</td><td><textarea class="standard-input" id="keterangan" name="keterangan"></textarea>
<input type="hidden" id="enc" name="enc" value="${ENC}"><input type="hidden" id="act" name="act" value="x"></td></tr>
<tr><td colspan="2" align="center"><input type="button" id="close_form_putusan" value="Kembali" class="btn"><input type="submit" id="simpan" value="Simpan" class="btn"><input type="hidden" id="close_form_refresh" value=""></td></tr>
</tbody></table></form></div></div></div></div></div>
</body></html>`;
}

function isiCke(w: Jendela, id: string, teks: string) {
  const f = w.document.querySelector(`#cke_${id} iframe`);
  f.contentDocument.body.textContent = teks;
}


const pitaPutusan = (w: Jendela) => w.document.querySelector('.aleta-l1-pita[data-l1-jendela="putusan-akhir"]') as HTMLElement;
const tampilEl = (w: Jendela, e: Element | null) => Boolean(e) && w.getComputedStyle(e).display !== "none";
const ringkas = (p: HTMLElement) => p.querySelector('[data-l1="buka"]') as HTMLButtonElement;
const lipatBtn = (p: HTMLElement) => p.querySelector('[data-l1="lipat"]') as HTMLButtonElement;
const urlPerkara = (id: string) => `http://127.0.0.1:8056/index.php/perkara_detil_agama/${id}`;
const pasang = (html: string, opsi: { url?: string; simpanan?: Record<string, string> } = {}) => {
  const w = buka(html, {
    url: opsi.url,
    sebelum: (jw) => {
      for (const [k, v] of Object.entries(opsi.simpanan || {})) jw.sessionStorage.setItem(k, v);
    },
  });
  w.aletaSippIdeL1.pasang(w.document);
  return w;
};
const KUNCI = "aleta-l1-putusan-lipat";
const ADA = { tgl: "16/10/2026", status: "62" };

describe("A. putusan belum ada: perilaku sekarang tetap", () => {
  it("status putusan belum dipilih: pita penuh, tidak terlipat, tanpa tombol Lipat; tombol dan kolom utuh", () => {
    const w = pasang(halamanPutusan({ panel: true }));
    const p = pitaPutusan(w);
    expect(p.hidden).toBe(false);
    expect(p.classList.contains("aleta-l1-terlipat")).toBe(false);
    expect(p.getAttribute("data-putusan-ada")).toBe("tidak");
    expect(lipatBtn(p).hidden).toBe(true);
    expect(tampilEl(w, ringkas(p))).toBe(false);
    expect(p.querySelector('[data-l1="isi"]')).toBeTruthy();
    expect(p.querySelector('[data-l1="kosong"]')).toBeTruthy();
    expect(p.querySelector('[data-l1="berkas"]')).toBeTruthy();
    expect(p.querySelector('[data-l1="hitung"]')!.textContent).toMatch(/wajib terisi \d dari \d/);
  });

  it("tanggal putusan kosong dan status belum dipilih: sama, belum ada putusan", () => {
    const w = pasang(halamanPutusan({ panel: true, tgl: "" }));
    expect(pitaPutusan(w).getAttribute("data-putusan-ada")).toBe("tidak");
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(false);
  });

  it("tanggal terisi tetapi status belum dipilih (tanggal bawaan SIPP): belum dianggap ada putusan", () => {
    const w = pasang(halamanPutusan({ panel: true, tgl: "16/10/2026", status: "-1" }));
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(false);
  });
});

describe("B. putusan sudah ada: pita terlipat satu baris", () => {
  it("tanggal terisi + status dipilih: hanya satu baris 'ALETA · Putusan Akhir sudah ada di SIPP · buka' yang tampak", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA }));
    const p = pitaPutusan(w);
    expect(p.hidden).toBe(false);
    expect(p.classList.contains("aleta-l1-terlipat")).toBe(true);
    expect(p.getAttribute("data-putusan-ada")).toBe("ya");
    const r = ringkas(p);
    expect(tampilEl(w, r)).toBe(true);
    expect(r.textContent).toContain("ALETA");
    expect(r.textContent).toContain("Putusan Akhir sudah ada di SIPP");
    expect(r.textContent).toContain("buka");
    expect(r.getAttribute("aria-expanded")).toBe("false");
    // Isi pita (tombol, unggah, kabar) tersembunyi saat terlipat.
    for (const sel of ['[data-l1="isi"]', '[data-l1="unggah"]', '[data-l1="aksi"]']) {
      const e = p.querySelector(sel) as HTMLElement;
      expect(e, sel).toBeTruthy();
      expect(tampilEl(w, e.closest(".aleta-l1-pita > *")), sel).toBe(false);
    }
  });

  it("klik membuka lagi: semua tombol dan kolom kembali, tombol Lipat muncul; klik Lipat melipat lagi", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA }));
    const p = pitaPutusan(w);
    ringkas(p).click();
    expect(p.classList.contains("aleta-l1-terlipat")).toBe(false);
    expect(tampilEl(w, ringkas(p))).toBe(false);
    expect(tampilEl(w, p.querySelector('[data-l1="isi"]'))).toBe(true);
    expect(lipatBtn(p).hidden).toBe(false);
    expect(lipatBtn(p).textContent).toBe("Lipat");
    lipatBtn(p).click();
    expect(p.classList.contains("aleta-l1-terlipat")).toBe(true);
    expect(tampilEl(w, ringkas(p))).toBe(true);
  });

  it("fungsi utuh sesudah dibuka: Loncat ke yang kosong menyorot kolom kosong; panel dan usulan tetap berfungsi", () => {
    const w = pasang(halamanPutusan({ panel: true, usulan: true, ...ADA }));
    const p = pitaPutusan(w);
    ringkas(p).click();
    (p.querySelector('[data-l1="kosong"]') as HTMLElement).click();
    expect(w.document.querySelectorAll(".aleta-l1-sorot").length).toBeGreaterThan(0);
    expect(p.querySelector('[data-l1="usulan"] table')).toBeTruthy();
  });

  it("status lain (Dicabut) juga dihitung sudah ada", () => {
    const w = pasang(halamanPutusan({ panel: true, tgl: "01/10/2026", status: "67" }));
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(true);
  });
});

describe("C. pilihan buka/lipat diingat per perkara selama sesi tab", () => {
  it("dibuka petugas -> tersimpan 'buka' untuk perkara itu; halaman yang sama dimuat lagi tetap terbuka", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA, nomor: NOMOR }));
    ringkas(pitaPutusan(w)).click();
    const simpan = w.sessionStorage.getItem(KUNCI);
    expect(JSON.parse(simpan)).toEqual({ [NOMOR]: "buka" });
    const w2 = pasang(halamanPutusan({ panel: true, ...ADA, nomor: NOMOR }), { simpanan: { [KUNCI]: simpan } });
    expect(pitaPutusan(w2).classList.contains("aleta-l1-terlipat")).toBe(false);
    expect(lipatBtn(pitaPutusan(w2)).hidden).toBe(false);
  });

  it("perkara lain yang putusannya sudah ada tetap terlipat (pilihan tidak menular)", () => {
    const simpan = JSON.stringify({ [NOMOR]: "buka" });
    const w = pasang(halamanPutusan({ panel: true, ...ADA, nomor: "99/Pdt.G/2026/PA.Dgl" }), { simpanan: { [KUNCI]: simpan } });
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(true);
  });

  it("dilipat petugas -> tersimpan 'lipat'; perkara tanpa nomor di halaman memakai alamat halamannya", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA }), { url: urlPerkara("ABC") });
    ringkas(pitaPutusan(w)).click();
    lipatBtn(pitaPutusan(w)).click();
    expect(JSON.parse(w.sessionStorage.getItem(KUNCI))).toEqual({ "/index.php/perkara_detil_agama/ABC": "lipat" });
  });

  it("sessionStorage rusak atau tertutup: tetap berjalan (bawaan terlipat, klik tetap membuka)", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA, nomor: NOMOR }), { simpanan: { [KUNCI]: "{bukan json" } });
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(true);
    ringkas(pitaPutusan(w)).click();
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(false);
  });
});

describe("D. tidak melipat di tengah kerja", () => {
  it("petugas memilih status/tanggal sendiri pada perkara yang belum ada putusannya: pita tidak melipat", () => {
    const w = pasang(halamanPutusan({ panel: true }));
    const f = w.document.querySelector("#frm_putusan");
    const status = f.querySelector("#status_putusan");
    status.value = "62";
    status.dispatchEvent(new w.Event("change", { bubbles: true }));
    const tgl = f.querySelector("#tgl_putusan");
    tgl.value = "17/10/2026";
    tgl.dispatchEvent(new w.Event("input", { bubbles: true }));
    w.aletaSippIdeL1.segarkanSemua();
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(false);
    expect(pitaPutusan(w).getAttribute("data-putusan-ada")).toBe("tidak");
  });

  it("penilaian dikunci sesudah tiga detik: isian yang datang belakangan (mis. 'Isikan' ALETA) tidak melipat pita", () => {
    const w = pasang(halamanPutusan({ panel: true }));
    const asli = w.Date.now;
    w.Date.now = () => asli() + 4000;
    w.aletaSippIdeL1.segarkanSemua();
    const f = w.document.querySelector("#frm_putusan");
    f.querySelector("#status_putusan").value = "62";
    w.aletaSippIdeL1.segarkanSemua();
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(false);
  });

  it("nilai yang dimuat SIPP beberapa saat sesudah jendela terbuka (kurang dari tiga detik) masih dinilai", () => {
    const w = pasang(halamanPutusan({ panel: true }));
    const f = w.document.querySelector("#frm_putusan");
    f.querySelector("#status_putusan").value = "62";
    w.aletaSippIdeL1.segarkanSemua();
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(true);
  });

  it("jendela tersembunyi (.hide()): medan tidak tampak -> belum dinilai, pita tidak terlipat; setelah tampak baru dinilai", () => {
    const w = pasang(halamanPutusan({ panel: true, tersembunyi: true, ...ADA }));
    expect(w.aletaSippIdeL1.murni.putusanTersimpan(w.document.querySelector("#frm_putusan"))).toBeNull();
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(false);
    w.document.querySelector("#popup_form").style.display = "";
    w.aletaSippIdeL1.segarkanSemua();
    expect(w.aletaSippIdeL1.murni.putusanTersimpan(w.document.querySelector("#frm_putusan"))).toBe(true);
    expect(pitaPutusan(w).classList.contains("aleta-l1-terlipat")).toBe(true);
  });

  it("baris status disembunyikan SIPP (.hide() pada baris itu): tidak dihitung sebagai tampak", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA }));
    const f = w.document.querySelector("#frm_putusan");
    f.querySelector("#status_putusan").closest("tr").style.display = "none";
    expect(w.aletaSippIdeL1.murni.putusanTersimpan(f)).toBeNull();
  });
});

describe("E. kabar gagal tidak boleh tersembunyi", () => {
  it("Isikan tanpa usulan = kabar gagal: pita terlipat terbuka sendiri, pilihan petugas tidak berubah", () => {
    const w = pasang(halamanPutusan({ panel: true, ...ADA, nomor: NOMOR }));
    const p = pitaPutusan(w);
    expect(p.classList.contains("aleta-l1-terlipat")).toBe(true);
    expect(w.aletaSippIdeL1.terapPutusan(w.document.querySelector("#frm_putusan").__aletaL1)).toEqual({ ok: false, sebab: "tanpa-usulan" });
    expect(p.classList.contains("aleta-l1-terlipat")).toBe(false);
    expect((p.querySelector('[data-l1="kabar"]') as HTMLElement).textContent).toContain("Usulan belum ada");
    expect(w.sessionStorage.getItem(KUNCI)).toBeNull();
  });

  it("tampilan Lama tidak berubah: tanpa pita sama sekali (seperti sebelumnya)", () => {
    const w = buka(halamanPutusan({ panel: true, ...ADA }), { sebelum: (jw) => (jw.alatUjiMode = () => "lama") });
    w.aletaSippIdeL1.pasang(w.document);
    expect(w.document.querySelectorAll(".aleta-l1-pita").length).toBe(0);
  });
});
