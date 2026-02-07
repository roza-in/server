import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Pharmacy } from '../../types/database.types.js';

export class PharmacyRepository extends BaseRepository<Pharmacy> {
    constructor() {
        super('pharmacies');
    }

    async findBySlug(slug: string): Promise<Pharmacy | null> {
        return this.findOne({ slug } as any);
    }

    async findNearby(lat: number, lng: number, radiusKm: number = 5) {
        // PostGIS query via RPC or raw SQL
        const { data, error } = await this.supabase.rpc('get_nearby_pharmacies', {
            p_lat: lat,
            p_lng: lng,
            p_radius_km: radiusKm
        });

        if (error) throw error;
        return data;
    }
}

export const pharmacyRepository = new PharmacyRepository();
