import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bacaKontakEcourt } from "@/server/modules/aleta-ecourt/kontak-ecourt";

/**
 * ELITIGASI-7139 (17 Okt 2026): variabel ABT #7139# (isian teks Blangko Derry) terisi OTOMATIS.
 *   "1" = e-litigasi penuh (Tergugat / kuasanya punya email atau domisili elektronik, SIPP atau e-Court),
 *   "2" = hybrid (perkara e-Court, Tergugat pernah hadir, tanpa email -> Panitera Sidang yang mengunggah).
 *
 * Yang diuji PERILAKUNYA (blok ELITIGASI-7139 di abt.js dijalankan di jsdom dengan pembantu tiruan; fakta sidang
 * di bot; lapisan Blangko Derry): manual menang, data tak cukup = kosong, hanya angka yang ditulis.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const K: Apa = muat(path.join(AKAR, "aleta_bot/services/kontakEcourtService.js"));

const sumberAbt = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
const irisan = (sumber: string, mulai: string, selesai: string) => {
  const a = sumber.indexOf(mulai);
  if (a < 0) throw new Error(`penanda tidak ditemukan: ${mulai}`);
  return sumber.slice(a, sumber.indexOf(selesai, a));
};
const blokEl7 = irisan(sumberAbt, "/* === ELITIGASI-7139 17 Okt === */", "/* === AKHIR ELITIGASI-7139 === */");
const blokKeadaan = irisan(sumberAbt, 'const NILAI_KOSONG = new Set(', "const ALETA_API_ABT");
const akhirPilih = "  return { tampil, tidakAda, sama, dihitung };\n}\n";
const blokPilih = irisan(sumberAbt, "function soreTerdeteksi(u)", akhirPilih) + akhirPilih;

function pasangEl7(peta: Map<string, { nilai: string }>, fetchPalsu: (url: string) => Promise<Apa>, nomor = "324/Pdt.G/2026/PA.Dgl") {
  const buatElemen = (tag: string, kelas: string, teks?: string) => {
    const el = document.createElement(tag);
    if (kelas) el.className = kelas;
    if (teks !== undefined && teks !== null) el.textContent = teks;
    return el;
  };
  const f = new Function("buatElemen", "barisVariabel", "nomorPerkaraAbt", "fetch", `${blokKeadaan}\n${blokEl7}\nreturn { el7Putuskan, el7CariEmailTergugat, el7Email, el7Ambil7139, el7Baca, el7Gambar, el7DariBlangkoDerry, keadaanNilai };`);
  return f(buatElemen, () => peta, () => nomor, fetchPalsu);
}

/** Sidebar ABT: menu "Blangko Derry" dengan tautan aktif (halaman ini blangko Derry) atau tanpa. */
function pasangSidebar(derryAktif: boolean | "lain") {
  document.body.innerHTML = `<div id="navbar">
    <button class="accordion">Blangko Derry</button><div class="panel"><a href="#a" ${derryAktif === true ? 'class="active"' : ""}>[01] Putusan</a></div>
    <button class="accordion">Putusan</button><div class="panel"><a href="#b" ${derryAktif === "lain" ? 'class="active"' : ""}>Putusan Lama</a></div>
  </div>`;
}

const tanpaFetch = async () => {
  throw new Error("fetch tidak boleh dipanggil");
};
const peta7139 = (nilai = "") => new Map([["7139", { nilai }]]);

