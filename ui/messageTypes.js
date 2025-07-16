const MessageType = {
  COMPONENTS_V2: 'components_v2',
  EMBED: 'embed',
  PLAIN_TEXT: 'plain_text',
  MIXED: 'mixed',
  ATTACHMENTS_ONLY: 'attachments_only'
};

const ComponentTypeNames = {
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

module.exports = {
  MessageType,
  ComponentTypeNames
};