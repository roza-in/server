/**
 * @deprecated ROZX uses a centralized pharmacy model — there is NO `pharmacies` table.
 * Medicine orders use `hospital_id` on `medicine_orders` table.
 * Pharmacy services referencing this repo need refactoring to use hospitalRepository.
 *
 * This stub prevents runtime crashes but should be replaced.
 */
import { BaseRepository } from '../../common/repositories/base.repo.js';

// Stub type — no pharmacies table exists
interface PharmacyStub {
    id: string;
    [key: string]: any;
}

export class PharmacyRepository extends BaseRepository<PharmacyStub> {
    constructor() {
        // Points to hospitals — centralized pharmacy is ROZX-managed, not a separate entity
        super('hospitals');
    }

    async findBySlug(slug: string): Promise<PharmacyStub | null> {
        return this.findOne({ slug } as any);
    }

    async findNearby(_lat: number, _lng: number, _radiusKm: number = 5) {
        // No get_nearby_pharmacies RPC exists — centralized pharmacy model
        console.warn('[PharmacyRepository] findNearby is a no-op — centralized pharmacy model');
        return [];
    }
}

export const pharmacyRepository = new PharmacyRepository();
