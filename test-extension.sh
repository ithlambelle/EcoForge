#!/bin/bash
# test-extension.sh - validation and testing script for Waterer extension

echo "🧪 Testing Waterer Chrome Extension"
echo "===================================="
echo ""

# check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Error: manifest.json not found. Run this script from the extension root directory."
    exit 1
fi

echo "✓ Found manifest.json"

# validate manifest.json
echo ""
echo "📋 Validating manifest.json..."
if node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))" 2>/dev/null; then
    echo "✓ manifest.json is valid JSON"
else
    echo "❌ manifest.json is invalid JSON"
    exit 1
fi

# check required files
echo ""
echo "📁 Checking required files..."
required_files=(
    "manifest.json"
    "popup.html"
    "popup.css"
    "popup.js"
    "content.js"
    "content.css"
    "background.js"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "❌ $file is missing"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo ""
    echo "❌ Missing required files. Please ensure all files are present."
    exit 1
fi

# check icons
echo ""
echo "🖼️  Checking icons..."
icon_sizes=(16 48 128)
missing_icons=()
for size in "${icon_sizes[@]}"; do
    if [ -f "icons/icon${size}.png" ]; then
        echo "✓ icons/icon${size}.png"
    else
        echo "⚠️  icons/icon${size}.png is missing (will show default icon)"
        missing_icons+=("icon${size}.png")
    fi
done

# check JavaScript syntax
echo ""
echo "🔍 Checking JavaScript syntax..."
js_files=("popup.js" "content.js" "background.js")
js_errors=0

for file in "${js_files[@]}"; do
    if node -c "$file" 2>/dev/null; then
        echo "✓ $file syntax is valid"
    else
        echo "❌ $file has syntax errors"
        node -c "$file" 2>&1
        js_errors=$((js_errors + 1))
    fi
done

if [ $js_errors -gt 0 ]; then
    echo ""
    echo "❌ Found JavaScript syntax errors. Please fix them before loading the extension."
    exit 1
fi

# summary
echo ""
echo "===================================="
echo "📊 Test Summary"
echo "===================================="
echo "✓ All required files present"
echo "✓ manifest.json is valid"
echo "✓ JavaScript files have valid syntax"

if [ ${#missing_icons[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Missing icons:"
    for icon in "${missing_icons[@]}"; do
        echo "   - $icon"
    done
    echo ""
    echo "💡 To create icons:"
    echo "   1. Open create-icons.html in your browser"
    echo "   2. Download the PNG icons"
    echo "   3. Place them in the icons/ folder"
    echo ""
    echo "   OR temporarily comment out icon references in manifest.json"
else
    echo "✓ All icons present"
fi

echo ""
echo "✅ Extension is ready to load!"
echo ""
echo "📝 Next steps:"
echo "   1. Open Chrome and go to chrome://extensions/"
echo "   2. Enable 'Developer mode' (toggle in top right)"
echo "   3. Click 'Load unpacked'"
echo "   4. Select this directory: $(pwd)"
echo "   5. Complete the survey in the extension popup"
echo "   6. Visit chatgpt.com or gemini.google.com to test tracking"
echo ""

