// @vitest-environment jsdom
/**
 * ============================================================================
 * 28 OKT 2026 - ALASAN CERAI 5227 IKUT "INPUT SEMUA YANG PASTI" BILA KETERANGAN KEDUA SAKSI SAMA
 * ============================================================================
 *
 * Keputusan pengguna: alasan cerai tetap otomatis masuk "Input semua yang pasti" asal kedua saksi keterangannya sama;
 * pilihan per alasan (centang, redaksi) tetap berfungsi; posita alasan cerai dan keterangan para saksi memberi keterangan
 * saat diarahkan tetikus dan membuka pop-up saat diklik.
 *
 * Yang dijaga (perilaku):
 *   A  aturan bersama (AletaIsiSipp.keduaSaksiSama5227) atas keluaran BOT SUNGGUHAN: dua saksi menguatkan semua alasan = sama;
 *      satu saksi / bentrok / tanpa rincian / bukan 5227 = tidak; rencanakan membawa keduaSaksi pada info 5227;
 *   B  panel ABT: s5UsulanPasti menerima 5227 yang sama (usulan saksi lain tetap ditolak seperti dulu); kartu 5227 menampilkan
 *      status, lencana dan kutipan posita/saksi berketerangan (title) dan membuka pop-up berisi posita + keterangan saksi;
 *      Esc/Tutup/klik di luar menutupnya; centang per alasan tetap menyusun ulang kalimat.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

type Apa = any;
const AKAR = path.resolve(__dirname, "../../..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const layanan = require_(path.join(AKAR, "aleta_bot/services/abtUsulanService.js")) as {
  dariKeteranganSaksi: (a: string, b: string, sidang?: string, pihak?: Apa, posita?: string, opsi?: Record<string, unknown>) => { usulan: Apa[] };
};
const CG = { pelaku: "Tergugat", lawan: "Penggugat" };
const bas = (...b: string[]) => b.map((x) => `- Bahwa ${x};`).join("\n");
const POSITA = "Bahwa Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat.\nBahwa Tergugat sering mabuk-mabukan.";
const usulan5227 = (s1: string, s2: string): Apa =>
  layanan.dariKeteranganSaksi(s1, s2, "", CG, POSITA, { rincianAlasan: true, saksiPihak: { saksi1: "penggugat", saksi2: "tergugat" } }).usulan.find((x) => x.kode === "5227");

let M: Apa;
beforeAll(() => {
  new Function(readFileSync(path.join(AKAR, "ekstensi-sipp", "isi-sipp-bersama.js"), "utf8"))();
  M = (globalThis as Apa).AletaIsiSipp;
});

describe("A. aturan bersama atas keluaran bot", () => {
  it("dua saksi menguatkan setiap alasan dari gugatan = sama", () => {
    const u = usulan5227(bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk"), bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk-mabukan"));
    expect(u.rincian.length).toBeGreaterThanOrEqual(2);
    expect(M.keduaSaksiSama5227(u)).toEqual({ sama: true, sebab: "" });
  });

  it("satu alasan hanya dikuatkan satu saksi = tidak, sebab menyebut alasannya", () => {
    const u = usulan5227(bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk"), bas("Tergugat sering mabuk-mabukan"));
    const h = M.keduaSaksiSama5227(u);
    expect(h.sama).toBe(false);
    expect(h.sebab).toMatch(/^belum dikuatkan kedua saksi: ".*" \(dikuatkan satu saksi/);
  });

  it("bentrok, tanpa rincian, bukan dari gugatan, atau bukan 5227 = tidak", () => {
    const u = usulan5227(bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk"), bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk-mabukan"));
    expect(M.keduaSaksiSama5227({ ...u, bentrok: "Tergugat rajin bekerja" })).toEqual({ sama: false, sebab: "keterangan kedua saksi berbeda" });
    expect(M.keduaSaksiSama5227({ ...u, rincian: [] }).sama).toBe(false);
    expect(M.keduaSaksiSama5227({ ...u, dariGugatan: false }).sama).toBe(false);
    expect(M.keduaSaksiSama5227({ ...u, kode: "0222" }).sama).toBe(false);
    expect(M.keduaSaksiSama5227(null).sama).toBe(false);
  });

  it("rencanakan membawa keduaSaksi pada info 5227 (dan tidak pada kode lain); 5227 tetap saran, tidak ditulis sendiri", () => {
    const u = usulan5227(bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk"), bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk-mabukan"));
    const semua = [u, { kode: "0007", nilai: "telah dikaruniai 2 orang anak", keyakinan: "cukup", sumber: [] }];
    const r = M.rencanakan(M.pilihPerKode([semua], new Set(["5227", "0007"])), [
      { kode: "5227", nama: "Alasan-Alasan Cerai", jenis: "teks", kosong: true },
      { kode: "0007", nama: "Anak", jenis: "teks", kosong: true },
    ], () => "", [semua]);
    expect(r.info["5227"].golongan).toBe("saran");
    expect(r.info["5227"].keduaSaksi).toEqual({ sama: true, sebab: "" });
    expect(r.info["0007"].keduaSaksi).toBeUndefined();
    expect(r.tulis.map((x: Apa) => x.kode)).not.toContain("5227");
  });
});

// ── B. panel ABT ───────────────────────────────────────────────────────────
const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
const potong = (awal: string, akhir: string) => {
  const a = sumber.indexOf(awal);
  return sumber.slice(a, sumber.indexOf(akhir, a));
};
const fungsi = (nama: string) => {
  const a = sumber.indexOf(`function ${nama}(`);
  return sumber.slice(a, sumber.indexOf("\n}\n", a) + 3);
};
const K = new Function(
  "document",
  "suntingLangsungSekarang",
  "penyegarSunting",
  "suntingLangsungNyala",
  "t6El",
  "t6Tombol",
  "t6TemaPanel",
  `${fungsi("buatElemen")}\n${potong("const NADA_KEYAKINAN = {", "/* === KAMUS-DB 10 Okt === */")}\n${fungsi("s5UsulanPasti")}\nreturn { kartuUsulan, s5UsulanPasti };`
)(
  document,
  async () => true,
  new Set(),
  true,
  (tag: string, kelas: string, teks?: string) => {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  },
  (teks: string, judul: string, kelas: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = teks;
    b.title = judul;
    b.className = kelas;
    return b;
  },
  () => "gelap"
) as Apa;

