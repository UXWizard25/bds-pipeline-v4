#!/usr/bin/env node

/**
 * Modular Build Script for Style Dictionary Token Pipeline
 *
 * Generates a hierarchical CSS output with:
 * - Layer 1: Primitives (no var() references)
 * - Layer 2: Semantic (var() references to primitives)
 * - Layer 3: Components (var() references to semantic)
 *
 * Each layer includes @import statements for its dependencies
 */

const StyleDictionary = require('style-dictionary').default;
const fs = require('fs');
const path = require('path');

// Import custom config
const customConfig = require('../build-config/style-dictionary.config.js');

const TOKENS_DIR = path.join(__dirname, '../tokens');
const DIST_DIR = path.join(__dirname, '../dist');

const BRANDS = ['bild', 'sportbild', 'advertorial'];
const BREAKPOINTS = ['mobile', 'tablet', 'desktop'];
const COLOR_MODES = ['light', 'dark'];
const DENSITY_MODES = ['compact', 'default', 'spacious'];
const PLATFORMS = ['css', 'scss', 'js', 'json', 'ios', 'android', 'flutter'];

/**
 * Cleans the dist directory
 */
function cleanDist() {
  console.log('🧹 Cleaning dist directory...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

/**
 * Registers custom transforms, transform groups and formats
 */
function registerCustomConfig() {
  // Register transforms
  Object.entries(customConfig.transforms).forEach(([name, transform]) => {
    try {
      StyleDictionary.registerTransform(transform);
    } catch (e) {}
  });

  // Register transform groups
  if (customConfig.transformGroups) {
    Object.entries(customConfig.transformGroups).forEach(([name, transforms]) => {
      try {
        StyleDictionary.registerTransformGroup({ name, transforms });
      } catch (e) {}
    });
  }

  // Register formats
  Object.entries(customConfig.formats).forEach(([name, format]) => {
    try {
      StyleDictionary.registerFormat({ name, format });
    } catch (e) {}
  });

  // Register the new format for CSS with imports
  StyleDictionary.registerFormat({
    name: 'css/variables-with-imports',
    format: cssVariablesWithImportsFormat
  });

  // Register format for primitives (no references)
  StyleDictionary.registerFormat({
    name: 'css/primitives',
    format: cssPrimitivesFormat
  });
}

/**
 * Format: CSS Variables with @import statements
 */
function cssVariablesWithImportsFormat({ dictionary, options, file }) {
  const selector = options.selector || ':root';
  const imports = options.imports || [];
  const layer = options.layer || 'default';

  let output = generateHeader(file.destination, options.brand, layer);

  // Add imports
  if (imports.length > 0) {
    imports.forEach(importPath => {
      output += `@import '${importPath}';\n`;
    });
    output += '\n';
  }

  output += `${selector} {\n`;

  // Group tokens by category
  const grouped = groupTokensByCategory(dictionary.allTokens);

  Object.entries(grouped).forEach(([category, tokens]) => {
    if (tokens.length > 0) {
      output += `  /* ${category.toUpperCase()} */\n`;
      tokens.forEach(token => {
        const name = tokenPathToName(token.path);
        const value = formatTokenValue(token, options.outputReferences);

        if (token.$description || token.description) {
          output += `  /** ${token.$description || token.description} */\n`;
        }
        output += `  --${name}: ${value};\n`;
      });
      output += '\n';
    }
  });

  output += '}\n';
  return output;
}

/**
 * Format: CSS Primitives (no var() references)
 */
function cssPrimitivesFormat({ dictionary, options, file }) {
  const selector = options.selector || ':root';

  let output = generateHeader(file.destination, null, 'primitives');

  output += `${selector} {\n`;

  const grouped = groupTokensByCategory(dictionary.allTokens);

  Object.entries(grouped).forEach(([category, tokens]) => {
    if (tokens.length > 0) {
      output += `  /* ${category.toUpperCase()} */\n`;
      tokens.forEach(token => {
        const name = tokenPathToName(token.path);
        // Always use the resolved value, never var()
        // Style Dictionary v4 uses both value and $value
        const value = token.value || token.$value || token.original?.$value;

        if (token.$description || token.description || token.original?.$description) {
          output += `  /** ${token.$description || token.description || token.original?.$description} */\n`;
        }
        output += `  --${name}: ${value};\n`;
      });
      output += '\n';
    }
  });

  output += '}\n';
  return output;
}

/**
 * Generate file header
 */
function generateHeader(fileName, brand, layer) {
  const lines = [
    '/**',
    ' * BILD Design System - Modular Tokens',
    ' * ',
    ' * Do not edit directly, this file was auto-generated.',
    ' * ',
    ` * Layer: ${layer}`,
  ];

  if (brand) {
    lines.push(` * Brand: ${brand}`);
  }

  lines.push(' */\n\n');
  return lines.join('\n');
}

/**
 * Convert token path to CSS variable name
 */
function tokenPathToName(pathArray) {
  return pathArray
    .map(part => part.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'))
    .join('-')
    .replace(/^-|-$/g, '');
}

/**
 * Format token value - handles references
 */
function formatTokenValue(token, outputReferences) {
  const value = token.$value || token.value;

  // If the value is a reference like {path.to.token}
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    if (outputReferences) {
      // Convert to var() reference
      const refPath = value.slice(1, -1);
      const varName = refPath.replace(/\./g, '-').toLowerCase();
      return `var(--${varName})`;
    } else {
      // Return the resolved value
      return token.value;
    }
  }

  return token.value;
}

/**
 * Group tokens by their first path segment
 */
function groupTokensByCategory(tokens) {
  const grouped = {};

  tokens.forEach(token => {
    const category = token.path[0] || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(token);
  });

  return grouped;
}

/**
 * Step 1: Build Primitives (Layer 1)
 * Uses direct CSS generation - no var() references, resolved values only
 */
async function buildPrimitives() {
  console.log('\n📦 Building Primitives (Layer 1):\n');

  const primitivesDir = path.join(TOKENS_DIR, 'primitives');
  if (!fs.existsSync(primitivesDir)) {
    console.log('  ⚠️  No primitives/ directory found');
    return 0;
  }

  const outputDir = path.join(DIST_DIR, 'shared', 'primitives');
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(primitivesDir).filter(f => f.endsWith('.json'));
  let successful = 0;

  // Build individual primitive files
  for (const file of files) {
    const baseName = path.basename(file, '.json');
    const sourcePath = path.join(primitivesDir, file);
    const tokens = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    // CSS
    const cssContent = generatePrimitivesCSS(tokens, baseName);
    fs.writeFileSync(path.join(outputDir, `${baseName}.css`), cssContent);

    // All other platforms
    writeAllPlatformFormats(tokens, path.join(DIST_DIR, 'shared', 'primitives'), baseName, 'primitives');

    console.log(`  ✅ ${baseName} (css, scss, js, json, ios, android, flutter)`);
    successful++;
  }

  // Create bundle file
  await createPrimitivesBundle(files);

  return successful;
}

/**
 * Generate CSS for primitives (no var() references - resolved values only)
 */
function generatePrimitivesCSS(tokens, fileName) {
  let output = generateHeader(`${fileName}.css`, null, 'primitives');

  output += ':root {\n';
  output += flattenPrimitivesToCSS(tokens, '');
  output += '}\n';

  return output;
}

/**
 * Flatten primitives tokens to CSS variables (resolved values only)
 */
function flattenPrimitivesToCSS(obj, prefix) {
  let css = '';

  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}-${key}` : key;
    const cssName = currentPath.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        // This is a token - use the resolved value directly
        const tokenValue = value.$value;

        if (value.$description) {
          css += `  /** ${value.$description} */\n`;
        }
        css += `  --${cssName}: ${tokenValue};\n`;
      } else {
        // Nested object, recurse
        css += flattenPrimitivesToCSS(value, currentPath);
      }
    }
  });

  return css;
}

/**
 * Create primitives bundle
 */
async function createPrimitivesBundle(files) {
  const bundleDir = path.join(DIST_DIR, 'shared');
  if (!fs.existsSync(bundleDir)) {
    fs.mkdirSync(bundleDir, { recursive: true });
  }

  let bundleContent = generateHeader('primitives-bundle.css', null, 'primitives-bundle');
  bundleContent += '/* Bundle: All Primitives */\n\n';

  files.forEach(file => {
    const baseName = path.basename(file, '.json');
    bundleContent += `@import './primitives/${baseName}.css';\n`;
  });

  fs.writeFileSync(path.join(bundleDir, 'primitives-bundle.css'), bundleContent);
  console.log(`  ✅ primitives-bundle.css`);
}

/**
 * Step 2: Build Semantic Tokens (Layer 2)
 * Uses direct CSS generation to preserve var() references
 */
async function buildSemanticTokens() {
  console.log('\n🎨 Building Semantic Tokens (Layer 2):\n');

  let successful = 0;

  for (const brand of BRANDS) {
    const brandDir = path.join(TOKENS_DIR, 'semantic', brand);
    if (!fs.existsSync(brandDir)) continue;

    const coreDir = path.join(DIST_DIR, brand, 'core');
    fs.mkdirSync(coreDir, { recursive: true });

    const files = fs.readdirSync(brandDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const baseName = path.basename(file, '.json');
      const sourcePath = path.join(brandDir, file);
      const tokens = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

      // Determine imports based on file type
      const imports = [];
      if (baseName.includes('colors')) {
        imports.push('../../shared/primitives/colors.css');
      }
      if (baseName.includes('spacing') || baseName.includes('density')) {
        imports.push('../../shared/primitives/spacing.css');
        imports.push('../../shared/primitives/sizing.css');
      }

      // CSS
      const cssContent = generateSemanticCSS(tokens, imports, brand, baseName);
      fs.writeFileSync(path.join(coreDir, `${baseName}.css`), cssContent);

      // All other platforms
      writeAllPlatformFormats(tokens, path.join(DIST_DIR, brand, 'core'), baseName, 'semantic', brand);

      console.log(`  ✅ ${brand}/${baseName} (7 platforms)`);
      successful++;
    }
  }

  // Create core complete files for each brand
  for (const brand of BRANDS) {
    await createCoreCompleteBundle(brand);
  }

  return successful;
}

/**
 * Generate CSS for semantic/component tokens with var() references
 */
function generateSemanticCSS(tokens, imports, brand, fileName) {
  let output = generateHeader(`${fileName}.css`, brand, 'semantic');

  // Add imports
  if (imports.length > 0) {
    imports.forEach(importPath => {
      output += `@import '${importPath}';\n`;
    });
    output += '\n';
  }

  output += ':root {\n';
  output += flattenTokensToCSS(tokens, '');
  output += '}\n';

  return output;
}

/**
 * Flatten tokens object to CSS variables
 */
function flattenTokensToCSS(obj, prefix) {
  let css = '';

  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}-${key}` : key;
    const cssName = currentPath.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        // This is a token
        const tokenValue = value.$value;
        let cssValue;

        if (typeof tokenValue === 'string' && tokenValue.startsWith('{') && tokenValue.endsWith('}')) {
          // Convert reference to var()
          const refPath = tokenValue.slice(1, -1);
          const varName = refPath.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
          cssValue = `var(--${varName})`;
        } else {
          cssValue = tokenValue;
        }

        if (value.$description) {
          css += `  /** ${value.$description} */\n`;
        }
        css += `  --${cssName}: ${cssValue};\n`;
      } else {
        // Nested object, recurse
        css += flattenTokensToCSS(value, currentPath);
      }
    }
  });

  return css;
}

