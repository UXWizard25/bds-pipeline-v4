#!/usr/bin/env node

/**
 * Modular Token Preprocessing Script
 *
 * Transforms Figma plugin export into a 3-layer token architecture:
 * - Layer 1: Primitives (no references - resolved values)
 * - Layer 2: Semantic (references to primitives via {token.path})
 * - Layer 3: Components (references to semantic via {token.path})
 *
 * The output maintains reference chains for CSS variable generation:
 * Primitives → --color-red-500: #DD0000;
 * Semantic → --semantic-brand-primary: var(--color-red-500);
 * Components → --button-background: var(--semantic-brand-primary);
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

// Primitive collection names for mapping
const PRIMITIVE_COLLECTIONS = {
  [COLLECTION_IDS.FONT_PRIMITIVE]: 'typography',
  [COLLECTION_IDS.COLOR_PRIMITIVE]: 'colors',
  [COLLECTION_IDS.SIZE_PRIMITIVE]: 'sizing',
  [COLLECTION_IDS.SPACE_PRIMITIVE]: 'spacing'
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
 */
function fixFontWeightValue(value, tokenPath, resolvedType) {
  if (resolvedType === 'FLOAT' && tokenPath.toLowerCase().includes('fontweight')) {
    if (typeof value === 'string' && value.endsWith('px')) {
      return parseInt(value.replace('px', ''), 10);
    }
  }
  return value;
}

/**
 * Converts Figma RGBA color object to Hex/RGBA string
 */
