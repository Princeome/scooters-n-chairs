import path from "path";
import {
  CountProductsPagesOptions,
  emptyProductFilters,
  GetProductsPageOptions,
  Logger,
  Product,
  ProductCategory,
  ProductColor,
  ProductFilters,
  ProductImage,
  ProductOrderBy,
  ProductVendor,
  Repository,
  SalesRanks,
  UsdPrice,
} from "../core";
import { Database } from "sqlite3";
import { stat } from "fs/promises";
import _ from "lodash";
import { delay } from "../util";

export class SqliteRepository implements Repository {
  private static readonly allProductColumns = [
    "product.id",
    "product.sku",
    "product.title",
    "product.vendor",
    "product.price",
    "product.list_price",
    "product.options",
    "product.variants",
    "product.images",
    "product.ground_clearance",
    "product.weight_capacity",
    "product.turning_radius",
    "product.range",
    "product.max_speed",
    "product.wheels",
    "product.published_at_unix_ms",
    "product.description_html",
    "product.model",
    "product.product_type",
    "product.model_image",
    "product.vendor_filter"
  ].join(",");

  private readonly db: Database;

  constructor(private readonly logger: Logger) {
    this.db = new Database(SqliteRepository.databaseFilePath());
    this.ensureDatabaseExists();
  }
  

  async getProduct(id: string): Promise<Product> {
    const row = await this.getSingleRow(
      `SELECT DISTINCT ${SqliteRepository.allProductColumns},
          group_concat(color.color) AS product_colors
        FROM product
        LEFT JOIN product_category ON product.id = product_category.product_id
        LEFT JOIN color ON product.id = color.product_id
        WHERE product.id = ? GROUP BY product.id`,
      id
    );
    const categories = await this.getProductCategories(id);
    return SqliteRepository.rowToProduct(row, categories);
  }

  async getProductAll(id: string): Promise<Product[]> {
    const rows = await this.getAllRows(
      `SELECT * 
        FROM product`
    );
    return rows.map((row) => SqliteRepository.rowToProduct(row));
  }

  async getmodelAll(id: string): Promise<Product[]> {
    const rows = await this.getAllRows(
      `SELECT * 
        FROM product GROUP BY model`
    );
    return rows.map((row) => SqliteRepository.rowToProduct(row));
  }


  async getRelatedProducts(
    category: ProductCategory,
    productId: string,
    price: UsdPrice,
    count: number
  ): Promise<readonly Product[]> {
    const where = SqliteRepository.createWhereQuery({
      ...emptyProductFilters,
      categoryIds: [category.id],
    });
    const rows = await this.getAllRows(
      `SELECT DISTINCT ${SqliteRepository.allProductColumns}, group_concat(color.color) AS product_colors FROM product
        LEFT JOIN product_category ON product.id = product_category.product_id
        LEFT JOIN color ON product.id = color.product_id
        ${where.query} AND product.id <> ? GROUP BY product.id ORDER BY abs(? - product.price) LIMIT ?`,
      ...where.params,
      productId,
      price.usdAmount,
      count
    );
    return rows.map((row) => SqliteRepository.rowToProduct(row));
  }

  async getProductsPage(
    options: GetProductsPageOptions
  ): Promise<readonly Product[]> {
    const orderBy = SqliteRepository.createOrderByQuery(options.orderBy);
    const where = SqliteRepository.createWhereQuery(options.filters);
    const having = SqliteRepository.createHavingQuery(options.filters);
    const offset = (options.pageNumber - 1) * options.pageSize;
    const limit = options.pageSize;
    const rows = await this.getAllRows(
      `SELECT DISTINCT ${SqliteRepository.allProductColumns}, group_concat(color.color) AS product_colors FROM product
        LEFT JOIN product_category ON product.id = product_category.product_id
        LEFT JOIN color ON product.id = color.product_id
        ${where.query} GROUP BY product.id ${having.query} ${orderBy} LIMIT ? OFFSET ?`,
      ...where.params,
      ...having.params,
      limit,
      offset
    );
    return rows.map((row) => SqliteRepository.rowToProduct(row));
  }

