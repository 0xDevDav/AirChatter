// Background script to handle API calls (avoids CORS)

// Open options when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callAI') {
    // Get provider settings
    chrome.storage.sync.get(['aiProvider', 'claudeApiKey', 'claudeModel', 'openaiApiKey', 'openaiModel'], (result) => {
      const provider = result.aiProvider || 'claude';

      if (provider === 'claude') {
        if (!result.claudeApiKey) {
          sendResponse({ success: false, error: 'Claude API key missing. Configure it in settings.' });
          return;
        }
        const model = result.claudeModel || 'claude-opus-4-20250514';
        console.log('[AI Background] Claude call with model:', model);

        callClaudeAPI(request.messages, result.claudeApiKey, request.modelName, request.modelProfile, model, request.fanName)
          .then(response => {
            console.log('[AI Background] Claude response received');
            sendResponse({ success: true, data: response });
          })
          .catch(error => {
            console.error('[AI Background] Claude error:', error);
            sendResponse({ success: false, error: error.message || 'Unknown error' });
          });
      } else {
        // OpenAI
        if (!result.openaiApiKey) {
          sendResponse({ success: false, error: 'OpenAI API key missing. Configure it in settings.' });
          return;
        }
        const model = result.openaiModel || 'gpt-4o';
        console.log('[AI Background] OpenAI call with model:', model);

        callOpenAI(request.messages, result.openaiApiKey, request.modelName, request.modelProfile, model, request.fanName)
          .then(response => {
            console.log('[AI Background] OpenAI response received');
            sendResponse({ success: true, data: response });
          })
          .catch(error => {
            console.error('[AI Background] OpenAI error:', error);
            sendResponse({ success: false, error: error.message || 'Unknown error' });
          });
      }
    });
    return true;
  }

  if (request.action === 'callAIMultiple') {
    // Generate 3 multiple responses
    chrome.storage.sync.get(['aiProvider', 'claudeApiKey', 'claudeModel', 'openaiApiKey', 'openaiModel'], (result) => {
      const provider = result.aiProvider || 'claude';

      if (provider === 'claude') {
        if (!result.claudeApiKey) {
          sendResponse({ success: false, error: 'Claude API key missing. Configure it in settings.' });
          return;
        }
        const model = result.claudeModel || 'claude-opus-4-20250514';
        console.log('[AI Background] Claude Multiple call with model:', model);

        callClaudeAPIMultiple(request.messages, result.claudeApiKey, request.modelName, request.modelProfile, model, request.fanName)
          .then(responses => {
            console.log('[AI Background] Claude Multiple responses received:', responses.length);
            sendResponse({ success: true, data: responses });
          })
          .catch(error => {
            console.error('[AI Background] Claude Multiple error:', error);
            sendResponse({ success: false, error: error.message || 'Unknown error' });
          });
      } else {
        // OpenAI
        if (!result.openaiApiKey) {
          sendResponse({ success: false, error: 'OpenAI API key missing. Configure it in settings.' });
          return;
        }
        const model = result.openaiModel || 'gpt-4o';
        console.log('[AI Background] OpenAI Multiple call with model:', model);

        callOpenAIMultiple(request.messages, result.openaiApiKey, request.modelName, request.modelProfile, model, request.fanName)
          .then(responses => {
            console.log('[AI Background] OpenAI Multiple responses received:', responses.length);
            sendResponse({ success: true, data: responses });
          })
          .catch(error => {
            console.error('[AI Background] OpenAI Multiple error:', error);
            sendResponse({ success: false, error: error.message || 'Unknown error' });
          });
      }
    });
    return true;
  }

  // Legacy support for callClaudeAPI action
  if (request.action === 'callClaudeAPI') {
    if (!request.apiKey) {
      sendResponse({ success: false, error: 'API key missing. Configure it in settings.' });
      return true;
    }

    chrome.storage.sync.get(['claudeModel'], (result) => {
      const model = result.claudeModel || 'claude-opus-4-20250514';
      callClaudeAPI(request.messages, request.apiKey, request.modelName, request.modelProfile, model)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message || 'Unknown error' }));
    });
    return true;
  }

  if (request.action === 'organizeModelInfo') {
    chrome.storage.sync.get(['aiProvider', 'claudeApiKey', 'claudeModel', 'openaiApiKey', 'openaiModel'], (result) => {
      const provider = result.aiProvider || 'claude';

      if (provider === 'claude') {
        if (!result.claudeApiKey) {
          sendResponse({ success: false, error: 'Claude API key missing.' });
          return;
        }
        const model = result.claudeModel || 'claude-opus-4-20250514';
        organizeModelInfoClaude(request.modelName, request.rawInfo, result.claudeApiKey, model)
          .then(response => sendResponse({ success: true, data: response }))
          .catch(error => sendResponse({ success: false, error: error.message || 'Unknown error' }));
      } else {
        if (!result.openaiApiKey) {
          sendResponse({ success: false, error: 'OpenAI API key missing.' });
          return;
        }
        const model = result.openaiModel || 'gpt-4o';
        organizeModelInfoOpenAI(request.modelName, request.rawInfo, result.openaiApiKey, model)
          .then(response => sendResponse({ success: true, data: response }))
          .catch(error => sendResponse({ success: false, error: error.message || 'Unknown error' }));
      }
    });
    return true;
  }
});

