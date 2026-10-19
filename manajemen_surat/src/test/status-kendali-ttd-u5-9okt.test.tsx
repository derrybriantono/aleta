/**
 * ============================================================================
 * STATUS PERKARA, KENDALI BERKAS, DAN TANDA TANGAN - AUDIT U5 9 OKTOBER 2026
 * ============================================================================
 *
 * Layar SUNGGUHAN digambar (jsdom) dengan fetch tiruan yang memulangkan
 * bentuk jawaban rute portal yang sebenarnya - bentuk itu dibuktikan atas
 * rute sungguhan di status-kendali-ttd-u5-9okt-rute.test.ts. Tiap kasus di
 * sini MERAH pada kode sebelum perbaikan 9 Oktober 2026:
 *
 *   Status Perkara
 *     - bot menolak "perkara_tidak_ditemukan" -> kode mentah di layar
 *     - perkara A yang dijawab lambat menimpa perkara B yang diminta terakhir
 *     - membuka perkara (riwayat) yang tidak ada: perkara lama tetap tampil
 *       di bawah pesan "tidak ditemukan"
 *   Kendali Berkas
 *     - bot mati: "Arsip masih kosong", "Tidak ada perkara yang kurang
 *       berkas", "Tidak ada dokumen tercatat" - tiga kabar palsu
 *     - rincian baris A yang lambat tertulis di bawah baris B
 *   Tanda tangan
 *     - pemilih akun selalu kosong (pengguna dibaca dari bungkus.data)
 *     - alasan penolakan bot hilang ("ALETA menjawab 400.")
 *     - unggahan yang ditolak mengosongkan blangko
 *     - spasi di ujung nama mengunci tombol Sahkan
 *     - hapus permanen tanpa konfirmasi
 *     - bot mati: "Belum ada tanda tangan. Jalankan impor..."
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-state", async (asli) => ({
  ...(await asli<typeof import("@/lib/app-state")>()),
  usePortal: () => ({
    institutionIdentity: { courtName: "Pengadilan Agama Contoh" },
    accessibleModules: [],
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));

import type { Status } from "@/components/portal/aleta-ecourt-status-perkara";
const { AletaEcourtStatusPerkara } = await import("@/components/portal/aleta-ecourt-status-perkara");
const { AletaEcourtArsipBerkas } = await import("@/components/portal/aleta-ecourt-arsip-berkas");
const { AletaEcourtTandaTangan } = await import("@/components/portal/aleta-ecourt-tanda-tangan");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    // tidak apa-apa
  }
});

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bentuk yang dikirim bot untuk perkara_id 385 (petugasStatusPerkara).
const PEMERIKSA_385 = {
  majelis: [
    { id: 4, kode: "H4", nama: "Arasy Latif", jabatan: "Hakim Ketua", kedudukan: "Hakim Ketua", tahapanId: 10, keteranganTahapan: "" },
    { id: 1, kode: "H1", nama: "Amar Ma'ruf", jabatan: "Hakim Anggota 1", kedudukan: "Hakim Anggota 1", tahapanId: 10, keteranganTahapan: "" },
    { id: 6, kode: "H6", nama: "Ruhana Faried", jabatan: "Hakim Anggota 2", kedudukan: "Hakim Anggota 2", tahapanId: 10, keteranganTahapan: "" },
  ],
  panitera: [{ id: 4, kode: "P4", nama: "Imayanti, S.H.", tahapanId: 10, keteranganTahapan: "" }],
  jurusita: [{ id: 2, kode: "J2", nama: "Muh. Sam'an", tahapanId: 10, keteranganTahapan: "" }],
};
const IKRAR_385 = {
  majelis: [
    { id: 9, kode: "H9", nama: "Ulfah", jabatan: "Hakim Ketua", kedudukan: "Hakim Ketua", tahapanId: 18, keteranganTahapan: "", sumber: "penunjukan" },
    { id: 1, kode: "H1", nama: "Amar Ma'ruf", jabatan: "Hakim Anggota 1", kedudukan: "Hakim Anggota 1", tahapanId: 18, keteranganTahapan: "", sumber: "penunjukan" },
    { id: 6, kode: "H6", nama: "Ruhana Faried", jabatan: "Hakim Anggota 2", kedudukan: "Hakim Anggota 2", tahapanId: 18, keteranganTahapan: "", sumber: "penunjukan" },
  ],
  // Borang ikrar: id panitera NULL - nama tetap tampil, tanpa tautan.
  panitera: [{ id: null, kode: "", nama: "Imayanti, S.H.", tahapanId: 18, keteranganTahapan: "", sumber: "penetapanIkrar" }],
  jurusita: [{ id: 2, kode: "", nama: "Muh. Sam'an", tahapanId: 18, keteranganTahapan: "", sumber: "penetapanIkrar" }],
};


/** Muatan bot selengkap tipe Status menuntutnya (disalin dari majelis-ikrar-tampilan) - tanpa cast. */
function statusUji(NOMOR: string, id: string): Status {
  return {
    identitas: {
      perkaraId: id,
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Talak",
      jenisPerkaraLengkap: "Cerai Talak",
      tanggalDaftar: "2016-01-04",
    },
    umur: {
      hariBersih: 25,
      hariMediasi: 0,
      hariBerjalan: 24,
      bulanBerjalan: 0.8,
      sudahPutus: true,
      sebabSelesai: "putus",
      hariMinutasi: null,
    },
    ...PEMERIKSA_385,
    ikrar: IKRAR_385,
    sumberMajelis: "pemeriksa",
    saksi: { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0 },
    pihak: [],
    identitasPihak: null,
    jadwal: [],
    penundaan: [],
    putusan: null,
    biaya: { panjar: 0, terpakai: 0, sisa: 0, rincian: [] },
    dokumenEcourt: [],
    petitum: { ada: false },
    relaas: [],
    dokumenSipp: [],
    lewatEcourt: false,
    penilaian: { skor: 0, keadaan: "baik", totalBobot: 0, rinci: [], catatan: "" },
    penanda: {
      ghaib: null,
      sumberGhaib: [],
      instansi: [],
      perluIzinAtasan: false,
      mafqud: null,
      tundaanPanjang: [],
      ambangMafqud: { hari: 0, kali: 0 },
    },
    penetapanKembali: { terbaca: false, adaPenggantian: false, baris: [] },
    durasiMediasi: { terbaca: false, hari: 0, alasan: "" },
    nilaiRelaas: { terbaca: false, alasan: "", sumber: "" },
    saksiRinci: { terbaca: true, alasan: "", baris: [] },
    // Teks borang ikrar SIPP apa adanya - pemisahnya </br>.
    ikrarTalak: {
      terbaca: true,
      alasan: "",
      ada: true,
      penetapanMajelis: "2016-03-07",
      majelis: "Hakim Ketua: Ulfah, S.Ag., M.H.</br>Hakim Anggota 1: Amar Ma'ruf, S.Ag.</br>Hakim Anggota 2: Ruhana Faried",
      penetapanPp: "2016-01-05",
      panitera: "Imayanti, S.H.",
      penetapanJs: "2016-01-05",
      jurusita: "Jurusita: Muh. Sam'an",
      tanggalIkrar: "2016-03-17",
      sudahDiucapkan: true,
      statusId: 1,
      status: "Terlaksana",
    },
    putusanLengkap: { terbaca: false, ada: false },
    arsipKeterangan: { terbaca: false, alasan: "", sudahDiarsipkan: false, baris: [] },
    putusanEcourt: null,
    konseptor: { terbaca: false, alasan: "", baris: [] },
    delegasiMasuk: { terbaca: false, alasan: "", baris: [] },
    delegasiKeluar: { terbaca: false, alasan: "", baris: [] },
    mediasi: { terbaca: true, alasan: "", baris: [] },
    tahapan: { terbaca: false, alasan: "", tahap: [] },
    upayaHukum: [],
    penilaianSk: { rinci: [], unsurBelumTersambung: [], dasar: "", catatan: "" },
  };
}



