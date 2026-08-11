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

    // Advanced Email Regex (RFC 5322 standard compatible, supports new TLDs)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Wrap database calls with a 10-second timeout safeguard to prevent infinite loading spinners
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timed out. Please verify your SUPABASE_URL in .env')), 10000)
    );

    const signupLogic = async () => {
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabaseServer
        .from('users_custom')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Database check error:', checkError);
        const errMsg = checkError.message || JSON.stringify(checkError);
        if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || checkError.details?.includes('ENOTFOUND')) {
          throw new Error(`Invalid Supabase URL: Could not reach host "${process.env.SUPABASE_URL}". Please check your SUPABASE_URL in your .env file.`);
        }
        if (checkError.code === 'PGRST205' || errMsg.includes('users_custom')) {
          throw new Error("Table 'users_custom' does not exist in your Supabase project. Please run setup_db.sql in your Supabase SQL Editor.");
        }
        throw new Error('Database check failed: ' + errMsg);
      }

      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user
      const { data: newUser, error: insertError } = await supabaseServer
        .from('users_custom')
        .insert([
          { 
            email: email, 
            password_hash: passwordHash, 
            role: email === 'admin@satyakavach.ai' ? 'admin' : 'user' 
          }
        ])
        .select('id, email, role')
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        const errMsg = insertError.message || JSON.stringify(insertError);
        if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || insertError.details?.includes('ENOTFOUND')) {
          throw new Error(`Invalid Supabase URL: Could not reach host "${process.env.SUPABASE_URL}". Please check your SUPABASE_URL in your .env file.`);
        }
        throw new Error('Failed to create user: ' + errMsg);
      }

      return newUser;
    };

    const newUser = await Promise.race([signupLogic(), timeoutPromise]) as any;

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET || 'fallback_development_secret_only';
    const token = jwt.sign(
      { uid: newUser.id, email: newUser.email, admin: newUser.role === 'admin' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account created successfully',
      user: { id: newUser.id, email: newUser.email, role: newUser.role },
      token
    });

  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

