#!/usr/bin/env node

/**
 * Preprocessing Script for Custom Plugin Export
 *
 * This script transforms the plugin export into a Style Dictionary-compatible structure.
 * It processes both classic tokens and composite tokens (Typography & Effects).
 *
 * Features:
 * - Processes hex colors directly (already in input)
 * - Fixes FontWeight-px bug
 * - Context-aware alias resolution (Brand × Breakpoint/ColorMode)
 * - Generates Brand × Breakpoint matrix for Typography
 * - Generates Brand × ColorMode matrix for Effects
 */

const fs = require('fs');
const path = require('path');

// Paths
const INPUT_JSON_PATH = path.join(__dirname, '../src/design-tokens/bild-design-system-raw-data.json');
const OUTPUT_DIR = path.join(__dirname, '../tokens');

// Brand and mode mappings
const BRANDS = {
  BILD: '18038:0',
  SportBILD: '18094:0',
  Advertorial: '18094:1'
};

const BREAKPOINTS = {
  xs: '7017:0',
  sm: '16706:1',
  md: '7015:1',
  lg: '7015:2'
};

const COLOR_MODES = {
  light: '588:0',
  dark: '592:1'
};

// Collection IDs (stable)
const COLLECTION_IDS = {
  FONT_PRIMITIVE: 'VariableCollectionId:470:1450',
  COLOR_PRIMITIVE: 'VariableCollectionId:539:2238',
  SIZE_PRIMITIVE: 'VariableCollectionId:4072:1817',
  SPACE_PRIMITIVE: 'VariableCollectionId:2726:12077',
  DENSITY: 'VariableCollectionId:5695:5841',
  BRAND_TOKEN_MAPPING: 'VariableCollectionId:18038:10593',
  BRAND_COLOR_MAPPING: 'VariableCollectionId:18212:14495',
  BREAKPOINT_MODE: 'VariableCollectionId:7017:25696',
  COLOR_MODE: 'VariableCollectionId:588:1979'
};

/**
 * Loads the plugin JSON file
 */
function loadPluginTokens() {
  console.log('📥 Loading plugin token file...');
  const data = fs.readFileSync(INPUT_JSON_PATH, 'utf8');
  return JSON.parse(data);
}

/**
 * Creates an alias lookup map for faster reference resolution
 */
function createAliasLookup(collections) {
  const lookup = new Map();

  collections.forEach(collection => {
    collection.variables.forEach(variable => {
      lookup.set(variable.id, {
        name: variable.name,
        collectionId: collection.id,
        collectionName: collection.name,
        valuesByMode: variable.valuesByMode,
        resolvedType: variable.resolvedType,
        description: variable.description
      });
    });
  });

  return lookup;
}

/**
 * Fixes the FontWeight-px bug
 * Input: "700px" → Output: 700
 */
function fixFontWeightValue(value, tokenPath, resolvedType) {
  // Only for FontWeight tokens
  if (resolvedType === 'FLOAT' && tokenPath.toLowerCase().includes('fontweight')) {
    if (typeof value === 'string' && value.endsWith('px')) {
      const numericValue = parseInt(value.replace('px', ''), 10);
      return numericValue;
    }
  }
  return value;
}

/**
 * Converts Figma RGBA color object to Hex/RGBA string
 */
