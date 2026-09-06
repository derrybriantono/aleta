import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Cap build dibaca dari berkas kelolaan saat modul dimuat, jadi tiap
 * pemeriksaan memuatnya ulang dengan lingkungan yang berbeda.
 */
async function muatDengan(nilai: string | undefined) {
  vi.resetModules();
  if (nilai === undefined) delete process.env.NEXT_PUBLIC_ALETA_BUILD_STAMP;
  else process.env.NEXT_PUBLIC_ALETA_BUILD_STAMP = nilai;
  return import("@/lib/build-stamp");
}

const semula = process.env.NEXT_PUBLIC_ALETA_BUILD_STAMP;

afterEach(() => {
  if (semula === undefined) delete process.env.NEXT_PUBLIC_ALETA_BUILD_STAMP;
  else process.env.NEXT_PUBLIC_ALETA_BUILD_STAMP = semula;
});

describe("capBuildTerbaca", () => {
  it("menampilkan cap yang diisi Docker saat membangun", async () => {
    // Bentuk nyatanya: tanggal-jam WITA, zona yang menyebut dirinya, lalu
    // penanda commit. Zonanya ikut ditulis supaya selisih jam ketahuan
    // seketika alih-alih menyelinap - cap pertama sempat UTC dan berbunyi
    // "0743" untuk build pukul 15:43.
    const { capBuildTerbaca } = await muatDengan("20260906-1543 WITA 8918373");
    expect(capBuildTerbaca()).toBe("build 20260906-1543 WITA 8918373");
  });

  it("tetap berguna walau penanda git tidak dikirim", async () => {
    // Server produksi tidak punya git, jadi ALETA_BUILD_REF boleh kosong dan
    // yang tersisa hanya tanggal-jamnya - itu sudah cukup membedakan build.
    const { capBuildTerbaca } = await muatDengan("20260906-0930");
    expect(capBuildTerbaca()).toBe("build 20260906-0930");
  });

  it("KOSONG ketika capnya tidak ada, bukan 'tidak diketahui'", async () => {
    // Keterangan yang tidak berarti apa-apa menempati ruang di layar dan
    // mengajari orang mengabaikan bagian itu. Yang memakainya menyembunyikan
    // tampilannya.
    const { capBuildTerbaca } = await muatDengan(undefined);
    expect(capBuildTerbaca()).toBe("");
  });

  it("spasi belaka diperlakukan sama dengan kosong", async () => {
    const { capBuildTerbaca } = await muatDengan("   ");
    expect(capBuildTerbaca()).toBe("");
  });

  it("BUILD_STAMP mentah tetap dapat dibaca apa adanya", async () => {
    const { BUILD_STAMP } = await muatDengan("20260906-0930");
    expect(BUILD_STAMP).toBe("20260906-0930");
  });
});
