const { 
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const ViewBookmarkButton = require('../components/ViewBookmarkButton');
const ComponentsV2Analyzer = require('../utils/componentsV2Analyzer');

class SaveMessageHandler {
  constructor(dbManager, bookmarksView) {
    this.dbManager = dbManager;
    this.bookmarksView = bookmarksView;
    this.analyzer = new ComponentsV2Analyzer();
  }

  async handleSaveMessage(interaction) {
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
      
      const isComponentsV2 = this.analyzer.detectComponentsV2(message, messageFlags);
      
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
          componentsData = this.analyzer.processComponentsV2(message.components);
        } else {
          console.log('Traditional components detected');
          componentsData = message.components;
        }
      }
      
      const messageWithChannel = {
        ...message,
        channel: message.channel || { id: channelId }
      };
      
      const bookmarkId = await this.dbManager.saveBookmark(
        interaction.user.id, 
        messageWithChannel, 
        embedData,
        componentsData,
        messageFlags,
        guildId
      );

      const embed = this.createSuccessEmbed(message, bookmarkId, isComponentsV2);
      const view = new ViewBookmarkButton(bookmarkId, this.dbManager, this.bookmarksView);
      
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

  createSuccessEmbed(message, bookmarkId, isComponentsV2) {
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
        const componentInfo = this.analyzer.analyzeComponentsV2Structure(message.components);
        if (componentInfo.length > 0) {
          embed.addFields({
            name: "📋 Struktura komponentów",
            value: componentInfo.join('\n'),
            inline: false
          });
        }
      }
    } else if (message.flags && typeof message.flags === 'object' && 'has' in message.flags) {
      if (message.flags.has(MessageFlags.IsComponentsV2)) {
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

    return embed;
  }
}

module.exports = SaveMessageHandler;