  private async getProductCategories(
    id: string
  ): Promise<readonly ProductCategory[]> {
    const rows = await this.getAllRows(
      `SELECT category.id AS id, category.title AS title FROM product_category
        LEFT JOIN category ON product_category.category_id = category.id
        WHERE product_category.product_id = ?`,
      id
    );
    return rows.map(SqliteRepository.rowToCategory);
  }

  private static rowToProduct(
    row: any,
    categories?: readonly ProductCategory[]
  ): Product {
    return {
      id: row.id,
      sku:row.sku,
      model: row.model ?? null,
      product_type: row.product_type ?? null,
      vendor_filter: row.vendor_filter ?? null,
      model_image:row.model_image ?? null,
      title: row.title,
      categories: categories ?? null,
      vendor: {
        vendor: row.vendor,
      },
      colors: (row.product_colors ?? "")
        .split(",")
        .filter((color: string) => color !== "")
        .sort()
        .map((color: string) => ({ color })),
      descriptionHtml: row.description_html,
      price: {
        usdAmount: SqliteRepository.parsePrice(row.price.toString()),
      },
      listPrice: row.list_price && {
        usdAmount: SqliteRepository.parsePrice(row.list_price.toString()),
      },
      options: JSON.parse(row.options),
      variants: JSON.parse(row.variants),
      images: SqliteRepository.removeDuplicateImages(JSON.parse(row.images)),
      specifications: {
        wheels: row.wheels?.toString() ?? null,
        range: row.range?.toString() ?? null,
        groundClearance: row.ground_clearance?.toString() ?? null,
        weightCapacity: row.weight_capacity?.toString() ?? null,
        turningRadius: row.turning_radius?.toString() ?? null,
        maxSpeed: row.max_speed?.toString() ?? null,
      },
      publishedAt: {
        unixMilliseconds: row.published_at_unix_ms,
      },
    };
  }

  private static rowToCategory(row: any): ProductCategory {
    return {
      id: row.id,
      title: row.title,
    };
  }

  private static removeDuplicateImages(
    images: readonly ProductImage[]
  ): readonly ProductImage[] {
    const result: Record<string, ProductImage> = {};
    for (const image of images) {
      result[image.url] = image;
    }
    return Object.values(result);
  }

  // TODO This is UI logic and does not belong here, USD prices should be of type number
  private static parsePrice(price: string): string {
    const [dollars, cents] = price.split(".");
    if (cents === undefined) {
      return `${dollars}.00`;
    }

    return `${dollars}.${cents.slice(0, 2)}`;
  }

  async countProductsPages(
    options: CountProductsPagesOptions
  ): Promise<number> {
    const where = SqliteRepository.createWhereQuery(options.filters);
    const having = SqliteRepository.createHavingQuery(options.filters);
    const row = await this.getSingleRow(
      `SELECT COUNT(*) FROM (SELECT DISTINCT ${SqliteRepository.allProductColumns}, group_concat(color.color) AS product_colors FROM product
        LEFT JOIN product_category ON product.id = product_category.product_id
        LEFT JOIN color ON product.id = color.product_id
        ${where.query} GROUP BY product.id ${having.query})`,
      ...where.params,
      ...having.params
    );
    const productCount = row["COUNT(*)"];
    return Math.ceil(productCount / options.pageSize);
  }

  async getVendorsForCategories(
    categoryIds: readonly string[]
  ): Promise<readonly ProductVendor[]> {
    const where = SqliteRepository.createWhereQuery({
      ...emptyProductFilters,
      categoryIds,
    });
    const rows = await this.getAllRows(
      `SELECT DISTINCT product.vendor FROM product
        LEFT JOIN product_category ON product.id = product_category.product_id
        ${where.query}
        ORDER BY product.vendor`,
      ...where.params
    );
    return rows.map((row) => ({
      vendor: row.vendor,
    }));
  }

