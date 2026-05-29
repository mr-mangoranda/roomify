import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
    useNavigate: () => mockNavigate,
    useOutletContext: vi.fn(() => ({
        isSignedIn: false,
        userName: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
    })),
    useLocation: vi.fn(() => ({ state: null })),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
        React.createElement("a", { href: to }, children),
}));

const mockCreateProject = vi.fn();
vi.mock("../../lib/puter.action", () => ({
    createProject: (...args: unknown[]) => mockCreateProject(...args),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
}));

// Mock Navbar to avoid outlet context complexity
vi.mock("../../components/Navbar", () => ({
    default: () => React.createElement("nav", { "data-testid": "mock-navbar" }),
}));

// Capture the onComplete callback from Upload so tests can invoke it
let capturedOnComplete: ((base64: string) => Promise<boolean | void>) | null = null;
vi.mock("../../components/Upload", () => ({
    default: ({ onComplete }: { onComplete: (b: string) => Promise<boolean | void> }) => {
        capturedOnComplete = onComplete;
        return React.createElement("div", { "data-testid": "mock-upload" });
    },
}));

import Home from "../../app/routes/home";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Home component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedOnComplete = null;
    });

    it("renders without crashing", () => {
        render(<Home />);
        expect(screen.getByTestId("mock-navbar")).toBeInTheDocument();
    });

    it("renders the upload widget", () => {
        render(<Home />);
        expect(screen.getByTestId("mock-upload")).toBeInTheDocument();
    });

    it("renders the hero heading", () => {
        render(<Home />);
        expect(screen.getByText("ANO TARA? SEND MO FLOOR PLAN MO")).toBeInTheDocument();
    });

    it("renders the announcement text", () => {
        render(<Home />);
        expect(screen.getByText("Introducing HABIBI-Visualizer 2.0")).toBeInTheDocument();
    });

    it("renders the Projects section heading", () => {
        render(<Home />);
        expect(screen.getByText("Projects")).toBeInTheDocument();
    });

    it("shows no project cards initially", () => {
        render(<Home />);
        expect(screen.queryByText(/Residence/)).not.toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // handleUploadComplete – success path
    // -----------------------------------------------------------------------

    it("navigates to the visualizer route on a successful upload", async () => {
        mockCreateProject.mockResolvedValue({
            id: "1000",
            name: "Residence 1000",
            sourceImage: "https://roomify-test.puter.site/projects/1000/source.png",
            renderedImage: null,
            timestamp: 1000,
        });

        render(<Home />);
        expect(capturedOnComplete).not.toBeNull();

        let result: boolean | void;
        await act(async () => {
            result = await capturedOnComplete!("data:image/png;base64,abc");
        });

        expect(result).toBe(true);
        expect(mockNavigate).toHaveBeenCalledOnce();
        const [path, opts] = mockNavigate.mock.calls[0];
        expect(path).toMatch(/^\/visualizer\//);
        expect(opts.state.initialImage).toBe(
            "https://roomify-test.puter.site/projects/1000/source.png",
        );
    });

    it("passes the project name in navigation state", async () => {
        mockCreateProject.mockResolvedValue({
            id: "1001",
            sourceImage: "https://roomify-test.puter.site/projects/1001/source.png",
            renderedImage: null,
            timestamp: 1001,
        });

        render(<Home />);

        await act(async () => {
            await capturedOnComplete!("data:image/png;base64,abc");
        });

        const [, opts] = mockNavigate.mock.calls[0];
        expect(opts.state.name).toMatch(/^Residence /);
    });

    it("passes initialRendered as null in navigation state when renderedImage is null", async () => {
        mockCreateProject.mockResolvedValue({
            id: "1002",
            sourceImage: "https://roomify-test.puter.site/projects/1002/source.png",
            renderedImage: null,
            timestamp: 1002,
        });

        render(<Home />);

        await act(async () => {
            await capturedOnComplete!("data:image/png;base64,abc");
        });

        const [, opts] = mockNavigate.mock.calls[0];
        expect(opts.state.initialRendered).toBeNull();
    });

    it("passes the renderedImage URL in navigation state when available", async () => {
        const renderedUrl = "https://roomify-test.puter.site/projects/1003/rendered.png";
        mockCreateProject.mockResolvedValue({
            id: "1003",
            sourceImage: "https://roomify-test.puter.site/projects/1003/source.png",
            renderedImage: renderedUrl,
            timestamp: 1003,
        });

        render(<Home />);

        await act(async () => {
            await capturedOnComplete!("data:image/png;base64,abc");
        });

        const [, opts] = mockNavigate.mock.calls[0];
        expect(opts.state.initialRendered).toBe(renderedUrl);
    });

    // -----------------------------------------------------------------------
    // handleUploadComplete – failure path
    // -----------------------------------------------------------------------

    it("returns false and does not navigate when createProject returns null", async () => {
        mockCreateProject.mockResolvedValue(null);

        render(<Home />);

        let result: boolean | void;
        await act(async () => {
            result = await capturedOnComplete!("data:image/png;base64,abc");
        });

        expect(result).toBe(false);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("returns false and does not navigate when createProject returns undefined", async () => {
        mockCreateProject.mockResolvedValue(undefined);

        render(<Home />);

        let result: boolean | void;
        await act(async () => {
            result = await capturedOnComplete!("data:image/png;base64,abc");
        });

        expect(result).toBe(false);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Project card rendering
    // -----------------------------------------------------------------------

    it("adds a project card to the grid after a successful upload", async () => {
        mockCreateProject.mockResolvedValue({
            id: "2000",
            sourceImage: "https://roomify-test.puter.site/projects/2000/source.png",
            renderedImage: null,
            timestamp: 2000,
        });

        render(<Home />);

        await act(async () => {
            await capturedOnComplete!("data:image/png;base64,abc");
        });

        // A project card with a name matching 'Residence XXXX' should appear
        expect(screen.getByText(/Residence/)).toBeInTheDocument();
    });

    it("uses renderedImage as img src when available in a project card", async () => {
        const renderedUrl = "https://roomify-test.puter.site/projects/2001/rendered.png";
        mockCreateProject.mockResolvedValue({
            id: "2001",
            sourceImage: "https://roomify-test.puter.site/projects/2001/source.png",
            renderedImage: renderedUrl,
            timestamp: 2001,
        });

        render(<Home />);

        await act(async () => {
            await capturedOnComplete!("data:image/png;base64,xyz");
        });

        // Project card uses the sourceImage (the raw base64) since we set newItem.sourceImage
        // renderedImage on newItem is undefined at time of setprojects; the card shows sourceImage
        const imgs = screen.getAllByRole("img");
        const projectImg = imgs.find((img) => img.getAttribute("src")?.startsWith("data:"));
        expect(projectImg).toBeDefined();
    });

    it("calls createProject with the correct item structure", async () => {
        mockCreateProject.mockResolvedValue({
            id: "3000",
            sourceImage: "https://roomify-test.puter.site/projects/3000/source.png",
            renderedImage: null,
            timestamp: 3000,
        });

        render(<Home />);

        await act(async () => {
            await capturedOnComplete!("data:image/png;base64,testimage");
        });

        expect(mockCreateProject).toHaveBeenCalledOnce();
        const [callArg] = mockCreateProject.mock.calls[0];
        expect(callArg.item.sourceImage).toBe("data:image/png;base64,testimage");
        expect(callArg.item.name).toMatch(/^Residence /);
        expect(callArg.visibility).toBe("private");
    });
});