# Proof - Local LLM Desktop App

A lightweight desktop application for running local Large Language Models via Ollama. Built with Tauri + React for minimal footprint and cross-platform compatibility.

## Features

- 🤖 **Local LLM Chat** - Chat with models running entirely on your machine
- ⚙️ **Settings Panel** - Adjust temperature, context length, and default model
- 📦 **Model Management** - Pull, list, and delete models from Ollama
- 🔒 **Privacy First** - All processing happens locally, no cloud calls
- 🖥️ **Cross Platform** - Windows (.msi/.exe) and macOS (.dmg) installers

## Prerequisites

- **Ollama** - Install from [ollama.com](https://ollama.com)
- **Node.js** - LTS version recommended
- **Rust** - For building from source

## Quick Start

1. **Install Ollama** (if not already installed):
   ```bash
   # Windows
   Download from https://ollama.com/download
   
   # macOS
   brew install ollama
   ```

2. **Run the app**:
   ```bash
   pnpm install
   pnpm tauri dev
   ```

3. **Pull a model**:
   - Select "llama3.2:1b" from the dropdown
   - Click "Pull" to download the model
   - Start chatting!

## Building Installers

### Windows
```bash
pnpm tauri build
```
Creates:
- `src-tauri/target/release/bundle/msi/Proof_1.0.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Proof_1.0.0_x64-setup.exe`

### macOS
```bash
pnpm tauri build
```
Creates:
- `src-tauri/target/release/bundle/dmg/Proof_1.0.0_x64.dmg`
- `src-tauri/target/release/bundle/macos/Proof.app`

## Settings

- **Temperature** (0.0-2.0): Controls randomness in responses
- **Context Length** (512-8192): Maximum tokens for conversation memory
- **Default Model**: Set your preferred model for new chats

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri
- **LLM Runtime**: Ollama (local REST API)
- **Packaging**: Tauri bundler for native installers

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tauri dev

# Build for production
pnpm tauri build
```

## License

MIT License - see LICENSE file for details.