function colorToHex(color) {
  if (typeof color === 'string') return color;

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
 * Converts token name to a consistent path format
 */
function tokenNameToPath(name) {
  return name
    .split('/')
    .filter(part => part && !part.startsWith('_'))
    .map(part => part.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .join('.');
}

/**
 * Converts a token path to a Style Dictionary reference format
 */
function pathToReference(tokenPath) {
  return `{${tokenPath}}`;
}

/**
 * Gets the reference path for a variable ID (for semantic/component tokens)
 */
function getReferencePath(variableId, aliasLookup, primitivePathMap) {
  const variable = aliasLookup.get(variableId);
  if (!variable) return null;

  // Check if this is a primitive token
  const primitivePath = primitivePathMap.get(variableId);
  if (primitivePath) {
    return primitivePath;
  }

  // For non-primitive tokens, generate the path from the name
  return tokenNameToPath(variable.name);
}

/**
 * Resolves a value fully to its final form (for primitives)
 */
function resolveValueFully(variableId, aliasLookup, context = {}, visited = new Set()) {
  const variable = aliasLookup.get(variableId);

  if (!variable) {
    console.warn(`⚠️  Variable not found: ${variableId}`);
    return { value: `UNRESOLVED_${variableId}`, type: 'string' };
  }

  if (visited.has(variableId)) {
    console.warn(`⚠️  Circular reference: ${variable.name}`);
    return { value: `CIRCULAR_REF_${variableId}`, type: 'string' };
  }

  visited.add(variableId);

  // Determine the correct mode
  let targetModeId = null;

  if (variable.collectionId === COLLECTION_IDS.BREAKPOINT_MODE && context.breakpointModeId) {
    targetModeId = context.breakpointModeId;
  } else if (variable.collectionId === COLLECTION_IDS.COLOR_MODE && context.colorModeModeId) {
    targetModeId = context.colorModeModeId;
  } else if ((variable.collectionId === COLLECTION_IDS.BRAND_TOKEN_MAPPING ||
              variable.collectionId === COLLECTION_IDS.BRAND_COLOR_MAPPING) && context.brandModeId) {
    targetModeId = context.brandModeId;
  } else {
    const modes = Object.keys(variable.valuesByMode);
    targetModeId = modes[0];
  }

  let value = variable.valuesByMode[targetModeId];

  if (value === undefined || value === null) {
    const modes = Object.keys(variable.valuesByMode);
    if (modes.length > 0) {
      targetModeId = modes[0];
      value = variable.valuesByMode[targetModeId];
    }
  }

  if (value === undefined || value === null) {
    return { value: `NO_VALUE_${variableId}`, type: 'string' };
  }

  // If value is an alias, resolve recursively
  if (value.type === 'VARIABLE_ALIAS') {
    return resolveValueFully(value.id, aliasLookup, context, visited);
  }

  return {
    value: processDirectValue(value, variable.resolvedType, variable.name),
    type: variable.resolvedType
  };
}

/**
 * Determines the token type for Style Dictionary
 */
function determineTokenType(tokenName, value, resolvedType) {
  const tokenPath = tokenName.toLowerCase();

  if (resolvedType === 'COLOR' || (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb')))) {
    return 'color';
  }

  if (tokenPath.includes('fontweight') || tokenPath.includes('font-weight')) {
    return 'fontWeight';
  }

  if (typeof value === 'number' || (typeof value === 'string' && value.endsWith('px'))) {
    if (tokenPath.includes('fontsize') || tokenPath.includes('font-size')) {
      return 'dimension';
    }
    if (tokenPath.includes('lineheight') || tokenPath.includes('line-height')) {
      if (typeof value === 'number' && value < 10) {
        return 'number';
      }
      return 'dimension';
    }
    if (tokenPath.includes('space') || tokenPath.includes('size') || tokenPath.includes('width') || tokenPath.includes('height') || tokenPath.includes('radius')) {
      return 'dimension';
    }
  }

  return null;
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
 * Process Primitive Collections - Layer 1
 * Output: tokens/primitives/{type}.json
 * NO references - all values are resolved
 */
function processPrimitives(collections, aliasLookup) {
  console.log('\n📦 Processing Primitives (Layer 1):\n');

  const primitiveCollectionIds = [
    COLLECTION_IDS.FONT_PRIMITIVE,
    COLLECTION_IDS.COLOR_PRIMITIVE,
    COLLECTION_IDS.SIZE_PRIMITIVE,
    COLLECTION_IDS.SPACE_PRIMITIVE
  ];

  const outputs = {
    colors: {},
    typography: {},
    spacing: {},
    sizing: {},
    radius: {},
    shadows: {}
  };

  // Map variable IDs to their output paths for reference generation
  const primitivePathMap = new Map();

  collections.forEach(collection => {
    if (!primitiveCollectionIds.includes(collection.id)) return;

    const outputKey = PRIMITIVE_COLLECTIONS[collection.id] || 'other';
    console.log(`  ✅ ${collection.name} → ${outputKey}`);

    const mode = collection.modes[0];
    if (!mode) return;

    collection.variables.forEach(variable => {
      const pathArray = variable.name.split('/').filter(part => part && !part.startsWith('_'));
      const modeValue = variable.valuesByMode[mode.modeId];

      if (modeValue !== undefined && modeValue !== null) {
        let processedValue;

        if (modeValue.type === 'VARIABLE_ALIAS') {
          const resolved = resolveValueFully(modeValue.id, aliasLookup, {}, new Set());
          processedValue = resolved.value;
        } else {
          processedValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
        }

        if (processedValue !== null) {
          const tokenType = determineTokenType(variable.name, processedValue, variable.resolvedType);

          const tokenObject = {
            $value: processedValue
          };

          if (tokenType) {
            tokenObject.$type = tokenType;
          }

          if (variable.description) {
            tokenObject.$description = variable.description;
          }

          // Store the path for reference mapping
          const outputPath = pathArray.map(p => p.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')).join('.');
          primitivePathMap.set(variable.id, outputPath);

          setNestedPath(outputs[outputKey], pathArray, tokenObject);
        }
      }
    });
  });

  return { outputs, primitivePathMap };
}

/**
 * Process Semantic Tokens - Layer 2
 * Output: tokens/semantic/{brand}/colors-{mode}.json, spacing-{breakpoint}.json
 * WITH references to primitives
 */
function processSemanticTokens(collections, aliasLookup, primitivePathMap) {
  console.log('\n🎨 Processing Semantic Tokens (Layer 2):\n');

  const outputs = {
    bild: {},
    sportbild: {},
    advertorial: {}
  };

  // Process ColorMode tokens (colors-light.json, colors-dark.json)
  const colorModeCollection = collections.find(c => c.id === COLLECTION_IDS.COLOR_MODE);
  if (colorModeCollection) {
    Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
      const brandKey = brandName.toLowerCase();

      // Skip Advertorial for color mode (no BrandColorMapping)
      if (brandKey === 'advertorial') return;

      Object.entries(COLOR_MODES).forEach(([modeName, modeId]) => {
        const tokens = {};

        colorModeCollection.variables.forEach(variable => {
          const modeValue = variable.valuesByMode[modeId];

          if (modeValue !== undefined && modeValue !== null) {
            const pathArray = variable.name.split('/').filter(part => part && !part.startsWith('_'));

            let tokenValue;

            if (modeValue.type === 'VARIABLE_ALIAS') {
              // Check if it references a primitive
              const refPath = primitivePathMap.get(modeValue.id);
              if (refPath) {
                tokenValue = pathToReference(refPath);
              } else {
                // Resolve the value since we can't reference it
                const resolved = resolveValueFully(modeValue.id, aliasLookup, { brandModeId, colorModeModeId: modeId }, new Set());
                tokenValue = resolved.value;
              }
            } else {
              tokenValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
            }

            const tokenObject = {
              $value: tokenValue
            };

            const tokenType = determineTokenType(variable.name, tokenValue, variable.resolvedType);
            if (tokenType) {
              tokenObject.$type = tokenType;
            }

            if (variable.description) {
              tokenObject.$description = variable.description;
            }

            setNestedPath(tokens, pathArray, tokenObject);
          }
        });

        if (!outputs[brandKey][`colors-${modeName}`]) {
          outputs[brandKey][`colors-${modeName}`] = {};
        }
        outputs[brandKey][`colors-${modeName}`] = { semantic: tokens };
      });

      console.log(`  ✅ ${brandKey}/colors-light, colors-dark`);
    });
  }

  // Process Breakpoint tokens (spacing-mobile.json, etc.)
  const breakpointCollection = collections.find(c => c.id === COLLECTION_IDS.BREAKPOINT_MODE);
  if (breakpointCollection) {
    const breakpointMapping = {
      'xs': 'mobile',
      'sm': 'mobile',
      'md': 'tablet',
      'lg': 'desktop'
    };

    Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
      const brandKey = brandName.toLowerCase();

      Object.entries(BREAKPOINTS).forEach(([bpName, bpModeId]) => {
        const tokens = {};
        const outputName = breakpointMapping[bpName] || bpName;

        breakpointCollection.variables.forEach(variable => {
          const modeValue = variable.valuesByMode[bpModeId];

          if (modeValue !== undefined && modeValue !== null) {
            const pathArray = variable.name.split('/').filter(part => part && !part.startsWith('_'));

            let tokenValue;

            if (modeValue.type === 'VARIABLE_ALIAS') {
              const refPath = primitivePathMap.get(modeValue.id);
              if (refPath) {
                tokenValue = pathToReference(refPath);
              } else {
                const resolved = resolveValueFully(modeValue.id, aliasLookup, { brandModeId, breakpointModeId: bpModeId }, new Set());
                tokenValue = resolved.value;
              }
            } else {
              tokenValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
            }

            const tokenObject = {
              $value: tokenValue
            };

            const tokenType = determineTokenType(variable.name, tokenValue, variable.resolvedType);
            if (tokenType) {
              tokenObject.$type = tokenType;
            }

            setNestedPath(tokens, pathArray, tokenObject);
          }
        });

        // Only create if there are tokens
        if (Object.keys(tokens).length > 0) {
          const key = `spacing-${outputName}`;
          if (!outputs[brandKey][key]) {
            outputs[brandKey][key] = {};
          }
          outputs[brandKey][key] = { semantic: tokens };
        }
      });

      console.log(`  ✅ ${brandKey}/spacing-mobile, tablet, desktop`);
    });
  }

  // Process Density tokens
  const densityCollection = collections.find(c => c.id === COLLECTION_IDS.DENSITY);
  if (densityCollection) {
    Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
      const brandKey = brandName.toLowerCase();

      densityCollection.modes.forEach(mode => {
        const tokens = {};
        const modeName = mode.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        densityCollection.variables.forEach(variable => {
          const modeValue = variable.valuesByMode[mode.modeId];

          if (modeValue !== undefined && modeValue !== null) {
            const pathArray = variable.name.split('/').filter(part => part && !part.startsWith('_'));

            let tokenValue;

            if (modeValue.type === 'VARIABLE_ALIAS') {
              const refPath = primitivePathMap.get(modeValue.id);
              if (refPath) {
                tokenValue = pathToReference(refPath);
              } else {
                const resolved = resolveValueFully(modeValue.id, aliasLookup, { brandModeId, breakpointModeId: mode.modeId }, new Set());
                tokenValue = resolved.value;
              }
            } else {
              tokenValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
            }

            const tokenObject = {
              $value: tokenValue
            };

            const tokenType = determineTokenType(variable.name, tokenValue, variable.resolvedType);
            if (tokenType) {
              tokenObject.$type = tokenType;
            }

            setNestedPath(tokens, pathArray, tokenObject);
          }
        });

        if (Object.keys(tokens).length > 0) {
          outputs[brandKey][`density-${modeName}`] = { semantic: tokens };
        }
      });

      console.log(`  ✅ ${brandKey}/density modes`);
    });
  }

  return outputs;
}