// ===========================================================================
// STATUS PERKARA
// ===========================================================================

describe("Status Perkara - perkara yang tidak ada", () => {
  it("jawaban rute untuk bot yang menolak menjadi kalimat, bukan kode mentah", async () => {
    // Bentuk rute status-perkara sesudah perbaikan (lihat berkas -rute).
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        if (String(alamat).includes("status-perkara?nomor=")) {
          return jawabanJson({ ok: true, data: { available: true, status: null, alasan: "perkara_tidak_ditemukan" } });
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtStatusPerkara nomorAwal="999/Pdt.G/2026/PA.Dgl" />);
    await screen.findByText("Perkara 999/Pdt.G/2026/PA.Dgl tidak ditemukan di SIPP.");
    expect(document.body.textContent).not.toContain("perkara_tidak_ditemukan");
  });

  it("membuka perkara yang tidak ada dari riwayat: perkara lama tidak dibiarkan tampil di bawah pesannya", async () => {
    const A = "100/Pdt.G/2026/PA.Dgl";
    const HILANG = "777/Pdt.G/2020/PA.Dgl";
    // Seamless menjadi bawaan (18 Okt 2026) dan menaruh riwayat di dalam menu; uji ini menjaga alur riwayat
    // pada bilah alat, jadi tampilan Kompleks dipilih. Pengguna uji tanpa id memakai kunci "tamu".
    window.localStorage.setItem("aleta.status-perkara.tampilan.tamu", "kompleks");
    window.localStorage.setItem(
      "aleta.status-perkara.riwayat",
      JSON.stringify([{ nomorPerkara: HILANG, jenisPerkara: "Cerai Gugat", dibuka: "2026-10-01" }])
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const url = decodeURIComponent(String(alamat));
        if (url.includes("status-perkara?nomor=" + A)) {
          return jawabanJson({ ok: true, data: { available: true, status: statusUji(A, "1") } });
        }
        if (url.includes("status-perkara?nomor=" + HILANG)) {
          return jawabanJson({ ok: true, data: { available: true, status: null, alasan: "perkara_tidak_ditemukan" } });
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtStatusPerkara nomorAwal={A} />);
    await screen.findByRole("heading", { level: 3, name: A });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(HILANG.replace(/[./]/g, "\\$&")) }));
    await screen.findByText(`Perkara ${HILANG} tidak ditemukan di SIPP.`);
    expect(screen.queryByRole("heading", { level: 3, name: A })).toBeNull();
  });
});

