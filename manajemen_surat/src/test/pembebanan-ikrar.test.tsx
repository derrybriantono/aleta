import { render, screen, within } from "@testing-library/react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LencanaPembebananIkrar, PembebananIkrarRincian } from "@/components/portal/pembebanan-ikrar";
import {
  rupiahRingkas,
  tampilkanPembebanan,
  teksLencanaPembebanan,
  type PembebananIkrar,
} from "@/lib/pembebanan-ikrar";

/**
 * ============================================================================
 * PEMBEBANAN SAAT IKRAR TALAK (6 Oktober 2026)
 * ============================================================================
 *
 * Contoh amar di bawah diambil dari putusan cerai talak SUNGGUHAN di
 * sipp_donggala (nomor perkaranya disebut), nama pihak dan anak diganti -
 * bentuk tulisannya (HTML, entitas, salah ketik angka) dibiarkan apa adanya,
 * sebab bentuk itulah yang harus terbaca pengurainya.
 *
 * Ukuran atas SELURUH 988 putusan cerai talak dikabulkan di satker (6 Okt
 * 2026): 173 berpembebanan (172 dengan angka, 1 hanya barang), 813 tanpa
 * pembebanan, 0 yang menyebut pembebanan tetapi tak terurai, 15 bertanda
 * ragu (angka berbeda dengan terbilangnya / periode nafkah anak tak tertulis).
 */

type Urai = (amar: string) => PembebananIkrar;
const require_ = createRequire(import.meta.url);
const layanan = require_(path.resolve(process.cwd(), "../aleta_bot/services/pembebananIkrarService.js")) as {
  uraiPembebanan: Urai;
  terbilangKeAngka: (t: string) => number | null;
  angkaRupiah: (t: string) => { nilai: number; cacat: boolean } | null;
};
const urai = layanan.uraiPembebanan;

const jumlahPer = (h: PembebananIkrar) =>
  Object.fromEntries(h.pos.map((p) => [`${p.jenis}${p.berkala ? "/bln" : ""}`, p.jumlah]));

/** 404/Pdt.G/2026/PA.Dgl - verstek, satu diktum mut'ah, dibayar sebelum ikrar. */
const AMAR_404 = `<p>1. Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;</p>

<p>2. Mengabulkan permohonan Pemohon secara verstek;</p>

<p>3. Memberi izin kepada Pemohon (<strong>Fulan bin Fulan</strong>) untuk menjatuhkan talak satu <em>raj&#39;i</em> terhadap Termohon (<strong>Fulanah binti Fulan</strong>) di depan sidang Pengadilan Agama Donggala;</p>

<p>4. Menghukum Pemohon untuk membayar hak Termohon yaitu <em>Mut\`ah</em> berupa uang tunai sebesar Rp10.000.000,00 (sepuluh juta rupiah) yang diserahkan sebelum ikrar talak diucapkan;</p>

<p>5. Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp199.000,00 (seratus sembilan puluh sembilan ribu rupiah).</p>`;

