const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'health_system',
  charset: 'utf8mb4'
};

let pool;
let dbAvailable = false;

async function createConnection() {
  const baseConfig = { ...dbConfig, database: undefined };
  const basePool = mysql.createPool(baseConfig);

  try {
    const connection = await basePool.getConnection();
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    connection.release();
    await basePool.end();

    pool = mysql.createPool(dbConfig);
    const dbConnection = await pool.getConnection();
    dbConnection.release();
    dbAvailable = true;
    console.log('MySQL connection successful');
  } catch (error) {
    dbAvailable = false;
    console.warn('MySQL connection failed, continuing without DB:', error.message);
  }
}

async function initDatabase() {
  await createConnection();
  if (!dbAvailable) {
    return;
  }

  const schemaSql = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(255) DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS profiles (
      user_id INT PRIMARY KEY,
      name VARCHAR(100) DEFAULT '',
      gender VARCHAR(20) DEFAULT '',
      age INT DEFAULT 0,
      height INT DEFAULT 0,
      weight INT DEFAULT 0,
      phone VARCHAR(50) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS health_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      temp DECIMAL(4,1) DEFAULT NULL,
      blood_pressure VARCHAR(50) DEFAULT '',
      heart_rate INT DEFAULT NULL,
      blood_sugar DECIMAL(4,1) DEFAULT NULL,
      cholesterol DECIMAL(4,1) DEFAULT NULL,
      oxygen INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS consultations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symptoms TEXT NOT NULL,
      duration VARCHAR(50) DEFAULT '',
      other_symptoms TEXT,
      analysis_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];

  for (const sql of schemaSql) {
    await pool.query(sql);
  }

  await seedDefaultUsers();
}

async function seedDefaultUsers() {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (rows[0].count === 0) {
    await pool.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', ['admin', 'admin123', 'admin@health.com', 'admin']);
    await pool.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', ['user1', '123456', 'user1@example.com', 'user']);
  }
}

function requireDb(res) {
  if (!dbAvailable) {
    res.status(503).json({ success: false, message: 'MySQL 数据库不可用，请先启动 MySQL 并配置连接信息。' });
    return false;
  }
  return true;
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务已启动', database: dbAvailable ? 'connected' : 'disconnected' });
});

app.post('/api/auth/login', async (req, res) => {
  if (!requireDb(res)) return;
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (rows.length === 0) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  const user = rows[0];
  delete user.password;
  res.json({ success: true, user });
});

app.post('/api/auth/register', async (req, res) => {
  if (!requireDb(res)) return;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }
  try {
    const [result] = await pool.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', [username, password, '', 'user']);
    const user = { id: result.insertId, username, email: '', role: 'user' };
    res.json({ success: true, user, message: '注册成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: '用户名已存在' });
    } else {
      res.status(500).json({ success: false, message: '注册失败' });
    }
  }
});

app.get('/api/users', async (req, res) => {
  if (!requireDb(res)) return;
  const [rows] = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC');
  res.json(rows);
});

app.put('/api/users/:id', async (req, res) => {
  if (!requireDb(res)) return;
  const { id } = req.params;
  const { username, email } = req.body;
  await pool.query('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, id]);
  res.json({ success: true, message: '用户信息更新成功' });
});

app.delete('/api/users/:id', async (req, res) => {
  if (!requireDb(res)) return;
  const { id } = req.params;
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ success: true, message: '删除成功' });
});

app.get('/api/profiles/:userId', async (req, res) => {
  if (!requireDb(res)) return;
  const { userId } = req.params;
  const [rows] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  if (rows.length === 0) {
    return res.json({});
  }
  res.json(rows[0]);
});

app.put('/api/profiles/:userId', async (req, res) => {
  if (!requireDb(res)) return;
  const { userId } = req.params;
  const { name, gender, age, height, weight, phone } = req.body;
  await pool.query(`INSERT INTO profiles (user_id, name, gender, age, height, weight, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name), gender = VALUES(gender), age = VALUES(age), height = VALUES(height), weight = VALUES(weight), phone = VALUES(phone)`, [userId, name || '', gender || '', age || 0, height || 0, weight || 0, phone || '']);
  res.json({ success: true, message: '资料保存成功' });
});

app.get('/api/health-records', async (req, res) => {
  if (!requireDb(res)) return;
  const { userId } = req.query;
  let sql = 'SELECT * FROM health_records';
  const params = [];
  if (userId) {
    sql += ' WHERE user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

app.post('/api/health-records', async (req, res) => {
  if (!requireDb(res)) return;
  const { userId, temp, bloodPressure, heartRate, bloodSugar, cholesterol, oxygen } = req.body;
  const [result] = await pool.query(
    'INSERT INTO health_records (user_id, temp, blood_pressure, heart_rate, blood_sugar, cholesterol, oxygen) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, temp ?? null, bloodPressure || '', heartRate ?? null, bloodSugar ?? null, cholesterol ?? null, oxygen ?? null]
  );
  res.json({ success: true, id: result.insertId, message: '健康数据已保存' });
});

app.delete('/api/health-records/:id', async (req, res) => {
  if (!requireDb(res)) return;
  await pool.query('DELETE FROM health_records WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: '健康记录删除成功' });
});

app.get('/api/consultations', async (req, res) => {
  if (!requireDb(res)) return;
  const { userId } = req.query;
  let sql = 'SELECT * FROM consultations';
  const params = [];
  if (userId) {
    sql += ' WHERE user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

app.post('/api/consultations', async (req, res) => {
  if (!requireDb(res)) return;
  const { userId, symptoms, duration, otherSymptoms, analysis } = req.body;
  const [result] = await pool.query(
    'INSERT INTO consultations (user_id, symptoms, duration, other_symptoms, analysis_json) VALUES (?, ?, ?, ?, ?)',
    [userId, symptoms, duration || '', otherSymptoms || '', JSON.stringify(analysis)]
  );
  res.json({ success: true, id: result.insertId, message: '咨询记录已保存' });
});

app.delete('/api/consultations/:id', async (req, res) => {
  if (!requireDb(res)) return;
  await pool.query('DELETE FROM consultations WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: '咨询记录删除成功' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
  await initDatabase();
  return app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server start failed:', error);
    process.exit(1);
  });
}

module.exports = { app, startServer };