function colorToHex(color) {
  if (typeof color === 'string') {
    // Already a string (Hex or RGB)
    return color;
  }

  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? color.a : 1;

  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Processes a value based on type
 */
function processDirectValue(value, resolvedType, tokenPath = '') {
  // Fix FontWeight-px bug
  const fixedValue = fixFontWeightValue(value, tokenPath, resolvedType);

  switch (resolvedType) {
    case 'COLOR':
      return colorToHex(fixedValue);
    case 'FLOAT':
    case 'STRING':
    case 'BOOLEAN':
      return fixedValue;
    default:
      return fixedValue;
  }
}

/**
 * Resolves an alias value with context
 * @param {string} variableId - Variable ID
 * @param {Map} aliasLookup - Lookup Map
 * @param {object} context - { brandModeId, breakpointModeId, colorModeModeId }
 * @param {Set} visited - Circular reference protection
 */
function resolveAliasWithContext(variableId, aliasLookup, context = {}, visited = new Set()) {
  const variable = aliasLookup.get(variableId);

  if (!variable) {
    console.warn(`⚠️  Variable not found: ${variableId}`);
    return `UNRESOLVED_${variableId}`;
  }

  if (visited.has(variableId)) {
    console.warn(`⚠️  Circular reference: ${variable.name}`);
    return `CIRCULAR_REF_${variableId}`;
  }

  visited.add(variableId);

  // Determine the correct mode based on collection and context
  let targetModeId = null;

  // If variable comes from Breakpoint collection, use Breakpoint mode
  if (variable.collectionId === COLLECTION_IDS.BREAKPOINT_MODE && context.breakpointModeId) {
    targetModeId = context.breakpointModeId;
  }
  // If variable comes from ColorMode collection, use ColorMode
  else if (variable.collectionId === COLLECTION_IDS.COLOR_MODE && context.colorModeModeId) {
    targetModeId = context.colorModeModeId;
  }
  // If variable comes from Brand collection, use Brand mode
  else if ((variable.collectionId === COLLECTION_IDS.BRAND_TOKEN_MAPPING ||
             variable.collectionId === COLLECTION_IDS.BRAND_COLOR_MAPPING) && context.brandModeId) {
    targetModeId = context.brandModeId;
  }
  // Otherwise: take first available mode
  else {
    const modes = Object.keys(variable.valuesByMode);
    targetModeId = modes[0];
  }

  let value = variable.valuesByMode[targetModeId];

  // Fallback if mode doesn't exist
  if (value === undefined || value === null) {
    const modes = Object.keys(variable.valuesByMode);
    if (modes.length > 0) {
      targetModeId = modes[0];
      value = variable.valuesByMode[targetModeId];
    }
  }

  if (value === undefined || value === null) {
    console.warn(`⚠️  No value for ${variable.name} in mode ${targetModeId}`);
    return `NO_VALUE_${variableId}`;
  }

  // If value is itself an alias, resolve recursively
  if (value.type === 'VARIABLE_ALIAS') {
    return resolveAliasWithContext(value.id, aliasLookup, context, visited);
  }

  // Process direct value
  return processDirectValue(value, variable.resolvedType, variable.name);
}

/**
 * Determines the token type for Style Dictionary
 */
function determineTokenType(tokenName, collectionName, value) {
  const tokenPath = tokenName.toLowerCase();
  const collection = collectionName.toLowerCase();

  // Color
  if (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'))) {
    return { $type: 'color' };
  }

  // String values: no $type
  if (typeof value === 'string' && !value.endsWith('px')) {
    return { $type: null };
  }

  // FontWeight
  if (tokenPath.includes('fontweight') || tokenPath.includes('font-weight')) {
    return { $type: 'fontWeight' };
  }

  // Dimension types (only if numeric or px-string)
  if (typeof value === 'number' || (typeof value === 'string' && value.endsWith('px'))) {
    if (tokenPath.includes('fontsize') || tokenPath.includes('font-size')) {
      return { $type: 'dimension' };
    }
    if (tokenPath.includes('lineheight') || tokenPath.includes('line-height')) {
      if (typeof value === 'number' && value < 10) {
        return { $type: 'number' }; // Relative LineHeight
      }
      return { $type: 'dimension' };
    }
    if (collection.includes('size') || collection.includes('space') ||
        collection.includes('breakpoint') || collection.includes('density') ||
        tokenPath.includes('width') || tokenPath.includes('height')) {
      return { $type: 'dimension' };
    }
  }

  return { $type: null };
}

/**
 * Converts token name to nested path
 */
function convertTokenName(name) {
  return name
    .split('/')
    .filter(part => part && !part.startsWith('_'))
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
}

/**
 * Sets a value in a nested object path
 */
function setNestedPath(obj, pathArray, value) {
  let current = obj;

  for (let i = 0; i < pathArray.length - 1; i++) {
    const key = pathArray[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = pathArray[pathArray.length - 1];
  current[lastKey] = value;
}

/**
 * Processes Shared Primitive Collections (no brand context)
 * Output: shared/{collectionName}.json
 */
function processSharedPrimitives(collections, aliasLookup) {
  console.log('\n📦 Processing Shared Primitives:\n');

  const sharedCollectionIds = [
    COLLECTION_IDS.FONT_PRIMITIVE,
    COLLECTION_IDS.COLOR_PRIMITIVE,
    COLLECTION_IDS.SIZE_PRIMITIVE,
    COLLECTION_IDS.SPACE_PRIMITIVE
  ];

  const outputs = {};

  collections.forEach(collection => {
    if (!sharedCollectionIds.includes(collection.id)) return;

    console.log(`  ✅ ${collection.name}`);

    const tokens = {};

    // Shared primitives have only one mode ("Value")
    const mode = collection.modes[0];
    if (!mode) return;

    collection.variables.forEach(variable => {
      const pathArray = variable.name.split('/').filter(part => part);
      const modeValue = variable.valuesByMode[mode.modeId];

      if (modeValue !== undefined && modeValue !== null) {
        let processedValue;

        if (modeValue.type === 'VARIABLE_ALIAS') {
          processedValue = resolveAliasWithContext(modeValue.id, aliasLookup, {}, new Set());
        } else {
          processedValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
        }

        if (processedValue !== null) {
          const tokenObject = {
            $value: processedValue,
            value: processedValue,
            type: variable.resolvedType.toLowerCase(),
            $extensions: {
              'com.figma': {
                collectionId: collection.id,
                collectionName: collection.name,
                variableId: variable.id
              }
            }
          };

          if (variable.resolvedType === 'COLOR') {
            tokenObject.$type = 'color';
          } else {
            const typeInfo = determineTokenType(variable.name, collection.name, processedValue);
            if (typeInfo.$type) {
              tokenObject.$type = typeInfo.$type;
            }
          }

          if (variable.description) {
            tokenObject.comment = variable.description;
          }

          setNestedPath(tokens, pathArray, tokenObject);
        }
      }
    });

    const cleanName = collection.name
      .replace(/^_/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    outputs[cleanName] = tokens;
  });

  return outputs;
}

/**
 * Checks if a brand has BrandColorMapping
 */
function hasBrandColorMapping(collections, brandName) {
  const brandColorMappingCollection = collections.find(c => c.id === COLLECTION_IDS.BRAND_COLOR_MAPPING);
  if (!brandColorMappingCollection) return false;
  return brandColorMappingCollection.modes.some(m => m.name === brandName);
}

/**
 * Processes Brand-specific Token Collections
 * Output: brands/{brand}/{category}/{collectionName}-{mode}.json
 */
function processBrandSpecificTokens(collections, aliasLookup) {
  console.log('\n🏷️  Processing Brand-specific Tokens:\n');

  const brandCollectionIds = [
    COLLECTION_IDS.DENSITY,
    COLLECTION_IDS.BREAKPOINT_MODE,
    COLLECTION_IDS.COLOR_MODE
  ];

  const outputs = {
    bild: { density: {}, breakpoints: {}, color: {} },
    sportbild: { density: {}, breakpoints: {}, color: {} },
    advertorial: { density: {}, breakpoints: {} } // Advertorial has no BrandColorMapping
  };

  collections.forEach(collection => {
    if (!brandCollectionIds.includes(collection.id)) return;

    console.log(`  📦 ${collection.name}`);

    // Determine category
    let category;
    if (collection.id === COLLECTION_IDS.DENSITY) category = 'density';
    else if (collection.id === COLLECTION_IDS.BREAKPOINT_MODE) category = 'breakpoints';
    else if (collection.id === COLLECTION_IDS.COLOR_MODE) category = 'color';

    // For each brand
    Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
      const brandKey = brandName.toLowerCase();

      // Skip ColorMode for brands without BrandColorMapping
      if (category === 'color' && !hasBrandColorMapping(collections, brandName)) {
        return;
      }

      // For each mode in this collection
      collection.modes.forEach(mode => {
        const tokens = {};

        collection.variables.forEach(variable => {
          const pathArray = variable.name.split('/').filter(part => part);
          const modeValue = variable.valuesByMode[mode.modeId];

          if (modeValue !== undefined && modeValue !== null) {
            let processedValue;

            if (modeValue.type === 'VARIABLE_ALIAS') {
              // Context with Brand + Mode
              const context = {
                brandModeId,
                breakpointModeId: collection.id === COLLECTION_IDS.BREAKPOINT_MODE ? mode.modeId : undefined,
                colorModeModeId: collection.id === COLLECTION_IDS.COLOR_MODE ? mode.modeId : undefined
              };

              if (collection.id === COLLECTION_IDS.DENSITY) {
                context.breakpointModeId = mode.modeId;
              }

              processedValue = resolveAliasWithContext(modeValue.id, aliasLookup, context, new Set());
            } else {
              processedValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
            }

            if (processedValue !== null) {
              const tokenObject = {
                $value: processedValue,
                value: processedValue,
                type: variable.resolvedType.toLowerCase(),
                $extensions: {
                  'com.figma': {
                    collectionId: collection.id,
                    collectionName: collection.name,
                    variableId: variable.id
                  }
                }
              };

              if (variable.resolvedType === 'COLOR') {
                tokenObject.$type = 'color';
              } else {
                const typeInfo = determineTokenType(variable.name, collection.name, processedValue);
                if (typeInfo.$type) {
                  tokenObject.$type = typeInfo.$type;
                }
              }

              if (variable.description) {
                tokenObject.comment = variable.description;
              }

              setNestedPath(tokens, pathArray, tokenObject);
            }
          }
        });

        // Save brand-specific output
        const cleanModeName = mode.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[()]/g, '')
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/--+/g, '-')
          .replace(/^-|-$/g, '');

        outputs[brandKey][category][cleanModeName] = tokens;
      });

      console.log(`     ✅ ${brandKey} (${Object.keys(outputs[brandKey][category]).length} modes)`);
    });
  });

  return outputs;
}

