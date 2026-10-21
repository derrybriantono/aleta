// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import * as jsdomModul from "jsdom";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PRATINJAU SEMUA DOKUMEN SIPP + SEBAB "KOSONG / video.pdf" (21 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga (modul asli dijalankan sungguhan di jsdom):
 *   - inventaris titik unduh SIPP (hasil telaah kode server, baca saja): tiap jenis
 *     dokumen dikenali oleh ATURAN UMUM, dan yang bukan dokumen (Excel, zip, foto,
 *     backup, halaman HTML register) TIDAK dirusak;
 *   - klik / window.open / form.submit skrip halaman dicegat dengan aturan sama:
 *     satu permintaan, pratinjau, nama berkas benar, unduh hanya lewat tombol;
 *   - berkas statis diambil pekerja latar lebih dulu (anti-rebut pengelola unduhan), fetch
 *     halaman hanya bila pekerja gagal; hasil KOSONG dijelaskan dan tindakan asli hanya
 *     SEKALI (tombol), tak pernah otomatis;
 *   - unduh-halaman.js (dunia halaman) membungkus window.open/form.submit dengan kabar
 *     yang dapat dibatalkan, dan meneruskan yang tak diambil;
 *   - ambilBerkasSipp (latar.js): hanya asal tab, hanya resources/file dan dokumen_arsip;
 *   - SIPP tidak punya tempat unggah "hasil mediasi": tidak ada tombol unggah mediasi
 *     yang menulis ke SIPP (lihat laporan; usulan alternatif di arsip portal).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const PRATINJAU = baca("pratinjau-bas-relaas.js");
const HALAMAN = baca("unduh-halaman.js");
const LATAR = baca("latar.js");

