const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  EmbedBuilder, 
  ApplicationCommandType, 
  ContextMenuCommandBuilder, 
  SlashCommandBuilder,
  MessageFlags,
  ButtonStyle,
  TextDisplayBuilder
} = require('discord.js');
const DatabaseManager = require('../database/manager');
const { BookmarksView, BookmarksPageView, BookmarkDetailView, ComponentsV2DisplayView, SmartMessageRenderer, MessageType } = require('../ui/components');

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

class BookmarksCommandHandler {
  static async setup(client) {
    const dbManager = new DatabaseManager();
    const bookmarksView = new BookmarksView(dbManager);

    const saveMessageCommand = new ContextMenuCommandBuilder()
      .setName('Save Message')
      .setType(ApplicationCommandType.Message);
    
    await client.application.commands.create(saveMessageCommand);

    client.on('interactionCreate', async interaction => {
      try {
        if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Save Message') {
          await this.handleSaveMessage(interaction, dbManager, bookmarksView);
        }
        else if (interaction.isChatInputCommand()) {
          await this.handleSlashCommand(interaction, dbManager, bookmarksView);
        }
        else if (interaction.isButton() || interaction.isStringSelectMenu()) {
          await this.handleComponentInteraction(interaction, dbManager, bookmarksView);
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
    });
  }

  static async handleSaveMessage(interaction, dbManager, bookmarksView) {
    try {
      const message = interaction.targetMessage;
      
      if (!message) {
        return await interaction.reply({
          content: "❌ Nie można uzyskać dostępu do wiadomości.",
          ephemeral: true
        });
      }
      
      if (!message.author) {
        return await interaction.reply({
          content: "❌ Nie można uzyskać informacji o autorze wiadomości.",
          ephemeral: true
        });
      }
      
      const channelId = message.channel?.id || message.channelId || interaction.channelId;
      
      if (!channelId) {
        console.error('Nie można określić channelId z żadnego źródła');
        return await interaction.reply({
          content: "❌ Nie można określić kanału wiadomości.",
          ephemeral: true
        });
      }
      
      const guildId = message.guildId || interaction.guildId || '0';
      const messageFlags = message.flags;
      
      const isComponentsV2 = this.detectComponentsV2(message, messageFlags);
      
      console.log('Zapisywanie wiadomości:', {
        userId: interaction.user.id,
        messageId: message.id,
        channelId: channelId,
        guildId: guildId,
        isComponentsV2: isComponentsV2,
        hasComponents: !!message.components,
        componentsLength: message.components?.length,
        flags: messageFlags?.bitfield || messageFlags
      });

      let embedData = null;
      if (message.embeds.length > 0) {
        embedData = JSON.stringify(message.embeds.map(e => e.toJSON()));
      }
      
      let componentsData = null;
      if (message.components && message.components.length > 0) {
        if (isComponentsV2) {
          console.log('Components v2 detected, processing...');
          componentsData = this.processComponentsV2(message.components);
        } else {
          console.log('Traditional components detected');
          componentsData = message.components;
        }
      }
      
      const messageWithChannel = {
        ...message,
        channel: message.channel || { id: channelId }
      };
      
      const bookmarkId = await dbManager.saveBookmark(
        interaction.user.id, 
        messageWithChannel, 
        embedData,
        componentsData,
        messageFlags,
        guildId
      );

      const embed = new EmbedBuilder()
        .setTitle("📌 Wiadomość zapisana!")
        .setDescription(`Zapisano wiadomość od ${message.author.displayName || message.author.username}`)
        .setColor(0x00FF00)
        .addFields({ name: "ID zakładki", value: bookmarkId.toString() })
        .setFooter({ text: "Użyj /bookmarks aby zobaczyć swoje zakładki" });

      if (isComponentsV2) {
        embed.addFields({ 
          name: "🎛️ Typ wiadomości", 
          value: "Nowoczesna (Components v2)", 
          inline: true 
        });
        
        if (message.components && message.components.length > 0) {
          const componentInfo = this.analyzeComponentsV2Structure(message.components);
          if (componentInfo.length > 0) {
            embed.addFields({
              name: "📋 Struktura komponentów",
              value: componentInfo.join('\n'),
              inline: false
            });
          }
        }
      } else if (messageFlags && typeof messageFlags === 'object' && 'has' in messageFlags) {
        if (messageFlags.has(MessageFlags.IsComponentsV2)) {
          embed.addFields({ 
            name: "🔧 Typ wiadomości", 
            value: "Interaktywna (Components v2)", 
            inline: true 
          });
        }
      }

      if (message.attachments && message.attachments.size > 0) {
        const attachmentCount = message.attachments.size;
        let attachmentText;
        if (attachmentCount === 1) attachmentText = "załącznik";
        else if (attachmentCount < 5) attachmentText = "załączniki";
        else attachmentText = "załączników";
        
        embed.addFields({ 
          name: "📎 Załączniki", 
          value: `Zapisano ${attachmentCount} ${attachmentText}` 
        });
      }

      const view = new ViewBookmarkButton(bookmarkId, dbManager, bookmarksView);
      await interaction.reply({ 
        embeds: [embed], 
        components: view.components, 
        ephemeral: true 
      });
      
    } catch (error) {
      console.error('Błąd podczas zapisywania wiadomości:', error);
      console.error('Stack trace:', error.stack);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `❌ Wystąpił błąd podczas zapisywania wiadomości: ${error.message}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ Wystąpił błąd podczas zapisywania wiadomości: ${error.message}`,
          ephemeral: true
        });
      }
    }
  }

  static detectComponentsV2(message, messageFlags) {
    if (messageFlags) {
      if (typeof messageFlags === 'object' && 'bitfield' in messageFlags) {
        return (messageFlags.bitfield & 32768) === 32768;
      } else if (typeof messageFlags === 'object' && 'has' in messageFlags) {
        return messageFlags.has(MessageFlags.IsComponentsV2);
      } else if (typeof messageFlags === 'number') {
        return (messageFlags & 32768) === 32768;
      }
    }

    if (message.components && message.components.length > 0) {
      return this.hasComponentsV2Structure(message.components);
    }

    return false;
  }

  static hasComponentsV2Structure(components) {
    const v2ComponentTypes = [10, 12, 14, 15, 16, 17];
    
    const checkComponent = (component) => {
      const componentData = typeof component.toJSON === 'function' ? component.toJSON() : component;
      
      if (v2ComponentTypes.includes(componentData.type)) {
        return true;
      }
      
      if (componentData.components) {
        return componentData.components.some(checkComponent);
      }
      
      return false;
    };

    return components.some(checkComponent);
  }

  static processComponentsV2(components) {
    console.log('Processing Components v2 structure...');
    
    return components.map(component => {
      if (typeof component.toJSON === 'function') {
        const jsonData = component.toJSON();
        console.log(`Component type ${jsonData.type}:`, JSON.stringify(jsonData, null, 2));
        return jsonData;
      }
      console.log('Raw component:', JSON.stringify(component, null, 2));
      return component;
    });
  }

  static analyzeComponentsV2Structure(components) {
    const structure = [];
    let totalComponents = 0;
    const componentCounts = new Map();

    const analyzeComponent = (component, depth = 0) => {
      const componentData = typeof component.toJSON === 'function' ? component.toJSON() : component;
      totalComponents++;

      const typeName = this.getComponentTypeName(componentData.type);
      componentCounts.set(typeName, (componentCounts.get(typeName) || 0) + 1);

      if (depth === 0) {
        structure.push(`• ${typeName}`);
      }

      if (componentData.components) {
        componentData.components.forEach(child => analyzeComponent(child, depth + 1));
      }
      if (componentData.items) {
        componentData.items.forEach(item => analyzeComponent(item, depth + 1));
      }
    };

    components.forEach(component => analyzeComponent(component, 0));

    const summary = [`Łącznie: ${totalComponents} komponentów`];
    if (componentCounts.size > 1) {
      const typesBreakdown = Array.from(componentCounts.entries())
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      summary.push(`Typy: ${typesBreakdown}`);
    }

    return [...structure, ...summary];
  }

  static getComponentTypeName(type) {
    const typeMap = {
      1: "ActionRow",
      2: "Button",
      3: "StringSelect",
      4: "TextInput",
      5: "UserSelect",
      6: "RoleSelect",
      7: "MentionableSelect",
      8: "ChannelSelect",
      10: "TextDisplay",
      12: "Media",
      14: "MediaGallery",
      15: "Section",
      16: "Separator",
      17: "Container"
    };
    
    return typeMap[type] || `Nieznany (${type})`;
  }

  static async handleSlashCommand(interaction, dbManager, bookmarksView) {
    const commandName = interaction.commandName;

    if (commandName === 'bookmarks') {
      const page = interaction.options.getInteger('page') || 1;
      await this.handleBookmarksCommand(interaction, dbManager, bookmarksView, page);
    } 
    else if (commandName === 'bookmark') {
      const id = interaction.options.getInteger('id');
      await this.handleBookmarkCommand(interaction, dbManager, bookmarksView, id);
    } 
    else if (commandName === 'delete_bookmark') {
      const id = interaction.options.getInteger('id');
      await this.handleDeleteBookmark(interaction, dbManager, id);
    }
  }

  static async handleBookmarksCommand(interaction, dbManager, bookmarksView, page) {
    if (page < 1) page = 1;
    
    const { embed, view, bookmarks, total, maxPages } = 
      await bookmarksView.createBookmarksPage(interaction.user.id, page);

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

  static async handleBookmarkCommand(interaction, dbManager, bookmarksView, id) {
    const bookmark = await dbManager.getBookmarkById(id, interaction.user.id);
    
    if (!bookmark) {
      return interaction.reply({
        content: "Nie znaleziono zakładki o podanym ID lub nie masz do niej dostępu.",
        ephemeral: true
      });
    }

    const displayResult = await bookmarksView.createBookmarkDetailDisplay(bookmark);
    
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

  static async handleDeleteBookmark(interaction, dbManager, id) {
    const { success, message } = await dbManager.deleteBookmark(id, interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setTitle(success ? "🗑️ Zakładka usunięta" : "❌ Błąd")
      .setDescription(message)
      .setColor(success ? 0x00FF00 : 0xFF0000);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  static async handleComponentInteraction(interaction, dbManager, bookmarksView) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'bookmark_select') {
      const bookmarkId = parseInt(interaction.values[0]);
      const bookmark = await dbManager.getBookmarkById(bookmarkId, interaction.user.id);

      if (!bookmark) {
        return interaction.reply({
          content: "Nie znaleziono zakładki o podanym ID lub nie masz do niej dostępu.",
          ephemeral: true
        });
      }

      const displayResult = await bookmarksView.createBookmarkDetailDisplay(bookmark);
      
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
    else if (interaction.isButton()) {
      if (interaction.customId === 'prev_page' || interaction.customId === 'next_page') {
        const currentView = interaction.message.components[0];
        const pageInfo = currentView.components.find(c => c.type === 'BUTTON' && !c.disabled);
        
        if (!pageInfo) return;
        
        const currentPage = parseInt(pageInfo.label?.match(/Strona (\d+)/)?.[1]) || 1;
        const newPage = interaction.customId === 'prev_page' ? currentPage - 1 : currentPage + 1;
        
        const { embed, view } = await bookmarksView.createBookmarksPage(interaction.user.id, newPage);
        await interaction.update({ 
          embeds: [embed], 
          components: view.rows
        });
      }
      else if (interaction.customId === 'delete_bookmark') {
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
        const { success, message } = await dbManager.deleteBookmark(parseInt(bookmarkId), interaction.user.id);
        
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
      else if (interaction.customId.startsWith('view_bookmark_')) {
        const bookmarkId = parseInt(interaction.customId.split('_')[2]);
        const bookmark = await dbManager.getBookmarkById(bookmarkId, interaction.user.id);

        if (!bookmark) {
          return interaction.reply({
            content: "Nie znaleziono zakładki o podanym ID lub nie masz do niej dostępu.",
            ephemeral: true
          });
        }

        const displayResult = await bookmarksView.createBookmarkDetailDisplay(bookmark);
        
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
    }
  }

  static extractBookmarkIdFromComponentsV2(components) {
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

BookmarksCommandHandler.registerCommands = async (client) => {
  const bookmarksCommand = new SlashCommandBuilder()
    .setName('bookmarks')
    .setDescription('Wyświetl swoje zapisane wiadomości')
    .addIntegerOption(option => 
      option.setName('page')
        .setDescription('Numer strony (domyślnie 1)')
        .setRequired(false));

  const bookmarkCommand = new SlashCommandBuilder()
    .setName('bookmark')
    .setDescription('Wyświetl szczegóły zapisanej wiadomości')
    .addIntegerOption(option => 
      option.setName('id')
        .setDescription('ID zakładki')
        .setRequired(true));

  const deleteCommand = new SlashCommandBuilder()
    .setName('delete_bookmark')
    .setDescription('Usuń zakładkę')
    .addIntegerOption(option => 
      option.setName('id')
        .setDescription('ID zakładki do usunięcia')
        .setRequired(true));

  await client.application.commands.set([
    bookmarksCommand,
    bookmarkCommand,
    deleteCommand
  ]);
};

module.exports = BookmarksCommandHandler;