// ============================================
// MULTI-PLATFORM FORMAT GENERATORS
// ============================================

/**
 * Generate SCSS variables from tokens
 */
function generateSCSS(tokens, fileName, layer, brand = null) {
  let output = `// BILD Design System - Modular Tokens\n`;
  output += `// Do not edit directly, this file was auto-generated.\n`;
  output += `// Layer: ${layer}${brand ? `, Brand: ${brand}` : ''}\n\n`;
  output += flattenTokensToSCSS(tokens, '');
  return output;
}

function flattenTokensToSCSS(obj, prefix) {
  let scss = '';
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}-${key}` : key;
    const varName = currentPath.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        const tokenValue = value.$value;
        let scssValue;
        if (typeof tokenValue === 'string' && tokenValue.startsWith('{') && tokenValue.endsWith('}')) {
          const refPath = tokenValue.slice(1, -1);
          const refVarName = refPath.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
          scssValue = `$${refVarName}`;
        } else {
          scssValue = tokenValue;
        }
        scss += `$${varName}: ${scssValue};\n`;
      } else {
        scss += flattenTokensToSCSS(value, currentPath);
      }
    }
  });
  return scss;
}

/**
 * Generate JavaScript/TypeScript module from tokens
 */
function generateJS(tokens, fileName, layer, brand = null) {
  let output = `/**\n * BILD Design System - Modular Tokens\n`;
  output += ` * Do not edit directly, this file was auto-generated.\n`;
  output += ` * Layer: ${layer}${brand ? `, Brand: ${brand}` : ''}\n */\n\n`;

  const flatTokens = flattenTokensToJS(tokens, '');
  output += `export const tokens = ${JSON.stringify(flatTokens, null, 2)};\n\n`;
  output += `export default tokens;\n`;
  return output;
}

function flattenTokensToJS(obj, prefix) {
  const result = {};
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}-${key}` : key;
    const varName = currentPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        result[varName] = value.$value;
      } else {
        Object.assign(result, flattenTokensToJS(value, currentPath));
      }
    }
  });
  return result;
}

