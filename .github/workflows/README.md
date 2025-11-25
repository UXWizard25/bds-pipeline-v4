# GitHub Actions Workflows

## 📋 Verfügbare Workflows

### `build-tokens.yml` - Design Token Build Pipeline

Automatisierter Build-Prozess für Design Tokens aus Figma-Exports.

#### 🚀 Trigger

**Automatisch:**
- Push auf `main`, `develop` oder `claude/**` Branches
- Nur wenn Dateien in folgenden Pfaden geändert wurden:
  - `src/design-tokens/**` (Figma-Exports)
  - `scripts/**` (Build-Scripts)
  - `build-config/**` (Style Dictionary Config)
  - `package.json` (Dependencies)

**Manuell:**
- Über GitHub UI: Actions → "Build Design Tokens" → "Run workflow"
- Mit Optionen:
  - **Clean Build**: Löscht `node_modules` und `dist` vor dem Build
  - **Commit Outputs**: Committed generierte Dateien zurück ins Repository

#### 📦 Was wird gemacht?

1. **Repository Checkout** - Holt den aktuellen Code
2. **Node.js Setup** - Installiert Node.js 20
3. **Dependencies Install** - `npm ci` für reproduzierbare Builds
4. **Preprocessing** - Transformiert Figma JSON → Style Dictionary Format
5. **Token Build** - Generiert alle Output-Formate (CSS, SCSS, JS, JSON)
6. **Artifacts Upload** - Lädt generierte Dateien als Build-Artefakte hoch
7. **Build Summary** - Erstellt detaillierte Zusammenfassung im GitHub UI
8. **Optional: Commit** - Committed generierte Dateien zurück (bei main oder manuell)

#### 📊 Build Summary

Nach jedem Build wird eine detaillierte Zusammenfassung angezeigt:
- Build-Status und Statistiken
- Liste der generierten Dateien
- Datei-Zählung pro Format
- Error Logs bei Fehlern

#### 🎯 Manueller Build

**Via GitHub UI:**
1. Gehe zu "Actions" Tab
2. Wähle "Build Design Tokens"
3. Klicke "Run workflow"
4. Wähle Branch
5. Setze Optionen (optional):
   - ✅ Clean Build für kompletten Neustart
   - ✅ Commit Outputs um Dateien zu committen
6. Klicke "Run workflow"

**Via GitHub CLI:**
```bash
# Standard Build
gh workflow run build-tokens.yml

# Mit Branch
gh workflow run build-tokens.yml --ref main

# Mit Optionen
gh workflow run build-tokens.yml \
  -f clean_build=true \
  -f commit_outputs=true
```

**Via API:**
```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/build-tokens.yml/dispatches \
  -d '{"ref":"main","inputs":{"clean_build":"true"}}'
```

#### 📥 Build Artifacts

Generierte Dateien werden als Artifacts gespeichert:
- **Name**: `design-tokens-{commit-sha}`
- **Retention**: 30 Tage
- **Inhalt**:
  - `dist/` - Alle generierten Token-Dateien
  - `tokens/` - Zwischenschritt (Style Dictionary Input)
  - `build-output.log` - Vollständige Build-Logs

**Download:**
1. Gehe zu Actions → Build Run
2. Scrolle zu "Artifacts"
3. Klicke zum Download

#### 🏷️ Release Workflow

Bei Git-Tags (z.B. `v1.0.0`) wird automatisch ein GitHub Release erstellt:
- Release mit Tag-Name
- ZIP und TAR.GZ Archive der generierten Tokens
- Automatische Release Notes

**Release erstellen:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

#### ⚙️ Konfiguration

**Branch-Filter anpassen:**
```yaml
on:
  push:
    branches:
      - main        # Haupt-Branch
      - develop     # Entwicklungs-Branch
      - 'claude/**' # Alle Claude-Branches
```

**Path-Filter anpassen:**
```yaml
paths:
  - 'src/design-tokens/**'  # Token-Quellen
  - 'scripts/**'            # Build-Scripts
  - 'build-config/**'       # Konfiguration
```

**Auto-Commit aktivieren:**
```yaml
# Immer bei Push auf main committen
if: github.event_name == 'push' && github.ref == 'refs/heads/main'

# Oder nur bei manueller Aktivierung
if: github.event.inputs.commit_outputs == 'true'
```

#### 🔒 Permissions

Der Workflow benötigt folgende Permissions:
- `contents: write` - Für Commits und Releases
- `pull-requests: write` - Für PR-Kommentare (optional)

#### 🚨 Fehlerbehandlung

Bei Fehlern:
1. Build schlägt fehl (Exit Code ≠ 0)
2. Error Summary wird in GitHub UI angezeigt
3. Build-Logs sind verfügbar
4. Artifacts werden nicht hochgeladen
5. Keine Commits werden erstellt

**Häufige Fehler:**
- **No successful builds**: Preprocessing oder Build fehlgeschlagen
- **Module not found**: `npm ci` fehlgeschlagen
- **Git push failed**: Permissions fehlen

#### 💡 Best Practices

1. **Lokaler Test vor Push:**
   ```bash
   npm run build
   ```

2. **Clean Build bei Problemen:**
   - Manuell triggern mit "Clean Build" Option

3. **Branch Protection:**
   - Require status checks für main
   - Build muss grün sein

4. **Artifacts nutzen:**
   - Download für lokale Tests
   - Teilen mit Team-Mitgliedern

5. **Releases taggen:**
   - Semantische Versionierung: `v1.2.3`
   - Nur stabile Versionen

#### 📚 Weitere Informationen

- [GitHub Actions Dokumentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Style Dictionary Docs](https://amzn.github.io/style-dictionary/)

#### 🤝 Troubleshooting

**Workflow wird nicht getriggert:**
- Prüfe Branch-Filter
- Prüfe Path-Filter (wurden relevante Dateien geändert?)
- Prüfe Workflow-Permissions

**Build schlägt fehl:**
- Prüfe Build-Logs in Actions Tab
- Download Artifacts für lokale Analyse
- Teste lokal: `npm run build`

**Auto-Commit funktioniert nicht:**
- Prüfe Permissions: `contents: write`
- Prüfe Branch Protection Rules
- Prüfe ob `[skip ci]` im Commit ist

---

**Letzte Aktualisierung**: 2025-11-20