/** 365/Pdt.G/2026/PA.Dgl - rekonvensi, butir a./b. di bawah kepala ":", nafkah anak bulanan. */
const AMAR_365 = `<p><strong>MENGADILI</strong></p>

<p><strong>DALAM KONVENSI</strong></p>

<ol>
 <li>Mengabulkan permohonan Pemohon;</li>
 <li>Memberi izin kepada Pemohon (<strong>Fulan bin Fulan</strong><strong>)</strong> untuk menjatuhkan talak satu <em>raj&#39;i</em> terhadap Termohon (<strong>Fulanah binti Fulan</strong><strong>)</strong> di depan sidang Pengadilan Agama Donggala;</li>
</ol>

<p><strong>DALAM REKONVENSI</strong></p>

<ol>
 <li>Mengabulkan gugatan Penggugat Rekonvensi untuk sebagian;</li>
 <li>Menghukum Tergugat Rekonvensi (<strong>Fulan bin Fulan</strong><strong>)</strong> untuk memberikan kepada Penggugat Rekonvensi (<strong>Fulanah binti Fulan</strong><strong>)</strong>:</li>
</ol>
 <p >a. mut&#39;ah berupa uang sejumlah <strong>Rp500.000,00 (lima ratus ribu rupiah)</strong>;</p>
 <p >b. nafkah selama masa iddah sejumlah <strong>Rp1.500.000,00 (satu juta lima ratus ribu rupiah)</strong>;</p>

<ol>
 <li>Menetapkan kewajiban pada diktum angka 2 huruf a dan huruf b tersebut dibayar sebelum pengucapan ikrar talak, kecuali Penggugat Rekonvensi tidak keberatan Tergugat Rekonvensi mengucapkan ikrar talak meskipun kewajiban tersebut pada saat itu belum dibayar;</li>
 <li>Menghukum Tergugat Rekonvensi (<strong>Fulan bin Fulan</strong><strong>)</strong> untuk memberikan nafkah kepada anak bernama <strong>Anak binti Fulan</strong> melalui Penggugat Rekonvensi (<strong>Fulanah binti Fulan</strong><strong>)</strong> sejumlah <strong>Rp500.000,00 (lima ratus ribu rupiah) setiap bulan</strong>, dengan kenaikan <strong>10% (sepuluh persen) setiap tahun</strong>, di luar biaya pendidikan dan kesehatan, sejak Tergugat Rekonvensi mengucapkan ikrar talak sampai anak tersebut berumur 21 tahun atau telah mampu berdiri sendiri;</li>
 <li>Menolak gugatan Penggugat Rekonvensi untuk selain dan selebihnya;</li>
</ol>

<p><strong>DALAM KONVENSI DAN REKONVENSI</strong></p>

<p>Membebankan kepada Pemohon Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara sejumlah <strong>Rp199.500,00 (seratus sembilan puluh sembilan ribu lima ratus rupiah)</strong>;</p>`;

/** 326/Pdt.G/2026/PA.Dgl - jumlah ulang "dengan jumlah keseluruhan" tidak boleh terhitung dua kali. */
const AMAR_326 = `<p><strong>DALAM REKONVENSI</strong></p>
<ol>
 <li>Mengabulkan gugatan Penggugat Rekonvensi sebagian;</li>
 <li>Menetapkan anak-anak bernama:</li>
</ol>
<p>a. ANAK PERTAMA binti FULAN, umur 11 (sebelas) tahun;</p>
<p>berada di bawah hadhanah Penggugat Rekonvensi, selaku ibu kandungnya;</p>
<ol>
 <li>Menghukum Tergugat Rekonvensi, untuk membayar kepada Penggugat Rekonvensi nafkah iddah sejumlah Rp4.500.000,00 (empat juta lima ratus ribu rupiah) untuk masa iddah selama 3 (tiga) bulan;</li>
 <li>Menghukum Tergugat Rekonvensi untuk memberikan mut&#39;ah kepada Penggugat Rekonvensi, sejumlah Rp10.000.000,00 (sepuluh juta rupiah);</li>
 <li>Menetapkan kewajiban sebagaimana diktum angka 7 dan angka 8 Rekonvensi dengan jumlah keseluruhan Rp14.500.000,00 (empat belas juta lima ratus ribu rupiah) dibayarkan sebelum Tergugat Rekonvensi mengucapkan ikrar talak, kecuali Penggugat Rekonvensi menyatakan tidak keberatan apabila ikrar talak diucapkan sebelum kewajiban tersebut dipenuhi;</li>
 <li>Menolak gugatan Penggugat Rekonvensi selain dan selebihnya;</li>
</ol>`;