/**
 * Generate JSON export from tokens
 */
function generateJSON(tokens, fileName, layer, brand = null) {
  const flatTokens = flattenTokensToJSON(tokens, '');
  return JSON.stringify({
    metadata: {
      generated: new Date().toISOString(),
      layer,
      brand,
      fileName
    },
    tokens: flatTokens
  }, null, 2);
}

function flattenTokensToJSON(obj, prefix) {
  const result = {};
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        result[currentPath] = {
          value: value.$value,
          type: value.$type || 'unknown',
          description: value.$description || null
        };
      } else {
        Object.assign(result, flattenTokensToJSON(value, currentPath));
      }
    }
  });
  return result;
}

/**
 * Generate iOS Swift code from tokens
 */
function generateSwift(tokens, fileName, layer, brand = null) {
  const className = toPascalCase(fileName);
  let output = `// BILD Design System - Modular Tokens\n`;
  output += `// Do not edit directly, this file was auto-generated.\n`;
  output += `// Layer: ${layer}${brand ? `, Brand: ${brand}` : ''}\n\n`;
  output += `import UIKit\n\n`;
  output += `public struct ${className} {\n`;
  output += flattenTokensToSwift(tokens, '');
  output += `}\n`;
  return output;
}

function flattenTokensToSwift(obj, prefix) {
  let swift = '';
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}${toPascalCase(key)}` : toCamelCase(key);

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        const tokenValue = value.$value;
        const swiftValue = formatSwiftValue(tokenValue, value.$type);
        swift += `    public static let ${currentPath} = ${swiftValue}\n`;
      } else {
        swift += flattenTokensToSwift(value, currentPath);
      }
    }
  });
  return swift;
}

function formatSwiftValue(value, type) {
  if (typeof value === 'string') {
    if (value.startsWith('#')) {
      return `UIColor(hex: "${value}")`;
    }
    if (value.endsWith('px')) {
      return `CGFloat(${parseFloat(value)})`;
    }
    return `"${value}"`;
  }
  if (typeof value === 'number') {
    return `CGFloat(${value})`;
  }
  return `"${value}"`;
}

/**
 * Generate Android XML resources from tokens
 */
function generateAndroidXML(tokens, fileName, layer, brand = null) {
  let output = `<?xml version="1.0" encoding="utf-8"?>\n`;
  output += `<!-- BILD Design System - Modular Tokens -->\n`;
  output += `<!-- Do not edit directly, this file was auto-generated. -->\n`;
  output += `<!-- Layer: ${layer}${brand ? `, Brand: ${brand}` : ''} -->\n`;
  output += `<resources>\n`;
  output += flattenTokensToAndroid(tokens, '');
  output += `</resources>\n`;
  return output;
}

function flattenTokensToAndroid(obj, prefix) {
  let xml = '';
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}_${key}` : key;
    const resourceName = currentPath.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        const tokenValue = value.$value;
        const { resourceType, formattedValue } = formatAndroidValue(tokenValue, value.$type);
        xml += `    <${resourceType} name="${resourceName}">${formattedValue}</${resourceType}>\n`;
      } else {
        xml += flattenTokensToAndroid(value, currentPath);
      }
    }
  });
  return xml;
}

