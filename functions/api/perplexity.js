// functions/api/perplexity.js

export default class PerplexityAIClient {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('API key validation failure: PERPLEXITY_API_KEY is uninitialized.');
        }
        this.apiKey = apiKey;
        this.baseURL = 'https://api.perplexity.ai';
    }

    async generateResponse(prompt, options = {}) {
        try {
            const defaultOptions = {
                model: 'sonar', // Updated to the correct active Perplexity model naming convention
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
                throw new Error(errorData.error?.message || errorData.error || 'API request failed');
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
                error: error.message
            };
        }
    }
}
