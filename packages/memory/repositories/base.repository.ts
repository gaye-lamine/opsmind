import {
  type Collection,
  type Filter,
  type UpdateFilter,
  type FindOptions,
  type CountDocumentsOptions,
  type WithId,
} from "mongodb";
import { createLogger } from "@opsmind/shared";
import { ERROR_CODES, MemoryError } from "@opsmind/shared";
import { getDatabase } from "./client";

/**
 * Base repository providing typed MongoDB operations.
 *
 * All collection-specific repositories extend this class.
 * Direct MongoDB access outside of repositories is forbidden — all
 * database interactions must go through this abstraction layer.
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export abstract class BaseRepository<TDocument extends { _id: string }> {
  protected readonly logger = createLogger(this.constructor.name);

  constructor(protected readonly collectionName: string) {}

  public async getCollection(): Promise<Collection<TDocument>> {
    const db = await getDatabase();
    return db.collection<TDocument>(this.collectionName);
  }

  async findById(id: string): Promise<TDocument | null> {
    try {
      const collection = await this.getCollection();
      const doc = await collection.findOne({ _id: id } as Filter<TDocument>);
      return doc as TDocument | null;
    } catch (error) {
      throw new MemoryError(
        `Failed to find document by id: ${id}`,
        ERROR_CODES.MEMORY_READ_FAILED,
        { collectionName: this.collectionName, id, error }
      );
    }
  }

  async findOne(filter: Filter<TDocument>): Promise<TDocument | null> {
    try {
      const collection = await this.getCollection();
      const doc = await collection.findOne(filter);
      return doc as TDocument | null;
    } catch (error) {
      throw new MemoryError(
        `Failed to find document in ${this.collectionName}`,
        ERROR_CODES.MEMORY_READ_FAILED,
        { collectionName: this.collectionName, error }
      );
    }
  }

  async findMany(
    filter: Filter<TDocument>,
    options?: FindOptions
  ): Promise<TDocument[]> {
    try {
      const collection = await this.getCollection();
      const docs = await collection.find(filter, options).toArray();
      return docs as TDocument[];
    } catch (error) {
      throw new MemoryError(
        `Failed to find documents in ${this.collectionName}`,
        ERROR_CODES.MEMORY_READ_FAILED,
        { collectionName: this.collectionName, error }
      );
    }
  }

  async findPaginated(
    filter: Filter<TDocument>,
    pagination: PaginationOptions,
    options?: Omit<FindOptions, "skip" | "limit">
  ): Promise<PaginatedResult<TDocument>> {
    try {
      const collection = await this.getCollection();
      const { page, pageSize } = pagination;
      const skip = (page - 1) * pageSize;

      const [items, total] = await Promise.all([
        collection
          .find(filter, { ...options, skip, limit: pageSize })
          .toArray(),
        collection.countDocuments(filter),
      ]);

      return {
        items: items as TDocument[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw new MemoryError(
        `Failed to paginate documents in ${this.collectionName}`,
        ERROR_CODES.MEMORY_READ_FAILED,
        { collectionName: this.collectionName, error }
      );
    }
  }

  async insertOne(document: TDocument): Promise<TDocument> {
    try {
      const collection = await this.getCollection();
      await collection.insertOne(document as any);
      return document;
    } catch (error) {
      throw new MemoryError(
        `Failed to insert document into ${this.collectionName}`,
        ERROR_CODES.MEMORY_WRITE_FAILED,
        { collectionName: this.collectionName, error }
      );
    }
  }

  async updateOne(
    id: string,
    update: UpdateFilter<TDocument> | Partial<TDocument>
  ): Promise<boolean> {
    try {
      const collection = await this.getCollection();
      const result = await collection.updateOne(
        { _id: id } as Filter<TDocument>,
        { $set: update } as UpdateFilter<TDocument>
      );
      return result.matchedCount > 0;
    } catch (error) {
      throw new MemoryError(
        `Failed to update document ${id} in ${this.collectionName}`,
        ERROR_CODES.MEMORY_WRITE_FAILED,
        { collectionName: this.collectionName, id, error }
      );
    }
  }

  async count(
    filter: Filter<TDocument>,
    options?: CountDocumentsOptions
  ): Promise<number> {
    try {
      const collection = await this.getCollection();
      return collection.countDocuments(filter, options);
    } catch (error) {
      throw new MemoryError(
        `Failed to count documents in ${this.collectionName}`,
        ERROR_CODES.MEMORY_READ_FAILED,
        { collectionName: this.collectionName, error }
      );
    }
  }

  async exists(filter: Filter<TDocument>): Promise<boolean> {
    const count = await this.count(filter, { limit: 1 });
    return count > 0;
  }
}
