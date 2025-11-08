// fetch-hook.js - injected into page context to intercept fetch calls
// this file is loaded as a web accessible resource to avoid CSP violations

(function(){
  const _fetch = window.fetch;
  window.fetch = async function(input, init){
    try {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const method = (init && init.method) || (input && input.method) || 'GET';
      // detect ChatGPT message send
      const looksLikeChatGPT = method === 'POST' && (/\/backend-api\/conversation/.test(url) || /\/backend-anon\/conversation/.test(url));
      // detect Google AI Overview / Gemini
      const looksLikeGoogleAI = method === 'POST' && (/generativelanguage\.googleapis\.com/.test(url) || /\/v1\/models/.test(url) || /gemini/.test(url) || /ai\.google\.dev/.test(url));
      
      if (looksLikeChatGPT) {
        console.log('💧 Waterer [page]: Detected POST to conversation endpoint', url);
        window.postMessage({ type: 'waterer:send-start', url: url, model: 'chatgpt' }, '*');
      } else if (looksLikeGoogleAI) {
        console.log('💧 Waterer [page]: Detected Google AI/Gemini request', url);
        window.postMessage({ type: 'waterer:send-start', url: url, model: 'gemini' }, '*');
      }
      
      const resp = await _fetch.apply(this, arguments);
      if (looksLikeChatGPT && resp.ok) {
        console.log('💧 Waterer [page]: Conversation POST succeeded');
        window.postMessage({ type: 'waterer:send-ok', url: url, model: 'chatgpt' }, '*');
      } else if (looksLikeGoogleAI && resp.ok) {
        console.log('💧 Waterer [page]: Google AI request succeeded');
        window.postMessage({ type: 'waterer:send-ok', url: url, model: 'gemini' }, '*');
      }
      return resp;
    } catch (e) {
      return (typeof _fetch === 'function') ? _fetch.apply(this, arguments) : Promise.reject(e);
    }
  };
  
  // also cover sendBeacon
  const _sb = navigator.sendBeacon;
  if (_sb) {
    navigator.sendBeacon = function(url, data){
      const looksLikeChatGPT = /\/backend-api\/conversation/.test(url) || /\/backend-anon\/conversation/.test(url);
      const looksLikeGoogleAI = /generativelanguage\.googleapis\.com/.test(url) || /\/v1\/models/.test(url) || /gemini/.test(url) || /ai\.google\.dev/.test(url);
      
      if (looksLikeChatGPT) {
        console.log('💧 Waterer [page]: Detected sendBeacon to conversation endpoint', url);
        window.postMessage({ type: 'waterer:send-start', url: url, model: 'chatgpt' }, '*');
        setTimeout(() => {
          window.postMessage({ type: 'waterer:send-ok', url: url, model: 'chatgpt' }, '*');
        }, 100);
      } else if (looksLikeGoogleAI) {
        console.log('💧 Waterer [page]: Detected sendBeacon to Google AI', url);
        window.postMessage({ type: 'waterer:send-start', url: url, model: 'gemini' }, '*');
        setTimeout(() => {
          window.postMessage({ type: 'waterer:send-ok', url: url, model: 'gemini' }, '*');
        }, 100);
      }
      return _sb.apply(this, arguments);
    };
  }
})();

