import { readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DaftarKelompok,
  KelompokKartu,
  LinimasaPerkara,
  NavKelompok,
  SakelarTampilanStatus,
  useTampilanStatus,
} from "@/components/portal/status-perkara-seamless";
import { ringkasStatus } from "@/lib/ringkas-status";
import {
  KATA_LAIN_BAGIAN,
  KELOMPOK_SEAMLESS,
  TAMPILAN_BAWAAN,
  cariBagianSeamless,
  kelompokDariBagian,
  kunciTampilanStatus,
  susunLinimasa,
} from "@/lib/status-perkara-seamless";

/**
 * Seamless tidak boleh mengurangi satu fitur pun dari Kompleks. Uji ini
 * menjaganya dari tiga sisi: (1) tiap bagian punya kelompok, (2) tiap pecahan
 * layar dipakai KEDUA tampilan, (3) bilah aksi Seamless memuat semua aksi
 * bilah alat lama.
 */
const akar = path.resolve(__dirname, "..", "components", "portal");
const berkasStatus = readFileSync(path.join(akar, "aleta-ecourt-status-perkara.tsx"), "utf8");
const berkasAlat = readFileSync(path.join(akar, "alat-status-perkara.tsx"), "utf8");

function kunciBagianDiSumber(): string[] {
  const hasil: string[] = [];
  for (const m of berkasStatus.matchAll(/<Bagian\b[^>]*?kunci="([^"]+)"/g)) hasil.push(m[1]);
  // Panduan pertanyaan saksi menggambar Bagian-nya sendiri (kunciBagian).
  for (const m of berkasStatus.matchAll(/kunciBagian="([^"]+)"/g)) hasil.push(m[1]);
  return [...new Set(hasil)];
}

describe("kelompok Seamless memuat SEMUA bagian Status Perkara", () => {
  it("tiap bagian di berkas Status Perkara punya kelompok", () => {
    const tanpaKelompok = kunciBagianDiSumber().filter((k) => !kelompokDariBagian(k) && !kelompokDariBagian(`${k}-pembuktian`));
    expect(tanpaKelompok).toEqual([]);
  });

  it("tiap bagian pada daftar kelompok memang ada di berkas (tidak ada kunci yatim)", () => {
    const ada = new Set(kunciBagianDiSumber());
    const yatim = KELOMPOK_SEAMLESS.flatMap((g) => g.bagian).filter((k) => !ada.has(k) && !ada.has(k.replace(/-pembuktian$/, "")));
    expect(yatim).toEqual([]);
  });

  it("tidak ada bagian yang berada di dua kelompok", () => {
    const semua = KELOMPOK_SEAMLESS.flatMap((g) => g.bagian);
    expect(new Set(semua).size).toBe(semua.length);
  });

  it("tiap kelompok dibungkus KelompokKartu yang memuat tepat bagian-bagiannya", () => {
    for (const g of KELOMPOK_SEAMLESS) {
      const mulai = berkasStatus.indexOf(`<KelompokKartu id="${g.id}"`);
      const akhir = berkasStatus.indexOf("</KelompokKartu>", mulai);
      expect(mulai, g.id).toBeGreaterThan(-1);
      const isi = berkasStatus.slice(mulai, akhir);
      const kunci = [...isi.matchAll(/<Bagian\b[^>]*?kunci="([^"]+)"/g)].map((m) => m[1]);
      for (const k of kunci) expect(g.bagian, `${g.id}: ${k}`).toContain(k);
      if (g.id === "B") expect(isi).toContain('kunciBagian="status-pandu-saksi"');
    }
  });

  it("urutan bagian dalam TIAP kelompok sama dengan urutan di berkas (Kompleks dan Seamless terbaca sama)", () => {
    const urutBerkas = [...berkasStatus.matchAll(/<Bagian\b[^>]*?kunci="([^"]+)"/g)].map((m) => m[1]);
    const unik = urutBerkas.filter((k, i) => urutBerkas.indexOf(k) === i);
    for (const g of KELOMPOK_SEAMLESS) {
      const harap = g.bagian.filter((k) => unik.includes(k));
      expect(unik.filter((k) => g.bagian.includes(k)), g.id).toEqual(harap);
    }
  });

  it("kelompok berurutan: Jalannya perkara, Pihak dan majelis, Putusan, Berkas, Penilaian", () => {
    expect(KELOMPOK_SEAMLESS.map((g) => g.id)).toEqual(["B", "A", "C", "D", "E"]);
  });

  it("tiap bagian punya kata lain untuk pencarian", () => {
    for (const k of KELOMPOK_SEAMLESS.flatMap((g) => g.bagian)) expect(KATA_LAIN_BAGIAN[k], k).toBeTruthy();
  });
});

