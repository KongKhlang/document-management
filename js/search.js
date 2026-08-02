const Search = {
  searchCache: new Map(),
  initialized: false,
  
  init() {
    if (this.initialized) return;
    this.initialized = true;

    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        this.handleSearch(e.target.value);
      }, 300));
    }
  },
  
  async handleSearch(query) {
    try {
      if (!query.trim()) { 
        Topics.loadTopics(); 
        return; 
      }
      
      showLoading('topicsLoading');
      const tokens = tokenizeForSearch(query);
      if (tokens.length === 0) {
        hideLoading('topicsLoading');
        return;
      }
      
      const topicsRef = DMS.db.collection('topics').where('isDeleted', '==', false);
      const snapshot = await topicsRef.where('searchKeywords', 'array-contains-any', tokens).get();
      
      let results = [];
      snapshot.forEach(doc => {
        const topic = { id: doc.id, ...doc.data() };
        if (
          topic.visibility === 'public' ||
          topic.createdBy === DMS.currentUser.uid ||
          (topic.allowedViewers && topic.allowedViewers.includes(DMS.currentUser.email)) ||
          DMS.currentUser.role === 'admin'
        ) {
          results.push(topic);
        }
      });
      
      hideLoading('topicsLoading');
      
      const topicsList = document.getElementById('topicsList');
      if(topicsList) {
        if (results.length === 0) {
          topicsList.innerHTML = '';
          const empty = document.getElementById('topicsEmpty');
          if(empty) empty.classList.remove('hidden');
        } else {
          const empty = document.getElementById('topicsEmpty');
          if(empty) empty.classList.add('hidden');
          topicsList.innerHTML = results.map(topic => Topics.renderTopicCard(topic, query)).join('');
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
      hideLoading('topicsLoading');
    }
  },
  
  highlightMatch(text, query) {
    if (!query || !text) return escapeHtml(text || '');
    const tokens = tokenizeForSearch(query);
    let result = escapeHtml(text);
    tokens.forEach(token => {
      const regex = new RegExp(`(${token})`, 'gi');
      result = result.replace(regex, '<mark class="bg-yellow-300 text-black">$1</mark>');
    });
    return result;
  }
};
