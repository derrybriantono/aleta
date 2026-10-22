"use strict";

/**
 * ============================================================================
 * FORM DATA PIHAK / KUASA SIPP - ALAMAT <-> WILAYAH, ISI DENGAN TAB, PENGINGAT
 * (22 Okt 2026, agen W50)
 * ============================================================================
 *
 * Dipasang pada dua blangko SIPP yang punya Alamat + dropdown bertingkat
 * Provinsi > Kabupaten/Kota > Kecamatan > Kelurahan/Desa:
 *
 *   form#frm_ref_pihak     "Tambah/Edit Referensi Data Pihak" (views/pihak/pihak_list.php)
 *                          #pihak_alamat + #prop #kab #kec #kel
 *   form#frm_ref_pengacara "Referensi Data Kuasa" (views/pengacara/pengacara_list.php)
 *                          #pengacara_alamat + #prop #kab #kec #kel
 *
 * Blangko saksi (form#frm_user) TIDAK dipasang: alamat dan wilayahnya readonly,
 * terisi dari [Cari] -> pilih referensi pihak di atas.
 *
 * A. ALAMAT -> DROPDOWN. Nama provinsi / kabupaten-kota / kecamatan / desa-
 *    kelurahan yang tertulis di alamat dikenali terhadap data wilayah SIPP
 *    (GET /aleta/api/aleta-ecourt/wilayah) lalu mengisi dropdown yang MASIH
 *    KOSONG, bertingkat dari atas. Yang sudah terisi tidak ditimpa. Nama ganda
 *    atau tidak ditemukan = tidak menebak.
 * B. DROPDOWN -> ALAMAT. Bagian wilayah yang BELUM tertulis ditambahkan di KANAN
 *    alamat: koma menempel di akhir teks, satu spasi, lalu nama; urut kecil ke
 *    besar (Desa/Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi):
 *      "Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala"
 *        -> "Jalan X Desa Dalaka Kecamatan Sindue Kabupaten Donggala, Provinsi Sulawesi Tengah"
 *    Kiri alamat (nama jalan) tidak pernah diubah.
 * C. ISI DENGAN TAB. Pada Alamat dan kolom Pekerjaan isian bebas ("Lain-Lain"),
 *    usulan bentuk LENGKAP dan BAKU tampil samar di bawah kolom; Tab
 *    menerimanya. Tab tanpa usulan = Tab biasa. Usulan berasal dari daftar
 *    baku, nilai yang sudah ada di tabel SIPP halaman itu (dibaca saja), dan
 *    nama wilayah SIPP.
 * D. PENGINGAT MERAH. Jenis identitas, nomor identitas, dan nomor telepon.
 *    Sumber aturan SAMA dengan penilaian bot (aleta_bot/services/
 *    sippTahapanService.js, saksiLengkapPerkaraBaru - "SK Tabel 2 I.12": tiga
 *    isian itu dihitung TERISI atau tidak). Bentuk NIK/KK dan nomor telepon
 *    sengaja tidak diperiksa (keputusan pengguna 22 Okt). Hanya mengingatkan -
 *    tidak pernah menahan tombol Simpan SIPP.
 *
 * TIDAK PERNAH: menekan Simpan; menimpa dropdown yang sudah terisi; mengubah
 * ketikan yang sedang berlangsung (kolom yang sedang difokus ditunda); menulis
 * kata "Aleta" ke nilai form SIPP (AletaPenjagaTanda bila ada).
 *
 * Berkas ini berdiri sendiri (bagian murni diuji tanpa DOM lewat
 * globalThis.AletaPihakLengkap).
 */