describe("pecahan layar dipakai kedua tampilan (fungsi identik)", () => {
  // Rancangan 3 Nov 2026 (keputusan 142): SATU perakitan untuk kedua tampilan.
  const mulai = berkasStatus.indexOf("  // PERAKITAN BARU (rancangan 3 Nov 2026");
  const jsx = berkasStatus.slice(mulai, berkasStatus.indexOf("\n}\n", mulai));
  const pakai = (teks: string) => new Set([...teks.matchAll(/\{(blok[A-Za-z]+)\}/g)].map((m) => m[1]));

  it("kelima kelompok dirakit dalam urutan rancangan, dipakai Seamless dan Kompleks", () => {
    expect(mulai).toBeGreaterThan(-1);
    expect(jsx).toContain("const urutKelompok = [blokB, blokA, blokC, blokD, blokE];");
    expect(jsx).toContain("<DaftarKelompok>");
    expect(jsx).toContain("<IndeksKompleks");
    expect(jsx.match(/urutKelompok\.map/g)?.length).toBe(2);
  });

  it("sorotan memuat nomor/jenis, lencana, kumulasi, linimasa, dan fakta; blok kolom kanan lama hilang", () => {
    const dipakai = pakai(jsx);
    for (const blok of ["blokNomor", "blokLencana"]) expect(dipakai.has(blok), blok).toBe(true);
    expect(jsx).toContain("<SorotanPerkara");
    expect(jsx).toContain("<BarisKumulasi");
    expect(jsx).toContain("<LinimasaPerkara");
    expect(jsx).toContain("<BarisFakta");
    expect(jsx).toContain("<KotakBerikutnya") ;
    expect(berkasStatus).not.toContain("const blokKartu");
    expect(berkasStatus).not.toContain("const blokAngka");
    expect(berkasStatus).not.toContain("<TataLetakSeamless");
  });

  it("kedua tampilan memakai komponen bilah alat yang sama (varian rancangan), bukan salinannya", () => {
    expect(jsx).toContain('<AlatStatusPerkara\n            varian="rancangan"');
    expect(jsx).toContain("Cari perkara lain");
    expect(jsx).toContain("onClick={onKembali}");
  });

  it("tampilan Kompleks: judul kelompok kecil dan bagian dalam satu kartu", () => {
    const { container } = render(
      <KelompokKartu id="A" seamless={false} ringkas="x">
        <p>isi</p>
      </KelompokKartu>
    );
    expect(container.querySelector("[data-kelompok-kompleks='A']")).not.toBeNull();
    expect(container.querySelector("h4")?.textContent).toContain("Pihak dan majelis");
    expect(container.textContent).toContain("isi");
    expect(container.querySelector("button")).toBeNull();
  });

  it("toggle ada di bilah cari satu baris", () => {
    expect(berkasStatus).toContain("<SakelarTampilanStatus nilai={tampilanStatus} onPilih={pilihTampilanStatus} />");
    expect(berkasStatus).toContain('seamless={tampilanStatus === "seamless"}');
  });
});

describe("bilah aksi Seamless memuat semua aksi bilah alat Kompleks", () => {
  const cabang = berkasAlat.slice(berkasAlat.indexOf("if (seamless) {"), berkasAlat.indexOf('<div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 print:hidden">'));
  const aksi = [
    "Salin ringkasan",
    "Salin tautan",
    "Salin tautan ALETA",
    "Cetak",
    "Buka SIPP",
    "Buka SIPP (beranda)",
    "Sematkan perkara ini",
    "Lepas sematan",
    "Buka semua bagian",
    "Tutup semua bagian",
    "Sematan dan riwayat",
    "Coba lagi",
    "Peramban menolak menyalin otomatis",
    "Cari di perkara ini",
  ];
  for (const a of aksi) {
    it(`memuat: ${a}`, () => {
      expect(cabang).toContain(a);
    });
  }
  it("memakai fungsi yang sama dengan Kompleks", () => {
    for (const f of ["susunRingkasan()", "window.print()", "balikSemat(singkat)", 'siarkanAba({ jenis: "buka-semua" })', 'siarkanAba({ jenis: "tutup-semua" })', "onBuka(x.nomorPerkara)", "tautanAleta()", "ulangiTautan"]) {
      expect(cabang, f).toContain(f);
    }
  });
});

