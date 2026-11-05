// @vitest-environment jsdom
/**
 * Beda dengan ABT (5 Nov 2026, Tahap 9) - layar:
 *   - jumlah yang menunggu dan umur terlama tampil di bagian atas (tidak menumpuk tanpa terbaca), juga di kartu halaman ALETA ABT;
 *   - lihat beda memakai pembanding Tahap 3; pilihan ambil dari ABT / tetap pakai ALETA ABT meminta persetujuan dan mengirim sidik yang dilihat;
 *   - ekspor: yang siap dan yang belum (dengan sebab); unduhan hanya berkas;
 *   - jadwal: bawaan mati, galat server tampil; bahasa Indonesia tanpa label teknis.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BedaDenganAbt } from "@/components/portal/beda-dengan-abt";
import { JadwalSinkronAbt, KartuBedaAbt } from "@/components/portal/sinkron-abt-kartu";

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
const galat = (pesan: string, status = 422) => new Response(JSON.stringify({ ok: false, error: { message: pesan } }), { status, headers: { "content-type": "application/json" } });

const SETELAN = { jadwal: false, jam: "23:00", izinJamKerja: false, diubahOleh: "", diubahPada: "" };
const RINGKAS = (lain: Record<string, unknown> = {}) => ({
  menunggu: 2,
  tertuaHari: 9,
  hilang: 1,
  ubahan: 1,
  setelan: SETELAN,
  putaranTerakhir: { status: "berhasil", pada: "2026-11-05T15:00:00.000Z", galat: "" },
  sedangJalan: false,
  daftar: [
    { id: "1 Cerai/[01] Kabul.rtf", nama: "[01] Kabul", folder: "1 Cerai", folderLabel: "Cerai Gugat", ukuranAleta: 51200, ukuranAbt: 52224, sejak: "2026-10-27T10:00:00.000Z", hari: 9 },
    { id: "1 Cerai/[02] Tolak.rtf", nama: "[02] Tolak", folder: "1 Cerai", folderLabel: "Cerai Gugat", ukuranAleta: 1000, ukuranAbt: 0, sejak: "2026-11-04T10:00:00.000Z", hari: 1 },
  ],
  daftarHilang: [{ id: "2 Itsbat/[09] Lama.rtf", nama: "[09] Lama", folder: "2 Itsbat", folderLabel: "Itsbat Nikah", sejak: "2026-11-03T10:00:00.000Z" }],
  ...lain,
});
const EKSPOR = {
  siap: [{ id: "3 Lain/[05] Siap.rtf", nama: "[05] Siap", folder: "3 Lain", potongan: 2, ukuranBaru: 900 }],
  tidakSiap: [{ id: "x", nama: "[07] Menyebut", folder: "3 Lain", sebab: "Isinya memuat nama aplikasi. Hapus kata itu di penyunting, terbitkan, lalu coba lagi." }],
};
const BEDA = (lain: Record<string, unknown> = {}) => ({
  id: "1 Cerai/[01] Kabul.rtf",
  nama: "[01] Kabul",
  folder: "1 Cerai",
  md5Aleta: "aaa111",
  md5Abt: "bbb222",
  ukuranAleta: 51200,
  ukuranAbt: 52224,
  sejak: "2026-10-27T10:00:00.000Z",
  adaDraf: false,
  dapatDiambil: true,
  sebabTanpaBeda: "",
  beda: {
    a: { nomor: 0, md5: "aaa111", ukuran: 51200 },
    b: { nomor: 0, md5: "bbb222", ukuran: 52224 },
    samaBita: false,
    samaTeks: false,
    kepalaKakiBeda: false,
    ringkas: { ubah: 1, tambah: 1, hapus: 0 },
    baris: [
      { k: "ubah", a: [{ t: "dan", d: "hapus" }], b: [{ t: "serta", d: "tambah" }] },
      { k: "tambah", b: [{ t: "Kalimat baru di ABT", d: "tambah" }] },
      { k: "lipat", n: 4 },
    ],
    terpotong: false,
  },
  ...lain,
});

function stub(peta: Record<string, (init?: RequestInit) => Response>) {
  const f = vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u);
    // kunci "bagian=..." yang cocok menang atas alamat umum
    const kunci = Object.keys(peta)
      .filter((k) => url.includes(k))
      .sort((a, b) => Number(b.includes("=")) - Number(a.includes("=")) || b.length - a.length)[0];
    return kunci ? peta[kunci](init) : galat("tidak ada", 404);
  });
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("layar Beda dengan ABT", () => {
  it("jumlah yang menunggu dan umur terlama tampil, dengan peringatan bila lebih dari seminggu; yang hilang dan yang siap dikirim tertera", async () => {
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS()), "bagian=ekspor-daftar": () => ok(EKSPOR) });
    render(<BedaDenganAbt />);
    expect(await screen.findByText("blangko menunggu Anda tinjau", { exact: false })).toBeTruthy();
    expect(screen.getByText("Yang paling lama sudah 9 hari.", { exact: false })).toBeTruthy();
    expect(screen.getByText("Sudah lebih dari seminggu ada yang belum dipilih. Tinjau agar tidak menumpuk.")).toBeTruthy();
    expect(screen.getByText("[01] Kabul")).toBeTruthy();
    expect(screen.getByText("[09] Lama")).toBeTruthy();
    expect(screen.getByText("Tidak ada lagi di ABT (1)")).toBeTruthy();
    expect(screen.getByText("[05] Siap")).toBeTruthy();
    expect(screen.getByText("2 bagian berubah")).toBeTruthy();
    expect(screen.getByText(/memuat nama aplikasi/)).toBeTruthy();
    const unduh = screen.getByRole("link", { name: /Unduh paket \(1 blangko\)/ });
    expect(unduh.getAttribute("href")).toContain("/api/aleta-abt/sinkron?bagian=ekspor");
    expect(unduh.hasAttribute("download")).toBe(true);
    expect(screen.getByText("Sinkron otomatis dari ABT:", { exact: false }).textContent).toContain("mati");
  });

  it("tidak ada yang menunggu: pesan tenang, tanpa daftar", async () => {
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS({ menunggu: 0, tertuaHari: 0, daftar: [], daftarHilang: [], hilang: 0 })), "bagian=ekspor-daftar": () => ok({ siap: [], tidakSiap: [] }) });
    render(<BedaDenganAbt />);
    expect(await screen.findByText("Tidak ada blangko yang menunggu ditinjau.")).toBeTruthy();
    expect(screen.queryByText(/Menunggu ditinjau \(/)).toBeNull();
    expect(screen.getByText("Belum ada ubahan yang siap dikirim.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Unduh paket" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lihat beda: isi ALETA ABT melawan isi ABT dengan kata biasa; tetap pakai ALETA ABT meminta persetujuan lalu mengirim sidik yang dilihat", async () => {
    let badanPost: Record<string, unknown> | null = null;
    const f = stub({
      "/api/aleta-abt/sinkron": (init) => {
        if (init?.method === "POST") {
          badanPost = JSON.parse(String(init.body));
          return ok({ id: "x", pilihan: "tetap", nomor: 0 });
        }
        return ok(RINGKAS());
      },
      "bagian=ekspor-daftar": () => ok(EKSPOR),
      "bagian=beda": () => ok(BEDA()),
    });
    render(<BedaDenganAbt />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Lihat beda" }))[0]);
    expect(await screen.findByText("Hanya di ABT")).toBeTruthy();
    expect(screen.getByText("Di ALETA ABT")).toBeTruthy();
    expect(screen.getByText("dan").tagName).toBe("DEL");
    expect(screen.getByText("serta").tagName).toBe("INS");
    expect(screen.getByText("1 paragraf berubah, 1 hanya ada di ABT, 0 hanya ada di ALETA ABT.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tetap pakai ALETA ABT" }));
    expect(screen.getByText(/Beda ini hilang dari daftar sampai ABT berubah lagi/)).toBeTruthy();
    expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Ya, tetap pakai ALETA ABT" }));
    await screen.findByText(/tetap memakai isi ALETA ABT/);
    expect(badanPost).toEqual({ tindakan: "putuskan", id: "1 Cerai/[01] Kabul.rtf", pilihan: "tetap", md5Abt: "bbb222", md5Aleta: "aaa111" });
  });

  it("ambil dari ABT: persetujuan menyebut versi lama tersimpan; batal tidak mengirim apa pun; tanpa isi ABT tersimpan tombol ambil mati", async () => {
    const f = stub({
      "/api/aleta-abt/sinkron": () => ok(RINGKAS()),
      "bagian=ekspor-daftar": () => ok(EKSPOR),
      "bagian=beda": () => ok(BEDA({ dapatDiambil: false, beda: null, sebabTanpaBeda: "Isi ABT yang terbaru belum tersimpan. Jalankan Sinkron dari ABT sekali lagi.", ukuranAbt: 0 })),
    });
    render(<BedaDenganAbt />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Lihat beda" }))[0]);
    expect(await screen.findByText(/Jalankan Sinkron dari ABT sekali lagi/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ambil dari ABT" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Tetap pakai ALETA ABT" }) as HTMLButtonElement).disabled).toBe(false);
    expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("ambil dari ABT yang diminta: teks persetujuan jelas dan Batal menutupnya", async () => {
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS()), "bagian=ekspor-daftar": () => ok(EKSPOR), "bagian=beda": () => ok(BEDA({ adaDraf: true })) });
    render(<BedaDenganAbt />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Lihat beda" }))[0]);
    expect(await screen.findByText(/suntingan yang belum diterbitkan/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ambil dari ABT" }));
    expect(screen.getByText(/isi yang lama tersimpan sebagai versi sebelumnya dan dapat dikembalikan di penyunting/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByText(/Lanjutkan\?/)).toBeNull();
  });

  it("galat server tampil sebagai pesan; bahasa tanpa label teknis", async () => {
    stub({ "/api/aleta-abt/sinkron": () => galat("Beda dengan ABT hanya untuk Super Admin.", 403) });
    const a = render(<BedaDenganAbt />);
    expect((await screen.findByRole("alert")).textContent).toBe("Beda dengan ABT hanya untuk Super Admin.");
    a.unmount();
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS()), "bagian=ekspor-daftar": () => ok(EKSPOR), "bagian=beda": () => ok(BEDA()) });
    render(<BedaDenganAbt />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Lihat beda" }))[0]);
    await screen.findByText("Hanya di ABT");
    expect(document.body.textContent).not.toMatch(/md5|bentrok|sidik|\bRTF\b|\bJSON\b|undefined|null/i);
  });

  it("layar tidak punya lebar tetap: teks panjang dapat dipatah (tanpa geser mendatar di HP)", async () => {
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS()), "bagian=ekspor-daftar": () => ok(EKSPOR) });
    const { container } = render(<BedaDenganAbt />);
    await screen.findByText("[01] Kabul");
    expect(container.innerHTML).not.toMatch(/ min-w-\[|[ :]w-\[\d{3,}px\]|[ :]max-w-\[\d{3,}px\]/);
    // Semua baris teks daftar boleh dipatah; hanya tombol bawaan yang tidak patah (labelnya pendek).
    for (const p of Array.from(container.querySelectorAll("li p, li span.block"))) expect(p.className).toMatch(/break-words/);
    expect(container.querySelector("p.break-words")).toBeTruthy();
  });
});

describe("kartu di halaman ALETA ABT dan jadwal di Pustaka blangko", () => {
  it("kartu menampilkan jumlah menunggu dan umur terlama; galat tampil", async () => {
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS()) });
    const a = render(<KartuBedaAbt />);
    expect(await screen.findByText("2 blangko menunggu Anda tinjau, yang terlama sudah 9 hari.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buka Beda dengan ABT" }).getAttribute("href")).toBe("/aleta-abt/beda");
    a.unmount();
    stub({ "/api/aleta-abt/sinkron": () => ok(RINGKAS({ menunggu: 0, tertuaHari: 0, daftar: [] })) });
    render(<KartuBedaAbt />);
    expect(await screen.findByText("Tidak ada blangko yang menunggu ditinjau.")).toBeTruthy();
  });

  it("jadwal: bawaan mati; menyalakan mengirim setelan; jam kerja ditolak server tampil sebagai pesan", async () => {
    const badan: Array<Record<string, unknown>> = [];
    stub({
      "/api/aleta-abt/sinkron": (init) => {
        if (init?.method === "POST") {
          const b = JSON.parse(String(init.body)) as Record<string, unknown>;
          badan.push(b);
          if (b.jam === "09:00") return galat("Jam 09:00 jatuh di jam kerja sidang (07:00-17:00 WITA). Pilih jam malam, atau centang izin berjalan pada jam kerja.");
          return ok({ ...SETELAN, jadwal: b.jadwal === true, jam: String(b.jam ?? "23:00") });
        }
        return ok(SETELAN);
      },
    });
    render(<JadwalSinkronAbt />);
    expect(await screen.findByText(/Mati\. Sinkron hanya berjalan bila tombol di atas ditekan\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nyalakan" }));
    expect(await screen.findByText("Sinkron otomatis menyala: sekali sehari sesudah 23:00 WITA.")).toBeTruthy();
    expect(badan[0]).toEqual({ tindakan: "setelan", jadwal: true });
    fireEvent.change(screen.getByLabelText("Jam mulai (WITA)"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan jam" }));
    expect(await screen.findByText(/jatuh di jam kerja sidang/)).toBeTruthy();
    expect(screen.getByText(/Bawaan tidak, supaya sidang tidak terganggu/)).toBeTruthy();
  });
});
