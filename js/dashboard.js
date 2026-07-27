const Dashboard = {
  init() {},
  
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
          <div class="mb-3">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-300">${escapeHtml(cat.name)}</span>
              <span class="text-slate-400">${cat.topicCount || 0}</span>
            </div>
            <div class="w-full bg-slate-700 rounded-full h-2">
              <div class="h-2 rounded-full transition-all duration-1000" style="width: ${percent}%; background-color: ${cat.color || '#6366f1'}"></div>
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
      
      // take top 5
      topics = topics.slice(0, 5);
      
      if(topics.length === 0) {
        listEl.innerHTML = '<div class="text-sm text-slate-400 text-center py-4">ไม่มีเอกสารล่าสุด</div>';
        return;
      }
      
      listEl.innerHTML = topics.map(topic => `
        <div class="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700/50" onclick="App.showTopicDetail('${topic.id}')">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
              ${topic.visibility === 'restricted' ? '🔒' : '📄'}
            </div>
            <div>
              <div class="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-xs">${escapeHtml(topic.title)}</div>
              <div class="text-xs text-slate-400">${formatDate(topic.updatedAt)}</div>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading recent topics:', error);
    }
  },
  
  async loadRecentActivity() {
    try {
      const listEl = document.getElementById('recentActivityList');
      if(!listEl) return;
      
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
      
      // Top 3 uploads
      uploads = uploads.slice(0, 3);
      
      if(uploads.length === 0) {
        listEl.innerHTML = '<div class="text-sm text-slate-400 text-center py-4">ไม่มีเอกสารอัปโหลดล่าสุด</div>';
        return;
      }
      
      listEl.innerHTML = uploads.map(doc => `
        <li style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start; width:100%;">
          <div style="font-weight:600; color:var(--text-primary); font-size:0.95rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; width:100%;">📄 ${escapeHtml(doc.title)}</div>
          <div style="font-size:0.83rem; color:var(--text-secondary);">
            👤 ผู้อัปโหลด: <span style="font-weight:500; color:var(--accent-primary);">${escapeHtml(doc.createdByName || doc.createdByEmail || 'ผู้ใช้งาน')}</span>
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted);">
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
