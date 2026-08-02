const Topics = {
  topics: [],
  currentView: 'grid',
  tempTags: [],
  initialized: false,
  
  init() {
    if (this.initialized) return;
    this.initialized = true;

    const bindClick = (id, handler) => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('click', handler);
    };

    bindClick('btnViewGrid', () => this.setView('grid'));
    bindClick('btnViewList', () => this.setView('list'));
    bindClick('btnAddTopic', () => this.showTopicModal());
    bindClick('btnSubmitTopic', () => this.handleTopicSubmit());
    bindClick('btnCloseTopicModal', () => hideModal('topicModal'));
    bindClick('btnBackToTopics', () => App.navigateTo('topics'));
    bindClick('btnUploadMore', () => this.handleUploadMore());
    bindClick('btnEmptyTrash', () => this.emptyTrash());
    bindClick('btnSaveShare', () => this.saveSharePermissions());
    
    const filterCat = document.getElementById('filterCategory');
    if(filterCat) filterCat.addEventListener('change', () => this.loadTopics());

    const filterType = document.getElementById('filterFileType');
    if(filterType) filterType.addEventListener('change', () => this.loadTopics());

    const sortSelect = document.getElementById('sortTopics');
    if(sortSelect) sortSelect.addEventListener('change', () => this.renderTopics());

    Files.setupDropZone('topicDropZone', 'topicFileInput', 'topicFilePreview');

    const radioPrivate = document.getElementById('visibilityPrivate');
    const radioPublic = document.getElementById('visibilityPublic');
    const radioRestricted = document.getElementById('visibilityRestricted');
    const allowedSection = document.getElementById('allowedViewersSection');

    if(radioPrivate) radioPrivate.addEventListener('change', () => {
      if(radioPrivate.checked) allowedSection.classList.add('hidden');
    });
    if(radioPublic) radioPublic.addEventListener('change', () => {
      if(radioPublic.checked) allowedSection.classList.add('hidden');
    });
    if(radioRestricted) radioRestricted.addEventListener('change', () => {
      if(radioRestricted.checked) allowedSection.classList.remove('hidden');
    });

    bindClick('btnAddViewer', () => {
      const select = document.getElementById('viewerEmailSelect');
      if(select && select.value) {
        this.addViewer(select.value);
        // Leave it selected or reset it
        select.value = '';
      }
    });

    // Tags input — press Enter to add tag
    const tagsInput = document.getElementById('topicTagsInput');
    if (tagsInput) {
      tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tag = tagsInput.value.trim();
          if (tag && !this.tempTags.includes(tag)) {
            this.tempTags.push(tag);
            this.renderTagsList();
          }
          tagsInput.value = '';
        }
      });
    }

    // Share modal — add email via Enter key
    const shareEmailInput = document.getElementById('shareEmailInput');
    if (shareEmailInput) {
      shareEmailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('btnAddShareEmail')?.click();
        }
      });
    }

    bindClick('btnAddShareEmail', () => {
      const input = document.getElementById('shareEmailInput');
      if (input && input.value) {
        this.addShareViewer(input.value.trim());
        input.value = '';
      }
    });

    DMS.tempAllowedViewers = [];
    DMS.shareViewers = [];
  },
  
  setView(view) {
    this.currentView = view;
    const list = document.getElementById('topicsList');
    const btnGrid = document.getElementById('btnViewGrid');
    const btnList = document.getElementById('btnViewList');
    if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
    if (btnList) btnList.classList.toggle('active', view === 'list');
    if(list) {
      list.className = view === 'grid' ? 'topics-grid' : 'topics-list';
      this.renderTopics();
    }
  },

  async loadTopics() {
    showLoading('topicsLoading');
    try {
      const catFilter = document.getElementById('filterCategory')?.value;
      
      let query = DMS.db.collection('topics').where('isDeleted', '==', false);
      if (catFilter) {
        query = query.where('categoryId', '==', catFilter);
      }
      
      const snapshot = await query.get();
      
      let results = [];
      snapshot.forEach(doc => {
        const topic = { id: doc.id, ...doc.data() };
        if (
          topic.visibility === 'public' ||
          topic.createdBy === DMS.currentUser.uid ||
          (topic.allowedViewers && topic.allowedViewers.includes(DMS.currentUser.email)) ||
          DMS.currentUser.role === 'admin'
        ) {
          results.push(topic);
        }
      });
      
      results.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      this.topics = results;
      this.renderTopics();
      
      if(Categories.categories.length === 0) await Categories.loadCategories();
      Categories.renderCategorySelect('filterCategory', catFilter);
      
    } catch (error) {
      console.error('Error loading topics:', error);
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
      hideLoading('topicsLoading');
    }
  },
  
  renderTopics() {
    const list = document.getElementById('topicsList');
    const empty = document.getElementById('topicsEmpty');
    
    if(!list) return;

    // Apply sort
    const sortSelect = document.getElementById('sortTopics');
    const sortBy = sortSelect?.value || 'newest';
    let sorted = [...this.topics];
    switch(sortBy) {
      case 'newest':
        sorted.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        break;
      case 'oldest':
        sorted.sort((a, b) => (a.updatedAt?.toMillis?.() || 0) - (b.updatedAt?.toMillis?.() || 0));
        break;
      case 'name':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'th'));
        break;
    }
    
    if(sorted.length === 0) {
      list.innerHTML = '';
      if(empty) empty.classList.remove('hidden');
      return;
    }
    
    if(empty) empty.classList.add('hidden');
    list.innerHTML = sorted.map(topic => this.renderTopicCard(topic)).join('');
  },
  
  renderTopicCard(topic, query = '') {
    const cat = Categories.getCategoryById(topic.categoryId);
    const catName = cat ? cat.name : 'ไม่มีหมวดหมู่';
    const catColor = cat ? cat.color : '#6366f1';
    
    const title = query ? Search.highlightMatch(topic.title, query) : escapeHtml(topic.title);
    const tags = (topic.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    
    if (this.currentView === 'grid') {
      return `
        <div class="topic-card" onclick="App.showTopicDetail('${topic.id}')">
          <div class="topic-card-header">
            <span class="category-badge" style="background-color: ${catColor}20; color: ${catColor}; border-color: ${catColor}40">
              ${escapeHtml(catName)}
            </span>
            <span class="visibility-icon" title="${topic.visibility === 'private' ? 'ส่วนตัว' : (topic.visibility === 'restricted' ? 'เฉพาะคนที่เลือก' : 'ทุกคนในระบบ')}">
              ${topic.visibility === 'private' ? '🔐' : (topic.visibility === 'restricted' ? '👥' : '🌐')}
            </span>
          </div>
          <h3 class="topic-card-title">${title}</h3>
          <p class="topic-card-desc">${escapeHtml(topic.description || '')}</p>
          ${tags ? `<div class="topic-card-tags">${tags}</div>` : ''}
          <div class="topic-card-footer">
            <div class="topic-card-stat">
              <span>📎</span> ${topic.fileCount || 0} ไฟล์
            </div>
            <div class="topic-card-date">${formatDate(topic.updatedAt)}</div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="topic-list-item" onclick="App.showTopicDetail('${topic.id}')">
          <div class="topic-list-icon">
            ${topic.visibility === 'private' ? '🔐' : (topic.visibility === 'restricted' ? '👥' : '📄')}
          </div>
          <div class="topic-list-info">
            <h3 class="topic-list-title">${title}</h3>
            <div class="topic-list-meta">
              <span style="color: ${catColor}">${escapeHtml(catName)}</span>
              <span>•</span>
              <span>${topic.fileCount || 0} ไฟล์ (${formatFileSize(topic.totalSize || 0)})</span>
              <span>•</span>
              <span>อัปเดต ${formatDate(topic.updatedAt)}</span>
            </div>
          </div>
          <div class="topic-list-arrow">›</div>
        </div>
      `;
    }
  },

  async loadTopicDetail(topicId) {
    DMS.currentTopicId = topicId;
    try {
      const doc = await DMS.db.collection('topics').doc(topicId).get();
      if(!doc.exists) {
        showToast('ไม่พบเอกสาร', 'error');
        App.navigateTo('topics');
        return;
      }
      
      const topic = { id: doc.id, ...doc.data() };
      
      // Access Control Verification
      const isOwner = topic.createdBy === DMS.currentUser.uid;
      const isAdmin = DMS.currentUser.role === 'admin';
      const isAllowedViewer = topic.visibility === 'restricted' && topic.allowedViewers && topic.allowedViewers.includes(DMS.currentUser.email);
      const isPublic = topic.visibility === 'public';

      if (!isOwner && !isAdmin && !isAllowedViewer && !isPublic) {
        showToast('คุณไม่มีสิทธิ์เข้าถึงเอกสารส่วนตัวนี้', 'error');
        App.navigateTo('topics');
        return;
      }

      DMS.currentTopicData = topic;
      
      const titleEl = document.getElementById('topicDetailTitle');
      const descEl = document.getElementById('topicDetailDescription');
      const catEl = document.getElementById('topicDetailCategory');
      const dateEl = document.getElementById('topicDetailDate');
      const creatorEl = document.getElementById('topicDetailCreatedBy');
      const visEl = document.getElementById('topicDetailVisibility');
      const fileCountEl = document.getElementById('topicDetailFileCount');
      const tagsEl = document.getElementById('topicDetailTags');
      
      if(titleEl) titleEl.textContent = topic.title;
      if(descEl) descEl.textContent = topic.description || '';
      if(dateEl) dateEl.textContent = formatDateTime(topic.updatedAt);
      if(creatorEl) creatorEl.textContent = topic.createdByName || topic.createdByEmail || 'ผู้ใช้ระบบ';
      
      const cat = Categories.getCategoryById(topic.categoryId);
      if(catEl) {
        catEl.textContent = cat ? cat.name : 'ไม่มีหมวดหมู่';
        if(cat) {
          catEl.style.backgroundColor = cat.color + '20';
          catEl.style.color = cat.color;
        }
      }
      
      if(visEl) {
        visEl.innerHTML = topic.visibility === 'private' 
          ? '🔐 ส่วนตัว' 
          : (topic.visibility === 'restricted' ? '👥 เฉพาะคนที่เลือก' : '🌐 ทุกคนในระบบ');
      }

      if(tagsEl) {
        tagsEl.innerHTML = (topic.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      }
      
      if(fileCountEl) fileCountEl.textContent = `${topic.fileCount || 0} ไฟล์ (${formatFileSize(topic.totalSize || 0)})`;

      const isEditor = DMS.currentUser.role === 'admin' || DMS.currentUser.role === 'editor' || topic.createdBy === DMS.currentUser.uid;
      
      const btnEdit = document.getElementById('btnEditTopic');
      const btnDelete = document.getElementById('btnDeleteTopic');
      const btnUploadMore = document.getElementById('btnUploadMore');
      
      if(btnEdit) btnEdit.classList.toggle('hidden', !isEditor);
      if(btnDelete) btnDelete.classList.toggle('hidden', !isEditor);
      if(btnUploadMore) btnUploadMore.classList.toggle('hidden', !isEditor);

      if(btnEdit) btnEdit.onclick = () => this.showTopicModal(topic);
      if(btnDelete) btnDelete.onclick = () => this.deleteTopic(topic.id);

      const filesSnap = await DMS.db.collection('topics').doc(topicId).collection('files').orderBy('order').get();
      const filesList = document.getElementById('topicFilesList');
      
      if(filesList) {
        if(filesSnap.empty) {
          filesList.innerHTML = '<div class="empty-state-sm">ยังไม่มีไฟล์ในเอกสารนี้</div>';
        } else {
          let html = '';
          filesSnap.forEach(fDoc => {
            const f = { id: fDoc.id, ...fDoc.data() };
            html += `
              <div class="file-item">
                <div class="file-item-left">
                  <div class="file-icon" style="color: ${getFileTypeColor(f.fileType)}">${getFileIcon(f.fileType)}</div>
                  <div>
                    <a href="${f.driveViewUrl || '#'}" target="_blank" class="file-name">${escapeHtml(f.fileName)}</a>
                    <div class="file-meta">${formatFileSize(f.fileSize)} • อัปโหลดเมื่อ ${formatDateTime(f.uploadedAt)}</div>
                  </div>
                </div>
                <div class="file-actions">
                  <button onclick="Files.downloadFile('${f.driveFileId}', '${escapeHtml(f.fileName)}', this)" class="btn-icon" title="ดาวน์โหลด">
                    ⬇️
                  </button>
                  ${isEditor ? `
                  <button onclick="Topics.deleteFile('${topicId}', '${f.id}', '${f.driveFileId}', ${f.fileSize})" class="btn-icon btn-icon-danger" title="ลบไฟล์">
                    🗑️
                  </button>
                  ` : ''}
                </div>
              </div>
            `;
          });
          filesList.innerHTML = html;
        }
      }

    } catch (error) {
      console.error('Error loading topic detail:', error);
      showToast('เกิดข้อผิดพลาดในการโหลดรายละเอียด', 'error');
    }
  },

  async deleteFile(topicId, fileId, driveFileId, fileSize) {
    if (!confirm('ยืนยันการลบไฟล์นี้?')) return;
    
    try {
      await DMS.db.collection('topics').doc(topicId).collection('files').doc(fileId).delete();
      
      await DMS.db.collection('topics').doc(topicId).update({
        fileCount: firebase.firestore.FieldValue.increment(-1),
        totalSize: firebase.firestore.FieldValue.increment(-(fileSize || 0))
      });
      
      try {
        await Files.deleteFile(driveFileId);
      } catch (driveErr) {
        console.warn('Failed to delete from Drive:', driveErr);
      }

      await DMS.db.collection('activityLog').add({
        action: 'delete_file',
        topicId: topicId,
        userId: DMS.currentUser.uid,
        userName: DMS.currentUser.displayName || DMS.currentUser.email,
        details: `ลบไฟล์ออกจากเอกสาร`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showToast('ลบไฟล์สำเร็จ');
      this.loadTopicDetail(topicId);
      
    } catch (error) {
      console.error('Delete file error:', error);
      showToast('เกิดข้อผิดพลาดในการลบไฟล์', 'error');
    }
  },

  async handleUploadMore() {
    if (!DMS.currentTopicId) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx';
    
    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      
      showToast(`กำลังอัปโหลด ${files.length} ไฟล์...`, 'info');
      
      try {
        const uploadResults = await Files.uploadMultipleFiles(files, DRIVE_FOLDER_ID);
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const batch = DMS.db.batch();
        let addedSize = 0;
        let addedCount = 0;
        
        for (let i = 0; i < uploadResults.length; i++) {
          const upRes = uploadResults[i];
          if (!upRes) continue;
          
          const origFile = files[i];
          const fileRef = DMS.db.collection('topics').doc(DMS.currentTopicId).collection('files').doc();
          batch.set(fileRef, {
            fileName: origFile.name,
            fileType: origFile.type || origFile.name.split('.').pop(),
            fileSize: origFile.size,
            driveFileId: upRes.id,
            driveViewUrl: upRes.webViewLink,
            driveDownloadUrl: upRes.webContentLink,
            uploadedBy: DMS.currentUser.uid,
            uploadedAt: now,
            order: (DMS.currentTopicData?.fileCount || 0) + i
          });
          addedSize += origFile.size;
          addedCount++;
        }
        
        await batch.commit();
        
        await DMS.db.collection('topics').doc(DMS.currentTopicId).update({
          fileCount: firebase.firestore.FieldValue.increment(addedCount),
          totalSize: firebase.firestore.FieldValue.increment(addedSize),
          updatedAt: now
        });

        if (DMS.currentTopicData?.visibility === 'restricted') {
          const allEmails = [DMS.currentUser.email, ...(DMS.currentTopicData.allowedViewers || [])];
          await DrivePermissions.syncPermissions(DMS.currentTopicId, allEmails);
        }
        
        showToast(`อัปโหลด ${addedCount} ไฟล์สำเร็จ`);
        this.loadTopicDetail(DMS.currentTopicId);
        
      } catch (error) {
        console.error('Upload more error:', error);
        showToast('เกิดข้อผิดพลาดในการอัปโหลด', 'error');
      }
    };
    
    input.click();
  },

  openShareModal() {
    if (!DMS.currentTopicData) return;
    const topic = DMS.currentTopicData;
    
    DMS.shareViewers = [...(topic.allowedViewers || [])];
    
    this.renderShareViewersList();
    showModal('shareModal');
  },

  addShareViewer(email) {
    if (!email || !email.includes('@')) {
      showToast('อีเมลไม่ถูกต้อง', 'warning');
      return;
    }
    if (!DMS.shareViewers.includes(email)) {
      DMS.shareViewers.push(email);
      this.renderShareViewersList();
    }
  },

  removeShareViewer(email) {
    DMS.shareViewers = DMS.shareViewers.filter(e => e !== email);
    this.renderShareViewersList();
  },

  renderShareViewersList() {
    const list = document.getElementById('shareViewersList');
    if (!list) return;
    
    if (DMS.shareViewers.length === 0) {
      list.innerHTML = '<div class="text-secondary" style="padding: 8px;">ยังไม่ได้เพิ่มผู้เข้าถึง</div>';
      return;
    }
    
    list.innerHTML = DMS.shareViewers.map(email => `
      <div class="viewer-item">
        <span class="viewer-email">👤 ${escapeHtml(email)}</span>
        <button type="button" onclick="Topics.removeShareViewer('${escapeHtml(email)}')" class="btn-icon-sm">✕</button>
      </div>
    `).join('');
  },

  async saveSharePermissions() {
    if (!DMS.currentTopicId) return;
    
    try {
      await DMS.db.collection('topics').doc(DMS.currentTopicId).update({
        allowedViewers: DMS.shareViewers,
        visibility: DMS.shareViewers.length > 0 ? 'restricted' : 'public',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      const syncCheckbox = document.getElementById('syncDriveCheckbox');
      if (syncCheckbox?.checked) {
        const allEmails = [DMS.currentUser.email, ...DMS.shareViewers];
        await DrivePermissions.syncPermissions(DMS.currentTopicId, allEmails);
      }
      
      showToast('บันทึกสิทธิ์การเข้าถึงสำเร็จ');
      hideModal('shareModal');
      this.loadTopicDetail(DMS.currentTopicId);
      
    } catch (error) {
      console.error('Save share error:', error);
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  },

  async loadAllowedUsersSelect() {
    try {
      const select = document.getElementById('viewerEmailSelect');
      if (!select) return;
      
      const snapshot = await DMS.db.collection('users')
        .where('status', '==', 'approved')
        .get();
        
      let html = '<option value="">-- เลือกผู้ใช้จากระบบ --</option>';
      snapshot.forEach(doc => {
        const u = doc.data();
        if (u.email !== DMS.currentUser.email) {
          const name = u.displayName ? `${u.displayName} (${u.email})` : u.email;
          html += `<option value="${escapeHtml(u.email)}">${escapeHtml(name)}</option>`;
        }
      });
      select.innerHTML = html;
    } catch (err) {
      console.error('Error loading allowed users list:', err);
    }
  },

  showTopicModal(topic = null) {
    DMS.editingTopicId = topic ? topic.id : null;
    document.getElementById('topicModalTitle').textContent = topic ? 'แก้ไขเอกสาร' : 'เพิ่มเอกสารใหม่';
    
    document.getElementById('topicForm').reset();
    Categories.renderCategorySelect('topicCategorySelect', topic ? topic.categoryId : null);
    
    document.getElementById('topicFilePreview').innerHTML = '';
    DMS.pendingFiles = []; // Reset pending files queue
    DMS.tempAllowedViewers = [];
    this.tempTags = [];
    
    const fileInput = document.getElementById('topicFileInput');
    if (fileInput) fileInput.value = '';

    // Always keep dropzone visible so editors can attach files during edit
    const dropZone = document.getElementById('topicDropZone');
    if (dropZone) dropZone.classList.remove('hidden');

    this.loadAllowedUsersSelect();

    if (topic) {
      document.getElementById('topicTitleInput').value = topic.title;
      document.getElementById('topicDescInput').value = topic.description || '';
      this.tempTags = [...(topic.tags || [])];
      
      if (topic.visibility === 'restricted') {
        const rRestricted = document.getElementById('visibilityRestricted');
        if (rRestricted) rRestricted.checked = true;
        document.getElementById('allowedViewersSection').classList.remove('hidden');
        DMS.tempAllowedViewers = [...(topic.allowedViewers || [])];
      } else if (topic.visibility === 'public') {
        const rPublic = document.getElementById('visibilityPublic');
        if (rPublic) rPublic.checked = true;
        document.getElementById('allowedViewersSection').classList.add('hidden');
      } else {
        const rPrivate = document.getElementById('visibilityPrivate');
        if (rPrivate) rPrivate.checked = true;
        document.getElementById('allowedViewersSection').classList.add('hidden');
      }
    } else {
      // Default new topic to Private
      const rPrivate = document.getElementById('visibilityPrivate');
      if (rPrivate) rPrivate.checked = true;
      document.getElementById('allowedViewersSection').classList.add('hidden');
    }
    
    this.renderTagsList();
    this.renderViewersList();
    showModal('topicModal');
  },

  removeTag(tag) {
    this.tempTags = this.tempTags.filter(t => t !== tag);
    this.renderTagsList();
  },

  renderTagsList() {
    const list = document.getElementById('topicTagsList');
    if (!list) return;
    list.innerHTML = this.tempTags.map(tag => `
      <span class="tag tag-removable">
        ${escapeHtml(tag)}
        <button type="button" onclick="Topics.removeTag('${escapeHtml(tag)}')" class="tag-remove">✕</button>
      </span>
    `).join('');
  },

  addViewer(email) {
    if (!email || !email.includes('@')) {
      showToast('อีเมลไม่ถูกต้อง', 'warning');
      return;
    }
    if (!DMS.tempAllowedViewers.includes(email)) {
      DMS.tempAllowedViewers.push(email);
      this.renderViewersList();
    }
  },

  removeViewer(email) {
    DMS.tempAllowedViewers = DMS.tempAllowedViewers.filter(e => e !== email);
    this.renderViewersList();
  },

  renderViewersList() {
    const list = document.getElementById('viewersList');
    if (!list) return;
    
    list.innerHTML = DMS.tempAllowedViewers.map(email => `
      <div class="viewer-item">
        <span class="viewer-email">👤 ${escapeHtml(email)}</span>
        <button type="button" onclick="Topics.removeViewer('${escapeHtml(email)}')" class="btn-icon-sm">✕</button>
      </div>
    `).join('');
  },

  async handleTopicSubmit() {
    const title = document.getElementById('topicTitleInput').value.trim();
    const description = document.getElementById('topicDescInput').value.trim();
    const categoryId = document.getElementById('topicCategorySelect').value;
    
    let visibility = 'private';
    const rPublic = document.getElementById('visibilityPublic');
    const rRestricted = document.getElementById('visibilityRestricted');
    
    if (rPublic && rPublic.checked) {
      visibility = 'public';
    } else if (rRestricted && rRestricted.checked) {
      visibility = 'restricted';
    } else {
      visibility = 'private';
    }
    
    if (!title || !categoryId) {
      showToast('กรุณากรอกชื่อและเลือกหมวดหมู่', 'warning');
      return;
    }

    const files = DMS.pendingFiles || [];
    
    // Require files only when creating a new topic
    if (!DMS.editingTopicId && files.length === 0) {
      showToast('กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์', 'warning');
      return;
    }

    const btnSubmit = document.getElementById('btnSubmitTopic');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-inline"></span> กำลังบันทึก...';

    try {
      const keywords = tokenizeForSearch(`${title} ${description} ${this.tempTags.join(' ')}`);
      const now = firebase.firestore.FieldValue.serverTimestamp();
      
      let topicData = {
        title,
        description,
        categoryId,
        visibility,
        tags: this.tempTags,
        searchKeywords: keywords,
        updatedAt: now
      };

      if (visibility === 'restricted') {
        topicData.allowedViewers = DMS.tempAllowedViewers;
      } else {
        topicData.allowedViewers = [];
      }

      let topicId = DMS.editingTopicId;

      if (!topicId) {
        // Create new — include uploader and time stamp metadata
        topicData.createdBy = DMS.currentUser.uid;
        topicData.createdByEmail = DMS.currentUser.email;
        topicData.createdByName = DMS.currentUser.displayName || DMS.currentUser.email;
        topicData.createdAt = now;
        topicData.isDeleted = false;
        topicData.fileCount = 0;
        topicData.totalSize = 0;
        
        const docRef = await DMS.db.collection('topics').add(topicData);
        topicId = docRef.id;
        
        await DMS.db.collection('categories').doc(categoryId).update({
          topicCount: firebase.firestore.FieldValue.increment(1)
        }).catch(() => {});
      } else {
        // Update existing
        await DMS.db.collection('topics').doc(topicId).update(topicData);
      }

      // Handle files upload from pendingFiles list
      if (files.length > 0) {
        const uploadResults = await Files.uploadMultipleFiles(files, DRIVE_FOLDER_ID);
        
        let addedSize = 0;
        let addedCount = 0;
        const batch = DMS.db.batch();
        
        for (let i = 0; i < uploadResults.length; i++) {
          const upRes = uploadResults[i];
          if(!upRes) continue;
          
          const file = files[i];
          if (!file) continue;
          
          const fileRef = DMS.db.collection('topics').doc(topicId).collection('files').doc();
          batch.set(fileRef, {
            fileName: file.name,
            fileType: file.type || file.name.split('.').pop(),
            fileSize: file.size,
            driveFileId: upRes.id,
            driveViewUrl: upRes.webViewLink,
            driveDownloadUrl: upRes.webContentLink,
            uploadedBy: DMS.currentUser.uid,
            uploadedAt: now,
            order: i
          });
          addedSize += file.size;
          addedCount++;
        }
        
        await batch.commit();
        
        await DMS.db.collection('topics').doc(topicId).update({
          fileCount: firebase.firestore.FieldValue.increment(addedCount),
          totalSize: firebase.firestore.FieldValue.increment(addedSize)
        });
      }
      
      if (visibility === 'restricted' && DrivePermissions.syncPermissions) {
        const finalAllowed = [DMS.currentUser.email, ...DMS.tempAllowedViewers];
        await DrivePermissions.syncPermissions(topicId, finalAllowed);
      }

      for (const tag of this.tempTags) {
        const tagRef = DMS.db.collection('tags').doc(tag.toLowerCase());
        const tagDoc = await tagRef.get();
        if (tagDoc.exists) {
          await tagRef.update({ count: firebase.firestore.FieldValue.increment(1) });
        } else {
          await tagRef.set({ name: tag, count: 1 });
        }
      }
      
      await DMS.db.collection('activityLog').add({
        action: DMS.editingTopicId ? 'update_topic' : 'create_topic',
        topicId: topicId,
        userId: DMS.currentUser.uid,
        userName: DMS.currentUser.displayName || DMS.currentUser.email,
        details: DMS.editingTopicId ? `อัปเดตเอกสาร: ${title}` : `สร้างและอัปโหลดเอกสาร: ${title}`,
        timestamp: now
      });

      showToast('บันทึกเอกสารสำเร็จ');
      hideModal('topicModal');
      
      if (DMS.currentPage === 'topics') {
        this.loadTopics();
      } else if (document.getElementById('topicDetailPage') && !document.getElementById('topicDetailPage').classList.contains('hidden')) {
        this.loadTopicDetail(topicId);
      }

    } catch (error) {
      console.error('Submit error:', error);
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  },
  
  async deleteTopic(topicId) {
    if(!confirm('ยืนยันการย้ายเอกสารนี้ไปที่ถังขยะ? (ไฟล์แนบบน Google Drive จะถูกย้ายไปถังขยะด้วย)')) return;
    
    try {
      const doc = await DMS.db.collection('topics').doc(topicId).get();
      if (!doc.exists) return;
      const catId = doc.data().categoryId;
      
      // Move attached files on Google Drive to Trash
      const filesSnap = await DMS.db.collection('topics').doc(topicId).collection('files').get();
      for (const fDoc of filesSnap.docs) {
        const f = fDoc.data();
        if (f.driveFileId) {
          try {
            await Files.trashFile(f.driveFileId);
          } catch (e) {
            console.warn('Drive file trash failed:', e);
          }
        }
      }
      
      await DMS.db.collection('topics').doc(topicId).update({
        isDeleted: true,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedBy: DMS.currentUser.uid
      });
      
      if(catId) {
        await DMS.db.collection('categories').doc(catId).update({
          topicCount: firebase.firestore.FieldValue.increment(-1)
        }).catch(() => {});
      }

      await DMS.db.collection('activityLog').add({
        action: 'delete_topic',
        topicId: topicId,
        userId: DMS.currentUser.uid,
        userName: DMS.currentUser.displayName || DMS.currentUser.email,
        details: `ย้ายเอกสาร "${doc.data().title}" และไฟล์แนบไปถังขยะ`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showToast('ย้ายไปถังขยะแล้ว');
      App.navigateTo('topics');
      
    } catch (error) {
      console.error('Delete error:', error);
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  },
  
  async loadTrash() {
    try {
      let query = DMS.db.collection('topics').where('isDeleted', '==', true);
      if (DMS.currentUser.role !== 'admin') {
        query = query.where('createdBy', '==', DMS.currentUser.uid);
      }
      
      const snapshot = await query.get();
      const list = document.getElementById('trashList');
      const empty = document.getElementById('trashEmpty');
      
      if(!list) return;
      
      if(snapshot.empty) {
        list.innerHTML = '';
        if(empty) empty.classList.remove('hidden');
        return;
      }
      
      if(empty) empty.classList.add('hidden');
      
      let html = '';
      snapshot.forEach(doc => {
        const topic = { id: doc.id, ...doc.data() };
        html += `
          <div class="trash-item">
            <div class="trash-item-info">
              <div class="trash-item-title">${escapeHtml(topic.title)}</div>
              <div class="trash-item-meta">ลบเมื่อ: ${formatDateTime(topic.deletedAt)} • ${topic.fileCount || 0} ไฟล์</div>
            </div>
            <div class="trash-item-actions">
              <button onclick="Topics.restoreTopic('${topic.id}', '${topic.categoryId}')" class="btn-secondary btn-sm">กู้คืน</button>
              ${DMS.currentUser.role === 'admin' ? `
                <button onclick="Topics.permanentDeleteTopic('${topic.id}')" class="btn-danger btn-sm">ลบถาวร</button>
              ` : ''}
            </div>
          </div>
        `;
      });
      
      list.innerHTML = html;
      
    } catch(error) {
      console.error('Trash error', error);
    }
  },
  
  async restoreTopic(topicId, categoryId) {
    try {
      // Untrash attached files on Google Drive
      const filesSnap = await DMS.db.collection('topics').doc(topicId).collection('files').get();
      for (const fDoc of filesSnap.docs) {
        const f = fDoc.data();
        if (f.driveFileId) {
          try {
            await Files.untrashFile(f.driveFileId);
          } catch (e) {
            console.warn('Drive file untrash failed:', e);
          }
        }
      }

      await DMS.db.collection('topics').doc(topicId).update({
        isDeleted: false,
        deletedAt: firebase.firestore.FieldValue.delete(),
        deletedBy: firebase.firestore.FieldValue.delete()
      });
      
      if(categoryId) {
        await DMS.db.collection('categories').doc(categoryId).update({
          topicCount: firebase.firestore.FieldValue.increment(1)
        }).catch(() => {});
      }
      
      showToast('กู้คืนเอกสารและไฟล์แนบสำเร็จ');
      this.loadTrash();
    } catch (error) {
      console.error('Restore error', error);
      showToast('กู้คืนล้มเหลว', 'error');
    }
  },

  async permanentDeleteTopic(topicId) {
    if (!confirm('⚠️ ลบถาวร? ไม่สามารถกู้คืนได้! ไฟล์บน Google Drive จะถูกลบถาวร')) return;
    
    try {
      const filesSnap = await DMS.db.collection('topics').doc(topicId).collection('files').get();
      const batch = DMS.db.batch();
      
      for (const fDoc of filesSnap.docs) {
        const f = fDoc.data();
        if (f.driveFileId) {
          try {
            await Files.deleteFile(f.driveFileId);
          } catch (e) { console.warn('Drive delete failed:', e); }
        }
        batch.delete(fDoc.ref);
      }
      await batch.commit();
      
      await DMS.db.collection('topics').doc(topicId).delete();
      
      showToast('ลบถาวรสำเร็จ');
      this.loadTrash();
    } catch (error) {
      console.error('Permanent delete error:', error);
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  async emptyTrash() {
    if (!confirm('⚠️ ล้างถังขยะทั้งหมด? ไม่สามารถกู้คืนได้!')) return;
    
    try {
      const snapshot = await DMS.db.collection('topics').where('isDeleted', '==', true).get();
      for (const doc of snapshot.docs) {
        await this.permanentDeleteTopic(doc.id);
      }
      showToast('ล้างถังขยะสำเร็จ');
      this.loadTrash();
    } catch (error) {
      console.error('Empty trash error:', error);
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  }
};