  async getColorsForCategories(
    categoryIds: readonly string[]
  ): Promise<readonly ProductColor[]> {
    const where = SqliteRepository.createWhereQuery({
      ...emptyProductFilters,
      categoryIds,
    });
    const rows = await this.getAllRows(
      `SELECT DISTINCT color.color FROM color
        LEFT JOIN product_category ON color.product_id = product_category.product_id
        ${where.query}
        ORDER BY color.color`,
      ...where.params
    );
    return rows.map((row) => ({
      color: row.color,
    }));
  }

  async countProductsInCategory(categoryId: string): Promise<number> {
    const row = await this.getSingleRow(
      `SELECT COUNT(*) FROM (SELECT DISTINCT ${SqliteRepository.allProductColumns} FROM product
        LEFT JOIN product_category ON product.id = product_category.product_id
        WHERE product_category.category_id = ?)`,
      categoryId
    );
    return row["COUNT(*)"];
  }

  private static createOrderByQuery(orderBy: ProductOrderBy): string {
    const columnName = SqliteRepository.getOrderByColumnName(orderBy);
    if (columnName === undefined) {
      return "";
    }
    return `ORDER BY ${columnName}`;
  }

  private static getOrderByColumnName(
    orderBy: ProductOrderBy
  ): string | undefined {
    switch (orderBy) {
      case "default":
        return undefined;
      case "newest":
        return "product.published_at_unix_ms DESC";
      case "bestSelling":
        return "product.sales_rank ASC";
      case "priceAscending":
        return "product.price ASC";
      case "priceDescending":
        return "product.price DESC";
      default:
        throw new Error(`Unknown order by key ${orderBy}`);
    }
  }

  private static createHavingQuery(filters?: ProductFilters): {
    query: string;
    params: string[];
  } {
    if (!filters?.color) {
      return {
        query: "",
        params: [],
      };
    }

    const queryElements: string[] = [];
    const queryParams: string[] = [];
    const filterValues = filters.color;

    for (const color of filterValues) {
      queryElements.push("product_colors LIKE ?");
      queryParams.push(`%${color.color}%`);
    }

    return {
      query:
        queryElements.length > 0 ? `HAVING ${queryElements.join(" OR ")}` : "",
      params: queryParams,
    };
  }

  private static createWhereQuery(filters?: ProductFilters): {
    query: string;
    params: string[];
  } {
    if (filters === undefined) {
      return {
        query: "",
        params: [],
      };
    }

    const queryElements: string[] = [];
    const queryParams: string[] = [];

    searchFiler(filters.search, "product.title");
    valueFiler("categoryIds", "product_category.category_id");
    valueFiler("wheels", "product.wheels");
    valueFiler(
      "vendor",
      "product.vendor",
      filters.vendor.map((vendor) => vendor.vendor)
    );
    rangeFilter("price", "product.price");
    rangeFilter("groundClearance", "product.ground_clearance");
    rangeFilter("weightCapacity", "product.weight_capacity");
    rangeFilter("turningRadius", "product.turning_radius");
    rangeFilter("travelRange", "product.range");
    rangeFilter("maxSpeed", "product.max_speed");

    return {
      query:
        queryElements.length > 0 ? `WHERE ${queryElements.join(" AND ")}` : "",
      params: queryParams,
    };

    function searchFiler(search: string, columnName: string): void {
      if (search === "") {
        return;
      }

      queryElements.push(`${columnName} LIKE ?`);
      queryParams.push(`%${search}%`);
    }

    function valueFiler(
      filterName: keyof ProductFilters,
      columnName: string,
      filterValues?: readonly string[]
    ): void {
      if (!filters?.[filterName]) {
        return;
      }

      filterValues ??= filters?.[filterName] as string[];
      if (!(filterValues instanceof Array)) {
        throw new TypeError("Expected array");
      }

      if (filterValues.length === 0) {
        return;
      }

      queryElements.push(
        `${columnName} IN (${Array.from("?".repeat(filterValues.length)).join(
          ","
        )})`
      );
      queryParams.push(...(filterValues as string[]));
    }

    function rangeFilter(
      filterName: keyof ProductFilters,
      columnName: string
    ): void {
      const ranges = filters?.[filterName] as any[];
      if (!ranges) {
        return;
      }

      const orElements: string[] = [];

      for (const range of ranges) {
        const andElements: string[] = [];

        if (typeof range.from === "string") {
          andElements.push(`${columnName} >= ?`);
          queryParams.push(range.from);
        }

        if (typeof range.to === "string") {
          andElements.push(`${columnName} <= ?`);
          queryParams.push(range.to);
        }

        if (andElements.length > 0) {
          orElements.push(`(${andElements.join(" AND ")})`);
        }
      }

      if (orElements.length > 0) {
        queryElements.push(`(${orElements.join(" OR ")})`);
      }
    }
  }

