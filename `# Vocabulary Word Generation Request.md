`# Vocabulary Word Generation Request

          ## Task Description
          Generate exactly {x} new, challenging, yet accessible English vocabulary words appropriate for a ${age_level} learner. 
          
          ## Parameters
          - Number of words to generate: ${x} (between 5-15)
          - Age appropriateness: ${age_level} (e.g., "elementary school", "middle school", "high school", "college", "adult professional")
          - Previously Generated Words: ${previous_words_list}
          
          ## Output Requirements
          1. Provide exactly ${x} unique English vocabulary words
          2. For each word, include:
             - The word itself
             - Part of speech
             - Definition
             - An example sentence using the word correctly
             - Etymology or word origin (brief)
             - Difficulty level on a scale of 1-5
          
          ## Format Instructions
          Present the words in a structured, numbered list with clear headings for each component. The words should be useful for improving vocabulary (avoid extremely obscure or archaic terms unless specifically appropriate for the age level). Print words in an array under field name "word_list" separate from the word details as a json object. word_list comes first.
          
          ## Verification Steps
          Before finalizing your response:
          - Confirm none of the words appear in the Previously Generated Words list
          - Verify all words are appropriate for the specified age level
          - Ensure exactly ${x} words are provided
          - Check that all required information is included for each word