/**
 * Processes Brand Overrides (BrandTokenMapping, BrandColorMapping)
 * Output: brands/{brand}/overrides/{collectionName}.json
 */
function processBrandOverrides(collections, aliasLookup) {
  console.log('\n🎨 Processing Brand Overrides:\n');

  const overrideCollectionIds = [
    COLLECTION_IDS.BRAND_TOKEN_MAPPING,
    COLLECTION_IDS.BRAND_COLOR_MAPPING
  ];

  const outputs = {
    bild: {},
    sportbild: {},
    advertorial: {}
  };

  collections.forEach(collection => {
    if (!overrideCollectionIds.includes(collection.id)) return;

    console.log(`  📦 ${collection.name}`);

    // Each mode is a brand - match by mode name instead of mode ID
    Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
      const brandKey = brandName.toLowerCase();

      // Find mode by name (not ID), since each collection has its own mode IDs
      const mode = collection.modes.find(m => m.name === brandName);

      if (!mode) {
        // Brand doesn't exist in this collection (e.g. Advertorial in BrandColorMapping)
        return;
      }

      const tokens = {};

      collection.variables.forEach(variable => {
        const pathArray = variable.name.split('/').filter(part => part);
        const modeValue = variable.valuesByMode[mode.modeId];

        if (modeValue !== undefined && modeValue !== null) {
          let processedValue;

          if (modeValue.type === 'VARIABLE_ALIAS') {
            // Use the GLOBAL brand mode ID (from BRANDS) for alias resolution
            // since aliases can point to other collections (e.g. BrandTokenMapping)
            const context = { brandModeId };
            processedValue = resolveAliasWithContext(modeValue.id, aliasLookup, context, new Set());
          } else {
            processedValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
          }

          if (processedValue !== null) {
            const tokenObject = {
              $value: processedValue,
              value: processedValue,
              type: variable.resolvedType.toLowerCase(),
              $extensions: {
                'com.figma': {
                  collectionId: collection.id,
                  collectionName: collection.name,
                  variableId: variable.id
                }
              }
            };

            if (variable.resolvedType === 'COLOR') {
              tokenObject.$type = 'color';
            } else {
              const typeInfo = determineTokenType(variable.name, collection.name, processedValue);
              if (typeInfo.$type) {
                tokenObject.$type = typeInfo.$type;
              }
            }

            if (variable.description) {
              tokenObject.comment = variable.description;
            }

            setNestedPath(tokens, pathArray, tokenObject);
          }
        }
      });

      const cleanCollectionName = collection.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      outputs[brandKey][cleanCollectionName] = tokens;
    });

    console.log(`     ✅ All brands processed`);
  });

  return outputs;
}

