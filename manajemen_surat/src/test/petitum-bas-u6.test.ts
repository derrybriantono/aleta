// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - PETITUM BERBUTIR dan BAS PERKARA (agen U6)
 * ============================================================================
 *   A  petitumBerbutir: butir bernomor dipisah, jenis tuntutan dikenali, nominal/periode terbaca, subsider tidak dihitung utama,
 *      butir tak dikenal diberi "lain" (tidak dikarang), bentuk HTML editor SIPP sungguhan terbaca;
 *   B  basPerkara: keterangan saksi dibagi per saksi dan per pokok, bukti surat diurai (tanda P.n/T.n, jenis, nomor, tanggal);
 *   C  paket ABT u6-fakta-sinkron: nomor dalam jatah 4600-4699, tanpa kata aplikasi, kueri hanya SELECT, PASANG/PERIKSA/PULIH
 *      konsisten dengan variabel.json (md5 dan panjang), dan hanya MENAMBAH baris.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const P = require_(path.join(AKAR, "aleta_bot", "services", "petitumBerbutir.js")) as {
  petitumBerbutir: (h: string, o?: Record<string, unknown>) => any;
  jenisButir: (t: string) => string;
};
const B = require_(path.join(AKAR, "aleta_bot", "services", "basPerkara.js")) as {
  bacaBas: (id: number, abt: any, sipp: any) => Promise<any>;
  uraiBukti: (b: string, sisi: string) => any;
  pecahBukti: (t: string) => string[];
};

const div = (...baris: string[]) => baris.map((b) => `<div>${b}</div>`).join("\n\n");

