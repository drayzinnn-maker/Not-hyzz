const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const db = new sqlite3.Database('./database.sqlite');

db.run(`
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE,
    product_name TEXT,
    buyer_email TEXT,
    buyer_name TEXT,
    value REAL,
    status TEXT,
    purchase_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.post('/webhook', (req, res) => {
  const data = req.body;
  const event = data.event;
  const product = data.data?.product || {};
  const buyer = data.data?.buyer || {};
  const purchase = data.data?.purchase || {};
  const transaction = data.data?.transaction || {};

  if (event !== 'PURCHASE_APPROVED') {
    return res.status(200).json({ message: 'Ignorado' });
  }

  const transactionId = transaction.id || `unknown_${Date.now()}`;
  const productName = product.name || 'Produto sem nome';
  const buyerEmail = buyer.email || 'email@naoinformado.com';
  const buyerName = buyer.name || 'Cliente não informado';
  const value = purchase.full_price?.value || 0;
  const purchaseDate = purchase.approved_date ? new Date(purchase.approved_date).toISOString() : new Date().toISOString();

  const sql = `
    INSERT OR REPLACE INTO sales 
    (transaction_id, product_name, buyer_email, buyer_name, value, status, purchase_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, [transactionId, productName, buyerEmail, buyerName, value, 'approved', purchaseDate], function(err) {
    if (err) {
      console.error('❌ Erro:', err.message);
      return res.status(500).json({ error: 'Erro' });
    }
    console.log(`✅ Venda: ${productName} - ${buyerEmail}`);
    res.status(200).json({ message: 'OK' });
  });
});

app.get('/api/sales', (req, res) => {
  db.all('SELECT * FROM sales ORDER BY purchase_date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro' });
    res.json(rows);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
