// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', { id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(), keyHash: text('key_hash').notNull(), created: text('created').notNull() });
export const collections = sqliteTable('collections', { id: text('id').primaryKey(), project: text('project').notNull().references(() => projects.id, { onDelete: 'cascade' }), name: text('name').notNull(), created: text('created').notNull() }, t => [uniqueIndex('collections_project_name').on(t.project, t.name)]);
export const records = sqliteTable('records', { id: text('id').primaryKey(), collection: text('collection').notNull().references(() => collections.id, { onDelete: 'cascade' }), data: text('data').notNull(), created: text('created').notNull(), updated: text('updated').notNull() });
export const files = sqliteTable('files', { id: text('id').primaryKey(), project: text('project').notNull().references(() => projects.id, { onDelete: 'cascade' }), name: text('name').notNull(), size: integer('size').notNull(), type: text('type').notNull(), created: text('created').notNull() });
export const projectSql = sqliteTable('project_sql', {project:text('project').primaryKey().references(()=>projects.id,{onDelete:'cascade'}),image:text('image').notNull(),revision:integer('revision').notNull()});
export const loginAttempts=sqliteTable('login_attempts',{key:text('key').primaryKey(),window:integer('window').notNull(),attempts:integer('attempts').notNull()});
