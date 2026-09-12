// @vitest-environment node

import { describe, expect, it } from "vitest";

import { alamatDenganDomisili, rapikanAlamat, surelDariGugatan } from "@/lib/alamat-pihak";

/**
 * Alamat para pihak.
 *
 * Yang dijaga di sini bukan kerapian melainkan AKIBATNYA: alamat ini tercetak
 * pada relaas panggilan, pada identitas para pihak di kepala putusan, dan pada
 * akta cerai. Relaas yang alamatnya tidak lengkap dikembalikan juru sita, dan
 * panggilan yang gagal menunda sidang satu putaran penuh.
 *
 * Dan satu batas yang tidak boleh dilanggar: tidak satu pun NAMA TEMPAT boleh
 * ditambahkan dari luar. Alamat yang dilengkapi mesin dengan nama yang tidak
 * pernah ditulis siapa pun adalah alamat yang salah, dan relaas yang dikirim
 * ke sana sampai ke rumah orang lain.
 */

describe("keterangan arah di dalam kurung", () => {
  it("dibuang, dan yang dibuang disebutkan", () => {
    const hasil = rapikanAlamat(
      "Desa Pelawa Baru (Sesudah SMA 1 Parigi Tengah), Kecamatan Parigi Tengah, Kabupaten Parigi Moutong, Provinsi Sulawesi Tengah"
    );
    expect(hasil.alamat).toBe(
      "Desa Pelawa Baru, Kecamatan Parigi Tengah, Kabupaten Parigi Moutong, Provinsi Sulawesi Tengah"
    );
    expect(hasil.perubahan.join(" ")).toContain("Sesudah SMA 1 Parigi Tengah");
  });

  it("mengenali berbagai bentuk petunjuk jalan", () => {
    for (const arah of [
      "(rumah sebelum Pekuburan Pani'i)",
      "(depan Masjid Nurul Iman)",
      "(samping kantor desa)",
      "(dekat Puskesmas)",
      "(masuk lorong 3)",
    ]) {
      const hasil = rapikanAlamat(`Desa Watatu ${arah}, Kecamatan Banawa Selatan`);
      expect(hasil.alamat, arah).toBe("Desa Watatu, Kecamatan Banawa Selatan");
    }
  });

  it("kurung yang BUKAN petunjuk jalan dibiarkan", () => {
    // "(Komplek BTN Lasoani)" adalah nama tempatnya sendiri. Membuangnya
    // menghapus bagian alamat yang justru menentukan.
    const hasil = rapikanAlamat("Jalan Merpati (Komplek BTN Lasoani), Kelurahan Lasoani");
    expect(hasil.alamat).toContain("(Komplek BTN Lasoani)");
  });
});

describe("spasi dan koma", () => {
  it("dirapikan tanpa mengubah isinya", () => {
    const hasil = rapikanAlamat("Desa  Watatu ,Kecamatan Banawa  Selatan,,Kabupaten Donggala,");
    expect(hasil.alamat).toBe("Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala");
  });

  it("alamat yang sudah rapi tidak dinyatakan berubah", () => {
    const rapi = "Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah";
    const hasil = rapikanAlamat(rapi);
    expect(hasil.alamat).toBe(rapi);
    expect(hasil.berubah).toBe(false);
    expect(hasil.perubahan).toEqual([]);
  });
});

