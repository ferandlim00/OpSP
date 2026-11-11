# RENCANA KERJA

## Tujuan
Membuat Sistem yang akan dapat dimanage dalam satu aplikasi
## Pengguna
Owner, Admin, Employee
## Hak Akses - 
1. **Owner** - Transaksi(CRUD), Produk(CRUD), stok(CRUD), Pelanggan(CRUD),supplier(CRUD), Pengiriman(CRUD),Role (CRUD), Setting(Gaji Karyawan,Lokasi Absen, Sistem Pembayaran,Info Profil )
2. **Admin** - Transaksi(CRU), Produk(CRU), stok(CRU), Pelanggan(CRUD), Supplier(RU), Presensi Kehadiran(CR),Pengiriman(CRU)
3. **Employee** - Produk(R), stok(R), Presensi Kehadiran(CR),Pengiriman(RU)

## Fitur 
1. **Dashboard** - Berisi Jumlah Pelanggan, Jumlah Stok secara total, Jumlah Pengiriman aktif, Jumlah Transaksi hari ini, Grafik Transaksi Bulanan,Presensi Kehadiran Hari ini
2. **Transaksi** - Barang yang dipesan, Pelanggan, Harga Barang, Jumlah , Total Harga, Status Transaksi, Bukti Pembayaran(link/foto), Catatan Transaksi
3. **Produk** - Nama Produk, Deskripsi Produk, Harga Produk, Stok Produk, Foto Produk, Keterangan.
4. **Stok** - Status Masuk,Pending,Keluar Produk, Keterangan Stok, Bukti Barang Masuk, Total Stok per produk
5. **Pelanggan** - Nama Pelanggan, Alamat Pelanggan, Nomor Telepon Pelanggan, Email Pelanggan (optional)
6. **Supplier** - Nama Supplier, Alamat Supplier, Nomor Telepon Supplier, Email Supplier (optional)
7. **Pengiriman** - Barang yang dikirim, Pelanggan, Kurir, Alamat Pengiriman, Status Pengiriman, Ongkir (optional akan di pengaturan Owner)
8. **Role** - CRUD Role Karyawan, Nama Karyawan, Username Karyawan, Email Karyawan, Role yang dipilih, Status Karyawan(Aktif/Tidak Aktif)
9. **Setting** - Nama Perusahaan, Alamat Perusahaan, Nomor Telepon Perusahaan, Email Perusahaan (optional), Logo Perusahaan (optional), Gaji per Hari/Bulan Karyawan (optional), Lokasi Absen (optional), Sistem Pembayaran Transaksi(opsional), Info Profil (optional), Jam masuk keluar karyawan(optional)
10. **Presensi Kehadiran** - Nama Karyawan, Role Karyawan, Status Presensi Kehadiran(Hadir/Tidak Hadir), Tanggal Presensi Kehadiran, Jam Presensi Kehadiran, Gaji yang di dapat, Potongan yang didapat, Total Gaji

## Aturan Bisnis
Setiap ada Transaksi, Absen, Produk, Masuk Barang wajib ada foto
DP bisa dan tagih di selesai pengantaran konsumen.
dalam transaksi produk akan dipending atau ditahan dan akan berkurang saat pengantaran selesai. lalu kalo batal maka masuk ke stok lagi.

## Batasan
Owner memilki akses penuh terhadap sistem
Admin pegang kendali Sistem sesuai Porsi Kerja tapi dalam rangka besar
Employee bertugas dibawah Admin dan Owner . Lalu hanya akan mengikuti perintah Admin.
Admin tidak dapat akses Sistem yang dimiliki Owner.
Employee tidak dapat akses Sistem yang dimiliki Admin dan Owner.