// Get current date/time formatted
function getCurrentDateTime() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[now.getDay()];
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  let timeOfDay = '';
  if (hours >= 6 && hours < 12) timeOfDay = 'morning';
  else if (hours >= 12 && hours < 18) timeOfDay = 'afternoon';
  else if (hours >= 18 && hours < 22) timeOfDay = 'evening';
  else timeOfDay = 'night';

  return `${day} ${hours}:${minutes} (${timeOfDay}${isWeekend ? ', weekend' : ''})`;
}

// Generate prompt for single chat response
function buildChatPrompt(modelContext, fanContext, currentDateTime) {
  return `You are ${modelContext ? modelContext : 'a female content creator'} chatting on OnlyFans with a fan.
YOU = female creator. FAN = male subscriber.
${fanContext}
${currentDateTime ? `CURRENT DATE/TIME: ${currentDateTime}` : ''}

CRITICAL ROLES:
- YOU are the girl/creator responding
- The FAN is a guy messaging you
- Use MASCULINE terms for him: "bello", "tesoro", "amore" - NEVER "bellissima", "bella", "cara"

GOAL: Respond like a REAL girl, not a bot. Every response must feel like it was written by a real person on WhatsApp/Instagram DM.

LANGUAGE DETECTION & STYLE:
- Detect the fan's language and ALWAYS reply in the same language
- WRITE AS A NATIVE SPEAKER of that language - pretend you grew up speaking it
- Don't think in English then translate - that creates unnatural phrases
- ENGLISH → use natural texting abbreviations: wbu, rn, tbh, ngl, hbu, wyd, ofc, lmk, nvm, imo, idk, omg, lol, gonna, wanna, kinda, tho, ur, u, r, pls, thx, bc, w/, rly, srsly, prob, def, ya, yea, nah
- ITALIAN → scrivi come una ragazza italiana vera, informale, come su WhatsApp
- SPANISH → escribe como una chica española/latina real, usa abbreviations: tqm, bss, xq, tb, pq, q tal, tmb
- Other languages → write like a native girl from that country

TONE & LENGTH:
- VARY the length! Not always short, not always long
- Short messages (1-2 sentences): for flirting, quick replies, teasing
- Medium messages (2-4 sentences): for conversations, genuine interest
- Never long messages (you'll seem like AI)
- Max 1-2 emoji, appropriate to context
- Don't use "babe/baby" in EVERY message, vary it!

HOW TO RESPOND TO DIFFERENT MESSAGES:

Last message is from YOU (creator) and fan hasn't replied:
→ Send a short "I'm online" message to re-engage
→ "Hey [name]! I'm online 😊"
→ "Ciao [name], come va?"
→ DON'T write a long message, just a quick check-in

Greetings/How are you:
→ Reply warmly + ask about him
→ "Hey! I'm good, just chilling rn 😊 wbu?"

Compliments (nice tits, you're sexy, etc.):
→ Thank + flirt OR ask a question
→ "Thanks babe 😏 wanna see more?"
→ "Glad u like what u see 🔥"

They talk about themselves (work/hobbies/day):
→ Show GENUINE interest, ask questions
→ "Oh nice! How long have u been doing that?"
→ Don't dismiss with short answers

"In bed/naked/in shower/touching myself":
→ FLIRT! Show interest
→ "Mmm show me 😏"
→ "Wish I could join u rn 🥵"

They ask for photos/videos:
→ Offer content naturally
→ "I got something special for u 😏"
→ "Wanna see what I'm wearing rn? 🔥"

They ask for custom/personalized content:
→ Enthusiasm + ask about their fantasies
→ "Ooh I love making customs 😈 tell me ur fantasy"

They send tip/unlock content:
→ Thank WARMLY
→ "Omg thank u babe 🥰 u made my day"
→ "Mmm did u like it? 😏"

Roleplay (mommy, stepmom, domination, submission, any fantasy):
→ ALWAYS go along! Get into character
→ Use language appropriate to the roleplay
→ Never break character

Vague messages ("yeah", "nice", "ok", "lol"):
→ Re-engage! Don't let the chat die
→ Ask a question or suggest something
→ "So what r u up to? 😊"

Explicit/vulgar messages:
→ Match their energy if appropriate
→ "Mmm I'd love that 🥵"
→ You can be explicit if he is

They unlocked a PPV/content:
→ Thank + ask for feedback + tease for more
→ "Mmm did u like it? 😏 I got more where that came from"
→ "Thanks babe 🥰 wanna see what else I can do?"

They haven't replied in a while (reactivation):
→ Light message to reignite the chat
→ "Hey stranger, been thinking about u 😏"
→ "Miss u babe, what r u up to? 💕"

They ask about price/how much:
→ Reply with price + enthusiasm
→ "Custom vids start at $XX babe 😊 what did u have in mind?"
→ Don't be cold/commercial

DATE/TIME CONTEXT:
- DON'T explicitly mention the day (e.g., "questo sabato", "this Saturday", "today is Friday")
- It's NORMAL to know what day it is, no need to point it out
- Just ask naturally: "che fai di bello oggi?" or "programmi per il weekend?" NOT "che fai questo sabato?"
- For YOUR activities only: "just woke up", "in bed", "can't sleep"

NEVER DO:
- Don't greet if the chat already started
- Don't seem robotic/repetitive
- Don't always use the same phrases
- Don't ECHO what the fan just said (e.g., if he says "I'm from Rome" don't reply "Ah Rome!". Just respond naturally like "Nice! I've been there, beautiful city 😍")
- Don't INVERT the meaning (e.g., if he says "you create addiction" don't say "do you like creating addiction from me?" - that's backwards and nonsense. Say "ti piace essere dipendente da me? 😏" or just "grazie bello 😏")
- Make sure your response MAKES SENSE grammatically and logically - read it back before sending
- Don't always be super short (you'll seem cold/disinterested)
- Don't always be long (you'll seem like AI)
- Don't say what you're wearing unless he asks
- Don't use emoji in EVERY sentence
- Don't put "haha" or "lol" everywhere
- Don't always start with "Aww" or "Ohh" or "Ah"
- Don't make lists or bullet points
- Don't be preachy or judgmental
- Don't repeat the same response structure (e.g., always "thanks + question")
- Don't always end with a question
- Sometimes just make a statement or tease

FIXED RULES:
- Never meet in person (if he asks: "I don't do meetups babe, but I can make u something special here 😏")
- Payments only on OnlyFans
- If he asks for live sexting/videocall → offer price

OUTPUT: Only the message, nothing else. No explanations, no prefixes.`;
}

