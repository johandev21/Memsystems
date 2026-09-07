import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./login-page";

vi.mock("@clerk/react", () => ({
  SignIn: (props: any) => (
    <div data-testid="clerk-sign-in" data-routing={props.routing}>
      Clerk SignIn Component
    </div>
  ),
  ClerkLoaded: ({ children }: any) => <>{children}</>,
  ClerkLoading: ({ children }: any) => <>{children}</>,
}));

describe("LoginPage", () => {
  it("renders Clerk SignIn with hash routing", () => {
    render(<LoginPage />);

    const signIn = screen.getByTestId("clerk-sign-in");
    expect(signIn).toBeDefined();
    expect(signIn.getAttribute("data-routing")).toBe("hash");
  });
});
