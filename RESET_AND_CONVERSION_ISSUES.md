# Reset and Unit Conversion Issues

## Problem Summary
Two critical issues affecting the Waterer extension:
1. Reset Data functionality not properly resetting UI elements and dashboard stats
2. Unit conversion (ml to gallons/ounces) not working correctly

## Issue 1: Reset Data Not Working

### Symptoms
- When clicking "Reset Data" button:
  - Tracker box (square element) does not reset to "0 queries" and "0.0000 ml"
  - Dashboard stats in popup do not reset to zero
  - Water bottle fill level does not reset to 0%
  - Values persist even after storage is cleared

### Expected Behavior
- Clicking "Reset Data" should:
  1. Clear all storage data
  2. Reset tracker box to "0 queries" and "0.0000 ml"
  3. Reset water bottle fill to 0%
  4. Reset all dashboard stats (Today's Usage, Weekly Usage, Total Usage, Average) to zero
  5. Hide UI elements until survey is completed again
  6. Reset comparison message to default state

### Current Implementation Issues
1. **Periodic Update Overwriting Reset**: The `setInterval` that runs every 5 seconds to update displays was reading from storage and potentially overwriting reset values
2. **Storage Change Listener**: The popup wasn't listening for storage changes to update dashboard stats in real-time
3. **Reset Handler Timing**: The reset message handler wasn't properly coordinating with the periodic update

### Files Affected
- `content.js`: Reset handler and periodic update logic
- `popup.js`: Reset button handler and dashboard update logic

### Attempted Fixes
- Added explicit reset of UI values in reset handler
- Modified periodic update to respect reset state (check `surveyCompleted`)
- Added storage change listener to popup for real-time dashboard updates
- Ensured periodic update hides UI and resets values when `surveyCompleted` is false

### Status
⚠️ **Partially Fixed** - Some improvements made but may still have issues with:
- Periodic update potentially still overwriting values
- Timing issues between storage clear and UI updates
- Dashboard stats not updating immediately

## Issue 2: Unit Conversion Not Working

### Symptoms
- Unit toggle button in popup settings doesn't convert values correctly
- Tracker box (square) doesn't show converted values when unit is changed
- Water bottle label doesn't update with converted units
- Values remain in ml regardless of selected unit (ml/gallons/ounces)

### Expected Behavior
- When unit is changed:
  1. All displayed values should convert to the selected unit
  2. Tracker box should show converted value (e.g., "0.0001 gal" instead of "0.322 ml")
  3. Dashboard stats should show in selected unit
  4. Water bottle label should show capacity in selected unit
  5. Conversion should be accurate:
     - 1 US gallon = 3785.41 ml
     - 1 US fluid ounce = 29.5735 ml

### Current Implementation
- Conversion constants defined:
  ```javascript
  const ML_TO_GALLON = 3785.41;
  const ML_TO_OUNCE = 29.5735;
  ```
- `convertToUnit()` function exists in both `content.js` and `popup.js`
- `formatWaterUsage()` function should handle unit conversion
- Unit preference is stored in `chrome.storage.local` as `waterUnit`

### Potential Issues
1. **Unit Not Being Read**: `updateSquareDisplay()` and `updateBottleDisplay()` may not be reading the current unit from storage
2. **Conversion Not Applied**: `formatWaterUsage()` may not be calling `convertToUnit()` correctly
3. **Unit Sync**: Content script and popup may not be syncing unit changes properly
4. **Storage Listener**: Unit changes in popup may not be triggering updates in content script

### Files Affected
- `content.js`: `formatWaterUsage()`, `updateSquareDisplay()`, `updateBottleDisplay()`, unit toggle logic
- `popup.js`: `formatWaterUsage()`, `updateDashboard()`, unit toggle button handler
- Unit conversion functions in both files

### Code Locations to Check
1. `content.js`:
   - `formatWaterUsage()` function (around line 450)
   - `updateSquareDisplay()` function (around line 309)
   - `updateBottleDisplay()` function (around line 470)
   - Storage change listener for `waterUnit` (around line 113)

2. `popup.js`:
   - `formatWaterUsage()` function
   - `updateDashboard()` function (around line 192)
   - Unit toggle button handler (around line 57)
   - Storage change listener for `waterUnit`

### Testing Steps
1. Complete survey and start tracking
2. Generate some queries to accumulate water usage
3. Click unit toggle button in popup (ml → gallons → ounces)
4. Verify:
   - Dashboard stats convert correctly
   - Tracker box shows converted value
   - Water bottle label shows converted capacity
   - Values are mathematically correct

### Expected Conversion Examples
- 0.322 ml = 0.0000851 gallons = 0.0109 ounces
- 5 ml = 0.00132 gallons = 0.169 ounces
- 3785.41 ml = 1 gallon = 128 ounces

## Root Cause Analysis

### Reset Issue
The periodic update interval (every 5 seconds) was reading from storage and updating displays, potentially overwriting reset values. The reset handler was setting values to zero, but the periodic update would read from storage (which might still have old values due to timing) and overwrite the reset.

### Conversion Issue
Likely causes:
1. `formatWaterUsage()` may not be receiving the correct unit parameter
2. Unit may not be read from storage before formatting
3. Storage change events may not be properly triggering display updates
4. Content script and popup may have different unit state

## Recommended Fixes

### For Reset Issue
1. Ensure periodic update checks `surveyCompleted` before updating
2. When `surveyCompleted` is false, explicitly set all values to zero
3. Add flag to prevent periodic update from running during reset
4. Ensure storage is fully cleared before any updates occur

### For Conversion Issue
1. Verify `formatWaterUsage()` always receives the correct unit
2. Ensure `currentUnit` is read from storage before formatting
3. Add storage change listener in content script to update displays when unit changes
4. Test conversion math with known values
5. Add console logging to debug unit conversion flow

## Priority
🔴 **High** - Both issues affect core functionality:
- Reset is a critical user feature
- Unit conversion is a key setting that users expect to work

## Related Files
- `content.js`
- `popup.js`
- `popup.html`
- `content.css` (for unit display styling)

