"use strict";

/**
 * Jembatan ke dunia halaman SIPP.
 *
 * ============================================================================
 * KENAPA BERKAS INI TERPISAH
 * ============================================================================
 *
 * konten.js berjalan di dunia TERASING. Ia berbagi DOM dengan halaman SIPP,
 * tetapi tidak berbagi obyek JavaScript-nya - window.jQuery, window.CKEDITOR,
 * dan select2 milik halaman tidak terlihat dari sana sama sekali.
 *
 * Untuk isian biasa itu tidak jadi soal: menyetel value lalu melepas peristiwa
 * input dan change sudah cukup. Tetapi SIPP memakai select2 untuk daftar hakim
 * dan CKEditor untuk isian panjang, dan keduanya menyimpan nilainya di dalam
 * obyek JavaScript, bukan di DOM. Menyetel value pada elemen aslinya membuat
 * tampilannya berubah tanpa nilainya ikut berubah - dan yang tersimpan
 * kemudian bukan yang terlihat.
 *
 * Berkas ini berjalan di dunia UTAMA supaya dapat menyentuh obyek itu.
 *
 * ============================================================================
 * IA TIDAK MEMUTUSKAN APA PUN
 * ============================================================================
 *
 * Jembatan hanya mengerjakan tiga hal yang diminta: menyebutkan medan apa yang
 * ada di halaman, mengisi satu medan, dan menekan satu tombol. Ia tidak tahu
 * perkara, tidak tahu penunjukan, dan tidak menghubungi siapa pun.
 *
 * Seluruh keputusan - siapa yang ditunjuk, medan mana yang diisi, apakah
 * tombolnya boleh ditekan - dibuat di sisi lain dan sudah lewat pemeriksaan
 * kewenangan di server. Menaruh keputusan di sini berarti menaruhnya di dunia
 * yang sama dengan halaman SIPP, tempat skrip apa pun dapat memanggilnya.
 */