describe("pilihan tampilan diingat per pengguna", () => {
  beforeEach(() => window.localStorage.clear());

  it("bawaannya Seamless; yang belum memilih langsung melihatnya", () => {
    expect(TAMPILAN_BAWAAN).toBe("seamless");
    const { result } = renderHook(() => useTampilanStatus("u1"));
    expect(result.current[0]).toBe("seamless");
  });

  it("pilihan pengguna (termasuk Kompleks) diingat per pengguna dan menang atas bawaan", () => {
    const a = renderHook(() => useTampilanStatus("u1"));
    act(() => a.result.current[1]("kompleks"));
    expect(window.localStorage.getItem(kunciTampilanStatus("u1"))).toBe("kompleks");
    const lagi = renderHook(() => useTampilanStatus("u1"));
    expect(lagi.result.current[0]).toBe("kompleks");
    const lain = renderHook(() => useTampilanStatus("u2"));
    expect(lain.result.current[0]).toBe("seamless");
  });

  it("nilai simpanan yang rusak diabaikan", () => {
    window.localStorage.setItem(kunciTampilanStatus("u3"), "aneh");
    expect(renderHook(() => useTampilanStatus("u3")).result.current[0]).toBe("seamless");
  });

  it("sakelar menandai pilihan dan memanggil onPilih", () => {
    const dipilih: string[] = [];
    render(<SakelarTampilanStatus nilai="kompleks" onPilih={(x) => dipilih.push(x)} />);
    expect(screen.getByRole("button", { name: "Kompleks" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Seamless" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Seamless" }));
    expect(dipilih).toEqual(["seamless"]);
  });
});

