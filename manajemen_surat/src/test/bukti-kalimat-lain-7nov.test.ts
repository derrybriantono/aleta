/**
 * Naskah nyata (terutama kebendaan) tidak selalu memakai kalimat baku "lalu diberi tanda P.1 serta diberi tanggal".
 * Pembaca harus mengenali bentuk lain, tetap menampilkan kalimatnya apa adanya, dan tidak menarik alinea pertimbangan.
 */
import { describe, expect, it } from "vitest";
import { buktiDariAlinea } from "@/lib/bukti-tertulis";
import { susunParagrafBukti } from "@/lib/sinkron-pertimbangan-bukti";

const BAKU = "Fotokopi Kartu Keluarga Nomor 123, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, dan dicocokkan dengan aslinya ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;";

describe("kalimat tanda bukti selain bentuk baku", () => {
  it("bentuk baku tetap terurai lengkap, bukan sunting bebas", () => {
    const [b] = buktiDariAlinea([{ teks: BAKU }]);
    expect(b.kode).toBe("P.1");
    expect(b.baris.manual).toBeNull();
    expect(b.baris.meterai).toBe(0);
    expect(b.baris.cocok).toBe(0);
  });

  it.each([
    ["lalu diberi tanda tanpa tanggal", "Fotokopi Kartu Tanda Penduduk atas nama Fiktif, telah bermeterai cukup dan sesuai dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2;", "P.2"],
    ["dengan tanda", "Fotokopi Kartu Keluarga atas nama Fiktif, telah dinazegelen dan diberi tanda pada surat tersebut dengan tanda P.3.;", "P.3"],
    ["tanda berulang", "Fotokopi Akta Kematian atas nama Fiktif, dan diberi tanda pada surat tersebut dengan tanda tanda T.4.;", "T.4"],
    ["kode dalam kurung", "Fotokopi KTP Nomor 111 atas nama Fiktif, telah dinazegelen, kemudian diberi kode bukti (P.5). Diberi tanggal dan paraf;", "P.5"],
    ["bernomor di depan", "6. Fotokopi BPKB atas nama Fiktif bermeterai cukup, lalu diberi tanda P.6;", "P.6"],
  ])("%s terbaca dan kalimatnya dipertahankan", (_nama, teks, kode) => {
    const [b] = buktiDariAlinea([{ teks }]);
    expect(b.kode).toBe(kode);
    expect(b.baris.manual).toBe(teks);
  });

  it("alinea pertimbangan dan dalil tidak ikut terbaca sebagai bukti", () => {
    expect(
      buktiDariAlinea([
        { teks: "Menimbang, bahwa fotokopi yang diberi tanda P.1 telah bermeterai cukup;" },
        { teks: "- Bahwa bukti fotokopi yang diberi tanda P.2 telah dinazegelen;" },
        { teks: "3. Bahwa fotokopi surat itu diberi tanda P.3 oleh Penggugat;" },
      ])
    ).toEqual([]);
  });

  it("kalimat yang tidak menyebut surat, dan bukti elektronik, tidak terbaca", () => {
    expect(buktiDariAlinea([{ teks: "Saksi menerangkan barang itu diberi tanda P.7;" }])).toEqual([]);
    expect(buktiDariAlinea([{ teks: "Tangkapan layar percakapan, bukti elektronik tersebut telah dicocokkan dengan aslinya, lalu diberi tanda P.8;" }])).toEqual([]);
  });

  it("kartu Kartu Tanda Penduduk tidak terkecoh kata Tanda", () => {
    expect(buktiDariAlinea([{ teks: "Fotokopi Kartu Tanda Penduduk atas nama Fiktif;" }])).toEqual([]);
  });

  it("kode yang sama hanya dihitung sekali, bentuk baku lebih dulu tetap menang", () => {
    const h = buktiDariAlinea([{ teks: BAKU }, { teks: "Fotokopi surat lain bermeterai cukup, lalu diberi tanda P.1;" }]);
    expect(h).toHaveLength(1);
    expect(h[0].baris.manual).toBeNull();
  });

  it("kalimat bentuk lain tidak melahirkan paragraf karangan: masuk daftar belum ada bunyi", () => {
    const bukti = buktiDariAlinea([{ teks: "Fotokopi Kartu Tanda Penduduk atas nama Fiktif bermeterai cukup, lalu diberi tanda P.2;" }]);
    const h = susunParagrafBukti({ jenisPerkara: "PAW", status: "Dikabulkan", verstek: false, lawanHadir: false, lawanMembantah: false, agendaPembuktianKe: 1, bukti });
    expect(h.paragraf).toEqual([]);
    expect(h.belumAdaBunyi.map((b) => b.kode)).toEqual(["P.2"]);
  });
});
