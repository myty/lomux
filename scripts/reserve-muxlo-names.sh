#!/bin/bash
set -e

# Muxlo Name Reservation Script
# Locks in muxlo branding across npm and JSR in correct sequence to minimize race conditions

echo "=== Muxlo Name Reservation Sequence ==="
echo ""
echo "This script will:"
echo "  1. Verify npm authentication"
echo "  2. Reserve unscoped npm package: muxlo"
echo "  3. Reserve scoped npm package: @muxlo/muxlo"
echo "  4. Reserve JSR package: @muxlo/muxlo (via deno publish)"
echo ""

# Step 1: Verify npm auth
echo "[1/4] Verifying npm authentication..."
if ! npm whoami > /dev/null 2>&1; then
  echo "ERROR: Not logged into npm. Run 'npm login' first."
  exit 1
fi
NPM_USER=$(npm whoami)
echo "✓ Authenticated as: $NPM_USER"
echo ""

# Step 2: Reserve unscoped npm package
echo "[2/4] Reserving unscoped npm package 'muxlo'..."
RESERVE_DIR=$(mktemp -d)
trap "rm -rf $RESERVE_DIR" EXIT

cd "$RESERVE_DIR"
npm init -y > /dev/null 2>&1
npm pkg set name=muxlo version=0.0.0 description="name reservation" license="UNLICENSED"
echo "module.exports={};" > index.js

if npm publish --access public > /dev/null 2>&1; then
  echo "✓ Successfully published muxlo@0.0.0 to npm"
else
  echo "ERROR: Failed to publish muxlo. Package may already exist or your npm account lacks publish rights."
  exit 1
fi
echo ""

# Step 3: Reserve scoped npm package
echo "[3/4] Reserving scoped npm package '@muxlo/muxlo'..."
SCOPE_DIR=$(mktemp -d)
trap "rm -rf $RESERVE_DIR $SCOPE_DIR" EXIT

cd "$SCOPE_DIR"
npm init -y > /dev/null 2>&1
npm pkg set name=@muxlo/muxlo version=0.0.0 description="scope reservation" license="UNLICENSED"
echo "module.exports={};" > index.js

if npm publish --access public > /dev/null 2>&1; then
  echo "✓ Successfully published @muxlo/muxlo@0.0.0 to npm"
else
  echo "ERROR: Failed to publish @muxlo/muxlo. Ensure muxlo npm scope exists and you have access."
  echo "       You may need to create the npm org scope first: npm org create muxlo"
  exit 1
fi
echo ""

# Step 4: Reserve JSR package via deno publish
echo "[4/4] Reserving JSR package '@muxlo/muxlo'..."
echo "      (This requires deno.json to have name: '@muxlo/muxlo')"
echo ""

cd - > /dev/null
if [ -f "deno.json" ]; then
  PKG_NAME=$(grep '"name"' deno.json | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  if [ "$PKG_NAME" = "@muxlo/muxlo" ]; then
    echo "✓ deno.json package name is correctly set to @muxlo/muxlo"
    echo ""
    echo "Run the following in your repo root when ready:"
    echo "  deno publish --dry-run    # Verify publication would succeed"
    echo "  deno publish              # Publish to JSR and lock in the name"
    echo ""
  else
    echo "ERROR: deno.json package name is '$PKG_NAME', expected '@muxlo/muxlo'"
    exit 1
  fi
else
  echo "ERROR: deno.json not found in current directory"
  exit 1
fi

echo "=== Reservation Complete ==="
echo ""
echo "Summary:"
echo "  ✓ npm package 'muxlo' reserved"
echo "  ✓ npm scope '@muxlo/muxlo' reserved"
echo "  ⏳ JSR package '@muxlo/muxlo' - ready for deno publish"
echo ""
echo "Next steps:"
echo "  1. Create GitHub org 'muxlo' (if not already done)"
echo "  2. Run: deno publish"
echo "  3. Rename GitHub repo from ardo to muxlo"
echo "  4. Update documentation with new branding"
echo ""
