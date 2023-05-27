import { RepositoryUpdater as RepositoryUpdaterInterface } from "../../core";
import { logger } from "../../logger";
import { ShopifyDataSource } from "./shopifyDataSource";
import { SqliteRepository } from "./sqliteRepository";

export class RepositoryUpdater implements RepositoryUpdaterInterface {
  constructor(
    private readonly repository: SqliteRepository,
    private readonly dataSource: ShopifyDataSource
  ) {}

  async updateData(): Promise<void> {
    logger.info("Running full repository update", {});
    await this.repository.replaceData(
      this.dataSource.getProducts(),
      await this.dataSource.getSalesRanks()
    );
  }
}
