const Auth = {
  init() {
    DMS.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this.handleSignedIn(user);
      } else {
        this.showLoginPage();
      }
    });

    const bindClick = (id, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    };

    bindClick('btnGoogleLogin', () => this.signIn());
    bindClick('btnPendingLogout', () => this.signOut());
    bindClick('btnRejectedLogout', () => this.signOut());
    bindClick('btnLogout', () => this.signOut());
  },

  async signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPES);
    try {
      const result = await DMS.auth.signInWithPopup(provider);
      DMS.googleAccessToken = result.credential.accessToken;
    } catch (err) { 
      showToast('เข้าสู่ระบบล้มเหลว: ' + err.message, 'error'); 
    }
  },

  async handleSignedIn(user) {
    try {
      const userRef = DMS.db.collection('users').doc(user.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        const isFirstAdmin = user.email === FIRST_ADMIN_EMAIL;
        await userRef.set({
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: isFirstAdmin ? 'admin' : 'viewer',
          status: isFirstAdmin ? 'approved' : 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (!isFirstAdmin) {
          this.showPendingPage(user.email);
          return;
        }
      }

      const userData = userDoc.exists ? userDoc.data() : (await userRef.get()).data();
      
      switch (userData.status) {
        case 'pending': 
          this.showPendingPage(user.email); 
          break;
        case 'rejected': 
          this.showRejectedPage(userData.rejectedReason || 'คุณไม่ได้รับอนุมัติ'); 
          break;
        case 'suspended': 
          this.showRejectedPage('บัญชีของคุณถูกระงับการใช้งาน'); 
          break;
        case 'approved':
          DMS.currentUser = { uid: user.uid, ...userData };
          this.showMainApp();
          break;
      }
    } catch (error) {
      console.error("Auth handleSignedIn error:", error);
      showToast('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้', 'error');
    }
  },

  showLoginPage() {
    showPage('loginPage');
  },
  
  showPendingPage(email) {
    const el = document.getElementById('pendingEmail');
    if (el) el.textContent = email;
    showPage('pendingPage');
  },
  
  showRejectedPage(reason) {
    const el = document.getElementById('rejectedReason');
    if (el) el.textContent = reason;
    showPage('rejectedPage');
  },
  
  showMainApp() {
    // Hide all auth pages and show main app
    ['loginPage', 'pendingPage', 'rejectedPage'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.classList.remove('hidden');
    
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    if (nameEl) nameEl.textContent = DMS.currentUser.displayName || DMS.currentUser.email;
    if (roleEl) {
      const roles = { admin: 'ผู้ดูแลระบบ', editor: 'ผู้แก้ไข', viewer: 'ผู้เข้าชม' };
      roleEl.textContent = roles[DMS.currentUser.role] || 'ผู้ใช้ทั่วไป';
    }

    // Show/hide admin-only elements
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', DMS.currentUser.role !== 'admin');
    });

    // Show/hide editor-action elements (visible for admin and editor)
    const canEdit = DMS.currentUser.role === 'admin' || DMS.currentUser.role === 'editor';
    document.querySelectorAll('.editor-action').forEach(el => {
      el.classList.toggle('hidden', !canEdit);
    });
    
    if (App && typeof App.init === 'function') {
      App.init();
    }
  },
  
  signOut() { 
    DMS.auth.signOut(); 
    DMS.currentUser = null;
    DMS.googleAccessToken = null;
  }
};
