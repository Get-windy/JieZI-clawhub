/* @vitest-environment node */

import { describe, expect, it, vi } from "vitest";
import { getByName, getVersionByName, listPublicPage, listVersions, searchPublic } from "./packages";

type WrappedHandler<TArgs, TResult> = {
  _handler: (ctx: unknown, args: TArgs) => Promise<TResult>;
};

const getByNameHandler = (
  getByName as unknown as WrappedHandler<
    { name: string; viewerUserId?: string },
    { package: { name: string } } | null
  >
)._handler;
const getVersionByNameHandler = (
  getVersionByName as unknown as WrappedHandler<
    { name: string; version: string; viewerUserId?: string },
    { package: { name: string }; version: { version: string } } | null
  >
)._handler;
const listPublicPageHandler = (
  listPublicPage as unknown as WrappedHandler<
    {
      family?: "skill" | "code-plugin" | "bundle-plugin";
      channel?: "official" | "community" | "private";
      isOfficial?: boolean;
      executesCode?: boolean;
      capabilityTag?: string;
      paginationOpts: { cursor: string | null; numItems: number };
    },
    { page: Array<{ name: string }>; isDone: boolean; continueCursor: string }
  >
)._handler;
const listVersionsHandler = (
  listVersions as unknown as WrappedHandler<
    {
      name: string;
      viewerUserId?: string;
      paginationOpts: { cursor: string | null; numItems: number };
    },
    { page: Array<{ version: string }>; isDone: boolean; continueCursor: string }
  >
)._handler;
const searchPublicHandler = (
  searchPublic as unknown as WrappedHandler<
    {
      query: string;
      limit?: number;
      family?: "skill" | "code-plugin" | "bundle-plugin";
      channel?: "official" | "community" | "private";
      isOfficial?: boolean;
      executesCode?: boolean;
      capabilityTag?: string;
    },
    Array<{ package: { name: string } }>
  >
)._handler;

function makeDigest(
  name: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    _id: `packageSearchDigest:${name}`,
    packageId: `packages:${name}`,
    name,
    normalizedName: name,
    displayName: name,
    family: "code-plugin",
    runtimeId: null,
    channel: "community",
    isOfficial: false,
    summary: `${name} summary`,
    ownerHandle: "owner",
    createdAt: 1,
    updatedAt: 1,
    latestVersion: "1.0.0",
    capabilityTags: [],
    executesCode: false,
    verificationTier: null,
    softDeletedAt: undefined,
    ...overrides,
  };
}

function makePackageDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "packages:demo",
    name: "demo-plugin",
    normalizedName: "demo-plugin",
    displayName: "Demo Plugin",
    family: "code-plugin",
    channel: "community",
    isOfficial: false,
    ownerUserId: "users:owner",
    tags: {},
    latestReleaseId: "packageReleases:demo-1",
    latestVersionSummary: { version: "1.0.0" },
    compatibility: null,
    capabilities: null,
    verification: null,
    createdAt: 1,
    updatedAt: 1,
    softDeletedAt: undefined,
    ...overrides,
  };
}

function makeReleaseDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "packageReleases:demo-1",
    packageId: "packages:demo",
    version: "1.0.0",
    createdAt: 1,
    softDeletedAt: undefined,
    ...overrides,
  };
}

function makeDigestCtx(options: {
  pages?: Array<{ page: Array<Record<string, unknown>>; isDone: boolean; continueCursor: string }>;
  takeResult?: Array<Record<string, unknown>>;
}) {
  const paginate = vi.fn();
  for (const page of options.pages ?? []) {
    paginate.mockResolvedValueOnce(page);
  }
  const take = vi.fn().mockResolvedValue(options.takeResult ?? []);
  const withIndex = vi.fn(() => ({
    order: vi.fn(() => ({
      paginate,
      take,
    })),
  }));

  return {
    paginate,
    take,
    ctx: {
      db: {
        query: vi.fn((table: string) => {
          if (table !== "packageSearchDigest") {
            throw new Error(`Unexpected table ${table}`);
          }
          return { withIndex };
        }),
      },
    },
  };
}

