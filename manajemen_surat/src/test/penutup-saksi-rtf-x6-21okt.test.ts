// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * 21 Okt 2026 (x6) - pembersih RTF cetak putusan (blangko-derry-isian.js bersihkanPenutupSaksiRtf) dulu melewati paragraf yang
 * kurung kurawalnya tidak seimbang. Keterangan saksi dari variabel SQL 9259-9265 / list_keterangan ABT masuk SATU grup
 * {...#9259#} dengan butir dipisah \par di dalamnya: butir pertama membawa "{" dan butir TERAKHIR (tempat "Bahwa sudah cukup;" berada)
 * membawa "}" - jadi justru yang terakhir lolos. Struktur di bawah ini disalin dari keluaran renderer php56 ABT asli.
 */
const BS = String.fromCharCode(92);
const r = (s: string) => s.replace(/@/g, BS);

function muat() {
  const isiAbt = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
  const awal = isiAbt.indexOf("const POLA_PENUTUP = [");
  const akhir = isiAbt.indexOf("// ─── Keterangan saksi: disunting");
  const isi = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
  const a = isi.indexOf("function bersihkanPenutupSaksiRtf(");
  const b = isi.indexOf("async function ambilRtf(");
  expect(a).toBeGreaterThan(0);
  expect(b).toBeGreaterThan(a);
  const konteks: Record<string, unknown> = {};
  vm.createContext(konteks);
  vm.runInContext(
    isiAbt.slice(awal, akhir) +
      `
const latin1 = (buf) => (typeof buf === "string" ? buf : String.fromCharCode.apply(null, new Uint8Array(buf)));
const bufDariLatin1 = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i += 1) u[i] = s.charCodeAt(i) & 0xff; return u.buffer; };
const bersihkanPenutup = (t, q) => bersihkanKeteranganSaksi(t, q);
` +
      isi.slice(a, b),
    konteks
  );
  return {
    putusan: konteks.bersihkanPenutupSaksiRtf as (x: string | ArrayBuffer) => { rtf: string | ArrayBuffer; jumlah: number },
    bas: konteks.bersihkanPenutupTabelRtf as (x: string | ArrayBuffer) => { rtf: string | ArrayBuffer; jumlah: number },
  };
}

const seimbang = (t: string) => t.split("{").length === t.split("}").length;

describe("x6 - RTF cetak putusan: butir penutup di batas grup variabel ikut dibuang", () => {
  const fn = muat().putusan;
  const kepala = r("{@rtf1@ansi{@fonttbl{@f0 Times;}}@pard@plain@qj Menimbang bahwa saksi pertama menerangkan sebagai berikut;@par ");
  const para = r("@pard@plain@qj@fi-396@li1198 ");
  const sesudahGrup = r("{@fs24 @rtlch@ltrch@dbch@af5@hich@af4@loch@f4 @par }");
  const ekor = r("@pard@plain@qj Menimbang bahwa saksi kedua;@par}");
  const grup = (isi: string) => r("{@fs24 @rtlch@ltrch@dbch@af5@hich@af4@loch@f4 @lang14345@langnp14345 ") + isi + "}";

  it("butir TERAKHIR (membawa kurung penutup grup) dibuang bersama \\par sebelumnya; butir lain utuh; kurung seimbang", () => {
    const isi = r("-@tab Bahwa saksi kenal Penggugat; @par -@tab Bahwa Penggugat dan Tergugat sudah tidak rukun; @par -@tab Bahwa sudah cukup;");
    const rtf = kepala + para + grup(isi) + sesudahGrup + ekor;
    const h = fn(rtf);
    expect(h.jumlah).toBe(1);
    const t = h.rtf as string;
    expect(t).not.toContain("sudah cukup");
    expect(t).toContain(r("-@tab Bahwa saksi kenal Penggugat;"));
    expect(t).toContain(r("-@tab Bahwa Penggugat dan Tergugat sudah tidak rukun; }{@fs24"));
    expect(t).toContain("Menimbang bahwa saksi kedua");
    expect(seimbang(t)).toBe(true);
    // tidak ada paragraf kosong baru: jumlah \par berkurang tepat satu
    expect(t.split(r("@par")).length).toBe(rtf.split(r("@par")).length - 1);
  });

  it("butir PERTAMA (membawa kurung pembuka grup) dibuang bersama \\par sesudahnya", () => {
    const isi = r("-@tab Bahwa cukup sekian; @par -@tab Bahwa saksi kenal Penggugat; @par -@tab Bahwa Tergugat pergi sejak 2024;");
    const rtf = kepala + para + grup(isi) + sesudahGrup + ekor;
    const h = fn(rtf);
    expect(h.jumlah).toBe(1);
    const t = h.rtf as string;
    expect(t).not.toContain("cukup sekian");
    expect(t).toContain("kenal Penggugat;");
    expect(t).toContain("Tergugat pergi sejak 2024;");
    expect(seimbang(t)).toBe(true);
  });

  it("butir di tengah dan di ujung sekaligus (dua penutup berturutan) dibuang; keterangan perkara tinggal", () => {
    const isi = r("-@tab Bahwa saya tidak sanggup lagi mendamaikan keduanya; @par -@tab Bahwa tidak ada lagi yang ingin disampaikan; @par -@tab Bahwa sudah cukup;");
    const h = fn(kepala + para + grup(isi) + sesudahGrup + ekor);
    const t = h.rtf as string;
    expect(t).not.toMatch(/sudah cukup|ingin disampaikan/);
    expect(t).toContain("tidak sanggup lagi mendamaikan keduanya;");
    expect(seimbang(t)).toBe(true);
  });

  it("grup yang hanya berisi satu butir penutup: teksnya dibuang, kurung dan paragraf tetap sah", () => {
    const h = fn(kepala + para + grup(r("-@tab Bahwa sudah cukup;")) + sesudahGrup + ekor);
    expect(h.jumlah).toBe(1);
    expect(seimbang(h.rtf as string)).toBe(true);
    expect(h.rtf as string).not.toContain("sudah cukup");
  });

  it("kalimat 'sudah cukup' yang hanya bagian dari butir lain tidak disentuh; tanpa penutup RTF persis sama", () => {
    const isi = r("-@tab Bahwa keduanya sudah cukup lama berpisah; @par -@tab Bahwa nafkah tidak cukup;");
    const rtf = kepala + para + grup(isi) + sesudahGrup + ekor;
    const h = fn(rtf);
    expect(h.jumlah).toBe(0);
    expect(h.rtf).toBe(rtf);
  });

  it("masukan ArrayBuffer dikembalikan sebagai ArrayBuffer", () => {
    const isi = r("-@tab Bahwa saksi kenal Penggugat; @par -@tab Bahwa sudah cukup;");
    const rtf = kepala + para + grup(isi) + sesudahGrup + ekor;
    const u = new Uint8Array(rtf.length);
    for (let i = 0; i < rtf.length; i += 1) u[i] = rtf.charCodeAt(i);
    const h = fn(u.buffer);
    expect(h.jumlah).toBe(1);
    expect(typeof h.rtf).toBe("object");
  });
});

describe("x6 - RTF cetak BAS: pasangan baris tabel tanya-jawab saksi yang jawabannya hanya penutup dibuang", () => {
  const fn = muat().bas;
  // bentuk persis keluaran Abt_model::kolom_kode_A4 (satu pasangan baris per tanya-jawab)
  const pasangan = (no: number, tanya: string, jawab: string) =>
    r(
      `@pard@intbl@widctlpar@qj@sl360@slmult1 ${tanya} @cell@cell\n@trowd@irow0@irowband0@trgaph0@trleft0@trftsWidth1\n@trftsWidthB3@trftsWidthA3@trpaddfl3@trpaddft3@trpaddfr3@trpaddfb3\n@clvertalt@clftsWidth3@clwWidth4250@cellx4250\n@clvertalt@clftsWidth3@clwWidth4250@cellx8500@row\n\n` +
        `@pard@intbl@widctlpar@qr@ri100@sl360@slmult1 - @cell@pard@intbl@widctlpar@qj@sl360@slmult1 ${jawab} @cell\n@trowd@irow1@irowband1@lastrow@trgaph0@trleft0@trftsWidth1\n@trftsWidthB3@trftsWidthA3@trpaddfl3@trpaddft3@trpaddfr3@trpaddfb3\n@clvertalt@clftsWidth3@clwWidth4250@cellx4250\n@clvertalt@clftsWidth3@clwWidth4250@cellx8500@row\n\n`
    ).replace("@@", String(no));
  const kepala = r("{@rtf1@ansi{@fonttbl{@f0 Times;}}@pard@plain Menimbang bahwa Penggugat mengajukan pertanyaan kepada saksi sebagai berikut:@par ");
  const ekor = r("@pard Demikian.@par}");
  const seimbang2 = (t: string) => t.split("{").length === t.split("}").length;

  it("pasangan penutup ('Sudah cukup;' atas pertanyaan penutup) dibuang; pasangan lain utuh", () => {
    const rtf =
      kepala +
      pasangan(1, "Apakah saksi kenal Penggugat?", "Saya kenal Penggugat;") +
      pasangan(2, "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?", "Saya tidak sanggup lagi;") +
      pasangan(3, "Apakah masih ada yang ingin Saudara sampaikan ?", "Sudah cukup;") +
      ekor;
    const h = fn(rtf);
    expect(h.jumlah).toBe(1);
    const t = h.rtf as string;
    expect(t).not.toContain("Sudah cukup");
    expect(t).not.toContain("ingin Saudara sampaikan");
    expect(t).toContain("Apakah saksi kenal Penggugat?");
    expect(t).toContain("Saya kenal Penggugat;");
    expect(t).toContain("Saya tidak sanggup lagi;"); // jawaban perkara atas pertanyaan mendamaikan
    expect(t).toContain("Demikian.");
    expect(seimbang2(t)).toBe(true);
    // dua baris (satu pasangan) berkurang
    expect(t.split(r("@row")).length).toBe(rtf.split(r("@row")).length - 2);
  });

  it("beberapa saksi: tiap penutup dibuang; tanpa penutup RTF persis sama; tabel lain tidak disentuh", () => {
    const rtf =
      kepala + pasangan(1, "Apakah saksi kenal Penggugat?", "Saya kenal Penggugat;") + pasangan(2, "Apakah masih ada keterangan yang saksi akan sampaikan?", "Cukup sekian;") +
      pasangan(3, "Apakah masih ada yang ingin saudara sampaikan?", "Tidak ada, sudah cukup.") + ekor;
    const h = fn(rtf);
    expect(h.jumlah).toBe(2);
    const tanpa = kepala + pasangan(1, "Apakah saksi kenal Penggugat?", "Saya kenal Penggugat;") + ekor;
    const h2 = fn(tanpa);
    expect(h2.jumlah).toBe(0);
    expect(h2.rtf).toBe(tanpa);
  });
});