/** 96/Pdt.G/2019/PA.Dgl - "Menetapkan" lalu "Menghukum" untuk pos yang sama; mut'ah emas; bulan pertama. */
const AMAR_96_2019 = `<ol>
 <li>Mengabulkan gugatan Penggugat Rekonvensi sebagian;</li>
 <li>Menetapkan nafkah hadhanah untuk anak Penggugat Rekonvensi dan Tergugat Rekonvensi yang harus ditanggung oleh Tergugat Rekonvensi sebesar Rp 500.000,00 (lima ratus ribu rupiah) perbulan dan mengalami peningkatan 10% setiap tahun sampai anak-anak tersebut dewasa (umur 21 tahun);</li>
 <li>Menetapkan Nafkah Iddah selama 3 (tiga) bulan sejumlah Rp 1.500.000,00 (satu juta lima ratus ribu rupiah);</li>
 <li>Menetapkan mut’ah berupa emas seberat 4 (empat) gram;</li>
 <li>Menghukum Tergugat Rekonvensi untuk membayar nafkah anak Penggugat Rekonvensi dan Tergugat Rekonvensi untuk 1 (satu) bulan pertama sebagaimana diktum angka 2 sejumlah Rp 500.000,00 (lima ratus ribu rupiah) kepada Penggugat Rekonvensi sesaat sebelum ikrar talak diucapkan;</li>
 <li>Menghukum Tergugat Rekonvensi untuk membayar Nafkah Iddah selama 3 (tiga) bulan sejumlah Rp 1.500.000,00 (satu juta lima ratus ribu rupiah) kepada Penggugat Rekonvensi sesaat sebelum ikrar talak diucapkan;</li>
 <li>Menghukum Tergugat Rekonvensi untuk memberikan mut’ah berupa emas seberat 4 (empat) gram kepada Penggugat Rekonvensi sesaat sebelum ikrar talak diucapkan;</li>
 <li>Menolak gugatan Penggugat Rekonvensi selain dan selebihnya;</li>
</ol>
<p>Membebankan kepada Pemohon Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara sebesar Rp 596.000,00 (lima ratus sembilan puluh enam ribu rupiah)</p>`;

