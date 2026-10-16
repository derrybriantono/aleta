// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import { PenandaSitaAgenda, RincianJawabanSitaEksekusi } from "@/components/portal/penanda-sita-agenda";
import type { PenandaJawabanPerkara, TemuanJawaban } from "@/lib/penanda-jawaban";
import {
  KELAS_PENANDA_SITA,
  KUNCI_SAKLAR_EKSEKUSI,
  keadaanJawaban,
  penandaSitaBaris,
  ringkasanEksekusi,
  type EksekusiPerkara,
  type SitaPerkara,
} from "@/lib/penanda-sita";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

/**
 * ============================================================================
 * PENANDA SITA + EKSEPSI/REKONVENSI/SITA/EKSEKUSI DI RINCIAN (butir 22-24, 12 Okt 2026)
 * ============================================================================
 *
 * Diukur atas data lokal 12 Okt 2026 (aleta_bot sitaEksekusiPerkaraService):
 * 91 petitum berhuruf "sita" dibaca satu per satu - 55 perkara bersita
 * (Donggala 29: Jaminan 20, Marital 8, Revindikasi 1, "Sita Harta Waris" 1;
 * Bungku 26: Jaminan 10, Marital 16), 36 sisanya nama orang (Rosita,
 * Masita, Warsita, ma'sita) atau "posita". Contoh di bawah adalah kalimat
 * nyata dari perkara yang disebut.
 */

const akar = path.resolve(process.cwd(), "..");
const muat = createRequire(import.meta.url);

type Butir = { kode: string; nama: string; kutipan: string };
type Layanan = {
  sitaDariPetitum: (html: string) => Butir[];
  satukanSita: (m: unknown) => SitaPerkara | null;
  ringkasEksekusi: (b: Record<string, unknown>) => EksekusiPerkara;
  tanggalSah: (x: unknown) => string;
  sitaEksekusiBanyakPerkara: (
    id: number[],
    opsi: unknown
  ) => Promise<{ sita: Record<string, SitaPerkara>; eksekusi: Record<string, EksekusiPerkara[]> }>;
};
const layanan = muat(path.join(akar, "aleta_bot/services/sitaEksekusiPerkaraService.js")) as Layanan;

const petitum = (...butir: string[]) =>
  `<p>PRIMAIR:</p>${butir.map((b, i) => `<p>${i + 1}. ${b};</p>`).join("")}<p>Subsidair:</p><p>Mohon putusan yang seadil-adilnya (ex aequo et bono);</p>`;
const nama = (html: string) => layanan.sitaDariPetitum(html).map((x) => x.nama);