describe("A. petitumBerbutir", () => {
  it("cerai gugat sederhana dari SIPP: kabul, talak ba'in sughra, biaya; subsider terpisah", () => {
    const h = P.petitumBerbutir(
      div("Primer", "1. Mengabulkan Gugatan Penggugat;", "2. Menjatuhkan talak satu ba&#39;in shughra Tergugat (Irfan bin M. Nawir) terhadap Penggugat (Ika binti Abu);", "3. Membebankan biaya perkara ini sesuai peraturan yang berlaku; ", " ", "Subsider:", "Jika Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono);")
    );
    expect(h.butir.map((b: any) => b.jenis)).toEqual(["kabul", "cerai-talak", "biaya", "subsider"]);
    expect(h.butir[1].varian).toBe("talak satu ba'in sughra");
    expect(h.butir.find((b: any) => b.jenis === "subsider").utama).toBe(false);
    expect(h.utama).toHaveLength(3);
    expect(h.butir[0].bagian).toBe("primer");
    expect(h.butir[3].bagian).toBe("subsider");
  });
  it("kumulasi: nafkah iddah per bulan x bulan, mut'ah, madliyah, nafkah anak, hak asuh - dengan nominal yang DITUNTUT", () => {
    const h = P.petitumBerbutir(
      div(
        "1. Mengabulkan gugatan Penggugat;",
        "2. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;",
        "3. Menghukum Tergugat membayar nafkah selama masa iddah sebesar Rp4.000.000,00 (empat juta rupiah) setiap bulan selama 3 (tiga) bulan;",
        "4. Menghukum Tergugat membayar mut'ah berupa uang sebesar Rp15.000.000,00 (lima belas juta rupiah);",
        "5. Menghukum Tergugat membayar nafkah lampau (madliyah) sebesar Rp12.000.000,00;",
        "6. Menetapkan Penggugat sebagai pemegang hak asuh (hadhanah) anak bernama Aisilah, umur 8 tahun;",
        "7. Menghukum Tergugat membayar nafkah anak sebesar Rp1.000.000,00 setiap bulan sampai anak dewasa;",
        "8. Membebankan biaya perkara menurut hukum;"
      ),
      { posita: "Penggugat menuntut nafkah iddah dan mut'ah serta hadhanah" }
    );
    const per = Object.fromEntries(h.butir.map((b: any) => [b.jenis, b]));
    expect(h.butir.map((b: any) => b.jenis)).toEqual(["kabul", "cerai-talak", "nafkah-iddah", "mutah", "nafkah-madliyah", "hadhanah", "nafkah-anak", "biaya"]);
    expect(per["nafkah-iddah"].nominal).toMatchObject({ nilai: 4000000, perBulan: true, bulan: 3, total: 12000000 });
    expect(per["mutah"].nominal.nilai).toBe(15000000);
    expect(per["nafkah-madliyah"].nominal.nilai).toBe(12000000);
    expect(per["nafkah-anak"].nominal).toMatchObject({ nilai: 1000000, perBulan: true });
    expect(per["nafkah-iddah"].dibebani).toBe("T");
    expect(per["hadhanah"].varian).toBe("kepada Penggugat/Pemohon");
    expect(per["nafkah-iddah"].didukungPosita).toBe(true);
    expect(per["nafkah-madliyah"].didukungPosita).toBe(false); // posita tidak menyebutnya: tanda untuk hakim
    expect(h.jenisAda).toMatchObject({ "nafkah-iddah": 1, mutah: 1, hadhanah: 1 });
    expect(h.ringkas).toMatch(/Nafkah iddah Rp4\.000\.000\/bulan/);
  });
  it("sub-butir (a., b., -) menempel pada butir induknya dan tidak menjadi butir sendiri", () => {
    const h = P.petitumBerbutir(div("1. Menetapkan harta bersama berupa:", "a. sebidang tanah di Desa Labuan;", "b. sebuah rumah permanen;", "2. Menghukum Tergugat menyerahkan setengah bagian kepada Penggugat;"));
    expect(h.butir).toHaveLength(2);
    expect(h.butir[0].jenis).toBe("harta-bersama");
    expect(h.butir[0].sub).toHaveLength(2);
    expect(h.butir[1].dibebani).toBe("T");
  });
  it("itsbat, dispensasi, wali adhal, ahli waris, poligami dikenali; yang tak dikenal menjadi 'lain' dan keyakinannya ragu", () => {
    const j = (t: string) => P.jenisButir(t);
    expect(j("Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan pada tanggal 5 Maret 2010")).toBe("itsbat-nikah");
    expect(j("Memberi dispensasi kepada Pemohon untuk menikahkan anak Pemohon")).toBe("dispensasi");
    expect(j("Menyatakan wali nikah Pemohon enggan (adhal) menjadi wali")).toBe("wali-adhal");
    expect(j("Menetapkan ahli waris dari almarhum Fulan bin Fulan adalah")).toBe("ahli-waris");
    expect(j("Memberi izin kepada Pemohon untuk menikah lagi dengan calon istri kedua")).toBe("poligami");
    expect(j("Memerintahkan Panitera untuk menyampaikan salinan kepada Kantor Urusan Agama yang mencatat")).toBe("perintah-panitera");
    expect(j("Memerintahkan kepada Pemohon I dan Pemohon II untuk mencatatkan pernikahannya di Kantor Urusan Agama")).toBe("pencatatan-akta");
    const h = P.petitumBerbutir(div("1. Menyatakan bahwa langit berwarna biru;"));
    expect(h.butir[0].jenis).toBe("lain");
    expect(h.butir[0].yakin).toBe("ragu");
  });
  it("petitum kosong atau HTML sampah tidak melempar galat dan tidak mengarang butir", () => {
    expect(P.petitumBerbutir("").butir).toEqual([]);
    expect(P.petitumBerbutir(null as any).ada).toBe(false);
    expect(P.petitumBerbutir("<div> </div><p>&nbsp;</p>").butir).toEqual([]);
  });
  it("tanpa penomoran dan dengan judul Provisi/Rekonvensi: bagian terbaca dari judul", () => {
    const h = P.petitumBerbutir(div("Dalam Provisi", "1. Memberi izin kepada Penggugat untuk tinggal terpisah dari Tergugat selama proses perkara;", "Dalam Pokok Perkara", "1. Mengabulkan gugatan Penggugat;", "Dalam Rekonvensi", "1. Menghukum Penggugat Rekonvensi membayar nafkah anak Rp500.000,00 setiap bulan;"));
    expect(h.butir.map((b: any) => b.bagian)).toEqual(["provisi", "primer", "rekonvensi"]);
    expect(h.butir[0].jenis).toBe("provisi-izin-berpisah");
    expect(h.butir[2].jenis).toBe("nafkah-anak");
  });
});

