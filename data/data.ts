import { Repository } from "../core";
import { logger } from "../logger";
import { RepositoryUpdater as RepositoryUpdaterInterface } from "../core";
import { RepositoryUpdater } from "./repository/repositoryUpdater";
import { ShopifyDataSource } from "./repository/shopifyDataSource";
import { SqliteRepository } from "./repository/sqliteRepository";

const sqliteRepository = new SqliteRepository(logger);

export const repository: Repository = sqliteRepository;

export const repositoryUpdater: RepositoryUpdaterInterface =
  new RepositoryUpdater(sqliteRepository, new ShopifyDataSource());
