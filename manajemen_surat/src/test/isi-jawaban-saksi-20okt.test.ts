// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - JAWABAN SAKSI DIISI DARI DATA (isian blangko > SIPP > posita)
 * ============================================================================
 *
 * Keluhan: jawaban saksi di Blangko Derry masih "..." padahal datanya ada (itsbat 228/Pdt.P/2026: tanggal nikah, KUA, wali,
 * yang menikahkan, mahar, saksi nikah) - juga pada perkara cerai. Mesin penyusun lama dijalankan SUNGGUHAN lewat jalur
 * yang sama dengan rute 'saksi-sdg' (set pertanyaan portal -> susunKeteranganSaksiSdg -> pengisi -> pasangJawaban).
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const require_ = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const usul = require_("../services/abtUsulanService.js");
const isi = require_("../services/isiJawabanSaksi.js");
const servis = require_("../services/isiJawabanSaksiService.js");
const posita_ = require_("../services/isiJawabanSaksiPosita.js");
const BD = createRequire(import.meta.url)("../../../ekstensi-sipp/blangko-derry-saksi.js");
const KAT = createRequire(import.meta.url)("../../../ekstensi-sipp/blangko-derry-jawab-katalog.js");

const POSITA_ITSBAT = `<ol><li>Bahwa pada hari Senin, 17 November 2025 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa Lembantongoa , di wilayah hukum Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah;</li>
<li>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan dalam usia 18 tahun Pernikahan dilangsungkan dengan wali nikah yaitu Samsul Bahri (Ayah Kandung Pemohon II) dan yang menikahkan adalah Fathoni (Imam Desa), dan dihadiri saksi nikah bernama Azumar dan Luthfi Hakim, dengan mas kawin berupa Rp.1.100.000 (Satu Juta Seratus Ribu Rupiah) dan dibayar tunai;</li>
<li>Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri, dan telah dikaruniai seorang anak yang bernama Risal bin Ali, usia 6 bulan;</li>
<li>Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena Para Pemohon masih berstatus belum cukup umur saat pernikahan dan pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan untuk kepentingan hukum lainnya;</li></ol>`;

const POSITA_CERAI = `1. Bahwa pada tanggal 25 Juli 2010, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Palu Barat, Kota Palu, Provinsi Sulawesi Tengah;
2. Bahwa setelah menikah, Penggugat dan Tergugat hidup selayaknya suami isteri dan telah dikaruniai 2 (dua) orang anak, saat ini anak tersebut berada dalam pengasuhan Penggugat;
3. Bahwa sejak bulan Juli 2020 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran;
4. Bahwa puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada Maret 2024, Tergugat pergi meninggalkan kediaman bersama ke rumah orangtua Tergugat di Desa Loli Oge dikarenakan antara Penggugat dan Tergugat terjadi perselisihan dan pertengkaran sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 1 tahun 9 bulan;`;

type Hasil = { jawaban: any[]; saksi: any[]; h: any; rows: any[] };

/** Jalur rute 'saksi-sdg': set pertanyaan portal -> penyusun lama -> pengisi bersumber -> pemasangan ke baris. */
function jalankan(o: { namaJenis: string; id: string; alur: string; sebP: string; sebT: string; posita: string; isian?: any; sipp?: any; saksi?: any[]; jumlahP?: number }): Hasil {
  const t = tawarkanSetSaksi({ namaJenis: o.namaJenis, nomor: "1/Pdt.P/2026/PA.Dgl", folder: "", sebutanP: o.sebP, sebutanT: o.sebT, jumlahP: o.jumlahP ?? 1 } as any);
  const rows = t.set[0].baris.map((r: any) => ({ no: r.no, tanya: r.tanya, jawab: r.jawab }));
  const templatAsli = BD.templatDariBaris(BD.tandaiDasar(rows, true));
  const saksi = o.saksi || [
    { pihak: "P", ke: 1, modus: "sama", sumber: "penggugat", alasan: [] },
    { pihak: "P", ke: 2, modus: "sama", sumber: "penggugat", alasan: [] },
  ];
  const muatan = BD.susunMuatan({ nomorPerkara: "1/Pdt.P/2026/PA.Dgl", templat: templatAsli, jenisPerkara: o.id, alur: o.alur, pelaku: o.sebT, lawan: o.sebP, saksi });
  const h = usul.susunKeteranganSaksiSdg({ templat: templatAsli, posita: o.posita, alasan: [], pelaku: o.sebT, lawan: o.sebP, nomorPerkara: "1/Pdt.P/2026/PA.Dgl", kodeKumpulan: "", jenisPerkara: o.id, alur: o.alur, modus: muatan.modus, saksi: muatan.saksi });
  servis.lengkapi(h, { templatMasuk: templatAsli, posita: o.posita, jenisPerkara: o.id, alur: o.alur, pelaku: o.sebT, lawan: o.sebP, isian: o.isian, sipp: o.sipp, saksi });
  const per = [0, 1].map((ke) => BD.pasangJawaban(rows.map((r: any) => ({ ...r, dasar: r.jawab })), h.saksi[ke].jawaban, {}));
  return { jawaban: h.saksi.map((s: any) => s.jawaban), saksi: per, h, rows };
}
const teksSaksi = (r: Hasil, ke: number) => r.saksi[ke].rows.map((x: any) => x.jawab as string);
const adaTitik = (t: string) => /\.{3,}|…/.test(t);

