// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ASAL, BERKAS, Dunia, ENAM, KATALOG, abtPalsu, dokumen, jalankan, minta, namaRelatif, nyalakan, pesanMulai } from "./dunia-latar";
import type { Permintaan } from "./dunia-latar";

/**
 * ============================================================================
 * CETAK RELAAS LEBIH CEPAT (7 Okt 2026) - DIUKUR DENGAN JAM MAYA
 * ============================================================================
 *
 * latar.js sungguhan dijalankan di dunia tiruan dengan ABT yang MENJAWAB
 * LAMBAT seperti ABT satker (PHP 5.6 merender variabel blangko):
 *   POST cari (+ alih ke view)   1200 ms
 *   GET view&d (daftar sidang)   1000 ms
 *   GET preview (CETAK, RTF)     1500 ms
 *   beranda / halaman kelompok    400 ms
 * Lamanya putaran = dari relaas-mulai sampai putaran selesai, jam maya.
 */

const LATENSI = (p: Permintaan) => {
  const u = new URL(p.alamat);
  if (u.pathname.endsWith("/abt/main/cari")) return 1200;
  if (u.pathname.endsWith("/abt/main/view")) return 1000;
  if (u.pathname.endsWith("/abt/preview")) return 1500;
  if (u.pathname.endsWith("/abt/main/beranda")) return 400;
  return 0;
};

function duaPuluh() {
  const golongan: Array<[string, number | null]> = [
    ["sidang-pertama", 1],
    ["sidang-ditunda", 3],
    ["pemberitahuan-putusan", null],
    ["ikrar-talak", 2],
    ["sidang-lanjutan", 4],
  ];
  return Array.from({ length: 20 }, (_, i) => {
    const [g, d] = golongan[i % golongan.length];
    return dokumen(i + 1, g, d, i % 3 === 0 ? "Andi Juru Sita, S.H." : "Budi Santoso");
  });
}

/** Satu putaran; `hangat` = token blangko sudah tersimpan dari putaran sebelumnya. */
async function ukur(dok: any[], hangat: boolean) {
  const dunia = new Dunia(abtPalsu());
  dunia.latensi = LATENSI;
  const pekerja = nyalakan(dunia);
  if (hangat) {
    const panen = await minta(dunia, pekerja, {
      jenis: "relaas-panen",
      asal: ASAL,
      asalAbt: `${ASAL}/aps_badilag`,
      berkas: [...new Set(dok.map((d) => d.berkas))],
    });
    expect(panen.ok, JSON.stringify(panen)).toBe(true);
    dunia.permintaan = [];
  }
  const mulai = dunia.jam;
  const j = await minta(dunia, pekerja, pesanMulai(dok));
  expect(j.ok, JSON.stringify(j)).toBe(true);
  await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
  const p = dunia.putaran();
  const abt = dunia.permintaan.filter((x) => x.alamat.includes("/aps_badilag/"));
  return {
    dunia,
    ms: dunia.jam - mulai,
    permintaanAbt: abt.length,
    render: abt.filter((x) => /\/abt\/(main\/(cari|view)|preview)/.test(new URL(x.alamat).pathname)).length,
    selesai: p.butir.filter((b: any) => b.keadaan === "selesai").length,
    berkas: dunia.unduhan.map(namaRelatif).sort(),
  };
}

describe("ukuran lamanya putaran cetak relaas (jam maya, ABT lambat)", () => {
  it("6 dan 20 dokumen, dingin dan hangat - dicetak lengkap; angkanya dicatat", async () => {
    const hasil: Record<string, unknown> = {};
    for (const [nama, dok] of [
      ["6", ENAM],
      ["20", duaPuluh()],
    ] as const) {
      for (const hangat of [false, true]) {
        const h = await ukur(dok as any[], hangat);
        expect(h.selesai).toBe((dok as any[]).length);
        hasil[`${nama} dokumen ${hangat ? "hangat" : "dingin"}`] = {
          detik: Math.round(h.ms / 100) / 10,
          permintaanAbt: h.permintaanAbt,
          render: h.render,
        };
      }
    }
    console.log("UKURAN CETAK RELAAS", JSON.stringify(hasil, null, 1));
  });
});

const awalan = (x: Permintaan) =>
  `${x.metode} ${new URL(x.alamat).pathname}${new URL(x.alamat).searchParams.get("d") ? " d" : ""}`;
