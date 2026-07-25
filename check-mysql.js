const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '123456'
    });
    const [rows] = await conn.query('SELECT VERSION() AS version');
    console.log(JSON.stringify({ ok: true, version: rows[0].version }));
    await conn.end();
  } catch (error) {
    console.error(JSON.stringify({ ok: false, message: error.message }));
    process.exit(1);
  }
})();