describe("itsbat nikah 228/Pdt.P/2026 - jawaban terisi dari posita", () => {
  const r = jalankan({ namaJenis: "Itsbat Nikah", id: "360", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita: POSITA_ITSBAT, jumlahP: 2 });
  const s1 = teksSaksi(r, 0).join("\n");

  it("tanggal, tempat/KUA, wali, yang menikahkan, saksi nikah, mahar, status dan umur terisi", () => {
    expect(s1).toContain("menikah pada 17 November 2025 di Desa Lembantongoa");
    expect(s1).toContain("Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi");
    expect(s1).toContain("wali nasab bernama Samsul Bahri, yaitu ayah kandung Pemohon II");
    expect(s1).toContain("Yang menikahkan adalah Imam Desa bernama Fathoni");
    expect(s1).toContain("yaitu Azumar dan Luthfi Hakim");
    expect(s1).toContain("Rp1.100.000,00 (satu juta seratus ribu rupiah)");
    expect(s1).toContain("Pemohon I berstatus perjaka dan Pemohon II berstatus perawan");
    expect(s1).toContain("Pemohon I berumur sekitar 21 tahun dan Pemohon II sekitar 18 tahun");
    expect(s1).toContain("dikaruniai 1 orang anak");
  });

  it("tidak ada titik-titik tersisa selain hubungan saksi (data tidak ada di perkara)", () => {
    const sisa = teksSaksi(r, 0).filter(adaTitik);
    expect(sisa.length).toBeLessThanOrEqual(1);
  });

  it("memuat kontrak {teks, yakin, sumber} pada baris yang diisi", () => {
    const baris = r.saksi[0].rows.find((x: any) => /menikah pada 17 November 2025/.test(x.jawab));
    expect(baris.usulan.teks).toBe(baris.jawab);
    expect(["yakin", "cukup", "ragu"]).toContain(baris.usulan.yakin);
    expect(baris.usulan.sumber).toMatch(/gugatan/);
    expect(baris.usulan.ket.length).toBeGreaterThan(10);
  });

  it("saksi kedua berbunyi lain dari saksi pertama tetapi memuat isi yang sama", () => {
    const s2 = teksSaksi(r, 1).join("\n");
    expect(s2).toContain("Samsul Bahri");
    expect(s2).toContain("Fathoni");
    expect(s2).not.toBe(s1);
  });

  it("tidak satu pun jawaban memuat kata aplikasi", () => {
    expect((s1 + teksSaksi(r, 1).join("\n")).toLowerCase()).not.toContain("aleta");
  });
});

describe("urutan sumber dan keyakinan", () => {
  it("isian blangko mengalahkan posita; bertentangan = ragu dengan penjelasan", () => {
    const r = jalankan({
      namaJenis: "Itsbat Nikah", id: "360", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita: POSITA_ITSBAT, jumlahP: 2,
      isian: { 5197: { nilai: "18 November 2025", keyakinan: "pasti" } },
    });
    const baris = r.saksi[0].rows.find((x: any) => /menikah pada/.test(x.jawab));
    expect(baris.jawab).toContain("18 November 2025");
    expect(baris.usulan.yakin).toBe("ragu");
    expect(baris.usulan.ket).toMatch(/isian blangko menyebut/i);
    expect(baris.usulan.ket).toMatch(/gugatan menyebut/i);
  });

  it("data SIPP melengkapi yang tidak ada di posita (tanggal lahir -> umur saat menikah)", () => {
    const posita = POSITA_ITSBAT.replace(/Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan dalam usia 18 tahun/, "Perjaka, dan Pemohon II berstatus Perawan");
    const r = jalankan({
      namaJenis: "Itsbat Nikah", id: "360", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita, jumlahP: 2,
      sipp: { pihak1: [{ lahir: "2004-02-26", alamat: "Dusun V" }, { lahir: "2007-05-03" }], itsbat: { tgl: "2025-11-17", tempat: "Desa Lembantongoa" } },
    });
    const umur = r.saksi[0].rows.find((x: any) => /berumur sekitar/.test(x.jawab));
    expect(umur.jawab).toContain("21 tahun");
    expect(umur.jawab).toContain("18 tahun");
    expect(umur.usulan.sumber).toMatch(/SIPP/);
  });

  it("data tidak ada = tetap titik-titik (tidak dikarang)", () => {
    const r = jalankan({ namaJenis: "Itsbat Nikah", id: "360", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita: "<p>Bahwa Pemohon I dan Pemohon II menikah.</p>", jumlahP: 2 });
    const mahar = r.saksi[0].rows.find((x: any) => /Mahar/i.test(x.jawab));
    expect(mahar.jawab).toMatch(/\.{3}/);
    expect(mahar.usulan).toBeUndefined();
  });
});

