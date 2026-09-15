(function () {
  const CONFIG_PLACEHOLDER = 'TEMPEL_URL_WEB_APP_APPS_SCRIPT_DI_SINI';

  function configuredUrl() {
    const url = String(window.SIAGA_DRIVE_UPLOAD_URL || '').trim();
    if (!url || url === CONFIG_PLACEHOLDER || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
      throw new Error('URL Google Apps Script belum diisi di assets/drive-config.js');
    }
    return url;
  }

  function extensionFor(mimeType) {
    const map = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'application/pdf': 'pdf', 'video/mp4': 'mp4'
    };
    return map[mimeType] || 'bin';
  }

  async function accessToken(client) {
    if (!client) throw new Error('Koneksi Supabase tidak ditemukan');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error('Sesi login berakhir. Silakan login kembali melalui Portal SIAGA.');
    }
    return data.session.access_token;
  }

  async function send(client, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(configuredUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, accessToken: await accessToken(client) }),
        redirect: 'follow',
        signal: controller.signal
      });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); }
      catch (_) { throw new Error('Respons Apps Script tidak valid. Pastikan deployment dipilih: Jalankan sebagai Saya dan Yang memiliki akses: Siapa saja.'); }
      if (!result.success) throw new Error(result.message || 'Unggah ke Google Drive gagal');
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Unggahan terlalu lama. Periksa internet lalu coba lagi.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function uploadDataUrl(client, dataUrl, options) {
    const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new Error('Format file tidak valid');
    const mimeType = options.mimeType || match[1];
    const fileName = options.fileName || `lampiran-${Date.now()}.${extensionFor(mimeType)}`;
    return send(client, { ...options, mimeType, fileName, fileData: match[2] });
  }

  async function uploadBase64(client, base64, options) {
    const mimeType = options.mimeType || 'application/octet-stream';
    const fileName = options.fileName || `lampiran-${Date.now()}.${extensionFor(mimeType)}`;
    return send(client, { ...options, mimeType, fileName, fileData: base64 });
  }

  window.SiagaDrive = { uploadDataUrl, uploadBase64 };
})();
