# Auto-Updater Setup Guide

This guide explains how to set up automatic updates for Proof using Tauri's built-in updater.

## Overview

The auto-updater requires:
1. **Update server** to host releases
2. **Signing keys** for security
3. **Release management** workflow

## Step 1: Generate Signing Keys

```bash
# Generate private key (keep this secret!)
tauri signer generate -w ~/.tauri/proof.key

# Generate public key (this goes in tauri.conf.json)
tauri signer generate -w ~/.tauri/proof.key -p
```

Copy the public key and update `tauri.conf.json`:
```json
"updater": {
  "active": true,
  "endpoints": [
    "https://releases.proof-app.com/{{target}}/{{arch}}/{{current_version}}"
  ],
  "dialog": true,
  "pubkey": "YOUR_PUBLIC_KEY_HERE"
}
```

## Step 2: Set Up Update Server

### Option 1: GitHub Releases (Free)
1. **Create a GitHub repository** for releases
2. **Upload installers** to releases
3. **Update endpoint** in `tauri.conf.json`:
```json
"endpoints": [
  "https://api.github.com/repos/yourusername/proof-releases/releases/latest"
]
```

### Option 2: Custom Server
1. **Set up a web server** (AWS S3, DigitalOcean, etc.)
2. **Create directory structure**:
```
releases/
├── windows/
│   └── x64/
│       ├── 1.0.0/
│       │   └── Proof_1.0.0_x64-setup.exe
│       └── latest.json
├── macos/
│   └── x64/
│       ├── 1.0.0/
│       │   └── Proof_1.0.0_x64.dmg
│       └── latest.json
└── linux/
    └── x64/
        ├── 1.0.0/
        │   └── Proof_1.0.0_x64.AppImage
        └── latest.json
```

3. **Create latest.json** for each platform:
```json
{
  "version": "1.0.1",
  "notes": "Bug fixes and improvements",
  "pub_date": "2024-01-15T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "signature_here",
      "url": "https://releases.proof-app.com/windows/x64/1.0.1/Proof_1.0.1_x64-setup.exe"
    }
  }
}
```

## Step 3: Sign Releases

```bash
# Sign Windows installer
tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/nsis/Proof_1.0.1_x64-setup.exe"

# Sign macOS app
tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/macos/Proof.app"

# Sign Linux AppImage
tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/appimage/Proof_1.0.1_x86_64.AppImage"
```

## Step 4: Release Workflow

### Automated with GitHub Actions
Create `.github/workflows/release.yml`:
```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install Tauri CLI
        run: npm install -g @tauri-apps/cli
      - name: Build
        run: npm run tauri build
      - name: Sign
        run: |
          tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/nsis/Proof_${{ github.ref_name }}_x64-setup.exe"
      - name: Upload Release
        uses: actions/upload-release-asset@v1
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: src-tauri/target/release/bundle/nsis/Proof_${{ github.ref_name }}_x64-setup.exe
          asset_name: Proof_${{ github.ref_name }}_x64-setup.exe
          asset_content_type: application/octet-stream
```

### Manual Release
```bash
# 1. Build
pnpm tauri build

# 2. Sign
tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/nsis/Proof_1.0.1_x64-setup.exe"

# 3. Upload to server
# 4. Update latest.json
# 5. Test update
```

## Step 5: Test Updates

### Local Testing
```bash
# Start a local server
python -m http.server 8000

# Update tauri.conf.json endpoint
"endpoints": ["http://localhost:8000/{{target}}/{{arch}}/{{current_version}}"]

# Build and test
pnpm tauri build
```

### Production Testing
1. **Deploy v1.0.0** to users
2. **Create v1.0.1** with changes
3. **Upload to server**
4. **Test update flow**

## Step 6: Frontend Integration

Add update UI to your app:
```tsx
import { checkForUpdates, downloadUpdate } from "./lib/ipc";

const UpdateButton = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");

  const checkUpdates = async () => {
    try {
      const result = await checkForUpdates();
      if (result.updateAvailable) {
        setUpdateAvailable(true);
        setUpdateVersion(result.version || "");
      }
    } catch (error) {
      console.error("Update check failed:", error);
    }
  };

  const installUpdate = async () => {
    try {
      await downloadUpdate();
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  return (
    <div>
      {updateAvailable && (
        <div>
          <p>Update {updateVersion} available!</p>
          <button onClick={installUpdate}>Install Update</button>
        </div>
      )}
      <button onClick={checkUpdates}>Check for Updates</button>
    </div>
  );
};
```

## Security Considerations

1. **Keep private key secure** - never commit to repository
2. **Use HTTPS** for update endpoints
3. **Verify signatures** - Tauri does this automatically
4. **Rate limit** update checks to avoid abuse

## Troubleshooting

### Common Issues
- **"Update check failed"**: Check endpoint URL and network
- **"Signature verification failed"**: Ensure correct public key
- **"No update available"**: Check version numbers and latest.json

### Debug Mode
```bash
# Enable debug logging
RUST_LOG=debug pnpm tauri dev
```

## Cost Summary

| Service | Cost | Features |
|---------|------|----------|
| GitHub Releases | Free | Basic hosting, no custom domain |
| AWS S3 | ~$1-5/month | Custom domain, CDN |
| DigitalOcean | ~$5-10/month | Full control, custom setup |

## Next Steps

1. Generate signing keys
2. Set up release server
3. Configure endpoints
4. Test update flow
5. Deploy to production

Your Proof app now has professional auto-updates! 🚀
