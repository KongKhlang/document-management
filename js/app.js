/* ==========================================================================
   PLAYFUL EDUCATIONAL PLATFORM — INTERACTIVE APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initCourseCatalog();
  initProgressDemo();
  initCountdownTimer();
  initFaqAccordion();
  initModals();
  initMobileNav();
});

/* ==========================================================================
   1. COURSE CATALOG INTERACTIVE FILTERING & SEARCH
   ========================================================================== */

const coursesData = [
  {
    id: 1,
    title: 'Python Quest: Build 5 Retro Games',
    category: 'coding',
    categoryName: '💻 Coding & AI',
    color: '#4F46E5',
    bgGradient: 'linear-gradient(135deg, #EEF2FF, #C7D2FE)',
    icon: '🐍',
    rating: '4.9 ★',
    desc: 'Master variables, loops, and Pygame while crafting your own Arcade games.',
    instructor: 'Dr. Alex Rivera',
    avatar: '👨‍💻',
    price: '$29/mo',
    level: 'Beginner'
  },
  {
    id: 2,
    title: '3D Character Sculpting in Blender',
    category: 'creative',
    categoryName: '🎨 Creative Arts',
    color: '#EF476F',
    bgGradient: 'linear-gradient(135deg, #FFE4E6, #FECDD3)',
    icon: '🦄',
    rating: '4.8 ★',
    desc: 'Turn imagination into 3D toy-like characters ready for 3D printing & animation.',
    instructor: 'Sarah Jenkins',
    avatar: '👩‍🎨',
    price: '$35/mo',
    level: 'Intermediate'
  },
  {
    id: 3,
    title: 'Space Explorers: Black Holes & Beyond',
    category: 'science',
    categoryName: '🔬 Science & Space',
    color: '#06D6A0',
    bgGradient: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
    icon: '🚀',
    rating: '5.0 ★',
    desc: 'Interactive 3D astrophysics missions. Discover gravity, stars, and alien worlds!',
    instructor: 'Prof. Carl Sagan Jr.',
    avatar: '👨‍🚀',
    price: '$25/mo',
    level: 'All Levels'
  },
  {
    id: 4,
    title: 'Math Marvels: Algebra Game Arena',
    category: 'math',
    categoryName: '🧮 Math & Logic',
    color: '#FF9F1C',
    bgGradient: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
    icon: '🧩',
    rating: '4.9 ★',
    desc: 'Solve RPG puzzles, unlock magic spells, and conquer algebra with zero stress.',
    instructor: 'Mia Chen',
    avatar: '👩‍🏫',
    price: '$22/mo',
    level: 'Beginner'
  },
  {
    id: 5,
    title: 'AI Companion Builder for Kids & Teens',
    category: 'coding',
    categoryName: '💻 Coding & AI',
    color: '#7C3AED',
    bgGradient: 'linear-gradient(135deg, #F3E8FF, #E9D5FF)',
    icon: '🤖',
    rating: '4.9 ★',
    desc: 'Learn Prompt Engineering & ChatGPT API to build your personal smart homework helper.',
    instructor: 'Dave Miller',
    avatar: '🧑‍💻',
    price: '$39/mo',
    level: 'Advanced'
  },
  {
    id: 6,
    title: 'Robotics & Micro:bit Gadgets',
    category: 'science',
    categoryName: '🔬 Science & Space',
    color: '#118AB2',
    bgGradient: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)',
    icon: '⚡',
    rating: '4.7 ★',
    desc: 'Wire sensors, program LEDs, and build real smart home gadgets with code.',
    instructor: 'Robotics Lab',
    avatar: '👨‍🔬',
    price: '$32/mo',
    level: 'Intermediate'
  }
];

function initCourseCatalog() {
  const grid = document.getElementById('coursesGrid');
  const tabs = document.querySelectorAll('.pill-tab');
  const searchInput = document.getElementById('courseSearchInput');

  if (!grid) return;

  let currentCategory = 'all';
  let searchQuery = '';

  function renderCourses() {
    const filtered = coursesData.filter(course => {
      const matchCat = currentCategory === 'all' || course.category === currentCategory;
      const matchSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #FFF; border-radius: 24px; border: var(--border-clay);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
          <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">No Courses Found</h3>
          <p style="color: var(--text-muted); font-weight: 600;">Try searching for a different keyword or category.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(course => `
      <div class="clay-course-card" data-category="${course.category}">
        <div class="card-img-wrapper" style="background: ${course.bgGradient}">
          <span class="card-category-badge" style="color: ${course.color}">${course.categoryName}</span>
          <span class="card-rating">${course.rating}</span>
          <div style="font-size: 4.5rem; filter: drop-shadow(4px 6px 10px rgba(0,0,0,0.15));">${course.icon}</div>
        </div>
        <h3 class="card-title">${escapeHtml(course.title)}</h3>
        <p class="card-desc">${escapeHtml(course.desc)}</p>
        <div class="card-meta">
          <div class="instructor-box">
            <span class="instructor-avatar">${course.avatar}</span>
            <span class="instructor-name">${escapeHtml(course.instructor)}</span>
          </div>
          <span class="card-price">${course.price}</span>
        </div>
        <div class="card-footer-btns">
          <button class="btn-clay btn-clay-secondary btn-card-preview" onclick="openPreviewModal('${course.title}', '${course.instructor}', '${course.level}')">
            Syllabus
          </button>
          <button class="btn-clay btn-clay-primary btn-card-enroll" onclick="openEnrollModal('${course.title}')">
            Enroll Now
          </button>
        </div>
      </div>
    `).join('');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      renderCourses();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCourses();
    });
  }

  renderCourses();
}

