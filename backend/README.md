# Virtual Trading Platform Backend

This is a real-time virtual trading platform backend built with **Node.js**, **Express**, **MongoDB (Mongoose)**, and **Socket.io**.

## Features

- **User Authentication**: Secure user registration and login with bcrypt password hashing and JSON Web Tokens (JWT).
- **Virtual Cash Balance**: New users start with a virtual balance of `$100,000.00`.
- **Trading Engine**:
  - **Market Orders**: Immediate execution of stock BUY and SELL requests at current prices.
  - **Limit Orders**: Submit pending orders with a target limit price. Orders execute automatically when the price crosses your target threshold.
- **Stock Price Simulator**: Local random-walk stock price simulation updates prices and triggers limit order checking every 5 seconds. Seeds default tickers: `AAPL`, `MSFT`, `GOOGL`, `AMZN`, `TSLA`, `NVDA`, `META`, `NFLX`.
- **Portfolio Tracking**: Real-time asset valuation, P&L calculations (absolute & percentage), and daily net worth tracking for graphing.
- **Leaderboard**: Global player rankings based on total net worth (cash + holdings valuation).
- **WebSockets (Socket.io)**: Real-time price broadcasts and instant order matching notifications sent directly to user rooms.

---

## Directory Structure

```
backend/
├── src/
│   ├── config/                  # DB, environment, API keys
│   ├── controllers/             # Route controllers (business logic)
│   ├── models/                  # Mongoose models (MongoDB schemas)
│   ├── routes/                  # Express routes
│   ├── services/                # Background stock simulation & order engine
│   ├── middlewares/             # JWT Auth guards & global error handlers
│   ├── sockets/                 # WebSocket events and handlers
│   ├── app.js                   # Express app setup
│   └── server.js                # Server entry point
├── scripts/
│   └── test-endpoints.js        # Automated API integration tests
├── .env
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js (version 18+ recommended)
- MongoDB running locally or a MongoDB Atlas URI

### Installation

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install --cache .npm-cache
   ```

3. Create/verify the `.env` file in the root of the `backend` folder:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/virtual_trading
   JWT_SECRET=supersecretjwttokenforyourvirtualtradingplatform
   JWT_EXPIRE=7d
   SIMULATION_INTERVAL=5000
   ```

### Running the Server

- **Development mode** (with nodemon auto-restart):
  ```bash
  npm run dev
  ```
- **Production mode**:
  ```bash
  npm start
  ```

---

## API Endpoints Reference

### 1. Authentication (`/api/auth`)
- `POST /register`: Registers a new user account. Returns user metadata and JWT.
  - Body: `{ "username": "JohnDoe", "email": "john@example.com", "password": "securepassword" }`
- `POST /login`: Logs in user and returns JWT.
  - Body: `{ "email": "john@example.com", "password": "securepassword" }`
- `GET /me`: Returns profile of the currently logged-in user. (Requires `Authorization: Bearer <token>`)

### 2. Stock Prices (`/api/stocks`)
- `GET /`: Lists all seeded stocks, their current price, daily change, and daily change percent.
- `GET /:symbol`: Returns detailed info and historical price array for a specific stock (e.g. `GET /api/stocks/AAPL`).

### 3. Trades (`/api/trades`)
*(All trade routes require `Authorization: Bearer <token>`)*
- `POST /order`: Submit a BUY or SELL order.
  - **Market Order Body**:
    ```json
    { "symbol": "AAPL", "type": "BUY", "orderType": "MARKET", "shares": 10 }
    ```
  - **Limit Order Body**:
    ```json
    { "symbol": "AAPL", "type": "BUY", "orderType": "LIMIT", "shares": 10, "limitPrice": 150.50 }
    ```
- `GET /history`: Fetch all user transactions (market, completed, and cancelled limit orders).
- `GET /pending`: Retrieve active pending limit orders.
- `DELETE /cancel/:id`: Cancels a pending limit order by transaction ID.

### 4. Portfolio Performance (`/api/portfolio`)
*(All portfolio routes require `Authorization: Bearer <token>`)*
- `GET /`: Retrieves cash balance, active holdings value, net worth, and cumulative P&L.
- `GET /history`: Returns historical net worth logs for plotting portfolio value charts.

### 5. Leaderboard (`/api/leaderboard`)
- `GET /`: Retrieves global leaderboard ranking (top 50) sorted by users' total net worth.

---

## WebSockets (Socket.io) Channels

Clients can connect to Socket.io on the base URL:
- **Price Feed**: Subscribe/Listen to event `stock-prices` for a broadcast array of live price updates.
- **Personal Notifications**:
  - Emitting `join_user_room` with your user ID (e.g., from the login payload) places the client socket into a user-specific secure room.
  - Listen to `order-executed` for instant limit-order matches.
  - Listen to `order-cancelled` for orders cancelled by the matching engine (e.g. insufficient cash at execution time).

---

## Running Integration Tests

To run the integration suite locally which mocks registers, logins, places market/limit trades, cancel orders, checks portfolios, and verifies simulation updates, run:
```bash
npm test
```
*Note: Make sure your local MongoDB instance is running before starting the tests.*
