import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AletaEcourtPenarikan } from "@/components/portal/aleta-ecourt-penarikan";

/**
 * ============================================================================
 * PANEL "TARIK YANG BELUM ADA SAJA" - DIGAMBAR, BUKAN DIBACA DARI SUMBERNYA
 * ============================================================================
 *
 * penarikan-belum-ada.test.ts menyisir teks TSX-nya. Penyisiran itu menangkap
 * kalimat yang hilang, tetapi tidak dapat membedakan komponen yang menggambar
 * daftar sasaran dari komponen yang menyimpan daftar itu di state lalu tidak
 * pernah menuliskannya - dan itulah persis cacat yang ditemukan 25 Sep 2026:
 * hitungSasaran memulangkan 20 nomor perkara beserta sebabnya sejak awal,
 * sementara tidak ada satu baris JSX pun yang membacanya.
 *
 * Yang diuji di sini karena itu apa yang SAMPAI KE MATA PETUGAS, dan satu hal
 * lagi yang tidak dapat dilihat penyisiran teks: angka yang benar-benar DIKIRIM
 * saat tombolnya ditekan.
 */

type PermintaanTercatat = { url: string; metode: string; muatan: unknown };

const SASARAN_TIRUAN = {
  diperiksaPada: "2026-09-25T02:00:00.000Z",
  totalEcourtSipp: 2527,
  belumPernahDitarik: 2520,
  dikunjungiTetapiKosong: 40,
  berkasKurang: 7,
  lengkap: 0,
  dokumenKurang: 12,
  dokumenTidakTersedia: 0,
  jumlahSasaran: 2527,
  selisihGolongan: 0,
  perkiraanMenit: 1411,
  perkiraanMenitMin: 1411,
  perkiraanMenitMaks: 1537,
  taksiran: {
    menitKerja: 1348,
    menitHalaman: 337,
    menitBerkas: 1011,
    jumlahIstirahat: 63,
    istirahatMenitMin: 1,
    istirahatMenitMaks: 3,
    istirahatTiapPerkara: 40,
    dokumenDitaksir: 15132,
    rerataDokumenPerPerkara: 6,
    rerataTerukur: false,
    perkaraTerukur: 0,
  },
  // SENGAJA BUKAN 120. Bila layar masih menulis jatahnya keras sendiri, angka
  // ini tidak akan muncul di tombol dan tidak akan terkirim saat ditekan -
  // yakni keadaan yang membuat ALETA_BOT_ECOURT_MAKS_BELUM_ADA di peladen tidak
  // mengubah apa pun dari jalur portal.
  maksSekaliTarik: 37,
  contoh: [
    { nomorPerkara: "564/Pdt.G/2026/PA.Dgl", sebab: "belum_pernah_ditarik", kurang: 0 },
    { nomorPerkara: "563/Pdt.G/2026/PA.Dgl", sebab: "dibuka_tetapi_kosong", kurang: 0 },
    { nomorPerkara: "120/Pdt.G/2025/PA.Dgl", sebab: "berkas_belum_ada", kurang: 4 },
  ],
};

function pasangFetchTiruan(sasaran: unknown = SASARAN_TIRUAN) {
  const tercatat: PermintaanTercatat[] = [];

  const tiruan = vi.fn(async (masukan: unknown, opsi?: { method?: string; body?: string }) => {
    const url = String(masukan);
    tercatat.push({
      url,
      metode: String(opsi?.method || "GET"),
      muatan: opsi?.body ? JSON.parse(String(opsi.body)) : null,
    });

    if (url.includes("bagian=sasaran")) {
      return {
        ok: true,
        json: async () => ({ data: { available: true, sasaran } }),
      };
    }

    if (String(opsi?.method || "GET").toUpperCase() === "POST") {
      // Jatah yang dipulangkan bot adalah jatah yang benar-benar dipakainya.
      return { ok: true, json: async () => ({ data: { ok: true, maksPerkara: 37 } }) };
    }

    return {
      ok: true,
      json: async () => ({
        data: {
          log: [],
          keadaan: { sedangJalan: false, adaPenarikanLain: false },
          pesanKeadaan: "",
          bolehMenarikSemua: true,
          pantau: null,
        },
      }),
    };
  });

  vi.stubGlobal("fetch", tiruan);
  return tercatat;
}

