import { EnhancedStore } from '@reduxjs/toolkit';
import { Org, orgApi } from '../';
import { store as appStore, RootState } from "../../../store/store";
import { registerNewOrgAndCaregiver } from '../../../../test/helpers';
import { newCaregiver } from '../../../../test/fixtures/caregiver.fixture';
describe('orgApi', () => {
    // const testOrg = (): Org => ({
    //     name: 'Test Org',
    //     email: generateUniqueEmail(),
    //     phone: '1234567890',
    //     isEmailVerified: false,
    //     caregivers: [],
    //     patients: [],
    // });

    let store: EnhancedStore<RootState>;
    let org: Org;
    let orgId: string;
    // let caregiverId: string;
    // let authTokens: { access: { token: string, expires: string }, refresh: { token: string, expires: string } };

    beforeEach(async () => {
        store = appStore;
        const testCaregiver = newCaregiver();
        const response = await registerNewOrgAndCaregiver(testCaregiver.name, testCaregiver.email, testCaregiver.password, testCaregiver.phone);
        org = response.org;
        orgId = org.id as string;
        // caregiverId = response.caregiver.id as string;
        // authTokens = response.tokens;
    });
    
    afterEach(async () => {
        await orgApi.endpoints.deleteOrg.initiate({ orgId: orgId })(store.dispatch, store.getState, {});
        jest.clearAllMocks();
    });

    //   const loginAndGetTokens = async (email: string, password: string) => {
    //     const credentials = { email, password };
    //     const result = await authApi.endpoints.login.initiate(credentials)(store.dispatch, store.getState, {});
    //     if ('data' in result) {
    //       return result.data.tokens;
    //     } else {
    //       throw new Error('Login failed');
    //     }
    //   };

    //   function expectError(result: any, status: number, message: string) {
    //     expect(result.error).toBeTruthy();
    //     expect(result.error.status).toBe(status);
    //     expect((result.error.data as { message: string }).message).toBe(message);
    //   }

    //   it('should create a new organization', async () => {
    //     const newOrg = { name: 'New Org', email: generateUniqueEmail(), phone: '1234567890' };
    //     const result = await orgApi.endpoints.createOrg.initiate(newOrg)(store.dispatch, store.getState, {});

    //     if ('error' in result) {
    //       throw new Error(`Organization creation failed with error: ${JSON.stringify(result.error)}`);
    //     } else {
    //       expect(result).toMatchObject({
    //         data: {
    //           id: expect.any(String),
    //           name: newOrg.name,
    //           email: newOrg.email,
    //           phone: newOrg.phone,
    //           isEmailVerified: false,
    //         },
    //       });

    //       const orgId = result.data.id;
    //       await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {});
    //     }
    //   });

    //   it('should fail to create an organization with duplicate email', async () => {
    //     const newOrg = { name: 'New Org', email: org.email, phone: '1234567890' };
    //     const result = await orgApi.endpoints.createOrg.initiate(newOrg)(store.dispatch, store.getState, {});
    //     expectError(result, 400, 'Email already taken');
    //   });

    it('should update an organization', async () => {
        const updatedOrg = { orgId: org.id as string, org: { name: 'Updated Org', phone: '0987654321' } };
        const result = await orgApi.endpoints.updateOrg.initiate(updatedOrg)(store.dispatch, store.getState, {});

        if ('error' in result) {
            throw new Error(`Organization update failed with error: ${JSON.stringify(result.error)}`);
        } else {
            expect(result).toMatchObject({
                data: {
                    id: updatedOrg.orgId,
                    name: updatedOrg.org.name,
                    phone: updatedOrg.org.phone,
                },
            });
        }
    });

    it('should fetch organization details', async () => {
        const result = await orgApi.endpoints.getOrg.initiate({ orgId: orgId })(store.dispatch, store.getState, {});

        if ('error' in result) {
            throw new Error(`Fetching organization details failed with error: ${JSON.stringify(result.error)}`);
        } else {
            expect(result).toMatchObject({
                data: {
                    id: org.id,
                    name: org.name,
                    email: org.email,
                    phone: org.phone,
                    isEmailVerified: org.isEmailVerified,
                },
            });
        }
    });

    // it('should get all organizations', async () => {
    //     const result = await orgApi.endpoints.getAllOrgs.initiate({})(store.dispatch, store.getState, {});

    //     if ('error' in result) {
    //         throw new Error(`Listing organizations failed with error: ${JSON.stringify(result.error)}`);
    //     } else if (result.data) {
    //         expect(result.data.results).toEqual(expect.any(Array));
    //         expect(result.data.results).toContainEqual(expect.objectContaining({ id: orgId }));
    //     } else {
    //         throw new Error('Expected data but received undefined');
    //     }
    // });

    it('should delete an organization', async () => {
        let result;
        if (org.id) {
            result = await orgApi.endpoints.deleteOrg.initiate({ orgId: org.id })(store.dispatch, store.getState, {});
        } else {
            throw new Error('org.id is undefined');
        }
        if ('error' in result) {
            throw new Error(`Deleting organization failed with error: ${JSON.stringify(result.error)}`);
        } else {
            expect(result.data).toBeNull();

            orgId = "";
        }
    });
});
