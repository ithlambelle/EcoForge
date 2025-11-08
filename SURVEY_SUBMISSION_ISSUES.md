# Survey Submission and Reset Issues

## Problem Summary
Multiple issues affecting the DropQuery extension's survey submission and data reset functionality.

---

## Issue 1: Survey Submission Resets Instead of Completing

### Status
🔴 **UNRESOLVED** - Survey form resets when "Start Tracking" button is clicked instead of showing the dashboard.

### Symptoms
- User fills out survey and clicks "Start Tracking"
- Instead of showing the dashboard, the survey form resets/clears
- User is stuck in the survey loop
- `surveyCompleted` flag may not be persisting correctly

### Expected Behavior
1. User completes survey
2. Clicks "Start Tracking"
3. Survey data is saved to `chrome.storage.local`
4. `surveyCompleted` is set to `true`
5. Dashboard is displayed immediately
6. Survey form is hidden

### Root Cause Analysis
Potential causes:
1. **Race Condition**: Initial state check runs before storage is saved
2. **Storage Listener Interference**: Storage change listeners may be resetting state
3. **Popup Reload**: Popup may be reloading and checking state before it's saved
4. **State Not Persisting**: `surveyCompleted` flag may be getting cleared immediately after being set

### Attempted Fixes

#### Fix 1: Clear isResetting Flag
- **What**: Clear `isResetting` flag when completing survey
- **Result**: No change

#### Fix 2: Multiple Verification Checks
- **What**: Added multiple verification checks after saving state
- **Result**: No change

#### Fix 3: Immediate UI Update
- **What**: Switch to dashboard immediately after saving, before async operations
- **Result**: No change

#### Fix 4: Storage Change Listener
- **What**: Added listener to detect when `surveyCompleted` changes to `true` and switch UI
- **Result**: No change

#### Fix 5: Synchronous DOM Manipulation
- **What**: Directly manipulate DOM immediately after saving state
- **What**: Added flag to prevent initial state check from interfering
- **Result**: Pending testing

### Current Implementation
```javascript
// Survey submission handler
surveyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Disable form
  // Collect survey answers
  // Save to storage with surveyCompleted: true
  // Immediately update UI (synchronous DOM manipulation)
  // Verify state was saved
  // Set flag to prevent race conditions
});
```

### Debug Logs Added
- `💧 DropQuery: Survey form submitted`
- `💧 DropQuery: Storage saved with surveyCompleted: true`
- `💧 DropQuery: First verification`
- `💧 DropQuery: Switching to dashboard view IMMEDIATELY`
- `💧 DropQuery: Dashboard visible, survey hidden`
- `💧 DropQuery: Final verification`

### Files Affected
- `popup.js`: Survey submission handler, state checking, UI switching

### Next Steps
1. Check browser console for debug logs
2. Verify `surveyCompleted` is actually being saved to storage
3. Check if popup is reloading after submission
4. Investigate if storage listeners are clearing the state
5. Test with Chrome DevTools storage inspector

---

## Issue 2: Reset Data Functionality Not Working

### Status
🟡 **PARTIALLY FIXED** - Some improvements made but may still have issues.

### Symptoms
- When clicking "Reset Data" button:
  - Tracker box (square element) does not reset to "0 queries" and "0.0000 ml"
  - Dashboard stats in popup do not reset to zero
  - Water bottle fill level does not reset to 0%
  - Values persist even after storage is cleared

### Expected Behavior
1. Click "Reset Data" button
2. Confirm reset
3. All storage data is cleared
4. Tracker box resets to "0 queries" and "0.0000 ml"
5. Water bottle fill resets to 0%
6. Dashboard stats reset to zero
7. Survey form is shown again
8. UI elements are hidden until survey is completed

### Root Cause
1. **Periodic Update Overwriting Reset**: The `setInterval` that runs every 5 seconds was reading from storage and potentially overwriting reset values
2. **Storage Change Listener**: The popup wasn't listening for storage changes to update dashboard stats in real-time
3. **Reset Handler Timing**: The reset message handler wasn't properly coordinating with the periodic update

### Fixes Applied
1. ✅ Added `isResetting` flag to prevent periodic updates during reset
2. ✅ Centralized `resetUIToZero()` function for consistent UI reset
3. ✅ Modified periodic update to check `isResetting` and `surveyCompleted` flags
4. ✅ Added storage change listener to popup for real-time dashboard updates
5. ✅ Updated reset handler to set flag, clear storage, reset UI, then clear flag

