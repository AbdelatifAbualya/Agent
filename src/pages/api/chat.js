// src/pages/api/direct-chat.js
// This is a simplified version that bypasses Abacus.ai for testing
export default async function handler(req, res) {
  console.log("Direct chat API route called");
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.FIREWORK_API_KEY) {
      console.error("FIREWORK_API_KEY is not set");
      return res.status(500).json({ error: 'Missing Firework API key' });
    }

    console.log("Sending direct request to Firework.ai...");
    
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIREWORK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/deepseek-v3",
        max_tokens: 4096,
        top_p: 1,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: message
          }
        ]
      }),
    });

    if (!response.ok) {
      console.error("Firework API error:", response.status);
      return res.status(response.status).json({ 
        error: 'Error from Firework API',
        status: response.status
      });
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    res.status(200).json({ 
      response: answer
    });
  } catch (error) {
    console.error('Error in direct chat API:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
