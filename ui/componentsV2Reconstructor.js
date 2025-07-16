const { 
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ThumbnailBuilder,
  SeparatorSpacingSize
} = require('discord.js');

const { ComponentTypeNames } = require('./messageTypes');

class ComponentsV2Reconstructor {
  getComponentTypeName(type) {
    return ComponentTypeNames[type] || `Nieznany (${type})`;
  }

  reconstructComponentsV2(componentsData) {
    const components = [];
    let processedCount = 0;
    let errorCount = 0;
    
    console.log(`Starting reconstruction of ${componentsData.length} top-level components`);
    
    if (Array.isArray(componentsData)) {
      componentsData.forEach((component, index) => {
        console.log(`Processing top-level component ${index + 1}/${componentsData.length}`);
        const reconstructed = this.processComponent(component, 0, { processedCount, errorCount });
        if (reconstructed.result) {
          try {
            const testJson = reconstructed.result.toJSON();
            console.log(`Component ${index + 1} validation successful, type: ${testJson.type}`);
            components.push(reconstructed.result);
            console.log(`Successfully added component ${index + 1}/${componentsData.length} to final array`);
          } catch (validationError) {
            console.error(`Component ${index + 1} validation failed:`, validationError.message);
          }
        } else {
          console.log(`Failed to reconstruct component ${index + 1}/${componentsData.length}`);
        }
        processedCount = reconstructed.processedCount;
        errorCount = reconstructed.errorCount;
      });
    }

    console.log(`Reconstruction complete: ${components.length} components created, ${processedCount} processed, ${errorCount} errors`);
    
    return { components };
  }

  processComponent(component, depth = 0, counters = { processedCount: 0, errorCount: 0 }) {
    if (!component) {
      console.log(`Skipping null component at depth ${depth}`);
      return { result: null, ...counters };
    }
    
    if (component.type === undefined || component.type === null) {
      console.warn(`Component with undefined/null type at depth ${depth}:`, JSON.stringify(component, null, 2));
      return { result: null, ...counters };
    }

    counters.processedCount++;
    const indent = '  '.repeat(depth);
    console.log(`${indent}Processing component ${counters.processedCount}: type ${component.type} (${this.getComponentTypeName(component.type)})`);

    try {
      let result = null;

      switch (component.type) {
        case 17:
          result = this.buildContainer(component, depth, counters);
          break;
        case 10:
          result = this.buildTextDisplay(component, depth);
          break;
        case 12:
          result = this.buildMediaFromMedia(component, depth);
          break;
        case 14:
          result = this.buildMediaGallery(component, depth);
          break;
        case 15:
          result = this.buildSection(component, depth, counters);
          break;
        case 16:
          result = this.buildSeparator(component, depth);
          break;
        case 9:
          result = this.buildUnknownAsSection(component, depth, counters);
          break;
        case 11:
        case 13:
          console.log(`${indent}Found ${this.getComponentTypeName(component.type)} component, but not implemented - skipping`);
          result = null;
          break;
        default:
          console.log(`${indent}Unsupported component type: ${component.type}`);
          result = null;
      }

      return { result, ...counters };
    } catch (error) {
      counters.errorCount++;
      console.error(`${indent}Error processing component type ${component.type}:`, error);
      console.error(`${indent}Component data:`, JSON.stringify(component, null, 2));
      return { result: null, ...counters };
    }
  }

  buildContainer(component, depth, counters) {
    const indent = '  '.repeat(depth);
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
        const childResult = this.processComponent(child, depth + 1, counters);
        counters = { processedCount: childResult.processedCount, errorCount: childResult.errorCount };
        
        if (childResult.result) {
          try {
            const childJson = childResult.result.toJSON();
            if (childJson) {
              validChildren.push({ component: childResult.result, type: child.type, index });
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
  }

  buildTextDisplay(component, depth) {
    const indent = '  '.repeat(depth);
    const content = component.content || '';
    if (!content.trim()) {
      console.log(`${indent}Empty TextDisplay, skipping`);
      return null;
    }
    console.log(`${indent}Building TextDisplay with content: "${content.substring(0, 50)}..."`);
    return new TextDisplayBuilder().setContent(content);
  }

  buildMediaFromMedia(component, depth) {
    const indent = '  '.repeat(depth);
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
  }

  buildMediaGallery(component, depth) {
    const indent = '  '.repeat(depth);
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
  }

  buildSection(component, depth, counters) {
    const indent = '  '.repeat(depth);
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
  }

  buildSeparator(component, depth) {
    const indent = '  '.repeat(depth);
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
  }

  buildUnknownAsSection(component, depth, counters) {
    const indent = '  '.repeat(depth);
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
}

module.exports = ComponentsV2Reconstructor;