### Files Affected
- `content.js`: Reset handler, periodic update logic, `resetUIToZero()` function
- `popup.js`: Reset button handler, dashboard update logic, storage listeners

### Remaining Issues
- Periodic update may still overwrite values in edge cases
- Timing issues between storage clear and UI updates may occur
- Dashboard stats may not update immediately in all scenarios

---

## Issue 3: Unit Conversion Not Working

### Status
🟡 **PARTIALLY FIXED** - Conversion logic implemented but may have issues.

### Symptoms
- Unit toggle button in popup settings doesn't convert values correctly
- Tracker box (square) doesn't show converted values when unit is changed
- Water bottle label doesn't update with converted units
- Values remain in ml regardless of selected unit (ml/gallons/ounces)

### Expected Behavior
1. User clicks unit toggle button (ml → gallons → ounces)
2. All displayed values convert to the selected unit
3. Tracker box shows converted value
4. Dashboard stats show in selected unit
5. Water bottle label shows capacity in selected unit
6. Conversion is mathematically accurate

### Conversion Constants
- 1 US gallon = 3785.41 ml
- 1 US fluid ounce = 29.5735 ml

### Root Cause
1. `formatWaterUsage()` was not reading unit from storage
2. Display functions were not using the selected unit
3. Storage change events were not triggering display updates
4. Content script and popup had different unit state

### Fixes Applied
1. ✅ Made `formatWaterUsage()` async to always read unit from storage
2. ✅ Updated all `formatWaterUsage()` calls to use `await`
3. ✅ Updated `updateSquareDisplay()` and `updateBottleDisplay()` to read unit from storage
4. ✅ Added storage listeners to refresh displays when unit changes
5. ✅ Fixed async/await issues throughout the codebase

### Files Affected
- `content.js`: `formatWaterUsage()`, `updateSquareDisplay()`, `updateBottleDisplay()`, unit conversion
- `popup.js`: `formatWaterUsage()`, `updateDashboard()`, unit toggle button handler

### Remaining Issues
- Unit conversion may not work consistently across all displays
- Some edge cases with very small or very large values may not format correctly

---

## Testing Checklist

### Survey Submission
- [ ] Fill out survey completely
- [ ] Click "Start Tracking"
- [ ] Verify dashboard appears immediately
- [ ] Verify survey form is hidden
- [ ] Check console for debug logs
- [ ] Verify `surveyCompleted` is `true` in storage
- [ ] Close and reopen popup - should show dashboard

### Reset Data
- [ ] Complete survey and accumulate some usage
- [ ] Click "Reset Data" button
- [ ] Confirm reset
- [ ] Verify tracker box resets to "0 queries" and "0.0000 ml"
- [ ] Verify water bottle fill resets to 0%
- [ ] Verify dashboard stats reset to zero
- [ ] Verify survey form is shown again
- [ ] Verify UI elements are hidden

### Unit Conversion
- [ ] Complete survey and start tracking
- [ ] Generate some queries to accumulate water usage
- [ ] Click unit toggle button (ml → gallons → ounces)
- [ ] Verify dashboard stats convert correctly
- [ ] Verify tracker box shows converted value
- [ ] Verify water bottle label shows converted capacity
- [ ] Verify values are mathematically correct

---

## Debugging Commands

### Check Storage State
```javascript
// In browser console
chrome.storage.local.get(null, (data) => console.log(data));
```

### Check surveyCompleted
```javascript
chrome.storage.local.get(['surveyCompleted'], (data) => console.log(data));
```

### Manually Set surveyCompleted
```javascript
chrome.storage.local.set({ surveyCompleted: true }, () => {
  console.log('Set to true');
});
```

### Clear All Storage
```javascript
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
});
```

---

## Related Files
- `popup.js` - Survey submission, reset handler, unit conversion
- `content.js` - Reset handler, unit conversion, UI updates
- `popup.html` - Survey form structure
- `RESET_AND_CONVERSION_ISSUES.md` - Previous issue documentation

---

## Notes
- Extension name changed from "Waterer" to "DropQuery"
- All console logs use "DropQuery" prefix
- Debug logging is extensive to help identify issues
- Storage listeners are set up to handle state changes in real-time