/* ==========================================================================
   2. PROGRESS TRACKING INTERACTIVE DEMO SANDBOX
   ========================================================================== */

function initProgressDemo() {
  const xpBarFill = document.getElementById('xpBarFill');
  const xpCurrentText = document.getElementById('xpCurrentText');
  const levelTag = document.getElementById('levelTag');
  const addXpBtn = document.getElementById('addXpBtn');
  const streakCount = document.getElementById('streakCount');

  if (!addXpBtn) return;

  let currentXp = 850;
  let maxXp = 1000;
  let currentLevel = 14;
  let streak = 7;

  addXpBtn.addEventListener('click', () => {
    currentXp += 100;

    if (currentXp >= maxXp) {
      currentLevel++;
      currentXp = currentXp - maxXp;
      maxXp += 200;
      levelTag.textContent = `Level ${currentLevel}`;
      
      // Toast notification for level up!
      showPlayfulToast(`🎉 LEVEL UP! You reached Level ${currentLevel}! 🛡️`, '#7C3AED');
    } else {
      showPlayfulToast(`⚡ +100 XP Gained! Keep going! 🚀`, '#06D6A0');
    }

    const percentage = Math.min((currentXp / maxXp) * 100, 100);
    xpBarFill.style.width = `${percentage}%`;
    xpCurrentText.textContent = `${currentXp} / ${maxXp} XP`;
  });
}

/* ==========================================================================
   3. COUNTDOWN TIMER FOR ENROLLMENT BANNER
   ========================================================================== */

function initCountdownTimer() {
  const hoursEl = document.getElementById('timerHours');
  const minsEl = document.getElementById('timerMins');
  const secsEl = document.getElementById('timerSecs');

  if (!hoursEl) return;

  let totalSeconds = 4 * 3600 + 32 * 60 + 18;

  setInterval(() => {
    if (totalSeconds <= 0) totalSeconds = 24 * 3600;
    totalSeconds--;

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    hoursEl.textContent = String(h).padStart(2, '0');
    minsEl.textContent = String(m).padStart(2, '0');
    secsEl.textContent = String(s).padStart(2, '0');
  }, 1000);
}

/* ==========================================================================
   4. FAQ ACCORDION TOGGLE
   ========================================================================== */

function initFaqAccordion() {
  const faqCards = document.querySelectorAll('.clay-faq-card');

  faqCards.forEach(card => {
    const question = card.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      
      // Close others
      faqCards.forEach(c => c.classList.remove('open'));

      if (!isOpen) {
        card.classList.add('open');
      }
    });
  });
}

/* ==========================================================================
   5. MODAL HANDLERS & ENROLLMENT FORM
   ========================================================================== */

function initModals() {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const enrollForm = document.getElementById('enrollForm');

  if (!modalOverlay) return;

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  if (enrollForm) {
    enrollForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const studentName = document.getElementById('studentNameInput').value;
      const courseSelect = document.getElementById('courseSelectInput').value;

      closeModal();
      showPlayfulToast(`🎉 Congratulations ${studentName}! Successfully enrolled in ${courseSelect}!`, '#FF6B35');
    });
  }
}

function openEnrollModal(courseTitle = 'Python Quest') {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const courseSelect = document.getElementById('courseSelectInput');

  if (modalTitle) modalTitle.textContent = `🚀 Enroll in ${courseTitle}`;
  if (courseSelect) {
    for (let opt of courseSelect.options) {
      if (opt.value.includes(courseTitle) || opt.text.includes(courseTitle)) {
        opt.selected = true;
        break;
      }
    }
  }

  if (modalOverlay) modalOverlay.classList.add('active');
}

function openPreviewModal(title, instructor, level) {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  
  if (modalTitle) modalTitle.textContent = `📚 Syllabus: ${title}`;
  showPlayfulToast(`📖 Loading syllabus for ${title} (${level})...`, '#4F46E5');
  
  if (modalOverlay) modalOverlay.classList.add('active');
}

function closeModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) modalOverlay.classList.remove('active');
}

/* ==========================================================================
   6. TOAST NOTIFICATION UTILITY
   ========================================================================== */

function showPlayfulToast(message, bgColor = '#FF6B35') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 3000;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${bgColor};
    color: #FFFFFF;
    font-weight: 800;
    font-size: 1rem;
    padding: 1rem 1.5rem;
    border-radius: 20px;
    border: 3px solid rgba(255, 255, 255, 0.85);
    box-shadow: 8px 12px 24px rgba(0,0,0,0.2);
    transform: translateX(100%);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 10);

  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

/* ==========================================================================
   7. MOBILE NAVIGATION TOGGLE
   ========================================================================== */

function initMobileNav() {
  const navToggle = document.getElementById('mobileNavToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        navLinks.style.cssText = `
          display: flex;
          flex-direction: column;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #FFFFFF;
          border-radius: 24px;
          padding: 1.5rem;
          margin-top: 0.5rem;
          box-shadow: var(--clay-shadow-hover);
          border: var(--border-clay);
        `;
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
