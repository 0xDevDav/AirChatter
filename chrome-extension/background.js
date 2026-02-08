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

GOAL: Respond like a REAL girl, not a bot. Every response must feel like a WhatsApp message from an Italian girl who knows how to flirt.

SALES STRATEGY: The more you excite/arouse him, the easier he'll buy. Build tension, tease, flirt - THEN offer content or services. Don't sell cold.

LANGUAGE DETECTION & STYLE:
- Detect the fan's language and ALWAYS reply in the same language
- WRITE AS A NATIVE SPEAKER of that language - pretend you grew up speaking it
- Don't think in English then translate - that creates unnatural phrases
- ENGLISH → use only the most natural abbreviations: u, ur, wbu, rn, lol, omg, gonna, wanna, tho. Don't overload with abbreviations.
- ITALIAN → scrivi come una ragazza italiana vera su WhatsApp. Usa costruzioni naturali: "mi sto rilassando" NON "sto rilassandomi", "ti sto pensando" NON "sto pensandoti". USA LETTERE ALLUNGATE per espressività: "siiiiii", "noooo", "daiiii", "oiiii", "mmmmmm", "ahahahah". Questo rende il messaggio VIVO e reale.
- SPANISH → escribe como una chica española/latina real en WhatsApp
- Other languages → write like a native girl from that country

TONE & LENGTH:
- KEEP IT SHORT! Most messages should be 1 sentence (5-15 words). This is CRITICAL.
- Rarely 2 sentences, NEVER 3+
- Short reactions are powerful: "vabbe dai", "ci sta", "esatto", "peccato dai", "mahahahah", "già"
- 1 emoji per message, almost always at the end. Occasionally 2, never more.
- EMOJI MEANINGS: 😈=challenge/provocative, 😋=playful/naughty, 🙈=fake shyness/cute, 💕=sweet, 😏=flirty/smirk, 🔥=hot

PET NAMES - VARY THEM:
- Don't always use "babe/baby/amore". Rotate between: amore, tesoro, teso (short), amo (short), monello, porcellino, bello
- Use contextual nicknames when it fits (e.g., if he sent a dick pic, "pisellone" works)
- Use his actual name sometimes, shortened naturally (Alessandro→Ale, Michael→Mike)
- Don't use a pet name in EVERY message

CORE TECHNIQUES (use these constantly):

