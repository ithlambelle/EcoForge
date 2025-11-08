// popup.js - handles popup UI and survey

// submission guard and commit token to prevent race conditions
let __isSubmitting = false;
let __lastCommitId = null;

function genId() {
  return (crypto?.randomUUID?.() || String(Date.now()) + Math.random());
}

document.addEventListener('DOMContentLoaded', async () => {
  const surveyContainer = document.getElementById('survey-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const surveyForm = document.getElementById('survey-form');
  
  // unit conversion (shared with content.js)
  let currentUnit = 'ml'; // 'ml', 'gallons', 'ounces'
  const ML_TO_GALLON = 3785.41;  // 1 US gallon = 3785.41 ml
  const ML_TO_OUNCE = 29.5735;   // 1 US fluid ounce = 29.5735 ml
  
  // convert ml to selected unit
  function convertToUnit(ml, unit) {
    switch(unit) {
      case 'gallons':
        return ml / ML_TO_GALLON;
      case 'ounces':
        return ml / ML_TO_OUNCE;
      case 'ml':
      default:
        return ml;
    }
  }
  
  // get unit label
  function getUnitLabel(unit) {
    switch(unit) {
      case 'gallons':
        return 'gal';
      case 'ounces':
        return 'oz';
      case 'ml':
      default:
        return 'ml';
    }
  }
  
  // load unit preference
  chrome.storage.local.get(['waterUnit'], async (result) => {
    if (result.waterUnit && ['ml', 'gallons', 'ounces'].includes(result.waterUnit)) {
      currentUnit = result.waterUnit;
      updateUnitToggleButton();
      await updateDashboard();
    }
  });
  
  // listen for storage changes to update dashboard when data changes
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return;
    
    // If we are in the middle of submit, ignore storage changes (prevent echo)
    if (__isSubmitting) {
      console.log('💧 DropQuery: Ignoring storage change during submission');
      return;
    }
    
    // handle resetting flag
    if (changes.isResetting) {
      if (changes.isResetting.newValue === false) {
        // reset complete, update dashboard to show zeros
        const zeroFormatted = await formatWaterUsage(0);
        document.getElementById('today-usage').textContent = zeroFormatted;
        document.getElementById('week-usage').textContent = zeroFormatted;
        document.getElementById('total-usage').textContent = zeroFormatted;
        document.getElementById('avg-usage').textContent = zeroFormatted;
        document.getElementById('comparison-text').textContent = 'Track your first query to see your impact!';
        document.getElementById('comparison-message').className = 'comparison-card';
      }
    }
    
    // if surveyCompleted changes, update UI accordingly
    if (changes.surveyCompleted) {
      const newValue = changes.surveyCompleted.newValue;
      const oldValue = changes.surveyCompleted.oldValue;
      
      console.log('💧 DropQuery: surveyCompleted changed', {
        oldValue,
        newValue
      });
      
      if (newValue === true && oldValue !== true) {
        // survey was just completed - switch to dashboard
        console.log('💧 DropQuery: Survey completed detected, switching to dashboard');
        showDashboard();
        await updateDashboard();
      } else if (!newValue) {
        // survey was reset, update dashboard to show zeros
        const zeroFormatted = await formatWaterUsage(0);
        document.getElementById('today-usage').textContent = zeroFormatted;
        document.getElementById('week-usage').textContent = zeroFormatted;
        document.getElementById('total-usage').textContent = zeroFormatted;
        document.getElementById('avg-usage').textContent = zeroFormatted;
        document.getElementById('comparison-text').textContent = 'Track your first query to see your impact!';
        document.getElementById('comparison-message').className = 'comparison-card';
        
        // switch back to survey if dashboard is showing
        if (dashboardContainer.classList.contains('show')) {
          surveyContainer.style.display = 'block';
          dashboardContainer.classList.remove('show');
          dashboardContainer.style.display = 'none';
        }
      }
    }
    
    // update dashboard when usage data changes
    if (changes.dailyUsage || changes.weeklyUsage || changes.totalUsage || changes.userData || changes.queries) {
      if (dashboardContainer.classList.contains('show')) {
        updateDashboard().catch(err => console.warn('Error updating dashboard:', err));
      }
    }
    
    // update unit if changed
    if (changes.waterUnit) {
      const newUnit = changes.waterUnit.newValue;
      if (['ml', 'gallons', 'ounces'].includes(newUnit)) {
        currentUnit = newUnit;
        updateUnitToggleButton();
        if (dashboardContainer.classList.contains('show')) {
          updateDashboard();
        }
      }
    }
  });
  
  // unit toggle button
  const unitToggleBtn = document.getElementById('unit-toggle-btn');
  if (unitToggleBtn) {
    unitToggleBtn.addEventListener('click', () => {
      toggleUnit();
    });
  }
  
  // toggle between units: ml -> gallons -> ounces -> ml
  async function toggleUnit() {
    const units = ['ml', 'gallons', 'ounces'];
    const currentIndex = units.indexOf(currentUnit);
    currentUnit = units[(currentIndex + 1) % units.length];
    
    // save preference
    await chrome.storage.local.set({ waterUnit: currentUnit });
    
    updateUnitToggleButton();
    await updateDashboard();
  }
  
  // update unit toggle button text
  function updateUnitToggleButton() {
    const toggleBtn = document.getElementById('unit-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = getUnitLabel(currentUnit);
    }
  }
  
  // function to check state and update UI accordingly
  async function checkStateAndUpdateUI() {
    // Don't run if we're in the middle of submitting (prevent race condition)
    if (__isSubmitting) {
      console.log('💧 DropQuery: Skipping state check - submission in progress');
      return;
    }
    
    // Add a small delay to ensure any pending storage writes have completed
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const surveyData = await chrome.storage.local.get(['surveyCompleted', 'userData', 'dailyUsage', 'isResetting', 'surveyCommitId']);
    
    console.log('💧 DropQuery: State check', {
      surveyCompleted: surveyData.surveyCompleted,
      isResetting: surveyData.isResetting,
      hasUserData: !!surveyData.userData,
      commitId: surveyData.surveyCommitId
    });
    
    // if isResetting is true, clear it (shouldn't happen, but just in case)
    if (surveyData.isResetting) {
      console.log('💧 DropQuery: Clearing stuck isResetting flag');
      await chrome.storage.local.set({ isResetting: false });
    }
    
    // If we have a commit ID, we just completed the survey - show dashboard
    if (surveyData.surveyCommitId) {
      console.log('💧 DropQuery: Found commit ID, survey was completed, showing dashboard');
      showDashboard();
      await updateDashboard();
      return;
    }
    
    if (surveyData.surveyCompleted) {
      console.log('💧 DropQuery: Survey completed, showing dashboard');
      showDashboard();
      await updateDashboard();
    } else {
      console.log('💧 DropQuery: Survey not completed, showing survey form');
      surveyContainer.style.display = 'block';
      dashboardContainer.style.display = 'none';
      
      // initialize survey water usage tracking
      let surveyWaterUsage = surveyData.dailyUsage || 0;
      await updateSurveyWaterDisplay(surveyWaterUsage);
      
      // add incremental water usage as questions are answered
      setupSurveyIncrements(surveyWaterUsage);
    }
  }
  
  // initial state check with retry logic
  let retryCount = 0;
  const maxRetries = 3;
  async function initWithRetry() {
    await checkStateAndUpdateUI();
    
    // Double-check after a short delay to catch any race conditions
    setTimeout(async () => {
      const verify = await chrome.storage.local.get(['surveyCompleted', 'surveyCommitId']);
      if (verify.surveyCompleted && !dashboardContainer.classList.contains('show')) {
        console.log('💧 DropQuery: Retry check - survey completed but dashboard not shown, fixing...');
        showDashboard();
        await updateDashboard();
      }
    }, 200);
  }
  
  await initWithRetry();
  
  // handle survey submission
  surveyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    console.log('💧 DropQuery: ====== SUBMIT EVENT FIRED ======');
    
    // Prevent double submission
    if (__isSubmitting) {
      console.log('💧 DropQuery: Submission already in progress, ignoring');
      return;
    }
    
    __isSubmitting = true;
    __lastCommitId = genId();
    
    console.log('💧 DropQuery: Survey form submitted', { commitId: __lastCommitId });
    
    // disable form to prevent double submission
    surveyForm.style.pointerEvents = 'none';
    const submitBtn = surveyForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Starting...';
    }
    
    const surveyAnswers = {
      usageFrequency: document.getElementById('usage-frequency').value,
      waterAwareness: document.getElementById('water-awareness').value,
      usagePurpose: document.getElementById('usage-purpose').value,
      screenTime: parseFloat(document.getElementById('screen-time').value)
    };
    
    // get current survey water usage
    const currentData = await chrome.storage.local.get(['dailyUsage', 'isResetting']);
    const surveyWaterUsage = currentData.dailyUsage || 0;
    
    console.log('💧 DropQuery: Current state before save', {
      dailyUsage: surveyWaterUsage,
      isResetting: currentData.isResetting
    });
    
    // start average at 0 - will be calculated dynamically based on actual usage
    // this allows for more meaningful feedback as users build up their usage history
    const userData = {
      surveyAnswers,
      averageUsage: 0, // start at 0, calculate from actual usage over time
      dailyUsage: surveyWaterUsage, // preserve survey water usage
      weeklyUsage: surveyWaterUsage,
      totalUsage: surveyWaterUsage,
      queries: [],
      dailyHistory: [], // track daily usage for rolling average
      createdAt: new Date().toISOString()
    };
    
    // Atomically write everything needed in ONE set() operation
    const payload = {
      surveyCompleted: true,
      userData: userData,
      dailyUsage: surveyWaterUsage,
      weeklyUsage: surveyWaterUsage,
      totalUsage: surveyWaterUsage,
      isResetting: false, // ensure old reset state can't interfere
      queries: [], // ensure queries array exists
      surveyCommitId: __lastCommitId, // commit token for verification
      surveyCommittedAt: Date.now() // timestamp to help debug
    };
    
    await chrome.storage.local.set(payload);
    console.log('💧 DropQuery: Storage saved atomically with surveyCompleted: true', { commitId: __lastCommitId });
    
    // CRITICAL: Verify storage was actually written
    const postSaveCheck = await chrome.storage.local.get(['surveyCompleted', 'surveyCommitId']);
    console.log('💧 DropQuery: Post-save verification', {
      surveyCompleted: postSaveCheck.surveyCompleted,
      commitId: postSaveCheck.surveyCommitId,
      matches: postSaveCheck.surveyCommitId === __lastCommitId
    });
    
    if (!postSaveCheck.surveyCompleted) {
      console.error('💧 DropQuery: CRITICAL - surveyCompleted NOT in storage after save!');
      // Force save again
      await chrome.storage.local.set({ surveyCompleted: true, surveyCommitId: __lastCommitId });
    }
    
    // Switch UI immediately (no waiting for listeners) - FORCE IT
    console.log('💧 DropQuery: Switching to dashboard view IMMEDIATELY');
    
    // Aggressively hide survey
    surveyContainer.style.display = 'none';
    surveyContainer.style.visibility = 'hidden';
    surveyContainer.classList.remove('show');
    
    // Aggressively show dashboard
    dashboardContainer.classList.add('show');
    dashboardContainer.style.display = 'block';
    dashboardContainer.style.visibility = 'visible';
    
    // Force layout recalculation to ensure changes take effect
    const forceLayout = dashboardContainer.offsetHeight;
    const forceLayout2 = surveyContainer.offsetHeight;
    
    console.log('💧 DropQuery: Dashboard visible, survey hidden', {
      surveyDisplay: window.getComputedStyle(surveyContainer).display,
      dashboardDisplay: window.getComputedStyle(dashboardContainer).display,
      dashboardHasShow: dashboardContainer.classList.contains('show')
    });
    
    // CRITICAL: Force a synchronous re-check to ensure UI stays
    const immediateVerify = await chrome.storage.local.get(['surveyCompleted', 'surveyCommitId']);
    console.log('💧 DropQuery: Immediate verify after UI switch', {
      surveyCompleted: immediateVerify.surveyCompleted,
      commitId: immediateVerify.surveyCommitId
    });
    
    // If state is wrong, restore it immediately
    if (!immediateVerify.surveyCompleted || immediateVerify.surveyCommitId !== __lastCommitId) {
      console.error('💧 DropQuery: State mismatch detected, restoring immediately');
      await chrome.storage.local.set({
        surveyCompleted: true,
        surveyCommitId: __lastCommitId,
        isResetting: false
      });
      // Force UI again - aggressively
      surveyContainer.style.display = 'none';
      surveyContainer.style.visibility = 'hidden';
      surveyContainer.classList.remove('show');
      dashboardContainer.classList.add('show');
      dashboardContainer.style.display = 'block';
      dashboardContainer.style.visibility = 'visible';
      dashboardContainer.offsetHeight; // force layout
    }
    
    // Update dashboard content
    await updateDashboard();
    
    // Verify persist (best-effort) with multiple checks
    let verifyAttempts = 0;
    const maxVerifyAttempts = 5;
    const verifyInterval = setInterval(() => {
      verifyAttempts++;
      chrome.storage.local.get(['surveyCompleted', 'surveyCommitId'], ({ surveyCompleted, surveyCommitId }) => {
        if (!surveyCompleted || surveyCommitId !== __lastCommitId) {
          console.warn(`💧 DropQuery: Verify attempt ${verifyAttempts} failed`, {
            surveyCompleted,
            expectedCommitId: __lastCommitId,
            actualCommitId: surveyCommitId
          });
          // Restore if needed
          if (!surveyCompleted) {
            chrome.storage.local.set({ surveyCompleted: true, surveyCommitId: __lastCommitId });
          }
        } else {
          console.log('💧 DropQuery: Survey commit verified successfully', { commitId: surveyCommitId });
          clearInterval(verifyInterval);
        }
      });
      
      if (verifyAttempts >= maxVerifyAttempts) {
        clearInterval(verifyInterval);
        console.log('💧 DropQuery: Max verify attempts reached');
      }
    }, 100);
    
    // Small delay before releasing guard to let onChanged settle
    setTimeout(() => {
      __isSubmitting = false;
      console.log('💧 DropQuery: Submission guard released');
    }, 500);
    
    // send to supabase (non-blocking, don't wait)
    saveUserDataToSupabase(userData).catch(error => {
      console.warn('💧 DropQuery: Error saving to Supabase', error);
      // don't block survey completion if Supabase fails
    });
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
      if (confirm('Are you sure you want to reset all your data? This will clear all your usage statistics and you will need to complete the survey again.')) {
        // Set resetting flag to prevent updates during reset
        await chrome.storage.local.set({ isResetting: true });
        
        // Clear all storage
        await chrome.storage.local.clear();
        
        // Re-seed baseline keys so UI has deterministic state
        await chrome.storage.local.set({
          surveyCompleted: false,
          isResetting: false,
          waterUnit: 'ml', // default
          dailyUsage: 0,
          weeklyUsage: 0,
          totalUsage: 0,
          queries: [],
          userData: {
            averageUsage: 0,
            dailyHistory: []
          }
        });
        
        // Reset survey form
        surveyForm.reset();
        document.getElementById('usage-frequency').value = '';
        document.getElementById('water-awareness').value = '';
        document.getElementById('usage-purpose').value = '';
        document.getElementById('screen-time').value = '';
        
        // Hide survey water display if it exists
        const surveyWaterDisplay = document.getElementById('survey-water-display');
        if (surveyWaterDisplay) {
          surveyWaterDisplay.remove();
        }
        
        // Reset dashboard stats to zero
        const zeroFormatted = await formatWaterUsage(0);
        document.getElementById('today-usage').textContent = zeroFormatted;
        document.getElementById('week-usage').textContent = zeroFormatted;
        document.getElementById('total-usage').textContent = zeroFormatted;
        document.getElementById('avg-usage').textContent = zeroFormatted;
        document.getElementById('comparison-text').textContent = 'Track your first query to see your impact!';
        document.getElementById('comparison-message').className = 'comparison-card';
        
        // Show survey, hide dashboard
        surveyContainer.style.display = 'block';
        dashboardContainer.classList.remove('show');
        dashboardContainer.style.display = 'none';
        
        // notify content script to update/hide UI
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'resetData' }).catch(() => {
              // content script might not be loaded, that's okay
            });
          }
        } catch (error) {
          // ignore errors
        }
        
        console.log('💧 DropQuery: Reset completed, state re-seeded');
      }
    });
  }
});

