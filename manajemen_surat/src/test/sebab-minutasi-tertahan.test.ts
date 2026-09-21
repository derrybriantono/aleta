import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { sebabMinutasiTertahan, sudahDiminutasi } from "@/lib/sebab-minutasi-tertahan";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const BAHAN = {
  sudahPutus: true,
  tanggalPutusan: "2026-06-10",
  tanggalMinutasi: "",
  adaBerkasPutusan: true,
  adaBerkasAnonim: true,
  jadwal: [
    { adaBas: true, tanggalSidang: "2026-05-20" },
    { adaBas: true, tanggalSidang: "2026-06-10" },
  ],
};

describe("sudahDiminutasi", () => {
  it("tanggal sungguhan berarti sudah", () => {
    expect(sudahDiminutasi("2026-09-21")).toBe(true);
  });

  it("kosong berarti belum", () => {
    expect(sudahDiminutasi("")).toBe(false);
    expect(sudahDiminutasi("   ")).toBe(false);
  });

  it("tanggal nol SIPP berarti belum - bukan 'ada isinya'", () => {
    // Ini bukan kerapian. SIPP menulis '0000-00-00' pada sebagian barisnya,
    // dan pemeriksaan yang hanya menanyakan "string kosong atau tidak" akan
    // menyimpulkan perkaranya sudah diminutasi - lalu memadamkan lencana
    // justru pada baris yang paling perlu menyalakannya.
    expect(sudahDiminutasi("0000-00-00")).toBe(false);
    expect(sudahDiminutasi("0000-00-00 00:00:00")).toBe(false);
  });
});

