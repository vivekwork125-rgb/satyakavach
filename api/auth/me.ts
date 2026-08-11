import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { supabaseServer, isSupabaseConfigured } from '../lib/supabaseServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!isSupabaseConfigured()) {
      return res.status(401).json({ error: 'Supabase unconfigured' });
    }

    const authHeader = req.headers.authorization || (req.headers.Authorization as string);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split('Bearer ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'fallback_development_secret_only';

    // Verify the JWT token
    const decoded = jwt.verify(token, jwtSecret) as { uid: string; email: string; admin: boolean };

    // 3-second DB query timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 3000)
    );

    const dbQuery = async () => {
      const { data: user, error } = await supabaseServer
        .from('users_custom')
        .select('id, email, role')
        .eq('id', decoded.uid)
        .single();
      if (error || !user) throw new Error('User not found');
      return user;
    };

    const user = await Promise.race([dbQuery(), timeoutPromise]) as any;

    return res.status(200).json({
      user: { id: user.id, email: user.email, role: user.role }
    });

  } catch (err: any) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