describe("petitum -> jenis sita (contoh nyata)", () => {
  it("Sita Jaminan: sah dan berharga, conservatoir beslag berbagai ejaan, permohonan meletakkan", () => {
    // 168/Pdt.G/2016/PA.Dgl, 170/Pdt.G/2022/PA.Dgl (baslag), 149/Pdt.G/2022/PA.Dgl
    expect(nama(petitum("Menyatakan sah dan berharga sita jaminan (conservatior beslag) yang diletakkan Pengadilan Agama Donggala"))).toEqual(["Sita Jaminan"]);
    expect(nama(petitum("Menyatakan menurut hukum sah dan berharga sita jaminan ( conservatoir baslag ) yang diletakan"))).toEqual(["Sita Jaminan"]);
    expect(nama(petitum("Meletakkan sita jaminan ( conservatoir beslag ) atas harta peninggalan tersebut diatas"))).toEqual(["Sita Jaminan"]);
    // 8/Pdt.G/2023/PA.Buk - "harta bersama" sesudah istilah tersurat tidak menjadikannya marital.
    expect(nama(petitum("Menetapkan dan memerintahkan agar dilakukan sita jaminan (conservatoir beslaag) atas objek harta bersama tersebut"))).toEqual([
      "Sita Jaminan",
    ]);
  });

  it("Sita Marital: marital, maritale beslag, salah ketik 'material', 'sita harta bersama'", () => {
    expect(nama(petitum("Menyatakan sita marital atas harta bersama sah dan berharga"))).toEqual(["Sita Marital"]); // 421/Pdt.G/2022/PA.Buk
    expect(nama(petitum("Menyatakan sita material atas harta bersama sah dan berharga"))).toEqual(["Sita Marital"]); // 474/Pdt.G/2023/PA.Buk
    // 506/Pdt.G/2026/PA.Dgl: "jaminan marital" = marital
    expect(nama(petitum("Menyatakan sah dan berharga sita jaminan marital (maritale beslag) yang diletakan atas objek sengketa"))).toEqual(["Sita Marital"]);
    // 282/Pdt.G/2024/PA.Buk
    expect(nama(petitum("Menyatakan sah dan berharga sita harta bersama ( marital beslag ) terhadap objek sengketa"))).toEqual(["Sita Marital"]);
  });

  it("dua jenis dalam satu butir: jaminan (cb) dan revindikasi (rb)", () => {
    // 366/Pdt.G/2017/PA.Dgl
    expect(
      nama(petitum("Menyatakan sah dan berharga sita jaminan (cb) dan sita rivindikatoir berslaag (rb) yang diletakkan oleh Pengadilan Agama Donggala"))
    ).toEqual(["Sita Jaminan", "Sita Revindikasi"]);
  });

  it("Sita Eksekusi dan sita lain ('Sita' + kata aslinya)", () => {
    expect(nama(petitum("Menyatakan sah dan berharga sita eksekusi atas objek tersebut"))).toEqual(["Sita Eksekusi"]);
    // 93/Pdt.G/2024/PA.Dgl
    expect(nama(petitum("Menyatakan sita harta waris yang diletakkan oleh Pengadilan Agama Donggala atas seluruh objek perkara adalah sah"))).toEqual([
      "Sita Harta Waris",
    ]);
  });

  it("nama orang, posita, juru sita, penyitaan: BUKAN sita", () => {
    expect(nama(petitum("Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat (Rosita binti Laturu)"))).toEqual([]);
    expect(nama(petitum("Menyatakan sah perkawinan Pemohon I dengan Pemohon II ( Masita binti Ashar )"))).toEqual([]);
    expect(nama(petitum("sebelah utara berbatas dengan saudari ma'sita"))).toEqual([]); // 171/Pdt.G/2022/PA.Dgl
    expect(nama(petitum("Menyatakan harta sebagaimana tersebut dalam posita poin 5 adalah harta bersama"))).toEqual([]);
    expect(nama(petitum("Memerintahkan juru sita untuk menyerahkan salinan putusan"))).toEqual([]);
    // 602/Pdt.G/2026/PA.Dgl butir 13
    expect(nama(petitum("putusan ini berlaku sebagai pengganti akta penyerahan/penyitaan fisik atas objek sengketa"))).toEqual([]);
  });

  it("nama orang berawal 'Sita' (Sita Wati binti ..., 16 Okt) BUKAN sita; sita sungguhan dekat nama tetap terbaca", () => {
    // Temuan L2 16 Okt (salinan Donggala): dulu terbaca "Sita Wati Binti".
    expect(nama(petitum("Menetapkan Sita Wati binti Lamaru sebagai ahli waris almarhum"))).toEqual([]);
    expect(nama(petitum("Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat Sita Wati Binti Lamaru"))).toEqual([]);
    expect(nama(petitum("Mengizinkan Pemohon menikah dengan Sita alias Ita"))).toEqual([]);
    expect(nama(petitum("Menetapkan anak bernama Sita Nurhaliza berada dalam pengasuhan Penggugat"))).toEqual([]);
    expect(nama(petitum("Menetapkan Sita Rahma, umur 12 tahun, berada dalam pengasuhan Penggugat"))).toEqual([]);
    expect(nama(petitum("Menyatakan sah dan berharga sita jaminan terhadap rumah milik Ahmad bin Laturu"))).toEqual(["Sita Jaminan"]);
    expect(nama(petitum("Menyatakan sah sita marital atas tanah Sita Wati binti Lamaru"))).toEqual(["Sita Marital"]);
  });

  it("butir menolak, subsider, dan pengangkatan sita tidak dihitung", () => {
    expect(nama(petitum("Menolak permohonan sita jaminan Penggugat"))).toEqual([]);
    expect(nama("<p>Primair: Mengabulkan gugatan;</p><p>Subsidair: menyatakan sah dan berharga sita jaminan;</p>")).toEqual([]);
    expect(nama(petitum("Memerintahkan pengangkatan sita jaminan atas objek sengketa"))).toEqual([]);
  });

  it("posita 'bahwa' dibuang KECUALI permohonan sita (164/Pdt.G/2023/PA.Buk)", () => {
    expect(nama(petitum("Bahwa objek tersebut pernah disita oleh pihak lain dan sita itu sudah diangkat"))).toEqual([]);
    expect(
      nama(petitum("Bahwa untuk mengamankan harta tersebut Penggugat memohon kepada Pengadilan Agama Bungku untuk meletakkan sita marital atas barang yang masih ada"))
    ).toEqual(["Sita Marital"]);
  });

  it("'SUBSIDER: PRIMER:' di depan tidak membuang seluruh petitum (253/Pdt.G/2024/PA.Buk)", () => {
    const html =
      "<p><strong>SUBSIDER:</strong></p><p><strong>PRIMER</strong><strong>:</strong></p><ol><li>Mengabulkan gugatan;</li><li>Menetapkan dan memerintahkan agar dilakukan Sita Marital atas objek harta bersama;</li></ol><p><strong>SUBSIDER:</strong></p><p>Mohon putusan seadil-adilnya</p>";
    expect(nama(html)).toEqual(["Sita Marital"]);
  });

  it("kutipan memuat butir petitumnya", () => {
    const [b] = layanan.sitaDariPetitum(petitum("Menyatakan sah dan berharga sita marital terhadap obyek sengketa"));
    expect(b.kutipan).toContain("sah dan berharga sita marital");
  });
});

