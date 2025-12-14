🏢 Smart Workforce Attendance – Backend

This is the backend service for the Smart Workforce Attendance SaaS platform, built using NestJS, Prisma, and PostgreSQL.
It provides authentication, multi-tenant company management, and the foundation for attendance, roster, and payroll features.

🚀 Tech Stack

Node.js (v18 or v20 – LTS recommended)

NestJS

Prisma ORM

PostgreSQL

JWT Authentication

TypeScript

📁 Project Structure
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── auth/
│   ├── companies/
│   ├── users/
│   ├── prisma/
│   └── common/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md

✅ Prerequisites

Make sure you have the following installed:

Node.js (v18 or v20)

node -v


PostgreSQL (v14+)

Git

npm

⚠️ Node v22 is NOT recommended (can cause NestJS/Prisma issues)

📥 Clone the Repository
git clone https://github.com/your-username/smart-workforce-attendance-backend.git
cd smart-workforce-attendance-backend

📦 Install Dependencies
npm install


🗄️ Database Setup
1️⃣ Create PostgreSQL Database

Using psql:

psql -U postgres
CREATE DATABASE attendance_saas;
\q


Or use pgAdmin / DBeaver GUI.

2️⃣ Generate Prisma Client
npx prisma generate

3️⃣ Run Database Migrations
npx prisma migrate dev --name init


This will:

Create all database tables

Apply schema changes

Generate Prisma client

(Optional) View Database via Prisma Studio
npx prisma studio


Opens at:

http://localhost:5555

▶️ Run the Backend Server
Development Mode (recommended)
npm run start:dev


Server will start at:

http://localhost:3000/api

🔑 Default Super Admin Account

On first startup, the backend automatically creates a Super Admin user:

Email: admin@root.saas
Password: Admin123!

🧪 API Testing (Postman / Thunder Client)
Login

POST /api/auth/login

{
  "email": "admin@root.saas",
  "password": "Admin123!"
}


Response includes:

accessToken

refreshToken

Access Protected Routes

Add this header:

Authorization: Bearer <accessToken>


Example:

GET /api/companies

🧰 Useful Scripts
Command	Description
npm run start:dev	Run backend in dev mode
npm run build	Build production bundle
npm run start:prod	Run production build
npx prisma studio	Open database GUI
npx prisma migrate dev	Run DB migrations
🛠️ Common Issues & Fixes
❌ psql: command not found

✔ Add PostgreSQL bin folder to PATH
✔ Or use pgAdmin

❌ Cannot find module dist/main

✔ Use npm run start:dev
✔ Ensure Node v18 or v20
✔ Avoid folder names with spaces

❌ Prisma schema not found

✔ Ensure schema exists at:

/prisma/schema.prisma


(Not inside src)

📌 Next Roadmap

Attendance & Check-in module

Roster & Auto Scheduling

Leave & Payroll Calculation

Mobile API endpoints

Swagger API documentation

👨‍💻 Author

Smart Workforce Attendance
SaaS platform for workforce management & attendance tracking.