/**
 * Processes Typography Composite Tokens (textStyles)
 * Generates Brand × Breakpoint matrix
 */
function processTypographyTokens(textStyles, aliasLookup) {
  console.log('\n✍️  Processing Typography Composite Tokens:\n');

  const typographyOutputs = {};

  // For each brand
  Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
    console.log(`  🏷️  Brand: ${brandName}`);

    // For each breakpoint
    Object.entries(BREAKPOINTS).forEach(([breakpointName, breakpointModeId]) => {
      const context = {
        brandModeId,
        breakpointModeId
      };

      const tokens = {};

      textStyles.forEach(textStyle => {
        const styleName = textStyle.name.split('/').pop(); // e.g. "display1"
        const category = textStyle.name.split('/').slice(-2, -1)[0]; // e.g. "Display"

        const resolvedStyle = {
          fontFamily: null,
          fontWeight: null,
          fontSize: null,
          lineHeight: null,
          letterSpacing: null,
          fontStyle: null,
          textCase: textStyle.textCase || 'ORIGINAL',
          textDecoration: textStyle.textDecoration || 'NONE'
        };

        // Resolve boundVariables
        if (textStyle.boundVariables) {
          Object.entries(textStyle.boundVariables).forEach(([property, alias]) => {
            if (alias.type === 'VARIABLE_ALIAS') {
              const resolved = resolveAliasWithContext(alias.id, aliasLookup, context, new Set());
              resolvedStyle[property] = resolved;
            }
          });
        }

        // Fallback to direct values
        if (!resolvedStyle.fontFamily && textStyle.fontName) {
          resolvedStyle.fontFamily = textStyle.fontName.family;
        }

        // Token structure: category/styleName
        const pathArray = [category.toLowerCase(), styleName.toLowerCase()];

        setNestedPath(tokens, pathArray, {
          $value: resolvedStyle,
          value: resolvedStyle,
          type: 'typography',
          $type: 'typography',
          comment: textStyle.description || '',
          $extensions: {
            'com.figma': {
              styleId: textStyle.id,
              styleName: textStyle.name
            }
          }
        });
      });

      const key = `${brandName.toLowerCase()}-${breakpointName}`;
      typographyOutputs[key] = {
        tokens,
        brand: brandName,
        breakpoint: breakpointName,
        brandModeId,
        breakpointModeId
      };

      console.log(`     ✅ ${key}`);
    });
  });

  return typographyOutputs;
}

