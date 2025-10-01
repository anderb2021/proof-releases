# Code Signing Guide for Proof

This guide explains how to set up code signing for Windows and macOS installers.

## Windows Code Signing

### Option 1: Self-Signed Certificate (Free, but shows warning)
```bash
# Create a self-signed certificate
New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Proof" -KeyUsage DigitalSignature -FriendlyName "Proof Code Signing" -CertStoreLocation Cert:\CurrentUser\My

# Get the thumbprint
Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert

# Update tauri.conf.json
"certificateThumbprint": "YOUR_THUMBPRINT_HERE"
```

### Option 2: Commercial Certificate (Recommended for distribution)
1. **Buy a code signing certificate** from:
   - DigiCert (~$400/year)
   - Sectigo (~$300/year)
   - GlobalSign (~$400/year)

2. **Install the certificate** in Windows Certificate Store

3. **Get the thumbprint**:
```bash
Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert
```

4. **Update tauri.conf.json**:
```json
"certificateThumbprint": "YOUR_THUMBPRINT_HERE"
```

### Building with Code Signing
```bash
pnpm tauri build
```

## macOS Code Signing

### Option 1: Apple Developer Account (Recommended)
1. **Join Apple Developer Program** ($99/year)
2. **Create a Developer ID Application certificate** in Apple Developer Portal
3. **Download and install** the certificate in Keychain

4. **Update tauri.conf.json**:
```json
"signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
"providerShortName": "TEAM_ID"
```

### Option 2: Self-Signed (Free, but requires user to allow)
1. **Create a self-signed certificate** in Keychain Access
2. **Update tauri.conf.json**:
```json
"signingIdentity": "Your Name"
```

### Building with Code Signing
```bash
pnpm tauri build
```

## Notarization (macOS)

For distribution outside the App Store, you need to notarize:

1. **Create an app-specific password** in Apple ID settings
2. **Set environment variables**:
```bash
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
export TEAM_ID="YOUR_TEAM_ID"
```

3. **Update tauri.conf.json**:
```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
  "providerShortName": "TEAM_ID",
  "hardenedRuntime": true,
  "gatekeeperAssess": false
}
```

## Environment Variables

Create a `.env` file in the project root:
```bash
# Windows
WINDOWS_CERTIFICATE_THUMBPRINT=your_thumbprint_here

# macOS
APPLE_ID=your@email.com
APPLE_PASSWORD=app_specific_password
TEAM_ID=your_team_id
```

## Testing Code Signing

### Windows
```bash
# Check if the MSI is signed
signtool verify /pa "src-tauri/target/release/bundle/msi/Proof_1.0.0_x64_en-US.msi"
```

### macOS
```bash
# Check if the app is signed
codesign -dv --verbose=4 "src-tauri/target/release/bundle/macos/Proof.app"
spctl -a -v "src-tauri/target/release/bundle/macos/Proof.app"
```

## Troubleshooting

### Windows
- **"Certificate not found"**: Check thumbprint in Certificate Store
- **"Invalid certificate"**: Ensure certificate is valid and not expired
- **"Timestamp server error"**: Try different timestamp URL

### macOS
- **"No identity found"**: Check signingIdentity matches Keychain certificate
- **"Notarization failed"**: Verify Apple ID credentials and Team ID
- **"Gatekeeper blocked"**: App needs to be notarized for distribution

## Cost Summary

| Platform | Option | Cost | User Experience |
|----------|--------|------|-----------------|
| Windows | Self-signed | Free | Shows warning |
| Windows | Commercial | $300-400/year | No warning |
| macOS | Self-signed | Free | User must allow |
| macOS | Developer ID | $99/year | No warning (with notarization) |

## Next Steps

1. Choose your signing approach
2. Obtain certificates
3. Update `tauri.conf.json` with your details
4. Build and test: `pnpm tauri build`
5. Verify signing worked
6. Distribute your signed installers!
