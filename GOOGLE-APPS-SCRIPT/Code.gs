/**
 * SIAGA - JEMBATAN UPLOAD GOOGLE DRIVE
 * Database tetap di Supabase. File disimpan di Google Drive.
 */

const SUPABASE_URL = 'https://wmirlnrreqypgljvgojz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UPh63Vm1KlwwVYyBuAjM8A_YvkFXn4p';
const ROOT_FOLDER_NAME = 'SIAGA_UPLOADS';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function doGet() {
  return json_({ success: true, message: 'SIAGA Drive Upload aktif' });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const user = verifySupabaseUser_(request.accessToken);
    const app = allowedApp_(request.app);
    const category = safeSegment_(request.category || 'umum');
    const fileName = safeFileName_(request.fileName || 'lampiran.bin');
    const mimeType = String(request.mimeType || 'application/octet-stream').toLowerCase();
    validateFileType_(app, mimeType, fileName);

    const bytes = Utilities.base64Decode(String(request.fileData || ''));
    if (!bytes.length) throw new Error('Isi file kosong');
    if (bytes.length > MAX_FILE_BYTES) throw new Error('Ukuran file melebihi 10 MB');

    const folder = getOrCreateFolder_(getOrCreateFolder_(rootFolder_(), app), category);
    const uniqueName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8) + '-' + fileName;
    const file = folder.createFile(Utilities.newBlob(bytes, mimeType, uniqueName));

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      file.setTrashed(true);
      throw new Error('Google Workspace melarang berbagi file melalui link. Minta admin mengizinkan Anyone with the link.');
    }

    file.setDescription('Diunggah dari SIAGA oleh akun Supabase: ' + (user.email || user.id));
    const viewUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    const displayUrl = mimeType.indexOf('image/') === 0
      ? 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600'
      : viewUrl;

    return json_({ success: true, fileId: file.getId(), url: displayUrl, viewUrl: viewUrl });
  } catch (error) {
    return json_({ success: false, message: String(error && error.message ? error.message : error) });
  }
}

function setupDrive() {
  const folder = rootFolder_();
  ['piket', 'bsan', 'supervisi'].forEach(function (name) {
    getOrCreateFolder_(folder, name);
  });
  Logger.log('Folder siap: ' + folder.getUrl());
}

function verifySupabaseUser_(token) {
  if (!token) throw new Error('Token login tidak ditemukan');
  const response = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'get',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Sesi login tidak valid atau sudah berakhir');
  }
  return JSON.parse(response.getContentText());
}

function allowedApp_(value) {
  const app = String(value || '').toLowerCase();
  if (['piket', 'bsan', 'supervisi'].indexOf(app) === -1) throw new Error('Nama aplikasi tidak diizinkan');
  return app;
}

function validateFileType_(app, mimeType, fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const rules = {
    piket: { mime: ['image/jpeg', 'image/png', 'image/webp'], ext: ['jpg', 'jpeg', 'png', 'webp'] },
    bsan: { mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4'], ext: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4'] },
    supervisi: {
      mime: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ext: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    }
  };
  const rule = rules[app];
  if (rule.mime.indexOf(mimeType) === -1 && rule.ext.indexOf(ext) === -1) {
    throw new Error('Jenis file tidak diizinkan untuk aplikasi ' + app);
  }
}

function rootFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('SIAGA_ROOT_FOLDER_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (_) {}
  }
  const existing = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  const folder = existing.hasNext() ? existing.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
  properties.setProperty('SIAGA_ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function safeSegment_(value) {
  return String(value || 'umum').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'umum';
}

function safeFileName_(value) {
  return String(value || 'lampiran.bin').replace(/[^a-zA-Z0-9._ -]/g, '-').slice(0, 140) || 'lampiran.bin';
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