describe("Status Perkara - balapan dua pembukaan", () => {
  it("jawaban perkara LAMA yang tiba belakangan tidak menimpa perkara yang terakhir diminta", async () => {
    const A = "100/Pdt.G/2026/PA.Dgl";
    const B = "200/Pdt.G/2026/PA.Dgl";
    let lepasA: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((alamat: string) => {
        const url = decodeURIComponent(String(alamat));
        if (url.includes("status-perkara?nomor=" + A)) {
          return new Promise<Response>((r) => {
            lepasA = r;
          });
        }
        if (url.includes("status-perkara?nomor=" + B)) {
          return Promise.resolve(jawabanJson({ ok: true, data: { available: true, status: statusUji(B, "2") } }));
        }
        if (url.includes("status-perkara?cari=")) {
          return Promise.resolve(
            jawabanJson({ ok: true, data: { available: true, perkara: [{ nomorPerkara: B, perkaraId: "2" }], adaLagi: false } })
          );
        }
        return new Promise<Response>(() => {});
      })
    );
    // Datang dari Jadwal Sidang dengan A (lambat), lalu pengguna mencari B.
    render(<AletaEcourtStatusPerkara nomorAwal={A} />);
    await tunggu(20);
    const kotak = screen.getByPlaceholderText(/419, nama pihak/);
    fireEvent.change(kotak, { target: { value: "200" } });
    fireEvent.keyDown(kotak, { key: "Enter" });
    await screen.findByRole("heading", { level: 3, name: B });
    // Kini jawaban A yang lambat tiba.
    lepasA(jawabanJson({ ok: true, data: { available: true, status: statusUji(A, "1") } }));
    await tunggu(50);
    expect(screen.queryByRole("heading", { level: 3, name: A })).toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: B })).toBeTruthy();
  });
});

// ===========================================================================
// KENDALI BERKAS
// ===========================================================================

/** Bentuk rute portal saat gatewayFetch gagal (bot mati). */
const BOT_MATI = "ALETA Bot belum dapat dihubungi.";

const BARIS_ARSIP = (nomorPerkara: string) => ({
  nomorPerkara,
  nomorRegister: "R1",
  dokumen: 3,
  adaPdf: 1,
  adaWord: 0,
  berkasAda: 1,
  tanpaBerkas: 2,
  tidakTersedia: 0,
  adaPdfCakram: 1,
  adaWordCakram: 0,
  berkasHilang: 0,
  menungguMajelis: 0,
  sudahValid: 1,
  berkasPendaftaran: 0,
  dihapusRetensi: 0,
  terakhirTerlihat: null,
});

