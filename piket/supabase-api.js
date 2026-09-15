(function () {
  const db = window.siagaSupabase;
  const ok = (extra = {}) => ({ success: true, ...extra });
  const fail = (message) => ({ success: false, message });

  function loginEmail(username) {
    return `${String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-')}@siaga.local`;
  }

  async function allRows(table, columns = '*', configure = query => query) {
    const pageSize = 1000;
    const result = [];
    for (let from = 0; ; from += pageSize) {
      let query = db.from(table).select(columns).range(from, from + pageSize - 1);
      query = configure(query);
      const { data, error } = await query;
      if (error) throw error;
      result.push(...data);
      if (data.length < pageSize) return result;
    }
  }

  async function profileFor(userId) {
    const { data: profileId, error: idError } = await db.rpc('current_profile_id');
    if (idError || !profileId) throw idError || new Error('Profil sesi tidak ditemukan');
    const { data, error } = await db.from('profiles')
      .select('legacy_username,role,nama,kelas')
      .eq('id', profileId)
      .single();
    if (error) throw error;
    return { username: data.legacy_username, role: data.role, nama: data.nama, kelas: data.kelas };
  }

  async function documentationUrl(row) {
    if (!row.foto_path) return row.legacy_foto_url || '';
    const { data, error } = await db.storage.from('kejadian-bukti').createSignedUrl(row.foto_path, 3600);
    return error ? '' : data.signedUrl;
  }

  async function processLogin(data) {
    const { data: authData, error } = await db.auth.signInWithPassword({
      email: loginEmail(data.username),
      password: String(data.password || '')
    });
    if (error) return fail('Username atau password salah!');
    return ok({ user: await profileFor(authData.user.id) });
  }

  async function getCurrentUser() {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return fail('Sesi Supabase tidak aktif.');
    return ok({ user: await profileFor(data.user.id) });
  }

  async function getStudentsByClass(data) {
    const { data: students, error } = await db.from('profiles')
      .select('nama,kelas').eq('role', 'SISWA').eq('kelas', data.kelas).order('nama');
    if (error) throw error;
    return students;
  }

  async function getDashboardData(data) {
    const tanggal = data.tanggal;
    const [hadir, pantau, kejadian, piket] = await Promise.all([
      allRows('kehadiran', 'status', q => q.eq('tanggal', tanggal)),
      allRows('pemantauan_kelas', 'status_pembelajaran,ada_tugas', q => q.eq('tanggal', tanggal)),
      allRows('kejadian_harian', 'id', q => q.eq('tanggal', tanggal)),
      allRows('kehadiran_guru_piket', 'status_hadir', q => q.eq('tanggal', tanggal))
    ]);
    const count = code => hadir.filter(x => x.status === code).length;
    return ok({ stats: {
      hadir: count('H'), sakit: count('S'), izin: count('I'), alpa: count('A'), telat: count('T'),
      totalSiswa: hadir.length,
      kelasDipantau: pantau.length,
      kBerjalan: pantau.filter(x => x.status_pembelajaran === 'Pembelajaran berlangsung dengan guru').length,
      kGuruKosong: pantau.filter(x => ['Guru tidak hadir','Guru belum / tidak berada di kelas'].includes(x.status_pembelajaran)).length,
      kTanpaTugas: pantau.filter(x => ['Tidak Ada Tugas','Tidak ada tugas','-'].includes(x.ada_tugas)).length,
      totalKejadian: kejadian.length,
      piketHadir: piket.filter(x => x.status_hadir === 'HADIR').length,
      piketAbsen: piket.filter(x => x.status_hadir !== 'HADIR').length
    }});
  }

  async function saveAttendanceBatch(data) {
    const rows = (data.dataBatch || []).map(item => ({
      tanggal: data.tanggal, nama_siswa: item.nama, kelas: item.kelas,
      status: item.status, keterangan: item.keterangan || '-', penginput: data.penginput
    }));
    const { error } = await db.from('kehadiran').insert(rows);
    if (error) throw error;
    return ok({ message: 'Data kehadiran berhasil disimpan.' });
  }

  async function savePemantauan(data) {
    const { error } = await db.from('pemantauan_kelas').insert({
      tanggal: data.tanggal, hari: data.hari, kelas: data.kelas, jam_ke: data.jam,
      mapel: data.mapel, guru_seharusnya: data.guru, status_pembelajaran: data.status,
      ada_tugas: data.adaTugas, detail_tugas: data.detailTugas, catatan: data.catatan,
      guru_piket: data.penginput
    });
    if (error) throw error;
    return ok({ message: 'Pemantauan kelas berhasil dicatat.' });
  }

  async function saveKejadian(data) {
    let fotoUrl = null;
    if (data.fileData) {
      if (!window.SiagaDrive) throw new Error('Penghubung Google Drive belum dimuat');
      const uploaded = await window.SiagaDrive.uploadDataUrl(db, data.fileData, {
        app: 'piket', category: 'kejadian',
        fileName: data.fileName || 'bukti.jpg', mimeType: data.fileMimeType
      });
      fotoUrl = uploaded.url;
    }
    const student = String(data.deskripsi || '').match(/^Siswa:\s*(.*?)\s*\((.*?)\)\s*-/i);
    const { error } = await db.from('kejadian_harian').insert({
      tanggal: data.tanggal, kategori: data.kategori, sub_kategori: data.subKategori,
      deskripsi_kejadian: data.deskripsi, tindak_lanjut: data.tindakLanjut,
      guru_piket: data.penginput, foto_path: null, legacy_foto_url: fotoUrl,
      poin: Number(data.poin || 0),
      nama_siswa: student ? student[1].trim() : null,
      kelas_siswa: student ? student[2].trim() : null
    });
    if (error) throw error;
    return ok({ message: 'Kejadian berhasil dilaporkan.' });
  }

  async function savePresensiPiket(data) {
    const rows = (data.listPiket || []).map(item => ({
      tanggal: data.tanggal, nama_guru_piket: item.nama, status_hadir: item.status,
      keterangan_alasan: item.keterangan || '-', penginput: data.penginput
    }));
    const { error } = await db.from('kehadiran_guru_piket').insert(rows);
    if (error) throw error;
    return ok({ message: 'Presensi Tim Guru Piket berhasil dicatat.' });
  }

  async function getLogbook(data) {
    const [monitoring, incidents, teachers] = await Promise.all([
      allRows('pemantauan_kelas', '*', q => q.eq('tanggal', data.tanggal).order('created_at')),
      allRows('kejadian_harian', '*', q => q.eq('tanggal', data.tanggal).order('created_at')),
      allRows('kehadiran_guru_piket', '*', q => q.eq('tanggal', data.tanggal).order('created_at'))
    ]);
    const kejadian = await Promise.all(incidents.map(async x => ({
      kategori: x.kategori, sub: x.sub_kategori, deskripsi: x.deskripsi_kejadian,
      tindakLanjut: x.tindak_lanjut, piket: x.guru_piket,
      dokumentasi: await documentationUrl(x), poin: x.poin || 0
    })));
    return ok({ data: {
      pemantauan: monitoring.map(x => ({ kelas: x.kelas, jam: x.jam_ke, mapel: x.mapel,
        guru: x.guru_seharusnya, status: x.status_pembelajaran, tugas: x.detail_tugas, piket: x.guru_piket })),
      kejadian,
      guruPiket: teachers.map(x => ({ nama: x.nama_guru_piket, status: x.status_hadir, keterangan: x.keterangan_alasan }))
    }});
  }

  async function getSuperData() {
    const [attendance, incidents, teachers, monitoring] = await Promise.all([
      allRows('kehadiran', '*', q => q.order('tanggal')),
      allRows('kejadian_harian', '*', q => q.order('tanggal')),
      allRows('kehadiran_guru_piket', '*', q => q.order('tanggal')),
      allRows('pemantauan_kelas', '*', q => q.order('tanggal'))
    ]);
    const kejadian = await Promise.all(incidents.map(async x => ({
      tanggal: x.tanggal, kategori: x.kategori, sub: x.sub_kategori,
      deskripsi: x.deskripsi_kejadian, tindakLanjut: x.tindak_lanjut, piket: x.guru_piket,
      dokumentasi: await documentationUrl(x), poin: x.poin || 0
    })));
    return ok({ data: {
      kehadiran: attendance.map(x => ({ tanggal: x.tanggal, nama: x.nama_siswa, kelas: x.kelas,
        status: x.status, keterangan: x.keterangan_alasan || x.keterangan })),
      kejadian,
      kehadiranPiket: teachers.map(x => ({ tanggal: x.tanggal, nama: x.nama_guru_piket,
        status: x.status_hadir, keterangan: x.keterangan_alasan, penginput: x.penginput })),
      pemantauan: monitoring.map(x => ({ tanggal: x.tanggal, hari: x.hari, kelas: x.kelas,
        jam: x.jam_ke, mapel: x.mapel, guru: x.guru_seharusnya, status: x.status_pembelajaran,
        adaTugas: x.ada_tugas, detailTugas: x.detail_tugas, catatan: x.catatan, piket: x.guru_piket }))
    }});
  }

  const actions = { processLogin, getCurrentUser, getStudentsByClass, getDashboardData, saveAttendanceBatch,
    savePemantauan, saveKejadian, savePresensiPiket, getLogbook, getSuperData };

  window.siagaApi = async function (action, data = {}) {
    try {
      if (!actions[action]) return fail(`Action API tidak ditemukan: ${action}`);
      return await actions[action](data || {});
    } catch (error) {
      console.error(error);
      return fail(error.message || 'Terjadi kesalahan Supabase');
    }
  };
})();
