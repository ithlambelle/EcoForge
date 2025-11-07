// background.js - service worker for Supabase integration and notifications

const SUPABASE_URL = 'https://notfaymtecnsjzngmwma.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_IX93bvXG12Aaq74u55OfDw_J-tOW90I';

// comprehensive AI service API patterns for network monitoring
const AI_API_PATTERNS = [
  // OpenAI
  'openai.com', 'api.openai.com', 'chatgpt.com',
  '/v1/chat/completions', '/v1/completions', '/v1/embeddings',
  // Google / Gemini
  'gemini', 'bard', 'generativelanguage.googleapis.com', 'ai.google.dev',
  // Anthropic / Claude
  'anthropic.com', 'api.anthropic.com', 'claude.ai', '/v1/messages',
  // Perplexity
  'perplexity.ai', 'api.perplexity.ai',
  // Microsoft / Copilot
  'copilot.microsoft.com', 'bing.com/chat', 'microsoft.com/copilot',
  // Cohere
  'cohere.com', 'api.cohere.ai', '/v1/generate', '/v1/chat',
  // Hugging Face
  'huggingface.co', 'api-inference.huggingface.co',
  // Stability AI
  'stability.ai', 'api.stability.ai',
  // Replicate
  'replicate.com', 'api.replicate.com',
  // Together AI
  'together.ai', 'api.together.xyz',
  // Groq
  'groq.com', 'api.groq.com',
  // Mistral AI
  'mistral.ai', 'api.mistral.ai',
  // Character.AI
  'character.ai', 'beta.character.ai',
  // You.com
  'you.com', 'api.you.com',
  // Poe
  'poe.com', 'api.poe.com',
  // Generic patterns
  '/api/chat', '/api/completion', '/api/generate', '/ai/', '/llm/'
];

// detect AI model from URL
function detectAIModelFromURL(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('openai') || urlLower.includes('chatgpt')) return 'chatgpt';
  if (urlLower.includes('gemini') || urlLower.includes('bard') || urlLower.includes('google')) return 'gemini';
  if (urlLower.includes('claude') || urlLower.includes('anthropic')) return 'claude';
  if (urlLower.includes('perplexity')) return 'perplexity';
  if (urlLower.includes('copilot') || urlLower.includes('microsoft')) return 'copilot';
  if (urlLower.includes('cohere')) return 'cohere';
  if (urlLower.includes('huggingface')) return 'huggingface';
  if (urlLower.includes('stability')) return 'stability';
  if (urlLower.includes('replicate')) return 'replicate';
  if (urlLower.includes('together')) return 'together';
  if (urlLower.includes('groq')) return 'groq';
  if (urlLower.includes('mistral')) return 'mistral';
  if (urlLower.includes('character')) return 'character';
  if (urlLower.includes('you.com')) return 'you';
  if (urlLower.includes('poe')) return 'poe';
  return 'ai-service';
}

// note: webRequest API has limitations in Manifest V3
// network monitoring is handled by content script's fetch/XHR interception
// this provides comprehensive coverage without requiring webRequest permission

// initialize supabase client (using fetch since we can't import in service worker)
async function supabaseRequest(table, method = 'GET', data = null) {
  // silently fail if Supabase is not configured or tables don't exist
  // this allows the extension to work without Supabase
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const options = {
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    
    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    if (!response.ok) {
      // don't log errors for missing tables - Supabase might not be set up
      if (response.status !== 404 && response.status !== 400) {
        console.warn('Supabase request failed:', response.status, response.statusText);
      }
      return null;
    }
    return await response.json();
  } catch (error) {
    // silently fail - Supabase is optional
    // only log if it's not a network/CORS error
    if (!error.message?.includes('Failed to fetch') && !error.message?.includes('CORS')) {
      console.warn('Supabase error (optional):', error.message);
    }
    return null;
  }
}

// get or create user ID
async function getUserId() {
  let { userId } = await chrome.storage.local.get(['userId']);
  
  if (!userId) {
    // generate a simple user ID (in production, use proper auth)
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await chrome.storage.local.set({ userId });
  }
  
  return userId;
}

