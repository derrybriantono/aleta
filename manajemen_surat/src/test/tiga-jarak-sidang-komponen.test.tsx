import { act, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Profiler, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LegendaTigaJarak,
  LencanaMenungguBerjalan,
  TigaJarakSidang,
  jumlahPendengarDetak,
  type PatokanWaktu,
} from "@/components/portal/tiga-jarak-sidang";
import {
  bacaWaktu,
  hitungTigaJarak,
  kunciWaktu,
  type BarisWaktuAntrian,
  type TetanggaJarak,
} from "@/lib/tiga-jarak-sidang";

/**
 * ============================================================================
 * TIGA JARAK DI LAYAR - YANG BERDETAK, DAN YANG TIDAK BOLEH IKUT BERDETAK
 * ============================================================================
 *
 * Yang dijaga di sini PERILAKU yang tergambar, bukan teks berkasnya:
 *
 *   - angka yang berjalan bertambah tiap detik;
 *   - yang dilukis ulang hanya angka itu - induknya (baris tabel) tidak;
 *   - "sekarang" datang dari jam aplikasi antrian, bukan jam komputer;
 *   - lencana "menunggu lama" muncul TEPAT pada detik ambangnya terlewati;
 *   - tetangganya disebut di title, termasuk yang tidak tampil;
 *   - pengatur waktunya berhenti sendiri begitu tidak ada yang berjalan.
 */

const HARI = "2026-09-27";

function baris(ubah: Partial<BarisWaktuAntrian> & { perkaraId: string }): BarisWaktuAntrian {
  return {
    tanggalSidang: HARI,
    nomorAntrian: null,
    noRuang: 1,
    ruanganId: 1,
    ambilPihak1: "",
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: "",
    jamJadwal: "",
    panggilPertama: "",
    panggilTerakhir: "",
    jumlahPanggil: 0,
    online: null,
    namaPetugas: "",
    sumber: "rekaman",
    ...ubah,
  };
}

const A = baris({ perkaraId: "1", nomorAntrian: 1, ambilTerawal: `${HARI} 08:10:00`, panggilTerakhir: `${HARI} 09:00:00` });
const B = baris({
  perkaraId: "2",
  nomorAntrian: 2,
  ambilTerawal: `${HARI} 08:20:30`,
  panggilPertama: `${HARI} 09:05:00`,
  panggilTerakhir: `${HARI} 09:12:30`,
  jumlahPanggil: 2,
});
const W = baris({ perkaraId: "4", nomorAntrian: 6, ambilTerawal: `${HARI} 09:10:00` });
const TIGA = hitungTigaJarak([A, B, W], { hariIni: HARI });
const k = (b: BarisWaktuAntrian) => kunciWaktu(b.tanggalSidang, b.perkaraId);

const NOMOR_PERKARA: Record<string, string> = { "1": "1/Pdt.G/2026/PA.Dgl" };
const sebut = (t: TetanggaJarak) =>
  NOMOR_PERKARA[t.perkaraId]
    ? `antrian ${t.nomorAntrian} (${NOMOR_PERKARA[t.perkaraId]})`
    : `antrian ${t.nomorAntrian} (perkara yang tidak tampil pada daftar ini)`;

