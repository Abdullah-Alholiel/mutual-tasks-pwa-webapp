# Production Setup Guide for Momentum PWA

This guide covers setting up Momentum for production deployment with all production-grade features enabled.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Sentry Error Tracking](#sentry-error-tracking)
3. [Security Headers](#security-headers)
4. [Build Optimization](#build-optimization)
5. [PWA Configuration](#pwa-configuration)
6. [Deployment](#deployment)

---

## Environment Variables

### Required Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Sentry (Optional but recommended)
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_APP_URL=https://momentum.app

# For build-time Sentry features (source maps)
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project

# Email Service
MailJet_API_Key=your-mailjet-api-key
MailJet_API_Secret=your-mailjet-api-secret

# AI Service Webhooks
N8N_DESCRIPTION_WEBHOOK_URL=https://your-n8n-instance/webhook/...
N8N_PROJECT_WEBHOOK_URL=https://your-n8n-instance/webhook/...
x_momentum_secret=your-webhook-secret
```

---

## Sentry Error Tracking

### Setup Instructions

1. **Create Sentry Account**
   - Go to https://sentry.io/
   - Sign up or log in
   - Create a new project
   - Select "React" as the platform

2. **Get Configuration**
   - Navigate to Project Settings → Client Keys (DSN)
   - Copy the DSN URL
   - Navigate to Project Settings → Auth Tokens
   - Create a new auth token (required for source map uploads)

3. **Configure Application**
   - Set `VITE_SENTRY_DSN` in your environment
   - For production deployments, set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

4. **Verify Integration**

The Sentry integration automatically:
- Captures unhandled JavaScript errors
- Tracks React component errors via Error Boundary
- Records error context (user info, component stack traces)
- Filters non-actionable errors (network failures, chunk load errors)

### Features

- ✅ Automatic error capturing in production
- ✅ React Error Boundary integration
- ✅ User context tracking
- ✅ Source map support (requires auth token)
- ✅ Performance monitoring (10% sample rate)
- ✅ Error filtering (ignores network failures, chunk errors)

---

## Security Headers

The `netlify.toml` includes production-ready security headers:

### Header Configuration

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "..."
```

### Security Features

- **Clickjacking Protection**: `X-Frame-Options: DENY`
- **MIME Sniffing Protection**: `X-Content-Type-Options: nosniff`
- **XSS Protection**: `X-XSS-Protection: 1; mode=block`
- **Referrer Control**: `Referrer-Policy: strict-origin-when-cross-origin`
- **Permission Controls**: Restricts access to camera, microphone, geolocation
- **Content Security Policy**: Comprehensive CSP with allowlisted origins

---

## Build Optimization

### Code Splitting

The application is configured with intelligent code splitting into vendor chunks:

- `react-vendor` - React and ReactDOM
- `router-vendor` - React Router
- `query-vendor` - React Query
- `supabase-vendor` - Supabase client
- `ui-vendor` - Radix UI components
- `animations-vendor` - Framer Motion
- `utils-vendor` - Date utilities, Zod
- `validation-vendor` - Validation libraries
- `tailwind-vendor` - Tailwind utilities

### Bundle Analysis

Analyze your bundle size:

```bash
npm run build:analyze
```

This generates `dist/bundle-analysis.html` with a visual breakdown of your bundle.

### Build Output

```bash
npm run build
```

Production build includes:
- ✅ Code splitting (8 vendor chunks + main bundle)
- ✅ Terser minification
- ✅ Source maps (hidden)
- ✅ Console log removal in production
- ✅ PWA manifest and service worker
- ✅ Sentry source maps (if configured)

### Performance Targets

- Main bundle: < 500KB (gzipped)
- Total bundle: < 1MB (gzipped)
- Time to Interactive: < 3s
- First Contentful Paint: < 1.5s

---

## PWA Configuration

### Manifest Configuration

Located in `vite.config.ts`, the PWA manifest includes:

- App name, short name, description
- Icons: 48px to 512px sizes
- Theme color: #0EA5E9
- Display mode: standalone
- Categories: productivity, social
- Screenshots for app store listing

### Service Worker

- **Update Strategy**: Auto-update with `skipWaiting` and `clientsClaim`
- **Caching Strategy**:
  - Precache: All static assets (JS, CSS, HTML, images, icons)
  - Runtime: Google Fonts (1 year cache)
  - OneSignal SW files excluded from precaching
- **Update Detection**: Every 5 minutes + visibility/focus events
- **Offline Support**: Full navigation fallback to `index.html`

### Update Notification

A non-intrusive banner appears when updates are available:

- Location: Fixed at bottom of screen
- Features: Dismiss, Update Now buttons
- User Choice: Can be ignored until next check
- Design: Blurred backdrop with primary accents

---

## Deployment

### Netlify Deployment

1. **Connect Repository**
   - Link your Git repository to Netlify
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
     - Functions directory: `netlify/functions`

2. **Environment Variables**
   - Add all required environment variables to Netlify
   - Use different values for preview/production branches

3. **Deploy**
   - Push to your main branch
   - Netlify automatically builds and deploys

### Environment-Specific Configuration

**Development:**
- Service worker disabled
- Sentry disabled (no DSN required)
- Console logs enabled
- Source maps full

**Production:**
- Service worker enabled
- Sentry enabled (requires DSN)
- Console logs removed
- Source maps hidden
- Security headers enabled

---

## Monitoring & Maintenance

### Health Checks

- Run tests: `npm run test:run`
- Build verification: `npm run build`
- Bundle analysis: `npm run build:analyze`
- Lint check: `npm run lint`

### Performance Monitoring

1. Sentry provides error tracking and performance metrics
2. Use Chrome DevTools → Lighthouse for PWA audit
3. Monitor bundle sizes with build analysis

### Update Process

1. Deploy new version
2. Service worker detects update (within 5 minutes or on page focus)
3. User sees update banner
4. User clicks "Update Now" → Page reloads
5. New version activated

---

## Troubleshooting

### Build Issues

**Bundle too large:**
- Run `npm run build:analyze`
- Identify large chunks
- Use lazy loading for routes: `lazy(() => import('./Page'))`

**TypeScript errors:**
- Ensure strict mode settings are appropriate
- Check for missing type definitions
- Review tsconfig.app.json settings

### PWA Issues

**Service worker not registering:**
- Ensure HTTPS in production
- Check service worker scope
- Verify manifest.json is accessible

**Updates not detected:**
- Check workbox configuration
- Verify skipWaiting and clientsClaim are enabled
- Review browser console for SW errors

### Sentry Issues

**No events in Sentry:**
- Verify VITE_SENTRY_DSN is set
- Check production build
- Review beforeSend filter configuration

**Source maps not uploading:**
- Set SENTRY_AUTH_TOKEN environment variable
- Verify SENTRY_ORG and SENTRY_PROJECT are correct
- Check Vite build logs for upload errors

---

## Checklist

Before deploying to production:

- [ ] All environment variables set in production
- [ ] Sentry DSN configured
- [ ] Security headers reviewed
- [ ] Build completes without errors
- [ ] All tests passing (`npm run test:run`)
- [ ] Lint passes (`npm run lint`)
- [ ] Bundle size analysis reviewed
- [ ] PWA manifest verified
- [ ] Service worker testing in production browser
- [ ] Error tracking confirmed working
- [ ] Performance metrics acceptable

---

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Netlify Documentation](https://docs.netlify.com/)
