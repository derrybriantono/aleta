// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import * as jsdomModul from "jsdom";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * UNGGAH HASIL MEDIASI DI TAB MEDIASI SIPP - SISI EKSTENSI (21 Okt 2026)
 * ============================================================================
 *
 * ekstensi-sipp/mediasi-arsip.js dijalankan SUNGGUHAN di jsdom atas replika tab Mediasi SIPP (struktur dari
 * views/perkara_tab/tab_mediasi_v.php). Yang dijaga: tombol "Unggah hasil mediasi" TEPAT di bawah tautan
 * "Edit Hasil Mediasi", daftar berkas di bawahnya, tanpa hak (403) tidak ada yang tampil, konfirmasi sebelum
 * unggah, unggah tidak ganda, ganti dan hapus dengan konfirmasi, pilihan terpisah e-Doc Akta Perdamaian SIPP
 * hanya bila hasilnya Y1 (lewat jalur unggah SIPP sendiri, tidak menimpa tanpa konfirmasi tegas), dan tidak ada
 * kata aleta pada yang dikirim ke SIPP.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const KODE = readFileSync(path.join(AKAR, "mediasi-arsip.js"), "utf8").replace(/\r\n/g, "\n");

const DASAR = "http://192.168.10.10/SIPP";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const ENC = "ENCperkara";
const ENCM = "ENCmediasi";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 5000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(5);
  }
}

const halamanMediasi = (hasil: string) => `<!doctype html><html><body><table id="infoPerkara"><tbody>
<tr><td colspan="3" class="divider">Data Hasil Mediasi</td></tr>
<tr><td id="first-child">Tgl. Hasil Mediasi</td><td>Selasa, 20 Oktober 2026 (Sesuai Tanggal Jadwal Mediasi Terakhir)</td>
<td style="text-align:right;">[ <a href="#" onClick="popup_form('${DASAR}/edit_hasil_mediasi/${ENC}/${ENCM}/ENCmed/1')">Edit Hasil Mediasi</a> ]</td></tr>
<tr><td id="first-child">Tgl. Laporan Mediator</td><td colspan="2">-</td></tr>
<tr><td id="first-child">Hasil Mediasi</td><td colspan="2"><b>${hasil}</b></td></tr>
<tr><td id="first-child">Keterangan</td><td colspan="2">-</td></tr>
</tbody></table></body></html>`;

const PDF = "%PDF-1.4\n% isi\n%%EOF";
const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Berkas = { id: string; nama: string; bentukAsal: string; adaPdf: boolean; ukuranAsal: number; ukuranPdf: number; versi: number; urutanMediasi: number; diunggahNama: string; peran: string; dibuatPada: string; peringatan: string; bolehHapus: boolean; keSipp: { pada: string; oleh: string } | null };
const berkasContoh = (o: Partial<Berkas> = {}): Berkas => ({
  id: "mbk-1",
  nama: "Laporan Mediator.pdf",
  bentukAsal: "pdf",
  adaPdf: true,
  ukuranAsal: 2048,
  ukuranPdf: 2048,
  versi: 1,
  urutanMediasi: 1,
  diunggahNama: "Hakim Mediator",
  peran: "hakim",
  dibuatPada: "2026-10-21T04:00:00.000Z",
  peringatan: "",
  bolehHapus: true,
  keSipp: null,
  ...o,
});

interface Opsi {
  hasil?: string;
  berkas?: Berkas[];
  hakUnggah?: boolean;
  status?: number;
  slotSipp?: { namaLama?: string; html?: string; status?: number };
  validatePost?: { st: number; msg: string };
  unggahJawab?: { status?: number; data?: unknown; pesan?: string };
}

