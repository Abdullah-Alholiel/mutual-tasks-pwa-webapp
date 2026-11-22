// L0 (run 24): pwaRegister must NOT start the service-worker install during
// the entrance-animation window. Contract: registration waits for true idle
// (capped), first interaction, or the no-requestIdleCallback timeout — and a
// hanging registerSW can still never block the page.
//
// 'virtual:pwa-register' is aliased in vitest.config.ts to
// tests/lib/__mocks__/pwa-register.ts; each test grabs the CURRENT stub
// instance after vi.resetModules() so assertions hit the module the source
// actually bound (the stub re-evaluates on reset).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

type StubModule = { registerSW: Mock };
type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

const REGISTER_RACE_MS = 8000;
const IDLE_CAP_MS = 2500;

const idleWindow = window as IdleWindow;
let ricCb: (() => void) | null = null;

function installNavigatorSW() {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {},
    configurable: true,
  });
}

function stubReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    value,
    configurable: true,
  });
}

function installRic() {
  idleWindow.requestIdleCallback = (cb: () => void) => {
    ricCb = cb;
    return 1;
  };
  idleWindow.cancelIdleCallback = vi.fn();
}

function fireIdle() {
  expect(ricCb).toBeTruthy();
  ricCb?.();
  ricCb = null;
}

const loadModule = async (): Promise<StubModule> => {
  vi.resetModules();
  await import('@/pwaRegister');
  return (await import('./__mocks__/pwa-register')) as StubModule;
};

beforeEach(() => {
  vi.useFakeTimers();
  installNavigatorSW();
  installRic();
  stubReadyState('complete');
  vi.stubEnv('PROD', true);
  ricCb = null;
});

afterEach(() => {
  // Flush any module instance still waiting on idle/interaction so its
  // listeners cannot leak into the next test's call counts.
  idleWindow.dispatchEvent(new Event('pointerdown'));
  ricCb?.();
  ricCb = null;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  delete (idleWindow as Partial<IdleWindow>).requestIdleCallback;
  delete (idleWindow as Partial<IdleWindow>).cancelIdleCallback;
});

describe('pwaRegister (L0 post-idle SW registration)', () => {
  it('registers via requestIdleCallback with immediate:false after load', async () => {
    const { registerSW } = await loadModule();
    expect(registerSW).not.toHaveBeenCalled();
    fireIdle();
    // Queue microtasks so the start() body runs.
    await vi.advanceTimersByTimeAsync(0);
    expect(registerSW).toHaveBeenCalledTimes(1);
    expect(registerSW).toHaveBeenCalledWith({ immediate: false });
  });

  it('does not register during the entrance window even though the document already loaded', async () => {
    const { registerSW } = await loadModule();
    await vi.advanceTimersByTimeAsync(2000);
    expect(registerSW).not.toHaveBeenCalled();
    fireIdle();
    await vi.advanceTimersByTimeAsync(0);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('falls back to a plain 2.5 s timeout when requestIdleCallback is unavailable', async () => {
    delete idleWindow.requestIdleCallback;
    const { registerSW } = await loadModule();
    await vi.advanceTimersByTimeAsync(IDLE_CAP_MS - 1);
    expect(registerSW).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('first user interaction wins over a pending idle wait', async () => {
    const { registerSW } = await loadModule();
    idleWindow.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(0);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('touch and key interactions also start registration', async () => {
    const { registerSW } = await loadModule();
    idleWindow.dispatchEvent(new Event('touchstart'));
    await vi.advanceTimersByTimeAsync(0);
    expect(registerSW).toHaveBeenCalledTimes(1);
    fireIdle(); // pending idle callback is now cancelled by the module
    idleWindow.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('waits for the window load event when the document is still loading', async () => {
    stubReadyState('loading');
    const { registerSW } = await loadModule();
    idleWindow.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(registerSW).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    fireIdle();
    await vi.advanceTimersByTimeAsync(0);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('never registers when serviceWorker is unavailable', async () => {
    // Reflect the REAL unsupported state: the key itself is absent
    // (a key present with value undefined still passes `'serviceWorker' in navigator`).
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    const { registerSW } = await loadModule();
    // The module short-circuits before arming: no idle callback is ever
    // installed, and interactions/timers cannot start it either.
    expect(ricCb).toBeNull();
    idleWindow.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(registerSW).not.toHaveBeenCalled();
  });

  it('starts at most once even if idle and interactions fire later', async () => {
    const { registerSW } = await loadModule();
    fireIdle();
    await vi.advanceTimersByTimeAsync(0);
    // Any later trigger (stale or fresh) must not re-enter.
    idleWindow.dispatchEvent(new Event('keydown'));
    idleWindow.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('a never-resolving registerSW promise must not throw or re-enter (8s race)', async () => {
    // One load only: resetModules inside loadModule re-evaluates the stub, so
    // the implementation must be set on the instance the source actually bound.
    const { registerSW } = await loadModule();
    registerSW.mockImplementation(() => new Promise<void>(() => {}));
    idleWindow.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(REGISTER_RACE_MS + 1000);
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('interaction-wins cancels the pending idle callback', async () => {
    const { registerSW } = await loadModule();
    expect(ricCb).toBeTruthy();
    idleWindow.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(0);
    expect(registerSW).toHaveBeenCalledTimes(1);
    // The module must withdraw the idle request it no longer needs.
    expect(idleWindow.cancelIdleCallback).toHaveBeenCalledWith(1);
  });
});
