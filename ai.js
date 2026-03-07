const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect, checkUsage } = require('../middleware/auth');

async function callClaude(systemPrompt, messages) {
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages
  }, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });
  return res.data.content[0].text;
}

const COACH = 'You are TubeBoost AI, an expert YouTube growth coach. Help creators grow their channels with practical advice about titles, thumbnails, SEO, content strategy, monetization, and the YouTube algorithm. Be friendly and use emojis. Reply in the same language as the user (Hindi/English/Hinglish).';

router.post('/chat', protect, checkUsage('aiMessages', 10), async function(req, res) {
  try {
    const message = req.body.message;
    const history = req.body.history || [];
    if (!message) return res.status(400).json({ error: 'Message required' });
    const messages = history.slice(-8).concat([{ role: 'user', content: message }]);
    const reply = await callClaude(COACH, messages);
    res.json({ reply: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/keywords', protect, async function(req, res) {
  try {
    const topic = req.body.topic;
    const prompt = 'YouTube SEO expert. Topic: "' + topic + '". Suggest 5 high-potential long-tail keywords. Return ONLY JSON array: ["kw1","kw2","kw3","kw4","kw5"]';
    const raw = await callClaude('', [{ role: 'user', content: prompt }]);
    const keywords = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json({ keywords: keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
