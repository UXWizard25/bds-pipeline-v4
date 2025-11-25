# 🎨 BILD Design System - Token Pipeline

A comprehensive multi-platform token transformation pipeline based on **Style Dictionary v4** for the BILD Design System. This pipeline transforms design tokens from a custom Figma plugin export into consumable formats across 7 platforms, 3 brands, and multiple modes.

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🏗️ Token Architecture](#️-token-architecture)
- [📁 Output Structure](#-output-structure)
- [🎨 Platform Usage](#-platform-usage)
- [🔧 Development](#-development)
- [🔄 CI/CD Integration](#-cicd-integration)
- [🧪 Testing & Verification](#-testing--verification)
- [🆘 Troubleshooting](#-troubleshooting)
- [📊 Technical Details](#-technical-details)
- [📝 Changelog](#-changelog)
- [🔗 Resources](#-resources)

---

## 🎯 Overview

This token pipeline processes the multi-layer, multi-brand architecture of the BILD Design System with full support for:
- **3 Brands**: BILD, SportBILD, Advertorial
- **7 Platforms**: CSS, SCSS, JavaScript, JSON, iOS (Swift), Android (XML), Flutter (Dart)
- **Multiple Modes**: Density (3), Breakpoints (4), Color Modes (2)
- **Composite Tokens**: Typography, Effects

```
┌─────────────────────────────────────────────┐
│ Figma Plugin Export (src/design-tokens/)   │
│ • bild-design-system-raw-data.json          │
│ • Contains aliases and Figma structure      │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Preprocessing (scripts/preprocess-*.js)    │
│ • Complete alias resolution                 │
│ • Context-aware: Brand × Breakpoint × Mode  │
│ • FontWeight bug fixes ("700px" → 700)      │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Intermediate Format (tokens/)              │
│ • 68 JSON files (Style Dictionary format)   │
│ • Tracked in Git (preprocessed source)      │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Style Dictionary v4 (scripts/build-*.js)   │
│ • Multi-platform output (7 formats)         │
│ • Brand-specific builds (3 brands)          │
│ • Composite tokens (Typography, Effects)    │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Build Artifacts (dist/)                    │
│ • NOT tracked in Git                        │
│ • Generated locally or in CI                │
│ • Available as GitHub Actions artifacts     │
│ • 52/52 successful builds (353 files)       │
└─────────────────────────────────────────────┘
```

---

## ✨ Features

### Pipeline Features

✅ **Complete Alias Resolution**: All `VARIABLE_ALIAS` references resolved to final values in preprocessing
✅ **7 Platform Support**: CSS, SCSS, JavaScript, JSON, iOS Swift, Android XML, Flutter Dart
✅ **Multi-Brand Architecture**: BILD, SportBILD, Advertorial with brand-specific token resolution
✅ **Composite Tokens**: Typography (12 outputs: 3 brands × 4 breakpoints), Effects (6 outputs: 3 brands × 2 color modes)
✅ **Context-Aware Resolution**: Brand × Breakpoint × ColorMode matrix processing
✅ **Advertorial Special Handling**: No color/ folder (no BrandColorMapping)
✅ **Size Class Mapping**: iOS/Android only generate compact (sm) and regular (lg) with sizeclass terminology
✅ **Zero Reference Errors**: All aliases fully resolved before Style Dictionary

### Build Statistics

- **52/52 builds successful** across all platforms
- 4 Shared Primitives (Color, Font, Size, Space)
- 30 Brand-specific Tokens (3 brands × 10 token sets)
- 12 Typography Builds (3 brands × 4 breakpoints)
- 6 Effect Builds (3 brands × 2 color modes)

---

## 📦 Installation

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x

### Setup

```bash
# Clone repository
git clone https://github.com/UXWizard25/vv-token-test-v3.git
cd vv-token-test-v3

# Install dependencies
npm install

# Build tokens
npm run build
```

---

## 🚀 Quick Start

### Build Tokens

```bash
# Full build (preprocessing + build)
npm run build

# Or run steps separately:
npm run preprocess    # Custom Plugin JSON → Style Dictionary format
npm run build:tokens  # Style Dictionary → Platform outputs
```

### Watch Mode (Development)

```bash
npm run watch
```

### Clean Generated Files

```bash
npm run clean
```

---

## 🏗️ Token Architecture

### Multi-Layer Structure

The Design System is organized in four layers:

#### 1️⃣ **Shared Primitives** - Foundation Tokens

Base tokens without brand context (single mode: "Value").

**Collections:**
- `_FontPrimitive` → Font families, weights, letter spacing
- `_ColorPrimitive` → Base color palette
- `_SizePrimitive` → Base size scale
- `_SpacePrimitive` → Base spacing scale

**Output:**
```
dist/{platform}/shared/
  ├── fontprimitive.*
  ├── colorprimitive.*
  ├── sizeprimitive.*
  └── spaceprimitive.*
```

#### 2️⃣ **Brand-Specific Tokens** - Density & Overrides

Brand context tokens with multiple modes.

**Density Collection** (3 modes):
- compact, default, spacious

**Brand Overrides** (3 brands):
- BrandTokenMapping: BILD, SportBILD, Advertorial
- BrandColorMapping: BILD, SportBILD (⚠️ Advertorial has no BrandColorMapping)

**Output:**
```
dist/{platform}/brands/{brand}/
  ├── density/
  │   ├── density-compact.*
  │   ├── density-default.*
  │   └── density-spacious.*
  └── overrides/
      ├── brandtokenmapping.*
      └── brandcolormapping.*  # Only BILD & SportBILD
```

#### 3️⃣ **Semantic Tokens** - Brand × Mode Matrix

Context-specific tokens with brand and mode variations.

**BreakpointMode** (4 modes per brand):
- xs (320px), sm (390px, compact), md (600px), lg (1024px, regular)

**ColorMode** (2 modes per brand):
- light, dark

**Output:**
```
dist/{platform}/brands/{brand}/semantic/
  ├── breakpoints/
  │   ├── breakpoint-xs-320px.*
  │   ├── breakpoint-sm-390px-compact.*
  │   ├── breakpoint-md-600px.*
  │   └── breakpoint-lg-1024px-regular.*
  └── color/
      ├── colormode-light.*
      └── colormode-dark.*
```

⚠️ **Note**: Advertorial has **no color/ folder** (no BrandColorMapping collection).

#### 4️⃣ **Composite Tokens** - Typography & Effects

Structured tokens with CSS classes for ready-to-use styles.

**Typography** (4 breakpoints per brand):
- 3 brands × 4 breakpoints = **12 outputs**
- CSS: Ready-to-use classes (`.headline1`, `.body1`, etc.)
- iOS/Android: Only compact (sm) and regular (lg) with sizeclass terminology

**Effects** (2 color modes per brand):
- 3 brands × 2 color modes = **6 outputs**
- CSS: Shadow and blur effect classes
- All platforms: Effect token objects

**Output:**
```
dist/{platform}/brands/{brand}/semantic/
  ├── typography/
  │   ├── typography-xs.*
  │   ├── typography-sm.*
  │   ├── typography-md.*
  │   └── typography-lg.*
  └── effects/
      ├── effects-light.*
      └── effects-dark.*
```

**iOS/Android Size Classes:**
```
dist/ios/brands/{brand}/
  ├── sizeclass-compact/    # sm breakpoint
  │   └── Typography.swift
  └── sizeclass-regular/    # lg breakpoint
      └── Typography.swift

dist/android/brands/{brand}/
  ├── sizeclass-compact/    # sm breakpoint
  │   └── typography_styles.xml
  └── sizeclass-regular/    # lg breakpoint
      └── typography_styles.xml
```

---

## 📁 Output Structure

### Platform Overview

```
dist/
├── manifest.json                    # Build metadata
│
├── css/                            # CSS Custom Properties
│   ├── shared/                     # Primitives (no brand context)
│   └── brands/
│       ├── bild/
│       ├── sportbild/
│       └── advertorial/
│
├── scss/                           # SCSS Variables (same structure)
├── js/                             # JavaScript ES6 Modules (same structure)
├── json/                          # JSON Data (same structure)
│
├── ios/                            # Swift Classes
│   ├── shared/
│   └── brands/{brand}/
│       ├── density/
│       ├── overrides/
│       ├── semantic/
│       ├── sizeclass-compact/     # sm only
│       └── sizeclass-regular/     # lg only
│
├── android/                        # Android XML Resources
│   ├── res/values/shared/
│   └── brands/{brand}/
│       └── sizeclass-{compact|regular}/
│
└── flutter/                        # Flutter Dart Classes (same structure as CSS)
```

### Brand Directory Structure

Each brand contains:

```
brands/{brand}/
├── density/                        # 3 files (compact, default, spacious)
├── overrides/                      # 1-2 files (brandtokenmapping, brandcolormapping*)
└── semantic/
    ├── breakpoints/                # 4 files (xs, sm, md, lg)
    ├── color/                      # 2 files (light, dark) - BILD & SportBILD only
    ├── effects/                    # 2 files (light, dark)
    └── typography/                 # 4 files (xs, sm, md, lg)
```

⚠️ **Advertorial Exception**: No `color/` folder (no BrandColorMapping)

---

## 🎨 Platform Usage

### CSS

```css
/* Import brand-specific tokens */
@import '@marioschmidt/design-system-tokens/css/brands/bild/semantic/color/colormode-light.css';
@import '@marioschmidt/design-system-tokens/css/brands/bild/semantic/typography/typography-md.css';

/* Use CSS custom properties */
.button {
  background-color: var(--bild-red-bild-red);  /* #DD0000 */
  font-family: var(--font-family-bild-font-family-gotham-cond);
}

/* Use ready-made typography classes */
<h1 class="headline1">Headline</h1>
```

### SCSS

```scss
// Import brand-specific tokens
@import '@marioschmidt/design-system-tokens/scss/brands/bild/semantic/color/colormode-light';

.button {
  background-color: $bild-red-bild-red;  // #DD0000
  padding: $space-primitive-space2x;
}
```

### JavaScript/TypeScript

```javascript
// Import brand-specific tokens
import tokens from '@marioschmidt/design-system-tokens/js/brands/bild/semantic/color/colormode-light.js';

console.log(tokens.BildRedBildRed);  // "#dd0000"

// React/Styled Components
const Button = styled.button`
  background-color: ${tokens.BildRedBildRed};
`;
```

### JSON

```javascript
// Import structured token data
import tokens from '@marioschmidt/design-system-tokens/json/brands/bild/semantic/color/colormode-light.json';

console.log(tokens);
// {
//   "BildRed": {
//     "bildRed": {
//       "$type": "color",
//       "$value": "#DD0000",
//       "type": "color",
//       "value": "#DD0000"
//     }
//   }
// }
```

### iOS (Swift)

```swift
// Import brand-specific tokens
import DesignTokens

// Use color tokens
let primaryColor = Colorprimitive.bildRedBildRed  // UIColor

// Use typography (size class aware)
let typography = Typography.headline1  // Typography struct
```

### Android (XML)

```xml
<!-- Import brand-specific colors -->
<resources>
    <color name="bild_red_bild_red">#DD0000</color>
    <dimen name="space_2x">16dp</dimen>

    <!-- Typography styles (size class aware) -->
    <style name="Headline1" parent="TextAppearance.AppCompat">
        <item name="android:fontFamily">@font/gotham_condensed</item>
        <item name="android:textSize">48sp</item>
    </style>
</resources>
```

### Flutter (Dart)

```dart
// Import brand-specific tokens
import 'package:design_tokens/brands/bild/semantic/color/colormode_light.dart';

// Use color tokens
final primaryColor = Colorprimitive.bildRedBildRed;  // Color

// Use typography tokens
final headline1 = Typography.headline1;  // TypographyToken
```

---

## 🔧 Development

### Project Structure

```
.
├── src/
│   └── design-tokens/
│       └── bild-design-system-raw-data.json    # Custom Figma Plugin export (raw data)
│
├── scripts/
│   ├── preprocess-plugin-tokens.js             # Preprocessing (965 lines)
│   │   • Alias resolution to final values
│   │   • Context-aware resolution (Brand × Breakpoint × ColorMode)
│   │   • Mode name matching (not ID-based)
│   │   • FontWeight bug fix ("700px" → 700)
│   │   • Advertorial special handling (no BrandColorMapping)
│   │
│   └── build-tokens-v2.js                      # Build orchestration (551 lines)
│       • Multi-platform configuration (7 formats)
│       • Brand-specific builds
│       • Composite token support (Typography, Effects)
│       • Size class mapping for iOS/Android
│
├── build-config/
│   └── style-dictionary.config.js              # Custom transforms & formats
│       • CSS typography classes format
│       • CSS effect classes format
│       • iOS Swift typography format
│       • Android typography XML format
│
├── tokens/                                     # Intermediate files (tracked in Git)
│   ├── shared/                                 # Primitives (4 files)
│   └── brands/                                 # Brand-specific (64 files)
│       ├── bild/
│       ├── sportbild/
│       └── advertorial/
│   📝 Purpose: Preprocessed Style Dictionary format
│   ✅ Aliases resolved, bugs fixed, ready for SD build
│
├── dist/                                       # Build artifacts (NOT in Git)
│   ├── css/, scss/, js/, json/                 # Web platforms
│   ├── ios/, android/, flutter/                # Native platforms
│   └── manifest.json                           # Build metadata
│   📝 Generated locally or in CI/CD
│   ⬇️ Available as GitHub Actions artifacts (30 days)
│
└── README.md
```

### Token Processing Pipeline

The token transformation happens in three stages:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣ Figma Export (Raw Data)                                      │
│    src/design-tokens/bild-design-system-raw-data.json           │
│    • Figma Variable Visualizer plugin export                    │
│    • Contains aliases: {type: "VARIABLE_ALIAS", id: "..."}      │
│    • FontWeight bugs: "700px" instead of 700                    │
│    • Complex Collections & Modes structure                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣ Preprocessing (Intermediate Format)                          │
│    tokens/                                                       │
│    • All aliases resolved to final values                       │
│    • FontWeight bugs fixed                                      │
│    • Organized by Brand × Mode × Collection                     │
│    • Style Dictionary format: {"$value": "...", "$type": "..."} │
│    • 68 JSON files (4 shared + 64 brand-specific)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣ Style Dictionary Build (Platform Outputs)                    │
│    dist/                                                         │
│    • 7 platforms: CSS, SCSS, JS, JSON, iOS, Android, Flutter    │
│    • 52 total builds (4 shared + 30 brand + 12 typo + 6 fx)     │
│    • Ready-to-use platform-specific formats                     │
│    • NOT tracked in Git (available as CI artifacts)             │
└─────────────────────────────────────────────────────────────────┘
```

### Why the `tokens/` Intermediate Step?

**Problem:** Figma export format is not directly usable by Style Dictionary:
- ❌ Aliases like `{type: "VARIABLE_ALIAS", id: "VariableID:123"}`
- ❌ Complex Collections & Modes structure
- ❌ Bugs like `"700px"` for FontWeight

**Solution:** Preprocessing creates clean Style Dictionary input:
- ✅ All aliases resolved: `{"$value": "#DD0000", "$type": "color"}`
- ✅ Bugs fixed: `700` (not `"700px"`)
- ✅ Organized structure ready for multi-platform build

**Example:**

```javascript
// BEFORE (Figma raw data - src/design-tokens/)
{
  "variables": [{
    "name": "Component/Background",
    "valuesByMode": {
      "mode123": { "type": "VARIABLE_ALIAS", "id": "VariableID:456" }
    }
  }]
}

// AFTER (Preprocessed - tokens/)
{
  "Component": {
    "Background": {
      "$value": "#DD0000",
      "$type": "color"
    }
  }
}

// FINAL (Build output - dist/)
// CSS: --component-background: #DD0000;
// SCSS: $component-background: #DD0000;
// JS: export const ComponentBackground = "#DD0000";
```

### Custom Figma Plugin Export

The pipeline expects a JSON export from a custom Figma plugin with the following structure:

```json
{
  "variableCollections": [
    {
      "id": "VariableCollectionId:...",
      "name": "CollectionName",
      "modes": [
        { "modeId": "mode-id", "name": "mode-name" }
      ],
      "variableIds": ["VariableID:..."]
    }
  ],
  "variables": [
    {
      "id": "VariableID:...",
      "name": "token/path/name",
      "resolvedType": "COLOR|FLOAT|STRING",
      "valuesByMode": {
        "mode-id": "#DD0000"  // Direct value
        // OR
        "mode-id": { "type": "VARIABLE_ALIAS", "id": "VariableID:..." }
      }
    }
  ]
}
```

**Export Location**: `src/design-tokens/bild-design-system-raw-data.json`

### Development Workflow

#### Local Development

1. **Export from Figma**
   - Use custom Figma plugin (Variable Visualizer)
   - Configure target branch: `figma-tokens` (recommended)
   - Export as `bild-design-system-raw-data.json`

2. **Figma Plugin Push**
   - Plugin automatically pushes to configured branch
   - ✅ **Recommended**: Push to `figma-tokens` branch
   - Creates automatic Pull Request with build artifacts

3. **Local Build (Optional)**
   ```bash
   # Full build (preprocessing + build)
   npm run build

   # Or run steps separately:
   npm run preprocess    # Step 1: Resolve aliases, fix bugs
   npm run build:tokens  # Step 2: Generate platform outputs
   ```
   - Resolves all aliases to final values
   - Creates intermediate files in `tokens/` (68 files)
   - Transforms to all 7 platforms in `dist/` (353 files)
   - **52/52 builds successful**

4. **Verify Locally**
   ```bash
   # Check brand-specific values
   grep "bild-red" dist/css/brands/bild/semantic/color/colormode-light.css
   grep "bild-red" dist/css/brands/sportbild/semantic/color/colormode-light.css

   # Check Advertorial has no color folder
   ls dist/css/brands/advertorial/semantic/
   # Expected: breakpoints/, effects/, typography/ (NO color/)

   # Check all platforms exist
   ls dist/
   # Expected: css/, scss/, js/, json/, ios/, android/, flutter/, manifest.json
   ```

#### Figma Export Target Branches

| Target Branch | Build Runs | PR Created | NPM Publish | Use Case |
|---------------|------------|------------|-------------|----------|
| **figma-tokens** | ✅ Yes | ✅ Automatic | ✅ After merge | **Recommended** - Full workflow with review |
| **main** | ✅ Yes | ❌ No | ✅ **Immediate** | ⚠️ Direct publish without review |
| **claude/*** | ✅ Yes | ❌ Manual | ❌ No | Development/Testing |
| **other** | ❌ No | ❌ No | ❌ No | Not configured |

**Best Practice:** Always export to `figma-tokens` branch for automatic PR creation and review before publishing.

---

## 🔄 CI/CD Integration

### Overview

The CI/CD pipeline uses **GitHub Actions Artifacts** for distributing build outputs. The `dist/` folder is **NOT tracked in Git** - instead, it's generated in CI and made available for download.

**Key Benefits:**
- ✅ No merge conflicts on generated files
- ✅ Clean Git history (only source files)
- ✅ PR review via downloadable artifacts
- ✅ 30-day artifact retention

---

### GitHub Actions Workflows

#### 1. 🔨 Build Tokens (`.github/workflows/build-tokens.yml`)

**Purpose:** Validates token builds and creates downloadable artifacts for PR review.

**Triggers:**
- Push to `main`, `develop`, `claude/**`, `figma-tokens` branches
- Pull requests to `main` branch
- Changes in `src/design-tokens/`, `scripts/`, `build-config/`
- Manual workflow dispatch

**Workflow Steps:**
```
1. Checkout repository
   ↓
2. Setup Node.js 20 + Install dependencies
   ↓
3. Run npm run build (preprocessing + build)
   ↓
4. Upload artifacts (dist/, tokens/, logs)
   ↓
5. Comment on PR with download link (if PR)
   ↓
6. Create build summary
```

**Outputs:**
- ✅ Validates build success: 52/52 builds
- 📦 Creates artifact: `design-tokens-{sha}.zip` (30 days)
- 💬 PR comment with download link (on pull requests)
- 📊 Build summary in Actions UI

**Artifact Contents:**
```
design-tokens-{sha}.zip
├── dist/                    # All platform outputs (353 files)
│   ├── css/, scss/, js/, json/
│   ├── ios/, android/, flutter/
│   └── manifest.json
├── tokens/                  # Intermediate files (68 files)
└── build-output.log         # Build logs
```

**PR Comment Example:**
```markdown
## 🎨 Design Tokens Build erfolgreich!

**Build Statistiken:**
- ✅ Successful Builds: 52/52
- 📦 Commit: `abc123`
- 🌲 Branch: `feature-branch`

### 📥 Review der generierten Files:

[⬇️ **Download Build Artifacts**](https://github.com/.../actions/runs/123456)

**Enthalten:**
- `dist/css/` - CSS Custom Properties
- `dist/scss/` - SCSS Variables
- `dist/js/` - JavaScript ES6
- `dist/json/` - JSON Data
- `dist/ios/` - Swift Classes
- `dist/android/` - Android XML
- `dist/flutter/` - Flutter Dart

📊 Datei-Statistiken
- Total Files: 353
- CSS Files: 88
- SCSS Files: 88
...

💡 **Tipp:** Die Artifacts sind 30 Tage verfügbar.
```

---

#### 2. 🤖 Auto PR from Figma (`.github/workflows/auto-pr-from-figma.yml`)

**Purpose:** Automatically creates/updates a Pull Request when Figma exports tokens.

**Trigger:**
- Push to `figma-tokens` branch (from Figma plugin)

**Recommended Figma Plugin Configuration:**
```javascript
{
  "targetBranch": "figma-tokens",
  "repository": "UXWizard25/vv-token-test-v3",
  "filePath": "src/design-tokens/bild-design-system-raw-data.json"
}
```

**Complete Workflow:**
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Figma Plugin Export                                      │
│    • Designer clicks "Export" in Figma                      │
│    • Plugin pushes JSON to figma-tokens branch              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Workflow Triggers                                        │
│    • auto-pr-from-figma.yml starts                          │
│    • Runs npm run build (52/52 builds)                      │
│    • Uploads artifacts (design-tokens-{sha}.zip)            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Pull Request Created                                     │
│    • Title: "🎨 Update design tokens from Figma"            │
│    • Body: Build stats + artifact download link            │
│    • Compares figma-tokens → main                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Review Process                                           │
│    • Team reviews source changes (JSON diff)                │
│    • Downloads artifacts to verify outputs                  │
│    • Checks CSS, SCSS, platform-specific files              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Merge to main                                            │
│    • PR approved and merged                                 │
│    • publish-on-merge.yml triggers                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. NPM Package Published                                    │
│    • Fresh dist/ build                                      │
│    • Version bump (patch)                                   │
│    • Published to npm registry                              │
│    • GitHub Release created                                 │
└─────────────────────────────────────────────────────────────┘
```

**PR Body Format:**
```markdown
## 🎨 Design Token Update

This PR contains updated design tokens from Figma Variable Visualizer.

### ✅ Build Results
- **Build Status:** Success
- **Successful Builds:** 52/52
- **Warnings:** 0

### 📥 Review Generated Files
[⬇️ **Download Build Artifacts**](https://github.com/.../actions/runs/123)

The generated `dist/` files are available as build artifacts (30 days retention).

### 📝 Changed Files
**Files Changed:** 1
- src/design-tokens/bild-design-system-raw-data.json

### 🚀 What Happens After Merge?
1. ✅ Tokens will be rebuilt
2. ✅ Package version will be bumped (patch)
3. ✅ Package will be published to npm
4. ✅ GitHub Release will be created
```

---

#### 3. 📦 Publish on Merge (`.github/workflows/publish-on-merge.yml`)

**Purpose:** Automatically publishes package to npm when PR is merged to main.

**Trigger:**
- Push to `main` branch
- Changes in `src/design-tokens/`, `scripts/`, `build-config/`, `package.json`

**Steps:**
1. Rebuild tokens (fresh dist/)
2. Bump version (patch)
3. Publish to npm
4. Create GitHub Release
5. Tag with version

---

### Workflow Comparison

| Workflow | Trigger | Builds dist/ | Commits dist/ | Creates PR | Publishes NPM |
|----------|---------|--------------|---------------|------------|---------------|
| **build-tokens.yml** | Push/PR to tracked branches | ✅ Yes | ❌ No (artifacts only) | ❌ No | ❌ No |
| **auto-pr-from-figma.yml** | Push to `figma-tokens` | ✅ Yes | ❌ No (artifacts only) | ✅ Yes | ❌ No |
| **publish-on-merge.yml** | Merge to `main` | ✅ Yes (fresh) | ❌ No | ❌ No | ✅ Yes |

---

### Manual Workflow Dispatch

**Via GitHub UI:**
1. Go to **Actions** tab
2. Select **"Build Design Tokens"**
3. Click **"Run workflow"**
4. Download artifacts from run details

**Via GitHub CLI:**
```bash
# Trigger build
gh workflow run build-tokens.yml

# List recent runs
gh run list --workflow=build-tokens.yml

# Download artifacts from specific run
gh run download <run-id>
```

---

### Reviewing Build Artifacts

**Method 1: Via PR Comment Link**
1. Open Pull Request
2. Find bot comment "🎨 Design Tokens Build erfolgreich!"
3. Click "Download Build Artifacts"
4. Extract ZIP and review files locally

**Method 2: Via Actions Tab**
1. Go to repository Actions tab
2. Click on workflow run
3. Scroll to "Artifacts" section
4. Download `design-tokens-{sha}.zip`

**Method 3: Via GitHub CLI**
```bash
# List artifacts for a run
gh run view <run-id>

# Download all artifacts
gh run download <run-id>

# Extract and review
unzip design-tokens-*.zip
ls dist/
```

---

### Branch Protection & Artifact Workflow

**Why dist/ is not in Git:**
- Generated files cause merge conflicts (353 files × multiple developers)
- Unnecessary repository bloat (~15 MB per commit)
- Source of truth is `src/design-tokens/` (single JSON file)
- Style Dictionary can regenerate dist/ deterministically

**How to review changes without dist/ in Git:**
1. Source changes visible in PR diff (JSON file)
2. Build artifacts downloadable from Actions (30 days)
3. Local testing: `npm run build` generates dist/
4. CI validates all builds pass (52/52)

This approach follows modern best practices used by design systems like Shopify Polaris, GitHub Primer, and Adobe Spectrum.

---

## 🧪 Testing & Verification

### Build Verification

```bash
# Run full build
npm run build

# Expected output:
# 📦 Baue Shared Primitives:
#   ✅ fontprimitive
#   ✅ colorprimitive
#   ✅ sizeprimitive
#   ✅ spaceprimitive
#
# 🏷️  Baue Brand-spezifische Tokens:
#   📦 bild: ✅ density (3 modes) ✅ breakpoints (4 modes) ✅ color (2 modes) ✅ overrides (2 collections)
#   📦 sportbild: ✅ density (3 modes) ✅ breakpoints (4 modes) ✅ color (2 modes) ✅ overrides (2 collections)
#   📦 advertorial: ✅ density (3 modes) ✅ breakpoints (4 modes) ✅ overrides (1 collection)
#
# ✍️  Baue Typography Tokens:
#   🏷️  bild: ✅ bild-xs (css, scss, js, json, flutter) ✅ bild-sm (+ ios, android) ...
#
# 🎨 Baue Effect Tokens:
#   🏷️  Brand: bild ✅ bild-light (css, scss, js, json, ios, android, flutter) ...
#
# 📊 Statistiken:
#    - Shared Primitives: 4/4
#    - Brand-spezifische Tokens: 30/30
#    - Typography Builds: 12/12
#    - Effect Builds: 6/6
#    - Builds erfolgreich: 52/52
```

### Brand-Specific Values

```bash
# BILD should use Gotham Condensed
grep "font-family-gotham-cond" dist/css/brands/bild/semantic/typography/typography-md.css

# SportBILD should use AntennaExtraCond
grep "font-family-antenna-extra-cond" dist/css/brands/sportbild/semantic/typography/typography-md.css

# BILD red: #DD0000
grep "bild-red-bild-red" dist/css/shared/colorprimitive.css
# Expected: --bild-red-bild-red: #DD0000;

# SportBILD has different brand colors
grep "sport-bild-dark-blue" dist/css/shared/colorprimitive.css
```

### Advertorial Special Case

```bash
# Advertorial should NOT have color/ folder
ls dist/css/brands/advertorial/semantic/
# Expected: breakpoints/ effects/ typography/ (NO color/)

ls dist/css/brands/bild/semantic/
# Expected: breakpoints/ color/ effects/ typography/
```

### Breakpoint Scaling

```bash
# Typography scales across breakpoints
# headline1 should scale from 48px (xs) to 100px (lg) for BILD

grep "headline1" dist/json/brands/bild/semantic/typography/typography-xs.json | grep fontSize
# Expected: 48px

grep "headline1" dist/json/brands/bild/semantic/typography/typography-lg.json | grep fontSize
# Expected: 100px
```

---

## 🆘 Troubleshooting

### ⚠️ Variable nicht gefunden: VariableID:16104:163534

**Problem:** Preprocessing warns about missing variable

**Cause:** Variable `Component/Kicker/Partner/kickerStylebookBgColor` references a deleted/renamed variable in Figma

**Impact:** Non-critical - Token gets `UNRESOLVED_` value, build continues

**Solution:** In Figma, check and re-link the `kickerStylebookBgColor` variable

### ⚠️ Token Collisions in fontprimitive/sizeprimitive/spaceprimitive

**Problem:** Style Dictionary warns about token name collisions for some platforms

**Cause:** LetterSpacing tokens have positive/negative values with similar names:
- `letterSpace-0_25` (negative) → `LetterSpace025` (JS/iOS/Flutter)
- `letterSpace0_25` (positive) → `LetterSpace025` (same!)

**Impact:** Non-critical - Last value wins, usually works fine

**Platforms Affected:**
- ❌ JavaScript, iOS, Android, Flutter, JSON (name collision)
- ✅ CSS, SCSS (no collision - hyphens preserved)

**Solution (Figma-side):**
Rename tokens in Figma:
```
letterSpace-0_25 → letterSpaceNeg0_25  (or letterSpaceMinus0_25)
letterSpace0_25  → letterSpacePos0_25  (or letterSpacePlus0_25)
```

### Build Failures

**Problem:** Build fails with "ENOENT: no such file or directory"

**Solution:**
```bash
# Make sure preprocessing ran first
npm run preprocess

# Then build
npm run build:tokens

# Or use the combined command
npm run build
```

**Problem:** "Cannot find module 'style-dictionary'"

**Solution:**
```bash
npm install
```

### Missing dist/ Folder

**Problem:** dist/ folder not visible in repository or after clone

**Explanation:** The `dist/` folder is **intentionally not tracked in Git** (as of v2.1.0). This prevents merge conflicts and keeps the repository clean.

**Solutions:**

**Option 1: Generate Locally**
```bash
npm run build
ls dist/  # Should show css/, scss/, js/, json/, ios/, android/, flutter/
```

**Option 2: Download from CI Artifacts**
1. Go to repository **Actions** tab
2. Find the latest workflow run for your branch
3. Download `design-tokens-{sha}.zip` from Artifacts section
4. Extract the `dist/` folder

**Option 3: From Pull Request**
1. Find the PR you're interested in
2. Look for bot comment with artifact download link
3. Download and extract

**Note:** The `dist/` folder is automatically included in npm packages. If you install via npm, the dist/ folder will be in `node_modules/@marioschmidt/design-system-tokens/dist/`.

### Wrong Platform Outputs

**Problem:** Some platforms missing files

**Solution:** Check build output for errors:
```bash
npm run build 2>&1 | grep "❌"
```

All platforms should build successfully: 52/52

---

## 📊 Technical Details

### Key Design Decisions

1. **Complete Alias Resolution in Preprocessing**
   - No `{Alias.Path}` syntax in Style Dictionary
   - All aliases resolved to final Hex/px/numeric values
   - Prevents reference errors in Style Dictionary

2. **Context-Aware Alias Resolution**
   - Brand × Breakpoint × ColorMode matrix
   - Each context combination gets unique resolution
   - Example: `colormode-light` for BILD resolves brand-specific aliases using BILD's mode ID

3. **Mode Name Matching**
   - Collections have different mode IDs
   - Match by `mode.name` instead of `mode.modeId`
   - Robust against Figma re-creating modes

4. **Brand-Specific Processing**
   - Separate token files per brand and mode
   - Prevents collisions during Style Dictionary build
   - Enables brand-specific value verification

5. **Size Class Terminology**
   - iOS/Android use "sizeclass" terminology
   - Only compact (sm) and regular (lg) generated
   - xs and md breakpoints skipped for native platforms

### Performance

- **Preprocessing**: ~2-3 seconds
- **Build**: ~8-10 seconds (all 52 builds)
- **Total**: ~11 seconds
- **Output Size**: ~15 MB (all platforms)

---

## 📝 Changelog

### v2.1.0 (Current) - CI Artifacts Workflow

**✨ Features:**
- **Modern CI/CD**: dist/ no longer tracked in Git (prevents merge conflicts)
- **GitHub Actions Artifacts**: Build outputs available as downloadable artifacts (30 days)
- **PR Bot Comments**: Automatic comments on PRs with artifact download links
- **Build Statistics**: Detailed file counts and build summaries in PR comments
- **Figma Branch Workflow**: Documented recommended workflow with `figma-tokens` branch

**🔧 Changes:**
- `dist/` folder now gitignored (removed 353 files from tracking)
- `tokens/` folder now tracked in Git (preprocessed intermediate files)
- Updated workflows: `build-tokens.yml`, `auto-pr-from-figma.yml`
- Removed dist/ commit steps from CI workflows
- Added artifact upload and PR comment features

**📚 Documentation:**
- Complete CI/CD Integration section rewrite
- Added "Token Processing Pipeline" visualization
- Added "Why the tokens/ Intermediate Step?" explanation
- Added "Figma Export Target Branches" comparison table
- Added "Reviewing Build Artifacts" guide
- Translated all German comments in build scripts to English

**🎯 Benefits:**
- ✅ No more merge conflicts on generated files
- ✅ Cleaner Git history (only source files tracked)
- ✅ PR review still possible via downloadable artifacts
- ✅ Follows modern best practices (Shopify Polaris, GitHub Primer, Adobe Spectrum)
- ✅ Smaller repository size (~15 MB removed per commit)

**⚡ Performance:**
- Same build performance: 52/52 builds successful
- ~11 seconds total build time
- Artifacts upload in ~2-3 seconds

---

### v2.0.0 - Custom Plugin Migration

**✨ Features:**
- Custom Figma Plugin integration (replaces Variable Visualizer)
- 7 platform support: CSS, SCSS, JS, JSON, iOS, Android, Flutter
- Complete alias resolution in preprocessing (no Style Dictionary references)
- Composite token support: Typography (12 builds), Effects (6 builds)
- Brand-specific output structure: `dist/{platform}/brands/{brand}/`
- Advertorial special handling (no color/ folder)
- Size class mapping for iOS/Android (compact/regular only)
- Context-aware alias resolution: Brand × Breakpoint × ColorMode

**🐛 Bug Fixes:**
- FontWeight bug fix: "700px" → 700
- Mode name matching instead of ID-based (robust against Figma changes)
- YAML syntax fix in GitHub Actions (multi-line commit messages)
- Exit code 0 for successful builds

**⚡ Performance:**
- 52/52 builds successful (up from 30/30)
- All 7 platforms generate complete token sets
- ~11 seconds total build time

**📦 Migration:**
- New scripts: `preprocess-plugin-tokens.js`, `build-tokens-v2.js`
- New token source: `bild-design-system-raw-data.json`
- Removed: Old Variable Visualizer scripts and token files

---

## 🔗 Resources

- [Style Dictionary v4 Documentation](https://styledictionary.com/)
- [Figma Variables API](https://www.figma.com/plugin-docs/api/properties/figma-variables/)
- [Design Tokens Community Group](https://design-tokens.github.io/community-group/)
- [Repository Issues](https://github.com/UXWizard25/vv-token-test-v3/issues)

---

**Built with ❤️ for the BILD Design System**
