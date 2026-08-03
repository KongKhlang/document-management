const Dashboard = {
  initialized: false,
  init() {
    if (this.initialized) return;
    this.initialized = true;
  },
  
  async loadDashboard() {
    await Promise.all([
      this.loadStats(),
      this.loadCategoryChart(),
      this.loadRecentTopics(),
      this.loadRecentActivity()
    ]);
  },
  
  async loadStats() {
    try {
      const topicsSnap = await DMS.db.collection('topics').where('isDeleted', '==', false).get();
      let totalFiles = 0;
      let totalSize = 0;
      let topicCount = 0;
      
      topicsSnap.forEach(doc => {
        const data = doc.data();
        if (
          data.visibility === 'public' ||
          data.createdBy === DMS.currentUser.uid ||
          (data.allowedViewers && data.allowedViewers.includes(DMS.currentUser.email)) ||
          DMS.currentUser.role === 'admin'
        ) {
          topicCount++;
          totalFiles += (data.fileCount || 0);
          totalSize += (data.totalSize || 0);
        }
      });
      
      const statTopics = document.getElementById('statTopics');
      const statFiles = document.getElementById('statFiles');
      const statStorage = document.getElementById('statStorage');
      
      if(statTopics) statTopics.textContent = topicCount;
      if(statFiles) statFiles.textContent = totalFiles;
      if(statStorage) statStorage.textContent = formatFileSize(totalSize);

      if (DMS.currentUser.role === 'admin') {
        const usersSnap = await DMS.db.collection('users').get();
        const statUsers = document.getElementById('statUsers');
        if(statUsers) statUsers.textContent = usersSnap.size;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },
  
  async loadCategoryChart() {
    try {
      const chartEl = document.getElementById('categoryChart');
      if(!chartEl) return;
      
      if(Categories.categories.length === 0) await Categories.loadCategories();
      const categories = Categories.categories;
      
      const maxCount = Math.max(...categories.map(c => c.topicCount || 0), 1);
      
      let html = categories.filter(c => c.topicCount > 0).map(cat => {
        const percent = ((cat.topicCount || 0) / maxCount) * 100;
        return `
          <div style="margin-bottom: 1rem; width: 100%;">
            <div class="flex" style="justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.35rem;">
              <span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(cat.name)}</span>
              <span style="font-weight: 600; color: var(--text-secondary);">${cat.topicCount || 0} หัวข้อ</span>
            </div>
            <div style="width: 100%; background: var(--bg-secondary); border-radius: 9999px; height: 8px; overflow: hidden;">
              <div style="height: 8px; border-radius: 9999px; transition: width var(--transition); width: ${percent}%; background-color: ${cat.color || '#6366f1'}"></div>
            </div>
          </div>
        `;
      }).join('');
      
      if(!html) html = '<div class="text-sm text-slate-400 text-center py-4">ไม่มีข้อมูล</div>';
      chartEl.innerHTML = html;
    } catch (error) {
      console.error('Error loading category chart:', error);
    }
  },
  
  async loadRecentTopics() {
    try {
      const listEl = document.getElementById('recentTopicsList');
      if(!listEl) return;
      
      const snapshot = await DMS.db.collection('topics')
        .where('isDeleted', '==', false)
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();
        
      let topics = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (
          data.visibility === 'public' ||
          data.createdBy === DMS.currentUser.uid ||
          (data.allowedViewers && data.allowedViewers.includes(DMS.currentUser.email)) ||
          DMS.currentUser.role === 'admin'
        ) {
          topics.push({ id: doc.id, ...data });
        }
      });
      
      topics = topics.slice(0, 5);
      
      if(topics.length === 0) {
        listEl.innerHTML = '<div class="text-sm text-slate-400 text-center py-4">ไม่มีเอกสารล่าสุด</div>';
        return;
      }
      
      listEl.innerHTML = topics.map(topic => `
        <div class="flex items-center justify-between" style="padding: 0.75rem 1rem; background: var(--bg-card); border-radius: 12px; cursor: pointer; transition: all var(--transition); border: 1px solid var(--card-border); margin-bottom: 0.5rem; box-shadow: var(--shadow-sm);" onclick="App.showTopicDetail('${topic.id}')" onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.borderColor='var(--card-border)'; this.style.transform='translateY(0)';">
          <div class="flex items-center gap-3">
            <div style="width: 38px; height: 38px; border-radius: 10px; background-color: var(--bg-secondary); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
              ${topic.visibility === 'private' ? '🔐' : (topic.visibility === 'restricted' ? '👥' : '📄')}
            </div>
            <div>
              <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(topic.title)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(topic.updatedAt)}</div>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading recent topics:', error);
    }
  },
  
  async loadRecentActivity() {
    const listEl = document.getElementById('recentActivityList');
    if(!listEl) return;
    try {
      const snapshot = await DMS.db.collection('topics')
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .get();
        
      let uploads = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (
          data.visibility === 'public' ||
          data.createdBy === DMS.currentUser.uid ||
          (data.allowedViewers && data.allowedViewers.includes(DMS.currentUser.email)) ||
          DMS.currentUser.role === 'admin'
        ) {
          uploads.push({ id: doc.id, ...data });
        }
      });
      
      uploads = uploads.slice(0, 3);
      
      if(uploads.length === 0) {
        listEl.innerHTML = '<div class="text-sm text-slate-400 text-center py-4">ไม่มีเอกสารอัปโหลดล่าสุด</div>';
        return;
      }
      
      listEl.innerHTML = uploads.map(doc => `
        <li style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start; width:100%; list-style:none; padding: 0.75rem 1rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--card-border); margin-bottom: 0.5rem; box-shadow: var(--shadow-sm);">
          <div style="font-weight:600; color:var(--text-primary); font-size:0.9rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; width:100%;">📄 ${escapeHtml(doc.title)}</div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">
            👤 ผู้อัปโหลด: <span style="font-weight:500; color:var(--accent-primary);">${escapeHtml(doc.createdByName || doc.createdByEmail || 'ผู้ใช้งาน')}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            📅 เมื่อ: ${formatDateTime(doc.createdAt)}
          </div>
        </li>
      `).join('');
    } catch (error) {
      console.error('Error loading recent uploads:', error);
      listEl.innerHTML = '<div class="text-sm text-slate-400 text-center py-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
    }
  }
};
