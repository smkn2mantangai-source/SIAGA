# Panduan SIAGA: Supabase untuk Data, Google Drive untuk File

Paket ini sudah diubah agar:

- data siswa, guru, absensi, nilai, piket, BSAN, dan supervisi tetap disimpan di Supabase;
- foto Piket, lampiran BSAN, dan dokumen Supervisi yang baru disimpan di Google Drive;
- tautan file Google Drive dicatat di tabel Supabase;
- file lama yang sudah berada di Supabase Storage tetap dapat dibuka;
- Portal SIAGA dan SIAGA Mengajar tidak berubah.

Tidak perlu menjalankan SQL baru dan tidak perlu menghapus database Supabase.

**Catatan untuk paket ini:** URL Web App Google Apps Script sudah dimasukkan ke `assets/drive-config.js`. Anda tidak perlu mengerjakan Bagian D lagi, kecuali nanti membuat deployment baru dengan URL berbeda.

## Bagian A — Membuat penghubung Google Drive

1. Buka [Google Apps Script](https://script.google.com/).
2. Klik **Proyek baru**.
3. Ganti nama proyek menjadi **SIAGA DRIVE UPLOAD**.
4. Hapus semua tulisan yang ada di editor `Code.gs`.
5. Di paket ini, buka folder `GOOGLE-APPS-SCRIPT`, lalu buka file `Code.gs`.
6. Salin seluruh isi file tersebut dan tempel ke editor Google Apps Script.
7. Klik tombol **Simpan**.

## Bagian B — Memberikan izin Google Drive

1. Di bagian atas editor, pilih fungsi **setupDrive**.
2. Klik **Jalankan**.
3. Saat muncul permintaan izin, pilih akun Google pemilik Drive.
4. Jika muncul peringatan **Google belum memverifikasi aplikasi ini**, klik **Lanjutan**, lalu pilih **Buka SIAGA DRIVE UPLOAD (tidak aman)**.
5. Klik **Izinkan**.
6. Buka Google Drive. Pastikan muncul folder bernama `SIAGA_UPLOADS`.

Folder tersebut akan berisi:

- `piket` untuk foto kejadian;
- `bsan` untuk bukti dan dokumentasi BSAN;
- `supervisi` untuk dokumen guru.

## Bagian C — Men-deploy sebagai Web App

1. Di kanan atas Apps Script, klik **Deploy** → **Deployment baru**.
2. Klik ikon roda gigi, lalu pilih **Aplikasi web**.
3. Isi pengaturannya:
   - **Deskripsi**: `SIAGA Drive Upload`;
   - **Jalankan sebagai**: `Saya`;
   - **Yang memiliki akses**: `Siapa saja`.
4. Klik **Deploy**.
5. Salin **URL aplikasi web**. URL yang benar berakhir dengan `/exec`.
6. Coba buka URL itu di browser. Jika benar, akan muncul pesan `SIAGA Drive Upload aktif`.

Walaupun deployment dapat diakses siapa saja, proses unggah tetap memeriksa sesi login Supabase. Orang yang tidak memiliki sesi login SIAGA tidak dapat mengunggah file.

## Bagian D — Memasukkan URL ke aplikasi

1. Buka file `assets/drive-config.js`.
2. Cari baris ini:

```javascript
window.SIAGA_DRIVE_UPLOAD_URL = 'TEMPEL_URL_WEB_APP_APPS_SCRIPT_DI_SINI';
```

3. Ganti tulisan di antara tanda petik dengan URL `/exec` dari Bagian C. Contoh:

```javascript
window.SIAGA_DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxxx/exec';
```

4. Simpan file.

Jangan memasukkan URL halaman editor Apps Script. Gunakan URL **Aplikasi web** yang berakhir `/exec`.

## Bagian E — Mengunggah ke GitHub

1. Ekstrak ZIP paket ini.
2. Buka folder `SIAGA-main` hasil ekstrak.
3. Unggah **isi di dalam folder tersebut** ke repository GitHub lama Anda.
4. Saat GitHub menanyakan file dengan nama yang sama, timpa dengan file baru.
5. Pastikan dua file baru ini ikut terunggah:
   - `assets/drive-config.js`
   - `assets/drive-upload.js`
6. Folder `GOOGLE-APPS-SCRIPT` dan panduan ini boleh tetap berada di GitHub. Keduanya tidak mengganggu aplikasi.
7. Tunggu GitHub Pages memperbarui website, biasanya beberapa menit.

## Bagian F — Pengujian

Lakukan satu per satu:

1. Login melalui Portal SIAGA.
2. Buka SIAGA Piket, buat satu kejadian, dan unggah satu foto kecil.
3. Periksa Google Drive: file harus muncul di `SIAGA_UPLOADS/piket/kejadian`.
4. Periksa tabel `kejadian_harian` di Supabase: kolom `legacy_foto_url` berisi tautan Drive dan `foto_path` kosong.
5. Buka SIAGA BSAN dan unggah satu foto bukti.
6. Periksa folder `SIAGA_UPLOADS/bsan`.
7. Buka SIAGA Supervisi dan unggah satu PDF kecil.
8. Periksa folder `SIAGA_UPLOADS/supervisi`.
9. Buka kembali data tersebut dari aplikasi untuk memastikan foto atau dokumennya dapat dibuka.

SIAGA Mengajar tidak memiliki unggahan file. Absensi, nilai, dan jurnalnya tetap langsung masuk ke tabel Supabase.

## Jika muncul pesan gagal

### “URL Google Apps Script belum diisi”

Periksa `assets/drive-config.js`. Pastikan URL berakhir `/exec` dan tidak ada salah ketik.

### “Respons Apps Script tidak valid”

Deploy ulang dan pastikan:

- **Jalankan sebagai** dipilih `Saya`;
- **Yang memiliki akses** dipilih `Siapa saja`;
- URL yang digunakan berasal dari deployment, bukan URL editor.

### “Sesi login tidak valid atau sudah berakhir”

Kembali ke Portal, logout, lalu login kembali.

### “Google Workspace melarang berbagi file melalui link”

Akun sekolah membatasi fitur **Siapa saja yang memiliki link**. Pengaturan ini harus diizinkan oleh administrator Google Workspace atau Apps Script perlu menggunakan akun Drive lain yang mengizinkannya.

## Catatan privasi

File dibuat dengan akses **siapa saja yang memiliki link dapat melihat** agar gambar dan dokumen dapat dibuka dari website GitHub Pages. Tautannya disimpan di Supabase. Jangan menyebarkan tautan file BSAN yang bersifat rahasia kepada orang yang tidak berwenang.
