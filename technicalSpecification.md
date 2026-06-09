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

![System Architecture](./technical_architecture.png)

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

### Step 2: Workspace Configuration
1. Unzip or clone the project directory onto the target machine.
2. Navigate to the root project directory.
3. Open `backend/.env` and replace the placeholder fields with your database connection string and AWS Bedrock credentials:

```ini
# Port on which the API Server runs
PORT=5000

# MongoDB Connection String (Atlas Cluster)
MONGO_URI=mongodb+srv://admin:yourpassword@ahan.kfoiwgs.mongodb.net/partnership_fitment?retryWrites=true&w=majority&appName=Ahan

# Node Environment
NODE_ENV=development

# AWS Bedrock Configurations (Required for Live AI Summaries, falls back to offline model if omitted)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
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
