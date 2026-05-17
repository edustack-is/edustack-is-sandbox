import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { DatabaseService } from './database/database.service';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async getStatus() {
    let dbStatus = 'Disconnected';
    let dbError = null;

    try {
      // Simple query to verify connection
      await this.db.query('SELECT 1');
      dbStatus = 'Connected';
    } catch (err) {
      dbError = err.message;
    }

    // Build metadata baked into the Docker image at build time. Defaults to
    // "unknown" for local `npm run dev` (no Docker build args set).
    const commit = process.env.COMMIT_SHA || 'unknown';
    const commitShort = commit !== 'unknown' ? commit.slice(0, 7) : 'unknown';
    const buildTime = process.env.BUILD_TIME || 'unknown';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>EduStack Backend API</title>
            <style>
                body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f0f2f5; color: #1e293b; }
                .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
                .status { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 24px; }
                .status-ok { background: #dcfce7; color: #166534; }
                .status-error { background: #fee2e2; color: #991b1b; }
                h1 { margin-top: 0; color: #0f172a; font-size: 28px; }
                code { background: #f8fafc; padding: 4px 8px; border-radius: 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; color: #475569; border: 1px solid #e2e8f0; }
                .meta { display: grid; grid-template-columns: 160px 1fr; gap: 16px; margin-top: 8px; }
                .label { font-weight: bold; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
                .value { font-size: 15px; }
                hr { border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0; }
                .pulse { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; }
                .link-btn { display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background 0.2s; }
                .link-btn:hover { background: #4338ca; }
                @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
                .error-box { margin-top: 12px; padding: 12px; background: #fff1f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b; font-size: 12px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="status status-ok"><span class="pulse"></span> API IS ONLINE</div>
                <h1>EduStack Backend</h1>
                
                <div class="meta">
                    <div class="label">Environment:</div>
                    <div class="value"><code>${process.env.NODE_ENV || 'development'}</code></div>

                    <div class="label">Database Status:</div>
                    <div class="value" style="color: ${dbStatus === 'Connected' ? '#166534' : '#991b1b'}; font-weight: bold;">
                        ${dbStatus}
                    </div>

                    <div class="label">Runtime:</div>
                    <div class="value">Node.js ${process.version}</div>

                    <div class="label">Commit:</div>
                    <div class="value"><code title="${commit}">${commitShort}</code></div>

                    <div class="label">Build Time:</div>
                    <div class="value"><code>${buildTime}</code></div>
                </div>

                ${dbError ? `<div class="error-box">Database Error: ${dbError}</div>` : ''}

                <hr />
                
                <div style="display: flex; gap: 12px; align-items: center;">
                    <a href="/api/docs" class="link-btn">Open API Documentation</a>
                    <span style="color: #94a3b8; font-size: 13px;">(Swagger / OpenAPI 3.0)</span>
                </div>

                <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">
                    EduStack IS – Core API Service. For frontend application, visit <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}" style="color: #6366f1;">${process.env.CORS_ORIGIN || 'http://localhost:5173'}</a>.
                </p>
            </div>
        </body>
        </html>
    `;
  }
}
