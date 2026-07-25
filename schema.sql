CREATE DATABASE IF NOT EXISTS health_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE health_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY,
  name VARCHAR(100) DEFAULT '',
  gender VARCHAR(20) DEFAULT '',
  age INT DEFAULT 0,
  height INT DEFAULT 0,
  weight INT DEFAULT 0,
  phone VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS health_records (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  symptoms TEXT NOT NULL,
  duration VARCHAR(50) DEFAULT '',
  other_symptoms TEXT,
  analysis_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (username, password, email, role)
SELECT 'admin', 'admin123', 'admin@health.com', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (username, password, email, role)
SELECT 'user1', '123456', 'user1@example.com', 'user'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'user1');
