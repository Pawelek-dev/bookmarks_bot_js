const sqlite3 = require('sqlite3').verbose();

class DatabaseConnection {
  constructor(dbPath = 'bookmarks.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initDb();
  }

  initDb() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          guild_id TEXT NOT NULL DEFAULT '0',
          message_content TEXT,
          embed_data TEXT,
          author_name TEXT,
          author_avatar TEXT,
          timestamp TEXT,
          created_at TEXT,
          attachments_data TEXT,
          components_data TEXT,
          message_flags INTEGER DEFAULT 0,
          components_v2_data TEXT,
          components_v2_content TEXT
        )
      `);

      this.ensureColumnsExist();
    });
  }

  ensureColumnsExist() {
    this.db.all("PRAGMA table_info(bookmarks)", (err, rows) => {
      if (err) {
        console.error("Błąd przy pobieraniu informacji o tabeli:", err);
        return;
      }
      
      if (!rows || !Array.isArray(rows)) return;
      
      const columns = rows.map(row => row.name);
      const columnsToAdd = [
        { name: 'attachments_data', definition: 'TEXT' },
        { name: 'components_data', definition: 'TEXT' },
        { name: 'message_flags', definition: 'INTEGER DEFAULT 0' },
        { name: 'components_v2_data', definition: 'TEXT' },
        { name: 'components_v2_content', definition: 'TEXT' }
      ];

      columnsToAdd.forEach(column => {
        if (!columns.includes(column.name)) {
          this.addColumn(column.name, column.definition);
        }
      });
    });
  }

  addColumn(columnName, definition) {
    this.db.run(`ALTER TABLE bookmarks ADD COLUMN ${columnName} ${definition}`, (err) => {
      if (err) {
        console.error(`Błąd dodawania kolumny ${columnName}:`, err);
      } else {
        console.log(`Dodano kolumnę ${columnName} do tabeli bookmarks`);
      }
    });
  }

  getDatabase() {
    return this.db;
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = DatabaseConnection;