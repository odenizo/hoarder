import { createHoarderClient } from "@hoarderapp/sdk";
import { assert, beforeEach, describe, expect, inject, it } from "vitest";

import { createTestUser } from "../../utils/api";

describe("Bookmarks API", () => {
  const port = inject("hoarderPort");

  if (!port) {
    throw new Error("Missing required environment variables");
  }

  let client: ReturnType<typeof createHoarderClient>;
  let apiKey: string;

  beforeEach(async () => {
    apiKey = await createTestUser();
    client = createHoarderClient({
      baseUrl: `http://localhost:${port}/api/v1/`,
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
    });
  });

  it("should create and retrieve a bookmark", async () => {
    // Create a new bookmark
    const {
      data: createdBookmark,
      response: createResponse,
      error,
    } = await client.POST("/bookmarks", {
      body: {
        type: "text",
        title: "Test Bookmark",
        text: "This is a test bookmark",
      },
    });

    if (error) {
      console.error("Error creating bookmark:", error);
    }

    expect(createResponse.status).toBe(201);
    expect(createdBookmark).toBeDefined();
    expect(createdBookmark?.id).toBeDefined();

    // Get the created bookmark
    const { data: retrievedBookmark, response: getResponse } = await client.GET(
      "/bookmarks/{bookmarkId}",
      {
        params: {
          path: {
            bookmarkId: createdBookmark.id,
          },
        },
      },
    );

    expect(getResponse.status).toBe(200);
    expect(retrievedBookmark!.id).toBe(createdBookmark.id);
    expect(retrievedBookmark!.title).toBe("Test Bookmark");
    assert(retrievedBookmark!.content.type === "text");
    expect(retrievedBookmark!.content.text).toBe("This is a test bookmark");
  });

  it("should update a bookmark", async () => {
    // Create a new bookmark
    const { data: createdBookmark, error: createError } = await client.POST(
      "/bookmarks",
      {
        body: {
          type: "text",
          title: "Test Bookmark",
          text: "This is a test bookmark",
        },
      },
    );

    if (createError) {
      console.error("Error creating bookmark:", createError);
      throw createError;
    }
    if (!createdBookmark) {
      throw new Error("Bookmark creation failed");
    }

    // Update the bookmark
    const { data: updatedBookmark, response: updateResponse } =
      await client.PATCH("/bookmarks/{bookmarkId}", {
        params: {
          path: {
            bookmarkId: createdBookmark.id,
          },
        },
        body: {
          title: "Updated Title",
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updatedBookmark!.title).toBe("Updated Title");
  });

  it("should delete a bookmark", async () => {
    // Create a new bookmark
    const { data: createdBookmark, error: createError } = await client.POST(
      "/bookmarks",
      {
        body: {
          type: "text",
          title: "Test Bookmark",
          text: "This is a test bookmark",
        },
      },
    );

    if (createError) {
      console.error("Error creating bookmark:", createError);
      throw createError;
    }
    if (!createdBookmark) {
      throw new Error("Bookmark creation failed");
    }

    // Delete the bookmark
    const { response: deleteResponse } = await client.DELETE(
      "/bookmarks/{bookmarkId}",
      {
        params: {
          path: {
            bookmarkId: createdBookmark.id,
          },
        },
      },
    );

    expect(deleteResponse.status).toBe(204);

    // Verify it's deleted
    const { response: getResponse } = await client.GET(
      "/bookmarks/{bookmarkId}",
      {
        params: {
          path: {
            bookmarkId: createdBookmark.id,
          },
        },
      },
    );

    expect(getResponse.status).toBe(404);
  });

  it("should paginate through bookmarks", async () => {
    // Create multiple bookmarks
    const bookmarkPromises = Array.from({ length: 5 }, (_, i) =>
      client.POST("/bookmarks", {
        body: {
          type: "text",
          title: `Test Bookmark ${i}`,
          text: `This is test bookmark ${i}`,
        },
      }),
    );

    const createdBookmarks = await Promise.all(bookmarkPromises);
    const bookmarkIds = createdBookmarks.map((b) => b.data!.id);

    // Get first page
    const { data: firstPage, response: firstResponse } = await client.GET(
      "/bookmarks",
      {
        params: {
          query: {
            limit: 2,
          },
        },
      },
    );

    expect(firstResponse.status).toBe(200);
    expect(firstPage!.bookmarks.length).toBe(2);
    expect(firstPage!.nextCursor).toBeDefined();

    // Get second page
    const { data: secondPage, response: secondResponse } = await client.GET(
      "/bookmarks",
      {
        params: {
          query: {
            limit: 2,
            cursor: firstPage!.nextCursor!,
          },
        },
      },
    );

    expect(secondResponse.status).toBe(200);
    expect(secondPage!.bookmarks.length).toBe(2);
    expect(secondPage!.nextCursor).toBeDefined();

    // Get final page
    const { data: finalPage, response: finalResponse } = await client.GET(
      "/bookmarks",
      {
        params: {
          query: {
            limit: 2,
            cursor: secondPage!.nextCursor!,
          },
        },
      },
    );

    expect(finalResponse.status).toBe(200);
    expect(finalPage!.bookmarks.length).toBe(1);
    expect(finalPage!.nextCursor).toBeNull();

    // Verify all bookmarks were returned
    const allBookmarks = [
      ...firstPage!.bookmarks,
      ...secondPage!.bookmarks,
      ...finalPage!.bookmarks,
    ];
    expect(allBookmarks.map((b) => b.id)).toEqual(
      expect.arrayContaining(bookmarkIds),
    );
  });

  it("should manage tags on a bookmark", async () => {
    // Create a new bookmark
    const { data: createdBookmark, error: createError } = await client.POST(
      "/bookmarks",
      {
        body: {
          type: "text",
          title: "Test Bookmark",
          text: "This is a test bookmark",
        },
      },
    );

    if (createError) {
      console.error("Error creating bookmark:", createError);
      throw createError;
    }
    if (!createdBookmark) {
      throw new Error("Bookmark creation failed");
    }

    // Add tags
    const { data: addTagsResponse, response: addTagsRes } = await client.POST(
      "/bookmarks/{bookmarkId}/tags",
      {
        params: {
          path: {
            bookmarkId: createdBookmark.id,
          },
        },
        body: {
          tags: [{ tagName: "test-tag" }],
        },
      },
    );

    expect(addTagsRes.status).toBe(200);
    expect(addTagsResponse!.attached.length).toBe(1);

    // Remove tags
    const { response: removeTagsRes } = await client.DELETE(
      "/bookmarks/{bookmarkId}/tags",
      {
        params: {
          path: {
            bookmarkId: createdBookmark.id,
          },
        },
        body: {
          tags: [{ tagId: addTagsResponse!.attached[0] }],
        },
      },
    );

    expect(removeTagsRes.status).toBe(200);
  });
});