describe("sebabMinutasiTertahan", () => {
  it("sudah diminutasi - tidak ada yang perlu diterangkan", () => {
    expect(
      sebabMinutasiTertahan({ ...BAHAN, tanggalMinutasi: "2026-09-21" })
    ).toEqual([]);
  });

  it("belum putus sama sekali - minutasi belum pada tempatnya", () => {
    // Perkara yang masih berjalan TIDAK boleh menghasilkan satu butir pun.
    // Menagih naskah putusan pada perkara yang belum disidangkan habis adalah
    // tuduhan yang salah alamat, dan satu butir palsu membuat seluruh
    // daftarnya tidak dipercaya.
    expect(
      sebabMinutasiTertahan({
        sudahPutus: false,
        tanggalPutusan: "",
        tanggalMinutasi: "",
        adaBerkasPutusan: false,
        adaBerkasAnonim: false,
        jadwal: [{ adaBas: false, tanggalSidang: "2026-05-01" }],
      })
    ).toEqual([]);
  });

  it("seluruh berkas lengkap - tinggal tanggalnya", () => {
    expect(sebabMinutasiTertahan(BAHAN)).toEqual([]);
  });

  it("menghitung BAS yang kurang, bukan sekadar menyebut kurang", () => {
    // Angkanya yang membuat butirnya dapat dikerjakan: "2 dari 5" mengirim
    // orang membuka dua sidang, "BAS belum lengkap" mengirimnya membuka lima.
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      jadwal: [
        { adaBas: true, tanggalSidang: "2026-02-01" },
        { adaBas: false, tanggalSidang: "2026-03-01" },
        { adaBas: true, tanggalSidang: "2026-04-01" },
        { adaBas: false, tanggalSidang: "2026-05-01" },
        { adaBas: true, tanggalSidang: "2026-06-10" },
      ],
    });
    const bas = sebab.find((x) => x.kunci === "bas");
    expect(bas).toBeDefined();
    expect(bas?.pesan).toContain("2 dari 5");
    expect(bas?.tingkat).toBe("penghalang");
  });

  it("tidak ada satu BAS pun - kalimatnya berbeda", () => {
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      jadwal: [
        { adaBas: false, tanggalSidang: "2026-05-01" },
        { adaBas: false, tanggalSidang: "2026-06-10" },
      ],
    });
    const bas = sebab.find((x) => x.kunci === "bas");
    expect(bas?.pesan).toContain("belum ada sama sekali");
  });

  it("SIDANG SESUDAH PUTUSAN TIDAK IKUT DIHITUNG - ini cacat yang sungguh terjadi", () => {
    // ========================================================================
    // DIUKUR PADA SIPP SETEMPAT, DAN ANGKANYA YANG MEMBUAT PENJAGA INI ADA
    // ========================================================================
    //
    //     perkara putus 2026                                   683
    //     punya sidang berjadwal SESUDAH tanggal putusan         46
    //     BAS kurang pada sidang SAMPAI tanggal putusan           0
    //     BAS kurang pada sidang SESUDAH tanggal putusan          7
    //
    // Nol lawan tujuh. Tanpa penyaringan, KETUJUH tuduhan "BAS kurang" yang
    // dikeluarkan layar ini palsu seluruhnya - perkara cerai talak yang
    // putusannya memberi izin ikrar, lalu sidang ikrarnya dijadwalkan
    // berbulan kemudian dan tentu belum ada BAS-nya.
    //
    // Satu butir palsu membuat seluruh daftarnya tidak dipercaya, termasuk
    // butir yang benar.
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      tanggalPutusan: "2026-06-10",
      jadwal: [
        { adaBas: true, tanggalSidang: "2026-05-20" },
        { adaBas: true, tanggalSidang: "2026-06-10" },
        // Sidang ikrar talak, empat bulan sesudah putusan. Belum terjadi.
        { adaBas: false, tanggalSidang: "2026-10-14" },
      ],
    });
    expect(sebab.some((x) => x.kunci === "bas")).toBe(false);
  });

  it("sidang PADA hari putusan tetap ikut - itu sidang pembacaannya", () => {
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      tanggalPutusan: "2026-06-10",
      jadwal: [
        { adaBas: true, tanggalSidang: "2026-05-20" },
        { adaBas: false, tanggalSidang: "2026-06-10" },
      ],
    });
    expect(sebab.find((x) => x.kunci === "bas")?.pesan).toContain("1 dari 2");
  });

  it("cap waktu penuh tetap terbaca, bukan hanya tanggal telanjang", () => {
    // SIPP mengirim sebagian tanggalnya bercap waktu. Perbandingan string
    // atas "2026-06-10 00:00:00" lawan "2026-06-10" akan menyatakan yang
    // pertama LEBIH BESAR, dan sidang pembacaan putusannya terbuang.
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      tanggalPutusan: "2026-06-10 00:00:00",
      jadwal: [{ adaBas: false, tanggalSidang: "2026-06-10 09:00:00" }],
    });
    expect(sebab.find((x) => x.kunci === "bas")?.pesan).toContain("1 sidang");
  });

  it("tanggal putusan tidak terbaca - jadwalnya dipakai apa adanya", () => {
    // Menyaring dengan batas kosong akan membuang SELURUH sidang, lalu
    // melaporkan berkasnya lengkap pada perkara yang BAS-nya sungguh hilang.
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      tanggalPutusan: "",
      jadwal: [{ adaBas: false, tanggalSidang: "2026-05-20" }],
    });
    expect(sebab.some((x) => x.kunci === "bas")).toBe(true);
  });

  it("sidang tanpa tanggal ikut dihitung, bukan diam-diam dibuang", () => {
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      jadwal: [{ adaBas: false }],
    });
    expect(sebab.some((x) => x.kunci === "bas")).toBe(true);
  });

  it("seluruh sidang jatuh sesudah putusan - bukan 'jadwal tidak terbaca'", () => {
    // Keduanya menghasilkan daftar bundel kosong, tetapi artinya berbeda:
    // yang satu gagal dibaca, yang satu terbaca baik dan memang kosong.
    // Menyebutnya "belum terbaca" mengirim orang memeriksa sambungan SIPP.
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      tanggalPutusan: "2026-06-10",
      jadwal: [{ adaBas: false, tanggalSidang: "2026-10-14" }],
    });
    expect(sebab.some((x) => x.kunci === "bas-tak-terbaca")).toBe(false);
    expect(sebab.some((x) => x.kunci === "bas")).toBe(false);
    // Tetapi TIDAK diam: tanpa butir ini, daftar yang kosong dijawab
    // "Berkasnya sudah lengkap" padahal tidak satu BAS pun sempat diperiksa.
    expect(sebab.some((x) => x.kunci === "bundel-kosong")).toBe(true);
  });

  it("'berkas lengkap' hanya bila BAS sungguh diperiksa", () => {
    // Penjaga atas kalimat yang paling mudah menenangkan orang secara keliru.
    // Daftar kosong berarti layar berbunyi "Berkasnya sudah lengkap"; ia hanya
    // boleh kosong ketika ada sidang yang benar-benar dihitung.
    const lengkap = sebabMinutasiTertahan(BAHAN);
    expect(lengkap).toEqual([]);

    const tanpaPemeriksaan = sebabMinutasiTertahan({
      ...BAHAN,
      jadwal: [{ adaBas: true, tanggalSidang: "2026-12-01" }],
    });
    expect(tanpaPemeriksaan.length).toBeGreaterThan(0);
  });

  it("jadwal kosong dikatakan apa adanya, BUKAN dihitung lengkap", () => {
    // Diam pada keadaan ini membuat berkas yang sebenarnya kurang terbaca
    // sebagai berkas yang sudah beres.
    const sebab = sebabMinutasiTertahan({ ...BAHAN, jadwal: [] });
    const butir = sebab.find((x) => x.kunci === "bas-tak-terbaca");
    expect(butir).toBeDefined();
    expect(sebab.some((x) => x.kunci === "bas")).toBe(false);
  });

  it("naskah putusan yang belum diunggah MENAHAN", () => {
    const sebab = sebabMinutasiTertahan({ ...BAHAN, adaBerkasPutusan: false });
    const butir = sebab.find((x) => x.kunci === "naskah-putusan");
    expect(butir?.tingkat).toBe("penghalang");
  });

  it("naskah anonim tertunggak tetapi TIDAK menahan minutasi", () => {
    // SIPP sendiri menghitung 'edoc' dari perkara yang SUDAH diminutasi DAN
    // punya naskahnya - antrian_dirput.php:221. Urutannya karena itu minutasi
    // dulu, publikasi kemudian; menyebut anonim sebagai penghalang membalik
    // urutan yang dipakai SIPP sendiri.
    const sebab = sebabMinutasiTertahan({ ...BAHAN, adaBerkasAnonim: false });
    const butir = sebab.find((x) => x.kunci === "naskah-anonim");
    expect(butir).toBeDefined();
    expect(butir?.tingkat).toBe("pelengkap");
    expect(sebab.filter((x) => x.tingkat === "penghalang")).toHaveLength(0);
  });

  it("urutannya urutan kerja: BAS sebelum naskah", () => {
    const sebab = sebabMinutasiTertahan({
      ...BAHAN,
      adaBerkasPutusan: false,
      adaBerkasAnonim: false,
      jadwal: [{ adaBas: false }],
    });
    expect(sebab.map((x) => x.kunci)).toEqual(["bas", "naskah-putusan", "naskah-anonim"]);
  });
});

