/**
 * ============================================================================
 * PAPAN PANGGIL ANTRIAN: PANGGILAN LENGKAP (22 Okt 2026, W59)
 * ============================================================================
 *
 * Permintaan hakim: majelis hakim dan panitera sidang dipisah; majelis dapat
 * dipanggil per nama hakim; setiap panggilan menyebut nama, jabatan, dan
 * ruang; para pihak dipanggil dengan nomor perkara, jenis perkara, nama dan
 * sebutannya ("melawan" bila berhadapan), ruang, dan panggilan keberapa;
 * saksi satu per satu atau semuanya; mediator ke ruang mediasi.
 *
 * Yang dijaga, dan DIJALANKAN:
 *   - lib: terbilang, urutan, pengucap nomor perkara, kalimat tiap jenis;
 *   - layar: tombol Semua majelis / per hakim / Panitera sidang terpisah, kalimat
 *     yang sungguh dikirim ke pengeras suara, panggilan ke-N dari catatan,
 *     saksi satu-satu dan semua, tanpa NIK/alamat.
 *
 * Nama di sini karangan.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  daftarNama,
  hakimYangDipanggil,
  jabatanHakim,
  kalimatHakim,
  kalimatJuruSita,
  kalimatMediator,
  kalimatPanggilPihak,
  kalimatPanitera,
  kalimatPihakBerperkara,
  kalimatRohaniwan,
  kalimatSaksi,
  kalimatSaksiKetik,
  kalimatSemuaMajelis,
  kalimatSemuaSaksi,
  terbilang,
  ucapkanJenisPerkara,
  ucapkanNomorPerkara,
  urutanPanggilan,
  type OrangPanggil,
} from "@/lib/kalimat-panggilan";

const suara = vi.hoisted(() => ({ bunyi: [] as string[] }));

vi.mock("@/lib/suara-panggilan", () => ({
  hentikanUcapan: vi.fn(),
  useSuaraPanggilan: () => ({
    daftar: [],
    terpilih: "",
    pilih: () => undefined,
    bunyikan: (kalimat: string) => {
      suara.bunyi.push(kalimat);
      return true;
    },
    didukung: true,
  }),
}));
vi.mock("@/lib/pengumuman-suara-layar", () => ({ usePengumumanSuara: () => undefined }));
vi.mock("@/components/portal/jadwal-sidang-2okt", () => ({ PanelRuangPapanPanggil: () => null }));
vi.mock("@/components/portal/kehadiran-rinci-sidang", () => ({ RingkasKehadiran: () => null }));

import { AletaAntrianPanggil } from "@/components/portal/aleta-antrian-panggil";

// ----------------------------------------------------------------------------
// Bahan
// ----------------------------------------------------------------------------

const GUGATAN: OrangPanggil[] = [
  { kunci: "pihak1:1", golongan: "pihak1", nama: "Adi bin Budi", peran: "Penggugat" },
  { kunci: "kuasa1:9", golongan: "pihak1", nama: "Kuasa Uji, S.H.", peran: "Kuasa Penggugat" },
  { kunci: "pihak2:2", golongan: "pihak2", nama: "Eri binti Cahya", peran: "Tergugat" },
];

const CERAI_TALAK: OrangPanggil[] = [
  { kunci: "pihak1:1", golongan: "pihak1", nama: "Dedi bin Fajar", peran: "Pemohon" },
  { kunci: "pihak2:2", golongan: "pihak2", nama: "Gita binti Hadi", peran: "Termohon" },
];

const PERMOHONAN: OrangPanggil[] = [{ kunci: "pihak1:1", golongan: "pihak1", nama: "Indra bin Joko", peran: "Pemohon" }];

// ----------------------------------------------------------------------------
// LIB
// ----------------------------------------------------------------------------

describe("angka dan urutan", () => {
  it("terbilang bilangan Indonesia", () => {
    expect(terbilang(0)).toBe("nol");
    expect(terbilang(11)).toBe("sebelas");
    expect(terbilang(15)).toBe("lima belas");
    expect(terbilang(21)).toBe("dua puluh satu");
    expect(terbilang(100)).toBe("seratus");
    expect(terbilang(109)).toBe("seratus sembilan");
    expect(terbilang(609)).toBe("enam ratus sembilan");
    expect(terbilang(1000)).toBe("seribu");
    expect(terbilang(1500)).toBe("seribu lima ratus");
    expect(terbilang(2026)).toBe("dua ribu dua puluh enam");
    expect(terbilang(12345)).toBe("dua belas ribu tiga ratus empat puluh lima");
  });

  it("panggilan pertama, kedua, ketiga, dan seterusnya", () => {
    expect(urutanPanggilan(1)).toBe("pertama");
    expect(urutanPanggilan(2)).toBe("kedua");
    expect(urutanPanggilan(3)).toBe("ketiga");
    expect(urutanPanggilan(10)).toBe("kesepuluh");
    expect(urutanPanggilan(11)).toBe("ke sebelas");
    expect(urutanPanggilan(0)).toBe("pertama");
  });
});

describe("pengucap nomor perkara", () => {
  it("perkara gugatan", () => {
    expect(ucapkanNomorPerkara("609/Pdt.G/2026/PA.Dgl")).toBe(
      "perkara nomor enam ratus sembilan, P D T G, tahun dua ribu dua puluh enam"
    );
  });

  it("permohonan dan nomor satu angka", () => {
    expect(ucapkanNomorPerkara("7/Pdt.P/2026/PA.Dgl")).toBe("perkara nomor tujuh, P D T P, tahun dua ribu dua puluh enam");
  });

  it("kode berhuruf kecil dan bertitik dieja per huruf", () => {
    expect(ucapkanNomorPerkara("12/Pdt.Plw/2025/PA.Dgl")).toBe(
      "perkara nomor dua belas, P D T P L W, tahun dua ribu dua puluh lima"
    );
  });

  it("bentuk tak dikenal diucapkan apa adanya, kosong tetap kosong", () => {
    expect(ucapkanNomorPerkara("Nomor aneh")).toBe("perkara nomor Nomor aneh");
    expect(ucapkanNomorPerkara("")).toBe("");
    expect(ucapkanNomorPerkara(null)).toBe("");
  });

  it("jenis perkara: garis miring tidak dibaca slash", () => {
    expect(ucapkanJenisPerkara("Pengesahan Perkawinan/Istbat Nikah")).toBe("Pengesahan Perkawinan atau Istbat Nikah");
  });
});

describe("para pihak dengan sebutannya", () => {
  it("gugatan memakai kata melawan, kuasa tidak ikut", () => {
    expect(kalimatPihakBerperkara(GUGATAN)).toBe("Adi bin Budi sebagai Penggugat melawan Eri binti Cahya sebagai Tergugat");
  });

  it("cerai talak: Pemohon melawan Termohon", () => {
    expect(kalimatPihakBerperkara(CERAI_TALAK)).toBe(
      "Dedi bin Fajar sebagai Pemohon melawan Gita binti Hadi sebagai Termohon"
    );
  });

  it("permohonan murni tanpa melawan", () => {
    const teks = kalimatPihakBerperkara(PERMOHONAN);
    expect(teks).toBe("Indra bin Joko sebagai Pemohon");
    expect(teks).not.toContain("melawan");
  });

  it("banyak pihak: sampai tiga disebut semua, lebihnya dan kawan-kawan", () => {
    const tiga: OrangPanggil[] = ["A", "B", "C"].map((n, i) => ({
      kunci: `pihak1:${i}`,
      golongan: "pihak1",
      nama: `${n} Uji`,
      peran: "Penggugat",
    }));
    const lawan: OrangPanggil = { kunci: "pihak2:1", golongan: "pihak2", nama: "Z Uji", peran: "Tergugat" };
    expect(kalimatPihakBerperkara([...tiga, lawan])).toBe("A Uji, B Uji, dan C Uji sebagai Penggugat melawan Z Uji sebagai Tergugat");
    const empat: OrangPanggil[] = [...tiga, { kunci: "pihak1:9", golongan: "pihak1", nama: "D Uji", peran: "Penggugat" }];
    expect(kalimatPihakBerperkara([...empat, lawan])).toBe("A Uji dan kawan-kawan sebagai Penggugat melawan Z Uji sebagai Tergugat");
    expect(daftarNama(["A", "B"])).toBe("A dan B");
  });

  it("turut tergugat ditambahkan di belakang", () => {
    const orang: OrangPanggil[] = [
      ...GUGATAN,
      { kunci: "pihak4:3", golongan: "pihak4", nama: "Kantor Uji", peran: "Turut Tergugat" },
    ];
    expect(kalimatPihakBerperkara(orang)).toBe(
      "Adi bin Budi sebagai Penggugat melawan Eri binti Cahya sebagai Tergugat, serta Kantor Uji sebagai Turut Tergugat"
    );
  });

  it("nama diucapkan apa adanya: bin, binti, alias tetap ada; tanpa NIK atau alamat", () => {
    const orang: OrangPanggil[] = [
      { kunci: "pihak1:1", golongan: "pihak1", nama: "Adi alias Edi bin Budi", peran: "Penggugat" },
    ];
    const teks = kalimatPanggilPihak({ nomorAntrian: 1, noRuang: 1, panggilanKe: 1, orang });
    expect(teks).toContain("Adi alias Edi bin Budi sebagai Penggugat");
    expect(teks).not.toMatch(/\d{8,}/);
  });
});

describe("kalimat panggilan para pihak", () => {
  it("gugatan: antrian, nomor perkara, jenis, pihak, ruang, panggilan pertama", () => {
    expect(
      kalimatPanggilPihak({
        nomorAntrian: 3,
        noRuang: 2,
        panggilanKe: 1,
        nomorPerkara: "609/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        orang: GUGATAN,
      })
    ).toBe(
      "Panggilan pertama. Nomor antrian 3, perkara nomor enam ratus sembilan, P D T G, tahun dua ribu dua puluh enam, Cerai Gugat, Adi bin Budi sebagai Penggugat melawan Eri binti Cahya sebagai Tergugat. Silakan menuju Ruang Sidang 2."
    );
  });

  it("cerai talak: Pemohon melawan Termohon", () => {
    const teks = kalimatPanggilPihak({
      nomorAntrian: 5,
      noRuang: 1,
      panggilanKe: 2,
      nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Talak",
      orang: CERAI_TALAK,
    });
    expect(teks).toContain("Panggilan kedua.");
    expect(teks).toContain("Dedi bin Fajar sebagai Pemohon melawan Gita binti Hadi sebagai Termohon");
    expect(teks).toContain("Silakan menuju Ruang Sidang 1.");
  });

  it("permohonan: tanpa kata melawan", () => {
    const teks = kalimatPanggilPihak({
      nomorAntrian: 8,
      noRuang: 4,
      panggilanKe: 3,
      nomorPerkara: "7/Pdt.P/2026/PA.Dgl",
      jenisPerkara: "Dispensasi Kawin",
      orang: PERMOHONAN,
    });
    expect(teks).toContain("Panggilan ketiga.");
    expect(teks).toContain("Indra bin Joko sebagai Pemohon");
    expect(teks).not.toContain("melawan");
  });

  it("tanpa bahan sasaran kembali ke nomor antrian dan ruang; ruang kosong tidak disebut nol", () => {
    const teks = kalimatPanggilPihak({ nomorAntrian: 4, noRuang: null, panggilanKe: 1 });
    expect(teks).toBe("Panggilan pertama. Nomor antrian 4. Silakan memasuki ruang sidang.");
    expect(teks).not.toMatch(/ruang sidang 0/i);
  });
});

describe("petugas: nama, jabatan, ruang", () => {
  it("jabatan hakim", () => {
    expect(jabatanHakim("Hakim Ketua")).toBe("Ketua Majelis");
    expect(jabatanHakim("Hakim Anggota")).toBe("Hakim Anggota");
    expect(jabatanHakim("Hakim Tunggal")).toBe("Hakim Tunggal");
  });

  it("satu hakim dipanggil dengan namanya", () => {
    expect(kalimatHakim("Hakim Satu, S.H.", "Hakim Ketua", "Ruang Sidang 2")).toBe(
      "Yang Mulia Hakim Satu, S.H., Ketua Majelis, dimohon menuju Ruang Sidang 2."
    );
    expect(kalimatHakim("Hakim Dua, S.H.", "Hakim Anggota", "Ruang Sidang 2")).toBe(
      "Yang Mulia Hakim Dua, S.H., Hakim Anggota, dimohon menuju Ruang Sidang 2."
    );
  });

  it("semua majelis dalam satu kalimat", () => {
    const teks = kalimatSemuaMajelis(
      [
        { nama: "Hakim Satu", peran: "Hakim Ketua" },
        { nama: "Hakim Dua", peran: "Hakim Anggota" },
        { nama: "Hakim Tiga", peran: "Hakim Anggota" },
      ],
      "Ruang Sidang 1"
    );
    expect(teks).toBe(
      "Majelis hakim, Yang Mulia Hakim Satu, Ketua Majelis, Yang Mulia Hakim Dua, Hakim Anggota, dan Yang Mulia Hakim Tiga, Hakim Anggota, dimohon menuju Ruang Sidang 1."
    );
  });

  it("panitera, juru sita, rohaniwan", () => {
    expect(kalimatPanitera(["Panitera Uji, S.H."], "Ruang Sidang 3")).toBe(
      "Panitera Uji, S.H., Panitera Pengganti, dimohon menuju Ruang Sidang 3."
    );
    expect(kalimatJuruSita(["Jurusita Uji"], "Ruang Sidang 3")).toBe("Jurusita Uji, Juru Sita, dimohon menuju Ruang Sidang 3.");
    expect(kalimatRohaniwan("", "Ruang Sidang 3")).toBe("Petugas Rohaniwan, dimohon menuju Ruang Sidang 3.");
    expect(kalimatRohaniwan("Rohaniwan Uji", "Ruang Sidang 3")).toBe(
      "Rohaniwan Uji, Petugas Rohaniwan, dimohon menuju Ruang Sidang 3."
    );
  });

  it("mediator dipanggil ke ruang mediasi, bukan ruang sidang", () => {
    const teks = kalimatMediator(["Mediator Uji, S.H."]);
    expect(teks).toBe("Mediator Uji, S.H., Mediator, dimohon menuju ruang mediasi.");
    expect(teks).not.toMatch(/ruang sidang/i);
  });

  it("sidang keliling: hakim pilihan menggantikan majelis penuh hanya bila saklar menyala", () => {
    const majelis = [
      { nama: "Hakim Satu, S.H.", peran: "Hakim Ketua" },
      { nama: "Hakim Dua, S.H.", peran: "Hakim Anggota" },
    ];
    expect(hakimYangDipanggil(majelis, { hakimNama: "Hakim Dua, S.H." }, false)).toHaveLength(2);
    // Anggota majelis yang dipilih memakai jabatannya di majelis.
    expect(hakimYangDipanggil(majelis, { hakimNama: "Hakim Dua, S.H." }, true)).toEqual([
      { nama: "Hakim Dua, S.H.", peran: "Hakim Anggota", pengganti: false },
    ]);
    // Hakim di luar majelis = Hakim Pengganti.
    expect(hakimYangDipanggil(majelis, { hakimNama: "Hakim Luar, S.H." }, true)).toEqual([
      { nama: "Hakim Luar, S.H.", peran: "Hakim Pengganti", pengganti: true },
    ]);
  });
});

describe("saksi", () => {
  const SAKSI = [
    { nama: "Saksi Satu", peran: "Saksi Penggugat" },
    { nama: "Saksi Dua", peran: "Saksi Tergugat" },
  ];

  it("satu per satu dengan sisi yang menghadirkan", () => {
    expect(kalimatSaksi(SAKSI[0], "Ruang Sidang 2")).toBe(
      "Saksi Satu, saksi dari pihak Penggugat, dimohon menuju Ruang Sidang 2."
    );
    expect(kalimatSaksi(SAKSI[1], "Ruang Sidang 2")).toBe("Saksi Dua, saksi dari pihak Tergugat, dimohon menuju Ruang Sidang 2.");
  });

  it("semua saksi: satu kalimat per saksi, berurutan", () => {
    expect(kalimatSemuaSaksi(SAKSI, "Ruang Sidang 2")).toEqual([
      "Saksi Satu, saksi dari pihak Penggugat, dimohon menuju Ruang Sidang 2.",
      "Saksi Dua, saksi dari pihak Tergugat, dimohon menuju Ruang Sidang 2.",
    ]);
  });

  it("saksi yang belum tercatat: kalimat lama tetap", () => {
    expect(kalimatSaksiKetik("  Saksi Tiga ", "Ruang Sidang 2")).toBe("Saksi atas nama Saksi Tiga, dimohon memasuki Ruang Sidang 2.");
  });
});

// ----------------------------------------------------------------------------
// LAYAR
// ----------------------------------------------------------------------------

type OrangRute = { kunci: string; golongan: string; nama: string; peran: string };

const ORANG_RUTE: OrangRute[] = [
  { kunci: "hakim:1", golongan: "majelis", nama: "Hakim Satu, S.H.", peran: "Hakim Ketua" },
  { kunci: "hakim:2", golongan: "majelis", nama: "Hakim Dua, S.H.", peran: "Hakim Anggota" },
  { kunci: "pp:1", golongan: "pp", nama: "Panitera Uji, S.H.", peran: "Panitera Pengganti" },
  { kunci: "js:1", golongan: "js", nama: "Jurusita Uji", peran: "Juru Sita" },
  { kunci: "mediator:1", golongan: "mediator", nama: "Mediator Uji, S.H.", peran: "Mediator" },
  { kunci: "pihak1:1", golongan: "pihak1", nama: "Adi bin Budi", peran: "Penggugat" },
  { kunci: "kuasa1:9", golongan: "pihak1", nama: "Kuasa Uji, S.H.", peran: "Kuasa Penggugat" },
  { kunci: "pihak2:2", golongan: "pihak2", nama: "Eri binti Cahya", peran: "Tergugat" },
  { kunci: "saksi1:5", golongan: "saksi1", nama: "Saksi Satu", peran: "Saksi Penggugat" },
  { kunci: "saksi2:6", golongan: "saksi2", nama: "Saksi Dua", peran: "Saksi Tergugat" },
];

const tiruan = vi.hoisted(() => ({
  panggilan: { jumlah: 1 },
  keliling: false,
  pilihan: {} as Record<string, unknown>,
  urutanBaru: 2,
  urls: [] as string[],
}));

function jawab(isi: unknown) {
  return Promise.resolve({ json: async () => ({ data: isi }) } as unknown as Response);
}

beforeEach(() => {
  suara.bunyi = [];
  tiruan.panggilan = { jumlah: 1 };
  tiruan.keliling = false;
  tiruan.pilihan = {};
  tiruan.urutanBaru = 2;
  tiruan.urls = [];
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom */
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const alamat = String(url);
      tiruan.urls.push(alamat);
      if (alamat.includes("/api/aleta-ecourt/antrian/panggil")) {
        return jawab({ ok: true, urutan: tiruan.urutanBaru, keterangan: `Panggilan ke-${tiruan.urutanBaru} dari 3.` });
      }
      if (alamat.includes("/api/aleta-ecourt/antrian")) {
        return jawab({
          available: true,
          terbaca: true,
          alasan: "",
          tanggal: ["2026-10-22"],
          peta: {
            "77": {
              nomor: 3,
              keadaan: "menunggu",
              jamPanggil: "",
              noRuang: 2,
              majelisKode: "AB",
              waktuAmbil: "",
              online: false,
            },
          },
          kehadiran: {},
          panggilan: {
            "77": { jumlah: tiruan.panggilan.jumlah, batas: 3, sudahBatas: false, panggilan: [] },
          },
        });
      }
      if (alamat.includes("/api/aleta-ecourt/panggil/sasaran")) {
        return jawab({
          available: true,
          perkara: { nomorPerkara: "609/Pdt.G/2026/PA.Dgl", jenisPerkaraNama: "Cerai Gugat" },
          orang: ORANG_RUTE,
        });
      }
      if (alamat.includes("/api/aleta-ecourt/sidang/keliling")) return jawab({ keliling: { aktif: tiruan.keliling } });
      if (alamat.includes("/api/aleta-ecourt/sidang/hakim-sidang")) return jawab({ pilihan: tiruan.pilihan });
      return jawab({});
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function bukaLayar() {
  render(createElement(AletaAntrianPanggil));
  await screen.findByText("Berikutnya");
  // Nyalakan suara; kalimat pembuka ("siap") dibuang dari catatan uji.
  fireEvent.click(await screen.findByRole("button", { name: "Suara mati" }));
  suara.bunyi = [];
  // Bahan sasaran sudah dimuat: tombol hakim muncul.
  await screen.findByRole("button", { name: /Hakim Satu, S\.H\./ });
}