const sama = () => usulan5227(bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk"), bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk-mabukan"));
const beda = () => usulan5227(bas("Tergugat malas bekerja dan kurang memberi nafkah", "Tergugat sering mabuk"), bas("Tergugat sering mabuk-mabukan"));

describe("B. panel ABT: Input semua yang pasti, keterangan, pop-up", () => {
  it("s5UsulanPasti: 5227 kedua saksi sama = pasti; satu saksi = tidak; usulan saksi lain tetap seperti dulu", () => {
    expect(K.s5UsulanPasti(sama())).toBe(true);
    expect(K.s5UsulanPasti(beda())).toBe(false);
    expect(K.s5UsulanPasti({ ...sama(), nilai: "" })).toBe(false);
    expect(K.s5UsulanPasti({ kode: "0222", nilai: "x", keyakinan: "pasti", sumber: [{ saksi: 2 }] })).toBe(false);
    expect(K.s5UsulanPasti({ kode: "0222", nilai: "x", keyakinan: "ragu", tingkat: "pasti" })).toBe(true);
  });

  it("kartu: status + lencana + kutipan berketerangan; klik membuka pop-up posita & saksi; Esc menutup", () => {
    const u = sama();
    const kartu: HTMLElement = K.kartuUsulan(u, "", []);
    document.body.appendChild(kartu);
    const status = kartu.querySelector(".aleta-a5227-status") as HTMLElement;
    expect(status.textContent).toBe('Kedua saksi sama - ikut "Input semua yang pasti"');
    // lencana kepala kartu tidak lagi jatuh ke "satu saksi" (kesepakatan "gugatan" belum dikenal NADA_KESEPAKATAN)
    expect(kartu.querySelector(".aleta-abt-kartu-kepala .aleta-tanda")!.textContent).toBe("kedua saksi sama");
    expect(status.title).toMatch(/Klik untuk melihat posita alasan cerai dan keterangan para saksi/);
    const lencana = kartu.querySelector(".aleta-abt-rincian-lencana") as HTMLElement;
    expect(lencana.title).toMatch(/^.+: dikuatkan kedua saksi \(saksi Penggugat dan saksi Tergugat\)\nGugatan: "/);
    const kutipan = Array.from(kartu.querySelectorAll(".aleta-abt-kutipan.aleta-a5227-pemicu")) as HTMLElement[];
    expect(kutipan.some((k) => /^Posita alasan cerai \(acuan utama\)/.test(k.title))).toBe(true);
    expect(kutipan.some((k) => /^Keterangan saksi 1 \(penguat\)/.test(k.title))).toBe(true);

    kutipan[0].click();
    const dialog = document.querySelector(".aleta-a5227-dialog") as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("role")).toBe("dialog");
    const teks = dialog.textContent || "";
    expect(teks).toContain("Posita alasan cerai (gugatan - acuan utama)");
    expect(teks).toContain("Keterangan para saksi (penguat)");
    expect(teks).toContain("Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat");
    expect(teks).toContain('ikut "Input semua yang pasti"');
    expect(teks).not.toMatch(/aleta/i);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".aleta-a5227-dialog")).toBeNull();

    // Tombol Tutup dan klik di luar kotak juga menutup.
    lencana.click();
    (document.querySelector(".aleta-a5227-dialog .aleta-t6-dialog-tidak") as HTMLButtonElement).click();
    expect(document.querySelector(".aleta-a5227-dialog")).toBeNull();
    status.click();
    (document.querySelector(".aleta-a5227-tirai") as HTMLElement).click();
    expect(document.querySelector(".aleta-a5227-tirai")).toBeNull();
    kartu.remove();
  });

  it("kartu satu saksi: status menyebut dicentang manual dan sebabnya; pop-up menyebut belum ikut", () => {
    const kartu: HTMLElement = K.kartuUsulan(beda(), "", []);
    document.body.appendChild(kartu);
    const status = kartu.querySelector(".aleta-a5227-status") as HTMLElement;
    expect(status.textContent).toBe("Dicentang manual - keterangan kedua saksi belum sama untuk semua alasan");
    expect(kartu.querySelector(".aleta-abt-kartu-kepala .aleta-tanda")!.textContent).toBe("dari gugatan — periksa");
    expect(status.title).toMatch(/^Sebab: belum dikuatkan kedua saksi: /);
    status.click();
    expect(document.querySelector(".aleta-a5227-dialog")!.textContent).toMatch(/Belum ikut "Input semua yang pasti" \(belum dikuatkan kedua saksi/);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    kartu.remove();
  });

  it("centang per alasan tetap menyusun ulang kalimat; klik lencana tidak mengubah centang", () => {
    const pilih: Apa[] = [];
    const kartu: HTMLElement = K.kartuUsulan(sama(), "", pilih);
    document.body.appendChild(kartu);
    const awal = pilih[0].nilai();
    const kotak = kartu.querySelectorAll(".aleta-abt-rincian-baris input[type=checkbox]") as NodeListOf<HTMLInputElement>;
    expect(kotak.length).toBeGreaterThanOrEqual(2);
    (kartu.querySelector(".aleta-abt-rincian-lencana") as HTMLElement).click();
    expect(kotak[0].checked).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    kotak[1].checked = false;
    kotak[1].dispatchEvent(new Event("change"));
    expect(pilih[0].nilai()).not.toBe(awal);
    expect(pilih[0].nilai()).not.toContain(" serta ");
    // 28 Okt: tanpa titik koma di antara rincian - "A serta B"
    expect(awal).toContain(" serta ");
    expect(awal).not.toContain(";");
    kartu.remove();
  });
});
