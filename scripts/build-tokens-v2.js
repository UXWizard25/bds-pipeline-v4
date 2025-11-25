#!/usr/bin/env node

/**
 * Build Script for Style Dictionary Token Pipeline v2
 *
 * This script orchestrates the build process for:
 * - Classic Tokens (variables)
 * - Composite Tokens (typography & effects)
 * - Brand × Breakpoint/ColorMode matrix
 */

const StyleDictionary = require('style-dictionary').default;
const fs = require('fs');
const path = require('path');

// Import custom config
const customConfig = require('../build-config/style-dictionary.config.js');

const TOKENS_DIR = path.join(__dirname, '../tokens');
const DIST_DIR = path.join(__dirname, '../dist');

// Brands and breakpoints
const BRANDS = ['bild', 'sportbild', 'advertorial'];
const BREAKPOINTS = ['xs', 'sm', 'md', 'lg'];
const COLOR_MODES = ['light', 'dark'];

// Size class mapping for native platforms
const SIZE_CLASS_MAPPING = {
  sm: 'compact',
  lg: 'regular'
};

/**
 * Creates platform configuration for standard tokens (Primitives, Brand-specific, etc.)
 */
function createStandardPlatformConfig(buildPath, fileName) {
  // Filter to exclude documentation-only tokens that cause collisions
  const tokenFilter = (token) => {
    // Exclude TextLabels tokens - these are documentation-only and cause name collisions
    if (token.path && token.path.includes('TextLabels')) {
      return false;
    }
    return true;
  };

  return {
    css: {
      transformGroup: 'custom/css',
      buildPath: `${buildPath}/`,
      files: [{
        destination: `${fileName}.css`,
        format: 'custom/css/variables',
        filter: tokenFilter,
        options: { outputReferences: false }
      }]
    },
    scss: {
      transformGroup: 'custom/scss',
      buildPath: `${DIST_DIR}/scss/${buildPath.replace(DIST_DIR + '/css/', '')}/`,
      files: [{
        destination: `${fileName}.scss`,
        format: 'custom/scss/variables',
        filter: tokenFilter,
        options: { outputReferences: false }
      }]
    },
    js: {
      transformGroup: 'custom/js',
      buildPath: `${DIST_DIR}/js/${buildPath.replace(DIST_DIR + '/css/', '')}/`,
      files: [{
        destination: `${fileName}.js`,
        format: 'custom/javascript/es6',
        filter: tokenFilter,
        options: { outputReferences: false }
      }]
    },
    json: {
      transformGroup: 'custom/js',
      buildPath: `${DIST_DIR}/json/${buildPath.replace(DIST_DIR + '/css/', '')}/`,
      files: [{
        destination: `${fileName}.json`,
        format: 'json',
        filter: tokenFilter,
        options: { outputReferences: false }
      }]
    },
    ios: {
      transformGroup: 'custom/ios-swift',
      buildPath: `${DIST_DIR}/ios/${buildPath.replace(DIST_DIR + '/css/', '')}/`,
      files: [{
        destination: `${fileName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}.swift`,
        format: 'ios-swift/class',
        filter: tokenFilter,
        options: {
          outputReferences: false,
          className: fileName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
        }
      }]
    },
    android: {
      transformGroup: 'custom/android',
      buildPath: `${DIST_DIR}/android/res/values/${buildPath.replace(DIST_DIR + '/css/', '')}/`,
      files: [{
        destination: `${fileName}.xml`,
        format: 'android/resources',
        filter: tokenFilter,
        options: { outputReferences: false }
      }]
    },
    flutter: {
      transformGroup: 'custom/flutter',
      buildPath: `${DIST_DIR}/flutter/${buildPath.replace(DIST_DIR + '/css/', '')}/`,
      files: [{
        destination: `${fileName}.dart`,
        format: 'flutter/class',
        filter: tokenFilter,
        options: {
          outputReferences: false,
          className: fileName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
        }
      }]
    }
  };
}

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
    } catch (e) {
      // Already registered
    }
  });

  // Register transform groups
  if (customConfig.transformGroups) {
    Object.entries(customConfig.transformGroups).forEach(([name, transforms]) => {
      try {
        StyleDictionary.registerTransformGroup({
          name: name,
          transforms: transforms
        });
      } catch (e) {
        // Already registered
      }
    });
  }

  // Register formats
  Object.entries(customConfig.formats).forEach(([name, format]) => {
    try {
      StyleDictionary.registerFormat({
        name: name,
        format: format
      });
    } catch (e) {
      // Already registered
    }
  });
}

