// popup.js - handles popup UI and survey

document.addEventListener('DOMContentLoaded', async () => {
  const surveyContainer = document.getElementById('survey-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const surveyForm = document.getElementById('survey-form');
  
  // check if user has completed survey
  const surveyData = await chrome.storage.local.get(['surveyCompleted', 'userData', 'dailyUsage']);
  
  if (surveyData.surveyCompleted) {
    showDashboard();
    await updateDashboard();
  } else {
    surveyContainer.style.display = 'block';
    dashboardContainer.style.display = 'none';
    
    // initialize survey water usage tracking
    let surveyWaterUsage = surveyData.dailyUsage || 0;
    updateSurveyWaterDisplay(surveyWaterUsage);
    
    // add incremental water usage as questions are answered
    setupSurveyIncrements(surveyWaterUsage);
  }
  
  // handle survey submission
  surveyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const surveyAnswers = {
      usageFrequency: document.getElementById('usage-frequency').value,
      waterAwareness: document.getElementById('water-awareness').value,
      usagePurpose: document.getElementById('usage-purpose').value,
      screenTime: parseFloat(document.getElementById('screen-time').value)
    };
    
    // get current survey water usage
    const currentData = await chrome.storage.local.get(['dailyUsage']);
    const surveyWaterUsage = currentData.dailyUsage || 0;
    
    // calculate estimated average usage based on survey
    const estimatedAverage = calculateAverageUsage(surveyAnswers);
    
    const userData = {
      surveyAnswers,
      averageUsage: estimatedAverage,
      dailyUsage: surveyWaterUsage, // preserve survey water usage
      weeklyUsage: surveyWaterUsage,
      totalUsage: surveyWaterUsage,
      queries: [],
      createdAt: new Date().toISOString()
    };
    
    await chrome.storage.local.set({
      surveyCompleted: true,
      userData: userData,
      dailyUsage: surveyWaterUsage,
      weeklyUsage: surveyWaterUsage,
      totalUsage: surveyWaterUsage
    });
    
    // send to supabase
    await saveUserDataToSupabase(userData);
    
    showDashboard();
    await updateDashboard();
  });
  
  // handle notification frequency change
  const notificationFrequency = document.getElementById('notification-frequency');
  if (notificationFrequency) {
    notificationFrequency.addEventListener('change', async (e) => {
      await chrome.storage.local.set({ notificationFrequency: e.target.value });
    });
  }
  
  // handle reset data
  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all your data?')) {
        await chrome.storage.local.clear();
        surveyContainer.style.display = 'block';
        dashboardContainer.style.display = 'none';
      }
    });
  }
});

function showDashboard() {
  document.getElementById('survey-container').style.display = 'none';
  document.getElementById('dashboard-container').classList.add('show');
}

async function updateDashboard() {
  const data = await chrome.storage.local.get(['userData', 'dailyUsage', 'weeklyUsage', 'totalUsage']);
  const userData = data.userData || {};
  
  // update stats
  document.getElementById('today-usage').textContent = formatWaterUsage(data.dailyUsage || 0);
  document.getElementById('week-usage').textContent = formatWaterUsage(data.weeklyUsage || 0);
  document.getElementById('total-usage').textContent = formatWaterUsage(data.totalUsage || 0);
  document.getElementById('avg-usage').textContent = formatWaterUsage(userData.averageUsage || 0);
  
  // update comparison message (this will now show random variations)
  updateComparisonMessage(data.dailyUsage || 0, userData.averageUsage || 0);
  
  // also update periodically to show different messages
  setTimeout(() => {
    updateComparisonMessage(data.dailyUsage || 0, userData.averageUsage || 0);
  }, 5000);
}

// water usage per survey question (in ml)
// based on research: average AI query = 0.3ml, survey represents learning about water usage
const SURVEY_QUESTION_WATER_USAGE = {
  'usage-frequency': 0.5,    // learning about frequency
  'water-awareness': 0.3,    // learning about awareness
  'usage-purpose': 0.4,      // learning about purpose
  'screen-time': 0.3         // learning about screen time
};

