import express from 'express';
import cors from 'cors';
import { initDatabase, ensureDatabaseReady, waitForPendingWrites } from './db.js';
import { authRouter } from './routes/auth.js';
import { portalRouter } from './routes/portal.js';
import { servantsRouter } from './routes/servants.js';
import { servicesRouter } from './routes/services.js';
import { attendanceRouter } from './routes/attendance.js';
import { usersRouter } from './routes/users.js';
import { auditRouter } from './routes/audit.js';
import { reportsRouter } from './routes/reports.js';
import { scannerRouter } from './routes/scanner.js';
import { meetingsRouter } from './routes/meetings.js';
import { syncRouter } from './routes/sync.js';
import { superAdminRouter } from './routes/superAdmin.js';
import { tenantRouter } from './routes/tenant.js';

export function createExpressApp() {
  // Ensure DB initialized
  initDatabase();

  const app = express();

  // CORS Configuration: Restrict to trusted production origins and local development
  const trustedProductionOrigins = new Set([
    'https://ais-dev-gap63qdklixgujaxjsaf2d-823561301326.europe-west2.run.app',
    'https://ais-pre-gap63qdklixgujaxjsaf2d-823561301326.europe-west2.run.app',
    process.env.APP_URL,
  ].filter(Boolean) as string[]);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. same-origin navigations, server-side fetch)
        if (!origin) return callback(null, true);

        // Allow localhost origins in development
        if (process.env.NODE_ENV !== 'production') {
          if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
          }
        }

        // Allow explicitly configured trusted origins
        if (trustedProductionOrigins.has(origin)) {
          return callback(null, true);
        }

        // Allow subdomains on Cloud Run for this application deployment
        if (/^https:\/\/ais-(dev|pre)-[a-z0-9-]+-\d+\.[a-z0-9-]+\.run\.app$/.test(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Blocked by CORS policy: Origin not allowed'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Ensure Cloud Firestore is synced before handling requests on serverless (Vercel)
  app.use(async (_req, res, next) => {
    try {
      await ensureDatabaseReady();
    } catch (e) {
      console.warn('Database readiness warning:', e);
    }

    // Intercept res.json and res.send to ensure Firestore write completes before serverless lambda execution freezes
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body: any) {
      waitForPendingWrites().finally(() => {
        originalJson(body);
      });
      return res;
    };

    res.send = function (body: any) {
      waitForPendingWrites().finally(() => {
        originalSend(body);
      });
      return res;
    };

    next();
  });

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/portal', portalRouter);
  app.use('/api/servants', servantsRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/scanner', scannerRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/super-admin', superAdminRouter);
  app.use('/api/tenant', tenantRouter);

  return app;
}