(function () {
  const TANDA = "aleta-jembatan";
  const TANDA_JAWAB = "aleta-jembatan-jawab";

  /**
   * Pemilih CSS yang aman untuk dijalankan.
   *
   * Penunjuk medan datang dari pengaturan ALETA, yang hanya dapat disunting
   * Super Admin. Meski begitu ia tetap diperiksa di sini: pemilih yang tidak
   * sah membuat querySelector melempar, dan lemparan di tengah pengisian
   * meninggalkan borang setengah terisi tanpa ada yang tahu medan mana yang
   * gagal.
   */
  function cariElemen(penunjuk) {
    if (typeof penunjuk !== "string" || penunjuk.trim() === "") return null;
    try {
      return document.querySelector(penunjuk);
    } catch (galat) {
      return null;
    }
  }

  /**
   * Tulisan yang berdiri TEPAT SESUDAH sebuah kotak centang atau radio.
   *
   * ==========================================================================
   * INI BENTUK HTML YANG PALING TUA, DAN SIPP MASIH MEMAKAINYA
   * ==========================================================================
   *
   * application/views/putusan/edit_putusan_akhir.php menulis Sumber Hukum
   * begini:
   *
   *   echo "<input type='checkbox' name='sumber_hukum[]' value=" . $row->id
   *        . " />" . $row->nama . "<br/>";
   *
   * Tidak ada <label>, tidak ada id - namanya SIMPUL TEKS telanjang di
   * sebelah kotaknya. Pencarian <label> karena itu memulangkan kosong, dan
   * yang terkirim ke ALETA sebagai "label" adalah nilainya: 8, 9, 10.
   *
   * Akibatnya tepat seperti yang terlihat di panel: keenam sumber hukum
   * bernilai nol, dan Sumber Hukum selalu menjawab "tidak ditemukan" pada
   * putusan yang jelas-jelas menyebut tiga di antaranya.
   *
   * Dibaca sampai <br>, kotak berikutnya, atau akhir induknya - itulah batas
   * satu butir pada bentuk penulisan ini.
   */
  function tulisanSesudah(elemen) {
    let kata = "";
    let simpul = elemen.nextSibling;
    while (simpul) {
      if (simpul.nodeType === 3) {
        kata += simpul.textContent || "";
      } else if (simpul.nodeType === 1) {
        const tag = simpul.tagName.toLowerCase();
        // <br> mengakhiri butir ini; kotak berikutnya apalagi.
        if (tag === "br" || tag === "input" || tag === "select" || tag === "textarea") break;
        kata += simpul.textContent || "";
      }
      simpul = simpul.nextSibling;
    }
    return kata.trim().slice(0, 80);
  }

  /** Label yang tampak untuk satu medan - dipakai mode baca borang. */
  function labelMedan(elemen) {
    if (elemen.id) {
      const label = document.querySelector(`label[for="${CSS.escape(elemen.id)}"]`);
      if (label) return String(label.textContent || "").trim().slice(0, 80);
    }

    // Kotak centang dan radio: yang menamainya hampir selalu tulisan di
    // sebelahnya, bukan <label> milik barisnya. Dicari SEBELUM induknya,
    // sebab <label> milik baris menamai SELURUH kelompok - "Sumber Hukum"
    // untuk keenam kotaknya sekaligus, yang membuat keenamnya kembar.
    const jenis = String(elemen.type || "").toLowerCase();
    if (jenis === "checkbox" || jenis === "radio") {
      const sebelah = tulisanSesudah(elemen);
      if (sebelah) return sebelah;
      // Sebagian borang membungkusnya: <label><input> Nusyuz</label>.
      const pembungkus = elemen.closest("label");
      if (pembungkus) {
        const isi = String(pembungkus.textContent || "").trim();
        if (isi) return isi.slice(0, 80);
      }
    }

    const induk = elemen.closest(".form-group, .control-group, tr, div");
    if (induk) {
      const label = induk.querySelector("label");
      if (label) return String(label.textContent || "").trim().slice(0, 80);
    }
    return "";
  }

  /** Penunjuk yang paling tidak mudah basi untuk satu elemen. */
  function penunjukUntuk(elemen) {
    if (elemen.id) return `#${CSS.escape(elemen.id)}`;
    const nama = elemen.getAttribute("name");
    if (nama) return `${elemen.tagName.toLowerCase()}[name="${nama}"]`;
    return "";
  }

  /**
   * Menyebutkan medan apa saja yang ada di halaman ini.
   *
   * Inilah yang membuat peta medan diisi dari kenyataan, bukan dari ingatan.
   * Nilai medannya TIDAK ikut disebutkan - yang dibutuhkan hanya namanya, dan
   * borang perkara yang sedang terbuka memuat data pihak berperkara.
   */
  function bacaBorang() {
    const hasil = [];
    const semua = document.querySelectorAll("input, select, textarea");

    for (const elemen of semua) {
      const jenisMasukan = String(elemen.type || "").toLowerCase();
      if (jenisMasukan === "hidden" || jenisMasukan === "password") continue;
      if (elemen.closest("#aleta-panel")) continue; // panel ALETA sendiri

      hasil.push({
        tag: elemen.tagName.toLowerCase(),
        jenisMasukan,
        nama: elemen.getAttribute("name") || "",
        id: elemen.id || "",
        penunjuk: penunjukUntuk(elemen),
        label: labelMedan(elemen),
        // Petunjuk bahwa medan ini bukan isian biasa, sehingga yang menyusun
        // petanya tahu harus memilih jenis apa.
        select2: Boolean(elemen.classList.contains("select2") || elemen.nextElementSibling?.classList?.contains("select2")),
        ckeditor: Boolean(window.CKEDITOR && elemen.id && window.CKEDITOR.instances && window.CKEDITOR.instances[elemen.id]),
        jumlahPilihan: elemen.tagName.toLowerCase() === "select" ? elemen.options.length : 0,
        // ====================================================================
        // ISI KOLOMNYA IKUT - SEPOTONG, DAN BUKAN DARI SEMBARANG KOLOM
        // ====================================================================
        //
        // Dipakai menebak peta kolom: kolom yang berisi nama juru sita yang
        // diusulkan ALETA hampir pasti kolom juru sita. Tebakan dari ISI dapat
        // diperiksa; tebakan dari nama kolom tidak.
        //
        // Kolom hidden dan password sudah disaring di atas, panel ALETA
        // sendiri juga. Yang tersisa dipotong 200 aksara - yang dicocokkan
        // nama dan tanggal, dan tidak ada gunanya membawa posita sepanjang
        // tiga halaman melintasi jembatan hanya untuk itu.
        nilai: String(elemen.value === null || elemen.value === undefined ? "" : elemen.value).slice(0, 200),
      });
      if (hasil.length >= 300) break;
    }

    return { ok: true, medan: hasil };
  }

  /**
   * Daftar pilihan satu medan, beserta apakah medannya sedang TAMPAK.
   *
   * ============================================================================
   * KENAPA "TAMPAK" IKUT DILAPORKAN
   * ============================================================================
   *
   * Borang Putusan Akhir menampilkan medan yang berbeda-beda menurut jenis
   * perkara dan status putusannya: faktor perceraian hanya muncul pada perkara
   * perceraian yang dikabulkan, alasan dispensasi hanya pada perkara dispensasi
   * kawin, keadaan istri hanya pada keadaan tertentu lagi. SIPP sendiri yang
   * menyembunyikan dan menampilkannya.
   *
   * Karena itu ekstensi tidak perlu tahu satu pun aturan itu: medan yang
   * tersembunyi TIDAK diisi, dan yang menentukan tersembunyi atau tidak adalah
   * halamannya sendiri. Aturan yang disalin ke ekstensi akan menyimpang diam-
   * diam pada hari SIPP mengubahnya.
   *
   * Yang dikembalikan APA ADANYA dari halaman - nilai dan tulisannya - supaya
   * tidak ada satu pun nomor pilihan SIPP yang perlu dihafal di tempat lain.
   */
  function bacaPilihan(penunjuk) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "medan_tidak_ketemu", penunjuk };

    const tampak = Boolean(elemen.offsetParent !== null || elemen.getClientRects().length);
    const tag = elemen.tagName.toLowerCase();

    if (tag === "select") {
      const pilihan = Array.from(elemen.options).map((opsi) => ({
        nilai: opsi.value,
        label: (opsi.textContent || "").trim(),
        terpilih: opsi.selected,
      }));
      return { ok: true, penunjuk, tag, tampak, nilaiSekarang: elemen.value, pilihan };
    }

    // Kelompok radio dibaca lewat namanya - "nusyuz" dan "tidak_nusyuz" adalah
    // dua elemen dengan satu nama, dan yang berarti bagi pemanggil adalah
    // kelompoknya, bukan salah satu kotaknya.
    if (tag === "input" && (elemen.type === "radio" || elemen.type === "checkbox")) {
      const nama = elemen.getAttribute("name") || "";
      const sekelompok = nama
        ? Array.from(document.querySelectorAll(`input[name="${CSS.escape(nama)}"]`))
        : [elemen];
      const pilihan = sekelompok.map((kotak) => ({
        nilai: kotak.value,
        label: (labelMedan(kotak) || kotak.value || "").trim(),
        terpilih: kotak.checked,
      }));
      const terpilih = sekelompok.find((kotak) => kotak.checked);
      return {
        ok: true,
        penunjuk,
        tag: elemen.type,
        tampak,
        nilaiSekarang: terpilih ? terpilih.value : "",
        pilihan,
      };
    }

    return { ok: true, penunjuk, tag, tampak, nilaiSekarang: elemen.value ?? "", pilihan: [] };
  }

  /**
   * Nilai satu medan APA ADANYA, termasuk yang dipegang CKEditor.
   *
   * ============================================================================
   * KENAPA INI TIDAK DAPAT DIKERJAKAN DENGAN elemen.value SAJA
   * ============================================================================
   *
   * Posita dan petitum pada layar Data Umum adalah CKEditor. CKEditor
   * menyimpan isinya di dalam obyek JavaScript miliknya sendiri dan baru
   * menyalinnya ke textarea asli ketika borangnya dikirim. Membaca
   * textarea-nya sebelum itu memulangkan isi TERAKHIR YANG TERSIMPAN - bukan
   * yang sedang diketik petugas.
   *
   * Bedanya justru paling besar tepat ketika bacaan ini dipakai: petugas baru
   * saja menempelkan positanya dan belum menekan Simpan. Membaca textarea di
   * saat itu memulangkan kekosongan, dan usulan yang lahir darinya akan
   * mengaku "tidak ditemukan" atas kalimat yang jelas terpampang di layar.
   *
   * Yang dikembalikan tidak dirapikan sedikit pun - tag HTML-nya utuh. Yang
   * membersihkannya adalah portal, di tempat yang dapat diuji.
   */
  function bacaNilai(penunjuk, jenis) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "medan_tidak_ketemu", penunjuk };

    const tampak = Boolean(elemen.offsetParent !== null || elemen.getClientRects().length);

    try {
      if (jenis === "kaya" && window.CKEDITOR && elemen.id) {
        const editor = window.CKEDITOR.instances && window.CKEDITOR.instances[elemen.id];
        if (editor) {
          // siap: CKEditor yang baru dibangun (blangko baru dibuka) belum
          // "ready" - setData sebelum itu dapat ditimpa isi awal textarea
          // ketika editornya selesai dibangun. konten.js menunggunya menurut
          // keadaan ini, bukan menurut jam. Versi tanpa .status: dianggap siap.
          const siap = !editor.status || editor.status === "ready";
          return { ok: true, penunjuk, tampak, sumber: "ckeditor", siap, nilai: String(editor.getData() || "") };
        }
        // CKEditor diminta tetapi tidak ada. Textarea-nya tetap dibaca - itu
        // jawaban terbaik yang tersisa - tetapi asalnya disebutkan, bukan
        // didiamkan.
        return {
          ok: true,
          penunjuk,
          tampak,
          sumber: "textarea",
          catatan: "ckeditor_tidak_ada",
          nilai: String(elemen.value === null || elemen.value === undefined ? "" : elemen.value),
        };
      }

      return {
        ok: true,
        penunjuk,
        tampak,
        sumber: "medan",
        nilai: String(elemen.value === null || elemen.value === undefined ? "" : elemen.value),
      };
    } catch (galat) {
      return { ok: false, alasan: String(galat.message || galat).slice(0, 200), penunjuk };
    }
  }

  /** Melepas peristiwa yang biasa ditunggu kerangka kerja halaman. */
  function lepasPeristiwa(elemen) {
    for (const nama of ["input", "change", "blur"]) {
      elemen.dispatchEvent(new Event(nama, { bubbles: true }));
    }
  }

  /**
   * Mengisi satu medan, lalu MEMBACANYA KEMBALI.
   *
   * Yang dikembalikan bukan "sudah diisi" melainkan nilai yang benar-benar
   * terbaca sesudahnya. Bedanya penting: select2 yang pilihannya belum dimuat
   * akan menerima setelan tanpa protes dan tetap kosong, dan tanpa pembacaan
   * ulang itu tampak berhasil.
   */
  function isiMedan(penunjuk, jenis, nilai) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "medan_tidak_ketemu", penunjuk };

    const teks = String(nilai === null || nilai === undefined ? "" : nilai);

    try {
      if (jenis === "kaya" && window.CKEDITOR && elemen.id) {
        const editor = window.CKEDITOR.instances && window.CKEDITOR.instances[elemen.id];
        if (editor) {
          // Belum siap = TIDAK diisi (lihat bacaNilai): isian yang ditimpa isi
          // awal editor tampak "terisi" lalu tersimpan kosong. Pemanggil
          // menunggu siap lalu mengulang.
          if (editor.status && editor.status !== "ready") {
            return { ok: false, alasan: "ckeditor_belum_siap", penunjuk, status: String(editor.status) };
          }
          editor.setData(teks);
          return { ok: true, terbaca: String(editor.getData() || "").trim() };
        }
        // CKEditor diminta tetapi tidak ada - jatuh ke isian biasa, dan itu
        // disebutkan, bukan didiamkan.
        elemen.value = teks;
        lepasPeristiwa(elemen);
        return { ok: true, terbaca: elemen.value, catatan: "ckeditor_tidak_ada" };
      }

      // Radio dan kotak centang tidak diisi dengan menyetel value - itu hanya
      // mengubah nilai yang DIKIRIMKAN kotak itu, bukan memilihnya. Yang benar
      // adalah menemukan anggota kelompok yang nilainya cocok lalu
      // mencentangnya. Tanpa cabang ini, "nusyuz" pada borang putusan tampak
      // terisi sementara yang tersimpan tetap kosong.
      if (elemen.tagName.toLowerCase() === "input" && (elemen.type === "radio" || elemen.type === "checkbox")) {
        const nama = elemen.getAttribute("name") || "";
        const sekelompok = nama
          ? Array.from(document.querySelectorAll(`input[name="${CSS.escape(nama)}"]`))
          : [elemen];
        const cocok =
          sekelompok.find((kotak) => String(kotak.value) === teks) ||
          sekelompok.find(
            (kotak) => (labelMedan(kotak) || "").trim().toLowerCase() === teks.trim().toLowerCase()
          );
        if (!cocok) return { ok: false, alasan: "pilihan_tidak_ada", penunjuk, diminta: teks };
        cocok.checked = true;
        lepasPeristiwa(cocok);
        const terpilih = sekelompok.find((kotak) => kotak.checked);
        return { ok: true, terbaca: terpilih ? terpilih.value : "" };
      }

      if (jenis === "pilih" || elemen.tagName.toLowerCase() === "select") {
        // Dicocokkan dengan nilai option lebih dulu, lalu dengan tulisannya.
        // SIPP kerap memakai id sebagai nilai dan nama orang sebagai tulisan,
        // dan pemanggil belum tentu tahu yang mana yang dipegang halaman ini.
        let terpilih = "";
        for (const pilihan of elemen.options || []) {
          if (String(pilihan.value) === teks) {
            terpilih = pilihan.value;
            break;
          }
        }
        if (!terpilih) {
          const bandingan = teks.trim().toLowerCase();
          for (const pilihan of elemen.options || []) {
            if (String(pilihan.textContent || "").trim().toLowerCase() === bandingan) {
              terpilih = pilihan.value;
              break;
            }
          }
        }
        if (!terpilih) {
          return {
            ok: false,
            alasan: "pilihan_tidak_ada",
            penunjuk,
            // Beberapa pilihan pertama ikut dikirim supaya yang membaca tahu
            // bentuk nilainya, tanpa memuntahkan seluruh daftar.
            contoh: [...(elemen.options || [])]
              .slice(0, 5)
              .map((x) => ({ nilai: x.value, tulisan: String(x.textContent || "").trim() })),
          };
        }

        elemen.value = terpilih;
        lepasPeristiwa(elemen);
        // select2 menyimpan nilainya sendiri; tanpa trigger jQuery, tampilannya
        // tidak ikut berubah walau nilainya sudah benar.
        if (window.jQuery) {
          try {
            window.jQuery(elemen).val(terpilih).trigger("change");
          } catch (galat) {
            /* halaman tanpa select2 - setelan biasa di atas sudah cukup */
          }
        }
        return { ok: true, terbaca: elemen.value };
      }

      elemen.value = teks;
      lepasPeristiwa(elemen);

      // Datepicker jQuery UI menyimpan tanggalnya terpisah dari value.
      if (jenis === "tanggal" && window.jQuery) {
        try {
          const kotak = window.jQuery(elemen);
          if (kotak.datepicker) kotak.datepicker("setDate", teks);
          kotak.trigger("change");
        } catch (galat) {
          /* bukan datepicker - value di atas sudah cukup */
        }
      }

      return { ok: true, terbaca: elemen.value };
    } catch (galat) {
      return { ok: false, alasan: String(galat.message || galat).slice(0, 200), penunjuk };
    }
  }

  /**
   * Apakah tombol ini sungguh TAMPAK bagi petugas.
   *
   * ==========================================================================
   * SIPP MENYEMBUNYIKAN, BUKAN MENGHAPUS
   * ==========================================================================
   *
   * Borang SIPP menyembunyikan tombol dengan jQuery .hide() - display:none,
   * elemennya TETAP di DOM. #simpan pada borang E-Doc, misalnya, tersembunyi
   * sampai berkasnya dipilih. Sampai 25 September 2026 jembatan hanya
   * memeriksa ada dan disabled, sehingga tombol yang tidak ditawarkan halaman
   * kepada petugas tetap dapat ditekan dari sini.
   *
   * Tiga pemeriksaan, masing-masing menangkap bentuk sembunyi yang lain:
   *   - display:none pada tombol atau salah satu leluhurnya (.hide()),
   *   - tanpa kotak tata letak: offsetParent null DAN getClientRects kosong
   *     (position:fixed sah ber-offsetParent null, tetapi tetap berkotak),
   *   - visibility hidden/collapse.
   */
  function tombolTampak(elemen) {
    const gayaDari = (simpul) => {
      try {
        return window.getComputedStyle(simpul);
      } catch (galat) {
        return null;
      }
    };
    for (let simpul = elemen; simpul && simpul.nodeType === 1; simpul = simpul.parentElement) {
      const gaya = gayaDari(simpul);
      if (gaya && gaya.display === "none") return false;
    }
    const gaya = gayaDari(elemen);
    if (gaya && (gaya.visibility === "hidden" || gaya.visibility === "collapse")) return false;
    return Boolean(elemen.offsetParent !== null || elemen.getClientRects().length);
  }

  /**
   * ==========================================================================
   * JAWABAN SIPP SENDIRI SEBAGAI BUKTI SIMPAN
   * ==========================================================================
   *
   * Borang Putusan Akhir dikirim SubmitHandling (resources/js/jquery-sipp.js):
   * $.ajax POST ke alamat action borang, yang menjawab {st, msg} - st 0 berarti
   * ditolak pengesahan ("Amar Putusan Tidak Boleh kurang dari 50 Karakter",
   * "Sumber Hukum Belum Dipilih", ...), st 1 berarti tersimpan. Pesan itu lalu
   * ditulis ke #pesan-container di dalam #popup_msg.
   *
   * Sampai 25 September 2026 jawaban itu tidak didengar sama sekali: ekstensi
   * menjajak basis data sepuluh kali sedetik sekali, lalu menyerah dengan
   * pesan umum - sementara sebab yang sebenarnya sudah tertulis di layar.
   *
   * Dua telinga; yang lebih dulu mendengar yang dipakai:
   *   1. ajaxComplete jQuery halaman untuk alamat action borang - {st, msg} utuh;
   *   2. #pesan-container yang terisi pesan BARU - bunyinya saja, tanpa st.
   * Jawabannya diteruskan lewat postMessage yang sama dengan jawaban jembatan
   * lain, bertanda id bukti yang dikirim pemintanya.
   *
   * Yang tidak terdengar dalam BATAS_DENGAR_SIMPAN_MS dilepas; pemintanya
   * punya batasnya sendiri dan kembali ke jajak basis data. Pesannya
   * diteruskan sebagai TEKS, bukan HTML - dibaca DOMParser yang tidak
   * menjalankan apa pun.
   */
  const BATAS_DENGAR_SIMPAN_MS = 60000;

  function alamatBaku(alamat) {
    try {
      const url = new URL(String(alamat || ""), location.href);
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch (galat) {
      return "";
    }
  }

  function teksDariHtml(html) {
    const mentah = String(html === null || html === undefined ? "" : html);
    try {
      const dokumen = new DOMParser().parseFromString(`<div>${mentah}</div>`, "text/html");
      for (const br of Array.from(dokumen.querySelectorAll("br"))) br.replaceWith(" ");
      return String(dokumen.body.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);
    } catch (galat) {
      return mentah.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
    }
  }

  function jawabanJson(xhr) {
    if (xhr && xhr.responseJSON && typeof xhr.responseJSON === "object") return xhr.responseJSON;
    try {
      const isi = JSON.parse(String((xhr && xhr.responseText) || ""));
      return isi && typeof isi === "object" ? isi : null;
    } catch (galat) {
      return null;
    }
  }

  function dengarJawabanSimpan(borang, id) {
    const alamat = alamatBaku(borang.getAttribute("action") || "");
    const jq = typeof window.jQuery === "function" ? window.jQuery : null;
    // jQuery lama milik sebagian halaman SIPP belum punya .on - .bind ada di semua versi.
    const pasang = jq && typeof jq.fn.on === "function" ? "on" : "bind";
    const lepasDari = jq && typeof jq.fn.off === "function" ? "off" : "unbind";
    const wadahAwal = document.querySelector("#pesan-container");
    const pesanSebelum = wadahAwal ? String(wadahAwal.innerHTML || "") : null;
    let terkirim = false;
    let selesai = false;

    const kabarkan = (isi) => {
      if (selesai) return;
      selesai = true;
      lepas();
      // Amplop ditulis terakhir - isi tidak boleh menimpanya (lihat pendengar pesan di bawah).
      window.postMessage({ ...isi, sumber: TANDA_JAWAB, id, jenis: "bukti-simpan" }, "*");
    };
    const padaKirim = (_peristiwa, _xhr, opsi) => {
      if (alamat && alamatBaku(opsi && opsi.url) === alamat) terkirim = true;
    };
    const padaSelesai = (_peristiwa, xhr, opsi) => {
      if (!alamat || alamatBaku(opsi && opsi.url) !== alamat) return;
      const isi = jawabanJson(xhr);
      const st = isi ? Number(isi.st) : NaN;
      kabarkan({
        asal: "ajax",
        st: st === 0 || st === 1 ? st : null,
        pesan: isi ? teksDariHtml(isi.msg) : teksDariHtml(xhr && xhr.responseText).slice(0, 300),
        status: Number((xhr && xhr.status) || 0),
      });
    };
    if (jq) {
      jq(document)[pasang]("ajaxSend", padaKirim);
      jq(document)[pasang]("ajaxComplete", padaSelesai);
    }
    const pengamat = setInterval(() => {
      const wadah = document.querySelector("#pesan-container");
      if (!wadah) return;
      const html = String(wadah.innerHTML || "");
      if (!html.trim() || html === pesanSebelum) return;
      kabarkan({ asal: "popup", st: null, pesan: teksDariHtml(html) });
    }, 250);
    const jam = setTimeout(lepas, BATAS_DENGAR_SIMPAN_MS);

    function lepas() {
      if (jq) {
        jq(document)[lepasDari]("ajaxSend", padaKirim);
        jq(document)[lepasDari]("ajaxComplete", padaSelesai);
      }
      clearInterval(pengamat);
      clearTimeout(jam);
    }

    return {
      lepas,
      // Dibaca SESUDAH tombol ditekan: ajaxSend jQuery lahir serempak di dalam
      // penekanan itu, jadi "tanpa-kiriman" berarti borangnya memang tidak
      // dikirim - konfirmasi SIPP dibatalkan, atau pengirimnya gagal.
      keadaan: () => (!jq ? "tanpa-jquery" : terkirim ? "terkirim" : "tanpa-kiriman"),
    };
  }

  /**
   * Menekan satu tombol.
   *
   * Dipakai hanya bila penyimpanan otomatis dinyalakan di pengaturan ALETA -
   * dan bawaannya mati. Jembatan tidak memeriksa setelan itu sendiri; ia hanya
   * mengerjakan yang diminta. Yang memeriksanya server, sebelum permintaan ini
   * pernah dikirim.
   *
   * Tombol yang tidak tampak TIDAK ditekan (lihat tombolTampak). Bila pemintanya
   * menyertakan bukti {borang, id}, tombolnya harus milik borang itu, dan
   * jawaban SIPP atas kiriman borangnya diteruskan dengan id itu.
   */
  /**
   * ==========================================================================
   * KONFIRMASI SIMPAN SIPP - DI-OK-KAN HANYA SELAMA TEKANAN ALETA SENDIRI
   * ==========================================================================
   *
   * Perbaikan 30 September 2026 (butir 10). SubmitHandling SIPP
   * (resources/js/jquery-sipp.js baris 131) memanggil
   *
   *   confirm("Apakah Anda Yakin Akan Menyimpan Data")
   *
   * SERENTAK di dalam peristiwa submit - yakni di dalam elemen.click() di
   * bawah. Selama dialog itu terbuka seluruh halaman berhenti, jawaban
   * jembatan tertahan, dan putusan otomatis menunggu tangan petugas.
   *
   * window.confirm diganti HANYA untuk satu click() ini dan dikembalikan di
   * finally - sebelum jembatan menjawab. Yang disetujui hanya kalimat itu,
   * tepat sama; konfirmasi lain (hapus, dan seterusnya) diteruskan ke
   * confirm asli. Tekanan tombol oleh ORANG tidak pernah lewat sini, jadi
   * konfirmasinya tetap ditanyakan seperti biasa. Hanya dipakai bila
   * pemintanya menyertakan setujuiKonfirmasi (konten.js, Baru & UI Baru).
   */
  const KONFIRMASI_SIMPAN_SIPP = "Apakah Anda Yakin Akan Menyimpan Data";

  function klikDenganKonfirmasiSimpan(elemen) {
    const asli = window.confirm;
    let disetujui = 0;
    const pengganti = function (pesan) {
      if (String(pesan === undefined || pesan === null ? "" : pesan).trim() === KONFIRMASI_SIMPAN_SIPP) {
        disetujui += 1;
        return true;
      }
      return typeof asli === "function" ? asli.apply(window, arguments) : false;
    };
    let terpasang = false;
    try {
      window.confirm = pengganti;
      terpasang = window.confirm === pengganti;
    } catch (galat) {
      terpasang = false;
    }
    try {
      elemen.click();
    } finally {
      if (terpasang && window.confirm === pengganti) {
        try {
          window.confirm = asli;
        } catch (galat) {
          /* tidak dapat dikembalikan - tidak pernah terjadi pada window biasa */
        }
      }
    }
    return disetujui > 0 ? "disetujui" : terpasang ? "tidak-muncul" : "tidak-terpasang";
  }

  function tekanTombol(penunjuk, bukti, setujuiKonfirmasi) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "tombol_tidak_ketemu", penunjuk };
    if (!tombolTampak(elemen)) return { ok: false, alasan: "tombol_tidak_tampak", penunjuk };
    if (elemen.disabled) return { ok: false, alasan: "tombol_mati", penunjuk };

    let telinga = null;
    if (bukti && typeof bukti === "object") {
      const borang = cariElemen(bukti.borang);
      if (!borang || !borang.contains(elemen)) return { ok: false, alasan: "tombol_di_luar_borang", penunjuk };
      telinga = dengarJawabanSimpan(borang, String(bukti.id || ""));
    }

    let konfirmasi = "";
    try {
      if (setujuiKonfirmasi === true) konfirmasi = klikDenganKonfirmasiSimpan(elemen);
      else elemen.click();
    } catch (galat) {
      if (telinga) telinga.lepas();
      return { ok: false, alasan: String(galat.message || galat).slice(0, 200) };
    }
    const jawab = telinga ? { ok: true, bukti: telinga.keadaan() } : { ok: true };
    if (setujuiKonfirmasi === true) jawab.konfirmasi = konfirmasi;
    return jawab;
  }

  window.addEventListener("message", (peristiwa) => {
    // Hanya pesan dari halaman ini sendiri. Bingkai lain dan jendela lain
    // tidak boleh menyuruh jembatan mengisi apa pun.
    if (peristiwa.source !== window) return;

    const pesan = peristiwa.data;
    if (!pesan || pesan.sumber !== TANDA) return;

    let jawab;
    if (pesan.jenis === "baca") {
      jawab = bacaBorang();
    } else if (pesan.jenis === "pilihan") {
      jawab = bacaPilihan(pesan.penunjuk);
    } else if (pesan.jenis === "nilai") {
      jawab = bacaNilai(pesan.penunjuk, pesan.jenisMedan);
    } else if (pesan.jenis === "isi") {
      jawab = isiMedan(pesan.penunjuk, pesan.jenisMedan, pesan.nilai);
    } else if (pesan.jenis === "tekan") {
      jawab = tekanTombol(pesan.penunjuk, pesan.bukti, pesan.setujuiKonfirmasi === true);
    } else {
      jawab = { ok: false, alasan: "permintaan_tidak_dikenali" };
    }

    // ========================================================================
    // AMPLOP JAWABAN TIDAK BOLEH DITIMPA ISINYA
    // ========================================================================
    //
    // bacaNilai menjawab dengan ruasnya sendiri bernama `sumber` ("ckeditor",
    // "textarea", "medan"). Sampai 5 Oktober 2026 ruas itu disebar SESUDAH
    // amplopnya dan MENIMPA sumber "aleta-jembatan-jawab" - konten.js tidak
    // pernah mengenali jawabannya, dan TIAP bacaan nilai berakhir pada batas
    // tunggu 5 detik. Setiap isian blangko (kirimKeJembatan membaca nilai
    // lama lebih dulu) karena itu tertahan 5 detik per kolom, dan tanggal
    // putusan untuk praperiksa tidak pernah terbaca. Kini amplopnya ditulis
    // TERAKHIR, dan ruas `sumber` isi jawaban berpindah ke `sumberNilai`.
    const isiJawab = { ...(jawab || {}) };
    if (Object.prototype.hasOwnProperty.call(isiJawab, "sumber")) {
      isiJawab.sumberNilai = isiJawab.sumber;
      delete isiJawab.sumber;
    }
    window.postMessage({ ...isiJawab, sumber: TANDA_JAWAB, id: pesan.id }, "*");
  });

  /**
   * ==========================================================================
   * BIDANG KETIK CKEDITOR LAHIR GELAP, BUKAN DIGELAPKAN SESUDAHNYA
   * ==========================================================================
   *
   * Isi bidang ketik berada di dalam iframe - dokumen tersendiri yang tidak
   * dicapai berkas gaya content script. konten.js menyisipkan gayanya lewat
   * contentDocument, tetapi penyisipan itu menyusul: ia dipicu pengamat DOM
   * yang ditahan 400 milidetik, dan CKEditor sudah menggambar bidangnya jauh
   * sebelum itu.
   *
   * Akibatnya kilatan PUTIH seluas layar tiap kali tingkap dibuka - dan pada
   * layar Putusan Akhir ada tiga bidang sekaligus. Bagi mata, kilatan putih di
   * antara dua keadaan gelap lebih menyakitkan daripada layar yang terang
   * sepanjang waktu.
   *
   * CKEDITOR.addCss menitipkan gaya ke SELURUH bidang ketik yang kelak
   * dibuat - CKEditor menuliskannya ke dalam dokumen iframe pada saat
   * membangunnya, sebelum satu piksel pun digambar. Tidak ada lagi yang
   * menyusul, jadi tidak ada lagi yang berkelebat.
   *
   * Berkas ini berjalan di dunia HALAMAN, dan hanya dari sinilah
   * window.CKEDITOR terlihat. Itu pula sebabnya ia dikerjakan di sini, bukan
   * di konten.js.
   *
   * Penanda temanya dibaca dari elemen html - satu-satunya hal yang memang
   * dibagi kedua dunia. Bila temanya terang, tidak ada yang dititipkan sama
   * sekali, dan CKEditor tampil persis seperti tanpa ekstensi ini.
   */
  const GAYA_ISI_CKEDITOR = [
    "html, body { background: #141d19 !important; color: #dfe8e2 !important; }",
    "body { caret-color: #7fd0a6; }",
    "a { color: #7fd0a6 !important; }",
    "table, td, th, hr { border-color: #27342e !important; }",
    "::selection { background: #22432f; color: #ffffff; }",
    // Naskah yang ditempel dari Word membawa warnanya sendiri, dan warna itu
    // hampir selalu hitam - hitam di atas gelap berarti hilang sama sekali.
    '[style*="color:#000"], [style*="color: #000"], [style*="color:black"],' +
      ' [style*="color: black"], [style*="color:rgb(0,0,0)"], [style*="color: rgb(0, 0, 0)"],' +
      ' font[color="#000000"], font[color="black"] { color: inherit !important; }',
    '[style*="background-color:#fff"], [style*="background-color: #fff"],' +
      ' [style*="background:#fff"], [style*="background: #fff"],' +
      ' [style*="background-color:white"], [style*="background-color: white"]' +
      " { background-color: transparent !important; }",
  ].join("\n");

  function temaGelap() {
    try {
      return document.documentElement.getAttribute("data-aleta-tema-sipp") === "gelap";
    } catch {
      return false;
    }
  }

  /**
   * Menitipkan gayanya ke CKEditor, dan menunggunya bila ia belum dimuat.
   *
   * SIPP memuat ckeditor.js pada sebagian halaman saja, dan urutan muatnya
   * tidak dijamin. Ditunggu sebentar dengan jam yang BERHENTI SENDIRI -
   * halaman tanpa CKEditor tidak boleh meninggalkan jam yang berdetak
   * selamanya hanya untuk menunggu sesuatu yang memang tidak ada.
   */
  function titipkanGayaCkeditor() {
    if (!temaGelap()) return;
    let sisa = 40; // 40 x 250ms = 10 detik
    const coba = () => {
      if (window.CKEDITOR && typeof window.CKEDITOR.addCss === "function") {
        if (!window.CKEDITOR.__aletaGaya) {
          window.CKEDITOR.__aletaGaya = true;
          window.CKEDITOR.addCss(GAYA_ISI_CKEDITOR);
        }
        return;
      }
      sisa -= 1;
      if (sisa > 0) setTimeout(coba, 250);
    };
    coba();
  }

  titipkanGayaCkeditor();
})();
