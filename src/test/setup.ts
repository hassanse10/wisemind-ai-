import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { vi } from 'vitest'

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((defaults, cb) => cb?.(defaults)),
      set: vi.fn((_data, cb) => cb?.()),
      remove: vi.fn((_keys, cb) => cb?.()),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  webNavigation: {
    onCompleted: { addListener: vi.fn() },
    onHistoryStateUpdated: { addListener: vi.fn() },
  },
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
  },
  idle: {
    onStateChanged: { addListener: vi.fn() },
    setDetectionInterval: vi.fn(),
  },
  windows: {
    onFocusChanged: { addListener: vi.fn() },
    WINDOW_ID_NONE: -1,
  },
  sidePanel: {
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
  },
}

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true })