function setupSurveyIncrements(currentUsage) {
  // add water usage incrementally as questions are answered
  const questions = [
    { id: 'usage-frequency', usage: SURVEY_QUESTION_WATER_USAGE['usage-frequency'] },
    { id: 'water-awareness', usage: SURVEY_QUESTION_WATER_USAGE['water-awareness'] },
    { id: 'usage-purpose', usage: SURVEY_QUESTION_WATER_USAGE['usage-purpose'] },
    { id: 'screen-time', usage: SURVEY_QUESTION_WATER_USAGE['screen-time'] }
  ];
  
  questions.forEach(({ id, usage }) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', async () => {
        // check if we've already added water for this question
        const key = `survey_${id}_tracked`;
        const tracked = await chrome.storage.local.get([key]);
        
        if (!tracked[key]) {
          // add water usage for this question
          const data = await chrome.storage.local.get(['dailyUsage']);
          const newUsage = (data.dailyUsage || 0) + usage;
          
          await chrome.storage.local.set({
            dailyUsage: newUsage,
            [key]: true
          });
          
          updateSurveyWaterDisplay(newUsage);
          console.log(`💧 Waterer: Added ${parseFloat(usage.toFixed(4))}ml for answering ${id}`);
        }
      });
    }
  });
}

function updateSurveyWaterDisplay(usage) {
  // create or update water usage display in survey
  let display = document.getElementById('survey-water-display');
  if (!display) {
    display = document.createElement('div');
    display.id = 'survey-water-display';
    display.style.cssText = 'margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 8px; text-align: center;';
    const surveyForm = document.getElementById('survey-form');
    surveyForm.insertBefore(display, surveyForm.querySelector('.submit-btn'));
  }
  
  display.innerHTML = `
    <div style="font-size: 14px; color: #1976d2; font-weight: bold;">
      💧 Water used so far: <span id="survey-water-amount">${parseFloat(usage.toFixed(4))}</span> ml
    </div>
    <div style="font-size: 11px; color: #666; margin-top: 5px;">
      Each question you answer adds a small amount of water usage
    </div>
  `;
}

function calculateAverageUsage(surveyAnswers) {
  // base calculation based on survey answers
  // using accurate research data: average user makes ~100 queries/day
  // GPT: 0.322ml per query, average: 0.3ml per query
  // 100 queries * 0.3ml = 30ml base per day
  
  let baseUsage = 30; // base: 30ml per day (100 queries * 0.3ml)
  
  // usage frequency multiplier
  const frequencyMultiplier = {
    'daily': 2.0,      // daily users: ~200 queries/day = 60ml
    'sometimes': 0.7,  // sometimes: ~70 queries/day = 21ml
    'never': 0.1       // never: ~10 queries/day = 3ml
  };
  
  // purpose multiplier (roleplay uses more, tool uses less)
  const purposeMultiplier = {
    'roleplay': 1.5,   // more back-and-forth
    'discussion': 1.2, // conversational
    'tool': 0.8,       // focused queries
    'other': 1.0
  };
  
  // screen time multiplier (more screen time = more queries)
  const screenTimeMultiplier = Math.min(surveyAnswers.screenTime / 8, 1.5);
  
  baseUsage *= frequencyMultiplier[surveyAnswers.usageFrequency] || 1.0;
  baseUsage *= purposeMultiplier[surveyAnswers.usagePurpose] || 1.0;
  baseUsage *= screenTimeMultiplier;
  
  return Math.round(baseUsage);
}

function formatWaterUsage(ml) {
  if (ml < 1000) {
    return `${parseFloat(ml.toFixed(4))} ml`;
  } else if (ml < 1000000) {
    return `${parseFloat((ml / 1000).toFixed(4))} L`;
  } else {
    return `${parseFloat((ml / 1000000).toFixed(4))} m³`;
  }
}

