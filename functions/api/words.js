// worker.js
export default {
    async fetch(request, env, ctx) {
        // Testing Cloudflare Pages Functions
        console.log("Cloudflare Pages function running");
        
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        // Handle OPTIONS request for CORS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        // Only accept POST requests
        if (request.method !== 'GET') {
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