/**
 * Creates Style Dictionary config for Typography tokens
 */
function createTypographyConfig(brand, breakpoint) {
  const sourceFile = path.join(TOKENS_DIR, 'brands', brand, 'semantic', 'typography', `typography-${breakpoint}.json`);

  if (!fs.existsSync(sourceFile)) {
    return null;
  }

  const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
  const fileName = `typography-${breakpoint}`;

  return {
    source: [sourceFile],
    platforms: {
      // CSS: Custom format for Typography classes
      css: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/css/brands/${brand}/semantic/typography/`,
        files: [{
          destination: `${fileName}.css`,
          format: 'css/typography-classes',
          options: {
            brand: brandName,
            breakpoint
          }
        }]
      },

      // JS: Custom Typography format
      js: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/js/brands/${brand}/semantic/typography/`,
        files: [{
          destination: `${fileName}.js`,
          format: 'javascript/typography',
          options: {
            brand: brandName,
            breakpoint
          }
        }]
      },

      // JSON: Standard JSON
      json: {
        transformGroup: 'js',
        buildPath: `${DIST_DIR}/json/brands/${brand}/semantic/typography/`,
        files: [{ destination: `${fileName}.json`, format: 'json', options: { outputReferences: false } }]
      },

      // Flutter: Custom Typography format
      flutter: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/flutter/brands/${brand}/semantic/typography/`,
        files: [{
          destination: `${fileName}.dart`,
          format: 'flutter/typography',
          options: {
            brand: brandName,
            breakpoint,
            sizeClass: SIZE_CLASS_MAPPING[breakpoint] || breakpoint
          }
        }]
      },

      // SCSS: Custom Typography format
      scss: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/scss/brands/${brand}/semantic/typography/`,
        files: [{
          destination: `${fileName}.scss`,
          format: 'scss/typography',
          options: {
            brand: brandName,
            breakpoint
          }
        }]
      },

      // iOS: Only compact (sm) and regular (lg) with custom format
      ...(SIZE_CLASS_MAPPING[breakpoint] ? {
        ios: {
          transforms: ['attribute/cti'],
          buildPath: `${DIST_DIR}/ios/brands/${brand}/sizeclass-${SIZE_CLASS_MAPPING[breakpoint]}/`,
          files: [{
            destination: 'Typography.swift',
            format: 'ios-swift/typography',
            options: {
              brand: brandName,
              breakpoint,
              sizeClass: SIZE_CLASS_MAPPING[breakpoint]
            }
          }]
        }
      } : {}),

      // Android: Only compact (sm) and regular (lg) with custom format
      ...(SIZE_CLASS_MAPPING[breakpoint] ? {
        android: {
          transforms: ['attribute/cti'],
          buildPath: `${DIST_DIR}/android/brands/${brand}/sizeclass-${SIZE_CLASS_MAPPING[breakpoint]}/`,
          files: [{
            destination: 'typography_styles.xml',
            format: 'android/typography-styles',
            options: {
              brand: brandName,
              breakpoint
            }
          }]
        }
      } : {})
    }
  };
}

/**
 * Creates Style Dictionary config for Effect tokens
 */