describe("papan panggil: tombol terpisah", () => {
  it("Majelis hakim dan Panitera sidang adalah tombol berbeda, tidak ada lagi 'Majelis / PP'", async () => {
    await bukaLayar();
    expect(screen.queryByRole("button", { name: /Majelis \/ PP/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Semua majelis" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Panitera sidang" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hakim Satu, S\.H\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hakim Dua, S\.H\./ })).toBeTruthy();
    for (const nama of ["Juru sita", "Rohaniwan", "Petugas mediasi", "Petugas persidangan", "Mediator"]) {
      expect(screen.getByRole("button", { name: nama }), nama).toBeTruthy();
    }
  });

  it("per hakim: nama, jabatan, ruang", async () => {
    await bukaLayar();
    fireEvent.click(screen.getByRole("button", { name: /Hakim Satu, S\.H\./ }));
    fireEvent.click(screen.getByRole("button", { name: /Hakim Dua, S\.H\./ }));
    expect(suara.bunyi).toEqual([
      "Yang Mulia Hakim Satu, S.H., Ketua Majelis, dimohon menuju Ruang Sidang 2.",
      "Yang Mulia Hakim Dua, S.H., Hakim Anggota, dimohon menuju Ruang Sidang 2.",
    ]);
  });

  it("semua majelis, panitera, juru sita, mediator (ruang mediasi)", async () => {
    await bukaLayar();
    fireEvent.click(screen.getByRole("button", { name: "Semua majelis" }));
    fireEvent.click(screen.getByRole("button", { name: "Panitera sidang" }));
    fireEvent.click(screen.getByRole("button", { name: "Juru sita" }));
    fireEvent.click(screen.getByRole("button", { name: "Mediator" }));
    expect(suara.bunyi[0]).toContain("Yang Mulia Hakim Satu, S.H., Ketua Majelis");
    expect(suara.bunyi[0]).toContain("Yang Mulia Hakim Dua, S.H., Hakim Anggota");
    expect(suara.bunyi[0]).toContain("Ruang Sidang 2");
    expect(suara.bunyi[1]).toBe("Panitera Uji, S.H., Panitera Pengganti, dimohon menuju Ruang Sidang 2.");
    expect(suara.bunyi[2]).toBe("Jurusita Uji, Juru Sita, dimohon menuju Ruang Sidang 2.");
    expect(suara.bunyi[3]).toBe("Mediator Uji, S.H., Mediator, dimohon menuju ruang mediasi.");
  });

  it("rohaniwan: nama sekali-ketik diingat; tanpa nama, jabatannya saja", async () => {
    await bukaLayar();
    fireEvent.click(screen.getByRole("button", { name: "Rohaniwan" }));
    expect(suara.bunyi[0]).toBe("Petugas Rohaniwan, dimohon menuju Ruang Sidang 2.");

    fireEvent.change(screen.getByLabelText("Nama rohaniwan"), { target: { value: "Rohaniwan Uji" } });
    fireEvent.click(screen.getByRole("button", { name: "Rohaniwan" }));
    expect(suara.bunyi[1]).toBe("Rohaniwan Uji, Petugas Rohaniwan, dimohon menuju Ruang Sidang 2.");
    expect(window.localStorage.getItem("aleta.antrian.nama-petugas")).toContain("Rohaniwan Uji");
  });

  it("sidang keliling menyala dengan hakim pilihan: hanya hakim itu yang punya tombol", async () => {
    tiruan.keliling = true;
    tiruan.pilihan = { "77": { hakimNama: "Hakim Luar, S.H.", anggotaMajelis: false } };
    render(createElement(AletaAntrianPanggil));
    await screen.findByRole("button", { name: /Hakim Luar, S\.H\./ });
    expect(screen.queryByRole("button", { name: /Hakim Satu, S\.H\./ })).toBeNull();
  });
});

