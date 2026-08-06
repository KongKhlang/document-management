const Users = {
  initialized: false,
  init() {
    if (this.initialized) return;
    this.initialized = true;

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

      let html = `
        <div style="overflow-x: auto; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--card-border); box-shadow: var(--shadow-sm); padding: 0.5rem 1rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid var(--card-border); color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 1rem 0.75rem;">ผู้ใช้</th>
                <th style="padding: 1rem 0.75rem;">สิทธิ์</th>
                <th style="padding: 1rem 0.75rem;">สถานะ</th>
                <th style="padding: 1rem 0.75rem; text-align: right;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
      `;
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
      
      const userDoc = await DMS.db.collection('users').doc(uid).get();
      if (!userDoc.exists) throw new Error('ไม่พบข้อมูลผู้ใช้');
      const userEmail = userDoc.data().email;

      // Automatically add permission to the Google Drive shared folder
      if (typeof DRIVE_FOLDER_ID !== 'undefined' && DRIVE_FOLDER_ID) {
        showToast('กำลังให้สิทธิ์เข้าถึง Google Drive...', 'info');
        try {
          // Give them 'writer' (Editor) permission so they can upload/delete files inside the folder!
          await DrivePermissions.addPermission(DRIVE_FOLDER_ID, userEmail, 'writer');
          showToast('เพิ่มสิทธิ์ Google Drive สำเร็จ');
        } catch (e) {
          console.warn('Failed to share Google Drive folder with user:', e);
          let friendlyMsg = e.message;
          if (e.message.includes('appNotAuthorizedToChild') || e.message.includes('affected by the operation on the parent')) {
            friendlyMsg = 'เนื่องจากข้อจำกัดความปลอดภัยของ Google Drive (มีไฟล์ของผู้อื่นในโฟลเดอร์) กรุณาเข้าไปแชร์โฟลเดอร์ "ระบบคลังเอกสาร" ให้กับ ' + userEmail + ' ผ่านเว็บ Google Drive โดยตรงเพื่อเสร็จสิ้นกระบวนการ';
          }
          showToast('แชร์โฟลเดอร์ Google Drive ไม่สำเร็จ: ' + friendlyMsg, 'warning', 12000);
        }
      }

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
        details: `Approved user ${uid} (${userEmail}) as ${role}`,
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
    if (uid === DMS.currentUser.uid) {
      showToast('ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้', 'error');
      return;
    }
    try {
      const userDoc = await DMS.db.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data().email && DMS.currentUser.email && userDoc.data().email.toLowerCase() === DMS.currentUser.email.toLowerCase()) {
        showToast('ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้', 'error');
        return;
      }
      await DMS.db.collection('users').doc(uid).update({ role: newRole });
      showToast('เปลี่ยนสิทธิ์สำเร็จ');
    } catch (error) {
      console.error('Error changing role:', error);
      showToast('เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์', 'error');
    }
  },

  async suspendUser(uid) {
    if (uid === DMS.currentUser.uid) {
      showToast('ไม่สามารถระงับตัวเองได้', 'error');
      return;
    }
    try {
      const userDoc = await DMS.db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.email && DMS.currentUser.email && userData.email.toLowerCase() === DMS.currentUser.email.toLowerCase()) {
          showToast('ไม่สามารถระงับตัวเองได้', 'error');
          return;
        }
        if(!confirm('ยืนยันการระงับผู้ใช้นี้?')) return;
        const userEmail = userData.email;
        if (typeof DRIVE_FOLDER_ID !== 'undefined' && DRIVE_FOLDER_ID) {
          showToast('กำลังยกเลิกสิทธิ์เข้าถึง Google Drive...', 'info');
          try {
            await DrivePermissions.removePermission(DRIVE_FOLDER_ID, userEmail);
            showToast('ยกเลิกสิทธิ์ Google Drive สำเร็จ');
          } catch (e) {
            console.warn('Failed to remove Google Drive permission:', e);
          }
        }
      }

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
      const userDoc = await DMS.db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userEmail = userDoc.data().email;
        if (typeof DRIVE_FOLDER_ID !== 'undefined' && DRIVE_FOLDER_ID) {
          showToast('กำลังคืนสิทธิ์เข้าถึง Google Drive...', 'info');
          try {
            await DrivePermissions.addPermission(DRIVE_FOLDER_ID, userEmail, 'writer');
            showToast('คืนสิทธิ์ Google Drive สำเร็จ');
          } catch (e) {
            console.warn('Failed to add Google Drive permission:', e);
          }
        }
      }

      await DMS.db.collection('users').doc(uid).update({ status: 'approved' });
      showToast('ยกเลิกระงับสำเร็จ');
      this.loadAllUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  },

  async deleteUser(uid) {
    if (uid === DMS.currentUser.uid) {
      showToast('ไม่สามารถลบตัวเองได้', 'error');
      return;
    }
    try {
      const userDoc = await DMS.db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.email && DMS.currentUser.email && userData.email.toLowerCase() === DMS.currentUser.email.toLowerCase()) {
          showToast('ไม่สามารถลบตัวเองได้', 'error');
          return;
        }
        if(!confirm('ยืนยันการลบผู้ใช้นี้ออกจากระบบ? (สิทธิ์เข้าถึงโฟลเดอร์ Google Drive จะถูกเพิกถอน และข้อมูลผู้ใช้จะถูกลบออกจากฐานข้อมูล)')) return;
        const userEmail = userData.email;
        if (typeof DRIVE_FOLDER_ID !== 'undefined' && DRIVE_FOLDER_ID) {
          showToast('กำลังยกเลิกสิทธิ์เข้าถึง Google Drive...', 'info');
          try {
            await DrivePermissions.removePermission(DRIVE_FOLDER_ID, userEmail);
            showToast('ยกเลิกสิทธิ์ Google Drive สำเร็จ');
          } catch (e) {
            console.warn('Failed to remove Google Drive permission:', e);
          }
        }
      }

      await DMS.db.collection('users').doc(uid).delete();
      
      await DMS.db.collection('activityLog').add({
        action: 'delete_user',
        userId: DMS.currentUser.uid,
        userName: DMS.currentUser.displayName,
        details: `Deleted user ${uid}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast('ลบผู้ใช้สำเร็จ');
      this.loadAllUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('เกิดข้อผิดพลาดในการลบผู้ใช้', 'error');
    }
  },
  
  renderPendingCard(user) {
    const photo = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.email);
    return `
      <div class="user-card" style="margin-bottom: 1rem;">
        <div class="flex items-center gap-4" style="flex: 1;">
          <img src="${escapeHtml(photo)}" class="user-avatar-lg" style="width: 50px; height: 50px;">
          <div>
            <div class="user-name">${escapeHtml(user.displayName || user.email)}</div>
            <div class="user-email">${escapeHtml(user.email)}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <select id="role-select-${escapeHtml(user.id)}" class="form-select" style="width: 120px; padding: 0.5rem; margin-right: 0.5rem;">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button onclick="Users.approveUser('${escapeHtml(user.id)}')" class="btn-primary btn-sm">อนุมัติ</button>
          <button onclick="Users.rejectUser('${escapeHtml(user.id)}')" class="btn-secondary btn-sm">ปฏิเสธ</button>
        </div>
      </div>
    `;
  },
  
  renderUserRow(user) {
    const photo = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.email);
    const isMe = user.id === DMS.currentUser.uid || (user.email && DMS.currentUser.email && user.email.toLowerCase() === DMS.currentUser.email.toLowerCase());
    const statusBadge = user.status === 'suspended' 
      ? '<span class="role-badge" style="background: rgba(239,68,68,0.1); color: var(--danger-color);">ระงับ</span>'
      : '<span class="role-badge" style="background: rgba(16,185,129,0.1); color: var(--success-color);">ปกติ</span>';

    return `
      <tr style="border-bottom: 1px solid var(--card-border); transition: background var(--transition);">
        <td style="padding: 1rem 0.75rem;">
          <div class="flex items-center gap-3">
            <img src="${escapeHtml(photo)}" class="user-avatar" style="width: 36px; height: 36px; border: none; box-shadow: none;">
            <div>
              <div class="user-name" style="font-size: 0.95rem;">${escapeHtml(user.displayName || user.email)}</div>
              <div class="user-email" style="font-size: 0.78rem;">${escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td style="padding: 1rem 0.75rem;">
          <select onchange="Users.changeRole('${escapeHtml(user.id)}', this.value)" ${isMe ? 'disabled' : ''} class="form-select" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">
            <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td style="padding: 1rem 0.75rem;">${statusBadge}</td>
        <td style="padding: 1rem 0.75rem; text-align: right;">
          <div class="flex gap-2 justify-end">
            ${!isMe ? (
              user.status === 'suspended' 
              ? `<button onclick="Users.unsuspendUser('${escapeHtml(user.id)}')" class="btn-secondary btn-sm" style="color: var(--success-color); border-color: rgba(16,185,129,0.2);">ยกเลิกระงับ</button>`
              : `<button onclick="Users.suspendUser('${escapeHtml(user.id)}')" class="btn-danger btn-sm" style="background: rgba(239,68,68,0.1); color: var(--danger-color); border-color: rgba(239,68,68,0.2);">ระงับ</button>`
            ) : ''}
            ${!isMe ? `<button onclick="Users.deleteUser('${escapeHtml(user.id)}')" class="btn-danger btn-sm">ลบ</button>` : ''}
          </div>
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

window.Users = Users;
