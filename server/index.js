import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

dotenv.config();

const app = express();

// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: 'http://localhost:5173', // Vite's default port
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Brave Search API call
    const braveResponse = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'X-Subscription-Token': process.env.BRAVE_API_KEY,
        'Accept': 'application/json',
      },
      params: {
        q: query,
        count: 5
      }
    });

    // Extract relevant information from Brave search results
    const searchResults = braveResponse.data.web.results.map(result => ({
      title: result.title,
      description: result.description,
      url: result.url
    }));

    // Format search results for Gemini
    const searchContext = searchResults
      .map(result => `${result.title}\n${result.description}\nSource: ${result.url}`)
      .join('\n\n');

    // Generate AI response using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Based on the following search results:\n\n${searchContext}\n\nProvide a comprehensive answer to the query: "${query}"`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiAnswer = response.text();

    res.json({
      searchResults,
      aiAnswer
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});