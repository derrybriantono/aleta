// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * NOMOR PERKARA DI HALAMAN DAFTAR - ANGKA URUTNYA IKUT TERBACA
 * ============================================================================
 *
 * Dilaporkan dari layar: penetapan massal menyebut "1564/Pdt.G/2026/PA.Dgl",
 * "2563/Pdt.G/2026/PA.Dgl", "10555/Pdt.G/2026/PA.Dgl" - nomor perkara yang
 * tidak pernah ada. Angka di depannya nomor urut barisnya.
 *
 * Sebabnya satu sifat DOM yang mudah terlewat: textContent sebuah <tr>
 * menyambung isi tiap <td>-nya TANPA pemisah apa pun - berbeda dari innerText,
 * yang menyisipkannya. Sel kolom "No" berisi "1", sel berikutnya
 * "564/Pdt.G/2026/PA.Dgl", dan keduanya terbaca sebagai satu untai
 * "1564/Pdt.G/2026/PA.Dgl". Lalu \d{1,5} di depan polanya menelan angka urut
 * itu sebagai bagian nomor perkaranya.
 *
 * Akibatnya DIAM, dan itu sebabnya ia bertahan lama: penandanya tidak
 * menemukan selnya sehingga tidak tertempel, dan ringkasan massalnya
 * menanyakan perkara yang tidak ada sehingga menjawab kosong. Halaman penuh
 * perkara terbaca sebagai "tidak ada yang berkeadaan khusus" - jawaban yang
 * masuk akal, dan karena itu tidak ada yang curiga.
 *
 * Uji ini menjalankan fungsinya yang SUNGGUHAN atas tabel yang bentuknya sama
 * dengan halaman Daftar Perkara SIPP.
 */

const berkas = path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const konten = () => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");

/** Memotong fungsi puncak - dibuka di kolom nol, ditutup oleh "}" di kolom nol. */
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

/** Polanya DIBACA dari sumbernya - nilai yang disalin akan menyimpang diam-diam. */
function polaBaris(): string {
  const cocok = /const POLA_PERKARA_BARIS = (\/.*\/);/.exec(konten());
  if (!cocok) throw new Error("POLA_PERKARA_BARIS tidak ketemu");
  return cocok[1];
}

function buatPembaca() {
  const sumber = potongFungsi(konten(), "barisPerkaraDiHalaman");
  const buat = new Function(
    "document",
    `const TANDA = "data-aleta";
     const POLA_PERKARA_BARIS = ${polaBaris()};
     ${sumber}
     return barisPerkaraDiHalaman;`
  ) as (d: Document) => () => { nomor: string; baris: HTMLTableRowElement }[];
  return buat(document);
}

/** Satu baris Daftar Perkara SIPP, sebentuk dengan yang sungguhan. */
function pasangTabel(baris: { no: number; nomor: string }[]) {
  document.body.innerHTML = `
    <table>
      <thead>
        <tr><th>No</th><th>Nomor Perkara</th><th>Tanggal Register</th></tr>
      </thead>
      <tbody>
        ${baris
          .map(
            (b) => `<tr>
              <td>${b.no}</td>
              <td>${b.nomor}<br>( e-Court )</td>
              <td>10 Sep. 2026</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

describe("nomor perkara dibaca dari selnya, bukan dari seluruh barisnya", () => {
  it("angka urut di kolom No tidak ikut terbaca", () => {
    pasangTabel([
      { no: 1, nomor: "564/Pdt.G/2026/PA.Dgl" },
      { no: 2, nomor: "563/Pdt.G/2026/PA.Dgl" },
      { no: 10, nomor: "555/Pdt.G/2026/PA.Dgl" },
      { no: 13, nomor: "552/Pdt.G/2026/PA.Dgl" },
    ]);

    const nomor = buatPembaca()().map((x) => x.nomor);
    expect(nomor).toEqual([
      "564/Pdt.G/2026/PA.Dgl",
      "563/Pdt.G/2026/PA.Dgl",
      "555/Pdt.G/2026/PA.Dgl",
      "552/Pdt.G/2026/PA.Dgl",
    ]);
  });

  it("nomor urut dua digit pun tidak menempel - inilah yang paling kentara", () => {
    // "10" + "555/..." = "10555/Pdt.G/2026/PA.Dgl", nomor perkara berdigit lima
    // yang tidak pernah ada di satker mana pun.
    pasangTabel([{ no: 10, nomor: "555/Pdt.G/2026/PA.Dgl" }]);
    expect(buatPembaca()()[0].nomor).toBe("555/Pdt.G/2026/PA.Dgl");
  });

  it("barisnya ikut dipulangkan, supaya penandanya dapat ditempel", () => {
    pasangTabel([{ no: 1, nomor: "564/Pdt.G/2026/PA.Dgl" }]);
    const hasil = buatPembaca()();
    expect(hasil).toHaveLength(1);
    expect(hasil[0].baris.tagName).toBe("TR");
    // Dan selnya benar-benar memuat nomor itu - itulah yang dicari
    // cariSelNomorPerkara ketika menempelkan penandanya.
    expect(hasil[0].baris.textContent).toContain("564/Pdt.G/2026/PA.Dgl");
  });

  it("perkara yang sama dua kali hanya dihitung sekali", () => {
    pasangTabel([
      { no: 1, nomor: "564/Pdt.G/2026/PA.Dgl" },
      { no: 2, nomor: "564/Pdt.G/2026/PA.Dgl" },
    ]);
    expect(buatPembaca()()).toHaveLength(1);
  });

  it("baris kepala tabel tidak ikut terbaca", () => {
    pasangTabel([{ no: 1, nomor: "564/Pdt.G/2026/PA.Dgl" }]);
    expect(buatPembaca()()).toHaveLength(1);
  });

  it("jenis perkara lain ikut terbaca dengan benar", () => {
    pasangTabel([
      { no: 7, nomor: "225/Pdt.P/2026/PA.Dgl" },
      { no: 8, nomor: "12/Pdt.G.S/2026/PA.Dgl" },
    ]);
    expect(buatPembaca()().map((x) => x.nomor)).toEqual([
      "225/Pdt.P/2026/PA.Dgl",
      "12/Pdt.G.S/2026/PA.Dgl",
    ]);
  });
});

describe("penetapan massal menyebut jumlahnya apa adanya", () => {
  it("halaman yang lebih panjang daripada yang ditawarkan disebut begitu", () => {
    // "25 perkara terbaca" pada halaman berisi lima puluh perkara adalah
    // kalimat yang keliru, dan yang membacanya akan menyangka setengah
    // halamannya tidak terbaca ALETA.
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    // Sejak yang sudah lengkap disaring keluar, yang disebut bukan lagi
    // "perkara di halaman" melainkan perkara yang MASIH dapat dikerjakan -
    // dan yang disembunyikan tetap disebutkan jumlahnya, sebab jumlah yang
    // tidak dijelaskan terbaca sebagai perkara yang hilang.
    expect(badan).toContain("perkara masih ada penetapan yang belum dikerjakan");
    expect(badan).toContain("yang ditawarkan ${nomorSemua.length} pertama");
    expect(badan).toContain("sudah lengkap dan tidak ditawarkan");
    expect(badan).not.toContain("perkara terbaca di halaman ini");
  });
});
