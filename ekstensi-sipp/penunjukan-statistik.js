"use strict";

/**
 * ============================================================================
 * STATISTIK BEBAN PENETAPAN - TAMPILAN SAJA (20 Okt 2026, agen B1)
 * ============================================================================
 *
 * Papan penunjukan (konten.js, gambarPenunjukan) dan panel "Penetapan Otomatis"
 * di halaman SIPP (penetapan-sipp.js) menggambar blok "Beban penetapan" dari
 * fungsi YANG SAMA di berkas ini, dari objek `usulan.statistik` yang SAMA yang
 * disusun bot (aleta_bot/services/bebanPenetapanService.js lewat
 * penunjukanService.usulanPenunjukan). Tidak ada rumus beban di sini: angka,
 * persentase, skor, urutan, dan kalimat alasan semuanya datang dari server.
 *
 * Memasang: tempelDi(wadah, usulan, { terbuka }) - mengganti blok lama di
 * wadah itu dengan yang baru. Dipanggil dari:
 *   - konten.js        gambarPenunjukan (papan)
 *   - penetapan-sipp.js render() (panel halaman SIPP, kotak "Beban & SK")
 *
 * Hanya textContent; tidak ada penyisipan HTML mentah. Kelas berawalan `aleta-sisip` supaya
 * diabaikan pengamat perubahan halaman SIPP. Tidak menulis apa pun ke SIPP.
 */