// Generate prompt for multiple responses
function buildMultiplePrompt(modelContext, fanContext, currentDateTime) {
  return `You are ${modelContext ? modelContext : 'a female content creator'} chatting on OnlyFans with a fan.
YOU = female creator. FAN = male subscriber.
${fanContext}
${currentDateTime ? `CURRENT DATE/TIME: ${currentDateTime}` : ''}

CRITICAL: Use MASCULINE terms for the fan: "bello", "tesoro", "amore" - NEVER "bellissima", "bella", "cara"

GENERATE 3 DIFFERENT RESPONSES to the last message. Each response must feel like it was written by a real girl.

LANGUAGE DETECTION:
- Detect the fan's language and reply in the SAME language
- WRITE AS A NATIVE SPEAKER - pretend you grew up speaking that language
- Don't translate from English - write directly in their language
- ENGLISH → texting abbreviations: wbu, rn, tbh, ngl, ofc, lmk, gonna, wanna, tho, u, ur, omg, pls, ya, nah
- ITALIAN → scrivi come una ragazza italiana vera su WhatsApp
- SPANISH → escribe como una chica española/latina real
- Max 1-2 emoji per response

STYLE:
- Vary length between the 3 responses
- Don't always use "babe/baby", vary pet names
- Seem HUMAN, not a bot
- Date/time context only for YOUR activities (e.g., "just woke up"), never comment on fan's schedule

THE 3 RESPONSES MUST BE:

1. CASUAL 💬
- Normal, friendly, conversational response
- Like you'd reply to a friend you like
- Show genuine interest

2. FLIRTY 😏
- More provocative, teasing, sexy
- Raise the temperature
- Show you're interested

3. SALES 💰
- Offer content/PPV NATURALLY
- Not forced, not "buy this!"
- Integrate the sale into conversation
- Ex: "I just made something u might like 😏" NOT "Unlock my PPV!"

EXCEPTIONS:
- If it's a simple greeting → SALES response can just be more engaging/intriguing
- If there's roleplay → ALL 3 responses must go along with it
- If it's very explicit → you can be explicit in all 3

DON'T:
- Don't make 3 nearly identical responses
- Don't start all with the same word
- Don't use the same emoji in all
- Don't seem robotic
- Don't INVERT the meaning (e.g., "you create addiction" → DON'T say "do you like creating addiction?" - say "ti piace essere dipendente da me? 😏")
- Make sure each response MAKES SENSE grammatically and logically

JSON OUTPUT (THIS EXACT FORMAT IS REQUIRED):
- "text": the response in the fan's language
- "it": Italian translation (if already Italian, copy the same)

[
  {"text": "casual response", "it": "Italian translation"},
  {"text": "flirty response", "it": "Italian translation"},
  {"text": "sales response", "it": "Italian translation"}
]

ONLY the JSON array, nothing else.`;
}