  async replaceData(
    newData: AsyncIterable<Product>,
    salesRanks: SalesRanks
  ): Promise<void> {
    try {
      this.run("BEGIN TRANSACTION");
      this.clearData();
      for await (const product of newData) {
        await this.insertProduct(
          product,
          salesRanks[product.id] ?? Number.MAX_SAFE_INTEGER
        );
      }
      this.run("COMMIT");
    } catch (e) {
      this.run("ROLLBACK");
      this.logger.error("Caught error");
      throw e;
    }
  }

  private clearData(): void {
    this.run("DELETE FROM product;");
    this.run("DELETE FROM category;");
    this.run("DELETE FROM product_category;");
    this.run("DELETE FROM color;");
  }

  private async insertProduct(
    product: Product,
    salesRank: number
  ): Promise<void> {
    if (product.categories === undefined) {
      throw new Error("Expected product to have categories");
    }

    this.run(
      "INSERT INTO product VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)",
      product.id,
      product.title,
      product.vendor.vendor,
      product.price.usdAmount,
      product.listPrice?.usdAmount,
      JSON.stringify(product.options),
      JSON.stringify(product.variants),
      JSON.stringify(product.images),
      product.specifications.groundClearance,
      product.specifications.weightCapacity,
      product.specifications.turningRadius,
      product.specifications.range,
      product.specifications.maxSpeed,
      product.specifications.wheels,
      product.publishedAt.unixMilliseconds,
      salesRank,
      product.descriptionHtml,
      product.sku,
      product.model,
      product.product_type,
      product.model_image ?? null,
      product.vendor_filter,
    );

    for (const color of product.colors) {
      this.run("INSERT INTO color VALUES (?, ?)", color.color, product.id);
    }

    for (const category of product.categories ?? []) {
      if (category.title === null) {
        throw new Error(
          "Category title should not be undefined in this context"
        );
      }

      await this.insertCategoryIfNotExists(category);
      this.run(
        "INSERT INTO product_category VALUES (?, ?)",
        product.id,
        category.id
      );
    }
  }

  private async insertCategoryIfNotExists(
    category: ProductCategory
  ): Promise<void> {
   
    if (await this.categoryExists(category)) {
      return;
    }

    this.run("INSERT INTO category VALUES (?, ?)", category.id, category.title);
  }

  private categoryExists(category: ProductCategory): Promise<boolean> {
    return this.getSingleRow(
      "SELECT id FROM category WHERE id = ?",
      category.id
    );
  }

  private getSingleRow(sql: string, ...params: string[]): Promise<any> {
    this.logSqlStatement(sql, params);
    return this.retryOnSqliteBusy(
      sql,
      params,
      () =>
        new Promise((resolve, reject) => {
          this.db.get(sql, ...params, (err: any, row: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          });
        })
    );
  }