// save user data to Supabase
async function saveUserData(userData) {
  const userId = await getUserId();
  
  const userRecord = {
    user_id: userId,
    survey_answers: userData.surveyAnswers,
    average_usage: userData.averageUsage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // upsert user data
  await supabaseRequest('users', 'POST', userRecord);
  
  // update collective total
  await updateCollectiveTotal(userData.averageUsage);
}

// track query in Supabase
async function trackQuery(queryData) {
  const userId = await getUserId();
  
  const queryRecord = {
    user_id: userId,
    model: queryData.model,
    water_usage: queryData.waterUsage,
    timestamp: queryData.timestamp
  };
  
  await supabaseRequest('queries', 'POST', queryRecord);
  
  // update collective total
  await updateCollectiveTotal(queryData.waterUsage);
}

// update collective water usage total
async function updateCollectiveTotal(additionalUsage) {
  // get current collective total
  const { collectiveTotal } = await chrome.storage.local.get(['collectiveTotal']);
  
  const newTotal = (collectiveTotal || 0) + additionalUsage;
  await chrome.storage.local.set({ collectiveTotal: newTotal });
  
  // save to Supabase
  const totalRecord = {
    total_usage: newTotal,
    updated_at: new Date().toISOString()
  };
  
  // try to update existing record or create new one
  await supabaseRequest('collective_totals', 'POST', totalRecord);
}

// get collective total from Supabase
async function getCollectiveTotal() {
  const result = await supabaseRequest('collective_totals', 'GET');
  if (result && result.length > 0) {
    return result[0].total_usage || 0;
  }
  return 0;
}

// check and send notifications
async function checkNotifications() {
  const data = await chrome.storage.local.get([
    'notificationFrequency',
    'lastNotificationDate',
    'dailyUsage',
    'weeklyUsage',
    'totalUsage',
    'userData'
  ]);
  
  const frequency = data.notificationFrequency || 'daily';
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const lastNotification = data.lastNotificationDate;
  
  let shouldNotify = false;
  
  if (frequency === 'daily' && lastNotification !== today) {
    shouldNotify = true;
  } else if (frequency === 'weekly') {
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (!lastNotification || lastNotification < lastWeek) {
      shouldNotify = true;
    }
  } else if (frequency === 'yearly') {
    const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (!lastNotification || lastNotification < lastYear) {
      shouldNotify = true;
    }
  }
  
  if (shouldNotify) {
    const message = generateNotificationMessage(
      data.dailyUsage || 0,
      data.weeklyUsage || 0,
      data.totalUsage || 0,
      data.userData?.averageUsage || 0,
      frequency
    );
    
    // check if notifications API is available
    if (chrome.notifications && chrome.notifications.create) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Waterer - Usage Summary',
          message: message
        });
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }
    
    await chrome.storage.local.set({ lastNotificationDate: today });
  }
}

// generate notification message
function generateNotificationMessage(daily, weekly, total, average, frequency) {
  if (frequency === 'daily') {
    const difference = average - daily;
    if (difference > 0) {
      const children = Math.floor(difference / 2000);
      return `You saved water for ${children} ${children === 1 ? 'child' : 'children'} today! Total: ${formatWaterUsage(daily)}`;
    } else {
      return `Your usage today: ${formatWaterUsage(daily)}. ${formatWaterUsage(Math.abs(difference))} above average.`;
    }
  } else if (frequency === 'weekly') {
    return `Weekly usage: ${formatWaterUsage(weekly)}. Total saved: ${formatWaterUsage(Math.max(0, average * 7 - weekly))}`;
  } else {
    return `Yearly usage: ${formatWaterUsage(total)}. Keep tracking your water impact!`;
  }
}

function formatWaterUsage(ml) {
  if (ml < 1000) {
    return `${ml} ml`;
  } else if (ml < 1000000) {
    return `${(ml / 1000).toFixed(1)} L`;
  } else {
    return `${(ml / 1000000).toFixed(2)} m³`;
  }
}

// message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_USER_DATA') {
    saveUserData(message.data).then(() => {
      sendResponse({ success: true });
    });
    return true; // async response
  }
  
  if (message.type === 'TRACK_QUERY') {
    trackQuery(message.data).then(() => {
      sendResponse({ success: true });
    });
    return true; // async response
  }
  
  if (message.type === 'GET_COLLECTIVE_TOTAL') {
    getCollectiveTotal().then(total => {
      sendResponse({ total });
    });
    return true;
  }
});

// set up alarms listener first
if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkNotifications') {
      checkNotifications();
    }
  });
  
  // create alarm for periodic checks
  try {
    chrome.alarms.create('checkNotifications', { periodInMinutes: 60 });
  } catch (error) {
    console.error('Error creating alarm:', error);
  }
} else {
  console.warn('chrome.alarms API not available');
}

// check on startup
if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    checkNotifications();
  });
}

// initial check (with error handling)
checkNotifications().catch(error => {
  console.error('Error in initial notification check:', error);
});

