// @vitest-environment node
/**
 * ============================================================================
 * 28 OKT 2026 (KEPUTUSAN KEDUA) - RINCIAN ALASAN CERAI (5227): "DAN", TANPA AKIBAT UMUM, RINCIAN GUGATAN, SAKSI
 * ============================================================================
 *
 * Contoh pengguna dari layar Blangko Derry:
 *   salah : "Tergugat mengonsumsi obat-obatan terlarang sehingga antara Penggugat dan Tergugat terus-menerus terjadi
 *            perselisihan dan pertengkaran serta Tergugat melakukan kekerasan fisik terhadap Penggugat"
 *   benar : "Tergugat mengonsumsi obat-obatan terlarang yaitu jenis sabu-sabu dan Tergugat melakukan kekerasan fisik
 *            terhadap Penggugat"
 *   1. antar-alasan "dan" ("A dan B", "A, B, dan C"), tanpa ";" dan tanpa "serta";
 *   2. akibat UMUM (perselisihan terus-menerus) tidak ditempelkan ke alasan konkret - hanya pilihan bunyi; rantai
 *      sebab-akibat konkret tetap; gugatan yang HANYA menyebut perselisihan tetap memakainya;
 *   3. rincian perbuatan di gugatan ikut ("yaitu jenis sabu-sabu", "dengan cara memukul", nama jenis);
 *   4. keterangan saksi ikut menguatkan: jalur saksi memakai posita SIPP bila posita ABT kosong, sumber kartu menyebut
 *      saksinya, dan Blangko Derry memilih kartu bersaksi itu, bukan bunyi berkas e-Court yang tidak membawa saksi.
 * Kalimat disamarkan (tanpa nama pihak sungguhan).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Apa = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const AKAR = path.resolve(__dirname, "../../..");
const BERKAS_RUTE = path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);
const mesin = require_(path.join(AKAR, "aleta_bot/services/deteksi/alasanRincian.js")) as Apa;
const layanan = require_(path.join(AKAR, "aleta_bot/services/abtUsulanService.js")) as Apa;

const CG = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT = { pelaku: "Termohon", lawan: "Pemohon" };
const rinci = (gugatan: string[], extra: Record<string, unknown> = {}) => mesin.deteksiRincian({ gugatan, pihak: CG, ...extra });
const bawaan = (r: Apa) => mesin.pilihanBunyi(r)[0].nilai as string;
const bas = (...b: string[]) => b.map((x) => `- Bahwa ${x};`).join("\n");

const BENAR = "Tergugat mengonsumsi obat-obatan terlarang yaitu jenis sabu-sabu dan Tergugat melakukan kekerasan fisik terhadap Penggugat";
const GUGATAN_PENGGUNA = [
  "Bahwa Tergugat mengonsumsi obat-obatan terlarang yaitu jenis sabu-sabu sehingga antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran;",
  "Bahwa Tergugat melakukan kekerasan fisik terhadap Penggugat sejak tahun 2024 sehingga antara Penggugat dan Tergugat sering terjadi pertengkaran;",
  "Bahwa puncak perselisihan terjadi pada bulan Mei 2025 dan sejak itu Penggugat dan Tergugat telah berpisah tempat tinggal;",
];
const POSITA_PENGGUNA = GUGATAN_PENGGUNA.join("\n");
const SAKSI1 = bas("saksi mengetahui Tergugat sering mengonsumsi sabu-sabu", "saksi pernah melihat Tergugat memukul Penggugat");
const SAKSI2 = bas("Tergugat memakai narkoba jenis sabu", "Tergugat melakukan kekerasan terhadap Penggugat");

describe("1. antar-alasan 'dan', tanpa ';' dan tanpa 'serta'", () => {
  it("dua alasan 'A dan B', tiga 'A, B, dan C'", () => {
    expect(bawaan(rinci(["Bahwa Tergugat sering mabuk-mabukan.", "Bahwa Tergugat sering bermain judi online."]))).toBe("Tergugat sering mabuk-mabukan dan Tergugat gemar bermain judi online");
    const tiga = bawaan(rinci(["Bahwa Tergugat sering mabuk-mabukan.", "Bahwa Tergugat sering bermain judi online.", "Bahwa Tergugat tidak memberikan nafkah kepada Penggugat."]));
    expect(tiga).toBe("Tergugat sering mabuk-mabukan, Tergugat gemar bermain judi online, dan Tergugat tidak memberikan nafkah kepada Penggugat");
  });

  it("tidak satu pun pilihan bunyi memuat ';' atau 'serta' sebagai penyambung alasan", () => {
    const r = rinci(GUGATAN_PENGGUNA, { saksi: [] });
    for (const p of mesin.pilihanBunyi(r)) expect(p.nilai, p.keadaan).not.toMatch(/;| serta /);
  });
});

describe("2. akibat umum tidak ditempelkan ke alasan konkret", () => {
  it("contoh pengguna: tanpa 'sehingga ... perselisihan' dan tanpa 'hal-hal tersebut mengakibatkan'", () => {
    const r = rinci(GUGATAN_PENGGUNA);
    expect(bawaan(r)).toBe(BENAR);
    expect(r.butir.every((b: Apa) => !b.penutup)).toBe(true);
    for (const p of mesin.pilihanBunyi(r).filter((x: Apa) => x.keadaan !== "sesuai gugatan, dengan perselisihan di akhir")) {
      expect(p.nilai, p.keadaan).not.toMatch(/perselisihan|hal-hal tersebut/);
    }
    // Bentuk lama (perselisihan di akhir) masih PILIHAN, bukan bawaan.
    const akhir = mesin.pilihanBunyi(r).find((x: Apa) => x.keadaan === "sesuai gugatan, dengan perselisihan di akhir");
    expect(akhir.nilai).toBe(`${BENAR} sehingga antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran`);
  });

  it("rantai sebab-akibat KONKRET tetap ('malas bekerja sehingga kurang memberi nafkah')", () => {
    expect(bawaan(rinci(["Bahwa Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat sehingga sering terjadi pertengkaran."]))).toBe(
      "Tergugat malas bekerja sehingga Tergugat kurang memberikan nafkah kepada Penggugat"
    );
  });

  it("akibat bebas yang hanya perselisihan/pertengkaran tidak dikutip", () => {
    expect(bawaan(rinci(["Bahwa Tergugat sering berjudi sehingga Penggugat dan Tergugat selalu ribut setiap hari."]))).toBe("Tergugat gemar bermain judi");
  });

  it("gugatan yang HANYA menyebut perselisihan tetap memakai baris perselisihan", () => {
    const r = rinci(["Bahwa sejak 2024 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran."]);
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0].penutup).toBe(true);
    expect(bawaan(r)).toBe("antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran");
  });
});

describe("3. rincian perbuatan dari gugatan ikut di bunyi bawaan", () => {
  it("'yaitu jenis sabu-sabu' ikut; bunyi baku tanpa rincian tetap jadi pilihan", () => {
    const b = rinci(["Bahwa Tergugat mengonsumsi obat-obatan terlarang yaitu jenis sabu-sabu."]).butir[0];
    expect(b.bunyi[0].nilai).toBe("Tergugat mengonsumsi obat-obatan terlarang yaitu jenis sabu-sabu");
    expect(b.bunyi.map((x: Apa) => x.nilai)).toContain("Tergugat mengonsumsi obat-obatan terlarang");
  });

  it("nama jenis tanpa penanda (sabu-sabu, togel) dan bentuk kekerasan ('dengan cara ...') ikut", () => {
    expect(bawaan(rinci(["Bahwa Tergugat sering memakai sabu-sabu."]))).toBe("Tergugat sering memakai sabu-sabu");
    expect(bawaan(rinci(["Bahwa Tergugat suka bermain togel."]))).toBe("Tergugat suka bermain togel");
    expect(bawaan(rinci(["Bahwa Tergugat melakukan kekerasan fisik terhadap Penggugat dengan cara memukul dan menendang."]))).toBe(
      "Tergugat melakukan kekerasan fisik terhadap Penggugat dengan cara memukul dan menendang"
    );
  });

  it("sebutan pihak dirapikan; pelaku yang tidak tepat di depan perbuatan memakai bunyi baku + rinciannya", () => {
    expect(bawaan(rinci(["bahwa tergugat memakai narkoba jenis ganja terhadap penggugat."]))).toBe("Tergugat memakai narkoba jenis ganja terhadap Penggugat");
    // "kemudian mulai" lebih dari batas kata/penghubung -> bunyi baku + rincian
    expect(bawaan(rinci(["Bahwa Tergugat dan teman-temannya kemudian mulai memakai ganja."]))).toBe("Tergugat mengonsumsi obat-obatan terlarang jenis ganja");
  });

  it("cerai talak: sebutan Termohon/Pemohon, tanpa Tergugat/Penggugat", () => {
    const r = mesin.deteksiRincian({ gugatan: ["Bahwa Termohon sering bermain judi online jenis slot sehingga uang belanja habis."], pihak: CT });
    expect(bawaan(r)).toBe("Termohon sering bermain judi online jenis slot sehingga uang belanja habis");
    expect(bawaan(r)).not.toMatch(/Tergugat|Penggugat/);
  });

  it("tanpa rincian di gugatan: bunyi baku seperti dulu", () => {
    expect(bawaan(rinci(["Bahwa Tergugat melakukan kekerasan fisik terhadap Penggugat."]))).toBe("Tergugat melakukan kekerasan fisik terhadap Penggugat");
    expect(bawaan(rinci(["Bahwa Tergugat sering mabuk-mabukan dan bila mabuk memukul Penggugat."]))).toBe(
      "Tergugat sering mabuk-mabukan dan apabila dalam keadaan demikian Tergugat melakukan kekerasan fisik terhadap Penggugat"
    );
  });
});

describe("4. keterangan saksi ikut menguatkan rincian dari gugatan", () => {
  it("contoh pengguna lewat layanan saksi: keluaran persis, lencana dikuatkan kedua saksi, sumber menyebut saksinya", () => {
    const h = layanan.dariKeteranganSaksi(SAKSI1, SAKSI2, "", CG, POSITA_PENGGUNA, { rincianAlasan: true, saksiPihak: { saksi1: "penggugat", saksi2: "penggugat" } });
    const u = h.usulan.find((x: Apa) => x.kode === "5227");
    expect(u.nilai).toBe(BENAR);
    expect(u.pilihan[0].nilai).toBe(BENAR);
    expect(u.rincian.map((r: Apa) => r.lencana)).toEqual(["dikuatkan kedua saksi Penggugat", "dikuatkan kedua saksi Penggugat"]);
    expect(u.keyakinan).toBe("cukup");
    const saksi = u.sumber.filter((s: Apa) => s.saksi > 0);
    expect(saksi.map((s: Apa) => s.saksi).sort()).toEqual([1, 1, 2, 2]);
    expect(saksi.every((s: Apa) => s.pihak === "Penggugat" && s.kalimat)).toBe(true);
    expect(JSON.stringify(u)).not.toMatch(/aleta/i);
  });

  it("saksi belum diperiksa: lencana jujur menyebutnya; jalur berkas e-Court (tanpa saksi) tidak berkata 'belum diperiksa'", () => {
    expect(rinci(GUGATAN_PENGGUNA).butir[0].lencana).toBe("dari gugatan - saksi belum diperiksa");
    expect(rinci(GUGATAN_PENGGUNA, { saksi: [], saksiTidakDibaca: true }).butir[0].lencana).toBe("dari gugatan - keterangan saksi belum dicocokkan");
  });

  describe("rute /abt/usulan sumber saksi tanpa posita ABT memakai posita SIPP untuk rincian", () => {
    let penanganBot: (body: unknown) => Promise<Apa>;
    const asli: Record<string, Apa> = {};
    beforeAll(() => {
      const isi = readFileSync(BERKAS_RUTE, "utf8");
      const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
      const awal = isi.lastIndexOf("\n// ====", tanda);
      const akhir = isi.indexOf('router.post("/abt/pdf"');
      if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
      const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
      const konteks = vm.createContext({
        require: (p: string) => require_(p),
        abtUsulanService: layanan,
        requireInternalToken: () => undefined,
        router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
        console,
      });
      vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
      penanganBot = async (body) => {
        let json: Apa = null;
        await rute["/abt/usulan"]({ body: JSON.parse(JSON.stringify(body)) }, { status: () => ({ json: (j: Apa) => void (json = j) }), json: (j: Apa) => void (json = j) });
        return json;
      };
      asli.konteks = layanan.konteksPerkaraSaksi;
      asli.kali = 0;
      layanan.konteksPerkaraSaksi = async () => {
        asli.kali += 1;
        return { posita: POSITA_PENGGUNA, petitum: "", tanggalSidang: "2026-10-15", jenisPerkaraId: 347, saksiSisi: { saksi1: "penggugat", saksi2: "penggugat" } };
      };
    });
    afterAll(() => {
      layanan.konteksPerkaraSaksi = asli.konteks;
    });

    it("posita ABT kosong: rincian tetap tersusun dari gugatan dan dicocokkan dengan kedua saksi; konteks dibaca sekali", async () => {
      asli.kali = 0;
      const j = await penanganBot({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", sumber: "saksi", saksi1: SAKSI1, saksi2: SAKSI2, pelaku: "Tergugat", lawan: "Penggugat", posita: "" });
      const u = j.saksi.usulan.find((x: Apa) => x.kode === "5227");
      expect(u.nilai).toBe(BENAR);
      expect(u.rincian.map((r: Apa) => r.lencana)).toEqual(["dikuatkan kedua saksi Penggugat", "dikuatkan kedua saksi Penggugat"]);
      expect(u.sumber.filter((s: Apa) => s.saksi > 0).every((s: Apa) => s.pihak === "Penggugat")).toBe(true);
      expect(asli.kali).toBe(1);
    });
  });

  describe("Blangko Derry / mesin bersama: kartu bersaksi menang atas bunyi berkas e-Court", () => {
    let M: Apa;
    beforeAll(() => {
      new Function(readFileSync(path.join(AKAR, "ekstensi-sipp", "isi-sipp-bersama.js"), "utf8"))();
      M = (globalThis as Apa).AletaIsiSipp;
    });
    const dariSaksi = () =>
      layanan.dariKeteranganSaksi(SAKSI1, SAKSI2, "", CG, POSITA_PENGGUNA, { rincianAlasan: true, saksiPihak: { saksi1: "penggugat", saksi2: "penggugat" } }).usulan.find((x: Apa) => x.kode === "5227");
    // Bentuk usulan 5227 berkas e-Court (isiGugatanService): nilai kosong, bunyi pilihan, ragu, tanpa saksi.
    const dariEcourt = () => {
      const r = mesin.deteksiRincian({ gugatan: GUGATAN_PENGGUNA, saksi: [], saksiTidakDibaca: true, pihak: CG });
      return {
        kode: "5227",
        nilai: "",
        keyakinan: "ragu",
        pilihan: [{ keadaan: "templat hakim - narkoba", nilai: "Tergugat menggunakan narkotika" }, ...mesin.pilihanBunyi(r)],
        rincian: r.butir.map(mesin.ringkasButir),
        sumber: [{ asal: "gugatan-ecourt", kalimat: "Surat gugatan hal. 2 - dalil: narkoba" }],
      };
    };
    const katalog = [{ kode: "5227", nama: "Alasan-Alasan Cerai", jenis: "teks", kosong: true }];

    it("urutan jawaban sumber tidak menentukan: e-Court lebih dulu atau belakangan, yang dipakai kartu bersaksi", () => {
      for (const urutan of [[[dariEcourt()], [dariSaksi()]], [[dariSaksi()], [dariEcourt()]]]) {
        const r = M.rencanakan(M.pilihPerKode(urutan, new Set(["5227"])), katalog, () => "", urutan);
        const info = r.info["5227"];
        expect(info.nilai).toBe(BENAR);
        expect(info.pilihan[0].nilai).toBe(BENAR);
        expect(info.lencana.asal.teks).toBe("dari gugatan, dicocokkan dengan keterangan saksi");
        expect(info.sumber.filter((s: Apa) => /^Saksi/.test(s.label)).map((s: Apa) => s.label)).toEqual(expect.arrayContaining(["Saksi 1 (Penggugat)", "Saksi 2 (Penggugat)"]));
        expect(info.keduaSaksi).toEqual({ sama: true, sebab: "" });
        // bunyi templat hakim berkas e-Court tetap tersedia sebagai pilihan
        expect(info.pilihan.map((p: Apa) => p.nilai)).toContain("Tergugat menggunakan narkotika");
      }
    });

    it("tanpa jalur saksi, kartu e-Court tetap tampil jujur (belum dicocokkan, bukan 'kedua saksi')", () => {
      const r = M.rencanakan(M.pilihPerKode([[dariEcourt()]], new Set(["5227"])), katalog, () => "", [[dariEcourt()]]);
      expect(r.info["5227"].lencana.asal.teks).toBe("dari berkas e-Court");
      expect(r.info["5227"].keduaSaksi.sama).toBe(false);
    });
  });
});