  private getAllRows(sql: string, ...params: any[]): Promise<any[]> {
    this.logSqlStatement(sql, params);
    return this.retryOnSqliteBusy(
      sql,
      params,
      () =>
        new Promise((resolve, reject) => {
          this.db.all(sql, ...params, (err: any, rows: any[]) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          });
        })
    );
  }

  private async retryOnSqliteBusy<T>(
    sql: string,
    params: any,
    cb: () => Promise<T>
  ): Promise<T> {
    const delays = [10, 100, 500, 1000, 2000, 3000, 4000, 5000];
    for (let i = 0; i <= delays.length; i++) {
      try {
        return await cb();
      } catch (e: any) {
        if (e.code === "SQLITE_BUSY" && i < delays.length) {
          const totalDelay = delays[i];
          await delay(totalDelay);
          this.logger.info("Sqlite busy, retrying after delay", {
            delay: totalDelay,
          });
          continue;
        }

        this.logger.error("Error while querying", {
          e,
          sql,
          params,
        });

        throw e;
      }
    }

    throw new Error("Should never get here");
  }

  private run(sql: string, ...params: any[]): void {
    this.logSqlStatement(sql, params);
    try {
      this.db.run(sql, ...params);
    } catch (error) {
      this.logger.error("Error while executing sql", { error, sql, params });
      throw error;
    }
  }

  private logSqlStatement(sql: string, params: any[]): void {
    this.logger.debug("Executing SQL statement", { sql, params });
  }

  private ensureDatabaseExists(): void {
    this.db.serialize(() => {
      this.run("BEGIN TRANSACTION");
      this.run("PRAGMA foreign_keys = ON");
      this.run(`
        CREATE TABLE IF NOT EXISTS product (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          vendor TEXT NOT NULL,
          price NUMERIC NOT NULL,
          list_price NUMERIC,
          options TEXT NOT NULL,
          variants TEXT NOT NULL,
          images TEXT NOT NULL,
          ground_clearance NUMERIC,
          weight_capacity NUMERIC,
          turning_radius NUMERIC,
          range NUMERIC,
          max_speed NUMERIC,
          wheels NUMERIC,
          published_at_unix_ms INTEGER NOT NULL,
          sales_rank INTEGER UNIQUE NOT NULL,
          description_html TEXT
        ) WITHOUT ROWID
      `);
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_title ON product (title)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_vendor ON product (vendor)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_price ON product (price)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_ground_clearance ON product (ground_clearance)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_weight_capacity ON product (weight_capacity)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_turning_radius ON product (turning_radius)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_range ON product (range)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_wheels ON product (wheels)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_max_speed ON product (max_speed)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_published_at_unix_ms ON product (published_at_unix_ms)"
      );
      this.run(
        "CREATE INDEX IF NOT EXISTS ix_product_sales_rank ON product (sales_rank)"
      );
      this.run(`
        CREATE TABLE IF NOT EXISTS category (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL
        ) WITHOUT ROWID
      `);
      this.run(`
        CREATE TABLE IF NOT EXISTS product_category (
          product_id NOT NULL REFERENCES product,
          category_id NOT NULL REFERENCES category,
          PRIMARY KEY (product_id, category_id)
        ) WITHOUT ROWID;
      `);
      this.run(`
        CREATE TABLE IF NOT EXISTS color (
          color TEXT NOT NULL,
          product_id TEXT NOT NULL REFERENCES product,
          PRIMARY KEY (color, product_id)
        ) WITHOUT ROWID;
      `);
      this.run("COMMIT");
    });
  }

  private static databaseFilePath(): string {
    const sqliteFileName = "data.sqlite";
    return path.join(process.cwd(), sqliteFileName);
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return false;
    }
    throw e;
  }
}
