// wordsManager.js
class WordsManager {
    constructor(env) {
        this.KV = env.WORDS_KV;
        this.perplexityClient = new PerplexityAIClient(env.PERPLEXITY_API_KEY);
    }

    async getUserKey(userId) {
        return `user_${userId}_words`;
    }

    async getStoredWords(userId) {
        const userKey = await this.getUserKey(userId);
        const storedWords = await this.KV.get(userKey);
        return storedWords ? JSON.parse(storedWords) : [];
    }

    async storeWords(userId, words) {
        const userKey = await this.getUserKey(userId);
        const existingWords = await this.getStoredWords(userId);
        const updatedWords = [...existingWords, ...words];
        await this.KV.put(userKey, JSON.stringify(updatedWords));
    }

    async generatePrompt(count, age, language = 'English', existingWords = []) {
        return `Generate ${count} unique ${language} words that are appropriate for age ${age}. 
                These words should be educational and not include any of these previously used words: ${existingWords.join(', ')}.
                Format the response as a JSON array of strings.`;
    }

    async generateNewWords(count, age, language = 'English') {
        try {
            // Get existing words for the user
            const existingWords = await this.getStoredWords(userId);
            
            // Generate prompt for Perplexity
            const prompt = await this.generatePrompt(count, age, language, existingWords);
            
            // Get response from Perplexity
            const response = await this.perplexityClient.generateResponse(prompt);
            
            if (!response.success) {
                throw new Error('Failed to generate words');
            }

            // Parse the response to get words array
            const newWords = JSON.parse(response.text);
            
            return newWords;
        } catch (error) {
            console.error('Error generating words:', error);
            throw error;
        }
    }
}


// worker.js
export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', {
                status: 405,
                headers: corsHeaders
            });
        }

        try {
            const reqData = await request.json();
            const { userId, age, count, language = 'English' } = reqData;

            // Validate inputs
            if (!userId || !age || !count) {
                return new Response(JSON.stringify({
                    error: 'Missing required fields: userId, age, and count are required'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            if (count <= 0 || !Number.isInteger(count)) {
                return new Response(JSON.stringify({
                    error: 'Count must be a positive integer'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // Initialize WordsManager
            const wordsManager = new WordsManager(env);

            // Generate new words
            const newWords = await wordsManager.generateNewWords(count, age, language);

            // Store the new words
            await wordsManager.storeWords(userId, newWords);

            return new Response(JSON.stringify({
                success: true,
                words: newWords
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};