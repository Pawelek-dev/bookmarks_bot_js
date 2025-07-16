const { MessageFlags } = require('discord.js');

class ComponentsV2Analyzer {
  detectComponentsV2(message, messageFlags) {
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

  hasComponentsV2Structure(components) {
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

  processComponentsV2(components) {
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

  analyzeComponentsV2Structure(components) {
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

module.exports = ComponentsV2Analyzer;