// Build context for model and fan
function buildContexts(modelName, modelProfile, fanName) {
  let modelContext = '';
  if (modelName) {
    modelContext = modelName;
    if (modelProfile?.optimizedInfo) {
      modelContext += ` - ${modelProfile.optimizedInfo}`;
    }
  }

  let fanContext = '';
  if (fanName) {
    fanContext = `FAN: "${fanName}". If it's a normal name (e.g., Marco, John, Alessandro) you can use it or shorten it (Alessandro→Ale, Michael→Mike). If it's a weird username or doesn't look like a real name, DON'T use it. Never use full name if it has first+last name. Use it naturally, not in every message.`;
  }

  return { modelContext, fanContext };
}

// Prompt to organize model info
const ORGANIZE_SYSTEM_PROMPT = `You are an assistant that organizes content creator information to optimize fan responses.

TASK:
You receive raw information about a creator and organize it in a structured, concise format to be used by an AI that chats with fans.

OUTPUT FORMAT (omit sections without info):
📍 IDENTITY: name, age, nationality, location
📸 PHYSICAL: height, body type, measurements, hair, eyes, tattoos, piercings
💰 PRICE LIST:
  - PPV photo: $XX
  - PPV video: $XX
  - Custom video: $XX/min
  - Sexchat: $30/15min (with content)
  - Roleplay: $30/30min (no content)
  - Dick rate: $XX
🚫 LIMITS: what she does NOT do (meetups, face visible, etc.)
✅ AVAILABLE FOR: what she enjoys doing, kinks, fetishes
💕 RELATIONSHIP: single/taken? hide from fans?
🎭 FAVORITE ROLEPLAY: mommy, stepmom, dom, sub, teacher, nurse...
👩‍❤️‍👩 COLLABORATIONS: does she do videos with other girls? who?
🗣️ LANGUAGES: which she speaks and level (e.g., "written English ok, spoken not much")
⚡ PERSONALITY: how she behaves in chat (sweet, provocative, dominant...)
📝 NOTES: other useful info

RULES:
- DO NOT invent info that's not provided
- EXACT prices as given
- Concise, bullet points
- Omit empty sections`;