// Kontak berbentuk keluaran kontak-pihak / isi-gugatan.kontak (susunKontak + fakta bot).
const orang = (pihakKe: number, jenis: "pihak" | "kuasa", kolom: { sipp?: string; ec?: string; yakin?: string } = {}) => ({
  jenis,
  pihakKe,
  urutan: 1,
  nama: jenis === "kuasa" ? "ANWAR, S.H." : pihakKe === 1 ? "BUDI" : "SITI",
  sipp: { email: kolom.sipp ?? "", telepon: "" },
  usulan: { email: kolom.ec ? { nilai: kolom.ec, keyakinan: kolom.yakin ?? "cukup", terhadapSipp: "kosong", sumber: [{ asal: "teks", label: "e-Court: Jawaban" }] } : null, hp: null },
});
const kontak = (o: Apa = {}) => ({ ada: true, orang: [orang(1, "pihak"), orang(2, "pihak")], domisili: { 1: null, 2: { email: "", milik: "pihak", asal: "" } }, elitigasi: { lewatEcourt: true, tergugatHadir: true, jumlahSidang: 2 }, ...o });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("keputusan #7139# (el7Putuskan)", () => {
  const E = pasangEl7(peta7139(), tanpaFetch);

  it("kosong + email domisili elektronik Tergugat (SIPP atau e-Court) -> 1", () => {
    const sipp = E.el7Putuskan(kontak({ domisili: { 1: null, 2: { email: "siti.a@gmail.com", milik: "pihak", asal: "sipp", keyakinan: "pasti" } } }));
    expect(sipp).toMatchObject({ nilai: "1", sebab: "email", asal: "sipp", keterangan: "E-Litigasi: penuh (Tergugat ber-email)" });
    const ec = E.el7Putuskan(kontak({ orang: [orang(1, "pihak"), orang(2, "pihak", { ec: "Siti.A@Gmail.com", yakin: "cukup" })] }));
    expect(ec).toMatchObject({ nilai: "1", asal: "ecourt", email: "siti.a@gmail.com" });
  });

  it("email kuasa Tergugat juga menghitung; email Penggugat/Pemohon (pihak ke-1) tidak", () => {
    expect(E.el7Putuskan(kontak({ orang: [orang(1, "pihak"), orang(2, "pihak"), orang(2, "kuasa", { ec: "kantor.anwar@gmail.com" })] }))).toMatchObject({ nilai: "1", asal: "ecourt", milik: "kuasa" });
    expect(E.el7Putuskan(kontak({ orang: [orang(1, "pihak", { sipp: "budi@gmail.com" }), orang(1, "kuasa", { ec: "kuasa.p@gmail.com" }), orang(2, "pihak")] }))).toMatchObject({ nilai: "2" });
  });

  it("kosong + tanpa email + perkara e-Court + Tergugat pernah hadir -> 2 (hybrid)", () => {
    const h = E.el7Putuskan(kontak());
    expect(h).toMatchObject({ nilai: "2", sebab: "hadir-tanpa-email", keterangan: "E-Litigasi: hybrid (diunggah Panitera Sidang)" });
    expect(h.email).toBeUndefined();
  });

  it("data tidak cukup -> kosong: verstek, belum disidang, bukan e-Court, bot lama, email ragu, perkara tak ada", () => {
    expect(E.el7Putuskan(kontak({ elitigasi: { lewatEcourt: true, tergugatHadir: false, jumlahSidang: 2 } }))).toBeNull(); // verstek
    expect(E.el7Putuskan(kontak({ elitigasi: { lewatEcourt: true, tergugatHadir: null, jumlahSidang: 0 } }))).toBeNull(); // belum disidang
    expect(E.el7Putuskan(kontak({ elitigasi: { lewatEcourt: false, tergugatHadir: true, jumlahSidang: 1 } }))).toBeNull(); // bukan e-Court
    expect(E.el7Putuskan(kontak({ elitigasi: { lewatEcourt: null, tergugatHadir: true, jumlahSidang: 1 } }))).toBeNull(); // tak terbaca
    expect(E.el7Putuskan(kontak({ elitigasi: undefined }))).toBeNull(); // bot lama: tak pernah "2"
    expect(E.el7Putuskan(kontak({ orang: [orang(1, "pihak"), orang(2, "pihak", { ec: "entah@gmail.com", yakin: "ragu" })] }))).toBeNull(); // pemilik email belum pasti
    expect(E.el7Putuskan({ ada: false, orang: [], domisili: {} })).toBeNull();
    expect(E.el7Putuskan(null)).toBeNull();
  });

  it("18 Okt (keputusan 2): \"1\" HANYA perkara e-Court - ber-email tetapi bukan e-Court / tak terbaca / tanpa fakta -> kosong", () => {
    const dom = { 1: null, 2: { email: "siti.a@gmail.com", milik: "pihak", asal: "sipp", keyakinan: "pasti" } };
    expect(E.el7Putuskan(kontak({ domisili: dom, elitigasi: { lewatEcourt: false, tergugatHadir: true, jumlahSidang: 2 } }))).toBeNull();
    expect(E.el7Putuskan(kontak({ domisili: dom, elitigasi: { lewatEcourt: null, tergugatHadir: null, jumlahSidang: 0 } }))).toBeNull();
    expect(E.el7Putuskan(kontak({ domisili: dom, elitigasi: undefined }))).toBeNull();
    expect(E.el7Putuskan(kontak({ orang: [orang(1, "pihak"), orang(2, "pihak", { sipp: "x@gmail.com" })], elitigasi: { lewatEcourt: false, tergugatHadir: false, jumlahSidang: 0 } }))).toBeNull();
    // perkara e-Court tetap "1", walau Tergugat belum pernah hadir
    expect(E.el7Putuskan(kontak({ domisili: dom, elitigasi: { lewatEcourt: true, tergugatHadir: false, jumlahSidang: 0 } }))).toMatchObject({ nilai: "1" });
  });

  it("email sampah SIPP ('-', '0', '...') dan surel instansi pengadilan bukan email Tergugat", () => {
    for (const x of ["-", "0", "...", "", "bukan email", "info@pa-donggala.go.id", "noreply@mahkamahagung.go.id"]) expect(E.el7Email(x)).toBe("");
    expect(E.el7Email(" Siti.A@Gmail.com, ")).toBe("siti.a@gmail.com");
    const h = E.el7Putuskan(kontak({ orang: [orang(1, "pihak"), orang(2, "pihak", { sipp: "-" })] }));
    expect(h).toMatchObject({ nilai: "2" });
  });

  it("nilai yang ditulis hanya '1'/'2' - tidak ada kata aleta di nilai, nama, keterangan, atau kartu usulan", async () => {
    pasangSidebar(true);
    for (const k of [
      kontak({ domisili: { 1: null, 2: { email: "siti.a@gmail.com", milik: "pihak", asal: "akun", keyakinan: "cukup" } } }),
      kontak(),
    ]) {
      const data: Apa = { gugatan: { kontak: k } };
      await pasangEl7(peta7139(), tanpaFetch).el7Baca(data);
      expect(data.elitigasi.usulan).toHaveLength(1);
      expect(data.elitigasi.usulan[0].nilai).toMatch(/^[12]$/);
      expect(JSON.stringify(data.elitigasi)).not.toMatch(/aleta/i);
    }
  });
});

