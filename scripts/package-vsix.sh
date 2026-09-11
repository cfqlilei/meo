#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$EXTENSION_DIR/release"

usage() {
  cat <<'EOF'
Usage:
  scripts/package-vsix.sh                 Open interactive menu
  scripts/package-vsix.sh package         Build and package VSIX
  scripts/package-vsix.sh install         Build, package, and install VSIX

Options:
  -h, --help                              Show help
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

read_package_field() {
  local field="$1"
  node -e "const p=require('./package.json'); const v=p['$field']; if (!v) process.exit(1); process.stdout.write(v);"
}

run_vsce_package() {
  local out_file="$1"

  if has_cmd vsce; then
    vsce package --out "$out_file"
    return
  fi

  if has_cmd npx; then
    npx --yes @vscode/vsce package --out "$out_file"
    return
  fi

  fail "vsce or npx is required to package the extension."
}

package_extension() {
  cd "$EXTENSION_DIR"

  has_cmd bun || fail "bun is required to build the extension."
  has_cmd node || fail "node is required to read package metadata."

  local name version vsix_file
  name="$(read_package_field name)"
  version="$(read_package_field version)"
  mkdir -p "$RELEASE_DIR"

  vsix_file="$RELEASE_DIR/${name}-${version}.vsix"
  rm -f "$vsix_file"

  echo "Building extension..."
  bun run build

  echo "Packaging $vsix_file..."
  run_vsce_package "$vsix_file"

  echo "VSIX created: $vsix_file"
}

install_extension() {
  cd "$EXTENSION_DIR"

  local name version vsix_file installed
  name="$(read_package_field name)"
  version="$(read_package_field version)"
  vsix_file="$RELEASE_DIR/${name}-${version}.vsix"

  [[ -f "$vsix_file" ]] || fail "VSIX not found: $vsix_file"

  installed=0

  if has_cmd code; then
    echo "Installing into VS Code..."
    code --install-extension "$vsix_file" --force
    installed=1
  else
    echo "VS Code CLI not found: code"
  fi

  if has_cmd code-server; then
    echo "Installing into code-server..."
    code-server --install-extension "$vsix_file" --force
    installed=1
  else
    echo "code-server CLI not found: code-server"
  fi

  [[ "$installed" -eq 1 ]] || fail "No supported editor CLI found. Expected code or code-server."
}

build_package_only() {
  package_extension
}

build_package_and_install() {
  package_extension
  install_extension
}

interactive_menu() {
  cat <<'EOF'
MEO VSIX Release
1. 编译打包
2. 编译打包并安装
EOF

  local choice
  read -r -p "请选择 [1-2]: " choice

  case "$choice" in
    1) build_package_only ;;
    2) build_package_and_install ;;
    *) fail "Invalid choice: $choice" ;;
  esac
}

main() {
  local command="${1:-}"

  case "$command" in
    "")
      if [[ -t 0 ]]; then
        interactive_menu
      else
        usage
        exit 2
      fi
      ;;
    package|build)
      build_package_only
      ;;
    install)
      build_package_and_install
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage
      fail "Unknown command: $command"
      ;;
  esac
}

main "$@"
