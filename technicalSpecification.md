# Tariff Tracker - Technical Specification & Architecture

This document provides a comprehensive technical specification, system architecture layout, database schema mapping, and network deployment guide for the **Tariff Tracker & Import Cost Intelligence System**.

---

## 🛠️ Technology Stack Details

The system is built on a modular, decoupled MERN architecture integrated with live cloud APIs and Amazon Bedrock generative AI services:

### 1. Frontend Client
- **Core Engine**: Vite + React.js (v18+)
- **State & Logic**: Functional Hooks (`useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`)
- **Styling**: Premium Vanilla CSS (custom variables, modern dark mode glassmorphism theme, Tech Mahindra `#E31837` branding, hover micro-animations, and fluid transitions)
- **Data Visualizations**: 
  - Custom HTML/CSS Proportional Treemap Partitioning Layout Algorithm (responsive box subdivision)
  - Interactive SDE × VED 3x3 Heatmap Matrix Grid
- **Routing & Client Build**: Client-side single-page dashboard shell, compiled cleanly via Vite/Rollup production bundling.

### 2. Backend API Server
- **Runtime**: Node.js (v18+)
- **Web Framework**: Express.js (MVC-style Controller-Route-Model schema)
- **Database Access**: Mongoose ODM (Object Document Mapper)
- **Parsing**: `xlsx` (SheetJS) library for Excel workbook reading
- **AWS Bedrock SDK**: `@aws-sdk/client-bedrock-runtime` (version `^3.1064.0`)
- **Middlewares**: `cors` (cross-origin sharing), `express.json` (body parsing), and a centralized global `errorHandler`.

### 3. Database Layer
- **Platform**: MongoDB Atlas Cloud Database Cluster
- **Logical Database Name**: `partnership_fitment`
- **Schemas**: Strict Mongoose schema configuration with automatic index structures.

### 4. Cloud Services & External APIs
- **Amazon Bedrock AI Engine**: Claude-3-Haiku (`anthropic.claude-3-haiku-20240307-v1:0` model) for generative supply-chain executive risk summaries.
- **World Bank Logistics API**: REST overall score query (`LP.LPI.OVRL.XQ` indicator) for logistics resilience scoring.
- **GDELT News API**: Dynamic article search querying geopolitical trade/tariff headlines by country origin.
- **HMRC / WCO Trade Tariff API**: Real-time HTTP GET queries for HS Code classification checks.

---

## 🧱 System Architecture

The following diagram illustrates the decoupled client-server architecture, business logic services, and external database/cloud integrations:

![System Architecture](./excalidraw_architecture.png)

---

## 🔄 Sequence Diagram: Math Derivation & Bedrock AI Analysis

This sequence diagram details the asynchronous workflow initiated when a user clicks the **Detailed Calculation** button for a product:

![AI Risk Analysis Sequence Flow](./ai_sequence_diagram.png)

---

## 🗄️ Database Schemas

### 1. Product Master Schema (`products` collection)
```javascript
{
  erpCode: { type: String, required: true, unique: true, index: true },
  hsCode: { type: String, required: true },
  category: { type: String, default: 'General' },
  description: { type: String, default: '' },
  inHandInventory: { type: Number, default: 0 },
  inventoryValue: { type: Number, default: 0 },
  inTransitInventory: { type: Number, default: 0 },
  daysOfCoverage: { type: Number, default: 0 },
  roq: { type: Number, default: 0 },
  reviewType: { type: String, default: 'Perpetual' },
  safetyStock: { type: Number, default: 0 },
  holdingCostPct: { type: Number, default: 0 }
}
```

### 2. Supplier Master Schema (`suppliers` collection)
```javascript
{
  productErpCode: { type: String, required: true, index: true },
  supplierId: { type: String, required: true },
  supplierName: { type: String, required: true },
  country: { type: String, required: true },
  region: { type: String, default: 'Asia' },
  countryCode: { type: String, default: 'CN' },
  supplyPct: { type: Number, default: 100 },
  leadTimeDays: { type: Number, default: 0 },
  defaultTransport: { type: String, default: 'Ship/Ocean' },
  reliability: { type: Number, default: 100 },
  moq: { type: Number, default: 0 }
}
```

### 3. Sync Metadata Schema (`syncmetadatas` collection)
Tracks filesystem modification times of master data files to avoid redundant Atlas writes:
```javascript
{
  filename: { type: String, required: true, unique: true },
  lastModified: { type: Number, required: true }
}
```

---

## ⚙️ Complete Setup & Deployment Guide

This guide details how to install, configure, and host the MERN system on a local network or corporate intranet.

