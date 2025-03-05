// The main event listener for incoming requests
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

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
    
    // Check if user can receive notification based on frequency
    const canReceiveNotification = checkNotificationEligibility(userData);
    
    if (!canReceiveNotification) {
      return new Response(JSON.stringify({
        success: false,
        error: `You have already received words for your ${userData.frequency} frequency. Please wait for the next scheduled time.`
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const customPrompt = generateCustomPrompt(promptTemplate, userData);
    
    const result = await processPrompt(customPrompt); 
    const newWords = extractNewWords(result);
    
    // Update user data with new words and notification status
    const updatedUserData = await updateUserWordsList(event, userId, userData, newWords);
    
    return new Response(JSON.stringify({
      success: true,
      userId: userId,
      result: parseResultIntoJson(result).word_details,
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

// Check if user is eligible to receive notification based on frequency
function checkNotificationEligibility(userData) {
  // If no frequency or last notification time is not set, allow notification
  if (!userData.frequency || !userData.last_notification_date) {
    return true;
  }
  
  const currentDate = new Date();
  const lastNotificationDate = new Date(userData.last_notification_date);
  
  switch (userData.frequency.toLowerCase()) {
    case 'daily':
      return !isSameDay(currentDate, lastNotificationDate);
    
    case 'weekly':
      return daysDifference(currentDate, lastNotificationDate) >= 7;
    
    case 'biweekly':
      return daysDifference(currentDate, lastNotificationDate) >= 14;
    
    case 'fortnightly':
      // Check if it's either 1st or 15th of the month
      return (currentDate.getDate() === 1 || currentDate.getDate() === 15) && 
             !isSameDay(currentDate, lastNotificationDate);
    
    case 'monthly':
      return currentDate.getMonth() !== lastNotificationDate.getMonth();
    
    default:
      return true;
  }
}

// Helper function to check if two dates are the same day
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// Helper function to calculate days difference between two dates
function daysDifference(date1, date2) {
  const timeDiff = Math.abs(date1.getTime() - date2.getTime());
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

// Update the user's previous words list and notification status
async function updateUserWordsList(context, userId, userData, newWords) {
  try {
    // Create a copy of the user data
    const updatedUserData = { ...userData };
    
    // Get the current list of previous words
    let previousWords = [...updatedUserData.previous_words_list];

    // Determine the word count limit for this user
    const wordCountLimit = updatedUserData.words_count;

    // Add new words to the list, handling the word count limit
    for (const newWord of newWords) {
      if (previousWords.length < wordCountLimit) {
        previousWords.push(newWord);
      } else {
        // Replace a random existing word
        const randomIndex = Math.floor(Math.random() * previousWords.length);
        previousWords[randomIndex] = newWord;
      }
    }
    
    // Update the user data with the new list
    updatedUserData.previous_words_list = previousWords;
    
    // Update last notification date to current date
    updatedUserData.last_notification_date = new Date().toISOString();
    
    // Save the updated user data back to the KV store
    await VOCABUILDER_KV.put(userId, JSON.stringify(updatedUserData));
    
    return updatedUserData;
  } catch (error) {
    throw new Error(`Failed to update user words list: ${error.message}`);
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
    return await perplexity.generateResponse(prompt);

    // return {
    //     "success": true,
    //     "data": {
    //         "id": "37aaa0a1-e68f-4a52-a8df-73da15cf5ddc",
    //         "model": "sonar",
    //         "created": 1741175432,
    //         "usage": {
    //             "prompt_tokens": 368,
    //             "completion_tokens": 542,
    //             "total_tokens": 910
    //         },
    //         "citations": [
    //             "https://www.examword.com/high-school-word/",
    //             "https://www.edutopia.org/article/vocabulary-games-content-knowledge/",
    //             "https://www.greatschools.org/gk/parenting/vocabulary/12th-grade-vocabulary-words/",
    //             "https://www.serpinstitute.org/wordgen-weekly/vocabulary-instruction",
    //             "https://www.vocabulary.com/lists/gw5mfvr5/120-words-every-10th-grader-should-know"
    //         ],
    //         "object": "chat.completion",
    //         "choices": [
    //             {
    //                 "index": 0,
    //                 "finish_reason": "stop",
    //                 "message": {
    //                     "role": "assistant",
    //                     "content": "```json\n{\n  \"word_list\": [\"Perspicacious\", \"Fastidious\", \"Meritorious\", \"Cacophonous\", \"Ennui\"],\n  \"word_details\": [\n    {\n      \"word\": \"Perspicacious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Having a keen understanding and insight; able to notice and understand things that are not immediately apparent.\",\n      \"example_sentence\": \"The detective was perspicacious and quickly pieced together the evidence to solve the case.\",\n      \"etymology\": \"From Latin *perspicax*, meaning 'penetrating' or 'discerning'.\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Fastidious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Meticulous and demanding in one's standards; having a strong attention to detail.\",\n      \"example_sentence\": \"She is a fastidious editor, ensuring every detail in the manuscript is correct.\",\n      \"etymology\": \"From Latin *fastidiosus*, meaning 'delicate' or 'squeamish'.\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Meritorious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Deserving praise or reward; having or showing merit.\",\n      \"example_sentence\": \"Her meritorious service to the community earned her a prestigious award.\",\n      \"etymology\": \"From Latin *meritorius*, meaning 'deserving reward'.\",\n      \"difficulty_level\": 3\n    },\n    {\n      \"word\": \"Cacophonous\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Having an unpleasant mixture of loud, harsh sounds.\",\n      \"example_sentence\": \"The cacophonous noise from the construction site was disturbing the peace.\",\n      \"etymology\": \"From Greek *κακόφωνος* (*kakophōnos*), meaning 'bad sound'.\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Ennui\",\n      \"part_of_speech\": \"noun\",\n      \"definition\": \"A feeling of listlessness and boredom; a lack of interest or excitement.\",\n      \"example_sentence\": \"After a few months of doing the same job, he started to feel ennui and looked for a change.\",\n      \"etymology\": \"From French *ennui*, derived from Old French *enuier*, meaning 'to annoy'.\",\n      \"difficulty_level\": 4\n    }\n  ]\n}\n```"
    //                 },
    //                 "delta": {
    //                     "role": "assistant",
    //                     "content": ""
    //                 }
    //             }
    //         ]
    //     },
    //     "text": "```json\n{\n  \"word_list\": [\"Perspicacious\", \"Fastidious\", \"Meritorious\", \"Cacophonous\", \"Ennui\"],\n  \"word_details\": [\n    {\n      \"word\": \"Perspicacious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Having a keen understanding and insight; able to notice and understand things that are not immediately apparent.\",\n      \"example_sentence\": \"The detective was perspicacious and quickly pieced together the evidence to solve the case.\",\n      \"etymology\": \"From Latin *perspicax*, meaning 'penetrating' or 'discerning'.\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Fastidious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Meticulous and demanding in one's standards; having a strong attention to detail.\",\n      \"example_sentence\": \"She is a fastidious editor, ensuring every detail in the manuscript is correct.\",\n      \"etymology\": \"From Latin *fastidiosus*, meaning 'delicate' or 'squeamish'.\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Meritorious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Deserving praise or reward; having or showing merit.\",\n      \"example_sentence\": \"Her meritorious service to the community earned her a prestigious award.\",\n      \"etymology\": \"From Latin *meritorius*, meaning 'deserving reward'.\",\n      \"difficulty_level\": 3\n    },\n    {\n      \"word\": \"Cacophonous\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Having an unpleasant mixture of loud, harsh sounds.\",\n      \"example_sentence\": \"The cacophonous noise from the construction site was disturbing the peace.\",\n      \"etymology\": \"From Greek *κακόφωνος* (*kakophōnos*), meaning 'bad sound'.\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Ennui\",\n      \"part_of_speech\": \"noun\",\n      \"definition\": \"A feeling of listlessness and boredom; a lack of interest or excitement.\",\n      \"example_sentence\": \"After a few months of doing the same job, he started to feel ennui and looked for a change.\",\n      \"etymology\": \"From French *ennui*, derived from Old French *enuier*, meaning 'to annoy'.\",\n      \"difficulty_level\": 4\n    }\n  ]\n}\n```"
    // }
  }
  
  // Extract new words from the API result
  function extractNewWords(result) {
    // This function extracts just the words from the API response
    // Adjust according to the actual structure of your Perplexity API response
    return parseResultIntoJson(result).word_list;
  }
  /// parses result from ai and removes code prompt, parses into json before returning it
  function parseResultIntoJson(result){
    const content=result.data.choices[0].message.content;
    const wordlist = content.replace("```json","" ).replace("```",""); 
    return JSON.parse(wordlist);
  }

  // Update the user's previous words list
  async function updateUserWordsList(context, userId, userData, newWords) {
    try {
      // Create a copy of the user data
      const updatedUserData = { ...userData };
      
      // Get the current list of previous words
      let previousWords = [...updatedUserData.previous_words_list];
      console.log(`previous words:`, previousWords);

      // Determine the word count limit for this user
      const wordCountLimit = updatedUserData.words_count;
      console.log(`word count limit`, wordCountLimit);

      // Add new words to the list, handling the word count limit
      for (const newWord of newWords) {
        if (previousWords.length < wordCountLimit) {
          // If under the limit, simply append the new word
          console.log(`new word to be added: `, newWord);
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
      await VOCABUILDER_KV.put(userId, JSON.stringify(updatedUserData));
      
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