describe("pilihan pengetahuan saksi", () => {
  const dasar = { namaJenis: "Itsbat Nikah", id: "360", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita: POSITA_ITSBAT, jumlahP: 2 };
  it("'tidak tahu' tidak diberi rincian dari data", () => {
    const r = jalankan({ ...dasar, saksi: [{ pihak: "P", ke: 1, modus: "tidak-tahu", sumber: "penggugat", alasan: [] }, { pihak: "P", ke: 2, modus: "sama", sumber: "penggugat", alasan: [] }] });
    expect(teksSaksi(r, 0).join("\n")).not.toContain("Samsul Bahri");
    expect(teksSaksi(r, 1).join("\n")).toContain("Samsul Bahri");
  });
  it("'dari cerita' memakai bentuk 'Menurut cerita ...' pada jawaban yang diisi", () => {
    const rows = [{ tanya: "Siapa saja yang menjadi saksi nikah pada saat itu?", jawab: "Saksi nikahnya dua orang, yaitu ... dan ...;" }];
    const f = isi.bangunFakta({ usulan: [{ kode: "0650", nilai: "Azumar", keyakinan: "cukup" }, { kode: "0651", nilai: "Luthfi", keyakinan: "cukup" }] });
    const h = isi.isiJawaban(rows[0], f, { jenis: "itsbat", P: "Pemohon", T: "Termohon", ke: 1, modus: "dari-cerita", sumberNama: "Pemohon I" });
    expect(h.teks).toMatch(/^Menurut cerita Pemohon I, saksi nikahnya dua orang, yaitu Azumar dan Luthfi/);
  });
});

describe("ketikan petugas tidak ditimpa", () => {
  it("baris yang sudah diketik bertahan dan dilaporkan tertahan", () => {
    const r = jalankan({ namaJenis: "Itsbat Nikah", id: "360", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita: POSITA_ITSBAT, jumlahP: 2 });
    const rows = r.rows.map((x: any) => ({ ...x, dasar: x.jawab }));
    rows[6] = { ...rows[6], jawab: "Saksi nikahnya Pak Hasan dan Pak Ali;" };
    const hasil = BD.pasangJawaban(rows, r.h.saksi[0].jawaban, {});
    expect(hasil.rows[6].jawab).toBe("Saksi nikahnya Pak Hasan dan Pak Ali;");
    expect(hasil.tertahan.some((t: any) => t.i === 6)).toBe(true);
  });
});

describe("cerai gugat - awal perselisihan, pisah rumah, anak, puncak", () => {
  const sipp = { nikah: { tgl_nikah: "2010-07-25", kua: "KUA Palu Barat Kota Palu" }, anak: [{ nama_anak: "A bin B", diasuh_oleh: "1", ada_anak: "1" }, { nama_anak: "C bin B", diasuh_oleh: "1", ada_anak: "1" }], pihak1: [{ alamat: "Jl. Mawar No. 1, Kota Palu, Provinsi Sulawesi Tengah, Domisili Elektronik: a@b.c" }], pihak2: [{ alamat: "Desa Loli Oge, Kecamatan Banawa" }] };
  const r = jalankan({ namaJenis: "Cerai Gugat", id: "347", alur: "15", sebP: "Penggugat", sebT: "Tergugat", posita: POSITA_CERAI, sipp });
  const s1 = teksSaksi(r, 0).join("\n");
  it("tanggal nikah, puncak beserta peristiwanya, yang meninggalkan dan alamat terisi", () => {
    expect(s1).toContain("menikah pada 25 Juli 2010 di");
    expect(s1).toContain("Puncaknya terjadi pada bulan Maret 2024 ketika Tergugat pergi meninggalkan kediaman bersama");
    expect(s1).toContain("Yang meninggalkan tempat tinggal bersama adalah Tergugat");
    expect(s1).toContain("Penggugat tinggal di Jl. Mawar No. 1, Kota Palu");
    expect(s1).not.toContain("Domisili Elektronik");
  });
  it("awal perselisihan, pisah rumah dan jumlah anak ada", () => {
    expect(s1).toMatch(/sejak bulan Juli 2020/);
    expect(s1).toMatch(/dikaruniai 2 orang anak/);
    expect(s1).toMatch(/tinggal bersama Penggugat/);
  });
});

