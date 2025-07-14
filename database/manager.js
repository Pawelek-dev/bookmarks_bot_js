const sqlite3 = require('sqlite3').verbose();
const { MessageFlags } = require('discord.js');

class DatabaseManager {
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

      this.db.all("PRAGMA table_info(bookmarks)", (err, rows) => {
        if (err) {
          console.error("Błąd przy pobieraniu informacji o tabeli:", err);
          return;
        }
        
        if (!rows || !Array.isArray(rows)) return;
        
        const columns = rows.map(row => row.name);
        
        if (!columns.includes('attachments_data')) {
          this.db.run("ALTER TABLE bookmarks ADD COLUMN attachments_data TEXT", (alterErr) => {
            if (alterErr) console.error("Błąd dodawania kolumny attachments_data:", alterErr);
          });
        }
        
        if (!columns.includes('components_data')) {
          this.db.run("ALTER TABLE bookmarks ADD COLUMN components_data TEXT", (alterErr) => {
            if (alterErr) console.error("Błąd dodawania kolumny components_data:", alterErr);
          });
        }
        
        if (!columns.includes('message_flags')) {
          this.db.run("ALTER TABLE bookmarks ADD COLUMN message_flags INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) console.error("Błąd dodawania kolumny message_flags:", alterErr);
          });
        }

        if (!columns.includes('components_v2_data')) {
          this.db.run("ALTER TABLE bookmarks ADD COLUMN components_v2_data TEXT", (alterErr) => {
            if (alterErr) console.error("Błąd dodawania kolumny components_v2_data:", alterErr);
          });
        }

        if (!columns.includes('components_v2_content')) {
          this.db.run("ALTER TABLE bookmarks ADD COLUMN components_v2_content TEXT", (alterErr) => {
            if (alterErr) console.error("Błąd dodawania kolumny components_v2_content:", alterErr);
          });
        }
      });
    });
  }

  extractComponentsV2Data(components) {
    const extractedData = {
      textContent: [],
      images: [],
      mediaGallery: [],
      buttons: [],
      selectMenus: [],
      sections: [],
      separators: [],
      containers: []
    };

    const processComponent = (component, depth = 0) => {
      if (!component || !component.type) return;

      const indent = '  '.repeat(depth);
      console.log(`${indent}Processing component type: ${component.type}`);

      switch (component.type) {
        case 17:
          console.log(`${indent}Container found`);
          extractedData.containers.push({
            type: 'container',
            accent_color: component.accent_color || null,
            spoiler: component.spoiler || false,
            components_count: component.components?.length || 0
          });
          if (component.components) {
            component.components.forEach(child => processComponent(child, depth + 1));
          }
          break;

        case 10:
          console.log(`${indent}TextDisplay found: ${component.content?.substring(0, 50)}...`);
          if (component.content) {
            extractedData.textContent.push({
              type: 'text_display',
              content: component.content,
              id: component.id || null
            });
          }
          break;

        case 12:
          console.log(`${indent}Media component found`);
          if (component.items && Array.isArray(component.items)) {
            component.items.forEach(item => {
              if (item.media && item.media.url) {
                extractedData.images.push({
                  type: 'media',
                  url: item.media.url,
                  description: item.description || null,
                  spoiler: item.spoiler || false,
                  width: item.media.width || null,
                  height: item.media.height || null
                });
              }
            });
          } else if (component.media) {
            extractedData.images.push({
              type: 'media',
              url: component.media.url || null,
              description: component.description || null,
              spoiler: component.spoiler || false,
              width: component.media.width || null,
              height: component.media.height || null
            });
          }
          break;

        case 14:
          console.log(`${indent}MediaGallery found`);
          if (component.items) {
            component.items.forEach(item => {
              extractedData.mediaGallery.push({
                type: 'media_gallery_item',
                url: item.media?.url || null,
                description: item.description || null,
                spoiler: item.spoiler || false
              });
            });
          }
          break;

        case 15:
          console.log(`${indent}Section found`);
          const sectionData = {
            type: 'section',
            text_displays: [],
            button_accessory: null,
            thumbnail_accessory: null
          };

          if (component.components) {
            component.components.forEach(child => {
              if (child.type === 10) {
                sectionData.text_displays.push(child.content);
              }
            });
          }

          if (component.button_accessory) {
            sectionData.button_accessory = {
              label: component.button_accessory.label,
              custom_id: component.button_accessory.custom_id,
              style: component.button_accessory.style
            };
          }

          if (component.thumbnail_accessory) {
            sectionData.thumbnail_accessory = {
              url: component.thumbnail_accessory.url,
              description: component.thumbnail_accessory.description
            };
          }

          extractedData.sections.push(sectionData);
          break;

        case 16:
          console.log(`${indent}Separator found`);
          extractedData.separators.push({
            type: 'separator',
            spacing: component.spacing || 'small',
            divider: component.divider !== undefined ? component.divider : true
          });
          break;

        case 2:
          console.log(`${indent}Button found: ${component.label}`);
          extractedData.buttons.push({
            type: 'button',
            label: component.label || null,
            custom_id: component.custom_id || null,
            style: component.style || null,
            emoji: component.emoji || null,
            url: component.url || null,
            disabled: component.disabled || false
          });
          break;

        case 3:
        case 5:
        case 6:
        case 7:
        case 8:
          console.log(`${indent}Select menu found (type ${component.type})`);
          extractedData.selectMenus.push({
            type: `select_${component.type}`,
            custom_id: component.custom_id || null,
            placeholder: component.placeholder || null,
            options: component.options || [],
            min_values: component.min_values || null,
            max_values: component.max_values || null
          });
          break;

        case 1:
          console.log(`${indent}ActionRow found`);
          if (component.components) {
            component.components.forEach(child => processComponent(child, depth + 1));
          }
          break;

        case 9:
          console.log(`${indent}Type 9 component found - treating as section`);
          const type9SectionData = {
            type: 'section_type_9',
            text_displays: [],
            button_accessory: null,
            thumbnail_accessory: null
          };

          if (component.components) {
            component.components.forEach(child => {
              if (child.type === 10) {
                type9SectionData.text_displays.push(child.content);
              }
            });
          }

          if (component.button_accessory) {
            type9SectionData.button_accessory = {
              label: component.button_accessory.label,
              custom_id: component.button_accessory.custom_id,
              style: component.button_accessory.style
            };
          }

          if (component.thumbnail_accessory) {
            type9SectionData.thumbnail_accessory = {
              url: component.thumbnail_accessory.url,
              description: component.thumbnail_accessory.description
            };
          }

          extractedData.sections.push(type9SectionData);
          break;

        default:
          console.log(`${indent}Unknown component type: ${component.type}`);
          break;
      }
    };

    if (components && Array.isArray(components)) {
      components.forEach(component => processComponent(component, 0));
    }

    return extractedData;
  }

  componentsV2ToText(extractedData) {
    const textParts = [];

    extractedData.textContent.forEach(text => {
      textParts.push(text.content);
    });

    extractedData.sections.forEach(section => {
      if (section.text_displays.length > 0) {
        textParts.push(...section.text_displays);
      }
      if (section.button_accessory) {
        textParts.push(`[Przycisk: ${section.button_accessory.label}]`);
      }
    });

    extractedData.buttons.forEach(button => {
      if (button.label) {
        textParts.push(`[Przycisk: ${button.label}]`);
      }
    });

    extractedData.selectMenus.forEach(menu => {
      if (menu.placeholder) {
        textParts.push(`[Menu: ${menu.placeholder}]`);
      }
    });

    extractedData.separators.forEach((separator, index) => {
      const dividerText = separator.divider ? 'z linią' : 'bez linii';
      const spacingText = separator.spacing === 'large' ? 'duży' : 'mały';
      textParts.push(`[Separator ${index + 1}: ${spacingText} odstęp, ${dividerText}]`);
    });

    return textParts.join('\n');
  }

  saveBookmark(userId, message, embedData = null, componentsData = null, messageFlags = 0, guildId = '0') {
    return new Promise((resolve, reject) => {
      if (!message) {
        return reject(new Error('Message object is null or undefined'));
      }
      
      if (!message.author) {
        return reject(new Error('Message author is null or undefined'));
      }
      
      const channelId = message.channel?.id || message.channelId;
      
      if (!channelId) {
        return reject(new Error('Message channel ID is null or undefined'));
      }

      console.log('Zapisywanie wiadomości do bazy:', {
        userId: userId,
        messageId: message.id,
        channelId: channelId,
        guildId: guildId,
        authorId: message.author?.id,
        authorName: message.author?.username,
        hasChannel: !!message.channel,
        hasChannelId: !!message.channelId
      });

      const flags = (messageFlags && typeof messageFlags === 'object' && 'bitfield' in messageFlags)
        ? messageFlags.bitfield
        : messageFlags;

      const isComponentsV2 = (flags & 32768) === 32768;
      console.log('Is Components v2:', isComponentsV2);
      
      const authorName = message.author.displayName || message.author.username || 'Unknown User';
      const authorAvatar = message.author.avatarURL() || null;
      
      let timestamp;
      if (message.createdAt && typeof message.createdAt.toISOString === 'function') {
        timestamp = message.createdAt.toISOString();
      } else if (message.timestamp) {
        if (typeof message.timestamp === 'string' || typeof message.timestamp === 'number') {
          timestamp = new Date(parseInt(message.timestamp)).toISOString();
        } else if (message.timestamp instanceof Date) {
          timestamp = message.timestamp.toISOString();
        } else {
          timestamp = new Date().toISOString();
        }
      } else {
        try {
          const snowflakeTimestamp = (BigInt(message.id) >> 22n) + 1420070400000n;
          timestamp = new Date(Number(snowflakeTimestamp)).toISOString();
        } catch (e) {
          console.warn('Nie można wyciągnąć timestamp z snowflake, używam bieżącego czasu');
          timestamp = new Date().toISOString();
        }
      }
      
      const createdAt = new Date().toISOString();
      
      let attachmentsData = null;
      if (message.attachments && message.attachments.size > 0) {
        const attachments = Array.from(message.attachments.values()).map(attachment => ({
          id: attachment.id,
          url: attachment.url,
          filename: attachment.name,
          contentType: attachment.contentType,
          width: attachment.width,
          height: attachment.height,
          size: attachment.size,
          isImage: attachment.contentType?.startsWith('image/')
        }));
        attachmentsData = JSON.stringify(attachments);
      }

      let componentsV2Data = null;
      let componentsV2Content = null;
      let finalMessageContent = message.content || '';

      if (isComponentsV2 && componentsData && componentsData.length > 0) {
        console.log('Przetwarzanie Components v2...');
        console.log('Raw components data:', JSON.stringify(componentsData, null, 2));
        
        try {
          const rawComponentsData = componentsData.map(c => {
            if (typeof c.toJSON === 'function') {
              return c.toJSON();
            }
            return c;
          });

          componentsV2Data = JSON.stringify(rawComponentsData);
          
          const extractedData = this.extractComponentsV2Data(rawComponentsData);
          console.log('Extracted Components v2 data:', extractedData);
          
          componentsV2Content = this.componentsV2ToText(extractedData);
          console.log('Components v2 content:', componentsV2Content);
          
          if (!finalMessageContent && componentsV2Content) {
            finalMessageContent = componentsV2Content;
          }
          
        } catch (e) {
          console.error('Błąd przetwarzania Components v2:', e);
        }
      }

      const serializedComponents = (componentsData && !isComponentsV2) ? 
        JSON.stringify(componentsData.map(c => c.toJSON())) : 
        null;

      console.log('Saving to database:', {
        finalMessageContent,
        componentsV2Data: !!componentsV2Data,
        componentsV2Content,
        isComponentsV2,
        flags
      });

      this.db.run(`
        INSERT INTO bookmarks
        (user_id, message_id, channel_id, guild_id, message_content,
         embed_data, author_name, author_avatar, timestamp, created_at,
         attachments_data, components_data, message_flags, components_v2_data, components_v2_content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        message.id,
        channelId,
        guildId,
        finalMessageContent,
        embedData,
        authorName,
        authorAvatar,
        timestamp,
        createdAt,
        attachmentsData,
        serializedComponents,
        flags,
        componentsV2Data,
        componentsV2Content
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
}

module.exports = DatabaseManager;