import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import API handlers (tsx allows importing .ts extensions or without)
import analyzeHandler from './api/analyze.js';
import historyHandler from './api/history.js';
import debugGeminiHandler from './api/debug/gemini.js';
import signupHandler from './api/auth/signup.js';
import loginHandler from './api/auth/login.js';
import logoutHandler from './api/auth/logout.js';
import meHandler from './api/auth/me.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Built-in body parser equivalent to Vercel's automatic parsing
app.use(express.json({ limit: '10mb' })); 

// Log all incoming API requests (Debug Log #1 per user request)
app.use('/api', (req, res, next) => {
  console.log(`[Express] Received ${req.method} request at ${req.originalUrl}`);
  next();
});

// Adapter to connect Express req/res interfaces to VercelRequest/VercelResponse
const createVercelAdapter = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      // Pass the request directly. For basic headers/body/query, Vercel and Express match closely.
      await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
    } catch (error) {
      console.error('[Express Adapter] Unhandled Server Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  };
};

// Mount API Routes strictly tracking Vercel structure
app.all('/api/analyze', createVercelAdapter(analyzeHandler));
app.all('/api/history', createVercelAdapter(historyHandler));
// Removed admin routes
app.all('/api/debug/gemini', createVercelAdapter(debugGeminiHandler));

// Auth Routes
app.all('/api/auth/signup', createVercelAdapter(signupHandler));
app.all('/api/auth/login', createVercelAdapter(loginHandler));
app.all('/api/auth/logout', createVercelAdapter(logoutHandler));
app.all('/api/auth/me', createVercelAdapter(meHandler));

import bcrypt from 'bcryptjs';
import { supabaseServer, isSupabaseConfigured } from './api/lib/supabaseServer.js';

// Auto-seed default Admin account on server start
const seedAdminUser = async () => {
  if (!isSupabaseConfigured()) return;
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@satyakavach.ai';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234!';

    const { data: existingAdmin } = await supabaseServer
      .from('users_custom')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle();

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const { error } = await supabaseServer.from('users_custom').insert({
        email: adminEmail,
        password_hash: passwordHash,
        role: 'admin'
      });
      if (!error) {
        console.log(`👑 [Admin Seed] Default Admin Account Created: ${adminEmail} (Password: ${adminPassword})`);
      }
    }
  } catch (err: any) {
    console.error('[Admin Seed] Warning during admin user seed:', err.message || err);
  }
};

app.listen(PORT, async () => {
  const isKeyLoaded = !!process.env.GEMINI_API_KEY;
  await seedAdminUser();

  console.log(`\n=========================================`);
  console.log(`🚀 [Local Server] Backend API Running!    `);
  console.log(`🔗 URL: http://localhost:${PORT}          `);
  console.log(`👑 Admin Email: admin@satyakavach.ai       `);
  console.log(`👑 Admin Pass:  Admin1234!                `);
  console.log(`🔑 GEMINI_API_KEY: ${isKeyLoaded ? '✅ Detected (Server-side Protected)' : '❌ MISSING (Check .env)'}`);
  console.log(`=========================================\n`);
});