describe("pola tambahan membaca posita", () => {
  it("dispensasi kawin: anak, calon pasangan, umur, KUA yang menolak, lama kenal", () => {
    const p = `<ol><li>Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Maura binti Robin (calon mempelai wanita) dengan seorang laki-laki yang bernama Ibrahim bin Yusuf (calon mempelai laki-laki);</li><li>Bahwa anak para Pemohon yang bernama Maura binti Robin masih di bawah umur untuk persyaratan melangsungkan perkawinan yang sampai saat ini masih berusia 15 tahun;</li><li>Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Palolo, Kabupaten Sigi, guna mencatatkan pernikahan, namun ditolak dengan alasan belum cukup umur;</li><li>Bahwa anak Pemohon tersebut telah saling mengenal dengan calon isterinya selama 1 tahun, dan hubungan mereka telah sedemikian eratnya sehingga anak para Pemohon sekarang sedang hamil 3 bulan (Surat);</li></ol>`;
    const x = Object.fromEntries(posita_.positaTambahan(p, "dk").map((t: any) => [t.kunci, t.nilai]));
    expect(x.anakNama).toBe("Maura binti Robin");
    expect(x.calonNama).toBe("Ibrahim bin Yusuf");
    expect(x.anakUmur).toBe("15");
    expect(x.kuaPenolak).toBe("Palolo");
    expect(x.lamaKenal).toBe("1 tahun");
    expect(x.hamil).toBe("3 bulan");
    const r = jalankan({ namaJenis: "Dispensasi Kawin", id: "362", alur: "16", sebP: "Pemohon", sebT: "Termohon", posita: p });
    const s = teksSaksi(r, 0).join("\n");
    expect(s).toContain("ditolak KUA Kecamatan Palolo karena belum cukup umur");
    expect(s).toContain("Anak Pemohon bernama Maura binti Robin, sekarang berumur 15 tahun");
    expect(s).toContain("bernama Ibrahim bin Yusuf");
  });

  it("mahar berupa barang, ejaan salat dan cara bayar", () => {
    expect(isi.uraiMahar("seperangkat alat sholat dan uang Rp.110.000 (Seratus Sepuluh Ribu Rupiah) dibayar tunai")).toEqual({ barang: "seperangkat alat salat dan uang Rp110.000,00 (seratus sepuluh ribu rupiah)", bayar: "tunai" });
    expect(isi.tanggalIndo("hari Senin tanggal 09 Desember 2008")).toBe("9 Desember 2008");
    expect(isi.tanggalIndo("2025-11-17")).toBe("17 November 2025");
  });
});