/**
 * Processes Effect Composite Tokens (effectStyles)
 * Generates Brand × ColorMode matrix
 */
function processEffectTokens(effectStyles, aliasLookup) {
  console.log('\n🎨 Processing Effect Composite Tokens:\n');

  const effectOutputs = {};

  // For each brand
  Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
    console.log(`  🏷️  Brand: ${brandName}`);

    // For each ColorMode
    Object.entries(COLOR_MODES).forEach(([modeName, colorModeModeId]) => {
      const context = {
        brandModeId,
        colorModeModeId
      };

      const tokens = {};

      effectStyles.forEach(effectStyle => {
        const styleName = effectStyle.name.split('/').pop();
        const category = effectStyle.name.split('/').slice(-2, -1)[0];

        const resolvedEffects = [];

        if (effectStyle.effects && Array.isArray(effectStyle.effects)) {
          effectStyle.effects.forEach(effect => {
            if (effect.type === 'DROP_SHADOW' && effect.visible) {
              const shadowEffect = {
                type: 'dropShadow',
                color: colorToHex(effect.color),
                offsetX: effect.offset.x,
                offsetY: effect.offset.y,
                radius: effect.radius,
                spread: effect.spread || 0,
                blendMode: effect.blendMode || 'NORMAL'
              };

              // Resolve boundVariables if present
              if (effect.boundVariables && effect.boundVariables.color) {
                if (effect.boundVariables.color.type === 'VARIABLE_ALIAS') {
                  const resolved = resolveAliasWithContext(
                    effect.boundVariables.color.id,
                    aliasLookup,
                    context,
                    new Set()
                  );
                  shadowEffect.color = resolved;
                }
              }

              resolvedEffects.push(shadowEffect);
            }
          });
        }

        const pathArray = [category.toLowerCase(), styleName.toLowerCase()];

        setNestedPath(tokens, pathArray, {
          $value: resolvedEffects,
          value: resolvedEffects,
          type: 'shadow',
          $type: 'shadow',
          comment: effectStyle.description || '',
          $extensions: {
            'com.figma': {
              styleId: effectStyle.id,
              styleName: effectStyle.name
            }
          }
        });
      });

      const key = `${brandName.toLowerCase()}-${modeName}`;
      effectOutputs[key] = {
        tokens,
        brand: brandName,
        colorMode: modeName,
        brandModeId,
        colorModeModeId
      };

      console.log(`     ✅ ${key}`);
    });
  });

  return effectOutputs;
}

