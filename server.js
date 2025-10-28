import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア
app.use(cors());
app.use(express.json());

// Tracker.gg API ベースURL
const TRACKER_API_BASE = 'https://api.tracker.gg/api/v2/valorant/standard';

// APIキーをヘッダーに追加するヘルパー
const getHeaders = () => ({
  'TRN-Api-Key': process.env.TRN_API_KEY,
  'Accept': 'application/json',
  'User-Agent': 'valorant-tracker-app/1.0'
});

// プロフィール情報取得
app.get('/api/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const encodedId = encodeURIComponent(identifier);
    const url = `${TRACKER_API_BASE}/profile/riot/${encodedId}`;
    
    console.log(`Fetching profile: ${url}`);
    
    const response = await fetch(url, { headers: getHeaders() });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Tracker API error: ${response.status}`, errorText);
      return res.status(response.status).json({ 
        error: `Tracker API error: ${response.status}`,
        details: errorText 
      });
    }
    
    const data = await response.json();
    
    // データを整形
    const platformInfo = data.data?.platformInfo || {};
    const metadata = data.data?.metadata || {};
    const segments = data.data?.segments || [];
    const competitiveSegment = segments.find(s => s.type === 'competitive');
    
    const profile = {
      account: {
        name: platformInfo.platformUserHandle || identifier,
        level: metadata.level || 'N/A',
        card: metadata.bannerImageUrl || metadata.avatarUrl
      },
      rank: competitiveSegment ? {
        name: competitiveSegment.metadata?.tierName || 'Unranked',
        rating: competitiveSegment.stats?.rating?.value || 0,
        rankImg: competitiveSegment.metadata?.imageUrl
      } : null
    };
    
    res.json(profile);
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// 試合履歴取得
app.get('/api/matches/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const limit = req.query.limit || 20;
    const encodedId = encodeURIComponent(identifier);
    const url = `${TRACKER_API_BASE}/matches/riot/${encodedId}`;
    
    console.log(`Fetching matches: ${url}`);
    
    const response = await fetch(url, { headers: getHeaders() });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Tracker API error: ${response.status}`, errorText);
      return res.status(response.status).json({ 
        error: `Tracker API error: ${response.status}`,
        details: errorText 
      });
    }
    
    const data = await response.json();
    const matches = (data.data?.matches || []).slice(0, limit);
    
    // 試合データを整形
    const formattedMatches = matches.map(match => {
      const segment = match.segments?.[0];
      const stats = segment?.stats || {};
      const metadata = segment?.metadata || {};
      
      return {
        won: metadata.hasWon || false,
        map: metadata.mapName || 'Unknown',
        agent: metadata.agentName || 'Unknown',
        kills: stats.kills?.value || 0,
        deaths: stats.deaths?.value || 0,
        assists: stats.assists?.value || 0,
        score: stats.score?.value || 0,
        headshots: stats.headshots?.value || 0,
        kd: stats.kDRatio?.value || 0,
        timestamp: match.metadata?.timestamp
      };
    });
    
    res.json({ matches: formattedMatches });
    
  } catch (error) {
    console.error('Matches fetch error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    apiKeyConfigured: !!process.env.TRN_API_KEY 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`API Key configured: ${!!process.env.TRN_API_KEY}`);
});