const untuk = (d: Dunia, id: string) =>
  d.permintaan.filter((p) => new URL(p.alamat).searchParams.get("c") === id || new URLSearchParams(p.badan).get("c") === id);

describe("hasil cetak SAMA dengan jalan lama", () => {
  it("pintas daftar sidang: alamat CETAK, berkas, dan foldernya identik dengan jalan lewat daftar sidang", async () => {
    const jalan = async (tanpaCetakDiBuka: boolean) => {
      const d = new Dunia(abtPalsu({ tanpaCetakDiBuka }));
      const pekerja = nyalakan(d);
      await minta(d, pekerja, pesanMulai(duaPuluh()));
      await jalankan(d, () => Boolean(d.putaran()?.selesai));
      return {
        d,
        cetak: d.permintaan.filter((p) => p.alamat.includes("/abt/preview?")).map((p) => p.alamat).sort(),
        berkas: d.unduhan.map(namaRelatif).sort(),
        isi: d.unduhan.map((u) => `${namaRelatif(u)} ${u.url}`).sort(),
      };
    };
    const lama = await jalan(true);
    const baru = await jalan(false);
    expect(baru.cetak).toHaveLength(20);
    expect(baru.cetak).toEqual(lama.cetak);
    expect(baru.berkas).toEqual(lama.berkas);
    expect(baru.isi).toEqual(lama.isi);
    expect(baru.berkas.every((n) => /^ALETA relaas 2026-09-25\/(Andi Juru Sita, S\.H|Budi Santoso)\/.+\.rtf$/.test(n))).toBe(
      true
    );

    // Jalan lama tetap ada bila halaman "buka" tidak memuat tautan CETAK.
    expect(untuk(lama.d, "102").map(awalan)).toEqual([
      "POST /aps_badilag/abt/main/cari",
      "GET /aps_badilag/index.php/abt/main/view d",
      "GET /aps_badilag/abt/preview d",
    ]);
    // Pintas: buka (cari - hak akses tetap diperiksa ABT) -> CETAK. Daftar sidang tidak dibuka.
    expect(untuk(baru.d, "102").map(awalan)).toEqual(["POST /aps_badilag/abt/main/cari", "GET /aps_badilag/abt/preview d"]);
    expect(baru.d.permintaan.filter((p) => p.alamat.includes("/abt/main/view"))).toEqual([]);
  });
});

describe("jeda antar dokumen tetap dalam batasnya", () => {
  it("ABT diam 1-2,5 detik di antara jawaban CETAK dan permintaan buka berikutnya; di dalam satu dokumen tanpa jeda", async () => {
    const d = new Dunia(abtPalsu());
    d.latensi = LATENSI;
    const pekerja = nyalakan(d);
    await minta(d, pekerja, pesanMulai(duaPuluh()));
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    const abt = d.permintaan.filter((p) => /\/abt\/(main\/cari|preview)/.test(p.alamat));
    const diam: number[] = [];
    const dalam: number[] = [];
    for (let i = 0; i < abt.length - 1; i += 1) {
      const p = abt[i];
      const q = abt[i + 1];
      if (p.alamat.includes("/preview?")) diam.push(q.pada - (p.pada + LATENSI(p)));
      else dalam.push(q.pada - (p.pada + LATENSI(p)));
    }
    expect(diam).toHaveLength(19);
    expect(Math.min(...diam)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...diam)).toBeLessThanOrEqual(2500);
    expect(dalam).toHaveLength(20);
    expect(dalam.every((x) => x === 0)).toBe(true);
    // Tidak pernah dua permintaan ABT bersamaan.
    for (let i = 0; i < abt.length - 1; i += 1) expect(abt[i + 1].pada).toBeGreaterThanOrEqual(abt[i].pada + LATENSI(abt[i]));
  });

  it("6 dan 20 dokumen (token tersimpan) selesai di bawah batas bawah jalan lama", async () => {
    // Jalan lama paling cepat (semua acak di ujung bawah): 6 dok = 21,2 dtk ABT
    // + 5,5 dtk langkah + 5 x 2 dtk = 36,7 dtk; 20 dok = 70 + 18 + 38 = 126 dtk.
    // Jalan baru paling lambat: 6 x 2,7 + 5 x 2,5 = 28,7 dtk; 20 x 2,7 + 19 x 2,5 = 101,5 dtk.
    const enam = await ukur(ENAM, true);
    const duapuluh = await ukur(duaPuluh(), true);
    expect(enam.ms).toBeLessThanOrEqual(28_700);
    expect(duapuluh.ms).toBeLessThanOrEqual(101_500);
    expect(enam.render).toBe(12);
    expect(duapuluh.render).toBe(40);
  });
});

