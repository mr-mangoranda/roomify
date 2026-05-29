import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Use vi.hoisted so the mock object is available when vi.mock factories run
// ---------------------------------------------------------------------------
const mockPuter = vi.hoisted(() => ({
    kv: { get: vi.fn(), set: vi.fn() },
    hosting: { create: vi.fn() },
    fs: { mkdir: vi.fn(), write: vi.fn() },
}));

vi.mock("@heyputer/puter.js", () => ({ default: mockPuter }));

// ---------------------------------------------------------------------------
// Mock lib/util
// ---------------------------------------------------------------------------
vi.mock("../../lib/util", () => ({
    HOSTING_CONFIG_KEY: "roomify_hosting_config",
    HOSTING_DOMAIN_SUFFIX: ".puter.site",
    isHostedUrl: vi.fn(),
    createHostingSlug: vi.fn(() => "roomify-mock-slug"),
    getHostedUrl: vi.fn(),
    getImageExtension: vi.fn(() => "png"),
    fetchBlobFromUrl: vi.fn(),
    imageUrlToPngBlob: vi.fn(),
}));

import { getOrCreateHostingConfig, uploadImageToHosting } from "../../lib/puter.hosting";
import {
    isHostedUrl,
    createHostingSlug,
    getHostedUrl,
    getImageExtension,
    fetchBlobFromUrl,
    imageUrlToPngBlob,
} from "../../lib/util";

const mockIsHostedUrl = vi.mocked(isHostedUrl);
const mockCreateHostingSlug = vi.mocked(createHostingSlug);
const mockGetHostedUrl = vi.mocked(getHostedUrl);
const mockGetImageExtension = vi.mocked(getImageExtension);
const mockFetchBlobFromUrl = vi.mocked(fetchBlobFromUrl);
const mockImageUrlToPngBlob = vi.mocked(imageUrlToPngBlob);

// ---------------------------------------------------------------------------
// getOrCreateHostingConfig
// ---------------------------------------------------------------------------

describe("getOrCreateHostingConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateHostingSlug.mockReturnValue("roomify-mock-slug");
    });

    it("returns existing config from KV when subdomain is present", async () => {
        mockPuter.kv.get.mockResolvedValue({ subdomain: "existing-sub" });

        const result = await getOrCreateHostingConfig();

        expect(result).toEqual({ subdomain: "existing-sub" });
        expect(mockPuter.hosting.create).not.toHaveBeenCalled();
    });

    it("creates a new hosting entry when KV returns null", async () => {
        mockPuter.kv.get.mockResolvedValue(null);
        mockPuter.hosting.create.mockResolvedValue({ subdomain: "roomify-mock-slug" });

        const result = await getOrCreateHostingConfig();

        expect(result).toEqual({ subdomain: "roomify-mock-slug" });
        expect(mockPuter.hosting.create).toHaveBeenCalledWith("roomify-mock-slug", "");
    });

    it("creates a new hosting entry when KV returns an object with no subdomain", async () => {
        mockPuter.kv.get.mockResolvedValue({});
        mockPuter.hosting.create.mockResolvedValue({ subdomain: "roomify-mock-slug" });

        const result = await getOrCreateHostingConfig();

        expect(result).toEqual({ subdomain: "roomify-mock-slug" });
    });

    it("returns null when puter.hosting.create throws", async () => {
        mockPuter.kv.get.mockResolvedValue(null);
        mockPuter.hosting.create.mockRejectedValue(new Error("hosting API failed"));

        const result = await getOrCreateHostingConfig();

        expect(result).toBeNull();
    });

    it("uses the subdomain returned by puter.hosting.create (not the slug from createHostingSlug)", async () => {
        mockPuter.kv.get.mockResolvedValue(null);
        mockCreateHostingSlug.mockReturnValue("slug-from-util");
        mockPuter.hosting.create.mockResolvedValue({ subdomain: "slug-from-api" });

        const result = await getOrCreateHostingConfig();

        expect(result!.subdomain).toBe("slug-from-api");
    });
});

// ---------------------------------------------------------------------------
// uploadImageToHosting
// ---------------------------------------------------------------------------

