const Categories = {
  categories: [],
  
  init() {
    const btnAdd = document.getElementById('btnAddCategory');
    if(btnAdd) btnAdd.addEventListener('click', () => this.showCategoryModal());

    const btnSubmit = document.getElementById('btnSubmitCategory');
    if(btnSubmit) btnSubmit.addEventListener('click', () => this.handleCategorySubmit());
  },
  
  async loadCategories() {
    try {
      const snapshot = await DMS.db.collection('categories').orderBy('order', 'asc').get();
      this.categories = [];
      snapshot.forEach(doc => {
        this.categories.push({ id: doc.id, ...doc.data() });
      });
      return this.categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      showToast('ไม่สามารถโหลดหมวดหมู่ได้', 'error');
      return [];
    }
  },
  
  async createCategory(data) {
    try {
      const newRef = DMS.db.collection('categories').doc();
      await newRef.set({
        ...data,
        topicCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await this.loadCategories();
      showToast('สร้างหมวดหมู่สำเร็จ');
    } catch (error) {
      console.error('Error creating category:', error);
      showToast('เกิดข้อผิดพลาดในการสร้างหมวดหมู่', 'error');
    }
  },
  
  async updateCategory(id, data) {
    try {
      await DMS.db.collection('categories').doc(id).update(data);
      await this.loadCategories();
      showToast('อัปเดตหมวดหมู่สำเร็จ');
    } catch (error) {
      console.error('Error updating category:', error);
      showToast('เกิดข้อผิดพลาดในการอัปเดตหมวดหมู่', 'error');
    }
  },
  
  async deleteCategory(id) {
    if(!confirm('คุณแน่ใจหรือไม่ที่จะลบหมวดหมู่นี้? เอกสารภายในจะไม่ถูกลบ แต่จะไม่มีหมวดหมู่')) return;
    try {
      await DMS.db.collection('categories').doc(id).delete();
      await this.loadCategories();
      this.renderCategoriesList();
      showToast('ลบหมวดหมู่สำเร็จ');
    } catch (error) {
      console.error('Error deleting category:', error);
      showToast('ลบหมวดหมู่ล้มเหลว', 'error');
    }
  },
  
  renderCategoriesList() {
    const list = document.getElementById('categoriesList');
    if (!list) return;

    if (this.categories.length === 0) {
      list.innerHTML = '<div class="text-center text-slate-400 py-8">ยังไม่มีหมวดหมู่</div>';
      return;
    }

    const parents = this.categories.filter(c => !c.parentId);
    
    let html = '';
    const renderNode = (node, depth = 0) => {
      const children = this.categories.filter(c => c.parentId === node.id);
      const padding = depth * 2;
      const isAdminOrEditor = DMS.currentUser.role === 'admin' || DMS.currentUser.role === 'editor';
      
      let nodeHtml = `
        <div class="flex items-center justify-between p-3 bg-slate-800/50 rounded mb-2 border border-slate-700/50 hover:border-slate-600 transition-colors" style="margin-left: ${padding}rem">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded flex items-center justify-center text-xl" style="background-color: ${node.color || '#6366f1'}40; color: ${node.color || '#6366f1'}">
              ${node.icon || '📁'}
            </div>
            <div>
              <div class="text-white font-medium">${escapeHtml(node.name)}</div>
              <div class="text-xs text-slate-400">${node.topicCount || 0} เอกสาร</div>
            </div>
          </div>
          ${isAdminOrEditor ? `
          <div class="flex gap-2">
            <button onclick="Categories.showCategoryModal('${escapeHtml(node.id)}')" class="p-2 text-slate-400 hover:text-indigo-400 transition-colors" title="แก้ไข">✏️</button>
            <button onclick="Categories.deleteCategory('${escapeHtml(node.id)}')" class="p-2 text-slate-400 hover:text-red-400 transition-colors" title="ลบ">🗑️</button>
          </div>
          ` : ''}
        </div>
      `;
      
      children.forEach(child => {
        nodeHtml += renderNode(child, depth + 1);
      });
      return nodeHtml;
    };

    parents.forEach(parent => {
      html += renderNode(parent);
    });

    list.innerHTML = html;
  },
  
  renderCategorySelect(selectId, selectedId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกหมวดหมู่ --</option>';
    
    const parents = this.categories.filter(c => !c.parentId);
    
    const appendNode = (node, depth = 0) => {
      const prefix = '—'.repeat(depth);
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = `${prefix} ${node.name}`;
      if (selectedId === node.id) option.selected = true;
      select.appendChild(option);
      
      const children = this.categories.filter(c => c.parentId === node.id);
      children.forEach(child => appendNode(child, depth + 1));
    };

    parents.forEach(parent => appendNode(parent));
  },
  
  getCategoryById(id) {
    return this.categories.find(c => c.id === id);
  },
  
  showCategoryModal(categoryId = null) {
    DMS.editingCategoryId = categoryId;
    document.getElementById('categoryModalTitle').textContent = categoryId ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่ใหม่';
    
    document.getElementById('categoryForm').reset();
    this.renderCategorySelect('categoryParentSelect');
    
    if (categoryId) {
      const cat = this.getCategoryById(categoryId);
      if (cat) {
        document.getElementById('categoryNameInput').value = cat.name;
        document.getElementById('categoryColorInput').value = cat.color || '#6366f1';
        document.getElementById('categoryIconInput').value = cat.icon || '📁';
        if (cat.parentId) {
          document.getElementById('categoryParentSelect').value = cat.parentId;
        }
      }
    } else {
      document.getElementById('categoryColorInput').value = '#6366f1';
      document.getElementById('categoryIconInput').value = '📁';
    }
    
    showModal('categoryModal');
  },
  
  async handleCategorySubmit() {
    const name = document.getElementById('categoryNameInput').value.trim();
    const parentId = document.getElementById('categoryParentSelect').value;
    const color = document.getElementById('categoryColorInput').value;
    const icon = document.getElementById('categoryIconInput').value.trim();
    
    if (!name) {
      showToast('กรุณาระบุชื่อหมวดหมู่', 'warning');
      return;
    }
    
    const data = {
      name,
      parentId: parentId || null,
      color,
      icon: icon || '📁',
      order: 0 // Simplification for demo
    };
    
    hideModal('categoryModal');
    
    if (DMS.editingCategoryId) {
      await this.updateCategory(DMS.editingCategoryId, data);
    } else {
      await this.createCategory(data);
    }
    
    this.renderCategoriesList();
  }
};
