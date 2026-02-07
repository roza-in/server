/**
 * Supabase Admin Mock
 * 
 * Provides a mock implementation of the Supabase client for testing.
 */

import { jest } from '@jest/globals';

// Mock query builder chain
const createMockQueryBuilder = () => {
    const mockData: any[] = [];
    let mockError: Error | null = null;
    let mockCount = 0;

    const queryBuilder: any = {
        // Store mock data for this query
        _setMockData: (data: any[], error?: Error, count?: number) => {
            mockData.length = 0;
            mockData.push(...data);
            mockError = error || null;
            mockCount = count ?? data.length;
        },

        // Selection
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => ({
            data: mockData[0] || null,
            error: mockError,
        })),
        maybeSingle: jest.fn().mockImplementation(() => ({
            data: mockData[0] || null,
            error: mockError,
        })),

        // Filtering
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        containedBy: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        and: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        match: jest.fn().mockReturnThis(),

        // Ordering
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),

        // Mutations
        insert: jest.fn().mockImplementation((data: any) => ({
            select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                    data: Array.isArray(data) ? data[0] : data,
                    error: mockError,
                }),
                then: (resolve: any) =>
                    resolve({
                        data: Array.isArray(data) ? data : [data],
                        error: mockError,
                    }),
            }),
            then: (resolve: any) => resolve({ data, error: mockError }),
        })),
        update: jest.fn().mockImplementation((data: any) => ({
            eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data, error: mockError }),
                }),
                then: (resolve: any) => resolve({ data, error: mockError }),
            }),
            match: jest.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data, error: mockError }),
            }),
        })),
        upsert: jest.fn().mockImplementation((data: any) => ({
            select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data, error: mockError }),
            }),
        })),
        delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: mockError }),
            }),
            match: jest.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: mockError }),
            }),
        }),

        // Execution
        then: jest.fn().mockImplementation((resolve: any) => {
            resolve({ data: mockData, error: mockError, count: mockCount });
        }),
    };

    return queryBuilder;
};

// Mock Supabase Admin Client
export const mockSupabaseAdmin = {
    from: jest.fn().mockImplementation((_table: string) => {
        return createMockQueryBuilder();
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null } as never),
    auth: {
        admin: {
            getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null } as never),
            createUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null } as never),
            updateUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null } as never),
            deleteUser: jest.fn().mockResolvedValue({ data: null, error: null } as never),
        },
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null } as never),
    },
};

// Jest module mock
export const setupSupabaseMock = () => {
    jest.mock('../../src/database/supabase-admin.js', () => ({
        supabaseAdmin: mockSupabaseAdmin,
    }));
};

export default mockSupabaseAdmin;
