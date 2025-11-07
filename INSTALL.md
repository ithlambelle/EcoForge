# Installation Guide

## Quick Start

1. **Set up Supabase**:
   - Go to your Supabase project: https://notfaymtecnsjzngmwma.supabase.co
   - Open the SQL Editor
   - Run the SQL commands from `supabase-schema.sql`
   - This creates the necessary tables for the extension

2. **Load Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `waterer` folder
   - The extension should now appear in your extensions list

3. **First Use**:
   - Click the extension icon in your Chrome toolbar
   - Complete the initial survey
   - Start using ChatGPT or Gemini - the extension will automatically track your usage!

## Troubleshooting

### Extension not loading
- Make sure all files are in the correct location
- Check that `manifest.json` is valid JSON
- Look for errors in `chrome://extensions/` (click "Errors" button)

### Icons not showing
- Create icon files (16x16, 48x48, 128x128) in the `icons/` folder
- Or temporarily comment out icon references in `manifest.json`

### Supabase connection issues
- Verify your API key is correct in `background.js`
- Check that tables are created in Supabase
- Check browser console for error messages

### Tracking not working
- Make sure you're on a supported site (chatgpt.com, gemini.google.com)
- Check that content scripts are running (Chrome DevTools > Extensions > Inspect views)
- Verify permissions in `manifest.json` include the sites you're using

## Testing

1. Open ChatGPT or Gemini in a new tab
2. Send a message/query
3. You should see:
   - The rounded square appear (top right by default)
   - The water bottle appear (bottom left by default)
   - Query count and water usage update
   - A message appear showing your impact

## Development

To make changes:
1. Edit the files
2. Go to `chrome://extensions/`
3. Click the reload icon on the extension card
4. Refresh the page you're testing on

