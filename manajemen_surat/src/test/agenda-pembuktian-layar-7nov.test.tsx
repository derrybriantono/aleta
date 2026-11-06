// @vitest-environment jsdom
/**
 * Layar pertimbangan alat bukti pada perkara dicabut: agenda pembuktian dari jadwal SIPP menjadi nilai awal pilihan, tetap bisa diubah, tidak
 * menimpa pilihan pengguna, dan null berarti perilaku lama (sebelum ada pembuktian). Data rekaan.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import { kalimatBaris, type BarisBukti } from "@/lib/bukti-tertulis";

const KK: BarisBukti = { nm: "Kartu Keluarga", an: "Fulanah binti Fulan", no: "1234567890123456", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const ALINEA = [
  { teks: "PUTUSAN" },
  { teks: "Penggugat mencabut gugatannya." },
  { teks: kalimatBaris(KK, "P", 0) },
];

let lepas: (j: unknown) => void = () => undefined;

function pasangFetch(agenda: number | null | "tanpa", tertunda = false) {
  const badan = { ok: true, data: { ada: true, P: [], T: [], nikah: null, dokumen: [], ...(agenda === "tanpa" ? {} : { agendaPembuktianKe: agenda }) } };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((selesai) => {
          const jawab = () => selesai({ ok: true, status: 200, json: async () => badan });
          if (tertunda) lepas = jawab;
          else jawab();
        })
    )
  );
}

const pilihanAgenda = () => screen.getAllByRole("combobox").find((s) => teksPilihan(s).includes("Pada pembuktian kedua")) as HTMLSelectElement;
const teksPilihan = (s: HTMLElement) => [...s.querySelectorAll("option")].map((o) => o.textContent ?? "");

const tampil = () => render(<BuktiAletaAbt alinea={ALINEA} perkaraId="11" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Gugat" />);

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("agenda pembuktian dari SIPP pada perkara dicabut", () => {
  it("dua sidang beragenda pembuktian: pilihan awal 'kedua' dan bukti lama ditawarkan sebagai usulan", async () => {
    pasangFetch(2);
    tampil();
    await waitFor(() => expect(pilihanAgenda().value).toBe("2"));
    expect(await screen.findByText(/Menurut jadwal SIPP, 2 sidang berjalan beragenda pembuktian/)).toBeTruthy();
    expect(screen.getByText(/Dicabut pada agenda pembuktian ke-2: bukti pembuktian sebelumnya ditawarkan sebagai usulan/)).toBeTruthy();
  });

  it("sidang pertama saja: pilihan awal 'pertama'; lima sidang: dibatasi 'ketiga atau sesudahnya'", async () => {
    pasangFetch(1);
    tampil();
    await waitFor(() => expect(pilihanAgenda().value).toBe("1"));
    document.body.replaceChildren();
    pasangFetch(5);
    tampil();
    await waitFor(() => expect(pilihanAgenda().value).toBe("3"));
    expect(teksPilihan(pilihanAgenda())).toContain("Pada pembuktian ketiga atau sesudahnya");
  });

  it("null atau tidak ada: perilaku lama, pilihan 'sebelum ada pembuktian' dan tanpa keterangan SIPP", async () => {
    for (const nilai of [null, "tanpa"] as const) {
      document.body.replaceChildren();
      pasangFetch(nilai);
      tampil();
      await screen.findAllByText(/Perkara dicabut/);
      await act(async () => {
        await Promise.resolve();
      });
      expect(pilihanAgenda().value).toBe("0");
      expect(screen.queryByText(/Menurut jadwal SIPP/)).toBeNull();
      expect(screen.queryByText(/ditawarkan sebagai usulan/)).toBeNull();
    }
  });

  it("pilihan yang sudah diubah pengguna tidak ditimpa jawaban SIPP yang datang belakangan", async () => {
    pasangFetch(2, true);
    tampil();
    await screen.findAllByText(/Perkara dicabut/);
    fireEvent.change(pilihanAgenda(), { target: { value: "1" } });
    expect(pilihanAgenda().value).toBe("1");
    await act(async () => {
      lepas(undefined);
      await Promise.resolve();
    });
    await screen.findByText(/Menurut jadwal SIPP, 2 sidang/);
    expect(pilihanAgenda().value).toBe("1");
  });

  it("nilai awal dari SIPP tetap bisa diubah", async () => {
    pasangFetch(2);
    tampil();
    await waitFor(() => expect(pilihanAgenda().value).toBe("2"));
    fireEvent.change(pilihanAgenda(), { target: { value: "0" } });
    expect(pilihanAgenda().value).toBe("0");
  });
});
