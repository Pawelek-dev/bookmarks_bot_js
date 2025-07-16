const BookmarkHandlers = require('./bookmarkHandlers');
const SaveMessageHandler = require('./saveMessageHandler');

class InteractionRouter {
  constructor(dbManager, bookmarksView) {
    this.dbManager = dbManager;
    this.bookmarksView = bookmarksView;
    this.bookmarkHandlers = new BookmarkHandlers(dbManager, bookmarksView);
    this.saveMessageHandler = new SaveMessageHandler(dbManager, bookmarksView);
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Save Message') {
        await this.saveMessageHandler.handleSaveMessage(interaction);
      }
      else if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      }
      else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await this.handleComponentInteraction(interaction);
      }
    } catch (e) {
      console.error("Błąd obsługi interakcji:", e);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ 
          content: "Wystąpił błąd podczas przetwarzania komendy", 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: "Wystąpił błąd podczas przetwarzania komendy", 
          ephemeral: true 
        });
      }
    }
  }

  async handleSlashCommand(interaction) {
    const commandName = interaction.commandName;

    if (commandName === 'bookmarks') {
      const page = interaction.options.getInteger('page') || 1;
      await this.bookmarkHandlers.handleBookmarksCommand(interaction, page);
    } 
    else if (commandName === 'bookmark') {
      const id = interaction.options.getInteger('id');
      await this.bookmarkHandlers.handleBookmarkCommand(interaction, id);
    } 
    else if (commandName === 'delete_bookmark') {
      const id = interaction.options.getInteger('id');
      await this.bookmarkHandlers.handleDeleteBookmark(interaction, id);
    }
  }

  async handleComponentInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'bookmark_select') {
      await this.bookmarkHandlers.handleBookmarkSelection(interaction);
    }
    else if (interaction.isButton()) {
      if (interaction.customId === 'prev_page' || interaction.customId === 'next_page') {
        await this.bookmarkHandlers.handlePageNavigation(interaction);
      }
      else if (interaction.customId === 'delete_bookmark') {
        await this.bookmarkHandlers.handleDeleteBookmarkButton(interaction);
      }
      else if (interaction.customId.startsWith('view_bookmark_')) {
        await this.bookmarkHandlers.handleViewBookmarkButton(interaction);
      }
    }
  }
}

module.exports = InteractionRouter;