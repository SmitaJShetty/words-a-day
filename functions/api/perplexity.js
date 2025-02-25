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
                model: 'mistral-7b-instruct',
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
            
            return {
                success: true,
                data: data,
                text: data.choices[0].message.content
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.status
            };
        }
    }
}

// worker.js
export default {
    async fetch(request, env, ctx) {
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        // Handle OPTIONS request for CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        // Only accept POST requests
        if (request.method !== 'POST') {
            return new Response('Method not allowed', {
                status: 405,
                headers: corsHeaders
            });
        }

        try {
            // Parse the request body
            const reqData = await request.json();
            const { prompt, options } = reqData;

            if (!prompt) {
                return new Response(JSON.stringify({ error: 'Prompt is required' }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            // Initialize the Perplexity client with API key from environment variable
            const perplexity = new PerplexityAIClient(env.PERPLEXITY_API_KEY);

            // Generate response
            const response = await perplexity.generateResponse(prompt, options);

            return new Response(JSON.stringify(response), {
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