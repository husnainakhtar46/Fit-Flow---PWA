# Fit Flow - PWA (Quality Assurance System)

A full-stack **Progressive Web Application (PWA)** designed for the garment industry to manage quality inspections, generate reports, and track analytics—even without an internet connection.

## 🚀 Key Features

### 📶 Offline-First Capability
-   **No Internet? No Problem**: Perform inspections in remote factories with zero connectivity.
-   **Local Database**: Uses **Dexie.js (IndexedDB)** to save all data and images locally on your device.
-   **Client-Side PDF Generation**: Generate professional PDF reports instantly on the device using `@react-pdf/renderer` without needing a server connection.
-   **Auto-Sync**: When back online, the **Sync Manager** identifies pending offline records and synchronizes them with the central database.

### 🏭 Inspection Modules
1.  **Development Inspections**:
    -   For Proto, Fit, Size Set, and PP samples.
    -   Detailed feedback for Workmanship, Measurement, Wash, and Fabric.
    -   Dynamic measurement charts with visual tolerance checks.
2.  **Final Inspections (AQL)**:
    -   **ISO 2859-1 Standard**: Built-in AQL logic (Strict/Standard) to automatically calculate sample sizes and acceptance limits.
    -   **Shipment Audit**: Track cartons, gross weight, and container loading.
    -   **Defect Counters**: Tally Critical, Major, and Minor defects with auto-fail logic.

### 📱 Progressive Web App (PWA)
-   **Installable**: Can be installed as a native app on Android, iOS, and Windows.
-   **Adaptive Icons**: Optimized for all devices.
-   **Fast Loading**: Caches assets for instant load times.

## 🛠️ Tech Stack

-   **Frontend**:
    -   React, TypeScript, Vite
    -   **PWA**: `vite-plugin-pwa` (Service Workers, Manifest)
    -   **Offline DB**: Dexie.js (IndexedDB wrapper)
    -   **UI**: TailwindCSS, ShadCN UI
    -   **State/Caching**: React Query
-   **Backend**:
    -   Django 5.0, Django REST Framework (DRF)
    -   **Database**: PostgreSQL (Production) / SQLite (Dev)
    -   **Auth**: SimpleJWT
-   **Reporting**: ReportLab (Backend PDF), @react-pdf/renderer (Frontend PDF)

## 📋 Prerequisites

-   Python 3.10+
-   Node.js 18+
-   PostgreSQL (Recommended)

## ⚙️ Setup Instructions

### 1. Backend Setup

1.  Navigate to the project root:
    ```bash
    cd "Fit Flow - PWA"
    ```
2.  Create virtual environment:
    ```bash
    python -m venv .venv
    .venv\Scripts\activate  # Windows
    # source .venv/bin/activate  # Mac/Linux
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Database**:
    -   Create a `.env` file in the root.
    -   Add your PostgreSQL connection string:
        ```env
        DATABASE_URL=postgres://user:password@localhost:5432/fit_flow_db
        ```
    -   *If using SQLite (simple local dev), you can skip this.*
5.  Run migrations:
    ```bash
    python manage.py migrate
    ```
6.  Start the server:
    ```bash
    python manage.py runserver
    ```

### 2. Frontend Setup

1.  Navigate to frontend:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start development server:
    ```bash
    npm run dev
    ```

## 📱 Using the PWA (Offline Mode)

1.  Open the app in Chrome/Edge on your mobile or desktop.
2.  Click the **"Install"** icon in the address bar.
3.  Go offline (turn off WiFi).
4.  Create an inspection and click **Submit**.
    -   The app will detect you are offline.
    -   It will save the data to the browser's internal database.
    -   It will generate and download the PDF immediately.
5.  When back online, you will see a **"Pending Uploads"** badge in the header.
6.  Click **"Sync Now"** to upload all offline data to the server.

## 📂 Project Structure

-   `qc/`: Django app for Inspections, Final Inspections, and Master Data.
-   `frontend/src/pages/`:
    -   `EvaluationForm.tsx`: Dev sample inspection logic.
    -   `FinalInspections.tsx`: AQL shipment audit logic.
-   `frontend/src/components/SyncManager.tsx`: Logic for syncing offline data.
-   `frontend/src/lib/db.ts`: Dexie.js schema definition.
