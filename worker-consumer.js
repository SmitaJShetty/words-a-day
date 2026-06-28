// consumer of queue
// fetches words from perplexity and updates db store
export default {
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      console.log(
        `Queue Event Triggered! Harvesting new words for user ID: ${message.body.userId}`,
      );

      try {
        // 1. Fetch the master system prompt rules out of your KV store
        const masterPrompt = await env.WORDS_KV.get("PROMPT");
        if (!masterPrompt)
          throw new Error("KV System Prompt ('PROMPT') is missing.");

        // 2. Fetch the Perplexity API key directly from your KV store
        const apiKey = await env.WORDS_KV.get("Perplexity_Api_Key");
        if (!apiKey)
          throw new Error(
            "KV Perplexity API Key ('Perplexity_Api_Key') is missing.",
          );

        // 3. Call Perplexity live in the background using the retrieved KV token
        const aiResponse = await fetch(
          "https://api.perplexity.ai/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar-reasoning",
              messages: [
                { role: "system", content: masterPrompt },
                {
                  role: "user",
                  content:
                    "Provide 5 advanced vocabulary words in a JSON array under a 'words' property. Format: { words: [ { word, part_of_speech, definition, example_sentence } ] }",
                },
              ],
              response_format: { type: "json_object" },
            }),
          },
        );

        const aiData = await aiResponse.json();

        if (!aiResponse.ok) {
          throw new Error(
            `Perplexity API Error (${aiResponse.status}): ${JSON.stringify(aiData)}`,
          );
        }

        const cleanContent = JSON.parse(aiData.choices[0].message.content);
        const wordsArray = cleanContent.words || [];

        // 4. Directly append every single fresh word straight into your D1 database
        for (const item of wordsArray) {
          await env.WORDS_DB.prepare(
            `
                        INSERT OR IGNORE INTO WordBank (word, part_of_speech, definition, example_sentence) 
                        VALUES (?, ?, ?, ?)
                    `,
          )
            .bind(
              item.word.toLowerCase(),
              item.part_of_speech,
              item.definition,
              item.example_sentence,
            )
            .run();
        }

        console.log(
          `Success! ${wordsArray.length} new words successfully cached in D1.`,
        );

        // 5. Acknowledge and drop the message from the queue pipeline
        message.ack();
      } catch (error) {
        console.error("Harvesting failed:", error.message);
        // Omitting message.ack() tells Cloudflare to retry the message automatically later
      }
    }
  },
};
