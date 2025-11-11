// Simple Node.js API for Tailor Software
// No deployment needed - just run locally!

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration for Cloudflare Pages
app.use(cors({
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['https://tailorsoftware01.pages.dev', 'http://localhost:4200', '*'] // Default: Cloudflare Pages + local dev
}));
app.use(express.json());

// MySQL Connection Pool - Aiven Cloud
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'tailor-app-simijain760-6a6f.d.aivencloud.com',
  port: Number(process.env.MYSQL_PORT || 24456),
  user: process.env.MYSQL_USER || 'avnadmin',
  password: process.env.MYSQL_PASSWORD || 'AVNS_bbklmxSjSNxx7fbs62b',
  database: process.env.MYSQL_DATABASE || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,  // Return dates as strings instead of Date objects to avoid timezone issues
  ssl: {
    rejectUnauthorized: false  // Allow self-signed certificates
  }
});

// Test connection
pool.getConnection()
  .then(conn => {
    //console.log('✅ Connected to MySQL!');
    conn.release();
  })
  .catch(err => {
    //console.error('❌ MySQL connection error:', err.message);
  });

// ============================================
// CUSTOMER ROUTES
// ============================================

// GET /api/customers
app.get('/api/customers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customers/:id
app.get('/api/customers/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customers
app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, address, order_delivery_date, due_amount } = req.body;
    const [result] = await pool.query(
      'INSERT INTO customers (name, phone, address, order_delivery_date, due_amount) VALUES (?, ?, ?, ?, ?)',
      [name, phone, address, order_delivery_date, due_amount || 0]
    );
    const [customer] = await pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(customer[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/customers/:id
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, address, order_delivery_date, due_amount } = req.body;
    await pool.query(
      'UPDATE customers SET name = ?, phone = ?, address = ?, order_delivery_date = ?, due_amount = ? WHERE id = ?',
      [name, phone, address, order_delivery_date, due_amount, req.params.id]
    );
    const [customer] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(customer[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ORDER ROUTES
// ============================================

// GET /api/orders
app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.*, c.name as customer_name, c.phone as customer_phone
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.order_date DESC, o.id DESC
    `);
    
    // Get items for each order
    const ordersWithItems = await Promise.all(rows.map(async (order) => {
      const [items] = await pool.query(`
        SELECT 
          oi.id, oi.category, oi.quantity, oi.image_reference,
          om.length, om.chest, om.waist, om.shoulder, om.sleeve, om.hip, om.neck, om.thigh, om.cuff, om.seat,
          so.button, so.collar_back, so.bottom_style, so.pleat_style
        FROM order_items oi
        LEFT JOIN order_measurements om ON oi.id = om.order_item_id
        LEFT JOIN order_style_options so ON oi.id = so.order_item_id
        WHERE oi.order_id = ?
      `, [order.id]);
      
      return {
        ...order,
        items: items
      };
    }));
    
    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', async (req, res) => {
  try {
    const [order] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [req.params.id]
    );
    
    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get items with measurements and style options
    const [items] = await pool.query(`
      SELECT 
        oi.id, oi.category, oi.quantity, oi.image_reference,
        om.length, om.chest, om.waist, om.shoulder, om.sleeve, om.hip, om.neck, om.thigh, om.cuff, om.seat,
        so.button, so.collar_back, so.bottom_style, so.pleat_style
      FROM order_items oi
      LEFT JOIN order_measurements om ON oi.id = om.order_item_id
      LEFT JOIN order_style_options so ON oi.id = so.order_item_id
      WHERE oi.order_id = ?
    `, [req.params.id]);
    
    res.json({
      ...order[0],
      items: items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { receipt_number, order_date, delivery_date, customer_id, total_price, advance_pay, due_amount, notes, items } = req.body;
    
    // Insert order
    const [orderResult] = await connection.query(
      'INSERT INTO orders (receipt_number, order_date, delivery_date, customer_id, total_price, advance_pay, due_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [receipt_number || null, order_date, delivery_date || null, customer_id, total_price || 0, advance_pay || 0, due_amount || 0, notes]
    );
    
    const orderId = orderResult.insertId;
    
    // Insert items
    if (items && items.length > 0) {
      for (const item of items) {
        const [itemResult] = await connection.query(
          'INSERT INTO order_items (order_id, category, quantity, image_reference) VALUES (?, ?, ?, ?)',
          [orderId, item.category, item.quantity || 1, item.image_reference || null]
        );
        
        const itemId = itemResult.insertId;
        
        // Insert measurements
        if (item.measurements) {
          await connection.query(
            'INSERT INTO order_measurements (order_item_id, length, chest, waist, shoulder, sleeve, hip, neck, thigh, cuff, seat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              itemId,
              item.measurements.length || null,
              item.measurements.chest || null,
              item.measurements.waist || null,
              item.measurements.shoulder || null,
              item.measurements.sleeve || null,
              item.measurements.hip || null,
              item.measurements.neck || null,
              item.measurements.thigh || null,
              item.measurements.cuff || null,
              item.measurements.seat || null
            ]
          );
        }
        
        // Insert style options
        if (item.styleOptions) {
          await connection.query(
            'INSERT INTO order_style_options (order_item_id, button, collar_back, bottom_style, pleat_style) VALUES (?, ?, ?, ?, ?)',
            [
              itemId,
              item.styleOptions.button || null,
              item.styleOptions.collarBack || null,
              item.styleOptions.bottomStyle || null,
              item.styleOptions.pleatStyle || null
            ]
          );
        }
      }
    }
    
    await connection.commit();
    
    // Get complete order
    const [order] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(order[0]);
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// PUT /api/orders/:id
app.put('/api/orders/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { receipt_number, order_date, delivery_date, total_price, advance_pay, due_amount, notes, items } = req.body;
    
    // Update order
    await connection.query(
      'UPDATE orders SET receipt_number = ?, order_date = ?, delivery_date = ?, total_price = ?, advance_pay = ?, due_amount = ?, notes = ? WHERE id = ?',
      [receipt_number, order_date, delivery_date || null, total_price, advance_pay, due_amount, notes, req.params.id]
    );
    
    // Delete existing items if new items are provided
    if (items && items.length > 0) {
      // Delete existing items (cascades to measurements and style_options)
      await connection.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
      
      // Insert new items
      for (const item of items) {
        const [itemResult] = await connection.query(
          'INSERT INTO order_items (order_id, category, quantity, image_reference) VALUES (?, ?, ?, ?)',
          [req.params.id, item.category, item.quantity || 1, item.image_reference || null]
        );
        
        const itemId = itemResult.insertId;
        
        // Insert measurements
        if (item.measurements) {
          await connection.query(
            'INSERT INTO order_measurements (order_item_id, length, chest, waist, shoulder, sleeve, hip, neck, thigh, cuff, seat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              itemId,
              item.measurements.length || null,
              item.measurements.chest || null,
              item.measurements.waist || null,
              item.measurements.shoulder || null,
              item.measurements.sleeve || null,
              item.measurements.hip || null,
              item.measurements.neck || null,
              item.measurements.thigh || null,
              item.measurements.cuff || null,
              item.measurements.seat || null
            ]
          );
        }
        
        // Insert style options
        if (item.styleOptions) {
          await connection.query(
            'INSERT INTO order_style_options (order_item_id, button, collar_back, bottom_style, pleat_style) VALUES (?, ?, ?, ?, ?)',
            [
              itemId,
              item.styleOptions.button || null,
              item.styleOptions.collarBack || null,
              item.styleOptions.bottomStyle || null,
              item.styleOptions.pleatStyle || null
            ]
          );
        }
      }
    }
    
    await connection.commit();
    
    // Get complete order with items
    const [order] = await connection.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const [items_result] = await connection.query(`
      SELECT
        oi.id, oi.category, oi.quantity, oi.image_reference,
        om.length, om.chest, om.waist, om.shoulder, om.sleeve, om.hip, om.neck, om.thigh, om.cuff, om.seat,
        so.button, so.collar_back, so.bottom_style, so.pleat_style
      FROM order_items oi
      LEFT JOIN order_measurements om ON oi.id = om.order_item_id
      LEFT JOIN order_style_options so ON oi.id = so.order_item_id
      WHERE oi.order_id = ?
    `, [req.params.id]);
    
    res.json({
      ...order[0],
      items: items_result
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/orders/:id
app.delete('/api/orders/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATISTICS ROUTES
// ============================================

// GET /api/stats/revenue
app.get('/api/stats/revenue', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_price), 0) as total_revenue,
        COALESCE(SUM(advance_pay), 0) as total_advance,
        COALESCE(SUM(due_amount), 0) as total_due
      FROM orders
    `);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  //console.log(`🚀 Tailor Software API running on http://localhost:${PORT}`);
  //console.log(`📊 Database: defaultdb (Aiven Cloud)`);
  //console.log(`\n📝 Available endpoints:`);
  //console.log(`   GET    http://localhost:${PORT}/api/customers`);
  //console.log(`   POST   http://localhost:${PORT}/api/customers`);
  //console.log(`   GET    http://localhost:${PORT}/api/orders`);
  //console.log(`   POST   http://localhost:${PORT}/api/orders`);
  //console.log(`\n✅ Ready to serve!`);
});

