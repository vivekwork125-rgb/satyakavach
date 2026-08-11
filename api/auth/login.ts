import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseServer, isSupabaseConfigured } from '../lib/supabaseServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isSupabaseConfigured()) {
      return res.status(500).json({
        error: 'Supabase URL and Keys are not set yet. Please paste your real Supabase URL and keys into your .env file.'
      });
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timed out. Please verify your SUPABASE_URL in .env')), 10000)
    );

    const loginLogic = async () => {
      // Lookup user
      const { data: user, error: checkError } = await supabaseServer
        .from('users_custom')
        .select('id, email, password_hash, role')
        .eq('email', email)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          throw new Error('Invalid email or password');
        }
        const errMsg = checkError.message || JSON.stringify(checkError);
        if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || checkError.details?.includes('ENOTFOUND')) {
          throw new Error(`Invalid Supabase URL: Could not reach host "${process.env.SUPABASE_URL}". Please check your SUPABASE_URL in your .env file.`);
        }
        if (checkError.code === 'PGRST205' || errMsg.includes('users_custom')) {
          throw new Error("Table 'users_custom' does not exist in your Supabase project. Please run setup_db.sql in your Supabase SQL Editor.");
        }
        console.error('Database query error:', checkError);
        throw new Error('Database error during login: ' + errMsg);
      }

      return user;
    };

    const user = await Promise.race([loginLogic(), timeoutPromise]) as any;

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET || 'fallback_development_secret_only';
    const token = jwt.sign(
      { uid: user.id, email: user.email, admin: user.role === 'admin' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      token
    });

  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

