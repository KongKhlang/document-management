const Files = {
  async uploadFile(file, folderId, onProgress) {
    const token = this.getAccessToken();
    if (!token) throw new Error('ไม่พบ Google Access Token กรุณาล็อกเอาต์แล้วล็อกอินใหม่อีกครั้ง');

    const metadata = {
      name: file.name,
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Drive Upload Response Error:', errorText);
        throw new Error(`Google API Error (${response.status}): ${response.statusText} - ${errorText}`);
      }

      if(onProgress) onProgress(100);

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  },
  
  async uploadMultipleFiles(files, folderId, onProgress) {
    const results = [];
    const totalFiles = files.length;
    let completed = 0;

    for (const file of files) {
      try {
        const result = await this.uploadFile(file, folderId, (prog) => {
          if (onProgress) {
            const overallProg = ((completed + (prog / 100)) / totalFiles) * 100;
            onProgress(overallProg);
          }
        });
        results.push(result);
        completed++;
        if (onProgress) onProgress((completed / totalFiles) * 100);
      } catch (error) {
        showToast(`ไฟล์ ${file.name} อัปโหลดล้มเหลว: ${error.message}`, 'error');
        throw error; // Re-throw to halt the submit process and prevent partial saves
      }
    }
    return results;
  },
  
  async deleteFile(driveFileId) {
    const token = this.getAccessToken();
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok && response.status !== 404) {
        throw new Error('ไม่สามารถลบไฟล์ใน Google Drive ได้');
      }
    } catch (error) {
      console.error('Delete File Error:', error);
      throw error;
    }
  },

  async trashFile(driveFileId) {
    if (!driveFileId) return;
    const token = this.getAccessToken();
    if (!token) return;
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trashed: true })
      });
      if (!response.ok && response.status !== 404) {
        console.warn('Trash file response not OK:', await response.text());
      }
    } catch (error) {
      console.error('Trash File Error:', error);
    }
  },

  async untrashFile(driveFileId) {
    if (!driveFileId) return;
    const token = this.getAccessToken();
    if (!token) return;
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trashed: false })
      });
      if (!response.ok && response.status !== 404) {
        console.warn('Untrash file response not OK:', await response.text());
      }
    } catch (error) {
      console.error('Untrash File Error:', error);
    }
  },
  
  async downloadFile(driveFileId, fileName) {
    try {
      const token = this.getAccessToken();
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('ดาวน์โหลดล้มเหลว');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download Error:', error);
      showToast('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
    }
  },
  
  getPreviewUrl(driveFileId) {
    return `https://drive.google.com/file/d/${driveFileId}/preview`;
  },
  
  getAccessToken() {
    if (!DMS.googleAccessToken) {
      DMS.googleAccessToken = sessionStorage.getItem('googleAccessToken');
    }
    return DMS.googleAccessToken;
  },
  
  setupDropZone(dropZoneId, fileInputId, previewId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    
    if (!dropZone || !fileInput) return;

    // Reset pending files array
    DMS.pendingFiles = [];

    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone-active');
      if (e.dataTransfer.files.length) {
        this.addPendingFiles(e.dataTransfer.files, previewId);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        this.addPendingFiles(fileInput.files, previewId);
        fileInput.value = ''; // Reset input to allow choosing same file
      }
    });
  },

  addPendingFiles(fileList, previewId) {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Prevent duplicate files in the preview list
      if (!DMS.pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
        DMS.pendingFiles.push(file);
      }
    }
    this.renderFilePreview(DMS.pendingFiles, previewId);
  },

  removePendingFile(index, previewId) {
    DMS.pendingFiles.splice(index, 1);
    this.renderFilePreview(DMS.pendingFiles, previewId);
  },

  renderFilePreview(files, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    if (!files || files.length === 0) {
      preview.innerHTML = '';
      return;
    }

    const html = files.map((file, idx) => `
      <div class="file-preview-item">
        <div class="file-preview-left">
          <span class="file-preview-icon">${getFileIcon(file.type || file.name.split('.').pop())}</span>
          <div>
            <div class="file-preview-name">${escapeHtml(file.name)}</div>
            <div class="file-preview-size">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button type="button" onclick="Files.removePendingFile(${idx}, '${previewId}')" class="btn-icon btn-icon-danger" title="เอาออก" style="padding: 0.25rem 0.5rem; font-size: 1rem;">
          ✕
        </button>
      </div>
    `).join('');

    preview.innerHTML = html;
  }
};
