import type { JWTPayload } from 'jose';

declare global {
  namespace Express {
    export interface Request {
      user: JWTPayload;
    }
  }
}