describe("eksekusi dan penyatuan sumber", () => {
  // Baris nyata 1/Pdt.Eks/2022/PA.Dgl (perkara 26/Pdt.G/2022/PA.Dgl).
  const baris = {
    id: 1,
    perkara_id: 6326,
    nomor_perkara_pn: "26/Pdt.G/2022/PA.Dgl",
    eksekusi_nomor_perkara: "26/Pdt.G/2022/PA.Dgl",
    nomor_register_eksekusi: "1/Pdt.Eks/2022/PA.Dgl",
    eksekusi_putusan: 10,
    permohonan_eksekusi: "2022-09-26",
    status_eksekusi_text: "Pelaksanaan Eksekusi",
    penetapan_teguran_eksekusi: "2022-09-28",
    pelaksanaan_teguran_eksekusi: "2022-10-10",
    penetapan_sita_eksekusi: "2022-10-18",
    nomor_penetapan_sita_eksekusi: "1/Pdt.Eks/2022/PA.Dgl",
    pelaksanaan_sita_eksekusi: "2022-11-29",
    penetapan_perintah_eksekusi_lelang: "0000-00-00",
    pelaksanaan_eksekusi_lelang: "0000-00-00",
    penetapan_perintah_eksekusi_rill: "2022-12-12",
    pelaksanaan_eksekusi_rill: "2023-02-21",
    tanggal_cabut_eks: null,
  };

  it("tanggal 0000-00-00/NULL kosong; jenis riil dari perintah eksekusi riil; tahap terakhir", () => {
    expect(layanan.tanggalSah("0000-00-00")).toBe("");
    const e = layanan.ringkasEksekusi(baris);
    expect(e).toMatchObject({
      nomorRegister: "1/Pdt.Eks/2022/PA.Dgl",
      tingkatPutusan: "tingkat pertama",
      tanggalPermohonan: "2022-09-26",
      jenis: "riil",
      statusTerakhir: "Pelaksanaan Eksekusi",
      tahapTerakhir: { nama: "Pelaksanaan eksekusi riil", tanggal: "2023-02-21" },
    });
    expect(e.tahap.map((t) => t.nama)).not.toContain("Pelaksanaan lelang");
    expect(ringkasanEksekusi(e)).toContain("1/Pdt.Eks/2022/PA.Dgl");
    expect(ringkasanEksekusi(e)).toContain("26 September 2022");
  });

  it("sita eksekusi SIPP + sita jaminan petitum menjadi satu daftar; tanpa apa pun = null", () => {
    const e = layanan.ringkasEksekusi(baris);
    const s = layanan.satukanSita({ petitum: petitum("Menyatakan sah dan berharga sita jaminan"), eksekusi: [e] });
    expect(s?.daftar.map((x) => [x.nama, x.sumber])).toEqual([
      ["Sita Jaminan", "petitum"],
      ["Sita Eksekusi", "sipp"],
    ]);
    expect(s?.daftar[1].catatanSipp).toContain("2022-10-18");
    expect(layanan.satukanSita({ petitum: petitum("Mengabulkan gugatan") })).toBeNull();
  });

  it("pembaca SIPP: eksekusi dijaga perkara_id DAN nomor, kolom antarversi dipilih, hanya SELECT", async () => {
    const kueri: string[] = [];
    const db = {
      query(sql: string, _p: unknown[], cb: (e: unknown, r: unknown[]) => void) {
        kueri.push(sql);
        if (/perkara_eksekusi/.test(sql)) cb(null, [baris]);
        else if (/perkara_putusan_sela/.test(sql)) cb(null, []);
        else cb(null, [{ perkaraId: 6326, petitum: petitum("Mengabulkan gugatan") }, { perkaraId: 7, petitum: petitum("Menyatakan sita marital sah dan berharga") }]);
      },
    };
    // SIPP Bungku tidak punya terkait_perkara_id dkk - hanya kolom yang ada yang dipilih.
    const kolomEks = Object.keys(baris);
    const skema = { kolomAda: async () => true, kolomTabel: async () => kolomEks };
    const hasil = await layanan.sitaEksekusiBanyakPerkara([6326, 7], { db, skema });
    expect(Object.keys(hasil.eksekusi)).toEqual(["6326"]);
    expect(hasil.sita["6326"].daftar[0].nama).toBe("Sita Eksekusi");
    expect(hasil.sita["7"].daftar[0].nama).toBe("Sita Marital");
    const qEks = kueri.find((q) => /perkara_eksekusi/.test(q)) ?? "";
    expect(qEks).toMatch(/p\.perkara_id = e\.perkara_id AND TRIM\(p\.nomor_perkara\) = TRIM\(e\.nomor_perkara_pn\)/);
    expect(qEks).not.toContain("terkait_perkara_id");
    expect(kueri.every((q) => /^\s*SELECT/i.test(q))).toBe(true);
  });

  it("tabel eksekusi/putusan sela tidak ada: gagal-terbuka, petitum tetap dibaca", async () => {
    const kueri: string[] = [];
    const db = {
      query(sql: string, _p: unknown[], cb: (e: unknown, r: unknown[]) => void) {
        kueri.push(sql);
        cb(null, [{ perkaraId: 7, petitum: petitum("Menyatakan sita marital sah dan berharga") }]);
      },
    };
    const skema = { kolomAda: async (t: string) => t === "perkara", kolomTabel: async () => [] };
    const hasil = await layanan.sitaEksekusiBanyakPerkara([7], { db, skema });
    expect(hasil.sita["7"].daftar[0].nama).toBe("Sita Marital");
    expect(kueri).toHaveLength(1);
  });

  it("perkara_putusan_sela terdaftar di sippSkemaService.TABEL (perkara_eksekusi sudah)", () => {
    const teks = readFileSync(path.join(akar, "aleta_bot/services/sippSkemaService.js"), "utf8");
    const awal = teks.indexOf("const TABEL = [");
    const blok = teks.slice(awal, teks.indexOf("];", awal));
    expect(blok).toContain('"perkara_putusan_sela"');
    expect(blok).toContain('"perkara_eksekusi"');
  });
});