describe("pengurai amar - contoh sungguhan sipp_donggala", () => {
  it("404/2026: mut'ah Rp10.000.000 sebelum ikrar, biaya perkara tidak ikut", () => {
    const h = urai(AMAR_404);
    expect(jumlahPer(h)).toEqual({ mutah: 10000000 });
    expect(h.totalSekaligus).toBe(10000000);
    expect(h.sebelumIkrar).toBe(true);
    expect(h.pos[0].penerima).toBe("Termohon");
    expect(h.pos[0].kalimat).toContain("sebelum ikrar talak diucapkan");
  });

  it("365/2026: butir a./b. di bawah kepala, nafkah anak bulanan TIDAK masuk total", () => {
    const h = urai(AMAR_365);
    expect(jumlahPer(h)).toEqual({ mutah: 500000, iddah: 1500000, "anak/bln": 500000 });
    expect(h.totalSekaligus).toBe(2000000);
    expect(h.berkalaPerBulan).toBe(500000);
    expect(h.sebelumIkrar).toBe(true);
    expect(h.waktuBayar).toContain("kecuali Penggugat Rekonvensi tidak keberatan");
    expect(h.pos.find((p) => p.jenis === "iddah")?.penerima).toBe("Penggugat Rekonvensi");
  });

  it("326/2026: 'jumlah keseluruhan Rp14.500.000' tidak dihitung sebagai pos ketiga", () => {
    const h = urai(AMAR_326);
    expect(jumlahPer(h)).toEqual({ mutah: 10000000, iddah: 4500000 });
    expect(h.totalSekaligus).toBe(14500000);
  });

  it("96/2019: pos yang ditetapkan lalu dihukumkan dihitung sekali; mut'ah emas tanpa angka; bulan pertama sekaligus", () => {
    const h = urai(AMAR_96_2019);
    expect(h.pos.filter((p) => p.jenis === "iddah")).toHaveLength(1);
    expect(h.pos.filter((p) => p.jenis === "mutah")).toHaveLength(1);
    const mutah = h.pos.find((p) => p.jenis === "mutah");
    expect(mutah?.jumlah).toBeNull();
    expect(mutah?.keterangan).toContain("emas seberat 4 (empat) gram");
    // Nafkah anak bulanan DAN pembayaran bulan pertama sesaat sebelum ikrar.
    expect(jumlahPer(h)).toMatchObject({ iddah: 1500000, anak: 500000, "anak/bln": 500000 });
    expect(h.totalSekaligus).toBe(2000000);
    expect(h.adaTanpaAngka).toBe(true);
  });

  it("per bulan 'sehingga berjumlah': yang dipakai jumlahnya, dan sekaligus (2070/2017)", () => {
    const h = urai(
      "<p>Menghukum Tergugat Rekonvensi membayar nafkah lampau selama 7 bulan sejak bulan Agustus 2017 sampai dengan bulan Februari 2018 dengan rincian Rp500.000,00 (lima ratus ribu rupiah) per bulan sehingga berjumlah Rp3.500.000,00 (tiga juta lima ratus ribu rupiah).</p>"
    );
    expect(jumlahPer(h)).toEqual({ madliyah: 3500000 });
  });

  it("angka seribu kali terbilangnya: 'Rp 3.000.000.000 (tiga juta rupiah)' dibaca tiga juta dan ditandai ragu (344/2019)", () => {
    const h = urai("<li>Menetapkan Nafkah Iddah selama 3 (tiga) bulan sejumlah Rp 3.000.000.000 (tiga juta rupiah);</li>");
    expect(h.pos[0].jumlah).toBe(3000000);
    expect(h.pos[0].ragu).toBe(true);
  });

  it("terbilang yang kehilangan 'ribu': 'Rp.500.000,-(lima ratus rupiah)' tetap lima ratus ribu (261/2015)", () => {
    const h = urai(
      "</br>2. Menghukum Tergugat membayar kepada Penggugat  biaya pemeliharaan (hadhana) anak Penggugat dan Tergugat yang bernama Anak bin Fulan sejumlah Rp.500.000,-(lima ratus rupiah)  setiap bulan sampai anak  tersebut dewasa atau berumur 21 tahun;"
    );
    expect(jumlahPer(h)).toEqual({ "anak/bln": 500000 });
    expect(h.pos[0].ragu).toBe(true);
  });

  it("angka cacat bentuk: 'Rp. 1.00.000 (satu juta rupiah)' memakai terbilangnya (268/2016)", () => {
    const h = urai("<p>- Mut'ah sejumlah Rp. 1.00.000 (satu juta rupiah)</p>");
    expect(h.pos[0].jumlah).toBe(1000000);
  });

  it("nama pihak bukan kata kunci: Mutiara, Nur'idah, Maharani", () => {
    const h = urai(
      "<p>Memberi izin kepada Pemohon (Fulan bin Fulan) untuk menjatuhkan talak satu raj'i terhadap Termohon (Nur&#39;idah Mutiara Maharani binti Fulan);</p><p>Membebankan kepada Pemohon untuk membayar biaya perkara sejumlah Rp199.000,00;</p>"
    );
    expect(h.pos).toEqual([]);
    expect(h.tidakTerbaca).toBe(false);
  });

  it("yang ditolak, yang dibayar istri, dan harta bersama bukan pembebanan ikrar", () => {
    const h = urai(
      "<p>Menolak gugatan nafkah lampau Penggugat Rekonvensi sejumlah Rp5.000.000,00;</p>" +
        "<p>Menghukum Termohon untuk mengembalikan uang kepada Pemohon sejumlah Rp2.000.000,00;</p>" +
        "<p>Menghukum Tergugat untuk memberikan kepada Penggugat separuh dari hasil penjualan rumah bersama berupa uang sejumlah Rp 20.000.000,00(dua puluh juta rupiah);</p>"
    );
    expect(h.pos).toEqual([]);
  });

  it("terbilang dan angka rupiah", () => {
    expect(layanan.terbilangKeAngka("empat belas juta lima ratus ribu rupiah")).toBe(14500000);
    expect(layanan.terbilangKeAngka("seratus sembilan puluh sembilan ribu lima ratus")).toBe(199500);
    expect(layanan.terbilangKeAngka("Tiga Juta Ribu Rupiah")).toBeNull();
    expect(layanan.angkaRupiah("1.500.000,-")).toEqual({ nilai: 1500000, cacat: false });
    expect(layanan.angkaRupiah("500.000.00")).toEqual({ nilai: 500000, cacat: false });
    expect(layanan.angkaRupiah("1.00.000")?.cacat).toBe(true);
  });
});