### Prerequisites
- Install **Node.js LTS** (version 18.0.0 or higher).
- A **MongoDB Atlas Cluster** (or local MongoDB server instance).
- Optional: **AWS IAM Access Key Credentials** with permissions to invoke Amazon Bedrock (`InvokeModel` action for `anthropic.claude-3-haiku-20240307-v1:0`).

---

### Step 1: Provision MongoDB Atlas Cluster
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new Cluster (e.g. Free Tier shared M0 cluster).
3. Under **Network Access**, click **Add IP Address** and whitelist your server's IP address (use `0.0.0.0/0` if deploying to a dynamic environment or intranet).
4. Under **Database Access**, create a database user with read/write privileges (e.g., username `admin`, password `yourpassword`).
5. Click **Connect** -> **Drivers** -> Copy your application connection string. It should look like:
   `mongodb+srv://admin:yourpassword@clustername.kfoiwgs.mongodb.net/partnership_fitment?retryWrites=true&w=majority`

---

### Step 2: Workspace Configuration & API Keys Setup

1. Navigate to the `backend/` directory of the project.
2. Create or open the environment configuration file named **`backend/.env`**.
3. Insert your database connection string and AWS Bedrock IAM keys. Use the following detailed configuration structure:

```ini
# ==============================================================================
# 1. API SERVER PORT CONFIGURATION
# ==============================================================================
PORT=5000

# ==============================================================================
# 2. MONGODB ATLAS API CONNECTION KEY (Required)
# ==============================================================================
# Place your MongoDB Atlas connection string here.
# - Where to obtain: MongoDB Atlas Cloud Console -> Connect -> Connect to Application -> Driver Node.js
# - Replace 'admin' and 'yourpassword' with your database user credentials.
MONGO_URI=mongodb+srv://admin:yourpassword@ahan.kfoiwgs.mongodb.net/partnership_fitment?retryWrites=true&w=majority

# ==============================================================================
# 3. AMAZON BEDROCK AI ACCESS KEYS (Optional - Fallback Enabled)
# ==============================================================================
# - AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY: AWS IAM credentials with Bedrock invoke privileges.
# - Where to obtain: AWS Management Console -> IAM -> Users -> Select User -> Security Credentials -> Access Keys
# - AWS_REGION: The AWS datacenter region where Amazon Bedrock Claude-3 model access is enabled (e.g., us-east-1, us-west-2).
# - BEDROCK_MODEL_ID: Target AWS Bedrock model identifier. Defaults to anthropic.claude-3-haiku-20240307-v1:0.
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# ==============================================================================
# 4. EXTERNAL PUBLIC APIS (No Keys Required)
# ==============================================================================
# Note: World Bank Logistics (LPI) API and GDELT News API are open public REST endpoints
# and DO NOT require any API keys or subscriptions to function. They are queried directly.
```

---

### Step 3: Install Dependencies
Run the unified orchestrator script from the root directory to install packages for the orchestrator, backend, and frontend concurrently:

```bash
npm run install-all
```

*Alternative (Manual installation):*
```bash
npm install                     # Root
cd backend && npm install       # Backend
cd ../frontend && npm install   # Frontend
```

---

### Step 4: Run Development Servers
Start both backend API and frontend Vite servers concurrently with one command:

```bash
npm run dev
```

On execution:
1. The **MERN Backend** connects to MongoDB Atlas.
2. The **Excel Synchronization Service** (`syncService.js`) checks if `backend/data/Product Master Ptototype.xlsx` or `Supplier Master Prototype.xlsx` files have changed compared to database timestamps.
3. If they are new or modified, they are automatically parsed and written to MongoDB Atlas within 2 seconds.
4. The backend server runs on `http://localhost:5000`.
5. The frontend Vite client launches on `http://localhost:5173` (or port `5177` if in use).

---

### Step 5: Production Build & Deployment

#### 1. Compile Client Bundle
Compile the Vite application into static, optimized HTML/CSS/JS files:

```bash
cd frontend
npm run build
```
The output files will be compiled and placed inside `frontend/dist/`.

#### 2. Host Frontend Static Files
You can host the contents of `frontend/dist/` on any web server (IIS, Nginx, Apache, or static clouds like Surge, Netlify, or AWS S3). 
To deploy to a separate Surge domain (e.g. `tariff-tracker-393355.surge.sh`), run:
```bash
node deploy.cjs
```

