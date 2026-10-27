"use strict";

/**
 * ============================================================================
 * KERJAKAN PENETAPAN SATU PERKARA - SATU PINTU DI PERAMBAN (20 Okt 2026, P1)
 * ============================================================================
 *
 * Memasang globalThis.aletaPenetapanKerja = { kerjakan, keadaan, ambilKunci,
 * lepasKunci }. Bentuk argumen dan hasil: docs/penetapan/KERJAKAN-PENETAPAN.md.
 *
 * Dipakai tombol "Penetapan Otomatis" di halaman SIPP (agen P2), kartu
 * Penetapan, dan penanda halaman SIPP - semuanya membaca keadaan dari rute
 * yang sama dan memegang kunci per perkara yang sama, jadi tidak ada dua jalan
 * yang menulis perkara yang sama bersamaan atau menulis ulang yang sudah ada.
 *
 * Urutan kerja kerjakan():
 *   1. mengambil kunci perkara (peramban memegangnya sampai e-Doc selesai);
 *   2. rute kerjakan di portal: baca keadaan, lewati yang sudah ada, tulis sisa
 *      PMH->PHS dalam satu transaksi, laporan per langkah;
 *   3. e-Doc: untuk tiap langkah yang dicentang DAN (tercatat ATAU sudah ada),
 *      blangko ABT dicetak sesi ABT petugas dan diunggah (e-Doc yang sudah
 *      terunggah tidak ditimpa tanpa ditanyakan);
 *   4. melepas kunci.
 *
 * TIDAK PERNAH MEMBONGKAR. Mode kering/latihan/coba menahan penulisan lewat
 * alatAmbil seperti jalur penetapan lain. Fungsi konten.js (alatAmbil,
 * namaPenggunaSipp, e6UnggahEdocPenetapan, ...) berada di lingkup skrip konten
 * yang sama; typeof menjaga nama yang belum ada.
 */
