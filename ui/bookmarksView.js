const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  ButtonStyle
} = require('discord.js');

const { MessageType } = require('./messageTypes');
const SmartMessageRenderer = require('./messageRenderer');
const MessageUtils = require('./messageUtils');
const { BookmarksPageView } = require('./viewClasses');

class BookmarksView {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.renderer = new SmartMessageRenderer(dbManager);
    this.utils = new MessageUtils();
  }

  async createBookmarksPage(userId, page = 1) {
    if (page < 1) page = 1;
    
    const { bookmarks, total } = await this.dbManager.getUserBookmarks(userId, page);
    const maxPages = Math.ceil(total / 10);
    
    if (!bookmarks || bookmarks.length === 0) {
      return { bookmarks: [], total, maxPages };
    }

    const embed = new EmbedBuilder()
      .setTitle("📚 Twoje zakładki")
      .setDescription(`Strona ${page}/${maxPages} (łącznie ${total} zakładek)`)
      .setColor(0x3498db);

    const bookmarkOptions = [];

    for (const bookmark of bookmarks) {
      const bookmarkId = bookmark.id;
      
      const messageType = this.renderer.detectMessageType(bookmark);
      const typeIcon = this.getTypeIcon(messageType);
      
      const messageContent = bookmark.components_v2_content || bookmark.message_content || "(brak treści)";
      const authorName = bookmark.author_name;
      const timestamp = new Date(bookmark.timestamp).toLocaleString('pl-PL');
      const attachmentsData = bookmark.attachments_data;

      let attachmentInfo = "";
      if (attachmentsData) {
        try {
          const attachments = JSON.parse(attachmentsData);
          const imageCount = attachments.filter(a => a.isImage).length;
          const videoCount = attachments.filter(a => 
            ['.mp4', '.mov', '.webm', '.avi', '.mkv']
            .some(ext => a.filename && a.filename.toLowerCase().endsWith(ext))
          ).length;
          const otherCount = attachments.length - imageCount - videoCount;

          if (imageCount > 0) attachmentInfo += ` 📷 ${imageCount}`;
          if (videoCount > 0) attachmentInfo += ` 🎬 ${videoCount}`;
          if (otherCount > 0) attachmentInfo += ` 📎 ${otherCount}`;
        } catch (e) {
          console.error("Błąd przetwarzania załączników:", e);
        }
      }

      if (messageType === MessageType.COMPONENTS_V2 && bookmark.components_v2_data) {
        try {
          const v2Data = JSON.parse(bookmark.components_v2_data);
          const mediaCount = this.utils.countComponentsV2Media(v2Data);
          if (mediaCount > 0) attachmentInfo += ` 🎛️ ${mediaCount}`;
        } catch (e) {
          console.error("Błąd przetwarzania Components v2 media:", e);
        }
      }

      const shortContent = messageContent.length > 100 ? 
        messageContent.substring(0, 97) + "..." : 
        messageContent;

      let fieldName = `ID: ${bookmarkId} | ${authorName} | ${timestamp}`;
      if (attachmentInfo) fieldName += ` | ${attachmentInfo}`;
      
      fieldName += ` | ${typeIcon}`;

      embed.addFields({
        name: fieldName,
        value: shortContent,
        inline: false
      });

      let optionLabel = messageContent;
      if (optionLabel.length > 80) optionLabel = optionLabel.substring(0, 77) + "...";
      else if (!optionLabel) optionLabel = "(brak treści)";

      bookmarkOptions.push({
        label: `ID: ${bookmarkId} ${typeIcon}`,
        description: optionLabel,
        value: bookmarkId.toString()
      });
    }

    const view = new BookmarksPageView(this.dbManager, bookmarkOptions, page, maxPages);
    return { embed, view, bookmarks, total, maxPages };
  }

  getTypeIcon(messageType) {
    switch (messageType) {
      case MessageType.COMPONENTS_V2:
        return '🎛️ v2';
      case MessageType.EMBED:
        return '📋 embed';
      case MessageType.MIXED:
        return '🔗 mieszana';
      case MessageType.ATTACHMENTS_ONLY:
        return '📎 załączniki';
      case MessageType.PLAIN_TEXT:
        return '💬 tekst';
      default:
        return '❓';
    }
  }

  async createBookmarkDetailDisplay(bookmark) {
    console.log(`Creating bookmark detail for ID: ${bookmark.id}`);
    
    const renderResult = await this.renderer.renderBookmarkMessage(bookmark);
    
    console.log(`Rendered as type: ${renderResult.type}`);
    
    const linkData = [bookmark.guild_id, bookmark.channel_id, bookmark.message_id];
    
    return {
      ...renderResult,
      linkData: linkData
    };
  }

  createBookmarkDetailEmbed(bookmark) {
    console.log('Using legacy createBookmarkDetailEmbed method');
    return this.createBookmarkDetailDisplay(bookmark);
  }
}

module.exports = { BookmarksView };