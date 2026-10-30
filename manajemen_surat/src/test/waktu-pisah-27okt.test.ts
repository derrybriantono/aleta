// @vitest-environment node
/**
 * 27 OKT 2026 - 0222/0246/9944/7035: ungkapan waktu hari raya, lama pisah perkiraan ("lebih kurang"),
 * dan siapa yang pergi/diusir/pulang ke rumah orang tua.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Usulan = { kode: string; nilai: string; keyakinan?: string; catatan?: string; petunjukWaktu?: { perkiraan?: string }[] };
const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const layanan = require_(path.join(AKAR, "services/abtUsulanService.js")) as {
  dariKeteranganSaksi: (a: string, b: string, sidang?: string, pihak?: { pelaku?: string; lawan?: string }, posita?: string) => { usulan: Usulan[] };
};
const bas = (...b: string[]) => b.map((x) => `- Bahwa ${x};`).join("\n");
const SIDANG = "10 Oktober 2026";
const jalan = (kalimat: string, pihak = { pelaku: "Tergugat", lawan: "Penggugat" }) => {
  const h = layanan.dariKeteranganSaksi(bas(kalimat), "", SIDANG, pihak, "");
  const u = (k: string) => h.usulan.find((x) => x.kode === k)!;
  return { awal: u("0222"), pisah: u("0246"), lama: u("9944"), pergi: u("7035") };
};

describe("hari raya -> bulan perkiraan (petunjuk 0222/0246)", () => {
  it.each([
    ["sejak bulan Ramadhan tahun 2024 sering bertengkar", "bulan Maret 2024"],
    ["sejak Lebaran tahun 2023 sering bertengkar", "bulan April 2023"],
    ["sejak Idul Fitri 2024 mulai tidak rukun", "bulan April 2024"],
    ["sejak Idul Adha 2025 sering cekcok", "bulan Juni 2025"],
    ["sejak tahun baru 2025 sering bertengkar", "bulan Januari 2025"],
    ["sejak lebaran tahun ini sering bertengkar", "bulan Maret 2026"],
  ])("%s", (kalimat, perkiraan) => {
    expect(jalan(kalimat).awal.petunjukWaktu![0].perkiraan).toBe(perkiraan);
  });
});

describe("9944 lama pisah dihitung dari 0246", () => {
  it("bulan jelas: dihitung pasti seperti semula", () => {
    const r = jalan("Penggugat dan Tergugat sudah pisah tempat tinggal sejak Agustus 2025");
    expect(r.pisah.nilai).toBe("bulan Agustus 2025");
    expect(r.lama.nilai).toBe("1 tahun 2 bulan");
  });

  it("hanya tahun atau awal/akhir tahun: perkiraan 'lebih kurang', keyakinan ragu", () => {
    const a = jalan("Penggugat dan Tergugat pisah rumah sejak awal tahun 2024");
    expect(a.lama.nilai).toBe("lebih kurang 2 tahun 9 bulan");
    expect(a.lama.keyakinan).toBe("ragu");
    expect(a.lama.catatan).toContain("perkiraan");
    const b = jalan("Penggugat dan Tergugat telah pisah ranjang sejak 2022");
    expect(b.lama.nilai).toBe("lebih kurang 4 tahun");
  });

  it("lama yang disebut langsung tetap didahulukan", () => {
    expect(jalan("Penggugat dan Tergugat telah pisah selama kurang lebih 1 tahun 3 bulan").lama.nilai).toBe("1 tahun 3 bulan");
    expect(jalan("sudah hampir 8 bulan Tergugat pergi meninggalkan Penggugat").lama.nilai).toBe("8 bulan");
  });
});

describe("0246 dan 7035: pulang ke rumah orang tua, diusir", () => {
  it("pulang ke rumah orang tua -> yang pergi dan sejak kapan", () => {
    const r = jalan("Tergugat pulang ke rumah orang tuanya sejak Agustus 2025");
    expect(r.pergi.nilai).toBe("Tergugat");
    expect(r.pisah.nilai).toBe("bulan Agustus 2025");
  });

  it("diusir: yang diusir yang meninggalkan kediaman (Penggugat), bukan yang mengusir", () => {
    const r = jalan("Penggugat diusir Tergugat sejak 14 Februari 2025");
    expect(r.pergi.nilai).toBe("Penggugat");
    // 31 Okt (keputusan pengguna butir 16): tanggal yang disebut saksi disimpan lengkap.
    expect(r.pisah.nilai).toBe("tanggal 14 Februari 2025");
    expect(jalan("Tergugat mengusir Penggugat dari rumah sejak Februari 2025").pergi.nilai).toBe("Penggugat");
  });

  it("cerai talak memakai sebutan Pemohon/Termohon", () => {
    const r = jalan("Termohon pulang ke rumah orang tuanya sejak Agustus 2025", { pelaku: "Termohon", lawan: "Pemohon" });
    expect(r.pergi.nilai).toBe("Termohon");
  });

  it("bentuk lama tidak berubah: Tergugat pergi meninggalkan Penggugat", () => {
    expect(jalan("Tergugat pergi meninggalkan Penggugat sejak Lebaran tahun 2023").pergi.nilai).toBe("Tergugat");
  });
});