describe("B. basPerkara", () => {
  const abtRows: Record<string, any[]> = {
    keterangan: [
      { sidang_id: 1, saksi_id: 11, urutan_pertanyaan: 1, pertanyaan: "Apakah saudara kenal dengan Penggugat?", jawaban: "Saya adik kandung Penggugat;" },
      { sidang_id: 1, saksi_id: 11, urutan_pertanyaan: 2, pertanyaan: "Kapan Penggugat dan Tergugat menikah?", jawaban: "Mereka menikah pada tahun 2018;" },
      { sidang_id: 1, saksi_id: 11, urutan_pertanyaan: 3, pertanyaan: "Apa penyebab perselisihan dan pertengkaran?", jawaban: "Tergugat sering marah-marah;" },
      { sidang_id: 1, saksi_id: 11, urutan_pertanyaan: 4, pertanyaan: "Siapa yang meninggalkan tempat tinggal bersama?", jawaban: "Tergugat meninggalkan rumah;" },
      { sidang_id: 1, saksi_id: 12, urutan_pertanyaan: 1, pertanyaan: "Apakah saudara kenal dengan Penggugat?", jawaban: "Saya tetangga Penggugat;" },
      { sidang_id: 1, saksi_id: 12, urutan_pertanyaan: 2, pertanyaan: "Apakah ayah Penggugat sudah meninggal dunia?", jawaban: "Ya;" },
      { sidang_id: 1, saksi_id: 12, urutan_pertanyaan: 3, pertanyaan: "Apakah ada yang meninggalkan rumah?", jawaban: "  " },
    ],
    bukti: [
      {
        no_var: "1214",
        data:
          "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YENY, NIK 7210086301660001 tanggal 09 Juli 2020, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, lalu diberi tanda P.1 serta diberi paraf oleh Ketua Majelis;\r\n" +
          "Fotokopi Kutipan Akta Nikah, Nomor 97/03/VI/2012 tanggal 06 Juni 2012, yang dikeluarkan oleh KUA Kecamatan Gumbasa, lalu diberi tanda P.2 serta diberi paraf;",
      },
      { no_var: "9911", data: "Fotokopi Kartu Keluarga atas nama Tergugat, diberi tanda T.1 oleh Ketua Majelis;" },
    ],
  };
  const abt = async (sql: string) => (/abt_keterangan_saksi/.test(sql) ? abtRows.keterangan : /abt_data_teks/.test(sql) ? abtRows.bukti : []);
  const sipp = async (sql: string) =>
    /perkara_pihak5/.test(sql)
      ? [
          { id: 11, ke: 1, urutan: 1, nama: "Fadlih bin Amin", hubungan: "Adik Kandung Penggugat" },
          { id: 12, ke: 2, urutan: 1, nama: "Zul binti Yakub", hubungan: "Tetangga Tergugat" },
        ]
      : [];

  it("membagi keterangan per saksi/pihak dan per pokok pembuktian; jawaban kosong dibuang", async () => {
    const b = await B.bacaBas(1, abt, sipp);
    expect(b.ada).toBe(true);
    expect(b.jumlahSaksi).toEqual({ P: 1, T: 1 });
    expect(b.saksi[0]).toMatchObject({ pihak: "P", nama: "Fadlih bin Amin", hubungan: "Adik Kandung Penggugat" });
    expect(b.saksi[1].tanyaJawab).toHaveLength(2);
    expect(b.pokok.pernikahan[0].jawab).toMatch(/2018/);
    expect(b.pokok.penyebab[0].jawab).toMatch(/marah/);
    expect(b.pokok.pisah[0].nama).toBe("Fadlih bin Amin");
    expect(b.pokok.kematian).toHaveLength(1);
    // "meninggalkan" bukan kematian
    expect(b.pokok.kematian[0].tanya).toMatch(/meninggal dunia/);
  });
  it("menguraikan bukti surat: tanda, jenis, nomor, tanggal, penerbit; sisi menurut tanda", async () => {
    const b = await B.bacaBas(1, abt, sipp);
    expect(b.jumlahBukti).toEqual({ P: 2, T: 1 });
    const nikah = b.bukti.find((x: any) => x.jenisKode === "aktaNikah");
    expect(nikah).toMatchObject({ tanda: "P.2", sisi: "P", nomor: "97/03/VI/2012", tanggal: "06 Juni 2012" });
    expect(nikah.penerbit).toMatch(/KUA Kecamatan Gumbasa/);
    expect(b.bukti.find((x: any) => x.jenisKode === "ktp").tanda).toBe("P.1");
    expect(b.bukti.find((x: any) => x.tanda === "T.1").jenisKode).toBe("kk");
    expect(b.adaJenisBukti).toMatchObject({ aktaNikah: true, ktp: true, kk: true });
  });
  it("tanpa pembaca ABT: tetap menjawab (tanpa saksi/bukti) dan tidak melempar galat", async () => {
    const b = await B.bacaBas(1, null, sipp);
    expect(b.ada).toBe(false);
    expect(b.saksi).toEqual([]);
    expect(await B.bacaBas(0, abt, sipp)).toBeNull();
  });
  it("galat satu pembacaan tidak menggagalkan yang lain", async () => {
    const rusak = async (sql: string) => {
      if (/abt_keterangan_saksi/.test(sql)) throw new Error("tabel tidak ada");
      return abtRows.bukti;
    };
    const b = await B.bacaBas(1, rusak, sipp);
    expect(b.saksi).toEqual([]);
    expect(b.jumlahBukti.P).toBe(2);
  });
});

