import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock react-router so we can control useLocation
// ---------------------------------------------------------------------------
const mockUseLocation = vi.fn();

vi.mock("react-router", () => ({
    useLocation: () => mockUseLocation(),
    useNavigate: vi.fn(() => vi.fn()),
    useOutletContext: vi.fn(() => ({})),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
        React.createElement("a", { href: to }, children),
}));

import VisualizerId from "../../app/routes/visualizer.$id";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VisualizerId component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the project name from location state", () => {
        mockUseLocation.mockReturnValue({
            state: { initialImage: "data:image/png;base64,abc", name: "My Floor Plan" },
        });

        render(<VisualizerId />);

        expect(screen.getByText("My Floor Plan")).toBeInTheDocument();
    });

    it("falls back to 'Untitled Project' when name is not in location state", () => {
        mockUseLocation.mockReturnValue({ state: { initialImage: "data:image/png;base64,abc" } });

        render(<VisualizerId />);

        expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    it("falls back to 'Untitled Project' when location.state is null", () => {
        mockUseLocation.mockReturnValue({ state: null });

        render(<VisualizerId />);

        expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    it("renders the source image when initialImage is provided", () => {
        const imgSrc = "data:image/png;base64,validbase64==";
        mockUseLocation.mockReturnValue({
            state: { initialImage: imgSrc, name: "Room Render" },
        });

        render(<VisualizerId />);

        const img = screen.getByRole("img", { name: "source" });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", imgSrc);
    });

    it("does not render an image element when initialImage is absent", () => {
        mockUseLocation.mockReturnValue({ state: { name: "No Image Project" } });

        render(<VisualizerId />);

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("does not render an image element when initialImage is undefined in state", () => {
        mockUseLocation.mockReturnValue({
            state: { initialImage: undefined, name: "Still No Image" },
        });

        render(<VisualizerId />);

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders the 'Source Image' heading when an image is present", () => {
        mockUseLocation.mockReturnValue({
            state: { initialImage: "data:image/png;base64,abc", name: "With Heading" },
        });

        render(<VisualizerId />);

        expect(screen.getByText("Source Image")).toBeInTheDocument();
    });

    it("does not render the 'Source Image' heading when no image is provided", () => {
        mockUseLocation.mockReturnValue({ state: {} });

        render(<VisualizerId />);

        expect(screen.queryByText("Source Image")).not.toBeInTheDocument();
    });
});