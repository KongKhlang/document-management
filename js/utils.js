function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(message, type = 'success', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✓';
  if (type === 'error') icon = '✕';
  if (type === 'warning') icon = '⚠️';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  // Trigger reflow for animation
  toast.offsetHeight;
  toast.classList.add('toast-visible');
  
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.remove('hidden');
}

function hideLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('hidden');
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function getFileIcon(fileType) {
  if(!fileType) return '📁';
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('doc')) return '📝';
  if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return '📊';
  if (type.includes('image')) return '🖼️';
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '🗜️';
  return '📁';
}

function getFileTypeColor(fileType) {
  if(!fileType) return '#6b7280';
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return '#ef4444'; // red
  if (type.includes('word') || type.includes('doc')) return '#3b82f6'; // blue
  if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return '#10b981'; // green
  if (type.includes('image')) return '#8b5cf6'; // purple
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '#f59e0b'; // yellow
  return '#6b7280'; // gray
}

function tokenizeForSearch(text) {
  if (!text) return [];
  const tokens = text.toLowerCase().split(/[\s,.\-_]+/);
  return [...new Set(tokens)].filter(t => t.length > 0);
}

function showPage(pageId) {
  // Hide ALL top-level views (auth pages + main app)
  const topLevelIds = ['loginPage', 'pendingPage', 'rejectedPage', 'mainApp'];
  topLevelIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  // Also hide inner pages
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  // Show the target
  const page = document.getElementById(pageId);
  if (page) page.classList.remove('hidden');
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.classList.add('opacity-100');
      if(modal.children[0]) modal.children[0].classList.add('scale-100');
    }, 10);
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('opacity-100');
    if(modal.children[0]) modal.children[0].classList.remove('scale-100');
    setTimeout(() => modal.classList.add('hidden'), 300);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