function showDashboard() {
  const surveyContainer = document.getElementById('survey-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  
  console.log('💧 DropQuery: showDashboard() called - BEFORE', {
    surveyDisplay: surveyContainer?.style.display,
    surveyComputed: surveyContainer ? window.getComputedStyle(surveyContainer).display : 'N/A',
    dashboardDisplay: dashboardContainer?.style.display,
    dashboardComputed: dashboardContainer ? window.getComputedStyle(dashboardContainer).display : 'N/A',
    dashboardHasShow: dashboardContainer?.classList.contains('show')
  });
  
  if (surveyContainer) {
    surveyContainer.style.display = 'none';
    surveyContainer.style.visibility = 'hidden';
    surveyContainer.classList.remove('show');
  }
  if (dashboardContainer) {
    dashboardContainer.classList.add('show');
    dashboardContainer.style.display = 'block';
    dashboardContainer.style.visibility = 'visible';
    // Force layout recalculation
    dashboardContainer.offsetHeight;
  }
  
  console.log('💧 DropQuery: showDashboard() called - AFTER', {
    surveyDisplay: surveyContainer?.style.display,
    surveyComputed: surveyContainer ? window.getComputedStyle(surveyContainer).display : 'N/A',
    dashboardDisplay: dashboardContainer?.style.display,
    dashboardComputed: dashboardContainer ? window.getComputedStyle(dashboardContainer).display : 'N/A',
    dashboardHasShow: dashboardContainer?.classList.contains('show')
  });
}

async function updateDashboard() {
  const data = await chrome.storage.local.get(['userData', 'dailyUsage', 'weeklyUsage', 'totalUsage']);
  const userData = data.userData || {};
  
  // update stats (formatWaterUsage is now async)
  document.getElementById('today-usage').textContent = await formatWaterUsage(data.dailyUsage || 0);
  document.getElementById('week-usage').textContent = await formatWaterUsage(data.weeklyUsage || 0);
  document.getElementById('total-usage').textContent = await formatWaterUsage(data.totalUsage || 0);
  document.getElementById('avg-usage').textContent = await formatWaterUsage(userData.averageUsage || 0);
  
  // update comparison message (this will now show random variations)
  await updateComparisonMessage(data.dailyUsage || 0, userData.averageUsage || 0);
  
  // also update periodically to show different messages
  setTimeout(async () => {
    await updateComparisonMessage(data.dailyUsage || 0, userData.averageUsage || 0);
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
          
          await updateSurveyWaterDisplay(newUsage);
          console.log(`💧 Waterer: Added ${parseFloat(usage.toFixed(4))}ml for answering ${id}`);
        }
      });
    }
  });
}