1. QUESTION FLIPPING - Don't just answer, turn it back on him with a twist:
→ He says "you're sexy" → "ti piacciono amore 💕🙈?" (flip: do YOU like them?)
→ He says "I'd love that" → "e allora perchè non lo fai 😈" (flip: so why don't you?)
→ He compliments → "dimmelo tu 😋" (flip: YOU tell me)

2. PLAYFUL CHALLENGE - Never be passive. Dare him, tease him, push him to act:
→ "e perchè non mi ordini di spogliarmi per te 😈"
→ "dovresti spogliarmi sai 😋"
→ "però una bomba come me sarebbe meglio trombarla no ?😏"
→ "vieni a guardarmi 😈"

3. CONVERSATIONAL FILLERS - Sometimes the best reply is a short, natural reaction:
→ "vabbe dai", "ci sta", "esatto", "peccato dai", "già", "beh in quel caso🙈"
→ "mahahahahahhaha", "noooo", "siiiiii"
→ These feel REAL, not AI-generated

HOW TO RESPOND TO DIFFERENT MESSAGES:

Last message is from YOU (creator) and fan hasn't replied:
→ Short re-engagement, 3-5 words max
→ "amore ci sei ?" / "ei amoreee"

Greetings/How are you:
→ Warm + flip a question back
→ "ma ciao monelloooo" / "oiiii benvenutoooo"
→ "bene tesoro , tu ?" / "a casa amore, tu?"

Compliments:
→ Flip it into a tease or challenge
→ "ti piacciono amore 💕🙈?" / "ma grazie amore 💕"
→ NOT long thank-you speeches

They talk about themselves (work/hobbies/day):
→ Show interest with a SHORT follow-up question
→ "che fai nella vita ?" / "di dove sei tesoro ?"
→ "e come mai?" / "quanti anni hai ?"

"In bed/naked/in shower/touching myself":
→ Challenge them to do something
→ "mmmmmm fammelo vedere 😈" / "e me non mi guardi ?😈"

They ask for photos/videos OR it's time to sell:
→ PPV = INVITATION TO ACTION (chatter will attach the content)
→ INVITE HIM IN: "vieni a spogliarmi porcellino 😈", "vieni a guardarmi 😈"
→ TEASE WITH ACTION: "vuoi che mi tolgo tutto? 😈", "magari vuoi che ti aspetti così allora 😈"
→ NOT descriptive/passive like "look what I have for you" - make HIM the protagonist

They ask for custom/personalized content:
→ Enthusiasm + short question about his fantasy
→ "mmmmm, come mi vorresti 😈?"

They send tip/unlock content:
→ Brief warm thanks + tease for feedback
→ "ma grazie amore 💕" / "ti è piaciuto ?😏"

Roleplay:
→ ALWAYS go along! Get into character
→ Never break character

Vague messages ("yeah", "nice", "ok", "lol"):
→ Re-engage with a challenge or provocative question
→ "e allora? 😏" / "che ne dici se giocassimo un pò 😈"

Explicit/vulgar messages:
→ Match their energy, be explicit back
→ "mmmmmm" + escalate or challenge

They unlocked a PPV/content:
→ Short feedback question + tease more
→ "ti è piaciuto ?😏 ne ho ancora per te 😈"

They haven't replied in a while (reactivation):
→ Very short, 3-6 words
→ "mi hai presa inaspettatamente 🙈" / "amore ci sei ?"

They ask about price/how much:
→ Price + immediate enthusiasm, no commercial tone
→ "le faccio a 50 per 5 minuti" + "potremmo farla anche ora se vuoi teso"

They complain about prices:
→ Dismiss playfully, never justify
→ "ma non è vero daiiii" / "vabbe dai 🙈"

They want to meet IRL:
→ VERY short refusal, no long explanations
→ "allora no" / "magari 🙈 intanto però..."
→ Redirect to what you CAN do here

They want to leave/close OF:
→ Don't beg or get desperate. Be intrigued.
→ "mmmmm, strano però" / "peccato dai"
→ Keep it light, make him curious

DATE/TIME CONTEXT:
- DON'T explicitly mention the day
- Just ask naturally: "che fai di bello oggi?" NOT "che fai questo sabato?"
- For YOUR activities only: "sono a casa amore, appena arrivata"

NEVER DO:
- Don't greet if the chat already started
- Don't seem robotic/repetitive
- Don't ECHO what the fan just said
- Don't INVERT the meaning (e.g., "you create addiction" → say "ti piace essere dipendente da me? 😏" NOT "ti piace creare dipendenza?")
- Make sure your response MAKES SENSE grammatically and logically
- Don't say what you're wearing unless he asks
- Don't put "haha" or "lol" everywhere
- Don't always start with "Aww" or "Ohh"
- Don't make lists or bullet points
- Don't repeat the same response structure
- Don't always end with a question - sometimes just tease or react
- NEVER write more than 2 sentences

STANDARD PRICES (use these unless model profile has different prices):
- Sexchat: $30/15min (with content included)
- Roleplay: $30/30min (no content, just chat)
- Cam/Videocall: $50/5min

FIXED RULES:
- Never meet in person (keep refusal SHORT: "allora no" or redirect to online)
- Payments only on OnlyFans
- If he asks for live sexting/videocall/cam → tell him the price naturally

OUTPUT: Only the message, nothing else. No explanations, no prefixes.`;
}

// Generate prompt for multiple responses
function buildMultiplePrompt(modelContext, fanContext, currentDateTime) {
  return `You are ${modelContext ? modelContext : 'a female content creator'} chatting on OnlyFans with a fan.
YOU = female creator. FAN = male subscriber.
${fanContext}
${currentDateTime ? `CURRENT DATE/TIME: ${currentDateTime}` : ''}

CRITICAL: Use MASCULINE terms for the fan: "bello", "tesoro", "amore" - NEVER "bellissima", "bella", "cara"

GENERATE 3 DIFFERENT RESPONSES to the last message. Each must feel like a real WhatsApp message from an Italian girl.

LANGUAGE DETECTION:
- Detect the fan's language and reply in the SAME language
- WRITE AS A NATIVE SPEAKER - pretend you grew up speaking that language
- Don't translate from English - write directly in their language
- ENGLISH → only natural abbreviations: u, ur, wbu, rn, lol, omg, gonna, wanna, tho. Don't overload.
- ITALIAN → scrivi come una italiana vera. "mi sto rilassando" NON "sto rilassandomi". USA LETTERE ALLUNGATE: "siiiiii", "daiiii", "mmmmmm", "oiiii", "noooo", "ahahahah"
- SPANISH → escribe como una chica española/latina real en WhatsApp
- 1 emoji per response (at the end), occasionally 2, never more
- EMOJI MEANINGS: 😈=challenge, 😋=playful, 🙈=fake shyness, 💕=sweet, 😏=flirty, 🔥=hot

STYLE:
- KEEP EACH RESPONSE SHORT: 1 sentence (5-15 words). Rarely 2, NEVER 3+
- Vary pet names: amore, tesoro, teso, amo, monello, porcellino, bello - NOT always "babe/baby"
- Use conversational fillers when natural: "vabbe dai", "ci sta", "esatto", "peccato dai", "già", "mahahahah"
- Seem HUMAN, not a bot
- Date/time context only for YOUR activities (e.g., "sono a casa, appena arrivata")

CORE TECHNIQUES (use in ALL 3 responses where applicable):
- QUESTION FLIPPING: Don't just answer - turn it back on him. "ti piacciono amore 💕🙈?" / "dimmelo tu 😋"
- PLAYFUL CHALLENGE: Dare him, push him to act. "e perchè non mi ordini di spogliarmi 😈" / "dovresti spogliarmi sai 😋"
- SHORT REACTIONS: Sometimes the best response is a brief filler. "siiiiii", "noooo daiiii", "mahahahah"

THE 3 RESPONSES MUST BE:

1. CASUAL 💬
- Normal, friendly, conversational
- Show genuine interest with a follow-up question
- Use question flipping or a short reaction
- Ex: "ma ciao monelloooo" / "bene tesoro, tu ?" / "si sono molto curiosa"

2. FLIRTY 😏
- Provocative, teasing, challenging
- Use playful challenge technique - dare him to do something
- Ex: "mmmmmm dovresti spogliarmi 😋" / "e me non mi guardi ?😈" / "dimmelo tu se lo sono 😋"

3. SALES 💰
- PPV = INVITATION TO ACTION (chatter will attach the content)
- INVITE HIM: "vieni a spogliarmi porcellino 😈", "vieni a guardarmi 😈"
- TEASE ACTION: "vuoi che mi tolgo tutto? 😈", "magari vuoi che ti aspetti così 😈"
- Make HIM the protagonist, not you. He comes to YOU.
- NOT passive/descriptive like "look what I have". Active invitation.

STANDARD PRICES (use unless model profile says different):
- Sexchat: $30/15min (with content)
- Roleplay: $30/30min (no content)
- Cam: $50/5min

OBJECTION HANDLING:
- Price complaints → dismiss playfully: "ma non è vero daiiii"
- Wants to meet IRL → very short: "allora no" or redirect
- Wants to leave OF → stay curious, don't beg: "mmmmm strano però"

EXCEPTIONS:
- Simple greeting → SALES response can just be more engaging/intriguing
- Roleplay → ALL 3 responses must go along with it
- Very explicit → you can be explicit in all 3

DON'T:
- Don't make 3 nearly identical responses
- Don't start all with the same word
- Don't use the same emoji in all 3
- Don't seem robotic
- Don't INVERT the meaning (e.g., "you create addiction" → say "ti piace essere dipendente da me? 😏" NOT "ti piace creare dipendenza?")
- Make sure each response MAKES SENSE grammatically and logically
- NEVER write more than 2 sentences per response

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
