const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');

router.get('/', protect, async function(req, res) {
  try {
    const geo = req.query.geo || 'IN';
    const url = 'https://trends.google.com/trends/api/dailytrends?hl=en-IN&tz=-330&geo=' + geo + '&ns=15';
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
    const jsonStr = response.data.replace(/^\)\]\}'/, '').trim();
    const data = JSON.parse(jsonStr);
    const trending = data && data.default && data.default.trendingSearchesDays && data.default.trendingSearchesDays[0] ? data.default.trendingSearchesDays[0].trendingSearches : [];
    const trends = trending.slice(0, 15).map(function(t, i) {
      return {
        rank: i + 1,
        title: t.title ? t.title.query : '',
        traffic: t.formattedTraffic || '',
        relatedQueries: (t.relatedQueries || []).slice(0, 3).map(function(r) { return r.query; })
      };
    });
    res.json({ trends: trends, geo: geo });
  } catch (err) {
    res.json({
      trends: [
        { rank: 1, title: 'YouTube Shorts monetization', traffic: '500K+', relatedQueries: ['shorts tips', 'shorts viral'] },
        { rank: 2, title: 'AI video tools 2024', traffic: '200K+', relatedQueries: ['AI editing', 'auto subtitles'] },
        { rank: 3, title: 'YouTube algorithm update', traffic: '150K+', relatedQueries: ['algorithm 2024', 'views drop'] },
        { rank: 4, title: 'Faceless YouTube channel', traffic: '100K+', relatedQueries: ['faceless niche', 'anonymous channel'] },
        { rank: 5, title: 'YouTube SEO tips Hindi', traffic: '80K+', relatedQueries: ['seo 2024', 'keyword research hindi'] }
      ],
      geo: req.query.geo || 'IN',
      note: 'Live trends unavailable'
    });
  }
});

module.exports = router;
