# GitHub Auto-Updater Setup Guide

This guide walks you through setting up automatic updates using GitHub Releases.

## Step 1: Create GitHub Repository

1. **Go to GitHub.com** and create a new repository:
   - Name: `proof-releases` (or any name you prefer)
   - Description: "Proof Local LLM - Release Repository"
   - Make it **Public** (required for free GitHub Releases)
   - Don't initialize with README

2. **Note the repository URL**: `https://github.com/yourusername/proof-releases`

## Step 2: Generate Signing Keys

Run these commands in your project directory:

```bash
# Create .tauri directory if it doesn't exist
mkdir -p ~/.tauri

# Generate private key (KEEP THIS SECRET!)
tauri signer generate -w ~/.tauri/proof.key

# Generate public key (copy this output)
tauri signer generate -w ~/.tauri/proof.key -p
```

**Copy the public key** - you'll need it for the next step.

## Step 3: Update Configuration

Update `src-tauri/tauri.conf.json`:

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://api.github.com/repos/yourusername/proof-releases/releases/latest"
    ],
    "dialog": true,
    "pubkey": "YOUR_PUBLIC_KEY_HERE"
  }
}
```

Replace:
- `yourusername` with your GitHub username
- `YOUR_PUBLIC_KEY_HERE` with the public key from step 2

## Step 4: Create GitHub Actions Workflow

Create `.github/workflows/release.yml` in your project:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
          
      - name: Install dependencies
        run: |
          npm install -g pnpm
          pnpm install
          
      - name: Install Tauri CLI
        run: npm install -g @tauri-apps/cli@latest
        
      - name: Build application
        run: pnpm tauri build
        
      - name: Sign Windows installer
        run: |
          tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/nsis/Proof_${GITHUB_REF_NAME}_x64-setup.exe"
        env:
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          
      - name: Sign macOS app
        run: |
          tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/macos/Proof.app"
        env:
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          
      - name: Sign Linux AppImage
        run: |
          tauri signer sign ~/.tauri/proof.key "src-tauri/target/release/bundle/appimage/Proof_${GITHUB_REF_NAME}_x86_64.AppImage"
        env:
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            src-tauri/target/release/bundle/nsis/Proof_${GITHUB_REF_NAME}_x64-setup.exe
            src-tauri/target/release/bundle/dmg/Proof_${GITHUB_REF_NAME}_x64.dmg
            src-tauri/target/release/bundle/appimage/Proof_${GITHUB_REF_NAME}_x86_64.AppImage
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Step 5: Add GitHub Secrets

1. **Go to your repository** on GitHub
2. **Click Settings** → **Secrets and variables** → **Actions**
3. **Click "New repository secret"**
4. **Add these secrets:**

   **Name:** `TAURI_PRIVATE_KEY`
   **Value:** (The private key from step 2 - the entire content of `~/.tauri/proof.key`)

   To get the private key content:
   ```bash
   cat ~/.tauri/proof.key
   ```

## Step 6: Test the Setup

1. **Commit and push** your changes:
   ```bash
   git add .
   git commit -m "Add auto-updater configuration"
   git push origin main
   ```

2. **Create a test release:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Check GitHub Actions** - you should see a workflow running
4. **Check Releases** - you should see a new release with signed installers

## Step 7: Test Updates

1. **Download and install** the v1.0.0 release
2. **Make a small change** to your app (like version number)
3. **Create v1.0.1:**
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. **Run the installed app** - it should detect the update

## Step 8: Add Update UI (Optional)

Add this to your React app for manual update checking:

```tsx
import { checkForUpdates, downloadUpdate } from "./lib/ipc";

const UpdateChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");

  const checkUpdates = async () => {
    try {
      const result = await checkForUpdates();
      if (result.updateAvailable) {
        setUpdateAvailable(true);
        setUpdateVersion(result.version || "");
      } else {
        alert("No updates available");
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
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3>Updates</h3>
      {updateAvailable ? (
        <div>
          <p>Update {updateVersion} available!</p>
          <button onClick={installUpdate}>Install Update</button>
        </div>
      ) : (
        <button onClick={checkUpdates}>Check for Updates</button>
      )}
    </div>
  );
};
```

## Troubleshooting

### Common Issues:

1. **"Update check failed"**
   - Check repository URL in tauri.conf.json
   - Ensure repository is public
   - Check network connectivity

2. **"Signature verification failed"**
   - Verify public key in tauri.conf.json matches private key
   - Check that installers are properly signed

3. **"No update available"**
   - Check version numbers in tauri.conf.json vs release
   - Ensure release was created successfully

### Debug Steps:

1. **Check GitHub Actions logs** for build errors
2. **Verify releases** have the correct files
3. **Test with a local server** first:
   ```bash
   python -m http.server 8000
   # Update endpoint to http://localhost:8000/...
   ```

## Cost: FREE! 🎉

GitHub Releases is completely free for public repositories, making this the most cost-effective solution for auto-updates.

## Next Steps

1. Follow steps 1-7 above
2. Test the complete flow
3. Add update UI to your app
4. Start distributing your app with auto-updates!

Your Proof app now has professional auto-updates via GitHub! 🚀
