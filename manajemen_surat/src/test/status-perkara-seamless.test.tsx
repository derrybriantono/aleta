import { readFileSync } from "node:fs";
import path from "node:path";

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DaftarKelompok,
  KelompokKartu,
  LinimasaPerkara,
  SakelarTampilanStatus,
  useTampilanStatus,
} from "@/components/portal/status-perkara-seamless";
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

  it("urutan bagian dalam kelompok sama dengan urutan di berkas (Kompleks dan Seamless terbaca sama)", () => {
    const urutBerkas = [...berkasStatus.matchAll(/<Bagian\b[^>]*?kunci="([^"]+)"/g)].map((m) => m[1]);
    const urutKelompok = KELOMPOK_SEAMLESS.flatMap((g) => g.bagian).filter((k) => urutBerkas.includes(k));
    const unik = urutBerkas.filter((k, i) => urutBerkas.indexOf(k) === i);
    expect(urutKelompok).toEqual(unik);
  });

  it("tiap bagian punya kata lain untuk pencarian", () => {
    for (const k of KELOMPOK_SEAMLESS.flatMap((g) => g.bagian)) expect(KATA_LAIN_BAGIAN[k], k).toBeTruthy();
  });
});

describe("pecahan layar dipakai kedua tampilan (fungsi identik)", () => {
  const mulai = berkasStatus.indexOf("  if (seamless) {\n    return (");
  const kompleks = berkasStatus.indexOf('  return (\n    // Penanda pembungkus cetak');
  const jsxSeamless = berkasStatus.slice(mulai, kompleks);
  const jsxKompleks = berkasStatus.slice(kompleks, berkasStatus.indexOf("\n}\n", kompleks));
  const pakai = (teks: string) => new Set([...teks.matchAll(/\{(blok[A-Za-z]+)\}/g)].map((m) => m[1]));

  it("Seamless memakai setiap blok yang dipakai Kompleks, kecuali bilah alat lama", () => {
    expect(mulai).toBeGreaterThan(-1);
    expect(kompleks).toBeGreaterThan(mulai);
    const dipakaiKompleks = pakai(jsxKompleks);
    const dipakaiSeamless = pakai(jsxSeamless);
    for (const blok of ["blokNomor", "blokUnduh", "blokLencana", "blokKumulasi", "blokAngka", "blokKartu", "blokPeringatan", "blokA", "blokB", "blokC", "blokD", "blokE"]) {
      expect(dipakaiKompleks.has(blok) || blok === "blokNomor" || blok === "blokUnduh", `kompleks ${blok}`).toBe(true);
      expect(dipakaiSeamless.has(blok), `seamless ${blok}`).toBe(true);
    }
    expect(dipakaiKompleks.has("blokAlat")).toBe(true);
  });

  it("Seamless memakai komponen bilah alat yang sama (varian), bukan salinannya", () => {
    expect(jsxSeamless).toContain('<AlatStatusPerkara\n          varian="seamless"');
    expect(jsxSeamless).toContain("Cari perkara lain");
    expect(jsxSeamless).toContain("onClick={onKembali}");
  });

  it("tampilan Kompleks tidak membungkus apa pun selain isinya", () => {
    expect(berkasStatus).toContain('seamless ? "contents" : "grid gap-3 lg:grid-cols-2"');
  });

  it("toggle ada di kartu luar, berdampingan dengan judul", () => {
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

  it("bawaannya Kompleks sampai pengguna memilih", () => {
    expect(TAMPILAN_BAWAAN).toBe("kompleks");
    const { result } = renderHook(() => useTampilanStatus("u1"));
    expect(result.current[0]).toBe("kompleks");
  });

  it("pilihan disimpan per pengguna dan dibaca kembali", () => {
    const a = renderHook(() => useTampilanStatus("u1"));
    act(() => a.result.current[1]("seamless"));
    expect(window.localStorage.getItem(kunciTampilanStatus("u1"))).toBe("seamless");
    const lagi = renderHook(() => useTampilanStatus("u1"));
    expect(lagi.result.current[0]).toBe("seamless");
    const lain = renderHook(() => useTampilanStatus("u2"));
    expect(lain.result.current[0]).toBe("kompleks");
  });

  it("nilai simpanan yang rusak diabaikan", () => {
    window.localStorage.setItem(kunciTampilanStatus("u3"), "aneh");
    expect(renderHook(() => useTampilanStatus("u3")).result.current[0]).toBe("kompleks");
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

  it("pada Kompleks hanya menggambar isinya - tanpa kartu, tanpa tombol", () => {
    const { container } = render(
      <KelompokKartu id="A" seamless={false} ringkas="x">
        <p>isi</p>
      </KelompokKartu>
    );
    expect(container.innerHTML).toBe("<p>isi</p>");
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
    expect(window.localStorage.getItem("aleta.status-perkara.kelompok.B")).toBe("1");
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
