const DrivePermissions = {
  async addPermission(fileId, email, role = 'reader') {
    try {
      const response = await Files.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'user',
          role: role,
          emailAddress: email
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ไม่สามารถแชร์สิทธิ์: ${response.status} - ${errText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error adding permission:', error);
      throw error;
    }
  },
  
  async removePermission(fileId, email) {
    try {
      const permissions = await this.listPermissions(fileId);
      const perm = permissions.find(p => p.emailAddress === email);
      if (!perm) return;
      
      const response = await Files.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${perm.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(`Failed to remove permission: ${response.statusText}`);
    } catch (error) {
      console.error('Error removing permission:', error);
      throw error;
    }
  },
  
  async syncPermissions(topicId, allowedEmails) {
    try {
      const filesSnapshot = await DMS.db.collection('topics').doc(topicId).collection('files').get();
      for (const fileDoc of filesSnapshot.docs) {
        const driveFileId = fileDoc.data().driveFileId;
        if (!driveFileId) continue;
        
        const currentPerms = await this.listPermissions(driveFileId);
        const currentEmails = currentPerms.filter(p => p.role !== 'owner').map(p => p.emailAddress);
        
        const toAdd = allowedEmails.filter(email => !currentEmails.includes(email));
        const toRemove = currentEmails.filter(email => !allowedEmails.includes(email));
        
        for (const email of toAdd) {
          await this.addPermission(driveFileId, email);
        }
        for (const email of toRemove) {
          await this.removePermission(driveFileId, email);
        }
      }
    } catch (error) {
      console.error('Error syncing permissions:', error);
      throw error;
    }
  },
  
  async listPermissions(fileId) {
    try {
      const response = await Files.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,role)`);
      if (!response.ok) {
        console.warn(`Failed to list permissions with emailAddress, falling back to id/role only`);
        const fallbackRes = await Files.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,role)`);
        if (!fallbackRes.ok) return [];
        const data = await fallbackRes.json();
        return data.permissions || [];
      }
      const data = await response.json();
      return data.permissions || [];
    } catch (error) {
      console.error('Error listing permissions:', error);
      return []; // Return empty array to prevent crashing and allow addPermission to proceed
    }
  }
};
