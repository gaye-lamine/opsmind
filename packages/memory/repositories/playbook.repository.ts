import { COLLECTION_NAMES } from "@opsmind/config";
import { BaseRepository } from "./base.repository";
import {
  type PlaybookDocument,
  type InsertPlaybookDocument,
  type UpdatePlaybookDocument,
} from "../collections/playbooks/schema";

/**
 * Repository for the `remediation_playbooks` collection.
 * 
 * Manages dynamically generated RAG playbooks to guide incident remediation.
 */
export class PlaybookRepository extends BaseRepository<PlaybookDocument> {
  constructor() {
    super(COLLECTION_NAMES.PLAYBOOKS);
  }

  /**
   * Finds the playbook associated with a specific decision ID.
   */
  async findByDecisionId(decisionId: string): Promise<PlaybookDocument | null> {
    return this.findById(decisionId);
  }

  /**
   * Saves a new playbook document.
   */
  async savePlaybook(document: InsertPlaybookDocument): Promise<PlaybookDocument> {
    return this.insertOne(document);
  }

  /**
   * Updates an existing playbook's status or step statuses.
   */
  async updatePlaybook(
    decisionId: string,
    update: UpdatePlaybookDocument
  ): Promise<boolean> {
    return this.updateOne(decisionId, update);
  }
}
