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

    const cssContent = generatePrimitivesCSS(tokens, baseName);
    fs.writeFileSync(path.join(outputDir, `${baseName}.css`), cssContent);
    console.log(`  ✅ ${baseName}.css`);
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

      const cssContent = generateSemanticCSS(tokens, imports, brand, baseName);
      fs.writeFileSync(path.join(coreDir, `${baseName}.css`), cssContent);
      console.log(`  ✅ ${brand}/${baseName}.css`);
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

      const cssContent = generateComponentCSS(tokens, imports, brand, baseName);
      fs.writeFileSync(path.join(componentsDir, `${baseName}.css`), cssContent);
      console.log(`  ✅ ${brand}/${baseName}.css`);
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
    statistics: stats,
    structure: {
      brands: BRANDS,
      breakpoints: BREAKPOINTS,
      colorModes: COLOR_MODES,
      outputPaths: {
        shared: 'shared/',
        brands: '{brand}/',
        bundles: '{brand}/bundles/'
      }
    },
    usage: {
      complete: "import '@marioschmidt/design-tokens-modular/{brand}/bundles/complete-light.css'",
      components: "import '@marioschmidt/design-tokens-modular/{brand}/components/button.css'",
      primitives: "import '@marioschmidt/design-tokens-modular/shared/primitives/colors.css'"
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
  console.log('   Output: CSS Variable References (var(--token))');
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
  console.log(`   ├── shared/`);
  console.log(`   │   ├── primitives/           (no var() - resolved values)`);
  console.log(`   │   └── primitives-bundle.css`);
  console.log(`   ├── {brand}/`);
  console.log(`   │   ├── core/                 (var() references to primitives)`);
  console.log(`   │   ├── components/           (var() references to semantic)`);
  console.log(`   │   ├── bundles/              (complete, essentials)`);
  console.log(`   │   └── index.css`);
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
