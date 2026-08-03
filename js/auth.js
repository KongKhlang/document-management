const Auth = {
  idleTimeoutTimer: null,
  IDLE_TIMEOUT_MS: 30 * 60 * 1000, // 30 นาที
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.setupInactivityListener();

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

  setupInactivityListener() {
    const resetTimer = () => {
      if (this.idleTimeoutTimer) clearTimeout(this.idleTimeoutTimer);
      if (DMS.currentUser) {
        this.idleTimeoutTimer = setTimeout(() => {
          this.handleInactivityLogout();
        }, this.IDLE_TIMEOUT_MS);
      }
    };

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    resetTimer();
  },

  handleInactivityLogout() {
    if (!DMS.currentUser) return;
    showToast('ระบบทำการล็อกเอาต์อัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 30 นาที', 'warning');
    this.signOut();
  },

  async signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPES);
    try {
      const result = await DMS.auth.signInWithPopup(provider);
      if (result && result.credential && result.credential.accessToken) {
        DMS.googleAccessToken = result.credential.accessToken;
        localStorage.setItem('googleAccessToken', result.credential.accessToken);
        localStorage.setItem('googleAccessTokenTime', Date.now().toString());
      }
    } catch (err) { 
      showToast('เข้าสู่ระบบล้มเหลว: ' + err.message, 'error'); 
    }
  },

  async refreshGoogleToken() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope(DRIVE_SCOPES);

      const result = await DMS.auth.signInWithPopup(provider);
      if (result && result.credential && result.credential.accessToken) {
        const token = result.credential.accessToken;
        DMS.googleAccessToken = token;
        localStorage.setItem('googleAccessToken', token);
        localStorage.setItem('googleAccessTokenTime', Date.now().toString());
        showToast('เชื่อมต่อสิทธิ์ Google Drive สำเร็จ', 'success');
        return token;
      }
    } catch (err) {
      console.warn('Google Access Token refresh error:', err);
      showToast('กรุณายืนยันสิทธิ์ Google Drive เพื่ออัปโหลด/ดาวน์โหลดไฟล์', 'warning');
    }
    return null;
  },

  async getValidAccessToken() {
    let token = DMS.googleAccessToken || localStorage.getItem('googleAccessToken');
    const tokenTimeStr = localStorage.getItem('googleAccessTokenTime');
    const tokenTime = tokenTimeStr ? parseInt(tokenTimeStr, 10) : 0;
    const isExpired = !tokenTime || (Date.now() - tokenTime > 50 * 60 * 1000); // 50 นาที

    if (!token || isExpired) {
      console.log('Google Access Token is missing or expired. Prompting token refresh...');
      token = await this.refreshGoogleToken();
    }

    return token;
  },

  async handleSignedIn(user) {
    try {
      // Re-hydrate the access token from localStorage on refresh
      DMS.googleAccessToken = localStorage.getItem('googleAccessToken');

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
          
          // Load dynamic Drive Folder ID config
          if (window.Files && typeof Files.getOrCreateDriveFolder === 'function') {
            await Files.getOrCreateDriveFolder();
            const el = document.getElementById('driveFolderInfo');
            if (el) {
              el.textContent = DRIVE_FOLDER_ID ? `Folder: ${DRIVE_FOLDER_ID}` : 'Folder: None';
              el.title = DRIVE_FOLDER_ID || '';
            }
          }

          // If the user is admin, trigger automatic acceptance of ownership transfers in the background
          if (DMS.currentUser.role === 'admin' && window.Files && typeof Files.acceptOwnershipTransfers === 'function') {
            setTimeout(() => {
              Files.acceptOwnershipTransfers();
            }, 3000);
          }

          this.showMainApp();
          this.setupInactivityListener();
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
    if (this.idleTimeoutTimer) clearTimeout(this.idleTimeoutTimer);
    DMS.auth.signOut(); 
    DMS.currentUser = null;
    DMS.googleAccessToken = null;
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleAccessTokenTime');
  }
};