describe("panel ABT: el7Baca (Blangko Derry, manual menang)", () => {
  const kontak1 = kontak({ domisili: { 1: null, 2: { email: "siti.a@gmail.com", milik: "pihak", asal: "akun", keyakinan: "cukup" } } });

  it("7139 kosong di Blangko Derry -> usulan tercentang sendiri (awal) berisi hanya angka, lengkap dengan keterangan sederhana", async () => {
    pasangSidebar(true);
    for (const awal of ["", "...", "DATA_TIDAK_ADA"]) {
      const data: Apa = { gugatan: { kontak: kontak1 } };
      await pasangEl7(peta7139(awal), tanpaFetch).el7Baca(data);
      expect(data.elitigasi.usulan).toEqual([
        { kode: "7139", nama: "Beracara secara elektronik (e-litigasi)", nilai: "1", keyakinan: "cukup", awal: true, sumber: [{ asal: "elitigasi", kalimat: "E-Litigasi: penuh (Tergugat ber-email)" }] },
      ]);
    }
    const hybrid: Apa = { gugatan: { kontak: kontak() } };
    const E = pasangEl7(peta7139(), tanpaFetch);
    await E.el7Baca(hybrid);
    expect(hybrid.elitigasi.usulan[0]).toMatchObject({ nilai: "2" });
    const wadah = document.createElement("div");
    E.el7Gambar(wadah, hybrid, false);
    expect(wadah.textContent).toBe("E-Litigasi: hybrid (diunggah Panitera Sidang)");
    const dengankartu = document.createElement("div");
    E.el7Gambar(dengankartu, hybrid, true);
    expect(dengankartu.children).toHaveLength(0); // kartu 7139 sudah memuat keterangannya
  });

  it("isian manual yang sudah ada TIDAK ditimpa dan tidak memicu satu pun bacaan", async () => {
    pasangSidebar(true);
    for (const manual of ["2", "1", "sepakat"]) {
      const data: Apa = { gugatan: { kontak: kontak1 } };
      await pasangEl7(peta7139(manual), tanpaFetch).el7Baca(data); // fetch yang dipanggil akan melempar -> bacaan tidak boleh terjadi
      expect(data.elitigasi).toBeUndefined();
    }
  });

  it("data tidak cukup -> kosong; bukan Blangko Derry / tanpa variabel 7139 -> diam", async () => {
    pasangSidebar(true);
    const verstek: Apa = { gugatan: { kontak: kontak({ elitigasi: { lewatEcourt: true, tergugatHadir: false, jumlahSidang: 1 } }) } };
    await pasangEl7(peta7139(), async () => ({ ok: false, status: 404 })).el7Baca(verstek);
    expect(verstek.elitigasi).toBeUndefined();

    pasangSidebar("lain"); // halaman blangko ABT biasa, bukan Derry
    const biasa: Apa = { gugatan: { kontak: kontak1 } };
    await pasangEl7(peta7139(), tanpaFetch).el7Baca(biasa);
    expect(biasa.elitigasi).toBeUndefined();

    pasangSidebar(true);
    const tanpa: Apa = { gugatan: { kontak: kontak1 } };
    await pasangEl7(new Map([["0046", { nilai: "Penggugat" }]]), tanpaFetch).el7Baca(tanpa);
    expect(tanpa.elitigasi).toBeUndefined();
  });

  it("tanpa kontak dari bacaan gugatan -> kontak-pihak dibaca (teks=1) dan diputuskan; rute 404/galat -> kosong", async () => {
    pasangSidebar(true);
    const diminta: string[] = [];
    const data: Apa = { gugatan: { kontak: null } };
    await pasangEl7(peta7139(), async (url) => {
      diminta.push(url);
      return { ok: true, status: 200, json: async () => ({ data: kontak() }) };
    }).el7Baca(data);
    expect(diminta).toHaveLength(1);
    expect(diminta[0]).toContain("/aleta/api/aleta-ecourt/kontak-pihak?nomor=324%2FPdt.G%2F2026%2FPA.Dgl");
    expect(diminta[0]).toContain("teks=1");
    expect(data.elitigasi.usulan[0].nilai).toBe("2");

    for (const f of [async () => ({ ok: false, status: 404 }), async () => { throw new Error("jaringan"); }]) {
      const d: Apa = {};
      await pasangEl7(peta7139(), f as Apa).el7Baca(d);
      expect(d.elitigasi).toBeUndefined();
    }
  });

  it("kontak dari gugatan sudah cukup ber-email -> tanpa bacaan kedua; tanpa fakta dari bot -> dibaca kontak-pihak", async () => {
    pasangSidebar(true);
    const data: Apa = { gugatan: { kontak: kontak1 } };
    await pasangEl7(peta7139(), tanpaFetch).el7Baca(data);
    expect(data.elitigasi.usulan[0].nilai).toBe("1");
    const bacaan: string[] = [];
    const tanpaFakta: Apa = { gugatan: { kontak: kontak({ elitigasi: undefined }) } };
    await pasangEl7(peta7139(), async (u) => {
      bacaan.push(u);
      return { ok: true, status: 200, json: async () => ({ data: kontak() }) };
    }).el7Baca(tanpaFakta);
    expect(bacaan).toHaveLength(1);
    expect(tanpaFakta.elitigasi.usulan[0].nilai).toBe("2");
  });
});

