/**
 * Redux store — the app-state backbone (auth/session, mobile screen-config,
 * app-wide settings, sync status). The offline data core (SQLite catalogue +
 * durable outbox) is deliberately kept out of Redux; only `settings` is
 * persisted (via the SQLite-kv engine), so theme/language survive a relaunch
 * while auth/config are re-derived from the cached profile on bootstrap.
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import { kvStorage } from './kvStorage';
import authReducer from './authSlice';
import configReducer from './configSlice';
import settingsReducer from './settingsSlice';
import syncReducer from './syncSlice';

const persistedSettings = persistReducer(
  { key: 'settings', storage: kvStorage, whitelist: ['themeMode', 'language', 'serverSettings'] },
  settingsReducer,
);

const rootReducer = combineReducers({
  auth: authReducer,
  config: configReducer,
  settings: persistedSettings,
  sync: syncReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
