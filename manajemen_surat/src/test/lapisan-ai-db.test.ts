import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bukaPercakapan,
  catatPutaran,
  faktaPerkara,
  jawab,
  periksaTarikan,
  periksaUsulan,
  pesanPercakapan,
  sahkanFakta,
  simpanFakta,
  keadaanAi,
  simpanSaklar,
  usulkanButirKePustaka,
  type PemanggilModel,
} from "@/server/modules/aleta-ecourt/lapisan-ai";

/**
 * Lapisan AI di basis data (I1-I5).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Satu hal yang tidak dapat diuji tanpa basis data, dan ia yang paling
 * menentukan: **model TIDAK dipanggil sama sekali ketika pustaka menjawab.**
 *
 * Bukan dipanggil lalu jawabannya dibuang - tidak dipanggil. Bedanya tidak
 * terlihat dari layar sama sekali, dan hanya terlihat dari tagihan penyedia
 * serta dari apa yang meninggalkan gedung. Uji ini menghitung berapa kali
 * pemanggilnya benar-benar tersentuh.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

afterEach(async () => {
  await db?.close?.();
  db = null;
});

const SEKARANG = new Date().toISOString();

/** Pemanggil model palsu yang menghitung dirinya sendiri. */
function pemanggilPalsu(teks = "Menimbang, bahwa jawaban model;") {
  const catatan = { dipanggil: 0, isiTerakhir: {} as Record<string, unknown> };
  const panggil: PemanggilModel = async (_perintah, isi) => {
    catatan.dipanggil += 1;
    catatan.isiTerakhir = isi;
    return { ok: true, teks, penyedia: "penyedia-uji", model: "model-uji" };
  };
  return { catatan, panggil };
}

async function tanamButir(basis: AletaDatabase, id: string, teks: string) {
  await basis.run(
    `INSERT INTO aleta_pertimbangan_butir
       (id, sidik, teks, jenis_perkara, isu, syarat, jumlah_pemakaian, keadaan, atas_perintah, versi, dibuat_at, diubah_at)
     VALUES (?, ?, ?, 'Cerai Gugat', 'maksud', '{}', 5, 'disahkan', 'Ketua', 1, ?, ?)`,
    [id, `sidik-${id}`, teks, SEKARANG, SEKARANG]
  );
}

describe("pustaka dulu, model terakhir - dibuktikan hitungan panggilan", () => {
  it("pustaka menjawab: model TIDAK tersentuh sama sekali", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa mediasi telah diupayakan namun tidak berhasil;");
    const { catatan, panggil } = pemanggilPalsu();

    const hasil = await jawab(basis, {
      pertanyaan: "mediasi",
      jenisPerkara: "Cerai Gugat",
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });

    expect(hasil.jawaban.dijawabOleh).toBe("pustaka");
    expect(catatan.dipanggil).toBe(0);
    expect(hasil.kiriman).toBeNull();
  });

  it("pustaka kosong: model dipanggil sekali", async () => {
    const basis = await basisData();
    const { catatan, panggil } = pemanggilPalsu();

    const hasil = await jawab(basis, {
      pertanyaan: "sesuatu yang tidak ada di pustaka",
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });

    expect(hasil.jawaban.dijawabOleh).toBe("model");
    expect(hasil.jawaban.usulan).toBe(true);
    expect(catatan.dipanggil).toBe(1);
  });

  it("AI dimatikan: model TIDAK tersentuh, dan sebabnya disampaikan apa adanya", async () => {
    const basis = await basisData();
    const { catatan, panggil } = pemanggilPalsu();

    const hasil = await jawab(basis, {
      pertanyaan: "apa pun",
      ai: { menyala: false, sebab: "AI dimatikan administrator." },
      panggilModel: panggil,
    });

    expect(hasil.jawaban.dijawabOleh).toBe("tidakDijawab");
    expect(catatan.dipanggil).toBe(0);
    expect(hasil.jawaban.peringatan.join(" ")).toContain("dimatikan administrator");
  });

  it("yang dikirim ke model sudah tersamar, bukan isi asli", async () => {
    const basis = await basisData();
    const { catatan, panggil } = pemanggilPalsu();

    await jawab(basis, {
      pertanyaan: "apa pun",
      fakta: { jenisPerkara: "Cerai Gugat", namaPenggugat: "Reka Febrianti", nik: "7201234567890123" },
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });

    expect(catatan.isiTerakhir.jenisPerkara).toBe("Cerai Gugat");
    expect(catatan.isiTerakhir.namaPenggugat).toBe("Orang A");
    expect(catatan.isiTerakhir.nik).toBeUndefined();
  });

  it("ruas tanpa aturan batas menahan kiriman, dan model tidak tersentuh", async () => {
    const basis = await basisData();
    const { catatan, panggil } = pemanggilPalsu();

    const hasil = await jawab(basis, {
      pertanyaan: "apa pun",
      fakta: { ruasAsingYangBelumDiatur: "isi" },
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });

    expect(catatan.dipanggil).toBe(0);
    expect(hasil.jawaban.dijawabOleh).toBe("tidakDijawab");
    expect(hasil.jawaban.peringatan.join(" ")).toContain("ruasAsingYangBelumDiatur");
  });

  it("kutipan model yang tidak ada di pustaka diperingatkan", async () => {
    const basis = await basisData();
    const { panggil } = pemanggilPalsu(
      "Menimbang, bahwa berdasarkan Pasal 99 Undang-Undang Nomor 1 tahun 1974;"
    );

    const hasil = await jawab(basis, {
      pertanyaan: "apa pun",
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });

    expect(hasil.jawaban.peringatan.join(" ")).toContain("TIDAK ditemukan di pustaka");
  });
});

