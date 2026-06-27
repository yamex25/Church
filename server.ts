import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Firebase Admin initialization ────────────────────────────────────────────
// Supports both a service-account JSON file and Application Default Credentials.
function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;
  try {
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (saPath) {
      const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Fall back to Application Default Credentials (Cloud Run, etc.)
      admin.initializeApp();
    }
    console.log('Firebase Admin SDK initialized');
  } catch (err) {
    console.warn('Firebase Admin SDK not configured — API auth middleware disabled:', err);
  }
}
initFirebaseAdmin();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  uid?: string;
  churchId?: string;
  role?: string;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Verifies the Firebase ID token in the Authorization header.
 * Attaches uid, churchId, and role to the request object.
 * Returns 401 if the token is missing or invalid.
 */
async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (admin.apps.length === 0) {
    // Admin not configured — pass through (dev mode without service account)
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;

    // churchId and role must come from Firestore (custom claims not used here)
    const userSnap = await admin.firestore().collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      res.status(403).json({ error: 'User profile not found' });
      return;
    }
    const data = userSnap.data()!;
    req.churchId = data.churchId || '';
    req.role = data.role || '';
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role enforcement middleware factory.
 * Pass the minimum required role level.
 */
function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (admin.apps.length === 0) { next(); return; }
    if (!req.role || !allowedRoles.includes(req.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Ensures the request is operating within the caller's own church.
 * Reads churchId from req.body.churchId or req.query.churchId and
 * verifies it matches the authenticated caller's churchId.
 */
function requireOwnChurch(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (admin.apps.length === 0) { next(); return; }
  const requested =
    (req.body as Record<string, unknown>)?.churchId as string | undefined ||
    (req.query.churchId as string | undefined);
  if (requested && requested !== req.churchId) {
    res.status(403).json({ error: 'Cross-church access denied' });
    return;
  }
  next();
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check (public)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Authenticated API routes ─────────────────────────────────────────────

  // Bulk SMS simulation — any authenticated church member
  app.post(
    '/api/sms/send',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN'),
    requireOwnChurch,
    (req: AuthenticatedRequest, res) => {
      const { recipients, message } = req.body as { recipients: string[]; message: string };
      console.log(`SMS [church=${req.churchId}] to ${recipients.length} recipients: ${message?.slice(0, 40)}`);
      res.json({ success: true, sent: recipients.length });
    },
  );

  // User role management (SUPER_ADMIN only)
  app.patch(
    '/api/users/:targetUid/role',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN'),
    async (req: AuthenticatedRequest, res) => {
      if (admin.apps.length === 0) {
        res.status(503).json({ error: 'Admin SDK not available' });
        return;
      }

      const { targetUid } = req.params;
      const { role } = req.body as { role: string };

      const allowed = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MEMBER'];
      if (!allowed.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      // SUPER_ADMIN can assign any role; ADMIN cannot promote to SUPER_ADMIN
      if (req.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Only SUPER_ADMIN can promote to SUPER_ADMIN' });
        return;
      }

      try {
        const targetSnap = await admin.firestore().collection('users').doc(targetUid).get();
        if (!targetSnap.exists || targetSnap.data()?.churchId !== req.churchId) {
          res.status(404).json({ error: 'User not found in your church' });
          return;
        }
        await admin.firestore().collection('users').doc(targetUid).update({ role });
        res.json({ success: true, uid: targetUid, role });
      } catch (err) {
        res.status(500).json({ error: 'Failed to update role' });
      }
    },
  );

  // ── Member account management ────────────────────────────────────────────

  // Disable a Firebase Auth account
  app.post(
    '/api/auth/disable-user',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OWNER'),
    requireOwnChurch,
    async (req: AuthenticatedRequest, res) => {
      if (admin.apps.length === 0) {
        res.status(503).json({ error: 'Admin SDK not available' });
        return;
      }
      const { targetUid, churchId } = req.body as { targetUid: string; churchId: string };
      if (!targetUid) {
        res.status(400).json({ error: 'targetUid is required' });
        return;
      }
      try {
        const targetSnap = await admin.firestore().collection('users').doc(targetUid).get();
        if (!targetSnap.exists || targetSnap.data()?.churchId !== (churchId || req.churchId)) {
          res.status(404).json({ error: 'User not found in your church' });
          return;
        }
        await admin.auth().updateUser(targetUid, { disabled: true });
        await admin.firestore().collection('users').doc(targetUid).update({ accountStatus: 'disabled' });
        res.json({ success: true });
      } catch (err) {
        console.error('disable-user error:', err);
        res.status(500).json({ error: 'Failed to disable user' });
      }
    },
  );

  // Re-enable a Firebase Auth account
  app.post(
    '/api/auth/enable-user',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OWNER'),
    requireOwnChurch,
    async (req: AuthenticatedRequest, res) => {
      if (admin.apps.length === 0) {
        res.status(503).json({ error: 'Admin SDK not available' });
        return;
      }
      const { targetUid, churchId } = req.body as { targetUid: string; churchId: string };
      if (!targetUid) {
        res.status(400).json({ error: 'targetUid is required' });
        return;
      }
      try {
        const targetSnap = await admin.firestore().collection('users').doc(targetUid).get();
        if (!targetSnap.exists || targetSnap.data()?.churchId !== (churchId || req.churchId)) {
          res.status(404).json({ error: 'User not found in your church' });
          return;
        }
        await admin.auth().updateUser(targetUid, { disabled: false });
        await admin.firestore().collection('users').doc(targetUid).update({ accountStatus: 'active' });
        res.json({ success: true });
      } catch (err) {
        console.error('enable-user error:', err);
        res.status(500).json({ error: 'Failed to enable user' });
      }
    },
  );

  // Delete a Firebase Auth account and their Firestore user doc
  app.delete(
    '/api/auth/delete-user',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OWNER'),
    requireOwnChurch,
    async (req: AuthenticatedRequest, res) => {
      if (admin.apps.length === 0) {
        res.status(503).json({ error: 'Admin SDK not available' });
        return;
      }
      const { targetUid, churchId } = req.body as { targetUid: string; churchId: string };
      if (!targetUid) {
        res.status(400).json({ error: 'targetUid is required' });
        return;
      }
      try {
        const targetSnap = await admin.firestore().collection('users').doc(targetUid).get();
        if (!targetSnap.exists || targetSnap.data()?.churchId !== (churchId || req.churchId)) {
          res.status(404).json({ error: 'User not found in your church' });
          return;
        }
        await admin.auth().deleteUser(targetUid);
        await admin.firestore().collection('users').doc(targetUid).delete();
        res.json({ success: true });
      } catch (err) {
        console.error('delete-user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
      }
    },
  );

  // Create a new Firebase Auth user + Firestore user doc
  app.post(
    '/api/auth/create-member',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OWNER'),
    requireOwnChurch,
    async (req: AuthenticatedRequest, res) => {
      if (admin.apps.length === 0) {
        res.status(503).json({ error: 'Admin SDK not available' });
        return;
      }
      const { email, displayName, churchId, role } = req.body as {
        email: string;
        displayName: string;
        churchId: string;
        role?: string;
      };
      if (!email || !displayName) {
        res.status(400).json({ error: 'email and displayName are required' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email address' });
        return;
      }
      try {
        const newUser = await admin.auth().createUser({
          email,
          displayName,
          emailVerified: false,
        });
        const newUid = newUser.uid;
        const now = admin.firestore.FieldValue.serverTimestamp();
        await admin.firestore().collection('users').doc(newUid).set({
          uid: newUid,
          email,
          displayName,
          role: role || 'MEMBER',
          churchId: churchId || req.churchId,
          accountStatus: 'pending',
          createdAt: now,
          createdBy: req.uid,
        });
        const passwordResetLink = await admin.auth().generatePasswordResetLink(email);
        res.json({ success: true, uid: newUid, passwordResetLink });
      } catch (err: unknown) {
        console.error('create-member error:', err);
        const message = err instanceof Error ? err.message : 'Failed to create member';
        res.status(500).json({ error: message });
      }
    },
  );

  // Send password reset link for a user
  app.post(
    '/api/auth/reset-password',
    requireAuth,
    requireRole('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OWNER'),
    requireOwnChurch,
    async (req: AuthenticatedRequest, res) => {
      if (admin.apps.length === 0) {
        res.status(503).json({ error: 'Admin SDK not available' });
        return;
      }
      const { email, churchId } = req.body as { email: string; churchId?: string };
      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }
      try {
        // If churchId provided, verify the email belongs to a user in the same church
        if (churchId || req.churchId) {
          const usersSnap = await admin
            .firestore()
            .collection('users')
            .where('email', '==', email)
            .where('churchId', '==', churchId || req.churchId)
            .limit(1)
            .get();
          if (usersSnap.empty) {
            res.status(404).json({ error: 'No user with that email found in your church' });
            return;
          }
        }
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        res.json({ success: true, resetLink });
      } catch (err: unknown) {
        console.error('reset-password error:', err);
        const message = err instanceof Error ? err.message : 'Failed to generate password reset link';
        res.status(500).json({ error: message });
      }
    },
  );

  // ── Vite / static serving ────────────────────────────────────────────────

  if (process.env.NODE_ENV !== 'production') {
    console.log('Configuring Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Serving static production files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> SERVER READY AT http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('BOOTSTRAP ERROR:', err);
  process.exit(1);
});
