# Simple Node.js API for Tailor Software

**No deployment needed!** Just run this locally - it connects directly to your MySQL database.

---

## Quick Setup

### 1. Install Node.js (if not installed)

Download from: https://nodejs.org/

### 2. Install Dependencies

```bash
cd simple-api-nodejs
npm install
```

### 3. Configure MySQL Connection

Edit `server.js` line 14-21:

```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password', // ← Change this!
  database: 'tailor_software',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### 4. Create MySQL Database

```bash
mysql -u root -p

CREATE DATABASE tailor_software;
USE tailor_software;
SOURCE /path/to/database_schema_mysql.sql;
```

### 5. Start API Server

```bash
npm start

# Or for auto-restart on changes:
npm run dev
```

### 6. Test API

Open browser: http://localhost:3000/api/customers

---

## Available Endpoints

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order with items
- `POST /api/orders` - Create order with items
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Statistics
- `GET /api/stats/revenue` - Get revenue stats

---

## Connect Angular

### Update environment.ts

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'  // ← Your simple API
};
```

### Update TailorService

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TailorService {
  private apiUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}
  
  getUsers() {
    return this.http.get(`${this.apiUrl}/customers`);
  }
  
  addCustomer(customer: any) {
    return this.http.post(`${this.apiUrl}/customers`, customer);
  }
  
  // ... etc
}
```

---

## That's It!

No deployment, no Docker, no cloud!
- ✅ MySQL database stores everything
- ✅ Simple Node.js server runs locally
- ✅ Angular app talks to it
- ✅ Everything works on your computer!

---

## Troubleshooting

### "Cannot connect to MySQL"
Check your password in `server.js` line 19

### "Database tailor_software does not exist"
Run: `mysql -u root -p < database_schema_mysql.sql`

### Port 3000 already in use
Change PORT in server.js line 11

---

## Files
- `server.js` - Main API server (200 lines)
- `package.json` - Dependencies
- No config files needed!

**Just run `npm install && npm start` and you're done!** 🎉

