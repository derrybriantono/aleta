import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HasilPencarianPerkara,
  KOLOM_HASIL,
  kolomUtuhCetak,
  teksSel,
  type BarisHasil,
  type TampilanHasil,
  type Urutan,
} from "@/components/portal/status-perkara-hasil";
import { ID_LEMBAR_CETAK_HASIL } from "@/components/portal/status-perkara-cetak";
import {
  CADANGAN_PX,
  LEBAR_BIDANG_CETAK_PX,
  UKURAN_TERKECIL_PT,
  lebarKolomCetak,
  ruangSelCetak,
  susunTataLetakCetak,
  ukuranHurufCetak,
  type PengukurTeks,
} from "@/components/portal/status-perkara-cetak-lebar";

/**
 * ============================================================================
 * LEMBAR CETAK: KATA TIDAK DIPATAHKAN BILA MASIH DAPAT DIHINDARI
 * ============================================================================
 *
 * Telaah 26 September 2026, terukur di Chromium atas 100 hasil sungguhan:
 * "Semua kolom" (22 kolom, 6 pt, lebar menurut bobot tetap) mematahkan 350 dari
 * 2.222 sel - seluruh nomor perkara, "Tida|k", "Penetapa|n", kepala "Umu|r".
 *
 * jsdom tidak dapat mengukur huruf, jadi uji ini memakai PENGUKUR BUATAN yang
 * meniru lebar huruf Arial (lebar tiap huruf per em, huruf tebal sedikit lebih
 * lebar). Yang diuji adalah ATURANNYA: kolom yang tidak boleh patah selalu
 * selebar kata terpanjangnya, huruf hanya diperkecil bila perlu, dan kolom yang
 * tetap patah disebut. Pengukuran dengan huruf sungguhan dilakukan di Chromium
 * atas lembar yang digambar komponen ini (laporan putaran pembetul).
 */

// Lebar huruf Arial dalam em (satuan per 1000), dibulatkan.
const EM: Record<string, number> = {
  i: 222, j: 222, l: 222, f: 278, t: 278, r: 333, m: 833, w: 722,
  I: 278, M: 833, W: 944, J: 500,
  "/": 278, ".": 278, ",": 278, ":": 278, ";": 278, " ": 278, "-": 333, "(": 333, ")": 333,
  "“": 333, "”": 333, "'": 191,
};
function lebarHuruf(c: string): number {
  if (EM[c] !== undefined) return EM[c];
  if (/[0-9]/.test(c)) return 556;
  if (/[a-z]/.test(c)) return 520;
  if (/[A-Z]/.test(c)) return 680;
  return 556;
}
/** px pada 10 pt (13,33 px per em); tebal 7% lebih lebar. */
const ukurBuatan: PengukurTeks = (teks, tebal) =>
  ([...teks].reduce((a, c) => a + lebarHuruf(c), 0) / 1000) * 13.333 * (tebal ? 1.07 : 1);

/** Lebar minimum satu kolom menurut aturan yang diuji - dihitung ulang di sini. */
function minimumKolom(kepala: string, sel: string[], pt: number, jumlahKolom: number): number {
  const kata = [
    ...kepala.split(/\s+/).filter(Boolean).map((k) => ukurBuatan(k, true)),
    ...sel.flatMap((s) => s.split(/\s+/).filter(Boolean)).map((k) => ukurBuatan(k, false)),
  ];
  return (Math.max(0, ...kata) * pt) / 10 + ruangSelCetak(jumlahKolom) + CADANGAN_PX;
}

/** Kolom yang huruf awalnya tidak muat tetapi huruf yang lebih kecil muat. */
const KOLOM_15 = [
  "nomor", "jenis", "pihak1", "pihak2", "kuasa", "daftar", "tahapan", "hakim",
  "panitera", "putus", "statusPutusan", "bht", "aktaCerai", "umur", "ecourt",
];

const lebarPx = (persen: string) => (parseFloat(persen) / 100) * LEBAR_BIDANG_CETAK_PX;