function updateComparisonMessage(dailyUsage, averageUsage) {
  const comparisonCard = document.getElementById('comparison-message');
  const comparisonText = document.getElementById('comparison-text');
  
  if (!averageUsage || averageUsage === 0) {
    comparisonText.textContent = 'Track your first query to see your impact!';
    comparisonCard.className = 'comparison-card';
    return;
  }
  
  const difference = averageUsage - dailyUsage;
  const percentage = ((difference / averageUsage) * 100).toFixed(1);
  
  // accurate water needs (from research data)
  // Adult men: 3.7L/day = 3700ml, Adult women: 2.7L/day = 2700ml
  // 50lb dog: ~0.39 gallons = 1476ml, 10lb cat: ~0.07 gallons = 265ml
  // Animal shelter: ~50-100L per day for multiple animals
  const adultDailyNeed = 3000; // average: 3L per adult per day
  const childDailyNeed = 2000; // ~2L per child per day
  const dogDailyNeed = 1500;    // ~1.5L per 50lb dog per day
  const catDailyNeed = 250;     // ~0.25L per 10lb cat per day
  const animalShelterDailyNeed = 50000; // ~50L per animal shelter per day
  const villageDailyNeed = 500000; // ~500L for a small village per day
  
  if (difference > 0) {
    // positive - saved water (below average)
    const excess = Math.abs(difference);
    const adults = Math.floor(excess / adultDailyNeed);
    const children = Math.floor(excess / childDailyNeed);
    const dogs = Math.floor(excess / dogDailyNeed);
    const cats = Math.floor(excess / catDailyNeed);
    const shelters = Math.floor(excess / animalShelterDailyNeed);
    const villages = Math.floor(excess / villageDailyNeed);
    
    comparisonCard.className = 'comparison-card positive';
    
    // prioritize most impactful messages with diverse variations
    const positiveMessages = {
      villages: [
        `🌍 You saved enough water for ${villages} ${villages === 1 ? 'small village' : 'small villages'} today! Your sustainable choices make a global impact!`,
        `🌍 Your water savings could sustain ${villages} ${villages === 1 ? 'village' : 'villages'} today! Amazing impact!`,
        `🌍 ${villages} ${villages === 1 ? 'village' : 'villages'} could thrive on the water you saved today!`
      ],
      children3plus: [
        `🎉 You saved a day's worth of water for ${children} children today! Your AI usage choices are helping those in need.`,
        `🎉 ${children} children could drink clean water thanks to your mindful AI usage today!`,
        `🎉 Your sustainable choices provided a day's water for ${children} children in need!`
      ],
      children: [
        `💧 You saved a day's worth of water for ${children} ${children === 1 ? 'child' : 'children'} today! Every drop counts.`,
        `💧 ${children} ${children === 1 ? 'child' : 'children'} could have clean drinking water from your savings today!`,
        `💧 Your reduced AI usage means ${children} ${children === 1 ? 'child' : 'children'} can stay hydrated today!`
      ],
      shelters: [
        `🐾 You saved enough water for ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} today! Your mindful AI usage helps animals in need.`,
        `🐾 ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} could care for their animals with the water you saved!`,
        `🐾 Your water savings could support ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} today!`
      ],
      adults: [
        `👥 You saved enough water for ${adults} ${adults === 1 ? 'adult' : 'adults'} today! That's ${percentage}% below your average.`,
        `👥 ${adults} ${adults === 1 ? 'person' : 'people'} could stay hydrated thanks to your mindful AI usage!`,
        `👥 Your sustainable choices provided daily water for ${adults} ${adults === 1 ? 'adult' : 'adults'} today!`
      ],
      dogs: [
        `🐕 You saved enough water for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} today! Your sustainable choices matter.`,
        `🐕 ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} could stay healthy with the water you saved today!`,
        `🐕 Your water savings could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day!`
      ],
      cats: [
        `🐱 You saved enough water for ${cats} ${cats === 1 ? 'cat' : 'cats'} today! Keep making mindful choices.`,
        `🐱 ${cats} ${cats === 1 ? 'cat' : 'cats'} could thrive on the water you conserved today!`,
        `🐱 Your mindful AI usage saved enough water for ${cats} ${cats === 1 ? 'cat' : 'cats'}!`
      ],
      default: [
        `💧 Great job staying below your average! Every small reduction helps those in need.`,
        `💧 Your mindful AI usage is making a difference! Keep it up!`,
        `💧 Every drop you save helps someone in need. Great work!`
      ]
    };
    
    // select random message from appropriate category
    let message;
    if (villages > 0) {
      message = positiveMessages.villages[Math.floor(Math.random() * positiveMessages.villages.length)];
    } else if (children >= 3) {
      message = positiveMessages.children3plus[Math.floor(Math.random() * positiveMessages.children3plus.length)];
    } else if (children > 0) {
      message = positiveMessages.children[Math.floor(Math.random() * positiveMessages.children.length)];
    } else if (shelters > 0) {
      message = positiveMessages.shelters[Math.floor(Math.random() * positiveMessages.shelters.length)];
    } else if (adults > 0) {
      message = positiveMessages.adults[Math.floor(Math.random() * positiveMessages.adults.length)];
    } else if (dogs > 0) {
      message = positiveMessages.dogs[Math.floor(Math.random() * positiveMessages.dogs.length)];
    } else if (cats > 0) {
      message = positiveMessages.cats[Math.floor(Math.random() * positiveMessages.cats.length)];
    } else {
      message = positiveMessages.default[Math.floor(Math.random() * positiveMessages.default.length)];
    }
    
    comparisonText.textContent = message;
  } else if (difference < 0) {
    // negative - used more (above average)
    const excess = Math.abs(difference);
    const adults = Math.ceil(excess / adultDailyNeed);
    const children = Math.ceil(excess / childDailyNeed);
    const dogs = Math.ceil(excess / dogDailyNeed);
    const shelters = Math.ceil(excess / animalShelterDailyNeed);
    
    comparisonCard.className = 'comparison-card negative';
    
    // warnings with humanitarian context - diverse variations
    const negativeMessages = {
      children3plus: [
        `⚠️ You're using ${Math.abs(percentage)}% more than your average. That's enough water for ${children} children. Consider reducing your AI queries to help those in need.`,
        `⚠️ Your excess usage could hydrate ${children} children. Your AI queries have a real humanitarian cost.`,
        `⚠️ ${children} children could drink clean water with what you're using above average. Be more mindful.`
      ],
      children: [
        `⚠️ You're using ${Math.abs(percentage)}% more than your average. That's enough water for ${children} ${children === 1 ? 'child' : 'children'}. Consider reducing your AI queries.`,
        `⚠️ Your extra usage equals a day's water for ${children} ${children === 1 ? 'child' : 'children'}. Think about reducing AI queries.`,
        `⚠️ ${children} ${children === 1 ? 'child' : 'children'} could stay hydrated with your excess water usage.`
      ],
      shelters: [
        `⚠️ You're using ${Math.abs(percentage)}% more than your average. That's enough for ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'}. Be mindful of your AI usage.`,
        `⚠️ Your excess usage could support ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'}. Consider the impact.`,
        `⚠️ ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} could use the water you're consuming above average.`
      ],
      adults: [
        `⚠️ You're using ${Math.abs(percentage)}% more than your average. That's enough water for ${adults} ${adults === 1 ? 'adult' : 'adults'}. Consider reducing your AI queries.`,
        `⚠️ Your excess usage equals daily water for ${adults} ${adults === 1 ? 'person' : 'people'}. Be more conscious.`,
        `⚠️ ${adults} ${adults === 1 ? 'adult' : 'adults'} could stay hydrated with your extra water consumption.`
      ],
      dogs: [
        `⚠️ You're using ${Math.abs(percentage)}% more than your average. That's enough for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'}. Be mindful of your AI usage.`,
        `⚠️ Your excess usage could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day. Consider reducing queries.`,
        `⚠️ ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} could thrive on the water you're using above average.`
      ],
      default: [
        `⚠️ You're using ${Math.abs(percentage)}% more than your average. Consider reducing your AI queries to help conserve water for those in need.`,
        `⚠️ Your excess usage has a real cost. Be mindful of your AI queries and their impact.`,
        `⚠️ Consider reducing your AI usage - every drop saved helps someone in need.`
      ]
    };
    
    // select random message from appropriate category
    let message;
    if (children >= 3) {
      message = negativeMessages.children3plus[Math.floor(Math.random() * negativeMessages.children3plus.length)];
    } else if (children > 0) {
      message = negativeMessages.children[Math.floor(Math.random() * negativeMessages.children.length)];
    } else if (shelters > 0) {
      message = negativeMessages.shelters[Math.floor(Math.random() * negativeMessages.shelters.length)];
    } else if (adults > 0) {
      message = negativeMessages.adults[Math.floor(Math.random() * negativeMessages.adults.length)];
    } else if (dogs > 0) {
      message = negativeMessages.dogs[Math.floor(Math.random() * negativeMessages.dogs.length)];
    } else {
      message = negativeMessages.default[Math.floor(Math.random() * negativeMessages.default.length)];
    }
    
    comparisonText.textContent = message;
  } else {
    comparisonCard.className = 'comparison-card';
    comparisonText.textContent = `You're right on track with your average usage today! Keep making mindful choices.`;
  }
}

async function saveUserDataToSupabase(userData) {
  // supabase integration will be handled in background.js
  // this is a placeholder for now
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_USER_DATA',
      data: userData
    });
  } catch (error) {
    console.error('Error saving to Supabase:', error);
  }
}

