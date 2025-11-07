# Testing Guide

## Quick Test Results

✅ **All core files validated**
- manifest.json: Valid JSON
- All JavaScript files: Valid syntax
- All required files: Present

⚠️ **Icons needed**: Generate icons using `create-icons.html` or the method below.

## Running the Tests

```bash
./test-extension.sh
```

This will:
- Validate manifest.json
- Check all required files exist
- Verify JavaScript syntax
- Check for icon files
- Provide next steps

## Manual Testing Steps

### 1. Generate Icons (if not done)

**Option A: Using the HTML tool**
```bash
open create-icons.html
# Then click download buttons for each icon size
```

**Option B: Using Python (if PIL/Pillow installed)**
```bash
pip install Pillow
python3 generate-icons.py
```

**Option C: Temporary workaround**
Comment out icon references in `manifest.json` (lines 32-36 and 38-42) to test without icons.

### 2. Load Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `/Users/culubo/Desktop/waterer` directory
6. Extension should appear in the list

### 3. Test Survey

1. Click the extension icon in Chrome toolbar
2. Fill out the survey:
   - Usage frequency: Select "Every day"
   - Water awareness: Select "Frequently"
   - Usage purpose: Select "Tool"
   - Screen time: Enter "8"
3. Click "Start Tracking"
4. Dashboard should appear

### 4. Test UI Elements

1. Open a new tab with any website
2. You should see:
   - **Rounded square** (top right) showing "0" queries and "0 ml"
   - **Water bottle** (bottom left) showing empty
3. Try dragging both elements
4. Hover over elements to see animations
5. Click close button (×) to remove elements

### 5. Test Query Tracking

**Test on ChatGPT:**
1. Go to https://chatgpt.com
2. Log in if needed
3. Type a message in the chat
4. Press Enter or click Send
5. Check:
   - Square should update with query count and water usage
   - Water bottle should fill slightly
   - Message should appear showing impact
   - Send multiple messages to see accumulation

**Test on Gemini:**
1. Go to https://gemini.google.com
2. Type a message
3. Send it
4. Verify tracking works (same as ChatGPT)

### 6. Test Dashboard

1. Click extension icon
2. Verify stats show:
   - Today's Usage: Should match queries sent
   - Weekly Usage: Should accumulate
   - Total Usage: Should show all-time total
   - Your Average: Should show calculated average from survey
3. Check comparison message (positive/negative based on usage)

### 7. Test Settings

1. In popup, change "Notification Frequency"
2. Click "Reset Data" (confirm)
3. Survey should reappear

### 8. Test Supabase Integration

1. Check browser console (F12) for any Supabase errors
2. Go to Supabase dashboard
3. Check if data appears in tables:
   - `users` table should have your user record
   - `queries` table should have query records
   - `collective_totals` should have total usage

### 9. Test Notifications

1. Wait for notification time (or trigger manually in background.js)
2. Should see Chrome notification with usage summary

## Expected Behavior

### On Page Load
- Square appears with animation (slide up)
- Water bottle appears at bottom left
- Both are draggable

### On Query
- Query count increments
- Water usage increases
- Bottle fill level increases
- Message appears for 5 seconds
- Data saves to Chrome storage
- Data syncs to Supabase

### Water Bottle
- Fills as usage increases
- Resets when full (500ml or 1 gallon based on average)
- Shows wave animation when filling
- Tracks total bottles filled

### Messages
- Positive: When below average (green border)
- Negative: When above average (red border)
- Neutral: When on track
- Compares to children, dogs, communities

## Troubleshooting

### Extension won't load
- Check `chrome://extensions/` for errors
- Verify all files are in correct location
- Check manifest.json is valid

### Icons not showing
- Generate icons using `create-icons.html`
- Or comment out icon references in manifest.json

### Tracking not working
- Check browser console for errors
- Verify you're on chatgpt.com or gemini.google.com
- Check content script is injected (DevTools > Sources > Content scripts)

### Supabase errors
- Verify API key in background.js
- Check tables are created in Supabase
- Check browser console for specific errors

### UI not appearing
- Check if survey is completed
- Verify content script permissions
- Check for JavaScript errors in console

## Automated Testing

Run the test script:
```bash
./test-extension.sh
```

This validates:
- File structure
- JSON syntax
- JavaScript syntax
- Icon presence

## Manual Checklist

- [ ] Extension loads without errors
- [ ] Survey appears on first use
- [ ] Dashboard shows after survey
- [ ] Square appears on pages
- [ ] Water bottle appears on pages
- [ ] Elements are draggable
- [ ] Elements can be removed
- [ ] Queries are tracked on ChatGPT
- [ ] Queries are tracked on Gemini
- [ ] Water usage updates correctly
- [ ] Messages appear after queries
- [ ] Dashboard updates correctly
- [ ] Settings work
- [ ] Data persists after reload
- [ ] Supabase sync works (check dashboard)

## Performance Testing

- Test with multiple tabs open
- Test with many queries (100+)
- Test dragging performance
- Test animation smoothness
- Check memory usage in Chrome Task Manager

## Browser Compatibility

Tested on:
- Chrome (latest)
- Edge (Chromium)

Should work on any Chromium-based browser with Manifest V3 support.

