import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    HOSTING_CONFIG_KEY,
    HOSTING_DOMAIN_SUFFIX,
    isHostedUrl,
    createHostingSlug,
    getHostedUrl,
    getImageExtension,
    dataUrlToBlob,
    fetchBlobFromUrl,
    imageUrlToPngBlob,
} from "../../lib/util";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("HOSTING_CONFIG_KEY", () => {
    it("equals roomify_hosting_config", () => {
        expect(HOSTING_CONFIG_KEY).toBe("roomify_hosting_config");
    });
});

describe("HOSTING_DOMAIN_SUFFIX", () => {
    it("equals .puter.site", () => {
        expect(HOSTING_DOMAIN_SUFFIX).toBe(".puter.site");
    });
});

// ---------------------------------------------------------------------------
// isHostedUrl
// ---------------------------------------------------------------------------

describe("isHostedUrl", () => {
    it("returns true for a URL that contains the puter.site domain", () => {
        expect(isHostedUrl("https://roomify-abc123.puter.site/projects/1/source.png")).toBe(true);
    });

    it("returns true when the value is just the suffix itself", () => {
        expect(isHostedUrl(".puter.site")).toBe(true);
    });

    it("returns false for a regular URL", () => {
        expect(isHostedUrl("https://example.com/image.png")).toBe(false);
    });

    it("returns false for a data URL", () => {
        expect(isHostedUrl("data:image/png;base64,abc123")).toBe(false);
    });

    it("returns false for an empty string", () => {
        expect(isHostedUrl("")).toBe(false);
    });

    it("returns false for a non-string value (number)", () => {
        expect(isHostedUrl(42)).toBe(false);
    });

    it("returns false for null", () => {
        expect(isHostedUrl(null)).toBe(false);
    });

    it("returns false for undefined", () => {
        expect(isHostedUrl(undefined)).toBe(false);
    });

    it("returns false for an object", () => {
        expect(isHostedUrl({ url: "https://x.puter.site/a.png" })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// createHostingSlug
// ---------------------------------------------------------------------------

describe("createHostingSlug", () => {
    it("starts with 'roomify-'", () => {
        const slug = createHostingSlug();
        expect(slug.startsWith("roomify-")).toBe(true);
    });

    it("produces a non-empty string", () => {
        expect(createHostingSlug().length).toBeGreaterThan(0);
    });

    it("produces unique slugs on successive calls", () => {
        const slugs = new Set(Array.from({ length: 20 }, () => createHostingSlug()));
        expect(slugs.size).toBeGreaterThan(1);
    });

    it("contains only safe URL characters (letters, digits, hyphens)", () => {
        const slug = createHostingSlug();
        expect(slug).toMatch(/^[a-z0-9-]+$/);
    });
});

// ---------------------------------------------------------------------------
// getHostedUrl
// ---------------------------------------------------------------------------

describe("getHostedUrl", () => {
    it("returns a correctly formatted URL for a plain subdomain", () => {
        const result = getHostedUrl({ subdomain: "roomify-abc" }, "projects/1/source.png");
        expect(result).toBe("https://roomify-abc.puter.site/projects/1/source.png");
    });

    it("does not double-append the suffix when subdomain already includes it", () => {
        const result = getHostedUrl(
            { subdomain: "roomify-abc.puter.site" },
            "projects/1/source.png",
        );
        expect(result).toBe("https://roomify-abc.puter.site/projects/1/source.png");
    });

    it("returns null when subdomain is an empty string", () => {
        expect(getHostedUrl({ subdomain: "" }, "projects/1/source.png")).toBeNull();
    });

    it("handles deeply nested file paths", () => {
        const result = getHostedUrl({ subdomain: "mysite" }, "a/b/c/d/file.png");
        expect(result).toBe("https://mysite.puter.site/a/b/c/d/file.png");
    });
});

// ---------------------------------------------------------------------------
// getImageExtension
// ---------------------------------------------------------------------------

describe("getImageExtension", () => {
    // --- content-type branch ---
    it("returns png for image/png content type", () => {
        expect(getImageExtension("image/png", "")).toBe("png");
    });

    it("returns jpg for image/jpeg content type", () => {
        expect(getImageExtension("image/jpeg", "")).toBe("jpg");
    });

    it("returns jpg for image/jpg content type", () => {
        expect(getImageExtension("image/jpg", "")).toBe("jpg");
    });

    it("returns webp for image/webp content type", () => {
        expect(getImageExtension("image/webp", "")).toBe("webp");
    });

    it("returns gif for image/gif content type", () => {
        expect(getImageExtension("image/gif", "")).toBe("gif");
    });

    it("returns svg for image/svg+xml content type", () => {
        expect(getImageExtension("image/svg+xml", "")).toBe("svg");
    });

    it("is case-insensitive for content type", () => {
        expect(getImageExtension("IMAGE/PNG", "")).toBe("png");
    });

    // --- data URL branch ---
    it("falls back to data URL parsing when content type is empty", () => {
        expect(getImageExtension("", "data:image/png;base64,abc")).toBe("png");
    });

    it("normalizes jpeg to jpg in data URL", () => {
        expect(getImageExtension("", "data:image/jpeg;base64,abc")).toBe("jpg");
    });

    it("handles webp data URL", () => {
        expect(getImageExtension("", "data:image/webp;base64,abc")).toBe("webp");
    });

    // --- file extension branch ---
    it("falls back to URL file extension when content type and data URL both fail", () => {
        expect(getImageExtension("", "https://example.com/image.jpg")).toBe("jpg");
    });

    it("handles URL with query string and extracts extension correctly", () => {
        expect(getImageExtension("", "https://example.com/photo.png?v=2")).toBe("png");
    });

    it("handles URL with fragment and extracts extension correctly", () => {
        expect(getImageExtension("", "https://example.com/img.gif#section")).toBe("gif");
    });

    // --- default fallback ---
    it("returns png as default when no extension can be determined", () => {
        expect(getImageExtension("", "https://example.com/noextension")).toBe("png");
    });

    it("returns png as default for completely empty inputs", () => {
        expect(getImageExtension("", "")).toBe("png");
    });
});

// ---------------------------------------------------------------------------
// dataUrlToBlob
// ---------------------------------------------------------------------------

describe("dataUrlToBlob", () => {
    it("parses a valid base64 PNG data URL", () => {
        // 1x1 transparent PNG (base64)
        const dataUrl =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const result = dataUrlToBlob(dataUrl);
        expect(result).not.toBeNull();
        expect(result!.contentType).toBe("image/png");
        expect(result!.blob).toBeInstanceOf(Blob);
        expect(result!.blob.size).toBeGreaterThan(0);
    });

    it("parses a plain-text (non-base64) data URL", () => {
        const dataUrl = "data:text/plain,Hello%20World";
        const result = dataUrlToBlob(dataUrl);
        expect(result).not.toBeNull();
        expect(result!.contentType).toBe("text/plain");
    });

    it("returns null for an invalid data URL string", () => {
        expect(dataUrlToBlob("not-a-data-url")).toBeNull();
    });

    it("returns null for a regular HTTPS URL", () => {
        expect(dataUrlToBlob("https://example.com/image.png")).toBeNull();
    });

    it("handles a data URL with no content type", () => {
        const result = dataUrlToBlob("data:,hello");
        expect(result).not.toBeNull();
        expect(result!.contentType).toBe("");
    });

    it("returns null for an empty string", () => {
        expect(dataUrlToBlob("")).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// fetchBlobFromUrl
// ---------------------------------------------------------------------------

describe("fetchBlobFromUrl", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("delegates to dataUrlToBlob for data: URLs", async () => {
        const dataUrl =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const result = await fetchBlobFromUrl(dataUrl);
        expect(result).not.toBeNull();
        expect(result!.contentType).toBe("image/png");
    });

    it("fetches a remote URL and returns blob + content-type", async () => {
        const fakeBlob = new Blob(["fake"], { type: "image/jpeg" });
        const fakeFetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => fakeBlob,
            headers: { get: (h: string) => (h === "content-type" ? "image/jpeg" : null) },
        });
        vi.stubGlobal("fetch", fakeFetch);

        const result = await fetchBlobFromUrl("https://example.com/image.jpg");
        expect(result).not.toBeNull();
        expect(result!.blob).toBe(fakeBlob);
        expect(result!.contentType).toBe("image/jpeg");
        expect(fakeFetch).toHaveBeenCalledWith("https://example.com/image.jpg");
    });

    it("returns null when fetch response is not ok", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
        const result = await fetchBlobFromUrl("https://example.com/notfound.png");
        expect(result).toBeNull();
    });

    it("returns null when fetch throws", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
        const result = await fetchBlobFromUrl("https://example.com/error.png");
        expect(result).toBeNull();
    });

    it("returns empty string content-type when header is absent", async () => {
        const fakeBlob = new Blob(["data"]);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => fakeBlob,
            headers: { get: () => null },
        }));
        const result = await fetchBlobFromUrl("https://example.com/nocontenttype");
        expect(result).not.toBeNull();
        expect(result!.contentType).toBe("");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });
});

// ---------------------------------------------------------------------------
// imageUrlToPngBlob
// ---------------------------------------------------------------------------

describe("imageUrlToPngBlob", () => {
    it("returns null when window is undefined (server environment)", async () => {
        // Temporarily remove window
        const originalWindow = globalThis.window;
        // @ts-expect-error intentional
        delete globalThis.window;
        const result = await imageUrlToPngBlob("https://example.com/image.png");
        expect(result).toBeNull();
        globalThis.window = originalWindow;
    });

    it("returns null when image fails to load (onerror)", async () => {
        // Mock Image to immediately fire onerror
        const MockImage = class {
            crossOrigin = "";
            onload: (() => void) | null = null;
            onerror: ((e: Error) => void) | null = null;
            private _src = "";
            get src() { return this._src; }
            set src(_val: string) {
                // trigger error asynchronously
                setTimeout(() => this.onerror?.(new Error("load failed")), 0);
            }
        };
        vi.stubGlobal("Image", MockImage);

        const result = await imageUrlToPngBlob("https://example.com/bad.png");
        expect(result).toBeNull();

        vi.unstubAllGlobals();
    });

    it("returns null when canvas has zero dimensions", async () => {
        const MockImage = class {
            crossOrigin = "";
            naturalWidth = 0;
            naturalHeight = 0;
            width = 0;
            height = 0;
            onload: (() => void) | null = null;
            onerror: ((e: Error) => void) | null = null;
            set src(_: string) {
                setTimeout(() => this.onload?.(), 0);
            }
        };
        vi.stubGlobal("Image", MockImage);

        const result = await imageUrlToPngBlob("https://example.com/zero.png");
        expect(result).toBeNull();

        vi.unstubAllGlobals();
    });

    it("returns a Blob when canvas renders successfully", async () => {
        const fakeBlob = new Blob(["png-data"], { type: "image/png" });

        const MockImage = class {
            crossOrigin = "";
            naturalWidth = 100;
            naturalHeight = 100;
            width = 100;
            height = 100;
            onload: (() => void) | null = null;
            onerror: ((e: Error) => void) | null = null;
            set src(_: string) {
                setTimeout(() => this.onload?.(), 0);
            }
        };
        vi.stubGlobal("Image", MockImage);

        const fakeCtx = { drawImage: vi.fn() };
        const fakeCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn().mockReturnValue(fakeCtx),
            toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(fakeBlob)),
        };
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            if (tag === "canvas") return fakeCanvas as unknown as HTMLElement;
            return document.createElement(tag);
        });

        const result = await imageUrlToPngBlob("https://example.com/valid.png");
        expect(result).toBe(fakeBlob);

        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("returns null when getContext returns null", async () => {
        const MockImage = class {
            crossOrigin = "";
            naturalWidth = 50;
            naturalHeight = 50;
            width = 50;
            height = 50;
            onload: (() => void) | null = null;
            onerror: ((e: Error) => void) | null = null;
            set src(_: string) {
                setTimeout(() => this.onload?.(), 0);
            }
        };
        vi.stubGlobal("Image", MockImage);

        const fakeCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn().mockReturnValue(null),
            toBlob: vi.fn(),
        };
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            if (tag === "canvas") return fakeCanvas as unknown as HTMLElement;
            return document.createElement(tag);
        });

        const result = await imageUrlToPngBlob("https://example.com/nocanvas.png");
        expect(result).toBeNull();

        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
});