function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  for (const n of nama) {
    const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${n}\\(`).test(b));
    if (i < 0) throw new Error(`fungsi ${n} tidak ditemukan`);
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
  }
  return hasil.join("\n\n");
}

const POTONGAN_ALAT = [
  ALAT.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)![0],
  ALAT.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)![0],
  "const ALAT_TAUTAN_ASLI = new WeakSet();",
  potongFungsi(ALAT, ["alatTandaiTautanAsli", "alatLepasTautanAsli", "alatTautanAsli", "alatNamaUnduhanLayak", "alatBlobKeData", "alatUnduhLewatTautan", "alatUnduh"]),
].join("\n");

const DASAR = "http://192.168.10.10/SIPP/";
const SIPP = `${DASAR}detil_perkara_agama`;
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

const PDF = "%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF";
const PDF_B64 = Buffer.from(PDF, "latin1").toString("base64");
const RTF = "{\\rtf1\\ansi Penetapan Majelis Hakim\\par}";
const ZIP = "PK\u0003\u0004isi";

type Balasan = { status?: number; tipe?: string; disposisi?: string; isi?: string; galat?: boolean; kosong?: boolean };

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

interface Opsi {
  html?: string;
  balasan?: Record<string, Balasan>;
  /** Jawaban pekerja latar untuk "ambil-berkas-sipp": alamat -> jawaban (tak ada = tak tersedia). */
  latar?: Record<string, unknown>;
}

function lingkungan(o: Opsi = {}) {
  const konsol = new (jsdomModul as any).VirtualConsole();
  const dom = new JSDOM(o.html ?? "<!doctype html><html><body></body></html>", { url: SIPP, runScripts: "outside-only", virtualConsole: konsol } as any);
  terbuka.push(dom);
  const w = dom.window as any;
  const permintaan: Array<{ alamat: string; init: any }> = [];
  const pesanLatar: any[] = [];
  const unduhan: Array<{ nama: string; alamat: string }> = [];
  const konversiMasuk: string[] = [];

  w.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (pesan: any, balik: (x?: unknown) => void) => {
        if (pesan.jenis === "unduh") {
          unduhan.push({ nama: pesan.nama, alamat: pesan.alamat });
          balik({ ok: true, id: unduhan.length });
        } else if (pesan.jenis === "ambil-berkas-sipp") {
          pesanLatar.push(pesan);
          balik((o.latar ?? {})[pesan.alamat]);
        } else balik(undefined);
      },
    },
    storage: { onChanged: { addListener: () => {} }, local: { get: async () => ({}), set: async () => {} } },
  };
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.alatCatat = () => {};
  let urutan = 0;
  w.URL.createObjectURL = () => `blob:http://192.168.10.10/uuid-${(urutan += 1)}`;
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function click() {
    this.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  };
  w.fetch = async (alamat: string, init: any = {}) => {
    permintaan.push({ alamat, init });
    const b = (o.balasan ?? {})[alamat.replace(/#.*$/, "")];
    if (!b) return { ok: false, status: 404, headers: { get: () => null }, blob: async () => new w.Blob([]) };
    if (b.galat) throw new Error("Failed to fetch");
    const status = b.status ?? 200;
    const kepala: Record<string, string> = { "content-type": b.tipe ?? "application/pdf", ...(b.disposisi ? { "content-disposition": b.disposisi } : {}) };
    const isi = b.kosong ? new Uint8Array(0) : new TextEncoder().encode(b.isi ?? PDF);
    return { ok: status < 400, status, headers: { get: (k: string) => kepala[k.toLowerCase()] ?? null }, blob: async () => new w.Blob([isi], { type: kepala["content-type"] }) };
  };
  w.alatAmbil = async (alamat: string) => {
    konversiMasuk.push(alamat);
    return { ok: true, status: 200, json: async () => ({ ok: true, data: { berkasBase64: PDF_B64 } }) };
  };

  const konteks = (dom as any).getInternalVMContext();
  new vm.Script(POTONGAN_ALAT).runInContext(konteks);
  new vm.Script(PRATINJAU).runInContext(konteks);

  const doc = w.document as Document;
  const kotak = () => doc.getElementById("aleta-pratinjau-berkas") as HTMLElement | null;
  const dalam = (p: string) => kotak()?.shadowRoot?.querySelector(`[data-p="${p}"]`) as HTMLElement | null;
  const klik = (el: Element, tambahan: Record<string, unknown> = {}) => {
    const e = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...tambahan });
    el.dispatchEvent(e);
    return { dibatalkan: e.defaultPrevented };
  };
  /** Kabar dari unduh-halaman.js (dunia halaman). */
  const kabar = (nama: string, detail: unknown) => {
    const e = new w.CustomEvent(nama, { cancelable: true, detail: JSON.stringify(detail) });
    const lolos = doc.dispatchEvent(e);
    return { diambil: !lolos };
  };
  const kirim = (form: HTMLFormElement) => {
    const e = new w.Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(e);
    return { dibatalkan: e.defaultPrevented };
  };
  return { w, doc, permintaan, pesanLatar, unduhan, konversiMasuk, kotak, dalam, klik, kabar, kirim };
}

const mutlak = (r: string) => `${DASAR}${r}`;

// ---------------------------------------------------------------------------
// Inventaris titik unduh
// ---------------------------------------------------------------------------
describe("inventaris titik unduh SIPP: aturan umum", () => {
  const dokumen: Array<[string, string]> = [
    // berkas statis resources/file/doc
    ["resources/file/doc/2026/09/PADgl_2026_PdtG_600_bas_3_1792347558.pdf", "bas"],
    ["resources/file/doc/2024/01/PADgl_2024_PdtG_33_relaas_7648_14307_26648_1705372784.pdf", "relaas"],
    ["resources/file/doc/2026/10/PADgl_2026_PdtG_600_putusan_akhir_1792400000.pdf", "putusan"],
    ["resources/file/doc/2026/10/PADgl_2026_PdtG_600_putusan_sela_1_1792400000.rtf", "putusan"],
    ["resources/file/anonimisasi/2026/10/putusan_600.pdf", "putusan"],
    ["resources/file/doc/2026/10/250_PdtP_2026_PADgl/250_PdtP_2026_PADgl_Dokumen_PMH_1792547488.pdf", "penetapan"],
    ["resources/file/doc/2026/10/250_PdtP_2026_PADgl/250_PdtP_2026_PADgl_Dokumen_PPP_1792547489.pdf", "penetapan"],
    ["resources/file/doc/2026/10/680_PdtG_2026_PADgl/680_PdtG_2026_PADgl_Dokumen_PJS_1792438718.pdf", "penetapan"],
    ["resources/file/doc/2026/10/680_PdtG_2026_PADgl/680_PdtG_2026_PADgl_Dokumen_PHS_1792438710.docx", "penetapan"],
    ["resources/file/doc/2026/10/PADgl_2026_PdtP_250_petitum_1792545833.docx", "gugatan"],
    ["resources/file/doc/2026/10/PADgl_2026_PdtG_684_perbaikan_gugatan_1792468893.pdf", "gugatan"],
    ["resources/file/doc/2026/10/PADgl_2026_PdtG_684_aktacerai_1792468893.pdf", "akta"],
    ["resources/file/doc/2026/10/PADgl_2026_PdtG_684_berkas_lain_1792468893.pdf", "dokumen"],
    ["resources/file/delegasi/masuk/surat.pdf", "dokumen"],
    ["dokumen_arsip/1/2/3/4/Arsip_684.pdf", "dokumen"],
    ["resources/file/doc/2026/10/bukti_surat.jpg", "dokumen"],
    // rute cetak (semua c_template_*)
    ["c_template_bas_lanjutan_agama/cetak_bas_lanjutan_agama", "bas"],
    ["c_template_berita_acara/cetak_BA_elektronik/E1/E2/1", "bas"],
    ["c_template_relaas_agama/cetak_relaas", "relaas"],
    ["c_template_putusan_agama/cetak_putusan_gugur/E1", "putusan"],
    ["c_template_putusan_perdata/cetak_putusan", "putusan"],
    ["c_template_penetapan_agama/cetak_phs/E1", "penetapan"],
    ["c_template_penetapan/cetak_penetapan_majelis_hakim_pdt", "penetapan"],
    ["c_template_penetapan/cetak_pjs/E1", "penetapan"],
    ["c_template_akta_cerai_agama/cetak_akta_cerai/E1", "akta"],
    ["c_template_teguran_biaya_agama/cetak_teguran", "dokumen"],
    ["c_template_mediasi/cetak/E1/I_16", "dokumen"],
    ["c_template_tun_resume/cetakResume/E1", "dokumen"],
    ["cetak_majelis_hakim_pemeriksaan_pk/index/E1", "dokumen"],
    ["court_calendar/cetak/E1", "dokumen"],
    // rute unduh bawaan (e-Court, arsip, barcode)
    ["manage_arsip_c/doDownload/E1", "dokumen"],
    ["sppt_inbound/file/123", "dokumen"],
    ["perkara_list_verifikasi_prodeo/file/123", "dokumen"],
    ["upload_dirput/print_barcode/77", "dokumen"],
  ];
  const bukan: string[] = [
    "resources/file/doc/2026/09/rekap.xlsx",
    "resources/file/doc/2026/09/berkas.zip",
    "resources/file/doc/2026/09/data.csv",
    "resources/file/foto/pegawai.jpg",
    "resources/file/ini/konfigurasi.pdf",
    "resources/file/indikator.json",
    "resources/js/jquery.js",
    "backup/doDownload/ABC",
    "cetak_register/tampil",
    "cetak_register/tampil_banding",
    "jadwal_sidang_list/jadwal_sidang_list_cetak",
    "jurnal_perkara/jurnal_cetak",
    "view_laporan_agama/cetak_excel",
    "c_template_relaas_agama/popup_relaas/E1",
    "c_template_bas_lanjutan_agama/popup_bas_lanjutan/E1",
    "detil_perkara_agama",
    "fileupload/E1/bas/E2/3",
  ];

  it("tiap jenis dokumen dikenali dengan jenis yang benar", () => {
    const a = lingkungan().w.aletaPratinjauBasRelaas;
    for (const [rute, jenis] of dokumen) expect([rute, a.jenisDokumen(mutlak(rute), "")]).toEqual([rute, jenis]);
  });

  it("yang bukan dokumen (Excel, zip, csv, foto, backup, register HTML, popup) tidak dikenali", () => {
    const a = lingkungan().w.aletaPratinjauBasRelaas;
    for (const rute of bukan) expect([rute, a.jenisDokumen(mutlak(rute), "")]).toEqual([rute, ""]);
  });

  it("berkas e-Court dikenali dari tulisan baris SIPP di sekitar tautan", () => {
    const a = lingkungan().w.aletaPratinjauBasRelaas;
    const alamat = mutlak("resources/file/doc/2026/10/ecourt_dok_77.pdf");
    expect(a.jenisDokumen(alamat, "Unduh Dokumen Jawaban Tergugat")).toBe("ecourt");
    expect(a.jenisDokumen(alamat, "Unduh Dokumen E-Doc Gugatan")).toBe("gugatan");
    expect(a.jenisDokumen(alamat, "")).toBe("dokumen");
  });
});

// ---------------------------------------------------------------------------
// Pencegatan tanpa unduhan ganda
// ---------------------------------------------------------------------------
describe("pencegatan: satu permintaan, nama benar, unduh hanya lewat tombol", () => {
  const PMH = "resources/file/doc/2026/10/250_PdtP_2026_PADgl/250_PdtP_2026_PADgl_Dokumen_PMH_1792547488.pdf";

  it("penetapan PMH (e-Doc PDF): dicegat, satu GET, jenis Penetapan, tak ada unduhan sebelum tombol", async () => {
    const l = lingkungan({ html: `<base href="${DASAR}"><table><tr><td>Penetapan Majelis Hakim</td><td><a id='noLoading' target='_self' href='${PMH}'>Unduh Dokumen</a></td></tr></table>`, balasan: { [mutlak(PMH)]: { isi: PDF } } });
    expect(l.klik(l.doc.querySelector("a")!).dibatalkan).toBe(true);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe PDF");
    expect(l.permintaan).toHaveLength(1);
    expect(l.dalam("jenis")!.textContent).toBe("Penetapan");
    expect(l.dalam("nama")!.textContent).toBe("250_PdtP_2026_PADgl_Dokumen_PMH_1792547488.pdf");
    expect(l.unduhan).toHaveLength(0);
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan terbit");
    expect(l.unduhan[0].nama).toBe("250_PdtP_2026_PADgl_Dokumen_PMH_1792547488.pdf");
    expect(l.permintaan).toHaveLength(1);
  });

  it("gugatan/permohonan (petitum DOCX): diubah ke PDF lewat rute konversi, Unduh membawa berkas asli", async () => {
    const r = "resources/file/doc/2026/10/PADgl_2026_PdtP_250_petitum_1792545833.docx";
    const l = lingkungan({
      html: `<base href="${DASAR}"><a href='${r}'>Unduh Dokumen</a>`,
      balasan: { [mutlak(r)]: { tipe: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", isi: "PK\u0003\u0004zzzz" } },
    });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe hasil konversi");
    expect(l.konversiMasuk).toHaveLength(1);
    expect(l.dalam("jenis")!.textContent).toBe("Gugatan / Permohonan");
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan");
    expect(l.unduhan[0].nama).toBe("PADgl_2026_PdtP_250_petitum_1792545833.docx");
    expect(l.permintaan).toHaveLength(1);
  });

  it("Shift-klik = unduh langsung tanpa kotak (satu permintaan, nama benar)", async () => {
    const l = lingkungan({ html: `<base href="${DASAR}"><a href='${PMH}'>x</a>`, balasan: { [mutlak(PMH)]: { isi: PDF } } });
    expect(l.klik(l.doc.querySelector("a")!, { shiftKey: true }).dibatalkan).toBe(true);
    await sampai(() => l.unduhan.length === 1, "unduhan langsung");
    expect(l.kotak()).toBeNull();
    expect(l.permintaan).toHaveLength(1);
    expect(l.unduhan[0].nama).toBe("250_PdtP_2026_PADgl_Dokumen_PMH_1792547488.pdf");
  });

  it("cetak yang menjawab zip/Excel diunduh apa adanya tanpa kotak (tidak dirusak)", async () => {
    const alamat = mutlak("c_template_x/cetak_paket");
    const l = lingkungan({
      html: `<form method="POST" action="${alamat}"><input name="a" value="1"><input type="submit"></form>`,
      balasan: { [alamat]: { tipe: "application/zip", isi: ZIP, disposisi: 'attachment; filename="paket.zip"' } },
    });
    expect(l.kirim(l.doc.querySelector("form")!).dibatalkan).toBe(true);
    await sampai(() => l.unduhan.length === 1, "unduhan");
    expect(l.unduhan[0].nama).toBe("paket.zip");
    expect(l.kotak()).toBeNull();
    expect(l.permintaan).toHaveLength(1);
  });

  it("borang cetak GET (akta) dicegat dengan kueri; ekspor dan backup tidak disentuh", async () => {
    const akta = `${mutlak("c_template_akta_cerai_agama/cetak_akta_cerai")}?enc=E1`;
    const l = lingkungan({
      html: `<form id="a" method="GET" action="${mutlak("c_template_akta_cerai_agama/cetak_akta_cerai")}"><input name="enc" value="E1"></form>
        <form id="x" method="POST" action="${mutlak("jadwal_sidang_list/jadwal_sidang_list_cetak")}"><input name="a" value="1"></form>
        <form id="b" method="POST" action="${mutlak("backup/doDownload/Z")}"></form>`,
      balasan: { [akta]: { tipe: "application/vnd.ms-word", isi: RTF } },
    });
    expect(l.kirim(l.doc.getElementById("x") as HTMLFormElement).dibatalkan).toBe(false);
    expect(l.kirim(l.doc.getElementById("b") as HTMLFormElement).dibatalkan).toBe(false);
    expect(l.permintaan).toHaveLength(0);
    expect(l.kirim(l.doc.getElementById("a") as HTMLFormElement).dibatalkan).toBe(true);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "pratinjau akta");
    expect(l.permintaan).toHaveLength(1);
    expect(l.permintaan[0].alamat).toBe(akta);
    expect(l.dalam("jenis")!.textContent).toBe("Akta");
  });
});

// ---------------------------------------------------------------------------
// window.open / form.submit oleh skrip halaman
// ---------------------------------------------------------------------------
describe("window.open dan form.submit skrip halaman (kabar dari dunia halaman)", () => {
  it("window.open(cetak putusan) dicegat: pemanggil tidak membuka sendiri, satu GET, pratinjau", async () => {
    const alamat = mutlak("c_template_putusan_agama/cetak_putusan_gugur/E1");
    const l = lingkungan({ balasan: { [alamat]: { tipe: "application/vnd.ms-word", isi: RTF, disposisi: 'attachment; filename="PUTUSAN_GUGUR.rtf"' } } });
    expect(l.kabar("buka-dokumen-ekstensi", { href: alamat, target: "_self" }).diambil).toBe(true);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "pratinjau putusan");
    expect(l.dalam("jenis")!.textContent).toBe("Putusan");
    expect(l.dalam("nama")!.textContent).toBe("PUTUSAN_GUGUR.rtf");
    expect(l.permintaan).toHaveLength(1);
  });

  it("window.open ke yang bukan dokumen / halaman sendiri / ekspor: tidak diambil", () => {
    const l = lingkungan();
    for (const href of [mutlak("cetak_register/tampil"), mutlak("jadwal_sidang_list/jadwal_sidang_list_cetak"), SIPP, mutlak("c_template_relaas_agama/popup_relaas/E1")]) {
      expect(l.kabar("buka-dokumen-ekstensi", { href, target: "" }).diambil).toBe(false);
    }
  });

  it("Shift-klik yang melahirkan window.open = unduh langsung", async () => {
    const alamat = mutlak("c_template_penetapan_agama/cetak_phs/E1");
    const l = lingkungan({ html: "<button id=b>Cetak</button>", balasan: { [alamat]: { tipe: "application/vnd.ms-word", isi: RTF, disposisi: 'attachment; filename="PHS.rtf"' } } });
    l.klik(l.doc.getElementById("b")!, { shiftKey: true });
    expect(l.kabar("buka-dokumen-ekstensi", { href: alamat, target: "" }).diambil).toBe(true);
    await sampai(() => l.unduhan.length === 1, "unduhan langsung");
    expect(l.kotak()).toBeNull();
    expect(l.unduhan[0].nama).toBe("PHS.rtf");
  });

  it("form.submit() skrip ke cetak akta (POST): diambil; tindakan asli = borang sementara SEKALI", async () => {
    const alamat = mutlak("c_template_akta_cerai_agama/cetak_akta_cerai");
    const l = lingkungan({ balasan: { [alamat]: { galat: true } } });
    let dikirim = 0;
    // Pada jsdom submit sungguhan tidak ada; yang dihitung borang sementara yang dikirim.
    (l.w.HTMLFormElement.prototype as any).submit = function submit() {
      dikirim += 1;
    };
    expect(l.kabar("kirim-dokumen-ekstensi", { aksi: alamat, metode: "POST", berkas: false, entri: [["enc", "E1"]], target: "_self" }).diambil).toBe(true);
    await sampai(() => dikirim === 1, "tindakan asli");
    await tunggu(30);
    expect(dikirim).toBe(1);
    expect(l.kotak()).toBeNull();
  });

  it("form.submit() berisi berkas atau ke rute non-dokumen: tidak diambil", () => {
    const l = lingkungan();
    expect(l.kabar("kirim-dokumen-ekstensi", { aksi: mutlak("c_template_akta_cerai_agama/cetak_akta_cerai"), metode: "POST", berkas: true, entri: [] }).diambil).toBe(false);
    expect(l.kabar("kirim-dokumen-ekstensi", { aksi: mutlak("fileupload/validatePost"), metode: "POST", berkas: false, entri: [] }).diambil).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sebab "kosong" dan "video.pdf"
// ---------------------------------------------------------------------------
describe("pengambilan berkas statis: pekerja latar dulu, hasil kosong dijelaskan, tindakan asli sekali", () => {
  const R = "resources/file/doc/2026/09/PADgl_2026_PdtG_561_bas_1_1790649079.pdf";
  const html = `<base href="${DASAR}"><a target='_new' href=${R}><b>Unduh Dokumen BAS</b></a>`;

  it("pekerja latar menjawab: fetch halaman TIDAK dipakai sama sekali (tak ada yang direbut)", async () => {
    const l = lingkungan({ html, latar: { [mutlak(R)]: { ok: true, base64: PDF_B64, tipe: "application/pdf", disposisi: "" } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(l.pesanLatar).toHaveLength(1);
    expect(l.pesanLatar[0]).toMatchObject({ sumber: "aleta-panel", jenis: "ambil-berkas-sipp", alamat: mutlak(R) });
    expect(l.permintaan).toHaveLength(0);
    expect(l.dalam("nama")!.textContent).toBe("PADgl_2026_PdtG_561_bas_1_1790649079.pdf");
    (l.dalam("unduh") as HTMLButtonElement).click();
    await sampai(() => l.unduhan.length === 1, "unduhan");
    expect(l.unduhan[0].alamat).toBe(`data:application/pdf;base64,${PDF_B64}`);
    expect(l.permintaan).toHaveLength(0);
  });

  it("pekerja latar gagal: fetch halaman SATU kali (tanpa tembolok)", async () => {
    const l = lingkungan({ html, latar: { [mutlak(R)]: { ok: false } }, balasan: { [mutlak(R)]: { isi: PDF } } });
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => l.dalam("badan")?.querySelector("iframe"), "iframe");
    expect(l.permintaan).toHaveLength(1);
    expect(l.permintaan[0].init.cache).toBe("no-store");
    expect(l.permintaan[0].init.credentials).toBe("include");
  });

  it("hasil KOSONG (200 tanpa isi): pesan menjelaskan pengelola unduhan; tak ada tindakan asli otomatis", async () => {
    const l = lingkungan({ html, balasan: { [mutlak(R)]: { kosong: true } } });
    let asli = 0;
    l.doc.addEventListener("click", (e) => void (!e.defaultPrevented && (e.target as Element).tagName === "A" && (asli += 1)), false);
    l.klik(l.doc.querySelector("a")!);
    const galat = await sampai(() => l.dalam("badan")?.querySelector(".galat"), "pesan kosong");
    expect(galat.textContent).toMatch(/terbaca kosong/);
    expect(galat.textContent).toMatch(/pengelola unduhan/);
    await tunggu(40);
    expect(asli).toBe(0);
    expect((l.dalam("unduh") as HTMLButtonElement).disabled).toBe(true);
    expect(l.unduhan).toHaveLength(0);
  });

  it("tombol 'Unduh seperti biasa' menjalankan tindakan asli tepat SEKALI", async () => {
    const l = lingkungan({ html, balasan: { [mutlak(R)]: { kosong: true } } });
    let asli = 0;
    l.doc.addEventListener("click", (e) => void (!e.defaultPrevented && (e.target as Element).tagName === "A" && (asli += 1)), false);
    l.klik(l.doc.querySelector("a")!);
    const galat = await sampai(() => l.dalam("badan")?.querySelector(".galat"), "pesan");
    const tombol = galat.querySelector("button") as HTMLButtonElement;
    tombol.click();
    tombol.click();
    await sampai(() => asli >= 1, "klik asli");
    await tunggu(30);
    expect(asli).toBe(1);
    expect(l.kotak()).toBeNull();
  });

  it("jaringan putus: tindakan asli sekali (tautan diklik ulang), bukan dua kali", async () => {
    const l = lingkungan({ html, balasan: { [mutlak(R)]: { galat: true } } });
    let asli = 0;
    l.doc.addEventListener("click", (e) => void (!e.defaultPrevented && (e.target as Element).tagName === "A" && (asli += 1)), false);
    l.klik(l.doc.querySelector("a")!);
    await sampai(() => asli >= 1, "klik asli");
    await tunggu(40);
    expect(asli).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// unduh-halaman.js (dunia halaman)
// ---------------------------------------------------------------------------
describe("unduh-halaman.js: pembungkus window.open dan form.submit", () => {
  function halaman(ambil: boolean) {
    const konsol = new (jsdomModul as any).VirtualConsole();
    const dom = new JSDOM("<!doctype html><body><form id=f method=POST action='/SIPP/c_template_akta_cerai_agama/cetak_akta_cerai'><input name=enc value=E1></form></body>", { url: SIPP, runScripts: "outside-only", virtualConsole: konsol } as any);
    terbuka.push(dom);
    const w = dom.window as any;
    const asli = { buka: [] as any[], kirim: 0 };
    w.open = (...a: any[]) => (asli.buka.push(a), { asli: true });
    w.HTMLFormElement.prototype.submit = function submit() {
      asli.kirim += 1;
    };
    const kabar: any[] = [];
    for (const nama of ["buka-dokumen-ekstensi", "kirim-dokumen-ekstensi"]) w.document.addEventListener(nama, (e: any) => (kabar.push([nama, JSON.parse(e.detail)]), ambil && e.preventDefault()), true);
    new vm.Script(HALAMAN).runInContext((dom as any).getInternalVMContext());
    return { w, asli, kabar };
  }

  it("diambil: window.open tidak diteruskan dan pemanggil menerima tiruan aman; submit tidak dikirim", () => {
    const h = halaman(true);
    const hasil = h.w.open("/SIPP/c_template_putusan_agama/cetak_putusan_gugur/E1", "_self");
    expect(h.asli.buka).toHaveLength(0);
    expect(hasil.closed).toBe(true);
    expect(() => hasil.focus()).not.toThrow();
    h.w.document.getElementById("f").submit();
    expect(h.asli.kirim).toBe(0);
    expect(h.kabar.map((k) => k[0])).toEqual(["buka-dokumen-ekstensi", "kirim-dokumen-ekstensi"]);
    expect(h.kabar[1][1]).toMatchObject({ metode: "POST", entri: [["enc", "E1"]] });
  });

  it("tidak diambil: window.open dan submit berjalan SEPERTI BIASA; asal lain dan alamat kosong tidak dikabarkan", () => {
    const h = halaman(false);
    h.w.open("/SIPP/c_template_putusan_agama/cetak_putusan_gugur/E1", "_self");
    h.w.open("", "docs");
    h.w.open("http://lain.example/x.pdf");
    h.w.document.getElementById("f").submit();
    expect(h.asli.buka).toHaveLength(3);
    expect(h.asli.kirim).toBe(1);
    expect(h.kabar.filter((k) => k[0] === "buka-dokumen-ekstensi")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// latar.js: ambilBerkasSipp
// ---------------------------------------------------------------------------
describe("latar.js ambilBerkasSipp: dibatasi asal tab dan folder dokumen", () => {
  const sumber = LATAR.slice(LATAR.indexOf("async function ambilBerkasSipp("));
  const badan = sumber.slice(0, sumber.indexOf("\n}\n") + 3);
  const ambil = new vm.Script(`${badan}; ambilBerkasSipp;`).runInNewContext({
    URL,
    Uint8Array,
    btoa: (s: string) => Buffer.from(s, "latin1").toString("base64"),
    String,
    fetch: async (alamat: string) => ({
      ok: !/404/.test(alamat),
      status: /404/.test(alamat) ? 404 : 200,
      arrayBuffer: async () => (/kosong/.test(alamat) ? new ArrayBuffer(0) : Uint8Array.from(Buffer.from(PDF, "latin1")).buffer),
      headers: { get: (k: string) => (k === "content-type" ? "application/pdf" : "") },
    }),
  }) as (p: any, s: any) => Promise<any>;
  const dari = { url: SIPP };

  it("berkas dokumen satu asal: base64 dan jenis isi", async () => {
    const h = await ambil({ alamat: mutlak("resources/file/doc/2026/09/a.pdf") }, dari);
    expect(h).toMatchObject({ ok: true, base64: PDF_B64, tipe: "application/pdf" });
  });

  it("asal lain, folder lain, kosong, dan 404 ditolak dengan sebab", async () => {
    expect((await ambil({ alamat: "http://lain.example/SIPP/resources/file/doc/a.pdf" }, dari)).ok).toBe(false);
    expect((await ambil({ alamat: mutlak("fileupload/validatePost") }, dari)).ok).toBe(false);
    expect((await ambil({ alamat: mutlak("resources/file/doc/kosong.pdf") }, dari)).kosong).toBe(true);
    expect((await ambil({ alamat: mutlak("resources/file/doc/404.pdf") }, dari)).status).toBe(404);
    expect((await ambil({ alamat: mutlak("resources/file/doc/a.pdf") }, { url: "" })).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mediasi
// ---------------------------------------------------------------------------
describe("mediasi: tidak ada penulisan baru ke SIPP", () => {
  it("tidak ada kode ekstensi yang menambah tombol 'Unggah hasil mediasi' (SIPP tidak punya tempatnya)", () => {
    for (const berkas of ["konten.js", "panel-alat.js", "pratinjau-bas-relaas.js", "putusan-edoc-sekaligus.js"]) {
      expect(baca(berkas)).not.toMatch(/Unggah hasil mediasi/i);
    }
  });
});