/**
 * Process Component Tokens - Layer 3
 * Output: tokens/components/{brand}/{component}.json
 * WITH references to semantic tokens
 */
function processComponentTokens(collections, aliasLookup, primitivePathMap) {
  console.log('\n🧩 Processing Component Tokens (Layer 3):\n');

  const outputs = {
    bild: {},
    sportbild: {},
    advertorial: {}
  };

  // Process Brand Token Mapping and Brand Color Mapping as component-level tokens
  const brandMappingCollections = [
    collections.find(c => c.id === COLLECTION_IDS.BRAND_TOKEN_MAPPING),
    collections.find(c => c.id === COLLECTION_IDS.BRAND_COLOR_MAPPING)
  ].filter(Boolean);

  Object.entries(BRANDS).forEach(([brandName, brandModeId]) => {
    const brandKey = brandName.toLowerCase();
    const componentTokens = {
      button: {},
      card: {},
      input: {},
      navigation: {},
      general: {}
    };

    brandMappingCollections.forEach(collection => {
      const mode = collection.modes.find(m => m.name === brandName);
      if (!mode) return;

      collection.variables.forEach(variable => {
        const modeValue = variable.valuesByMode[mode.modeId];

        if (modeValue !== undefined && modeValue !== null) {
          const pathArray = variable.name.split('/').filter(part => part && !part.startsWith('_'));
          const tokenNameLower = variable.name.toLowerCase();

          // Categorize tokens into components
          let componentKey = 'general';
          if (tokenNameLower.includes('button')) componentKey = 'button';
          else if (tokenNameLower.includes('card')) componentKey = 'card';
          else if (tokenNameLower.includes('input') || tokenNameLower.includes('field')) componentKey = 'input';
          else if (tokenNameLower.includes('nav') || tokenNameLower.includes('menu')) componentKey = 'navigation';

          let tokenValue;

          if (modeValue.type === 'VARIABLE_ALIAS') {
            const refPath = primitivePathMap.get(modeValue.id);
            if (refPath) {
              tokenValue = pathToReference(refPath);
            } else {
              // Try to create a semantic reference
              const refVariable = aliasLookup.get(modeValue.id);
              if (refVariable) {
                const semanticPath = tokenNameToPath(refVariable.name);
                tokenValue = pathToReference(`semantic.${semanticPath}`);
              } else {
                const resolved = resolveValueFully(modeValue.id, aliasLookup, { brandModeId }, new Set());
                tokenValue = resolved.value;
              }
            }
          } else {
            tokenValue = processDirectValue(modeValue, variable.resolvedType, variable.name);
          }

          const tokenObject = {
            $value: tokenValue
          };

          const tokenType = determineTokenType(variable.name, tokenValue, variable.resolvedType);
          if (tokenType) {
            tokenObject.$type = tokenType;
          }

          if (variable.description) {
            tokenObject.$description = variable.description;
          }

          setNestedPath(componentTokens[componentKey], pathArray, tokenObject);
        }
      });
    });

    // Only output components that have tokens
    Object.entries(componentTokens).forEach(([component, tokens]) => {
      if (Object.keys(tokens).length > 0) {
        outputs[brandKey][component] = tokens;
      }
    });

    console.log(`  ✅ ${brandKey} components`);
  });

  return outputs;
}