async function gambarLaluHitung(sasaran: unknown = SASARAN_TIRUAN) {
  const tercatat = pasangFetchTiruan(sasaran);
  render(<AletaEcourtPenarikan />);

  // Tombol "Hitung sasaran" baru muncul sesudah keadaan terbaca
  // (bolehMenarikSemua).
  await waitFor(() => expect(screen.getByText("Hitung sasaran")).toBeTruthy());
  fireEvent.click(screen.getByText("Hitung sasaran"));
  await waitFor(() => expect(screen.getByText(/perkara jadi sasaran dari/)).toBeTruthy());
  return tercatat;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("panel penarikan menggambar apa yang akan dikerjakan", () => {
  it("daftar contoh perkara benar-benar tampil, beserta sebabnya", async () => {
    await gambarLaluHitung();

    // Inilah yang dulu tidak ada: nomor perkaranya sendiri.
    expect(screen.getByText("564/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    expect(screen.getByText("563/Pdt.G/2026/PA.Dgl")).toBeTruthy();
    expect(screen.getByText("120/Pdt.G/2025/PA.Dgl")).toBeTruthy();

    // Sebabnya diterjemahkan, bukan disodorkan sebagai nama_kode_bersudut.
    expect(screen.getByText(/sudah dibuka, dokumennya belum ada di e-Court/)).toBeTruthy();
    expect(screen.getByText(/berkasnya belum lengkap, 4 dokumen/)).toBeTruthy();
  });

  it("jatah satu penekanan datang dari bot, bukan dari angka di TSX", async () => {
    const tercatat = await gambarLaluHitung();

    // 37, bukan 120: tombolnya memakai angka yang dipulangkan layanan.
    const tombol = screen.getByText("Tarik 37 perkara sekarang");
    fireEvent.click(tombol);

    await waitFor(() => {
      const kirim = tercatat.find((p) => p.metode.toUpperCase() === "POST");
      expect(kirim).toBeTruthy();
      expect(kirim?.muatan).toMatchObject({ tindakan: "belum-ada", maksPerkara: 37 });
    });
  });

  it("taksiran waktu tampil sebagai rentang, beserta bahan hitungannya", async () => {
    await gambarLaluHitung();

    // Jawaban bot lama (istirahat acak 1-3 menit) tetap tampil sebagai
    // rentang. Sejak 26 Sep 2026 bot mengirim min = maks (istirahat tetap 2
    // menit) dan layar menulis satu angka.
    expect(screen.getByText(/1411.*1537 menit/)).toBeTruthy();
    expect(screen.getByText(/63 istirahat/)).toBeTruthy();
    // Dan bila rata-rata dokumennya BUKAN hasil ukur, layar mengatakannya.
    expect(
      screen.getByText(/memakai angka cadangan\s*6 dokumen per perkara/)
    ).toBeTruthy();
  });

  it("sisa yang mustahil berkurang disebut dengan angkanya", async () => {
    await gambarLaluHitung();
    expect(
      screen.getByText(/40 di antaranya sudah pernah dibuka dan memang/)
    ).toBeTruthy();
  });

  it("dua batas jujur disebut di layar, bukan hanya di komentar kode", async () => {
    await gambarLaluHitung();
    expect(screen.getByText(/utuh menurut CATATAN, bukan menurut disk/)).toBeTruthy();
    expect(screen.getByText(/muncul pada daftar e-Court tidak akan pernah terbuka/)).toBeTruthy();
  });

  it("tanpa maksSekaliTarik dari bot, layar jatuh ke cadangan 120", async () => {
    // Pemulangan lama - tanpa ruas baru - tidak boleh membuat panelnya kosong
    // atau menampilkan NaN. Yang dipaku: cadangannya 120.
    const { maksSekaliTarik: _tanpaJatah, ...tanpaRuasBaru } = SASARAN_TIRUAN;
    await gambarLaluHitung(tanpaRuasBaru);
    expect(screen.getByText("Tarik 120 perkara sekarang")).toBeTruthy();
  });
});
