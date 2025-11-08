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
  let currentUnit = 'ml'; // 'ml', 'gallons', 'ounces'
  
  // dedupe/throttle to prevent overcounting
  let lastHit = 0;
  function safeTrackQuery(model = 'chatgpt', waterUsage = null) {
    const now = Date.now();
    if (now - lastHit < 1500) {
      console.log('💧 Waterer: Throttled duplicate detection (within 1.5s)');
      return; // 1.5s fuse
    }
    lastHit = now;
    if (waterUsage === null) {
      waterUsage = estimateQuerySize(model);
    }
    console.log('💧 Waterer: Tracking query', { model, waterUsage: parseFloat(waterUsage.toFixed(4)) + 'ml' });
    trackQuery(model, waterUsage);
  }
  
  // initialize extension
  async function init() {
    try {
      console.log('💧 Waterer: init() called');
      const data = await chrome.storage.local.get(['surveyCompleted', 'userData', 'dailyUsage']);
      console.log('💧 Waterer: Storage data', { surveyCompleted: data.surveyCompleted, dailyUsage: data.dailyUsage });
      
      if (!data.surveyCompleted) {
        console.log('💧 Waterer: Survey not completed, starting tracking anyway but not showing UI');
        // start tracking even without survey - we'll track but not show UI
        startTracking();
        return;
      }
      
      console.log('💧 Waterer: Survey completed, creating UI and starting tracking');
      // create UI elements
      createSquare();
      createWaterBottle();
      
      // ensure displays are updated with fresh data from storage
      // wait a bit to ensure storage is ready
      setTimeout(async () => {
        await updateSquareDisplay();
        await updateBottleDisplay();
      }, 100);
      
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
      <div class="query-count">0 <span class="suffix">queries</span></div>
      <div class="water-usage">0.0000 <span class="suffix">ml</span></div>
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
    
    // load saved unit preference and listen for changes
    chrome.storage.local.get(['waterUnit'], (result) => {
      if (result.waterUnit && ['ml', 'gallons', 'ounces'].includes(result.waterUnit)) {
        currentUnit = result.waterUnit;
        updateSquareDisplay();
        updateBottleDisplay();
      }
    });
    
    // listen for storage changes (unit changes and data resets)
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === 'local') {
        // handle unit changes
        if (changes.waterUnit) {
          const newUnit = changes.waterUnit.newValue;
          if (['ml', 'gallons', 'ounces'].includes(newUnit)) {
            currentUnit = newUnit;
            await updateSquareDisplay();
            await updateBottleDisplay();
          }
        }
        
        // handle resetting flag
        if (changes.isResetting) {
          if (changes.isResetting.newValue === false) {
            // reset complete, ensure UI is reset
            await resetUIToZero();
          }
        }
        
        // handle data reset (surveyCompleted removed or set to false)
        if (changes.surveyCompleted) {
          const newValue = changes.surveyCompleted.newValue;
          const oldValue = changes.surveyCompleted.oldValue;
          
          // if surveyCompleted was true and is now false/undefined, data was reset
          if (oldValue === true && (newValue === false || newValue === undefined)) {
            await resetUIToZero();
          }
        }
      }
    });
    
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
    label.textContent = '5ml';
    
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
    
    // save positions (with error handling)
    try {
      savePositions();
    } catch (error) {
      // extension context might be invalidated - ignore
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('Waterer: Error in onMouseUp', error);
      }
    }
  }
  
  // update square display
  async function updateSquareDisplay() {
    if (!squareElement) return;
    
    try {
      // check if extension context is still valid
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return; // extension context invalidated
      }
      
      // get latest data from storage to ensure accuracy, including unit preference
      const data = await chrome.storage.local.get(['dailyUsage', 'queries', 'waterUnit']);
      const currentCount = data.queries?.length || queryCount;
      const currentUsage = data.dailyUsage || totalWaterUsage;
      
      // update currentUnit from storage if available
      if (data.waterUnit && ['ml', 'gallons', 'ounces'].includes(data.waterUnit)) {
        currentUnit = data.waterUnit;
      }
    
    const countEl = squareElement.querySelector('.query-count');
    const usageEl = squareElement.querySelector('.water-usage');
    
    if (countEl) {
      // preserve suffix if it exists, otherwise add it
      const suffix = countEl.querySelector('.suffix') || document.createElement('span');
      if (!suffix.classList.contains('suffix')) {
        suffix.className = 'suffix';
        suffix.textContent = ' queries';
      }
      countEl.innerHTML = `${currentCount} `;
      countEl.appendChild(suffix);
      // add animation
      countEl.style.transform = 'scale(1.2)';
      setTimeout(() => {
        if (countEl) countEl.style.transform = 'scale(1)';
      }, 300);
    }
    if (usageEl) {
      // get unit from storage to ensure accuracy
      const unitData = await chrome.storage.local.get(['waterUnit']);
      const unitToUse = unitData.waterUnit || currentUnit || 'ml';
      
      // update currentUnit for consistency
      if (unitData.waterUnit && ['ml', 'gallons', 'ounces'].includes(unitData.waterUnit)) {
        currentUnit = unitData.waterUnit;
      }
      
      // format water usage based on selected unit (now async)
      const formatted = await formatWaterUsage(currentUsage, unitToUse);
      const parts = formatted.split(' ');
      const numberPart = parts[0];
      // get unit label - formatWaterUsage might return "L" or "m³" for ml, so check parts
      let unitLabel = parts[1];
      if (!unitLabel || (unitLabel === 'L' || unitLabel === 'm³')) {
        // if formatWaterUsage returned L or m³, use that, otherwise use the selected unit label
        unitLabel = parts[1] || getUnitLabel(unitToUse);
      }
      
      // calculate bottles based on 5ml capacity (only show if unit is ml)
      const bottles = unitToUse === 'ml' ? Math.floor(currentUsage / 5) : 0;
      
      // create or get suffix element
      let suffix = usageEl.querySelector('.suffix');
      if (!suffix) {
        suffix = document.createElement('span');
        suffix.className = 'suffix';
      }
      
      // show bottles if >= 1 bottle and unit is ml, otherwise show converted value
      if (bottles >= 1 && unitToUse === 'ml') {
        const bottleText = bottles === 1 ? 'bottle' : 'bottles';
        // format: "2 bottles" on main line, "10.823 ml" as smaller suffix
        usageEl.innerHTML = `${bottles} <span class="suffix">${bottleText}</span>`;
        // add ml value as a separate smaller element below
        let mlValue = usageEl.querySelector('.ml-value');
        if (!mlValue) {
          mlValue = document.createElement('div');
          mlValue.className = 'ml-value';
          mlValue.style.cssText = 'font-size: 8px; opacity: 0.7; margin-top: 2px;';
          usageEl.appendChild(mlValue);
        }
        mlValue.textContent = `${numberPart} ${unitLabel}`;
      } else {
        // show converted value directly
        suffix.textContent = ` ${unitLabel}`;
        usageEl.innerHTML = `${numberPart}`;
        usageEl.appendChild(suffix);
        // remove ml-value if it exists
        const mlValue = usageEl.querySelector('.ml-value');
        if (mlValue) mlValue.remove();
      }
    }
    
      // update local variables
      queryCount = currentCount;
      totalWaterUsage = currentUsage;
    } catch (error) {
      // extension context invalidated - ignore silently
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('Waterer: Error updating square display', error);
      }
    }
  }
  
  // conversion constants (accurate US fluid measurements)
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
  
  // toggle between units: ml -> gallons -> ounces -> ml
  async function toggleUnit() {
    const units = ['ml', 'gallons', 'ounces'];
    const currentIndex = units.indexOf(currentUnit);
    currentUnit = units[(currentIndex + 1) % units.length];
    
    // save preference
    await chrome.storage.local.set({ waterUnit: currentUnit });
    
    // update both displays with converted values
    await updateSquareDisplay();
    await updateBottleDisplay();
  }
  
  // helper function to format water usage with up to 4 decimal places (removes trailing zeros)
  // always reads unit from storage to ensure accuracy
  async function formatWaterUsage(ml, unit = null) {
    // if unit not provided, read from storage
    let targetUnit = unit;
    if (!targetUnit) {
      try {
        const data = await chrome.storage.local.get(['waterUnit']);
        targetUnit = data.waterUnit || currentUnit || 'ml';
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
  
  // update bottle display
  async function updateBottleDisplay() {
    try {
      // check if extension context is still valid
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return; // extension context invalidated
      }
      
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
      
      // determine bottle size (5ml for now, or gallon for very high usage)
      // use 5ml bottle for better visibility per query
      const useGallon = averageUsage >= 3785.412;
      const bottleCapacity = useGallon ? 3785.412 : 5; // reduced to 5ml for visibility
      
      if (useGallon && !bottleElement.classList.contains('gallon')) {
        bottleElement.classList.add('gallon');
      } else if (!useGallon && bottleElement.classList.contains('gallon')) {
        bottleElement.classList.remove('gallon');
      }
      
      // update label with selected unit (read from storage)
      const unitData = await chrome.storage.local.get(['waterUnit']);
      const unitToUse = unitData.waterUnit || currentUnit || 'ml';
      if (unitData.waterUnit && ['ml', 'gallons', 'ounces'].includes(unitData.waterUnit)) {
        currentUnit = unitData.waterUnit;
      }
      
      const label = bottleElement.querySelector('.bottle-label');
      if (label) {
        if (useGallon) {
          const gallonLabel = await formatWaterUsage(3785.41, unitToUse);
          label.textContent = gallonLabel;
        } else {
          const mlLabel = await formatWaterUsage(5, unitToUse);
          label.textContent = mlLabel;
        }
      }
      
      // calculate fill percentage - start at 0, fill based on current usage
      // use modulo to show remainder after full bottles, but ensure it starts at 0
      // since water usage is very small (0.3ml per query), we'll show cumulative usage
      // 33 queries = 500ml bottle (from research: "Every 33 response generated equates to one 500ml water bottle")
      // so we accumulate small increments until they reach meaningful bottle fills
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
    } catch (error) {
      // extension context invalidated - ignore silently
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('Waterer: Error updating bottle display', error);
      }
    }
  }
  
  // inject fetch hook into page context (most reliable method)
  // uses external script file to avoid CSP violations from inline scripts
  function injectFetchHook() {
    console.log('💧 Waterer: Injecting fetch hook into page context');
    try {
      // get extension ID dynamically
      const scriptUrl = chrome.runtime.getURL('fetch-hook.js');
      
      const s = document.createElement('script');
      s.src = scriptUrl;
      s.onerror = () => {
        console.warn('💧 Waterer: Failed to load fetch-hook.js, falling back to inline injection');
        // fallback: try inline injection if external file fails
        const fallback = document.createElement('script');
        fallback.textContent = `
          (function(){
            const _fetch = window.fetch;
            window.fetch = async function(input, init){
              try {
                const url = (typeof input === 'string') ? input : (input && input.url) || '';
                const method = (init && init.method) || (input && input.method) || 'GET';
                const looksLikeChatGPT = method === 'POST' && (/\\/backend-api\\/conversation/.test(url) || /\\/backend-anon\\/conversation/.test(url));
                const looksLikeGoogleAI = method === 'POST' && (/generativelanguage\\.googleapis\\.com/.test(url) || /\\/v1\\/models/.test(url) || /gemini/.test(url) || /ai\\.google\\.dev/.test(url));
                if (looksLikeChatGPT) {
                  window.postMessage({ type: 'waterer:send-start', url: url, model: 'chatgpt' }, '*');
                } else if (looksLikeGoogleAI) {
                  window.postMessage({ type: 'waterer:send-start', url: url, model: 'gemini' }, '*');
                }
                const resp = await _fetch.apply(this, arguments);
                if (looksLikeChatGPT && resp.ok) {
                  window.postMessage({ type: 'waterer:send-ok', url: url, model: 'chatgpt' }, '*');
                } else if (looksLikeGoogleAI && resp.ok) {
                  window.postMessage({ type: 'waterer:send-ok', url: url, model: 'gemini' }, '*');
                }
                return resp;
              } catch (e) {
                return (typeof _fetch === 'function') ? _fetch.apply(this, arguments) : Promise.reject(e);
              }
            };
            const _sb = navigator.sendBeacon;
            if (_sb) {
              navigator.sendBeacon = function(url, data){
                const looksLikeChatGPT = /\\/backend-api\\/conversation/.test(url) || /\\/backend-anon\\/conversation/.test(url);
                const looksLikeGoogleAI = /generativelanguage\\.googleapis\\.com/.test(url) || /\\/v1\\/models/.test(url) || /gemini/.test(url) || /ai\\.google\\.dev/.test(url);
                if (looksLikeChatGPT) {
                  window.postMessage({ type: 'waterer:send-start', url: url, model: 'chatgpt' }, '*');
                  setTimeout(() => {
                    window.postMessage({ type: 'waterer:send-ok', url: url, model: 'chatgpt' }, '*');
                  }, 100);
                } else if (looksLikeGoogleAI) {
                  window.postMessage({ type: 'waterer:send-start', url: url, model: 'gemini' }, '*');
                  setTimeout(() => {
                    window.postMessage({ type: 'waterer:send-ok', url: url, model: 'gemini' }, '*');
                  }, 100);
                }
                return _sb.apply(this, arguments);
              };
            }
          })();
        `;
        (document.head || document.documentElement).appendChild(fallback);
        fallback.remove();
      };
      (document.head || document.documentElement).appendChild(s);
      s.remove();
      console.log('💧 Waterer: Fetch hook injected');
    } catch (e) {
      console.error('💧 Waterer: Error injecting fetch hook', e);
    }
  }
  
  // listen for page->content notifications from fetch hook
  function setupMessageListener() {
    window.addEventListener('message', (ev) => {
      if (!ev || !ev.data || typeof ev.data !== 'object') return;
      const { type, model } = ev.data;
      if (type === 'waterer:send-start' || type === 'waterer:send-ok') {
        const detectedModel = model || 'chatgpt'; // default to chatgpt if not specified
        console.log('💧 Waterer: Received message from page context', type, 'model:', detectedModel);
        try {
          safeTrackQuery(detectedModel);
        } catch (error) {
          console.error('💧 Waterer: Error in safeTrackQuery', error);
        }
      }
    });
    console.log('💧 Waterer: Message listener set up');
  }
  
  // detect Google AI Overviews
  function observeGoogleAIOverview() {
    console.log('💧 Waterer: Setting up Google AI Overview detection');
    const seen = new WeakSet();
    
    const checkForAIOverview = () => {
      // detect AI Overview section on Google search
      const aiOverview = document.querySelector('[data-ved*="ai"], [aria-label*="AI Overview"], [class*="ai-overview"], [id*="ai-overview"]');
      if (aiOverview && !seen.has(aiOverview)) {
        seen.add(aiOverview);
        console.log('💧 Waterer: Detected Google AI Overview');
        // track as a Google/Gemini query
        safeTrackQuery('gemini');
      }
      
      // also check for AI Overview text indicators
      const aiOverviewText = Array.from(document.querySelectorAll('*')).find(el => {
        const text = el.textContent || '';
        return text.includes('AI Overview') && el.offsetParent !== null;
      });
      
      if (aiOverviewText && !seen.has(aiOverviewText)) {
        seen.add(aiOverviewText);
        console.log('💧 Waterer: Detected AI Overview text indicator');
        safeTrackQuery('gemini');
      }
    };
    
    // check immediately
    checkForAIOverview();
    
    // observe for AI Overview appearance
    const mo = new MutationObserver(() => {
      checkForAIOverview();
    });
    
    mo.observe(document.body, { childList: true, subtree: true });
    
    // also check periodically
    setInterval(checkForAIOverview, 2000);
  }
  
  // observe DOM for new messages (fallback method)
  function observeSendsViaDOM() {
    console.log('💧 Waterer: Setting up MutationObserver for message detection');
    // resilient root selector: page often has a main chat scroll region
    const root = document.querySelector('[role="log"], [data-testid="conversation-turns"], main, [class*="conversation"]') || document.body;
    const seen = new WeakSet();
    
    const mo = new MutationObserver((muts) => {
      let newUserOrAssistantNode = false;
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          m.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement) || seen.has(node)) return;
            // heuristics: a turn bubble with data attributes or roles
            const isTurn = node.matches?.('[data-testid="conversation-turn"], [data-message-author-role], article[class*="message"], li[class*="message"], div[class*="turn"]');
            if (isTurn) {
              seen.add(node);
              newUserOrAssistantNode = true;
              console.log('💧 Waterer: Detected new conversation turn in DOM', node);
            }
          });
        }
      }
      if (newUserOrAssistantNode) {
        // throttle this too to avoid double-counting with fetch hook
        setTimeout(() => {
          try {
            safeTrackQuery('chatgpt');
          } catch (error) {
            console.error('💧 Waterer: Error tracking via DOM observer', error);
          }
        }, 500); // slight delay to let fetch hook fire first
      }
    });
    
    mo.observe(root, { childList: true, subtree: true });
    console.log('💧 Waterer: MutationObserver active on', root);
  }
  
  // start tracking AI queries
  function startTracking() {
    console.log('💧 Waterer: startTracking() called on', window.location.hostname);
    
    // method 1: inject fetch hook into page context (most reliable)
    injectFetchHook();
    setupMessageListener();
    
    // method 2: detect Google AI Overviews (for Google search pages)
    if (window.location.hostname.includes('google.com') || window.location.hostname.includes('google.')) {
      observeGoogleAIOverview();
    }
    
    // method 3: observe DOM for new messages (fallback)
    observeSendsViaDOM();
    
    // method 3: keep old network monitoring as additional fallback
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      // check both request URL and response
      if (args[0]) {
        const url = args[0]?.toString() || '';
        if (checkForAIQuery(url, response)) {
          console.log('💧 Waterer: Detected AI query in fetch (content script)', url);
        }
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
          if (checkForAIQuery(xhr._url, xhr)) {
            console.log('💧 Waterer: Detected AI query in XHR', xhr._url);
          }
        }
      });
      return originalXHRSend.apply(this, args);
    };
    
    // check current page
    checkCurrentPage();
    
    // observe DOM changes for chat interfaces
    observeChatInterface();
    
    // also set up direct ChatGPT detection
    const hostname = window.location.hostname;
    console.log('💧 Waterer: Checking hostname for ChatGPT detection:', hostname);
    if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      console.log('💧 Waterer: ChatGPT domain detected, setting up detection');
      setupChatGPTDetection();
    } else {
      console.log('💧 Waterer: Not a ChatGPT domain, using generic detection');
    }
  }
  
  // specific ChatGPT detection
  function setupChatGPTDetection() {
    console.log('💧 Waterer: Setting up ChatGPT detection');
    
    let trackedTextareas = new Set();
    let trackedButtons = new Set();
    let textareaCount = 0;
    let buttonCount = 0;
    
    function attachTracking(textarea) {
      if (!textarea || trackedTextareas.has(textarea)) return;
      
      trackedTextareas.add(textarea);
      textareaCount++;
      console.log('💧 Waterer: Attached tracking to textarea #' + textareaCount, {
        id: textarea.id,
        className: textarea.className,
        placeholder: textarea.placeholder,
        value: textarea.value?.substring(0, 20)
      });
      
      // track on Enter key - use capture phase to catch it before ChatGPT
      textarea.addEventListener('keydown', (e) => {
        console.log('💧 Waterer: Keydown event detected', { key: e.key, shiftKey: e.shiftKey, value: textarea.value?.substring(0, 30) });
        if (e.key === 'Enter' && !e.shiftKey) {
          // capture text immediately before it might be cleared
          const text = textarea.value?.trim() || '';
          console.log('💧 Waterer: Enter key pressed (no shift), text length:', text.length, 'text:', text.substring(0, 50));
          if (text.length > 0) {
            // track immediately, don't wait
            try {
              if (isChromeContextValid()) {
                const waterUsage = estimateQuerySizeFromText(text);
                console.log('💧 Waterer: Calling trackQuery immediately', { model: 'chatgpt', waterUsage, textLength: text.length });
                trackQuery('chatgpt', waterUsage);
              } else {
                // chrome runtime not available - silently skip (expected when extension context invalidated)
              }
            } catch (error) {
              console.error('💧 Waterer: Error in trackQuery call', error);
              if (!error.message?.includes('Extension context invalidated')) {
                console.warn('Waterer: Error tracking query', error);
              }
            }
          } else {
            console.log('💧 Waterer: Enter pressed but textarea is empty');
          }
        }
      }, true); // use capture phase
      
      // also listen to input events to capture text as user types
      let lastInputValue = '';
      textarea.addEventListener('input', (e) => {
        lastInputValue = textarea.value || '';
      });
      
      // backup: track on beforeinput to catch before value changes
      textarea.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'insertLineBreak' || (e.data === null && e.inputType === 'insertText')) {
          const text = textarea.value?.trim() || '';
          if (text.length > 0) {
            console.log('💧 Waterer: beforeinput detected, text length:', text.length);
          }
        }
      });
      
      // also watch for form submission
      const form = textarea.closest('form');
      if (form && !form.hasAttribute('data-waterer-tracked')) {
        form.setAttribute('data-waterer-tracked', 'true');
        form.addEventListener('submit', (e) => {
          const text = textarea.value?.trim() || textarea.textContent?.trim() || '';
          console.log('💧 Waterer: Form submitted, text length:', text.length, 'text:', text.substring(0, 50));
          if (text.length > 0) {
            try {
              if (isChromeContextValid()) {
                console.log('💧 Waterer: Calling trackQuery from form submit', { model: 'chatgpt', textLength: text.length });
                trackQuery('chatgpt', estimateQuerySizeFromText(text));
              }
            } catch (error) {
              console.error('💧 Waterer: Error in trackQuery call from form', error);
              if (!error.message?.includes('Extension context invalidated')) {
                console.warn('Waterer: Error tracking query', error);
              }
            }
          }
        }, true); // use capture phase
      }
      
      // find and track send button
      const findSendButton = () => {
        const buttons = [
          textarea.closest('form')?.querySelector('button[type="submit"]'),
          textarea.parentElement?.querySelector('button'),
          textarea.parentElement?.parentElement?.querySelector('button'),
          document.querySelector('button[aria-label*="Send" i]'),
          document.querySelector('button[data-testid*="send" i]'),
          document.querySelector('button[title*="Send" i]')
        ].filter(Boolean);
        
          for (const btn of buttons) {
            if (!trackedButtons.has(btn)) {
              trackedButtons.add(btn);
              buttonCount++;
              console.log('💧 Waterer: Attached tracking to button #' + buttonCount, {
                ariaLabel: btn.getAttribute('aria-label'),
                dataTestId: btn.getAttribute('data-testid'),
                className: btn.className
              });
              btn.addEventListener('click', (e) => {
                console.log('💧 Waterer: Button click detected', { buttonId: btn.id, ariaLabel: btn.getAttribute('aria-label') });
                // try multiple ways to get the text
                const text = textarea.value?.trim() || textarea.textContent?.trim() || '';
                console.log('💧 Waterer: Send button clicked, text length:', text.length, 'text:', text.substring(0, 50));
                if (text.length > 0) {
                  // track immediately
                  try {
                    if (isChromeContextValid()) {
                      const waterUsage = estimateQuerySizeFromText(text);
                      console.log('💧 Waterer: Calling trackQuery from button immediately', { model: 'chatgpt', waterUsage, textLength: text.length });
                      trackQuery('chatgpt', waterUsage);
                    }
                  } catch (error) {
                    console.error('💧 Waterer: Error in trackQuery call from button', error);
                    if (!error.message?.includes('Extension context invalidated')) {
                      console.warn('Waterer: Error tracking query', error);
                    }
                  }
                } else {
                  console.log('💧 Waterer: Button clicked but textarea is empty, trying to find text in DOM...');
                  // try to find the text in the DOM
                  const form = textarea.closest('form');
                  if (form) {
                    const allInputs = form.querySelectorAll('input, textarea');
                    for (const input of allInputs) {
                      const val = input.value?.trim() || input.textContent?.trim() || '';
                      if (val.length > 0) {
                        console.log('💧 Waterer: Found text in another input:', val.substring(0, 50));
                        trackQuery('chatgpt', estimateQuerySizeFromText(val));
                        break;
                      }
                    }
                  }
                }
              }, true); // use capture phase
          }
        }
      };
      
      findSendButton();
      
      // also watch for button creation
      const buttonObserver = new MutationObserver(() => {
        findSendButton();
      });
      buttonObserver.observe(textarea.closest('form') || document.body, { childList: true, subtree: true });
    }
    
    // watch for textarea changes
    const observer = new MutationObserver(() => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(attachTracking);
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // check immediately and periodically
    const checkAndAttach = () => {
      try {
        // silently return if chrome context is invalid (expected when extension is reloaded)
        if (!isChromeContextValid()) {
          return;
        }
        
        const textareas = document.querySelectorAll('textarea');
        console.log('💧 Waterer: Found', textareas.length, 'textareas on page');
        textareas.forEach((ta, index) => {
          console.log('💧 Waterer: Textarea', index, {
            id: ta.id,
            className: ta.className,
            placeholder: ta.placeholder,
            visible: ta.offsetParent !== null
          });
          attachTracking(ta);
        });
        
        // also try to find send buttons
        const sendButtons = document.querySelectorAll('button[aria-label*="Send" i], button[data-testid*="send" i], button[title*="Send" i]');
        console.log('💧 Waterer: Found', sendButtons.length, 'send buttons on page');
      } catch (error) {
        console.error('💧 Waterer: Error in checkAndAttach', error);
        if (!error.message?.includes('Extension context invalidated')) {
          console.warn('Waterer: Error in checkAndAttach', error);
        }
      }
    };
    
    // run immediately and multiple times
    console.log('💧 Waterer: Starting periodic textarea detection');
    checkAndAttach();
    setTimeout(checkAndAttach, 500);
    setTimeout(checkAndAttach, 2000);
    setTimeout(checkAndAttach, 5000);
    setTimeout(checkAndAttach, 10000);
    
    // also check periodically
    setInterval(checkAndAttach, 10000);
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
                        if (isChromeContextValid()) {
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
  
  // helper to safely check if chrome APIs are available
  function isChromeContextValid() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             chrome.runtime.id && 
             chrome.storage && 
             chrome.storage.local;
    } catch (error) {
      return false;
    }
  }
  
  // observe generic AI chat interfaces (works on any site)
  function observeGenericAIChat() {
    const observer = new MutationObserver(() => {
      // check chrome context before doing anything
      if (!isChromeContextValid()) {
        return; // extension context invalidated, stop observing
      }
      
      try {
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
                    if (isChromeContextValid()) {
                      // check if this looks like an AI query
                      if (isLikelyAIQuery(text)) {
                        const modelName = detectAIModelFromDomain(window.location.hostname);
                        trackQuery(modelName, estimateQuerySizeFromText(text));
                      }
                    }
                  } catch (error) {
                    // extension context invalidated - ignore silently
                    const errorMsg = error?.message || String(error);
                    if (!errorMsg.includes('Extension context invalidated') && 
                        !errorMsg.includes('message handler closed')) {
                      // only log unexpected errors
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
                    if (isChromeContextValid()) {
                      const modelName = detectAIModelFromDomain(window.location.hostname);
                      trackQuery(modelName, estimateQuerySizeFromText(text));
                    }
                  } catch (error) {
                    // extension context invalidated - ignore silently
                    const errorMsg = error?.message || String(error);
                    if (!errorMsg.includes('Extension context invalidated') && 
                        !errorMsg.includes('message handler closed')) {
                      // only log unexpected errors
                    }
                  }
                }, 500);
              }
            });
          }
        }
      });
      } catch (error) {
        // extension context invalidated or other error - stop observing
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('Extension context invalidated') || 
            errorMsg.includes('message handler closed')) {
          observer.disconnect();
        }
      }
    });
    
    try {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    } catch (error) {
      // ignore observation errors
    }
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
  
  // accurate water usage per AI query (in ml)
  // based on research: GPT = 0.000085 gallons, Gemini = 0.0000687 gallons
  // 1 gallon = 3785.41 ml
  const WATER_USAGE_PER_QUERY = {
    'chatgpt': 0.000085 * 3785.41,      // ~0.322 ml per query
    'openai': 0.000085 * 3785.41,       // ~0.322 ml per query
    'gpt': 0.000085 * 3785.41,          // ~0.322 ml per query
    'gemini': 0.0000687 * 3785.41,       // ~0.260 ml per query
    'google': 0.0000687 * 3785.41,       // ~0.260 ml per query
    'bard': 0.0000687 * 3785.41,        // ~0.260 ml per query
    'claude': 0.00007 * 3785.41,        // ~0.265 ml per query (average)
    'anthropic': 0.00007 * 3785.41,     // ~0.265 ml per query
    'default': 0.00007 * 3785.41         // ~0.265 ml per query (average for other AI)
  };
  
  // estimate query size based on model
  function estimateQuerySize(model = 'default') {
    // normalize model name
    const modelLower = (model || 'default').toLowerCase();
    
    // find matching model or use default
    let usage = WATER_USAGE_PER_QUERY.default;
    for (const [key, value] of Object.entries(WATER_USAGE_PER_QUERY)) {
      if (modelLower.includes(key)) {
        usage = value;
        break;
      }
    }
    
    // round to 4 decimal places for accuracy
    return Math.round(usage * 10000) / 10000;
  }
  
  function estimateQuerySizeFromText(text, model = 'default') {
    // base usage per query (doesn't vary much with text length for AI)
    // AI queries have relatively consistent water usage regardless of length
    // because the computation is similar
    return estimateQuerySize(model);
  }
  
  // track a query
  async function trackQuery(model, waterUsage) {
    // check if extension context is still valid
    if (!isChromeContextValid()) {
      return; // extension context invalidated
    }
    
    // prevent duplicate tracking
    const trackTime = Date.now();
    if (!trackQuery.lastTrackTime) trackQuery.lastTrackTime = 0;
    if (trackTime - trackQuery.lastTrackTime < 1000) {
      return; // ignore if tracked within last second (prevent duplicates)
    }
    trackQuery.lastTrackTime = trackTime;
    
    console.log('💧 Waterer: Tracking query', { model, waterUsage, timestamp: new Date().toISOString() });
    
    // save to storage first
    let data;
    try {
      data = await chrome.storage.local.get(['dailyUsage', 'weeklyUsage', 'totalUsage', 'queries', 'userData']);
      console.log('💧 Waterer: Current storage data', data);
    } catch (error) {
      console.error('💧 Waterer: Error reading storage', error);
      return;
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let dailyUsage = data.dailyUsage || 0;
    let weeklyUsage = data.weeklyUsage || 0;
    let totalUsage = data.totalUsage || 0;
    let queries = data.queries || [];
    let userData = data.userData || {};
    let dailyHistory = userData.dailyHistory || [];
    
    // check if it's a new day
    const lastQuery = queries[queries.length - 1];
    if (lastQuery && lastQuery.date !== today) {
      // save yesterday's usage to history before resetting
      if (dailyUsage > 0) {
        dailyHistory.push({
          date: lastQuery.date,
          usage: dailyUsage
        });
        // keep only last 30 days of history
        if (dailyHistory.length > 30) {
          dailyHistory = dailyHistory.slice(-30);
        }
      }
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
    
    // calculate rolling average from daily history (last 7 days if available, otherwise all history)
    let averageUsage = 0;
    if (dailyHistory.length > 0) {
      const recentHistory = dailyHistory.slice(-7); // last 7 days
      const totalRecentUsage = recentHistory.reduce((sum, day) => sum + day.usage, 0);
      averageUsage = totalRecentUsage / recentHistory.length;
    } else if (dailyUsage > 0) {
      // if no history yet, use current day as starting point
      averageUsage = dailyUsage;
    }
    
    // update userData with calculated average and history
    userData.averageUsage = Math.round(averageUsage * 100) / 100; // round to 2 decimal places
    userData.dailyHistory = dailyHistory;
    
    // save to storage
    try {
      await chrome.storage.local.set({
        dailyUsage,
        weeklyUsage: queries.reduce((sum, q) => sum + q.waterUsage, 0),
        totalUsage,
        queries,
        userData: userData
      });
      
      console.log('💧 Waterer: Updated storage', { dailyUsage, queryCount, totalWaterUsage, queriesCount: queries.length });
      
      // verify it was saved (format to avoid floating point precision issues)
      const verify = await chrome.storage.local.get(['dailyUsage']);
      const formattedDailyUsage = verify.dailyUsage ? parseFloat(verify.dailyUsage.toFixed(4)) : 0;
      console.log('💧 Waterer: Verification - saved dailyUsage:', formattedDailyUsage);
    } catch (error) {
      console.error('💧 Waterer: Error saving to storage', error);
      return;
    }
    
    // update UI after storage is saved
    await updateSquareDisplay();
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
    
    // show message (use calculated average) - get fresh data to ensure we have latest average
    // use setTimeout to ensure message shows after UI updates
    setTimeout(async () => {
      try {
        const latestData = await chrome.storage.local.get(['dailyUsage', 'userData']);
        const latestDailyUsage = latestData.dailyUsage || dailyUsage;
        const latestUserData = latestData.userData || userData;
        showMessage(latestDailyUsage, latestUserData.averageUsage || 0);
      } catch (error) {
        console.warn('💧 Waterer: Error showing message', error);
      }
    }, 100);
  }
  
  // show reinforcement message
  async function showMessage(dailyUsage, averageUsage) {
    console.log('💧 Waterer: showMessage called', { dailyUsage, averageUsage });
    
    if (messageElement) {
      messageElement.remove();
      messageElement = null;
    }
    
    messageElement = document.createElement('div');
    messageElement.className = 'waterer-message';
    
    const difference = averageUsage - dailyUsage;
    
    // show educational messages if average is 0 (user hasn't established baseline yet)
    if (!averageUsage || averageUsage === 0) {
      console.log('💧 Waterer: Showing educational message (average is 0)');
      // calculate real-world impact for educational purposes
      const childDailyNeed = 236.588; // 8 oz per child per day (1 oz = 29.5735 ml, 8 oz = 236.588 ml)
      const adultDailyNeed = 3000; // average: 3L per adult per day
      const dogDailyNeed = 1500;    // ~1.5L per 50lb dog per day
      const catDailyNeed = 250;     // ~0.25L per 10lb cat per day
      
      const children = Math.floor(dailyUsage / childDailyNeed);
      const adults = Math.floor(dailyUsage / adultDailyNeed);
      const dogs = Math.floor(dailyUsage / dogDailyNeed);
      const cats = Math.floor(dailyUsage / catDailyNeed);
      
      // create educational message with real-world impact
      // get unit from storage for accurate formatting
      const unitData = await chrome.storage.local.get(['waterUnit']);
      const unitToUse = unitData.waterUnit || currentUnit || 'ml';
      
      let message = '';
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
      
      messageElement.textContent = message;
      messageElement.classList.add('positive'); // use positive styling for educational messages
      
      // ensure body exists and append message
      if (document.body) {
        document.body.appendChild(messageElement);
        console.log('💧 Waterer: Educational message displayed', message);
      } else {
        console.warn('💧 Waterer: document.body not available, cannot show message');
      }
      
      setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
          messageElement.remove();
          messageElement = null;
        }
      }, 10000); // increased to 10 seconds
      return;
    }
    
    // accurate water needs (from research data)
    const childDailyNeed = 236.588; // 8 oz per child per day (1 oz = 29.5735 ml, 8 oz = 236.588 ml)
    const adultDailyNeed = 3000; // average: 3L per adult per day
    const dogDailyNeed = 1500;    // ~1.5L per 50lb dog per day
    const catDailyNeed = 250;     // ~0.25L per 10lb cat per day
    const animalShelterDailyNeed = 50000; // ~50L per animal shelter per day
    
    if (difference > 0) {
      // positive - saved water (below average)
      const excess = Math.abs(difference);
      const children = Math.floor(excess / childDailyNeed);
      const adults = Math.floor(excess / adultDailyNeed);
      const dogs = Math.floor(excess / dogDailyNeed);
      const cats = Math.floor(excess / catDailyNeed);
      const shelters = Math.floor(excess / animalShelterDailyNeed);
      
      messageElement.classList.add('positive');
      
      // prioritize most impactful messages with diverse variations
      const positiveMessages = {
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
          `You saved enough water for ${adults} ${adults === 1 ? 'adult' : 'adults'} today!`,
          `${adults} ${adults === 1 ? 'person' : 'people'} could stay hydrated thanks to your mindful AI usage!`,
          `Your sustainable choices provided daily water for ${adults} ${adults === 1 ? 'adult' : 'adults'} today!`
        ],
        dogs: [
          `You saved enough water for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} today!`,
          `${dogs} ${dogs === 1 ? 'dog' : 'dogs'} could stay healthy with the water you saved today!`,
          `Your water savings could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day!`
        ],
        cats: [
          `You saved enough water for ${cats} ${cats === 1 ? 'cat' : 'cats'} today!`,
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
      if (children >= 3) {
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
      
      messageElement.textContent = message;
    } else if (difference < 0 && averageUsage > 0) {
      // negative - used more (above average)
      const excess = Math.abs(difference);
      const children = Math.ceil(excess / childDailyNeed);
      const adults = Math.ceil(excess / adultDailyNeed);
      const dogs = Math.ceil(excess / dogDailyNeed);
      const shelters = Math.ceil(excess / animalShelterDailyNeed);
      
      messageElement.classList.add('negative');
      
      // warnings with diverse variations
      const negativeMessages = {
        children3plus: [
          `That's enough water for ${children} children. Consider reducing your AI queries to help those in need.`,
          `Your excess usage could hydrate ${children} children. Your AI queries have a real humanitarian cost.`,
          `${children} children could drink clean water with what you're using above average. Be more mindful.`
        ],
        children: [
          `That's enough water for ${children} ${children === 1 ? 'child' : 'children'}. Consider reducing your AI queries.`,
          `Your extra usage equals a day's water for ${children} ${children === 1 ? 'child' : 'children'}. Think about reducing AI queries.`,
          `${children} ${children === 1 ? 'child' : 'children'} could stay hydrated with your excess water usage.`
        ],
        shelters: [
          `That's enough for ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'}. Be mindful of your AI usage.`,
          `Your excess usage could support ${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'}. Consider the impact.`,
          `${shelters} ${shelters === 1 ? 'animal shelter' : 'animal shelters'} could use the water you're consuming above average.`
        ],
        adults: [
          `That's enough water for ${adults} ${adults === 1 ? 'adult' : 'adults'}. Consider reducing your AI queries.`,
          `Your excess usage equals daily water for ${adults} ${adults === 1 ? 'person' : 'people'}. Be more conscious.`,
          `${adults} ${adults === 1 ? 'adult' : 'adults'} could stay hydrated with your extra water consumption.`
        ],
        dogs: [
          `That's enough for ${dogs} ${dogs === 1 ? 'dog' : 'dogs'}. Be mindful of your AI usage.`,
          `Your excess usage could hydrate ${dogs} ${dogs === 1 ? 'dog' : 'dogs'} for a day. Consider reducing queries.`,
          `${dogs} ${dogs === 1 ? 'dog' : 'dogs'} could thrive on the water you're using above average.`
        ],
        default: [
          `You're using more than your average. Consider reducing your AI queries to help conserve water.`,
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
      
      messageElement.textContent = message;
    } else {
      // get unit from storage for accurate formatting
      const unitData = await chrome.storage.local.get(['waterUnit']);
      const unitToUse = unitData.waterUnit || currentUnit || 'ml';
      const formatted = await formatWaterUsage(dailyUsage, unitToUse);
      messageElement.textContent = `Query tracked! Total: ${formatted}`;
    }
    
    const bottleContainer = document.querySelector('.water-bottle-container');
    if (bottleContainer) {
      messageElement.style.bottom = `${bottleContainer.offsetHeight + 30}px`;
      messageElement.style.left = '20px';
    }
    
    // ensure body exists and append message
    if (document.body) {
      document.body.appendChild(messageElement);
      console.log('💧 Waterer: Message displayed', messageElement.textContent.substring(0, 50) + '...');
    } else {
      console.warn('💧 Waterer: document.body not available, cannot show message');
    }
    
    // remove after 10 seconds
    setTimeout(() => {
      if (messageElement) {
        messageElement.remove();
        messageElement = null;
      }
    }, 10000); // increased to 10 seconds
  }
  
  // save positions
  function savePositions() {
    try {
      // check if extension context is still valid
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return; // extension context invalidated
      }
      
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
      
      chrome.storage.local.set({ uiPositions: positions }).catch(() => {
        // ignore errors if extension context is invalid
      });
    } catch (error) {
      // extension context invalidated - ignore silently
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('Waterer: Error saving positions', error);
      }
    }
  }
  
  // load positions
  async function loadPositions() {
    try {
      // check if extension context is still valid
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return; // extension context invalidated
      }
      
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
    } catch (error) {
      // extension context invalidated - ignore silently
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('Waterer: Error loading positions', error);
      }
    }
  }
  
  // listen for messages (for future enhancements)
  try {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      if (message.type === 'resetData') {
        // set resetting flag to prevent periodic updates
        await chrome.storage.local.set({ isResetting: true });
        
        // clear all storage
        await chrome.storage.local.clear();
        
        // reset UI immediately (now async)
        await resetUIToZero();
        
        // set surveyCompleted to false and clear resetting flag
        await chrome.storage.local.set({
          surveyCompleted: false,
          isResetting: false,
          waterUnit: 'ml' // reset to default unit
        });
        
        sendResponse({ success: true });
        return true;
      }
      // other message handling can be added here if needed
      return false;
    });
  } catch (error) {
    // extension context might be invalidated
    if (!error.message?.includes('Extension context invalidated')) {
      console.warn('Waterer: Error setting up message listener', error);
    }
  }
  
  // expose manual test function for debugging
  window.watererTest = function() {
    console.log('💧 Waterer: Manual test triggered');
    trackQuery('chatgpt', 50);
  };
  
  // also expose a function to check current state
  window.watererStatus = async function() {
    const data = await chrome.storage.local.get(['dailyUsage', 'queries', 'userData']);
    console.log('💧 Waterer Status:', {
      dailyUsage: data.dailyUsage,
      queriesCount: data.queries?.length || 0,
      queries: data.queries,
      averageUsage: data.userData?.averageUsage
    });
    return data;
  };
  
  // expose function to manually trigger detection setup
  window.watererSetupDetection = function() {
    console.log('💧 Waterer: Manually triggering detection setup');
    if (window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com')) {
      setupChatGPTDetection();
    } else {
      observeChatInterface();
    }
  };
  
  // expose function to find and log all textareas
  window.watererFindTextareas = function() {
    const textareas = document.querySelectorAll('textarea');
    console.log('💧 Waterer: Found', textareas.length, 'textareas:');
    textareas.forEach((ta, i) => {
      console.log(`  Textarea ${i}:`, {
        id: ta.id,
        className: ta.className,
        placeholder: ta.placeholder,
        value: ta.value?.substring(0, 50),
        visible: ta.offsetParent !== null,
        element: ta
      });
    });
    return Array.from(textareas);
  };
  
  // expose function to simulate a fake send (for testing)
  window.watererFakeSend = async function() {
    console.log('💧 Waterer: Simulating fake send');
    try {
      await fetch('https://chatgpt.com/backend-api/conversation', { method: 'POST', body: '{}' });
    } catch (error) {
      console.log('💧 Waterer: Fake send failed (expected)', error);
      // trigger manually anyway for testing
      safeTrackQuery('chatgpt');
    }
  };
  
  // initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // also log that script loaded
  console.log('💧 Waterer: Content script loaded on', window.location.hostname);
  
  // centralized function to reset UI to zero
  async function resetUIToZero() {
    // reset local variables first
    queryCount = 0;
    totalWaterUsage = 0;
    
    if (squareElement) {
      // hide square
      squareElement.style.display = 'none';
      
      // reset query count
      const countEl = squareElement.querySelector('.query-count');
      if (countEl) {
        countEl.innerHTML = '0 <span class="suffix">queries</span>';
      }
      
      // reset water usage - format with current unit
      const usageEl = squareElement.querySelector('.water-usage');
      if (usageEl) {
        const unitData = await chrome.storage.local.get(['waterUnit']);
        const unitToUse = unitData.waterUnit || currentUnit || 'ml';
        const formatted = await formatWaterUsage(0, unitToUse);
        const parts = formatted.split(' ');
        const numberPart = parts[0];
        const unitLabel = parts[1] || getUnitLabel(unitToUse);
        
        // clear existing content
        usageEl.innerHTML = '';
        const suffix = document.createElement('span');
        suffix.className = 'suffix';
        suffix.textContent = ` ${unitLabel}`;
        usageEl.innerHTML = `${numberPart}`;
        usageEl.appendChild(suffix);
        
        // remove ml-value if it exists
        const mlValue = usageEl.querySelector('.ml-value');
        if (mlValue) mlValue.remove();
      }
    }
    
    if (bottleElement) {
      const container = document.querySelector('.water-bottle-container');
      if (container) {
        container.style.display = 'none';
        // reset bottle fill
        const waterFill = bottleElement.querySelector('.water-fill');
        if (waterFill) {
          waterFill.style.height = '0%';
        }
        // reset bottle label
        const label = bottleElement.querySelector('.bottle-label');
        if (label) {
          const unitData = await chrome.storage.local.get(['waterUnit']);
          const unitToUse = unitData.waterUnit || currentUnit || 'ml';
          const formatted = await formatWaterUsage(0, unitToUse);
          label.textContent = formatted;
        }
      }
    }
  }
  
  // update display periodically and ensure UI elements exist
  setInterval(async () => {
    try {
      const data = await chrome.storage.local.get(['dailyUsage', 'queries', 'surveyCompleted', 'isResetting']);
      
      // ⛔ Never update during reset
      if (data.isResetting) {
        return;
      }
      
      // ⛔ Never update if survey not completed - reset UI and return
      if (!data.surveyCompleted) {
        await resetUIToZero();
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
      
      // ensure square is visible if survey is completed
      if (squareElement) {
        squareElement.style.display = '';
      }
      if (bottleContainer) {
        bottleContainer.style.display = '';
      }
      
      queryCount = data.queries?.length || 0;
      totalWaterUsage = data.dailyUsage || 0;
      await updateSquareDisplay();
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

