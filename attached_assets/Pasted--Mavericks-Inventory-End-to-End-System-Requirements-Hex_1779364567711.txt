# Mavericks Inventory: End-to-End System Requirements (Hexaware Perspective)

This document outlines the exhaustive, end-to-end requirements for the Mavericks Inventory platform. It bridges the rigid compliance requirements of a service-based IT company (Hexaware) with cutting-edge GenAI automation.

## 1. User Roles & Role-Based Access Control (RBAC)
Strict segregation of duties (Maker-Checker) must be enforced across the platform.

*   **Executive (Maker):** 
    *   Uploads bulk stock master data via Excel.
    *   Creates, updates, and deletes stock items (only in Draft state).
    *   Initiates single or bulk stock distribution transactions.
    *   Submits transactions for approval.
    *   Views approval status and checker remarks.
*   **Manager (Checker / First-Level Approver):**
    *   Reviews submitted stock transactions.
    *   Approves or rejects requests (rejections require mandatory remarks).
    *   Views audit trails and stock movement history.
    *   Cannot create or initiate stock requests (Strict Maker-Checker separation).
*   **Management Authority (Second-Level Approver - Configurable):**
    *   Acts as the final approval authority for high-volume or high-risk requests.
*   **System Administrator:**
    *   Creates and manages users, roles, and organizational hierarchies.
    *   Configures workflow rules (e.g., threshold for 2nd level approval).
    *   Has access to full system audit logs.

---

## 2. Master Data Management & Data Ingestion
How the system ingests and maintains core inventory data (e.g., Laptops, Servers, Licenses).

*   **Bulk Excel Upload (Capacity: 50,000 rows):**
    *   Mandatory column validation (Stock Code, Name, Category, UoM, Opening Qty).
    *   Data type validation and duplicate stock code detection.
    *   **Success state:** Valid records are saved in "Draft" state.
    *   **Fail state:** Invalid records are rejected. The system generates a downloadable error report detailing exactly which rows/columns failed.
*   **CRUD Operations & Deletion Rules:**
    *   Create single items via a UI form.
    *   Update existing item details.
    *   **NO HARD DELETES:** Soft/Logical deletes only for master data.
    *   **Constraint:** The system absolutely prevents the deletion of any stock item that has an existing transactional history.

---

## 3. Stock Distribution & Transaction Engine
The core engine handling the movement of IT assets to projects or employees.

*   **Entry Methods:** Single UI form entry OR Bulk Excel upload.
*   **Mandatory Data Points:** Stock Item Code/Name, Quantity Distributed, Distribution Date, Recipient/Location (e.g., Employee ID, Project Code), Purpose/Remarks.
*   **State Machine (Transaction Flow):** 
    *   `Draft` ➔ `Submitted` ➔ `Approved` OR `Rejected`
*   **Edit / Update / Delete Constraints:**
    *   *Edit Distribution:* Allowed ONLY in Draft or Rejected state.
    *   *Delete Distribution:* Allowed ONLY in Draft state.
    *   *Stock Quantity Update:* System deducts from available stock ONLY upon final approval. No impact occurs upon rejection.
    *   *Prevention:* System strictly prevents any distribution request that exceeds the currently available stock.

---

## 4. The Maker-Checker Approval Workflow
The compliance backbone of the system.

*   **Mandatory Level 1:** At least one Manager must approve every transaction.
*   **Optional Level 2:** Configurable threshold (e.g., requests > 50 laptops go to Management Authority).
*   **Rejection Loop:** If rejected, the transaction returns to the Executive with mandatory remarks. The Executive can correct and resubmit.
*   **Performance SLA:** Approval actions must be processed by the system within 3 seconds.

---

## 5. Auditability, Compliance & Traceability
To pass Hexaware's internal IT and ISO audits, tracking must be flawless.

*   **Immutable Logs:** No hard deletes permitted for transactional data.
*   **Granular Tracking:** Every transaction must record:
    *   Created by & Created Date/Time
    *   Submitted by & Submitted Date/Time
    *   Approved/Rejected by & Date/Time
    *   Complete approval history and remarks trail.
*   **Stock Ledger:** A complete, unalterable movement ledger per stock item (In, Out, Balance).

---

## 6. AI & Agentic Automation Layer (The "Mavericks" Differentiator)
This is how manual work is eliminated using GenAI.

*   **Agent 1: Data Ingestion & Self-Healing Agent**
    *   *Action:* When an Executive uploads a messy Excel file, this agent intercepts it.
    *   *Value:* Instead of rejecting the file for minor issues (like date formats), it autonomously corrects them. For hard failures, it generates a natural-language error report (e.g., "Row 15 is missing the Recipient ID") rather than a cryptic SQL error.
*   **Agent 2: Intelligent Approval Assist (Risk Scoring Engine)**
    *   *Action:* Analyzes every submitted distribution request against historical data and user profiles.
    *   *Value:* Generates a "Risk Score" (Low, Med, High) and an auto-recommendation for the Manager. E.g., *"Recommend Approval: Standard request of 1 laptop for new joiner ID 12345"* or *"Flag for Review: Requesting 10 AWS licenses for a project that historically uses Azure."* Reduces Manager decision fatigue.
*   **Agent 3: Autonomous Anomaly Detection (Background Monitor)**
    *   *Action:* Continuously monitors the stock ledger for deviations without human prompting.
    *   *Value:* Alerts admins on the dashboard in real-time. E.g., *"Anomaly Detected: 40% of Chennai office monitor inventory depleted in 48 hours."* Proactively catches rogue allocations before an audit.
*   **Agent 4: Conversational Insights Agent (Reporting)**
    *   *Action:* An NLP interface for executives and managers.
    *   *Value:* Users can type *"Generate a report of all rejected laptop requests this month"* and the agent converts this to SQL, queries the DB, and generates the report instantly, eliminating the need to manually construct filters.

---

## 7. Reporting & Dashboards
*   **Standard Reports:** Current Stock Availability, Distributed Stock, Pending Approvals, Approval History, Stock Movement Ledger.
*   **Export:** All reports and grids must be exportable to Excel and PDF.
*   **UI/UX:** Dashboard must feature real-time health indicators (Color coded: Green/Yellow/Red) based on the AI Anomaly agent's findings.

---

## 8. Non-Functional Requirements (NFRs)
*   **Security:** Segregation of duties, Secure API endpoints, encrypted Excel file handling.
*   **Availability:** 99.5% Uptime.
*   **Performance:** Excel uploads of 50k rows must process efficiently; UI must remain responsive; AI agent calls must not block standard deterministic business logic (Use async processing for AI).
*   **Resilience:** If the AI API (Azure OpenAI) fails or times out, the system must seamlessly fall back to standard, rule-based operations so work is not blocked.