(function penunjukanStatistikModul() {
  if (typeof globalThis === "undefined" || globalThis.aletaPenunjukanStatistik) return;

  const KELAS = "aleta-sisip aleta-bebanstat";

  const koma = (n) => String(n).replace(".", ",");

  /** "8 dalam 30 hari (18% dari seluruh penerimaan; rata-rata 25%)" untuk satu orang/majelis. */
  function teks30(e) {
    return `${e.hari30} (${koma(e.persen30)}%, rata-rata ${koma(e.rataRata30)}%)`;
  }

  function teksKebendaan(e, total) {
    const dari = Number.isFinite(total) ? ` dari ${total}` : Number.isFinite(e.kebendaan6Total) ? ` dari ${e.kebendaan6Total}` : "";
    return `${e.kebendaan6}${dari} (${koma(e.persenKebendaan6)}%)`;
  }

  /** Satu kalimat untuk satu orang (dipakai juga sebagai judul tooltip). */
  function kalimatOrang(e, total) {
    if (!e) return "";
    return (
      `${e.aktif} berjalan · ${e.tahun} tahun ini · 30 hari terakhir ${teks30(e)} · ` +
      `kebendaan 6 bulan ${teksKebendaan(e, total)}`
    );
  }

  /** Kalimat SK: nomor + tanggal, atau tanda belum memakai SK. */
  function kalimatSk(stat) {
    const sk = (stat && stat.sk) || null;
    if (!sk) return "";
    return sk.bunyi || "";
  }

  /** Kalimat rekomendasi beban (majelis, lalu PP dan JS). */
  function kalimatRekomendasi(stat) {
    const r = stat && stat.rekomendasi;
    if (!r) return [];
    const baris = [];
    if (r.majelis) baris.push(`Majelis paling ringan bebannya: ${r.majelis.kode ? `Majelis ${r.majelis.kode}` : (r.majelis.anggotaKode || []).join(", ")} - ${r.majelis.alasan}`);
    if (r.panitera) baris.push(`Panitera pengganti paling ringan: ${r.panitera.nama} - ${r.panitera.alasan}`);
    if (r.jurusita) baris.push(`Juru sita paling ringan: ${r.jurusita.nama} - ${r.jurusita.alasan}`);
    return baris;
  }

  const STATUS_SK = {
    sesuai: "sesuai",
    tidak_sesuai: "awas",
    belum_ada_sk: "awas",
    sebelum_berlaku: "netral",
    belum_ditetapkan: "netral",
    tunggal: "netral",
  };

  function el(doc, tag, kelas, teks) {
    const e = doc.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined && teks !== null) e.textContent = String(teks);
    return e;
  }

  function tabel(doc, judul, kolom, baris, opsi) {
    const wadah = el(doc, "div", "aleta-bebanstat-bagian");
    wadah.append(el(doc, "div", "aleta-bebanstat-judul", judul));
    const t = el(doc, "table", "aleta-bebanstat-tabel");
    const kepala = doc.createElement("thead");
    const tr = doc.createElement("tr");
    for (const k of kolom) tr.append(el(doc, "th", "", k));
    kepala.append(tr);
    t.append(kepala);
    const badan = doc.createElement("tbody");
    for (const b of baris) {
      const r = el(doc, "tr", b.diusulkan ? "aleta-bebanstat-usul" : "");
      if (b.judul) r.title = b.judul;
      b.sel.forEach((isi, i) => {
        const td = el(doc, "td", i === 0 ? "aleta-bebanstat-nama" : "aleta-bebanstat-angka", isi);
        r.append(td);
      });
      badan.append(r);
    }
    t.append(badan);
    wadah.append(t);
    if (opsi && opsi.catatan) wadah.append(el(doc, "div", "aleta-bebanstat-catatan", opsi.catatan));
    return wadah;
  }

  const KOLOM = ["", "Berjalan", "Tahun ini", "30 hari (bagian)", "Kebendaan 6 bln (bagian)", "Beban"];

  function barisDari(daftar, total, usulSebut) {
    return (daftar || []).map((e) => ({
      diusulkan: Boolean(e.diusulkan),
      judul: e.alasan || "",
      sel: [
        `${e.urutan}. ${e.kode ? `${e.kode} ` : ""}${e.nama || ""}${e.diusulkan ? ` (${usulSebut})` : ""}`.replace(/\s+/g, " ").trim(),
        e.aktif,
        e.tahun,
        teks30(e),
        teksKebendaan(e, total),
        e.skor === null || e.skor === undefined ? "-" : koma(e.skor),
      ],
    }));
  }

  /**
   * Menggambar blok beban. Mengembalikan elemen, atau null bila usulan tidak
   * memuat statistik (server lama / gagal membaca) - pemanggil tidak menggambar apa pun.
   */
  function gambar(usulan, opsi) {
    const o = opsi || {};
    const doc = o.doc || (typeof document !== "undefined" ? document : null);
    const stat = usulan && usulan.statistik;
    if (!doc || !stat || stat.terbaca !== true) return null;

    const kotak = el(doc, "details", KELAS);
    kotak.setAttribute("data-bebanstat", "1");
    kotak.open = o.terbuka !== false;

    const sk = stat.sk || {};
    const ringkas = el(doc, "summary", "aleta-bebanstat-ringkas");
    ringkas.append(el(doc, "span", "aleta-bebanstat-ringkas-judul", "Beban penetapan"));
    ringkas.append(el(doc, "span", sk.dipakai ? "aleta-bebanstat-sk" : "aleta-bebanstat-sk aleta-bebanstat-awas", kalimatSk(stat)));
    kotak.append(ringkas);

    if ((sk.peringatan || []).length > 0) {
      const w = el(doc, "div", "aleta-bebanstat-kesesuaian aleta-bebanstat-awas");
      w.setAttribute("data-bebanstat-sk-perlu", "1");
      w.append(el(doc, "strong", "", "SK perlu diperbarui: "), doc.createTextNode("pegawai berikut sudah tidak sesuai - perbarui di halaman SK Majelis."));
      const ul = el(doc, "ul", "aleta-bebanstat-rekomendasi");
      for (const p of sk.peringatan) ul.append(el(doc, "li", "", p));
      w.append(ul);
      kotak.append(w);
    }

    const kes = usulan.kesesuaianSk;
    if (kes && kes.bunyi) {
      const k = el(doc, "div", `aleta-bebanstat-kesesuaian aleta-bebanstat-${STATUS_SK[kes.status] || "netral"}`);
      k.setAttribute("data-bebanstat-status", String(kes.status || ""));
      k.append(el(doc, "strong", "", kes.untuk === "tercatat" ? "Penetapan tercatat: " : "Usulan: "), doc.createTextNode(kes.bunyi));
      for (const r of kes.rinci || []) k.append(el(doc, "div", "aleta-bebanstat-catatan", r));
      kotak.append(k);
    }

    const rek = kalimatRekomendasi(stat);
    if (rek.length) {
      const wadah = el(doc, "ul", "aleta-bebanstat-rekomendasi");
      for (const r of rek) wadah.append(el(doc, "li", "", r));
      kotak.append(wadah);
    }
    const pmh = usulan.pmh || {};
    if (pmh.berbedaDariRekomendasi && pmh.rekomendasiBeban) {
      kotak.append(
        el(
          doc,
          "div",
          "aleta-bebanstat-catatan",
          `Majelis usulan (${pmh.majelisKode || "di luar SK"}) berbeda dari yang paling ringan bebannya (Majelis ${pmh.rekomendasiBeban.kode}); ` +
            "usulan Smart Majelis SIPP tetap dihormati - ubah di pilihan majelis bila perlu."
        )
      );
    }

    if ((stat.majelis || []).length > 0) {
      const luar = stat.luarSk || {};
      const catatan =
        luar.perkara > 0
          ? `Di luar SK: ${luar.perkara} perkara bermajelis tahun ini (${luar.hari30} dalam 30 hari).`
          : "";
      kotak.append(
        tabel(
          doc,
          "Majelis" + (stat.kebendaanPerkara ? " · perkara ini kebendaan: kebendaan dibagi rata tersendiri" : ""),
          KOLOM,
          barisDari(stat.majelis.map((m) => ({ ...m, nama: (m.anggotaKode || []).join(", "), kode: m.kode ? `Majelis ${m.kode}` : "" })), (stat.totalKebendaan6 || {}).majelis, "usulan"),
          { catatan }
        )
      );
    }
    kotak.append(tabel(doc, "Hakim", KOLOM, barisDari(stat.hakim, (stat.totalKebendaan6 || {}).hakim, "usulan"), {}));
    kotak.append(tabel(doc, "Panitera pengganti", KOLOM, barisDari(stat.panitera, (stat.totalKebendaan6 || {}).panitera, "usulan"), {}));
    kotak.append(tabel(doc, "Juru sita", KOLOM, barisDari(stat.jurusita, (stat.totalKebendaan6 || {}).jurusita, "usulan"), {}));

    const j = stat.jendela || {};
    kotak.append(
      el(
        doc,
        "div",
        "aleta-bebanstat-catatan",
        `Dihitung ${j.sekarang || ""}: 30 hari terakhir sejak ${j.dari30 || ""}, kebendaan sejak ${j.dari6 || ""}. ` +
          "Beban makin kecil makin diutamakan; usulan tetap dapat diubah petugas."
      )
    );
    return kotak;
  }

  /** Mengganti blok lama di wadah dengan yang baru (idempoten). */
  function tempelDi(wadah, usulan, opsi) {
    if (!wadah) return null;
    for (const lama of Array.from(wadah.querySelectorAll(":scope > [data-bebanstat]"))) lama.remove();
    const baru = gambar(usulan, { ...(opsi || {}), doc: wadah.ownerDocument });
    if (baru) wadah.appendChild(baru);
    return baru;
  }

  globalThis.aletaPenunjukanStatistik = {
    versi: "b1-20okt",
    gambar,
    tempelDi,
    murni: { kalimatOrang, kalimatSk, kalimatRekomendasi, teks30, teksKebendaan, STATUS_SK },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = globalThis.aletaPenunjukanStatistik;
})();
