const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect, checkUsage } = require('../middleware/auth');

const YT = 'https://www.googleapis.com/youtube/v3';

async function ytGet(endpoint, params) {
  params.key = process.env.YOUTUBE_API_KEY;
  const res = await axios.get(YT + '/' + endpoint, { params: params });
  return res.data;
}

function fmt(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

router.get('/channel/:id', protect, checkUsage('channelAudits', 3), async function(req, res) {
  try {
    let id = req.params.id;
    if (!id.startsWith('UC')) {
      const s = await ytGet('search', { q: id, type: 'channel', part: 'snippet', maxResults: 1 });
      if (!s.items || !s.items.length) return res.status(404).json({ error: 'Channel nahi mila' });
      id = s.items[0].snippet.channelId;
    }
    const ch = await ytGet('channels', { id: id, part: 'snippet,statistics' });
    const vs = await ytGet('search', { channelId: id, part: 'snippet', order: 'date', maxResults: 15, type: 'video' });
    if (!ch.items || !ch.items.length) return res.status(404).json({ error: 'Channel nahi mila' });
    const vidIds = (vs.items || []).map(function(v) { return v.id.videoId; }).filter(Boolean).join(',');
    let videos = [];
    if (vidIds) {
      const vd = await ytGet('videos', { id: vidIds, part: 'statistics,snippet' });
      videos = vd.items || [];
    }
    const avg = videos.length ? Math.round(videos.reduce(function(s, v) { return s + parseInt(v.statistics.viewCount || 0); }, 0) / videos.length) : 0;
    const c = ch.items[0];
    res.json({
      channel: { id: id, name: c.snippet.title, thumbnail: c.snippet.thumbnails && c.snippet.thumbnails.medium ? c.snippet.thumbnails.medium.url : '', subscribers: fmt(c.statistics.subscriberCount), totalViews: fmt(c.statistics.viewCount), videoCount: fmt(c.statistics.videoCount), avgViews: fmt(avg) },
      videos: videos.map(function(v) { return { id: v.id, title: v.snippet.title, thumbnail: v.snippet.thumbnails && v.snippet.thumbnails.medium ? v.snippet.thumbnails.medium.url : '', views: parseInt(v.statistics.viewCount || 0), likes: parseInt(v.statistics.likeCount || 0), publishedAt: v.snippet.publishedAt, outlierScore: avg ? parseFloat((parseInt(v.statistics.viewCount || 0) / avg).toFixed(2)) : 1 }; })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/keywords', protect, checkUsage('keywordSearches', 5), async function(req, res) {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const queries = [q, q + ' tutorial', q + ' tips', q + ' hindi', q + ' 2024', 'how to ' + q, 'best ' + q, q + ' ideas', q + ' guide', q + ' for beginners'];
    const results = await Promise.all(queries.map(async function(kw) {
      try {
        const r = await ytGet('search', { q: kw, type: 'video', part: 'snippet', maxResults: 50 });
        return { keyword: kw, count: r.pageInfo ? r.pageInfo.totalResults || 0 : 0 };
      } catch(e) {
        return { keyword: kw, count: 0 };
      }
    }));
    results.sort(function(a, b) { return b.count - a.count; });
    const max = results[0] ? results[0].count || 1 : 1;
    res.json(results.map(function(r) {
      return { keyword: r.keyword, score: Math.round((r.count / max) * 100), competition: r.count / max > 0.7 ? 'High' : r.count / max > 0.4 ? 'Medium' : 'Low', opportunity: r.count / max < 0.4 ? 'High' : r.count / max < 0.7 ? 'Medium' : 'Low' };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
