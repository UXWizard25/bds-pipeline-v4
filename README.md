# BILD Design System - Modular Token Architecture

A modular design token pipeline that generates CSS with variable references (`var(--token)`) and a hierarchical output structure.

## Architecture Overview

This system uses a **3-layer token architecture** that preserves CSS variable references throughout the build process:

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: PRIMITIVES                                              │
│ (No references - resolved values only)                           │
│                                                                   │
│ tokens/primitives/                                                │
│ ├── colors.json      → --bild-red-bildred: #DD0000;              │
│ ├── spacing.json     → --space-primitive-space2x: 8px;           │
│ ├── typography.json  → --fontfamily-bild: "Gotham Condensed";    │
│ └── sizing.json      → --size-primitive-size24: 24px;            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: SEMANTIC                                                 │
│ (var() references to primitives)                                 │
│                                                                   │
│ tokens/semantic/{brand}/                                          │
│ ├── colors-light.json   → --semantic-text-primary:               │
│ │                           var(--bild-gray-bild015);            │
│ ├── colors-dark.json    → --semantic-text-primary:               │
│ │                           var(--bild-gray-bild093);            │
│ └── spacing-mobile.json → --semantic-spacing-md:                 │
│                             var(--space-primitive-space2x);      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: COMPONENTS                                               │
│ (var() references to semantic)                                   │
│                                                                   │
│ tokens/components/{brand}/                                        │
│ ├── button.json    → --component-button-bg:                      │
│ │                      var(--semantic-brand-primary);            │
│ ├── card.json      → --component-card-border:                    │
│ │                      var(--semantic-border-default);           │
│ └── navigation.json                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install @marioschmidt/design-tokens-modular
```

## Usage

### Option 1: Complete Bundle (Recommended)

Import everything at once:

```css
/* Light theme with all components */
@import '@marioschmidt/design-tokens-modular/bild/bundles/complete-light.css';

/* Dark theme with all components */
@import '@marioschmidt/design-tokens-modular/bild/bundles/complete-dark.css';
```

### Option 2: Essentials Bundle

Import only essential components (button, input, card):

```css
@import '@marioschmidt/design-tokens-modular/bild/bundles/essentials-light.css';
```

### Option 3: Individual Components

Import only what you need:

```css
/* Base primitives required */
@import '@marioschmidt/design-tokens-modular/shared/primitives/colors.css';
@import '@marioschmidt/design-tokens-modular/shared/primitives/spacing.css';

/* Brand-specific semantic tokens */
@import '@marioschmidt/design-tokens-modular/bild/core/colors-light.css';

/* Individual components */
@import '@marioschmidt/design-tokens-modular/bild/components/button.css';
```

### Option 4: Primitives Only (Custom Theming)

For building your own semantic layer:

```css
@import '@marioschmidt/design-tokens-modular/shared/primitives-bundle.css';
```

## Output Structure

```
dist/
├── shared/
│   ├── primitives/
│   │   ├── colors.css           # :root { --bild-red-bildred: #DD0000; }
│   │   ├── spacing.css          # :root { --space-primitive-space2x: 8px; }
│   │   ├── typography.css       # :root { --fontfamily-bild: "Gotham"; }
│   │   └── sizing.css           # :root { --size-primitive-size24: 24px; }
│   └── primitives-bundle.css    # @import all primitives
│
├── bild/
│   ├── core/
│   │   ├── colors-light.css     # @import + var() refs to primitives
│   │   ├── colors-dark.css
│   │   ├── spacing-mobile.css
│   │   ├── spacing-tablet.css
│   │   ├── spacing-desktop.css
│   │   ├── density-compact.css
│   │   ├── density-default.css
│   │   ├── density-spacious.css
│   │   └── _core-complete.css   # Bundle: all core
│   │
│   ├── components/
│   │   ├── button.css           # @import + var() refs to semantic
│   │   ├── input.css
│   │   ├── navigation.css
│   │   ├── general.css
│   │   └── _all-components.css  # Bundle: all components
│   │
│   ├── bundles/
│   │   ├── complete-light.css   # Shared + Core + Components
│   │   ├── complete-dark.css
│   │   ├── essentials-light.css # Essential components only
│   │   └── essentials-dark.css
│   │
│   └── index.css                # Main entry = complete-light.css
│
├── sportbild/                   # Same structure as bild/
├── advertorial/                 # Same structure as bild/
└── manifest.json                # Build metadata
```

## Token Hierarchy

| Layer | Source | Output | References |
|-------|--------|--------|------------|
| Primitives | `tokens/primitives/` | `dist/shared/primitives/` | None (resolved values) |
| Semantic | `tokens/semantic/{brand}/` | `dist/{brand}/core/` | `var(--primitive)` |
| Components | `tokens/components/{brand}/` | `dist/{brand}/components/` | `var(--semantic)` |

## Bundle Comparison

| Bundle | Size | Includes |
|--------|------|----------|
| `complete-light.css` | ~25KB | All tokens and components |
| `complete-dark.css` | ~25KB | All tokens, dark mode |
| `essentials-light.css` | ~10KB | Button, Input, Card |
| Individual component | ~2KB | Single component |
| Primitives only | ~5KB | Base design tokens |

## Available Brands

- **bild** - BILD main brand
- **sportbild** - Sport BILD brand
- **advertorial** - Advertorial content brand

## Development

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x

### Build Commands

```bash
# Install dependencies
npm install