describe("Kendali Berkas - bot mati", () => {
  it("daftar arsip tidak mengaku 'Arsip masih kosong'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const url = String(alamat);
        if (url.includes("/arsip/perkara")) {
          return jawabanJson({ ok: true, data: { available: false, message: BOT_MATI, perkara: [], total: 0 } });
        }
        if (url.includes("/kendali-berkas")) {
          return jawabanJson({ ok: true, data: { available: false, message: BOT_MATI, ringkasan: null, perkara: [] } });
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtArsipBerkas />);
    await waitFor(() => expect(screen.getAllByText(BOT_MATI).length).toBeGreaterThanOrEqual(2));
    await tunggu(30);
    expect(document.body.textContent).not.toContain("Arsip masih kosong");
  });

  it("panel penyandingan SIPP tidak mengaku 'Tidak ada perkara yang kurang berkas'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const url = String(alamat);
        if (url.includes("/kendali-berkas")) {
          return jawabanJson({ ok: true, data: { available: false, message: BOT_MATI, ringkasan: null, perkara: [] } });
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtArsipBerkas />);
    await waitFor(() => expect(screen.getAllByText(BOT_MATI).length).toBeGreaterThan(0));
    await tunggu(20);
    expect(document.body.textContent).not.toContain("Tidak ada perkara yang kurang berkas.");
    expect(document.body.textContent).toContain("Daftar perkara belum dapat dibaca");
  });

  it("rincian satu perkara menyebut bot, bukan 'Tidak ada dokumen tercatat'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const url = String(alamat);
        if (url.includes("/arsip/perkara?nomor=")) {
          return jawabanJson({ ok: true, data: { available: false, message: BOT_MATI, dokumen: [] } });
        }
        if (url.includes("/arsip/perkara")) {
          return jawabanJson({ ok: true, data: { available: true, perkara: [BARIS_ARSIP("1/Pdt.G/2026/PA.Dgl")], total: 1 } });
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtArsipBerkas />);
    fireEvent.click(await screen.findByText("1/Pdt.G/2026/PA.Dgl"));
    await waitFor(() => expect(screen.queryByText("Memuat dokumen…")).toBeNull());
    await screen.findByText(BOT_MATI);
    expect(document.body.textContent).not.toContain("Tidak ada dokumen tercatat untuk perkara ini.");
  });

  it("gagal jaringan: jumlah perkara lama tidak tertinggal di kepala tabel", async () => {
    let gagal = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        const url = String(alamat);
        if (url.includes("/arsip/perkara")) {
          if (gagal) throw new TypeError("Failed to fetch");
          return jawabanJson({ ok: true, data: { available: true, perkara: [BARIS_ARSIP("1/Pdt.G/2026/PA.Dgl")], total: 222 } });
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtArsipBerkas />);
    await screen.findByText(/222 perkara/);
    gagal = true;
    fireEvent.click(screen.getByRole("button", { name: "Perbarui Data" }));
    await screen.findByText("Failed to fetch");
    expect(document.body.textContent).not.toContain("222 perkara");
  });

  it("balapan rincian: dokumen baris A yang lambat tidak tertulis di bawah baris B", async () => {
    const A = "1/Pdt.G/2026/PA.Dgl";
    const B = "2/Pdt.G/2026/PA.Dgl";
    let lepasA: (r: Response) => void = () => {};
    const dokumen = (judul: string) => [
      {
        documentKey: judul,
        judulDokumen: judul,
        jenisDokumen: "",
        peranPengunggah: "",
        statusVerifikasi: "valid",
        tanggalSidang: null,
        agenda: "",
        adaPdf: false,
        adaWord: false,
        ukuranByte: 0,
        diberitahukanPada: null,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn((alamat: string) => {
        const url = decodeURIComponent(String(alamat));
        if (url.includes("/arsip/perkara?nomor=" + A)) {
          return new Promise<Response>((r) => {
            lepasA = r;
          });
        }
        if (url.includes("/arsip/perkara?nomor=" + B)) {
          return Promise.resolve(jawabanJson({ ok: true, data: { available: true, dokumen: dokumen("Dokumen milik B") } }));
        }
        if (url.includes("/arsip/perkara")) {
          return Promise.resolve(
            jawabanJson({ ok: true, data: { available: true, perkara: [BARIS_ARSIP(A), BARIS_ARSIP(B)], total: 2 } })
          );
        }
        return new Promise<Response>(() => {});
      })
    );
    render(<AletaEcourtArsipBerkas />);
    fireEvent.click(await screen.findByText(A));
    fireEvent.click(screen.getByText(B));
    await screen.findByText("Dokumen milik B");
    lepasA(jawabanJson({ ok: true, data: { available: true, dokumen: dokumen("Dokumen milik A") } }));
    await tunggu(50);
    expect(screen.queryByText("Dokumen milik A")).toBeNull();
    expect(screen.getByText("Dokumen milik B")).toBeTruthy();
  });
});

