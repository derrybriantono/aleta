// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 14 Okt 2026 (agen T2, keputusan pengguna butir 3): 1021/5015/5016/5032 dulu katalog TANPA data_type - tidak dapat
 * diisi siapa pun. Paket ABT abt-hb-kebendaan menjadikannya isian teks; ALETA mendeteksi isinya dan mengusulkannya
 * lewat "Isi dari SIPP & input ke ABT" (tetap dapat disunting di ABT).
 *
 *   1021/5015/5016 - blangko itsbat [99aa] Cerai Hidup/Mati Pasangan Sebelumnya: istri SEBELUMNYA Pemohon I, dari
 *                    kurung butir status posita ("Pemohon I berstatus Duda (isteri sebelumnya bernama X telah
 *                    meninggal dunia pada ...)") atau dari SIPP lewat nomor akta cerai PA.Dgl yang disebut posita.
 *   5032           - blangko "4a Harta Bersama/[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan" (dulu 4 Kebendaan/[00]): benda harta bersama yang didalilkan, satu kalimat.
 *
 * Nama dalam contoh posita disamarkan; bentuk kalimatnya dari posita itsbat/HB server.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const itsbat = require_(path.join(AKAR, "aleta_bot/services/deteksi/itsbat.js"));
const sambung = require_(path.join(AKAR, "aleta_bot/services/deteksi/sambungItsbatPasangan.js"));
const hb = require_(path.join(AKAR, "aleta_bot/services/deteksi/hartaBersama.js"));
const usulanSvc = require_(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));

const kal = (posita: string): string[] => usulanSvc.kalimatPosita(posita);

const DUDA_MATI_NAMA =
  "<p>1. Bahwa pada tanggal 10 Januari 2015 Pemohon I dan Pemohon II melangsungkan pernikahan di Desa Kabobona.</p>" +
  "<p>2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda Mati (isteri sebelumnya atas nama Sitti Aminah telah meninggal pada " +
  "05 Juli 2013 sesuai dengan Kutipan Akta Kematian Nomor : 7210-KM-06082025-0005 tanggal 06 Agustus 2025 yang dikeluarkan oleh Dinas " +
  "Kependudukan dan Pencatatan Sipil Kabupaten Sigi) dalam usia 59 tahun, dan Pemohon II berstatus Janda Mati (suami sebelumnya atas nama " +
  "Rahman Lamasi telah meninggal pada 02 Maret 2014) dalam usia 50 tahun, pernikahan dilangsungkan dengan wali nikah ayah kandung;</p>";
const DUDA_MATI_TANPA_NAMA =
  "<p>2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda dalam usia 41 tahun (Isteri sebelumnya telah meninggal dunia pada " +
  "26 Mei 2021 karena sakit sesuai Surat Keterangan Kematian Nomor: 31/SKK/KD-E/X/2023 tertanggal 18 Oktober 2023), dan Pemohon II " +
  "berstatus Perawan dalam usia 16 tahun;</p>";
const ISTRI_PEMOHON_I =
  "<p>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda ( Isteri Pemohon I bernama Nur Hayati meninggal dunia pada tanggal " +
  "29 April 2022 sesuai Kutipan Akta Kematian) dalam usia 62 tahun, dan Pemohon II berstatus Janda (Suami Pemohon II bernama Firman " +
  "telah meninggal dunia pada bulan Desember 2022);</p>";
const DUDA_CERAI_AKTA =
  "<p>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda ( dibuktikan dengan akta cerai nomor : 344/AC/2019/PA.Dgl ) dalam " +
  "usia 54 tahun, dan Pemohon II berstatus Janda ( dibuktikan dengan akta cerai nomor : 395/AC/2019/PA.Dgl ) dalam usia 47 tahun;</p>";
const TANPA_RINCIAN = "<p>Bahwa pada saat pernikahan tersebut, Pemohon I berstatus duda (istri pertama meninggal dunia), usia 20 tahun dan Pemohon II berstatus janda;</p>";
const KONTENTIUS =
  "<p>Bahwa Pemohon berstatus Janda ketika menikah dengan Ahmad Saleh bin Laupe;</p>" +
  "<p>Bahwa Ahmad Saleh bin Laupe telah meninggal lebih dulu karena sakit pada tanggal 13 Maret 2020 sesuai dengan Kutipan Akta Kematian.</p>";