// Baris yang dipilih supaya kata terpanjang tiap kolom SEBESAR yang terukur di
// data sungguhan: nomor perkara empat digit, nama tanpa spasi yang panjang,
// akta cerai bertanggal, tahapan "Persidangan", status "Dikabulkan".
function barisContoh(n: number): BarisHasil[] {
  return Array.from({ length: n }, (_, i) => ({
    perkaraId: String(8000 + i),
    nomorPerkara: `${1000 + i}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: i % 2 ? "Cerai Gugat" : "Pengesahan Perkawinan/Istbat Nikah",
    tanggalDaftar: "2026-01-05",
    sudahPutus: i % 3 !== 0,
    tanggalPutusan: i % 3 !== 0 ? "2026-03-10" : "",
    tanggalMinutasi: i % 3 !== 0 ? "2026-03-12" : "",
    tanggalBht: i % 3 !== 0 ? "2026-03-26" : "",
    statusPutusan: i % 3 !== 0 ? "Dikabulkan" : "",
    pihak1: "SITI MUHAMMADIYAH binti LAMADDUKELLENG",
    sebutanPihak1: "Penggugat",
    pihak2: "ABDURRAHMANUDDINSYAH bin HASANUDDIN",
    sebutanPihak2: "Tergugat",
    kuasa: i % 4 === 0 ? "Kuasa Penggugat: Misbahuddin, S.H., M.H." : "",
    tahapan: "Persidangan",
    proses: "Pembacaan Putusan",
    hakimKetua: "Dra. Hj. Nurhayati Kurniawati, S.H., M.H.",
    paniteraPengganti: "Qadariyah, S.H.",
    jurusita: "Mohammad Syukri, S.H.",
    jumlahSidang: 12,
    sidangTerakhir: "2026-03-03",
    sidangBerikut: "",
    umurHari: 1268,
    ecourt: i % 2 === 0,
    nomorAktaCerai: i % 3 !== 0 ? `${40 + i}/AC/2026/PA.Dgl` : "",
    tanggalAktaCerai: i % 3 !== 0 ? "2026-03-30" : "",
    cocok: [{ medan: "Akta nikah", nilai: "0074/006/IV/2019" }],
  }));
}

function tataUntuk(kolom: typeof KOLOM_HASIL, baris: BarisHasil[], ukur: PengukurTeks | null) {
  const kepala = kolom.map((k) => k.label);
  const sel = baris.map((b) => kolom.map((k) => teksSel(k, b, "cetak")));
  return {
    kepala,
    sel,
    tata: susunTataLetakCetak({
      kepala,
      baris: sel,
      bobot: kolom.map((k) => k.bobotCetak),
      utuh: kolom.map(kolomUtuhCetak),
      ukur,
    }),
  };
}

beforeEach(() => {
  // Pilihan kolom cetak diingat peramban - tiap uji mulai dari kolom bawaan.
  try {
    window.localStorage.clear();
  } catch {
    // tidak apa-apa
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("tata letak lembar cetak - aturannya", () => {
  it("kolom bawaan muat utuh pada huruf awalnya: tidak ada kata yang dipatahkan, lebar tiap kolom >= kata terpanjangnya", () => {
    const kolom = KOLOM_HASIL.filter((k) =>
      ["nomor", "jenis", "pihak1", "pihak2", "daftar", "tahapan", "hakim", "putus", "statusPutusan", "umur"].includes(k.kunci)
    );
    const { kepala, sel, tata } = tataUntuk(kolom, barisContoh(100), ukurBuatan);
    expect(tata.terukur).toBe(true);
    expect(tata.ukuranPt).toBe(parseFloat(ukuranHurufCetak(kolom.length + 1)));
    expect(tata.kolomPatah).toEqual([]);
    expect(tata.lebarPersen.reduce((a, b) => a + parseFloat(b), 0)).toBeCloseTo(100, 1);
    kolom.forEach((k, i) => {
      const min = minimumKolom(kepala[i], sel.map((s) => s[i]), tata.ukuranPt, kolom.length + 1);
      expect(lebarPx(tata.lebarPersen[i + 1]), k.label).toBeGreaterThanOrEqual(min - 0.01);
    });
  });

  it("Semua kolom (22): kolom nomor/tanggal/angka/status/akta tetap selebar kata terpanjangnya; yang patah hanya kolom teks, dan disebut", () => {
    const { kepala, sel, tata } = tataUntuk(KOLOM_HASIL, barisContoh(100), ukurBuatan);
    expect(tata.terukur).toBe(true);
    // Tidak muat utuh: huruf sudah pada ukuran terkecilnya.
    expect(tata.ukuranPt).toBe(UKURAN_TERKECIL_PT);
    expect(tata.kolomPatah.length).toBeGreaterThan(0);
    expect(tata.lebarPersen).toHaveLength(KOLOM_HASIL.length + 1);
    expect(tata.lebarPersen.reduce((a, b) => a + parseFloat(b), 0)).toBeCloseTo(100, 1);
    KOLOM_HASIL.forEach((k, i) => {
      const min = minimumKolom(kepala[i], sel.map((s) => s[i]), tata.ukuranPt, KOLOM_HASIL.length + 1);
      const lebar = lebarPx(tata.lebarPersen[i + 1]);
      if (kolomUtuhCetak(k)) {
        // Nomor perkara, tanggal, angka, e-Court, status, akta cerai: UTUH.
        expect(lebar, k.label).toBeGreaterThanOrEqual(min - 0.01);
        expect(tata.kolomPatah, k.label).not.toContain(i + 1);
      } else if (tata.kolomPatah.includes(i + 1)) {
        // Kolom teks yang disebut patah memang lebih sempit dari katanya.
        expect(lebar, k.label).toBeLessThan(min);
      } else {
        expect(lebar, k.label).toBeGreaterThanOrEqual(min - 0.01);
      }
    });
  });

  it("huruf hanya diperkecil sejauh yang perlu supaya seluruh kata utuh", () => {
    // Lima belas kolom: pada huruf awalnya (7 pt) tidak muat, lebih kecil muat.
    const kolom = KOLOM_HASIL.filter((k) => KOLOM_15.includes(k.kunci));
    const { kepala, sel, tata } = tataUntuk(kolom, barisContoh(60), ukurBuatan);
    const awal = parseFloat(ukuranHurufCetak(kolom.length + 1));
    const jumlahMinimum = (pt: number) =>
      kolom.reduce(
        (a, _, i) => a + minimumKolom(kepala[i], sel.map((s) => s[i]), pt, kolom.length + 1),
        minimumKolom("No", [String(sel.length)], pt, kolom.length + 1)
      );
    // Prasyarat datanya: huruf awal memang tidak muat.
    expect(jumlahMinimum(awal)).toBeGreaterThan(LEBAR_BIDANG_CETAK_PX);
    expect(tata.kolomPatah).toEqual([]);
    expect(tata.ukuranPt).toBeLessThan(awal);
    expect(tata.ukuranPt).toBeGreaterThanOrEqual(UKURAN_TERKECIL_PT);
    // Pada ukuran terpilih muat; setengah poin lebih besar TIDAK - jadi tidak
    // diperkecil berlebihan.
    expect(jumlahMinimum(tata.ukuranPt)).toBeLessThanOrEqual(LEBAR_BIDANG_CETAK_PX);
    expect(jumlahMinimum(tata.ukuranPt + 0.5)).toBeGreaterThan(LEBAR_BIDANG_CETAK_PX);
    kolom.forEach((k, i) => {
      const min = minimumKolom(kepala[i], sel.map((s) => s[i]), tata.ukuranPt, kolom.length + 1);
      expect(lebarPx(tata.lebarPersen[i + 1]), k.label).toBeGreaterThanOrEqual(min - 0.01);
    });
  });

  it("tanpa pengukur (jsdom, peramban tanpa kanvas): lebar menurut bobot dan huruf awal - bentuk sebelum pengukuran", () => {
    const { tata } = tataUntuk(KOLOM_HASIL, barisContoh(5), null);
    expect(tata.terukur).toBe(false);
    expect(tata.kolomPatah).toEqual([]);
    expect(tata.ukuranPt).toBe(parseFloat(ukuranHurufCetak(KOLOM_HASIL.length + 1)));
    expect(tata.lebarPersen).toEqual(lebarKolomCetak(KOLOM_HASIL.length, KOLOM_HASIL.map((k) => k.bobotCetak)));
  });
});

// ---------------------------------------------------------------------------
// DIGAMBAR: PANEL PILIH KOLOM DAN LEMBAR CETAK
// ---------------------------------------------------------------------------

function Rakitan({ hasil, pengukur }: { hasil: BarisHasil[]; pengukur: PengukurTeks | null }) {
  const [tampilan, setTampilan] = useState<TampilanHasil>("detail");
  const [urut, setUrut] = useState<Urutan>(null);
  return (
    <HasilPencarianPerkara
      hasil={hasil}
      tampilan={tampilan}
      onUbahTampilan={setTampilan}
      urut={urut}
      onUbahUrut={setUrut}
      onBuka={vi.fn()}
      adaLagi={false}
      memuatLagi={false}
      onMuatLagi={vi.fn()}
      onMuatSemua={vi.fn()}
      paguMuat={500}
      kriteria={["Kata cari: “cerai”."]}
      namaPengadilan="Pengadilan Agama Contoh"
      pengukurCetak={pengukur}
    />
  );
}

describe("tata letak lembar cetak - digambar", () => {
  it("Semua kolom: panel memperingatkan kolom yang akan patah SEBELUM mencetak, dan lembarnya memakai tata letak terukur", () => {
    vi.useFakeTimers();
    window.print = vi.fn();
    const baris = barisContoh(40);
    render(<Rakitan hasil={baris} pengukur={ukurBuatan} />);
    fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
    const panel = screen.getByRole("group", { name: "Kolom yang dicetak" });
    // Kolom bawaan: muat utuh - tidak ada peringatan.
    expect(panel.querySelector('[data-bagian="peringatan-cetak"]')).toBeNull();

    fireEvent.click(within(panel).getByRole("button", { name: "Semua kolom" }));
    const { tata } = tataUntuk(KOLOM_HASIL, baris, ukurBuatan);
    const peringatan = panel.querySelector('[data-bagian="peringatan-cetak"]')?.textContent ?? "";
    const namaPatah = tata.kolomPatah.map((j) => KOLOM_HASIL[j - 1].label);
    expect(namaPatah.length).toBeGreaterThan(0);
    expect(peringatan).toBe(
      `${KOLOM_HASIL.length} kolom tidak muat utuh selebar A4 mendatar walau huruf diperkecil sampai 5,5 pt: kata panjang pada kolom ${namaPatah.join(
        ", "
      )} akan dipatahkan. Nomor perkara, tanggal, dan angka tetap utuh. Kurangi kolom supaya seluruhnya utuh.`
    );
    // Yang disebut patah hanya kolom teks.
    for (const nama of namaPatah) {
      expect(kolomUtuhCetak(KOLOM_HASIL.find((k) => k.label === nama)!), nama).toBe(false);
    }

    fireEvent.click(within(panel).getByRole("button", { name: "Cetak sekarang" }));
    const lembar = document.getElementById(ID_LEMBAR_CETAK_HASIL) as HTMLElement;
    const tabel = lembar.querySelector("table") as HTMLTableElement;
    expect(tabel.getAttribute("data-terukur")).toBe("ya");
    expect(tabel.style.fontSize).toBe("5.5pt");
    const lebar = [...tabel.querySelectorAll("colgroup col")].map((c) => (c as HTMLElement).style.width);
    // Dibandingkan sebagai ANGKA: gaya CSS membuang nol di belakang ("4.540%" -> "4.54%").
    expect(lebar.map(parseFloat)).toEqual(tata.lebarPersen.map(parseFloat));
    // Nomor perkara empat digit ("1000/Pdt.G/2026/PA.Dgl") muat di kolomnya.
    const iNomor = KOLOM_HASIL.findIndex((k) => k.kunci === "nomor") + 1;
    const minNomor =
      (ukurBuatan("1039/Pdt.G/2026/PA.Dgl", false) * 5.5) / 10 + ruangSelCetak(KOLOM_HASIL.length + 1) + CADANGAN_PX;
    // Toleransi 0,01 px: pembulatan persen tiga desimal (cadangan 2 px per
    // kolom sudah menampung selisih sekecil itu).
    expect(lebarPx(lebar[iNomor])).toBeGreaterThanOrEqual(minNomor - 0.01);
    // Padding dirapatkan untuk tabel sepadat ini.
    expect((tabel.querySelector("tbody td") as HTMLElement).style.padding).toBe("2px 3px");
  });

  it("kolom yang muat bila hurufnya diperkecil: dikatakan ukuran barunya, bukan peringatan patah", () => {
    const baris = barisContoh(30);
    render(<Rakitan hasil={baris} pengukur={ukurBuatan} />);
    fireEvent.click(screen.getByRole("button", { name: /Cetak$/ }));
    const panel = screen.getByRole("group", { name: "Kolom yang dicetak" });
    // Kolom bawaan + kuasa, panitera, BHT, akta cerai, e-Court: 15 kolom.
    for (const label of ["Kuasa hukum", "Panitera pengganti", "BHT", "Akta cerai", "e-Court"]) {
      fireEvent.click(within(panel).getByLabelText(label));
    }
    const kolom = KOLOM_HASIL.filter((k) => KOLOM_15.includes(k.kunci));
    const { tata } = tataUntuk(kolom, baris, ukurBuatan);
    expect(tata.kolomPatah).toEqual([]);
    expect(tata.ukuranPt).toBeLessThan(7);
    const peringatan = panel.querySelector('[data-bagian="peringatan-cetak"]')?.textContent ?? "";
    expect(peringatan).toBe(
      `Huruf diperkecil dari 7 pt menjadi ${tata.ukuranPt.toLocaleString("id-ID")} pt supaya tidak ada kata yang dipatahkan.`
    );
  });
});
