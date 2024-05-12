import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

export function setupApiStore(api: any) {
    const store = configureStore({
        reducer: {
            [api.reducerPath]: api.reducer,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().concat(api.middleware),
    });

    setupListeners(store.dispatch);

    return { store };
}