describe("panel ABT: usulan 7139 masuk daftar satu pintu (sorePilihUsulan)", () => {
  function pasangPilih(peta: Map<string, { nilai: string }>) {
    const f = new Function("barisVariabel", "a3BolehDiisi", "t6Baku", "SORE_PANGKAT_YAKIN", `${blokPilih}\nreturn { sorePilihUsulan };`);
    return f(() => peta, () => true, (x: string) => String(x).trim(), { pasti: 3, cukup: 2, ragu: 1 });
  }
  const usulan = { kode: "7139", nama: "Beracara secara elektronik (e-litigasi)", nilai: "1", keyakinan: "cukup", awal: true, sumber: [{ asal: "elitigasi", kalimat: "E-Litigasi: penuh (Tergugat ber-email)" }] };

  it("variabel kosong -> tampil sebagai kartu; sudah berisi sama -> 'sama'; isi lain (manual) -> kartu itu tidak pernah dibuat el7Baca", () => {
    const kosong = pasangPilih(peta7139()).sorePilihUsulan({ elitigasi: { usulan: [usulan] } });
    expect(kosong.tampil.map((u: Apa) => u.kode)).toEqual(["7139"]);
    const sama = pasangPilih(peta7139("1")).sorePilihUsulan({ elitigasi: { usulan: [usulan] } });
    expect(sama.tampil).toHaveLength(0);
    expect(sama.sama).toEqual(["7139"]);
  });

  it("kabel: bacaan memanggil el7Baca sesudah bacaan e-Court, keterangan digambar, kartu bernada 'dari data pihak'", () => {
    expect(sumberAbt).toMatch(/await Promise\.all\(tugas\);\n[^\n]*\n\s*if \(typeof el7Baca === "function"\) await el7Baca\(data\);/);
    expect(sumberAbt).toContain("data.gugatan, data.elitigasi]");
    expect(sumberAbt).toContain('el7Gambar(w.usulan, data, tampil.some((u) => String(u.kode) === "7139"))');
    expect(sumberAbt).toContain('{ kelas: "aleta-tanda-hijau", teks: "dari data pihak" }');
  });
});