/** Patokan: jam antrian pada `jamAntrian`, diterima SEKARANG menurut jam (palsu) peramban. */
function patokanPada(jamAntrian: string): PatokanWaktu {
  return { sekarangMs: bacaWaktu(`${HARI} ${jamAntrian}`)!, diterimaMs: Date.now() };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("angka yang berjalan berdetak sendiri", () => {
  it("lama sidang yang berjalan bertambah tiap detik, bertanda 'berjalan'", () => {
    // B terakhir dipanggil di Ruang 1 -> sidangnya berjalan sejak 09:12:30.
    const patokan = patokanPada("09:17:30");
    const { container } = render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    const lama = container.querySelector('[data-jarak="sidang"]')!;
    expect(lama.getAttribute("data-keadaan")).toBe("berjalan");
    expect(lama.textContent).toContain("05:00");
    expect(lama.textContent).toContain("berjalan");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(lama.textContent).toContain("05:03");
  });

  it("induknya TIDAK dilukis ulang tiap detik - hanya angkanya", () => {
    let lukisInduk = 0;
    const patokan = patokanPada("09:17:30");
    function Induk({ children }: { children: ReactNode }) {
      lukisInduk += 1;
      return <div>{children}</div>;
    }
    const { container } = render(
      <Profiler id="tabel" onRender={() => undefined}>
        <Induk>
          <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />
        </Induk>
      </Profiler>
    );
    const sebelum = lukisInduk;
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(container.querySelector('[data-jarak="sidang"]')!.textContent).toContain("05:10");
    expect(lukisInduk).toBe(sebelum);
  });

  it("jam komputer yang salah setel TIDAK mengubah angkanya", () => {
    // Komputer petugas bertanggal 2031 - salah empat tahun. Yang dipakai
    // hanya beda Date.now() sejak data diterima; angkanya tetap dari jam
    // aplikasi antrian.
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    const patokan = patokanPada("09:17:30");
    const { container } = render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    expect(container.querySelector('[data-jarak="sidang"]')!.textContent).toContain("05:00");
  });

  it("pengatur waktu berhenti sendiri begitu tidak ada angka yang berjalan", () => {
    const patokan = patokanPada("09:17:30");
    const { unmount } = render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    expect(jumlahPendengarDetak()).toBeGreaterThan(0);
    unmount();
    expect(jumlahPendengarDetak()).toBe(0);

    // Baris yang seluruh angkanya sudah tetap tidak mendengar detak sama sekali.
    render(<TigaJarakSidang tiga={TIGA[k(A)]} baris={A} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />);
    expect(jumlahPendengarDetak()).toBe(0);
  });

  it("titik berjalan berdenyut hanya bila gerak tidak diminta dikurangi", () => {
    const patokan = patokanPada("09:17:30");
    const { container } = render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    const titik = container.querySelector('[data-jarak="sidang"] [aria-hidden]')!;
    expect(titik.className).toContain("motion-safe:animate-pulse");
    expect(titik.className).not.toMatch(/(^|\s)animate-pulse/);
  });

  it("tanpa jam antrian: tertulis berjalan tanpa angka karangan", () => {
    const { container } = render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={null} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    const lama = container.querySelector('[data-jarak="sidang"]')!;
    expect(lama.textContent).toContain("berjalan");
    expect(lama.textContent).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe("yang tergambar dan title-nya", () => {
  it("tiga baris bernama; yang pertama di ruangnya tertulis 'pertama'", () => {
    const { container } = render(
      <TigaJarakSidang tiga={TIGA[k(A)]} baris={A} patokan={patokanPada("09:30:00")} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    expect(container.querySelector('[data-jarak="tunggu"]')!.textContent).toContain("50 menit");
    expect(container.querySelector('[data-jarak="sebelum"]')!.textContent).toContain("pertama");
    expect(container.querySelector('[data-jarak="sidang"]')!.textContent).toContain("12 menit");
  });

  it("title menyebut tetangga dengan nomor antrian DAN nomor perkaranya", () => {
    render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokanPada("09:30:00")} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    const sebelum = screen.getByText("12 menit");
    expect(sebelum.getAttribute("title")).toContain("antrian 1 (1/Pdt.G/2026/PA.Dgl)");
    expect(sebelum.getAttribute("title")).toContain("bukan baris di atasnya");
  });

  it("tetangga yang tidak tampil disebut, tidak didiamkan", () => {
    render(
      <TigaJarakSidang tiga={TIGA[k(A)]} baris={A} patokan={patokanPada("09:30:00")} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    // Tetangga A di depan adalah B - yang nomor perkaranya tidak dikenal.
    expect(screen.getByText("12 menit").getAttribute("title")).toContain("(perkara yang tidak tampil pada daftar ini)");
  });

  it("panggilan ulang disebutkan di title Tunggu", () => {
    render(
      <TigaJarakSidang tiga={TIGA[k(B)]} baris={B} patokan={patokanPada("09:30:00")} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    const tunggu = screen.getByText("52 menit");
    expect(tunggu.getAttribute("title")).toContain("Dipanggil 2 kali");
    expect(tunggu.getAttribute("title")).toContain("09:05:00");
  });

  it("baris tanpa satu pun jarak tidak menggambar apa pun", () => {
    const kosong = hitungTigaJarak([baris({ perkaraId: "30" })], { hariIni: HARI });
    const { container } = render(
      <TigaJarakSidang
        tiga={kosong[kunciWaktu(HARI, "30")]}
        baris={undefined}
        patokan={null}
        ambangTungguMenit={40}
        sebutTetangga={sebut}
      />
    );
    expect(container.textContent).toBe("");
  });

  it("nomor dari rekaman disebut bila kolomnya sendiri tidak punya nomor", () => {
    render(
      <TigaJarakSidang
        tiga={TIGA[k(A)]}
        baris={A}
        patokan={null}
        ambangTungguMenit={40}
        sebutTetangga={sebut}
        nomorRekaman={1}
      />
    );
    expect(screen.getByText("antrian 1 · rekaman")).toBeTruthy();
  });

  it("legenda menyebut ketiga nama dan ambang yang dikirim", () => {
    const { container } = render(<LegendaTigaJarak ambangTungguMenit={40} />);
    for (const nama of ["Tunggu", "Dari sebelumnya", "Lama sidang", "sesudah 40 menit", "berjalan"]) {
      expect(container.textContent).toContain(nama);
    }
  });
});

describe("Tunggu dan lencana menunggu lama memakai angka yang sama", () => {
  it("lencana muncul TEPAT saat ambang 40 menit terlewati, dan berwarna", () => {
    // W mengambil 09:10:00; jam antrian 09:49:58 -> 39 menit 58 detik.
    const patokan = patokanPada("09:49:58");
    const { container } = render(
      <LencanaMenungguBerjalan jarak={TIGA[k(W)].tunggu} patokan={patokan} ambangMenit={40} />
    );
    expect(container.textContent).toBe("");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.textContent).toContain("menunggu 40:01");
    expect(container.querySelector("span")!.className).toContain("bg-red-100");
  });

  it("Tunggu yang berjalan netral di bawah ambang, memerah di atasnya", () => {
    const patokan = patokanPada("09:49:58");
    const { container } = render(
      <TigaJarakSidang tiga={TIGA[k(W)]} baris={W} patokan={patokan} ambangTungguMenit={40} sebutTetangga={sebut} />
    );
    const keping = () => container.querySelector('[data-jarak="tunggu"] span[title]')!;
    expect(keping().className).not.toContain("bg-red-100");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector('[data-jarak="tunggu"]')!.textContent).toContain("40:01");
    expect(keping().className).toContain("bg-red-100");
  });
});

describe("tersambung ke layar jadwal sidang", () => {
  const layar = readFileSync(
    path.join(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
    "utf8"
  );

  it("patokan dibuat dari 'sekarang' jam antrian, bukan dari jam komputer", () => {
    // Satu-satunya Date.now() pada jalur ini menandai KAPAN data diterima.
    expect(layar).toContain("const sekarangMs = bacaWaktu(waktu.sekarang);");
    expect(layar).toContain("setPatokanWaktu(sekarangMs === null ? null : { sekarangMs, diterimaMs: Date.now() });");
  });

  it("dihitung atas SELURUH baris waktu, bukan atas sidangTampil", () => {
    const i = layar.indexOf("const tigaJarak = useMemo(");
    const blok = layar.slice(i, layar.indexOf("  );", i));
    expect(blok).toContain("hitungTigaJarak(waktuAntrian.baris");
    expect(blok).not.toContain("sidangTampil");
  });
});
