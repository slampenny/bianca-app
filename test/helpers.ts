import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { store as appStore } from "../app/store/store";
import { authApi } from '../app/services/api/authApi';

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

export async function registerNewOrgAndCaregiver() {
    const newCaregiver = { name: 'Test Caregiver', email: `test${Math.floor(Math.random() * 10000)}@example.com`, password: 'password1', phone: '1234567890' };
    const register = authApi.endpoints.register.initiate;
    const dbOrg = await register(newCaregiver)(appStore.dispatch, appStore.getState, {});

    if ('error' in dbOrg) {
        throw new Error(`Registration failed with error: ${JSON.stringify(dbOrg.error)}`);
    } else {
        return { 
            orgId: dbOrg.data.org.id as string, 
            caregiverId: dbOrg.data.org.caregivers[0].id as string,
            token: dbOrg.data.tokens.access.token as string
        };
    }
}