const App = {
  async init() {
    this.setupNavigation();
    this.setupTheme();
    this.setupSettingsDropdown();
    
    if(Categories.init) Categories.init();
    if(Topics.init) Topics.init();
    if(Search.init) Search.init();
    if(Dashboard.init) Dashboard.init();
    
    if (DMS.currentUser.role === 'admin') {
      if(Users.init) Users.init();
    }
    
    // Load dynamic Drive Folder ID config & sync (safely after all scripts loaded)
    if (window.Files && typeof Files.getOrCreateDriveFolder === 'function') {
      try {
        await Files.getOrCreateDriveFolder();
        const el = document.getElementById('driveFolderInfo');
        if (el) {
          el.textContent = DRIVE_FOLDER_ID ? `Folder: ${DRIVE_FOLDER_ID}` : 'Folder: None';
          el.title = DRIVE_FOLDER_ID || '';
        }
        
        // If the user is admin, trigger automatic acceptance of ownership transfers in the background
        if (DMS.currentUser.role === 'admin' && typeof Files.acceptOwnershipTransfers === 'function') {
          setTimeout(() => {
            Files.acceptOwnershipTransfers();
          }, 3000);
        }
      } catch (err) {
        console.error('Error initializing Drive Folder in App.init:', err);
      }
    }
    
    this.navigateTo('dashboard');
  },
  
  setupSettingsDropdown() {
    const btn = document.getElementById('btnSidebarSettings');
    const dropdown = document.getElementById('settingsDropdown');
    
    if (btn && dropdown) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
      
      // Close dropdown when clicking anywhere else
      document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
      });
      
      // Prevent closing when clicking inside the dropdown
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  },
  
  setupNavigation() {
    const bindNav = (id, page) => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(page);
      });
    };
    
    bindNav('navDashboard', 'dashboard');
    bindNav('navTopics', 'topics');
    bindNav('navCategories', 'categories');
    bindNav('navUsers', 'users');
    bindNav('navTrash', 'trash');
    
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    if(btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('collapsed');
      });
    }
    
    const btnMobileMenu = document.getElementById('btnMobileMenu');
    if(btnMobileMenu) {
      btnMobileMenu.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('mobile-open');
      });
    }
  },
  
  navigateTo(page) {
    DMS.currentPage = page;
    const pages = { 
      dashboard: 'dashboardPage', 
      topics: 'topicsPage', 
      categories: 'categoriesPage', 
      users: 'usersPage', 
      trash: 'trashPage' 
    };
    const titles = { 
      dashboard: 'Dashboard', 
      topics: 'เอกสารทั้งหมด', 
      categories: 'จัดการหมวดหมู่', 
      users: 'จัดการผู้ใช้', 
      trash: 'ถังขยะ' 
    };
    
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    
    const pageEl = document.getElementById(pages[page]);
    if(pageEl) pageEl.classList.remove('hidden');
    
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) titleEl.textContent = titles[page];
    
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('nav-active'));
    const navId = 'nav' + page.charAt(0).toUpperCase() + page.slice(1);
    const activeNav = document.getElementById(navId);
    if(activeNav) activeNav.classList.add('nav-active');
    
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    
    switch(page) {
      case 'dashboard': Dashboard.loadDashboard(); break;
      case 'topics': Topics.loadTopics(); break;
      case 'categories': 
        Categories.loadCategories().then(() => Categories.renderCategoriesList()); 
        break;
      case 'users': Users.loadPendingUsers(); break;
      case 'trash': Topics.loadTrash(); break;
    }
  },
  
  showTopicDetail(topicId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const detailPage = document.getElementById('topicDetailPage');
    if(detailPage) detailPage.classList.remove('hidden');
    
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) titleEl.textContent = 'รายละเอียดเอกสาร';
    
    Topics.loadTopicDetail(topicId);
  },
  
  setupTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    const btn = document.getElementById('btnThemeToggle');
    if(btn) btn.addEventListener('click', toggleTheme);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (Auth && typeof Auth.init === 'function') {
    Auth.init();
  }
});
