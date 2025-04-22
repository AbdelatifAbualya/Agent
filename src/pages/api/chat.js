// src/pages/api/chat.js
export default async function handler(req, res) {
  console.log("API route called with method:", req.method);
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check environment variables
    const hasAbacusCredentials = !!process.env.ABACUS_DEPLOYMENT_TOKEN && !!process.env.ABACUS_DEPLOYMENT_ID;
    const hasFireworkCredentials = !!process.env.FIREWORK_API_KEY;

    if (!hasFireworkCredentials) {
      console.error("FIREWORK_API_KEY is not set");
      return res.status(500).json({ error: 'Server configuration error - missing Firework API key' });
    }

    // Intent detection - Check if the message starts with a search command
    const isSearchQuery = message.trim().toLowerCase().startsWith('/search ');
    const isDirectQuery = message.trim().toLowerCase().startsWith('/ask ');
    
    // Extract the actual query by removing the command
    let actualQuery = message;
    if (isSearchQuery) {
      actualQuery = message.substring('/search '.length).trim();
      console.log("Search query detected:", actualQuery);
    } else if (isDirectQuery) {
      actualQuery = message.substring('/ask '.length).trim();
      console.log("Direct query detected:", actualQuery);
    }

    let context = '';
    let relevantDocs = [];

    // Only query Abacus if it's a search query or not explicitly a direct query
    if ((isSearchQuery || !isDirectQuery) && hasAbacusCredentials) {
      console.log("Fetching data from Abacus.AI...");
      
      try {
        const abacusResponse = await fetch('https://api.abacus.ai/api/v0/lookup_matches', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ABACUS_DEPLOYMENT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deployment_id: process.env.ABACUS_DEPLOYMENT_ID,
            data: actualQuery,
          }),
        });
        
        if (!abacusResponse.ok) {
          console.error("Abacus API error:", abacusResponse.status);
          // Continue with empty context instead of failing
        } else {
          const abacusData = await abacusResponse.json();
          
          // Extract relevant documents - with fallbacks for different possible structures
          relevantDocs = abacusData.matches || abacusData.results || abacusData.data || [];
          console.log("Found", relevantDocs.length, "relevant documents");
          
          // Safely extract text from documents
          context = relevantDocs
            .map(doc => {
              if (typeof doc === 'string') return doc;
              return doc.text || doc.content || JSON.stringify(doc);
            })
            .join('\n\n');
        }
      } catch (abacusError) {
        console.error("Error with Abacus API:", abacusError.message);
        // Continue with empty context instead of failing
      }
    } else if (isDirectQuery) {
      console.log("Skipping Abacus query for direct question");
    } else if (!hasAbacusCredentials) {
      console.log("Skipping Abacus query due to missing credentials");
    }

    // Use Firework.ai's DeepSeek to generate response
    console.log("Sending request to Firework.ai...");
    
    let systemMessage = 'You are a helpful assistant.';
    let userMessage = actualQuery;
    
    // If this is a search query with context, use a more specific system prompt
    if ((isSearchQuery || !isDirectQuery) && context) {
      systemMessage = 'You are a helpful assistant. Use the provided context to answer questions accurately. If the information is not in the context, state that you don\'t have that information.';
      userMessage = `Context:\n${context}\n\nQuestion: ${actualQuery}`;
    }
    
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
            content: systemMessage
          },
          {
            role: 'user',
            content: userMessage
          }
        ]
      }),
    });

    if (!fireworkResponse.ok) {
      console.error("Firework API error:", fireworkResponse.status);
      return res.status(fireworkResponse.status).json({ 
        error: 'Error from Firework API',
        status: fireworkResponse.status
      });
    }

    const fireworkData = await fireworkResponse.json();
    
    if (!fireworkData?.choices?.[0]?.message?.content) {
      console.error("Unexpected Firework response format");
      return res.status(500).json({ error: 'Invalid response format from Firework API' });
    }
    
    const answer = fireworkData.choices[0].message.content;

    // Return the final response
    res.status(200).json({ 
      response: answer,
      context: relevantDocs.length > 0 ? relevantDocs : null,
      searchMode: isSearchQuery || (!isDirectQuery && relevantDocs.length > 0)
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
