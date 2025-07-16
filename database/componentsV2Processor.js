class ComponentsV2Processor {
  extractComponentsV2Data(components) {
    const extractedData = {
      textContent: [],
      images: [],
      mediaGallery: [],
      buttons: [],
      selectMenus: [],
      sections: [],
      separators: [],
      containers: []
    };

    const processComponent = (component, depth = 0) => {
      if (!component || !component.type) return;

      const indent = '  '.repeat(depth);
      console.log(`${indent}Processing component type: ${component.type}`);

      switch (component.type) {
        case 17:
          this.processContainer(component, extractedData, depth, processComponent);
          break;
        case 10:
          this.processTextDisplay(component, extractedData, depth);
          break;
        case 12:
          this.processMedia(component, extractedData, depth);
          break;
        case 14:
          this.processMediaGallery(component, extractedData, depth);
          break;
        case 15:
          this.processSection(component, extractedData, depth);
          break;
        case 16:
          this.processSeparator(component, extractedData, depth);
          break;
        case 2:
          this.processButton(component, extractedData, depth);
          break;
        case 3: case 5: case 6: case 7: case 8:
          this.processSelectMenu(component, extractedData, depth);
          break;
        case 1:
          this.processActionRow(component, depth, processComponent);
          break;
        case 9:
          this.processUnknownAsSection(component, extractedData, depth);
          break;
        default:
          console.log(`${indent}Unknown component type: ${component.type}`);
          break;
      }
    };

    if (components && Array.isArray(components)) {
      components.forEach(component => processComponent(component, 0));
    }

    return extractedData;
  }

  processContainer(component, extractedData, depth, processComponent) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Container found`);
    
    extractedData.containers.push({
      type: 'container',
      accent_color: component.accent_color || null,
      spoiler: component.spoiler || false,
      components_count: component.components?.length || 0
    });
    
    if (component.components) {
      component.components.forEach(child => processComponent(child, depth + 1));
    }
  }

  processTextDisplay(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}TextDisplay found: ${component.content?.substring(0, 50)}...`);
    
    if (component.content) {
      extractedData.textContent.push({
        type: 'text_display',
        content: component.content,
        id: component.id || null
      });
    }
  }

  processMedia(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Media component found`);
    
    if (component.items && Array.isArray(component.items)) {
      component.items.forEach(item => {
        if (item.media && item.media.url) {
          extractedData.images.push({
            type: 'media',
            url: item.media.url,
            description: item.description || null,
            spoiler: item.spoiler || false,
            width: item.media.width || null,
            height: item.media.height || null
          });
        }
      });
    } else if (component.media) {
      extractedData.images.push({
        type: 'media',
        url: component.media.url || null,
        description: component.description || null,
        spoiler: component.spoiler || false,
        width: component.media.width || null,
        height: component.media.height || null
      });
    }
  }

  processMediaGallery(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}MediaGallery found`);
    
    if (component.items) {
      component.items.forEach(item => {
        extractedData.mediaGallery.push({
          type: 'media_gallery_item',
          url: item.media?.url || null,
          description: item.description || null,
          spoiler: item.spoiler || false
        });
      });
    }
  }

  processSection(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Section found`);
    
    const sectionData = {
      type: 'section',
      text_displays: [],
      button_accessory: null,
      thumbnail_accessory: null
    };

    if (component.components) {
      component.components.forEach(child => {
        if (child.type === 10) {
          sectionData.text_displays.push(child.content);
        }
      });
    }

    if (component.button_accessory) {
      sectionData.button_accessory = {
        label: component.button_accessory.label,
        custom_id: component.button_accessory.custom_id,
        style: component.button_accessory.style
      };
    }

    if (component.thumbnail_accessory) {
      sectionData.thumbnail_accessory = {
        url: component.thumbnail_accessory.url,
        description: component.thumbnail_accessory.description
      };
    }

    extractedData.sections.push(sectionData);
  }

  processSeparator(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Separator found`);
    
    extractedData.separators.push({
      type: 'separator',
      spacing: component.spacing || 'small',
      divider: component.divider !== undefined ? component.divider : true
    });
  }

  processButton(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Button found: ${component.label}`);
    
    extractedData.buttons.push({
      type: 'button',
      label: component.label || null,
      custom_id: component.custom_id || null,
      style: component.style || null,
      emoji: component.emoji || null,
      url: component.url || null,
      disabled: component.disabled || false
    });
  }

  processSelectMenu(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Select menu found (type ${component.type})`);
    
    extractedData.selectMenus.push({
      type: `select_${component.type}`,
      custom_id: component.custom_id || null,
      placeholder: component.placeholder || null,
      options: component.options || [],
      min_values: component.min_values || null,
      max_values: component.max_values || null
    });
  }

  processActionRow(component, depth, processComponent) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}ActionRow found`);
    
    if (component.components) {
      component.components.forEach(child => processComponent(child, depth + 1));
    }
  }

  processUnknownAsSection(component, extractedData, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}Type 9 component found - treating as section`);
    
    const type9SectionData = {
      type: 'section_type_9',
      text_displays: [],
      button_accessory: null,
      thumbnail_accessory: null
    };

    if (component.components) {
      component.components.forEach(child => {
        if (child.type === 10) {
          type9SectionData.text_displays.push(child.content);
        }
      });
    }

    if (component.button_accessory) {
      type9SectionData.button_accessory = {
        label: component.button_accessory.label,
        custom_id: component.button_accessory.custom_id,
        style: component.button_accessory.style
      };
    }

    if (component.thumbnail_accessory) {
      type9SectionData.thumbnail_accessory = {
        url: component.thumbnail_accessory.url,
        description: component.thumbnail_accessory.description
      };
    }

    extractedData.sections.push(type9SectionData);
  }

  componentsV2ToText(extractedData) {
    const textParts = [];

    extractedData.textContent.forEach(text => {
      textParts.push(text.content);
    });

    extractedData.sections.forEach(section => {
      if (section.text_displays.length > 0) {
        textParts.push(...section.text_displays);
      }
      if (section.button_accessory) {
        textParts.push(`[Przycisk: ${section.button_accessory.label}]`);
      }
    });

    extractedData.buttons.forEach(button => {
      if (button.label) {
        textParts.push(`[Przycisk: ${button.label}]`);
      }
    });

    extractedData.selectMenus.forEach(menu => {
      if (menu.placeholder) {
        textParts.push(`[Menu: ${menu.placeholder}]`);
      }
    });

    extractedData.separators.forEach((separator, index) => {
      const dividerText = separator.divider ? 'z linią' : 'bez linii';
      const spacingText = separator.spacing === 'large' ? 'duży' : 'mały';
      textParts.push(`[Separator ${index + 1}: ${spacingText} odstęp, ${dividerText}]`);
    });

    return textParts.join('\n');
  }

  processComponentsV2(componentsData) {
    if (!componentsData || !componentsData.length) {
      return { rawData: null, textContent: null };
    }

    console.log('Przetwarzanie Components v2...');
    console.log('Raw components data:', JSON.stringify(componentsData, null, 2));
    
    try {
      const rawComponentsData = componentsData.map(c => {
        if (typeof c.toJSON === 'function') {
          return c.toJSON();
        }
        return c;
      });

      const extractedData = this.extractComponentsV2Data(rawComponentsData);
      console.log('Wypakowanie danych Components v2:', extractedData);
      
      const textContent = this.componentsV2ToText(extractedData);
      console.log('Wypakowanie treści Components v2:', textContent);
      
      return {
        rawData: JSON.stringify(rawComponentsData),
        textContent: textContent
      };
      
    } catch (e) {
      console.error('Błąd przetwarzania Components v2:', e);
      return { rawData: null, textContent: null };
    }
  }
}

module.exports = ComponentsV2Processor;