// ===========================================================================
// TANDA TANGAN
// ===========================================================================

const DASAR_TTD = {
  id: 7,
  sidik: "s",
  jabatan: "",
  penggunaId: "",
  peran: "",
  subPeran: "",
  jenisBerkas: "png",
  ukuran: 2048,
  disahkanOleh: "",
  disahkanPada: "",
  asal: "impor",
};

/** fetch tiruan layar tanda tangan; cap selalu kosong. */
function pasangFetchTtd(get: () => Response, post: (badan: Record<string, unknown>) => Response) {
  const kiriman: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, opsi?: RequestInit) => {
      const url = String(alamat);
      if (url.includes("/penetapan-edoc/cap")) return jawabanJson({ ok: true, data: { ok: true, baris: [], peruntukan: [] } });
      // Kartu TTE BSrE (19 Okt) memanggil rutenya sendiri; jawabannya berbungkus ok() dengan bentuknya sendiri.
      if (url.includes("/tanda-tangan/tte") && opsi?.method !== "POST") return jawabanJson({ ok: true, data: { admin: true, statusBsre: "belum", baris: [] } });
      if (url.includes("/tanda-tangan") && opsi?.method === "POST") {
        const badan = JSON.parse(String(opsi.body)) as Record<string, unknown>;
        kiriman.push(badan);
        return post(badan);
      }
      if (url.includes("/tanda-tangan")) return get();
      return new Promise<Response>(() => {});
    })
  );
  return kiriman;
}

/** Persis bentuk GET /api/aleta-ecourt/tanda-tangan (dibuktikan di berkas -rute). */
const GET_KOSONG = () =>
  jawabanJson({
    ok: true,
    data: { ok: true, baris: [] },
    pengguna: [{ id: "usr-hakim", nama: "Budi Hakim", peran: "hakim", peranLabel: "Hakim", jabatan: "", subPeran: "" }],
    penggunaAlasan: "",
  });

async function isiBlangkoTambah() {
  await screen.findByText(/Belum ada tanda tangan/);
  fireEvent.click(screen.getByRole("button", { name: /Tambah tanda tangan/ }));
  const masukan = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  fireEvent.change(masukan, { target: { files: [new File([png], "ttd.png", { type: "image/png" })] } });
  await screen.findByText(/ttd\.png/);
  fireEvent.change(screen.getByPlaceholderText("NAMA LENGKAP, GELAR"), { target: { value: "Drs. Contoh, M.H." } });
  fireEvent.click(screen.getByRole("button", { name: /Simpan tanda tangan/ }));
}