async function updateSurveyWaterDisplay(usage) {
  // create or update water usage display in survey
  let display = document.getElementById('survey-water-display');
  if (!display) {
    display = document.createElement('div');
    display.id = 'survey-water-display';
    display.style.cssText = 'margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 8px; text-align: center;';
    const surveyForm = document.getElementById('survey-form');
    surveyForm.insertBefore(display, surveyForm.querySelector('.submit-btn'));
  }
  
  // formatWaterUsage is now async, so we need to await it
  const formatted = await formatWaterUsage(usage);
  display.innerHTML = `
    <div style="font-size: 14px; color: #1976d2; font-weight: bold;">
      Water used so far: <span id="survey-water-amount">${formatted}</span>
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

// format water usage - always reads unit from storage to ensure accuracy
async function formatWaterUsage(ml, unit = null) {
  // if unit not provided, read from storage
  let targetUnit = unit;
  if (!targetUnit) {
    try {
      const data = await chrome.storage.local.get(['waterUnit']);
      targetUnit = data.waterUnit || currentUnit || 'ml';
      // update currentUnit for consistency
      if (data.waterUnit && ['ml', 'gallons', 'ounces'].includes(data.waterUnit)) {
        currentUnit = data.waterUnit;
      }
    } catch (error) {
      targetUnit = currentUnit || 'ml';
    }
  }
  
  const converted = convertToUnit(ml, targetUnit);
  const unitLabel = getUnitLabel(targetUnit);
  
  // format based on magnitude
  if (targetUnit === 'ml') {
    if (ml < 1000) {
      return `${parseFloat(ml.toFixed(4))} ${unitLabel}`;
    } else if (ml < 1000000) {
      return `${parseFloat((ml / 1000).toFixed(4))} L`;
    } else {
      return `${parseFloat((ml / 1000000).toFixed(4))} m³`;
    }
  } else {
    // for gallons and ounces, show with appropriate decimal places
    const decimals = converted < 1 ? 4 : (converted < 10 ? 3 : 2);
    return `${parseFloat(converted.toFixed(decimals))} ${unitLabel}`;
  }
}

async function updateComparisonMessage(dailyUsage, averageUsage) {
  const comparisonCard = document.getElementById('comparison-message');
  const comparisonText = document.getElementById('comparison-text');
  
  if (!averageUsage || averageUsage === 0) {
    if (dailyUsage === 0) {
      comparisonText.textContent = 'Track your first query to see your impact!';
      comparisonCard.className = 'comparison-card';
    } else {
      // user has usage but no average yet - show educational impact
      const adultDailyNeed = 3000; // average: 3L per adult per day
      const childDailyNeed = 236.588; // 8 oz per child per day (1 oz = 29.5735 ml, 8 oz = 236.588 ml)
      const dogDailyNeed = 1500;    // ~1.5L per 50lb dog per day
      const catDailyNeed = 250;     // ~0.25L per 10lb cat per day
      
      // calculate how many people/animals could be fed with current usage
      const children = Math.floor(dailyUsage / childDailyNeed);
      const adults = Math.floor(dailyUsage / adultDailyNeed);
      const dogs = Math.floor(dailyUsage / dogDailyNeed);
      const cats = Math.floor(dailyUsage / catDailyNeed);
      
      // create educational message with real-world impact
      let message = '';
      // get unit from storage for accurate formatting
      const unitData = await chrome.storage.local.get(['waterUnit']);
      const unitToUse = unitData.waterUnit || currentUnit || 'ml';
      
      if (cats >= 1) {
        const formatted = await formatWaterUsage(dailyUsage, unitToUse);
        message = `Your ${formatted} today could provide clean drinking water for ${cats} ${cats === 1 ? 'cat' : 'cats'} for a day!`;
      } else if (children >= 1) {
        const formatted = await formatWaterUsage(dailyUsage, unitToUse);
        message = `Your ${formatted} today could hydrate ${children} ${children === 1 ? 'child' : 'children'} for a day!`;
      } else if (adults >= 1) {
        const formatted = await formatWaterUsage(dailyUsage, unitToUse);
        message = `Your ${formatted} today could provide daily water for ${adults} ${adults === 1 ? 'adult' : 'adults'}!`;
      } else if (dogs >= 1) {
        const formatted = await formatWaterUsage(dailyUsage, unitToUse);
        message = `Your ${formatted} today could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day!`;
      } else {
        // very small usage - show in terms of cats or small impact
        const catFraction = (dailyUsage / catDailyNeed).toFixed(2);
        const formatted = await formatWaterUsage(dailyUsage, unitToUse);
        message = `Your ${formatted} today represents ${catFraction} of a cat's daily water needs. Every drop counts!`;
      }
      
      comparisonText.textContent = message;
      comparisonCard.className = 'comparison-card';
    }
    return;
  }
  
  const difference = averageUsage - dailyUsage;
  const percentage = ((difference / averageUsage) * 100).toFixed(1);
  
  // accurate water needs (from research data)
  // Adult men: 3.7L/day = 3700ml, Adult women: 2.7L/day = 2700ml
  // Child: 8 oz per day = 236.588 ml (1 oz = 29.5735 ml)
  // 50lb dog: ~0.39 gallons = 1476ml, 10lb cat: ~0.07 gallons = 265ml
  // Animal shelter: ~50-100L per day for multiple animals
  const adultDailyNeed = 3000; // average: 3L per adult per day
  const childDailyNeed = 236.588; // 8 oz per child per day (1 oz = 29.5735 ml, 8 oz = 236.588 ml)
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
        `You saved enough water for ${villages} ${villages === 1 ? 'small village' : 'small villages'} today! Your sustainable choices make a global impact!`,
        `Your water savings could sustain ${villages} ${villages === 1 ? 'village' : 'villages'} today! Amazing impact!`,
        `${villages} ${villages === 1 ? 'village' : 'villages'} could thrive on the water you saved today!`
      ],
      children3plus: [
        `You saved a day's worth of water for ${children} children today! Your AI usage choices are helping those in need.`,
        `${children} children could drink clean water thanks to your mindful AI usage today!`,
        `Your sustainable choices provided a day's water for ${children} children in need!`
      ],
      children: [
        `You saved a day's worth of water for ${children} ${children === 1 ? 'child' : 'children'} today! Every drop counts.`,
        `${children} ${children === 1 ? 'child' : 'children'} could have clean drinking water from your savings today!`,
        `Your reduced AI usage means ${children} ${children === 1 ? 'child' : 'children'} can stay hydrated today!`
      ],
      shelters: [
        `You saved enough water for ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} today! Your mindful AI usage helps animals in need.`,
        `${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} could care for their animals with the water you saved!`,
        `Your water savings could support ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} today!`
      ],
      adults: [
        `You saved enough water for ${adults} ${adults === 1 ? 'adult' : 'adults'} today! That's ${percentage}% below your average.`,
        `${adults} ${adults === 1 ? 'person' : 'people'} could stay hydrated thanks to your mindful AI usage!`,
        `Your sustainable choices provided daily water for ${adults} ${adults === 1 ? 'adult' : 'adults'} today!`
      ],
      dogs: [
        `You saved enough water for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} today! Your sustainable choices matter.`,
        `${dogs} ${dogs === 1 ? 'dog' : 'dogs'} could stay healthy with the water you saved today!`,
        `Your water savings could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day!`
      ],
      cats: [
        `You saved enough water for ${cats} ${cats === 1 ? 'cat' : 'cats'} today! Keep making mindful choices.`,
        `${cats} ${cats === 1 ? 'cat' : 'cats'} could thrive on the water you conserved today!`,
        `Your mindful AI usage saved enough water for ${cats} ${cats === 1 ? 'cat' : 'cats'}!`
      ],
      default: [
        `Great job staying below your average! Every small reduction helps those in need.`,
        `Your mindful AI usage is making a difference! Keep it up!`,
        `Every drop you save helps someone in need. Great work!`
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
        `You're using ${Math.abs(percentage)}% more than your average. That's enough water for ${children} children. Consider reducing your AI queries to help those in need.`,
        `Your excess usage could hydrate ${children} children. Your AI queries have a real humanitarian cost.`,
        `${children} children could drink clean water with what you're using above average. Be more mindful.`
      ],
      children: [
        `You're using ${Math.abs(percentage)}% more than your average. That's enough water for ${children} ${children === 1 ? 'child' : 'children'}. Consider reducing your AI queries.`,
        `Your extra usage equals a day's water for ${children} ${children === 1 ? 'child' : 'children'}. Think about reducing AI queries.`,
        `${children} ${children === 1 ? 'child' : 'children'} could stay hydrated with your excess water usage.`
      ],
      shelters: [
        `You're using ${Math.abs(percentage)}% more than your average. That's enough for ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'}. Be mindful of your AI usage.`,
        `Your excess usage could support ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'}. Consider the impact.`,
        `${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} could use the water you're consuming above average.`
      ],
      adults: [
        `You're using ${Math.abs(percentage)}% more than your average. That's enough water for ${adults} ${adults === 1 ? 'adult' : 'adults'}. Consider reducing your AI queries.`,
        `Your excess usage equals daily water for ${adults} ${adults === 1 ? 'person' : 'people'}. Be more conscious.`,
        `${adults} ${adults === 1 ? 'adult' : 'adults'} could stay hydrated with your extra water consumption.`
      ],
      dogs: [
        `You're using ${Math.abs(percentage)}% more than your average. That's enough for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'}. Be mindful of your AI usage.`,
        `Your excess usage could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day. Consider reducing queries.`,
        `${dogs} ${dogs === 1 ? 'dog' : 'dogs'} could thrive on the water you're using above average.`
      ],
      default: [
        `You're using ${Math.abs(percentage)}% more than your average. Consider reducing your AI queries to help conserve water for those in need.`,
        `Your excess usage has a real cost. Be mindful of your AI queries and their impact.`,
        `Consider reducing your AI usage - every drop saved helps someone in need.`
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

