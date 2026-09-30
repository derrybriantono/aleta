import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { adalahGangguan, jenisGangguan, pesanGangguan } from "@/lib/pesan-gangguan";

/**
 * Pesan gangguan di halaman masuk.
 *
 * Yang dijaga: tidak satu pun kalimat teknis sampai ke layar petugas, dan
 * kesalahan yang MEMANG kesalahan penggunanya tetap disampaikan apa adanya.
 *
 * Yang paling merugikan bila rusak: gangguan layanan yang terbaca seperti
 * "kata sandi salah". Petugas lalu mencoba berulang kali sampai akunnya
 * terkunci, dan yang sesungguhnya rusak tidak pernah dilaporkan.
 */
describe("menggolongkan kegagalan", () => {
  it("Failed to fetch berarti ALETA tidak terjangkau", () => {
    expect(jenisGangguan(new Error("Failed to fetch"))).toBe("tidak-terjangkau");
    expect(jenisGangguan("TypeError: NetworkError when attempting to fetch resource.")).toBe(
      "tidak-terjangkau"
    );
    expect(jenisGangguan({ message: "Load failed" })).toBe("tidak-terjangkau");
  });

  it("503 dan kalimat basis data berarti layanan datanya mati", () => {
    expect(jenisGangguan(new Error("apa pun"), 503)).toBe("basis-data");
    expect(jenisGangguan(new Error("Connection terminated unexpectedly"))).toBe("basis-data");
    expect(jenisGangguan(new Error("password authentication failed for user"))).toBe("basis-data");
  });

  it("500 tanpa ciri lain berarti gangguan server", () => {
    expect(jenisGangguan(new Error("Internal Server Error"), 500)).toBe("peladen");
  });

  it("kata sandi yang keliru BUKAN gangguan", () => {
    expect(jenisGangguan(new Error("Invalid password"), 401)).toBe("bukan-gangguan");
    expect(jenisGangguan({ message: "Akun tidak ditemukan atau sudah tidak aktif." }, 404)).toBe(
      "bukan-gangguan"
    );
    expect(adalahGangguan(new Error("Invalid password"), 401)).toBe(false);
  });

  it("membaca pesan dari bentuk jawaban rute portal", () => {
    expect(jenisGangguan({ error: { message: "ECONNREFUSED 127.0.0.1:54330" } })).toBe(
      "tidak-terjangkau"
    );
  });
});

describe("kalimat yang sampai ke layar", () => {
  const semuaGangguan = [
    pesanGangguan(new Error("Failed to fetch"), "cadangan"),
    pesanGangguan(new Error("x"), "cadangan", 503),
    pesanGangguan(new Error("x"), "cadangan", 500),
  ];

  it("tidak memuat satu pun istilah teknis", () => {
    for (const pesan of semuaGangguan) {
      for (const istilah of [
        "fetch",
        "database",
        "postgres",
        "econnrefused",
        "network",
        "server lokal",
        "restart",
        "error",
        "500",
        "503",
      ]) {
        expect(pesan.toLowerCase(), istilah).not.toContain(istilah);
      }
    }
  });

  it("menyebut bahwa ini bukan kesalahan yang membacanya", () => {
    // Tanpa kalimat ini, petugas mencoba berulang kali sampai akunnya terkunci.
    for (const pesan of semuaGangguan) {
      expect(pesan.toLowerCase()).toContain("bukan");
    }
  });

  it("menyebut apa yang dapat dilakukan sekarang", () => {
    for (const pesan of semuaGangguan) {
      expect(pesan.toLowerCase()).toMatch(/coba lagi|hubungi/);
    }
  });

  it("kesalahan biasa diteruskan apa adanya", () => {
    expect(pesanGangguan(new Error("Password tidak sesuai"), "Password tidak sesuai", 401)).toBe(
      "Password tidak sesuai"
    );
  });
});

describe("halaman masuk benar-benar memakainya", () => {
  // Akhiran baris dinormalkan: berkas ini bergaya CRLF, dan uji yang memaku
  // bentuk kode tidak boleh ikut memaku gaya akhiran barisnya.
  const login = () =>
    readFileSync(path.resolve(process.cwd(), "src/app/login/page.tsx"), "utf8").split("\r\n").join("\n");

  it("penangkap error terakhir melewatkan pesannya lewat penerjemah", () => {
    // Di sinilah "Failed to fetch" dulu sampai ke layar apa adanya.
    const isi = login();
    expect(isi).toContain("setError(" + "\n        pesanGangguan(");
    expect(isi).toContain('import { adalahGangguan, pesanGangguan } from "@/lib/pesan-gangguan";');
  });

  it("pesan aslinya tetap dicatat untuk yang memperbaikinya", () => {
    expect(login()).toContain('globalThis.console?.error?.("[ALETA LOGIN]", loginError);');
  });
});
