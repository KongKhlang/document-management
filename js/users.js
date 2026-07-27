const Users = {
  init() {
    const tabPending = document.getElementById('tabPending');
    const tabAllUsers = document.getElementById('tabAllUsers');
    
    if (tabPending) tabPending.addEventListener('click', () => {
      tabPending.classList.add('border-indigo-500', 'text-indigo-400');
      tabPending.classList.remove('border-transparent', 'text-slate-400');
      if(tabAllUsers) {
        tabAllUsers.classList.remove('border-indigo-500', 'text-indigo-400');
        tabAllUsers.classList.add('border-transparent', 'text-slate-400');
      }
      document.getElementById('pendingUsersList').classList.remove('hidden');
      document.getElementById('allUsersList').classList.add('hidden');
      this.loadPendingUsers();
    });

    if (tabAllUsers) tabAllUsers.addEventListener('click', () => {
      tabAllUsers.classList.add('border-indigo-500', 'text-indigo-400');
      tabAllUsers.classList.remove('border-transparent', 'text-slate-400');
      if(tabPending) {
        tabPending.classList.remove('border-indigo-500', 'text-indigo-400');
        tabPending.classList.add('border-transparent', 'text-slate-400');
      }
      document.getElementById('allUsersList').classList.remove('hidden');
      document.getElementById('pendingUsersList').classList.add('hidden');
      this.loadAllUsers();
    });
  },
  
  async loadPendingUsers() {
    try {
      const snapshot = await DMS.db.collection('users').where('status', '==', 'pending').get();
      const list = document.getElementById('pendingUsersList');
      if (!list) return;

      this.updatePendingBadge(snapshot.size);

      if (snapshot.empty) {
        list.innerHTML = '<div class="text-center text-slate-400 p-8">ไม่มีคำขอรออนุมัติ</div>';
        return;
      }

      let html = '';
      snapshot.forEach(doc => {
        html += this.renderPendingCard({ id: doc.id, ...doc.data() });
      });
      list.innerHTML = html;
    } catch (error) {
      console.error('Error loading pending users:', error);
      showToast('เกิดข้อผิดพลาดในการโหลดผู้ใช้รออนุมัติ', 'error');
    }
  },
  
  async loadAllUsers() {
    try {
      const snapshot = await DMS.db.collection('users').where('status', 'in', ['approved', 'suspended']).get();
      const list = document.getElementById('allUsersList');
      if (!list) return;

      if (snapshot.empty) {
        list.innerHTML = '<div class="text-center text-slate-400 p-8">ไม่มีผู้ใช้ในระบบ</div>';
        return;
      }

      let html = '<div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="border-b border-slate-700 text-slate-400 text-sm"><th class="p-4">ผู้ใช้</th><th class="p-4">สิทธิ์</th><th class="p-4">สถานะ</th><th class="p-4 text-right">จัดการ</th></tr></thead><tbody>';
      snapshot.forEach(doc => {
        html += this.renderUserRow({ id: doc.id, ...doc.data() });
      });
      html += '</tbody></table></div>';
      list.innerHTML = html;
    } catch (error) {
      console.error('Error loading all users:', error);
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้', 'error');
    }
  },
  
  async approveUser(uid) {
    try {
      const select = document.getElementById(`role-select-${uid}`);
      const role = select ? select.value : 'viewer';
      
      await DMS.db.collection('users').doc(uid).update({
        status: 'approved',
        role: role,
        approvedBy: DMS.currentUser.uid,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await DMS.db.collection('activityLog').add({
        action: 'approve_user',
        userId: DMS.currentUser.uid,
        userName: DMS.currentUser.displayName,
        details: `Approved user ${uid} as ${role}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showToast('อนุมัติผู้ใช้สำเร็จ');
      this.loadPendingUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      showToast('เกิดข้อผิดพลาดในการอนุมัติผู้ใช้', 'error');
    }
  },
  
  async rejectUser(uid) {
    try {
      const reason = prompt('ระบุเหตุผลที่ปฏิเสธ:');
      if (reason === null) return;

      await DMS.db.collection('users').doc(uid).update({
        status: 'rejected',
        rejectedReason: reason || 'ไม่ระบุเหตุผล'
      });
      
      showToast('ปฏิเสธผู้ใช้สำเร็จ');
      this.loadPendingUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      showToast('เกิดข้อผิดพลาดในการปฏิเสธผู้ใช้', 'error');
    }
  },
  
  async changeRole(uid, newRole) {
    try {
      await DMS.db.collection('users').doc(uid).update({ role: newRole });
      showToast('เปลี่ยนสิทธิ์สำเร็จ');
    } catch (error) {
      console.error('Error changing role:', error);
      showToast('เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์', 'error');
    }
  },

  async suspendUser(uid) {
    if(!confirm('ยืนยันการระงับผู้ใช้นี้?')) return;
    try {
      await DMS.db.collection('users').doc(uid).update({ status: 'suspended' });
      showToast('ระงับผู้ใช้สำเร็จ');
      this.loadAllUsers();
    } catch (error) {
      console.error('Error suspending user:', error);
      showToast('เกิดข้อผิดพลาดในการระงับผู้ใช้', 'error');
    }
  },

  async unsuspendUser(uid) {
    try {
      await DMS.db.collection('users').doc(uid).update({ status: 'approved' });
      showToast('ยกเลิกระงับสำเร็จ');
      this.loadAllUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  },
  
  renderPendingCard(user) {
    const photo = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.email);
    return `
      <div class="bg-slate-800/50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div class="flex items-center gap-4 w-full md:w-auto">
          <img src="${escapeHtml(photo)}" class="w-12 h-12 rounded-full object-cover">
          <div>
            <div class="font-medium text-white">${escapeHtml(user.displayName || user.email)}</div>
            <div class="text-sm text-slate-400">${escapeHtml(user.email)}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 w-full md:w-auto">
          <select id="role-select-${escapeHtml(user.id)}" class="bg-slate-700 text-white rounded px-3 py-2 text-sm border-none focus:ring-1 focus:ring-indigo-500">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button onclick="Users.approveUser('${escapeHtml(user.id)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition-colors">อนุมัติ</button>
          <button onclick="Users.rejectUser('${escapeHtml(user.id)}')" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm transition-colors">ปฏิเสธ</button>
        </div>
      </div>
    `;
  },
  
  renderUserRow(user) {
    const photo = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.email);
    const isMe = user.id === DMS.currentUser.uid;
    const statusBadge = user.status === 'suspended' 
      ? '<span class="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">ระงับ</span>'
      : '<span class="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">ปกติ</span>';

    return `
      <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
        <td class="p-4">
          <div class="flex items-center gap-3">
            <img src="${escapeHtml(photo)}" class="w-8 h-8 rounded-full">
            <div>
              <div class="font-medium text-white">${escapeHtml(user.displayName || user.email)}</div>
              <div class="text-xs text-slate-400">${escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td class="p-4">
          <select onchange="Users.changeRole('${escapeHtml(user.id)}', this.value)" ${isMe ? 'disabled' : ''} class="bg-slate-700 text-white rounded px-2 py-1 text-sm border-none">
            <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td class="p-4">${statusBadge}</td>
        <td class="p-4 text-right">
          ${!isMe ? (
            user.status === 'suspended' 
            ? `<button onclick="Users.unsuspendUser('${escapeHtml(user.id)}')" class="text-green-400 hover:text-green-300 text-sm">ยกเลิกระงับ</button>`
            : `<button onclick="Users.suspendUser('${escapeHtml(user.id)}')" class="text-red-400 hover:text-red-300 text-sm">ระงับ</button>`
          ) : ''}
        </td>
      </tr>
    `;
  },
  
  updatePendingBadge(count) {
    const pendingCount = document.getElementById('pendingCount');
    if (pendingCount) {
      pendingCount.textContent = count;
      pendingCount.classList.toggle('hidden', count === 0);
    }
  }
};
