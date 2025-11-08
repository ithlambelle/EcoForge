# Debug Checklist for Survey Submission Issue

## Quick Test Steps

### 1. Reload Extension
- Go to `chrome://extensions/`
- Find "DropQuery" (or "Waterer")
- Click the **reload** icon (circular arrow)
- **Close the popup if it's open**
- **Reopen the popup** (click extension icon)

### 2. Check Console Logs
Right-click the popup → **Inspect** → **Console** tab

**Before submitting:**
- Should see: `💧 DropQuery: State check`
- Should see: `💧 DropQuery: Survey not completed, showing survey form`

**When you click "Start Tracking":**
- Should see: `💧 DropQuery: ====== SUBMIT EVENT FIRED ======`
- Should see: `💧 DropQuery: Survey form submitted`
- Should see: `💧 DropQuery: Storage saved atomically`
- Should see: `💧 DropQuery: Post-save verification` (with `surveyCompleted: true`)
- Should see: `💧 DropQuery: Switching to dashboard view IMMEDIATELY`
- Should see: `💧 DropQuery: Dashboard visible, survey hidden`

### 3. Check Storage Directly
In the popup console, run:
```javascript
chrome.storage.local.get(null, (data) => {
  console.log('Storage contents:', data);
  console.log('surveyCompleted:', data.surveyCompleted);
  console.log('surveyCommitId:', data.surveyCommitId);
});
```

### 4. Manual Test
In popup console, run:
```javascript
chrome.storage.local.set({ surveyCompleted: true }, () => {
  console.log('Manually set surveyCompleted to true');
  location.reload(); // Reload popup
});
```

If the dashboard appears after this, the issue is with the submission handler.
If it doesn't, the issue is with the state check or UI switching.

### 5. Check for Errors
Look for any red errors in console:
- Syntax errors
- "Cannot read property" errors
- "Extension context invalidated" (this is normal during reloads)

## Common Issues

### Issue: Submit handler not firing
**Symptoms:** No "SUBMIT EVENT FIRED" log
**Fix:** Check if form has `action` attribute (shouldn't), check if button type is "submit"

### Issue: Storage not saving
**Symptoms:** Post-save verification shows `surveyCompleted: false`
**Fix:** Check Chrome storage permissions, check for storage quota issues

### Issue: UI not switching
**Symptoms:** Logs show storage saved but dashboard doesn't appear
**Fix:** Check CSS - dashboard might be hidden by CSS rules

### Issue: Popup reloading
**Symptoms:** Survey form appears again after submission
**Fix:** Check if popup is closing/reopening, check initial state check logic

## If Still Not Working

1. **Check if popup is closing:** Does the popup window close when you click submit?
2. **Check CSS:** Inspect dashboard container - is it actually `display: block`?
3. **Check storage listener:** Is the storage listener interfering?
4. **Try manual state set:** Use the manual test above to see if UI switching works

## Nuclear Option

If nothing works, try this in popup console:
```javascript
// Force complete survey
chrome.storage.local.set({
  surveyCompleted: true,
  surveyCommitId: 'manual-test-' + Date.now(),
  userData: { averageUsage: 0, dailyHistory: [] },
  dailyUsage: 0,
  weeklyUsage: 0,
  totalUsage: 0,
  queries: [],
  isResetting: false
}, () => {
  console.log('Forced survey completion');
  // Force UI switch
  document.getElementById('survey-container').style.display = 'none';
  document.getElementById('dashboard-container').classList.add('show');
  document.getElementById('dashboard-container').style.display = 'block';
  console.log('Forced UI switch');
});
```

If this works, the issue is in the submission handler.
If this doesn't work, the issue is in the UI switching or CSS.

