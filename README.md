# Waterer - AI Water Usage Tracker

A Chrome extension that tracks and visualizes water usage from AI model queries (ChatGPT, Gemini, etc.) with positive reinforcement to promote sustainable AI usage.

## Features

- 💧 **Real-time Water Usage Tracking**: Monitors queries to ChatGPT, Gemini, and other AI models
- 📊 **Personalized Dashboard**: Calculates your average usage based on an initial survey
- 🎯 **Positive Reinforcement**: Shows how your water savings compare to children, animals, and communities in need
- 🎨 **Interactive UI**: Draggable water bottle and usage square with smooth animations
- 📈 **Usage Analytics**: Track daily, weekly, and total water usage
- 🔔 **Smart Notifications**: Get notified about your usage patterns
- ☁️ **Cloud Sync**: Data synced to Supabase for collective impact tracking

## Installation

1. Clone this repository:
```bash
git clone git@github.com:Jaja-626/EcoForge.git
cd EcoForge
```

2. **Create Extension Icons** (required):
   - Open `create-icons.html` in your browser
   - Click the download buttons to generate `icon16.png`, `icon48.png`, and `icon128.png`
   - Place these files in the `icons/` folder
   - Alternatively, create custom icons using design tools (see `icons/README.md`)

3. **Set up Supabase**:
   - Go to your Supabase project dashboard
   - Open the SQL Editor
   - Run the SQL commands from `supabase-schema.sql` to create the necessary tables

4. **Load Extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the extension directory
   - The extension should now appear in your extensions list

5. **First Use**:
   - Click the extension icon in your Chrome toolbar
   - Complete the initial survey
   - Start using ChatGPT or Gemini - the extension will automatically track your usage!

## Setup

### Supabase Configuration

The extension requires Supabase tables to be set up. Create the following tables:

#### Users Table
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  survey_answers JSONB,
  average_usage INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Queries Table
```sql
CREATE TABLE queries (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id),
  model TEXT,
  water_usage INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Collective Totals Table
```sql
CREATE TABLE collective_totals (
  id SERIAL PRIMARY KEY,
  total_usage INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage

1. **Initial Survey**: Complete the survey when you first open the extension
   - How often you use AI models
   - Your awareness of water usage
   - Purpose of AI usage
   - Screen time

2. **Tracking**: The extension automatically tracks:
   - ChatGPT queries
   - Gemini queries
   - Other AI model interactions

3. **Visual Feedback**: 
   - Rounded square shows query count and water usage
   - Water bottle fills up as you use AI (500ml or 1 gallon based on your average)
   - Messages appear showing your impact

4. **Dashboard**: Click the extension icon to see:
   - Today's usage
   - Weekly usage
   - Total usage
   - Comparison to your average
   - Positive/negative reinforcement messages

## Water Usage Calculation

The extension estimates water usage based on:
- Query length and complexity
- AI model type
- Research-based calculations (to be refined)

Current estimates:
- Base query: ~20-50ml
- Additional usage based on text length
- Model-specific multipliers

## Development

### Project Structure

```
waterer/
├── manifest.json          # Extension manifest
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic and survey
├── content.js            # Content script for tracking
├── content.css           # Styles for injected UI
├── background.js         # Service worker for Supabase
├── icons/                # Extension icons
└── README.md            # This file
```

### Making Changes

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes (use lowercase comments)

3. Test the extension:
   - Reload the extension in `chrome://extensions/`
   - Test on ChatGPT, Gemini, etc.

4. Commit and push:
```bash
git add .
git commit -m "your commit message"
git push origin feature/your-feature-name
```

## Supabase API

The extension uses Supabase for:
- Storing user survey data
- Tracking individual queries
- Maintaining collective water usage totals
- Syncing data across devices

**Important**: The API key in `background.js` should be kept secure and not shared publicly.

## Future Enhancements

- [ ] Research-based water usage calculations
- [ ] Support for more AI models (Claude, Perplexity, etc.)
- [ ] Advanced analytics and charts
- [ ] Social sharing of water savings
- [ ] Gamification elements
- [ ] Export usage data
- [ ] Customizable water bottle designs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with lowercase comments
4. Submit a pull request

## License

MIT License

## Inspiration

Inspired by extensions like Opal (time tracking) and Grammarly (writing assistance), Waterer focuses on making invisible environmental impacts visible and actionable.