(function penetapanKerjaModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPenetapanKerja) return;

  const API_KERJAKAN = "/aleta/api/aleta-bot/penunjukan/kerjakan";
  const API_KEADAAN = "/aleta/api/aleta-bot/penunjukan/keadaan";
  const API_KUNCI = "/aleta/api/aleta-bot/penunjukan/kunci";
  const URUTAN = ["pmh", "ppp", "pjs", "phs"];

  const bacaJson = async (respons) => {
    let luar = null;
    try {
      luar = await respons.json();
    } catch {
      luar = null;
    }
    // Rute kerjakan menjawab polos; keadaan/kunci dibungkus { ok, data }.
    const isi = luar && luar.data && typeof luar.data === "object" ? luar.data : luar;
    return { status: Number(respons && respons.status) || 0, luar, isi };
  };

  const kalimat = (kode, akun) => (typeof kalimatAlasan === "function" ? kalimatAlasan(kode, akun) : String(kode || ""));

  async function panggil(alamat, opsi, label) {
    if (typeof alatAmbil !== "function") throw new Error("alatAmbil belum tersedia");
    return alatAmbil(alamat, { credentials: "include", cache: "no-store", ...opsi }, label);
  }

  /** Keadaan penetapan (satu sumber). Pulang bentuk dokumen bagian 2, atau { ok:false, alasan }. */
  async function keadaan(p) {
    const q = [];
    if (p && p.perkaraId) q.push(`perkaraId=${encodeURIComponent(String(p.perkaraId))}`);
    if (p && p.nomorPerkara) q.push(`nomor=${encodeURIComponent(String(p.nomorPerkara))}`);
    if (!q.length) return { ok: false, alasan: "perkara_tidak_disebut" };
    try {
      const respons = await panggil(`${API_KEADAAN}?${q.join("&")}`, {}, "Membaca keadaan penetapan");
      const { isi } = await bacaJson(respons);
      return isi && typeof isi === "object" ? isi : { ok: false, alasan: "keadaan_tidak_terbaca" };
    } catch (galat) {
      return { ok: false, alasan: "keadaan_tidak_terbaca", pesan: String((galat && galat.message) || galat) };
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Kunci perkara: detak, pelepasan yang dipastikan, dan pesan yang jelas (26 Okt 2026)
  // ───────────────────────────────────────────────────────────────────────
  // Kunci dipegang ke portal/bot selama pekerjaan berjalan. Selama halaman hidup, kunci DIPERPANJANG tiap
  // DETAK_MS (kedaluwarsanya TTL_PERAMBAN_DETIK sesudah detak terakhir); halaman yang dimuat ulang atau ditutup
  // berhenti berdetak, sehingga kuncinya basi dalam hitungan detik: pemilik yang sama boleh mengambilnya alih,
  // pengguna lain menunggu kedaluwarsa. Pelepasan diulang bila gagal - dulu kegagalan melepas diam-diam
  // meninggalkan kunci tertahan sampai kedaluwarsa dan menghalangi pemiliknya sendiri.
  const DETAK_MS = 25000;
  const TTL_PERAMBAN_DETIK = 120;
  const dipegang = new Map(); // token -> { perkaraId, tujuan, pewaktu, sibuk }

  // Ingatan kunci per TAB (sessionStorage bertahan saat halaman dimuat ulang, tidak dibagi ke tab lain). Pelepasan
  // di pagehide sering tidak sampai karena halaman keburu mati; tanpa ingatan ini jalan berikutnya di tab yang sama
  // ditolak oleh kunci miliknya sendiri sampai kedaluwarsa. Token yang masih berdetak di halaman INI = pekerjaan yang
  // benar-benar sedang jalan, tidak dipakai bersama.
  const KUNCI_TAB = "pk-kunci-tab";
  function bacaTab() {
    try {
      const o = JSON.parse(sessionStorage.getItem(KUNCI_TAB) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch {
      return {};
    }
  }
  function tulisTab(o) {
    try {
      if (Object.keys(o).length) sessionStorage.setItem(KUNCI_TAB, JSON.stringify(o));
      else sessionStorage.removeItem(KUNCI_TAB);
    } catch {
      /* tanpa sessionStorage: kunci tetap basi sendiri */
    }
  }
  function ingatTab(perkaraId, token) {
    const o = bacaTab();
    o[String(perkaraId)] = { token: String(token), saat: Date.now() };
    tulisTab(o);
  }
  function lupaTab(perkaraId, token) {
    const o = bacaTab();
    const r = o[String(perkaraId)];
    if (r && (!token || String(r.token) === String(token))) {
      delete o[String(perkaraId)];
      tulisTab(o);
    }
  }
  function tokenTab(perkaraId) {
    const r = bacaTab()[String(perkaraId)];
    if (!r || !r.token) return "";
    if (Date.now() - Number(r.saat || 0) > (TTL_PERAMBAN_DETIK + 60) * 1000) return "";
    if (dipegang.has(String(r.token))) return "";
    return String(r.token);
  }

  async function kunci(aksi, perkaraId, token, tujuan) {
    try {
      const respons = await panggil(
        API_KUNCI,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId,
            aksi,
            token: token || "",
            tujuan: tujuan || "peramban",
            ...(aksi === "lepas" ? {} : { ttlDetik: TTL_PERAMBAN_DETIK, ambilAlih: true }),
          }),
        },
        aksi === "lepas" ? "Melepas kunci penetapan" : "Mengambil kunci penetapan"
      );
      const { isi } = await bacaJson(respons);
      return isi && typeof isi === "object" ? isi : { ok: false, alasan: "kunci_tidak_tersedia" };
    } catch (galat) {
      return { ok: false, alasan: "kunci_tidak_tersedia", pesan: String((galat && galat.message) || galat) };
    }
  }

  function hentikanDetak(token) {
    const rec = dipegang.get(token);
    if (!rec) return;
    clearInterval(rec.pewaktu);
    dipegang.delete(token);
  }

  function mulaiDetak(perkaraId, token, tujuan) {
    if (!token || dipegang.has(token) || typeof setInterval !== "function") return;
    const rec = { perkaraId, tujuan, pewaktu: null, sibuk: false };
    rec.pewaktu = setInterval(async () => {
      if (rec.sibuk) return;
      rec.sibuk = true;
      try {
        // Token lama + kunci masih berlaku = diperpanjang. Kunci yang sudah hilang (diambil orang lain sesudah
        // kedaluwarsa) tidak direbut kembali: berhenti berdetak, pekerjaan menyelesaikan langkahnya sendiri.
        const r = await kunci("ambil", perkaraId, token, tujuan);
        if (!(r && r.ok === true && String(r.token) === String(token))) hentikanDetak(token);
        else ingatTab(perkaraId, token);
      } finally {
        rec.sibuk = false;
      }
    }, DETAK_MS);
    if (rec.pewaktu && typeof rec.pewaktu.unref === "function") rec.pewaktu.unref();
    dipegang.set(token, rec);
  }

  const jeda = (ms) => new Promise((selesai) => setTimeout(selesai, ms));

  const jamMenit = (utc) => {
    // "2026-10-26 03:40:44" (UTC, dari basis data ALETA) -> jam setempat "11.40"
    const d = new Date(String(utc || "").replace(" ", "T") + "Z");
    if (!Number.isFinite(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const namaTujuan = (tujuan) => {
    const t = String(tujuan || "");
    if (t === "putusan-otomatis") return "Putusan Otomatis";
    if (/^isi-borang-/.test(t)) return "Pengisian form";
    if (t === "kerjakan-penetapan") return "Penetapan";
    return t || "pekerjaan lain";
  };
  const rapikan = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();

  /**
   * Kalimat untuk pengguna dari jawaban kunci.
   *  - ditolak, milik pengguna sendiri : pekerjaan sebelumnya masih tercatat, kapan bebas;
   *  - ditolak, milik orang lain       : siapa, apa, sejak kapan;
   *  - diambil alih                    : pekerjaan sebelumnya terputus, dilanjutkan oleh pengguna.
   */
  function kalimatKunci(r) {
    if (!r) return "";
    if (r.ok === true && r.diambilAlih) {
      const d = r.diambilAlih;
      const sejak = jamMenit(d.sejak);
      return `${namaTujuan(d.tujuan)} sebelumnya masih tercatat berjalan${sejak ? ` sejak ${sejak}` : ""} tetapi sudah tidak aktif (halaman dimuat ulang atau ditutup) - dilanjutkan oleh Anda.`;
    }
    if (r.alasan !== "sedang_dikerjakan") return "";
    const sejak = jamMenit(r.sejak);
    const tunggu = Number(r.tungguDetik) > 0 ? Number(r.tungguDetik) : 0;
    if (r.milikSendiri === true) {
      const aktif = jamMenit(r.terakhirAktif);
      return (
        `${namaTujuan(r.tujuan)} Anda sebelumnya masih tercatat berjalan${sejak ? ` sejak ${sejak}` : ""}${aktif ? ` (terakhir aktif ${aktif})` : ""}. ` +
        `Bila halaman atau tab-nya sudah ditutup, tunggu ${tunggu || "beberapa"} detik lalu ulangi - kunci dilepas sendiri dan pekerjaannya dapat Anda lanjutkan.`
      );
    }
    const oleh = rapikan(r.oleh);
    return (
      `Perkara ini sedang dikerjakan${oleh ? ` oleh ${oleh}` : ""}${r.tujuan ? ` (${rapikan(r.tujuan)})` : ""}${sejak ? ` sejak ${sejak}` : ""} - ` +
      `tunggu selesai${tunggu ? ` (paling lama sekitar ${tunggu} detik bila halamannya sudah ditutup)` : ""} supaya tidak tertulis ganda, lalu ulangi.`
    );
  }

  /**
   * Mengambil kunci satu perkara. `token` (bila ada) = kunci yang SUDAH dipegang pekerjaan yang sama:
   * diperpanjang, tidak ditolak oleh dirinya sendiri (langkah dalam satu jalan memakai token jalannya).
   * Jawaban sukses membawa `catatan` bila sisa pekerjaan terputus milik pengguna ini diambil alih;
   * jawaban ditolak membawa `kalimat` (pesan siap tampil).
   */
  async function ambilKunci(perkaraId, tujuan, token) {
    // 27 Okt: token yang dipegang tab ini sebelum halaman dimuat ulang (mis. sesudah Simpan Putusan Akhir) dipakai
    // lagi - diperpanjang, tidak menolak pemiliknya sendiri "masih tercatat berjalan" sampai kedaluwarsa.
    const warisan = token ? "" : tokenTab(perkaraId);
    const r = await kunci("ambil", perkaraId, token || warisan || undefined, tujuan);
    if (r && r.ok === true && r.token) {
      ingatTab(perkaraId, String(r.token));
      mulaiDetak(perkaraId, String(r.token), tujuan || "peramban");
      const catatan = kalimatKunci(r);
      return catatan ? { ...r, catatan } : r;
    }
    const kalimatTolak = kalimatKunci(r);
    return kalimatTolak ? { ...r, kalimat: kalimatTolak } : r;
  }

  /** Melepas kunci; gagal melepas diulang (sambungan/latar sesaat tidak menjawab), bukan dibiarkan diam-diam. */
  async function lepasKunci(perkaraId, token) {
    if (!token) return { ok: true };
    hentikanDetak(String(token));
    lupaTab(perkaraId, token);
    let r = null;
    for (let ke = 0; ke < 3; ke += 1) {
      r = await kunci("lepas", perkaraId, token);
      if (r && r.ok === true) return r;
      await jeda(300 * (ke + 1));
    }
    return r;
  }

  // Halaman dimuat ulang / ditutup di tengah jalan: kunci yang masih dipegang dilepas sekarang juga, bukan
  // menunggu kedaluwarsa (yang tidak sempat dilepas basi sendiri setelah detak berhenti).
  try {
    if (typeof addEventListener === "function") {
      addEventListener("pagehide", () => {
        for (const [token, rec] of Array.from(dipegang.entries())) {
          hentikanDetak(token);
          void kunci("lepas", rec.perkaraId, token);
        }
      });
    }
  } catch {
    /* kunci tetap basi sendiri */
  }

  /** Kabar tiruan untuk e6UnggahEdocPenetapan: teksnya diteruskan ke callback kemajuan. */
  function kabarKemajuan(pada, jenis) {
    let teks = "";
    return {
      className: "",
      get textContent() {
        return teks;
      },
      set textContent(nilai) {
        teks = String(nilai || "");
        try {
          if (typeof pada === "function") pada({ tahap: "edoc", jenis, teks });
        } catch {
          /* callback tidak boleh menggagalkan pekerjaan */
        }
      },
    };
  }

  function statusEdoc(hasil, jenis) {
    if (!hasil) return { status: "gagal", sebab: "tanpa_jawaban", bunyi: "e-Doc tidak menjawab." };
    if (hasil.ditahan) return { status: "dilewati", sebab: "ditahan", bunyi: `e-Doc ditahan ${hasil.ditahan} - tidak ada yang dikirim.` };
    const berkas = hasil.hasil && hasil.hasil.d && Array.isArray(hasil.hasil.d.berkas) ? hasil.hasil.d.berkas : [];
    const satu = berkas.find((x) => String(x.jenis || "").toLowerCase() === jenis);
    if (satu) {
      return satu.ok
        ? { status: "terunggah", sebab: "", bunyi: "" }
        : { status: "gagal", sebab: "unggah_gagal", bunyi: String(satu.sebab || "e-Doc tidak terunggah.") };
    }
    if (hasil.alasan === "tidak_ada_jenis") return { status: "dilewati", sebab: "tidak_aktif_di_peta", bunyi: "Jenis ini tidak aktif di Peta penetapan - e-Doc tidak diunggah." };
    if (hasil.alasan === "sudah_terunggah") return { status: "dilewati", sebab: "sudah_terunggah", bunyi: "e-Doc sudah terunggah - tidak ditimpa otomatis." };
    if (hasil.dibatalkan) return { status: "dilewati", sebab: "dibatalkan", bunyi: "Dibatalkan." };
    if (hasil.gagal && hasil.gagal.length) {
      const cocok = hasil.gagal.find((x) => String(x).toLowerCase().startsWith(jenis));
      if (cocok) return { status: "gagal", sebab: "tidak_tercetak", bunyi: String(cocok) };
    }
    return hasil.ok ? { status: "terunggah", sebab: "", bunyi: "" } : { status: "gagal", sebab: "unggah_gagal", bunyi: "e-Doc tidak terunggah." };
  }

  /**
   * @param {object} p lihat docs/penetapan/KERJAKAN-PENETAPAN.md bagian 1.
   */
  async function kerjakan(p) {
    const masuk = p || {};
    const nomorPerkara = String(masuk.nomorPerkara || "").trim();
    const pada = typeof masuk.pada === "function" ? masuk.pada : () => {};
    const kering = masuk.kering === true;
    const langkah = {};
    const unggah = {};
    for (const j of URUTAN) {
      langkah[j] = masuk.langkah ? masuk.langkah[j] === true : true;
      unggah[j] = langkah[j] && (masuk.unggahEdoc ? masuk.unggahEdoc[j] === true : false);
    }
    const gagalAwal = (alasan, perkara) => ({
      ok: false,
      perkara: perkara || { perkaraId: Number(masuk.perkaraId) || 0, nomorPerkara },
      kunci: { diambil: false },
      laporan: URUTAN.map((j) => ({
        jenis: j,
        status: langkah[j] ? "gagal" : "dilewati",
        sebab: langkah[j] ? alasan : "tidak_dicentang",
        bunyi: langkah[j] ? kalimat(alasan) : "",
      })),
      keadaanSesudah: null,
      perluPilihanJamKerja: false,
      pesan: kalimat(alasan),
      kering,
    });
    if (!nomorPerkara) return gagalAwal("perkara_tidak_sah");
    const akunMasuk = typeof namaPenggunaSipp === "function" ? String(namaPenggunaSipp() || "").trim() : "";
    if (!akunMasuk) return gagalAwal("akun_sipp_belum_terbaca");

    // Mode kering/latihan/coba menahan PENULISAN (alatAmbil melemparkan sebabnya).
    let perkaraId = Number(masuk.perkaraId) || 0;
    let token = "";
    let kunciInfo = { diambil: false };
    try {
      if (!kering) {
        if (!perkaraId) {
          const k = await keadaan({ nomorPerkara });
          perkaraId = Number(k && k.perkaraId) || 0;
          if (!perkaraId) return gagalAwal(String((k && k.alasan) || "perkara_tidak_ketemu"));
        }
        pada({ tahap: "kunci", teks: "Mengambil kunci perkara…" });
        const k = await ambilKunci(perkaraId, "kerjakan-penetapan");
        if (!k || k.ok !== true) {
          // Pekerjaan lain memegang perkara ini: semua langkah dilewati, tidak ada yang ditulis.
          const alasan = String((k && k.alasan) || "kunci_tidak_tersedia");
          const sibuk = alasan === "sedang_dikerjakan";
          return {
            ...gagalAwal(alasan, { perkaraId, nomorPerkara }),
            kunci: { diambil: false, oleh: String((k && k.oleh) || ""), sampai: String((k && k.sampai) || "") },
            laporan: URUTAN.map((j) => ({
              jenis: j,
              status: langkah[j] ? (sibuk ? "dilewati" : "gagal") : "dilewati",
              sebab: langkah[j] ? alasan : "tidak_dicentang",
              bunyi: langkah[j] ? (sibuk && k && k.kalimat ? k.kalimat : kalimat(alasan)) : "",
            })),
          };
        }
        token = String(k.token || "");
        kunciInfo = { diambil: true };
      }

      const kirim = async (jamKerja) => {
        const respons = await panggil(
          API_KERJAKAN,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            batasMs: 150000,
            body: JSON.stringify({
              nomorPerkara,
              perkaraId: perkaraId || undefined,
              mode: masuk.mode === "manual" ? "manual" : "otomatis",
              pilihan: masuk.mode === "manual" ? masuk.pilihan || {} : {},
              langkah,
              kering,
              olehUsername: akunMasuk,
              kunciToken: token || undefined,
              tanyaJamKerja: true,
              ...(jamKerja ? { jamKerja } : {}),
            }),
          },
          kering ? "Menyusun rencana penetapan" : "Menulis penetapan"
        );
        const { status, isi } = await bacaJson(respons);
        return { status, isi };
      };

      pada({ tahap: "tulis", teks: kering ? "Menyusun rencana…" : "Menulis penetapan…" });
      let { status, isi } = await kirim("");
      if (isi && isi.perluPilihanJamKerja === true && typeof tanyaJamKerjaPenetapan === "function") {
        const pilih = await tanyaJamKerjaPenetapan(String(isi.pesan || ""));
        ({ status, isi } = await kirim(pilih));
      }
      if (!isi || !Array.isArray(isi.laporan)) {
        // 401/403/5xx tanpa laporan: tidak ada yang pasti tertulis.
        const kode = status === 401 ? "belum_masuk_aleta" : status === 403 ? "tidak_berwenang_aleta" : String((isi && isi.alasan) || "tanpa_jawaban");
        return { ...gagalAwal(kode, { perkaraId, nomorPerkara }), kunci: kunciInfo };
      }

      const hasil = { ...isi, kunci: { ...(isi.kunci || {}), ...(kunciInfo.diambil ? { diambil: true } : {}) } };
      hasil.laporan = hasil.laporan.map((x) => ({ ...x }));
      if (!kering && hasil.laporan.some((x) => x.status === "tercatat") && typeof lupakanStatusPerkara === "function") {
        try {
          lupakanStatusPerkara(nomorPerkara);
        } catch {
          /* singgahan saja */
        }
      }

      // e-Doc: hanya untuk langkah yang dicentang DAN tercatat/sudah ada.
      if (!kering) {
        const layak = (x) => unggah[x.jenis] && (x.status === "tercatat" || (x.status === "dilewati" && x.sebab === "sudah_ada"));
        const untukEdoc = hasil.laporan.filter(layak);
        for (const x of hasil.laporan) {
          if (unggah[x.jenis] && !layak(x)) x.edoc = { status: "dilewati", sebab: "penetapan_belum_tercatat", bunyi: "Penetapan belum tercatat - e-Doc tidak diunggah." };
          else if (!unggah[x.jenis]) x.edoc = { status: "tidak_dicentang", sebab: "", bunyi: "" };
        }
        if (untukEdoc.length && typeof e6UnggahEdocPenetapan === "function") {
          pada({ tahap: "edoc", teks: "Mengunggah e-Doc penetapan…" });
          let edoc = null;
          try {
            edoc = await e6UnggahEdocPenetapan({
              nomorPerkara,
              perkaraId: String(perkaraId || ""),
              jenis: untukEdoc.map((x) => x.jenis),
              // Dicentang petugas = diminta tegas, jadi tidak tersaring oleh
              // "unggah otomatis" di Peta penetapan. e-Doc yang SUDAH terunggah
              // tidak ditimpa diam-diam: e6UnggahEdocPenetapan menanyakannya.
              otomatis: false,
              kering: false,
              sita: masuk.sita || "",
              kabar: kabarKemajuan(pada, "edoc"),
            });
          } catch (galat) {
            edoc = { ok: false, gagal: [], alasanLempar: String((galat && galat.message) || galat) };
          }
          for (const x of untukEdoc) {
            x.edoc = edoc && edoc.alasanLempar ? { status: "gagal", sebab: "unggah_gagal", bunyi: edoc.alasanLempar } : statusEdoc(edoc, x.jenis);
          }
        } else {
          for (const x of untukEdoc) x.edoc = { status: "dilewati", sebab: "edoc_tidak_tersedia", bunyi: "Unggah e-Doc tidak tersedia di halaman ini." };
        }
        const edocGagal = hasil.laporan.filter((x) => x.edoc && x.edoc.status === "gagal");
        if (edocGagal.length) {
          hasil.ok = false;
          hasil.pesan = `${hasil.pesan || ""} e-Doc gagal: ${edocGagal.map((x) => x.jenis.toUpperCase()).join(", ")}.`.trim();
        }
      }
      return hasil;
    } catch (galat) {
      // Mode latihan/kering/coba dan jaringan putus berakhir di sini. Belum
      // pasti tertulis atau tidak bila putusnya sesudah rute kerjakan dipanggil.
      const pesan = String((galat && galat.message) || galat).replace(/[.\s]+$/, "");
      return {
        ...gagalAwal(/mode_(coba|kering|latihan)/.test(pesan) ? pesan.match(/mode_(coba|kering|latihan)/)[0] : "tanpa_jawaban", { perkaraId, nomorPerkara }),
        pesan: `${pesan}. Belum pasti tertulis atau tidak - periksa keadaan; bila ditekan lagi, langkah yang sudah ada dilewati.`,
        kunci: kunciInfo,
      };
    } finally {
      if (token) await lepasKunci(perkaraId, token);
    }
  }

  globalThis.aletaPenetapanKerja = { kerjakan, keadaan, ambilKunci, lepasKunci, kalimatKunci, URUTAN };
})();
