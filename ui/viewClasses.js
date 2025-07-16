const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const { ComponentTypeNames } = require('./messageTypes');

class BookmarksPageView {
  constructor(dbManager, bookmarkOptions, page, maxPages) {
    this.dbManager = dbManager;
    this.page = page;
    this.maxPages = maxPages;
    this.timeout = 180000;
    
    this.rows = [];
    
    if (bookmarkOptions && bookmarkOptions.length > 0) {
      this.rows.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('bookmark_select')
            .setPlaceholder('Wybierz zakładkę do wyświetlenia')
            .addOptions(bookmarkOptions)
        )
      );
    }
    
    this.rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev_page')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId('next_page')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('▶️')
          .setDisabled(page >= maxPages)
      )
    );
  }
}

class BookmarkDetailView {
  constructor(dbManager, bookmarkId, linkData) {
    this.dbManager = dbManager;
    this.bookmarkId = bookmarkId;
    this.guildId = linkData[0];
    this.channelId = linkData[1];
    this.messageId = linkData[2];
    this.timeout = 180000;
    
    this.rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('delete_bookmark')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setEmoji('🔗')
          .setURL(this.guildId === '0' ?
            `https://discord.com/channels/@me/${this.channelId}/${this.messageId}` :
            `https://discord.com/channels/${this.guildId}/${this.channelId}/${this.messageId}`)
      )
    ];
  }
}

class ComponentsV2DisplayView {
  constructor(componentsData) {
    this.componentsData = componentsData;
  }

  createComponentsPreview() {
    const embed = new EmbedBuilder()
      .setTitle("🎛️ Components v2 - Podgląd struktury")
      .setColor(0x5865F2);

    const componentTypes = new Map();
    let totalComponents = 0;

    const analyzeComponent = (component, depth = 0) => {
      if (!component || !component.type) return;
      
      totalComponents++;
      const typeName = this.getComponentTypeName(component.type);
      componentTypes.set(typeName, (componentTypes.get(typeName) || 0) + 1);

      if (component.components) {
        component.components.forEach(child => analyzeComponent(child, depth + 1));
      }
      if (component.items) {
        component.items.forEach(item => analyzeComponent(item, depth + 1));
      }
    };

    if (Array.isArray(this.componentsData)) {
      this.componentsData.forEach(component => analyzeComponent(component));
    }

    if (componentTypes.size > 0) {
      const typesList = Array.from(componentTypes.entries())
        .map(([type, count]) => `• ${type}: ${count}`)
        .join('\n');
      
      embed.addFields({
        name: "Typy komponentów",
        value: typesList,
        inline: false
      });
    }

    embed.addFields({
      name: "Statystyki",
      value: `Łącznie komponentów: ${totalComponents}`,
      inline: true
    });

    return embed;
  }

  getComponentTypeName(type) {
    return ComponentTypeNames[type] || `Nieznany (${type})`;
  }
}

class SmartBookmarkDisplay {
  constructor(renderResult, bookmarkId) {
    this.renderResult = renderResult;
    this.bookmarkId = bookmarkId;
    this.timeout = 180000;
  }

  getDisplayData() {
    switch (this.renderResult.type) {
      case 'components_v2':
        return {
          components: this.renderResult.components,
          flags: this.renderResult.flags,
          view: this.renderResult.view
        };
      
      case 'embed':
      case 'mixed':
      case 'attachments_only':
      case 'plain_text':
      case 'fallback':
      default:
        return {
          embeds: this.renderResult.embeds,
          components: this.renderResult.view
        };
    }
  }

  isComponentsV2() {
    return this.renderResult.type === 'components_v2';
  }

  getMessageType() {
    return this.renderResult.type;
  }
}

module.exports = {
  BookmarksPageView,
  BookmarkDetailView,
  ComponentsV2DisplayView,
  SmartBookmarkDisplay
};