describe("papan panggil: saksi", () => {
  it("satu per satu dan semua berurutan", async () => {
    await bukaLayar();
    fireEvent.click(screen.getByRole("button", { name: /Saksi Satu/ }));
    expect(suara.bunyi).toEqual(["Saksi Satu, saksi dari pihak Penggugat, dimohon menuju Ruang Sidang 2."]);

    suara.bunyi = [];
    fireEvent.click(screen.getByRole("button", { name: "Panggil semua saksi" }));
    expect(suara.bunyi).toEqual([
      "Saksi Satu, saksi dari pihak Penggugat, dimohon menuju Ruang Sidang 2.",
      "Saksi Dua, saksi dari pihak Tergugat, dimohon menuju Ruang Sidang 2.",
    ]);
  });

  it("saksi yang belum tercatat tetap dapat diketik", async () => {
    await bukaLayar();
    fireEvent.change(screen.getByPlaceholderText("Nama saksi yang dipanggil"), { target: { value: "Saksi Tiga" } });
    fireEvent.click(screen.getByRole("button", { name: "Panggil saksi" }));
    expect(suara.bunyi).toEqual(["Saksi atas nama Saksi Tiga, dimohon memasuki Ruang Sidang 2."]);
  });
});

describe("papan panggil: para pihak", () => {
  it("Panggil: kalimat lengkap dengan panggilan ke-N dari catatan, antrian tidak berubah oleh tombol petugas", async () => {
    await bukaLayar();
    tiruan.urls = [];
    fireEvent.click(screen.getByRole("button", { name: "Panggil" }));
    await waitFor(() => expect(suara.bunyi.length).toBe(1));
    expect(suara.bunyi[0]).toBe(
      "Panggilan kedua. Nomor antrian 3, perkara nomor enam ratus sembilan, P D T G, tahun dua ribu dua puluh enam, Cerai Gugat, Adi bin Budi sebagai Penggugat melawan Eri binti Cahya sebagai Tergugat. Silakan menuju Ruang Sidang 2."
    );
    // Kuasa tidak ikut disebut sebagai pihak.
    expect(suara.bunyi[0]).not.toContain("Kuasa Uji");
    // Kalimat lengkap tampil pada "Diucapkan".
    await waitFor(() => expect(screen.getByText(/Diucapkan: Panggilan kedua\./)).toBeTruthy());
  });

  it("Ulangi nomor: kalimat lengkap, hitungan tidak naik, tanpa menyentuh rute panggil", async () => {
    tiruan.panggilan = { jumlah: 2 };
    await bukaLayar();
    tiruan.urls = [];
    fireEvent.click(screen.getByRole("button", { name: /Ulangi nomor 3/ }));
    expect(suara.bunyi[0]).toContain("Panggilan kedua. Nomor antrian 3, perkara nomor enam ratus sembilan");
    expect(suara.bunyi[0]).toContain("Adi bin Budi sebagai Penggugat melawan Eri binti Cahya sebagai Tergugat");
    expect(tiruan.urls.some((u) => u.includes("/antrian/panggil"))).toBe(false);
  });

  it("panggilan gagal tercatat tidak bersuara", async () => {
    await bukaLayar();
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
      jawab({ ok: false, alasan: "Perkara belum punya ruang." })
    );
    fireEvent.click(screen.getByRole("button", { name: "Panggil" }));
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText("Perkara belum punya ruang.")).toBeTruthy());
    expect(suara.bunyi).toEqual([]);
  });
});
