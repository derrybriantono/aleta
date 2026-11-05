// @vitest-environment jsdom
/**
 * Penyunting blangko ALETA ABT (5 Nov 2026, Tahap 3) - layar:
 *   - dokumen yang bisa diketik: isian tampil sebagai tanda bernama (nomor tak terlihat), kotak/tabel/paragraf huruf khusus terkunci;
 *   - suntingan, Enter (pisah paragraf), hapus paragraf, sisip isian menghasilkan teks yang benar untuk server;
 *   - layar: daftar, buka, simpan, terbit, riwayat, beda, coba rekaan; bahasa Indonesia tanpa label teknis.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PenyuntingBlangko } from "@/components/portal/penyunting-blangko";
import { pasangPenyunting, teksAsalParagraf, teksDariSimpul } from "@/lib/aleta-abt-penyunting-dom";
import type { BlangkoBuka, ParagrafLayar } from "@/lib/aleta-abt-penyunting-tipe";

const ISIAN = { "0098": { nama: "Nama Penggugat", bersyarat: false }, "0102": { nama: "Nama Tergugat", bersyarat: true } };

const P: ParagrafLayar[] = [
  { i: 0, bagian: [{ j: "teks", t: "PUTUSAN", g: 1 }], rata: "tengah", li: 0, fi: 0, tabel: false, awalan: "", terkunci: "" },
  {
    i: 1,
    bagian: [
      { j: "teks", t: "Antara ", g: 0 },
      { j: "isian", no: "0098", r: "098", g: 0 },
      { j: "teks", t: " melawan ", g: 0 },
      { j: "isian", no: "0102", r: "0102", g: 0 },
    ],
    rata: "rata",
    li: 0,
    fi: 0,
    tabel: false,
    awalan: "",
    terkunci: "",
  },
  { i: 2, bagian: [{ j: "teks", t: "Sel satu", g: 0 }], rata: "kiri", li: 0, fi: 0, tabel: true, awalan: "", terkunci: "" },
  {
    i: 3,
    bagian: [
      { j: "teks", t: "Kotak ", g: 0 },
      { j: "kotak", label: "Gambar", jenis: "gambar" },
      { j: "teks", t: " sesudah.", g: 0 },
    ],
    rata: "kiri",
    li: 0,
    fi: 0,
    tabel: false,
    awalan: "",
    terkunci: "",
  },
  { i: 4, bagian: [{ j: "teks", t: "ال", g: 0 }], rata: "kiri", li: 0, fi: 0, tabel: false, awalan: "", terkunci: "Berisi huruf yang dikodekan khusus." },
  { i: 5, bagian: [{ j: "teks", t: "Butir", g: 0 }], rata: "kiri", li: 720, fi: 0, tabel: false, awalan: "1.", terkunci: "" },
];

function pasang(dapat = true) {
  const akar = document.createElement("div");
  document.body.appendChild(akar);
  const diubah: number[] = [];
  const p = pasangPenyunting(akar, P, { dapatDisunting: dapat, isian: ISIAN, saatUbah: (n) => diubah.push(n) });
  return { akar, p, diubah };
}

const blok = (akar: HTMLElement, i: number) => akar.querySelector<HTMLElement>(`[data-i="${i}"] [data-blok]`) as HTMLElement;
function ketik(akar: HTMLElement, i: number, fn: (teks: string) => string) {
  const b = blok(akar, i);
  const teks = b.querySelector("span:not([data-no]):not([data-kotak])") as HTMLElement;
  teks.textContent = fn(teks.textContent ?? "");
  b.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("dokumen yang bisa diketik", () => {
  it("isian tampil dengan nama (tanpa nomor), kotak dan paragraf huruf khusus terkunci, tabel bertanda", () => {
    const { akar } = pasang();
    expect(akar.textContent).toContain("Nama Penggugat");
    expect(akar.textContent).toContain("Nama Tergugat");
    expect(akar.textContent).not.toMatch(/#|0098|0102/);
    expect(akar.textContent).toContain("Terkunci: Gambar");
    expect(akar.textContent).toContain("Sel tabel");
    expect(akar.textContent).toContain("Terkunci: Berisi huruf yang dikodekan khusus.");
    expect(blok(akar, 0).getAttribute("contenteditable")).toBe("true");
    expect(blok(akar, 4).getAttribute("contenteditable")).toBe("false");
    expect(akar.querySelectorAll("[data-kotak]")[0].getAttribute("contenteditable")).toBe("false");
    expect(akar.textContent).toContain("1.");
    // Tombol hapus hanya untuk paragraf biasa tanpa kotak/tabel/kunci.
    const punyaHapus = [...akar.querySelectorAll<HTMLElement>("[data-i]")].filter((g) => g.querySelector("[data-hapus]")).map((g) => Number(g.dataset.i));
    expect(punyaHapus).toEqual([0, 1, 5]);
  });

  it("tanpa perubahan tidak ada yang dikirim; isian dikirim kembali sebagai #NNNN# seperti tertulis semula", () => {
    const { akar, p } = pasang();
    expect(p.ambil()).toEqual({ suntingan: [], hapus: [] });
    expect(teksAsalParagraf(P[1].bagian)).toBe("Antara #098# melawan #0102#");
    expect(teksDariSimpul(blok(akar, 1))).toBe("Antara #098# melawan #0102#");
  });

  it("mengetik di satu paragraf = satu suntingan; mengembalikan teks asal membatalkan suntingan", () => {
    const { akar, p, diubah } = pasang();
    ketik(akar, 1, (t) => t.replace("Antara", "Perkara antara"));
    expect(p.jumlahUbah()).toBe(1);
    expect(diubah.at(-1)).toBe(1);
    expect(p.ambil().suntingan).toEqual([{ i: 1, teks: "Perkara antara #098# melawan #0102#" }]);
    ketik(akar, 1, () => "Antara ");
    expect(p.jumlahUbah()).toBe(0);
    expect(p.ambil().suntingan).toEqual([]);
  });

  it("Enter memisah paragraf (U+2029); Shift+Enter menyisipkan baris baru; Enter di tabel diabaikan", () => {
    const { akar, p } = pasang();
    const b = blok(akar, 0);
    const teks = b.firstChild!.firstChild as Text;
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.setStart(teks, 3);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    b.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(akar.querySelectorAll('[data-i="0"] [data-blok]')).toHaveLength(2);
    // Paragraf hasil Enter ada dalam satu kolom di bawah paragraf asal, bukan di sampingnya (terlihat saat dicoba di peramban).
    const dua = [...akar.querySelectorAll<HTMLElement>('[data-i="0"] [data-blok]')];
    expect(dua[0].parentElement).toBe(dua[1].parentElement);
    expect(dua[0].parentElement?.hasAttribute("data-kolom")).toBe(true);
    expect(p.ambil().suntingan).toEqual([{ i: 0, teks: "PUT USAN" }]);
    const t = blok(akar, 2);
    t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(akar.querySelectorAll('[data-i="2"] [data-blok]')).toHaveLength(1);
  });

  it("hapus paragraf dapat dibatalkan; paragraf yang dihapus tidak ikut sebagai suntingan", () => {
    const { akar, p } = pasang();
    ketik(akar, 5, (t) => `${t} baru`);
    const tombol = akar.querySelector<HTMLElement>('[data-i="5"] [data-hapus]')!;
    tombol.click();
    expect(p.ambil()).toEqual({ suntingan: [], hapus: [5] });
    expect(tombol.textContent).toBe("Batalkan hapus");
    tombol.click();
    expect(p.ambil().hapus).toEqual([]);
  });

  it("sisip isian: tanda bernama masuk di kursor terakhir dan terkirim sebagai #NNNN#; tanpa kursor ditolak", () => {
    const { akar, p } = pasang();
    expect(p.sisipIsian("0098")).toBe(false);
    const b = blok(akar, 0);
    const teks = b.firstChild!.firstChild as Text;
    const r = document.createRange();
    r.setStart(teks, 7);
    r.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(r);
    b.dispatchEvent(new Event("mouseup", { bubbles: true }));
    expect(p.sisipIsian("0102")).toBe(true);
    expect(b.textContent).toContain("Nama Tergugat");
    expect(p.ambil().suntingan).toEqual([{ i: 0, teks: "PUTUSAN#0102#" }]);
  });

  it("dokumen tidak dapat disunting: semua blok terkunci dan tanpa tombol hapus", () => {
    const { akar } = pasang(false);
    expect(akar.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
    expect(akar.querySelectorAll("[data-hapus]")).toHaveLength(0);
  });
});

// ─── layar ──────────────────────────────────────────────────────────────────────────────────────────────────────
const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const galat = (pesan: string, status = 422) => new Response(JSON.stringify({ ok: false, error: { message: pesan } }), { status });

const VERSI = (nomor: number, status: "draf" | "terbit" | "lama", lain = {}) => ({
  nomor,
  jenis: nomor === 1 ? "asal" : "sunting",
  status,
  dariNomor: nomor - 1,
  catatan: "",
  ringkas: "",
  dibuatNama: "Derry",
  dibuatAt: "2026-11-05T10:00:00.000Z",
  terbitNama: "",
  terbitAt: "",
  ukuran: 100,
  md5: "x",
  ...lain,
});

const BUKA = (nomor: number, status: "draf" | "terbit" | "lama", terakhir = nomor, terbit = 1): BlangkoBuka => ({
  id: "1 Cerai/[01] Kabul.rtf",
  nama: "[01] Kabul",
  folder: "1 Cerai",
  versi: VERSI(nomor, status) as BlangkoBuka["versi"],
  terakhir,
  terbit,
  dapatDisunting: true,
  sebabTerkunci: "",
  paragraf: P,
  tetap: [{ jenis: "kepala", baris: [[{ j: "teks", t: "Kop surat", g: 0 }]] }],
  isian: ISIAN,
  jumlahTerkunci: 1,
  belumDisimpan: false,
});

const DAFTAR = {
  folder: [
    {
      folder: "1 Cerai",
      label: "Cerai Gugat",
      blangko: [
        { id: "1 Cerai/[01] Kabul.rtf", nama: "[01] Kabul", rtf: true, arsip: false, hilang: false, ukuran: 100, disunting: true, versi: 3, terbit: 1, adaDraf: true },
        { id: "1 Cerai/[02] Tolak.rtf", nama: "[02] Tolak", rtf: true, arsip: false, hilang: false, ukuran: 100, disunting: false, versi: 1, terbit: 1, adaDraf: false },
      ],
    },
  ],
  jumlah: 2,
  tersalin: true,
};

function stub(peta: Record<string, (init?: RequestInit) => Response>) {
  const f = vi.fn(async (alamat: string, init?: RequestInit) => {
    const u = String(alamat);
    for (const [kunci, fn] of Object.entries(peta)) if (u.includes(kunci)) return fn(init);
    return galat("tidak ada", 404);
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("layar penyunting", () => {
  it("daftar: folder berlabel, blangko yang disunting dan yang belum terbit bertanda; pencarian menyaring", async () => {
    stub({ "/api/aleta-abt/penyunting": () => ok(DAFTAR) });
    render(<PenyuntingBlangko />);
    const folder = await screen.findByRole("button", { name: /Cerai Gugat/ });
    fireEvent.click(folder);
    expect(await screen.findByText("[01] Kabul")).toBeTruthy();
    expect(screen.getByText("Belum terbit")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Cari blangko"), { target: { value: "tolak" } });
    expect(screen.queryByText("[01] Kabul")).toBeNull();
    expect(screen.getByText("[02] Tolak")).toBeTruthy();
  });

  it("pustaka kosong: menunjuk ke Pustaka blangko; ditolak server: pesannya tampil", async () => {
    stub({ "/api/aleta-abt/penyunting": () => ok({ folder: [], jumlah: 0, tersalin: false }) });
    const a = render(<PenyuntingBlangko />);
    expect(await screen.findByText("Pustaka blangko masih kosong")).toBeTruthy();
    a.unmount();
    stub({ "/api/aleta-abt/penyunting": () => galat("Penyunting blangko ALETA ABT hanya untuk Super Admin.", 403) });
    render(<PenyuntingBlangko />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Penyunting blangko ALETA ABT hanya untuk Super Admin.");
  });

  it("buka blangko: versi dan status tampil, kepala halaman terkunci, simpan menunggu perubahan; simpan memanggil rute dengan dasar versi", async () => {
    let sudahSimpan = false;
    const f = stub({
      "bagian=blangko": () => ok(sudahSimpan ? BUKA(4, "draf", 4, 1) : BUKA(3, "draf", 3, 1)),
      "/api/aleta-abt/penyunting": (init) => {
        if (init?.method === "POST") {
          sudahSimpan = true;
          return ok({ nomor: 4, md5: "m", ukuran: 10, ringkas: "1 paragraf diubah", diubah: 1, dihapus: 0, dipecah: 0 });
        }
        return ok(DAFTAR);
      },
    });
    render(<PenyuntingBlangko />);
    fireEvent.click(await screen.findByRole("button", { name: /Cerai Gugat/ }));
    fireEvent.click(await screen.findByText("[01] Kabul"));
    expect(await screen.findByText("Versi 3")).toBeTruthy();
    expect(screen.getByText("Belum terbit")).toBeTruthy();
    expect(screen.getByText("Kepala halaman (terkunci)")).toBeTruthy();
    expect(screen.getByText("Kop surat")).toBeTruthy();
    const simpan = screen.getByRole("button", { name: /Simpan sebagai versi baru/ }) as HTMLButtonElement;
    expect(simpan.disabled).toBe(true);
    // Ketik di paragraf 1 lewat DOM yang dipasang komponen.
    const b = document.querySelector<HTMLElement>('[data-i="1"] [data-blok]')!;
    const teks = b.querySelector("span:not([data-no]):not([data-kotak])") as HTMLElement;
    teks.textContent = "Perkara antara ";
    act(() => {
      b.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() => expect((screen.getByRole("button", { name: /Simpan sebagai versi baru \(1 paragraf\)/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Catatan versi"), { target: { value: "ganti kata" } });
    fireEvent.click(screen.getByRole("button", { name: /Simpan sebagai versi baru \(1 paragraf\)/ }));
    await screen.findByText(/Tersimpan sebagai versi 4 \(1 paragraf diubah\)/);
    const kirim = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((kirim[1] as RequestInit).body))).toMatchObject({
      tindakan: "simpan",
      id: "1 Cerai/[01] Kabul.rtf",
      dasarNomor: 3,
      catatan: "ganti kata",
      suntingan: [{ i: 1, teks: "Perkara antara #098# melawan #0102#" }],
      hapus: [],
    });
  });

  it("terbit meminta persetujuan dan menyebut panel ABT belum berubah; ditolak bila dibatalkan", async () => {
    const f = stub({
      "bagian=blangko": () => ok(BUKA(3, "draf", 3, 1)),
      "/api/aleta-abt/penyunting": (init) => (init?.method === "POST" ? ok({ nomor: 3, md5: "m" }) : ok(DAFTAR)),
    });
    const yakin = vi.fn(() => false);
    vi.stubGlobal("confirm", yakin);
    render(<PenyuntingBlangko />);
    fireEvent.click(await screen.findByRole("button", { name: /Cerai Gugat/ }));
    fireEvent.click(await screen.findByText("[01] Kabul"));
    const tombol = await screen.findByRole("button", { name: "Terbitkan versi 3" });
    fireEvent.click(tombol);
    expect(yakin).toHaveBeenCalledTimes(1);
    expect((yakin.mock.calls[0] as unknown as string[])[0]).toMatch(/Panel Blangko ABT by Derry Briantono masih memakai ABT/);
    expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
    yakin.mockReturnValue(true);
    fireEvent.click(tombol);
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(true));
    await screen.findByText("Versi 3 sudah terbit.");
  });

  it("versi lama hanya dibaca dan bisa dikembalikan; riwayat memuat tombol pulihkan dan bandingkan", async () => {
    const yakin = vi.fn(() => true);
    vi.stubGlobal("confirm", yakin);
    stub({
      "bagian=riwayat": () => ok({ id: "x", nama: "[01] Kabul", belumDisimpan: false, versi: [VERSI(3, "draf"), VERSI(2, "terbit"), VERSI(1, "lama")] }),
      "bagian=beda": () =>
        ok({
          a: { nomor: 1, md5: "a", ukuran: 1 },
          b: { nomor: 3, md5: "b", ukuran: 1 },
          samaBita: false,
          samaTeks: false,
          kepalaKakiBeda: false,
          ringkas: { ubah: 1, tambah: 0, hapus: 0 },
          baris: [{ k: "ubah", a: [{ t: "melawan", d: "hapus" }], b: [{ t: "dan", d: "tambah" }] }, { k: "lipat", n: 5 }],
          terpotong: false,
        }),
      "bagian=blangko": () => ok(BUKA(3, "draf", 3, 2)),
      "/api/aleta-abt/penyunting": () => ok(DAFTAR),
    });
    render(<PenyuntingBlangko />);
    fireEvent.click(await screen.findByRole("button", { name: /Cerai Gugat/ }));
    fireEvent.click(await screen.findByText("[01] Kabul"));
    fireEvent.click(await screen.findByRole("button", { name: "Riwayat versi" }));
    expect(await screen.findByText("Salinan dari ABT")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Kembalikan" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Bandingkan dengan terkini" })[1]);
    expect(await screen.findByText("Beda versi 1 dengan versi 3")).toBeTruthy();
    expect(screen.getByText("melawan").tagName).toBe("DEL");
    expect(screen.getByText("dan").tagName).toBe("INS");
    expect(screen.getByText("5 paragraf tidak berubah")).toBeTruthy();
  });

  it("tidak ada label teknis di layar (nomor isian, kode ALETA ABT, md5, RTF)", async () => {
    stub({
      "bagian=blangko": () => ok(BUKA(3, "draf", 3, 1)),
      "/api/aleta-abt/penyunting": () => ok(DAFTAR),
    });
    const { container } = render(<PenyuntingBlangko />);
    fireEvent.click(await screen.findByRole("button", { name: /Cerai Gugat/ }));
    fireEvent.click(await screen.findByText("[01] Kabul"));
    await screen.findByText("Versi 3");
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/#\d{3,5}#|AA\d{5}|md5|\bRTF\b|\bDB\b|payload/i);
  });
});