const PEMBEBANAN: PembebananIkrar = {
  pos: [
    { jenis: "mutah", sebutan: "Mut'ah", jumlah: 10000000, berkala: false, penerima: "Penggugat Rekonvensi", keterangan: "", kalimat: "Menghukum Tergugat Rekonvensi untuk memberikan mut'ah ... Rp10.000.000,00", ragu: false, catatan: "" },
    { jenis: "iddah", sebutan: "Nafkah iddah", jumlah: 4500000, berkala: false, penerima: "Penggugat Rekonvensi", keterangan: "", kalimat: "Menghukum Tergugat Rekonvensi ... nafkah iddah sejumlah Rp4.500.000,00", ragu: false, catatan: "" },
    { jenis: "anak", sebutan: "Nafkah anak", jumlah: 500000, berkala: true, penerima: "anak, melalui Penggugat Rekonvensi", keterangan: "", kalimat: "... Rp500.000,00 setiap bulan", ragu: false, catatan: "" },
  ],
  totalSekaligus: 14500000,
  berkalaPerBulan: 500000,
  adaTanpaAngka: false,
  adaRagu: false,
  sebelumIkrar: true,
  waktuBayar: "Menetapkan kewajiban ... dibayarkan sebelum Tergugat Rekonvensi mengucapkan ikrar talak",
  tidakTerbaca: false,
};