describe("1021/5015/5016 - istri sebelumnya Pemohon I dari posita", () => {
  it("duda mati bernama: nama, tanggal; bagian Pemohon II (suami sebelumnya) tidak dibaca", () => {
    const d = itsbat.istriSebelumnyaP1(kal(DUDA_MATI_NAMA));
    expect(d).toMatchObject({ jenis: "mati", nama: "Sitti Aminah", tanggal: "05 Juli 2013" });
    const h = itsbat.deteksi(DUDA_MATI_NAMA, {});
    expect(h["1021"].nilai).toBe("Sitti Aminah");
    expect(h["5015"].nilai).toBe("05 Juli 2013");
    const nilai = Object.values(h).map((x) => (x as { nilai: string }).nilai);
    expect(nilai.some((x) => /Rahman Lamasi|02 Maret 2014/.test(x))).toBe(false);
  });

  it("tanpa nama: tanggal & sebab saja; tanggal akta (tertanggal 18 Oktober 2023) bukan tanggal meninggal", () => {
    const h = itsbat.deteksi(DUDA_MATI_TANPA_NAMA, {});
    expect(h["1021"]).toBeUndefined();
    expect(h["5015"].nilai).toBe("26 Mei 2021");
    expect(h["5016"].nilai).toBe("sakit");
  });

  it('"Isteri Pemohon I bernama X meninggal dunia" terbaca; Firman (suami Pemohon II) tidak', () => {
    const h = itsbat.deteksi(ISTRI_PEMOHON_I, {});
    expect(h["1021"].nilai).toBe("Nur Hayati");
    expect(h["5015"].nilai).toBe("29 April 2022");
  });

  it("posita tanpa nama/tanggal lengkap dan itsbat kontentius: tidak ada usulan (tidak ditebak)", () => {
    for (const p of [TANPA_RINCIAN, KONTENTIUS]) {
      const h = itsbat.deteksi(p, {});
      for (const k of ["1021", "5015", "5016"]) expect(h[k]).toBeUndefined();
    }
  });

  it("keyakinan menurut ukuran: 5015 (10/10) cukup, 1021 (5/5, n<10) dan 5016 (belum pernah tertulis) ragu", () => {
    expect(itsbat.UKUR_ISTRI_SEBELUMNYA["5015"]).toMatchObject({ n: 10, tepat: 10 });
    const h = itsbat.deteksi(DUDA_MATI_TANPA_NAMA, {});
    expect(h["5015"].yakin).toBe("cukup");
    expect(h["5016"].yakin).toBe("ragu");
    expect(itsbat.deteksi(DUDA_MATI_NAMA, {})["1021"].yakin).toBe("ragu");
  });

  it("nomor akta cerai di bagian Pemohon I dibaca (bukan milik Pemohon II)", () => {
    const d = itsbat.istriSebelumnyaP1(kal(DUDA_CERAI_AKTA));
    expect(d.jenis).toBe("cerai");
    expect(d.aktaCerai).toMatchObject({ urut: 344, tahun: 2019, kodePa: "Dgl" });
  });
});

