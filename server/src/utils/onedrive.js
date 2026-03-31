const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

function isConfigured() {
  return !!(AZURE_CLIENT_ID && AZURE_TENANT_ID && AZURE_CLIENT_SECRET);
}

async function getAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, { method: 'POST', body });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function uploadFile(fileName, fileBuffer) {
  if (!isConfigured()) {
    console.log('OneDrive not configured, skipping');
    return null;
  }

  try {
    const token = await getAccessToken();
    const uploadUrl = `https://graph.microsoft.com/v1.0/drive/root:/FirstChair/${fileName}:/content`;
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return { fileId: data.id, webUrl: data.webUrl };
  } catch (err) {
    console.error('OneDrive upload failed:', err.message);
    return null;
  }
}

export async function getFileUrl(fileId) {
  if (!isConfigured()) {
    console.log('OneDrive not configured, skipping');
    return null;
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0/drive/items/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Get file failed: ${res.status}`);
    const data = await res.json();
    return data.webUrl;
  } catch (err) {
    console.error('OneDrive getFileUrl failed:', err.message);
    return null;
  }
}

export async function deleteFile(fileId) {
  if (!isConfigured()) {
    console.log('OneDrive not configured, skipping');
    return null;
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0/drive/items/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
    return true;
  } catch (err) {
    console.error('OneDrive delete failed:', err.message);
    return null;
  }
}
