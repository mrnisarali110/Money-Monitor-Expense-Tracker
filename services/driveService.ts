
// This service handles interactions with the Google Drive API directly via REST
// to avoid loading the heavy GAPI client library.

const DB_FILE_NAME = 'luxe_ledger_data.json';

// Search for the specific app data file
export const findAppDataFile = async (accessToken: string) => {
  const query = `name = '${DB_FILE_NAME}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) throw new Error('Failed to list files');
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
};

// Download the JSON content of the file
export const downloadAppData = async (accessToken: string, fileId: string) => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) throw new Error('Failed to download file');
  return await response.json();
};

// Create a new file with initial data
export const createAppDataFile = async (accessToken: string, data: any) => {
  const metadata = {
    name: DB_FILE_NAME,
    mimeType: 'application/json'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: form
  });

  if (!response.ok) throw new Error('Failed to create file');
  const result = await response.json();
  return result;
};

// Update existing file
export const updateAppDataFile = async (accessToken: string, fileId: string, data: any) => {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to update file');
  return await response.json();
};
