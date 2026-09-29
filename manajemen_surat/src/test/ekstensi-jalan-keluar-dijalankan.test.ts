/**
 * ============================================================================
 * JALAN KELUAR PANEL - DIJALANKAN, BUKAN DIBACA
 * ============================================================================
 *
 * Penjaga teks mentah di berkas lain menahan kode agar tidak hilang; ia tidak
 * dapat menjawab pertanyaan yang sesungguhnya diajukan petugas: "kalau saya
 * menekan Escape sekarang, panelnya menciut atau tidak?"
 *
 * Berkas ini menjawabnya dengan menjalankan fungsinya di atas DOM sungguhan:
 * panel dipasang, fokus ditaruh di tempat yang benar-benar biasa - kolom
 * borang SIPP - lalu tombolnya ditekan, dan hasilnya dihitung.
 *
 * Empat keadaan yang dibedakan, dan keempatnya nyata di hari kerja:
 *
 *   fokus di kolom borang HALAMAN     menciut  (inilah yang dahulu gagal)
 *   fokus di kotak isian DALAM panel  TIDAK    (Escape membatalkan suntingan)
 *   tingkap SIPP sedang terbuka       TIDAK    (Escape menutup tingkap itu)
 *   panel sudah dibuang               TIDAK, dan pendengarnya ikut dilepas
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const alat = readFileSync(path.join(AKAR, "ekstensi-sipp/panel-alat.js"), "utf8").replace(/\r\n/g, "\n");

/**
 * Memotong fungsi puncak dari sumbernya - bentuk yang sama dengan
 * panel-kembar-setara.test.ts. Bersandar pada satu hal yang benar di berkas
 * itu: fungsi puncak dibuka di kolom nol dan ditutup "}" di kolom nol juga.
 */
function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();

  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }

  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

type Perkakas = {
  alatPasangJalanKeluar: (panel: Element, kunci: string, opsi?: { ciutkan?: () => void }) => void;
};

/** Keadaan lingkup modul yang dipakai jalan keluar - dibaca dari sumbernya. */
function potongKeadaan(): string {
  const baris = ["const alatDaftarKeluar =", "let alatKeluarTerpasang ="].map((awalan) => {
    const cocok = alat.split("\n").find((b) => b.startsWith(awalan));
    if (!cocok) throw new Error(`keadaan tidak ditemukan: ${awalan}`);
    return cocok;
  });
  return baris.join("\n");
}

function muatPerkakas(catat: string[]): Perkakas {
  const sumber = potongFungsi(alat, [
    "alatTingkapHalamanTerbuka",
    "alatPanelKeluarHidup",
    "alatPasangJalanKeluar",
  ]);
  const buat = new Function(
    "alatCiutkan",
    `${potongKeadaan()}\n${sumber}\nreturn { alatPasangJalanKeluar, alatTingkapHalamanTerbuka };`
  );
  return buat((_panel: Element, kunci: string) => catat.push(`alatCiutkan:${kunci}`)) as Perkakas;
}

/** jsdom tidak pernah menghitung tata letak; tingkap yang "terbuka" dipalsukan. */
function tampakkan(el: Element, tampak: boolean) {
  Object.defineProperty(el, "getClientRects", {
    configurable: true,
    value: () => (tampak ? [{ width: 300, height: 200 }] : []),
  });
}

