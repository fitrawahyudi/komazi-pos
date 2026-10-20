import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache for latest release metadata to prevent GitHub rate-limits (cached for 2 minutes)
let cachedReleaseInfo = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000;

class DownloadController {
  /**
   * Helper to fetch latest release metadata from GitHub
   */
  async fetchLatestReleaseMeta() {
    const now = Date.now();
    if (cachedReleaseInfo && now - lastCacheTime < CACHE_TTL_MS) {
      return cachedReleaseInfo;
    }

    const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || '';
    const privateRepo = process.env.GITHUB_REPO || 'fitrawahyudi/komazi-pos';
    const publicReleaseRepo = process.env.GITHUB_RELEASE_REPO || 'fitrawahyudi/komazi-pos-releases';

    // 1. Try public release repo first (Solusi 2: completely public, no auth needed)
    try {
      const publicRes = await fetch(`https://api.github.com/repos/${publicReleaseRepo}/releases/latest`, {
        headers: {
          'User-Agent': 'Komazi-POS-Backend',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (publicRes.ok) {
        const release = await publicRes.json();
        const apkAsset = release.assets?.find((a) => a.name.endsWith('.apk'));
        if (apkAsset) {
          cachedReleaseInfo = {
            source: 'public_repo',
            repo: publicReleaseRepo,
            tagName: release.tag_name,
            name: release.name || release.tag_name,
            publishedAt: release.published_at,
            assetName: apkAsset.name,
            size: apkAsset.size,
            downloadCount: apkAsset.download_count,
            directDownloadUrl: apkAsset.browser_download_url,
            isPrivate: false,
          };
          lastCacheTime = now;
          return cachedReleaseInfo;
        }
      }
    } catch (err) {
      console.warn('[DownloadController] Failed checking public release repo:', err.message);
    }

    // 2. Try private repo with GitHub Token (Solusi 1: Private repo proxy)
    if (githubToken) {
      try {
        const privateRes = await fetch(`https://api.github.com/repos/${privateRepo}/releases/latest`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'User-Agent': 'Komazi-POS-Backend',
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (privateRes.ok) {
          const release = await privateRes.json();
          const apkAsset = release.assets?.find((a) => a.name.endsWith('.apk'));
          if (apkAsset) {
            cachedReleaseInfo = {
              source: 'private_repo',
              repo: privateRepo,
              tagName: release.tag_name,
              name: release.name || release.tag_name,
              publishedAt: release.published_at,
              assetId: apkAsset.id,
              assetName: apkAsset.name,
              size: apkAsset.size,
              downloadCount: apkAsset.download_count,
              isPrivate: true,
            };
            lastCacheTime = now;
            return cachedReleaseInfo;
          }
        }
      } catch (err) {
        console.warn('[DownloadController] Failed checking private release repo:', err.message);
      }
    }

    // 3. Fallback: check local disk file
    const localApkPaths = [
      path.resolve(__dirname, '../../../frontend/public/download/komazi-pos.apk'),
      path.resolve(__dirname, '../../uploads/apk/komazi-pos.apk'),
    ];

    for (const p of localApkPaths) {
      if (fs.existsSync(p)) {
        const stats = fs.statSync(p);
        cachedReleaseInfo = {
          source: 'local_disk',
          localPath: p,
          tagName: 'local-build',
          name: 'Komazi POS Local Build',
          publishedAt: stats.mtime.toISOString(),
          size: stats.size,
          isPrivate: false,
        };
        lastCacheTime = now;
        return cachedReleaseInfo;
      }
    }

    return null;
  }

  /**
   * GET /api/download/apk
   * Downloads the latest APK binary
   */
  async downloadLatestApk(req, res, next) {
    try {
      const meta = await this.fetchLatestReleaseMeta();

      // CASE A: Public release repo found -> Redirect to GitHub CDN directly
      if (meta && meta.source === 'public_repo' && meta.directDownloadUrl) {
        return res.redirect(meta.directDownloadUrl);
      }

      // CASE B: Private repo asset -> Fetch signed URL using GITHUB_TOKEN
      if (meta && meta.source === 'private_repo' && meta.assetId) {
        const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT;
        const assetApiUrl = `https://api.github.com/repos/${meta.repo}/releases/assets/${meta.assetId}`;

        // GitHub API redirects (302) to an AWS S3 pre-signed temporary link
        const assetRes = await fetch(assetApiUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'User-Agent': 'Komazi-POS-Backend',
            Accept: 'application/octet-stream',
          },
          redirect: 'manual',
        });

        // If redirect location provided, send client straight to S3 signed URL (zero backend load!)
        const s3Location = assetRes.headers.get('location');
        if (s3Location) {
          return res.redirect(s3Location);
        }

        // If streamed directly by GitHub API
        if (assetRes.ok && assetRes.body) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
          res.setHeader('Content-Disposition', 'attachment; filename="komazi-pos.apk"');
          if (meta.size) {
            res.setHeader('Content-Length', meta.size);
          }
          const reader = assetRes.body.getReader();
          const stream = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          };
          return stream();
        }
      }

      // CASE C: Local disk file fallback
      if (meta && meta.source === 'local_disk' && meta.localPath) {
        return res.download(meta.localPath, 'komazi-pos.apk');
      }

      // CASE D: Not found
      return res.status(404).json({
        success: false,
        message: 'Berkas APK Komazi POS belum tersedia di server.',
        help: 'Pastikan GITHUB_TOKEN telah diset di Railway, atau buat repo publik fitrawahyudi/komazi-pos-releases untuk rilis otomatis.',
      });
    } catch (error) {
      console.error('[DownloadController] Error downloading APK:', error);
      next(error);
    }
  }

  /**
   * GET /api/download/apk/info
   * Metadata endpoint for frontend
   */
  async getApkInfo(req, res, next) {
    try {
      const meta = await this.fetchLatestReleaseMeta();
      if (!meta) {
        return res.json({
          available: false,
          message: 'Belum ada APK yang dirilis.',
        });
      }

      res.json({
        available: true,
        version: meta.tagName,
        name: meta.name,
        sizeMb: meta.size ? (meta.size / (1024 * 1024)).toFixed(1) : '~19.1',
        publishedAt: meta.publishedAt,
        source: meta.source,
        downloadUrl: '/api/download/apk',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DownloadController();