describe("percakapan mencatat asal jawaban", () => {
  it("satu putaran menyimpan pertanyaan dan jawabannya beserta asalnya", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "Menimbang, bahwa mediasi telah diupayakan;");
    const { panggil } = pemanggilPalsu();

    const percakapanId = await bukaPercakapan(basis, {
      perkaraId: "10501",
      nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
      oleh: "aktor",
    });
    const hasil = await jawab(basis, {
      pertanyaan: "mediasi",
      jenisPerkara: "Cerai Gugat",
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });
    await catatPutaran(basis, { percakapanId, pertanyaan: "mediasi", hasil });

    const pesan = await pesanPercakapan(basis, percakapanId);
    expect(pesan).toHaveLength(2);
    expect(pesan[0].peran).toBe("pemakai");
    expect(pesan[1].dijawabOleh).toBe("pustaka");
    expect(pesan[1].usulan).toBe(false);
  });

  it("yang dicatat NAMA ruas yang keluar, bukan isinya", async () => {
    // Menyimpan isinya membuat salinan kedua data pribadi yang justru sedang
    // dijaga - di tabel yang lebih mudah dibaca daripada berkas aslinya.
    const basis = await basisData();
    const { panggil } = pemanggilPalsu();

    const percakapanId = await bukaPercakapan(basis, { perkaraId: "10501", nomorPerkara: "x", oleh: "aktor" });
    const hasil = await jawab(basis, {
      pertanyaan: "apa pun",
      fakta: { jenisPerkara: "Cerai Gugat", namaPenggugat: "Reka Febrianti" },
      ai: { menyala: true, sebab: "" },
      panggilModel: panggil,
    });
    await catatPutaran(basis, { percakapanId, pertanyaan: "apa pun", hasil });

    const pesan = await pesanPercakapan(basis, percakapanId);
    expect(pesan[1].ruasDikirim).toContain("namaPenggugat");

    const mentah = await basis.queryAll<Record<string, unknown>>(
      `SELECT ruas_dikirim FROM aleta_ai_pesan WHERE percakapan_id = ?`,
      [percakapanId]
    );
    expect(JSON.stringify(mentah)).not.toContain("Reka Febrianti");
  });

  it("urutan pesan bertambah, tidak menimpa", async () => {
    const basis = await basisData();
    const { panggil } = pemanggilPalsu();
    const percakapanId = await bukaPercakapan(basis, { perkaraId: "10501", nomorPerkara: "x", oleh: "aktor" });

    for (const tanya of ["satu", "dua"]) {
      const hasil = await jawab(basis, {
        pertanyaan: tanya,
        ai: { menyala: true, sebab: "" },
        panggilModel: panggil,
      });
      await catatPutaran(basis, { percakapanId, pertanyaan: tanya, hasil });
    }

    const pesan = await pesanPercakapan(basis, percakapanId);
    expect(pesan.map((item) => item.urutan)).toEqual([0, 1, 2, 3]);
  });
});

