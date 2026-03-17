import { JwtPayload } from 'jsonwebtoken';
import { UserRole } from './roles.js';

export interface TokenPayload extends JwtPayload {
    userId: string;
    role: UserRole;
    phone?: string;
    email?: string;
    hospitalId?: string;
    doctorId?: string;
    sessionId?: string;
    adminTier?: string;
}

export type TokenType = 'access' | 'refresh';