describe("KelompokKartu", () => {
  beforeEach(() => window.localStorage.clear());

  it("terbuka bawaan menurut tahap, dan pilihan diingat PER PERKARA", () => {
    const { unmount } = render(
      <KelompokKartu id="C" seamless ringkas="x" terbukaBawaan={false} kunciPerkara="1/Pdt.G/2026/PA.X">
        <p>isi</p>
      </KelompokKartu>
    );
    const tombol = screen.getByRole("button", { name: /Putusan dan tindak lanjut/ });
    expect(tombol.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(tombol);
    expect(window.localStorage.getItem("aleta.status-perkara.kelompok2.1/Pdt.G/2026/PA.X.C")).toBe("buka");
    unmount();
    render(
      <KelompokKartu id="C" seamless ringkas="x" terbukaBawaan={false} kunciPerkara="1/Pdt.G/2026/PA.X">
        <p>isi</p>
      </KelompokKartu>
    );
    expect(screen.getByRole("button", { name: /Putusan dan tindak lanjut/ }).getAttribute("aria-expanded")).toBe("true");
    cleanup();
    render(
      <KelompokKartu id="C" seamless ringkas="x" terbukaBawaan={false} kunciPerkara="2/Pdt.G/2026/PA.X">
        <p>isi</p>
      </KelompokKartu>
    );
    expect(screen.getByRole("button", { name: /Putusan dan tindak lanjut/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("pada Seamless menggambar kartu berlipatan; isi tetap hidup saat dilipat", () => {
    const { container } = render(
      <DaftarKelompok>
        <KelompokKartu id="B" seamless ringkas="3 sidang">
          <section id="bagian-sidang">isi sidang</section>
        </KelompokKartu>
      </DaftarKelompok>
    );
    const tombol = screen.getByRole("button", { name: /Jalannya perkara/ });
    expect(tombol.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("3 sidang")).toBeTruthy();
    fireEvent.click(tombol);
    expect(tombol.getAttribute("aria-expanded")).toBe("false");
    // dilipat = disembunyikan, bukan dilepas: bagian di dalamnya tetap terdaftar
    expect(container.querySelector("#bagian-sidang")).not.toBeNull();
    expect(window.localStorage.getItem("aleta.status-perkara.kelompok2.-.B")).toBe("tutup");
  });
});

describe("titik peringatan per kelompok", () => {
  it("butir Perlu tindakan membawa kelompoknya", () => {
    const r = ringkasStatus(
      {
        identitas: { nomorPerkara: "1/Pdt.G/2026/PA.Contoh", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-01-02" },
        umur: { hariBerjalan: 290, bulanBerjalan: 9, sudahPutus: false, hariMinutasi: null, hariMediasi: 0 },
        majelis: [],
        panitera: [],
        jadwal: [],
        putusan: null,
      },
      "2026-10-18"
    );
    const peta = Object.fromEntries(r.peringatan.map((p) => [p.pesan, p.kelompok]));
    expect(peta["Majelis hakim belum ditetapkan"]).toBe("A");
    expect(Object.values(peta).filter((k) => k === "B").length).toBeGreaterThan(0);
    expect(r.peringatan.every((p) => p.kelompok)).toBe(true);
  });

  it("kartu kelompok dan deret pintasan menggambar titik bila ada butir", () => {
    render(
      <KelompokKartu id="A" seamless ringkas="x" perluTindakan={2}>
        <p>isi</p>
      </KelompokKartu>
    );
    expect(screen.getByText(/2 perlu tindakan/)).toBeTruthy();
    cleanup();
    render(<NavKelompok ringkasan={{}} perluTindakan={{ B: 1 }} />);
    expect(screen.getAllByRole("img", { name: "Ada yang perlu tindakan" }).length).toBe(1);
  });
});

describe("linimasa dan pencarian", () => {
  const peristiwa = [
    { tanggal: "2026-09-02", jenis: "daftar", judul: "Perkara didaftarkan" },
    { tanggal: "2026-09-03", jenis: "penetapan", judul: "PMH" },
    { tanggal: "2026-10-07", jenis: "mediasi", judul: "Mediasi" },
    { tanggal: "2026-10-09", jenis: "mediasi", judul: "Mediasi" },
    { tanggal: "2026-10-07", jenis: "sidang", judul: "Sidang pertama", ditunda: true },
    { tanggal: "2026-10-14", jenis: "sidang", judul: "Jawaban" },
    { tanggal: "2026-10-21", jenis: "sidang", judul: "Saksi" },
    { tanggal: "2026-09-04", jenis: "relaas", judul: "Relaas" },
  ];

  it("menyusun titik dari peristiwa yang ada, satu titik mediasi, dan menandai yang kini", () => {
    const t = susunLinimasa(peristiwa, "2026-10-18", { sudahPutus: false });
    expect(t.map((x) => x.nama)).toEqual(["Daftar", "Mediasi", "Sidang 1", "Sidang 2", "Sidang 3", "Putusan", "Minutasi", "Akta cerai", "Arsip"]);
    expect(t.find((x) => x.keadaan === "kini")?.nama).toBe("Sidang 3");
    expect(t.find((x) => x.nama === "Sidang 1")?.ditunda).toBe(true);
    expect(t.filter((x) => x.keadaan === "lalu").length).toBe(4);
    expect(t.every((x) => x.ke)).toBe(true);
  });

  it("perkara yang sudah putus tidak menambah titik putusan kosong", () => {
    const t = susunLinimasa([...peristiwa, { tanggal: "2026-10-28", jenis: "putusan", judul: "Putusan" }], "2026-11-30", { sudahPutus: true });
    expect(t.filter((x) => x.nama === "Putusan").length).toBe(1);
    expect(t.find((x) => x.keadaan === "kini")?.nama).toBe("Putusan");
  });

  it("menggambar titik sebagai tombol yang dapat diketuk", () => {
    render(<LinimasaPerkara titik={susunLinimasa(peristiwa, "2026-10-18", { sudahPutus: false })} />);
    expect(screen.getByRole("button", { name: /Sidang 3/ }).getAttribute("aria-current")).toBe("step");
  });

  it("pencarian memakai judul dan kata lain", () => {
    const daftar = KELOMPOK_SEAMLESS.flatMap((g) => g.bagian).map((k) => ({ kunci: k, judul: k === "biaya" ? "Biaya perkara" : k === "pihak" ? "Para pihak" : k }));
    expect(cariBagianSeamless(daftar, "panjar").map((x) => x.kunci)).toContain("biaya");
    expect(cariBagianSeamless(daftar, "KTP").map((x) => x.kunci)).toContain("pihak");
    expect(cariBagianSeamless(daftar, "biaya")[0].lewatKataLain).toBe(false);
    expect(cariBagianSeamless(daftar, "")).toEqual([]);
  });
});
