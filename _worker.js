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
    //       "success": true,
    //       "data": {
    //           "id": "6adcc1b6-f5f5-4576-9694-c29b7a4a0074",
    //           "model": "sonar",
    //           "created": 1741173814,
    //           "usage": {
    //               "prompt_tokens": 364,
    //               "completion_tokens": 544,
    //               "total_tokens": 908
    //           },
    //           "citations": [
    //               "https://www.examword.com/high-school-word/",
    //               "https://www.edutopia.org/article/vocabulary-games-content-knowledge/",
    //               "https://www.greatschools.org/gk/parenting/vocabulary/vocabulary-words-for-1st-through-12th-graders/",
    //               "https://www.serpinstitute.org/wordgen-weekly/vocabulary-instruction",
    //               "https://www.teacherspayteachers.com/browse?search=high+school+vocabulary+words"
    //           ],
    //           "object": "chat.completion",
    //           "choices": [
    //               {
    //                   "index": 0,
    //                   "finish_reason": "stop",
    //                   "message": {
    //                       "role": "assistant",
    //                       "content": "```json\n{\n  \"word_list\": [\"Perspicacious\", \"Ennui\", \"Fastidious\", \"Perfidious\", \"Ephemeral\"],\n  \"word_details\": [\n    {\n      \"word\": \"Perspicacious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Having a keen understanding and insight; able to notice and understand things that are not immediately apparent.\",\n      \"example_sentence\": \"She was a perspicacious observer of human behavior and could often predict how people would react in different situations.\",\n      \"etymology\": \"From the Latin 'perspicax,' meaning 'penetrating, discerning,'\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Ennui\",\n      \"part_of_speech\": \"noun\",\n      \"definition\": \"A feeling of listlessness and boredom; a lack of interest or excitement.\",\n      \"example_sentence\": \"After a few months of doing the same job, he started to feel ennui and was looking for a change.\",\n      \"etymology\": \"From French, derived from Old French 'enuier,' meaning 'to annoy,'\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Fastidious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Meticulous and demanding in one's standards; having a strong attention to detail.\",\n      \"example_sentence\": \"She was a fastidious editor, ensuring that every detail in the manuscript was correct before publication.\",\n      \"etymology\": \"From the Latin 'fastidiosus,' meaning 'squeamish,'\",\n      \"difficulty_level\": 3\n    },\n    {\n      \"word\": \"Perfidious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Disloyal or treacherous; having a tendency to betray trust.\",\n      \"example_sentence\": \"The company felt that the former employee's actions were perfidious and damaging to their reputation.\",\n      \"etymology\": \"From the Latin 'perfidiosus,' meaning 'faithless, treacherous,'\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Ephemeral\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Lasting for a very short time.\",\n      \"example_sentence\": \"The firefly's glow was ephemeral, lasting only for a few seconds.\",\n      \"etymology\": \"From the Greek 'ephēmeros,' meaning 'daily,'\",\n      \"difficulty_level\": 3\n    }\n  ]\n}\n```"
    //                   },
    //                   "delta": {
    //                       "role": "assistant",
    //                       "content": ""
    //                   }
    //               }
    //           ]
    //       },
    //       "text": "```json\n{\n  \"word_list\": [\"Perspicacious\", \"Ennui\", \"Fastidious\", \"Perfidious\", \"Ephemeral\"],\n  \"word_details\": [\n    {\n      \"word\": \"Perspicacious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Having a keen understanding and insight; able to notice and understand things that are not immediately apparent.\",\n      \"example_sentence\": \"She was a perspicacious observer of human behavior and could often predict how people would react in different situations.\",\n      \"etymology\": \"From the Latin 'perspicax,' meaning 'penetrating, discerning,'\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Ennui\",\n      \"part_of_speech\": \"noun\",\n      \"definition\": \"A feeling of listlessness and boredom; a lack of interest or excitement.\",\n      \"example_sentence\": \"After a few months of doing the same job, he started to feel ennui and was looking for a change.\",\n      \"etymology\": \"From French, derived from Old French 'enuier,' meaning 'to annoy,'\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Fastidious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Meticulous and demanding in one's standards; having a strong attention to detail.\",\n      \"example_sentence\": \"She was a fastidious editor, ensuring that every detail in the manuscript was correct before publication.\",\n      \"etymology\": \"From the Latin 'fastidiosus,' meaning 'squeamish,'\",\n      \"difficulty_level\": 3\n    },\n    {\n      \"word\": \"Perfidious\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Disloyal or treacherous; having a tendency to betray trust.\",\n      \"example_sentence\": \"The company felt that the former employee's actions were perfidious and damaging to their reputation.\",\n      \"etymology\": \"From the Latin 'perfidiosus,' meaning 'faithless, treacherous,'\",\n      \"difficulty_level\": 4\n    },\n    {\n      \"word\": \"Ephemeral\",\n      \"part_of_speech\": \"adjective\",\n      \"definition\": \"Lasting for a very short time.\",\n      \"example_sentence\": \"The firefly's glow was ephemeral, lasting only for a few seconds.\",\n      \"etymology\": \"From the Greek 'ephēmeros,' meaning 'daily,'\",\n      \"difficulty_level\": 3\n    }\n  ]\n}\n```"
    //   }
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