describe("1021 dari SIPP lewat nomor akta cerai PA.Dgl", () => {
  const dasar = { ok: true, usulan: [{ kode: "5197", nilai: "10 Januari 2015", keyakinan: "cukup" }] };

  it("cerai talak: suami (pihak 1) = Pemohon I -> istri (pihak 2) diusulkan cukup (mekanisme 12/12)", async () => {
    const h = await sambung.lengkapiIstriSebelumnya(dasar, {
      posita: DUDA_CERAI_AKTA,
      nomorPerkara: "98/Pdt.P/2024/PA.Dgl",
      bacaAkta: async () => ({ jenisPerkaraId: 346, nomorAkta: "344/AC/2019/PA.Dgl", pihak1: ["Nasir bin Saleh"], pihak2: ["Irma binti Hasan"], pemohon: ["Nasir bin Saleh", "Masna binti Joha"] }),
    });
    const u = h.usulan.find((x: { kode: string }) => x.kode === "1021");
    expect(u).toMatchObject({ nilai: "Irma binti Hasan", keyakinan: "cukup" });
    expect(u.sumber[0].asal).toBe("sipp");
    expect(h.usulan.find((x: { kode: string }) => x.kode === "5197")).toBeTruthy();
    expect(dasar.usulan).toHaveLength(1); // masukan tidak diubah
  });

  it("pihak suami bukan Pemohon I -> tidak diusulkan; istri = Pemohon II -> ragu", async () => {
    const bukan = await sambung.lengkapiIstriSebelumnya(dasar, {
      posita: DUDA_CERAI_AKTA,
      bacaAkta: async () => ({ jenisPerkaraId: 346, nomorAkta: "x", pihak1: ["Orang Lain bin Fulan"], pihak2: ["Irma binti Hasan"], pemohon: ["Nasir bin Saleh"] }),
    });
    expect(bukan.usulan.some((x: { kode: string }) => x.kode === "1021")).toBe(false);
    const rujuk = await sambung.lengkapiIstriSebelumnya(dasar, {
      posita: DUDA_CERAI_AKTA,
      bacaAkta: async () => ({ jenisPerkaraId: 347, nomorAkta: "x", pihak1: ["Ilmi binti Arif"], pihak2: ["Suardi bin Nurdin"], pemohon: ["Suardi bin Nurdin", "Ilmi binti Arif D alias Arif"] }),
    });
    expect(rujuk.usulan.find((x: { kode: string }) => x.kode === "1021").keyakinan).toBe("ragu");
  });

  it("nama longgar: gelar, alias, ejaan akhiran; nama berbeda tidak disamakan", () => {
    expect(sambung.namaSama("Hj.Nurhayati binti Tommeng", "Nurhayati binti Tommeng")).toBe(true);
    expect(sambung.namaSama("Suarti Binti Nati", "Yustin alias Suartin binti Nati")).toBe(true);
    expect(sambung.namaSama("OKTAFIANA.R.IROT BINTI RUSTAM", "Oktafiana. R Iroth binti Rustam")).toBe(true);
    expect(sambung.namaSama("Ahmad bin Ramli", "Ahmadi bin Ramli")).toBe(false);
    expect(sambung.namaSama("Nasir bin Saleh", "Irma binti Hasan")).toBe(false);
  });

  it("bacaAktaCerai: hanya SELECT, nomor dibaca dari teks akta (nomor_urut tahun lama tidak dipakai), selain PA.Dgl tidak dibaca", async () => {
    const kueri: string[] = [];
    const palsu = async (sql: string) => {
      kueri.push(sql);
      if (/perkara_akta_cerai/.test(sql))
        return [
          { perkara_id: 1, nomor_akta_cerai: "102/AC/2019/PA.Dgl", jenis_perkara_id: 346 },
          { perkara_id: 2, nomor_akta_cerai: "0344/AC/2019/PA.Dgl", jenis_perkara_id: 346 },
        ];
      if (/perkara_pihak1 WHERE perkara_id/.test(sql)) return [{ nama: "Nasir bin Saleh" }];
      if (/perkara_pihak2/.test(sql)) return [{ nama: "Irma binti Hasan" }];
      return [{ nama: "Nasir bin Saleh" }];
    };
    const s = await sambung.bacaAktaCerai("98/Pdt.P/2024/PA.Dgl", { urut: 344, tahun: 2019, kodePa: "Dgl" }, palsu);
    expect(s).toMatchObject({ jenisPerkaraId: 346, nomorAkta: "0344/AC/2019/PA.Dgl", pihak2: ["Irma binti Hasan"] });
    expect(kueri.every((q) => /^\s*SELECT\b/i.test(q))).toBe(true);
    expect(await sambung.bacaAktaCerai("x", { urut: 1, tahun: 2021, kodePa: "Pal" }, palsu)).toBeNull();
  });

  it("rute itsbat menyambungkan lengkapiIstriSebelumnya sesudah blok kontentius", () => {
    const rute = readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    const a = rute.indexOf("=== AKHIR ITSBAT KONTENTIUS ===");
    const b = rute.indexOf('require("../services/deteksi/sambungItsbatPasangan").lengkapiIstriSebelumnya');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});

describe("5032 - harta bersama satu kalimat (HB Kabul)", () => {
  const POSITA =
    "<p>3. Bahwa selama masa perkawinan antara Penggugat dan Tergugat, telah diperoleh harta kekayaan bersama, yaitu berupa :</p>" +
    "<p>- 1 (satu) unit kendaraan Mobil Pick Up warna Hitam Nomor Polisi DN 8048 MA atas nama Tergugat;</p>" +
    "<p>- 1 (satu) unit kendaraan Sepeda Motor Merek Yamaha warna Merah Nomor Polisi DN 3625 MP atas nama Penggugat;---------</p>" +
    "<p>4. Bahwa harta bersama tersebut belum pernah dibagi;</p>";

  it('"telah diperoleh harta kekayaan bersama, yaitu berupa :" terbaca; 5032 = "A; dan B" tanpa garis ekor; ragu', () => {
    const h = hb.deteksi(POSITA, {});
    expect(h["5032"].nilai).toBe(
      "1 (satu) unit kendaraan Mobil Pick Up warna Hitam Nomor Polisi DN 8048 MA atas nama Tergugat; dan " +
        "1 (satu) unit kendaraan Sepeda Motor Merek Yamaha warna Merah Nomor Polisi DN 3625 MP atas nama Penggugat"
    );
    expect(h["5032"].yakin).toBe("ragu");
    expect(h["8730"].nilai).toContain("2.1 1 (satu) unit kendaraan Mobil Pick Up");
  });

  it("satuKalimat: satu benda apa adanya, tiga benda dengan 'dan'", () => {
    expect(hb.satuKalimat(["Sebidang tanah;"])).toBe("Sebidang tanah");
    expect(hb.satuKalimat(["A", "B,", "C."])).toBe("A; B; dan C");
  });

  it("variabel modul memuat 5032 (cermin PWH_VARIABEL_JENIS ekstensi dijaga deteksi-poligami-waris-hb)", () => {
    expect(hb.variabel.map((v: { kode: string }) => v.kode)).toContain("5032");
  });
});