describe("sebutan tingkatan yang lupa ditulis", () => {
  it("dilengkapi dari belakang - provinsi, kabupaten, kecamatan, desa", () => {
    const hasil = rapikanAlamat(
      "Pelawa Baru, Parigi Tengah, Kabupaten Parigi Moutong, Sulawesi Tengah"
    );
    expect(hasil.alamat).toBe(
      "Desa Pelawa Baru, Kecamatan Parigi Tengah, Kabupaten Parigi Moutong, Provinsi Sulawesi Tengah"
    );
    expect(hasil.kurang).toEqual([]);
  });

  it("tidak menambahkan sebutan kedua pada yang sudah bersebutan", () => {
    const hasil = rapikanAlamat("Kelurahan Lasoani, Kecamatan Mantikulore, Kota Palu");
    expect(hasil.alamat).not.toContain("Desa Kelurahan");
    expect(hasil.alamat).not.toContain("Kabupaten Kota Palu");
  });

  it("TIDAK mengarang nama tempat yang memang tidak ada", () => {
    // Inilah batas yang tidak boleh dilanggar. Alamat yang hanya menyebut tiga
    // tingkatan tetap tiga tingkatan; kekurangannya DIKATAKAN, bukan diisi.
    const hasil = rapikanAlamat("Banawa Selatan, Kabupaten Donggala, Sulawesi Tengah");
    expect(hasil.alamat).toBe(
      "Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
    expect(hasil.kurang).toEqual(["Desa"]);
    expect(hasil.alamat).not.toMatch(/Desa\s*,|Desa\s*$/);
  });

  it("dusun dan RT di depan tidak dikira nama wilayah", () => {
    const hasil = rapikanAlamat(
      "Dusun I, Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
    expect(hasil.alamat.startsWith("Dusun I,")).toBe(true);
    expect(hasil.alamat).not.toContain("Desa Dusun I");
  });

  it("alamat kosong tetap kosong, dan keempat tingkatannya dinyatakan kurang", () => {
    const hasil = rapikanAlamat("   ");
    expect(hasil.alamat).toBe("");
    expect(hasil.kurang).toEqual(["Desa", "Kecamatan", "Kabupaten", "Provinsi"]);
  });
});

describe("domisili elektronik dari gugatan", () => {
  const GUGATAN = [
    "PENGADILAN AGAMA DONGGALA",
    "Jalan Jenderal Sudirman Nomor 1, Donggala. Surel: pa.donggala@pa-donggala.go.id;",
    "Lilis Riningsih binti Sahrun, umur 33 tahun, agama Islam, bertempat tinggal di Dusun I, Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah, Domisili elektronik : lilisriningsih92@gmail.com, sebagai Penggugat;",
    "melawan",
    "Ahmad bin Salim, bertempat tinggal di Desa Loli, surel ahmad.salim@yahoo.co.id, sebagai Tergugat;",
  ].join("\n");

  it("memetik surel para pihak beserta kalimat asalnya", () => {
    const hasil = surelDariGugatan(GUGATAN);
    const surel = hasil.map((x) => x.surel);
    expect(surel).toContain("lilisriningsih92@gmail.com");
    expect(surel).toContain("ahmad.salim@yahoo.co.id");
    const lilis = hasil.find((x) => x.surel === "lilisriningsih92@gmail.com");
    expect(lilis?.asal).toContain("Lilis Riningsih");
  });

  it("surel pengadilan TIDAK ikut terpetik", () => {
    // Ia berdiri di kop surat dan bukan domisili elektronik siapa pun.
    // Menuliskannya ke SIPP berarti panggilan elektronik dikirim ke
    // pengadilan sendiri.
    const surel = surelDariGugatan(GUGATAN).map((x) => x.surel);
    expect(surel).not.toContain("pa.donggala@pa-donggala.go.id");
  });

  it("tidak memulangkan surel yang sama dua kali", () => {
    const dua = `${GUGATAN}\nSurat ini dikirim ke lilisriningsih92@gmail.com;`;
    const surel = surelDariGugatan(dua).filter((x) => x.surel === "lilisriningsih92@gmail.com");
    expect(surel).toHaveLength(1);
  });

  it("naskah tanpa surel memulangkan kosong, bukan menebak", () => {
    expect(surelDariGugatan("Penggugat bertempat tinggal di Desa Loli;")).toEqual([]);
  });
});

describe("alamat lengkap beserta domisilinya", () => {
  it("disusun seperti yang dituliskan SIPP", () => {
    expect(
      alamatDenganDomisili(
        "Dusun I, Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah",
        "lilisriningsih92@gmail.com"
      )
    ).toBe(
      "Dusun I, Desa Watatu, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah, Domisili elektronik : lilisriningsih92@gmail.com"
    );
  });

  it("tidak menambahkan domisili untuk kedua kalinya", () => {
    const sudah =
      "Desa Watatu, Kabupaten Donggala, Domisili elektronik : lilisriningsih92@gmail.com";
    expect(alamatDenganDomisili(sudah, "lain@contoh.com")).toBe(sudah);
  });

  it("tanpa surel, alamatnya dipulangkan apa adanya", () => {
    expect(alamatDenganDomisili("Desa Watatu", "")).toBe("Desa Watatu");
  });
});