function lingkungan(o: Opsi = {}) {
  const konsol = new (jsdomModul as any).VirtualConsole();
  const dom = new JSDOM(halamanMediasi(o.hasil ?? "Tidak Berhasil"), { url: `${DASAR}/detil_perkara_agama`, runScripts: "outside-only", virtualConsole: konsol } as any);
  terbuka.push(dom);
  const w = dom.window as any;
  const portal: Array<{ alamat: string; metode: string; badan?: any }> = [];
  const sipp: Array<{ alamat: string; metode: string; badan?: any }> = [];
  const unduhan: Array<{ nama: string }> = [];
  const pratinjau: Array<{ nama: string; jenis: string }> = [];
  let daftar = (o.berkas ?? []).slice();

  const jawab = (status: number, data: unknown, galat?: string) => ({
    ok: status < 400,
    status,
    json: async () => (status < 400 ? { ok: true, data } : { ok: false, error: { message: galat ?? "ditolak", details: (data as any)?.details } }),
    blob: async () => new w.Blob([PDF], { type: "application/pdf" }),
  });

  w.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
  w.cariNomorPerkara = () => NOMOR;
  w.alatAmbil = async (alamat: string, opsi: any = {}) => {
    const metode = String(opsi.method || "GET").toUpperCase();
    portal.push({ alamat, metode, badan: opsi.body });
    if (o.status && o.status >= 400 && alamat.startsWith("/aleta/api/aleta-ecourt/mediasi-arsip?nomorPerkara")) return jawab(o.status, null, "tanpa hak");
    if (metode === "GET" && alamat.startsWith("/aleta/api/aleta-ecourt/mediasi-arsip?nomorPerkara")) return jawab(200, { berkas: daftar, hak: { lihat: true, unggah: o.hakUnggah !== false } });
    if (metode === "GET" && alamat.startsWith("/aleta/api/aleta-ecourt/mediasi-arsip/berkas")) return jawab(200, null);
    if (metode === "POST" && alamat === "/aleta/api/aleta-ecourt/mediasi-arsip") {
      if (o.unggahJawab && (o.unggahJawab.status ?? 200) >= 400) return jawab(o.unggahJawab.status!, o.unggahJawab.data ?? {}, o.unggahJawab.pesan);
      const f = opsi.body.get("berkas");
      const baru = berkasContoh({ id: `mbk-${daftar.length + 2}`, nama: f.name, bentukAsal: /\.rtf$/i.test(f.name) ? "rtf" : "pdf", versi: opsi.body.get("gantiId") ? 2 : 1 });
      daftar = opsi.body.get("gantiId") ? daftar.filter((x) => x.id !== opsi.body.get("gantiId")).concat(baru) : daftar.concat(baru);
      return jawab(200, { ok: true, berkas: baru, peringatan: [] });
    }
    if (metode === "DELETE") {
      const id = new URL(alamat, "http://x").searchParams.get("id");
      daftar = daftar.filter((x) => x.id !== id);
      return jawab(200, { ok: true });
    }
    if (metode === "POST" && alamat === "/aleta/api/aleta-ecourt/mediasi-arsip/jejak") return jawab(200, { ok: true });
    return jawab(404, null, "tidak ada");
  };
  w.fetch = async (alamat: string, init: any = {}) => {
    const metode = String(init.method || "GET").toUpperCase();
    sipp.push({ alamat, metode, badan: init.body });
    if (alamat.includes("/fileupload/") && metode === "GET") {
      const s = o.slotSipp ?? {};
      const html =
        s.html ??
        `<form id="frm_upload_file"><table><tr><td colspan="2">${s.namaLama ? `<span style='color:#708090;font-weight:bold'>${s.namaLama}</span>` : "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span>"}</td></tr></table>
         <input type="hidden" name="enc" id="enc" value="${ENCM}"><input type="hidden" name="enc1" id="enc1" value="${ENCM}"><input type="hidden" name="from" id="from" value="mediasi"><input type="hidden" name="urutan" id="urutan" value=""></form>`;
      return { ok: (s.status ?? 200) < 400, status: s.status ?? 200, text: async () => html };
    }
    if (alamat.endsWith("/fileupload_c/validatePost")) {
      const v = o.validatePost ?? { st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." };
      return { ok: true, status: 200, json: async () => v };
    }
    return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
  };
  w.alatUnduh = async (_blob: Blob, nama: string) => (unduhan.push({ nama }), { ok: true });
  w.aletaPratinjauBasRelaas = { bukaBerkas: async (p: any) => void pratinjau.push({ nama: p.nama, jenis: p.jenis }) };

  new vm.Script(KODE, { filename: "mediasi-arsip.js" }).runInContext((dom as any).getInternalVMContext());
  const doc = w.document as Document;
  const dialog = () => doc.getElementById("aleta-mediasi-dialog") as HTMLElement | null;
  const dlg = (sel: string) => dialog()?.shadowRoot?.querySelector(sel) as HTMLElement | null;
  const tombolDlg = (teks: string) => Array.from(dialog()?.shadowRoot?.querySelectorAll("button") ?? []).find((b) => (b.textContent || "").trim() === teks) as HTMLButtonElement | undefined;
  const td = () => doc.querySelector("td:has(> a[onclick*='edit_hasil_mediasi'])") as HTMLElement;
  const tombolHalaman = (teks: string) => Array.from(doc.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === teks) as HTMLButtonElement | undefined;
  const pilihFile = (nama: string, isi = PDF) => {
    const input = dlg('input[type="file"]') as HTMLInputElement;
    const f = new w.File([isi], nama, { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [f], configurable: true });
    input.dispatchEvent(new w.Event("change", { bubbles: true }));
    return f;
  };
  return { w, doc, portal, sipp, unduhan, pratinjau, dialog, dlg, tombolDlg, td, tombolHalaman, pilihFile };
}

describe("pembacaan tabel SIPP", () => {
  it("tautan Edit Hasil Mediasi dibaca (dasar, enc perkara, enc mediasi, urutan); yang lain tidak", () => {
    const a = lingkungan().w.aletaMediasiArsip;
    expect(a.bacaTautanEdit(`popup_form('${DASAR}/edit_hasil_mediasi/${ENC}/${ENCM}/ENCmed/2')`)).toEqual({ dasar: DASAR, enc: ENC, encMediasi: ENCM, encMed: "ENCmed", urutan: 2 });
    expect(a.bacaTautanEdit("popup_form('x/edit_penetapan_mediasi/a/b/c/1')")).toBeNull();
    expect(a.bacaTautanEdit("")).toBeNull();
  });

  it("hasil mediasi dibaca dari baris tabel; hanya 'Berhasil Dengan Akta Perdamaian' yang Y1", () => {
    const lingkunganY1 = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian" });
    const tr = lingkunganY1.td().closest("tr")!;
    const a = lingkunganY1.w.aletaMediasiArsip;
    expect(a.hasilMediasiDari(tr)).toBe("Berhasil Dengan Akta Perdamaian");
    expect(a.hasilBerhasilAkta("Berhasil Dengan Akta Perdamaian")).toBe(true);
    for (const t of ["Berhasil", "Berhasil Dengan Pencabutan", "Tidak Berhasil", "Berhasil Sebagian", ""]) expect(a.hasilBerhasilAkta(t)).toBe(false);
  });
});

describe("pemasangan di tab Mediasi", () => {
  it("tombol 'Unggah hasil mediasi' TEPAT di bawah tautan Edit (sel yang sama); daftar berkas di baris sesudahnya", async () => {
    const l = lingkungan({ berkas: [berkasContoh()] });
    await sampai(() => l.tombolHalaman("Unggah hasil mediasi") && !l.tombolHalaman("Unggah hasil mediasi")!.hidden, "tombol tampil");
    const td = l.td();
    const anak = Array.from(td.childNodes).filter((n) => n.nodeType === 1) as HTMLElement[];
    expect(anak[0].tagName).toBe("A"); // tautan Edit tetap pertama
    expect(anak[1].contains(l.tombolHalaman("Unggah hasil mediasi")!)).toBe(true); // tombol sesudahnya, satu sel
    const barisDaftar = td.closest("tr")!.nextElementSibling as HTMLElement;
    await sampai(() => /Laporan Mediator\.pdf/.test(barisDaftar.textContent || ""), "daftar tampil");
    expect(barisDaftar.textContent).toContain("Berkas hasil mediasi (arsip perkara)");
    expect(barisDaftar.textContent).toContain("Hakim Mediator");
    const aksi = Array.from(barisDaftar.querySelectorAll("button")).map((b) => b.textContent);
    expect(aksi).toEqual(["Lihat", "Unduh", "Ganti", "Hapus"]);
    expect(l.portal[0]).toMatchObject({ metode: "GET", alamat: `/aleta/api/aleta-ecourt/mediasi-arsip?nomorPerkara=${encodeURIComponent(NOMOR)}` });
  });

  it("tanpa hak (403): tidak ada tombol maupun daftar yang tampil; dipasang sekali saja", async () => {
    const l = lingkungan({ status: 403 });
    await sampai(() => l.portal.length >= 1, "portal ditanya");
    await tunggu(30);
    const tombol = l.tombolHalaman("Unggah hasil mediasi");
    expect(!tombol || tombol.hidden || (tombol.closest(".aleta-sisip") as HTMLElement)?.hidden).toBe(true);
    const barisDaftar = l.td().closest("tr")!.nextElementSibling as HTMLElement;
    expect(barisDaftar.hidden).toBe(true);
    l.w.aletaMediasiArsip.pasang(l.doc);
    l.w.aletaMediasiArsip.pasang(l.doc);
    expect(l.portal.filter((p) => p.metode === "GET")).toHaveLength(1);
  });

  it("hanya boleh melihat: daftar tampil tanpa tombol unggah dan tanpa Ganti", async () => {
    const l = lingkungan({ berkas: [berkasContoh({ bolehHapus: false })], hakUnggah: false });
    const barisDaftar = await sampai(() => {
      const b = l.td().closest("tr")!.nextElementSibling as HTMLElement;
      return /Laporan Mediator\.pdf/.test(b.textContent || "") ? b : null;
    }, "daftar");
    expect(l.tombolHalaman("Unggah hasil mediasi")!.hidden).toBe(true);
    expect(Array.from(barisDaftar.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Lihat", "Unduh"]);
  });

  it("berkas RTF menampilkan Unduh asli dan PDF; Lihat memakai pratinjau, Unduh bernama benar", async () => {
    const l = lingkungan({ berkas: [berkasContoh({ id: "mbk-r", nama: "Kesepakatan.rtf", bentukAsal: "rtf" })] });
    const baris = await sampai(() => {
      const b = l.td().closest("tr")!.nextElementSibling as HTMLElement;
      return b.querySelectorAll("button").length >= 4 ? b : null;
    }, "daftar");
    const tombol = (t: string) => Array.from(baris.querySelectorAll("button")).find((b) => b.textContent === t) as HTMLButtonElement;
    expect(Array.from(baris.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Lihat", "Unduh", "PDF", "Ganti", "Hapus"]);
    tombol("Lihat").click();
    await sampai(() => l.pratinjau.length === 1, "pratinjau");
    expect(l.pratinjau[0]).toEqual({ nama: "Kesepakatan.pdf", jenis: "dokumen" });
    tombol("Unduh").click();
    await sampai(() => l.unduhan.length === 1, "unduhan asli");
    expect(l.unduhan[0].nama).toBe("Kesepakatan.rtf");
    tombol("PDF").click();
    await sampai(() => l.unduhan.length === 2, "unduhan pdf");
    expect(l.unduhan[1].nama).toBe("Kesepakatan.pdf");
  });
});

describe("unggah", () => {
  it("konfirmasi dulu; unggah SATU kali walau 'Ya, unggah' diklik dua kali; daftar disegarkan", async () => {
    const l = lingkungan();
    (await sampai(() => (l.tombolHalaman("Unggah hasil mediasi") && !l.tombolHalaman("Unggah hasil mediasi")!.hidden ? l.tombolHalaman("Unggah hasil mediasi") : null), "tombol"))!.click();
    await sampai(() => l.dialog(), "dialog");
    expect(l.dlg("h2")!.textContent).toBe("Unggah hasil mediasi");
    expect(l.dlg(".sub")!.textContent).toContain("bukan di SIPP");
    expect(l.tombolDlg("Lanjut")!.disabled).toBe(true);
    // format tak sah ditolak
    l.pilihFile("catatan.txt");
    expect(l.dlg(".pesan")!.textContent).toMatch(/Hanya PDF, RTF, DOC, atau DOCX/);
    expect(l.tombolDlg("Lanjut")!.disabled).toBe(true);
    l.pilihFile("Laporan Mediasi.pdf");
    expect(l.tombolDlg("Lanjut")!.disabled).toBe(false);
    expect(l.dlg(".berkas")!.textContent).toContain("Laporan Mediasi.pdf");
    l.tombolDlg("Lanjut")!.click();
    expect(l.dlg("h2")!.textContent).toBe("Yakin mengunggah berkas ini?");
    expect(l.portal.filter((p) => p.metode === "POST")).toHaveLength(0); // belum ada yang terkirim sebelum "Ya"
    const ya = l.tombolDlg("Ya, unggah")!;
    ya.click();
    ya.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai", "selesai");
    const posts = l.portal.filter((p) => p.metode === "POST" && p.alamat === "/aleta/api/aleta-ecourt/mediasi-arsip");
    expect(posts).toHaveLength(1);
    expect(posts[0].badan.get("nomorPerkara")).toBe(NOMOR);
    expect(posts[0].badan.get("urutanMediasi")).toBe("1");
    expect(posts[0].badan.get("berkas").name).toBe("Laporan Mediasi.pdf");
    expect(posts[0].badan.get("gantiId")).toBeNull();
    expect(l.sipp.filter((s) => s.metode === "POST")).toHaveLength(0); // bukan Y1: tidak menyentuh SIPP sama sekali
    l.tombolDlg("Tutup")!.click();
    const barisDaftar = l.td().closest("tr")!.nextElementSibling as HTMLElement;
    await sampai(() => /Laporan Mediasi\.pdf/.test(barisDaftar.textContent || ""), "daftar menyegar");
  });

  it("ditolak server (berkas ganda): pesan jelas, dialog tetap, dapat dicoba lagi", async () => {
    const l = lingkungan({ unggahJawab: { status: 409, data: { details: { kode: "ganda" } }, pesan: "Berkas yang sama persis sudah ada di arsip perkara ini (a.pdf)." } });
    (await sampai(() => (l.tombolHalaman("Unggah hasil mediasi") && !l.tombolHalaman("Unggah hasil mediasi")!.hidden ? l.tombolHalaman("Unggah hasil mediasi") : null), "tombol"))!.click();
    await sampai(() => l.dialog(), "dialog");
    l.pilihFile("a.pdf");
    l.tombolDlg("Lanjut")!.click();
    l.tombolDlg("Ya, unggah")!.click();
    await sampai(() => /sudah ada di arsip/.test(l.dlg(".pesan")?.textContent || ""), "pesan ganda");
    expect(l.tombolDlg("Ya, unggah")!.disabled).toBe(false);
  });

  it("opsi e-Doc Akta Perdamaian SIPP TIDAK ada bila hasilnya bukan Y1", async () => {
    const l = lingkungan({ hasil: "Berhasil Dengan Pencabutan" });
    (await sampai(() => (l.tombolHalaman("Unggah hasil mediasi") && !l.tombolHalaman("Unggah hasil mediasi")!.hidden ? l.tombolHalaman("Unggah hasil mediasi") : null), "tombol"))!.click();
    await sampai(() => l.dialog(), "dialog");
    expect((l.dlg("label.pilihan") as HTMLElement).hidden).toBe(true);
  });
});

describe("ganti dan hapus", () => {
  it("Ganti: dialog menyebut berkas lama, konfirmasi tegas, mengirim gantiId + konfirmasiGanti", async () => {
    const l = lingkungan({ berkas: [berkasContoh()] });
    const baris = await sampai(() => {
      const b = l.td().closest("tr")!.nextElementSibling as HTMLElement;
      return b.querySelectorAll("button").length >= 3 ? b : null;
    }, "daftar");
    (Array.from(baris.querySelectorAll("button")).find((b) => b.textContent === "Ganti") as HTMLButtonElement).click();
    await sampai(() => l.dialog(), "dialog ganti");
    expect(l.dlg("h2")!.textContent).toBe("Ganti berkas hasil mediasi");
    expect(l.dlg(".sub")!.textContent).toContain("Laporan Mediator.pdf (versi 1)");
    l.pilihFile("Revisi.pdf");
    l.tombolDlg("Lanjut")!.click();
    expect(l.dlg("h2")!.textContent).toBe("Yakin mengganti berkas ini?");
    expect(l.dlg(".awas")!.textContent).toContain("tidak lagi dapat diunduh");
    l.tombolDlg("Ya, ganti")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai", "selesai");
    const kirim = l.portal.find((p) => p.metode === "POST" && p.alamat === "/aleta/api/aleta-ecourt/mediasi-arsip")!;
    expect(kirim.badan.get("gantiId")).toBe("mbk-1");
    expect(kirim.badan.get("konfirmasiGanti")).toBe("1");
  });

  it("Hapus: tombol hanya bila bolehHapus; dialog konfirmasi; DELETE dengan konfirmasi dan alasan", async () => {
    const l = lingkungan({ berkas: [berkasContoh({ id: "mbk-a" }), berkasContoh({ id: "mbk-b", nama: "Lain.pdf", bolehHapus: false })] });
    const barisDaftar = await sampai(() => {
      const b = l.td().closest("tr")!.nextElementSibling as HTMLElement;
      return b.querySelectorAll("[data-am-berkas]").length === 2 ? b : null;
    }, "dua berkas");
    const hapusButtons = Array.from(barisDaftar.querySelectorAll("button")).filter((b) => b.textContent === "Hapus");
    expect(hapusButtons).toHaveLength(1);
    hapusButtons[0].click();
    await sampai(() => l.dialog(), "dialog hapus");
    expect(l.dlg("h2")!.textContent).toBe("Hapus berkas hasil mediasi?");
    expect(l.portal.filter((p) => p.metode === "DELETE")).toHaveLength(0);
    const alasan = l.dlg("input[type=text]") as HTMLInputElement;
    alasan.value = "salah unggah";
    l.tombolDlg("Ya, hapus")!.click();
    await sampai(() => l.portal.some((p) => p.metode === "DELETE"), "DELETE");
    const hapus = l.portal.find((p) => p.metode === "DELETE")!;
    expect(hapus.alamat).toBe("/aleta/api/aleta-ecourt/mediasi-arsip?id=mbk-a&konfirmasi=1&alasan=salah%20unggah");
    await sampai(() => !l.dialog(), "dialog tertutup");
    await sampai(() => barisDaftar.querySelectorAll("[data-am-berkas]").length === 1, "daftar menyegar");
  });
});

describe("e-Doc Akta Perdamaian SIPP (hanya hasil Y1, jalur unggah SIPP sendiri)", () => {
  async function bukaDialogY1(l: ReturnType<typeof lingkungan>) {
    (await sampai(() => (l.tombolHalaman("Unggah hasil mediasi") && !l.tombolHalaman("Unggah hasil mediasi")!.hidden ? l.tombolHalaman("Unggah hasil mediasi") : null), "tombol"))!.click();
    await sampai(() => l.dialog(), "dialog");
  }

  it("Y1: pilihan terpisah tampil; tidak dicentang = tidak menyentuh SIPP", async () => {
    const l = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian" });
    await bukaDialogY1(l);
    expect((l.dlg("label.pilihan") as HTMLElement).hidden).toBe(false);
    expect(l.dlg("label.pilihan")!.textContent).toContain("Kirim juga sebagai e-Doc Akta Perdamaian di SIPP");
    l.pilihFile("Akta.pdf");
    l.tombolDlg("Lanjut")!.click();
    expect(l.dlg(".awas")).toBeNull();
    l.tombolDlg("Ya, unggah")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai", "selesai");
    expect(l.sipp).toHaveLength(0);
  });

  it("dicentang, e-Doc di SIPP kosong: konfirmasi menyebut SIPP, kirim lewat fileupload_c/validatePost, jejak dicatat, tanpa kata aleta", async () => {
    const l = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian" });
    await bukaDialogY1(l);
    l.pilihFile("Akta.pdf");
    (l.dlg("label.pilihan input") as HTMLInputElement).click();
    l.tombolDlg("Lanjut")!.click();
    expect(l.dlg(".awas")!.textContent).toContain("Juga dikirim ke SIPP");
    l.tombolDlg("Ya, unggah")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai", "selesai", 8000);
    expect(l.dlg(".berkas")!.textContent).toContain("dikirim ke e-Doc Akta Perdamaian SIPP");
    // 1) halaman unggah SIPP dibuka dengan enc mediasi di kedua ruas
    expect(l.sipp[0]).toMatchObject({ metode: "GET", alamat: `${DASAR}/fileupload/${ENCM}/mediasi` });
    // 2) kiriman ke validatePost memakai isian tersembunyi SIPP + berkas PDF
    const post = l.sipp.find((s) => s.metode === "POST")!;
    expect(post.alamat).toBe(`${DASAR}/fileupload_c/validatePost`);
    expect([post.badan.get("enc"), post.badan.get("enc1"), post.badan.get("from"), post.badan.get("urutan")]).toEqual([ENCM, ENCM, "mediasi", ""]);
    const f = post.badan.get("fileform");
    expect(f.name).toBe("hasil-mediasi.pdf");
    expect(f.type).toBe("application/pdf");
    // tidak ada kata aleta yang dikirim ke SIPP (alamat, isian, nama berkas)
    const kirimSipp = JSON.stringify([l.sipp.map((s) => s.alamat), (Array.from(post.badan.entries()) as Array<[string, any]>).map(([k, v]) => [k, typeof v === "string" ? v : v.name])]);
    expect(/a\W{0,3}l\W{0,3}e\W{0,3}t\W{0,3}a/i.test(kirimSipp)).toBe(false);
    // 3) jejak di portal
    const jejak = l.portal.find((p) => p.alamat.endsWith("/jejak"))!;
    expect(JSON.parse(jejak.badan)).toMatchObject({ id: "mbk-2", hasil: "berhasil", menimpa: false });
  });

  it("e-Doc di SIPP SUDAH ada: ditanya tegas menyebut namanya; 'Jangan kirim' = tidak ada tulisan ke SIPP", async () => {
    const l = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian", slotSipp: { namaLama: "PADgl_2026_PdtG_684_akta_perdamaian_1792000000.pdf" } });
    await bukaDialogY1(l);
    l.pilihFile("Akta.pdf");
    (l.dlg("label.pilihan input") as HTMLInputElement).click();
    l.tombolDlg("Lanjut")!.click();
    l.tombolDlg("Ya, unggah")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Di SIPP sudah ada e-Doc", "pertanyaan timpa");
    expect(l.dlg(".awas")!.textContent).toContain("PADgl_2026_PdtG_684_akta_perdamaian_1792000000.pdf");
    expect(l.dlg(".awas")!.textContent).toContain("tidak dapat dibatalkan");
    l.tombolDlg("Jangan kirim ke SIPP")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai", "selesai");
    expect(l.sipp.filter((s) => s.metode === "POST")).toHaveLength(0);
    expect(l.dlg(".berkas")!.textContent).toContain("di SIPP tidak diubah");
    const jejak = l.portal.find((p) => p.alamat.endsWith("/jejak"))!;
    expect(JSON.parse(jejak.badan)).toMatchObject({ hasil: "gagal" });
  });

  it("menimpa hanya sesudah 'Ya, timpa berkas di SIPP': satu kiriman, jejak menimpa=true", async () => {
    const l = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian", slotSipp: { namaLama: "lama.pdf" } });
    await bukaDialogY1(l);
    l.pilihFile("Akta.pdf");
    (l.dlg("label.pilihan input") as HTMLInputElement).click();
    l.tombolDlg("Lanjut")!.click();
    l.tombolDlg("Ya, unggah")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Di SIPP sudah ada e-Doc", "pertanyaan timpa");
    expect(l.sipp.filter((s) => s.metode === "POST")).toHaveLength(0); // belum ada tulisan sebelum persetujuan
    l.tombolDlg("Ya, timpa berkas di SIPP")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai", "selesai", 8000);
    expect(l.sipp.filter((s) => s.metode === "POST")).toHaveLength(1);
    expect(JSON.parse(l.portal.find((p) => p.alamat.endsWith("/jejak"))!.badan)).toMatchObject({ hasil: "berhasil", menimpa: true });
  });

  it("SIPP menolak atau sesi habis: tersimpan di arsip, kegagalan SIPP disebut jujur dan dicatat", async () => {
    const l = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian", validatePost: { st: 0, msg: "Error:<br /> Penyimpanan Dokumen Elektronik (E-Doc)Tidak Berhasil." } });
    await bukaDialogY1(l);
    l.pilihFile("Akta.pdf");
    (l.dlg("label.pilihan input") as HTMLInputElement).click();
    l.tombolDlg("Lanjut")!.click();
    l.tombolDlg("Ya, unggah")!.click();
    await sampai(() => l.dlg("h2")?.textContent === "Selesai dengan catatan", "selesai dengan catatan", 8000);
    expect(l.dlg(".berkas")!.textContent).toMatch(/Tersimpan di arsip perkara\. Gagal dikirim ke SIPP: Error: Penyimpanan Dokumen Elektronik/);
    expect(JSON.parse(l.portal.find((p) => p.alamat.endsWith("/jejak"))!.badan)).toMatchObject({ hasil: "gagal" });

    const l2 = lingkungan({ hasil: "Berhasil Dengan Akta Perdamaian", slotSipp: { html: "<html><body>Login</body></html>" } });
    await bukaDialogY1(l2);
    l2.pilihFile("Akta.pdf");
    (l2.dlg("label.pilihan input") as HTMLInputElement).click();
    l2.tombolDlg("Lanjut")!.click();
    l2.tombolDlg("Ya, unggah")!.click();
    await sampai(() => l2.dlg("h2")?.textContent === "Selesai dengan catatan", "catatan sesi", 8000);
    expect(l2.dlg(".berkas")!.textContent).toContain("Tersimpan di arsip perkara. Tidak dikirim ke SIPP");
    expect(l2.sipp.filter((s) => s.metode === "POST")).toHaveLength(0);
  });
});
