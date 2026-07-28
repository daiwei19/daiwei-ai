const express = require('express');

const app = express();

// 解析 JSON 请求体
app.use(express.json());

// ========== 只保留 API 路由 ==========
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务已启动' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, user: { id: 1, username: 'admin', email: 'admin@health.com', role: 'admin' } });
  }
  if (username === 'user1' && password === '123456') {
    return res.json({ success: true, user: { id: 2, username: 'user1', email: 'user1@example.com', role: 'user' } });
  }
  res.status(401).json({ success: false, message: '用户名或密码错误' });
});

// ... (你的其他 /api 路由保持不变) ...

// 404 兜底（只针对 API 请求）
app.use((req, res) => {
  res.status(404).json({ error: 'API Not Found' });
});

// 本地开发才启动监听
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// 【必须导出】供 Vercel Serverless 调用
module.exports = app;

