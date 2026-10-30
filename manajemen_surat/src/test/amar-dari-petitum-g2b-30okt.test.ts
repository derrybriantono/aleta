// @vitest-environment node
/**
 * G2B 2.5 (30 Okt 2026): usulan amar dari petitum menurut status (lib/amar-dari-petitum.ts) dan pengisi kolom Amar borang Putusan Akhir
 * SIPP (ekstensi amar-petitum-sipp.js, dijalankan sungguhan di jsdom dengan jembatan CKEditor tiruan).
 * Ukuran atas amar SIPP sungguhan (sipp_2810, putus 2025-2026, 1.794 amar; skrip D:/aleta-dev/kerja/ukur-g2b/zz-ukur-amar.test.ts):
 * cerai gugat kabul verstek 771/826 amar sama butir demi butir, cerai talak kabul verstek 126/140, CG gugur 7/7, CG digugurkan 12/13,
 * CG NO 15/19, CT digugurkan 5/5.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { butirPetitum, susunAmar, type MasukanAmar } from "@/lib/amar-dari-petitum";

const CG: MasukanAmar = {
  jenisPerkara: "Cerai Gugat",
  nomorPerkara: "430/Pdt.G/2026/PA.Dgl",
  alurPerkaraId: 15,
  jenisPerkaraId: 347,
  status: "Dikabulkan",
  petitum: "<ol><li>Mengabulkan gugatan Penggugat;</li><li>Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;</li><li>Membebankan biaya perkara sesuai hukum;</li></ol><p>Subsider: Mohon putusan yang seadil-adilnya.</p>",
  namaPihak1: ["Nurlinda binti Agus"],
  namaPihak2: ["Ical bin Tahir Rodo"],
  satker: "Donggala",
  biaya: 199000,
};

describe("susunAmar - bentuk amar SIPP menurut status", () => {
  it("cerai gugat kabul verstek: empat butir persis bentuk amar SIPP PA Donggala", () => {
    const h = susunAmar({ ...CG, verstek: true });
    expect(h.butir).toEqual([
      "Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;",
      "Mengabulkan gugatan Penggugat secara verstek;",
      "Menjatuhkan talak satu ba'in shughra Tergugat (Ical bin Tahir Rodo) terhadap Penggugat (Nurlinda binti Agus);",
      "Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp199.000,00 (seratus sembilan puluh sembilan ribu rupiah).",
    ]);
    expect(h.html.startsWith("<ol><li>")).toBe(true);
    expect(h.html).not.toMatch(/aleta/i);
  });

  it("prodeo: 'Membebankan biaya perkara kepada DIPA Pengadilan Agama <satker> Tahun <tahun daftar>', tanpa 'sejumlah'", () => {
    const h = susunAmar({ ...CG, prodeo: true, nomorPerkara: "675/Pdt.G/2026/PA.Dgl" });
    expect(h.butir[h.butir.length - 1]).toBe("Membebankan biaya perkara kepada DIPA Pengadilan Agama Donggala Tahun 2026.");
    expect(h.butir.join(" ")).not.toMatch(/sejumlah|negara, melalui/);
  });

  it("cerai talak kabul: izin ikrar talak raj'i di depan sidang Pengadilan Agama satker, biaya kepada Pemohon", () => {
    const h = susunAmar({ ...CG, jenisPerkara: "Cerai Talak", jenisPerkaraId: 346, namaPihak1: ["Moh Abdul bin Rizal"], namaPihak2: ["Isti binti Haludin"], petitum: "" });
    expect(h.butir).toEqual([
      "Mengabulkan permohonan Pemohon;",
      "Memberi izin kepada Pemohon (Moh Abdul bin Rizal) untuk menjatuhkan talak satu raj'i terhadap Termohon (Isti binti Haludin) di depan sidang Pengadilan Agama Donggala;",
      "Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp199.000,00 (seratus sembilan puluh sembilan ribu rupiah).",
    ]);
  });

  it("kumulasi: butir petitum lain (hak asuh, nafkah anak) ikut dalam bentuk amar; subsider dan 'biaya sesuai hukum' tidak", () => {
    const h = susunAmar({
      ...CG,
      petitum:
        "PRIMAIR:<br>1. Mengabulkan gugatan Penggugat;<br>2. Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;<br>3. Menetapkan anak bernama Aisyah binti Ical berada di bawah hadhanah Penggugat;<br>4. Menghukum Tergugat membayar nafkah anak sejumlah Rp1.000.000,00 setiap bulan;<br>5. Membebankan biaya perkara menurut hukum;<br>SUBSIDAIR:<br>Mohon putusan yang seadil-adilnya.",
    });
    expect(h.butir[2]).toBe("Menetapkan anak bernama Aisyah binti Ical berada di bawah hadhanah Penggugat;");
    expect(h.butir[3]).toBe("Menghukum Tergugat membayar nafkah anak sejumlah Rp1.000.000,00 setiap bulan;");
    expect(h.butir.join(" ")).not.toMatch(/seadil|menurut hukum/);
    expect(h.catatan.join(" ")).toMatch(/DITUNTUT/);
  });

  it("tolak, NO, gugur, cabut: satu butir pokok + biaya kepada Penggugat", () => {
    expect(susunAmar({ ...CG, status: "Ditolak" }).butir[0]).toBe("Menolak gugatan Penggugat;");
    expect(susunAmar({ ...CG, status: "Tidak Dapat Diterima" }).butir[0]).toBe("Menyatakan gugatan Penggugat tidak dapat diterima (niet ontvankelijke verklaard);");
    expect(susunAmar({ ...CG, status: "Digugurkan" }).butir[0]).toBe("Menyatakan gugatan Penggugat gugur;");
    const cabut = susunAmar({ ...CG, status: "Dicabut" }).butir;
    expect(cabut.slice(0, 2)).toEqual(["Mengabulkan permohonan pencabutan perkara Nomor 430/Pdt.G/2026/PA.Dgl dari Penggugat;", "Memerintahkan Panitera untuk mencatat pencabutan perkara tersebut dalam register perkara;"]);
    for (const s of ["Ditolak", "Tidak Dapat Diterima", "Gugur", "Dicabut"]) expect(susunAmar({ ...CG, status: s }).butir.at(-1)).toMatch(/^Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp199\.000,00/);
  });

  it("status belum dipilih: tidak ada amar (bukan tebakan dikabulkan)", () => {
    const h = susunAmar({ ...CG, status: "" });
    expect(h.ok).toBe(false);
    expect(h.butir).toEqual([]);
  });

  it("biaya belum diketahui: titik-titik + catatan; kabul sebagian dan gugatan kebendaan menjadi pertanyaan bernomor", () => {
    const tanpa = susunAmar({ ...CG, biaya: null });
    expect(tanpa.butir.at(-1)).toContain("Rp............,00");
    expect(tanpa.catatan.join(" ")).toMatch(/biaya perkara belum diketahui/);
    const sebagian = susunAmar({ ...CG, sebagian: true });
    expect(sebagian.butir).toContain("Menolak gugatan Penggugat untuk selain dan selebihnya;");
    expect(sebagian.pertanyaan[0]).toMatchObject({ no: 1 });
    const waris = susunAmar({ ...CG, jenisPerkara: "Kewarisan", jenisPerkaraId: 356, petitum: "1. Mengabulkan gugatan Para Penggugat;<br>2. Menetapkan ahli waris almarhum ...;", namaPihak1: ["A", "B"] });
    expect(waris.butir.at(-1)).toMatch(/^Membebankan kepada Tergugat/);
    expect(waris.pertanyaan.some((p) => /Pasal 192/.test(p.teks))).toBe(true);
  });

  it("itsbat dua Pemohon tanpa butir pengesahan di petitum: butir baku bertitik-titik + catatan", () => {
    const h = susunAmar({ ...CG, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", jenisPerkaraId: 360, nomorPerkara: "228/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16, petitum: "", namaPihak1: ["Ali bin Subyan", "Rismawati binti Samsul"], namaPihak2: [] });
    expect(h.butir[0]).toBe("Mengabulkan permohonan Pemohon I dan Pemohon II;");
    expect(h.butir[1]).toBe("Menyatakan sah perkawinan antara Pemohon I (Ali bin Subyan) dengan Pemohon II (Rismawati binti Samsul) yang dilaksanakan pada tanggal ... di ...;");
    expect(h.butir.at(-1)).toMatch(/^Membebankan kepada para Pemohon/);
  });

  it("butirPetitum: penomoran, judul primair/subsidair, baris lanjutan, entitas HTML", () => {
    const b = butirPetitum("<p>PRIMAIR :</p><p>1.&nbsp;Mengabulkan gugatan Penggugat;</p><p>2. Menetapkan anak</p><p>berada dalam asuhan Penggugat;</p><p>SUBSIDAIR :</p><p>Mohon putusan seadil-adilnya.</p>");
    expect(b.map((x) => [x.bagian, x.jenis, x.teks])).toEqual([
      ["primer", "kabul", "Mengabulkan gugatan Penggugat;"],
      ["primer", "lain", "Menetapkan anak berada dalam asuhan Penggugat;"],
      ["subsider", "subsider", "Mohon putusan seadil-adilnya."],
    ]);
  });
});

describe("ekstensi amar-petitum-sipp.js di borang Putusan Akhir (jsdom)", () => {
  const sumber = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/amar-petitum-sipp.js"), "utf8");
  function buka(awal: string) {
    const dom = new JSDOM(
      `<!doctype html><html><body><form id="frm_putusan"><select name="status_putusan" id="status_putusan"><option value="">-- Pilih --</option><option value="62">Dikabulkan</option><option value="63">Ditolak</option></select><select name="verstek" id="verstek"><option value="T">Tidak</option><option value="Y">Ya</option></select><table><tr><td id="amar_text"><textarea id="amar" name="amar"></textarea></td></tr></table></form></body></html>`,
      { url: "http://192.168.10.10/SIPP/detil_perkara", runScripts: "outside-only" }
    );
    const w = dom.window as never as Record<string, any>;
    const amar = { isi: awal };
    const minta: string[] = [];
    w.cariNomorPerkara = () => "430/Pdt.G/2026/PA.Dgl";
    w.kirimKeJembatan = async (p: { jenis: string; nilai?: string }) => {
      if (p.jenis === "nilai") return { ok: true, siap: true, nilai: amar.isi };
      if (p.jenis === "isi") {
        amar.isi = String(p.nilai);
        return { ok: true };
      }
      return { ok: false };
    };
    w.fetch = async (u: string) => {
      minta.push(String(u));
      const q = new URL(String(u), "http://x").searchParams;
      const html = q.get("status") === "Ditolak" ? "<ol><li>Menolak gugatan Penggugat;</li></ol>" : `<ol><li>Mengabulkan gugatan Penggugat${q.get("verstek") === "1" ? " secara verstek" : ""};</li></ol>`;
      return { json: async () => ({ data: { ada: true, html, catatan: [], pertanyaan: [] } }) };
    };
    w.eval(sumber);
    const pilih = async (nama: string, nilai: string) => {
      const s = w.document.querySelector(`select[name="${nama}"]`);
      s.value = nilai;
      s.dispatchEvent(new w.Event("change", { bubbles: true }));
      for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 5));
    };
    return { w, amar, minta, pilih };
  }

  it("status dipilih, Amar kosong: langsung terisi tanpa tombol; verstek diganti -> diisi ulang selama belum disunting", async () => {
    const h = buka("");
    await h.pilih("status_putusan", "62");
    expect(h.amar.isi).toBe("<ol><li>Mengabulkan gugatan Penggugat;</li></ol>");
    expect(h.minta[0]).toContain("status=Dikabulkan");
    expect(h.w.document.getElementById("aleta-amar-petitum-ket").textContent).toContain('menurut status "Dikabulkan"');
    await h.pilih("verstek", "Y");
    expect(h.amar.isi).toBe("<ol><li>Mengabulkan gugatan Penggugat secara verstek;</li></ol>");
    expect(h.w.document.querySelectorAll("button").length).toBe(0);
  });

  it("amar yang diketik manusia tidak pernah ditimpa (portal pun tidak ditanya)", async () => {
    const h = buka("<p>1. Mengabulkan gugatan Penggugat; 2. amar ketikan hakim</p>");
    await h.pilih("status_putusan", "63");
    expect(h.amar.isi).toBe("<p>1. Mengabulkan gugatan Penggugat; 2. amar ketikan hakim</p>");
    expect(h.minta).toEqual([]);
  });

  it("isian modul disunting petugas lalu status diganti: suntingan tetap", async () => {
    const h = buka("");
    await h.pilih("status_putusan", "62");
    h.amar.isi = "<ol><li>Mengabulkan gugatan Penggugat; disunting</li></ol>";
    await h.pilih("status_putusan", "63");
    expect(h.amar.isi).toBe("<ol><li>Mengabulkan gugatan Penggugat; disunting</li></ol>");
  });
});
