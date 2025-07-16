const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class ViewBookmarkButton {
  constructor(bookmarkId, dbManager, bookmarksView) {
    this.components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`view_bookmark_${bookmarkId}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📖')
      )
    ];
    this.bookmarkId = bookmarkId;
    this.dbManager = dbManager;
    this.bookmarksView = bookmarksView;
    this.timeout = 300000;
  }
}

module.exports = ViewBookmarkButton;