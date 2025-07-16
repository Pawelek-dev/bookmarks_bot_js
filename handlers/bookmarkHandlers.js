const { 
  EmbedBuilder, 
  MessageFlags,
  TextDisplayBuilder
} = require('discord.js');

class BookmarkHandlers {
  constructor(dbManager, bookmarksView) {
    this.dbManager = dbManager;
    this.bookmarksView = bookmarksView;
  }

  async handleBookmarksCommand(interaction, page) {
    if (page < 1) page = 1;
    
    const { embed, view, bookmarks, total, maxPages } = 
      await this.bookmarksView.createBookmarksPage(interaction.user.id, page);

    if (!bookmarks || bookmarks.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle("📚 Twoje zakładki")
        .setDescription("Nie masz jeszcze zapisanych wiadomości.")
        .setColor(0x3498db);
      
      return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    await interaction.reply({ 
      embeds: [embed],
      components: view.rows,
      ephemeral: true
    });
  }

  async handleBookmarkCommand(interaction, id) {
    const bookmark = await this.dbManager.getBookmarkById(id, interaction.user.id);
    
    if (!bookmark) {
      return interaction.reply({
        content: "Nie znaleziono zakładki o podanym ID lub nie masz do niej dostępu.",
        ephemeral: true
      });
    }

    const displayResult = await this.bookmarksView.createBookmarkDetailDisplay(bookmark);
    
    console.log(`Displaying bookmark ${id} as type: ${displayResult.type}`);

    let replyData = { ephemeral: true };

    if (displayResult.type === 'components_v2') {
      replyData.components = displayResult.components;
      replyData.flags = displayResult.flags;
    } else {
      replyData.embeds = displayResult.embeds || [];
      replyData.components = displayResult.view || [];
    }

    await interaction.reply(replyData);
  }

  async handleDeleteBookmark(interaction, id) {
    const { success, message } = await this.dbManager.deleteBookmark(id, interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setTitle(success ? "🗑️ Zakładka usunięta" : "❌ Błąd")
      .setDescription(message)
      .setColor(success ? 0x00FF00 : 0xFF0000);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async handleBookmarkSelection(interaction) {
    const bookmarkId = parseInt(interaction.values[0]);
    const bookmark = await this.dbManager.getBookmarkById(bookmarkId, interaction.user.id);

    if (!bookmark) {
      return interaction.reply({
        content: "Nie znaleziono zakładki o podanym ID lub nie masz do niej dostępu.",
        ephemeral: true
      });
    }

    const displayResult = await this.bookmarksView.createBookmarkDetailDisplay(bookmark);
    
    console.log(`Displaying bookmark ${bookmarkId} as type: ${displayResult.type}`);

    let replyData = { ephemeral: true };

    if (displayResult.type === 'components_v2') {
      replyData.components = displayResult.components;
      replyData.flags = displayResult.flags;
    } else {
      replyData.embeds = displayResult.embeds || [];
      replyData.components = displayResult.view || [];
    }

    await interaction.reply(replyData);
  }

  async handlePageNavigation(interaction) {
    const currentView = interaction.message.components[0];
    const pageInfo = currentView.components.find(c => c.type === 'BUTTON' && !c.disabled);
    
    if (!pageInfo) return;
    
    const currentPage = parseInt(pageInfo.label?.match(/Strona (\d+)/)?.[1]) || 1;
    const newPage = interaction.customId === 'prev_page' ? currentPage - 1 : currentPage + 1;
    
    const { embed, view } = await this.bookmarksView.createBookmarksPage(interaction.user.id, newPage);
    await interaction.update({ 
      embeds: [embed], 
      components: view.rows
    });
  }

  async handleDeleteBookmarkButton(interaction) {
    console.log('Delete bookmark button clicked!');
    console.log('Message flags:', interaction.message.flags);
    console.log('Message embeds:', interaction.message.embeds?.length || 0);
    console.log('Message components:', interaction.message.components?.length || 0);
    
    let bookmarkId;
    
    if (interaction.message.flags && interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
      console.log('Searching for bookmark ID in Components v2 message');
      bookmarkId = this.extractBookmarkIdFromComponentsV2(interaction.message.components);
      console.log('Found bookmark ID from Components v2:', bookmarkId);
    } else if (interaction.message.embeds && interaction.message.embeds.length > 0) {
      console.log('Searching for bookmark ID in embed title');
      bookmarkId = interaction.message.embeds[0].title?.match(/#(\d+)/)?.[1];
      console.log('Found bookmark ID from embed:', bookmarkId);
    }
    
    if (!bookmarkId) {
      console.error('Could not find bookmark ID in message');
      return interaction.reply({
        content: "❌ Nie można zidentyfikować zakładki do usunięcia.",
        ephemeral: true
      });
    }

    console.log(`Attempting to delete bookmark ${bookmarkId}`);
    const { success, message } = await this.dbManager.deleteBookmark(parseInt(bookmarkId), interaction.user.id);
    
    if (success) {
      if (interaction.message.flags && interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
        await interaction.update({
          components: [
            new TextDisplayBuilder()
              .setContent(`✅ **Zakładka #${bookmarkId} została usunięta**\n*Ta wiadomość zastąpiła oryginalną zakładkę.*`)
          ],
          flags: MessageFlags.IsComponentsV2
        });
      } else {
        await interaction.update({ 
          content: "✅ Zakładka usunięta",
          embeds: [],
          components: []
        });
      }
    } else {
      await interaction.reply({ 
        content: `❌ ${message}`, 
        ephemeral: true 
      });
    }
  }

  async handleViewBookmarkButton(interaction) {
    const bookmarkId = parseInt(interaction.customId.split('_')[2]);
    const bookmark = await this.dbManager.getBookmarkById(bookmarkId, interaction.user.id);

    if (!bookmark) {
      return interaction.reply({
        content: "Nie znaleziono zakładki o podanym ID lub nie masz do niej dostępu.",
        ephemeral: true
      });
    }

    const displayResult = await this.bookmarksView.createBookmarkDetailDisplay(bookmark);
    
    console.log(`Displaying bookmark ${bookmarkId} as type: ${displayResult.type}`);

    let replyData = { ephemeral: true };

    if (displayResult.type === 'components_v2') {
      replyData.components = displayResult.components;
      replyData.flags = displayResult.flags;
    } else {
      replyData.embeds = displayResult.embeds || [];
      replyData.components = displayResult.view || [];
    }

    await interaction.reply(replyData);
  }

  extractBookmarkIdFromComponentsV2(components) {
    try {
      console.log('Analyzing Components v2 structure for bookmark ID');
      
      const findTextInComponent = (component) => {
        console.log(`Checking component type: ${component.type}`);
        
        if (component.type === 10) {
          const content = component.content || '';
          console.log(`Found TextDisplay with content: "${content}"`);
          const match = content.match(/Zakładka #(\d+)/);
          if (match) {
            console.log(`Found bookmark ID: ${match[1]}`);
            return match[1];
          }
        }
        
        if (component.components && Array.isArray(component.components)) {
          console.log(`Checking ${component.components.length} nested components`);
          for (const child of component.components) {
            const result = findTextInComponent(child);
            if (result) return result;
          }
        }
        
        return null;
      };

      for (let i = 0; i < components.length; i++) {
        const component = components[i];
        console.log(`Checking top-level component ${i}:`, component);
        
        if (component.type === 10) {
          const result = findTextInComponent(component);
          if (result) return result;
        } else if (component.type === 17 || component.type === 15) {
          if (component.components) {
            for (const child of component.components) {
              const result = findTextInComponent(child);
              if (result) return result;
            }
          }
        }
      }
      
      console.log('No bookmark ID found in components');
      return null;
    } catch (error) {
      console.error('Błąd ekstrakcji ID z Components v2:', error);
      return null;
    }
  }
}

module.exports = BookmarkHandlers;