function formatAndroidValue(value, type) {
  if (typeof value === 'string') {
    if (value.startsWith('#')) {
      return { resourceType: 'color', formattedValue: value };
    }
    if (value.endsWith('px')) {
      return { resourceType: 'dimen', formattedValue: value.replace('px', 'dp') };
    }
    return { resourceType: 'string', formattedValue: value };
  }
  if (typeof value === 'number') {
    return { resourceType: 'dimen', formattedValue: `${value}dp` };
  }
  return { resourceType: 'string', formattedValue: String(value) };
}

/**
 * Generate Flutter Dart code from tokens
 */
function generateDart(tokens, fileName, layer, brand = null) {
  const className = toPascalCase(fileName);
  let output = `// BILD Design System - Modular Tokens\n`;
  output += `// Do not edit directly, this file was auto-generated.\n`;
  output += `// Layer: ${layer}${brand ? `, Brand: ${brand}` : ''}\n\n`;
  output += `import 'package:flutter/material.dart';\n\n`;
  output += `class ${className} {\n`;
  output += `  ${className}._();\n\n`;
  output += flattenTokensToDart(tokens, '');
  output += `}\n`;
  return output;
}

function flattenTokensToDart(obj, prefix) {
  let dart = '';
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = prefix ? `${prefix}${toPascalCase(key)}` : toCamelCase(key);

    if (value && typeof value === 'object') {
      if (value.$value !== undefined) {
        const tokenValue = value.$value;
        const dartValue = formatDartValue(tokenValue, value.$type);
        dart += `  static const ${dartValue.type} ${currentPath} = ${dartValue.value};\n`;
      } else {
        dart += flattenTokensToDart(value, currentPath);
      }
    }
  });
  return dart;
}

