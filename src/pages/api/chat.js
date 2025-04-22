// src/pages/api/chat.js
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Get relevant documents from Abacus.AI
    const abacusResponse = await fetch('https://api.abacus.ai/api/v0/lookup_matches', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ABACUS_DEPLOYMENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deployment_id: process.env.ABACUS_DEPLOYMENT_ID,
        data: message,
      }),
    });

    if (!abacusResponse.ok) {
      const errorData = await abacusResponse.json();
      console.error('Abacus API error:', errorData);
      return res.status(abacusResponse.status).json({ 
        error: 'Error fetching from Abacus API',
        details: errorData
      });
    }

    const abacusData = await abacusResponse.json();
    
    // Extract relevant documents
    const relevantDocs = abacusData.matches || [];
    const context = relevantDocs.map(doc => doc.text).join('\n\n');

    // 2. Use Firework.ai's DeepSeek to generate response
    const fireworkResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
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
            content: 'You are a helpful assistant. Use the provided context to answer questions accurately. If the information is not in the context, state that you don\'t have that information.'
          },
          {
            role: 'user',
            content: context ? `Context:\n${context}\n\nQuestion: ${message}` : message
          }
        ]
      }),
    });

    if (!fireworkResponse.ok) {
      const errorData = await fireworkResponse.json();
      console.error('Firework API error:', errorData);
      return res.status(fireworkResponse.status).json({ 
        error: 'Error fetching from Firework API',
        details: errorData
      });
    }

    const fireworkData = await fireworkResponse.json();
    const answer = fireworkData.choices[0].message.content;

    // Return the final response
    res.status(200).json({ 
      response: answer,
      context: context ? relevantDocs : null
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