function createEffectConfig(brand, colorMode) {
  const sourceFile = path.join(TOKENS_DIR, 'brands', brand, 'semantic', 'effects', `effects-${colorMode}.json`);

  if (!fs.existsSync(sourceFile)) {
    return null;
  }

  const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
  const fileName = `effects-${colorMode}`;

  return {
    source: [sourceFile],
    platforms: {
      // CSS: Custom format for Effect classes
      css: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/css/brands/${brand}/semantic/effects/`,
        files: [{
          destination: `${fileName}.css`,
          format: 'css/effect-classes',
          options: {
            brand: brandName,
            colorMode
          }
        }]
      },

      // JS: Custom Effects format
      js: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/js/brands/${brand}/semantic/effects/`,
        files: [{
          destination: `${fileName}.js`,
          format: 'javascript/effects',
          options: {
            brand: brandName,
            colorMode
          }
        }]
      },

      // JSON: Standard JSON
      json: {
        transformGroup: 'js',
        buildPath: `${DIST_DIR}/json/brands/${brand}/semantic/effects/`,
        files: [{ destination: `${fileName}.json`, format: 'json', options: { outputReferences: false } }]
      },

      // iOS: Custom Swift Effects format
      ios: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/ios/brands/${brand}/semantic/effects/`,
        files: [{
          destination: `${fileName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}.swift`,
          format: 'ios-swift/effects',
          options: {
            brand: brandName,
            colorMode
          }
        }]
      },

      // Flutter: Custom Effects format
      flutter: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/flutter/brands/${brand}/semantic/effects/`,
        files: [{
          destination: `${fileName}.dart`,
          format: 'flutter/effects',
          options: {
            brand: brandName,
            colorMode
          }
        }]
      },

      // SCSS: Custom Effects format
      scss: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/scss/brands/${brand}/semantic/effects/`,
        files: [{
          destination: `${fileName}.scss`,
          format: 'scss/effects',
          options: {
            brand: brandName,
            colorMode
          }
        }]
      },

      // Android: Custom Effects format
      android: {
        transforms: ['attribute/cti'],
        buildPath: `${DIST_DIR}/android/brands/${brand}/semantic/effects/`,
        files: [{
          destination: `${fileName}.xml`,
          format: 'android/effects',
          options: {
            brand: brandName,
            colorMode
          }
        }]
      }
    }
  };
}

/**
 * Builds Shared Primitive Tokens
 */
async function buildSharedPrimitives() {
  console.log('\n📦 Building Shared Primitives:\n');

  const sharedDir = path.join(TOKENS_DIR, 'shared');
  if (!fs.existsSync(sharedDir)) {
    console.log('  ⚠️  No shared/ directory found');
    return { total: 0, successful: 0 };
  }

  const files = fs.readdirSync(sharedDir).filter(f => f.endsWith('.json'));
  let successful = 0;

  for (const file of files) {
    const baseName = path.basename(file, '.json');
    const sourcePath = path.join(sharedDir, file);

    const config = {
      source: [sourcePath],
      platforms: createStandardPlatformConfig(`${DIST_DIR}/css/shared`, baseName)
    };

    try {
      const sd = new StyleDictionary(config);
      await sd.buildAllPlatforms();
      console.log(`  ✅ ${baseName}`);
      successful++;
    } catch (error) {
      console.error(`  ❌ ${baseName}: ${error.message}`);
    }
  }

  return { total: files.length, successful };
}

/**
 * Builds Brand-specific Token Collections
 */
async function buildBrandSpecificTokens() {
  console.log('\n🏷️  Building Brand-specific Tokens:\n');

  let totalBuilds = 0;
  let successfulBuilds = 0;

  for (const brand of BRANDS) {
    console.log(`  📦 ${brand}:`);

    const brandDir = path.join(TOKENS_DIR, 'brands', brand);
    if (!fs.existsSync(brandDir)) continue;

    // Density
    const densityDir = path.join(brandDir, 'density');
    if (fs.existsSync(densityDir)) {
      const files = fs.readdirSync(densityDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const fileName = path.basename(file, '.json');
        const config = {
          source: [path.join(densityDir, file)],
          platforms: createStandardPlatformConfig(`${DIST_DIR}/css/brands/${brand}/density`, fileName)
        };

        try {
          totalBuilds++;
          await new StyleDictionary(config).buildAllPlatforms();
          successfulBuilds++;
        } catch (error) {
          console.error(`     ❌ density/${fileName}: ${error.message}`);
        }
      }
      console.log(`     ✅ density (${files.length} modes)`);
    }

    // Breakpoints
    const breakpointsDir = path.join(brandDir, 'breakpoints');
    if (fs.existsSync(breakpointsDir)) {
      const files = fs.readdirSync(breakpointsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const fileName = path.basename(file, '.json');
        const config = {
          source: [path.join(breakpointsDir, file)],
          platforms: createStandardPlatformConfig(`${DIST_DIR}/css/brands/${brand}/semantic/breakpoints`, fileName)
        };

        try {
          totalBuilds++;
          await new StyleDictionary(config).buildAllPlatforms();
          successfulBuilds++;
        } catch (error) {
          console.error(`     ❌ breakpoints/${fileName}: ${error.message}`);
        }
      }
      console.log(`     ✅ breakpoints (${files.length} modes)`);
    }

    // Color
    const colorDir = path.join(brandDir, 'color');
    if (fs.existsSync(colorDir)) {
      const files = fs.readdirSync(colorDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const fileName = path.basename(file, '.json');
        const config = {
          source: [path.join(colorDir, file)],
          platforms: createStandardPlatformConfig(`${DIST_DIR}/css/brands/${brand}/semantic/color`, fileName)
        };

        try {
          totalBuilds++;
          await new StyleDictionary(config).buildAllPlatforms();
          successfulBuilds++;
        } catch (error) {
          console.error(`     ❌ color/${fileName}: ${error.message}`);
        }
      }
      console.log(`     ✅ color (${files.length} modes)`);
    }

    // Overrides
    const overridesDir = path.join(brandDir, 'overrides');
    if (fs.existsSync(overridesDir)) {
      const files = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const fileName = path.basename(file, '.json');
        const config = {
          source: [path.join(overridesDir, file)],
          platforms: createStandardPlatformConfig(`${DIST_DIR}/css/brands/${brand}/overrides`, fileName)
        };

        try {
          totalBuilds++;
          await new StyleDictionary(config).buildAllPlatforms();
          successfulBuilds++;
        } catch (error) {
          console.error(`     ❌ overrides/${fileName}: ${error.message}`);
        }
      }
      console.log(`     ✅ overrides (${files.length} collections)`);
    }
  }

  return { totalBuilds, successfulBuilds };
}

/**
 * Builds Typography Tokens (brand-specific)
 */
async function buildTypographyTokens() {
  console.log('\n✍️  Building Typography Tokens:\n');

  let totalBuilds = 0;
  let successfulBuilds = 0;

  for (const brand of BRANDS) {
    console.log(`  🏷️  ${brand}:`);

    for (const breakpoint of BREAKPOINTS) {
      const config = createTypographyConfig(brand, breakpoint);

      if (!config) {
        console.log(`     ⚠️  No data for ${brand}-${breakpoint}`);
        continue;
      }

      try {
        totalBuilds++;
        const sd = new StyleDictionary(config);
        await sd.buildAllPlatforms();
        successfulBuilds++;

        const platforms = Object.keys(config.platforms).join(', ');
        console.log(`     ✅ ${brand}-${breakpoint} (${platforms})`);
      } catch (error) {
        console.error(`     ❌ Fehler bei ${brand}-${breakpoint}:`);
        console.error(`        ${error.message}`);
      }
    }
  }

  return { totalBuilds, successfulBuilds };
}

/**
 * Builds Effect Tokens
 */
async function buildEffectTokens() {
  console.log('\n🎨 Building Effect Tokens:\n');

  let totalBuilds = 0;
  let successfulBuilds = 0;

  for (const brand of BRANDS) {
    console.log(`  🏷️  Brand: ${brand}`);

    for (const colorMode of COLOR_MODES) {
      const config = createEffectConfig(brand, colorMode);

      if (!config) {
        console.log(`     ⚠️  No data for ${brand}-${colorMode}`);
        continue;
      }

      try {
        totalBuilds++;
        const sd = new StyleDictionary(config);
        await sd.buildAllPlatforms();
        successfulBuilds++;

        console.log(`     ✅ ${brand}-${colorMode}`);
      } catch (error) {
        console.error(`     ❌ Fehler bei ${brand}-${colorMode}:`);
        console.error(`        ${error.message}`);
      }
    }
  }

  return { totalBuilds, successfulBuilds };
}

/**
 * Creates Manifest
 */
function createManifest(stats) {
  console.log('\n📋 Creating Manifest...');

  const manifest = {
    generated: new Date().toISOString(),
    version: '2.0.0',
    statistics: {
      sharedPrimitives: stats.sharedPrimitives || { total: 0, successful: 0 },
      brandSpecific: stats.brandSpecific || { totalBuilds: 0, successfulBuilds: 0 },
      typographyTokens: stats.typographyTokens || { totalBuilds: 0, successfulBuilds: 0 },
      effectTokens: stats.effectTokens || { totalBuilds: 0, successfulBuilds: 0 }
    },
    structure: {
      brands: BRANDS,
      breakpoints: BREAKPOINTS,
      colorModes: COLOR_MODES,
      sizeClasses: Object.values(SIZE_CLASS_MAPPING),
      outputPaths: {
        css: {
          shared: 'css/shared/',
          brands: 'css/brands/{brand}/'
        },
        scss: {
          shared: 'scss/shared/',
          brands: 'scss/brands/{brand}/'
        },
        js: {
          shared: 'js/shared/',
          brands: 'js/brands/{brand}/'
        },
        json: {
          shared: 'json/shared/',
          brands: 'json/brands/{brand}/'
        },
        ios: {
          shared: 'ios/shared/',
          brands: 'ios/brands/{brand}/',
          sizeClasses: 'ios/brands/{brand}/sizeclass-{compact|regular}/'
        },
        android: {
          shared: 'android/res/values/shared/',
          brands: 'android/res/values/brands/{brand}/',
          sizeClasses: 'android/brands/{brand}/sizeclass-{compact|regular}/'
        },
        flutter: {
          shared: 'flutter/shared/',
          brands: 'flutter/brands/{brand}/'
        }
      }
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
  console.log('   BILD Design System - Token Build v2');
  console.log('   ============================================\n');

  // Clean dist
  cleanDist();

  // Register custom config
  registerCustomConfig();

  // Check if tokens directory exists
  if (!fs.existsSync(TOKENS_DIR)) {
    console.error('❌ Tokens directory not found!');
    console.error('   Run "npm run preprocess" first.\n');
    process.exit(1);
  }

  const stats = {};

  // Build shared primitives
  stats.sharedPrimitives = await buildSharedPrimitives();

  // Build brand-specific tokens
  stats.brandSpecific = await buildBrandSpecificTokens();

  // Build typography tokens
  stats.typographyTokens = await buildTypographyTokens();

  // Build effect tokens
  stats.effectTokens = await buildEffectTokens();

  // Create manifest
  createManifest(stats);

  // Summary
  console.log('\n✨ ============================================');
  console.log('   Build completed!');
  console.log('   ============================================\n');

  // Calculate total statistics for GitHub Actions
  const totalBuilds = stats.sharedPrimitives.total + stats.brandSpecific.totalBuilds +
                      stats.typographyTokens.totalBuilds + stats.effectTokens.totalBuilds;
  const successfulBuilds = stats.sharedPrimitives.successful + stats.brandSpecific.successfulBuilds +
                           stats.typographyTokens.successfulBuilds + stats.effectTokens.successfulBuilds;

  console.log(`📊 Statistiken:`);
  console.log(`   - Shared Primitives: ${stats.sharedPrimitives.successful}/${stats.sharedPrimitives.total}`);
  console.log(`   - Brand-spezifische Tokens: ${stats.brandSpecific.successfulBuilds}/${stats.brandSpecific.totalBuilds}`);
  console.log(`   - Typography Builds: ${stats.typographyTokens.successfulBuilds}/${stats.typographyTokens.totalBuilds}`);
  console.log(`   - Effect Builds: ${stats.effectTokens.successfulBuilds}/${stats.effectTokens.totalBuilds}`);
  console.log(`   - Builds erfolgreich: ${successfulBuilds}/${totalBuilds}`);
  console.log(`   - Output-Verzeichnis: dist/\n`);

  console.log(`📁 Struktur:`);
  console.log(`   dist/`);
  console.log(`   ├── css/        (CSS custom properties)`);
  console.log(`   ├── scss/       (SCSS variables)`);
  console.log(`   ├── js/         (JavaScript ES6)`);
  console.log(`   ├── json/       (JSON)`);
  console.log(`   ├── ios/        (Swift)`);
  console.log(`   ├── android/    (Android XML resources)`);
  console.log(`   └── flutter/    (Dart classes)`);
  console.log(``);
  console.log(`   Each platform contains:`);
  console.log(`   - shared/              (primitives)`);
  console.log(`   - brands/{brand}/`);
  console.log(`       ├── density/       (3 modes)`);
  console.log(`       ├── overrides/     (brand mappings)`);
  console.log(`       └── semantic/`);
  console.log(`           ├── breakpoints/  (4 modes)`);
  console.log(`           ├── color/        (2 modes)`);
  console.log(`           ├── effects/      (2 color modes)`);
  console.log(`           └── typography/   (4 breakpoints)`);
  console.log('');

  // Explizit success exit code
  process.exit(0);
}

// Führe Script aus
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fehler beim Build:', error);
    process.exit(1);
  });
}

module.exports = { main };
