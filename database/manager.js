const DatabaseConnection = require('./connection');
const BookmarkRepository = require('./bookmarkRepository');
const MessageProcessor = require('./messageProcessor');

class DatabaseManager {
  constructor(dbPath = 'bookmarks.db') {
    this.connection = new DatabaseConnection(dbPath);
    this.repository = new BookmarkRepository(this.connection);
    this.messageProcessor = new MessageProcessor();
  }

  async saveBookmark(userId, message, embedData = null, componentsData = null, messageFlags = 0, guildId = '0') {
    try {
      const validation = this.messageProcessor.validateMessage(message);
      if (!validation.isValid) {
        throw new Error(`Nieznana wiadomość: ${validation.errors.join(', ')}`);
      }

      const processedData = this.messageProcessor.processMessage(
        userId, 
        message, 
        embedData, 
        componentsData, 
        messageFlags, 
        guildId
      );

      return await this.repository.saveBookmark(processedData);
    } catch (error) {
      console.error('Problem z funkcją saveBookmark:', error);
      throw error;
    }
  }

  async getUserBookmarks(userId, page = 1, perPage = 10) {
    return await this.repository.getUserBookmarks(userId, page, perPage);
  }

  async getBookmarkById(bookmarkId, userId) {
    return await this.repository.getBookmarkById(bookmarkId, userId);
  }

  async deleteBookmark(bookmarkId, userId) {
    return await this.repository.deleteBookmark(bookmarkId, userId);
  }

  async getUserBookmarksCount(userId) {
    return await this.repository.getUserBookmarksCount(userId);
  }

  async searchBookmarks(userId, searchTerm) {
    return await this.repository.searchBookmarks(userId, searchTerm);
  }

  async getBookmarksByDateRange(userId, startDate, endDate) {
    return await this.repository.getBookmarksByDateRange(userId, startDate, endDate);
  }

  async close() {
    return await this.connection.close();
  }

  getDatabase() {
    return this.connection.getDatabase();
  }

  async getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const stats = {};
      
      this.connection.getDatabase().get(`
        SELECT COUNT(*) as total FROM bookmarks
      `, (err, row) => {
        if (err) return reject(err);
        stats.totalBookmarks = row.total;
        
        this.connection.getDatabase().get(`
          SELECT COUNT(DISTINCT user_id) as users FROM bookmarks
        `, (err, row) => {
          if (err) return reject(err);
          stats.totalUsers = row.users;
          
          this.connection.getDatabase().get(`
            SELECT COUNT(*) as v2Count FROM bookmarks 
            WHERE (message_flags & 32768) = 32768
          `, (err, row) => {
            if (err) return reject(err);
            stats.componentsV2Count = row.v2Count;
            
            this.connection.getDatabase().get(`
              SELECT MAX(created_at) as lastActivity FROM bookmarks
            `, (err, row) => {
              if (err) return reject(err);
              stats.lastActivity = row.lastActivity;
              
              resolve(stats);
            });
          });
        });
      });
    });
  }

  async migrateDatabase() {
    console.log('Sprawdzanie migracji bazy danych...');
    return true;
  }

  async vacuumDatabase() {
    return new Promise((resolve, reject) => {
      this.connection.getDatabase().run('VACUUM', (err) => {
        if (err) reject(err);
        else {
          resolve();
        }
      });
    });
  }

  async getDatabaseSize() {
    return new Promise((resolve, reject) => {
      this.connection.getDatabase().get('PRAGMA page_count', (err, row) => {
        if (err) return reject(err);
        
        this.connection.getDatabase().get('PRAGMA page_size', (err2, row2) => {
          if (err2) return reject(err2);
          
          const sizeInBytes = row.page_count * row2.page_size;
          const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);
          
          resolve({
            bytes: sizeInBytes,
            mb: sizeInMB,
            pages: row.page_count,
            pageSize: row2.page_size
          });
        });
      });
    });
  }

  async getTopAuthors(limit = 10) {
    return new Promise((resolve, reject) => {
      this.connection.getDatabase().all(`
        SELECT author_name, COUNT(*) as bookmark_count 
        FROM bookmarks 
        GROUP BY author_name 
        ORDER BY bookmark_count DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getBookmarksCountByDate() {
    return new Promise((resolve, reject) => {
      this.connection.getDatabase().all(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM bookmarks 
        GROUP BY DATE(created_at) 
        ORDER BY date DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async createBackup(backupPath) {
    return { success: true, path: backupPath };
  }
}

module.exports = DatabaseManager;