describe("Escape dan klik ganda di luar panel", () => {
  let catat: string[];
  let perkakas: Perkakas;
  let panel: HTMLElement;
  let isianPanel: HTMLInputElement;
  let isianHalaman: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    catat = [];
    perkakas = muatPerkakas(catat);

    panel = document.createElement("div");
    panel.className = "aleta-panel";
    isianPanel = document.createElement("input");
    panel.appendChild(isianPanel);
    document.body.appendChild(panel);

    isianHalaman = document.createElement("input");
    isianHalaman.name = "tgl_nikah";
    document.body.appendChild(isianHalaman);

    perkakas.alatPasangJalanKeluar(panel, "posisiPanel");
  });

  const tekanEscape = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  };

  const klikGanda = (sasaran: Element) => {
    sasaran.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  };

  it("menciut walau fokus sedang di kolom blangko HALAMAN", () => {
    // Inilah yang dahulu gagal, dan sebabnya bukan pendengar yang hilang
    // melainkan syarat yang hampir selalu terpenuhi: SIPP dan ABT halaman
    // borang dari ujung ke ujung.
    isianHalaman.focus();
    expect(document.activeElement).toBe(isianHalaman);
    tekanEscape();
    expect(catat).toEqual(["alatCiutkan:posisiPanel"]);
  });

  it("TIDAK menciut bila yang berfokus kotak isian di dalam panel", () => {
    // Di sana Escape membatalkan suntingan; merebutnya berarti menutup panel
    // sekaligus membuang ketikan orang.
    isianPanel.focus();
    tekanEscape();
    expect(catat).toEqual([]);
  });

  it("TIDAK menciut selama tingkap SIPP terbuka", () => {
    const tingkap = document.createElement("div");
    tingkap.id = "popup_form";
    document.body.appendChild(tingkap);
    tampakkan(tingkap, true);

    tekanEscape();
    expect(catat).toEqual([]);

    // Tingkapnya ditutup - Escape kembali menjadi milik panel.
    tampakkan(tingkap, false);
    tekanEscape();
    expect(catat).toEqual(["alatCiutkan:posisiPanel"]);
  });

  it("klik ganda DI LUAR menciutkan, DI DALAM tidak", () => {
    klikGanda(panel);
    expect(catat).toEqual([]);

    klikGanda(isianHalaman);
    expect(catat).toEqual(["alatCiutkan:posisiPanel"]);
  });

  it("klik ganda tetap sampai walau halaman menghentikan gelembungnya", () => {
    // SIPP dan ABT keduanya halaman jQuery yang memasang pendengarnya sendiri
    // di mana-mana. Pendengar yang menghentikan gelembung membuat klik ganda
    // tidak pernah sampai ke document - tanpa satu pun tanda bahwa ia
    // dihentikan. Karena itu pendengar panel berdiri di fase TANGKAP.
    isianHalaman.addEventListener("dblclick", (p) => p.stopPropagation());
    klikGanda(isianHalaman);
    expect(catat).toEqual(["alatCiutkan:posisiPanel"]);
  });

  it("ciutkan milik pemanggil dipakai bila disediakan - panel SIPP memakainya", () => {
    const panelSipp = document.createElement("div");
    document.body.appendChild(panelSipp);
    perkakas.alatPasangJalanKeluar(panelSipp, "posisiPanel", {
      ciutkan: () => catat.push("ciutkanKeLencana"),
    });

    tekanEscape();
    // Panel pertama memakai alatCiutkan, panel SIPP memakai miliknya sendiri.
    expect(catat).toContain("ciutkanKeLencana");
    expect(catat).toContain("alatCiutkan:posisiPanel");
  });

  it("panel yang sudah dibuang DIKELUARKAN dari daftar, tidak sekadar diam", () => {
    // Panel SIPP digambar ULANG tiap kali tingkap SIPP terbuka atau tertutup,
    // dan tiap penggambaran melahirkan panel baru. Yang lama harus benar-benar
    // keluar; yang hanya diam menumpuk di dokumen yang sama sepanjang hari.
    tekanEscape();
    expect(catat).toEqual(["alatCiutkan:posisiPanel"]);
    catat.length = 0;

    panel.remove();
    tekanEscape();
    expect(catat).toEqual([]);

    // Dibuktikan benar-benar KELUAR: yang hanya didiamkan akan hidup lagi
    // seandainya panelnya ditempelkan kembali.
    document.body.appendChild(panel);
    tekanEscape();
    expect(catat).toEqual([]);
  });

  it("pendengarnya satu pasang seumur halaman, berapa pun panelnya", () => {
    // Inilah sebab daftar ini ada. Diukur pada document yang sama: memasang
    // jalan keluar untuk lima panel tidak menambah satu pun pendengar.
    const asli = document.addEventListener.bind(document);
    let jumlah = 0;
    document.addEventListener = ((jenis: string, fn: EventListener, opsi?: unknown) => {
      if (jenis === "keydown" || jenis === "dblclick") jumlah += 1;
      return asli(jenis, fn, opsi as boolean);
    }) as typeof document.addEventListener;

    try {
      const perkakasBaru = muatPerkakas(catat);
      for (let i = 0; i < 5; i += 1) {
        const p = document.createElement("div");
        document.body.appendChild(p);
        perkakasBaru.alatPasangJalanKeluar(p, `panel-${i}`);
      }
      expect(jumlah).toBe(2);
    } finally {
      document.addEventListener = asli as typeof document.addEventListener;
    }
  });

  it("panel yang BELUM sempat ditempelkan tidak ikut dikeluarkan", () => {
    // alatPasangPanel memasang jalan keluar SEBELUM panelnya ditempelkan ke
    // body (lihat susunPanelAbt). Mengeluarkannya begitu isConnected berkata
    // false berarti membunuhnya di dalam kandungan.
    const belum = document.createElement("div");
    perkakas.alatPasangJalanKeluar(belum, "posisiPanelAbt");

    tekanEscape();
    expect(catat).toEqual(["alatCiutkan:posisiPanel"]);

    catat.length = 0;
    document.body.appendChild(belum);
    tekanEscape();
    expect(catat).toContain("alatCiutkan:posisiPanelAbt");
  });
});