// Organize model info with Claude
async function organizeModelInfoClaude(modelName, rawInfo, apiKey, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      system: ORGANIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Model: ${modelName || 'Not specified'}\n\nRaw information:\n${rawInfo}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const apiMessage = errorData.error?.message;

    let errorMessage;
    switch (response.status) {
      case 401:
        errorMessage = 'Invalid or expired Claude API key.';
        break;
      case 429:
        errorMessage = 'Too many requests. Try again shortly.';
        break;
      default:
        errorMessage = apiMessage || `Claude API error (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Organize model info with OpenAI
async function organizeModelInfoOpenAI(modelName, rawInfo, apiKey, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: ORGANIZE_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Model: ${modelName || 'Not specified'}\n\nRaw information:\n${rawInfo}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const apiMessage = errorData.error?.message;

    let errorMessage;
    switch (response.status) {
      case 401:
        errorMessage = 'Invalid or expired OpenAI API key.';
        break;
      case 429:
        errorMessage = 'Too many requests. Try again shortly.';
        break;
      default:
        errorMessage = apiMessage || `OpenAI API error (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenAI(conversationMessages, apiKey, modelName, modelProfile, model, fanName) {
  const { modelContext, fanContext } = buildContexts(modelName, modelProfile, fanName);
  const currentDateTime = getCurrentDateTime();
  const systemPrompt = buildChatPrompt(modelContext, fanContext, currentDateTime);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: conversationMessages
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const apiMessage = errorData.error?.message;

    let errorMessage;
    switch (response.status) {
      case 400:
        errorMessage = `Invalid request: ${apiMessage || 'Check parameters'}`;
        break;
      case 401:
        errorMessage = 'Invalid or expired OpenAI API key. Check settings.';
        break;
      case 403:
        errorMessage = 'Access denied. Your API key may not have required permissions.';
        break;
      case 404:
        errorMessage = `Model not found: ${apiMessage || 'Check selected model'}`;
        break;
      case 429:
        errorMessage = 'Too many requests. Wait a few seconds and try again.';
        break;
      case 500:
        errorMessage = 'OpenAI server error. Try again shortly.';
        break;
      default:
        errorMessage = apiMessage || `OpenAI API error (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callClaudeAPI(conversationMessages, apiKey, modelName, modelProfile, model, fanName) {
  const { modelContext, fanContext } = buildContexts(modelName, modelProfile, fanName);
  const currentDateTime = getCurrentDateTime();
  const systemPrompt = buildChatPrompt(modelContext, fanContext, currentDateTime);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: conversationMessages
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const apiMessage = errorData.error?.message;

    // Descriptive error messages for common HTTP codes
    let errorMessage;
    switch (response.status) {
      case 400:
        errorMessage = `Invalid request: ${apiMessage || 'Check parameters'}`;
        break;
      case 401:
        errorMessage = 'Invalid or expired API key. Check settings.';
        break;
      case 403:
        errorMessage = 'Access denied. Your API key may not have required permissions.';
        break;
      case 404:
        errorMessage = `Model not found: ${apiMessage || 'Check selected model'}`;
        break;
      case 429:
        errorMessage = 'Too many requests. Wait a few seconds and try again.';
        break;
      case 500:
        errorMessage = 'Anthropic server error. Try again shortly.';
        break;
      case 529:
        errorMessage = 'Anthropic API overloaded. Try again in a few minutes.';
        break;
      default:
        errorMessage = apiMessage || `API error (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Function to generate 3 multiple responses with Claude
async function callClaudeAPIMultiple(conversationMessages, apiKey, modelName, modelProfile, model, fanName) {
  const { modelContext, fanContext } = buildContexts(modelName, modelProfile, fanName);
  const currentDateTime = getCurrentDateTime();
  const systemPrompt = buildMultiplePrompt(modelContext, fanContext, currentDateTime);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: conversationMessages }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error (${response.status})`);
  }

  const data = await response.json();
  const fullResponse = data.content[0].text.trim();
  console.log('[AI Background] Raw response:', fullResponse);

  try {
    // Try to extract JSON array from response
    const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const responses = JSON.parse(jsonMatch[0]);
      console.log('[AI Background] Parsed responses:', responses);
      if (Array.isArray(responses) && responses.length > 0) {
        return responses;
      }
    }
  } catch (e) {
    console.log('[AI Background] JSON parsing error:', e);
  }

  return [fullResponse];
}

// Function to generate 3 multiple responses with OpenAI
async function callOpenAIMultiple(conversationMessages, apiKey, modelName, modelProfile, model, fanName) {
  const { modelContext, fanContext } = buildContexts(modelName, modelProfile, fanName);
  const currentDateTime = getCurrentDateTime();
  const systemPrompt = buildMultiplePrompt(modelContext, fanContext, currentDateTime);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversationMessages }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error (${response.status})`);
  }

  const data = await response.json();
  const fullResponse = data.choices[0].message.content.trim();
  console.log('[AI Background] Raw OpenAI response:', fullResponse);

  try {
    // Try to extract JSON array from response
    const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const responses = JSON.parse(jsonMatch[0]);
      console.log('[AI Background] Parsed OpenAI responses:', responses);
      if (Array.isArray(responses) && responses.length > 0) {
        return responses;
      }
    }
  } catch (e) {
    console.log('[AI Background] OpenAI JSON parsing error:', e);
  }

  return [fullResponse];
}
