import { Pool } from 'pg';
export declare function getDatabase(): Promise<Pool>;
export declare function closeDatabase(): Promise<void>;
export declare function query(text: string, params?: any[]): Promise<any>;
export declare function transaction(queries: Array<{
    text: string;
    params?: any[];
}>): Promise<any[]>;
export declare function healthCheck(): Promise<boolean>;
//# sourceMappingURL=connection.d.ts.map