describe("lapisan Blangko Derry (blangko-derry-isian.js): isiElitigasiOtomatis", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");
  const fungsi = irisan(sumber, "async function isiElitigasiOtomatis(d)", "// F4.2: saran draf H-7 (agen ALETA) didahulukan");

  function jalankan(opsi: { isi?: string; nilai?: Apa; bisaTulis?: boolean; keputusan?: Apa | null; sebelumSelesai?: (S: Apa) => void; adaIsian?: boolean; tanpaMesin?: boolean }) {
    const S: Apa = { pk: { nomorPerkara: "324/Pdt.G/2026/PA.Dgl" }, isi: opsi.isi !== undefined ? { "7139": opsi.isi } : {}, nilai: opsi.nilai || {}, susunan: null, el7: null };
    const d = { isian: opsi.adaIsian === false ? [{ kode: "0222" }] : [{ kode: "7139" }, { kode: "0222" }] };
    S.susunan = d;
    const tersimpan: Apa[] = [];
    let digambar = 0;
    const el7Ambil7139 = async (nomor: string, k: unknown) => {
      expect(nomor).toBe("324/Pdt.G/2026/PA.Dgl");
      expect(k).toBeNull();
      if (opsi.sebelumSelesai) opsi.sebelumSelesai(S);
      return opsi.keputusan === undefined ? { nilai: "1", keterangan: "E-Litigasi: penuh (Tergugat ber-email)" } : opsi.keputusan;
    };
    const f = new Function("S", "bolehTulis", "nomorPerkara", "jadwalkanSimpan", "renderIsian", "el7Ambil7139x", `${opsi.tanpaMesin ? "var el7Ambil7139;" : "const el7Ambil7139 = el7Ambil7139x;"}\n${fungsi}\nreturn isiElitigasiOtomatis;`);
    const isi = f(
      S,
      () => opsi.bisaTulis !== false,
      () => S.pk.nomorPerkara,
      async (kode: string, nilai: string, segera: boolean) => {
        S.isi[kode] = nilai;
        tersimpan.push({ kode, nilai, segera });
        return true;
      },
      () => {
        digambar += 1;
      },
      el7Ambil7139
    );
    return { S, d, tersimpan, isi: () => isi(d), digambar: () => digambar };
  }

  it("kosong + keputusan -> disimpan segera ke ABT sebagai angka saja, keterangan tampil di kotaknya", async () => {
    const j = jalankan({});
    await j.isi();
    expect(j.tersimpan).toEqual([{ kode: "7139", nilai: "1", segera: true }]);
    expect(j.S.el7.keterangan).toBe("E-Litigasi: penuh (Tergugat ber-email)");
    expect(j.digambar()).toBe(1);
    expect(sumber).toContain('b.kode === "7139" && S.el7 && v === S.el7.nilai');
    expect(JSON.stringify(j.tersimpan)).not.toMatch(/aleta/i);
  });

  it("manual menang: sudah terisi di ABT, sudah ada di layar, atau diketik selagi menunggu bacaan -> tidak ditulis", async () => {
    for (const j of [
      jalankan({ nilai: { "7139": { status: "terisi", teks: "2" } } }),
      jalankan({ isi: "2" }),
      jalankan({ sebelumSelesai: (S) => (S.isi["7139"] = "2") }),
    ]) {
      await j.isi();
      expect(j.tersimpan).toEqual([]);
    }
  });

  it("data tak cukup (keputusan kosong), tanpa hak tulis, tanpa isian 7139, atau mesin abt.js belum ada -> tidak ada tulisan", async () => {
    for (const j of [jalankan({ keputusan: null }), jalankan({ bisaTulis: false }), jalankan({ adaIsian: false }), jalankan({ tanpaMesin: true })]) {
      await j.isi();
      expect(j.tersimpan).toEqual([]);
      expect(j.S.el7).toBeNull();
    }
  });

  it("dipasang sesudah isian dimuat dan keadaannya dibersihkan saat perkara berganti", () => {
    expect(sumber).toContain("void muatSaranAbt(d);\n      void simpanBawaanAbtItsbat(d);\n      void isiElitigasiOtomatis(d);");
    expect(sumber.match(/S\.el7 = null;/g)!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("bot & portal: fakta untuk #7139#", () => {
  it("tergugatHadirDariSidang: sandi dihadiri_oleh menurut borang SIPP; kosong/belum tercatat = tidak diketahui (bukan verstek)", () => {
    const h = (...k: unknown[]) => K.tergugatHadirDariSidang(k.map((dihadiri) => ({ dihadiri })));
    expect(h(1)).toEqual({ tergugatHadir: true, jumlahSidang: 1 }); // semua pihak
    expect(h(2, 3)).toMatchObject({ tergugatHadir: true }); // pihak kedua saja pada sidang ke-2
    expect(h("9", 4)).toMatchObject({ tergugatHadir: true });
    expect(h(2, 2)).toEqual({ tergugatHadir: false, jumlahSidang: 2 }); // hanya Penggugat hadir: verstek
    expect(h(4)).toMatchObject({ tergugatHadir: false }); // para pihak tidak hadir
    expect(h(14, 13, 10, 5)).toMatchObject({ tergugatHadir: false }); // turut tergugat / intervensi / sebagian penggugat bukan Tergugat
    expect(h(null, "", 0, undefined)).toEqual({ tergugatHadir: null, jumlahSidang: 0 });
    expect(K.tergugatHadirDariSidang(undefined)).toEqual({ tergugatHadir: null, jumlahSidang: 0 });
    expect(K.tergugatHadirDariSidang([{ dihadiri_oleh: "1" }])).toMatchObject({ tergugatHadir: true });
  });

  it("portal kontak-pihak meneruskan `elitigasi` dari bot; bot lama -> null", async () => {
    const deps = {
      rincian: async () => ({ ok: false, dokumen: [] }),
      ambilBerkas: async () => null,
      halamanPdf: async () => [],
      bacaTeks: async () => ({ teks: "", sumber: "teks" as const, sebab: "" }),
    };
    const fakta = { lewatEcourt: true, tergugatHadir: true, jumlahSidang: 2 };
    const baru = await bacaKontakEcourt({ nomor: "324/Pdt.G/2026/PA.Dgl" }, { ...deps, kirimBot: async () => ({ ok: true, ada: true, orang: [], domisili: {}, tanpaPemilik: [], elitigasi: fakta }) });
    expect(baru.elitigasi).toEqual(fakta);
    const lama = await bacaKontakEcourt({ nomor: "324/Pdt.G/2026/PA.Dgl" }, { ...deps, kirimBot: async () => ({ ok: true, ada: true, orang: [] }) });
    expect(lama.elitigasi).toBeNull();
  });

  it("kontakPerkara memuat fakta (kabel) dan lajur SIPP KONTAK-EC tidak diubah", () => {
    const bot = readFileSync(path.join(AKAR, "aleta_bot/services/kontakEcourtService.js"), "utf8");
    expect(bot).toMatch(/const elitigasi = await faktaElitigasi\(perkara\)[^\n]*\n\s*return \{ ok: true, ada: true,[^\n]*tersimpan, elitigasi, \.\.\.susun \}/);
    expect(bot).toContain("SELECT dihadiri_oleh AS dihadiri FROM perkara_jadwal_sidang");
  });
});
