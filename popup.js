// popup.js - handles popup UI and survey

document.addEventListener('DOMContentLoaded', async () => {
  const surveyContainer = document.getElementById('survey-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const surveyForm = document.getElementById('survey-form');
  
  // check if user has completed survey
  const surveyData = await chrome.storage.local.get(['surveyCompleted', 'userData']);
  
  if (surveyData.surveyCompleted) {
    showDashboard();
    await updateDashboard();
  } else {
    surveyContainer.style.display = 'block';
    dashboardContainer.style.display = 'none';
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
    
    // calculate estimated average usage based on survey
    const estimatedAverage = calculateAverageUsage(surveyAnswers);
    
    const userData = {
      surveyAnswers,
      averageUsage: estimatedAverage,
      dailyUsage: 0,
      weeklyUsage: 0,
      totalUsage: 0,
      queries: [],
      createdAt: new Date().toISOString()
    };
    
    await chrome.storage.local.set({
      surveyCompleted: true,
      userData: userData
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
  document.getElementById('dashboard-container').style.display = 'block';
}

async function updateDashboard() {
  const data = await chrome.storage.local.get(['userData', 'dailyUsage', 'weeklyUsage', 'totalUsage']);
  const userData = data.userData || {};
  
  // update stats
  document.getElementById('today-usage').textContent = formatWaterUsage(data.dailyUsage || 0);
  document.getElementById('week-usage').textContent = formatWaterUsage(data.weeklyUsage || 0);
  document.getElementById('total-usage').textContent = formatWaterUsage(data.totalUsage || 0);
  document.getElementById('avg-usage').textContent = formatWaterUsage(userData.averageUsage || 0);
  
  // update comparison message
  updateComparisonMessage(data.dailyUsage || 0, userData.averageUsage || 0);
}

function calculateAverageUsage(surveyAnswers) {
  // base calculation based on survey answers
  let baseUsage = 0;
  
  // usage frequency multiplier
  const frequencyMultiplier = {
    'daily': 1.0,
    'sometimes': 0.5,
    'never': 0.1
  };
  
  // purpose multiplier (roleplay uses more, tool uses less)
  const purposeMultiplier = {
    'roleplay': 1.5,
    'discussion': 1.2,
    'tool': 0.8,
    'other': 1.0
  };
  
  // screen time multiplier
  const screenTimeMultiplier = Math.min(surveyAnswers.screenTime / 8, 1.5);
  
  // base daily usage in ml (estimated average: 500ml per day for daily users)
  baseUsage = 500 * frequencyMultiplier[surveyAnswers.usageFrequency] || 0.5;
  baseUsage *= purposeMultiplier[surveyAnswers.usagePurpose] || 1.0;
  baseUsage *= screenTimeMultiplier;
  
  return Math.round(baseUsage);
}

function formatWaterUsage(ml) {
  if (ml < 1000) {
    return `${ml} ml`;
  } else if (ml < 1000000) {
    return `${(ml / 1000).toFixed(2)} L`;
  } else {
    return `${(ml / 1000000).toFixed(2)} m³`;
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
  
  if (difference > 0) {
    // positive - saved water
    const children = Math.floor(difference / 2000); // ~2L per child per day
    const dogs = Math.floor(difference / 1000); // ~1L per dog per day
    
    comparisonCard.className = 'comparison-card positive';
    if (children > 0) {
      comparisonText.textContent = `🎉 You saved a day's worth of water for ${children} ${children === 1 ? 'child' : 'children'} today! That's ${percentage}% below your average.`;
    } else if (dogs > 0) {
      comparisonText.textContent = `🐕 You saved enough water for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} today! Keep it up!`;
    } else {
      comparisonText.textContent = `💧 Great job! You're ${percentage}% below your average today.`;
    }
  } else if (difference < 0) {
    // negative - used more
    const excess = Math.abs(difference);
    const children = Math.ceil(excess / 2000);
    
    comparisonCard.className = 'comparison-card negative';
    comparisonText.textContent = `⚠️ You're using ${Math.abs(percentage)}% more than your average. That's enough for ${children} ${children === 1 ? 'child' : 'children'}. Consider reducing your AI queries.`;
  } else {
    comparisonCard.className = 'comparison-card';
    comparisonText.textContent = `You're right on track with your average usage today!`;
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