describe("pekerja dinyalakan ulang di tengah putaran", () => {
  it("mati selagi menunggu jeda: pekerja baru melanjutkan, jedanya tetap dihormati, tidak ada berkas ganda", async () => {
    const d = new Dunia(abtPalsu());
    d.latensi = LATENSI;
    let pekerja = nyalakan(d);
    await minta(d, pekerja, pesanMulai(ENAM));
    await jalankan(d, () => d.putaran()?.butir?.[2]?.keadaan === "selesai");
    pekerja.matikan();
    pekerja = nyalakan(d);
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    const p = d.putaran();
    expect(p.butir.map((b: any) => b.keadaan)).toEqual(Array(6).fill("selesai"));
    const nama = d.unduhan.map(namaRelatif);
    expect(new Set(nama).size).toBe(6);
    expect(nama.filter((n) => / \(\d+\)\.rtf$/.test(n))).toEqual([]);
    // Dokumen ke-4 dibuka pekerja baru, tidak lebih awal dari jeda tersimpan.
    const cetak3 = d.permintaan.find((x) => x.alamat.includes("/abt/preview?") && x.alamat.includes("c=103&"))!;
    const buka4 = d.permintaan.find((x) => x.alamat.includes("/abt/main/cari") && x.badan.includes("c=104"))!;
    expect(buka4.pekerja).not.toBe(cetak3.pekerja);
    expect(buka4.pada - (cetak3.pada + 1500)).toBeGreaterThanOrEqual(1000);
    expect(buka4.pada - (cetak3.pada + 1500)).toBeLessThanOrEqual(2500);
  });
});

describe("blangko yang tidak ada di ABT tidak dicari ulang tiap tombol Cetak", () => {
  const tanpaIkrar = KATALOG.filter((n) => n !== BERKAS("ikrar-talak"));
  const beranda = (d: Dunia) => d.permintaan.filter((p) => new URL(p.alamat).pathname.endsWith("/abt/main/beranda")).length;

  it("putaran kedua dalam 10 menit tidak membuka kelompok ABT lagi; sebabnya tetap disebut; sesudah 10 menit dicari lagi", async () => {
    const d = new Dunia(abtPalsu({ berkasAda: tanpaIkrar }));
    const pekerja = nyalakan(d);
    const satu = await minta(d, pekerja, pesanMulai(ENAM.slice(0, 4)));
    expect(satu.pekerjaan.dilewati[0].sebab).toContain(`blangko "${BERKAS("ikrar-talak")}" tidak ditemukan di ABT ini`);
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    await minta(d, pekerja, { jenis: "relaas-bersihkan" });
    const sebelum = beranda(d);
    const dua = await minta(d, pekerja, pesanMulai(ENAM.slice(0, 4)));
    expect(dua.ok).toBe(true);
    expect(beranda(d)).toBe(sebelum);
    expect(dua.pekerjaan.dilewati[0].sebab).toBe(satu.pekerjaan.dilewati[0].sebab);
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    expect(d.putaran().butir.every((b: any) => b.keadaan === "selesai")).toBe(true);
    await minta(d, pekerja, { jenis: "relaas-bersihkan" });
    d.jam += 10 * 60 * 1000;
    await minta(d, pekerja, pesanMulai(ENAM.slice(0, 4)));
    expect(beranda(d)).toBeGreaterThan(sebelum);
  });

  it("kelompok yang gagal dibaca (500) TIDAK diingat sebagai 'tidak ada' - tombol berikutnya mencari lagi", async () => {
    const d = new Dunia(abtPalsu({ kelompok500: true }));
    const pekerja = nyalakan(d);
    await minta(d, pekerja, pesanMulai(ENAM.slice(0, 1)));
    await minta(d, pekerja, { jenis: "relaas-bersihkan" });
    const sebelum = beranda(d);
    const dua = await minta(d, pekerja, pesanMulai(ENAM.slice(0, 1)));
    expect(dua.pekerjaan.dilewati[0].sebab).toContain('"Relaas dan PBT" (ABT menjawab 500)');
    expect(beranda(d)).toBeGreaterThan(sebelum);
  });
});
