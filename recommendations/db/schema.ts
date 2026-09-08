import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const recommendations = sqliteTable('recommendations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  album: text('album').notNull(),
  artist: text('artist').notNull(),
  note: text('note').notNull().default(''),
  name: text('name').notNull().default(''),
  spotifyId: text('spotify_id'),
  createdAt: integer('created_at').notNull(),
  visitorHash: text('visitor_hash').notNull(),
}, (table) => [index('idx_recommendations_visitor_time').on(table.visitorHash, table.createdAt)]);
