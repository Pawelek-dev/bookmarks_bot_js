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
const DatabaseManager = require('../database/manager');

const MessageType = {
  COMPONENTS_V2: 'components_v2',
  EMBED: 'embed',
  PLAIN_TEXT: 'plain_text',
  MIXED: 'mixed',
  ATTACHMENTS_ONLY: 'attachments_only'
};

class SmartMessageRenderer {
  constructor(dbManager) {
    this.dbManager = dbManager;
  }

  getComponentTypeName(type) {
    const typeMap = {
      1: "ActionRow",
      2: "Button", 
      3: "StringSelect",
      4: "TextInput",
      5: "UserSelect",
      6: "RoleSelect", 
      7: "MentionableSelect",
      8: "ChannelSelect",
      9: "Unknown",
      10: "TextDisplay",
      11: "File",
      12: "Media",
      13: "Thumbnail",
      14: "MediaGallery",
      15: "Section",
      16: "Separator",
      17: "Container"
    };
    
    return typeMap[type] || `Nieznany (${type})`;
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
      
      const reconstructed = this.reconstructComponentsV2(componentsData);
      
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

      const linkUrl = this.createMessageLink(bookmark);
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
    const linkUrl = this.createMessageLink(bookmark);

    embed.addFields(
      { name: "📍 Kanał", value: channelValue, inline: true },
      { name: "🔗 Link", value: `[Kliknij tutaj](${linkUrl})`, inline: true }
    );

    const additionalEmbeds = [];
    const { imageUrls, videoUrls } = this.processAttachments(bookmark);

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
      view: this.createActionButtons(bookmark.id, linkUrl)
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
    const { imageUrls, videoUrls, otherFiles } = this.processAttachments(bookmark);

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

    const linkUrl = this.createMessageLink(bookmark);
    embed.addFields({ name: "🔗 Link do oryginału", value: `[Przejdź](${linkUrl})`, inline: true });

    return {
      type: 'mixed',
      embeds: [embed, ...additionalEmbeds],
      view: this.createActionButtons(bookmark.id, linkUrl)
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
    const { imageUrls, videoUrls, otherFiles } = this.processAttachments(bookmark);

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

    const linkUrl = this.createMessageLink(bookmark);
    embed.addFields({ name: "🔗 Link do oryginału", value: `[Przejdź](${linkUrl})`, inline: true });

    return {
      type: 'attachments_only',
      embeds: [embed, ...additionalEmbeds],
      view: this.createActionButtons(bookmark.id, linkUrl)
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
    const linkUrl = this.createMessageLink(bookmark);

    embed.addFields(
      { name: "📍 Kanał", value: channelValue, inline: true },
      { name: "🔗 Link", value: `[Przejdź](${linkUrl})`, inline: true }
    );

    if (bookmark.components_data) {
      try {
        const components = JSON.parse(bookmark.components_data);
        const [componentsContent, componentsImages] = this.extractComponentsV1Content(components);
        
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
      view: this.createActionButtons(bookmark.id, linkUrl)
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

    const linkUrl = this.createMessageLink(bookmark);
    embed.addFields({ name: "🔗 Link do oryginału", value: `[Przejdź](${linkUrl})`, inline: true });

    return {
      type: 'fallback',
      embeds: [embed],
      view: this.createActionButtons(bookmark.id, linkUrl)
    };
  }

  reconstructComponentsV2(componentsData) {
    const components = [];
    let processedCount = 0;
    let errorCount = 0;
    
    console.log(`Starting reconstruction of ${componentsData.length} top-level components`);
    
    const processComponent = (component, depth = 0) => {
      if (!component) {
        console.log(`Skipping null component at depth ${depth}`);
        return null;
      }
      
      if (component.type === undefined || component.type === null) {
        console.warn(`Component with undefined/null type at depth ${depth}:`, JSON.stringify(component, null, 2));
        return null;
      }

      processedCount++;
      const indent = '  '.repeat(depth);
      console.log(`${indent}Processing component ${processedCount}: type ${component.type} (${this.getComponentTypeName(component.type)})`);

      try {
        switch (component.type) {
          case 17:
            console.log(`${indent}Building Container`);
            const container = new ContainerBuilder();
            
            if (component.accent_color) {
              container.setAccentColor(component.accent_color);
            }
            
            if (component.spoiler) {
              container.setSpoiler(true);
            }

            let hasValidChildren = false;
            const validChildren = [];
            
            if (component.components && component.components.length > 0) {
              console.log(`${indent}Container has ${component.components.length} child components`);
              
              component.components.forEach((child, index) => {
                const childComponent = processComponent(child, depth + 1);
                if (childComponent) {
                  try {
                    const childJson = childComponent.toJSON();
                    if (childJson) {
                      validChildren.push({ component: childComponent, type: child.type, index });
                      console.log(`${indent}Child ${index + 1} pre-validated successfully`);
                    } else {
                      console.log(`${indent}Child ${index + 1} failed JSON test`);
                    }
                  } catch (error) {
                    console.error(`${indent}Child ${index + 1} serialization failed: ${error.message}`);
                  }
                } else {
                  console.log(`${indent}Failed to process child ${index + 1}/${component.components.length}`);
                }
              });
              
              validChildren.forEach(({ component: childComponent, type: childType, index }) => {
                try {
                  this.addComponentToContainer(container, childComponent, childType);
                  hasValidChildren = true;
                  console.log(`${indent}Successfully added validated child ${index + 1}`);
                } catch (error) {
                  console.error(`${indent}Failed to add validated child ${index + 1}: ${error.message}`);
                }
              });
              
              console.log(`${indent}Container built with ${validChildren.length} valid children out of ${component.components.length} total`);
            }

            if (!hasValidChildren) {
              console.log(`${indent}Container is empty after validation, skipping`);
              return null;
            }

            try {
              const containerJson = container.toJSON();
              if (!containerJson.components || containerJson.components.length === 0) {
                console.log(`${indent}Container final validation failed - no components`);
                return null;
              }
              console.log(`${indent}Container final validation passed with ${containerJson.components.length} components`);
            } catch (validationError) {
              console.error(`${indent}Container final validation failed: ${validationError.message}`);
              return null;
            }

            return container;

          case 10:
            const content = component.content || '';
            if (!content.trim()) {
              console.log(`${indent}Empty TextDisplay, skipping`);
              return null;
            }
            console.log(`${indent}Building TextDisplay with content: "${content.substring(0, 50)}..."`);
            return new TextDisplayBuilder().setContent(content);

          case 12:
            console.log(`${indent}Building Media component`);
            
            if (!component.items || !Array.isArray(component.items) || component.items.length === 0) {
              console.log(`${indent}Media component has no items, skipping`);
              return null;
            }
            
            console.log(`${indent}Media component has ${component.items.length} items`);
            
            const firstItem = component.items[0];
            if (!firstItem.media || !firstItem.media.url) {
              console.log(`${indent}First media item missing URL, skipping`);
              return null;
            }
            
            console.log(`${indent}Building MediaGallery from Media component with URL: ${firstItem.media.url}`);
            
            try {
              const gallery = new MediaGalleryBuilder();
              let addedItems = 0;
              
              component.items.forEach((item, index) => {
                if (item.media && item.media.url) {
                  try {
                    const galleryItem = new MediaGalleryItemBuilder().setURL(item.media.url);
                      
                    if (item.description) {
                      galleryItem.setDescription(item.description);
                    }
                    
                    if (item.spoiler) {
                      galleryItem.setSpoiler(true);
                    }
                    
                    gallery.addItems(galleryItem);
                    addedItems++;
                    console.log(`${indent}Added media item ${index + 1}/${component.items.length} with URL: ${item.media.url}`);
                  } catch (error) {
                    console.error(`${indent}Failed to add media item ${index + 1}: ${error.message}`);
                  }
                } else {
                  console.log(`${indent}Media item ${index + 1} missing URL, skipping`);
                }
              });
              
              if (addedItems === 0) {
                console.log(`${indent}No valid items added to Media component, skipping`);
                return null;
              }
              
              try {
                const testJson = gallery.toJSON();
                if (!testJson.items || testJson.items.length === 0) {
                  console.log(`${indent}Media component validation failed - empty items after toJSON()`);
                  return null;
                }
                console.log(`${indent}Media component validation passed with ${testJson.items.length} items`);
              } catch (validationError) {
                console.error(`${indent}Media component validation failed: ${validationError.message}`);
                return null;
              }
              
              return gallery;
            } catch (error) {
              console.error(`${indent}Failed to create MediaGallery from Media component: ${error.message}`);
              return null;
            }

          case 14:
            console.log(`${indent}Building MediaGallery`);
            
            if (!component.items || component.items.length === 0) {
              console.log(`${indent}MediaGallery has no items, skipping`);
              return null;
            }
            
            const gallery = new MediaGalleryBuilder();
            let addedItems = 0;
            
            component.items.forEach((item, index) => {
              if (item.media && item.media.url) {
                try {
                  const galleryItem = new MediaGalleryItemBuilder().setURL(item.media.url);
                    
                  if (item.description) {
                    galleryItem.setDescription(item.description);
                  }
                  
                  if (item.spoiler) {
                    galleryItem.setSpoiler(true);
                  }
                  
                  gallery.addItems(galleryItem);
                  addedItems++;
                  console.log(`${indent}Added gallery item ${index + 1}/${component.items.length}`);
                } catch (error) {
                  console.error(`${indent}Failed to add gallery item ${index + 1}: ${error.message}`);
                }
              } else {
                console.log(`${indent}Gallery item ${index + 1} missing URL, skipping`);
              }
            });
            
            if (addedItems === 0) {
              console.log(`${indent}No valid items added to MediaGallery, skipping`);
              return null;
            }
            
            try {
              const testJson = gallery.toJSON();
              if (!testJson.items || testJson.items.length === 0) {
                console.log(`${indent}MediaGallery validation failed - empty items after toJSON()`);
                return null;
              }
              console.log(`${indent}MediaGallery validation passed with ${testJson.items.length} items`);
            } catch (validationError) {
              console.error(`${indent}MediaGallery validation failed: ${validationError.message}`);
              return null;
            }
            
            return gallery;

          case 15:
            console.log(`${indent}Building Section`);
            const section = new SectionBuilder();
            let hasContent = false;
            
            if (component.components) {
              const textDisplays = component.components
                .filter(c => c.type === 10 && c.content && c.content.trim())
                .slice(0, 3)
                .map(c => new TextDisplayBuilder().setContent(c.content));
                
              if (textDisplays.length > 0) {
                section.addTextDisplayComponents(...textDisplays);
                hasContent = true;
                console.log(`${indent}Added ${textDisplays.length} text displays to section`);
              }
            }
            
            if (component.button_accessory) {
              console.log(`${indent}Adding button accessory: ${component.button_accessory.label}`);
              const button = new ButtonBuilder()
                .setLabel(component.button_accessory.label || 'Przycisk')
                .setStyle(component.button_accessory.style || ButtonStyle.Secondary)
                .setCustomId(component.button_accessory.custom_id || 'disabled_button')
                .setDisabled(true);
              
              section.setButtonAccessory(button);
              hasContent = true;
            }
            
            if (component.thumbnail_accessory && component.thumbnail_accessory.url) {
              console.log(`${indent}Adding thumbnail accessory`);
              try {
                const thumbnail = new ThumbnailBuilder()
                  .setURL(component.thumbnail_accessory.url);
                  
                if (component.thumbnail_accessory.description) {
                  thumbnail.setDescription(component.thumbnail_accessory.description);
                }
                
                section.setThumbnailAccessory(thumbnail);
                hasContent = true;
              } catch (error) {
                console.error(`${indent}Failed to add thumbnail: ${error.message}`);
              }
            }
            
            if (!hasContent) {
              console.log(`${indent}Section has no content or accessories, skipping`);
              return null;
            }
            
            return section;

          case 16:
            console.log(`${indent}Building Separator`);
            const separator = new SeparatorBuilder();
            
            if (component.spacing !== undefined) {
              const validSpacing = component.spacing === 'large' || component.spacing === SeparatorSpacingSize.Large 
                ? SeparatorSpacingSize.Large 
                : SeparatorSpacingSize.Small;
              separator.setSpacing(validSpacing);
              console.log(`${indent}Set spacing to: ${validSpacing === SeparatorSpacingSize.Large ? 'Large' : 'Small'}`);
            } else {
              separator.setSpacing(SeparatorSpacingSize.Small);
              console.log(`${indent}Set default spacing: Small`);
            }
            
            if (component.divider !== undefined) {
              separator.setDivider(component.divider);
              console.log(`${indent}Set divider: ${component.divider}`);
            } else {
              separator.setDivider(true);
              console.log(`${indent}Set default divider: true`);
            }
            
            try {
              const testJson = separator.toJSON();
              console.log(`${indent}Separator validation passed:`, testJson);
            } catch (validationError) {
              console.error(`${indent}Separator validation failed: ${validationError.message}`);
              return null;
            }
            
            return separator;

          case 9:
            console.log(`${indent}Found type 9 - attempting to process as Section`);
            if (component.components || component.button_accessory || component.thumbnail_accessory) {
              console.log(`${indent}Type 9 appears to be a Section, processing...`);
              const section = new SectionBuilder();
              let hasContent = false;
              
              if (component.components) {
                const textDisplays = component.components
                  .filter(c => c.type === 10 && c.content && c.content.trim())
                  .slice(0, 3)
                  .map(c => new TextDisplayBuilder().setContent(c.content));
                  
                if (textDisplays.length > 0) {
                  section.addTextDisplayComponents(...textDisplays);
                  hasContent = true;
                  console.log(`${indent}Added ${textDisplays.length} text displays to type 9 section`);
                }
              }
              
              if (component.button_accessory) {
                const button = new ButtonBuilder()
                  .setLabel(component.button_accessory.label || 'Przycisk')
                  .setStyle(component.button_accessory.style || ButtonStyle.Secondary)
                  .setCustomId(component.button_accessory.custom_id || 'disabled_button')
                  .setDisabled(true);
                
                section.setButtonAccessory(button);
                hasContent = true;
              }
              
              if (component.thumbnail_accessory && component.thumbnail_accessory.url) {
                try {
                  const thumbnail = new ThumbnailBuilder()
                    .setURL(component.thumbnail_accessory.url);
                    
                  if (component.thumbnail_accessory.description) {
                    thumbnail.setDescription(component.thumbnail_accessory.description);
                  }
                  
                  section.setThumbnailAccessory(thumbnail);
                  hasContent = true;
                } catch (error) {
                  console.error(`${indent}Failed to add thumbnail to type 9: ${error.message}`);
                }
              }
              
              if (hasContent) {
                return section;
              } else {
                console.log(`${indent}Type 9 section has no content, skipping`);
                return null;
              }
            } else {
              console.log(`${indent}Type 9 doesn't appear to be a valid section, skipping`);
              return null;
            }

          case 11:
            console.log(`${indent}Found File component (type 11), but not implemented - skipping`);
            return null;
            
          case 13:
            console.log(`${indent}Found standalone Thumbnail component (type 13), but not implemented - skipping`);
            return null;

          default:
            console.log(`${indent}Unsupported component type: ${component.type}`);
            return null;
        }
      } catch (error) {
        errorCount++;
        console.error(`${indent}Error processing component type ${component.type}:`, error);
        console.error(`${indent}Component data:`, JSON.stringify(component, null, 2));
        return null;
      }
    };

    if (Array.isArray(componentsData)) {
      componentsData.forEach((component, index) => {
        console.log(`Processing top-level component ${index + 1}/${componentsData.length}`);
        const reconstructed = processComponent(component, 0);
        if (reconstructed) {
          try {
            const testJson = reconstructed.toJSON();
            console.log(`Component ${index + 1} validation successful, type: ${testJson.type}`);
            components.push(reconstructed);
            console.log(`Successfully added component ${index + 1}/${componentsData.length} to final array`);
          } catch (validationError) {
            console.error(`Component ${index + 1} validation failed:`, validationError.message);
          }
        } else {
          console.log(`Failed to reconstruct component ${index + 1}/${componentsData.length}`);
        }
      });
    }

    console.log(`Reconstruction complete: ${components.length} components created, ${processedCount} processed, ${errorCount} errors`);
    
    return { components };
  }

  addComponentToContainer(container, childComponent, childType) {
    console.log(`Adding component type ${childType} to container`);
    
    const validation = this.validateComponentBeforeAdding(childComponent, childType);
    if (!validation.valid) {
      throw new Error(`Component validation failed: ${validation.reason}`);
    }

    try {
      switch (childType) {
        case 10:
          container.addTextDisplayComponents(childComponent);
          console.log('Successfully added TextDisplay to container');
          break;
        case 12:
        case 14:
          container.addMediaGalleryComponents(childComponent);
          console.log('Successfully added MediaGallery to container');
          break;
        case 15:
          container.addSectionComponents(childComponent);
          console.log('Successfully added Section to container');
          break;
        case 16:
          container.addSeparatorComponents(childComponent);
          console.log('Successfully added Separator to container');
          break;
        default:
          throw new Error(`Unsupported child component type for container: ${childType}`);
      }
    } catch (error) {
      console.error(`Error adding component type ${childType} to container:`, error);
      throw error;
    }
  }

  validateComponentBeforeAdding(component, componentType) {
    try {
      if (!component) {
        return { valid: false, reason: 'Component is null' };
      }

      const json = component.toJSON();
      if (!json) {
        return { valid: false, reason: 'Component toJSON() returned null' };
      }

      if (componentType === 14 && json.type === 14) {
        if (!json.items || json.items.length === 0) {
          return { valid: false, reason: 'MediaGallery has no items' };
        }
      }

      if (componentType === 17 && json.type === 17) {
        if (!json.components || json.components.length === 0) {
          return { valid: false, reason: 'Container has no components' };
        }
      }

      if (componentType === 16 && json.type === 16) {
        console.log('Separator validation passed:', json);
        return { valid: true, reason: 'Separator is valid' };
      }

      return { valid: true, reason: 'Component is valid' };
    } catch (error) {
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  processAttachments(bookmark) {
    const imageUrls = [];
    const videoUrls = [];
    const otherFiles = [];

    if (bookmark.attachments_data) {
      try {
        const attachments = JSON.parse(bookmark.attachments_data);
        
        attachments.forEach(att => {
          const filename = att.filename?.toLowerCase() || "";
          
          if (att.isImage || filename.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
            imageUrls.push(att.url);
          } else if (filename.match(/\.(mp4|mov|webm|avi|mkv)$/)) {
            videoUrls.push(att.url);
          } else {
            otherFiles.push(att);
          }
        });
      } catch (e) {
        console.error("Błąd przetwarzania załączników:", e);
      }
    }

    return { imageUrls, videoUrls, otherFiles };
  }

  createMessageLink(bookmark) {
    const isDM = bookmark.guild_id === '0';
    return isDM ? 
      `https://discord.com/channels/@me/${bookmark.channel_id}/${bookmark.message_id}` :
      `https://discord.com/channels/${bookmark.guild_id}/${bookmark.channel_id}/${bookmark.message_id}`;
  }

  createActionButtons(bookmarkId, linkUrl) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('delete_bookmark')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(linkUrl)
          .setEmoji('🔗')
      )
    ];
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

  extractComponentsV1Content(components) {
    const contentParts = [];
    const imageUrls = [];

    const processComponent = (component) => {
      if (!component) return;
      
      if (component.type === 17) {
        if (component.components) {
          component.components.forEach(processComponent);
        }
      } 
      else if (component.type === 10) {
        if (component.content) {
          contentParts.push(component.content);
        }
      }
      else if (component.type === 12) {
        if (component.items && component.items[0] && component.items[0].media && component.items[0].media.url) {
          imageUrls.push(component.items[0].media.url);
        } else if (component.media && component.media.url) {
          imageUrls.push(component.media.url);
        }
      }
      else if (component.type === 9) {
        if (component.components) {
          component.components.forEach(processComponent);
        }
      }
    };

    if (components && Array.isArray(components)) {
      components.forEach(processComponent);
    }
    
    return [contentParts.join('\n'), imageUrls];
  }
}

class BookmarksView {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.renderer = new SmartMessageRenderer(dbManager);
  }

  isGifUrl(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.gif')) return true;
    
    const gifDomains = [
      'tenor.com',
      'giphy.com',
      'gfycat.com',
      'imgur.com',
      'media.discordapp.net',
      'cdn.discordapp.com'
    ];
    
    return gifDomains.some(domain => lowerUrl.includes(domain));
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
          const mediaCount = this.countComponentsV2Media(v2Data);
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

  countComponentsV2Media(componentsData) {
    let mediaCount = 0;

    const countMedia = (component) => {
      if (!component || !component.type) return;

      switch (component.type) {
        case 12:
          if (component.items && Array.isArray(component.items)) {
            mediaCount += component.items.length;
          } else {
            mediaCount++;
          }
          break;
        case 14:
          if (component.items) {
            mediaCount += component.items.length;
          }
          break;
        case 15:
          if (component.thumbnail_accessory) {
            mediaCount++;
          }
          if (component.components) {
            component.components.forEach(countMedia);
          }
          break;
        case 17:
        case 1:
          if (component.components) {
            component.components.forEach(countMedia);
          }
          break;
      }
    };

    if (Array.isArray(componentsData)) {
      componentsData.forEach(countMedia);
    }

    return mediaCount;
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
  BookmarksView, 
  BookmarksPageView, 
  BookmarkDetailView,
  ComponentsV2DisplayView,
  SmartBookmarkDisplay,
  SmartMessageRenderer,
  MessageType
};