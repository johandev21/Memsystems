import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../../database/schema';
import type { RetrievalRequest, RetrievalChunkRow } from './retrieval.types';

const MAX_LEXICAL_TERMS = 64;

export class CandidateSearch {
  constructor(private readonly db: NodePgDatabase<typeof appSchema>) {}

  async dense(
    notebookId: string,
    embedding: number[],
    depth: number,
    sourceIds: string[] | null,
    scopeFilter: SQL | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    return this.runLegSearch(
      { notebookId, depth, sourceIds, scopeFilter },
      {
        projection: sql`
          ${chunkColumns()},
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
        `,
        rank: sql`sc.embedding <=> ${vectorLiteral}::vector`,
      },
    );
  }

  async lexical(
    notebookId: string,
    query: string,
    embedding: number[],
    depth: number,
    sourceIds: string[] | null,
    scopeFilter: SQL | null,
  ): Promise<RetrievalChunkRow[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    return this.runLegSearch(
      { notebookId, depth, sourceIds, scopeFilter },
      {
        cte: sql`
          WITH lexemes AS (
            SELECT lexeme
            FROM unnest(
              tsvector_to_array(to_tsvector('simple', ${query}))
            ) AS lexeme
            ORDER BY lexeme
            LIMIT ${MAX_LEXICAL_TERMS}
          ), q AS (
            SELECT to_tsquery(
              'simple',
              string_agg(quote_literal(lexeme), ' | ')
            ) AS query
            FROM lexemes
          )
        `,
        join: sql`CROSS JOIN q`,
        predicate: sql`AND sc.search_vector @@ q.query`,
        projection: sql`
          ${chunkColumns()},
          ts_rank_cd(sc.search_vector, q.query) AS score,
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS dense_score
        `,
        rank: sql`ts_rank_cd(sc.search_vector, q.query) DESC`,
      },
    );
  }

  scopeFilter(request: RetrievalRequest): SQL | null {
    const filters: SQL[] = [];
    if (request.headingPaths && request.headingPaths.length > 0) {
      filters.push(
        sql`AND sc.heading_path IN (${sql.join(
          request.headingPaths.map(
            (path) => sql`${JSON.stringify(path)}::jsonb`,
          ),
          sql`, `,
        )})`,
      );
    }
    if (request.chunkIndexRange) {
      filters.push(
        sql`AND sc.chunk_index >= ${request.chunkIndexRange.minChunkIndex} AND sc.chunk_index <= ${request.chunkIndexRange.maxChunkIndex}`,
      );
    }
    if (request.excludeChunkIds && request.excludeChunkIds.length > 0) {
      filters.push(
        sql`AND sc.id NOT IN (${sql.join(
          request.excludeChunkIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }
    return filters.length > 0 ? sql.join(filters, sql` `) : null;
  }

  private async runLegSearch(
    search: {
      notebookId: string;
      depth: number;
      sourceIds: string[] | null;
      scopeFilter: SQL | null;
    },
    leg: {
      cte?: SQL;
      join?: SQL;
      predicate?: SQL;
      projection: SQL;
      rank: SQL;
    },
  ): Promise<RetrievalChunkRow[]> {
    const sourceFilter = search.sourceIds
      ? sql`AND sc.source_id = ANY(${sql.param(search.sourceIds)}::varchar[])`
      : null;

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = 'strict_order'`);
      const result = await tx.execute(
        sql`
          ${leg.cte ?? sql``}
          SELECT ${leg.projection}
          FROM source_chunks sc
          JOIN sources s ON s.id = sc.source_id
          ${leg.join ?? sql``}
          WHERE sc.notebook_id = ${search.notebookId}
            AND s.processing_status <> 'degraded'
            AND s.deleted_at IS NULL
            ${leg.predicate ?? sql``}
            ${sourceFilter ?? sql``}
            ${search.scopeFilter ?? sql``}
          ORDER BY ${leg.rank}, sc.id
          LIMIT ${search.depth}
        `,
      );
      return result.rows as unknown as RetrievalChunkRow[];
    });
  }
}

function chunkColumns(): SQL {
  return sql`
    sc.id AS chunk_id,
    sc.chunk_index,
    sc.source_id,
    s.title,
    s.url,
    s.kind,
    sc.source_version_id,
    sc.locator,
    sc.content,
    sc.heading_path,
    sc.searchable_text
  `;
}