describe("C. paket ABT u6-fakta-sinkron", () => {
  const dir = path.join(AKAR, "abt-paket", "u6-fakta-sinkron");
  const V = JSON.parse(readFileSync(path.join(dir, "variabel.json"), "utf8")) as Array<{ no_var: number; nama: string; data_type: string; sql_query: string }>;
  const md5 = (t: string) => createHash("md5").update(Buffer.from(t, "latin1")).digest("hex");
  it("nomor dalam jatah 4600-4699, unik, tanpa kata aplikasi, kueri hanya SELECT", () => {
    expect(V.length).toBeGreaterThanOrEqual(25);
    expect(new Set(V.map((v) => v.no_var)).size).toBe(V.length);
    for (const v of V) {
      expect(v.no_var).toBeGreaterThanOrEqual(4600);
      expect(v.no_var).toBeLessThanOrEqual(4699);
      expect(v.data_type).toBe("data_sql");
      expect(`${v.nama} ${v.sql_query}`).not.toMatch(/aleta/i);
      expect(v.sql_query).toMatch(/^\s*select\b/i);
      expect(v.sql_query).not.toMatch(/\b(?:insert|update|delete|drop|alter|truncate|create)\b/i);
      expect(v.sql_query).toContain("#perkara_id#");
    }
  });
  it("PERIKSA memuat panjang dan md5 yang sama dengan variabel.json; PASANG hanya INSERT baris baru dalam satu transaksi", () => {
    const periksa = readFileSync(path.join(dir, "PERIKSA.sql"), "latin1");
    const pasang = readFileSync(path.join(dir, "PASANG.sql"), "latin1");
    for (const v of V) {
      expect(periksa).toContain(`'${md5(v.sql_query)}'`);
      expect(periksa).toContain(`LENGTH(sql_query) = ${v.sql_query.length}`);
    }
    expect(periksa).toMatch(/SEMUA COCOK/);
    expect((pasang.match(/INSERT INTO abt_variabel/g) || []).length).toBe(V.length);
    expect(pasang).not.toMatch(/\bUPDATE\s+abt_variabel|\bDELETE\b/i);
    expect(pasang).toMatch(/START TRANSACTION;[\s\S]*COMMIT;/);
    expect(pasang).toMatch(/more than 1 row|1242|prasyarat/i);
    expect(readFileSync(path.join(dir, "PULIH-HAPUS-BARU.sql"), "latin1")).toMatch(/DELETE FROM abt_variabel WHERE no_var IN \(4600,/);
  });
  it("literal heksadesimal di PASANG mengembalikan teks variabel.json persis", () => {
    const pasang = readFileSync(path.join(dir, "PASANG.sql"), "latin1");
    for (const v of V) {
      const m = new RegExp(`VALUES \\(${v.no_var}, 0x([0-9a-f]+), 'data_sql', NULL, NULL, NULL, NULL, 0x([0-9a-f]+),`).exec(pasang);
      expect(m, `variabel ${v.no_var}`).toBeTruthy();
      expect(Buffer.from(m![1], "hex").toString("latin1")).toBe(v.nama);
      expect(Buffer.from(m![2], "hex").toString("latin1")).toBe(v.sql_query);
    }
  });
});
