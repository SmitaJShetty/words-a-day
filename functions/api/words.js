// functions/api/words.js

import PerplexityAIClient from "./perplexity.js";

// Global CORS configurations header blueprint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 1. Handle preflight CORS OPTIONS requests automatically
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

//queries db for new words , not already sent to user
//if new words are not found, then send message to queue
//queue addition will trigger job to fetch new records from worer-consumer function
export async function onRequestPost(context) {
  const { env, request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Words-App-Token",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let userId = 1; // Defaulting to user 1 for initial environment testing

    // 1. Query D1 for a random word not seen by this user
    const d1Query = `
            SELECT * FROM WordBank 
            WHERE id NOT IN (SELECT word_id FROM UserProgress WHERE user_id = ?)
            ORDER BY RANDOM() LIMIT 1;
        `;
    let wordRecord = await env.WORDS_DB.prepare(d1Query).bind(userId).first();

    // 2. ASYNC DECOUPLED TRIGGER: If the database pool is dry
    if (!wordRecord) {
      console.log("Pool empty! Queueing background harvesting request.");

      // Add task payload context directly to your Cloudflare Queue
      await env.HARVEST_QUEUE.send({
        action: "HARVEST_NEW_WORDS",
        userId: userId,
        requestedAt: new Date().toISOString(),
      });

      // Return a fast status message so the application UI doesn't hang
      return new Response(
        JSON.stringify({
          success: true,
          source: "async_queue_trigger",
          data: {
            word: "Preparing New Words...",
            part_of_speech: "status",
            definition:
              "The background engine is currently harvesting fresh vocabulary for you.",
            example_sentence:
              "Please refresh the interface in a few seconds to review your new words.",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // 3. Log selection choice to prevent future repeats for this user id
    await env.WORDS_DB.prepare(
      `
            INSERT OR IGNORE INTO UserProgress (user_id, word_id) VALUES (?, ?)
        `,
    )
      .bind(userId, wordRecord.id)
      .run();

    // 4. Serve the ready database record
    return new Response(
      JSON.stringify({
        success: true,
        source: "cache_pool",
        data: {
          word: wordRecord.word,
          part_of_speech: wordRecord.part_of_speech,
          definition: wordRecord.definition,
          example_sentence: wordRecord.example_sentence,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
}