describe("pengisi jawaban katalog (sumber isi-jawaban)", () => {
  const baris = [
    { kunciJawaban: "itsbat-nikah/q-in-waktu-tempat-pb/melihat", tanya: "Kapan dan di mana Pemohon I dan Pemohon II menikah?", jawab: "pada waktu itu saya berada di tempat kejadian dan melihat bahwa Pemohon I dan Pemohon II melangsungkan pernikahan di ... yaitu pada tanggal ..." },
    { kunciJawaban: "itsbat-nikah/q-in-umur-pb/melihat", tanya: "Waktu menikah, berapa kira-kira umur Pemohon I dan Pemohon II?", jawab: "pada waktu akad nikah umur Pemohon I sekitar ... dan Pemohon II sekitar ..., dan hal itu saya ketahui sendiri" },
    { kunciJawaban: "itsbat-nikah/q-in-saksi-nikah-pb/melihat", tanya: "Siapa saja yang menjadi saksi nikah ketika akad nikah itu berlangsung?", jawab: "akad nikah itu disaksikan oleh dua orang saksi yaitu ... dan ..., dan hal itu saya lihat dengan mata kepala saya sendiri" },
    { kunciJawaban: "itsbat-nikah/q-in-mahar-pb/melihat", tanya: "Apa mas kawin yang diserahkan Pemohon I kepada Pemohon II pada waktu menikah?", jawab: "saya melihat sendiri bahwa mas kawin dari Pemohon I kepada Pemohon II berupa ..." },
    { kunciJawaban: "itsbat-nikah/q-in-wali-pb/melihat", tanya: "Siapa yang bertindak sebagai wali nikah Pemohon II pada waktu itu, dan apa hubungannya dengan Pemohon II?", jawab: "saya melihat sendiri bahwa yang menjadi wali nikah Pemohon II adalah ... bernama ..." },
  ];
  const mentah: Record<string, string> = { "5197": "17 November 2025", "5105": "Desa Lembantongoa, Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah", "0650": "Azumar", "0651": "Luthfi Hakim", "1001": "Rp.1.100.000 (Satu Juta Seratus Ribu Rupiah)", "1217": "Samsul Bahri", "1046": "Ayah Kandung Pemohon II", "7211": "21 tahun", "7212": "18 tahun" };
  const isian = Object.fromEntries(Object.entries(mentah).map(([k, v]) => [k, { nilai: v, keyakinan: "pasti" }]));
  it("mengisi titik-titik jawaban katalog dari isian blangko tanpa posita", () => {
    const hasil = servis.isiBaris({ jenisPerkara: "360", alur: "16", pelaku: "Termohon", lawan: "Pemohon", isian, saksiIsi: [{ kunci: "saksi 1 p", ke: 1, modus: "melihat", baris: baris.map((b) => ({ kunci: b.kunciJawaban, tanya: b.tanya, jawab: b.jawab })) }] });
    expect(hasil["itsbat-nikah/q-in-waktu-tempat-pb/melihat"].teks).toContain("di Desa Lembantongoa, Kecamatan Palolo, Kabupaten Sigi yaitu pada tanggal 17 November 2025");
    expect(hasil["itsbat-nikah/q-in-umur-pb/melihat"].teks).toContain("umur Pemohon I sekitar 21 tahun dan Pemohon II sekitar 18 tahun");
    expect(hasil["itsbat-nikah/q-in-saksi-nikah-pb/melihat"].teks).toContain("yaitu Azumar dan Luthfi Hakim");
    expect(hasil["itsbat-nikah/q-in-mahar-pb/melihat"].teks).toContain("berupa Rp1.100.000,00 (satu juta seratus ribu rupiah)");
    expect(hasil["itsbat-nikah/q-in-wali-pb/melihat"].teks).toContain("adalah ayah kandung Pemohon II bernama Samsul Bahri");
    for (const v of Object.values<any>(hasil)) expect(v.yakin).toBe("yakin");
  });
  it("susunMuatan hanya mengirim baris bertitik-titik dan memetakan tingkat pengetahuan", () => {
    const m = KAT.susunMuatan({ perkara: { nomorPerkara: "228/Pdt.P/2026/PA.Dgl", jenisPerkaraId: "360", alurPerkaraId: "16" }, kenal: { sebutan: { P: "Pemohon", T: "Termohon" } }, saksi: [{ kunci: "saksi 1 p", ke: 1, jenis: "tidak-tahu", baris: [...baris, { kunciJawaban: "x/y/z", tanya: "?", jawab: "Tidak tahu." }] }], variabel: { "0650": "Azumar" } });
    expect(m.sumber).toBe("isi-jawaban");
    expect(m.saksiIsi[0].baris).toHaveLength(baris.length);
    expect(m.saksiIsi[0].modus).toBe("tidak-tahu");
    expect(m.isian["0650"].nilai).toBe("Azumar");
    expect(m.lawan).toBe("Pemohon");
  });
  it("petakan membuang jawaban kosong dan yang memuat nama aplikasi", () => {
    const p = KAT.petakan({ a: { teks: "Isi", yakin: "yakin", sumber: "x", ket: "k" }, b: { teks: "", yakin: "yakin" }, c: { teks: "ini dari Aleta", yakin: "yakin" }, d: { teks: "ok", yakin: "aneh" } });
    expect(Object.keys(p).sort()).toEqual(["a", "d"]);
    expect(p.d.yakin).toBe("cukup");
  });
  it("saringIsian membuang nilai berisi nama aplikasi dan kode tak sah", () => {
    expect(servis.saringIsian({ "5197": "17 November 2025", "9999999": "x", "5105": "Aleta", abc: "x" })).toEqual({ "5197": { nilai: "17 November 2025" } });
  });
});
