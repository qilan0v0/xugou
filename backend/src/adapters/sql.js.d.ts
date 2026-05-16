declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    run(sql: string, params?: BindParams): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
    export(): Uint8Array;
  }

  interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    getAsObject<T = Record<string, any>>(): T;
    free(): boolean;
  }

  type BindParams = (string | number | null | undefined)[] | Record<string, string | number | null | undefined>;
  type QueryExecResult = { columns: string[]; values: any[][] };

  export default function initSqlJs(config?: object): Promise<SqlJsStatic>;
  export { SqlJsStatic, Database, Statement, BindParams, QueryExecResult };
}