describe("layar: lencana Agenda, rincian, Status Perkara", () => {
  const sita: SitaPerkara = {
    daftar: [
      { kode: "jaminan", nama: "Sita Jaminan", sumber: "petitum", kutipan: "menyatakan sah dan berharga sita jaminan" },
      { kode: "eksekusi", nama: "Sita Eksekusi", sumber: "sipp", catatanSipp: "Register eksekusi 1/Pdt.Eks/2022/PA.Dgl" },
    ],
  };

  it("lencana: label jenis berhuruf awal kapital, title memuat kutipan; tidak terbaca = diam", () => {
    const p = penandaSitaBaris({ nomorPerkara: "1", sita, sitaTerbaca: true });
    expect(p.map((x) => x.label)).toEqual(["Sita Jaminan", "Sita Eksekusi"]);
    expect(p[0].kelas).toBe(KELAS_PENANDA_SITA);
    expect(p[0].keterangan).toContain('"menyatakan sah dan berharga sita jaminan"');
    expect(p[1].keterangan).toContain("SIPP: Register eksekusi");
    expect(penandaSitaBaris({ nomorPerkara: "1", sita, sitaTerbaca: false })).toEqual([]);
    expect(penandaSitaBaris({ nomorPerkara: "1" })).toEqual([]);
  });

  it("komponen lencana: data-penanda-sita + title, ditekan = membuka; kosong = tidak digambar", () => {
    const html = renderToStaticMarkup(createElement(PenandaSitaAgenda, { baris: { nomorPerkara: "1", sita, sitaTerbaca: true }, onBuka: () => undefined }));
    expect(html).toContain('data-penanda-sita="jaminan"');
    expect(html).toContain("Sita Jaminan");
    expect(html).toContain("title=");
    expect(renderToStaticMarkup(createElement(PenandaSitaAgenda, { baris: { nomorPerkara: "1" } }))).toBe("");
  });

  const temuan = (keadaan: TemuanJawaban["keadaan"]): TemuanJawaban => ({
    keadaan,
    dokumen: "Jawaban Tergugat",
    jenisDokumen: "Jawaban",
    diunggah: "2026-10-01",
    kalimat: "Dalam Eksepsi: menolak gugatan",
    sumber: "teks",
  });
  const jawaban: PenandaJawabanPerkara = {
    eksepsi: temuan("ada"),
    rekonvensi: temuan(""),
    dokumen: 1,
    berkas: 1,
    dibaca: 1,
    belumDibaca: 0,
    tidakTerbaca: 0,
  };

  it("keadaan eksepsi/rekonvensi: diajukan / tidak disebut / belum ada / tidak terbaca - tidak terbaca BUKAN 'tidak ada'", () => {
    const k = keadaanJawaban(jawaban, true);
    expect(k[0]).toMatchObject({ judul: "Eksepsi", ada: true });
    expect(k[0].isi).toContain('"Jawaban Tergugat"');
    expect(k[1].isi).toContain("tidak disebut");
    expect(keadaanJawaban(null, true)[0].isi).toContain("belum ada jawaban");
    expect(keadaanJawaban(jawaban, false)[0].isi).toContain("tidak dapat dibaca");
    expect(keadaanJawaban({ ...jawaban, eksepsi: null, belumDibaca: 2 }, true)[0].isi).toContain("2 berkas belum dibaca");
  });

  it("rincian: eksepsi/rekonvensi ikut penanda-jawaban, sita ikut penanda-sita, eksekusi ikut penanda-eksekusi (terpisah)", () => {
    const eks = layanan.ringkasEksekusi({ nomor_register_eksekusi: "1/Pdt.Eks/2024/PA.Dgl", permohonan_eksekusi: "2024-12-09", status_eksekusi_text: "Pelaksanaan Teguran Eksekusi" });
    const bahan = { penandaJawaban: jawaban, penandaJawabanTerbaca: true, sita, eksekusi: [eks], sitaTerbaca: true };
    const penuh = renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: true, tampilSita: true, tampilEksekusi: true }));
    expect(penuh).toContain("Eksepsi:");
    expect(penuh).toContain("Rekonvensi:");
    expect(penuh).toContain("Sita Jaminan");
    expect(penuh).toContain("dari petitum");
    expect(penuh).toContain("1/Pdt.Eks/2024/PA.Dgl");
    expect(penuh).toContain("Pelaksanaan Teguran Eksekusi");
    const tanpaSita = renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: true, tampilSita: false }));
    expect(tanpaSita).toContain("Eksepsi:");
    expect(tanpaSita).not.toContain("data-rincian-sita");
    expect(tanpaSita).not.toContain("data-rincian-eksekusi");
    const tanpaJawaban = renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: false, tampilSita: true, tampilEksekusi: true }));
    expect(tanpaJawaban).not.toContain("Eksepsi:");
    expect(tanpaJawaban).toContain("data-rincian-eksekusi");
    // 12OKT-N: Sita dan Eksekusi saling lepas.
    const hanyaSita = renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: false, tampilSita: true, tampilEksekusi: false }));
    expect(hanyaSita).toContain("data-rincian-sita");
    expect(hanyaSita).not.toContain("data-rincian-eksekusi");
    expect(hanyaSita).not.toContain("1/Pdt.Eks/2024/PA.Dgl");
    const hanyaEksekusi = renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: false, tampilSita: false, tampilEksekusi: true }));
    expect(hanyaEksekusi).toContain("data-rincian-eksekusi");
    expect(hanyaEksekusi).toContain("1/Pdt.Eks/2024/PA.Dgl");
    expect(hanyaEksekusi).not.toContain("data-rincian-sita");
    expect(hanyaEksekusi).not.toContain("Sita Jaminan");
    // Bawaan komponen: tampilEksekusi tidak diberikan = bagian Eksekusi tidak digambar.
    expect(renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: false, tampilSita: true }))).not.toContain("data-rincian-eksekusi");
    expect(renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan, tampilJawaban: false, tampilSita: false, tampilEksekusi: false }))).toBe("");
    // Bot lama (ruas tidak dikirim): diam.
    expect(renderToStaticMarkup(createElement(RincianJawabanSitaEksekusi, { bahan: {}, tampilJawaban: true, tampilSita: true, tampilEksekusi: true }))).toBe("");
    // Tanpa sita/eksekusi: keadaan "tidak ada" tertulis.
    const kosong = renderToStaticMarkup(
      createElement(RincianJawabanSitaEksekusi, { bahan: { sita: null, eksekusi: [], sitaTerbaca: true }, tampilJawaban: false, tampilSita: true, tampilEksekusi: true })
    );
    expect(kosong).toContain("tidak ada permohonan sita");
    expect(kosong).toContain("tidak ada permohonan eksekusi");
  });

  const layar = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"), "utf8");
  const status = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-status-perkara.tsx"), "utf8");
  const jadwalBot = readFileSync(path.join(akar, "aleta_bot/services/sippJadwalSidangService.js"), "utf8");
  const statusBot = readFileSync(path.join(akar, "aleta_bot/services/sippStatusPerkaraService.js"), "utf8");

  it("dipasang di kolom Agenda TEPAT di bawah Eksepsi/Rekonvensi, sebelum umur perkara", () => {
    const i = layar.indexOf('tampil(tampilan, "penanda-sita") ? (');
    expect(i).toBeGreaterThan(layar.indexOf('tampil(tampilan, "penanda-jawaban") ? ('));
    expect(i).toBeLessThan(layar.indexOf("<UmurPerkara durasi={baris.durasi}"));
    expect(layar.slice(i, i + 300)).toContain("<PenandaSitaAgenda");
    expect(layar.slice(i, i + 300)).toContain("onBukaStatus(baris.nomorPerkara)");
  });

  it("rincian Jadwal Sidang dan Status Perkara memasang bagiannya; bot mengirim ruasnya dari sumber yang sama", () => {
    expect(layar).toContain("<RincianJawabanSitaEksekusi");
    expect(layar).toContain('tampilSita={tampil(tampilan, "penanda-sita")}');
    expect(layar).toContain('tampilEksekusi={tampil(tampilan, "penanda-eksekusi")');
    expect(status).toContain("useSaklarTampilanAntrian(KUNCI_SAKLAR_EKSEKUSI)");
    expect(status).toContain("<RincianJawabanSitaEksekusi bahan={status}");
    expect(status).toContain("useSaklarTampilanAntrian(KUNCI_SAKLAR_SITA)");
    expect(jadwalBot).toContain("sitaEksekusiPerkaraService.sitaEksekusiBanyakPerkara(idPerkara)");
    // Eksepsi/rekonvensi rincian = penandaJawabanService, sama dengan kolom Agenda.
    expect(jadwalBot).toContain("penandaJawabanService\n      .petaBanyakPerkara([nomorPerkara])");
    expect(statusBot).toContain("rincian.penandaJawaban");
    expect(statusBot).toContain("rincian.sita");
  });

  it("saklar penanda-sita: kelompok penanda, menyala bawaan, tidak wajib, punya contoh", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "penanda-sita");
    expect(s).toMatchObject({ kelompok: "penanda" });
    expect(s?.wajib ?? false).toBe(false);
    expect(tampil(tampilanBawaan(), "penanda-sita")).toBe(true);
    expect(CONTOH_TAMPILAN["penanda-sita"]).toBeTruthy();
    // Tepat sesudah penanda-jawaban di panel.
    const urut = SAKLAR_TAMPILAN.map((x) => x.kunci);
    expect(urut.indexOf("penanda-sita")).toBe(urut.indexOf("penanda-jawaban") + 1);
    // 12OKT-N: label kembali "Sita"; Eksekusi saklar sendiri tepat sesudahnya.
    expect(s?.label).toBe("Sita");
    expect(urut.indexOf("penanda-eksekusi")).toBe(urut.indexOf("penanda-sita") + 1);
  });

  it("saklar penanda-eksekusi: kelompok penanda, menyala bawaan, tidak wajib, punya contoh", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "penanda-eksekusi");
    expect(s).toMatchObject({ kelompok: "penanda", label: "Eksekusi" });
    expect(s?.wajib ?? false).toBe(false);
    expect(tampil(tampilanBawaan(), "penanda-eksekusi")).toBe(true);
    expect(CONTOH_TAMPILAN["penanda-eksekusi"]).toBeTruthy();
    expect(KUNCI_SAKLAR_EKSEKUSI).toBe("penanda-eksekusi");
  });
});
