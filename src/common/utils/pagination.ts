import { PaginationQuery } from '../validators/pagination.schema.js';

export const getPaginationOptions = (query: PaginationQuery) => {
    const { page, limit } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    return { from, to, limit };
};
