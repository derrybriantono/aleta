# Archive Unused

File di folder ini tidak direferensikan oleh alur utama `app.js` berdasarkan audit `require/import`, `package.json`, Dockerfile, dan script runtime.

- `article-zi.js`: modul standalone artikel, tidak di-require oleh entry point utama.
- `notif-surat.js`: modul notifikasi surat standalone, tidak di-require oleh entry point utama.
- `ptsp.js`: modul PTSP standalone, tidak di-require oleh entry point utama.
- `db_config2.js`: konfigurasi database yang hanya dipakai oleh `notif-surat.js`.
- `db_config3.js`: konfigurasi database yang hanya dipakai oleh `ptsp.js`.
- `reg.js`: file kosong.
- `server.js`: server WebSocket percobaan, tidak dipakai oleh `app.js` dan dependency `ws` tidak tercatat di `package.json`.

Jika ternyata salah satu file ini masih dipanggil manual dari cron/PM2 di luar repository, pindahkan kembali ke root project sebelum menjalankan job tersebut.
