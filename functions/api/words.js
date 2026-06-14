// functions/api/words.js

import PerplexityAIClient from './perplexity.js';

// Global CORS configurations header blueprint
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 1. Handle preflight CORS OPTIONS requests automatically
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

// 2. Main POST Request routing logic
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        // Parse raw payload inputs
        const reqData = await request.json();
        const { prompt, options } = reqData;

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Validation Error: Prompt parameter is required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Initialize our imported client module using the environment variables bound to Pages
        const perplexity = new PerplexityAIClient(env.PERPLEXITY_API_KEY);

        // Execute processing pipeline
        const aiResponse = await perplexity.generateResponse(prompt, options);

        return new Response(JSON.stringify(aiResponse), {
            status: aiResponse.success ? 200 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: `System Error: ${error.message}` 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
