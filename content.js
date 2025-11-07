// content.js - injects UI elements and tracks AI queries

(function() {
  'use strict';
  
  let squareElement = null;
  let bottleElement = null;
  let messageElement = null;
  let queryCount = 0;
  let totalWaterUsage = 0;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  // initialize extension
  async function init() {
    try {
      const data = await chrome.storage.local.get(['surveyCompleted', 'userData', 'dailyUsage']);
      
      if (!data.surveyCompleted) {
        return; // don't show UI until survey is completed
      }
      
      // create UI elements
      createSquare();
      createWaterBottle();
      
      // start tracking
      startTracking();
      
      // load saved position
      loadPositions();
    } catch (error) {
      // handle extension context invalidated errors gracefully
      if (error.message?.includes('Extension context invalidated')) {
        // extension was reloaded, page needs refresh
        console.info('Waterer: Extension was reloaded. Please refresh the page.');
        return;
      }
      console.error('Waterer: Initialization error', error);
    }
  }
  
  // create rounded square element
  function createSquare() {
    // check if square already exists
    const existingSquare = document.querySelector('.waterer-square');
    if (existingSquare) {
      squareElement = existingSquare;
      return; // already exists, don't create again
    }
    
    squareElement = document.createElement('div');
    squareElement.className = 'waterer-container waterer-square appear';
    squareElement.innerHTML = `
      <div class="query-count">0</div>
      <div class="water-usage">0 ml</div>
      <button class="close-btn" title="Remove">×</button>
    `;
    
    // set initial position (top right)
    squareElement.style.position = 'fixed';
    squareElement.style.top = '20px';
    squareElement.style.right = '20px';
    squareElement.style.zIndex = '999999';
    
    document.body.appendChild(squareElement);
    
    // make draggable
    makeDraggable(squareElement);
    
    // close button - hide instead of remove
    squareElement.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      squareElement.style.display = 'none';
      // restore after 5 seconds in case it was accidental
      setTimeout(() => {
        if (squareElement && document.body.contains(squareElement)) {
          squareElement.style.display = '';
        }
      }, 5000);
    });
    
    updateSquareDisplay();
  }
  
  // create water bottle element
  function createWaterBottle() {
    // check if bottle already exists
    const existingContainer = document.querySelector('.water-bottle-container');
    if (existingContainer) {
      bottleElement = existingContainer.querySelector('.water-bottle');
      return; // already exists, don't create again
    }
    
    const container = document.createElement('div');
    container.className = 'water-bottle-container';
    
    // set initial position (bottom left)
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.left = '20px';
    container.style.zIndex = '999998';
    
    bottleElement = document.createElement('div');
    bottleElement.className = 'water-bottle';
    
    const waterFill = document.createElement('div');
    waterFill.className = 'water-fill';
    waterFill.style.height = '0%';
    
    const label = document.createElement('div');
    label.className = 'bottle-label';
    label.textContent = '500ml';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.title = 'Remove';
    
    bottleElement.appendChild(waterFill);
    bottleElement.appendChild(label);
    container.appendChild(bottleElement);
    container.appendChild(closeBtn);
    
    document.body.appendChild(container);
    
    // make draggable
    makeDraggable(container);
    
    // close button - but don't permanently remove, just hide
    closeBtn.addEventListener('click', () => {
      container.style.display = 'none';
      // restore after 5 seconds in case it was accidental
      setTimeout(() => {
        if (container && document.body.contains(container)) {
          container.style.display = '';
        }
      }, 5000);
    });
    
    updateBottleDisplay();
  }
  
  // make element draggable
  function makeDraggable(element) {
    element.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('close-btn')) return;
      
      isDragging = true;
      const rect = element.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      
      // store which element is being dragged
      element.setAttribute('data-dragging', 'true');
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    // find the element being dragged
    const activeElement = document.querySelector('[data-dragging="true"]');
    
    if (activeElement) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      
      activeElement.style.left = `${x}px`;
      activeElement.style.top = `${y}px`;
      activeElement.style.right = 'auto';
      activeElement.style.bottom = 'auto';
    }
  }
  
  function onMouseUp() {
    isDragging = false;
    const activeElement = document.querySelector('[data-dragging="true"]');
    if (activeElement) {
      activeElement.removeAttribute('data-dragging');
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // save positions
    savePositions();
  }
  
  // update square display
  async function updateSquareDisplay() {
    if (!squareElement) return;
    
    // get latest data from storage to ensure accuracy
    const data = await chrome.storage.local.get(['dailyUsage', 'queries']);
    const currentCount = data.queries?.length || queryCount;
    const currentUsage = data.dailyUsage || totalWaterUsage;
    
    const countEl = squareElement.querySelector('.query-count');
    const usageEl = squareElement.querySelector('.water-usage');
    
    if (countEl) {
      countEl.textContent = currentCount;
      // add animation
      countEl.style.transform = 'scale(1.2)';
      setTimeout(() => {
        if (countEl) countEl.style.transform = 'scale(1)';
      }, 300);
    }
    if (usageEl) {
      usageEl.textContent = formatWaterUsage(currentUsage);
    }
    
    // update local variables
    queryCount = currentCount;
    totalWaterUsage = currentUsage;
  }
  
  // update bottle display
  async function updateBottleDisplay() {
    if (!bottleElement) {
      // try to recreate if missing
      const container = document.querySelector('.water-bottle-container');
      if (!container) {
        createWaterBottle();
        // wait a bit for it to be created
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        bottleElement = container.querySelector('.water-bottle');
      }
    }
    
    if (!bottleElement) return;
    
    const data = await chrome.storage.local.get(['userData', 'dailyUsage']);
    const dailyUsage = data.dailyUsage || 0;
    const userData = data.userData || {};
    const averageUsage = userData.averageUsage || 500;
    
    console.log('💧 Waterer: Updating bottle', { dailyUsage, averageUsage });
    
    // determine bottle size (500ml or gallon)
    const useGallon = averageUsage >= 3785.412;
    const bottleCapacity = useGallon ? 3785.412 : 500;
    
    if (useGallon && !bottleElement.classList.contains('gallon')) {
      bottleElement.classList.add('gallon');
      const label = bottleElement.querySelector('.bottle-label');
      if (label) label.textContent = '1 Gallon';
    } else if (!useGallon && bottleElement.classList.contains('gallon')) {
      bottleElement.classList.remove('gallon');
      const label = bottleElement.querySelector('.bottle-label');
      if (label) label.textContent = '500ml';
    }
    
    // calculate fill percentage - start at 0, fill based on current usage
    // use modulo to show remainder after full bottles, but ensure it starts at 0
    const fillPercentage = dailyUsage === 0 ? 0 : Math.min((dailyUsage % bottleCapacity) / bottleCapacity * 100, 100);
    const waterFill = bottleElement.querySelector('.water-fill');
    
    if (waterFill) {
      const oldHeight = parseFloat(waterFill.style.height) || 0;
      waterFill.style.height = `${fillPercentage}%`;
      
      console.log('💧 Waterer: Bottle fill updated', { fillPercentage, dailyUsage, bottleCapacity });
      
      // add wave animation if there's actual usage and it changed
      if (dailyUsage > 0 && Math.abs(fillPercentage - oldHeight) > 1) {
        waterFill.classList.add('wave');
        setTimeout(() => waterFill.classList.remove('wave'), 2000);
      }
    }
  }
  
  // start tracking AI queries
  function startTracking() {
    // monitor network requests for AI services
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      // check both request URL and response
      if (args[0]) {
        checkForAIQuery(args[0], response);
      }
      return response;
    };
    
    // monitor XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._url = url;
      this._method = method;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      this.addEventListener('load', () => {
        if (xhr._method === 'POST' && xhr._url) {
          checkForAIQuery(xhr._url, xhr);
        }
      });
      return originalXHRSend.apply(this, args);
    };
    
    // check current page
    checkCurrentPage();
    
    // observe DOM changes for chat interfaces
    observeChatInterface();
    
    // also set up direct ChatGPT detection
    if (window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com')) {
      setupChatGPTDetection();
    }
  }
  
  // specific ChatGPT detection
  function setupChatGPTDetection() {
    // watch for textarea changes and Enter key
    const observer = new MutationObserver(() => {
      const textarea = document.querySelector('textarea[data-id="root"]') || 
                       document.querySelector('textarea[placeholder*="Message"]') ||
                       document.querySelector('textarea');
      
      if (textarea && !textarea.hasAttribute('data-waterer-tracked')) {
        textarea.setAttribute('data-waterer-tracked', 'true');
        
          // track on Enter key
          textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              const text = textarea.value.trim();
              if (text.length > 0) {
                setTimeout(() => {
                  try {
                    // check if extension context is still valid
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                      trackQuery('chatgpt', estimateQuerySizeFromText(text));
                    }
                  } catch (error) {
                    // extension context invalidated - ignore silently
                    if (!error.message?.includes('Extension context invalidated')) {
                      console.warn('Waterer: Error tracking query', error);
                    }
                  }
                }, 300);
              }
            }
          });
        
        // also watch for send button clicks
        const sendButton = textarea.closest('form')?.querySelector('button[type="submit"]') ||
                          textarea.parentElement?.querySelector('button') ||
                          document.querySelector('button[aria-label*="Send" i]');
        
        if (sendButton && !sendButton.hasAttribute('data-waterer-tracked')) {
          sendButton.setAttribute('data-waterer-tracked', 'true');
          sendButton.addEventListener('click', () => {
            const text = textarea.value.trim();
            if (text.length > 0) {
              setTimeout(() => {
                try {
                  // check if extension context is still valid
                  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                    trackQuery('chatgpt', estimateQuerySizeFromText(text));
                  }
                } catch (error) {
                  // extension context invalidated - ignore silently
                  if (!error.message?.includes('Extension context invalidated')) {
                    console.warn('Waterer: Error tracking query', error);
                  }
                }
              }, 300);
            }
          });
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // also check immediately
    setTimeout(() => {
      try {
        // check if extension context is still valid
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
          return; // extension context invalidated
        }
        
        const textarea = document.querySelector('textarea');
        if (textarea && !textarea.hasAttribute('data-waterer-tracked')) {
          textarea.setAttribute('data-waterer-tracked', 'true');
          textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              const text = textarea.value.trim();
              if (text.length > 0) {
                setTimeout(() => {
                  try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                      trackQuery('chatgpt', estimateQuerySizeFromText(text));
                    }
                  } catch (error) {
                    if (!error.message?.includes('Extension context invalidated')) {
                      console.warn('Waterer: Error tracking query', error);
                    }
                  }
                }, 300);
              }
            }
          });
        }
      } catch (error) {
        // extension context invalidated - ignore silently
        if (!error.message?.includes('Extension context invalidated')) {
          console.warn('Waterer: Error in setupChatGPTDetection', error);
        }
      }
    }, 1000);
  }
  
  // comprehensive list of AI service domains
  const AI_DOMAINS = [
    'chatgpt.com', 'openai.com',
    'gemini.google.com', 'bard.google.com', 'ai.google.dev',
    'claude.ai', 'anthropic.com',
    'perplexity.ai',
    'copilot.microsoft.com', 'bing.com',
    'character.ai',
    'you.com',
    'poe.com',
    'cohere.com',
    'huggingface.co',
    'stability.ai',
    'replicate.com',
    'together.ai',
    'groq.com',
    'mistral.ai'
  ];
  
  // check if current page is an AI service
  function checkCurrentPage() {
    const hostname = window.location.hostname.toLowerCase();
    
    // check against all known AI domains
    for (const domain of AI_DOMAINS) {
      if (hostname.includes(domain)) {
        observeAIService(domain);
        return;
      }
    }
    
    // also observe for generic AI chat patterns
    observeGenericAIChat();
  }
  
  // observe any AI service interface
  function observeAIService(domain) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // comprehensive button selectors for AI services
            const sendButtons = node.querySelectorAll?.(
              'button[aria-label*="Send" i], ' +
              'button[aria-label*="Submit" i], ' +
              'button[data-testid*="send" i], ' +
              'button[data-icon="send"], ' +
              'button[type="submit"]:has(+ textarea), ' +
              'button.send-button, ' +
              'button[class*="send"], ' +
              'button[class*="submit"], ' +
              'form button[type="submit"]'
            );
            
            if (sendButtons && sendButtons.length > 0) {
              sendButtons.forEach(btn => {
                // prevent duplicate listeners
                if (!btn.hasAttribute('data-waterer-tracked')) {
                  btn.setAttribute('data-waterer-tracked', 'true');
                  btn.addEventListener('click', () => {
                    setTimeout(() => {
                      try {
                        // check if extension context is still valid
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                          const modelName = detectAIModelFromDomain(domain);
                          trackQuery(modelName, estimateQuerySize());
                        }
                      } catch (error) {
                        // extension context invalidated - ignore silently
                        if (!error.message?.includes('Extension context invalidated')) {
                          console.warn('Waterer: Error tracking query', error);
                        }
                      }
                    }, 1000);
                  });
                }
              });
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // detect AI model name from domain
  function detectAIModelFromDomain(domain) {
    if (domain.includes('chatgpt') || domain.includes('openai')) return 'chatgpt';
    if (domain.includes('gemini') || domain.includes('bard') || domain.includes('google')) return 'gemini';
    if (domain.includes('claude') || domain.includes('anthropic')) return 'claude';
    if (domain.includes('perplexity')) return 'perplexity';
    if (domain.includes('copilot') || domain.includes('microsoft')) return 'copilot';
    if (domain.includes('character')) return 'character';
    if (domain.includes('you.com')) return 'you';
    if (domain.includes('poe')) return 'poe';
    return 'ai-service';
  }
  
  // observe generic AI chat interfaces (works on any site)
  function observeGenericAIChat() {
    const observer = new MutationObserver(() => {
      // look for common AI chat patterns
      const chatInputs = document.querySelectorAll(
        'textarea[placeholder*="message" i], ' +
        'textarea[placeholder*="chat" i], ' +
        'textarea[placeholder*="ask" i], ' +
        'textarea[placeholder*="prompt" i], ' +
        'input[type="text"][placeholder*="message" i], ' +
        'div[contenteditable="true"][role="textbox"], ' +
        'div[class*="chat-input"], ' +
        'div[class*="message-input"]'
      );
      
      chatInputs.forEach(input => {
        if (!input.hasAttribute('data-waterer-tracked')) {
          input.setAttribute('data-waterer-tracked', 'true');
          
          // track on Enter key
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              const text = input.value || input.textContent || '';
              if (text.trim().length > 0) {
                setTimeout(() => {
                  try {
                    // check if extension context is still valid
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                      // check if this looks like an AI query
                      if (isLikelyAIQuery(text)) {
                        const modelName = detectAIModelFromDomain(window.location.hostname);
                        trackQuery(modelName, estimateQuerySizeFromText(text));
                      }
                    }
                  } catch (error) {
                    // extension context invalidated - ignore silently
                    if (!error.message?.includes('Extension context invalidated')) {
                      console.warn('Waterer: Error tracking query', error);
                    }
                  }
                }, 500);
              }
            }
          });
          
          // also track form submissions
          const form = input.closest('form');
          if (form && !form.hasAttribute('data-waterer-tracked')) {
            form.setAttribute('data-waterer-tracked', 'true');
            form.addEventListener('submit', () => {
              const text = input.value || input.textContent || '';
              if (text.trim().length > 0 && isLikelyAIQuery(text)) {
                setTimeout(() => {
                  try {
                    // check if extension context is still valid
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                      const modelName = detectAIModelFromDomain(window.location.hostname);
                      trackQuery(modelName, estimateQuerySizeFromText(text));
                    }
                  } catch (error) {
                    // extension context invalidated - ignore silently
                    if (!error.message?.includes('Extension context invalidated')) {
                      console.warn('Waterer: Error tracking query', error);
                    }
                  }
                }, 500);
              }
            });
          }
        }
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // check if text input looks like an AI query
  function isLikelyAIQuery(text) {
    const lowerText = text.toLowerCase();
    // common AI query patterns
    const aiPatterns = [
      'explain', 'what is', 'how to', 'tell me', 'write', 'generate',
      'create', 'summarize', 'translate', 'analyze', 'compare',
      'describe', 'define', 'help me', 'assist', 'suggest'
    ];
    
    // check if text contains AI-like patterns or is in a chat interface
    const hasAIPattern = aiPatterns.some(pattern => lowerText.includes(pattern));
    const isInChatInterface = document.querySelector('[class*="chat"], [class*="message"], [id*="chat"]');
    
    return hasAIPattern || isInChatInterface || text.length > 10;
  }
  
  // observe general chat interface (kept for backward compatibility)
  function observeChatInterface() {
    // this is now handled by observeGenericAIChat()
    // keeping this function for compatibility
    observeGenericAIChat();
  }
  
  // comprehensive AI service detection patterns
  const AI_SERVICE_PATTERNS = {
    // OpenAI / ChatGPT
    openai: {
      patterns: ['openai.com', 'chatgpt.com', 'api.openai.com', '/v1/chat', '/v1/completions', '/v1/embeddings'],
      name: 'chatgpt'
    },
    // Google / Gemini / Bard
    google: {
      patterns: ['gemini', 'bard', 'generativelanguage.googleapis.com', 'ai.google.dev', 'makersuite.google.com'],
      name: 'gemini'
    },
    // Anthropic / Claude
    anthropic: {
      patterns: ['anthropic.com', 'claude.ai', 'api.anthropic.com', '/v1/messages'],
      name: 'claude'
    },
    // Perplexity
    perplexity: {
      patterns: ['perplexity.ai', 'api.perplexity.ai'],
      name: 'perplexity'
    },
    // Microsoft / Copilot
    microsoft: {
      patterns: ['copilot.microsoft.com', 'bing.com/chat', 'microsoft.com/copilot', 'copilotstudio.microsoft.com'],
      name: 'copilot'
    },
    // Cohere
    cohere: {
      patterns: ['cohere.com', 'api.cohere.ai', '/v1/generate', '/v1/chat'],
      name: 'cohere'
    },
    // Hugging Face
    huggingface: {
      patterns: ['huggingface.co', 'api-inference.huggingface.co'],
      name: 'huggingface'
    },
    // Stability AI
    stability: {
      patterns: ['stability.ai', 'api.stability.ai'],
      name: 'stability'
    },
    // Replicate
    replicate: {
      patterns: ['replicate.com', 'api.replicate.com'],
      name: 'replicate'
    },
    // Together AI
    together: {
      patterns: ['together.ai', 'api.together.xyz'],
      name: 'together'
    },
    // Groq
    groq: {
      patterns: ['groq.com', 'api.groq.com'],
      name: 'groq'
    },
    // Mistral AI
    mistral: {
      patterns: ['mistral.ai', 'api.mistral.ai'],
      name: 'mistral'
    },
    // Character.AI
    character: {
      patterns: ['character.ai', 'beta.character.ai'],
      name: 'character'
    },
    // You.com
    you: {
      patterns: ['you.com', 'api.you.com'],
      name: 'you'
    },
    // Poe
    poe: {
      patterns: ['poe.com', 'api.poe.com'],
      name: 'poe'
    },
    // Generic AI API patterns
    generic: {
      patterns: ['/api/chat', '/api/completion', '/api/generate', '/v1/chat/completions', '/ai/', '/llm/', '/gpt/', 'openai', 'anthropic', 'claude', 'gemini'],
      name: 'ai-service'
    }
  };
  
  // check network request for AI query
  function checkForAIQuery(url, response) {
    const urlString = typeof url === 'string' ? url : url?.url || url?.toString() || '';
    
    if (!urlString) return;
    
    // normalize url for checking
    const urlLower = urlString.toLowerCase();
    
    // check against all AI service patterns
    for (const [serviceKey, service] of Object.entries(AI_SERVICE_PATTERNS)) {
      for (const pattern of service.patterns) {
        if (urlLower.includes(pattern.toLowerCase())) {
          // only track POST requests (actual API calls)
          const isPost = url?.method === 'POST' || 
                        (typeof url === 'object' && url.method === 'POST') ||
                        urlLower.includes('/chat/completions') ||
                        urlLower.includes('/v1/chat') ||
                        urlLower.includes('/v1/completions');
          
          if (isPost || serviceKey === 'openai' || serviceKey === 'google') {
            trackQuery(service.name, estimateQuerySize());
            return; // found a match, stop checking
          }
        }
      }
    }
  }
  
  // estimate query size (placeholder - needs research-based calculation)
  function estimateQuerySize() {
    // default estimation: ~50ml per query
    // this should be replaced with research-based calculations
    return 50;
  }
  
  function estimateQuerySizeFromText(text) {
    // estimate based on text length
    // rough estimate: 10ml per 100 characters
    const baseUsage = 20; // minimum
    const charBasedUsage = Math.floor(text.length / 100) * 10;
    return baseUsage + charBasedUsage;
  }
  
  // track a query
  async function trackQuery(model, waterUsage) {
    // check if extension context is still valid
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        return; // extension context invalidated
      }
    } catch (error) {
      // extension context invalidated
      return;
    }
    
    // prevent duplicate tracking
    const trackTime = Date.now();
    if (!trackQuery.lastTrackTime) trackQuery.lastTrackTime = 0;
    if (trackTime - trackQuery.lastTrackTime < 1000) {
      return; // ignore if tracked within last second (prevent duplicates)
    }
    trackQuery.lastTrackTime = trackTime;
    
    console.log('💧 Waterer: Tracking query', { model, waterUsage });
    
    // save to storage first
    const data = await chrome.storage.local.get(['dailyUsage', 'weeklyUsage', 'totalUsage', 'queries', 'userData']);
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let dailyUsage = data.dailyUsage || 0;
    let weeklyUsage = data.weeklyUsage || 0;
    let totalUsage = data.totalUsage || 0;
    let queries = data.queries || [];
    
    // check if it's a new day
    const lastQuery = queries[queries.length - 1];
    if (lastQuery && lastQuery.date !== today) {
      dailyUsage = 0; // reset daily usage
    }
    
    dailyUsage += waterUsage;
    weeklyUsage += waterUsage;
    totalUsage += waterUsage;
    
    queries.push({
      date: today,
      model: model,
      waterUsage: waterUsage,
      timestamp: now.toISOString()
    });
    
    // keep only last 7 days for weekly calculation
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    queries = queries.filter(q => q.date >= sevenDaysAgo);
    
    // update local variables
    queryCount = queries.length;
    totalWaterUsage = dailyUsage;
    
    // save to storage
    await chrome.storage.local.set({
      dailyUsage,
      weeklyUsage: queries.reduce((sum, q) => sum + q.waterUsage, 0),
      totalUsage,
      queries
    });
    
    console.log('💧 Waterer: Updated storage', { dailyUsage, queryCount, totalWaterUsage });
    
    // update UI after storage is saved
    updateSquareDisplay();
    await updateBottleDisplay();
    
    // send to background for Supabase sync (with error handling)
    try {
      chrome.runtime.sendMessage({
        type: 'TRACK_QUERY',
        data: {
          model,
          waterUsage,
          timestamp: now.toISOString()
        }
      }).catch((error) => {
        // ignore errors - extension might be reloading or background script not ready
        if (!error.message?.includes('Extension context invalidated')) {
          console.warn('Waterer: Could not send to background', error);
        }
      });
    } catch (error) {
      // extension context might be invalidated (extension was reloaded)
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('Waterer: Error sending message', error);
      }
    }
    
    // show message
    showMessage(dailyUsage, data.userData?.averageUsage || 0);
  }
  
  // show reinforcement message
  async function showMessage(dailyUsage, averageUsage) {
    if (messageElement) {
      messageElement.remove();
    }
    
    messageElement = document.createElement('div');
    messageElement.className = 'waterer-message';
    
    const difference = averageUsage - dailyUsage;
    
    if (difference > 0 && averageUsage > 0) {
      messageElement.classList.add('positive');
      const children = Math.floor(difference / 2000);
      if (children > 0) {
        messageElement.textContent = `🎉 You saved a day's worth of water for ${children} ${children === 1 ? 'child' : 'children'} today!`;
      } else {
        messageElement.textContent = `💧 Great job staying below your average!`;
      }
    } else if (difference < 0 && averageUsage > 0) {
      messageElement.classList.add('negative');
      const excess = Math.abs(difference);
      const children = Math.ceil(excess / 2000);
      messageElement.textContent = `⚠️ You're using more than your average. That's enough for ${children} ${children === 1 ? 'child' : 'children'}.`;
    } else {
      messageElement.textContent = `💧 Query tracked! Total: ${formatWaterUsage(dailyUsage)}`;
    }
    
    const bottleContainer = document.querySelector('.water-bottle-container');
    if (bottleContainer) {
      messageElement.style.bottom = `${bottleContainer.offsetHeight + 30}px`;
      messageElement.style.left = '20px';
    }
    
    document.body.appendChild(messageElement);
    
    // remove after 5 seconds
    setTimeout(() => {
      if (messageElement) {
        messageElement.remove();
        messageElement = null;
      }
    }, 5000);
  }
  
  // format water usage
  function formatWaterUsage(ml) {
    if (ml < 1000) {
      return `${ml} ml`;
    } else if (ml < 1000000) {
      return `${(ml / 1000).toFixed(1)} L`;
    } else {
      return `${(ml / 1000000).toFixed(2)} m³`;
    }
  }
  
  // save positions
  function savePositions() {
    const positions = {};
    
    if (squareElement) {
      const rect = squareElement.getBoundingClientRect();
      positions.square = { x: rect.left, y: rect.top };
    }
    
    const bottleContainer = document.querySelector('.water-bottle-container');
    if (bottleContainer) {
      const rect = bottleContainer.getBoundingClientRect();
      positions.bottle = { x: rect.left, y: rect.top };
    }
    
    chrome.storage.local.set({ uiPositions: positions });
  }
  
  // load positions
  async function loadPositions() {
    const data = await chrome.storage.local.get(['uiPositions']);
    const positions = data.uiPositions || {};
    
    if (squareElement && positions.square) {
      squareElement.style.left = `${positions.square.x}px`;
      squareElement.style.top = `${positions.square.y}px`;
      squareElement.style.right = 'auto';
    }
    
    const bottleContainer = document.querySelector('.water-bottle-container');
    if (bottleContainer && positions.bottle) {
      bottleContainer.style.left = `${positions.bottle.x}px`;
      bottleContainer.style.top = `${positions.bottle.y}px`;
      bottleContainer.style.bottom = 'auto';
    }
  }
  
  // listen for messages (for future enhancements)
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // message handling can be added here if needed
      return false;
    });
  } catch (error) {
    // extension context might be invalidated
    if (!error.message?.includes('Extension context invalidated')) {
      console.warn('Waterer: Error setting up message listener', error);
    }
  }
  
  // initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // update display periodically and ensure UI elements exist
  setInterval(async () => {
    try {
      const data = await chrome.storage.local.get(['dailyUsage', 'queries', 'surveyCompleted']);
      
      // only show UI if survey is completed
      if (!data.surveyCompleted) {
        return;
      }
      
      // recreate square if it doesn't exist
      if (!squareElement || !document.body.contains(squareElement)) {
        createSquare();
      }
      
      // recreate water bottle if it doesn't exist
      const bottleContainer = document.querySelector('.water-bottle-container');
      if (!bottleContainer || !bottleElement) {
        createWaterBottle();
      }
      
      queryCount = data.queries?.length || 0;
      totalWaterUsage = data.dailyUsage || 0;
      updateSquareDisplay();
      await updateBottleDisplay();
    } catch (error) {
      // handle extension context invalidated errors
      if (error.message?.includes('Extension context invalidated')) {
        // stop the interval if extension context is invalid
        console.info('Waterer: Extension context invalidated. Please refresh the page.');
        return;
      }
      console.warn('Waterer: Error in periodic update', error);
    }
  }, 5000);
  
})();

