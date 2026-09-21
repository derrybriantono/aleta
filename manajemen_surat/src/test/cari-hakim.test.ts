import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { cariHakim, hakimPersis, type Hakim } from "@/lib/cari-hakim";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

/**
 * Lima hakim aktif PA Donggala apa adanya dari hakim_pn - kode dan ejaan
 * gelarnya persis seperti tersimpan di SIPP setempat, termasuk yang tanpa
 * spasi sesudah koma.
 *
 * Diambil sungguhan, bukan dikarang: yang diuji di sini justru perilaku
 * terhadap ejaan yang tidak rapi, dan daftar karangan yang rapi akan
 * meluluskan pencocokan yang sebenarnya patah.
 */
const HAKIM: Hakim[] = [
  { id: 1, kode: "A", nama: "Fahri Saifuddin, S.H.I., M.H." },
  { id: 2, kode: "B", nama: "Sudarmin H.I.M. Tang, S.H.I.,M.H" },
  { id: 3, kode: "C1", nama: "Himawan Tatura Wijaya, S.H.I.,M.H." },
  { id: 4, kode: "C2", nama: "Idris, S.H.I., M.H." },
  { id: 5, kode: "C3", nama: "Derry Briantono, S.H." },
];

describe("cariHakim - dari kodenya", () => {
  it("kode persis menemukan orangnya", () => {
    expect(cariHakim(HAKIM, "C3").map((x) => x.id)).toEqual([5]);
    expect(cariHakim(HAKIM, "c1").map((x) => x.id)).toEqual([3]);
  });

  it("kode satu huruf TIDAK menyapu tiap nama yang memuat huruf itu", () => {
    // Ini sebab kodenya dicocokkan persis. "a" mengandung pada keempat nama;
    // bila kodenya dicocokkan "mengandung", tiap ketikan berhuruf a akan
    // memanggil hakim berkode A - yaitu hampir tiap ketikan.
    const hasil = cariHakim(HAKIM, "A");
    expect(hasil).toHaveLength(1);
    expect(hasil[0].kode).toBe("A");
  });

  it("kode yang tidak ada tidak memaksa jawaban", () => {
    expect(cariHakim(HAKIM, "Z9")).toEqual([]);
  });
});

