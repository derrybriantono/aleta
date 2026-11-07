// @vitest-environment jsdom
/**
 * Layar alat bukti tertulis: kode yang tertulis dua kali di naskah dengan kalimat berbeda diberi peringatan, bukan diabaikan diam-diam;
 * naskah tanpa kode berulang tidak menampilkan peringatan. Data rekaan.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import { kalimatBaris, type BarisBukti } from "@/lib/bukti-tertulis";

const KK: BarisBukti = { nm: "Kartu Keluarga", an: "Fulanah binti Fulan", no: "1234567890123456", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const KK2: BarisBukti = { ...KK, an: "Fulan bin Fulanah", no: "6543210987654321" };
const NASKAH_GANDA = [{ teks: "PUTUSAN" }, { teks: kalimatBaris(KK, "P", 0) }, { teks: kalimatBaris(KK2, "P", 0) }];
const NASKAH_BIASA = [{ teks: "PUTUSAN" }, { teks: kalimatBaris(KK, "P", 0) }];

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function tampil(alinea: Array<{ teks: string }>) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { ada: true, P: [], T: [], nikah: null, dokumen: [] } }) })));
  return render(<BuktiAletaAbt alinea={alinea} perkaraId="11" nomor="1/Pdt.G/2026/PA.Uji" jenisPerkara="Cerai Gugat" />);
}

describe("peringatan kode bukti ganda di layar", () => {
  it("menyebut kode yang tertulis berulang dan membaca yang pertama saja", async () => {
    tampil(NASKAH_GANDA);
    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toMatch(/Kode P\.1 tertulis lebih dari sekali/);
    expect(peringatan.textContent).toMatch(/membaca yang pertama saja/);
    await waitFor(() => expect(screen.getAllByDisplayValue("Fulanah binti Fulan").length).toBeGreaterThan(0));
  });

  it("tanpa kode berulang tidak ada peringatan", async () => {
    tampil(NASKAH_BIASA);
    await screen.findByText(/Alat bukti tertulis/);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