function formatDartValue(value, type) {
  if (typeof value === 'string') {
    if (value.startsWith('#')) {
      const hex = value.replace('#', '');
      const alpha = hex.length === 6 ? 'FF' : hex.slice(6, 8);
      const rgb = hex.length === 6 ? hex : hex.slice(0, 6);
      return { type: 'Color', value: `Color(0x${alpha}${rgb})` };
    }
    if (value.endsWith('px')) {
      return { type: 'double', value: parseFloat(value).toString() };
    }
    return { type: 'String', value: `'${value}'` };
  }
  if (typeof value === 'number') {
    return { type: 'double', value: `${value}.0` };
  }
  return { type: 'String', value: `'${value}'` };
}

// Helper functions for case conversion
function toPascalCase(str) {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
            .replace(/^(.)/, (_, c) => c.toUpperCase())
            .replace(/[^a-zA-Z0-9]/g, '');
}

function toCamelCase(str) {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
            .replace(/^(.)/, (_, c) => c.toLowerCase())
            .replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Write token file in all platform formats
 */
function writeAllPlatformFormats(tokens, outputDir, baseName, layer, brand = null) {
  // CSS (already handled separately with @import statements)

  // SCSS
  const scssDir = path.join(outputDir, 'scss');
  fs.mkdirSync(scssDir, { recursive: true });
  fs.writeFileSync(path.join(scssDir, `${baseName}.scss`), generateSCSS(tokens, baseName, layer, brand));

  // JavaScript
  const jsDir = path.join(outputDir, 'js');
  fs.mkdirSync(jsDir, { recursive: true });
  fs.writeFileSync(path.join(jsDir, `${baseName}.js`), generateJS(tokens, baseName, layer, brand));

  // JSON
  const jsonDir = path.join(outputDir, 'json');
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(path.join(jsonDir, `${baseName}.json`), generateJSON(tokens, baseName, layer, brand));

  // iOS Swift
  const iosDir = path.join(outputDir, 'ios');
  fs.mkdirSync(iosDir, { recursive: true });
  fs.writeFileSync(path.join(iosDir, `${toPascalCase(baseName)}.swift`), generateSwift(tokens, baseName, layer, brand));

  // Android XML
  const androidDir = path.join(outputDir, 'android');
  fs.mkdirSync(androidDir, { recursive: true });
  fs.writeFileSync(path.join(androidDir, `${baseName}.xml`), generateAndroidXML(tokens, baseName, layer, brand));

  // Flutter Dart
  const flutterDir = path.join(outputDir, 'flutter');
  fs.mkdirSync(flutterDir, { recursive: true });
  fs.writeFileSync(path.join(flutterDir, `${baseName}.dart`), generateDart(tokens, baseName, layer, brand));
}

// ============================================
// END MULTI-PLATFORM FORMAT GENERATORS
// ============================================

/**
 * Create core complete bundle for a brand
 */
async function createCoreCompleteBundle(brand) {
  const coreDir = path.join(DIST_DIR, brand, 'core');
  if (!fs.existsSync(coreDir)) {
    fs.mkdirSync(coreDir, { recursive: true });
  }

  const files = fs.existsSync(coreDir)
    ? fs.readdirSync(coreDir).filter(f => f.endsWith('.css') && !f.startsWith('_'))
    : [];

  let bundleContent = generateHeader('_core-complete.css', brand, 'core-bundle');
  bundleContent += '/* Bundle: All Core/Semantic Tokens */\n\n';

  files.forEach(file => {
    bundleContent += `@import './${file}';\n`;
  });

  fs.writeFileSync(path.join(coreDir, '_core-complete.css'), bundleContent);
  console.log(`  ✅ ${brand}/_core-complete.css`);
}

/**
 * Step 3: Build Component Tokens (Layer 3)
 * Uses direct CSS generation to preserve var() references
 */
async function buildComponentTokens() {
  console.log('\n🧩 Building Component Tokens (Layer 3):\n');

  let successful = 0;

  for (const brand of BRANDS) {
    const brandDir = path.join(TOKENS_DIR, 'components', brand);
    if (!fs.existsSync(brandDir)) continue;

    const componentsDir = path.join(DIST_DIR, brand, 'components');
    fs.mkdirSync(componentsDir, { recursive: true });

    const files = fs.readdirSync(brandDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const baseName = path.basename(file, '.json');
      const sourcePath = path.join(brandDir, file);
      const tokens = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

      // Component tokens import from core and primitives
      const imports = [
        '../core/colors-light.css',
        '../../shared/primitives/spacing.css'
      ];

      // CSS
      const cssContent = generateComponentCSS(tokens, imports, brand, baseName);
      fs.writeFileSync(path.join(componentsDir, `${baseName}.css`), cssContent);

      // All other platforms
      writeAllPlatformFormats(tokens, path.join(DIST_DIR, brand, 'components'), baseName, 'components', brand);

      console.log(`  ✅ ${brand}/${baseName} (7 platforms)`);
      successful++;
    }

    // Create all-components bundle
    await createComponentsBundle(brand);
  }

  return successful;
}

/**
 * Generate CSS for component tokens with var() references
 */
function generateComponentCSS(tokens, imports, brand, fileName) {
  let output = generateHeader(`${fileName}.css`, brand, 'components');

  // Add imports
  if (imports.length > 0) {
    imports.forEach(importPath => {
      output += `@import '${importPath}';\n`;
    });
    output += '\n';
  }

  output += ':root {\n';
  output += flattenTokensToCSS(tokens, '');
  output += '}\n';

  return output;
}

/**
 * Create components bundle for a brand
 */
async function createComponentsBundle(brand) {
  const componentsDir = path.join(DIST_DIR, brand, 'components');
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  const files = fs.existsSync(componentsDir)
    ? fs.readdirSync(componentsDir).filter(f => f.endsWith('.css') && !f.startsWith('_'))
    : [];

  let bundleContent = generateHeader('_all-components.css', brand, 'components-bundle');
  bundleContent += '/* Bundle: All Component Tokens */\n\n';

  files.forEach(file => {
    bundleContent += `@import './${file}';\n`;
  });

  fs.writeFileSync(path.join(componentsDir, '_all-components.css'), bundleContent);
  console.log(`  ✅ ${brand}/_all-components.css`);
}

/**
 * Step 4: Generate Bundles
 */
async function generateBundles() {
  console.log('\n📦 Generating Bundles:\n');

  for (const brand of BRANDS) {
    const bundlesDir = path.join(DIST_DIR, brand, 'bundles');
    fs.mkdirSync(bundlesDir, { recursive: true });

    // Essentials Light Bundle
    const essentialsLight = `/**
 * BILD Design System - Essentials Bundle (Light)
 * Brand: ${brand}
 *
 * Includes: Primitives + Core Colors + Essential Components
 */

@import '../../shared/primitives-bundle.css';
@import '../core/colors-light.css';
@import '../components/button.css';
@import '../components/input.css';
@import '../components/card.css';
`;
    fs.writeFileSync(path.join(bundlesDir, 'essentials-light.css'), essentialsLight);

    // Essentials Dark Bundle
    const essentialsDark = `/**
 * BILD Design System - Essentials Bundle (Dark)
 * Brand: ${brand}
 *
 * Includes: Primitives + Core Colors (Dark) + Essential Components
 */

@import '../../shared/primitives-bundle.css';
@import '../core/colors-dark.css';
@import '../components/button.css';
@import '../components/input.css';
@import '../components/card.css';
`;
    fs.writeFileSync(path.join(bundlesDir, 'essentials-dark.css'), essentialsDark);

    // Complete Light Bundle
    const completeLight = `/**
 * BILD Design System - Complete Bundle (Light)
 * Brand: ${brand}
 *
 * Includes: All Primitives + All Core + All Components
 */

@import '../../shared/primitives-bundle.css';
@import '../core/_core-complete.css';
@import '../components/_all-components.css';
`;
    fs.writeFileSync(path.join(bundlesDir, 'complete-light.css'), completeLight);

    // Complete Dark Bundle
    const completeDark = `/**
 * BILD Design System - Complete Bundle (Dark)
 * Brand: ${brand}
 *
 * Includes: All Primitives + All Core (Dark) + All Components
 */

@import '../../shared/primitives-bundle.css';
@import '../core/colors-dark.css';
@import '../core/_core-complete.css';
@import '../components/_all-components.css';
`;
    fs.writeFileSync(path.join(bundlesDir, 'complete-dark.css'), completeDark);

    // Create brand index.css
    const indexContent = `/**
 * BILD Design System - ${brand.toUpperCase()}
 * Main Entry Point
 */

@import './bundles/complete-light.css';
`;
    fs.writeFileSync(path.join(DIST_DIR, brand, 'index.css'), indexContent);

    console.log(`  ✅ ${brand}/bundles (essentials-light, essentials-dark, complete-light, complete-dark)`);
    console.log(`  ✅ ${brand}/index.css`);
  }
}

/**
 * Create Manifest
 */
function createManifest(stats) {
  console.log('\n📋 Creating Manifest...');

  const manifest = {
    generated: new Date().toISOString(),
    version: '0.1.0',
    architecture: 'modular',
    layers: ['primitives', 'semantic', 'components'],
    platforms: PLATFORMS,
    statistics: stats,
    structure: {
      brands: BRANDS,
      breakpoints: BREAKPOINTS,
      colorModes: COLOR_MODES,
      densityModes: DENSITY_MODES,
      outputPaths: {
        shared: 'shared/',
        brands: '{brand}/',
        bundles: '{brand}/bundles/',
        platforms: {
          css: '{layer}/*.css',
          scss: '{layer}/scss/*.scss',
          js: '{layer}/js/*.js',
          json: '{layer}/json/*.json',
          ios: '{layer}/ios/*.swift',
          android: '{layer}/android/*.xml',
          flutter: '{layer}/flutter/*.dart'
        }
      }
    },
    usage: {
      css: "import '@marioschmidt/design-tokens-modular/{brand}/bundles/complete-light.css'",
      scss: "@import '@marioschmidt/design-tokens-modular/{brand}/core/scss/colors-light.scss'",
      js: "import tokens from '@marioschmidt/design-tokens-modular/{brand}/core/js/colors-light.js'",
      json: "const tokens = require('@marioschmidt/design-tokens-modular/{brand}/core/json/colors-light.json')",
      ios: "// Add Colors.swift to your Xcode project",
      android: "<!-- Add colors.xml to res/values/ -->",
      flutter: "import 'package:design_tokens/colors.dart'"
    }
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log('  ✅ Manifest created: dist/manifest.json');
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 ============================================');
  console.log('   BILD Design System - Modular Build');
  console.log('   ============================================\n');
  console.log('   Architecture: Primitives → Semantic → Components');
  console.log('   Platforms: CSS, SCSS, JS, JSON, iOS, Android, Flutter');
  console.log('');

  // Clean dist
  cleanDist();

  // Register custom config
  registerCustomConfig();

  // Check if tokens directory exists
  if (!fs.existsSync(TOKENS_DIR)) {
    console.error('❌ Tokens directory not found!');
    console.error('   Run "npm run preprocess:modular" first.\n');
    process.exit(1);
  }

  const stats = {
    primitives: 0,
    semantic: 0,
    components: 0,
    bundles: 0
  };

  // Build each layer
  stats.primitives = await buildPrimitives();
  stats.semantic = await buildSemanticTokens();
  stats.components = await buildComponentTokens();
  await generateBundles();
  stats.bundles = BRANDS.length * 4; // 4 bundle types per brand

  // Create manifest
  createManifest(stats);

  // Summary
  console.log('\n✨ ============================================');
  console.log('   Modular Build completed!');
  console.log('   ============================================\n');

  console.log(`📊 Statistics:`);
  console.log(`   - Primitives: ${stats.primitives} files`);
  console.log(`   - Semantic: ${stats.semantic} files`);
  console.log(`   - Components: ${stats.components} files`);
  console.log(`   - Bundles: ${stats.bundles} files`);
  console.log(`   - Output Directory: dist/\n`);

  console.log(`📁 Structure:`);
  console.log(`   dist/`);
  console.log(`   ├── shared/primitives/`);
  console.log(`   │   ├── *.css                 (CSS Variables)`);
  console.log(`   │   ├── scss/*.scss           (SCSS Variables)`);
  console.log(`   │   ├── js/*.js               (ES Modules)`);
  console.log(`   │   ├── json/*.json           (JSON Export)`);
  console.log(`   │   ├── ios/*.swift           (Swift Structs)`);
  console.log(`   │   ├── android/*.xml         (Android Resources)`);
  console.log(`   │   └── flutter/*.dart        (Dart Classes)`);
  console.log(`   ├── {brand}/core/             (Semantic tokens - 7 platforms)`);
  console.log(`   ├── {brand}/components/       (Component tokens - 7 platforms)`);
  console.log(`   ├── {brand}/bundles/          (CSS bundles only)`);
  console.log(`   └── manifest.json`);
  console.log('');

  // Let Node.js exit naturally - no process.exit(0) needed
  // This ensures all file system operations are fully flushed
}

// Execute
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error during build:', error);
    process.exit(1);
  });
}

module.exports = { main };
