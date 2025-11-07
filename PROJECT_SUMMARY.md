# Waterer Project Summary

## Overview
Waterer is a Chrome extension that tracks water usage from AI model queries (ChatGPT, Gemini, etc.) and provides positive reinforcement to encourage sustainable AI usage.

## Project Structure

```
waterer/
├── manifest.json              # Chrome extension manifest (Manifest V3)
├── popup.html                 # Extension popup UI
├── popup.css                  # Popup styles
├── popup.js                   # Popup logic, survey, dashboard
├── content.js                 # Content script - tracks queries, injects UI
├── content.css                # Styles for injected UI elements
├── background.js              # Service worker - Supabase integration, notifications
├── icons/                     # Extension icons (need to be created)
│   └── README.md
├── supabase-schema.sql        # Database schema for Supabase
├── create-icons.html          # Tool to generate placeholder icons
├── README.md                  # Main documentation
├── INSTALL.md                 # Installation guide
├── package.json               # Project metadata
└── .gitignore                 # Git ignore rules
```

## Key Features Implemented

### 1. Survey System ✅
- Initial survey with 4 questions:
  - AI usage frequency (daily/sometimes/never)
  - Water awareness level
  - AI usage purpose (roleplay/tool/discussion/other)
  - Screen time (hours per day)
- Calculates personalized average usage based on survey answers

### 2. Water Usage Tracking ✅
- Monitors ChatGPT queries
- Monitors Gemini queries
- Network request interception
- DOM observation for chat interfaces
- Dynamic water usage calculation based on query characteristics

### 3. UI Components ✅
- **Rounded Square**: Shows query count and water usage
  - Appears on page load with animation
  - Hover and click animations
  - Draggable
  - Removable (close button)
- **Water Bottle**: Visual representation of water usage
  - 500ml bottle for average users
  - 1 gallon bottle for heavy users
  - Fills up as usage increases
  - Physics animations (wave effect)
  - Draggable
  - Resets when full, tracks total bottles filled

### 4. Positive/Negative Reinforcement ✅
- Compares daily usage to personal average
- Shows messages comparing to:
  - Children in need (2L per child per day)
  - Dogs/animal shelters (1L per dog per day)
  - Villages/communities
- Positive messages when below average
- Warning messages when above average
- Messages appear for 5 seconds after each query

### 5. Supabase Integration ✅
- Stores user survey data
- Tracks individual queries
- Maintains collective water usage totals
- Syncs data across sessions
- API key configured (keep secure!)

### 6. Dashboard ✅
- Today's usage
- Weekly usage
- Total usage
- Personal average
- Comparison messages
- Settings (notification frequency, reset data)

### 7. Notifications ✅
- Daily/weekly/yearly summaries
- Configurable frequency
- Shows usage statistics and comparisons

### 8. Animations & Interactions ✅
- Appear animation on load
- Hover effects (color change, rise)
- Click animations
- Draggable elements
- Removable elements
- Water bottle physics (wave animation)
- Message popup animations

## Technical Implementation

### Chrome Extension Architecture
- **Manifest V3**: Modern Chrome extension format
- **Content Scripts**: Injected into web pages to track AI queries
- **Service Worker**: Background script for Supabase and notifications
- **Popup**: User interface for settings and dashboard

### Water Usage Calculation
Current estimation (to be refined with research):
- Base query: 20-50ml
- Additional usage based on text length
- Model-specific multipliers
- Survey-based personalization

### Data Storage
- **Chrome Storage API**: Local storage for user data
- **Supabase**: Cloud storage for:
  - User profiles
  - Query history
  - Collective totals

## Next Steps / TODO

1. **Research-Based Calculations**: Replace placeholder water usage estimates with research-based data
2. **Icon Creation**: Create professional icons (use `create-icons.html` for placeholders)
3. **Testing**: Test on actual ChatGPT and Gemini sites
4. **Additional AI Models**: Add support for Claude, Perplexity, etc.
5. **Refinement**: Improve query detection accuracy
6. **UI Polish**: Fine-tune animations and interactions
7. **Error Handling**: Add better error handling for Supabase failures
8. **Analytics**: Add usage analytics and charts

## Supabase Setup Required

Run `supabase-schema.sql` in your Supabase SQL editor to create:
- `users` table
- `queries` table
- `collective_totals` table
- Indexes and triggers

## Git Workflow

- Use lowercase comments
- Create separate branches for new features
- Follow the branch naming: `feature/feature-name`

## API Security Note

⚠️ **Important**: The Supabase API key in `background.js` should be kept secure. Consider using environment variables or Chrome's secret storage in production.

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Development Commands

```bash
# Load extension in Chrome
1. Go to chrome://extensions/
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the waterer directory

# After making changes
1. Go to chrome://extensions/
2. Click reload icon on extension card
3. Refresh the page you're testing on
```

## Known Limitations

1. Query detection may not catch all AI interactions (depends on site structure)
2. Water usage calculations are estimates (need research validation)
3. Icons need to be created (use `create-icons.html`)
4. Supabase tables need to be created manually
5. No authentication system (uses generated user IDs)

## Future Enhancements

- [ ] Research-based water usage calculations
- [ ] Support for more AI models
- [ ] Advanced analytics dashboard
- [ ] Social sharing features
- [ ] Gamification elements
- [ ] Export usage data
- [ ] Customizable themes
- [ ] Multi-language support

