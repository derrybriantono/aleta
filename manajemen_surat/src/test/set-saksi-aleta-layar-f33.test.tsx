import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SetSaksiAleta } from "@/components/portal/set-saksi-aleta";

/**
 * F3.3 - Panduan pertanyaan saksi ALETA di Pengaturan SIPP & ABT (baca saja):
 * daftar set, dasar hukum, "perlu dicek", pertanyaan dengan sebutan pihak terisi,
 * unsur per pertanyaan; tidak ada tombol simpan (tidak menulis ke ABT).
 */
afterEach(() => cleanup());

describe("SetSaksiAleta", () => {
  it("menampilkan set cerai F lebih dulu, lalu set lain bila dipilih; tanpa tombol simpan", () => {
    render(<SetSaksiAleta />);
    expect(screen.getByText(/Cerai - perselisihan dan pertengkaran terus-menerus \(huruf F\)/, { selector: "option" })).toBeTruthy();
    expect(screen.getByText("1. Apakah Saudara kenal dengan Penggugat dan Tergugat?")).toBeTruthy();
    expect(screen.getByText(/Perlu dicek: Rumusan persis syarat pisah 6 bulan/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Pilih set pertanyaan saksi"), { target: { value: "dk-anak-perempuan" } });
    expect(screen.getByText(/Apakah anak para Pemohon sendiri mau menikah, dan apakah ada paksaan dari siapa pun\?/)).toBeTruthy();
    expect(screen.getAllByText(/PERMA 5\/2019/).length).toBeGreaterThan(0);
    expect(screen.getByText("Yang dibuktikan: persetujuan anak, tanpa paksaan (PERMA 5/2019 Pasal 14)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /simpan/i })).toBeNull();
  });
});
