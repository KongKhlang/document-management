const Files = {
  async getAccessToken() {
    if (window.Auth && typeof Auth.getValidAccessToken === 'function') {
      return await Auth.getValidAccessToken();
    }
    let token = DMS.googleAccessToken || localStorage.getItem('googleAccessToken');
    return token;
  },

  async fetchWithAuth(url, options = {}) {
    let token = await this.getAccessToken();
    if (!token && window.Auth && typeof Auth.refreshGoogleToken === 'function') {
      token = await Auth.refreshGoogleToken(true);
    }
    if (!token) {
      throw new Error('ไม่พบสิทธิ์ Google Drive กรุณากดเชื่อมต่อสิทธิ์อีกครั้ง');
    }

    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;

    let response = await fetch(url, options);

    // If 401 Unauthorized (token expired), auto refresh and retry once
    if (response.status === 401) {
      console.warn('Google Drive API returned 401 Unauthorized. Attempting token refresh...');
      const newToken = await Auth.refreshGoogleToken(true);
      if (newToken) {
        options.headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, options);
      }
    }

    return response;
  },

  async uploadFile(file, targetFolderId, onProgress) {
    const folderId = targetFolderId || (typeof DRIVE_FOLDER_ID !== 'undefined' ? DRIVE_FOLDER_ID : null);
    const metadata = { name: file.name };
    if (folderId && folderId !== 'root') {
      metadata.parents = [folderId];
    }

    const createFormData = (meta) => {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', file);
      return form;
    };

    try {
      let response = await this.fetchWithAuth(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
        {
          method: 'POST',
          body: createFormData(metadata)
        }
      );

      // Fallback to root folder if specific folderId returns 404 Not Found
      if (response.status === 404 && metadata.parents) {
        console.warn(`Target folder '${folderId}' not found (404). Falling back to Google Drive root...`);
        delete metadata.parents;
        response = await this.fetchWithAuth(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
          {
            method: 'POST',
            body: createFormData(metadata)
          }
        );
      }

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
    try {
      const response = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
        method: 'DELETE'
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
    try {
      const response = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
        method: 'PATCH',
        headers: {
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
    try {
      const response = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
        method: 'PATCH',
        headers: {
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
  
  async downloadFile(driveFileId, fileName, buttonEl) {
    let originalHTML = '';
    if (buttonEl) {
      originalHTML = buttonEl.innerHTML;
      buttonEl.innerHTML = '<span class="spinner-inline" style="width: 14px; height: 14px; border-width: 2px;"></span>';
      buttonEl.style.pointerEvents = 'none';
      buttonEl.disabled = true;
    }
    showToast('กำลังเตรียมดาวน์โหลดไฟล์...', 'info');
    
    try {
      const response = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
      
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
      showToast('ดาวน์โหลดไฟล์สำเร็จ');
    } catch (error) {
      console.error('Download Error:', error);
      showToast('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
    } finally {
      if (buttonEl) {
        buttonEl.innerHTML = originalHTML;
        buttonEl.style.pointerEvents = 'auto';
        buttonEl.disabled = false;
      }
    }
  },
  
  getPreviewUrl(driveFileId) {
    return `https://drive.google.com/file/d/${driveFileId}/preview`;
  },
  
  setupDropZone(dropZoneId, fileInputId, previewId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    
    if (!dropZone || !fileInput) return;

    // Reset pending files array
    DMS.pendingFiles = [];

    dropZone.addEventListener('click', () => fileInput.click());
    
    const addMoreBtn = document.getElementById('btnAddMoreFilesBtn');
    if (addMoreBtn) {
      addMoreBtn.onclick = () => fileInput.click();
    }
    
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
    
    const dropZone = document.getElementById('topicDropZone');
    const addMoreBtn = document.getElementById('btnAddMoreFilesBtn');
    
    if (!files || files.length === 0) {
      preview.innerHTML = '';
      if (dropZone) dropZone.classList.remove('hidden');
      if (addMoreBtn) addMoreBtn.classList.add('hidden');
      return;
    }

    if (dropZone) dropZone.classList.add('hidden');
    if (addMoreBtn) addMoreBtn.classList.remove('hidden');

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
  },

  async getOrCreateDriveFolder() {
    try {
      const doc = await DMS.db.collection('settings').doc('driveConfig').get();
      if (doc.exists && doc.data().folderId) {
        DRIVE_FOLDER_ID = doc.data().folderId;
        return DRIVE_FOLDER_ID;
      }
    } catch (err) {
      console.error('Error fetching drive config settings:', err);
      showToast('ดึงข้อมูลการตั้งค่า Drive ล้มเหลว: ' + err.message, 'warning');
    }

    if (DMS.currentUser && DMS.currentUser.role === 'admin') {
      showToast('กำลังเตรียมสร้างโฟลเดอร์ระบบใน Google Drive...', 'info');
      try {
        const response = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'ระบบคลังเอกสาร',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (!response.ok) {
          const errTxt = await response.text();
          throw new Error('ไม่สามารถสร้างโฟลเดอร์ใน Google Drive: ' + errTxt);
        }
        const data = await response.json();
        const newFolderId = data.id;

        await DMS.db.collection('settings').doc('driveConfig').set({
          folderId: newFolderId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: DMS.currentUser.uid
        });

        DRIVE_FOLDER_ID = newFolderId;
        showToast('สร้างโฟลเดอร์คลังเอกสารใน Google Drive สำเร็จ');
        return DRIVE_FOLDER_ID;
      } catch (error) {
        console.error('Error creating central Drive folder:', error);
        showToast('สร้างโฟลเดอร์ล้มเหลว: ' + error.message, 'error');
      }
    }
    return null;
  },

  async initiateOwnershipTransfer(driveFileId, fileName) {
    if (!driveFileId || !FIRST_ADMIN_EMAIL) return;
    try {
      console.log(`Initiating ownership transfer for file: ${driveFileId} to ${FIRST_ADMIN_EMAIL}`);
      const response = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions?transferOwnership=true&sendNotificationEmail=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'user',
          role: 'owner',
          emailAddress: FIRST_ADMIN_EMAIL
        })
      });
      
      // Save pending transfer log in Firestore
      await DMS.db.collection('pendingTransfers').doc(driveFileId).set({
        fileName: fileName,
        uploadedBy: DMS.currentUser.uid,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      }).catch(err => console.error('Error saving pending transfer log:', err));

      if (!response.ok) {
        const errTxt = await response.text();
        console.warn('Failed to initiate ownership transfer:', errTxt);
      } else {
        console.log('Ownership transfer initiated successfully.');
      }
    } catch (e) {
      console.error('Error in initiateOwnershipTransfer:', e);
    }
  },

  async acceptOwnershipTransfers() {
    if (!DMS.currentUser || DMS.currentUser.role !== 'admin') return;
    try {
      const snap = await DMS.db.collection('pendingTransfers').where('status', '==', 'pending').get();
      if (snap.empty) return;

      console.log(`Found ${snap.size} pending ownership transfers to accept.`);
      for (const doc of snap.docs) {
        const transfer = doc.data();
        const driveFileId = doc.id;
        
        try {
          // 1. List permissions to find the permission ID of the admin
          const permsResponse = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions?fields=permissions(id,emailAddress,role)`);
          if (!permsResponse.ok) continue;
          const permsData = await permsResponse.json();
          const perms = permsData.permissions || [];
          
          // Find permission matching admin email
          const adminPerm = perms.find(p => p.emailAddress && p.emailAddress.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase());
          if (!adminPerm) {
            console.warn(`No pending owner permission found for admin on file ${driveFileId}`);
            continue;
          }

          // 2. Accept ownership transfer
          const acceptResponse = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions/${adminPerm.id}?transferOwnership=true`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'owner'
            })
          });
          
          if (acceptResponse.ok) {
            console.log(`Successfully accepted ownership for file ${transfer.fileName || driveFileId}`);
            await DMS.db.collection('pendingTransfers').doc(driveFileId).update({
              status: 'accepted',
              acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } else {
            console.warn(`Failed to accept transfer for file ${driveFileId}:`, await acceptResponse.text());
          }
        } catch (err) {
          console.error(`Error accepting transfer for file ${driveFileId}:`, err);
        }
      }
    } catch (e) {
      console.error('Error in acceptOwnershipTransfers:', e);
    }
  }
};

window.Files = Files;