#### 3. Host Backend API Server
Deploy the `backend/` directory to a Node.js production server host (AWS Elastic Beanstalk, Heroku, PM2 on virtual machines, or Docker containers).
- Make sure to configure environment variables (`MONGO_URI`, `PORT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) directly in your production host environment.
- Start the server using:
```bash
npm start
```

---

## 🐳 Docker Containerization & Orchestration

The application is containerized into separate frontend and backend tiers. This ensures environment consistency, isolated dependencies, and trivial intranet scaling.

### 1. Dockerfile Configurations

*   **Backend Dockerfile (`backend/Dockerfile`)**: Builds on a lightweight `node:20-alpine` image. It sets `NODE_ENV=production`, runs `npm ci --omit=dev` to install only production dependencies, copies the source code, and exposes port `5000` to handle Express API requests.
*   **Frontend Dockerfile (`frontend/Dockerfile`)**: Uses a multi-stage Nginx build:
    1.  *Stage 1 (Build)*: Uses `node:20-alpine` to run `npm ci` and compile static assets (`npm run build`).
    2.  *Stage 2 (Nginx)*: Copies the built React assets (`/app/dist`) into `nginx:stable-alpine` and exposes port `80` to serve them.

### 2. Multi-Container Orchestration (`docker-compose.yml`)

The root `docker-compose.yml` file configures and links the services:
*   `backend`: Builds from `./backend`, exposing port `5000`. Reads local configurations via `env_file`.
*   `frontend`: Builds from `./frontend`, exposing port `80` inside Nginx, mapped to port `5173` on the host machine. It automatically runs after the `backend` starts.

### 3. Exact Commands to Build and Run the App via Docker

To start the entire application (both frontend and backend containers) in detached mode, execute this command from the project root:
```bash
docker compose up --build -d
```

To stop all services and tear down the containers:
```bash
docker compose down
```

To view real-time logs from both containers:
```bash
docker compose logs -f
```

---

## 📡 Complete REST API Catalog

The backend exposes 16 endpoints to handle data access, advanced logistics simulations, Bedrock AI queries, and external API proxying.

### Group 1: Core Database Metadata Routes

#### 1. API Server Health Check
*   **Route**: `GET /api/health`
*   **Purpose**: Checks server health and database connectivity.
*   **Response**: `{ "status": "success", "message": "API is healthy and MongoDB is connected" }`

#### 2. Get Product Master list
*   **Route**: `GET /api/products`
*   **Purpose**: Returns all products in the database.
*   **Response**: `{ "status": "success", "products": [...] }`

#### 3. Get Supplier Master list
*   **Route**: `GET /api/suppliers`
*   **Purpose**: Returns all suppliers in the database.
*   **Response**: `{ "status": "success", "suppliers": [...] }`

#### 4. Get Suppliers for SKU
*   **Route**: `GET /api/suppliers/:productErpCode`
*   **Purpose**: Returns suppliers registered for a specific product ERP code.
*   **Response**: `{ "status": "success", "suppliers": [...] }`

### Group 2: Mathematical Calculations & Analytics Routes

#### 5. Calculate SDE/VED Risk Records
*   **Route**: `POST /api/calculations/risk-records`
*   **Purpose**: Calculates SDE/VED classes, lead time risk points, and 0-100 scores for all products.
*   **Request Body**: `{ "thresholds": {...}, "weightsA": {...}, "weightsB": {...} }`
*   **Response**: `{ "success": true, "records": [...], "summary": {...} }`

#### 6. Retrieve Detailed Mathematical Risk Derivations
*   **Route**: `POST /api/calculations/risk-details`
*   **Purpose**: Computes step-by-step risk formulas and invokes Amazon Bedrock Claude-3 AI assessments.
*   **Request Body**: `{ "product": {...}, "localCrit": 0.5, "localTar": {...}, "localCorr": {...}, "config": {...}, "activeModel": "ModelB" }`
*   **Response**: `{ "success": true, "calcDetails": { "intermediateVars": {...}, "aiAnalysis": "..." } }`

#### 7. Calculate Landed Costs & Supplier Comparisons
*   **Route**: `POST /api/calculations/tariff`
*   **Purpose**: Calculates itemized landed cost breakdown and supplier comparisons for the Tariff Impact Calculator.
*   **Request Body**: `{ "selectedProduct": {...}, "destinationCountry": "...", "unitFobPrice": 10, "orderQty": 100, "overrides": {...} }`
*   **Response**: `{ "success": true, "breakdowns": [...], "comparison": {...} }`

#### 8. Run Tariff Scenario Overrides & Sensitivity Matrix
*   **Route**: `POST /api/calculations/scenario`
*   **Purpose**: Computes positive/negative tariff shifts and generates the 10-level sensitivity analysis matrix.
*   **Request Body**: Same parameters as `/api/calculations/tariff` plus simulated adjustments.
*   **Response**: `{ "success": true, "scenarioResults": {...}, "sensitivityMatrix": [...] }`

#### 9. Solve Procurement Sourcing Splits (MILP Optimizer)
*   **Route**: `POST /api/calculations/procurement-optimizer`
*   **Purpose**: Calculates optimal splits respecting MOQs and risk multipliers, returns cost forecasts, and compiles demand sensing charts.
*   **Request Body**: `{ "selectedProduct": {...}, "suppliers": [...], "serviceLevelZ": 1.65, "dailyUse": 2.0, "destinationCountry": "India", "dualSourcingEnabled": true, "maxSharePct": 0.8, "totalDemand": 100, "holdingCostRate": 0.15, "riskWeight": 1.0, "criticalityInfo": {...} }`
*   **Response**: `{ "success": true, "optimizationResults": { "feasible": true, "solution": {...}, "demandSensingData": [...], "strategies": [...], "optimizedSavingsPct": 12.5 } }`

#### 10. Calculate Criticality Metrics (5x5 Matrix)
*   **Route**: `POST /api/calculations/criticality`
*   **Purpose**: Calculates weighted 5x5 criticality scoring and stockout risks.
*   **Request Body**: `{ "components": [...], "sdeWeights": {...}, "vedWeights": {...}, ... }`
*   **Response**: `{ "success": true, "criticalityResults": {...} }`

#### 11. Calculate FOB price adjustments (MOQ Multiplier)
*   **Route**: `POST /api/calculations/fob-calculator`
*   **Purpose**: Computes backend-driven MOQ scale factor unit cost calculations.
*   **Request Body**: `{ "supplierPrice": 10, "moqMultiplier": 3 }`
*   **Response**: `{ "success": true, "calculatedFob": 30 }`

#### 12. Recalculate Override values
*   **Route**: `POST /api/calculations/override-calculator`
*   **Purpose**: Converts custom overrides and updates baseline calculations.
*   **Request Body**: `{ "originalTariffPct": 5, "overrideValue": 25, "isPercentage": true }`
*   **Response**: `{ "success": true, "newTariffPct": 25 }`

### Group 3: Geopolitical News & External API Proxy Routes

#### 13. Proxy UK Trade Tariff Headings
*   **Route**: `GET /api/external/trade-tariff/headings/:id`
*   **Purpose**: Redirects search query requests to HMRC Trade Tariff API for headings data.
*   **Response**: UK Trade Tariff JSON.

#### 14. Proxy UK Trade Tariff Chapters
*   **Route**: `GET /api/external/trade-tariff/chapters/:id`
*   **Purpose**: Redirects search query requests to HMRC Trade Tariff API for chapters data.
*   **Response**: UK Trade Tariff JSON.

#### 15. Proxy REST Countries all-list
*   **Route**: `GET /api/external/countries`
*   **Purpose**: Redirects search query requests to REST Countries for flag links, regional codes, and name profiles.
*   **Response**: REST Countries all JSON array.

#### 16. Proxy Exchange Rates
*   **Route**: `GET /api/external/exchange-rates/latest/:baseCurrency`
*   **Purpose**: Fetches live exchange rates using the backend `EXCHANGE_RATE_API_KEY` configuration.
*   **Response**: ExchangeRate-API V6 rates payload.

### Group 4: Internal Third-Party API Integrations

The backend server also executes direct outgoing HTTP queries to the following public external API services to pull real-time data:

1.  **World Bank Logistics Performance Index (LPI) API**:
    *   **External Endpoint**: `https://api.worldbank.org/v2/country/{countryCode}/indicator/LP.LPI.OVRL.XQ?format=json`
    *   **Purpose**: Retrieves historical logistics capability index ratings by country code.

2.  **GDELT Project News Document API**:
    *   **External Endpoint**: `https://api.gdeltproject.org/api/v2/doc/doc?query=(tariff%20OR%20%22trade%20war%22%20OR%20%22shipping%20disruption%22)%20{countryName}&mode=artlist&format=json&maxrecords=5`
    *   **Purpose**: Dynamically searches recent global news publications containing geopolitical corridor and trade-barrier headlines matching a supplier's origin country.

---

## 🛠️ Troubleshooting & FAQs

#### Q1: What happens if the backend server runs without AWS Bedrock Keys?
- The backend will print a console warning on boot.
- When calculation details are opened, `apiService.js` automatically invokes the **Offline AI Risk Simulator** fallback. It returns structural risk assessments reflecting the product's actual logistics LPI rating, days of coverage, and category.

#### Q2: How can I force-sync new Excel records?
- Open either `backend/data/Product Master Ptototype.xlsx` or `backend/data/Supplier Master Prototype.xlsx`, modify a row or save the file to update its OS "Last Modified" file timestamp.
- The `nodemon` backend watch process will reboot the server, detect the file change, delete the old database collections, and upload the updated rows within seconds.

#### Q3: How do World Bank LPI and GDELT News calls affect page load speeds?
- API queries are made in parallel, cached in-memory inside `apiService.js`, and configured with a 1-hour time-to-live (`CACHE_TTL = 3600000`).
- Grid loads on the main page read from memory cache. Only the first request of each country code queries the remote APIs, guaranteeing sub-second page performance.
