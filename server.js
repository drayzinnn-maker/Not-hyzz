const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURAÇÃO DO SUPABASE =====
// Substitua pelos seus dados (pegue no Settings > API do Supabase)
const SUPABASE_URL = 'https://rxvrlujyqtvxggeyflgs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dnJsdWp5cXR2eGdnZXlmbGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyOTgzMjEsImV4cCI6MjEwMTg3NDMyMX0.Fdatn8OnlcZVlGRKfcJo4EzyfAkq_JKvSIJQjOUi6c4';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== MIDDLEWARES =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// ===== ROTA PARA RECEBER WEBHOOK DA HOTMART =====
app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recebido!');
  console.log('📦 Payload:', JSON.stringify(req.body).substring(0, 300));

  const data = req.body;
  const event = data.event;
  const product = data.data?.product || {};
  const buyer = data.data?.buyer || {};
  const purchase = data.data?.purchase || {};
  const transaction = data.data?.transaction || {};

  // Só processa se for compra aprovada
  if (event !== 'PURCHASE_APPROVED') {
    console.log(`⏭️ Evento ignorado: ${event}`);
    return res.status(200).json({ message: 'Ignorado' });
  }

  // Extrai os dados
  const transactionId = transaction.id || `unknown_${Date.now()}`;
  const productName = product.name || 'Produto sem nome';
  const buyerEmail = buyer.email || 'email@naoinformado.com';
  const buyerName = buyer.name || 'Cliente não informado';
  const value = purchase.full_price?.value || 0;
  const currency = purchase.full_price?.currency || 'BRL';
  const purchaseDate = purchase.approved_date ? new Date(purchase.approved_date).toISOString() : new Date().toISOString();

  console.log(`💾 Tentando salvar: ${productName} - ${buyerEmail}`);

  // ===== ATENÇÃO: TROQUE 'sales' pelo nome da sua tabela no Supabase =====
  // Se sua tabela se chama 'vendas', troque para 'vendas'
  const { data: inserted, error } = await supabase
    .from('sales') // <-- ALTERE AQUI se necessário
    .upsert({
      transaction_id: transactionId,
      product_name: productName,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      value: value,
      currency: currency,
      status: 'approved',
      purchase_date: purchaseDate
    }, { onConflict: 'transaction_id' })
    .select();

  if (error) {
    console.error('❌ Erro ao salvar no Supabase:', error.message);
    return res.status(500).json({ error: 'Erro ao processar', details: error.message });
  }

  console.log(`✅ Venda salva com sucesso: ${productName} - ${buyerEmail}`);
  res.status(200).json({ message: 'OK' });
});

// ===== API PARA LISTAR VENDAS =====
app.get('/api/sales', async (req, res) => {
  const { data, error } = await supabase
    .from('sales') // <-- ALTERE AQUI se necessário
    .select('*')
    .order('purchase_date', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar vendas:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar' });
  }

  res.json(data);
});

// ===== API PARA APAGAR TODAS AS VENDAS =====
app.delete('/api/sales', async (req, res) => {
  const { error } = await supabase.from('sales').delete().neq('id', 0);
  if (error) {
    console.error('❌ Erro ao apagar vendas:', error.message);
    return res.status(500).json({ error: 'Erro ao apagar' });
  }
  res.json({ message: 'Todas as vendas foram apagadas.' });
});

// ===== API PARA APAGAR UMA VENDA ESPECÍFICA =====
app.delete('/api/sales/:id', async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) {
    console.error('❌ Erro ao apagar venda:', error.message);
    return res.status(500).json({ error: 'Erro ao apagar' });
  }
  res.json({ message: 'Venda apagada.' });
});

// ===== ROTA PARA SERVIR O FRONTEND =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// ===== INICIA O SERVIDOR =====
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
