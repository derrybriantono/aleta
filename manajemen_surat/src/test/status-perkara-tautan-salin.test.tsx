/**
 * ============================================================================
 * BUKA SIPP, SALIN TAUTAN, SALIN RINGKASAN - DIGAMBAR DAN DIKLIK
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026, butir 3, 4, 5:
 *
 *   - "Buka SIPP" ke halaman PERKARANYA di SIPP, di tab baru
 *   - "Salin tautan" menyalin alamat halaman perkara di SIPP
 *   - "Salin ringkasan" menyalin ringkasan yang lengkap
 *
 * Alamatnya disusun rute portal GET /api/aleta-ecourt/sipp-tautan. Di sini
 * rute itu DITIRUKAN lewat fetch palsu, menurut kontraknya: 200 { ok: true,
 * data: { alamat, alasan } } - alamat mutlak, atau "" beserta alasan. Tiga
 * keadaan dijalankan: alamat ada, alamat kosong beserta alasan, dan gagal.
 *
 * Papan klip juga ditirukan dua keadaan: konteks aman (navigator.clipboard
 * ada) dan peladen satker http://192.168.10.10 (tidak ada sama sekali) - yang
 * terakhir tidak pernah terlihat pada uji lewat localhost.
 *
 * Nama orang dan nomor perkara di sini karangan.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlatStatusPerkara } from "@/components/portal/alat-status-perkara";
import { withBasePath } from "@/lib/base-path";
import { ringkasStatus, type BahanRingkas } from "@/lib/ringkas-status";
import type { BahanRingkasanSalin } from "@/lib/ringkasan-salin";
import { salinLewatTextarea, salinTeks } from "@/lib/salin-teks";
import { alamatSippSah, mintaTautanSipp, RUTE_TAUTAN_SIPP } from "@/lib/tautan-sipp";

const ALAMAT_SIPP = "http://192.168.10.10/SIPP/perkara_detil_agama/UVVKRA==";
const NOMOR = "123/Pdt.G/2026/PA.Dgl";

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

// ===========================================================================
// PERMINTAAN ALAMAT
// ===========================================================================

describe("mintaTautanSipp - atas kontrak rute sipp-tautan", () => {
  it("alamat ada: dipakai apa adanya, dan permintaannya membawa perkaraId dan nomor", async () => {
    const ambil = vi.fn(async () => jawabanJson({ ok: true, data: { alamat: ALAMAT_SIPP, alasan: "" } }));
    const hasil = await mintaTautanSipp({ perkaraId: "10049", nomorPerkara: NOMOR, ambil });

    expect(hasil).toEqual({ keadaan: "ada", alamat: ALAMAT_SIPP });
    expect(ambil).toHaveBeenCalledTimes(1);
    const [alamat, init] = ambil.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(alamat, "http://portal.contoh");
    expect(url.pathname.endsWith(RUTE_TAUTAN_SIPP)).toBe(true);
    expect(url.searchParams.get("perkaraId")).toBe("10049");
    expect(url.searchParams.get("nomor")).toBe(NOMOR);
    expect(init.cache).toBe("no-store");
  });

  it("alamat kosong beserta alasan: alasannya diteruskan kepada petugas", async () => {
    const ambil = vi.fn(async () =>
      jawabanJson({ ok: true, data: { alamat: "", alasan: "Kunci SIPP belum terbaca di peladen." } })
    );
    expect(await mintaTautanSipp({ perkaraId: "10049", nomorPerkara: NOMOR, ambil })).toEqual({
      keadaan: "tidak-ada",
      alasan: "Kunci SIPP belum terbaca di peladen.",
    });
  });

  it("gagal jaringan: kalimat untuk petugas, tidak melempar", async () => {
    const ambil = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const hasil = await mintaTautanSipp({ perkaraId: "10049", nomorPerkara: NOMOR, ambil });
    expect(hasil.keadaan).toBe("gagal");
    expect(hasil.keadaan === "gagal" && hasil.alasan).toMatch(/tidak dapat dihubungi/);
  });

  it("rute belum terpasang (404 berhalaman HTML) disebut begitu", async () => {
    const ambil = vi.fn(async () => new Response("<html>404</html>", { status: 404 }));
    const hasil = await mintaTautanSipp({ perkaraId: "10049", nomorPerkara: NOMOR, ambil });
    expect(hasil).toEqual({
      keadaan: "gagal",
      alasan: expect.stringContaining("rute sipp-tautan belum terpasang"),
    });
  });

  it("galat berbadan JSON (sesi habis): pesan peladen yang dipakai", async () => {
    const ambil = vi.fn(async () =>
      jawabanJson({ ok: false, error: { message: "Anda belum login atau sesi Anda telah berakhir." } }, 401)
    );
    expect(await mintaTautanSipp({ perkaraId: "10049", nomorPerkara: NOMOR, ambil })).toEqual({
      keadaan: "gagal",
      alasan: "Anda belum login atau sesi Anda telah berakhir.",
    });
  });

  it("alamat yang bukan http(s) mutlak DITOLAK, bukan dipasang ke href", async () => {
    for (const buruk of ["javascript:alert(1)", "/aleta/aleta-sipp", "data:text/html,x"]) {
      const ambil = vi.fn(async () => jawabanJson({ ok: true, data: { alamat: buruk, alasan: "" } }));
      const hasil = await mintaTautanSipp({ perkaraId: "1", nomorPerkara: NOMOR, ambil });
      expect(hasil.keadaan, buruk).toBe("gagal");
    }
    expect(alamatSippSah(ALAMAT_SIPP)).toBe(ALAMAT_SIPP);
    expect(alamatSippSah("https://sipp.contoh/x")).toBe("https://sipp.contoh/x");
  });

  it("peladen yang diam dihentikan pada batas tunggu", async () => {
    const ambil = vi.fn(
      (_alamat: string, init?: RequestInit) =>
        new Promise<Response>((_, tolak) => {
          init?.signal?.addEventListener("abort", () => tolak(new DOMException("aborted", "AbortError")));
        })
    );
    const hasil = await mintaTautanSipp({ perkaraId: "1", nomorPerkara: NOMOR, ambil, batasMs: 20 });
    expect(hasil.keadaan).toBe("gagal");
    expect(hasil.keadaan === "gagal" && hasil.alasan).toMatch(/tidak menjawab/);
  });

  it("tanpa perkaraId dan nomor: tidak meminta apa pun", async () => {
    const ambil = vi.fn();
    const hasil = await mintaTautanSipp({ perkaraId: "", nomorPerkara: "", ambil });
    expect(hasil.keadaan).toBe("tidak-ada");
    expect(ambil).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PAPAN KLIP
// ===========================================================================

describe("salinTeks - papan klip dan jalan cadangannya", () => {
  let execCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true, writable: true });
  });

  afterEach(() => {
    // @ts-expect-error - dilepas kembali; jsdom tidak memilikinya.
    delete document.execCommand;
  });

  it("konteks aman: navigator.clipboard dipakai, execCommand tidak disentuh", async () => {
    const writeText = vi.fn(async () => undefined);
    const hasil = await salinTeks("isi", { navigator: { clipboard: { writeText } as unknown as Clipboard } });
    expect(hasil).toBe("papan-klip");
    expect(writeText).toHaveBeenCalledWith("isi");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("peladen satker (tanpa navigator.clipboard): cadangan berjalan SEBELUM satu pun await", () => {
    // Yang diperiksa: execCommand sudah terpanggil begitu salinTeks kembali,
    // SEBELUM janjinya ditunggu - masih di dalam klik yang sama. Menunggu
    // lebih dahulu membuat peramban menolak execCommand dalam diam.
    let isiTerpilih = "";
    execCommand.mockImplementation(() => {
      const aktif = document.activeElement as HTMLTextAreaElement | null;
      isiTerpilih = aktif?.value.slice(aktif.selectionStart ?? 0, aktif.selectionEnd ?? 0) ?? "";
      return true;
    });
    const janji = salinTeks("baris satu\nbaris dua", { navigator: {} as Navigator });
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(isiTerpilih).toBe("baris satu\nbaris dua");
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    return expect(janji).resolves.toBe("cadangan");
  });

  it("papan klip MENOLAK: cadangan tetap dicoba", async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    expect(await salinTeks("isi", { navigator: { clipboard: { writeText } as unknown as Clipboard } })).toBe(
      "cadangan"
    );
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("keduanya gagal: jawabannya 'gagal', bukan pura-pura berhasil", async () => {
    execCommand.mockReturnValue(false);
    expect(await salinTeks("isi", { navigator: {} as Navigator })).toBe("gagal");
  });

  it("fokus kembali ke tombol yang ditekan", () => {
    const tombol = document.createElement("button");
    tombol.type = "button";
    document.body.appendChild(tombol);
    tombol.focus();
    expect(salinLewatTextarea("isi", document)).toBe(true);
    expect(document.activeElement).toBe(tombol);
    tombol.remove();
  });
});

// ===========================================================================
// BILAH ALAT YANG DIGAMBAR
// ===========================================================================

const BAHAN: BahanRingkasanSalin = {
  identitas: {
    nomorPerkara: NOMOR,
    jenisPerkara: "Cerai Gugat",
    tanggalDaftar: "2026-07-01",
    alurPerkaraId: 15,
  },
  lewatEcourt: true,
  umur: { hariBersih: 60, hariBerjalan: 70, hariMediasi: 10, sudahPutus: false },
  majelis: [{ nama: "Dr. Fahri Hamzah", jabatan: "Hakim Ketua" }],
  panitera: [{ nama: "Unun Sulastri" }],
  jurusita: [{ nama: "Munir" }],
  pihak: [
    { nama: "Nurhayati binti Abdullah", pihakKe: 1, jenis: "pihak" },
    { nama: "Rahmat bin Sulaiman", pihakKe: 2, jenis: "pihak" },
  ],
  jadwal: [],
  putusan: null,
  biaya: { panjar: 500000, terpakai: 0, sisa: 500000 },
  penilaian: { skor: 70, keadaan: "perhatian" },
};

function ringkas() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return ringkasStatus(BAHAN as unknown as BahanRingkas, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
}

function gambar() {
  return render(
    <AlatStatusPerkara
      nomorPerkara={NOMOR}
      jenisPerkara="Cerai Gugat"
      perkaraId="10049"
      bahan={BAHAN}
      ringkas={ringkas()}
      onBuka={() => {}}
    />
  );
}

describe("bilah alat Status Perkara", () => {
  let writeText: ReturnType<typeof vi.fn>;
  let execCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true, writable: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    // @ts-expect-error - dilepas kembali; jsdom tidak memilikinya.
    delete navigator.clipboard;
    // @ts-expect-error - lihat di atas.
    delete document.execCommand;
  });

  it("alamat ada: Buka SIPP menjadi tautan tab baru ke halaman perkaranya", async () => {
    const ambil = vi.fn(async () => jawabanJson({ ok: true, data: { alamat: ALAMAT_SIPP, alasan: "" } }));
    vi.stubGlobal("fetch", ambil);
    gambar();

    const tautan = await screen.findByRole("link", { name: /Buka SIPP/ });
    expect(tautan.getAttribute("href")).toBe(ALAMAT_SIPP);
    expect(tautan.getAttribute("target")).toBe("_blank");
    expect(tautan.getAttribute("rel")).toContain("noopener");

    // Satu-satunya permintaan ke peladen: alamat SIPP perkara ini. Riwayat
    // dan sematan tidak ikut ke mana pun.
    expect(ambil).toHaveBeenCalledTimes(1);
    const alamatPermintaan = String((ambil.mock.calls[0] as unknown[])[0]);
    expect(alamatPermintaan).toContain(RUTE_TAUTAN_SIPP);
    expect(alamatPermintaan).toContain("perkaraId=10049");
    expect(alamatPermintaan).not.toMatch(/riwayat|semat/i);
  });

  it("selagi alamat disiapkan, Buka SIPP belum berupa tautan dan Salin tautan belum dapat ditekan", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    gambar();
    expect(screen.queryByRole("link", { name: /Buka SIPP/ })).toBeNull();
    expect(screen.getByText("Buka SIPP").closest("[aria-disabled]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Salin tautan/ })).toBeDisabled();
  });

  it("Salin tautan menyalin alamat halaman perkara di SIPP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawabanJson({ ok: true, data: { alamat: ALAMAT_SIPP, alasan: "" } })));
    gambar();
    await screen.findByRole("link", { name: /Buka SIPP/ });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salin tautan/ }));
    });
    expect(writeText).toHaveBeenCalledWith(ALAMAT_SIPP);
    expect(await screen.findByText("Tautan SIPP tersalin")).toBeTruthy();
  });

  it("Salin ringkasan menyalin ringkasan LENGKAP, termasuk alamat SIPP-nya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawabanJson({ ok: true, data: { alamat: ALAMAT_SIPP, alasan: "" } })));
    gambar();
    await screen.findByRole("link", { name: /Buka SIPP/ });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salin ringkasan/ }));
    });
    const teks = String(writeText.mock.calls[0]?.[0] ?? "");
    for (const satu of [
      `Perkara ${NOMOR}`,
      "PARA PIHAK",
      "Penggugat/Pemohon: Nurhayati binti Abdullah",
      "Tergugat/Termohon: Rahmat bin Sulaiman",
      "Hakim Ketua: Dr. Fahri Hamzah",
      "Panitera Pengganti: Unun Sulastri",
      "Jurusita: Munir",
      "Sisa panjar: Rp 500.000",
      "Nilai kelengkapan: 70 dari 100 (perhatian)",
      `Halaman perkara di SIPP: ${ALAMAT_SIPP}`,
    ]) {
      expect(teks.split("\n"), satu).toContain(satu);
    }
  });

  it("alamat kosong beserta alasan: alasannya tampil, Buka SIPP menjadi beranda SIPP, Salin tautan jujur menyebut ALETA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jawabanJson({ ok: true, data: { alamat: "", alasan: "Kunci SIPP belum terbaca di peladen." } }))
    );
    gambar();

    expect(await screen.findByText(/Kunci SIPP belum terbaca di peladen\./)).toBeTruthy();
    const beranda = screen.getByRole("link", { name: /Buka SIPP \(beranda\)/ });
    expect(beranda.getAttribute("href")).toContain("/api/external-apps/sipp/launch");
    expect(beranda.getAttribute("target")).toBe("_blank");

    const tombol = screen.getByRole("button", { name: /Salin tautan ALETA/ });
    await act(async () => {
      fireEvent.click(tombol);
    });
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}${withBasePath(`/aleta-ecourt?perkara=${encodeURIComponent(NOMOR)}`)}`
    );
    expect(await screen.findByText("Tautan ALETA tersalin")).toBeTruthy();
    // Tidak ada "Coba lagi" untuk jawaban yang memang tidak ada - hanya untuk gagal.
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("gagal jaringan: alasannya tampil, dan Coba lagi sungguh meminta ulang", async () => {
    let putaran = 0;
    const ambil = vi.fn(async () => {
      putaran += 1;
      if (putaran === 1) throw new TypeError("Failed to fetch");
      return jawabanJson({ ok: true, data: { alamat: ALAMAT_SIPP, alasan: "" } });
    });
    vi.stubGlobal("fetch", ambil);
    gambar();

    expect(await screen.findByText(/tidak dapat dihubungi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    const tautan = await screen.findByRole("link", { name: /Buka SIPP/ });
    expect(tautan.getAttribute("href")).toBe(ALAMAT_SIPP);
    expect(ambil).toHaveBeenCalledTimes(2);
  });

  it("peramban menolak kedua jalan salin: teksnya disodorkan terpilih untuk disalin tangan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawabanJson({ ok: true, data: { alamat: ALAMAT_SIPP, alasan: "" } })));
    // Peladen satker: tidak ada navigator.clipboard, dan execCommand ditolak.
    // @ts-expect-error - dilepas untuk meniru konteks yang tidak aman.
    delete navigator.clipboard;
    execCommand.mockReturnValue(false);
    gambar();
    await screen.findByRole("link", { name: /Buka SIPP/ });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salin ringkasan/ }));
    });
    const kotak = (await screen.findByRole("textbox", { name: /untuk disalin tangan/ })) as HTMLTextAreaElement;
    expect(kotak.value).toContain("PARA PIHAK");
    expect(kotak.value).toContain(`Halaman perkara di SIPP: ${ALAMAT_SIPP}`);
    await waitFor(() => expect(document.activeElement).toBe(kotak));
    expect(screen.getByText(/Peramban menolak menyalin otomatis/)).toBeTruthy();
    // Bukan "Tersalin" - kegagalan tidak boleh berbunyi seperti berhasil.
    expect(screen.queryByText("Tersalin")).toBeNull();
  });
});
