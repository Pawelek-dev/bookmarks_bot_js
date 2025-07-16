const ComponentsV2Processor = require('./componentsV2Processor');

class MessageProcessor {
  constructor() {
    this.componentsV2Processor = new ComponentsV2Processor();
  }

  processMessage(userId, message, embedData = null, componentsData = null, messageFlags = 0, guildId = '0') {
    if (!message) {
      throw new Error('Message object is null or undefined');
    }
    
    if (!message.author) {
      throw new Error('Message author is null or undefined');
    }
    
    const channelId = message.channel?.id || message.channelId;
    
    if (!channelId) {
      throw new Error('Message channel ID is null or undefined');
    }

    const flags = this.processMessageFlags(messageFlags);
    const isComponentsV2 = (flags & 32768) === 32768;
    
    console.log('Processing message:', {
      userId,
      messageId: message.id,
      channelId,
      guildId,
      isComponentsV2,
      flags
    });

    return {
      userId,
      messageId: message.id,
      channelId,
      guildId,
      messageContent: this.processMessageContent(message, componentsData, isComponentsV2),
      embedData,
      authorName: this.getAuthorName(message),
      authorAvatar: this.getAuthorAvatar(message),
      timestamp: this.getTimestamp(message),
      createdAt: new Date().toISOString(),
      attachmentsData: this.processAttachments(message),
      componentsData: this.processLegacyComponents(componentsData, isComponentsV2),
      messageFlags: flags,
      componentsV2Data: this.processComponentsV2Data(componentsData, isComponentsV2),
      componentsV2Content: this.processComponentsV2Content(componentsData, isComponentsV2),
      isComponentsV2
    };
  }

  processMessageFlags(messageFlags) {
    if (messageFlags && typeof messageFlags === 'object' && 'bitfield' in messageFlags) {
      return messageFlags.bitfield;
    }
    return messageFlags || 0;
  }

  processMessageContent(message, componentsData, isComponentsV2) {
    let content = message.content || '';
    
    if (isComponentsV2 && !content && componentsData) {
      const v2Result = this.componentsV2Processor.processComponentsV2(componentsData);
      if (v2Result.textContent) {
        content = v2Result.textContent;
      }
    }
    
    return content;
  }

  getAuthorName(message) {
    return message.author.displayName || message.author.username || 'Unknown User';
  }

  getAuthorAvatar(message) {
    return message.author.avatarURL() || null;
  }

  getTimestamp(message) {
    if (message.createdAt && typeof message.createdAt.toISOString === 'function') {
      return message.createdAt.toISOString();
    }
    
    if (message.timestamp) {
      if (typeof message.timestamp === 'string' || typeof message.timestamp === 'number') {
        return new Date(parseInt(message.timestamp)).toISOString();
      } else if (message.timestamp instanceof Date) {
        return message.timestamp.toISOString();
      }
    }
    
    try {
      const snowflakeTimestamp = (BigInt(message.id) >> 22n) + 1420070400000n;
      return new Date(Number(snowflakeTimestamp)).toISOString();
    } catch (e) {
      console.warn('Nie można wyciągnąć timestamp z snowflake, używam bieżącego czasu');
      return new Date().toISOString();
    }
  }

  processAttachments(message) {
    if (!message.attachments || message.attachments.size === 0) {
      return null;
    }

    const attachments = Array.from(message.attachments.values()).map(attachment => ({
      id: attachment.id,
      url: attachment.url,
      filename: attachment.name,
      contentType: attachment.contentType,
      width: attachment.width,
      height: attachment.height,
      size: attachment.size,
      isImage: attachment.contentType?.startsWith('image/')
    }));

    return JSON.stringify(attachments);
  }

  processLegacyComponents(componentsData, isComponentsV2) {
    if (isComponentsV2 || !componentsData) {
      return null;
    }

    return JSON.stringify(componentsData.map(c => 
      typeof c.toJSON === 'function' ? c.toJSON() : c
    ));
  }

  processComponentsV2Data(componentsData, isComponentsV2) {
    if (!isComponentsV2 || !componentsData || !componentsData.length) {
      return null;
    }

    const v2Result = this.componentsV2Processor.processComponentsV2(componentsData);
    return v2Result.rawData;
  }

  processComponentsV2Content(componentsData, isComponentsV2) {
    if (!isComponentsV2 || !componentsData || !componentsData.length) {
      return null;
    }

    const v2Result = this.componentsV2Processor.processComponentsV2(componentsData);
    return v2Result.textContent;
  }

  validateMessage(message) {
    const errors = [];

    if (!message) {
      errors.push('Message object is required');
    } else {
      if (!message.id) {
        errors.push('Message ID is required');
      }
      if (!message.author) {
        errors.push('Message author is required');
      }
      if (!message.channel?.id && !message.channelId) {
        errors.push('Message channel ID is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = MessageProcessor;