const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class MessageUtils {
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
}

module.exports = MessageUtils;