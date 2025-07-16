const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  ButtonStyle,
  MessageFlags,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ThumbnailBuilder,
  FileBuilder,
  SeparatorSpacingSize
} = require('discord.js');

const { MessageType, ComponentTypeNames } = require('./messageTypes');
const ComponentsV2Reconstructor = require('./componentsV2Reconstructor');
const MessageUtils = require('./messageUtils');

class SmartMessageRenderer {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.reconstructor = new ComponentsV2Reconstructor();
    this.utils = new MessageUtils();
  }

  getComponentTypeName(type) {
    return ComponentTypeNames[type] || `Nieznany (${type})`;
  }

  detectMessageType(bookmark) {
    const messageFlags = bookmark.message_flags || 0;
    const isComponentsV2 = (messageFlags & 32768) === 32768;
    const hasEmbeds = bookmark.embed_data && bookmark.embed_data !== 'null';
    const hasContent = bookmark.message_content && bookmark.message_content.trim();
    const hasAttachments = bookmark.attachments_data && bookmark.attachments_data !== 'null';
    const hasComponentsV2Data = bookmark.components_v2_data && bookmark.components_v2_data !== 'null';

    console.log('Message type detection for bookmark', bookmark.id, ':', {
      messageFlags: messageFlags,
      isComponentsV2,
      hasEmbeds,
      hasContent,
      hasAttachments,
      hasComponentsV2Data,
      components_v2_data_length: bookmark.components_v2_data ? bookmark.components_v2_data.length : 0
    });

    if (isComponentsV2 && hasComponentsV2Data) {
      console.log('Detected as COMPONENTS_V2');
      return MessageType.COMPONENTS_V2;
    }

    if (hasEmbeds) {
      console.log('Detected as EMBED');
      return MessageType.EMBED;
    }

    if (hasContent && hasAttachments) {
      console.log('Detected as MIXED');
      return MessageType.MIXED;
    }
    
    if (hasAttachments && !hasContent) {
      console.log('Detected as ATTACHMENTS_ONLY');
      return MessageType.ATTACHMENTS_ONLY;
    }

    console.log('Detected as PLAIN_TEXT');
    return MessageType.PLAIN_TEXT;
  }

  async renderBookmarkMessage(bookmark) {
    const messageType = this.detectMessageType(bookmark);
    
    console.log(`Rendering bookmark ${bookmark.id} as type: ${messageType}`);

    switch (messageType) {
      case MessageType.COMPONENTS_V2:
        return await this.renderComponentsV2Message(bookmark);
      
      case MessageType.EMBED:
        return await this.renderEmbedMessage(bookmark);
      
      case MessageType.MIXED:
        return await this.renderMixedMessage(bookmark);
      
      case MessageType.ATTACHMENTS_ONLY:
        return await this.renderAttachmentsOnlyMessage(bookmark);
      
      case MessageType.PLAIN_TEXT:
      default:
        return await this.renderPlainTextMessage(bookmark);
    }
  }

  async renderComponentsV2Message(bookmark) {
    try {
      const componentsData = JSON.parse(bookmark.components_v2_data);
      
      this.debugComponentsStructure(componentsData, bookmark.id);
      
      const reconstructed = this.reconstructor.reconstructComponentsV2(componentsData);
      
      console.log(`Reconstruction result: ${reconstructed.components.length} components`);
      
      if (reconstructed.components.length === 0) {
        console.log('Components v2 reconstruction failed, falling back to embed');
        return await this.renderFallbackEmbed(bookmark);
      }

      const headerComponents = [
        new TextDisplayBuilder()
          .setContent(`# 📌 Zakładka #${bookmark.id}\n**Autor:** ${bookmark.author_name}\n**Data:** ${new Date(bookmark.timestamp).toLocaleString('pl-PL')}`),
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true)
      ];

      const allComponents = [...headerComponents, ...reconstructed.components];
      
      console.log(`Components after adding header:`, allComponents.length);

      const linkUrl = this.utils.createMessageLink(bookmark);
      allComponents.push(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('🔗 **Link do oryginalnej wiadomości**')
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setURL(linkUrl)
              .setEmoji('🔗')
          )
      );

      allComponents.push(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(false),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('⚠️ **Zarządzanie zakładką**')
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId('delete_bookmark')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🗑️')
          )
      );

      console.log(`Final components count: ${allComponents.length}`);
      
      const validComponents = [];
      allComponents.forEach((comp, index) => {
        try {
          const json = comp.toJSON();
          console.log(`Component ${index + 1} JSON valid, type: ${json.type}`);
          validComponents.push(comp);
        } catch (error) {
          console.error(`Component ${index + 1} JSON error, removing:`, error.message);
        }
      });
      
      if (validComponents.length === 0) {
        console.log('No valid components after final validation, falling back to embed');
        return await this.renderFallbackEmbed(bookmark);
      }

      console.log(`Final valid components: ${validComponents.length}/${allComponents.length}`);

      return {
        type: 'components_v2',
        components: validComponents,
        flags: MessageFlags.IsComponentsV2,
        additionalEmbeds: [],
        view: []
      };

    } catch (error) {
      console.error('Error rendering Components v2:', error);
      console.error('Error stack:', error.stack);
      return await this.renderFallbackEmbed(bookmark);
    }
  }

  async renderEmbedMessage(bookmark) {
    const embed = new EmbedBuilder()
      .setTitle(`📝 Zakładka #${bookmark.id}`)
      .setColor(0x3498db)
      .setTimestamp(new Date(bookmark.timestamp));

    if (bookmark.author_avatar) {
      embed.setAuthor({ name: bookmark.author_name, iconURL: bookmark.author_avatar });
    } else {
      embed.setAuthor({ name: bookmark.author_name });
    }

    if (bookmark.message_content) {
      embed.addFields({
        name: "💬 Treść wiadomości",
        value: bookmark.message_content.substring(0, 1024),
        inline: false
      });
    }

    const isDM = bookmark.guild_id === '0';
    const channelValue = isDM ? "Prywatna wiadomość" : `<#${bookmark.channel_id}>`;
    const linkUrl = this.utils.createMessageLink(bookmark);

    embed.addFields(
      { name: "📍 Kanał", value: channelValue, inline: true },
      { name: "🔗 Link", value: `[Kliknij tutaj](${linkUrl})`, inline: true }
    );

    const additionalEmbeds = [];
    const { imageUrls, videoUrls } = this.utils.processAttachments(bookmark);

    if (imageUrls.length > 0) {
      embed.setImage(imageUrls[0]);
      
      imageUrls.slice(1).forEach(url => {
        additionalEmbeds.push(new EmbedBuilder().setImage(url));
      });
    }

    if (videoUrls.length > 0) {
      const videoLinks = videoUrls.map((url, i) => `[Wideo ${i+1}](${url})`).join('\n');
      embed.addFields({ 
        name: "🎬 Pliki wideo", 
        value: videoLinks, 
        inline: false 
      });
    }

    if (bookmark.embed_data) {
      try {
        const originalEmbeds = JSON.parse(bookmark.embed_data);
        for (const embedDict of originalEmbeds) {
          try {
            const parsedEmbed = EmbedBuilder.from(embedDict);
            additionalEmbeds.push(parsedEmbed);
          } catch (e) {
            console.error("Błąd parsowania embeda:", e);
          }
        }
      } catch (e) {
        console.error("Błąd przetwarzania embedów:", e);
      }
    }

    return {
      type: 'embed',
      embeds: [embed, ...additionalEmbeds],
      view: this.utils.createActionButtons(bookmark.id, linkUrl)
    };
  }

  async renderMixedMessage(bookmark) {
    const embed = new EmbedBuilder()
      .setTitle(`📝 Zakładka #${bookmark.id}`)
      .setDescription(bookmark.message_content || "*Brak treści*")
      .setColor(0x3498db)
      .setTimestamp(new Date(bookmark.timestamp));

    if (bookmark.author_avatar) {
      embed.setAuthor({ name: bookmark.author_name, iconURL: bookmark.author_avatar });
    } else {
      embed.setAuthor({ name: bookmark.author_name });
    }

    const additionalEmbeds = [];
    const { imageUrls, videoUrls, otherFiles } = this.utils.processAttachments(bookmark);

    const attachmentInfo = [];
    if (imageUrls.length > 0) attachmentInfo.push(`🖼️ ${imageUrls.length} obrazów`);
    if (videoUrls.length > 0) attachmentInfo.push(`🎬 ${videoUrls.length} wideo`);
    if (otherFiles.length > 0) attachmentInfo.push(`📎 ${otherFiles.length} plików`);

    if (attachmentInfo.length > 0) {
      embed.addFields({
        name: "📎 Załączniki",
        value: attachmentInfo.join(', '),
        inline: false
      });
    }

    if (imageUrls.length > 0) {
      embed.setImage(imageUrls[0]);
      
      imageUrls.slice(1).forEach(url => {
        additionalEmbeds.push(new EmbedBuilder().setImage(url));
      });
    }

    if (videoUrls.length > 0) {
      const videoLinks = videoUrls.map((url, i) => `[Wideo ${i+1}](${url})`).join('\n');
      embed.addFields({ 
        name: "🎬 Pliki wideo", 
        value: videoLinks, 
        inline: false 
      });
    }

    if (otherFiles.length > 0) {
      const fileLinks = otherFiles.map((file, i) => `[${file.filename || `Plik ${i+1}`}](${file.url})`).join('\n');
      embed.addFields({ 
        name: "📄 Inne pliki", 
        value: fileLinks, 
        inline: false 
      });
    }

    const linkUrl = this.utils.createMessageLink(bookmark);
    embed.addFields({ name: "🔗 Link do oryginału", value: `[Przejdź](${linkUrl})`, inline: true });

    return {
      type: 'mixed',
      embeds: [embed, ...additionalEmbeds],
      view: this.utils.createActionButtons(bookmark.id, linkUrl)
    };
  }

  async renderAttachmentsOnlyMessage(bookmark) {
    const embed = new EmbedBuilder()
      .setTitle(`📎 Zakładka #${bookmark.id} - Załączniki`)
      .setColor(0x9b59b6)
      .setTimestamp(new Date(bookmark.timestamp));

    if (bookmark.author_avatar) {
      embed.setAuthor({ name: bookmark.author_name, iconURL: bookmark.author_avatar });
    } else {
      embed.setAuthor({ name: bookmark.author_name });
    }

    const additionalEmbeds = [];
    const { imageUrls, videoUrls, otherFiles } = this.utils.processAttachments(bookmark);

    embed.setDescription(`**${bookmark.author_name}** udostępnił załączniki`);

    const stats = [];
    if (imageUrls.length > 0) stats.push(`🖼️ ${imageUrls.length} obrazów`);
    if (videoUrls.length > 0) stats.push(`🎬 ${videoUrls.length} wideo`);
    if (otherFiles.length > 0) stats.push(`📄 ${otherFiles.length} innych plików`);

    embed.addFields({
      name: "📊 Załączniki",
      value: stats.join('\n'),
      inline: false
    });

    if (imageUrls.length > 0) {
      embed.setImage(imageUrls[0]);
      
      if (imageUrls.length > 1) {
        embed.addFields({
          name: `🖼️ Obrazy (${imageUrls.length})`,
          value: `Wyświetlany obraz 1/${imageUrls.length}. Pozostałe poniżej.`,
          inline: false
        });
        
        imageUrls.slice(1).forEach((url, index) => {
          const imageEmbed = new EmbedBuilder()
            .setImage(url)
            .setFooter({ text: `Obraz ${index + 2}/${imageUrls.length}` });
          additionalEmbeds.push(imageEmbed);
        });
      }
    }

    const linkUrl = this.utils.createMessageLink(bookmark);
    embed.addFields({ name: "🔗 Link do oryginału", value: `[Przejdź](${linkUrl})`, inline: true });

    return {
      type: 'attachments_only',
      embeds: [embed, ...additionalEmbeds],
      view: this.utils.createActionButtons(bookmark.id, linkUrl)
    };
  }

  async renderPlainTextMessage(bookmark) {
    const embed = new EmbedBuilder()
      .setTitle(`💬 Zakładka #${bookmark.id}`)
      .setDescription(bookmark.message_content || "*Brak treści*")
      .setColor(0x34495e)
      .setTimestamp(new Date(bookmark.timestamp));

    if (bookmark.author_avatar) {
      embed.setAuthor({ name: bookmark.author_name, iconURL: bookmark.author_avatar });
    } else {
      embed.setAuthor({ name: bookmark.author_name });
    }

    const isDM = bookmark.guild_id === '0';
    const channelValue = isDM ? "Prywatna wiadomość" : `<#${bookmark.channel_id}>`;
    const linkUrl = this.utils.createMessageLink(bookmark);

    embed.addFields(
      { name: "📍 Kanał", value: channelValue, inline: true },
      { name: "🔗 Link", value: `[Przejdź](${linkUrl})`, inline: true }
    );

    if (bookmark.components_data) {
      try {
        const components = JSON.parse(bookmark.components_data);
        const [componentsContent, componentsImages] = this.utils.extractComponentsV1Content(components);
        
        if (componentsContent) {
          embed.addFields({
            name: "🧩 Komponenty",
            value: componentsContent.substring(0, 1024),
            inline: false
          });
        }
      } catch (e) {
        console.error("Błąd przetwarzania starych komponentów:", e);
      }
    }

    return {
      type: 'plain_text',
      embeds: [embed],
      view: this.utils.createActionButtons(bookmark.id, linkUrl)
    };
  }

  async renderFallbackEmbed(bookmark) {
    const embed = new EmbedBuilder()
      .setTitle(`❓ Zakładka #${bookmark.id} (tryb zgodności)`)
      .setDescription(bookmark.components_v2_content || bookmark.message_content || "*Nie można wyświetlić zawartości*")
      .setColor(0xe74c3c)
      .setTimestamp(new Date(bookmark.timestamp));

    if (bookmark.author_avatar) {
      embed.setAuthor({ name: bookmark.author_name, iconURL: bookmark.author_avatar });
    } else {
      embed.setAuthor({ name: bookmark.author_name });
    }

    const linkUrl = this.utils.createMessageLink(bookmark);
    embed.addFields({ name: "🔗 Link do oryginału", value: `[Przejdź](${linkUrl})`, inline: true });

    return {
      type: 'fallback',
      embeds: [embed],
      view: this.utils.createActionButtons(bookmark.id, linkUrl)
    };
  }

  debugComponentsStructure(componentsData, bookmarkId) {
    console.log(`=== DEBUGGING Components v2 for bookmark ${bookmarkId} ===`);
    console.log('Raw components data length:', componentsData.length);
    
    componentsData.forEach((component, index) => {
      console.log(`Top-level component ${index + 1}:`, {
        type: component.type,
        typeName: this.getComponentTypeName(component.type || 'undefined'),
        hasComponents: !!component.components,
        componentsCount: component.components?.length || 0,
        hasItems: !!component.items,
        itemsCount: component.items?.length || 0,
        hasMedia: !!component.media,
        hasContent: !!component.content,
        spacing: component.spacing,
        divider: component.divider
      });
      
      if (component.components) {
        component.components.forEach((child, childIndex) => {
          console.log(`  Child ${childIndex + 1}:`, {
            type: child.type,
            typeName: this.getComponentTypeName(child.type || 'undefined'),
            hasContent: !!child.content,
            hasMedia: !!(child.media || child.items),
            hasUrl: !!(child.media && child.media.url) || !!(child.items && child.items[0] && child.items[0].media && child.items[0].media.url),
            spacing: child.spacing,
            divider: child.divider
          });
        });
      }
      
      if (component.items) {
        component.items.forEach((item, itemIndex) => {
          console.log(`  Item ${itemIndex + 1}:`, {
            hasMedia: !!item.media,
            hasUrl: !!(item.media && item.media.url),
            url: item.media?.url,
            description: item.description
          });
        });
      }
    });
    console.log(`=== END DEBUGGING for bookmark ${bookmarkId} ===`);
  }
}

module.exports = SmartMessageRenderer;