function makePackageCtx(options: {
  pkg?: Record<string, unknown> | null;
  latestRelease?: Record<string, unknown> | null;
  versionRelease?: Record<string, unknown> | null;
  versionsPage?: { page: Array<Record<string, unknown>>; isDone: boolean; continueCursor: string };
}) {
  const pkg = options.pkg ?? makePackageDoc();
  const latestRelease = options.latestRelease ?? makeReleaseDoc();
  const versionRelease = options.versionRelease ?? latestRelease;
  const versionsPage = options.versionsPage ?? {
    page: [latestRelease].filter(Boolean),
    isDone: true,
    continueCursor: "",
  };

  return {
    ctx: {
      db: {
        get: vi.fn(async (id: string) => {
          if (pkg && id === pkg.ownerUserId) return { _id: id, handle: "owner" };
          if (pkg && id === pkg.latestReleaseId) return latestRelease;
          return null;
        }),
        query: vi.fn((table: string) => {
          if (table === "packages") {
            return {
              withIndex: vi.fn(() => ({
                unique: vi.fn().mockResolvedValue(pkg),
              })),
            };
          }
          if (table === "packageReleases") {
            return {
              withIndex: vi.fn((_indexName: string) => ({
                unique: vi.fn().mockResolvedValue(versionRelease),
                order: vi.fn(() => ({
                  paginate: vi.fn().mockResolvedValue(versionsPage),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      },
    },
  };
}

describe("packages public queries", () => {
  it("keeps buffered cursor items aligned across paginated public pages", async () => {
    const { ctx, paginate } = makeDigestCtx({
      pages: [
        {
          page: [
            makeDigest("alpha"),
            makeDigest("bravo"),
            makeDigest("charlie"),
            makeDigest("delta"),
          ],
          isDone: false,
          continueCursor: "cursor:1",
        },
        {
          page: [makeDigest("echo")],
          isDone: true,
          continueCursor: "",
        },
      ],
    });

    const first = await listPublicPageHandler(ctx, {
      paginationOpts: { cursor: null, numItems: 2 },
    });
    const second = await listPublicPageHandler(ctx, {
      paginationOpts: { cursor: first.continueCursor, numItems: 2 },
    });
    const third = await listPublicPageHandler(ctx, {
      paginationOpts: { cursor: second.continueCursor, numItems: 2 },
    });

    expect(first.page.map((entry) => entry.name)).toEqual(["alpha", "bravo"]);
    expect(second.page.map((entry) => entry.name)).toEqual(["charlie", "delta"]);
    expect(third.page.map((entry) => entry.name)).toEqual(["echo"]);
    expect(paginate).toHaveBeenCalledTimes(2);
  });

  it("excludes private packages from public list pages", async () => {
    const { ctx } = makeDigestCtx({
      pages: [
        {
          page: [
            makeDigest("secret-plugin", { channel: "private" }),
            makeDigest("public-plugin"),
          ],
          isDone: true,
          continueCursor: "",
        },
      ],
    });

    const result = await listPublicPageHandler(ctx, {
      paginationOpts: { cursor: null, numItems: 10 },
    });

    expect(result.page.map((entry) => entry.name)).toEqual(["public-plugin"]);
  });

  it("filters private packages and capability flags in public search", async () => {
    const { ctx } = makeDigestCtx({
      takeResult: [
        makeDigest("secret-tools", {
          channel: "private",
          executesCode: true,
          capabilityTags: ["tools"],
        }),
        makeDigest("bundle-demo", {
          family: "bundle-plugin",
          executesCode: false,
          capabilityTags: [],
        }),
        makeDigest("tools-demo", {
          executesCode: true,
          capabilityTags: ["tools"],
        }),
      ],
    });

    const result = await searchPublicHandler(ctx, {
      query: "demo",
      executesCode: true,
      capabilityTag: "tools",
      limit: 10,
    });

    expect(result.map((entry) => entry.package.name)).toEqual(["tools-demo"]);
  });

  it("blocks anonymous reads of private packages", async () => {
    const { ctx } = makePackageCtx({
      pkg: makePackageDoc({ channel: "private" }),
    });

    await expect(
      getByNameHandler(ctx, { name: "demo-plugin" }),
    ).resolves.toBeNull();
    await expect(
      listVersionsHandler(ctx, {
        name: "demo-plugin",
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).resolves.toEqual({
      page: [],
      isDone: true,
      continueCursor: "",
    });
    await expect(
      getVersionByNameHandler(ctx, { name: "demo-plugin", version: "1.0.0" }),
    ).resolves.toBeNull();
  });

  it("allows owners to read their private packages", async () => {
    const { ctx } = makePackageCtx({
      pkg: makePackageDoc({ channel: "private" }),
    });

    const detail = await getByNameHandler(ctx, {
      name: "demo-plugin",
      viewerUserId: "users:owner",
    });
    const version = await getVersionByNameHandler(ctx, {
      name: "demo-plugin",
      version: "1.0.0",
      viewerUserId: "users:owner",
    });

    expect(detail?.package.name).toBe("demo-plugin");
    expect(version?.version.version).toBe("1.0.0");
  });
});