/**
 * Saves Shared Primitives
 */
function saveSharedPrimitives(sharedOutputs) {
  console.log('\n💾 Saving Shared Primitives:\n');

  const sharedDir = path.join(OUTPUT_DIR, 'shared');
  if (!fs.existsSync(sharedDir)) {
    fs.mkdirSync(sharedDir, { recursive: true });
  }

  Object.entries(sharedOutputs).forEach(([collectionName, tokens]) => {
    const filePath = path.join(sharedDir, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
    console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`);
  });
}

/**
 * Saves Brand-specific Tokens
 */
function saveBrandSpecificTokens(brandOutputs) {
  console.log('\n💾 Saving Brand-specific Tokens:\n');

  Object.entries(brandOutputs).forEach(([brand, categories]) => {
    console.log(`  🏷️  ${brand}:`);

    Object.entries(categories).forEach(([category, modes]) => {
      const categoryDir = path.join(OUTPUT_DIR, 'brands', brand, category);
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

      Object.entries(modes).forEach(([modeName, tokens]) => {
        const collectionPrefix = category === 'density' ? 'density' :
                                  category === 'breakpoints' ? 'breakpoint' :
                                  'colormode';
        const fileName = `${collectionPrefix}-${modeName}.json`;
        const filePath = path.join(categoryDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
        console.log(`     ✅ ${category}/${fileName}`);
      });
    });
  });
}

/**
 * Saves Brand Overrides
 */
function saveBrandOverrides(overrideOutputs) {
  console.log('\n💾 Saving Brand Overrides:\n');

  Object.entries(overrideOutputs).forEach(([brand, collections]) => {
    console.log(`  🏷️  ${brand}: (${Object.keys(collections).length} collections)`);

    const overridesDir = path.join(OUTPUT_DIR, 'brands', brand, 'overrides');
    if (!fs.existsSync(overridesDir)) {
      fs.mkdirSync(overridesDir, { recursive: true });
    }

    Object.entries(collections).forEach(([collectionName, tokens]) => {
      const fileName = `${collectionName}.json`;
      const filePath = path.join(overridesDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
      console.log(`     ✅ overrides/${fileName}`);
    });
  });
}

/**
 * Saves Typography Tokens
 */
function saveTypographyTokens(typographyOutputs) {
  console.log('\n💾 Saving Typography Tokens:\n');

  // Group by brand
  const byBrand = {};
  Object.entries(typographyOutputs).forEach(([key, data]) => {
    const brand = data.brand.toLowerCase();
    const breakpoint = data.breakpoint;

    if (!byBrand[brand]) byBrand[brand] = {};
    byBrand[brand][breakpoint] = data.tokens;
  });

  // Save in brands/{brand}/semantic/typography/
  Object.entries(byBrand).forEach(([brand, breakpoints]) => {
    console.log(`  🏷️  ${brand}:`);

    const typographyDir = path.join(OUTPUT_DIR, 'brands', brand, 'semantic', 'typography');
    if (!fs.existsSync(typographyDir)) {
      fs.mkdirSync(typographyDir, { recursive: true });
    }

    Object.entries(breakpoints).forEach(([breakpoint, tokens]) => {
      const fileName = `typography-${breakpoint}.json`;
      const filePath = path.join(typographyDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
      console.log(`     ✅ semantic/typography/${fileName}`);
    });
  });
}

/**
 * Saves Effect Tokens
 */
function saveEffectTokens(effectOutputs) {
  console.log('\n💾 Saving Effect Tokens:\n');

  // Group by brand
  const byBrand = {};
  Object.entries(effectOutputs).forEach(([key, data]) => {
    const brand = data.brand.toLowerCase();
    const colorMode = data.colorMode;

    if (!byBrand[brand]) byBrand[brand] = {};
    byBrand[brand][colorMode] = data.tokens;
  });

  // Save in brands/{brand}/semantic/effects/
  Object.entries(byBrand).forEach(([brand, colorModes]) => {
    console.log(`  🏷️  ${brand}:`);

    const effectsDir = path.join(OUTPUT_DIR, 'brands', brand, 'semantic', 'effects');
    if (!fs.existsSync(effectsDir)) {
      fs.mkdirSync(effectsDir, { recursive: true });
    }

    Object.entries(colorModes).forEach(([colorMode, tokens]) => {
      const fileName = `effects-${colorMode}.json`;
      const filePath = path.join(effectsDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
      console.log(`     ✅ semantic/effects/${fileName}`);
    });
  });
}

/**
 * Main function
 */
function main() {
  console.log('🚀 Starting Plugin Token Preprocessing...\n');

  // Clear output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load plugin tokens
  const pluginData = loadPluginTokens();

  // Create alias lookup
  console.log('🔍 Creating Alias Lookup...');
  const aliasLookup = createAliasLookup(pluginData.collections);
  console.log(`   ℹ️  ${aliasLookup.size} variables indexed`);

  // Process classic tokens
  const sharedPrimitives = processSharedPrimitives(pluginData.collections, aliasLookup);
  const brandSpecificTokens = processBrandSpecificTokens(pluginData.collections, aliasLookup);
  const brandOverrides = processBrandOverrides(pluginData.collections, aliasLookup);

  // Process composite tokens
  const typographyTokens = processTypographyTokens(pluginData.textStyles || [], aliasLookup);
  const effectTokens = processEffectTokens(pluginData.effectStyles || [], aliasLookup);

  // Save everything
  saveSharedPrimitives(sharedPrimitives);
  saveBrandSpecificTokens(brandSpecificTokens);
  saveBrandOverrides(brandOverrides);
  saveTypographyTokens(typographyTokens);
  saveEffectTokens(effectTokens);

  // Statistics
  console.log('\n✨ Preprocessing completed!\n');
  console.log(`📊 Statistics:`);
  console.log(`   - Shared Primitives: ${Object.keys(sharedPrimitives).length}`);
  console.log(`   - Brand-specific Collections: ${Object.keys(brandSpecificTokens).length} brands`);
  console.log(`   - Brand Overrides: ${Object.keys(brandOverrides).length} brands`);
  console.log(`   - Typography Outputs: ${Object.keys(typographyTokens).length}`);
  console.log(`   - Effect Outputs: ${Object.keys(effectTokens).length}`);
  console.log(`   - Output Directory: ${path.relative(process.cwd(), OUTPUT_DIR)}\n`);
}

// Execute script
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ Error during preprocessing:', error);
    process.exit(1);
  }
}

module.exports = { main };