describe("Tanda tangan - menambah", () => {
  it("pemilih 'Tautkan ke akun portal' berisi pengguna yang dikirim rute", async () => {
    pasangFetchTtd(GET_KOSONG, () => jawabanJson({ ok: true, data: { ok: true } }));
    render(<AletaEcourtTandaTangan />);
    await screen.findByText(/Belum ada tanda tangan/);
    fireEvent.click(screen.getByRole("button", { name: /Tambah tanda tangan/ }));
    expect(screen.getByRole("option", { name: /Budi Hakim/ })).toBeTruthy();
  });

  it("unggahan yang ditolak bot: alasannya dikalimatkan, dan isian tetap ada", async () => {
    // Bentuk rute POST ketika bot menolak: Response.json(gatewayResult, 400).
    pasangFetchTtd(GET_KOSONG, () => jawabanJson({ ok: false, error: "gambar_sudah_ada", status: 400 }, 400));
    render(<AletaEcourtTandaTangan />);
    await isiBlangkoTambah();
    await screen.findByText("Gambar yang sama persis sudah ada di daftar.");
    expect(document.body.textContent).not.toContain("ALETA menjawab 400.");
    expect((screen.getByPlaceholderText("NAMA LENGKAP, GELAR") as HTMLInputElement).value).toBe("Drs. Contoh, M.H.");
    expect(screen.getByText(/ttd\.png/)).toBeTruthy();
  });

  it("bot mati saat mengunggah: layar menyebut bot tidak dapat dihubungi", async () => {
    pasangFetchTtd(GET_KOSONG, () => jawabanJson({ ok: false, error: BOT_MATI }, 502));
    render(<AletaEcourtTandaTangan />);
    await isiBlangkoTambah();
    await screen.findByText(BOT_MATI);
  });

  it("unggahan yang BERHASIL tetap mengosongkan dan menutup blangko (perilaku lama)", async () => {
    pasangFetchTtd(GET_KOSONG, () => jawabanJson({ ok: true, data: { ok: true, id: 9 } }));
    render(<AletaEcourtTandaTangan />);
    await isiBlangkoTambah();
    await waitFor(() => expect(screen.queryByPlaceholderText("NAMA LENGKAP, GELAR")).toBeNull());
  });
});

describe("Tanda tangan - menamai dan menghapus", () => {
  it("nama berakhiran spasi: sesudah Simpan nama, tombol Sahkan dapat ditekan", async () => {
    // Bot memangkas nama (tandaTanganService.namai: potong(...).trim()).
    let namaTersimpan = "";
    const kiriman = pasangFetchTtd(
      () =>
        jawabanJson({
          ok: true,
          data: { ok: true, baris: [{ ...DASAR_TTD, namaPejabat: namaTersimpan, disahkan: false }] },
          pengguna: [],
        }),
      (badan) => {
        namaTersimpan = String(badan.namaPejabat).trim();
        return jawabanJson({ ok: true, data: { ok: true } });
      }
    );
    render(<AletaEcourtTandaTangan />);
    const kotak = await screen.findByPlaceholderText("Nama pejabat beserta gelarnya");
    fireEvent.change(kotak, { target: { value: "Drs. Contoh, M.H. " } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan nama" }));
    await waitFor(() => expect(namaTersimpan).toBe("Drs. Contoh, M.H."));
    expect(kiriman[0]?.namaPejabat).toBe("Drs. Contoh, M.H.");
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Sahkan" }) as HTMLButtonElement).disabled).toBe(false)
    );
  });

  it("hapus tanda tangan yang sudah disahkan menunggu konfirmasi; ditolak = tidak terhapus", async () => {
    const kiriman = pasangFetchTtd(
      () =>
        jawabanJson({
          ok: true,
          data: { ok: true, baris: [{ ...DASAR_TTD, namaPejabat: "Ketua PA", disahkan: true, disahkanOleh: "Admin" }] },
          pengguna: [],
        }),
      () => jawabanJson({ ok: true, data: { ok: true } })
    );
    const tanya = vi.fn((_pesan?: string) => false);
    vi.stubGlobal("confirm", tanya);
    render(<AletaEcourtTandaTangan />);
    fireEvent.click(await screen.findByTitle("Buang gambar ini"));
    await tunggu(30);
    expect(tanya).toHaveBeenCalledTimes(1);
    expect(String(tanya.mock.calls[0]?.[0] ?? "")).toContain("SUDAH disahkan");
    expect(kiriman.map((x) => x.tindakan)).not.toContain("hapus");

    tanya.mockReturnValue(true);
    fireEvent.click(screen.getByTitle("Buang gambar ini"));
    await waitFor(() => expect(kiriman.map((x) => x.tindakan)).toContain("hapus"));
  });

  it("bot mati saat membaca daftar: disebut, dan tidak menyuruh 'Jalankan impor'", async () => {
    // Bentuk rute GET saat gatewayFetch gagal: {...respons, pengguna, penggunaAlasan}, 502.
    pasangFetchTtd(
      () => jawabanJson({ ok: false, error: BOT_MATI, pengguna: [], penggunaAlasan: "" }, 502),
      () => jawabanJson({ ok: true })
    );
    render(<AletaEcourtTandaTangan />);
    await screen.findByText(BOT_MATI);
    expect(document.body.textContent).not.toContain("Belum ada tanda tangan");
  });
});