describe("cariHakim - dari sebagian namanya", () => {
  it("awal nama depan", () => {
    expect(cariHakim(HAKIM, "der").map((x) => x.id)).toEqual([5]);
  });

  it("awal salah satu kata di tengah nama", () => {
    // Yang mengetik menulis nama yang diingatnya, belum tentu kata pertama.
    expect(cariHakim(HAKIM, "brian").map((x) => x.id)).toEqual([5]);
    expect(cariHakim(HAKIM, "tatura").map((x) => x.id)).toEqual([3]);
  });

  it("gelar bertanda baca tidak menghalangi", () => {
    // "S.H.I.,M.H" tanpa spasi pada satu baris dan "S.H.I., M.H." pada yang
    // lain - keduanya tersimpan begitu di SIPP.
    expect(cariHakim(HAKIM, "sudarmin").map((x) => x.id)).toEqual([2]);
  });

  it("satu atau dua huruf TIDAK menyapu lewat 'mengandung'", () => {
    // Terukur pada daftar satker: huruf "s" mengandung pada gelar keempat
    // nama ("S.H.I.", "S.H."), dan "ta" pada Tatura maupun Briantono. Yang
    // mengetik satu-dua huruf sedang menyebut kode atau baru mulai mengetik
    // nama; menawarinya seluruh daftar membuat tawarannya terbaca sebagai
    // tebakan, dan yang membacanya berhenti membacanya.
    // Yang tersisa hanya yang salah satu KATA NAMANYA diawali huruf itu -
    // Sudarmin dan Saifuddin - bukan kelima-limanya.
    expect(cariHakim(HAKIM, "s").map((x) => x.id).sort()).toEqual([1, 2]);
    // "ta" mengawali dua kata nama yang sungguhan - Tang dan Tatura - jadi
    // keduanya memang patut ditawarkan. Yang dijaga: tiga sisanya, yang hanya
    // mengandung "ta" di tengah kata, TIDAK ikut.
    expect(cariHakim(HAKIM, "ta").map((x) => x.id).sort()).toEqual([2, 3]);
  });

  it("huruf gelar tidak dihitung sebagai kata", () => {
    // "Derry Briantono, S.H." dibakukan jadi "derry briantono s h", sehingga
    // "h" menjadi kata tersendiri. Tanpa pembuangan kata sehuruf, mengetik
    // "h" menawarkan KELIMA-LIMANYA - seluruhnya bergelar berakhiran H.
    //
    // Yang benar hanya Himawan, satu-satunya yang kata namanya diawali h.
    expect(cariHakim(HAKIM, "h").map((x) => x.id)).toEqual([3]);
  });

  it("sejak tiga huruf, yang mengandung ikut ditawarkan", () => {
    expect(cariHakim(HAKIM, "tur").map((x) => x.id)).toEqual([3]);
  });

  it("yang diawali didahulukan atas yang sekadar mengandung", () => {
    const hasil = cariHakim(HAKIM, "idris");
    expect(hasil[0].id).toBe(4);
  });

  it("ketikan kosong tidak menawarkan apa pun", () => {
    // Daftar yang terbuka penuh pada kotak kosong menutupi tombol Simpan
    // tepat ketika borangnya baru dibuka.
    expect(cariHakim(HAKIM, "")).toEqual([]);
    expect(cariHakim(HAKIM, "   ")).toEqual([]);
  });

  it("daftar kosong tidak melempar", () => {
    // Keadaan yang sungguh terjadi ketika bot tidak terbaca.
    expect(cariHakim([], "der")).toEqual([]);
  });

  it("batasnya dihormati", () => {
    expect(cariHakim(HAKIM, "h", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("hakimPersis", () => {
  it("mengenali nama yang sudah tersimpan", () => {
    expect(hakimPersis(HAKIM, "Derry Briantono, S.H.")?.kode).toBe("C3");
  });

  it("ejaan gelar yang berbeda tetap orang yang sama", () => {
    // SIPP menulis gelarnya tidak seragam. Perbandingan huruf demi huruf akan
    // menyatakan orang yang sama sebagai dua orang, dan lencana "hakim
    // terdeteksi" padam pada nama yang justru datang dari SIPP sendiri.
    expect(hakimPersis(HAKIM, "Sudarmin H.I.M. Tang, S.H.I., M.H.")?.id).toBe(2);
  });

  it("nama di luar daftar BUKAN galat - ia sah", () => {
    // Konseptor tidak selalu hakim: panitera pengganti pun menyusun naskah.
    expect(hakimPersis(HAKIM, "Munifah, S.H.")).toBeNull();
  });

  it("kosong tidak mengenali siapa pun", () => {
    expect(hakimPersis(HAKIM, "")).toBeNull();
  });
});

describe("borangnya sungguh memakai keduanya", () => {
  const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

  it("kotaknya tetap kotak isian, BUKAN kotak pilihan", () => {
    // Penjaga terpenting berkas ini. Permintaan penggunanya tegas: "kalau
    // bukan hakim buat cukup ketik saja namanya tanpa memilih dropdown".
    // Kotak pilihan yang memaksa akan menolak nama panitera pengganti yang
    // sungguh menyusun naskahnya.
    const i = layar.indexOf("function BorangKonseptorSementara");
    const blok = layar.slice(i, i + 6000);
    expect(blok).toContain("<input");
    expect(blok).not.toContain("<select");
    // Enter tetap menyimpan ketika tidak ada yang disorot di daftar.
    expect(blok).toContain('if (e.key === "Enter") onSimpan(isian);');
  });

  it("daftarnya diam ketika namanya sudah persis", () => {
    const i = layar.indexOf("const usul = useMemo(");
    const blok = layar.slice(i, i + 700);
    expect(blok).toContain("hakimPersis");
  });

  it("gagalnya daftar dikatakan, bukan didiamkan", () => {
    // Diam pada keadaan itu membuat orang menyangka namanya memang tidak ada
    // di SIPP, lalu mengetik ulang dengan ejaan lain.
    expect(layar).toContain("Daftar hakim tidak terbaca, jadi namanya tidak dapat ditawarkan");
  });

  it("nama yang tidak dikenali TIDAK diberi tanda peringatan", () => {
    // Nama di luar daftar sah. Tanda merah padanya akan membuat orang mengira
    // tunjukannya ditolak.
    const i = layar.indexOf("Hakim terdeteksi");
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i - 400, i + 400);
    expect(blok).not.toContain("tidak dikenali");
    expect(blok).not.toContain("bukan hakim");
  });

  it("rutenya dibaca sekali, bukan tiap tanggal diganti", () => {
    const i = layar.indexOf('apiPath("/api/aleta-ecourt/hakim")');
    expect(i).toBeGreaterThan(-1);
    // Efeknya tidak bergantung pada tanggal - kebergantungannya kosong.
    const sesudah = layar.slice(i, i + 900);
    expect(sesudah).toContain("}, []);");
  });
});

describe("rutenya tidak menjatuhkan layar ketika bot mati", () => {
  const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/hakim/route.ts");

  it("gagalnya bot dijawab daftar kosong, bukan galat", () => {
    // Kotak isiannya harus tetap dapat dipakai ketika SIPP sedang tidak
    // terbaca - ia hanya MENOLONG mengetik.
    expect(rute).toContain("hakim: [],");
    expect(rute).toContain("ada: false");
  });

  it("kapabilitasnya sama dengan layar antrian sidang", () => {
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
  });
});