describe("penanda di kolom Putusan - hanya pada sidang ikrar", () => {
  it("tampil pada sidang ikrar (bendera SIPP) yang berpembebanan", () => {
    expect(tampilkanPembebanan({ sidangIkrarTalak: true, agenda: "SIDANG IKRAR TALAK", pembebanan: PEMBEBANAN })).toBe(true);
    // Bendera T tetapi agendanya ikrar - aturan sidangIkrar yang sama dengan penanda biru.
    expect(tampilkanPembebanan({ sidangIkrarTalak: false, agenda: "Sidang Ikrar Talak", pembebanan: PEMBEBANAN })).toBe(true);
  });

  it("TIDAK tampil pada sidang bukan ikrar walau datanya ada", () => {
    expect(tampilkanPembebanan({ sidangIkrarTalak: false, agenda: "Pembacaan putusan", pembebanan: PEMBEBANAN })).toBe(false);
    const { container } = render(
      <LencanaPembebananIkrar baris={{ sidangIkrarTalak: false, agenda: "Pembuktian", pembebanan: PEMBEBANAN }} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("TIDAK tampil pada sidang ikrar tanpa pembebanan", () => {
    expect(tampilkanPembebanan({ sidangIkrarTalak: true, agenda: "SIDANG IKRAR TALAK", pembebanan: null })).toBe(false);
    expect(
      tampilkanPembebanan({ sidangIkrarTalak: true, pembebanan: { ...PEMBEBANAN, pos: [], tidakTerbaca: false } })
    ).toBe(false);
  });

  it("lencana menyebut total sekaligus dan bulanan", () => {
    render(<LencanaPembebananIkrar baris={{ sidangIkrarTalak: true, agenda: "SIDANG IKRAR TALAK", pembebanan: PEMBEBANAN }} />);
    const lencana = screen.getByText("pembebanan Rp 14,5 jt + Rp 500 rb/bln");
    expect(lencana.getAttribute("title")).toContain("Mut'ah: Rp 10.000.000");
    expect(lencana.getAttribute("title")).toContain("sebelum/saat ikrar");
  });

  it("bentuk lencana: barang, ragu, tidak terbaca", () => {
    expect(rupiahRingkas(2250000)).toBe("Rp 2,3 jt");
    expect(
      teksLencanaPembebanan({ ...PEMBEBANAN, pos: [{ ...PEMBEBANAN.pos[0], jumlah: null }], totalSekaligus: 0, berkalaPerBulan: 0, adaTanpaAngka: true })
    ).toBe("pembebanan (barang)");
    expect(teksLencanaPembebanan({ ...PEMBEBANAN, adaRagu: true })).toMatch(/\?$/);
    expect(teksLencanaPembebanan({ ...PEMBEBANAN, pos: [], tidakTerbaca: true })).toBe("pembebanan ?");
  });

  it("kolom Putusan memasangnya di BAWAH penanda putusan, dan Rincian hanya menerimanya dari sidang ikrar", () => {
    const isi = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
    const letakBelumPutus = isi.indexOf('<span className="text-muted-foreground">belum putus</span>');
    const letakLencana = isi.indexOf("<LencanaPembebananIkrar baris={baris} />");
    const letakKonseptor = isi.indexOf("<SelKonseptorSementara");
    expect(letakBelumPutus).toBeGreaterThan(0);
    expect(letakLencana).toBeGreaterThan(letakBelumPutus);
    expect(letakLencana).toBeLessThan(letakKonseptor);
    expect(isi).toContain("pembebanan={sidangIkrar(baris) ? baris.pembebanan ?? null : null}");
  });
});

describe("bagian Rincian - tiap pos dan totalnya", () => {
  it("menampilkan jenis, jumlah, penerima, kalimat sumber, total sekaligus dan bulanan", () => {
    render(<PembebananIkrarRincian pembebanan={PEMBEBANAN} />);
    expect(screen.getByText("Pembebanan saat ikrar talak")).toBeTruthy();
    const tabel = screen.getByRole("table");
    const baris = within(tabel).getAllByRole("row");
    // kepala + 3 pos + total sekaligus + bulanan
    expect(baris).toHaveLength(6);
    expect(within(baris[1]).getByText("Mut'ah")).toBeTruthy();
    expect(within(baris[1]).getByText("Rp 10.000.000")).toBeTruthy();
    expect(within(baris[1]).getByText("Penggugat Rekonvensi")).toBeTruthy();
    expect(within(baris[1]).getByText(/Menghukum Tergugat Rekonvensi untuk memberikan mut'ah/)).toBeTruthy();
    expect(within(baris[3]).getByText("/bulan", { exact: false })).toBeTruthy();
    expect(tabel.querySelector('[data-total="sekaligus"]')?.textContent).toBe("Rp 14.500.000");
    expect(tabel.querySelector('[data-total="bulanan"]')?.textContent).toContain("Rp 500.000");
    expect(screen.getByText(/dibayarkan sebelum Tergugat Rekonvensi mengucapkan ikrar talak/)).toBeTruthy();
  });

  it("pos ragu menampilkan catatannya; pos tanpa angka tidak ikut total", () => {
    render(
      <PembebananIkrarRincian
        pembebanan={{
          ...PEMBEBANAN,
          pos: [
            { ...PEMBEBANAN.pos[1], ragu: true, catatan: "angka Rp7.500.000 berbeda dengan terbilangnya (7.000.500)" },
            { ...PEMBEBANAN.pos[0], jumlah: null, keterangan: "cincin emas seberat 2 gram" },
          ],
          totalSekaligus: 4500000,
          berkalaPerBulan: 0,
          adaTanpaAngka: true,
        }}
      />
    );
    expect(screen.getByText(/angka Rp7\.500\.000 berbeda dengan terbilangnya/)).toBeTruthy();
    expect(screen.getByText("tanpa angka")).toBeTruthy();
    expect(screen.getByText("cincin emas seberat 2 gram")).toBeTruthy();
    expect(screen.getByText(/belum termasuk pos tanpa angka/)).toBeTruthy();
    expect(document.querySelector('[data-total="sekaligus"]')?.textContent).toBe("Rp 4.500.000");
  });

  it("tidak menggambar apa pun tanpa pembebanan", () => {
    const { container } = render(<PembebananIkrarRincian pembebanan={null} />);
    expect(container.innerHTML).toBe("");
  });
});