(function () {
  const WILAYAH_API = "/aleta/api/aleta-ecourt/wilayah";

  /* ─── 1. Bagian murni ─────────────────────────────────────────────────── */

  const TINGKAT = [
    { kunci: "provinsi", penunjuk: "#prop", kata: ["PROVINSI", "PROPINSI", "PROV", "PROP"] },
    { kunci: "kabupaten", penunjuk: "#kab", kata: ["KABUPATEN", "KAB", "KOTA"] },
    { kunci: "kecamatan", penunjuk: "#kec", kata: ["KECAMATAN", "KEC"] },
    { kunci: "kelurahan", penunjuk: "#kel", kata: ["KELURAHAN", "KEL", "DESA", "DS"] },
  ];
  /** Urutan di alamat: kecil ke besar. */
  const URUTAN_ALAMAT = ["kelurahan", "kecamatan", "kabupaten", "provinsi"];
  const TINGKAT_DARI = Object.fromEntries(TINGKAT.map((t, i) => [t.kunci, i]));

  /** Huruf besar, tanpa tanda baca dan diakritik, spasi tunggal. */
  function normal(teks) {
    return String(teks || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Nama wilayah tanpa awalan tingkat (Provinsi, Kab., Kota, Kecamatan, Kel., Desa). */
  function inti(nama) {
    return normal(nama).replace(/^(?:PROVINSI|PROPINSI|PROV|KABUPATEN|KAB|KOTA ADMINISTRASI|KOTA|KECAMATAN|KEC|KELURAHAN|KEL|DESA)\s+/, "");
  }

  /** "kota" | "kabupaten" | "" */
  function awalan(nama) {
    const t = normal(nama);
    if (/^KOTA\b/.test(t)) return "kota";
    if (/^(?:KABUPATEN|KAB)\b/.test(t)) return "kabupaten";
    return "";
  }

  const KECIL = new Set(["dan", "di", "ke", "dari", "yang", "atau", "untuk", "pada"]);
  const TETAP_BESAR = new Set([
    "RT", "RW", "KM", "BTN", "PT", "SD", "SMP", "SMA", "SMK", "TNI", "POLRI", "PLN", "BRI", "BNI", "DKI", "NTT", "NTB",
    "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "UPT", "BPN", "PNS", "CV", "UD", "TK", "KUA", "RSUD", "BUMN", "BUMD",
  ]);

  /** Huruf besar-kecil rapi per kata ("DESA LABUAN" -> "Desa Labuan"); singkatan baku tetap kapital. */
  function kapital(teks) {
    let awal = true;
    return String(teks || "")
      .split(/(\s+)/)
      .map((potong) => {
        if (!potong.trim()) return potong;
        const hasil = potong.replace(/[A-Za-zÀ-ÿ]+/g, (w, i) => {
          const besar = w.toUpperCase();
          if (TETAP_BESAR.has(besar)) return besar;
          if (!awal && i === 0 && KECIL.has(w.toLowerCase())) return w.toLowerCase();
          return besar.charAt(0) + w.slice(1).toLowerCase();
        });
        awal = false;
        return hasil;
      })
      .join("");
  }

  /** Singkatan alamat -> bentuk lengkap (hanya bila berdiri sebagai kata sendiri). */
  const SINGKATAN = {
    jl: "Jalan", jln: "Jalan", gg: "Gang", ds: "Desa", dsn: "Dusun", kel: "Kelurahan", kec: "Kecamatan", kab: "Kabupaten",
    prov: "Provinsi", prop: "Provinsi", propinsi: "Provinsi", kp: "Kampung", perum: "Perumahan", komp: "Kompleks",
    kompl: "Kompleks", lrg: "Lorong",
  };

  /** RT/RW ditulis rapi: "rt.02/rw.03", "RT 02 RW 03", "RT/RW 02/03" -> "RT 02/RW 03". */
  function rapikanRtRw(teks) {
    return String(teks || "")
      .replace(/\bRT\s*\.?\s*\/\s*RW\s*\.?\s*:?\s*(\d{1,3})\s*[\/-]\s*(\d{1,3})\b/gi, "RT $1/RW $2")
      .replace(/\bRT\s*\.?\s*:?\s*(\d{1,3})\s*[\/,-]?\s*RW\s*\.?\s*:?\s*(\d{1,3})\b/gi, "RT $1/RW $2")
      .replace(/\bRT\s*\.?\s*:?\s*(\d{1,3})\b/gi, "RT $1")
      .replace(/\bRW\s*\.?\s*:?\s*(\d{1,3})\b/gi, "RW $1");
  }

  /** Alamat dalam bentuk baku: singkatan dipanjangkan, huruf rapi, RT/RW rapi, koma rapi. */
  function bakuAlamat(teks) {
    let t = String(teks || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    t = t
      .split(/(\s+)/)
      .map((potong) => {
        const m = /^([^A-Za-z0-9]*)([A-Za-z]+)(\.?)([^A-Za-z0-9]*)$/.exec(potong);
        if (!m) return potong;
        const panjang = SINGKATAN[m[2].toLowerCase()];
        return panjang ? `${m[1]}${panjang}${m[4]}` : potong;
      })
      .join("");
    t = rapikanRtRw(t);
    t = t.replace(/\s*,\s*/g, ", ").replace(/,\s*,/g, ",").replace(/\s+/g, " ");
    return kapital(t).trim();
  }

  const PEKERJAAN_BAKU = [
    "Wiraswasta", "Petani", "Nelayan", "Karyawan Swasta", "Karyawan Honorer", "Mengurus Rumah Tangga", "Buruh Harian Lepas",
    "Buruh Tani", "Pedagang", "Pelajar/Mahasiswa", "Pensiunan", "Sopir", "Tukang Ojek", "Tukang Batu", "Tukang Kayu",
    "Guru Honorer", "Perangkat Desa", "Bidan", "Perawat", "Belum/Tidak Bekerja",
  ];
  const PEKERJAAN_ALIAS = {
    IRT: "Mengurus Rumah Tangga",
    "IBU RUMAH TANGGA": "Mengurus Rumah Tangga",
    "RUMAH TANGGA": "Mengurus Rumah Tangga",
    SWASTA: "Karyawan Swasta",
    WIRASWASTA: "Wiraswasta",
    TANI: "Petani",
    "PETANI PEKEBUN": "Petani",
    BURUH: "Buruh Harian Lepas",
    "TIDAK BEKERJA": "Belum/Tidak Bekerja",
    "BELUM BEKERJA": "Belum/Tidak Bekerja",
    PELAJAR: "Pelajar/Mahasiswa",
    MAHASISWA: "Pelajar/Mahasiswa",
    HONORER: "Karyawan Honorer",
  };

  /**
   * Usulan pekerjaan: { unik, pilihan }. `unik` bila tepat satu bentuk baku
   * cocok (atau alias persis); `pilihan` bila beberapa (daftar kecil, Tab
   * tidak menerima apa pun). `ada` = nilai yang sudah ada di SIPP halaman ini.
   */
  function saranPekerjaan(teks, ada) {
    const ketik = String(teks || "").trim();
    const n = normal(ketik);
    if (n.length < 2) return { unik: "", pilihan: [] };
    const baku = new Map();
    for (const p of PEKERJAAN_BAKU) baku.set(normal(p), p);
    for (const a of ada || []) {
      const k = normal(a);
      // Nilai SIPP yang sama dengan bentuk baku memakai ejaan bakunya.
      if (k && !baku.has(k) && k.length >= 3) baku.set(k, kapital(String(a).trim()));
    }
    if (PEKERJAAN_ALIAS[n]) {
      const hasil = PEKERJAAN_ALIAS[n];
      return { unik: hasil === ketik ? "" : hasil, pilihan: [] };
    }
    if (baku.has(n)) {
      const hasil = baku.get(n);
      return { unik: hasil === ketik ? "" : hasil, pilihan: [] };
    }
    const cocok = [...baku.entries()].filter(([k]) => k.startsWith(n));
    if (cocok.length === 1) return { unik: cocok[0][1], pilihan: [] };
    return { unik: "", pilihan: cocok.slice(0, 5).map(([, v]) => v) };
  }

  /**
   * Usulan alamat: lengkapi frasa terakhir yang baru separuh diketik dari
   * kosakata (nama wilayah SIPP dan alamat lain di halaman), lalu bakukan.
   * "" bila tidak ada yang perlu diubah.
   */
  function saranAlamat(teks, kosakata) {
    const asli = String(teks || "");
    if (!asli.trim()) return "";
    let kerja = asli.replace(/\s+$/, "");
    if (!/[\s,]$/.test(asli)) {
      const lengkap = lengkapiEkor(kerja, kosakata || []);
      if (lengkap) kerja = lengkap;
    }
    const hasil = bakuAlamat(kerja);
    return hasil && hasil !== asli.replace(/\s+$/, "") ? hasil : "";
  }

  /**
   * Frasa terakhir (1-3 kata) yang baru separuh diketik: bila TEPAT SATU kelompok awalan kosakata
   * cocok, kata terakhir itu dilengkapi (hanya sebanyak kata yang sedang diketik - sisa alamat orang
   * lain, mis. nomor rumahnya, tidak ikut). "" bila tidak yakin.
   */
  function lengkapiEkor(teks, kosakata) {
    const kata = teks.split(/\s+/);
    for (let panjang = Math.min(3, kata.length); panjang >= 1; panjang -= 1) {
      const ekor = normal(kata.slice(-panjang).join(" "));
      if (ekor.length < 3) continue;
      const kelompok = new Map();
      for (const frasa of kosakata) {
        const mentah = String(frasa || "").trim().split(/\s+/);
        if (mentah.length < panjang) continue;
        const awal = mentah.slice(0, panjang).join(" ").replace(/[,;.]+$/, "");
        const k = normal(awal);
        if (k.length >= 3 && k.startsWith(ekor) && k !== ekor && !kelompok.has(k)) kelompok.set(k, awal);
      }
      if (kelompok.size === 1) return `${kata.slice(0, -panjang).join(" ")} ${kapital([...kelompok.values()][0])}`.trim();
      if (kelompok.size > 1) return "";
    }
    return "";
  }

  /** Sebutan desa/kelurahan menurut kode wilayah SIPP: ruas keempat 1xxx = Kelurahan, 2xxx = Desa. */
  function sebutanDesa(kode) {
    const akhir = String(kode || "").split(".")[3] || "";
    if (akhir.startsWith("1")) return "Kelurahan";
    if (akhir.startsWith("2")) return "Desa";
    return "";
  }

  function labelBagian(kunci, nama, sebutan) {
    const bersih = String(nama || "").trim();
    if (!bersih) return "";
    const nama2 = kapital(
      bersih
        .replace(/^(?:provinsi|propinsi|prov\.?|kabupaten|kab\.?|kota administrasi|kota|kecamatan|kec\.?|kelurahan|kel\.?|desa)\s+/i, "")
        .toLowerCase()
    );
    if (kunci === "provinsi") return `Provinsi ${nama2}`;
    if (kunci === "kecamatan") return `Kecamatan ${nama2}`;
    if (kunci === "kabupaten") {
      const a = awalan(bersih);
      return a === "kota" ? `Kota ${nama2}` : a === "kabupaten" ? `Kabupaten ${nama2}` : nama2;
    }
    return sebutan ? `${sebutan} ${nama2}` : nama2;
  }

  /** Kata-kata alamat (normal) dan, untuk tiap kemunculan nama, apakah didahului kata tingkatnya. */
  function kemunculan(kataAlamat, intiNama, kataTingkat, terpakai) {
    const n = intiNama.split(" ");
    const hasil = [];
    for (let i = 0; i + n.length <= kataAlamat.length; i += 1) {
      if (terpakai && terpakai.slice(i, i + n.length).some(Boolean)) continue;
      let sama = true;
      for (let j = 0; j < n.length; j += 1) {
        if (kataAlamat[i + j] !== n[j]) {
          sama = false;
          break;
        }
      }
      if (!sama) continue;
      hasil.push({ mulai: i, panjang: n.length, kunci: i > 0 && kataTingkat.includes(kataAlamat[i - 1]) ? kataAlamat[i - 1] : "" });
    }
    return hasil;
  }

  /**
   * Alamat + bagian dropdown yang terisi -> alamat dengan bagian yang BELUM
   * tertulis ditambahkan di kanan (", Provinsi Sulawesi Tengah"). bagian =
   * { kelurahan:{nama, sebutan}, kecamatan:{nama}, kabupaten:{nama}, provinsi:{nama} }.
   * Mengembalikan alamat yang sama persis bila tak ada yang kurang.
   */
  function tambahanAlamat(alamat, bagian) {
    const asli = String(alamat || "");
    const b = bagian || {};
    const aktif = URUTAN_ALAMAT.filter((k) => b[k] && inti(b[k].nama));
    if (!aktif.length) return asli;
    const kata = normal(asli).split(" ").filter(Boolean);
    const terpakai = kata.map(() => false);
    const kurang = [];
    for (const k of aktif) {
      const kataTingkat = TINGKAT[TINGKAT_DARI[k]].kata;
      const ada = kemunculan(kata, inti(b[k].nama), kataTingkat, terpakai);
      const pilih = ada.find((x) => x.kunci) || ada[0];
      if (pilih) {
        for (let i = pilih.mulai; i < pilih.mulai + pilih.panjang; i += 1) terpakai[i] = true;
      } else {
        kurang.push(k);
      }
    }
    if (!kurang.length) return asli;

    // Ekor yang sudah berupa bagian wilayah terpilih (hasil tambahan sebelumnya) ikut diurutkan ulang.
    const potong = asli.replace(/[\s,;]+$/, "");
    const segmen = potong ? potong.split(",") : [];
    const ekor = [];
    while (segmen.length > 1) {
      const s = segmen[segmen.length - 1].trim();
      const ns = normal(s).split(" ");
      const k = aktif.find((x) => {
        const sisa = ns.length > 1 && TINGKAT[TINGKAT_DARI[x]].kata.includes(ns[0]) ? ns.slice(1).join(" ") : ns.join(" ");
        return sisa === inti(b[x].nama);
      });
      if (!k) break;
      ekor.unshift({ k, teks: s });
      segmen.pop();
    }
    const butir = ekor.slice();
    for (const k of kurang) butir.push({ k, teks: labelBagian(k, b[k].nama, b[k].sebutan) });
    butir.sort((x, y) => URUTAN_ALAMAT.indexOf(x.k) - URUTAN_ALAMAT.indexOf(y.k));
    const kepala = segmen.join(",").replace(/[\s,;]+$/, "").trim();
    return kepala ? kepala + butir.map((x) => `, ${x.teks}`).join("") : butir.map((x) => x.teks).join(", ");
  }

  function cocokTepat(nama, data) {
    const n = inti(nama);
    if (!n) return null;
    let calon = data.filter((w) => inti(w.nama) === n);
    const a = awalan(nama);
    if (a && calon.length > 1) calon = calon.filter((w) => awalan(w.nama) === a);
    return calon.length === 1 ? calon[0] : null;
  }

  /** Satu wilayah dari `data` yang namanya tertulis di alamat, atau null bila tidak yakin. */
  function pilihDariAlamat(indeks, kataAlamat, segmen, data, tanpaLemah) {
    const tingkat = TINGKAT[indeks];
    const kuat = [];
    const lemah = [];
    for (const w of data) {
      const n = inti(w.nama);
      if (!n) continue;
      const ada = kemunculan(kataAlamat, n, tingkat.kata);
      if (!ada.length) continue;
      const a = awalan(w.nama);
      let terkata = ada.some((x) => {
        if (!x.kunci) return false;
        if (indeks !== 1) return true;
        // Kabupaten vs Kota: kata di depan nama harus sesuai.
        return a === "kota" ? x.kunci === "KOTA" : a === "kabupaten" ? x.kunci === "KABUPATEN" || x.kunci === "KAB" : true;
      });
      const wsegmen = segmen.some((s) => s === n || tingkat.kata.some((k) => s === `${k} ${n}`));
      if (indeks === 1 && wsegmen && !terkata && a) {
        // Segmen "Donggala" polos tak membedakan Kab/Kota: hanya sah bila namanya tak kembar.
        terkata = data.filter((x) => inti(x.nama) === n).length === 1;
      }
      if (terkata || wsegmen) kuat.push({ w, n });
      else if (!tanpaLemah && indeks <= 1 && n.length >= 5 && data.filter((x) => inti(x.nama) === n).length === 1) lemah.push({ w, n });
    }
    if (kuat.length === 1) return kuat[0].w;
    if (kuat.length > 1) {
      // Nama yang termuat utuh di nama lain (LABUAN di LABUAN SALUMBONE): yang terpanjang menang.
      const urut = kuat.slice().sort((x, y) => y.n.length - x.n.length);
      const terpanjang = urut[0];
      if (urut.slice(1).every((x) => ` ${terpanjang.n} `.includes(` ${x.n} `))) return terpanjang.w;
      return null;
    }
    if (lemah.length === 1) return lemah[0].w;
    return null;
  }

  /**
   * Rencana pengisian dropdown dari teks alamat. keadaan = [{terisi, nama}] untuk
   * provinsi..kelurahan. ambil({induk}) -> { ok, data:[{kode,nama,nilaiSipp}] }.
   * Hasil: [{indeks, wilayah}] - hanya tingkat KOSONG, berurutan dari atas.
   */
  async function rencanaDropdown(teks, keadaan, ambil) {
    const kataAlamat = normal(teks).split(" ").filter(Boolean);
    if (!kataAlamat.length) return [];
    const segmen = String(teks || "").split(",").map(normal);
    const hasil = [];
    let induk = "";
    for (let i = 0; i < TINGKAT.length; i += 1) {
      const daftar = await ambil({ induk });
      if (!daftar || !daftar.ok || !Array.isArray(daftar.data)) break;
      const k = (keadaan && keadaan[i]) || { terisi: false, nama: "" };
      if (k.terisi) {
        const w = cocokTepat(k.nama, daftar.data);
        if (!w) {
          // Tingkat terisi tak sejalan dengan induk yang kita pilih sendiri: batalkan pilihan induk itu.
          if (hasil.length && hasil[hasil.length - 1].indeks === i - 1) hasil.pop();
          break;
        }
        induk = w.kode;
        continue;
      }
      let w = pilihDariAlamat(i, kataAlamat, segmen, daftar.data);
      if (!w && i === 0 && !(keadaan[1] && keadaan[1].terisi)) w = await simpulkanProvinsi(kataAlamat, segmen, daftar.data, ambil);
      if (!w || !w.nilaiSipp) break;
      hasil.push({ indeks: i, wilayah: w });
      induk = w.kode;
    }
    return hasil;
  }

  /**
   * Provinsi tidak tertulis di alamat tetapi kabupaten/kota-nya tertulis lengkap dengan kata
   * "Kabupaten"/"Kota": provinsi yang memuat TEPAT SATU kabupaten/kota itu. Nama kembar antar
   * provinsi = tidak disimpulkan.
   */
  async function simpulkanProvinsi(kataAlamat, segmen, provinsi, ambil) {
    const temu = [];
    const gelombang = 8;
    for (let i = 0; i < provinsi.length; i += gelombang) {
      const bagian = provinsi.slice(i, i + gelombang);
      const jawab = await Promise.all(bagian.map((p) => ambil({ induk: p.kode })));
      jawab.forEach((j, n) => {
        if (!j || !j.ok || !Array.isArray(j.data)) return;
        const w = pilihDariAlamat(1, kataAlamat, segmen, j.data, true);
        if (w) temu.push(bagian[n]);
      });
      if (temu.length > 1) return null;
    }
    return temu.length === 1 ? temu[0] : null;
  }

  /** Nama terpilih tiap tingkat -> wilayah SIPP (kode, dst.) sejauh rantainya dapat dikenali. */
  async function rantaiWilayah(nama, ambil) {
    const hasil = [null, null, null, null];
    let induk = "";
    for (let i = 0; i < TINGKAT.length; i += 1) {
      if (!nama[i]) break;
      const daftar = await ambil({ induk });
      if (!daftar || !daftar.ok || !Array.isArray(daftar.data)) break;
      const w = cocokTepat(nama[i], daftar.data);
      if (!w) break;
      hasil[i] = w;
      induk = w.kode;
    }
    return hasil;
  }

  /* ─── D. Pengingat merah ─────────────────────────────────────────────── */

  /** jenis_identitas SIPP: 4 = KTP, 2 = Kartu Keluarga. */
  function periksaIdentitas(isi) {
    const x = isi || {};
    const masalah = [];
    const jenis = String(x.jenis || "").trim();
    const nomor = String(x.nomor || "").trim();
    const telp = String(x.telp || "").trim();
    if (x.jenisAda !== false && !jenis) masalah.push({ medan: "jenis", pesan: "Jenis identitas belum dipilih." });
    // Keputusan pengguna 22 Okt: hanya nilai SK (terisi atau belum). Panjang NIK/KK
    // dan bentuk nomor telepon tidak diperiksa - bot sudah menyeragamkan 0 -> +62.
    if (x.nomorAda !== false && !nomor) masalah.push({ medan: "nomor", pesan: "Nomor identitas belum diisi." });
    if (x.telpAda !== false && !telp) masalah.push({ medan: "telp", pesan: "Nomor telepon belum diisi." });
    return masalah;
  }

  /* ─── 2. Lapisan halaman ─────────────────────────────────────────────── */

  const BLANGKO = [
    {
      form: "form#frm_ref_pihak",
      alamat: "#pihak_alamat",
      alamatLain: [],
      pekerjaan: 'input[name="pihak_pekerjaan"]',
      identitas: { jenis: "#pihak_jenis_identitas", nomor: "#pihak_no_identitas", telp: "#pihak_no_tlp" },
    },
    {
      form: "form#frm_ref_pengacara",
      alamat: "#pengacara_alamat",
      alamatLain: ["#pengacara_alamat_kantor"],
      pekerjaan: '[name="pengacara_pekerjaan"]',
      identitas: { jenis: "#pengacara_jenis_identitas", nomor: "#pengacara_no_identitas", telp: "#pengacara_no_tlp" },
    },
  ];

  const keadaan = new Map(); // penunjuk blangko -> keadaan
  const JEDA_UJI = globalThis.ALETA_PL_JEDA || {};
  const JEDA_DETAK_MS = JEDA_UJI.detak || 700;
  const JEDA_KETIK_MS = JEDA_UJI.ketik || 1100;
  let nomorPesan = 0;
  const singgahWilayah = new Map();

  function tampak(el) {
    if (!el) return false;
    for (let s = el; s && s.nodeType === 1; s = s.parentElement) {
      let gaya = null;
      try {
        gaya = window.getComputedStyle(s);
      } catch {
        gaya = null;
      }
      if (gaya && (gaya.display === "none" || gaya.visibility === "hidden")) return false;
    }
    return true;
  }

  function bolehTulis(teks) {
    if (typeof AletaPenjagaTanda !== "undefined" && AletaPenjagaTanda && typeof AletaPenjagaTanda.periksaTeks === "function") {
      return AletaPenjagaTanda.periksaTeks(String(teks), "isian").ok !== false;
    }
    return !/aleta/i.test(String(teks));
  }

  async function ambilWilayah(param) {
    const induk = String((param && param.induk) || "");
    if (singgahWilayah.has(induk)) return singgahWilayah.get(induk);
    try {
      const opsi = { credentials: "include", cache: "no-store" };
      const alamat = `${WILAYAH_API}?induk=${encodeURIComponent(induk)}`;
      const r = typeof alatAmbil === "function" ? await alatAmbil(alamat, opsi, "Membaca wilayah SIPP") : await fetch(alamat, opsi);
      const luar = await r.json();
      const isi = luar && luar.data ? luar.data : luar;
      if (!r.ok || !isi || isi.ok !== true) return { ok: false, data: [] };
      const hasil = { ok: true, data: Array.isArray(isi.data) ? isi.data : [] };
      singgahWilayah.set(induk, hasil);
      return hasil;
    } catch {
      return { ok: false, data: [] };
    }
  }

  function jembatan(pesan, batasMs) {
    if (pesan && pesan.jenis === "isi" && !bolehTulis(pesan.nilai)) return Promise.resolve({ ok: false, alasan: "ditahan_penjaga" });
    nomorPesan += 1;
    const id = `aleta-pihaklengkap-${Date.now()}-${nomorPesan}`;
    return new Promise((selesai) => {
      let jam = null;
      const dengar = (peristiwa) => {
        if (peristiwa.source !== window) return;
        const isi = peristiwa.data;
        if (!isi || isi.sumber !== "aleta-jembatan-jawab" || isi.id !== id) return;
        window.removeEventListener("message", dengar);
        clearTimeout(jam);
        selesai(isi);
      };
      jam = setTimeout(() => {
        window.removeEventListener("message", dengar);
        selesai({ ok: false, alasan: "jembatan_tidak_menjawab" });
      }, batasMs || 4000);
      window.addEventListener("message", dengar);
      window.postMessage({ sumber: "aleta-jembatan", id, ...pesan }, "*");
    });
  }

  function dropdownTerisi(sel) {
    if (!sel) return false;
    const v = String(sel.value || "");
    if (!v || v === "0") return false;
    const o = sel.options && sel.options[sel.selectedIndex];
    const teks = o ? String(o.textContent || "").trim() : "";
    return Boolean(teks) && !/^-\s*(?:cari|pilih)/i.test(teks);
  }

  function dropdownNama(sel) {
    if (!dropdownTerisi(sel)) return "";
    const o = sel.options[sel.selectedIndex];
    return String(o.textContent || "").trim();
  }

  function bacaDropdown(f) {
    return TINGKAT.map((t) => {
      const sel = f.querySelector(t.penunjuk);
      return { terisi: dropdownTerisi(sel), nama: dropdownNama(sel) };
    });
  }

  function tulisKolom(el, nilai) {
    if (!el || !bolehTulis(nilai)) return false;
    el.value = nilai;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function kolomUtama(f, b) {
    return f.querySelector(b.alamat);
  }

  function buatKotak(kelas, sesudah) {
    const kotak = document.createElement("div");
    kotak.className = kelas;
    kotak.hidden = true;
    if (sesudah && sesudah.parentNode) sesudah.parentNode.insertBefore(kotak, sesudah.nextSibling);
    return kotak;
  }

  /* panenan nilai yang sudah ada di tabel SIPP halaman ini (dibaca saja) */
  function panenTabel(doc) {
    const alamat = [];
    const pekerjaan = [];
    for (const tabel of Array.from(doc.querySelectorAll("table"))) {
      const baris = Array.from(tabel.rows || []);
      if (baris.length < 2) continue;
      const kepala = Array.from(baris[0].cells || []).map((c) => String(c.textContent || "").trim().toLowerCase());
      const ia = kepala.indexOf("alamat");
      const ip = kepala.indexOf("pekerjaan");
      if (ia < 0 && ip < 0) continue;
      for (const r of baris.slice(1)) {
        const sel = Array.from(r.cells || []);
        if (ia >= 0 && sel[ia]) alamat.push(String(sel[ia].textContent || "").trim());
        if (ip >= 0 && sel[ip]) pekerjaan.push(String(sel[ip].textContent || "").trim());
      }
    }
    return { alamat: alamat.filter(Boolean), pekerjaan: pekerjaan.filter(Boolean) };
  }

  function kosakataAlamat(s, doc) {
    const frasa = [];
    for (const t of s.kosakataWilayah || []) frasa.push(t);
    const { alamat } = panenTabel(doc);
    for (const a of alamat) {
      for (const seg of String(a).split(",")) {
        const potong = seg.trim();
        if (!potong) continue;
        frasa.push(potong);
        const m = /^(?:desa|kelurahan|kecamatan|kabupaten|kota|provinsi)\s+(.+)$/i.exec(potong);
        if (m) frasa.push(m[1]);
      }
    }
    return frasa;
  }

  /* ─── Usulan Tab ─────────────────────────────────────────────────────── */

  function pasangUsulan(s, f, el, jenis) {
    if (s.terpasang.has(el)) return;
    s.terpasang.add(el);
    const kotak = buatKotak("aleta-pl-saran", el);
    const ambilUsulan = () => {
      const nilai = String(el.value || "");
      const diAkhir = el.selectionStart === undefined || el.selectionStart === null || el.selectionStart >= nilai.length;
      if (!diAkhir || !nilai.trim()) return { unik: "", pilihan: [] };
      if (jenis === "pekerjaan") return saranPekerjaan(nilai, panenTabel(document).pekerjaan);
      const hasil = saranAlamat(nilai, kosakataAlamat(s, document));
      return { unik: hasil, pilihan: [] };
    };
    const gambar = () => {
      kotak.textContent = "";
      if (!tampak(el)) {
        kotak.hidden = true;
        return;
      }
      const u = ambilUsulan();
      s.usulan.set(el, u);
      if (u.unik) {
        kotak.appendChild(document.createTextNode("Tab: "));
        const tebal = document.createElement("strong");
        tebal.textContent = u.unik;
        kotak.appendChild(tebal);
        kotak.hidden = false;
      } else if (u.pilihan.length) {
        for (const p of u.pilihan) {
          const tombol = document.createElement("button");
          tombol.type = "button";
          tombol.className = "aleta-pl-chip";
          tombol.textContent = p;
          tombol.addEventListener("mousedown", (e) => e.preventDefault());
          tombol.addEventListener("click", () => terapkan(p));
          kotak.appendChild(tombol);
        }
        kotak.hidden = false;
      } else {
        kotak.hidden = true;
      }
    };
    const terapkan = (nilai) => {
      if (!tulisKolom(el, nilai)) return;
      gambar();
      if (jenis === "alamat") void jadwalkanAlamatKeDropdown(s, f, 0);
    };
    el.addEventListener("input", () => {
      if (s.sedangSinkron) return;
      gambar();
    });
    el.addEventListener("keyup", (e) => {
      if (e.key !== "Tab" && e.key !== "Shift") gambar();
    });
    el.addEventListener("focus", gambar);
    el.addEventListener("blur", () => {
      kotak.hidden = true;
    });
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const u = ambilUsulan();
      if (!u.unik) return; // tanpa usulan: Tab biasa
      e.preventDefault();
      terapkan(u.unik);
    });
    s.gambarUsulan.push(gambar);
  }

  /* ─── Alamat -> dropdown ─────────────────────────────────────────────── */

  async function isiDropdown(f, formPenunjuk, rencana) {
    for (const langkah of rencana) {
      const t = TINGKAT[langkah.indeks];
      const sel = f.querySelector(t.penunjuk);
      if (!sel || dropdownTerisi(sel)) continue; // diisi petugas sementara itu: tidak ditimpa
      for (const o of Array.from(sel.options || [])) if (o.value) o.remove();
      const baru = document.createElement("option");
      baru.value = langkah.wilayah.nilaiSipp;
      baru.textContent = langkah.wilayah.nama;
      sel.appendChild(baru);
      await jembatan({ jenis: "isi", penunjuk: `${formPenunjuk} ${t.penunjuk}`, jenisMedan: "pilih", nilai: langkah.wilayah.nilaiSipp });
    }
  }

  function jadwalkanAlamatKeDropdown(s, f, jeda) {
    clearTimeout(s.jamAlamat);
    s.jamAlamat = setTimeout(() => void alamatKeDropdown(s, f), jeda);
  }

  async function alamatKeDropdown(s, f) {
    const el = kolomUtama(f, s.b);
    if (!el || s.sedangSinkron || el.readOnly) return;
    const teks = String(el.value || "");
    if (!teks.trim()) return;
    const awal = bacaDropdown(f);
    if (awal.every((x) => x.terisi)) return;
    s.sedangSinkron = true;
    try {
      const rencana = await rencanaDropdown(teks, awal, ambilWilayah);
      if (!rencana.length || String(el.value || "") !== teks) return; // alamat berubah selagi menunggu
      await isiDropdown(f, s.b.form, rencana);
      await muatKosakataWilayah(s, f);
    } finally {
      s.sedangSinkron = false;
    }
  }

  /* ─── Dropdown -> alamat ─────────────────────────────────────────────── */

  function potretDropdown(f) {
    return TINGKAT.map((t) => {
      const sel = f.querySelector(t.penunjuk);
      return `${sel ? String(sel.value || "") : ""}|${dropdownNama(sel)}`;
    }).join("§");
  }

  async function dropdownKeAlamat(s, f) {
    const el = kolomUtama(f, s.b);
    if (!el || el.readOnly || s.sedangSinkron) return;
    if (document.activeElement === el) return; // tidak menyela ketikan; dicoba lagi sesudah blur
    const nama = bacaDropdown(f).map((x) => x.nama);
    if (!nama.some(Boolean)) return;
    s.sedangSinkron = true;
    try {
      const rantai = nama[3] ? await rantaiWilayah(nama, ambilWilayah) : [];
      const bagian = {
        provinsi: { nama: nama[0] },
        kabupaten: { nama: nama[1] },
        kecamatan: { nama: nama[2] },
        kelurahan: { nama: nama[3], sebutan: rantai[3] ? sebutanDesa(rantai[3].kode) : "" },
      };
      const sekarang = String(el.value || "");
      const baru = tambahanAlamat(sekarang, bagian);
      if (baru !== sekarang && document.activeElement !== el && String(el.value || "") === sekarang) tulisKolom(el, baru);
      await muatKosakataWilayah(s, f);
    } finally {
      s.sedangSinkron = false;
    }
  }

  /** Nama wilayah terpilih + anak tingkat terdalam yang terisi -> kosakata usulan alamat. */
  async function muatKosakataWilayah(s, f) {
    const nama = bacaDropdown(f).map((x) => x.nama);
    const kosa = nama.filter(Boolean).map((n) => inti(n));
    try {
      const rantai = await rantaiWilayah(nama, ambilWilayah);
      let dalam = -1;
      rantai.forEach((w, i) => {
        if (w) dalam = i;
      });
      const induk = dalam >= 0 ? rantai[dalam].kode : "";
      if (dalam < 3) {
        const anak = await ambilWilayah({ induk });
        if (anak.ok) for (const w of anak.data) kosa.push(inti(w.nama));
      }
    } catch {
      /* kosakata tambahan boleh kosong */
    }
    s.kosakataWilayah = kosa.map((k) => kapital(k.toLowerCase()));
  }

  /* ─── Pengingat merah (D) ────────────────────────────────────────────── */

  function pasangPengingat(s, f) {
    const peta = [
      ["jenis", s.b.identitas.jenis],
      ["nomor", s.b.identitas.nomor],
      ["telp", s.b.identitas.telp],
    ];
    for (const [kunci, penunjuk] of peta) {
      const el = f.querySelector(penunjuk);
      if (!el || s.ingat.has(kunci)) continue;
      const jangkar = el.closest("span.custom-dropdown") || el;
      s.ingat.set(kunci, { el, kotak: buatKotak("aleta-pl-ingat", jangkar) });
      s.kotakIngat = true;
    }
  }

  function perbaruiPengingat(s, f) {
    const isi = { jenisAda: false, nomorAda: false, telpAda: false, jenis: "", nomor: "", telp: "" };
    for (const [kunci, { el }] of s.ingat) {
      const tampakKini = tampak(el);
      isi[`${kunci}Ada`] = tampakKini;
      isi[kunci] = tampakKini ? String(el.value || "") : "";
    }
    const masalah = periksaIdentitas(isi);
    for (const [kunci, { el, kotak }] of s.ingat) {
      const m = masalah.find((x) => x.medan === kunci);
      const jangkar = el.closest("span.custom-dropdown") || el;
      if (m) {
        kotak.textContent = m.pesan;
        kotak.hidden = false;
        kotak.setAttribute("role", "status");
        jangkar.classList.add("aleta-pl-merah");
        el.classList.add("aleta-pl-merah");
      } else {
        kotak.textContent = "";
        kotak.hidden = true;
        jangkar.classList.remove("aleta-pl-merah");
        el.classList.remove("aleta-pl-merah");
      }
    }
  }

  /* ─── Denyut ─────────────────────────────────────────────────────────── */

  function sambungkan(b) {
    const f = document.querySelector(b.form);
    let s = keadaan.get(b.form);
    if (!f || !tampak(f)) {
      if (s) s.aktif = false;
      return;
    }
    if (!s) {
      s = {
        b,
        terpasang: new WeakSet(),
        usulan: new WeakMap(),
        gambarUsulan: [],
        ingat: new Map(),
        kosakataWilayah: [],
        potret: null,
        sedangSinkron: false,
        jamAlamat: null,
        aktif: false,
        form: null,
      };
      keadaan.set(b.form, s);
    }
    if (s.form !== f) {
      // Blangko baru (dibangun ulang oleh halaman): pasang ulang dari awal.
      s.form = f;
      s.terpasang = new WeakSet();
      s.gambarUsulan = [];
      s.ingat = new Map();
      s.potret = null;
    }
    if (!s.aktif) {
      s.aktif = true;
      s.potret = null;
      void muatKosakataWilayah(s, f);
    }

    const alamat = kolomUtama(f, b);
    if (alamat && !alamat.readOnly) {
      pasangUsulan(s, f, alamat, "alamat");
      if (!s.terpasang.has(alamat) || !alamat.dataset.alamatKeDropdown) {
        alamat.dataset.alamatKeDropdown = "ya";
        const jadwal = () => {
          if (!s.sedangSinkron) jadwalkanAlamatKeDropdown(s, f, JEDA_KETIK_MS);
        };
        alamat.addEventListener("input", jadwal);
        alamat.addEventListener("change", () => {
          if (!s.sedangSinkron) jadwalkanAlamatKeDropdown(s, f, 150);
        });
        alamat.addEventListener("blur", () => {
          if (s.sedangSinkron) return;
          jadwalkanAlamatKeDropdown(s, f, 150);
          // Sesudah blur, dropdown yang berubah selagi alamat difokus boleh menambah alamat.
          s.potret = null;
        });
      }
    }
    for (const penunjuk of b.alamatLain || []) {
      const el = f.querySelector(penunjuk);
      if (el && !el.readOnly) pasangUsulan(s, f, el, "alamat");
    }
    const pekerjaan = f.querySelector(b.pekerjaan);
    if (pekerjaan && pekerjaan.tagName !== "SELECT") pasangUsulan(s, f, pekerjaan, "pekerjaan");
    for (const kandidat of Array.from(f.querySelectorAll(b.pekerjaan))) {
      if (kandidat !== pekerjaan && kandidat.tagName !== "SELECT") pasangUsulan(s, f, kandidat, "pekerjaan");
    }

    pasangPengingat(s, f);
    perbaruiPengingat(s, f);

    // Dropdown berubah (SIPP memakai select2: tak ada peristiwa asli yang dapat didengar) -> alamat.
    const potret = potretDropdown(f);
    if (potret !== s.potret && !s.sedangSinkron) {
      const pertama = s.potret === null;
      s.potret = potret;
      if (alamat && document.activeElement === alamat) {
        s.potret = null; // ditunda sampai alamat tidak difokus
      } else if (!pertama || bacaDropdown(f).some((x) => x.terisi)) {
        void dropdownKeAlamat(s, f);
      }
    }
  }

  function denyut() {
    for (const b of BLANGKO) {
      try {
        sambungkan(b);
      } catch (galat) {
        if (typeof console !== "undefined" && console.warn) console.warn("pihak-lengkap:", galat && galat.message);
      }
    }
  }

  let jamDenyut = null;
  function mulai() {
    if (jamDenyut || typeof document === "undefined") return;
    jamDenyut = setInterval(denyut, JEDA_DETAK_MS);
    denyut();
  }

  globalThis.AletaPihakLengkap = {
    normal,
    inti,
    kapital,
    bakuAlamat,
    saranAlamat,
    saranPekerjaan,
    tambahanAlamat,
    rencanaDropdown,
    rantaiWilayah,
    periksaIdentitas,
    sebutanDesa,
    panenTabel,
    mulai,
    denyut,
  };

  if (typeof document !== "undefined" && !globalThis.ALETA_PIHAK_LENGKAP_MANUAL) mulai();
})();