describe("uploadImageToHosting", () => {
    const baseParams = {
        hosting: { subdomain: "roomify-test" },
        url: "data:image/png;base64,abc",
        projectId: "proj-1",
        label: "source" as const,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetImageExtension.mockReturnValue("png");
    });

    it("returns null when hosting is null", async () => {
        const result = await uploadImageToHosting({ ...baseParams, hosting: null });
        expect(result).toBeNull();
    });

    it("returns null when url is empty string", async () => {
        const result = await uploadImageToHosting({ ...baseParams, url: "" });
        expect(result).toBeNull();
    });

    it("returns { url } immediately when url is already a hosted URL", async () => {
        mockIsHostedUrl.mockReturnValue(true);

        const hostedUrl = "https://roomify-test.puter.site/projects/proj-1/source.png";
        const result = await uploadImageToHosting({ ...baseParams, url: hostedUrl });

        expect(result).toEqual({ url: hostedUrl });
        expect(mockPuter.fs.mkdir).not.toHaveBeenCalled();
        expect(mockPuter.fs.write).not.toHaveBeenCalled();
    });

    it("uses fetchBlobFromUrl for source label", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        const fakeBlob = new Blob(["data"], { type: "image/png" });
        mockFetchBlobFromUrl.mockResolvedValue({ blob: fakeBlob, contentType: "image/png" });
        mockGetHostedUrl.mockReturnValue("https://roomify-test.puter.site/projects/proj-1/source.png");

        mockPuter.fs.mkdir.mockResolvedValue(undefined);
        mockPuter.fs.write.mockResolvedValue(undefined);

        const result = await uploadImageToHosting({ ...baseParams, label: "source" });

        expect(mockFetchBlobFromUrl).toHaveBeenCalledWith(baseParams.url);
        expect(mockImageUrlToPngBlob).not.toHaveBeenCalled();
        expect(result).toEqual({ url: "https://roomify-test.puter.site/projects/proj-1/source.png" });
    });

    it("uses imageUrlToPngBlob for rendered label", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        const fakeBlob = new Blob(["pngdata"], { type: "image/png" });
        mockImageUrlToPngBlob.mockResolvedValue(fakeBlob);
        mockGetHostedUrl.mockReturnValue("https://roomify-test.puter.site/projects/proj-1/rendered.png");

        mockPuter.fs.mkdir.mockResolvedValue(undefined);
        mockPuter.fs.write.mockResolvedValue(undefined);

        const result = await uploadImageToHosting({ ...baseParams, label: "rendered" });

        expect(mockImageUrlToPngBlob).toHaveBeenCalledWith(baseParams.url);
        expect(mockFetchBlobFromUrl).not.toHaveBeenCalled();
        expect(result).toEqual({ url: "https://roomify-test.puter.site/projects/proj-1/rendered.png" });
    });

    it("returns null when fetchBlobFromUrl returns null", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        mockFetchBlobFromUrl.mockResolvedValue(null);

        const result = await uploadImageToHosting({ ...baseParams, label: "source" });

        expect(result).toBeNull();
    });

    it("returns null when imageUrlToPngBlob returns null", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        mockImageUrlToPngBlob.mockResolvedValue(null);

        const result = await uploadImageToHosting({ ...baseParams, label: "rendered" });

        expect(result).toBeNull();
    });

    it("returns null when getHostedUrl returns null", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        const fakeBlob = new Blob(["data"], { type: "image/png" });
        mockFetchBlobFromUrl.mockResolvedValue({ blob: fakeBlob, contentType: "image/png" });
        mockGetHostedUrl.mockReturnValue(null);

        mockPuter.fs.mkdir.mockResolvedValue(undefined);
        mockPuter.fs.write.mockResolvedValue(undefined);

        const result = await uploadImageToHosting({ ...baseParams });

        expect(result).toBeNull();
    });

    it("creates the correct directory path for a given projectId", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        const fakeBlob = new Blob(["data"], { type: "image/png" });
        mockFetchBlobFromUrl.mockResolvedValue({ blob: fakeBlob, contentType: "image/png" });
        mockGetHostedUrl.mockReturnValue("https://roomify-test.puter.site/projects/proj-1/source.png");

        mockPuter.fs.mkdir.mockResolvedValue(undefined);
        mockPuter.fs.write.mockResolvedValue(undefined);

        await uploadImageToHosting({ ...baseParams, projectId: "proj-1" });

        expect(mockPuter.fs.mkdir).toHaveBeenCalledWith("projects/proj-1", { createMissingParents: true });
    });

    it("writes the file to the correct path", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        const fakeBlob = new Blob(["data"], { type: "image/png" });
        mockFetchBlobFromUrl.mockResolvedValue({ blob: fakeBlob, contentType: "image/png" });
        mockGetHostedUrl.mockReturnValue("https://roomify-test.puter.site/projects/proj-1/source.png");
        mockGetImageExtension.mockReturnValue("png");

        mockPuter.fs.mkdir.mockResolvedValue(undefined);
        mockPuter.fs.write.mockResolvedValue(undefined);

        await uploadImageToHosting({ ...baseParams });

        expect(mockPuter.fs.write).toHaveBeenCalledWith(
            "projects/proj-1/source.png",
            expect.any(File),
        );
    });

    it("returns null when puter.fs.write throws", async () => {
        mockIsHostedUrl.mockReturnValue(false);
        const fakeBlob = new Blob(["data"], { type: "image/png" });
        mockFetchBlobFromUrl.mockResolvedValue({ blob: fakeBlob, contentType: "image/png" });
        mockGetHostedUrl.mockReturnValue("https://roomify-test.puter.site/projects/proj-1/source.png");

        mockPuter.fs.mkdir.mockResolvedValue(undefined);
        mockPuter.fs.write.mockRejectedValue(new Error("Write failed"));

        const result = await uploadImageToHosting({ ...baseParams });

        expect(result).toBeNull();
    });
});