describe("sebabnya TERTULIS, supaya tidak dibuang orang berikutnya", () => {
  const sumber = baca("manajemen_surat/src/lib/sebab-minutasi-tertahan.ts");

  it("menyebut bahwa SIPP sendiri tidak menghalangi", () => {
    // Tanpa kalimat ini, pembaca berikutnya akan menyangka daftarnya syarat
    // aplikasi, lalu mencari tombol yang tidak pernah ada di SIPP.
    expect(sumber).toContain("antrian_dirput.php:217");
    expect(sumber.toLowerCase()).toContain("tanggal minutasi adalah ruas");
  });

  it("menyebut mengapa anonim bukan penghalang", () => {
    expect(sumber).toContain("antrian_dirput.php:221");
  });

  it("tidak mengekspor apa pun yang tidak dipanggil layar", () => {
    // Fungsi yang hanya dipanggil ujinya sendiri tampak seperti cakupan,
    // padahal tidak menjaga apa pun. Penjaga ini menahan ringkasSebabMinutasi
    // - yang sempat ditulis lalu dibuang - agar tidak kembali tanpa pemakai.
    const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    const diekspor = [...sumber.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    expect(diekspor.length).toBeGreaterThan(0);
    for (const nama of diekspor) {
      expect(layar.includes(nama), `${nama} diekspor tetapi tidak dipakai layar`).toBe(true);
    }
  });
});