# Full modular build
npm run build

# Clean and rebuild
npm run clean && npm run build

# Legacy build (original flat structure)
npm run build:legacy
```

### Project Structure

```
bds-pipeline-v4/
├── src/
│   └── design-tokens/
│       └── bild-design-system-raw-data.json  # Figma export
│
├── scripts/
│   ├── preprocess-modular-tokens.js          # Generates 3-layer tokens
│   └── build-tokens-modular.js               # Builds CSS with var() refs
│
├── tokens/                                    # Generated intermediate files
│   ├── primitives/                            # Layer 1
│   ├── semantic/{brand}/                      # Layer 2
│   └── components/{brand}/                    # Layer 3
│
├── dist/                                      # Final CSS output
│   ├── shared/primitives/
│   ├── {brand}/core/
│   ├── {brand}/components/
│   └── {brand}/bundles/
│
└── build-config/
    └── style-dictionary.config.js             # Custom transforms
```

### Token Processing Pipeline

```
Figma Export (raw data)
         ↓
    Preprocessing
    (preprocess-modular-tokens.js)
         ↓
    3-Layer Token Structure
    (tokens/primitives/, semantic/, components/)
         ↓
    CSS Build
    (build-tokens-modular.js)
         ↓
    Output with var() references
    (dist/)
```

## Key Features

- **CSS Variable References**: Semantic and component tokens reference primitives using `var(--token-name)`
- **@import Statements**: Each layer imports its dependencies
- **Hierarchical Bundles**: Pre-built bundles for common use cases
- **3 Brands**: BILD, SportBILD, Advertorial
- **Multiple Modes**: Light/Dark themes, Density variants, Breakpoint-specific values

## Example Output

### Primitives (Layer 1)
```css
/* dist/shared/primitives/colors.css */
:root {
  --bild-red-bildred: #DD0000;
  --bild-gray-bild015: #232629;
  --bild-neutral-bild100: #FFFFFF;
}
```

### Semantic (Layer 2)
```css
/* dist/bild/core/colors-light.css */
@import '../../shared/primitives/colors.css';

:root {
  --semantic-text-primary: var(--bild-gray-bild015);
  --semantic-brand-primary: var(--bild-red-bildred);
  --semantic-surface-default: var(--bild-neutral-bild100);
}
```

### Components (Layer 3)
```css
/* dist/bild/components/button.css */
@import '../core/colors-light.css';
@import '../../shared/primitives/spacing.css';

:root {
  --component-button-bg: var(--semantic-brand-primary);
  --component-button-text: var(--semantic-text-inverse);
  --component-button-padding: var(--space-primitive-space2x);
}
```

## Migration from v1

If migrating from the flat token structure:

1. Update import paths:
   ```css
   /* Before */
   @import '@marioschmidt/design-system-tokens/css/brands/bild/...';

   /* After */
   @import '@marioschmidt/design-tokens-modular/bild/bundles/complete-light.css';
   ```

2. Variable names may have changed - check the generated CSS files

3. The new structure uses `var()` references, which may affect build tools that parse CSS

## License

MIT

---

**Built for the BILD Design System**