/**
 * Save Primitives
 */
function savePrimitives(primitiveOutputs) {
  console.log('\n💾 Saving Primitives:\n');

  const primitivesDir = path.join(OUTPUT_DIR, 'primitives');
  if (!fs.existsSync(primitivesDir)) {
    fs.mkdirSync(primitivesDir, { recursive: true });
  }

  Object.entries(primitiveOutputs).forEach(([name, tokens]) => {
    if (Object.keys(tokens).length > 0) {
      const filePath = path.join(primitivesDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
      console.log(`  ✅ primitives/${name}.json`);
    }
  });
}

/**
 * Save Semantic Tokens
 */
function saveSemanticTokens(semanticOutputs) {
  console.log('\n💾 Saving Semantic Tokens:\n');

  Object.entries(semanticOutputs).forEach(([brand, files]) => {
    const brandDir = path.join(OUTPUT_DIR, 'semantic', brand);
    if (!fs.existsSync(brandDir)) {
      fs.mkdirSync(brandDir, { recursive: true });
    }

    Object.entries(files).forEach(([fileName, tokens]) => {
      if (Object.keys(tokens).length > 0) {
        const filePath = path.join(brandDir, `${fileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
        console.log(`  ✅ semantic/${brand}/${fileName}.json`);
      }
    });
  });
}

/**
 * Save Component Tokens
 */
function saveComponentTokens(componentOutputs) {
  console.log('\n💾 Saving Component Tokens:\n');

  Object.entries(componentOutputs).forEach(([brand, components]) => {
    const brandDir = path.join(OUTPUT_DIR, 'components', brand);
    if (!fs.existsSync(brandDir)) {
      fs.mkdirSync(brandDir, { recursive: true });
    }

    Object.entries(components).forEach(([componentName, tokens]) => {
      if (Object.keys(tokens).length > 0) {
        const filePath = path.join(brandDir, `${componentName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf8');
        console.log(`  ✅ components/${brand}/${componentName}.json`);
      }
    });
  });
}

/**
 * Main function
 */
function main() {
  console.log('🚀 Starting Modular Token Preprocessing...\n');
  console.log('   Architecture: Primitives → Semantic → Components');
  console.log('   Output: CSS Variable References preserved\n');

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

  // Process Layer 1: Primitives
  const { outputs: primitiveOutputs, primitivePathMap } = processPrimitives(pluginData.collections, aliasLookup);

  // Process Layer 2: Semantic
  const semanticOutputs = processSemanticTokens(pluginData.collections, aliasLookup, primitivePathMap);

  // Process Layer 3: Components
  const componentOutputs = processComponentTokens(pluginData.collections, aliasLookup, primitivePathMap);

  // Save everything
  savePrimitives(primitiveOutputs);
  saveSemanticTokens(semanticOutputs);
  saveComponentTokens(componentOutputs);

  // Statistics
  console.log('\n✨ Modular Preprocessing completed!\n');
  console.log(`📊 Statistics:`);
  console.log(`   - Primitives: ${Object.keys(primitiveOutputs).filter(k => Object.keys(primitiveOutputs[k]).length > 0).length} files`);
  console.log(`   - Semantic: ${Object.values(semanticOutputs).reduce((sum, brand) => sum + Object.keys(brand).length, 0)} files`);
  console.log(`   - Components: ${Object.values(componentOutputs).reduce((sum, brand) => sum + Object.keys(brand).length, 0)} files`);
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
