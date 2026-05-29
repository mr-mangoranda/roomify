import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @heyputer/puter.js before importing the module under test
// ---------------------------------------------------------------------------
vi.mock("@heyputer/puter.js", () => ({
    default: {
        auth: {
            signIn: vi.fn(),
            signOut: vi.fn(),
            getUser: vi.fn(),
        },
        kv: { get: vi.fn(), set: vi.fn() },
        hosting: { create: vi.fn() },
        fs: { mkdir: vi.fn(), write: vi.fn() },
    },
}));

// Mock hosting and util dependencies
vi.mock("../../lib/puter.hosting", () => ({
    getOrCreateHostingConfig: vi.fn(),
    uploadImageToHosting: vi.fn(),
}));

vi.mock("../../lib/util", () => ({
    isHostedUrl: vi.fn(),
    createHostingSlug: vi.fn(() => "roomify-test-slug"),
    getHostedUrl: vi.fn(),
    getImageExtension: vi.fn(() => "png"),
    fetchBlobFromUrl: vi.fn(),
    imageUrlToPngBlob: vi.fn(),
    HOSTING_CONFIG_KEY: "roomify_hosting_config",
    HOSTING_DOMAIN_SUFFIX: ".puter.site",
}));

import { createProject } from "../../lib/puter.action";
import { getOrCreateHostingConfig, uploadImageToHosting } from "../../lib/puter.hosting";
import { isHostedUrl } from "../../lib/util";

const mockGetOrCreateHostingConfig = vi.mocked(getOrCreateHostingConfig);
const mockUploadImageToHosting = vi.mocked(uploadImageToHosting);
const mockIsHostedUrl = vi.mocked(isHostedUrl);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<DesignItem> = {}): DesignItem {
    return {
        id: "123",
        name: "Test Project",
        sourceImage: "data:image/png;base64,abc",
        renderedImage: null,
        timestamp: 1000000,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// createProject
// ---------------------------------------------------------------------------

describe("createProject", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns a payload with the hosted source URL on success", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting.mockResolvedValue({ url: "https://roomify-test.puter.site/projects/123/source.png" });
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem();
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect(result!.sourceImage).toBe("https://roomify-test.puter.site/projects/123/source.png");
    });

    it("returns null when getOrCreateHostingConfig returns null and source is not a hosted URL", async () => {
        mockGetOrCreateHostingConfig.mockResolvedValue(null);
        mockUploadImageToHosting.mockResolvedValue(null);
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem();
        const result = await createProject({ item });

        expect(result).toBeNull();
    });

    it("returns null when uploadImageToHosting returns null and source is not already hosted", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting.mockResolvedValue(null);
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem({ sourceImage: "data:image/png;base64,raw" });
        const result = await createProject({ item });

        expect(result).toBeNull();
    });

    it("accepts an already-hosted source URL even when upload returns null", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting.mockResolvedValue(null);
        // isHostedUrl returns true for the source URL
        mockIsHostedUrl.mockImplementation((v) =>
            typeof v === "string" && v.includes(".puter.site"),
        );

        const item = makeItem({ sourceImage: "https://roomify-test.puter.site/projects/old/source.png" });
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect(result!.sourceImage).toBe("https://roomify-test.puter.site/projects/old/source.png");
    });

    it("uploads both source and rendered images when renderedImage is provided", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting
            .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/projects/123/source.png" })
            .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/projects/123/rendered.png" });
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem({ renderedImage: "data:image/png;base64,rendered" });
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect(result!.renderedImage).toBe("https://roomify-test.puter.site/projects/123/rendered.png");
        expect(mockUploadImageToHosting).toHaveBeenCalledTimes(2);
    });

    it("does not call uploadImageToHosting for rendered when renderedImage is null", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting.mockResolvedValue({ url: "https://roomify-test.puter.site/projects/123/source.png" });
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem({ renderedImage: null });
        await createProject({ item });

        // uploadImageToHosting called only once (for source)
        expect(mockUploadImageToHosting).toHaveBeenCalledTimes(1);
        expect(mockUploadImageToHosting).toHaveBeenCalledWith(
            expect.objectContaining({ label: "source" }),
        );
    });

    it("strips sourcePath, renderedPath, and publicPath from the returned payload", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting.mockResolvedValue({ url: "https://roomify-test.puter.site/projects/123/source.png" });
        mockIsHostedUrl.mockReturnValue(false);

        const item: DesignItem = {
            ...makeItem(),
            sourcePath: "/internal/path/source.png",
            renderedPath: "/internal/path/rendered.png",
            publicPath: "/public/path/image.png",
        };
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect((result as Record<string, unknown>).sourcePath).toBeUndefined();
        expect((result as Record<string, unknown>).renderedPath).toBeUndefined();
        expect((result as Record<string, unknown>).publicPath).toBeUndefined();
    });

    it("falls back to undefined renderedImage in payload when render upload fails and rendered is not a hosted URL", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting
            .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/projects/123/source.png" })
            .mockResolvedValueOnce(null); // render upload fails
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem({ renderedImage: "data:image/png;base64,rawrender" });
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect(result!.renderedImage).toBeUndefined();
    });

    it("preserves an already-hosted renderedImage when upload returns null", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting
            .mockResolvedValueOnce({ url: "https://roomify-test.puter.site/projects/123/source.png" })
            .mockResolvedValueOnce(null);
        // isHostedUrl returns true for .puter.site URLs
        mockIsHostedUrl.mockImplementation((v) =>
            typeof v === "string" && v.includes(".puter.site"),
        );

        const item = makeItem({
            renderedImage: "https://roomify-test.puter.site/projects/123/rendered.png",
        });
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect(result!.renderedImage).toBe(
            "https://roomify-test.puter.site/projects/123/rendered.png",
        );
    });

    it("preserves non-image fields (id, name, timestamp) in the returned payload", async () => {
        const hosting = { subdomain: "roomify-test" };
        mockGetOrCreateHostingConfig.mockResolvedValue(hosting);
        mockUploadImageToHosting.mockResolvedValue({ url: "https://roomify-test.puter.site/projects/999/source.png" });
        mockIsHostedUrl.mockReturnValue(false);

        const item = makeItem({ id: "999", name: "My Project", timestamp: 9999999 });
        const result = await createProject({ item });

        expect(result).not.toBeNull();
        expect(result!.id).toBe("999");
        expect(result!.name).toBe("My Project");
        expect(result!.timestamp).toBe(9999999);
    });
});