const { MessageType, ComponentTypeNames } = require('./messageTypes');
const SmartMessageRenderer = require('./messageRenderer');
const ComponentsV2Reconstructor = require('./componentsV2Reconstructor');
const MessageUtils = require('./messageUtils');
const BookmarksView = require('./bookmarksView');
const { 
  BookmarksPageView, 
  BookmarkDetailView,
  ComponentsV2DisplayView,
  SmartBookmarkDisplay
} = require('./viewClasses');

module.exports = {
  MessageType,
  ComponentTypeNames,
  
  SmartMessageRenderer,
  ComponentsV2Reconstructor,
  MessageUtils,
  BookmarksView,
  
  BookmarksPageView,
  BookmarkDetailView,
  ComponentsV2DisplayView,
  SmartBookmarkDisplay
};