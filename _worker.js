// The main event listener for incoming requests
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  const userId = url.searchParams.get("userid"); 
  const promptTemplate = await VOCABUILDER_KV.get("PROMPT");
  
  if (!promptTemplate) {
    return new Response(JSON.stringify({
      success: false,
      error: "PROMPT environment variable is not set"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (!userId) {
    return new Response(JSON.stringify({
      success: false,
      error: "Missing required 'userid' query parameter"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Fetch user data from KV store
    const userData = await fetchUserData(event, userId);
      
    if (!userData) {
      return new Response(JSON.stringify({
        success: false,
        error: "User not found"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const customPrompt = generateCustomPrompt(promptTemplate, userData);
    
    const result = await processPrompt(customPrompt); 
    const newWords = extractNewWords(result);
    await updateUserWordsList(event, userId, userData, newWords);
    
    console.log(`result: `, result);
    return new Response(JSON.stringify({
      success: true,
      userId: userId,
      result: result
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
  
  // Fetch user data from KV store
  async function fetchUserData(context, userId) {
    try {
      // Assuming your KV namespace is bound as VOCABUILDER_KV in your environment
      const userData = await VOCABUILDER_KV.get(userId);
      if (userData==null) {
        return null;
      }
      
      return JSON.parse(userData);
    } catch (error) {
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }
  }
  
  // Generate a custom prompt based on user data
  function generateCustomPrompt(promptTemplate, userData) {
    // Ensure age_level is capped at 18
    const cappedAge = Math.min(userData.age_level, 18);
    
    // Map numeric age to educational level
    let ageLevel;
    if (cappedAge <= 10) {
      ageLevel = "elementary school";
    } else if (cappedAge <= 13) {
      ageLevel = "middle school";
    } else if (cappedAge <= 18) {
      ageLevel = "high school";
    } else {
      ageLevel = "adult";
    }
    
    // Format the previous words list as a comma-separated string
    const previousWordsString = userData.previous_words_list.join(", ");
    
    // Replace placeholders in the prompt template
    return promptTemplate
      .replace("{x}", userData.x)
      .replace("{age_level}", ageLevel)
      .replace("{previous_words_list}", previousWordsString);
  }
  
  // Process the prompt (this would call the Perplexity API)
  async function processPrompt(prompt, env) {
    const perplexityAPIKEY = await VOCABUILDER_KV.get("PERPLEXITY_API_KEY")
    const perplexity = new PerplexityAIClient(perplexityAPIKEY);
    const r= await perplexity.generateResponse(prompt);
    return r;
  }
  
  // Extract new words from the API result
  function extractNewWords(result) {
    // This function extracts just the words from the API response
    // Adjust according to the actual structure of your Perplexity API response
    console.log(`response from ai: `, result);
    const content=result.data.choices[0].message.content;
    console.log(`content: `, content);
    const wordlist = content.replace("```json", ).replace("```",);
    const jsonResp = wordlist;
    const jsonWordList = jsonResp.word_list;
    console.log(`word list: `, jsonWordList);
    return jsonWordList;
  }
  
  // Update the user's previous words list
  async function updateUserWordsList(context, userId, userData, newWords) {
    try {
      // Create a copy of the user data
      const updatedUserData = { ...userData };
      
      // Get the current list of previous words
      let previousWords = [...updatedUserData.previous_words_list];
      
      // Determine the word count limit for this user
      const wordCountLimit = updatedUserData.word_count;
      
      // Add new words to the list, handling the word count limit
      for (const newWord of newWords) {
        if (previousWords.length < wordCountLimit) {
          // If under the limit, simply append the new word
          previousWords.push(newWord);
        } else {
          // If at the limit, replace a random existing word
          const randomIndex = Math.floor(Math.random() * previousWords.length);
          previousWords[randomIndex] = newWord;
        }
      }
      
      // Update the user data with the new list
      updatedUserData.previous_words_list = previousWords;
      
      // Save the updated user data back to the KV store
      await context.env.VOCABUILDER_KV.put(userId, JSON.stringify(updatedUserData));
      
      return updatedUserData;
    } catch (error) {
      throw new Error(`Failed to update user words list: ${error.message}`);
    }
  }

// perplexityAI.js
class PerplexityAIClient {
  constructor(apiKey) {
      if (!apiKey) {
          throw new Error('API key is required');
      }
      
      this.apiKey = apiKey;
      this.baseURL = 'https://api.perplexity.ai';
  }

  async generateResponse(prompt, options = {}) {
      try {
          const defaultOptions = {
              model: 'sonar',
              max_tokens: 1024,
              temperature: 0.7,
              stream: false
          };

          const requestOptions = {
              ...defaultOptions,
              ...options,
              messages: [
                  {
                      role: 'user',
                      content: prompt
                  }
              ]
          };

          const response = await fetch(`${this.baseURL}/chat/completions`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${this.apiKey}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestOptions)
          });
          
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'API request failed');
          }

          const data = await response.json();
          
          const resp= {
              success: true,
              data: data,
              text: data.choices[0].message.content
          };
          return resp;

      } catch (error) {
          return {
              success: false,
              error: error.message,
              statusCode: error.status
          };
      }
  }
}
