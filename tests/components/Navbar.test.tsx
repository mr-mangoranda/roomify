import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock react-router
// ---------------------------------------------------------------------------

const mockUseOutletContext = vi.fn();
vi.mock("react-router", () => ({
    useOutletContext: () => mockUseOutletContext(),
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ state: null })),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
        React.createElement("a", { href: to }, children),
}));

import Navbar from "../../components/Navbar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
    return {
        isSignedIn: false,
        userName: null,
        userId: null,
        signIn: vi.fn().mockResolvedValue(true),
        signOut: vi.fn().mockResolvedValue(true),
        refreshAuth: vi.fn().mockResolvedValue(true),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Navbar component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Brand name
    it("displays the brand name HABIBI-Visualizer", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext());
        render(<Navbar />);
        expect(screen.getByText("HABIBI-Visualizer")).toBeInTheDocument();
    });

    // Navigation links
    it("renders all navigation links", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext());
        render(<Navbar />);
        expect(screen.getByText("Product")).toBeInTheDocument();
        expect(screen.getByText("Pricing")).toBeInTheDocument();
        expect(screen.getByText("Community")).toBeInTheDocument();
        expect(screen.getByText("Enterprise")).toBeInTheDocument();
    });

    // Signed-out state
    it("shows Log In and Get Started buttons when not signed in", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: false }));
        render(<Navbar />);
        expect(screen.getByText("Log In")).toBeInTheDocument();
        expect(screen.getByText("Get Statrted")).toBeInTheDocument(); // intentional typo in source
    });

    it("does not show Log Out button when not signed in", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: false }));
        render(<Navbar />);
        expect(screen.queryByText("Log Out")).not.toBeInTheDocument();
    });

    // Signed-in state
    it("shows Log Out button when signed in", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: true, userName: "alice" }));
        render(<Navbar />);
        expect(screen.getByText("Log Out")).toBeInTheDocument();
    });

    it("does not show Log In button when signed in", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: true, userName: "alice" }));
        render(<Navbar />);
        expect(screen.queryByText("Log In")).not.toBeInTheDocument();
    });

    it("displays greeting with userName when signed in and userName is set", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: true, userName: "alice" }));
        render(<Navbar />);
        expect(screen.getByText("Hi, alice")).toBeInTheDocument();
    });

    it("displays generic 'Signed in' greeting when userName is null", () => {
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: true, userName: null }));
        render(<Navbar />);
        expect(screen.getByText("Signed in")).toBeInTheDocument();
    });

    // Auth click – sign in
    it("calls signIn when Log In is clicked and user is not signed in", async () => {
        const signIn = vi.fn().mockResolvedValue(true);
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: false, signIn }));

        render(<Navbar />);
        fireEvent.click(screen.getByText("Log In"));

        await waitFor(() => {
            expect(signIn).toHaveBeenCalledOnce();
        });
    });

    // Auth click – sign out
    it("calls signOut when Log Out is clicked and user is signed in", async () => {
        const signOut = vi.fn().mockResolvedValue(true);
        mockUseOutletContext.mockReturnValue(
            makeAuthContext({ isSignedIn: true, userName: "bob", signOut }),
        );

        render(<Navbar />);
        fireEvent.click(screen.getByText("Log Out"));

        await waitFor(() => {
            expect(signOut).toHaveBeenCalledOnce();
        });
    });

    it("does not call signIn when the user is already signed in and Log Out is clicked", async () => {
        const signIn = vi.fn().mockResolvedValue(true);
        const signOut = vi.fn().mockResolvedValue(true);
        mockUseOutletContext.mockReturnValue(
            makeAuthContext({ isSignedIn: true, userName: "bob", signIn, signOut }),
        );

        render(<Navbar />);
        fireEvent.click(screen.getByText("Log Out"));

        await waitFor(() => {
            expect(signOut).toHaveBeenCalledOnce();
        });
        expect(signIn).not.toHaveBeenCalled();
    });

    it("does not call signOut when the user is not signed in and Log In is clicked", async () => {
        const signIn = vi.fn().mockResolvedValue(true);
        const signOut = vi.fn().mockResolvedValue(true);
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: false, signIn, signOut }));

        render(<Navbar />);
        fireEvent.click(screen.getByText("Log In"));

        await waitFor(() => {
            expect(signIn).toHaveBeenCalledOnce();
        });
        expect(signOut).not.toHaveBeenCalled();
    });

    // Error resilience – signIn throws
    it("does not propagate errors thrown by signIn", async () => {
        const signIn = vi.fn().mockRejectedValue(new Error("Puter sign in failed"));
        mockUseOutletContext.mockReturnValue(makeAuthContext({ isSignedIn: false, signIn }));

        render(<Navbar />);
        // Should not throw
        expect(() => fireEvent.click(screen.getByText("Log In"))).not.toThrow();
        await waitFor(() => {
            expect(signIn).toHaveBeenCalled();
        });
    });

    // Error resilience – signOut throws
    it("does not propagate errors thrown by signOut", async () => {
        const signOut = vi.fn().mockRejectedValue(new Error("Puter sign out failed"));
        mockUseOutletContext.mockReturnValue(
            makeAuthContext({ isSignedIn: true, userName: "charlie", signOut }),
        );

        render(<Navbar />);
        expect(() => fireEvent.click(screen.getByText("Log Out"))).not.toThrow();
        await waitFor(() => {
            expect(signOut).toHaveBeenCalled();
        });
    });
});