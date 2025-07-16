class BookmarkRepository {
  constructor(dbConnection) {
    this.db = dbConnection.getDatabase();
  }

  saveBookmark(bookmarkData) {
    return new Promise((resolve, reject) => {
      console.log('Zapisywanie wiadomości do bazy:', {
        userId: bookmarkData.userId,
        messageId: bookmarkData.messageId,
        channelId: bookmarkData.channelId,
        guildId: bookmarkData.guildId,
        authorName: bookmarkData.authorName,
        isComponentsV2: bookmarkData.isComponentsV2
      });

      this.db.run(`
        INSERT INTO bookmarks
        (user_id, message_id, channel_id, guild_id, message_content,
         embed_data, author_name, author_avatar, timestamp, created_at,
         attachments_data, components_data, message_flags, components_v2_data, components_v2_content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bookmarkData.userId,
        bookmarkData.messageId,
        bookmarkData.channelId,
        bookmarkData.guildId,
        bookmarkData.messageContent,
        bookmarkData.embedData,
        bookmarkData.authorName,
        bookmarkData.authorAvatar,
        bookmarkData.timestamp,
        bookmarkData.createdAt,
        bookmarkData.attachmentsData,
        bookmarkData.componentsData,
        bookmarkData.messageFlags,
        bookmarkData.componentsV2Data,
        bookmarkData.componentsV2Content
      ], function(err) {
        if (err) {
          console.error('Błąd zapisywania do bazy danych:', err);
          reject(err);
        } else {
          console.log('Pomyślnie zapisano zakładkę z ID:', this.lastID);
          resolve(this.lastID);
        }
      });
    });
  }

  getUserBookmarks(userId, page = 1, perPage = 10) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * perPage;
      
      this.db.all(`
        SELECT * FROM bookmarks
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [userId, perPage, offset], (err, rows) => {
        if (err) return reject(err);
        
        this.db.get(`
          SELECT COUNT(*) AS total FROM bookmarks 
          WHERE user_id = ?
        `, [userId], (err, countRow) => {
          if (err) return reject(err);
          resolve({ bookmarks: rows, total: countRow.total });
        });
      });
    });
  }

  getBookmarkById(bookmarkId, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM bookmarks 
        WHERE id = ? AND user_id = ?
      `, [bookmarkId, userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  deleteBookmark(bookmarkId, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT user_id FROM bookmarks 
        WHERE id = ?
      `, [bookmarkId], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ success: false, message: "Zakładka nie istnieje." });
        if (row.user_id !== userId) return resolve({ success: false, message: "Nie masz uprawnień do usunięcia tej zakładki." });

        this.db.run(`
          DELETE FROM bookmarks 
          WHERE id = ?
        `, [bookmarkId], function(err) {
          if (err) reject(err);
          else resolve({ success: true, message: "Zakładka została usunięta." });
        });
      });
    });
  }

  getUserBookmarksCount(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT COUNT(*) AS count FROM bookmarks 
        WHERE user_id = ?
      `, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  getBookmarksByDateRange(userId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM bookmarks
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
        ORDER BY created_at DESC
      `, [userId, startDate, endDate], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  searchBookmarks(userId, searchTerm) {
    return new Promise((resolve, reject) => {
      const searchPattern = `%${searchTerm}%`;
      this.db.all(`
        SELECT * FROM bookmarks
        WHERE user_id = ? AND (
          message_content LIKE ? OR 
          components_v2_content LIKE ? OR
          author_name LIKE ?
        )
        ORDER BY created_at DESC
      `, [userId, searchPattern, searchPattern, searchPattern], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = BookmarkRepository;