describe("fakta tertarik", () => {
  const NASKAH = "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Maret 2015 di Kantor Urusan Agama.";

  it("hanya fakta yang lolos pemeriksaan kutipan yang tersimpan", async () => {
    const basis = await basisData();
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah", "tempatNikah"],
      dariModel: [
        { nama: "tanggalNikah", nilai: "12 Maret 2015", kutipan: "menikah pada tanggal 12 Maret 2015" },
        { nama: "tempatNikah", nilai: "Palu", kutipan: "menikah di Kota Palu pada tahun itu" },
      ],
    });

    const tersimpan = await simpanFakta(basis, {
      perkaraId: "10501",
      sumberBerkas: "gugatan.pdf",
      hasil,
      oleh: "aktor",
      penyedia: "p",
      model: "m",
    });

    expect(tersimpan).toBe(1);
    const fakta = await faktaPerkara(basis, "10501");
    expect(fakta.map((item) => item.nama)).toEqual(["tanggalNikah"]);
    expect(fakta[0].kutipan).toContain("12 Maret 2015");
  });

  it("fakta tersimpan berkeadaan BELUM disahkan", async () => {
    // Sebelum ditegaskan, ia hanya bacaan model - belum boleh dipakai
    // pemeriksaan perkara maupun perakit putusan.
    const basis = await basisData();
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah"],
      dariModel: [{ nama: "tanggalNikah", nilai: "12 Maret 2015", kutipan: "menikah pada tanggal 12 Maret 2015" }],
    });
    await simpanFakta(basis, { perkaraId: "10501", sumberBerkas: "", hasil, oleh: "a", penyedia: "", model: "" });

    const fakta = await faktaPerkara(basis, "10501");
    expect(fakta[0].disahkan).toBe(false);

    expect((await sahkanFakta(basis, { faktaId: fakta[0].id, olehNama: "  " })).ok).toBe(false);
    expect((await sahkanFakta(basis, { faktaId: fakta[0].id, olehNama: "Panitera Ali" })).ok).toBe(true);
    expect((await faktaPerkara(basis, "10501"))[0].disahkan).toBe(true);
  });
});

describe("usulan butir masuk pustaka sebagai usulan", () => {
  const JANGKAR = new Set(["uu-1-1974/pasal-39"]);

  it("alinea layak masuk berkeadaan usulan, bukan disahkan", async () => {
    const basis = await basisData();
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa berdasarkan Pasal 39 Undang-Undang Nomor 1 tahun 1974, maka;", isu: "pokok" },
      JANGKAR
    );
    const hasil = await usulkanButirKePustaka(basis, {
      usulan,
      jenisPerkara: "Cerai Gugat",
      penyedia: "penyedia-uji",
      model: "model-uji",
    });
    expect(hasil.ok).toBe(true);

    const baris = await basis.queryOne<Record<string, unknown>>(
      `SELECT keadaan, dibuat_oleh FROM aleta_pertimbangan_butir WHERE id = ?`,
      [hasil.butirId]
    );
    expect(String(baris?.keadaan)).toBe("usulan");
    // Asalnya dicatat: yang mengesahkan berhak tahu kalimat ini tidak pernah
    // ditulis hakim mana pun.
    expect(String(baris?.dibuat_oleh)).toContain("model:");
  });

  it("usulan yang kutipannya tidak terbukti DITOLAK masuk", async () => {
    const basis = await basisData();
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa berdasarkan Pasal 99 Undang-Undang Nomor 1 tahun 1974;" },
      JANGKAR
    );
    const hasil = await usulkanButirKePustaka(basis, {
      usulan,
      jenisPerkara: "Cerai Gugat",
      penyedia: "",
      model: "",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("tidak ditemukan di pustaka");

    const jumlah = await basis.queryAll(`SELECT id FROM aleta_pertimbangan_butir`);
    expect(jumlah).toHaveLength(0);
  });

  it("alinea yang bunyinya sudah ada tidak ditambahkan lagi", async () => {
    // Pustaka dikunci pada sidik alinea; usulan kembar akan disahkan dua kali.
    const basis = await basisData();
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa berdasarkan Pasal 39 Undang-Undang Nomor 1 tahun 1974, maka;" },
      JANGKAR
    );
    const pertama = await usulkanButirKePustaka(basis, { usulan, jenisPerkara: "Cerai Gugat", penyedia: "", model: "" });
    const kedua = await usulkanButirKePustaka(basis, { usulan, jenisPerkara: "Cerai Gugat", penyedia: "", model: "" });

    expect(pertama.ok).toBe(true);
    expect(kedua.ok).toBe(false);
    expect(kedua.butirId).toBe(pertama.butirId);
    expect(await basis.queryAll(`SELECT id FROM aleta_pertimbangan_butir`)).toHaveLength(1);
  });

  it("rujukannya ikut tersimpan, sehingga J1 memperlakukannya sama dengan butir hakim", async () => {
    const basis = await basisData();
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa berdasarkan Pasal 39 Undang-Undang Nomor 1 tahun 1974, maka;" },
      JANGKAR
    );
    const hasil = await usulkanButirKePustaka(basis, { usulan, jenisPerkara: "Cerai Gugat", penyedia: "", model: "" });

    const rujukan = await basis.queryAll<Record<string, unknown>>(
      `SELECT jangkar FROM aleta_pertimbangan_rujukan WHERE butir_id = ?`,
      [hasil.butirId]
    );
    expect(rujukan.map((item) => String(item.jangkar))).toContain("uu-1-1974/pasal-39");
  });
});

describe("saklar mati tersimpan dan berlaku (I6)", () => {
  const KONTEKS = { peran: "hakim", perkaraId: "10601" };

  it("tanpa saklar, keadaannya mengikuti setelan global", async () => {
    const basis = await basisData();
    expect((await keadaanAi(basis, KONTEKS, true)).menyala).toBe(true);
    expect((await keadaanAi(basis, KONTEKS, false)).menyala).toBe(false);
  });

  it("saklar perkara mati menghentikan perkara itu saja", async () => {
    const basis = await basisData();
    await simpanSaklar(basis, {
      lingkup: "perkara",
      kunci: "10601",
      menyala: false,
      alasan: "para pihak dikenal luas",
      oleh: "Dra. Siti Zubaidah, M.H.",
    });

    const dimatikan = await keadaanAi(basis, KONTEKS, true);
    expect(dimatikan.menyala).toBe(false);
    expect(dimatikan.sebab).toContain("para pihak dikenal luas");

    expect((await keadaanAi(basis, { peran: "hakim", perkaraId: "10999" }, true)).menyala).toBe(true);
  });

  it("mematikan tanpa alasan DITOLAK, dan tidak menyisakan baris apa pun", async () => {
    const basis = await basisData();
    const hasil = await simpanSaklar(basis, {
      lingkup: "perkara",
      kunci: "10601",
      menyala: false,
      alasan: "",
      oleh: "Hakim A",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("beralasan");
    // Penolakannya terjadi sebelum menyentuh basis data - saklar setengah
    // tersimpan tanpa alasan akan mematikan AI tanpa ada yang tahu mengapa.
    expect(await basis.queryAll(`SELECT id FROM aleta_ai_saklar`)).toHaveLength(0);
  });

  it("saklar ditimpa, bukan ditumpuk", async () => {
    // Dua baris yang bertentangan untuk satu kunci membuat keadaan AI
    // bergantung urutan baca, dan urutan baca tidak pernah diputuskan siapa pun.
    const basis = await basisData();
    await simpanSaklar(basis, { lingkup: "perkara", kunci: "10601", menyala: false, alasan: "a", oleh: "X" });
    await simpanSaklar(basis, { lingkup: "perkara", kunci: "10601", menyala: true, alasan: "", oleh: "X" });

    const baris = await basis.queryAll(`SELECT id FROM aleta_ai_saklar WHERE kunci = '10601'`);
    expect(baris).toHaveLength(1);
    expect((await keadaanAi(basis, KONTEKS, true)).menyala).toBe(true);
  });

  it("saklar pengadilan mati tidak dapat dinyalakan saklar perkara", async () => {
    const basis = await basisData();
    await simpanSaklar(basis, {
      lingkup: "pengadilan",
      kunci: "",
      menyala: false,
      alasan: "menunggu keputusan pimpinan",
      oleh: "Ketua",
    });
    await simpanSaklar(basis, { lingkup: "perkara", kunci: "10601", menyala: true, alasan: "", oleh: "Hakim" });

    const hasil = await keadaanAi(basis, KONTEKS, true);
    expect(hasil.menyala).toBe(false);
    expect(hasil.dimatikanOleh).toBe("pengadilan");
  });

  it("saklar mati benar-benar menghentikan pemanggilan model", async () => {
    // Inilah yang membedakan saklar dari tampilan: bukan jawabannya yang
    // berubah, melainkan modelnya tidak tersentuh sama sekali.
    const basis = await basisData();
    await simpanSaklar(basis, {
      lingkup: "perkara",
      kunci: "10601",
      menyala: false,
      alasan: "perkara disorot",
      oleh: "Hakim",
    });
    const { catatan, panggil } = pemanggilPalsu();
    const saklar = await keadaanAi(basis, KONTEKS, true);

    const hasil = await jawab(basis, {
      pertanyaan: "apa pun",
      ai: { menyala: saklar.menyala, sebab: saklar.sebab },
      panggilModel: panggil,
    });

    expect(catatan.dipanggil).toBe(0);
    expect(hasil.jawaban.dijawabOleh).toBe("tidakDijawab");
    expect(hasil.jawaban.peringatan.join(" ")).toContain("perkara disorot");
  });
});
